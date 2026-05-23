import { useProjectCommits, type CommitItem } from "../hooks/useProjectCommits.js";
import { relativeTime } from "../lib/relativeTime.js";

interface Props {
  slug: string;
  repo: string; // "pritika292/<slug>"
}

function commitUrl(repo: string, sha: string): string {
  return `https://github.com/${repo}/commit/${sha}`;
}

export function CommitsPanel({ slug, repo }: Props): JSX.Element {
  const { commits, loading, error } = useProjectCommits(slug);

  return (
    <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">Recent commits</h3>
      {loading && commits.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      ) : error !== null ? (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : commits.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          No commits cached yet. The sync worker runs hourly.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
          {commits.map((c) => (
            <CommitRow key={c.sha} repo={repo} commit={c} />
          ))}
        </ul>
      )}
    </article>
  );
}

function CommitRow({ repo, commit }: { repo: string; commit: CommitItem }): JSX.Element {
  return (
    <li className="py-2.5">
      <a
        href={commitUrl(repo, commit.sha)}
        target="_blank"
        rel="noreferrer"
        className="block group"
      >
        <p className="text-sm text-slate-900 dark:text-slate-100 group-hover:underline">
          {commit.message}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono">{commit.sha.slice(0, 7)}</span>
          {commit.author !== null && <span> by {commit.author}</span>}
          <span> &middot; {relativeTime(commit.ts)}</span>
        </p>
      </a>
    </li>
  );
}
