import { useEffect, useRef, useState } from 'react';
import { CaretRightIcon } from '@phosphor-icons/react';
import { sendHostCommand } from '../../core/utilities/launch';

interface ConsoleProps {
  lines: string[];
  running: boolean;
  onLocalLine?: (line: string) => void; // echoes sent commands and errors into the log
  className?: string;
}

// Splits on whitespace, keeping "quoted args" or 'quoted args' together
function parseCommand(input: string) {
  const tokens = [...input.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3]);
  const [command, ...args] = tokens;
  return { command, args };
}

export function Console({ lines, running, onLocalLine, className }: ConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  // Only auto-scroll if the user hasn't scrolled up to read something
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 16;
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  async function submit() {
    const text = input.trim();
    if (!text) return;

    const { command, args } = parseCommand(text);
    setInput('');
    setHistory(prev => [...prev, text]);
    setHistoryIndex(null);
    stickToBottom.current = true;

    try {
      const id = await sendHostCommand(command, args);
      onLocalLine?.(`> ${text}  [#${id}]`);
    } catch (e) {
      console.error(`[Console] Failed to send command!`, e);
      onLocalLine?.(`> ${text}  [failed: ${e}]`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'ArrowUp' && history.length > 0) {
      e.preventDefault();
      const next = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next]);
    } else if (e.key === 'ArrowDown' && historyIndex !== null) {
      e.preventDefault();
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(null);
        setInput('');
      } else {
        setHistoryIndex(next);
        setInput(history[next]);
      }
    }
  }

  return (
    <div className={`rounded-xl bg-zinc-900 border border-zinc-800 p-4 flex flex-col gap-3 min-h-0 ${className ?? ''}`}>
      <span className="text-sm font-semibold text-zinc-400">Console</span>
      <div className="flex-1 min-h-0 flex flex-col rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-xs text-zinc-300 whitespace-pre-wrap break-all"
        >
          {lines.length === 0
            ? <span className="text-zinc-700">Server is offline.</span>
            : lines.map((line, i) => <div key={i}>{line}</div>)
          }
        </div>

        <div className="flex items-center gap-2 border-t border-zinc-800 px-3">
          <CaretRightIcon size={12} className="text-zinc-600 shrink-0" />
          <input
            value={input}
            disabled={!running}
            placeholder={running ? 'Type a command and press Enter...' : 'Start the host to send commands'}
            onChange={e => { setInput(e.target.value); setHistoryIndex(null); }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="flex-1 h-8 bg-transparent font-mono text-xs text-zinc-100 placeholder:text-zinc-600 outline-none disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  );
}
