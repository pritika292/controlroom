import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db/pool.js";
import { getRedis } from "../services/redis.js";

export const publicDeployFrequencyRouter = Router();

const CACHE_PREFIX = "controlroom:cache:deploy_freq";
const CACHE_TTL = 60; // seconds

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).default(14),
});

interface DayBucket {
  date: string; // YYYY-MM-DD UTC
  count: number;
}

publicDeployFrequencyRouter.get("/api/public/deploys/frequency", async (req, res) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad query params", details: parsed.error.flatten() });
    return;
  }
  const { days } = parsed.data;

  const key = `${CACHE_PREFIX}:${days}`;
  const redis = getRedis();
  const cached = await redis.get(key);
  if (cached !== null) {
    res.setHeader("Content-Type", "application/json");
    res.send(cached);
    return;
  }

  const pool = getPool();
  const { rows } = await pool.query<{ d: string; n: string }>(
    `SELECT to_char(date_trunc('day', started_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS d,
            count(*)::text AS n
     FROM deploys
     WHERE started_at >= now() - ($1::int || ' days')::interval
       AND status = 'success'
     GROUP BY 1
     ORDER BY 1`,
    [days],
  );

  // Fill in zero buckets for days without deploys so the chart has a value
  // at every x position. Without this the bars cluster on busy days and
  // the gaps disappear.
  const countsByDate = new Map<string, number>();
  for (const r of rows) countsByDate.set(r.d, Number(r.n));

  const buckets: DayBucket[] = [];
  const today = new Date();
  // Normalize to UTC midnight.
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    buckets.push({ date: iso, count: countsByDate.get(iso) ?? 0 });
  }

  const total = buckets.reduce((acc, b) => acc + b.count, 0);
  const body = { days, total, buckets };

  const json = JSON.stringify(body);
  await redis.set(key, json, "EX", CACHE_TTL);
  res.setHeader("Content-Type", "application/json");
  res.send(json);
});
