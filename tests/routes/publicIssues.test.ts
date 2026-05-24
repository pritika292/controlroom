import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import request from "supertest";
import { createApp } from "../../src/server/app.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("GET /api/public/issues (+ /projects/:slug/issues)", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE issues_cache");
    const redis = getRedis();
    await redis.flushdb();
  });

  afterAll(async () => {
    await client.end();
    await closeRedis();
  });

  async function seed(): Promise<void> {
    await client.query(
      `INSERT INTO issues_cache (project, number, title, state, opened_at, closed_at, html_url) VALUES
       ('shortlive',    1, 'oldest open', 'open',   now() - interval '3 days', NULL,
                          'https://github.com/p/p/issues/1'),
       ('shortlive',    2, 'closed bug',  'closed', now() - interval '2 days', now() - interval '1 day',
                          'https://github.com/p/p/issues/2'),
       ('pg-inspector', 5, 'newer open',  'open',   now() - interval '1 day', NULL,
                          'https://github.com/p/p/issues/5')`,
    );
  }

  it("aggregated: returns open issues newest-first by default", async () => {
    await seed();
    const app = createApp();
    const res = await request(app).get("/api/public/issues");
    expect(res.status).toBe(200);
    const body = res.body as Array<{ number: number; project: string; state: string }>;
    expect(body).toHaveLength(2);
    expect(body[0]!.project).toBe("pg-inspector");
    expect(body[0]!.number).toBe(5);
    expect(body.every((i) => i.state === "open")).toBe(true);
  });

  it("aggregated: state=closed returns only closed", async () => {
    await seed();
    const app = createApp();
    const res = await request(app).get("/api/public/issues?state=closed");
    expect(res.status).toBe(200);
    const body = res.body as Array<{ number: number; state: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]!.number).toBe(2);
    expect(body[0]!.state).toBe("closed");
  });

  it("aggregated: state=all returns both", async () => {
    await seed();
    const app = createApp();
    const res = await request(app).get("/api/public/issues?state=all");
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBe(3);
  });

  it("per-project: scopes to the slug", async () => {
    await seed();
    const app = createApp();
    const res = await request(app).get("/api/public/projects/shortlive/issues?state=all");
    expect(res.status).toBe(200);
    const body = res.body as Array<{ project: string }>;
    expect(body).toHaveLength(2);
    expect(body.every((i) => i.project === "shortlive")).toBe(true);
  });

  it("per-project: 404 for an unknown slug", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/projects/notreal/issues");
    expect(res.status).toBe(404);
  });

  it("rejects an out-of-range limit", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/issues?limit=0");
    expect(res.status).toBe(400);
  });
});
