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

const ListChatSessionsQueryDto = z.object({
  guestSessionId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const ResumeChatSessionQueryDto = z.object({
  guestSessionId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const SendChatMessageQueryDto = z.object({
  guestSessionId: z.string().optional(),
});

const ChatSessionParamsDto = z.object({
  sessionId: z.string(),
});

function toActor(req: Request, guestSessionId?: string) {
  return {
    userId: req.user?.id,
    guestSessionId,
  };
}

export async function createSession(req: Request, res: Response): Promise<void> {
  const result = CreateConversationRequestDto.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: 'Invalid chat session payload', issues: result.error.issues });
    return;
  }

  const session = await createChatSession({
    userId: req.user?.id,
    guestSessionId: result.data.guestSessionId,
    title: result.data.title,
    initialContext: result.data.initialContext,
    linkedDocumentIds: result.data.linkedDocumentIds,
    studentProfile: result.data.studentProfile,
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
  const result = ListChatSessionsQueryDto.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({ error: 'Invalid chat session query', issues: result.error.issues });
    return;
  }

  const actor = toActor(req, result.data.guestSessionId);

  if (!actor.userId && !actor.guestSessionId) {
    res.status(400).json({ error: 'guestSessionId is required for guest sessions' });
    return;
  }

  const sessions = await listChatSessions(actor, result.data.limit);
  res.json({ sessions });
}

export async function resumeSession(req: Request, res: Response): Promise<void> {
  const result = ResumeChatSessionQueryDto.safeParse(req.query);
  const paramsResult = ChatSessionParamsDto.safeParse(req.params);

  if (!result.success || !paramsResult.success) {
    res.status(400).json({
      error: 'Invalid chat session query',
      issues: result.error?.issues ?? paramsResult.error?.issues ?? [],
    });
    return;
  }

  const actor = toActor(req, result.data.guestSessionId);

  if (!actor.userId && !actor.guestSessionId) {
    res.status(400).json({ error: 'guestSessionId is required for guest sessions' });
    return;
  }

  const session = await resumeChatSession(actor, paramsResult.data.sessionId, result.data.limit);

  if (!session) {
    res.status(404).json({ error: 'Chat session not found' });
    return;
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
  const result = ResumeChatSessionQueryDto.safeParse(req.query);
  const paramsResult = ChatSessionParamsDto.safeParse(req.params);

  if (!result.success || !paramsResult.success) {
    res.status(400).json({
      error: 'Invalid chat session query',
      issues: result.error?.issues ?? paramsResult.error?.issues ?? [],
    });
    return;
  }

  const actor = toActor(req, result.data.guestSessionId);

  if (!actor.userId && !actor.guestSessionId) {
    res.status(400).json({ error: 'guestSessionId is required for guest sessions' });
    return;
  }

  const session = await resumeChatSession(actor, paramsResult.data.sessionId, result.data.limit);

  if (!session) {
    res.status(404).json({ error: 'Chat session not found' });
    return;
  }

  res.json({
    conversationId: session.conversationId,
    messages: session.recentMessages,
  });
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const queryResult = SendChatMessageQueryDto.safeParse(req.query);
  const bodyResult = PostMessageRequestDto.safeParse(req.body);
  const paramsResult = ChatSessionParamsDto.safeParse(req.params);

  if (!queryResult.success || !paramsResult.success) {
    res.status(400).json({
      error: 'Invalid chat session query',
      issues: queryResult.error?.issues ?? paramsResult.error?.issues ?? [],
    });
    return;
  }

  if (!bodyResult.success) {
    res
      .status(400)
      .json({ error: 'Invalid chat message payload', issues: bodyResult.error.issues });
    return;
  }

  if (bodyResult.data.stream) {
    res.status(501).json({ error: 'Streaming message responses are not implemented yet' });
    return;
  }

  const actor = toActor(req, queryResult.data.guestSessionId);

  if (!actor.userId && !actor.guestSessionId) {
    res.status(400).json({ error: 'guestSessionId is required for guest sessions' });
    return;
  }

  const result = await sendChatMessage(actor, {
    sessionId: paramsResult.data.sessionId,
    content: bodyResult.data.content,
    attachmentIds: bodyResult.data.attachmentIds,
    locale: bodyResult.data.locale,
    stream: bodyResult.data.stream,
  });

  if (!result) {
    res.status(404).json({ error: 'Chat session not found' });
    return;
  }

  res.status(201).json(result);
}
