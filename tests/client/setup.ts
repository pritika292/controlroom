import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Vitest globals are off, so Testing Library's built-in cleanup hook never
// gets registered. Do it explicitly to avoid bleed-over between tests.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia; useTheme's system-preference resolver
// reads it. Stub it to default-light so tests don't have to.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// jsdom doesn't ship EventSource. useSSE constructs one on mount; any test
// that renders a component using it crashes without this shim. Tests that
// want to drive the SSE flow (tests/client/useSSE.test.tsx) replace this
// with their own implementation via vi.stubGlobal.
if (typeof globalThis !== "undefined" && typeof globalThis.EventSource === "undefined") {
  class NoopEventSource {
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    addEventListener(): void {}
    removeEventListener(): void {}
    close(): void {}
  }
  // @ts-expect-error: minimal shim, not the full DOM EventSource interface
  globalThis.EventSource = NoopEventSource;
}
