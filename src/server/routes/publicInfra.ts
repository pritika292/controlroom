import { Router } from "express";
import os from "node:os";
import { getRedis } from "../services/redis.js";
import { vmMetrics } from "../services/vmMetrics.js";
import { infraHealth } from "../services/infraHealth.js";
import { projects } from "../projects.js";

export const publicInfraRouter = Router();

const CACHE_KEY = "controlroom:cache:public_infra";
const CACHE_TTL = 30; // seconds

// Static cost estimate. The actual Visual Studio Enterprise credit cost is
// well below the on-demand price; this is the rough monthly retail figure
// a hiring manager can sanity-check, not the bill Pritika pays.
const COST_ESTIMATE_USD = 30;

publicInfraRouter.get("/api/public/infra", async (_req, res) => {
  const redis = getRedis();
  const cached = await redis.get(CACHE_KEY);
  if (cached !== null) {
    res.setHeader("Content-Type", "application/json");
    res.send(cached);
    return;
  }

  const [vm, health] = await Promise.all([vmMetrics(), infraHealth()]);

  // Containers reported in the panel: the controlroom app + the shared
  // services + every live project. Planned projects render greyed out.
  // The 'up' field is derived from health pings already in the registry --
  // ControlRoom and shared services are 'up' by definition if we got here.
  const containers = [
    { code: "CTL", name: "controlroom", role: "app", up: true },
    { code: "DB", name: "pritika-postgres", role: "shared", up: health.postgres.up },
    { code: "CACHE", name: "pritika-redis", role: "shared", up: health.redis.up },
    ...projects.map((p) => ({
      code: p.code,
      name: p.name,
      role: p.status === "live" ? "project" : "planned",
      up: p.status === "live", // we trust the project's own health endpoint elsewhere
    })),
  ];

  const body = {
    vm: {
      ...vm,
      uptimeSeconds: os.uptime(), // container uptime; not VM uptime
    },
    postgres: health.postgres,
    redis: health.redis,
    containers,
    cost: { monthlyUsd: COST_ESTIMATE_USD, note: "estimate at on-demand prices" },
  };

  const json = JSON.stringify(body);
  await redis.set(CACHE_KEY, json, "EX", CACHE_TTL);
  res.setHeader("Content-Type", "application/json");
  res.send(json);
});
