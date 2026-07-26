ALTER TABLE "payments" ADD COLUMN "tuition_amount" integer;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fee_items" jsonb DEFAULT '[]'::jsonb NOT NULL;
