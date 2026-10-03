ALTER TABLE `invoices` ADD COLUMN `vat_total` real NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `invoices` ADD COLUMN `gross_total` real NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `invoices` ADD COLUMN `cash_discount_enabled` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `invoices` ADD COLUMN `cash_discount_percent` real NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `invoices` ADD COLUMN `payable_total` real NOT NULL DEFAULT 0;