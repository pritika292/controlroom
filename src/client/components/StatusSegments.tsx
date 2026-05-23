import type { ProjectPing } from "../hooks/useProjectPings.js";

interface Props {
  pings: ProjectPing[];
}

type StatusKey = "up" | "down" | "timeout" | "error";

const ORDER: StatusKey[] = ["up", "timeout", "error", "down"];

const COLOR_CLASS: Record<StatusKey, string> = {
  up: "bg-accent",
  timeout: "bg-amber-500",
  error: "bg-rose-500",
  down: "bg-rose-700",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}S`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}M`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}H ${remM}M` : `${h}H`;
}

// Each ping represents one 30-second polling sample. Multiplying the count
// by 30 gives the approximate time spent in each state, which is what most
// observers care about ("how long was it down").
const SECONDS_PER_PING = 30;

export function StatusSegments({ pings }: Props): JSX.Element {
  if (pings.length === 0) {
    return <p className="te-label">NO PINGS YET</p>;
  }

  const counts: Record<StatusKey, number> = { up: 0, down: 0, timeout: 0, error: 0 };
  for (const p of pings) counts[p.status] += 1;
  const total = pings.length;

  const segments = ORDER.map((k) => ({
    key: k,
    count: counts[k],
    pct: (counts[k] / total) * 100,
    seconds: counts[k] * SECONDS_PER_PING,
  })).filter((s) => s.count > 0);

  return (
    <div>
      {/* Horizontal proportion bar */}
      <div
        className="flex h-3 w-full overflow-hidden border border-zinc-200 dark:border-zinc-800"
        role="img"
        aria-label={`Status split over ${total} pings: ${segments
          .map((s) => `${s.count} ${s.key}`)
          .join(", ")}`}
      >
        {segments.map((s) => (
          <div
            key={s.key}
            className={COLOR_CLASS[s.key] + " h-full"}
            style={{ width: `${s.pct}%` }}
            title={`${s.key}: ${s.count} pings (~${formatDuration(s.seconds)})`}
          />
        ))}
      </div>

      {/* Legend with counts + approximate time */}
      <ul className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
        {ORDER.map((k) => {
          const c = counts[k];
          const enabled = c > 0;
          return (
            <li
              key={k}
              className={
                "flex items-center gap-2 " +
                (enabled ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600")
              }
            >
              <span aria-hidden className={`inline-block h-2 w-2 ${COLOR_CLASS[k]}`} />
              <span className="te-label">{k.toUpperCase()}</span>
              <span className="ml-auto">
                {enabled ? formatDuration(c * SECONDS_PER_PING) : "-"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
