CREATE TABLE `notification_receipts` (
	`notification_id` text NOT NULL,
	`username` text NOT NULL,
	`read_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notification_receipts_pk` ON `notification_receipts` (`notification_id`,`username`);--> statement-breakpoint
CREATE INDEX `idx_notification_receipts_user` ON `notification_receipts` (`username`);
