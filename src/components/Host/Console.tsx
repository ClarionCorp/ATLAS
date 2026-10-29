import { useEffect, useRef } from 'react';

interface ConsoleProps {
  lines: string[];
  className?: string;
}

export function Console({ lines, className }: ConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

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

  return (
    <div className={`rounded-xl bg-zinc-900 border border-zinc-800 p-4 flex flex-col gap-3 min-h-0 ${className ?? ''}`}>
      <span className="text-sm font-semibold text-zinc-400">Console</span>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto rounded-lg bg-zinc-950 border border-zinc-800 p-3 font-mono text-xs text-zinc-300 whitespace-pre-wrap break-all"
      >
        {lines.length === 0
          ? <span className="text-zinc-700">Server is offline.</span>
          : lines.map((line, i) => <div key={i}>{line}</div>)
        }
      </div>
    </div>
  );
}
