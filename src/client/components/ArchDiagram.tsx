// Dense distributed-systems topology for the controlroom About page.
// Plain SVG — no react-flow dependency for one static diagram. Boxes
// grouped by tier with a VM "subgraph" frame so the picture reads as
// real infrastructure, not a marketing flowchart.

export function ArchDiagram(): JSX.Element {
  return (
    <svg
      viewBox="0 0 1200 720"
      className="block w-full h-auto"
      role="img"
      aria-label="ControlRoom architecture: portfolio sites and GitHub webhooks fan into Caddy on an Azure VM; an Express server with health poller, github sync worker, SSE hub, and retention sweeper reads and writes Postgres + Redis; deploys come from GitHub Actions via OIDC and az vm run-command; secrets resolve through Managed Identity to Azure Key Vault."
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

      {/* External actors (left edge) */}
      <GroupLabel x={100} y={32} label="EXTERNAL" />
      <Box
        x={20}
        y={50}
        w={200}
        h={42}
        label="visitor browsers"
        subLabel="EventSource SSE"
        dashed
      />
      <Box
        x={20}
        y={110}
        w={200}
        h={42}
        label="portfolio sites · 5"
        subLabel="HTTP /health probes"
      />
      <Box x={20} y={170} w={200} h={42} label="site beacons" subLabel="POST /api/visit/:slug" />
      <Box
        x={20}
        y={230}
        w={200}
        h={42}
        label="AI-using projects"
        subLabel="POST /api/ai-usage/:slug"
      />
      <Box x={20} y={300} w={200} h={42} label="GitHub" subLabel="webhooks · API" dashed />
      <Box
        x={20}
        y={360}
        w={200}
        h={42}
        label="GitHub Actions"
        subLabel="OIDC token exchange"
        dashed
      />

      {/* VM subgraph */}
      <VmFrame x={280} y={20} w={620} h={680} label="Azure VM · B2as_v2 · northcentralus" />

      {/* Edge layer: Caddy */}
      <GroupLabel x={420} y={62} label="EDGE" />
      <Box
        x={310}
        y={80}
        w={220}
        h={56}
        label="Caddy"
        subLabel="TLS · Let's Encrypt · reverse proxy"
      />

      {/* Express tier */}
      <GroupLabel x={420} y={170} label="APP · controlroom :3012" />
      <Box
        x={310}
        y={190}
        w={220}
        h={62}
        label="Express 5 · Node 24"
        subLabel="helmet · getOnly · rate-limit"
        accent
      />

      {/* Side workers */}
      <GroupLabel x={420} y={280} label="WORKERS · in-process" />
      <Box
        x={310}
        y={300}
        w={220}
        h={44}
        label="health poller"
        subLabel="recursive setTimeout · 30s"
      />
      <Box
        x={310}
        y={356}
        w={220}
        h={44}
        label="GitHub sync"
        subLabel="commits + runs + issues · 1h"
      />
      <Box x={310} y={412} w={220} h={44} label="SSE hub" subLabel="EventEmitter · in-memory" />
      <Box
        x={310}
        y={468}
        w={220}
        h={44}
        label="retention sweep"
        subLabel="24h pings · 90d visits"
      />

      {/* Data plane */}
      <GroupLabel x={730} y={62} label="DATA PLANE · pritika network" />
      <Box
        x={620}
        y={80}
        w={260}
        h={70}
        label="Postgres 16"
        subLabel="health_pings · deploys · commits_cache · issues_cache · site_visits · ai_usage"
      />
      <Box
        x={620}
        y={170}
        w={260}
        h={62}
        label="Redis 7 · DB 12"
        subLabel="30s cache · daily-rotating IP salt · rate buckets"
      />

      {/* AI subsystem (informational, controlroom doesn't call AI itself) */}
      <GroupLabel x={730} y={260} label="AI USAGE INGEST" />
      <Box
        x={620}
        y={280}
        w={260}
        h={56}
        label="ai_usage rows"
        subLabel="model · tokens · est cost"
        dashed
      />

      {/* Secret + deploy layer */}
      <GroupLabel x={730} y={362} label="SECRETS · DEPLOY" />
      <Box
        x={620}
        y={380}
        w={260}
        h={56}
        label="Managed Identity"
        subLabel="VM system-assigned"
        dashed
      />
      <Box
        x={620}
        y={448}
        w={260}
        h={56}
        label="Azure Key Vault"
        subLabel="Postgres · Redis · OpenAI creds"
        dashed
      />
      <Box
        x={620}
        y={516}
        w={260}
        h={56}
        label="az vm run-command"
        subLabel="git pull · compose up · health probe"
        dashed
      />

      {/* Right edge: outside-the-VM control plane */}
      <GroupLabel x={1020} y={32} label="CONTROL PLANE" />
      <Box
        x={920}
        y={50}
        w={260}
        h={56}
        label="GitHub Actions runner"
        subLabel="ci · deploy · OIDC"
        dashed
      />
      <Box
        x={920}
        y={120}
        w={260}
        h={56}
        label="Azure Entra ID"
        subLabel="federated identity credential"
        dashed
      />
      <Box
        x={920}
        y={190}
        w={260}
        h={56}
        label="Azure RBAC"
        subLabel="VM Contributor · scoped to 1 VM"
        dashed
      />

      {/* Edges — left in to express via Caddy */}
      <Edge from={[220, 72]} to={[310, 110]} dashed />
      <Edge from={[220, 132]} to={[310, 115]} />
      <Edge from={[220, 192]} to={[310, 120]} />
      <Edge from={[220, 252]} to={[310, 125]} />
      <Edge from={[220, 322]} to={[310, 130]} />

      {/* Caddy -> Express */}
      <Edge from={[420, 138]} to={[420, 190]} />

      {/* Express -> workers (process-internal) */}
      <Edge from={[400, 252]} to={[400, 300]} />
      <Edge from={[400, 252]} to={[400, 356]} />
      <Edge from={[400, 252]} to={[400, 412]} />
      <Edge from={[400, 252]} to={[400, 468]} />

      {/* Health poller -> external sites */}
      <Edge from={[310, 322]} to={[220, 132]} dashed />
      {/* GitHub sync -> GitHub */}
      <Edge from={[310, 378]} to={[220, 322]} dashed />
      {/* SSE hub -> browsers (push) */}
      <Edge from={[310, 432]} to={[220, 72]} dashed />

      {/* Express + workers -> Postgres */}
      <Edge from={[530, 220]} to={[620, 110]} />
      <Edge from={[530, 322]} to={[620, 115]} />
      <Edge from={[530, 378]} to={[620, 120]} />
      <Edge from={[530, 490]} to={[620, 130]} />

      {/* Express -> Redis */}
      <Edge from={[530, 235]} to={[620, 200]} />

      {/* ai_usage ingest writes to Postgres */}
      <Edge from={[750, 336]} to={[750, 150]} dashed />

      {/* Express resolves secrets via MI -> Key Vault (boot) */}
      <Edge from={[530, 240]} to={[620, 405]} dashed />
      <Edge from={[620, 405]} to={[620, 470]} dashed />

      {/* Deploy: GitHub Actions -> OIDC -> RBAC -> az vm run-command -> VM */}
      <Edge from={[920, 80]} to={[920, 145]} dashed />
      <Edge from={[920, 145]} to={[920, 215]} dashed />
      <Edge from={[1050, 246]} to={[880, 544]} dashed />
      {/* az vm run-command -> Express (restart) */}
      <Edge from={[620, 544]} to={[530, 220]} dashed />

      {/* Caption */}
      <text
        x={600}
        y={702}
        textAnchor="middle"
        className="fill-zinc-500 dark:fill-zinc-400 font-mono"
        fontSize={13}
      >
        ── solid: synchronous request / write - - dashed: stream · async push · auth / deploy
        side-flows
      </text>
    </svg>
  );
}

