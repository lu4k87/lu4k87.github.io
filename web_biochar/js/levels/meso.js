// Ebene 5: Nanoporen in der Zellwand (Einheit 10 nm), Raymarching über ein hierarchisches 3D-Voronoi:
// große Zellen = Makro-/große Mesoporen mit verdickten Plateau-Rändern (Streben an den Kanten, Knoten an den Ecken),
// dünne Wände dazwischen mit feinen Mesoporen; Wasser nach Kelvin-Gleichung.
// Pyrolyse (pyroState.open): im Holz ist die Zellwand dicht – nur das Relief der Mikrofibrillen-Bündel (≈ 20 nm) zeichnet
// die Oberfläche; das Porennetz öffnet sich 260–380 °C (Modell), die kleinen Poren folgen danach der BET-Fläche (uTS).
// Luftfeuchte: dünner Wasserfilm auf den Porenwänden wächst mit der Feuchte (uFilm), große Poren füllen von unten mit
// hellem Meniskus an der Wand, gefüllt bis Ø uWaterD (Kelvin-Gleichung mit Hysterese, science.js); Füllhöhe = Darstellung.

import * as THREE from 'three';
import { SEM_GLSL, SEM_DET, semDetector } from '../sem.js';
import { hash33, vnoise3 } from '../util.js';
import { kelvinDiameterNm, fmt, labProps, pyroState } from '../science.js';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

const CELL = 6.0, THICK = 1.0, STRUT = 0.55, NODE = 0.95, CS = 0.75, TS = 0.4;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCamPos;
uniform mat4 uCamMatrix;
uniform mat4 uInvProj;
uniform mat4 uViewProj;
uniform float uWaterD;
uniform float uTS;      // Wandstärke zwischen den kleinen Poren: dünner = mehr, größere Poren (BET steigt mit T)
uniform float uOpen;    // 0 Holz (Wand dicht) … 1 Kohle (Porennetz offen)
uniform float uTime;
uniform vec3 uDet;
uniform vec3 uTint;
uniform float uFilm;     // Wasserfilm auf den Porenwänden: 0 trocken … 1 kurz vor der Sättigung
uniform float uDrift;    // 1 = Glanzpunkte des Films wandern, 0 bei reduzierter Bewegung
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

