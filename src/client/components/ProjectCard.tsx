import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkline } from "./Sparkline.js";
import { StatusDot } from "./StatusDot.js";
import { useProjectPings } from "../hooks/useProjectPings.js";
import { relativeTime } from "../lib/relativeTime.js";
import type { ProjectStatus } from "../hooks/useStatus.js";

interface Props {
  project: ProjectStatus;
}

function lastSeenLabel(project: ProjectStatus, now: number): string {
  if (project.status === "planned") return project.eta ?? "PLANNED";
  if (project.lastPingAt === null) return "NO PINGS YET";
  return relativeTime(new Date(project.lastPingAt).getTime(), now).toUpperCase();
}

export function ProjectCard({ project }: Props): JSX.Element {
  const { pings } = useProjectPings(project.status === "live" ? project.slug : null);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(handle);
  }, []);

  const isPlanned = project.status === "planned";

  const inner = (
    <article
      className={
        "te-panel p-4 transition-colors " +
        (isPlanned ? "border-dashed text-zinc-400 dark:text-zinc-600" : "hover:border-accent")
      }
    >
      <header className="flex items-center justify-between gap-3">
        <span className="te-code">{project.code}</span>
        <StatusDot project={project} />
      </header>

      <h3
        className={
          "mt-3 font-mono text-lg " +
          (isPlanned ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-900 dark:text-white")
        }
      >
        {project.name}
      </h3>

      <div className="mt-1 te-label">
        {lastSeenLabel(project, now)}
        {project.latencyMs !== null && project.status === "live" && (
          <span className="ml-2 normal-case tracking-normal font-mono">{project.latencyMs}MS</span>
        )}
      </div>

      <div className="mt-4">
        <Sparkline pings={pings} width={280} height={28} />
      </div>
    </article>
  );

  // Planned projects don't link anywhere yet; live projects open the detail page.
  if (isPlanned) return inner;
  return (
    <Link to={`/p/${project.slug}`} className="block">
      {inner}
    </Link>
  );
}
