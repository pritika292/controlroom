import { useIncidents } from "../hooks/useIncidents.js";

export function IncidentBanner(): JSX.Element | null {
  const { incidents } = useIncidents();
  const open = incidents.find((i) => i.severity === "high" && i.closed === null);
  if (!open) return null;

  return (
    <div
      role="alert"
      className="mt-6 border-l-4 border-l-accent border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-base text-zinc-900 dark:text-white">{open.title}</h2>
        <span className="te-label text-accent">{open.project} / OPEN</span>
      </div>
      <div
        className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 prose prose-sm dark:prose-invert max-w-none"
        // Server-sanitized via isomorphic-dompurify; safe.
        dangerouslySetInnerHTML={{ __html: open.bodyHtml }}
      />
    </div>
  );
}
