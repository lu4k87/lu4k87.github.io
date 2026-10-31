// Einstellungen hinter dem Zahnrad oben rechts, aufgebaut wie in Kosmos (Vorschau 26.10.2026 Bento:A + Global:A+B+C, übernommen
// 2026-10-26): drei Reiter „Ebene n“ = Schalter der aktiven Ebene als Klapp-Liste mit Sprungleiste (layers.js, Zahnrad:A + C),
// „Global“ = gilt überall, mit Themenliste links, Karten mit Icon-Plakette, Mini-Grafik je Zeile, geänderte
// Werte mit „Standard“ + Leiste „Alle zurücksetzen“. Global: Look (Farblook, Belichtung, Vignette, Kinobalken), Licht, Kamera &
// Bewegung, Effekte, REM (Ebenen 2–4), Material & Optik, Oberfläche (Hell/Dunkel, Infotafel, Messhilfen, Abzeichen), und „Qualität“
// (Vorschau 31.10.2026 Reiter:B): Stufen als Kacheln mit Zielgerät und Rechenlast, darunter Messzeile, Detailgrad, Schatten,
// Renderskala, Bildrate. `?cfg` öffnet das Zahnrad, `?cfg=global` bzw. `?cfg=quality` mit diesem Reiter.
// Werte in localStorage `biochar-settings.v1` (clean() prüft jeden Wert); main.js liest settings.S und hört per settings.on().
// Die Qualitätsstufe selbst bleibt in quality.js, die Schalter hier liegen darüber (main.js eff()).

import { QUALITY, quality } from './quality.js';
import { theme, setTheme } from './theme.js';
import { mountLayers, icon, navHtml, wireNav, devLine, devBar, markDevs, syncLayers, spyLayers } from './layers.js';

const KEY = 'biochar-settings.v1';
// detail/light/fx: Hauptregler (Faktor auf Detailgrad der Stufe, auf alle Lichter, auf Linse + Korn); shadow: off · soft · full;
// dive/play: Flugdauer zwischen Ebenen und Länge des Pyrolyse-Zeitraffers (s); key/rim/env/pool: Faktoren auf die Werte der
// Ebenen (1 = wie gebaut); kelvin 6500 = Lichtfarbe der Ebene unverändert (Normierung auf D65); fps 0 = ohne Deckel;
// grade: Farblook („ebene“ = Stimmung der Ebene), vig: Faktor auf die Vignette, bars: Kinobalken 2,39:1;
// Material & Optik (Vorschau 31.10.2026 Kohle:A, REM:A, Atome:A, Linse:A): coat Klarlack der Kohle (Ebene 1), edgeLight Faktor auf
// ihr Gegenlicht (Höchstwerte 31.10.2026 gesenkt: Spiegelung war zu stark), semEdge/semGrain Kantenleuchten und Körnung der REM-Ebenen (sem.js semLook), atomCoat Klarlack der Atome
// (Ebenen 6–7), bloomThr Helligkeit, ab der Bloom einsetzt
const DEF = {
  detail: 1, light: 1, shadow: 'full', fx: 1,
  scale: 1, fps: 0, dof: true, bloom: true, ca: true, grain: true,
  motion: 'full', intro: true, cine: true, orbit: true, sem: true, dive: 3.5, play: 8,
  key: 1, rim: 1, env: 1, kelvin: 6500, exposure: 1, pool: 1,
  dust: true, veil: true, hotspots: true, charge: false /* Aufladung aus, bis jemand sie einschaltet (Vorschau 2026-10-25, F3) */,
  grade: 'ebene', vig: 1, bars: false,
  coat: 0.3, edgeLight: 1.5, semEdge: 0.95, semGrain: 0.55, atomCoat: 1, bloomThr: 0.6,
};
const RANGE = { detail: [0.5, 1], light: [0, 2], fx: [0, 1.5], scale: [0.5, 1], fps: [0, 60], dive: [1.5, 6], play: [4, 30], key: [0, 2], rim: [0, 2], env: [0, 2],
  kelvin: [2700, 9000], exposure: [0.5, 2], pool: [0, 2], vig: [0, 1.5],
  coat: [0, 0.6], edgeLight: [0.5, 2], semEdge: [0.3, 1.2], semGrain: [0.3, 1.3], atomCoat: [0, 1], bloomThr: [0.4, 1] };