function GroupLabel({ x, y, label }: { x: number; y: number; label: string }): JSX.Element {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      className="fill-zinc-500 dark:fill-zinc-500 font-mono uppercase"
      fontSize={11}
      letterSpacing={2}
    >
      {label}
    </text>
  );
}

function VmFrame({
  x,
  y,
  w,
  h,
  label,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}): JSX.Element {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        ry={10}
        className="fill-transparent stroke-zinc-300 dark:stroke-zinc-700"
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      <text
        x={x + 14}
        y={y + 14}
        className="fill-zinc-500 dark:fill-zinc-400 font-mono uppercase"
        fontSize={10}
        letterSpacing={2}
      >
        {label}
      </text>
    </g>
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
        y={subLabel === undefined ? y + h / 2 + 5 : y + h / 2 - 4}
        textAnchor="middle"
        className={accent ? "fill-accent font-mono" : "fill-zinc-900 dark:fill-white font-mono"}
        fontSize={accent ? 16 : 14}
        fontWeight={accent ? 600 : 500}
      >
        {label}
      </text>
      {subLabel !== undefined && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 14}
          textAnchor="middle"
          className="fill-zinc-500 dark:fill-zinc-400 font-mono"
          fontSize={11}
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
      strokeWidth={1.5}
      strokeDasharray={dashAttr}
      markerEnd="url(#arrow)"
      markerStart={both ? "url(#arrow)" : undefined}
    />
  );
}
