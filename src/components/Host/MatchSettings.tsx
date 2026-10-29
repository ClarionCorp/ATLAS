import { useEffect, useRef, useState } from 'react';
import { Input, Textarea } from '../UI/Input';
import { Select } from '../UI/Select';
import { useToast } from '../UI/Toast';
import { getHostOptions, upsertHostOptions } from '../../core/database/queries';
import { MAP_NAMES, MODE_NAMES } from '../../core/objects/game';
import { Map, Mode } from '../../types/game';

const SAVE_DELAY = 400;

const NUMBER_FIELDS = [
  { key: 'maxFps', label: 'Max FPS' },
  { key: 'minPlayers', label: 'Min Players' },
  { key: 'maxSets', label: 'Max Sets' },
  { key: 'maxRounds', label: 'Max Rounds' },
] as const;

type NumberField = typeof NUMBER_FIELDS[number]['key'];

// Numbers are kept as strings while editing so the inputs can be cleared mid-typing
type Form = Record<NumberField, string> & {
  mapId: Map | null;
  queueId: Mode | null;
  additionalOpts: string;
};

const parsePositiveInt = (value: string) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function MatchSettings({ running, className }: { running: boolean; className?: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    // Fallbacks mirror the schema defaults for when the row doesn't exist yet
    getHostOptions().then(options => setForm({
      maxFps: String(options?.maxFps ?? 768),
      minPlayers: String(options?.minPlayers ?? 6),
      maxSets: String(options?.maxSets ?? 3),
      maxRounds: String(options?.maxRounds ?? 3),
      mapId: (options?.mapId as Map | null) ?? null,
      queueId: (options?.queueId as Mode | null) ?? null,
      additionalOpts: options?.additionalOpts ?? '',
    }));
  }, []);

  // Save on modify, debounced so typing doesn't write on every keystroke
  useEffect(() => {
    if (!form) return;
    if (!loaded.current) {
      loaded.current = true;
      return;
    }

    const timer = setTimeout(() => {
      const numbers: Partial<Record<NumberField, number>> = {};
      for (const { key } of NUMBER_FIELDS) {
        const n = parsePositiveInt(form[key]);
        if (n !== null) numbers[key] = n;
      }

      upsertHostOptions({
        ...numbers,
        mapId: form.mapId,
        queueId: form.queueId,
        additionalOpts: form.additionalOpts.trim() || null,
      }).catch(e => {
        console.error(`[Host] Failed to save match settings!`, e);
        toast(`Failed to save match settings: ${e}`, 'error');
      });
    }, SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [form]);

  const update = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm(prev => prev && { ...prev, [key]: value });

  return (
    <div className={`rounded-xl bg-zinc-900 border border-zinc-800 p-4 flex flex-col gap-3 min-h-0 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-400">Match Settings</span>
        {running && <span className="text-xs text-zinc-500">Changes apply on next start</span>}
      </div>

      {form && (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <Select label="Map" value={form.mapId} options={MAP_NAMES} onChange={v => update('mapId', v)} />
              <Select label="Queue" value={form.queueId} options={MODE_NAMES} onChange={v => update('queueId', v)} />
            </div>

            {NUMBER_FIELDS.map(({ key, label }) => (
              <Input
                key={key}
                type="number"
                min={1}
                label={label}
                value={form[key]}
                error={parsePositiveInt(form[key]) === null ? 'Must be a positive number' : undefined}
                onChange={e => update(key, e.target.value)}
              />
            ))}
          </div>

          <Textarea
            label="Additional Launch Options"
            value={form.additionalOpts}
            placeholder="-example -flags"
            onChange={e => update('additionalOpts', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
