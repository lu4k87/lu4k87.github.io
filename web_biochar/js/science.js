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
    // mittlerer Schichtdurchmesser: Domänengröße holziger Kohlen nach Wood et al. (2023), ≈ 12 Ringe bei 400 °C, 41 bei
    // 600 °C, 155 bei 800 °C (aus H/C) → Ringzahl n = 12·e^((T−400)·0,0064), runde Scheibe: d = 2·√(n·0,0524 nm²/π)
    sheetNm: 0.258 * Math.sqrt(12 * Math.exp((lerp(T_MIN, T_MAX, k) - 400) * 0.0064)),
    layers: lerp(1.25, 3.0, k),                               // mittlere Schichten je Stapel
    d002: lerp(0.4, 0.36, k),                                 // Schichtabstand in nm
    curvature: lerp(0.55, 0.18, k),
    oxygenShare: lerp(0.4, 0.06, k),                          // Anteil der Randplätze mit O-Gruppen
  };
}

// Kelvin-Gleichung (Wasser, 25 °C): 2γVm/(RT) = 1,05 nm → Radius des halbkugeligen Meniskus (zwei Krümmungen)
// rK = 1,05 nm / ln(p0/p), der zylindrische Meniskus (eine Krümmung) hat bei gleicher Feuchte den halben Radius.
// Gefüllt sind Poren bis zum Durchmesser 2·rK plus zweimal ein adsorbierter Wasserfilm (≈ 0,3 nm); unter 5 % trocken.
export function kelvinDiameterNm(rh, curv = 2) {
  if (rh <= 0.05) return 0;
  const r = Math.min(rh, 0.995);
  return curv * (1.05 / Math.log(1 / r)) + 0.6;
}

// Hysterese nach Cohan (1938), jede Pore für sich, ohne Netzwerkeffekte (Modell): eine offene Pore füllt über den Film an
// der Wand mit zylindrischem Meniskus und leert erst über den halbkugeligen Meniskus am Porenende → eine Pore, die bei p
// füllt, leert bei p². Gefüllt bis d bleibt zwischen Füll- und Entleerungsast stehen.
export const fillDiameterNm = (rh) => kelvinDiameterNm(rh, 1);
export const desorbDiameterNm = (rh) => kelvinDiameterNm(rh, 2);
export const wetDiameterNm = (prev, rh) => clamp(prev, fillDiameterNm(rh), desorbDiameterNm(rh));
// Luftfeuchte, bei der Poren mit Durchmesser d (nm) füllen – Umkehrung von fillDiameterNm
export const kelvinRh = (d) => (d <= 0.6 ? 0 : Math.exp(-1.05 / (d - 0.6)));

// IUPAC-Klassen (Thommes et al. 2015): Mikro < 2 nm, Meso 2–50 nm, Makro > 50 nm; '' = trocken
export const poreClass = (d) => (d <= 0.6 ? '' : d < 2 ? 'micro' : d < 50 ? 'meso' : 'macro');

// Porenvolumen der Ebene 5 (Modell): Mikroporen der Ebene 6, Schlitzporen 2–3,2 nm (füllen wie ein Zylinder mit Ø = Weite),
// rundliche Poren 12–40 nm und Schwundriss (Keil, füllt von der Spitze her bis zur Breite 50 nm) wie im Shader; Anteile am
// Volumen geschätzt. filledShare = gefüllter Anteil bis Durchmesser d.
export const PORE_VOLUME = [{ from: 0.6, to: 2, share: 0.5 }, { from: 2, to: 3.2, share: 0.25 }, { from: 12, to: 40, share: 0.15 }, { from: 1.2, to: 50, share: 0.1 }];
export const filledShare = (d) => PORE_VOLUME.reduce((s, c) => s + c.share * clamp((d - c.from) / (c.to - c.from), 0, 1), 0);
// Isotherme (Modell): gefüllter Anteil über p/p₀, Füll- und Entleerungsast
export function isotherm(steps = 99) {
  const ads = [], des = [];
  for (let i = 0; i <= steps; i++) {
    const rh = (i / steps) * 0.99;
    ads.push([rh, filledShare(fillDiameterNm(rh))]);
    des.push([rh, filledShare(desorbDiameterNm(rh))]);
  }
  return { ads, des };
}

const nf = (digits) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const fmt = (x, digits = 0) => nf(digits).format(x);

