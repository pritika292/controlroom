import type { ProjectStatus } from "../hooks/useStatus.js";

interface Props {
  planned: ProjectStatus[];
}

// One card that stands in for every planned project. Better than ten dashed
// boxes because (a) the empty grid was reading as vaporware bingo and
// (b) the page now leads with shortlive, which is the project that's
// actually live.
export function UpcomingCard({ planned }: Props): JSX.Element | null {
  if (planned.length === 0) return null;
  return (
    <article className="te-panel border-dashed p-4 text-zinc-500 dark:text-zinc-500">
      <header className="flex items-center justify-between gap-3">
        <span className="te-code">UPCOMING</span>
        <span className="te-label">{planned.length}</span>
      </header>

      <h3 className="mt-3 font-mono text-lg text-zinc-600 dark:text-zinc-400">more in the works</h3>

      <p className="mt-1 te-label">SHIPPING NEXT</p>

      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px]">
        {planned.map((p) => (
          <li key={p.slug} className="flex items-baseline gap-1.5 leading-tight">
            <span className="text-zinc-400 dark:text-zinc-600 text-[10px]">{p.code}</span>
            <span className="text-zinc-600 dark:text-zinc-400 truncate">{p.name}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
