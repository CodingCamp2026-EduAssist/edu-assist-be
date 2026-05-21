import { InferSelectModel } from 'drizzle-orm';
import { pgTable, uuid, varchar, timestamp, boolean, pgEnum, text } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['student', 'guest']);
export const educationLevelEnum = pgEnum('education_level', [
  'high_school',
  'undergraduate',
  'graduate',
]);
export const difficultyPreferenceEnum = pgEnum('difficulty_preference', [
  'easy',
  'medium',
  'hard',
  'adaptive',
]);
export const paceEnum = pgEnum('pace', ['slow', 'medium', 'fast']);
export const explanationStyleEnum = pgEnum('explanation_style', [
  'concise',
  'detailed',
  'step_by_step',
  'analogy',
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  provider: varchar('provider', { length: 50 }).notNull(), // 'google', 'github'
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),

  // personalization stuff
  role: roleEnum('role').default('guest').notNull(),
  educationLevel: educationLevelEnum('education_level').default('undergraduate').notNull(),
  difficultyPreference: difficultyPreferenceEnum('difficulty_preference')
    .default('adaptive')
    .notNull(),
  favouriteSubjects: text('favouriteSubjects').array().notNull().default([]),
  pace: paceEnum('pace').default('medium').notNull(),
  explanationStyle: explanationStyleEnum('explanation_style').default('concise').notNull(),
});

export type User = InferSelectModel<typeof users>;
