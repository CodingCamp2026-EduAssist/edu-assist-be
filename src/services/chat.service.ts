import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/db';
import { streamInference, type InferenceRequest } from './inference.service';
import type { Citation, ClientMessage, TokenUsage, Turn } from '../types';
import { ChatSession, chatSessions, GuestContext } from '../models/chatSessions';
import { ChatMessage, chatMessages } from '../models/chatMessages';
import { resolveStudentProfileForUser } from './profile.service';
import { CourseRecommendation } from '../dtos/inference.dto';
import { Course, courses } from '../models/courses';
import { chatMessageCourses } from '../models/chatMessageCourses';

const DEFAULT_INFERENCE_MAX_TOKENS = 2048;
const MODEL_NAME = 'qwen2.5';
const MODEL_PROVIDER = 'python-inference';

export type ChatActor = {
  userId: string;
};

export type CreateChatSessionInput = ChatActor & {
  title?: string;
  initialContext?: string;
  linkedDocumentIds?: string[];
};

export type SendChatMessageInput = {
  sessionId: string;
  content: string;
  attachmentIds?: string[];
  locale?: string;
  stream?: boolean;
};

export type ChatSessionListItem = {
  conversationId: string;
  title: string | null;
  status: ChatSession['status'];
  summary: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type ChatSessionHistory = {
  conversationId: string;
  title: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'resumed' | 'archived';
  messageCount: number;
  recentMessages: ClientMessage[];
};

export type ChatMessageChunk =
  | {
      type: 'text';
      content: string;
    }
  | {
      type: 'metadata';
      citations: Citation[];
      tokenUsage: TokenUsage;
      courseRecommended: CourseRecommendation[];
    }
  | {
      type: 'done';
    }
  | {
      type: 'thinking';
      content: string;
    };

function deriveTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 80);
}

function toClientMessage(message: ChatMessage): ClientMessage {
  return {
    id: message.id,
    conversationId: message.chatSessionId,
    role: message.role,
    content: message.content,
    citationIds: message.citations?.length
      ? message.citations.map((citation) => citation.id)
      : undefined,
    createdAt: message.createdAt.toISOString(),
  };
}

function toTurn(message: ChatMessage): Turn {
  return {
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
    citationIds: message.citations?.length
      ? message.citations.map((citation) => citation.id)
      : undefined,
    timestamp: message.createdAt.toISOString(),
  };
}

function toGuestContext(
  input: CreateChatSessionInput,
  profileSnapshot: Awaited<ReturnType<typeof resolveStudentProfileForUser>>,
): GuestContext {
  const context: GuestContext = {};

  if (input.initialContext) {
    context.initialContext = input.initialContext;
  }

  if (input.linkedDocumentIds?.length) {
    context.linkedDocumentIds = [...new Set(input.linkedDocumentIds)];
  }

  context.profileSnapshot = profileSnapshot;
  context.temporaryProfile = profileSnapshot;

  return context;
}

async function getSessionById(sessionId: string): Promise<ChatSession | null> {
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);
  return session ?? null;
}

function canAccessSession(session: ChatSession, actor: ChatActor): boolean {
  return Boolean(actor.userId && actor.userId === session.userId);
}

async function getRecentMessages(sessionId: string, limit = 20): Promise<ChatMessage[]> {
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatSessionId, sessionId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  return messages.reverse();
}

