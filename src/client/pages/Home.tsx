import { useCallback } from "react";
import { ProjectCard } from "../components/ProjectCard.js";
import { useSSE } from "../hooks/useSSE.js";
import { useStatus } from "../hooks/useStatus.js";

export function Home(): JSX.Element {
  const { data, error, loading, refresh } = useStatus();

  // When the server reports a status flip, refetch the status board so the
  // dot color and "last seen" timestamp update right away rather than on
  // the next 5s polling tick.
  const onEvent = useCallback(
    (eventName: string) => {
      if (eventName === "status_change") refresh();
    },
    [refresh],
  );
  const { connected } = useSSE("/api/stream", onEvent);

  return (
    <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
      <header>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            controlroom
          </h1>
          <LiveIndicator connected={connected} />
        </div>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
          Live status across every project in the portfolio.
        </p>
      </header>

      {loading && <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">Loading...</p>}

      {error !== null && (
        <p role="alert" className="mt-8 text-sm text-rose-600 dark:text-rose-400">
          Could not load status: {error}
        </p>
      )}

      {data !== null && (
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </section>
      )}
    </main>
  );
}

function LiveIndicator({ connected }: { connected: boolean }): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
      aria-label={connected ? "live updates connected" : "live updates disconnected"}
    >
      <span
        aria-hidden
        className={
          "inline-block h-2 w-2 rounded-full " + (connected ? "bg-emerald-500" : "bg-slate-400")
        }
      />
      {connected ? "live" : "reconnecting"}
    </span>
  );
}
