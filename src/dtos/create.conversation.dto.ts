import { z } from 'zod';
import { StudentProfileSchema } from '../models/studentProfiles';

export const CreateConversationRequestDto = z
  .object({
    linkedDocumentIds: z
      .array(z.uuid())
      .max(20)
      .optional()
      .transform((value) => (value ? [...new Set(value)] : undefined)),
    initialContext: z.string().trim().min(1).max(4000).optional(),
    guestSessionId: z.uuid().trim().optional(),
    title: z.string().trim().min(1).max(120).optional(),
    studentProfile: StudentProfileSchema.partial().strict().optional(),
  })
  .strict();

export const CreateConversationResponseDto = z.object({
  conversationId: z.uuid(),
  guestSessionId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  status: z.enum(['active'] as const),
  summary: z.string().optional(),
  title: z.string().optional(),
});

export type CreateConversationRequestDto = z.infer<typeof CreateConversationRequestDto>;
export type CreateConversationResponseDto = z.infer<typeof CreateConversationResponseDto>;
