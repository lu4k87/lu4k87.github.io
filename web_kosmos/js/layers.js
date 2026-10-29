// Einstellungen je Station (Muster Biochar): Panel „Station“ links am Rand (settings.js, Vorschau 28.10.2026 Menü:C) und
// Zeitleiste (Player) in der Fußzeile. Panel: Leiste links (erster Eintrag „Ereignisse“ = Block „Zeigen“, darunter die Gruppen
// mit Icon, Name und Zahl, Punkt bei geändertem Wert, ↑/↓ wie Reiter), Bühne rechts mit Titel der Gruppe + Inhalt, scrollt allein;
// Fuß „Diese Station · n Einstellungen · Alle zurücksetzen“ steht. Genau ein Eintrag sichtbar (je Station gemerkt in
// `kosmos.cfgopen.v1`). Block „Zeigen“ (Vorschau 28.10.2026 „Regler der Infotafel in den Reiter Station“ Reiter:C): ▶/⏸ + Stand,
// Zeitachse mit Spielkopf und Ereignismarken, Tempo, „Nächstes · Springen“, Zeit-Regler und Ereignis-Knöpfe.
// Die Schalter der Station (`lv.controls`, früher in der Infotafel; hud.js meldet sie mit setControls) stehen als erste Gruppe
// „Ansicht“; Knöpfe ('action') und Regler mit show: true (Jahr, Stelle im Film …) gehören in den Block „Zeigen“, ebenso Ebenen
// mit show: true und alles in der Gruppe der ▶-Ebene. Ihre Werte bleiben ungespeichert wie bisher (?ctl= in main.js setzt sie).
// Ereignisachse: ▶-Ebene mit now() (Zeit der Station, Julianisches Datum) und span (Tage); Knöpfe mit at(von, bis) → Zeitpunkt
// (oder { t, mark }) bzw. null, go(t) springt hin, mark = Name an der Marke.
// Eine Station registriert ihre Ebenen in create(): registerLayers(stationId, layers). Ebene = { id, label, type, value, set, … }
//   'toggle' an/aus · 'range' (min, max, step, unit, fmt) · 'play' ▶/⏸ mit Regler: set(value, playing), get() → { value, playing },
//   status() Text für die Zeitleiste · 'action' Knopf: run(), button. sub: true rückt ein (Folgezeilen hängen gemeinsam an der Zeile
//   davor), hint: Zusatztext unter der Zeile, group: Gruppe (gilt ab dieser Ebene bis zur nächsten group; gleicher Kurzname
//   in tabs.js = ein Reiter, der volle Name steht dann als Zwischenüberschrift im Inhalt),
//   active() + only: Ebene wirkt gerade nicht (z. B. anderer Kanal) → Zeile abgedunkelt, bleibt bedienbar, darunter only als Grund.
//   Auswahl ('seg' oder Regler mit benannten Stufen) erscheint als Schalter (2 Werte), Auswahlfeld oder mit ordered: true als
//   Rast-Regler (geordnete Stufen wie Detailstufe); buttons: true behält die Knopfreihe (Farb-Wahl wie Farblook).
// Werte, die an allen Stationen gemeinsam gelten, stehen nicht hier, sondern in den Einstellungen (settings.js). Werte je Station in localStorage `kosmos.layers.v1` (nicht der Abspielzustand); URL `?lay=aurora:0,kp:7,clock.play:1` für
// Screenshots. Aktive Station aus `#station=…` (main.js setzt den Hash per replaceState → ohne Ereignis, daher Takt 300 ms).

import { STATIONS } from './content.js';
import { prose, nbsp } from './figs.js';
import { tabOf, tabIcon } from './tabs.js';

