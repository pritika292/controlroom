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

function fakeIssue(
  number: number,
  title: string,
  state: "open" | "closed",
  createdAt: string,
  closedAt: string | null = null,
): unknown {
  return {
    number,
    title,
    state,
    created_at: createdAt,
    closed_at: closedAt,
    html_url: `https://github.com/p/p/issues/${number}`,
  };
}

// Builds a fetch mock that returns shape-correct responses per URL path.
// Lets each test override one slot without breaking the other two endpoints
// syncOnce calls (commits, runs, issues).
function fetchMockBy(opts: {
  commits?: () => unknown;
  runs?: () => unknown;
  issues?: () => unknown;
  ok?: boolean;
  status?: number;
  statusText?: string;
}): ReturnType<typeof vi.fn> {
  const baseOk = opts.ok ?? true;
  return vi.fn(async (url: string) => {
    const body = url.includes("/commits")
      ? (opts.commits?.() ?? [])
      : url.includes("/actions/runs")
        ? (opts.runs?.() ?? { workflow_runs: [] })
        : url.includes("/issues")
          ? (opts.issues?.() ?? [])
          : {};
    return {
      ok: baseOk,
      status: opts.status ?? 200,
      statusText: opts.statusText ?? "OK",
      json: async () => body,
    };
  });
}

describeIfDb("githubSync", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE commits_cache");
    await client.query("TRUNCATE issues_cache");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await client.end();
  });

  it("upserts commits for each live project on success", async () => {
    const fetchSpy = fetchMockBy({
      commits: () => [
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
    }>("SELECT project, sha, message, author FROM commits_cache ORDER BY project, sha");
    // 4 live projects × 2 commits each = 8 rows
    expect(rows).toHaveLength(8);
    const shortliveRows = rows.filter((r) => r.project === "shortlive");
    expect(shortliveRows).toHaveLength(2);
    expect(shortliveRows[0]!.sha).toBe("a".repeat(40));
    expect(shortliveRows[0]!.author).toBe("pritika292");
    // Subject only; body trimmed.
    expect(shortliveRows[1]!.message).toBe("second");

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
      fetchMockBy({
        commits: () => [fakeCommit("a".repeat(40), "first", "2026-05-20T00:00:00Z")],
      }),
    );

    await syncOnce();
    await syncOnce();

    const { rows } = await client.query<{ n: string }>("SELECT count(*) AS n FROM commits_cache");
    // 4 live projects × 1 commit = 4 rows; re-running doesn't dupe.
    expect(Number(rows[0]!.n)).toBe(4);
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
    }>("SELECT project, sha, status, actor FROM deploys ORDER BY project");
    // 4 live projects × 1 deploy each (the CI run is filtered out) = 4 rows.
    expect(rows).toHaveLength(4);
    const shortliveRow = rows.find((r) => r.project === "shortlive");
    expect(shortliveRow?.status).toBe("success");
    expect(shortliveRow?.actor).toBe("pritika292");
    expect(rows.find((r) => r.project === "pg-inspector")).toBeDefined();
  });

  it("syncs issues, filters out PRs, and reflects state changes on re-sync", async () => {
    // First pass: issue #1 is open, issue #2 is closed, plus one PR that
    // GitHub mixes into /issues which we must filter out.
    const firstPass = fetchMockBy({
      issues: () => [
        fakeIssue(1, "open ticket", "open", "2026-05-22T00:00:00Z"),
        fakeIssue(2, "closed ticket", "closed", "2026-05-21T00:00:00Z", "2026-05-22T00:00:00Z"),
        // PR — must be filtered.
        { ...(fakeIssue(3, "a PR", "open", "2026-05-20T00:00:00Z") as object), pull_request: {} },
      ],
    });
    vi.stubGlobal("fetch", firstPass);
    await syncOnce();

    {
      const { rows } = await client.query<{ n: string }>("SELECT count(*) AS n FROM issues_cache");
      // 4 live projects × 2 non-PR issues = 8 rows.
      expect(Number(rows[0]!.n)).toBe(8);
    }

    // Second pass: issue #1 now closed. Upsert should flip state in place.
    const secondPass = fetchMockBy({
      issues: () => [
        fakeIssue(1, "open ticket", "closed", "2026-05-22T00:00:00Z", "2026-05-23T00:00:00Z"),
        fakeIssue(2, "closed ticket", "closed", "2026-05-21T00:00:00Z", "2026-05-22T00:00:00Z"),
      ],
    });
    vi.stubGlobal("fetch", secondPass);
    await syncOnce();

    const { rows } = await client.query<{
      project: string;
      number: number;
      state: string;
    }>(
      `SELECT project, number, state FROM issues_cache
       WHERE project = 'shortlive' ORDER BY number`,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.number).toBe(1);
    expect(rows[0]!.state).toBe("closed");
    expect(rows[1]!.number).toBe(2);
    expect(rows[1]!.state).toBe("closed");
  });
});