// Farblook: Tönung Schatten/Lichter (linear), Sättigung, S-Kurve, Belichtung, Vignette. „Ebene“ = Stimmung der Ebene (main.js MOODS),
// die anderen gelten auf allen Ebenen (main.js gradeOf). Labor = kühl und entsättigt wie ein Messbild, Glut = warm wie die Rotglut
export const GRADES = [['neutral', { sh: [0.97, 0.99, 1.03], hi: [1.02, 1, 0.97], sat: 1.02, con: 0.12, exposure: 1, vig: 0.38 }],
  ['Kino', { sh: [0.88, 0.93, 1.06], hi: [1.1, 0.99, 0.86], sat: 1.1, con: 0.22, exposure: 1.03, vig: 0.55 }],
  ['Labor', { sh: [0.94, 0.98, 1.08], hi: [0.98, 1, 1.04], sat: 0.85, con: 0.16, exposure: 1, vig: 0.3 }],
  ['Glut', { sh: [0.85, 0.88, 0.98], hi: [1.12, 0.98, 0.84], sat: 1.15, con: 0.26, exposure: 0.95, vig: 0.6 }],
  ['ruhig', { sh: [0.97, 0.98, 1.02], hi: [1.04, 1, 0.94], sat: 0.95, con: 0.1, exposure: 1, vig: 0.4 }]];
const GRADE_IDS = ['ebene', 'neutral', 'kino', 'labor', 'glut', 'ruhig'];
const ENUM = { motion: ['full', 'calm', 'off'], shadow: ['off', 'soft', 'full'], grade: GRADE_IDS };
// globaler Farblook oder null (= jede Ebene ihre eigene Stimmung)
export const globalGrade = (S) => (S.grade === 'ebene' ? null : GRADES[GRADE_IDS.indexOf(S.grade) - 1][1]);
// Grundstufe setzt die Einzelschalter; „Aus“ wirkt wie prefers-reduced-motion (kurze Flüge ohne Zoom-Unschärfe, Sprünge statt Gleiten)
const MOT = {
  full: { intro: true, cine: true, orbit: true, sem: true },
  calm: { intro: true, cine: false, orbit: false, sem: false },
  off: { intro: false, cine: false, orbit: false, sem: false },
};
// Schalter, die die Darstellungsstufe ändern (main.js applyQuality)
export const PERF_KEYS = ['detail', 'fx', 'shadow', 'scale', 'dof', 'bloom', 'ca'];

export function clean(raw) {
  const s = { ...DEF };
  if (!raw || typeof raw !== 'object') return s;
  for (const k in DEF) {
    const v = raw[k];
    if (v === undefined) continue;
    if (k in RANGE) { if (Number.isFinite(v)) s[k] = Math.min(RANGE[k][1], Math.max(RANGE[k][0], v)); }
    else if (k in ENUM) { if (ENUM[k].includes(v)) s[k] = v; }
    else s[k] = v === true;
  }
  return s;
}

const S = (() => {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { /* privat/gesperrt: Standardwerte */ }
  return clean(raw);
})();
const subs = [];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ohne Merken weiter */ } };
function set(patch) {
  const keys = Object.keys(patch).filter((k) => k in DEF && S[k] !== patch[k]);
  if (!keys.length) return;
  Object.assign(S, clean({ ...S, ...patch }));
  save();
  for (const f of subs) f(S, keys);
}

// Bildzeit für die Messzeile: EMA + letzte 60 Bildabstände (main.js ruft frame() je gezeichnetem Bild)
const stat = { ms: 0, log: new Float32Array(60), i: 0 };
function frame(real) {
  const ms = real * 1000;
  stat.ms = stat.ms ? stat.ms + (ms - stat.ms) * 0.1 : ms;
  stat.log[stat.i] = ms;
  stat.i = (stat.i + 1) % stat.log.length;
}

// Farbtemperatur → RGB (Tanner Helland, Näherung an den Planck-Strahler), normiert auf D65 (6500 K = Farbe der Ebene bleibt)
const kelvinRGB = (K) => {
  const t = K / 100, c = (v) => Math.max(0, Math.min(255, v)) / 255;
  return [c(t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592),
    c(t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492),
    c(t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307)];
};
const WHITE = kelvinRGB(6500);
export const kelvinTint = (K) => kelvinRGB(K).map((v, i) => Math.min(1, v / WHITE[i]));

export const settings = {
  S,
  set,
  on(f) { subs.push(f); f(S, null); },
  reset() { set({ ...DEF }); quality.setAuto(); },
  frame,
};

