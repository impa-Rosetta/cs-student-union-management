CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`department` text NOT NULL,
	`person` text NOT NULL,
	`deadline` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`risk` integer DEFAULT false NOT NULL,
	`kind` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`fields_json` text DEFAULT '[]' NOT NULL,
	`activity_name` text,
	`activity_time` text,
	`activity_location` text,
	`liaison_teacher` text,
	`attachments_json` text DEFAULT '[]' NOT NULL,
	`control_mode` text,
	`last_action` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subtasks` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_task_id` integer,
	`parent` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`assignee` text NOT NULL,
	`deadline` text DEFAULT '' NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`completed_by` text,
	`completion_note` text,
	`attachments_json` text DEFAULT '[]' NOT NULL,
	`last_action` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_subtasks_parent` ON `subtasks` (`parent_task_id`);
