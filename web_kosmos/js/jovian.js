// Jupitersystem ohne three.js (auch in node testbar): Bahnzeilen der Galileischen Monde, Sonnenrichtung, Laplace-Resonanz,
// Schattendurchgänge. Gemeinsam für die Stationen jupiter (02C) und die Mond-Stationen io, europa, ganymede, callisto.
// Koordinaten: Ekliptik-Szene (eclToScene, y oben) relativ zur Jupitermitte, Längen in km.

import { PLANETS, AU, planetPosition, eclToScene, laplacePos, laplaceAxes, laplaceLongitude } from './astro.js';

// Jupiter (NASA NSSDCA Jupiter Fact Sheet): Äquator- und Polradius bei 1 bar [km], Nordpol α/δ J2000 [°], siderische
// Rotation System III [h]
export const JUPITER = { r: 71492, rp: 66854, pole: [268.057, 64.495], rot: 9.925 };
const R_SUN = 695700;   // km (nasa-sun)

// Mittlere Bahnelemente (JPL sats/elem, JUP365, Laplace-Ebene, Epoche J2000) mit Vorzeichen der Apsiden- und Knotendrehung
// (Format: astro.js laplacePos); n [°/d] = Rate der mittleren Länge nach Lieske 1998 (E5), hält die Resonanz 1:2:4.
// r = mittlerer Radius [km] (NSSDCA Jovian Satellite Fact Sheet).
export const GALILEAN = {
  io: { a: 421800, e: 0.004, w: 49.1, M: 330.9, i: 0.0, node: 0.0, P: 1.762732, Pw: -1.333, Pn: 0, n: 203.488955790, ra: 268.1, dec: 64.5, r: 1821.5 },
  europa: { a: 671100, e: 0.009, w: 45.0, M: 345.4, i: 0.5, node: 184.0, P: 3.525463, Pw: -1.394, Pn: -30.202, n: 101.374724735, ra: 268.1, dec: 64.5, r: 1560.8 },
  ganymede: { a: 1070400, e: 0.001, w: 198.3, M: 324.8, i: 0.2, node: 58.5, P: 7.155588, Pw: 68.301, Pn: -137.812, n: 50.317609207, ra: 268.2, dec: 64.6, r: 2631.2 },
  callisto: { a: 1882700, e: 0.007, w: 43.8, M: 87.4, i: 0.3, node: 309.1, P: 16.690440, Pw: 277.921, Pn: -577.264, n: 21.571071177, ra: 268.7, dec: 64.8, r: 2410.3 },
};
export const MOON_IDS = Object.keys(GALILEAN);
const AXES = Object.fromEntries(MOON_IDS.map((id) => [id, laplaceAxes(GALILEAN[id].ra, GALILEAN[id].dec)]));
const JUP = PLANETS.find((p) => p.id === 'jupiter');

// Ort eines Mondes [km] in der Szene
export function moonScene(id, jd) {
  const [x, y, z] = laplacePos(GALILEAN[id], jd), A = AXES[id];
  return [0, 1, 2].map((k) => A.x[k] * x + A.y[k] * y + A.z[k] * z);
}

// Zustand zum Zeitpunkt jd: Einheitsvektor Jupiter → Sonne, Abstand [km], Winkelradius der Sonne [rad], Orte der Monde [km]
export function jovianState(jd) {
  const h = eclToScene(planetPosition(JUP, jd)), d = Math.hypot(...h);
  return {
    sun: h.map((v) => -v / d), sunKm: d * AU / 1e3, sunAng: R_SUN / (d * AU / 1e3),
    moons: Object.fromEntries(MOON_IDS.map((id) => [id, moonScene(id, jd)])),
  };
}

// Laplace-Resonanz Φ = λ_Io − 3 λ_Europa + 2 λ_Ganymed [°], 0…360 (bleibt bei 180°: nie stehen alle drei auf einer Seite)
export function laplaceAngle(jd) {
  const L = (id) => laplaceLongitude(GALILEAN[id], jd);
  return (((L('io') - 3 * L('europa') + 2 * L('ganymede')) % 360) + 360) % 360;
}

// Lage eines Mondes zur Linie Sonne–Jupiter: s = Abstand entlang der Sonnenrichtung [km] (> 0 sonnenseitig), q = Abstand
// von der Linie [Jupiterradien]. Schatten auf Jupiter: s > 0 und q < 1; Mond im Jupiterschatten: s < 0 und q < 1
// (Kernschatten als Zylinder genähert; der Halbschatten ist bei Jupiter schmal, der Polradius bleibt außer Acht).
export function lineOfSun(st, id) {
  const p = st.moons[id], s = p[0] * st.sun[0] + p[1] * st.sun[1] + p[2] * st.sun[2];
  const q = Math.hypot(p[0] - s * st.sun[0], p[1] - s * st.sun[1], p[2] - s * st.sun[2]) / JUPITER.r;
  return { s, q };
}

// Nächster Zeitpunkt ab jd, an dem der Schatten eines Mondes (ids) auf Jupiter fällt: { jd, id } oder null (Schritt 10 min,
// höchstens `days` Tage voraus); steht schon ein Schatten auf der Scheibe, zählt der nächste neue Durchgang
export function nextShadowTransit(jd, ids = MOON_IDS, days = 20) {
  const on = (t, id) => { const l = lineOfSun(jovianState(t), id); return l.s > 0 && l.q < 1; };
  const was = Object.fromEntries(ids.map((id) => [id, on(jd, id)]));
  for (let t = jd + 1 / 144; t < jd + days; t += 1 / 144) {
    for (const id of ids) {
      const now = on(t, id);
      if (now && !was[id]) return { jd: t, id };
      was[id] = now;
    }
  }
  return null;
}
