import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import request from "supertest";
import { createApp } from "../../src/server/app.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("GET /api/public/projects/:slug/deploys", () => {
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

  afterEach(() => {});

  afterAll(async () => {
    await client.end();
    await closeRedis();
  });

  it("returns 404 for an unknown slug", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/projects/doesnotexist/deploys");
    expect(res.status).toBe(404);
  });

  it("returns deploys newest-first with duration", async () => {
    await client.query(
      `INSERT INTO deploys (project, sha, actor, started_at, finished_at, status, run_url) VALUES
       ('shortlive', 'aaa', 'pritika292', now() - interval '2 hours', now() - interval '1 hour 58 minutes', 'success', 'https://x/1'),
       ('shortlive', 'bbb', 'pritika292', now() - interval '30 minutes', now() - interval '29 minutes', 'success', 'https://x/2')`,
    );

    const app = createApp();
    const res = await request(app).get("/api/public/projects/shortlive/deploys");
    expect(res.status).toBe(200);
    const body = res.body as Array<{
      sha: string;
      status: string;
      durationMs: number | null;
    }>;
    expect(body).toHaveLength(2);
    expect(body[0]!.sha).toBe("bbb");
    expect(body[1]!.sha).toBe("aaa");
    expect(body[0]!.durationMs).toBeGreaterThan(0);
  });

  it("clamps to limit", async () => {
    for (let i = 0; i < 6; i++) {
      await client.query(
        `INSERT INTO deploys (project, sha, actor, started_at, status, run_url)
         VALUES ('shortlive', $1, 'p', now() - ($2 * interval '1 minute'), 'success', 'https://x')`,
        [`sha${i}`, i],
      );
    }

    const app = createApp();
    const res = await request(app).get("/api/public/projects/shortlive/deploys?limit=2");
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBe(2);
  });

  it("returns cached body within the TTL window", async () => {
    await client.query(
      `INSERT INTO deploys (project, sha, actor, started_at, status, run_url)
       VALUES ('shortlive', 'first', 'p', now(), 'success', 'https://x/1')`,
    );

    const app = createApp();
    const first = await request(app).get("/api/public/projects/shortlive/deploys");
    expect((first.body as unknown[]).length).toBe(1);

    await client.query(
      `INSERT INTO deploys (project, sha, actor, started_at, status, run_url)
       VALUES ('shortlive', 'second', 'p', now(), 'success', 'https://x/2')`,
    );

    const second = await request(app).get("/api/public/projects/shortlive/deploys");
    expect((second.body as unknown[]).length).toBe(1);
  });
});
