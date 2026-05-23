import { useEffect, useState } from "react";

export interface Incident {
  id: string;
  severity: "low" | "medium" | "high";
  project: string;
  title: string;
  opened: string;
  closed: string | null;
  bodyHtml: string;
}

export interface IncidentsState {
  incidents: Incident[];
  loading: boolean;
}

// Incidents come from markdown files committed to the repo; they only change
// on deploy. Refresh hourly so a same-day deploy is reflected within an hour
// without hammering the endpoint.
export function useIncidents(intervalMs: number = 60 * 60 * 1_000): IncidentsState {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchOnce(): Promise<void> {
      try {
        const res = await fetch("/api/public/incidents");
        if (!res.ok) throw new Error(`incidents endpoint returned ${res.status}`);
        const body = (await res.json()) as Incident[];
        if (!cancelled) {
          setIncidents(body);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchOnce();
    const handle = setInterval(() => void fetchOnce(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [intervalMs]);

  return { incidents, loading };
}
