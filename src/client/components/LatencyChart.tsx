import type { ProjectPing } from "../hooks/useProjectPings.js";

interface Props {
  pings: ProjectPing[];
  width?: number;
  height?: number;
}

// Renders a tiny line chart of latency over time. SVG only, no chart lib.
// Pings without a measured latency (timeout, connection error) are skipped
// so a dropped point doesn't drag the line to zero.

export function LatencyChart({ pings, width = 720, height = 120 }: Props): JSX.Element {
  const points = pings.filter((p) => typeof p.latencyMs === "number") as Array<
    ProjectPing & { latencyMs: number }
  >;

  if (points.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-auto"
        role="img"
        aria-label="Latency chart: not enough data"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x={0}
          y={height - 1}
          width={width}
          height={1}
          className="fill-zinc-200 dark:fill-zinc-800"
        />
      </svg>
    );
  }

  // The early-return above guarantees points.length >= 2, so first/last
  // exist; coalesce defensively to satisfy noUncheckedIndexedAccess.
  const tsMin = points[0]?.ts ?? 0;
  const tsMax = points[points.length - 1]?.ts ?? 0;
  const tsRange = Math.max(1, tsMax - tsMin);
  const latMax = Math.max(...points.map((p) => p.latencyMs));
  const latMin = Math.min(...points.map((p) => p.latencyMs));
  // Tiny vertical padding so the line doesn't touch the edges.
  const padY = 6;
  const usableH = height - 2 * padY;
  const latRange = Math.max(1, latMax - latMin);

  const path = points
    .map((p, i) => {
      const x = ((p.ts - tsMin) / tsRange) * width;
      const y = padY + (1 - (p.latencyMs - latMin) / latRange) * usableH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="block w-full h-auto"
      role="img"
      aria-label={`Latency chart over ${points.length} pings: min ${Math.round(latMin)}ms max ${Math.round(latMax)}ms`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* baseline */}
      <rect
        x={0}
        y={height - 1}
        width={width}
        height={1}
        className="fill-zinc-200 dark:fill-zinc-800"
      />

      {/* min / max guide ticks on the right edge */}
      <text
        x={width - 4}
        y={padY + 8}
        textAnchor="end"
        className="fill-zinc-500 dark:fill-zinc-400 font-mono text-[10px]"
      >
        {Math.round(latMax)}ms
      </text>
      <text
        x={width - 4}
        y={height - padY - 2}
        textAnchor="end"
        className="fill-zinc-500 dark:fill-zinc-400 font-mono text-[10px]"
      >
        {Math.round(latMin)}ms
      </text>

      <path d={path} fill="none" strokeWidth="1.5" className="stroke-accent" />
    </svg>
  );
}
