CREATE TABLE `workflow_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`actor_name` text NOT NULL,
	`actor_role` text NOT NULL,
	`reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workflow_events_entity` ON `workflow_events` (`entity_type`,`entity_id`);
