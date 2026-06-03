CREATE TABLE "chat_message_courses" (
	"chat_message_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	CONSTRAINT "chat_message_courses_chat_message_id_course_id_pk" PRIMARY KEY("chat_message_id","course_id")
);
--> statement-breakpoint
ALTER TABLE "chat_message_courses" ADD CONSTRAINT "chat_message_courses_chat_message_id_chat_messages_id_fk" FOREIGN KEY ("chat_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_courses" ADD CONSTRAINT "chat_message_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "chat_message_courses" ("chat_message_id", "course_id")
SELECT "id", "course_id"
FROM "chat_messages"
WHERE "course_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_course_id_courses_id_fk";--> statement-breakpoint
DROP INDEX "chat_messages_course_id_created_at_idx";--> statement-breakpoint
ALTER TABLE "chat_messages" DROP COLUMN "course_id";--> statement-breakpoint
CREATE INDEX "chat_message_courses_course_id_idx" ON "chat_message_courses" USING btree ("course_id");