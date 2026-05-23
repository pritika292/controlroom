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
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        fakeCommit("a".repeat(40), "first", "2026-05-20T00:00:00Z"),
        fakeCommit("b".repeat(40), "second\nlong body", "2026-05-21T00:00:00Z"),
      ],
    });
    vi.stubGlobal("fetch", fetchSpy);

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

    // GITHUB_PAT is set in tests/setup.server.ts, so the Authorization
    // header should be present. Asserting this protects the inverse case
    // (no PAT -> no Authorization header) by proving the conditional is
    // wired to that env var rather than always-on.
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["Authorization"]).toMatch(/^Bearer github_pat_/);
    expect(headers?.["User-Agent"]).toBe("controlroom-sync");
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

  it("backfills deploys from the GitHub actions runs API", async () => {
    await client.query("TRUNCATE deploys");

    // Two endpoints: /commits returns an empty array; /actions/runs returns
    // two deploy runs and one CI run that should be filtered out.
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes("/commits")) {
        return { ok: true, json: async () => [] };
      }
      if (url.includes("/actions/runs")) {
        return {
          ok: true,
          json: async () => ({
            workflow_runs: [
              {
                id: 1,
                name: "deploy",
                head_sha: "a".repeat(40),
                status: "completed",
                conclusion: "success",
                html_url: "https://github.com/pritika292/shortlive/actions/runs/1",
                run_started_at: "2026-05-23T08:00:00Z",
                updated_at: "2026-05-23T08:02:15Z",
                actor: { login: "pritika292" },
              },
              {
                id: 2,
                name: "ci",
                head_sha: "b".repeat(40),
                status: "completed",
                conclusion: "success",
                html_url: "https://github.com/pritika292/shortlive/actions/runs/2",
                run_started_at: "2026-05-23T07:00:00Z",
                updated_at: "2026-05-23T07:01:30Z",
                actor: { login: "pritika292" },
              },
            ],
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchSpy);

    await syncOnce();

    const { rows } = await client.query<{
      project: string;
      sha: string;
      status: string;
      actor: string;
    }>("SELECT project, sha, status, actor FROM deploys");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.project).toBe("shortlive");
    expect(rows[0]!.status).toBe("success");
    expect(rows[0]!.actor).toBe("pritika292");
  });
});
