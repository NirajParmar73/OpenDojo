CREATE TABLE "grading_exams" (
  "id" serial PRIMARY KEY NOT NULL, "organization_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "dojo_id" integer NOT NULL REFERENCES "dojos"("id") ON DELETE cascade, "name" text NOT NULL,
  "scheduled_at" timestamp with time zone NOT NULL, "registration_deadline" timestamp with time zone,
  "fee_amount" integer DEFAULT 0 NOT NULL, "payment_timing" text DEFAULT 'exam_day' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL, "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grading_exam_attempts" (
  "id" serial PRIMARY KEY NOT NULL, "exam_id" integer NOT NULL REFERENCES "grading_exams"("id") ON DELETE cascade,
  "student_id" integer NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "target_belt_rank_id" integer REFERENCES "belt_ranks"("id") ON DELETE set null,
  "attendance_status" text DEFAULT 'registered' NOT NULL, "result" text DEFAULT 'pending' NOT NULL,
  "fee_amount" integer DEFAULT 0 NOT NULL, "payment_status" text DEFAULT 'pending' NOT NULL,
  "payment_method" text, "payment_reference" text, "paid_at" timestamp with time zone,
  "waiver_reason" text, "notes" text, "grading_id" integer REFERENCES "student_gradings"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "grading_exam_attempts_exam_student_unique" UNIQUE("exam_id", "student_id")
);
