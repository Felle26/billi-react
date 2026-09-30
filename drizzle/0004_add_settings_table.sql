CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_name` text DEFAULT '',
	`owner_name` text DEFAULT '',
	`street` text DEFAULT '',
	`zip` text DEFAULT '',
	`city` text DEFAULT '',
	`phone` text DEFAULT '',
	`email` text DEFAULT '',
	`tax_id` text DEFAULT '',
	`backup_path` text DEFAULT '',
	`invoice_path` text DEFAULT ''
);
