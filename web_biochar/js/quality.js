// Darstellungsqualität in drei Stufen – flüssige Bilder auch auf schwächeren Rechnern.
// Die Stufe steuert Auflösung (Pixelverhältnis, Maßstab der Ebenen-Bilder, Kantenglättung), Linse (Tiefenunschärfe,
// Bloom, Farbsaum, Zahl der Abtastpunkte), Schatten und den Detailgrad der Ebenen (setParam 'quality').
// Wahl bleibt im Browser; ?q=1|2|3 überschreibt sie. Ohne gespeicherte Wahl misst die Seite in den ersten Sekunden
// die Bildrate und schaltet bei Bedarf einmal herunter (steht dann als „auto“ am Regler).

export const QUALITY = [
  { id: 'light', name: 'Leicht', dpr: 1, res: 0.75, msaa: 0, dof: 0, bloom: 0, ca: 0, dofTaps: 0, blurTaps: 6, shadows: false, detail: 0.45 },
  { id: 'medium', name: 'Mittel', dpr: 1.5, res: 0.9, msaa: 2, dof: 0.7, bloom: 0.8, ca: 0.6, dofTaps: 8, blurTaps: 10, shadows: true, detail: 0.7 },
  { id: 'fine', name: 'Fein', dpr: 2, res: 1, msaa: 4, dof: 1, bloom: 1, ca: 1, dofTaps: 12, blurTaps: 12, shadows: true, detail: 1 },
];
const KEY = 'biochar-quality';
const params = new URLSearchParams(location.search);
const input = document.getElementById('in-quality');
const nameEl = document.getElementById('quality-name');
const listeners = [];
let index = QUALITY.length - 1;
let auto = false;
let fixed = false;        // Wahl des Users oder ?q → keine automatische Anpassung

function show() {
  const text = auto ? `${QUALITY[index].name} (auto)` : QUALITY[index].name;
  input.value = String(index);
  input.setAttribute('aria-valuetext', text);
  nameEl.textContent = text;
}
function set(i, { byUser = false, byProbe = false } = {}) {
  i = Math.min(QUALITY.length - 1, Math.max(0, Math.round(i)));
  auto = byProbe;
  if (byUser) {
    fixed = true;
    try { localStorage.setItem(KEY, String(i)); } catch { /* ohne Speicher: gilt nur für diesen Besuch */ }
  }
  const changed = i !== index;
  index = i;
  show();
  if (changed) for (const fn of listeners) fn(QUALITY[index]);
}

// Startwert: ?q=1|2|3 → gespeicherte Wahl → Fein
const valid = (i) => Number.isInteger(i) && i >= 0 && i < QUALITY.length;
const fromUrl = params.has('q') ? +params.get('q') - 1 : NaN;
let stored = NaN;
try { const s = localStorage.getItem(KEY); if (s !== null) stored = +s; } catch { /* egal */ }
if (valid(fromUrl)) { index = fromUrl; fixed = true; }
else if (valid(stored)) { index = stored; fixed = true; }
show();
input.addEventListener('input', () => set(+input.value, { byUser: true }));

// Bildraten-Probe: Bildzeiten zwischen 1,5 s und 5 s nach dem Start sammeln (Hänger > 200 ms zählen nicht);
// Median über 24 ms (unter ≈ 40 Bilder/s) → eine Stufe herunter, über 40 ms → zwei Stufen
const probe = { t: 0, samples: [], done: false };
function tick(real) {
  if (probe.done || fixed) return;
  probe.t += real;
  if (probe.t < 1.5 || document.hidden) return;
  if (real < 0.2) probe.samples.push(real);
  if (probe.t < 5) return;
  probe.done = true;
  if (probe.samples.length < 30) return;
  const s = probe.samples.sort((a, b) => a - b);
  const median = s[s.length >> 1] * 1000;
  const down = median > 40 ? 2 : median > 24 ? 1 : 0;
  if (down) set(index - down, { byProbe: true });
}

export const quality = {
  get: () => QUALITY[index],
  onChange: (fn) => { listeners.push(fn); },
  tick,
};
