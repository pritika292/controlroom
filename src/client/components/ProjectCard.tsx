import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkline } from "./Sparkline.js";
import { StatusDot } from "./StatusDot.js";
import { VisitTile } from "./VisitTile.js";
import { useProjectPings } from "../hooks/useProjectPings.js";
import { relativeTime } from "../lib/relativeTime.js";
import type { ProjectStatus } from "../hooks/useStatus.js";
import type { VisitAggregate } from "../hooks/useVisits.js";

interface Props {
  project: ProjectStatus;
  // Bumped by the parent whenever an SSE status_change event mentions this
  // project. When it bumps, the card runs a brief pulse animation.
  flashKey?: number;
  // This-week visit count for the project, surfaced as a small tile under
  // the latency line. Null while loading or for projects with no beacon yet.
  visit?: VisitAggregate | null;
}

function lastSeenLabel(project: ProjectStatus, now: number): string {
  if (project.status === "planned") return project.eta ?? "PLANNED";
  if (project.lastPingAt === null) return "NO PINGS YET";
  return relativeTime(new Date(project.lastPingAt).getTime(), now).toUpperCase();
}

const FLASH_DURATION_MS = 900;

export function ProjectCard({ project, flashKey, visit = null }: Props): JSX.Element {
  const { pings } = useProjectPings(project.status === "live" ? project.slug : null);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(handle);
  }, []);

  // When flashKey bumps, paint a brief accent ring + bg tint, then unpaint.
  const [flashing, setFlashing] = useState(false);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setFlashing(true);
    const handle = setTimeout(() => setFlashing(false), FLASH_DURATION_MS);
    return () => clearTimeout(handle);
  }, [flashKey]);

  const isPlanned = project.status === "planned";

  const inner = (
    <article
      className={
        "relative te-panel p-4 transition-colors duration-700 " +
        (isPlanned ? "border-dashed text-zinc-400 dark:text-zinc-600" : "hover:border-accent ") +
        // Live cards get a slow breathing border so the "this is clickable"
        // affordance is unmissable. Suppressed while a flash is active (the
        // flash already shows a solid accent border + tint).
        (!isPlanned && !flashing ? " te-breathe" : "") +
        (flashing ? " border-accent bg-accent/5 dark:bg-accent/10" : "")
      }
    >
      <header className="flex items-center justify-between gap-3">
        <span className="te-code">{project.code}</span>
        <StatusDot project={project} />
      </header>

      <h3
        className={
          "mt-3 font-mono text-xl " +
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

      {!isPlanned && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <VisitTile entry={visit} />
          {/* Inline click affordance (#85). Subtle by default, brightens
              to a solid accent on hover. */}
          <span className="te-label text-accent/70 group-hover:text-accent">
            open status page →
          </span>
        </div>
      )}
    </article>
  );

  // Planned projects don't link anywhere yet; live projects open the detail page.
  if (isPlanned) return inner;
  return (
    <Link to={`/p/${project.slug}`} className="block group">
      {inner}
    </Link>
  );
}
