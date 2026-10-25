// Satelliten und Trümmer um die Erde als Punktwolke: Bahnelemente aus web/data/sats.json (CelesTrak-Schnappschuss,
// tools/fetch_sats.py), Fortschreibung Kepler + J2 im Vertex-Shader (gleiche Formeln wie orbit.js), Farbe nach Art
// (Nutzlast · Starlink · Trümmer · Station). Koordinaten: erdfestes Inertialsystem (x Frühlingspunkt, z Pol) → lokale
// Achsen der Erd-Kippgruppe (x, z, −y) in 1.000 km. Bahnlinien einzelner Objekte (ISS, Tiangong, Hubble) rechnet die CPU.

import * as THREE from 'three';
import { propagate, periodMin } from './orbit.js';

export const KIND = ['Nutzlast', 'Starlink', 'Trümmer', 'Station'];
export const KIND_COLOR = ['#ffe9c4', '#8fc6ff', '#ff8a5c', '#f3b552'];
let dataP = null;
export function loadSats() {
  return (dataP ||= fetch('data/sats.json').then((r) => { if (!r.ok) throw new Error(`sats.json: HTTP ${r.status}`); return r.json(); }));
}
export const namedIndex = (data, name) => +(Object.entries(data.named).find(([, n]) => n === name) || [-1])[0];

const VERT = /* glsl */ `
attribute vec4 el;    // a km, e, i rad, Ω rad
attribute vec4 el2;   // ω rad, M0 rad, Δt Tage, Art
uniform float uDays, uPx, uScale, uShow0, uShow1, uShow2, uShow3;
varying vec3 vCol;
varying float vA;
const float MU = 398600.4418, J2 = 1.08262668e-3, RE = 6378.137;
void main() {
  float a = el.x, e = el.y, i = el.z;
  float n = sqrt(MU / (a * a * a)), p = a * (1.0 - e * e), k = 1.5 * J2 * (RE / p) * (RE / p), ci = cos(i), si = sin(i);
  float s = (uDays - el2.z) * 86400.0;
  float raan = el.w - k * n * ci * s;
  float argp = el2.x + 0.5 * k * n * (5.0 * ci * ci - 1.0) * s;
  float M = mod(el2.y + n * (1.0 + 0.5 * k * sqrt(1.0 - e * e) * (3.0 * ci * ci - 1.0)) * s, 6.2831853);
  float E = M;
  for (int j = 0; j < 6; j++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  float xp = a * (cos(E) - e), yp = a * sqrt(1.0 - e * e) * sin(E);
  float co = cos(argp), so = sin(argp), cO = cos(raan), sO = sin(raan);
  vec3 q = vec3((co * cO - so * sO * ci) * xp + (-so * cO - co * sO * ci) * yp,
                (co * sO + so * cO * ci) * xp + (-so * sO + co * cO * ci) * yp,
                so * si * xp + co * si * yp) * uScale;
  vec4 mv = modelViewMatrix * vec4(q.x, q.z, -q.y, 1.0);
  gl_Position = projectionMatrix * mv;
  int kind = int(el2.w + 0.5);
  float show = kind == 0 ? uShow0 : kind == 1 ? uShow1 : kind == 2 ? uShow2 : uShow3;
  float d = max(-mv.z, 0.05), near = clamp(12.0 / d, 0.0, 1.0);
  // Punkte klein und schwach: 19.000 additive Punkte summieren sich sonst zu einer weißen Wolke; Stationen (ISS) hell
  float base = kind == 3 ? 7.0 : kind == 2 ? 1.4 : 1.7;
  gl_PointSize = uPx * base * (0.75 + 1.3 * near) * show;
  vA = show * (kind == 3 ? 1.0 : 0.07 + 0.3 * near * near);
  vCol = kind == 0 ? vec3(1.0, 0.91, 0.77) : kind == 1 ? vec3(0.56, 0.78, 1.0) : kind == 2 ? vec3(1.0, 0.54, 0.36) : vec3(0.95, 0.71, 0.32);
}
`;
const FRAG = /* glsl */ `
uniform float uGain;
varying vec3 vCol;
varying float vA;
void main() {
  if (vA <= 0.001) discard;
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  gl_FragColor = vec4(vCol * exp(-r2 * 18.0) * vA * uGain, 1.0);
}
`;

const RAD = Math.PI / 180;
export function createSats(data, { unit = 1e-3 } = {}) {
  const n = data.obj.length;
  const el = new Float32Array(n * 4), el2 = new Float32Array(n * 4);
  data.obj.forEach((o, i) => {
    el.set([o[0], o[1], o[2] * RAD, o[3] * RAD], i * 4);
    el2.set([o[4] * RAD, o[5] * RAD, o[6], o[7]], i * 4);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('el', new THREE.BufferAttribute(el, 4));
  g.setAttribute('el2', new THREE.BufferAttribute(el2, 4));
  const u = { uDays: { value: 0 }, uPx: { value: 1 }, uScale: { value: unit }, uGain: { value: 0.8 }, uShow0: { value: 1 }, uShow1: { value: 1 }, uShow2: { value: 1 }, uShow3: { value: 1 } };
  const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.userData = {
    count: n,
    update: (days) => { u.uDays.value = days; },
    setShow: (kind, on) => { u[`uShow${kind}`].value = on ? 1 : 0; },
    setPixelRatio: (pr) => { u.uPx.value = pr; },
  };
  return pts;
}

// Ort eines Objekts in lokalen Achsen der Kippgruppe [1.000 km]
export function satPos(o, days, out = new THREE.Vector3(), unit = 1e-3) {
  const [x, y, z] = propagate(o, days);
  return out.set(x * unit, z * unit, -y * unit);
}

// Bahnlinie eines Objekts: ein voller Umlauf ab `days`, als geschlossene Linie; userData.update(days) zeichnet sie neu
export function orbitLine(o, color, opacity = 0.5, segs = 180) {
  const pos = new Float32Array((segs + 1) * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  line.frustumCulled = false;
  const P = periodMin(o[0]) / 1440, v = new THREE.Vector3();
  line.userData.update = (days) => {
    for (let i = 0; i <= segs; i++) { satPos(o, days + (i / segs) * P, v); pos.set([v.x, v.y, v.z], i * 3); }
    g.attributes.position.needsUpdate = true;
  };
  line.userData.update(0);
  return line;
}
