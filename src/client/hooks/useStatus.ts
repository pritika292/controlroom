import { useCallback, useEffect, useRef, useState } from "react";

export interface ProjectStatus {
  slug: string;
  name: string;
  code: string; // device-catalog code, e.g. "CR-01"
  tagline: string;
  description: string;
  tech: string[];
  status: "live" | "planned";
  repo: string;
  liveUrl: string | null;
  eta: string | null;
  lastStatus: "up" | "down" | "timeout" | "error" | null;
  lastPingAt: string | null;
  latencyMs: number | null;
}

export interface StatusState {
  data: ProjectStatus[] | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

// Polls /api/public/status every `intervalMs`. The server-side Redis cache
// is 5s, so refreshing more often than that just hits the cache. `refresh`
// lets the SSE hook trigger an off-cycle fetch when a status flips.

export function useStatus(intervalMs: number = 5_000): StatusState {
  const [data, setData] = useState<ProjectStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Tracks whether the component is still mounted across async closures.
  const cancelledRef = useRef<boolean>(false);

  const fetchOnce = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/public/status");
      if (!res.ok) {
        throw new Error(`/api/public/status returned ${res.status}`);
      }
      const body = (await res.json()) as ProjectStatus[];
      if (!cancelledRef.current) {
        setData(body);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void fetchOnce();
    const handle = setInterval(() => {
      void fetchOnce();
    }, intervalMs);
    return () => {
      cancelledRef.current = true;
      clearInterval(handle);
    };
  }, [fetchOnce, intervalMs]);

  const refresh = useCallback(() => {
    void fetchOnce();
  }, [fetchOnce]);

  return { data, error, loading, refresh };
}
