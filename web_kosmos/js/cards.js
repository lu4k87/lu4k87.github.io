// Info-Karte am Abzeichen (Vorschau 26.10.2026: Lage:A, Aufbau:A): große Grafik mit dauerhafter, ruhiger Bewegung
// (Glow-Atmen, Lichtschleier, Bahnpunkte im Takt der echten Umlaufzeiten), drei Kennzahl-Kacheln mit Fußnote je Quelle,
// Regler der zugehörigen Ebene, Erklärtext aus content.js unter „Mehr dazu“. Abzeichen ohne Eintrag in CARDS zeigen
// Text + Fußnote. Über jeder Grafik der Schalter „Bewegung“ (Vorschau 26.10.2026 Schalt:A), gilt für alle Karten.
// Grafiken sind Schemata mit echten Zahlen; Modelle stehen in der Bildunterschrift. Beim Import keine
// DOM-Globals (Test tests/cards.test.js) – Ebenen, Format und Bewegung reicht hud.js als env herein.

import { SOURCES } from './content.js';
import { PLANETS, planetPosition, moonPosition, julianDate, mulberry32 } from './astro.js';
import { FIGS, figSvg, esc, nbsp, prose, de, f1 } from './figs.js';

const RAD = Math.PI / 180;
// Punkt auf dem Kreis, Winkel in Grad mathematisch (0 = rechts, gegen den Uhrzeiger), SVG-y zeigt nach unten
const pt = (cx, cy, r, a) => [cx + r * Math.cos(a * RAD), cy - r * Math.sin(a * RAD)];
const arc = (cx, cy, r, a0, a1) => {
  const [x0, y0] = pt(cx, cy, r, a0), [x1, y1] = pt(cx, cy, r, a1);
  return `M${f1(x0)} ${f1(y0)}A${f1(r)} ${f1(r)} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 0 : 1} ${f1(x1)} ${f1(y1)}`;
};
// Zeitpunkt wie die Stationen: ?date=… (Screenshots), sonst jetzt
export function now() {
  const q = typeof location !== 'undefined' && new URLSearchParams(location.search).get('date');
  const d = q ? new Date(q) : new Date();
  return Number.isNaN(+d) ? new Date() : d;
}
const GLOW = '<defs><filter id="hc-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>'
  + '<filter id="hc-glow-wide" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7"/></filter></defs>';
const svgOpen = (w, h, label, cls = '') => `<svg class="hc-svg ${cls}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${GLOW}`;
const lines = (x, y, rows, anchor = 'start', cls = '') => `<text x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}"${cls ? ` class="${cls}"` : ''}>${rows
  .map((t, i) => `<tspan x="${f1(x)}" dy="${i ? 12.5 : 0}">${esc(t)}</tspan>`).join('')}</text>`;

// Umlaufzeit nach Kepler in s; Erde: GM und mittlerer Radius aus dem NASA Earth Fact Sheet
const GM_E = 398600.4418, R_E = 6371, GM_S = 37931207;   // km³/s² (GM Saturn: NASA Planetary Fact Sheet)
export const period = (h, gm = GM_E, r0 = R_E) => 2 * Math.PI * Math.sqrt((r0 + h) ** 3 / gm);

// ---------- Polarlicht der Erde: Oval von oben, Grenze je Kp ----------
// Äquatorgrenze des Ovals um Mitternacht je Kp in geomagnetischer Breite (NOAA SWPC, „Tips on Viewing the Aurora“)
export const KP_LAT = [66.5, 64.5, 62.4, 60.4, 58.3, 56.3, 54.2, 52.2, 50.1, 48.1];
const MAG_POLE = [80.8, -72.8];   // geomagnetischer Nordpol 2025, IGRF-14 (WDC Kyoto)
const DE_GEO = [51, 10];          // Mitte Deutschlands
export const magLat = ([la, lo]) => Math.asin(Math.sin(la * RAD) * Math.sin(MAG_POLE[0] * RAD)
  + Math.cos(la * RAD) * Math.cos(MAG_POLE[0] * RAD) * Math.cos((lo - MAG_POLE[1]) * RAD)) / RAD;
const DE_MAG = magLat(DE_GEO);
const OV = { cx: 150, cy: 96, k: 2.15 };   // Pol, px je Grad Kobreite
const ovalScale = (kp) => (90 - KP_LAT[kp]) / (90 - KP_LAT[4]);
const localTime = (d, lon) => ((((d.getUTCHours() + d.getUTCMinutes() / 60 + lon / 15) % 24) + 24) % 24);
const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

