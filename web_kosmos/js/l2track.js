// Echte Orte von JWST, Euclid und Roman aus dem JPL-Horizons-Schnappschuss (web/data/l2.json, tools/fetch_l2.py), ohne
// three.js: geozentrisch, Ekliptik J2000 [1.000 km]. Zwischen den Stützpunkten kubisch nach Hermite aus Ort und
// Geschwindigkeit; außerhalb der Spanne null (dann gilt das Modell in l2view.js bzw. levels/earth.js).

let dataP = null;
export function loadL2() {
  // ohne ||=: das Modul läuft auch im Test unter älterem Node (tests/astro.test.js)
  if (!dataP) dataP = fetch('data/l2.json').then((r) => { if (!r.ok) throw new Error(`l2.json: HTTP ${r.status}`); return r.json(); });
  dataP.catch(() => { dataP = null; });   // Netzfehler: nächster Aufruf lädt neu
  return dataP;
}

// Spanne [erster, letzter] JD einer Bahn
export const trackSpan = (tr) => [tr.v[0][0], tr.v[tr.v.length - 1][0]];

// Ort zum Zeitpunkt jd → out [x, y, z] (Ekliptik, 1.000 km) oder null außerhalb der Spanne
export function trackAt(tr, jd, out = [0, 0, 0]) {
  const v = tr.v;
  if (!(jd >= v[0][0] && jd <= v[v.length - 1][0])) return null;
  let lo = 0, hi = v.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (v[m][0] <= jd) lo = m; else hi = m; }
  const a = v[lo], b = v[hi], h = b[0] - a[0], s = h > 0 ? (jd - a[0]) / h : 0;
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  for (let i = 0; i < 3; i++) out[i] = h00 * a[1 + i] + h10 * h * a[4 + i] + h01 * b[1 + i] + h11 * h * b[4 + i];
  return out;
}
