-- Remove fee plans created exclusively by the retired grading-fee scheduler.
-- Their student assignments cascade away. Existing payments are preserved
-- because payments.assignment_id uses ON DELETE SET NULL.
DELETE FROM "fee_plans"
WHERE "id" IN (SELECT "fee_plan_id" FROM "grading_fee_schedules");
--> statement-breakpoint
DROP TABLE "grading_fee_schedules";
