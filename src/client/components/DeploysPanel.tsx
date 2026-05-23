import { useProjectDeploys, type DeployItem } from "../hooks/useProjectDeploys.js";
import { relativeTime } from "../lib/relativeTime.js";

interface Props {
  slug: string;
}

function statusClass(status: DeployItem["status"]): string {
  if (status === "success") return "text-accent border-accent";
  if (status === "in_progress" || status === "queued") return "text-sky-600 border-sky-500";
  if (status === "cancelled") return "text-zinc-500 border-zinc-400";
  return "text-rose-600 border-rose-500";
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}S`;
  return `${Math.floor(s / 60)}M ${s % 60}S`;
}

export function DeploysPanel({ slug }: Props): JSX.Element {
  const { deploys, loading, error } = useProjectDeploys(slug);

  return (
    <article className="te-panel p-5">
      <p className="te-label">RECENT DEPLOYS</p>
      {loading && deploys.length === 0 ? (
        <p className="mt-3 te-label">LOADING...</p>
      ) : error !== null ? (
        <p className="mt-3 te-label text-rose-500">{error}</p>
      ) : deploys.length === 0 ? (
        <p className="mt-3 te-label">NO DEPLOYS YET</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-900">
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
        <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
          {deploy.sha.slice(0, 7)}
        </span>
        <span
          className={`inline-block px-2 py-0.5 border text-[10px] uppercase ${statusClass(deploy.status)}`}
        >
          {deploy.status}
        </span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        {deploy.actor !== null && <span>{deploy.actor} / </span>}
        {relativeTime(deploy.startedAt).toUpperCase()} / {formatDuration(deploy.durationMs)}
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
