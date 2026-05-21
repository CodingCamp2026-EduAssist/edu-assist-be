import { pgTable, text, timestamp, uuid, varchar, index, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { InferSelectModel, sql } from 'drizzle-orm';
import { StudentProfile } from './studentProfiles';

export const chatSessionStatusEnum = pgEnum('chat_session_status', ['active', 'archived']);
export const chatMessageRoleEnum = pgEnum('chat_message_role', ['user', 'assistant', 'system']);

export type GuestContext = {
  initialContext?: string;
  linkedDocumentIds?: string[];
  locale?: string;
  temporaryProfile?: Partial<StudentProfile>;
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
      .$type<GuestContext>()
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

export type ChatSession = InferSelectModel<typeof chatSessions>;
