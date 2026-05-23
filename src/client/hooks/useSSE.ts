import { useEffect, useRef, useState } from "react";

type EventHandler = (event: string, data: unknown) => void;

interface SSEState {
  connected: boolean;
}

// Reconnect schedule: 1s, 2s, 4s, 8s, capped at 30s. Matches what a human
// would reasonably tolerate for a status page falling out of touch.
const BACKOFFS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

export function useSSE(url: string, onEvent: EventHandler): SSEState {
  const [connected, setConnected] = useState<boolean>(false);

  // Keep latest handler in a ref so we don't tear down the EventSource
  // every render just because the parent passed a fresh closure.
  const handlerRef = useRef<EventHandler>(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function connect(): void {
      if (cancelled) return;
      source = new EventSource(url);

      source.onopen = () => {
        attempt = 0;
        setConnected(true);
      };

      // Server names its events (event: status_change, event: hello).
      // EventSource exposes named events via addEventListener, not onmessage.
      // We re-emit every named event via a tiny shim listener for the names
      // we know the server uses.
      const emit = (name: string) => (ev: MessageEvent) => {
        let parsed: unknown = ev.data;
        try {
          parsed = JSON.parse(ev.data);
        } catch {
          // pass through as string
        }
        handlerRef.current(name, parsed);
      };
      source.addEventListener("hello", emit("hello"));
      source.addEventListener("status_change", emit("status_change"));

      source.onerror = () => {
        setConnected(false);
        source?.close();
        source = null;
        if (cancelled) return;
        const idx = Math.min(attempt, BACKOFFS_MS.length - 1);
        const delay = BACKOFFS_MS[idx] ?? 30_000;
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [url]);

  return { connected };
}
