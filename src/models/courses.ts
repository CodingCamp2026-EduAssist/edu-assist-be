import {
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  doublePrecision,
  unique,
} from 'drizzle-orm/pg-core';
import { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    skills: text('tags').array().notNull().default([]),
    rating: doublePrecision('rating').notNull().default(0),
    level: varchar('level', { length: 50 }).notNull(),
    url: varchar('url', { length: 500 }).notNull(),
    hybridMatch: doublePrecision('hybrid_match').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueUrl: unique('courses_url_unique').on(table.url),
  }),
);

export const CourseRecommendationDto = z.object({
  title: z.string(),
  skills: z.string().transform((val) => {
    try {
      const jsonString = val.replace(/^\[/, '[').replace(/'/g, '"');
      return JSON.parse(jsonString) as string[];
    } catch {
      return val
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    }
  }),

  rating: z.number(),
  level: z.string(),
  url: z.string().url(),

  hybrid_match: z.string().transform((val) => parseFloat(val.replace('%', ''))),
});

export type Course = InferSelectModel<typeof courses>;