// ---------- Pyrolyse im Zeitraffer (Zeitraffer von Raumtemperatur bis zur gewählten Temperatur) ----------
// Zersetzungsbereiche nach Yang et al. (2007, Fuel 86, 1781–1788): Hemizellulose 220–315 °C, Zellulose 315–400 °C,
// Lignin breit 160–900 °C. Anteile am Buchenholz und Massenverluste sind Richtwerte (Modell), Schwindung und
// Glühfarbe ebenso. Das Glühen beginnt am Draper-Punkt ≈ 525 °C (sichtbare Rotglut).
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const DRAPER = 525;
// Schwindung bei voller Verkohlung (≥ 600 °C), Anteil 0–1: quer im Mittel 28 %, längs 10 % (Modell); quer aufgeteilt in
// tangential 31 % > radial 25 % (Richtwerte; Reihenfolge nach Byrne & Nagle 1997, Carbon 35)
export const SHRINK = { mean: 0.28, tan: 0.31, rad: 0.25, lon: 0.1 };
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
    // Holz → Kohle in den Gewebe- und Nano-Ebenen (Modell; Fenster nach Yang et al. 2007 und Keiluweit et al. 2010)
    starch: 1 - sstep(220, 330, t),               // Stärkekörner im Strahlparenchym verschwinden mit den Hemizellulosen
    membrane: 1 - sstep(240, 360, t),             // Tüpfelmembranen (Zellulose/Pektin) zerfallen
    fibril: 1 - sstep(315, 400, t),               // Zellulose-Mikrofibrillen: Riefen (Ebene 4), Fibrillen (Ebene 6)
    matrix: 1 - sstep(220, 380, t),               // Hemizellulose-/Lignin-Matrix zwischen den Fibrillen
    glassy: sstep(300, 450, t),                   // Bruchflächen faserig → glasig, Wand amorph
    sheets: sstep(300, 400, t),                   // aromatische Schichten entstehen (amorphe Kohle)
    open: sstep(300, 400, t),                     // Nanoporen der Zellwand entstehen nach dem Zerfall der Fasern (Paris et al. 2005)
    shrinkT: SHRINK.mean * sstep(200, 600, t),    // lineare Schwindung quer zur Faser, Mittel (Modell)
    shrinkL: SHRINK.lon * sstep(200, 600, t),     // längs deutlich geringer
    shrinkTan: SHRINK.tan * sstep(200, 600, t),   // tangential (entlang der Jahrringe) am stärksten
    shrinkRad: SHRINK.rad * sstep(200, 600, t),   // radial (entlang der Strahlen) weniger
    glow: sstep(DRAPER, 720, t),                  // Rotglut ab dem Draper-Punkt
    vapour: Math.max(0.6 * sstep(60, 130, t) * (1 - sstep(190, 210, t)), 0.8 * sstep(215, 270, t) * (1 - sstep(300, 330, t)),
      sstep(310, 350, t) * (1 - sstep(390, 420, t)), 0.3 * sstep(400, 450, t) * (1 - sstep(520, 640, t))),
  };
}

