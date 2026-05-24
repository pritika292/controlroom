export function About(): JSX.Element {
  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-12">
      <p className="te-label">ABOUT / CONTROLROOM</p>
      <h1 className="mt-2 font-mono text-3xl text-zinc-900 dark:text-white">What this is.</h1>

      <p className="mt-6 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
        A public, read-only status board for every project in Pritika's portfolio. Health pings,
        deploy timelines, recent commits. No login. No admin surface. No secrets in the browser.
      </p>
      <p className="mt-4 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
        Eleven projects share one Azure VM. ControlRoom polls each one's <code>/health</code> every
        30 seconds, syncs commits from GitHub hourly, and accepts HMAC-verified deploy webhooks. The
        frontend opens a Server-Sent Events stream and repaints the dot the moment a status flips.
      </p>

      <hr className="mt-10 border-zinc-200 dark:border-zinc-800" />

      <dl className="mt-8 grid grid-cols-2 gap-4 max-w-xl">
        <Row label="STACK" value="NODE 24 / EXPRESS 5 / TYPESCRIPT" />
        <Row label="UI" value="REACT 18 / VITE / TAILWIND" />
        <Row label="DATA" value="POSTGRES 16 / REDIS 7" />
        <Row label="DEPLOY" value="OIDC -> AZ VM RUN-COMMAND" />
      </dl>

      <p className="mt-10">
        <a
          href="https://github.com/pritika292/controlroom"
          target="_blank"
          rel="noopener noreferrer"
          className="te-label text-accent hover:underline"
        >
          SOURCE / GITHUB.COM/PRITIKA292/CONTROLROOM
        </a>
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="te-label">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-zinc-900 dark:text-white">{value}</dd>
    </div>
  );
}
