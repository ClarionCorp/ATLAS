import { AnimatePresence, motion } from 'framer-motion';
import { Button } from './Button';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ open, title, description, confirmLabel = 'Confirm', onConfirm, onCancel }: ConfirmModalProps) {
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
          <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
          <motion.div
            className="relative z-10 w-1/3 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl p-5 flex flex-col gap-4"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex flex-col gap-1">
              <span className="text-md font-semibold text-zinc-100">{title}</span>
              <span className="text-sm text-zinc-500">{description}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="md" onClick={onCancel}>Cancel</Button>
              <Button variant="danger" size="md" onClick={onConfirm}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
