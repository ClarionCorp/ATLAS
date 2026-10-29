import { Button } from '../components/UI/Button';

export default function ClientPage() {

  return (
    <div className="p-6 min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center gap-4">
      <Button size="lg" className="w-64">Play</Button>
      <Button size="lg" className="w-64">Install / Update</Button>
      <Button size="lg" className="w-64">Uninstall</Button>
    </div>
  );
}
