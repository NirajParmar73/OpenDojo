ALTER TABLE "fee_plans" ADD COLUMN IF NOT EXISTS "scope_node_id" integer REFERENCES "hierarchy_nodes"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "fee_plans_organization_scope_node_idx" ON "fee_plans" ("organization_id", "scope_node_id");
