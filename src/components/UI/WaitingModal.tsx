import { AnimatePresence, motion } from 'framer-motion';
import { CircleNotchIcon } from '@phosphor-icons/react';

interface WaitingModalProps {
  open: boolean;
  title: string;
  description?: string;
  onDismiss?: () => void;
}

export function WaitingModal({ open, title, description, onDismiss }: WaitingModalProps) {
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
          <div className="absolute inset-0 bg-black/60" onClick={onDismiss} />
          <motion.div
            className="relative z-10 w-80 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl p-5 flex flex-col items-center gap-3 text-center"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <CircleNotchIcon size={28} className="animate-spin text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-100">{title}</span>
            {description && <span className="text-xs text-zinc-500">{description}</span>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
