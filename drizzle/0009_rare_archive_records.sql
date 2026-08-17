CREATE TABLE `archive_records` (
	`id` text PRIMARY KEY NOT NULL,
	`academic_year` text DEFAULT '' NOT NULL,
	`semester` text DEFAULT '' NOT NULL,
	`activity` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`time` text DEFAULT '' NOT NULL,
	`size` text DEFAULT '' NOT NULL,
	`object_key` text,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_archive_academic` ON `archive_records` (`academic_year`,`semester`);
