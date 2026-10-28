// Ebenen-Einstellungen je Station (Muster Biochar): eigenes Fenster „Ebenen“ (Knopf links neben dem Zahnrad, settings.js) und
// Zeitleiste über der Fußleiste. Aufbau (Vorschau 27.10.2026 Ort:A + Reiter:A): Animation fest oben, darunter Reiter-Leiste der
// Gruppen (Icon, Kurzname aus tabs.js, Zahl der Ebenen, Punkt bei geändertem Wert; ←/→ wie Reiter), genau eine Gruppe sichtbar
// (je Station gemerkt in `kosmos.cfgopen.v1`), unten „n geändert · Alle zurücksetzen“; Einstellung als Zeile Name | Bedienung | Wert.
// Eine Station registriert ihre Ebenen in create(): registerLayers(stationId, layers). Ebene = { id, label, type, value, set, … }
//   'toggle' an/aus · 'range' (min, max, step, unit, fmt) · 'play' ▶/⏸ mit Regler: set(value, playing), get() → { value, playing },
//   status() Text für die Zeitleiste · 'action' Knopf: run(), button. sub: true rückt ein (Folgezeilen hängen gemeinsam an der Zeile
//   davor), hint: Zusatztext unter der Zeile, group: Gruppe (gilt ab dieser Ebene bis zur nächsten group; gleicher Kurzname
//   in tabs.js = ein Reiter, der volle Name steht dann als Zwischenüberschrift im Inhalt),
//   active() + only: Ebene wirkt gerade nicht (z. B. anderer Kanal) → Zeile abgedunkelt, bleibt bedienbar, darunter only als Grund.
// Werte je Station in localStorage `kosmos.layers.v1` (nicht der Abspielzustand); URL `?lay=aurora:0,kp:7,clock.play:1` für
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
// Icon je Gruppen-Name der Stationen (Reihenfolge zählt: „Polarlicht“ vor „Licht“)
const GROUP_ICONS = [[/Zeit|Animation/, 'time'], [/^Ton/, 'sound'], [/Optik/, 'fx'], [/Polarlicht|Magnet|Feld/, 'field'], [/Licht|Sonne|Korona|Strahlen/, 'sun'],
  [/Bögen|Flare|Ausbr|Ereignis|Vulkan|Fontän/, 'burst'], [/Himmel|Stern/, 'sky'], [/Ansicht|Station|New Horizons|Kino/, 'cam'],
  [/Bahn|Mond|Monde|Ring|Planet|System|Umlauf|Jupiter|Neptun|Mars|Triton|Erde|Galaxien|Gezeiten/, 'orbit'], [/Farb|Glut/, 'look']];
const groupIcon = (t) => (GROUP_ICONS.find(([re]) => re.test(t)) || [0, 'layers'])[1];
// Reiter: zuerst der Kurzname, sonst der volle Name der ersten Gruppe („Bögen“ → burst, nicht field aus „Magnetbögen“)
const tabIcon = (g) => { const k = groupIcon(g.title); return k === 'layers' ? groupIcon(g.segs[0].title) : k; };
// Geänderte Werte (Vorschau Global:C, verdichtet 26.10.2026): ↺-Knopf am Zeilenende in fester Spalte statt eigener Zeile
// „geändert · Standard“; „n geändert · Alle zurücksetzen“ als kompakter Knopf rechts in der Sprungleiste
export const devLine = (k, label = '') => `<div class="b-dev" data-dev-of="${k}"><button type="button" class="b-reset b-reset--ico" data-reset="${k}" title="Auf Standard zurücksetzen" aria-label="${label ? `${esc(label)}: ` : ''}auf Standard zurücksetzen">${icon('reset')}</button></div>`;
export const devBar = () => `<button type="button" class="b-reset b-devbar" data-reset="*" hidden>${icon('reset')}<span><span data-devn></span> geändert · Alle zurücksetzen</span></button>`;
// Kopfleiste eines Reiters: Sprungleiste (falls mehrere Gruppen) + Knopf „Alle zurücksetzen“; bleibt beim Scrollen stehen.
// Höchstens 4 Spalten, alle Zeilen gleich voll (6 Gruppen → 3 × 2, 7 → 4 + 3, 8 → 4 × 2)
export const cfgBar = (jump) => {
  const n = (jump.match(/data-jump=/g) || []).length;
  return `<div class="cfg-bar${jump ? '' : ' cfg-bar--solo'}"${n ? ` style="--cols:${Math.ceil(n / Math.ceil(n / 4))}"` : ''}>${jump}${devBar()}</div>`;
};
export function markDevs(root, isDev) {
  let n = 0;
  root.querySelectorAll('[data-dev-of]').forEach((d) => { const on = isDev(d.dataset.devOf); d.closest('.b-item').classList.toggle('is-dev', on); n += on; });
  const bar = root.querySelector('.b-devbar');
  if (bar) { bar.hidden = !n; bar.querySelector('[data-devn]').textContent = n; const cb = bar.closest('.cfg-bar'); if (cb) cb.classList.toggle('has-dev', !!n); }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === 'object' ? s : {}; } catch { return {}; } })();
