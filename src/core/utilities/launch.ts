// Builds and runs the commands used to start Omega Strikers (client through Steam, host directly)

import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { steam_app_id } from "../constants";
import { listen } from "@tauri-apps/api/event";
import { getClientOptions, getHostOptions, clearServerPlayers, upsertServerStatus } from "../database/queries";
import { sleep } from "./app";

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
export async function startHostGame(gameDirectory: string) {
  const hostOpts = await getHostOptions();

  const win64 = await join(gameDirectory, 'OmegaStrikers/Binaries/Win64');
  const exePath = await join(win64, 'OmegaStrikers-Win64-Shipping.exe');
  const logPath = await join(win64, 'UE4SS.log');
  const args = [
    '-atlasHost',
    `-atlasMap=${hostOpts.mapId}`,
    `-atlasMode=${hostOpts.queueId}`,
    `-atlasMinPlayers=${hostOpts.minPlayers}`,
    `-atlasMaxSets=${hostOpts.maxSets}`,
    `-atlasMaxRounds=${hostOpts.maxRounds}`,
    `-atlasMaxFps=${hostOpts.maxFps}`,
    '-atlasEmptyRestart=3',
    '-atlasEndDelay=2',
    '-atlasAutoEnd=1',
    '-nullrhi',
    '-nosound'
  ];

  if (hostOpts.additionalOpts) { args.push(hostOpts.additionalOpts) };

  console.log(`Starting host: ${exePath} ${args.join(' ')}`);
  const pid = await invoke<number>('start_host', { exePath, args, logPath });
  await upsertServerStatus({ processId: pid });
  return pid;
}

export async function stopHostGame() {
  await sendHostCommand('forcestop'); // disconnect all players and shutdown session
  await clearServerPlayers();
  await sleep(3000);
  await invoke<void>('stop_host'); // kill application pid
}

// Returns the host's PID if it's running, otherwise null
export const getHostPid = () => invoke<number | null>('host_pid');

// Appends a command to TEMP/ATLAS/commands.jsonl for the host mod to pick up. Returns the command's ID.
// e.g. sendHostCommand('host', ['drums', 'normal']) or sendHostCommand('start')
export const sendHostCommand = (command: string, args: string[] = []) =>
  invoke<string>('send_host_command', { command, args });
