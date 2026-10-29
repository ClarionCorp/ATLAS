import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from './UI/Button';
import { ProgressBar } from './UI/ProgressBar';
import { getInstalledModVersion, installMod, isUE4SSInstalled, MODS, type ModId } from '../core/utilities/ue4ss';

interface InstallModalProps {
  open: boolean;
  mod: ModId;
  gameDirectory: string | null;
  onClose: () => void;
}

type Status = { ue4ss: boolean; modVersion: string | null };

export function InstallModal({ open, mod, gameDirectory, onClose }: InstallModalProps) {
  const [status, setStatus] = useState<Status | null>(null);
  const [progress, setProgress] = useState<{ percent: number | null; message: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { name: modName, version: bundledVersion } = MODS[mod];

  async function refreshStatus(dir: string) {
    setStatus({ ue4ss: await isUE4SSInstalled(dir), modVersion: await getInstalledModVersion(dir, mod) });
  }

  useEffect(() => {
    if (!open || !gameDirectory) return;
    setProgress(null);
    setError(null);
    refreshStatus(gameDirectory).catch(e => setError(String(e)));
  }, [open, gameDirectory, mod]);

  async function install() {
    if (!gameDirectory) return;
    setRunning(true);
    setError(null);
    try {
      await installMod(gameDirectory, mod, (_, percent, message) => setProgress({ percent, message }));
      await refreshStatus(gameDirectory);
    } catch (e) {
      console.error(`[UE4SS] Install failed!`, e);
      setError(String(e));
      setProgress(null);
    } finally {
      setRunning(false);
    }
  }

  const upToDate = status?.ue4ss && status.modVersion === bundledVersion;
  const actionLabel = !status?.ue4ss || !status.modVersion ? 'Install' : upToDate ? 'Up to date' : 'Update';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/60" onClick={() => !running && onClose()} />
          <motion.div
            className="relative z-10 w-1/2 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl p-5 flex flex-col gap-4"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="text-lg font-semibold text-zinc-100">Install / Update</span>

            <div className="flex flex-col gap-1 text-md">
              <div className="flex justify-between">
                <span className="text-zinc-500">UE4SS</span>
                <span className="text-zinc-300">{status ? (status.ue4ss ? 'Installed' : 'Not installed') : 'Checking...'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">{modName}</span>
                <span className="text-zinc-300">
                  {status ? (status.modVersion ? `v${status.modVersion}` : 'Not installed') : 'Checking...'}
                </span>
              </div>
            </div>

            {progress && <ProgressBar percent={progress.percent} message={progress.message} />}
            {error && <span className="text-xs text-red-500">{error}</span>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="md" disabled={running} onClick={onClose}>Close</Button>
              <Button size="md" loading={running} disabled={!status || upToDate} onClick={install}>{actionLabel}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
