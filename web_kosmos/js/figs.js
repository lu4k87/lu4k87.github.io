// Infografik je Abzeichen (Wunsch User 26.10.2026) in der Info-Karte, Schema mit echten Zahlen und dezenter Bewegung
// im Baustein (Vorschau 26.10.2026 Beweg:C, Stil in kosmos.css; Schalter „Bewegung“ in cards.js). Mit echten
// Zahlen. Jede Zahl im Bild hat eine Quelle in SOURCES (content.js, Test tests/cards.test.js) oder steht als
// „eigene Rechnung“/„Schema“ in der Bildunterschrift. Bausteine (k): peaks (Höhenprofil), bars (Balken in Gruppen),
// scale (Körper, Krater oder Scheiben am Himmel maßstäblich), orbit (Bahnen von oben), timeline (Zeitleiste),
// range (Skala mit Marken und Spanne), layers (Schichten maßstäblich), polar (Pol von oben), grooves (Schema Phobos).
// Daten je Ast in web/js/figs/<ast>.js – so können parallele Chats getrennte Dateien füllen. Abzeichen zum
// Hineinfliegen (kind: 'dive') öffnen keine Karte und bekommen keine Grafik.

import ERDE from './figs/erde.js';
import SONNE from './figs/sonne.js';
import JUPITER from './figs/jupiter.js';
import MARS from './figs/mars.js';
import AUSSEN, { kinds as AUSSEN_KINDS } from './figs/aussen.js';
import GALAXIS from './figs/galaxis.js';
import TELESKOP from './figs/teleskop.js';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Fließtext im Blocksatz (kosmos.css „Fließtext“): geschützte Leerzeichen, damit Zahl + Einheit (384 km, ≈ 90 t),
// Kürzel (z. B.) und Namen mit Nummer (Voyager 2) nie auseinanderbrechen und kein Gedankenstrich eine Zeile beginnt.
// Wirkt auf fertiges HTML ohne Tags mit Leerzeichen (esc-Text, Hinweise im Zahnrad)
const NB = '\u00a0';
export const nbsp = (s) => String(s)
  .replace(/(\d) (?=(?:\S{1,4}|Mio\.|Mrd\.|Jahren?|Tagen?|Stunden|Minuten)(?=[\s,.;:)!?]|$))/g, `$1${NB}`)
  .replace(/([≈≙~±≤≥<>×−]|&lt;|&gt;) (?=\d)/g, `$1${NB}`)
  .replace(/(\b[A-Za-z]\.) (?=[A-Za-z]\.)/g, `$1${NB}`)
  .replace(/([A-ZÄÖÜ][\wäöüß]*) (?=\d+(?:[\s,.;:)]|$))/g, `$1${NB}`)
  .replace(/(\w-) (?=(?:und|oder|bis|sowie) )/g, `$1${NB}`)     // Kern- und Halbschatten: „Kern-“ nie allein am Zeilenende
  .replace(/ – /g, `${NB}– `);
export const prose = (s) => nbsp(esc(s));
export const de = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
export const f1 = (v) => v.toFixed(1);
const num = (v) => v.toLocaleString('de-DE', { maximumFractionDigits: Math.abs(v) < 1 ? 2 : Math.abs(v) < 100 ? 1 : 0 }).replace('-', '−');
const W = 300;
const open = (h, label) => `<svg class="hc-svg hf" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}">`;
const txt = (x, y, s, a = 'start', cls = '') => `<text x="${f1(x)}" y="${f1(y)}" text-anchor="${a}"${cls ? ` class="${cls}"` : ''}>${esc(s)}</text>`;
const hl = (on) => (on ? ' is-hl' : '');

