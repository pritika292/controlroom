import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import request from "supertest";
import { createApp } from "../../src/server/app.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("GET /api/public/status", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE health_pings");
    const redis = getRedis();
    await redis.flushdb();
  });

  afterAll(async () => {
    await client.end();
    await closeRedis();
  });

  it("returns all projects with null last-ping fields when health_pings is empty", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/status");
    expect(res.status).toBe(200);

    const body = res.body as Array<{
      slug: string;
      name: string;
      status: string;
      lastStatus: string | null;
      lastPingAt: string | null;
      latencyMs: number | null;
    }>;

    expect(body.length).toBeGreaterThan(0);
    for (const row of body) {
      expect(row.lastStatus).toBeNull();
      expect(row.lastPingAt).toBeNull();
      expect(row.latencyMs).toBeNull();
    }
  });

  it("reflects the most recent ping for live projects", async () => {
    await client.query(
      `INSERT INTO health_pings (project, ts, status, latency_ms)
       VALUES ('shortlive', now() - interval '10 seconds', 'up', 42),
              ('shortlive', now(), 'down', null)`,
    );

    const app = createApp();
    const res = await request(app).get("/api/public/status");
    expect(res.status).toBe(200);

    const body = res.body as Array<{
      slug: string;
      lastStatus: string | null;
      latencyMs: number | null;
    }>;

    const row = body.find((r) => r.slug === "shortlive");
    expect(row).toBeDefined();
    // Most recent ping is 'down' with null latency.
    expect(row!.lastStatus).toBe("down");
    expect(row!.latencyMs).toBeNull();
  });

  it("planned projects always have null last-ping fields", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/status");
    expect(res.status).toBe(200);

    const body = res.body as Array<{
      slug: string;
      status: string;
      lastStatus: string | null;
      lastPingAt: string | null;
      latencyMs: number | null;
    }>;

    const planned = body.filter((r) => r.status === "planned");
    expect(planned.length).toBeGreaterThan(0);
    for (const row of planned) {
      expect(row.lastStatus).toBeNull();
      expect(row.lastPingAt).toBeNull();
      expect(row.latencyMs).toBeNull();
    }
  });

  it("returns cached body on second request within 5 seconds", async () => {
    const app = createApp();

    // First request — cache miss, DB is empty.
    const first = await request(app).get("/api/public/status");
    expect(first.status).toBe(200);

    // Seed a ping row AFTER the first request.
    await client.query(
      `INSERT INTO health_pings (project, ts, status, latency_ms)
       VALUES ('shortlive', now(), 'up', 99)`,
    );

    // Second request — should still return the cached (empty-pings) body.
    const second = await request(app).get("/api/public/status");
    expect(second.status).toBe(200);

    const firstRow = (first.body as Array<{ slug: string; lastStatus: string | null }>).find(
      (r) => r.slug === "shortlive",
    );
    const secondRow = (second.body as Array<{ slug: string; lastStatus: string | null }>).find(
      (r) => r.slug === "shortlive",
    );

    // Both should match — the cache returned the old body.
    expect(secondRow!.lastStatus).toBe(firstRow!.lastStatus);
  });
});
