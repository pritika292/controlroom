import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db/pool.js";
import { getRedis } from "../services/redis.js";
import { getProject } from "../projects.js";

export const projectCommitsRouter = Router();

const CACHE_TTL = 30; // seconds — GitHub sync runs hourly so 30s is plenty fresh

function cacheKey(slug: string, limit: number): string {
  return `controlroom:cache:commits:${slug}:${limit}`;
}

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

interface CommitRow {
  sha: string;
  author: string | null;
  message: string;
  ts: Date;
}

projectCommitsRouter.get("/api/public/projects/:slug/commits", async (req, res) => {
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
  const { rows } = await pool.query<CommitRow>(
    `SELECT sha, author, message, ts
     FROM commits_cache
     WHERE project = $1
     ORDER BY ts DESC
     LIMIT $2`,
    [slug, limit],
  );

  const body = rows.map((r) => ({
    sha: r.sha,
    author: r.author,
    message: r.message,
    ts: r.ts.getTime(),
  }));

  const json = JSON.stringify(body);
  await redis.set(key, json, "EX", CACHE_TTL);

  res.setHeader("Content-Type", "application/json");
  res.send(json);
});
