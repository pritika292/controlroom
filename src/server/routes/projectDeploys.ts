import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db/pool.js";
import { getRedis } from "../services/redis.js";
import { getProject } from "../projects.js";

export const projectDeploysRouter = Router();

const CACHE_TTL = 15; // seconds — webhook pushes are bursty; short cache keeps the UI fresh

function cacheKey(slug: string, limit: number): string {
  return `controlroom:cache:deploys:${slug}:${limit}`;
}

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

interface DeployRow {
  sha: string;
  actor: string | null;
  started_at: Date;
  finished_at: Date | null;
  status: string;
  run_url: string | null;
}

projectDeploysRouter.get("/api/public/projects/:slug/deploys", async (req, res) => {
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
  const key = cacheKey(slug, limit);
  const redis = getRedis();

  const cached = await redis.get(key);
  if (cached !== null) {
    res.setHeader("Content-Type", "application/json");
    res.send(cached);
    return;
  }

  const pool = getPool();
  const { rows } = await pool.query<DeployRow>(
    `SELECT sha, actor, started_at, finished_at, status, run_url
     FROM deploys
     WHERE project = $1
     ORDER BY started_at DESC
     LIMIT $2`,
    [slug, limit],
  );

  const body = rows.map((r) => ({
    sha: r.sha,
    actor: r.actor,
    startedAt: r.started_at.getTime(),
    finishedAt: r.finished_at?.getTime() ?? null,
    durationMs: r.finished_at !== null ? r.finished_at.getTime() - r.started_at.getTime() : null,
    status: r.status,
    runUrl: r.run_url,
  }));

  const json = JSON.stringify(body);
  await redis.set(key, json, "EX", CACHE_TTL);

  res.setHeader("Content-Type", "application/json");
  res.send(json);
});
