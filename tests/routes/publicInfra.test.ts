import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import request from "supertest";
import { createApp } from "../../src/server/app.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("GET /api/public/infra", () => {
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

  it("returns vm + postgres + redis + containers + cost payload", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/infra");
    expect(res.status).toBe(200);
    const body = res.body as {
      vm: { available: boolean; uptimeSeconds: number };
      postgres: { up: boolean };
      redis: { up: boolean };
      containers: Array<{ code: string; role: string; up: boolean }>;
      cost: { monthlyUsd: number };
    };

    // Postgres + Redis are live in the CI service containers.
    expect(body.postgres.up).toBe(true);
    expect(body.redis.up).toBe(true);

    // Container list: controlroom + 2 shared services + 1 live project (shortlive)
    // + 1 collapsed "UPCOMING" tile = 5
    expect(body.containers.length).toBe(3 + 1 + 1);
    expect(body.containers.find((c) => c.code === "CTL")?.role).toBe("app");
    expect(body.containers.find((c) => c.code === "DB")?.role).toBe("shared");
    expect(body.containers.find((c) => c.code === "CR-01")?.role).toBe("project");
    const upcoming = body.containers.find((c) => c.code === "UPCOMING");
    expect(upcoming?.role).toBe("planned");
    expect(upcoming?.up).toBe(false);
    // CR-02 etc are no longer surfaced individually
    expect(body.containers.find((c) => c.code === "CR-02")).toBeUndefined();

    expect(body.cost.monthlyUsd).toBeGreaterThan(0);

    // VM block is shape-checked but unavailable in CI (no Azure creds).
    expect(body.vm.uptimeSeconds).toBeGreaterThan(0);
  });
});
