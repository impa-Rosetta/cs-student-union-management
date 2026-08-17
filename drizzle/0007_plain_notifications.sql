CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_usernames_json` text DEFAULT '[]' NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`level` text,
	`entity_type` text,
	`entity_id` text,
	`parent_task_id` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_created` ON `notifications` (`created_at`);
