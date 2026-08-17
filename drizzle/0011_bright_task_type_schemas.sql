CREATE TABLE `task_type_schemas` (
	`name` text PRIMARY KEY NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`icon` text DEFAULT '' NOT NULL,
	`fields_json` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
