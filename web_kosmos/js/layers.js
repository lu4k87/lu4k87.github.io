// Einstellungen je Station (Muster Biochar): Reiter „Station“ der rechten Spalte (settings.js) und Zeitleiste (Player)
// unten links. Aufbau (Vorschau 28.10.2026 Reiter:C, zweite Vorschau 28.10.2026 „Regler der Infotafel in den Reiter Station“
// Reiter:C): oben Block „Zeigen“ (▶/⏸ + Stand, Zeitachse mit Spielkopf und Ereignismarken, Tempo, „Nächstes · Springen“,
// Zeit-Regler und Ereignis-Knöpfe), darunter „Einstellungen“: Gruppen als Unterstrich-Reiter in einer Zeile (Kurzname aus tabs.js
// + Zahl der Ebenen, Punkt bei geändertem Wert; ←/→ wie Reiter, seitlich schiebbar, bleibt beim Scrollen oben stehen), genau eine
// Gruppe sichtbar (je Station gemerkt in `kosmos.cfgopen.v1`), Fuß „nur an dieser Station · Alle zurücksetzen“.
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
// Dazu die gemeinsamen Gruppen aus settings.js (shared: true, Wert in `kosmos.settings.v1`, gilt an allen Stationen der Gruppe;
// scope an der ersten Zeile = Hinweis unter der Überschrift). Werte je Station in localStorage `kosmos.layers.v1` (nicht der Abspielzustand); URL `?lay=aurora:0,kp:7,clock.play:1` für
// Screenshots. Aktive Station aus `#station=…` (main.js setzt den Hash per replaceState → ohne Ereignis, daher Takt 300 ms).

import { STATIONS } from './content.js';
import { prose, nbsp } from './figs.js';
import { tabOf } from './tabs.js';

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
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
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
// Regler mit wenigen benannten Stufen (fmt ohne Ziffern, ≤ 5 Stufen) erscheinen als Knopfreihe; Zahlen-Regler zweizeilig.
const isChoice = (l) => l.type === 'range' && l.fmt && (l.step ?? 1) === 1 && l.max - l.min <= 4 && !/\d/.test(String(l.fmt(l.min)));
const ticks = (l) => ((l.step ?? 1) >= 1 && l.max - l.min <= 12 ? ` style="--n:${l.max - l.min}"` : '');
const steps = (l) => Array.from({ length: l.max - l.min + 1 }, (_, i) => l.min + i);
const range = (l, label = l.label) => `<span class="b-track"${ticks(l)}><input type="range" data-lay="${l.id}" min="${l.min}" max="${l.max}" step="${l.step ?? 1}" aria-label="${esc(label)}"></span>`;