function auroraSvg(kp = 4) {
  const { cx, cy, k } = OV;
  // Kp 4 als Grundform (Nachtgrenze, Taggrenze 0,45 × so weit vom Pol: Modell), andere Kp per Skalierung um den Pol
  const cn = (90 - KP_LAT[4]) * k, cd = cn * 0.45, rr = (cn + cd) / 2, oy = cy + (cn - cd) / 2;
  // Breitenkreise beschriftet oben rechts (dort ist das Oval am weitesten vom Rand, auch bei Kp 9)
  const ring = (lat, lbl) => { const [x, y] = pt(cx, cy, (90 - lat) * k, 58); return `<circle cx="${cx}" cy="${cy}" r="${f1((90 - lat) * k)}" class="hc-grid"/>${lbl ? `<text x="${f1(x + 3)}" y="${f1(y - 2)}">${lat}°</text>` : ''}`; };
  const band = (cls) => `<circle cx="${cx}" cy="${f1(oy)}" r="${f1(rr)}" class="${cls}" vector-effect="non-scaling-stroke"/>`;
  const lt = localTime(now(), DE_GEO[1]), [dx, dy] = pt(cx, cy, (90 - DE_MAG) * k, -90 + lt * 15);
  const tx = Math.min(256, Math.max(44, dx)), ty = dy > cy ? dy + 17 : dy - 9;   // Name unter bzw. über dem Punkt, nie am Rand
  return `${svgOpen(300, 208, `Polarlicht-Oval bei Kp ${kp} von oben, Deutschland um ${hhmm(lt)} Ortszeit`)}
    <circle cx="${cx}" cy="${cy}" r="${f1(42 * k)}" class="hc-cap-fill"/>
    ${ring(70)}${ring(60, true)}${ring(50, true)}
    <text x="${cx}" y="11" text-anchor="middle" class="hc-t">Mittag</text>
    <text x="${cx}" y="205" text-anchor="middle" class="hc-t">Mitternacht</text>
    <g class="hc-oval" style="transform-origin:${cx}px ${cy}px;transform:scale(${ovalScale(kp).toFixed(3)})">
      <circle cx="${cx}" cy="${f1(oy)}" r="${f1(rr)}" class="hc-au-halo hc-breathe" filter="url(#hc-glow-wide)"/>
      ${band('hc-au-band')}${band('hc-au-curtain hc-drift')}${band('hc-au-curtain hc-au-curtain--2 hc-drift-rev')}
    </g>
    <circle cx="${cx}" cy="${cy}" r="${f1((90 - DE_MAG) * k)}" class="hc-path"/>
    <circle cx="${f1(dx)}" cy="${f1(dy)}" r="3.4" class="hc-mark hc-ping"/><circle cx="${f1(dx)}" cy="${f1(dy)}" r="3.4" class="hc-mark"/>
    <text x="${f1(tx)}" y="${f1(ty)}" text-anchor="middle" class="hc-acc">Deutschland</text>
    <circle cx="${cx}" cy="${cy}" r="2" class="hc-pole"/><text x="${cx}" y="${cy - 6}" text-anchor="middle">Pol</text>
  </svg>`;
}
const auroraCap = (kp = 4) => `Kp ${kp}: Das Oval reicht nachts bis ${de(KP_LAT[kp], 1)}° geomagnetischer Breite. Deutschland liegt bei `
  + `${de(DE_MAG)}°, der Punkt zeigt es jetzt (${hhmm(localTime(now(), DE_GEO[1]))} Ortszeit). Grenze nach NOAA, Form des Ovals Modell.`;

// ---------- Atmosphäre: Dichte über der Höhe, Airglow ----------
function atmoSvg() {
  const x0 = 50, x1 = 288, y0 = 176, y1 = 18, X = (d) => x0 + d * (x1 - x0), Y = (h) => y0 - h / 120 * (y0 - y1);
  let d = '';
  for (let h = 0; h <= 120; h += 2) d += `${h ? 'L' : 'M'}${f1(X(Math.exp(-h / 8.5)))} ${f1(Y(h))}`;
  const ticks = [0, 30, 60, 90, 120].map((h) => `<line x1="${x0}" x2="${x1}" y1="${f1(Y(h))}" y2="${f1(Y(h))}" class="hc-grid"/><text x="${x0 - 6}" y="${f1(Y(h) + 4)}" text-anchor="end">${h}</text>`).join('');
  const ex = X(Math.exp(-1)), ey = Y(8.5);
  return `${svgOpen(300, 198, 'Luftdichte über der Höhe bis 120 km mit Airglow-Schicht')}
    <defs><linearGradient id="hc-sky" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#6fb4ff"/><stop offset=".22" stop-color="#2b5fc4"/><stop offset=".55" stop-color="#0b1a44"/><stop offset="1" stop-color="#02040c"/></linearGradient></defs>
    <rect x="8" y="${y1}" width="12" height="${y0 - y1}" rx="3" fill="url(#hc-sky)"/>
    ${ticks}<text x="${x0 - 6}" y="9" text-anchor="end">km</text>
    <rect x="${x0}" y="${f1(Y(100))}" width="${x1 - x0}" height="${f1(Y(90) - Y(100))}" class="hc-ag hc-breathe" filter="url(#hc-glow)"/>
    <line x1="${x0}" x2="${x1}" y1="${f1(Y(95))}" y2="${f1(Y(95))}" class="hc-ag-line hc-drift"/>
    <text x="${x1}" y="${f1(Y(100) - 6)}" text-anchor="end" class="hc-ag-t">Airglow 90–100 km</text>
    <path d="${d}" pathLength="1" class="hc-curve hc-draw"/>
    <circle cx="${f1(ex)}" cy="${f1(ey)}" r="3.2" class="hc-mark hc-ping"/><circle cx="${f1(ex)}" cy="${f1(ey)}" r="3.2" class="hc-mark"/>
    <text x="${f1(ex + 8)}" y="${f1(ey - 7)}" class="hc-acc">1/e ≈ 37 % bei 8,5 km</text>
    <text x="${x1}" y="${y0 + 18}" text-anchor="end">Luftdichte relativ zum Boden →</text>
  </svg>`;
}

