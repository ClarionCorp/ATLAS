PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_clientOptions` (
	`id` integer PRIMARY KEY NOT NULL,
	`auto_connect_ip` text,
	`auto_connect` integer DEFAULT false NOT NULL,
	`show_log` integer DEFAULT false NOT NULL,
	`additional_launch_opts` text,
	`mod_version` text,
	`updated_at` integer DEFAULT '"2026-10-29T16:35:35.535Z"',
	`created_at` integer DEFAULT '"2026-10-29T16:35:35.535Z"'
);
--> statement-breakpoint
INSERT INTO `__new_clientOptions`("id", "auto_connect_ip", "auto_connect", "show_log", "additional_launch_opts", "mod_version", "updated_at", "created_at") SELECT "id", "auto_connect_ip", "auto_connect", "show_log", "additional_launch_opts", "mod_version", "updated_at", "created_at" FROM `clientOptions`;--> statement-breakpoint
DROP TABLE `clientOptions`;--> statement-breakpoint
ALTER TABLE `__new_clientOptions` RENAME TO `clientOptions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_hostOptions` (
	`id` integer PRIMARY KEY NOT NULL,
	`max_fps` integer DEFAULT 768 NOT NULL,
	`min_players` integer DEFAULT 6 NOT NULL,
	`max_sets` integer DEFAULT 3 NOT NULL,
	`max_rounds` integer DEFAULT 3 NOT NULL,
	`map_id` text,
	`queue_id` text,
	`show_log` integer DEFAULT false NOT NULL,
	`additional_launch_opts` text,
	`mod_version` text,
	`updated_at` integer DEFAULT '"2026-10-29T16:35:35.534Z"',
	`created_at` integer DEFAULT '"2026-10-29T16:35:35.535Z"'
);
--> statement-breakpoint
INSERT INTO `__new_hostOptions`("id", "max_fps", "min_players", "max_sets", "max_rounds", "map_id", "queue_id", "show_log", "additional_launch_opts", "mod_version", "updated_at", "created_at") SELECT "id", "max_fps", "min_players", "max_sets", "max_rounds", "map_id", "queue_id", "show_log", "additional_launch_opts", "mod_version", "updated_at", "created_at" FROM `hostOptions`;--> statement-breakpoint
DROP TABLE `hostOptions`;--> statement-breakpoint
ALTER TABLE `__new_hostOptions` RENAME TO `hostOptions`;