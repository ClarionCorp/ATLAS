// Builds and runs the Steam command used to start Omega Strikers

import { openUrl } from "@tauri-apps/plugin-opener";
import { steam_app_id } from "../constants";

// Everything in `extraArgs` is passed to the game, the same as anything after %command% in Steam's launch options.
// Note: steam:// can't apply prefixes like WINEDLLOVERRIDES (flags.linuxUE4SS), those still need to be set in Steam.
export function buildStartCommand(extraArgs: string[] = []) {
  return `steam://run/${steam_app_id}//${encodeURIComponent(extraArgs.join(' '))}/`;
}

export async function launchGame(extraArgs: string[] = []) {
  const url = buildStartCommand(extraArgs);
  console.log(`Launching: ${url}`);
  await openUrl(url);
}
