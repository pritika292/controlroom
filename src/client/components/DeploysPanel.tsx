import { useProjectDeploys, type DeployItem } from "../hooks/useProjectDeploys.js";
import { relativeTime } from "../lib/relativeTime.js";

interface Props {
  slug: string;
}

function statusClass(status: DeployItem["status"]): string {
  if (status === "success")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (status === "in_progress" || status === "queued")
    return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
  if (status === "cancelled")
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function DeploysPanel({ slug }: Props): JSX.Element {
  const { deploys, loading, error } = useProjectDeploys(slug);

  return (
    <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">Recent deploys</h3>
      {loading && deploys.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      ) : error !== null ? (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : deploys.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          No deploys yet. Webhooks land here when the deploy workflow runs.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
          {deploys.map((d) => (
            <DeployRow key={`${d.sha}-${d.startedAt}`} deploy={d} />
          ))}
        </ul>
      )}
    </article>
  );
}

function DeployRow({ deploy }: { deploy: DeployItem }): JSX.Element {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
          {deploy.sha.slice(0, 7)}
        </span>
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(deploy.status)}`}
        >
          {deploy.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {deploy.actor !== null && <span>{deploy.actor} &middot; </span>}
        {relativeTime(deploy.startedAt)} &middot; {formatDuration(deploy.durationMs)}
      </p>
    </>
  );

  return (
    <li className="py-2.5">
      {deploy.runUrl !== null ? (
        <a href={deploy.runUrl} target="_blank" rel="noreferrer" className="block hover:opacity-80">
          {content}
        </a>
      ) : (
        <div>{content}</div>
      )}
    </li>
  );
}
