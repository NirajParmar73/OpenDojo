ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscription_status" text NOT NULL DEFAULT 'free';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billing_period" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "trial_started_at" timestamp with time zone;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp with time zone;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscription_started_at" timestamp with time zone;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscription_ends_at" timestamp with time zone;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "payment_provider" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "provider_customer_id" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "provider_subscription_id" text;
UPDATE "organizations" SET "subscription_plan" = CASE "subscription_plan"
  WHEN 'starter' THEN 'city-starter'
  WHEN 'growth' THEN 'city-pro'
  WHEN 'professional' THEN 'city-pro'
  WHEN 'enterprise' THEN 'national'
  ELSE "subscription_plan"
END;
UPDATE "organizations" SET "subscription_status" = CASE WHEN "subscription_plan" = 'free' THEN 'free' ELSE 'active' END;
