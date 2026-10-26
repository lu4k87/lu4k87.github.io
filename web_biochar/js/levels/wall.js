// Ebene 4: Innenwand eines Gefäßes (Einheit µm) – Hoftüpfel mit Blick in die Kammer, Mikrofibrillen-Riefen, feine
// Warzen-Körnung, Mikrorisse, Bruchkante, Bakterien in Ketten unter einem Biofilm-Schleier, Pilzhyphe mit Sporen,
// Asche als sechseckige Kristallplättchen (Calciumoxalat bzw. nach dem Verkohlen Calcit in gleicher Form).
// Pyrolyse (pyroState): im Holz schließen Tüpfelmembranen die Hoftüpfel (zerfallen 240–360 °C), die Mikrofibrillen-Riefen
// der S3-Schicht verblassen mit der Zellulose (315–400 °C), die Bruchfläche zeigt erst ab ≈ 300 °C Nanoporen.

import * as THREE from 'three';
import { SEM_GLSL, SEM_DET, SEM_BSE, SEM_CHARGE, SEM_T, ADDITIVE, semMaterial, semDetector, semBlend, semCharge } from '../sem.js';
import { disposeGroup } from '../walls.js';
import { mulberry32, gauss, fbm3, vnoisef } from '../util.js';
import { T_MIN, T_MAX, pyroState } from '../science.js';
import { settings } from '../settings.js';

const R = 16;          // Gefäßradius (Lumen Ø 32 µm)
const TH = 1.6;        // Wanddicke
const S = 15;          // halbe Bogenlänge des Ausschnitts
const Y0 = -17;
// Hoftüpfel-Raster; lo/hi = Feld für die Tüpfel-MITTE: nur ganze Tüpfel, die auch an der gezackten Bruchkante
// (oben ≥ 5,76, unten ≤ −16,2, links ≤ −14,4) noch ganz auf dem Wandstück liegen – kein Tüpfel wird gerade abgeschnitten
const PIT = { sx: 6.0, sy: 5.8, rb: 2.5, lo: [-11.6, -13.5], hi: [9.0, 3.2] };
const HYPHA_PIT = new THREE.Vector2(3.0, -8.7);   // erweiterter Tüpfel (Zelle 0/−2), in den die Hyphe wächst
const BAC = { s: 7.2, y: -3.6 };                   // Mitte der Bakterienkolonie
// Gedämpfte Falschfarben wie bei eingefärbten REM-Bildern: Bakterien grünlich, Pilz ocker, Asche bläulich, Wand bleibt grau
const TINT = { bac: [0.81, 0.95, 0.82], film: [0.85, 0.95, 0.86], hy: [1.0, 0.91, 0.76], sp: [1.01, 0.87, 0.72], cr: [0.89, 0.95, 1.02] };
// Zeitraffer der Hyphe (s nach Ankunft): Seitenast wächst, danach reifen die Sporen, dann löst sich die äußerste
const GROW = { from: 1, dur: 22 }, SPORE = { from: 23, step: 2.2, dur: 2.5 }, ROLL = { from: 34, dur: 12 };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth01 = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
// Temperatur → Rissbreite und Aschemenge (Modell, 550 °C = Ausgangsbild): heißer verkohlt schrumpft die Wand stärker
// Unter 350 °C (Zeitraffer) schließen sich die Risse wieder: die Wand ist noch intakt (Holz), die Asche noch nicht kristallin
const tempK = (T) => {
  if (T >= T_MIN) return (Math.min(T_MAX, T) - 550) / (T_MAX - T_MIN);
  const w = Math.min(1, Math.max(0, (T - 250) / (T_MIN - 250)));
  return -1 + (1 - (550 - T_MIN) / (T_MAX - T_MIN)) * w * w * (3 - 2 * w);
};

const topY = (s) => 6.5 + 4.4 * (fbm3(s * 0.12 + 4, 1.3, 0.7, 3) - 0.5) + 0.9 * (fbm3(s * 0.9, 7.1, 2.2, 2) - 0.5);
// Auch links, rechts und unten ist das Wandstück herausgebrochen: gezackte Kanten statt gerader Schnitte (User, 2026-10-24)
const botY = (s) => Y0 + 4.4 * (fbm3(s * 0.12 + 9, 3.7, 1.9, 3) - 0.5) + 0.9 * (fbm3(s * 0.9, 2.3, 5.1, 2) - 0.5);
const sideS = (y, k) => k * S + 3.2 * (fbm3(y * 0.13 + 6 * k, 5.3, 0.4, 3) - 0.5) + 0.8 * (fbm3(y * 0.9, 4.1 * k, 1.3, 2) - 0.5);
// Raster (u, v) ∈ [0, 1]² → (s, y) im Wandstück; Fläche und Bruchkante nutzen dieselbe Abbildung, damit sie schließen
const wallAt = (u, v) => {
  const yA = Y0 + (6.5 - Y0) * v;
  const s = sideS(yA, -1) + (sideS(yA, 1) - sideS(yA, -1)) * u;
  return [s, botY(s) + (topY(s) - botY(s)) * v];
};
const surf = (s, y, r) => new THREE.Vector3(r * Math.sin(s / R), y, -r * Math.cos(s / R));
const inward = (s) => new THREE.Vector3(-Math.sin(s / R), 0, Math.cos(s / R));
const along = (s) => new THREE.Vector3(Math.cos(s / R), 0, Math.sin(s / R));

// Risslinie in (s, y) – gleiche Formel im Shader
const crack1Y = (s) => -5 + 4.4 * (vnoisef(s * 0.35, 1, 2) - 0.5) + 0.5 * (vnoisef(s * 1.7, 3, 1) - 0.5);

