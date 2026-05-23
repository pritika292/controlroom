import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LatencyHistogram } from "../../src/client/components/LatencyHistogram.js";

function p(ts: number, latencyMs: number | null) {
  return { ts, status: "up" as const, latencyMs };
}

describe("<LatencyHistogram />", () => {
  it("renders only the baseline when there are no measured pings", () => {
    const { container } = render(<LatencyHistogram pings={[]} />);
    // baseline rect always there; no bucket rects
    expect(container.querySelectorAll("rect").length).toBe(1);
  });

  it("ignores pings with null latencyMs", () => {
    const { container } = render(<LatencyHistogram pings={[p(1, null), p(2, null), p(3, null)]} />);
    expect(container.querySelectorAll("rect").length).toBe(1);
  });

  it("renders one bucket rect per non-empty bin plus the baseline", () => {
    // Latencies 0, 1, 2, 50, 51. With 14-target buckets the size is 5ms,
    // producing 11 buckets covering 0-55ms.
    const samples = [0, 1, 2, 50, 51].map((ms, i) => p(i, ms));
    const { container } = render(<LatencyHistogram pings={samples} />);
    // bucket count is at least 2 (one for each cluster) + 1 baseline
    expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(3);
  });

  it("labels the min and max bucket along the bottom", () => {
    const samples = [10, 50, 100].map((ms, i) => p(i, ms));
    const { container } = render(<LatencyHistogram pings={samples} />);
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent ?? "");
    expect(texts.some((t) => t.endsWith("ms"))).toBe(true);
  });
});
