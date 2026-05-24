import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import request from "supertest";
import { createApp } from "../../src/server/app.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("GET /api/public/visits + per-project daily", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE site_visits");
    const redis = getRedis();
    await redis.flushdb();
  });

  afterAll(async () => {
    await client.end();
    await closeRedis();
  });

  it("aggregate returns one row per live project", async () => {
    await client.query(
      `INSERT INTO site_visits (project, ts, ip_hash, ua_kind) VALUES
       ('shortlive',    now() - interval '1 day', 'h1', 'desktop'),
       ('pg-inspector', now() - interval '1 day', 'h2', 'mobile')`,
    );

    const app = createApp();
    const res = await request(app).get("/api/public/visits");
    expect(res.status).toBe(200);

    const body = res.body as Array<{ slug: string; thisWeek: number; lastWeek: number }>;
    const slugs = body.map((r) => r.slug).sort();
    // All live projects from the registry.
    expect(slugs).toEqual(
      ["controlroom", "focusroom", "pg-inspector", "portfolio", "shortlive"].sort(),
    );

    const sl = body.find((r) => r.slug === "shortlive")!;
    expect(sl.thisWeek).toBe(1);
  });

  it("per-project daily returns YYYY-MM-DD buckets", async () => {
    await client.query(
      `INSERT INTO site_visits (project, ts, ip_hash, ua_kind) VALUES
       ('shortlive', now() - interval '1 day', 'h1', 'desktop'),
       ('shortlive', now() - interval '1 day', 'h2', 'desktop'),
       ('shortlive', now() - interval '3 days','h3', 'desktop')`,
    );

    const app = createApp();
    const res = await request(app).get("/api/public/projects/shortlive/visits?days=7");
    expect(res.status).toBe(200);

    const body = res.body as Array<{ day: string; count: number }>;
    const total = body.reduce((acc, r) => acc + r.count, 0);
    expect(total).toBe(3);
    expect(body.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.day))).toBe(true);
  });

  it("per-project daily 404s for an unknown slug", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/projects/does-not-exist/visits");
    expect(res.status).toBe(404);
  });

  it("per-project daily rejects days > 90", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/projects/shortlive/visits?days=200");
    expect(res.status).toBe(400);
  });

  it("aggregate is cached for a short window", async () => {
    const app = createApp();
    const first = await request(app).get("/api/public/visits");
    expect(first.status).toBe(200);
    const firstLen = (first.body as unknown[]).length;

    // Insert one visit after first request; second should serve cached.
    await client.query(
      `INSERT INTO site_visits (project, ts, ip_hash, ua_kind)
       VALUES ('shortlive', now(), 'h1', 'desktop')`,
    );
    const second = await request(app).get("/api/public/visits");
    expect(second.status).toBe(200);
    const second2 = second.body as Array<{ slug: string; thisWeek: number }>;
    // Same shape — cached aggregation didn't see the new row.
    expect(second2.length).toBe(firstLen);
    expect(second2.find((r) => r.slug === "shortlive")!.thisWeek).toBe(0);
  });
});
