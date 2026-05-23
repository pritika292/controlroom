import { useEffect, useState } from "react";

export interface ContainerEntry {
  code: string;
  name: string;
  role: "app" | "shared" | "project" | "planned";
  up: boolean;
}

export interface Infra {
  vm: {
    available: boolean;
    cpuPercent: number | null;
    memUsedPercent: number | null;
    region: string | null;
    sampledAt: string | null;
    reason: string | null;
    uptimeSeconds: number;
  };
  postgres: { up: boolean; latencyMs: number | null };
  redis: { up: boolean; latencyMs: number | null };
  containers: ContainerEntry[];
  cost: { monthlyUsd: number; note: string };
}

export interface InfraState {
  infra: Infra | null;
  loading: boolean;
  error: string | null;
}

// Refresh cadence matches the server's 30s Redis cache; faster polling
// just hits the cache.
export function useInfra(intervalMs: number = 30_000): InfraState {
  const [infra, setInfra] = useState<Infra | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchOnce(): Promise<void> {
      try {
        const res = await fetch("/api/public/infra");
        if (!res.ok) throw new Error(`infra endpoint returned ${res.status}`);
        const body = (await res.json()) as Infra;
        if (!cancelled) {
          setInfra(body);
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

  return { infra, loading, error };
}
