import { Router } from "express";
import { z } from "zod";
import { getRedis } from "../services/redis.js";
import { getLiveProjects, getProject } from "../projects.js";
import { aggregateVisits, dailyVisitsForProject } from "../services/visits.js";

export const publicVisitsRouter = Router();

const AGGREGATE_CACHE_KEY = "controlroom:cache:visits:aggregate";
const AGGREGATE_TTL = 60; // seconds

const DAILY_TTL = 60;
function dailyCacheKey(slug: string, days: number): string {
  return `controlroom:cache:visits:daily:${slug}:${days}`;
}

publicVisitsRouter.get("/api/public/visits", async (_req, res) => {
  const redis = getRedis();
  const cached = await redis.get(AGGREGATE_CACHE_KEY);
  if (cached !== null) {
    res.setHeader("Content-Type", "application/json");
    res.send(cached);
    return;
  }

  const slugs = getLiveProjects().map((p) => p.slug);
  const rows = await aggregateVisits(slugs);
  const json = JSON.stringify(rows);
  await redis.set(AGGREGATE_CACHE_KEY, json, "EX", AGGREGATE_TTL);
  res.setHeader("Content-Type", "application/json");
  res.send(json);
});

const DailyQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

publicVisitsRouter.get("/api/public/projects/:slug/visits", async (req, res) => {
  const { slug } = req.params;
  const project = getProject(slug);
  if (!project) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  const parsed = DailyQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad query params", details: parsed.error.flatten() });
    return;
  }
  const { days } = parsed.data;

  const redis = getRedis();
  const key = dailyCacheKey(slug, days);
  const cached = await redis.get(key);
  if (cached !== null) {
    res.setHeader("Content-Type", "application/json");
    res.send(cached);
    return;
  }

  const rows = await dailyVisitsForProject(slug, days);
  const json = JSON.stringify(rows);
  await redis.set(key, json, "EX", DAILY_TTL);
  res.setHeader("Content-Type", "application/json");
  res.send(json);
});
