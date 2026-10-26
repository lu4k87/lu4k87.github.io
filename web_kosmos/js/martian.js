// Marssystem ohne three.js (auch in node testbar): Pol, Drehung, Sonnenrichtung, Jahreszeit (Ls), Bahnen von Phobos und
// Deimos, Modell der jahreszeitlichen Polkappen. Gemeinsam für die Stationen mars (02E), phobos (02E1), deimos (02E2).
// Koordinaten: Ekliptik-Szene (eclToScene, y oben) relativ zur Marsmitte, Längen in km.

import { PLANETS, AU, J2000, planetPosition, eclToScene, equToScene, laplacePos, laplaceAxes } from './astro.js';

// Mars (NASA NSSDCA Mars Fact Sheet): Äquator-, Pol- und mittlerer Radius [km], Nordpol α/δ J2000 [°] (Drift −0,106°/−0,061°
// je Jahrhundert vernachlässigt), siderische Drehung [h], geometrische Albedo; Nullmeridian W = w0 + wRate · Tage seit J2000
// (IAU WGCCRE 2015, Archinal et al. 2018 / NAIF pck00011: 176,049863° + langperiodisches Glied ≈ +0,582° bis 2050, die kleinen
// periodischen Glieder < 0,001° weggelassen) – so steht Olympus Mons zur richtigen Zeit an der richtigen Stelle
export const MARS = { r: 3396.2, rp: 3376.2, rm: 3389.5, pole: [317.681, 52.887], rot: 24.6229, w0: 176.632, wRate: 350.891982443297, albedo: 0.17 };
const R_SUN = 695700;   // km (nasa-sun)

// Mittlere Bahnelemente (JPL sats/elem, MAR099, Laplace-Ebene, Epoche J2000; Format astro.js laplacePos). JPL nennt die
// siderische Periode P nur auf vier Stellen – für den Ort heute zu grob (Phobos liefe in 27 Jahren um Hunderte Grad davon),
// daher die mittlere Bewegung n aus der gebundenen Drehung der IAU 2015 (Archinal et al. 2018 / NAIF pck00011), passend zu P.
// Apsiden laufen vorwärts, Knoten rückwärts (Pn < 0). acc: säkulare Beschleunigung von Phobos [° je Jahrhundert²]
// (IAU 9,536·10⁻⁹ °/d² = 12,72° T²: die Bahn schrumpft). axes: Halbachsen [km] zu Mars, Pol, entlang der Bahn (NSSDCA); r: mittlerer Radius [km], rho: Dichte [g/cm³]
// (JPL sats/phys_par).
export const MOONS = {
  phobos: { a: 9375, e: 0.015, w: 216.3, M: 189.7, i: 1.1, node: 169.2, P: 0.3187, Pw: 1.1, Pn: -2.3, ra: 317.7, dec: 52.9, n: 1128.84475928, acc: 12.722, axes: [13.0, 9.1, 11.4], r: 11.08, rho: 1.872, albedo: 0.07 },
  deimos: { a: 23457, e: 0.000, w: 0.0, M: 205.0, i: 1.8, node: 54.3, P: 1.2625, Pw: 0, Pn: -56.2, ra: 316.6, dec: 53.5, n: 285.16188899, acc: 0, axes: [7.8, 5.1, 6.0], r: 6.2, rho: 1.471, albedo: 0.08 },
};
export const MOON_IDS = Object.keys(MOONS);
const AXES = Object.fromEntries(MOON_IDS.map((id) => [id, laplaceAxes(MOONS[id].ra, MOONS[id].dec)]));
const MA = PLANETS.find((p) => p.id === 'mars');
const RAD = Math.PI / 180;
// Nordpol des Mars als Einheitsvektor in der Szene; aufsteigender Knoten des Marsäquators auf dem Himmelsäquator
// (Richtung des Nullmeridians bei W = 0)
export const POLE = equToScene(...MARS.pole);
export const NODE = equToScene(MARS.pole[0] + 90, 0);

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };

// Ort eines Mondes [km] in der Szene (Phobos mit der säkularen Beschleunigung)
const elAt = {};
export function moonScene(id, jd) {
  const m = MOONS[id], T = (jd - J2000) / 36525;
  const el = m.acc ? Object.assign(elAt[id] || (elAt[id] = { ...m }), { M: m.M + m.acc * T * T }) : m;
  const [x, y, z] = laplacePos(el, jd), A = AXES[id];
  return [0, 1, 2].map((k) => A.x[k] * x + A.y[k] * y + A.z[k] * z);
}

