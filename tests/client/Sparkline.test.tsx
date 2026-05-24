import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "../../src/client/components/Sparkline.js";
import type { Ping } from "../../src/client/components/Sparkline.js";

function makePing(status: Ping["status"], i = 0): Ping {
  return { ts: Date.now() + i * 1000, status };
}

describe("<Sparkline />", () => {
  it("renders only the baseline rect when pings is empty", () => {
    const { container } = render(<Sparkline pings={[]} />);
    const rects = container.querySelectorAll("rect");
    expect(rects).toHaveLength(1);
    // baseline spans full width
    expect(rects[0].getAttribute("width")).toBe("120");
  });

  it("renders N bars plus one baseline for N pings", () => {
    const pings: Ping[] = [makePing("up", 0), makePing("down", 1), makePing("timeout", 2)];
    const { container } = render(<Sparkline pings={pings} />);
    const rects = container.querySelectorAll("rect");
    // 3 bars + 1 baseline
    expect(rects).toHaveLength(4);
  });

  it("applies emerald class to up pings", () => {
    const { container } = render(<Sparkline pings={[makePing("up")]} />);
    const bars = Array.from(container.querySelectorAll("rect")).filter(
      (r) => r.getAttribute("height") === "24" && r.getAttribute("y") === "0",
    );
    expect(bars[0].getAttribute("class")).toContain("fill-accent");
  });

  it("applies rose class to down pings", () => {
    const { container } = render(<Sparkline pings={[makePing("down")]} />);
    const bars = Array.from(container.querySelectorAll("rect")).filter(
      (r) => r.getAttribute("y") === "0",
    );
    expect(bars[0].getAttribute("class")).toContain("fill-rose-500");
  });

  it("applies rose class to error pings", () => {
    const { container } = render(<Sparkline pings={[makePing("error")]} />);
    const bars = Array.from(container.querySelectorAll("rect")).filter(
      (r) => r.getAttribute("y") === "0",
    );
    expect(bars[0].getAttribute("class")).toContain("fill-rose-500");
  });

  it("applies amber class to timeout pings", () => {
    const { container } = render(<Sparkline pings={[makePing("timeout")]} />);
    const bars = Array.from(container.querySelectorAll("rect")).filter(
      (r) => r.getAttribute("y") === "0",
    );
    expect(bars[0].getAttribute("class")).toContain("fill-amber-500");
  });

  it("accessible label reflects healthy count", () => {
    const pings: Ping[] = [makePing("up", 0), makePing("up", 1), makePing("down", 2)];
    const { container } = render(<Sparkline pings={pings} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-label")).toBe("Uptime sparkline: 2 of 3 pings healthy");
  });

  it("accessible label says no data for empty pings", () => {
    const { container } = render(<Sparkline pings={[]} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-label")).toBe("Uptime sparkline: no data");
  });

  it("tiles bars to fill width regardless of sample count (#79)", () => {
    // 4 samples in a 120-wide viewBox should produce 30-wide bars (no gaps).
    const pings: Ping[] = [
      makePing("up", 0),
      makePing("up", 1),
      makePing("up", 2),
      makePing("up", 3),
    ];
    const { container } = render(<Sparkline pings={pings} />);
    const bars = Array.from(container.querySelectorAll("rect")).filter(
      (r) => r.getAttribute("y") === "0",
    );
    expect(bars).toHaveLength(4);
    for (const bar of bars) {
      expect(Number(bar.getAttribute("width"))).toBe(30);
    }
  });

  it("clamps tile width to at least 1px even for very dense samples", () => {
    // 240 samples in 120-wide viewBox would give 0.5px bars; clamp at 1.
    const pings: Ping[] = Array.from({ length: 240 }, (_, i) => makePing("up", i));
    const { container } = render(<Sparkline pings={pings} />);
    const bars = Array.from(container.querySelectorAll("rect")).filter(
      (r) => r.getAttribute("y") === "0",
    );
    expect(Number(bars[0]!.getAttribute("width"))).toBeGreaterThanOrEqual(1);
  });
});