// ---------- Erdnahe Bahnen: Höhen logarithmisch, Punkte im Takt der echten Umlaufzeit ----------
const ORBITS = [
  { id: 'iss', h: [420, 420], t: ['ISS', '420 km'], a: 150, n: 1, at: 'out' },
  { id: 'leo', h: [540, 570], t: ['Starlink', '540–570 km'], a: 30, n: 9, at: 'out' },
  { id: 'nav', h: [20000, 23000], t: ['Navigation', '20.000–23.000 km'], a: 122, n: 4, at: 'in' },
  { id: 'geo', h: [35786, 35786], t: ['GEO 35.786 km'], a: 90, n: 3, at: 'top' },
];
const ORBIT_SCALE = 15 * 60;   // 1 s Animation ≙ 15 min Bahn
function orbitsSvg(_v, c = {}) {
  const cx = 150, cy = 170, rOf = (h) => 36 + 110 * Math.log10(h / 100) / Math.log10(400);
  let g = '', lbl = '';
  for (const o of ORBITS) {
    const on = o.id === c.hl, r1 = rOf(o.h[0]), r2 = rOf(o.h[1]), r = (r1 + r2) / 2;
    const T = period((o.h[0] + o.h[1]) / 2) / ORBIT_SCALE;
    let dots = '';
    for (let i = 0; i < o.n; i++) {
      const a = 90 + i * 360 / o.n, [x, y] = pt(cx, cy, r, a);
      if (on) for (let j = 1; j <= 3; j++) { const [tx, ty] = pt(cx, cy, r, a - j * 4); dots += `<circle cx="${f1(tx)}" cy="${f1(ty)}" r="${(2.6 - j * 0.5).toFixed(1)}" class="hc-sat is-on" opacity="${(0.7 - j * 0.18).toFixed(2)}"/>`; }
      dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${on ? 3.2 : 1.9}" class="hc-sat${on ? ' is-on' : ''}"/>`;
    }
    g += `<circle cx="${cx}" cy="${cy}" r="${f1(r)}" class="hc-orbit${on ? ' is-on' : ''}" style="stroke-width:${f1(Math.max(1.2, r2 - r1))}"/>`
      + (on ? `<circle cx="${cx}" cy="${cy}" r="${f1(r)}" class="hc-orbit-glow hc-breathe" filter="url(#hc-glow)"/>` : '')
      + `<g class="hc-spin" style="transform-origin:${cx}px ${cy}px;--T:${T.toFixed(1)}s">${dots}</g>`;
    const cls = on ? 'hc-acc' : '';
    if (o.at === 'top') lbl += lines(cx, cy - r - 8, o.t, 'middle', cls);
    else if (o.at === 'in') { const [x, y] = pt(cx, cy, r1 - 10, o.a); lbl += lines(x, y, o.t, 'start', cls); }
    else { const [x, y] = pt(cx, cy, r2 + 7, o.a); lbl += lines(x, y, o.t, x < cx ? 'end' : 'start', cls); }
  }
  return `${svgOpen(300, 190, 'Bahnhöhen von ISS, Starlink, Navigations- und geostationären Satelliten, logarithmisch')}
    <defs><radialGradient id="hc-earth" cx=".5" cy=".25" r=".75"><stop offset="0" stop-color="#8cc8ff"/><stop offset=".55" stop-color="#2463b4"/><stop offset="1" stop-color="#0a2550"/></radialGradient>
      <clipPath id="hc-up"><rect width="300" height="${cy}"/></clipPath></defs>
    <g clip-path="url(#hc-up)">${g}
      <circle cx="${cx}" cy="${cy}" r="38" class="hc-atm hc-breathe-slow" filter="url(#hc-glow)"/>
      <circle cx="${cx}" cy="${cy}" r="36" fill="url(#hc-earth)"/></g>
    <line x1="4" x2="296" y1="${cy}" y2="${cy}" class="hc-grid"/>${lbl}
    <text x="${cx}" y="${cy + 16}" text-anchor="middle">Erde · Höhe logarithmisch</text>
  </svg>`;
}
const orbitsCap = () => `Die Punkte kreisen im Takt ihrer echten Umlaufzeit (1 s ≙ 15 min): ISS ${de(period(420) / 60)} min, `
  + `Navigation ${de(period(21500) / 3600, 1)} h, geostationär ${de(period(35786) / 3600, 1)} h – eigene Rechnung nach Kepler.`;

