import { z } from 'zod';
import { Citation, TokenUsage, Turn } from '../types';
import { StudentProfileSchema } from '../models/studentProfiles';

export const InferenceRequestDto = z.object({
  userMessage: z.object({
    content: z.string(),
    attachmentIds: z.array(z.string()).optional(),
  }),
  conversationId: z.string(),
  recentTurns: z.array(Turn).optional(),
  conversationSummary: z.string().optional(),
  locale: z.string().optional(),
  studentProfile: StudentProfileSchema.optional(),
  guestContext: z
    .object({
      sessionId: z.string(),
      temporaryProfile: StudentProfileSchema.partial(),
    })
    .optional(),
  linkedDocumentIds: z.array(z.string()).optional(),
  stream: z.boolean().default(false),
  maxTokens: z.number().optional(),
});

export const InferenceResponseDto = z.object({
  content: z.string(),
  citations: Citation.array().optional(),
  tokenUsage: TokenUsage,
});
