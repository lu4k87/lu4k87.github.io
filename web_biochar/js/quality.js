// Darstellungsqualität in vier Stufen – flüssige Bilder auch auf schwachen Rechnern ohne Grafikkarte (Wahl im Zahnrad, settings.js).
// Die Stufe steuert Auflösung (Pixelverhältnis, Maßstab der Ebenen-Bilder, Kantenglättung), Linse (Tiefenunschärfe,
// Bloom, Farbsaum, Zahl der Abtastpunkte), Schatten und den Detailgrad der Ebenen (setParam 'quality'); Sparsam rechnet
// zusätzlich die Waldboden-Texturen kleiner (soilPx) und zeichnet die Lupe nur einmal (still).
// Wahl bleibt im Browser; ?q=0|1|2|3 überschreibt sie. Ohne gespeicherte Wahl (= Auto, auch per Zahnrad wählbar) startet die Seite
// auf schwachen Geräten (Software-Renderer, ≤ 2 GB Speicher oder ≤ 2 Kerne) in Sparsam, sonst in Fein, misst in den ersten
// Sekunden die Bildrate und schaltet bei Bedarf herunter, danach wacht sie mit Hysterese weiter.

export const QUALITY = [
  { id: 'eco', name: 'Sparsam', dpr: 1, res: 0.5, msaa: 0, dof: 0, bloom: 0, ca: 0, dofTaps: 0, blurTaps: 6, shadows: false, detail: 0.3, soilPx: 1024, still: true },
  { id: 'light', name: 'Leicht', dpr: 1, res: 0.75, msaa: 0, dof: 0, bloom: 0, ca: 0, dofTaps: 0, blurTaps: 6, shadows: false, detail: 0.45, still: true },
  { id: 'medium', name: 'Mittel', dpr: 1.5, res: 0.9, msaa: 2, dof: 0.7, bloom: 0.8, ca: 0.6, dofTaps: 8, blurTaps: 10, shadows: true, detail: 0.7 },
  { id: 'fine', name: 'Fein', dpr: 2, res: 1, msaa: 4, dof: 1, bloom: 1, ca: 1, dofTaps: 12, blurTaps: 12, shadows: true, detail: 1 },
];
const KEY = 'biochar-quality.v2';   // Id der Stufe; der alte Schlüssel 'biochar-quality' hielt den Index 0–2 ohne Sparsam
const params = new URLSearchParams(location.search);
const listeners = [];
let index = QUALITY.length - 1;
let fixed = false;        // Wahl des Users oder ?q → keine automatische Anpassung

function set(i, { byUser = false } = {}) {
  i = Math.min(QUALITY.length - 1, Math.max(0, Math.round(i)));
  if (byUser) {
    fixed = true;
    try { localStorage.setItem(KEY, QUALITY[i].id); } catch { /* ohne Speicher: gilt nur für diesen Besuch */ }
  }
  const changed = i !== index;
  index = i;
  for (const fn of listeners) fn(QUALITY[index], changed);
}

// Startwert: ?q=0|1|2|3 → gespeicherte Wahl (alter Index 0–2 = Leicht…Fein) → Fein bzw. Sparsam (detect)
const valid = (i) => Number.isInteger(i) && i >= 0 && i < QUALITY.length;
const fromUrl = params.has('q') ? +params.get('q') : NaN;
let stored = NaN;
try {
  const s = localStorage.getItem(KEY), old = localStorage.getItem('biochar-quality');
  if (s !== null) stored = QUALITY.findIndex((q) => q.id === s);
  else if (old !== null && valid(+old + 1)) stored = +old + 1;
} catch { /* egal */ }
if (valid(fromUrl)) { index = fromUrl; fixed = true; }
else if (valid(stored)) { index = stored; fixed = true; }

// Schwaches Gerät (nur Auto, vor dem ersten Bild): Software-Renderer statt Grafikkarte (SwiftShader, llvmpipe, Microsoft Basic
// Render), ≤ 2 GB Arbeitsspeicher oder ≤ 2 Kerne → gleich Sparsam, die Wache schaltet bei Luft herauf
const SOFT = /swiftshader|llvmpipe|softpipe|software|basic render/i;
export function weakDevice({ renderer = '', memory, cores } = {}) {
  return SOFT.test(renderer) || (memory > 0 && memory <= 2) || (cores > 0 && cores <= 2);
}
function detect(gl) {
  if (fixed) return;
  let renderer = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch { /* ohne Angabe: nur Speicher und Kerne */ }
  const weak = weakDevice({ renderer, memory: navigator.deviceMemory, cores: navigator.hardwareConcurrency });
  if (weak) set(0);
  return weak;
}

// Bildraten-Probe: Bildzeiten ab 1,5 s nach dem Start sammeln, auswerten ab 5 s und frühestens nach 10 Bildern
// (bei sehr niedriger Bildrate misst sie länger). Der Median übergeht einzelne Ladehänger, anhaltend langsame
// Bilder zählen voll. Schwellen relativ zum Bildbudget (budget = 1/60 s, mit Bildraten-Deckel 1/Deckel):
// Median über 1,44 × Budget (bei 60: 24 ms, unter ≈ 40 Bilder/s) → eine Stufe herunter, über 2,4 × (40 ms) → zwei Stufen,
// über 4,8 × (80 ms, unter ≈ 12 Bilder/s) → drei Stufen (von Fein gleich Sparsam).
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
    const down = median > 4.8 ? 3 : median > 2.4 ? 2 : median > 1.44 ? 1 : 0;
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
  detect,
  // fn(stufe, geändert): bei jeder Wahl, geändert = andere Stufe als vorher
  onChange: (fn) => { listeners.push(fn); },
  tick,
};
