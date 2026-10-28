// Einstellungen = gilt an allen Stationen; Station = nur diese Station (Inhalt in layers.js). Die rechte Spalte zeigt Infotafel oder
// Einstellungen (Vorschau 28.10.2026 Fenster:C), umgeschaltet über die Knöpfe der Kopfleiste; die Station hat ein eigenes Panel links
// am Rand (#station, Vorschau 28.10.2026 „Station-Panel links am Rand“ Menü:C), auf/zu über #btn-lay, ✕ oder Esc. Einstellungen: die Gruppen als quadratische
// Kacheln mit Icon oben, darunter nur die gewählte Gruppe (User 28.10.2026); Fuß mit Geltung und „Alle zurücksetzen“.
// Mini-Grafik je Zeile, geänderte Werte mit ↺ am Zeilenende. Regel (User 28.10.2026): hier steht nur, was an jeder Station wirkt –
// Bild, Kamera & Bewegung, Effekte, Oberfläche (inkl. Bewegung der Info-Grafiken = cards.js `kosmos.figmotion.v1`), Leistung.
// Was nur an einem Teil der Stationen wirkt (Licht und Schatten, Drehachsen, Linsenreflex, Sternhimmel, Milchstraße), steht als
// gemeinsame Gruppe im Reiter Station (SHARED) – nur dort, wo es wirkt; der Wert gilt an allen Stationen der Gruppe.
// `?cfg` (auch `?cfg=global`) zeigt die Einstellungen, `?cfg=lay` das Panel Station.
// Gespeichert in localStorage `kosmos.settings.v1`; clean() prüft jeden Wert, damit kaputte Einträge nichts stören.

import { mountLayers, rebuildLayers, refreshLayers, devLine, devBar, markDevs, paintRange, icon } from './layers.js';
import { nbsp } from './figs.js';
import { SOLAR_SYSTEM } from './content.js';

const KEY = 'kosmos.settings.v1';
const DEFAULTS = { motion: 'full', quality: 'auto', cine: true, dive: 3.6, exposure: 1, bloom: true, lens: true, lensAmt: 1, lensOptic: 'master', lensGhost: true, ghostMotion: true, anamorphic: true, rayleigh: true, grain: true, deep: 1, fpsCap: 0, panel: true, timeline: true, scaleCompare: true, small: 6, stars: true, grade: 'station', vig: 1, bars: false, barsH: 1, axes: false,
  sunK: 1, shade: 1, shadow: 1, soft: 1, spec: 1, gloss: 0 };
// Farblook: Belichtung, Bloom, Kontrast, Sättigung, Tönung Schatten/Lichter, Vignette – Kino = Mischung aus HDR, Ruhig, Tiefe Glut.
// Global (main.js über globalGrade) oder je Station „Station“ = eigener Look; die Sonne wählt bei „Station“ selbst (levels/sun.js)
export const GRADES = [['Neutral', { exposure: 1, bloom: 0.12, con: 0.12, sat: 1.04, sh: [0.96, 0.99, 1.06], hi: [1.04, 1, 0.95], vig: 0.38 }],
  ['Kino', { exposure: 1.05, bloom: 0.24, con: 0.25, sat: 1.12, sh: [0.88, 0.93, 1.06], hi: [1.1, 0.99, 0.86], vig: 0.55 }],
  ['Kino-HDR', { exposure: 1.15, bloom: 0.22, con: 0.22, sat: 1.1, sh: [0.9, 0.96, 1.12], hi: [1.08, 1, 0.88], vig: 0.5 }],
  ['Ruhig', { exposure: 1, bloom: 0.16, con: 0.18, sat: 1, sh: [0.97, 0.98, 1.02], hi: [1.04, 1, 0.94], vig: 0.45 }],
  ['Tiefe Glut', { exposure: 0.9, bloom: 0.3, con: 0.3, sat: 1.18, sh: [0.85, 0.88, 0.98], hi: [1.12, 0.98, 0.84], vig: 0.6 }]];
