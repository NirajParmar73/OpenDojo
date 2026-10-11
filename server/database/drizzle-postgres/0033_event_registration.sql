CREATE TABLE "camp_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"venue" text DEFAULT '' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"registration_deadline" text NOT NULL,
	"details_deadline" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"dojo_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capacity" integer DEFAULT 0 NOT NULL,
	"bed_capacity" integer DEFAULT 0 NOT NULL,
	"outbound_capacity" integer DEFAULT 0 NOT NULL,
	"return_capacity" integer DEFAULT 0 NOT NULL,
	"prices" jsonb NOT NULL,
	"currency" text NOT NULL,
	"confirmation_rule" text DEFAULT 'staff' NOT NULL,
	"deposit" integer DEFAULT 0 NOT NULL,
	"terms" text DEFAULT '' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"fixed_budget" integer DEFAULT 0 NOT NULL,
	"per_person_budget" integer DEFAULT 0 NOT NULL,
	"overhead_budget" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "camp_events_status_check" CHECK ("camp_events"."status" IN ('draft','open','closed','completed','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "event_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"booking_id" integer,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"details" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"dojo_id" integer,
	"reference" text NOT NULL,
	"request_key" text NOT NULL,
	"status" text DEFAULT 'provisional' NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"contact_phone" text DEFAULT '' NOT NULL,
	"emergency_name" text DEFAULT '' NOT NULL,
	"emergency_phone" text DEFAULT '' NOT NULL,
	"attendees" jsonb NOT NULL,
	"prices" jsonb NOT NULL,
	"consent" jsonb NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"cancellation_fee" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_bookings_reference_unique" UNIQUE("reference"),
	CONSTRAINT "event_bookings_status_check" CHECK ("event_bookings"."status" IN ('provisional','pending','confirmed','waitlisted','cancelled')),
	CONSTRAINT "event_bookings_amounts_check" CHECK ("event_bookings"."discount" >= 0 AND "event_bookings"."cancellation_fee" >= 0)
);
--> statement-breakpoint
CREATE TABLE "event_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"description" text NOT NULL,
	"supplier" text NOT NULL,
	"category" text NOT NULL,
	"amount" integer NOT NULL,
	"tax" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'committed' NOT NULL,
	"due_date" text,
	"invoice_number" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"request_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_costs_amount_check" CHECK ("event_costs"."amount" >= 0 AND "event_costs"."tax" >= 0),
	CONSTRAINT "event_costs_category_check" CHECK ("event_costs"."category" IN ('direct','overhead')),
	CONSTRAINT "event_costs_status_check" CHECK ("event_costs"."status" IN ('committed','incurred','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "event_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"booking_id" integer,
	"cost_id" integer,
	"source_id" integer,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"tax" integer DEFAULT 0 NOT NULL,
	"method" text NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"receipt_number" text NOT NULL,
	"description" text NOT NULL,
	"occurred_on" text NOT NULL,
	"request_key" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_ledger_receipt_number_unique" UNIQUE("receipt_number"),
	CONSTRAINT "event_ledger_amount_check" CHECK ("event_ledger"."amount" > 0 AND "event_ledger"."tax" >= 0 AND "event_ledger"."tax" <= "event_ledger"."amount"),
	CONSTRAINT "event_ledger_kind_check" CHECK ("event_ledger"."kind" IN ('payment','refund','income','income_refund','cost_payment','cost_refund')),
	CONSTRAINT "event_ledger_link_check" CHECK (("event_ledger"."kind" IN ('payment','refund') AND "event_ledger"."booking_id" IS NOT NULL AND "event_ledger"."cost_id" IS NULL) OR ("event_ledger"."kind" IN ('cost_payment','cost_refund') AND "event_ledger"."cost_id" IS NOT NULL AND "event_ledger"."booking_id" IS NULL) OR ("event_ledger"."kind" IN ('income','income_refund') AND "event_ledger"."booking_id" IS NULL AND "event_ledger"."cost_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "camp_events" ADD CONSTRAINT "camp_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camp_events" ADD CONSTRAINT "camp_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_activity" ADD CONSTRAINT "event_activity_event_id_camp_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."camp_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_activity" ADD CONSTRAINT "event_activity_booking_id_event_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."event_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_event_id_camp_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."camp_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_dojo_id_dojos_id_fk" FOREIGN KEY ("dojo_id") REFERENCES "public"."dojos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_costs" ADD CONSTRAINT "event_costs_event_id_camp_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."camp_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_ledger" ADD CONSTRAINT "event_ledger_event_id_camp_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."camp_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_ledger" ADD CONSTRAINT "event_ledger_booking_id_event_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."event_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_ledger" ADD CONSTRAINT "event_ledger_cost_id_event_costs_id_fk" FOREIGN KEY ("cost_id") REFERENCES "public"."event_costs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_ledger" ADD CONSTRAINT "event_ledger_source_id_event_ledger_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."event_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_ledger" ADD CONSTRAINT "event_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "camp_events_org_idx" ON "camp_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_activity_event_idx" ON "event_activity" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_bookings_event_idx" ON "event_bookings" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_bookings_request_idx" ON "event_bookings" USING btree ("event_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "event_bookings_active_student_idx" ON "event_bookings" USING btree ("event_id","student_id") WHERE "event_bookings"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "event_costs_event_idx" ON "event_costs" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_costs_request_idx" ON "event_costs" USING btree ("event_id","request_key");--> statement-breakpoint
CREATE INDEX "event_ledger_event_idx" ON "event_ledger" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_ledger_request_idx" ON "event_ledger" USING btree ("event_id","request_key");
--> statement-breakpoint
-- Defer cross-links until transaction end so existing workspace-wide cascades
-- can remove the student and event branches in either trigger order.
ALTER TABLE "event_bookings" ALTER CONSTRAINT "event_bookings_student_id_students_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "event_ledger" ALTER CONSTRAINT "event_ledger_booking_id_event_bookings_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "event_ledger" ALTER CONSTRAINT "event_ledger_cost_id_event_costs_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "event_ledger" ALTER CONSTRAINT "event_ledger_source_id_event_ledger_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "event_activity" ALTER CONSTRAINT "event_activity_booking_id_event_bookings_id_fk" DEFERRABLE INITIALLY DEFERRED;
