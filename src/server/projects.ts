export interface Project {
  slug: string;
  name: string;
  code: string; // device-catalog code shown in the UI, "CR-01" etc
  status: "live" | "planned";
  port: number;
  repo: string; // "pritika292/<slug>"
  liveUrl: string | null; // null for planned
  eta?: string; // only for planned
}

const HOST = "http://135.232.183.50";

function code(n: number): string {
  return `CR-${String(n).padStart(2, "0")}`;
}

const _projects: Project[] = [
  {
    slug: "shortlive",
    name: "shortlive",
    code: code(1),
    status: "live",
    port: 3010,
    repo: "pritika292/shortlive",
    liveUrl: `${HOST}:3010`,
  },
  {
    slug: "hookrelay",
    name: "hookrelay",
    code: code(2),
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
