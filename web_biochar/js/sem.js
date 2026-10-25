// REM-Look (Sekundärelektronen): Flächen schräg zum Strahl und Kanten leuchten, tiefe Hohlräume bleiben dunkel.
// Ausgabe linear (Gamma 2,2), die Zusammenführung in main.js wandelt nach sRGB.

import * as THREE from 'three';
import * as sci from './science.js';
import { clamp, smoothstep } from './util.js';

export const NOISE_GLSL = /* glsl */ `
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x),
                 mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x),
                 mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
`;

export const SEM_GLSL = NOISE_GLSL + /* glsl */ `
uniform float uBSE, uZ, uCharge, uSemT;
float semShade(vec3 N, vec3 V, vec3 det, float base) {
  float c = clamp(abs(dot(N, V)), 0.0, 1.0);
  float se = base * (1.0 + 0.62 * (1.0 / max(c, 0.22) - 1.0)) + 0.13 * dot(N, det);
  // Rückstreuelektronen (uBSE = 1): Ausbeute steigt mit der mittleren Ordnungszahl (uZ je Material: Kohlenstoff dunkel,
  // Asche aus Ca/K/Mg hell), kaum Kanteneffekt, Topografie nur schwach über die Lage zum Detektor (Modell nach Goldstein
  // et al. 2018)
  float bse = base * uZ * (0.8 + 0.25 * max(dot(N, det), 0.0) + 0.15 * (1.0 - c));
  return mix(se, bse, uBSE);
}
// Aufladung schlecht leitender Proben (Goldstein et al. 2018): je 4 Bildzeilen zufällig ein heller Streifen begrenzter
// Länge in Zeilenrichtung, alle ≈ 0,7 s neu gewürfelt, dazu große hellere Flecken; Stärke uCharge aus der Leitfähigkeit
// der Kohle (semCharge), Rückstreuelektronen sind weniger empfindlich (Modell)
float semCharging() {
  if (uCharge < 0.001) return 0.0;
  float row = floor(gl_FragCoord.y / 4.0), seed = floor(uSemT * 1.4);
  float on = smoothstep(1.0 - 0.07 * uCharge, 1.0, hash13(vec3(row, seed, 3.0)));
  float x0 = hash13(vec3(row, seed, 7.0)) * 1600.0, len = 150.0 + 900.0 * hash13(vec3(row, seed, 9.0));
  float along = smoothstep(x0 - 3.0, x0 + 12.0, gl_FragCoord.x) * (1.0 - smoothstep(x0 + 0.5 * len, x0 + len, gl_FragCoord.x));
  float blotch = smoothstep(0.58, 0.85, vnoise(vec3(gl_FragCoord.xy * 0.0035, seed * 0.37)));
  return uCharge * (1.0 - 0.5 * uBSE) * (1.4 * on * along * (0.5 + 0.5 * hash13(vec3(row, seed, 5.0))) + 0.3 * blotch);
}
vec4 semOut(float g, vec3 tint) {
  g += semCharging();
  return vec4(pow(tint * clamp(g, 0.0, 1.5), vec3(2.2)), 1.0);
}
`;

// Additives Licht ohne Alpha: Glühen/Wolken heben das Bild an, decken den Hintergrund der Zusammenführung aber nicht ab
export const ADDITIVE = {
  transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
};

