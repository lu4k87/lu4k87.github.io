// Bausteine der Raumstationen 01A (ISS) und 01B (Tiangong): Oberflächen mit Struktur (Farbe, Normalen und Rauheit aus
// Canvas), Kleinteile als Instanzen (ein Zeichenaufruf je Form und Material), Gitter, Ausstattung der Module und die
// Besuchsschiffe Sojus, Progress, Dragon, Shenzhou und Tianzhou; Kleinteile für alle Stationen und Teleskope (Luken,
// Prallblenden, Spantringe, Kabelbäume, Stabantennen, Zweibeine, Düsen) und die Membran des JWST-Sonnenschilds. Alles Modell nach Fotos, Maße gerundet (Quellen in
// content.js: esa-soyuz, spacex-dragon, sf101-shenzhou, sf101-tianzhou).
// Oberflächen: Isolierdecken mit Beta-Stoff außen (Kissen, Nähte mit Stichen, Klebeband, Knitter, vergilbte Felder),
// zerknitterte Folie (Facetten → Glitzern im Sonnenlicht), Solarzellen unter Deckglas (jede Zelle leicht verkippt, Felder
// abwechselnd geneigt → fleckiger, streifiger Glanz wie auf Fotos; Entspiegelung als Interferenz über `iridescence`),
// Kapton-Rückseite, Radiatoren mit Rohren, Lack mit Platten und Nieten, gebürstetes Aluminium.
// Muster in Metern: `tubeUV`/`boxUV` skalieren die UV-Koordinaten, damit Felder auf allen Modulen gleich groß sind.

import * as THREE from 'three';
import { mulberry32 } from './astro.js';

// wie stationMat in orbitview.js (durchscheinende Liste nach der fernen Welt, deckt voll); phys = MeshPhysicalMaterial
// für Klarlack, Schimmer und Interferenz
const stationMat = (o, phys) => new (phys ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({ transparent: true, ...o });
const Y = new THREE.Vector3(0, 1, 0);
const ID_Q = new THREE.Quaternion();
const WHITE = new THREE.Color(1, 1, 1);
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Höhenbild (Rotkanal) → Normalenkarte in der Richtung von three.js (Canvas-y nach unten = v nach unten), kachelbar
function normalsFromHeight(hc, k) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h), g = out.getContext('2d'), img = g.createImageData(w, h), d = img.data, s = k / 255;
  for (let y = 0; y < h; y++) {
    const y0 = y * w, ym = ((y + h - 1) % h) * w, yp = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const xm = (x + w - 1) % w, xp = (x + 1) % w;
      const dx = (src[(y0 + xp) * 4] - src[(y0 + xm) * 4]) * s, dy = (src[(yp + x) * 4] - src[(ym + x) * 4]) * s;
      const l = 1 / Math.sqrt(dx * dx + dy * dy + 1), i = (y0 + x) * 4;
      d[i] = (0.5 - 0.5 * dx * l) * 255; d[i + 1] = (0.5 + 0.5 * dy * l) * 255; d[i + 2] = (0.5 + 0.5 * l) * 255; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return out;
}

// Normale als Farbe (für direkt gesetzte Facetten)
const nrm = (nx, ny) => { const l = 1 / Math.hypot(nx, ny, 1); return [(0.5 - 0.5 * nx * l) * 255, (0.5 + 0.5 * ny * l) * 255, (0.5 + 0.5 * l) * 255]; };

// ---------- Muster ----------

// Isolierdecke (MLI) mit Beta-Stoff außen: cols × rows Kissen je Kachel, Nähte mit Stichen, Klebeband auf einigen Nähten,
// Knitter, Befestigungspunkte, einzelne vergilbte Felder (UV-Licht, atomarer Sauerstoff)
function quilt(S, { tone, cols = 4, rows = 4, seed = 1, age = 0.25, tape = 0.25, puff = 1 }) {
  const rnd = mulberry32(seed), u = S / 512;
  const c = canvas(S, S), hc = canvas(S, S), rc = canvas(S, S);
  const g = c.getContext('2d'), h = hc.getContext('2d'), r = rc.getContext('2d');
  // Kissen und Knitter erst ohne Filter zeichnen, dann je einmal weichzeichnen (Filter je Feld kostet ein Vielfaches)
  const pc = canvas(S, S), p = pc.getContext('2d'), wc = canvas(S, S), wr = wc.getContext('2d');
  p.fillStyle = '#1c1c1c'; p.fillRect(0, 0, S, S);
  const cw = S / cols, ch = S / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = i * cw, y = j * ch, k = 0.95 + rnd() * 0.07, old = rnd() < age ? 0.9 : 1;
    g.fillStyle = rgb(tone[0] * k, tone[1] * k, tone[2] * k * old);
    g.fillRect(x, y, cw, ch);
    const v = (120 + rnd() * 70) * puff;
    p.fillStyle = rgb(v, v, v);
    p.fillRect(x + cw * 0.1, y + ch * 0.1, cw * 0.8, ch * 0.8);
    const q = 200 + rnd() * 40;
    r.fillStyle = rgb(q, q, q);
    r.fillRect(x, y, cw, ch);
  }
  h.filter = `blur(${Math.round(Math.min(cw, ch) * 0.13)}px)`;
  h.drawImage(pc, 0, 0);
  // Knitter: weiche Falten als helle und dunkle Doppellinie
  wr.lineWidth = 2 * u;
  for (let n = 0; n < 2 * cols * rows; n++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, L = (18 + rnd() * 50) * u, bend = (rnd() - 0.5) * L * 0.5;
    const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L, mx = (x + ex) / 2 - Math.sin(a) * bend, my = (y + ey) / 2 + Math.cos(a) * bend;
    for (const [col, o] of [['rgba(255,255,255,0.13)', 0], ['rgba(0,0,0,0.13)', 1.6 * u]]) {
      wr.strokeStyle = col;
      wr.beginPath(); wr.moveTo(x - Math.sin(a) * o, y + Math.cos(a) * o); wr.quadraticCurveTo(mx - Math.sin(a) * o, my + Math.cos(a) * o, ex - Math.sin(a) * o, ey + Math.cos(a) * o); wr.stroke();
    }
  }
  h.filter = `blur(${Math.max(1, Math.round(1.4 * u))}px)`;
  h.drawImage(wc, 0, 0);
  h.filter = 'none';
  // Nähte mit Stichen, Klebeband auf einzelnen Nähten, Befestigungspunkte an den Ecken
  const seam = (vert, p) => {
    const R = (a, b, w, l) => (vert ? [p + a, b, w, l] : [b, p + a, l, w]);
    g.fillStyle = 'rgba(70,68,60,0.38)'; g.fillRect(...R(-1 * u, 0, 2 * u, S));
    h.fillStyle = '#000'; h.fillRect(...R(-2.5 * u, 0, 5 * u, S));
    g.fillStyle = 'rgba(60,58,52,0.45)'; h.fillStyle = '#0a0a0a';
    for (let t = 0; t < S; t += 7 * u) for (const o of [-6 * u, 5 * u]) { g.fillRect(...R(o, t, 1.2 * u, 3.5 * u)); h.fillRect(...R(o, t, 1.2 * u, 3.5 * u)); }
    if (rnd() < tape) {
      const t0 = rnd() * S, L = S * (0.3 + rnd() * 0.5);
      for (const t of [t0, t0 - S]) {
        g.fillStyle = 'rgb(198,201,203)'; g.fillRect(...R(-5 * u, t, 10 * u, L));
        h.fillStyle = '#2a2a2a'; h.fillRect(...R(-5 * u, t, 10 * u, L));
        r.fillStyle = 'rgb(96,96,96)'; r.fillRect(...R(-5 * u, t, 10 * u, L));
      }
    }
  };
  for (let i = 0; i < cols; i++) { seam(true, i * cw); if (i === 0) seam(true, S); }
  for (let j = 0; j < rows; j++) { seam(false, j * ch); if (j === 0) seam(false, S); }
  g.fillStyle = 'rgba(40,40,38,0.7)';
  for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) { g.beginPath(); g.arc(i * cw + 9 * u, j * ch + 9 * u, 2.4 * u, 0, Math.PI * 2); g.fill(); }
  return { map: c, normal: normalsFromHeight(hc, 10 * u), rough: rc };
}

