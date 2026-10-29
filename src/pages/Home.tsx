import { useEffect, useState } from 'react';
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNavigate } from 'react-router-dom';
import { linux_default_gamedir, version, windows_default_gamedir } from '../core/constants';
import { Button } from '../components/UI/Button';
import { GameDirectoryModal } from '../components/Setup/GameDirectoryModal';
import { ensureTables, getAppSettings, upsertAppSettings } from '../core/database/queries';
import { homeDir, join } from '@tauri-apps/api/path';
import { platform } from "@tauri-apps/plugin-os";
import { exists } from '@tauri-apps/plugin-fs';

// Returns false if the game directory still needs to be picked by the user
async function loadData() {
  await getCurrentWindow().setTitle(`ATLAS v${version}`);
  await ensureTables();

  const appSettings = await getAppSettings();
  let gameDir = appSettings?.gameDirectory ?? null;

  if (!gameDir) {
    const defaultDir = platform() === 'windows' ? windows_default_gamedir : await join(await homeDir(), linux_default_gamedir);
    const found = await exists(await join(defaultDir, 'OmegaStrikers.exe')).catch(() => false);
    if (!found) return false;

    await upsertAppSettings({ gameDirectory: gameDir });
  }

  return true;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [needsGameDir, setNeedsGameDir] = useState(false);

  useEffect(() => {
    loadData().then(ok => setNeedsGameDir(!ok));
  }, []);

  async function handleGameDirSelected(gameDir: string) {
    await upsertAppSettings({ gameDirectory: gameDir });
    setNeedsGameDir(false);
  }

  return (
    <div className="p-6 min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center gap-8">
      <h1 className="text-2xl font-semibold text-center">What will this computer be used for?</h1>
      <div className="flex gap-4">
        <Button size="lg" className="w-64 h-auto py-3" onClick={() => navigate('/host')}>
          <span className="flex flex-col items-center gap-0.5">
            <span>HOST</span>
            <span className="text-xs font-normal text-zinc-400">Players connect to this computer (CANNOT PLAY)</span>
          </span>
        </Button>
        <Button size="lg" className="w-64 h-auto py-3" onClick={() => navigate('/client')}>
          <span className="flex flex-col items-center gap-0.5">
            <span>CLIENT</span>
            <span className="text-xs font-normal text-zinc-400">Connect to an ATLAS Server</span>
          </span>
        </Button>
      </div>
      <GameDirectoryModal open={needsGameDir} onSelect={handleGameDirSelected} />
    </div>
  );
}
