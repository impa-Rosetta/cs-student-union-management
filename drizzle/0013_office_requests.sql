CREATE TABLE `office_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `status` text NOT NULL,
  `requester_username` text NOT NULL,
  `requester_name` text NOT NULL,
  `requester_department` text NOT NULL,
  `activity_id` text DEFAULT '' NOT NULL,
  `activity_name` text DEFAULT '' NOT NULL,
  `deadline` text DEFAULT '' NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `details_json` text DEFAULT '{}' NOT NULL,
  `materials_json` text DEFAULT '[]' NOT NULL,
  `attachments_json` text DEFAULT '[]' NOT NULL,
  `external_platform` text DEFAULT '' NOT NULL,
  `external_reference` text DEFAULT '' NOT NULL,
  `handler_name` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `idx_office_requests_status` ON `office_requests` (`status`,`updated_at`);
CREATE TABLE `office_request_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `request_id` text NOT NULL,
  `action` text NOT NULL,
  `from_status` text NOT NULL,
  `to_status` text NOT NULL,
  `actor_name` text NOT NULL,
  `note` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `idx_office_request_events_request` ON `office_request_events` (`request_id`,`id`);
