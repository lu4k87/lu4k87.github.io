// Allgemeine Einstellungen = gilt an allen Stationen; Station = nur diese Station (Inhalt in layers.js). Beide als Panel links am
// Rand (#cfg, #station; Vorschau 28.10.2026 „Station-Panel links am Rand“ Menü:C und „Einstellungs-Knöpfe unten links“ Dock:B),
// immer nur eins offen, auf/zu über die Knöpfe unten links (#btn-cfg, #btn-lay), ✕ oder Esc. Allgemein: die Gruppen als quadratische
// Kacheln mit Icon oben, darunter nur die gewählte Gruppe (User 28.10.2026); Fuß mit Geltung und „Alle zurücksetzen“.
// Mini-Grafik je Zeile, geänderte Werte mit ↺ am Zeilenende. Regel (User 28.10.2026): hier steht jeder Wert, der für alle Stationen
// gemeinsam gilt – auch wenn er nur an einem Teil der Stationen wirkt (Himmel, Milchstraße, Licht und Schatten, Planeten,
// Linsenreflex). Zeilen ohne Wirkung an der aktuellen Station: ausgegraut, gesperrt, Hinweis „Wirkt hier nicht · nur …“ (WHERE,
// applyNA). Das Panel Station zeigt nur Werte, die je Station gespeichert sind (layers.js).
// `?cfg` (auch `?cfg=global`) zeigt die Einstellungen, `?cfg=lay` das Panel Station.
// Gespeichert in localStorage `kosmos.settings.v1`; clean() prüft jeden Wert, damit kaputte Einträge nichts stören.

import { mountLayers, rebuildLayers, refreshLayers, devLine, devBar, markDevs, paintRange, icon, pickHtml, pickOf, showPick } from './layers.js';
import { nbsp } from './figs.js';
import { SOLAR_SYSTEM } from './content.js';

const KEY = 'kosmos.settings.v1';
const DEFAULTS = { motion: 'full', quality: 'auto', cine: true, dive: 3.6, exposure: 1, bloom: true, lens: true, lensAmt: 1, lensOptic: 'master', lensGhost: true, ghostMotion: true, anamorphic: true, rayleigh: true, grain: true, deep: 1, fpsCap: 0, panel: true, timeline: true, scaleCompare: true, small: 6, stars: true, grade: 'station', vig: 1, bars: false, barsH: 1, axes: false,
  sunK: 1, shade: 1, shadow: 1, soft: 1, spec: 1, gloss: 0, cursor: 'orbit', cursorAll: 'scene' };
// Farblook: Belichtung, Bloom, Kontrast, Sättigung, Tönung Schatten/Lichter, Vignette – Kino = Mischung aus HDR, Ruhig, Tiefe Glut.
// Global (main.js über globalGrade) oder je Station „Station“ = eigener Look; die Sonne wählt bei „Station“ selbst (levels/sun.js)
export const GRADES = [['Neutral', { exposure: 1, bloom: 0.12, con: 0.12, sat: 1.04, sh: [0.96, 0.99, 1.06], hi: [1.04, 1, 0.95], vig: 0.38 }],
  ['Kino', { exposure: 1.05, bloom: 0.24, con: 0.25, sat: 1.12, sh: [0.88, 0.93, 1.06], hi: [1.1, 0.99, 0.86], vig: 0.55 }],
  ['Kino-HDR', { exposure: 1.15, bloom: 0.22, con: 0.22, sat: 1.1, sh: [0.9, 0.96, 1.12], hi: [1.08, 1, 0.88], vig: 0.5 }],
  ['Ruhig', { exposure: 1, bloom: 0.16, con: 0.18, sat: 1, sh: [0.97, 0.98, 1.02], hi: [1.04, 1, 0.94], vig: 0.45 }],
  ['Tiefe Glut', { exposure: 0.9, bloom: 0.3, con: 0.3, sat: 1.18, sh: [0.85, 0.88, 0.98], hi: [1.12, 0.98, 0.84], vig: 0.6 }]];
