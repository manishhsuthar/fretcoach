/* FretCoach — music theory: notes, tuning, chord parsing and guitar voicings. */
(function (root) {
  'use strict';
  const GT = (root.GT = root.GT || {});

  const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const SOLFEGE = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // Standard tuning, index 0 = string 6 (thickest, low E) ... index 5 = string 1 (thinnest, high e)
  const TUNING = [40, 45, 50, 55, 59, 64];
  const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
  const FINGER_NAMES = ['', 'index', 'middle', 'ring', 'pinky'];

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
  const mod12 = (n) => ((n % 12) + 12) % 12;
  const stringNumber = (idx) => 6 - idx; // array index -> guitarist's string number

  let naming = 'letters'; // 'letters' | 'solfege'
  function setNaming(n) { naming = n === 'solfege' ? 'solfege' : 'letters'; }

  function pcName(pc, preferFlat) {
    pc = mod12(pc);
    if (naming === 'solfege') return SOLFEGE[pc];
    return (preferFlat ? NOTES_FLAT : NOTES_SHARP)[pc];
  }
  function midiName(m, withOctave) {
    const r = Math.round(m);
    return pcName(r) + (withOctave ? String(Math.floor(r / 12) - 1) : '');
  }

  /** "C#4" / "Bb3" / "E2" -> midi number */
  function parseNote(str) {
    const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(str).trim());
    if (!m) return null;
    let pc = LETTER_PC[m[1].toUpperCase()];
    if (m[2] === '#') pc += 1;
    if (m[2] === 'b') pc -= 1;
    return (parseInt(m[3], 10) + 1) * 12 + pc;
  }

  // ---------------------------------------------------------------- chords
  const QUALITY = {
    '': 'maj', maj: 'maj', M: 'maj', major: 'maj', Maj: 'maj',
    m: 'm', min: 'm', mi: 'm', '-': 'm', minor: 'm',
    7: '7', dom7: '7', dom: '7',
    maj7: 'maj7', M7: 'maj7', Maj7: 'maj7', ma7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', j7: 'maj7',
    m7: 'm7', min7: 'm7', mi7: 'm7', '-7': 'm7',
    sus2: 'sus2', 2: 'sus2',
    sus4: 'sus4', sus: 'sus4', 4: 'sus4',
    '7sus4': '7sus4', '7sus': '7sus4', '7sus2': '7',
    dim: 'dim', '°': 'dim', o: 'dim', dim7: 'dim7', '°7': 'dim7', o7: 'dim7',
    m7b5: 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5', 'm7-5': 'm7b5', '-7b5': 'm7b5', min7b5: 'm7b5',
    aug: 'aug', '+': 'aug', '#5': 'aug', '+5': 'aug', aug5: 'aug',
    6: '6', maj6: '6', M6: '6', m6: 'm6', min6: 'm6', '-6': 'm6',
    9: '9', add9: 'add9', add2: 'add9', madd9: 'madd9', madd2: 'madd9', m9: 'm9', min9: 'm9', maj9: 'maj9', M9: 'maj9',
    5: '5', 11: '11', 13: '13', m11: 'm7', '7b9': '7', '7#9': '7', '7b5': '7', '7#5': '7', 69: '6', '6/9': '6', m69: 'm6',
  };
  const SUFFIX = {
    maj: '', m: 'm', 7: '7', maj7: 'maj7', m7: 'm7', sus2: 'sus2', sus4: 'sus4', '7sus4': '7sus4',
    dim: 'dim', dim7: 'dim7', m7b5: 'm7b5', aug: 'aug', 6: '6', m6: 'm6', 9: '9', add9: 'add9',
    madd9: 'madd9', m9: 'm9', maj9: 'maj9', 5: '5', 11: '11', 13: '13',
  };
  const INTERVALS = {
    maj: [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
    sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], dim: [0, 3, 6], dim7: [0, 3, 6, 9],
    m7b5: [0, 3, 6, 10], aug: [0, 4, 8], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 9: [0, 4, 7, 10, 2],
    add9: [0, 4, 7, 2], madd9: [0, 3, 7, 2], m9: [0, 3, 7, 10, 2], maj9: [0, 4, 7, 11, 2],
    5: [0, 7], 11: [0, 4, 7, 10, 5], 13: [0, 4, 7, 10, 9],
  };
  const QUALITY_WORDS = {
    maj: 'major', m: 'minor', 7: 'dominant 7th', maj7: 'major 7th', m7: 'minor 7th', sus2: 'suspended 2nd',
    sus4: 'suspended 4th', '7sus4': '7th sus4', dim: 'diminished', dim7: 'diminished 7th', m7b5: 'half-diminished',
    aug: 'augmented', 6: 'major 6th', m6: 'minor 6th', 9: 'dominant 9th', add9: 'add 9', madd9: 'minor add 9',
    m9: 'minor 9th', maj9: 'major 9th', 5: 'power chord', 11: '11th', 13: '13th',
  };

  const CHORD_RE = /^([A-G])([#b♯♭]?)([^/]*)(?:\/([A-G][#b♯♭]?))?$/;

  function parsePc(letter, acc) {
    let pc = LETTER_PC[letter];
    if (acc === '#' || acc === '♯') pc += 1;
    if (acc === 'b' || acc === '♭') pc -= 1;
    return mod12(pc);
  }

  /** Parse a chord symbol. Returns null when it is not a chord. */
  function parseChord(name) {
    if (!name) return null;
    const clean = String(name).trim().replace(/\s+/g, '');
    const m = CHORD_RE.exec(clean);
    if (!m) return null;
    const root = parsePc(m[1], m[2]);
    let q = m[3].replace(/[()]/g, '');
    let quality = QUALITY[q];
    let simplified = false;
    if (quality === undefined && q.length > 1) quality = QUALITY[q.toLowerCase()];
    if (quality === undefined) {
      if (!/^[a-zA-Z0-9#b+\-°øΔ]*$/.test(q)) return null;
      simplified = true;
      if (/^(m|min|mi|-)(?!aj)/.test(q)) quality = /7|9|11|13/.test(q) ? 'm7' : 'm';
      else if (/^(maj|M|Δ)/.test(q)) quality = 'maj7';
      else if (/^(7|9|11|13)/.test(q)) quality = '7';
      else if (/^sus/.test(q)) quality = 'sus4';
      else if (/^dim/.test(q)) quality = 'dim';
      else if (/^(aug|\+)/.test(q)) quality = 'aug';
      else if (/^add/.test(q)) quality = 'add9';
      else return null;
    }
    let bass = null;
    if (m[4]) bass = parsePc(m[4][0], m[4].slice(1));
    const flat = m[2] === 'b' || m[2] === '♭';
    return { root, quality, bass, flat, name: clean, simplified };
  }

  function chordKey(root, quality) { return NOTES_SHARP[mod12(root)] + SUFFIX[quality]; }

  function chordDisplayName(root, quality, flat, bass) {
    const n = (flat ? NOTES_FLAT : NOTES_SHARP)[mod12(root)] + SUFFIX[quality];
    return bass == null || bass === mod12(root) ? n : n + '/' + (flat ? NOTES_FLAT : NOTES_SHARP)[bass];
  }

  function transposeChordName(name, semis) {
    const c = parseChord(name);
    if (!c || !semis) return name;
    const m = CHORD_RE.exec(c.name);
    const preferFlat = c.flat;
    const pick = (pc) => (preferFlat ? NOTES_FLAT : NOTES_SHARP)[mod12(pc)];
    let out = pick(c.root + semis) + m[3];
    if (c.bass != null) out += '/' + pick(c.bass + semis);
    return out;
  }

  // Open-position voicings. frets: low E -> high e, -1 = muted. fingers: 0 = open/none.
  const X = -1;
  const OPEN = {
    C: { frets: [X, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
    Cmaj7: { frets: [X, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
    C7: { frets: [X, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
    Cadd9: { frets: [X, 3, 2, 0, 3, 3], fingers: [0, 2, 1, 0, 3, 4] },
    Csus2: { frets: [X, 3, 0, 0, 3, 3], fingers: [0, 2, 0, 0, 3, 4] },
    Csus4: { frets: [X, 3, 3, 0, 1, 1], fingers: [0, 3, 4, 0, 1, 1] },
    D: { frets: [X, X, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
    Dm: { frets: [X, X, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
    D7: { frets: [X, X, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
    Dmaj7: { frets: [X, X, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 2, 3] },
    Dm7: { frets: [X, X, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
    Dsus2: { frets: [X, X, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] },
    Dsus4: { frets: [X, X, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4] },
    D5: { frets: [X, X, 0, 2, 3, X], fingers: [0, 0, 0, 1, 3, 0] },
    E: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
    Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
    E7: { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
    Em7: { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
    Emaj7: { frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0] },
    Esus4: { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] },
    E5: { frets: [0, 2, 2, X, X, X], fingers: [0, 1, 2, 0, 0, 0] },
    F: { frets: [X, X, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1], alt: { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] }, note: 'Easy F. The full barre version is 133211.' },
    Fmaj7: { frets: [X, X, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
    G: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
    G7: { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
    Gmaj7: { frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 1] },
    G6: { frets: [3, 2, 0, 0, 0, 0], fingers: [2, 1, 0, 0, 0, 0] },
    Gsus4: { frets: [3, 3, 0, 0, 1, 3], fingers: [2, 3, 0, 0, 1, 4] },
    A: { frets: [X, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
    Am: { frets: [X, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
    A7: { frets: [X, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
    Am7: { frets: [X, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
    Amaj7: { frets: [X, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
    Asus2: { frets: [X, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
    Asus4: { frets: [X, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
    A5: { frets: [X, 0, 2, 2, X, X], fingers: [0, 0, 1, 2, 0, 0] },
    B7: { frets: [X, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
    Bm: { frets: [X, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1] },
    Bm7: { frets: [X, 2, 0, 2, 0, 2], fingers: [0, 1, 0, 2, 0, 3] },
  };

  // Movable barre shapes, offsets relative to the root fret on string 6 (E) or 5 (A).
  const E_SHAPES = {
    maj: { o: [0, 2, 2, 1, 0, 0], f: [1, 3, 4, 2, 1, 1] },
    m: { o: [0, 2, 2, 0, 0, 0], f: [1, 3, 4, 1, 1, 1] },
    7: { o: [0, 2, 0, 1, 0, 0], f: [1, 3, 1, 2, 1, 1] },
    m7: { o: [0, 2, 0, 0, 0, 0], f: [1, 3, 1, 1, 1, 1] },
    maj7: { o: [0, X, 1, 1, 0, X], f: [1, 0, 3, 4, 2, 0] },
    sus4: { o: [0, 2, 2, 2, 0, 0], f: [1, 2, 3, 4, 1, 1] },
    5: { o: [0, 2, 2, X, X, X], f: [1, 3, 4, 0, 0, 0] },
  };
  const A_SHAPES = {
    maj: { o: [X, 0, 2, 2, 2, 0], f: [0, 1, 3, 3, 3, 1] },
    m: { o: [X, 0, 2, 2, 1, 0], f: [0, 1, 3, 4, 2, 1] },
    7: { o: [X, 0, 2, 0, 2, 0], f: [0, 1, 3, 1, 4, 1] },
    m7: { o: [X, 0, 2, 0, 1, 0], f: [0, 1, 3, 1, 2, 1] },
    maj7: { o: [X, 0, 2, 1, 2, 0], f: [0, 1, 3, 2, 4, 1] },
    sus2: { o: [X, 0, 2, 2, 0, 0], f: [0, 1, 3, 4, 1, 1] },
    sus4: { o: [X, 0, 2, 2, 3, 0], f: [0, 1, 2, 3, 4, 1] },
    '7sus4': { o: [X, 0, 2, 0, 3, 0], f: [0, 1, 3, 1, 4, 1] },
    dim: { o: [X, 0, 1, 2, 1, X], f: [0, 1, 2, 4, 3, 0] },
    m7b5: { o: [X, 0, 1, 0, 1, X], f: [0, 1, 3, 2, 4, 0] },
    6: { o: [X, 0, 2, 2, 2, 2], f: [0, 1, 3, 3, 3, 3] },
    5: { o: [X, 0, 2, 2, X, X], f: [0, 1, 3, 4, 0, 0] },
  };
  const FALLBACK = { 9: '7', 11: '7', 13: '7', add9: 'maj', madd9: 'm', m9: 'm7', maj9: 'maj7', dim7: 'dim', m6: 'm', aug: 'maj', '7sus4': 'sus4' };

  function shapeAt(shape, rootFret) {
    const frets = shape.o.map((o) => (o === X ? X : o + rootFret));
    let fingers = shape.f.slice();
    if (rootFret === 0) fingers = fingers.map((f, i) => (frets[i] <= 0 ? 0 : Math.max(1, f - 1)));
    return { frets, fingers };
  }

  function generated(root, quality) {
    const e = E_SHAPES[quality], a = A_SHAPES[quality];
    const rE = mod12(root - 4), rA = mod12(root - 9);
    const opts = [];
    if (e) opts.push({ v: shapeAt(e, rE), r: rE, s: 'E' });
    if (a) opts.push({ v: shapeAt(a, rA), r: rA, s: 'A' });
    if (!opts.length) return null;
    opts.sort((p, q) => p.r - q.r);
    return opts[0].v;
  }

  const voicingCache = new Map();

  /**
   * Build a playable voicing for a chord symbol.
   * Returns { name, root, quality, frets, fingers, notes (midi, without capo), pcs, barre, minFret, maxFret, difficulty, simplified, open }
   */
  function voicing(name, opts) {
    const useAlt = !!(opts && opts.fullBarre);
    const ck = name + (useAlt ? '|alt' : '');
    if (voicingCache.has(ck)) return voicingCache.get(ck);
    const c = parseChord(name);
    if (!c) return null;
    let quality = c.quality;
    let simplified = c.simplified;
    let src = OPEN[chordKey(c.root, quality)];
    let isOpen = !!src;
    if (src && useAlt && src.alt) src = src.alt;
    let v = src ? { frets: src.frets.slice(), fingers: src.fingers.slice() } : generated(c.root, quality);
    if (!v && FALLBACK[quality]) {
      quality = FALLBACK[quality];
      simplified = true;
      src = OPEN[chordKey(c.root, quality)];
      isOpen = !!src;
      v = src ? { frets: src.frets.slice(), fingers: src.fingers.slice() } : generated(c.root, quality);
    }
    if (!v) return null;
    const notes = [];
    v.frets.forEach((f, i) => { if (f >= 0) notes.push(TUNING[i] + f); });
    const fretted = v.frets.filter((f) => f > 0);
    const minFret = fretted.length ? Math.min(...fretted) : 0;
    const maxFret = fretted.length ? Math.max(...fretted) : 0;
    const barre = findBarres(v.frets, v.fingers);
    const fingerCount = new Set(v.fingers.filter((f) => f > 0)).size;
    let difficulty = 1;
    if (barre.some((b) => b.to - b.from >= 3)) difficulty = 3;
    else if (fingerCount >= 4 || maxFret > 4 || barre.length) difficulty = 2;
    const out = {
      name, root: c.root, quality, bass: c.bass, flat: c.flat, frets: v.frets, fingers: v.fingers, notes,
      pcs: INTERVALS[quality].map((i) => mod12(c.root + i)), barre, minFret, maxFret, difficulty, simplified,
      open: isOpen && !barre.some((b) => b.to - b.from >= 3), note: src && src.note,
      hasAlt: !!(OPEN[chordKey(c.root, quality)] || {}).alt,
      qualityWord: QUALITY_WORDS[quality],
    };
    voicingCache.set(ck, out);
    return out;
  }

  function findBarres(frets, fingers) {
    const out = [];
    for (let f = 1; f <= 4; f++) {
      const idx = [];
      fingers.forEach((ff, i) => { if (ff === f && frets[i] > 0) idx.push(i); });
      if (idx.length < 2) continue;
      const fr = frets[idx[0]];
      if (!idx.every((i) => frets[i] === fr)) continue;
      out.push({ finger: f, fret: fr, from: Math.min(...idx), to: Math.max(...idx) });
    }
    return out;
  }

  /** Beginner-friendly description of how to make a chord. */
  function chordSteps(v) {
    const steps = [];
    const barres = v.barre || [];
    barres.forEach((b) => {
      steps.push({ finger: b.finger, text: `Lay your ${FINGER_NAMES[b.finger]} finger (${b.finger}) flat across strings ${stringNumber(b.to)}–${stringNumber(b.from)} at fret ${b.fret}` });
    });
    v.frets.forEach((f, i) => {
      const fg = v.fingers[i];
      if (f > 0 && fg && !barres.some((b) => b.finger === fg && b.fret === f)) {
        steps.push({ finger: fg, text: `${capital(FINGER_NAMES[fg])} finger (${fg}) on string ${stringNumber(i)} (${STRING_NAMES[i]}), fret ${f}` });
      }
    });
    steps.sort((a, b) => a.finger - b.finger);
    const muted = v.frets.map((f, i) => (f < 0 ? stringNumber(i) : null)).filter((n) => n != null);
    const firstPlayed = v.frets.findIndex((f) => f >= 0);
    let strum;
    if (!muted.length) strum = 'Strum all 6 strings.';
    else if (muted.every((n) => n > stringNumber(firstPlayed))) strum = `Start your strum on string ${stringNumber(firstPlayed)} (${STRING_NAMES[firstPlayed]}). Skip string${muted.length > 1 ? 's' : ''} ${muted.sort((a, b) => b - a).join(', ')}.`;
    else strum = `Don't let string${muted.length > 1 ? 's' : ''} ${muted.join(', ')} ring.`;
    return { steps, strum };
  }

  function capital(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

  /** Pick a first-position fingering for a single melody note. */
  function notePosition(midi, opts) {
    const maxFret = (opts && opts.maxFret) || 5;
    let best = null;
    for (let s = 0; s < 6; s++) {
      const f = midi - TUNING[s];
      if (f < 0 || f > maxFret) continue;
      if (!best || f < best.fret) best = { string: s, fret: f };
    }
    if (!best) {
      for (let s = 5; s >= 0; s--) {
        const f = midi - TUNING[s];
        if (f >= 0 && f <= 15) { best = { string: s, fret: f }; break; }
      }
    }
    if (!best) return null;
    best.finger = best.fret === 0 ? 0 : Math.min(4, best.fret);
    return best;
  }

  Object.assign(GT, {
    NOTES_SHARP, NOTES_FLAT, TUNING, STRING_NAMES, FINGER_NAMES, INTERVALS, OPEN,
    midiToFreq, freqToMidi, mod12, stringNumber, pcName, midiName, parseNote, setNaming,
    parseChord, chordKey, chordDisplayName, transposeChordName, voicing, chordSteps, notePosition,
  });
})(typeof window !== 'undefined' ? window : globalThis);
