-- Custom SQL migration file, put your code below! --
-- 0002/0003 copied columns that didn't exist yet in the old tables. SQLite treats an unknown
-- double-quoted identifier as a string literal, so existing rows got the column name as their value.
UPDATE `hostOptions` SET `additional_launch_opts` = NULL WHERE `additional_launch_opts` = 'additional_launch_opts';--> statement-breakpoint
UPDATE `hostOptions` SET `mod_version` = NULL WHERE `mod_version` = 'mod_version';--> statement-breakpoint
UPDATE `clientOptions` SET `additional_launch_opts` = NULL WHERE `additional_launch_opts` = 'additional_launch_opts';--> statement-breakpoint
UPDATE `clientOptions` SET `mod_version` = NULL WHERE `mod_version` = 'mod_version';
