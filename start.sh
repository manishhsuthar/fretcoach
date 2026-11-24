#!/usr/bin/env bash
# Starts FretCoach on http://localhost:8765 and opens it in your browser.
# The browser only allows the microphone on localhost or https pages, so use this instead of double-clicking index.html.
# With Node.js installed, this also turns on AI song search (needs a Claude API key in .env, see README).
cd "$(dirname "$0")"
PORT="${PORT:-8765}"
URL="http://localhost:$PORT"

if command -v node >/dev/null 2>&1; then
  if [ ! -d node_modules/@anthropic-ai/sdk ]; then
    echo "First run: installing AI song search..."
    npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1 || echo "Could not install it (offline?). FretCoach works without it; AI song search stays off."
  fi
  PORT="$PORT" node server.js &
else
  echo "Node.js not found: starting without AI song search."
  echo "FretCoach is running at $URL"
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
fi
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT INT TERM
sleep 0.8
echo "Press Ctrl+C to stop."
( xdg-open "$URL" || firefox "$URL" || open "$URL" ) >/dev/null 2>&1 &
wait $SERVER
