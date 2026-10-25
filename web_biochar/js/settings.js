// Einstellungen hinter dem Zahnrad unten links (Wunsch User 2026-10-25): Leistung, Bewegung, Licht, Details.
// Werte in localStorage (biochar-settings.v1, clean() prüft jeden Wert); main.js liest settings.S und hört per settings.on().
// Die Qualitätsstufe selbst bleibt in quality.js (Regler oben rechts + Knopfreihe hier steuern dieselbe Stufe), die Schalter
// hier liegen darüber (main.js eff()). Vorlage: UX-Robot-Hero (dev_ws 350901df, docs/js/hero3d.js „Einstellungen der Bühne“).

import { QUALITY, quality } from './quality.js';

const KEY = 'biochar-settings.v1';
// dive/play: Flugdauer zwischen Ebenen und Länge des Pyrolyse-Zeitraffers (s); key/rim/env/pool: Faktoren auf die Werte der
// Ebenen (1 = wie gebaut); kelvin 6500 = Lichtfarbe der Ebene unverändert (Normierung auf D65); fps 0 = ohne Deckel
const DEF = {
  scale: 1, fps: 0, shadows: true, dof: true, bloom: true, ca: true, grain: true,
  motion: 'full', intro: true, cine: true, orbit: true, sem: true, dive: 3.5, play: 8,
  key: 1, rim: 1, env: 1, kelvin: 6500, exposure: 1, pool: 1,
  dust: true, veil: true, hotspots: true,
};
const RANGE = { scale: [0.5, 1], fps: [0, 60], dive: [1.5, 6], play: [4, 30], key: [0, 2], rim: [0, 2], env: [0, 2],
  kelvin: [2700, 9000], exposure: [0.5, 2], pool: [0, 2] };
const ENUM = { motion: ['full', 'calm', 'off'] };
// Grundstufe setzt die Einzelschalter; „Aus“ wirkt wie prefers-reduced-motion (kurze Flüge ohne Zoom-Unschärfe, Sprünge statt Gleiten)
const MOT = {
  full: { intro: true, cine: true, orbit: true, sem: true },
  calm: { intro: true, cine: false, orbit: false, sem: false },
  off: { intro: false, cine: false, orbit: false, sem: false },
};
// Schalter, die die Darstellungsstufe ändern (main.js applyQuality)
export const PERF_KEYS = ['scale', 'shadows', 'dof', 'bloom', 'ca'];

export function clean(raw) {
  const s = { ...DEF };
  if (!raw || typeof raw !== 'object') return s;
  for (const k in DEF) {
    const v = raw[k];
    if (v === undefined) continue;
    if (k in RANGE) { if (Number.isFinite(v)) s[k] = Math.min(RANGE[k][1], Math.max(RANGE[k][0], v)); }
    else if (k in ENUM) { if (ENUM[k].includes(v)) s[k] = v; }
    else s[k] = v === true;
  }
  return s;
}

const S = (() => {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { /* privat/gesperrt: Standardwerte */ }
  return clean(raw);
})();
const subs = [];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ohne Merken weiter */ } };
function set(patch) {
  const keys = Object.keys(patch).filter((k) => k in DEF && S[k] !== patch[k]);
  if (!keys.length) return;
  Object.assign(S, clean({ ...S, ...patch }));
  save();
  for (const f of subs) f(S, keys);
}

// Bildzeit für die Messzeile: EMA + letzte 60 Bildabstände (main.js ruft frame() je gezeichnetem Bild)
const stat = { ms: 0, log: new Float32Array(60), i: 0 };
function frame(real) {
  const ms = real * 1000;
  stat.ms = stat.ms ? stat.ms + (ms - stat.ms) * 0.1 : ms;
  stat.log[stat.i] = ms;
  stat.i = (stat.i + 1) % stat.log.length;
}

// Farbtemperatur → RGB (Tanner Helland, Näherung an den Planck-Strahler), normiert auf D65 (6500 K = Farbe der Ebene bleibt)
const kelvinRGB = (K) => {
  const t = K / 100, c = (v) => Math.max(0, Math.min(255, v)) / 255;
  return [c(t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592),
    c(t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492),
    c(t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307)];
};
const WHITE = kelvinRGB(6500);
export const kelvinTint = (K) => kelvinRGB(K).map((v, i) => Math.min(1, v / WHITE[i]));

export const settings = {
  S,
  set,
  on(f) { subs.push(f); f(S, null); },
  reset() { set({ ...DEF }); quality.setAuto(); },
  frame,
};

