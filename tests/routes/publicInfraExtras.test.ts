import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import request from "supertest";
import { createApp } from "../../src/server/app.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("GET /api/public/infra-extras", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    const redis = getRedis();
    await redis.flushdb();
  });

  afterAll(async () => {
    await client.end();
    await closeRedis();
  });

  it("returns 200 with the expected shape", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/infra-extras");
    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(body).toHaveProperty("visitsThisWeek");
    expect(body).toHaveProperty("deploysThisWeek");
    expect(body).toHaveProperty("openIssues");
    expect(body).toHaveProperty("pgConnections");
    expect(body).toHaveProperty("redisKeys");
    expect(body).toHaveProperty("lastDeploy");
    expect(body).toHaveProperty("uptime7dPct");
    expect(body).toHaveProperty("ai");
  });
});
