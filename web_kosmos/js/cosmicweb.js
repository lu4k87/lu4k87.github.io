// Kosmisches Netz für den Urknall-Film (Station 11), einmal auf der CPU gerechnet, ohne three.js (Test
// tests/cosmicweb.test.js). Eine Quelle für alles: dieselbe Dichte zeichnet die Fäden (3D-Textur im Shader), setzt Sterne,
// Galaxien und Lichtpunkte und bestimmt ihre Geburt (dicht = früh). Mitbewegte Koordinaten: Front = Radius 1, das Feld
// reicht bis ±EXT. Kanäle: r = Grat-Rauschen (Fäden an den Nulldurchgängen), g = großräumige Dichte (Leerräume, Flecken
// der Hintergrundstrahlung), b = Farbmischung. Gradientenrauschen mit Ganzzahl-Hash: gleich in jedem Browser.

export const EXT = 1.1, Q = 2.6;   // Feldwürfel ±EXT, Muster = Ort × Q
const ROT = [0.0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64];   // Oktaven gegeneinander gedreht (kein Raster)
// Gradient aus 12 Kantenrichtungen des Würfels (Perlin-Bittrick, ohne Tabelle)
function grad(ix, iy, iz, x, y, z) {
  let h = Math.imul(ix, 0x8da6b343) ^ Math.imul(iy, 0xd8163841) ^ Math.imul(iz, 0xcb1ab31f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = (Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 13) % 12;
  const u = h < 8 ? x : y, v = h < 4 ? y : h === 8 || h === 9 ? x : z;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
export function gnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fade(fx), v = fade(fy), w = fade(fz);
  return lerp(
    lerp(lerp(grad(ix, iy, iz, fx, fy, fz), grad(ix + 1, iy, iz, fx - 1, fy, fz), u),
      lerp(grad(ix, iy + 1, iz, fx, fy - 1, fz), grad(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz), u), v),
    lerp(lerp(grad(ix, iy, iz + 1, fx, fy, fz - 1), grad(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1), u),
      lerp(grad(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1), grad(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1), u), v), w);
}
function octaves(x, y, z, oct, gain, ridge) {
  let s = 0, a = 0.5, wt = 1;
  for (let i = 0; i < oct; i++) {
    let n = gnoise(x, y, z);
    if (ridge) { n = 1 - Math.abs(n); n *= n * wt; wt = Math.min(1, Math.max(0, n * 1.6)); }
    s += a * n;
    const X = (ROT[0] * x + ROT[3] * y + ROT[6] * z) * gain, Y = (ROT[1] * x + ROT[4] * y + ROT[7] * z) * gain;
    z = (ROT[2] * x + ROT[5] * y + ROT[8] * z) * gain; x = X; y = Y;
    a *= 0.5;
  }
  return s;
}
const byte = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);

// Feld backen: size³ Zellen RGBA8; pause() zwischen Scheiben (Ladebild läuft weiter), Node: ohne Pause
export async function bakeWeb(size = 112, pause = null) {
  const data = new Uint8Array(size * size * size * 4);
  for (let k = 0, o = 0; k < size; k++) {
    const z = ((k + 0.5) / size * 2 - 1) * EXT * Q;
    for (let j = 0; j < size; j++) {
      const y = ((j + 0.5) / size * 2 - 1) * EXT * Q;
      for (let i = 0; i < size; i++, o += 4) {
        const x = ((i + 0.5) / size * 2 - 1) * EXT * Q;
        data[o] = byte(octaves(x + 11, y + 11, z + 11, 4, 2.11, true));
        data[o + 1] = byte(octaves(x * 0.45 + 15, y * 0.45 + 15, z * 0.45 + 15, 3, 2.03, false) * 0.5 + 0.5);
        data[o + 2] = byte(gnoise(x * 0.7 + 20, y * 0.7 + 20, z * 0.7 + 20) * 0.5 + 0.5);
        data[o + 3] = 255;
      }
    }
    if (pause && k % 8 === 7) await pause();
  }
  return { size, data };
}

