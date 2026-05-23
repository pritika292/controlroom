import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSSE } from "../../src/client/hooks/useSSE.js";

// Mock EventSource: jsdom doesn't ship one. We capture the most recent
// instance per URL so the test can drive open/message/error events directly.
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  private listeners = new Map<string, Array<(ev: MessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(name: string, fn: (ev: MessageEvent) => void): void {
    const list = this.listeners.get(name) ?? [];
    list.push(fn);
    this.listeners.set(name, list);
  }
  emit(name: string, data: string): void {
    for (const fn of this.listeners.get(name) ?? []) {
      fn({ data } as MessageEvent);
    }
  }
  close(): void {
    this.closed = true;
  }
  static reset(): void {
    FakeEventSource.instances = [];
  }
}

describe("useSSE", () => {
  beforeEach(() => {
    FakeEventSource.reset();
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("connects and reports connected=true on onopen", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useSSE("/api/stream", handler));
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(result.current.connected).toBe(false);

    act(() => {
      FakeEventSource.instances[0]!.onopen?.();
    });
    expect(result.current.connected).toBe(true);
  });

  it("delivers named events with JSON-parsed payloads to the handler", () => {
    const handler = vi.fn();
    renderHook(() => useSSE("/api/stream", handler));

    act(() => {
      FakeEventSource.instances[0]!.emit("status_change", JSON.stringify({ slug: "shortlive" }));
    });
    expect(handler).toHaveBeenCalledWith("status_change", { slug: "shortlive" });
  });

  it("reconnects on error with backoff", () => {
    const handler = vi.fn();
    renderHook(() => useSSE("/api/stream", handler));

    act(() => {
      FakeEventSource.instances[0]!.onerror?.();
    });
    // First backoff is 1s.
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("closes the source on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useSSE("/api/stream", handler));
    const source = FakeEventSource.instances[0]!;
    unmount();
    expect(source.closed).toBe(true);
  });
});
