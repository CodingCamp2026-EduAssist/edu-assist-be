import { InferSelectModel } from 'drizzle-orm';
import {
  difficultyPreferenceEnum,
  educationLevelEnum,
  paceEnum,
  users,
  explanationStyleEnum,
} from './users';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { z } from 'zod';

export const studentProfiles = pgTable('student_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  educationLevel: educationLevelEnum('education_level').default('undergraduate').notNull(),
  difficultyPreference: difficultyPreferenceEnum('difficulty_preference')
    .default('adaptive')
    .notNull(),
  favouriteSubjects: text('favourite_subjects').array().notNull().default([]),
  pace: paceEnum('pace').default('medium').notNull(),
  explanationStyle: explanationStyleEnum('explanation_style').default('concise').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const StudentProfileSchema = z.object({
  educationLevel: z.enum(['high_school', 'undergraduate', 'graduate']),
  difficultyPreference: z.enum(['easy', 'medium', 'hard', 'adaptive']),
  favouriteSubjects: z.array(z.string()),
  pace: z.enum(['slow', 'medium', 'fast']),
  explanationStyle: z.enum(['concise', 'detailed', 'step_by_step', 'analogy']),
});

export type StudentProfileInput = z.infer<typeof StudentProfileSchema>;

export type StudentProfile = InferSelectModel<typeof studentProfiles>;
