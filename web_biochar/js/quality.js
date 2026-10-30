// Darstellungsqualität in drei Stufen – flüssige Bilder auch auf schwächeren Rechnern (Wahl im Zahnrad, settings.js).
// Die Stufe steuert Auflösung (Pixelverhältnis, Maßstab der Ebenen-Bilder, Kantenglättung), Linse (Tiefenunschärfe,
// Bloom, Farbsaum, Zahl der Abtastpunkte), Schatten und den Detailgrad der Ebenen (setParam 'quality').
// Wahl bleibt im Browser; ?q=1|2|3 überschreibt sie. Ohne gespeicherte Wahl (= Auto, auch per Zahnrad wählbar) misst die Seite in
// den ersten Sekunden die Bildrate und schaltet bei Bedarf herunter, danach wacht sie mit Hysterese weiter.

export const QUALITY = [
  { id: 'light', name: 'Leicht', dpr: 1, res: 0.75, msaa: 0, dof: 0, bloom: 0, ca: 0, dofTaps: 0, blurTaps: 6, shadows: false, detail: 0.45 },
  { id: 'medium', name: 'Mittel', dpr: 1.5, res: 0.9, msaa: 2, dof: 0.7, bloom: 0.8, ca: 0.6, dofTaps: 8, blurTaps: 10, shadows: true, detail: 0.7 },
  { id: 'fine', name: 'Fein', dpr: 2, res: 1, msaa: 4, dof: 1, bloom: 1, ca: 1, dofTaps: 12, blurTaps: 12, shadows: true, detail: 1 },
];
const KEY = 'biochar-quality';
const params = new URLSearchParams(location.search);
const listeners = [];
let index = QUALITY.length - 1;
let fixed = false;        // Wahl des Users oder ?q → keine automatische Anpassung

function set(i, { byUser = false } = {}) {
  i = Math.min(QUALITY.length - 1, Math.max(0, Math.round(i)));
  if (byUser) {
    fixed = true;
    try { localStorage.setItem(KEY, String(i)); } catch { /* ohne Speicher: gilt nur für diesen Besuch */ }
  }
  const changed = i !== index;
  index = i;
  for (const fn of listeners) fn(QUALITY[index], changed);
}

// Startwert: ?q=1|2|3 → gespeicherte Wahl → Fein
const valid = (i) => Number.isInteger(i) && i >= 0 && i < QUALITY.length;
const fromUrl = params.has('q') ? +params.get('q') - 1 : NaN;
let stored = NaN;
try { const s = localStorage.getItem(KEY); if (s !== null) stored = +s; } catch { /* egal */ }
if (valid(fromUrl)) { index = fromUrl; fixed = true; }
else if (valid(stored)) { index = stored; fixed = true; }

// Bildraten-Probe: Bildzeiten ab 1,5 s nach dem Start sammeln, auswerten ab 5 s und frühestens nach 10 Bildern
// (bei sehr niedriger Bildrate misst sie länger). Der Median übergeht einzelne Ladehänger, anhaltend langsame
// Bilder zählen voll. Schwellen relativ zum Bildbudget (budget = 1/60 s, mit Bildraten-Deckel 1/Deckel):
// Median über 1,44 × Budget (bei 60: 24 ms, unter ≈ 40 Bilder/s) → eine Stufe herunter, über 2,4 × (40 ms) → zwei Stufen.
// Danach Wache (nur Auto): Bildzeit-EMA über 2 × Budget für 3 s → eine Stufe herunter. Herauf: Der Bildschirm gibt höchstens
// das Budget aus, Luft heißt deshalb „im Takt“ (EMA unter 1,15 × Budget) für 15 s, frühestens `wait` s (anfangs 30) nach der
// letzten Änderung. Danach Probezeit 6 s: hält die neue Stufe die Schwelle der Probe (1,44 × Budget) nicht, geht sie zurück
// und die Wartezeit verdoppelt sich (bis 8 min) – kein Pendeln zwischen zwei Stufen
const probe = { t: 0, samples: [], done: false };
const watch = { ema: 0, slow: 0, fast: 0, since: 0, wait: 30, trial: 0, trialSlow: 0 };
function tick(real, budget = 1 / 60) {
  if (fixed || document.hidden) return;
  if (!probe.done) {
    probe.t += real;
    if (probe.t < 1.5) return;
    probe.samples.push(real);
    if (probe.t < 5 || probe.samples.length < 10) return;
    probe.done = true;
    const s = probe.samples.sort((a, b) => a - b);
    const median = s[s.length >> 1] / budget;
    const down = median > 2.4 ? 2 : median > 1.44 ? 1 : 0;
    if (down) set(index - down);
    watch.ema = 0; watch.since = 0;
    return;
  }
  const w = watch;
  w.since += real;
  w.ema = w.ema ? w.ema + (real - w.ema) * 0.1 : real;
  const r = w.ema / budget;
  if (r > 2) { w.slow += real; w.fast = 0; } else if (r < 1.15) { w.fast += real; w.slow = 0; } else w.slow = w.fast = 0;
  if (w.trial > 0) {
    w.trial -= real;
    if (w.trial < 5 && r > 1.44) w.trialSlow += real;   // erste Sekunde (Shader übersetzen) zählt nicht
    if (w.trial <= 0 && w.trialSlow > 2) { w.wait = Math.min(480, w.wait * 2); w.slow = w.fast = w.since = 0; set(index - 1); return; }
  }
  const step = w.slow > 3 && index > 0 ? -1 : w.fast > 15 && w.since > w.wait && index < QUALITY.length - 1 ? 1 : 0;
  if (step) { w.slow = w.fast = w.since = 0; w.trial = step > 0 ? 6 : 0; w.trialSlow = 0; set(index + step); }
}

// Auto wählen (Zahnrad): gespeicherte Wahl löschen, ab der aktuellen Stufe neu messen
function setAuto() {
  fixed = false;
  try { localStorage.removeItem(KEY); } catch { /* egal */ }
  Object.assign(probe, { t: 0, samples: [], done: false });
  Object.assign(watch, { ema: 0, slow: 0, fast: 0, since: 0, wait: 30, trial: 0, trialSlow: 0 });
  set(index);
}

export const quality = {
  get: () => QUALITY[index],
  index: () => index,
  isAuto: () => !fixed,
  set: (i) => set(i, { byUser: true }),
  setAuto,
  // fn(stufe, geändert): bei jeder Wahl, geändert = andere Stufe als vorher
  onChange: (fn) => { listeners.push(fn); },
  tick,
};
