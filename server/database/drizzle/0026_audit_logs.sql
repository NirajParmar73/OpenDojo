CREATE TABLE `audit_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `organization_id` integer NOT NULL,
  `actor_user_id` integer,
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` integer,
  `target_label` text NOT NULL,
  `scope_type` text NOT NULL,
  `scope_id` integer,
  `details` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `audit_logs_org_created_idx` ON `audit_logs` (`organization_id`, `created_at`);
CREATE INDEX `audit_logs_scope_idx` ON `audit_logs` (`organization_id`, `scope_type`, `scope_id`);
