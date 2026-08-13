CREATE TABLE "announcement_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"announcement_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"read_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"dojo_id" integer,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"assignment_id" integer NOT NULL,
	"type" text DEFAULT 'fee_overdue' NOT NULL,
	"billing_period" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"outstanding_amount" integer NOT NULL,
	"action_url" text DEFAULT '/portal?tab=fees' NOT NULL,
	"read_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"last_reminded_at" timestamp with time zone NOT NULL,
	"next_reminder_at" timestamp with time zone NOT NULL,
	"reminder_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_dojo_id_dojos_id_fk" FOREIGN KEY ("dojo_id") REFERENCES "public"."dojos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_notifications" ADD CONSTRAINT "student_notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_notifications" ADD CONSTRAINT "student_notifications_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_notifications" ADD CONSTRAINT "student_notifications_assignment_id_student_fee_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."student_fee_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "announcement_reads_recipient_idx" ON "announcement_reads" USING btree ("announcement_id","student_id");--> statement-breakpoint
CREATE INDEX "announcements_audience_idx" ON "announcements" USING btree ("organization_id","dojo_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "student_notifications_period_recipient_idx" ON "student_notifications" USING btree ("student_id","assignment_id","billing_period");--> statement-breakpoint
CREATE INDEX "student_notifications_inbox_idx" ON "student_notifications" USING btree ("organization_id","student_id","resolved_at");
