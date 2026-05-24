import { ArchDiagram } from "../components/ArchDiagram.js";

// Real-author contact set (mirrors src/client/components/ContactStrip.tsx).
// Resume lives on the portfolio site so the family has one canonical URL
// to maintain.
const LINKEDIN = "https://linkedin.com/in/pritika-priyadarshini";
const EMAIL = "pritikaapriyadarshini@gmail.com";
const GITHUB = "https://github.com/pritika292";
const PORTFOLIO = "https://pritika.studio";
const RESUME = "https://pritika.studio/resume.pdf";

interface TechRow {
  name: string;
  why: string;
}

const TECH: TechRow[] = [
  { name: "Node 24 + Express 5", why: "tiny runtime + middleware ergonomics for the SSE hub" },
  { name: "TypeScript strict", why: "strict null-checks catch the boring half of incidents" },
  { name: "React 18 + Vite", why: "fast HMR; SPA fallback served straight from the same Express" },
  { name: "Tailwind", why: "lets the TE-inspired aesthetic stay in one place (te-* utilities)" },
  { name: "Postgres 16", why: "health_pings, deploys, commits_cache, issues_cache, site_visits" },
  { name: "Redis 7", why: "30s read-through cache + the daily-rotating IP salt for visits" },
  { name: "Server-Sent Events", why: "one-way push; cheaper than WebSocket for status flips" },
  { name: "Caddy", why: "automatic Let's Encrypt + reverse proxy across all five subdomains" },
  {
    name: "GitHub Actions + OIDC",
    why: "no long-lived secrets; az vm run-command on push to main",
  },
];

export function About(): JSX.Element {
  return (
    <main className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-12 py-12">
      <p className="te-label">ABOUT / CONTROLROOM</p>
      <h1 className="mt-2 font-mono text-3xl text-zinc-900 dark:text-white">What this is.</h1>

      {/* Full-width architecture diagram. Lived in the middle column
          originally and was too squeezed to read. Now spans the page so
          labels and edges are legible on a normal monitor. */}
      <section className="mt-10 te-panel p-6 lg:p-8">
        <p className="te-label">ARCHITECTURE</p>
        <div className="mt-4">
          <ArchDiagram />
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left: story */}
        <section className="space-y-6">
          <p className="te-label">STORY</p>
          <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
            A public, read-only status board for every project in Pritika&apos;s portfolio. Health
            pings, deploy timelines, recent commits, AI-budget counters, request latency, visit
            counts. No login. No admin surface. No secrets in the browser.
          </p>
          <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
            Five projects share one Azure VM in northcentralus. ControlRoom polls each one&apos;s{" "}
            <code className="font-mono text-zinc-900 dark:text-white">/health</code> every 30
            seconds, syncs commits from GitHub hourly, and accepts HMAC-verified deploy webhooks.
            The frontend opens a Server-Sent Events stream and repaints the dot the moment a status
            flips.
          </p>
          <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
            Visit counts come from a tiny beacon every project fires once on landing-page mount; the
            server hashes the source IP with a daily-rotating salt and aggregates this-week vs
            last-week per project. Bots are classified and excluded from the public count.
          </p>
          <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
            Deploy is GitHub Actions → OIDC → <code className="font-mono">az vm run-command</code>.
            No long-lived secrets in the repo; the runtime reads its OpenAI key from Azure Key Vault
            via the VM&apos;s Managed Identity at boot.
          </p>
        </section>

        {/* Middle: tech list (diagram moved to its own full-width section above). */}
        <section className="space-y-6">
          <p className="te-label">TECH</p>
          <dl className="space-y-3">
            {TECH.map((t) => (
              <div key={t.name}>
                <dt className="font-mono text-sm text-zinc-900 dark:text-white">{t.name}</dt>
                <dd className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{t.why}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Right: contact */}
        <section className="space-y-6">
          <p className="te-label">CONTACT</p>
          <ul className="te-panel divide-y divide-zinc-200 dark:divide-zinc-800">
            <ContactRow href={RESUME} label="Resume" value="resume.pdf" external />
            <ContactRow href={`mailto:${EMAIL}`} label="Email" value={EMAIL} />
            <ContactRow
              href={LINKEDIN}
              label="LinkedIn"
              value="linkedin.com/in/pritika-priyadarshini"
              external
            />
            <ContactRow href={GITHUB} label="GitHub" value="github.com/pritika292" external />
            <ContactRow href={PORTFOLIO} label="Portfolio" value="pritika.studio" external />
          </ul>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            5-YOE backend / distributed-systems engineer. Open to senior IC roles — US-remote
            preferred, on-site SF / NYC welcome.
          </p>
          <a
            href="https://github.com/pritika292/controlroom"
            target="_blank"
            rel="noopener noreferrer"
            className="te-label text-accent hover:underline inline-block"
          >
            SOURCE / GITHUB.COM/PRITIKA292/CONTROLROOM
          </a>
        </section>
      </div>
    </main>
  );
}

function ContactRow({
  href,
  label,
  value,
  external = false,
}: {
  href: string;
  label: string;
  value: string;
  external?: boolean;
}): JSX.Element {
  return (
    <li>
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
      >
        <span className="te-label">{label}</span>
        <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300 truncate text-right">
          {value}
        </span>
      </a>
    </li>
  );
}
