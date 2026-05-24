import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import pg from "pg";
import { pollOnce, resetStatusCache } from "../../src/server/services/healthPoller.js";
import { publish } from "../../src/server/services/sseHub.js";

vi.mock("../../src/server/services/sseHub.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/server/services/sseHub.js")>(
    "../../src/server/services/sseHub.js",
  );
  return { ...actual, publish: vi.fn() };
});

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

// Row shape returned from health_pings.
interface PingRow {
  project: string;
  status: string;
  latency_ms: number | null;
  ts: Date;
}

describeIfDb("healthPoller", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE health_pings");
    resetStatusCache();
    vi.mocked(publish).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await client.end();
  });

  it("inserts one row per live project with status=up when health returns {ok:true}", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );

    await pollOnce();

    const { rows } = await client.query<PingRow>(
      "SELECT project, status, latency_ms FROM health_pings ORDER BY project",
    );

    // shortlive + pg-inspector are live; both should ping.
    expect(rows).toHaveLength(2);
    const shortlive = rows.find((r) => r.project === "shortlive");
    expect(shortlive?.status).toBe("up");
    expect(shortlive?.latency_ms).not.toBeNull();
    expect(shortlive?.latency_ms).toBeGreaterThanOrEqual(0);
    expect(rows.find((r) => r.project === "pg-inspector")).toBeDefined();
  });

  it("inserts status=timeout and latency_ms=null when fetch throws AbortError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));

    await pollOnce();

    const { rows } = await client.query<PingRow>(
      "SELECT project, status, latency_ms FROM health_pings",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]!.status).toBe("timeout");
    expect(rows[0]!.latency_ms).toBeNull();
  });

  it("inserts status=down when response status is non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }),
    );

    await pollOnce();

    const { rows } = await client.query<PingRow>(
      "SELECT project, status, latency_ms FROM health_pings",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]!.status).toBe("down");
    expect(rows[0]!.latency_ms).not.toBeNull();
  });

  it("inserts status=error when response is 2xx but body is not {ok:true}", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: false }),
      }),
    );

    await pollOnce();

    const { rows } = await client.query<PingRow>(
      "SELECT project, status, latency_ms FROM health_pings",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]!.status).toBe("error");
  });

  it("retention sweep deletes rows older than 24 hours", async () => {
    // Seed a stale row directly (ts = 25 hours ago).
    await client.query(
      `INSERT INTO health_pings (project, ts, status, latency_ms)
       VALUES ('shortlive', now() - interval '25 hours', 'up', 100)`,
    );

    // Confirm the stale row is there before polling.
    const before = await client.query<{ n: string }>("SELECT count(*) AS n FROM health_pings");
    expect(Number(before.rows[0]!.n)).toBe(1);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );

    await pollOnce();

    // After pollOnce: one fresh row inserted, stale row deleted.
    const { rows } = await client.query<PingRow>(
      "SELECT project, status, ts FROM health_pings ORDER BY ts DESC",
    );

    // Only the fresh row should remain.
    expect(rows).toHaveLength(2);
    // The remaining row is recent (within the last minute).
    const ageMs = Date.now() - new Date(rows[0]!.ts).getTime();
    expect(ageMs).toBeLessThan(60_000);
  });

  it("publishes status_change on the first poll for a project", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
    );

    await pollOnce();

    // One status_change per live project (shortlive + pg-inspector).
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith(
      "status_change",
      expect.objectContaining({ slug: "shortlive", previous: null, status: "up" }),
    );
    expect(publish).toHaveBeenCalledWith(
      "status_change",
      expect.objectContaining({ slug: "pg-inspector", previous: null, status: "up" }),
    );
  });

  it("does not publish when status stays the same across polls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
    );

    await pollOnce();
    vi.mocked(publish).mockClear();
    await pollOnce();

    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes status_change when status flips", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
    );
    await pollOnce();
    vi.mocked(publish).mockClear();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await pollOnce();

    // Both projects flip up -> down on the second poll.
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith(
      "status_change",
      expect.objectContaining({ slug: "shortlive", previous: "up", status: "down" }),
    );
    expect(publish).toHaveBeenCalledWith(
      "status_change",
      expect.objectContaining({ slug: "pg-inspector", previous: "up", status: "down" }),
    );
  });
});
