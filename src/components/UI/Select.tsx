import { useId, useRef, useState } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';
import { Dropdown } from './Dropdown';
import { cn } from '../../core/styles/theme';

interface SelectProps<T extends string> {
  label?: string;
  value: T | null;
  options: Record<T, string>; // value -> display label
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: T) => void;
  className?: string;
}

export function Select<T extends string>({ label, value, options, placeholder = 'Select...', disabled, onChange, className }: SelectProps<T>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className={cn('flex flex-col', className)}>
      {label && <label htmlFor={id} className="block text-sm font-medium text-zinc-300 mb-1.5">{label}</label>}

      <div className="relative">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className={cn(
            'w-full h-9 px-3 flex items-center justify-between gap-2 text-sm text-left cursor-pointer',
            'bg-zinc-800 border border-zinc-700 rounded-md outline-none',
            'transition-[border-color,box-shadow] duration-200',
            'focus:border-zinc-600',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            open && 'border-zinc-400'
          )}
        >
          <span className={value ? 'text-zinc-100' : 'text-zinc-500'}>{value ? options[value] : placeholder}</span>
          <CaretDownIcon size={14} className={cn('text-zinc-500 transition-transform duration-150', open && 'rotate-180')} />
        </button>

        <Dropdown
          open={open}
          onClose={() => setOpen(false)}
          triggerRef={triggerRef}
          className="w-full max-h-64 overflow-y-auto"
          items={(Object.keys(options) as T[]).map(key => ({
            label: options[key],
            onClick: () => onChange(key),
          }))}
        />
      </div>
    </div>
  );
}
