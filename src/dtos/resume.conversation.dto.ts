import { z } from 'zod';
import { ClientMessage } from '../types';

export const ResumeConversationResponseDto = z.object({
  conversationId: z.string(),
  summary: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(['active', 'resumed', 'archived'] as const),
  messageCount: z.number(),
  recentMessages: z.array(ClientMessage).optional(), // last 10 messages
});

export type ResumeConversationResponseDto = z.infer<typeof ResumeConversationResponseDto>;
