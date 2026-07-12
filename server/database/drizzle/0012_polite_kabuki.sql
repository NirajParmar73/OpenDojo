CREATE TABLE `fee_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`frequency` text DEFAULT 'monthly',
	`dojo_id` integer,
	`description` text,
	`is_active` integer DEFAULT 1,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dojo_id`) REFERENCES `dojos`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`assignment_id` integer,
	`amount` integer NOT NULL,
	`paymentDate` integer NOT NULL,
	`method` text DEFAULT 'cash',
	`referenceNumber` text,
	`receiptNumber` text NOT NULL,
	`notes` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignment_id`) REFERENCES `student_fee_assignments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `student_fee_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`fee_plan_id` integer NOT NULL,
	`startDate` integer NOT NULL,
	`endDate` integer,
	`due_day` integer DEFAULT 1,
	`discount` integer DEFAULT 0,
	`status` text DEFAULT 'active',
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fee_plan_id`) REFERENCES `fee_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `organizations` ADD `currency` text DEFAULT 'USD';