-- Additive migration: existing addresses and hierarchy records remain valid.
-- Canonical codes are populated progressively as records are created or edited.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "state_province" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country_code" varchar(2);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subdivision_code" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "postal_code" text;

ALTER TABLE "hierarchy_nodes" ADD COLUMN IF NOT EXISTS "country_code" varchar(2);
ALTER TABLE "hierarchy_nodes" ADD COLUMN IF NOT EXISTS "subdivision_code" text;
ALTER TABLE "hierarchy_nodes" ADD COLUMN IF NOT EXISTS "postal_code" text;

ALTER TABLE "dojos" ADD COLUMN IF NOT EXISTS "country_code" varchar(2);
ALTER TABLE "dojos" ADD COLUMN IF NOT EXISTS "subdivision_code" text;
ALTER TABLE "dojos" ADD COLUMN IF NOT EXISTS "postal_code" text;

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "state_province" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "country_code" varchar(2);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "subdivision_code" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "postal_code" text;

ALTER TABLE "guardians" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "guardians" ADD COLUMN IF NOT EXISTS "state_province" text;
ALTER TABLE "guardians" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "guardians" ADD COLUMN IF NOT EXISTS "country_code" varchar(2);
ALTER TABLE "guardians" ADD COLUMN IF NOT EXISTS "subdivision_code" text;
ALTER TABLE "guardians" ADD COLUMN IF NOT EXISTS "postal_code" text;

CREATE INDEX IF NOT EXISTS "dojos_organization_country_code_idx" ON "dojos" ("organization_id", "country_code");
CREATE INDEX IF NOT EXISTS "students_organization_country_code_idx" ON "students" ("organization_id", "country_code");
CREATE INDEX IF NOT EXISTS "hierarchy_nodes_organization_country_code_idx" ON "hierarchy_nodes" ("organization_id", "country_code");
