CREATE TABLE `object_products` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `object_id` integer NOT NULL,
  `product_id` integer NOT NULL,
  `custom_price` real NOT NULL,
  `custom_quantity` real NOT NULL DEFAULT 0,
  `sort_order` integer DEFAULT 0,
  FOREIGN KEY (`object_id`) REFERENCES `Object`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `object_products_object_product_unique`
  ON `object_products` (`object_id`, `product_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `object_products` (`object_id`, `product_id`, `custom_price`, `custom_quantity`, `sort_order`)
SELECT `Object`.`id`, `customer_products`.`product_id`, `customer_products`.`custom_price`, `customer_products`.`custom_quantity`, `customer_products`.`sort_order`
FROM `customer_products`
INNER JOIN `Object` ON `Object`.`user_id` = `customer_products`.`user_id`;