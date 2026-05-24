import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { CommitsPanel } from "../components/CommitsPanel.js";
import { DeploysPanel } from "../components/DeploysPanel.js";
import { LatencyChart } from "../components/LatencyChart.js";
import { LatencyHistogram } from "../components/LatencyHistogram.js";
import { Sparkline } from "../components/Sparkline.js";
import { StatusDot } from "../components/StatusDot.js";
import { StatusSegments } from "../components/StatusSegments.js";
import { useProjectPings, type ProjectPing } from "../hooks/useProjectPings.js";
import { useStatus, type ProjectStatus } from "../hooks/useStatus.js";
import { relativeTime } from "../lib/relativeTime.js";
import { pingStats } from "../lib/pingStats.js";

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
      <p className="mt-3 text-zinc-700 dark:text-zinc-300">{project.tagline}</p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{project.description}</p>

      {project.tech.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1">
          {project.tech.map((t) => (
            <span
              key={t}
              className="te-code border border-zinc-300 dark:border-zinc-700 px-2 py-0.5"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <Link to="/" className="mt-8 inline-block te-label text-accent hover:underline">
        BACK TO STATUS BOARD
      </Link>
    </main>
  );
}

export function Project(): JSX.Element {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data, loading } = useStatus();
  const { pings, loading: pingsLoading } = useProjectPings(slug, 30_000, 200);

  const project = useMemo(() => data?.find((p) => p.slug === slug), [data, slug]);
  const stats = useMemo(() => pingStats(pings), [pings]);

  if (loading && data === null) {
    return (
      <main className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-12 py-16">
        <p className="te-label">LOADING...</p>
      </main>
    );
  }

  if (data !== null && project === undefined) return <NotFound slug={slug} />;
  if (project === undefined) return <NotFound slug={slug} />;
  if (project.status === "planned") return <PlannedHero project={project} />;

  return (
    <main className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-12 py-10">
      <Link to="/" className="te-label text-zinc-500 hover:text-accent">
        {"<-"} STATUS BOARD
      </Link>

      {/* Project info header */}
      <header className="mt-4 te-panel p-6">
        <p className="te-label">{project.code}</p>
        <div className="mt-2 flex items-center gap-3">
          <StatusDot project={project} />
          <h1 className="font-mono text-3xl text-zinc-900 dark:text-white">{project.name}</h1>
        </div>
        <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-300">{project.tagline}</p>
        <p className="mt-2 text-base text-zinc-500 dark:text-zinc-400">{project.description}</p>

        {project.tech.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {project.tech.map((t) => (
              <span
                key={t}
                className="te-code border border-zinc-300 dark:border-zinc-700 px-2 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {project.liveUrl !== null && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noreferrer"
              className="te-label border border-accent text-accent px-3 py-1.5 hover:bg-accent hover:text-white transition-colors"
            >
              OPEN LIVE SITE -&gt;
            </a>
          )}
          <a
            href={`https://github.com/${project.repo}`}
            target="_blank"
            rel="noreferrer"
            className="te-label border border-zinc-400 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 hover:border-zinc-900 dark:hover:border-white transition-colors"
          >
            VIEW SOURCE -&gt;
          </a>
        </div>
      </header>

      {/* Stats row over the last 24h */}
      <dl className="mt-3 grid grid-cols-2 md:grid-cols-4 te-panel divide-x divide-zinc-200 dark:divide-zinc-800">
        <Stat
          label="UPTIME / 24H"
          value={stats.uptimePct === null ? "-" : `${stats.uptimePct.toFixed(1)}%`}
        />
        <Stat
          label="AVG LATENCY"
          value={stats.avgLatencyMs === null ? "-" : `${Math.round(stats.avgLatencyMs)}MS`}
        />
        <Stat
          label="P99 LATENCY"
          value={stats.p99LatencyMs === null ? "-" : `${Math.round(stats.p99LatencyMs)}MS`}
        />
        <Stat label="PINGS" value={String(stats.total)} />
      </dl>

      {/* Up/down sparkline + status time split */}
      <section className="mt-3 te-panel p-5">
        <p className="te-label">LAST 24 HOURS</p>
        <div className="mt-3">
          <Sparkline pings={pings} width={720} height={48} />
        </div>
        <div className="mt-5">
          <StatusSegments pings={pings} />
        </div>
      </section>

      {/* Latency over time + distribution side-by-side */}
      <section className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <article className="te-panel p-5">
          <p className="te-label">LATENCY / 24H</p>
          <div className="mt-3">
            <LatencyChart pings={pings} width={420} height={120} />
          </div>
        </article>
        <article className="te-panel p-5">
          <p className="te-label">LATENCY DISTRIBUTION</p>
          <div className="mt-3">
            <LatencyHistogram pings={pings} width={420} height={120} />
          </div>
        </article>
      </section>

      {/* Recent pings sits beside commits + deploys in a tight 3-col row */}
      <section className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <RecentPings pings={pings} loading={pingsLoading} />
        <CommitsPanel slug={project.slug} repo={project.repo} />
        <DeploysPanel slug={project.slug} />
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="px-4 py-3">
      <dt className="te-label">{label}</dt>
      <dd className="mt-1 font-mono text-3xl text-zinc-900 dark:text-white">{value}</dd>
    </div>
  );
}

const RECENT_PINGS_LIMIT = 10;

function RecentPings({ pings, loading }: { pings: ProjectPing[]; loading: boolean }): JSX.Element {
  // Server returns ascending (oldest first); reverse to put the newest on top.
  const rows = [...pings].reverse().slice(0, RECENT_PINGS_LIMIT);

  return (
    <article className="te-panel p-5">
      <p className="te-label">RECENT PINGS</p>
      {loading && rows.length === 0 ? (
        <p className="mt-3 te-label">LOADING...</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 te-label">NO PINGS YET</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-900 font-mono text-xs">
          {rows.map((p, i) => (
            <li key={`${p.ts}-${i}`} className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-zinc-500 dark:text-zinc-400">
                {relativeTime(p.ts).toUpperCase()}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-zinc-700 dark:text-zinc-300">{pingLatency(p)}</span>
                <StatusPill status={p.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
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
