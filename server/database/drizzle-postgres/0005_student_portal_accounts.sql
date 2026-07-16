CREATE TABLE IF NOT EXISTS "student_portal_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "student_id" integer NOT NULL UNIQUE REFERENCES "students"("id") ON DELETE cascade,
  "username" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
