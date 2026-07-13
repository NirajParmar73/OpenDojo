CREATE TABLE `tournaments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `organization_id` integer NOT NULL,
  `name` text NOT NULL,
  `level` text NOT NULL,
  `venue` text,
  `start_date` integer NOT NULL,
  `end_date` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
ALTER TABLE `student_achievements` ADD `tournament_id` integer REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE set null;
ALTER TABLE `student_achievements` ADD `medal_type` text;
