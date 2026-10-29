import { db } from "./driver";
import { appSettings, clientOptions, hostOptions, serverStatus } from "./schema";

export async function getAppSettings() {
  const rows = await db.select().from(appSettings).limit(1);
  return rows[0] ?? null;
}

export async function getClientOptions() {
  const rows = await db.select().from(clientOptions).limit(1);
  return rows[0] ?? null;
}

export async function upsertAppSettings(
  data: Partial<Pick<typeof appSettings.$inferInsert,
    'gameDirectory'
  >>
) {
  return db.insert(appSettings).values({ id: 1, ...data }).onConflictDoUpdate({
    target: appSettings.id,
    set: data,
  }).run();
}

export async function upsertClientOptions(
  data: Partial<Pick<typeof clientOptions.$inferInsert,
    'modVersion'
  >>
) {
  return db.insert(clientOptions).values({ id: 1, ...data }).onConflictDoUpdate({
    target: clientOptions.id,
    set: data,
  }).run();
}

export async function upsertHostOptions(
  data: Partial<Pick<typeof hostOptions.$inferInsert,
    'modVersion'
  >>
) {
  return db.insert(hostOptions).values({ id: 1, ...data }).onConflictDoUpdate({
    target: hostOptions.id,
    set: data,
  }).run();
}

export async function upsertServerStatus(
  data: Partial<Pick<typeof serverStatus.$inferInsert,
    'processId'
  >>
) {
  return db.insert(serverStatus).values({ id: 1, ...data }).onConflictDoUpdate({
    target: serverStatus.id,
    set: data,
  }).run();
}

export async function ensureTables() {
  await db.insert(appSettings).values({ id: 1 }).onConflictDoNothing({ target: appSettings.id }).run();
}