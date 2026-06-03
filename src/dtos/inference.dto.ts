import { z } from 'zod';
import { Citation, TokenUsage, Turn } from '../types';
import { StudentProfileSchema } from '../models/studentProfiles';

const localePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/;

export const InferenceRequestDto = z
  .object({
    userMessage: z
      .object({
        content: z.string().trim().min(1).max(8000),
        attachmentIds: z
          .array(z.uuid())
          .max(20)
          .optional()
          .transform((value) => (value ? [...new Set(value)] : undefined)),
      })
      .strict(),
    conversationId: z.uuid(),
    recentTurns: z.array(Turn).max(50).optional(),
    conversationSummary: z.string().trim().max(8000).optional(),
    locale: z.string().trim().regex(localePattern).optional(),
    studentProfile: StudentProfileSchema.partial().strict().optional(),
    linkedDocumentIds: z
      .array(z.uuid())
      .max(20)
      .optional()
      .transform((value) => (value ? [...new Set(value)] : undefined)),
    stream: z.boolean().default(false),
    maxTokens: z.coerce.number().int().positive().max(8192).optional(),
  })
  .strict();

export const InferenceResponseDto = z
  .object({
    content: z.string().min(1).max(8000),
    citations: Citation.array().optional(),
    tokenUsage: TokenUsage,
  })
  .strict();

export const CourseRecommendationDto = z
  .object({
    title: z.string().min(1).max(255),
    skills: z.array(z.string().min(1).max(100)).max(20),
    rating: z.number().min(0).max(5).optional(),
    level: z.string().min(1).max(100).optional(),
    url: z.string().url().optional(),
    hybrid_match: z.number().min(0).max(1).optional(),
  })
  .strict();

export const InferenceStreamChunkDto = z
  .object({
    text: z.string().min(1).max(8000),
    summary: z.string().min(1).max(8000).optional(),
    course_recommended: CourseRecommendationDto.array().optional(),
    citations: Citation.array().optional(),
    tokenUsage: TokenUsage.optional(),
    label: z.string().min(1).max(255).optional(),
  })
  .strict();

export type InferenceRequest = z.infer<typeof InferenceRequestDto>;
export type InferenceResponse = z.infer<typeof InferenceResponseDto>;
export type CourseRecommendation = z.infer<typeof CourseRecommendationDto>;
