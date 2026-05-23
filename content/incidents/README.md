# Incident posts

One markdown file per incident. Filename becomes the incident id. Frontmatter is parsed
at boot (`src/server/services/incidentsLoader.ts`); body is rendered with `marked` and
sanitized with DOMPurify.

```
---
title: Short headline
project: shortlive          # slug from src/server/projects.ts
severity: high              # low | medium | high
opened: 2026-05-23T08:30:00Z
closed:                     # leave empty while open; ISO timestamp when resolved
---

Body in markdown. Links, lists, code blocks all work. Keep it terse: what
broke, what you did, what's next. No screenshots; this is text-only.
```

The home page shows the most recent open `severity: high` incident as a banner.
Anything else only appears via `/api/public/incidents`.

Files starting with `.` are skipped. This README is fine to keep — only `.md` files
that look like incidents (have `project` + `opened` in frontmatter) get loaded.
