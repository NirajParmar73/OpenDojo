CREATE TABLE "event_invitations" (
	"event_id" integer PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"data_base64" text NOT NULL,
	"uploaded_by" integer,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_bookings" ALTER COLUMN "student_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "guest_profile" jsonb;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD COLUMN "source_type" text DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD COLUMN "source_dojo_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD COLUMN "source_state" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD COLUMN "source_country" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_invitations" ADD CONSTRAINT "event_invitations_event_id_camp_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."camp_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitations" ADD CONSTRAINT "event_invitations_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_identity_check" CHECK (("event_bookings"."student_id" IS NOT NULL AND "event_bookings"."guest_profile" IS NULL) OR ("event_bookings"."student_id" IS NULL AND "event_bookings"."guest_profile" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD CONSTRAINT "event_registration_requests_source_check" CHECK ("event_registration_requests"."source_type" IN ('internal','external'));