// Einstellungen (Zahnrad oben rechts): oben die Ebenen der aktiven Station (layers.js: Schalter, Regler, ▶ je Animation),
// darunter Kamera & Bewegung (Bewegung, Leerlauf-Fahrt, Flugdauer), Bild (Qualität, Belichtung, Tiefer Himmel, Kleinkörper),
// Effekte (Bloom, Farbsaum, Korn) und Oberfläche (Infotafel, Zeitleiste).
// Gespeichert in localStorage `kosmos.settings.v1`; clean() prüft jeden Wert, damit kaputte Einträge nichts stören.

import { mountLayers, refreshLayers } from './layers.js';

const KEY = 'kosmos.settings.v1';
const DEFAULTS = { motion: 'full', quality: 'auto', cine: true, dive: 3.6, exposure: 1, bloom: true, lens: true, grain: true, deep: 1, fpsCap: 0, panel: true, timeline: true, small: 6 };
const CHOICES = { motion: ['full', 'calm', 'off'], quality: ['auto', '1', '2', '3'] };

function clean(raw) {
  const S = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return S;
  for (const k of Object.keys(DEFAULTS)) {
    const v = raw[k], d = DEFAULTS[k];
    if (CHOICES[k]) { if (CHOICES[k].includes(v)) S[k] = v; }
    else if (typeof d === 'boolean') { if (typeof v === 'boolean') S[k] = v; }
    else if (typeof v === 'number' && Number.isFinite(v)) S[k] = v;
  }
  S.dive = Math.min(8, Math.max(1.5, S.dive));
  S.exposure = Math.min(2, Math.max(0.5, S.exposure));
  S.small = Math.min(8, Math.max(1, S.small));
  S.deep = Math.min(2, Math.max(0, S.deep));
  if (![0, 30, 60].includes(S.fpsCap)) S.fpsCap = 0;
  return S;
}

function load() {
  try { return clean(JSON.parse(localStorage.getItem(KEY))); } catch { return clean(null); }
}

export const settings = { S: load() };
const listeners = [];
export function onSettings(fn) { listeners.push(fn); }

export function setSetting(key, value) {
  const next = clean({ ...settings.S, [key]: value });
  if (next[key] === settings.S[key]) return;
  settings.S = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* privates Fenster: nur für diese Sitzung */ }
  listeners.forEach((fn) => fn([key]));
}

const SEG = (key, label, opts) => `
  <div class="cfg-row"><span class="cfg-label" id="cfg-${key}">${label}</span>
    <div class="seg" role="radiogroup" aria-labelledby="cfg-${key}">
      ${opts.map(([v, l]) => `<button type="button" role="radio" data-key="${key}" data-val="${v}">${l}</button>`).join('')}
    </div></div>`;
const TOG = (key, label) => `
  <label class="cfg-row cfg-toggle"><span class="cfg-label">${label}</span><input type="checkbox" data-key="${key}"><span class="switch" aria-hidden="true"></span></label>`;
const RANGE = (key, label, min, max, step, unit) => `
  <label class="cfg-row cfg-range"><span class="cfg-label">${label}</span><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}"><span class="cfg-val"><output data-out="${key}"></output> <span class="cfg-unit">${unit}</span></span></label>`;
const NOTE = (text) => `<p class="cfg-note lay-hint">${text}</p>`;

// Reihenfolge: Station (wechselt mit dem Ort) → Kamera & Bewegung → Bild → Effekte → Oberfläche; Hinweise direkt unter ihrer Zeile
export function mountSettings(root, btn) {
  root.innerHTML = `
    <h2 class="cfg-title" id="cfg-title">Einstellungen</h2>
    <div class="cfg-station" id="cfg-station"></div>
    <h3 class="cfg-group">Kamera &amp; Bewegung</h3>
    ${SEG('motion', 'Bewegung', [['full', 'Voll'], ['calm', 'Ruhig'], ['off', 'Aus']])}
    ${NOTE('„Aus“ wirkt wie „Bewegung reduzieren“ im System: keine Fahrt von selbst, Wechsel als kurze Überblendung.')}
    ${TOG('cine', 'Leerlauf-Fahrt der Kamera')}
    ${RANGE('dive', 'Flugdauer', 1.5, 8, 0.1, 's')}
    <h3 class="cfg-group">Bild</h3>
    ${SEG('quality', 'Qualität', [['auto', 'Auto'], ['1', 'Leicht'], ['2', 'Mittel'], ['3', 'Fein']])}
    ${RANGE('exposure', 'Belichtung', 0.5, 2, 0.05, '×')}
    ${RANGE('deep', 'Tiefer Himmel', 0, 2, 0.1, '×')}
    ${NOTE('Was eine Langzeitbelichtung hinter den Sternen sieht: ferne Galaxien und schwach leuchtender Staub der Milchstraße (Zirrus) – statistisch verteilt, überhöht, mit bloßem Auge unsichtbar. 0× = reines Schwarz.')}
    ${RANGE('small', 'Satelliten und Kleinkörper', 1, 8, 0.5, '×')}
    ${NOTE('Satelliten, Trümmer und Asteroiden als vergrößerte Symbole – je größer, desto weniger Objekte (4× → jedes achte); 1× zeigt alle als Lichtpunkte.')}
    <h3 class="cfg-group">Effekte</h3>
    ${TOG('bloom', 'Lichthof (Bloom)')}
    ${TOG('lens', 'Farbsaum und Linsenreflex')}
    ${TOG('grain', 'Filmkorn')}
    <h3 class="cfg-group">Oberfläche</h3>
    ${TOG('panel', 'Infotafel zeigen')}
    ${TOG('timeline', 'Zeitleiste der Station zeigen')}`;
  mountLayers({ gear: root.querySelector('#cfg-station'), strip: document.getElementById('timeline'), stripOn: () => settings.S.timeline });
  const sync = () => {
    const S = settings.S;
    root.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-checked', String(S[b.dataset.key] === b.dataset.val)));
    root.querySelectorAll('input[type=checkbox][data-key]').forEach((i) => { i.checked = !!S[i.dataset.key]; });
    root.querySelectorAll('input[type=range][data-key]').forEach((i) => {
      i.value = S[i.dataset.key];
      root.querySelector(`[data-out="${i.dataset.key}"]`).textContent = String(S[i.dataset.key].toFixed(i.step < 0.1 ? 2 : 1)).replace('.', ',');
    });
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.seg button');
    if (b) setSetting(b.dataset.key, b.dataset.val);
  });
  root.addEventListener('input', (e) => {
    const i = e.target;
    if (!i.dataset.key) return;
    setSetting(i.dataset.key, i.type === 'checkbox' ? i.checked : +i.value);
  });
  onSettings((keys) => { sync(); if (keys.includes('timeline')) refreshLayers(); });
  sync();
  const open = (on) => {
    root.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    if (on) root.focus();
  };
  btn.addEventListener('click', () => open(root.hidden));
  if (new URLSearchParams(location.search).has('cfg')) open(true);   // Screenshots: Zahnrad offen
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) { open(false); btn.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (!root.hidden && !root.contains(e.target) && !btn.contains(e.target)) open(false); });
}
