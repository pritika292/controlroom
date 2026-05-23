import { useProjectCommits, type CommitItem } from "../hooks/useProjectCommits.js";
import { relativeTime } from "../lib/relativeTime.js";

interface Props {
  slug: string;
  repo: string;
}

function commitUrl(repo: string, sha: string): string {
  return `https://github.com/${repo}/commit/${sha}`;
}

export function CommitsPanel({ slug, repo }: Props): JSX.Element {
  const { commits, loading, error } = useProjectCommits(slug);

  return (
    <article className="te-panel p-5">
      <p className="te-label">RECENT COMMITS</p>
      {loading && commits.length === 0 ? (
        <p className="mt-3 te-label">LOADING...</p>
      ) : error !== null ? (
        <p className="mt-3 te-label text-rose-500">{error}</p>
      ) : commits.length === 0 ? (
        <p className="mt-3 te-label">NO COMMITS CACHED YET</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-900">
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
        <p className="text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-accent">
          {commit.message}
        </p>
        <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          {commit.sha.slice(0, 7)}
          {commit.author !== null && <span> / {commit.author}</span>}
          <span> / {relativeTime(commit.ts).toUpperCase()}</span>
        </p>
      </a>
    </li>
  );
}
