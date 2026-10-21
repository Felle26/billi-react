CREATE TABLE IF NOT EXISTS `license_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`serial_number` text NOT NULL DEFAULT '',
	`expires_at` text NOT NULL DEFAULT ''
);
