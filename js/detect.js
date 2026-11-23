/* FretCoach — signal analysis: pitch (YIN), chroma from spectrum, chord matching, onsets. Pure functions. */
(function (root) {
  'use strict';
  const GT = (root.GT = root.GT || {});
  const SEMI_N = 112; // midi 0..111 covers every guitar note and its low harmonics

  /** YIN pitch detector. buf: Float32Array time-domain. Returns {freq, clarity} or null. */
  function detectPitch(buf, sampleRate, opts) {
    const minF = (opts && opts.minFreq) || 70;
    const maxF = (opts && opts.maxFreq) || 1200;
    const threshold = (opts && opts.threshold) || 0.15;
    const n = buf.length;
    const half = n >> 1;
    const maxTau = Math.min(half - 1, Math.floor(sampleRate / minF));
    const minTau = Math.max(2, Math.floor(sampleRate / maxF));
    const d = new Float32Array(maxTau + 2);
    for (let tau = 1; tau <= maxTau + 1; tau++) {
      let sum = 0;
      for (let i = 0; i < half; i++) {
        const delta = buf[i] - buf[i + tau];
        sum += delta * delta;
      }
      d[tau] = sum;
    }
    d[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= maxTau + 1; tau++) {
      running += d[tau];
      d[tau] = running > 0 ? (d[tau] * tau) / running : 1;
    }
    let tau = -1;
    for (let t = minTau; t <= maxTau; t++) {
      if (d[t] < threshold) {
        while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) {
      // no confident dip: take global minimum but report low clarity
      let best = minTau;
      for (let t = minTau; t <= maxTau; t++) if (d[t] < d[best]) best = t;
      if (d[best] > 0.4) return null;
      tau = best;
    }
    const x0 = d[tau - 1], x1 = d[tau], x2 = d[tau + 1];
    const denom = x0 + x2 - 2 * x1;
    const better = denom !== 0 ? tau + (x0 - x2) / (2 * denom) : tau;
    return { freq: sampleRate / better, clarity: Math.max(0, Math.min(1, 1 - x1)) };
  }

  function rms(buf) {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  /**
   * Pitch-class profile from an AnalyserNode dB spectrum.
   * Uses spectral peak picking, a global tuning estimate and log-compressed magnitudes.
   */
  function chromaFromSpectrum(db, sampleRate, fftSize, opts) {
    const minHz = (opts && opts.minHz) || 75;
    const maxHz = (opts && opts.maxHz) || 1800;
    const binHz = sampleRate / fftSize;
    const lo = Math.max(2, Math.floor(minHz / binHz));
    const hi = Math.min(db.length - 2, Math.ceil(maxHz / binHz));
    let maxDb = -Infinity;
    for (let k = lo; k <= hi; k++) if (db[k] > maxDb) maxDb = db[k];
    const chroma = new Float32Array(12);
    const semi = new Float32Array(SEMI_N);
    if (!isFinite(maxDb)) return { chroma, semi, peaks: [], tuning: 0, maxDb };
    const floorDb = maxDb - ((opts && opts.rangeDb) || 45);
    const peaks = [];
    for (let k = lo; k <= hi; k++) {
      const v = db[k];
      if (v < floorDb || v < db[k - 1] || v < db[k + 1]) continue;
      if (v === db[k - 1]) continue;
      // parabolic interpolation on dB
      const a = db[k - 1], b = v, c = db[k + 1];
      const den = a - 2 * b + c;
      const p = den !== 0 ? (0.5 * (a - c)) / den : 0;
      const freq = (k + p) * binHz;
      const peakDb = b - 0.25 * (a - c) * p;
      const midi = 69 + 12 * Math.log2(freq / 440);
      // weight: dB above floor, compressed, de-emphasise upper partials a little
      const w = Math.pow((peakDb - floorDb) / 45, 1.5) / (1 + freq / 1400);
      peaks.push({ freq, midi, w, db: peakDb });
    }
    // global tuning offset (circular weighted mean of fractional semitone)
    let sx = 0, sy = 0;
    for (const pk of peaks) {
      const frac = pk.midi - Math.round(pk.midi);
      sx += pk.w * Math.cos(2 * Math.PI * frac);
      sy += pk.w * Math.sin(2 * Math.PI * frac);
    }
    const tuning = peaks.length ? Math.atan2(sy, sx) / (2 * Math.PI) : 0;
    for (const pk of peaks) {
      const m = pk.midi - tuning;
      const r = Math.round(m);
      const dev = m - r;
      const g = Math.exp(-(dev * dev) / (2 * 0.2 * 0.2));
      chroma[((r % 12) + 12) % 12] += pk.w * g;
      if (r >= 0 && r < SEMI_N) semi[r] += pk.w * g;
    }
    return { chroma, semi, peaks, tuning, maxDb };
  }

  // ------------------------------------------------------------ chord templates
  const HARMONICS = [1, 0.55, 0.4, 0.22, 0.15, 0.1];
  const templateCache = new Map();
  const semiCache = new Map();

  /** Expected energy per semitone (midi index) for a voicing, including harmonics. Keeps octave information. */
  function semiTemplate(notes) {
    const key = notes.join(',');
    if (semiCache.has(key)) return semiCache.get(key);
    const t = new Float32Array(SEMI_N);
    for (const n of notes) {
      for (let h = 1; h <= HARMONICS.length; h++) {
        const m = Math.round(n + 12 * Math.log2(h));
        if (m < SEMI_N) t[m] += HARMONICS[h - 1];
      }
    }
    for (let i = 0; i < SEMI_N; i++) t[i] = Math.pow(t[i], 0.7);
    semiCache.set(key, t);
    return t;
  }
  function cosineN(a, b) {
    let ab = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
    return aa > 0 && bb > 0 ? ab / Math.sqrt(aa * bb) : 0;
  }

  /** Expected chroma for a list of midi notes, including harmonics. */
  function templateFromNotes(notes) {
    const key = notes.join(',');
    if (templateCache.has(key)) return templateCache.get(key);
    const t = new Float32Array(12);
    for (const n of notes) {
      for (let h = 1; h <= HARMONICS.length; h++) {
        const m = n + 12 * Math.log2(h);
        const pc = ((Math.round(m) % 12) + 12) % 12;
        t[pc] += HARMONICS[h - 1];
      }
    }
    // compress like the observed chroma (pitch classes repeated on several strings are not linearly louder)
    for (let i = 0; i < 12; i++) t[i] = Math.pow(t[i], 0.7);
    templateCache.set(key, t);
    return t;
  }

  function cosine(a, b) {
    let ab = 0, aa = 0, bb = 0;
    for (let i = 0; i < 12; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
    return aa > 0 && bb > 0 ? ab / Math.sqrt(aa * bb) : 0;
  }

  let vocab = null;
  /** Comparison chords: every root as major, minor, 7, m7 plus the common open chords. */
  function vocabulary() {
    if (vocab) return vocab;
    vocab = [];
    const seen = new Set();
    const add = (name) => {
      const v = GT.voicing(name);
      if (!v || seen.has(name)) return;
      seen.add(name);
      vocab.push({ name, v, template: templateFromNotes(v.notes) });
    };
    for (let r = 0; r < 12; r++) ['', 'm', '7', 'm7'].forEach((q) => add(GT.NOTES_SHARP[r] + q));
    Object.keys(GT.OPEN).forEach(add);
    return vocab;
  }

  const STRICTNESS = {
    relaxed: { min: 0.72, margin: 0.06, share: 0.42, variant: 0.07, semiVariant: 0.045 },
    normal: { min: 0.8, margin: 0.03, share: 0.5, variant: 0.045, semiVariant: 0.025 },
    strict: { min: 0.84, margin: 0.015, share: 0.52, variant: 0.03, semiVariant: 0.012 },
  };

  /**
   * The mistakes beginners actually make, as alternative voicings that add a foreign note:
   * a fretted string ringing open, a finger one fret off, or a string marked X being strummed.
   */
  const variantCache = new Map();
  function mistakeVariants(frets, pcs, capo) {
    const key = frets.join(',') + '|' + capo;
    if (variantCache.has(key)) return variantCache.get(key);
    const chordPcs = new Set(pcs);
    const out = [];
    frets.forEach((f, s) => {
      const tries = f > 0 ? [[0, 'open'], [f - 1, 'low'], [f + 1, 'high']] : f < 0 ? [[0, 'muted']] : [];
      tries.forEach(([nf, kind]) => {
        if (kind === 'low' && nf === 0) return;
        const pc = (GT.TUNING[s] + nf + capo) % 12;
        if (chordPcs.has(pc)) return;
        const fr = frets.slice();
        fr[s] = nf;
        const notes = [];
        fr.forEach((x, i) => { if (x >= 0) notes.push(GT.TUNING[i] + x + capo); });
        out.push({ string: s, kind, fret: f, playedFret: nf, template: templateFromNotes(notes), semi: semiTemplate(notes) });
      });
    });
    variantCache.set(key, out);
    return out;
  }

  /**
   * Compare an observed chroma with the expected chord voicing.
   * expectedNotes: midi notes actually sounding (capo applied).
   */
  function matchChord(chroma, expectedNotes, expectedPcs, strictness, frets, capo, semi) {
    const s = STRICTNESS[strictness] || STRICTNESS.normal;
    const tExp = templateFromNotes(expectedNotes);
    const simExpected = cosine(chroma, tExp);
    let best = null;
    const ranked = [];
    for (const c of vocabulary()) {
      // the vocabulary is in open position without capo; compare by pitch-class content transposed by shift
      ranked.push({ name: c.name, sim: cosine(chroma, c.template), pcs: c.v.pcs });
    }
    ranked.sort((a, b) => b.sim - a.sim);
    const expSet = new Set(expectedPcs);
    // ignore comparison chords that contain the same pitch classes as the expected one (e.g. C vs Cadd9 shapes)
    const sameish = (pcs) => pcs.every((p) => expSet.has(p)) && expectedPcs.every((p) => pcs.includes(p));
    for (const r of ranked) {
      if (sameish(r.pcs)) continue;
      best = r;
      break;
    }
    // energy share inside expected pitch classes
    let total = 0, inside = 0;
    for (let i = 0; i < 12; i++) { total += chroma[i]; if (expSet.has(i)) inside += chroma[i]; }
    const share = total > 0 ? inside / total : 0;
    const bestOther = best ? best.sim : 0;
    let ok = simExpected >= s.min && simExpected >= bestOther - s.margin && share >= s.share;
    // did it sound more like a typical finger mistake than the real chord?
    let mistake = null;
    if (frets) {
      let worst = -1;
      const useSemi = semi && semi.some((x) => x > 0);
      const base = useSemi ? cosineN(semi, semiTemplate(expectedNotes)) : simExpected;
      mistakeVariants(frets, expectedPcs, capo || 0).forEach((v) => {
        const d = (useSemi ? cosineN(semi, v.semi) : cosine(chroma, v.template)) - base;
        if (d > worst) { worst = d; mistake = v; }
      });
      if (worst > (useSemi ? s.semiVariant : s.variant)) ok = false;
      else mistake = null;
    }
    // quality 0..1 for meters
    const score = Math.max(0, Math.min(1, (simExpected - 0.5) / (s.min - 0.5) * 0.8 + (simExpected >= bestOther ? 0.2 : 0)));
    return { ok, simExpected, bestOther, bestName: ranked[0] ? ranked[0].name : null, bestOtherName: best ? best.name : null, share, score, mistake };
  }

  /**
   * Explain what is wrong with a strum: which chord tones are weak and which foreign notes are loud.
   * Returns { missing: [{pc, strings:[idx]}], extra: [pc] }
   */
  function diagnoseChord(chroma, voicingObj, capo) {
    const shift = capo || 0;
    let max = 0;
    for (let i = 0; i < 12; i++) max = Math.max(max, chroma[i]);
    if (max <= 0) return { missing: [], extra: [] };
    const pcs = voicingObj.pcs.map((p) => (p + shift) % 12);
    const tExp = templateFromNotes(voicingObj.notes.map((n) => n + shift));
    let tMax = 0;
    for (let i = 0; i < 12; i++) tMax = Math.max(tMax, tExp[i]);
    const missing = [];
    pcs.forEach((pc) => {
      const expected = tExp[pc] / tMax;
      const got = chroma[pc] / max;
      if (got < expected * 0.35) {
        const strings = [];
        voicingObj.frets.forEach((f, i) => {
          if (f >= 0 && ((GT.TUNING[i] + f + shift) % 12) === pc) strings.push(i);
        });
        missing.push({ pc, strings });
      }
    });
    const extra = [];
    for (let i = 0; i < 12; i++) {
      if (!pcs.includes(i) && chroma[i] / max > 0.55 && tExp[i] / tMax < 0.3) extra.push(i);
    }
    return { missing, extra };
  }

  /** Onset detector on frame RMS values. Call per frame. */
  function createOnsetDetector() {
    let slow = 0;
    let lastOnset = -1;
    let prev = 0;
    return function step(level, time, gate) {
      let onset = false;
      const rising = level > gate && (level > slow * 1.6 + gate * 0.2 || (prev < gate && level >= gate));
      if (rising && time - lastOnset > 0.14) {
        onset = true;
        lastOnset = time;
      }
      // envelope follower: quick to rise, slow to fall
      slow = level > slow ? slow + (level - slow) * 0.5 : slow * 0.9 + level * 0.1;
      prev = level;
      return onset;
    };
  }

  Object.assign(GT, {
    semiTemplate, cosineN, SEMI_N,
    detectPitch, rms, chromaFromSpectrum, templateFromNotes, cosine, matchChord, diagnoseChord,
    createOnsetDetector, chordVocabulary: vocabulary, STRICTNESS,
  });
})(typeof window !== 'undefined' ? window : globalThis);
