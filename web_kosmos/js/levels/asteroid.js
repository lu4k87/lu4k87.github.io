// Station 02A: Asteroiden aus der Nähe – (16) Psyche, (101955) Bennu, (433) Eros. Einheit = größte Halbachse des Körpers
// (wechselt mit dem Körper, die Größenskala folgt). Form: Ikosaederkugel, auf der CPU verformt – Grundform nach den
// Messdaten (Psyche 278 × 238 × 171 km mit den Senken des Radarmodells, Shepard 2021; Bennu Kreisel mit Äquatorwulst,
// Barnouin 2019; Eros 33 × 13 × 13 km, gebogen), dazu fBm-Rauschen, Krater mit Wall und (Bennu) Felsblöcke als Modell.
// Feinrelief (Kleinkrater, Poren, Blöcke, Körnung) als Höhenfeld im Fragment-Shader, Bump nach Mikkelsen 2010 ohne
// Textur. Licht: Sonne gerichtet mit Schattenwurf (Schatten in Kratern), bläuliches Fülllicht wie in der Darstellung
// der NASA von Psyche (künstlerisch, abschaltbar), Linsenreflex. Bennu wirft Steinchen aus (Lauretta 2019), im Bild
// verlangsamt; Teilchen fliegen ballistisch unter der Schwerkraft des Körpers.

import * as THREE from 'three';
import { createStarfield } from '../stars.js';
import { createFlare } from '../flare.js';
import { settings } from '../settings.js';
import { registerLayers } from '../layers.js';
import { NOISE } from '../glsl.js';
import { mulberry32 } from '../astro.js';

const RAD = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);

// a = größte Halbachse [km], axes = Halbachsen relativ (x, y = Drehachse, z), period = Umdrehung [h]
export const BODIES = {
  psyche: { name: '(16) Psyche', a: 139, axes: [1, 171 / 278, 238 / 278], period: 4.195948, size: '278 × 238 × 171 km', kind: 0, feat: 16, exposure: 1.0, seed: 16 },
  bennu: { name: '(101955) Bennu', a: 0.26, axes: [1, 0.9, 0.95], period: 4.296, size: '≈ 490 m', kind: 1, feat: 22, exposure: 1.8, seed: 101955 },
  eros: { name: '(433) Eros', a: 16.5, axes: [1, 13 / 33, 13 / 33], period: 5.27, size: '33 × 13 × 13 km', kind: 2, feat: 20, exposure: 1.0, seed: 433 },
};
const fmtH = (h) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')} min`;

