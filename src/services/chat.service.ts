import { desc, eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { InferenceRequestDto } from '../dtos/inference.dto';
import { db } from '../db/db';
import {
  chatMessages,
  chatSessions,
  type ChatGuestContext,
  type ChatMessage,
  type ChatSession,
} from '../models/chat';
import {
  studentProfiles,
  type StudentProfileInput,
  StudentProfileSchema,
} from '../models/studentProfiles';
import { callInference } from './inference.service';
import type { ClientMessage, TokenUsage, Turn } from '../types';

export type ChatActor = {
  userId?: string;
  guestSessionId?: string;
};

export type CreateChatSessionInput = ChatActor & {
  title?: string;
  initialContext?: string;
  linkedDocumentIds?: string[];
  studentProfile?: Partial<StudentProfileInput>;
};

export type SendChatMessageInput = ChatActor & {
  sessionId: string;
  content: string;
  attachmentIds?: string[];
  locale?: string;
  stream?: boolean;
};

export type ChatSessionListItem = {
  conversationId: string;
  guestSessionId: string | null;
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
  guestSessionId: string | null;
  title: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'resumed' | 'archived';
  messageCount: number;
  recentMessages: ClientMessage[];
};

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function deriveTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 80);
}

function toStudentProfilePayload(profile: {
  educationLevel: StudentProfileInput['educationLevel'];
  difficultyPreference: StudentProfileInput['difficultyPreference'];
  favouriteSubjects: StudentProfileInput['favouriteSubjects'];
  pace: StudentProfileInput['pace'];
  explanationStyle: StudentProfileInput['explanationStyle'];
}): StudentProfileInput {
  return {
    educationLevel: profile.educationLevel,
    difficultyPreference: profile.difficultyPreference,
    favouriteSubjects: profile.favouriteSubjects,
    pace: profile.pace,
    explanationStyle: profile.explanationStyle,
  };
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

function toGuestContext(input: CreateChatSessionInput): ChatGuestContext {
  const context: ChatGuestContext = {};

  if (input.initialContext) {
    context.initialContext = input.initialContext;
  }

  if (input.linkedDocumentIds?.length) {
    context.linkedDocumentIds = [...new Set(input.linkedDocumentIds)];
  }

  if (input.studentProfile) {
    context.temporaryProfile = stripUndefined(input.studentProfile) as Partial<StudentProfileInput>;
  }

  return context;
}

async function getStudentProfileForUser(userId: string): Promise<StudentProfileInput | undefined> {
  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    return undefined;
  }

  return toStudentProfilePayload(profile);
}

async function upsertStudentProfileForUser(
  userId: string,
  profile: Partial<StudentProfileInput>,
): Promise<void> {
  const cleanedProfile = stripUndefined(profile);

  if (Object.keys(cleanedProfile).length === 0) {
    return;
  }

  await db
    .insert(studentProfiles)
    .values({
      userId,
      ...cleanedProfile,
    })
    .onConflictDoUpdate({
      target: studentProfiles.userId,
      set: {
        ...cleanedProfile,
        updatedAt: new Date(),
      },
    });
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
  if (session.userId) {
    return Boolean(actor.userId && actor.userId === session.userId);
  }

  if (session.guestSessionId) {
    return Boolean(actor.guestSessionId && actor.guestSessionId === session.guestSessionId);
  }

  return false;
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
  const guestSessionId = input.userId
    ? (input.guestSessionId ?? null)
    : (input.guestSessionId ?? uuidv4());

  if (input.userId && input.studentProfile) {
    await upsertStudentProfileForUser(input.userId, input.studentProfile);
  }

  const [session] = await db
    .insert(chatSessions)
    .values({
      userId: input.userId ?? null,
      guestSessionId,
      title: input.title ?? (input.initialContext ? deriveTitle(input.initialContext) : null),
      status: 'active',
      rollingSummary: null,
      lastMessageAt: null,
      guestContext: toGuestContext(input),
    })
    .returning();

  return session;
}

export async function listChatSessions(
  actor: ChatActor,
  limit = 20,
): Promise<ChatSessionListItem[]> {
  if (!actor.userId && !actor.guestSessionId) {
    return [];
  }

  const sessions = await db
    .select()
    .from(chatSessions)
    .where(
      actor.userId
        ? eq(chatSessions.userId, actor.userId)
        : eq(chatSessions.guestSessionId, actor.guestSessionId!),
    )
    .orderBy(desc(chatSessions.updatedAt))
    .limit(limit);

  const items = await Promise.all(
    sessions.map(async (session) => ({
      conversationId: session.id,
      guestSessionId: session.guestSessionId,
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
    guestSessionId: session.guestSessionId,
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
  const studentProfile = session.userId
    ? await getStudentProfileForUser(session.userId)
    : undefined;
  const inferencePayload = InferenceRequestDto.parse({
    userMessage: {
      content: input.content,
      attachmentIds: input.attachmentIds,
    },
    conversationId: session.id,
    recentTurns: recentMessages.map(toTurn),
    conversationSummary:
      session.rollingSummary ?? session.guestContext?.initialContext ?? undefined,
    locale: input.locale,
    studentProfile,
    guestContext: !session.userId
      ? {
          sessionId: session.guestSessionId ?? session.id,
          temporaryProfile: session.guestContext?.temporaryProfile ?? {},
        }
      : undefined,
    linkedDocumentIds: session.guestContext?.linkedDocumentIds,
    stream: input.stream ?? false,
  });

  const inferenceResponse = await callInference(inferencePayload);

  const [assistantMessage] = await db
    .insert(chatMessages)
    .values({
      chatSessionId: session.id,
      role: 'assistant',
      content: inferenceResponse.content,
      modelName: 'python-inference',
      modelMetadata: {
        provider: 'python-inference',
      },
      citations: inferenceResponse.citations ?? [],
      promptTokens: inferenceResponse.tokenUsage.promptTokens,
      completionTokens: inferenceResponse.tokenUsage.completionTokens,
      totalTokens: inferenceResponse.tokenUsage.totalTokens,
      retrievalChunks: inferenceResponse.tokenUsage.retrievalChunks ?? null,
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
    tokenUsage: inferenceResponse.tokenUsage,
  };
}

export async function claimGuestSession(sessionId: string, userId: string): Promise<boolean> {
  const session = await getSessionById(sessionId);

  if (!session || session.userId || !session.guestSessionId) {
    return false;
  }

  const normalizedProfile = session.guestContext?.temporaryProfile
    ? StudentProfileSchema.parse({
        educationLevel: 'undergraduate',
        difficultyPreference: 'adaptive',
        favouriteSubjects: [],
        pace: 'medium',
        explanationStyle: 'concise',
        ...session.guestContext.temporaryProfile,
      })
    : null;

  if (normalizedProfile) {
    await upsertStudentProfileForUser(userId, normalizedProfile);
  }

  await db
    .update(chatSessions)
    .set({
      userId,
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, session.id));

  return true;
}