// Höhenprofil: Gipfel als Kegel auf gemeinsamer Grundlinie, Höhen maßstäblich (Breiten schematisch); Namen in zwei
// versetzten Zeilen, damit lange Namen benachbarter Gipfel sich nicht berühren
function peaks(f) {
  const y0 = 150, y1 = 34, x0 = 34, max = Math.max(...f.items.map((p) => p.h)), step = Math.ceil(max / 4 / 5) * 5 || 1;
  const Y = (h) => y0 - (h / (step * 4)) * (y0 - y1), slot = (W - x0 - 8) / f.items.length;
  let s = '';
  for (let i = 0; i <= 4; i++) s += `<line x1="${x0}" x2="${W - 6}" y1="${f1(Y(i * step))}" y2="${f1(Y(i * step))}" class="hc-grid"/>${txt(x0 - 6, Y(i * step) + 4, num(i * step), 'end')}`;
  s += txt(x0 - 6, 18, f.u || 'km', 'end');
  f.items.forEach((p, i) => {
    const cx = x0 + slot * (i + 0.5), half = slot * (p.wide ? 0.5 : 0.28), top = Y(p.h), ly = y0 + 16 + (i % 2) * 30;
    s += `<path d="M${f1(cx - half)} ${y0}Q${f1(cx - half * 0.35)} ${f1(top + (p.wide ? 6 : 2))} ${f1(cx)} ${f1(top)}Q${f1(cx + half * 0.35)} ${f1(top + (p.wide ? 6 : 2))} ${f1(cx + half)} ${y0}Z" class="hf-body${hl(p.hl)}"/>`;
    s += txt(cx, top - 7, p.t || `${num(p.h)} ${f.u || 'km'}`, 'middle', p.hl ? 'hc-acc' : '');
    if (i % 2) s += `<line x1="${f1(cx)}" x2="${f1(cx)}" y1="${y0 + 3}" y2="${ly - 11}" class="hf-tick"/>`;
    s += txt(cx, ly, p.l, 'middle', 'hf-name') + (p.sub ? txt(cx, ly + 13, p.sub, 'middle') : '');
  });
  return `${open(y0 + 64, f.alt)}${s}<line x1="${x0}" x2="${W - 6}" y1="${y0}" y2="${y0}" class="hf-base"/></svg>`;
}

// Balken in Gruppen: je Gruppe eigene Skala (linear); Namen links, Werte rechtsbündig in eigener Spalte
function bars(f) {
  const all = f.groups.flatMap((g) => g.items), lab = (b) => b.t || num(b.v);
  const x0 = Math.min(118, 8 + Math.max(...all.map((b) => b.l.length)) * 6.7), x1 = W - 10 - Math.max(...all.map((b) => lab(b).length)) * 6.7, row = 19;
  let y = 4, s = '';
  for (const g of f.groups) {
    const max = Math.max(...g.items.map((b) => b.v));
    s += txt(0, y + 10, `${g.t} · ${g.u}`, 'start', 'hc-t');
    y += 18;
    for (const b of g.items) {
      s += txt(x0 - 8, y + 10, b.l, 'end', b.hl ? 'hf-name' : '');
      s += `<rect x="${f1(x0)}" y="${y + 1}" width="${f1(Math.max(1.5, (b.v / max) * (x1 - x0)))}" height="11" rx="2" class="hf-bar${hl(b.hl)}"/>`;
      s += txt(W, y + 10, lab(b), 'end', b.hl ? 'hc-acc' : '');
      y += row;
    }
    y += 8;
  }
  return `${open(y, f.alt)}${s}</svg>`;
}

