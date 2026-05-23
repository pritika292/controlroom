import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Sparkline } from "../components/Sparkline.js";
import { StatusDot } from "../components/StatusDot.js";
import { useProjectPings, type ProjectPing } from "../hooks/useProjectPings.js";
import { useStatus, type ProjectStatus } from "../hooks/useStatus.js";
import { relativeTime } from "../lib/relativeTime.js";

function NotFound({ slug }: { slug: string }): JSX.Element {
  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
        No project named &ldquo;{slug}&rdquo;
      </h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        Check the URL, or head back to the{" "}
        <Link to="/" className="text-violet-600 dark:text-violet-400 hover:underline">
          status board
        </Link>
        .
      </p>
    </main>
  );
}

function PlannedHero({ project }: { project: ProjectStatus & { eta?: string } }): JSX.Element {
  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{project.name}</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        This project is on the roadmap but not live yet.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block text-violet-600 dark:text-violet-400 hover:underline"
      >
        Back to the status board
      </Link>
    </main>
  );
}

export function Project(): JSX.Element {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data, loading } = useStatus();
  const { pings, loading: pingsLoading } = useProjectPings(slug, 30_000, 100);

  const project = useMemo(() => data?.find((p) => p.slug === slug), [data, slug]);

  if (loading && data === null) {
    return (
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      </main>
    );
  }

  if (data !== null && project === undefined) return <NotFound slug={slug} />;
  if (project === undefined) return <NotFound slug={slug} />;
  if (project.status === "planned") return <PlannedHero project={project} />;

  return (
    <main className="max-w-5xl mx-auto px-6 lg:px-8 py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <StatusDot project={project} />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{project.name}</h1>
        </div>
        <Link
          to="/"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          &larr; All projects
        </Link>
      </header>

      <section className="mt-8 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400">Last 24 hours</h2>
        <div className="mt-3">
          <Sparkline pings={pings} width={720} height={64} />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Recent pings ({pings.length})
        </h2>
        {pingsLoading && pings.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading...</p>
        ) : pings.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            No pings recorded in the last 24 hours.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-4 font-medium">when</th>
                <th className="py-2 pr-4 font-medium">status</th>
                <th className="py-2 font-medium">latency</th>
              </tr>
            </thead>
            <tbody>
              {[...pings].reverse().map((p, i) => (
                <tr key={`${p.ts}-${i}`} className="border-t border-slate-100 dark:border-white/5">
                  <td className="py-2 pr-4 text-slate-700 dark:text-slate-300">
                    {relativeTime(p.ts)}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="py-2 text-slate-700 dark:text-slate-300">{pingLatency(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlaceholderCard title="Recent commits" subtitle="Coming in Tier 4 (issue #19)" />
        <PlaceholderCard title="Recent deploys" subtitle="Coming in Tier 4 (issue #21)" />
      </section>
    </main>
  );
}

function pingLatency(p: ProjectPing): string {
  if (typeof p.latencyMs === "number") return `${p.latencyMs} ms`;
  return p.status === "timeout" ? "timeout" : "-";
}

function StatusPill({ status }: { status: "up" | "down" | "timeout" | "error" }): JSX.Element {
  const cls =
    status === "up"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : status === "timeout"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function PlaceholderCard({ title, subtitle }: { title: string; subtitle: string }): JSX.Element {
  return (
    <article className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
    </article>
  );
}
