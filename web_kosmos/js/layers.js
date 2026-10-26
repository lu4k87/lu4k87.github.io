// Ebenen-Einstellungen je Station (Muster Biochar): Zahnrad-Reiter „Station · …“ (Bento-Karten je group) und Zeitleiste über der Fußleiste.
// Eine Station registriert ihre Ebenen in create(): registerLayers(stationId, layers). Ebene = { id, label, type, value, set, … }
//   'toggle' an/aus · 'range' (min, max, step, unit, fmt) · 'play' ▶/⏸ mit Regler: set(value, playing), get() → { value, playing },
//   status() Text für die Zeitleiste · 'action' Knopf: run(), button. sub: true rückt ein (Folgezeilen hängen gemeinsam an der Zeile
//   davor), hint: Zusatztext unter der Zeile, group: Zwischenüberschrift (gilt ab dieser Ebene bis zur nächsten group),
//   active() + only: Ebene wirkt gerade nicht (z. B. anderer Kanal) → Zeile abgedunkelt, bleibt bedienbar, darunter only als Grund.
// Werte je Station in localStorage `kosmos.layers.v1` (nicht der Abspielzustand); URL `?lay=aurora:0,kp:7,clock.play:1` für
// Screenshots. Aktive Station aus `#station=…` (main.js setzt den Hash per replaceState → ohne Ereignis, daher Takt 300 ms).

