CREATE TABLE "platform_audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "actor_user_id" integer,
  "action" text NOT NULL,
  "organization_id" integer,
  "organization_name" text NOT NULL,
  "details" text,
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
