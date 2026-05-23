import { ProjectCard } from "../components/ProjectCard.js";
import { useStatus } from "../hooks/useStatus.js";

export function Home(): JSX.Element {
  const { data, error, loading } = useStatus();

  return (
    <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          controlroom
        </h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
          Live status across every project in the portfolio.
        </p>
      </header>

      {loading && <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">Loading...</p>}

      {error !== null && (
        <p role="alert" className="mt-8 text-sm text-rose-600 dark:text-rose-400">
          Could not load status: {error}
        </p>
      )}

      {data !== null && (
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </section>
      )}
    </main>
  );
}
