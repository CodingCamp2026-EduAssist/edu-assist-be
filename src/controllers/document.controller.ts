import { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error';
import {
  createDocumentUpload,
  deleteDocumentsByKeys,
  listDocumentsForUser,
} from '../services/document.service';
import { parseSchema } from '../utils/validation';
import { DeleteDocumentBodySchema } from '../dtos/document.dto';

const ListDocumentsQueryDto = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

function requireAuthenticatedUser(req: Request): string {
  if (!req.user?.id) {
    throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
  }

  return req.user.id;
}

function requireUploadedFile(req: Request): Express.Multer.File {
  if (!req.file) {
    throw new AppError(400, 'file is required', 'DOCUMENT_FILE_REQUIRED');
  }

  return req.file;
}

export async function uploadDocument(req: Request, res: Response): Promise<void> {
  const userId = requireAuthenticatedUser(req);
  const file = requireUploadedFile(req);

  const document = await createDocumentUpload(userId, file);

  res.status(201).json({ document });
}

export async function listDocuments(req: Request, res: Response): Promise<void> {
  const userId = requireAuthenticatedUser(req);
  const query = parseSchema(ListDocumentsQueryDto, req.query, 'Invalid document query');

  const documents = await listDocumentsForUser(userId, query.limit);

  res.json({ documents });
}

export async function uploadBatchDocuments(req: Request, res: Response): Promise<void> {
  const userId = requireAuthenticatedUser(req);
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    throw new AppError(400, 'At least one file is required', 'DOCUMENT_FILES_REQUIRED');
  }

  const uploadResults = [];
  for (const file of files) {
    try {
      const document = await createDocumentUpload(userId, file);
      uploadResults.push({ success: true, document });
    } catch (error) {
      uploadResults.push({ success: false, error: (error as Error).message });
    }
  }

  res.status(207).json({ results: uploadResults });
}

export async function deleteDocument(req: Request, res: Response): Promise<void> {
  const { fileKeys } = DeleteDocumentBodySchema.parse(req.body);

  if (!Array.isArray(fileKeys) || fileKeys.some((key) => typeof key !== 'string')) {
    throw new AppError(400, 'fileKeys must be an array of strings', 'INVALID_FILE_KEYS');
  }

  const userId = requireAuthenticatedUser(req);
  await deleteDocumentsByKeys(userId, fileKeys);

  res.status(204).send();
}
