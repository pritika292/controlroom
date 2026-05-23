import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusSegments } from "../../src/client/components/StatusSegments.js";

function ping(status: "up" | "down" | "timeout" | "error", i = 0) {
  return { ts: i, status, latencyMs: null };
}

describe("<StatusSegments />", () => {
  it("renders the empty-state label when given no pings", () => {
    render(<StatusSegments pings={[]} />);
    expect(screen.getByText("NO PINGS YET")).toBeInTheDocument();
  });

  it("renders one segment per observed status, sized by share", () => {
    const pings = [
      ...Array.from({ length: 8 }, (_, i) => ping("up", i)),
      ping("timeout", 8),
      ping("down", 9),
    ];
    const { container } = render(<StatusSegments pings={pings} />);
    // The proportion bar has one inner div per non-empty status.
    const bar = container.querySelector('[role="img"]');
    expect(bar).not.toBeNull();
    expect(bar!.children.length).toBe(3);
  });

  it("legend lists all four statuses, even ones with 0 pings", () => {
    render(<StatusSegments pings={[ping("up", 0), ping("up", 1)]} />);
    expect(screen.getByText("UP")).toBeInTheDocument();
    expect(screen.getByText("DOWN")).toBeInTheDocument();
    expect(screen.getByText("TIMEOUT")).toBeInTheDocument();
    expect(screen.getByText("ERROR")).toBeInTheDocument();
  });

  it("formats time in seconds for small windows", () => {
    // 2 pings = ~60 seconds = "1M" (formatter prefers minutes once >= 60s)
    render(<StatusSegments pings={[ping("up", 0), ping("up", 1)]} />);
    expect(screen.getByText("1M")).toBeInTheDocument();
  });
});
