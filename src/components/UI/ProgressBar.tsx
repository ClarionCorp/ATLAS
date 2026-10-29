import { motion } from 'framer-motion';
import { cn } from '../../core/styles/theme';

type ProgressBarProps = {
  percent: number | null;
  message?: string;
  indeterminateLabel?: string;
  barClassName?: string;
};

export function ProgressBar({ percent, message, indeterminateLabel = 'This may take a moment...', barClassName }: ProgressBarProps) {
  const isIndeterminate = percent === null;

  return (
    <div className="flex flex-col gap-2">
      {(message || percent !== null) && (
        <div className="flex items-center justify-between">
          {message && <p className="text-xs text-zinc-500">{message}</p>}
          {percent !== null && (
            <p className="text-xs text-zinc-500 tabular-nums ml-auto">{percent}%</p>
          )}
        </div>
      )}

      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full bg-zinc-200', barClassName)}
          animate={{ width: `${percent ?? 0}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {isIndeterminate && indeterminateLabel && (
        <p className="text-xs text-zinc-500/60 italic">{indeterminateLabel}</p>
      )}
    </div>
  );
}