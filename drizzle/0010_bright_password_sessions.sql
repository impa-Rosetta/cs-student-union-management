ALTER TABLE `app_accounts` ADD `password_hash` text;--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);
