import { Router } from "express";
import { getPool } from "../db/pool.js";
import { getRedis } from "../services/redis.js";
import { getLiveProjects, projects } from "../projects.js";

export const publicStatsRouter = Router();

const CACHE_KEY = "controlroom:cache:public_stats";
const CACHE_TTL = 30; // seconds

interface CountRow {
  n: string;
}

publicStatsRouter.get("/api/public/stats", async (_req, res) => {
  const redis = getRedis();
  const cached = await redis.get(CACHE_KEY);
  if (cached !== null) {
    res.setHeader("Content-Type", "application/json");
    res.send(cached);
    return;
  }

  const pool = getPool();
  const [commits, deploys] = await Promise.all([
    pool.query<CountRow>("SELECT count(*) AS n FROM commits_cache"),
    pool.query<CountRow>(
      "SELECT count(*) AS n FROM deploys WHERE started_at >= now() - interval '7 days'",
    ),
  ]);

  const body = {
    projectsLive: getLiveProjects().length,
    projectsTotal: projects.length,
    commitsCached: Number(commits.rows[0]?.n ?? 0),
    deploysLastWeek: Number(deploys.rows[0]?.n ?? 0),
  };

  const json = JSON.stringify(body);
  await redis.set(CACHE_KEY, json, "EX", CACHE_TTL);
  res.setHeader("Content-Type", "application/json");
  res.send(json);
});
