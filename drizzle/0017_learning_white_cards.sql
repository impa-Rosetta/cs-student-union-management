CREATE TABLE `white_card_submissions` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `status` text NOT NULL,
  `submitter_username` text NOT NULL,
  `submitter_name` text NOT NULL,
  `attachments_json` text DEFAULT '[]' NOT NULL,
  `handler_username` text DEFAULT '' NOT NULL,
  `handler_name` text DEFAULT '' NOT NULL,
  `article_url` text DEFAULT '' NOT NULL,
  `reviewer_username` text DEFAULT '' NOT NULL,
  `reviewer_name` text DEFAULT '' NOT NULL,
  `return_target` text DEFAULT '' NOT NULL,
  `return_reason` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `archived_at` text DEFAULT '' NOT NULL
);
CREATE INDEX `idx_white_card_submissions_status` ON `white_card_submissions` (`status`,`updated_at`);
CREATE TABLE `white_card_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `submission_id` text NOT NULL,
  `action` text NOT NULL,
  `from_status` text NOT NULL,
  `to_status` text NOT NULL,
  `actor_username` text NOT NULL,
  `actor_name` text NOT NULL,
  `note` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `idx_white_card_events_submission` ON `white_card_events` (`submission_id`,`id`);