const GRADE_IDS = ['station', 'neutral', 'kino', 'hdr', 'ruhig', 'glut'];
// Mauszeiger über der Szene (cursor.js), „System“ = eigener Zeiger aus
const CURSORS = [['system', 'System'], ['orbit', 'Orbit-Ring'], ['seeker', 'Peil-Sucher'], ['comet', 'Komet'], ['hex', 'Hex-Sonde'], ['label', 'Aktions-Etikett']];
const CHOICES = { motion: ['full', 'calm', 'off'], quality: ['auto', '1', '2', '3'], grade: GRADE_IDS, lensOptic: ['master', 'classic'], cursor: CURSORS.map(([id]) => id), cursorAll: ['scene', 'all'] };
// Milchstraße (milkyway.js): Bild-Regler wirken sofort, „Dicke der Scheibe“ und Nachbargalaxien backen das Modell neu
const MW = { mw: true, mwSrc: 'model', mwGain: 1, mwCon: 1, mwBlack: 0, mwClar: 1, mwSat: 1, mwTemp: 0, mwDust: 1, mwNeb: 1, mwCore: 1, mwGlow: 1, mwGrain: 0.5, mwWidth: 1, mwNear: true };
const MW_RANGE = { mwGain: [0, 6], mwCon: [0.5, 3], mwBlack: [0, 1], mwClar: [0, 4], mwSat: [0, 3], mwTemp: [-1, 1], mwDust: [0, 4], mwNeb: [0, 6], mwCore: [0, 6], mwGlow: [0, 6], mwGrain: [0, 1], mwWidth: [0.4, 3] };
// Licht und Schatten (planetfx.js uLook/uLook2) – Grenzen wie die Regler
const LIGHT_RANGE = { sunK: [0.25, 4], shade: [0, 8], shadow: [0, 1], soft: [0, 4], spec: [0, 6], gloss: [0, 4] };
// Stil = abgestimmte Werte der Bild-Regler, danach frei einstellbar; markiert nur, solange alle Werte passen („Astrofoto“ = Standard)
const MW_STYLES = [['auge', 'Auge', { mwGain: 0.6, mwCon: 0.9, mwBlack: 0.1, mwClar: 0.6, mwSat: 0.35, mwTemp: 0, mwDust: 0.8, mwNeb: 0.15, mwCore: 0.6, mwGlow: 0.5, mwGrain: 0.2 }],
  ['foto', 'Astrofoto', { mwGain: 1, mwCon: 1, mwBlack: 0, mwClar: 1, mwSat: 1, mwTemp: 0, mwDust: 1, mwNeb: 1, mwCore: 1, mwGlow: 1, mwGrain: 0.5 }],
  ['kino', 'Kino', { mwGain: 1.3, mwCon: 1.25, mwBlack: 0.1, mwClar: 1.4, mwSat: 1.3, mwTemp: 0.25, mwDust: 1.25, mwNeb: 1.6, mwCore: 1.5, mwGlow: 1.6, mwGrain: 0.5 }],
  ['dezent', 'Dezent', { mwGain: 0.45, mwCon: 0.9, mwBlack: 0.15, mwClar: 0.8, mwSat: 0.7, mwTemp: -0.1, mwDust: 0.9, mwNeb: 0.5, mwCore: 0.6, mwGlow: 0.6, mwGrain: 0.3 }]];
Object.assign(DEFAULTS, MW);
CHOICES.mwSrc = ['model', 'photo'];
const mwStyleOn = (S, id) => Object.entries(MW_STYLES.find(([k]) => k === id)[2]).every(([k, v]) => Math.abs(S[k] - v) < 1e-6);
// Kamera (main.js): Blickwinkel, Dreh-/Zoomtempo und Nachlauf der Steuerung, Leerlauf-Fahrt, Kino-Effekte im Flug
const CAM = { fovK: 1, rotK: 1, zoomK: 1, inertia: 'normal', cineDelay: 3, cineK: 1, flyFx: 1 };
const CAM_RANGE = { fovK: [0.6, 1.6], rotK: [0.25, 3], zoomK: [0.25, 3], cineDelay: [1, 30], cineK: [0.25, 4], flyFx: [0, 2] };
Object.assign(DEFAULTS, CAM);
CHOICES.inertia = ['short', 'normal', 'long'];

function clean(raw) {
  const S = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return S;
  for (const k of Object.keys(DEFAULTS)) {
    const v = raw[k], d = DEFAULTS[k];
    if (CHOICES[k]) { if (CHOICES[k].includes(v)) S[k] = v; }
    else if (typeof d === 'boolean') { if (typeof v === 'boolean') S[k] = v; }
    else if (typeof v === 'number' && Number.isFinite(v)) S[k] = v;
  }
  S.dive = Math.min(15, Math.max(1, S.dive));
  S.exposure = Math.min(4, Math.max(0.25, S.exposure));
  S.small = Math.min(12, Math.max(1, S.small));
  S.deep = Math.min(4, Math.max(0, S.deep));
  S.vig = Math.min(3, Math.max(0, S.vig));
  S.barsH = Math.min(2, Math.max(0.5, S.barsH));
  S.lensAmt = Math.min(5, Math.max(0, S.lensAmt));
  if (![0, 30, 60].includes(S.fpsCap)) S.fpsCap = 0;
  for (const [k, [lo, hi]] of Object.entries({ ...MW_RANGE, ...LIGHT_RANGE, ...CAM_RANGE })) S[k] = Math.min(hi, Math.max(lo, S[k]));
  return S;
}

function load() {
  try { return clean(JSON.parse(localStorage.getItem(KEY))); } catch { return clean(null); }
}

export const settings = { S: load() };
// globaler Farblook oder null (= jede Station ihr eigener Look)
export const globalGrade = () => (settings.S.grade === 'station' ? null : GRADES[GRADE_IDS.indexOf(settings.S.grade) - 1][1]);
const listeners = [];
// Ergebnis: Abmeldung – Stationen rufen sie beim Freigeben, sonst hält der Listener die alte Szene im Speicher
export function onSettings(fn) {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
}
// Regler „Höhe der Kinobalken“ zeigt die Balken beim Ziehen kurz an, auch wenn der Kino-Modus aus ist (main.js)
let peekT = -1e9;
export const barsPeek = () => performance.now() - peekT < 1500;
// Sternhimmel (Katalog und statistisch) folgt dem globalen Schalter „Sternhimmel“; schaltet nur die Kinder,
// damit Stationen die Gruppe selbst weiter ein- und ausblenden können
export function followStars(group) {
  const apply = () => group.children.forEach((c) => { c.visible = settings.S.stars; });
  apply();
  const off = onSettings((keys) => { if (keys.includes('stars')) apply(); });
  const first = group.children[0];   // Station gibt frei (traverse + dispose) → abmelden, wie deepsky.js
  if (first && first.geometry) first.geometry.addEventListener('dispose', off);
}

