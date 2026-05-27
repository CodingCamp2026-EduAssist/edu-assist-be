import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { env } from '../config/env';

const s3Client = new S3Client({
  region: env.storageRegion,
  endpoint: env.storageEndpoint,
  forcePathStyle: env.storageForcePathStyle,
});

function requireStorageBucket(): string {
  if (!env.storageBucket) {
    throw new Error('Missing required environment variable: STORAGE_BUCKET');
  }

  return env.storageBucket;
}

function sanitizeFileName(fileName: string): string {
  const parsed = path.parse(fileName);
  const safeBaseName = parsed.name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safeExtension = parsed.ext
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9.]+/g, '')
    .replace(/^\.+/, '');

  const safeName = (safeBaseName || 'file') + (safeExtension ? `.${safeExtension}` : '');

  return safeName.replace(/\.+/g, '.');
}

export function buildDocumentObjectKey(
  userId: string,
  documentId: string,
  fileName: string,
): string {
  return `users/${userId}/documents/${documentId}/${sanitizeFileName(fileName)}`;
}

export function checksumSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function putDocumentObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<{ key: string }> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: requireStorageBucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      Metadata: params.metadata,
    }),
  );

  return { key: params.key };
}

export async function deleteDocumentObject(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: requireStorageBucket(),
      Key: key,
    }),
  );
}
