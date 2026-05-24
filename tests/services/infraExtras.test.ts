import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { infraExtras } from "../../src/server/services/infraExtras.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("infraExtras", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE site_visits");
    await client.query("TRUNCATE deploys");
    await client.query("TRUNCATE issues_cache");
    await client.query("TRUNCATE health_pings");
    const redis = getRedis();
    await redis.flushdb();
  });

  afterAll(async () => {
    await client.end();
    await closeRedis();
  });

  it("aggregates visits, deploys, issues, uptime, and pg/redis stats", async () => {
    // Seed: 3 visits across two projects this week, 1 bot excluded.
    await client.query(
      `INSERT INTO site_visits (project, ts, ip_hash, ua_kind) VALUES
       ('shortlive',    now() - interval '1 day', 'h1', 'desktop'),
       ('shortlive',    now() - interval '2 days', 'h2', 'mobile'),
       ('pg-inspector', now() - interval '3 days', 'h3', 'desktop'),
       ('shortlive',    now() - interval '1 day',  'b1', 'bot')`,
    );

    // Deploys: 2 in last week, 1 too old.
    await client.query(
      `INSERT INTO deploys (project, sha, actor, started_at, finished_at, status, run_url) VALUES
       ('shortlive', 'a1', 'pritika', now() - interval '1 day',  now() - interval '1 day',  'success', 'x'),
       ('shortlive', 'a2', 'pritika', now() - interval '2 days', now() - interval '2 days', 'success', 'x'),
       ('shortlive', 'a3', 'pritika', now() - interval '20 days',now() - interval '20 days','success', 'x')`,
    );

    await client.query(
      `INSERT INTO issues_cache (project, number, title, state, opened_at, closed_at, html_url) VALUES
       ('shortlive', 1, 't1', 'open',   now(), NULL,  'x'),
       ('shortlive', 2, 't2', 'open',   now(), NULL,  'x'),
       ('shortlive', 3, 't3', 'closed', now(), now(),'x')`,
    );

    // Pings: 4 up, 1 down → 80% uptime.
    await client.query(
      `INSERT INTO health_pings (project, ts, status, latency_ms) VALUES
       ('shortlive', now() - interval '1 hour', 'up',   10),
       ('shortlive', now() - interval '2 hours','up',   10),
       ('shortlive', now() - interval '3 hours','up',   10),
       ('shortlive', now() - interval '4 hours','up',   10),
       ('shortlive', now() - interval '5 hours','down', NULL)`,
    );

    const x = await infraExtras();

    expect(x.visitsThisWeek).toBe(3); // bot excluded
    expect(x.deploysThisWeek).toBe(2);
    expect(x.openIssues).toBe(2);
    expect(x.uptime7dPct).toBeCloseTo(80, 0);
    expect(x.pgConnections.used).toBeGreaterThan(0);
    expect(x.pgConnections.max).toBeGreaterThan(0);
    expect(x.redisKeys).toBeGreaterThanOrEqual(0);
    expect(x.lastDeploy).not.toBeNull();
    expect(x.lastDeploy?.slug).toBe("shortlive");
    expect(x.lastDeploy?.status).toBe("success");
    expect(x.largestTable).not.toBeNull();
  });

  it("returns null trend fields when there is no data", async () => {
    const x = await infraExtras();
    expect(x.visitsThisWeek).toBe(0);
    expect(x.deploysThisWeek).toBe(0);
    expect(x.openIssues).toBe(0);
    expect(x.uptime7dPct).toBeNull();
    expect(x.lastDeploy).toBeNull();
  });
});