export function setSetting(key, value) {
  const next = clean({ ...settings.S, [key]: value });
  if (next[key] === settings.S[key]) return;
  settings.S = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* privates Fenster: nur für diese Sitzung */ }
  listeners.forEach((fn) => fn([key]));
}

// Bewegung der Info-Grafiken: gleicher Speicher wie cards.js figMotion (der Schalter in jeder Karte ist seit 28.10.2026 weg); ohne gemerkten Wert
// folgt sie „Bewegung“ und dem System
const FM_KEY = 'kosmos.figmotion.v1';
const reducedSys = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const figsOn = () => { let v = null; try { v = localStorage.getItem(FM_KEY); } catch { /* privat */ } return v ? v === 'on' : !(reducedSys() || settings.S.motion === 'off'); };
const setFigs = (on) => { try { localStorage.setItem(FM_KEY, on ? 'on' : 'off'); } catch { /* privat */ } };

// Auswahl (layers.js pickHtml): 2 Werte als Schalter, geordnete Stufen (ordered) als Rast-Regler, sonst Auswahlfeld
const PICK = (key, label, opts, ordered = false) => pickHtml(key, label, opts, { ordered, lid: `cfg-${key}` });
const TOG = (key, label, extra = '', attr = `data-key="${key}"`) => `
  <label class="b-row cfg-toggle"><span class="cfg-label">${label}${extra}</span><input type="checkbox" ${attr}><span class="switch" aria-hidden="true"></span></label>`;
const RANGE = (key, label, min, max, step, unit, extra = '') => `
  <label class="b-row b-stack"><span class="b-top"><span class="cfg-label">${label}${extra}</span><span class="cfg-val"><output data-out="${key}"></output> <span class="cfg-unit">${unit}</span></span></span>
    <span class="b-track"><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}"></span></label>`;
const NOTE = (text) => `<p class="cfg-note lay-hint">${nbsp(text)}</p>`;
// Zeile = Bedienung + Hinweis darunter + ↺ „Standard“ am Zeilenende (nur bei geändertem Wert); w = Wirkung (Schlüssel in WHERE):
// an Stationen ohne Wirkung ausgegraut und gesperrt, darunter der Hinweis cfg-na (applyNA)
const ROW = (key, html, w) => {
  if (key === '#') return html;
  const i = html.indexOf('<p class="cfg-note'), [ctl, note] = i < 0 ? [html, ''] : [html.slice(0, i), html.slice(i)];
  const label = (ctl.match(/class="cfg-label"[^>]*>([^<]+)/) || [])[1] || '';
  const na = w ? `<p class="cfg-na" hidden><b>Wirkt hier nicht</b> · nur ${nbsp(WHERE[w][1])}.</p>` : '';
  return `<div class="b-item"${w ? ` data-w="${w}"` : ''}>${ctl}${note}${na}${key ? devLine(key, label) : ''}</div>`;
};
// Farblook als Bild-Kacheln: Farben aus Tönung, Belichtung und Vignette des jeweiligen Looks; „Station“ = vier Looks im Kreis
const rgb = (b, t, e) => `rgb(${b.map((x, i) => Math.min(255, Math.round(x * t[i] * e))).join(',')})`;
const swatch = (g) => (g ? `background:radial-gradient(circle at 34% 62%, ${rgb([255, 236, 190], g.hi, g.exposure)} 0 9%, ${rgb([240, 140, 50], g.hi, g.exposure)} 22%, ${rgb([120, 40, 22], g.sh, g.exposure)} 46%, ${rgb([22, 26, 44], g.sh, g.exposure)} 78%);box-shadow:inset 0 0 ${Math.round(g.vig * 26)}px rgba(0,0,0,.85)`
  : 'background:conic-gradient(from 200deg at 50% 55%, #e88a3a 0 25%, #4e7bd6 0 50%, #9a62c9 0 75%, #3aa88a 0)');
const LOOKS = `<div class="b-row b-stack"><span class="cfg-label" id="cfg-grade">Farblook</span>
  <div class="b-looks" role="radiogroup" aria-labelledby="cfg-grade">${GRADE_IDS.map((id, i) => `<button type="button" role="radio" data-key="grade" data-val="${id}"><span class="b-sw" style="${swatch(i ? GRADES[i - 1][1] : null)}"></span><span>${i ? GRADES[i - 1][0] : 'Je Station'}</span></button>`).join('')}</div></div>`
  + NOTE('„Je Station“ = jede Station behält ihren eigenen Look (die Sonne hat dafür einen eigenen Farblook); die anderen gelten überall.');
// Auswahlfeld wie PICK; passt kein Stil mehr zu den Reglern, steht „Eigene Werte“ darin
const MW_STYLE = `<div class="b-row b-pick"><span class="cfg-label" id="cfg-mwstyle">Stil</span><select class="b-select" data-mwstyle aria-labelledby="cfg-mwstyle">
  <option value="" hidden>Eigene Werte</option>${MW_STYLES.map(([id, l]) => `<option value="${id}">${l}</option>`).join('')}</select></div>`
  + NOTE('Setzt alle Regler der Milchstraße auf einen abgestimmten Look, danach frei einstellbar. „Astrofoto“ ist wie die Vorlage von ESO.');
