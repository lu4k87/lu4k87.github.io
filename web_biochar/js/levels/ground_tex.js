// Texturen des Waldbodens in Ebene 1 (Einheit cm): Boden als nahtlose Kachel aus Humus mit Laubresten (Boden:A) und
// Krümelgefüge mit Kohlesplittern (Terra preta, Boden:B), fleckig gemischt; dazu Rinde und Buchenblätter.
// Läuft als Modul-Worker (OffscreenCanvas, rechnet 2–5 s neben dem Aufbau), Ersatz im Hauptthread über paintAll().
// Ohne three.js: Worker kennen die Importmap nicht. Relief jeweils als Normal-Map (Sobel).
import { mulberry32, clamp, lerp, smoothstep } from '../util.js';

export const TILE = 8.5;          // cm je Kachel
const PX = 2048;

// ---------- Rauschen ----------
function hash2(a, b, s) {
  let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(s + 17, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
// Wertrauschen 0 … 1, periodisch mit P Zellen
export function pnoise(x, y, P, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const w = (k) => ((k % P) + P) % P;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const x0 = w(ix), x1 = w(ix + 1), y0 = w(iy), y1 = w(iy + 1);
  return lerp(lerp(hash2(x0, y0, s), hash2(x1, y0, s), u), lerp(hash2(x0, y1, s), hash2(x1, y1, s), u), v);
}
// u, v in [0, 1); P = Zellen je Kachel in der ersten Oktave
function pfbm(u, v, P, oct, s) {
  let t = 0, a = 0.5, n = 0, x = u * P, y = v * P;
  for (let o = 0; o < oct; o++) { t += a * pnoise(x, y, P, s + o * 7); n += a; x *= 2; y *= 2; P *= 2; a *= 0.5; }
  return t / n;
}
function worley(G, s) {
  const pts = new Float32Array(G * G * 2);
  for (let i = 0; i < G * G; i++) { pts[2 * i] = hash2(i, 1, s); pts[2 * i + 1] = hash2(i, 2, s); }
  const out = [0, 0, 0];
  return (u, v) => {
    const x = u * G, y = v * G, ix = Math.floor(x), iy = Math.floor(y);
    let f1 = 9, f2 = 9, id = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cy = iy + dy, k = (((cy % G) + G) % G) * G + (((cx % G) + G) % G);
      const d = Math.hypot(cx + pts[2 * k] - x, cy + pts[2 * k + 1] - y);
      if (d < f1) { f2 = f1; f1 = d; id = k; } else if (d < f2) f2 = d;
    }
    out[0] = f1; out[1] = f2; out[2] = id;
    return out;
  };
}

const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
const shade = (c, rand, k) => { const f = 1 + (rand() - 0.5) * k, w = 1 + (rand() - 0.5) * 0.08; return [c[0] * f * w, c[1] * f, c[2] * f / w].map((v) => clamp(v, 0, 1)); };

// ---------- Textur-Werkstatt ----------
const makeCanvas = (w, h) => new OffscreenCanvas(w, h || w);

// Grund pixelweise (base(u, v) → [r, g, b, h]), danach Zeichnen mit Umbruch über die Kachelränder.
// k > 1: Grund in 1/k Auflösung rechnen und weich hochskalieren (k = 2 spart ¾ der Rechenzeit; die gezeichneten
// Körner, Laubstücke und Wurzeln bleiben in voller Auflösung scharf)
function paint(W, H, base, draw, rand, k = 1) {
  const col = makeCanvas(W, H), hgt = makeCanvas(W, H);
  const cx = col.getContext('2d'), hx = hgt.getContext('2d', { willReadFrequently: true });
  const w = W / k, h = H / k, sc = makeCanvas(w, h), sh = makeCanvas(w, h);
  const scx = sc.getContext('2d'), shx = sh.getContext('2d');
  const ci = scx.createImageData(w, h), hi = shx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = base(x / w, y / h), o = (y * w + x) * 4;
    ci.data[o] = r[0] * 255; ci.data[o + 1] = r[1] * 255; ci.data[o + 2] = r[2] * 255; ci.data[o + 3] = 255;
    hi.data[o] = hi.data[o + 1] = hi.data[o + 2] = r[3] * 255; hi.data[o + 3] = 255;
  }
  scx.putImageData(ci, 0, 0); shx.putImageData(hi, 0, 0);
  for (const [dst, src] of [[cx, sc], [hx, sh]]) {
    dst.imageSmoothingQuality = 'high';
    dst.drawImage(src, 0, 0, W, H);
  }
  const wrap = (x, y, r, f) => {
    for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
      if (x + ox > -r && x + ox < W + r && y + oy > -r && y + oy < H + r) f(x + ox, y + oy);
    }
  };
  draw && draw({ cx, hx, W, H, rand, wrap });
  return { col, hgt };
}
// unregelmäßiges Korn: Farbe + Höhe (h > 0 hebt, < 0 senkt)
function blob(cx, hx, x, y, r, c, h, rand, el = 1, rot = 0) {
  const n = 8 + Math.floor(rand() * 4), pts = [];
  const cs = Math.cos(rot), sn = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, rr = r * (0.6 + 0.55 * rand()), px = Math.cos(a) * rr * el, py = Math.sin(a) * rr;
    pts.push([x + px * cs - py * sn, y + px * sn + py * cs]);
  }
  const path = (ctx) => {                                   // Kurve durch die Kantenmitten → runde, unregelmäßige Form
    ctx.beginPath();
    const m = (i) => { const a = pts[i % n], b = pts[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    ctx.moveTo(...m(0));
    for (let i = 1; i <= n; i++) ctx.quadraticCurveTo(pts[i % n][0], pts[i % n][1], ...m(i));
    ctx.closePath();
  };
  cx.fillStyle = typeof c === 'string' ? c : css(c); path(cx); cx.fill();
  if (h) {
    const g = hx.createRadialGradient(x, y, 0, x, y, r * 1.1);
    const v = h > 0 ? 255 : 0, a = Math.abs(h);
    g.addColorStop(0, `rgba(${v},${v},${v},${a})`); g.addColorStop(1, `rgba(${v},${v},${v},${a * 0.25})`);
    hx.fillStyle = g; path(hx); hx.fill();
  }
}
function strand(cx, hx, pts, w, c, h) {
  for (const [ctx, style] of [[cx, typeof c === 'string' ? c : css(c)], [hx, h > 0 ? `rgba(255,255,255,${h})` : `rgba(0,0,0,${-h})`]]) {
    ctx.strokeStyle = style; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
}
function wobble(x, y, len, ang, rand, n = 6, curl = 0.5) {
  const pts = [[x, y]];
  for (let i = 1; i <= n; i++) { ang += (rand() - 0.5) * curl; x += Math.cos(ang) * len / n; y += Math.sin(ang) * len / n; pts.push([x, y]); }
  return pts;
}
function normalFrom(hgt, strength, blur = 1.2) {
  const W = hgt.width, H = hgt.height;
  if (blur) {
    const big = makeCanvas(W * 3, H * 3), bx = big.getContext('2d');
    for (let i = 0; i < 9; i++) bx.drawImage(hgt, (i % 3) * W, Math.floor(i / 3) * H);
    const sm = makeCanvas(W, H), sx = sm.getContext('2d', { willReadFrequently: true });
    sx.filter = `blur(${blur}px)`; sx.drawImage(big, -W, -H); hgt = sm;
  }
  const d = hgt.getContext('2d').getImageData(0, 0, W, H).data;
  const out = makeCanvas(W, H), ox = out.getContext('2d'), img = ox.createImageData(W, H);
  const at = (x, y) => d[((((y % H) + H) % H) * W + (((x % W) + W) % W)) * 4] / 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -gx * strength, ny = gy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const o = (y * W + x) * 4;
    img.data[o] = (nx * 0.5 + 0.5) * 255; img.data[o + 1] = (ny * 0.5 + 0.5) * 255; img.data[o + 2] = (nz * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  ox.putImageData(img, 0, 0);
  return out;
}

// ---------- Boden ----------
// Albedo bewusst dunkel und entsättigt (Humus ≈ 5–8 %): das Kohlestück bleibt das Hellste im Bild.
// Großflächige Maske m: 0 = Waldboden-Fleck (Humus, Laubreste, Moosschimmer), 1 = Terra-preta-Fleck (Krümel mit
// Porenrändern, Kohle); gezeichnete Teile folgen der Maske (Laub eher im Humus, Kohle eher in der Terra preta).
function soilTex(rand, S) {
  const wa = worley(40, 5 + S), wb = worley(110, 8 + S);
  const dark = hex(0x16110d), mid = hex(0x271d16), moss = hex(0x26261a), c0 = hex(0x18120e), c1 = hex(0x2f241b);
  const mask = (u, v) => smoothstep(0.42, 0.6, pfbm(u, v, 3, 4, 51 + S));
  const { col, hgt } = paint(PX, PX, (u, v) => {
    const m = mask(u, v);
    let a = [0, 0, 0, 0], b = a;
    if (m < 0.999) {
      const n = pfbm(u, v, 6, 6, 3 + S), f = pfbm(u, v, 48, 3, 9 + S), g = pfbm(u, v, 3, 3, 21 + S);
      const c = mix3(mix3(dark, mid, smoothstep(0.3, 0.72, n)), moss, 0.3 * smoothstep(0.6, 0.8, g));
      a = [...c.map((x) => x * (0.82 + 0.36 * f)), 0.35 + 0.3 * n + 0.15 * f];
    }
    if (m > 0.001) {
      const du = (pfbm(u, v, 8, 2, 4 + S) - 0.5) * 0.02, dv = (pfbm(u, v, 8, 2, 5 + S) - 0.5) * 0.02;
      const uu = (u + du + 1) % 1, vv = (v + dv + 1) % 1;
      const [f1, f2, id] = wa(uu, vv), edge = f2 - f1;
      const [g1, g2] = wb(uu, vv), e2 = g2 - g1;
      const cell = hash2(id, 3, 4 + S), n = pfbm(u, v, 5, 4, 2 + S);
      const pore = 1 - smoothstep(0.02, 0.14, edge), pore2 = 1 - smoothstep(0.03, 0.16, e2);
      const c = mix3(c0, c1, 0.25 + 0.45 * cell * n + 0.25 * n).map((x) => x * (1 - 0.7 * pore) * (1 - 0.22 * pore2));
      b = [...c, (0.25 + 0.55 * Math.sqrt(smoothstep(0.0, 0.5, edge)) + 0.12 * cell) * (1 - 0.3 * pore2)];
    }
    return [lerp(a[0], b[0], m), lerp(a[1], b[1], m), lerp(a[2], b[2], m), lerp(a[3], b[3], m)];
  }, ({ cx, hx, W, rand, wrap }) => {
    const at = (x, y) => mask(x / W, y / W);
    for (let i = 0; i < 3000; i++) {                       // Humus-Krümel unter der Streu
      const x = rand() * W, y = rand() * W, r = 2 + rand() * 7;
      if (rand() < at(x, y) * 0.8) continue;
      wrap(x, y, r * 2, (X, Y) => blob(cx, hx, X, Y, r, shade([0.1, 0.075, 0.055], rand, 0.35), 0.3, rand));
    }
    const litter = [0x35251a, 0x3f2b1d, 0x4a3322, 0x2e2219, 0x4f3a2a, 0x3a3026].map(hex);
    cx.filter = 'blur(1.6px)';                             // Laubstückchen 0,3–4 mm; ältere Lage unscharf, halb zersetzt
    for (let i = 0; i < 3600; i++) {
      if (i === 2200) cx.filter = 'none';
      const x = rand() * W, y = rand() * W, r = 3 + Math.pow(rand(), 3) * 46, c = shade(litter[Math.floor(rand() * litter.length)], rand, 0.25);
      const rot = rand() * 6.28, el = 1 + rand() * 1.2, a = (i < 2200 ? 0.4 : 0.5) + 0.4 * rand();
      if (rand() < at(x, y) * 0.85) continue;
      wrap(x, y, r * 2.5, (X, Y) => {
        blob(cx, hx, X, Y, r, css(c, a), 0.07, rand, el, rot);
        if (r > 26) strand(cx, hx, [[X - Math.cos(rot) * r * el * 0.7, Y - Math.sin(rot) * r * 0.7], [X + Math.cos(rot) * r * el * 0.7, Y + Math.sin(rot) * r * 0.7]], 1.2, css(mix3(c, [0.7, 0.6, 0.45], 0.18), 0.5 * a), 0.2);
      });
    }
    cx.filter = 'none';
    for (let i = 0; i < 2000; i++) {                       // Kohlestückchen, schwarz und kantig
      const x = rand() * W, y = rand() * W, r = 2 + Math.pow(rand(), 2.8) * 22;
      if (rand() > 0.2 + 0.8 * at(x, y)) continue;
      wrap(x, y, r * 2, (X, Y) => blob(cx, hx, X, Y, r, shade([0.035, 0.034, 0.033], rand, 0.4), 0.45, rand, 1 + rand(), rand() * 6.28));
    }
    for (let i = 0; i < 900; i++) {                        // Sandkörner, wenige helle
      const x = rand() * W, y = rand() * W, r = 1.2 + rand() * 3;
      wrap(x, y, r * 2, (X, Y) => blob(cx, hx, X, Y, r, css(shade([0.36, 0.32, 0.26], rand, 0.3), 0.8), 0.5, rand));
    }
    for (let i = 0; i < 260; i++) {                        // Feinwurzeln, Wurzelhaare und Fasern
      const x = rand() * W, y = rand() * W, pts = wobble(x, y, 30 + rand() * 140, rand() * 6.28, rand, 9, 0.85);
      const c = i % 2 ? [0.42, 0.34, 0.25] : [0.55, 0.48, 0.38];
      wrap(x, y, 180, (X, Y) => strand(cx, hx, pts.map(([p, q]) => [p - x + X, q - y + Y]), 0.8 + rand() * 1.4, css(c, 0.55), 0.35));
    }
    for (let i = 0; i < 1500; i++) {                       // obenauf: einzelne Krümel und Poren
      const x = rand() * W, y = rand() * W, r = 1.5 + rand() * 5, pore = rand() < 0.5;
      wrap(x, y, r * 2, (X, Y) => blob(cx, hx, X, Y, r, pore ? css([0.03, 0.025, 0.02], 0.6) : shade([0.12, 0.09, 0.065], rand, 0.3), pore ? -0.4 : 0.35, rand));
    }
  }, rand, 2);
  return { col, nor: normalFrom(hgt, 1.25) };
}

// ---------- Rinde, Blatt ----------
// Rinde eines Buchenästchens: grau-braun mit Streifen, Korkporen und blassen Flechten
function barkTex(rand) {
  const W = 768, H = 128, base = hex(0x3f3831);
  const { col, hgt } = paint(W, H, (u, v) => {
    const s = pfbm(u, v, 48, 3, 12), n = pfbm(u, v, 12, 4, 3);
    const streak = pnoise(u * 9, v * 14, 9, 5), fur = smoothstep(0.62, 0.8, pnoise(u * 5, v * 22, 5, 9));
    return [...base.map((x) => x * (0.7 + 0.45 * n + 0.15 * streak) * (1 - 0.55 * fur)), (0.55 + 0.2 * streak + 0.15 * s) * (1 - 0.6 * fur)];
  }, ({ cx, hx, rand, wrap }) => {
    for (let i = 0; i < 40; i++) {                         // Korkporen (Lentizellen), wenige
      const x = rand() * W, y = rand() * H;
      wrap(x, y, 12, (X, Y) => blob(cx, hx, X, Y, 1.5 + rand() * 1.5, css(mix3(base, [0.7, 0.65, 0.55], 0.3), 0.8), 0.4, rand, 0.45, 0));
    }
    for (let i = 0; i < 12; i++) {                         // Flechten, blass
      const x = rand() * W, y = rand() * H, r = 3 + rand() * 7;
      wrap(x, y, r * 2, (X, Y) => blob(cx, hx, X, Y, r, css(shade([0.36, 0.38, 0.3], rand, 0.2), 0.7), 0.3, rand));
    }
  }, rand);
  return { col, nor: normalFrom(hgt, 4, 0.6) };
}

// Buchenblatt (Fagus sylvatica): eiförmig, 7 Paar gerade Seitennerven, leicht welliger Rand; Alpha = Umriss.
// kind: plain · holes (Fraßlöcher) · frag (zerrissenes Stück)
function leafTex(kind, rand) {
  const N = 512, col = makeCanvas(N), hgt = makeCanvas(N);
  const cx = col.getContext('2d'), hx = hgt.getContext('2d');
  hx.fillStyle = '#808080'; hx.fillRect(0, 0, N, N);
  const L0 = 40, L1 = 480, Wm = 150, mid = N / 2;
  const half = (s) => Wm * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.82)), 0.95) * (1 - 0.12 * s) * (1 + 0.035 * Math.sin(s * Math.PI * 15));
  const outline = (ctx) => {
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) { const s = i / 80; ctx.lineTo(L0 + s * (L1 - L0), mid - half(s)); }
    for (let i = 80; i >= 0; i--) { const s = i / 80; ctx.lineTo(L0 + s * (L1 - L0), mid + half(s)); }
    ctx.closePath();
  };
  const c0 = hex(0x3a2416), c1 = hex(0x553420);
  const g = cx.createLinearGradient(L0, 0, L1, 0);
  g.addColorStop(0, css(c0)); g.addColorStop(0.5, css(c1)); g.addColorStop(1, css(mix3(c0, c1, 0.4)));
  cx.fillStyle = g; outline(cx); cx.fill();
  cx.save(); outline(cx); cx.clip();
  {                                                        // Fleckung in zwei Größen + dunklere Randzone
    const img = cx.getImageData(0, 0, N, N), d = img.data, s0 = Math.floor(rand() * 100);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const o = (y * N + x) * 4;
      if (!d[o + 3]) continue;
      const s = (x - L0) / (L1 - L0), edge = clamp(Math.abs(y - mid) / Math.max(1, half(clamp(s, 0, 1))), 0, 1);
      const k = (0.72 + 0.5 * pfbm(x / N, y / N, 6, 4, s0) + 0.18 * (pnoise(x * 0.35, y * 0.35, 179, s0 + 3) - 0.5)) * (1 - 0.35 * smoothstep(0.7, 1, edge));
      d[o] *= k; d[o + 1] *= k * 0.97; d[o + 2] *= k * 0.94;
    }
    cx.putImageData(img, 0, 0);
  }
  for (let i = 0; i < 90; i++) {                           // Flecken, Zersetzung
    const x = L0 + rand() * (L1 - L0), y = mid + (rand() - 0.5) * 2 * Wm, r = 4 + rand() * 26;
    blob(cx, hx, x, y, r, css(shade([0.2, 0.13, 0.08], rand, 0.4), 0.2 + rand() * 0.25), 0, rand);
  }
  const vein = 'rgba(150,108,70,0.32)';
  strand(cx, hx, [[L0 - 30, mid], [L1, mid]], 5, vein, 0.6);  // Mittelrippe mit Stiel
  for (let k = 1; k <= 7; k++) {
    const s = 0.08 + k * 0.105, x = L0 + s * (L1 - L0);
    for (const sg of [-1, 1]) strand(cx, hx, [[x, mid], [x + 0.13 * (L1 - L0), mid + sg * half(Math.min(1, s + 0.13)) * 0.94]], 2.4, vein, 0.45);
  }
  cx.restore();
  if (kind === 'frag') {                                   // zerrissenes Stück: Rand gezackt ausgefressen
    cx.globalCompositeOperation = 'destination-in';
    blob(cx, hx, 260, mid, 150, '#000', 0, rand, 1.25, rand() * 6.28);
    cx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 14; i++) { const a = rand() * 6.28; blob(cx, hx, 260 + Math.cos(a) * 170, mid + Math.sin(a) * 140, 14 + rand() * 30, '#000', 0, rand); }
    cx.globalCompositeOperation = 'source-over';
  } else if (kind === 'holes') {                           // Fraßlöcher
    cx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) blob(cx, hx, L0 + (0.15 + rand() * 0.7) * (L1 - L0), mid + (rand() - 0.5) * Wm, 5 + rand() * 16, '#000', 0, rand);
    cx.globalCompositeOperation = 'source-over';
  }
  return { col, nor: normalFrom(hgt, 3) };
}

