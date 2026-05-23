import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { syncOnce } from "../../src/server/services/githubSync.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

function fakeCommit(sha: string, message: string, date: string): unknown {
  return {
    sha,
    commit: { message, author: { name: "Pritika", date } },
    author: { login: "pritika292" },
  };
}

describeIfDb("githubSync", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE commits_cache");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await client.end();
  });

  it("upserts commits for each live project on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          fakeCommit("a".repeat(40), "first", "2026-05-20T00:00:00Z"),
          fakeCommit("b".repeat(40), "second\nlong body", "2026-05-21T00:00:00Z"),
        ],
      }),
    );

    await syncOnce();

    const { rows } = await client.query<{
      project: string;
      sha: string;
      message: string;
      author: string;
    }>("SELECT project, sha, message, author FROM commits_cache ORDER BY sha");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.project).toBe("shortlive");
    expect(rows[0]!.sha).toBe("a".repeat(40));
    expect(rows[0]!.author).toBe("pritika292");
    // Subject only; body trimmed.
    expect(rows[1]!.message).toBe("second");
  });

  it("is idempotent: re-running with the same commits does not duplicate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [fakeCommit("a".repeat(40), "first", "2026-05-20T00:00:00Z")],
      }),
    );

    await syncOnce();
    await syncOnce();

    const { rows } = await client.query("SELECT count(*) AS n FROM commits_cache");
    expect(Number(rows[0]!.n)).toBe(1);
  });

  it("logs and continues when GitHub returns non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: "Unauthorized" }),
    );

    await syncOnce();

    const { rows } = await client.query("SELECT count(*) AS n FROM commits_cache");
    expect(Number(rows[0]!.n)).toBe(0);
  });
});