// ---------- Mondphase aus den Bahnen von Mond und Erde ----------
export function moonState(d = now()) {
  const jd = julianDate(d), m = moonPosition(jd), e = planetPosition(PLANETS.find((p) => p.id === 'earth'), jd);
  const el = ((((Math.atan2(m[1], m[0]) - Math.atan2(-e[1], -e[0])) / RAD) % 360) + 360) % 360;   // Elongation Mond–Sonne
  return { illum: (1 - Math.cos(el * RAD)) / 2, waxing: el < 180, age: el / 360 * 29.53 };
}
function moonSvg() {
  const s = moonState(), cx = 84, cy = 94, R = 72, rx = R * Math.abs(1 - 2 * s.illum);
  // beleuchtete Fläche: Rand auf der hellen Seite + Terminator als halbe Ellipse (zunehmend: rechts hell)
  const lit = `M${cx} ${cy - R}A${R} ${R} 0 0 ${s.waxing ? 1 : 0} ${cx} ${cy + R}A${f1(rx)} ${R} 0 0 ${(s.illum > 0.5) === s.waxing ? 1 : 0} ${cx} ${cy - R}Z`;
  const ccx = 236, ccy = 62, cr = 30, frac = s.age / 29.53, [mx, my] = pt(ccx, ccy, cr, 90 - frac * 360);
  const p = Math.round(s.illum * 100);
  return `${svgOpen(300, 196, `Mondphase: ${p} % beleuchtet, ${s.waxing ? 'zunehmend' : 'abnehmend'}`)}
    <defs><radialGradient id="hc-moon" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#f3f0e8"/><stop offset=".7" stop-color="#cbc6ba"/><stop offset="1" stop-color="#8f8a80"/></radialGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="${R + 3}" class="hc-moon-halo hc-breathe" filter="url(#hc-glow-wide)"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" class="hc-moon-dark"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" class="hc-earthshine hc-breathe-slow"/>
    <path d="${lit}" fill="url(#hc-moon)"/>
    <circle cx="${ccx}" cy="${ccy}" r="${cr}" class="hc-grid"/>
    ${frac > 0.003 ? `<path d="${arc(ccx, ccy, cr, 90, 90 - frac * 360)}" pathLength="1" class="hc-cycle hc-draw"/>` : ''}
    <circle cx="${f1(mx)}" cy="${f1(my)}" r="3.6" class="hc-mark hc-ping"/><circle cx="${f1(mx)}" cy="${f1(my)}" r="3.6" class="hc-mark"/>
    <text x="${ccx}" y="${ccy - cr - 7}" text-anchor="middle">Neumond</text>
    <text x="${ccx}" y="${ccy + cr + 15}" text-anchor="middle">Vollmond</text>
    <text x="${ccx}" y="140" text-anchor="middle" class="hc-big">${p} %</text>
    ${lines(ccx, 158, ['beleuchtet,', s.waxing ? 'zunehmend' : 'abnehmend'], 'middle')}
    <text x="${ccx}" y="189" text-anchor="middle">Tag ${de(s.age)} von 29,5</text>
  </svg>`;
}
const moonCap = () => {
  const s = moonState(), d = now().toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  return `Mondphase am ${d}: ${Math.round(s.illum * 100)} % der sichtbaren Seite beleuchtet, ${s.waxing ? 'zunehmend' : 'abnehmend'} (eigene Rechnung aus den Bahnen). `
    + 'Von Neumond zu Neumond vergehen 29,5 Tage – länger als ein Umlauf (27,3 Tage), weil die Erde mit dem Mond um die Sonne weiterzieht.';
};

