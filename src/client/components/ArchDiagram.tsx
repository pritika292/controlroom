// Dense distributed-systems topology for the controlroom About page.
// Plain SVG — no react-flow dependency for one static diagram. Boxes
// grouped by tier with a VM "subgraph" frame so the picture reads as
// real infrastructure, not a marketing flowchart.
//
// Box helper auto-wraps long sub-labels at the " · " separator and
// stretches the rect to fit additional lines, so dense tier labels
// stay inside their boxes. Each box can carry a `tone` prop that
// tints its stroke + label to give the diagram a clear visual rhythm.

type Tone = "accent" | "edge" | "workers" | "data" | "secrets" | "control" | "neutral";

const TONE: Record<Tone, { stroke: string; label: string }> = {
  accent: { stroke: "stroke-accent", label: "fill-accent" },
  edge: {
    stroke: "stroke-sky-500 dark:stroke-sky-400",
    label: "fill-sky-700 dark:fill-sky-300",
  },
  workers: {
    stroke: "stroke-amber-500 dark:stroke-amber-400",
    label: "fill-amber-700 dark:fill-amber-300",
  },
  data: {
    stroke: "stroke-emerald-500 dark:stroke-emerald-400",
    label: "fill-emerald-700 dark:fill-emerald-300",
  },
  secrets: {
    stroke: "stroke-violet-500 dark:stroke-violet-400",
    label: "fill-violet-700 dark:fill-violet-300",
  },
  control: {
    stroke: "stroke-rose-500 dark:stroke-rose-400",
    label: "fill-rose-700 dark:fill-rose-300",
  },
  neutral: {
    stroke: "stroke-zinc-400 dark:stroke-zinc-600",
    label: "fill-zinc-900 dark:fill-white",
  },
};

const SUB_FONT_SIZE = 11;

