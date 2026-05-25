import { z } from 'zod';
import { ClientMessage, TokenUsage } from '../types';

const localePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/;

export const PostMessageRequestDto = z
  .object({
    content: z.string().trim().min(1).max(8000),
    stream: z.boolean().default(false),
    attachmentIds: z
      .array(z.uuid())
      .max(20)
      .optional()
      .transform((value) => (value ? [...new Set(value)] : undefined)),
    locale: z.string().trim().regex(localePattern).optional(),
  })
  .strict();

export const PostMessageResponseDto = z.object({
  userMessage: ClientMessage,
  assistantMessage: ClientMessage,
  tokenUsage: TokenUsage,
});

export type PostMessageRequestDto = z.infer<typeof PostMessageRequestDto>;
export type PostMessageResponseDto = z.infer<typeof PostMessageResponseDto>;
