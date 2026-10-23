// Kennwerte von Holz-Pflanzenkohle (langsame Pyrolyse) über der Höchsttemperatur.
// Richtwerte zur Veranschaulichung – reale Kohlen streuen je Rohstoff, Heizrate und Verweilzeit stark.
// IPCC-Werte (Fperm) und EBC-Grenzen sind wörtlich übernommen, Quellen in content.js.

import { clamp, lerp } from './util.js';

export const T_MIN = 350;
export const T_ROOM = 25;
export const T_MAX = 800;
const STEPS = [350, 400, 450, 500, 550, 600, 650, 700, 750, 800];
const TABLE = {
  yield: [40, 33, 30, 28, 27, 26, 25, 24, 23.5, 23],     // Masse-% der trockenen Biomasse
  carbon: [70, 75, 79, 82, 85, 87, 89, 90, 91, 92],      // Masse-% C
  hc: [0.75, 0.62, 0.52, 0.44, 0.36, 0.3, 0.25, 0.2, 0.16, 0.13],   // molar H/Corg
  oc: [0.25, 0.19, 0.15, 0.12, 0.09, 0.07, 0.06, 0.05, 0.04, 0.035], // molar O/Corg
  bet: [5, 10, 40, 120, 220, 300, 350, 380, 390, 380],  // m²/g (N2, 77 K)
  ph: [6.8, 7.4, 8, 8.6, 9, 9.4, 9.7, 9.9, 10, 10.1],
};

function interp(key, t) {
  const v = TABLE[key];
  const x = clamp(t, T_MIN, T_MAX);
  let i = 0;
  while (i < STEPS.length - 2 && x > STEPS[i + 1]) i++;
  return lerp(v[i], v[i + 1], (x - STEPS[i]) / (STEPS[i + 1] - STEPS[i]));
}

// IPCC 2019 Refinement, Bd. 4, Kap. 2, Anhang 4, Tab. 4Ap.2: Anteil des Biochar-C nach 100 Jahren
export function fperm(t) {
  if (t > 600) return 0.89;
  if (t >= 450) return 0.8;
  return 0.65;
}

// Einordnung nach Keiluweit et al. (2010); Temperaturgrenzen gerundet, abhängig vom Ausgangsmaterial
export function charClass(t) {
  if (t < 450) return 'amorphe Kohle';
  if (t < 650) return 'Komposit-Kohle';
  return 'turbostratische Kohle';
}

export function properties(t) {
  const p = {
    t,
    yield: interp('yield', t),
    carbon: interp('carbon', t),
    hc: interp('hc', t),
    oc: interp('oc', t),
    bet: interp('bet', t),
    ph: interp('ph', t),
    fperm: fperm(t),
    charClass: charClass(t),
  };
  // CO2, das je Tonne Biochar nach 100 Jahren noch gebunden ist: C-Anteil × Fperm × 44/12
  p.co2 = (p.carbon / 100) * p.fperm * (44 / 12);
  p.ebcOk = p.hc < 0.7 && p.oc < 0.4;
  return p;
}

// Strukturparameter für die Nano-Ebenen (Modell): Clustergröße, Stapel, Schichtabstand
export function nanoStructure(t) {
  const k = clamp((t - T_MIN) / (T_MAX - T_MIN), 0, 1);
  return {
    k,
    rings: Math.round(lerp(3, 19, k * k * 0.55 + k * 0.45)),  // aromatische Ringe je Cluster
    sheetNm: lerp(0.6, 1.6, k),                               // mittlerer Schichtdurchmesser
    layers: lerp(1.25, 3.0, k),                               // mittlere Schichten je Stapel
    d002: lerp(0.4, 0.36, k),                                 // Schichtabstand in nm
    curvature: lerp(0.55, 0.18, k),
    oxygenShare: lerp(0.4, 0.06, k),                          // Anteil der Randplätze mit O-Gruppen
  };
}

// Kelvin-Gleichung (Wasser, 25 °C): 2γVm/(RT) = 1,05 nm → Kelvin-Radius rK = 1,05 nm / ln(p0/p).
// Gefüllt sind Poren bis zum Durchmesser 2·rK plus zweimal ein adsorbierter Wasserfilm (≈ 0,3 nm).
export function kelvinDiameterNm(rh) {
  if (rh <= 0.05) return 0;
  const r = Math.min(rh, 0.995);
  return 2 * (1.05 / Math.log(1 / r)) + 0.6;
}

const nf = (digits) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const fmt = (x, digits = 0) => nf(digits).format(x);

