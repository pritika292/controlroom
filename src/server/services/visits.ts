import crypto from "node:crypto";
import { getPool } from "../db/pool.js";
import { getRedis } from "./redis.js";

// Daily-rotating IP salt. Stored in Redis keyed by date so every project
// hitting the ingest endpoint within the same day uses the same salt
// (consistent per-day hashing) but the hash isn't a stable identifier
// across days.
async function getDailySalt(): Promise<string> {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `controlroom:visit-salt:${day}`;
  const redis = getRedis();
  const existing = await redis.get(key);
  if (existing) return existing;
  // 32 random bytes hex-encoded. EX 86400+1h gives a grace window after
  // midnight UTC so a request mid-rollover doesn't get a fresh salt while
  // an aggregator is mid-flight.
  const fresh = crypto.randomBytes(32).toString("hex");
  await redis.set(key, fresh, "EX", 60 * 60 * 25);
  return fresh;
}

export async function hashIp(ip: string): Promise<string> {
  const salt = await getDailySalt();
  return crypto
    .createHash("sha256")
    .update(ip + salt)
    .digest("hex");
}

// Coarse UA classification — desktop / mobile / bot. The visit aggregations
// exclude bots so the public counts reflect human traffic.
const BOT_HINTS = [
  "bot",
  "crawl",
  "spider",
  "curl/",
  "wget",
  "python-requests",
  "node-fetch",
  "axios",
  "go-http-client",
  "headless",
  "monitoring",
];

export function classifyUserAgent(ua: string | undefined): "desktop" | "mobile" | "bot" {
  const s = (ua ?? "").toLowerCase();
  if (!s) return "bot";
  for (const hint of BOT_HINTS) {
    if (s.includes(hint)) return "bot";
  }
  if (/mobile|android|iphone|ipad/.test(s)) return "mobile";
  return "desktop";
}

export interface RecordVisitInput {
  project: string;
  ip: string;
  userAgent: string | undefined;
}

export async function recordVisit(input: RecordVisitInput): Promise<void> {
  const ip_hash = await hashIp(input.ip);
  const ua_kind = classifyUserAgent(input.userAgent);
  const pool = getPool();
  await pool.query(`INSERT INTO site_visits (project, ip_hash, ua_kind) VALUES ($1, $2, $3)`, [
    input.project,
    ip_hash,
    ua_kind,
  ]);
}

export interface ProjectVisitCount {
  slug: string;
  thisWeek: number;
  lastWeek: number;
  trend: "up" | "down" | "flat";
}

// Aggregated this-week / last-week counts per project. Excludes bots.
export async function aggregateVisits(slugs: readonly string[]): Promise<ProjectVisitCount[]> {
  if (slugs.length === 0) return [];
  const pool = getPool();
  const { rows } = await pool.query<{ slug: string; bucket: string; n: string }>(
    `WITH windows AS (
       SELECT 'this_week' AS bucket, NOW() - INTERVAL '7 days'  AS lo, NOW()                       AS hi
       UNION ALL
       SELECT 'last_week' AS bucket, NOW() - INTERVAL '14 days' AS lo, NOW() - INTERVAL '7 days'   AS hi
     )
     SELECT v.project AS slug, w.bucket, count(*)::text AS n
       FROM site_visits v
       JOIN windows w ON v.ts >= w.lo AND v.ts < w.hi
      WHERE v.project = ANY($1)
        AND v.ua_kind <> 'bot'
      GROUP BY v.project, w.bucket`,
    [slugs],
  );

  const map = new Map<string, { thisWeek: number; lastWeek: number }>();
  for (const slug of slugs) map.set(slug, { thisWeek: 0, lastWeek: 0 });
  for (const r of rows) {
    const entry = map.get(r.slug);
    if (!entry) continue;
    const n = Number(r.n);
    if (r.bucket === "this_week") entry.thisWeek = n;
    else entry.lastWeek = n;
  }

  return slugs.map((slug) => {
    const entry = map.get(slug) ?? { thisWeek: 0, lastWeek: 0 };
    let trend: "up" | "down" | "flat" = "flat";
    if (entry.thisWeek > entry.lastWeek) trend = "up";
    else if (entry.thisWeek < entry.lastWeek) trend = "down";
    return { slug, thisWeek: entry.thisWeek, lastWeek: entry.lastWeek, trend };
  });
}

// Daily bucket counts for the project detail page chart.
export async function dailyVisitsForProject(
  slug: string,
  days: number,
): Promise<{ day: string; count: number }[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ day: string; n: string }>(
    `SELECT to_char(date_trunc('day', ts), 'YYYY-MM-DD') AS day, count(*)::text AS n
       FROM site_visits
      WHERE project = $1
        AND ts >= NOW() - ($2::int * INTERVAL '1 day')
        AND ua_kind <> 'bot'
      GROUP BY 1
      ORDER BY 1`,
    [slug, days],
  );
  return rows.map((r) => ({ day: r.day, count: Number(r.n) }));
}

// Retention sweep: drop visits older than 90 days. Called from a daily cron.
export async function sweepOldVisits(maxAgeDays = 90): Promise<number> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM site_visits WHERE ts < NOW() - ($1::int * INTERVAL '1 day')`,
    [maxAgeDays],
  );
  return rowCount ?? 0;
}
