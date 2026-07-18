CREATE TABLE IF NOT EXISTS "onboarding_progress" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "step_key" text NOT NULL,
  "completed_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_progress_user_step_unique"
  ON "onboarding_progress" USING btree ("user_id", "step_key");
