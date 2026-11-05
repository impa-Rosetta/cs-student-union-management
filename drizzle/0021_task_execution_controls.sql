ALTER TABLE `tasks` ADD `blocked` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `blocked_reason` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `tasks` ADD `reassignment_reason` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `tasks` ADD `schedule_change_reason` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `subtasks` ADD `blocked` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `subtasks` ADD `blocked_reason` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `subtasks` ADD `reassignment_reason` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `subtasks` ADD `schedule_change_reason` text NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE `task_dependencies` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `predecessor_task_id` integer NOT NULL,
  `successor_task_id` integer NOT NULL, `dependency_type` text NOT NULL DEFAULT 'finish_to_start',
  `created_by` text NOT NULL DEFAULT '', `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`predecessor_task_id`,`successor_task_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_dependencies_pair` ON `task_dependencies` (`predecessor_task_id`,`successor_task_id`);
--> statement-breakpoint
CREATE INDEX `idx_task_dependencies_successor` ON `task_dependencies` (`successor_task_id`);
