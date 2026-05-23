import { getPool } from "../db/pool.js";
import { getLiveProjects } from "../projects.js";
import { publish } from "./sseHub.js";

const DEFAULT_INTERVAL_MS = 30_000;

type PingStatus = "up" | "down" | "timeout" | "error";

// Module-level scheduler state.
let handle: ReturnType<typeof setTimeout> | null = null;

// Last seen status per project. We only publish status_change on transitions
// so the SSE feed isn't a firehose of repeated "still up" events.
const lastStatusBySlug = new Map<string, PingStatus>();

export function resetStatusCache(): void {
  lastStatusBySlug.clear();
}

export async function pollOnce(): Promise<void> {
  const pool = getPool();
  const projects = getLiveProjects();

  await Promise.all(
    projects.map(async (project) => {
      const url = `${project.liveUrl}/health`;
      const start = Date.now();

      let status: PingStatus;
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

      // Only publish when status actually flips. On the very first poll
      // we have no prior value; treat that as a transition from "unknown"
      // so the dashboard repaints from grey to whatever the real status is.
      const prev = lastStatusBySlug.get(project.slug);
      if (prev !== status) {
        lastStatusBySlug.set(project.slug, status);
        publish("status_change", {
          slug: project.slug,
          previous: prev ?? null,
          status,
          ts: Date.now(),
        });
      }
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
  lastStatusBySlug.clear();
}
