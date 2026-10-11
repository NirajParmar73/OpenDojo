ALTER TABLE "camp_events" ALTER COLUMN "form_settings" SET DEFAULT '{"title":"","introduction":"","accentColor":"#0f766e","privacyNotice":"","submitLabel":"Send registration","confirmationMessage":"","letterHeading":"Invitation to participate","letterBody":"","contactText":"","requirePhoto":true,"requirePhysicalCopy":true,"physicalCopyInstructions":"Download, print and sign the registration form, then submit it to the event organizer or your dojo.","questions":[]}'::jsonb;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD COLUMN "photo_path" text;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD COLUMN "print_token" text;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD COLUMN "physical_copy_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD COLUMN "physical_copy_instructions" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD COLUMN "physical_copy_received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD COLUMN "physical_copy_received_by" integer;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD CONSTRAINT "event_registration_requests_physical_copy_received_by_users_id_fk" FOREIGN KEY ("physical_copy_received_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration_requests" ADD CONSTRAINT "event_registration_requests_print_token_unique" UNIQUE("print_token");