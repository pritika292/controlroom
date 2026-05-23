import { describe, expect, it } from "vitest";
import { pingStats } from "../../src/client/lib/pingStats.js";

function up(ts: number, lat: number) {
  return { ts, status: "up" as const, latencyMs: lat };
}
function down(ts: number) {
  return { ts, status: "down" as const, latencyMs: null };
}
function timeout(ts: number) {
  return { ts, status: "timeout" as const, latencyMs: null };
}

describe("pingStats", () => {
  it("returns zeros and nulls for empty input", () => {
    const s = pingStats([]);
    expect(s.total).toBe(0);
    expect(s.uptimePct).toBeNull();
    expect(s.avgLatencyMs).toBeNull();
    expect(s.p99LatencyMs).toBeNull();
    expect(s.lastFlipAt).toBeNull();
  });

  it("computes uptime percentage", () => {
    const s = pingStats([up(1, 10), up(2, 12), down(3), up(4, 15)]);
    expect(s.total).toBe(4);
    expect(s.upCount).toBe(3);
    expect(s.uptimePct).toBe(75);
  });

  it("averages latency ignoring null latencies", () => {
    const s = pingStats([up(1, 10), up(2, 20), timeout(3), up(4, 30)]);
    expect(s.avgLatencyMs).toBe(20); // (10+20+30)/3
  });

  it("reports p99 latency from observed values", () => {
    const samples = Array.from({ length: 100 }, (_, i) => up(i, i + 1));
    const s = pingStats(samples);
    // sorted: 1..100, p99 index = ceil(100 * 0.99) - 1 = 98 -> value 99
    expect(s.p99LatencyMs).toBe(99);
  });

  it("returns the timestamp of the most recent status flip", () => {
    const s = pingStats([up(1, 10), up(2, 11), down(3), down(4), up(5, 12)]);
    expect(s.lastFlipAt).toBe(5);
  });
});
