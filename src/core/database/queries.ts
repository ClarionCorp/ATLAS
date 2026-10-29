import { db } from "./driver";
import { appSettings, clientOptions, hostOptions } from "./schema";

export async function getAppSettings() {
  const rows = await db.select().from(appSettings).limit(1);
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

export async function ensureTables() {
  await db.insert(appSettings).values({ id: 1 }).onConflictDoNothing({ target: appSettings.id }).run();
  await db.insert(hostOptions).values({ id: 1 }).onConflictDoNothing({ target: hostOptions.id }).run();
  await db.insert(clientOptions).values({ id: 1 }).onConflictDoNothing({ target: clientOptions.id }).run();
}