import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

export type IncidentSeverity = "low" | "medium" | "high";

export interface Incident {
  id: string; // filename without .md
  severity: IncidentSeverity;
  project: string;
  title: string;
  opened: string; // ISO date
  closed: string | null;
  bodyHtml: string;
}

interface RawFrontmatter {
  severity?: string;
  project?: string;
  title?: string;
  // gray-matter coerces YAML date scalars into JS Date objects, so accept
  // either string or Date and normalize to an ISO string ourselves.
  opened?: string | Date;
  closed?: string | Date | null;
}

function asIsoString(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

// Resolved at module load. Production reload happens via container restart
// on deploy (git pull && docker compose up -d --build). Local dev gets
// reload-on-change via `tsx watch`'s file watcher when we extend its
// include glob to content/**/*.md.
let cache: Incident[] = [];
let loadedFrom = "";

function defaultDir(): string {
  // Walk up from this file (dist/server/services/) to repo root.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../content/incidents");
}

function parseSeverity(raw: string | undefined): IncidentSeverity {
  if (raw === "high" || raw === "medium" || raw === "low") return raw;
  return "low";
}

function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(html);
}

export function loadIncidents(dir: string = defaultDir()): Incident[] {
  if (!existsSync(dir)) {
    cache = [];
    loadedFrom = dir;
    return cache;
  }

  const files = readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("."));
  const incidents: Incident[] = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const raw = readFileSync(fullPath, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data as RawFrontmatter;

    if (!fm.project || !fm.opened) {
      // Silently skip non-incident markdown (e.g. README). Real incidents
      // always carry these fields.
      continue;
    }

    const opened = asIsoString(fm.opened);
    if (opened === null) continue;

    incidents.push({
      id: file.replace(/\.md$/, ""),
      severity: parseSeverity(fm.severity),
      project: fm.project,
      title: fm.title ?? file.replace(/\.md$/, ""),
      opened,
      closed: asIsoString(fm.closed ?? null),
      bodyHtml: renderMarkdown(parsed.content),
    });
  }

  // Newest first by opened date.
  incidents.sort((a, b) => (a.opened < b.opened ? 1 : -1));

  cache = incidents;
  loadedFrom = dir;
  return cache;
}

export function getIncidents(): Incident[] {
  return cache;
}

export function getLoadedFrom(): string {
  return loadedFrom;
}
