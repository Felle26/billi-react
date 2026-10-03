ALTER TABLE `settings` ADD COLUMN `tax_number` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `vat_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `bank` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `iban` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `bic` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `settings` SET `tax_number` = `tax_id` WHERE `tax_number` = '';