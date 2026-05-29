DROP INDEX "chat_sessions_guest_session_id_idx";--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP COLUMN "guest_session_id";