// Zwischenüberschrift in einer Gruppe; zählt nicht als Einstellung
const SUB = (t) => ['#', `<h5 class="b-subh">${t}</h5>`];
const nRows = (g) => g.rows.filter(([k]) => k !== '#').length;
// ---------- Wirkung je Zeile ----------
// Stationen, an denen eine Zeile etwas ändert (Stand 28.10.2026); Zeile ohne Wirkungs-Schlüssel wirkt an jeder Station
const NEAR_EARTH = ['earth', 'iss', 'tiangong', 'hubble', 'jwst', 'euclid', 'roman'];   // Ozean + Lufthülle (EARTH_FRAG, ATMO_FRAG)
const BODIES = SOLAR_SYSTEM.filter((id) => id !== 'sun');   // Planeten und Monde mit spinAxis (axes.js)
const SYMBOLS = ['earth', 'solar'];   // Satelliten (sats.js), Asteroiden (levels/solar.js)
// createFlare (flare.js), auch über orbitview, l2view, uranusmoon, createMarsMoon; die Sonne hat eigene Optik-Ebenen (levels/sun.js)
const FLARE = ['earth', 'moon', 'solar', 'sun', 'io', 'europa', 'triton', 'phobos', 'deimos', 'asteroid', 'miranda', 'iss', 'tiangong', 'hubble', 'jwst', 'euclid', 'roman'];
const FLARE_NOSUN = FLARE.filter((id) => id !== 'sun');
// Milchstraßenband am Himmel (createStarfield, band > 0): Sonnensystem und Stationen in der Milchstraße
const MILKY = [...SOLAR_SYSTEM, 'asteroid', 'orion', 'crab', 'pulsar', 'pillars', 'butterfly', 'spider', 'tornado'];
// Stationen des Tiefen Himmels meldet deepsky.js (Tabelle DEEP) – kein Import von dort, sonst Kreis settings ↔ deepsky
let deepAt = [];
export function setDeepAt(ids) { deepAt = ids; }
// [Stationen, Ort im Hinweis „Wirkt hier nicht · nur …“]
const WHERE = {
  solar: [SOLAR_SYSTEM, 'an Stationen im Sonnensystem'],
  near: [NEAR_EARTH, 'an der Erde und den Stationen in ihrer Nähe (ISS, Weltraumteleskope)'],
  bodies: [BODIES, 'an Stationen mit Planeten und Monden'],
  sym: [SYMBOLS, 'an der Erde (Satelliten) und im Sonnensystem (Asteroiden)'],
  flare: [FLARE, 'an Stationen mit der Sonne im Bild'],
  flareNs: [FLARE_NOSUN, 'an Stationen mit der Sonne im Bild; die Sonne selbst hat eine eigene Optik'],
  sky: [() => [...MILKY, ...deepAt], 'an Stationen mit Sternhimmel'],
  deep: [() => deepAt, 'an Stationen mit Tiefem Himmel'],
  mw: [MILKY, 'an Stationen mit dem Band der Milchstraße am Himmel'],
};
const atOf = (x) => (typeof x === 'function' ? x() : x);
// Reihenfolge: was im Bild ist (Bild, Himmel, Licht, Planeten), dann Bedienung
const GROUPS = [
  { id: 'look', icon: 'look', title: 'Bild', hero: true, rows: [['grade', LOOKS], ['exposure', RANGE('exposure', 'Belichtung', 0.25, 4, 0.05, '×')],
    ['vig', RANGE('vig', 'Vignette', 0, 3, 0.05, '×')], ['bars', TOG('bars', 'Kinobalken 2,39:1')],
    ['barsH', RANGE('barsH', 'Höhe der Kinobalken', 0.5, 2, 0.05, '×') + NOTE('1× = Kinoformat 2,39:1. Beim Ziehen sind die Balken kurz zu sehen.')]] },
  { id: 'sky', icon: 'sky', title: 'Himmel', rows: [
    ['stars', TOG('stars', 'Sternhimmel') + NOTE('Hauptschalter für Sterne, Milchstraße und Tiefen Himmel: aus = reines Schwarz.'), 'sky'],
    ['deep', RANGE('deep', 'Tiefer Himmel', 0, 4, 0.1, '×') + NOTE('Was eine Langzeitbelichtung hinter den Sternen sieht: ferne Galaxien und schwach leuchtender Staub der Milchstraße (Zirrus) – statistisch verteilt, überhöht, mit bloßem Auge unsichtbar. 0× = reines Schwarz.'), 'deep'],
    SUB('Milchstraße'),
    ['mw', TOG('mw', 'Milchstraße zeigen') + NOTE('Nur das Band der Milchstraße am Himmel.'), 'mw'],
    ['mwNear', TOG('mwNear', 'Magellansche Wolken und Andromeda'), 'mw'],
    ['mwSrc', PICK('mwSrc', 'Quelle der Milchstraße', [['model', 'Eigenes Modell'], ['photo', 'ESO-Foto']]) + NOTE('Das Foto (ESO/S. Brunier, CC BY 4.0) war die Vorlage und dient nur zum Vergleich – nur im Sonnensystem, wo die Lage am Himmel stimmt.'), 'solar'],
    SUB('Milchstraße · Aussehen'), ['', MW_STYLE, 'mw'],
    ['mwGain', RANGE('mwGain', 'Helligkeit', 0, 6, 0.05, '×'), 'mw'], ['mwCon', RANGE('mwCon', 'Kontrast', 0.5, 3, 0.05, '×'), 'mw'],
    ['mwBlack', RANGE('mwBlack', 'Schwarzpunkt', 0, 1, 0.05, '') + NOTE('Schneidet die schwachen Ränder des Bandes ab – der Himmel daneben wird dunkler.'), 'mw'],
    ['mwClar', RANGE('mwClar', 'Struktur', 0, 4, 0.05, '×') + NOTE('Lokaler Kontrast: hebt Sternwolken und Staubkanten gegen ihre Umgebung ab.'), 'mw'],
    ['mwSat', RANGE('mwSat', 'Sättigung', 0, 3, 0.05, '×'), 'mw'],
    ['mwTemp', RANGE('mwTemp', 'Farbtemperatur', -1, 1, 0.05, '') + NOTE('Minus = kühler, bläulich · plus = wärmer, golden.'), 'mw'],
    SUB('Milchstraße · Aufbau'),
    ['mwDust', RANGE('mwDust', 'Staubbahnen', 0, 4, 0.05, '×') + NOTE('Dunkelwolken vor dem Sternlicht: Großer Riss, Pfeifennebel, Kohlensack. 0× = Sterne ohne Staub.'), 'mw'],
    ['mwNeb', RANGE('mwNeb', 'Leuchtnebel (Hα)', 0, 6, 0.05, '×') + NOTE('Rot leuchtender Wasserstoff: Carina, Lagune, Nordamerika, Barnards Loop.'), 'mw'],
    ['mwCore', RANGE('mwCore', 'Kern (Bulge)', 0, 6, 0.05, '×'), 'mw'], ['mwGlow', RANGE('mwGlow', 'Leuchten des Bandes', 0, 6, 0.05, '×'), 'mw'],
    ['mwGrain', RANGE('mwGrain', 'Einzelsterne im Band', 0, 1, 0.05, '') + NOTE('Anteil des Bandes als einzelne feine Sterne statt Nebel – am deutlichsten beim Hineinzoomen.'), 'mw'],
    ['mwWidth', RANGE('mwWidth', 'Dicke der Scheibe', 0.4, 3, 0.05, '×') + NOTE('Höhe von Sternen und Staub über der Ebene; das Modell wird neu berechnet.'), 'mw']] },
  { id: 'light', icon: 'sun', title: 'Licht &amp; Schatten', rows: [
    ['sunK', RANGE('sunK', 'Sonnenlicht', 0.25, 4, 0.05, '×') + NOTE('Stärke des direkten Sonnenlichts auf Planeten und Monden.'), 'solar'],
    ['shade', RANGE('shade', 'Nachtseite aufhellen', 0, 8, 0.25, '×') + NOTE('Restlicht auf der Schattenseite (schon aufgehellt, echt fast schwarz). 0× = ganz dunkel.'), 'solar'],
    ['shadow', RANGE('shadow', 'Schatten', 0, 1, 0.05, '×') + NOTE('Ringschatten, Wolkenschatten, Mond- und Planetenschatten bei Finsternissen. 0× = keine, 1× = volle Stärke.'), 'solar'],
    ['soft', RANGE('soft', 'Weiche Schattengrenze', 0, 4, 0.1, '×') + NOTE('Wie weit die Lufthülle Licht über die Tag-Nacht-Grenze streut; 0× = harte Kante.'), 'solar'],
    ['spec', RANGE('spec', 'Spiegelung der Ozeane', 0, 6, 0.1, '×') + NOTE('Glanzlicht der Sonne auf dem Meer der Erde.'), 'near'],
    ['gloss', RANGE('gloss', 'Glanz der Oberflächen', 0, 4, 0.1, '×') + NOTE('Zusätzliches Glanzlicht auf Eis, Wolken und Gestein (künstlerisch). 0× = aus.'), 'solar'],
    ['rayleigh', TOG('rayleigh', 'Blaue Dämmerung am Erdrand (Rayleigh)'), 'near']] },
  { id: 'planets', icon: 'orbit', title: 'Planeten', rows: [
    ['axes', TOG('axes', 'Drehachsen der Planeten und Monde') + NOTE('Linie über Nord- und Südpol jedes Planeten und Mondes, neigt und dreht sich mit dem Körper. Nordpol eisblau, Südpol grau.'), 'bodies'],
    ['small', RANGE('small', 'Größe der Symbole', 1, 12, 0.5, '×') + NOTE('Satelliten, Trümmer und Asteroiden als vergrößerte Symbole – je größer, desto weniger Objekte (4× → jedes achte); 1× zeigt alle als Lichtpunkte.'), 'sym']] },
  { id: 'cam', icon: 'cam', title: 'Kamera &amp; Bewegung', rows: [['motion', PICK('motion', 'Bewegung', [['full', 'Voll'], ['calm', 'Ruhig'], ['off', 'Aus']], true) + NOTE('„Aus“ wirkt wie „Bewegung reduzieren“ im System: keine Fahrt von selbst, Wechsel als kurze Überblendung.')],
    SUB('Steuerung'),
    ['fovK', RANGE('fovK', 'Blickwinkel', 0.6, 1.6, 0.05, '×') + NOTE('Über 1× zeigt mehr vom Raum wie ein Weitwinkel, unter 1× rückt die Szene heran wie ein Teleobjektiv.')],
    ['rotK', RANGE('rotK', 'Drehtempo', 0.25, 3, 0.05, '×') + NOTE('Wie weit die Kamera beim Ziehen mit Maus oder Finger dreht.')],
    ['zoomK', RANGE('zoomK', 'Zoomtempo', 0.25, 3, 0.05, '×') + NOTE('Mausrad und Zoom mit zwei Fingern.')],
    ['inertia', PICK('inertia', 'Nachlauf', [['short', 'Kurz'], ['normal', 'Normal'], ['long', 'Lang']], true) + NOTE('Wie lange die Kamera nach dem Loslassen weitergleitet.')],
    SUB('Leerlauf-Fahrt'),
    ['cine', TOG('cine', 'Kamerafahrt im Leerlauf')],
    ['cineDelay', RANGE('cineDelay', 'Start nach', 1, 30, 1, 's') + NOTE('Zeit ohne Eingabe, bis die Fahrt einsetzt.')],
    ['cineK', RANGE('cineK', 'Tempo der Fahrt', 0.25, 4, 0.05, '×')],
    SUB('Flug zwischen Stationen'),
    ['dive', RANGE('dive', 'Flugdauer', 1, 15, 0.1, 's')],
    ['flyFx', RANGE('flyFx', 'Kino-Effekte im Flug', 0, 2, 0.05, '×') + NOTE('Blickwinkel weitet sich im schnellsten Teil, die Kamera neigt sich in die Kurve, der Rand dunkelt ab. 0× = ruhige Fahrt.')]] },
  { id: 'fx', icon: 'fx', title: 'Effekte', rows: [
    ['bloom', TOG('bloom', 'Überstrahlen (Bloom)')], ['grain', TOG('grain', 'Filmkorn')],
    SUB('Linsenreflex'),
    ['lens', TOG('lens', 'Linsenreflex zeigen') + NOTE('Hauptschalter für Schein, Ring und Geisterbilder um die Sonne.'), 'flare'],
    ['lensAmt', RANGE('lensAmt', 'Stärke Linsenreflex', 0, 5, 0.05, '×') + NOTE('0× = aus.'), 'flare'],
    ['lensOptic', PICK('lensOptic', 'Art der Optik', [['master', 'Filmkamera'], ['classic', 'Schlicht']]) + NOTE('Filmkamera: Regenbogenring, heller Bogen und ein farbiger Lichtfleck gegenüber der Sonne. Schlicht: nur ein zarter Lichtkranz.'), 'flareNs'],
    ['lensGhost', TOG('lensGhost', 'Farbiger Lichtfleck (Geisterbild)'), 'flareNs'],
    ['ghostMotion', TOG('ghostMotion', 'Lichtfleck wandert beim Schwenken') + NOTE('Wie in einem echten Objektiv wandert der Fleck beim Schwenken auf der Linie durch die Bildmitte.'), 'flareNs'],
    ['anamorphic', TOG('anamorphic', 'Waagrechter Lichtstreif (anamorph)'), 'flare']] },
  { id: 'ui', icon: 'ui', title: 'Oberfläche', half: true, rows: [['panel', TOG('panel', 'Infotafel zeigen')], ['scaleCompare', TOG('scaleCompare', 'Maßstabs-Vergleich')], ['timeline', TOG('timeline', 'Zeitleiste der Station zeigen')],
    ['', TOG('', 'Grafiken bewegt', '', 'data-figs')],
    ['cursor', PICK('cursor', 'Mauszeiger', CURSORS) + NOTE('Nur mit Maus oder Touchpad. Bei Bewegung „Ruhig“ oder „Aus“ ohne Umlauf und Schweif.')],
    ['cursorAll', PICK('cursorAll', 'Mauszeiger gilt', [['scene', 'Nur Szene'], ['all', 'Überall']]) + NOTE('„Nur Szene“: über Panels und Suche der Zeiger des Systems. „Überall“: auch dort, nur in Textfeldern bleibt die Schreibmarke. Wirkt nicht bei Mauszeiger „System“.')]] },
  { id: 'perf', icon: 'perf', title: 'Leistung', rows: [['quality', PICK('quality', 'Qualität', [['auto', 'Auto'], ['1', 'Niedrig'], ['2', 'Mittel'], ['3', 'Hoch']], true)],
    ['fpsCap', PICK('fpsCap', 'Bildrate', [['0', 'Frei'], ['60', '60 Bilder/s'], ['30', '30 Bilder/s']], true) + NOTE('30 Bilder/s spart am Laptop Strom und Lüfter.')]] },
];
const N_GLOBAL = GROUPS.reduce((n, g) => n + nRows(g), 0);
// „Alle zurücksetzen“ der Einstellungen
const GLOBAL_KEYS = GROUPS.flatMap((g) => g.rows.map(([k]) => k)).filter((k) => k && k !== '#');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// Gruppen als quadratische Kacheln mit Icon (User 28.10.2026); darunter nur die gewählte Gruppe, Überschrift mit Zahl der Einstellungen
const JUMP = `<div class="cfg-jump" role="tablist" aria-label="Gruppen">${GROUPS.map((g, i) => `<button type="button" role="tab" class="cfg-tile" id="cfg-t${i}" data-jump="${i}" aria-controls="cfg-s${i}" aria-selected="false" tabindex="-1">${icon(g.icon, 'cfg-tile-ico')}<span>${g.title}</span></button>`).join('')}</div>`;
const CARD = (g, i) => `<section class="b-card b-fold b-sec" id="cfg-s${i}" role="tabpanel" data-g="${g.id}" data-fold="${i}" aria-labelledby="cfg-h${i}" hidden>
  <h4 class="b-sec-h"><span class="b-name" id="cfg-h${i}">${g.title}</span><span class="b-count">${plural(nRows(g), 'Einstellung', 'Einstellungen')}<span data-na-n></span></span></h4>
  <div class="b-body${g.half ? ' b-body--grid' : ''}" id="cfg-b${i}">${g.rows.map(([k, h, w]) => ROW(k, h, w)).join('')}</div></section>`;