// ---------- Pyrolyse im Zeitraffer (Zeitraffer von Raumtemperatur bis zur gewählten Temperatur) ----------
// Zersetzungsbereiche nach Yang et al. (2007, Fuel 86, 1781–1788): Hemizellulose 220–315 °C, Zellulose 315–400 °C,
// Lignin breit 160–900 °C. Anteile am Buchenholz und Massenverluste sind Richtwerte (Modell), Schwindung und
// Glühfarbe ebenso. Das Glühen beginnt am Draper-Punkt ≈ 525 °C (sichtbare Rotglut).
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const DRAPER = 525;
const lossModel = (t) => 0.28 * 0.78 * sstep(220, 315, t) + 0.42 * 0.95 * sstep(315, 400, t) + 0.3 * 0.55 * sstep(160, 900, t);

export const PHASES = [
  { to: 100, name: 'Aufheizen', gas: 'Holz bleibt unverändert' },
  { to: 200, name: 'Trocknung', gas: 'Wasserdampf H₂O' },
  { to: 315, name: 'Hemizellulose zerfällt', gas: 'CO₂, CO, Essigsäure' },
  { to: 400, name: 'Zellulose zerfällt', gas: 'Teer, Wasserdampf, CO₂' },
  { to: DRAPER, name: 'Lignin verkohlt', gas: 'CH₄, H₂, CO' },
  { to: Infinity, name: 'Aromatisierung · Rotglut', gas: 'H₂, CH₄ (wenig)' },
];

export function pyroState(t) {
  const phase = PHASES.find((p) => t < p.to);
  const y350 = TABLE.yield[0];
  // Masse in % der trockenen Biomasse: unter 350 °C aus dem Zersetzungsmodell, danach aus der Tabelle
  const mass = t >= T_MIN ? interp('yield', t) : 100 - (100 - y350) * lossModel(t) / lossModel(T_MIN);
  return {
    t,
    phase: phase.name,
    gas: phase.gas,
    mass,
    water: 1 - sstep(60, 200, t),                 // Restfeuchte (1 = frisch)
    hemi: 1 - sstep(220, 315, t),                 // noch nicht zersetzter Anteil je Komponente
    cell: 1 - sstep(315, 400, t),
    lignin: 1 - sstep(160, 900, t) * 0.55,
    char: sstep(180, 450, t),                     // Farbe: 0 Holz → 1 tiefschwarz
    shrinkT: 0.28 * sstep(200, 600, t),           // lineare Schwindung quer zur Faser (Modell)
    shrinkL: 0.1 * sstep(200, 600, t),            // längs deutlich geringer
    glow: sstep(DRAPER, 720, t),                  // Rotglut ab dem Draper-Punkt
    vapour: Math.max(0.6 * sstep(60, 130, t) * (1 - sstep(190, 210, t)), 0.8 * sstep(215, 270, t) * (1 - sstep(300, 330, t)),
      sstep(310, 350, t) * (1 - sstep(390, 420, t)), 0.3 * sstep(400, 450, t) * (1 - sstep(520, 640, t))),
  };
}

// Schwarzkörperfarbe (linear RGB, auf Sichtbarkeit skaliert) der Glut: dunkelrot bei 525 °C → orange bei 800 °C
export function glowColor(t) {
  const k = clamp((t - DRAPER) / (800 - DRAPER), 0, 1);
  return [lerp(0.55, 1.0, k), lerp(0.04, 0.24, k * k), lerp(0.0, 0.03, k)];
}

// Laborwerte auch unterhalb von 350 °C (Zeitraffer): vom Holz (Richtwerte Buche) gleitend zur Tabelle bei 350 °C
const WOOD = { carbon: 47, hc: 1.45, oc: 0.65, bet: 1, ph: 5.5 };
export function labProps(t) {
  if (t >= T_MIN) return { ...properties(t), wood: false };
  const p = properties(T_MIN);
  const q = clamp(lossModel(t) / lossModel(T_MIN), 0, 1);
  return {
    t,
    yield: pyroState(t).mass,
    carbon: lerp(WOOD.carbon, p.carbon, q),
    hc: lerp(WOOD.hc, p.hc, q),
    oc: lerp(WOOD.oc, p.oc, q),
    bet: lerp(WOOD.bet, p.bet, q),
    ph: lerp(WOOD.ph, p.ph, q),
    fperm: null,
    co2: null,
    charClass: t < 200 ? 'Holz (lignozellulosisch)' : 'Übergang Holz → Kohle',
    ebcOk: false,
    wood: true,
  };
}

// Schwindung und Wanddicke für die Gewebe-Ebenen, relativ zum Ausgangsbild bei 550 °C (Modell):
// xy quer zur Faser, z längs, wall = Wanddicke im Verhältnis (Masseverlust macht die Wand dünner, Anteil ≈ 12 %)
const WALL_REF = (m) => 0.88 + 0.12 * (m - 23) / 77;
export function tissueScale(t) {
  const s = pyroState(t), r = pyroState(550);
  return {
    xy: (1 - s.shrinkT) / (1 - r.shrinkT),
    z: (1 - s.shrinkL) / (1 - r.shrinkL),
    wall: WALL_REF(s.mass) / WALL_REF(r.mass),
  };
}
