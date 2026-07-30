ALTER TABLE "organizations" ADD COLUMN "auto_grant_student_portal_access" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "student_portal_accounts" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "student_portal_accounts" ALTER COLUMN "must_change_password" SET DEFAULT true;
