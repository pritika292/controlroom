import type { DailyVisit } from "../hooks/useVisits.js";

interface Props {
  data: DailyVisit[];
  width?: number;
  height?: number;
  days?: number;
}

// Daily visit bars over the last `days` window. Fills in missing days as
// zero so the chart shape stays consistent regardless of how active the
// project has been.
export function VisitChart({ data, width = 420, height = 120, days = 30 }: Props): JSX.Element {
  const filled = fillMissingDays(data, days);
  const max = Math.max(1, ...filled.map((d) => d.count));
  const barW = width / filled.length;
  const pad = 18; // baseline label space

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block w-full h-auto"
      role="img"
      aria-label={`Daily visits, last ${days} days`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* baseline */}
      <rect
        x={0}
        y={height - pad}
        width={width}
        height={1}
        className="fill-zinc-200 dark:fill-zinc-800"
      />
      {filled.map((d, i) => {
        const h = ((height - pad - 2) * d.count) / max;
        const x = i * barW;
        const y = height - pad - h;
        return (
          <rect
            key={d.day}
            x={x + 0.5}
            y={y}
            width={Math.max(1, barW - 1)}
            height={h}
            className="fill-accent"
          >
            <title>{`${d.day} - ${d.count} visit${d.count === 1 ? "" : "s"}`}</title>
          </rect>
        );
      })}

      {/* End-cap labels: oldest day on the left, newest on the right */}
      <text
        x={2}
        y={height - 4}
        className="fill-zinc-500 dark:fill-zinc-400 font-mono"
        fontSize={9}
      >
        {filled[0]?.day ?? ""}
      </text>
      <text
        x={width - 2}
        y={height - 4}
        textAnchor="end"
        className="fill-zinc-500 dark:fill-zinc-400 font-mono"
        fontSize={9}
      >
        {filled[filled.length - 1]?.day ?? ""}
      </text>
    </svg>
  );
}

function fillMissingDays(data: DailyVisit[], days: number): DailyVisit[] {
  const map = new Map(data.map((d) => [d.day, d.count]));
  const out: DailyVisit[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: map.get(key) ?? 0 });
  }
  return out;
}
