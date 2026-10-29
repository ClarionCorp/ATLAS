import { useEffect, useState } from 'react';
import { Button } from '../components/UI/Button';
import { InstallModal } from '../components/InstallModal';
import { getAppSettings, getClientOptions } from '../core/database/queries';

export default function ClientPage() {
  const [gameDirectory, setGameDirectory] = useState<string | null>(null);
  const [modVersion, setModVersion] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);

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

  return (
    <div className="p-6 min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center gap-4">
      <Button size="lg" className="w-64" disabled={!modVersion}>Play</Button>
      <Button size="lg" className="w-64" disabled={!gameDirectory} onClick={() => setInstallOpen(true)}>Install / Update</Button>
      <Button size="lg" className="w-64">Uninstall</Button>
      <InstallModal open={installOpen} mod="client" gameDirectory={gameDirectory} onClose={closeInstall} />
    </div>
  );
}