// ---------- Rauschen und Kraterprofil (CPU) ----------
function makeNoise(seed) {
  const r = mulberry32(seed), P = new Uint8Array(512), G = new Float32Array(768);
  for (let i = 0; i < 256; i++) {
    P[i] = i;
    const z = r() * 2 - 1, t = r() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    G.set([s * Math.cos(t), s * Math.sin(t), z], i * 3);
  }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const gr = (h, x, y, z) => G[h * 3] * x + G[h * 3 + 1] * y + G[h * 3 + 2] * z;
  const lerp = (a, b, t) => a + (b - a) * t;
  const noise = (x, y, z) => {
    const X = Math.floor(x), Yi = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Yi; z -= Z;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = P[X & 255] + (Yi & 255), AA = P[A] + (Z & 255), AB = P[A + 1] + (Z & 255);
    const B = P[(X + 1) & 255] + (Yi & 255), BA = P[B] + (Z & 255), BB = P[B + 1] + (Z & 255);
    return lerp(lerp(lerp(gr(P[AA], x, y, z), gr(P[BA], x - 1, y, z), u), lerp(gr(P[AB], x, y - 1, z), gr(P[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(gr(P[AA + 1], x, y, z - 1), gr(P[BA + 1], x - 1, y, z - 1), u), lerp(gr(P[AB + 1], x, y - 1, z - 1), gr(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  };
  const fbm = (x, y, z, oct) => {
    let s = 0, a = 0.5;
    for (let i = 0; i < oct; i++) { s += a * noise(x, y, z); x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; z = z * 2.03 + 9.3; a *= 0.5; }
    return s;
  };
  return { fbm };
}
const smin = (a, b, k) => { const h = Math.min(1, Math.max(0, 0.5 + 0.5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };
const smax = (a, b, k) => -smin(-a, -b, k);
// Kraterprofil über q = Abstand/Radius: Schüssel q² − 1 mit flachem Boden, Wall bis q = 1,4 (Muster nach S. Lague)
const craterProfile = (q, floor) => { const rx = Math.min(q - 1.4, 0); return smin(smax(q * q - 1, floor, 0.25), 2.2 * rx * rx, 0.2); };

// Ikosaederkugel mit gemeinsamen Eckpunkten (glatte Normalen nach dem Verformen)
function icoIndexed(detail) {
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position;
  const map = new Map(), verts = [], idx = new Uint32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
    let j = map.get(k);
    if (j === undefined) { j = verts.length / 3; map.set(k, j); verts.push(x, y, z); }
    idx[i] = j;
  }
  g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

const dirLL = (lat, lon) => new THREE.Vector3(Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.sin(lat * RAD), -Math.cos(lat * RAD) * Math.sin(lon * RAD));

function makeBody(id, sphere) {
  const B = BODIES[id], ax = B.axes, rand = mulberry32(B.seed), N = makeNoise(B.seed);
  const ellip = (d, o) => o.copy(d).multiplyScalar(1 / Math.hypot(d.x / ax[0], d.y / ax[1], d.z / ax[2]));
  const base = id === 'bennu'
    ? (d, o) => ellip(d, o).multiplyScalar(1 - 0.16 * Math.abs(d.y) ** 1.1 + 0.05 * Math.exp(-((d.y / 0.12) ** 2)))   // Kreisel + Wulst
    : id === 'eros' ? (d, o) => { ellip(d, o); o.z += 0.3 * o.x * o.x - 0.12; return o; }                              // gebogen
      : ellip;
  const randDir = () => { const z = rand() * 2 - 1, t = rand() * Math.PI * 2, s = Math.sqrt(1 - z * z); return new THREE.Vector3(s * Math.cos(t), z, s * Math.sin(t)); };
  const craters = [], blocks = [], marks = [];
  const crater = (d, r, depth, floor = -0.7) => craters.push({ c: base(d, new THREE.Vector3()), r, depth: depth * r, floor });
  const many = (n, rMin, rMax, slope, depth) => {
    for (let i = 0; i < n; i++) crater(randDir(), rMin * (rMax / rMin) ** (rand() ** slope), depth * (0.7 + 0.6 * rand()), -0.55 - 0.3 * rand());
  };
  let rough = 0.05, freq = 1.6;
  if (id === 'psyche') {
    // Senken des Radarmodells (Shepard 2021): „Eros“ bei 65° S, 50–75 km breit, ≈ 4 km tief · Panthia, nördliche mittlere
    // Breiten, 80–90 km, flach · Foxtrot am Nordpol, ≈ 50 km. Längen im Modell frei gewählt; Tiefe/Radius aus den Angaben.
    for (const [lat, lon, rKm, dKm] of [[-65, 290, 31, 4], [40, 120, 43, 1.5], [85, 0, 25, 2.5]]) {
      const d = dirLL(lat, lon), r = rKm / B.a;
      crater(d, r, (dKm / rKm) / 0.75, -0.75);
      marks.push({ c: base(d, new THREE.Vector3()), r });
    }
    many(48, 0.018, 0.11, 2.2, 0.32);
    rough = 0.085; freq = 1.25;
  } else if (id === 'bennu') {
    many(14, 0.04, 0.17, 1.6, 0.18);
    for (let i = 0; i < 320; i++) { const r = 0.014 * (0.07 / 0.014) ** (rand() ** 2.4); blocks.push({ c: base(randDir(), new THREE.Vector3()), r, h: r * (0.45 + 0.35 * rand()) }); }
    blocks.push({ c: base(dirLL(-25, 200), new THREE.Vector3()), r: 0.085, h: 0.07 });
    rough = 0.035; freq = 2.6;
  } else {
    crater(new THREE.Vector3(0, 0.1, 1).normalize(), 0.38, 0.22, -0.8);   // breiter Sattel innen in der Biegung (Modell)
    crater(dirLL(10, 160), 0.155, 0.3);
    many(70, 0.015, 0.12, 2.0, 0.3);
    rough = 0.06; freq = 1.7;
  }
  const b = new THREE.Vector3();
  // Punkt der Oberfläche in Richtung d → o; gibt Höhe über der Grundform und Verschattung (Kraterinneres) zurück
  const shape = (d, o) => {
    base(d, b);
    let h = rough * (N.fbm(b.x * freq, b.y * freq, b.z * freq, 5) + 0.9 * N.fbm(b.x * freq * 0.5 + 7, b.y * freq * 0.5 + 3, b.z * freq * 0.5 + 1, 3)), cav = 0;
    for (const c of craters) {
      const dx = b.x - c.c.x, dy = b.y - c.c.y, dz = b.z - c.c.z, rr = c.r * 1.45, q2 = dx * dx + dy * dy + dz * dz;
      if (q2 > rr * rr) continue;
      const p = craterProfile(Math.sqrt(q2) / c.r, c.floor);
      h += p * c.depth;
      if (p < 0) cav = Math.max(cav, -p);
    }
    for (const k of blocks) {
      const dx = b.x - k.c.x, dy = b.y - k.c.y, dz = b.z - k.c.z, q2 = (dx * dx + dy * dy + dz * dz) / (k.r * k.r);
      if (q2 < 1) h += k.h * Math.sqrt(1 - q2);
    }
    const L = b.length();
    o.copy(b).multiplyScalar((L + h) / L);
    return [h, 1 - 0.55 * Math.min(1, cav * 1.3)];
  };
  const geo = sphere.clone(), pos = geo.attributes.position, n = pos.count;
  const aH = new Float32Array(n), aAO = new Float32Array(n), d = new THREE.Vector3(), o = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(sphere.attributes.position, i).normalize();
    const [h, ao] = shape(d, o);
    pos.setXYZ(i, o.x, o.y, o.z);
    aH[i] = h; aAO[i] = ao;
  }
  geo.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  geo.setAttribute('aAO', new THREE.BufferAttribute(aAO, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const surf = (lat, lon, lift = 1.02) => { const v = new THREE.Vector3(); shape(dirLL(lat, lon), v); return v.multiplyScalar(lift); };
  return { geo, marks, surf };
}

// ---------- Oberfläche (Fragment-Shader, eingehängt in MeshStandardMaterial) ----------
const SURF = /* glsl */ `
uniform float uKind, uFeat, uBumpH, uMarkOn;
uniform vec4 uMark[3];
varying vec3 vObj;
varying float vH, vAO;
// Zellen: x = Höhe (Krater mit Wall bzw. bei Bennu Blockkuppeln), y = Helligkeit der nächsten Zelle
vec2 cells(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float h = 0.0, b = 0.5;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)), c = i + g;
    vec3 o = hash3(c) * 0.5 + 0.5;
    float hr = hash13(c + 5.1), r = uKind > 0.5 && uKind < 1.5 ? 0.18 + 0.32 * hr : 0.1 + 0.42 * hr * hr;
    float d = length(g + o - f) / r;
    if (uKind > 0.5 && uKind < 1.5) {
      float dome = sqrt(max(0.0, 1.0 - d * d)) * r;
      if (dome > h) { h = dome; b = hash13(c + 9.7); }
    } else if (d < 1.6 && hash13(c + 2.3) < 0.45) {
      float cav = d < 1.0 ? d * d - 1.0 : 0.0;
      h += (max(cav, -0.65) + 0.28 * exp(-pow((d - 1.05) / 0.18, 2.0))) * r;
    }
  }
  return vec2(h, b);
}
`;
const SURF_MAIN = /* glsl */ `
vec3 sP = vObj * uFeat;
float sFw = length(fwidth(sP));
float sF1 = 1.0 - smoothstep(0.35, 0.9, sFw), sF2 = 1.0 - smoothstep(0.13, 0.33, sFw);
float sN = fbm(vObj * 4.0, 4);
float sG = fbm(sP * 2.5, 3) * (1.0 - smoothstep(0.15, 0.5, sFw));
vec2 sC1 = cells(sP), sC2 = cells(sP * 2.7 + 11.0);
float sHF, sRgh, sMtl, sMark = 0.0;
vec3 sCol;
if (uKind < 0.5) {
  // Psyche: bläulich-graues Metall, bronzefarbene Gesteinsflecken auf Höhen und Wällen (nach der Darstellung der NASA)
  sHF = sC1.x * sF1 + sC2.x * 0.4 * sF2 + sG * 0.12;
  float patchy = smoothstep(0.0, 0.35, fbm(vObj * 2.6 + 4.0, 4));
  sCol = mix(vec3(0.08, 0.095, 0.14), vec3(0.2, 0.23, 0.31), smoothstep(-0.35, 0.45, sG * 2.0 + sN));
  float hi = smoothstep(-0.012, 0.02, vH + 0.015 * sN);
  vec3 bronze = mix(vec3(0.3, 0.18, 0.1), vec3(0.52, 0.36, 0.21), smoothstep(-0.2, 0.4, sG * 2.0 + sN));
  sCol = mix(sCol, bronze, patchy * (0.3 + 0.7 * hi));
  sMtl = mix(0.75, 0.15, patchy);
  sRgh = mix(0.55, 0.85, patchy);
  if (uMarkOn > 0.5) for (int k = 0; k < 3; k++) {
    float dd = length(vObj - uMark[k].xyz) - uMark[k].w, w = fwidth(dd) * 1.2 + 0.003;
    sMark = max(sMark, 1.0 - smoothstep(w * 0.5, w * 1.5, abs(dd)));
  }
} else if (uKind < 1.5) {
  // Bennu: sehr dunkles Geröll, einzelne helle Blöcke
  sHF = sC1.x * 1.3 * sF1 + sC2.x * 0.6 * sF2 + sG * 0.1;
  sCol = vec3(0.05, 0.046, 0.042) * (0.65 + 0.7 * sC1.y) * (0.85 + 0.5 * sG);
  sCol = mix(sCol, vec3(0.2, 0.19, 0.17), step(0.94, sC1.y) * sF1 * 0.85);
  sMtl = 0.0; sRgh = 0.95;
} else {
  // Eros: beigegraues Silikatgestein, helleres Regolith an Kraterwänden, rostige Flecken
  sHF = sC1.x * sF1 + sC2.x * 0.5 * sF2 + sG * 0.15;
  sCol = mix(vec3(0.24, 0.2, 0.155), vec3(0.4, 0.35, 0.28), smoothstep(-0.35, 0.45, sG * 2.0 + sN));
  sCol = mix(sCol, vec3(0.5, 0.45, 0.37), (1.0 - vAO) * 0.7);
  sCol = mix(sCol, vec3(0.48, 0.2, 0.06), smoothstep(0.32, 0.48, fbm(vObj * 4.5 + 2.0, 3)) * 0.65);
  sMtl = 0.0; sRgh = 0.9;
}
sHF *= uBumpH;
diffuseColor.rgb = sCol;
`;
// Bump ohne Tangenten (Mikkelsen 2010, wie three.js perturbNormalArb), Höhe sHF in Weltmaß
const BUMP = /* glsl */ `
vec3 sPos = -vViewPosition, sDx = dFdx(sPos), sDy = dFdy(sPos);
float sHx = dFdx(sHF), sHy = dFdy(sHF);
vec3 sR1 = cross(sDy, normal), sR2 = cross(normal, sDx);
float sDet = dot(sDx, sR1);
normal = normalize(abs(sDet) * normal - sign(sDet) * (sHx * sR1 + sHy * sR2));
`;

function makeMaterial() {
  const u = {
    uKind: { value: 0 }, uFeat: { value: 16 }, uBumpH: { value: 0.03 }, uMarkOn: { value: 0 },
    uMark: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aH;\nattribute float aAO;\nvarying vec3 vObj;\nvarying float vH, vAO;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position; vH = aH; vAO = aAO;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}\n${SURF}`)
      .replace('#include <map_fragment>', SURF_MAIN)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = sRgh;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = sMtl;')
      .replace('#include <normal_fragment_maps>', BUMP)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.25, 0.75, 1.0) * sMark * 0.5;')
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= vAO;\nreflectedLight.indirectSpecular *= vAO;');
  };
  return { m, u };
}

function sunTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.07, 'rgba(255,247,232,1)');
  gr.addColorStop(0.22, 'rgba(255,222,176,0.3)');
  gr.addColorStop(1, 'rgba(255,200,140,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 3000);
  const stars = createStarfield({ gain: 0.7, seed: 29 });
  scene.add(stars);

  // Schattenwurf: nur diese Station nutzt Lichter mit Schatten; beim Verlassen wieder aus
  const prevShadow = ctx.renderer.shadowMap.enabled, prevType = ctx.renderer.shadowMap.type;
  ctx.renderer.shadowMap.enabled = true;
  ctx.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sphere = icoIndexed(Math.round(44 + 46 * ctx.detail));
  const mat = makeMaterial();
  const mesh = new THREE.Mesh(sphere, mat.m);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);

  const sun = new THREE.DirectionalLight(0xfff4e6, 3.4);
  const ms = ctx.detail >= 0.8 ? 2048 : 1024;
  sun.castShadow = true;
  sun.shadow.mapSize.set(ms, ms);
  Object.assign(sun.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, near: 0.5, far: 9 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.012;
  const fill = new THREE.DirectionalLight(0x5a7cc8, 0.35);   // bläuliches Gegenlicht (künstlerisch)
  const hemi = new THREE.HemisphereLight(0x33476e, 0x0b0d14, 0.22);
  scene.add(sun, sun.target, fill, hemi);

  const sunTex = sunTexture();
  const sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: new THREE.Color(4, 3.8, 3.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sunSp.scale.setScalar(30);
  scene.add(sunSp);
  const flare = createFlare({ strength: 0.4 });
  scene.add(flare);
  const sunDir = new THREE.Vector3(), sunPos = new THREE.Vector3();
  let sunAz = 255;   // Streiflicht von links oben, aus Sicht der Heimpose
  function placeSun() {
    sunDir.copy(dirLL(30, sunAz));
    sun.position.copy(sunDir).multiplyScalar(4);
    fill.position.copy(sunDir).multiplyScalar(-4).add(new THREE.Vector3(0, 1.5, 0));
    sunPos.copy(sunDir).multiplyScalar(600);
    sunSp.position.copy(sunPos);
  }
  placeSun();

  // ---------- Bennu: Steinchen-Auswürfe ----------
  const EJ = 360, LIFE = 14, GM = 0.012;
  const ejPos = new Float32Array(EJ * 3), ejCol = new Float32Array(EJ * 3), ejVel = new Float32Array(EJ * 3), ejAge = new Float32Array(EJ).fill(LIFE);
  const ejGeo = new THREE.BufferGeometry();
  ejGeo.setAttribute('position', new THREE.BufferAttribute(ejPos, 3));
  ejGeo.setAttribute('color', new THREE.BufferAttribute(ejCol, 3));
  const ejMat = new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const ej = new THREE.Points(ejGeo, ejMat);
  ej.frustumCulled = false;
  scene.add(ej);
  const rnd = mulberry32(7);
  let ejOn = true, ejRate = 1, ejTimer = 2, ejNext = 0;
  const tmp = new THREE.Vector3(), nrm = new THREE.Vector3();
  function burst() {
    if (!cur) return;
    const p = cur.surf(Math.asin(rnd() * 2 - 1) / RAD, rnd() * 360, 1.0).applyAxisAngle(Y, angle);
    nrm.copy(p).normalize();
    const n = 25 + Math.floor(rnd() * 30);
    for (let k = 0; k < n; k++) {
      const i = ejNext;
      ejNext = (ejNext + 1) % EJ;
      tmp.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.1).add(nrm).normalize().multiplyScalar(0.04 + 0.22 * rnd() ** 1.5);
      ejPos.set([p.x, p.y, p.z], i * 3);
      ejVel.set([tmp.x, tmp.y, tmp.z], i * 3);
      ejAge[i] = 0;
    }
  }
  function stepEjecta(dt) {
    for (let i = 0; i < EJ; i++) {
      if (ejAge[i] >= LIFE) { ejCol[i * 3] = ejCol[i * 3 + 1] = ejCol[i * 3 + 2] = 0; continue; }
      const j = i * 3, x = ejPos[j], y = ejPos[j + 1], z = ejPos[j + 2], r2 = x * x + y * y + z * z, r = Math.sqrt(r2);
      const g = GM / (r2 * r);
      ejVel[j] -= x * g * dt; ejVel[j + 1] -= y * g * dt; ejVel[j + 2] -= z * g * dt;
      ejPos[j] += ejVel[j] * dt; ejPos[j + 1] += ejVel[j + 1] * dt; ejPos[j + 2] += ejVel[j + 2] * dt;
      ejAge[i] += dt;
      if (r < 0.86 && ejAge[i] > 0.5) ejAge[i] = LIFE;   // zurückgefallen
      const f = Math.max(0, 1 - ejAge[i] / LIFE) * Math.min(1, ejAge[i] * 4) * 0.9;
      ejCol[j] = f; ejCol[j + 1] = f * 0.93; ejCol[j + 2] = f * 0.85;
    }
    ejGeo.attributes.position.needsUpdate = true;
    ejGeo.attributes.color.needsUpdate = true;
  }

  // ---------- Körper wechseln ----------
  const cache = {};
  const look = { exposure: 1.0, bloom: 0.06 };
  let bodyId = 'psyche', B = BODIES.psyche, cur = null, angle = 0;
  const SPEEDS = [[60, '1 min/s'], [600, '10 min/s'], [3600, '1 h/s']];
  let spinIdx = 1, spinning = true;
  const HS = {
    psyche: [['psyche-metal', 18, 40], ['psyche-basin', -65, 290], ['psyche-mission', null]],
    bennu: [['bennu-pile', 8, 60], ['bennu-sample', 56, 150], ['bennu-ejecta', null]],
    eros: [['eros-shape', 0, 0], ['eros-near', 5, -90]],
  };
  const hotspots = [];
  for (const [body, list] of Object.entries(HS)) {
    for (const [id, lat, lon] of list) {
      const free = lat === null;
      hotspots.push({ id, kind: 'info', pos: free ? new THREE.Vector3(0.95, 0.85, 0.75) : new THREE.Vector3(), local: new THREE.Vector3(), lat, lon, free, body, visible: () => bodyId === body, listIf: () => bodyId === body });
    }
  }
  function layersFor(id) {
    const L = [
      { id: 'spin', type: 'play', group: 'Zeit', label: 'Drehung', value: spinIdx, min: 0, max: SPEEDS.length - 1, step: 1, autoplay: true, fmt: (i) => SPEEDS[Math.round(i)][1],
        set: (i, p) => { spinIdx = Math.round(i); spinning = p; }, get: () => ({ value: spinIdx, playing: spinning }),
        status: () => `${B.name} · eine Umdrehung in ${fmtH(B.period)}` },
      { id: 'sunAz', type: 'range', group: 'Licht', label: 'Sonnenstand', value: sunAz, min: 0, max: 355, step: 5, unit: '°', set: (v) => { sunAz = v; placeSun(); } },
      { id: 'shadows', type: 'toggle', label: 'Schlagschatten der Sonne', value: true, set: (v) => { sun.castShadow = v; } },
      { id: 'fill', type: 'toggle', label: 'Blaues Fülllicht (künstlerisch)', value: true, set: (v) => { fill.visible = v; } },
    ];
    if (id === 'psyche') L.push({ id: 'marks', type: 'toggle', group: 'Besonderheiten', label: 'Senken aus dem Radarmodell markieren', value: false, set: (v) => { mat.u.uMarkOn.value = v ? 1 : 0; } });
    if (id === 'bennu') {
      L.push(
        { id: 'ejecta', type: 'toggle', group: 'Besonderheiten', label: 'Steinchen-Auswürfe (beobachtet 2019)', value: true, set: (v) => { ejOn = v; ej.visible = v; } },
        { id: 'ejRate', type: 'range', label: 'Häufigkeit', value: 1, min: 0.3, max: 3, step: 0.1, unit: '×', sub: true, set: (v) => { ejRate = v; } },
        { id: 'ejNow', type: 'action', label: 'Auswurf', button: 'Jetzt auslösen', sub: true, run: () => { if (ejOn) burst(); } },
      );
    }
    return L;
  }
  function setBody(id) {
    if (!BODIES[id]) return;
    bodyId = id;
    B = BODIES[id];
    if (!cache[id]) cache[id] = makeBody(id, sphere);
    cur = cache[id];
    mesh.geometry = cur.geo;
    mat.u.uKind.value = B.kind;
    mat.u.uFeat.value = B.feat;
    mat.u.uBumpH.value = 0.45 / B.feat;
    cur.marks.forEach((k, i) => mat.u.uMark.value[i].set(k.c.x, k.c.y, k.c.z, k.r));
    for (const h of hotspots) if (h.body === id && !h.free) h.local.copy(cur.surf(h.lat, h.lon));
    look.exposure = B.exposure;
    ejAge.fill(LIFE);
    registerLayers('asteroid', layersFor(id));
    ej.visible = id === 'bennu' && ejOn;
  }
  setBody('psyche');

  const controls = [
    { id: 'body', label: 'Körper', value: 'psyche', options: [['psyche', 'Psyche'], ['bennu', 'Bennu'], ['eros', 'Eros']], set: (v) => setBody(v) },
  ];
  const occ = [{ center: new THREE.Vector3(), radius: 0.8 }];
  let wT = -1;

  return {
    scene, camera, hotspots, controls, look,
    get unit() { return B.a * 1000; },
    home: { pos: new THREE.Vector3(2.6, 0.9, 3.0), target: new THREE.Vector3(0, 0, 0) },
    orbit: { minDistance: 1.3, maxDistance: 16, cineSpeed: 0.5 },
    update(dt, t, cam) {
      if (spinning && !ctx.still) angle += dt * SPEEDS[spinIdx][0] * 2 * Math.PI / (B.period * 3600);
      mesh.rotation.y = angle;
      for (const h of hotspots) if (h.body === bodyId && !h.free) h.pos.copy(h.local).applyAxisAngle(Y, angle);
      if (bodyId === 'bennu' && ejOn) {
        if (!ctx.still) { ejTimer -= dt * ejRate; if (ejTimer <= 0) { burst(); ejTimer = 5 + rnd() * 9; } }
        stepEjecta(Math.min(dt, 0.05));
      }
      occ[0].radius = bodyId === 'eros' ? 0.45 : 0.8;
      flare.userData.update(sunPos, cam, occ, settings.S.lens, dt);
    },
    widget: () => `<table><thead><tr><th>Körper</th><th>Größe</th><th>Umdrehung</th></tr></thead><tbody>
      <tr data-b="psyche"><td>Psyche</td><td class="num">278 × 238 × 171 km</td><td class="num">4 h 12 min</td></tr>
      <tr data-b="bennu"><td>Bennu</td><td class="num">≈ 490 m</td><td class="num">4 h 18 min</td></tr>
      <tr data-b="eros"><td>Eros</td><td class="num">33 × 13 × 13 km</td><td class="num">5 h 16 min</td></tr></tbody></table>
      <p class="w-foot">Psyche: Radarmodell (Shepard 2021) · Bennu, Eros: NASA NSSDCA · Missionen: NASA Science.</p>`,
    widgetTick(el, t) {
      if (t - wT < 0.5) return;
      wT = t;
      el.querySelectorAll('tr[data-b]').forEach((tr) => tr.classList.toggle('is-hi', tr.dataset.b === bodyId));
    },
    live: () => `${B.name} · ${B.size} · eine Umdrehung in ${fmtH(B.period)}${spinning ? ` · Zeitraffer ${SPEEDS[spinIdx][1]}` : ''}`,
    setPixelRatio(pr) { stars.userData.setPixelRatio(pr); ejMat.size = 2.4 * pr; },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      Object.values(cache).forEach((c) => c.geo.dispose());
      sphere.dispose();
      sunTex.dispose();
      ctx.renderer.shadowMap.enabled = prevShadow;
      ctx.renderer.shadowMap.type = prevType;
    },
  };
}
