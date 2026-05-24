import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db/pool.js";
import { getRedis } from "../services/redis.js";
import { getProject } from "../projects.js";

export const publicIssuesRouter = Router();

const CACHE_TTL = 30; // seconds — GitHub sync runs hourly so 30s is plenty fresh

const StateSchema = z.enum(["open", "closed", "all"]).default("open");
const QuerySchema = z.object({
  state: StateSchema,
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

interface IssueRow {
  project: string;
  number: number;
  title: string;
  state: "open" | "closed";
  opened_at: Date;
  closed_at: Date | null;
  html_url: string;
}

interface IssueOut {
  project: string;
  number: number;
  title: string;
  state: "open" | "closed";
  openedAt: number;
  closedAt: number | null;
  url: string;
}

function rowToOut(r: IssueRow): IssueOut {
  return {
    project: r.project,
    number: r.number,
    title: r.title,
    state: r.state,
    openedAt: r.opened_at.getTime(),
    closedAt: r.closed_at?.getTime() ?? null,
    url: r.html_url,
  };
}

// Per-project: GET /api/public/projects/:slug/issues?state=open|closed|all&limit=10
publicIssuesRouter.get("/api/public/projects/:slug/issues", async (req, res) => {
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

  const { state, limit } = parsed.data;
  const key = `controlroom:cache:issues:p:${slug}:${state}:${limit}`;
  const redis = getRedis();

  const cached = await redis.get(key);
  if (cached !== null) {
    res.setHeader("Content-Type", "application/json");
    res.send(cached);
    return;
  }

  const pool = getPool();
  const where = state === "all" ? "" : "AND state = $2";
  const params: unknown[] = [slug];
  if (state !== "all") params.push(state);
  params.push(limit);
  const { rows } = await pool.query<IssueRow>(
    `SELECT project, number, title, state, opened_at, closed_at, html_url
     FROM issues_cache
     WHERE project = $1 ${where}
     ORDER BY opened_at DESC
     LIMIT $${params.length}`,
    params,
  );

  const json = JSON.stringify(rows.map(rowToOut));
  await redis.set(key, json, "EX", CACHE_TTL);
  res.setHeader("Content-Type", "application/json");
  res.send(json);
});

// Aggregated across all live projects: GET /api/public/issues?state=...&limit=...
publicIssuesRouter.get("/api/public/issues", async (req, res) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad query params", details: parsed.error.flatten() });
    return;
  }

  const { state, limit } = parsed.data;
  const key = `controlroom:cache:issues:all:${state}:${limit}`;
  const redis = getRedis();

  const cached = await redis.get(key);
  if (cached !== null) {
    res.setHeader("Content-Type", "application/json");
    res.send(cached);
    return;
  }

  const pool = getPool();
  const where = state === "all" ? "" : "WHERE state = $1";
  const params: unknown[] = state === "all" ? [] : [state];
  params.push(limit);
  const { rows } = await pool.query<IssueRow>(
    `SELECT project, number, title, state, opened_at, closed_at, html_url
     FROM issues_cache
     ${where}
     ORDER BY opened_at DESC
     LIMIT $${params.length}`,
    params,
  );

  const json = JSON.stringify(rows.map(rowToOut));
  await redis.set(key, json, "EX", CACHE_TTL);
  res.setHeader("Content-Type", "application/json");
  res.send(json);
});
