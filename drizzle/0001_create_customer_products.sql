CREATE TABLE `customer_products` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `product_id` integer NOT NULL,
  `custom_price` real NOT NULL,
  `sort_order` integer DEFAULT 0,
  FOREIGN KEY (`user_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_products_user_product_unique`
  ON `customer_products` (`user_id`, `product_id`);