// ---------- Sonne: Randverdunkelung ----------
export const limb = (r) => (2 + 3 * Math.sqrt(Math.max(0, 1 - r * r))) / 5;   // Eddington-Näherung, r = Abstand von der Mitte / Radius
function sunColor(I) {
  const t = Math.min(1, Math.max(0, (I - 0.4) / 0.6)), A = [138, 58, 8], B = [255, 169, 64], C = [255, 247, 224];
  const [p, q, u] = t < 0.5 ? [A, B, t * 2] : [B, C, (t - 0.5) * 2];
  return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * u)).join(',')})`;
}
function sunSvg() {
  const cx = 78, cy = 94, R = 66, px0 = 178, px1 = 292, py = (I) => 150 - (I - 0.3) / 0.7 * 120;
  const stops = [0, 0.3, 0.5, 0.7, 0.8, 0.88, 0.94, 0.98, 1].map((r) => `<stop offset="${r}" stop-color="${sunColor(limb(r))}"/>`).join('');
  let d = '';
  for (let i = 0; i <= 50; i++) d += `${i ? 'L' : 'M'}${f1(px0 + i / 50 * (px1 - px0))} ${f1(py(limb(i / 50)))}`;
  return `${svgOpen(300, 184, 'Randverdunkelung der Sonne: Helligkeit von der Mitte zum Rand', 'hc-sun')}
    <defs><radialGradient id="hc-sun">${stops}</radialGradient><clipPath id="hc-disk"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath></defs>
    <circle cx="${cx}" cy="${cy}" r="${R + 6}" class="hc-corona hc-breathe" filter="url(#hc-glow-wide)"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#hc-sun)"/>
    <g clip-path="url(#hc-disk)"><line x1="${cx}" x2="${cx}" y1="${cy - R}" y2="${cy + R}" class="hc-scanline hc-scan"/></g>
    <line x1="${px0}" x2="${px1}" y1="${f1(py(1))}" y2="${f1(py(1))}" class="hc-grid"/><line x1="${px0}" x2="${px1}" y1="${f1(py(0.4))}" y2="${f1(py(0.4))}" class="hc-grid"/>
    <line x1="${px0}" x2="${px1}" y1="150" y2="150" class="hc-grid"/>
    <text x="${px0}" y="${f1(py(1) - 8)}">Helligkeit 100 %</text>
    <text x="${px1}" y="${f1(py(0.4) + 15)}" text-anchor="end">40 %</text>
    <text x="${px0}" y="166">Mitte</text><text x="${px1}" y="166" text-anchor="end">Rand</text>
    <path d="${d}" pathLength="1" class="hc-curve hc-draw"/>
    <circle cx="${px0}" cy="${f1(py(1))}" r="4" class="hc-mark hc-dot"/>
  </svg>`;
}
const sunCap = () => 'Randverdunkelung: Zum Rand hin blicken wir schräg in höhere, kühlere Schichten der Photosphäre – die Scheibe wird dort '
  + 'bis auf rund 40 % dunkler. Die Linie tastet die Scheibe ab, der Punkt zeigt die Helligkeit an dieser Stelle.';

// ---------- Jupiter: Polarlicht im Ultravioletten (Schema) ----------
function jupiterSvg() {
  const cx = 150, cy = 100, R = 94, ox = 158, oy = 94;
  let d = '';
  for (let i = 0; i < 72; i++) {   // Hauptoval: nicht kreisrund, gegen den Drehpol versetzt (Schema)
    const a = i * 5 * RAD, r = 50 + 7 * Math.sin(2 * a + 0.6) + 5 * Math.cos(a - 0.4);
    d += `${i ? 'L' : 'M'}${f1(ox + r * Math.cos(a))} ${f1(oy - r * 0.86 * Math.sin(a))}`;
  }
  d += 'Z';
  let io = '';
  for (let j = 6; j >= 0; j--) { const [x, y] = pt(ox, oy, 70, 215 - j * 3.2); io += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${(3.6 - j * 0.42).toFixed(2)}" class="hc-io" opacity="${(1 - j * 0.13).toFixed(2)}"/>`; }
  return `${svgOpen(300, 200, 'Polarlicht am Nordpol des Jupiter im Ultravioletten, Schema')}
    <defs><radialGradient id="hc-jup"><stop offset="0" stop-color="#5d6a7c"/><stop offset=".55" stop-color="#7c6c58"/><stop offset=".86" stop-color="#5a4636"/><stop offset="1" stop-color="#2a1f18"/></radialGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#hc-jup)"/>
    ${[30, 54, 78].map((r) => `<circle cx="${cx}" cy="${cy}" r="${r}" class="hc-jband"/>`).join('')}
    <circle cx="${ox}" cy="${oy}" r="70" class="hc-path"/>
    <g class="hc-spin" style="transform-origin:${ox}px ${oy}px;--T:26s">${io}</g>
    <ellipse cx="152" cy="92" rx="16" ry="10" class="hc-ju-blob hc-breathe" filter="url(#hc-glow)"/>
    <ellipse cx="172" cy="106" rx="10" ry="7" class="hc-ju-blob hc-breathe-slow" filter="url(#hc-glow)"/>
    <ellipse cx="138" cy="106" rx="8" ry="6" class="hc-ju-blob hc-breathe" style="animation-delay:-1.7s" filter="url(#hc-glow)"/>
    <path d="${d}" class="hc-ju-halo hc-breathe" filter="url(#hc-glow-wide)"/>
    <path d="${d}" class="hc-ju-band"/>
    <path d="${d}" class="hc-ju-curtain hc-drift"/>
    <text x="6" y="12" class="hc-t">UV · Falschfarbe</text>
    <text x="214" y="38" class="hc-ju-t">Hauptoval</text>
    ${lines(96, 166, ['Fußpunkt', 'von Io'], 'end')}
  </svg>`;
}
const jupiterCap = () => 'Polarlicht am Nordpol im Ultravioletten (Hubble, Falschfarbe, Schema): Es leuchtet ununterbrochen, ist größer als die Erde '
  + 'und hunderte Male energiereicher als irdisches. Gespeist wird es nicht nur vom Sonnenwind, sondern auch von Teilchen des Vulkanmonds Io – '
  + 'sein Fußpunkt leuchtet als eigener Fleck mit Schweif.';

