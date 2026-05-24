import type { VisitAggregate } from "../hooks/useVisits.js";

interface Props {
  entry: VisitAggregate | null;
}

// Compact this-week visit count rendered inside a ProjectCard. Trend arrow
// uses a coloured glyph so the eye picks "going up / coming down" without
// reading the number.
export function VisitTile({ entry }: Props): JSX.Element {
  if (entry === null) {
    return <span className="te-label text-zinc-400 dark:text-zinc-600">- VISITS / 7D</span>;
  }

  const { thisWeek, trend } = entry;
  const arrow = trend === "up" ? "▲" : trend === "down" ? "▼" : "▶";
  const arrowCls =
    trend === "up"
      ? "text-accent"
      : trend === "down"
        ? "text-rose-500"
        : "text-zinc-400 dark:text-zinc-600";

  return (
    <span className="te-label inline-flex items-center gap-1.5">
      <span className="font-mono tabular-nums normal-case tracking-normal text-zinc-700 dark:text-zinc-300">
        {thisWeek}
      </span>
      <span>VISITS / 7D</span>
      <span className={"text-[10px] " + arrowCls} aria-label={`trend ${trend}`}>
        {arrow}
      </span>
    </span>
  );
}
