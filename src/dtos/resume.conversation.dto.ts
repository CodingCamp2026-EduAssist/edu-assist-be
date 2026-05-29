import { z } from 'zod';
import { ClientMessage } from '../types';

export const ResumeConversationResponseDto = z.object({
  conversationId: z.string(),
  title: z.string().optional(),
  summary: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.string(),
  messageCount: z.number().int().nonnegative(),
  recentMessages: z.array(ClientMessage),
});

export type ResumeConversationResponseDto = z.infer<typeof ResumeConversationResponseDto>;
