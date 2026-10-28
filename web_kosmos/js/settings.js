// Einstellungen = gilt an allen Stationen; Ebenen = nur diese Station (Inhalt in layers.js). Ein Ort rechts (Vorschau 28.10.2026
// Fenster:C): die rechte Spalte zeigt Infotafel, Ebenen oder Einstellungen, umgeschaltet über die Reiter oben in der Spalte und die
// Knöpfe der Kopfleiste – nichts schwebt über der Szene. Einstellungen als durchgehende Liste, die Gruppen als Unterstrich-Reiter
// darüber (Reiter:C: Klick springt hin, beim Scrollen wandert die Markierung mit); Fuß mit Geltung und „Alle zurücksetzen“.
// Mini-Grafik je Zeile, geänderte Werte mit ↺ am Zeilenende. Gruppen: Look (Farblook, Belichtung, Vignette, Kinobalken),
// Himmel, Milchstraße (Aussehen + Aufbau, milkyway.js), Orbit (Satelliten, Drehachsen), Kamera & Bewegung, Effekte, Oberfläche (inkl. Bewegung der Info-Grafiken = cards.js `kosmos.figmotion.v1`), Leistung.
// `?cfg` (auch `?cfg=global`) zeigt die Einstellungen, `?cfg=lay` die Ebenen.
// Gespeichert in localStorage `kosmos.settings.v1`; clean() prüft jeden Wert, damit kaputte Einträge nichts stören.

import { mountLayers, rebuildLayers, refreshLayers, devLine, devBar, markDevs, spyIn, paintRange } from './layers.js';
import { nbsp } from './figs.js';

const KEY = 'kosmos.settings.v1';
const DEFAULTS = { motion: 'full', quality: 'auto', cine: true, dive: 3.6, exposure: 1, bloom: true, lens: true, lensAmt: 1, lensOptic: 'master', lensGhost: true, ghostMotion: true, anamorphic: true, rayleigh: true, grain: true, deep: 1, fpsCap: 0, panel: true, timeline: true, scaleCompare: true, small: 6, stars: true, grade: 'station', vig: 1, bars: false, axes: false,
  sunK: 1, shade: 1, shadow: 1, soft: 1, spec: 1, gloss: 0 };