async function getMessageCount(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)`.mapWith(Number) })
    .from(chatMessages)
    .where(eq(chatMessages.chatSessionId, sessionId));

  return row?.value ?? 0;
}

export async function createChatSession(input: CreateChatSessionInput): Promise<ChatSession> {
  const profileSnapshot = await resolveStudentProfileForUser(input.userId);

  const [session] = await db
    .insert(chatSessions)
    .values({
      userId: input.userId,
      title: input.title ?? (input.initialContext ? deriveTitle(input.initialContext) : null),
      status: 'active',
      rollingSummary: null,
      lastMessageAt: null,
      guestContext: toGuestContext(input, profileSnapshot),
    })
    .returning();

  return session;
}

export async function listChatSessions(
  actor: ChatActor,
  limit = 20,
): Promise<ChatSessionListItem[]> {
  const sessions = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, actor.userId))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(limit);

  const items = await Promise.all(
    sessions.map(async (session) => ({
      conversationId: session.id,
      title: session.title,
      status: session.status,
      summary: session.rollingSummary ?? session.guestContext?.initialContext ?? null,
      lastMessageAt: session.lastMessageAt ? session.lastMessageAt.toISOString() : null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messageCount: await getMessageCount(session.id),
    })),
  );

  return items;
}

export async function resumeChatSession(
  actor: ChatActor,
  sessionId: string,
  limit = 20,
): Promise<ChatSessionHistory | null> {
  const session = await getSessionById(sessionId);

  if (!session || !canAccessSession(session, actor)) {
    return null;
  }

  const recentMessages = await getRecentMessages(session.id, limit);
  const messageCount = await getMessageCount(session.id);

  return {
    conversationId: session.id,
    title: session.title,
    summary: session.rollingSummary ?? session.guestContext?.initialContext ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    status: session.status === 'archived' ? 'archived' : 'resumed',
    messageCount,
    recentMessages: recentMessages.map(toClientMessage),
  };
}

export async function sendChatMessage(
  actor: ChatActor,
  input: SendChatMessageInput,
): Promise<{
  userMessage: ClientMessage;
  assistantMessage: ClientMessage;
  tokenUsage: TokenUsage;
} | null> {
  const session = await getSessionById(input.sessionId);

  console.log('Sending message to session:', session?.id);

  if (!session || !canAccessSession(session, actor)) {
    return null;
  }

  const now = new Date();

  const [userMessage] = await db
    .insert(chatMessages)
    .values({
      chatSessionId: session.id,
      role: 'user',
      content: input.content,
      modelName: null,
      modelMetadata: input.locale ? { locale: input.locale } : null,
      citations: [],
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      retrievalChunks: null,
    })
    .returning();

  const recentMessages = await getRecentMessages(session.id, 20);
  const studentProfile =
    session.guestContext?.profileSnapshot ?? session.guestContext?.temporaryProfile;
  const inferencePayload: InferenceRequest = {
    userMessage: {
      content: input.content,
      attachmentIds: input.attachmentIds,
    },
    conversationId: session.id,
    recentTurns: recentMessages.map(toTurn),
    conversationSummary: session.rollingSummary ?? session.guestContext?.initialContext ?? '',
    locale: input.locale,
    studentProfile: studentProfile ?? undefined,
    linkedDocumentIds: session.guestContext?.linkedDocumentIds ?? [],
    stream: input.stream ?? false,
    maxTokens: DEFAULT_INFERENCE_MAX_TOKENS,
  };

  let fullResponse = '';
  let extractedCitations: Citation[] = [];
  let tokenUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    retrievalChunks: 0,
  };

  const stream = await streamInference(inferencePayload);

  for await (const chunk of stream) {
    if (chunk.type === 'text') {
      fullResponse += chunk.content;
    } else if (chunk.type === 'metadata') {
      if (chunk.citations) {
        extractedCitations = chunk.citations;
      }
      if (chunk.tokenUsage) {
        tokenUsage = chunk.tokenUsage;
      }
    }
  }

  const [assistantMessage] = await db
    .insert(chatMessages)
    .values({
      chatSessionId: session.id,
      role: 'assistant',
      content: fullResponse,
      modelName: 'python-inference',
      modelMetadata: {
        provider: 'python-inference',
      },
      citations: extractedCitations ?? [],
      promptTokens: tokenUsage.promptTokens,
      completionTokens: tokenUsage.completionTokens,
      totalTokens: tokenUsage.totalTokens,
      retrievalChunks: tokenUsage.retrievalChunks ?? null,
    })
    .returning();

  const title = session.title ?? deriveTitle(input.content);

  await db
    .update(chatSessions)
    .set({
      title,
      lastMessageAt: now,
      updatedAt: now,
    })
    .where(eq(chatSessions.id, session.id));

  return {
    userMessage: toClientMessage(userMessage),
    assistantMessage: toClientMessage(assistantMessage),
    tokenUsage,
  };
}

export async function* streamChatMessage(
  actor: ChatActor,
  input: SendChatMessageInput,
): AsyncGenerator<ChatMessageChunk> {
  const session = await getSessionById(input.sessionId);

  console.log('Sending streaming message to session:', session?.id);

  if (!session || !canAccessSession(session, actor)) {
    yield {
      type: 'metadata',
      citations: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, retrievalChunks: 0 },
      courseRecommended: [],
    };
    return;
  }

  const now = new Date();

  const recentMessages = await getRecentMessages(session.id, 20);
  const studentProfile =
    session.guestContext?.profileSnapshot ?? session.guestContext?.temporaryProfile;
  const inferencePayload: InferenceRequest = {
    userMessage: {
      content: input.content,
      attachmentIds: input.attachmentIds,
    },
    conversationId: session.id,
    recentTurns: recentMessages.map(toTurn),
    conversationSummary: session.rollingSummary ?? session.guestContext?.initialContext ?? '',
    locale: input.locale,
    studentProfile: studentProfile ?? undefined,
    linkedDocumentIds: session.guestContext?.linkedDocumentIds ?? [],
    stream: true,
    maxTokens: DEFAULT_INFERENCE_MAX_TOKENS,
  };

  await db.insert(chatMessages).values({
    chatSessionId: session.id,
    role: 'user',
    content: input.content,
    modelName: null,
    modelMetadata: input.locale ? { locale: input.locale } : null,
    citations: [],
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    retrievalChunks: null,
  });

  let fullResponse = '';
  let fullThinkingProcess = '';
  let extractedCitations: Citation[] = [];
  let courseRecommended: CourseRecommendation[] = [];
  let tokenUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    retrievalChunks: 0,
  };

  const stream = await streamInference(inferencePayload);

  for await (const chunk of stream) {
    if (chunk.type === 'text') {
      fullResponse += chunk.content;
      yield { type: 'text', content: chunk.content };
    } else if (chunk.type === 'metadata') {
      if (chunk.citations) {
        extractedCitations = chunk.citations;
      }
      if (chunk.tokenUsage) {
        tokenUsage = chunk.tokenUsage;
      }
      if (chunk.courseRecommended) {
        courseRecommended = chunk.courseRecommended;
      }
    } else if (chunk.type === 'thinking') {
      fullThinkingProcess += chunk.content;
      yield { type: 'thinking', content: chunk.content };
    }
  }

  await db.insert(chatMessages).values({
    chatSessionId: session.id,
    role: 'assistant',
    content: fullResponse,
    thinkingProcess: fullThinkingProcess,
    modelName: MODEL_NAME,
    modelMetadata: {
      provider: MODEL_PROVIDER,
    },
    citations: extractedCitations ?? [],
    promptTokens: tokenUsage.promptTokens,
    completionTokens: tokenUsage.completionTokens,
    totalTokens: tokenUsage.totalTokens,
    retrievalChunks: tokenUsage.retrievalChunks ?? null,
  });

  const title = session.title ?? deriveTitle(input.content);

  const savedCourses = await saveCourseRecommendations(session.id, '', courseRecommended);
  if (savedCourses.length === 0) {
    console.log('No new courses were saved based on the recommendations.');
  }

  await db
    .update(chatSessions)
    .set({
      title,
      lastMessageAt: now,
      updatedAt: now,
    })
    .where(eq(chatSessions.id, session.id));

  yield {
    type: 'metadata',
    citations: extractedCitations,
    tokenUsage,
    courseRecommended,
  };
}

export async function saveCourseRecommendations(
  sessionId: string,
  messageId: string,
  recommendations: CourseRecommendation[],
): Promise<Course[]> {
  if (recommendations.length === 0) {
    return [];
  }

  let result: Course[] | null = null;

  await db.transaction(async (tx) => {
    result = await tx
      .insert(courses)
      .values(
        recommendations.map((rec) => ({
          title: rec.title,
          skills: rec.skills,
          rating: rec.rating,
          level: rec.level,
          url: rec.url,
          hybridMatch: rec.hybrid_match,
        })),
      )
      .onConflictDoNothing({ target: courses.url })
      .returning();

    await tx.insert(chatMessageCourses).values(
      result.map((course) => ({
        chatMessageId: messageId,
        courseId: course.id,
      })),
    );
  });

  return result ?? [];
}