const GRADE_IDS = ['station', 'neutral', 'kino', 'hdr', 'ruhig', 'glut'];
const CHOICES = { motion: ['full', 'calm', 'off'], quality: ['auto', '1', '2', '3'], grade: GRADE_IDS, lensOptic: ['master', 'classic'] };
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
  for (const [k, [lo, hi]] of Object.entries({ ...MW_RANGE, ...LIGHT_RANGE })) S[k] = Math.min(hi, Math.max(lo, S[k]));
  return S;
}

function load() {
  try { return clean(JSON.parse(localStorage.getItem(KEY))); } catch { return clean(null); }
}

export const settings = { S: load() };
// globaler Farblook oder null (= jede Station ihr eigener Look)
export const globalGrade = () => (settings.S.grade === 'station' ? null : GRADES[GRADE_IDS.indexOf(settings.S.grade) - 1][1]);
const listeners = [];
export function onSettings(fn) { listeners.push(fn); }
// Regler „Höhe der Kinobalken“ zeigt die Balken beim Ziehen kurz an, auch wenn der Kino-Modus aus ist (main.js)
let peekT = -1e9;
export const barsPeek = () => performance.now() - peekT < 1500;
// Sternhimmel (Katalog und statistisch) folgt dem globalen Schalter „Sternhimmel“; schaltet nur die Kinder,
// damit Stationen die Gruppe selbst weiter ein- und ausblenden können
export function followStars(group) {
  const apply = () => group.children.forEach((c) => { c.visible = settings.S.stars; });
  apply();
  onSettings((keys) => { if (keys.includes('stars')) apply(); });
}

export function setSetting(key, value) {
  const next = clean({ ...settings.S, [key]: value });
  if (next[key] === settings.S[key]) return;
  settings.S = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* privates Fenster: nur für diese Sitzung */ }
  listeners.forEach((fn) => fn([key]));
}

// Bewegung der Info-Grafiken: gleicher Speicher wie der Schalter „Bewegung“ in jeder Info-Karte (cards.js); ohne gemerkten Wert
// folgt sie „Bewegung“ und dem System
const FM_KEY = 'kosmos.figmotion.v1';
const reducedSys = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const figsOn = () => { let v = null; try { v = localStorage.getItem(FM_KEY); } catch { /* privat */ } return v ? v === 'on' : !(reducedSys() || settings.S.motion === 'off'); };
const setFigs = (on) => { try { localStorage.setItem(FM_KEY, on ? 'on' : 'off'); } catch { /* privat */ } };

const SEG = (key, label, opts, extra = '') => `
  <div class="b-row b-stack"><span class="cfg-label" id="cfg-${key}">${label}${extra}</span>
    <div class="seg b-seg" role="radiogroup" aria-labelledby="cfg-${key}">
      ${opts.map(([v, l]) => `<button type="button" role="radio" data-key="${key}" data-val="${v}">${l}</button>`).join('')}
    </div></div>`;
const TOG = (key, label, extra = '', attr = `data-key="${key}"`) => `
  <label class="b-row cfg-toggle"><span class="cfg-label">${label}${extra}</span><input type="checkbox" ${attr}><span class="switch" aria-hidden="true"></span></label>`;
const RANGE = (key, label, min, max, step, unit, extra = '') => `
  <label class="b-row b-stack"><span class="b-top"><span class="cfg-label">${label}${extra}</span><span class="cfg-val"><output data-out="${key}"></output> <span class="cfg-unit">${unit}</span></span></span>
    <span class="b-track"><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}"></span></label>`;
