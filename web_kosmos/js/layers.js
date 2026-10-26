// Ebenen-Einstellungen je Station (Muster Biochar): Zahnrad-Abschnitt „Station · …“ und Zeitleiste über der Fußleiste.
// Eine Station registriert ihre Ebenen in create(): registerLayers(stationId, layers). Ebene = { id, label, type, value, set, … }
//   'toggle' an/aus · 'range' (min, max, step, unit, fmt) · 'play' ▶/⏸ mit Regler: set(value, playing), get() → { value, playing },
//   status() Text für die Zeitleiste · 'action' Knopf: run(), button. sub: true rückt ein, hint: Zusatztext unter der Zeile.
// Werte je Station in localStorage `kosmos.layers.v1` (nicht der Abspielzustand); URL `?lay=aurora:0,kp:7,clock.play:1` für
// Screenshots. Aktive Station aus `#station=…` (main.js setzt den Hash per replaceState → ohne Ereignis, daher Takt 300 ms).

import { STATIONS } from './content.js';

const KEY = 'kosmos.layers.v1';
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h3.4v13H7zM13.6 5.5H17v13h-3.4z" fill="currentColor"/></svg>';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === 'object' ? s : {}; } catch { return {}; } })();
const url = (() => {
  const o = {}, q = new URLSearchParams(location.search).get('lay');
  if (q) for (const kv of q.split(',')) { const [k, v] = kv.split(':'); if (k && v !== undefined && Number.isFinite(+v)) o[k] = +v; }
  return o;
})();
const reg = new Map();
let currentId = null, gearEl = null, stripEl = null, stripOn = () => true;

const valid = (l, v) => (l.type === 'toggle' ? typeof v === 'boolean' : typeof v === 'number' && Number.isFinite(v) && v >= l.min && v <= l.max);
export const fmtVal = (l, v) => (l.fmt ? l.fmt(v) : `${String(v).replace('.', ',')}${l.unit ? ` ${l.unit}` : ''}`);
const playing = (l) => (l.get ? !!l.get().playing : !!l.playing);
const find = (id) => (reg.get(currentId) || []).find((l) => l.id === id);

export function registerLayers(stationId, layers) {
  reg.set(stationId, layers);
  const saved = store[stationId] || {};
  for (const l of layers) {
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

const rowHtml = (l) => {
  const cls = `lay${l.sub ? ' lay--sub' : ''}`;
  const rng = (extra = '') => `<input type="range" data-lay="${l.id}" min="${l.min}" max="${l.max}" step="${l.step ?? 1}" aria-label="${esc(l.label)}"${extra}><output data-lout="${l.id}"></output>`;
  let row;
  if (l.type === 'toggle') row = `<label class="cfg-row cfg-toggle ${cls}"><span class="cfg-label">${esc(l.label)}</span><input type="checkbox" data-lay="${l.id}"><span class="switch" aria-hidden="true"></span></label>`;
  else if (l.type === 'range') row = `<label class="cfg-row cfg-range ${cls}"><span class="cfg-label">${esc(l.label)}</span>${rng()}</label>`;
  else if (l.type === 'play') row = `<div class="cfg-row ${cls} lay--play"><button type="button" class="play-btn" data-play="${l.id}" aria-pressed="false" aria-label="${esc(l.label)} abspielen">${PLAY}</button><span class="cfg-label">${esc(l.label)}</span>${rng()}</div>`;
  else row = `<div class="cfg-row ${cls}"><span class="cfg-label">${esc(l.label)}</span><button type="button" class="act-btn" data-act="${l.id}">${esc(l.button || 'Auslösen')}</button></div>`;
  return row + (l.hint ? `<p class="cfg-note lay-hint">${esc(l.hint)}</p>` : '');
};

function render() {
  if (gearEl) {
    const layers = reg.get(currentId), st = STATIONS[currentId];
    gearEl.innerHTML = `<h3 class="cfg-group">Station · ${esc(st ? st.title : '…')}</h3>${layers ? layers.map(rowHtml).join('')
      : '<p class="cfg-note">Diese Station hat noch keine Ebenen-Einstellungen – ihre Schalter stehen in der Infotafel.</p>'}`;
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

export function mountLayers({ gear, strip, stripOn: on }) {
  gearEl = gear; stripEl = strip; stripOn = on || stripOn;
  for (const root of [gearEl, stripEl]) { if (!root) continue; root.addEventListener('input', onInput); root.addEventListener('click', onClick); }
  window.addEventListener('hashchange', poll);
  poll();
  setInterval(() => { poll(); sync(); }, 300);
}
