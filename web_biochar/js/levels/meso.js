// Ebene 5: Nanoporen in der Zellwand (Einheit 10 nm), Raymarching über ein hierarchisches 3D-Voronoi:
// große Zellen = Makro-/große Mesoporen mit verdickten Plateau-Rändern (Streben an den Kanten, Knoten an den Ecken),
// dünne Wände dazwischen mit feinen Mesoporen; Wasser nach Kelvin-Gleichung.

import * as THREE from 'three';
import { SEM_GLSL, SEM_DET, semDetector } from '../sem.js';
import { hash33, vnoise3 } from '../util.js';
import { kelvinDiameterNm, fmt, labProps } from '../science.js';

const CELL = 6.0, THICK = 1.0, STRUT = 0.55, NODE = 0.95, CS = 0.75, TS = 0.4;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCamPos;
uniform mat4 uCamMatrix;
uniform mat4 uInvProj;
uniform mat4 uViewProj;
uniform float uWaterD;
uniform float uTS;      // Wandstärke zwischen den kleinen Poren: dünner = mehr, größere Poren (BET steigt mit T)
uniform float uTime;
uniform vec3 uDet;
uniform vec3 uTint;
uniform vec2 uMarch;     // Raymarching je Qualitätsstufe: Schritte (max. 140) und Schrittfaktor
varying vec2 vUv;
${SEM_GLSL}
const float CELL = ${CELL.toFixed(2)};
const float THICK = ${THICK.toFixed(2)};
const float STRUT = ${STRUT.toFixed(2)};
const float NODE = ${NODE.toFixed(2)};
const float CS = ${CS.toFixed(2)};
const float TS = ${TS.toFixed(2)};

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 h33(vec3 c) { return vec3(pcg3d(uvec3(ivec3(c) + 4096))) * (1.0 / 4294967296.0); }
float vn(vec3 p) {
  vec3 i = floor(p), f = p - i;
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h33(i).x, h33(i + vec3(1, 0, 0)).x, u.x), mix(h33(i + vec3(0, 1, 0)).x, h33(i + vec3(1, 1, 0)).x, u.x), u.y),
             mix(mix(h33(i + vec3(0, 0, 1)).x, h33(i + vec3(1, 0, 1)).x, u.x), mix(h33(i + vec3(0, 1, 1)).x, h33(i + vec3(1, 1, 1)).x, u.x), u.y), u.z);
}
// F1–F4 (Abstände zu den vier nächsten Zellpunkten) und Zufallswert der nächsten Zelle:
// F2−F1 ≈ Abstand zur Wand, F3−F1 ≈ zur Kante (drei Zellen), F4−F1 ≈ zur Ecke (vier Zellen)
vec4 worley4(vec3 p, out float id) {
  vec3 i = floor(p), f = p - i;
  vec4 F = vec4(9.0);
  id = 0.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = h33(i + g);
    vec3 r = g + 0.15 + 0.7 * o - f;
    float d = dot(r, r);
    if (d < F.x) { F = vec4(d, F.xyz); id = fract(o.x * 7.13 + o.y * 3.77); }
    else if (d < F.y) { F = vec4(F.x, d, F.yz); }
    else if (d < F.z) { F.zw = vec2(d, F.z); }
    else if (d < F.w) { F.w = d; }
  }
  return sqrt(F);
}
vec3 worley(vec3 p) {
  float id;
  vec4 F = worley4(p, id);
  return vec3(F.x, F.y, id);
}
float topY(vec2 xz) { return -0.6 + 1.1 * vn(vec3(xz * 0.09, 3.0)) + 0.45 * vn(vec3(xz * 0.31, 7.0)); }

