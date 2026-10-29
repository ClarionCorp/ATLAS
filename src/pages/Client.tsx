import { useEffect, useState } from 'react';
import { Button } from '../components/UI/Button';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import { useToast } from '../components/UI/Toast';
import { InstallModal } from '../components/InstallModal';
import { getAppSettings, getClientOptions } from '../core/database/queries';
import { uninstallUE4SS } from '../core/utilities/ue4ss';

export default function ClientPage() {
  const { toast } = useToast();
  const [gameDirectory, setGameDirectory] = useState<string | null>(null);
  const [modVersion, setModVersion] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);

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

  return (
    <div className="p-6 min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center gap-4">
      <Button size="lg" className="w-64" disabled={!modVersion}>Play</Button>
      <Button size="lg" className="w-64" disabled={!gameDirectory} onClick={() => setInstallOpen(true)}>Install / Update</Button>
      <Button size="lg" className="w-64" disabled={!gameDirectory} loading={uninstalling} onClick={() => setUninstallOpen(true)}>Uninstall</Button>
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