const url = (() => {
  const o = {}, q = new URLSearchParams(location.search).get('lay');
  if (q) for (const kv of q.split(',')) { const [k, v] = kv.split(':'); if (k && v !== undefined && Number.isFinite(+v)) o[k] = +v; }
  return o;
})();
const reg = new Map();
let currentId = null, gearEl = null, onInfo = () => {}, stripEl = null, stripOn = () => true, gs = [], tabs = [];
// offene Gruppe je Bereich: Station = gewählter Reiter (Index in gs), Global = offene Klapp-Gruppe; ohne Eintrag die erste
const OPEN_KEY = 'kosmos.cfgopen.v1';
const openStore = (() => { try { const s = JSON.parse(localStorage.getItem(OPEN_KEY)); return s && typeof s === 'object' ? s : {}; } catch { return {}; } })();

const valid = (l, v) => (l.type === 'toggle' ? typeof v === 'boolean' : typeof v === 'number' && Number.isFinite(v) && v >= l.min && v <= l.max);
export const fmtVal = (l, v) => (l.fmt ? l.fmt(v) : `${String(v).replace('.', ',')}${l.unit ? ` ${l.unit}` : ''}`);
const playing = (l) => (l.get ? !!l.get().playing : !!l.playing);
const find = (id) => (reg.get(currentId) || []).find((l) => l.id === id);

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
export const layersOf = (stationId) => reg.get(stationId) || [];   // Prüflauf tests/settings.py
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
  else if (l.type === 'range') row = `<label class="b-row b-stack lay"><span class="b-top"><span class="cfg-label">${esc(l.label)}</span><output data-lout="${l.id}"></output></span>${range(l)}</label>`;
  else row = `<div class="b-row lay"><span class="cfg-label">${esc(l.label)}</span><button type="button" class="act-btn" data-act="${l.id}">${esc(l.button || 'Auslösen')}</button></div>`;
  return row + (l.hint ? `<p class="cfg-note lay-hint">${prose(l.hint)}</p>` : '') + (l.only ? `<p class="cfg-note lay-hint" data-only="${l.id}" hidden>${prose(l.only)}</p>` : '');
};

