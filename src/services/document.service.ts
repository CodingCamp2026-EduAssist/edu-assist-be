import { desc, eq, inArray, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/db';
import { AppError } from '../errors/app-error';
import { documents } from '../models/documents';
import {
  buildDocumentObjectKey,
  checksumSha256,
  deleteDocumentObject,
  putDocumentObject,
} from '../lib/object-storage';
import { env } from '../config/env';

type DocumentRow = typeof documents.$inferSelect;

export type DocumentRecord = {
  id: string;
  fileName: string;
  originalPath: string;
  markdownContent: string | null;
  mimeType: string;
  fileSize: number;
  metadata: Record<string, unknown> | null;
  status: 'processing' | 'ready' | 'failed';
  createdAt: string;
  updatedAt: string;
};

const supportedDocumentMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]);

function toDocumentRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    fileName: row.fileName,
    originalPath: row.originalPath,
    markdownContent: row.markdownContent ?? null,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    metadata: row.metadata ?? null,
    status: row.status as DocumentRecord['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertSupportedDocumentType(file: Express.Multer.File): void {
  if (!supportedDocumentMimeTypes.has(file.mimetype)) {
    throw new AppError(400, 'Unsupported document type', 'UNSUPPORTED_DOCUMENT_TYPE', {
      allowedMimeTypes: [...supportedDocumentMimeTypes],
    });
  }
}

export async function createDocumentUpload(
  userId: string,
  file: Express.Multer.File,
): Promise<DocumentRecord> {
  assertSupportedDocumentType(file);

  if (file.size > env.storageMaxUploadSizeBytes) {
    throw new AppError(413, 'Payload too large', 'DOCUMENT_TOO_LARGE', {
      maxBytes: env.storageMaxUploadSizeBytes,
    });
  }

  const documentId = uuidv4();
  const originalPath = buildDocumentObjectKey(userId, documentId, file.originalname);
  const checksum = checksumSha256(file.buffer);

  const [row] = await db
    .insert(documents)
    .values({
      id: documentId,
      userId,
      fileName: file.originalname,
      originalPath,
      markdownContent: null,
      mimeType: file.mimetype,
      fileSize: file.size,
      metadata: {
        originalFileName: file.originalname,
        uploadedByUserId: userId,
        checksumSha256: checksum,
        storageKey: originalPath,
      },
      status: 'processing',
    })
    .returning();

  try {
    await putDocumentObject({
      key: originalPath,
      body: file.buffer,
      contentType: file.mimetype,
      metadata: {
        'document-id': documentId,
        'user-id': userId,
        'original-file-name': file.originalname,
        'checksum-sha256': checksum,
      },
    });
  } catch (error) {
    try {
      await db
        .update(documents)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
    } catch {
      // Best-effort failure tracking only.
    }

    throw new AppError(500, 'Failed to upload document', 'DOCUMENT_UPLOAD_FAILED', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  return toDocumentRecord(row);
}

export async function listDocumentsForUser(userId: string, limit = 20): Promise<DocumentRecord[]> {
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt))
    .limit(limit);

  return rows.map(toDocumentRecord);
}

export async function deleteDocumentsByKeys(userId: string, fileKeys: string[]): Promise<void> {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, userId), inArray(documents.originalPath, fileKeys)));

  if (rows.length === 0) {
    throw new AppError(404, 'No documents found for deletion', 'DOCUMENTS_NOT_FOUND');
  }

  const documentIdsToDelete = rows.map((row) => row.id);
  const keysToDelete = rows.map((row) => row.originalPath);

  const storageResults = await Promise.allSettled(
    keysToDelete.map((key) => deleteDocumentObject(key)),
  );

  const failedKeys = storageResults
    .map((result, i) => (result.status === 'rejected' ? keysToDelete[i] : null))
    .filter(Boolean);

  if (failedKeys.length > 0) {
    throw new AppError(
      500,
      'Failed to delete some documents from storage',
      'DOCUMENT_DELETION_FAILED',
      { cause: `Failed keys: ${failedKeys.join(', ')}` },
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(documents).where(inArray(documents.id, documentIdsToDelete));
  });
}
