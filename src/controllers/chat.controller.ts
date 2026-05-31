import { Request, Response } from 'express';
import { z } from 'zod';
import { CreateConversationRequestDto } from '../dtos/create.conversation.dto';
import { PostMessageRequestDto } from '../dtos/post.message.dto';
import {
  createChatSession,
  listChatSessions,
  resumeChatSession,
  sendChatMessage,
} from '../services/chat.service';
import { AppError } from '../errors/app-error';
import { parseSchema } from '../utils/validation';

const ChatSessionQueryDto = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

const ChatSessionParamsDto = z
  .object({
    sessionId: z.uuid().trim(),
  })
  .strict();

function requireAuthenticatedUser(req: Request): string {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
  }

  return userId;
}

export async function createSession(req: Request, res: Response): Promise<void> {
  const payload = parseSchema(
    CreateConversationRequestDto,
    req.body,
    'Invalid chat session payload',
  );
  const userId = requireAuthenticatedUser(req);

  const session = await createChatSession({
    userId,
    title: payload.title,
    initialContext: payload.initialContext,
    linkedDocumentIds: payload.linkedDocumentIds,
  });

  res.status(201).json({
    conversationId: session.id,
    createdAt: session.createdAt.toISOString(),
    status: 'active' as const,
    summary: session.rollingSummary ?? undefined,
    title: session.title ?? undefined,
  });
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  const query = parseSchema(ChatSessionQueryDto, req.query, 'Invalid chat session query');
  const actor = { userId: requireAuthenticatedUser(req) };

  const sessions = await listChatSessions(actor, query.limit);
  res.json({ sessions });
}

export async function resumeSession(req: Request, res: Response): Promise<void> {
  const query = parseSchema(ChatSessionQueryDto, req.query, 'Invalid chat session query');
  const params = parseSchema(ChatSessionParamsDto, req.params, 'Invalid chat session params');
  const actor = { userId: requireAuthenticatedUser(req) };

  const session = await resumeChatSession(actor, params.sessionId, query.limit);

  if (!session) {
    throw new AppError(404, 'Chat session not found', 'CHAT_SESSION_NOT_FOUND');
  }

  res.json({
    conversationId: session.conversationId,
    summary: session.summary ?? undefined,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    status: session.status,
    messageCount: session.messageCount,
    recentMessages: session.recentMessages,
    title: session.title ?? undefined,
  });
}

export async function listHistory(req: Request, res: Response): Promise<void> {
  const query = parseSchema(ChatSessionQueryDto, req.query, 'Invalid chat session query');
  const params = parseSchema(ChatSessionParamsDto, req.params, 'Invalid chat session params');
  const actor = { userId: requireAuthenticatedUser(req) };

  const session = await resumeChatSession(actor, params.sessionId, query.limit);

  if (!session) {
    throw new AppError(404, 'Chat session not found', 'CHAT_SESSION_NOT_FOUND');
  }

  res.json({
    conversationId: session.conversationId,
    messages: session.recentMessages,
  });
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const body = parseSchema(PostMessageRequestDto, req.body, 'Invalid chat message payload');
  const params = parseSchema(ChatSessionParamsDto, req.params, 'Invalid chat session params');
  const actor = { userId: requireAuthenticatedUser(req) };

  if (body.stream) {
    throw new AppError(
      501,
      'Streaming message responses are not implemented yet',
      'STREAMING_NOT_IMPLEMENTED',
    );
  }

  const result = await sendChatMessage(actor, {
    sessionId: params.sessionId,
    content: body.content,
    attachmentIds: body.attachmentIds,
    locale: body.locale,
    stream: body.stream,
  });

  if (!result) {
    throw new AppError(404, 'Chat session not found', 'CHAT_SESSION_NOT_FOUND');
  }

  res.status(201).json(result);
}
