#!/bin/bash
# Civica Pulse — owner-Mac daily runner (pulse-v2.16-beta).
#
# Drives the daily Pulse cycle under the adopted subscription runtime
# (plan/pulse-subscription-runtime-resolution-v1.md):
#   1. ingest  — production cron route (model-free; content-idempotent)
#   2. cluster — production cron route (model-free; content-idempotent)
#   3. classify — LOCALLY on this Mac through the four subscription CLIs
#                 (PULSE_CLASSIFY_TRANSPORT=subscription-cli; $0 marginal)
#   4. score   — production cron route (model-free; content-idempotent)
#
# Catch-up semantics: launchd firing late after wake, or a deliberate manual
# re-run, is always safe. Every invocation is its own delivery — the stage
# Idempotency-Keys carry this cycle's start stamp, because the cron boundary
# derives a deterministic pipeline-run id from that key, and a repeated key
# resolves to an earlier cycle's already-terminal run row (a terminal run is
# never resumable, so the route answers 500 handler_exception). Re-runs stay
# safe through content idempotency instead: duplicate raw events are skipped
# and source freshness is stamped only for sources that actually gained a row.
# A fully missed day is recorded honestly by the pipeline's own run ledger as
# an outage (PUL-022); this script never backfills or backdates anything.
#
# No paid API is touched anywhere in this script. The scheduled Vercel
# classify route is hard-locked separately; classification happens only here.

set -u
REPO="${CIVICA_REPO:-/Users/fernandobalino/Projects/civica}"
LOG="$HOME/Library/Logs/civica-pulse-runner.log"
DAY="$(date -u +%Y-%m-%d)"
# One identity per invocation, not per day: see the catch-up note above.
CYCLE="$(date -u +%Y%m%dT%H%M%SZ)-$$"
BASE="https://civicaatlas.org"

log() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }
notify() {
  /usr/bin/osascript -e "display notification \"$1\" with title \"Civica Pulse\"" >/dev/null 2>&1 || true
}

cd "$REPO" || { notify "Runner cannot find the civica repo"; exit 1; }

# Node and the four subscription CLIs are resolved from the environment the
# installer bakes into the launchd plist (launchd provides no shell PATH).
RUNNER_NODE="${RUNNER_NODE:-$(command -v node 2>/dev/null || true)}"
if [ -z "$RUNNER_NODE" ] || [ ! -x "$RUNNER_NODE" ]; then
  log "FATAL: node binary not found (RUNNER_NODE='$RUNNER_NODE')"
  notify "Pulse runner: node not found — re-run the installer"
  exit 1
fi
for cli in codex claude kimi grok; do
  command -v "$cli" >/dev/null 2>&1 || {
    log "FATAL: subscription CLI '$cli' not on PATH ($PATH)"
    notify "Pulse runner: $cli CLI not found — re-run the installer"
    exit 1
  }
done
SECRET="$(grep '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '"')"
if [ -z "$SECRET" ]; then
  log "FATAL: CRON_SECRET missing from .env.local"
  notify "Pulse runner: missing CRON_SECRET"
  exit 1
fi

FAILED=""

stage_route() {
  local name="$1" route="$2"
  local key="mac-runner-$name-$CYCLE"
  local out code body outcome
  out="$(curl -sS -m 900 -w '\n%{http_code}' \
    -H "Authorization: Bearer $SECRET" \
    -H "Idempotency-Key: $key" \
    "$BASE$route" 2>>"$LOG")"
  code="${out##*$'\n'}"
  body="${out%$'\n'*}"
  outcome="$(printf '%s' "$body" |
    grep -o '"outcome"[[:space:]]*:[[:space:]]*"[a-z_]*"' | head -1 |
    sed 's/.*:[[:space:]]*"//; s/"$//')"
  log "stage=$name http=$code outcome=${outcome:-none} key=$key body=$(printf '%s' "$body" | head -c 300 | tr '\n' ' ')"
  # Honest, non-failure results:
  #   200                          the stage completed (or was suppressed as a duplicate)
  #   202 job_in_progress          another delivery of this job holds the lease
  #   503 job_busy                 same, from the job-wide lock
  #   502/503 partial | blocked    the route recorded a real partial result
  # Everything else is a genuine failure and must reach the owner: 500
  # handler_exception, any 4xx, and the 503 infrastructure outcomes
  # (delivery_control_unavailable, pipeline_observability_unavailable,
  # retry_limit_exhausted) all mean the stage did not honestly run.
  case "$code" in
    200) return 0 ;;
    202|502|503)
      case "$outcome" in
        job_in_progress|job_busy|partial|blocked) return 0 ;;
      esac
      ;;
  esac
  FAILED="$FAILED $name"
  return 1
}

log "=== Pulse daily cycle start day=$DAY ==="

stage_route ingest "/api/cron/pulse/v2/ingest"

# Clustering runs LOCALLY: incident identity requires the semantic embedding
# model, which loads on this Mac but not in serverless. The scheduled route
# stays as an honest partial (publishes nothing under lexical fallback).
if "$RUNNER_NODE" "$REPO/node_modules/.bin/tsx" \
   scripts/sync-pulse-v2-cluster.ts >> "$LOG" 2>&1; then
  log "stage=cluster local embedding run completed"
else
  log "stage=cluster FAILED (see log above)"
  FAILED="$FAILED cluster"
fi

# Classification: locally, on the owner's subscription CLIs only. The daily
# cap bounds CLI churn (~40s/cluster observed); the queue's terminal states
# make the backlog drain across days with zero repeat calls.
if PULSE_CLASSIFY_TRANSPORT=subscription-cli \
   "$RUNNER_NODE" "$REPO/node_modules/.bin/tsx" \
   scripts/sync-pulse-v2-classify.ts --limit 120 >> "$LOG" 2>&1; then
  log "stage=classify local subscription run completed"
else
  log "stage=classify FAILED (see log above)"
  FAILED="$FAILED classify"
fi

stage_route score "/api/cron/pulse/v2/score"

if [ -n "$FAILED" ]; then
  log "=== cycle finished with failures:$FAILED ==="
  notify "Pulse daily cycle had failures:$FAILED — see civica-pulse-runner.log"
  exit 1
fi
log "=== cycle finished clean ==="
notify "Pulse daily cycle completed ($DAY)"
