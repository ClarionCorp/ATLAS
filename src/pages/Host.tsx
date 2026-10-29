import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Button } from '../components/UI/Button';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import { useToast } from '../components/UI/Toast';
import { InstallModal } from '../components/InstallModal';
import { Console } from '../components/Host/Console';
import { StatusIndicator } from '../components/Host/StatusIndicator';
import { MatchSettings } from '../components/Host/MatchSettings';
import { getAppSettings } from '../core/database/queries';
import { uninstallUE4SS } from '../core/utilities/ue4ss';
import { getHostPid, startHostGame, stopHostGame } from '../core/utilities/launch';
import { getServerInfo, onServerInfoUpdate } from '../core/utilities/serverInfo';
import { Server } from '../types/server';
import { renameWindow } from '../core/utilities/app';
import { version } from '../core/constants';

const MAX_LOG_LINES = 2000;

// Placeholder for a control panel module until it gets built out
function ModuleSkeleton({ title, className }: { title: string; className?: string }) {
  return (
    <div className={`rounded-xl bg-zinc-900 border border-zinc-800 p-4 flex flex-col gap-3 ${className ?? ''}`}>
      <span className="text-sm font-semibold text-zinc-400">{title}</span>
      <div className="flex-1 rounded-lg border-2 border-dashed border-zinc-800" />
    </div>
  );
}

export default function HostPage() {
  const { toast } = useToast();
  const [gameDirectory, setGameDirectory] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);

  const [hostPid, setHostPid] = useState<number | null>(null);
  const [toggling, setToggling] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [serverInfo, setServerInfo] = useState<Server.Info | null>(null);
  const running = hostPid !== null;
  const status: Server.Status = !running ? 'OFFLINE' : serverInfo ? 'ONLINE' : 'STARTING';

  useEffect(() => {
    renameWindow(`ATLAS v${version} - Host`);
    getAppSettings().then(settings => setGameDirectory(settings?.gameDirectory ?? null));
    // The host keeps running if this page is left, so pick it back up
    getHostPid().then(setHostPid);
    getServerInfo().then(setServerInfo);

    const listeners = Promise.all([
      listen<string>('host-log', e => {
        setLogs(prev => [...prev, e.payload].slice(-MAX_LOG_LINES));
      }),
      listen<number | null>('host-exited', e => {
        setHostPid(null);
        setServerInfo(null);
        setLogs(prev => [...prev, `[ATLAS] Host exited (code ${e.payload ?? 'unknown'})`]);
      }),
      onServerInfoUpdate(setServerInfo),
    ]);

    return () => { listeners.then(fns => fns.forEach(fn => fn())); };
  }, []);

  async function toggleHost() {
    if (!gameDirectory) return;
    setToggling(true);
    try {
      if (running) {
        await stopHostGame();
      } else {
        setLogs([]);
        setServerInfo(null);
        setHostPid(await startHostGame(gameDirectory));
      }
    } catch (e) {
      console.error(`[Host] Failed to ${running ? 'stop' : 'start'} the host!`, e);
      toast(`Failed to ${running ? 'stop' : 'start'} host: ${e}`, 'error');
    } finally {
      setToggling(false);
    }
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
    }
  }

  return (
    <div className="p-6 h-screen flex flex-col gap-4">
      <div className="flex gap-2">
        <Button size="lg" className="w-40" variant={running ? 'danger' : 'success'} disabled={!gameDirectory} loading={toggling} onClick={toggleHost}>
          {running ? 'Stop' : 'Start'}
        </Button>
        <Button size="lg" className="w-40" disabled={!gameDirectory || running} onClick={() => setInstallOpen(true)}>Install / Update</Button>
        <Button size="lg" className="w-40" disabled={!gameDirectory || running} loading={uninstalling} onClick={() => setUninstallOpen(true)}>Uninstall</Button>
        <div className="ml-auto self-center">
          <StatusIndicator status={status} />
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-[3fr_2fr] gap-4">
        <MatchSettings running={running} />
        <ModuleSkeleton title="Players" className="col-span-2" />
        <Console lines={logs} className="col-span-3" />
      </div>

      <InstallModal open={installOpen} mod="host" gameDirectory={gameDirectory} onClose={() => setInstallOpen(false)} />
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