// root = #cfg links am Rand, btn = Knopf „Allgemeine Einstellungen“, lay = Knopf „Station Einstellungen“ (beide unten links,
// Vorschau 28.10.2026 Dock:B), st = Panel Station links
export function mountSettings(root, btn, lay = document.getElementById('btn-lay'), st = document.getElementById('station')) {
  root.innerHTML = `
    <header class="st-head">
      ${btn.querySelector('svg').outerHTML.replace('<svg ', '<svg class="st-ico" ')}
      <h2 class="st-h" id="cfg-h"><span>Allgemeine Einstellungen</span><span class="st-n">gilt an allen Stationen</span></h2>
      <button type="button" class="icon-btn icon-btn--sm" id="btn-cfg-close" aria-label="Allgemeine Einstellungen schließen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
    </header>
    <div class="cfg-view" id="cfg-v-gl">
      ${JUMP}
      <div class="cfg-pane" id="cfg-global">
        <div class="b-main"><div class="b-list">${GROUPS.map(CARD).join('')}</div></div>
      </div>
      <div class="cfg-foot"><span class="cfg-scope">gilt an allen Stationen · ${N_GLOBAL} Einstellungen</span>${devBar()}</div>
    </div>`;
  const glob = root.querySelector('#cfg-global'), vGl = root.querySelector('#cfg-v-gl');
  let applyNA = () => {};
  const info = ({ title, n }) => {
    applyNA();   // Station gewechselt (layers.js render)
    st.querySelectorAll('[data-st-name]').forEach((e) => { e.textContent = title; });
    st.dataset.laySum = n ? plural(n, 'Einstellung', 'Einstellungen') : 'Keine Einstellungen';   // Gruppen zeigt die Leiste
    st.querySelector('[data-st-n]').textContent = st.dataset.laySum;
    if (lay) lay.setAttribute('aria-label', n ? `Einstellungen dieser Station: ${n}` : 'Einstellungen dieser Station');   // Zahl nur hier, nicht am Knopf (F1 nein)
  };
  mountLayers({ gear: st.querySelector('#cfg-station'), info, strip: document.getElementById('timeline'), stripOn: () => settings.S.timeline });
  const sync = () => {
    const S = settings.S;
    root.querySelectorAll('[data-key][data-val]').forEach((b) => b.setAttribute('aria-checked', String(String(S[b.dataset.key]) === b.dataset.val)));
    root.querySelectorAll('[data-pick]').forEach((el) => showPick(el, S[el.dataset.pick], DEFAULTS[el.dataset.pick]));
    const ms = root.querySelector('[data-mwstyle]');
    if (ms) ms.value = (MW_STYLES.find(([id]) => mwStyleOn(S, id)) || [''])[0];
    const f = root.querySelector('[data-figs]');
    if (f) f.checked = figsOn();
    root.querySelectorAll('input[type=checkbox][data-key]').forEach((i) => { i.checked = !!S[i.dataset.key]; });
    root.querySelectorAll('input[type=range][data-key]').forEach((i) => {
      i.value = S[i.dataset.key];
      root.querySelector(`[data-out="${i.dataset.key}"]`).textContent = String(S[i.dataset.key].toFixed((String(i.step).split('.')[1] || '').length || 1)).replace('.', ',');   // Stellen aus dem Schritt (0,25 → 2)
      paintRange(i, DEFAULTS[i.dataset.key]);
    });
    markDevs(root.querySelector('#cfg-v-gl'), (k) => S[k] !== DEFAULTS[k]);
  };
  const num = (k, v) => (typeof DEFAULTS[k] === 'number' ? +v : v);
  // Kacheln der Gruppen: genau eine Gruppe sichtbar; Kacheln und Fuß stehen, nur die Gruppe dazwischen scrollt
  const tiles = [...vGl.querySelectorAll('[data-jump]')];
  const pick = (i, focus = false) => {
    tiles.forEach((t, k) => { const on = k === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    glob.querySelectorAll('.b-fold').forEach((c) => { c.hidden = +c.dataset.fold !== i; });
    glob.scrollTop = 0;
    if (focus) tiles[i].focus();
  };
  pick(0);
  // Ausgrauen (User 28.10.2026): Zeile ohne Wirkung an der aktuellen Station gesperrt + Hinweis „Wirkt hier nicht · nur …“;
  // Kachel abgedimmt, wenn in ihrer Gruppe nichts wirkt; Überschrift nennt die Zahl (Vorschau 28.10.2026 Grau:A)
  applyNA = () => {
    const id = document.documentElement.dataset.station || 'earth';   // aktive Station (main.js activate), nicht der Hash
    vGl.querySelectorAll('.b-item[data-w]').forEach((it) => {
      const na = !atOf(WHERE[it.dataset.w][0]).includes(id);
      it.classList.toggle('is-na', na);
      it.querySelector('.cfg-na').hidden = !na;
      it.querySelectorAll('input, button, select').forEach((el) => { el.disabled = na; });
    });
    GROUPS.forEach((g, i) => {
      const sec = glob.querySelector(`#cfg-s${i}`), n = sec.querySelectorAll('.b-item.is-na').length, all = n === nRows(g);
      sec.querySelector('[data-na-n]').textContent = !n ? '' : all ? ' · keine wirkt hier' : ` · ${n} ${n === 1 ? 'wirkt' : 'wirken'} hier nicht`;
      tiles[i].classList.toggle('is-na', all);
      if (all) tiles[i].setAttribute('aria-description', 'wirkt an dieser Station nicht'); else tiles[i].removeAttribute('aria-description');
    });
  };
  applyNA();
  vGl.querySelector('.cfg-jump').addEventListener('keydown', (e) => {
    const t = e.target.closest('[data-jump]');
    if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();   // sonst fliegt main.js mit ←/→ zur Nachbarstation
    const k = tiles.indexOf(t), n = tiles.length;
    pick(e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (k + (e.key === 'ArrowRight' ? 1 : n - 1)) % n, true);
  });
  root.addEventListener('click', (e) => {
    const j = e.target.closest('[data-jump]');
    if (j && vGl.contains(j)) { pick(+j.dataset.jump); return; }
    // Auftakt-Film noch einmal (main.js): Zahnrad schließt, damit der Film frei steht
    if (e.target.closest('[data-auftakt]')) { open(false); window.dispatchEvent(new CustomEvent('kosmos:auftakt')); return; }
    const b = e.target.closest('[data-key][data-val]');
    if (b) setSetting(b.dataset.key, num(b.dataset.key, b.dataset.val));
    const r = e.target.closest('[data-reset]');
    if (r && vGl.contains(r)) for (const k of r.dataset.reset === '*' ? GLOBAL_KEYS : [r.dataset.reset]) setSetting(k, DEFAULTS[k]);
  });
  root.addEventListener('input', (e) => {
    const i = e.target;
    if (i.matches('[data-figs]')) { setFigs(i.checked); window.dispatchEvent(new CustomEvent('kosmos:figs')); return; }   // hud.js: offene Karte
    if (i.dataset.pick) { setSetting(i.dataset.pick, num(i.dataset.pick, pickOf(i))); return; }
    if (i.matches('[data-mwstyle]')) { if (i.value) for (const [k, v] of Object.entries(MW_STYLES.find(([id]) => id === i.value)[2])) setSetting(k, v); return; }
    if (!i.dataset.key) return;
    if (i.dataset.key === 'barsH') peekT = performance.now();
    setSetting(i.dataset.key, i.type === 'checkbox' ? i.checked : +i.value);
  });
  onSettings((keys) => { sync(); if (keys.includes('timeline')) rebuildLayers(); });
  sync();
  // Panel Station und Allgemeine Einstellungen stehen beide links am Rand (body.st-open / body.cfg-open, kosmos.css): immer nur
  // eins von beiden, die Infotafel rechts bleibt, wie sie ist (schmal weicht sie dem Panel)
  let view = false;
  const station = (on) => {
    if (on === !st.hidden) return;
    if (on && view) open(false);
    st.hidden = !on;
    document.body.classList.toggle('st-open', on);
    if (lay) lay.setAttribute('aria-expanded', String(on));
    if (on) refreshLayers();   // Werte, die die Station inzwischen geändert hat; Zeitachse braucht die sichtbare Breite
    window.dispatchEvent(new CustomEvent('kosmos:side', { detail: { view } }));   // hud.js: Szene neu einpassen
  };
  // view = 'gl' (Allgemeine Einstellungen offen) | false; 'lay' öffnet stattdessen das Panel Station
  const open = (v) => {
    if (v === 'lay') { station(true); return; }
    if (v) station(false);
    if (v !== view && v) glob.scrollTop = 0;
    view = v;
    root.hidden = !v;
    document.body.classList.toggle('cfg-open', !!v);
    btn.setAttribute('aria-expanded', String(v === 'gl'));
    window.dispatchEvent(new CustomEvent('kosmos:side', { detail: { view: v } }));   // hud.js: Szene neu einpassen
  };
  btn.addEventListener('click', () => open(view === 'gl' ? false : 'gl'));
  if (lay) lay.addEventListener('click', () => station(st.hidden));
  st.querySelector('#btn-st-close').addEventListener('click', () => { station(false); if (lay) lay.focus(); });
  root.querySelector('#btn-cfg-close').addEventListener('click', () => { open(false); btn.focus(); });
  const q = new URLSearchParams(location.search).get('cfg');
  if (q !== null) open(q === 'lay' ? 'lay' : 'gl');   // Screenshots: Fenster offen
  // Esc schließt das offene Panel links (es steht immer nur eins)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (!st.hidden) { e.preventDefault(); station(false); if (lay) lay.focus(); } else if (view) { e.preventDefault(); open(false); btn.focus(); }
  });
  // close: Stationswechsel klappt das offene Panel links ein (User 28.10.2026), der Ankunftstitel steht dann frei
  return { open, view: () => view, close: () => { station(false); if (view) open(false); } };
}
