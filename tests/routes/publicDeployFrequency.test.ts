import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import request from "supertest";
import { createApp } from "../../src/server/app.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("GET /api/public/deploys/frequency", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE deploys");
    const redis = getRedis();
    await redis.flushdb();
  });

  afterAll(async () => {
    await client.end();
    await closeRedis();
  });

  it("returns one bucket per day in the requested window", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/deploys/frequency?days=7");
    expect(res.status).toBe(200);
    const body = res.body as {
      days: number;
      total: number;
      buckets: Array<{ date: string; count: number }>;
    };
    expect(body.days).toBe(7);
    expect(body.buckets).toHaveLength(7);
    // All zeros, total = 0
    expect(body.total).toBe(0);
    // Buckets are sorted ascending; last one is today
    const dates = body.buckets.map((b) => b.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("counts successful deploys into the right day bucket", async () => {
    await client.query(
      `INSERT INTO deploys (project, sha, actor, started_at, status, run_url) VALUES
       ('shortlive', 'aa', 'p', now() - interval '1 day', 'success', 'x'),
       ('shortlive', 'bb', 'p', now() - interval '1 day', 'success', 'x'),
       ('shortlive', 'cc', 'p', now() - interval '3 days', 'success', 'x'),
       ('shortlive', 'dd', 'p', now() - interval '3 days', 'failure', 'x')`,
    );

    const app = createApp();
    const res = await request(app).get("/api/public/deploys/frequency?days=14");
    expect(res.status).toBe(200);
    const body = res.body as { total: number; buckets: Array<{ count: number }> };
    // 3 successful; failure excluded
    expect(body.total).toBe(3);
  });

  it("rejects out-of-range day count", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/deploys/frequency?days=999");
    expect(res.status).toBe(400);
  });
});
