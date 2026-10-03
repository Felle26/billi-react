ALTER TABLE `invoices` ADD COLUMN `issue_date` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `invoices` ADD COLUMN `due_date` text NOT NULL DEFAULT '';