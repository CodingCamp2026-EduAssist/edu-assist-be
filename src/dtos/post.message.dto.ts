import { z } from 'zod';
import { ClientMessage, TokenUsage } from '../types';

export const PostMessageRequestDto = z.object({
  content: z.string(),
  stream: z.boolean().default(false),
  attachmentIds: z.array(z.string()).optional(),
  locale: z.string().optional(),
});

export const PostMessageResponseDto = z.object({
  userMessage: ClientMessage,
  assistantMessage: ClientMessage,
  tokenUsage: TokenUsage,
});

export type PostMessageRequestDto = z.infer<typeof PostMessageRequestDto>;
export type PostMessageResponseDto = z.infer<typeof PostMessageResponseDto>;
