import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/db';
import { callInference, type InferenceRequest } from './inference.service';
import type { ClientMessage, TokenUsage, Turn } from '../types';
import { ChatSession, chatSessions, GuestContext } from '../models/chatSessions';
import { ChatMessage, chatMessages } from '../models/chatMessages';
import { resolveStudentProfileForUser } from './profile.service';

const DEFAULT_INFERENCE_MAX_TOKENS = 2048;

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
