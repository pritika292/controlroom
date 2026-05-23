import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadIncidents } from "../../src/server/services/incidentsLoader.js";

function tempDir(): string {
  const base = mkdtempSync(path.join(os.tmpdir(), "incidents-test-"));
  return base;
}

describe("loadIncidents", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty when directory does not exist", () => {
    const incidents = loadIncidents(path.join(os.tmpdir(), "nope-" + Date.now()));
    expect(incidents).toEqual([]);
  });

  it("parses frontmatter and renders markdown body", () => {
    dir = tempDir();
    writeFileSync(
      path.join(dir, "2026-05-23-shortlive-down.md"),
      `---
title: shortlive is throwing 500s
project: shortlive
severity: high
opened: 2026-05-23T08:00:00Z
---

Health checks started failing at 08:00 UTC.

- Restarted the container
- Watching for recurrence
`,
    );

    const incidents = loadIncidents(dir);
    expect(incidents).toHaveLength(1);
    const i = incidents[0]!;
    expect(i.id).toBe("2026-05-23-shortlive-down");
    expect(i.severity).toBe("high");
    expect(i.project).toBe("shortlive");
    expect(i.title).toBe("shortlive is throwing 500s");
    expect(i.opened).toBe("2026-05-23T08:00:00.000Z");
    expect(i.closed).toBeNull();
    expect(i.bodyHtml).toContain("<p>Health checks");
    expect(i.bodyHtml).toContain("<li>Restarted");
  });

  it("sanitizes script tags in markdown body", () => {
    dir = tempDir();
    writeFileSync(
      path.join(dir, "evil.md"),
      `---
title: evil
project: shortlive
opened: 2026-05-23T08:00:00Z
---

<script>alert(1)</script>

<img src=x onerror=alert(1)>
`,
    );

    const incidents = loadIncidents(dir);
    expect(incidents[0]!.bodyHtml).not.toContain("<script>");
    expect(incidents[0]!.bodyHtml).not.toMatch(/onerror/i);
  });

  it("sorts newest-first by opened date", () => {
    dir = tempDir();
    writeFileSync(
      path.join(dir, "old.md"),
      `---\nproject: shortlive\nopened: 2026-05-01T00:00:00Z\n---\n`,
    );
    writeFileSync(
      path.join(dir, "new.md"),
      `---\nproject: shortlive\nopened: 2026-05-20T00:00:00Z\n---\n`,
    );

    const incidents = loadIncidents(dir);
    expect(incidents).toHaveLength(2);
    expect(incidents[0]!.id).toBe("new");
    expect(incidents[1]!.id).toBe("old");
  });

  it("silently skips files missing required frontmatter", () => {
    dir = tempDir();
    writeFileSync(path.join(dir, "README.md"), `# Just docs\n\nNo frontmatter here.\n`);
    writeFileSync(
      path.join(dir, "valid.md"),
      `---\nproject: shortlive\nopened: 2026-05-20T00:00:00Z\n---\n`,
    );

    const incidents = loadIncidents(dir);
    expect(incidents).toHaveLength(1);
    expect(incidents[0]!.id).toBe("valid");
  });

  it("ignores dotfiles", () => {
    dir = tempDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, ".hidden.md"), `---\nproject: x\nopened: now\n---\n`);
    const incidents = loadIncidents(dir);
    expect(incidents).toHaveLength(0);
  });
});
