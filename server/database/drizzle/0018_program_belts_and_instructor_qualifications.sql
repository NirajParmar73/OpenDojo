ALTER TABLE `belt_systems` ADD `program_id` integer REFERENCES `organization_programs`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
CREATE TABLE `instructor_qualifications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `organization_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  `program_id` integer,
  `qualification` text NOT NULL,
  `issuer` text,
  `certificate_number` text,
  `expires_at` integer,
  `certificate_url` text,
  `notes` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`program_id`) REFERENCES `organization_programs`(`id`) ON UPDATE no action ON DELETE set null
);
