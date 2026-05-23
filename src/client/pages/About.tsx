export function About(): JSX.Element {
  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">About</h1>
      <p className="mt-6 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
        ControlRoom is a public, read-only status board that monitors every project in Pritika's
        portfolio: health pings, deploy timelines, and recent commits, all in one place. It's the
        meta project — a single URL that shows exactly what's running, what's healthy, and how fast
        things ship. No login, no admin surface, no secrets exposed to the browser.
      </p>
      <p className="mt-4">
        <a
          href="https://github.com/pritika292/controlroom"
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-600 dark:text-violet-400 hover:underline font-medium"
        >
          View the source on GitHub
        </a>
      </p>
    </main>
  );
}
