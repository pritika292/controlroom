import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import {
  aggregateVisits,
  classifyUserAgent,
  dailyVisitsForProject,
  hashIp,
  recordVisit,
  sweepOldVisits,
} from "../../src/server/services/visits.js";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describe("classifyUserAgent", () => {
  it("returns 'bot' for empty / missing UA", () => {
    expect(classifyUserAgent(undefined)).toBe("bot");
    expect(classifyUserAgent("")).toBe("bot");
  });

  it("returns 'bot' for known bot UAs", () => {
    expect(classifyUserAgent("Googlebot/2.1")).toBe("bot");
    expect(classifyUserAgent("curl/8.4.0")).toBe("bot");
    expect(classifyUserAgent("python-requests/2.31.0")).toBe("bot");
    expect(classifyUserAgent("axios/1.6.2")).toBe("bot");
    expect(classifyUserAgent("HeadlessChrome/121")).toBe("bot");
  });

  it("returns 'mobile' for iPhone / Android UAs", () => {
    expect(
      classifyUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe("mobile");
    expect(classifyUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("mobile");
  });

  it("returns 'desktop' for an ordinary Chrome UA", () => {
    expect(
      classifyUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121",
      ),
    ).toBe("desktop");
  });
});

describeIfDb("hashIp", () => {
  beforeEach(async () => {
    const redis = getRedis();
    await redis.flushdb();
  });

  afterAll(async () => {
    await closeRedis();
  });

  it("returns the same hash for the same IP within a day", async () => {
    const a = await hashIp("203.0.113.4");
    const b = await hashIp("203.0.113.4");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("returns different hashes for different IPs", async () => {
    const a = await hashIp("203.0.113.4");
    const b = await hashIp("203.0.113.5");
    expect(a).not.toBe(b);
  });
});

describeIfDb("recordVisit + aggregations", () => {
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

  it("recordVisit inserts a row with hashed IP + ua classification", async () => {
    await recordVisit({
      project: "shortlive",
      ip: "203.0.113.10",
      userAgent: "Mozilla/5.0 (Macintosh) Chrome/121",
    });

    const { rows } = await client.query<{
      project: string;
      ip_hash: string;
      ua_kind: string;
    }>("SELECT project, ip_hash, ua_kind FROM site_visits");

    expect(rows).toHaveLength(1);
    expect(rows[0]!.project).toBe("shortlive");
    expect(rows[0]!.ua_kind).toBe("desktop");
    expect(rows[0]!.ip_hash).toHaveLength(64);
    // Hash, not raw IP.
    expect(rows[0]!.ip_hash).not.toContain("203.0.113");
  });

  it("aggregateVisits returns this/last week counts excluding bots", async () => {
    // Seed: 3 human visits this week, 1 bot this week, 2 human last week.
    await client.query(
      `INSERT INTO site_visits (project, ts, ip_hash, ua_kind) VALUES
       ('shortlive', now() - interval '1 day',  'h1', 'desktop'),
       ('shortlive', now() - interval '2 days', 'h2', 'mobile'),
       ('shortlive', now() - interval '3 days', 'h3', 'desktop'),
       ('shortlive', now() - interval '1 day',  'b1', 'bot'),
       ('shortlive', now() - interval '8 days', 'h4', 'desktop'),
       ('shortlive', now() - interval '10 days','h5', 'mobile')`,
    );

    const rows = await aggregateVisits(["shortlive", "pg-inspector"]);
    expect(rows).toHaveLength(2);

    const sl = rows.find((r) => r.slug === "shortlive")!;
    expect(sl.thisWeek).toBe(3);
    expect(sl.lastWeek).toBe(2);
    expect(sl.trend).toBe("up");

    const pg2 = rows.find((r) => r.slug === "pg-inspector")!;
    expect(pg2.thisWeek).toBe(0);
    expect(pg2.lastWeek).toBe(0);
    expect(pg2.trend).toBe("flat");
  });

  it("aggregateVisits returns 'down' when this week < last week", async () => {
    await client.query(
      `INSERT INTO site_visits (project, ts, ip_hash, ua_kind) VALUES
       ('shortlive', now() - interval '1 day',  'h1', 'desktop'),
       ('shortlive', now() - interval '8 days', 'h2', 'desktop'),
       ('shortlive', now() - interval '9 days', 'h3', 'desktop')`,
    );
    const rows = await aggregateVisits(["shortlive"]);
    expect(rows[0]!.trend).toBe("down");
  });

  it("dailyVisitsForProject buckets by day and excludes bots", async () => {
    await client.query(
      `INSERT INTO site_visits (project, ts, ip_hash, ua_kind) VALUES
       ('shortlive', now() - interval '1 day',  'h1', 'desktop'),
       ('shortlive', now() - interval '1 day',  'h2', 'mobile'),
       ('shortlive', now() - interval '1 day',  'b1', 'bot'),
       ('shortlive', now() - interval '3 days', 'h3', 'desktop')`,
    );

    const rows = await dailyVisitsForProject("shortlive", 7);
    const total = rows.reduce((acc, r) => acc + r.count, 0);
    // 3 humans, 1 bot excluded.
    expect(total).toBe(3);
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.day))).toBe(true);
  });

  it("sweepOldVisits deletes rows older than the retention window", async () => {
    await client.query(
      `INSERT INTO site_visits (project, ts, ip_hash, ua_kind) VALUES
       ('shortlive', now() - interval '1 day',   'fresh',  'desktop'),
       ('shortlive', now() - interval '100 days','old',    'desktop'),
       ('shortlive', now() - interval '95 days', 'old2',   'desktop')`,
    );
    const deleted = await sweepOldVisits(90);
    expect(deleted).toBe(2);

    const { rows } = await client.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM site_visits",
    );
    expect(rows[0]!.n).toBe("1");
  });
});
