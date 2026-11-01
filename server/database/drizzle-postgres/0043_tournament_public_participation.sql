CREATE TABLE "tournament_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"tournament_id" integer NOT NULL,
	"student_id" integer,
	"full_name" text NOT NULL,
	"date_of_birth" text NOT NULL,
	"gender" text NOT NULL,
	"weight_kg" real NOT NULL,
	"belt" text NOT NULL,
	"age_category" text NOT NULL,
	"request_key" text NOT NULL,
	"identity_key" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_achievements" ALTER COLUMN "student_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "student_achievements" ADD COLUMN "participant_id" integer;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "participant_list_title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "coach_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "registration_token" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "registration_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_participant_request_unique" ON "tournament_participants" USING btree ("tournament_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_participant_identity_unique" ON "tournament_participants" USING btree ("tournament_id","identity_key");--> statement-breakpoint
ALTER TABLE "student_achievements" ADD CONSTRAINT "student_achievements_participant_id_tournament_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."tournament_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_registration_token_unique" UNIQUE("registration_token");
--> statement-breakpoint
UPDATE "tournaments" SET "participant_list_title" = "organizations"."name" || ' Participant List'
FROM "organizations" WHERE "tournaments"."organization_id" = "organizations"."id";
