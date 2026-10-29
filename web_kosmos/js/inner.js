// Innere Planeten (02I Merkur, 02J Venus): Rechenkern ohne three.js wie martian.js – Drehung nach der IAU, Sonnenrichtung
// und Abstand aus den JPL-Bahnelementen, Sonnenzenit (Länge Ost, Breite), wahre Anomalie, Radialgeschwindigkeit, nächstes
// Perihel/Aphel. Achsen am Planeten wie in levels/mars.js: Gruppe x = aufsteigender Knoten des Äquators auf dem ICRF-Äquator,
// y = Nordpol, z = x × y; die Drehung W läuft um y (Länge 0 bei +x, Osten = −z).
import { PLANETS, J2000, AU, R_SUN, elementsAt, planetPosition, eclToScene, equToScene, solveKepler } from './astro.js';

const RAD = Math.PI / 180;
const GM_SUN = 1.32712440018e11;   // km³/s² (IAU 2015 nominal, wie M_SUN in astro.js)
// Radius [km] (NSSDCA, mittlerer Radius), Pol und Nullmeridian (IAU WGCCRE 2015, Archinal et al. 2018; Merkur ohne die
// Librationsglieder von höchstens 0,01°): W = w0 + wRate · Tage seit J2000; Venus dreht rückläufig (wRate < 0)
export const INNER = {
  mercury: { r: 2439.7, pole: [281.0103, 61.4155], w0: 329.5988, wRate: 6.1385108, rot: 1407.6, day: 4222.6, year: 87.969 },
  venus: { r: 6051.8, pole: [272.76, 67.16], w0: 160.20, wRate: -1.4813688, rot: -5832.6, day: 2802.0, year: 224.701 },
};
const BODY = Object.fromEntries(PLANETS.filter((p) => INNER[p.id]).map((p) => [p.id, p]));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const AXES = Object.fromEntries(Object.entries(INNER).map(([id, b]) => {
  const P = equToScene(...b.pole), N = equToScene(b.pole[0] + 90, 0);
  return [id, { P, N, Z: cross(N, P) }];
}));
export const poleOf = (id) => AXES[id].P;
export const nodeOf = (id) => AXES[id].N;

// Drehwinkel W [rad, 0 … 2π] zum Zeitpunkt jd
export const spinOf = (id, jd) => {
  const b = INNER[id];
  return (((b.w0 + b.wRate * (jd - J2000)) % 360 + 360) % 360) * RAD;
};

// Richtung (Szene) → Breite, Länge Ost [°] auf dem gedrehten Planeten
export function toBody(id, v, jd) {
  const { P, N, Z } = AXES[id], w = spinOf(id, jd);
  const x0 = dot(v, N), y = dot(v, P), z0 = dot(v, Z);
  const x = x0 * Math.cos(w) - z0 * Math.sin(w), z = x0 * Math.sin(w) + z0 * Math.cos(w);
  const lon = Math.atan2(-z, x) / RAD;
  return { lat: Math.asin(Math.max(-1, Math.min(1, y))) / RAD, lon: (lon + 360) % 360 };
}

// Zustand zum Zeitpunkt jd: Sonnenrichtung (Szene, Einheitsvektor), Abstand [km, AE], Winkelradius der Sonne [rad],
// Sonnenzenit (Breite, Länge Ost), wahre Anomalie ν [°], Radialgeschwindigkeit zur Sonne [km/s] (> 0 = entfernt sich)
export function innerState(id, jd) {
  const p = BODY[id], h = eclToScene(planetPosition(p, jd)), d = Math.hypot(...h);
  const sun = h.map((v) => -v / d), km = d * AU / 1e3;
  const el = elementsAt(p, jd), E = solveKepler(el.M * RAD, el.e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
  const pKm = el.a * (1 - el.e * el.e) * AU / 1e3;
  const sub = toBody(id, sun, jd);
  return { sun, km, au: d, sunAng: Math.asin(R_SUN / 1e3 / km), nu: ((nu / RAD) + 360) % 360, vr: Math.sqrt(GM_SUN / pKm) * el.e * Math.sin(nu), subLat: sub.lat, subLon: sub.lon };
}

// Nächster Zeitpunkt nach jd, an dem die mittlere Anomalie M den Wert m [°] erreicht (0 = Perihel, 180 = Aphel)
export function nextAnomaly(id, jd, m) {
  const p = BODY[id], n = p.rate[3] / 36525;   // °/Tag (mittlere Bewegung, Standish)
  const dM = ((m - elementsAt(p, jd).M) % 360 + 360) % 360;
  return jd + (dM < 1e-3 ? 360 : dM) / n;
}

// Merkur: mittlere Oberflächentemperatur im Modell [K] aus Sonnenabstand und Zenitwinkel – Tagseite T = Tss · cos^¼ z mit
// Tss = 700 K im Perihel, ∝ r^−½ (Strahlungsgleichgewicht); Nachtseite kühlt auf ≈ 100 K (Vasavada et al. 1999). Modell.
export const T_PERI = 700, T_NIGHT = 100;
export const subsolarT = (au) => T_PERI * Math.sqrt(0.3075 / au);