// Maßstäblich nebeneinander: Ellipsen (a × b) mit Krater (c) oder Scheiben am Himmel (Winkel in Grad); jede Spalte
// ist mindestens so breit wie ihre Beschriftung, winzige Körper bekommen eine Mindestgröße und einen Strich zum Namen
const CH = 6.7;   // Breite eines Zeichens der Grafikschrift (11 px Mono) im viewBox
function scale(f) {
  const maxH = f.h || 120, top = 14, items = f.items, maxD = Math.max(...items.map((b) => b.b || b.a));
  const lw = items.map((b) => Math.max(b.l.length, (b.t || '').length) * CH + 10);
  const k = Math.min(maxH / maxD, (W - 8 - (items.length - 1) * 10) / items.reduce((t, b) => t + b.a, 0));
  const cols = items.map((b, i) => Math.max(b.a * k + 10, lw[i]));
  const sum = cols.reduce((t, c) => t + c, 0), fit = W / sum;
  let x = (W - Math.min(W, sum)) / 2, s = '';
  const cy = top + (maxD * k) / 2;
  items.forEach((b, i) => {
    const col = cols[i] * Math.min(1, fit), cx = x + col / 2;
    const rx = Math.max((b.a * k) / 2, 1.2), ry = Math.max(((b.b || b.a) * k) / 2, 1.2);
    s += b.b ? `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" class="hf-body${hl(b.hl)}"/>`
      : `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(rx)}" class="hf-body${hl(b.hl)}"/>`;
    if (b.c) {   // Krater am Rand der Vorderseite, maßstäblich
      const r = (b.c * k) / 2, kx = cx - rx + r + rx * 0.12;
      s += `<circle cx="${f1(kx)}" cy="${f1(cy)}" r="${f1(r)}" class="hf-crater"/>`;
      s += `<line x1="${f1(kx)}" y1="${f1(cy - r)}" x2="${f1(kx)}" y2="${f1(top - 2)}" class="hf-tick"/>${txt(kx, top - 5, b.cl, 'middle', 'hc-acc')}`;
    }
    const ly = top + maxD * k + 16 + (fit < 1 ? (i % 2) * 28 : 0);
    if (rx < 6 || ly > top + maxD * k + 20) s += `<line x1="${f1(cx)}" y1="${f1(cy + ry + 3)}" x2="${f1(cx)}" y2="${f1(ly - 11)}" class="hf-tick"/>`;
    s += txt(cx, ly, b.l, 'middle', b.hl ? 'hf-name hc-acc' : 'hf-name') + txt(cx, ly + 13, b.t, 'middle');
    x += col;
  });
  return `${open(top + maxD * k + 36 + (fit < 1 ? 28 : 0), f.alt)}${s}</svg>`;
}

// Bahnen von oben, maßstäblich um den Zentralkörper; Namen rechts an der Bahn
function orbit(f) {
  const cx = 98, cy = 104, R = 94, max = Math.max(...f.orbits.map((o) => o.a)), k = R / max;
  const a0 = Math.min(...f.orbits.filter((o) => !o.dash).map((o) => o.a));   // innerste Bahn mit Mond: 10 s je Umlauf
  let s = `<circle cx="${cx}" cy="${cy}" r="${f1(f.r * k)}" class="hf-planet"/>${txt(cx, cy + 4, f.l, 'middle', 'hf-on-planet')}`;
  f.orbits.forEach((o, i) => {
    s += `<circle cx="${cx}" cy="${cy}" r="${f1(o.a * k)}" class="${o.dash ? 'hc-path' : `hc-orbit${o.hl ? ' is-on' : ''}`}"/>`;
    const a = (-28 + i * 26) * Math.PI / 180, px = cx + o.a * k * Math.cos(a), py = cy + o.a * k * Math.sin(a);
    // Punkt kreist im Takt nach Kepler (T ∝ a^1,5, gleicher Zentralkörper); die Leitlinie zum Namen bleibt am Ort
    if (!o.dash) s += `<g class="hf-kepler" style="transform-origin:${cx}px ${cy}px;--T:${(10 * (o.a / a0) ** 1.5).toFixed(1)}s">`
      + `<circle cx="${f1(px)}" cy="${f1(py)}" r="3.4" class="hc-sat${o.hl ? ' is-on' : ''}"/></g>`;
    const ty = 22 + i * 56;
    s += `<path d="M${f1(px + 4)} ${f1(py)}L${f1(W - 98)} ${f1(ty - 4)}" class="hf-tick"/>`;
    s += txt(W - 94, ty, o.l, 'start', o.hl ? 'hf-name hc-acc' : 'hf-name') + o.t.split(' · ').map((r, j) => txt(W - 94, ty + 13 * (j + 1), r)).join('');
  });
  return `${open(212, f.alt)}${s}</svg>`;
}

