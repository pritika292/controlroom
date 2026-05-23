# CLAUDE.md — instructions for the agent building ControlRoom

You are picking up a brand-new project with no code yet. Everything you need to know
to execute is in `PLAN.md` in this directory. **Read PLAN.md end-to-end before doing
anything else.**

## TL;DR

ControlRoom is a public, read-only status board for Pritika's portfolio projects. No
admin UI, no auth, no destructive endpoints. The toolchain mirrors the `shortlive`
reference project (path in PLAN.md). The plan has 25 GitHub issues across 6 tiers and
~7 days of work.

## First moves

1. Read `PLAN.md` here.
2. Read `shortlive/README.md` and `shortlive/CLAUDE.md` — path:
   `/Users/abdul/Library/Mobile Documents/com~apple~CloudDocs/Study/portfolio-projects/shortlive`.
   Skim every file under "Specific shortlive files to mirror" in PLAN.md.
3. Read the relevant docs in the parent `portfolio-control` repo:
   - `/Users/abdul/Library/Mobile Documents/com~apple~CloudDocs/Study/PProjects/docs/README.md`
   - `02-iam-security.md`, `03-cicd-oidc.md`, `05-deployment-strategy.md`,
     `06-security-pre-commit.md`
4. Follow the "Repo + infra bootstrap" section of PLAN.md step by step.
5. File all 25 GitHub issues via a `scripts/file-all-issues.sh` script you write before
   any code lands.
6. Start with Tier 0 (bootstrap) — don't skip phases.

## Constraints (read these before writing code)

- **No secrets in this repo or in GitHub Actions secrets.** Everything goes through Azure
  Key Vault, pulled to the VM via Managed Identity. The plan's "Security considerations"
  section is non-negotiable.
- **Public, read-only HTTP surface only.** No `POST`, `PATCH`, `DELETE` reachable from the
  internet except `/webhooks/github` (HMAC-verified).
- **Commit messages**: imperative, ≤72 chars, no AI fingerprints, no em-dashes, no
  "Generated with Claude Code" footers. Read shortlive's `git log` for tone. Author identity
  is `Pritika Priyadarshini <pritika98@gmail.com>` — verify with `git config user.email`
  before the first commit.
- **PR conventions** match shortlive: `Tier N: short description (closes #X)`, Summary +
  Test plan body, squash-merge with `gh pr merge --squash --delete-branch`.
- **CI must be green before merge.** Branch protection on `main` will enforce this once
  you run `scripts/repo-settings.sh`.

## What's intentionally not here

Don't add Google OAuth, an admin console, container restart endpoints, log tail
streaming, a cost dashboard, or a DB browser. Those were cut for v1 — see "Out of scope"
in PLAN.md.

## When in doubt

- Mirror shortlive's pattern verbatim. If shortlive doesn't have a pattern for it, ask
  the user before inventing one.
- Don't refactor shortlive when you adapt files into this repo — just rename and retarget
  paths/ports.