// Zerknitterte Folie: Facetten mit eigener Neigung (Voronoi, kachelbar) → Glitzern im Sonnenlicht; Kanten dunkler
function foil(N, { tone, seed = 3, n = 160, tilt = 0.28 }) {
  const rnd = mulberry32(seed);
  const P = Array.from({ length: n }, () => ({ x: rnd() * N, y: rnd() * N, n: nrm((rnd() - 0.5) * 2 * tilt, (rnd() - 0.5) * 2 * tilt), k: 0.86 + rnd() * 0.26, r: 70 + rnd() * 70 }));
  const c = canvas(N, N), nc = canvas(N, N), rc = canvas(N, N);
  const ci = c.getContext('2d').createImageData(N, N), ni = nc.getContext('2d').createImageData(N, N), ri = rc.getContext('2d').createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let d1 = 1e9, d2 = 1e9, best = P[0];
    for (const p of P) {
      let dx = Math.abs(p.x - x), dy = Math.abs(p.y - y);
      if (dx > N / 2) dx = N - dx;
      if (dy > N / 2) dy = N - dy;
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; best = p; } else if (d < d2) d2 = d;
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1) < 1.0 ? 0.8 : 1, i = (y * N + x) * 4;
    ci.data.set([tone[0] * best.k * edge, tone[1] * best.k * edge, tone[2] * best.k * edge, 255], i);
    ni.data.set([...best.n, 255], i);
    ri.data.set([best.r, best.r, best.r, 255], i);
  }
  c.getContext('2d').putImageData(ci, 0, 0); nc.getContext('2d').putImageData(ni, 0, 0); rc.getContext('2d').putImageData(ri, 0, 0);
  return { map: c, normal: nc, rough: rc };
}

// Solarzellen unter Deckglas: nx × ny Zellen je Kachel mit zwei Sammelschienen und feinen Fingern, Faltkante alle `panel`
// Zeilen (Spalt, Kapton); Normalen: jede Zelle leicht verkippt, Felder abwechselnd geneigt
function cells(W, H, { cell, bus = [150, 156, 172], gap = [170, 122, 58], nx = 8, ny = 16, panel = 4, seed = 5, jitter = 0.05, fold = 0.07 }) {
  const rnd = mulberry32(seed), cw = W / nx, ch = H / ny, gh = Math.max(2, ch * 0.14);
  const c = canvas(W, H), nc = canvas(W, H), rc = canvas(W, H);
  const g = c.getContext('2d'), n = nc.getContext('2d'), r = rc.getContext('2d');
  g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
  r.fillStyle = rgb(150, 150, 150); r.fillRect(0, 0, W, H);
  n.fillStyle = rgb(...nrm(0, 0)); n.fillRect(0, 0, W, H);
  for (let j = 0; j < ny; j++) {
    const tiltV = (Math.floor(j / panel) % 2 ? 1 : -1) * fold;
    for (let i = 0; i < nx; i++) {
      const x = i * cw + 0.7, y = j * ch + 0.7, w = cw - 1.4, hh = ch - 1.4, k = 0.86 + rnd() * 0.24;
      const grd = g.createLinearGradient(x, y, x + w, y + hh);
      grd.addColorStop(0, rgb(cell[0] * k * 1.12, cell[1] * k * 1.12, cell[2] * k * 1.1));
      grd.addColorStop(1, rgb(cell[0] * k * 0.88, cell[1] * k * 0.88, cell[2] * k * 0.92));
      g.fillStyle = grd; g.fillRect(x, y, w, hh);
      g.fillStyle = `rgba(${bus[0]},${bus[1]},${bus[2]},0.14)`;
      for (let f = y + 3; f < y + hh; f += 4) g.fillRect(x, f, w, 0.6);
      g.fillStyle = `rgba(${bus[0]},${bus[1]},${bus[2]},0.75)`;
      for (const f of [0.33, 0.67]) g.fillRect(x + w * f, y, Math.max(1, cw * 0.025), hh);
      n.fillStyle = rgb(...nrm((rnd() - 0.5) * 2 * jitter, tiltV + (rnd() - 0.5) * 2 * jitter));
      n.fillRect(x, y, w, hh);
      r.fillStyle = rgb(36 + rnd() * 16, 36 + rnd() * 16, 36);
      r.fillRect(x, y, w, hh);
    }
    if (j % panel === 0) {
      g.fillStyle = rgb(...gap); g.fillRect(0, j * ch - gh / 2, W, gh);
      if (j === 0) g.fillRect(0, H - gh / 2, W, gh);
    }
  }
  return { map: c, normal: nc, rough: rc };
}

