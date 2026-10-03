CREATE TABLE `invoice_items_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`product_id` integer,
	`product_name` text DEFAULT '' NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`price_at_time` real NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `invoice_items_new` (`id`, `invoice_id`, `product_id`, `product_name`, `quantity`, `price_at_time`)
SELECT `invoice_items`.`id`, `invoice_items`.`invoice_id`, `invoice_items`.`product_id`, COALESCE(`products`.`name`, ''), `invoice_items`.`quantity`, `invoice_items`.`price_at_time`
FROM `invoice_items`
LEFT JOIN `products` ON `invoice_items`.`product_id` = `products`.`id`;
--> statement-breakpoint
DROP TABLE `invoice_items`;
--> statement-breakpoint
ALTER TABLE `invoice_items_new` RENAME TO `invoice_items`;