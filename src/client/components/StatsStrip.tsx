import { useStats } from "../hooks/useStats.js";

export function StatsStrip(): JSX.Element {
  const { stats } = useStats();

  // Don't render the strip until the first response arrives, otherwise it
  // flashes "0 / 0 / 0" before the real numbers land.
  if (stats === null) {
    return <div className="mt-6 h-10" aria-hidden />;
  }

  return (
    <dl className="mt-6 grid grid-cols-3 gap-4 max-w-2xl">
      <Stat label="Projects live" value={`${stats.projectsLive} / ${stats.projectsTotal}`} />
      <Stat label="Deploys this week" value={stats.deploysLastWeek} />
      <Stat label="Commits cached" value={stats.commitsCached} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}