// ---------- alle Texturen eines Seeds ----------
// Ergebnis: { soil, bark, leaf: { plain, holes, frag } } je { col, nor } als ImageBitmap (Zeilen schon gespiegelt wie
// bei flipY, Alpha nicht vormultipliziert), ms = Rechenzeit
export async function paintAll(seed) {
  const t0 = performance.now();
  const rand = mulberry32(seed ^ 0x5bd1e995), S = seed % 997;
  const bmp = (c) => createImageBitmap(c, { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
  const pair = async ({ col, nor }) => ({ col: await bmp(col), nor: await bmp(nor) });
  const out = {
    soil: await pair(soilTex(rand, S)),
    bark: await pair(barkTex(rand)),
    leaf: {},
  };
  for (const k of ['plain', 'holes', 'frag']) out.leaf[k] = await pair(leafTex(k, rand));
  out.ms = Math.round(performance.now() - t0);
  return out;
}

export const bitmapsOf = (o) => [o.soil, o.bark, ...Object.values(o.leaf)].flatMap((p) => [p.col, p.nor]);

// als Worker: { seed } → Texturen (übertragen, nicht kopiert) oder { error }
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = async (e) => {
    try {
      const out = await paintAll(e.data.seed);
      self.postMessage(out, bitmapsOf(out));
    } catch (err) {
      self.postMessage({ error: String(err) });
    }
  };
}
