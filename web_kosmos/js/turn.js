// Wende im Flug (erst hinaus, dann wieder hinein, z. B. Mond → Mars über das Sonnensystem) als ein Bogen statt Halt –
// Rechenkern ohne three.js (Punkte als [x, y, z]), Test tests/turn.test.js.
// Früher: Gerade weg vom Anker E bis zur Übersicht O, dort Stillstand (der Zoom dreht durch null), dann Gerade auf den
// Anker M zu. Jetzt fließt die Fahrt im Fenster |x| < k um den Wendepunkt (x = Etappen-Koordinate − Wende) durch, wie
// eine Kranfahrt: der Blickpunkt gleitet von E nach M, die Blickrichtung schwenkt in einem Zug (Steigen leicht hinter E
// gekippt, Sinken leicht vor M), der Abstand rundet sich oben ab und hebt an, wenn E und M weit auseinander liegen
// (Zoom und Schwenk nach van Wijk & Nuij 2003). Das Tempo folgt der Bildbewegung (turnPace): langsamer, wo viel durchs
// Bild zieht, schneller, wo wenig – die Fahrt wirkt gleichmäßig, ohne Halt und ohne Reißschwenk.
// k = halbe Fensterbreite in Etappen (≤ 0,5: davor/danach zoomen beide Kameras exakt, die Iris passt);
// sweep = Schwenk der Blickrichtung über die Kuppe mindestens (rad, ≈ 46°), kleinere Winkel werden bis tilt je Seite
// auseinandergekippt (rad, ≈ 23°) – sonst stünde das Bild bei dicht liegenden Ankern (Orion → Krebs) fast still;
// fit = Abstand oben mindestens fit × Weg E–M (beide gut im Bild, weiter Schwenk wird langsam);
// pace = Grenzen der Zeitdichte relativ zur Reisefahrt; gain = höchstens so viel länger wird die ganze Fahrt dadurch
export const TURN = { k: 0.5, sweep: 0.8, tilt: 0.4, fit: 1.5, pace: [0.5, 5], gain: 1.6 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
// Drehung um eine Einheitsachse (Rodrigues)
const rotate = (v, ax, ang) => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return add(add(mul(v, c), mul(cross(ax, v), s)), mul(ax, dot(ax, v) * (1 - c)));
};
// Richtung auf dem Großkreis von a nach b (Einheitsvektoren)
const slerp = (a, b, t) => {
  const om = Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
  if (om < 1e-6) return a;
  return add(mul(a, Math.sin((1 - t) * om) / Math.sin(om)), mul(b, Math.sin(t * om) / Math.sin(om)));
};
// Übergang ohne Ruck: auch die Beschleunigung ist an beiden Enden null
export const smoother = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * t * (t * (6 * t - 15) + 10);
};

