import { useLayoutEffect, useRef, useState } from 'react';
import { CaretRightIcon } from '@phosphor-icons/react';
import { sendHostCommand } from '../../core/utilities/launch';

interface ConsoleProps {
  lines: string[];
  running: boolean;
  onLocalLine?: (line: string) => void; // echoes sent commands and errors into the log
  className?: string;
}

// Optional "[2026-10-29 21:24:18] " timestamp, then an optional "[Lua] " tag, then the message
const LINE_PATTERN = /^(\[\d{4}-\d{2}-\d{2} [\d:.]+\]\s*)?(\[Lua\]\s*)?(.*)$/s;

// The message's own leading tag, e.g. "[ATLAS]" or "[AiMi:Host]"
const TAG_PATTERN = /^(\[[^\]]*\])(.*)$/s;

function tagColor(tag: string) {
  if (tag.startsWith('[ATLAS')) return 'text-amber-300';
  if (tag.startsWith('[AiMi')) return 'text-pink-400';
  return 'text-cyan-400';
}

function ConsoleLine({ line }: { line: string }) {
  const [, timestamp, lua, message] = line.match(LINE_PATTERN) ?? [line, undefined, undefined, line];
  const tagged = message.match(TAG_PATTERN);

  return (
    <div>
      {(timestamp || lua) && <span className="text-zinc-500">{timestamp}{lua}</span>}
      {tagged ? (
        <>
          <span className={tagColor(tagged[1])}>{tagged[1]}</span>
          <span className="text-zinc-300">{tagged[2]}</span>
        </>
      ) : (
        // No tag, probably app commands
        <span className="text-cyan-400">{message}</span>
      )}
    </div>
  );
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
  const lastScrollTop = useRef(0);

  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  // Only auto-scroll if the user hasn't scrolled up to read something.
  // Scroll events land after new lines may have grown the content, so "not at the bottom" alone isn't proof the user scrolled.
  // Only an upward move counts. Reaching the bottom again re-enables following.
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 16) {
      stickToBottom.current = true;
    } else if (el.scrollTop < lastScrollTop.current) {
      stickToBottom.current = false;
    }
    lastScrollTop.current = el.scrollTop;
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
      lastScrollTop.current = el.scrollTop;
    }
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
            : lines.map((line, i) => <ConsoleLine key={i} line={line} />)
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
