import { useEffect, useState } from "react";

export type IssueState = "open" | "closed";
export type IssueFilter = IssueState | "all";

export interface IssueItem {
  project: string;
  number: number;
  title: string;
  state: IssueState;
  openedAt: number;
  closedAt: number | null;
  url: string;
}

export interface IssuesState {
  issues: IssueItem[];
  loading: boolean;
  error: string | null;
}

// Aggregated across every live project (slug=null) or scoped to one slug.
// Mirrors useProjectCommits's polling shape so the panel can hot-swap data
// on a state-filter change without flickering.
export function useIssues(
  slug: string | null,
  state: IssueFilter,
  intervalMs: number = 5 * 60_000,
  // Default 5 (was 10) — the panel uses this and 10 rows was too tall (#84).
  // Pass a larger value explicitly if a future caller needs more.
  limit: number = 5,
): IssuesState {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    const path =
      slug === null
        ? `/api/public/issues?state=${state}&limit=${limit}`
        : `/api/public/projects/${slug}/issues?state=${state}&limit=${limit}`;

    async function fetchOnce(): Promise<void> {
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`issues endpoint returned ${res.status}`);
        const body = (await res.json()) as IssueItem[];
        if (!cancelled) {
          setIssues(body);
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
  }, [slug, state, intervalMs, limit]);

  return { issues, loading, error };
}
