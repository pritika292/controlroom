import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { CommitsPanel } from "../components/CommitsPanel.js";
import { DeploysPanel } from "../components/DeploysPanel.js";
import { Sparkline } from "../components/Sparkline.js";
import { StatusDot } from "../components/StatusDot.js";
import { useProjectPings, type ProjectPing } from "../hooks/useProjectPings.js";
import { useStatus, type ProjectStatus } from "../hooks/useStatus.js";
import { relativeTime } from "../lib/relativeTime.js";

function NotFound({ slug }: { slug: string }): JSX.Element {
  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
      <p className="te-label">ERROR / UNKNOWN PROJECT</p>
      <h1 className="mt-2 font-mono text-3xl text-zinc-900 dark:text-white">
        No project named &ldquo;{slug}&rdquo;
      </h1>
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        Check the URL or head back to the{" "}
        <Link to="/" className="text-accent hover:underline">
          status board
        </Link>
        .
      </p>
    </main>
  );
}

function PlannedHero({ project }: { project: ProjectStatus }): JSX.Element {
  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
      <p className="te-label">
        {project.code} / PLANNED{project.eta !== null ? ` / ${project.eta.toUpperCase()}` : ""}
      </p>
      <h1 className="mt-2 font-mono text-3xl text-zinc-900 dark:text-white">{project.name}</h1>
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">On the roadmap; not live yet.</p>
      <Link to="/" className="mt-6 inline-block te-label text-accent hover:underline">
        BACK TO STATUS BOARD
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
        <p className="te-label">LOADING...</p>
      </main>
    );
  }

  if (data !== null && project === undefined) return <NotFound slug={slug} />;
  if (project === undefined) return <NotFound slug={slug} />;
  if (project.status === "planned") return <PlannedHero project={project} />;

  return (
    <main className="max-w-5xl mx-auto px-6 lg:px-8 py-10">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <p className="te-label">{project.code}</p>
          <div className="mt-1 flex items-center gap-3">
            <StatusDot project={project} />
            <h1 className="font-mono text-3xl text-zinc-900 dark:text-white">{project.name}</h1>
          </div>
        </div>
        <Link to="/" className="te-label text-zinc-500 hover:text-accent">
          {"<-"} STATUS BOARD
        </Link>
      </header>

      <section className="mt-8 te-panel p-5">
        <p className="te-label">LAST 24 HOURS</p>
        <div className="mt-3">
          <Sparkline pings={pings} width={720} height={64} />
        </div>
      </section>

      <section className="mt-3 te-panel p-5">
        <p className="te-label">RECENT PINGS / {pings.length}</p>
        {pingsLoading && pings.length === 0 ? (
          <p className="mt-3 te-label">LOADING...</p>
        ) : pings.length === 0 ? (
          <p className="mt-3 te-label">NO PINGS IN LAST 24H</p>
        ) : (
          <table className="mt-3 w-full font-mono text-xs">
            <thead>
              <tr className="text-left te-label">
                <th className="py-2 pr-4">WHEN</th>
                <th className="py-2 pr-4">STATUS</th>
                <th className="py-2">LATENCY</th>
              </tr>
            </thead>
            <tbody>
              {[...pings].reverse().map((p, i) => (
                <tr key={`${p.ts}-${i}`} className="border-t border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">
                    {relativeTime(p.ts)}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="py-2 text-zinc-700 dark:text-zinc-300">{pingLatency(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <CommitsPanel slug={project.slug} repo={`pritika292/${project.slug}`} />
        <DeploysPanel slug={project.slug} />
      </section>
    </main>
  );
}

function pingLatency(p: ProjectPing): string {
  if (typeof p.latencyMs === "number") return `${p.latencyMs}MS`;
  return p.status === "timeout" ? "TIMEOUT" : "-";
}

function StatusPill({ status }: { status: "up" | "down" | "timeout" | "error" }): JSX.Element {
  const cls =
    status === "up"
      ? "text-accent border-accent"
      : status === "timeout"
        ? "text-amber-600 border-amber-500 dark:text-amber-400"
        : "text-rose-600 border-rose-500 dark:text-rose-400";
  return (
    <span className={`inline-block px-2 py-0.5 border text-[10px] uppercase ${cls}`}>{status}</span>
  );
}
