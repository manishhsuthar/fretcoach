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
    // Melodies (single notes, first position)
    {
      id: 'mel-mary', title: 'Mary Had a Little Lamb', artist: 'Melody · G & B strings', level: 1, bpm: 90, beats: 4, type: 'melody',
      tip: 'Only three notes: B (open), A (string 3, fret 2) and G (open), plus D (string 2, fret 3).',
      melody: 'B3 A3 G3 A3 | B3 B3 B3:2 | A3 A3 A3:2 | B3 D4 D4:2 / B3 A3 G3 A3 | B3 B3 B3 B3 | A3 A3 B3 A3 | G3:4',
    },
    {
      id: 'mel-twinkle', title: 'Twinkle, Twinkle (melody)', artist: 'Melody · G, B & e strings', level: 1, bpm: 92, beats: 4, type: 'melody',
      tip: 'Stays within the first three frets.',
      melody: 'G3 G3 D4 D4 | E4 E4 D4:2 | C4 C4 B3 B3 | A3 A3 G3:2 / D4 D4 C4 C4 | B3 B3 A3:2 | D4 D4 C4 C4 | B3 B3 A3:2 / G3 G3 D4 D4 | E4 E4 D4:2 | C4 C4 B3 B3 | A3 A3 G3:2',
    },
    {
      id: 'mel-ode', title: 'Ode to Joy', artist: 'Beethoven · melody', level: 1, bpm: 96, beats: 4, type: 'melody',
      tip: 'Mostly on the B string. Move one finger at a time.',
      melody: 'B3 B3 C4 D4 | D4 C4 B3 A3 | G3 G3 A3 B3 | B3:1.5 A3:0.5 A3:2 / B3 B3 C4 D4 | D4 C4 B3 A3 | G3 G3 A3 B3 | A3:1.5 G3:0.5 G3:2 / A3 A3 B3 G3 | A3 B3:0.5 C4:0.5 B3 G3 | A3 B3:0.5 C4:0.5 B3 A3 | G3 A3 D3:2 / B3 B3 C4 D4 | D4 C4 B3 A3 | G3 G3 A3 B3 | A3:1.5 G3:0.5 G3:2',
    },
    {
      id: 'mel-frere', title: 'Frère Jacques', artist: 'Traditional · melody', level: 1, bpm: 96, beats: 4, type: 'melody',
      tip: 'A round: once you know it, play it with a friend starting two bars later.',
      melody: 'G3 A3 B3 G3 | G3 A3 B3 G3 | B3 C4 D4:2 | B3 C4 D4:2 / D4:0.5 E4:0.5 D4:0.5 C4:0.5 B3 G3 | D4:0.5 E4:0.5 D4:0.5 C4:0.5 B3 G3 | G3 D3 G3:2 | G3 D3 G3:2',
    },
    {
      id: 'mel-jingle', title: 'Jingle Bells (melody)', artist: 'Melody · G & B strings', level: 2, bpm: 104, beats: 4, type: 'melody',
      tip: 'Lots of repeated B notes. Pluck each one clearly.',
      melody: 'B3 B3 B3:2 | B3 B3 B3:2 | B3 D4 G3:1.5 A3:0.5 | B3:4 / C4 C4 C4:1.5 C4:0.5 | C4 B3 B3 B3:0.5 B3:0.5 | B3 A3 A3 B3 | A3:2 D4:2 / B3 B3 B3:2 | B3 B3 B3:2 | B3 D4 G3:1.5 A3:0.5 | B3:4 / C4 C4 C4 C4 | C4 B3 B3 B3:0.5 B3:0.5 | D4 D4 C4 A3 | G3:4',
    },
    {
      id: 'mel-birthday', title: 'Happy Birthday (melody)', artist: 'Melody · 3/4 time', level: 2, bpm: 92, beats: 3, type: 'melody',
      tip: 'Uses four strings. The high G is string 1, fret 3.',
      melody: 'G3:0.75 G3:0.25 | A3 G3 C4 | B3:2 G3:0.75 G3:0.25 | A3 G3 D4 | C4:2 G3:0.75 G3:0.25 / G4 E4 C4 | B3 A3:2 | F4:0.75 F4:0.25 E4 C4 | D4 C4:2',
    },
  ];

  // ------------------------------------------------------------------ lessons
  const LESSONS = [
    {
      id: 'meet', title: 'Meet your guitar', minutes: 5,
      summary: 'Hold it, name the six strings, and learn the finger numbers.',
      body: `<p>Sit up, rest the guitar's waist on your right leg, and let the neck point slightly up to the left. Your <b>left hand</b> presses the strings (the "fretting hand"), your <b>right hand</b> strums or plucks near the sound hole. Left-handed? Switch it on in Settings.</p>
<p>The strings are numbered from the <b>thinnest (1)</b> to the <b>thickest (6)</b>. From thickest to thinnest they are <b>E A D G B E</b>. Remember it with <i>Eddie Ate Dynamite, Good Bye Eddie</i>.</p>
<p>Fingers are numbered too: <b>1</b> index, <b>2</b> middle, <b>3</b> ring, <b>4</b> pinky. Every dot on a FretCoach diagram shows which finger to use in that colour.</p>`,
      showHand: true,
      exercises: [
        { title: 'Pluck each open string, 6 → 1', kind: 'melody', melody: 'E2 A2 D3 G3 B3 E4', tip: 'Don\'t press anything. Pluck the string shown and FretCoach checks it.' },
        { title: 'Back down, 1 → 6', kind: 'melody', melody: 'E4 B3 G3 D3 A2 E2' },
      ],
    },
    {
      id: 'tune', title: 'Tune up', minutes: 3,
      summary: 'An out-of-tune guitar makes right chords sound wrong. Tune before every session.',
      body: `<p>Pluck one string at a time and turn its tuning peg slowly. If the needle sits <b>left</b>, the string is too low (flat): <b>tighten</b> it. If it sits <b>right</b>, it is too high (sharp): <b>loosen</b> it.</p>
<p>New strings stretch and go flat quickly. That's normal: tune again after a few minutes.</p>`,
      tuner: true,
      exercises: [],
    },
    {
      id: 'first-notes', title: 'Your first fretted notes', minutes: 8,
      summary: 'Press a string behind a fret. Notes on the B and high E strings.',
      body: `<p>Press with your <b>fingertip</b>, just behind the metal fret (not on top of it). Keep your thumb behind the neck, roughly opposite your middle finger.</p>
<p>A buzzing sound means you need to press a little harder or move closer to the fret. One finger per fret: fret 1 is finger 1, fret 3 is finger 3.</p>`,
      exercises: [
        { title: 'B string: B, C, D', kind: 'melody', melody: 'B3 C4 D4 C4 B3 C4 D4:2' },
        { title: 'High E string: E, F, G', kind: 'melody', melody: 'E4 F4 G4 F4 E4 F4 G4:2' },
        { title: 'Both strings together', kind: 'melody', melody: 'B3 C4 D4 E4 F4 G4 F4 E4 D4 C4 B3:2' },
      ],
      songs: ['mel-mary', 'mel-ode'],
    },
    {
      id: 'em', title: 'First chord: E minor', minutes: 6,
      summary: 'Two fingers, all six strings. The easiest full chord on guitar.',
      body: `<p>Put finger <b>2</b> on string 5, fret 2 and finger <b>3</b> on string 4, fret 2. Arch your fingers so they don't touch the strings below them.</p>
<p>Strum all six strings from the thickest down. Then pluck each string one at a time: every string should ring clearly. If one is dull, a finger is touching it.</p>`,
      chord: 'Em',
      exercises: [
        { title: 'Strum Em four times', kind: 'chords', chords: ['Em', 'Em', 'Em', 'Em'] },
        { title: 'Lift off and put it back', kind: 'chords', chords: ['Em', 'Em', 'Em', 'Em', 'Em', 'Em'], tip: 'Take your hand off the neck between strums. Building the shape from memory is the real skill.' },
      ],
    },
    {
      id: 'am', title: 'A minor, and your first change', minutes: 8,
      summary: 'Am uses the same two fingers as Em, shifted over one string.',
      body: `<p>For <b>Am</b>, don't play string 6. Finger 1 goes on string 2, fret 1; fingers 2 and 3 slide over one string from the Em shape, to strings 4 and 3.</p>
<p>When changing, move all fingers together and keep them close to the strings. Speed comes later; clean comes first.</p>`,
      chord: 'Am',
      exercises: [
        { title: 'Strum Am four times', kind: 'chords', chords: ['Am', 'Am', 'Am', 'Am'] },
        { title: 'Change: Em ↔ Am', kind: 'chords', chords: ['Em', 'Am', 'Em', 'Am', 'Em', 'Am', 'Em', 'Am'] },
      ],
      songs: ['prog-em-am'],
    },
    {
      id: 'g-c-d', title: 'G, C and D', minutes: 12,
      summary: 'The three chords behind thousands of songs.',
      body: `<p><b>G</b> stretches across the neck: fingers 1 and 2 on the thick strings, finger 3 on the thinnest. <b>C</b> is a staircase: 3 on string 5, 2 on string 4, 1 on string 2. Skip string 6. <b>D</b> is a small triangle on the thin strings. Strum only the four thinnest.</p>
<p>Watch the "X" marks: those strings stay silent. Start each strum on the first string that has no X.</p>`,
      chord: 'G',
      exercises: [
        { title: 'G chord', kind: 'chords', chords: ['G', 'G', 'G', 'G'] },
        { title: 'C chord', kind: 'chords', chords: ['C', 'C', 'C', 'C'] },
        { title: 'D chord', kind: 'chords', chords: ['D', 'D', 'D', 'D'] },
        { title: 'Change: G → C → D', kind: 'chords', chords: ['G', 'C', 'D', 'G', 'C', 'D', 'G'] },
      ],
      songs: ['twinkle-chords', 'prog-g-c-d', 'tom-dooley'],
    },
    {
      id: 'strumming', title: 'Strumming in time', minutes: 10,
      summary: 'Keep your strumming hand moving like a pendulum, down on the beat and up in between.',
      body: `<p>Count <b>1 & 2 & 3 & 4 &</b>. Your hand moves <b>down on the numbers</b> and <b>up on the "&"</b>, even when you don't hit the strings. That steady motion is what keeps you in time.</p>
<p>Use <b>Play along</b> mode: a metronome clicks, the chords move on their own, and FretCoach scores each bar. Start at a slow tempo and speed up when you score 3 stars.</p>`,
      exercises: [
        { title: 'Play along: Em ↔ Am', kind: 'song', song: 'prog-em-am', mode: 'timed' },
        { title: 'Play along: G, C, D', kind: 'song', song: 'prog-g-c-d', mode: 'timed' },
      ],
      songs: ['whole-world', 'happy-birthday'],
    },
    {
      id: 'sevenths', title: 'E, A and the 7th chords', minutes: 12,
      summary: 'E, A, plus D7, A7 and E7, the sound of blues and folk.',
      body: `<p><b>E</b> is Em plus finger 1 on string 3, fret 1. <b>A</b> lines three fingers up on fret 2. Squeeze them in, slightly angled.</p>
<p>7th chords add a bluesy tension that wants to move to the next chord. They are often <i>easier</i> than the plain chord: E7 is just E with finger 3 lifted.</p>`,
      chord: 'E',
      exercises: [
        { title: 'E and A', kind: 'chords', chords: ['E', 'A', 'E', 'A', 'E', 'A'] },
        { title: 'The 7ths: A7, D7, E7', kind: 'chords', chords: ['A7', 'D7', 'E7', 'A7', 'D7', 'E7'] },
      ],
      songs: ['prog-blues', 'down-valley', 'oh-susanna', 'jingle-bells'],
    },
    {
      id: 'f-chord', title: 'The F chord (easy version)', minutes: 10,
      summary: 'The famous hard chord, made easier: four strings and a mini barre.',
      body: `<p>Lay finger <b>1</b> flat across strings 1 and 2 at fret 1. Then finger 2 on string 3, fret 2 and finger 3 on string 4, fret 3. Strum only the four thinnest strings.</p>
<p>If the mini barre buzzes, roll finger 1 slightly onto its bony side, and keep your thumb low behind the neck.</p>`,
      chord: 'F',
      exercises: [
        { title: 'F chord', kind: 'chords', chords: ['F', 'F', 'F', 'F'] },
        { title: 'Change: C ↔ F', kind: 'chords', chords: ['C', 'F', 'C', 'F', 'C', 'F'] },
        { title: 'Change: Am → F → C → G', kind: 'chords', chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'] },
      ],
      songs: ['prog-50s', 'prog-minor', 'rising-sun'],
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

  // ------------------------------------------------------ pasted chord sheets
  const IGNORABLE = /^(\||\|\||-+|x\d+|\(x\d+\)|\d+x|\/|%|\*|N\.?C\.?|\(|\)|:|\.+)$/i;
  const SECTION_RE = /^\s*[\[(]?\s*(intro|verse|chorus|pre-?chorus|bridge|outro|refrain|interlude|solo|instrumental|hook|coda|tag|ending|break)\b[^\])]*[\])]?\s*:?\s*$/i;
  const SECTION_WITH_CHORDS_RE = /^\s*[\[(]?\s*(intro|outro|interlude|instrumental|solo|riff|break|ending)\s*[\])]?\s*:?\s*(.+)$/i;
  const TAB_RE = /^\s*[eBGDAEbgdae]?\s*\|?[-0-9|hpbrx\/\\~()\s]{6,}\|?\s*$/;

  function chordLineTokens(line) {
    const tokens = [];
    const re = /\S+/g;
    let m;
    let chordCount = 0;
    while ((m = re.exec(line))) {
      const t = m[0].replace(/[,]$/, '');
      if (IGNORABLE.test(t)) continue;
      const clean = t.replace(/^\(|\)$/g, '');
      if (!GT.parseChord(clean)) return null;
      chordCount++;
      tokens.push({ col: m.index, name: clean });
    }
    return chordCount ? tokens : null;
  }

  /** Convert a pasted chord sheet (chords over lyrics, or ChordPro) to ChordPro text plus metadata. */
  function parsePasted(text) {
    const meta = {};
    const out = [];
    const lines = String(text || '').replace(/\t/g, '    ').split(/\r?\n/);
    const unknown = new Set();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\s+$/, '');
      const trimmed = line.trim();
      if (!trimmed) { out.push(''); continue; }
      const dir = /^\{.*\}$/.test(trimmed) ? sectionName(trimmed) : null;
      if (dir) {
        if (dir.meta) meta[dir.meta] = dir.value;
        else if (dir.section != null) out.push(`{c: ${dir.section}}`);
        continue;
      }
      const capo = /^capo\s*:?\s*(?:on\s*)?(\d+)/i.exec(trimmed);
      if (capo) { meta.capo = parseInt(capo[1], 10); continue; }
      if (/^(tuning|key|tempo|bpm|chords?)\s*:/i.test(trimmed)) {
        const bpm = /^(tempo|bpm)\s*:\s*(\d+)/i.exec(trimmed);
        if (bpm) meta.bpm = parseInt(bpm[2], 10);
        continue;
      }
      if (TAB_RE.test(line) && /-{3,}/.test(line)) continue;
      if (/\[[^\]]+\]/.test(line) && !SECTION_RE.test(trimmed)) {
        // ChordPro inline; keep, but flag unknown chord tokens
        line.replace(CHORD_TOKEN_RE, (_, tok) => { if (!parseChordToken(tok)) unknown.add(tok); return ''; });
        out.push(line);
        continue;
      }
      if (SECTION_RE.test(trimmed)) { out.push(`{c: ${trimmed.replace(/^[\[(]|[\])]?:?$/g, '').replace(/[\])]/g, '').trim()}}`); continue; }
      const swc = SECTION_WITH_CHORDS_RE.exec(trimmed);
      if (swc && chordLineTokens(swc[2])) {
        out.push(`{c: ${swc[1][0].toUpperCase() + swc[1].slice(1)}}`);
        out.push(chordLineTokens(swc[2]).map((t) => `[${t.name}]`).join(' '));
        continue;
      }
      const chords = chordLineTokens(line);
      if (chords) {
        const next = lines[i + 1] != null ? lines[i + 1].replace(/\s+$/, '') : '';
        const nextIsLyric = next.trim() && !chordLineTokens(next) && !SECTION_RE.test(next.trim()) && !/^\{.*\}$/.test(next.trim()) && !(TAB_RE.test(next) && /-{3,}/.test(next));
        if (nextIsLyric) {
          let lyric = next;
          const maxCol = chords[chords.length - 1].col;
          if (lyric.length < maxCol) lyric = lyric.padEnd(maxCol, ' ');
          let merged = '';
          let pos = 0;
          chords.forEach((c) => {
            merged += lyric.slice(pos, c.col) + `[${c.name}]`;
            pos = c.col;
          });
          merged += lyric.slice(pos);
          out.push(merged.replace(/\s+$/, ''));
          i++;
        } else {
          out.push(chords.map((c) => `[${c.name}]`).join(' '));
        }
        continue;
      }
      out.push(line);
    }
    const sheet = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return { sheet, meta, unknown: [...unknown] };
  }

  /** Quick progression: "G D Em C" or "G | D | Em C" -> sheet */
  function progressionToSheet(text, beats) {
    const bars = String(text).split(/\n/).map((row) => {
      const parts = row.split('|').map((b) => b.trim()).filter(Boolean);
      if (parts.length > 1) {
        return parts.map((bar) => {
          const cs = bar.split(/\s+/).filter((c) => GT.parseChord(c));
          if (!cs.length) return '';
          const each = beats / cs.length;
          return cs.map((c) => `[${c}${cs.length > 1 ? ':' + each : ''}]`).join('');
        }).join(' ');
      }
      return row.split(/[\s,]+/).filter((c) => GT.parseChord(c)).map((c) => `[${c}]`).join(' ');
    });
    return bars.filter(Boolean).join('\n');
  }

  Object.assign(GT, { SONGS, LESSONS, STRUMS, strumFor, compileSong, chordsInSong, parsePasted, progressionToSheet, parseChordToken });
})(typeof window !== 'undefined' ? window : globalThis);
