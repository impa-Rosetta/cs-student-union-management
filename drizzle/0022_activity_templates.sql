CREATE TABLE `activity_templates` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `name` text NOT NULL, `category` text NOT NULL DEFAULT '',
  `description` text NOT NULL DEFAULT '', `organizer` text NOT NULL DEFAULT '', `departments_json` text NOT NULL DEFAULT '[]',
  `needs_venue` integer NOT NULL DEFAULT 0, `venue_request_json` text NOT NULL DEFAULT '{}', `tasks_json` text NOT NULL DEFAULT '[]',
  `created_by` text NOT NULL DEFAULT '', `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