// ---------- Panel ----------
const COG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const num = (v, d = 0) => v.toLocaleString('de', { minimumFractionDigits: d, maximumFractionDigits: d });
// Normlichtarten der CIE als Orientierung (A = Glühlampe 2856 K, D50 … D75 = Tageslichtphasen)
const CIE = [[2856, 'A Glühlampe'], [5003, 'D50 Horizontlicht'], [5503, 'D55 Vormittagssonne'], [6504, 'D65 Tageslicht'], [7504, 'D75 Nordhimmel']];
const cie = (K) => {
  const c = CIE.reduce((b, x) => (Math.abs(x[0] - K) < Math.abs(b[0] - K) ? x : b));
  return Math.abs(c[0] - K) <= 300 ? ` ≈ ${c[1]}` : '';
};
const pct = (v) => `${num(v * 100)} %`;
const sec = (v) => `${num(v, v % 1 ? 1 : 0)} s`;
const OUT = { dive: sec, play: sec, key: pct, rim: pct, env: pct, pool: pct, exposure: (v) => num(v, 2), kelvin: (v) => `${Math.round(v)} K${cie(v)}` };

const seg = (k, opts, label) => `<div class="cfg-row"><span id="cfg-l-${k}">${label}</span><div class="cfg-seg" role="group" aria-labelledby="cfg-l-${k}">${
  opts.map(([v, t]) => `<button type="button" data-k="${k}" data-v="${v}" aria-pressed="false">${t}</button>`).join('')}</div></div>`;
const range = (k, step, label) => `<label class="cfg-row"><span>${label}</span><output></output><input type="range" data-k="${k}" min="${RANGE[k][0]}" max="${RANGE[k][1]}" step="${step}"></label>`;
const sw = (k, label) => `<label class="cfg-sw"><input type="checkbox" data-k="${k}"><span>${label}</span></label>`;

const HTML = `<div class="cfg-head"><h2 id="cfg-title">Einstellungen</h2><button type="button" class="cfg-x" data-close aria-label="Einstellungen schließen">×</button></div>
<section aria-labelledby="cfg-h-perf"><h3 id="cfg-h-perf">Leistung</h3>
${seg('quality', [['auto', 'Auto'], ...QUALITY.map((q, i) => [i, q.name])], 'Qualität')}
<div class="cfg-meter"><span data-meter>–</span><svg class="cfg-spark" viewBox="0 0 96 24" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="15.3" x2="96" y2="15.3"/><polyline points=""/></svg></div>
<p class="cfg-hint" data-qhint></p>
${seg('scale', [[0.5, '50 %'], [0.75, '75 %'], [1, '100 %']], 'Renderskala')}
${seg('fps', [[0, 'frei'], [60, '60'], [30, '30']], 'Bildrate höchstens (Bilder/s)')}
${sw('shadows', 'Schatten (ab Stufe Mittel)')}
${sw('dof', 'Tiefenunschärfe')}
${sw('bloom', 'Bloom auf Glanzlichtern')}
${sw('ca', 'Farbsaum am Bildrand')}
${sw('grain', 'Filmkorn')}
</section>
<section aria-labelledby="cfg-h-mot"><h3 id="cfg-h-mot">Bewegung</h3>
${seg('motion', [['full', 'Voll'], ['calm', 'Ruhig'], ['off', 'Aus']], 'Grundstufe')}
<p class="cfg-hint">Ruhig: keine Leerlauf-Fahrt, kein Orbit, Detektor steht · Aus: nichts bewegt sich von allein, Flüge kurz und ohne Zoom-Unschärfe</p>
${sw('intro', 'Auftakt-Bogen beim Start (9 s)')}
${sw('cine', 'Leerlauf-Fahrt nach 2,5 s Ruhe')}
${sw('orbit', 'Auto-Orbit (Ebenen mit Drehteller)')}
${sw('sem', 'REM-Detektor schwenkt (Licht wandert über die Kanten)')}
${range('dive', 0.5, 'Flugdauer zwischen Ebenen')}
${range('play', 1, 'Pyrolyse-Zeitraffer (Raumtemperatur → Ziel)')}
</section>
<section aria-labelledby="cfg-h-light"><h3 id="cfg-h-light">Licht</h3>
${range('key', 0.1, 'Hauptlicht')}
${range('rim', 0.1, 'Gegenlicht')}
${range('env', 0.1, 'Umgebung + Reflexe')}
${range('kelvin', 100, 'Farbtemperatur Hauptlicht')}
${range('exposure', 0.05, 'Belichtung')}
${range('pool', 0.1, 'Lichtpool im Hintergrund')}
<p class="cfg-hint">REM-Ebenen 2–4 zeigen das Signal des Elektronendetektors, kein Licht: dort wirken nur Belichtung und Lichtpool.</p>
</section>
<section aria-labelledby="cfg-h-det"><h3 id="cfg-h-det">Details</h3>
${sw('dust', 'Schwebstaub im Hintergrund')}
${sw('veil', 'Lichtschleier beim Durchtauchen')}
${sw('hotspots', 'Hotspots (orange Abzeichen)')}
${sw('overlays', 'Messhilfen im 3D-Bild')}
</section>
<div class="cfg-foot"><button type="button" data-reset>Zurücksetzen</button><span class="cfg-hint">Gespeichert in diesem Browser</span></div>`;

