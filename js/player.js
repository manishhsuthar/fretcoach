/* FretCoach — the song player: Practice (waits for you), Play along (timed + scored), Listen (demo). */
(function () {
  'use strict';
  const GT = window.GT;
  const App = GT.app;
  const { $, $$, esc, S } = App;

  const PRAISE = ['Clean!', 'Nice!', "That's it!", 'Got it!', 'Sounds right!', 'Perfect!', 'Yes!'];
  const arrowSVG = (dir) => dir === 'D'
    ? '<svg viewBox="0 0 24 24" aria-label="down"><path d="M12 3v15m0 0l-6-6m6 6l6-6"/></svg>'
    : dir === 'U' ? '<svg viewBox="0 0 24 24" aria-label="up"><path d="M12 21V6m0 0l-6 6m6-6l6 6"/></svg>' : '<span class="rest-dot" aria-label="rest"></span>';

  /**
   * opts: { mode, backHref, backLabel, lesson: {id, index}, onComplete(result) }
   */
  function playerView(main, song, opts) {
    opts = opts || {};
    const isMelody = song.type === 'melody';
    const ps = {
      mode: opts.mode || 'practice', idx: 0, transpose: 0, capo: song.capo || 0, pct: 100,
      results: [], attempts: [], combo: 0, bestCombo: 0, metronome: true, backing: false,
      strumId: song.strum, labels: S.labels, finished: false,
    };
    let C = GT.compileSong(song, { transpose: ps.transpose });
    const targets = new Map();
    const bpb = C.beatsPerBar;
    const backHref = opts.backHref || (isMelody || song.group ? '#songs' : '#songs');
    const backLabel = opts.backLabel || 'Songs';

    main.innerHTML = `
    <div class="player ${isMelody ? 'is-melody' : 'is-chords'}">
      <div class="p-top">
        <a class="back" href="${backHref}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>${esc(backLabel)}</a>
        <div class="p-titles">
          <h1>${esc(song.title)}</h1>
          <p>${esc(song.artist || '')}${song.level ? ' · ' + App.LEVELS[song.level] : ''} · <span id="meter">${bpb}/4</span></p>
        </div>
        <div class="seg" role="tablist" aria-label="Mode">
          <button role="tab" data-mode="practice" title="Waits until you play each ${isMelody ? 'note' : 'chord'} right">Practice</button>
          <button role="tab" data-mode="timed" title="Keeps time with a metronome and scores you">Play along</button>
          <button role="tab" data-mode="listen" title="Hear how it should sound">Listen</button>
        </div>
      </div>
      <div class="p-bar">
        <div class="ctl tempo"><label for="tempo">Tempo</label><input type="range" id="tempo" min="40" max="140" step="5" value="100"><output id="tempoOut"></output></div>
        ${isMelody ? '' : `
        <div class="ctl stepper" title="Put a capo on this fret"><span>Capo</span><button class="mini" data-act="capo-" aria-label="Capo down">−</button><b id="capoOut">0</b><button class="mini" data-act="capo+" aria-label="Capo up">+</button></div>
        <div class="ctl stepper" title="Shift every chord up or down"><span>Key</span><button class="mini" data-act="tr-" aria-label="Transpose down">−</button><b id="trOut">0</b><button class="mini" data-act="tr+" aria-label="Transpose up">+</button></div>
        <button class="btn ghost small" data-act="easier">Make it easier</button>`}
        <label class="chk"><input type="checkbox" id="metro" checked> Metronome</label>
        <label class="chk"><input type="checkbox" id="noteLabels" ${ps.labels === 'note' ? 'checked' : ''}> Note names</label>
        <label class="chk" id="backingWrap" title="Plays the guitar part with you. Use headphones so the mic doesn't hear it."><input type="checkbox" id="backing"> Guitar plays along</label>
        <span class="grow"></span>
        <button class="btn primary" id="go"><span>Start</span></button>
      </div>
      <div class="p-main">
        <section class="now" aria-live="polite">
          <div class="now-head"><span class="eyebrow">Now</span><span id="stepCount" class="muted tnum"></span></div>
          <div class="now-name" id="nowName"></div>
          <div class="now-sub" id="nowSub"></div>
          <div class="now-box" id="nowBox"></div>
          <button class="btn ghost small" id="hear"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>Hear it</button>
        </section>
        <section class="board">
          <div class="fb-wrap" id="fb"></div>
          <ol class="howto" id="howto"></ol>
        </section>
        <aside class="next"><span class="eyebrow">Next</span><div id="nextList" class="next-list"></div></aside>
      </div>
      <section class="feedback" id="feedback">
        <div class="status" id="status"></div>
        <div class="heard">
          <div class="heard-head"><span class="eyebrow">Notes I hear</span><span class="live" id="liveName"></span></div>
          <div class="chroma" id="chroma"></div>
        </div>
      </section>
      <section class="lane" id="lane"></section>
      <section class="sheet-wrap"><div class="sheet" id="sheet"></div></section>
      <div class="countin" id="countin" hidden></div>
      <div class="results" id="results" hidden></div>
    </div>`;

    const el = {
      go: $('#go', main), status: $('#status', main), nowName: $('#nowName', main), nowSub: $('#nowSub', main),
      nowBox: $('#nowBox', main), fb: $('#fb', main), howto: $('#howto', main), next: $('#nextList', main),
      lane: $('#lane', main), sheet: $('#sheet', main), count: $('#stepCount', main), countin: $('#countin', main),
      results: $('#results', main), live: $('#liveName', main), tempoOut: $('#tempoOut', main),
    };
    const chroma = App.chromaWidget($('#chroma', main));

    // ------------------------------------------------------------ helpers
    const curStep = () => C.steps[ps.idx];
    function targetFor(i) {
      const st = C.steps[i];
      if (!st) return null;
      const key = i + '|' + ps.capo + '|' + ps.transpose + '|' + S.fullBarre;
      if (!targets.has(key)) {
        targets.set(key, st.kind === 'chord' ? App.chordTarget(st.chord, ps.capo) : App.noteTarget(st.midi, st.pos));
      }
      return targets.get(key);
    }
    const bpm = () => Math.round((song.bpm || 80) * ps.pct / 100);
    const strum = () => GT.strumFor(bpb, ps.strumId);
    const melodyMaxFret = isMelody ? Math.max(5, ...C.steps.map((s) => (s.pos ? s.pos.fret : 0))) : 5;

    // ------------------------------------------------------------ rendering
    function renderSheet() {
      if (isMelody) {
        el.sheet.innerHTML = C.lines.map((ln) => `<div class="sline notes">${ln.segs.map((sg) => {
          const st = C.steps[sg.step];
          return `<button class="seg note" data-step="${sg.step}">${esc(GT.midiName(st.midi))}</button>`;
        }).join('')}</div>`).join('');
      } else {
        el.sheet.innerHTML = C.lines.map((ln) => {
          if (ln.type === 'gap') return '<div class="sgap"></div>';
          if (ln.type === 'section') return `<div class="ssection">${esc(ln.text)}</div>`;
          if (ln.type === 'lyric') return `<div class="sline"><span class="seg plain"><b class="ch">&nbsp;</b><span class="ly">${esc(ln.segs.map((s) => s.lyric).join(''))}</span></span></div>`;
          return `<div class="sline ${ln.chordsOnly ? 'chords-only' : ''}">${ln.segs.map((sg) => {
            if (!sg.chord) return `<span class="seg plain"><b class="ch">&nbsp;</b><span class="ly">${esc(sg.lyric)}</span></span>`;
            const st = C.steps[sg.step];
            const beats = st.beats !== bpb ? `<sup>${+st.beats.toFixed(2)}</sup>` : '';
            return `<button class="seg" data-step="${sg.step}"><b class="ch">${esc(sg.chord)}${ln.chordsOnly ? beats : ''}</b><span class="ly">${esc(sg.lyric || '') || '&nbsp;'}</span></button>`;
          }).join('')}</div>`;
        }).join('');
      }
      paintResults();
    }

    function paintResults() {
      $$('[data-step]', el.sheet).forEach((b) => {
        const i = +b.dataset.step;
        b.classList.toggle('cur', i === ps.idx);
        b.classList.remove('hit', 'miss', 'silent', 'retry');
        if (ps.results[i]) b.classList.add(ps.results[i]);
      });
    }

    function scrollSheet() {
      const b = $(`[data-step="${ps.idx}"]`, el.sheet);
      if (!b) return;
      const wrap = el.sheet.parentElement;
      const top = b.offsetTop - wrap.offsetTop;
      if (top < wrap.scrollTop + 10 || top > wrap.scrollTop + wrap.clientHeight - 60) {
        wrap.scrollTo({ top: Math.max(0, top - 40), behavior: 'smooth' });
      }
    }

    function renderStep() {
      const st = curStep();
      if (!st) return;
      el.count.textContent = `${ps.idx + 1} / ${C.steps.length}`;
      const tgt = targetFor(ps.idx);
      if (st.kind === 'chord') {
        const v = tgt.v;
        el.nowName.textContent = st.chord;
        el.nowName.classList.toggle('long', st.chord.length > 4);
        let sub = `${GT.pcName(v.root, v.flat)} ${v.qualityWord}`;
        if (v.simplified) sub += ' · simplified shape';
        if (ps.capo) sub += ` · sounds as ${GT.transposeChordName(st.chord, ps.capo)}`;
        el.nowSub.textContent = sub;
        el.nowBox.innerHTML = GT.draw.chordBox(v, { leftHanded: S.leftHanded });
        const win = GT.draw.windowFor(v.frets);
        el.fb.innerHTML = GT.draw.fretboard(App.fbOpts({ frets: v.frets, fingers: v.fingers, from: win.from, to: win.to, capo: ps.capo, labels: ps.labels }));
        el.howto.innerHTML = App.chordStepsHTML(v) + (v.note ? `<li class="note-tip">${esc(v.note)}</li>` : '');
        chroma.setExpected(tgt.pcs);
        // next chords
        const nx = [];
        for (let j = ps.idx + 1; j < C.steps.length && nx.length < 3; j++) nx.push(j);
        el.next.innerHTML = nx.length ? nx.map((j, k) => {
          const s2 = C.steps[j];
          const v2 = GT.voicing(s2.chord, { fullBarre: S.fullBarre });
          return `<div class="next-item ${k === 0 ? 'first' : ''}"><b>${esc(s2.chord)}</b>${k === 0 && v2 ? GT.draw.chordBox(v2, { leftHanded: S.leftHanded }) : ''}</div>`;
        }).join('') : '<p class="muted">Last chord!</p>';
      } else {
        const pos = st.pos;
        el.nowName.textContent = GT.midiName(st.midi);
        el.nowName.classList.remove('long');
        el.nowSub.textContent = pos ? `String ${6 - pos.string} (${GT.STRING_NAMES[pos.string]}) · ${pos.fret ? 'fret ' + pos.fret : 'open'}` : '';
        el.nowBox.innerHTML = pos ? `<div class="note-pos"><div><span class="big tnum">${6 - pos.string}</span><span>string</span></div><div><span class="big tnum">${pos.fret}</span><span>fret</span></div><div><span class="big fdot f${pos.finger}">${pos.finger || '0'}</span><span>${pos.finger ? GT.FINGER_NAMES[pos.finger] : 'no finger'}</span></div></div>` : '';
        const ghost = [];
        for (let j = ps.idx + 1; j < Math.min(C.steps.length, ps.idx + 3); j++) {
          const p2 = C.steps[j].pos;
          if (p2 && !(p2.string === pos.string && p2.fret === pos.fret)) ghost.push({ string: p2.string, fret: p2.fret, label: j === ps.idx + 1 ? 'next' : '' });
        }
        el.fb.innerHTML = GT.draw.fretboard(App.fbOpts({
          notes: pos ? [{ string: pos.string, fret: pos.fret, finger: pos.finger, label: ps.labels === 'note' ? GT.midiName(st.midi) : pos.fret ? pos.finger : '0', cls: 'now' }] : [],
          ghost, from: 0, to: melodyMaxFret, labels: 'finger',
        }));
        el.howto.innerHTML = pos ? `<li><span class="fdot f${pos.finger}">${pos.finger || '0'}</span><span>${pos.fret ? `${GT.FINGER_NAMES[pos.finger][0].toUpperCase() + GT.FINGER_NAMES[pos.finger].slice(1)} finger on string ${6 - pos.string} (${GT.STRING_NAMES[pos.string]}), fret ${pos.fret}. Press just behind the fret.` : `Pluck string ${6 - pos.string} (${GT.STRING_NAMES[pos.string]}) open: no fingers needed.`}</span></li>` : '';
        chroma.setExpected([GT.mod12(st.midi)]);
        const nx = C.steps.slice(ps.idx + 1, ps.idx + 5);
        el.next.innerHTML = nx.length ? nx.map((s2, k) => `<div class="next-item note ${k === 0 ? 'first' : ''}"><b>${esc(GT.midiName(s2.midi))}</b><span class="muted">${s2.pos ? `str ${6 - s2.pos.string} · fr ${s2.pos.fret}` : ''}</span></div>`).join('') : '<p class="muted">Last note!</p>';
      }
      paintResults();
      scrollSheet();
      renderLane();
      if (ps.mode === 'practice') setPracticeStatus();
    }

    // strum lane / tab strip
    let laneSlots = null;
    let tabInfo = null;
    function renderLane() {
      if (isMelody) {
        const notes = C.steps.map((s) => ({ string: s.pos ? s.pos.string : 0, fret: s.pos ? s.pos.fret : '?', bar: s.bar }));
        tabInfo = GT.draw.tab(notes, ps.idx);
        el.lane.innerHTML = `<div class="lane-head"><span class="eyebrow">Tab</span><span class="muted">Numbers are frets. Top line is the thinnest string.</span></div><div class="tab-scroll" id="tabScroll">${tabInfo.svg}</div>`;
        const sc = $('#tabScroll', el.lane);
        sc.scrollLeft = Math.max(0, tabInfo.colX(ps.idx) - sc.clientWidth / 3);
        return;
      }
      if (laneSlots && el.lane.dataset.pattern === ps.strumId) return;
      const pat = strum();
      const list = GT.STRUMS[bpb] || GT.STRUMS[4];
      el.lane.dataset.pattern = ps.strumId;
      el.lane.innerHTML = `<div class="lane-head"><span class="eyebrow">Strum</span>
        <select id="strumSel" aria-label="Strum pattern">${list.map((p) => `<option value="${p.id}" ${p.id === pat.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <span class="muted lane-hint" id="laneHint"></span></div>
        <div class="slots" style="--n:${pat.slots.length}">${pat.slots.split('').map((c, k) => `<div class="slot ${c === '-' ? 'rest' : c === 'U' ? 'up' : 'down'}" data-k="${k}">${arrowSVG(c)}<span class="cnt">${k % 2 ? '&amp;' : k / 2 + 1}</span></div>`).join('')}</div>`;
      laneSlots = $$('.slot', el.lane);
      $('#strumSel', el.lane).addEventListener('change', (e) => { ps.strumId = e.target.value; laneSlots = null; renderLane(); });
      updateLaneHint();
    }
    function updateLaneHint() {
      const h = $('#laneHint', el.lane);
      if (h) h.textContent = ps.mode === 'practice' ? 'In Practice, one strum per chord is enough. Use Play along to practise the rhythm.' : 'Down on the numbers, up on the "&".';
    }
    function highlightSlot(k) {
      if (!laneSlots) return;
      laneSlots.forEach((s, i) => s.classList.toggle('on', i === k));
    }

    // -------------------------------------------------------- status texts
    function setStatus(kind, title, detail, extra) {
      el.status.dataset.kind = kind;
      el.status.innerHTML = `<div class="st-icon" aria-hidden="true">${statusIcon(kind)}</div><div class="st-text"><p class="st-title">${title}</p>${detail ? `<p class="st-detail">${detail}</p>` : ''}${extra || ''}</div>`;
    }
    function statusIcon(kind) {
      if (kind === 'ok') return '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
      if (kind === 'bad') return '<svg viewBox="0 0 24 24"><path d="M12 7v6m0 4v.01"/></svg>';
      if (kind === 'listen') return '<span class="pulse"></span>';
      return '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0a3 3 0 1 0 0 .01M9 21h6"/></svg>';
    }
    function setPracticeStatus() {
      const st = curStep();
      if (!st) return;
      if (!App.micOn()) {
        setStatus('idle', App.micMessage(), '', `<div class="st-actions">${App.mic.state !== 'insecure' ? '<button class="btn primary small" data-act="mic-on">Turn on microphone</button>' : ''}<button class="btn small" data-act="manual-next">I played it →</button></div>`);
        return;
      }
      const what = st.kind === 'chord' ? `Strum ${esc(st.chord)}` : `Play ${esc(GT.midiName(st.midi))}`;
      setStatus('listen', what, st.kind === 'chord' ? 'Make the shape, then strum once. I\'m listening.' : 'Pluck the string and let it ring.', '<div class="st-actions"><button class="btn small ghost" data-act="skip">Skip</button></div>');
    }

    // ------------------------------------------------------------ practice
    let advanceTimer = 0;
    const judge = App.createJudge({
      target: () => (ps.mode === 'practice' && !ps.finished && !advanceTimer ? targetFor(ps.idx) : null),
      onStart: () => { el.status.classList.add('hearing'); },
      onResult: (ok, info) => {
        el.status.classList.remove('hearing');
        const st = curStep();
        if (!st) return;
        if (ok) {
          ps.results[ps.idx] = ps.results[ps.idx] === 'miss' ? 'retry' : 'hit';
          ps.combo++;
          ps.bestCombo = Math.max(ps.bestCombo, ps.combo);
          if (st.kind === 'chord') App.recordChordHit(st.chord);
          const p = PRAISE[Math.floor(Math.random() * PRAISE.length)];
          setStatus('ok', p, ps.combo >= 3 ? `${ps.combo} in a row` : '');
          paintResults();
          advanceTimer = setTimeout(() => { advanceTimer = 0; goTo(ps.idx + 1); }, 450);
        } else {
          ps.attempts[ps.idx] = (ps.attempts[ps.idx] || 0) + 1;
          ps.results[ps.idx] = 'miss';
          ps.combo = 0;
          const ex = st.kind === 'chord' ? App.explainChord(info) : App.explainNote(info);
          setStatus('bad', esc(ex.headline), ex.tips.map(esc).join('<br>'), '<div class="st-actions"><button class="btn small ghost" data-act="hear">Hear it</button><button class="btn small ghost" data-act="skip">Skip</button></div>');
          if (st.kind === 'chord') {
            const dg = GT.diagnoseChord(info.acc, info.target.v, info.target.capo);
            const warn = [];
            dg.missing.forEach((m) => m.strings.forEach((s) => warn.push(s)));
            const v = info.target.v;
            const win = GT.draw.windowFor(v.frets);
            el.fb.innerHTML = GT.draw.fretboard(App.fbOpts({ frets: v.frets, fingers: v.fingers, from: win.from, to: win.to, capo: ps.capo, labels: ps.labels, warn }));
          }
          paintResults();
        }
      },
    });

    function goTo(i) {
      clearTimeout(advanceTimer);
      advanceTimer = 0;
      judge.reset();
      if (i >= C.steps.length) { finishPractice(); return; }
      ps.idx = Math.max(0, i);
      renderStep();
    }

    function finishPractice() {
      ps.finished = true;
      if (!ps.results.some(Boolean)) {
        ps.idx = C.steps.length - 1;
        setStatus('ok', 'You reached the end!', 'Turn on the microphone next time and I\'ll check every ' + (isMelody ? 'note' : 'chord') + '.', '<div class="st-actions"><button class="btn small" data-act="again">Start over</button></div>');
        if (opts.onComplete) opts.onComplete({ acc: 0, clean: 0, total: C.steps.length, mode: 'practice', unchecked: true });
        return;
      }
      const total = C.steps.length;
      const clean = C.steps.filter((_, i) => ps.results[i] === 'hit').length;
      const acc = Math.round((clean / total) * 100);
      showResults({ acc, clean, total, mode: 'practice' });
    }

    // -------------------------------------------------------------- timed
    const tp = { playing: false, t0: 0, beatDur: 0.6, startBeat: 0, nextClick: 0, nextSlot: 0, nextNote: 0, sched: 0, raf: 0, acc: {}, judgeNext: 0, startIdx: 0 };
    const timeOf = (b) => tp.t0 + b * tp.beatDur;
    const beatAt = (t) => (t - tp.t0) / tp.beatDur;
    function stepIndexAt(b) {
      const s = C.steps;
      if (!s.length || b < s[0].start) return -1;
      let lo = 0, hi = s.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (s[mid].start <= b) lo = mid; else hi = mid - 1;
      }
      return lo;
    }

    function startTransport() {
      const ctx = GT.audio.ensureContext();
      ps.finished = false;
      el.results.hidden = true;
      if (ps.idx >= C.steps.length) ps.idx = 0;
      tp.beatDur = 60 / bpm();
      tp.startIdx = ps.idx;
      tp.startBeat = C.steps[ps.idx] ? C.steps[ps.idx].start : 0;
      // count in from the start of the bar that contains startBeat, plus one full bar
      const barStart = Math.floor(tp.startBeat / bpb) * bpb;
      const countBeats = bpb + (tp.startBeat - barStart);
      tp.t0 = ctx.currentTime + 0.25 + countBeats * tp.beatDur - tp.startBeat * tp.beatDur;
      tp.nextClick = Math.round(tp.startBeat - countBeats);
      tp.nextSlot = Math.ceil(tp.startBeat * 2 - 1e-6);
      tp.nextNote = ps.idx;
      tp.acc = {};
      tp.judgeNext = ps.idx;
      for (let i = ps.idx; i < C.steps.length; i++) ps.results[i] = null;
      ps.combo = 0;
      tp.playing = true;
      paintResults();
      el.go.innerHTML = '<span>Pause</span>';
      el.go.classList.add('playing');
      if (ps.mode === 'timed' && !App.micOn()) {
        setStatus('idle', 'The microphone is off, so I can\'t score you.', 'You can still play along to the metronome.', '<div class="st-actions"><button class="btn primary small" data-act="mic-on">Turn on microphone</button></div>');
      } else if (ps.mode === 'listen') {
        setStatus('idle', 'Listen and watch the fingers.', 'Switch to Practice or Play along when you\'re ready.');
      } else {
        setStatus('listen', 'Get ready…', `Count-in: ${bpb} clicks, then play.`);
      }
      tp.sched = setInterval(schedule, 25);
      schedule();
      tp.raf = requestAnimationFrame(tick);
    }

    function stopTransport() {
      tp.playing = false;
      clearInterval(tp.sched);
      cancelAnimationFrame(tp.raf);
      GT.audio.stopAll();
      el.go.innerHTML = '<span>Start</span>';
      el.go.classList.remove('playing');
      el.countin.hidden = true;
      highlightSlot(-1);
    }

    function schedule() {
      if (!tp.playing) return;
      const ctx = GT.audio.ensureContext();
      const horizon = ctx.currentTime + 0.16;
      while (timeOf(tp.nextClick) < horizon && tp.nextClick < C.totalBeats) {
        const b = tp.nextClick;
        if (ps.metronome || b < tp.startBeat) GT.audio.click(timeOf(b), ((Math.round(b) % bpb) + bpb) % bpb === 0);
        tp.nextClick++;
      }
      const playGuitar = ps.mode === 'listen' || ps.backing;
      if (!playGuitar) return;
      if (isMelody) {
        while (tp.nextNote < C.steps.length && timeOf(C.steps[tp.nextNote].start) < horizon) {
          const st = C.steps[tp.nextNote];
          GT.audio.pluck(st.midi, timeOf(st.start), 0.55, Math.max(0.15, st.beats * tp.beatDur * 0.95));
          tp.nextNote++;
        }
      } else {
        const pat = strum().slots;
        while (timeOf(tp.nextSlot / 2) < horizon && tp.nextSlot / 2 < C.totalBeats) {
          const beat = tp.nextSlot / 2;
          const ch = pat[tp.nextSlot % pat.length];
          if (ch === 'D' || ch === 'U') {
            const i = stepIndexAt(beat);
            if (i >= 0) {
              const nextStart = C.steps[i].start + C.steps[i].beats;
              const dur = Math.min(nextStart - beat, 2) * tp.beatDur;
              GT.audio.strum(targetFor(i).notes, timeOf(beat), ch, { duration: Math.max(0.2, dur) });
            }
          }
          tp.nextSlot++;
        }
      }
    }

    function tick() {
      if (!tp.playing) return;
      const ctx = GT.audio.ensureContext();
      const b = beatAt(ctx.currentTime);
      if (b < tp.startBeat) {
        const left = Math.ceil(tp.startBeat - b - 1e-6);
        el.countin.hidden = false;
        el.countin.textContent = left;
      } else el.countin.hidden = true;
      const i = stepIndexAt(Math.max(b, tp.startBeat));
      if (i >= 0 && i !== ps.idx) { ps.idx = i; renderStep(); }
      // strum slot highlight
      if (!isMelody && b >= tp.startBeat - bpb) {
        const inBar = ((b % bpb) + bpb) % bpb;
        highlightSlot(Math.floor(inBar * 2));
      }
      if (isMelody && tabInfo) {
        const sc = $('#tabScroll', el.lane);
        if (sc) sc.scrollLeft = Math.max(0, tabInfo.colX(ps.idx) - sc.clientWidth / 3);
      }
      // upcoming change hint
      if (ps.mode !== 'practice' && i >= 0) {
        const st = C.steps[i];
        const left = st.start + st.beats - b;
        const nx = C.steps[i + 1];
        const first = $('.next-item.first', el.next);
        if (first && nx) {
          let tag = $('.inbeats', first);
          if (!tag) { tag = document.createElement('span'); tag.className = 'inbeats tnum'; first.appendChild(tag); }
          tag.textContent = `in ${Math.max(1, Math.ceil(left - 1e-6))}`;
        }
      }
      if (ps.mode === 'timed') finalizeDue(b);
      if (b >= C.totalBeats + 0.25) {
        stopTransport();
        if (ps.mode === 'timed') finishTimed();
        else { ps.idx = tp.startIdx; renderStep(); setStatus('idle', 'That\'s the whole song.', 'Now try Practice mode, or Play along to get scored.'); }
        return;
      }
      tp.raf = requestAnimationFrame(tick);
    }

    function accFor(i) { return tp.acc[i] || (tp.acc[i] = { chroma: new Float32Array(12), n: 0, votes: [], loud: 0 }); }

    function onTimedFrame(frame) {
      if (!tp.playing || ps.mode !== 'timed' || frame.ignored) return;
      const b = beatAt(frame.time);
      const i = stepIndexAt(b);
      if (i < tp.startIdx || i < 0) return;
      const st = C.steps[i];
      const into = (b - st.start) * tp.beatDur;
      const loud = frame.level > frame.gate;
      const a = accFor(i);
      if (loud) a.loud++;
      if (st.kind === 'chord') {
        if (into >= 0.15 && loud && frame.chroma && App.addNormalized(a.chroma, frame.chroma)) a.n++;
      } else if (loud && frame.pitch && frame.pitch.clarity >= 0.85) {
        a.votes.push(frame.pitch.midi);
        const nx = C.steps[i + 1];
        if (nx && (nx.start - b) * tp.beatDur < 0.12) accFor(i + 1).votes.push(frame.pitch.midi);
      }
    }

    function finalizeDue(b) {
      while (tp.judgeNext < C.steps.length) {
        const st = C.steps[tp.judgeNext];
        if ((b - (st.start + st.beats)) * tp.beatDur < 0.08) break;
        finalizeStep(tp.judgeNext);
        tp.judgeNext++;
      }
    }

    function finalizeStep(i) {
      if (!App.micOn()) return;
      const st = C.steps[i];
      const a = tp.acc[i];
      let res = 'silent';
      let info = null;
      if (st.kind === 'chord') {
        if (a && a.n >= 3) {
          const t = targetFor(i);
          const r = GT.matchChord(a.chroma, t.notes, t.pcs, S.strictness, t.v.frets, t.capo);
          res = r.ok ? 'hit' : 'miss';
          info = { match: r, acc: a.chroma, target: t, peak: 1 };
        }
      } else if (a && a.votes.length >= 2) {
        const good = a.votes.filter((m) => App.noteMatches(m, st.midi)).length;
        res = good >= 2 ? 'hit' : 'miss';
        info = { heard: App.modeOf(a.votes), target: targetFor(i) };
      }
      ps.results[i] = res;
      if (res === 'hit') {
        ps.combo++;
        ps.bestCombo = Math.max(ps.bestCombo, ps.combo);
        if (st.kind === 'chord') App.recordChordHit(st.chord);
        setStatus('ok', st.kind === 'chord' ? `${esc(st.chord)} ✓` : `${esc(GT.midiName(st.midi))} ✓`, ps.combo >= 3 ? `${ps.combo} in a row` : '');
      } else if (res === 'miss') {
        ps.combo = 0;
        const ex = st.kind === 'chord' ? App.explainChord(info) : App.explainNote(info);
        setStatus('bad', `${esc(st.kind === 'chord' ? st.chord : GT.midiName(st.midi))}: ${esc(ex.headline)}`, ex.tips[0] ? esc(ex.tips[0]) : '');
      } else {
        ps.combo = 0;
        setStatus('bad', `${esc(st.kind === 'chord' ? st.chord : GT.midiName(st.midi))}: I didn't hear anything.`, 'Keep strumming, even if the change isn\'t ready. Staying in time matters most.');
      }
      paintResults();
    }

    function finishTimed() {
      const judged = C.steps.slice(tp.startIdx).map((_, k) => ps.results[tp.startIdx + k]);
      const total = judged.length;
      if (!App.micOn() || !total) { ps.idx = tp.startIdx; renderStep(); setStatus('idle', 'Done!', 'Turn on the microphone to get a score.'); return; }
      const hits = judged.filter((r) => r === 'hit').length;
      const acc = Math.round((hits / total) * 100);
      showResults({ acc, clean: hits, total, mode: 'timed', full: tp.startIdx === 0 });
    }

    // ------------------------------------------------------------ results
    function showResults(r) {
      ps.finished = true;
      const stars = App.starsFor(r.acc);
      const prog = App.store.progress.songs[song.id] || { best: 0, plays: 0 };
      const isNewBest = (r.mode === 'timed' && r.full !== false) && r.acc > (prog.best || 0);
      if (!song.temp) {
        prog.plays = (prog.plays || 0) + 1;
        prog.last = Date.now();
        if (r.mode === 'timed' && r.full !== false) prog.best = Math.max(prog.best || 0, r.acc);
        if (r.mode === 'practice') prog.practiced = true;
        App.store.progress.songs[song.id] = prog;
        App.save();
      }
      // weakest chords / notes
      const misses = {};
      C.steps.forEach((st, i) => {
        if (ps.results[i] && ps.results[i] !== 'hit') {
          const k = st.kind === 'chord' ? st.chord : GT.midiName(st.midi);
          misses[k] = (misses[k] || 0) + 1;
        }
      });
      const weak = Object.entries(misses).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (opts.onComplete) opts.onComplete(r);
      const lessonNext = opts.lesson ? `<a class="btn primary" href="#lesson/${opts.lesson.id}">Back to lesson</a>` : '';
      el.results.innerHTML = `<div class="results-card" role="dialog" aria-label="Results">
        <p class="eyebrow">${r.mode === 'timed' ? 'Play-along score' : 'Practice complete'}</p>
        <div class="res-score">${App.starsHTML(stars)}<span class="res-pct tnum">${r.acc}%</span></div>
        <p class="res-line">${r.mode === 'timed' ? `${r.clean} of ${r.total} ${isMelody ? 'notes' : 'chords'} on time` : `${r.clean} of ${r.total} right on the first try`}${ps.bestCombo >= 3 ? ` · best run ${ps.bestCombo}` : ''}</p>
        ${isNewBest ? '<p class="res-best">New personal best</p>' : ''}
        ${weak.length ? `<p class="res-weak">Practise next: ${weak.map(([k]) => `<b>${esc(k)}</b>`).join(', ')}</p>` : '<p class="res-weak">No weak spots. Try it faster!</p>'}
        <div class="res-actions">
          ${lessonNext}
          <button class="btn ${lessonNext ? '' : 'primary'}" data-act="again">Play again</button>
          ${r.mode === 'practice' && !opts.lesson ? '<button class="btn" data-act="to-timed">Now play along</button>' : ''}
          ${r.mode === 'timed' && r.acc < 70 ? '<button class="btn" data-act="slower">Try 15% slower</button>' : ''}
          ${r.mode === 'timed' && r.acc >= 90 ? '<button class="btn" data-act="faster">Try 10% faster</button>' : ''}
        </div>
      </div>`;
      el.results.hidden = false;
    }

    // ------------------------------------------------------------- modes
    function setMode(m) {
      stopTransport();
      clearTimeout(advanceTimer);
      advanceTimer = 0;
      judge.reset();
      ps.mode = m;
      ps.finished = false;
      el.results.hidden = true;
      $$('.seg [data-mode]', main).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
      main.querySelector('.player').dataset.mode = m;
      el.go.hidden = m === 'practice';
      $('#backingWrap', main).hidden = m !== 'timed';
      if (m === 'practice') setPracticeStatus();
      else if (m === 'timed') setStatus('idle', 'Press Start. You get a one-bar count-in.', 'I score every ' + (isMelody ? 'note' : 'chord') + ' while you play. Keep going even if you miss one.');
      else setStatus('idle', 'Press Start to hear the song.', 'The fretboard follows along so you can watch the shapes.');
      updateLaneHint();
    }

    function hearCurrent() {
      const st = curStep();
      if (!st) return;
      GT.audio.ensureContext();
      const t = targetFor(ps.idx);
      GT.audio.ignoreMic(1.8);
      judge.reset();
      if (st.kind === 'chord') GT.audio.strum(t.notes, 0, 'D', { gain: 0.38 });
      else GT.audio.pluck(st.midi, 0, 0.6, 1.4);
    }

    function recompile() {
      const wasIdx = ps.idx;
      C = GT.compileSong(song, { transpose: ps.transpose });
      targets.clear();
      ps.idx = Math.min(wasIdx, C.steps.length - 1);
      const co = $('#capoOut', main), to = $('#trOut', main);
      if (co) co.textContent = ps.capo;
      if (to) to.textContent = ps.transpose > 0 ? '+' + ps.transpose : ps.transpose;
      renderSheet();
      renderStep();
    }

    function updateTempo() {
      el.tempoOut.textContent = `${bpm()} bpm${ps.pct !== 100 ? ` · ${ps.pct}%` : ''}`;
    }

    // ------------------------------------------------------------ events
    main.addEventListener('click', (e) => {
      const modeBtn = e.target.closest('[data-mode]');
      if (modeBtn) { setMode(modeBtn.dataset.mode); return; }
      const stepBtn = e.target.closest('[data-step]');
      if (stepBtn) {
        const i = +stepBtn.dataset.step;
        if (tp.playing) stopTransport();
        ps.finished = false;
        el.results.hidden = true;
        goTo(i);
        return;
      }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'capo-' || a === 'capo+') { ps.capo = Math.max(0, Math.min(9, ps.capo + (a === 'capo+' ? 1 : -1))); recompile(); }
      else if (a === 'tr-' || a === 'tr+') { ps.transpose = Math.max(-11, Math.min(11, ps.transpose + (a === 'tr+' ? 1 : -1))); recompile(); }
      else if (a === 'easier') {
        const names = GT.chordsInSong(song);
        const r = GT.easierKey(names, ps.capo, ps.transpose);
        if (r.best && r.current && r.best.cost < r.current.cost - 0.3) {
          ps.capo = r.best.capo;
          ps.transpose = r.best.transpose;
          recompile();
          App.toast(r.best.capo ? `Capo on fret ${r.best.capo}. Same sound, easier shapes: ${r.best.names.join(' ')}` : `Easier shapes: ${r.best.names.join(' ')}`);
        } else App.toast('These are already the easiest shapes for this song.');
      } else if (a === 'manual-next') { ps.results[ps.idx] = ps.results[ps.idx] || null; goTo(ps.idx + 1); }
      else if (a === 'skip') { ps.combo = 0; ps.results[ps.idx] = ps.results[ps.idx] || 'silent'; goTo(ps.idx + 1); }
      else if (a === 'hear') hearCurrent();
      else if (a === 'again') { el.results.hidden = true; ps.finished = false; ps.results = []; ps.attempts = []; ps.bestCombo = 0; ps.idx = 0; renderStep(); if (ps.mode !== 'practice') startTransport(); else judge.reset(); }
      else if (a === 'to-timed') { ps.idx = 0; ps.results = []; setMode('timed'); renderStep(); }
      else if (a === 'slower' || a === 'faster') {
        ps.pct = Math.max(40, Math.min(140, ps.pct + (a === 'slower' ? -15 : 10)));
        $('#tempo', main).value = ps.pct;
        updateTempo();
        ps.idx = 0; ps.results = []; renderStep();
        startTransport();
      }
    });
    $('#hear', main).addEventListener('click', hearCurrent);
    el.go.addEventListener('click', () => {
      if (tp.playing) {
        stopTransport();
        if (ps.mode === 'timed') setStatus('idle', 'Paused.', 'Press Start to continue from this chord.');
      } else startTransport();
    });
    $('#tempo', main).addEventListener('input', (e) => {
      ps.pct = +e.target.value;
      updateTempo();
      if (tp.playing) { stopTransport(); setStatus('idle', 'Tempo changed.', 'Press Start to continue.'); }
    });
    $('#metro', main).addEventListener('change', (e) => { ps.metronome = e.target.checked; });
    $('#backing', main).addEventListener('change', (e) => {
      ps.backing = e.target.checked;
      if (ps.backing) App.toast('Use headphones, or the mic will hear the guitar sound too.');
    });
    $('#noteLabels', main).addEventListener('change', (e) => { ps.labels = e.target.checked ? 'note' : 'finger'; renderStep(); });

    function onKey(e) {
      if (e.target.closest('input, select, textarea')) return;
      if (e.key === ' ') { e.preventDefault(); if (ps.mode === 'practice') hearCurrent(); else el.go.click(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); if (!tp.playing) goTo(ps.idx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (!tp.playing) goTo(ps.idx - 1); }
      else if (e.key === 'h' || e.key === 'H') hearCurrent();
    }
    document.addEventListener('keydown', onKey);

    // mic frames
    const namer = App.createLiveNamer();
    const offFrame = GT.audio.onFrame((frame) => {
      if (ps.mode === 'practice') judge.handle(frame);
      else onTimedFrame(frame);
      const loud = frame.level > frame.gate && !frame.ignored;
      chroma.update(loud ? frame.chroma : null);
      if (loud) {
        const name = isMelody ? (frame.pitch && frame.pitch.clarity > 0.85 ? GT.midiName(frame.pitch.midi) : null) : null;
        if (name) el.live.textContent = `I hear: ${name}`;
      }
      if (!isMelody) { const n = namer(frame); if (n) el.live.textContent = `I hear: ${n}`; }
    });
    const offMic = App.on('mic', () => { if (ps.mode === 'practice' && !ps.finished) setPracticeStatus(); });

    // initial
    recompile();
    updateTempo();
    setMode(ps.mode);
    if (opts.autostart && ps.mode !== 'practice') setTimeout(() => { if (!tp.playing) startTransport(); }, 50);

    return () => {
      stopTransport();
      clearTimeout(advanceTimer);
      offFrame();
      offMic();
      document.removeEventListener('keydown', onKey);
    };
  }

  App.playerView = playerView;
})();