// ---------- Saturn: Ringe im Schnitt, Teilchen im Kepler-Takt ----------
const RINGS = [   // Abstand vom Saturnmittelpunkt in km (NASA Saturnian Rings Fact Sheet), Deckkraft nach optischer Dicke (Richtwert)
  { id: 'C', r: [74658, 92000], o: 0.32 }, { id: 'B', r: [92000, 117580], o: 0.92 }, { id: 'Cassini', r: [117580, 122170], o: 0.1 },
  { id: 'A', r: [122170, 136775], o: 0.66 }, { id: 'F', r: [140100, 140300], o: 0.55 },
];
const RING_SCALE = 40 * 60;   // 1 s Animation ≙ 40 min
const ringT = (id) => { const g = RINGS.find((x) => x.id === id); return period(0, GM_S, (g.r[0] + g.r[1]) / 2); };
function ringsSvg() {
  const kx = 0.00335, cxp = 20 - 58000 * kx, cy = 88, X = (r) => cxp + r * kx, A0 = 16, rand = mulberry32(7);
  let s = '';
  for (const g of RINGS) {
    const rm = (g.r[0] + g.r[1]) / 2 * kx;
    s += `<path d="${arc(cxp, cy, rm, -A0, A0)}" class="hc-ring" style="stroke-width:${f1(Math.max(1.4, (g.r[1] - g.r[0]) * kx))};opacity:${g.o}"/>`;
    if (g.id === 'Cassini') continue;
    let dots = '';
    for (let a = 0; a < 360; a += 4) {
      const [x, y] = pt(cxp, cy, (g.r[0] + rand() * (g.r[1] - g.r[0])) * kx, a + rand() * 3);
      dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${(0.6 + rand() * 0.9).toFixed(2)}"/>`;
    }
    s += `<g class="hc-spin hc-grains" style="transform-origin:${f1(cxp)}px ${cy}px;--T:${(ringT(g.id) / RING_SCALE).toFixed(1)}s">${dots}</g>`;
  }
  const lbl = [['C', 83329], ['B', 104790], ['A', 129472]].map(([t, r]) => `<text x="${f1(X(r))}" y="188" text-anchor="middle">${t}</text>`).join('')
    + `<line x1="${f1(X(119875))}" x2="${f1(X(119875))}" y1="176" y2="194" class="hc-path"/><text x="${f1(X(119875))}" y="205" text-anchor="middle">Cassini-Teilung</text>`;
  return `${svgOpen(300, 210, 'Saturnringe im Schnitt, Abstände maßstäblich')}
    <defs><linearGradient id="hc-satg" x1="0" x2="1"><stop offset="0" stop-color="#d9c49a"/><stop offset="1" stop-color="#9c8458"/></linearGradient>
      <clipPath id="hc-cut"><rect width="300" height="174"/></clipPath></defs>
    <g clip-path="url(#hc-cut)"><circle cx="${f1(cxp)}" cy="${cy}" r="${f1(60268 * kx)}" fill="url(#hc-satg)" class="hc-planet"/>${s}</g>
    <line x1="0" x2="300" y1="174" y2="174" class="hc-grid"/>${lbl}<text x="${f1(X(140180))}" y="188" text-anchor="end">F</text>
    <text x="4" y="12" class="hc-t">Saturn</text>
  </svg>`;
}
const ringsCap = () => `Ringe von oben im Schnitt, Abstände vom Saturnmittelpunkt maßstäblich (links der Planetenrand). Innen kreisen die Teilchen `
  + `schneller: ${de(ringT('C') / 3600, 1)} h am C-Ring, ${de(ringT('A') / 3600, 1)} h am A-Ring (Kepler, eigene Rechnung; hier 1 s ≙ 40 min). `
  + 'Deckkraft nach optischer Dicke.';

// Grafik je Art: svg(Wert der Ebene, Karte), cap = Bildunterschrift, s = Quelle (oder m = Modell als Fußnote), update = Ebene geändert
export const GRAPHS = {
  aurora: { svg: auroraSvg, cap: auroraCap, s: 'noaa-aurora', update: (el, kp) => { const g = el.querySelector('.hc-oval'); if (g) g.style.transform = `scale(${ovalScale(kp).toFixed(3)})`; } },
  atmo: { svg: atmoSvg, cap: () => 'Luftdichte über der Höhe: Alle 8,5 km sinkt sie auf gut ein Drittel (Faktor 1/e). Darüber, in 90–100 km, leuchtet nachts schwach grünes Airglow (Sauerstoff, 558 nm).', s: 'nasa-earth' },
  orbits: { svg: orbitsSvg, cap: orbitsCap, s: 'nasa-earth' },
  moon: { svg: moonSvg, cap: moonCap, s: 'nasa-moon' },
  sun: { svg: sunSvg, cap: sunCap, m: 'Modell: Eddington-Näherung I(μ) = (2 + 3μ) / 5' },
  jupiter: { svg: jupiterSvg, cap: jupiterCap, s: 'heic1613' },
  rings: { svg: ringsSvg, cap: ringsCap, s: 'nasa-saturn' },
};

