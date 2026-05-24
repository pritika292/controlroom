import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import request from "supertest";
import { createApp } from "../../src/server/app.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("POST /api/visit/:slug", () => {
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

  it("returns 204 and writes a row for a known live slug", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/visit/shortlive")
      .set("User-Agent", "Mozilla/5.0 (Macintosh) Chrome/121");
    expect(res.status).toBe(204);

    const { rows } = await client.query<{ project: string; ua_kind: string }>(
      "SELECT project, ua_kind FROM site_visits",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.project).toBe("shortlive");
    expect(rows[0]!.ua_kind).toBe("desktop");
  });

  it("classifies a curl beacon as a bot", async () => {
    const app = createApp();
    const res = await request(app).post("/api/visit/shortlive").set("User-Agent", "curl/8.4.0");
    expect(res.status).toBe(204);

    const { rows } = await client.query<{ ua_kind: string }>("SELECT ua_kind FROM site_visits");
    expect(rows[0]!.ua_kind).toBe("bot");
  });

  it("returns 404 for an unknown slug and writes no row", async () => {
    const app = createApp();
    const res = await request(app).post("/api/visit/does-not-exist");
    expect(res.status).toBe(404);

    const { rows } = await client.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM site_visits",
    );
    expect(rows[0]!.n).toBe("0");
  });

  it("rejects POST to a slug that fails the getOnly regex (caps over 40 chars)", async () => {
    const app = createApp();
    const longSlug = "a".repeat(50);
    const res = await request(app).post(`/api/visit/${longSlug}`);
    // getOnly returns 405 before the route ever sees this.
    expect(res.status).toBe(405);
  });

  it("rejects POSTs to other paths with 405", async () => {
    const app = createApp();
    const res = await request(app).post("/api/public/stats");
    expect(res.status).toBe(405);
  });
});