const FRAG_COMMON = /* glsl */ `
uniform vec3 uDet;
uniform vec3 uTint;
uniform float uR;
uniform vec2 uHyPit;
uniform float uCrack;
uniform float uMembrane;   // Tüpfelmembran 1 (Holz) … 0 (Kohle)
uniform float uFibril;     // Mikrofibrillen-Riefen 1 … 0
uniform float uPores;      // Nanoporen der Bruchfläche 0 … 1
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
${SEM_GLSL}
vec2 hash22(vec2 p) { return vec2(hash13(vec3(p, 1.7)), hash13(vec3(p, 9.2))); }
float crack1Y(float s) { return -5.0 + 4.4 * (vnoise(vec3(s * 0.35, 1.0, 2.0)) - 0.5) + 0.5 * (vnoise(vec3(s * 1.7, 3.0, 1.0)) - 0.5); }
float crack2S(float y) { return 11.0 + 3.0 * (vnoise(vec3(y * 0.3, 4.0, 6.0)) - 0.5) + 0.4 * (vnoise(vec3(y * 1.9, 2.0, 8.0)) - 0.5); }
// Risse: 0 außerhalb, sonst Abstand zur Risskante (< 0 = im Riss)
float cracks(vec2 st, out float rim) {
  float w1 = uCrack * (0.16 + 0.14 * vnoise(vec3(st.x * 0.8, 5.0, 0.0))) * smoothstep(-15.5, -11.0, st.x) * smoothstep(3.5, -0.5, st.x);
  float d1 = abs(st.y - crack1Y(st.x)) - w1;
  float w2 = uCrack * (0.12 + 0.12 * vnoise(vec3(st.y * 0.9, 1.0, 7.0))) * smoothstep(-17.0, -12.0, st.y);
  float d2 = abs(st.x - crack2S(st.y)) - w2;
  rim = 0.0;
  if (w1 > 0.02) rim = max(rim, 1.0 - smoothstep(0.0, 0.25, d1));
  if (w2 > 0.02) rim = max(rim, 1.0 - smoothstep(0.0, 0.25, d2));
  return min(w1 > 0.02 ? d1 : 1.0, w2 > 0.02 ? d2 : 1.0);
}
const vec2 PIT_LO = vec2(${PIT.lo[0].toFixed(1)}, ${PIT.lo[1].toFixed(1)}), PIT_HI = vec2(${PIT.hi[0].toFixed(1)}, ${PIT.hi[1].toFixed(1)});
// Hoftüpfel der Gitterzelle von st: Abstand f zur Tüpfelmitte, Zufallswert h (≥ 0,9 = kein Tüpfel)
vec2 pitOf(vec2 st, out float h) {
  vec2 P = vec2(${PIT.sx.toFixed(1)}, ${PIT.sy.toFixed(1)});
  vec2 q = st / P;
  q.x += mod(floor(q.y), 2.0) * 0.5;
  vec2 cell = floor(q);
  vec2 f = (fract(q) - 0.5) * P - (hash22(cell) - 0.5) * 0.5;
  vec2 c = st - f;
  h = any(lessThan(c, PIT_LO)) || any(greaterThan(c, PIT_HI)) ? 1.0 : hash13(vec3(cell, 4.0));
  return f;
}
// vereinzelte einfache Tüpfel außerhalb des Hoftüpfel-Felds: Ellipsen-Maß (< 1 = offen), 9 = keiner
float simplePit(vec2 st) {
  vec2 q = st / 4.0;
  vec2 cell = floor(q);
  vec2 f = (fract(q) - 0.5) * 4.0 - (hash22(cell) - 0.5) * 2.0;
  vec2 c = st - f;
  if (hash13(vec3(cell, 8.0)) >= 0.18 || (all(greaterThan(c, PIT_LO - 3.3)) && all(lessThan(c, PIT_HI + 3.3)))) return 9.0;
  return length(f / vec2(0.45, 0.32));
}
// Löcher mit gleichem Querschnitt durch die ganze Wanddicke (einfache Tüpfel, erweiterter Tüpfel der Hyphe, Risse): < 0 = offen
float through(vec2 st) {
  float rim;
  return min(min(simplePit(st) - 1.0, length(st - uHyPit) - 1.7), cracks(st, rim));
}
`;

