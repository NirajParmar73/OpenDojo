CREATE TABLE `dojo_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dojo_id` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`startTime` text NOT NULL,
	`endTime` text NOT NULL,
	`name` text,
	`instructor_id` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`dojo_id`) REFERENCES `dojos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
