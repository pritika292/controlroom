import { Router } from "express";
import { getPool } from "../db/pool.js";
import { getRedis } from "../services/redis.js";
import { projects } from "../projects.js";

export const publicStatusRouter = Router();

const CACHE_KEY = "controlroom:cache:public_status";
const CACHE_TTL = 5; // seconds

interface PingRow {
  project: string;
  status: "up" | "down" | "timeout" | "error";
  latency_ms: number | null;
  ts: Date;
}

publicStatusRouter.get("/api/public/status", async (_req, res) => {
  const redis = getRedis();

  const cached = await redis.get(CACHE_KEY);
  if (cached !== null) {
    res.setHeader("Content-Type", "application/json");
    res.send(cached);
    return;
  }

  const pool = getPool();
  const { rows } = await pool.query<PingRow>(
    `SELECT DISTINCT ON (project) project, status, latency_ms, ts
     FROM health_pings
     ORDER BY project, ts DESC`,
  );

  // Index ping rows by project slug for O(1) lookup.
  const pingBySlug = new Map(rows.map((r) => [r.project, r]));

  const body = projects.map((p) => {
    const ping = p.status === "live" ? pingBySlug.get(p.slug) : undefined;
    return {
      slug: p.slug,
      name: p.name,
      status: p.status,
      lastStatus: ping?.status ?? null,
      lastPingAt: ping ? ping.ts.toISOString() : null,
      latencyMs: ping?.latency_ms ?? null,
    };
  });

  const json = JSON.stringify(body);
  await redis.set(CACHE_KEY, json, "EX", CACHE_TTL);

  res.setHeader("Content-Type", "application/json");
  res.send(json);
});
