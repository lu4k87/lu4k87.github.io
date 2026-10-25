// Einstellungen (Zahnrad oben rechts): Bewegung, Qualität, Linse, Flugdauer, Belichtung, Infotafel.
// Gespeichert in localStorage `kosmos.settings.v1`; clean() prüft jeden Wert, damit kaputte Einträge nichts stören.

const KEY = 'kosmos.settings.v1';
const DEFAULTS = { motion: 'full', quality: 'auto', cine: true, dive: 3.6, exposure: 1, bloom: true, lens: true, grain: true, fpsCap: 0, panel: true };
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
  <label class="cfg-row cfg-range"><span class="cfg-label">${label}</span><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}"><output data-out="${key}"></output><span class="cfg-unit">${unit}</span></label>`;

export function mountSettings(root, btn) {
  root.innerHTML = `
    <h2 class="cfg-title" id="cfg-title">Einstellungen</h2>
    ${SEG('motion', 'Bewegung', [['full', 'Voll'], ['calm', 'Ruhig'], ['off', 'Aus']])}
    ${SEG('quality', 'Qualität', [['auto', 'Auto'], ['1', 'Leicht'], ['2', 'Mittel'], ['3', 'Fein']])}
    ${TOG('cine', 'Leerlauf-Fahrt der Kamera')}
    ${TOG('panel', 'Infotafel zeigen')}
    ${RANGE('dive', 'Flugdauer', 1.5, 8, 0.1, 's')}
    ${RANGE('exposure', 'Belichtung', 0.5, 2, 0.05, '×')}
    ${TOG('bloom', 'Lichthof (Bloom)')}
    ${TOG('lens', 'Farbsaum am Rand')}
    ${TOG('grain', 'Filmkorn')}
    <p class="cfg-note">„Aus“ wirkt wie die System-Einstellung „Bewegung reduzieren“: keine Fahrt von selbst, Wechsel als kurze Überblendung.</p>`;
  const sync = () => {
    const S = settings.S;
    root.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-checked', String(S[b.dataset.key] === b.dataset.val)));
    root.querySelectorAll('input[type=checkbox]').forEach((i) => { i.checked = !!S[i.dataset.key]; });
    root.querySelectorAll('input[type=range]').forEach((i) => {
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
  onSettings(sync);
  sync();
  const open = (on) => {
    root.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    if (on) root.focus();
  };
  btn.addEventListener('click', () => open(root.hidden));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) { open(false); btn.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (!root.hidden && !root.contains(e.target) && !btn.contains(e.target)) open(false); });
}