const KEY = 'kosmos.layers.v1';
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h3.4v13H7zM13.6 5.5H17v13h-3.4z" fill="currentColor"/></svg>';
// Linien-Icons (24er Raster) für Karten-Plaketten und Themenliste – auch für den Reiter Global (settings.js)
const ICONS = {
  look: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none"/>',
  sky: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><circle cx="18.5" cy="17.5" r="1"/><circle cx="6" cy="18" r="0.8"/>',
  cam: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/>',
  fx: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  ui: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
  perf: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  field: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5C6 3 2 9 12 12M12 14.5C18 21 22 15 12 12M12 9.5c6-6.5 10-.5 0 2.5M12 14.5c-6 6.5-10 .5 0-2.5"/>',
  burst: '<path d="M4 19c1-7 5-11 9-12M8 19c1-5 4-8 8-9M12 19c.6-3 2.6-5 6-5.6"/><circle cx="17.5" cy="5.5" r="1.5"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-20 12 12)"/><circle cx="20.4" cy="9" r="1.2" fill="currentColor"/>',
  layers: '<path d="M12 4l9 4.5-9 4.5-9-4.5z"/><path d="M3 13l9 4.5 9-4.5"/>',
  galaxy: '<path d="M2.5 12c3-2.2 6.2-3 9.5-3s6.5.8 9.5 3c-3 2.2-6.2 3-9.5 3s-6.5-.8-9.5-3z"/><circle cx="12" cy="12" r="2"/>',
  time: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c-3 3-3 14 0 17M12 3.5c3 3 3 14 0 17"/>',
  planet: '<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-18 12 12)"/>',
  moon: '<path d="M15.5 4.5a8 8 0 1 0 4 12.5 6.5 6.5 0 0 1-4-12.5z"/>',
  wave: '<path d="M3 9c3-2.5 6 2.5 9 0s6-2.5 9 0M3 15c3-2.5 6 2.5 9 0s6-2.5 9 0"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6-1.2A4.6 4.6 0 0 1 17 18z"/>',
  net: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6.2l10 .6M6 7.8l5 8.4M18 8.8l-5 7.4"/>',
  probe: '<rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M3 7h5v10H3zM16 7h5v10h-5zM8 12h1.5M14.5 12H16"/>',
  tune: '<path d="M4 7h9M18 7h2M4 17h3M12 17h8"/><circle cx="15.5" cy="7" r="2.5"/><circle cx="9.5" cy="17" r="2.5"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2.5 2-3.5 4-3.5 6.5C9 10.5 8.5 9.5 8.5 8 6.8 9.8 6 12.2 6 15a6 6 0 0 0 6 6z"/>',
  corona: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/><circle cx="12" cy="12" r="7.5" stroke-dasharray="2 2.6"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M3 15h18M8 5v4M16 5v4M8 15v4M16 15v4"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  // Aktions-Chips (Akt:C)
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  jump: '<path d="M5 12h11M12 7l5 5-5 5M20 5v14"/>',
  back: '<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
  comet: '<circle cx="16" cy="8" r="3"/><path d="M13.5 10.5L4 20M11 8L5 14M16 13l-6 6"/>',
  // Mini-Bento der Reiter im Zahnrad: Station = eine Kachel gefüllt (diese Station), Global = alle Kacheln (alle Stationen)
  station: '<rect x="3" y="3" width="9" height="18" rx="2"/><rect x="14" y="3" width="7" height="8" rx="2" fill="currentColor"/><rect x="14" y="13" width="7" height="8" rx="2"/>',
  global: '<g fill="currentColor"><rect x="3" y="3" width="9" height="18" rx="2"/><rect x="14" y="3" width="7" height="8" rx="2"/><rect x="14" y="13" width="7" height="8" rx="2"/></g>',
};
export const icon = (k, cls = 'b-ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.layers}</svg>`;
// Geänderte Werte (Vorschau Global:C, verdichtet 26.10.2026): ↺-Knopf am Zeilenende in fester Spalte statt eigener Zeile
// „geändert · Standard“; „n geändert · Alle zurücksetzen“ als kompakter Knopf rechts in der Sprungleiste
export const devLine = (k, label = '') => `<div class="b-dev" data-dev-of="${k}"><button type="button" class="b-reset b-reset--ico" data-reset="${k}" title="Auf Standard zurücksetzen" aria-label="${label ? `${esc(label)}: ` : ''}auf Standard zurücksetzen">${icon('reset')}</button></div>`;
// Regler (Regler:C): Füllung bis zum Wert (--p) und Strich am Standardwert (--d, 0…1) für die Skala in kosmos.css
export const paintRange = (i, def) => {
  const lo = +i.min, k = +i.max > lo ? 1 / (+i.max - lo) : 0;
  i.style.setProperty('--p', ((+i.value - lo) * k).toFixed(4));
  if (def !== undefined) i.style.setProperty('--d', ((def - lo) * k).toFixed(4));
};
export const devBar = () => `<button type="button" class="b-reset b-devbar" data-reset="*" hidden>${icon('reset')}<span><span data-devn></span> geändert · Alle zurücksetzen</span></button>`;
export function markDevs(root, isDev) {
  let n = 0;
  root.querySelectorAll('[data-dev-of]').forEach((d) => { const on = isDev(d.dataset.devOf); d.closest('.b-item').classList.toggle('is-dev', on); n += on; });
  const bar = root.querySelector('.b-devbar');
  if (bar) { bar.hidden = !n; bar.querySelector('[data-devn]').textContent = n; }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Auswahl statt breiter Knopf-Leiste (Vorschau 29.10.2026 „Einstellungs-Panels: breite Knopf-Leisten ersetzen“), auch für settings.js:
// 2 Werte → Schalter mit dem Wort des aktuellen Werts (Zwei:A; bei „Aus | X“ ist an = X), geordnete Stufen → Rast-Regler mit den
// Namen unter den Rasten und dem Wert rechts oben (Stufe:B), sonst Auswahlfeld rechts in der Zeile (Name:A).
// opts = [[wert, name]], lid = Id des Namens; data-pick = Schlüssel bzw. Ebene, Werte im DOM als Text (pickOf liest, showPick zeigt)
const OFF = /^aus$/i;
export function pickHtml(key, label, opts, { ordered = false, lid, cls = '' } = {}) {
  const vals = opts.map(([v]) => String(v)), names = opts.map(([, n]) => String(n));
  const data = `data-pick="${esc(key)}" data-vals="${esc(JSON.stringify(vals))}" data-names="${esc(JSON.stringify(names))}"`;
  if (opts.length === 2) {
    const on = OFF.test(names[1]) && !OFF.test(names[0]) ? 0 : 1;
    return `<label class="b-row b-pick cfg-toggle${cls}"><span class="cfg-label">${esc(label)}</span><span class="b-pair"><span class="b-word" data-word></span><input type="checkbox" role="switch" ${data} data-on="${esc(vals[on])}" data-off="${esc(vals[1 - on])}"><span class="switch switch--word" aria-hidden="true"></span></span></label>`;
  }
  if (ordered) {
    return `<div class="b-row b-stack b-rast${cls}"><span class="b-top"><span class="cfg-label" id="${lid}">${esc(label)}</span><output data-word></output></span>`
      + `<span class="b-track" style="--steps:${opts.length - 1}"><input type="range" min="0" max="${opts.length - 1}" step="1" aria-labelledby="${lid}" ${data}></span>`
      + `<span class="b-stops" aria-hidden="true">${names.map((n) => `<span>${esc(n)}</span>`).join('')}</span></div>`;
  }
  return `<div class="b-row b-pick${cls}"><span class="cfg-label" id="${lid}">${esc(label)}</span><select class="b-select" aria-labelledby="${lid}" ${data}>${opts.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join('')}</select></div>`;
}
const pickMeta = new WeakMap();
const metaOf = (el) => { let m = pickMeta.get(el); if (!m) pickMeta.set(el, m = { vals: JSON.parse(el.dataset.vals), names: JSON.parse(el.dataset.names) }); return m; };
export const pickOf = (el) => (el.type === 'checkbox' ? (el.checked ? el.dataset.on : el.dataset.off) : el.type === 'range' ? metaOf(el).vals[+el.value] : el.value);
// Wert v zeigen; def = Standardwert (Strich auf der Schiene des Rast-Reglers)
export function showPick(el, v, def) {
  const { vals, names } = metaOf(el), i = vals.indexOf(String(v));
  if (i < 0) return;
  const word = el.closest('.b-row').querySelector('[data-word]'), name = el.type === 'checkbox' && /^(an|aus)$/i.test(names[i]) ? names[i].toLowerCase() : names[i];
  if (word && word.textContent !== name) word.textContent = name;
  if (el.type === 'checkbox') el.checked = vals[i] === el.dataset.on;
  else if (el.type === 'range') {
    if (+el.value !== i) el.value = i;
    if (el.getAttribute('aria-valuetext') !== name) el.setAttribute('aria-valuetext', name);
    const d = vals.indexOf(String(def));
    paintRange(el, d < 0 ? undefined : d);
  } else if (el.value !== vals[i]) el.value = vals[i];
}
// Aktion als kleiner Chip mit Symbol + Verb (Akt:C); sagt der Knopf mehr als das Verb (z ≈ 20, ein Datum, ein Ereignis), steht das
// unter dem Namen (actMeta)
const ACTS = [[/komet/i, 'comet', 'Komet'], [/auslösen/i, 'bolt', 'Auslösen'], [/würfeln/i, 'dice', 'Würfeln'], [/^zurück$/i, 'back', 'Zurück'],
  [/^heute$/i, 'back', 'Heute'], [/abspielen|voyager|mondfinsternis/i, 'play', 'Abspielen']];
const VERBS = /^(jetzt auslösen|komet jetzt|springen|zurück|heute|abspielen|von vorn abspielen|neu würfeln|vorspulen|zum nächsten|zur nächsten|nächste finsternis)$/i;
const actMeta = (text) => (VERBS.test(text) ? '' : text);
const actChip = (attr, text, label) => {
  const [, ico, verb] = ACTS.find(([re]) => re.test(text)) || [0, 'jump', 'Springen'], meta = actMeta(text);
  return `<button type="button" class="act-chip" ${attr} aria-label="${esc(verb)}: ${esc(label)}${meta ? ` (${esc(meta)})` : ''}">${icon(ico, 'act-ico')}${verb}</button>`;
};
const store = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === 'object' ? s : {}; } catch { return {}; } })();
const url = (() => {
  const o = {}, q = new URLSearchParams(location.search).get('lay');
  if (q) for (const kv of q.split(',')) { const [k, v] = kv.split(':'); if (k && v !== undefined && Number.isFinite(+v)) o[k] = +v; }
  return o;
})();
const reg = new Map(), ctlReg = new Map();
let currentId = null, gearEl = null, onInfo = () => {}, stripEl = null, stripOn = () => true, gs = [], tabs = [], shows = [], sharedOf = () => [];
// Schalter der Station + Ebenen der Station + gemeinsame Gruppen (settings.js); null = keine davon
const allOf = (id) => {
  const ctl = (ctlReg.get(id) || {}).layers || [], own = reg.get(id) || [], ex = sharedOf(id);
  return ctl.length || own.length || ex.length ? [...ctl, ...own, ...ex] : null;
};
// Schalter der Infotafel → Zeilen: Segment (options [wert, name], Wert als Text), 'swatch' (Farbscheiben, detail), 'range',
// 'action'. Ton schaltet der Knopf der Kopfzeile (quick.js). Id mit Vorsatz c-, damit sie nie mit einer Ebene zusammenfällt.
const ctlLayer = (c) => {
  const show = c.type === 'action' || !!c.show;
  const l = { ...c, id: `c-${c.id}`, ctl: c, type: c.type || 'seg', show, group: show ? undefined : 'Ansicht', sub: false, def: c.value };
  delete l.get;
  l.set = (v) => { c.value = v; c.set(v); };
  return l;
};
export function setControls(stationId, controls = []) {
  const had = ctlReg.get(stationId);
  if (had && had.src === controls && had.n === controls.length) return;
  ctlReg.set(stationId, { src: controls, n: controls.length, layers: controls.filter((c) => c.id !== 'sound').map(ctlLayer) });
  if (stationId === currentId) render();
}
// Schalter mit get() folgen ihrem Zustand (z. B. Jahr läuft mit der Zeit), sonst gilt c.value (auch nach ?ctl=)
const pull = (l) => { if (l.ctl) l.value = l.ctl.get ? l.ctl.get() : l.ctl.value; };
// Schalter der Infotafel geändert: hud.js baut Abzeichen mit listIf neu auf und meldet die Bedienung an main.js
const tell = (l) => { if (l && l.ctl) window.dispatchEvent(new CustomEvent('kosmos:ctl', { detail: l.ctl.id })); };
// gewählter Reiter je Station (Index in gs); ohne Eintrag der erste
const OPEN_KEY = 'kosmos.cfgopen.v1';
const openStore = (() => { try { const s = JSON.parse(localStorage.getItem(OPEN_KEY)); return s && typeof s === 'object' ? s : {}; } catch { return {}; } })();

