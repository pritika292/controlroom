export interface Project {
  slug: string;
  name: string;
  code: string; // device-catalog code shown in the UI, "CR-01" etc
  tagline: string; // one-liner shown on cards and at the top of the detail page
  description: string; // a couple of sentences for the detail page only
  tech: string[]; // small tech-stack chips
  status: "live" | "planned";
  port: number;
  repo: string; // "pritika292/<slug>"
  liveUrl: string | null; // null for planned
  eta?: string; // only for planned
}

// Every live project is reverse-proxied by Caddy at <slug>.pritika.studio
// with a Let's Encrypt cert. The legacy http://135.232.183.50:<port> form
// still works internally for the deploy health probe and ad-hoc curl
// diagnostics, but the public URL is HTTPS through Caddy.
function liveUrlFor(slug: string): string {
  return `https://${slug}.pritika.studio`;
}

function code(n: number): string {
  return `CR-${String(n).padStart(2, "0")}`;
}

// Order matches the portfolio site's SidePane: focusroom, controlroom,
// pg-inspector, shortlive, portfolio. Codes are contiguous CR-01..05 —
// no forward-looking gaps for projects that aren't actually shipping
// (#81). Planned entries dropped entirely; bring them back as separate
// commits if any actually start shipping.
const _projects: Project[] = [
  {
    slug: "focusroom",
    name: "focusroom",
    code: code(1),
    tagline: "Drop a post, watch 20 personas react. Audience simulation.",
    description:
      "Type a post or pitch, the room of 20 personas (diverse demographics, voices, occupations) reacts in real time with threaded replies. Each persona has its own model card and stance; reactions stream via SSE as the simulation runs.",
    tech: ["TypeScript", "Express", "React 18", "Postgres 16", "SSE", "Azure OpenAI"],
    status: "live",
    port: 3015,
    repo: "pritika292/focusroom",
    liveUrl: liveUrlFor("focusroom"),
  },
  {
    slug: "controlroom",
    name: "controlroom",
    code: code(2),
    tagline: "Live status board running the whole portfolio family.",
    description:
      "Health pings every 30s, deploys streamed in over webhooks, commits cached hourly, AI-call budgets watched, request-latency p95 charted. The dashboard you're looking at right now.",
    tech: ["TypeScript", "Express 5", "React 18", "Postgres 16", "Redis 7", "SSE"],
    status: "live",
    port: 3012,
    repo: "pritika292/controlroom",
    liveUrl: liveUrlFor("controlroom"),
  },
  {
    slug: "pg-inspector",
    name: "pg-inspector",
    code: code(3),
    tagline: "Data sandbox: 5 industry schemas, SQL + AI plan reading.",
    description:
      "Pick a scenario (social media, enterprise SaaS, infra startup, ecommerce, fintech). Explore its multi-schema layout in an interactive visualizer. Write SQL or generate it from English. See query plans and EXPLAIN-AI commentary. Get schema-improvement suggestions. SQL safety in three defense-in-depth layers; AI via Azure OpenAI + Managed Identity (no API keys anywhere).",
    tech: [
      "TypeScript",
      "Express 5",
      "React 18",
      "Postgres 16",
      "react-flow",
      "Azure OpenAI",
      "Managed Identity",
    ],
    status: "live",
    port: 3014,
    // Custom: subdomain is `pg`, not `pg-inspector`. liveUrlFor would have
    // produced https://pg-inspector.pritika.studio which isn't routed.
    liveUrl: "https://pg.pritika.studio",
    repo: "pritika292/pg-inspector",
  },
  {
    slug: "shortlive",
    name: "shortlive",
    code: code(4),
    tagline: "URL shortener with sub-second live click analytics.",
    description:
      "Click on a short link, watch the dashboard update before the next blink. Real production-shaped: async fail-soft hot path, Redis pub/sub fan-out, rule-based webhook automation with HMAC + exponential backoff + DLQ.",
    tech: ["TypeScript", "Express 5", "React 18", "Postgres 16", "Redis 7", "WebSocket"],
    status: "live",
    port: 3010,
    repo: "pritika292/shortlive",
    liveUrl: liveUrlFor("shortlive"),
  },
  {
    slug: "portfolio",
    name: "portfolio",
    code: code(5),
    tagline: "Pritika Priyadarshini — portfolio.",
    description:
      "The umbrella site for the whole portfolio. Hero, experience, education, the live shipping pulse pulled from controlroom, and cards for every spare-time build. Caddy serves it at the apex.",
    tech: ["TypeScript", "Express 5", "React 18", "Tailwind", "Caddy"],
    status: "live",
    port: 3013,
    repo: "pritika292/portfolio",
    // Apex domain, no subdomain prefix.
    liveUrl: "https://pritika.studio",
  },
];

export const projects: readonly Project[] = Object.freeze(_projects);

export function getLiveProjects(): readonly Project[] {
  return projects.filter((p) => p.status === "live");
}

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
