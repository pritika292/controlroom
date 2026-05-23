import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEventLog } from "../../src/client/hooks/useEventLog.js";

describe("useEventLog", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useEventLog());
    expect(result.current.events).toEqual([]);
  });

  it("prepends new events newest-first", () => {
    const { result } = renderHook(() => useEventLog());
    act(() => result.current.onEvent("status_change", { slug: "a" }));
    act(() => result.current.onEvent("status_change", { slug: "b" }));
    expect(result.current.events.map((e) => (e.data as { slug: string }).slug)).toEqual(["b", "a"]);
  });

  it("respects the capacity", () => {
    const { result } = renderHook(() => useEventLog(3));
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.onEvent("status_change", { slug: `p${i}` });
      }
    });
    expect(result.current.events).toHaveLength(3);
    // Newest is p9 since onEvent prepends
    expect((result.current.events[0]!.data as { slug: string }).slug).toBe("p9");
    expect((result.current.events[2]!.data as { slug: string }).slug).toBe("p7");
  });
});
