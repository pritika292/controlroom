import { useEffect, useState } from "react";

export interface PublicStats {
  projectsLive: number;
  projectsTotal: number;
  commitsCached: number;
  deploysLastWeek: number;
}

export interface StatsState {
  stats: PublicStats | null;
  loading: boolean;
  error: string | null;
}

export function useStats(intervalMs: number = 60_000): StatsState {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce(): Promise<void> {
      try {
        const res = await fetch("/api/public/stats");
        if (!res.ok) throw new Error(`stats endpoint returned ${res.status}`);
        const body = (await res.json()) as PublicStats;
        if (!cancelled) {
          setStats(body);
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
    const handle = setInterval(() => void fetchOnce(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [intervalMs]);

  return { stats, loading, error };
}
