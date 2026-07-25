ALTER TABLE "students" ADD COLUMN "program_id" integer REFERENCES "organization_programs"("id") ON DELETE set null;
