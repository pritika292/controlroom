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

## Testing standard (non-negotiable)

Every code change ships with tests in the same PR. No "follow-up PR" excuses.

- **Unit tests** for pure functions, components, hooks, and individual modules.
  Use Vitest. Server unit tests in the `node` environment; client unit tests in
  `jsdom`. Mirror shortlive's `build/vitest.config.ts` workspace split.
- **Integration tests** for any code that touches Postgres, Redis, an HTTP route
  handler, the SSE hub, the migration runner, or a worker. Tests run against
  **real Postgres + Redis** — the CI service containers in `ci.yml` and the
  `docker-compose.local.yml` services locally. **No mocks for the DB or Redis.**
- **E2E tests** with Playwright for the SPA happy paths: `/` (status board
  renders with at least shortlive's dot), `/p/:slug` (per-project page loads),
  theme toggle persists across reload, SSE reconnect after a brief network
  drop. Add Playwright only when there's a route worth testing — Tier 3 issue
  #15 is the earliest point that becomes meaningful.
- **Coverage** is reported by Vitest but **not gated** by a hard threshold in
  CI. Reviewer judgement: did the new code get appropriate tests?
- **CI must run tests on every push and every PR**, on Postgres + Redis service
  containers. The `test` job in `ci.yml` is the gate.
- **Branch protection** turns on at the end of Tier 1 (issue #10's
  `scripts/repo-settings.sh`). After that, CI must be green before merge — no
  exceptions, including for subagents.

When dispatching a Sonnet subagent, the brief MUST include: "Tests live in the
same PR; if you finish the code without tests, the PR will be rejected." That
sentence keeps the contract loud.

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
- **PR conventions** match shortlive: imperative subject + `(closes #X)`, body that
  explains the bug or intent before the change, ends with a `## Test plan` checkbox list.
  Squash-merge with `gh pr merge --auto --squash --delete-branch`.

## PR sizing (non-negotiable)

Ship **one issue per PR** unless two issues are inseparable (e.g. a service plus its
HTTP route). A reviewer should be able to read the diff in 5 minutes and understand
every line. Hard cap: **~400 LOC of production code + tests per PR**. If you're going
over, split.

When in doubt, split: easier to merge two small PRs than to recover one too-big one.

## PR voice (do not sound like AI)

Read shortlive's recent merged PRs for tone calibration:
`gh pr list -R pritika292/shortlive --state merged --limit 5 --json title,body`.

What real PRs from this project look like:

- Subject lines are direct and specific. `Fix Copy button on plain HTTP; show full URL`
  not `Implement comprehensive copy improvements`. `Add health poller` not
  `feat: implement robust polling subsystem with retry logic`.
- Bodies explain the **bug or motivation first**, then what changed, then tradeoffs you
  consciously didn't fix. Real numbers when you have them (`607 → 213 lines`, `p99 117 ms`).
- No marketing adjectives. Avoid: `comprehensive`, `robust`, `elegant`, `seamless`,
  `powerful`, `leverages`, `utilizes`, `cutting-edge`, `production-ready`.
- No "this PR" / "I have" / "we now". Imperative voice for both commits and PR bodies.
- No section headers in tiny PR bodies. A two-sentence paragraph is fine. Reserve
  `## What changed` / `## Test plan` for PRs that actually need structure.
- No exhaustive file-by-file walkthroughs in the body — the diff already shows that.
- No conventional-commit prefixes (`feat:`, `fix:`, `chore:`). Shortlive doesn't use them.
- **NEVER** include `Co-Authored-By: Claude`, `Generated with Claude Code`, em-dashes
  in PR/commit text (`—` or `–`), or emoji decoration in commit subjects.
- Honest about scope. If a knob is deliberately deferred, say "out of scope, follow-up #N"
  rather than padding the PR with it.

Before you push, **read your own commit messages and PR body out loud**. If it sounds
like a press release, rewrite it.
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
