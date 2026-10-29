import { getCurrentWindow } from "@tauri-apps/api/window";

export async function renameWindow(title: string) {
  await getCurrentWindow().setTitle(`${title}`);
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));