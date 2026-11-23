/* FretCoach — audio: plucked-string synth, strums, metronome, microphone analysis loop. */
(function (root) {
  'use strict';
  const GT = (root.GT = root.GT || {});

  let ctx = null;
  let master = null;
  let guitarBus = null;
  let clickBus = null;
  const bufferCache = new Map();

  function ensureContext() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      guitarBus = ctx.createGain();
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 5200;
      const body = ctx.createBiquadFilter();
      body.type = 'peaking';
      body.frequency.value = 180;
      body.gain.value = 4;
      body.Q.value = 1.1;
      guitarBus.connect(body).connect(tone).connect(master);
      clickBus = ctx.createGain();
      clickBus.connect(master);
      applyVolumes();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const volumes = { guitar: 0.8, click: 0.6 };
  function setVolume(kind, v) { volumes[kind] = v; applyVolumes(); }
  function applyVolumes() {
    if (!ctx) return;
    guitarBus.gain.value = volumes.guitar;
    clickBus.gain.value = volumes.click;
  }

  /** Karplus–Strong plucked string rendered once per pitch and cached. */
  function pluckBuffer(midi) {
    const key = Math.round(midi * 100);
    if (bufferCache.has(key)) return bufferCache.get(key);
    const sr = ctx.sampleRate;
    const freq = GT.midiToFreq(midi);
    const dur = Math.min(4, 2 + (64 - midi) * 0.05);
    const len = Math.floor(sr * dur);
    const N = Math.max(2, Math.round(sr / freq - 0.5));
    const buf = new Float32Array(N);
    let seed = (key * 2654435761) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    for (let i = 0; i < N; i++) buf[i] = rnd();
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < N; i++) buf[i] = 0.5 * (buf[i] + buf[i - 1]);
    // pick position comb: removes harmonics that have a node at the pluck point
    const pick = Math.max(1, Math.round(N * 0.13));
    const shaped = new Float32Array(N);
    for (let i = 0; i < N; i++) shaped[i] = buf[i] - 0.7 * buf[(i + N - pick) % N];
    const T60 = 2.4 + (64 - midi) * 0.06;
    const decay = Math.pow(0.001, 1 / (freq * T60));
    const audio = ctx.createBuffer(1, len, sr);
    const out = audio.getChannelData(0);
    let idx = 0;
    let peak = 0;
    for (let i = 0; i < len; i++) {
      const cur = shaped[idx];
      const nxt = shaped[(idx + 1) % N];
      out[i] = cur;
      shaped[idx] = decay * 0.5 * (cur + nxt);
      idx = (idx + 1) % N;
      const a = Math.abs(cur);
      if (a > peak) peak = a;
    }
    const norm = peak > 0 ? 0.6 / peak : 1;
    const fadeLen = Math.floor(sr * 0.05);
    for (let i = 0; i < len; i++) {
      out[i] *= norm;
      if (i > len - fadeLen) out[i] *= (len - i) / fadeLen;
    }
    // integer delay line -> correct the pitch with playbackRate
    const produced = sr / (N + 0.5);
    const entry = { buffer: audio, rate: freq / produced };
    bufferCache.set(key, entry);
    return entry;
  }

  const active = new Set();
  function pluck(midi, when, gain, duration) {
    ensureContext();
    const t = Math.max(when || 0, ctx.currentTime);
    const { buffer, rate } = pluckBuffer(midi);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain == null ? 0.5 : gain;
    src.connect(g).connect(guitarBus);
    src.start(t);
    if (duration) {
      g.gain.setValueAtTime(g.gain.value, t + duration);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.12);
      src.stop(t + duration + 0.15);
    }
    active.add(src);
    src.onended = () => active.delete(src);
    return src;
  }

  /** Strum a list of midi notes (low → high). dir 'D' or 'U'. */
  function strum(notes, when, dir, opts) {
    ensureContext();
    const t = Math.max(when || 0, ctx.currentTime);
    const list = dir === 'U' ? notes.slice().reverse().slice(0, Math.min(notes.length, 4)) : notes.slice();
    const spread = (opts && opts.spread) || (dir === 'U' ? 0.009 : 0.014);
    const base = (opts && opts.gain) || (dir === 'U' ? 0.26 : 0.34);
    const dur = opts && opts.duration;
    list.forEach((m, i) => pluck(m, t + i * spread, base * (0.85 + 0.3 * Math.random()), dur));
  }

  function stopAll() {
    active.forEach((s) => { try { s.stop(); } catch (e) { /* already stopped */ } });
    active.clear();
  }

  function click(when, accent) {
    ensureContext();
    const t = Math.max(when || 0, ctx.currentTime);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.22, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    osc.connect(g).connect(clickBus);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  // ------------------------------------------------------------- microphone
  const mic = {
    stream: null, source: null, timeAnalyser: null, freqAnalyser: null, inputGain: null,
    running: false, listeners: new Set(), deviceId: null, gain: 1, gate: 0.012,
    timeBuf: null, freqBuf: null, onset: null, raf: 0, lastFrame: null, error: null,
    ignoreUntil: 0, levelPeak: 0, noiseFloor: 0.002,
  };

  async function startMic(deviceId) {
    ensureContext();
    if (mic.running && (!deviceId || deviceId === mic.deviceId)) return true;
    stopMic();
    const constraints = {
      audio: {
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    };
    try {
      mic.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      mic.error = err;
      throw err;
    }
    mic.error = null;
    mic.deviceId = deviceId || null;
    mic.source = ctx.createMediaStreamSource(mic.stream);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 65;
    mic.inputGain = ctx.createGain();
    mic.inputGain.gain.value = mic.gain;
    mic.timeAnalyser = ctx.createAnalyser();
    mic.timeAnalyser.fftSize = 2048;
    mic.freqAnalyser = ctx.createAnalyser();
    mic.freqAnalyser.fftSize = 16384;
    mic.freqAnalyser.smoothingTimeConstant = 0.35;
    mic.freqAnalyser.minDecibels = -110;
    mic.freqAnalyser.maxDecibels = -10;
    mic.source.connect(hp).connect(mic.inputGain);
    mic.inputGain.connect(mic.timeAnalyser);
    mic.inputGain.connect(mic.freqAnalyser);
    mic.timeBuf = new Float32Array(mic.timeAnalyser.fftSize);
    mic.freqBuf = new Float32Array(mic.freqAnalyser.frequencyBinCount);
    mic.onset = GT.createOnsetDetector();
    mic.running = true;
    loop();
    return true;
  }

  function stopMic() {
    mic.running = false;
    cancelAnimationFrame(mic.raf);
    clearTimeout(mic.raf);
    if (mic.stream) mic.stream.getTracks().forEach((t) => t.stop());
    if (mic.source) mic.source.disconnect();
    mic.stream = null;
    mic.source = null;
  }

  function setMicGain(g) { mic.gain = g; if (mic.inputGain) mic.inputGain.gain.value = g; }
  function setGate(g) { mic.gate = g; }

  function loop() {
    if (!mic.running) return;
    const sr = ctx.sampleRate;
    mic.timeAnalyser.getFloatTimeDomainData(mic.timeBuf);
    const level = GT.rms(mic.timeBuf);
    const t = ctx.currentTime;
    // track the quiet-room level so the gate can adapt to it
    if (level < mic.noiseFloor * 3) mic.noiseFloor = mic.noiseFloor * 0.995 + level * 0.005;
    const gate = Math.max(mic.gate, mic.noiseFloor * 2.5);
    const onset = mic.onset(level, t, gate);
    mic.levelPeak = Math.max(level, mic.levelPeak * 0.96);
    let pitch = null;
    if (level > gate * 0.6) {
      pitch = GT.detectPitch(mic.timeBuf, sr);
      if (pitch) pitch.midi = GT.freqToMidi(pitch.freq);
    }
    let chroma = null;
    let tuning = 0;
    if (level > gate * 0.5) {
      mic.freqAnalyser.getFloatFrequencyData(mic.freqBuf);
      const res = GT.chromaFromSpectrum(mic.freqBuf, sr, mic.freqAnalyser.fftSize);
      chroma = res.chroma;
      tuning = res.tuning;
    }
    const frame = { time: t, level, gate, onset, pitch, chroma, tuning, ignored: t < mic.ignoreUntil };
    mic.lastFrame = frame;
    mic.listeners.forEach((fn) => { try { fn(frame); } catch (e) { console.error(e); } });
    if (document.hidden) mic.raf = setTimeout(loop, 50);
    else mic.raf = requestAnimationFrame(loop);
  }

  function onFrame(fn) { mic.listeners.add(fn); return () => mic.listeners.delete(fn); }
  /** Ignore what the mic hears for a while (e.g. while our own reference sound plays). */
  function ignoreMic(seconds) { if (ctx) mic.ignoreUntil = Math.max(mic.ignoreUntil, ctx.currentTime + seconds); }

  async function listInputs() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
    const devs = await navigator.mediaDevices.enumerateDevices();
    return devs.filter((d) => d.kind === 'audioinput');
  }

  GT.audio = {
    ensureContext, pluck, strum, stopAll, click, now, setVolume,
    startMic, stopMic, onFrame, setMicGain, setGate, ignoreMic, listInputs, mic,
    get ctx() { return ctx; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
