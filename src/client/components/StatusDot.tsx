import type { ProjectStatus } from "../hooks/useStatus.js";

interface Props {
  project: ProjectStatus;
}

// Color matrix for the dot:
//   planned        → grey
//   live + no ping → grey (poller hasn't hit it yet)
//   live + up      → emerald
//   live + timeout → amber
//   live + down/error → rose

function dotClasses(project: ProjectStatus): string {
  if (project.status === "planned" || project.lastStatus === null) {
    return "bg-slate-300 dark:bg-slate-600";
  }
  if (project.lastStatus === "up") return "bg-emerald-500";
  if (project.lastStatus === "timeout") return "bg-amber-500";
  return "bg-rose-500";
}

function ringClasses(project: ProjectStatus): string {
  if (project.lastStatus === "up") return "bg-emerald-400/40";
  return "bg-transparent";
}

export function StatusDot({ project }: Props): JSX.Element {
  const label =
    project.status === "planned"
      ? "planned"
      : project.lastStatus === null
        ? "unknown"
        : project.lastStatus;

  return (
    <span className="relative inline-flex h-3 w-3" role="img" aria-label={`status: ${label}`}>
      <span
        aria-hidden
        className={`absolute inset-0 rounded-full ${ringClasses(project)} animate-ping`}
      />
      <span
        className={`relative inline-block h-3 w-3 rounded-full transition-colors duration-200 ${dotClasses(project)}`}
      />
    </span>
  );
}
