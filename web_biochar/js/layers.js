// Ebenen-Einstellungen je Ebene (Muster Kosmos layers.js, Vorschau 26.10.2026 Bento:A + Global:A+B+C): Zahnrad-Reiter
// „Ebene n · …“ mit Bento-Karten je group. Eine Ebene gibt ihre Schalter in create() als level.layers zurück, main.js
// registriert sie (registerLayers) und meldet die aktive Ebene (showLayers). Schalter = { id, label, type, value, set, … }
//   'toggle' an/aus · 'range' (min, max, step, unit, fmt) · 'play' ▶/⏸ mit Regler: set(value, playing), get() → { value, playing },
//   status() Text für die Karte „Animation“ · 'action' Knopf: run(), button. sub: true rückt ein (Folgezeilen hängen gemeinsam
//   an der Zeile davor), hint: Zusatztext unter der Zeile (Funktion = live), group: Kartentitel (gilt bis zur nächsten group).
// Werte je Ebene in localStorage `biochar.layers.v1` (nicht der Abspielzustand); URL `?lay=drop:0,rhday.play:1` für Screenshots.
// Die Bausteine Themenliste, „geändert · Standard“ und Icons nutzt auch der Reiter Global (settings.js).

import { LEVELS } from './content.js';

const KEY = 'biochar.layers.v1';
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h3.4v13H7zM13.6 5.5H17v13h-3.4z" fill="currentColor"/></svg>';
// Linien-Icons (24er Raster) für Karten-Plaketten und Themenliste
const ICONS = {
  look: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none"/>',
  light: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  cam: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/>',
  fx: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  ui: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
  perf: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
  sem: '<path d="M12 3v7"/><path d="M8 3h8"/><path d="M12 10l-5 9M12 10l5 9M12 10v9"/><path d="M4 21h16"/>',
  water: '<path d="M12 3c3.5 4.6 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 2.5-6.4 6-11z"/>',
  life: '<path d="M5 19c2-6 6-9 14-11"/><path d="M9 15c-2-1-3-3-2.5-5M13 12.5c0-2 1-3.6 3-4.5"/><circle cx="19" cy="8" r="1.4"/>',
  heat: '<path d="M12 21a5 5 0 0 1-3-9c1-1 1.5-3 1-6 3 2 6 5 6 9.5a4 4 0 0 1-4 5.5z"/>',
  atom: '<circle cx="12" cy="12" r="1.8" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
  wave: '<path d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-4.5 5-3"/>',
  layers: '<path d="M12 4l9 4.5-9 4.5-9-4.5z"/><path d="M3 13l9 4.5 9-4.5"/>',
  time: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>',
};
export const icon = (k, cls = 'b-ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.layers}</svg>`;
// Icon je Kartentitel der Ebenen (Reihenfolge zählt)
const GROUP_ICONS = [[/Zeit|Animation|Tagesgang/, 'time'], [/Wasser|Feuchte|Tropfen|Kapillar/, 'water'], [/Leben|Mikroben|Pilz|Bakter/, 'life'],
  [/Pyrolyse|Gas|Glut|Schwaden/, 'heat'], [/Schwing|Raman|Phonon/, 'wave'], [/Elektron|Atom|Molek/, 'atom'], [/REM|Detektor/, 'sem']];
const groupIcon = (t) => (GROUP_ICONS.find(([re]) => re.test(t)) || [0, 'layers'])[1];
const plaque = (k) => `<span class="b-plaque">${icon(k)}</span>`;
// Themenliste links: „Alle“ + je Karte ein Eintrag mit Icon, Zähler, Punkt bei geänderten Werten; Klick zeigt nur diese Karte.
// items = [{ id, title, icon, n }]
export const navHtml = (items) => `<nav class="b-nav" aria-label="Gruppen">${[{ id: '', title: 'Alle', icon: 'ui', n: items.reduce((a, x) => a + x.n, 0) }, ...items]
  .map((x) => `<button type="button" data-nav="${x.id}" aria-pressed="${!x.id}">${icon(x.icon)}<span class="b-nav-t">${x.title}</span><span class="b-count">${x.n}</span></button>`).join('')}</nav>`;
export function wireNav(root) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-nav]');
    if (!b || !root.contains(b)) return;
    root.querySelectorAll('[data-nav]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    root.querySelectorAll('.bento > [data-g]').forEach((c) => { c.hidden = !!b.dataset.nav && c.dataset.g !== b.dataset.nav; });
  });
}
// Geänderte Werte: Zeile mit Punkt + „Standard“, Leiste oben mit Zahl + „Alle zurücksetzen“, Punkt in der Themenliste
export const devLine = (k) => `<div class="b-dev" data-dev-of="${k}"><span>geändert</span><button type="button" class="b-reset" data-reset="${k}">${icon('reset')}Standard</button></div>`;
export const devBar = () => `<div class="b-devbar" hidden><span data-devn></span> <span data-devw></span> geändert<button type="button" class="b-reset" data-reset="*">${icon('reset')}Alle zurücksetzen</button></div>`;
export function markDevs(root, isDev) {
  let n = 0;
  root.querySelectorAll('[data-dev-of]').forEach((d) => { const on = isDev(d.dataset.devOf); d.closest('.b-item').classList.toggle('is-dev', on); n += on; });
  root.querySelectorAll('[data-nav]').forEach((b) => { b.classList.toggle('is-dev', !!b.dataset.nav && !!root.querySelector(`[data-g="${b.dataset.nav}"] .is-dev`)); });
  const bar = root.querySelector('.b-devbar');
  if (bar) { bar.hidden = !n; bar.querySelector('[data-devn]').textContent = n; bar.querySelector('[data-devw]').textContent = n === 1 ? 'Einstellung' : 'Einstellungen'; }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === 'object' ? s : {}; } catch { return {}; } })();
