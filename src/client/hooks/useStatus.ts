import { useEffect, useState } from "react";

export interface ProjectStatus {
  slug: string;
  name: string;
  status: "live" | "planned";
  lastStatus: "up" | "down" | "timeout" | "error" | null;
  lastPingAt: string | null;
  latencyMs: number | null;
}

export interface StatusState {
  data: ProjectStatus[] | null;
  error: string | null;
  loading: boolean;
}

// Polls /api/public/status every `intervalMs`. The server-side Redis cache
// is 5s, so refreshing more often than that just hits the cache. Default
// here matches that cache TTL.

export function useStatus(intervalMs: number = 5_000): StatusState {
  const [data, setData] = useState<ProjectStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce(): Promise<void> {
      try {
        const res = await fetch("/api/public/status");
        if (!res.ok) {
          throw new Error(`/api/public/status returned ${res.status}`);
        }
        const body = (await res.json()) as ProjectStatus[];
        if (!cancelled) {
          setData(body);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }

    void fetchOnce();
    const handle = setInterval(() => {
      void fetchOnce();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [intervalMs]);

  return { data, error, loading };
}
