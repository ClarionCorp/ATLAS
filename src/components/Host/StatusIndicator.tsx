import { Server } from '../../types/server';

const dotStyles: Record<Server.Status, string> = {
  ONLINE: 'bg-green-500 shadow-[0_0_8px] shadow-green-500/60',
  STARTING: 'bg-amber-400 animate-pulse',
  OFFLINE: 'bg-red-500',
};

export function StatusIndicator({ status }: { status: Server.Status }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2.5 rounded-full ${dotStyles[status]}`} />
      <span className="text-sm font-semibold tracking-wide text-zinc-300">{status}</span>
    </div>
  );
}
