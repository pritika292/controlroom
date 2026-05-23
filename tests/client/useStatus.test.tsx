import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useStatus } from "../../src/client/hooks/useStatus.js";

describe("useStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns data after a successful fetch", async () => {
    const body = [
      {
        slug: "shortlive",
        name: "shortlive",
        status: "live",
        lastStatus: "up",
        lastPingAt: "2026-05-23T08:00:00Z",
        latencyMs: 42,
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));

    const { result } = renderHook(() => useStatus(10_000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).toEqual(body);
    expect(result.current.error).toBeNull();
  });

  it("surfaces a fetch failure as error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const { result } = renderHook(() => useStatus(10_000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toMatch(/network/);
    expect(result.current.data).toBeNull();
  });

  it("surfaces non-2xx as error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    const { result } = renderHook(() => useStatus(10_000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toMatch(/500/);
  });
});
