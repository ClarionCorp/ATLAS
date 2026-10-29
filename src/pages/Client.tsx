import { useEffect, useState } from 'react';
import { platform } from '@tauri-apps/plugin-os';
import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import { Button, IconButton } from '../components/UI/Button';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import { useToast } from '../components/UI/Toast';
import { InstallModal } from '../components/InstallModal';
import { getAppSettings, getClientOptions } from '../core/database/queries';
import { uninstallUE4SS } from '../core/utilities/ue4ss';
import { launchGame } from '../core/utilities/launch';
import { linuxUE4SS } from '../core/flags';

export default function ClientPage() {
  const { toast } = useToast();
  const [gameDirectory, setGameDirectory] = useState<string | null>(null);
  const [modVersion, setModVersion] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [copied, setCopied] = useState(false);
  const isLinux = platform() !== 'windows';

  async function copyLaunchOptions() {
    await navigator.clipboard.writeText(linuxUE4SS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function loadModVersion() {
    const options = await getClientOptions();
    setModVersion(options?.modVersion ?? null);
  }

  useEffect(() => {
    getAppSettings().then(settings => setGameDirectory(settings?.gameDirectory ?? null));
    loadModVersion();
  }, []);

  function closeInstall() {
    setInstallOpen(false);
    loadModVersion();
  }

  async function uninstall() {
    if (!gameDirectory) return;
    setUninstallOpen(false);
    setUninstalling(true);
    try {
      await uninstallUE4SS(gameDirectory);
      toast('UE4SS and ATLAS mods uninstalled.', 'success');
    } catch (e) {
      console.error(`[UE4SS] Uninstall failed!`, e);
      toast(`Uninstall failed: ${e}`, 'error');
    } finally {
      setUninstalling(false);
      loadModVersion();
    }
  }

  async function play() {
    try {
      await launchGame();
    } catch (e) {
      console.error(`[Launch] Failed to start the game!`, e);
      toast(`Failed to launch: ${e}`, 'error');
    }
  }

  return (
    <div className="p-6 min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center gap-4">
      <Button size="lg" className="w-64" disabled={!modVersion} onClick={play}>Play</Button>
      <Button size="lg" className="w-64" disabled={!gameDirectory} onClick={() => setInstallOpen(true)}>Install / Update</Button>
      <Button size="lg" className="w-64" disabled={!gameDirectory} loading={uninstalling} onClick={() => setUninstallOpen(true)}>Uninstall</Button>
      {isLinux && (
        <div className="mt-4 max-w-md flex flex-col items-center gap-2 text-center border-dashed border-2 border-zinc-800 p-4 rounded-xl">
          <span className="text-sm font-semibold text-zinc-500">You appear to be on Linux.</span>
          <span className="text-xs text-zinc-500">For UE4SS to load, your OS's Steam launch options should look like this:</span>
          <div className="flex items-center gap-1 rounded-md bg-zinc-900 border border-zinc-800 pl-3 pr-1 py-1">
            <code className="text-xs text-zinc-300">{linuxUE4SS}</code>
            <IconButton size="sm" label={copied ? 'Copied' : 'Copy'} icon={copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />} onClick={copyLaunchOptions} />
          </div>
        </div>
      )}
      <InstallModal open={installOpen} mod="client" gameDirectory={gameDirectory} onClose={closeInstall} />
      <ConfirmModal
        open={uninstallOpen}
        title="Confirm Uninstallation"
        description="This removes UE4SS and both ATLAS mods from your game directory."
        confirmLabel="Uninstall"
        onConfirm={uninstall}
        onCancel={() => setUninstallOpen(false)}
      />
    </div>
  );
}
