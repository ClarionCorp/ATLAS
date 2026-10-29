// UE4SS + ATLAS mod installer for the client and host

import { dirname, join, tempDir } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, remove, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { upsertClientOptions, upsertHostOptions } from "../database/queries";

const UE4SS_URL = 'https://github.com/UE4SS-RE/RE-UE4SS/releases/download/v3.0.1/UE4SS_v3.0.1.zip';

export type InstallStage = 'checking' | 'downloading' | 'extracting' | 'installing' | 'done';
type InstallProgressCallback = (stage: InstallStage, percent: number | null, message: string) => void;

export type InstallResult = {
  ue4ssInstalled: boolean; // true if UE4SS was freshly installed
  modUpdated: boolean;
  previousVersion: string | null;
  version: string;
};

export type ModId = 'client' | 'host';

type BundledMod = {
  name: string;
  files: Record<string, string>; // keyed by path inside the mod folder (e.g. "Scripts/main.lua")
  binaries: Record<string, string>; // same keys (e.g. "dlls/main.dll"), values are bundled asset URLs
  version: string | null;
};

const parseVersion = (lua: string) =>
  lua.match(/local ModVersion\s*=\s*"([^"]+)"/)?.[1] ?? null;

const relativeTo = (name: string, glob: Record<string, string>) =>
  Object.fromEntries(Object.entries(glob).map(([path, value]) => [path.split(`${name}/`)[1], value]));

function bundleMod(name: string, sources: Record<string, string>, binaries: Record<string, string>): BundledMod {
  const files = relativeTo(name, sources);
  return { name, files, binaries: relativeTo(name, binaries), version: parseVersion(files['Scripts/main.lua'] ?? '') };
}

// import.meta.glob only takes literal patterns, so each mod needs its own calls
export const MODS: Record<ModId, BundledMod> = {
  client: bundleMod('ATLASClientMod',
    import.meta.glob<string>('../../assets/ClientMod/ATLASClientMod/**/*.lua', { query: '?raw', import: 'default', eager: true }),
    import.meta.glob<string>('../../assets/ClientMod/ATLASClientMod/**/*.dll', { query: '?url', import: 'default', eager: true }),
  ),
  host: bundleMod('ATLASHostMod',
    import.meta.glob<string>('../../assets/HostMod/ATLASHostMod/**/*.lua', { query: '?raw', import: 'default', eager: true }),
    import.meta.glob<string>('../../assets/HostMod/ATLASHostMod/**/*.dll', { query: '?url', import: 'default', eager: true }),
  ),
};

const getWin64Dir = (gameDirectory: string) => join(gameDirectory, 'OmegaStrikers/Binaries/Win64');

export async function isUE4SSInstalled(gameDirectory: string) {
  const win64 = await getWin64Dir(gameDirectory);
  return await exists(await join(win64, 'UE4SS.dll')) && await exists(await join(win64, 'dwmapi.dll'));
}

// Returns null if the mod isn't installed
export async function getInstalledModVersion(gameDirectory: string, modId: ModId) {
  const mainLua = await join(await getWin64Dir(gameDirectory), 'Mods', MODS[modId].name, 'Scripts/main.lua');
  if (!await exists(mainLua)) return null;
  return parseVersion(await readTextFile(mainLua));
}

// Downloads and extracts UE4SS if it's missing. Returns true if it was freshly installed.
async function ensureUE4SS(gameDirectory: string, onProgress?: InstallProgressCallback) {
  onProgress?.('checking', 0, 'Checking if UE4SS is installed...');
  if (await isUE4SSInstalled(gameDirectory)) return false;

  const win64 = await getWin64Dir(gameDirectory);

  onProgress?.('downloading', null, 'Downloading UE4SS from GitHub...');
  const response = await fetch(UE4SS_URL, { method: 'GET' });
  if (!response.ok) throw new Error(`GitHub Download Failed: ${response.status}`);

  const zipPath = await join(await tempDir(), 'UE4SS_v3.0.1.zip');
  await writeFile(zipPath, new Uint8Array(await response.arrayBuffer()));

  onProgress?.('extracting', 50, 'Extracting UE4SS...');
  await invoke('extract_zip', { zipPath, destDir: win64 });

  return true;
}

export async function installMod(gameDirectory: string, modId: ModId, onProgress?: InstallProgressCallback): Promise<InstallResult> {
  const mod = MODS[modId];
  if (!mod.version) throw new Error(`Bundled ${mod.name} is missing or has no ModVersion`);

  const result: InstallResult = { ue4ssInstalled: false, modUpdated: false, previousVersion: null, version: mod.version };
  result.ue4ssInstalled = await ensureUE4SS(gameDirectory, onProgress);

  onProgress?.('checking', 70, 'Checking mod version...');
  result.previousVersion = await getInstalledModVersion(gameDirectory, modId);

  if (result.previousVersion !== mod.version) {
    onProgress?.('installing', 80, result.previousVersion
      ? `Updating ${mod.name} ${result.previousVersion} -> ${mod.version}...`
      : `Installing ${mod.name} v${mod.version}...`);

    const modDir = await join(await getWin64Dir(gameDirectory), 'Mods', mod.name);
    for (const [relativePath, source] of Object.entries(mod.files)) {
      const target = await join(modDir, relativePath);
      await mkdir(await dirname(target), { recursive: true });
      await writeTextFile(target, source);
    }
    // Binaries are bundled as asset URLs, so read them back through the webview's own fetch
    for (const [relativePath, url] of Object.entries(mod.binaries)) {
      const response = await window.fetch(url);
      if (!response.ok) throw new Error(`Failed to read bundled ${relativePath}: ${response.status}`);

      const target = await join(modDir, relativePath);
      await mkdir(await dirname(target), { recursive: true });
      await writeFile(target, new Uint8Array(await response.arrayBuffer()));
    }
    // UE4SS loads any mod folder containing enabled.txt, no mods.txt entry needed
    await writeTextFile(await join(modDir, 'enabled.txt'), '');
    result.modUpdated = true;
  }

  const saveModVersion = modId === 'client' ? upsertClientOptions : upsertHostOptions;
  await saveModVersion({ modVersion: mod.version });

  onProgress?.('done', 100, `UE4SS & ${mod.name} are up-to-date!`);
  return result;
}

export const installClientMod = (gameDirectory: string, onProgress?: InstallProgressCallback) =>
  installMod(gameDirectory, 'client', onProgress);

export const installHostMod = (gameDirectory: string, onProgress?: InstallProgressCallback) =>
  installMod(gameDirectory, 'host', onProgress);

// Removes UE4SS and every mod with it, so both client and host mod versions get cleared
export async function uninstallUE4SS(gameDirectory: string) {
  const win64 = await getWin64Dir(gameDirectory);

  for (const path of ['dwmapi.dll', 'UE4SS.dll', 'Mods/ATLASHostMod', 'Mods/ATLASClientMod']) {
    const fullPath = await join(win64, path);
    if (await exists(fullPath)) {
      await remove(fullPath, { recursive: true });
    }
  }

  await upsertClientOptions({ modVersion: null });
  await upsertHostOptions({ modVersion: null });
}
