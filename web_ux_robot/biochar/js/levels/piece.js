// Ebene 1: ein Stück Buchen-Pflanzenkohle (Einheit cm). Prozedurale Texturen: Jahrringe, Strahlen, Gefäße in echter
// Größe (Ø 15–24 µm), Faserriefen, Schwundrisse; Relief als Normal-Map (Sobel) und als Verschiebung im feinen Netz.

import * as THREE from 'three';
import { mulberry32, fbm3, smoothstep, clamp, lerp } from '../util.js';
import { disposeGroup } from '../walls.js';

const W = 4.4, H = 2.4, D = 2.2;
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

// Riss als gezackte Linie; zeichnet in Farbe (schwarz) und Relief (R = 0)
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
  const col = canvas(N, N), rb = canvas(N, N);
  const cc = col.getContext('2d'), rc = rb.getContext('2d', { willReadFrequently: true });
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
      rd[i] = 150 + 60 * late + 40 * (grain - 0.5);
      rd[i + 1] = 205 - 25 * late;
      rd[i + 2] = 0; rd[i + 3] = 255;
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
    rc.strokeStyle = broad ? 'rgba(240,150,0,0.9)' : 'rgba(215,180,0,0.45)';
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
    crackPath(pts, (t) => (1 - t) * w0 + 0.8, [cc, 'rgb(2,2,2)'], [rc, 'rgb(0,230,0)']);
    for (let b = 0; b < 2; b++) {            // feine Seitenrisse
      const at = pts[Math.floor((0.2 + 0.5 * rand()) * pts.length)];
      const side = [];
      const ba = ang + (rand() < 0.5 ? 1 : -1) * (0.5 + 0.6 * rand());
      for (let s = 0; s < 60 + rand() * 80; s += 6) side.push([at[0] + Math.cos(ba) * s, at[1] + Math.sin(ba) * s + (n(s * 0.05, b + k) - 0.5) * 6]);
      crackPath(side, (t) => (1 - t) * 1.6 + 0.4, [cc, 'rgb(4,4,4)'], [rc, 'rgb(0,230,0)']);
    }
  }
  const ringR = Math.round((Math.hypot(N * 0.55 - pith[0], N * 0.45 - pith[1])) / ringW) * ringW - 2;
  const ringPts = [];
  for (let a = lerp(aLo, aHi, 0.12); a < lerp(aLo, aHi, 0.62); a += 0.001) {
    const r = ringR + (n(a * 40, 3.3) - 0.5) * 8;
    ringPts.push([pith[0] + Math.cos(a) * r, pith[1] + Math.sin(a) * r]);
  }
  crackPath(ringPts, (t) => 3.2 * Math.sin(Math.PI * t) + 0.6, [cc, 'rgb(3,3,3)'], [rc, 'rgb(0,230,0)']);
  return { col, rb, N };
}

