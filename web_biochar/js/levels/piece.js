// Ebene 1: ein Stück Buchen-Pflanzenkohle (Einheit cm). Prozedurale Texturen: Jahrringe, Strahlen, Gefäße in echter
// Größe (Ø 15–24 µm), Faserriefen; Relief als Normal-Map (Sobel) und als Verschiebung im feinen Netz.
// Form: längs gespaltener Splitter mit zerfasertem Bruchende. Schwundrisse (Würfelmuster als Geometrie, Risslinien als
// eigene Textur) sind im Holz geschlossen und öffnen sich mit der Schwindung (Morph-Ziel + uCrack, setParam 'temp').

import * as THREE from 'three';
import { mulberry32, fbm3, smoothstep, clamp, lerp, vnoisef, hash33 } from '../util.js';
import { disposeGroup } from '../walls.js';
import { groundTextures, makeGround, LUMP_R } from './ground.js';
import { pyroState, glowColor } from '../science.js';

const W = 4.4, H = 2.4, D = 2.2;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const END_UM_PER_PX = (2.3e4 / 2048);      // Stirnfläche ≈ 2,3 cm auf 2048 px → ≈ 11 µm je Pixel
const VESSELS_PER_MM2 = 120;               // Modell: Größenordnung für zerstreutporige Buche (docs/research.md)

// schnelles 2D-Wertrauschen auf einem Zufallsgitter
function noise2(rand) {
  const S = 256, g = new Float32Array(S * S);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = g[(ix & 255) + (iy & 255) * S], b = g[((ix + 1) & 255) + (iy & 255) * S];
    const c = g[(ix & 255) + ((iy + 1) & 255) * S], d = g[((ix + 1) & 255) + ((iy + 1) & 255) * S];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Riss als gezackte Linie; zeichnet weiß in die Riss-Maske (eigene Textur, der Shader blendet sie mit uCrack ein)
function crackPath(points, widthAt, ...ctxs) {
  for (const [ctx, style] of ctxs) {
    ctx.fillStyle = style;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      const w = widthAt(i / points.length);
      const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1;
      ctx.beginPath();
      ctx.moveTo(x0 + nx / l * w, y0 + ny / l * w);
      ctx.lineTo(x1 + nx / l * w, y1 + ny / l * w);
      ctx.lineTo(x1 - nx / l * w, y1 - ny / l * w);
      ctx.lineTo(x0 - nx / l * w, y0 - ny / l * w);
      ctx.fill();
    }
  }
}

// Loch mit Kantenglättung direkt in die Pixel schreiben (schneller als 60 000 Pfade): dunkel, tief, rau
function stampPore(col, rel, N, NH, cx, cy, rx, ry, depth) {
  const x0 = Math.max(0, Math.floor(cx - rx - 1)), x1 = Math.min(N - 1, Math.ceil(cx + rx + 1));
  const y0 = Math.max(0, Math.floor(cy - ry - 1)), y1 = Math.min(NH - 1, Math.ceil(cy + ry + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy) * Math.min(rx, ry);
      const cov = clamp(Math.min(rx, ry) + 0.5 - d, 0, 1);
      if (cov <= 0) continue;
      const i = (y * N + x) * 4;
      const k = 1 - 0.88 * cov;
      col[i] *= k; col[i + 1] *= k; col[i + 2] *= k;
      rel[i] = rel[i] * (1 - cov * depth) + 18 * cov * depth;
      rel[i + 1] = Math.min(255, rel[i + 1] + 40 * cov);
    }
  }
}

