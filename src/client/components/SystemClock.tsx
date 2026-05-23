import { useEffect, useRef, useState } from "react";

interface Props {
  uptimeSeconds: number | null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatUtc(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}S`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}M`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H ${m % 60}M`;
  const d = Math.floor(h / 24);
  return `${d}D ${h % 24}H`;
}

export function SystemClock({ uptimeSeconds }: Props): JSX.Element {
  const [now, setNow] = useState<number>(() => Date.now());
  // Captured per-mount so tests with fake timers don't see stale offsets.
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    // The seconds counter sliding every tick is part of the "this is live"
    // feel; 1s is intentional even though the cost is a re-render per second.
    const handle = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(handle);
  }, []);

  // Container uptime ticks forward locally so it doesn't freeze between
  // /api/public/infra polls (which run every 30s).
  const localUptime =
    uptimeSeconds === null ? null : uptimeSeconds + (now - mountedAtRef.current) / 1000;

  return (
    <div className="flex items-baseline gap-4 text-zinc-500 dark:text-zinc-400 font-mono text-[11px] tracking-wider">
      <span aria-label="current time UTC">{formatUtc(now)}</span>
      {localUptime !== null && (
        <span aria-label="container uptime">UP {formatUptime(localUptime)}</span>
      )}
    </div>
  );
}
