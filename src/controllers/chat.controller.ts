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

const ListChatSessionsQueryDto = z
  .object({
    guestSessionId: z.uuid().trim().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

const ResumeChatSessionQueryDto = z
  .object({
    guestSessionId: z.uuid().trim().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

const SendChatMessageQueryDto = z
  .object({
    guestSessionId: z.uuid().trim().optional(),
  })
  .strict();

const ChatSessionParamsDto = z
  .object({
    sessionId: z.uuid().trim(),
  })
  .strict();

function toActor(req: Request, guestSessionId?: string) {
  return {
    userId: req.user?.id,
    guestSessionId,
  };
}

function requireActor(req: Request, guestSessionId?: string) {
  const actor = toActor(req, guestSessionId);

  if (!actor.userId && !actor.guestSessionId) {
    throw new AppError(
      400,
      'guestSessionId is required for guest sessions',
      'GUEST_SESSION_REQUIRED',
    );
  }

  return actor;
}

export async function createSession(req: Request, res: Response): Promise<void> {
  const payload = parseSchema(
    CreateConversationRequestDto,
    req.body,
    'Invalid chat session payload',
  );

  const session = await createChatSession({
    userId: req.user?.id,
    guestSessionId: payload.guestSessionId,
    title: payload.title,
    initialContext: payload.initialContext,
    linkedDocumentIds: payload.linkedDocumentIds,
    studentProfile: payload.studentProfile,
  });

  res.status(201).json({
    conversationId: session.id,
    guestSessionId: session.guestSessionId,
    createdAt: session.createdAt.toISOString(),
    status: 'active' as const,
    summary: session.rollingSummary ?? undefined,
    title: session.title ?? undefined,
  });
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  const query = parseSchema(ListChatSessionsQueryDto, req.query, 'Invalid chat session query');
  const actor = requireActor(req, query.guestSessionId);

  const sessions = await listChatSessions(actor, query.limit);
  res.json({ sessions });
}

export async function resumeSession(req: Request, res: Response): Promise<void> {
  const query = parseSchema(ResumeChatSessionQueryDto, req.query, 'Invalid chat session query');
  const params = parseSchema(ChatSessionParamsDto, req.params, 'Invalid chat session params');
  const actor = requireActor(req, query.guestSessionId);

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
    guestSessionId: session.guestSessionId ?? undefined,
    title: session.title ?? undefined,
  });
}

export async function listHistory(req: Request, res: Response): Promise<void> {
  const query = parseSchema(ResumeChatSessionQueryDto, req.query, 'Invalid chat session query');
  const params = parseSchema(ChatSessionParamsDto, req.params, 'Invalid chat session params');
  const actor = requireActor(req, query.guestSessionId);

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
  const query = parseSchema(SendChatMessageQueryDto, req.query, 'Invalid chat session query');
  const body = parseSchema(PostMessageRequestDto, req.body, 'Invalid chat message payload');
  const params = parseSchema(ChatSessionParamsDto, req.params, 'Invalid chat session params');
  const actor = requireActor(req, query.guestSessionId);

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
