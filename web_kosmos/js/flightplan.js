// Rechenkern ohne three.js für den Urknall (Station 11) und den Galaxien-Flug zu Station 10 (galaxyflight.js), Test
// tests/flightplan.test.js: Stützwert-Kurven (key stückweise weich, smoothKeys glatt und monoton) und flightPlan(e, down) =
// Fahrplan der Sonderetappe für main.js (welches Bild, wo im Feld, Überblendung, Weiß).

const lerp = (a, b, x) => a + (b - a) * x;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const sstep = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
// Stützwerte [[t, wert], …] → Wert bei t (stückweise weich: hält an jeder Stützstelle kurz an)
export const key = (pts, t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return lerp(va, vb, sstep(a, b, t)); }
  return pts[pts.length - 1][1];
};
// Stützwerte → glatte, monotone Kurve (kubisch nach Fritsch-Carlson): anders als key() hält sie an den Stützstellen nicht
// an und schwingt nicht über – für Bewegung über mehrere Stützwerte (Film). log = im Logarithmus (Abstände, Radien),
// flat = endet mit Tempo null (läuft aus statt abzubrechen)
export function smoothKeys(pts, { log = false, flat = false } = {}) {
  const x = pts.map((p) => p[0]), y = pts.map((p) => (log ? Math.log(p[1]) : p[1])), n = x.length;
  const d = x.slice(1).map((xi, i) => (y[i + 1] - y[i]) / (xi - x[i]));
  const m = y.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? (flat ? 0 : d[n - 2]) : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (t) => {
    let v;
    if (t <= x[0]) v = y[0];
    else if (t >= x[n - 1]) v = y[n - 1];
    else {
      let i = 0;
      while (t > x[i + 1]) i++;
      const h = x[i + 1] - x[i], u = (t - x[i]) / h, u2 = u * u, u3 = u2 * u;
      v = (2 * u3 - 3 * u2 + 1) * y[i] + (u3 - 2 * u2 + u) * h * m[i] + (3 * u2 - 2 * u3) * y[i + 1] + (u3 - u2) * h * m[i + 1];
    }
    return log ? Math.exp(v) : v;
  };
}

// ---------- Fahrplan der Sonderetappe (e = Stand der Etappe 0 … 1 in Fahrtrichtung) ----------
// hinaus (Station 10 → 11): Kamera von Station 10 taucht auf uns zu (dive), Überblendung in den Durchflug (mix = Anteil des
// Bildes von Station 10), Wand glüht weiß auf, Schnitt in den Blitz (cut), Weiß klingt ab, der Film beginnt.
// hinein (11 → 10): in den Blitz (dive), Schnitt in die weiße Wand, vorwärts in der Zeit, Überblendung in die Anfahrt an Station 10.
export const FLIGHT = { w: 2.8, out: { fade: [0.12, 0.28], run: [0.12, 0.935], white: [0.885, 0.935], cut: 0.935, dive: [0, 0.3] },
  in: { cut: 0.08, white: [0.02, 0.08], run: [0.08, 0.9], fade: [0.72, 0.9], dive: [0, 0.08] } };
export function flightPlan(e, down) {
  const P = down ? FLIGHT.in : FLIGHT.out;
  const bang = down ? e < P.cut : e >= P.cut;
  const x = clamp01((e - P.run[0]) / (P.run[1] - P.run[0]));
  // Weiß: zum Schnitt hin voll, danach weich zurück
  const white = down
    ? (bang ? sstep(P.white[0], P.white[1], e) : 1 - sstep(P.cut, P.cut + 0.08, e))
    : (bang ? 1 - sstep(P.cut, 1, e) : sstep(P.white[0], P.white[1], e));
  const mix = down ? sstep(P.fade[0], P.fade[1], e) : 1 - sstep(P.fade[0], P.fade[1], e);
  const dive = sstep(P.dive[0], P.dive[1], e);
  return { phase: bang ? 'bang' : 'corridor', x, white, mix, dive };
}