// Zeitleiste als Messblatt (Bild:C): Datumsspalte rechtsbündig, Punkt-Achse, Ereignis daneben (zweite Zeile darunter); Zeilen
// in Reihenfolge statt nach Zeitabstand, damit die Karte kurz bleibt und nichts abgeschnitten wird; hervorgehoben = cyan
function timeline(f) {
  const ax = 104, rows = [];
  let y = 14;
  f.items.forEach((e) => { rows.push(y); y += e.l2 ? 40 : 26; });
  const top = rows[0], end = rows[rows.length - 1];
  let s = `<line x1="${ax}" x2="${ax}" y1="${top}" y2="${end}" class="hf-base"/>`;
  f.items.forEach((e, i) => {
    const r = rows[i], c = e.hl ? ' is-hlt' : '';
    s += `<circle cx="${ax}" cy="${r}" r="${e.hl ? 4.5 : 3.5}" class="hc-sat${e.hl ? ' is-on' : ''}"/>`;
    s += txt(ax - 12, r + 4, e.t, 'end', `hf-date${c}`) + txt(ax + 14, r + 4.5, e.l, 'start', `hf-name${c}`) + (e.l2 ? txt(ax + 14, r + 22, e.l2, 'start', `hf-name${c}`) : '');
  });
  s += `<circle cx="${ax}" cy="${top}" r="3" class="hf-runner" style="--ty:${end - top}px"/>`;   // Lichtpunkt läuft die Achse entlang
  return `${open(y - 6, f.alt)}${s}</svg>`;
}

// Skala mit Spanne und Marken (z. B. Temperaturen); Bezugsmarken gestrichelt
function range(f) {
  const x0 = 20, x1 = W - 20, y = 84, X = (v) => x0 + ((v - f.min) / (f.max - f.min)) * (x1 - x0);
  let s = '';
  for (let v = Math.ceil(f.min / f.step) * f.step; v <= f.max; v += f.step) s += `<line x1="${f1(X(v))}" x2="${f1(X(v))}" y1="${y - 4}" y2="${y + 4}" class="hf-tick"/>${txt(X(v), y + 20, num(v), 'middle')}`;
  if (f.span) {   // Spanne mit Glanz, der über sie wandert (Bereich statt Einzelwert)
    const sx = X(f.span[0]), sw = X(f.span[1]) - sx, gw = Math.min(28, sw / 3);
    s += `<rect x="${f1(sx)}" y="${y - 7}" width="${f1(sw)}" height="14" rx="3" class="hf-bar is-hl"/>`
      + `<rect x="${f1(sx)}" y="${y - 7}" width="${f1(gw)}" height="14" rx="3" class="hf-shimmer" style="--w:${f1(sw - gw)}px"/>`
      + txt(sx + sw / 2, y + 38, f.spanL, 'middle', 'hf-name');
  }
  f.marks.forEach((m, i) => {
    const x = X(m.v), ty = 22 + (i % 2) * 26, a = x < 60 ? 'start' : x > W - 60 ? 'end' : 'middle';
    s += `<line x1="${f1(x)}" x2="${f1(x)}" y1="${ty + 17}" y2="${y - 8}" class="${m.ref ? 'hc-path' : 'hf-tick'}"/>`;
    s += txt(x, ty, m.t, a, m.ref ? '' : 'hc-acc') + txt(x, ty + 13, m.l, a, 'hf-name');
  });
  return `${open(132, f.alt)}<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" class="hf-base"/>${s}<text x="${x1}" y="${y + 38}" text-anchor="end">${esc(f.u)}</text></svg>`;
}

// Schichten maßstäblich in einem Balken (dünne Schichten bleiben dünn), Namen darunter mit Strich
function layers(f) {
  const x0 = 10, x1 = W - 10, y = 30, h = 34, tot = f.items.reduce((t, l) => t + l.d, 0);
  let x = x0, s = '';
  f.items.forEach((l, i) => {
    const w = Math.max(2, (l.d / tot) * (x1 - x0));
    s += `<rect x="${f1(x)}" y="${y}" width="${f1(w)}" height="${h}" class="hf-layer${hl(l.hl)}"/>`;
    const lx = i === 0 ? x0 : x + w / 2, a = i === 0 ? 'start' : 'middle', ly = y + h + 22 + (i === 0 ? 0 : 30);
    if (i === 0) s += `<line x1="${f1(x + w / 2)}" x2="${f1(x + w / 2)}" y1="${y + h + 2}" y2="${ly - 11}" class="hf-tick"/>`;
    s += txt(lx, ly, l.t, a, l.hl ? 'hc-acc' : '') + txt(lx, ly + 13, l.l, a, 'hf-name');
    x += w;
  });
  return `${open(y + h + 76, f.alt)}${txt(x0, 18, f.from, 'start')}${txt(x1, 18, f.to, 'end')}${s}</svg>`;
}

