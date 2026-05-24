import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../../src/server/db/migrate.js";

const DATABASE_URL = process.env["DATABASE_URL"];

const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("migrate", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    // Drop all tables created by the migrations so each test starts clean.
    await client.query("DROP TABLE IF EXISTS health_pings");
    await client.query("DROP TABLE IF EXISTS deploys");
    await client.query("DROP TABLE IF EXISTS commits_cache");
    await client.query("DROP TABLE IF EXISTS issues_cache");
    await client.query("DROP TABLE IF EXISTS _migrations");
  });

  afterAll(async () => {
    await client.end();
  });

  it("runs cleanly on an empty DB and records 4 entries in _migrations", async () => {
    const result = await migrate(client);
    expect(result.applied).toHaveLength(4);
    expect(result.applied).toContain("001_health_pings.sql");
    expect(result.applied).toContain("002_deploys.sql");
    expect(result.applied).toContain("003_commits_cache.sql");
    expect(result.applied).toContain("004_issues_cache.sql");
    expect(result.skipped).toHaveLength(0);

    const { rows } = await client.query<{ name: string }>("SELECT name FROM _migrations");
    expect(rows).toHaveLength(4);
  });

  it("is idempotent: re-running leaves 4 entries, nothing re-applied", async () => {
    await migrate(client);

    const second = await migrate(client);
    expect(second.applied).toHaveLength(0);
    expect(second.skipped).toHaveLength(4);

    const { rows } = await client.query<{ name: string }>("SELECT name FROM _migrations");
    expect(rows).toHaveLength(4);
  });

  it("health_pings table has expected columns", async () => {
    await migrate(client);
    const { rows } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'health_pings'
       ORDER BY column_name`,
    );
    const cols = rows.map((r) => r.column_name);
    expect(cols).toContain("project");
    expect(cols).toContain("ts");
    expect(cols).toContain("status");
    expect(cols).toContain("latency_ms");
  });

  it("deploys table has expected columns", async () => {
    await migrate(client);
    const { rows } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'deploys'
       ORDER BY column_name`,
    );
    const cols = rows.map((r) => r.column_name);
    expect(cols).toContain("project");
    expect(cols).toContain("sha");
    expect(cols).toContain("actor");
    expect(cols).toContain("started_at");
    expect(cols).toContain("finished_at");
    expect(cols).toContain("status");
    expect(cols).toContain("run_url");
  });

  it("commits_cache table has expected columns", async () => {
    await migrate(client);
    const { rows } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'commits_cache'
       ORDER BY column_name`,
    );
    const cols = rows.map((r) => r.column_name);
    expect(cols).toContain("project");
    expect(cols).toContain("sha");
    expect(cols).toContain("author");
    expect(cols).toContain("message");
    expect(cols).toContain("ts");
  });
});
