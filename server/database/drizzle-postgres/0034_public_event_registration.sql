CREATE TABLE "event_registration_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"booking_id" integer,
	"request_key" text NOT NULL,
	"reference" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"student_name" text NOT NULL,
	"date_of_birth" text,
	"membership_number" text DEFAULT '' NOT NULL,
	"dojo_id" integer,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"emergency_name" text DEFAULT '' NOT NULL,
	"emergency_phone" text DEFAULT '' NOT NULL,
	"attendees" jsonb NOT NULL,
	"consent" jsonb NOT NULL,
	"prices" jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"waitlist" boolean DEFAULT false NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_registration_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "event_registration_requests_status_check" CHECK ("event_registration_requests"."status" IN ('submitted','approved','rejected'))
);
--> statement-breakpoint
ALTER TABLE "camp_events" ADD COLUMN "public_registration_token" text;--> statement-breakpoint
ALTER TABLE "camp_events" ADD COLUMN "public_registration_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD CONSTRAINT "event_registration_requests_event_id_camp_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."camp_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD CONSTRAINT "event_registration_requests_booking_id_event_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."event_bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD CONSTRAINT "event_registration_requests_dojo_id_dojos_id_fk" FOREIGN KEY ("dojo_id") REFERENCES "public"."dojos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD CONSTRAINT "event_registration_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_registration_requests_event_idx" ON "event_registration_requests" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_registration_requests_key_idx" ON "event_registration_requests" USING btree ("event_id","request_key");--> statement-breakpoint
ALTER TABLE "camp_events" ADD CONSTRAINT "camp_events_public_registration_token_unique" UNIQUE("public_registration_token");