// Pol von oben: Breitenkreise maßstäblich als Abstand vom Pol, Zonen gefüllt
function polar(f) {
  const cx = 90, cy = 100, k = 84 / (90 - f.edge);
  let s = '';
  for (const z of f.zones) s += `<circle cx="${cx}" cy="${cy}" r="${f1((90 - z.lat) * k)}" class="hf-zone${hl(z.hl)}"/>`;
  for (const lat of f.grid) s += `<circle cx="${cx}" cy="${cy}" r="${f1((90 - lat) * k)}" class="hc-grid"/>${txt(cx + 3, cy - (90 - lat) * k - 3, `${lat}°`)}`;
  s += `<circle cx="${cx}" cy="${cy}" r="2.4" class="hc-pole"/>`;
  f.zones.forEach((z, i) => {
    const r = (90 - z.lat) * k, a = (i ? 20 : -30) * Math.PI / 180, px = cx + r * Math.cos(a), py = cy + r * Math.sin(a), ty = 60 + i * 64;
    s += `<path d="M${f1(px)} ${f1(py)}L${f1(W - 122)} ${f1(ty - 4)}" class="hf-tick"/>`;
    s += txt(W - 118, ty, z.t, 'start', z.hl ? 'hc-acc' : '') + txt(W - 118, ty + 13, z.l, 'start', 'hf-name') + (z.l2 ? txt(W - 118, ty + 26, z.l2) : '');
  });
  return `${open(204, f.alt)}${s}</svg>`;
}

// Phobos-Rillen (Schema nach Murray et al. 2006): Furchen als Kreisbögen um die vordere Spitze in Flugrichtung
function grooves(f) {
  const cx = 182, cy = 96, rx = 104, ry = 70, ax = cx - rx;
  let arcs = '';
  for (let i = 1; i <= 8; i++) arcs += `<circle cx="${ax}" cy="${cy}" r="${f1(i * 24)}" class="hf-groove"/>`;
  return `${open(196, f.alt)}<defs><clipPath id="hf-ph"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath></defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="hf-body"/><g clip-path="url(#hf-ph)">${arcs}</g>
    <circle cx="${cx + 40}" cy="${cy + 6}" r="${f1((9 / 27) * rx)}" class="hf-crater"/>${txt(cx + 40, cy + 10, 'Stickney', 'middle', 'hf-name')}
    <circle cx="${ax}" cy="${cy}" r="3.4" class="hc-mark"/><path d="M${ax - 8} ${cy}H10M18 ${cy - 6}L10 ${cy}L18 ${cy + 6}" class="hf-arrow"/><path d="M40 ${cy - 42}V${cy - 8}" class="hf-tick"/>
    ${txt(8, cy - 46, 'Flugrichtung', 'start', 'hc-acc')}${txt(cx, 188, f.foot, 'middle')}</svg>`;
}

const KINDS = { peaks, bars, scale, orbit, timeline, range, layers, polar, grooves, ...AUSSEN_KINDS };
export const FIGS = { ...ERDE, ...SONNE, ...JUPITER, ...MARS, ...AUSSEN, ...GALAXIS, ...TELESKOP };
// Bewegung für alle Bausteine (auch die aus figs/<ast>.js): Art als Klasse, Staffel --k für das Einwachsen, pathLength
// zum Einzeichnen der Linien; was sich danach bewegt, steht in kosmos.css (Abschnitt Info-Karte)
export function figSvg(f) {
  let k = 0;
  return KINDS[f.k](f).replace('class="hc-svg hf"', `class="hc-svg hf hf--${f.k}"`)
    .replace(/class="(hf-bar|hf-body|hf-layer|hf-zone|hf-groove)( is-hl)?"/g, (m) => `${m} style="--k:${k++}"`)
    .replace(/<(line|circle|path)([^>]*?) class="(hf-base|hc-orbit|hf-groove)/g, '<$1$2 pathLength="1" class="$3');
}
export const figKinds = KINDS;
