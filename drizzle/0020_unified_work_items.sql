CREATE TABLE `work_items` (
  `id` text PRIMARY KEY NOT NULL, `source_type` text NOT NULL, `source_id` text NOT NULL, `title` text NOT NULL,
  `status_group` text NOT NULL, `native_status` text NOT NULL, `activity_id` text NOT NULL DEFAULT '',
  `activity_name` text NOT NULL DEFAULT '', `owner_department_name` text NOT NULL DEFAULT '',
  `assignee_account_id` integer, `assignee_name` text NOT NULL DEFAULT '', `requester_account_id` integer,
  `requester_username` text NOT NULL DEFAULT '', `requester_name` text NOT NULL DEFAULT '', `priority` text NOT NULL DEFAULT '普通',
  `planned_start_at` text NOT NULL DEFAULT '', `due_at` text NOT NULL DEFAULT '', `completed_at` text NOT NULL DEFAULT '',
  `blocked` integer NOT NULL DEFAULT 0, `blocked_reason` text NOT NULL DEFAULT '', `next_actor_type` text NOT NULL DEFAULT '',
  `next_actor_id` text NOT NULL DEFAULT '', `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(`source_type`,`source_id`)
);
--> statement-breakpoint
CREATE TABLE `work_item_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `work_item_id` text NOT NULL, `action` text NOT NULL,
  `from_status` text NOT NULL DEFAULT '', `to_status` text NOT NULL DEFAULT '', `actor_account_id` integer,
  `actor_name` text NOT NULL DEFAULT '', `changes_json` text NOT NULL DEFAULT '{}', `note` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_work_items_source` ON `work_items` (`source_type`,`source_id`);
--> statement-breakpoint
CREATE INDEX `idx_work_items_activity` ON `work_items` (`activity_id`);
--> statement-breakpoint
CREATE INDEX `idx_work_items_department` ON `work_items` (`owner_department_name`,`status_group`);
--> statement-breakpoint
CREATE INDEX `idx_work_items_assignee` ON `work_items` (`assignee_account_id`,`status_group`);
--> statement-breakpoint
CREATE INDEX `idx_work_items_requester` ON `work_items` (`requester_username`,`status_group`);
--> statement-breakpoint
CREATE INDEX `idx_work_item_events_item` ON `work_item_events` (`work_item_id`,`id`);