const valid = (l, v) => (l.type === 'toggle' ? typeof v === 'boolean' : typeof v === 'number' && Number.isFinite(v) && v >= l.min && v <= l.max);
export const fmtVal = (l, v) => (l.fmt ? l.fmt(v) : `${String(v).replace('.', ',')}${l.unit ? ` ${l.unit}` : ''}`);
const playing = (l) => (l.get ? !!l.get().playing : !!l.playing);
const find = (id) => (allOf(currentId) || []).find((l) => l.id === id);

export function registerLayers(stationId, layers) {
  reg.set(stationId, layers);
  const saved = store[stationId] || {};
  for (const l of layers) {
    if (l.def === undefined) l.def = l.value;
    let v = url[l.id] !== undefined ? url[l.id] : saved[l.id];
    if (l.type === 'toggle' && typeof v === 'number') v = v !== 0;
    if (v !== undefined && valid(l, v)) l.value = v;
    if (l.type === 'toggle' || l.type === 'range') l.set(l.value);
    else if (l.type === 'play') { const u = url[`${l.id}.play`]; l.playing = u === undefined ? !!l.autoplay : u === 1; l.set(l.value, l.playing); }
  }
  if (stationId === currentId) render();
}
export const layerValue = (stationId, id) => ((reg.get(stationId) || []).find((l) => l.id === id) || {}).value;
export const getLayer = (stationId, id) => (reg.get(stationId) || []).find((l) => l.id === id);
// Prüflauf tests/settings.py: alle Zeilen im Reiter Station (eigene + gemeinsame), leer bis die Station registriert ist
export const layersOf = (stationId) => (reg.has(stationId) ? allOf(stationId) : []);
// Info-Karte stellt eine Ebene direkt – gleiche Wirkung wie im Zahnrad (Wert setzen, speichern, Anzeigen abgleichen)
export function setLayer(stationId, id, v) {
  const l = getLayer(stationId, id);
  if (!l || l.type === 'play' || l.type === 'action' || !valid(l, v)) return;
  l.value = v;
  l.set(v);
  if (stationId === currentId) persist(l);
  sync();
}

