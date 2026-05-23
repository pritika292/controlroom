import { useEffect, useState } from "react";

export interface DayBucket {
  date: string; // YYYY-MM-DD UTC
  count: number;
}

export interface DeployFrequency {
  days: number;
  total: number;
  buckets: DayBucket[];
}

export interface DeployFrequencyState {
  data: DeployFrequency | null;
  loading: boolean;
  error: string | null;
}

export function useDeployFrequency(
  days: number = 14,
  intervalMs: number = 60_000,
): DeployFrequencyState {
  const [data, setData] = useState<DeployFrequency | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchOnce(): Promise<void> {
      try {
        const res = await fetch(`/api/public/deploys/frequency?days=${days}`);
        if (!res.ok) throw new Error(`deploy frequency endpoint returned ${res.status}`);
        const body = (await res.json()) as DeployFrequency;
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
  }, [days, intervalMs]);

  return { data, loading, error };
}
