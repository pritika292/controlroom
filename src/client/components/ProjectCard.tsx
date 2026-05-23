import { useEffect, useState } from "react";
import { Sparkline } from "./Sparkline.js";
import { StatusDot } from "./StatusDot.js";
import { useProjectPings } from "../hooks/useProjectPings.js";
import { relativeTime } from "../lib/relativeTime.js";
import type { ProjectStatus } from "../hooks/useStatus.js";

interface Props {
  project: ProjectStatus;
}

function lastSeenLabel(project: ProjectStatus, now: number): string {
  if (project.status === "planned") return "planned";
  if (project.lastPingAt === null) return "no pings yet";
  return relativeTime(new Date(project.lastPingAt).getTime(), now);
}

export function ProjectCard({ project }: Props): JSX.Element {
  // Only fetch pings for live projects; planned ones get an empty sparkline.
  const { pings } = useProjectPings(project.status === "live" ? project.slug : null);

  // Re-render every second so "3s ago" stays accurate without a server roundtrip.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(handle);
  }, []);

  const isPlanned = project.status === "planned";

  return (
    <article
      className={
        "rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 transition-opacity " +
        (isPlanned ? "opacity-60" : "")
      }
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <StatusDot project={project} />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{project.name}</h3>
        </div>
        {isPlanned && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            planned
          </span>
        )}
      </header>

      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {lastSeenLabel(project, now)}
        {project.latencyMs !== null && project.status === "live" && (
          <span className="ml-2">({project.latencyMs} ms)</span>
        )}
      </div>

      <div className="mt-4">
        <Sparkline pings={pings} width={240} height={28} />
      </div>
    </article>
  );
}
