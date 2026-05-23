import type { ProjectStatus } from "../hooks/useStatus.js";

interface Props {
  project: ProjectStatus;
}

// Square indicator in the TE catalog tradition: hard edges, single color.
// Status -> color:
//   planned        -> zinc (off)
//   live + no ping -> zinc
//   live + up      -> accent orange (on)
//   live + timeout -> amber
//   live + down/error -> rose

function squareClasses(project: ProjectStatus): string {
  if (project.status === "planned" || project.lastStatus === null) {
    return "bg-zinc-300 dark:bg-zinc-700";
  }
  if (project.lastStatus === "up") return "bg-accent";
  if (project.lastStatus === "timeout") return "bg-amber-500";
  return "bg-rose-500";
}

export function StatusDot({ project }: Props): JSX.Element {
  const label =
    project.status === "planned"
      ? "planned"
      : project.lastStatus === null
        ? "unknown"
        : project.lastStatus;

  return (
    <span
      role="img"
      aria-label={`status: ${label}`}
      className={`inline-block h-3 w-3 transition-colors duration-200 ${squareClasses(project)}`}
    />
  );
}