const NOTE = (text) => `<p class="cfg-note lay-hint">${nbsp(text)}</p>`;
// Zeile = Bedienung + Hinweis darunter + ↺ „Standard“ am Zeilenende (nur bei geändertem Wert)
const ROW = (key, html) => {
  const i = html.indexOf('<p class="cfg-note'), [ctl, note] = i < 0 ? [html, ''] : [html.slice(0, i), html.slice(i)];
  const label = (ctl.match(/class="cfg-label"[^>]*>([^<]+)/) || [])[1] || '';
  return `<div class="b-item">${ctl}${note}${key ? devLine(key, label) : ''}</div>`;
};
// Farblook als Bild-Kacheln: Farben aus Tönung, Belichtung und Vignette des jeweiligen Looks; „Station“ = vier Looks im Kreis
const rgb = (b, t, e) => `rgb(${b.map((x, i) => Math.min(255, Math.round(x * t[i] * e))).join(',')})`;
const swatch = (g) => (g ? `background:radial-gradient(circle at 34% 62%, ${rgb([255, 236, 190], g.hi, g.exposure)} 0 9%, ${rgb([240, 140, 50], g.hi, g.exposure)} 22%, ${rgb([120, 40, 22], g.sh, g.exposure)} 46%, ${rgb([22, 26, 44], g.sh, g.exposure)} 78%);box-shadow:inset 0 0 ${Math.round(g.vig * 26)}px rgba(0,0,0,.85)`
  : 'background:conic-gradient(from 200deg at 50% 55%, #e88a3a 0 25%, #4e7bd6 0 50%, #9a62c9 0 75%, #3aa88a 0)');
const LOOKS = `<div class="b-row b-stack"><span class="cfg-label" id="cfg-grade">Farblook</span>
  <div class="b-looks" role="radiogroup" aria-labelledby="cfg-grade">${GRADE_IDS.map((id, i) => `<button type="button" role="radio" data-key="grade" data-val="${id}"><span class="b-sw" style="${swatch(i ? GRADES[i - 1][1] : null)}"></span><span>${i ? GRADES[i - 1][0] : 'Je Station'}</span></button>`).join('')}</div></div>`
  + NOTE('„Je Station“ = jede Station behält ihren eigenen Look (die Sonne hat dafür einen eigenen Farblook); die anderen gelten überall.');
const nRows = (g) => g.rows.length;
// Reihenfolge: Bild, dann Bedienung
const GROUPS = [
  { id: 'look', icon: 'look', title: 'Bild', hero: true, rows: [['grade', LOOKS], ['exposure', RANGE('exposure', 'Belichtung', 0.25, 4, 0.05, '×')],
    ['vig', RANGE('vig', 'Vignette', 0, 3, 0.05, '×')], ['bars', TOG('bars', 'Kinobalken 2,39:1')],
    ['barsH', RANGE('barsH', 'Höhe der Kinobalken', 0.5, 2, 0.05, '×') + NOTE('1× = Kinoformat 2,39:1. Beim Ziehen sind die Balken kurz zu sehen.')],
    ['stars', TOG('stars', 'Sternhimmel') + NOTE('Hauptschalter für Sterne, Milchstraße und Tiefen Himmel: aus = reines Schwarz. Feinheiten im Reiter Station.')]] },
  { id: 'cam', icon: 'cam', title: 'Kamera &amp; Bewegung', rows: [['motion', SEG('motion', 'Bewegung', [['full', 'Voll'], ['calm', 'Ruhig'], ['off', 'Aus']]) + NOTE('„Aus“ wirkt wie „Bewegung reduzieren“ im System: keine Fahrt von selbst, Wechsel als kurze Überblendung.')],
    ['cine', TOG('cine', 'Kamerafahrt im Leerlauf')], ['dive', RANGE('dive', 'Flugdauer', 1, 15, 0.1, 's')]] },
  { id: 'fx', icon: 'fx', title: 'Effekte', rows: [
    ['bloom', TOG('bloom', 'Überstrahlen (Bloom)')],
    ['lens', TOG('lens', 'Linsenreflex') + NOTE('Hauptschalter. Stärke und Art des Linsenreflexes stehen im Reiter Station, wo die Sonne im Bild ist.')],
    ['grain', TOG('grain', 'Filmkorn')]] },
  { id: 'ui', icon: 'ui', title: 'Oberfläche', half: true, rows: [['panel', TOG('panel', 'Infotafel zeigen')], ['scaleCompare', TOG('scaleCompare', 'Maßstabs-Vergleich')], ['timeline', TOG('timeline', 'Zeitleiste der Station zeigen')],
    ['', TOG('', 'Grafiken bewegt', '', 'data-figs')]] },
  { id: 'perf', icon: 'perf', title: 'Leistung', rows: [['quality', SEG('quality', 'Qualität', [['auto', 'Auto'], ['1', 'Niedrig'], ['2', 'Mittel'], ['3', 'Hoch']])],
    ['fpsCap', SEG('fpsCap', 'Bildrate', [['0', 'Frei'], ['60', '60 Bilder/s'], ['30', '30 Bilder/s']]) + NOTE('30 Bilder/s spart am Laptop Strom und Lüfter.')]] },
];

