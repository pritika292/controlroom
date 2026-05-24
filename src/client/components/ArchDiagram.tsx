// Hand-positioned SVG diagram of the controlroom request topology, used on
// the About page (#83). Mermaid auto-layouts look amateur; react-flow would
// be a 100 KB add for one read-only diagram. Plain SVG, no deps.
//
// Boxes are positioned by hand. Coordinates aren't precious — tweak freely
// if you reshape the layout. Stroke + fill use Tailwind's theme tokens so
// the diagram tracks the light/dark switch.

export function ArchDiagram(): JSX.Element {
  return (
    <svg
      viewBox="0 0 540 320"
      className="block w-full h-auto"
      role="img"
      aria-label="ControlRoom architecture: portfolio sites send health pings and visit beacons through Caddy to the controlroom server, which writes to Postgres and Redis and streams updates back to browsers over SSE."
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="fill-zinc-500 dark:fill-zinc-400" />
        </marker>
      </defs>

      {/* Five portfolio sites stacked on the left */}
      <Box x={10} y={10} w={120} h={28} label="focusroom" />
      <Box x={10} y={50} w={120} h={28} label="pg-inspector" />
      <Box x={10} y={90} w={120} h={28} label="shortlive" />
      <Box x={10} y={130} w={120} h={28} label="portfolio" />
      <Box x={10} y={170} w={120} h={28} label="controlroom" />

      {/* Caddy in the middle */}
      <Box x={200} y={80} w={120} h={50} label="Caddy" subLabel="TLS / proxy" />

      {/* Browsers */}
      <Box x={200} y={170} w={120} h={50} label="browsers" subLabel="SSE clients" dashed />

      {/* Controlroom + data stores */}
      <Box x={390} y={10} w={140} h={50} label="GitHub" subLabel="webhooks + sync" dashed />
      <Box x={390} y={80} w={140} h={50} label="controlroom" subLabel=":3012 Express 5" accent />
      <Box x={390} y={170} w={140} h={28} label="Postgres 16" />
      <Box x={390} y={210} w={140} h={28} label="Redis 7" />

      {/* Edges — sites -> caddy */}
      <Edge from={[130, 24]} to={[200, 90]} />
      <Edge from={[130, 64]} to={[200, 95]} />
      <Edge from={[130, 104]} to={[200, 105]} />
      <Edge from={[130, 144]} to={[200, 115]} />
      <Edge from={[130, 184]} to={[200, 120]} />

      {/* Caddy -> controlroom */}
      <Edge from={[320, 105]} to={[390, 105]} />

      {/* controlroom -> postgres + redis */}
      <Edge from={[460, 130]} to={[460, 170]} />
      <Edge from={[480, 130]} to={[480, 210]} />

      {/* GitHub <-> controlroom */}
      <Edge from={[460, 60]} to={[460, 80]} both />

      {/* controlroom -> browsers (SSE) */}
      <Edge from={[390, 120]} to={[320, 195]} dashed />

      {/* Caption strip */}
      <text
        x={270}
        y={310}
        textAnchor="middle"
        className="fill-zinc-500 dark:fill-zinc-400 font-mono"
        fontSize={10}
      >
        ── solid: HTTPS request · - - dashed: stream / async push
      </text>
    </svg>
  );
}

function Box({
  x,
  y,
  w,
  h,
  label,
  subLabel,
  accent = false,
  dashed = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  subLabel?: string;
  accent?: boolean;
  dashed?: boolean;
}): JSX.Element {
  const stroke = accent
    ? "stroke-accent"
    : dashed
      ? "stroke-zinc-300 dark:stroke-zinc-700"
      : "stroke-zinc-400 dark:stroke-zinc-600";
  const dashAttr = dashed ? "4 3" : undefined;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        ry={3}
        className={`fill-transparent ${stroke}`}
        strokeWidth={1}
        strokeDasharray={dashAttr}
      />
      <text
        x={x + w / 2}
        y={subLabel === undefined ? y + h / 2 + 4 : y + h / 2 - 1}
        textAnchor="middle"
        className={accent ? "fill-accent font-mono" : "fill-zinc-900 dark:fill-white font-mono"}
        fontSize={11}
      >
        {label}
      </text>
      {subLabel !== undefined && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 12}
          textAnchor="middle"
          className="fill-zinc-500 dark:fill-zinc-400 font-mono"
          fontSize={9}
        >
          {subLabel}
        </text>
      )}
    </g>
  );
}

function Edge({
  from,
  to,
  dashed = false,
  both = false,
}: {
  from: [number, number];
  to: [number, number];
  dashed?: boolean;
  both?: boolean;
}): JSX.Element {
  const dashAttr = dashed ? "4 3" : undefined;
  return (
    <line
      x1={from[0]}
      y1={from[1]}
      x2={to[0]}
      y2={to[1]}
      className="stroke-zinc-500 dark:stroke-zinc-400"
      strokeWidth={1}
      strokeDasharray={dashAttr}
      markerEnd="url(#arrow)"
      markerStart={both ? "url(#arrow)" : undefined}
    />
  );
}
