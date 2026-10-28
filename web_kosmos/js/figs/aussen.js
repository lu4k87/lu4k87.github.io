// Infografiken Ast Saturn, Uranus, Neptun, Pluto (02D Saturn, 02D1 Titan, 02D2 Enceladus, 02G Uranus, 02G1 Miranda,
// 02F Neptun, 02F1 Triton, 02H Pluto). Werte: NSSDCA Fact Sheets (Planeten, Monde, Ringe), USGS-Gazetteer, NASA/JPL,
// ESA, NOAA; Winkel, Verhältnisse und Sonnenstand als eigene Rechnung daraus. Aufbau wie figs/mars.js.
// Zwei Bausteine nur für diesen Ast (Absprache mit dev-ws-98, 26.10.2026), in figs.js über `kinds` eingehängt:
// curve (Sonnenstand über die Jahre) und rings (Abstand vom Planeten: Ringe als Bänder, Monde als Punkte).
import { PLANETS, PLUTO, planetPosition, eclToScene, equToScene, laplacePos, laplaceAxes, J2000 } from '../astro.js';
import { SATURN } from '../kronian.js';
import { esc, f1 } from '../figs.js';

const W = 300, CH = 6.7, DEG = 180 / Math.PI;
const txt = (x, y, s, a = 'start', cls = '') => `<text x="${f1(x)}" y="${f1(y)}" text-anchor="${a}"${cls ? ` class="${cls}"` : ''}>${esc(s)}</text>`;
const svg = (h, alt, body) => `<svg class="hc-svg hf" viewBox="0 0 ${W} ${f1(h)}" role="img" aria-label="${esc(alt)}">${body}</svg>`;
const hl = (on) => (on ? ' is-hl' : '');
const tick = (x1, y1, x2, y2) => `<path d="M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}" class="hf-tick"/>`;
const lw = (o) => Math.max(o.l.length, (o.t || '').length) * CH;

// Beschriftungen von links nach rechts in Zeilen legen: jede in die erste Zeile, in der sie neben die vorige passt
function lanes(list) {
  const ends = [];
  return list.map(({ x, w }) => {
    const left = Math.min(Math.max(x - w / 2, 0), W - w);
    let r = ends.findIndex((e) => e + 6 <= left);
    if (r < 0) r = ends.push(0) - 1;
    ends[r] = left + w;
    return { r, x: left + w / 2 };
  });
}
const label = (p, y, o, cls) => txt(p.x, y, o.l, 'middle', o.hl ? 'hf-name hc-acc' : 'hf-name') + (o.t ? txt(p.x, y + 12, o.t, 'middle', cls) : '');

// Verlauf über die Jahre (z. B. Breite der Sonne im Zenit): Marken oben in eigenen Zeilen, Strich zum Punkt;
// Bezugslinien (refs) gestrichelt, Name links unter der Linie
function curve(f) {
  const x0 = 52, x1 = W - 8, X = (v) => x0 + ((v - f.x0) / (f.x1 - f.x0)) * (x1 - x0);
  const pos = lanes(f.marks.map((m) => ({ x: X(m.x), w: lw(m) })));
  const yT = 14 + Math.max(0, ...pos.map((p) => p.r + 1)) * 28 + 4, yB = yT + 124;
  const Y = (v) => yB - ((v - f.y0) / (f.y1 - f.y0)) * (yB - yT);
  const ns = (v) => (v ? `${Math.abs(v)}° ${v > 0 ? 'N' : 'S'}` : '0°');
  let s = '';
  for (let v = f.y0; v <= f.y1; v += f.ystep) s += `<line x1="${x0}" x2="${x1}" y1="${f1(Y(v))}" y2="${f1(Y(v))}" class="${v ? 'hc-grid' : 'hf-base'}"/>${txt(x0 - 6, Y(v) + 4, ns(v), 'end')}`;
  for (let v = Math.ceil(f.x0 / f.xstep) * f.xstep; v <= f.x1; v += f.xstep) s += tick(X(v), yB, X(v), yB + 4) + txt(X(v), yB + 16, String(v), 'middle');
  for (const r of f.refs || []) s += `<line x1="${x0}" x2="${x1}" y1="${f1(Y(r.y))}" y2="${f1(Y(r.y))}" class="hc-path"/>` + (r.l ? txt(x0 + 4, Y(r.y) + 13, r.l) : '');
  s += `<path d="M${f.pts.map(([x, y]) => `${f1(X(x))} ${f1(Y(y))}`).join('L')}" class="hc-curve" pathLength="1"/>`;
  f.marks.forEach((m, i) => {
    const px = X(m.x), py = Y(m.y), ly = 12 + pos[i].r * 28;
    s += tick(pos[i].x, ly + (m.t ? 16 : 4), px, py - 5) + `<circle cx="${f1(px)}" cy="${f1(py)}" r="${m.hl ? 4.5 : 3.5}" class="hc-sat${m.hl ? ' is-on' : ''}"/>`;
    s += label(pos[i], ly, m, 'hc-acc');
  });
  return svg(yB + 22, f.alt, s);
}

// Abstand vom Planetenmittelpunkt maßstäblich: Planetenrand als Bogen, Ringe als Bänder (o = Deckkraft, gap = Lücke,
// none = nur Beschriftung, at = Lage der Beschriftung), Monde als Punkte; Namen der Bänder oben, der Punkte unten, je in eigenen Zeilen
function rings(f) {
  const x0 = 8, x1 = W - 8, X = (v) => x0 + ((v - f.min) / (f.max - f.min)) * (x1 - x0);
  const bands = f.bands || [], pts = f.pts || [], bl = bands.filter((b) => b.l);
  const mid = (b) => X((Math.max(b.a, f.min) + b.b) / 2), top = lanes(bl.map((b) => ({ x: b.at === undefined ? mid(b) : X(b.at), w: lw(b) })));
  const bot = lanes(pts.map((p) => ({ x: X(p.v), w: lw(p) })));
  const yA = 14 + Math.max(0, ...top.map((p) => p.r + 1)) * 28 + 15, yX = yA + 24, yP = yX + 38;
  let s = '';
  if (f.r > f.min) {   // Rand des Planeten: Kreis um X(0), oben und unten gekappt
    const cx = X(0), R = X(f.r) - cx, h = Math.min(R, 20), dx = Math.sqrt(R * R - h * h);
    s += `<path d="M${f1(x0)} ${f1(yA - h)}H${f1(cx + dx)}A${f1(R)} ${f1(R)} 0 0 1 ${f1(cx + dx)} ${f1(yA + h)}H${f1(x0)}Z" class="hf-planet"/>`;
    if (cx + R - x0 > f.l.length * CH + 10) s += txt(x0 + 5, yA + 4, f.l, 'start', 'hf-on-planet');
  }
  for (const b of bands) {
    if (b.none) continue;
    const xa = X(Math.max(b.a, f.min)), w = Math.max(1.5, X(b.b) - xa);
    s += b.gap ? `<rect x="${f1(xa)}" y="${yA - 9}" width="${f1(w)}" height="18" class="hc-path"/>`
      : `<rect x="${f1(xa)}" y="${yA - 9}" width="${f1(w)}" height="18" class="hf-bar${hl(b.hl)}"${b.o ? ` fill-opacity="${b.o}"` : ''}/>`;
  }
  bl.forEach((b, i) => {
    const ly = 12 + top[i].r * 28;
    s += tick(top[i].x, ly + (b.t ? 16 : 4), mid(b), yA - 11) + label(top[i], ly, b);
  });
  s += `<line x1="${x0}" x2="${x1}" y1="${yX}" y2="${yX}" class="hf-base"/>`;
  for (let v = Math.ceil(f.min / f.step) * f.step; v <= f.max; v += f.step) s += tick(X(v), yX, X(v), yX + 4) + txt(X(v), yX + 16, (v / 1000).toLocaleString('de-DE'), 'middle');
  s += txt(x1, yX - 5, f.u, 'end');
  pts.forEach((p, i) => {
    const ly = yP + bot[i].r * 28;
    s += tick(X(p.v), yA + 5, bot[i].x, ly - 11) + `<circle cx="${f1(X(p.v))}" cy="${yA}" r="3.4" class="hc-sat${p.hl ? ' is-on' : ''}"/>` + label(bot[i], ly, p);
  });
  return svg(pts.length ? yP + Math.max(...bot.map((p) => p.r)) * 28 + 20 : yX + 24, f.alt, s);
}

