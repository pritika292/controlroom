import { useEffect, useState } from "react";

export interface VisitAggregate {
  slug: string;
  thisWeek: number;
  lastWeek: number;
  trend: "up" | "down" | "flat";
}

export interface VisitsState {
  data: VisitAggregate[] | null;
  loading: boolean;
  error: string | null;
}

// Polls /api/public/visits every `intervalMs`. Server caches the response
// for 60s, so the network cost of refreshing every minute is one query
// per minute across all open tabs.
export function useVisits(intervalMs: number = 60_000): VisitsState {
  const [data, setData] = useState<VisitAggregate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce(): Promise<void> {
      try {
        const res = await fetch("/api/public/visits");
        if (!res.ok) throw new Error(`visits endpoint returned ${res.status}`);
        const body = (await res.json()) as VisitAggregate[];
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
    const handle = setInterval(() => void fetchOnce(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [intervalMs]);

  return { data, loading, error };
}

export interface DailyVisit {
  day: string;
  count: number;
}

export interface DailyVisitsState {
  data: DailyVisit[] | null;
  loading: boolean;
  error: string | null;
}

export function useDailyVisits(slug: string | null, days: number = 30): DailyVisitsState {
  const [data, setData] = useState<DailyVisit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(slug !== null);

  useEffect(() => {
    if (slug === null) return;
    let cancelled = false;

    async function fetchOnce(): Promise<void> {
      try {
        const res = await fetch(`/api/public/projects/${slug}/visits?days=${days}`);
        if (!res.ok) throw new Error(`daily visits endpoint returned ${res.status}`);
        const body = (await res.json()) as DailyVisit[];
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
    return () => {
      cancelled = true;
    };
  }, [slug, days]);

  return { data, loading, error };
}
