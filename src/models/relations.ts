import { relations } from 'drizzle-orm';
import { courses } from './courses';
import { chatMessages } from './chatMessages';
import { chatMessageCourses } from './chatMessageCourses';

export const coursesRelations = relations(courses, ({ many }) => ({
  chatMessageCourses: many(chatMessageCourses),
}));

export const chatMessagesRelations = relations(chatMessages, ({ many }) => ({
  courseRecommendations: many(chatMessageCourses),
}));

export const chatMessageCoursesRelations = relations(chatMessageCourses, ({ one }) => ({
  chatMessage: one(chatMessages, {
    fields: [chatMessageCourses.chatMessageId],
    references: [chatMessages.id],
  }),
  course: one(courses, {
    fields: [chatMessageCourses.courseId],
    references: [courses.id],
  }),
}));