// Farblook: Belichtung, Bloom, Kontrast, Sättigung, Tönung Schatten/Lichter, Vignette – Kino = Mischung aus HDR, Ruhig, Tiefe Glut.
// Global (main.js über globalGrade) oder je Station „Station“ = eigener Look; die Sonne wählt bei „Station“ selbst (levels/sun.js)
export const GRADES = [['neutral', { exposure: 1, bloom: 0.12, con: 0.12, sat: 1.04, sh: [0.96, 0.99, 1.06], hi: [1.04, 1, 0.95], vig: 0.38 }],
  ['Kino', { exposure: 1.05, bloom: 0.24, con: 0.25, sat: 1.12, sh: [0.88, 0.93, 1.06], hi: [1.1, 0.99, 0.86], vig: 0.55 }],
  ['Kino-HDR', { exposure: 1.15, bloom: 0.22, con: 0.22, sat: 1.1, sh: [0.9, 0.96, 1.12], hi: [1.08, 1, 0.88], vig: 0.5 }],
  ['ruhig', { exposure: 1, bloom: 0.16, con: 0.18, sat: 1, sh: [0.97, 0.98, 1.02], hi: [1.04, 1, 0.94], vig: 0.45 }],
  ['tiefe Glut', { exposure: 0.9, bloom: 0.3, con: 0.3, sat: 1.18, sh: [0.85, 0.88, 0.98], hi: [1.12, 0.98, 0.84], vig: 0.6 }]];
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
// Sternhimmel (Katalog und statistisch) folgt dem globalen Schalter „Sterne und Milchstraße“; schaltet nur die Kinder,
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
  <div class="b-looks" role="radiogroup" aria-labelledby="cfg-grade">${GRADE_IDS.map((id, i) => `<button type="button" role="radio" data-key="grade" data-val="${id}"><span class="b-sw" style="${swatch(i ? GRADES[i - 1][1] : null)}"></span><span>${i ? GRADES[i - 1][0] : 'Station'}</span></button>`).join('')}</div></div>`
  + NOTE('„Station“ = jede Station behält ihren eigenen Look (die Sonne hat dafür einen eigenen Farblook); die anderen gelten überall.');
const MW_STYLE = `<div class="b-row b-stack"><span class="cfg-label" id="cfg-mwstyle">Stil</span>
  <div class="seg b-seg" role="radiogroup" aria-labelledby="cfg-mwstyle">${MW_STYLES.map(([id, l]) => `<button type="button" role="radio" data-mwstyle="${id}">${l}</button>`).join('')}</div></div>`
  + NOTE('Setzt alle Regler der Milchstraße auf einen abgestimmten Look, danach frei einstellbar. „Astrofoto“ ist wie die Vorlage von ESO.');
// Zwischenüberschrift in einer Gruppe (Milchstraße: Aussehen | Aufbau, Vorschau 26.10.2026 Gruppe:C); zählt nicht als Einstellung
const SUB = (t) => ['#', `<h5 class="b-subh">${t}</h5>`];
const nRows = (g) => g.rows.filter(([k]) => k !== '#').length;
// Reihenfolge von fern nach nah: Look, Himmel, Milchstraße, Orbit, dann Bedienung
const GROUPS = [
  { id: 'look', icon: 'look', title: 'Look', hero: true, rows: [['grade', LOOKS], ['exposure', RANGE('exposure', 'Belichtung', 0.25, 4, 0.05, '×')],
    ['vig', RANGE('vig', 'Vignette', 0, 3, 0.05, '×')], ['bars', TOG('bars', 'Kinobalken 2,39:1')]] },
  { id: 'sky', icon: 'sky', title: 'Himmel', rows: [['stars', TOG('stars', 'Sterne und Milchstraße')],
    ['deep', RANGE('deep', 'Tiefer Himmel', 0, 4, 0.1, '×') + NOTE('Was eine Langzeitbelichtung hinter den Sternen sieht: ferne Galaxien und schwach leuchtender Staub der Milchstraße (Zirrus) – statistisch verteilt, überhöht, mit bloßem Auge unsichtbar. 0× = reines Schwarz.')]] },
  { id: 'mw', icon: 'galaxy', title: 'Milchstraße', rows: [['mw', TOG('mw', 'Milchstraße zeigen')], SUB('Aussehen'), ['', MW_STYLE],
    ['mwGain', RANGE('mwGain', 'Helligkeit', 0, 6, 0.05, '×')], ['mwCon', RANGE('mwCon', 'Kontrast', 0.5, 3, 0.05, '×')],
    ['mwBlack', RANGE('mwBlack', 'Schwarzpunkt', 0, 1, 0.05, '') + NOTE('Schneidet die schwachen Ränder des Bandes ab – der Himmel daneben wird dunkler.')],
    ['mwClar', RANGE('mwClar', 'Struktur', 0, 4, 0.05, '×') + NOTE('Lokaler Kontrast: hebt Sternwolken und Staubkanten gegen ihre Umgebung ab.')],
    ['mwSat', RANGE('mwSat', 'Sättigung', 0, 3, 0.05, '×')],
    ['mwTemp', RANGE('mwTemp', 'Farbtemperatur', -1, 1, 0.05, '') + NOTE('Minus = kühler, bläulich · plus = wärmer, golden.')], SUB('Aufbau'),
    ['mwDust', RANGE('mwDust', 'Staubbahnen', 0, 4, 0.05, '×') + NOTE('Dunkelwolken vor dem Sternlicht: Großer Riss, Pfeifennebel, Kohlensack. 0× = Sterne ohne Staub.')],
    ['mwNeb', RANGE('mwNeb', 'Leuchtnebel (Hα)', 0, 6, 0.05, '×') + NOTE('Rot leuchtender Wasserstoff: Carina, Lagune, Nordamerika, Barnards Loop.')],
    ['mwCore', RANGE('mwCore', 'Kern (Bulge)', 0, 6, 0.05, '×')], ['mwGlow', RANGE('mwGlow', 'Lichthof', 0, 6, 0.05, '×')],
    ['mwGrain', RANGE('mwGrain', 'Sternstaub', 0, 1, 0.05, '') + NOTE('Anteil des Bandes als einzelne feine Sterne statt Nebel – am deutlichsten beim Hineinzoomen.')],
    ['mwWidth', RANGE('mwWidth', 'Dicke der Scheibe', 0.4, 3, 0.05, '×') + NOTE('Höhe von Sternen und Staub über der Ebene; das Modell wird neu berechnet.')],
    ['mwNear', TOG('mwNear', 'Magellansche Wolken und Andromeda')],
    ['mwSrc', SEG('mwSrc', 'Quelle', [['model', 'Eigenes Modell'], ['photo', 'ESO-Foto']]) + NOTE('Das Foto (ESO/S. Brunier, CC BY 4.0) war die Vorlage und dient nur zum Vergleich – nur an Stationen im Sonnensystem, wo die Lage am Himmel stimmt.')]] },
  { id: 'orbit', icon: 'orbit', title: 'Orbit', rows: [
    ['small', RANGE('small', 'Satelliten und Kleinkörper', 1, 12, 0.5, '×') + NOTE('Satelliten, Trümmer und Asteroiden als vergrößerte Symbole – je größer, desto weniger Objekte (4× → jedes achte); 1× zeigt alle als Lichtpunkte.')],
    ['axes', TOG('axes', 'Drehachsen der Planeten und Monde') + NOTE('Linie über Nord- und Südpol jedes Planeten und Mondes, neigt und dreht sich mit dem Körper. Nordpol eisblau, Südpol grau.')]] },
  { id: 'light', icon: 'sun', title: 'Licht und Schatten', rows: [
    ['sunK', RANGE('sunK', 'Sonnenlicht', 0.25, 4, 0.05, '×') + NOTE('Stärke des direkten Sonnenlichts auf Planeten und Monden.')],
    ['shade', RANGE('shade', 'Nachtseite aufhellen', 0, 8, 0.25, '×') + NOTE('Restlicht auf der Schattenseite (schon aufgehellt, echt fast schwarz). 0× = ganz dunkel.')],
    ['shadow', RANGE('shadow', 'Schatten', 0, 1, 0.05, '×') + NOTE('Ringschatten, Wolkenschatten, Mond- und Planetenschatten bei Finsternissen. 0× = keine, 1× = volle Stärke.')],
    ['soft', RANGE('soft', 'Weiche Schattengrenze', 0, 4, 0.1, '×') + NOTE('Wie weit die Lufthülle Licht über die Tag-Nacht-Grenze streut; 0× = harte Kante.')],
    ['spec', RANGE('spec', 'Spiegelung der Ozeane', 0, 6, 0.1, '×') + NOTE('Glanzlicht der Sonne auf dem Meer der Erde.')],
    ['gloss', RANGE('gloss', 'Glanz der Oberflächen', 0, 4, 0.1, '×') + NOTE('Zusätzliches Glanzlicht auf Eis, Wolken und Gestein (künstlerisch). 0× = aus wie bisher.')]] },
  { id: 'cam', icon: 'cam', title: 'Kamera &amp; Bewegung', rows: [['motion', SEG('motion', 'Bewegung', [['full', 'Voll'], ['calm', 'Ruhig'], ['off', 'Aus']]) + NOTE('„Aus“ wirkt wie „Bewegung reduzieren“ im System: keine Fahrt von selbst, Wechsel als kurze Überblendung.')],
    ['cine', TOG('cine', 'Leerlauf-Fahrt der Kamera')], ['dive', RANGE('dive', 'Flugdauer', 1, 15, 0.1, 's')]] },
  { id: 'fx', icon: 'fx', title: 'Effekte', rows: [
    ['bloom', TOG('bloom', 'Lichthof (Bloom)')],
    ['lens', TOG('lens', 'Farbsaum und Linsenreflex')],
    ['lensAmt', RANGE('lensAmt', 'Stärke Linsenreflex', 0, 5, 0.05, '×') + NOTE('Lichthof, Ring und Geister um helle Quellen wie die Sonne. 0× = aus, der Farbsaum bleibt.')],
    ['lensOptic', SEG('lensOptic', 'Optik-Stil', [['master', 'Master-Optik'], ['classic', 'Klassisch']]) + NOTE('Master-Optik: Spektraler Beugungsring, Glanzbogen &amp; Magenta-Sensor-Ghost nach Referenzbild; Klassisch: Zarter Film-Halo.')],
    ['lensGhost', TOG('lensGhost', 'Magenta-Sensor-Ghost')],
    ['ghostMotion', TOG('ghostMotion', 'Ghost-Parallaxe auf optischer Achse') + NOTE('Der Magenta-Ghost wandert physikalisch entlang der optischen Achse bei Kameraschwenks.')],
    ['anamorphic', TOG('anamorphic', 'Anamorphes Gegenlicht')],
    ['rayleigh', TOG('rayleigh', 'Rayleigh-Dämmerung')],
    ['grain', TOG('grain', 'Filmkorn')]] },
  { id: 'ui', icon: 'ui', title: 'Oberfläche', half: true, rows: [['panel', TOG('panel', 'Infotafel zeigen')], ['scaleCompare', TOG('scaleCompare', 'Maßstabs-Vergleich')], ['timeline', TOG('timeline', 'Zeitleiste der Station zeigen')],
    ['', TOG('', 'Grafiken der Info-Karten bewegt', '', 'data-figs')]] },
  { id: 'perf', icon: 'perf', title: 'Leistung', rows: [['quality', SEG('quality', 'Qualität', [['auto', 'Auto'], ['1', 'Leicht'], ['2', 'Mittel'], ['3', 'Fein']])],
    ['fpsCap', SEG('fpsCap', 'Bildrate', [['0', 'Frei'], ['60', '60'], ['30', '30']]) + NOTE('30 Bilder/s spart am Laptop Strom und Lüfter.')]] },
];
const N_GLOBAL = GROUPS.reduce((n, g) => n + nRows(g), 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// Gruppen als Unterstrich-Reiter (Reiter:C) über der durchgehenden Liste; je Gruppe Name + Zahl der Einstellungen
const JUMP = `<nav class="cfg-jump u-tabs u-tabs--sub" aria-label="Gruppen">${GROUPS.map((g, i) => `<button type="button" class="u-tab" data-jump="${i}">${g.title}</button>`).join('')}</nav>`;
const CARD = (g, i) => `<section class="b-card b-fold b-sec" data-g="${g.id}" data-fold="${i}" aria-labelledby="cfg-h${i}">
  <h4 class="b-sec-h"><span class="b-name" id="cfg-h${i}">${g.title}</span><span class="b-count">${plural(nRows(g), 'Einstellung', 'Einstellungen')}</span></h4>
  <div class="b-body${g.half ? ' b-body--grid' : ''}" id="cfg-b${i}">${g.rows.map(([k, h]) => (k === '#' ? h : ROW(k, h))).join('')}</div></section>`;
// root = #cfg in der rechten Spalte, btn = Knopf „Einstellungen“, lay = Knopf „Ebenen“ (Zahl der Ebenen in der Beschriftung)
export function mountSettings(root, btn, lay = document.getElementById('btn-lay')) {
  root.innerHTML = `
    <div class="cfg-view" id="cfg-v-gl">
      ${JUMP}
      <div class="cfg-pane" id="cfg-global">
        <div class="b-main"><div class="b-list">${GROUPS.map(CARD).join('')}</div></div>
      </div>
      <div class="cfg-foot"><span class="cfg-scope">gilt an allen Stationen · ${N_GLOBAL} Einstellungen</span>${devBar()}</div>
    </div>
    <div class="cfg-view" id="cfg-v-lay" hidden>
      <div class="cfg-pane" id="cfg-station"></div>
    </div>`;
  const glob = root.querySelector('#cfg-global'), vGl = root.querySelector('#cfg-v-gl'), side = document.getElementById('panel');
  const info = ({ title, n, groups }) => {
    root.querySelectorAll('[data-st-name]').forEach((e) => { e.textContent = title; });
    side.querySelectorAll('[data-lay-n]').forEach((e) => { e.textContent = n || ''; });
    root.dataset.laySum = n ? `${plural(n, 'Ebene', 'Ebenen')}${groups > 1 ? ` in ${groups} Gruppen` : ''}` : 'Keine Ebenen';
    if (lay) {
      lay.querySelector('[data-lay-n]').textContent = n || '';
      lay.setAttribute('aria-label', n ? `Ebenen der Station: ${n}` : 'Ebenen der Station');
    }
  };
  mountLayers({ gear: root.querySelector('#cfg-station'), info, strip: document.getElementById('timeline'), stripOn: () => settings.S.timeline });
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
  const sc = glob;   // Reiter-Zeile und Fuß stehen, nur die Liste dazwischen scrollt
  sc.addEventListener('scroll', () => spyIn(vGl, sc), { passive: true });
  root.addEventListener('click', (e) => {
    // Reiter der Gruppen: zur Gruppe springen (Überschrift unter die stehende Reiter-Zeile)
    const j = e.target.closest('[data-jump]');
    if (j && vGl.contains(j)) {
      const c = glob.querySelector(`.b-fold[data-fold="${j.dataset.jump}"]`);
      c.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    // Auftakt-Film noch einmal (main.js): Zahnrad schließt, damit der Film frei steht
    if (e.target.closest('[data-auftakt]')) { open(false); window.dispatchEvent(new CustomEvent('kosmos:auftakt')); return; }
    const ms = e.target.closest('[data-mwstyle]');
    if (ms) for (const [k, v] of Object.entries(MW_STYLES.find(([id]) => id === ms.dataset.mwstyle)[2])) setSetting(k, v);
    const b = e.target.closest('[data-key][data-val]');
    if (b) setSetting(b.dataset.key, num(b.dataset.key, b.dataset.val));
    const r = e.target.closest('[data-reset]');
    if (r && vGl.contains(r)) for (const k of r.dataset.reset === '*' ? Object.keys(DEFAULTS) : [r.dataset.reset]) setSetting(k, DEFAULTS[k]);
  });
  root.addEventListener('input', (e) => {
    const i = e.target;
    if (i.matches('[data-figs]')) { setFigs(i.checked); return; }
    if (!i.dataset.key) return;
    setSetting(i.dataset.key, i.type === 'checkbox' ? i.checked : +i.value);
  });
  onSettings((keys) => { sync(); if (keys.includes('timeline')) rebuildLayers(); });
  sync();
  // view = 'gl' (Einstellungen) | 'lay' (Ebenen) | false (Infotafel bzw. Spalte zu, je nach Schalter „Infotafel zeigen“).
  // Die Spalte steht, solange ein Fenster offen ist, auch bei ausgeblendeter Infotafel (body.cfg-open, kosmos.css).
  let view = false;
  const tabs = [...side.querySelectorAll('[data-side]')];
  const open = (v) => {
    if (v !== view && v) root.querySelectorAll('#cfg-global, .lay-scroll').forEach((e) => { e.scrollTop = 0; });
    const was = view;
    view = v;
    root.hidden = !v;
    root.querySelector('#cfg-v-gl').hidden = v !== 'gl';
    root.querySelector('#cfg-v-lay').hidden = v !== 'lay';
    root.setAttribute('aria-labelledby', v === 'lay' ? 'side-t-lay' : 'side-t-gl');
    document.body.classList.toggle('cfg-open', !!v);
    const cur = v || 'info';
    tabs.forEach((t) => { const on = t.dataset.side === cur; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    btn.setAttribute('aria-expanded', String(v === 'gl'));
    if (lay) lay.setAttribute('aria-expanded', String(v === 'lay'));
    window.dispatchEvent(new CustomEvent('kosmos:side', { detail: { view: v } }));   // hud.js: Infotafel-Knopf, Raster bei ausgeblendeter Infotafel
    if (!!was !== !!v || v) refreshLayers();   // Werte, die die Infotafel inzwischen geändert hat
    if (v === 'gl') requestAnimationFrame(() => spyIn(vGl, sc));
  };
  btn.addEventListener('click', () => open(view === 'gl' ? false : 'gl'));
  if (lay) lay.addEventListener('click', () => open(view === 'lay' ? false : 'lay'));
  // Reiter der Spalte: Infotafel schließt das Fenster und zeigt die Tafel (hud.js schaltet „Infotafel zeigen“ ein); ←/→ wie Reiter
  side.querySelector('.side-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-side]');
    if (!t) return;
    if (t.dataset.side === 'info') { open(false); window.dispatchEvent(new CustomEvent('kosmos:info')); } else open(t.dataset.side);
  });
  side.querySelector('.side-tabs').addEventListener('keydown', (e) => {
    const t = e.target.closest('[data-side]');
    if (!t || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();   // sonst fliegt main.js zur Nachbarstation
    const to = tabs[(tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    to.focus();
    to.click();
  });
  const q = new URLSearchParams(location.search).get('cfg');
  if (q !== null) open(q === 'lay' ? 'lay' : 'gl');   // Screenshots: Fenster offen
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && view && !e.defaultPrevented) { const b = view === 'lay' && lay ? lay : btn; open(false); b.focus(); } });
  return { open, view: () => view };
}