function persist(l) {
  if (l.shared || l.ctl) return;   // gemeinsame Gruppe: setSetting hat schon gespeichert; Schalter der Infotafel: nie gespeichert
  store[currentId] = store[currentId] || {};
  store[currentId][l.id] = l.value;
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* privates Fenster */ }
}

// Bento: je group eine Karte, ▶-Ebene als Karte „Animation“ oben, sub-Ebenen als eingerückter Block unter ihrer Hauptzeile.
// Regler mit wenigen benannten Stufen (fmt ohne Ziffern, ≤ 5 Stufen) sind eine Auswahl wie 'seg': Schalter, Rast-Regler oder
// Auswahlfeld (pickHtml), mit buttons: true eine Knopfreihe; Zahlen-Regler zweizeilig.
const isChoice = (l) => l.type === 'range' && l.fmt && (l.step ?? 1) === 1 && l.max - l.min <= 4 && !/\d/.test(String(l.fmt(l.min)));
const ticks = (l) => ((l.step ?? 1) >= 1 && l.max - l.min <= 12 ? ` style="--n:${l.max - l.min}"` : '');
const steps = (l) => Array.from({ length: l.max - l.min + 1 }, (_, i) => l.min + i);
const isPick = (l) => !l.buttons && (l.type === 'seg' || isChoice(l));
const choicesOf = (l) => (l.type === 'seg' ? l.options : steps(l).map((v) => [v, l.fmt(v)]));
const range = (l, label = l.label) => `<span class="b-track"${ticks(l)}><input type="range" data-lay="${l.id}" min="${l.min}" max="${l.max}" step="${l.step ?? 1}" aria-label="${esc(label)}"></span>`;

const rowHtml = (l) => {
  let row;
  if (l.type === 'toggle') row = `<label class="b-row cfg-toggle lay"><span class="cfg-label">${esc(l.label)}</span><input type="checkbox" data-lay="${l.id}"><span class="switch" aria-hidden="true"></span></label>`;
  else if (isPick(l)) row = pickHtml(l.id, l.label, choicesOf(l), { ordered: l.ordered, lid: `lay-${l.id}`, cls: ' lay' });
  else if (isChoice(l)) row = `<div class="b-row b-stack lay"><span class="cfg-label" id="lay-${l.id}">${esc(l.label)}</span><div class="seg b-seg" role="radiogroup" aria-labelledby="lay-${l.id}">${steps(l).map((v) => `<button type="button" role="radio" data-lay-seg="${l.id}" data-val="${v}">${esc(l.fmt(v))}</button>`).join('')}</div></div>`;
  else if (l.type === 'seg') row = `<div class="b-row b-stack lay"><span class="cfg-label" id="lay-${l.id}">${esc(l.label)}</span><div class="seg b-seg" role="radiogroup" aria-labelledby="lay-${l.id}">${l.options.map(([v, n]) => `<button type="button" role="radio" data-lay-seg="${l.id}" data-val="${esc(v)}">${esc(n)}</button>`).join('')}</div></div>`;
  else if (l.type === 'swatch') row = `<div class="b-row b-stack lay"><span class="cfg-label" id="lay-${l.id}">${esc(l.label)}</span><div class="swatch" role="radiogroup" aria-labelledby="lay-${l.id}">${l.options.map(([v, n, bg]) => `<button type="button" role="radio" data-lay-seg="${l.id}" data-val="${esc(v)}"><i class="sw-disc" style="background:${bg}" aria-hidden="true"></i><b>${esc(n)}</b></button>`).join('')}</div></div>`;
  else if (l.type === 'range') row = `<label class="b-row b-stack lay"><span class="b-top"><span class="cfg-label">${esc(l.label)}</span><output data-lout="${l.id}"></output></span>${range(l)}</label>`;
  else {
    const t = l.button || 'Auslösen', meta = actMeta(t);
    row = `<div class="b-row lay"><span class="b-lab"><span class="cfg-label">${esc(l.label)}</span>${meta ? `<span class="b-meta">${esc(meta)}</span>` : ''}</span>${actChip(`data-act="${l.id}"`, t, l.label)}</div>`;
  }
  return row + (l.marks ? `<div class="zg-rail zg-rail--y" data-ymarks="${l.id}">${l.marks.map(([v, n]) => `<button type="button" class="zg-mark" data-ymark="${l.id}" data-val="${v}" style="--x:${((v - l.min) / (l.max - l.min)).toFixed(4)}">${esc(n)}</button>`).join('')}</div>` : '')
    + (l.detail ? `<div class="sw-detail" data-swd="${l.id}"></div>` : '')
    + (l.hint ? `<p class="cfg-note lay-hint">${prose(l.hint)}</p>` : '') + (l.only ? `<p class="cfg-note lay-hint" data-only="${l.id}" hidden>${prose(l.only)}</p>` : '');
};

// Gruppen nach Kurzname (tabs.js): gleicher Kurzname = ein Reiter, je voller Name ein Abschnitt (segs) darin. Zeilen für den
// Block „Zeigen“ (show) fehlen hier; ihr group gilt trotzdem für die folgenden Zeilen. Nach den Schaltern der Infotafel beginnt
// immer eine neue Gruppe.
function groups(layers) {
  const out = [];
  let seg = null, name = null, ctl = false;
  for (const l of layers) {
    if (l.group || !!l.ctl !== ctl) { name = l.group || 'Allgemein'; seg = null; ctl = !!l.ctl; }
    if (l.show) continue;
    if (!seg) {
      name = name || 'Allgemein';
      const title = tabOf(name);
      let g = out.find((x) => x.title === title);
      if (!g) out.push(g = { title, items: [], segs: [] });
      seg = g.segs.find((s) => s.title === name);
      if (!seg) g.segs.push(seg = { title: name, g, items: [] });
    }
    if (l.sub && seg.items.length) seg.items[seg.items.length - 1].subs.push(l);
    else { const it = { l, subs: [] }; seg.items.push(it); seg.g.items.push(it); }
  }
  return out;
}
const count = (g) => g.items.reduce((n, it) => n + 1 + it.subs.length, 0);
// Zeit-Regler im Block „Zeigen“ laufen mit der Station mit – kein ↺, zählen nicht als geändert
const resettable = (l) => ['toggle', 'range', 'seg', 'swatch'].includes(l.type) && !shows.includes(l);
const rowDev = (l) => rowHtml(l) + (resettable(l) ? devLine(l.id, l.label) : '');
const block = ({ l, subs }) => `<div class="b-item">${rowDev(l)}${subs.length ? `<div class="b-subs"${l.type === 'toggle' ? ` data-subs="${l.id}"` : ''}>${subs.map((x) => `<div class="b-item">${rowDev(x)}</div>`).join('')}</div>` : ''}</div>`;

