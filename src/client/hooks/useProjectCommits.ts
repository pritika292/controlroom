import { useEffect, useState } from "react";

export interface CommitItem {
  sha: string;
  author: string | null;
  message: string;
  ts: number;
}

export interface ProjectCommitsState {
  commits: CommitItem[];
  loading: boolean;
  error: string | null;
}

export function useProjectCommits(
  slug: string | null,
  intervalMs: number = 60_000,
  limit: number = 5,
): ProjectCommitsState {
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(slug !== null);

  useEffect(() => {
    if (slug === null) {
      setCommits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchOnce(): Promise<void> {
      try {
        const res = await fetch(`/api/public/projects/${slug}/commits?limit=${limit}`);
        if (!res.ok) throw new Error(`commits endpoint returned ${res.status}`);
        const body = (await res.json()) as CommitItem[];
        if (!cancelled) {
          setCommits(body);
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

  return { commits, loading, error };
}
