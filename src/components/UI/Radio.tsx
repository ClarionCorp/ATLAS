'use client';

import { cn } from '../../core/styles/theme';

interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface RadioGroupProps<T extends string> {
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <div className={cn(
      'size-4 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center',
      selected ? 'border-zinc-200' : 'border-zinc-500'
    )}>
      {selected && <div className="size-1.5 rounded-full bg-zinc-200" />}
    </div>
  );
}

export function RadioGroup<T extends string>({ options, value, onChange, disabled }: RadioGroupProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          className={cn(
            'flex items-center gap-3.5 p-3.5 rounded-xl border transition-all text-left cursor-pointer',
            value === opt.value
              ? 'bg-zinc-200/10 border-zinc-200/40'
              : 'bg-zinc-800 border-zinc-700 hover:border-zinc-200/20 hover:bg-zinc-700/60',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {opt.icon && (
            <div className={cn(
              'size-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
              value === opt.value ? 'bg-zinc-200/20 text-zinc-200' : 'bg-zinc-900 text-zinc-500'
            )}>
              {opt.icon}
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-100">{opt.label}</p>
            {opt.description && <p className="text-xs text-zinc-500 mt-0.5">{opt.description}</p>}
          </div>
          <RadioDot selected={value === opt.value} />
        </button>
      ))}
    </div>
  );
}