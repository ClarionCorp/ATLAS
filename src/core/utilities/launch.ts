// Builds and runs the commands used to start Omega Strikers (client through Steam, host directly)

import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { steam_app_id } from "../constants";
import { listen } from "@tauri-apps/api/event";
import { getClientOptions, upsertServerStatus } from "../database/queries";

// Registered once at module load so the PID gets cleared even if the Host page isn't open
listen('host-exited', () => upsertServerStatus({ processId: null }));

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

// Spawns the host game directly (no Steam). Returns the PID.
// The backend streams UE4SS.log as "host-log" events and emits "host-exited" when the process closes.
export async function startHostGame(gameDirectory: string, extraArgs: string[] = []) {
  const win64 = await join(gameDirectory, 'OmegaStrikers/Binaries/Win64');
  const exePath = await join(win64, 'OmegaStrikers-Win64-Shipping.exe');
  const logPath = await join(win64, 'UE4SS.log');
  const args = ['-atlasHost', ...extraArgs];

  console.log(`Starting host: ${exePath} ${args.join(' ')}`);
  const pid = await invoke<number>('start_host', { exePath, args, logPath });
  await upsertServerStatus({ processId: pid });
  return pid;
}

export const stopHostGame = () => invoke<void>('stop_host');

// Returns the host's PID if it's running, otherwise null
export const getHostPid = () => invoke<number | null>('host_pid');