// Ein Detektor für alle REM-Materialien; er schwenkt langsam (Lichtführung), die Ebenen rufen semDetector(t) auf
const DET0 = new THREE.Vector3(-0.45, 0.75, 0.5).normalize();
export const SEM_DET = { value: DET0.clone() };
// Schwenk an/aus (Zahnrad „REM-Detektor schwenkt“, main.js): 0 = Detektor steht in der Grundlage DET0
export const SEM_SWING = { k: 1 };
// Detektor (Umschalter an der Messleiste, Ebenen 3–4): 0 = Sekundärelektronen (Topografie, Kanteneffekt),
// 1 = Rückstreuelektronen (Ordnungszahl-Kontrast); gleitet in ≈ 0,3 s (semBlend), gemeinsam für alle REM-Materialien
export const SEM_BSE = { value: 0, to: 0 };
export const SEM_T = { value: 0 };
export const semDetectorMode = (mode) => { SEM_BSE.to = mode === 'bse' ? 1 : 0; };
export function semBlend(dt, instant = false) {
  const d = SEM_BSE.to - SEM_BSE.value;
  if (d === 0) return;
  SEM_BSE.value = instant || Math.abs(d) < 0.01 ? SEM_BSE.to : SEM_BSE.value + d * (1 - Math.exp(-dt / 0.25));
}
// Aufladung: Stärke 0–1 aus der Leitfähigkeit über der Pyrolysetemperatur (science.js conductivity, Gabhi et al. 2020:
// k = Lage auf der log-Skala: 400 °C 0 · 500 °C 0,38 · 550 °C 0,57 · 600 °C 0,77 · 700 °C 0,88 · 800 °C 1) – volle Streifen
// bis ≈ 500 °C, bei 550 °C noch gut die Hälfte, ab ≈ 700 °C sauber; Schalter „REM-Aufladung“ im Zahnrad (main.js → semChargeOn). Fallback bis conductivity() da ist: linear 400–800 °C.
export const SEM_CHARGE = { value: 0 };
const charge = { on: 1, T: 550 };
const chargeOf = (T) => {
  const k = sci.conductivity ? sci.conductivity(T).k : clamp((T - 400) / 400, 0, 1);
  return 1 - smoothstep(0.35, 0.88, k);
};
export function semCharge(T) { charge.T = T; SEM_CHARGE.value = charge.on * chargeOf(T); }
export function semChargeOn(on) { charge.on = on ? 1 : 0; semCharge(charge.T); }
const _yAxis = new THREE.Vector3(0, 1, 0), _xAxis = new THREE.Vector3(1, 0, 0);
export function semDetector(t, k = 1) {
  SEM_T.value = t;
  k *= SEM_SWING.k;
  SEM_DET.value.copy(DET0).applyAxisAngle(_yAxis, 0.42 * k * Math.sin(t * 0.071)).applyAxisAngle(_xAxis, 0.14 * k * Math.sin(t * 0.113 + 1.0));
}

