ALTER TABLE "admission_applications" ADD COLUMN "application_type" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "original_joined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "current_belt_rank_id" integer;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "current_belt_awarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "membership_number" text;--> statement-breakpoint
ALTER TABLE "admission_forms" ADD COLUMN "existing_registration_title" text DEFAULT 'Existing student registration' NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_forms" ADD COLUMN "existing_registration_introduction" text DEFAULT 'Already train with us? Complete this form so we can add your existing membership to OpenDojos.' NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_forms" ADD COLUMN "existing_registration_consent_text" text DEFAULT 'I confirm that I am an existing student of this organization and that the information provided is accurate.' NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_forms" ADD COLUMN "is_existing_registration_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "membership_number" text;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_current_belt_rank_id_belt_ranks_id_fk" FOREIGN KEY ("current_belt_rank_id") REFERENCES "public"."belt_ranks"("id") ON DELETE set null ON UPDATE no action;
