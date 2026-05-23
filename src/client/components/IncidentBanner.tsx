import { useIncidents } from "../hooks/useIncidents.js";

export function IncidentBanner(): JSX.Element | null {
  const { incidents } = useIncidents();

  // Show the most recent open high-severity incident. If none, render nothing.
  const open = incidents.find((i) => i.severity === "high" && i.closed === null);
  if (!open) return null;

  return (
    <div
      role="alert"
      className="mt-6 rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-rose-900 dark:text-rose-200">{open.title}</h2>
        <span className="text-xs uppercase tracking-wide text-rose-700 dark:text-rose-300">
          {open.project} &middot; open
        </span>
      </div>
      <div
        className="mt-2 prose prose-sm dark:prose-invert max-w-none text-rose-900 dark:text-rose-100"
        // Server-sanitized via isomorphic-dompurify; safe.
        dangerouslySetInnerHTML={{ __html: open.bodyHtml }}
      />
    </div>
  );
}
