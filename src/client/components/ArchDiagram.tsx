// Hand-positioned SVG diagram of the controlroom request topology, used on
// the About page (#83). Mermaid auto-layouts look amateur; react-flow would
// be a 100 KB add for one read-only diagram. Plain SVG, no deps.
//
// Sized for full-width display (not a narrow column) — coordinates are in
// SVG units, scaled by CSS. The viewBox is the "canvas"; widen/heighten
// freely.

export function ArchDiagram(): JSX.Element {
  return (
    <svg
      viewBox="0 0 960 460"
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

      {/* Group label: portfolio sites */}
      <text
        x={140}
        y={30}
        textAnchor="middle"
        className="fill-zinc-500 dark:fill-zinc-500 font-mono uppercase"
        fontSize={11}
        letterSpacing={2}
      >
        Portfolio sites
      </text>

      {/* Five portfolio sites stacked on the left */}
      <Box x={20} y={50} w={240} h={48} label="focusroom" />
      <Box x={20} y={110} w={240} h={48} label="pg-inspector" />
      <Box x={20} y={170} w={240} h={48} label="shortlive" />
      <Box x={20} y={230} w={240} h={48} label="portfolio" />
      <Box x={20} y={290} w={240} h={48} label="controlroom" />

      {/* Caddy in the middle-left */}
      <Box x={350} y={170} w={200} h={80} label="Caddy" subLabel="TLS · reverse proxy" />

      {/* Browsers */}
      <Box x={350} y={300} w={200} h={80} label="browsers" subLabel="SSE clients" dashed />

      {/* GitHub */}
      <Box x={640} y={50} w={280} h={80} label="GitHub" subLabel="webhooks + sync" dashed />

      {/* Controlroom — the star of the diagram */}
      <Box
        x={640}
        y={170}
        w={280}
        h={80}
        label="controlroom"
        subLabel=":3012  ·  Express 5  ·  Node 24"
        accent
      />

      {/* Postgres + Redis stacked under controlroom */}
      <Box
        x={640}
        y={290}
        w={280}
        h={48}
        label="Postgres 16"
        subLabel="status · visits · deploys"
      />
      <Box
        x={640}
        y={350}
        w={280}
        h={48}
        label="Redis 7"
        subLabel="cache · pub/sub · rate limits"
      />

      {/* Edges — sites -> caddy. Fanned arrows from each site box. */}
      <Edge from={[260, 74]} to={[350, 195]} />
      <Edge from={[260, 134]} to={[350, 205]} />
      <Edge from={[260, 194]} to={[350, 210]} />
      <Edge from={[260, 254]} to={[350, 220]} />
      <Edge from={[260, 314]} to={[350, 235]} />

      {/* Caddy -> controlroom */}
      <Edge from={[550, 210]} to={[640, 210]} />

      {/* controlroom -> postgres + redis */}
      <Edge from={[760, 250]} to={[760, 290]} />
      <Edge from={[800, 250]} to={[800, 350]} />

      {/* GitHub <-> controlroom */}
      <Edge from={[780, 130]} to={[780, 170]} both />

      {/* controlroom -> browsers (SSE) */}
      <Edge from={[640, 240]} to={[550, 335]} dashed />

      {/* Caption */}
      <text
        x={480}
        y={445}
        textAnchor="middle"
        className="fill-zinc-500 dark:fill-zinc-400 font-mono"
        fontSize={13}
      >
        ── solid: HTTPS request - - dashed: stream / async push
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
  const dashAttr = dashed ? "6 4" : undefined;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        ry={6}
        className={`fill-transparent ${stroke}`}
        strokeWidth={1.5}
        strokeDasharray={dashAttr}
      />
      <text
        x={x + w / 2}
        y={subLabel === undefined ? y + h / 2 + 6 : y + h / 2 - 4}
        textAnchor="middle"
        className={accent ? "fill-accent font-mono" : "fill-zinc-900 dark:fill-white font-mono"}
        fontSize={accent ? 18 : 16}
        fontWeight={accent ? 600 : 500}
      >
        {label}
      </text>
      {subLabel !== undefined && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 16}
          textAnchor="middle"
          className="fill-zinc-500 dark:fill-zinc-400 font-mono"
          fontSize={12}
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
  const dashAttr = dashed ? "6 4" : undefined;
  return (
    <line
      x1={from[0]}
      y1={from[1]}
      x2={to[0]}
      y2={to[1]}
      className="stroke-zinc-500 dark:stroke-zinc-400"
      strokeWidth={1.75}
      strokeDasharray={dashAttr}
      markerEnd="url(#arrow)"
      markerStart={both ? "url(#arrow)" : undefined}
    />
  );
}
