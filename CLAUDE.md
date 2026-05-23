# CLAUDE.md — instructions for the agent building ControlRoom

You are picking up a brand-new project with no code yet. Everything you need to know
to execute is in `PLAN.md` in this directory. **Read PLAN.md end-to-end before doing
anything else.**

## TL;DR

ControlRoom is a public, read-only status board for Pritika's portfolio projects. No
admin UI, no auth, no destructive endpoints. The toolchain mirrors the `shortlive`
reference project (path in PLAN.md). The plan has 25 GitHub issues across 6 tiers and
~7 days of work.

## Model routing

The main session runs on **Opus** and is responsible for planning, architecture
decisions, task decomposition, code review, and answering ambiguous questions.
Implementation and coding tasks are **delegated to Sonnet subagents** via the Agent
tool with `model: "sonnet"`.

- **Opus (main thread)**: read PLAN.md, design approaches, decompose tiers into
  scoped tasks, review subagent output, write commit messages and PR descriptions,
  resolve `[sonnet]`/`[opus]` review comments, decide when to escalate to the user.
- **Sonnet (subagents)**: write code, run tests, apply edits to scoped files,
  follow a clear spec produced by Opus. A Sonnet subagent should **not** make
  architectural decisions on its own — if a spec is ambiguous or scope is unclear,
  it must stop and report back to Opus rather than invent a design.
- **How to dispatch**: use the Agent tool with `subagent_type: "general-purpose"`
  (or a more specific agent) and `model: "sonnet"`. Brief the subagent like a
  colleague with no context: include file paths, line numbers, the exact spec,
  acceptance criteria, and what NOT to do. Ask for a short report back.
- **What stays in Opus even if it touches code**: one-line fixes during review,
  resolving merge conflicts, anything that requires reading the full conversation
  history to decide correctly.
- **Mechanics note**: the main session model is set by the user via `/model`. Opus
  does not switch the main session itself — it only delegates by spawning Sonnet
  subagents. If the user sets the main session to Sonnet, the routing collapses
  and Sonnet handles everything in-thread.

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
