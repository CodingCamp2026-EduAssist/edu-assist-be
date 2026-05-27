import { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error';
import { createDocumentUpload, listDocumentsForUser } from '../services/document.service';
import { parseSchema } from '../utils/validation';

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
