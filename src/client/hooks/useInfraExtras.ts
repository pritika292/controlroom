import { useEffect, useState } from "react";

export interface InfraExtras {
  visitsThisWeek: number;
  deploysThisWeek: number;
  openIssues: number;
  pgConnections: { used: number; max: number };
  redisKeys: number;
  largestTable: { name: string; rows: number } | null;
  lastDeploy: { slug: string; whenMs: number; status: string } | null;
  uptime7dPct: number | null;
}

export interface InfraExtrasState {
  data: InfraExtras | null;
  loading: boolean;
  error: string | null;
}

export function useInfraExtras(intervalMs: number = 60_000): InfraExtrasState {
  const [data, setData] = useState<InfraExtras | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce(): Promise<void> {
      try {
        const res = await fetch("/api/public/infra-extras");
        if (!res.ok) throw new Error(`infra-extras endpoint returned ${res.status}`);
        const body = (await res.json()) as InfraExtras;
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
