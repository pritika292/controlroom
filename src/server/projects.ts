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

const _projects: Project[] = [
  {
    slug: "shortlive",
    name: "shortlive",
    code: code(1),
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
    slug: "pg-inspector",
    name: "pg-inspector",
    code: code(12),
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
    slug: "focusroom",
    name: "focusroom",
    code: code(13),
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
    slug: "portfolio",
    name: "portfolio",
    code: code(14),
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
  {
    slug: "hookrelay",
    name: "hookrelay",
    code: code(2),
    tagline: "Webhook delivery & replay playground.",
    description:
      "Receive, inspect, replay, and replay-with-edit any webhook. HMAC-verified, exponential backoff, dead-letter queue, signed delivery to user-supplied targets.",
    tech: ["TypeScript", "Express", "Postgres", "Redis", "BullMQ"],
    status: "planned",
    port: 3001,
    repo: "pritika292/hookrelay",
    liveUrl: null,
    eta: "Q3 2026",
  },
  {
    slug: "flowforge",
    name: "flowforge",
    code: code(3),
    tagline: "Durable visual workflow engine.",
    description:
      "Drag-and-drop step builder with crash-resistant execution. Long-running workflows survive container restarts via a Postgres-backed state machine.",
    tech: ["TypeScript", "React Flow", "Postgres", "Temporal-ish core"],
    status: "planned",
    port: 3002,
    repo: "pritika292/flowforge",
    liveUrl: null,
    eta: "Q3 2026",
  },
  {
    slug: "edgeflag",
    name: "edgeflag",
    code: code(4),
    tagline: "Feature flag control room.",
    description:
      "Boolean and percentage rollouts, environment-scoped overrides, audit log, SSE-pushed updates to clients. Read path designed for <5 ms p99 in-process.",
    tech: ["TypeScript", "Express", "Postgres", "Redis", "SSE"],
    status: "planned",
    port: 3003,
    repo: "pritika292/edgeflag",
    liveUrl: null,
    eta: "Q3 2026",
  },
  {
    slug: "canvasync",
    name: "canvasync",
    code: code(5),
    tagline: "Real-time collaborative whiteboard.",
    description:
      "Multi-user canvas with CRDT-based merge. Operations are conflict-free; reconnect after a network drop catches up automatically.",
    tech: ["TypeScript", "React", "Yjs", "WebSocket", "Postgres"],
    status: "planned",
    port: 3004,
    repo: "pritika292/canvasync",
    liveUrl: null,
    eta: "Q3 2026",
  },
  {
    slug: "pulseboard",
    name: "pulseboard",
    code: code(6),
    tagline: "Live multi-tenant analytics.",
    description:
      "Per-tenant dashboards over a shared Postgres + Redis store; row-level isolation, snapshot batching, debounced filter chips.",
    tech: ["TypeScript", "React", "Postgres", "Redis", "Recharts"],
    status: "planned",
    port: 3005,
    repo: "pritika292/pulseboard",
    liveUrl: null,
    eta: "Q3 2026",
  },
  {
    slug: "prbot",
    name: "prbot",
    code: code(7),
    tagline: "Agentic PR reviewer playground.",
    description:
      "Open a PR, get an LLM-generated review with line-level comments. Bounded prompt context, cost ceiling per repo, escape hatch to disable.",
    tech: ["TypeScript", "GitHub App", "OpenAI", "Express"],
    status: "planned",
    port: 3006,
    repo: "pritika292/prbot",
    liveUrl: null,
    eta: "Q4 2026",
  },
  {
    slug: "mcphub",
    name: "mcphub",
    code: code(8),
    tagline: "MCP server sandbox runner.",
    description:
      "Drop in a Model Context Protocol server, get a hosted sandbox URL. Process isolation, resource limits, ephemeral by default.",
    tech: ["TypeScript", "Docker", "MCP SDK"],
    status: "planned",
    port: 3007,
    repo: "pritika292/mcphub",
    liveUrl: null,
    eta: "Q4 2026",
  },
  {
    slug: "recall",
    name: "recall",
    code: code(9),
    tagline: "Streaming RAG with citations.",
    description:
      "Ingest a doc, ask a question, get an answer with inline source spans. pgvector for retrieval, server-sent streaming for response.",
    tech: ["TypeScript", "pgvector", "OpenAI", "SSE"],
    status: "planned",
    port: 3008,
    repo: "pritika292/recall",
    liveUrl: null,
    eta: "Q4 2026",
  },
  {
    slug: "liveauction",
    name: "liveauction",
    code: code(10),
    tagline: "Real-time concurrent bidding.",
    description:
      "Hundreds of clients, one item, no double-spends. Optimistic locking on the bid path, WebSocket fan-out for state, server-authoritative price.",
    tech: ["TypeScript", "Express", "Postgres", "WebSocket", "Redis"],
    status: "planned",
    port: 3009,
    repo: "pritika292/liveauction",
    liveUrl: null,
    eta: "Q4 2026",
  },
  {
    slug: "pitchpage",
    name: "pitchpage",
    code: code(11),
    tagline: "Personalized founder demo portal.",
    description:
      "One URL per founder. Their company logo, their pain points, the projects most relevant to them, tracked open + click signals.",
    tech: ["TypeScript", "Next.js", "Postgres"],
    status: "planned",
    port: 3011,
    repo: "pritika292/pitchpage",
    liveUrl: null,
    eta: "Q4 2026",
  },
];

export const projects: readonly Project[] = Object.freeze(_projects);

export function getLiveProjects(): readonly Project[] {
  return projects.filter((p) => p.status === "live");
}

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
