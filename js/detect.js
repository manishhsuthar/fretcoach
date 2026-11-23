/* FretCoach — signal analysis: pitch (YIN), chroma from spectrum, chord matching, onsets. Pure functions. */
(function (root) {
  'use strict';
  const GT = (root.GT = root.GT || {});

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

  Object.assign(GT, { detectPitch, rms });
})(typeof window !== 'undefined' ? window : globalThis);
