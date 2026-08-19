#!/bin/sh
# Blocks until the app container is actually serving requests, or gives up
# after TIMEOUT_SECONDS. Runs as an ExecStartPre for the kiosk service - on a
# fresh boot there's a race between Docker starting containers and the kiosk
# service launching, and Chromium doesn't retry a failed page load on its own.

URL="http://localhost:3000"
TIMEOUT_SECONDS=120
INTERVAL_SECONDS=2
elapsed=0

while ! curl -sf -o /dev/null "$URL"; do
  if [ "$elapsed" -ge "$TIMEOUT_SECONDS" ]; then
    echo "wait-for-dashboard: gave up after ${TIMEOUT_SECONDS}s, starting anyway"
    exit 0
  fi
  sleep "$INTERVAL_SECONDS"
  elapsed=$((elapsed + INTERVAL_SECONDS))
done

echo "wait-for-dashboard: $URL is up after ${elapsed}s"
