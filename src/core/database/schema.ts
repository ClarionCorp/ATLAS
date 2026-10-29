import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Only one row that stores basic app settings
export const appSettings = sqliteTable("appSettings", {
  id: integer("id").primaryKey(),
  gameDirectory: text("game_directory"), // no default, asked on startup if null
  ue4ssInstalled: integer("ue4ss_installed", { mode: 'boolean' }).notNull().default(false),
});

export const hostOptions = sqliteTable("hostOptions", {
  id: integer("id").primaryKey(),

  maxFps: integer("max_fps").notNull().default(768), // how many updates per second (MUST BE HIGH)
  minPlayers: integer("min_players").notNull().default(6), // how many players before auto starting (if enabled)
  maxSets: integer("max_sets").notNull().default(3), // how many sets to win the game?
  maxRounds: integer("max_rounds").notNull().default(3), // how many rounds to win a set?
  mapId: text("map_id"), // "Drums"
  queueId: text("queue_id"), // "Normal"

  showLog: integer("show_log", { mode: 'boolean' }).notNull().default(false),

  updatedAt: integer("updated_at", { mode: "timestamp" }).default(new Date()).$onUpdateFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
})

export const clientOptions = sqliteTable("clientOptions", {
  id: integer("id").primaryKey(),

  autoConnectIP: text("auto_connect_ip"),
  autoConnect: integer("auto_connect", { mode: 'boolean' }).notNull().default(false),

  showLog: integer("show_log", { mode: 'boolean' }).notNull().default(false),
  additionalOpts: text("additional_launch_opts"),
  modVersion: text("mod_version"),

  updatedAt: integer("updated_at", { mode: "timestamp" }).default(new Date()).$onUpdateFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
})