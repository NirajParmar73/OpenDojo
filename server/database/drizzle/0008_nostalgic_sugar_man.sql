CREATE TABLE `student_gradings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`belt_rank_id` integer NOT NULL,
	`awardedDate` integer NOT NULL,
	`examiner` text,
	`certificateUrl` text,
	`notes` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`belt_rank_id`) REFERENCES `belt_ranks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `students` ADD `current_belt_rank_id` integer REFERENCES belt_ranks(id);