import { useDeployFrequency } from "../hooks/useDeployFrequency.js";

function dayLabel(iso: string): string {
  // Render the last 3 chars of the ISO date, "23" from "2026-05-23".
  return iso.slice(-2);
}

export function DeployFrequencyChart(): JSX.Element {
  const { data, loading, error } = useDeployFrequency();

  // Reserve vertical space while loading so the layout doesn't jump.
  if (data === null) return <div className="mt-3 te-panel p-5 h-40" aria-hidden />;

  const max = Math.max(1, ...data.buckets.map((b) => b.count));

  return (
    <article className="mt-3 te-panel p-5">
      <header className="flex items-baseline justify-between">
        <p className="te-label">DEPLOYS / LAST {data.days} DAYS</p>
        <p className="te-code">
          {data.total} TOTAL / {(data.total / data.days).toFixed(1)} PER DAY
        </p>
      </header>

      {error !== null ? (
        <p className="mt-3 te-label text-rose-500">{error}</p>
      ) : (
        <div className="mt-4">
          {/* Bars + day labels. We use a CSS grid so all bars share the same
              column width and align cleanly under their labels. */}
          <div
            className="grid items-end gap-1 h-24"
            style={{ gridTemplateColumns: `repeat(${data.buckets.length}, minmax(0, 1fr))` }}
          >
            {data.buckets.map((b) => {
              const heightPct = (b.count / max) * 100;
              const empty = b.count === 0;
              const title = `${b.date}: ${b.count} deploy${b.count === 1 ? "" : "s"}`;
              return (
                <div
                  key={b.date}
                  className={
                    "relative w-full h-full flex items-end transition-all duration-500 " +
                    (empty ? "" : "")
                  }
                  title={title}
                >
                  <div
                    aria-label={title}
                    className={
                      "w-full transition-all duration-500 " +
                      (empty ? "bg-zinc-200 dark:bg-zinc-800" : "bg-accent")
                    }
                    style={{ height: empty ? "2px" : `${Math.max(heightPct, 6)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div
            className="mt-1 grid gap-1 font-mono text-[9px] text-zinc-500 dark:text-zinc-400"
            style={{ gridTemplateColumns: `repeat(${data.buckets.length}, minmax(0, 1fr))` }}
            aria-hidden
          >
            {data.buckets.map((b) => (
              <span key={b.date} className="text-center">
                {dayLabel(b.date)}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && data === null && <p className="mt-3 te-label">LOADING...</p>}
    </article>
  );
}
