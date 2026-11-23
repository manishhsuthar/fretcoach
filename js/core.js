/* FretCoach — app core: storage, progress, microphone state, the practice judge, shared widgets. */
(function () {
  'use strict';
  const GT = window.GT;
  const App = (GT.app = {});
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = GT.draw.esc;
  Object.assign(App, { $, $$, esc });

  // ------------------------------------------------------------------ storage
  const STORE_KEY = 'fretcoach.v1';
  const DEFAULT_SETTINGS = {
    leftHanded: false, view: 'player', labels: 'finger', naming: 'letters', strictness: 'normal', octaveOk: true,
    micGain: 1, gate: 0.012, deviceId: '', guitarVol: 0.8, clickVol: 0.6, fullBarre: false, micWanted: false,
  };
  function loadStore() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { data = null; }
    data = data || {};
    const p = data.progress || {};
    return {
      settings: Object.assign({}, DEFAULT_SETTINGS, data.settings),
      progress: {
        lessons: p.lessons || {}, songs: p.songs || {}, chords: p.chords || {}, days: p.days || {},
        drills: Object.assign({ changes: {}, notes: { best: 0, history: [] } }, p.drills), tuned: p.tuned || null,
      },
      custom: Array.isArray(data.custom) ? data.custom : [],
    };
  }
  const store = loadStore();
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* storage unavailable */ }
    }, 150);
  }
  function resetProgress() {
    store.progress = { lessons: {}, songs: {}, chords: {}, days: {}, drills: { changes: {}, notes: { best: 0, history: [] } }, tuned: null };
    save();
  }
  const S = store.settings;

  function applySettings() {
    GT.setNaming(S.naming);
    GT.audio.setVolume('guitar', S.guitarVol);
    GT.audio.setVolume('click', S.clickVol);
    GT.audio.setMicGain(S.micGain);
    GT.audio.setGate(S.gate);
    document.documentElement.classList.toggle('lefty', !!S.leftHanded);
  }

  // -------------------------------------------------------------------- songs
  const LEVELS = { 1: 'Beginner', 2: 'Easy', 3: 'Intermediate' };
  const allSongs = () => GT.SONGS.concat(store.custom);
  const findSong = (id) => allSongs().find((s) => s.id === id);

  // -------------------------------------------------------------------- stats
  function dayKey(d) {
    const x = d || new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }
  function addPractice(sec) {
    const k = dayKey();
    store.progress.days[k] = (store.progress.days[k] || 0) + sec;
    save();
  }
  function streak() {
    const days = store.progress.days;
    const d = new Date();
    let n = 0;
    if (!(days[dayKey(d)] >= 60)) d.setDate(d.getDate() - 1);
    while (days[dayKey(d)] >= 60) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function weekMinutes() {
    const d = new Date();
    let s = 0;
    for (let i = 0; i < 7; i++) { s += store.progress.days[dayKey(d)] || 0; d.setDate(d.getDate() - 1); }
    return Math.round(s / 60);
  }
  function weekSeries() {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    const out = [];
    for (let i = 0; i < 7; i++) {
      out.push({ label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), min: Math.round((store.progress.days[dayKey(d)] || 0) / 60) });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  const chordsLearned = () => Object.keys(store.progress.chords).filter((c) => store.progress.chords[c] >= 3);
  function recordChordHit(name) {
    store.progress.chords[name] = (store.progress.chords[name] || 0) + 1;
    save();
  }

  // ------------------------------------------------------------------- events
  const bus = new EventTarget();
  const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
  const on = (name, fn) => { const h = (e) => fn(e.detail); bus.addEventListener(name, h); return () => bus.removeEventListener(name, h); };

  // ---------------------------------------------------------------------- mic
  const mic = { state: 'off', error: null };
  const secureOk = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  async function enableMic() {
    if (!secureOk()) {
      mic.state = 'insecure';
      emit('mic');
      return false;
    }
    mic.state = 'starting';
    emit('mic');
    try {
      await GT.audio.startMic(S.deviceId || undefined);
      mic.state = 'on';
      S.micWanted = true;
      save();
    } catch (err) {
      mic.error = err;
      if (err && err.name === 'OverconstrainedError' && S.deviceId) {
        S.deviceId = '';
        save();
        return enableMic();
      }
      mic.state = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError') ? 'denied' : err && err.name === 'NotFoundError' ? 'nodevice' : 'error';
    }
    emit('mic');
    return mic.state === 'on';
  }
  function disableMic() {
    GT.audio.stopMic();
    mic.state = 'off';
    S.micWanted = false;
    save();
    emit('mic');
  }
  const micOn = () => mic.state === 'on';
  function micMessage() {
    switch (mic.state) {
      case 'denied': return 'Microphone access was blocked. Click the microphone icon in the address bar, allow it, then try again.';
      case 'nodevice': return 'No microphone found. Plug one in (or use your laptop\'s built-in mic) and try again.';
      case 'insecure': return 'The browser only allows the microphone on a secure page. Start FretCoach with start.sh and open http://localhost:8765.';
      case 'error': return `The microphone could not start (${esc((mic.error && mic.error.message) || 'unknown error')}).`;
      case 'starting': return 'Starting the microphone…';
      default: return 'Turn on your microphone and FretCoach will check what you play.';
    }
  }

  // track practice time: seconds where the mic heard you recently
  let lastSound = 0;
  GT.audio.onFrame((f) => { if (f.level > f.gate && !f.ignored) lastSound = performance.now(); });
  setInterval(() => {
    if (micOn() && performance.now() - lastSound < 4000 && !document.hidden) addPractice(1);
  }, 1000);

  // -------------------------------------------------------------------- toast
  let toastTimer = 0;
  function toast(msg, kind) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
  }

  // -------------------------------------------------------------------- judge
  function chordTarget(name, capo) {
    const v = GT.voicing(name, { fullBarre: S.fullBarre });
    if (!v) return null;
    const c = capo || 0;
    return { kind: 'chord', name, v, capo: c, notes: v.notes.map((n) => n + c), pcs: v.pcs.map((p) => (p + c) % 12) };
  }
  function noteTarget(midi, pos) { return { kind: 'note', midi, pos: pos || GT.notePosition(midi) }; }

  function noteMatches(m, target) {
    const d = m - target;
    if (Math.abs(d) < 0.6) return true;
    if (!S.octaveOk) return false;
    return Math.abs(Math.abs(d) - 12) < 0.6;
  }

  /** Add one frame's chroma (and its octave-resolved spectrum) to running sums, each frame weighted equally. */
  function addNormalized(acc, chroma, accSemi, semi) {
    let s = 0;
    for (let i = 0; i < 12; i++) s += chroma[i];
    if (s <= 0) return false;
    for (let i = 0; i < 12; i++) acc[i] += chroma[i] / s;
    if (accSemi && semi) for (let i = 0; i < semi.length; i++) accSemi[i] += semi[i] / s;
    return true;
  }

  function modeOf(values) {
    const counts = new Map();
    values.forEach((v) => { const r = Math.round(v); counts.set(r, (counts.get(r) || 0) + 1); });
    let best = null, n = 0;
    counts.forEach((c, k) => { if (c > n) { n = c; best = k; } });
    return best;
  }

  /**
   * Wait-mode judge: after every strum or pluck, decides whether it matched target().
   * opts: { target: () => target|null, onResult(ok, info), onStart() }
   */
  function createJudge(opts) {
    let ev = null;
    function finish(ok, info) {
      const e = ev;
      ev = null;
      opts.onResult(ok, Object.assign({ acc: e.acc, votes: e.votes, peak: e.peak, target: e.target }, info || {}));
    }
    return {
      handle(frame) {
        const tgt = opts.target();
        if (!tgt || frame.ignored) { ev = null; return; }
        if (frame.onset) {
          ev = { t0: frame.time, acc: new Float32Array(12), semi: new Float32Array(GT.SEMI_N), n: 0, votes: [], peak: frame.level, last: null, target: tgt };
          if (opts.onStart) opts.onStart();
        }
        if (!ev) return;
        if (ev.target !== tgt) { ev = null; return; }
        const dt = frame.time - ev.t0;
        ev.peak = Math.max(ev.peak, frame.level);
        const quiet = frame.level < frame.gate * 0.8;
        if (tgt.kind === 'chord') {
          if (dt >= 0.16 && frame.chroma && !quiet && addNormalized(ev.acc, frame.chroma, ev.semi, frame.semi)) ev.n++;
          if (ev.n >= 4 && dt >= 0.3) {
            const r = GT.matchChord(ev.acc, tgt.notes, tgt.pcs, S.strictness, tgt.v.frets, tgt.capo, ev.semi);
            ev.last = r;
            if (r.ok) { finish(true, { match: r }); return; }
          }
          if (dt > 1.05 || (dt > 0.3 && quiet)) {
            if (ev.n < 4) { ev = null; return; } // a knock or very short sound: ignore
            finish(false, { match: ev.last || GT.matchChord(ev.acc, tgt.notes, tgt.pcs, S.strictness, tgt.v.frets, tgt.capo, ev.semi) });
          }
        } else {
          if (dt >= 0.03 && frame.pitch && frame.pitch.clarity >= 0.85 && !quiet) ev.votes.push(frame.pitch.midi);
          const good = ev.votes.filter((m) => noteMatches(m, tgt.midi)).length;
          if (good >= 3) { finish(true, { heard: tgt.midi }); return; }
          if (dt > 0.6 || (dt > 0.2 && quiet)) {
            if (ev.votes.length < 2) { ev = null; return; }
            finish(false, { heard: modeOf(ev.votes) });
          }
        }
      },
      reset() { ev = null; },
      busy() { return !!ev; },
    };
  }

  const sn = (s) => 6 - s;
  function explainChord(info) {
    const tgt = info.target;
    const v = tgt.v;
    const capo = tgt.capo || 0;
    const r = info.match;
    const tips = [];
    const mk = r && r.mistake;
    if (mk) {
      const n = sn(mk.string), fg = v.fingers[mk.string];
      if (mk.kind === 'open') tips.push(`String ${n} is ringing open. Press finger ${fg} down at fret ${mk.fret}, close to the fret wire.`);
      else if (mk.kind === 'muted') tips.push(`Don't strum string ${n} (${GT.STRING_NAMES[mk.string]}). It has an X${mk.string === v.frets.findIndex((f) => f < 0) && v.frets.slice(0, mk.string + 1).every((f) => f < 0) ? `: start your strum on string ${n - 1}` : ''}.`);
      else tips.push(`Finger ${fg} on string ${n} sounds like fret ${mk.playedFret}. It belongs on fret ${mk.fret}.`);
    }
    if (info.peak < GT.audio.mic.gate * 2.2) tips.push('That was quiet. Strum a little harder or move closer to the mic.');
    const dg = GT.diagnoseChord(info.acc, v, capo);
    const openPc = (s) => (GT.TUNING[s] + capo) % 12;
    dg.extra.forEach((pc) => {
      if (mk) return;
      let said = false;
      v.frets.forEach((f, s) => {
        if (said || openPc(s) !== pc) return;
        if (f < 0) { tips.push(`Don't strum string ${sn(s)} (${GT.STRING_NAMES[s]}). It has an X.`); said = true; }
        else if (f > 0) { tips.push(`String ${sn(s)} is ringing open. Press finger ${v.fingers[s]} down at fret ${f}.`); said = true; }
      });
      if (!said) tips.push(`I hear an extra ${GT.pcName(pc)}. A finger may be on the wrong fret or string.`);
    });
    dg.missing.forEach((m) => {
      const fretted = m.strings.filter((s) => v.frets[s] > 0);
      if (fretted.length) {
        const s = fretted[0];
        tips.push(`${GT.pcName(m.pc)} is missing: press finger ${v.fingers[s]} firmly on string ${sn(s)}, fret ${v.frets[s]}, close to the fret wire.`);
      } else if (m.strings.length) {
        tips.push(`${GT.pcName(m.pc)} is missing: let string ${sn(m.strings[0])} ring. Arch your fingers so they don't touch it.`);
      }
    });
    let headline = 'Not quite. Check your fingers and strum again.';
    if (mk) headline = 'Almost! One string is off.';
    else if (r && r.bestOtherName && r.bestOther > r.simExpected + 0.02) {
      headline = `That sounded more like ${GT.transposeChordName(r.bestOtherName, -capo)}.`;
    } else if (r && r.simExpected > 0.7) headline = 'Close! One string is off.';
    return { headline, tips: tips.slice(0, 2) };
  }

  function explainNote(info) {
    const tgt = info.target;
    const heard = info.heard;
    const pos = tgt.pos;
    const where = pos ? `string ${sn(pos.string)} (${GT.STRING_NAMES[pos.string]})${pos.fret ? `, fret ${pos.fret}` : ', open'}` : '';
    if (heard == null) return { headline: "I couldn't hear a clear note.", tips: ['Pluck one string firmly and let it ring.'] };
    const d = heard - tgt.midi;
    if (pos && pos.fret > 0 && heard === GT.TUNING[pos.string]) {
      return { headline: `That was the open ${GT.STRING_NAMES[pos.string]} string.`, tips: [`Press finger ${pos.finger} down at fret ${pos.fret}, then pluck.`] };
    }
    if (pos && Math.abs(d) <= 2 && heard - GT.TUNING[pos.string] >= 0) {
      const n = Math.abs(d);
      return { headline: `That was ${GT.midiName(heard)}, ${n} fret${n > 1 ? 's' : ''} too ${d > 0 ? 'high' : 'low'}.`, tips: [`Play ${where}.`] };
    }
    return { headline: `That was ${GT.midiName(heard)}. This note is ${GT.midiName(tgt.midi)}.`, tips: pos ? [`Play ${where}.`] : [] };
  }

  /** Names the chord it hears, smoothed over frames so it doesn't flicker. Returns a function(frame). */
  function createLiveNamer() {
    const ema = new Float32Array(12);
    let quietFor = 0, cand = null, candN = 0, shown = null;
    return function (frame) {
      const loud = frame.level > frame.gate * 1.5 && !frame.ignored && frame.chroma;
      if (!loud) { if (++quietFor > 20) { ema.fill(0); shown = null; } return shown; }
      quietFor = 0;
      if (frame.onset) ema.fill(0);
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += frame.chroma[i];
      if (sum <= 0) return shown;
      for (let i = 0; i < 12; i++) ema[i] = ema[i] * 0.8 + (frame.chroma[i] / sum) * 0.2;
      let best = null, sim = 0;
      GT.chordVocabulary().forEach((c) => {
        const s = GT.cosine(ema, c.template);
        if (s > sim) { sim = s; best = c.name; }
      });
      if (sim < 0.85) return shown;
      if (best === cand) candN++; else { cand = best; candN = 1; }
      if (candN >= 4) shown = best;
      return shown;
    };
  }

  // ------------------------------------------------------------------ widgets
  function chromaWidget(el) {
    el.innerHTML = Array.from({ length: 12 }, (_, i) => `<div class="cb" data-pc="${i}"><div class="cb-track"><i></i></div><span>${esc(GT.pcName(i))}</span></div>`).join('');
    const bars = $$('.cb', el);
    const fills = bars.map((b) => b.querySelector('i'));
    const level = new Float32Array(12);
    let last = 0;
    return {
      setExpected(pcs) {
        const set = new Set(pcs || []);
        bars.forEach((b, i) => b.classList.toggle('exp', set.has(i)));
      },
      update(chroma) {
        const now = performance.now();
        if (now - last < 45) return;
        last = now;
        let max = 0;
        if (chroma) for (let i = 0; i < 12; i++) max = Math.max(max, chroma[i]);
        for (let i = 0; i < 12; i++) {
          const t = chroma && max > 0 ? chroma[i] / max : 0;
          level[i] = Math.max(t, level[i] * 0.86);
          fills[i].style.transform = `scaleY(${level[i].toFixed(3)})`;
        }
      },
    };
  }

  const starsFor = (acc) => (acc >= 90 ? 3 : acc >= 70 ? 2 : acc >= 50 ? 1 : 0);
  function starsHTML(n, label) {
    let s = '';
    for (let i = 0; i < 3; i++) s += `<svg class="star ${i < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>`;
    return `<span class="stars" role="img" aria-label="${label || n + ' of 3 stars'}">${s}</span>`;
  }
  const levelBadge = (l) => `<span class="level l${l}">${LEVELS[l] || 'Custom'}</span>`;

  function micBox(compact) {
    const st = mic.state;
    if (st === 'on') return '';
    const can = st !== 'insecure';
    return `<div class="mic-box ${compact ? 'compact' : ''}" data-state="${st}">
      <svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12z"/></svg>
      <p>${micMessage()}</p>
      ${can ? `<button class="btn primary" data-act="mic-on">${st === 'denied' || st === 'error' ? 'Try again' : 'Turn on microphone'}</button>` : ''}
    </div>`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="mic-on"]');
    if (b) { e.preventDefault(); enableMic(); }
  });

  function chordStepsHTML(v) {
    const { steps, strum } = GT.chordSteps(v);
    return steps.map((s) => `<li><span class="fdot f${s.finger}">${s.finger}</span><span>${esc(s.text)}</span></li>`).join('') +
      `<li class="strum-tip"><svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M12 3v14m0 0l-5-5m5 5l5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${esc(strum)}</span></li>`;
  }

  const fbOpts = (extra) => Object.assign({ view: S.view, leftHanded: S.leftHanded, labels: S.labels }, extra);

  Object.assign(App, {
    store, S, save, resetProgress, applySettings, LEVELS, allSongs, findSong, dayKey, addPractice, streak, weekMinutes, weekSeries,
    chordsLearned, recordChordHit, bus, emit, on, mic, enableMic, disableMic, micOn, micMessage, toast, chordTarget, noteTarget,
    noteMatches, addNormalized, modeOf, createJudge, explainChord, explainNote, createLiveNamer, chromaWidget, starsFor, starsHTML,
    levelBadge, micBox, chordStepsHTML, fbOpts, DEFAULT_SETTINGS,
  });
})();
