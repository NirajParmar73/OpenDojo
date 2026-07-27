CREATE TABLE "payment_refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"tuition_amount" integer DEFAULT 0 NOT NULL,
	"refund_number" text NOT NULL,
	"refunded_at" timestamp with time zone NOT NULL,
	"method" text NOT NULL,
	"reference_number" text,
	"reason" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payment_refunds_refund_number_unique" UNIQUE("refund_number"),
	CONSTRAINT "payment_refunds_amount_positive" CHECK ("payment_refunds"."amount" > 0),
	CONSTRAINT "payment_refunds_tuition_amount_valid" CHECK ("payment_refunds"."tuition_amount" >= 0 AND "payment_refunds"."tuition_amount" <= "payment_refunds"."amount"),
	CONSTRAINT "payment_refunds_status_valid" CHECK ("payment_refunds"."status" IN ('pending', 'completed', 'failed')),
	CONSTRAINT "payment_refunds_method_valid" CHECK ("payment_refunds"."method" IN ('cash', 'bank_transfer', 'card', 'other'))
);
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_refunds_payment_id_idx" ON "payment_refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_refunds_refunded_at_idx" ON "payment_refunds" USING btree ("refunded_at");