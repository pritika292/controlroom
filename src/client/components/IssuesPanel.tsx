import { useState } from "react";
import { useIssues, type IssueFilter, type IssueItem } from "../hooks/useIssues.js";
import { relativeTime } from "../lib/relativeTime.js";

// Surfaces the per-project triage queue on the home page. Default tab is
// OPEN — what a recruiter scanning the dashboard cares about. CLOSED + ALL
// are one click away. Each row deep-links to the GitHub issue.
export function IssuesPanel(): JSX.Element {
  const [state, setState] = useState<IssueFilter>("open");
  const { issues, loading, error } = useIssues(null, state);

  return (
    <article className="te-panel p-5 mt-12">
      <header className="flex items-center justify-between gap-3">
        <p className="te-label">RECENT ISSUES</p>
        <TabStrip state={state} onChange={setState} />
      </header>

      {loading && issues.length === 0 ? (
        <p className="mt-3 te-label">LOADING...</p>
      ) : error !== null ? (
        <p className="mt-3 te-label text-rose-500">{error}</p>
      ) : issues.length === 0 ? (
        <p className="mt-3 te-label">NO {state.toUpperCase()} ISSUES</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-900">
            {issues.map((i) => (
              <IssueRow key={`${i.project}#${i.number}`} issue={i} />
            ))}
          </ul>
          {/* If the panel is full there might be more — link out to the
              full triage queue on GitHub (#84). */}
          {issues.length >= 5 && (
            <p className="mt-3 te-label">
              <a
                href="https://github.com/pritika292?tab=projects"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                view all on github →
              </a>
            </p>
          )}
        </>
      )}
    </article>
  );
}

function TabStrip({
  state,
  onChange,
}: {
  state: IssueFilter;
  onChange: (s: IssueFilter) => void;
}): JSX.Element {
  const tabs: IssueFilter[] = ["open", "closed", "all"];
  return (
    <div role="tablist" className="flex items-center gap-3">
      {tabs.map((t) => {
        const active = t === state;
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t)}
            className={
              "te-label transition-colors " +
              (active
                ? "text-accent border-b-2 border-accent pb-0.5"
                : "hover:text-zinc-900 dark:hover:text-white")
            }
          >
            {t.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function IssueRow({ issue }: { issue: IssueItem }): JSX.Element {
  // For OPEN issues "openedAt" is the right anchor; for CLOSED we'd rather
  // show when they were resolved. Falls back to opened if closed_at is null.
  const ts = issue.state === "closed" && issue.closedAt !== null ? issue.closedAt : issue.openedAt;
  return (
    <li className="py-2.5">
      <a href={issue.url} target="_blank" rel="noreferrer" className="block group">
        <p className="text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-accent">
          <span className="font-mono text-zinc-500 dark:text-zinc-400">
            {issue.project}#{issue.number}
          </span>{" "}
          {issue.title}
        </p>
        <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          <StateBadge state={issue.state} />
          <span> / {relativeTime(ts).toUpperCase()}</span>
        </p>
      </a>
    </li>
  );
}

function StateBadge({ state }: { state: "open" | "closed" }): JSX.Element {
  const cls =
    state === "open"
      ? "text-accent"
      : "text-zinc-500 dark:text-zinc-400 line-through decoration-zinc-400/40";
  return <span className={cls}>{state.toUpperCase()}</span>;
}
