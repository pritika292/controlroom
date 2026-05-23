import { useCallback } from "react";
import { IncidentBanner } from "../components/IncidentBanner.js";
import { InfraPanel } from "../components/InfraPanel.js";
import { ProjectCard } from "../components/ProjectCard.js";
import { StatsStrip } from "../components/StatsStrip.js";
import { UpcomingCard } from "../components/UpcomingCard.js";
import { useSSE } from "../hooks/useSSE.js";
import { useStatus } from "../hooks/useStatus.js";

export function Home(): JSX.Element {
  const { data, error, loading, refresh } = useStatus();

  const onEvent = useCallback(
    (eventName: string) => {
      if (eventName === "status_change") refresh();
    },
    [refresh],
  );
  const { connected } = useSSE("/api/stream", onEvent);

  return (
    <main className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
      <header>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-mono text-3xl tracking-tight text-zinc-900 dark:text-white">
            STATUS BOARD
          </h1>
          <LiveIndicator connected={connected} />
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
          Eleven projects on one VM in northcentralus. Health pings every 30s, deploys streamed in
          over webhooks, commits cached hourly.
        </p>
      </header>

      <IncidentBanner />

      <StatsStrip />

      {loading && <p className="mt-8 te-label">LOADING...</p>}

      {error !== null && (
        <p role="alert" className="mt-8 te-label text-rose-600 dark:text-rose-400">
          STATUS FETCH FAILED: {error}
        </p>
      )}

      {data !== null && (
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data
            .filter((p) => p.status === "live")
            .map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          <UpcomingCard planned={data.filter((p) => p.status === "planned")} />
        </section>
      )}

      <InfraPanel />
    </main>
  );
}

function LiveIndicator({ connected }: { connected: boolean }): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-2 te-label"
      aria-label={connected ? "live updates connected" : "live updates disconnected"}
    >
      <span
        aria-hidden
        className={
          "inline-block h-2 w-2 " + (connected ? "bg-accent" : "bg-zinc-400 dark:bg-zinc-600")
        }
      />
      {connected ? "LIVE" : "OFFLINE"}
    </span>
  );
}