// Karte je Abzeichen `${station}.${hotspot}`: g = Grafik, c = Ebene der Station (Regler/Schalter), hl = hervorgehobene Bahn,
// f = drei Kennzahlen { v, u, l, s } – jede Zahl mit Quelle in SOURCES (Test)
const MOON_F = [
  { v: '1.737', u: 'km', l: 'Radius', s: 'nasa-moon' },
  { v: '27,3', u: 'Tage', l: 'Umlauf = Drehung', s: 'nasa-moon' },
  { v: '384.400', u: 'km', l: 'mittlerer Abstand', s: 'nasa-moon' },
];
export const CARDS = {
  'earth.atmo': { g: 'atmo', c: 'atmo', f: [
    { v: '8,5', u: 'km', l: 'Skalenhöhe: Dichte sinkt um Faktor e', s: 'nasa-earth' },
    { v: '1.014', u: 'hPa', l: 'Luftdruck am Boden', s: 'nasa-earth' },
    { v: '78', u: '%', l: 'Stickstoff (N₂) in trockener Luft', s: 'nasa-earth' }] },
  'earth.aurora': { g: 'aurora', c: 'kp', f: [
    { v: '100–300', u: 'km', l: 'Höhe des Leuchtens', s: 'nasa-aurora' },
    { v: '557,7', u: 'nm', l: 'Grün: Sauerstoff', s: 'nasa-aurora' },
    { v: '80,8', u: '° N', l: 'geo­magnetischer Pol (IGRF-14)', s: 'wdc-poles' }] },
  'earth.sats': { g: 'orbits', hl: 'leo', c: 'sats', f: [
    { v: '16.800', u: '', l: 'aktive Satelliten (Okt. 2026)', s: 'celestrak' },
    { v: '540–570', u: 'km', l: 'Bahnhöhe Starlink', s: 'celestrak' },
    { v: '19.470', u: '', l: 'Objekte im Bild mit Trümmern', s: 'celestrak' }] },
  'iss.below': { g: 'orbits', hl: 'iss', c: 'orbit', f: [
    { v: '420', u: 'km', l: 'Bahnhöhe', s: 'celestrak' },
    { v: '93', u: 'min', l: 'ein Umlauf', s: 'celestrak' },
    { v: '7,66', u: 'km/s', l: 'Bahn­geschwindigkeit', s: 'celestrak' }] },
  'earth.geo': { g: 'orbits', hl: 'geo', f: [
    { v: '35.786', u: 'km', l: 'Höhe über dem Äquator', s: 'nasa-earth' },
    { v: '23,9', u: 'h', l: 'Umlauf = Sterntag (23 h 56 min)', s: 'nasa-earth' },
    { v: '3,07', u: 'km/s', l: 'Bahn­geschwindigkeit (eigene Rechnung)', s: 'nasa-earth' }] },
  'solar.sun': { g: 'sun', c: 'gran', f: [
    { v: '5.772', u: 'K', l: 'Oberfläche (Photosphäre)', s: 'nasa-sun' },
    { v: '109', u: '×', l: 'Erd­durchmesser', s: 'nasa-sun' },
    { v: '24,5', u: 'Tage', l: 'Drehung am Äquator', s: 'snodgrass-1990' }] },
  'solar.moon': { g: 'moon', f: MOON_F },
  'moon.phase': { g: 'moon', f: MOON_F },
  'solar.jupiter': { g: 'jupiter', f: [
    { v: '9,9', u: 'h', l: 'ein Jupitertag (9 h 56 min)', s: 'nasa-planets' },
    { v: '318', u: '×', l: 'Erdmasse', s: 'nasa-planets' },
    { v: '5,2', u: 'AE', l: 'Abstand zur Sonne', s: 'nasa-planets' }] },
  'solar.saturn': { g: 'rings', f: [
    { v: '137.000', u: 'km', l: 'Außenkante A-Ring vom Mittel­punkt', s: 'nasa-saturn' },
    { v: '0,69', u: 'g/cm³', l: 'Dichte, geringer als Wasser', s: 'nasa-planets' },
    { v: '274', u: '', l: 'bestätigte Monde (2025)', s: 'nasa-moons' }] },
};

// ---------- Aufbau der Karte ----------
const notesHtml = (notes) => (notes.length ? `<ol class="hc-notes hc-in" style="--i:6" aria-label="Quellen">${notes.map((s, i) => `<li><sup class="fn">${i + 1}</sup>${SOURCES[s]
  ? `<a href="${SOURCES[s].url}" target="_blank" rel="noopener" title="${esc(SOURCES[s].t)}">${esc(SOURCES[s].by)}</a>` : esc(s)}</li>`).join('')}</ol>` : '');

function ctlHtml(l, env) {
  if (l.type === 'toggle') return `<label class="hc-ctl hc-ctl--toggle cfg-toggle hc-in" style="--i:4"><span class="hc-ctl-l">${esc(l.label)}</span>`
    + `<input type="checkbox" data-hc${l.value ? ' checked' : ''}><span class="switch" aria-hidden="true"></span></label>`;
  if (l.type === 'range') return `<label class="hc-ctl hc-in" style="--i:4"><span class="hc-ctl-l">${esc(l.label)}</span><output data-hco>${esc(env.fmt(l, l.value))}</output>`
    + `<input type="range" data-hc min="${l.min}" max="${l.max}" step="${l.step || 1}" value="${l.value}" aria-label="${esc(l.label)}"></label>`;
  return '';
}

// Schalter „Bewegung“ über jeder Grafik (Bahn-Icon + Wort + kleiner Switch); Zustand setzt mountCard
const MT = '<div class="hc-mt-row"><label class="hc-mt cfg-toggle"><svg class="hc-mi" viewBox="0 0 16 16" aria-hidden="true">'
  + '<ellipse cx="8" cy="8.6" rx="6.6" ry="3.1" transform="rotate(-22 8 8.6)" fill="none" stroke="currentColor" stroke-width="1.3"/>'
  + '<circle cx="12.9" cy="5.6" r="1.7" fill="currentColor"/></svg><span>Bewegung</span>'
  + '<input type="checkbox" role="switch" data-fm aria-label="Bewegung der Grafik"><span class="switch" aria-hidden="true"></span></label></div>';
