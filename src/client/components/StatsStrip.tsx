import { useStats } from "../hooks/useStats.js";

export function StatsStrip(): JSX.Element {
  const { stats } = useStats();

  if (stats === null) return <div className="mt-6 h-14" aria-hidden />;

  return (
    <dl className="mt-6 grid grid-cols-3 te-panel divide-x divide-zinc-200 dark:divide-zinc-800">
      <Stat label="PROJECTS LIVE" value={`${stats.projectsLive}/${stats.projectsTotal}`} />
      <Stat label="DEPLOYS / 7D" value={stats.deploysLastWeek} />
      <Stat label="COMMITS CACHED" value={stats.commitsCached} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="px-4 py-3">
      <dt className="te-label">{label}</dt>
      <dd className="mt-1 font-mono text-3xl text-zinc-900 dark:text-white">{value}</dd>
    </div>
  );
}
