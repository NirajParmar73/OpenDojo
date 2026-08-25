CREATE TABLE "student_syllabus_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"status" text DEFAULT 'not_ready' NOT NULL,
	"notes" text,
	"assessed_by" integer,
	"assessed_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_syllabus_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"version_id" integer NOT NULL,
	"target_belt_rank_id" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"assigned_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "syllabi" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"belt_system_id" integer NOT NULL,
	"target_belt_rank_id" integer NOT NULL,
	"scope_type" text DEFAULT 'organization' NOT NULL,
	"scope_id" integer,
	"title" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syllabus_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"required" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syllabus_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syllabus_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"syllabus_id" integer NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"inherit_previous" boolean DEFAULT true NOT NULL,
	"parent_version_id" integer,
	"published_at" timestamp with time zone,
	"published_by" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_syllabus_assessments" ADD CONSTRAINT "student_syllabus_assessments_assignment_id_student_syllabus_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."student_syllabus_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_syllabus_assessments" ADD CONSTRAINT "student_syllabus_assessments_item_id_syllabus_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."syllabus_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_syllabus_assessments" ADD CONSTRAINT "student_syllabus_assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_syllabus_assignments" ADD CONSTRAINT "student_syllabus_assignments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_syllabus_assignments" ADD CONSTRAINT "student_syllabus_assignments_version_id_syllabus_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."syllabus_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_syllabus_assignments" ADD CONSTRAINT "student_syllabus_assignments_target_belt_rank_id_belt_ranks_id_fk" FOREIGN KEY ("target_belt_rank_id") REFERENCES "public"."belt_ranks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_belt_system_id_belt_systems_id_fk" FOREIGN KEY ("belt_system_id") REFERENCES "public"."belt_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_target_belt_rank_id_belt_ranks_id_fk" FOREIGN KEY ("target_belt_rank_id") REFERENCES "public"."belt_ranks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_items" ADD CONSTRAINT "syllabus_items_section_id_syllabus_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."syllabus_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_sections" ADD CONSTRAINT "syllabus_sections_version_id_syllabus_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."syllabus_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_syllabus_id_syllabi_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "public"."syllabi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_parent_version_id_syllabus_versions_id_fk" FOREIGN KEY ("parent_version_id") REFERENCES "public"."syllabus_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_syllabus_item_unique" ON "student_syllabus_assessments" USING btree ("assignment_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_syllabus_target_unique" ON "student_syllabus_assignments" USING btree ("student_id","target_belt_rank_id");--> statement-breakpoint
CREATE INDEX "syllabi_org_rank_scope_idx" ON "syllabi" USING btree ("organization_id","target_belt_rank_id","scope_type","scope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "syllabus_versions_number_unique" ON "syllabus_versions" USING btree ("syllabus_id","version");