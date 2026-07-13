CREATE TABLE `dojo_instructors` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `dojo_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  `program_id` integer,
  `is_primary` integer DEFAULT 0 NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`dojo_id`) REFERENCES `dojos`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`program_id`) REFERENCES `organization_programs`(`id`) ON UPDATE no action ON DELETE set null
);
