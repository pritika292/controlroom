import { getPool } from "../db/pool.js";
import { getRedis } from "./redis.js";
import { getLiveProjects } from "../projects.js";
import { aggregateVisits } from "./visits.js";

// Cheap-to-derive infra signals for the richer tile grid (#86). Everything
// here reads from data the existing services are already producing —
// health_pings, deploys, site_visits, issues_cache, pg_stat_*, Redis INFO.
// Anything that'd need a new collector (AI calls, p95 request latency)
// stays out until that collector lands.

export interface InfraExtras {
  visitsThisWeek: number; // sum across all live projects
  deploysThisWeek: number;
  openIssues: number;
  pgConnections: { used: number; max: number };
  redisKeys: number;
  largestTable: { name: string; rows: number } | null;
  lastDeploy: { slug: string; whenMs: number; status: string } | null;
  uptime7dPct: number | null; // % of pings that were 'up' over the last 7d
}

export async function infraExtras(): Promise<InfraExtras> {
  const pool = getPool();
  const redis = getRedis();
  const liveSlugs = getLiveProjects().map((p) => p.slug);

  const [
    visitRows,
    deploysRow,
    openIssuesRow,
    pgConnRow,
    pgMaxRow,
    redisDbSize,
    largestTableRow,
    lastDeployRow,
    pingsRow,
  ] = await Promise.all([
    aggregateVisits(liveSlugs),
    pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM deploys WHERE started_at >= now() - interval '7 days'",
    ),
    pool.query<{ n: string }>("SELECT count(*)::text AS n FROM issues_cache WHERE state = 'open'"),
    pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM pg_stat_activity WHERE state IS NOT NULL",
    ),
    pool.query<{ setting: string }>(
      "SELECT setting FROM pg_settings WHERE name = 'max_connections'",
    ),
    redis.dbsize(),
    pool.query<{ relname: string; n_live_tup: string }>(
      `SELECT relname, n_live_tup::text
         FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC NULLS LAST
        LIMIT 1`,
    ),
    pool.query<{ project: string; finished_at: Date; status: string }>(
      `SELECT project, finished_at, status
         FROM deploys
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at DESC
        LIMIT 1`,
    ),
    pool.query<{ total: string; up: string }>(
      `SELECT count(*)::text AS total,
              count(*) FILTER (WHERE status = 'up')::text AS up
         FROM health_pings
        WHERE ts >= now() - interval '7 days'`,
    ),
  ]);

  const visitsThisWeek = visitRows.reduce((acc, r) => acc + r.thisWeek, 0);

  const pgConnections = {
    used: Number(pgConnRow.rows[0]?.n ?? 0),
    max: Number(pgMaxRow.rows[0]?.setting ?? 0),
  };

  const largest = largestTableRow.rows[0];
  const largestTable =
    largest === undefined ? null : { name: largest.relname, rows: Number(largest.n_live_tup) };

  const ld = lastDeployRow.rows[0];
  const lastDeploy =
    ld === undefined
      ? null
      : { slug: ld.project, whenMs: ld.finished_at.getTime(), status: ld.status };

  const totalPings = Number(pingsRow.rows[0]?.total ?? 0);
  const upPings = Number(pingsRow.rows[0]?.up ?? 0);
  const uptime7dPct = totalPings === 0 ? null : (upPings / totalPings) * 100;

  return {
    visitsThisWeek,
    deploysThisWeek: Number(deploysRow.rows[0]?.n ?? 0),
    openIssues: Number(openIssuesRow.rows[0]?.n ?? 0),
    pgConnections,
    redisKeys: redisDbSize,
    largestTable,
    lastDeploy,
    uptime7dPct,
  };
}
