ALTER TABLE "users" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_status_valid" CHECK ("users"."status" IN ('active', 'inactive', 'archived'));
