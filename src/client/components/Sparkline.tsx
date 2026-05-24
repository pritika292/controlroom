export interface Ping {
  ts: number;
  status: "up" | "down" | "timeout" | "error";
}

interface Props {
  pings: Ping[];
  width?: number;
  height?: number;
}

function colorClass(status: Ping["status"]): string {
  if (status === "up") return "fill-accent";
  if (status === "timeout") return "fill-amber-500";
  return "fill-rose-500";
}

export function Sparkline({ pings, width = 120, height = 24 }: Props): JSX.Element {
  const healthyCount = pings.filter((p) => p.status === "up").length;
  const label =
    pings.length === 0
      ? "Uptime sparkline: no data"
      : `Uptime sparkline: ${healthyCount} of ${pings.length} pings healthy`;

  // Responsive: viewBox carries the coordinate system, w-full + h-auto
  // stretch the SVG to fill its parent. Without this the fixed pixel
  // width overflowed cards on mobile (#72).
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block w-full h-auto"
      role="img"
      aria-label={label}
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

      {pings.map((ping, i) => {
        const x = (i / pings.length) * width;
        return (
          <rect key={i} x={x} y={0} width={2} height={height} className={colorClass(ping.status)} />
        );
      })}
    </svg>
  );
}
