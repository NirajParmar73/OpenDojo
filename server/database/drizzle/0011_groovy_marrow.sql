CREATE TABLE `attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`status` text DEFAULT 'present',
	`notes` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `class_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `class_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dojo_id` integer NOT NULL,
	`schedule_id` integer,
	`date` integer NOT NULL,
	`startTime` text NOT NULL,
	`endTime` text NOT NULL,
	`instructor_id` integer,
	`name` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`dojo_id`) REFERENCES `dojos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`schedule_id`) REFERENCES `dojo_schedules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