// Gruppen nach Kurzname (tabs.js): gleicher Kurzname = ein Reiter, je voller Name ein Abschnitt (segs) darin
function groups(layers) {
  const out = [];
  let seg = null;
  for (const l of layers) {
    if (l.group || !seg) {
      const name = l.group || 'Ebenen', title = tabOf(name);
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
const resettable = (l) => l.type === 'toggle' || l.type === 'range';
const rowDev = (l) => rowHtml(l) + (resettable(l) ? devLine(l.id, l.label) : '');
const block = ({ l, subs }) => `<div class="b-item">${rowDev(l)}${subs.length ? `<div class="b-subs"${l.type === 'toggle' ? ` data-subs="${l.id}"` : ''}>${subs.map((x) => `<div class="b-item">${rowDev(x)}</div>`).join('')}</div>` : ''}</div>`;

function timeCard(g) {
  const [{ l: p, subs }, ...rest] = g.items;
  return `<article class="b-card b-card--time" data-g="g0" aria-label="Animation: ${esc(p.label)}">
    <div class="b-time"><button type="button" class="play-btn play-btn--lg" data-play="${p.id}" aria-pressed="false" aria-label="${esc(p.label)} abspielen">${PLAY}</button>
      <span class="b-time-text"><span class="cfg-label b-strong">${esc(p.label)}</span><span class="b-status" data-status="${p.id}"></span></span>
      ${range(p, `${p.label}: Tempo`)}<output class="b-big" data-lout="${p.id}"></output></div>
    ${p.hint ? `<p class="cfg-note lay-hint">${esc(p.hint)}</p>` : ''}
    ${subs.map((l) => block({ l, subs: [] })).join('')}${rest.map(block).join('')}
  </article>`;
}

// offene Gruppe je Bereich (Station-Id, Reiter Global = '_global'); ohne Eintrag ist die erste Gruppe offen; immer nur eine offen
export const isOpenIn = (key, i, first) => (Array.isArray(openStore[key]) ? openStore[key][0] === i : i === first);
const isPlay = (g) => g.items[0].l.type === 'play';
const changed = (l) => resettable(l) && l.value !== l.def;
const allOf = (g) => g.items.flatMap(({ l, subs }) => [l, ...subs]);
// Inhalt eines Reiters; Zwischenüberschrift je vollem Gruppen-Namen, wenn er vom Kurznamen abweicht oder mehrere zusammenliegen
const tabBody = (g) => g.segs.map((s) => `${g.segs.length > 1 || s.title !== g.title ? `<h5 class="b-subh">${esc(s.title)}</h5>` : ''}${s.items.map(block).join('')}`).join('');
// Reiter in gleich vollen Zeilen: breit höchstens 6 nebeneinander, schmal (Container cfg ≤ 420 px) höchstens 4
const cols = (n, max) => Math.ceil(n / Math.ceil(n / max));
const tabBtn = (i, on) => `<button type="button" role="tab" class="lay-tab" id="lay-t${i}" data-ltab="${i}" aria-controls="lay-p${i}" aria-selected="${on}" tabindex="${on ? 0 : -1}">
  <span class="lay-tab-ico">${icon(tabIcon(gs[i]))}<span class="lay-tab-dot" aria-hidden="true"></span><span class="lay-tab-n" aria-hidden="true">${count(gs[i])}</span></span><span class="lay-tab-t">${esc(gs[i].title)}</span></button>`;

function gearHtml(layers) {
  gs = groups(layers);
  tabs = gs.map((g, i) => (isPlay(g) ? -1 : i)).filter((i) => i >= 0);
  const saved = (openStore[currentId] || [])[0], cur = tabs.includes(saved) ? saved : tabs[0], bar = tabs.length > 1;
  const strip = bar ? `<div class="lay-tabs" role="tablist" aria-label="Gruppen der Station" style="--cols:${cols(tabs.length, 6)};--cols-s:${cols(tabs.length, 4)}">${tabs.map((i) => tabBtn(i, i === cur)).join('')}</div>` : '';
  const panels = tabs.map((i) => `<div class="lay-panel b-body" id="lay-p${i}" ${bar ? `role="tabpanel" aria-labelledby="lay-t${i}"` : `role="group" aria-label="${esc(gs[i].title)}"`}${i === cur ? '' : ' hidden'}>${tabBody(gs[i])}</div>`).join('');
  return `<div class="b-main">${gs.filter(isPlay).map(timeCard).join('')}${strip}${panels}<div class="lay-foot">${devBar()}</div></div>`;
}
// Reiter wählen (Klick, ←/→, Pos1/Ende) und merken
function pickTab(i, focus) {
  gearEl.querySelectorAll('[data-ltab]').forEach((t) => { const on = +t.dataset.ltab === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
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

function saveOpen(key, root) {
  openStore[key] = [...root.querySelectorAll('.b-fold.is-open')].map((c) => +c.dataset.fold);
  try { localStorage.setItem(OPEN_KEY, JSON.stringify(openStore)); } catch { /* privates Fenster */ }
}
function setOpen(card, on) {
  // Akkordeon: öffnet eine Gruppe, klappen die anderen zu (User 27.10.2026)
  if (on) card.parentElement.querySelectorAll(':scope > .b-fold.is-open').forEach((o) => { if (o !== card) setOpen(o, false); });
  card.classList.toggle('is-open', on);
  card.querySelector('.b-head').setAttribute('aria-expanded', String(on));
  card.querySelector('.b-body').hidden = !on;
}
// Sprungleiste (beide Reiter): hervorgehoben ist die offene Gruppe (Akkordeon: höchstens eine); alle zu → die Gruppe, deren Kopf
// zuletzt unter der Leiste durchgelaufen ist. Nur nach Scrollen zu markieren hielt die Hervorhebung fest, wenn der Klick nicht scrollt.
export function spyIn(root, sc) {
  const bar = root && !root.hidden && root.querySelector('.cfg-jump');
  if (!bar) return;
  const edge = (bar.closest('.cfg-bar') || bar).getBoundingClientRect().bottom + 8, folds = [...root.querySelectorAll('.b-fold')];
  let cur = folds.find((c) => c.classList.contains('is-open')) || null;
  if (!cur) {
    for (const c of folds) { if (!cur || c.getBoundingClientRect().top <= edge) cur = c; }
    if (sc && sc.scrollTop > 0 && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2) cur = folds.pop() || cur;
  }
  bar.querySelectorAll('[data-jump]').forEach((b) => b.setAttribute('aria-current', String(!!cur && cur.dataset.fold === b.dataset.jump)));
}
// Klick auf Gruppenkopf (auf/zu) oder Sprungleiste (öffnen + hinscrollen); true = erledigt
export function foldClick(root, e, key, sc) {
  const h = e.target.closest('.b-fold .b-head');
  if (h && root.contains(h)) { const c = h.closest('.b-fold'); setOpen(c, !c.classList.contains('is-open')); saveOpen(key, root); spyIn(root, sc); return true; }
  const j = e.target.closest('[data-jump]');
  if (!j || !root.contains(j)) return false;
  const c = root.querySelector(`.b-fold[data-fold="${j.dataset.jump}"]`);
  if (c) {
    setOpen(c, true); saveOpen(key, root); spyIn(root, sc);
    c.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    c.querySelector('.b-head').focus({ preventScroll: true });
  }
  return true;
}
// Kurzwerte aus der Bedienung selbst (Reiter Global): gewählte Knöpfe und Werte der Hauptzeilen, dazu „n von m an“
export function domSummary(body) {
  const parts = [];
  let on = 0, n = 0;
  body.querySelectorAll(':scope > .b-item').forEach((it) => {
    const r = it.querySelector('[role=radio][aria-checked="true"]'), cb = it.querySelector('input[type=checkbox]'), o = it.querySelector('output');
    if (cb && !r && !o) { n++; on += cb.checked ? 1 : 0; return; }
    if (parts.length >= 2) return;
    if (r) parts.push(r.textContent.trim());
    else if (o) { const u = it.querySelector('.cfg-unit'); parts.push(`${o.textContent.trim()}${u ? ` ${u.textContent.trim()}` : ''}`); }
  });
  if (n) parts.push(`${on} von ${n} an`);
  return parts.join(' · ');
}

function render() {
  if (gearEl) {
    const layers = reg.get(currentId), st = STATIONS[currentId];
    gearEl.innerHTML = layers ? gearHtml(layers)
      : '<p class="cfg-note">Diese Station hat noch keine Ebenen-Einstellungen – ihre Schalter stehen in der Infotafel.</p>';
    if (!layers) { gs = []; tabs = []; }
    onInfo({ title: st ? st.title : '…', n: layers ? layers.length : 0, groups: tabs.length });
  }
  if (stripEl) {
    const l = (reg.get(currentId) || []).find((x) => x.type === 'play');
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

function sync() {
  for (const root of [gearEl, stripEl]) {
    if (!root || root.hidden) continue;
    root.querySelectorAll('[data-lay]').forEach((i) => {
      const l = find(i.dataset.lay);
      if (!l) return;
      if (i.type === 'checkbox') i.checked = !!l.value;
      else { const v = l.type === 'play' && l.get ? l.get().value : l.value; if (document.activeElement !== i) i.value = v; const o = root.querySelector(`[data-lout="${l.id}"]`); if (o) o.textContent = nbsp(fmtVal(l, +i.value)); }
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
    root.querySelectorAll('[data-lay-seg]').forEach((b) => { const l = find(b.dataset.laySeg); if (l) b.setAttribute('aria-checked', String(l.value === +b.dataset.val)); });
    root.querySelectorAll('[data-steps]').forEach((el) => { const l = find(el.dataset.steps); if (l) [...el.children].forEach((c, i) => c.classList.toggle('is-on', l.min + i === Math.round(l.get ? l.get().value : l.value))); });
    root.querySelectorAll('[data-chip]').forEach((c) => { const l = find(c.dataset.chip); if (l) c.textContent = playing(l) ? 'läuft' : 'angehalten'; });
    // Unter-Ebenen ohne Wirkung, solange ihr Hauptschalter aus ist: abgedunkelt, aber bedienbar
    root.querySelectorAll('[data-subs]').forEach((el) => { const l = find(el.dataset.subs); if (l) el.classList.toggle('is-off', !l.value); });
    // Ebene ohne Wirkung im aktuellen Bild (active() falsch): Zeile abgedunkelt, Grund darunter
    root.querySelectorAll('[data-only]').forEach((p) => { const l = find(p.dataset.only); const idle = !!l && !!l.active && !l.active(); p.hidden = !idle; p.parentElement.classList.toggle('is-idle', idle); });
  }
  if (gearEl && !gearEl.hidden) {
    markDevs(gearEl, (id) => { const l = find(id); return !!l && changed(l); });
    // Punkt am Reiter: in dieser Gruppe weicht ein Wert vom Standard ab (Vorschau 27.10.2026 F3)
    gearEl.querySelectorAll('[data-ltab]').forEach((t) => {
      const g = gs[+t.dataset.ltab], dev = !!g && allOf(g).some(changed);
      t.classList.toggle('has-dev', dev);
      const lab = `${g ? g.title : ''}, ${g ? count(g) : 0} Ebenen${dev ? ', geändert' : ''}`;
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
  sync();
}
function onClick(e) {
  const t = e.target.closest('[data-ltab]');
  if (t && gearEl && gearEl.contains(t)) { pickTab(+t.dataset.ltab); return; }
  const r = e.target.closest('[data-reset]');
  if (r && gearEl && gearEl.contains(r)) {
    for (const l of reg.get(currentId) || []) if (resettable(l) && (r.dataset.reset === '*' || r.dataset.reset === l.id) && l.value !== l.def) { l.value = l.def; l.set(l.value); persist(l); }
    sync();
    return;
  }
  const s = e.target.closest('[data-lay-seg]'), sl = s && find(s.dataset.laySeg);
  if (sl) { sl.value = +s.dataset.val; sl.set(sl.value); persist(sl); sync(); return; }
  const b = e.target.closest('[data-play],[data-act]');
  if (!b) return;
  const l = find(b.dataset.play || b.dataset.act);
  if (!l) return;
  if (l.type === 'play') { l.playing = !playing(l); l.set(l.value, l.playing); } else if (l.run) l.run();
  sync();
}
function poll() {
  const id = (location.hash.match(/station=(\w+)/) || [])[1] || 'earth';
  if (id !== currentId) { currentId = id; render(); }
}

// info({ title, n, groups }) nach jedem Aufbau: Name der Station, Zahl der Ebenen und Reiter (Knopf, Fenster-Kopf, Verweis im Zahnrad)
export function mountLayers({ gear, info, strip, stripOn: on }) {
  gearEl = gear; onInfo = info || onInfo; stripEl = strip; stripOn = on || stripOn;
  gearEl.addEventListener('keydown', onKey);
  for (const root of [gearEl, stripEl]) { if (!root) continue; root.addEventListener('input', onInput); root.addEventListener('click', onClick); }
  window.addEventListener('hashchange', poll);
  poll();
  setInterval(() => { poll(); sync(); }, 300);
}
