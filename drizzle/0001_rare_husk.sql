ALTER TABLE `departments` ADD `parent_id` integer;--> statement-breakpoint
CREATE INDEX `idx_departments_parent_id` ON `departments` (`parent_id`);