import { InferSelectModel, sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { Citation } from '../types';
import { users } from './users';
import type { StudentProfileInput } from './studentProfiles';

export const chatSessionStatusEnum = pgEnum('chat_session_status', ['active', 'archived']);
export const chatMessageRoleEnum = pgEnum('chat_message_role', ['user', 'assistant']);

export type ChatGuestContext = {
  initialContext?: string;
  linkedDocumentIds?: string[];
  temporaryProfile?: Partial<StudentProfileInput>;
};

export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    guestSessionId: varchar('guest_session_id', { length: 255 }),
    title: varchar('title', { length: 255 }),
    status: chatSessionStatusEnum('status').default('active').notNull(),
    rollingSummary: text('rolling_summary'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true, mode: 'date' }),
    guestContext: jsonb('guest_context')
      .$type<ChatGuestContext>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('chat_sessions_user_id_idx').on(table.userId),
    guestSessionIdIdx: index('chat_sessions_guest_session_id_idx').on(table.guestSessionId),
    statusIdx: index('chat_sessions_status_idx').on(table.status),
    lastMessageAtIdx: index('chat_sessions_last_message_at_idx').on(table.lastMessageAt),
  }),
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    chatSessionId: uuid('chat_session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: chatMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    modelName: varchar('model_name', { length: 100 }),
    modelMetadata: jsonb('model_metadata').$type<Record<string, unknown>>(),
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
    chatSessionCreatedAtIdx: index('chat_messages_chat_session_id_created_at_idx').on(
      table.chatSessionId,
      table.createdAt,
    ),
  }),
);

export type ChatSession = InferSelectModel<typeof chatSessions>;
export type ChatMessage = InferSelectModel<typeof chatMessages>;
