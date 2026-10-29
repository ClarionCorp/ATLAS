// Builds and runs the Steam command used to start Omega Strikers

import { openUrl } from "@tauri-apps/plugin-opener";
import { steam_app_id } from "../constants";
import { getClientOptions } from "../database/queries";

// Build the launch command based on user preferences and any additional launch options.
export async function launchClientGame() {
  const clientOptions = await getClientOptions();
  const args = [];

  if (clientOptions.autoConnect == true && clientOptions.autoConnectIP !== null) { args.push(clientOptions.autoConnectIP) };
  if (clientOptions.additionalOpts?.trim()) { args.push(clientOptions.additionalOpts.trim()) };

  const url = `steam://run/${steam_app_id}//${encodeURIComponent(args.join(' '))}/`;
  console.log(`Launching: ${url}`);
  await openUrl(url);
}
