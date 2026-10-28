// Rechenkern der Station 05A Dunkle Materie (ohne three.js, auch im Worker und in Node): Anfangsfeld im ΛCDM-Modell und
// Zeldovich-Näherung (Zel'dovich 1970). Dichteschwankungen als Gauß-Feld mit dem Spektrum P(k) ∝ k^ns T(k)² (Transfer nach
// Bardeen et al. 1986 mit Γ nach Sugiyama 1995), normiert auf σ8 aus Planck 2018. Verschiebung ψ = −∇φ, ∇²φ = δ (im Fourier-
// Raum ψ̂ = i k δ̂ / k²), geglättet wie in der „abgeschnittenen“ Zeldovich-Näherung (Coles et al. 1993); Ort eines Teilchens
// x = q + D(t)·ψ(q) mit dem Wachstumsfaktor D. Halos: Dichtespitzen am Ende (D = 1), Zeitpunkt des Kollapses aus dem
// linearen Feld am Ort des Halos (sphärischer Kollaps bei D·δ = 1,686). Alles „Modell“ bzw. „eigene Rechnung“.

export const PLANCK = { h: 0.6766, Om: 0.3111, Ob: 0.0490, ns: 0.9665, s8: 0.8102 };   // Planck 2018 (TT,TE,EE+lowE+lensing+BAO)

// Wachstumsfaktor im flachen ΛCDM ohne Strahlung: D(a) ∝ H(a) ∫₀ᵃ da′ / (a′ H(a′))³, normiert auf D(1) = 1
const E = (a) => Math.sqrt(PLANCK.Om / a ** 3 + 1 - PLANCK.Om);
function growthRaw(a, n = 400) {
  let s = 0;
  for (let i = 0; i < n; i++) { const x = a * (i + 0.5) / n; s += 1 / (x * E(x)) ** 3; }
  return 2.5 * PLANCK.Om * E(a) * s * a / n;
}
const G1 = growthRaw(1);
export const growth = (a) => growthRaw(a) / G1;
// Alter bei Skalenfaktor a [Mrd. Jahre]: t = ∫ da / (a H), H₀ = 100 h km/s/Mpc → 1/H₀ = 977,8/h Mrd. Jahre
export function ageAt(a, n = 400) {
  let s = 0;
  for (let i = 0; i < n; i++) { const x = a * (i + 0.5) / n; s += 1 / (x * E(x)); }
  return (977.8 / (100 * PLANCK.h)) * s * a / n;
}
export const AGE = ageAt(1);
// Tabelle Alter → (z, D) für den Zeitregler; zwischen den Stützstellen linear
const TAB = Array.from({ length: 241 }, (_, i) => { const a = 10 ** (-1.7 + 1.7 * i / 240); return [ageAt(a), 1 / a - 1, growth(a)]; });
export function atAge(t) {
  if (t <= TAB[0][0]) return { z: TAB[0][1], D: TAB[0][2] * t / TAB[0][0] };
  for (let i = 1; i < TAB.length; i++) if (t <= TAB[i][0]) {
    const u = (t - TAB[i - 1][0]) / (TAB[i][0] - TAB[i - 1][0]);
    return { z: TAB[i - 1][1] + u * (TAB[i][1] - TAB[i - 1][1]), D: TAB[i - 1][2] + u * (TAB[i][2] - TAB[i - 1][2]) };
  }
  return { z: 0, D: 1 };
}

// Spektrum [Mpc³] bei k [1/Mpc]; A aus σ8 (Kugel 8/h Mpc, Top-Hat-Fenster)
function transfer(k) {
  const { h, Om, Ob } = PLANCK, G = Om * h * Math.exp(-Ob * (1 + Math.sqrt(2 * h) / Om));
  const q = k / h / G;
  if (q < 1e-8) return 1;
  return Math.log(1 + 2.34 * q) / (2.34 * q) * (1 + 3.89 * q + (16.1 * q) ** 2 + (5.46 * q) ** 3 + (6.71 * q) ** 4) ** -0.25;
}
const shape = (k) => k ** PLANCK.ns * transfer(k) ** 2;
export function sigmaR(R, P = shape) {
  let s = 0;
  const n = 4000, l0 = Math.log(1e-4), l1 = Math.log(50);
  for (let i = 0; i < n; i++) {
    const k = Math.exp(l0 + (l1 - l0) * (i + 0.5) / n), x = k * R;
    const W = x < 1e-3 ? 1 : 3 * (Math.sin(x) - x * Math.cos(x)) / x ** 3;
    s += k ** 3 * P(k) * W * W;
  }
  return Math.sqrt(s * (l1 - l0) / n / (2 * Math.PI ** 2));
}
const AMP = (PLANCK.s8 / sigmaR(8 / PLANCK.h)) ** 2;
export const power = (k) => AMP * shape(k);
// Masse eines Teilchens [M☉]: ρ̄_m = Ω_m · 2,775·10¹¹ h² M☉/Mpc³ mal Zellvolumen
export const particleMass = (L, N) => PLANCK.Om * 2.775e11 * PLANCK.h ** 2 * (L / N) ** 3;

