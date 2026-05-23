import { config } from "../config.js";
import { getPool } from "../db/pool.js";
import { getLiveProjects } from "../projects.js";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1_000; // hourly
const COMMITS_PER_PROJECT = 20;
const DEPLOYS_PER_PROJECT = 30;

interface RawCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
  };
  author: { login: string } | null;
}

interface RawRun {
  id: number;
  name: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  run_started_at: string;
  updated_at: string;
  actor: { login: string } | null;
}

let handle: ReturnType<typeof setTimeout> | null = null;

function githubHeaders(hasPat: boolean): Record<string, string> {
  const base: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "controlroom-sync",
  };
  if (hasPat) base["Authorization"] = `Bearer ${config.GITHUB_PAT}`;
  return base;
}

function mapRunStatus(run: RawRun): "queued" | "in_progress" | "success" | "failure" | "cancelled" {
  if (run.status === "queued") return "queued";
  if (run.status === "in_progress") return "in_progress";
  if (run.conclusion === "success") return "success";
  if (run.conclusion === "cancelled") return "cancelled";
  return "failure";
}

export async function syncCommitsForProject(
  repo: string,
  slug: string,
  hasPat: boolean,
): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/commits?per_page=${COMMITS_PER_PROJECT}`,
    { headers: githubHeaders(hasPat), signal: AbortSignal.timeout(10_000) },
  );

  if (!res.ok) {
    console.error(`[githubSync] ${slug} commits: GitHub returned ${res.status} ${res.statusText}`);
    return;
  }

  const commits = (await res.json()) as RawCommit[];
  const pool = getPool();
  for (const c of commits) {
    const author = c.author?.login ?? c.commit.author?.name ?? "unknown";
    const message = c.commit.message.split("\n")[0]?.slice(0, 500) ?? "";
    const ts = c.commit.author?.date ?? new Date().toISOString();
    await pool.query(
      `INSERT INTO commits_cache (project, sha, author, message, ts)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project, sha) DO NOTHING`,
      [slug, c.sha, author, message, ts],
    );
  }
}

export async function syncDeploysForProject(
  repo: string,
  slug: string,
  hasPat: boolean,
): Promise<void> {
  // Pulls every recent workflow run regardless of name, then filters to
  // deploy runs in JS. Filtering server-side would require knowing the
  // workflow id; the name match is one cheap call per project per cycle.
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/runs?per_page=${DEPLOYS_PER_PROJECT * 2}`,
    { headers: githubHeaders(hasPat), signal: AbortSignal.timeout(10_000) },
  );

  if (!res.ok) {
    console.error(`[githubSync] ${slug} runs: GitHub returned ${res.status} ${res.statusText}`);
    return;
  }

  const { workflow_runs: runs = [] } = (await res.json()) as { workflow_runs?: RawRun[] };
  const deploys = runs.filter((r) => r.name === "deploy").slice(0, DEPLOYS_PER_PROJECT);

  const pool = getPool();
  for (const r of deploys) {
    const status = mapRunStatus(r);
    const finishedAt = r.status === "completed" ? new Date(r.updated_at).toISOString() : null;
    await pool.query(
      `INSERT INTO deploys (project, sha, actor, started_at, finished_at, status, run_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (project, sha) DO UPDATE SET
         actor = EXCLUDED.actor,
         started_at = EXCLUDED.started_at,
         finished_at = EXCLUDED.finished_at,
         status = EXCLUDED.status,
         run_url = EXCLUDED.run_url`,
      [
        slug,
        r.head_sha,
        r.actor?.login ?? null,
        new Date(r.run_started_at).toISOString(),
        finishedAt,
        status,
        r.html_url,
      ],
    );
  }
}

export async function syncOnce(): Promise<void> {
  // Anonymous calls work for public repos at 60/hr/IP. PAT bumps that to
  // 5000/hr. With 11 live projects fetching commits + deploys = 22/hr,
  // we fit in either bucket.
  const hasPat = config.GITHUB_PAT !== "";
  if (!hasPat) {
    console.log("[githubSync] GITHUB_PAT not set; using anonymous GitHub API (60/hr/IP)");
  }

  for (const project of getLiveProjects()) {
    try {
      await syncCommitsForProject(project.repo, project.slug, hasPat);
    } catch (err) {
      console.error(`[githubSync] ${project.slug} commits failed:`, err);
    }
    try {
      await syncDeploysForProject(project.repo, project.slug, hasPat);
    } catch (err) {
      console.error(`[githubSync] ${project.slug} deploys failed:`, err);
    }
  }
}

export function startGithubSync(opts?: { intervalMs?: number }): void {
  const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
  function schedule(): void {
    handle = setTimeout(() => {
      syncOnce()
        .catch((err: unknown) => {
          console.error("[githubSync] sync error:", err);
        })
        .finally(() => schedule());
    }, intervalMs);
  }
  // Immediate first run so the dashboard isn't empty until the first hour.
  syncOnce()
    .catch((err: unknown) => {
      console.error("[githubSync] initial sync error:", err);
    })
    .finally(() => schedule());
}

export async function stopGithubSync(): Promise<void> {
  if (handle !== null) {
    clearTimeout(handle);
    handle = null;
  }
}
