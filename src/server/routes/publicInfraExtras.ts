import { Router } from "express";
import { getRedis } from "../services/redis.js";
import { infraExtras } from "../services/infraExtras.js";

export const publicInfraExtrasRouter = Router();

const CACHE_KEY = "controlroom:cache:public_infra_extras";
const CACHE_TTL = 30; // seconds

publicInfraExtrasRouter.get("/api/public/infra-extras", async (_req, res) => {
  const redis = getRedis();
  const cached = await redis.get(CACHE_KEY);
  if (cached !== null) {
    res.setHeader("Content-Type", "application/json");
    res.send(cached);
    return;
  }

  const body = await infraExtras();
  const json = JSON.stringify(body);
  await redis.set(CACHE_KEY, json, "EX", CACHE_TTL);
  res.setHeader("Content-Type", "application/json");
  res.send(json);
});
