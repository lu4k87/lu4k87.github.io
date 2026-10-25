// Erdnahe Bahnen ohne three.js: Kepler-Bahn plus säkulare J2-Störung (Knotendrift Ω̇, Periheldrehung ω̇, korrigierte
// Mittelbewegung Ṃ) – Vallado, Fundamentals of Astrodynamics, Kap. 9. Luftwiderstand, Mond/Sonne und höhere Terme fehlen:
// Bahnebene, Höhe und Umlaufzeit stimmen, der Ort auf der Bahn driftet nach dem Schnappschuss langsam (ISS ≈ 1°/Tag).
// Elemente als Feld [a km, e, i °, Ω °, ω °, M °, Δt Tage, Art] wie in web/data/sats.json (tools/fetch_sats.py).
// Dazu die Polarlicht-Grenze nach Kp (NOAA SWPC/NCEI: Kp 0 → 66,5°, Kp 9 → 48,1° geomagnetische Breite).

export const MU = 398600.4418;      // km³/s² (WGS 84)
export const J2 = 1.08262668e-3;    // Abplattungsterm
export const RE = 6378.137;         // km
const RAD = Math.PI / 180;

// Säkulare Raten [rad/s] für a [km], e, i [rad]
export function rates(a, e, i) {
  const n = Math.sqrt(MU / (a * a * a)), p = a * (1 - e * e), k = 1.5 * J2 * (RE / p) * (RE / p), ci = Math.cos(i);
  return { n, dRaan: -k * n * ci, dArgp: 0.5 * k * n * (5 * ci * ci - 1), dM: n * (1 + 0.5 * k * Math.sqrt(1 - e * e) * (3 * ci * ci - 1)) };
}

export function kepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

// Ort [km] im erdfesten Inertialsystem (x Frühlingspunkt, z Nordpol) nach `days` Tagen seit dem Schnappschuss
export function propagate(o, days) {
  const [a, e, i0, raan0, argp0, M0, dt] = o;
  const i = i0 * RAD, s = (days - dt) * 86400;
  const r = rates(a, e, i);
  const raan = raan0 * RAD + r.dRaan * s, argp = argp0 * RAD + r.dArgp * s, M = M0 * RAD + r.dM * s;
  const E = kepler(((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), e);
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const co = Math.cos(argp), so = Math.sin(argp), cO = Math.cos(raan), sO = Math.sin(raan), cI = Math.cos(i), sI = Math.sin(i);
  return [
    (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
    (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
    so * sI * xp + co * sI * yp,
  ];
}

// Bahngeschwindigkeit [km/s] im Abstand r [km] (Vis-viva)
export const speedAt = (a, rkm) => Math.sqrt(MU * (2 / rkm - 1 / a));
export const periodMin = (a) => 2 * Math.PI * Math.sqrt(a * a * a / MU) / 60;

// Äquatorwärtige Grenze des Polarlichtovals [° geomagnetische Breite] für den Kp-Index 0–9 (NOAA-Tabelle, linear genähert)
export const auroraBoundary = (kp) => 66.5 - 2.044 * Math.min(9, Math.max(0, kp));
