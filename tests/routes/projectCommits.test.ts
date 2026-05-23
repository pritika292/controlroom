import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import request from "supertest";
import { createApp } from "../../src/server/app.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("GET /api/public/projects/:slug/commits", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE commits_cache");
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
    const res = await request(app).get("/api/public/projects/doesnotexist/commits");
    expect(res.status).toBe(404);
  });

  it("returns commits newest-first for a live project", async () => {
    await client.query(
      `INSERT INTO commits_cache (project, sha, author, message, ts) VALUES
       ('shortlive', 'aaa', 'pritika292', 'older', now() - interval '2 hours'),
       ('shortlive', 'bbb', 'pritika292', 'newer', now() - interval '1 hour')`,
    );

    const app = createApp();
    const res = await request(app).get("/api/public/projects/shortlive/commits");
    expect(res.status).toBe(200);
    const body = res.body as Array<{ sha: string; message: string }>;
    expect(body).toHaveLength(2);
    expect(body[0]!.sha).toBe("bbb");
    expect(body[1]!.sha).toBe("aaa");
  });

  it("clamps response to the limit query param", async () => {
    for (let i = 0; i < 8; i++) {
      await client.query(
        `INSERT INTO commits_cache (project, sha, author, message, ts)
         VALUES ('shortlive', $1, 'p', 'msg', now() - ($2 * interval '1 minute'))`,
        [`sha${i}`, i],
      );
    }

    const app = createApp();
    const res = await request(app).get("/api/public/projects/shortlive/commits?limit=3");
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBe(3);
  });

  it("returns 400 on an out-of-range limit", async () => {
    const app = createApp();
    const res = await request(app).get("/api/public/projects/shortlive/commits?limit=0");
    expect(res.status).toBe(400);
  });

  it("returns cached body within the TTL window", async () => {
    await client.query(
      `INSERT INTO commits_cache (project, sha, author, message, ts)
       VALUES ('shortlive', 'cached1', 'p', 'first', now())`,
    );

    const app = createApp();
    const first = await request(app).get("/api/public/projects/shortlive/commits");
    expect((first.body as unknown[]).length).toBe(1);

    await client.query(
      `INSERT INTO commits_cache (project, sha, author, message, ts)
       VALUES ('shortlive', 'cached2', 'p', 'second', now())`,
    );

    const second = await request(app).get("/api/public/projects/shortlive/commits");
    expect((second.body as unknown[]).length).toBe(1);
  });
});
