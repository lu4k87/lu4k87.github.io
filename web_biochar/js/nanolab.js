// Virtuelles Nano-Labor: Knudsen-Diffusion (Ebene 5), Röntgenbeugung und Raman (Ebene 6) aus den Strukturwerten von
// science.js. Gesetze (Knudsen, Bragg, Scherrer, Ferrari–Robertson, Tuinstra–Koenig) mit Quelle in content.js SOURCES;
// Bandbreiten, Untergrund und der Anteil gestapelter Schichten sind Modell.

import { clamp, lerp } from './util.js';
import { nanoStructure } from './science.js';

export const R_GAS = 8.314462618;   // J/(mol·K)
export const T_LAB = 298.15;        // K, Messgase bei 25 °C

// Rennteilnehmer: kinetischer Durchmesser d (nm, Breck 1974, Tab. 8.14) und molare Masse M (g/mol)
export const GASES = [
  { id: 'ch4', name: 'CH₄', d: 0.38, M: 16.04 },
  { id: 'h2o', name: 'H₂O', d: 0.265, M: 18.015 },
  { id: 'n2', name: 'N₂', d: 0.364, M: 28.014 },
  { id: 'co2', name: 'CO₂', d: 0.33, M: 44.01 },
];
// mittlere thermische Geschwindigkeit v̄ = √(8RT/πM) in m/s (kinetische Gastheorie)
export const meanSpeed = (M, T = T_LAB) => Math.sqrt((8 * R_GAS * T) / (Math.PI * (M / 1000)));
// Knudsen-Diffusion D = (d/3)·v̄ in m²/s für eine Pore der Weite d (nm): Stöße mit der Wand statt untereinander, gilt wenn
// die freie Weglänge (Luft, 1 bar, 25 °C: ≈ 68 nm) die Pore weit übertrifft (Knudsen 1909) → leichte Moleküle schneller
export const knudsenD = (dNm, M, T = T_LAB) => ((dNm * 1e-9) / 3) * meanSpeed(M, T);
export const MEAN_FREE_PATH_NM = 68;
// Rennen in einer Pore der Weite d: Geschwindigkeit relativ zum schnellsten Gas, D je Gas; Reihenfolge = Ziel-Einlauf
export function race(dNm = 6) {
  const vmax = Math.max(...GASES.map((g) => meanSpeed(g.M)));
  return GASES.map((g) => ({ ...g, v: meanSpeed(g.M), rel: meanSpeed(g.M) / vmax, D: knudsenD(dNm, g.M), knudsen: MEAN_FREE_PATH_NM / dNm }));
}

// ---------- Röntgenbeugung (Cu Kα) ----------
export const LAMBDA_CU = 0.15406;   // nm
export const D_GRAPHITE = 0.3354;   // d002 von Graphit (nm)
export const D10 = 0.2131;          // Netzebenenabstand (10) der Graphenschicht: a·√3/2 mit a = 0,246 nm
// Bragg: 2θ in Grad für den Netzebenenabstand d (nm)
export const twoTheta = (d) => (2 * Math.asin(LAMBDA_CU / (2 * d)) * 180) / Math.PI;
// Scherrer: Halbwertsbreite β (° 2θ) aus der Kristallitgröße L (nm); K = 0,9 für die Stapelhöhe Lc (Scherrer 1918),
// K = 1,84 für die zweidimensionale (10)-Bande turbostratischer Kohle (Warren 1941)
export const scherrerWidth = (L, twoThetaDeg, K) => ((K * LAMBDA_CU) / (L * Math.cos((twoThetaDeg / 2) * (Math.PI / 180)))) * (180 / Math.PI);
export function xrd(T) {
  const ns = nanoStructure(T);
  const Lc = ns.layers * ns.d002;      // Stapelhöhe (Modell: Schichten je Stapel × Schichtabstand)
  const La = ns.sheetNm;               // Schichtdurchmesser (Wood et al. 2023)
  const p002 = twoTheta(ns.d002), p10 = twoTheta(D10);
  return {
    ns, Lc, La, p002, p10,
    w002: scherrerWidth(Lc, p002, 0.9),
    w10: scherrerWidth(La, p10, 1.84),
    stacked: clamp((ns.layers - 1) / 2, 0.08, 1),   // Anteil der Schichten in Stapeln (Modell): nur Stapel beugen (002)
    graphite: twoTheta(D_GRAPHITE),
  };
}
const gauss = (x, p, w) => Math.exp(-4 * Math.LN2 * ((x - p) / w) ** 2);   // Glocke mit Halbwertsbreite w
// Intensität über 2θ (normiert): (002) und (10) nach Scherrer-Breite, dazu ein zu kleinen Winkeln ansteigender Untergrund
// (Streuung an Mikroporen, Modell)
export function xrdCurve(T, n = 100, from = 10, to = 60) {
  const x = xrd(T), pts = [];
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n;
    pts.push([t, x.stacked * gauss(t, x.p002, x.w002) + 0.45 * gauss(t, x.p10, x.w10) + 0.45 * Math.exp(-(t - from) / 9)]);
  }
  const max = Math.max(...pts.map((p) => p[1]));
  return pts.map(([t, I]) => [t, I / max]);
}

// ---------- Raman (514 nm) ----------
// D ≈ 1350 cm⁻¹ (Atmungsschwingung der Sechsringe, nur an Rändern und Defekten), G ≈ 1580–1600 cm⁻¹ (Streckung der
// sp²-Bindung). I_D/I_G aus der Schichtgröße La: La < 2 nm → C'·La² mit C'(514 nm) = 0,0055 Å⁻² (Ferrari & Robertson 2000);
// La > 2 nm → C/La mit C(514 nm) = 4,4 nm (Tuinstra & Koenig 1970); beide treffen sich bei 2 nm. Lage und Breite der
// Banden gleiten mit der Ordnung (Modell nach dem Verlauf bei Ferrari & Robertson).
export const RAMAN = { D: 1350, C_FR: 0.0055, C_TK: 4.4 };
export function raman(T) {
  const ns = nanoStructure(T), La = ns.sheetNm;
  const ratio = La < 2 ? RAMAN.C_FR * (La * 10) ** 2 : RAMAN.C_TK / La;
  return {
    ns, La, ratio, regime: La < 2 ? 'Ferrari & Robertson' : 'Tuinstra & Koenig',
    D: RAMAN.D, G: lerp(1585, 1600, ns.k), wD: lerp(200, 110, ns.k), wG: lerp(130, 70, ns.k),
  };
}
const lorentz = (x, p, w) => 1 / (1 + ((x - p) / (w / 2)) ** 2);
export function ramanCurve(T, n = 120, from = 1000, to = 1800) {
  const r = raman(T), pts = [];
  for (let i = 0; i <= n; i++) {
    const x = from + ((to - from) * i) / n;
    pts.push([x, r.ratio * lorentz(x, r.D, r.wD) + lorentz(x, r.G, r.wG)]);
  }
  const max = Math.max(...pts.map((p) => p[1]));
  return pts.map(([x, I]) => [x, I / max]);
}