// Jahreszeit: areozentrische Länge der Sonne Ls [°] – 0 = Frühlingsanfang Nord, 90 Sommer, 180 Herbst, 270 Winter. Gezählt in
// der Bahnebene vom Frühlingspunkt (Schnitt Äquator–Bahn, an dem die Sonne nach Norden wechselt)
function solarLongitude(jd, sun) {
  const p0 = eclToScene(planetPosition(MA, jd - 0.5)), p1 = eclToScene(planetPosition(MA, jd + 0.5));
  const h = unit(cross(p0, p1)), E = unit(cross(POLE, h)), F = cross(h, E);
  return ((Math.atan2(dot(sun, F), dot(sun, E)) / RAD) % 360 + 360) % 360;
}

// Zustand zum Zeitpunkt jd: Einheitsvektor Mars → Sonne, Abstand [km, AE], Winkelradius der Sonne [rad], Breite des
// Sonnenzenits [°], Ls [°], Orte der Monde [km], Drehwinkel des Nullmeridians [rad]
export function marsState(jd) {
  const h = eclToScene(planetPosition(MA, jd)), d = Math.hypot(...h);
  const sun = h.map((v) => -v / d);
  const sunKm = d * AU / 1e3;
  return {
    sun, sunKm, sunAU: d, sunAng: R_SUN / sunKm,
    subLat: Math.asin(dot(sun, POLE)) / RAD,
    ls: solarLongitude(jd, sun),
    spin: marsSpin(jd),
    moons: Object.fromEntries(MOON_IDS.map((id) => [id, moonScene(id, jd)])),
  };
}

export const marsSpin = (jd) => (((MARS.w0 + MARS.wRate * (jd - J2000)) % 360 + 360) % 360) * RAD;

// Zeitpunkt nahe jdRef (im selben Marsjahr, gezählt ab Frühlingsanfang Nord), an dem die Sonne bei Ls steht: Ls läuft
// wegen der Exzentrizität ungleichmäßig, daher Schritte mit der örtlichen Rate (4–6 Schritte bis auf 0,01°)
export const MARS_YEAR = 686.98;   // siderischer Umlauf [d] (NSSDCA)
export function lsToJd(ls, jdRef) {
  let jd = jdRef - (marsState(jdRef).ls / 360) * MARS_YEAR;
  for (let k = 0; k < 3; k++) jd -= (((marsState(jd).ls + 180) % 360) - 180) / 360 * MARS_YEAR;   // Frühlingsanfang
  jd += ls / 360 * MARS_YEAR;
  for (let k = 0; k < 8; k++) {
    const l0 = marsState(jd).ls, rate = (marsState(jd + 1).ls - l0 + 360) % 360;
    const dl = ((ls - l0 + 540) % 360) - 180;
    if (Math.abs(dl) < 0.005) break;
    jd += dl / rate;
  }
  return jd;
}

const SEASONS = ['Frühling', 'Sommer', 'Herbst', 'Winter'];
// Jahreszeit auf der Nordhalbkugel (Süden umgekehrt)
export const seasonNorth = (ls) => SEASONS[Math.floor((((ls % 360) + 360) % 360) / 90)];

// Jahreszeitliche Polkappe (CO₂-Reif) als Modell: Grenze zwischen der bleibenden Kappe (Nord ≈ 82°, Süd ≈ 85°, wie in der
// Textur) und ≈ 55° Breite im späten Winter (NASA); wächst über Herbst und Winter, zieht sich im Frühling zurück, im Sommer
// nur die bleibende Kappe. Verlauf geschätzt. hemi = +1 Nord, −1 Süd; Ergebnis: Betrag der Grenzbreite [°]
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function capEdge(ls, hemi) {
  const q = ((((ls - (hemi > 0 ? 180 : 0)) % 360) + 360) % 360) / 360;   // 0 = Herbstanfang der Halbkugel
  const f = smooth(0, 0.42, q) * (1 - smooth(0.47, 0.72, q));
  const res = hemi > 0 ? 82 : 85;
  return res + (55 - res) * f;
}