// Block „Zeigen“: ▶-Ebene (Kopf, Achse, Tempo), dann Zeit-Regler und Knöpfe ohne Marke auf der Achse
const axisOf = (p, evs) => !!(p && p.now && evs.some((e) => e.at));
function showHtml(items) {
  const p = items.find((l) => l.type === 'play'), evs = items.filter((l) => l.type === 'action'), axis = axisOf(p, evs);
  const rows = items.filter((l) => l !== p && !(axis && l.at));
  const head = p
    ? `<div class="zg-head"><button type="button" class="play-btn play-btn--lg" data-play="${p.id}" aria-pressed="false" aria-label="${esc(p.label)} abspielen">${PLAY}</button>
        <span class="zg-text"><span class="zg-title" data-status="${p.id}"></span><span class="zg-sub" data-chip="${p.id}"></span></span>
        <output class="zg-big" data-lout="${p.id}"></output></div>
      ${axis ? `<div class="zg-axis" data-axis="${p.id}"><div class="zg-rail zg-rail--m" data-amarks></div><div class="zg-line" data-aline><span class="zg-now" aria-hidden="true"></span></div><div class="zg-rail zg-rail--t" data-aticks></div></div>` : ''}
      <label class="zg-tempo"><span class="cfg-label">Tempo</span>${range(p, `${p.label}: Tempo`)}</label>
      ${axis ? `<div class="zg-next" data-anext hidden><span class="zg-next-t"><span>Nächstes: <b data-next-name></b></span><span class="zg-sub" data-next-in></span></span>${actChip('data-next', 'Springen', 'nächstes Ereignis')}</div>` : ''}`
    : '';
  return `<section class="zg" aria-label="Zeigen">${head}${rows.map((l) => `<div class="b-item">${rowHtml(l)}</div>`).join('')}${p && p.hint ? `<p class="cfg-note lay-hint">${prose(p.hint)}</p>` : ''}</section>`;
}

const isPlay = (g) => g.items[0].l.type === 'play';
const changed = (l) => resettable(l) && l.value !== l.def;
const itemsOf = (g) => g.items.flatMap(({ l, subs }) => [l, ...subs]);
// Inhalt eines Reiters; Zwischenüberschrift je vollem Gruppen-Namen, wenn er vom Kurznamen abweicht oder mehrere zusammenliegen
// Gemeinsame Gruppe: Überschrift immer, darunter ihre Geltung (scope)
const tabBody = (g) => g.segs.map((s) => {
  const scope = s.items[0] && s.items[0].l.scope;
  return `${g.segs.length > 1 || s.title !== g.title || scope ? `<h5 class="b-subh">${esc(s.title)}</h5>` : ''}${scope ? `<p class="cfg-note lay-hint">${prose(scope)}</p>` : ''}${s.items.map(block).join('')}`;
}).join('');
// Leiste unter dem Kopf (Menü:C): quadratische Kacheln im selben Raster wie Allgemeine Einstellungen (cfg-jump/cfg-tile, User 29.10.2026),
// je Gruppe Icon, Kurzname und Zahl; „Ereignisse“ (Block „Zeigen“) als erster Eintrag mit
// ▶/⏸-Zustand, Zahl der Ereignisse und Punkt bei anstehendem Ereignis. Index -1 = Ereignisse; Punkt an Gruppen = Wert geändert
const tid = (i) => (i < 0 ? 'z' : i);
const evN = () => shows.filter((l) => l.type === 'action').length;
const tabBtn = (i, on) => {
  const z = i < 0, name = z ? 'Ereignisse' : gs[i].title, n = z ? evN() : count(gs[i]);
  const ico = z ? `<span class="st-play" data-rail-play aria-hidden="true">${PLAY}</span>` : icon(tabIcon(gs[i].title), 'cfg-tile-ico');
  return `<button type="button" role="tab" class="cfg-tile st-tab lay-tab" id="lay-t${tid(i)}" data-ltab="${i}" aria-controls="lay-p${tid(i)}" aria-selected="${on}" tabindex="${on ? 0 : -1}">${ico}<span class="st-tab-name">${esc(name)}</span>${n ? `<span class="st-tab-n">${n}</span>` : ''}<span class="lay-tab-dot" aria-hidden="true"></span></button>`;
};
const stageHead = (name, n) => `<h3 class="st-title">${esc(name)}${n ? `<span class="st-title-n">${n}</span>` : ''}</h3>`;

