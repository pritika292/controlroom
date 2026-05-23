import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SystemClock } from "../../src/client/components/SystemClock.js";

describe("<SystemClock />", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T08:07:05Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("renders the current UTC time formatted HH:MM:SS UTC", () => {
    render(<SystemClock uptimeSeconds={null} />);
    expect(screen.getByLabelText("current time UTC")).toHaveTextContent("08:07:05 UTC");
  });

  it("renders the container uptime when provided", () => {
    render(<SystemClock uptimeSeconds={2 * 3600 + 15 * 60} />);
    expect(screen.getByLabelText("container uptime")).toHaveTextContent(/UP 2H/);
  });

  it("omits the uptime chip when none is provided", () => {
    render(<SystemClock uptimeSeconds={null} />);
    expect(screen.queryByLabelText("container uptime")).toBeNull();
  });
});