import { STATIONS } from './content.js';
import { prose } from './figs.js';

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
  time: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>',
};
export const icon = (k, cls = 'b-ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.layers}</svg>`;
// Icon je Gruppen-Name der Stationen (Reihenfolge zählt: „Polarlicht“ vor „Licht“)
const GROUP_ICONS = [[/Zeit|Animation/, 'time'], [/Polarlicht|Magnet|Feld/, 'field'], [/Licht|Sonne|Korona|Strahlen/, 'sun'],
  [/Bögen|Flare|Ausbr|Ereignis|Vulkan|Fontän/, 'burst'], [/Himmel|Stern/, 'sky'], [/Ansicht|Station|New Horizons/, 'cam'],
  [/Bahn|Mond|Monde|Ring|Planet|System|Umlauf|Jupiter|Neptun|Mars|Triton|Erde|Galaxien|Gezeiten/, 'orbit'], [/Farb|Glut/, 'look']];
const groupIcon = (t) => (GROUP_ICONS.find(([re]) => re.test(t)) || [0, 'layers'])[1];
const plaque = (k) => `<span class="b-plaque">${icon(k)}</span>`;
// Geänderte Werte (Vorschau Global:C): Zeile mit Punkt + „Standard“, Leiste oben mit Zahl + „Alle zurücksetzen“
export const devLine = (k) => `<div class="b-dev" data-dev-of="${k}"><span>geändert</span><button type="button" class="b-reset" data-reset="${k}">${icon('reset')}Standard</button></div>`;
export const devBar = (what) => `<div class="b-devbar" hidden><span data-devn></span> ${what} geändert<button type="button" class="b-reset" data-reset="*">${icon('reset')}Alle zurücksetzen</button></div>`;
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
const reg = new Map();
let currentId = null, gearEl = null, headEl = null, stripEl = null, stripOn = () => true;

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

function groups(layers) {
  const out = [];
  for (const l of layers) {
    if (l.group || !out.length) out.push({ title: l.group || 'Ebenen', items: [] });
    const g = out[out.length - 1];
    if (l.sub && g.items.length) g.items[g.items.length - 1].subs.push(l); else g.items.push({ l, subs: [] });
  }
  return out;
}
const count = (g) => g.items.reduce((n, it) => n + 1 + it.subs.length, 0);
const resettable = (l) => l.type === 'toggle' || l.type === 'range';
const rowDev = (l) => rowHtml(l) + (resettable(l) ? devLine(l.id) : '');
const block = ({ l, subs }) => `<div class="b-item">${rowDev(l)}${subs.length ? `<div class="b-subs"${l.type === 'toggle' ? ` data-subs="${l.id}"` : ''}>${subs.map((x) => `<div class="b-item">${rowDev(x)}</div>`).join('')}</div>` : ''}</div>`;
// halbe Karte nur bei wenigen Schaltern ohne Regler
const wide = (g) => count(g) > 4 || g.items.some((it) => [it.l, ...it.subs].some((l) => l.type !== 'toggle'));

function timeCard(g) {
  const [{ l: p, subs }, ...rest] = g.items;
  return `<article class="b-card b-card--time b-wide" data-g="g0" aria-label="Animation: ${esc(p.label)}">
    <header class="b-head">${plaque('time')}<h4>Animation</h4><span class="b-chip" data-chip="${p.id}"></span></header>
    <div class="b-time"><button type="button" class="play-btn play-btn--lg" data-play="${p.id}" aria-pressed="false" aria-label="${esc(p.label)} abspielen">${PLAY}</button>
      <span class="b-time-text"><span class="cfg-label b-strong">${esc(p.label)}</span><span class="b-status" data-status="${p.id}"></span></span>
      <output class="b-big" data-lout="${p.id}"></output></div>
    ${range(p, `${p.label}: Tempo`)}
    ${p.fmt ? `<div class="b-steps" data-steps="${p.id}" aria-hidden="true">${steps(p).map((v) => `<span>${esc(p.fmt(v))}</span>`).join('')}</div>` : ''}
    ${p.hint ? `<p class="cfg-note lay-hint">${esc(p.hint)}</p>` : ''}
    ${subs.map((l) => block({ l, subs: [] })).join('')}${rest.map(block).join('')}
  </article>`;
}

function gearHtml(layers) {
  const gs = groups(layers);
  const cards = gs.map((g, i) => (g.items[0].l.type === 'play' ? timeCard(g)
    : `<article class="b-card${wide(g) ? ' b-wide' : ''}" data-g="g${i}"><header class="b-head">${plaque(groupIcon(g.title))}<h4>${esc(g.title)}</h4><span class="b-count" aria-label="${count(g)} Ebenen">${count(g)}</span></header>${g.items.map(block).join('')}</article>`)).join('');
  return `<div class="b-main">${devBar('Ebenen')}<div class="bento">${cards}</div></div>`;
}

function render() {
  if (gearEl) {
    const layers = reg.get(currentId), st = STATIONS[currentId];
    if (headEl) headEl.innerHTML = `Station · ${esc(st ? st.title : '…')}<span class="b-count">${layers ? layers.length : 0}</span>`;
    gearEl.innerHTML = layers ? gearHtml(layers)
      : '<p class="cfg-note">Diese Station hat noch keine Ebenen-Einstellungen – ihre Schalter stehen in der Infotafel.</p>';
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
export function refreshLayers() { render(); }

function sync() {
  for (const root of [gearEl, stripEl]) {
    if (!root || root.hidden) continue;
    root.querySelectorAll('[data-lay]').forEach((i) => {
      const l = find(i.dataset.lay);
      if (!l) return;
      if (i.type === 'checkbox') i.checked = !!l.value;
      else { const v = l.type === 'play' && l.get ? l.get().value : l.value; if (document.activeElement !== i) i.value = v; const o = root.querySelector(`[data-lout="${l.id}"]`); if (o) o.textContent = fmtVal(l, +i.value); }
    });
    root.querySelectorAll('[data-play]').forEach((b) => {
      const l = find(b.dataset.play);
      if (!l) return;
      const on = playing(l);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', `${l.label} ${on ? 'anhalten' : 'abspielen'}`);
      b.innerHTML = on ? PAUSE : PLAY;
    });
    root.querySelectorAll('[data-status]').forEach((s) => { const l = find(s.dataset.status); if (l && l.status) s.textContent = l.status(); });
    root.querySelectorAll('[data-lay-seg]').forEach((b) => { const l = find(b.dataset.laySeg); if (l) b.setAttribute('aria-checked', String(l.value === +b.dataset.val)); });
    root.querySelectorAll('[data-steps]').forEach((el) => { const l = find(el.dataset.steps); if (l) [...el.children].forEach((c, i) => c.classList.toggle('is-on', l.min + i === Math.round(l.get ? l.get().value : l.value))); });
    root.querySelectorAll('[data-chip]').forEach((c) => { const l = find(c.dataset.chip); if (l) c.textContent = playing(l) ? 'läuft' : 'angehalten'; });
    // Unter-Ebenen ohne Wirkung, solange ihr Hauptschalter aus ist: abgedunkelt, aber bedienbar
    root.querySelectorAll('[data-subs]').forEach((el) => { const l = find(el.dataset.subs); if (l) el.classList.toggle('is-off', !l.value); });
    // Ebene ohne Wirkung im aktuellen Bild (active() falsch): Zeile abgedunkelt, Grund darunter
    root.querySelectorAll('[data-only]').forEach((p) => { const l = find(p.dataset.only); const idle = !!l && !!l.active && !l.active(); p.hidden = !idle; p.parentElement.classList.toggle('is-idle', idle); });
  }
  if (gearEl && !gearEl.hidden) markDevs(gearEl, (id) => { const l = find(id); return !!l && l.value !== l.def; });
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

export function mountLayers({ gear, head, strip, stripOn: on }) {
  gearEl = gear; headEl = head || null; stripEl = strip; stripOn = on || stripOn;
  for (const root of [gearEl, stripEl]) { if (!root) continue; root.addEventListener('input', onInput); root.addEventListener('click', onClick); }
  window.addEventListener('hashchange', poll);
  poll();
  setInterval(() => { poll(); sync(); }, 300);
}
