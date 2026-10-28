// Rechenkern ohne three.js (läuft auch in node für die Tests): Konstanten, Planetenbahnen nach JPL, galaktische
// Koordinaten, Sternfarben aus der Temperatur, Einheiten und deutsche Zahlenformate für das HUD.

// ---------- Konstanten (SI) ----------
export const C = 299792458;                       // Lichtgeschwindigkeit, exakt (SI-Definition)
export const G = 6.67430e-11;                     // CODATA 2018
export const AU = 1.495978707e11;                 // IAU 2012, exakt
export const LY = 9.4607304725808e15;             // Julianisches Lichtjahr (IAU)
export const PC = 3.0856775814913673e16;          // IAU 2015
export const KPC = 1e3 * PC, MPC = 1e6 * PC;
export const GLY = 1e9 * LY;
export const M_SUN = 1.98840987e30;               // IAU 2015 (nominal GM☉ / G)
export const R_SUN = 6.957e8;                     // IAU 2015 nominal
export const YEAR = 365.25 * 86400;               // Julianisches Jahr
export const DAY = 86400;
export const J2000 = 2451545.0;                   // 2000-01-01 12:00 TT

// ---------- Planetenbahnen ----------
// JPL „Keplerian Elements for Approximate Positions of the Major Planets“ (E. M. Standish), Tabelle 1, gültig 1800–2050:
// a [AE], e, I [°], L [°], ϖ [°], Ω [°] zur Epoche J2000 und je Julianischem Jahrhundert. Die Erde steht als
// Schwerpunkt Erde–Mond in der Tabelle (EM-Bary).
export const PLANETS = [
  { id: 'mercury', el: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
    rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  { id: 'venus', el: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    rate: [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418] },
  { id: 'earth', el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0] },
  { id: 'mars', el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
  { id: 'jupiter', el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
  { id: 'saturn', el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    rate: [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
  { id: 'uranus', el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
    rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
  { id: 'neptune', el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] },
];
// Pluto (nicht in Tabelle 1): mittlere Elemente J2000 aus dem NSSDCA Pluto Fact Sheet, gleiche Reihenfolge wie oben; die
// mittlere Länge läuft mit der siderischen Umlaufzeit 90.560 Tage, die übrigen Elemente bleiben fest (eigene Näherung,
// für die Darstellung ausreichend; Test: Perihel 1989, Abstand beim Vorbeiflug von New Horizons 2015)
export const PLUTO = { id: 'pluto', el: [39.48168677, 0.24880766, 17.14175, 238.92881, 224.06676, 110.30347],
  rate: [0, 0, 0, 36525 * 360 / 90560, 0, 0] };

const RAD = Math.PI / 180;
const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

export function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Elemente zum Zeitpunkt jd (Julianisches Datum); M = L − ϖ, ω = ϖ − Ω (Standish, Abschnitt 8.10)
export function elementsAt(p, jd) {
  const T = (jd - J2000) / 36525;
  const [a, e, I, L, w, O] = p.el.map((v, i) => v + p.rate[i] * T);
  return { a, e, I, L, varpi: w, node: O, omega: w - O, M: wrap180(L - w) };
}

// Kepler-Gleichung E − e·sin E = M (Radiant), Newton-Verfahren
export function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

// Ort in der Bahnebene (a, e, E) → heliozentrisch-ekliptikal J2000 [AE]
export function orbitToEcliptic(el, E) {
  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const co = Math.cos(el.omega * RAD), so = Math.sin(el.omega * RAD);
  const cO = Math.cos(el.node * RAD), sO = Math.sin(el.node * RAD);
  const cI = Math.cos(el.I * RAD), sI = Math.sin(el.I * RAD);
  return [
    (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
    (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
    so * sI * xp + co * sI * yp,
  ];
}

export function planetPosition(p, jd) {
  const el = elementsAt(p, jd);
  return orbitToEcliptic(el, solveKepler(el.M * RAD, el.e));
}

// Ekliptik (x, y, z; z = Nordpol der Ekliptik) → Szene (y oben); Drehung, keine Spiegelung
export const eclToScene = ([x, y, z]) => [x, z, -y];

// Richtung (ekliptikale Länge λ, Breite β in Grad) → Einheitsvektor in der Szene
export function eclDir(lam, bet) {
  const cb = Math.cos(bet * RAD);
  return eclToScene([cb * Math.cos(lam * RAD), cb * Math.sin(lam * RAD), Math.sin(bet * RAD)]);
}
// Schiefe der Ekliptik J2000 (IAU 2006): 23° 26′ 21,4″
export const OBLIQUITY = 23.4392811;
// Äquatorial (Rektaszension α, Deklination δ in Grad, J2000) → Einheitsvektor in der Ekliptik-Szene
export function equToScene(ra, dec) {
  const e = OBLIQUITY * RAD;
  const x = Math.cos(dec * RAD) * Math.cos(ra * RAD), y = Math.cos(dec * RAD) * Math.sin(ra * RAD), z = Math.sin(dec * RAD);
  return eclToScene([x, y * Math.cos(e) + z * Math.sin(e), -y * Math.sin(e) + z * Math.cos(e)]);
}

// ---------- Monde: mittlere Bahnelemente (JPL Solar System Dynamics, „Planetary Satellite Mean Elements“) ----------
// Eine Zeile der JPL-Tabelle sats/elem (Epoche 2000-01-01.5 TDB = J2000): a [km], e, w = ω [°], M [°], i [°], node = Ω [°],
// P [d] (Periode der mittleren Anomalie), Pw, Pn [Jahre] = Perioden der Apsiden- und Knotendrehung, ra/dec = Pol der
// Laplace-Ebene (ICRF). JPL gibt Beträge; hier mit Vorzeichen: > 0 vorwärts, < 0 rückwärts (Knoten prograder Monde laufen
// rückwärts; Apsiden von Io und Europa ebenfalls, ihre Exzentrizität ist von der Resonanz erzwungen). Prüfen: mittlere
// Länge λ = Ω + ω + M wächst um 360/P + 360/(Pw·365,25) + 360/(Pn·365,25) Grad je Tag ≈ 360 / siderische Umlaufzeit.
// Optional n [°/d] = genaue Rate der mittleren Länge (z. B. Lieske 1998, E5): ersetzt 360/P, damit gekoppelte Monde in
// Resonanz bleiben (die gerundeten Tabellenwerte driften sonst um einige Grad in 25 Jahren).
// Ausgabe [x, y, z] km im Laplace-System: z = Laplace-Pol, x = aufsteigender Knoten der Laplace-Ebene auf dem ICRF-Äquator.
// Mittlere Elemente, keine Ephemeride: Lage auf der Bahn genau auf etwa ein Grad, für die Darstellung ausreichend.
const precRate = (p) => (p ? 360 / (p * 365.25) : 0);
const meanRate = (el) => (el.n ? el.n - precRate(el.Pw) - precRate(el.Pn) : 360 / el.P);
export function laplacePos(el, jd) {
  const d = jd - J2000;
  const w = (el.w + precRate(el.Pw) * d) * RAD, node = (el.node + precRate(el.Pn) * d) * RAD;
  const M = ((el.M + meanRate(el) * d) % 360) * RAD;
  const E = solveKepler(M, el.e);
  const xp = el.a * (Math.cos(E) - el.e), yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const co = Math.cos(w), so = Math.sin(w), cO = Math.cos(node), sO = Math.sin(node), cI = Math.cos(el.i * RAD), sI = Math.sin(el.i * RAD);
  return [
    (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
    (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
    so * sI * xp + co * sI * yp,
  ];
}
// Mittlere Länge λ = Ω + ω + M [°] in der Laplace-Ebene (z. B. für die Laplace-Resonanz λ_Io − 3 λ_Europa + 2 λ_Ganymed = 180°)
export function laplaceLongitude(el, jd) {
  const d = jd - J2000;
  return (((el.node + el.w + el.M + (precRate(el.Pn) + precRate(el.Pw) + meanRate(el)) * d) % 360) + 360) % 360;
}
// Achsen des Laplace-Systems als Einheitsvektoren in der Ekliptik-Szene: { x, y, z } (z = Pol aus ra/dec, x = Knoten auf dem
// ICRF-Äquator bei α = ra + 90°) → Szene = x·X + y·Y + z·Z, z. B. new THREE.Matrix4().makeBasis(X, Y, Z)
export function laplaceAxes(ra, dec) {
  const z = equToScene(ra, dec), x = equToScene(ra + 90, 0);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return { x, y, z };
}
// Farbindex B−V → Temperatur [K] (Ballesteros 2012, EPL 97, 34008): T = 4600 K · (1/(0,92·BV + 1,7) + 1/(0,92·BV + 0,62))
export const bvToTemp = (bv) => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
// Mittlere Sternzeit Greenwich [Grad] (Meeus, Astronomical Algorithms, Gl. 12.4, ohne T²-Glieder)
export function gmst(jd) {
  return (((280.46061837 + 360.98564736629 * (jd - J2000)) % 360) + 360) % 360;
}
// Mond geozentrisch-ekliptikal, Näherung des Astronomical Almanac (Genauigkeit ≈ 0,3°, Abstand ≈ 0,2 %):
// Länge, Breite und Horizontalparallaxe aus den größten periodischen Gliedern → [x, y, z] in km
export function moonPosition(jd) {
  const T = (jd - J2000) / 36525;
  const s = (a, b) => Math.sin((a + b * T) * RAD), c = (a, b) => Math.cos((a + b * T) * RAD);
  const lam = 218.32 + 481267.881 * T + 6.29 * s(135.0, 477198.87) - 1.27 * s(259.3, -413335.36)
    + 0.66 * s(235.7, 890534.22) + 0.21 * s(269.9, 954397.74) - 0.19 * s(357.5, 35999.05) - 0.11 * s(186.5, 966404.03);
  const bet = 5.13 * s(93.3, 483202.02) + 0.28 * s(228.2, 960400.89) - 0.28 * s(318.3, 6003.15) - 0.17 * s(217.6, -407332.21);
  const par = 0.9508 + 0.0518 * c(135.0, 477198.87) + 0.0095 * c(259.3, -413335.36)
    + 0.0078 * c(235.7, 890534.22) + 0.0028 * c(269.9, 954397.74);
  const d = 6378.14 / Math.sin(par * RAD);
  const cb = Math.cos(bet * RAD);
  return [d * cb * Math.cos(lam * RAD), d * cb * Math.sin(lam * RAD), d * Math.sin(bet * RAD)];
}
// Optische Libration des Mondes (Meeus, Astronomical Algorithms, Kap. 53, ohne die physische ≤ 0,04°): l, b = seleno-
// graphische Länge und Breite des Erdmittelpunkts [Grad]; Ω = Knotenlänge der Mondbahn [Grad]. Nach dem Cassini-Gesetz
// steht der Pol des Mondäquators I = 1,54242° neben dem Ekliptikpol bei der Länge Ω + 90°.
export const MOON_I = 1.54242;
export function moonLibration(jd) {
  const T = (jd - J2000) / 36525, m = moonPosition(jd);
  const lam = Math.atan2(m[1], m[0]), bet = Math.atan2(m[2], Math.hypot(m[0], m[1]));
  const F = (93.2720950 + 483202.0175233 * T) * RAD, node = 125.0445479 - 1934.1362891 * T;
  const W = lam - node * RAD, I = MOON_I * RAD;
  const A = Math.atan2(Math.sin(W) * Math.cos(bet) * Math.cos(I) - Math.sin(bet) * Math.sin(I), Math.cos(W) * Math.cos(bet));
  const l = ((((A - F) / RAD) % 360) + 540) % 360 - 180;
  const b = Math.asin(-Math.sin(W) * Math.cos(bet) * Math.sin(I) - Math.sin(bet) * Math.cos(I)) / RAD;
  return { l, b, node: ((node % 360) + 360) % 360 };
}

// Umlaufzeit aus der mittleren Länge: 360° / (dL/dt) in Jahren
export function siderealYears(p) {
  return 36000 / p.rate[3];
}

// ---------- Galaxie ----------
// Heliozentrisch-galaktisch (l, b in Grad, d in kpc) → galaktozentrische Szene [kpc]: Zentrum im Ursprung, Sonne bei
// (−R0, z☉, 0), Nordpol der Galaxis = +y. Die Milchstraße dreht von Norden gesehen im Uhrzeigersinn; l = 90° zeigt in
// Drehrichtung, das ist in der Szene −z.
export function galToScene(l, b, d, R0, zSun = 0) {
  const X = d * Math.cos(b * RAD) * Math.cos(l * RAD);   // zur Mitte
  const Y = d * Math.cos(b * RAD) * Math.sin(l * RAD);   // Drehrichtung
  const Z = d * Math.sin(b * RAD);                       // Norden
  return [-R0 + X, zSun + Z, -Y];
}

// Azimut φ in Drehrichtung (φ = 0 zeigt vom Zentrum zur Sonne) → Szene
export function diskPoint(r, phi, y = 0) {
  return [-r * Math.cos(phi), y, -r * Math.sin(phi)];
}

// Logarithmische Spirale, nachlaufend: der Azimut nimmt nach außen gegen die Drehrichtung ab
// (φ(R) = φref − ln(R/Rref)·cot ψ; Reid et al. 2014/2019 schreiben β entgegen der Drehung)
export function spiralPhi(R, arm) {
  return arm.phiRef - Math.log(R / arm.rRef) / Math.tan(arm.pitch * RAD);
}

// ---------- Schwarze Löcher, Pulsare ----------
export const schwarzschildRadius = (mSun) => 2 * G * mSun * M_SUN / (C * C);
// Schattenradius Schwarzschild: √27 · GM/c² = (√27 / 2) · Rs
export const shadowRadius = (mSun) => Math.sqrt(27) / 2 * schwarzschildRadius(mSun);
// Winkel am Himmel [Mikrobogensekunden] für Länge L in Entfernung D
export const microArcsec = (L, D) => (L / D) / RAD * 3600e6;
// Lichtzylinder eines Pulsars: dort liefe ein mitrotierendes Feld mit Lichtgeschwindigkeit
export const lightCylinder = (P) => C * P / (2 * Math.PI);

// ---------- Kosmologie (flaches ΛCDM, Planck 2018 TT,TE,EE+lowE+lensing+BAO) ----------
// H0 = 67,66 km/s/Mpc, Ωm = 0,3111, ΩΛ = 0,6889, Strahlung Ωr ≈ 9,1·10⁻⁵ (Photonen + Neutrinos). Mitbewegter Abstand
// D(z) = (c/H0)·∫dz/E(z), Rückblickzeit t(z) = (1/H0)·∫dz/((1+z)·E(z)); Integration in ln(1+z) (Simpson), damit auch
// z ≈ 1 090 (letzte Streuung) genau wird. Alter heute = t(∞).
export const COSMO = { H0: 67.66, Om: 0.3111, OL: 0.6889, Or: 9.1e-5 };
const H0_SI = COSMO.H0 * 1e3 / MPC;
const Ez = (z) => Math.sqrt(COSMO.Or * (1 + z) ** 4 + COSMO.Om * (1 + z) ** 3 + COSMO.OL);
function cosmoInt(z, f, n = 600) {
  // ∫₀^z f(z') dz' mit Substitution u = ln(1+z): dz = (1+z) du
  const U = Math.log(1 + z);
  if (U <= 0) return 0;
  const h = U / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const zz = Math.exp(i * h) - 1;
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    s += w * f(zz) * (1 + zz);
  }
  return s * h / 3;
}
// Abstand [m] (mitbewegt), Rückblickzeit [s], Alter des Universums bei z [s]
export function cosmo(z) {
  const dc = C / H0_SI * cosmoInt(z, (x) => 1 / Ez(x));
  const lookback = cosmoInt(z, (x) => 1 / ((1 + x) * Ez(x))) / H0_SI;
  return { z, dc, lookback, age: cosmoAge() - lookback, T: 2.7255 * (1 + z) };
}
let AGE = 0;
export function cosmoAge() {
  if (!AGE) AGE = cosmoInt(1e7, (x) => 1 / ((1 + x) * Ez(x)), 4000) / H0_SI;
  return AGE;
}
// Umkehrung durch Bisektion: z zu mitbewegtem Abstand [m] bzw. Rückblickzeit [s]
function invert(f, target, zMax = 3000) {
  let lo = 0, hi = zMax;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) < target) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
export const zAtDistance = (dc) => invert((z) => cosmo(z).dc, dc);
export const zAtLookback = (t) => invert((z) => cosmo(z).lookback, Math.min(t, cosmoAge() * 0.999999));

// ---------- Sternfarben ----------
// Planck-Kurve in der Normfarbtafel (Kim et al. 2002, kubische Näherung 1667–25 000 K) → lineares sRGB, Maximum 1
export function blackbody(T) {
  T = Math.min(25000, Math.max(1667, T));
  const t = 1 / T;
  const x = T <= 4000
    ? -0.2661239e9 * t ** 3 - 0.2343589e6 * t ** 2 + 0.8776956e3 * t + 0.179910
    : -3.0258469e9 * t ** 3 + 2.1070379e6 * t ** 2 + 0.2226347e3 * t + 0.240390;
  const y = T <= 2222
    ? -1.1063814 * x ** 3 - 1.34811020 * x ** 2 + 2.18555832 * x - 0.20219683
    : T <= 4000
      ? -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
      : 3.0817580 * x ** 3 - 5.87338670 * x ** 2 + 3.75112997 * x - 0.37001483;
  const X = x / y, Y = 1, Z = (1 - x - y) / y;
  const rgb = [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.2040 * Y + 1.0570 * Z,
  ].map((v) => Math.max(0, v));
  const m = Math.max(...rgb);
  return rgb.map((v) => v / m);
}

// ---------- Zufall ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gauss(rand) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

// ---------- Zahlen und Einheiten (de-DE) ----------
const NF = new Map();
export function num(v, digits = 0) {
  if (!NF.has(digits)) NF.set(digits, new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits }));
  return NF.get(digits).format(v);
}
// zwei bis drei gültige Stellen
export function sig(v) {
  const a = Math.abs(v);
  return num(v, a >= 100 ? 0 : a >= 10 ? 1 : 2);
}

// Zahl, Größenwort und Einheit bleiben in einer Zeile (geschütztes Leerzeichen; User 27.10.2026: „21,2 | m“ im Hinweis)
const NB = ' ';

// Länge in Metern → lesbare Einheit: m · km · AE · Lj · Mio. Lj · Mrd. Lj
export function fmtLength(m) {
  if (m < 1e3) return `${sig(m)}${NB}m`;
  if (m < 1e9) return `${sig(m / 1e3)}${NB}km`;
  if (m < 0.5 * AU) return `${sig(m / 1e9)}${NB}Mio.${NB}km`;
  if (m < 0.05 * LY) return `${sig(m / AU)}${NB}AE`;
  const ly = m / LY;
  if (ly < 1e6) return `${sig(ly)}${NB}Lj`;
  if (ly < 1e9) return `${sig(ly / 1e6)}${NB}Mio.${NB}Lj`;
  return `${sig(ly / 1e9)}${NB}Mrd.${NB}Lj`;
}

// Dauer in Sekunden → lesbare Einheit bis Milliarden Jahre
export function fmtTime(s) {
  if (s < 1e-6) return `${sig(s * 1e9)}${NB}ns`;
  if (s < 1e-3) return `${sig(s * 1e6)}${NB}µs`;
  if (s < 1) return `${sig(s * 1e3)}${NB}ms`;
  if (s < 120) return `${sig(s)}${NB}s`;
  if (s < 7200) return `${sig(s / 60)}${NB}min`;
  if (s < 3 * DAY) return `${sig(s / 3600)}${NB}h`;
  if (s < YEAR) return `${sig(s / DAY)}${NB}Tage`;
  const y = s / YEAR;
  if (y < 1e3) return `${sig(y)}${NB}${y < 1.995 ? 'Jahr' : 'Jahre'}`;
  if (y < 1e6) return `${sig(y / 1e3)}${NB}Tsd.${NB}Jahre`;
  if (y < 1e9) return `${sig(y / 1e6)}${NB}Mio.${NB}Jahre`;
  return `${sig(y / 1e9)}${NB}Mrd.${NB}Jahre`;
}

// ---------- Abzeichen auf der Rückseite ----------
// Liegt Punkt p vom Auge aus hinter einer der Kugeln { center, radius }? Der Strahl Auge → p tritt vorher in die Kugel ein.
// Punkte in einer Kugel (Oberfläche, knapp darunter) zählen mit ihrem Abstand zur Mitte als Radius: vorn sichtbar, hinten
// verdeckt; Punkte tief im Körper (< 0,97 r, z. B. seine Mitte) prüft nur die übrigen Kugeln. Nur x/y/z – ohne three.js.
export function behind(eye, p, spheres) {
  const dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z, L = Math.hypot(dx, dy, dz);
  if (!(L > 0)) return false;
  for (const { center: c, radius } of spheres) {
    const pc = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
    if (pc < radius * 0.97) continue;
    const r = Math.min(radius, pc);
    const ox = c.x - eye.x, oy = c.y - eye.y, oz = c.z - eye.z;
    const s = (ox * dx + oy * dy + oz * dz) / L, h2 = ox * ox + oy * oy + oz * oz - s * s;
    if (h2 >= r * r) continue;
    const t = s - Math.sqrt(r * r - h2);   // Eintritt in die Kugel
    if (t > 0 && t < L * (1 - 1e-3)) return true;
  }
  return false;
}
// visible(cam) jedes Abzeichens um die Rückseiten-Prüfung ergänzen; center darf ein mitlaufender Vektor sein
export function hideBehind(hotspots, spheres) {
  for (const h of hotspots) {
    const v = h.visible;
    h.visible = (cam) => (!v || v(cam)) && !behind(cam.position, h.pos, spheres);
  }
  return hotspots;
}
