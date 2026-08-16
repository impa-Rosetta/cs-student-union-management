CREATE TABLE `app_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_user_id` text,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`scope` text DEFAULT '本人任务' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_accounts_email` ON `app_accounts` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_accounts_username` ON `app_accounts` (`username`);--> statement-breakpoint
CREATE TABLE `shared_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `members` ADD `class_name` text DEFAULT '' NOT NULL;