// Rückseite der Matten (Kapton, bernsteinfarben) mit geprägtem Raster und Knittern
function kapton(S, { tone = [178, 122, 54], seed = 7 }) {
  const rnd = mulberry32(seed), u = S / 512;
  const c = canvas(S, S), hc = canvas(S, S), g = c.getContext('2d'), h = hc.getContext('2d');
  g.fillStyle = rgb(...tone); g.fillRect(0, 0, S, S);
  h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    const k = 0.85 + rnd() * 0.3;
    g.fillStyle = `rgba(${tone[0] * k | 0},${tone[1] * k | 0},${tone[2] * k | 0},0.35)`;
    g.fillRect(0, rnd() * S, S, (4 + rnd() * 30) * u);
  }
  g.fillStyle = 'rgba(90,60,26,0.35)'; h.fillStyle = '#5a5a5a';
  for (let p = 0; p < S; p += S / 8) { g.fillRect(p, 0, 1.5 * u, S); g.fillRect(0, p, S, 1.5 * u); h.fillRect(p, 0, 2 * u, S); h.fillRect(0, p, S, 2 * u); }
  const wc = canvas(S, S), w = wc.getContext('2d');
  w.lineWidth = 3 * u;
  for (let i = 0; i < 40; i++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, L = (30 + rnd() * 90) * u;
    w.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
    w.beginPath(); w.moveTo(x, y); w.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); w.stroke();
  }
  h.filter = `blur(${Math.max(1, Math.round(2 * u))}px)`; h.drawImage(wc, 0, 0); h.filter = 'none';
  return { map: c, normal: normalsFromHeight(hc, 6 * u) };
}

// Radiatorplatte: weiß, Kühlrohre längs als feine Erhebungen, Rand, leichter Schmutz zum Ende hin
function radiator(W, H, { tone = [236, 238, 236], tubes = 20, seed = 9 }) {
  const rnd = mulberry32(seed), c = canvas(W, H), hc = canvas(W, H), g = c.getContext('2d'), h = hc.getContext('2d');
  g.fillStyle = rgb(...tone); g.fillRect(0, 0, W, H);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, 'rgba(120,110,90,0.0)'); grd.addColorStop(1, 'rgba(120,110,90,0.12)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  h.fillStyle = '#404040'; h.fillRect(0, 0, W, H);
  const step = W / tubes;
  for (let i = 0; i < tubes; i++) {
    const x = (i + 0.5) * step, k = 0.92 + rnd() * 0.06;
    g.fillStyle = `rgba(${150 * k | 0},${154 * k | 0},${160 * k | 0},0.45)`; g.fillRect(x - 0.6, 0, 1.2, H);
    h.fillStyle = '#a0a0a0'; h.fillRect(x - 1.6, 0, 3.2, H); h.fillStyle = '#c8c8c8'; h.fillRect(x - 0.8, 0, 1.6, H);
  }
  g.fillStyle = 'rgba(80,84,90,0.6)'; h.fillStyle = '#000';
  for (const [x, y, w, hh] of [[0, 0, W, 3], [0, H - 3, W, 3], [0, 0, 3, H], [W - 3, 0, 3, H]]) { g.fillRect(x, y, w, hh); h.fillRect(x, y, w, hh); }
  return { map: c, normal: normalsFromHeight(hc, 3) };
}

// Lackierte Hülle: Platten mit leicht verschiedenem Weiß, vertiefte Fugen, Nietreihen, feine Schlieren
function paint(S, { tone, cols = 4, rows = 3, seed = 13, rivets = true }) {
  const rnd = mulberry32(seed), u = S / 512, cw = S / cols, ch = S / rows;
  const c = canvas(S, S), hc = canvas(S, S), rc = canvas(S, S);
  const g = c.getContext('2d'), h = hc.getContext('2d'), r = rc.getContext('2d');
  h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const k = 0.955 + rnd() * 0.06;
    g.fillStyle = rgb(tone[0] * k, tone[1] * k, tone[2] * k); g.fillRect(i * cw, j * ch, cw, ch);
    const q = 110 + rnd() * 50;
    r.fillStyle = rgb(q, q, q); r.fillRect(i * cw, j * ch, cw, ch);
  }
  for (let i = 0; i < 24; i++) {
    g.fillStyle = `rgba(110,104,92,${0.02 + rnd() * 0.04})`;
    g.fillRect(rnd() * S, rnd() * S, (2 + rnd() * 5) * u, (40 + rnd() * 160) * u);
  }
  g.fillStyle = 'rgba(70,72,76,0.55)'; h.fillStyle = '#202020';
  for (let i = 0; i <= cols; i++) { g.fillRect(i * cw - 0.8 * u, 0, 1.6 * u, S); h.fillRect(i * cw - 1.5 * u, 0, 3 * u, S); }
  for (let j = 0; j <= rows; j++) { g.fillRect(0, j * ch - 0.8 * u, S, 1.6 * u); h.fillRect(0, j * ch - 1.5 * u, S, 3 * u); }
  if (rivets) {
    g.fillStyle = 'rgba(120,122,126,0.6)'; h.fillStyle = '#e0e0e0';
    for (let i = 0; i <= cols; i++) for (let t = 6 * u; t < S; t += 12 * u) { g.fillRect(i * cw + 4 * u, t, 1.6 * u, 1.6 * u); h.fillRect(i * cw + 4 * u, t, 1.6 * u, 1.6 * u); }
    for (let j = 0; j <= rows; j++) for (let t = 6 * u; t < S; t += 12 * u) { g.fillRect(t, j * ch + 4 * u, 1.6 * u, 1.6 * u); h.fillRect(t, j * ch + 4 * u, 1.6 * u, 1.6 * u); }
  }
  return { map: c, normal: normalsFromHeight(hc, 5 * u), rough: rc };
}

