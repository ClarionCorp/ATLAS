import { useEffect, useState } from 'react';
import { Button } from '../components/UI/Button';
import { InstallModal } from '../components/InstallModal';
import { getAppSettings } from '../core/database/queries';

export default function ClientPage() {
  const [gameDirectory, setGameDirectory] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);

  useEffect(() => {
    getAppSettings().then(settings => setGameDirectory(settings?.gameDirectory ?? null));
  }, []);

  return (
    <div className="p-6 min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center gap-4">
      <Button size="lg" className="w-64">Play</Button>
      <Button size="lg" className="w-64" disabled={!gameDirectory} onClick={() => setInstallOpen(true)}>Install / Update</Button>
      <Button size="lg" className="w-64">Uninstall</Button>
      <InstallModal open={installOpen} mod="client" gameDirectory={gameDirectory} onClose={() => setInstallOpen(false)} />
    </div>
  );
}
