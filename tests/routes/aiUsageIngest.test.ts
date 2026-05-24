import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import request from "supertest";
import { createApp } from "../../src/server/app.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("POST /api/ai-usage/:slug", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE ai_usage");
  });

  afterAll(async () => {
    await client.end();
  });

  it("returns 204 and stores a row for a known slug", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/ai-usage/pg-inspector")
      .set("Content-Type", "application/json")
      .send({
        model: "gpt-4.1-mini",
        prompt_tokens: 500,
        completion_tokens: 100,
        est_cost_cents: 0.02,
      });
    expect(res.status).toBe(204);

    const { rows } = await client.query<{ project: string; model: string }>(
      "SELECT project, model FROM ai_usage",
    );
    expect(rows[0]?.project).toBe("pg-inspector");
    expect(rows[0]?.model).toBe("gpt-4.1-mini");
  });

  it("returns 404 for an unknown slug", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/ai-usage/does-not-exist")
      .send({ model: "gpt-4.1-mini", prompt_tokens: 1, completion_tokens: 1, est_cost_cents: 0 });
    expect(res.status).toBe(404);
  });

  it("returns 400 on a malformed body", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/ai-usage/pg-inspector")
      .send({ model: "gpt-4.1-mini", prompt_tokens: -1, completion_tokens: 0, est_cost_cents: 0 });
    expect(res.status).toBe(400);
  });

  it("getOnly lets a too-long slug fail at the regex (405, not 404)", async () => {
    const app = createApp();
    const res = await request(app).post(`/api/ai-usage/${"x".repeat(50)}`);
    expect(res.status).toBe(405);
  });
});
