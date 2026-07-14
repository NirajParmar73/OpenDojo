ALTER TABLE "dojos" ADD COLUMN IF NOT EXISTS "default_fee_plan_id" integer REFERENCES "fee_plans"("id") ON DELETE SET NULL;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "discount_amount" integer NOT NULL DEFAULT 0;
ALTER TABLE "student_fee_assignments" ADD COLUMN IF NOT EXISTS "discount_reason" text;