// x = Abstand, y = Material (0 Kohlenstoff, 1 Wasser)
vec2 map(vec3 p) {
  float idL;
  vec4 F = worley4(p / CELL, idL);
  float top = p.y - topY(p.xz);
  // Wände nur in der Tiefe und nicht überall: an der Oberfläche bleibt das offene Gitter aus Streben und Knoten
  float th = THICK * smoothstep(0.38, 0.55, vn(p * 0.28)) * smoothstep(0.0, 3.0, -top) * (0.75 + 0.5 * vn(p * 0.9 + 11.0));
  float dSheet = (F.y - F.x) * 0.5 * CELL - th * 0.5;                                   // Wand (Fläche)
  float dSN = min((F.z - F.x) * 0.5 * CELL - STRUT * (0.8 + 0.4 * vn(p * 0.6 + 3.0)),   // Strebe an der Kante
                  (F.w - F.x) * 0.5 * CELL - NODE);                                       // Knoten an der Ecke
  vec3 ws = worley(p / CS + 31.0);
  float dS = (ws.y - ws.x) * 0.5 * CS - uTS * 0.5;          // > 0: in kleiner Pore (nur die dünnen Wände sind gelocht)
  float solid = max(min(dSN, max(dSheet, dS)), top);
  float water = 1e3;
  if (uWaterD > 0.0) {
    float dBig = min(dSheet, dSN);                         // > 0: in großer Pore
    float sizeL = CELL * 10.0 * (0.45 + 0.5 * idL);        // nm
    float sizeS = CS * 10.0 * (0.3 + 0.55 * ws.z);
    if (sizeL < uWaterD) water = min(water, max(-dBig, top + 0.05));
    if (sizeS < uWaterD) water = min(water, max(max(-dS, dSheet), top + 0.05));
  }
  return water < solid ? vec2(water, 1.0) : vec2(solid, 0.0);
}
vec3 calcNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.012;
  return normalize(k.xyy * map(p + k.xyy * e).x + k.yyx * map(p + k.yyx * e).x +
                   k.yxy * map(p + k.yxy * e).x + k.xxx * map(p + k.xxx * e).x);
}
void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 vp = uInvProj * vec4(ndc, 1.0, 1.0);
  vp /= vp.w;
  vec3 rd = normalize((uCamMatrix * vec4(vp.xyz, 0.0)).xyz);
  vec3 ro = uCamPos;
  float t = 0.0;
  const float Y_MAX = 1.2;
  if (ro.y > Y_MAX) {
    if (rd.y > -1e-4) { gl_FragDepth = 1.0; gl_FragColor = vec4(0.0); return; }
    t = (ro.y - Y_MAX) / -rd.y;
  }
  float tMax = t + 90.0;
  vec2 h = vec2(1.0, 0.0);
  bool hit = false;
  for (int i = 0; i < 140; i++) {
    if (float(i) >= uMarch.x) break;
    h = map(ro + rd * t);
    if (h.x < 0.0015 * t + 0.004) { hit = true; break; }
    t += max(h.x * uMarch.y, 0.01);
    if (t > tMax) break;
  }
  if (!hit) { gl_FragDepth = 1.0; gl_FragColor = vec4(0.0); return; }
  vec3 p = ro + rd * t;
  vec4 clip = uViewProj * vec4(p, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);   // echte Tiefe für die Tiefenunschärfe
  vec3 n = calcNormal(p);
  float ao = 0.0, sca = 1.0;
  for (int i = 1; i <= 4; i++) {
    float hh = 0.18 * float(i);
    ao += (hh - map(p + n * hh).x) * sca;
    sca *= 0.7;
  }
  ao = clamp(1.0 - 1.6 * ao, 0.0, 1.0);
  float depth = max(topY(p.xz) - p.y, 0.0);
  float vis = mix(0.05, 1.0, exp(-depth / 2.8)) * mix(0.45, 1.0, ao) * exp(-max(t - 32.0, 0.0) * 0.035);
  vec3 V = -rd;
  if (h.y > 0.5) {
    float fres = pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 3.0);
    // Wasserfilm lebt: die Oberfläche (Meniskus) schwingt leicht, einzelne Glitzerpunkte blitzen auf (Kapillarwellen, Modell)
    vec3 wob = vec3(vn(p * 4.0 + uTime * 0.7), vn(p * 4.0 + 7.0 - uTime * 0.6), vn(p * 4.0 + 13.0 + uTime * 0.5)) - 0.5;
    n = normalize(n + 0.16 * wob);
    float glint = pow(max(dot(reflect(-V, n), uDet), 0.0), 90.0);
    vec3 col = vec3(0.28, 0.66, 0.92) * (0.42 + 0.6 * fres) + vec3(0.9) * (pow(max(dot(reflect(-V, n), uDet), 0.0), 40.0) * 0.5 + glint * 1.3);
    gl_FragColor = vec4(pow(col * vis, vec3(2.2)), 1.0);
    return;
  }
  float g = semShade(n, V, uDet, 0.44);
  g *= 0.9 + 0.2 * vnoise(p * 7.0);
  gl_FragColor = semOut(g * vis, uTint);
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Dieselben Felder in JavaScript, um Hotspots exakt auf Wände und Poren zu setzen
function worley(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const F = [9, 9, 9, 9];
  let id = 0;
  for (let c = -1; c <= 1; c++) for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const o = hash33(ix + a, iy + b, iz + c);
    const rx = a + 0.15 + 0.7 * o[0] - fx, ry = b + 0.15 + 0.7 * o[1] - fy, rz = c + 0.15 + 0.7 * o[2] - fz;
    const d = rx * rx + ry * ry + rz * rz;
    if (d < F[0]) { F.splice(0, 0, d); F.length = 4; id = (o[0] * 7.13 + o[1] * 3.77) % 1; }
    else if (d < F[1]) { F.splice(1, 0, d); F.length = 4; }
    else if (d < F[2]) { F.splice(2, 0, d); F.length = 4; }
    else if (d < F[3]) F[3] = d;
  }
  return [...F.map(Math.sqrt), id];
}
const topY = (x, z) => -0.6 + 1.1 * vnoise3(x * 0.09, z * 0.09, 3) + 0.45 * vnoise3(x * 0.31, z * 0.31, 7);
function fields(x, y, z) {
  const wl = worley(x / CELL, y / CELL, z / CELL);
  const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const th = THICK * sm(0.38, 0.55, vnoise3(x * 0.28, y * 0.28, z * 0.28)) * sm(0, 3, topY(x, z) - y) * (0.75 + 0.5 * vnoise3(x * 0.9 + 11, y * 0.9 + 11, z * 0.9 + 11));
  const dSheet = (wl[1] - wl[0]) * 0.5 * CELL - th * 0.5;
  const dSN = Math.min((wl[2] - wl[0]) * 0.5 * CELL - STRUT * (0.8 + 0.4 * vnoise3(x * 0.6 + 3, y * 0.6 + 3, z * 0.6 + 3)),
    (wl[3] - wl[0]) * 0.5 * CELL - NODE);
  const ws = worley(x / CS + 31, y / CS + 31, z / CS + 31);
  const dS = (ws[1] - ws[0]) * 0.5 * CS - TS * 0.5;
  return { dSheet, dSN, dBig: Math.min(dSheet, dSN), dS, sizeS: CS * 10 * (0.3 + 0.55 * ws[4]) };
}

