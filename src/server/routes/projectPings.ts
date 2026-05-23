import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db/pool.js";
import { getRedis } from "../services/redis.js";
import { getProject } from "../projects.js";

export const projectPingsRouter = Router();

const CACHE_TTL = 5; // seconds

function cacheKey(slug: string): string {
  return `controlroom:cache:pings:${slug}`;
}

const QuerySchema = z.object({
  window: z.literal("24h"),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

interface PingRow {
  ts: Date;
  status: "up" | "down" | "timeout" | "error";
  latency_ms: number | null;
}

projectPingsRouter.get("/api/public/projects/:slug/pings", async (req, res) => {
  const { slug } = req.params;

  const project = getProject(slug);
  if (!project) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad query params", details: parsed.error.flatten() });
    return;
  }

  const { limit } = parsed.data;
  const key = cacheKey(slug);
  const redis = getRedis();

  const cached = await redis.get(key);
  if (cached !== null) {
    res.setHeader("Content-Type", "application/json");
    res.send(cached);
    return;
  }

  const pool = getPool();
  // Take the NEWEST `limit` pings in the 24h window, then re-order ascending
  // so the sparkline and latency chart draw left-to-right with the freshest
  // data at the right edge. A plain `ORDER BY ts ASC LIMIT N` returns the
  // OLDEST N -- the original bug that surfaced as "the table shows pings
  // from 9 hours ago" after the poller had been running long enough to
  // fill out the 24h window.
  const { rows } = await pool.query<PingRow>(
    `SELECT ts, status, latency_ms FROM (
       SELECT ts, status, latency_ms
       FROM health_pings
       WHERE project = $1
         AND ts >= now() - interval '24 hours'
       ORDER BY ts DESC
       LIMIT $2
     ) latest
     ORDER BY ts ASC`,
    [slug, limit],
  );

  const body = rows.map((r) => ({
    ts: r.ts.getTime(),
    status: r.status,
    latencyMs: r.latency_ms,
  }));

  const json = JSON.stringify(body);
  await redis.set(key, json, "EX", CACHE_TTL);

  res.setHeader("Content-Type", "application/json");
  res.send(json);
});