// E, M = Anker der beiden Kinder in der Wendestation, O = Übersichtspose dort (Ort), zoom = Faktor je Etappe
export function planTurn(E, M, O, zoom) {
  const vE = unit(sub(O, E)), vM = unit(sub(O, M));
  const phi = Math.acos(Math.min(1, Math.max(-1, dot(vE, vM))));
  let ax = cross(vE, vM);
  if (len(ax) < 1e-9) ax = cross(vE, Math.abs(vE[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  ax = unit(ax);
  const tilt = Math.min(TURN.tilt, Math.max(0, (TURN.sweep - phi) / 2));
  const lE = Math.log(len(sub(O, E))), lM = Math.log(len(sub(O, M)));
  const tn = {
    E, M, lE, lM, L: Math.log(zoom),
    a: rotate(vE, ax, -tilt), b: rotate(vM, ax, tilt),   // Steig- und Sinkrichtung (vom Anker zur Kamera)
    lift: Math.max(0, Math.log(TURN.fit * len(sub(M, E))) - (lE + lM) / 2),
  };
  // Blickpunkt gleitet im Verhältnis zur Höhe (Bildtempo des Schwenks gleichmäßig): Tabelle ∫ e^l · Glocke, normiert
  const k = TURN.k, S = 64, g = [0];
  for (let j = 1; j <= S; j++) {
    const x = -k + (2 * k * (j - 0.5)) / S, q = 1 - (x / k) ** 2;
    g.push(g[j - 1] + Math.exp(height(tn, x) - tn.lE) * q * q);
  }
  tn.glide = g.map((v) => v / g[S]);
  return tn;
}

// Abstand (log.) zum Blickpunkt: gemischt aus Steigen (E, Rate +L) und Sinken (M, Rate −L), oben gerundet und angehoben
function height(tn, x) {
  const w = smoother(-TURN.k, TURN.k, x);
  return (1 - w) * (tn.lE + x * tn.L) + w * (tn.lM - x * tn.L) + tn.lift * (1 - smoother(0, TURN.k, Math.abs(x)));
}
// Pose im Fenster
export function turnAt(tn, x) {
  const k = TURN.k, S = tn.glide.length - 1;
  const q = Math.min(S, Math.max(0, ((x + k) / (2 * k)) * S)), j = Math.min(S - 1, Math.floor(q));
  const target = lerp(tn.E, tn.M, tn.glide[j] + (tn.glide[j + 1] - tn.glide[j]) * (q - j));
  const dir = slerp(tn.a, tn.b, smoother(-k, k, x));
  return { pos: add(target, mul(dir, Math.exp(height(tn, x)))), target };
}
// außerhalb des Fensters: Gerade der Steig- bzw. Sinkfahrt
export function lineAt(tn, x) {
  const up = x < 0;
  return { pos: add(up ? tn.E : tn.M, mul(up ? tn.a : tn.b, Math.exp(up ? tn.lE + x * tn.L : tn.lM - x * tn.L))), target: up ? tn.E : tn.M };
}
export const turnPose = (tn, x) => (Math.abs(x) < TURN.k ? turnAt(tn, x) : lineAt(tn, x));

// Bildbewegung je Etappe: mittlere Verschiebung von Probepunkten in Bildhalbbreiten (Szene log. verteilt um E und M,
// dazu ferne Sterne); Rollen um die Blickachse zählt nicht (lookAt hält den Horizont)
function probes(tn) {
  const pts = [];
  for (let i = 0; i < 120; i++) {
    const y = 1 - (2 * i + 1) / 120, r = Math.sqrt(1 - y * y), ph = i * 2.399963;
    const u = [Math.cos(ph) * r, y, Math.sin(ph) * r];
    // je Anker bis zu dessen Abstand der Übersicht (die Szene um die Erde reicht nicht bis zum Mond)
    const R = Math.exp(i % 3 === 1 ? tn.lM : i % 3 === 0 ? tn.lE : Math.max(tn.lE, tn.lM) + 14);
    pts.push(add(i % 3 === 1 ? tn.M : tn.E, mul(u, i % 3 === 2 ? R : R * Math.pow(10, -2.5 + 2.5 * ((i * 0.618034) % 1)))));
  }
  return pts;
}
export function flowAt(tn, x, tanH, aspect, pts = probes(tn), h = 1e-3) {
  const look = (p) => {
    const f = unit(sub(p.target, p.pos));
    return { f, dirs: pts.map((q) => unit(sub(q, p.pos))) };
  };
  const A = look(turnPose(tn, x - h)), B = look(turnPose(tn, x + h));
  const edge = Math.cos(Math.atan(tanH * Math.hypot(1, aspect)));
  // gestutztes Mittel: die schnellsten 20 % (Punkte dicht an der Kamera) bestimmen das Tempo nicht
  const v = [];
  pts.forEach((_, i) => {
    if (dot(A.dirs[i], A.f) >= edge) v.push(len(sub(sub(B.dirs[i], B.f), sub(A.dirs[i], A.f))));
  });
  if (!v.length) return 0;
  v.sort((p, q) => p - q);
  const keep = v.slice(0, Math.max(1, Math.ceil(v.length * 0.8)));
  return keep.reduce((s, x) => s + x, 0) / keep.length / (2 * h * tanH);
}
// Zeitdichte im Fenster (1 = Reisefahrt der Zoom-Geraden): Bildbewegung / Bildbewegung an den Fensterrändern
export function turnPace(tn, tanH, aspect) {
  const pts = probes(tn), S = 48, k = TURN.k;
  const ref = (flowAt(tn, -k, tanH, aspect, pts) + flowAt(tn, k, tanH, aspect, pts)) / 2 || 1;
  const m = [];
  for (let j = 0; j <= S; j++) {
    const v = flowAt(tn, -k + (2 * k * j) / S, tanH, aspect, pts) / ref;
    m.push(Math.min(TURN.pace[1], Math.max(TURN.pace[0], v)));
  }
  // an den Rändern weich auf 1, damit die Zeitdichte stetig bleibt
  return (x) => {
    if (Math.abs(x) >= k) return 1;
    const q = ((x + k) / (2 * k)) * S, j = Math.min(S - 1, Math.floor(q));
    const v = m[j] + (m[j + 1] - m[j]) * (q - j);
    const edge = smoother(k, 0.6 * k, Math.abs(x));
    return 1 + (v - 1) * edge;
  };
}
