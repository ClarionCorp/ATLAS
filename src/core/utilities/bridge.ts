// This file is for functions that talk to the Rust backend

import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface FileChangePayload {
  file: string;
  kind: 'created' | 'modified' | 'removed';
  content: string | null;
}

export async function onInfoChange(
  handler: (payload: FileChangePayload) => void
): Promise<UnlistenFn> {
  return listen<FileChangePayload>('onServerInfoUpdate', (event) => {
    handler(event.payload);
  });
}