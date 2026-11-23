/* FretCoach — SVG renderers: realistic fretboard, chord box, fretting-hand legend, tab strip. */
(function (root) {
  'use strict';
  const GT = (root.GT = root.GT || {});
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dist = (n) => 1 - Math.pow(2, -n / 12);
  const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

  /**
   * Horizontal fretboard.
   * opts: { frets, fingers, notes:[{string,fret,finger,label,cls}], ghost:[{string,fret,label}], from, to,
   *         view:'player'|'tab', leftHanded, labels:'finger'|'note', capo, warn:[stringIdx], compact }
   */
  function fretboard(opts) {
    const o = Object.assign({ from: 0, to: 5, view: 'player', labels: 'finger', capo: 0 }, opts || {});
    const W = 960, H = o.compact ? 210 : 250;
    const padL = 70, markerX = 96, nutX = 122, endX = W - 18;
    const top = 30, bottom = H - 42;
    const lefty = !!o.leftHanded;
    const X = (x) => (lefty ? W - x : x);
    const sY = (idx) => {
      const order = o.view === 'tab' ? 5 - idx : idx;
      return top + (order * (bottom - top)) / 5;
    };
    const from = Math.max(0, o.from), to = Math.max(from + 3, o.to);
    const fx = (n) => nutX + ((dist(n) - dist(from)) / (dist(to) - dist(from))) * (endX - nutX);
    const spotX = (fret) => fx(fret - 1) + (fx(fret) - fx(fret - 1)) * 0.58;
    const parts = [];
    parts.push(`<svg class="fb" viewBox="0 0 ${W} ${H}" role="img" aria-label="Guitar fretboard">`);
    parts.push(`<defs>
      <linearGradient id="fbWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2418"/><stop offset=".5" stop-color="#4a2e1e"/><stop offset="1" stop-color="#321e14"/></linearGradient>
      <linearGradient id="fbFret" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d8f93"/><stop offset=".5" stop-color="#eceef0"/><stop offset="1" stop-color="#8d8f93"/></linearGradient>
      <linearGradient id="fbWound" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3d9a4"/><stop offset=".5" stop-color="#c9a063"/><stop offset="1" stop-color="#7d5e31"/></linearGradient>
      <linearGradient id="fbPlain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c8ccd2"/><stop offset="1" stop-color="#7c8189"/></linearGradient>
      <filter id="fbShadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".45"/></filter>
    </defs>`);
    // wood
    const woodX1 = X(from === 0 ? nutX : nutX - 8), woodX2 = X(endX + 10);
    parts.push(`<rect x="${Math.min(woodX1, woodX2)}" y="${top - 16}" width="${Math.abs(woodX2 - woodX1)}" height="${bottom - top + 32}" rx="4" fill="url(#fbWood)"/>`);
    // inlays
    for (let n = Math.max(1, from + 1); n <= to; n++) {
      const cx = X((fx(n - 1) + fx(n)) / 2);
      const mid = (top + bottom) / 2;
      if (INLAYS.includes(n)) parts.push(`<circle cx="${cx}" cy="${mid}" r="7" class="fb-inlay"/>`);
      if (n === 12 || n === 24) {
        parts.push(`<circle cx="${cx}" cy="${top + (bottom - top) * 0.3}" r="7" class="fb-inlay"/><circle cx="${cx}" cy="${top + (bottom - top) * 0.7}" r="7" class="fb-inlay"/>`);
      }
    }
    // frets
    for (let n = from; n <= to; n++) {
      const x = X(fx(n));
      if (n === 0) {
        const nutColor = o.capo ? 'fb-capo' : 'fb-nut';
        parts.push(`<rect x="${x - 6}" y="${top - 16}" width="12" height="${bottom - top + 32}" rx="2" class="${nutColor}"/>`);
      } else {
        parts.push(`<rect x="${x - 2}" y="${top - 16}" width="4" height="${bottom - top + 32}" fill="url(#fbFret)"/>`);
      }
      // fret numbers
      if (n > 0) parts.push(`<text x="${X((fx(n - 1) + fx(n)) / 2)}" y="${H - 12}" class="fb-num" text-anchor="middle">${n}</text>`);
    }
    if (o.capo) {
      parts.push(`<text x="${X(fx(0))}" y="${top - 20}" class="fb-capo-label" text-anchor="middle">CAPO ${o.capo}</text>`);
    }
    // strings
    const warn = new Set(o.warn || []);
    for (let s = 0; s < 6; s++) {
      const y = sY(s);
      const thick = [3.6, 3.0, 2.5, 2.0, 1.5, 1.15][s];
      const x1 = X(from === 0 ? fx(0) : nutX - 8), x2 = X(endX + 10);
      parts.push(`<rect x="${Math.min(x1, x2)}" y="${y - thick / 2}" width="${Math.abs(x2 - x1)}" height="${thick}" fill="${s < 4 ? 'url(#fbWound)' : 'url(#fbPlain)'}" class="fb-string${warn.has(s) ? ' warn' : ''}"/>`);
      // labels
      const lx = X(padL - 34);
      parts.push(`<text x="${lx}" y="${y + 5}" class="fb-sname" text-anchor="middle">${esc(GT.STRING_NAMES[s])}</text>`);
      parts.push(`<text x="${X(padL - 12)}" y="${y + 4}" class="fb-snum" text-anchor="middle">${6 - s}</text>`);
    }
    // open / muted markers + dots
    const dotR = o.compact ? 14 : 16;
    if (o.frets) {
      const barres = GT.voicing && o.fingers ? findBarres(o.frets, o.fingers) : [];
      barres.forEach((b) => {
        const x = X(spotX(b.fret));
        const y1 = Math.min(sY(b.from), sY(b.to)), y2 = Math.max(sY(b.from), sY(b.to));
        parts.push(`<rect x="${x - dotR}" y="${y1 - dotR}" width="${dotR * 2}" height="${y2 - y1 + dotR * 2}" rx="${dotR}" class="fb-dot f${b.finger}" filter="url(#fbShadow)"/>`);
      });
      o.frets.forEach((f, s) => {
        const y = sY(s);
        if (f < 0) {
          parts.push(`<g class="fb-mute"><path d="M${X(markerX) - 8} ${y - 8} l16 16 M${X(markerX) + 8} ${y - 8} l-16 16"/></g>`);
        } else if (f === 0) {
          parts.push(`<circle cx="${X(markerX)}" cy="${y}" r="9" class="fb-open"/>`);
        } else if (f >= from && f <= to) {
          const fg = o.fingers ? o.fingers[s] : 0;
          const inBarre = barres.some((b) => b.finger === fg && b.fret === f && s >= b.from && s <= b.to);
          const label = o.labels === 'note' ? GT.midiName(GT.TUNING[s] + f + (o.capo || 0)) : fg || '';
          if (!inBarre) parts.push(`<circle cx="${X(spotX(f))}" cy="${y}" r="${dotR}" class="fb-dot f${fg || 0}" filter="url(#fbShadow)"/>`);
          parts.push(`<text x="${X(spotX(f))}" y="${y + 6}" class="fb-dot-label" text-anchor="middle">${esc(label)}</text>`);
        }
      });
    }
    (o.ghost || []).forEach((g) => {
      if (g.fret === 0) {
        parts.push(`<circle cx="${X(markerX)}" cy="${sY(g.string)}" r="9" class="fb-ghost-open"/>`);
        return;
      }
      if (g.fret < from || g.fret > to) return;
      parts.push(`<circle cx="${X(spotX(g.fret))}" cy="${sY(g.string)}" r="${dotR - 3}" class="fb-ghost"/>`);
      if (g.label) parts.push(`<text x="${X(spotX(g.fret))}" y="${sY(g.string) + 5}" class="fb-ghost-label" text-anchor="middle">${esc(g.label)}</text>`);
    });
    (o.notes || []).forEach((nt) => {
      const y = sY(nt.string);
      if (nt.fret === 0) {
        parts.push(`<circle cx="${X(markerX)}" cy="${y}" r="13" class="fb-open-target ${nt.cls || ''}"/>`);
        parts.push(`<text x="${X(markerX)}" y="${y + 5}" class="fb-open-label" text-anchor="middle">${esc(nt.label || '0')}</text>`);
        return;
      }
      if (nt.fret < from || nt.fret > to) return;
      const label = o.labels === 'note' ? GT.midiName(GT.TUNING[nt.string] + nt.fret) : nt.label != null ? nt.label : nt.finger || '';
      parts.push(`<circle cx="${X(spotX(nt.fret))}" cy="${y}" r="${dotR}" class="fb-dot f${nt.finger || 0} ${nt.cls || ''}" filter="url(#fbShadow)"/>`);
      parts.push(`<text x="${X(spotX(nt.fret))}" y="${y + 6}" class="fb-dot-label" text-anchor="middle">${esc(label)}</text>`);
    });
    parts.push('</svg>');
    return parts.join('');
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

  /** Fret window that fits a voicing. */
  function windowFor(frets, minSpan) {
    const span = minSpan || 5;
    const fretted = frets.filter((f) => f > 0);
    const max = fretted.length ? Math.max(...fretted) : 0;
    const min = fretted.length ? Math.min(...fretted) : 0;
    if (max <= span) return { from: 0, to: span };
    return { from: Math.max(0, min - 1), to: Math.max(min - 1 + span, max) };
  }

  /** Classic vertical chord diagram. */
  function chordBox(v, opts) {
    const o = Object.assign({ size: 1, leftHanded: false, showName: false }, opts || {});
    const W = 150, H = o.showName ? 196 : 172;
    const offY = o.showName ? 26 : 0;
    const left = 26, right = W - 18, top = 34 + offY, rows = 5;
    const lefty = o.leftHanded;
    const sx = (s) => left + (s * (right - left)) / 5;
    const fretted = v.frets.filter((f) => f > 0);
    const maxF = fretted.length ? Math.max(...fretted) : 0;
    const minF = fretted.length ? Math.min(...fretted) : 0;
    const base = maxF <= 5 ? 1 : minF;
    const rowH = 24;
    const bottom = top + rows * rowH;
    const mirror = (x) => (lefty ? left + right - x : x);
    const p = [`<svg class="cbox" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(v.name)} chord diagram">`];
    if (o.showName) p.push(`<text x="${W / 2}" y="20" class="cbox-name" text-anchor="middle">${esc(v.name)}</text>`);
    for (let r = 0; r <= rows; r++) {
      const y = top + r * rowH;
      if (r === 0 && base === 1) p.push(`<rect x="${left - 1}" y="${y - 4}" width="${right - left + 2}" height="6" class="cbox-nut"/>`);
      else p.push(`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="cbox-fret"/>`);
    }
    for (let s = 0; s < 6; s++) {
      const x = mirror(sx(s));
      p.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" class="cbox-string" style="stroke-width:${[2.2, 1.9, 1.6, 1.4, 1.1, 1][s]}"/>`);
      const f = v.frets[s];
      if (f < 0) p.push(`<text x="${x}" y="${top - 10}" class="cbox-x" text-anchor="middle">×</text>`);
      else if (f === 0) p.push(`<circle cx="${x}" cy="${top - 15}" r="5" class="cbox-o"/>`);
    }
    if (base > 1) p.push(`<text x="${left - 9}" y="${top + rowH * 0.5 + 5}" class="cbox-base" text-anchor="end">${base}</text>`);
    const barres = findBarres(v.frets, v.fingers);
    barres.forEach((b) => {
      const y = top + (b.fret - base + 0.5) * rowH;
      const x1 = mirror(sx(b.from)), x2 = mirror(sx(b.to));
      p.push(`<rect x="${Math.min(x1, x2) - 9}" y="${y - 9}" width="${Math.abs(x2 - x1) + 18}" height="18" rx="9" class="fb-dot f${b.finger}"/>`);
    });
    v.frets.forEach((f, s) => {
      if (f <= 0) return;
      const fg = v.fingers[s];
      const y = top + (f - base + 0.5) * rowH;
      const x = mirror(sx(s));
      const inBarre = barres.some((b) => b.finger === fg && b.fret === f && s >= b.from && s <= b.to);
      if (!inBarre || s === barres.find((b) => b.finger === fg).from) {
        if (!inBarre) p.push(`<circle cx="${x}" cy="${y}" r="9" class="fb-dot f${fg}"/>`);
        p.push(`<text x="${x}" y="${y + 4}" class="cbox-label" text-anchor="middle">${fg || ''}</text>`);
      }
    });
    p.push(`</svg>`);
    return p.join('');
  }

  /** Left (fretting) hand, palm towards you, fingers numbered as in the diagrams. */
  function hand(opts) {
    const o = Object.assign({ leftHanded: false, active: [] }, opts || {});
    const W = 200, H = 200;
    const mirror = (x) => (o.leftHanded ? W - x : x);
    const active = new Set(o.active);
    const fingers = [
      { n: 1, x: 70, h: 92 }, { n: 2, x: 102, h: 104 }, { n: 3, x: 134, h: 96 }, { n: 4, x: 164, h: 74 },
    ];
    const p = [`<svg class="hand" viewBox="0 0 ${W} ${H}" role="img" aria-label="Finger numbers: 1 index, 2 middle, 3 ring, 4 pinky, T thumb">`];
    p.push(`<path class="hand-skin" d="M${mirror(54)} 118 Q${mirror(52)} 196 ${mirror(112)} 196 Q${mirror(176)} 196 ${mirror(180)} 120 L${mirror(180)} 108 L${mirror(54)} 108 Z"/>`);
    fingers.forEach((f) => {
      const cx = mirror(f.x);
      const topY = 118 - f.h;
      p.push(`<rect x="${cx - 14}" y="${topY}" width="28" height="${f.h + 14}" rx="14" class="hand-skin"/>`);
      p.push(`<circle cx="${cx}" cy="${topY + 15}" r="12" class="fb-dot f${f.n}${active.size && !active.has(f.n) ? ' dim' : ''}"/>`);
      p.push(`<text x="${cx}" y="${topY + 20}" class="hand-num" text-anchor="middle">${f.n}</text>`);
    });
    const tx = mirror(40);
    p.push(`<g transform="rotate(${o.leftHanded ? 38 : -38} ${tx} 150)"><rect x="${tx - 14}" y="86" width="28" height="78" rx="14" class="hand-skin"/><circle cx="${tx}" cy="101" r="11" class="hand-thumb"/><text x="${tx}" y="106" class="hand-num thumb" text-anchor="middle">T</text></g>`);
    p.push(`</svg>`);
    return p.join('');
  }

  /** Horizontal tab strip. notes: [{string, fret}] ; current index highlighted. Always high e on top (standard tab). */
  function tab(notes, current, opts) {
    const o = Object.assign({ colW: 46 }, opts || {});
    const top = 18, gap = 18, left = 34;
    const W = left + Math.max(notes.length, 1) * o.colW + 30;
    const H = top + gap * 5 + 22;
    const y = (s) => top + (5 - s) * gap;
    const p = [`<svg class="tab" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tablature">`];
    for (let s = 0; s < 6; s++) {
      p.push(`<line x1="${left - 6}" y1="${y(s)}" x2="${W - 10}" y2="${y(s)}" class="tab-line"/>`);
      p.push(`<text x="10" y="${y(s) + 4}" class="tab-sname">${GT.STRING_NAMES[s]}</text>`);
    }
    notes.forEach((n, i) => {
      if (n.bar) {
        const bx = left + i * o.colW - 4;
        p.push(`<line x1="${bx}" y1="${y(5)}" x2="${bx}" y2="${y(0)}" class="tab-bar"/>`);
      }
      const x = left + i * o.colW + o.colW / 2;
      const cls = i === current ? 'tab-note now' : i < current ? 'tab-note done' : 'tab-note';
      const label = String(n.fret);
      p.push(`<rect x="${x - 11}" y="${y(n.string) - 10}" width="22" height="20" rx="5" class="${cls}-bg"/>`);
      p.push(`<text x="${x}" y="${y(n.string) + 5}" class="${cls}" text-anchor="middle">${label}</text>`);
    });
    p.push('</svg>');
    return { svg: p.join(''), colX: (i) => left + i * o.colW + o.colW / 2 };
  }

  GT.draw = { fretboard, chordBox, hand, tab, windowFor, esc };
})(typeof window !== 'undefined' ? window : globalThis);
