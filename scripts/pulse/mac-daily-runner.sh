#!/bin/bash
# Civica Pulse — owner-Mac daily runner (pulse-v2.16-beta).
#
# Drives the daily Pulse cycle under the adopted subscription runtime
# (plan/pulse-subscription-runtime-resolution-v1.md):
#   1. ingest  — production cron route (model-free; idempotent per day)
#   2. cluster — production cron route (model-free; idempotent per day)
#   3. classify — LOCALLY on this Mac through the four subscription CLIs
#                 (PULSE_CLASSIFY_TRANSPORT=subscription-cli; $0 marginal)
#   4. score   — production cron route (model-free; idempotent per day)
#
# Catch-up semantics: every stage is idempotent per UTC day (durable
# Idempotency-Keys + the pipeline's own convergence guarantees), so launchd
# firing late after wake, or a manual re-run, is always safe. A fully missed
# day is recorded honestly by the pipeline's own run ledger as an outage
# (PUL-022); this script never backfills or backdates anything.
#
# No paid API is touched anywhere in this script. The scheduled Vercel
# classify route is hard-locked separately; classification happens only here.

set -u
REPO="${CIVICA_REPO:-/Users/fernandobalino/Projects/civica}"
LOG="$HOME/Library/Logs/civica-pulse-runner.log"
DAY="$(date -u +%Y-%m-%d)"
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
  local out code
  out="$(curl -sS -m 900 -w '\n%{http_code}' \
    -H "Authorization: Bearer $SECRET" \
    -H "Idempotency-Key: mac-runner-$name-$DAY" \
    "$BASE$route?source=mac-runner" 2>>"$LOG")"
  code="${out##*$'\n'}"
  log "stage=$name http=$code body=$(echo "$out" | head -c 300 | tr '\n' ' ')"
  # 200 = completed; 502/503 = honest partial/skip recorded by the route.
  case "$code" in
    200|502|503) return 0 ;;
    *) FAILED="$FAILED $name"; return 1 ;;
  esac
}

log "=== Pulse daily cycle start day=$DAY ==="

stage_route ingest "/api/cron/pulse/v2/ingest"
stage_route cluster "/api/cron/pulse/v2/cluster"

# Classification: locally, on the owner's subscription CLIs only.
if PULSE_CLASSIFY_TRANSPORT=subscription-cli \
   "$RUNNER_NODE" "$REPO/node_modules/.bin/tsx" \
   scripts/sync-pulse-v2-classify.ts >> "$LOG" 2>&1; then
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
