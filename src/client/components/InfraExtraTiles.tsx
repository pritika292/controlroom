import { useInfraExtras, type InfraExtras } from "../hooks/useInfraExtras.js";
import { relativeTime } from "../lib/relativeTime.js";

// Richer infra signal grid that sits below the existing VM / Services /
// Cost cards (#86). Every tile reads from data the existing services are
// already producing, so adding tiles here is cheap.

export function InfraExtraTiles(): JSX.Element | null {
  const { data } = useInfraExtras();
  // Be defensive: missing top-level fields (older deploys, mocked tests,
  // partial responses) shouldn't crash the panel.
  if (data === null || typeof data.visitsThisWeek !== "number") return null;

  const tiles = buildTiles(data);

  return (
    <article className="te-panel mt-3 p-5">
      <p className="te-label">PORTFOLIO PULSE</p>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <Tile key={t.label} {...t} />
        ))}
      </div>
    </article>
  );
}

interface TileSpec {
  label: string;
  value: string;
  sub?: string;
}

function Tile({ label, value, sub }: TileSpec): JSX.Element {
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 p-3">
      <p className="te-label">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums text-zinc-900 dark:text-white truncate">
        {value}
      </p>
      {sub !== undefined && (
        <p className="mt-1 te-code text-zinc-500 dark:text-zinc-400 truncate">{sub}</p>
      )}
    </div>
  );
}

function buildTiles(d: InfraExtras): TileSpec[] {
  const tiles: TileSpec[] = [
    {
      label: "VISITS / 7D",
      value: d.visitsThisWeek.toLocaleString(),
      sub: "ACROSS FAMILY",
    },
    {
      label: "DEPLOYS / 7D",
      value: d.deploysThisWeek.toLocaleString(),
      sub: "ALL PROJECTS",
    },
    {
      label: "OPEN ISSUES",
      value: d.openIssues.toLocaleString(),
      sub: "ACROSS REPOS",
    },
    {
      label: "UPTIME / 7D",
      value: d.uptime7dPct === null ? "-" : `${d.uptime7dPct.toFixed(2)}%`,
      sub: "ALL PROJECTS",
    },
    {
      label: "PG CONNS",
      value: `${d.pgConnections.used}`,
      sub: `OF ${d.pgConnections.max} MAX`,
    },
    {
      label: "REDIS KEYS",
      value: d.redisKeys.toLocaleString(),
      sub: "DB 12",
    },
    {
      label: "AI CALLS / TODAY",
      value: (d.ai?.callsToday ?? 0).toLocaleString(),
      sub: `${(d.ai?.callsThisWeek ?? 0).toLocaleString()} / 7D`,
    },
    {
      label: "TOKENS / TODAY",
      value: formatCompact(d.ai?.tokensToday ?? 0),
      sub: "PROMPT + COMPLETION",
    },
    {
      label: "AI COST / TODAY",
      value: formatCents(d.ai?.costTodayCents ?? 0),
      sub: "ESTIMATED",
    },
    {
      label: "MODEL",
      value: d.ai?.modelInUse ?? "—",
      sub: "AZURE OPENAI",
    },
  ];

  if (d.lastDeploy !== null) {
    tiles.push({
      label: "LAST DEPLOY",
      value: relativeTime(d.lastDeploy.whenMs).toUpperCase(),
      sub: `${d.lastDeploy.slug.toUpperCase()} / ${d.lastDeploy.status.toUpperCase()}`,
    });
  }

  return tiles;
}

// 12345 → "12.3K"; 9876543 → "9.9M". Keeps tokens-per-day legible.
function formatCompact(n: number): string {
  if (n < 1_000) return n.toString();
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function formatCents(cents: number): string {
  // cents is float-ish (numeric(10,4) from pg). Sub-cent days render with
  // extra decimals so a fraction-of-a-penny day doesn't read as $0.00.
  const dollars = cents / 100;
  if (dollars >= 1) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(4)}`;
}