const url = (() => {
  const o = {}, q = new URLSearchParams(location.search).get('lay');
  if (q) for (const kv of q.split(',')) { const [k, v] = kv.split(':'); if (k && v !== undefined && Number.isFinite(+v)) o[k] = +v; }
  return o;
})();
const reg = new Map();
let currentId = null, gearEl = null, headEl = null;

export const valid = (l, v) => (l.type === 'toggle' ? typeof v === 'boolean' : typeof v === 'number' && Number.isFinite(v) && v >= l.min && v <= l.max);
export const fmtVal = (l, v) => (l.fmt ? l.fmt(v) : `${String(v).replace('.', ',')}${l.unit ? ` ${l.unit}` : ''}`);
const playing = (l) => (l.get ? !!l.get().playing : !!l.playing);
const find = (id) => (reg.get(currentId) || []).find((l) => l.id === id);
const hintOf = (l) => (typeof l.hint === 'function' ? l.hint() : l.hint);

// levelIdx = Index der Ebene (0 … 6); bei jedem Neuaufbau der Ebene erneut (gemerkte Werte gelten weiter)
export function registerLayers(levelIdx, layers) {
  reg.set(levelIdx, layers);
  const saved = store[levelIdx] || {};
  for (const l of layers) {
    if (l.def === undefined) l.def = l.value;
    let v = url[l.id] !== undefined ? url[l.id] : saved[l.id];
    if (l.type === 'toggle' && typeof v === 'number') v = v !== 0;
    if (v !== undefined && valid(l, v)) l.value = v;
    if (l.type === 'toggle' || l.type === 'range') l.set(l.value);
    else if (l.type === 'play') { const u = url[`${l.id}.play`]; l.playing = u === undefined ? !!l.autoplay : u === 1; l.set(l.value, l.playing); }
  }
  if (levelIdx === currentId) render();
}
export function showLayers(levelIdx) {
  if (levelIdx === currentId) return;
  currentId = levelIdx;
  render();
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
const note = (l) => (l.hint ? `<p class="cfg-note lay-hint" data-hint="${l.id}">${esc(hintOf(l))}</p>` : '');

const rowHtml = (l) => {
  let row;
  if (l.type === 'toggle') row = `<label class="b-row cfg-toggle lay"><span class="cfg-label">${esc(l.label)}</span><input type="checkbox" data-lay="${l.id}"><span class="switch" aria-hidden="true"></span></label>`;
  else if (isChoice(l)) row = `<div class="b-row b-stack lay"><span class="cfg-label" id="lay-${l.id}">${esc(l.label)}</span><div class="seg b-seg" role="radiogroup" aria-labelledby="lay-${l.id}">${steps(l).map((v) => `<button type="button" role="radio" data-lay-seg="${l.id}" data-val="${v}">${esc(l.fmt(v))}</button>`).join('')}</div></div>`;
  else if (l.type === 'range') row = `<label class="b-row b-stack lay"><span class="b-top"><span class="cfg-label">${esc(l.label)}</span><output data-lout="${l.id}"></output></span>${range(l)}</label>`;
  else row = `<div class="b-row lay"><span class="cfg-label">${esc(l.label)}</span><button type="button" class="act-btn" data-act="${l.id}">${esc(l.button || 'Auslösen')}</button></div>`;
  return row + note(l);
};

function groups(layers) {
  const out = [];
  for (const l of layers) {
    if (l.group || !out.length) out.push({ title: l.group || 'Ebene', items: [] });
    const g = out[out.length - 1];
    if (l.sub && g.items.length) g.items[g.items.length - 1].subs.push(l); else g.items.push({ l, subs: [] });
  }
  return out;
}
const count = (g) => g.items.reduce((n, it) => n + 1 + it.subs.length, 0);
const resettable = (l) => l.type === 'toggle' || l.type === 'range';
const rowDev = (l) => rowHtml(l) + (resettable(l) ? devLine(l.id) : '');
const block = ({ l, subs }) => `<div class="b-item">${rowDev(l)}${subs.length ? `<div class="b-subs"${l.type === 'toggle' ? ` data-subs="${l.id}"` : ''}>${subs.map((x) => `<div class="b-item">${rowDev(x)}</div>`).join('')}</div>` : ''}</div>`;
// halbe Karte nur bei wenigen Schaltern ohne Regler und ohne Erklärtext
const wide = (g) => count(g) > 4 || g.items.some((it) => [it.l, ...it.subs].some((l) => l.type !== 'toggle' || l.hint));

function timeCard(g) {
  const [{ l: p, subs }, ...rest] = g.items;
  return `<article class="b-card b-card--time b-wide" data-g="g0" aria-label="Animation: ${esc(p.label)}">
    <header class="b-head">${plaque('time')}<h4>Animation</h4><span class="b-chip" data-chip="${p.id}"></span></header>
    <div class="b-time"><button type="button" class="play-btn play-btn--lg" data-play="${p.id}" aria-pressed="false" aria-label="${esc(p.label)} abspielen">${PLAY}</button>
      <span class="b-time-text"><span class="cfg-label b-strong">${esc(p.label)}</span><span class="b-status" data-status="${p.id}"></span></span>
      <output class="b-big" data-lout="${p.id}"></output></div>
    ${range(p, `${p.label}: Tempo`)}
    ${note(p)}
    ${subs.map((l) => block({ l, subs: [] })).join('')}${rest.map(block).join('')}
  </article>`;
}

function gearHtml(layers) {
  const gs = groups(layers);
  const cards = gs.map((g, i) => (g.items[0].l.type === 'play' ? timeCard(g)
    : `<article class="b-card${wide(g) ? ' b-wide' : ''}" data-g="g${i}"><header class="b-head">${plaque(groupIcon(g.title))}<h4>${esc(g.title)}</h4><span class="b-count" aria-label="${count(g)} Einstellungen">${count(g)}</span></header>${g.items.map(block).join('')}</article>`)).join('');
  const nav = gs.map((g, i) => ({ id: `g${i}`, title: esc(g.items[0].l.type === 'play' ? 'Animation' : g.title), icon: g.items[0].l.type === 'play' ? 'time' : groupIcon(g.title), n: count(g) }));
  return `${navHtml(nav)}<div class="b-main">${devBar()}<div class="bento">${cards}</div></div>`;
}

function render() {
  if (!gearEl) return;
  const layers = reg.get(currentId), lv = LEVELS[currentId];
  if (headEl) headEl.innerHTML = `Ebene ${currentId + 1} · ${esc(lv ? lv.name : '…')}<span class="b-count">${layers ? layers.length : 0}</span>`;
  gearEl.innerHTML = layers ? gearHtml(layers)
    : '<p class="cfg-note">Diese Ebene lädt noch – ihre Einstellungen erscheinen gleich hier.</p>';
  sync();
}

export function syncLayers() { sync(); }
function sync() {
  if (!gearEl || gearEl.hidden || gearEl.closest('[hidden]')) return;
  const root = gearEl;
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
    if (b.dataset.on !== String(on)) { b.dataset.on = String(on); b.innerHTML = on ? PAUSE : PLAY; }
  });
  root.querySelectorAll('[data-status]').forEach((s) => { const l = find(s.dataset.status); if (l && l.status) { const t = l.status(); if (s.textContent !== t) s.textContent = t; } });
  root.querySelectorAll('[data-hint]').forEach((s) => { const l = find(s.dataset.hint); if (l && typeof l.hint === 'function') { const t = l.hint(); if (s.textContent !== t) s.textContent = t; } });
  root.querySelectorAll('[data-lay-seg]').forEach((b) => { const l = find(b.dataset.laySeg); if (l) b.setAttribute('aria-checked', String(l.value === +b.dataset.val)); });
  root.querySelectorAll('[data-chip]').forEach((c) => { const l = find(c.dataset.chip); if (l) c.textContent = playing(l) ? 'läuft' : 'angehalten'; });
  // Unter-Ebenen ohne Wirkung, solange ihr Hauptschalter aus ist: abgedunkelt, aber bedienbar
  root.querySelectorAll('[data-subs]').forEach((el) => { const l = find(el.dataset.subs); if (l) el.classList.toggle('is-off', !l.value); });
  markDevs(root, (id) => { const l = find(id); return !!l && l.value !== l.def; });
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
  if (r && gearEl.contains(r)) {
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

// gear = Inhalt des Reiters, head = Reiter-Knopf (Titel der aktiven Ebene); Anzeigen gleichen sich alle 300 ms ab (Abspielstand)
export function mountLayers({ gear, head }) {
  gearEl = gear; headEl = head || null;
  gearEl.addEventListener('input', onInput);
  gearEl.addEventListener('click', onClick);
  wireNav(gearEl);
  setInterval(sync, 300);
}
