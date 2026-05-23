import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { infraHealth } from "../../src/server/services/infraHealth.js";
import { closeRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("infraHealth", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
    await closeRedis();
  });

  it("reports postgres + redis as up with positive latency under normal conditions", async () => {
    const h = await infraHealth();
    expect(h.postgres.up).toBe(true);
    expect(h.postgres.latencyMs).not.toBeNull();
    expect(h.postgres.latencyMs).toBeGreaterThanOrEqual(0);
    expect(h.redis.up).toBe(true);
    expect(h.redis.latencyMs).not.toBeNull();
    expect(h.redis.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
