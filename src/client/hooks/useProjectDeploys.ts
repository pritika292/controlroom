import { useEffect, useState } from "react";

export interface DeployItem {
  sha: string;
  actor: string | null;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number | null;
  status: "queued" | "in_progress" | "success" | "failure" | "cancelled";
  runUrl: string | null;
}

export interface ProjectDeploysState {
  deploys: DeployItem[];
  loading: boolean;
  error: string | null;
}

export function useProjectDeploys(
  slug: string | null,
  intervalMs: number = 30_000,
  limit: number = 10,
): ProjectDeploysState {
  const [deploys, setDeploys] = useState<DeployItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(slug !== null);

  useEffect(() => {
    if (slug === null) {
      setDeploys([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchOnce(): Promise<void> {
      try {
        const res = await fetch(`/api/public/projects/${slug}/deploys?limit=${limit}`);
        if (!res.ok) throw new Error(`deploys endpoint returned ${res.status}`);
        const body = (await res.json()) as DeployItem[];
        if (!cancelled) {
          setDeploys(body);
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
  }, [slug, intervalMs, limit]);

  return { deploys, loading, error };
}
