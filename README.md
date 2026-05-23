# controlroom

Public, read-only status board for every project in Pritika's portfolio. Shows live
health, recent commits, and recent deploys per project.

Status: **bootstrapping.** No code yet. See [`PLAN.md`](./PLAN.md) for the build plan.

## Stack (planned)

- Node 24 + Express 5 + TypeScript (strict)
- React 18 + Vite + Tailwind
- PostgreSQL 16 + Redis 7 (shared with sibling projects on the same VM)
- Server-Sent Events for live status push
- OIDC-federated GitHub Actions → Azure VM deploys (no stored credentials)

## Local dev (once the scaffold lands)

```sh
mise install
npm ci
docker compose -f docker-compose.local.yml up -d
cp .env.example .env
npm run migrate
npm run dev                                 # http://localhost:3012
```

## Layout

```
.
├── PLAN.md           # full build plan (read first)
├── CLAUDE.md         # agent instructions for picking this up
└── (everything else lands as the agent works through PLAN.md)
```

## License

Source-available for portfolio review. Not yet licensed for reuse.
