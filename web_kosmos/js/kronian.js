// Saturnsystem ohne three.js (auch in node testbar): Bahnzeilen der großen Monde, Sonnenrichtung, Sonnenstand über der
// Ringebene, Drehung. Gemeinsam für die Stationen saturn (02D) und die Mond-Stationen titan (02D1), enceladus (02D2).
// Koordinaten: Ekliptik-Szene (eclToScene, y oben) relativ zur Saturnmitte, Längen in km.

import { PLANETS, AU, J2000, planetPosition, eclToScene, equToScene, laplacePos, laplaceAxes } from './astro.js';

// Saturn (NASA NSSDCA Saturn Fact Sheet): Äquator- und Polradius bei 1 bar [km], Nordpol α/δ J2000 [°], Rotation [h];
// W0 [°] + Rate [°/d] = Nullmeridian System III (IAU WGCCRE 2015) – die Textur ist ein Modell, die Drehrate echt
export const SATURN = { r: 60268, rp: 54364, pole: [40.59, 83.54], rot: 10.656, w0: 38.9, wRate: 810.7939024 };
// Ringe (NSSDCA Saturnian Rings Fact Sheet) [km]: Textur der Hauptringe vom C-Ring innen bis zum A-Ring außen
export const RINGS = { cIn: 74658, bIn: 91975, bOut: 117507, aIn: 122340, encke: 133410, aOut: 136780, f: 139826, eIn: 180000, eOut: 480000 };
const R_SUN = 695700;   // km (nasa-sun)

// Mittlere Bahnelemente (JPL sats/elem, SAT441, Laplace-Ebene, Epoche J2000; Format astro.js laplacePos). JPL nennt P die
// siderische Periode → n = 360/P ist die Rate der mittleren Länge; Apsiden laufen vorwärts (Pw > 0), Knoten rückwärts
// (Pn < 0; 0 = Bahn in der Laplace-Ebene). Tethys: e = 0,001 – die JPL-Apsidenperiode 0,005 a verschiebt den Ort nur um
// < 300 km. r = mittlerer Radius [km] (JPL sats/phys_par).
export const MOONS = {
  mimas: { a: 186000, e: 0.020, w: 160.4, M: 275.3, i: 1.6, node: 66.2, P: 0.942422, Pw: 0.493, Pn: -0.986, ra: 40.6, dec: 83.5, r: 198.2 },
  enceladus: { a: 238400, e: 0.005, w: 119.5, M: 57.0, i: 0.0, node: 0.0, P: 1.370218, Pw: 2.916, Pn: 0, ra: 40.6, dec: 83.5, r: 252.1 },
  tethys: { a: 295000, e: 0.001, w: 335.3, M: 0.0, i: 1.1, node: 273.0, P: 1.887802, Pw: 0.005, Pn: -4.982, ra: 40.6, dec: 83.5, r: 531.1 },
  dione: { a: 377700, e: 0.002, w: 116.0, M: 212.0, i: 0.0, node: 0.0, P: 2.736916, Pw: 11.698, Pn: 0, ra: 40.6, dec: 83.5, r: 561.4 },
  rhea: { a: 527200, e: 0.001, w: 44.3, M: 31.5, i: 0.3, node: 133.7, P: 4.517503, Pw: 33.939, Pn: -35.775, ra: 40.6, dec: 83.5, r: 763.5 },
  titan: { a: 1221900, e: 0.029, w: 78.3, M: 11.7, i: 0.3, node: 78.6, P: 15.945448, Pw: 346.68, Pn: -687.37, ra: 36.4, dec: 84.0, r: 2574.76 },
};
for (const m of Object.values(MOONS)) m.n = 360 / m.P;
export const MOON_IDS = Object.keys(MOONS);
const AXES = Object.fromEntries(MOON_IDS.map((id) => [id, laplaceAxes(MOONS[id].ra, MOONS[id].dec)]));
const SAT = PLANETS.find((p) => p.id === 'saturn');
// Nordpol des Saturn als Einheitsvektor in der Szene
export const POLE = equToScene(...SATURN.pole);

// Ort eines Mondes [km] in der Szene
export function moonScene(id, jd) {
  const [x, y, z] = laplacePos(MOONS[id], jd), A = AXES[id];
  return [0, 1, 2].map((k) => A.x[k] * x + A.y[k] * y + A.z[k] * z);
}

// Zustand zum Zeitpunkt jd: Einheitsvektor Saturn → Sonne, Abstand [km], Winkelradius der Sonne [rad], Sonnenhöhe über
// der Ringebene B [°] (> 0: Nordseite der Ringe beleuchtet), Orte der Monde [km]
export function kronianState(jd, ids = MOON_IDS) {
  const h = eclToScene(planetPosition(SAT, jd)), d = Math.hypot(...h);
  const sun = h.map((v) => -v / d);
  const sunKm = d * AU / 1e3;
  return {
    sun, sunKm, sunAng: R_SUN / sunKm,
    ringSun: Math.asin(sun[0] * POLE[0] + sun[1] * POLE[1] + sun[2] * POLE[2]) * 180 / Math.PI,
    moons: Object.fromEntries(ids.map((id) => [id, moonScene(id, jd)])),
  };
}

// Lage eines Mondes zur Linie Sonne–Saturn: s = Abstand entlang der Sonnenrichtung [km] (> 0 sonnenseitig), q = Abstand
// von der Linie [Saturnradien]. Schatten auf Saturn: s > 0 und q < 1; Mond im Saturnschatten: s < 0 und q < 1 (Kernschatten
// als Zylinder, Äquatorradius; die Ringe bleiben außer Acht).
export function lineOfSun(st, id) {
  const p = st.moons[id], s = p[0] * st.sun[0] + p[1] * st.sun[1] + p[2] * st.sun[2];
  const q = Math.hypot(p[0] - s * st.sun[0], p[1] - s * st.sun[1], p[2] - s * st.sun[2]) / SATURN.r;
  return { s, q };
}

// Drehwinkel des Nullmeridians [rad] zum Zeitpunkt jd
export const saturnSpin = (jd) => ((SATURN.w0 + SATURN.wRate * (jd - J2000)) % 360) * Math.PI / 180;
// Kalenderjahr (mit Bruchteil) ↔ julianisches Datum
export const yearToJd = (y) => J2000 + (y - 2000) * 365.25;
export const jdToYear = (jd) => 2000 + (jd - J2000) / 365.25;