// Dichte am mitbewegten Ort (trilinear, wie die Textur im Shader): Fäden × keine Leere, 0 … 1; thin = Schwelle der Fäden
export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function webAt(w, x, y, z) {
  const n = w.size, f = (c) => Math.min(n - 1.001, Math.max(0, (c / (2 * EXT) + 0.5) * n - 0.5));
  const X = f(x), Y = f(y), Z = f(z), i = Math.floor(X), j = Math.floor(Y), k = Math.floor(Z), u = X - i, v = Y - j, s = Z - k;
  const out = [0, 0];
  for (let c = 0; c < 2; c++) {
    const at = (a, b, d) => w.data[(((k + d) * n + j + b) * n + i + a) * 4 + c] / 255;
    out[c] = lerp(lerp(lerp(at(0, 0, 0), at(1, 0, 0), u), lerp(at(0, 1, 0), at(1, 1, 0), u), v),
      lerp(lerp(at(0, 0, 1), at(1, 0, 1), u), lerp(at(0, 1, 1), at(1, 1, 1), u), v), s);
  }
  return out;
}
export const THIN = 0.66;
export function density(w, x, y, z, thin = THIN) {
  const [r, g] = webAt(w, x, y, z);
  return Math.pow(sstep(thin, 0.95, r), 2.5) * sstep(-0.1, 0.4, g * 2 - 1);
}

// Orte auf dem Netz: Kandidaten gleichmäßig aus pick (Standard: Kugel bis r = 0,95), angenommen mit Wahrscheinlichkeit
// (d / top)^power – dichte Knoten bekommen die meisten; höchstens tries Versuche je Ort (dünnes Gebiet → weniger Orte)
export const inBall = (rand, R = 0.95) => {
  for (;;) { const x = rand() * 2 - 1, y = rand() * 2 - 1, z = rand() * 2 - 1; if (x * x + y * y + z * z < 1) return [x * R, y * R, z * R]; }
};
// gleichmäßig im Schlauch um die Achse a (Einheitsvektor) zwischen den Längen along und den Radien rad
export function inTube(a, along, rad) {
  const h = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = [a[1] * h[2] - a[2] * h[1], a[2] * h[0] - a[0] * h[2], a[0] * h[1] - a[1] * h[0]], l = Math.hypot(...e1);
  for (let i = 0; i < 3; i++) e1[i] /= l;
  const e2 = [a[1] * e1[2] - a[2] * e1[1], a[2] * e1[0] - a[0] * e1[2], a[0] * e1[1] - a[1] * e1[0]];
  return (rand) => {
    const t = along[0] + (along[1] - along[0]) * rand(), r = Math.sqrt(rad[0] ** 2 + (rad[1] ** 2 - rad[0] ** 2) * rand()), th = rand() * 2 * Math.PI;
    const c = r * Math.cos(th), s = r * Math.sin(th);
    return [0, 1, 2].map((i) => a[i] * t + e1[i] * c + e2[i] * s);
  };
}
export function sampleWeb(w, rand, n, { power = 1, thin = THIN, top = 0.5, pick = inBall, tries = 400 } = {}) {
  const list = [];
  for (let t = 0; list.length < n && t < n * tries; t++) {
    const [x, y, z] = pick(rand), d = density(w, x, y, z, thin);
    if (d > 0 && rand() < Math.pow(Math.min(1, d / top), power)) list.push({ x, y, z, d });
  }
  return list;
}

// Flugachse durch die Mitte entlang möglichst viel Netz: Kandidaten nahe der Wunschrichtung, Dichte entlang der Fahrt
// (von außen bis hinter die Mitte) summiert, dazu die Dichte in einem engen Schlauch um die Achse
export function flightAxis(w, rand, prefer, n = 240, span = [-0.75, 1]) {
  let best = prefer, score = -1;
  for (let i = 0; i < n; i++) {
    const c = i ? [prefer[0] + (rand() * 2 - 1) * 0.6, prefer[1] + (rand() * 2 - 1) * 0.6, prefer[2] + (rand() * 2 - 1) * 0.3] : prefer;
    const l = Math.hypot(...c), a = c.map((v) => v / l);
    let s = 0;
    for (let t = span[0]; t <= span[1]; t += 0.02) s += density(w, a[0] * t, a[1] * t, a[2] * t, THIN - 0.08);
    if (s > score) { score = s; best = a; }
  }
  return best;
}
