/* FretCoach — views: home, learn, lessons, songs, add song, chords, tuner, drills, settings; router & boot. */
(function () {
  'use strict';
  const GT = window.GT;
  const App = GT.app;
  const { $, $$, esc, S, store } = App;
  const P = () => store.progress;

  const lessonDone = (id) => !!(P().lessons[id] && P().lessons[id].done);
  const exDone = (id, i) => !!(P().lessons[id] && P().lessons[id].ex && P().lessons[id].ex[i]);
  function markExercise(id, i) {
    const L = (P().lessons[id] = P().lessons[id] || { ex: {} });
    L.ex = L.ex || {};
    L.ex[i] = true;
    const lesson = GT.LESSONS.find((l) => l.id === id);
    if (lesson && lesson.exercises.every((_, k) => L.ex[k])) L.done = true;
    App.save();
  }
  function markLesson(id) {
    const L = (P().lessons[id] = P().lessons[id] || { ex: {} });
    L.done = true;
    App.save();
  }
  const nextLesson = () => GT.LESSONS.find((l) => !lessonDone(l.id)) || null;

  function songCard(song) {
    const pr = P().songs[song.id];
    const chords = GT.chordsInSong(song);
    const tags = song.type === 'melody' ? '<span class="tag">Melody</span>' : chords.slice(0, 6).map((c) => `<span class="chip">${esc(c)}</span>`).join('');
    return `<a class="song-card" href="#song/${encodeURIComponent(song.id)}">
      <div class="sc-top">${App.levelBadge(song.level)}${pr && pr.best ? App.starsHTML(App.starsFor(pr.best), `Best ${pr.best}%`) : ''}</div>
      <h3>${esc(song.title)}</h3>
      <p class="muted">${esc(song.artist || '')}</p>
      <div class="sc-chords">${tags}</div>
    </a>`;
  }

  // ===================================================================== HOME
  function homeView(main) {
    const nl = nextLesson();
    const recentIds = Object.entries(P().songs).sort((a, b) => (b[1].last || 0) - (a[1].last || 0)).slice(0, 3).map(([id]) => id);
    const recent = recentIds.map(App.findSong).filter(Boolean);
    const suggestions = recent.length ? recent : ['twinkle-chords', 'whole-world', 'mel-mary'].map(App.findSong);
    const week = App.weekSeries();
    const maxMin = Math.max(10, ...week.map((d) => d.min));
    const tunedToday = P().tuned === App.dayKey();
    const handDone = lessonDone('meet');
    main.innerHTML = `
    <section class="hero">
      <div class="hero-text">
        <p class="eyebrow">Your guitar coach</p>
        <h1>Learn guitar by playing&nbsp;it.</h1>
        <p class="lede">Pick a song. FretCoach shows where every finger goes, listens through your microphone, and tells you the moment you get it right.</p>
        <div class="row wrap">
          ${nl ? `<a class="btn primary big" href="#lesson/${nl.id}">${lessonDone('meet') ? 'Continue' : 'Start'}: ${esc(nl.title)}</a>` : '<a class="btn primary big" href="#songs">Pick a song</a>'}
          <a class="btn big" href="#songs">Browse songs</a>
        </div>
      </div>
      <div class="hero-try">
        <div class="try-head"><span class="eyebrow">Try it now</span><span class="muted">Strum any chord</span></div>
        <div class="try-name" id="tryName">${App.micOn() ? '…' : 'Em'}</div>
        <p class="try-sub" id="trySub">${App.micOn() ? 'I\'m listening. Strum something.' : 'Turn on the mic and strum. I\'ll name the chord I hear.'}</p>
        <div class="chroma small" id="tryChroma"></div>
        ${App.micBox(true)}
      </div>
    </section>

    <section class="setup" aria-label="Before you start">
      <a class="setup-item ${App.micOn() ? 'done' : ''}" href="#settings"><span class="si-n">1</span><div><b>Microphone</b><p>${App.micOn() ? 'On and listening' : 'Lets FretCoach hear you'}</p></div></a>
      <a class="setup-item ${tunedToday ? 'done' : ''}" href="#tuner"><span class="si-n">2</span><div><b>Tune your guitar</b><p>${tunedToday ? 'Tuned today' : 'Do this every session'}</p></div></a>
      <a class="setup-item ${handDone ? 'done' : ''}" href="#lesson/meet"><span class="si-n">3</span><div><b>Finger numbers</b><p>1 index · 2 middle · 3 ring · 4 pinky</p></div></a>
    </section>

    <section class="stats" aria-label="Your progress">
      <div class="stat"><span class="stat-n tnum">${App.streak()}</span><span class="stat-l">day streak</span></div>
      <div class="stat"><span class="stat-n tnum">${App.weekMinutes()}</span><span class="stat-l">minutes this week</span>
        <div class="spark" aria-hidden="true">${week.map((d) => `<i style="--h:${Math.max(4, (d.min / maxMin) * 100)}%" title="${d.min} min"></i>`).join('')}</div></div>
      <div class="stat"><span class="stat-n tnum">${App.chordsLearned().length}</span><span class="stat-l">chords learned</span></div>
      <div class="stat"><span class="stat-n tnum">${GT.LESSONS.filter((l) => lessonDone(l.id)).length}<small>/${GT.LESSONS.length}</small></span><span class="stat-l">lessons done</span></div>
    </section>

    <section>
      <div class="sec-head"><h2>${recent.length ? 'Pick up where you left off' : 'Good first songs'}</h2><a href="#songs">All songs</a></div>
      <div class="song-grid">${suggestions.filter(Boolean).map(songCard).join('')}</div>
    </section>`;

    const cw = App.chromaWidget($('#tryChroma', main));
    const namer = App.createLiveNamer();
    let lastName = null;
    const off = GT.audio.onFrame((f) => {
      const loud = f.level > f.gate && !f.ignored;
      cw.update(loud ? f.chroma : null);
      const name = namer(f);
      if (name && name !== lastName) {
        lastName = name;
        $('#tryName', main).textContent = name;
        const v = GT.voicing(name);
        $('#trySub', main).textContent = v ? `${GT.pcName(v.root)} ${v.qualityWord}` : '';
      }
    });
    const offMic = App.on('mic', () => route());
    return () => { off(); offMic(); };
  }

  // ==================================================================== LEARN
  function learnView(main) {
    const nl = nextLesson();
    main.innerHTML = `
    <div class="page-head"><div><h1>Learn</h1><p class="lede">${GT.LESSONS.length} short lessons, from holding the guitar to playing full songs. Each one takes 5 to 12 minutes.</p></div></div>
    <ol class="path">
      ${GT.LESSONS.map((l, i) => {
        const done = lessonDone(l.id);
        const isNext = nl && nl.id === l.id;
        const exCount = l.exercises.length;
        const exDoneN = l.exercises.filter((_, k) => exDone(l.id, k)).length;
        return `<li><a class="lesson-card ${done ? 'done' : ''} ${isNext ? 'next' : ''}" href="#lesson/${l.id}">
          <span class="lc-num tnum">${done ? '<svg viewBox="0 0 24 24" aria-label="done"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : i + 1}</span>
          <div class="lc-body"><h3>${esc(l.title)}</h3><p>${esc(l.summary)}</p></div>
          <div class="lc-meta"><span>${l.minutes} min</span>${exCount ? `<span class="tnum">${exDoneN}/${exCount} exercises</span>` : ''}${isNext ? '<span class="pill">Next up</span>' : ''}</div>
        </a></li>`;
      }).join('')}
    </ol>`;
  }

  function lessonView(main, id) {
    const idx = GT.LESSONS.findIndex((l) => l.id === id);
    const l = GT.LESSONS[idx];
    if (!l) { location.hash = '#learn'; return; }
    const nextL = GT.LESSONS[idx + 1];
    let aside = '';
    if (l.showHand) aside = `<div class="aside-card"><span class="eyebrow">Your fretting hand</span>${GT.draw.hand({ leftHanded: S.leftHanded })}<p class="muted">Palm facing you. The thumb (T) stays behind the neck.</p></div>`;
    else if (l.chord) {
      const v = GT.voicing(l.chord, { fullBarre: S.fullBarre });
      aside = `<div class="aside-card"><span class="eyebrow">${esc(l.chord)}</span>${GT.draw.chordBox(v, { leftHanded: S.leftHanded })}<button class="btn ghost small" data-act="hear-chord" data-chord="${esc(l.chord)}">Hear it</button></div>`;
    } else if (l.tuner) aside = `<div class="aside-card"><span class="eyebrow">Standard tuning</span><p class="tuning-big">E A D G B E</p><a class="btn primary" href="#tuner">Open the tuner</a></div>`;
    const songs = (l.songs || []).map(App.findSong).filter(Boolean);
    main.innerHTML = `
    <a class="back" href="#learn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>All lessons</a>
    <div class="lesson-head"><p class="eyebrow">Lesson ${idx + 1} of ${GT.LESSONS.length} · ${l.minutes} min</p><h1>${esc(l.title)}</h1><p class="lede">${esc(l.summary)}</p></div>
    <div class="lesson-grid">
      <div class="prose">${l.body}</div>
      <aside>${aside}</aside>
    </div>
    ${l.exercises.length ? `<h2>Exercises</h2><ol class="ex-list">${l.exercises.map((ex, i) => {
      const done = exDone(l.id, i);
      const href = ex.kind === 'song' ? `#song/${ex.song}?mode=${ex.mode || 'practice'}&lesson=${l.id}&ex=${i}` : `#exercise/${l.id}/${i}`;
      const what = ex.kind === 'chords' ? ex.chords.join(' → ') : ex.kind === 'melody' ? ex.melody.split(/\s+/).map((n) => n.split(':')[0].replace(/\d/, '')).join(' ') : 'Play along with the metronome';
      return `<li class="ex ${done ? 'done' : ''}"><span class="ex-tick" aria-label="${done ? 'Done' : 'Not done yet'}">${done ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : i + 1}</span>
        <div class="ex-body"><h3>${esc(ex.title)}</h3><p class="muted">${esc(what)}</p>${ex.tip ? `<p class="ex-tip">${esc(ex.tip)}</p>` : ''}</div>
        <a class="btn ${done ? '' : 'primary'}" href="${href}">${done ? 'Again' : 'Start'}</a></li>`;
    }).join('')}</ol>` : ''}
    ${songs.length ? `<h2>Songs to try</h2><div class="song-grid">${songs.map(songCard).join('')}</div>` : ''}
    <div class="lesson-foot">
      ${lessonDone(l.id) ? '<span class="pill ok">Lesson complete</span>' : `<button class="btn" data-act="mark-done">Mark lesson complete</button>`}
      ${nextL ? `<a class="btn primary" href="#lesson/${nextL.id}">Next: ${esc(nextL.title)}</a>` : '<a class="btn primary" href="#songs">On to the songs</a>'}
    </div>`;
    main.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'mark-done') { markLesson(l.id); App.toast('Lesson marked complete'); route(); }
      if (a.dataset.act === 'hear-chord') { const t = App.chordTarget(a.dataset.chord, 0); GT.audio.strum(t.notes, 0, 'D'); GT.audio.ignoreMic(1.8); }
    });
  }

  function exerciseView(main, arg) {
    const [lid, iStr] = arg.split('/');
    const l = GT.LESSONS.find((x) => x.id === lid);
    const i = +iStr;
    const ex = l && l.exercises[i];
    if (!ex) { location.hash = '#learn'; return; }
    const song = ex.kind === 'melody'
      ? { id: `ex-${lid}-${i}`, title: ex.title, artist: l.title, type: 'melody', melody: ex.melody, bpm: 66, beats: 4, temp: true }
      : { id: `ex-${lid}-${i}`, title: ex.title, artist: l.title, sheet: ex.chords.map((c) => `[${c}]`).join(' '), bpm: 60, beats: 4, strum: 'whole', temp: true };
    return App.playerView(main, song, {
      mode: 'practice', backHref: `#lesson/${lid}`, backLabel: l.title, lesson: { id: lid, index: i },
      onComplete: (r) => {
        if (r.unchecked) return;
        markExercise(lid, i);
        App.toast('Exercise complete');
      },
    });
  }

  // ==================================================================== SONGS
  let songFilter = 'all';
  let songQuery = '';
  function songsView(main) {
    main.innerHTML = `
    <div class="page-head"><div><h1>Songs</h1><p class="lede">Every song shows the chords, the finger positions and the strum. Add any song you like: search for it with AI, or paste chords from a chord website.</p></div>
      <a class="btn primary" href="#add">Add a song</a></div>
    <div class="filters">
      <div class="chips" role="radiogroup" aria-label="Filter songs">
        ${[['all', 'All'], ['songs', 'Songs'], ['melody', 'Melodies'], ['loop', 'Practice loops'], ['mine', 'My songs']].map(([k, t]) => `<button class="chip-btn" role="radio" aria-checked="${songFilter === k}" data-f="${k}">${t}</button>`).join('')}
      </div>
      <input type="search" id="songSearch" placeholder="Search songs or chords" value="${esc(songQuery)}" aria-label="Search songs">
    </div>
    <div id="songList"></div>`;
    function paint() {
      const q = songQuery.trim().toLowerCase();
      const list = App.allSongs().filter((s) => {
        if (songFilter === 'songs' && (s.type === 'melody' || s.group === 'loop' || s.custom)) return false;
        if (songFilter === 'melody' && s.type !== 'melody') return false;
        if (songFilter === 'loop' && s.group !== 'loop') return false;
        if (songFilter === 'mine' && !s.custom) return false;
        if (!q) return true;
        return (s.title + ' ' + (s.artist || '') + ' ' + GT.chordsInSong(s).join(' ')).toLowerCase().includes(q);
      });
      const groups = [1, 2, 3, 0].map((lv) => ({ lv, items: list.filter((s) => (s.level || 0) === lv) })).filter((g) => g.items.length);
      $('#songList', main).innerHTML = list.length ? groups.map((g) => `<h2 class="group-h">${g.lv ? App.LEVELS[g.lv] : 'Other'}</h2><div class="song-grid">${g.items.map(songCard).join('')}</div>`).join('')
        : `<div class="empty"><p>${songFilter === 'mine' && !q ? 'You haven\'t added any songs yet.' : 'No songs match that.'}</p><a class="btn primary" href="#add">Add a song</a></div>`;
    }
    paint();
    main.addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      songFilter = b.dataset.f;
      $$('[data-f]', main).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      paint();
    });
    $('#songSearch', main).addEventListener('input', (e) => { songQuery = e.target.value; paint(); });
  }

  function songView(main, arg, query) {
    const song = App.findSong(arg);
    if (!song) { location.hash = '#songs'; return; }
    const lesson = query.get('lesson');
    const exi = query.get('ex');
    const opts = { mode: query.get('mode') || 'practice' };
    if (lesson) {
      const l = GT.LESSONS.find((x) => x.id === lesson);
      Object.assign(opts, {
        backHref: `#lesson/${lesson}`, backLabel: l ? l.title : 'Lesson', lesson: { id: lesson, index: +exi },
        onComplete: (r) => { if (r.acc >= 50 || r.mode === 'practice') { markExercise(lesson, +exi); App.toast('Exercise complete'); } },
      });
    }
    const cleanup = App.playerView(main, song, opts);
    if (song.custom) {
      const t = $('.p-titles', main);
      const id = encodeURIComponent(song.id);
      const tag = song.ai ? `<span class="ai-tag" title="${esc(song.ai.notes || '')}">AI chords · ${esc(song.ai.confidence || 'medium')} confidence</span>` : '';
      if (t) t.insertAdjacentHTML('beforeend', `<p class="edit-links"><a class="edit-link" href="#edit/${id}">Edit song</a>${song.ai ? '' : ` · <a class="edit-link" href="#edit/${id}?ai=1">Doesn't sound right? Find the real chords with AI</a>`}${tag}</p>`);
    }
    return cleanup;
  }

  // ================================================================= ADD SONG
  const EXAMPLE = `{title: Morning Walk}
[Verse]
G              D
Woke up early, sun was in my eyes
Em             C
Coffee on the stove and clear blue skies

[Chorus]
G        D          Em       C
Walk with me, walk with me, down the road
G        D          C        G
Walk with me, we'll carry the load`;

  function addView(main, editId, query) {
    const editing = editId ? store.custom.find((s) => s.id === editId) : null;
    if (editId && !editing) { location.hash = '#songs'; return; }
    const st = {
      tab: editing && editing.input === 'prog' ? 'prog' : 'paste',
      title: editing ? editing.title : '', artist: editing ? editing.artist || '' : '',
      beats: editing ? editing.beats : 4, bpm: editing ? editing.bpm : 80, capo: editing ? editing.capo || 0 : 0,
      strum: editing ? editing.strum : 'basic', raw: editing ? editing.raw || editing.sheet : '', prog: editing ? editing.prog || '' : '',
      ai: editing ? editing.ai || null : null,
    };
    const aiPrefill = editing ? `${editing.title}${editing.artist && editing.artist !== 'My song' ? ', ' + editing.artist : ''}` : '';
    main.innerHTML = `
    <a class="back" href="#songs"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Songs</a>
    <div class="page-head"><div><h1>${editing ? 'Edit song' : 'Add your own song'}</h1>
      <p class="lede">Search for any song and let AI find its chords, or paste chords from a chord website yourself.</p></div></div>
    <section class="card ai-find" aria-labelledby="aiTitle">
      <div class="ai-intro">
        <span class="ai-mark" aria-hidden="true">AI</span>
        <div><h2 id="aiTitle">${editing ? 'Find the real chords' : "Find a song's chords"}</h2>
        <p class="muted">Type the song and the artist. AI searches chord sites and guitar lessons, then gives you the chords in the right key, with the capo, the tempo and how long each chord lasts.</p></div>
      </div>
      <form class="ai-form" id="aiForm"><input id="aiQuery" type="search" autocomplete="off" placeholder="e.g. Let It Be, The Beatles" aria-label="Song name and artist" value="${esc(aiPrefill)}"><button class="btn primary" id="aiGo" type="submit">Find chords</button></form>
      <div id="aiOut" aria-live="polite"></div>
    </section>
    <p class="or-line"><span>or paste the chords yourself</span></p>
    <div class="add-grid">
      <form id="addForm" class="card form" novalidate>
        <div class="field-row">
          <label class="field grow2"><span>Song title</span><input id="fTitle" required value="${esc(st.title)}" placeholder="e.g. Morning Walk"></label>
          <label class="field grow2"><span>Artist</span><input id="fArtist" value="${esc(st.artist)}" placeholder="Optional"></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Time</span><select id="fBeats"><option value="4" ${st.beats === 4 ? 'selected' : ''}>4/4</option><option value="3" ${st.beats === 3 ? 'selected' : ''}>3/4 (waltz)</option></select></label>
          <label class="field"><span>Tempo (bpm)</span><input id="fBpm" type="number" min="40" max="220" value="${st.bpm}"></label>
          <label class="field"><span>Capo</span><input id="fCapo" type="number" min="0" max="9" value="${st.capo}"></label>
          <label class="field grow2"><span>Strum pattern</span><select id="fStrum"></select></label>
        </div>
        <div class="tabs" role="tablist">
          <button type="button" role="tab" data-tab="paste" aria-selected="${st.tab === 'paste'}">Paste a chord sheet</button>
          <button type="button" role="tab" data-tab="prog" aria-selected="${st.tab === 'prog'}">Just the chords</button>
        </div>
        <div data-pane="paste" ${st.tab === 'paste' ? '' : 'hidden'}>
          <label class="field"><span class="sr">Chord sheet</span><textarea id="fRaw" rows="14" spellcheck="false" placeholder="Paste chords and lyrics here…">${esc(st.raw)}</textarea></label>
          <p class="hint">Each chord lasts one bar unless you write a length, like <code>[G:2]</code> for two beats. <button type="button" class="linkish" data-act="example">Load an example</button></p>
        </div>
        <div data-pane="prog" ${st.tab === 'prog' ? '' : 'hidden'}>
          <label class="field"><span>Chords, one per bar</span><textarea id="fProg" rows="5" spellcheck="false" placeholder="G D Em C&#10;G D C G">${esc(st.prog)}</textarea></label>
          <p class="hint">Use <code>|</code> to put two chords in one bar: <code>G | D | Em C | C</code></p>
        </div>
        <p class="form-error" id="fErr" role="alert"></p>
        <div class="row wrap">
          <button class="btn primary" type="submit">${editing ? 'Save changes' : 'Save and practise'}</button>
          ${editing ? '<button class="btn danger" type="button" data-act="delete">Delete song</button><span id="delConfirm"></span>' : ''}
        </div>
      </form>
      <aside class="card preview">
        <div class="sec-head"><h2>Preview</h2><span class="muted" id="pvCount"></span></div>
        <div id="pvChords"></div>
        <div class="sheet small" id="pvSheet"></div>
      </aside>
    </div>`;

    const fStrum = $('#fStrum', main);
    function fillStrums() {
      const b = +$('#fBeats', main).value;
      fStrum.innerHTML = (GT.STRUMS[b] || GT.STRUMS[4]).map((p) => `<option value="${p.id}" ${p.id === st.strum ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    }
    fillStrums();

    function currentSheet() {
      if (st.tab === 'prog') return { sheet: GT.progressionToSheet($('#fProg', main).value, +$('#fBeats', main).value), meta: {}, unknown: [] };
      return GT.parsePasted($('#fRaw', main).value);
    }

    function preview() {
      const parsed = currentSheet();
      const song = { sheet: parsed.sheet, beats: +$('#fBeats', main).value };
      const C = GT.compileSong(song);
      const names = GT.chordsInSong(song);
      $('#pvCount', main).textContent = C.steps.length ? `${C.steps.length} chord changes` : '';
      const unknown = parsed.unknown || [];
      const capo = +$('#fCapo', main).value || parsed.meta.capo || 0;
      const ez = names.length ? GT.easierKey(names, capo, 0) : null;
      $('#pvChords', main).innerHTML = names.length ? `
        <div class="pv-chords">${names.map((n) => { const v = GT.voicing(n); return `<span class="chip d${v ? v.difficulty : 3}" title="${v ? ['', 'Easy', 'Medium', 'Hard (barre)'][v.difficulty] : 'Unknown'}">${esc(n)}</span>`; }).join('')}</div>
        ${unknown.length ? `<p class="warn">I don't recognise: ${unknown.map(esc).join(', ')}. They will be skipped.</p>` : ''}
        ${parsed.meta.capo && !+$('#fCapo', main).value ? `<p class="hint">The sheet says capo ${parsed.meta.capo}. I'll use that.</p>` : ''}
        ${ez && ez.best && ez.current && ez.best.cost < ez.current.cost - 0.3 ? `<p class="hint">Tip: with <b>capo ${ez.best.capo}</b> you could play easier shapes (${ez.best.names.map(esc).join(' ')}). Use "Make it easier" in the player.</p>` : ''}`
        : '<p class="muted">Chords you paste will show up here.</p>';
      $('#pvSheet', main).innerHTML = C.lines.slice(0, 40).map((ln) => {
        if (ln.type === 'gap') return '<div class="sgap"></div>';
        if (ln.type === 'section') return `<div class="ssection">${esc(ln.text)}</div>`;
        return `<div class="sline">${ln.segs.map((sg) => `<span class="seg plain"><b class="ch">${sg.chord ? esc(sg.chord) : '&nbsp;'}</b><span class="ly">${esc(sg.lyric || '') || '&nbsp;'}</span></span>`).join('')}</div>`;
      }).join('');
      if (parsed.meta.title && !$('#fTitle', main).value) $('#fTitle', main).value = parsed.meta.title;
      if (parsed.meta.artist && !$('#fArtist', main).value) $('#fArtist', main).value = parsed.meta.artist;
      if (parsed.meta.bpm && !editing) $('#fBpm', main).value = parsed.meta.bpm;
      return { parsed, names, C, capo };
    }

    main.addEventListener('input', (e) => { if (e.target.matches('textarea, #fCapo, #fBeats')) preview(); });
    $('#fBeats', main).addEventListener('change', () => { fillStrums(); preview(); });
    main.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) {
        st.tab = t.dataset.tab;
        $$('[data-tab]', main).forEach((x) => x.setAttribute('aria-selected', String(x === t)));
        $$('[data-pane]', main).forEach((p) => { p.hidden = p.dataset.pane !== st.tab; });
        preview();
        return;
      }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'example') { $('#fRaw', main).value = EXAMPLE; $('#fTitle', main).value = ''; preview(); }
      if (a.dataset.act === 'delete') {
        $('#delConfirm', main).innerHTML = 'Delete for good? <button type="button" class="btn danger small" data-act="delete-yes">Yes, delete</button> <button type="button" class="btn small" data-act="delete-no">Keep it</button>';
      }
      if (a.dataset.act === 'delete-no') $('#delConfirm', main).innerHTML = '';
      if (a.dataset.act === 'delete-yes') {
        store.custom = store.custom.filter((s) => s.id !== editing.id);
        delete P().songs[editing.id];
        App.save();
        App.toast('Song deleted');
        location.hash = '#songs';
      }
    });
    $('#addForm', main).addEventListener('submit', (e) => {
      e.preventDefault();
      const { parsed, names, C, capo } = preview();
      const title = $('#fTitle', main).value.trim();
      const err = $('#fErr', main);
      if (!title) { err.textContent = 'Give the song a title.'; $('#fTitle', main).focus(); return; }
      if (!C.steps.length) { err.textContent = 'I couldn\'t find any chords. Paste a chord sheet, or switch to "Just the chords" and type them.'; return; }
      err.textContent = '';
      const maxDiff = Math.max(...names.map((n) => (GT.voicing(n) || { difficulty: 3 }).difficulty));
      const song = {
        id: editing ? editing.id : 'my-' + Date.now().toString(36), custom: true,
        title, artist: $('#fArtist', main).value.trim() || 'My song', level: maxDiff,
        bpm: Math.max(40, Math.min(220, +$('#fBpm', main).value || 80)), beats: +$('#fBeats', main).value,
        capo, strum: fStrum.value, sheet: parsed.sheet, input: st.tab,
        raw: st.tab === 'paste' ? $('#fRaw', main).value : '', prog: st.tab === 'prog' ? $('#fProg', main).value : '',
      };
      if (st.ai) song.ai = st.ai;
      if (editing) store.custom = store.custom.map((s) => (s.id === editing.id ? song : s));
      else store.custom.push(song);
      App.save();
      App.toast(editing ? 'Saved' : 'Song added');
      location.hash = '#song/' + encodeURIComponent(song.id);
    });
    preview();

    // ------------------------------------------------------------- AI song finder
    const ai = { ctrl: null, timer: 0, status: null, song: null, query: '', autostarted: false };
    const aiOut = $('#aiOut', main);

    function paintAiStatus() {
      const s = ai.status;
      if (!s || ai.ctrl || ai.song) return;
      if (s.offline) {
        aiOut.innerHTML = '<div class="ai-setup"><p>AI search needs FretCoach\'s own little server. Close this tab and start FretCoach with <code>./start.sh</code>.</p></div>';
      } else if (!s.installed) {
        aiOut.innerHTML = '<div class="ai-setup"><p>AI search isn\'t installed yet. Stop FretCoach and run <code>./start.sh</code> again while you\'re online. It installs AI search the first time.</p></div>';
      } else if (!s.ai) {
        aiOut.innerHTML = `<div class="ai-setup"><p><b>One-time setup:</b> AI search uses your own Claude API key.</p>
          <ol><li>Create a key at <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener">platform.claude.com</a> (API keys).</li>
          <li>In the FretCoach folder, make a file named <code>.env</code> with this line:<br><code>ANTHROPIC_API_KEY=paste-your-key-here</code></li>
          <li>Stop FretCoach (Ctrl+C) and run <code>./start.sh</code> again.</li></ol>
          <p class="muted">Each search uses a little API credit.</p></div>`;
      } else {
        aiOut.innerHTML = '<p class="hint">A search takes about a minute and uses a little Claude API credit.</p>';
        if (query && query.get('ai') === '1' && !ai.autostarted && $('#aiQuery', main).value.trim()) {
          ai.autostarted = true;
          runSearch($('#aiQuery', main).value.trim());
        }
      }
    }

    fetch('/api/status').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((s) => { ai.status = s; }, () => { ai.status = { offline: true }; })
      .then(paintAiStatus);

    function showAiError(message) {
      aiOut.innerHTML = `<p class="ai-error" role="alert">${esc(message)}</p>`;
    }

    async function runSearch(q) {
      if (ai.status && (ai.status.offline || !ai.status.ai)) { paintAiStatus(); return; }
      if (ai.ctrl) ai.ctrl.abort();
      const ctrl = new AbortController();
      ai.ctrl = ctrl;
      ai.song = null;
      ai.query = q;
      const t0 = Date.now();
      aiOut.innerHTML = `<div class="ai-progress"><div class="ai-prog-head"><span class="pulse" aria-hidden="true"></span><b>Finding the chords for "${esc(q)}"</b><span class="muted tnum" id="aiTime">0 s</span><button type="button" class="btn small ghost" data-act="ai-cancel">Cancel</button></div>
        <ol class="ai-steps" id="aiSteps"></ol><p class="hint">This usually takes 30–90 seconds.</p></div>`;
      clearInterval(ai.timer);
      ai.timer = setInterval(() => { const el = $('#aiTime', main); if (el) el.textContent = `${Math.round((Date.now() - t0) / 1000)} s`; }, 500);
      $('#aiGo', main).disabled = true;
      let finished = false;
      try {
        const res = await fetch('/api/find-song', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }), signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const msg = JSON.parse(line);
            if (msg.type === 'status') {
              const ol = $('#aiSteps', main);
              if (ol) ol.insertAdjacentHTML('beforeend', `<li>${esc(msg.text)}</li>`);
            } else if (msg.type === 'error') { finished = true; showAiError(msg.message); }
            else if (msg.type === 'song') { finished = true; showAiSong(msg.song); }
          }
        }
        if (!finished) showAiError('The search stopped before it finished. Try again.');
      } catch (err) {
        if (ctrl.signal.aborted) aiOut.innerHTML = '<p class="muted">Search cancelled.</p>';
        else showAiError("Couldn't reach FretCoach's server. Is ./start.sh still running?");
      } finally {
        clearInterval(ai.timer);
        if (ai.ctrl === ctrl) ai.ctrl = null;
        const b = $('#aiGo', main);
        if (b) b.disabled = false;
      }
    }

    function showAiSong(song) {
      if (!song.found) {
        aiOut.innerHTML = `<div class="ai-result"><h3>I couldn't find chords for that song</h3>${song.notes ? `<p>${esc(song.notes)}</p>` : ''}<p class="hint">Try the exact title plus the artist's name.</p></div>`;
        return;
      }
      ai.song = song;
      const sheet = GT.aiSongToSheet(song);
      const C = GT.compileSong({ sheet, beats: song.beats_per_bar });
      const names = GT.chordsInSong({ sheet });
      const minutes = C.totalBeats / song.bpm;
      const strumName = (GT.strumFor(song.beats_per_bar, song.strum) || {}).name || song.strum;
      const fmtBeats = (b) => (b === song.beats_per_bar ? '' : `<sup>${+b.toFixed(2)}</sup>`);
      aiOut.innerHTML = `<div class="ai-result">
        <div class="ai-res-head"><div><h3>${esc(song.title)}</h3><p class="muted">${esc(song.artist)}</p></div>
          <span class="conf ${esc(song.confidence)}">${esc(song.confidence)} confidence</span></div>
        <div class="ai-facts"><span>Key <b>${esc(song.key || '?')}</b></span><span>Capo <b>${song.capo || 'none'}</b></span><span><b>${song.bpm}</b> bpm</span><span><b>${song.beats_per_bar}/4</b></span><span>Strum <b>${esc(strumName)}</b></span><span><b>${C.steps.length}</b> chord changes · about ${Math.max(1, Math.round(minutes))} min</span></div>
        <div class="pv-chords">${names.map((n) => { const v = GT.voicing(n); return `<span class="chip d${v ? v.difficulty : 3}">${esc(n)}</span>`; }).join('')}</div>
        ${song.notes ? `<p class="ai-notes">${esc(song.notes)}</p>` : ''}
        <div class="ai-sections">${song.sections.map((sec) => `<div class="ai-sec"><b>${esc(sec.name)}${sec.repeat > 1 ? ` ×${sec.repeat}` : ''}</b><span class="chips">${sec.chords.map((c) => `<span class="chip">${esc(c.chord)}${fmtBeats(c.beats)}</span>`).join('')}</span></div>`).join('')}</div>
        <p class="hint">Small numbers are beats; chords without one last a full bar. Lyrics aren't included, for copyright reasons.</p>
        ${song.sources.length ? `<p class="ai-sources">Based on: ${song.sources.map((u) => { let h = u; try { h = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { /* keep url */ } return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(h)}</a>`; }).join(' ')}</p>` : ''}
        <div class="row wrap"><button type="button" class="btn primary" data-act="ai-save">${editing ? 'Replace the chords and save' : 'Save and practise'}</button><button type="button" class="btn" data-act="ai-use">Check it before saving</button></div>
      </div>`;
    }

    function applyAiSong() {
      const song = ai.song;
      if (!song) return;
      $('#fTitle', main).value = song.title || ai.query;
      $('#fArtist', main).value = song.artist || '';
      $('#fBeats', main).value = String(song.beats_per_bar);
      st.strum = song.strum;
      fillStrums();
      $('#fBpm', main).value = song.bpm;
      $('#fCapo', main).value = song.capo;
      st.tab = 'paste';
      $$('[data-tab]', main).forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === 'paste')));
      $$('[data-pane]', main).forEach((p) => { p.hidden = p.dataset.pane !== 'paste'; });
      $('#fRaw', main).value = GT.aiSongToSheet(song);
      st.ai = { query: ai.query, key: song.key, confidence: song.confidence, notes: song.notes, sources: song.sources };
      preview();
    }

    $('#aiForm', main).addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#aiQuery', main).value.trim();
      if (q.length < 2) { $('#aiQuery', main).focus(); return; }
      runSearch(q);
    });
    main.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'ai-cancel' && ai.ctrl) ai.ctrl.abort();
      if (a.dataset.act === 'ai-use') {
        applyAiSong();
        $('#addForm', main).scrollIntoView({ behavior: 'smooth', block: 'start' });
        App.toast('Chords filled in below. Check them, then save.');
      }
      if (a.dataset.act === 'ai-save') {
        applyAiSong();
        $('#addForm', main).requestSubmit();
      }
    });

    return () => { if (ai.ctrl) ai.ctrl.abort(); clearInterval(ai.timer); };
  }

  // =================================================================== CHORDS
  const CHORD_GROUPS = [
    { title: 'Start here', note: 'The eight open chords that most songs are built from.', chords: ['Em', 'Am', 'E', 'A', 'D', 'G', 'C', 'Dm'] },
    { title: '7th chords', note: 'Bluesy, and often easier than the plain chord.', chords: ['E7', 'A7', 'D7', 'G7', 'C7', 'B7'] },
    { title: 'Colour chords', note: 'maj7, m7, sus and add9: softer, dreamier versions of the basics.', chords: ['Cmaj7', 'Fmaj7', 'Dmaj7', 'Amaj7', 'Am7', 'Em7', 'Dm7', 'Bm7', 'Asus2', 'Asus4', 'Dsus2', 'Dsus4', 'Esus4', 'Cadd9', 'Gsus4', 'G6'] },
    { title: 'F and barre chords', note: 'Harder. Come back once the open chords feel easy.', chords: ['F', 'Bm', 'F#m', 'Bb', 'B', 'C#m', 'Gm', 'Cm', 'Fm'] },
    { title: 'Power chords', note: 'Two or three strings, used everywhere in rock.', chords: ['E5', 'A5', 'D5', 'G5', 'C5'] },
  ];

  function chordsView(main, name) {
    const sel = name ? decodeURIComponent(name) : '';
    main.innerHTML = `
    <div class="page-head"><div><h1>Chords</h1><p class="lede">Tap a chord to see where each finger goes, hear it, and check it with the mic.</p></div>
      <form class="chord-search" id="chordSearch"><input id="chordQ" placeholder="Any chord, e.g. F#m7" aria-label="Look up a chord" value="${esc(sel)}"><button class="btn">Show</button></form></div>
    <div id="chordDetail"></div>
    ${CHORD_GROUPS.map((g) => `<section class="chord-group"><div class="sec-head"><h2>${g.title}</h2><span class="muted">${g.note}</span></div>
      <div class="chord-grid">${g.chords.map((c) => {
        const v = GT.voicing(c, { fullBarre: S.fullBarre });
        const learned = (P().chords[c] || 0) >= 3;
        return v ? `<a class="chord-card ${c === sel ? 'sel' : ''}" href="#chords/${encodeURIComponent(c)}"><span class="cc-name">${esc(c)}${learned ? ' <svg class="learned" viewBox="0 0 24 24" aria-label="learned"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</span>${GT.draw.chordBox(v, { leftHanded: S.leftHanded })}</a>` : '';
      }).join('')}</div></section>`).join('')}`;
    $('#chordSearch', main).addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#chordQ', main).value.trim();
      if (q) location.hash = '#chords/' + encodeURIComponent(q);
    });
    if (!sel) return;
    const v = GT.voicing(sel, { fullBarre: S.fullBarre });
    const det = $('#chordDetail', main);
    if (!v) { det.innerHTML = `<div class="card warn-card">"${esc(sel)}" isn't a chord I know. Try names like C, Am, G7, Dsus4 or F#m.</div>`; return; }
    const tgt = App.chordTarget(sel, 0);
    const win = GT.draw.windowFor(v.frets);
    const notes = [...new Set(v.pcs)].map((p) => GT.pcName(p, v.flat)).join(' · ');
    det.innerHTML = `<section class="card chord-detail">
      <div class="cd-head"><div><h2 class="cd-name">${esc(sel)}</h2><p class="muted">${GT.pcName(v.root, v.flat)} ${v.qualityWord} · notes ${notes}${v.simplified ? ' · simplified shape' : ''}</p></div>
        <div class="row wrap"><button class="btn" data-act="hear">Hear it</button><a class="btn primary" href="#exercise-chord/${encodeURIComponent(sel)}">Practise it</a>${v.hasAlt ? `<button class="btn ghost" data-act="alt">${S.fullBarre ? 'Show easy version' : 'Show full barre'}</button>` : ''}<a class="btn ghost" href="#chords" aria-label="Close">Close</a></div></div>
      <div class="cd-grid">
        <div class="fb-wrap">${GT.draw.fretboard(App.fbOpts({ frets: v.frets, fingers: v.fingers, from: win.from, to: win.to }))}</div>
        <ol class="howto">${App.chordStepsHTML(v)}</ol>
        <div class="cd-check">
          <span class="eyebrow">Check it</span>
          <div class="status" id="cdStatus"></div>
          <div class="chroma" id="cdChroma"></div>
        </div>
      </div></section>`;
    const cw = App.chromaWidget($('#cdChroma', main));
    cw.setExpected(tgt.pcs);
    const status = $('#cdStatus', main);
    let streakN = 0;
    function idle() {
      status.dataset.kind = App.micOn() ? 'listen' : 'idle';
      status.innerHTML = App.micOn() ? `<div class="st-icon"><span class="pulse"></span></div><div class="st-text"><p class="st-title">Strum ${esc(sel)}</p><p class="st-detail">${streakN ? `${streakN} in a row` : 'I\'ll tell you if it\'s right.'}</p></div>` : App.micBox(true);
    }
    idle();
    const judge = App.createJudge({
      target: () => tgt,
      onResult: (ok, info) => {
        if (ok) {
          streakN++;
          App.recordChordHit(sel);
          status.dataset.kind = 'ok';
          status.innerHTML = `<div class="st-icon"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><div class="st-text"><p class="st-title">That's ${esc(sel)}!</p><p class="st-detail">${streakN} in a row${streakN >= 3 ? '. You\'ve got this one.' : ''}</p></div>`;
        } else {
          streakN = 0;
          const ex = App.explainChord(info);
          status.dataset.kind = 'bad';
          status.innerHTML = `<div class="st-icon"><svg viewBox="0 0 24 24"><path d="M12 7v6m0 4v.01"/></svg></div><div class="st-text"><p class="st-title">${esc(ex.headline)}</p><p class="st-detail">${ex.tips.map(esc).join('<br>')}</p></div>`;
        }
      },
    });
    const off = GT.audio.onFrame((f) => { judge.handle(f); cw.update(f.level > f.gate && !f.ignored ? f.chroma : null); });
    const offMic = App.on('mic', idle);
    det.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'hear') { GT.audio.strum(tgt.notes, 0, 'D'); GT.audio.ignoreMic(1.8); judge.reset(); }
      if (a.dataset.act === 'alt') { S.fullBarre = !S.fullBarre; App.save(); route(); }
    });
    det.scrollIntoView({ block: 'start' });
    return () => { off(); offMic(); };
  }

  function chordExerciseView(main, name) {
    const c = decodeURIComponent(name);
    if (!GT.voicing(c)) { location.hash = '#chords'; return; }
    const song = { id: 'chord-' + c, title: `Practise ${c}`, artist: 'Chord drill', sheet: Array(6).fill(`[${c}]`).join(' '), bpm: 60, beats: 4, strum: 'whole', temp: true };
    return App.playerView(main, song, { mode: 'practice', backHref: '#chords/' + encodeURIComponent(c), backLabel: 'Chords' });
  }

  // ==================================================================== TUNER
  function tunerView(main) {
    const ticks = [];
    for (let c = -50; c <= 50; c += 10) {
      const a = (c / 50) * 60 * Math.PI / 180;
      const r1 = 128, r2 = c % 50 === 0 ? 108 : c === 0 ? 104 : 116;
      ticks.push(`<line x1="${160 + Math.sin(a) * r1}" y1="${170 - Math.cos(a) * r1}" x2="${160 + Math.sin(a) * r2}" y2="${170 - Math.cos(a) * r2}" class="tick ${c === 0 ? 'zero' : ''}"/>`);
    }
    const arc = (deg) => { const a = deg * Math.PI / 180; return `${160 + Math.sin(a) * 140} ${170 - Math.cos(a) * 140}`; };
    main.innerHTML = `
    <div class="page-head"><div><h1>Tuner</h1><p class="lede">Standard tuning: E A D G B E. Pluck one string and let it ring.</p></div></div>
    ${App.micBox()}
    <div class="tuner card">
      <svg class="gauge" viewBox="0 0 320 200" role="img" aria-label="Tuning gauge">
        <path d="M ${arc(-60)} A 140 140 0 0 1 ${arc(60)}" class="g-arc"/>
        <path d="M ${arc(-6)} A 140 140 0 0 1 ${arc(6)}" class="g-zone"/>
        ${ticks.join('')}
        <text x="${160 + Math.sin(-1.05) * 96}" y="${170 - Math.cos(-1.05) * 96}" class="g-lbl" text-anchor="middle">flat</text>
        <text x="${160 + Math.sin(1.05) * 96}" y="${170 - Math.cos(1.05) * 96}" class="g-lbl" text-anchor="middle">sharp</text>
        <g id="needle" class="needle"><line x1="160" y1="170" x2="160" y2="42"/><circle cx="160" cy="170" r="9"/></g>
      </svg>
      <div class="t-readout"><span class="t-note" id="tNote">–</span><span class="t-cents tnum" id="tCents"></span></div>
      <p class="t-hint" id="tHint">${App.micOn() ? 'Pluck a string.' : 'Turn on the microphone to start.'}</p>
      <p class="t-freq tnum muted" id="tFreq"></p>
    </div>
    <div class="t-strings" role="group" aria-label="Strings">
      <button class="t-str auto" data-s="auto" aria-pressed="true">Auto</button>
      ${GT.TUNING.map((m, s) => `<button class="t-str" data-s="${s}" aria-pressed="false" title="Play the reference ${GT.midiName(m, true)}"><b>${GT.STRING_NAMES[s]}</b><span>${6 - s}</span><i class="ok-mark" aria-hidden="true"></i></button>`).join('')}
    </div>
    <p class="muted center">Tap a string to hear its reference note and lock the tuner to it.</p>`;
    let manual = -1;
    const hist = [];
    const tuned = new Set();
    let inTuneSince = 0;
    const needle = $('#needle', main);
    let lastHeard = 0;
    const off = GT.audio.onFrame((f) => {
      if (f.ignored) return;
      const now = performance.now();
      if (!(f.pitch && f.pitch.clarity >= 0.9 && f.level > f.gate * 0.8 && f.pitch.freq < 1000)) {
        if (now - lastHeard > 1500) { needle.style.transform = 'rotate(0deg)'; needle.classList.remove('good'); }
        return;
      }
      lastHeard = now;
      hist.push(f.pitch.midi);
      if (hist.length > 7) hist.shift();
      const sorted = hist.slice().sort((a, b) => a - b);
      const m = sorted[sorted.length >> 1];
      let s = manual;
      if (s < 0) {
        let best = 0;
        GT.TUNING.forEach((t, i) => { if (Math.abs(m - t) < Math.abs(m - GT.TUNING[best])) best = i; });
        s = best;
      }
      const target = GT.TUNING[s];
      const cents = (m - target) * 100;
      const shown = Math.max(-50, Math.min(50, cents));
      needle.style.transform = `rotate(${(shown / 50) * 60}deg)`;
      const good = Math.abs(cents) <= 5;
      needle.classList.toggle('good', good);
      $('#tNote', main).textContent = GT.midiName(m);
      $('#tCents', main).textContent = `${cents > 0 ? '+' : ''}${Math.round(cents)} cents`;
      $('#tFreq', main).textContent = `${f.pitch.freq.toFixed(1)} Hz · string ${6 - s} (${GT.STRING_NAMES[s]}) target ${GT.midiToFreq(target).toFixed(1)} Hz`;
      const hint = $('#tHint', main);
      if (Math.abs(cents) > 150) hint.innerHTML = cents < 0 ? `Much too low. <b>Tighten</b> string ${6 - s} (turn the peg to raise the pitch).` : `Much too high. <b>Loosen</b> string ${6 - s}.`;
      else if (good) hint.innerHTML = `<b class="ok">In tune.</b> String ${6 - s} (${GT.STRING_NAMES[s]}) is ready.`;
      else hint.innerHTML = cents < 0 ? `A little low: <b>tighten</b> string ${6 - s} slowly.` : `A little high: <b>loosen</b> string ${6 - s} slowly.`;
      $$('.t-str[data-s]', main).forEach((b) => b.classList.toggle('active', b.dataset.s === String(s)));
      if (good) {
        if (!inTuneSince) inTuneSince = now;
        if (now - inTuneSince > 600 && !tuned.has(s)) {
          tuned.add(s);
          $(`.t-str[data-s="${s}"]`, main).classList.add('tuned');
          if (tuned.size === 6) {
            P().tuned = App.dayKey();
            markLesson('tune');
            App.toast('All six strings are in tune');
          }
        }
      } else inTuneSince = 0;
    });
    main.addEventListener('click', (e) => {
      const b = e.target.closest('.t-str');
      if (!b) return;
      $$('.t-str', main).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (b.dataset.s === 'auto') { manual = -1; return; }
      manual = +b.dataset.s;
      hist.length = 0;
      GT.audio.ensureContext();
      GT.audio.pluck(GT.TUNING[manual], 0, 0.6, 2.2);
      GT.audio.ignoreMic(2.3);
    });
    const offMic = App.on('mic', () => route());
    return () => { off(); offMic(); };
  }

  // =================================================================== DRILLS
  function drillsView(main) {
    const ch = P().drills.changes;
    const bestPair = Object.entries(ch).map(([k, arr]) => [k, Math.max(...arr)]).sort((a, b) => b[1] - a[1])[0];
    main.innerHTML = `
    <div class="page-head"><div><h1>Drills</h1><p class="lede">Short, focused games. A few minutes a day builds the speed that songs need.</p></div></div>
    <div class="drill-grid">
      <a class="drill-card" href="#drill/changes">
        <span class="eyebrow">60 seconds</span><h2>One-minute changes</h2>
        <p>Switch between two chords as many times as you can. I count every clean change. The fastest way to get smooth.</p>
        <p class="muted">${bestPair ? `Best: ${bestPair[1]} changes (${bestPair[0].replace('|', ' ↔ ')})` : 'No score yet'}</p>
      </a>
      <a class="drill-card" href="#drill/notes">
        <span class="eyebrow">60 seconds</span><h2>Note finder</h2>
        <p>I name a note and a string, you find it and play it. Learn the fretboard one string at a time.</p>
        <p class="muted">${P().drills.notes.best ? `Best: ${P().drills.notes.best} notes` : 'No score yet'}</p>
      </a>
    </div>`;
  }

  function changesDrill(main) {
    const list = ['Em', 'Am', 'E', 'A', 'D', 'G', 'C', 'Dm', 'E7', 'A7', 'D7', 'G7', 'B7', 'F', 'Cmaj7', 'Fmaj7', 'Asus2', 'Dsus2', 'Bm'];
    let a = 'Em', b = 'Am';
    const ds = { running: false, left: 60, count: 0, target: 0, timer: 0, t0: 0 };
    main.innerHTML = `
    <a class="back" href="#drills"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Drills</a>
    <div class="page-head"><div><h1>One-minute changes</h1><p class="lede">Strum the highlighted chord. As soon as I hear it, switch to the other one.</p></div></div>
    ${App.micBox()}
    <div class="card drill">
      <div class="drill-pick">
        <label class="field"><span>First chord</span><select id="dA">${list.map((c) => `<option ${c === a ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <span class="swap" aria-hidden="true">↔</span>
        <label class="field"><span>Second chord</span><select id="dB">${list.map((c) => `<option ${c === b ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <button class="btn primary big" id="dGo">Start</button>
      </div>
      <div class="drill-stage">
        <div class="drill-chord" id="dCardA"></div>
        <div class="drill-mid"><span class="drill-time tnum" id="dTime">60</span><span class="muted">seconds</span><span class="drill-count tnum" id="dCount">0</span><span class="muted">changes</span></div>
        <div class="drill-chord" id="dCardB"></div>
      </div>
      <div class="status" id="dStatus"></div>
      <div id="dHistory"></div>
    </div>`;
    const key = () => `${a}|${b}`;
    function cards() {
      [['#dCardA', a, 0], ['#dCardB', b, 1]].forEach(([sel, c, k]) => {
        const v = GT.voicing(c, { fullBarre: S.fullBarre });
        const box = $(sel, main);
        box.innerHTML = `<b>${esc(c)}</b>${GT.draw.chordBox(v, { leftHanded: S.leftHanded })}`;
        box.classList.toggle('on', ds.running && ds.target === k);
      });
      const hist = P().drills.changes[key()] || [];
      $('#dHistory', main).innerHTML = hist.length ? `<div class="hist"><span class="eyebrow">Your last ${Math.min(hist.length, 10)} tries · best ${Math.max(...hist)}</span><div class="hist-bars">${hist.slice(-10).map((n) => `<i style="--h:${(n / Math.max(...hist)) * 100}%"><span class="tnum">${n}</span></i>`).join('')}</div></div>` : '<p class="muted">Tip: beginners usually manage 10–20 changes. 30+ means the change is becoming automatic.</p>';
    }
    cards();
    const status = $('#dStatus', main);
    status.innerHTML = '';
    const targets = {};
    const tgtOf = (c) => targets[c] || (targets[c] = App.chordTarget(c, 0));
    const judge = App.createJudge({
      target: () => (ds.running ? tgtOf(ds.target === 0 ? a : b) : null),
      onResult: (ok) => {
        if (!ok) { status.dataset.kind = 'bad'; status.innerHTML = `<div class="st-text"><p class="st-title">Not clean yet. Strum ${esc(ds.target === 0 ? a : b)} again.</p></div>`; return; }
        ds.count++;
        ds.target = 1 - ds.target;
        $('#dCount', main).textContent = ds.count;
        status.dataset.kind = 'ok';
        status.innerHTML = `<div class="st-text"><p class="st-title">Now ${esc(ds.target === 0 ? a : b)}</p></div>`;
        cards();
      },
    });
    function stop(done) {
      ds.running = false;
      clearInterval(ds.timer);
      $('#dGo', main).textContent = 'Start';
      if (done) {
        const arr = (P().drills.changes[key()] = P().drills.changes[key()] || []);
        const prevBest = arr.length ? Math.max(...arr) : 0;
        arr.push(ds.count);
        if (arr.length > 30) arr.shift();
        App.save();
        status.dataset.kind = 'ok';
        status.innerHTML = `<div class="st-text"><p class="st-title">${ds.count} changes in one minute${ds.count > prevBest && prevBest ? '. New best!' : '.'}</p><p class="st-detail">Do this daily and watch the number climb.</p></div>`;
      }
      cards();
    }
    $('#dGo', main).addEventListener('click', () => {
      if (ds.running) { stop(false); return; }
      if (!App.micOn()) { App.toast('Turn on the microphone first'); return; }
      if (a === b) { App.toast('Pick two different chords'); return; }
      ds.running = true; ds.left = 60; ds.count = 0; ds.target = 0; ds.t0 = performance.now();
      $('#dCount', main).textContent = '0';
      $('#dGo', main).textContent = 'Stop';
      status.dataset.kind = 'listen';
      status.innerHTML = `<div class="st-icon"><span class="pulse"></span></div><div class="st-text"><p class="st-title">Go! Strum ${esc(a)}</p></div>`;
      cards();
      ds.timer = setInterval(() => {
        ds.left = Math.max(0, 60 - Math.floor((performance.now() - ds.t0) / 1000));
        $('#dTime', main).textContent = ds.left;
        if (ds.left <= 0) stop(true);
      }, 200);
    });
    $('#dA', main).addEventListener('change', (e) => { a = e.target.value; cards(); });
    $('#dB', main).addEventListener('change', (e) => { b = e.target.value; cards(); });
    const off = GT.audio.onFrame((f) => judge.handle(f));
    return () => { off(); clearInterval(ds.timer); };
  }

  function notesDrill(main) {
    const ds = { running: false, strings: new Set([5, 4]), maxFret: 3, hints: true, count: 0, t0: 0, timer: 0, target: null };
    main.innerHTML = `
    <a class="back" href="#drills"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Drills</a>
    <div class="page-head"><div><h1>Note finder</h1><p class="lede">Find the note on the string I show you and pluck it. Start with two strings, then add more.</p></div></div>
    ${App.micBox()}
    <div class="card drill">
      <div class="drill-pick">
        <div class="field"><span>Strings</span><div class="chips">${[5, 4, 3, 2, 1, 0].map((s) => `<button type="button" class="chip-btn" data-str="${s}" aria-pressed="${ds.strings.has(s)}">${6 - s} ${GT.STRING_NAMES[s]}</button>`).join('')}</div></div>
        <label class="field"><span>Frets</span><select id="nFrets"><option value="3" selected>0–3</option><option value="5">0–5</option><option value="7">0–7</option><option value="12">0–12</option></select></label>
        <label class="chk"><input type="checkbox" id="nHint" checked> Show me where</label>
        <button class="btn primary big" id="nGo">Start</button>
      </div>
      <div class="drill-stage notes">
        <div class="nf-target"><span class="eyebrow">Play</span><span class="nf-note" id="nNote">–</span><span class="muted" id="nWhere"></span></div>
        <div class="drill-mid"><span class="drill-time tnum" id="nTime">60</span><span class="muted">seconds</span><span class="drill-count tnum" id="nCount">0</span><span class="muted">notes</span></div>
      </div>
      <div class="fb-wrap" id="nFb"></div>
      <div class="status" id="nStatus"></div>
    </div>`;
    const status = $('#nStatus', main);
    function pick() {
      const strings = [...ds.strings];
      let t;
      let guard = 0;
      do {
        const s = strings[Math.floor(Math.random() * strings.length)];
        const f = Math.floor(Math.random() * (ds.maxFret + 1));
        t = { string: s, fret: f, midi: GT.TUNING[s] + f };
      } while (ds.target && t.midi === ds.target.midi && guard++ < 20);
      t.tgt = App.noteTarget(t.midi, { string: t.string, fret: t.fret, finger: t.fret ? Math.min(4, t.fret) : 0 });
      ds.target = t;
      paint();
    }
    function paint() {
      const t = ds.target;
      const to = Math.max(4, ds.maxFret);
      if (!t) { $('#nFb', main).innerHTML = GT.draw.fretboard(App.fbOpts({ from: 0, to, frets: null })); return; }
      $('#nNote', main).textContent = GT.midiName(t.midi);
      $('#nWhere', main).textContent = `on string ${6 - t.string} (${GT.STRING_NAMES[t.string]})`;
      $('#nFb', main).innerHTML = GT.draw.fretboard(App.fbOpts({ from: 0, to, notes: ds.hints ? [{ string: t.string, fret: t.fret, finger: t.tgt.pos.finger, cls: 'now', label: t.fret ? t.tgt.pos.finger : '0' }] : [], warn: [t.string] }));
    }
    paint();
    const judge = App.createJudge({
      target: () => (ds.running && ds.target ? ds.target.tgt : null),
      onResult: (ok, info) => {
        if (ok) {
          ds.count++;
          $('#nCount', main).textContent = ds.count;
          status.dataset.kind = 'ok';
          status.innerHTML = `<div class="st-text"><p class="st-title">${esc(GT.midiName(ds.target.midi))} ✓</p></div>`;
          pick();
        } else {
          const ex = App.explainNote(info);
          status.dataset.kind = 'bad';
          status.innerHTML = `<div class="st-text"><p class="st-title">${esc(ex.headline)}</p><p class="st-detail">${ex.tips.map(esc).join(' ')}</p></div>`;
        }
      },
    });
    function stop(done) {
      ds.running = false;
      clearInterval(ds.timer);
      $('#nGo', main).textContent = 'Start';
      if (done) {
        const d = P().drills.notes;
        const nb = ds.count > (d.best || 0);
        d.best = Math.max(d.best || 0, ds.count);
        d.history = (d.history || []).concat(ds.count).slice(-30);
        App.save();
        status.dataset.kind = 'ok';
        status.innerHTML = `<div class="st-text"><p class="st-title">${ds.count} notes in a minute${nb ? '. New best!' : '.'}</p><p class="st-detail">${ds.hints ? 'Next time, try it with "Show me where" turned off.' : 'Add another string to keep growing.'}</p></div>`;
      }
    }
    main.addEventListener('click', (e) => {
      const b = e.target.closest('[data-str]');
      if (!b || ds.running) return;
      const s = +b.dataset.str;
      if (ds.strings.has(s) && ds.strings.size > 1) ds.strings.delete(s); else ds.strings.add(s);
      b.setAttribute('aria-pressed', String(ds.strings.has(s)));
    });
    $('#nFrets', main).addEventListener('change', (e) => { ds.maxFret = +e.target.value; paint(); });
    $('#nHint', main).addEventListener('change', (e) => { ds.hints = e.target.checked; paint(); });
    $('#nGo', main).addEventListener('click', () => {
      if (ds.running) { stop(false); return; }
      if (!App.micOn()) { App.toast('Turn on the microphone first'); return; }
      ds.running = true; ds.count = 0; ds.t0 = performance.now();
      $('#nCount', main).textContent = '0';
      $('#nGo', main).textContent = 'Stop';
      pick();
      ds.timer = setInterval(() => {
        const left = Math.max(0, 60 - Math.floor((performance.now() - ds.t0) / 1000));
        $('#nTime', main).textContent = left;
        if (left <= 0) stop(true);
      }, 200);
    });
    const off = GT.audio.onFrame((f) => judge.handle(f));
    return () => { off(); clearInterval(ds.timer); };
  }

  // ================================================================= SETTINGS
  function settingsView(main) {
    const radio = (name, val, label, cur) => `<label class="radio"><input type="radio" name="${name}" value="${val}" ${cur === val ? 'checked' : ''}> ${label}</label>`;
    main.innerHTML = `
    <div class="page-head"><div><h1>Settings</h1><p class="lede">Set up your microphone once, and make the diagrams match how you hold the guitar.</p></div></div>
    <div class="settings">
      <section class="card">
        <h2>Microphone</h2>
        <div class="row wrap between">
          <p id="micState" class="muted"></p>
          <button class="btn" id="micToggle"></button>
        </div>
        <label class="field"><span>Input device</span><select id="sDevice"><option value="">Default microphone</option></select></label>
        <div class="meter-wrap" aria-label="Input level">
          <div class="meter"><i id="sLevel"></i><b id="sGateMark" title="Sensitivity threshold"></b></div>
          <p class="hint">The bar should jump past the white line when you strum, and stay below it when you're silent.</p>
        </div>
        <label class="field"><span>Input boost <output id="oGain"></output></span><input type="range" id="sGain" min="0.5" max="6" step="0.25" value="${S.micGain}"></label>
        <label class="field"><span>Sensitivity threshold <output id="oGate"></output></span><input type="range" id="sGate" min="0.002" max="0.06" step="0.001" value="${S.gate}"></label>
        <div class="row wrap"><button class="btn" id="sCal">Calibrate for my room</button><span class="muted" id="calMsg"></span></div>
        <div class="mic-test">
          <span class="eyebrow">Mic test</span>
          <div class="row wrap"><span>Note: <b id="tNoteS">–</b></span><span>Chord: <b id="tChordS">–</b></span></div>
          <div class="chroma" id="sChroma"></div>
        </div>
      </section>
      <section class="card">
        <h2>Checking</h2>
        <fieldset><legend>How strict should I be?</legend>
          ${radio('strict', 'relaxed', 'Relaxed: good for noisy rooms or cheap mics', S.strictness)}
          ${radio('strict', 'normal', 'Normal', S.strictness)}
          ${radio('strict', 'strict', 'Strict: every string must ring', S.strictness)}
        </fieldset>
        <label class="chk"><input type="checkbox" id="sOct" ${S.octaveOk ? 'checked' : ''}> Accept a single note played an octave higher or lower</label>
      </section>
      <section class="card">
        <h2>Display</h2>
        <label class="chk"><input type="checkbox" id="sLefty" ${S.leftHanded ? 'checked' : ''}> I play left-handed (mirror all diagrams)</label>
        <fieldset><legend>Fretboard view</legend>
          ${radio('view', 'player', 'As you see it when you look down: thickest string on top', S.view)}
          ${radio('view', 'tab', 'Like tab: thinnest string on top', S.view)}
        </fieldset>
        <div class="fb-wrap small" id="viewPrev"></div>
        <fieldset><legend>Dots show</legend>
          ${radio('labels', 'finger', 'Finger numbers', S.labels)}
          ${radio('labels', 'note', 'Note names', S.labels)}
        </fieldset>
        <fieldset><legend>Note names</legend>
          ${radio('naming', 'letters', 'C D E F G A B', S.naming)}
          ${radio('naming', 'solfege', 'Do Re Mi Fa Sol La Si', S.naming)}
        </fieldset>
        <label class="chk"><input type="checkbox" id="sBarre" ${S.fullBarre ? 'checked' : ''}> Use the full barre F (instead of the easy four-string F)</label>
      </section>
      <section class="card">
        <h2>Sound</h2>
        <label class="field"><span>Guitar demo volume</span><input type="range" id="sGVol" min="0" max="1" step="0.05" value="${S.guitarVol}"></label>
        <label class="field"><span>Metronome volume</span><input type="range" id="sCVol" min="0" max="1" step="0.05" value="${S.clickVol}"></label>
        <div class="row wrap"><button class="btn" id="sTestG">Test guitar</button><button class="btn" id="sTestC">Test click</button></div>
      </section>
      <section class="card">
        <h2>Your data</h2>
        <p class="muted">Progress and your own songs are saved in this browser only.</p>
        <div class="row wrap"><button class="btn danger" id="sReset">Reset progress</button><span id="resetConfirm"></span></div>
      </section>
    </div>`;

    function micStateText() {
      $('#micState', main).textContent = App.micOn() ? 'Microphone is on.' : App.micMessage();
      $('#micToggle', main).textContent = App.micOn() ? 'Turn off' : 'Turn on';
      $('#micToggle', main).className = App.micOn() ? 'btn' : 'btn primary';
    }
    micStateText();
    async function fillDevices() {
      try {
        const devs = await GT.audio.listInputs();
        const sel = $('#sDevice', main);
        if (!sel) return;
        sel.innerHTML = '<option value="">Default microphone</option>' + devs.filter((d) => d.deviceId && d.deviceId !== 'default').map((d, i) => `<option value="${esc(d.deviceId)}" ${S.deviceId === d.deviceId ? 'selected' : ''}>${esc(d.label || 'Microphone ' + (i + 1))}</option>`).join('');
      } catch (e) { /* device list unavailable */ }
    }
    fillDevices();
    const out = () => {
      $('#oGain', main).textContent = `${(+S.micGain).toFixed(2)}×`;
      $('#oGate', main).textContent = (+S.gate).toFixed(3);
      $('#sGateMark', main).style.left = `${Math.min(100, (Math.sqrt(S.gate / 0.25)) * 100)}%`;
    };
    out();
    const prev = () => { $('#viewPrev', main).innerHTML = GT.draw.fretboard(App.fbOpts({ ...GT.voicing('C'), from: 0, to: 4, compact: true })); };
    prev();

    const cw = App.chromaWidget($('#sChroma', main));
    const namer = App.createLiveNamer();
    let cal = null;
    const off = GT.audio.onFrame((f) => {
      const lv = $('#sLevel', main);
      if (lv) lv.style.width = `${Math.min(100, Math.sqrt(f.level / 0.25) * 100)}%`;
      if (cal) { cal.samples.push(f.level); }
      const loud = f.level > f.gate;
      cw.update(loud ? f.chroma : null);
      if (loud && f.pitch && f.pitch.clarity > 0.88) $('#tNoteS', main).textContent = `${GT.midiName(f.pitch.midi, true)} (${f.pitch.freq.toFixed(1)} Hz)`;
      const n = namer(f);
      if (n) $('#tChordS', main).textContent = n;
    });
    const offMic = App.on('mic', () => { micStateText(); fillDevices(); });

    main.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'sGain') { S.micGain = +t.value; GT.audio.setMicGain(S.micGain); }
      else if (t.id === 'sGate') { S.gate = +t.value; GT.audio.setGate(S.gate); }
      else if (t.id === 'sGVol') { S.guitarVol = +t.value; GT.audio.setVolume('guitar', S.guitarVol); }
      else if (t.id === 'sCVol') { S.clickVol = +t.value; GT.audio.setVolume('click', S.clickVol); }
      else return;
      out();
      App.save();
    });
    main.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'strict') S.strictness = t.value;
      else if (t.name === 'view') { S.view = t.value; prev(); }
      else if (t.name === 'labels') { S.labels = t.value; prev(); }
      else if (t.name === 'naming') { S.naming = t.value; GT.setNaming(S.naming); prev(); }
      else if (t.id === 'sOct') S.octaveOk = t.checked;
      else if (t.id === 'sLefty') { S.leftHanded = t.checked; App.applySettings(); prev(); }
      else if (t.id === 'sBarre') S.fullBarre = t.checked;
      else if (t.id === 'sDevice') { S.deviceId = t.value; if (App.micOn()) { GT.audio.stopMic(); App.enableMic(); } }
      else return;
      App.save();
    });
    main.addEventListener('click', (e) => {
      const id = e.target.closest('button') && e.target.closest('button').id;
      if (id === 'micToggle') { if (App.micOn()) App.disableMic(); else App.enableMic(); }
      if (id === 'sTestG') { const t = App.chordTarget('G', 0); GT.audio.strum(t.notes, 0, 'D'); GT.audio.ignoreMic(1.8); }
      if (id === 'sTestC') { GT.audio.ensureContext(); const n = GT.audio.now(); for (let i = 0; i < 4; i++) GT.audio.click(n + 0.05 + i * 0.5, i === 0); }
      if (id === 'sCal') {
        if (!App.micOn()) { App.toast('Turn on the microphone first'); return; }
        $('#calMsg', main).textContent = 'Stay quiet for 2 seconds…';
        cal = { samples: [] };
        setTimeout(() => {
          const s = cal.samples.sort((a, b) => a - b);
          cal = null;
          const noise = s.length ? s[Math.floor(s.length * 0.9)] : 0.004;
          S.gate = Math.min(0.06, Math.max(0.004, noise * 3));
          GT.audio.setGate(S.gate);
          $('#sGate', main).value = S.gate;
          out();
          App.save();
          $('#calMsg', main).textContent = `Done. Threshold set to ${S.gate.toFixed(3)}. Now strum: the bar should cross the line.`;
        }, 2000);
      }
      if (id === 'sReset') $('#resetConfirm', main).innerHTML = 'This clears lessons, scores and streaks (your own songs stay). <button class="btn danger small" id="sResetYes">Yes, reset</button> <button class="btn small" id="sResetNo">Cancel</button>';
      if (id === 'sResetNo') $('#resetConfirm', main).innerHTML = '';
      if (id === 'sResetYes') { App.resetProgress(); $('#resetConfirm', main).innerHTML = ''; App.toast('Progress reset'); }
    });
    return () => { off(); offMic(); };
  }

  // =================================================================== ROUTER
  const VIEWS = {
    home: homeView, learn: learnView, lesson: lessonView, exercise: exerciseView, songs: songsView, song: songView,
    add: (m, a, q) => addView(m, null, q), edit: (m, id, q) => addView(m, id, q), chords: chordsView, 'exercise-chord': chordExerciseView,
    tuner: tunerView, drills: drillsView, settings: settingsView,
    drill: (m, which) => (which === 'notes' ? notesDrill(m) : changesDrill(m)),
  };
  const NAV = { home: 'home', learn: 'learn', lesson: 'learn', exercise: 'learn', songs: 'songs', song: 'songs', add: 'songs', edit: 'songs', chords: 'chords', 'exercise-chord': 'chords', tuner: 'tuner', drills: 'drills', drill: 'drills', settings: 'settings' };
  let cleanup = null;

  function route() {
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    GT.audio.stopAll();
    const raw = location.hash.replace(/^#/, '') || 'home';
    const [path, qs] = raw.split('?');
    const [name, ...rest] = path.split('/');
    const arg = rest.map(decodeURIComponent).join('/');
    const view = VIEWS[name] || homeView;
    const old = $('#view');
    const main = old.cloneNode(false); // fresh element drops old listeners
    old.replaceWith(main);
    cleanup = view(main, arg, new URLSearchParams(qs || '')) || null;
    $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === (NAV[name] || 'home')));
    document.title = (name === 'song' && App.findSong(arg) ? App.findSong(arg).title + ' · ' : '') + 'FretCoach';
    if (!(name === 'chords' && arg)) window.scrollTo(0, 0);
  }

  // mic pill in the rail
  function paintPill() {
    const pill = $('#micPill');
    if (!pill) return;
    pill.dataset.state = App.mic.state;
    $('.lbl', pill).textContent = App.micOn() ? 'Mic on' : App.mic.state === 'starting' ? 'Starting…' : 'Mic off';
    pill.setAttribute('aria-pressed', String(App.micOn()));
  }
  let pillT = 0;
  GT.audio.onFrame((f) => {
    const now = performance.now();
    if (now - pillT < 60) return;
    pillT = now;
    const m = $('#micPill .meter i');
    if (m) m.style.transform = `scaleX(${Math.min(1, Math.sqrt(f.level / 0.2)).toFixed(3)})`;
  });

  function boot() {
    App.applySettings();
    App.on('mic', paintPill);
    paintPill();
    $('#micPill').addEventListener('click', () => { if (App.micOn()) App.disableMic(); else App.enableMic(); });
    window.addEventListener('hashchange', route);
    route();
    // browsers only start audio after a click or key press
    if (S.micWanted) {
      const resume = () => {
        window.removeEventListener('pointerdown', resume, true);
        window.removeEventListener('keydown', resume, true);
        if (!App.micOn()) App.enableMic();
      };
      window.addEventListener('pointerdown', resume, true);
      window.addEventListener('keydown', resume, true);
      $('#micPill .lbl').textContent = 'Click to resume mic';
    }
  }

  App.route = route;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
