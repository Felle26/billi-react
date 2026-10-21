CREATE TABLE IF NOT EXISTS `connection_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`encrypted_config` text NOT NULL DEFAULT '',
	`enabled` integer NOT NULL DEFAULT 0
);