export const kinds = { curve, rings };

// ---------- Rechnung: Breite der Sonne im Zenit (Planetenbahn JPL, Pol IAU) ----------
const P = Object.fromEntries(PLANETS.map((p) => [p.id, p]));
const jd = (y) => J2000 + (y - 2000) * 365.25, NOW = 2000 + (Date.now() - Date.UTC(2000, 0, 1, 12)) / 864e5 / 365.25;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = (a) => a.map((v) => v / Math.hypot(...a));
const sunDir = (p, y) => unit(eclToScene(planetPosition(p, jd(y))).map((v) => -v));
const subsolar = (pole, p) => (y) => Math.asin(dot(unit(pole), sunDir(p, y))) * DEG;
// Triton: mittlere Bahn wie levels/triton.js (JPL NEP098, Laplace-Pol = Neptuns Pol); Nordpol (IAU) gegen den Bahndrehimpuls
// ponytail: Werte doppelt zu levels/triton.js (das three.js lädt), bei Änderung dort mitziehen
const TRITON = { a: 354800, e: 0, w: 0, M: 63.0, i: 157.3, node: 177.7, P: 5.8792, Pw: 675.2, Pn: 299.4 }, TAX = laplaceAxes(299.36, 43.46);
const tPos = (t) => { const [x, y, z] = laplacePos(TRITON, t); return [0, 1, 2].map((k) => TAX.x[k] * x + TAX.y[k] * y + TAX.z[k] * z); };
const tritonSun = (y) => {
  const a = tPos(jd(y)), b = tPos(jd(y) + 0.01), n = [a[2] * b[1] - a[1] * b[2], a[0] * b[2] - a[2] * b[0], a[1] * b[0] - a[0] * b[1]];
  return Math.asin(dot(unit(n), sunDir(P.neptune, y))) * DEG;
};
const SUN = {
  saturn: subsolar(equToScene(...SATURN.pole), P.saturn),
  uranus: subsolar(equToScene(257.311, -15.175), P.uranus),
  pluto: subsolar(equToScene(132.993, -6.163), PLUTO),
  triton: tritonSun,
};
const sample = (fn, a, b, n) => Array.from({ length: n + 1 }, (_, i) => { const x = a + ((b - a) * i) / n; return [x, fn(x)]; });
const zero = (fn, a, b) => { for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (Math.sign(fn(m)) === Math.sign(fn(a))) a = m; else b = m; } return (a + b) / 2; };
const MONTH = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const month = (y) => `${MONTH[Math.floor((y % 1) * 12)]} ${Math.floor(y)}`;
const ns = (v) => `${Math.round(Math.abs(v))}° ${v >= 0 ? 'N' : 'S'}`;
const mark = (fn, x, l, t, on) => ({ x, y: fn(x), l, t: t === undefined ? ns(fn(x)) : t, hl: on });
const SAT_EQ = zero(SUN.saturn, 2024, 2027), V2_URANUS = 1986 + 23.75 / 365.25, V2_NEPTUNE = 1989 + 236.2 / 365.25;

