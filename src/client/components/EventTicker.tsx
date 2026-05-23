import { useEffect, useState } from "react";
import type { LogEvent } from "../hooks/useEventLog.js";
import { relativeTime } from "../lib/relativeTime.js";

interface Props {
  events: LogEvent[];
}

interface StatusChangePayload {
  slug?: string;
  status?: string;
  previous?: string | null;
}

function isStatusChange(name: string, data: unknown): data is StatusChangePayload {
  return name === "status_change" && data !== null && typeof data === "object";
}

function lineFor(e: LogEvent): string {
  if (isStatusChange(e.name, e.data)) {
    const slug = (e.data.slug ?? "?").toUpperCase();
    const status = (e.data.status ?? "?").toUpperCase();
    const prev = e.data.previous ? `${String(e.data.previous).toUpperCase()} → ` : "";
    return `${slug}  ${prev}${status}`;
  }
  if (e.name === "hello") return "SSE CONNECTED";
  return e.name.toUpperCase();
}

export function EventTicker({ events }: Props): JSX.Element {
  // Re-render every second so the "Ns ago" timestamps stay accurate.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(handle);
  }, []);

  return (
    <aside className="te-panel mt-3 p-4 max-h-48 overflow-hidden">
      <header className="flex items-baseline justify-between">
        <p className="te-label">EVENT LOG</p>
        <p className="te-code">SSE</p>
      </header>
      {events.length === 0 ? (
        <p className="mt-3 te-label">WAITING FOR FIRST EVENT...</p>
      ) : (
        <ul className="mt-3 font-mono text-[11px] space-y-1">
          {events.map((e, i) => (
            <li
              key={`${e.ts}-${i}`}
              className={
                "flex items-baseline justify-between gap-3 leading-tight " +
                (i === 0 ? "text-accent" : "text-zinc-500 dark:text-zinc-400")
              }
            >
              <span className="truncate">{lineFor(e)}</span>
              <span className="te-code shrink-0">{relativeTime(e.ts, now).toUpperCase()}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