// Zuletzt ausgewertete Stelle: gKind 0 Oberfläche, 1 Porenwand; gWallD = Abstand zur Wand der großen Pore
float gKind = 0.0, gWallD = 9.0;
// x = Abstand, y = Material (0 Kohlenstoff, 1 Wasser)
vec2 map(vec3 p) {
  float idL;
  vec4 F = worley4(p / CELL, idL);
  // Holz: Relief der Mikrofibrillen-Bündel auf der Oberfläche (Modell), verschwindet mit dem Öffnen der Poren
  float top = p.y - topY(p.xz) - (1.0 - uOpen) * 0.14 * (0.5 + 0.5 * sin(dot(p.xz, vec2(0.94, 0.34)) * 1.8 + 1.5 * vn(p * 0.5)));
  // Wände nur in der Tiefe und nicht überall: an der Oberfläche bleibt das offene Gitter aus Streben und Knoten
  float th = THICK * smoothstep(0.38, 0.55, vn(p * 0.28)) * smoothstep(0.0, 3.0, -top) * (0.75 + 0.5 * vn(p * 0.9 + 11.0));
  float dSheet = (F.y - F.x) * 0.5 * CELL - th * 0.5;                                   // Wand (Fläche)
  float dSN = min((F.z - F.x) * 0.5 * CELL - STRUT * (0.8 + 0.4 * vn(p * 0.6 + 3.0)),   // Strebe an der Kante
                  (F.w - F.x) * 0.5 * CELL - NODE);                                       // Knoten an der Ecke
  vec3 ws = worley(p / CS + 31.0);
  float dS = (ws.y - ws.x) * 0.5 * CS - uTS * 0.5;          // > 0: in kleiner Pore (nur die dünnen Wände sind gelocht)
  // Holz → Kohle: Wände, Streben und Knoten sind um „inflate“ aufgeblasen, bis alle Poren geschlossen sind (Abstandsfeld
  // bleibt gültig); das Wasser füllt nur den offenen Rest der Poren
  float inflate = (1.0 - uOpen) * 3.2;
  float sPore = min(dSN, max(dSheet, dS)) - inflate;
  float solid = max(sPore, top);
  gKind = step(top, sPore);
  solid -= 0.05 * (vn(p * 8.0) - 0.5) * gKind;            // feines Wandrelief (Körnung) nur in den Poren
  float water = 1e3;
  if (uWaterD > 0.0 && uOpen > 0.05) {
    float dBig = min(dSheet, dSN) - inflate;               // > 0: in großer Pore
    float sizeL = CELL * 10.0 * (0.45 + 0.5 * idL);        // nm
    float sizeS = CS * 10.0 * (0.3 + 0.55 * ws.z);
    gWallD = dBig;
    // Wasser steigt von unten, sobald Ø uWaterD die Pore fast erreicht (ab 0,8 × Ø), an der Wand zieht der Meniskus hoch
    float fillL = clamp((uWaterD - sizeL) / (0.2 * sizeL) + 1.0, 0.0, 1.0);
    if (fillL > 0.01) {
      float yw = topY(p.xz) - 3.2 * (1.0 - fillL) + 0.32 * exp(-max(dBig, 0.0) / 0.45);
      water = min(water, max(max(-dBig, p.y - yw), top + 0.05));
    }
    if (sizeS < uWaterD) water = min(water, max(max(-dS + inflate, dSheet - inflate), top + 0.05));
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
  float kind = gKind, wallD = gWallD;   // vor Normale und AO sichern: die werten map() an Nachbarpunkten aus
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
    col *= 1.0 - 0.5 * clamp((topY(p.xz) - p.y) / 3.2, 0.0, 1.0);           // tief stehendes Wasser wirkt dunkler
    col += vec3(0.65, 0.88, 1.0) * exp(-max(wallD, 0.0) / 0.2) * 0.75;        // Meniskus: heller Saum an der Wand
    gl_FragColor = vec4(pow(col * vis, vec3(2.2)), 1.0);
    return;
  }
  // feine Wandstruktur auf allen Qualitätsstufen: Körnung in der Normale, Grübchen als Andeutung der Mikroporen
  n = normalize(n + 0.28 * (vec3(vn(p * 26.0), vn(p * 26.0 + 5.0), vn(p * 26.0 + 9.0)) - 0.5));
  float g = semShade(n, V, uDet, 0.44);
  g *= 0.9 + 0.2 * vnoise(p * 7.0);
  g *= 1.0 - 0.5 * smoothstep(0.74, 0.8, vn(p * 15.0 + 3.0));
  vec3 tint = uTint;
  if (uFilm > 0.0 && kind > 0.5) {
    // Wasserfilm: Wand dunkler, bläulicher, glänzender; Glanzpunkte driften langsam (Modell, Dicke wächst mit der Feuchte)
    float wet = uFilm * (0.75 + 0.25 * vn(p * 5.0 + vec3(uTime * 0.25, 0.0, -uTime * 0.2) * uDrift));
    g *= 1.0 - 0.3 * wet;
    g += wet * 1.5 * pow(max(dot(reflect(-V, n), uDet), 0.0), 30.0);
    tint = mix(tint, vec3(0.74, 0.88, 1.06), 0.6 * wet);
  }
  gl_FragColor = semOut(g * vis, tint);
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

// Messlinien: Mitte offener großer Poren im Startbild, je Zelle des Porenmodells eine; Ø = sizeL wie im Shader (Modell).
// Auswahl: nah am Blickziel, im Bild (Startkamera mit 16:10), Abstand zu Hotspots und untereinander, eine Makropore zuerst
function findMeasures(home, avoid) {
  const cam = new THREE.PerspectiveCamera(45, 1.6, 0.1, 500);
  cam.position.copy(home.pos);
  cam.lookAt(home.target);
  cam.updateMatrixWorld();
  const cells = new Map();
  for (let x = home.target.x - 16; x <= home.target.x + 16; x += 0.4) {
    for (let z = home.target.z - 16; z <= home.target.z + 16; z += 0.4) {
      const ty = topY(x, z);
      const f = fields(x, ty - 0.5, z);
      if (f.dBig < 0.8) continue;   // ≥ 8 nm von der Wand: sicher in einer offenen großen Pore
      const id = worley(x / CELL, (ty - 0.5) / CELL, z / CELL)[4];
      const c = cells.get(id);
      if (!c || f.dBig > c.d) cells.set(id, { d: f.dBig, pos: new THREE.Vector3(x, ty - 0.1, z), nm: CELL * 10 * (0.45 + 0.5 * id) });
    }
  }
  const cand = [...cells.values()].filter((c) => {
    const v = c.pos.clone().project(cam);
    return v.x > -0.75 && v.x < 0.6 && v.y > -0.6 && v.y < 0.7 && avoid.every((a) => a.distanceTo(c.pos) > 3);
  }).sort((a, b) => a.pos.distanceTo(home.target) - b.pos.distanceTo(home.target));
  const out = [];
  const take = (c) => { if (out.length < 3 && out.every((o) => o.pos.distanceTo(c.pos) > 5)) out.push(c); };
  const macro = cand.find((c) => c.nm >= 50);
  if (macro) take(macro);
  cand.forEach(take);
  return out.map((c) => ({ pos: c.pos, nm: c.nm, name: c.nm >= 50 ? 'Makropore' : 'Mesopore' }));
}

// Die kleinen Poren folgen der spezifischen Oberfläche (BET, 5 → 390 m²/g): Bei 550 °C gilt das Ausgangsbild (TS = 0,4),
// kühler sind die Wände dichter, heißer sind mehr Poren offen (Modell, Richtwert)
// Wasserfilm auf den Wänden (Modell, Darstellung): wächst mit der Feuchte, ab ≈ 95 % voll
const film = (rh) => Math.pow(Math.min(1, rh / 0.95), 1.2);
const poreWall = (T) => TS * (1 - 1.25 * (Math.min(1, labProps(T).bet / 390) - 0.56));

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, ctx.aspect, 0.1, 500);
  const uniforms = {
    uCamPos: { value: new THREE.Vector3() },
    uCamMatrix: { value: new THREE.Matrix4() },
    uInvProj: { value: new THREE.Matrix4() },
    uViewProj: { value: new THREE.Matrix4() },
    uWaterD: { value: ctx.wet },
    uTS: { value: poreWall(ctx.temp) },
    uOpen: { value: pyroState(ctx.temp).open },
    uTime: { value: 0 },
    uDet: SEM_DET,
    uTint: { value: new THREE.Color(0.93, 0.95, 0.98) },
    uFilm: { value: film(ctx.rh) },
    uDrift: { value: still ? 0 : 1 },
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
  // Startbild mit Überblick über das Porennetz (Bildbreite ≈ 270 nm), Wandrelief und Tiefenschärfe tragen das Bild,
  // im Leerlauf gleitet die Kamera an der Wand
  const wall = at('wallpore', [-3, ty0, 1.5]);
  const home = { pos: wall.clone().add(new THREE.Vector3(4.8, 9.6, 17.6)), target: wall.clone() };
  const hotspots = [
    { id: 'wallpore', kind: 'dive', pos: wall, normal: up },
    { id: 'macro', kind: 'info', pos: at('macro', [6, ty0 - 1, -2]), normal: up },
    { id: 'meso', kind: 'info', pos: at('meso', [-6.5, ty0, -4.5]), normal: up },
    { id: 'water', kind: 'info', pos: at('water', [3, ty0, 5.5]), normal: up },
  ];
  let rh = ctx.rh, wet = ctx.wet;
  const level = {
    scene, camera,
    unit: 1e-8,
    method: 'Modell nach FIB-REM und Gasadsorption',
    tone: 0,
    grain: 0.045,
    resScale: 0.8,
    dof: 2.5,
    bloom: 0.04,
    home,
    orbit: { minDistance: 5, maxDistance: 70, minPolarAngle: 0.12, maxPolarAngle: 1.3, enablePan: true, screenSpacePanning: false },
    cine: { orbit: 0.12, crane: 0.03, dolly: 0.04, drift: 0.28, lift: 0.15 },   // Leerlauf: seitlich an der Wand entlang
    hotspots,
    measures: findMeasures(home, hotspots.map((h) => h.pos)),
    measuresOn: pyroState(ctx.temp).open > 0.85,   // im Holz sind die Poren zu
    facts: () => [{
      value: `≈ ${fmt(wet, 0)} nm`,
      label: `bei ${fmt(rh * 100)} % Luftfeuchte mit Wasser gefüllte Poren (Kelvin-Gleichung${wet > kelvinDiameterNm(rh) + 0.5 ? ', beim Trocknen Hysterese' : ''})`,
    }],
    update(dt, t) {
      uniforms.uTime.value = t;
      // Wasserstand und Film gleiten zum Reglerwert (bei reduzierter Bewegung sofort)
      const k = still ? 1 : 1 - Math.exp(-dt * 4);
      uniforms.uWaterD.value += (wet - uniforms.uWaterD.value) * k;
      uniforms.uFilm.value += (film(rh) - uniforms.uFilm.value) * k;
      camera.updateMatrixWorld();
      uniforms.uCamPos.value.copy(camera.position);
      uniforms.uCamMatrix.value.copy(camera.matrixWorld);
      uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
      uniforms.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      semDetector(t);
      return true;
    },
    setParam(name, value) {
      if (name === 'temp') { uniforms.uTS.value = poreWall(value); uniforms.uOpen.value = pyroState(value).open; level.measuresOn = uniforms.uOpen.value > 0.85; level.dirty = true; return; }
      // Qualitätsstufe: weniger, dafür längere Schritte (Leicht ≈ 63, Mittel ≈ 98, Fein 140)
      if (name === 'quality') { uniforms.uMarch.value.set(Math.round(140 * value.detail), 1 - 0.25 * value.detail); level.dirty = true; return; }
      if (name === 'rh') rh = value;
      else if (name === 'wet') wet = value;
    },
    dispose() {
      quad.geometry.dispose();
      quad.material.dispose();
    },
  };
  return level;
}
