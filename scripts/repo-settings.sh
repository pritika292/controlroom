#!/usr/bin/env bash
# Codifies repo settings for pritika292/controlroom.
# Idempotent — safe to re-run after editing required checks or adding new
# status contexts. No interactive prompts.

set -euo pipefail

REPO="pritika292/controlroom"

log() { printf "[repo-settings] %s\n" "$*"; }

# ---------------------------------------------------------------------------
# 1. Repo-level flags: squash-only merges, delete branches on merge
# ---------------------------------------------------------------------------
log "Applying repo merge settings"
gh repo edit "$REPO" \
  --enable-squash-merge \
  --enable-merge-commit=false \
  --enable-rebase-merge=false \
  --delete-branch-on-merge

# ---------------------------------------------------------------------------
# 2. Branch protection on main
# ---------------------------------------------------------------------------
log "Applying branch protection on main"
gh api -X PUT "repos/${REPO}/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "lint",
      "typecheck",
      "docker-build",
      "test",
      "Analyze (javascript-typescript)",
      "dependency-review",
      "scan"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON

# ---------------------------------------------------------------------------
# 3. Security and analysis (idempotent)
# ---------------------------------------------------------------------------
log "Enabling secret scanning, push protection, and Dependabot security updates"
gh api -X PATCH "repos/${REPO}" --input - <<'JSON'
{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"},"dependabot_security_updates":{"status":"enabled"}}}
JSON

log "Done"
