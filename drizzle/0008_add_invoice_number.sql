ALTER TABLE `settings` ADD COLUMN `next_invoice_number` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `invoices` ADD COLUMN `invoice_number` text NOT NULL DEFAULT '';