import { z } from 'zod';

export const DocumentRecordSchema = z.object({
  id: z.uuid(),
  fileName: z.string(),
  originalPath: z.string(),
  markdownContent: z.string().nullable(),
  mimeType: z.string(),
  fileSize: z.number().int().positive(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum(['processing', 'ready', 'failed']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ListDocumentsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const ListDocumentsResponseSchema = z.object({
  documents: z.array(DocumentRecordSchema),
});

export const DeleteDocumentBodySchema = z
  .object({
    fileKeys: z.array(z.string()),
  })
  .strict();

export const UploadBatchResultItemSchema = z.object({
  success: z.boolean(),
  document: DocumentRecordSchema.optional(),
  error: z.string().optional(),
});

export const UploadBatchDocumentsResponseSchema = z.object({
  results: z.array(UploadBatchResultItemSchema),
});

export const UploadDocumentResponseSchema = z.object({
  document: DocumentRecordSchema,
});

export const DeleteDocumentResponseSchema = z.object({
  message: z.string().min(1),
});

export type DocumentRecordSchema = z.infer<typeof DocumentRecordSchema>;
export type ListDocumentsQuerySchema = z.infer<typeof ListDocumentsQuerySchema>;
export type ListDocumentsResponseSchema = z.infer<typeof ListDocumentsResponseSchema>;
export type DeleteDocumentBodySchema = z.infer<typeof DeleteDocumentBodySchema>;
export type UploadBatchResultItemSchema = z.infer<typeof UploadBatchResultItemSchema>;
export type UploadBatchDocumentsResponseSchema = z.infer<typeof UploadBatchDocumentsResponseSchema>;
export type UploadDocumentResponseSchema = z.infer<typeof UploadDocumentResponseSchema>;
export type DeleteDocumentResponseSchema = z.infer<typeof DeleteDocumentResponseSchema>;
