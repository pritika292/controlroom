import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LatencyChart } from "../../src/client/components/LatencyChart.js";

function p(ts: number, latencyMs: number | null) {
  return { ts, status: "up" as const, latencyMs };
}

describe("<LatencyChart />", () => {
  it("renders a baseline-only chart when given fewer than 2 measured pings", () => {
    const { container } = render(<LatencyChart pings={[]} />);
    // baseline rect always present; no <path>
    expect(container.querySelector("path")).toBeNull();
    expect(container.querySelector("rect")).not.toBeNull();
  });

  it("renders a path when there are at least 2 measured pings", () => {
    const { container } = render(<LatencyChart pings={[p(1, 10), p(2, 20), p(3, 30)]} />);
    const path = container.querySelector("path");
    expect(path).not.toBeNull();
    expect(path?.getAttribute("class")).toContain("stroke-accent");
  });

  it("ignores pings with null latencyMs when deciding whether to draw a line", () => {
    const { container } = render(<LatencyChart pings={[p(1, null), p(2, null), p(3, null)]} />);
    expect(container.querySelector("path")).toBeNull();
  });

  it("shows min/max latency labels", () => {
    const { getByText } = render(<LatencyChart pings={[p(1, 10), p(2, 200)]} />);
    expect(getByText(/10ms/)).toBeInTheDocument();
    expect(getByText(/200ms/)).toBeInTheDocument();
  });
});