// Bewegung der Grafiken: der gemerkte Schalter gewinnt (Vorschau F1), ohne gemerkten Wert aus bei Zahnrad „Aus“
// oder System „Bewegung reduzieren“
const FM_KEY = 'kosmos.figmotion.v1';
const storedMotion = () => { try { return localStorage.getItem(FM_KEY); } catch { return null; } };
export const figMotion = (env, stored = storedMotion()) => (stored ? stored === 'on' : !(env.reduced || env.motion() === 'off'));

// HTML unter dem Kopf der Karte; t = Hotspot-Text { t, x, s } aus content.js oder der Station
export function cardHtml(sid, hid, t, env) {
  const c = CARDS[`${sid}.${hid}`], notes = [];
  const fn = (s) => { if (!s) return ''; if (!notes.includes(s)) notes.push(s); return `<sup class="fn">${notes.indexOf(s) + 1}</sup>`; };
  if (!c) {   // ohne Bento-Karte: feste Infografik (figs.js) über dem Text, sonst nur Text
    const g = FIGS[`${sid}.${hid}`];
    const fig = g ? `<figure class="hc-graph">${MT}${figSvg(g)}<figcaption class="hc-cap">${prose(g.cap)}${[].concat(g.s).map(fn).join('')}</figcaption></figure>` : '';
    return `${fig}<p class="hs-card-text">${prose(t.x)}${fn(t.s)}</p>${notesHtml(notes)}`;
  }
  const g = GRAPHS[c.g], l = c.c ? env.getLayer(sid, c.c) : null, v = l ? l.value : undefined;
  const fig = `<figure class="hc-graph hc-in" style="--i:0">${MT}${g.svg(v, c)}<figcaption class="hc-cap"><span class="hc-cap-t">${prose(g.cap(v, c))}</span>${fn(g.s || g.m)}</figcaption></figure>`;
  const tiles = `<div class="hc-tiles">${c.f.map((f, i) => `<div class="hc-tile hc-in" style="--i:${i + 1}"><b${(f.v + f.u).length > 7 ? ' class="is-long"' : ''}>`
    + `<span class="hc-num" data-v="${esc(f.v)}">${esc(f.v)}</span>${f.u ? `<i>${esc(f.u)}</i>` : ''}${fn(f.s)}</b><span>${prose(f.l)}</span></div>`).join('')}</div>`;
  const ctl = l ? ctlHtml(l, env) : '';
  const more = `<details class="hc-more hc-in" style="--i:5"><summary>Mehr dazu</summary><p class="hs-card-text">${prose(t.x)}${fn(t.s)}</p></details>`;
  return fig + tiles + ctl + more + notesHtml(notes);
}

// Zahlen zählen beim Öffnen hoch (1,1 s), danach steht der Text aus content.js unverändert da
let timer = 0, raf = 0;
function countUp(el) {
  const nums = [...el.querySelectorAll('.hc-num')].map((n) => {
    const m = n.dataset.v.match(/^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/);
    return m && { n, end: +`${m[1].replace(/\./g, '')}.${m[2] || '0'}`, d: (m[2] || '').length };
  }).filter(Boolean);
  const t0 = performance.now(), D = 1100;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / D), e = 1 - (1 - k) ** 3;
    for (const x of nums) x.n.textContent = k < 1 ? de(x.end * e, x.d) : x.n.dataset.v;
    if (k < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

// Nach dem Einsetzen: Hochzählen, Regler an die Ebene binden (Zahnrad und Karte stellen dieselbe Ebene)
export function mountCard(el, sid, hid, env) {
  unmountCard();
  el.dataset.motion = env.motion();
  if (env.motion() !== 'off' && !env.reduced) countUp(el);
  const fm = el.querySelector('input[data-fm]');
  if (fm) {
    const set = (on) => { el.dataset.fm = on ? 'on' : 'off'; fm.checked = on; };
    set(figMotion(env));
    fm.addEventListener('change', () => { set(fm.checked); try { localStorage.setItem(FM_KEY, fm.checked ? 'on' : 'off'); } catch { /* privates Fenster */ } });
  }
  const c = CARDS[`${sid}.${hid}`], inp = el.querySelector('[data-hc]');
  if (!c || !inp) return;
  const g = GRAPHS[c.g], out = el.querySelector('[data-hco]'), cap = el.querySelector('.hc-cap-t');
  const read = () => (inp.type === 'checkbox' ? inp.checked : +inp.value);
  const show = (v) => {
    if (out) out.textContent = env.fmt(env.getLayer(sid, c.c), v);
    if (g.update) g.update(el, v);
    cap.textContent = nbsp(g.cap(v, c));
  };
  inp.addEventListener('input', () => { env.setLayer(sid, c.c, read()); show(read()); });
  timer = setInterval(() => {
    const l = env.getLayer(sid, c.c);
    if (!l || l.value === read() || document.activeElement === inp) return;
    if (inp.type === 'checkbox') inp.checked = !!l.value; else inp.value = l.value;
    show(l.value);
  }, 300);
}
export function unmountCard() { clearInterval(timer); cancelAnimationFrame(raf); }
