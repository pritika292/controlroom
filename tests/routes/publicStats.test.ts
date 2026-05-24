import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import request from "supertest";
import { createApp } from "../../src/server/app.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("GET /api/public/stats", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE commits_cache, deploys");
    const redis = getRedis();
    await redis.flushdb();
  });

  afterAll(async () => {
    await client.end();
    await closeRedis();
  });

  it("returns counts plus projects live / total", async () => {
    await client.query(
      `INSERT INTO commits_cache (project, sha, author, message, ts) VALUES
       ('shortlive', 'aa', 'p', 'm1', now()),
       ('shortlive', 'bb', 'p', 'm2', now())`,
    );
    await client.query(
      `INSERT INTO deploys (project, sha, actor, started_at, status, run_url) VALUES
       ('shortlive', 'aa', 'p', now() - interval '1 day', 'success', 'https://x'),
       ('shortlive', 'bb', 'p', now() - interval '3 days', 'success', 'https://x'),
       ('shortlive', 'cc', 'p', now() - interval '10 days', 'success', 'https://x')`,
    );

    const app = createApp();
    const res = await request(app).get("/api/public/stats");
    expect(res.status).toBe(200);
    const body = res.body as {
      projectsLive: number;
      projectsTotal: number;
      commitsCached: number;
      deploysLastWeek: number;
    };
    expect(body.projectsLive).toBe(4);
    expect(body.projectsTotal).toBe(14);
    expect(body.commitsCached).toBe(2);
    // Last 7 days: only the rows at -1d and -3d (the -10d row is excluded).
    expect(body.deploysLastWeek).toBe(2);
  });
});
