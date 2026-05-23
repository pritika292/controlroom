import { useEffect, useState } from "react";
import type { Ping } from "../components/Sparkline.js";

export interface ProjectPingsState {
  pings: Ping[];
  loading: boolean;
  error: string | null;
}

interface RawPing {
  ts: number;
  status: Ping["status"];
  latencyMs: number | null;
}

// Fetches the last 24h of pings for one project, refreshed at `intervalMs`.
// Caller passes null/undefined slug for planned projects so we skip the call.

export function useProjectPings(
  slug: string | null,
  intervalMs: number = 30_000,
  limit: number = 200,
): ProjectPingsState {
  const [pings, setPings] = useState<Ping[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(slug !== null);

  useEffect(() => {
    if (slug === null) {
      setPings([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchOnce(): Promise<void> {
      try {
        const res = await fetch(`/api/public/projects/${slug}/pings?window=24h&limit=${limit}`);
        if (!res.ok) {
          throw new Error(`pings endpoint returned ${res.status}`);
        }
        const body = (await res.json()) as RawPing[];
        if (!cancelled) {
          setPings(body.map((p) => ({ ts: p.ts, status: p.status })));
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
  }, [slug, intervalMs, limit]);

  return { pings, loading, error };
}