const VERT = /* glsl */ `
#ifdef SEM_WALLS
attribute vec4 aWall;
varying vec4 vWall;
#endif
#ifdef SEM_TOP
attribute float aTop;      // eigene Oberkante (lokal): Tiefenabdunklung ab der eigenen Bruchkante statt ab der Weltebene
varying float vTopW;
#endif
#ifdef SEM_BOT
attribute vec2 aBot;       // Tiefe (lokal), unterhalb der die Zelle auf der +y- bzw. −y-Seite seitlich/hinten offen ist
varying vec2 vBotW;
#endif
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec3 vScale;
void main() {
#ifdef USE_INSTANCING
  vec3 s = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 n = mat3(instanceMatrix) * (normal / (s * s));
  vScale = s;
#else
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 n = normal;
  vScale = vec3(1.0);
#endif
#ifdef SEM_WALLS
  vWall = aWall;
#endif
#ifdef SEM_TOP
  vTopW = (modelMatrix * vec4(0.0, 0.0, aTop, 1.0)).z;
#endif
#ifdef SEM_BOT
  vBotW = vec2((modelMatrix * vec4(0.0, 0.0, aBot.x, 1.0)).z, (modelMatrix * vec4(0.0, 0.0, aBot.y, 1.0)).z);
#endif
  vNormal = normalize(mat3(modelMatrix) * n);
  vLocal = position;
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uDet;
uniform vec3 uTint;
uniform float uBase, uEdge, uEdgeW, uDepth, uUseDepth, uOpenZ, uOpenX, uNoise, uShade, uTopMix;
#ifdef SEM_WALLS
varying vec4 vWall;
#endif
#ifdef SEM_TOP
varying float vTopW;
#endif
#ifdef SEM_BOT
varying vec2 vBotW;
#endif
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec3 vScale;
${SEM_GLSL}
// Gegen Flackern bei der Kamerafahrt: feine Säume, Fugen und Tüpfel nie schmaler als ≈ 2 Bildpunkte zeichnen, sondern
// breiter und im selben Maß schwächer (gleiche Lichtmenge) – sonst springen sie von Pixel zu Pixel an und aus.
// px = Bildpunkt auf der Fläche; Saum voll bis a, weich auslaufend bis b (Abstand d)
float aaBand(float d, float a, float b, float px) {
  float k = max(1.0, 2.0 * px / b);
  return (1.0 - smoothstep(a * k, b * k, d)) / k;
}
// schmaler Ring um c, innen w0 und außen w1 breit
float aaRing(float x, float c, float w0, float w1, float px) {
  float k = max(1.0, 2.0 * px / min(w0, w1));
  return smoothstep(c - w0 * k, c, x) * smoothstep(c + w1 * k, c, x) / k;
}
void main() {
  float px = 0.71 * length(fwidth(vWorld));   // vor jedem discard/if: Ableitungen nur im gleichförmigen Ablauf
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float g = semShade(N, V, uDet, uBase);
#ifdef SEM_WALLS
  vec3 a = abs(vLocal);
  vec3 de = (0.5 - a) * vScale;
  float ed;
  if (a.x >= a.y && a.x >= a.z) {
    ed = min(de.y, de.z);            // Stirnende einer gebrochenen Wand
  } else if (a.y >= a.z) {
    ed = de.z;                       // Breitseite: Oberkante leuchtet
#ifdef SEM_PITS
    float u = vLocal.x * vScale.x;
    float v = vWorld.z;
    float halfLen = 0.5 * vScale.x;
    if (vWall.x > 0.5 && vWall.x < 1.5) {
      // Hoftüpfel an Gefäßwänden: dichtes, versetztes Muster, Porus schlitzförmig
      vec2 q = vec2(u, v) / 4.6;
      q.x += mod(floor(q.y), 2.0) * 0.5;
      vec2 cell = floor(q);
      vec2 f = (fract(q) - 0.5) * 4.6;
      float h = hash13(vec3(cell, vWall.y * 97.0));
      if (h < 0.8 && abs(u) + 2.4 < halfLen && v < uOpenZ - 3.0) {
        float ang = 0.6 + h * 0.8;
        vec2 rf = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * f;
        float minor = h > 0.6 ? 0.8 : 0.38;
        float slit = length(rf / vec2(0.95, minor));
        float fs = px / minor;                      // Bildpunkt in Schlitz-Einheiten
        // großer Porus: echtes Loch; kleiner (Schlitz < ≈ 7 px): dunkel gezeichnet statt ausgestanzt, sonst flackert er
        if (fs < 0.3 && slit < 1.0 - fs) discard;
        float r = length(f);
        g += 0.45 * aaBand(slit - 1.0, 0.0, 0.4, fs);
        g += 0.16 * smoothstep(2.15, 1.6, r);
        g -= 0.12 * aaRing(r, 2.1, 0.25, 0.3, px);
        g = mix(g, 0.05, 1.0 - smoothstep(1.0 - fs, 1.0 + fs, slit));
      }
    } else if (vWall.x < 0.5) {
      // Tüpfel der Fasertracheiden: kleiner Hof (Ø ≈ 2,4 µm) mit schrägem Schlitz (≈ 45°, Fibrillenwinkel)
      vec2 q = vec2(u, v) / vec2(6.0, 8.5);
      q.x += mod(floor(q.y), 2.0) * 0.5;
      vec2 cell = floor(q);
      vec2 f = (fract(q) - 0.5) * vec2(6.0, 8.5) - (vec2(hash13(vec3(cell, 3.1)), hash13(vec3(cell, 5.7))) - 0.5) * 1.6;
      float h = hash13(vec3(cell, vWall.y * 53.0));
      if (h < 0.42 && abs(u) + 1.6 < halfLen && v < uOpenZ - 2.0) {
        float r = length(f);
        float ang = 0.78 + (h - 0.2) * 0.5;
        vec2 rf = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * f;
        float slit = length(rf / vec2(0.72, 0.2));
        float fs = px / 0.2;
        if (fs < 0.3 && slit < 1.0 - fs) discard;
        g += 0.32 * aaBand(slit - 1.0, 0.0, 0.5, fs);
        g += 0.2 * aaBand(abs(r - 1.15), 0.0, 0.22, px);              // Hofrand
        g -= 0.06 * (1.0 - smoothstep(0.3, 1.1, r));                   // Hof fällt zum Schlitz ab
        g = mix(g, 0.05, 1.0 - smoothstep(1.0 - fs, 1.0 + fs, slit));
      }
    }
#endif
  } else {
    ed = de.y;                       // Schnittfläche oben: Längskanten leuchten
    // Mittellamelle: feine helle Fuge zwischen den beiden Zellwänden (≈ 0,3 µm), daneben leicht vertieft
    float ml = abs(vLocal.y) * vScale.y;
    g += 0.16 * aaBand(ml, 0.06, 0.2, px) - 0.05 * aaRing(ml, 0.35, 0.15, 0.25, px);
  }
  g += uEdge * aaBand(ed, 0.0, uEdgeW, px);
#endif
#ifdef SEM_JOINT
  if (abs(vLocal.z) > 0.49) {
    g += uEdge * aaBand((1.0 - length(vLocal.xy)) * vScale.x, 0.0, uEdgeW, px);
    g += 0.14 * (1.0 - smoothstep(0.15, 0.4, length(vLocal.xy)));     // Zwickel der Mittellamelle
  }
#endif
  if (uUseDepth > 0.5) {
    float top = uOpenZ;
#ifdef SEM_TOP
    top = mix(uOpenZ, vTopW, uTopMix);   // Terrassen: tiefer liegende Fläche bleibt hell, nur Hohlräume dunkeln ab
#endif
    float d = max(min(top - vWorld.z, uOpenX - vWorld.x), 0.0);
#ifdef SEM_BOT
    float bot = max(vBotW.x, vBotW.y);   // Stirn-, Ober-, Unterseite und Ecken: offen, sobald eine Seite offen ist
#ifdef SEM_WALLS
    if (a.y > a.x && a.y > a.z) bot = vLocal.y > 0.0 ? vBotW.x : vBotW.y;   // Breitseite: nur die Zelle auf dieser Seite
#endif
    d = min(d, max(vWorld.z - bot, 0.0));   // offenes Lumen: Abdunklung wächst erst ab der Öffnung an Flanke/Rückseite
#endif
#ifdef SEM_WALLS
    if (vWall.w > 0.5) d = 0.0;          // Längsseite des Bruchstücks liegt frei
#endif
    g *= mix(0.12, 1.0, exp(-d / uDepth));   // Hohlräume dunkeln ab, bleiben aber sichtbar (Globalbeleuchtung, User 2026-10-23)
  }
  g = max(g, 0.08);                           // Grundhelligkeit: keine Fläche fällt auf Schwarz, auch von der Seite gesehen
  g *= 0.86 + 0.28 * mix(0.5, vnoise(vWorld * uNoise), 1.0 - smoothstep(0.35, 0.7, px * uNoise));   // Körnung feiner als ein Bildpunkt → Mittelwert
  g *= 1.0 + uShade * (vnoise(vWorld * 0.0045 + 7.0) - 0.5);   // großräumige Helligkeit (Aufladung, Detektorlage)
  gl_FragColor = semOut(g, uTint);
}
`;