function gearHtml(layers) {
  gs = groups(layers);
  // Ereignisse: Gruppe der ▶-Ebene (mit Unter-Zeilen) + alle show-Zeilen in ihrer Reihenfolge
  shows = [...gs.filter(isPlay).flatMap(itemsOf), ...layers.filter((l) => l.show)];
  tabs = [...(shows.length ? [-1] : []), ...gs.map((g, i) => (isPlay(g) ? -1 : i)).filter((i) => i >= 0)];
  const saved = (openStore[currentId] || [])[0], cur = tabs.includes(saved) ? saved : tabs[0];
  const rail = `<div class="cfg-jump st-rail" role="tablist" aria-label="Gruppen der Station">${tabs.map((i) => tabBtn(i, i === cur)).join('')}</div>`;
  const panels = tabs.map((i) => `<div class="lay-panel b-body" id="lay-p${tid(i)}" role="tabpanel" aria-labelledby="lay-t${tid(i)}"${i === cur ? '' : ' hidden'}>${i < 0 ? stageHead('Ereignisse', evN()) + showHtml(shows) : stageHead(gs[i].title, count(gs[i])) + tabBody(gs[i])}</div>`).join('');
  return `${rail}<div class="st-stage lay-scroll">${panels}</div><div class="cfg-foot"><span class="cfg-scope">Diese Station · <span data-lay-sum></span></span>${devBar()}</div>`;
}
// Eintrag wählen (Klick, ↑/↓, ←/→, Pos1/Ende) und merken; Bühne beginnt oben
function pickTab(i, focus) {
  gearEl.querySelectorAll('[data-ltab]').forEach((t) => { const on = +t.dataset.ltab === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
  gearEl.querySelectorAll('.lay-panel').forEach((p) => { p.hidden = p.id !== `lay-p${tid(i)}`; });
  const st = gearEl.querySelector('.st-stage');
  if (st) st.scrollTop = 0;
  openStore[currentId] = [i];
  try { localStorage.setItem(OPEN_KEY, JSON.stringify(openStore)); } catch { /* privates Fenster */ }
  sync();   // Zeitachse braucht die Breite der sichtbaren Bühne
}
const PREV = ['ArrowUp', 'ArrowLeft'], NEXT = ['ArrowDown', 'ArrowRight'];
function onKey(e) {
  const t = e.target.closest && e.target.closest('[data-ltab]');
  if (!t || ![...PREV, ...NEXT, 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  e.stopPropagation();   // sonst fliegt main.js mit ←/→ zur Nachbarstation
  const k = tabs.indexOf(+t.dataset.ltab), n = tabs.length;
  pickTab(tabs[e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (k + (NEXT.includes(e.key) ? 1 : n - 1)) % n], true);
}

function render() {
  evc = null;   // neue Zeilen (z. B. Knöpfe der Infotafel kommen nach den Ebenen) → Ereignisse neu suchen
  if (gearEl) {
    const layers = allOf(currentId), st = STATIONS[currentId];
    gearEl.innerHTML = layers ? gearHtml(layers) : '<p class="cfg-note">Diese Station hat keine eigenen Einstellungen.</p>';
    if (!layers) { gs = []; tabs = []; }
    onInfo({ title: st ? st.title : '…', n: layers ? layers.length : 0, groups: tabs.length });
    const sum = gearEl.querySelector('[data-lay-sum]');
    if (sum) sum.textContent = gearEl.closest('.station').dataset.laySum || '';
  }
  if (stripEl) {
    const l = (allOf(currentId) || []).find((x) => x.type === 'play');
    stripEl.hidden = !l || !stripOn();
    document.body.classList.toggle('tl-on', !stripEl.hidden);
    if (l) stripEl.innerHTML = `<button type="button" class="play-btn play-btn--lg" data-play="${l.id}" aria-pressed="false" aria-label="${esc(l.label)} abspielen">${PLAY}</button>
      <div class="tl-text"><span class="tl-label">${esc(l.label)}</span><span class="tl-status" data-status="${l.id}"></span></div>
      <input type="range" data-lay="${l.id}" min="${l.min}" max="${l.max}" step="${l.step ?? 1}" aria-label="${esc(l.label)}: Tempo"><output data-lout="${l.id}"></output>`;
  }
  sync();
}
// Stationen gleichen Infotafel und Zahnrad aus set() heraus ab: nur Werte nachziehen, nicht neu aufbauen – ein Neuaufbau ersetzt
// den Regler, den man gerade zieht, und das Ziehen bricht ab. Neu aufbauen nur, wenn sich der Aufbau ändert (Zeitleiste an/aus).
export function refreshLayers() { sync(); }
export function rebuildLayers() { render(); }

// ---------- Zeitachse im Block „Zeigen“ ----------
const DAY_FMT = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const dateOf = (jd) => new Date((jd - 2440587.5) * 864e5);
const dayLabel = (jd) => { const p = Object.fromEntries(DAY_FMT.formatToParts(dateOf(jd)).map((x) => [x.type, x.value])); return `${p.weekday.replace('.', '')} ${p.day}.`; };
const inTime = (d) => {
  const m = Math.round(d * 1440), dd = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (dd) return `in ${dd} ${dd === 1 ? 'Tag' : 'Tagen'}${h ? ` ${h} h` : ''}`;
  return h ? `in ${h} h${mm ? ` ${mm} min` : ''}` : `in ${Math.max(1, mm)} min`;
};
// Ereignisse zwischen from und to (je Knopf höchstens 12), nach Zeit sortiert
function eventsIn(evs, from, to) {
  const out = [];
  for (const e of evs) {
    if (!e.at) continue;
    for (let t = from, k = 0; k < 12; k++) {
      const r = e.at(t, to), tt = r === null || r === undefined ? null : typeof r === 'number' ? r : r.t;
      if (tt === null || tt > to) break;
      out.push({ e, t: tt, mark: (r && r.mark) || e.mark || e.label });
      t = tt + 1 / 48;   // halbe Stunde nach dem Eintritt weitersuchen: sonst findet der Knopf denselben Eintritt
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
// Zwischenspeicher: Marken für [now, now + 1,5 Spannen], neu erst nach einer halben Spanne oder nach einem Sprung zurück;
// „Nächstes“ jenseits davon (Deimos: Finsternisse nur um die Tagundnachtgleichen) einmal bis zum Horizont
let evc = null;
function axisEvents(p, evs) {
  const now = p.now(), span = p.span || 4;
  if (!evc || evc.sid !== currentId || evc.p !== p || now < evc.from || now > evc.from + span / 2) {
    evc = { sid: currentId, p, from: now, to: now + span * 1.5, list: eventsIn(evs, now, now + span * 1.5), next: undefined };
  }
  let next = evc.list.find((x) => x.t >= now);
  if (!next) {
    if (evc.next === undefined || (evc.next && evc.next.t < now)) {
      const far = Math.max(...evs.filter((e) => e.at).map((e) => e.horizon || 60));
      evc.next = eventsIn(evs.map((e) => ({ ...e, at: e.at && ((a, b) => e.at(a, Math.min(b, now + (e.horizon || 60)))) })), evc.to, now + far)[0] || null;
    }
    next = evc.next;
  }
  return { now, span, list: evc.list.filter((x) => x.t >= now && x.t <= now + span), next };
}
// Beschriftungen nebeneinander ohne Überlappung: je Name die erste freie Zeile (höchstens rows), sonst ausgeblendet
function placeLabels(els, W, rows, pad = 6) {
  const ends = Array(rows).fill(-Infinity);
  for (const el of els) {
    const w = el.offsetWidth, x = +el.style.getPropertyValue('--x') * W, left = Math.min(Math.max(0, x - w / 2), W - w);
    const r = ends.findIndex((e) => e + pad <= left);
    el.hidden = false;
    if (r < 0) { el.style.visibility = 'hidden'; continue; }
    el.style.visibility = '';
    el.style.left = `${left}px`;
    el.style.top = `${r * 30}px`;
    ends[r] = left + w;
  }
  return ends.filter((e) => e > -Infinity).length;
}
// Kinder eines Behälters nach Schlüssel abgleichen: bestehende behalten (Hover, Fokus, laufender Klick), neue anlegen, alte entfernen
// (pre = Vorsatz der Schlüssel: Skala und Rauten teilen sich die Linie)
function keyed(box, items, make, pre = '') {
  const old = new Map([...box.querySelectorAll(':scope > [data-k]')].filter((el) => el.dataset.k.startsWith(pre)).map((el) => [el.dataset.k, el]));
  const out = items.map((it) => { let el = old.get(it.k); if (el) old.delete(it.k); else { el = make(it); el.dataset.k = it.k; box.appendChild(el); } return el; });
  old.forEach((el) => el.remove());
  return out;
}
const node = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
function syncAxis(root) {
  const ax = root.querySelector('[data-axis]');
  if (!ax) return;
  const p = find(ax.dataset.axis), evs = shows.filter((l) => l.type === 'action');
  const { now, span, list, next } = axisEvents(p, evs), x = (t) => ((t - now) / span).toFixed(4);
  // Skala: Mitternacht (UTC) mit Wochentag, bei kurzer Spanne dazwischen alle 6 h
  const step = span <= 1.5 ? 0.25 : span <= 12 ? 1 : 7, ticks = [];
  for (let t = Math.ceil((now - 0.5) / step) * step + 0.5; t <= now + span; t += step) {
    const mid = Math.abs(((t - 0.5) % 1 + 1) % 1) < 1e-6;
    ticks.push({ k: String(Math.round(t * 96)), t, label: mid ? dayLabel(t) : `${Math.round((((t - 0.5) % 1 + 1) % 1) * 24)} h` });
  }
  const line = ax.querySelector('[data-aline]'), tbox = ax.querySelector('[data-aticks]'), mbox = ax.querySelector('[data-amarks]');
  keyed(line, ticks.map((tk) => ({ ...tk, k: `s${tk.k}` })), () => node('<span class="zg-tick" aria-hidden="true"></span>'), 's').forEach((el, i) => el.style.setProperty('--x', x(ticks[i].t)));
  const labs = keyed(tbox, [{ k: 'now', label: 'jetzt', t: now }, ...ticks], (tk) => node(`<span class="zg-tl">${esc(tk.label)}</span>`));
  labs.forEach((el, i) => el.style.setProperty('--x', i ? x(ticks[i - 1].t) : '0'));
  const keyOf = (ev) => `${ev.e.id}@${Math.round(ev.t * 1440)}`;
  keyed(line, list.map((ev) => ({ ...ev, k: `d${keyOf(ev)}` })), (ev) => node(`<span class="zg-dia" data-mark="${keyOf(ev)}" aria-hidden="true"></span>`), 'd').forEach((el, i) => el.style.setProperty('--x', x(list[i].t)));
  const marks = keyed(mbox, list.map((ev) => ({ ...ev, k: keyOf(ev) })), (ev) => node(`<button type="button" class="zg-mark" data-mark="${keyOf(ev)}">${esc(ev.mark)}</button>`));
  marks.forEach((el, i) => { el.style.setProperty('--x', x(list[i].t)); el.setAttribute('aria-label', `${list[i].mark}, ${inTime(list[i].t - now)} – springen`); });
  ax.hidden = false;
  const W = line.clientWidth;
  placeLabels(labs, W, 1, 14);
  mbox.style.height = `${Math.max(1, placeLabels(marks, W, 2)) * 30}px`;
  axMarks = new Map([...list, ...(next ? [next] : [])].map((ev) => [keyOf(ev), ev]));
  const nx = root.querySelector('[data-anext]');
  nx.hidden = !next;
  if (next) {
    nx.querySelector('[data-next-name]').textContent = next.mark;
    nx.querySelector('[data-next-in]').textContent = nbsp(inTime(next.t - now));
    nx.querySelector('[data-next]').dataset.go = keyOf(next);
  }
}
let axMarks = new Map();
// Jahres-Marken unter einem Regler (Jahr): Namen ohne Überlappung, gewählte Marke hervorgehoben
function syncYears(root) {
  root.querySelectorAll('[data-ymarks]').forEach((box) => {
    const l = find(box.dataset.ymarks), els = [...box.children];
    if (!l) return;
    els.forEach((b) => b.setAttribute('aria-pressed', String(Math.round(l.value) === +b.dataset.val)));
    box.style.height = `${Math.max(1, placeLabels(els, box.clientWidth, 2)) * 30}px`;
  });
}

function sync() {
  for (const l of allOf(currentId) || []) pull(l);
  for (const root of [gearEl, stripEl]) {
    if (!root || root.hidden) continue;
    root.querySelectorAll('[data-lay]').forEach((i) => {
      const l = find(i.dataset.lay);
      if (!l) return;
      if (i.type === 'checkbox') i.checked = !!l.value;
      else { const v = l.type === 'play' && l.get ? l.get().value : l.value; if (document.activeElement !== i) i.value = v; const o = root.querySelector(`[data-lout="${l.id}"]`); if (o) o.textContent = nbsp(fmtVal(l, +i.value)); paintRange(i, l.type === 'play' ? undefined : l.def); }
    });
    root.querySelectorAll('[data-play]').forEach((b) => {
      const l = find(b.dataset.play);
      if (!l) return;
      const on = playing(l);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', `${l.label} ${on ? 'anhalten' : 'abspielen'}`);
      b.innerHTML = on ? PAUSE : PLAY;
    });
    root.querySelectorAll('[data-status]').forEach((s) => { const l = find(s.dataset.status); if (l && l.status) s.textContent = nbsp(l.status()); });
    root.querySelectorAll('[data-lay-seg]').forEach((b) => { const l = find(b.dataset.laySeg); if (l) b.setAttribute('aria-checked', String(String(l.value) === b.dataset.val)); });
    root.querySelectorAll('[data-pick]').forEach((el) => { const l = find(el.dataset.pick); if (l) showPick(el, l.value, l.def); });
    root.querySelectorAll('[data-swd]').forEach((d) => { const l = find(d.dataset.swd); if (l && d.dataset.v !== String(l.value)) { d.dataset.v = String(l.value); d.innerHTML = l.detail(l.value); } });
    root.querySelectorAll('[data-chip]').forEach((c) => { const l = find(c.dataset.chip); if (l) c.textContent = `${playing(l) ? 'läuft' : 'angehalten'} · ${l.label}`; });
    // Unter-Ebenen ohne Wirkung, solange ihr Hauptschalter aus ist: abgedunkelt, aber bedienbar
    root.querySelectorAll('[data-subs]').forEach((el) => { const l = find(el.dataset.subs); if (l) el.classList.toggle('is-off', !l.value); });
    // Ebene ohne Wirkung im aktuellen Bild (active() falsch): Zeile abgedunkelt, Grund darunter
    root.querySelectorAll('[data-only]').forEach((p) => { const l = find(p.dataset.only); const idle = !!l && !!l.active && !l.active(); p.hidden = !idle; p.parentElement.classList.toggle('is-idle', idle); });
  }
  if (gearEl && !gearEl.hidden) {
    syncAxis(gearEl);
    syncYears(gearEl);
    markDevs(gearEl, (id) => { const l = find(id); return !!l && changed(l); });
    // Punkt am Eintrag: in dieser Gruppe weicht ein Wert vom Standard ab (Vorschau 27.10.2026 F3); Ereignisse: eins steht an
    const p = shows.find((l) => l.type === 'play'), on = !!p && playing(p), soon = !!gearEl.querySelector('[data-amarks] [data-mark]');
    gearEl.querySelectorAll('[data-ltab]').forEach((t) => {
      const i = +t.dataset.ltab, g = gs[i], z = i < 0, dev = z ? soon : !!g && itemsOf(g).some(changed);
      t.classList.toggle('has-dev', dev);
      const lab = z ? `Ereignisse, ${evN()}${p ? `, ${on ? 'läuft' : 'angehalten'}` : ''}${soon ? ', Ereignis steht an' : ''}`
        : `${g ? g.title : ''}, ${g ? count(g) : 0} Einstellungen${dev ? ', geändert' : ''}`;
      if (t.getAttribute('aria-label') !== lab) t.setAttribute('aria-label', lab);
    });
    const rp = gearEl.querySelector('[data-rail-play]');
    if (rp && rp.dataset.on !== String(on)) { rp.dataset.on = String(on); rp.innerHTML = on ? PAUSE : PLAY; }
  }
}

function onInput(e) {
  const i = e.target;
  if (i.dataset && i.dataset.pick) {
    // Auswahl: Text aus dem DOM zurück in den Wert der Ebene (Zahl beim Regler, sonst wie in options)
    const l = find(i.dataset.pick), o = l && choicesOf(l).find(([v]) => String(v) === pickOf(i));
    if (!o) return;
    l.value = o[0]; l.set(l.value); persist(l); tell(l); sync();
    return;
  }
  const l = i.dataset && i.dataset.lay ? find(i.dataset.lay) : null;
  if (!l) return;
  if (l.type === 'toggle') l.value = i.checked; else l.value = +i.value;
  if (l.type === 'play') l.set(l.value, playing(l)); else l.set(l.value);
  persist(l);
  tell(l);
  sync();
}
function onClick(e) {
  const t = e.target.closest('[data-ltab]');
  if (t && gearEl && gearEl.contains(t)) { pickTab(+t.dataset.ltab); return; }
  const r = e.target.closest('[data-reset]');
  if (r && gearEl && gearEl.contains(r)) {
    for (const l of allOf(currentId) || []) if (resettable(l) && (r.dataset.reset === '*' || r.dataset.reset === l.id) && l.value !== l.def) { l.value = l.def; l.set(l.value); persist(l); tell(l); }
    sync();
    return;
  }
  // Marke auf der Zeitachse oder „Nächstes · Springen“: zum Ereignis springen; Jahres-Marke: Regler auf das Jahr
  const m = e.target.closest('[data-mark],[data-go]'), ev = m && axMarks.get(m.dataset.mark || m.dataset.go);
  if (ev) { ev.e.go(ev.t); tell(ev.e); sync(); return; }
  const y = e.target.closest('[data-ymark]'), yl = y && find(y.dataset.ymark);
  if (yl) { yl.value = +y.dataset.val; yl.set(yl.value); persist(yl); tell(yl); sync(); return; }
  const s = e.target.closest('[data-lay-seg]'), sl = s && find(s.dataset.laySeg);
  if (sl) { sl.value = sl.type === 'range' ? +s.dataset.val : s.dataset.val; sl.set(sl.value); persist(sl); tell(sl); sync(); return; }
  const b = e.target.closest('[data-play],[data-act]');
  if (!b) return;
  const l = find(b.dataset.play || b.dataset.act);
  if (!l) return;
  if (l.type === 'play') { l.playing = !playing(l); l.set(l.value, l.playing); } else if (l.run) l.run();
  tell(l);
  sync();
}
function poll() {
  const id = (location.hash.match(/station=(\w+)/) || [])[1] || 'earth';
  if (id !== currentId) { currentId = id; render(); }
}

// info({ title, n, groups }) nach jedem Aufbau: Name der Station, Zahl der Einstellungen und Reiter (Knopf, Fenster-Kopf);
// shared(id) = zusätzliche Zeilen aus anderen Modulen (zurzeit keine: gemeinsame Werte stehen in den Einstellungen, settings.js)
export function mountLayers({ gear, info, strip, stripOn: on, shared }) {
  gearEl = gear; onInfo = info || onInfo; stripEl = strip; stripOn = on || stripOn; sharedOf = shared || sharedOf;
  gearEl.addEventListener('keydown', onKey);
  for (const root of [gearEl, stripEl]) { if (!root) continue; root.addEventListener('input', onInput); root.addEventListener('click', onClick); }
  window.addEventListener('hashchange', poll);
  poll();
  setInterval(() => { poll(); sync(); }, 300);
}
