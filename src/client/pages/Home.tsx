import { useCallback, useRef, useState } from "react";
import { DeployFrequencyChart } from "../components/DeployFrequencyChart.js";
import { EventTicker } from "../components/EventTicker.js";
import { IncidentBanner } from "../components/IncidentBanner.js";
import { InfraPanel } from "../components/InfraPanel.js";
import { IssuesPanel } from "../components/IssuesPanel.js";
import { ProjectCard } from "../components/ProjectCard.js";
import { StatsStrip } from "../components/StatsStrip.js";
import { SystemClock } from "../components/SystemClock.js";
import { UpcomingCard } from "../components/UpcomingCard.js";
import { useEventLog } from "../hooks/useEventLog.js";
import { useInfra } from "../hooks/useInfra.js";
import { useSSE } from "../hooks/useSSE.js";
import { useStatus } from "../hooks/useStatus.js";
import { useVisits } from "../hooks/useVisits.js";

interface StatusChangePayload {
  slug?: string;
}

export function Home(): JSX.Element {
  const { data, error, loading, refresh } = useStatus();
  const { infra } = useInfra();
  const { data: visits } = useVisits();
  const { events, onEvent: pushEvent } = useEventLog(6);

  // Per-project flash counter. Bumps each time a status_change event for
  // that slug arrives; ProjectCard observes its slug's counter via prop
  // and runs a short pulse animation when the value changes.
  const [flashBySlug, setFlashBySlug] = useState<Record<string, number>>({});
  const flashRef = useRef(flashBySlug);
  flashRef.current = flashBySlug;

  const onSse = useCallback(
    (eventName: string, data: unknown) => {
      pushEvent(eventName, data);
      if (eventName === "status_change") {
        const slug = (data as StatusChangePayload).slug;
        if (typeof slug === "string") {
          setFlashBySlug({ ...flashRef.current, [slug]: (flashRef.current[slug] ?? 0) + 1 });
        }
        refresh();
      }
    },
    [pushEvent, refresh],
  );
  const { connected } = useSSE("/api/stream", onSse);

  return (
    <main className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-12 py-10">
      <header>
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h1 className="font-mono text-3xl tracking-tight text-zinc-900 dark:text-white">
            STATUS BOARD
          </h1>
          <div className="flex items-baseline gap-6">
            <SystemClock uptimeSeconds={infra?.vm.uptimeSeconds ?? null} />
            <LiveIndicator connected={connected} />
          </div>
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
          Five projects on one VM in northcentralus. Health pings every 30s, deploys streamed in
          over webhooks, commits cached hourly.
        </p>
      </header>

      <IncidentBanner />

      <StatsStrip />

      <DeployFrequencyChart />

      <EventTicker events={events} />

      <IssuesPanel />

      {loading && <p className="mt-8 te-label">LOADING...</p>}

      {error !== null && (
        <p role="alert" className="mt-8 te-label text-rose-600 dark:text-rose-400">
          STATUS FETCH FAILED: {error}
        </p>
      )}

      {data !== null && (
        <section className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {data
            .filter((p) => p.status === "live")
            .map((project) => (
              <ProjectCard
                key={project.slug}
                project={project}
                flashKey={flashBySlug[project.slug] ?? 0}
                visit={visits?.find((v) => v.slug === project.slug) ?? null}
              />
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