function findSpots() {
  const want = {
    wallpore: [-3, 1.5], macro: [6, -2], meso: [-6.5, -4.5], water: [3, 5.5],
  };
  const best = {};
  for (let x = -14; x <= 14; x += 0.35) {
    for (let z = -12; z <= 12; z += 0.35) {
      const ty = topY(x, z);
      const f = fields(x, ty - 0.12, z);
      const classes = [];
      if (f.dSheet < -0.25 && f.dSN > 0.3 && f.dS < -0.08) classes.push(['wallpore', ty + 0.05]);
      if (f.dBig > 1.6) classes.push(['macro', ty - 0.9]);
      if (f.dSheet < -0.15 && f.dSN > 0.2 && f.dS > 0.08) classes.push(['meso', ty - 0.12], ['water', ty - 0.12]);
      for (const [c, y] of classes) {
        const d = Math.hypot(x - want[c][0], z - want[c][1]);
        if (!best[c] || d < best[c].d) best[c] = { d, pos: new THREE.Vector3(x, y, z) };
      }
    }
  }
  return best;
}

// Die kleinen Poren folgen der spezifischen Oberfläche (BET, 5 → 390 m²/g): Bei 550 °C gilt das Ausgangsbild (TS = 0,4),
// kühler sind die Wände dichter, heißer sind mehr Poren offen (Modell, Richtwert)
const poreWall = (T) => TS * (1 - 1.25 * (Math.min(1, labProps(T).bet / 390) - 0.56));

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, ctx.aspect, 0.1, 500);
  const uniforms = {
    uCamPos: { value: new THREE.Vector3() },
    uCamMatrix: { value: new THREE.Matrix4() },
    uInvProj: { value: new THREE.Matrix4() },
    uViewProj: { value: new THREE.Matrix4() },
    uWaterD: { value: kelvinDiameterNm(ctx.rh) },
    uTS: { value: poreWall(ctx.temp) },
    uTime: { value: 0 },
    uDet: SEM_DET,
    uTint: { value: new THREE.Color(0.93, 0.95, 0.98) },
    uMarch: { value: new THREE.Vector2(140, 0.75) },
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth,
  }));
  quad.frustumCulled = false;
  scene.add(quad);

  const spots = findSpots();
  const at = (k, fallback) => (spots[k] ? spots[k].pos : new THREE.Vector3(...fallback));
  const up = new THREE.Vector3(0, 1, 0);
  const ty0 = topY(0, 0);
  let rh = ctx.rh;
  const level = {
    scene, camera,
    unit: 1e-8,
    method: 'Modell nach FIB-REM und Gasadsorption',
    tone: 0,
    grain: 0.045,
    resScale: 0.8,
    dof: 2.5,
    bloom: 0.04,
    home: { pos: new THREE.Vector3(2.5, ty0 + 15, 23), target: new THREE.Vector3(0, ty0 - 0.3, 0) },
    orbit: { minDistance: 5, maxDistance: 70, minPolarAngle: 0.12, maxPolarAngle: 1.3, enablePan: true, screenSpacePanning: false },
    hotspots: [
      { id: 'wallpore', kind: 'dive', pos: at('wallpore', [-3, ty0, 1.5]), normal: up },
      { id: 'macro', kind: 'info', pos: at('macro', [6, ty0 - 1, -2]), normal: up },
      { id: 'meso', kind: 'info', pos: at('meso', [-6.5, ty0, -4.5]), normal: up },
      { id: 'water', kind: 'info', pos: at('water', [3, ty0, 5.5]), normal: up },
    ],
    facts: () => [{ value: `≈ ${fmt(kelvinDiameterNm(rh), 0)} nm`, label: `bei ${fmt(rh * 100)} % Luftfeuchte mit Wasser gefüllte Poren (Kelvin-Gleichung)` }],
    update(dt, t) {
      uniforms.uTime.value = t;
      camera.updateMatrixWorld();
      uniforms.uCamPos.value.copy(camera.position);
      uniforms.uCamMatrix.value.copy(camera.matrixWorld);
      uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
      uniforms.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      semDetector(t);
      return true;
    },
    setParam(name, value) {
      if (name === 'temp') { uniforms.uTS.value = poreWall(value); level.dirty = true; return; }
      // Qualitätsstufe: weniger, dafür längere Schritte (Leicht ≈ 63, Mittel ≈ 98, Fein 140)
      if (name === 'quality') { uniforms.uMarch.value.set(Math.round(140 * value.detail), 1 - 0.25 * value.detail); level.dirty = true; return; }
      if (name !== 'rh') return;
      rh = value;
      uniforms.uWaterD.value = kelvinDiameterNm(value);
      level.dirty = true;
    },
    dispose() {
      quad.geometry.dispose();
      quad.material.dispose();
    },
  };
  return level;
}
