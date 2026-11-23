/* FretCoach — songs, lessons, strum patterns and the chord-sheet parser. */
(function (root) {
  'use strict';
  const GT = (root.GT = root.GT || {});

  // Strum patterns: one character per eighth note. D = down, U = up, - = rest
  const STRUMS = {
    4: [
      { id: 'whole', name: 'One strum per bar', slots: 'D-------' },
      { id: 'quarters', name: 'Four downs', slots: 'D-D-D-D-' },
      { id: 'basic', name: 'Down, down, down-up', slots: 'D-D-D-DU' },
      { id: 'folk', name: 'Folk: D DU UDU', slots: 'D-DU-UDU' },
      { id: 'eighths', name: 'All eighths', slots: 'DUDUDUDU' },
    ],
    3: [
      { id: 'whole3', name: 'One strum per bar', slots: 'D-----' },
      { id: 'waltz', name: 'Waltz: D D D', slots: 'D-D-D-' },
      { id: 'waltz2', name: 'Waltz: D DU DU', slots: 'D-DUDU' },
    ],
  };
  function strumFor(beats, id) {
    const list = STRUMS[beats] || STRUMS[4];
    return list.find((s) => s.id === id) || list[1] || list[0];
  }

  // Song sheets use ChordPro with an optional length in beats: [G:4] = G for four beats.
  // A chord without a length lasts one bar.
  const SONGS = [
    {
      id: 'twinkle-chords', title: 'Twinkle, Twinkle, Little Star', artist: 'Traditional', level: 1, bpm: 84, beats: 4, strum: 'quarters',
      tip: 'Three chords: G, C and D. Most changes happen every two beats, so start slow.',
      sheet: `[G:4]Twinkle, twinkle, [C:2]little [G:2]star,
[C:2]How I [G:2]wonder [D:2]what you [G:2]are.
[G:2]Up a[C:2]bove the [G:2]world so [D:2]high,
[G:2]Like a [C:2]diamond [G:2]in the [D:2]sky.
[G:4]Twinkle, twinkle, [C:2]little [G:2]star,
[C:2]How I [G:2]wonder [D:2]what you [G:2]are.`,
    },
    {
      id: 'happy-birthday', title: 'Happy Birthday', artist: 'Traditional', level: 1, bpm: 96, beats: 3, strum: 'waltz',
      tip: 'In 3/4 time: count 1-2-3 and strum on each count.',
      sheet: `Happy [G:3]birthday to [D:3]you,
Happy [D:3]birthday to [G:3]you,
Happy [G:3]birthday dear [C:3]friend,
Happy [G:2]birthday [D:1]to [G:3]you!`,
    },
    {
      id: 'whole-world', title: "He's Got the Whole World", artist: 'Traditional spiritual', level: 1, bpm: 92, beats: 4, strum: 'quarters',
      tip: 'Only two chords, G and D7. A perfect first song.',
      sheet: `{c: Chorus}
He's [G:8]got the whole world in His hands,
He's [D7:8]got the whole wide world in His hands,
He's [G:8]got the whole world in His hands,
He's [D7:4]got the whole world [G:4]in His hands.`,
    },
    {
      id: 'tom-dooley', title: 'Tom Dooley', artist: 'Traditional', level: 1, bpm: 100, beats: 4, strum: 'quarters',
      tip: 'G and D, four bars each. Keep strumming while you change.',
      sheet: `{c: Chorus}
[G:12]Hang down your head, Tom Dooley, hang down your head and [D:4]cry,
[D:12]Hang down your head, Tom Dooley, poor boy, you're bound to [G:4]die.`,
    },
    {
      id: 'down-valley', title: 'Down in the Valley', artist: 'Traditional', level: 1, bpm: 100, beats: 3, strum: 'waltz',
      tip: 'A slow waltz with G and D7.',
      sheet: `Down in the [G:9]valley, the valley so [D7:3]low,
[D7:9]Hang your head over, hear the wind [G:3]blow.
[G:9]Hear the wind blow, dear, hear the wind [D7:3]blow,
[D7:9]Hang your head over, hear the wind [G:3]blow.`,
    },
    {
      id: 'amazing-grace', title: 'Amazing Grace', artist: 'John Newton (1779)', level: 2, bpm: 80, beats: 3, strum: 'waltz',
      tip: 'G7 is a G with one finger moved: a nice bridge into C.',
      sheet: `A[G:3]mazing [G7:3]grace, how [C:3]sweet the [G:6]sound, that saved a [D:9]wretch like me.
I [G:3]once was [G7:3]lost, but [C:3]now am [G:3]found, was [Em:3]blind but [D:3]now I [G:6]see.`,
    },
    {
      id: 'saints', title: 'When the Saints Go Marching In', artist: 'Traditional', level: 2, bpm: 112, beats: 4, strum: 'quarters',
      tip: 'A marching beat: strong, even down-strums.',
      sheet: `Oh when the [G:16]saints go marching in,
Oh when the [G:8]saints go [D:8]marching in,
Oh Lord I [G:4]want [G7:4]to be in that [C:8]number,
When the [G:8]saints go [D:4]marching [G:4]in.`,
    },
    {
      id: 'oh-susanna', title: 'Oh! Susanna', artist: 'Stephen Foster (1848)', level: 2, bpm: 104, beats: 4, strum: 'basic',
      tip: 'G, C and D7 with a bouncy feel.',
      sheet: `I [G:12]come from Alabama with my [D7:4]banjo on my knee,
I'm [G:12]goin' to Louisiana, my true [D7:2]love for to [G:2]see.
{c: Chorus}
Oh, Su[C:8]sanna, oh [G:4]don't you cry for [D7:4]me,
For I [G:12]come from Alabama with my [D7:2]banjo on my [G:2]knee.`,
    },
    {
      id: 'jingle-bells', title: 'Jingle Bells', artist: 'James Lord Pierpont (1857)', level: 2, bpm: 108, beats: 4, strum: 'folk',
      tip: 'A7 is an easy two-finger chord. Watch for the quick changes in lines 2 and 4.',
      sheet: `{c: Chorus}
[G:16]Jingle bells, jingle bells, jingle all the way,
[C:4]Oh what fun it [G:4]is to ride in a [A7:4]one-horse open [D:4]sleigh, hey!
[G:16]Jingle bells, jingle bells, jingle all the way,
[C:4]Oh what fun it [G:4]is to ride in a [D:4]one-horse open [G:4]sleigh.`,
    },
    {
      id: 'rising-sun', title: 'House of the Rising Sun', artist: 'Traditional', level: 3, bpm: 96, beats: 3, strum: 'waltz2',
      tip: 'Uses the easy F (four strings). One chord per bar, counted 1-2-3.',
      sheet: `There [Am:3]is a [C:3]house in [D:3]New Or[F:3]leans, they [Am:3]call the [C:3]Rising [E:6]Sun.
And it's [Am:3]been the [C:3]ruin of [D:3]many a poor [F:3]boy, and [Am:3]God, I [E:3]know I'm [Am:3]one. [E:3]`,
    },
    // Practice progressions
    {
      id: 'prog-em-am', title: 'Em and Am warm-up', artist: 'Practice loop', level: 1, bpm: 70, beats: 4, strum: 'quarters', group: 'loop',
      tip: 'The two easiest chords. Notice how your 2nd and 3rd fingers just move over one string.',
      sheet: `[Em] [Am] [Em] [Am]
[Em] [Am] [Em] [Am]`,
    },
    {
      id: 'prog-g-c-d', title: 'G, C, D: three-chord rock', artist: 'Practice loop', level: 1, bpm: 76, beats: 4, strum: 'quarters', group: 'loop',
      tip: 'Thousands of songs use only these three chords.',
      sheet: `[G] [C] [G] [D]
[G] [C] [D] [G]`,
    },
    {
      id: 'prog-pop', title: 'Pop four-chord loop', artist: 'Practice loop', level: 2, bpm: 80, beats: 4, strum: 'folk', group: 'loop',
      tip: 'G, D, Em, C. The progression behind a huge number of pop hits.',
      sheet: `[G] [D] [Em] [C]
[G] [D] [Em] [C]
[G] [D] [Em] [C]
[G] [D] [C] [G]`,
    },
    {
      id: 'prog-50s', title: "'50s doo-wop", artist: 'Practice loop', level: 2, bpm: 84, beats: 4, strum: 'basic', group: 'loop',
      tip: 'C, Am, F, G. Uses the easy four-string F.',
      sheet: `[C] [Am] [F] [G]
[C] [Am] [F] [G]`,
    },
    {
      id: 'prog-minor', title: 'Minor mood', artist: 'Practice loop', level: 2, bpm: 76, beats: 4, strum: 'folk', group: 'loop',
      tip: 'Am, F, C, G. Same chords as the doo-wop loop, starting somewhere else.',
      sheet: `[Am] [F] [C] [G]
[Am] [F] [C] [G]`,
    },
    {
      id: 'prog-blues', title: '12-bar blues in A', artist: 'Practice loop', level: 2, bpm: 90, beats: 4, strum: 'basic', group: 'loop',
      tip: 'The blues form: 4 bars of A7, 2 of D7, 2 of A7, then E7, D7, A7, E7.',
      sheet: `[A7] [A7] [A7] [A7]
[D7] [D7] [A7] [A7]
[E7] [D7] [A7] [E7]`,
    },
  ];

  // ------------------------------------------------------------- compiling
  const CHORD_TOKEN_RE = /\[([^\]]+)\]/g;

  function parseChordToken(tok) {
    const m = /^\s*([^:*\s]+)\s*(?:[:*]\s*([0-9.]+))?\s*$/.exec(tok);
    if (!m) return null;
    const v = GT.parseChord(m[1]);
    if (!v) return null;
    const beats = m[2] ? parseFloat(m[2]) : null;
    return { name: m[1], beats: beats && beats > 0 ? beats : null };
  }

  function sectionName(directive) {
    const m = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i.exec(directive.trim());
    if (!m) return null;
    const k = m[1].toLowerCase();
    if (['c', 'comment', 'ci', 'comment_italic', 'cb', 'comment_box', 'highlight'].includes(k)) return { section: m[2] || '' };
    if (['soc', 'start_of_chorus'].includes(k)) return { section: m[2] || 'Chorus' };
    if (['sov', 'start_of_verse'].includes(k)) return { section: m[2] || 'Verse' };
    if (['sob', 'start_of_bridge'].includes(k)) return { section: m[2] || 'Bridge' };
    if (['t', 'title'].includes(k)) return { meta: 'title', value: m[2] };
    if (['st', 'subtitle', 'artist'].includes(k)) return { meta: 'artist', value: m[2] };
    if (k === 'capo') return { meta: 'capo', value: parseInt(m[2], 10) || 0 };
    if (k === 'tempo') return { meta: 'bpm', value: parseInt(m[2], 10) || 0 };
    if (k === 'time') return { meta: 'beats', value: parseInt(String(m[2]).split('/')[0], 10) || 4 };
    return { ignore: true };
  }

  /**
   * Compile a song into display lines and timed steps.
   * opts.transpose shifts chord shapes (semitones).
   */
  function compileSong(song, opts) {
    const transpose = (opts && opts.transpose) || 0;
    const beatsPerBar = song.beats || 4;
    const lines = [];
    const steps = [];
    let beat = 0;
    if (song.type === 'melody') {
      const rows = String(song.melody).split('/');
      rows.forEach((row) => {
        const segs = [];
        let barNext = false;
        row.trim().split(/\s+/).forEach((tok) => {
          if (!tok) return;
          if (tok === '|') { barNext = true; return; }
          const [n, d] = tok.split(':');
          const beats = d ? parseFloat(d) : 1;
          if (n === 'r' || n === 'R') { beat += beats; return; }
          const midi = GT.parseNote(n);
          if (midi == null) return;
          const m = midi + transpose;
          const pos = GT.notePosition(m);
          const step = { kind: 'note', midi: m, beats, start: beat, line: lines.length, seg: segs.length, pos, bar: barNext };
          barNext = false;
          segs.push({ step: steps.length });
          steps.push(step);
          beat += beats;
        });
        if (segs.length) lines.push({ type: 'notes', segs });
      });
      return { lines, steps, totalBeats: beat, beatsPerBar };
    }
    String(song.sheet || '').split(/\r?\n/).forEach((raw) => {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) { if (lines.length && lines[lines.length - 1].type !== 'gap') lines.push({ type: 'gap' }); return; }
      if (/^\s*\{.*\}\s*$/.test(line)) {
        const d = sectionName(line);
        if (d && d.section != null && d.section !== '') lines.push({ type: 'section', text: d.section });
        return;
      }
      if (/^\s*#/.test(line)) { lines.push({ type: 'section', text: line.replace(/^\s*#+\s*/, '') }); return; }
      const segs = [];
      let last = 0;
      let m;
      let hadChord = false;
      CHORD_TOKEN_RE.lastIndex = 0;
      const pending = [];
      while ((m = CHORD_TOKEN_RE.exec(line))) {
        pending.push({ index: m.index, end: m.index + m[0].length, tok: m[1] });
      }
      if (pending.length === 1 && !parseChordToken(pending[0].tok) && line.trim() === `[${pending[0].tok}]`) {
        lines.push({ type: 'section', text: pending[0].tok.trim() });
        return;
      }
      let cur = null;
      const lead = pending.length ? line.slice(0, pending[0].index) : line;
      if (lead) segs.push({ chord: null, lyric: lead });
      pending.forEach((p, i) => {
        const nextIndex = i + 1 < pending.length ? pending[i + 1].index : line.length;
        const lyric = line.slice(p.end, nextIndex);
        const ct = parseChordToken(p.tok);
        if (!ct) { segs.push({ chord: null, lyric: `[${p.tok}]` + lyric }); return; }
        hadChord = true;
        const name = GT.transposeChordName(ct.name, transpose);
        const beats = ct.beats || beatsPerBar;
        cur = { chord: name, lyric, step: steps.length };
        segs.push(cur);
        steps.push({ kind: 'chord', chord: name, beats, start: beat, line: lines.length, seg: segs.length - 1 });
        beat += beats;
      });
      lines.push({ type: hadChord ? 'chords' : 'lyric', segs, chordsOnly: hadChord && segs.every((s) => !s.lyric || !s.lyric.trim()) });
    });
    while (lines.length && lines[lines.length - 1].type === 'gap') lines.pop();
    return { lines, steps, totalBeats: beat, beatsPerBar };
  }

  function chordsInSong(song) {
    if (song.type === 'melody') return [];
    const set = [];
    String(song.sheet || '').replace(CHORD_TOKEN_RE, (_, tok) => {
      const ct = parseChordToken(tok);
      if (ct && !set.includes(ct.name)) set.push(ct.name);
      return '';
    });
    return set;
  }

  Object.assign(GT, { SONGS, STRUMS, strumFor, compileSong, chordsInSong, parseChordToken });
})(typeof window !== 'undefined' ? window : globalThis);
