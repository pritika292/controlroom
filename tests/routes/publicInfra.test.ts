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

    // Container list: controlroom + 2 shared services + 5 live projects.
    // Planned dropped after #81 — no UPCOMING tile when there's nothing
    // upcoming. Total = 3 + 5 = 8 (or 3 + 5 + 1 if the upcoming tile is
    // always rendered, but with 0 planned it should be hidden).
    expect(body.containers.length).toBeGreaterThanOrEqual(3 + 5);
    expect(body.containers.find((c) => c.code === "CTL")?.role).toBe("app");
    expect(body.containers.find((c) => c.code === "DB")?.role).toBe("shared");
    for (const code of ["CR-01", "CR-02", "CR-03", "CR-04", "CR-05"]) {
      expect(body.containers.find((c) => c.code === code)?.role).toBe("project");
    }
    // After #81 the registry has no planned entries — the UPCOMING tile
    // is now optional. If it renders it should still be in the planned/down
    // shape; if not, that's fine.
    const upcoming = body.containers.find((c) => c.code === "UPCOMING");
    if (upcoming) {
      expect(upcoming.role).toBe("planned");
      expect(upcoming.up).toBe(false);
    }

    expect(body.cost.monthlyUsd).toBeGreaterThan(0);

    // VM block is shape-checked but unavailable in CI (no Azure creds).
    expect(body.vm.uptimeSeconds).toBeGreaterThan(0);
  });
});
