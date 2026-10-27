// Rechenkern ohne three.js für den Urknall (Station 11) und den Vorbeiflug an Galaxien zur Lokalen Gruppe (galaxyflight.js),
// Test tests/flightplan.test.js: Stützwert-Kurven (key stückweise weich, smoothKeys glatt und monoton), Zoom der Flüge und
// flybyField = Lage der Galaxien entlang der Fahrt.

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

// Flug: äußere Kamera zoomt um ZOOM auf den Anker zu, die innere kommt aus ZOOM-fachem Abstand an (gleiche Rate; main.js)
export const ZOOM = 22;

// ---------- Vorbeiflug an Galaxien auf der Fahrt hinein zur Lokalen Gruppe (Station 9 → 8, galaxyflight.js createFlyby) ----------
// Feld in Einheiten des Startabstands: die Kamera fährt auf der z-Achse von 1 auf den Anker (0) zu, bis 1/ZOOM. Galaxien
// liegen logarithmisch gleich dicht entlang der Fahrt (der Zoom durchläuft jede Dekade gleich schnell → gleichmäßiger Strom),
// seitlich proportional zum Abstand: sie ziehen am Rand vorbei, die Mitte (Ziel) bleibt frei, die Kamera streift keine.
// w = Gewicht der Etappe (länger als ein normaler Flug), z = Bereich der Abstände (unten in Vielfachen von 1/ZOOM: die
// letzten sind vor der Ankunft vorbei), side/size = seitlicher Abstand und Durchmesser je Abstand, fade = Ein-/Ausblenden
export const FLYBY = { w: 2.3, n: 140, z: [1.8, 0.9], side: [0.26, 0.8], size: [0.1, 0.2], fade: [0.08, 0.9] };
export function flybyField(rand, zoom = ZOOM, n = FLYBY.n) {
  const lo = Math.log(FLYBY.z[0] / zoom), hi = Math.log(FLYBY.z[1]), [s0, s1] = FLYBY.side, [d0, d1] = FLYBY.size;
  return Array.from({ length: n }, (_, i) => {
    const z = Math.exp(lo + (hi - lo) * (i + rand()) / n);   // geschichtet: keine Lücke, keine Häufung
    const r = z * (s0 + (s1 - s0) * Math.sqrt(rand())), th = rand() * 2 * Math.PI;
    return { x: r * Math.cos(th), y: r * Math.sin(th), z, size: z * (d0 + (d1 - d0) * rand()) };
  });
}

// ---------- Auftakt-Film (opener.js): Zeitmarken und Kurven der Stationskamera ab dem weißen Bild ----------
// Zeiten in Filmsekunden: build = Aufbau bis zum Knall, plasma = Nebel bis klar, dark = dunkles Zeitalter mit ersten
// Sternen, galaxies = Flug durch die Galaxien, crane = Rückzug in die Heimpose; inhale/flash/hold = Luftholen, Knall, Weiß
export function openerMarks(k, { inhale = 1.2, flash = 4.2, hold = 0.25 } = {}) {
  const bang = k.build, white = bang + flash, cool = white + hold, clear = cool + k.plasma, dawn = clear + k.dark, gal = dawn + k.galaxies;
  return { charge: bang * 0.5, inhale: bang - inhale, bang, white, cool, clear, dawn, gal, end: gal + k.crane };
}
// Kamera der Station als eine durchgehende Fahrt: d = Lage auf der Fahrachse (Heimseite positiv, Mitte 0), im Logarithmus
// um einen Nullpunkt OPENER_D0 hinter der Mitte (Anfahrt und Rückzug gleichmäßig wie ein Zoom): nahe der Mitte durch den
// Nebel, im dunklen Zeitalter langsam voran, Sturzflug durch die Galaxien bis tief hinter die Mitte, dort die Wende im Bogen
// (az/el schwenken, während die Fahrt umkehrt – kein Halt im Bild) und der Rückzug rückwärts an den Galaxien vorbei aus der
// Kugel in die Heimpose (homeDist × endDist). far = Blickziel hinter der Mitte (Flug: geradeaus; am Ende 0 = Blick auf die
// Mitte), S = Maßstab des Galaxienfelds (der Raum dehnt sich), sway/roll = Schweben und Rollen der Handkamera (Ende 0).
export const OPENER_D0 = 30;
export function openerCurves(M, k, homeDist) {
  const { white, clear, dawn, gal, end } = M, cr = end - gal, fl = gal - dawn, D = OPENER_D0;
  const d = smoothKeys([[white, D + 0.8], [clear, D + 0.3], [dawn, D - 1.5], [dawn + 0.5 * fl, D - 12], [gal, D - 21],
    [gal + 0.3 * cr, D - 10], [gal + 0.55 * cr, D + 22], [gal + 0.8 * cr, D + 90], [end, D + homeDist * k.endDist]], { log: true, flat: true });
  return {
    d: (t) => d(t) - D,
    az: smoothKeys([[white, 0], [clear, 0], [dawn, 2], [gal - 0.3 * fl, -3], [gal + 0.35 * cr, k.arc], [end, k.endAz]], { flat: true }),
    el: smoothKeys([[white, 0], [clear, 0], [dawn, -1], [gal, 1.5], [gal + 0.35 * cr, -k.rise], [end, k.endEl]], { flat: true }),
    far: smoothKeys([[white, 200], [gal + 0.15 * cr, 200], [gal + 0.75 * cr, 0]], { flat: true }),
    S: smoothKeys([[white, 10], [clear, 12], [dawn, 16], [gal, 30], [end, 34]], { flat: true }),
    sway: smoothKeys([[white, 0.02], [clear, 0.05], [dawn, 0.25], [gal, 0.9], [gal + 0.5 * cr, 1.5], [end, 0]], { flat: true }),
    roll: smoothKeys([[white, 0.01], [gal, 0.025], [gal + 0.6 * cr, 0.01], [end, 0]], { flat: true }),
  };
}