function endGrainTextures(rand) {
  const N = 2048;
  const n = noise2(rand);
  const col = canvas(N, N), rb = canvas(N, N), ck = canvas(N / 2, N / 2);
  const cc = col.getContext('2d'), rc = rb.getContext('2d', { willReadFrequently: true });
  const kc = ck.getContext('2d', { willReadFrequently: true });
  kc.scale(0.5, 0.5);                  // Riss-Maske in halber Auflösung, gleiche Koordinaten wie Farbe/Relief
  const img = cc.createImageData(N, N), rimg = rc.createImageData(N, N);
  const pith = [-0.6 * N, 1.4 * N];    // Mark liegt außerhalb des Stücks
  const ringW = 0.115 * N;             // Jahrring ≈ 2,6 mm
  const phaseAt = (x, y) => (((Math.hypot(x - pith[0], y - pith[1]) + 20 * n(x * 0.006, y * 0.006)) / ringW) % 1);
  const cd = img.data, rd = rimg.data;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const ph = phaseAt(x, y);
      const late = smoothstep(0.55, 0.96, ph);
      const grain = n(x * 0.22, y * 0.22) * 0.6 + n(x * 0.9, y * 0.9) * 0.4;
      let v = 31 - 8 * late + 11 * (grain - 0.5);
      if (ph > 0.965) v -= 9;
      const i = (y * N + x) * 4;
      cd[i] = v * 1.03; cd[i + 1] = v; cd[i + 2] = v * 0.97; cd[i + 3] = 255;
      // R: Relief – Spätholz dichter und höher, Frühholz schrumpft stärker ein · G: Rauheit
      // B: Holzton (nur Holzzustand) – Spätholz-Band dunkel, Ringgrenze als feine Linie, leichte Wolken im Ton
      rd[i] = 150 + 60 * late + 40 * (grain - 0.5);
      rd[i + 1] = 205 - 25 * late;
      rd[i + 2] = 255 * clamp(0.66 - 0.4 * late - (ph > 0.965 ? 0.18 : 0) + 0.1 * (grain - 0.5) + 0.14 * (n(x * 0.0025 + 40, y * 0.0025) - 0.5), 0, 1);
      rd[i + 3] = 255;
    }
  }
  // Gefäße in echter Größe: Frühholz Ø 24 ± 12 µm, Spätholz Ø 15 ± 9 µm (Prommer et al. 2014), teils radiale Paare
  const areaMm2 = (N * END_UM_PER_PX / 1000) ** 2;
  const count = Math.round(areaMm2 * VESSELS_PER_MM2);
  for (let k = 0, made = 0; made < count && k < count * 3; k++) {
    const x = rand() * N, y = rand() * N;
    const late = smoothstep(0.55, 0.96, phaseAt(x, y));
    if (rand() < 0.55 * late) continue;
    const dUm = Math.max(8, (late > 0.5 ? 15 + 9 * (rand() - 0.5) * 1.4 : 24 + 12 * (rand() - 0.5) * 1.4));
    const r = dUm / 2 / END_UM_PER_PX;
    stampPore(cd, rd, N, N, x, y, r, r * (0.8 + 0.2 * rand()), 0.9);
    made++;
    if (rand() < 0.3) {     // radiale Zwillinge: Richtung zum Mark
      const a = Math.atan2(y - pith[1], x - pith[0]);
      stampPore(cd, rd, N, N, x + Math.cos(a) * r * 2.1, y + Math.sin(a) * r * 2.1, r * 0.9, r * 0.75, 0.9);
      made++;
    }
  }
  cc.putImageData(img, 0, 0);
  rc.putImageData(rimg, 0, 0);

  // Holzstrahlen: radial vom Mark, wenige breite („Spiegel“, bis 0,5 mm) und viele schmale
  const ca = Math.atan2(0 - pith[1], 0 - pith[0]), cb = Math.atan2(N - pith[1], N - pith[0]);
  const aLo = Math.min(ca, cb), aHi = Math.max(ca, cb);
  for (let k = 0; k < 150; k++) {
    const broad = k % 14 === 0;
    const ang = lerp(aLo, aHi, rand()) + (rand() - 0.5) * 0.02;
    cc.strokeStyle = broad ? 'rgba(78,76,72,0.75)' : 'rgba(58,57,55,0.32)';
    rc.strokeStyle = broad ? 'rgba(240,150,95,0.9)' : 'rgba(215,180,120,0.45)';   // B: Strahlen rötlich-dunkler
    for (const ctx of [cc, rc]) {
      ctx.lineWidth = broad ? 4 + rand() * 3 : 1.1;
      ctx.beginPath();
      for (let r = 0.25 * N; r < 2.6 * N; r += 12) {
        const w = Math.sin(r * 0.01 + k) * 3;
        const x = pith[0] + Math.cos(ang) * r - Math.sin(ang) * w;
        const y = pith[1] + Math.sin(ang) * r + Math.cos(ang) * w;
        if (r === 0.25 * N) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // Schwundrisse: radial entlang der Strahlen mit Seitenästen + ein Ringriss
  for (let k = 0; k < 5; k++) {
    const ang = lerp(aLo, aHi, 0.12 + 0.76 * rand());
    const r0 = Math.hypot(N * 0.5 - pith[0], N * 0.5 - pith[1]) + (rand() - 0.5) * 0.5 * N;
    const len = (0.18 + rand() * 0.3) * N;
    const pts = [];
    for (let r = r0; r < r0 + len; r += 8) {
      const j = (n(r * 0.025, k * 9.1) - 0.5) * 14;
      pts.push([pith[0] + Math.cos(ang) * r - Math.sin(ang) * j, pith[1] + Math.sin(ang) * r + Math.cos(ang) * j]);
    }
    const w0 = 5 + 5 * rand();
    crackPath(pts, (t) => (1 - t) * w0 + 0.8, [kc, '#fff']);
    for (let b = 0; b < 2; b++) {            // feine Seitenrisse
      const at = pts[Math.floor((0.2 + 0.5 * rand()) * pts.length)];
      const side = [];
      const ba = ang + (rand() < 0.5 ? 1 : -1) * (0.5 + 0.6 * rand());
      for (let s = 0; s < 60 + rand() * 80; s += 6) side.push([at[0] + Math.cos(ba) * s, at[1] + Math.sin(ba) * s + (n(s * 0.05, b + k) - 0.5) * 6]);
      crackPath(side, (t) => (1 - t) * 1.6 + 0.4, [kc, '#fff']);
    }
  }
  const ringR = Math.round((Math.hypot(N * 0.55 - pith[0], N * 0.45 - pith[1])) / ringW) * ringW - 2;
  const ringPts = [];
  for (let a = lerp(aLo, aHi, 0.12); a < lerp(aLo, aHi, 0.62); a += 0.001) {
    const r = ringR + (n(a * 40, 3.3) - 0.5) * 8;
    ringPts.push([pith[0] + Math.cos(a) * r, pith[1] + Math.sin(a) * r]);
  }
  crackPath(ringPts, (t) => 3.2 * Math.sin(Math.PI * t) + 0.6, [kc, '#fff']);
  return { col, rb, N, ck };
}

function sideTextures(rand, radialFace) {
  const NW = 2048, NH = 1024;                 // u = Faserrichtung (4,4 cm), v quer (≈ 2,3 cm) → ≈ 22 µm je Pixel
  const n = noise2(rand);
  const col = canvas(NW, NH), rb = canvas(NW, NH), ck = canvas(NW / 2, NH / 2);
  const cc = col.getContext('2d'), rc = rb.getContext('2d', { willReadFrequently: true });
  const kc = ck.getContext('2d', { willReadFrequently: true });
  kc.scale(0.5, 0.5);                  // Riss-Maske in halber Auflösung, gleiche Koordinaten wie Farbe/Relief
  const img = cc.createImageData(NW, NH), rimg = rc.createImageData(NW, NH);
  const cd = img.data, rd = rimg.data;
  const ringPx = radialFace ? 118 : 165;      // Jahrringe als Streifen: radial schmal und parallel, tangential breiter und gefladert
  for (let y = 0; y < NH; y++) {
    for (let x = 0; x < NW; x++) {
      const streak = n(x * 0.0035, y * 0.23);          // Faserrichtung entlang u
      const fine = n(x * 0.05, y * 0.9);
      // Jahrring-Phase: radial fast gerade, tangential als Flader (Bogen über die Länge)
      const flame = radialFace ? 6 * n(x * 0.004, 2.0) : 70 * Math.sin(x * 0.0021 + 1.3) * smoothstep(0.1, 0.9, n(x * 0.001, 5.0)) + 14 * n(x * 0.006, 7.0);
      // ungleich breite Jahrringe (Verzerrung der Lage) und je Ring verschieden kräftiges Spätholz – kein Dielen-Raster
      const yw = y + flame + 10 * (n(x * 0.0015 + 20, y * 0.006) - 0.5);
      const rpos = (yw + 34 * Math.sin(yw * 0.0061 + 0.7) + 18 * Math.sin(yw * 0.017 + 2)) / ringPx;
      const ph = rpos - Math.floor(rpos), rv = n(Math.floor(rpos) * 1.7 + 0.5, 3.3);
      const late = smoothstep(0.7 + 0.12 * rv, 0.95, ph) * (1 - smoothstep(0.97, 1, ph)) * (0.5 + 0.5 * rv);   // schmale Spätholz-Linie
      // Faserriefen: unregelmäßige feine Rillen längs der Faser (0,05–0,2 mm breit), kein festes Raster → kein Moiré
      const riefe = smoothstep(0.55, 0.85, n(x * 0.004, y * 0.2)) * (0.6 + 0.4 * n(x * 0.02, y * 0.3));
      const v = 30 + 13 * (streak - 0.5) + 6 * (fine - 0.5) - 3 * late - 5 * riefe;
      const i = (y * NW + x) * 4;
      cd[i] = v * 1.02; cd[i + 1] = v; cd[i + 2] = v * 0.98; cd[i + 3] = 255;
      rd[i] = 170 + 12 * (streak - 0.5) + 5 * late - 22 * riefe;   // Längsstreifen flach, Riefen deutlich, Spätholz leicht erhaben
      rd[i + 1] = 140 + 15 * (fine - 0.5) - 4 * late;    // seidig, Spätholz kaum glatter
      // B: Holzton – Frühholz hell, zum Spätholz hin dunkler, Spätholz-Linie (Flader auf der Tangentialfläche), Faserstreifen
      const tone = 0.68 - 0.12 * smoothstep(0.3, 0.9, ph) - 0.28 * late + 0.2 * (streak - 0.5) + 0.06 * (fine - 0.5) - 0.1 * riefe +
        0.14 * (n(x * 0.0012 + 60, y * 0.004) - 0.5);
      rd[i + 2] = 255 * clamp(tone, 0, 1); rd[i + 3] = 255;
    }
  }
  // längs angeschnittene Gefäße: kurze dunkle Rinnen (Ø ≈ 1 px, Länge 0,3–1 mm)
  for (let k = 0; k < 9000; k++) {
    const x0 = rand() * NW, y = Math.floor(rand() * NH), len = 14 + rand() * 32;
    for (let x = Math.floor(x0); x < Math.min(NW, x0 + len); x++) {
      const t = (x - x0) / len;
      const cov = Math.min(1, Math.sin(Math.PI * t) * 1.6);
      const i = (y * NW + x) * 4;
      const k2 = 1 - 0.75 * cov;
      cd[i] *= k2; cd[i + 1] *= k2; cd[i + 2] *= k2;
      rd[i] = rd[i] * (1 - 0.8 * cov) + 25 * 0.8 * cov;
    }
  }
  cc.putImageData(img, 0, 0);
  rc.putImageData(rimg, 0, 0);
  // Strahl-Spiegel: spindelförmige, glänzende Flecken längs der Faser (auf der Radialfläche groß, sonst klein)
  for (let k = 0; k < (radialFace ? 520 : 900); k++) {
    const x = rand() * NW, y = rand() * NH;
    const len = radialFace ? 18 + rand() * 70 : 4 + rand() * 9, w = radialFace ? 1.2 + rand() * 2.6 : 0.8 + rand() * 1.2;
    cc.fillStyle = 'rgba(70,68,64,0.55)';
    rc.fillStyle = radialFace ? 'rgba(205,70,105,0.8)' : 'rgba(205,70,70,0.8)';   // B: Spiegel rötlich-dunkel, tangential als dunkle Striche
    for (const ctx of [cc, rc]) { ctx.beginPath(); ctx.ellipse(x, y, len, w, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  // Längsrisse
  for (let k = 0; k < 3; k++) {
    const y0 = (0.2 + 0.6 * rand()) * NH, x0 = rand() * 0.4 * NW, len = (0.35 + 0.45 * rand()) * NW;
    const pts = [];
    for (let x = x0; x < Math.min(NW - 4, x0 + len); x += 6) pts.push([x, y0 + (n(x * 0.02, k * 7) - 0.5) * 18]);
    crackPath(pts, (t) => (Math.sin(Math.PI * t) * (2 + 3 * rand())) + 0.4, [kc, '#fff']);
  }
  // feine Querrisse zwischen den großen Schwundrissen (Würfelmuster der Holzkohle), laufen quer zur Faser aus;
  // eigener Zufall, damit Form und Abplatzer des Stücks (gemeinsamer Zufall danach) unverändert bleiben
  const cr = mulberry32(radialFace ? 811 : 812);
  for (let k = 0; k < 12; k++) {
    const x0 = (0.04 + 0.92 * cr()) * NW, y0 = cr() * 0.6 * NH, len = (0.15 + 0.35 * cr()) * NH;
    const pts = [];
    for (let y = y0; y < Math.min(NH - 4, y0 + len); y += 5) pts.push([x0 + (n(y * 0.03, k * 5.3) - 0.5) * 22, y]);
    crackPath(pts, (t) => Math.sin(Math.PI * t) * (1 + 1.6 * cr()) + 0.3, [kc, '#fff']);
  }
  return { col, rb, N: NW, NH, ck };
}

// Höhe weichzeichnen (Binomial 1-4-6-4-1 bzw. 1-2-1, getrennt in x und y): nimmt die zeilenfeinen Anteile heraus,
// die auf schrägen Flächen sonst als Moiré-Bänder erscheinen
function binomial(hgt, w, h, taps) {
  const k = taps === 5 ? [1, 4, 6, 4, 1] : [1, 2, 1];
  const r = (k.length - 1) / 2, norm = k.reduce((a, b) => a + b, 0);
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let j = -r; j <= r; j++) acc += k[j + r] * hgt[y * w + Math.min(w - 1, Math.max(0, x + j))];
    tmp[y * w + x] = acc / norm;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let j = -r; j <= r; j++) acc += k[j + r] * tmp[Math.min(h - 1, Math.max(0, y + j)) * w + x];
    hgt[y * w + x] = acc / norm;
  }
}

// Höhe (R-Kanal) als Normal-Map: Sobel-Gradient, OpenGL-Konvention (+Y oben; Canvas wird beim Hochladen gespiegelt)
function sobelNormal(src, strength, taps = 3) {
  const w = src.width, h = src.height;
  const d = src.getContext('2d').getImageData(0, 0, w, h).data;
  const hgt = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) hgt[i] = d[i * 4] / 255;
  binomial(hgt, w, h, taps);
  const out = canvas(w, h);
  const oc = out.getContext('2d');
  const img = oc.createImageData(w, h);
  const o = img.data;
  for (let y = 0; y < h; y++) {
    const ym = (y === 0 ? 0 : y - 1) * w, y0 = y * w, yp = (y === h - 1 ? y : y + 1) * w;
    for (let x = 0; x < w; x++) {
      const xm = x === 0 ? 0 : x - 1, xp = x === w - 1 ? x : x + 1;
      const gx = (hgt[ym + xp] + 2 * hgt[y0 + xp] + hgt[yp + xp]) - (hgt[ym + xm] + 2 * hgt[y0 + xm] + hgt[yp + xm]);
      const gy = (hgt[yp + xm] + 2 * hgt[yp + x] + hgt[yp + xp]) - (hgt[ym + xm] + 2 * hgt[ym + x] + hgt[ym + xp]);
      let nx = -gx * strength, ny = gy * strength;
      const l = Math.sqrt(nx * nx + ny * ny + 1);
      nx /= l; ny /= l;
      const i = (y0 + x) * 4;
      o[i] = (nx * 0.5 + 0.5) * 255;
      o[i + 1] = (ny * 0.5 + 0.5) * 255;
      o[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      o[i + 3] = 255;
    }
  }
  oc.putImageData(img, 0, 0);
  return out;
}

// Risslinien als eigene Textur: R/G = Neigung der Rissränder (Rinne, wie die Normal-Map), B = Rissanteil 0–1. Die
// Grundtexturen bleiben rissfrei (Holz); der Shader blendet Farbe, Relief und Rauheit der Risse mit uCrack ein.
function crackTexture(mask, strength) {
  const out = sobelNormal(mask, -strength, 3);
  const w = out.width, h = out.height, oc = out.getContext('2d');
  const img = oc.getImageData(0, 0, w, h), m = mask.getContext('2d').getImageData(0, 0, w, h).data;
  for (let i = 0; i < w * h; i++) img.data[i * 4 + 2] = m[i * 4];
  oc.putImageData(img, 0, 0);
  return out;
}

// geglättete Höhe für die Verschiebung der Ecken (das Netz ist gröber als die Textur)
function smoothSampler(src, size) {
  const c = canvas(size, Math.round(size * src.height / src.width));
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, c.width, c.height);
  const w = c.width, h = c.height;
  const data = x.getImageData(0, 0, w, h).data;
  return (u, v) => {
    const fx = clamp(u, 0, 1) * (w - 1), fy = clamp(1 - v, 0, 1) * (h - 1);
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const g = (a, b) => data[(Math.min(h - 1, b) * w + Math.min(w - 1, a)) * 4] / 255;
    return lerp(lerp(g(ix, iy), g(ix + 1, iy), tx), lerp(g(ix, iy + 1), g(ix + 1, iy + 1), tx), ty);
  };
}

function texture(c, srgb) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

// Krümel: unregelmäßige Splitter aus einem Ikosaeder, kantig oder rundlich
function crumbGeometry(seed, detail, flat) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const gp = g.attributes.position;
  const p = new THREE.Vector3();
  for (let i = 0; i < gp.count; i++) {
    p.fromBufferAttribute(gp, i);
    p.multiplyScalar(0.7 + 0.6 * fbm3(p.x * 1.7 + seed * 5, p.y * 1.7, p.z * 1.7, 2));
    p.y *= flat;
    gp.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  return g;
}

export function create(ctx) {
  const rand = mulberry32(31337);
  const groundTex = groundTextures();      // Worker rechnet die Bodentexturen, während das Stück entsteht
  const scene = new THREE.Scene();
  scene.environment = ctx.env;
  scene.environmentIntensity = 0.52;

  const end = endGrainTextures(rand);
  const sideA = sideTextures(rand, true);
  const sideB = sideTextures(rand, false);
  // Verschiebung nur aus der stark geglätteten Höhe (Netz ≈ 0,3 mm) – feinere Riefen und Poren kommen über die Normal-Map
  const hEnd = smoothSampler(end.rb, 128), hA = smoothSampler(sideA.rb, 96), hB = smoothSampler(sideB.rb, 96);
  const heights = [hEnd, hEnd, hA, hA, hB, hB];

  const fbmf = (x, y, z, o = 3) => {
    let s = 0, a = 0.5, f = 1, nn = 0;
    for (let i = 0; i < o; i++) { s += a * vnoisef(x * f, y * f, z * f); nn += a; a *= 0.5; f *= 2.07; }
    return s / nn;
  };
  // Splitter: verjüngt sich nach rechts, schiefer Querschnitt (Keil); die Unterseite bleibt flach und liegt auf
  const shape = (p) => {
    const t = p.x / W + 0.5, s = 1 - 0.26 * t;
    const y = p.y * s + 0.42 * p.z * s * (p.y / H + 0.5) - (1 - s) * H / 2, z = p.z * s * (1 - 0.1 * t);
    p.y = y; p.z = z;
    return p;
  };

  const geo = new THREE.BoxGeometry(W, H, D, 240, 130, 120);
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const faceOf = new Int8Array(pos.count);
  const index = geo.index.array;
  geo.groups.forEach((g) => { for (let i = g.start; i < g.start + g.count; i++) faceOf[index[i]] = g.materialIndex; });
  // gemeinsame Verschiebungsrichtung je Ort: an Kanten gemittelt → keine Spalten zwischen den Flächen
  const keyOf = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const nsum = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = keyOf(i), s = nsum.get(k) || new THREE.Vector3();
    nsum.set(k, s.add(new THREE.Vector3(nor.getX(i), nor.getY(i), nor.getZ(i))));
  }
  nsum.forEach((v) => v.normalize());

  // Abgeschlagene Kanten/Ecken: Hauptabplatzer + 2–3 kleinere, gekippte Sub-Abplatzer an ihrem Rand (muschelig gestuft)
  const corners = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const c = shape({ x: sx * W / 2, y: sy * H / 2, z: sz * D / 2 });
    corners.push([c.x, c.y, c.z]);
  }
  const chips = [];
  const planeFor = (n, depth) => {
    const l = Math.hypot(...n);
    const nn = n.map((v) => v / l);
    return { n: nn, c: Math.max(...corners.map((p) => p[0] * nn[0] + p[1] * nn[1] + p[2] * nn[2])) - depth };
  };
  const addChip = (n, depth, subs) => {
    const main = planeFor(n, depth);
    main.ripple = 25 + 20 * rand();
    chips.push(main);
    for (let s = 0; s < subs; s++) {
      // Normal um 12–28° kippen, etwas tiefer ansetzen → kleine Stufe am Rand des großen Abplatzers
      const axis = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).cross(new THREE.Vector3(...main.n)).normalize();
      const nn = new THREE.Vector3(...main.n).applyAxisAngle(axis, (0.2 + 0.28 * rand()) * (rand() < 0.5 ? -1 : 1));
      const sub = planeFor([nn.x, nn.y, nn.z], depth * (0.55 + 0.35 * rand()) + 0.04);
      sub.ripple = 40 + 30 * rand();
      chips.push(sub);
    }
    return main;
  };
  for (let k = 0; k < 4; k++) addChip([(rand() - 0.5) * 0.3, (k & 1 ? 1 : -1) * (0.6 + rand() * 0.6), (k & 2 ? 1 : -1) * (0.6 + rand() * 0.6)], 0.1 + rand() * 0.28, 2);
  for (let k = 0; k < 7; k++) {
    const c = corners[Math.floor(rand() * 8)];
    addChip([c[0] * (0.4 + rand()), c[1] * (0.6 + rand()), c[2] * (0.6 + rand())], 0.25 + rand() * 0.4, 2 + Math.floor(rand() * 2));
  }
  addChip([-1, (rand() - 0.5) * 0.7, (rand() - 0.5) * 0.9], 0.45, 0);   // Bruchende links
  addChip([0.05, 0.5, 0.86], 0.62, 0).split = true;                    // Spaltfläche längs der Faser

  // Schwundrisse (Würfelmuster): quer zur Faser, längs entlang der Holzstrahlen vom Mark, ein Ringriss; laufen über die
  // Kanten weiter. Öffnung/Tiefe/Versatz in cm bei 800 °C (550 °C: ×0,85); das Holz ist glatt, dazwischen gleitet das Morph-Ziel
  const CRACK = { width: 0.075, depth: 0.16, lift: 0.036 };
  const vr = mulberry32(4242);
  const pithYZ = [-H * 1.5, -D * 1.4];            // Mark liegt außerhalb des Stücks
  const angs = corners.map((c) => Math.atan2(c[2] - pithYZ[1], c[1] - pithYZ[0]));
  const aMin = Math.min(...angs), aMax = Math.max(...angs);
  const rays = Array.from({ length: 6 }, (_, j) => lerp(aMin, aMax, (j + 0.5 + (vr() - 0.5) * 0.6) / 6)).sort((a, b) => a - b);
  const xCracks = [];
  for (let x = -W / 2 + 0.25 + vr() * 0.2; x < W / 2 - 0.15; x += 0.38 + vr() * 0.3) xCracks.push(x);
  const ringR = Math.hypot(pithYZ[0], pithYZ[1]) + 0.35;
  const cracksAt = (p) => {
    let open = 0, ix = 0, sec = 0;
    xCracks.forEach((x0, j) => {
      const xc = x0 + 0.14 * (fbmf(p.y * 1.4, p.z * 1.4, j * 3.1) - 0.5);
      if (p.x > xc) ix = j + 1;
      const w = CRACK.width * smoothstep(0.38, 0.6, fbmf(p.y * 0.8 + j, p.z * 0.8, j * 7.3));   // Risse laufen aus
      if (w > 0.003) open = Math.max(open, clamp(1 - Math.abs(p.x - xc) / w, 0, 1));
    });
    const dy = p.y - pithYZ[0], dz = p.z - pithYZ[1], ang = Math.atan2(dz, dy), r = Math.hypot(dy, dz);
    rays.forEach((a0, j) => {
      const a = a0 + 0.05 * (fbmf(p.x * 0.9, j * 2.3, 0.5) - 0.5);
      if (ang > a) sec = j + 1;
      const w = 0.9 * CRACK.width * smoothstep(0.3, 0.5, fbmf(p.x * 0.5 + j * 5, 1.7, j));
      if (w > 0.003) open = Math.max(open, clamp(1 - Math.abs(Math.sin(ang - a)) * r / w, 0, 1));
    });
    const wr = 0.7 * CRACK.width * smoothstep(0.45, 0.6, fbmf(p.x * 0.6, ang * 4, 9.9));
    if (wr > 0.003) open = Math.max(open, clamp(1 - Math.abs(r - ringR - 0.05 * (fbmf(p.x, ang * 6, 2) - 0.5)) / wr, 0, 1));
    // Blöcke zwischen den Rissen leicht gegeneinander versetzt
    const lift = (hash33(ix, sec, 7)[0] - 0.5) * CRACK.lift;
    return { k: lift - CRACK.depth * open, shade: 1 - 0.7 * open };
  };

  // Holzzustand = Form ohne Schwundrisse und Blockversatz, Bruchflächen heller; Kohle = volles Relief, dunkle Bruchflächen.
  // Unterschied (Lage, Normale, Helligkeit) als relatives Morph-Ziel, piece.morphTargetInfluences[0] = Rissöffnung 0–1
  const colors = new Float32Array(pos.count * 3), dPos = new Float32Array(pos.count * 3), dCol = new Float32Array(pos.count * 3);
  const crackDepth = new Float32Array(pos.count);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const dn = nsum.get(keyOf(i));
    const n = [dn.x, dn.y, dn.z];
    p.fromBufferAttribute(pos, i);
    shape(p);
    let shade = 1, shadeWood = 1, charRelief = 0;
    // Bruchende links: tiefe Terrassen quer zur Faser, lange herausstehende Faserbündel, feine Splitter
    if (p.x < -W / 2 + 0.95) {
      const step = Math.floor(fbm3(p.y * 2.2 + 7, p.z * 2.2 + 3, 0.5, 3) * 5) / 5;
      const splinter = fbm3(p.y * 9, p.z * 9, 2, 2) - 0.5;
      const bundle = 1 - Math.abs(2 * fbmf(p.y * 7, p.z * 7, 3.3) - 1);
      const fiber = fbm3(p.y * 30, p.z * 30, 4, 2) - 0.5;
      p.x = Math.max(p.x, -W / 2 + 0.85 * step + 0.1 * splinter + 0.16 * bundle + 0.03 * fiber);
    }
    let hit = null;
    for (const ch of chips) {
      const d = p.x * ch.n[0] + p.y * ch.n[1] + p.z * ch.n[2] - ch.c;
      if (d > 0) { p.set(p.x - ch.n[0] * d, p.y - ch.n[1] * d, p.z - ch.n[2] * d); hit = ch; }
    }
    const u = uv.getX(i), v = uv.getY(i), f = faceOf[i];
    if (hit && hit.split) {
      // Spaltfläche: aufgerissene Faserbündel längs der Faser statt Muschelbögen
      const fib = 1 - Math.abs(2 * fbmf(p.x * 0.5, p.y * 9, p.z * 9, 3) - 1);
      const k = 0.03 * (fib - 0.5) + 0.012 * (fbmf(p.x * 2, p.y * 30, p.z * 30, 2) - 0.5);
      p.set(p.x + hit.n[0] * k, p.y + hit.n[1] * k, p.z + hit.n[2] * k);
      shade = 0.7; shadeWood = 0.9;
    } else if (hit) {
      // frische Bruchfläche: muschelige Wellen + Rauheit entlang der Abplatzer-Normale, glänzend schwarz
      const r = fbm3(p.x * 6 + 1, p.y * 6, p.z * 6, 3);
      const shell = Math.abs(Math.sin(r * 14 + hit.ripple));        // unregelmäßige Muschelbögen, keine parallelen Wellen
      const k = -0.005 * shell - 0.02 * (r - 0.5) - 0.012 * (fbmf(p.x * 14, p.y * 14, p.z * 14, 2) - 0.5);
      p.set(p.x + hit.n[0] * k, p.y + hit.n[1] * k, p.z + hit.n[2] * k);
      shade = 0.6; shadeWood = 0.86;
    } else {
      const h = heights[f](u, v);
      const edge = smoothstep(0, 0.05, Math.min(u, 1 - u, v, 1 - v));
      const crack = clamp((0.3 - h) / 0.3, 0, 1) * edge;
      const bump = fbm3(p.x * 1.4 + 3, p.y * 1.4, p.z * 1.4, 3) - 0.5;   // nur noch leicht: keine weichen Wellen
      // Relief aus der Höhe: Jahrringe/Strahlen auf der Stirnfläche ≈ 0,1 mm, Längsflächen flacher; an den Kanten aus
      // Holz: Stirnfläche glatt gesägt (das Relief erschiene sonst als Beulennetz aus Ringen × Strahlen), erst die Kohle
      // schrumpft ungleich → Relief der Stirnfläche nur im Morph-Ziel
      const relief = (h - 0.7) * (f < 2 ? 0.014 : 0.004) * edge;
      if (f < 2) charRelief = relief;
      const k = -crack * 0.13 + bump * 0.015 + (f < 2 ? 0 : relief);
      p.set(p.x + n[0] * k, p.y + n[1] * k, p.z + n[2] * k);
    }
    pos.setXYZ(i, p.x, p.y, p.z);
    const c = cracksAt(p), dir = hit ? hit.n : n;
    dPos.set([dir[0] * c.k + n[0] * charRelief, dir[1] * c.k + n[1] * charRelief, dir[2] * c.k + n[2] * charRelief], i * 3);
    crackDepth[i] = c.k;
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = shadeWood;
    dCol[i * 3] = dCol[i * 3 + 1] = dCol[i * 3 + 2] = shade * c.shade - shadeWood;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Normalen für beide Zustände: Holz als Grundlage, Kohle (verschoben) als Unterschied im Morph-Ziel
  const wood = pos.array.slice();
  geo.computeVertexNormals();
  const nWood = nor.array.slice();
  for (let i = 0; i < wood.length; i++) pos.array[i] = wood[i] + dPos[i];
  geo.computeVertexNormals();
  const dNor = nor.array.map((v, i) => v - nWood[i]);
  pos.array.set(wood);
  nor.array.set(nWood);
  geo.morphAttributes.position = [new THREE.BufferAttribute(dPos, 3)];
  geo.morphAttributes.normal = [new THREE.BufferAttribute(dNor, 3)];
  geo.morphAttributes.color = [new THREE.BufferAttribute(dCol, 3)];
  geo.morphTargetsRelative = true;
  geo.computeBoundingBox();

  const matEnd = new THREE.MeshPhysicalMaterial({
    map: texture(end.col, true), normalMap: texture(sobelNormal(end.rb, 2.6, 3), false), normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: texture(end.rb, false), roughness: 1, metalness: 0.08, vertexColors: true,
  });
  const sideMat = (t) => new THREE.MeshPhysicalMaterial({
    map: texture(t.col, true), normalMap: texture(sobelNormal(t.rb, 1.6, 5), false), normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: texture(t.rb, false), roughness: 1, metalness: 0.22, vertexColors: true,
  });
  const matA = sideMat(sideA), matB = sideMat(sideB);
  const mats = [matEnd, matA, matB];

  // Pyrolyse im Zeitraffer: Holzfarbe → braun → schwarz (Muster aus der Kohle-Textur bleibt erhalten) und Rotglut
  // ab dem Draper-Punkt; dunkle Stellen (Poren, Risse) glühen stärker. Endzustand (uChar = 1) = unveränderte Kohle.
  // Risslinien (crackTexture) kommen mit uCrack dazu: dunkle Farbe, Rinnen in der Normale, rau – im Holz unsichtbar.
  const pyro = { uChar: { value: 1 }, uGlow: { value: 0 }, uGlowCol: { value: new THREE.Color() }, uTime: { value: 0 }, uCrack: { value: 1 } };
  const crackTex = new Map([[matEnd, texture(crackTexture(end.ck, 2.2), false)], [matA, texture(crackTexture(sideA.ck, 1.5), false)],
    [matB, texture(crackTexture(sideB.ck, 1.5), false)]]);
  for (const m of mats) {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, pyro, { uCrackMap: { value: crackTex.get(m) } });
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform float uChar, uGlow, uTime, uCrack;\nuniform vec3 uGlowCol;\nuniform sampler2D uCrackMap;
          float gHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
          float gNoise(vec3 p) {                         // Wertrauschen −1 … 1, weich interpoliert
            vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            float a = mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x), mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y);
            float b = mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x), mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y);
            return mix(a, b, f.z) * 2.0 - 1.0;
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec4 ck = texture2D(uCrackMap, vMapUv);
          float cm = ck.b * uCrack;                     // Rissanteil, öffnet sich mit der Schwindung
          vec2 cn = (ck.rg * 2.0 - 1.0) * uCrack;      // Neigung der Rissränder
          float pl = dot(diffuseColor.rgb, vec3(0.3333));
          float lr = clamp(pl / 0.016, 0.0, 1.8);       // Textur ist linear ≈ 0,015 im Mittel, Poren ≈ 0
          float pd = max(1.0 - clamp(lr, 0.0, 1.0), cm);
          // Holz: Ton aus dem B-Kanal der Relief-Textur (Jahrringe, Flader, Strahlen), mittleres bis dunkles Braun;
          // Gefäße und Rinnen der Kohle-Textur (lr klein) als dunkle Poren
          float tone = texture2D(roughnessMap, vMapUv).b;
          vec3 wood = mix(vec3(0.055, 0.024, 0.01), vec3(0.21, 0.1, 0.045), tone) * mix(0.45, 1.0, smoothstep(0.05, 0.45, lr));
          vec3 brown = wood * vec3(0.7, 0.5, 0.42);
          diffuseColor.rgb = (uChar < 0.5 ? mix(wood, brown, smoothstep(0.0, 0.5, uChar)) : mix(brown, diffuseColor.rgb, smoothstep(0.5, 1.0, uChar))) * (1.0 - 0.92 * cm);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n          roughnessFactor = mix(roughnessFactor, 1.0, cm);')
        .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale;\n\tmapN.xy += cn * normalScale;'))
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // Glimmen: Glutnester ortsfest auf der Oberfläche (UV statt Blickraum), örtliche Glut q: 0 kühl … 1 Rissgrund.
          // Risse und Poren strahlen als Hohlräume fast wie ein schwarzer Körper → heller und gelber; flache Flächen
          // kirschrot, unter flachem Blickwinkel etwas schwächer (Emissionsgrad sinkt) – so bleibt die Form lesbar.
          // Helligkeit wächst steil mit q (Strahlung ∝ T⁴). Bewegung: Nester langsam, leichtes Flackern im Luftzug
          // (nur örtlich, nie das ganze Stück), ganz dezentes Atmen des ganzen Stücks (± 6 %, 4,2 s + 6,7 s).
          float nest = 0.65 * gNoise(vec3(vMapUv * vec2(9.0, 5.0), uTime * 0.18)) + 0.35 * gNoise(vec3(vMapUv * vec2(23.0, 13.0) + 7.3, uTime * 0.29));
          float flick = 0.6 * gNoise(vec3(vMapUv * vec2(17.0, 10.0) + vec2(uTime * 0.45, 0.0), uTime * 1.2))
                      + 0.4 * gNoise(vec3(vMapUv * vec2(43.0, 25.0) + 3.1, uTime * 2.4));
          float breath = 0.6 * sin(uTime * 1.496) + 0.4 * sin(uTime * 0.94 + 1.7);   // wie ember.intensity in update()
          float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          float q = clamp(0.36 + 0.26 * nest + 0.3 * smoothstep(0.55, 1.0, pd) + 0.24 * cm + 0.07 * flick - 0.1 * clamp(lr - 1.0, 0.0, 0.8), 0.0, 1.0);
          vec3 glowCol = uGlowCol * vec3(1.0, exp(2.4 * (q - 0.5)), exp(3.2 * (q - 0.5)));
          totalEmissiveRadiance += glowCol * uGlow * 1.8 * (0.05 + 2.8 * q * q * q) * (0.72 + 0.28 * ndv) * (1.0 + 0.06 * breath);`)
        // Glühendes Stück leuchtet selbst: Studio-Licht tritt zurück, sonst mischt sich Grau-Weiß zur Glut (Lachs-Ton)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
          float selfLit = 1.0 - 0.62 * uGlow;
          reflectedLight.directDiffuse *= selfLit; reflectedLight.indirectDiffuse *= selfLit;
          reflectedLight.directSpecular *= selfLit; reflectedLight.indirectSpecular *= selfLit;`);
    };
  }
  const piece = new THREE.Mesh(geo, [matEnd, matEnd, matA, matA, matB, matB]);
  scene.add(piece);

  // Krümel, Splitter und Staub (Instanzen), gehäuft am Bruchende und unter den Abplatzern; je Krümel ein Kontaktschatten.
  // Dunkel und matt wie die Kohle selbst (kein Glanz, der sie vor dem Waldboden grau aufhellt)
  const floorY = geo.boundingBox.min.y;
  const crumbMat = new THREE.MeshStandardMaterial({ color: 0x0b0a0a, roughness: 1, metalness: 0.03 });
  const crumbGeos = [crumbGeometry(1, 2, 0.6), crumbGeometry(2, 1, 0.5), crumbGeometry(3, 0, 0.7), crumbGeometry(4, 1, 0.35)];
  const sc = canvas(128, 128), sx = sc.getContext('2d');
  const grad = sx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sx.fillStyle = grad;
  sx.fillRect(0, 0, 128, 128);
  const shadowTex = texture(sc, true);
  const ground = makeGround({ scene, floorY, W, D, crumbGeometry, shadowTex }, groundTex);
  const hAt = ground.heightAt;
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const blobs = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), e3 = new THREE.Euler();
  const spot = (r, fits) => {
    // freier Ort am Boden außerhalb des Stücks; die Hälfte liegt nahe dem linken Bruchende. Kein Platz → null
    for (let tries = 0; tries < 80; tries++) {
      const nearEnd = rand() < 0.45;
      const x = nearEnd ? -W / 2 - 0.15 - rand() * 1.4 : (rand() - 0.5) * (W + 3.2);
      const z = (rand() - 0.5) * (D + 3.4);
      if (Math.abs(x) < W / 2 + 0.12 && Math.abs(z) < D / 2 + 0.12) continue;
      if (Math.hypot(x / 4.6, z / 3.4) > 1) continue;
      if (fits(x, z, r)) return [x, z];
    }
    return null;
  };
  const fallout = [];      // Krümel und Staub entstehen erst beim Verkohlen (Zeitraffer)
  crumbGeos.forEach((g, gi) => {
    const count = [10, 12, 16, 10][gi];
    const mesh = new THREE.InstancedMesh(g, crumbMat, count);
    let n = 0;
    for (let k = 0; k < count; k++) {
      const s = gi === 2 ? 0.02 + rand() * 0.05 : 0.04 + Math.pow(rand(), 2) * 0.16;
      const at = spot(s * LUMP_R, ground.claim);
      if (!at) continue;
      const [x, z] = at;
      e3.set(rand() * 3, rand() * 3, rand() * 3);
      mesh.setMatrixAt(n++, m4.compose(s3.set(x, floorY + hAt(x, z) + s * 0.42, z), q.setFromEuler(e3), new THREE.Vector3(s, s, s)));
      blobs.push([x, z, s * 2.6]);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    fallout.push(mesh);
  });
  // feiner Staub: 80–300 µm; liegt nicht in anderen Gegenständen, belegt selbst keinen Platz
  const dust = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), crumbMat, 420);
  let nd = 0;
  for (let k = 0; k < 420; k++) {
    const s = 0.008 + Math.pow(rand(), 3) * 0.022;
    const at = spot(s, ground.freeAt);
    if (!at) continue;
    const [x, z] = at;
    e3.set(rand() * 3, rand() * 3, rand() * 3);
    dust.setMatrixAt(nd++, m4.compose(s3.set(x, floorY + hAt(x, z) + s * 0.3, z), q.setFromEuler(e3), new THREE.Vector3(s, s, s)));
  }
  dust.count = nd;
  dust.instanceMatrix.needsUpdate = true;
  scene.add(dust);
  fallout.push(dust);
  const blobMesh = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }), blobs.length);
  blobs.forEach(([x, z, s], k) => blobMesh.setMatrixAt(k, m4.compose(s3.set(x, floorY + hAt(x, z) - 0.004, z), q.identity(), new THREE.Vector3(s, 1, s))));
  blobMesh.instanceMatrix.needsUpdate = true;
  scene.add(blobMesh);

  // Schatten des Stücks: weicher Fleck, folgt dem Relief (Boden ab ground.js, Lichtpool steckt in dessen Eckfarben)
  const shadowGeo = new THREE.PlaneGeometry(W * 1.7, D * 2.1, 24, 12).rotateX(-Math.PI / 2);
  {
    const sp = shadowGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setY(i, hAt(sp.getX(i), sp.getZ(i)));
  }
  const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.position.y = floorY - 0.005;
  scene.add(shadow);

  // Licht: warmes Hauptlicht schwenkt langsam, kühles Gegenlicht streicht über die Längsflächen (Seidenglanz wandert)
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
  const rim = new THREE.DirectionalLight(0xc4d6ff, 2.1);
  const fill = new THREE.HemisphereLight(0x8090a0, 0x050505, 0.35);
  const KEY0 = new THREE.Vector3(5, 7, 6), RIM0 = new THREE.Vector3(-7, 3, -6), Y = new THREE.Vector3(0, 1, 0);
  const moveLights = (t) => {
    key.position.copy(KEY0).applyAxisAngle(Y, 0.32 * Math.sin(t * 0.083));
    rim.position.copy(RIM0).applyAxisAngle(Y, 0.5 * Math.sin(t * 0.061 + 1.2));
    rim.position.y = 3 + 1.2 * Math.sin(t * 0.047);
    rim.intensity = 2.1 * (0.85 + 0.15 * Math.sin(t * 0.13 + 0.5));
  };
  moveLights(0);
  scene.add(key, rim, fill);

  // Hotspots aus der verformten Geometrie
  const pick = (face, test) => {
    let best = null, bestScore = Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (faceOf[i] !== face) continue;
      const s = test(i);
      if (s < bestScore) { bestScore = s; best = i; }
    }
    return new THREE.Vector3().fromBufferAttribute(pos, best);
  };
  const endPos = pick(0, (i) => Math.hypot(pos.getY(i) - 0.15, pos.getZ(i) - 0.1));
  const crackPos = pick(4, (i) => {
    const u = uv.getX(i), v = uv.getY(i);
    if (u < 0.3 || u > 0.85 || v < 0.2 || v > 0.8) return Infinity;
    return crackDepth[i] + Math.abs(u - 0.6) * 0.1;         // tiefster Schwundriss im Kohlezustand
  });
  const sheenPos = pick(2, (i) => Math.hypot(pos.getX(i) + 0.6, pos.getZ(i) - 0.25));
  // Abzeichen „Schwundrisse“: Normale = Nullvektor, solange keine Risse offen sind → Sichtbarkeitstest in hud.js blendet
  // nur den Marker aus (Liste in der Tafel bleibt; erklärt dort, dass die Risse erst beim Verkohlen entstehen)
  const cracksHs = { id: 'cracks', kind: 'info', pos: crackPos.add(new THREE.Vector3(0, 0, 0.04)), normal: new THREE.Vector3(0, 0, 1) };

  // Schwaden (Wasserdampf, Pyrolysegase, Teer): Punktwolke, Lebenslauf vollständig im Shader
  const PLUME_N = 520;
  const plumeGeo = new THREE.BufferGeometry();
  {
    const pp = new Float32Array(PLUME_N * 3), ps = new Float32Array(PLUME_N * 4);
    const top = geo.boundingBox.max.y - 0.25;
    for (let k = 0; k < PLUME_N; k++) {
      pp.set([(rand() - 0.5) * W * 0.85, top - rand() * 0.5, (rand() - 0.5) * D * 0.8], k * 3);
      ps.set([rand(), 0.6 + rand() * 0.8, rand() * 6.28, 0.5 + rand()], k * 4);
    }
    plumeGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    plumeGeo.setAttribute('aSeed', new THREE.BufferAttribute(ps, 4));
    plumeGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 8);
  }
  const plumeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0 }, uCol: { value: new THREE.Color(0.8, 0.85, 0.9) } },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uAmt; varying float vA;
      void main() {
        float age = fract(uTime * 0.09 * aSeed.y + aSeed.x);
        vec3 p = position;
        p.y += age * 3.4;
        p.x += sin(aSeed.z + age * 5.0 + uTime * 0.4) * 0.32 * age + 0.3 * age * age;
        p.z += cos(aSeed.z * 1.3 + age * 4.0) * 0.32 * age;
        vA = sin(3.14159 * age) * uAmt * (0.4 + 0.6 * aSeed.w);
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_PointSize = (0.45 + 1.5 * age) * aSeed.w * 1500.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = 1.0 - smoothstep(0.0, 1.0, d); gl_FragColor = vec4(uCol, a * a * vA * 0.3); }`,
  });
  const plume = new THREE.Points(plumeGeo, plumeMat);
  plume.frustumCulled = false;
  plume.renderOrder = 2;
  scene.add(plume);
  const ember = new THREE.PointLight(0xff5a1a, 0, 9, 1.6);   // Schein der Glut auf dem Tisch
  ember.position.set(0.2, -0.3, 1.9);
  scene.add(ember);
  let playing = false, plumeAmt = 0, tNow = 550, tTarget = 550, lastT = 0, emberBase = 0, bloomBase = 0.12;
  const lerpCol = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const smoke = (T) => {          // Farbe der Schwaden je Phase: Dampf weiß → Gase gelbbraun → Teer dunkel → dünn bläulich
    const st = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
    let c = [0.82, 0.86, 0.9];
    c = lerpCol(c, [0.62, 0.52, 0.36], st(190, 250, T));
    c = lerpCol(c, [0.3, 0.24, 0.18], st(300, 340, T));
    return lerpCol(c, [0.5, 0.55, 0.62], st(400, 470, T));
  };
  // Schwindung relativ zum Zielzustand (die Geometrie zeigt die fertige Kohle bei der gewählten Temperatur)
  const applyShrink = () => {
    const a = pyroState(tNow), b = pyroState(tTarget);
    const sl = (1 - a.shrinkL) / (1 - b.shrinkL), st = (1 - a.shrinkT) / (1 - b.shrinkT);
    piece.scale.set(sl, st, st);
    piece.position.y = floorY * (1 - st);
  };

  const camera = new THREE.PerspectiveCamera(32, ctx.aspect, 0.05, 200);
  const level = {
    scene, camera,
    unit: 0.01,
    method: 'Makroaufnahme · Modell',
    tone: 1,
    grain: 0.018,
    dof: 5,          // Makro: Tisch und Krümel im Hintergrund weich
    bloom: 0.12,
    cine: { orbit: 0.06, crane: 0.04, dolly: 0.05 },
    home: { pos: new THREE.Vector3(7.6, 3.1, 5.4), target: new THREE.Vector3(0.5, -0.15, 0) },
    orbit: { minDistance: 3.2, maxDistance: 16, maxPolarAngle: 1.5, enablePan: false, autoRotate: true },
    hotspots: [
      { id: 'endgrain', kind: 'dive', pos: endPos.add(new THREE.Vector3(0.03, 0, 0)), normal: new THREE.Vector3(1, 0, 0) },
      cracksHs,
      { id: 'sheen', kind: 'info', pos: sheenPos.add(new THREE.Vector3(0, 0.04, 0)), normal: new THREE.Vector3(0, 1, 0) },
    ],
    update(dt, t) {
      moveLights(t);
      ground.update(dt);
      plumeMat.uniforms.uTime.value = t;
      // Glimmen ohne Bewegung (reduced-motion): ruhende Glutnester; Schein auf dem Tisch und Bloom atmen mit (wie im
      // Shader), der Tischschein flackert leicht (± 3 %, Schwebung ≈ 1 Hz)
      const tg = pyro.uTime.value = reduced ? 0 : t;
      const breath = 0.6 * Math.sin(tg * 1.496) + 0.4 * Math.sin(tg * 0.94 + 1.7);
      ember.intensity = emberBase * (1 + 0.07 * breath + 0.03 * Math.sin(tg * 6.3) * Math.sin(tg * 3.7 + 0.8));
      level.bloom = bloomBase * (1 + 0.08 * breath);
      const want = playing ? pyroState(tNow).vapour : 0;
      plumeAmt += (want - plumeAmt) * Math.min(1, dt * 3);
      plumeMat.uniforms.uAmt.value = plumeAmt;
      plume.visible = plumeAmt > 0.004;
      return true;
    },
    setParam(name, value) {
      if (name === 'play') {
        playing = !!value;
        return;
      }
      if (name === 'quality') {
        ground.shadows(key, piece, value.shadows);
        shadow.material.opacity = value.shadows ? 0.85 : 1;   // echter Schatten dunkelt schon mit
        return;
      }
      if (name === 'target') {
        tTarget = value;
        applyShrink();
        return;
      }
      if (name !== 'temp') return;
      tNow = value;
      const st = pyroState(value);
      pyro.uChar.value = st.char;
      // Schwundrisse (Modell, docs/research.md): Holz und gebräuntes Holz bleiben rissfrei, die Risse öffnen sich erst,
      // wenn das Stück schwarz wird (≈ 380 °C), fast voll offen ab ≈ 580 °C, bis 800 °C noch etwas breiter; gleitet mit
      // dem Regler und im Zeitraffer ohne Sprung, kein Neuaufbau
      const open = smoothstep(380, 580, value) * (0.85 + 0.15 * clamp((value - 550) / 250, 0, 1));
      piece.morphTargetInfluences[0] = open;
      pyro.uCrack.value = open;
      cracksHs.normal.set(0, 0, open > 0.12 ? 1 : 0);
      pyro.uGlow.value = st.glow;
      pyro.uGlowCol.value.setRGB(...glowColor(value));
      emberBase = st.glow * 13;
      level.bloom = bloomBase = 0.12 + st.glow * 0.7;
      plumeMat.uniforms.uCol.value.setRGB(...smoke(value));
      for (const f of fallout) f.visible = st.char > 0.8;
      applyShrink();
      // niedrig verkohlt: bräunlich und matt · hoch verkohlt: neutral schwarz, seidig glänzend
      const k = clamp((value - 350) / 450, 0, 1);
      const brown = clamp((450 - value) / 100, 0, 1);   // ab ≈ 450 °C tiefschwarz
      const tint = new THREE.Color(lerp(0.72, 1.9, brown), lerp(0.72, 1.3, brown), lerp(0.74, 0.95, brown));
      // Holz (auch gebräunt) nur mäßig rau: Faserriefen und Gefäßrinnen der Normal-Map flach, tiefer erst in der Kohle
      const relief = 1.1 * lerp(0.35, 1, smoothstep(380, 560, value));
      for (const m of mats) {
        m.color.copy(tint);
        m.normalScale.setScalar(relief);
        m.metalness = m === matEnd ? lerp(0.02, 0.1, k) : lerp(0.04, 0.3, k);
        m.roughness = lerp(1.15, 0.85, k);
        m.clearcoat = m === matEnd ? 0 : lerp(0, 0.2, k);    // Seidenglanz der Längsflächen, gedämpft: rau statt glatt
        m.clearcoatRoughness = 0.5;
      }
      crumbMat.color.copy(tint).multiplyScalar(0.02);
      level.dirty = true;
    },
    dispose() { ground.dispose(); disposeGroup(scene); },
  };
  level.setParam('target', ctx.temp);
  level.setParam('temp', ctx.temp);
  return level;
}
