#!/usr/bin/env bash
# Starts FretCoach on http://localhost:8765 and opens it in your browser.
# The browser only allows the microphone on localhost or https pages, so use this instead of double-clicking index.html.
cd "$(dirname "$0")"
PORT="${PORT:-8765}"
URL="http://localhost:$PORT"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT INT TERM
sleep 0.6
echo "FretCoach is running at $URL  (press Ctrl+C to stop)"
( xdg-open "$URL" || firefox "$URL" || open "$URL" ) >/dev/null 2>&1 &
wait $SERVER
