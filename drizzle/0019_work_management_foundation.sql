ALTER TABLE `tasks` ADD `assignee_account_id` integer;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `owner_department_id` integer;
--> statement-breakpoint
ALTER TABLE `subtasks` ADD `assignee_account_id` integer;
--> statement-breakpoint
CREATE INDEX `idx_tasks_assignee_account` ON `tasks` (`assignee_account_id`);
--> statement-breakpoint
CREATE INDEX `idx_tasks_owner_department` ON `tasks` (`owner_department_id`);
--> statement-breakpoint
CREATE INDEX `idx_subtasks_assignee_account` ON `subtasks` (`assignee_account_id`);
--> statement-breakpoint
UPDATE `tasks` SET `assignee_account_id` = (
  SELECT CASE WHEN COUNT(*) = 1 THEN MAX(`id`) ELSE NULL END FROM `app_accounts`
  WHERE `active` = 1 AND `name` = `tasks`.`person` AND `department` = `tasks`.`department`
) WHERE `assignee_account_id` IS NULL;
--> statement-breakpoint
UPDATE `tasks` SET `owner_department_id` = (
  SELECT CASE WHEN COUNT(*) = 1 THEN MAX(`id`) ELSE NULL END FROM `departments`
  WHERE `name` = `tasks`.`department`
) WHERE `owner_department_id` IS NULL;
--> statement-breakpoint
UPDATE `subtasks` SET `assignee_account_id` = (
  SELECT CASE WHEN COUNT(*) = 1 THEN MAX(`app_accounts`.`id`) ELSE NULL END
  FROM `app_accounts` JOIN `tasks` ON `tasks`.`id` = `subtasks`.`parent_task_id`
  WHERE `app_accounts`.`active` = 1 AND `app_accounts`.`name` = `subtasks`.`assignee`
    AND `app_accounts`.`department` = `tasks`.`department`
) WHERE `assignee_account_id` IS NULL;
