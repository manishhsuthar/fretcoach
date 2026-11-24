// The chord chart every AI engine returns: its JSON schema, the rules for filling it in, and the checks
// that run before the app accepts it. Shared by server/claude.js and server/ollama.js.

// Chord-name parser shared with the browser app, used to check what the AI returns.
await import('../js/music.js');
export const GT = globalThis.GT;

export const STRUM_IDS = { 4: ['whole', 'quarters', 'basic', 'folk', 'eighths'], 3: ['whole3', 'waltz', 'waltz2'] };

/** A problem to show the user as is. */
export class UserFacingError extends Error {}

export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'a web page'; } };

/** How to fill in the chart. Both engines get this after their own instructions. */
export const CHART_RULES = `- sections: in playing order (Intro, Verse 1, Chorus, ...). Use repeat when a section is played several times in a row.
- chords: every chord change with its length in beats, so the lengths add up to the song's real bars (a full 4/4 bar is 4 beats).
- chord names: standard symbols the app can draw (G, Em, D7, Cmaj7, Cadd9, F#m, Bb, Dsus4, G/B). Leave out passing chords and ornaments a beginner would skip, and say so in notes.
- bpm: the tempo of the original recording. beats_per_bar: 4 for 4/4; 3 for 3/4. For 6/8, use 3 with each beat an eighth note, so one 6/8 bar is two bars here, and give bpm in eighth notes.
- strum: the closest pattern. whole = one strum per bar; quarters = four downstrokes; basic = D D D DU; folk = D DU UDU; eighths = steady down-up; whole3 = one strum per 3/4 bar; waltz = D D D; waltz2 = D DU DU.
- No lyrics: the app can't store song lyrics, for copyright reasons. Section names only.
- notes: one or two short sentences for the player, such as a tuning difference or a simplification you made.
If you can't identify the song or find chords you trust, set found to false and say why in notes (suggest the song they probably meant, if any).`;

export const SONG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['found', 'title', 'artist', 'key', 'capo', 'bpm', 'beats_per_bar', 'strum', 'sections', 'notes', 'confidence', 'sources'],
  properties: {
    found: { type: 'boolean', description: 'false when the song could not be identified or no trustworthy chords were found' },
    title: { type: 'string' },
    artist: { type: 'string' },
    key: { type: 'string', description: 'Key of the chord shapes as written, e.g. "G" or "Em"' },
    capo: { type: 'integer', description: 'Capo fret for these shapes, 0 for no capo' },
    bpm: { type: 'integer', description: 'Tempo of the original recording' },
    beats_per_bar: { type: 'integer', enum: [3, 4] },
    strum: { type: 'string', enum: [...STRUM_IDS[4], ...STRUM_IDS[3]] },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'repeat', 'chords'],
        properties: {
          name: { type: 'string', description: 'Intro, Verse 1, Chorus, Bridge, Outro, ...' },
          repeat: { type: 'integer', description: 'How many times in a row this section is played' },
          chords: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['chord', 'beats'],
              properties: { chord: { type: 'string' }, beats: { type: 'number' } },
            },
          },
        },
      },
    },
    notes: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    sources: { type: 'array', items: { type: 'string' }, description: 'URLs of the pages the chart is based on' },
  },
};

// "N.C." (no chord), "x2", "%" and similar sheet markings are not chords: drop them quietly.
const NOT_A_CHORD = /^(n\.?\s?c\.?|x\s?\d+|\d+\s?x|%|\/+|-+|\|+)$/i;

/** Removes sheet markings that are not chords, so they are neither drawn nor reported as errors. */
export function dropMarkings(s) {
  (s.sections || []).forEach((sec) => {
    if (Array.isArray(sec.chords)) sec.chords = sec.chords.filter((c) => c && !NOT_A_CHORD.test(String(c.chord || '').trim()));
  });
  return s;
}

/** Problems the model should fix before we accept the chart. */
export function checkSong(s) {
  if (!s.found) return [];
  const problems = [];
  if (!Array.isArray(s.sections) || !s.sections.length) problems.push('sections is empty.');
  let count = 0;
  (s.sections || []).forEach((sec) => {
    if (!sec.chords || !sec.chords.length) problems.push(`Section "${sec.name}" has no chords.`);
    (sec.chords || []).forEach((c) => {
      count++;
      if (!GT.parseChord(c.chord) || !GT.voicing(c.chord)) problems.push(`"${c.chord}" in ${sec.name} is not a chord symbol the app can draw. Use a standard symbol or the nearest simpler chord.`);
      if (!(c.beats > 0 && c.beats <= 32)) problems.push(`"${c.chord}" in ${sec.name} has length ${c.beats} beats; use a length between 0.5 and 32.`);
    });
  });
  if (count > 600) problems.push('The chart is too long. Use repeat for repeated sections instead of writing them out.');
  return [...new Set(problems)].slice(0, 12);
}

/** Shortens text to at most max characters, ending at a full sentence where possible. */
export function shorten(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > max * 0.4 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
}

/** Clamps every field to what the app can use. */
export function tidySong(s) {
  const beats = s.beats_per_bar === 3 ? 3 : 4;
  const clamp = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  return {
    found: !!s.found,
    title: String(s.title || '').slice(0, 120),
    artist: String(s.artist || '').slice(0, 120),
    key: String(s.key || '').slice(0, 12),
    capo: clamp(s.capo, 0, 9, 0),
    bpm: clamp(s.bpm, 40, 220, 90),
    beats_per_bar: beats,
    strum: STRUM_IDS[beats].includes(s.strum) ? s.strum : beats === 3 ? 'waltz' : 'basic',
    sections: (s.sections || []).map((sec) => ({
      name: String(sec.name || 'Section').slice(0, 40),
      repeat: clamp(sec.repeat, 1, 8, 1),
      chords: (sec.chords || []).map((c) => ({ chord: String(c.chord).trim(), beats: Math.round(Math.min(32, Math.max(0.5, Number(c.beats) || beats)) * 4) / 4 })),
    })),
    notes: shorten(s.notes, 600),
    confidence: ['high', 'medium', 'low'].includes(s.confidence) ? s.confidence : 'medium',
    sources: (s.sources || []).filter((u) => /^https?:\/\//i.test(u)).slice(0, 6),
  };
}
