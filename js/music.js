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

  Object.assign(GT, {
    NOTES_SHARP, NOTES_FLAT, TUNING, STRING_NAMES, FINGER_NAMES, INTERVALS,
    midiToFreq, freqToMidi, mod12, stringNumber, pcName, midiName, parseNote, setNaming,
    parseChord, chordKey, chordDisplayName, transposeChordName,
  });
})(typeof window !== 'undefined' ? window : globalThis);