// Schwarzkörperfarbe (linear RGB, auf Sichtbarkeit skaliert) der Glut: dunkelrot bei 525 °C → kirschrot bei 800 °C
// (Glühfarben: 800 °C kirschrot, orange erst ab ≈ 1000 °C; Grün knapp über dem Planck-Wert, weil das Auge im Dunkeln
// die Glut wärmer sieht als die reine Chromatizität)
export function glowColor(t) {
  const k = clamp((t - DRAPER) / (800 - DRAPER), 0, 1);
  return [lerp(0.55, 1.0, k), lerp(0.035, 0.12, k * k), lerp(0.0, 0.012, k)];
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
// xy quer zur Faser, z längs, wall = Wanddicke im Verhältnis (Masseverlust macht die Wand dünner, Anteil ≈ 12 %),
// crack = Öffnung des Radialrisses am breiten Holzstrahl (0 Holz … 1 voll): tangential schwindet das Gewebe stärker
// als radial, die weichen Strahlzellen reißen zuerst (Modell, Beginn mit der Zellulose-Zersetzung). Mit weiterer
// Schwindung reißt die Kohle an mehr Stellen (Würfelmuster): crackRay = Radialrisse an schmalen Strahlen, crackRing =
// Tangentialriss entlang der Jahrringgrenze (Spätholz schwindet anders als Frühholz), beide später (Modell)
const WALL_REF = (m) => 0.88 + 0.12 * (m - 23) / 77;
export function tissueScale(t) {
  const s = pyroState(t), r = pyroState(550);
  return {
    xy: (1 - s.shrinkT) / (1 - r.shrinkT),
    x: (1 - s.shrinkTan) / (1 - r.shrinkTan),   // tangential (Ebene 2: x)
    y: (1 - s.shrinkRad) / (1 - r.shrinkRad),   // radial (Ebene 2: y)
    z: (1 - s.shrinkL) / (1 - r.shrinkL),
    wall: WALL_REF(s.mass) / WALL_REF(r.mass),
    crack: sstep(320, 650, t),
    crackRay: sstep(430, 730, t),
    crackRing: sstep(520, 800, t),
  };
}

// ---------- Feinschliff Makro (2026-10-25): Leitfähigkeit, Benetzung, Kapillar-Aufstieg, Schwund-Richtungen ----------

// Elektrische Leitfähigkeit σ des Kohle-Monolithen (S/m) über der Höchsttemperatur – Modell, log-linear in zwei Ästen:
// ab 600 °C nach Gabhi et al. (2020): Ahorn-/Kiefern-Monolithen ≈ 1 S/m bei 600 °C bis ≈ 1000 bzw. 350 S/m bei 1000 °C
// (0,75 Dekaden je 100 K); darunter fällt σ steil (2,5 Dekaden je 100 K): Hagemann et al. (2025) messen im Schüttbett
// 600 → 700 °C vier Dekaden, Mochidzuki et al. (2003) 650 → 1050 °C fünf Dekaden. Holz (25 °C) ≈ 1e-14 S/m (Isolator).
// k = Lage auf der log-Skala zwischen 1e-5 S/m (≈ 400 °C) und 30 S/m (800 °C), 0 … 1 – die REM-Aufladung (Ebene 3–4) nutzt k.
export function conductivity(t) {
  const x = clamp(t, T_ROOM, 1000);
  const dec = x >= 600 ? 0.0075 * (x - 600) : -0.025 * (600 - x);
  const sigma = Math.pow(10, Math.max(dec, -14));
  return { sigma, rho: 1 / sigma, k: clamp((dec + 5) / 6.5, 0, 1), decade: dec };
}
// Widerstand zwischen zwei Messspitzen auf dem Stück (Modell): Engewiderstand zweier kreisrunder Kontakte mit Radius a
// (Spitzenabdruck, m) in Reihe, R = ρ/(4a) + ρ/(4a) = ρ/(2a); der Abstand der Spitzen spielt dabei kaum eine Rolle
export const probeResistance = (t, a = 3e-4) => conductivity(t).rho / (2 * a);
// Anzeige wie ein Multimeter: Ω · kΩ · MΩ · GΩ, ab 2 GΩ „OL“ (Überlauf = Isolator)
export function fmtOhm(R) {
  if (!(R < 2e9)) return 'OL';
  const [unit, div] = R >= 1e9 ? ['GΩ', 1e9] : R >= 1e6 ? ['MΩ', 1e6] : R >= 1e3 ? ['kΩ', 1e3] : ['Ω', 1];
  const v = R / div;
  return `${fmt(v, v < 10 ? 1 : 0)} ${unit}`;
}

// Benetzung (Modell): Kontaktwinkel θ von Wasser auf der Oberfläche. Holz benetzt (θ ≈ 60°), geröstetes und niedrig
// verkohltes Holz (300–400 °C) ist wasserabweisend (aliphatische Reste, Teere: θ ≈ 110°), ab ≈ 500 °C wird die Kohle
// benetzbar (θ ≈ 40° ab 550 °C) – Richtung nach Kinney et al. (2012), Winkel sind Richtwerte.
export function wettability(t) {
  const theta = lerp(lerp(60, 110, sstep(200, 320, t)), 40, sstep(400, 550, t));
  return { theta, cos: Math.cos((theta * Math.PI) / 180), hydrophobic: theta > 90 };
}

// Kapillar-Aufstieg nach Lucas–Washburn (Washburn 1921): Eindringtiefe h(t) = √(γ r cos θ · t / 2η) in einer Kapillare mit
// Radius r – Wasser 20 °C: γ = 72,8 mN/m, η = 1,0 mPa·s (Lehrbuchwerte), θ aus wettability(T); θ ≥ 90° → kein Aufstieg.
// rUm in µm, tS in s → h in µm; capillaryTime = Umkehrung (s bis zur Tiefe hUm, ∞ ohne Benetzung)
export const WATER = { gamma: 0.0728, eta: 1.0e-3 };
export function capillaryRise(rUm, tS, T) {
  const c = Math.max(0, wettability(T).cos);
  return 1e6 * Math.sqrt((WATER.gamma * rUm * 1e-6 * c * Math.max(0, tS)) / (2 * WATER.eta));
}
export function capillaryTime(rUm, hUm, T) {
  const c = wettability(T).cos;
  if (c <= 0) return Infinity;
  return ((hUm * 1e-6) ** 2 * 2 * WATER.eta) / (WATER.gamma * rUm * 1e-6 * c);
}

// Schwindung in Prozent der Holzmaße je Richtung (Richtwerte, Modell): tangential > radial > längs (Byrne & Nagle 1997)
export function shrinkPercent(t) {
  const s = pyroState(t);
  return { tan: 100 * s.shrinkTan, rad: 100 * s.shrinkRad, lon: 100 * s.shrinkL };
}
