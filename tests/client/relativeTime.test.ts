import { describe, expect, it } from "vitest";
import { relativeTime } from "../../src/client/lib/relativeTime.js";

describe("relativeTime", () => {
  const NOW = 1_700_000_000_000;

  it("returns 'just now' for sub-second ages", () => {
    expect(relativeTime(NOW - 500, NOW)).toBe("just now");
  });

  it("formats seconds", () => {
    expect(relativeTime(NOW - 3_000, NOW)).toBe("3s ago");
  });

  it("formats minutes", () => {
    expect(relativeTime(NOW - 12 * 60_000, NOW)).toBe("12m ago");
  });

  it("formats hours", () => {
    expect(relativeTime(NOW - 2 * 60 * 60_000, NOW)).toBe("2h ago");
  });

  it("formats days", () => {
    expect(relativeTime(NOW - 3 * 24 * 60 * 60_000, NOW)).toBe("3d ago");
  });
});
