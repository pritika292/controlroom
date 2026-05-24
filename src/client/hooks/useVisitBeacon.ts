import { useEffect } from "react";

// Dogfoods the same visit beacon every other portfolio site fires (#87).
// Hits the local /api/visit/controlroom endpoint (same-origin), so no
// hardcoded URL — the dashboard's own ingest endpoint counts the
// dashboard's own visits.

export function useVisitBeacon(): void {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    try {
      navigator.sendBeacon?.("/api/visit/controlroom");
    } catch {
      // Telemetry must never block the page.
    }
  }, []);
}
