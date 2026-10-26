// Einstellungen (Zahnrad oben rechts): Titelzeile mit Stationsname + Schalter Station | Global; „Station“ = Ebenen der aktiven Station
// als Klapp-Liste mit Sprungleiste (layers.js, Vorschau 26.10.2026 Zahnrad:A + C)
// und „Global“ = gilt an allen Stationen (Vorschau 26.10.2026 Global:A+B+C): Karten mit Icon-Plakette und
// Mini-Grafik je Zeile, geänderte Werte markiert mit „Standard“. Gruppen: Look (Farblook, Belichtung, Vignette, Kinobalken),
// Himmel, Kamera & Bewegung, Effekte, Oberfläche (inkl. Bewegung der Info-Grafiken = cards.js `kosmos.figmotion.v1`), Leistung.
// `?cfg` öffnet das Zahnrad, `?cfg=global` mit dem Reiter Global.
// Gespeichert in localStorage `kosmos.settings.v1`; clean() prüft jeden Wert, damit kaputte Einträge nichts stören.

import { mountLayers, refreshLayers, icon, devLine, devBar, markDevs } from './layers.js';
import { nbsp } from './figs.js';

const KEY = 'kosmos.settings.v1';
const DEFAULTS = { motion: 'full', quality: 'auto', cine: true, dive: 3.6, exposure: 1, bloom: true, lens: true, grain: true, deep: 1, fpsCap: 0, panel: true, timeline: true, small: 6, stars: true, grade: 'station', vig: 1, bars: false, axes: false };
// Farblook: Belichtung, Bloom, Kontrast, Sättigung, Tönung Schatten/Lichter, Vignette – Kino = Mischung aus HDR, Ruhig, Tiefe Glut.
// Global (main.js über globalGrade) oder je Station „Station“ = eigener Look; die Sonne wählt bei „Station“ selbst (levels/sun.js)
export const GRADES = [['neutral', { exposure: 1, bloom: 0.12, con: 0.12, sat: 1.04, sh: [0.96, 0.99, 1.06], hi: [1.04, 1, 0.95], vig: 0.38 }],
  ['Kino', { exposure: 1.05, bloom: 0.24, con: 0.25, sat: 1.12, sh: [0.88, 0.93, 1.06], hi: [1.1, 0.99, 0.86], vig: 0.55 }],
  ['Kino-HDR', { exposure: 1.15, bloom: 0.22, con: 0.22, sat: 1.1, sh: [0.9, 0.96, 1.12], hi: [1.08, 1, 0.88], vig: 0.5 }],
  ['ruhig', { exposure: 1, bloom: 0.16, con: 0.18, sat: 1, sh: [0.97, 0.98, 1.02], hi: [1.04, 1, 0.94], vig: 0.45 }],
  ['tiefe Glut', { exposure: 0.9, bloom: 0.3, con: 0.3, sat: 1.18, sh: [0.85, 0.88, 0.98], hi: [1.12, 0.98, 0.84], vig: 0.6 }]];
const GRADE_IDS = ['station', 'neutral', 'kino', 'hdr', 'ruhig', 'glut'];
const CHOICES = { motion: ['full', 'calm', 'off'], quality: ['auto', '1', '2', '3'], grade: GRADE_IDS };

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
  S.vig = Math.min(1.5, Math.max(0, S.vig));
  if (![0, 30, 60].includes(S.fpsCap)) S.fpsCap = 0;
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

