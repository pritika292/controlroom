import { useCallback, useRef, useState } from "react";

export interface LogEvent {
  ts: number;
  name: string;
  data: unknown;
}

// Small ring buffer for SSE events the UI wants to display. The handler
// reference is stable so useSSE doesn't tear down its EventSource just
// because a parent re-rendered. Capacity is small so old events drop off
// the bottom without growing memory.
export function useEventLog(capacity: number = 8): {
  events: LogEvent[];
  onEvent: (name: string, data: unknown) => void;
} {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const bufferRef = useRef<LogEvent[]>([]);

  const onEvent = useCallback(
    (name: string, data: unknown) => {
      const next = [{ ts: Date.now(), name, data }, ...bufferRef.current].slice(0, capacity);
      bufferRef.current = next;
      setEvents(next);
    },
    [capacity],
  );

  return { events, onEvent };
}
