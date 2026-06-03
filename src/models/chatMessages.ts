import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core';
import { InferSelectModel, sql } from 'drizzle-orm';
import { chatMessageRoleEnum, chatSessions } from './chatSessions';
import { Citation } from '../types';

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    chatSessionId: uuid('chat_session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: chatMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    thinkingProcess: text('thinking_process'),
    modelName: varchar('model_name', { length: 100 }),
    modelMetadata: jsonb('model_metadata').$type<Record<string, unknown> | null>(),
    citations: jsonb('citations')
      .$type<Citation[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),
    retrievalChunks: integer('retrieval_chunks'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    sessionCreatedAtIdx: index('chat_messages_chat_session_id_created_at_idx').on(
      table.chatSessionId,
      table.createdAt,
    ),
  }),
);

export type ChatMessage = InferSelectModel<typeof chatMessages>;
