ALTER TABLE `tasks` ADD `activity_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `tasks` ADD `planned_start_at` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `tasks` ADD `planned_end_at` text NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE INDEX `idx_tasks_activity` ON `tasks` (`activity_id`);
--> statement-breakpoint
ALTER TABLE `subtasks` ADD `planned_start_at` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `subtasks` ADD `planned_end_at` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `tasks` SET `activity_id` = 'top-singer', `activity_name` = '计算学院十佳歌手比赛' WHERE `activity_id` = '' AND COALESCE(`activity_name`, '') = '' AND `id` BETWEEN 1 AND 9;
--> statement-breakpoint
UPDATE `tasks` SET
  `planned_start_at` = CASE `id` WHEN 1 THEN '2026-09-16T09:00:00+08:00' WHEN 2 THEN '2026-09-17T09:00:00+08:00' WHEN 3 THEN '2026-09-18T09:00:00+08:00' WHEN 4 THEN '2026-09-25T20:30:00+08:00' WHEN 5 THEN '2026-09-25T15:30:00+08:00' WHEN 6 THEN '2026-09-17T09:00:00+08:00' WHEN 7 THEN '2026-09-25T16:00:00+08:00' WHEN 8 THEN '2026-09-25T20:00:00+08:00' WHEN 9 THEN '2026-09-25T20:00:00+08:00' ELSE `planned_start_at` END,
  `planned_end_at` = CASE `id` WHEN 1 THEN '2026-09-20T18:00:00+08:00' WHEN 2 THEN '2026-09-21T12:00:00+08:00' WHEN 3 THEN '2026-09-23T21:30:00+08:00' WHEN 4 THEN '2026-09-25T22:00:00+08:00' WHEN 5 THEN '2026-09-25T17:30:00+08:00' WHEN 6 THEN '2026-09-19T20:00:00+08:00' WHEN 7 THEN '2026-09-26T12:00:00+08:00' WHEN 8 THEN '2026-09-26T20:00:00+08:00' WHEN 9 THEN '2026-09-28T18:00:00+08:00' ELSE `planned_end_at` END
WHERE `id` BETWEEN 1 AND 9 AND `planned_start_at` = '' AND `planned_end_at` = '';
--> statement-breakpoint
UPDATE `subtasks` SET `planned_start_at` = '2026-09-20T09:00:00+08:00', `planned_end_at` = '2026-09-22T20:00:00+08:00' WHERE `id` = 'seed-light-console' AND `planned_start_at` = '' AND `planned_end_at` = '';
