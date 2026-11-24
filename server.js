// FretCoach local server: serves the app and the AI song finder.
// Start with ./start.sh, or `node server.js`. Listens on http://localhost:8765 only.
// AI engines: Claude (server/claude.js, paid API key) and Ollama (server/ollama.js, free, on this computer).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8765;
const HOST = '127.0.0.1';

try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* no .env file: settings may come from the environment */ }

const claude = await import('./server/claude.js');
const ollama = await import('./server/ollama.js');
const { UserFacingError } = await import('./server/chart.js');

/** What each engine can do right now, for the Add song page. */
async function aiStatus() {
  const o = await ollama.status();
  const c = { installed: claude.installed(), ready: claude.ready(), label: claude.LABEL };
  const wanted = String(process.env.AI_PROVIDER || '').toLowerCase();
  const engines = [];
  if (o.running) o.models.forEach((m) => engines.push({ id: `ollama:${m}`, kind: 'ollama', model: m, free: true, web: o.webSearch }));
  if (c.ready) engines.push({ id: 'claude', kind: 'claude', model: claude.MODEL, label: claude.LABEL, free: false, web: true });
  let preferred = null;
  if (wanted === 'claude' && c.ready) preferred = 'claude';
  else if (o.model) preferred = `ollama:${o.model}`;
  else if (c.ready) preferred = 'claude';
  return {
    ai: engines.length > 0, engines, preferred,
    claude: c, ollama: { running: o.running, models: o.models, webSearch: o.webSearch, suggested: ollama.SUGGESTED_MODEL },
    // older pages read these two
    installed: c.installed, model: claude.MODEL,
  };
}

function friendlyError(err) {
  if (err instanceof UserFacingError) return err.message;
  return claude.friendlyError(err) || 'Something went wrong with the search. Try again.';
}

// ------------------------------------------------------------------ HTTP
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};
const PUBLIC = [/^\/index\.html$/, /^\/css\/[\w.-]+\.css$/, /^\/js\/[\w.-]+\.js$/];

function serveStatic(req, res) {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { rel = ''; }
  if (rel === '/') rel = '/index.html';
  if (!PUBLIC.some((re) => re.test(rel))) { res.writeHead(404).end('Not found'); return; }
  const file = path.join(ROOT, rel);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return origin === `http://localhost:${PORT}` || origin === `http://${HOST}:${PORT}`;
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function handleFindSong(req, res) {
  // only this app may run searches (and spend API credit): JSON-only, same-origin requests
  if (!sameOrigin(req) || !String(req.headers['content-type'] || '').startsWith('application/json')) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  let body;
  try { body = await readJson(req, 4096); } catch { res.writeHead(400).end('Bad request'); return; }
  const query = String(body.query || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  const send = (obj) => { if (!res.writableEnded) res.write(JSON.stringify(obj) + '\n'); };
  const fail = (message) => { send({ type: 'error', message }); res.end(); };
  if (query.length < 2) { fail('Type a song name first.'); return; }

  const status = await aiStatus();
  // the engine the page picked; never switch to another one (it might cost money)
  const asked = String(body.engine || '');
  const engine = status.engines.find((e) => e.id === (asked || status.preferred));
  if (!engine) {
    if (asked.startsWith('ollama:')) fail(status.ollama.running ? 'That Ollama model is gone. Reload the page and pick another one.' : "Couldn't reach Ollama. Start the Ollama app (or run `ollama serve`), then try again.");
    else if (asked === 'claude' && status.claude.installed) fail('Claude is not set up: add ANTHROPIC_API_KEY to the .env file and restart FretCoach.');
    else if (asked === 'claude') fail('AI search is not installed. Run ./start.sh (it installs it), or `npm install` in the FretCoach folder.');
    else fail('No AI is set up yet. Install Ollama (free) or add a Claude API key: see the steps on this page.');
    return;
  }

  const controller = new AbortController();
  res.on('close', () => { if (!res.writableFinished) controller.abort(); }); // browser cancelled: stop the search
  send({ type: 'status', text: `Looking for "${query}"…` });
  const started = Date.now();
  try {
    const song = engine.kind === 'ollama'
      ? await ollama.findSong(query, engine.model, send, controller.signal)
      : await claude.findSong(query, send, controller.signal);
    send({ type: 'song', song });
    console.log(`[ai] "${query}" with ${engine.model} -> ${song.found ? `${song.title} (${song.confidence})` : 'not found'} in ${Math.round((Date.now() - started) / 1000)}s`);
  } catch (err) {
    if (controller.signal.aborted) { console.log(`[ai] "${query}" cancelled`); return; }
    console.error('[ai] search failed:', err && err.message);
    send({ type: 'error', message: friendlyError(err) });
  }
  res.end();
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/status' && req.method === 'GET') {
    aiStatus().then((s) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(s));
    });
    return;
  }
  if (url === '/api/find-song' && req.method === 'POST') { handleFindSong(req, res); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  serveStatic(req, res);
});

server.listen(PORT, HOST, async () => {
  console.log(`FretCoach is running at http://localhost:${PORT}`);
  const s = await aiStatus();
  if (s.ollama.running && s.ollama.models.length) console.log(`AI song search: Ollama is on (${s.ollama.models.length} model${s.ollama.models.length > 1 ? 's' : ''}), web search ${s.ollama.webSearch ? 'on' : 'off (add OLLAMA_API_KEY to .env)'}.`);
  else if (s.ollama.running) console.log(`AI song search: Ollama is running but has no model. Run: ollama pull ${s.ollama.suggested}`);
  if (s.claude.ready) console.log(`AI song search: Claude is on (${claude.MODEL}).`);
  else if (!s.claude.installed && !s.ai) console.log('AI song search: Claude is off (run `npm install`).');
  if (!s.ai) console.log('AI song search is off: install Ollama (free) or add ANTHROPIC_API_KEY to .env. See README.md.');
});
