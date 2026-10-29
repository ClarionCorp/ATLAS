import { getCurrentWindow } from "@tauri-apps/api/window";

export async function renameWindow(title: string) {
  await getCurrentWindow().setTitle(`${title}`);
}