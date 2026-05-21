import { z } from 'zod';
import { StudentProfileSchema } from '../models/studentProfiles';

export const CreateConversationRequestDto = z.object({
  linkedDocumentIds: z.array(z.string()).optional(),
  initialContext: z.string().optional(),
  guestSessionId: z.string().optional(),
  title: z.string().optional(),
  studentProfile: StudentProfileSchema.partial().optional(),
});

export const CreateConversationResponseDto = z.object({
  conversationId: z.string(),
  createdAt: z.string(),
  status: z.enum(['active', 'resumed', 'archived'] as const),
  summary: z.string().optional(),
});

export type CreateConversationRequestDto = z.infer<typeof CreateConversationRequestDto>;
export type CreateConversationResponseDto = z.infer<typeof CreateConversationResponseDto>;