// ---------- Gemeinsame Gruppen im Reiter Station ----------
// Zeile: k = Schlüssel in settings.S, at = Stationen der Zeile (ohne: die der Gruppe). Stationen je Wirkung (Stand 28.10.2026):
const NEAR_EARTH = ['earth', 'iss', 'tiangong', 'hubble', 'jwst', 'euclid', 'roman'];   // Ozean + Lufthülle (EARTH_FRAG, ATMO_FRAG)
const BODIES = SOLAR_SYSTEM.filter((id) => id !== 'sun');   // Planeten und Monde mit spinAxis (axes.js)
const SYMBOLS = ['earth', 'solar'];   // Satelliten (sats.js), Asteroiden (levels/solar.js)
// createFlare (flare.js), auch über orbitview, l2view, uranusmoon, createMarsMoon; die Sonne hat eigene Optik-Ebenen (levels/sun.js)
const FLARE = ['earth', 'moon', 'solar', 'sun', 'io', 'europa', 'triton', 'phobos', 'deimos', 'asteroid', 'miranda', 'iss', 'tiangong', 'hubble', 'jwst', 'euclid', 'roman'];
const FLARE_NOSUN = FLARE.filter((id) => id !== 'sun');
// Milchstraßenband am Himmel (createStarfield, band > 0): Sonnensystem und Stationen in der Milchstraße
const MILKY = [...SOLAR_SYSTEM, 'asteroid', 'orion', 'crab', 'pulsar', 'pillars', 'butterfly', 'spider', 'tornado'];
const R = (k, label, min, max, step, unit, hint, at) => ({ k, label, min, max, step, unit, hint, at });
const T = (k, label, hint, at) => ({ k, label, toggle: true, hint, at });
const C = (k, label, opts, hint, at) => ({ k, label, opts, hint, at });
const SHARED = [
  { group: 'Licht und Schatten', scope: 'Gilt an allen Stationen im Sonnensystem.', at: SOLAR_SYSTEM, rows: [
    R('sunK', 'Sonnenlicht', 0.25, 4, 0.05, '×', 'Stärke des direkten Sonnenlichts auf Planeten und Monden.'),
    R('shade', 'Nachtseite aufhellen', 0, 8, 0.25, '×', 'Restlicht auf der Schattenseite (schon aufgehellt, echt fast schwarz). 0× = ganz dunkel.'),
    R('shadow', 'Schatten', 0, 1, 0.05, '×', 'Ringschatten, Wolkenschatten, Mond- und Planetenschatten bei Finsternissen. 0× = keine, 1× = volle Stärke.'),
    R('soft', 'Weiche Schattengrenze', 0, 4, 0.1, '×', 'Wie weit die Lufthülle Licht über die Tag-Nacht-Grenze streut; 0× = harte Kante.'),
    R('spec', 'Spiegelung der Ozeane', 0, 6, 0.1, '×', 'Glanzlicht der Sonne auf dem Meer der Erde.', NEAR_EARTH),
    R('gloss', 'Glanz der Oberflächen', 0, 4, 0.1, '×', 'Zusätzliches Glanzlicht auf Eis, Wolken und Gestein (künstlerisch). 0× = aus.'),
    T('rayleigh', 'Blaue Dämmerung am Erdrand (Rayleigh)', '', NEAR_EARTH)] },
  { group: 'Bahnen und Achsen', scope: 'Gilt an allen Stationen mit Planeten und Monden.', at: BODIES, rows: [
    T('axes', 'Drehachsen der Planeten und Monde', 'Linie über Nord- und Südpol jedes Planeten und Mondes, neigt und dreht sich mit dem Körper. Nordpol eisblau, Südpol grau.'),
    R('small', 'Größe der Symbole', 1, 12, 0.5, '×', 'Satelliten, Trümmer und Asteroiden als vergrößerte Symbole – je größer, desto weniger Objekte (4× → jedes achte); 1× zeigt alle als Lichtpunkte.', SYMBOLS)] },
  { group: 'Linsenreflex', scope: 'Gilt an allen Stationen mit der Sonne im Bild.', at: FLARE, rows: [
    R('lensAmt', 'Stärke Linsenreflex', 0, 5, 0.05, '×', 'Schein, Ring und Geisterbilder um helle Quellen wie die Sonne. 0× = aus.'),
    C('lensOptic', 'Art der Optik', [['master', 'Filmkamera'], ['classic', 'Schlicht']], 'Filmkamera: Regenbogenring, heller Bogen und ein farbiger Lichtfleck gegenüber der Sonne. Schlicht: nur ein zarter Lichtkranz.', FLARE_NOSUN),
    T('lensGhost', 'Farbiger Lichtfleck (Geisterbild)', '', FLARE_NOSUN),
    T('ghostMotion', 'Lichtfleck wandert beim Schwenken', 'Wie in einem echten Objektiv wandert der Fleck beim Schwenken auf der Linie durch die Bildmitte.', FLARE_NOSUN),
    T('anamorphic', 'Waagrechter Lichtstreif (anamorph)')] },
  { group: 'Sternhimmel', scope: 'Gilt an allen Stationen mit diesem Himmel; aus über „Sternhimmel“ in den Einstellungen.', at: () => [...MILKY, ...deepAt], rows: [
    R('deep', 'Tiefer Himmel', 0, 4, 0.1, '×', 'Was eine Langzeitbelichtung hinter den Sternen sieht: ferne Galaxien und schwach leuchtender Staub der Milchstraße (Zirrus) – statistisch verteilt, überhöht, mit bloßem Auge unsichtbar. 0× = reines Schwarz.', () => deepAt),
    T('mw', 'Milchstraße zeigen', 'Nur das Band der Milchstraße am Himmel.', MILKY),
    T('mwNear', 'Magellansche Wolken und Andromeda', '', MILKY),
    C('mwSrc', 'Quelle der Milchstraße', [['model', 'Eigenes Modell'], ['photo', 'ESO-Foto']], 'Das Foto (ESO/S. Brunier, CC BY 4.0) war die Vorlage und dient nur zum Vergleich – nur im Sonnensystem, wo die Lage am Himmel stimmt.', SOLAR_SYSTEM)] },
  { group: 'Milchstraße · Aussehen', scope: 'Gilt an allen Stationen mit dem Band der Milchstraße am Himmel.', at: MILKY, rows: [
    { k: 'mwStyle', label: 'Stil', style: true, hint: 'Setzt alle Regler der Milchstraße auf einen abgestimmten Look, danach frei einstellbar. „Astrofoto“ ist wie die Vorlage von ESO.' },
    R('mwGain', 'Helligkeit', 0, 6, 0.05, '×'), R('mwCon', 'Kontrast', 0.5, 3, 0.05, '×'),
    R('mwBlack', 'Schwarzpunkt', 0, 1, 0.05, '', 'Schneidet die schwachen Ränder des Bandes ab – der Himmel daneben wird dunkler.'),
    R('mwClar', 'Struktur', 0, 4, 0.05, '×', 'Lokaler Kontrast: hebt Sternwolken und Staubkanten gegen ihre Umgebung ab.'),
    R('mwSat', 'Sättigung', 0, 3, 0.05, '×'),
    R('mwTemp', 'Farbtemperatur', -1, 1, 0.05, '', 'Minus = kühler, bläulich · plus = wärmer, golden.')] },
  { group: 'Milchstraße · Aufbau', at: MILKY, rows: [
    R('mwDust', 'Staubbahnen', 0, 4, 0.05, '×', 'Dunkelwolken vor dem Sternlicht: Großer Riss, Pfeifennebel, Kohlensack. 0× = Sterne ohne Staub.'),
    R('mwNeb', 'Leuchtnebel (Hα)', 0, 6, 0.05, '×', 'Rot leuchtender Wasserstoff: Carina, Lagune, Nordamerika, Barnards Loop.'),
    R('mwCore', 'Kern (Bulge)', 0, 6, 0.05, '×'), R('mwGlow', 'Leuchten des Bandes', 0, 6, 0.05, '×'),
    R('mwGrain', 'Einzelsterne im Band', 0, 1, 0.05, '', 'Anteil des Bandes als einzelne feine Sterne statt Nebel – am deutlichsten beim Hineinzoomen.'),
    R('mwWidth', 'Dicke der Scheibe', 0.4, 3, 0.05, '×', 'Höhe von Sternen und Staub über der Ebene; das Modell wird neu berechnet.')] },
];
// Stationen des Tiefen Himmels meldet deepsky.js (Tabelle DEEP) – kein Import von dort, sonst Kreis settings ↔ deepsky
let deepAt = [];
export function setDeepAt(ids) { deepAt = ids; sharedCache.clear(); }
const atOf = (x) => (typeof x === 'function' ? x() : x);
const dec = (v, step) => v.toFixed(step < 0.1 ? 2 : 1).replace('.', ',');
// Zeile → Ebene für layers.js: Wert liest und schreibt settings.S (shared: layers.js speichert sie nicht je Station)
function sharedLayer(r) {
  const S = () => settings.S;
  const l = { id: `cfg-${r.k}`, shared: true, label: r.label, hint: r.hint || '', set: () => {} };
  if (r.style) {
    const at = () => MW_STYLES.findIndex(([id]) => mwStyleOn(S(), id));
    return Object.defineProperties({ ...l, type: 'range', min: 0, max: MW_STYLES.length - 1, step: 1, def: 1, fmt: (i) => (MW_STYLES[Math.round(i)] || ['', 'eigener'])[1] },
      { value: { get: at, set: (i) => { for (const [k, v] of Object.entries(MW_STYLES[i][2])) setSetting(k, v); }, enumerable: true } });
  }
  if (r.opts) {
    return Object.defineProperties({ ...l, type: 'range', min: 0, max: r.opts.length - 1, step: 1, def: r.opts.findIndex(([v]) => v === DEFAULTS[r.k]), fmt: (i) => r.opts[Math.round(i)][1] },
      { value: { get: () => r.opts.findIndex(([v]) => v === S()[r.k]), set: (i) => setSetting(r.k, r.opts[i][0]), enumerable: true } });
  }
  const base = r.toggle ? { ...l, type: 'toggle' } : { ...l, type: 'range', min: r.min, max: r.max, step: r.step, fmt: (v) => `${dec(v, r.step)}${r.unit ? ` ${r.unit}` : ''}` };
  return Object.defineProperties({ ...base, def: DEFAULTS[r.k] }, { value: { get: () => S()[r.k], set: (v) => setSetting(r.k, v), enumerable: true } });
}
// Gemeinsame Ebenen einer Station (je Station einmal gebaut, damit layers.js stabile Objekte findet); group + scope an der
// ersten Zeile, die an dieser Station steht
const sharedCache = new Map();
export function sharedFor(id) {
  if (!sharedCache.has(id)) {
    sharedCache.set(id, SHARED.flatMap((g) => {
      if (!atOf(g.at).includes(id)) return [];
      const rows = g.rows.filter((r) => !r.at || atOf(r.at).includes(id)).map(sharedLayer);
      if (rows[0]) Object.assign(rows[0], { group: g.group, scope: g.scope });
      return rows;
    }));
  }
  return sharedCache.get(id);
}
const N_GLOBAL = GROUPS.reduce((n, g) => n + nRows(g), 0);
// „Alle zurücksetzen“ der Einstellungen: nur, was hier steht (nicht die gemeinsamen Gruppen im Reiter Station)
const GLOBAL_KEYS = GROUPS.flatMap((g) => g.rows.map(([k]) => k)).filter(Boolean);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// Gruppen als quadratische Kacheln mit Icon (User 28.10.2026); darunter nur die gewählte Gruppe, Überschrift mit Zahl der Einstellungen
const JUMP = `<div class="cfg-jump" role="tablist" aria-label="Gruppen">${GROUPS.map((g, i) => `<button type="button" role="tab" class="cfg-tile" id="cfg-t${i}" data-jump="${i}" aria-controls="cfg-s${i}" aria-selected="false" tabindex="-1">${icon(g.icon, 'cfg-tile-ico')}<span>${g.title}</span></button>`).join('')}</div>`;
const CARD = (g, i) => `<section class="b-card b-fold b-sec" id="cfg-s${i}" role="tabpanel" data-g="${g.id}" data-fold="${i}" aria-labelledby="cfg-h${i}" hidden>
  <h4 class="b-sec-h"><span class="b-name" id="cfg-h${i}">${g.title}</span><span class="b-count">${plural(nRows(g), 'Einstellung', 'Einstellungen')}</span></h4>
  <div class="b-body${g.half ? ' b-body--grid' : ''}" id="cfg-b${i}">${g.rows.map(([k, h]) => ROW(k, h)).join('')}</div></section>`;
