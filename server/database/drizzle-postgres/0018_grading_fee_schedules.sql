CREATE TABLE IF NOT EXISTS "grading_fee_schedules" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "dojo_id" integer NOT NULL REFERENCES "dojos"("id") ON DELETE cascade,
  "belt_rank_id" integer NOT NULL REFERENCES "belt_ranks"("id") ON DELETE cascade,
  "fee_plan_id" integer NOT NULL REFERENCES "fee_plans"("id") ON DELETE cascade,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "grading_fee_schedules_dojo_rank_unique" ON "grading_fee_schedules" ("dojo_id", "belt_rank_id");