// Membran des Sonnenschilds (JWST): glatte, aluminisierte Folie mit Gitter aus Nähten (Ripstop, Zellen ≈ 1,2 m, Ösen an
// den Kreuzungen), lange weiche Falten aus der Spannung zwischen den Aufhängepunkten; Glanz streifig entlang der Falten
function membrane(S, { tone = [224, 224, 228], seed = 23, grid = 2 }) {
  const rnd = mulberry32(seed), u = S / 512, cw = S / grid;
  const c = canvas(S, S), hc = canvas(S, S), rc = canvas(S, S);
  const g = c.getContext('2d'), h = hc.getContext('2d'), r = rc.getContext('2d');
  h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
  for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
    const k = 0.985 + rnd() * 0.03;
    g.fillStyle = rgb(tone[0] * k, tone[1] * k, tone[2] * k); g.fillRect(i * cw, j * cw, cw, cw);
    const q = 84 + rnd() * 30;
    r.fillStyle = rgb(q, q, q); r.fillRect(i * cw, j * cw, cw, cw);
  }
  const wc = canvas(S, S), w = wc.getContext('2d');
  w.lineWidth = 3 * u;
  for (let n = 0; n < 14; n++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, L = (120 + rnd() * 300) * u, bend = (rnd() - 0.5) * L * 0.25;
    const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L, mx = (x + ex) / 2 - Math.sin(a) * bend, my = (y + ey) / 2 + Math.cos(a) * bend;
    for (const [col, o] of [['rgba(255,255,255,0.22)', 0], ['rgba(0,0,0,0.22)', 2.5 * u]]) {
      w.strokeStyle = col;
      w.beginPath(); w.moveTo(x - Math.sin(a) * o, y + Math.cos(a) * o); w.quadraticCurveTo(mx - Math.sin(a) * o, my + Math.cos(a) * o, ex - Math.sin(a) * o, ey + Math.cos(a) * o); w.stroke();
    }
  }
  h.filter = `blur(${Math.max(1, Math.round(4 * u))}px)`; h.drawImage(wc, 0, 0); h.filter = 'none';
  // Nähte als Gitter (am Kachelrand dieselbe Naht wie innen → nahtlos gekachelt), Ösen an den Kreuzungen
  g.fillStyle = 'rgba(70,66,74,0.2)'; h.fillStyle = '#6e6e6e'; r.fillStyle = rgb(104, 104, 104);
  for (let i = 0; i <= grid; i++) for (const [x, y, ww, hh] of [[i * cw - 0.8 * u, 0, 1.6 * u, S], [0, i * cw - 0.8 * u, S, 1.6 * u]]) { g.fillRect(x, y, ww, hh); h.fillRect(x, y, ww, hh); r.fillRect(x, y, ww, hh); }
  g.fillStyle = 'rgba(60,58,64,0.4)'; h.fillStyle = '#585858';
  for (let i = 0; i <= grid; i++) for (let j = 0; j <= grid; j++) { g.beginPath(); g.arc(i * cw, j * cw, 2.5 * u, 0, Math.PI * 2); g.fill(); h.beginPath(); h.arc(i * cw, j * cw, 2.5 * u, 0, Math.PI * 2); h.fill(); }
  return { map: c, normal: normalsFromHeight(hc, 5 * u), rough: rc };
}

// Gebürstetes Metall: Rauheit mit feinen Längsstreifen
function brushed(N) {
  const rnd = mulberry32(19), c = canvas(N, N), g = c.getContext('2d');
  g.fillStyle = rgb(104, 104, 104); g.fillRect(0, 0, N, N);
  for (let i = 0; i < 400; i++) { const q = 70 + rnd() * 80; g.fillStyle = `rgba(${q | 0},${q | 0},${q | 0},0.5)`; g.fillRect(0, rnd() * N, N, 0.5 + rnd() * 1.5); }
  return c;
}

