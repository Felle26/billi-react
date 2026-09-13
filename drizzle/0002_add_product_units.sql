ALTER TABLE `products` ADD COLUMN `product_unit` text DEFAULT 'lfm / m';
--> statement-breakpoint
ALTER TABLE `products` ADD COLUMN `product_count` real DEFAULT 0;
