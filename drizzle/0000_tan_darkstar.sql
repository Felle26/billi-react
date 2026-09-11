CREATE TABLE `invoice_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`price_at_time` real NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`object_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`invoice_path` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`object_id`) REFERENCES `Object`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Object` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`planned_route_Id` integer NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`user_id` integer NOT NULL,
	`street` text NOT NULL,
	`number` text NOT NULL,
	`zip` text NOT NULL,
	`city` text NOT NULL,
	`country` text NOT NULL,
	FOREIGN KEY (`planned_route_Id`) REFERENCES `planned_routes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `planned_routes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`route_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`price_tag` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text DEFAULT '',
	`last_name` text DEFAULT '',
	`company_name` text DEFAULT '',
	`company_id` text DEFAULT '',
	`zip` text NOT NULL,
	`city` text NOT NULL,
	`street` text NOT NULL,
	`number` text NOT NULL,
	`country` text DEFAULT '',
	`phone` text NOT NULL,
	`fax` text DEFAULT '',
	`website` text DEFAULT '',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`email` text DEFAULT '',
	`has_sconto` integer DEFAULT 0
);