// ---------- gemeinsame Grafiken mehrerer Abzeichen ----------
const sky = (r, a) => 2 * Math.asin(r / a) * DEG;   // Winkeldurchmesser in Grad
const deg = (v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: v < 1 ? 2 : v < 10 ? 1 : 0 })}°`;
const SKY_ITEMS = [
  ['enceladus', 'Enceladus', sky(60268, 238020)], ['miranda', 'Miranda', sky(25559, 129900)],
  ['triton', 'Triton', sky(24764, 354760)], ['titan', 'Titan', sky(60268, 1221870)], ['moon', 'Mond', sky(1737.4, 384400)],
];
const SKY = (on) => ({
  k: 'scale', h: 90, alt: 'Planet am Himmel: Saturn von Enceladus und Titan, Uranus von Miranda, Neptun von Triton, Vollmond von der Erde – Winkelgröße maßstäblich',
  items: SKY_ITEMS.map(([id, l, a]) => ({ l, a, t: deg(a), hl: id === on })),
  cap: 'Scheibe des Planeten am Himmel des Mondes, maßstäblich (eigene Rechnung aus Planetenradius und Bahnradius): Saturn von Enceladus und von Titan, Uranus von Miranda, Neptun von Triton. Der Vollmond von der Erde ist daneben ein Punkt.',
  s: ['nasa-saturnfact', 'nssdc-satsat', 'ura-nssdc', 'ura-nssdc-sat', 'nep-fact', 'nssdc-nepsat', 'nasa-moon'],
});
const SEAS = (on) => ({
  k: 'bars', alt: 'Durchmesser der drei großen Meere auf Titan: Kraken Mare, Ligeia Mare und Punga Mare',
  groups: [{ t: 'Größe', u: 'km', items: [
    { l: 'Kraken Mare', v: 1170, t: '1.170', hl: on === 'kraken' },
    { l: 'Ligeia Mare', v: 500, t: '500', hl: on === 'ligeia' },
    { l: 'Punga Mare', v: 380, t: '380' },
  ] }],
  cap: 'Die drei großen Meere aus flüssigem Methan und Ethan nach dem Gazetteer der IAU. Alle liegen im hohen Norden: Kraken Mare um 68° N, Ligeia Mare um 79,7° N, Punga Mare um 85,1° N.',
  s: ['usgs-gazetteer-titan', 'usgs-titan-names'],
});
const OCEAN = (on) => ({
  k: 'bars', alt: 'Dicke der Eiskruste über dem Ozean auf Titan und Enceladus, zum Vergleich die tiefste Stelle der Erdmeere',
  groups: [{ t: 'Tiefe bis zum Wasser', u: 'km', items: [
    { l: 'Titan', v: 80, t: '55–80', hl: on === 'titan' },
    { l: 'Enceladus', v: 25, t: '20–25', hl: on === 'enceladus' },
    { l: 'Enceladus Südpol', v: 5, t: '1–5', hl: on === 'enceladus' },
    { l: 'Marianengraben', v: 10.935, t: '10,9' },
  ] }],
  cap: 'Dicke der Eiskruste bis zum Ozean, gezeichnet bis zum oberen Wert; zum Vergleich die tiefste Stelle der Erdmeere (Challenger Deep). Am Südpol von Enceladus ist das Eis am dünnsten – dort steigen die Fontänen auf.',
  s: ['fulchignoni-2005', 'cadek-2016', 'greenaway-2021'],
});
const ORBIT2 = (inner, outer, on) => ({
  k: 'orbit', l: 'Saturn', r: 60268, alt: `Bahnen von ${inner[0]} und ${outer[0]} um Saturn von oben, maßstäblich`,
  orbits: [
    { l: 'A-Ring außen', a: 136780, t: '136.780 km', dash: true },
    { l: inner[0], a: inner[1], t: `${inner[2]} d · 2 Umläufe`, hl: on === inner[0] },
    { l: outer[0], a: outer[1], t: `${outer[2]} d · 1 Umlauf`, hl: on === outer[0] },
  ],
  cap: `Bahnen maßstäblich von oben. In der Zeit, in der ${outer[0]} einmal kreist, schafft ${inner[0]} zwei Runden: Die Monde stehen in Bahnresonanz 2 : 1 (eigene Rechnung aus den Umlaufzeiten).`,
  s: ['nssdc-satsat', 'nasa-saturn'],
});
const URA5 = [['miranda', 'Miranda', 471.4], ['ariel', 'Ariel', 1157.8], ['umbriel', 'Umbriel', 1169.4], ['titania', 'Titania', 1577.8], ['oberon', 'Oberon', 1522.8]];
const CORONAE = (on) => ({
  k: 'scale', alt: 'Die drei Coronae Elsinore, Arden und Inverness maßstäblich neben Miranda',
  items: [
    { l: 'Miranda', a: 480, b: 465.8, t: '480 × 466 km' },
    { l: 'Elsinore', a: 323, t: '323 km', hl: on === 'elsinore' },
    { l: 'Arden', a: 318, t: '318 km', hl: on === 'arden' },
    { l: 'Inverness', a: 234, t: '234 km', hl: on === 'inverness' },
  ],
  cap: 'Die drei Coronae maßstäblich neben Miranda selbst (Größe nach dem Gazetteer der IAU, Achsen nach NSSDCA). Jede bedeckt einen großen Teil einer Halbkugel.',
  s: ['ura-usgs-miranda', 'ura-nssdc-sat'],
});
const NIGHT = (lat, date, body) => ({
  k: 'polar', edge: -10, grid: [60, 30, 0], alt: `Nordpol von ${body} von oben: Polarnacht beim Vorbeiflug von Voyager 2`,
  zones: [{ lat, t: `nördlich ≈ ${Math.round(lat)}° N`, l: `Polarnacht ${date.slice(-4)}`, l2: 'nie gesehen', hl: true }],
  cap: `Nordpol von oben, Breitenkreise maßstäblich. Beim Vorbeiflug am ${date} stand die Sonne über ≈ ${Math.round(90 - lat)}° S; nördlich von ≈ ${Math.round(lat)}° N war Polarnacht (eigene Rechnung aus den JPL-Bahnelementen).`,
});

const uraNight = 90 + SUN.uranus(V2_URANUS), triNight = 90 + SUN.triton(V2_NEPTUNE);

export default {
  // ---------- 02D Saturn & Monde ----------
  'saturn.rings': {
    k: 'rings', min: 50000, max: 145000, step: 20000, u: 'Tsd. km', r: 60268, l: 'Saturn', alt: 'Ringe des Saturn radial maßstäblich vom D- bis zum F-Ring',
    bands: [
      { a: 66900, b: 74510, l: 'D', o: 0.25 },
      { a: 74658, b: 91975, l: 'C', o: 0.5 },
      { a: 91975, b: 117507, l: 'B', hl: true },
      { a: 117507, b: 122340, l: 'Cassini', gap: true },
      { a: 122340, b: 136780, l: 'A', o: 0.8 },
      { a: 139776, b: 139876, l: 'F' },
    ],
    cap: 'Abstand vom Saturnmittelpunkt maßstäblich. Die Hauptringe C, B und A sind zusammen gut 62.000 km breit und dabei nur 5 bis 30 m dick (Breite eigene Rechnung aus den Randradien).',
    s: ['nasa-saturn', 'nasa-saturnfact'],
  },
  'saturn.cassini': {
    k: 'bars', alt: 'Optische Tiefe und Breite von C-, B- und A-Ring und der Cassini-Teilung',
    groups: [
      { t: 'Optische Tiefe', u: 'bis', items: [
        { l: 'C-Ring', v: 0.35, t: '0,05–0,35' },
        { l: 'B-Ring', v: 2.5, t: '0,4–2,5' },
        { l: 'Cassini-Teilung', v: 0.1, t: '0–0,1', hl: true },
        { l: 'A-Ring', v: 1, t: '0,4–1,0' },
      ] },
      { t: 'Breite', u: 'km', items: [
        { l: 'B-Ring', v: 25532, t: '25.532' },
        { l: 'Cassini-Teilung', v: 4833, t: '4.833', hl: true },
        { l: 'A-Ring', v: 14440, t: '14.440' },
      ] },
    ],
    cap: 'Optische Tiefe: wie stark ein Ring das Licht schluckt – ab etwa 1 kommt kaum noch etwas durch. Die Cassini-Teilung ist dünn besetzt, der B-Ring fast undurchsichtig. Breiten aus den Randradien (eigene Rechnung).',
    s: ['nasa-saturn'],
  },
  'saturn.shadow': {
    k: 'curve', x0: 1980, x1: 2040, xstep: 20, y0: -40, y1: 40, ystep: 20, alt: 'Höhe der Sonne über der Ringebene des Saturn von 1980 bis 2040',
    pts: sample(SUN.saturn, 1980, 2040, 120), refs: [{ y: 26.73 }, { y: -26.73, l: 'Achsneigung 26,7°' }],
    marks: [mark(SUN.saturn, 2017.4, 'Nordsommer'), mark(SUN.saturn, SAT_EQ, 'Ringebene', month(SAT_EQ), true)],
    cap: 'Breite, über der die Sonne im Zenit steht – zugleich ihre Höhe über der Ringebene (eigene Rechnung aus den JPL-Bahnelementen und dem IAU-Pol). Bei 0° streift das Licht die Ringe, ihr Schatten auf dem Planeten schrumpft zum Strich.',
    s: ['nasa-saturn-facts', 'jpl-elements'],
  },
  'saturn.hexagon': {
    k: 'bars', alt: 'Breite des Hexagons am Saturn-Nordpol im Vergleich zu Saturn und Erde',
    groups: [{ t: 'Breite', u: 'km', items: [
      { l: 'Saturn, Äquator', v: 120536, t: '120.536' },
      { l: 'Hexagon', v: 30000, t: '≈ 30.000', hl: true },
      { l: 'Erde, Äquator', v: 12756, t: '12.756' },
    ] }],
    cap: 'Das Hexagon ist mehr als doppelt so breit wie die Erde, aber nur ein Viertel so breit wie Saturn (Durchmesser aus den Äquatorradien, eigene Rechnung).',
    s: ['nasa-saturn-facts', 'nasa-saturnfact', 'nasa-earth'],
  },
  'saturn.ering': {
    k: 'rings', min: 0, max: 560000, step: 100000, u: 'Tsd. km', r: 60268, l: 'Saturn', alt: 'E-Ring des Saturn mit den Bahnen von Mimas bis Rhea, Abstand maßstäblich',
    bands: [{ a: 66900, b: 139826, l: 'Hauptringe', o: 0.9 }, { a: 180000, b: 480000, l: 'E-Ring', t: '180.000–480.000 km', o: 0.3, hl: true }],
    pts: [
      { v: 185520, l: 'Mimas' }, { v: 238020, l: 'Enceladus', hl: true }, { v: 294660, l: 'Tethys' },
      { v: 377400, l: 'Dione' }, { v: 527040, l: 'Rhea' },
    ],
    cap: 'Abstand vom Saturnmittelpunkt maßstäblich. Der E-Ring ist rund 300.000 km breit und so dünn (optische Tiefe 10⁻⁶), dass er nur im Gegenlicht auffällt. Enceladus kreist in seinem dichtesten Teil und speist ihn mit Eisstaub.',
    s: ['nasa-saturn', 'nssdc-satsat', 'cadek-2016'],
  },
  'saturn.mimas': ORBIT2(['Mimas', 185520, '0,942'], ['Tethys', 294660, '1,888'], 'Mimas'),
  'saturn.tethys': {
    k: 'bars', alt: 'Mittlere Dichte der großen Saturnmonde, Wasser zum Vergleich',
    groups: [{ t: 'Mittlere Dichte', u: 'g/cm³', items: [
      { l: 'Titan', v: 1.88, t: '1,88' }, { l: 'Enceladus', v: 1.61, t: '1,61' }, { l: 'Dione', v: 1.48, t: '1,48' },
      { l: 'Rhea', v: 1.24, t: '1,24' }, { l: 'Mimas', v: 1.15, t: '1,15' }, { l: 'Wasser', v: 1, t: '1,00' },
      { l: 'Tethys', v: 0.985, t: '0,985', hl: true },
    ] }],
    cap: 'Mittlere Dichte nach dem Fact Sheet, Wasser zum Vergleich. Je dichter ein Mond, desto mehr Gestein steckt unter dem Eis – Tethys ist kaum dichter als Wasser.',
    s: ['nssdc-satsat'],
  },
  'saturn.dione': ORBIT2(['Enceladus', 238020, '1,370'], ['Dione', 377400, '2,737'], 'Dione'),
  'saturn.rhea': {
    k: 'scale', h: 100, alt: 'Titan, Mond der Erde, Rhea und Iapetus maßstäblich',
    items: [
      { l: 'Titan', a: 5150, t: '5.150 km' }, { l: 'Mond', a: 3474.8, t: '3.475 km' },
      { l: 'Rhea', a: 1527, t: '1.527 km', hl: true }, { l: 'Iapetus', a: 1469, t: '1.469 km' },
    ],
    cap: 'Durchmesser maßstäblich (mittlere Radien aus den Fact Sheets). Rhea ist nach Titan der zweitgrößte Saturnmond, knapp vor Iapetus; beide messen weniger als die Hälfte des Mondes der Erde.',
    s: ['nssdc-satsat', 'nasa-moon'],
  },

  // ---------- 02D1 Titan ----------
  'titan.haze': {
    k: 'bars', alt: 'Höhe der Atmosphäre und Luftdruck am Boden: Titan und Erde',
    groups: [
      { t: 'Höhe der Atmosphäre', u: 'km', items: [{ l: 'Titan', v: 600, t: '≈ 600', hl: true }, { l: 'Erde', v: 60, t: '≈ 60' }] },
      { t: 'Druck am Boden', u: 'Erde = 1', items: [{ l: 'Titan', v: 1.6, t: '1,6', hl: true }, { l: 'Erde', v: 1, t: '1,0' }] },
    ],
    cap: 'Titans Lufthülle reicht zehnmal so hoch wie die der Erde, am Boden ist der Druck 60 % höher – bei nur einem Siebtel der Schwerkraft (eigene Rechnung aus Masse und Radius).',
    s: ['fulchignoni-2005', 'nssdc-satsat'],
  },
  'titan.kraken': SEAS('kraken'),
  'titan.ligeia': SEAS('ligeia'),
  'titan.huygens': {
    k: 'timeline', alt: 'Zeitleiste: Huygens landet 2005 auf Titan, Dragonfly soll 2028 starten',
    items: [
      { d: '2004-12-25', t: '25.12.2004', l: 'Huygens trennt', l2: 'sich von Cassini' },
      { d: '2005-01-14', t: '14.01.2005', l: 'Landung', l2: 'auf Titan', hl: true },
      { d: '2028-07-01', t: 'Juli 2028', l: 'Dragonfly startet', l2: 'frühestens' },
      { d: '2034-11-01', t: 'Ende 2034', l: 'Dragonfly', l2: 'kommt an' },
    ],
    cap: 'Huygens landete drei Wochen nach der Trennung von Cassini; rund 70 Minuten kamen Daten vom Boden. Als Nächstes soll die Drohne Dragonfly über Dünen und den Krater Selk fliegen.',
    s: ['lebreton-2005', 'nasa-huygens-site', 'nasa-dragonfly'],
  },
  'titan.menrva': {
    k: 'scale', h: 110, alt: 'Einschlagkrater auf Titan maßstäblich: Menrva, Selk, Sinlap, Ksa',
    items: [
      { l: 'Menrva', a: 392, t: '392 km', hl: true }, { l: 'Selk', a: 80, t: '80 km' },
      { l: 'Sinlap', a: 80, t: '80 km' }, { l: 'Ksa', a: 29, t: '29 km' },
    ],
    cap: 'Durchmesser nach dem Gazetteer der IAU, maßstäblich. Menrva ist das größte bekannte Einschlagbecken auf Titan; den viel kleineren Selk soll die Drohne Dragonfly besuchen.',
    s: ['usgs-titan-names', 'nasa-dragonfly'],
  },
  'titan.xanadu': {
    k: 'bars', alt: 'Ausdehnung von Xanadu im Vergleich zu Titan, Kraken Mare und Menrva',
    groups: [{ t: 'Ausdehnung', u: 'km', items: [
      { l: 'Titan (Ø)', v: 5150, t: '5.150' }, { l: 'Xanadu', v: 3400, t: '3.400', hl: true },
      { l: 'Kraken Mare', v: 1170, t: '1.170' }, { l: 'Menrva', v: 392, t: '392' },
    ] }],
    cap: 'Xanadu misst nach dem Gazetteer der IAU rund 3.400 km – zwei Drittel des Titan-Durchmessers (eigene Rechnung).',
    s: ['usgs-titan-names', 'usgs-gazetteer-titan', 'nssdc-satsat'],
  },
  'titan.ocean': OCEAN('titan'),
  'titan.saturn': SKY('titan'),

  // ---------- 02D2 Enceladus ----------
  'enceladus.stripes': {
    k: 'bars', alt: 'Länge der vier Tigerstreifen am Südpol von Enceladus',
    groups: [{ t: 'Länge', u: 'km', items: [
      { l: 'Baghdad Sulcus', v: 176, t: '176', hl: true }, { l: 'Cairo Sulcus', v: 165, t: '165' },
      { l: 'Damascus Sulcus', v: 125, t: '125' }, { l: 'Alexandria S.', v: 111, t: '111' },
    ] }],
    cap: 'Die vier Tigerstreifen nach dem Gazetteer der IAU; NASA nennt im Schnitt rund 135 km. Baghdad Sulcus zieht fast über den Südpol (Mitte bei 86,9° S).',
    s: ['usgs-enceladus-names', 'nasa-enceladus-jets'],
  },
  'enceladus.samaria': {
    k: 'bars', alt: 'Länge von Samaria Rupes im Vergleich zum Durchmesser von Enceladus',
    groups: [{ t: 'Länge', u: 'km', items: [
      { l: 'Enceladus (Ø)', v: 504, t: '504' }, { l: 'Samaria Rupes', v: 193, t: '193', hl: true },
      { l: 'Baghdad Sulcus', v: 176, t: '176' }, { l: 'Verona Rupes', v: 116, t: '116 (Miranda)' },
    ] }],
    cap: 'Samaria Rupes ist nach dem Gazetteer gut 190 km lang – fast zwei Fünftel des Monddurchmessers (eigene Rechnung). Die Steilwand Verona Rupes auf Miranda zum Vergleich.',
    s: ['usgs-enceladus-names', 'nssdc-satsat', 'ura-usgs-miranda'],
  },
  'enceladus.plume': {
    k: 'range', min: 0, max: 450, step: 50, u: 'm/s', alt: 'Geschwindigkeit der Fontänen von Enceladus und Fluchtgeschwindigkeit',
    span: [239, 450], spanL: 'entkommt',
    marks: [{ v: 239, t: '239 m/s', l: 'Fluchtgeschwindigkeit' }, { v: 400, t: '≈ 400 m/s', l: 'Fontäne' }],
    cap: 'Was schneller als 239 m/s aufsteigt, kehrt nicht zurück und speist den E-Ring – das Gas der Fontänen mit rund 400 m/s gehört dazu (Fluchtgeschwindigkeit eigene Rechnung aus Masse und Radius). Langsamere Eisteilchen fallen als Schnee zurück.',
    s: ['cadek-2016', 'nssdc-satsat'],
  },
  'enceladus.ocean': OCEAN('enceladus'),
  'enceladus.saturn': SKY('enceladus'),

  // ---------- 02G Uranus & Monde ----------
  'uranus.axis': {
    k: 'curve', x0: 1940, x1: 2070, xstep: 40, y0: -90, y1: 90, ystep: 45, alt: 'Breite der Sonne im Zenit auf Uranus von 1940 bis 2070',
    pts: sample(SUN.uranus, 1940, 2070, 130),
    marks: [mark(SUN.uranus, V2_URANUS, 'Voyager 2'), mark(SUN.uranus, NOW, 'heute', undefined, true)],
    cap: 'Breite, über der die Sonne im Zenit steht (eigene Rechnung aus den JPL-Bahnelementen und dem IAU-Pol). Bei 97,77° Achsneigung wandert sie im 84-jährigen Uranusjahr bis über 82° Nord und Süd; Ende 2007 stand sie über dem Äquator.',
    s: ['ura-nssdc', 'ura-nssdc', 'jpl-elements'],
  },
  'uranus.rings': {
    k: 'rings', min: 0, max: 110000, step: 20000, u: 'Tsd. km', r: 25559, l: 'Uranus', alt: 'Ringe des Uranus radial maßstäblich, von den schmalen inneren Ringen bis zu ν und μ',
    bands: [
      ...[41837, 42234, 42571, 44718, 45661, 47176, 47627, 48300, 50024].map((a) => ({ a, b: a + 10 })),
      { a: 41837, b: 50024, l: '9 schmale', none: true, at: 26000 },
      { a: 51120, b: 51180, l: 'ε', t: '20–96 km', hl: true },
      { a: 65400, b: 69200, l: 'ν', t: '3.800 km', o: 0.25 },
      { a: 89200, b: 106200, l: 'μ', t: '17.000 km', o: 0.18 },
    ],
    cap: 'Abstand vom Uranusmittelpunkt maßstäblich, mit der Breite der Ringe. Zehn schmale, fast schwarze Ringe liegen dicht gedrängt, ε ist der breiteste. Weit draußen die schwachen Staubringe ν und μ (R/2003 U 2 und U 1).',
    s: ['ura-nssdc-ring', 'ura-nssdc'],
  },
  'uranus.ariel': {
    k: 'scale', alt: 'Die fünf großen Uranusmonde maßstäblich, Ariel hervorgehoben',
    items: URA5.map(([id, l, a]) => ({ l, a, t: `${Math.round(a).toLocaleString('de-DE')} km`, hl: id === 'ariel' })),
    cap: 'Die fünf großen Uranusmonde maßstäblich, von innen nach außen (Durchmesser aus den mittleren Radien). Ariel und Umbriel sind fast gleich groß.',
    s: ['ura-nssdc-sat'],
  },
  'uranus.umbriel': {
    k: 'bars', alt: 'Rückstrahlung der fünf großen Uranusmonde, Umbriel am dunkelsten',
    groups: [{ t: 'Geometrische Albedo', u: '%', items: [
      { l: 'Ariel', v: 39, t: '39 %' }, { l: 'Miranda', v: 32, t: '32 %' }, { l: 'Titania', v: 27, t: '27 %' },
      { l: 'Oberon', v: 23, t: '23 %' }, { l: 'Umbriel', v: 21, t: '21 %', hl: true },
    ] }],
    cap: 'Anteil des Lichts, den die Oberfläche zurückwirft (geometrische Albedo im sichtbaren Licht). Umbriel ist der dunkelste der fünf; Ariel wirft fast doppelt so viel zurück.',
    s: ['ura-nssdc-sat'],
  },
  'uranus.titania': {
    k: 'bars', alt: 'Länge der Grabenbrüche auf Titania im Vergleich zu ihrem Durchmesser und zum Grand Canyon',
    groups: [{ t: 'Länge', u: 'km', items: [
      { l: 'Titania (Ø)', v: 1578, t: '1.578' }, { l: 'Grabenbrüche', v: 1600, t: 'bis ≈ 1.600', hl: true },
      { l: 'Grand Canyon', v: 447, t: '447' },
    ] }],
    cap: 'Die längsten Grabenbrüche sind etwa so lang, wie Titania breit ist. Grand Canyon: Länge entlang des Colorado.',
    s: ['herschel-1787', 'ura-nssdc-sat', 'nps-grca'],
  },
  'uranus.oberon': {
    k: 'rings', min: 0, max: 620000, step: 100000, u: 'Tsd. km', r: 25559, l: 'Uranus', alt: 'Abstand der fünf großen Uranusmonde maßstäblich mit Umlaufzeit',
    pts: [
      { v: 129900, l: 'Miranda', t: '1,4 d' }, { v: 190900, l: 'Ariel', t: '2,5 d' }, { v: 266000, l: 'Umbriel', t: '4,1 d' },
      { v: 436300, l: 'Titania', t: '8,7 d' }, { v: 583500, l: 'Oberon', t: '13,5 d', hl: true },
    ],
    cap: 'Abstand von Uranus maßstäblich, darunter die Umlaufzeit. Oberon kreist am weitesten außen und braucht fast zehnmal so lange wie Miranda.',
    s: ['ura-nssdc-sat'],
  },

  // ---------- 02G1 Miranda ----------
  'miranda.uranus': SKY('miranda'),
  'miranda.orbit': {
    k: 'bars', alt: 'Bahnneigung der fünf großen Uranusmonde gegen den Äquator des Uranus',
    groups: [{ t: 'Bahnneigung', u: '°', items: [
      { l: 'Miranda', v: 4.34, t: '4,34°', hl: true }, { l: 'Umbriel', v: 0.13, t: '0,13°' }, { l: 'Titania', v: 0.08, t: '0,08°' },
      { l: 'Oberon', v: 0.07, t: '0,07°' }, { l: 'Ariel', v: 0.04, t: '0,04°' },
    ] }],
    cap: 'Neigung der Bahnen gegen den Äquator des Uranus (NSSDCA). Mirandas Bahn ist über dreißigmal so stark geneigt wie die jedes anderen großen Mondes.',
    s: ['ura-nssdc-sat'],
  },
  'miranda.inverness': CORONAE('inverness'),
  'miranda.arden': CORONAE('arden'),
  'miranda.elsinore': CORONAE('elsinore'),
  'miranda.verona': {
    k: 'bars', alt: 'Fallbeschleunigung und Fallzeit aus 10 km Höhe: Erde und Miranda',
    groups: [
      { t: 'Fallbeschleunigung', u: 'm/s²', items: [{ l: 'Erde', v: 9.82, t: '9,82' }, { l: 'Miranda', v: 0.079, t: '0,079', hl: true }] },
      { t: 'Fall aus 10 km', u: 's', items: [{ l: 'Erde', v: 45, t: '45 s' }, { l: 'Miranda', v: 502, t: '502 s ≈ 8 min', hl: true }] },
    ],
    cap: 'Mirandas Schwerkraft ist über hundertmal schwächer als die der Erde (eigene Rechnung aus Masse und mittlerem Radius, ohne Luftwiderstand). Für 10 km bräuchte ein Stein über acht Minuten – daher die zehn Minuten von der höchsten Klippe.',
    s: ['ura-nssdc-sat', 'nasa-earth', 'smith-1986'],
  },
  'miranda.north': { ...NIGHT(uraNight, '24.01.1986', 'Miranda'), s: ['smith-1986', 'ura-nasa-3d', 'jpl-elements'] },

  // ---------- 02F Neptun & Monde ----------
  'neptune.gds': {
    k: 'scale', alt: 'Der Große Dunkle Fleck von 1989 maßstäblich neben der Erde',
    items: [
      { l: 'Großer Dunkler Fleck', a: 13000, b: 6600, t: '13.000 × 6.600 km', hl: true },
      { l: 'Erde', a: 12756, t: '12.756 km' },
    ],
    cap: 'Der Sturm von 1989 maßstäblich neben der Erde. 1994 fand das Weltraumteleskop Hubble ihn nicht mehr.',
    s: ['nep-pia00052', 'nasa-earth', 'hammel-1995'],
  },
  'neptune.winds': {
    k: 'bars', alt: 'Windgeschwindigkeit auf Neptun im Vergleich zur Erde und zum Hexagon auf Saturn',
    groups: [{ t: 'Wind', u: 'km/h', items: [
      { l: 'Neptun', v: 2000, t: 'über 2.000', hl: true }, { l: 'Erde, stärkste', v: 400, t: '≈ 400' }, { l: 'Saturn-Hexagon', v: 320, t: '≈ 320' },
    ] }],
    cap: 'Neptuns Winde sind fünfmal so schnell wie die stärksten der Erde – obwohl Neptun dreißigmal weiter von der Sonne entfernt ist als die Erde.',
    s: ['nep-nasa', 'nasa-saturn-facts', 'nep-fact'],
  },
  'neptune.atmo': {
    k: 'layers', from: '0 %', to: '100 %', alt: 'Zusammensetzung der Hülle des Neptun maßstäblich: Methan, Wasserstoff, Helium',
    items: [
      { l: 'Methan', d: 1.5, t: '1,5 %', hl: true },
      { l: 'Wasserstoff', d: 80, t: '80 %' },
      { l: 'Helium', d: 19, t: '19 %' },
    ],
    cap: 'Volumenanteile der Hülle maßstäblich. Das wenige Methan reicht, um rotes Licht zu schlucken – zurück bleibt das Blau.',
    s: ['nep-fact'],
  },
  'neptune.pole': {
    k: 'bars', alt: 'Neigung der Drehachse und des Magnetfelds: Neptun im Vergleich',
    groups: [
      { t: 'Drehachse gegen Bahn', u: '°', items: [
        { l: 'Erde', v: 23.44, t: '23,44°' }, { l: 'Neptun', v: 28.32, t: '28,32°', hl: true }, { l: 'Uranus', v: 97.77, t: '97,77°' },
      ] },
      { t: 'Magnetfeld gegen Achse', u: '°', items: [
        { l: 'Saturn', v: 0, t: '0,0°' }, { l: 'Jupiter', v: 9.4, t: '9,4°' }, { l: 'Neptun', v: 46.9, t: '46,9°', hl: true }, { l: 'Uranus', v: 58.6, t: '58,6°' },
      ] },
    ],
    cap: 'Neptuns Drehachse ist ähnlich geneigt wie die der Erde, sein Magnetfeld aber um fast 47° gegen die Drehachse gekippt – unter den Planeten mit Fact-Sheet-Wert übertrifft das nur Uranus.',
    s: ['nep-fact', 'ura-nssdc', 'nasa-earth', 'nasa-saturnfact', 'nasa-jupiter-fs'],
  },
  'neptune.voyager': {
    k: 'timeline', alt: 'Zeitleiste der Reise von Voyager 2 bis Neptun',
    items: [
      { d: '1977-08-20', t: '20.08.1977', l: 'Start' },
      { d: '1979-07-09', t: '09.07.1979', l: 'Jupiter' },
      { d: '1981-08-26', t: '26.08.1981', l: 'Saturn' },
      { d: '1986-01-24', t: '24.01.1986', l: 'Uranus' },
      { d: '1989-08-25', t: '25.08.1989', l: 'Neptun', l2: '4.800 km über Wolken', hl: true },
    ],
    cap: 'Zwölf Jahre vom Start bis Neptun, mit Schwung an Jupiter, Saturn und Uranus. Voyager 2 ist bis heute die einzige Sonde, die Uranus und Neptun besucht hat.',
    s: ['nep-voyager2'],
  },
  'neptune.rings': {
    k: 'rings', min: 35000, max: 65000, step: 10000, u: 'Tsd. km', r: 24764, l: 'Neptun', alt: 'Die fünf Ringe des Neptun radial maßstäblich',
    bands: [
      { a: 40900, b: 42900, l: 'Galle', o: 0.3 },
      { a: 53150, b: 53250, l: 'Le Verrier' },
      { a: 53200, b: 57200, l: 'Lassell', o: 0.2 },
      { a: 57150, b: 57250, l: 'Arago' },
      { a: 62900, b: 62966, l: 'Adams', hl: true },
    ],
    cap: 'Abstand vom Neptunmittelpunkt maßstäblich (Ausschnitt ab 35.000 km). Galle und Lassell sind breite, fast durchsichtige Bänder; Le Verrier, Arago und Adams sind schmal.',
    s: ['nep-ring'],
  },
  'neptune.arcs': {
    k: 'bars', alt: 'Optische Tiefe der Bögen im Adams-Ring im Vergleich zu den Ringen',
    groups: [{ t: 'Optische Tiefe', u: 'bis', items: [
      { l: 'Bögen', v: 0.12, t: '0,12', hl: true }, { l: 'Adams-Ring', v: 0.1, t: '0,01–0,1' },
      { l: 'Le Verrier', v: 0.01, t: '≈ 0,01' }, { l: 'Galle', v: 0.0001, t: '≈ 0,0001' },
    ] }],
    cap: 'Optische Tiefe: wie viel Licht ein Ring schluckt (klein = durchsichtig). In den fünf Bögen ist der Adams-Ring bis zu zwölfmal dichter als im Rest.',
    s: ['nep-ring'],
  },
  'neptune.proteus': {
    k: 'scale', alt: 'Proteus maßstäblich neben Mimas und Nereid',
    items: [
      { l: 'Proteus', a: 440, b: 404, t: '440 × 404 km', hl: true },
      { l: 'Mimas', a: 416, b: 382, t: '416 × 382 km' },
      { l: 'Nereid', a: 340, t: '340 km' },
    ],
    cap: 'Proteus maßstäblich neben Saturns Mond Mimas und Nereid (Halbachsen aus den Fact Sheets). Er ist etwas größer als Mimas, aber deutlich unregelmäßiger geformt.',
    s: ['nssdc-nepsat', 'nssdc-satsat'],
  },
  'neptune.nereid': {
    k: 'range', min: 0, max: 10, step: 2, u: 'Mio. km', alt: 'Abstand von Nereid zu Neptun zwischen 1,4 und 9,7 Millionen km, Triton zum Vergleich',
    span: [1.373, 9.654], spanL: 'Bahn von Nereid',
    marks: [{ v: 0.355, t: '0,35', l: 'Triton' }, { v: 1.373, t: '1,37', l: 'nächster Punkt' }, { v: 9.654, t: '9,65', l: 'fernster Punkt' }],
    cap: 'Abstand von Neptun maßstäblich. Nereids Bahn ist so gestreckt (Exzentrizität 0,75), dass sie Neptun bis auf 1,4 Mio. km nahekommt und sich bis 9,7 Mio. km entfernt (eigene Rechnung aus Halbachse und Exzentrizität).',
    s: ['nssdc-nepsat'],
  },

  // ---------- 02F1 Triton ----------
  'triton.neptune': SKY('triton'),
  'triton.orbit': {
    k: 'range', min: 0, max: 180, step: 30, u: '°', alt: 'Bahnneigung von Nereid, Triton und Phoebe: über 90 Grad läuft ein Mond rückwärts',
    span: [90, 180], spanL: 'rückläufig',
    marks: [{ v: 7.23, t: '7°', l: 'Nereid' }, { v: 157.35, t: '157°', l: 'Triton' }, { v: 174.8, t: '175°', l: 'Phoebe (Saturn)' }],
    cap: 'Bahnneigung gegen den Äquator des Planeten: über 90° heißt rückwärts. Unter den großen Monden läuft nur Triton so, sonst nur kleine Monde wie Phoebe am Saturn.',
    s: ['nssdc-nepsat', 'nssdc-satsat', 'tryka-1993'],
  },
  'triton.geysers': {
    k: 'peaks', alt: 'Höhe der Geysir-Säulen auf Triton im Vergleich zum Mount Everest',
    items: [
      { l: 'Geysir-Säule', h: 8, t: '≈ 8 km', sub: 'Triton', hl: true },
      { l: 'Mount Everest', h: 8.848, t: '8,8 km', sub: 'Erde' },
    ],
    cap: 'Höhen maßstäblich, Breiten schematisch. In rund 8 km knickt die dunkle Säule ab, der Wind treibt die Wolke über 100 km weit. Schon weniger als 4 Grad über den 38 K der Umgebung genügen als Antrieb.',
    s: ['tri-soderblom-1990', 'usgs-hawaii'],
  },
  'triton.streaks': {
    k: 'bars', alt: 'Länge der dunklen Fahnen auf Triton im Vergleich zu den Wolken der Geysire',
    groups: [{ t: 'Länge', u: 'km', items: [
      { l: 'Längste Fahnen', v: 160, t: 'über 160', hl: true }, { l: 'Geysir-Wolken', v: 100, t: 'über 100' },
      { l: 'Geysir-Säule', v: 8, t: '≈ 8 (Höhe)' },
    ] }],
    cap: 'Rund 50 dunkle Fahnen liegen auf der Südpolkappe, die längsten über 160 km – weiter, als die Wolken eines einzelnen Ausbruchs treiben.',
    s: ['tri-pia00059', 'tri-soderblom-1990'],
  },
  'triton.cap': {
    k: 'range', min: 0, max: 80, step: 10, u: 'K', alt: 'Temperatur von Triton im Vergleich zu Pluto und Neptun in Kelvin',
    span: [24, 38], spanL: 'Pluto (Boden)',
    marks: [{ v: 38, t: '38 K', l: 'Triton (−235 °C)' }, { v: 72, t: '72 K', l: 'Neptun (1 bar)', ref: true }],
    cap: 'Temperaturen in Kelvin (0 K = absoluter Nullpunkt). Tritons Oberfläche ist so kalt wie die wärmsten Stellen Plutos und über 30 Grad kälter als Neptuns Wolken.',
    s: ['tryka-1993', 'nssdc-pluto', 'nep-fact'],
  },
  'triton.cantaloupe': {
    k: 'bars', alt: 'Auflösung der globalen Karten von Titan, Triton, Pluto und Enceladus',
    groups: [{ t: 'Auflösung', u: 'm je Bildpunkt', items: [
      { l: 'Titan', v: 4000, t: '4.000' }, { l: 'Triton', v: 600, t: '600', hl: true },
      { l: 'Pluto', v: 300, t: '300' }, { l: 'Enceladus', v: 100, t: '100' },
    ] }],
    cap: 'Bildpunkt der globalen Karten, die Kosmos zeigt (kleiner = schärfer). Tritons Karte stammt allein vom Vorbeiflug von Voyager 2 im Jahr 1989 – das Cantaloupe-Terrain kennt man nur aus diesem einen Streifen.',
    s: ['tri-pia18668', 'usgs-titan-map', 'usgs-pluto', 'usgs-enceladus-map'],
  },
  'triton.north': { ...NIGHT(triNight, '25.08.1989', 'Triton'), s: ['tryka-1993', 'nep-jpl-sats', 'jpl-elements'] },
  'triton.season': {
    k: 'curve', x0: 1600, x1: 2400, xstep: 200, y0: -60, y1: 60, ystep: 30, alt: 'Breite der Sonne im Zenit auf Triton von 1600 bis 2400',
    pts: sample(SUN.triton, 1600, 2400, 200),
    marks: [mark(SUN.triton, V2_NEPTUNE, 'Voyager 2', undefined, true)],
    cap: `Breite, über der die Sonne im Zenit steht (eigene Rechnung aus Tritons mittlerer Bahn und Neptuns Bahn, JPL). Weil sich Tritons Bahnebene in Jahrhunderten dreht, schwingt der Sonnenstand unregelmäßig bis rund 50° nach Süden und Norden; heute steht sie über ${ns(SUN.triton(NOW))}.`,
    s: ['tryka-1993', 'nep-jpl-sats', 'jpl-elements'],
  },

  // ---------- 02H Pluto ----------
  'pluto.heart': {
    k: 'scale', alt: 'Pluto mit der Eisfläche Sputnik Planitia maßstäblich neben dem Mond der Erde',
    items: [
      { l: 'Mond', a: 3474.8, t: '3.475 km' },
      { l: 'Pluto', a: 2376, c: 1000, cl: 'Herz ≈ 1.000 km', t: '2.376 km', hl: true },
    ],
    cap: 'Pluto maßstäblich neben dem Mond der Erde, darauf die Eisfläche Sputnik Planitia: rund 1.000 km breit, der größte bekannte Gletscher im Sonnensystem.',
    s: ['nasa-newhorizons', 'nssdc-pluto', 'nasa-moon'],
  },
  'pluto.cthulhu': {
    k: 'bars', alt: 'Länge von Cthulhu im Vergleich zu Plutos Äquator und Sputnik Planitia',
    groups: [{ t: 'Länge', u: 'km', items: [
      { l: 'Plutos Äquator', v: 7464, t: '7.464' }, { l: 'Cthulhu', v: 3000, t: '≈ 3.000', hl: true },
      { l: 'Sputnik Planitia', v: 1000, t: '≈ 1.000' },
    ] }],
    cap: 'Cthulhu ist rund 3.000 km lang und 750 km breit und spannt damit zwei Fünftel des Äquators (Umfang eigene Rechnung aus dem Radius).',
    s: ['stern-2015', 'nssdc-pluto', 'nasa-newhorizons'],
  },
  'pluto.pole': {
    k: 'curve', x0: 1800, x1: 2100, xstep: 100, y0: -90, y1: 90, ystep: 45, alt: 'Breite der Sonne im Zenit auf Pluto von 1800 bis 2100',
    pts: sample(SUN.pluto, 1800, 2100, 150),
    marks: [mark(SUN.pluto, 1930.13, 'Entdeckung'), mark(SUN.pluto, 2015.53, 'New Horizons', undefined, true)],
    cap: `Breite, über der die Sonne im Zenit steht (eigene Rechnung aus der Bahn und dem IAU-Pol). Bei 119,5° Achsneigung wandert sie im 248-jährigen Plutojahr bis rund 60° Nord und Süd; um ${Math.round(zero(SUN.pluto, 1975, 2000))} stand sie über dem Äquator, heute über ${ns(SUN.pluto(NOW))}.`,
    s: ['nssdc-pluto', 'nasa-newhorizons'],
  },
  'pluto.haze': {
    k: 'bars', alt: 'Zusammensetzung und Bodendruck der Atmosphäre von Pluto, Erde zum Vergleich',
    groups: [
      { t: 'Zusammensetzung', u: '%', items: [
        { l: 'Stickstoff', v: 99, t: '99', hl: true }, { l: 'Methan', v: 0.5, t: '0,5' }, { l: 'Kohlenmonoxid', v: 0.05, t: '0,05' },
      ] },
      { t: 'Druck am Boden', u: 'Mikrobar', items: [{ l: 'Pluto', v: 13, t: '≈ 13', hl: true }, { l: 'Erde', v: 1014000, t: '1.014.000' }] },
    ],
    cap: 'Plutos Lufthülle besteht fast nur aus Stickstoff. Am Boden herrscht rund ein Achtzigtausendstel des Luftdrucks der Erde – im Bild nur ein Strich (eigene Rechnung).',
    s: ['nssdc-pluto', 'nasa-earth'],
  },
  'pluto.charon': {
    k: 'bars', alt: 'Durchmesser des größten Mondes im Verhältnis zu seinem Planeten',
    groups: [{ t: 'Mond geteilt durch Körper', u: '%', items: [
      { l: 'Charon/Pluto', v: 51, t: '51 %', hl: true }, { l: 'Mond/Erde', v: 27.3, t: '27 %' },
      { l: 'Triton/Neptun', v: 5.5, t: '5,5 %' }, { l: 'Titan/Saturn', v: 4.4, t: '4,4 %' }, { l: 'Ganymed/Jupiter', v: 3.8, t: '3,8 %' },
    ] }],
    cap: 'Durchmesser des größten Mondes im Verhältnis zu seinem Körper (eigene Rechnung aus den mittleren Radien der Fact Sheets). Charon ist halb so groß wie Pluto, der Mond der Erde schafft ein gutes Viertel.',
    s: ['nssdc-pluto', 'nasa-moon', 'nasa-earth', 'nssdc-nepsat', 'nep-fact', 'nssdc-satsat', 'nasa-saturnfact', 'nssdc-jovsat', 'nasa-jupiter-fs'],
  },
  'pluto.bary': {
    k: 'range', min: 0, max: 20000, step: 5000, u: 'km von Plutos Mitte', alt: 'Lage des gemeinsamen Schwerpunkts von Pluto und Charon außerhalb Plutos',
    span: [0, 1188], spanL: 'Pluto',
    marks: [{ v: 2126, t: '2.126 km', l: 'Schwerpunkt' }, { v: 19596, t: '19.596 km', l: 'Charon' }],
    cap: 'Abstand von Plutos Mitte maßstäblich: Der gemeinsame Schwerpunkt liegt 2.126 km von der Mitte, gut 900 km über Plutos Oberfläche (eigene Rechnung aus Massen und Abstand). Bei Erde und Mond liegt er in der Erde.',
    s: ['nssdc-pluto', 'nasa-moon', 'nasa-earth'],
  },
  'pluto.moons': {
    k: 'bars', alt: 'Umlaufzeiten von Charon und den vier kleinen Monden Plutos',
    groups: [{ t: 'Umlaufzeit', u: 'Tage', items: [
      { l: 'Charon', v: 6.387, t: '6,39 d', hl: true }, { l: 'Styx', v: 20.16, t: '20,2 d · 3,2×' }, { l: 'Nix', v: 24.85, t: '24,9 d · 3,9×' },
      { l: 'Kerberos', v: 32.17, t: '32,2 d · 5,0×' }, { l: 'Hydra', v: 38.2, t: '38,2 d · 6,0×' },
    ] }],
    cap: 'Umlaufzeiten um den Schwerpunkt, dahinter das Vielfache der Charon-Periode (eigene Rechnung). Die vier kleinen Monde laufen nahe den Verhältnissen 3 : 4 : 5 : 6.',
    s: ['nssdc-pluto'],
  },
  'pluto.nh': {
    k: 'timeline', alt: 'Zeitleiste der Reise von New Horizons bis Pluto und Arrokoth',
    items: [
      { d: '2006-01-19', t: '19.01.2006', l: 'Start' },
      { d: '2007-02-28', t: '28.02.2007', l: 'Jupiter', l2: 'gibt Schwung' },
      { d: '2015-07-14', t: '14.07.2015', l: 'Pluto', l2: '11:49 UT', hl: true },
      { d: '2019-01-01', t: '01.01.2019', l: 'Arrokoth' },
    ],
    cap: 'Neuneinhalb Jahre vom Start bis Pluto, unterwegs Schwung am Jupiter; dreieinhalb Jahre später flog New Horizons an Arrokoth vorbei.',
    s: ['nasa-newhorizons'],
  },
};
