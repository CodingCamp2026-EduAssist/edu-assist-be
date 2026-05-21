CREATE TYPE "public"."difficulty_preference" AS ENUM('easy', 'medium', 'hard', 'adaptive');--> statement-breakpoint
CREATE TYPE "public"."education_level" AS ENUM('high_school', 'undergraduate', 'graduate');--> statement-breakpoint
CREATE TYPE "public"."explanation_style" AS ENUM('concise', 'detailed', 'step_by_step', 'analogy');--> statement-breakpoint
CREATE TYPE "public"."pace" AS ENUM('slow', 'medium', 'fast');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('student', 'guest');