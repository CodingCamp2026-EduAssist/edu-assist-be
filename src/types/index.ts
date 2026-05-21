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

// Extend Express Request to include authenticated user
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

export const Turn = z.object({
  role: z.enum(['user', 'assistant'] as const),
  content: z.string(),
  citationIds: z.array(z.string()).optional(),
  timestamp: z.string(),
});

export const ClientCitation = z.object({
  id: z.string(),
  messageId: z.string(),
  role: z.enum(['user', 'assistant'] as const),
  content: z.string(),
  citationIds: z.array(z.string()).optional(),
  createdAt: z.string(),
});

export const TokenUsage = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
  retrievalChunks: z.number().optional(),
});

export const ClientMessage = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(['user', 'assistant'] as const),
  content: z.string(),
  citationIds: z.array(z.string()).optional(),
  createdAt: z.string(),
});

export const Citation = z.object({
  id: z.string(),
  sourceDocumentId: z.string(),
  chunkId: z.string(),
  excerpt: z.string(),
  relevanceScore: z.number().optional(),
  page: z.number().optional(),
  section: z.string().optional(),
});

export type ClientCitation = z.infer<typeof ClientCitation>;
export type TokenUsage = z.infer<typeof TokenUsage>;
export type ClientMessage = z.infer<typeof ClientMessage>;
export type Turn = z.infer<typeof Turn>;
export type Citation = z.infer<typeof Citation>;