// ---------- Baukasten je Station ----------
// ctx.detail (Qualitätsstufe) wählt die Auflösung der Muster (Decken und Lack 512 px je 3-m-Kachel reichen, mehr kostet nur
// Aufbauzeit beim Vorladen); Rauheitskarte nur für die Folie; dispose() gibt nur die Texturen frei (Geometrien und
// Materialien räumt orbitview.js über die Szene ab)
export function stationKit(ctx) {
  const S = (ctx.detail || 1) >= 0.8 ? 1024 : 512;
  const textures = [], jobs = [];
  const tex = (c, srgb, rep) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (rep) t.repeat.set(...rep);
    textures.push(t);
    return t;
  };
  // Muster erst als Platzhalter (gleiche Textur-Objekte → kein neues Übersetzen der Shader), gezeichnet wird in ready()
  // Stück für Stück zwischen den Bildern – ein Block von über 1 s ließe sonst einen Flug hängen
  const blank = (rgba) => { const c = canvas(2, 2), g = c.getContext('2d'); g.fillStyle = rgba; g.fillRect(0, 0, 2, 2); return c; };
  const set = (gen, rep, has = 'nr') => {
    const o = { map: tex(blank('rgb(200,200,200)'), true, rep) };
    if (has.includes('n')) o.normalMap = tex(blank('rgb(128,128,255)'), false, rep);
    if (has.includes('r')) o.roughnessMap = tex(blank('rgb(200,200,200)'), false, rep);
    jobs.push(() => {
      const s = gen();
      for (const [k, c] of [['map', s.map], ['normalMap', s.normal], ['roughnessMap', s.rough]]) if (o[k] && c) { o[k].image = c; o[k].needsUpdate = true; }
    });
    return o;
  };
  // Gemeinsame Muster, Farbe je Material als Tönung: eine Decke, eine Folie, ein Lack, zwei Zellenmuster. Jedes eigene Bild
  // und jede Shader-Variante verlängert das Vorladen – zu lang, und die nächste Station ist beim Abflug noch nicht fertig.
  const sets = {};
  const once = (k, gen, rep, has) => sets[k] || (sets[k] = set(gen, rep, has));
  const QUILT = () => once('quilt', () => quilt(S / 2, { tone: [242, 242, 242], seed: 11, age: 0.3 }), null, 'n');
  const FOIL = () => once('foil', () => foil(256, { tone: [236, 236, 236], seed: 3 }), [2, 2], 'nr');
  const PAINT = () => once('paint', () => paint(S / 2, { tone: [244, 244, 244], seed: 16 }), null, 'n');
  const BLUE = () => once('blue', () => cells(S / 2, S, { cell: [26, 36, 90], seed: 5 }), null, 'n');
  const MEMBRANE = () => once('membrane', () => membrane(S / 2, {}), null, 'nr');
  const DARK = () => once('dark', () => cells(S / 2, S, { cell: [16, 19, 32], bus: [150, 132, 96], gap: [130, 104, 62], nx: 12, ny: 24, panel: 6, seed: 6, fold: 0.03 }), null, 'n');
  const fabric = (color) => stationMat({ ...QUILT(), color, roughness: 0.86, metalness: 0 });
  const film = (color) => stationMat({ ...FOIL(), color, roughness: 1, metalness: 0.9 });
  const lacquer = (color, roughness) => stationMat({ ...PAINT(), color, roughness, metalness: 0.08 });
  // Zellen: Deckglas als Klarlack, Entspiegelung als Dünnschicht-Interferenz (blau-violetter Schimmer am Rand des Glanzes)
  const pv = (src, color, irid) => stationMat({ ...src(), color, roughness: 0.2, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06,
    iridescence: irid, iridescenceIOR: 1.45, iridescenceThicknessRange: [180, 420] }, true);
  const LIB = {
    us: () => fabric(0xf7f4eb), ru: () => fabric(0xe1e5d8), beam: () => fabric(0xfffbf0), green: () => fabric(0x7b8960), grey: () => fabric(0xd6d8d0),
    gold: () => film(0xdcaa50), silver: () => film(0xd3d6db),
    // Sonnenschild-Lagen (JWST): Sonnenseite rosa-silbern (dotiertes Silizium), übrige Lagen Aluminium; beide Seiten sichtbar
    shieldSun: () => stationMat({ ...MEMBRANE(), color: 0xeec3e4, roughness: 1, metalness: 0.78, side: THREE.DoubleSide }),
    shieldBack: () => stationMat({ ...MEMBRANE(), color: 0xd6d9e0, roughness: 1, metalness: 0.78, side: THREE.DoubleSide }),
    cells: () => pv(BLUE, 0xffffff, 0.6), cellsRU: () => pv(BLUE, 0xe4ecff, 0.5),
    irosa: () => pv(DARK, 0xffffff, 0.4), cellsCN: () => pv(DARK, 0xfff2dc, 0.5), cellsDragon: () => pv(DARK, 0xb4b8c4, 0.3),
    back: () => stationMat({ ...set(() => kapton(S / 2, {}), null, 'n'), roughness: 0.42, metalness: 0.35 }),
    rad: () => stationMat({ ...set(() => radiator(S / 8, S / 2, {}), null, 'n'), roughness: 0.5, metalness: 0.02 }),
    paint: () => lacquer(0xffffff, 0.42), hull: () => lacquer(0xeef0ee, 0.55), hull2: () => lacquer(0xdce1e5, 0.55),
    metal: () => stationMat({ color: 0xb6bac0, roughness: 1, roughnessMap: tex(brushed(256), false), metalness: 0.8 }),
    dark: () => stationMat({ color: 0x34373d, roughness: 0.55, metalness: 0.5 }),
    strut: () => stationMat({ color: 0xcdd0d4, roughness: 0.42, metalness: 0.55 }),
    rail: () => stationMat({ color: 0xd9a320, roughness: 0.45, metalness: 0.1 }),
    railGrey: () => stationMat({ color: 0xbfc3c8, roughness: 0.4, metalness: 0.5 }),
    box: () => stationMat({ color: 0xffffff, roughness: 0.62, metalness: 0.08 }),
    glass: () => stationMat({ color: 0x0b0f16, roughness: 0.06, metalness: 0.4 }),
    nozzle: () => stationMat({ color: 0x2c2c2e, roughness: 0.32, metalness: 0.85 }),
  };
  const cache = {};
  const mat = (k) => cache[k] || (cache[k] = LIB[k]());
  // Solarmatte: Zellenseite +x, Rückseite und Kanten Kapton (Reihenfolge der BoxGeometry-Flächen)
  const panelMats = {};
  const panel = (k) => panelMats[k] || (panelMats[k] = [mat(k), mat('back'), mat('back'), mat('back'), mat('back'), mat('back')]);

  const U = {
    rod: new THREE.CylinderGeometry(1, 1, 1, 8, 1, true),    // Stäbe, Griffe
    ring: new THREE.CylinderGeometry(1, 1, 1, 48, 1, true),  // Ringe an Modulen
    disk: new THREE.CylinderGeometry(1, 1, 1, 24, 1),        // Gelenke, Düsen, runde Kästen
    ball: new THREE.SphereGeometry(1, 16, 10),
    box: new THREE.BoxGeometry(1, 1, 1),
    vane: new THREE.RingGeometry(0.72, 1, 48).rotateX(-Math.PI / 2),   // Prallblende: flacher Ring, Normale +y (= Richtung a → b in rod)
    cone: new THREE.CylinderGeometry(0.5, 1, 1, 24, 1),               // Kegelstumpf: Radius r am Anfang a, r/2 am Ende b
  };

  // Sammler für Kleinteile an einem Elternteil: je Form und Material eine InstancedMesh
  function inst(parent) {
    const groups = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), d = new THREE.Vector3();
    const put = (geo, m, col) => {
      const key = `${geo.id}:${[].concat(m).map((x) => x.id).join('-')}`;
      let gr = groups.get(key);
      if (!gr) groups.set(key, (gr = { geo, m, list: [], cols: [] }));
      gr.list.push(m4.clone()); gr.cols.push(col);
    };
    const api = {
      // Stab von a nach b mit Radius r
      rod(a, b, r, m, geo = U.rod, col) {
        d.subVectors(b, a);
        const L = d.length();
        if (L < 1e-4) return api;
        q.setFromUnitVectors(Y, d.divideScalar(L));
        m4.compose(p.addVectors(a, b).multiplyScalar(0.5), q, s.set(r, L, r));
        put(geo, m, col);
        return api;
      },
      box(pos, size, m, quat, col) { m4.compose(pos, quat || ID_Q, s.set(...size)); put(U.box, m, col); return api; },
      ball(pos, r, m, col) { m4.compose(pos, ID_Q, s.set(r, r, r)); put(U.ball, m, col); return api; },
      done() {
        for (const gr of groups.values()) {
          const mesh = new THREE.InstancedMesh(gr.geo, gr.m, gr.list.length);
          gr.list.forEach((x, i) => mesh.setMatrixAt(i, x));
          if (gr.cols.some(Boolean)) gr.cols.forEach((col, i) => mesh.setColorAt(i, col || WHITE));
          mesh.castShadow = mesh.receiveShadow = true;
          mesh.computeBoundingSphere();
          parent.add(mesh);
        }
        groups.clear();
      },
    };
    return api;
  }

  // Gitter als Kasten von a nach b: vier Gurte, Rahmen je Feld, Diagonalen auf allen Seiten (abwechselnde Richtung);
  // side = Richtung der Breite w (senkrecht zur Achse), Höhe h senkrecht zu beiden
  function lattice(I, a, b, { w, h = w, bay, r, m, side }) {
    const ax = b.clone().sub(a), L = ax.length();
    ax.divideScalar(L);
    const e1 = side.clone().addScaledVector(ax, -side.dot(ax)).normalize(), e2 = new THREE.Vector3().crossVectors(ax, e1);
    const n = Math.max(1, Math.round(L / bay)), C = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => e1.clone().multiplyScalar(i * w / 2).addScaledVector(e2, j * h / 2));
    const at = (k, t) => a.clone().addScaledVector(ax, t).add(C[k % 4]);
    for (let k = 0; k < 4; k++) I.rod(at(k, 0), at(k, L), r, m);
    for (let i = 0; i <= n; i++) {
      const t = L * i / n;
      for (let k = 0; k < 4; k++) I.rod(at(k, t), at(k + 1, t), r * 0.7, m);
      if (i < n) for (let k = 0; k < 4; k++) (i + k) % 2 ? I.rod(at(k, t), at(k + 1, t + L / n), r * 0.5, m) : I.rod(at(k + 1, t), at(k, t + L / n), r * 0.5, m);
    }
  }

  // Ausstattung eines Moduls (Achse ax ∈ x|y|z, Mitte c, Radius r, Länge len): Ringe an den Enden, Haltegriffe in
  // `rails` Reihen (Stücke mit Stützen), kleine Geräte (Kameras, Leuchten, Halter) an zufälligen Stellen
  const AXES = { x: [V(1, 0, 0), V(0, 1, 0), V(0, 0, 1)], y: [V(0, 1, 0), V(1, 0, 0), V(0, 0, 1)], z: [V(0, 0, 1), V(1, 0, 0), V(0, 1, 0)] };
  const GEAR = [0xf2f1ec, 0xd8dadc, 0x9a9ea4, 0x45484e].map((x) => new THREE.Color(x));
  function dress(I, ax, c, r, len, { rails = 6, rail = 'rail', ring = 'metal', phase = 0.3, gear = 3, seed = 1, ends = true } = {}) {
    const [A, P1, P2] = AXES[ax], rnd = mulberry32(seed);
    const pt = (t, ang, rr) => c.clone().addScaledVector(A, t).addScaledVector(P1, Math.cos(ang) * rr).addScaledVector(P2, Math.sin(ang) * rr);
    if (ends) for (const s of [-1, 1]) { const t = s * (len / 2 - 0.2); I.rod(pt(t - 0.12, 0, 0), pt(t + 0.12, 0, 0), r + 0.05, mat(ring), U.ring); }
    for (let k = 0; k < rails; k++) {
      const ang = phase + k * 2 * Math.PI / rails;
      for (let t = -len / 2 + 0.7; t < len / 2 - 0.9; t += 1.5) {
        const t1 = Math.min(t + 1.2, len / 2 - 0.6);
        I.rod(pt(t, ang, r + 0.13), pt(t1, ang, r + 0.13), 0.025, mat(rail));
        for (const tt of [t + 0.05, t1 - 0.05]) I.rod(pt(tt, ang, r), pt(tt, ang, r + 0.14), 0.018, mat(rail));
      }
    }
    const q = new THREE.Quaternion(), rad = new THREE.Vector3();
    for (let i = 0; i < gear; i++) {
      const t = (rnd() - 0.5) * (len - 1.6), ang = rnd() * Math.PI * 2, s = [0.35 + rnd() * 0.5, 0.2 + rnd() * 0.35, 0.35 + rnd() * 0.6];
      rad.copy(P1).multiplyScalar(Math.cos(ang)).addScaledVector(P2, Math.sin(ang));
      q.setFromUnitVectors(Y, rad);
      if (rnd() < 0.3) I.box(pt(t, ang, r + s[1] / 2), s, mat('gold'), q);
      else I.box(pt(t, ang, r + s[1] / 2), s, mat('box'), q, GEAR[(rnd() * GEAR.length) | 0]);
    }
  }

  // ---------- Kleinteile (alle als Instanzen über I) ----------
  const qAlong = (d) => new THREE.Quaternion().setFromUnitVectors(Y, d);
  // Luke an einem freien Stutzen: Ring, zurückgesetzte dunkle Scheibe, heller Deckel, Riegel rundum
  function hatch(I, at, dir, r, { ring = 'metal', latches = 8 } = {}) {
    const d = dir.clone().normalize(), p = (t) => at.clone().addScaledVector(d, t);
    I.rod(p(-0.08), p(0.12), r, mat(ring), U.ring).rod(p(-0.06), p(0.0), r * 0.98, mat('dark'), U.disk).rod(p(0.0), p(0.05), r * 0.55, mat('box'), U.disk, GEAR[1]);
    const e1 = (Math.abs(d.y) < 0.9 ? Y.clone() : V(1, 0, 0)).cross(d).normalize(), e2 = d.clone().cross(e1), q = qAlong(d);
    for (let k = 0; k < latches; k++) { const a = k * 2 * Math.PI / latches; I.box(p(0.1).addScaledVector(e1, Math.cos(a) * r * 0.88).addScaledVector(e2, Math.sin(a) * r * 0.88), [0.14, 0.1, 0.14], mat('dark'), q); }
  }
  // Prallblenden innen in einer Röhre: n flache Ringe zwischen t0 und t1 entlang `axis` (Achse zeigt zur Öffnung)
  function vanes(I, c, axis, r, t0, t1, n, m) {
    for (let i = 0; i < n; i++) { const p = c.clone().addScaledVector(axis, t0 + (t1 - t0) * (i + 0.5) / n); I.rod(p, p.clone().addScaledVector(axis, 0.02), r, m, U.vane); }
  }
  // Spantringe außen auf einer Röhre (n Felder → n + 1 Ringe)
  function ribs(I, c, axis, r, t0, t1, n, m, w = 0.12) {
    for (let i = 0; i <= n; i++) { const p = c.clone().addScaledVector(axis, t0 + (t1 - t0) * i / n); I.rod(p.clone().addScaledVector(axis, -w / 2), p.clone().addScaledVector(axis, w / 2), r, m, U.ring); }
  }
  // Kabelbaum entlang Stützpunkten, Schellen an den Knicken
  function harness(I, pts, r, m = mat('dark')) {
    for (let i = 0; i < pts.length - 1; i++) { I.rod(pts[i], pts[i + 1], r, m); if (i) I.ball(pts[i], r * 1.4, mat('metal')); }
  }
  // Stabantenne (niedriger Gewinn) mit Fuß
  function whip(I, at, dir, len, r = 0.012) {
    const d = dir.clone().normalize();
    I.rod(at, at.clone().addScaledVector(d, 0.08), r * 6, mat('dark'), U.disk).rod(at, at.clone().addScaledVector(d, len), r, mat('metal')).ball(at.clone().addScaledVector(d, len), r * 2.2, mat('metal'));
  }
  // Zweibein: zwei Streben von a und b zum Scheitel s mit Gelenk
  function bipod(I, a, b, s, r, m) { I.rod(a, s, r, m).rod(b, s, r, m).ball(s, r * 1.9, mat('dark')); }
  // Düse als Kegel: Austritt `at` (Radius r), Richtung `dir` nach außen, Länge len
  function nozzle(I, at, dir, r, len) { const d = dir.clone().normalize(); I.rod(at, at.clone().addScaledVector(d, -len), r, mat('nozzle'), U.cone); }

  // UV in Metern / Kachel: Zylinder (Mantel 2πr × Länge, Deckel 2r × 2r) und Kasten (je Fläche ihre Maße)
  function tubeUV(geo, r, len, tile) {
    const { radialSegments: n, heightSegments: m } = geo.parameters, uv = geo.attributes.uv, torso = (n + 1) * (m + 1);
    for (let i = 0; i < uv.count; i++) { const [a, b] = i < torso ? [2 * Math.PI * r, len] : [2 * r, 2 * r]; uv.setXY(i, uv.getX(i) * a / tile, uv.getY(i) * b / tile); }
    return geo;
  }
  function boxUV(geo, tu, tv = tu) {
    const { width: w, height: h, depth: d } = geo.parameters, uv = geo.attributes.uv, f = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let i = 0; i < uv.count; i++) { const [a, b] = f[Math.floor(i / 4)]; uv.setXY(i, uv.getX(i) * a / tu, uv.getY(i) * b / tv); }
    return geo;
  }

  // ---------- Besuchsschiffe: Andockpunkt im Ursprung, Schiff entlang +y, Solarflügel entlang ±z ----------
  const mesh = (g, geo, m, y = 0) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const cyl = (g, r0, r1, y0, y1, m, seg = 40) => mesh(g, tubeUV(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1), Math.max(r0, r1), y1 - y0, 2.4), m, (y0 + y1) / 2);
  const lathe = (g, pts, m) => mesh(g, new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 48), m);
  // Flügel aus n Feldern (pw lang, ph hoch) ab Abstand z0, Zellenseite +x, mit Ausleger und Rahmen
  function wings(I, { y, z0, n, pw, ph, gap = 0.08, cellsMat, r0 = 1 }) {
    for (const s of [1, -1]) {
      I.rod(V(0, y, s * r0), V(0, y, s * z0), 0.05, mat('metal'));
      for (let i = 0; i < n; i++) {
        const z = s * (z0 + i * (pw + gap) + pw / 2);
        I.box(V(0, y, z), [0.03, ph, pw], panel(cellsMat));
        for (const dy of [-1, 1]) I.rod(V(0, y + dy * ph / 2, z - pw / 2), V(0, y + dy * ph / 2, z + pw / 2), 0.025, mat('metal'));
      }
    }
  }
  const ship = {
    // Sojus MS (cargo: Progress MS): Orbitalmodul + Landekapsel in grüner Isolierdecke bzw. Fracht- und Tankmodul,
    // Geräte- und Antriebsteil mit Radiator, zwei Flügel je 4 Felder (≈ 7,4 m lang, Ø 2,7 m, 10,6 m Spannweite)
    soyuz({ cargo = false } = {}) {
      const g = new THREE.Group(), I = inst(g);
      I.rod(V(0, -0.12, 0), V(0, 0.25, 0), 0.6, mat('metal'), U.disk).rod(V(0, -0.3, 0), V(0, 0, 0), 0.14, mat('dark'), U.disk);
      if (!cargo) {
        const om = mesh(g, new THREE.SphereGeometry(1.1, 40, 24), mat('green'), 1.45);
        om.scale.set(1, 1.1, 1);
        lathe(g, [[0.05, 2.62], [0.6, 2.65], [0.86, 2.85], [1.0, 3.3], [1.07, 4.0], [1.09, 4.5], [1.0, 4.68], [0.2, 4.72]], mat('green'));
        for (const [a, l] of [[0.6, 1.4], [2.4, 1.1], [4.1, 1.6]]) I.rod(V(Math.cos(a) * 0.9, 1.6, Math.sin(a) * 0.9), V(Math.cos(a) * (0.9 + l), 1.9, Math.sin(a) * (0.9 + l)), 0.02, mat('metal'));
        I.box(V(0.95, 0.9, 0), [0.4, 0.1, 0.4], mat('glass'));
      } else {
        const front = mesh(g, new THREE.SphereGeometry(1.13, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('grey'), 0.55);
        front.scale.y = 0.35;
        cyl(g, 1.13, 1.13, 0.55, 2.95, mat('grey'));
        cyl(g, 1.13, 1.06, 2.95, 4.6, mat('silver'));
        dress(I, 'y', V(0, 1.75, 0), 1.13, 2.4, { rails: 4, rail: 'railGrey', gear: 2, seed: 71, ends: false });
      }
      cyl(g, 1.05, 1.05, 4.7, 4.9, mat('dark'));
      cyl(g, 1.1, 1.1, 4.9, 6.2, mat('rad'));
      cyl(g, 1.1, 1.36, 6.2, 7.1, mat('rad'));
      cyl(g, 0.3, 0.45, 7.1, 7.45, mat('nozzle'), 24);
      wings(I, { y: 6.5, z0: 1.45, n: 4, pw: 0.88, ph: 1.15, cellsMat: 'cellsRU', r0: 1.2 });
      I.done();
      return g;
    },
    // Dragon (Crew bzw. Cargo): Kapsel ≈ 4,2 m, Trunk 3,6 m (halb Solarzellen, halb Radiator) mit vier Flossen, Ø 4 m
    dragon({ crew = true } = {}) {
      const g = new THREE.Group(), I = inst(g);
      I.rod(V(0, 0, 0), V(0, 0.3, 0), 0.8, mat('metal'), U.disk);
      lathe(g, [[0.62, 0.3], [0.8, 0.42], [0.86, 0.62], [1.86, 3.55], [1.98, 3.75], [1.96, 3.95], [1.6, 4.1], [0.3, 4.15]], mat('paint'));
      cyl(g, 1.9, 1.9, 3.95, 4.15, mat('dark'));
      mesh(g, tubeUV(new THREE.CylinderGeometry(1.85, 1.85, 3.6, 40, 1, true, 0, Math.PI), 1.85, 3.6, 2.3), mat('cellsDragon'), 5.95);
      mesh(g, tubeUV(new THREE.CylinderGeometry(1.85, 1.85, 3.6, 40, 1, true, Math.PI, Math.PI), 1.85, 3.6, 1.2), mat('rad'), 5.95);
      cyl(g, 1.84, 1.84, 7.7, 7.74, mat('dark'));
      const q = new THREE.Quaternion();
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
        q.setFromAxisAngle(Y, a);   // lokales z zeigt nach außen
        I.box(V(s * 2.1, 7.25, c * 2.1), [0.06, 1.0, 0.55], mat('paint'), q);
        if (crew) {
          // SuperDraco-Paare (dunkle Gondeln am Kegel, um die Neigung des Kegels gekippt) und Fenster
          const tilt = new THREE.Quaternion().setFromAxisAngle(V(c, 0, -s), 0.33);
          I.box(V(s * 1.48, 2.35, c * 1.48), [0.55, 0.95, 0.12], mat('dark'), tilt.multiply(q));
        }
      }
      if (crew) for (const a of [0.0, Math.PI]) I.box(V(Math.sin(a) * 1.15, 1.45, Math.cos(a) * 1.15), [0.36, 0.3, 0.06], mat('glass'), new THREE.Quaternion().setFromAxisAngle(Y, a));
      I.done();
      return g;
    },
    // Shenzhou: Orbitalmodul, Rückkehrkapsel, Antriebsmodul mit zwei Flügeln je 4 Feldern (9,25 m lang, Ø 2,8 m, 17 m Spannweite)
    shenzhou() {
      const g = new THREE.Group(), I = inst(g);
      I.rod(V(0, 0, 0), V(0, 0.35, 0), 0.72, mat('metal'), U.disk);
      const dome = mesh(g, new THREE.SphereGeometry(1.12, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('grey'), 0.65);
      dome.scale.y = 0.3;
      cyl(g, 1.12, 1.12, 0.65, 2.6, mat('grey'));
      cyl(g, 0.9, 0.9, 2.6, 2.75, mat('dark'));
      lathe(g, [[0.05, 2.75], [0.78, 2.76], [1.05, 3.1], [1.2, 3.9], [1.25, 4.7], [1.15, 4.9], [0.3, 4.95]], mat('hull2'));
      cyl(g, 1.25, 1.25, 4.95, 7.6, mat('rad'));
      cyl(g, 1.25, 1.4, 7.6, 8.5, mat('gold'));
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; I.rod(V(Math.cos(a) * 0.6, 8.5, Math.sin(a) * 0.6), V(Math.cos(a) * 0.6, 8.85, Math.sin(a) * 0.6), 0.2, mat('nozzle'), U.disk); }
      dress(I, 'y', V(0, 1.6, 0), 1.12, 1.9, { rails: 4, rail: 'railGrey', gear: 2, seed: 81, ends: false });
      wings(I, { y: 6.6, z0: 1.5, n: 4, pw: 1.7, ph: 2.0, cellsMat: 'cellsCN', r0: 1.3 });
      I.done();
      return g;
    },
    // Tianzhou: Frachtteil Ø 3,35 m, Antriebsteil, zwei Flügel je 3 Felder (10,6 m lang, 14,9 m Spannweite)
    tianzhou() {
      const g = new THREE.Group(), I = inst(g);
      I.rod(V(0, 0, 0), V(0, 0.35, 0), 0.75, mat('metal'), U.disk);
      cyl(g, 0.85, 1.67, 0.35, 1.45, mat('hull'));
      cyl(g, 1.67, 1.67, 1.45, 6.4, mat('hull'));
      cyl(g, 1.69, 1.69, 6.4, 6.7, mat('gold'));
      cyl(g, 1.67, 1.5, 6.7, 10.3, mat('hull2'));
      cyl(g, 1.3, 1.3, 10.3, 10.45, mat('dark'));
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; I.rod(V(Math.cos(a) * 0.7, 10.45, Math.sin(a) * 0.7), V(Math.cos(a) * 0.7, 10.75, Math.sin(a) * 0.7), 0.22, mat('nozzle'), U.disk); }
      dress(I, 'y', V(0, 3.9, 0), 1.67, 4.9, { rails: 6, rail: 'railGrey', gear: 4, seed: 91, ends: false });
      wings(I, { y: 8.6, z0: 1.75, n: 3, pw: 1.85, ph: 2.3, cellsMat: 'cellsCN', r0: 1.6 });
      I.done();
      return g;
    },
  };
  // Schiff an einen Hafen: Andockpunkt `at`, Richtung `dir` vom Hafen weg (für ±x/±y bleiben die Flügel entlang ±z)
  function dock(parent, g, at, dir) {
    g.position.copy(at);
    g.quaternion.setFromUnitVectors(Y, dir.clone().normalize());
    parent.add(g);
    return g;
  }

  // Muster zeichnen, je eines pro Aufgabe (dazwischen darf der Browser Bilder zeigen); die Station gibt das als ready weiter
  async function ready() {
    while (jobs.length) { jobs.shift()(); await new Promise((r) => setTimeout(r, 0)); }
  }
  return { S, U, mat, panel, inst, lattice, dress, hatch, vanes, ribs, harness, whip, bipod, nozzle, tubeUV, boxUV, ship, dock, ready, dispose() { jobs.length = 0; textures.forEach((t) => t.dispose()); } };
}
