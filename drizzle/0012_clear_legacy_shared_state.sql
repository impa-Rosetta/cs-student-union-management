CREATE TABLE `system_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`attachment_limit` text DEFAULT '20' NOT NULL,
	`academic_year_month` text DEFAULT '8' NOT NULL,
	`semester_boundary` text DEFAULT '按学院校历' NOT NULL,
	`notification_days` text DEFAULT '180' NOT NULL,
	`backup_time` text DEFAULT '23:30' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE `research_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`requester` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '待调研' NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE `workflow_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT '' NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX `idx_workflow_records_created` ON `workflow_records` (`created_at`);