function sideTextures(rand, radialFace) {
  const NW = 2048, NH = 1024;                 // u = Faserrichtung (4,4 cm), v quer (≈ 2,3 cm) → ≈ 22 µm je Pixel
  const n = noise2(rand);
  const col = canvas(NW, NH), rb = canvas(NW, NH);
  const cc = col.getContext('2d'), rc = rb.getContext('2d', { willReadFrequently: true });
  const img = cc.createImageData(NW, NH), rimg = rc.createImageData(NW, NH);
  const cd = img.data, rd = rimg.data;
  const ringPx = radialFace ? 118 : 165;      // Jahrringe als Streifen: radial schmal und parallel, tangential breiter und gefladert
  for (let y = 0; y < NH; y++) {
    for (let x = 0; x < NW; x++) {
      const streak = n(x * 0.0035, y * 0.23);          // Faserrichtung entlang u
      const fine = n(x * 0.05, y * 0.9);
      // Jahrring-Phase: radial fast gerade, tangential als Flader (Bogen über die Länge)
      const flame = radialFace ? 6 * n(x * 0.004, 2.0) : 70 * Math.sin(x * 0.0021 + 1.3) * smoothstep(0.1, 0.9, n(x * 0.001, 5.0)) + 14 * n(x * 0.006, 7.0);
      const ph = (((y + flame) / ringPx) % 1 + 1) % 1;
      const late = smoothstep(0.78, 0.95, ph) * (1 - smoothstep(0.97, 1, ph));   // schmale Spätholz-Linie
      // Faserriefen: unregelmäßige feine Rillen längs der Faser (0,05–0,2 mm breit), kein festes Raster → kein Moiré
      const riefe = smoothstep(0.55, 0.85, n(x * 0.004, y * 0.2)) * (0.6 + 0.4 * n(x * 0.02, y * 0.3));
      const v = 30 + 13 * (streak - 0.5) + 6 * (fine - 0.5) - 3 * late - 5 * riefe;
      const i = (y * NW + x) * 4;
      cd[i] = v * 1.02; cd[i + 1] = v; cd[i + 2] = v * 0.98; cd[i + 3] = 255;
      rd[i] = 170 + 12 * (streak - 0.5) + 2 * late - 22 * riefe;   // Längsstreifen flach, Riefen deutlich, keine Zeilen-Feinheit
      rd[i + 1] = 140 + 15 * (fine - 0.5) - 4 * late;    // seidig, Spätholz kaum glatter
      rd[i + 2] = 0; rd[i + 3] = 255;
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
    rc.fillStyle = 'rgba(205,70,0,0.8)';
    for (const ctx of [cc, rc]) { ctx.beginPath(); ctx.ellipse(x, y, len, w, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  // Längsrisse
  for (let k = 0; k < 3; k++) {
    const y0 = (0.2 + 0.6 * rand()) * NH, x0 = rand() * 0.4 * NW, len = (0.35 + 0.45 * rand()) * NW;
    const pts = [];
    for (let x = x0; x < Math.min(NW - 4, x0 + len); x += 6) pts.push([x, y0 + (n(x * 0.02, k * 7) - 0.5) * 18]);
    crackPath(pts, (t) => (Math.sin(Math.PI * t) * (2 + 3 * rand())) + 0.4, [cc, 'rgb(2,2,2)'], [rc, 'rgb(0,230,0)']);
  }
  return { col, rb, N: NW, NH };
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
  const scene = new THREE.Scene();
  scene.environment = ctx.env;
  scene.environmentIntensity = 0.65;

  const end = endGrainTextures(rand);
  const sideA = sideTextures(rand, true);
  const sideB = sideTextures(rand, false);
  // Verschiebung nur aus der stark geglätteten Höhe (Netz ≈ 0,3 mm) – feinere Riefen und Poren kommen über die Normal-Map
  const hEnd = smoothSampler(end.rb, 128), hA = smoothSampler(sideA.rb, 96), hB = smoothSampler(sideB.rb, 96);
  const heights = [hEnd, hEnd, hA, hA, hB, hB];

  const geo = new THREE.BoxGeometry(W, H, D, 160, 90, 80);
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const faceOf = new Int8Array(pos.count);
  const index = geo.index.array;
  geo.groups.forEach((g) => { for (let i = g.start; i < g.start + g.count; i++) faceOf[index[i]] = g.materialIndex; });

  // Abgeschlagene Kanten/Ecken: Hauptabplatzer + 2–3 kleinere, gekippte Sub-Abplatzer an ihrem Rand (muschelig gestuft)
  const corners = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push([sx * W / 2, sy * H / 2, sz * D / 2]);
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
  };
  for (let k = 0; k < 4; k++) addChip([(rand() - 0.5) * 0.3, (k & 1 ? 1 : -1) * (0.6 + rand() * 0.6), (k & 2 ? 1 : -1) * (0.6 + rand() * 0.6)], 0.1 + rand() * 0.28, 2);
  for (let k = 0; k < 7; k++) {
    const c = corners[Math.floor(rand() * 8)];
    addChip([c[0] * (0.4 + rand()), c[1] * (0.6 + rand()), c[2] * (0.6 + rand())], 0.25 + rand() * 0.4, 2 + Math.floor(rand() * 2));
  }
  addChip([-1, (rand() - 0.5) * 0.7, (rand() - 0.5) * 0.9], 0.45, 0);   // Bruchende links

  const colors = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const n = [nor.getX(i), nor.getY(i), nor.getZ(i)];
    let shade = 1;
    // Bruchende links: Terrassen quer zur Faser, dazu feine Splitter
    if (p.x < -W / 2 + 0.5) {
      const step = Math.floor(fbm3(p.y * 2.2 + 7, p.z * 2.2 + 3, 0.5, 3) * 5) / 5;
      const splinter = fbm3(p.y * 9, p.z * 9, 2, 2) - 0.5;
      const fiber = fbm3(p.y * 30, p.z * 30, 4, 2) - 0.5;          // einzelne herausstehende Faserbündel
      p.x = Math.max(p.x, -W / 2 + 0.44 * step + 0.05 * splinter + 0.025 * fiber);
    }
    let hit = null;
    for (const ch of chips) {
      const d = p.x * ch.n[0] + p.y * ch.n[1] + p.z * ch.n[2] - ch.c;
      if (d > 0) { p.set(p.x - ch.n[0] * d, p.y - ch.n[1] * d, p.z - ch.n[2] * d); hit = ch; }
    }
    const u = uv.getX(i), v = uv.getY(i), f = faceOf[i];
    if (hit) {
      // frische Bruchfläche: muschelige Wellen + Rauheit entlang der Abplatzer-Normale, glänzend schwarz
      const r = fbm3(p.x * 6 + 1, p.y * 6, p.z * 6, 3);
      const shell = Math.abs(Math.sin(r * 14 + hit.ripple));        // unregelmäßige Muschelbögen, keine parallelen Wellen
      const k = -0.005 * shell - 0.02 * (r - 0.5);
      p.set(p.x + hit.n[0] * k, p.y + hit.n[1] * k, p.z + hit.n[2] * k);
      shade = 0.6;
    } else {
      const h = heights[f](u, v);
      const crack = clamp((0.3 - h) / 0.3, 0, 1) * smoothstep(0, 0.05, Math.min(u, 1 - u, v, 1 - v));
      const bump = fbm3(p.x * 1.4 + 3, p.y * 1.4, p.z * 1.4, 3) - 0.5;
      // Relief aus der Höhe: Jahrringe/Strahlen auf der Stirnfläche ≈ 0,1 mm, Längsflächen flacher
      const relief = (h - 0.7) * (f < 2 ? 0.014 : 0.004);
      const k = -crack * 0.13 + bump * (f < 2 ? 0.05 : 0.09) + relief;
      p.set(p.x + n[0] * k, p.y + n[1] * k, p.z + n[2] * k);
    }
    pos.setXYZ(i, p.x, p.y, p.z);
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingBox();

  const matEnd = new THREE.MeshPhysicalMaterial({
    map: texture(end.col, true), normalMap: texture(sobelNormal(end.rb, 2.6, 3), false), normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: texture(end.rb, false), roughness: 1, metalness: 0.08, vertexColors: true,
  });
  const sideMat = (t) => new THREE.MeshPhysicalMaterial({
    map: texture(t.col, true), normalMap: texture(sobelNormal(t.rb, 1.6, 5), false), normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: texture(t.rb, false), roughness: 1, metalness: 0.22, vertexColors: true,
  });
  const matA = sideMat(sideA), matB = sideMat(sideB);
  const mats = [matEnd, matA, matB];
  const piece = new THREE.Mesh(geo, [matEnd, matEnd, matA, matA, matB, matB]);
  scene.add(piece);

  // Krümel, Splitter und Staub (Instanzen), gehäuft am Bruchende und unter den Abplatzern; je Krümel ein Kontaktschatten
  const floorY = geo.boundingBox.min.y;
  const crumbMat = new THREE.MeshPhysicalMaterial({ color: 0x1b1a19, roughness: 0.92, metalness: 0.1, clearcoat: 0.08, clearcoatRoughness: 0.6 });
  const crumbGeos = [crumbGeometry(1, 2, 0.6), crumbGeometry(2, 1, 0.5), crumbGeometry(3, 0, 0.7), crumbGeometry(4, 1, 0.35)];
  const sc = canvas(128, 128), sx = sc.getContext('2d');
  const grad = sx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sx.fillStyle = grad;
  sx.fillRect(0, 0, 128, 128);
  const shadowTex = texture(sc, true);
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const blobs = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), e3 = new THREE.Euler();
  const spot = () => {
    // Ort am Boden außerhalb des Stücks; die Hälfte liegt nahe dem linken Bruchende
    for (;;) {
      const nearEnd = rand() < 0.45;
      const x = nearEnd ? -W / 2 - 0.15 - rand() * 1.4 : (rand() - 0.5) * (W + 3.2);
      const z = (rand() - 0.5) * (D + 3.4);
      if (Math.abs(x) < W / 2 + 0.12 && Math.abs(z) < D / 2 + 0.12) continue;
      if (Math.hypot(x / 4.6, z / 3.4) > 1) continue;
      return [x, z];
    }
  };
  crumbGeos.forEach((g, gi) => {
    const count = [10, 12, 16, 10][gi];
    const mesh = new THREE.InstancedMesh(g, crumbMat, count);
    for (let k = 0; k < count; k++) {
      const s = gi === 2 ? 0.02 + rand() * 0.05 : 0.04 + Math.pow(rand(), 2) * 0.16;
      const [x, z] = spot();
      e3.set(rand() * 3, rand() * 3, rand() * 3);
      mesh.setMatrixAt(k, m4.compose(s3.set(x, floorY + s * 0.42, z), q.setFromEuler(e3), new THREE.Vector3(s, s, s)));
      blobs.push([x, z, s * 2.6]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  });
  // feiner Staub: 80–300 µm
  const dust = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), crumbMat, 420);
  for (let k = 0; k < 420; k++) {
    const [x, z] = spot();
    const s = 0.008 + Math.pow(rand(), 3) * 0.022;
    e3.set(rand() * 3, rand() * 3, rand() * 3);
    dust.setMatrixAt(k, m4.compose(s3.set(x, floorY + s * 0.3, z), q.setFromEuler(e3), new THREE.Vector3(s, s, s)));
  }
  dust.instanceMatrix.needsUpdate = true;
  scene.add(dust);
  const blobMesh = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }), blobs.length);
  blobs.forEach(([x, z, s], k) => blobMesh.setMatrixAt(k, m4.compose(s3.set(x, floorY - 0.004, z), q.identity(), new THREE.Vector3(s, 1, s))));
  blobMesh.instanceMatrix.needsUpdate = true;
  scene.add(blobMesh);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.7, D * 2.1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = floorY - 0.005;
  scene.add(shadow);
  // Lichtpool auf dem Tisch: warmer Fleck, der in den Hintergrund ausläuft
  const pc = canvas(512, 512), px = pc.getContext('2d');
  const pg = px.createRadialGradient(256, 256, 20, 256, 256, 256);
  pg.addColorStop(0, 'rgba(96,84,70,0.95)');
  pg.addColorStop(0.45, 'rgba(70,62,52,0.55)');
  pg.addColorStop(1, 'rgba(50,44,38,0)');
  px.fillStyle = pg;
  px.fillRect(0, 0, 512, 512);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: texture(pc, true), transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY - 0.01;
  scene.add(floor);

  // Licht: warmes Hauptlicht schwenkt langsam, kühles Gegenlicht streicht über die Längsflächen (Seidenglanz wandert)
  const key = new THREE.DirectionalLight(0xfff0dc, 2.7);
  const rim = new THREE.DirectionalLight(0xc4d6ff, 2.6);
  const fill = new THREE.HemisphereLight(0x8090a0, 0x050505, 0.35);
  const KEY0 = new THREE.Vector3(5, 7, 6), RIM0 = new THREE.Vector3(-7, 3, -6), Y = new THREE.Vector3(0, 1, 0);
  const moveLights = (t) => {
    key.position.copy(KEY0).applyAxisAngle(Y, 0.32 * Math.sin(t * 0.083));
    rim.position.copy(RIM0).applyAxisAngle(Y, 0.5 * Math.sin(t * 0.061 + 1.2));
    rim.position.y = 3 + 1.2 * Math.sin(t * 0.047);
    rim.intensity = 2.6 * (0.85 + 0.15 * Math.sin(t * 0.13 + 0.5));
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
    return heights[4](u, v) + Math.abs(u - 0.6) * 0.2;
  });
  const sheenPos = pick(2, (i) => Math.hypot(pos.getX(i) + 0.6, pos.getZ(i) - 0.25));

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
      { id: 'cracks', kind: 'info', pos: crackPos.add(new THREE.Vector3(0, 0, 0.04)), normal: new THREE.Vector3(0, 0, 1) },
      { id: 'sheen', kind: 'info', pos: sheenPos.add(new THREE.Vector3(0, 0.04, 0)), normal: new THREE.Vector3(0, 1, 0) },
    ],
    update(dt, t) {
      moveLights(t);
      return true;
    },
    setParam(name, value) {
      if (name !== 'temp') return;
      // niedrig verkohlt: bräunlich und matt · hoch verkohlt: neutral schwarz, seidig glänzend
      const k = clamp((value - 350) / 450, 0, 1);
      const brown = clamp((450 - value) / 100, 0, 1);   // ab ≈ 450 °C tiefschwarz
      const tint = new THREE.Color(lerp(0.72, 1.9, brown), lerp(0.72, 1.3, brown), lerp(0.74, 0.95, brown));
      for (const m of mats) {
        m.color.copy(tint);
        m.metalness = m === matEnd ? lerp(0.02, 0.1, k) : lerp(0.04, 0.3, k);
        m.roughness = lerp(1.15, 0.85, k);
        m.clearcoat = m === matEnd ? 0 : lerp(0, 0.55, k);   // Seidenglanz der Längsflächen
        m.clearcoatRoughness = 0.5;
      }
      crumbMat.color.copy(tint).multiplyScalar(0.11);
      level.dirty = true;
    },
    dispose() { disposeGroup(scene); },
  };
  level.setParam('temp', ctx.temp);
  return level;
}
