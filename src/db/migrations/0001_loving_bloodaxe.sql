CREATE TYPE "public"."difficulty_preference" AS ENUM('easy', 'medium', 'hard', 'adaptive');--> statement-breakpoint
CREATE TYPE "public"."education_level" AS ENUM('high_school', 'undergraduate', 'graduate');--> statement-breakpoint
CREATE TYPE "public"."explanation_style" AS ENUM('concise', 'detailed', 'step_by_step', 'analogy');--> statement-breakpoint
CREATE TYPE "public"."pace" AS ENUM('slow', 'medium', 'fast');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('student', 'guest');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "role" DEFAULT 'guest' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "education_level" "education_level" DEFAULT 'undergraduate' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "difficulty_preference" "difficulty_preference" DEFAULT 'adaptive' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "favouriteSubjects" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pace" "pace" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "explanation_style" "explanation_style" DEFAULT 'concise' NOT NULL;--> statement-breakpoint