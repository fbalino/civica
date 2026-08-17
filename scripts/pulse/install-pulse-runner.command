#!/bin/bash
# Civica Pulse — one-click installer for the daily Mac runner.
# Double-click this file in Finder (or run it in Terminal). It:
#   1. checks the four subscription CLIs are installed and signed in,
#   2. bakes the correct PATH and node binary into a launchd job,
#   3. schedules the daily cycle at 09:30 local time (launchd runs it on
#      next wake if the Mac was asleep — that is the catch-up behavior),
#   4. runs nothing paid: classification uses your subscriptions only.
# Re-running this installer is always safe; it replaces the previous job.

set -euo pipefail
REPO="${CIVICA_REPO:-/Users/fernandobalino/Projects/civica}"
LABEL="org.civicaatlas.pulse-daily"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
RUNNER="$REPO/scripts/pulse/mac-daily-runner.sh"

echo "== Civica Pulse daily runner installer =="

[ -f "$RUNNER" ] || { echo "ERROR: runner not found at $RUNNER"; exit 1; }
chmod +x "$RUNNER"

NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || { echo "ERROR: node not found in this shell"; exit 1; }
NODE_REAL="$(readlink -f "$NODE_BIN" 2>/dev/null || echo "$NODE_BIN")"
echo "node: $NODE_REAL"

MISSING=""
for cli in codex claude kimi grok; do
  BIN="$(command -v "$cli" || true)"
  if [ -z "$BIN" ]; then MISSING="$MISSING $cli"; else echo "$cli: $BIN"; fi
done
[ -z "$MISSING" ] || { echo "ERROR: missing CLI(s):$MISSING"; exit 1; }

RUNNER_PATH="$(dirname "$NODE_REAL"):$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/.kimi-code/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$RUNNER</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$RUNNER_PATH</string>
    <key>RUNNER_NODE</key><string>$NODE_REAL</string>
    <key>CIVICA_REPO</key><string>$REPO</string>
    <key>HOME</key><string>$HOME</string>
    <key>USER</key><string>$(id -un)</string>
    <key>LOGNAME</key><string>$(id -un)</string>
    <key>TMPDIR</key><string>/tmp/</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>9</integer>
    <key>Minute</key><integer>30</integer>
  </dict>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/civica-pulse-runner.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/civica-pulse-runner.log</string>
</dict>
</plist>
PLISTEOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 \
  && echo "OK — daily job installed (09:30 local; catch-up on wake)." \
  || { echo "ERROR: launchd did not accept the job"; exit 1; }

echo
read -r -p "Run one cycle right now to test it? [y/N] " GO
if [ "${GO:-n}" = "y" ] || [ "${GO:-n}" = "Y" ]; then
  launchctl kickstart "gui/$(id -u)/$LABEL"
  echo "Started. Watch: tail -f ~/Library/Logs/civica-pulse-runner.log"
fi
echo "Done."