const rowHtml = (l) => {
  let row;
  if (l.type === 'toggle') row = `<label class="b-row cfg-toggle lay"><span class="cfg-label">${esc(l.label)}</span><input type="checkbox" data-lay="${l.id}"><span class="switch" aria-hidden="true"></span></label>`;
  else if (isChoice(l)) row = `<div class="b-row b-stack lay"><span class="cfg-label" id="lay-${l.id}">${esc(l.label)}</span><div class="seg b-seg" role="radiogroup" aria-labelledby="lay-${l.id}">${steps(l).map((v) => `<button type="button" role="radio" data-lay-seg="${l.id}" data-val="${v}">${esc(l.fmt(v))}</button>`).join('')}</div></div>`;
  else if (l.type === 'seg') row = `<div class="b-row b-stack lay"><span class="cfg-label" id="lay-${l.id}">${esc(l.label)}</span><div class="seg b-seg" role="radiogroup" aria-labelledby="lay-${l.id}">${l.options.map(([v, n]) => `<button type="button" role="radio" data-lay-seg="${l.id}" data-val="${esc(v)}">${esc(n)}</button>`).join('')}</div></div>`;
  else if (l.type === 'swatch') row = `<div class="b-row b-stack lay"><span class="cfg-label" id="lay-${l.id}">${esc(l.label)}</span><div class="swatch" role="radiogroup" aria-labelledby="lay-${l.id}">${l.options.map(([v, n, bg]) => `<button type="button" role="radio" data-lay-seg="${l.id}" data-val="${esc(v)}"><i class="sw-disc" style="background:${bg}" aria-hidden="true"></i><b>${esc(n)}</b></button>`).join('')}</div></div>`;
  else if (l.type === 'range') row = `<label class="b-row b-stack lay"><span class="b-top"><span class="cfg-label">${esc(l.label)}</span><output data-lout="${l.id}"></output></span>${range(l)}</label>`;
  else row = `<div class="b-row lay"><span class="cfg-label">${esc(l.label)}</span><button type="button" class="act-btn" data-act="${l.id}">${esc(l.button || 'Auslösen')}</button></div>`;
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
        <span class="zg-text"><span class="zg-title">Zeigen · <span data-status="${p.id}"></span></span><span class="zg-sub" data-chip="${p.id}"></span></span>
        <output class="zg-big" data-lout="${p.id}"></output></div>
      ${axis ? `<div class="zg-axis" data-axis="${p.id}"><div class="zg-rail zg-rail--m" data-amarks></div><div class="zg-line" data-aline><span class="zg-now" aria-hidden="true"></span></div><div class="zg-rail zg-rail--t" data-aticks></div></div>` : ''}
      <label class="zg-tempo"><span class="cfg-label">Tempo</span>${range(p, `${p.label}: Tempo`)}</label>
      ${axis ? `<div class="zg-next" data-anext hidden><span class="zg-next-t"><span>Nächstes: <b data-next-name></b></span><span class="zg-sub" data-next-in></span></span><button type="button" class="act-btn" data-next>Springen</button></div>` : ''}`
    : '<div class="zg-head"><span class="zg-title">Zeigen</span></div>';
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
const tabBtn = (i, on) => `<button type="button" role="tab" class="u-tab lay-tab" id="lay-t${i}" data-ltab="${i}" aria-controls="lay-p${i}" aria-selected="${on}" tabindex="${on ? 0 : -1}">${esc(gs[i].title)} <span class="c" aria-hidden="true">${count(gs[i])}</span><span class="lay-tab-dot" aria-hidden="true"></span></button>`;

function gearHtml(layers) {
  gs = groups(layers);
  tabs = gs.map((g, i) => (isPlay(g) ? -1 : i)).filter((i) => i >= 0);
  // Zeigen: Gruppe der ▶-Ebene (mit Unter-Zeilen) + alle show-Zeilen in ihrer Reihenfolge
  shows = [...gs.filter(isPlay).flatMap(itemsOf), ...layers.filter((l) => l.show)];
  const saved = (openStore[currentId] || [])[0], cur = tabs.includes(saved) ? saved : tabs[0], bar = tabs.length > 1;
  const strip = bar ? `<div class="u-tabs u-tabs--sub lay-tabs" role="tablist" aria-label="Gruppen der Station">${tabs.map((i) => tabBtn(i, i === cur)).join('')}</div>` : '';
  const panels = tabs.map((i) => `<div class="lay-panel b-body" id="lay-p${i}" ${bar ? `role="tabpanel" aria-labelledby="lay-t${i}"` : `role="group" aria-label="${esc(gs[i].title)}"`}${i === cur ? '' : ' hidden'}>${tabBody(gs[i])}</div>`).join('');
  const set = tabs.length ? `<h4 class="zg-set-h">Einstellungen</h4>${strip}${panels}` : '';
  return `<div class="b-main lay-scroll">${shows.length ? showHtml(shows) : ''}${set}</div><div class="cfg-foot"><span class="cfg-scope">Diese Station · <span data-lay-sum></span></span>${devBar()}</div>`;
}
// Reiter wählen (Klick, ←/→, Pos1/Ende) und merken
function pickTab(i, focus) {
  gearEl.querySelectorAll('[data-ltab]').forEach((t) => { const on = +t.dataset.ltab === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on) { showTab(t); if (focus) t.focus(); } });
  gearEl.querySelectorAll('.lay-panel').forEach((p) => { p.hidden = p.id !== `lay-p${i}`; });
  openStore[currentId] = [i];
  try { localStorage.setItem(OPEN_KEY, JSON.stringify(openStore)); } catch { /* privates Fenster */ }
}
function onKey(e) {
  const t = e.target.closest && e.target.closest('[data-ltab]');
  if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  e.stopPropagation();   // sonst fliegt main.js mit ←/→ zur Nachbarstation
  const k = tabs.indexOf(+t.dataset.ltab), n = tabs.length;
  pickTab(tabs[e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (k + (e.key === 'ArrowRight' ? 1 : n - 1)) % n], true);
}

// Gewählten Reiter in der seitlich schiebbaren Zeile ganz sichtbar halten (ohne die Spalte selbst zu scrollen)
function showTab(t) {
  const row = t.parentElement, l = t.offsetLeft - row.offsetLeft, r = l + t.offsetWidth;
  if (l < row.scrollLeft + 8) row.scrollLeft = l - 24;
  else if (r > row.scrollLeft + row.clientWidth - 8) row.scrollLeft = r - row.clientWidth + 24;
}
function render() {
  evc = null;   // neue Zeilen (z. B. Knöpfe der Infotafel kommen nach den Ebenen) → Ereignisse neu suchen
  if (gearEl) {
    const layers = allOf(currentId), st = STATIONS[currentId];
    gearEl.innerHTML = layers ? gearHtml(layers) : '<p class="cfg-note">Diese Station hat keine eigenen Einstellungen.</p>';
    if (!layers) { gs = []; tabs = []; }
    onInfo({ title: st ? st.title : '…', n: layers ? layers.length : 0, groups: tabs.length });
    const sum = gearEl.querySelector('[data-lay-sum]');
    if (sum) sum.textContent = gearEl.closest('.cfg').dataset.laySum || '';
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
    // Punkt am Reiter: in dieser Gruppe weicht ein Wert vom Standard ab (Vorschau 27.10.2026 F3)
    gearEl.querySelectorAll('[data-ltab]').forEach((t) => {
      const g = gs[+t.dataset.ltab], dev = !!g && itemsOf(g).some(changed);
      t.classList.toggle('has-dev', dev);
      const lab = `${g ? g.title : ''}, ${g ? count(g) : 0} Einstellungen${dev ? ', geändert' : ''}`;
      if (t.getAttribute('aria-label') !== lab) t.setAttribute('aria-label', lab);
    });
  }
}

function onInput(e) {
  const i = e.target, l = i.dataset && i.dataset.lay ? find(i.dataset.lay) : null;
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
// shared(id) = gemeinsame Gruppen dieser Station (settings.js sharedFor)
export function mountLayers({ gear, info, strip, stripOn: on, shared }) {
  gearEl = gear; onInfo = info || onInfo; stripEl = strip; stripOn = on || stripOn; sharedOf = shared || sharedOf;
  gearEl.addEventListener('keydown', onKey);
  for (const root of [gearEl, stripEl]) { if (!root) continue; root.addEventListener('input', onInput); root.addEventListener('click', onClick); }
  window.addEventListener('hashchange', poll);
  poll();
  setInterval(() => { poll(); sync(); }, 300);
}