// Greedy wrap: split sub by " · " into tokens, pack tokens into lines
// that fit within (w - 16px padding) at the sub font size.
function wrapSub(sub: string, w: number): string[] {
  const charBudget = Math.floor((w - 16) / (SUB_FONT_SIZE * 0.55));
  if (sub.length <= charBudget) return [sub];
  const tokens = sub.split(" · ");
  if (tokens.length === 1) return [sub];
  const lines: string[] = [];
  let cur = "";
  for (const t of tokens) {
    const next = cur ? `${cur} · ${t}` : t;
    if (next.length <= charBudget) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function ArchDiagram(): JSX.Element {
  return (
    <svg
      viewBox="0 0 1200 760"
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
      <Box x={20} y={50} w={200} h={48} label="visitor browsers" sub="EventSource SSE" dashed />
      <Box x={20} y={110} w={200} h={48} label="portfolio sites · 5" sub="HTTP /health probes" />
      <Box x={20} y={170} w={200} h={48} label="site beacons" sub="POST /api/visit/:slug" />
      <Box x={20} y={230} w={200} h={48} label="AI-using projects" sub="POST /api/ai-usage/:slug" />
      <Box x={20} y={300} w={200} h={48} label="GitHub" sub="webhooks · API" dashed />
      <Box x={20} y={360} w={200} h={48} label="GitHub Actions" sub="OIDC token exchange" dashed />

      {/* VM subgraph */}
      <VmFrame x={280} y={20} w={620} h={720} label="Azure VM · B2as_v2 · northcentralus" />

      {/* Edge layer: Caddy */}
      <GroupLabel x={420} y={62} label="EDGE" />
      <Box
        x={310}
        y={80}
        w={220}
        h={60}
        label="Caddy"
        sub="TLS · Let's Encrypt · reverse proxy"
        tone="edge"
      />

      {/* Express tier */}
      <GroupLabel x={420} y={170} label="APP · controlroom :3012" />
      <Box
        x={310}
        y={190}
        w={220}
        h={66}
        label="Express 5 · Node 24"
        sub="helmet · getOnly · rate-limit"
        tone="accent"
      />

      {/* Side workers */}
      <GroupLabel x={420} y={280} label="WORKERS · in-process" />
      <Box
        x={310}
        y={300}
        w={220}
        h={48}
        label="health poller"
        sub="recursive setTimeout · 30s"
        tone="workers"
      />
      <Box
        x={310}
        y={360}
        w={220}
        h={48}
        label="GitHub sync"
        sub="commits + runs + issues · 1h"
        tone="workers"
      />
      <Box
        x={310}
        y={420}
        w={220}
        h={48}
        label="SSE hub"
        sub="EventEmitter · in-memory"
        tone="workers"
      />
      <Box
        x={310}
        y={480}
        w={220}
        h={48}
        label="retention sweep"
        sub="24h pings · 90d visits"
        tone="workers"
      />

      {/* Data plane */}
      <GroupLabel x={730} y={62} label="DATA PLANE · pritika network" />
      <Box
        x={620}
        y={80}
        w={260}
        h={80}
        label="Postgres 16"
        sub="health_pings · deploys · commits_cache · issues_cache · site_visits · ai_usage"
        tone="data"
      />
      <Box
        x={620}
        y={180}
        w={260}
        h={66}
        label="Redis 7 · DB 12"
        sub="30s cache · daily-rotating IP salt · rate buckets"
        tone="data"
      />

      {/* AI subsystem (informational, controlroom doesn't call AI itself) */}
      <GroupLabel x={730} y={270} label="AI USAGE INGEST" />
      <Box
        x={620}
        y={290}
        w={260}
        h={56}
        label="ai_usage rows"
        sub="model · tokens · est cost"
        tone="data"
        dashed
      />

      {/* Secret + deploy layer */}
      <GroupLabel x={730} y={370} label="SECRETS · DEPLOY" />
      <Box
        x={620}
        y={390}
        w={260}
        h={56}
        label="Managed Identity"
        sub="VM system-assigned"
        tone="secrets"
        dashed
      />
      <Box
        x={620}
        y={458}
        w={260}
        h={56}
        label="Azure Key Vault"
        sub="Postgres · Redis · OpenAI creds"
        tone="secrets"
        dashed
      />
      <Box
        x={620}
        y={526}
        w={260}
        h={56}
        label="az vm run-command"
        sub="git pull · compose up · health probe"
        tone="secrets"
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
        sub="ci · deploy · OIDC"
        tone="control"
        dashed
      />
      <Box
        x={920}
        y={120}
        w={260}
        h={56}
        label="Azure Entra ID"
        sub="federated identity credential"
        tone="control"
        dashed
      />
      <Box
        x={920}
        y={190}
        w={260}
        h={56}
        label="Azure RBAC"
        sub="VM Contributor · scoped to 1 VM"
        tone="control"
        dashed
      />

      {/* Edges — external in to Caddy */}
      <Edge from={[220, 72]} to={[310, 110]} dashed />
      <Edge from={[220, 132]} to={[310, 115]} />
      <Edge from={[220, 192]} to={[310, 120]} />
      <Edge from={[220, 252]} to={[310, 125]} />
      <Edge from={[220, 322]} to={[310, 130]} />

      {/* Caddy -> Express */}
      <Edge from={[420, 140]} to={[420, 190]} />

      {/* Express -> workers (process-internal) */}
      <Edge from={[400, 256]} to={[400, 300]} />
      <Edge from={[400, 256]} to={[400, 360]} />
      <Edge from={[400, 256]} to={[400, 420]} />
      <Edge from={[400, 256]} to={[400, 480]} />

      {/* Health poller -> external sites */}
      <Edge from={[310, 322]} to={[220, 132]} dashed />
      {/* GitHub sync -> GitHub */}
      <Edge from={[310, 382]} to={[220, 322]} dashed />
      {/* SSE hub -> browsers (push) */}
      <Edge from={[310, 442]} to={[220, 72]} dashed />

      {/* Express + workers -> Postgres */}
      <Edge from={[530, 220]} to={[620, 110]} />
      <Edge from={[530, 322]} to={[620, 115]} />
      <Edge from={[530, 382]} to={[620, 120]} />
      <Edge from={[530, 500]} to={[620, 130]} />

      {/* Express -> Redis */}
      <Edge from={[530, 240]} to={[620, 210]} />

      {/* ai_usage ingest writes to Postgres */}
      <Edge from={[750, 346]} to={[750, 160]} dashed />

      {/* Express resolves secrets via MI -> Key Vault (boot) */}
      <Edge from={[530, 245]} to={[620, 418]} dashed />
      <Edge from={[620, 418]} to={[620, 482]} dashed />

      {/* Deploy: GitHub Actions -> OIDC -> RBAC -> az vm run-command -> VM */}
      <Edge from={[920, 80]} to={[920, 145]} dashed />
      <Edge from={[920, 145]} to={[920, 215]} dashed />
      <Edge from={[1050, 246]} to={[880, 554]} dashed />
      {/* az vm run-command -> Express (restart) */}
      <Edge from={[620, 554]} to={[530, 220]} dashed />

      {/* Caption */}
      <text
        x={600}
        y={742}
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
  sub,
  tone = "neutral",
  dashed = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  tone?: Tone;
  dashed?: boolean;
}): JSX.Element {
  const subLines = sub ? wrapSub(sub, w) : [];
  const extraHeight = Math.max(0, (subLines.length - 1) * 12);
  const rectH = h + extraHeight;
  const palette = TONE[tone];
  const isAccent = tone === "accent";
  const strokeClass =
    dashed && tone === "neutral" ? "stroke-zinc-300 dark:stroke-zinc-700" : palette.stroke;
  const dashAttr = dashed ? "6 4" : undefined;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={rectH}
        rx={6}
        ry={6}
        className={`fill-transparent ${strokeClass}`}
        strokeWidth={isAccent ? 1.75 : 1.5}
        strokeDasharray={dashAttr}
      />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 4 : y + h / 2 + 5}
        textAnchor="middle"
        className={`${palette.label} font-mono`}
        fontSize={isAccent ? 16 : 14}
        fontWeight={isAccent ? 600 : 500}
      >
        {label}
      </text>
      {subLines.map((line, i) => (
        <text
          key={i}
          x={x + w / 2}
          y={y + h / 2 + 14 + i * 12}
          textAnchor="middle"
          className="fill-zinc-500 dark:fill-zinc-400 font-mono"
          fontSize={SUB_FONT_SIZE}
        >
          {line}
        </text>
      ))}
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