const SURF_FRAG = /* glsl */ `
uniform float uSide;
${FRAG_COMMON}
const float TH = ${TH.toFixed(2)};
const float RB = ${PIT.rb.toFixed(2)};
void main() {
  vec2 st = vUv;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float phi = st.x / uR;
  vec3 Ts = vec3(cos(phi), 0.0, sin(phi));
  // Versatz in (s, y) je µm Tiefe, wenn der Blick in die Wand läuft (Parallaxe für Kammer und Lochwände, beide Seiten)
  vec3 Vt = vec3(dot(V, Ts), V.y, dot(V, N));
  vec2 off = -Vt.xy / max(Vt.z, 0.2);
  vec2 grad = vec2(0.0);
  float extra = 0.0;
  float aa = fwidth(st.x) + fwidth(st.y);          // µm je Pixel: feine Muster blenden aus, bevor sie flimmern
  // Hoftüpfel, versetzt angeordnet
  float h;
  vec2 f = pitOf(st, h);
  float r = length(f);
  if (h < 0.9 && r < RB) {
    grad += -1.1 * f / (RB * RB);
    float ang = 0.75 + (h - 0.5) * 0.6;
    mat2 Rm = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2 sl = vec2(0.9, h > 0.62 ? 0.7 : 0.26);
    // eigene Öffnung: innen der Porus, außen der Gegenporus der Nachbarzelle (um 90° gedreht)
    vec2 fo = Rm * f;
    if (uSide < 0.5) fo = vec2(-fo.y, fo.x);
    float slit = length(fo / sl);
    if (slit < 1.0) {
      // Blick durch die Öffnung in die linsenförmige Kammer: Strahl schrittweise in die Wand verfolgen (Parallaxe)
      float g = -1.0;
      for (int i = 1; i <= 8; i++) {
        float d = TH * float(i) / 8.0;
        float rch = RB * 0.92 * sin(3.14159 * (0.12 + 0.76 * d / TH));
        if (length(f + off * d) > rch) { g = mix(0.46, 0.12, d / TH); break; }   // Kammerwand: zur Öffnung heller
      }
      if (g < 0.0) {
        vec2 qb = Rm * (f + off * TH);
        if (uSide > 0.5) qb = vec2(-qb.y, qb.x);   // gegenüberliegende Öffnung: von innen der Gegenporus, von außen der Porus
        if (length(qb / sl) < 1.0) {
          if (uMembrane < 0.02) discard;           // ganz hindurch (Kohle: Membran verschwunden)
          g = 0.1;
        } else g = 0.08;                             // Rückwand der Kammer
      }
      g *= 0.85 + 0.3 * vnoise(vWorld * 6.0);
      // Tüpfelmembran (Holz): feines Fibrillennetz schließt die Kammer, zerfällt beim Verkohlen (Modell)
      if (uMembrane > 0.02) {
        vec2 fm = f + off * TH * 0.5;
        float web = 0.3 + 0.2 * vnoise(vec3(fm * 14.0, 2.0)) + 0.12 * abs(sin(atan(fm.y, fm.x) * 9.0 + 6.0 * vnoise(vec3(fm * 3.0, 5.0))));
        g = mix(g, web, uMembrane);
      }
      gl_FragColor = semOut(g, uTint);
      return;
    }
    extra += 0.5 * (1.0 - smoothstep(0.0, 0.35, slit - 1.0));                     // Rand des Porus
    extra += 0.34 * (1.0 - smoothstep(0.0, 0.5, abs(r - (RB - 0.35))));          // Hofrand (Wulst)
    extra -= 0.14 * (1.0 - smoothstep(0.2, 1.9, r));                              // Kammer fällt zum Porus ab
  }
  // Löcher durch die Wand: nicht nur ausstanzen, sondern die Lochwand durch die Wanddicke zeigen (Parallaxe wie
  // bei der Kammer); erst wenn der Blick ganz hindurch geht, bleibt das Loch offen (User, 2026-10-24)
  if (through(st) < 0.0) {
    float g = -1.0;
    for (int i = 1; i <= 8; i++) {
      float d = TH * float(i) / 8.0;
      if (through(st + off * d) >= 0.0) { g = mix(0.8, 0.3, d / TH); break; }     // Lochwand: hell wie die Bruchkante (Kanteneffekt), zur Tiefe dunkler
    }
    if (g < 0.0) discard;
    gl_FragColor = semOut(g * (0.85 + 0.3 * vnoise(vWorld * 6.0)), uTint);
    return;
  }
  extra += 0.4 * (1.0 - smoothstep(0.0, 0.6, simplePit(st) - 1.0));            // Rand der einfachen Tüpfel
  extra += 0.5 * (1.0 - smoothstep(0.0, 0.4, length(st - uHyPit) - 1.7));      // Rand des erweiterten Tüpfels
  float rim;
  cracks(st, rim);
  extra += 0.55 * rim;
  if (uSide > 0.5) {
    // Mikrofibrillen-Riefen der innersten Wandschicht (S3): flache Spirale ≈ 75° zur Zellachse, Abstand ≈ 0,2 µm
    vec2 nrm = vec2(-0.2588, 0.9659);
    float across = dot(st, nrm) + 0.25 * vnoise(vec3(st * 1.3, 2.0));
    float fadeR = 1.0 - smoothstep(0.03, 0.09, aa);
    float ph = across * 31.416;
    float fib = fadeR * mix(0.3, 1.0, uFibril);   // Riefen verblassen, wenn die Zellulose zerfällt (Wand wird amorph)
    grad += 0.32 * fib * cos(ph) * nrm;
    extra += 0.025 * fib * sin(ph);
    // feine Körnung (Warzen Ø 0,15–0,3 µm), aus der Ferne ausgeblendet
    vec2 wq = st / 0.55;
    vec2 wc = floor(wq);
    vec2 wf = (fract(wq) - 0.2 - 0.6 * hash22(wc + 17.0)) * 0.55;
    float wr = 0.075 + 0.07 * hash13(vec3(wc, 9.0));
    float wd = length(wf);
    float fadeW = 1.0 - smoothstep(0.025, 0.07, aa);
    if (wd < wr && hash13(vec3(wc, 3.0)) < 0.45) {
      grad += -0.7 * fadeW * wf / wr;
      extra += 0.07 * fadeW * smoothstep(wr * 0.4, wr, wd);
    }
  }
  N = normalize(N - uSide * (grad.x * Ts + grad.y * vec3(0.0, 1.0, 0.0)));
  float g = semShade(N, V, uDet, 0.4) + extra * mix(1.0, 0.35, uBSE);   // Rückstreuelektronen: Kanten und Ränder nur schwach
  g *= 0.86 + 0.28 * vnoise(vWorld * 3.2);
  gl_FragColor = semOut(g, uTint);
}
`;

const EDGE_FRAG = /* glsl */ `
${FRAG_COMMON}
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float g = semShade(N, V, uDet, 0.42);
  // Bruchfläche: Schichten der Zellwand (im Holz deutlicher) und Nanoporen als dunkle Körnung (erst in der Kohle)
  g *= 0.85 + mix(0.3, 0.15, uPores) * sin(vUv.y * 6.2832 * 3.0 + vnoise(vWorld * 2.0) * 2.0);
  float pore = smoothstep(0.6, 0.72, vnoise(vWorld * 11.0)) * uPores;
  g = mix(g, 0.08, 0.75 * pore) + 0.25 * smoothstep(0.52, 0.6, vnoise(vWorld * 11.0)) * (1.0 - pore);
  float rim;
  cracks(vec2(vUv.x, vWorld.y), rim);
  if (through(vec2(vUv.x, vWorld.y)) < 0.0) discard;   // Loch an der Bruchkante: Kerbe statt Steg quer durchs Loch
  gl_FragColor = semOut(g + 0.5 * rim * mix(1.0, 0.4, uBSE), uTint);
}
`;

