import { z } from 'zod';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

export interface GoogleProfile {
  id: string;
  email: string;
  displayName: string;
  photos?: { value: string }[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
    }
  }
}

export type StreamEvent =
  | { event: 'message_start'; data: { messageId: string } }
  | { event: 'delta'; data: { text: string } }
  | { event: 'citation'; data: ClientCitation }
  | { event: 'token_usage'; data: TokenUsage }
  | { event: 'message_end'; data: { messageId: string; fullText: string } }
  | { event: 'error'; data: { code: string; message: string } };

export const Turn = z
  .object({
    role: z.enum(['user', 'assistant'] as const),
    content: z.string().min(1).max(8000),
    citationIds: z.array(z.uuid()).max(50).optional(),
    timestamp: z.string().min(1),
  })
  .strict();

export const ClientCitation = z
  .object({
    id: z.uuid(),
    messageId: z.uuid(),
    role: z.enum(['user', 'assistant'] as const),
    content: z.string().min(1).max(4000),
    citationIds: z.array(z.uuid()).max(50).optional(),
    createdAt: z.string().min(1),
  })
  .strict();

export const TokenUsage = z
  .object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    retrievalChunks: z.number().int().nonnegative().optional(),
  })
  .strict();

export const ClientMessage = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    role: z.enum(['user', 'assistant'] as const),
    content: z.string().min(1).max(8000),
    citationIds: z.array(z.uuid()).max(50).optional(),
    createdAt: z.string().min(1),
  })
  .strict();

export const Citation = z
  .object({
    id: z.uuid(),
    sourceDocumentId: z.string().min(1).max(255),
    chunkId: z.string().min(1),
    excerpt: z.string().min(1).max(4000),
    relevanceScore: z.number().min(0).max(1).nullish(),
    page: z.number().int().positive().nullish(),
    section: z.string().min(1).max(200).nullish(),
  })
  .strict();

export type ClientCitation = z.infer<typeof ClientCitation>;
export type TokenUsage = z.infer<typeof TokenUsage>;
export type ClientMessage = z.infer<typeof ClientMessage>;
export type Turn = z.infer<typeof Turn>;
export type Citation = z.infer<typeof Citation>;
