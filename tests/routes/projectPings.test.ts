import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import request from "supertest";
import { createApp } from "../../src/server/app.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("GET /api/public/projects/:slug/pings", () => {
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

  it("returns 404 for an unknown slug", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/projects/doesnotexist/pings?window=24h");
    expect(res.status).toBe(404);
  });

  it("returns 200 with empty array for a planned project", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/projects/hookrelay/pings?window=24h");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns pings in ascending order for a live project", async () => {
    await client.query(
      `INSERT INTO health_pings (project, ts, status, latency_ms) VALUES
       ('shortlive', now() - interval '2 hours', 'up', 10),
       ('shortlive', now() - interval '1 hour', 'timeout', null),
       ('shortlive', now(), 'up', 20)`,
    );

    const app = createApp();
    const res = await request(app).get("/api/public/projects/shortlive/pings?window=24h");
    expect(res.status).toBe(200);

    const body = res.body as Array<{
      ts: number;
      status: string;
      latencyMs: number | null;
    }>;

    expect(body).toHaveLength(3);
    // Ascending: earliest ts first.
    expect(body[0]!.ts).toBeLessThan(body[1]!.ts);
    expect(body[1]!.ts).toBeLessThan(body[2]!.ts);
    expect(body[1]!.status).toBe("timeout");
    expect(body[1]!.latencyMs).toBeNull();
    expect(body[2]!.latencyMs).toBe(20);
  });

  it("returns 400 when window is not 24h", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/projects/shortlive/pings?window=1h");
    expect(res.status).toBe(400);
  });

  it("clamps response to limit rows", async () => {
    // Insert 10 pings.
    for (let i = 10; i >= 1; i--) {
      await client.query(
        `INSERT INTO health_pings (project, ts, status, latency_ms)
         VALUES ('shortlive', now() - ($1 * interval '1 hour'), 'up', $2)`,
        [i, i * 10],
      );
    }

    const app = createApp();
    const res = await request(app).get("/api/public/projects/shortlive/pings?window=24h&limit=5");
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBeLessThanOrEqual(5);
  });

  it("returns cached body on second request within 5 seconds", async () => {
    await client.query(
      `INSERT INTO health_pings (project, ts, status, latency_ms)
       VALUES ('shortlive', now(), 'up', 55)`,
    );

    const app = createApp();
    const first = await request(app).get("/api/public/projects/shortlive/pings?window=24h");
    expect(first.status).toBe(200);
    expect((first.body as unknown[]).length).toBe(1);

    // Add another ping after the first request.
    await client.query(
      `INSERT INTO health_pings (project, ts, status, latency_ms)
       VALUES ('shortlive', now(), 'down', null)`,
    );

    // Second request should return the cached body (still 1 entry).
    const second = await request(app).get("/api/public/projects/shortlive/pings?window=24h");
    expect(second.status).toBe(200);
    expect((second.body as unknown[]).length).toBe(1);
  });
});
