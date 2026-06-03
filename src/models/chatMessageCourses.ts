import { InferSelectModel } from 'drizzle-orm';
import { primaryKey, pgTable, uuid, index } from 'drizzle-orm/pg-core';
import { chatMessages } from './chatMessages';
import { courses } from './courses';

export const chatMessageCourses = pgTable(
  'chat_message_courses',
  {
    chatMessageId: uuid('chat_message_id')
      .notNull()
      .references(() => chatMessages.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatMessageId, table.courseId] }),
    courseIdIdx: index('chat_message_courses_course_id_idx').on(table.courseId),
  }),
);

export type ChatMessageCourse = InferSelectModel<typeof chatMessageCourses>;