// ---------- Panel ----------
const COG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const num = (v, d = 0) => v.toLocaleString('de', { minimumFractionDigits: d, maximumFractionDigits: d });
// Normlichtarten der CIE als Orientierung (A = Glühlampe 2856 K, D50 … D75 = Tageslichtphasen)
const CIE = [[2856, 'A Glühlampe'], [5003, 'D50 Horizontlicht'], [5503, 'D55 Vormittagssonne'], [6504, 'D65 Tageslicht'], [7504, 'D75 Nordhimmel']];
const cie = (K) => {
  const c = CIE.reduce((b, x) => (Math.abs(x[0] - K) < Math.abs(b[0] - K) ? x : b));
  return Math.abs(c[0] - K) <= 300 ? ` ≈ ${c[1]}` : '';
};
const pct = (v) => `${num(v * 100)} %`;
const sec = (v) => `${num(v, v % 1 ? 1 : 0)} s`;
const OUT = { detail: pct, light: pct, fx: pct, dive: sec, play: sec, key: pct, rim: pct, env: pct, pool: pct, vig: pct,
  exposure: (v) => `${num(v, 2)} ×`, kelvin: (v) => `${Math.round(v)} K${cie(v)}`,
  coat: pct, atomCoat: pct, edgeLight: (v) => `${num(v, 1)} ×`, semEdge: (v) => num(v, 2), semGrain: (v) => num(v, 2), bloomThr: (v) => num(v, 2) };

const NEW = '<span class="b-new">neu</span>';
const SEG = (key, label, opts, extra = '') => `
  <div class="b-row b-stack"><span class="cfg-label" id="cfg-${key}">${label}${extra}</span>
    <div class="seg b-seg" role="radiogroup" aria-labelledby="cfg-${key}">
      ${opts.map(([v, l]) => `<button type="button" role="radio" data-key="${key}" data-val="${v}">${l}</button>`).join('')}
    </div></div>`;
const TOG = (key, label, extra = '', attr = `data-key="${key}"`) => `
  <label class="b-row cfg-toggle"><span class="cfg-label">${label}${extra}</span><input type="checkbox" ${attr}><span class="switch" aria-hidden="true"></span></label>`;
const RNG = (key, label, step, extra = '') => `
  <label class="b-row b-stack"><span class="b-top"><span class="cfg-label">${label}${extra}</span><output class="cfg-val" data-out="${key}"></output></span>
    <span class="b-track"><input type="range" data-key="${key}" min="${RANGE[key][0]}" max="${RANGE[key][1]}" step="${step}"></span></label>`;
