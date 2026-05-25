import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { env } from '../config/env';

function deriveEncryptionKey(): Buffer {
  return createHash('sha256').update(env.dataEncryptionSecret).digest();
}

export function hashRefreshToken(value: string): string {
  return createHmac('sha256', env.refreshTokenSecret).update(value).digest('hex');
}

export type EncryptedPayload = {
  iv: string;
  tag: string;
  ciphertext: string;
};

export function encryptJson<T>(value: T): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveEncryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptJson<T>(payload: EncryptedPayload | null | undefined): T | null {
  if (!payload) return null;

  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveEncryptionKey(),
    Buffer.from(payload.iv, 'base64'),
  );

  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString('utf8')) as T;
}
