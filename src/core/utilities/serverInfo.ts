// Bridge for the host mod's TEMP/ATLAS/info.json, watched by the Rust backend (file_watcher.rs)

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Server } from "../../types/server";

type FileChangeEvent = {
  file: string;
  kind: 'created' | 'modified';
  content: string;
};

// JSON has no Date type, so revive the date fields after parsing
function parseServerInfo(content: string): Server.Info {
  const raw = JSON.parse(content);
  return {
    ...raw,
    updatedAt: new Date(raw.updatedAt),
    players: raw.players?.map((p: Server.Players) => ({ ...p, joinedAt: new Date(p.joinedAt) })),
  };
}

// Current info.json, or null if the host hasn't written one yet
export async function getServerInfo(): Promise<Server.Info | null> {
  const content = await invoke<string | null>('get_server_info');
  if (!content) return null;

  try {
    return parseServerInfo(content);
  } catch (e) {
    console.error(`[ServerInfo] Failed to parse info.json`, e);
    return null;
  }
}

// Calls `callback` every time info.json changes. Returns a promise of the unlisten function.
export function onServerInfoUpdate(callback: (info: Server.Info) => void) {
  return listen<FileChangeEvent>('onServerInfoUpdate', e => {
    try {
      callback(parseServerInfo(e.payload.content));
    } catch (err) {
      console.error(`[ServerInfo] Failed to parse info.json update`, err);
    }
  });
}
