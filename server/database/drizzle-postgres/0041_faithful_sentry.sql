ALTER TABLE "camp_events" ADD COLUMN "registration_forms" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "registration_form" jsonb;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD COLUMN "registration_form" jsonb;