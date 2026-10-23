// REM-Look (Sekundärelektronen): Flächen schräg zum Strahl und Kanten leuchten, tiefe Hohlräume bleiben dunkel.
// Ausgabe linear (Gamma 2,2), die Zusammenführung in main.js wandelt nach sRGB.

import * as THREE from 'three';

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
float semShade(vec3 N, vec3 V, vec3 det, float base) {
  float c = clamp(abs(dot(N, V)), 0.0, 1.0);
  float g = base * (1.0 + 0.62 * (1.0 / max(c, 0.22) - 1.0));
  return g + 0.13 * dot(N, det);
}
vec4 semOut(float g, vec3 tint) {
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
const _yAxis = new THREE.Vector3(0, 1, 0), _xAxis = new THREE.Vector3(1, 0, 0);
export function semDetector(t, k = 1) {
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
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec3 vScale;
${SEM_GLSL}
void main() {
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
        float slit = length(rf / vec2(0.95, h > 0.6 ? 0.8 : 0.38));
        if (slit < 1.0) discard;
        float r = length(f);
        g += 0.45 * (1.0 - smoothstep(0.0, 0.4, slit - 1.0));
        g += 0.16 * smoothstep(2.15, 1.6, r);
        g -= 0.12 * smoothstep(1.85, 2.1, r) * smoothstep(2.4, 2.1, r);
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
        if (slit < 1.0) discard;
        g += 0.32 * (1.0 - smoothstep(0.0, 0.5, slit - 1.0));
        g += 0.2 * (1.0 - smoothstep(0.0, 0.22, abs(r - 1.15)));      // Hofrand
        g -= 0.06 * (1.0 - smoothstep(0.3, 1.1, r));                   // Hof fällt zum Schlitz ab
      }
    }
#endif
  } else {
    ed = de.y;                       // Schnittfläche oben: Längskanten leuchten
    // Mittellamelle: feine helle Fuge zwischen den beiden Zellwänden (≈ 0,3 µm), daneben leicht vertieft
    float ml = abs(vLocal.y) * vScale.y;
    g += 0.16 * (1.0 - smoothstep(0.06, 0.2, ml)) - 0.05 * smoothstep(0.2, 0.35, ml) * (1.0 - smoothstep(0.35, 0.6, ml));
  }
  g += uEdge * (1.0 - smoothstep(0.0, uEdgeW, ed));
#endif
#ifdef SEM_JOINT
  if (abs(vLocal.z) > 0.49) {
    g += uEdge * (1.0 - smoothstep(0.0, uEdgeW, (1.0 - length(vLocal.xy)) * vScale.x));
    g += 0.14 * (1.0 - smoothstep(0.15, 0.4, length(vLocal.xy)));     // Zwickel der Mittellamelle
  }
#endif
  if (uUseDepth > 0.5) {
    float top = uOpenZ;
#ifdef SEM_TOP
    top = mix(uOpenZ, vTopW, uTopMix);   // Terrassen: tiefer liegende Fläche bleibt hell, nur Hohlräume dunkeln ab
#endif
    float d = max(min(top - vWorld.z, uOpenX - vWorld.x), 0.0);
#ifdef SEM_WALLS
    if (vWall.w > 0.5) d = 0.0;          // Längsseite des Bruchstücks liegt frei
#endif
    g *= mix(0.03, 1.0, exp(-d / uDepth));
  }
  g *= 0.86 + 0.28 * vnoise(vWorld * uNoise);
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
  return new THREE.ShaderMaterial({
    defines,
    uniforms: {
      uDet: SEM_DET,
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