// Zufall wie astro.js mulberry32 (hier eigene Kopie: der Worker lädt nur diese Datei)
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// FFT in place über eine Achse (Radix 2), re/im mit Schrittweite stride, n Punkte ab off
function fft1(re, im, off, stride, n, inv, tw) {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const a = off + i * stride, b = off + j * stride; let t = re[a]; re[a] = re[b]; re[b] = t; t = im[a]; im[a] = im[b]; im[b] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const step = n / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
      const c = tw[2 * k * step], s = (inv ? -1 : 1) * tw[2 * k * step + 1];
      const a = off + (i + k) * stride, b = off + (i + k + len / 2) * stride;
      const xr = re[b] * c - im[b] * s, xi = re[b] * s + im[b] * c;
      re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
    }
  }
}
function fft3(re, im, N, inv) {
  const tw = new Float64Array(N);
  for (let k = 0; k < N / 2; k++) { tw[2 * k] = Math.cos(-2 * Math.PI * k / N); tw[2 * k + 1] = Math.sin(-2 * Math.PI * k / N); }
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) fft1(re, im, (z * N + y) * N, 1, N, inv, tw);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) fft1(re, im, z * N * N + x, N, N, inv, tw);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) fft1(re, im, y * N + x, N * N, N, inv, tw);
  if (inv) { const s = 1 / N ** 3; for (let i = 0; i < re.length; i++) { re[i] *= s; im[i] *= s; } }
}

// Anfangsfeld + Halos. L Kantenlänge [Mpc], N Teilchen je Kante (Zweierpotenz), Rs Glättung der Verschiebung [Mpc].
// Rückgabe: psi (Float32, x/y/z je Teilchen, Index i = (z·N + y)·N + x), halos [{ i (Index des Spur-Teilchens), m [Teilchen],
// form (D des Kollapses), gal: [Indizes der Galaxien] }] nach Masse absteigend
export function makeField({ N = 128, L = 160, Rs = 2.5, seed = 1, nHalo = 700 } = {}) {
  const n3 = N ** 3, rand = rng(seed);
  const wr = new Float32Array(n3), wi = new Float32Array(n3);
  for (let i = 0; i < n3; i++) { const u = Math.max(1e-12, rand()), v = rand(); wr[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  fft3(wr, wi, N, false);
  // δ̂ = ŵ · √(P(k) N³ / L³); A = ψ̂x + i ψ̂y, B = ψ̂z + i δ̂_halo (beide Hälften reell im Ortsraum)
  const ar = new Float32Array(n3), ai = new Float32Array(n3), br = new Float32Array(n3), bi = new Float32Array(n3);
  const Rh = 3.5, kf = 2 * Math.PI / L, fq = (i) => (i < N / 2 ? i : i - N);
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x, kx = fq(x) * kf, ky = fq(y) * kf, kz = fq(z) * kf, k2 = kx * kx + ky * ky + kz * kz;
    if (!k2) continue;
    const a = Math.sqrt(power(Math.sqrt(k2)) * n3 / L ** 3), dr = wr[i] * a, di = wi[i] * a;
    const g = Math.exp(-k2 * Rs * Rs / 2) / k2, gh = Math.exp(-k2 * Rh * Rh / 2);
    // i k δ̂ / k² = (−k·di + i k·dr) / k²
    const px = [-kx * di * g, kx * dr * g], py = [-ky * di * g, ky * dr * g], pz = [-kz * di * g, kz * dr * g];
    ar[i] = px[0] - py[1]; ai[i] = px[1] + py[0];
    br[i] = pz[0] - di * gh; bi[i] = pz[1] + dr * gh;
  }
  fft3(ar, ai, N, true);
  fft3(br, bi, N, true);
  const psi = new Float32Array(n3 * 3);
  for (let i = 0; i < n3; i++) { psi[i * 3] = ar[i]; psi[i * 3 + 1] = ai[i]; psi[i * 3 + 2] = br[i]; }

  // Halos: Teilchen am Ende (D = 1) auf ein Gitter mit halber Auflösung zählen, Spitzen = lokale Maxima über dem 6-Fachen
  const M = N / 2, cell = L / M, cnt = new Uint16Array(M ** 3), at = new Uint32Array(n3);
  const wrap = (v) => ((v % L) + L) % L;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x;
    const cx = Math.floor(wrap((x + 0.5) * L / N + psi[i * 3]) / cell) % M, cy = Math.floor(wrap((y + 0.5) * L / N + psi[i * 3 + 1]) / cell) % M, cz = Math.floor(wrap((z + 0.5) * L / N + psi[i * 3 + 2]) / cell) % M;
    at[i] = (cz * M + cy) * M + cx;
    cnt[at[i]]++;
  }
  const mean = n3 / M ** 3, idx = (x, y, z) => ((((z + M) % M) * M + ((y + M) % M)) * M + ((x + M) % M));
  const peaks = [];
  for (let z = 0; z < M; z++) for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const c = cnt[idx(x, y, z)];
    if (c < 6 * mean) continue;
    let top = true, m = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const o = cnt[idx(x + dx, y + dy, z + dz)];
      m += o;
      if (o > c || (o === c && (dz || dy || dx) && idx(x + dx, y + dy, z + dz) < idx(x, y, z))) top = false;
    }
    if (top) peaks.push({ c: idx(x, y, z), m: m - 27 * mean });
  }
  peaks.sort((a, b) => b.m - a.m);
  const halos = peaks.slice(0, nHalo).map((p) => ({ ...p, list: [] }));
  const byCell = new Map(halos.map((h) => [h.c, h]));
  for (let i = 0; i < n3; i++) { const h = byCell.get(at[i]); if (h && h.list.length < 64) h.list.push(i); }
  const mMin = halos.length ? halos[halos.length - 1].m : 1;
  return {
    N, L, psi,
    halos: halos.filter((h) => h.list.length).map((h) => {
      const i = h.list[0], d = Math.max(...h.list.map((j) => bi[j]));
      const ng = Math.min(h.list.length, 1 + Math.round(2.2 * Math.sqrt(h.m / mMin - 1)));
      return { i, m: h.m, form: Math.min(1, Math.max(0.12, d > 0 ? 1.686 / d : 1)), gal: h.list.filter((_, k) => k % Math.max(1, Math.floor(h.list.length / ng)) === 0).slice(0, ng) };
    }),
  };
}
