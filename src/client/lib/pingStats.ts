import type { ProjectPing } from "../hooks/useProjectPings.js";

export interface PingStats {
  total: number;
  upCount: number;
  uptimePct: number | null; // null when there are no pings
  avgLatencyMs: number | null;
  p99LatencyMs: number | null;
  lastFlipAt: number | null; // ts of the most recent status transition
}

// All math is dependency-free; the input is at most ~200 entries from the
// 24h pings endpoint so a sort + scan is fine.
export function pingStats(pings: ProjectPing[]): PingStats {
  if (pings.length === 0) {
    return {
      total: 0,
      upCount: 0,
      uptimePct: null,
      avgLatencyMs: null,
      p99LatencyMs: null,
      lastFlipAt: null,
    };
  }

  let upCount = 0;
  let latencySum = 0;
  let latencyCount = 0;
  const latencies: number[] = [];

  for (const p of pings) {
    if (p.status === "up") upCount += 1;
    if (typeof p.latencyMs === "number") {
      latencySum += p.latencyMs;
      latencyCount += 1;
      latencies.push(p.latencyMs);
    }
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const p99Index = Math.max(0, Math.ceil(sorted.length * 0.99) - 1);
  const p99 = sorted.length > 0 ? (sorted[p99Index] ?? null) : null;

  // Find the most recent status flip by scanning chronologically.
  let lastFlipAt: number | null = null;
  let prev: ProjectPing["status"] | null = null;
  for (const p of pings) {
    if (prev !== null && p.status !== prev) lastFlipAt = p.ts;
    prev = p.status;
  }

  return {
    total: pings.length,
    upCount,
    uptimePct: (upCount / pings.length) * 100,
    avgLatencyMs: latencyCount > 0 ? latencySum / latencyCount : null,
    p99LatencyMs: p99,
    lastFlipAt,
  };
}
