import { appSettings, clientOptions, hostOptions, serverStatus } from "../core/database/schema";

export type AppSettingsTable = typeof appSettings.$inferSelect;
export type HostOptionsTable = typeof hostOptions.$inferSelect;
export type ClientOptionsTable = typeof clientOptions.$inferSelect;
export type ServerStatusTable = typeof serverStatus.$inferSelect;