// root = #cfg in der rechten Spalte, btn = Knopf „Einstellungen“, lay = Knopf „Station“ (Zahl der Einstellungen in der Beschriftung),
// st = Panel Station links
export function mountSettings(root, btn, lay = document.getElementById('btn-lay'), st = document.getElementById('station')) {
  root.innerHTML = `
    <div class="cfg-view" id="cfg-v-gl">
      ${JUMP}
      <div class="cfg-pane" id="cfg-global">
        <div class="b-main"><div class="b-list">${GROUPS.map(CARD).join('')}</div></div>
      </div>
      <div class="cfg-foot"><span class="cfg-scope">gilt an allen Stationen · ${N_GLOBAL} Einstellungen</span>${devBar()}</div>
    </div>`;
  const glob = root.querySelector('#cfg-global'), vGl = root.querySelector('#cfg-v-gl');
  const info = ({ title, n }) => {
    st.querySelectorAll('[data-st-name]').forEach((e) => { e.textContent = title; });
    st.dataset.laySum = n ? plural(n, 'Einstellung', 'Einstellungen') : 'Keine Einstellungen';   // Gruppen zeigt die Leiste
    st.querySelector('[data-st-n]').textContent = st.dataset.laySum;
    if (lay) {
      lay.querySelector('[data-lay-n]').textContent = n || '';
      lay.setAttribute('aria-label', n ? `Einstellungen dieser Station: ${n}` : 'Einstellungen dieser Station');
    }
  };
  mountLayers({ gear: st.querySelector('#cfg-station'), info, strip: document.getElementById('timeline'), stripOn: () => settings.S.timeline, shared: sharedFor });
  const sync = () => {
    const S = settings.S;
    root.querySelectorAll('[data-key][data-val]').forEach((b) => b.setAttribute('aria-checked', String(String(S[b.dataset.key]) === b.dataset.val)));
    root.querySelectorAll('[data-mwstyle]').forEach((b) => b.setAttribute('aria-checked', String(mwStyleOn(S, b.dataset.mwstyle))));
    const f = root.querySelector('[data-figs]');
    if (f) f.checked = figsOn();
    root.querySelectorAll('input[type=checkbox][data-key]').forEach((i) => { i.checked = !!S[i.dataset.key]; });
    root.querySelectorAll('input[type=range][data-key]').forEach((i) => {
      i.value = S[i.dataset.key];
      root.querySelector(`[data-out="${i.dataset.key}"]`).textContent = String(S[i.dataset.key].toFixed(i.step < 0.1 ? 2 : 1)).replace('.', ',');
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
    const ms = e.target.closest('[data-mwstyle]');
    if (ms) for (const [k, v] of Object.entries(MW_STYLES.find(([id]) => id === ms.dataset.mwstyle)[2])) setSetting(k, v);
    const b = e.target.closest('[data-key][data-val]');
    if (b) setSetting(b.dataset.key, num(b.dataset.key, b.dataset.val));
    const r = e.target.closest('[data-reset]');
    if (r && vGl.contains(r)) for (const k of r.dataset.reset === '*' ? GLOBAL_KEYS : [r.dataset.reset]) setSetting(k, DEFAULTS[k]);
  });
  root.addEventListener('input', (e) => {
    const i = e.target;
    if (i.matches('[data-figs]')) { setFigs(i.checked); return; }
    if (!i.dataset.key) return;
    if (i.dataset.key === 'barsH') peekT = performance.now();
    setSetting(i.dataset.key, i.type === 'checkbox' ? i.checked : +i.value);
  });
  onSettings((keys) => { sync(); if (keys.includes('timeline')) rebuildLayers(); });
  sync();
  // Panel Station links: breit unabhängig von der rechten Spalte (body.st-open, kosmos.css); schmal (Handy) steht immer nur eins
  // von beiden, die Infotafel weicht dem Panel
  const narrow = matchMedia('(max-width: 760px)');
  let view = false;
  const station = (on) => {
    if (on === !st.hidden) return;
    if (on && narrow.matches && view) open(false);
    st.hidden = !on;
    document.body.classList.toggle('st-open', on);
    if (lay) lay.setAttribute('aria-expanded', String(on));
    if (on) refreshLayers();   // Werte, die die Station inzwischen geändert hat; Zeitachse braucht die sichtbare Breite
    window.dispatchEvent(new CustomEvent('kosmos:side', { detail: { view } }));   // hud.js: Szene neu einpassen
  };
  // view = 'gl' (Einstellungen) | false (Infotafel bzw. Spalte zu, je nach Schalter „Infotafel zeigen“); 'lay' öffnet das Panel
  // Station links und lässt die Spalte, wie sie ist. Die Spalte steht, solange die Einstellungen offen sind, auch bei
  // ausgeblendeter Infotafel (body.cfg-open, kosmos.css).
  const open = (v) => {
    if (v === 'lay') { station(true); return; }
    if (v && narrow.matches) station(false);
    if (v !== view && v) glob.scrollTop = 0;
    view = v;
    root.hidden = !v;
    document.body.classList.toggle('cfg-open', !!v);
    btn.setAttribute('aria-expanded', String(v === 'gl'));
    window.dispatchEvent(new CustomEvent('kosmos:side', { detail: { view: v } }));   // hud.js: Infotafel-Knopf, Raster bei ausgeblendeter Infotafel
  };
  btn.addEventListener('click', () => open(view === 'gl' ? false : 'gl'));
  if (lay) lay.addEventListener('click', () => station(st.hidden));
  st.querySelector('#btn-st-close').addEventListener('click', () => { station(false); if (lay) lay.focus(); });
  const q = new URLSearchParams(location.search).get('cfg');
  if (q !== null) open(q === 'lay' ? 'lay' : 'gl');   // Screenshots: Fenster offen
  // Esc schließt das Fenster mit dem Fokus, sonst zuerst das Panel Station
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const inGl = view && root.contains(document.activeElement);
    if (!st.hidden && !inGl) { station(false); if (lay) lay.focus(); } else if (view) { open(false); btn.focus(); }
  });
  return { open, view: () => view };
}
