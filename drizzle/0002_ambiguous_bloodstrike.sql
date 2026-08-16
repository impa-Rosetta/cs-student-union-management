PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_departments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`group_name` text DEFAULT '主席团直属' NOT NULL,
	`parent_id` integer,
	`description` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_departments`("id", "name", "group_name", "parent_id", "description", "sort_order") SELECT "id", "name", "group_name", "parent_id", "description", "sort_order" FROM `departments`;--> statement-breakpoint
DROP TABLE `departments`;--> statement-breakpoint
ALTER TABLE `__new_departments` RENAME TO `departments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_departments_name` ON `departments` (`name`);--> statement-breakpoint
CREATE INDEX `idx_departments_parent_id` ON `departments` (`parent_id`);