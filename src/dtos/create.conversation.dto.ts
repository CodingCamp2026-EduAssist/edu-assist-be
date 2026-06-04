import { z } from 'zod';

export const CreateConversationRequestDto = z
  .object({
    linkedDocumentPaths: z.array(z.string().trim()).max(20).optional(),
    initialContext: z.string().trim().min(1).max(4000).optional(),
    title: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const CreateConversationResponseDto = z.object({
  conversationId: z.uuid(),
  createdAt: z.iso.datetime(),
  status: z.enum(['active'] as const),
  summary: z.string().optional(),
  title: z.string().optional(),
});

export type CreateConversationRequestDto = z.infer<typeof CreateConversationRequestDto>;
export type CreateConversationResponseDto = z.infer<typeof CreateConversationResponseDto>;
