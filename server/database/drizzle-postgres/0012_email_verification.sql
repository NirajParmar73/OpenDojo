ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;
UPDATE "users" SET "email_verified_at" = now() WHERE "email_verified_at" IS NULL;
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE cascade,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone NOT NULL DEFAULT now()
);
