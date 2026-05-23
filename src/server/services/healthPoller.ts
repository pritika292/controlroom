import { getPool } from "../db/pool.js";
import { getLiveProjects } from "../projects.js";

const DEFAULT_INTERVAL_MS = 30_000;

// Module-level scheduler state.
let handle: ReturnType<typeof setTimeout> | null = null;

export async function pollOnce(): Promise<void> {
  const pool = getPool();
  const projects = getLiveProjects();

  await Promise.all(
    projects.map(async (project) => {
      const url = `${project.liveUrl}/health`;
      const start = Date.now();

      let status: "up" | "down" | "timeout" | "error";
      let latencyMs: number | null = null;

      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(5_000),
        });

        latencyMs = Date.now() - start;

        if (!res.ok) {
          status = "down";
        } else {
          let body: unknown;
          try {
            body = await res.json();
          } catch {
            status = "error";
            body = null;
          }
          if (
            body !== null &&
            typeof body === "object" &&
            "ok" in body &&
            (body as Record<string, unknown>)["ok"] === true
          ) {
            status = "up";
          } else {
            status = "error";
          }
        }
      } catch (err) {
        latencyMs = null;
        if (err instanceof Error && err.name === "AbortError") {
          status = "timeout";
        } else {
          status = "down";
        }
      }

      await pool.query(
        `INSERT INTO health_pings (project, ts, status, latency_ms)
         VALUES ($1, now(), $2, $3)`,
        [project.slug, status, latencyMs],
      );
    }),
  );

  // 24-hour rolling retention.
  await pool.query(`DELETE FROM health_pings WHERE ts < now() - interval '24 hours'`);
}

export function startHealthPoller(opts?: { intervalMs?: number }): void {
  const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;

  function schedule(): void {
    handle = setTimeout(() => {
      pollOnce()
        .catch((err: unknown) => {
          console.error("[healthPoller] poll error:", err);
        })
        .finally(() => {
          // Recursive schedule — next tick starts after this one finishes.
          // Prevents overlap when a poll takes longer than the interval.
          schedule();
        });
    }, intervalMs);
  }

  schedule();
}

export async function stopHealthPoller(): Promise<void> {
  if (handle !== null) {
    clearTimeout(handle);
    handle = null;
  }
}
