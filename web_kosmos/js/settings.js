// Einstellungen (Zahnrad oben rechts) mit zwei Reitern: „Station · …“ = Ebenen der aktiven Station als Bento-Karten (layers.js)
// und „Global“ = gilt an allen Stationen: Kamera & Bewegung (Bewegung, Leerlauf-Fahrt, Flugdauer), Bild (Qualität, Belichtung,
// Sterne und Milchstraße, Tiefer Himmel, Kleinkörper), Effekte (Bloom, Farbsaum, Korn), Oberfläche (Infotafel, Zeitleiste).
// `?cfg` öffnet das Zahnrad, `?cfg=global` mit dem Reiter Global.
// Gespeichert in localStorage `kosmos.settings.v1`; clean() prüft jeden Wert, damit kaputte Einträge nichts stören.

import { mountLayers, refreshLayers } from './layers.js';

const KEY = 'kosmos.settings.v1';
const DEFAULTS = { motion: 'full', quality: 'auto', cine: true, dive: 3.6, exposure: 1, bloom: true, lens: true, grain: true, deep: 1, fpsCap: 0, panel: true, timeline: true, small: 6, stars: true };
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

const SEG = (key, label, opts) => `
  <div class="b-row b-stack"><span class="cfg-label" id="cfg-${key}">${label}</span>
    <div class="seg b-seg" role="radiogroup" aria-labelledby="cfg-${key}">
      ${opts.map(([v, l]) => `<button type="button" role="radio" data-key="${key}" data-val="${v}">${l}</button>`).join('')}
    </div></div>`;
const TOG = (key, label) => `
  <label class="b-row cfg-toggle"><span class="cfg-label">${label}</span><input type="checkbox" data-key="${key}"><span class="switch" aria-hidden="true"></span></label>`;
const RANGE = (key, label, min, max, step, unit) => `
  <label class="b-row b-stack"><span class="b-top"><span class="cfg-label">${label}</span><span class="cfg-val"><output data-out="${key}"></output> <span class="cfg-unit">${unit}</span></span></span>
    <span class="b-track"><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}"></span></label>`;
const NOTE = (text) => `<p class="cfg-note lay-hint">${text}</p>`;
// Karte je Thema; `wide` = volle Breite, sonst halbe Karte im 2-Spalten-Raster
const CARD = (title, rows, wide = true) => `<article class="b-card${wide ? ' b-wide' : ''}"><header class="b-head"><h4>${title}</h4><span class="b-count" aria-label="${rows.length} Einstellungen">${rows.length}</span></header>${rows.map((r) => `<div class="b-item">${r}</div>`).join('')}</article>`;
const N_GLOBAL = Object.keys(DEFAULTS).length - 1;   // ohne fpsCap (nur URL/Konsole)

export function mountSettings(root, btn) {
  root.innerHTML = `
    <h2 class="cfg-title" id="cfg-title">Einstellungen</h2>
    <div class="cfg-tabs" role="tablist" aria-label="Geltungsbereich">
      <button type="button" role="tab" id="cfg-tab-st" data-tab="st" aria-controls="cfg-station"></button>
      <button type="button" role="tab" id="cfg-tab-gl" data-tab="gl" aria-controls="cfg-global">Global · alle Stationen<span class="b-count">${N_GLOBAL}</span></button>
    </div>
    <div class="bento" id="cfg-station" role="tabpanel" aria-labelledby="cfg-tab-st"></div>
    <div class="bento" id="cfg-global" role="tabpanel" aria-labelledby="cfg-tab-gl">
      ${CARD('Kamera &amp; Bewegung', [
        SEG('motion', 'Bewegung', [['full', 'Voll'], ['calm', 'Ruhig'], ['off', 'Aus']]) + NOTE('„Aus“ wirkt wie „Bewegung reduzieren“ im System: keine Fahrt von selbst, Wechsel als kurze Überblendung.'),
        TOG('cine', 'Leerlauf-Fahrt der Kamera'),
        RANGE('dive', 'Flugdauer', 1.5, 8, 0.1, 's')])}
      ${CARD('Bild', [
        SEG('quality', 'Qualität', [['auto', 'Auto'], ['1', 'Leicht'], ['2', 'Mittel'], ['3', 'Fein']]),
        RANGE('exposure', 'Belichtung', 0.5, 2, 0.05, '×'),
        TOG('stars', 'Sterne und Milchstraße'),
        RANGE('deep', 'Tiefer Himmel', 0, 2, 0.1, '×') + NOTE('Was eine Langzeitbelichtung hinter den Sternen sieht: ferne Galaxien und schwach leuchtender Staub der Milchstraße (Zirrus) – statistisch verteilt, überhöht, mit bloßem Auge unsichtbar. 0× = reines Schwarz.'),
        RANGE('small', 'Satelliten und Kleinkörper', 1, 8, 0.5, '×') + NOTE('Satelliten, Trümmer und Asteroiden als vergrößerte Symbole – je größer, desto weniger Objekte (4× → jedes achte); 1× zeigt alle als Lichtpunkte.')])}
      ${CARD('Effekte', [TOG('bloom', 'Lichthof (Bloom)'), TOG('lens', 'Farbsaum und Linsenreflex'), TOG('grain', 'Filmkorn')], false)}
      ${CARD('Oberfläche', [TOG('panel', 'Infotafel zeigen'), TOG('timeline', 'Zeitleiste der Station zeigen')], false)}
    </div>`;
  const tabs = [...root.querySelectorAll('[role=tab]')];
  const pick = (tab, focus) => tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    root.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    if (on && focus) t.focus();
  });
  root.querySelector('.cfg-tabs').addEventListener('click', (e) => { const t = e.target.closest('[role=tab]'); if (t) pick(t); });
  root.querySelector('.cfg-tabs').addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    pick(tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
  });
  pick(tabs[new URLSearchParams(location.search).get('cfg') === 'global' ? 1 : 0]);
  mountLayers({ gear: root.querySelector('#cfg-station'), head: root.querySelector('#cfg-tab-st'), strip: document.getElementById('timeline'), stripOn: () => settings.S.timeline });
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
    document.body.classList.toggle('cfg-open', on);   // Kapitel-Titel weicht dem offenen Zahnrad
    btn.setAttribute('aria-expanded', String(on));
    if (on) root.focus();
  };
  btn.addEventListener('click', () => open(root.hidden));
  if (new URLSearchParams(location.search).has('cfg')) open(true);   // Screenshots: Zahnrad offen
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) { open(false); btn.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (!root.hidden && !root.contains(e.target) && !btn.contains(e.target)) open(false); });
}
