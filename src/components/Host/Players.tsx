import { UserIcon } from '@phosphor-icons/react';
import { Server } from '../../types/server';

interface PlayersProps {
  players: Server.Players[];
  className?: string;
}

export function Players({ players, className }: PlayersProps) {
  return (
    <div className={`rounded-xl bg-zinc-900 border border-zinc-800 p-4 flex flex-col gap-3 min-h-0 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-400">Players</span>
      </div>

      {players.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-zinc-700">No players connected.</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 xl:grid-cols-3 auto-rows-min gap-2 pr-1">
          {players.map(player => (
            <div key={player.playerId} className="flex items-center gap-3 rounded-lg bg-zinc-800/60 border border-zinc-800 px-3 py-2">
              <div className="size-8 shrink-0 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400">
                <UserIcon size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm text-zinc-100 truncate">{player.username}</span>
                {/* JSON columns come back with joinedAt as a string */}
                <span className="text-xs text-zinc-500">Joined {new Date(player.joinedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