const NOTE = (text) => `<p class="cfg-note lay-hint">${text}</p>`;
// Mini-Grafik neben der Zeile: zeigt, was die Einstellung bewirkt (halbe Karten und schmal: ausgeblendet)
const dots = (pts, fill) => pts.map(([x, y, r = 1]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');
const MINI = {
  exposure: '<rect x="1" y="6" width="62" height="8" rx="4" fill="url(#mgE)"/><circle cx="32" cy="10" r="5" fill="none" stroke="var(--accent)" stroke-width="2"/>',
  vig: '<rect x="1" y="1" width="62" height="18" rx="3" fill="url(#mgV)"/>',
  bars: '<rect x="1" y="1" width="62" height="18" rx="3" fill="#4a3a2c"/><rect x="1" y="1" width="62" height="4" fill="#07080a"/><rect x="1" y="15" width="62" height="4" fill="#07080a"/>',
  kelvin: '<rect x="1" y="6" width="62" height="8" rx="4" fill="url(#mgK)"/>',
  light: '<circle cx="12" cy="10" r="5" fill="#ffd9a0"/><path d="M22 10h38" stroke="#ffd9a0" stroke-width="2" stroke-dasharray="3 3"/>',
  pool: '<rect x="1" y="1" width="62" height="18" rx="3" fill="url(#mgP)"/>',
  motion: '<path d="M2 10Q10 2 18 10T34 10T50 10T66 10" fill="none" stroke="var(--accent)" stroke-width="2"/>',
  dive: '<path d="M2 18C24 18 40 2 62 2" fill="none" stroke="var(--accent)" stroke-width="2"/><circle cx="2" cy="18" r="2" fill="currentColor"/><circle cx="62" cy="2" r="2" fill="currentColor"/>',
  play: '<path d="M2 17h12l8-6 10-2 14 3 16-6" fill="none" stroke="var(--accent)" stroke-width="2"/>',
  dust: '<rect x="1" y="1" width="62" height="18" rx="3" fill="#07080a"/>' + dots([[8, 6], [17, 13, 1.4], [27, 7], [36, 15], [45, 5, 1.3], [55, 12], [21, 4, 0.8], [50, 16, 0.8]], '#e8d9c0'),
  fps: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${3 + i * 7.5}" y="${i % 2 ? 6 : 3}" width="5" height="${i % 2 ? 11 : 14}" rx="1" fill="currentColor" opacity="${i < 6 ? 0.8 : 0.3}"/>`).join(''),
  scale: '<rect x="2" y="3" width="26" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="36" y="3" width="26" height="14" rx="2" fill="currentColor" opacity=".35"/><path d="M30 10h4" stroke="var(--accent)" stroke-width="2"/>',
  coat: '<rect x="1" y="1" width="62" height="18" rx="3" fill="#15161a"/><ellipse cx="24" cy="7" rx="14" ry="2.6" fill="#dfe6f0" opacity=".75"/>',
  edgeLight: '<rect x="1" y="1" width="62" height="18" rx="3" fill="#15161a"/><path d="M8 17L22 4h34" fill="none" stroke="#c4d6ff" stroke-width="2"/>',
  semEdge: '<rect x="1" y="1" width="62" height="18" rx="3" fill="#55585e"/><rect x="8" y="5" width="18" height="10" rx="1" fill="#3a3c41" stroke="#f2f4f8" stroke-width="1.6"/><rect x="34" y="5" width="22" height="10" rx="1" fill="#3a3c41" stroke="#f2f4f8" stroke-width="1.6"/>',
  semGrain: '<rect x="1" y="1" width="62" height="18" rx="3" fill="#55585e"/>' + dots([[7, 5, 0.9], [14, 12, 1.1], [21, 7, 0.8], [28, 15, 1], [34, 4, 0.9], [41, 11, 1.2], [48, 6, 0.8], [55, 14, 1], [11, 16, 0.8], [38, 17, 0.7], [58, 5, 0.9]], '#c9ccd2'),
  atomCoat: '<rect x="1" y="1" width="62" height="18" rx="3" fill="#0b1020"/><circle cx="22" cy="10" r="7" fill="url(#mgA)"/><circle cx="42" cy="10" r="7" fill="url(#mgA)"/><path d="M29 10h6" stroke="#8a93a6" stroke-width="2.4"/>',
  bloomThr: '<rect x="1" y="1" width="62" height="18" rx="3" fill="#07080a"/><circle cx="32" cy="10" r="8" fill="url(#mgB)"/><circle cx="32" cy="10" r="2.2" fill="#fff4e0"/>',
};
const MINI_DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="mgE"><stop offset="0" stop-color="#07080a"/><stop offset="1" stop-color="#fbf6ec"/></linearGradient>'
  + '<radialGradient id="mgV"><stop offset=".45" stop-color="#8a7a66"/><stop offset="1" stop-color="#07080a"/></radialGradient>'
  + '<linearGradient id="mgK"><stop offset="0" stop-color="#ffa64d"/><stop offset=".5" stop-color="#fff4ea"/><stop offset="1" stop-color="#c9d9ff"/></linearGradient>'
  + '<radialGradient id="mgP" cx=".3" cy=".4"><stop offset="0" stop-color="#7ea0c0"/><stop offset="1" stop-color="#07080a"/></radialGradient>'
  + '<radialGradient id="mgA" cx=".35" cy=".3"><stop offset="0" stop-color="#ffffff"/><stop offset=".25" stop-color="#9aa3b4"/><stop offset="1" stop-color="#2b3040"/></radialGradient>'
  + '<radialGradient id="mgB"><stop offset="0" stop-color="#ffd9a0"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient></defs></svg>';
// Zeile = Bedienung (+ Mini-Grafik daneben) + Hinweis darunter + Zeile „geändert · Standard“
const ROW = (key, html) => {
  const i = html.indexOf('<p class="cfg-note'), [ctl, note] = i < 0 ? [html, ''] : [html.slice(0, i), html.slice(i)];
  return `<div class="b-item">${MINI[key] ? `<div class="b-line">${ctl}<svg class="b-mini" viewBox="0 0 64 20" aria-hidden="true">${MINI[key]}</svg></div>` : ctl}${note}${key ? devLine(key) : ''}</div>`;
};
// Farblook als Bild-Kacheln: glühendes Kohlestück in den Farben des Looks; „Ebene“ = die vier Stimmungen der Ebenen im Kreis
const rgb = (b, t, e) => `rgb(${b.map((x, i) => Math.min(255, Math.round(x * t[i] * e))).join(',')})`;
const swatch = (g) => (g ? `background:radial-gradient(circle at 34% 62%, ${rgb([255, 214, 160], g.hi, g.exposure)} 0 8%, ${rgb([226, 92, 30], g.hi, g.exposure)} 20%, ${rgb([70, 36, 24], g.sh, g.exposure)} 44%, ${rgb([20, 20, 24], g.sh, g.exposure)} 78%);box-shadow:inset 0 0 ${Math.round(g.vig * 26)}px rgba(0,0,0,.85)`
  : 'background:conic-gradient(from 200deg at 50% 55%, #c8874a 0 25%, #8e959e 0 50%, #4f79a8 0 75%, #3c4a9a 0)');
const LOOKS = `<div class="b-row b-stack"><span class="cfg-label" id="cfg-grade">Farblook${NEW}</span>
  <div class="b-looks" role="radiogroup" aria-labelledby="cfg-grade">${GRADE_IDS.map((id, i) => `<button type="button" role="radio" data-key="grade" data-val="${id}"><span class="b-sw" style="${swatch(i ? GRADES[i - 1][1] : null)}"></span><span>${i ? GRADES[i - 1][0] : 'Ebene'}</span></button>`).join('')}</div></div>`
  + NOTE('„Ebene“ = jede Ebene behält ihre Stimmung (Studio warm, REM grau, Nano blau); die anderen gelten überall.');
// Ansicht (Hell/Dunkel, Infotafel, Messhilfen) liegt nicht in settings.S: eigene Zeilen mit data-view
const VIEW_THEME = `<div class="b-row b-stack"><span class="cfg-label" id="cfg-theme">Hell / Dunkel</span>
  <div class="seg b-seg" role="radiogroup" aria-labelledby="cfg-theme">${[['auto', 'Auto'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, l]) => `<button type="button" role="radio" data-view="theme" data-val="${v}">${l}</button>`).join('')}</div></div>`
  + NOTE('Gilt für die Bedienung; die Szene bleibt dunkel wie im Mikroskop. Auto folgt dem System.');
// Stufen als Kacheln (Reiter Qualität): Zielgerät, was die Stufe weglässt, Balken = Rechenlast; Auto zeigt die gerade gewählte Stufe
const TIER = { eco: ['ohne Grafikkarte', 'Auflösung 50&nbsp;%<br>Effekte aus'], light: ['ältere Laptops', 'Auflösung 75&nbsp;%<br>ohne Linse'],
  medium: ['Laptop mit Grafik', 'Linse, Schatten'], fine: ['Grafikkarte', 'volle Auflösung<br>alle Effekte'] };
const tile = (val, name, who, what, cost) => `<button type="button" role="radio" class="q-tile" data-key="quality" data-val="${val}">
  <b>${name}</b><span>${who}</span><span class="q-what">${what}</span>${cost ? `<span class="q-cost" aria-label="Rechenlast ${cost} von ${QUALITY.length}">${QUALITY.map((_, i) => `<i${i < cost ? ' class="on"' : ''}></i>`).join('')}</span>` : ''}</button>`;
const TILES = `<div class="q-tiles" role="radiogroup" aria-label="Qualitätsstufe">${tile('auto', 'Auto', 'misst und passt an', 'jetzt: <span data-qnow></span>', 0)}`
  + `${QUALITY.map((q, i) => tile(String(i), q.name, ...TIER[q.id], i + 1)).join('')}</div>`;
const METER = `<div class="cfg-meter"><span data-meter>–</span><svg class="cfg-spark" viewBox="0 0 96 24" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="15.3" x2="96" y2="15.3"/><polyline points=""/></svg></div>`
  + '<p class="cfg-note lay-hint" data-qhint></p>';
const Q_GROUPS = [
  { id: 'tier', icon: 'perf', title: 'Stufe wählen', rows: [['@quality', TILES]] },
  { id: 'perf', icon: 'perf', title: 'Messung und Feinregler', rows: [['', METER], ['detail', RNG('detail', 'Detailgrad (Nanoporen, Atome)', 0.05)],
    ['shadow', SEG('shadow', 'Schatten (ab Stufe Mittel)', [['off', 'Aus'], ['soft', 'Weich'], ['full', 'Voll']])],
    ['scale', SEG('scale', 'Renderskala', [['0.5', '50 %'], ['0.75', '75 %'], ['1', '100 %']])],
    ['fps', SEG('fps', 'Bildrate höchstens', [['0', 'Frei'], ['60', '60'], ['30', '30']]) + NOTE('30 Bilder/s spart am Laptop Strom und Lüfter.')]] },
];
const GROUPS = [
  { id: 'look', icon: 'look', title: 'Look', hero: true, rows: [['grade', LOOKS], ['exposure', RNG('exposure', 'Belichtung', 0.05)],
    ['vig', RNG('vig', 'Vignette', 0.05, NEW)], ['bars', TOG('bars', 'Kinobalken 2,39:1', NEW)]] },
  { id: 'light', icon: 'light', title: 'Licht', rows: [['light', RNG('light', 'Lichtstärke (alle Lichter)', 0.05)], ['key', RNG('key', 'Hauptlicht', 0.1)],
    ['rim', RNG('rim', 'Gegenlicht', 0.1)], ['env', RNG('env', 'Umgebung und Reflexe', 0.1)],
    ['kelvin', RNG('kelvin', 'Farbtemperatur Hauptlicht', 100)], ['pool', RNG('pool', 'Lichtpool im Hintergrund', 0.1)
      + NOTE('REM-Ebenen 2–4 zeigen das Signal des Elektronendetektors, kein Licht: dort wirken nur Belichtung und Lichtpool.')]] },
  { id: 'cam', icon: 'cam', title: 'Kamera &amp; Bewegung', rows: [['motion', SEG('motion', 'Bewegung', [['full', 'Voll'], ['calm', 'Ruhig'], ['off', 'Aus']])
    + NOTE('Ruhig: keine Leerlauf-Fahrt, kein Orbit, Detektor steht · Aus: nichts bewegt sich von allein, Flüge kurz und ohne Zoom-Unschärfe.')],
  ['intro', TOG('intro', 'Auftakt-Bogen beim Start (9 s)')], ['cine', TOG('cine', 'Leerlauf-Fahrt nach 2,5 s Ruhe')],
  ['orbit', TOG('orbit', 'Auto-Orbit (Ebenen mit Drehteller)')], ['dive', RNG('dive', 'Flugdauer zwischen Ebenen', 0.5)],
  ['play', RNG('play', 'Pyrolyse-Zeitraffer (Raumtemperatur → Ziel)', 1)]] },
  { id: 'fx', icon: 'fx', title: 'Effekte', rows: [['fx', RNG('fx', 'Stärke (Tiefenunschärfe, Bloom, Farbsaum, Korn)', 0.05)],
    ['dof', TOG('dof', 'Tiefenunschärfe')], ['bloom', TOG('bloom', 'Bloom auf Glanzlichtern')], ['ca', TOG('ca', 'Farbsaum am Bildrand')],
    ['grain', TOG('grain', 'Filmkorn')], ['veil', TOG('veil', 'Lichtschleier beim Durchtauchen')], ['dust', TOG('dust', 'Schwebstaub im Hintergrund')]] },
  { id: 'sem', icon: 'sem', title: 'REM · Ebenen 2–4', half: true, rows: [['sem', TOG('sem', 'Detektor schwenkt')],
    ['charge', TOG('charge', 'Aufladung')]] },
  { id: 'mat', icon: 'mat', title: 'Material &amp; Optik', rows: [['coat', RNG('coat', 'Kohle-Glanz (Klarlack, Ebene 1)', 0.05, NEW)],
    ['edgeLight', RNG('edgeLight', 'Kantenlicht am Kohlestück', 0.1, NEW)], ['semEdge', RNG('semEdge', 'REM-Kanten (Ebenen 2–4)', 0.05, NEW)],
    ['semGrain', RNG('semGrain', 'REM-Korn (Ebenen 2–4)', 0.05, NEW)
      + NOTE('Höher = feineres Rauschen auf den Flächen, wie bei kurzer Belichtung im Mikroskop.')],
    ['atomCoat', RNG('atomCoat', 'Klarlack der Atome (Ebenen 6–7)', 0.05, NEW)], ['bloomThr', RNG('bloomThr', 'Bloom-Schwelle', 0.02, NEW)
      + NOTE('Niedriger = mehr helle Stellen leuchten nach; höher = nur Glanzlichter und Glut.')]] },
  { id: 'ui', icon: 'ui', title: 'Oberfläche', rows: [['@theme', VIEW_THEME], ['@panel', TOG('', 'Infotafel zeigen', '', 'data-view="panel"')],
    ['@overlays', TOG('', 'Messhilfen (Zonenbänder, Leitlinien, Visier)', '', 'data-view="overlays"')], ['hotspots', TOG('hotspots', 'Abzeichen (orange Hotspots)')]] },
];
// REM-Zeilen mit Erklärung (eigene Texte, damit die Schalter-Zeile kurz bleibt)
GROUPS[4].rows[0][1] += NOTE('Licht wandert über die Kanten wie beim Schwenk des Probentischs.');
GROUPS[4].rows[1][1] += NOTE('Helle Streifen, solange die Kohle schlecht leitet (unter ≈ 700 °C).');
const N_GLOBAL = GROUPS.reduce((n, g) => n + g.rows.length, 0), N_QUALITY = 5;   // Stufe + 4 Feinregler (Messzeile zählt nicht)
const CARD = (g) => { const n = g.rows.filter(([k]) => k).length; return `<article class="b-card${g.half ? '' : ' b-wide'}${g.hero ? ' b-card--hero' : ''}" data-g="${g.id}"><header class="b-head"><span class="b-plaque">${icon(g.icon)}</span><h4>${g.title}</h4><span class="b-count" aria-label="${n} Einstellungen">${n}</span></header>${g.rows.map(([k, h]) => ROW(k, h)).join('')}</article>`; };

// Titelzeile (Vorschau Kosmos 26.10.2026 Zahnrad:C): „Einstellungen“ klein, darunter groß der Name der Ebene bzw. „Alle Ebenen“,
// rechts der kleine Schalter Ebene n | Global
const HTML = `<div class="cfg-head"><div class="cfg-titles"><h2 class="cfg-title" id="cfg-title">Einstellungen</h2>
    <p class="cfg-name"><span data-name="lv"></span><span data-name="gl">Alle Ebenen</span><span data-name="q">Darstellung &amp; Leistung</span></p></div>
  <div class="cfg-tabs" role="tablist" aria-label="Geltungsbereich">
    <button type="button" role="tab" id="cfg-tab-lv" data-tab="lv" aria-controls="cfg-level"></button>
    <button type="button" role="tab" id="cfg-tab-gl" data-tab="gl" aria-controls="cfg-global">Global<span class="b-count">${N_GLOBAL}</span></button>
    <button type="button" role="tab" id="cfg-tab-q" data-tab="q" aria-controls="cfg-quality">Qualität<span class="b-count">${N_QUALITY}</span></button>
  </div><button type="button" class="cfg-x" data-close aria-label="Einstellungen schließen">×</button></div>
  <div class="cfg-pane l-pane" id="cfg-level" role="tabpanel" aria-labelledby="cfg-tab-lv"></div>
  <div class="cfg-pane" id="cfg-global" role="tabpanel" aria-labelledby="cfg-tab-gl">${MINI_DEFS}
    ${navHtml(GROUPS.map((g) => ({ id: g.id, title: g.title.replace(' &amp; Bewegung', '').replace(' &amp; Optik', '').replace(' · Ebenen 2–4', ''), icon: g.icon, n: g.rows.length })))}
    <div class="b-main">${devBar()}<div class="bento">${GROUPS.map(CARD).join('')}</div></div>
  </div>
  <div class="cfg-pane q-pane" id="cfg-quality" role="tabpanel" aria-labelledby="cfg-tab-q">
    <div class="b-main">${Q_GROUPS.map(CARD).join('')}</div>
  </div>
  <p class="cfg-note cfg-foot">Gespeichert in diesem Browser</p>`;

// Zahnrad oben rechts (.top-actions), Panel in .cfg-dock (index.html); Esc, × oder Klick außerhalb schließt; Messzeile alle 500 ms.
// pixels() = gerenderte Bildpunkte des Hauptbilds (Messzeile); relayout() nach Ein-/Ausblenden der Infotafel (Bühne ändert die Breite)
const OV_KEY = 'biochar.overlays';
export function mountSettings(pixels, relayout) {
  const btn = document.getElementById('btn-cfg'), box = document.getElementById('cfg');
  if (!btn || !box) return;
  // Messhilfen (Zonenbänder, Leitlinien, Visier): Zustand als body.overlays-off, gemerkt in localStorage
  let overlays = true;
  try { const s = localStorage.getItem(OV_KEY); if (s !== null) overlays = s !== '0'; } catch { /* Standard: an */ }
  document.body.classList.toggle('overlays-off', !overlays);
  const panelOn = () => !document.body.classList.contains('panel-collapsed');
  const view = {
    theme: (v) => setTheme(v),
    panel: (on) => { if (on !== panelOn()) { document.body.classList.toggle('panel-collapsed', !on); relayout?.(); } },
    overlays: (on) => {
      overlays = on;
      document.body.classList.toggle('overlays-off', !overlays);
      try { localStorage.setItem(OV_KEY, overlays ? '1' : '0'); } catch { /* ignorieren */ }
    },
  };
  // Abweichung vom Standard je Zeile; '@…' = Ansicht und Qualität außerhalb von settings.S
  const isDev = (k) => (k === '@theme' ? theme() !== 'auto' : k === '@panel' ? !panelOn() : k === '@overlays' ? !overlays
    : k === '@quality' ? !quality.isAuto() : S[k] !== DEF[k]);
  btn.innerHTML = COG;
  box.innerHTML = HTML;
  const glob = box.querySelector('#cfg-global'), qual = box.querySelector('#cfg-quality');
  const panes = [glob, qual], all = (sel) => panes.flatMap((p) => [...p.querySelectorAll(sel)]);
  wireNav(glob);
  const tabs = [...box.querySelectorAll('[role=tab]')];
  const pick = (tab, focus) => tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    box.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    box.querySelector(`[data-name="${t.dataset.tab}"]`).hidden = !on;
    if (on && focus) t.focus();
  });
  box.querySelector('.cfg-tabs').addEventListener('click', (e) => { const t = e.target.closest('[role=tab]'); if (t) { pick(t); syncLayers(); spyLayers(); } });
  box.querySelector('.cfg-tabs').addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    pick(tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
    syncLayers();
    spyLayers();
  });
  pick(tabs[Math.max(0, ['level', 'global', 'quality'].indexOf(new URLSearchParams(location.search).get('cfg')))]);
  mountLayers({ gear: box.querySelector('#cfg-level'), head: box.querySelector('#cfg-tab-lv'), name: box.querySelector('[data-name="lv"]') });

  const sync = () => {
    all('[data-key][data-val]').forEach((b) => {
      const k = b.dataset.key;
      const on = k === 'quality' ? (quality.isAuto() ? b.dataset.val === 'auto' : b.dataset.val === String(quality.index())) : String(S[k]) === b.dataset.val;
      b.setAttribute('aria-checked', String(on));
    });
    glob.querySelectorAll('[data-view="theme"]').forEach((b) => b.setAttribute('aria-checked', String(theme() === b.dataset.val)));
    glob.querySelector('input[data-view="panel"]').checked = panelOn();
    glob.querySelector('input[data-view="overlays"]').checked = overlays;
    all('input[type=checkbox][data-key]').forEach((i) => { i.checked = !!S[i.dataset.key]; });
    all('input[type=range][data-key]').forEach((i) => {
      const k = i.dataset.key;
      if (document.activeElement !== i) i.value = S[k];
      box.querySelector(`[data-out="${k}"]`).textContent = OUT[k](S[k]);
    });
    qual.querySelector('[data-qnow]').textContent = quality.get().name;
    qual.querySelector('[data-qhint]').textContent = quality.isAuto()
      ? `Auto misst die Bildzeit und passt die Stufe an · jetzt ${quality.get().name}`
      : 'Feste Stufe · Auto misst selbst und schaltet bei Bedarf';
    panes.forEach((p) => markDevs(p, isDev));
  };
  // Messzeile: Bildabstand ⌀ (EMA), daraus Bilder/s, Bildpunkte; Kurve = letzte 60 Bildabstände (0–50 ms, Strich = 16,7 ms)
  const meter = () => {
    if (qual.hidden) return;
    const m = qual.querySelector('[data-meter]');
    const mp = pixels() / 1e6;
    m.textContent = stat.ms ? `⌀ ${num(stat.ms, 1)} ms · ${num(1000 / stat.ms)} Bilder/s · ${num(mp, 1)} MP` : `– ms · ${num(mp, 1)} MP`;
    const n = stat.log.length, pts = [];
    for (let j = 0; j < n; j++) {
      const v = stat.log[(stat.i + j) % n];
      pts.push(`${((j / (n - 1)) * 96).toFixed(1)},${(23 - Math.min(23, (v / 50) * 23)).toFixed(1)}`);
    }
    qual.querySelector('polyline').setAttribute('points', pts.join(' '));
  };
  let timer = 0;
  const open = (o) => {
    box.hidden = !o;
    document.body.classList.toggle('cfg-open', o);   // Ebenen-Titel weicht dem offenen Zahnrad
    btn.setAttribute('aria-expanded', String(o));
    clearInterval(timer);
    timer = 0;
    if (o) { sync(); syncLayers(); spyLayers(); meter(); box.focus({ preventScroll: true }); timer = setInterval(meter, 500); }
  };
  btn.addEventListener('click', () => open(box.hidden));
  const resetAll = () => {
    settings.reset();
    view.theme('auto');
    view.panel(true);
    view.overlays(true);
  };
  box.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { open(false); btn.focus(); return; }
    if (!panes.some((p) => p.contains(e.target))) return;
    const r = e.target.closest('[data-reset]');
    if (r) {
      const k = r.dataset.reset;
      if (k === '*') resetAll();
      else if (k === '@theme') view.theme('auto');
      else if (k === '@panel') view.panel(true);
      else if (k === '@overlays') view.overlays(true);
      else if (k === '@quality') quality.setAuto();
      else set({ [k]: DEF[k] });
      sync();
      return;
    }
    const v = e.target.closest('button[data-view]');
    if (v) { view[v.dataset.view](v.dataset.val); sync(); return; }
    const b = e.target.closest('[data-key][data-val]');
    if (!b) return;
    const k = b.dataset.key, val = b.dataset.val;
    if (k === 'quality') { if (val === 'auto') quality.setAuto(); else quality.set(+val); sync(); }
    else if (k === 'motion') set({ motion: val, ...MOT[val] });
    else set({ [k]: typeof DEF[k] === 'number' ? +val : val });
  });
  const onInput = (e) => {
    const el = e.target;
    if (el.matches('input[data-view]')) { view[el.dataset.view](el.checked); sync(); return; }
    if (!el.dataset.key) return;
    set({ [el.dataset.key]: el.type === 'checkbox' ? el.checked : +el.value });
  };
  panes.forEach((p) => p.addEventListener('input', onInput));
  // Tasten im Panel nicht an die Seite weiterreichen (Esc = Ebene zurück, 1–7 = Ebene)
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { open(false); btn.focus(); }
  });
  document.addEventListener('pointerdown', (e) => { if (!box.hidden && !box.contains(e.target) && !btn.contains(e.target)) open(false); });
  subs.push(() => { if (!box.hidden) sync(); });
  quality.onChange(() => { if (!box.hidden) sync(); });
  if (new URLSearchParams(location.search).has('cfg')) open(true);   // Screenshots: Zahnrad offen
}