// Zahnrad + Panel in .cfg-dock (index.html); Esc, × oder Klick außerhalb schließt; Messzeile alle 500 ms.
// pixels() = gerenderte Bildpunkte des Hauptbilds (Messzeile)
export function mountSettings(pixels) {
  const btn = document.getElementById('btn-cfg'), box = document.getElementById('cfg');
  const ovBtn = document.getElementById('btn-overlays');
  if (!btn || !box) return;
  btn.innerHTML = COG;
  let built = false, timer = 0;
  const sync = () => {
    if (!built) return;
    box.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.dataset.k;
      if (k === 'quality') el.setAttribute('aria-pressed', String(quality.isAuto() ? el.dataset.v === 'auto' : el.dataset.v === String(quality.index())));
      else if (k === 'overlays') el.checked = ovBtn?.getAttribute('aria-pressed') !== 'false';
      else if (el.tagName === 'BUTTON') el.setAttribute('aria-pressed', String(String(S[k]) === el.dataset.v));
      else if (el.type === 'checkbox') el.checked = S[k];
      else { el.value = S[k]; el.parentElement.querySelector('output').textContent = OUT[k](S[k]); }
    });
    box.querySelector('[data-qhint]').textContent = quality.isAuto()
      ? `Auto misst die Bildzeit und passt die Stufe an · jetzt ${quality.get().name}`
      : 'Feste Stufe · Auto misst selbst und schaltet bei Bedarf';
  };
  // Messzeile: Bildabstand ⌀ (EMA), daraus Bilder/s, Bildpunkte; Kurve = letzte 60 Bildabstände (0–50 ms, Strich = 16,7 ms)
  const meter = () => {
    const m = box.querySelector('[data-meter]');
    const mp = pixels() / 1e6;
    m.textContent = stat.ms ? `⌀ ${num(stat.ms, 1)} ms · ${num(1000 / stat.ms)} Bilder/s · ${num(mp, 1)} MP` : `– ms · ${num(mp, 1)} MP`;
    const n = stat.log.length, pts = [];
    for (let j = 0; j < n; j++) {
      const v = stat.log[(stat.i + j) % n];
      pts.push(`${((j / (n - 1)) * 96).toFixed(1)},${(23 - Math.min(23, (v / 50) * 23)).toFixed(1)}`);
    }
    box.querySelector('polyline').setAttribute('points', pts.join(' '));
  };
  const open = (o) => {
    if (o && !built) { box.innerHTML = HTML; built = true; }
    box.hidden = !o;
    btn.setAttribute('aria-expanded', String(o));
    clearInterval(timer);
    timer = 0;
    if (o) { sync(); meter(); box.focus({ preventScroll: true }); timer = setInterval(meter, 500); }
  };
  btn.addEventListener('click', () => open(box.hidden));
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-close')) { open(false); btn.focus(); return; }
    if (b.hasAttribute('data-reset')) { settings.reset(); sync(); return; }
    const k = b.dataset.k, v = b.dataset.v;
    if (k === 'quality') { if (v === 'auto') quality.setAuto(); else quality.set(+v); sync(); }
    else if (k === 'motion') set({ motion: v, ...MOT[v] });
    else if (k in RANGE) set({ [k]: +v });
  });
  box.addEventListener('input', (e) => { const el = e.target; if (el.type === 'range') set({ [el.dataset.k]: +el.value }); });
  box.addEventListener('change', (e) => {
    const el = e.target;
    if (el.type !== 'checkbox') return;
    if (el.dataset.k === 'overlays') ovBtn?.click();   // Zustand hält hud.js (Knopf „Messhilfen“ oben rechts)
    else set({ [el.dataset.k]: el.checked });
  });
  // Tasten im Panel nicht an die Seite weiterreichen (Esc = Ebene zurück, 1–7 = Ebene)
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { open(false); btn.focus(); }
  });
  document.addEventListener('pointerdown', (e) => { if (!box.hidden && !box.contains(e.target) && !btn.contains(e.target)) open(false); });
  subs.push(sync);
  quality.onChange(sync);
  ovBtn?.addEventListener('click', () => queueMicrotask(sync));
}