const NEW = '<span class="b-new">neu</span>';
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
// Mini-Grafik neben der Zeile: zeigt, was die Einstellung bewirkt (schmal: ausgeblendet)
const MINI = {
  exposure: '<rect x="1" y="6" width="62" height="8" rx="4" fill="url(#mgE)"/><circle cx="32" cy="10" r="5" fill="none" stroke="var(--accent)" stroke-width="2"/>',
  vig: '<rect x="1" y="1" width="62" height="18" rx="3" fill="url(#mgV)"/>',
  bars: '<rect x="1" y="1" width="62" height="18" rx="3" fill="#34405a"/><rect x="1" y="1" width="62" height="4" fill="#05070c"/><rect x="1" y="15" width="62" height="4" fill="#05070c"/>',
  stars: '<path d="M1 15C20 8 44 8 63 4" stroke="#7d8fb6" stroke-width="5" opacity=".45" fill="none"/>' + [[6, 5], [18, 16], [30, 4], [44, 15], [58, 11], [36, 10]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#fff"/>`).join(''),
  deep: '<rect x="1" y="1" width="62" height="18" rx="3" fill="#070a12"/>' + [[8, 6], [15, 13], [24, 8], [31, 15], [40, 5], [47, 12], [56, 8], [20, 4], [52, 15]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="${1 + (i % 3) * 0.6}" ry="0.8" fill="#a9b8d8" opacity="${0.35 + (i % 3) * 0.2}"/>`).join(''),
  small: [3, 5, 7].map((r, i) => `<circle cx="${10 + i * 20}" cy="10" r="${r * 0.9}" fill="none" stroke="#c9d4ea" stroke-width="1.4"/>`).join(''),
  motion: '<path d="M2 10Q10 2 18 10T34 10T50 10T66 10" fill="none" stroke="var(--accent)" stroke-width="2"/>',
  dive: '<path d="M2 18C24 18 40 2 62 2" fill="none" stroke="var(--accent)" stroke-width="2"/><circle cx="2" cy="18" r="2" fill="#c9d4ea"/><circle cx="62" cy="2" r="2" fill="#c9d4ea"/>',
  axes: '<circle cx="32" cy="10" r="6" fill="#34405a"/><path d="M33.6 4.4L35.4 0.6" stroke="var(--accent)" stroke-width="2"/><path d="M30.4 15.6L28.6 19.4" stroke="#aab4c8" stroke-width="2"/>',
  fpsCap: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${3 + i * 7.5}" y="${i % 2 ? 6 : 3}" width="5" height="${i % 2 ? 11 : 14}" rx="1" fill="#c9d4ea" opacity="${i < 6 ? 0.85 : 0.3}"/>`).join(''),
};
const MINI_DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="mgE"><stop offset="0" stop-color="#05070c"/><stop offset="1" stop-color="#f4f7ff"/></linearGradient><radialGradient id="mgV"><stop offset=".45" stop-color="#7a8cab"/><stop offset="1" stop-color="#05070c"/></radialGradient></defs></svg>';
// Zeile = Bedienung (+ Mini-Grafik daneben) + Hinweis darunter + Zeile „geändert · Standard“
const ROW = (key, html) => {
  const i = html.indexOf('<p class="cfg-note'), [ctl, note] = i < 0 ? [html, ''] : [html.slice(0, i), html.slice(i)];
  return `<div class="b-item">${MINI[key] ? `<div class="b-line">${ctl}<svg class="b-mini" viewBox="0 0 64 20" aria-hidden="true">${MINI[key]}</svg></div>` : ctl}${note}${key ? devLine(key) : ''}</div>`;
};
// Farblook als Bild-Kacheln: Farben aus Tönung, Belichtung und Vignette des jeweiligen Looks; „Station“ = vier Looks im Kreis
const rgb = (b, t, e) => `rgb(${b.map((x, i) => Math.min(255, Math.round(x * t[i] * e))).join(',')})`;
const swatch = (g) => (g ? `background:radial-gradient(circle at 34% 62%, ${rgb([255, 236, 190], g.hi, g.exposure)} 0 9%, ${rgb([240, 140, 50], g.hi, g.exposure)} 22%, ${rgb([120, 40, 22], g.sh, g.exposure)} 46%, ${rgb([22, 26, 44], g.sh, g.exposure)} 78%);box-shadow:inset 0 0 ${Math.round(g.vig * 26)}px rgba(0,0,0,.85)`
  : 'background:conic-gradient(from 200deg at 50% 55%, #e88a3a 0 25%, #4e7bd6 0 50%, #9a62c9 0 75%, #3aa88a 0)');
const LOOKS = `<div class="b-row b-stack"><span class="cfg-label" id="cfg-grade">Farblook${NEW}</span>
  <div class="b-looks" role="radiogroup" aria-labelledby="cfg-grade">${GRADE_IDS.map((id, i) => `<button type="button" role="radio" data-key="grade" data-val="${id}"><span class="b-sw" style="${swatch(i ? GRADES[i - 1][1] : null)}"></span><span>${i ? GRADES[i - 1][0] : 'Station'}</span></button>`).join('')}</div></div>`
  + NOTE('„Station“ = jede Station behält ihren eigenen Look (die Sonne hat dafür einen eigenen Farblook); die anderen gelten überall.');
const GROUPS = [
  { id: 'look', icon: 'look', title: 'Look', hero: true, rows: [['grade', LOOKS], ['exposure', RANGE('exposure', 'Belichtung', 0.5, 2, 0.05, '×')],
    ['vig', RANGE('vig', 'Vignette', 0, 1.5, 0.05, '×', NEW)], ['bars', TOG('bars', 'Kinobalken 2,39:1', NEW)]] },
  { id: 'sky', icon: 'sky', title: 'Himmel', rows: [['stars', TOG('stars', 'Sterne und Milchstraße')],
    ['deep', RANGE('deep', 'Tiefer Himmel', 0, 2, 0.1, '×') + NOTE('Was eine Langzeitbelichtung hinter den Sternen sieht: ferne Galaxien und schwach leuchtender Staub der Milchstraße (Zirrus) – statistisch verteilt, überhöht, mit bloßem Auge unsichtbar. 0× = reines Schwarz.')],
    ['small', RANGE('small', 'Satelliten und Kleinkörper', 1, 8, 0.5, '×') + NOTE('Satelliten, Trümmer und Asteroiden als vergrößerte Symbole – je größer, desto weniger Objekte (4× → jedes achte); 1× zeigt alle als Lichtpunkte.')],
    ['axes', TOG('axes', 'Drehachsen der Planeten und Monde', NEW) + NOTE('Linie über Nord- und Südpol jedes Planeten und Mondes, neigt und dreht sich mit dem Körper. Nordpol eisblau, Südpol grau.')]] },
  { id: 'cam', icon: 'cam', title: 'Kamera &amp; Bewegung', rows: [['motion', SEG('motion', 'Bewegung', [['full', 'Voll'], ['calm', 'Ruhig'], ['off', 'Aus']]) + NOTE('„Aus“ wirkt wie „Bewegung reduzieren“ im System: keine Fahrt von selbst, Wechsel als kurze Überblendung.')],
    ['cine', TOG('cine', 'Leerlauf-Fahrt der Kamera')], ['dive', RANGE('dive', 'Flugdauer', 1.5, 8, 0.1, 's')]] },
  { id: 'fx', icon: 'fx', title: 'Effekte', half: true, rows: [['bloom', TOG('bloom', 'Lichthof (Bloom)')], ['lens', TOG('lens', 'Farbsaum und Linsenreflex')], ['grain', TOG('grain', 'Filmkorn')]] },
  { id: 'ui', icon: 'ui', title: 'Oberfläche', half: true, rows: [['panel', TOG('panel', 'Infotafel zeigen')], ['timeline', TOG('timeline', 'Zeitleiste der Station zeigen')],
    ['', TOG('', 'Grafiken der Info-Karten bewegt', NEW, 'data-figs')]] },
  { id: 'perf', icon: 'perf', title: 'Leistung', rows: [['quality', SEG('quality', 'Qualität', [['auto', 'Auto'], ['1', 'Leicht'], ['2', 'Mittel'], ['3', 'Fein']])],
    ['fpsCap', SEG('fpsCap', 'Bildrate', [['0', 'Frei'], ['60', '60'], ['30', '30']], NEW) + NOTE('30 Bilder/s spart am Laptop Strom und Lüfter.')]] },
];
const N_GLOBAL = GROUPS.reduce((n, g) => n + g.rows.length, 0);
const CARD = (g) => `<article class="b-card${g.half ? '' : ' b-wide'}${g.hero ? ' b-card--hero' : ''}" data-g="${g.id}"><header class="b-head"><span class="b-plaque">${icon(g.icon)}</span><h4>${g.title}</h4><span class="b-count" aria-label="${g.rows.length} Einstellungen">${g.rows.length}</span></header>${g.rows.map(([k, h]) => ROW(k, h)).join('')}</article>`;

export function mountSettings(root, btn) {
  root.innerHTML = `
    <div class="cfg-hd">
      <div class="cfg-hd-t"><h2 class="cfg-title" id="cfg-title">Einstellungen</h2><span class="cfg-hd-st" data-st-name></span><span class="cfg-hd-st" data-gl-name hidden>Alle Stationen</span></div>
      <div class="cfg-tabs" role="tablist" aria-label="Geltungsbereich">
        <button type="button" role="tab" id="cfg-tab-st" data-tab="st" aria-controls="cfg-station"></button>
        <button type="button" role="tab" id="cfg-tab-gl" data-tab="gl" aria-controls="cfg-global">Global<span class="b-count">${N_GLOBAL}</span></button>
      </div>
    </div>
    <div class="cfg-pane" id="cfg-station" role="tabpanel" aria-labelledby="cfg-tab-st"></div>
    <div class="cfg-pane" id="cfg-global" role="tabpanel" aria-labelledby="cfg-tab-gl">${MINI_DEFS}
      <div class="b-main">${devBar('Einstellungen')}<div class="bento">${GROUPS.map(CARD).join('')}</div></div>
    </div>`;
  const glob = root.querySelector('#cfg-global');
  const tabs = [...root.querySelectorAll('[role=tab]')];
  const pick = (tab, focus) => tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    root.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    if (on && focus) t.focus();
    if (on) { root.querySelector('[data-st-name]').hidden = t !== tabs[0]; root.querySelector('[data-gl-name]').hidden = t === tabs[0]; }
  });
  root.querySelector('.cfg-tabs').addEventListener('click', (e) => { const t = e.target.closest('[role=tab]'); if (t) pick(t); });
  root.querySelector('.cfg-tabs').addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    pick(tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
  });
  pick(tabs[new URLSearchParams(location.search).get('cfg') === 'global' ? 1 : 0]);
  mountLayers({ gear: root.querySelector('#cfg-station'), head: root.querySelector('#cfg-tab-st'), name: root.querySelector('[data-st-name]'), strip: document.getElementById('timeline'), stripOn: () => settings.S.timeline });
  const sync = () => {
    const S = settings.S;
    root.querySelectorAll('[data-key][data-val]').forEach((b) => b.setAttribute('aria-checked', String(String(S[b.dataset.key]) === b.dataset.val)));
    const f = root.querySelector('[data-figs]');
    if (f) f.checked = figsOn();
    root.querySelectorAll('input[type=checkbox][data-key]').forEach((i) => { i.checked = !!S[i.dataset.key]; });
    root.querySelectorAll('input[type=range][data-key]').forEach((i) => {
      i.value = S[i.dataset.key];
      root.querySelector(`[data-out="${i.dataset.key}"]`).textContent = String(S[i.dataset.key].toFixed(i.step < 0.1 ? 2 : 1)).replace('.', ',');
    });
    markDevs(glob, (k) => S[k] !== DEFAULTS[k]);
  };
  const num = (k, v) => (typeof DEFAULTS[k] === 'number' ? +v : v);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-key][data-val]');
    if (b) setSetting(b.dataset.key, num(b.dataset.key, b.dataset.val));
    const r = e.target.closest('[data-reset]');
    if (r && glob.contains(r)) for (const k of r.dataset.reset === '*' ? Object.keys(DEFAULTS) : [r.dataset.reset]) setSetting(k, DEFAULTS[k]);
  });
  root.addEventListener('input', (e) => {
    const i = e.target;
    if (i.matches('[data-figs]')) { setFigs(i.checked); return; }
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
