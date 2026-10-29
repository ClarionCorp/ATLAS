CREATE TABLE `appSettings` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `clientOptions` (
	`id` integer PRIMARY KEY NOT NULL,
	`auto_connect_ip` text,
	`auto_connect` integer DEFAULT false NOT NULL,
	`show_log` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT '"2026-10-29T15:17:24.746Z"',
	`created_at` integer DEFAULT '"2026-10-29T15:17:24.746Z"'
);
--> statement-breakpoint
CREATE TABLE `hostOptions` (
	`id` integer PRIMARY KEY NOT NULL,
	`max_fps` integer DEFAULT 768 NOT NULL,
	`min_players` integer DEFAULT 6 NOT NULL,
	`max_sets` integer DEFAULT 3 NOT NULL,
	`max_rounds` integer DEFAULT 3 NOT NULL,
	`map_id` text,
	`queue_id` text,
	`show_log` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT '"2026-10-29T15:17:24.746Z"',
	`created_at` integer DEFAULT '"2026-10-29T15:17:24.746Z"'
);