// Biofilm: dünner, leicht faltiger Schleier aus extrazellulären Polymeren über der Kolonie, zum Rand ausfransend
const FILM_FRAG = /* glsl */ `
${FRAG_COMMON}
uniform vec2 uC, uRad;
void main() {
  vec2 d = (vUv - uC) / uRad;
  float e = length(d) + 0.45 * (vnoise(vec3(vUv * 0.8, 4.0)) - 0.5) + 0.12 * (vnoise(vec3(vUv * 3.0, 9.0)) - 0.5);
  float mask = 1.0 - smoothstep(0.62, 0.95, e);
  float holes = smoothstep(0.62, 0.7, vnoise(vec3(vUv * 1.6, 1.0)));       // eingerissene Stellen
  float a = mask * (1.0 - holes) * 0.55;
  if (a < 0.01) discard;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float w = vnoise(vec3(vUv * 2.4, 2.0));
  float g = semShade(N, V, uDet, 0.32) + 0.18 * smoothstep(0.55, 0.75, w) + 0.25 * (1.0 - smoothstep(0.0, 0.08, abs(e - 0.78)));
  gl_FragColor = vec4(pow(uTint * clamp(g, 0.0, 1.5), vec3(2.2)), a);
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const CRACK = { value: 1 };   // Rissbreite relativ zu 550 °C, gemeinsam für alle Wandmaterialien
const MEMBRANE = { value: 0 }, FIBRIL = { value: 0 }, PORES = { value: 1 };   // Holz → Kohle (pyroState), gemeinsam

function uniforms(extra = {}) {
  return {
    uCrack: CRACK,
    uMembrane: MEMBRANE,
    uFibril: FIBRIL,
    uPores: PORES,
    uDet: SEM_DET,
    uBSE: SEM_BSE,
    uZ: { value: 0.9 },
    uCharge: SEM_CHARGE,
    uSemT: SEM_T,
    uTint: { value: new THREE.Color(0.93, 0.95, 0.98) },
    uR: { value: R },
    uHyPit: { value: HYPHA_PIT },
    ...extra,
  };
}

// Fläche auf dem Zylinder (Wand, Schleier): at(u, v) → (s, y) im Raster, Radius je Punkt
function cylPatch(at, NS, NY, radiusAt, side) {
  const pos = [], nrm = [], uv = [], idx = [];
  for (let i = 0; i < NS; i++) {
    for (let j = 0; j < NY; j++) {
      const [s, y] = at(i / (NS - 1), j / (NY - 1));
      const n = inward(s).multiplyScalar(side);
      const p = surf(s, y, radiusAt(s, y));
      pos.push(p.x, p.y, p.z);
      nrm.push(n.x, n.y, n.z);
      uv.push(s, y);
    }
  }
  for (let i = 0; i < NS - 1; i++) {
    for (let j = 0; j < NY - 1; j++) {
      const a = i * NY + j, b = (i + 1) * NY + j;
      if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Bruchfläche rundum (unten → rechts → oben → links), quer durch die Wanddicke; leicht nach außen gewölbt
function fractureRibbon() {
  const NE = 260, NT = 6;
  const loop = [];
  for (let i = 0; i < NE; i++) loop.push(wallAt(i / NE, 0));
  for (let i = 0; i < NE; i++) loop.push(wallAt(1, i / NE));
  for (let i = 0; i < NE; i++) loop.push(wallAt(1 - i / NE, 1));
  for (let i = 0; i <= NE; i++) loop.push(wallAt(0, 1 - i / NE));
  const NS = loop.length;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < NS; i++) {
    const [s, y] = loop[i];
    const [sa, ya] = loop[Math.max(0, i - 1)], [sb, yb] = loop[Math.min(NS - 1, i + 1)];
    const len = Math.hypot(sb - sa, yb - ya) || 1;
    const os = (yb - ya) / len, oy = -(sb - sa) / len;   // Außennormale der Kante in (s, y)
    for (let j = 0; j < NT; j++) {
      const t = j / (NT - 1);
      const w = 0.25 * Math.sin(t * Math.PI) * (fbm3(s * 2 + y * 2, t, 1, 2) - 0.3);
      const p = surf(s + os * w, y + oy * w, R + TH * t);
      pos.push(p.x, p.y, p.z);
      uv.push(s, t);
    }
  }
  for (let i = 0; i < NS - 1; i++) {
    for (let j = 0; j < NT - 1; j++) {
      const a = i * NT + j, b = (i + 1) * NT + j;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Dreiecke so drehen, dass die Normalen nach außen zeigen (Mitte oben: +y)
  const n = g.attributes.normal;
  const out = n.getY(Math.floor((2.5 * NE) * NT));
  if (out < 0) { idx.reverse(); g.setIndex(idx); g.computeVertexNormals(); }
  return g;
}

// Röhrenradius entlang der Kurve modulieren (Septen, leichte Wellen)
function modulateTube(geo, curve, segs, radial, f) {
  const pos = geo.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const k = f(i);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

export function create(ctx) {
  const rand = mulberry32(9001);
  const scene = new THREE.Scene();
  const anim = [];   // Bewegungen je Bild: f(age) mit age = Sekunden seit Ankunft auf der Ebene
  const tint = (mat, c) => mat.uniforms.uTint.value.setRGB(c[0], c[1], c[2]);

  const inner = new THREE.Mesh(cylPatch(wallAt, 220, 160, () => R, 1), new THREE.ShaderMaterial({
    uniforms: uniforms({ uSide: { value: 1 } }), vertexShader: VERT, fragmentShader: SURF_FRAG,
  }));
  const outer = new THREE.Mesh(cylPatch(wallAt, 200, 150, () => R + TH, -1), new THREE.ShaderMaterial({
    uniforms: uniforms({ uSide: { value: 0 } }), vertexShader: VERT, fragmentShader: SURF_FRAG,
  }));
  const edge = new THREE.Mesh(fractureRibbon(), new THREE.ShaderMaterial({
    uniforms: uniforms(), vertexShader: VERT, fragmentShader: EDGE_FRAG,
  }));
  scene.add(inner, outer, edge);

  const onWall = (s, y, lift) => surf(s, y, R).add(inward(s).multiplyScalar(lift));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), sc = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  // Bakterien: Stäbchen ≈ 0,7 µm dick, 1,5–2,5 µm lang – Ketten (Streptobazillen), Einzelzellen und Teilungspaare
  const bacteria = [];
  for (let c = 0; c < 8; c++) {
    let s = gauss(rand, BAC.s, 1.8), y = gauss(rand, BAC.y, 1.5);
    let ang = rand() * Math.PI;
    const n = 3 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      const len = 0.75 + rand() * 0.45;
      const half = (1 + 0.72) * len / 2;
      bacteria.push({ s, y, ang, len, ph: rand() * 6.28 });
      ang += (rand() - 0.5) * 0.5;                    // Kette biegt sich leicht
      s += Math.cos(ang) * (half * 2 + 0.08);
      y += Math.sin(ang) * (half * 2 + 0.08);
    }
  }
  for (let k = 0; k < 14; k++) {
    const s = gauss(rand, BAC.s, 2.2), y = gauss(rand, BAC.y, 1.9), ang = rand() * Math.PI;
    bacteria.push({ s, y, ang, len: 0.7 + rand() * 0.6, ph: rand() * 6.28 });
    if (k % 4 === 0) bacteria.push({ s: s + Math.cos(ang) * 1.9, y: y + Math.sin(ang) * 1.9, ang, len: 0.6, ph: rand() * 6.28 });
  }
  const live = bacteria.filter((b) => Math.hypot(b.s - HYPHA_PIT.x, b.y - HYPHA_PIT.y) > 3 && b.s < sideS(b.y, 1) - 1 && b.y < topY(b.s) - 1);
  const bacMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.36, 1, 4, 12), semMaterial({ base: 0.5, noise: 4, z: 0.8, charge: true }), live.length);
  // Schleimfäden: von einigen Zellen zur Wand
  const strands = live.filter((_, k) => k % 3 === 0).map((b) => ({ b, ds: (rand() - 0.5) * 2.4, dy: (rand() - 0.5) * 2.4 }));
  const strandMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5, 1, true), semMaterial({ base: 0.55, noise: 3, z: 0.8, charge: true }), strands.length);
  const centers = [];
  const placeBacteria = (t) => {
    live.forEach((b, k) => {
      const a = b.ang + 0.05 * Math.sin(t * 0.7 + b.ph);
      const dir = along(b.s).multiplyScalar(Math.cos(a)).addScaledVector(yAxis, Math.sin(a)).normalize();
      q.setFromUnitVectors(yAxis, dir);
      sc.set(1, b.len, 1);
      centers[k] = onWall(b.s, b.y, 0.33);
      bacMesh.setMatrixAt(k, m.compose(centers[k], q, sc));
    });
    bacMesh.instanceMatrix.needsUpdate = true;
    strands.forEach((st, k) => {
      const from = centers[live.indexOf(st.b)];
      const to = onWall(st.b.s + st.ds, st.b.y + st.dy, 0.02);
      const d = to.clone().sub(from);
      const len = d.length();
      q2.setFromUnitVectors(yAxis, d.divideScalar(len));
      strandMesh.setMatrixAt(k, m.compose(from.clone().lerp(to, 0.5), q2, sc.set(0.045, len, 0.045)));
    });
    strandMesh.instanceMatrix.needsUpdate = true;
  };
  placeBacteria(0);
  scene.add(bacMesh, strandMesh);
  tint(bacMesh.material, TINT.bac);
  tint(strandMesh.material, TINT.bac);
  const film = new THREE.Mesh(
    cylPatch((u, v) => [BAC.s - 5.5 + 11 * u, BAC.y - 5 + 10 * v], 70, 64, (s, y) => R - (0.78 + 0.3 * fbm3(s * 0.6, y * 0.6, 3.3, 2)), 1),
    new THREE.ShaderMaterial({
      uniforms: uniforms({ uC: { value: new THREE.Vector2(BAC.s, BAC.y) }, uRad: { value: new THREE.Vector2(5.2, 4.6) } }),
      vertexShader: VERT, fragmentShader: FILM_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
  film.renderOrder = 2;
  scene.add(film);
  tint(film.material, TINT.film);

  // Pilzhyphe: Ø 1,8 µm, wächst über die Wand und in den erweiterten Tüpfel; ein Seitenast trägt eine Sporenkette
  const hyMat = semMaterial({ base: 0.42, noise: 2.5, z: 0.8, charge: true });
  tint(hyMat, TINT.hy);
  const path = [[-17, 1.5], [-12, -0.8], [-7, -2.2], [-2.5, -4.6], [1.2, -7.4]].map(([s, y]) => onWall(s, y, 0.92));
  path.push(onWall(HYPHA_PIT.x, HYPHA_PIT.y, 0.2), onWall(HYPHA_PIT.x + 0.3, HYPHA_PIT.y - 0.2, -2.6));
  const hyCurve = new THREE.CatmullRomCurve3(path);
  // erster und letzter Ring schließen die Röhre: kein offenes Ende, wo die Hyphe außen aus dem Tüpfel ragt (User, 2026-10-24)
  const septum = (i) => (1 + 0.05 * Math.sin(i * 0.9) - 0.16 * Math.exp(-Math.pow(((i % 34) - 17) / 2.2, 2))) * Math.min(1, i, 160 - i);
  scene.add(new THREE.Mesh(modulateTube(new THREE.TubeGeometry(hyCurve, 160, 0.9, 14), hyCurve, 160, 14, septum), hyMat));
  // Seitenäste: dünne, leicht wellige Fäden (Ø ≈ 1 µm) mit Septen, kein Kugelkopf und kein Ausfahren im Zeitraffer:
  // der Ast ist von Anfang an komplett, nur die Sporen reifen (User, 2026-10-23); das Ende ist stumpf, nur der letzte
  // Ring schließt die Röhre – keine Kuppe, keine Spitze (User, 2026-10-24)
  const BR = 0.5, NBR = 0.45;
  const septaThin = (i) => (1 + 0.06 * Math.sin(i * 1.3) - 0.18 * Math.exp(-Math.pow((((i + 13) % 20) - 10) / 2, 2))) * Math.min(1, 60 - i);
  const branch = new THREE.CatmullRomCurve3([[-7, -2.2], [-6.5, -0.4], [-5.4, 1.3], [-4.2, 2.8], [-2.6, 4.6]].map(([s, y]) => onWall(s, y, 0.85)));
  const brGeo = modulateTube(new THREE.TubeGeometry(branch, 60, BR, 12), branch, 60, 12, septaThin);
  scene.add(new THREE.Mesh(brGeo, hyMat));
  // Sporen (Konidien, ≈ 2–3 µm): Kette am Astende, einzelne lose auf der Wand
  const spores = [];
  const tipDir = branch.getTangent(1).normalize();
  for (let k = 0; k < 4; k++) {
    const p = branch.getPoint(1).addScaledVector(tipDir, 1.7 + k * 2.15);
    spores.push({ p, dir: tipDir, s: [0.95 - k * 0.05, 1.25, 0.95 - k * 0.05] });
  }
  for (const [s, y] of [[-10.5, 2.5], [-4.2, -9.5], [0.8, 1.6], [-13, -5.5]]) {
    const dir = along(s).applyAxisAngle(inward(s), rand() * 3);
    spores.push({ p: onWall(s, y, 0.95), dir, s: [1.0, 1.35, 0.95] });
  }
  const spMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 22, 16), semMaterial({ base: 0.46, noise: 7, z: 0.8, charge: true }), spores.length);
  tint(spMesh.material, TINT.sp);
  const setSpore = (k, p, f) => spMesh.setMatrixAt(k, m.compose(p, q.setFromUnitVectors(yAxis, spores[k].dir), sc.fromArray(spores[k].s).multiplyScalar(Math.max(f, 1e-4))));
  spores.forEach((sp, k) => setSpore(k, sp.p, 1));
  spMesh.instanceMatrix.needsUpdate = true;
  scene.add(spMesh);

  // Zeitraffer: der Seitenast wächst aus dem Hauptfaden, an seiner Spitze reifen die Sporen; danach wiegt sich die Kette,
  // die äußerste Spore löst sich und rollt auf die Wand (einmal je Besuch)
  const chain = spores.slice(0, 4).map((sp) => sp.p.clone());
  const chainBase = branch.getPoint(1), chainAxis = inward(-2.6);
  const c3 = chain[3], land = onWall(R * Math.atan2(c3.x, -c3.z) + 0.6, c3.y - 3.5, 0.95);
  const isStill = () => reduced || settings.S.motion === 'off';
  const _p = new THREE.Vector3();
  anim.push((age) => {
    const sway = isStill() ? 0 : 0.08 * Math.sin(age * 0.5) * smooth01((age - ROLL.from + 2) / 2);
    for (let i = 0; i < 4; i++) {
      const f = smooth01((age - SPORE.from - i * SPORE.step) / SPORE.dur);
      _p.copy(chain[i]).sub(chainBase).applyAxisAngle(chainAxis, (sway * Math.min(i + 1, 3)) / 3).add(chainBase);
      if (i === 3) {
        const u = smooth01((age - ROLL.from) / ROLL.dur);
        _p.lerp(land, u).addScaledVector(chainAxis, 1.6 * Math.sin(Math.PI * u));
      }
      setSpore(i, _p, f);
    }
    spMesh.instanceMatrix.needsUpdate = true;
  });

  // Klick auf „Pilzhyphe“: ein weiterer Seitenast zum nächsten Tüpfel erscheint als Ganzes (kurzes Aufblenden aus seiner
  // Mitte, kein Ausfahren); erneuter Klick spielt es neu ab
  const nb = new THREE.CatmullRomCurve3([[-12, -0.8], [-12.8, -2.4], [-12.3, -4.2], [-12.9, -6.2], [-11.6, -7.6], [-10.4, -8.6]].map(([bs, by]) => onWall(bs, by, 0.85)));
  const nbGeo = modulateTube(new THREE.TubeGeometry(nb, 60, NBR, 12), nb, 60, 12, septaThin);
  const nbMesh = new THREE.Mesh(nbGeo, hyMat);
  nbGeo.computeBoundingBox();
  nbGeo.boundingBox.getCenter(nbMesh.position);
  nbGeo.translate(-nbMesh.position.x, -nbMesh.position.y, -nbMesh.position.z);   // Skalierung um die eigene Mitte
  nbMesh.visible = false;
  scene.add(nbMesh);
  let sprout = null;   // Alter beim Klick
  anim.push((age) => {
    if (sprout === null) return;
    const f = isStill() ? 1 : smooth01((age - sprout) / 0.5);
    nbMesh.visible = f > 0.01;
    nbMesh.scale.setScalar(0.6 + 0.4 * f);
  });

  // Asche: sechseckige Plättchen flach auf der Wand, dazu eine Druse (strahlig verwachsene Prismen)
  const crystals = [];
  for (let k = 0; k < 22; k++) {
    const s = -14 + rand() * 27, y = -16 + rand() * 18, size = 0.3 + rand() * 0.7;
    if (Math.hypot(s - BAC.s, y - BAC.y) < 4) continue;
    const n = inward(s);
    const tilt = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.5);
    q.setFromUnitVectors(yAxis, n.clone().add(tilt).normalize());
    q.multiply(q2.setFromAxisAngle(yAxis, rand() * Math.PI));
    crystals.push({ a: onWall(s, y, 0), o: inward(s).multiplyScalar(size * 0.14), q: q.clone(), s: [size, size * 0.26, size * (0.75 + 0.35 * rand())] });
  }
  const NEEDLE = { s: -9.5, y: -12.2 };
  const dc = onWall(NEEDLE.s, NEEDLE.y, 0.55);
  for (let k = 0; k < 11; k++) {
    const a = k * 2.39996, el = 0.25 + 0.6 * (k / 11);
    const dir = inward(NEEDLE.s).multiplyScalar(Math.sin(el + 0.6))
      .addScaledVector(along(NEEDLE.s), Math.cos(a) * Math.cos(el)).addScaledVector(yAxis, Math.sin(a) * Math.cos(el)).normalize();
    const len = 1.1 + rand() * 0.6;
    crystals.push({ a: dc, o: dir.clone().multiplyScalar(len * 0.45), q: new THREE.Quaternion().setFromUnitVectors(yAxis, dir), s: [0.32, len, 0.32] });
  }
  // Asche (Ca, K, Mg): hohe mittlere Ordnungszahl → im Rückstreubild hell (z = 2,2, Goldstein et al. 2018)
  const crMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), semMaterial({ base: 0.5, noise: 5, edge: 0.4, z: 2.2, charge: true }), crystals.length);
  tint(crMesh.material, TINT.cr);
  const placeCrystals = (f) => {
    crystals.forEach((c, k) => crMesh.setMatrixAt(k, m.compose(_p.copy(c.a).addScaledVector(c.o, f), c.q, sc.fromArray(c.s).multiplyScalar(f))));
    crMesh.instanceMatrix.needsUpdate = true;
  };
  scene.add(crMesh);
  // Klick auf „Asche-Partikel“ (EDX-Spektrum in der Info-Karte): die Kristalle leuchten kurz auf – der Strahl verweilt
  // auf dem Partikel – und klingen in ≈ 1 s ab
  let edxAt = null;
  anim.push((age) => {
    if (edxAt === null) return;
    crMesh.material.uniforms.uBase.value = 0.5 + 0.55 * Math.exp(-(age - edxAt) / 0.45);
  });

  // Sinnbild (nicht maßstäblich): Wasserteilchen treiben aus dem Lumen zu den Tüpfeln und verschwinden darin
  const pits = [];
  for (let cy = -3; cy <= 0; cy++) for (let cx = -2; cx <= 1; cx++) {
    const ps = (cx + 0.5 - (Math.abs(cy) % 2) * 0.5) * PIT.sx, py = (cy + 0.5) * PIT.sy;
    if (ps > -10 && ps < 7 && py > -14 && py < 2 && Math.hypot(ps - BAC.s, py - BAC.y) > 4) pits.push([ps, py]);
  }
  const NP = 140, ppos = new Float32Array(NP * 3), palpha = new Float32Array(NP);
  const parts = Array.from({ length: NP }, () => {
    const [ps, py] = pits[Math.floor(rand() * pits.length)];
    return { ps, py, os: (rand() - 0.5) * 7, oy: (rand() - 0.5) * 6, lift: 2 + rand() * 5, ph: rand(), sp: 0.7 + rand() * 0.6, j: rand() * 6.28 };
  });
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  pGeo.setAttribute('aA', new THREE.BufferAttribute(palpha, 1));
  const uViewH = { value: 900 };
  const pts = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    ...ADDITIVE, uniforms: { uCol: { value: new THREE.Color(0.55, 0.85, 1.0) }, uViewH },
    // Punktgröße 0,25 µm in Pixeln der tatsächlichen Renderhöhe
    vertexShader: 'uniform float uViewH; attribute float aA; varying float vA; void main() { vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 0.25 * projectionMatrix[1][1] * 0.5 * uViewH / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; varying float vA; void main() { float d = length(gl_PointCoord - 0.5); float a = vA * (1.0 - smoothstep(0.25, 0.5, d)); if (a < 0.01) discard; gl_FragColor = vec4(uCol, a); }',
  }));
  pts.frustumCulled = false;
  pts.visible = !isStill();
  pts.onBeforeRender = (renderer) => { const rt = renderer.getRenderTarget(); uViewH.value = rt ? rt.height : renderer.domElement.height; };
  scene.add(pts);
  anim.push((age) => {
    pts.visible = !isStill();
    if (!pts.visible) return;
    parts.forEach((p, k) => {
      const u = (age * 0.07 * p.sp + p.ph) % 1, e = smooth01(u / 0.9);
      const w = 0.35 * (1 - e);
      const v = onWall(p.ps + p.os * (1 - e) + w * Math.sin(age * 1.3 + p.j), p.py + p.oy * (1 - e) + w * Math.sin(age * 1.1 + 2 * p.j),
        p.lift * (1 - e) - 0.6 * smooth01((u - 0.85) / 0.15));
      ppos[k * 3] = v.x; ppos[k * 3 + 1] = v.y; ppos[k * 3 + 2] = v.z;
      palpha[k] = 0.85 * smooth01(u / 0.12) * (1 - smooth01((u - 0.88) / 0.12));
    });
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.aA.needsUpdate = true;
  });

  // Temperatur gleitet in ≈ 0,35 s nach: Risse und Asche (tempK), Tüpfelmembran, Fibrillen-Riefen, Nanoporen (pyroState)
  const heat = { T: ctx.temp, to: ctx.temp };
  const crackS = -9;
  const crackHs = { id: 'crack', kind: 'info', pos: onWall(crackS, crack1Y(crackS), 0.2), normal: inward(crackS) };
  const applyHeat = () => {
    const k = tempK(heat.T), st = pyroState(heat.T);
    CRACK.value = 1 + k;
    placeCrystals(1 + 0.5 * k);
    MEMBRANE.value = st.membrane;
    FIBRIL.value = st.fibril;
    PORES.value = st.sheets;
    semCharge(heat.T);   // Aufladung: unter ≈ 700 °C leitet die Kohle schlecht (Streifen), darüber sauber
    crackHs.hidden = CRACK.value < 0.3;   // Abzeichen erst, wenn der Riss zu sehen ist (unter ≈ 300 °C geschlossen)
  };
  applyHeat();

  // Hotspot-Stellen: Tüpfel (Gitterzelle −1/−1), Riss, Bruchkante
  const pitCell = [-1, -1];
  const pitS = (pitCell[0] + 0.5 - (Math.abs(pitCell[1]) % 2) * 0.5) * PIT.sx;
  const pitY = (pitCell[1] + 0.5) * PIT.sy;
  const waterS = 0, waterY = -0.5 * PIT.sy;   // Tüpfel der Gitterzelle 0/−1 in der Bildmitte, Wasserteilchen darüber
  const edgeS = -2.5;
  const edgePos = surf(edgeS, topY(edgeS) + 0.15, R + TH / 2);
  const camera = new THREE.PerspectiveCamera(40, ctx.aspect, 0.1, 400);
  let age = 0, lastT = -1;
  // Bewohner in Gruppen für die Schalter im Zahnrad (Szene liegt im Ursprung: Umhängen ändert keine Lage)
  const bacGroup = new THREE.Group(), hyGroup = new THREE.Group();
  for (const o of [bacMesh, strandMesh, film]) bacGroup.add(o);
  for (const o of scene.children.filter((x) => x.material === hyMat || x === spMesh)) hyGroup.add(o);
  scene.add(bacGroup, hyGroup);
  const show = (obj, ids, v) => {
    obj.visible = v;
    for (const h of level.hotspots) if (ids.includes(h.id)) h.hidden = !v;
    level.dirty = true;
  };
  const level = {
    scene, camera,
    unit: 1e-6,
    method: 'REM · Sekundärelektronen (Modell, eingefärbt)',
    detector: true,   // Umschalter SE/BSE an der Messleiste
    tone: 0,
    grain: 0.07,
    dof: 2.2,
    bloom: 0.06,
    home: { pos: new THREE.Vector3(3, 12, 6), target: surf(0, -3, R) },
    orbit: { minDistance: 5, maxDistance: 38, minAzimuthAngle: -0.9, maxAzimuthAngle: 1.1, minPolarAngle: 0.35, maxPolarAngle: 1.75, enablePan: false },
    hotspots: [
      { id: 'fracture', kind: 'dive', pos: edgePos, normal: new THREE.Vector3(0, 1, 0) },
      { id: 'pits', kind: 'info', pos: onWall(pitS, pitY, 0.4), normal: inward(pitS) },
      { id: 'water', kind: 'info', pos: onWall(waterS, waterY, 2.5), normal: inward(waterS) },
      { id: 'bacteria', kind: 'info', pos: onWall(BAC.s, BAC.y, 1.3), normal: inward(BAC.s) },
      { id: 'hypha', kind: 'info', pos: hyCurve.getPoint(0.3).add(inward(-9).multiplyScalar(0.9)), normal: inward(-9) },
      { id: 'spores', kind: 'info', pos: onWall(-10.5, 2.5, 2.1), normal: inward(-10.5) },   // lose Spore auf der Wand
      { id: 'ash', kind: 'info', pos: onWall(NEEDLE.s, NEEDLE.y, 1.6), normal: inward(NEEDLE.s) },
      crackHs,
    ],
    // Zahnrad-Reiter „Ebene“ (layers.js): Bewohner und Asche einzeln ein-/ausblenden, Abzeichen folgen
    layers: [
      { id: 'bacteria', group: 'Leben auf der Wand', label: 'Bakterien und Biofilm', type: 'toggle', value: true, set: (v) => show(bacGroup, ['bacteria'], v),
        hint: 'Stäbchen ≈ 0,7 µm dick, in Ketten unter einem Schleier aus Zuckern und Eiweißen – Poren der Kohle sind Rückzugsorte im Boden.' },
      { id: 'hypha', label: 'Pilzhyphe mit Sporen', type: 'toggle', value: true, set: (v) => show(hyGroup, ['hypha', 'spores'], v),
        hint: 'Ø ≈ 1,8 µm, wächst durch erweiterte Tüpfel in die Gefäße; im Zeitraffer reifen die Sporen.' },
      { id: 'ash', group: 'Mineralien', label: 'Asche-Kristalle', type: 'toggle', value: true, set: (v) => show(crMesh, ['ash'], v),
        hint: 'Calciumoxalat im Holz, nach dem Verkohlen Calcit in gleicher Form; im Rückstreubild hell (hohe Ordnungszahl).' },
    ],
    update(dt, t) {
      const calm = isStill();
      // Uhr ab Ankunft: nach einer Pause (Ebene war nicht aktiv) beginnt der Zeitraffer neu
      age = t - lastT > 0.5 ? 0 : age + t - lastT;
      lastT = t;
      if (heat.T !== heat.to) {
        heat.T = calm || Math.abs(heat.to - heat.T) < 0.05 ? heat.to : heat.T + (heat.to - heat.T) * (1 - Math.exp(-dt / 0.35));
        applyHeat();
      }
      const at = calm ? 1e3 : age;   // ohne Bewegung: Endzustand
      if (!calm) placeBacteria(t);
      semDetector(calm ? 0 : t * 1.5, 1.9);
      semBlend(dt, calm);
      anim.forEach((f) => f(at));
      return true;
    },
    setParam(name, value) {
      if (name === 'temp') heat.to = value;
      if (name === 'detector') level.method = `REM · ${value === 'bse' ? 'Rückstreuelektronen' : 'Sekundärelektronen'} (Modell, eingefärbt)`;
    },
    onHotspot(id) {
      if (id === 'hypha') sprout = age;
      if (id === 'ash') edxAt = age;
    },
    dispose() { disposeGroup(scene); },
  };
  return level;
}
