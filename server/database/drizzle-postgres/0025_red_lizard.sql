DROP INDEX "announcements_audience_idx";--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "scope_node_id" integer;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_scope_node_id_hierarchy_nodes_id_fk" FOREIGN KEY ("scope_node_id") REFERENCES "public"."hierarchy_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_audience_idx" ON "announcements" USING btree ("organization_id","dojo_id","scope_node_id","published_at");