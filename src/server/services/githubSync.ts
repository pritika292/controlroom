import { config } from "../config.js";
import { getPool } from "../db/pool.js";
import { getLiveProjects } from "../projects.js";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1_000; // hourly
const COMMITS_PER_PROJECT = 20;

interface RawCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
  };
  author: { login: string } | null;
}

let handle: ReturnType<typeof setTimeout> | null = null;

export async function syncOnce(): Promise<void> {
  // Anonymous calls work for public repos at 60/hr/IP. PAT bumps that to
  // 5000/hr. We have 11 projects polled hourly = 11/hr requests, which fits
  // either bucket. Logging the mode helps future-Pritika understand why a
  // 403 might show up if she ever flips a repo private without a PAT.
  const hasPat = config.GITHUB_PAT !== "";
  const authHeaders: Record<string, string> = hasPat
    ? { Authorization: `Bearer ${config.GITHUB_PAT}` }
    : {};
  if (!hasPat) {
    console.log("[githubSync] GITHUB_PAT not set; using anonymous GitHub API (60/hr/IP)");
  }

  const pool = getPool();

  for (const project of getLiveProjects()) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${project.repo}/commits?per_page=${COMMITS_PER_PROJECT}`,
        {
          headers: {
            ...authHeaders,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "controlroom-sync",
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        console.error(
          `[githubSync] ${project.slug}: GitHub returned ${res.status} ${res.statusText}`,
        );
        continue;
      }

      const commits = (await res.json()) as RawCommit[];

      // Insert as a batch under one query plan; ON CONFLICT keeps historical
      // rows immutable so a force-push doesn't quietly rewrite the cache.
      for (const c of commits) {
        const author = c.author?.login ?? c.commit.author?.name ?? "unknown";
        const message = c.commit.message.split("\n")[0]?.slice(0, 500) ?? "";
        const ts = c.commit.author?.date ?? new Date().toISOString();
        await pool.query(
          `INSERT INTO commits_cache (project, sha, author, message, ts)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (project, sha) DO NOTHING`,
          [project.slug, c.sha, author, message, ts],
        );
      }
    } catch (err) {
      console.error(`[githubSync] ${project.slug} failed:`, err);
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
  // Kick off an immediate run so the dashboard has data before the first
  // hour elapses, then settle into the regular cadence.
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
