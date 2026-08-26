CREATE TABLE "admission_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"dojo_id" integer NOT NULL,
	"program_id" integer,
	"reference_number" text NOT NULL,
	"access_token_hash" varchar(64) NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"date_of_birth" timestamp with time zone NOT NULL,
	"gender" text,
	"address" text,
	"city" text,
	"state_province" text,
	"country" text,
	"postal_code" text,
	"emergency_contact" text NOT NULL,
	"emergency_phone" text NOT NULL,
	"medical_notes" text,
	"guardian_name" text,
	"guardian_relationship" text,
	"guardian_phone" text,
	"guardian_email" text,
	"previous_experience" text,
	"preferred_start_date" timestamp with time zone,
	"photo_path" text NOT NULL,
	"consent_accepted_at" timestamp with time zone NOT NULL,
	"form_snapshot" jsonb NOT NULL,
	"physical_copy_received_at" timestamp with time zone,
	"physical_copy_received_by" integer,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" integer,
	"internal_notes" text,
	"rejection_reason" text,
	"resulting_student_id" integer,
	"submitted_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admission_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"title" text DEFAULT 'Student admission application' NOT NULL,
	"introduction" text DEFAULT 'Complete this form to apply for admission.' NOT NULL,
	"physical_copy_instructions" text DEFAULT 'Download, print, sign, and submit this form to the organization.' NOT NULL,
	"privacy_notice" text DEFAULT 'Your information will be used to process this admission application.' NOT NULL,
	"consent_text" text DEFAULT 'I confirm that the information provided is accurate and consent to its use for admission processing.' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"require_physical_copy" boolean DEFAULT true NOT NULL,
	"updated_by" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_dojo_id_dojos_id_fk" FOREIGN KEY ("dojo_id") REFERENCES "public"."dojos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_program_id_organization_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."organization_programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_physical_copy_received_by_users_id_fk" FOREIGN KEY ("physical_copy_received_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_resulting_student_id_students_id_fk" FOREIGN KEY ("resulting_student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_forms" ADD CONSTRAINT "admission_forms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_forms" ADD CONSTRAINT "admission_forms_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admission_applications_reference_unique" ON "admission_applications" USING btree ("reference_number");--> statement-breakpoint
CREATE UNIQUE INDEX "admission_applications_access_token_hash_unique" ON "admission_applications" USING btree ("access_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "admission_applications_resulting_student_unique" ON "admission_applications" USING btree ("resulting_student_id");--> statement-breakpoint
CREATE INDEX "admission_applications_organization_status_idx" ON "admission_applications" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "admission_applications_dojo_id_idx" ON "admission_applications" USING btree ("dojo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admission_forms_organization_id_unique" ON "admission_forms" USING btree ("organization_id");