export function semMaterial(opts = {}) {
  const defines = {};
  if (opts.walls) defines.SEM_WALLS = '';
  if (opts.pits) defines.SEM_PITS = '';
  if (opts.joint) defines.SEM_JOINT = '';
  if (opts.topMix) defines.SEM_TOP = '';
  if (opts.bot) defines.SEM_BOT = '';
  return new THREE.ShaderMaterial({
    defines,
    uniforms: {
      uDet: SEM_DET,
      uBSE: SEM_BSE,
      uZ: { value: opts.z ?? 1 },                         // relative Rückstreu-Ausbeute (mittlere Ordnungszahl): Kohle 0,9, Asche 2,2
      uCharge: opts.charge ? SEM_CHARGE : { value: 0 },   // Aufladung nur in den Ebenen, die sie anfordern (3–4)
      uSemT: SEM_T,
      uTint: { value: new THREE.Color(0.93, 0.95, 0.98) },
      uBase: { value: opts.base ?? 0.4 },
      uEdge: { value: opts.edge ?? 0.55 },
      uEdgeW: { value: opts.edgeW ?? 0.6 },
      uDepth: { value: opts.depth ?? 30 },
      uUseDepth: { value: opts.openZ !== undefined || opts.openX !== undefined ? 1 : 0 },
      uOpenZ: { value: opts.openZ ?? 1e6 },
      uOpenX: { value: opts.openX ?? 1e6 },
      uNoise: { value: opts.noise ?? 0.8 },
      uShade: { value: opts.shade ?? 0 },
      uTopMix: { value: opts.topMix ?? 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
}
