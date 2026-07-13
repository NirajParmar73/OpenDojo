ALTER TABLE `dojo_schedules` ADD `program_id` integer REFERENCES `organization_programs`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `class_sessions` ADD `program_id` integer REFERENCES `organization_programs`(`id`) ON UPDATE no action ON DELETE set null;
