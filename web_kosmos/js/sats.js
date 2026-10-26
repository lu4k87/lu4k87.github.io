// Satelliten und Trümmer um die Erde als Punktwolke: Bahnelemente aus web/data/sats.json (CelesTrak-Schnappschuss,
// tools/fetch_sats.py), Fortschreibung Kepler + J2 im Vertex-Shader (gleiche Formeln wie orbit.js), Farbe nach Art
// (Nutzlast · Starlink · Trümmer · Station). Koordinaten: erdfestes Inertialsystem (x Frühlingspunkt, z Pol) → lokale
// Achsen der Erd-Kippgruppe (x, z, −y) in 1.000 km. Bahnlinien einzelner Objekte (ISS, Tiangong, Hubble) rechnet die CPU.

import * as THREE from 'three';
import { propagate, periodMin } from './orbit.js';
import { settings } from './settings.js';

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
attribute float seed; // 0–1 je Objekt: Ausdünnen und Drehlage des Symbols
uniform float uDays, uPx, uScale, uMag, uKeep, uShow0, uShow1, uShow2, uShow3;
uniform vec3 uSunL;   // Richtung zur Sonne in lokalen Achsen (0 = ohne Erdschatten)
varying vec3 vCol;
varying float vA, vPx, vRot, vKind, vLit;
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
  // Erdschatten als Zylinder hinter der Erde mit weichem Rand (Halbschatten ≈ 1–2 % des Radius)
  vec3 pl = vec3(q.x, q.z, -q.y);
  float sp = dot(pl, uSunL);
  vLit = (dot(uSunL, uSunL) < 0.5 || sp > 0.0) ? 1.0 : smoothstep(RE * uScale * 0.985, RE * uScale * 1.02, length(pl - sp * uSunL));
  gl_Position = projectionMatrix * mv;
  int kind = int(el2.w + 0.5);
  float show = kind == 0 ? uShow0 : kind == 1 ? uShow1 : kind == 2 ? uShow2 : uShow3;
  // Vergrößerung uMag (Zahnrad „Satelliten und Kleinkörper“): je größer, desto kleiner der gezeigte Anteil uKeep; Stationen immer
  if (kind != 3 && seed > uKeep) show = 0.0;
  float d = max(-mv.z, 0.05), near = clamp(12.0 / d, 0.0, 1.0), big = smoothstep(1.0, 4.0, uMag);
  float base = kind == 3 ? 7.0 + 3.0 * (uMag - 1.0) : (kind == 2 ? 1.4 : 1.7) * uMag * (1.0 + 0.4 * big);
  vPx = uPx * base * (0.75 + 1.3 * near);
  gl_PointSize = vPx * show;
  // bei 1× klein und schwach (19.000 additive Punkte ergäben sonst eine weiße Wolke), vergrößert und ausgedünnt deutlich
  vA = show * (kind == 3 ? 1.0 : mix(0.07 + 0.3 * near * near, 0.85 + 0.15 * near, big));
  vRot = seed * 40.0;
  vKind = float(kind);
  vCol = kind == 0 ? vec3(1.0, 0.91, 0.77) : kind == 1 ? vec3(0.56, 0.78, 1.0) : kind == 2 ? vec3(1.0, 0.54, 0.36) : vec3(0.95, 0.71, 0.32);
}
`;
const FRAG = /* glsl */ `
uniform float uGain;
varying vec3 vCol;
varying float vA, vPx, vRot, vKind, vLit;
float box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main() {
  if (vA <= 0.001) discard;
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  // ab etwa 7 Pixeln ein Symbol statt Lichtpunkt, in zufälliger Drehlage; ab ≈ 20 Pixeln Feinheiten (Zellraster der
  // Solarflügel, Antenne, Radiatoren, Bruchkanten). Formen schematisch nach Bauart:
  // Nutzlast = Bus mit Goldfolie, Parabolantenne, zwei Flügel am Ausleger · Starlink = flacher Bus, ein langer Flügel ·
  // Station = Gitterträger, Module, vier Flügelpaare, Radiatoren · Trümmer = Splitter mit zwei Flächen
  float c = cos(vRot), s = sin(vRot), aa = 3.0 / max(vPx, 1.0), det = smoothstep(14.0, 26.0, vPx);
  vec2 q = mat2(c, -s, s, c) * p;
  float hull = 0.0, wing = 0.0, extra = 0.0;
  vec2 wq = vec2(0.0), cells = vec2(4.0, 2.0);
  vec3 hullCol = vCol * 1.15, extraCol = vec3(0.92);
  #define FILL(d) (1.0 - smoothstep(-aa, aa, (d)))
  if (vKind > 2.5) {
    hull = FILL(min(min(box(q, vec2(0.92, 0.035)), box(q - vec2(0.0, -0.12), vec2(0.09, 0.3))), box(q - vec2(0.0, -0.3), vec2(0.28, 0.06))));
    vec2 w = vec2(abs(q.x) - 0.6, abs(q.y) - 0.3);
    wing = FILL(box(w, vec2(0.22, 0.16)));
    wq = w / vec2(0.22, 0.16); cells = vec2(4.0, 3.0);
    extra = FILL(box(vec2(abs(q.x) - 0.24, q.y - 0.17), vec2(0.035, 0.13))) * det;
  } else if (vKind > 1.5) {
    vec2 k = q * vec2(1.0, 1.6);
    hull = FILL(max(abs(k.x) * 0.866 + k.y * 0.5, -k.y) - 0.42);
    hullCol = mix(vCol * 0.7, vCol * 1.25, step(0.0, k.x + 0.25 * k.y));
    hullCol *= mix(1.0, 0.75 + 0.5 * fract(sin(dot(floor(k * 6.0), vec2(12.9, 78.2))) * 43758.5), det);
  } else if (vKind > 0.5) {
    hull = FILL(min(box(q - vec2(-0.48, 0.0), vec2(0.22, 0.12)), box(q - vec2(-0.2, 0.0), vec2(0.08, 0.025))));
    hullCol = mix(vCol * 1.15, vec3(0.55, 0.6, 0.68), det * 0.6);
    vec2 w = q - vec2(0.36, 0.0);
    wing = FILL(box(w, vec2(0.48, 0.13)));
    wq = w / vec2(0.48, 0.13); cells = vec2(7.0, 2.0);
  } else {
    hull = FILL(min(box(q, vec2(0.17, 0.21)), box(q, vec2(0.38, 0.025))));
    hullCol = mix(vCol * 1.15, mix(vec3(0.95, 0.72, 0.3), vCol, 0.35), det);
    vec2 w = vec2(abs(q.x) - 0.66, q.y);
    wing = FILL(box(w, vec2(0.28, 0.16)));
    wq = w / vec2(0.28, 0.16); cells = vec2(4.0, 2.0);
    extra = FILL(length(q - vec2(0.0, 0.33)) - 0.13) * det;
  }
  // Solarflügel: dunkelblau mit Zellraster und Glanzverlauf je Drehlage
  vec2 cg = abs(fract((wq * 0.5 + 0.5) * cells) - 0.5);
  float grid = (1.0 - smoothstep(0.32, 0.46, max(cg.x, cg.y))) * det;
  vec3 wingCol = vec3(0.22, 0.38, 0.85) * (0.8 + 0.35 * sin(vRot * 3.0 + wq.x * 1.2 + wq.y)) * (1.0 - 0.55 * grid);
  float k = smoothstep(5.0, 9.0, vPx);
  vec3 sym = mix(wingCol, hullCol, hull);
  sym = mix(sym, extraCol, extra * (1.0 - hull));
  vec3 col = mix(vCol, sym, k) * mix(0.2, 1.0, vLit);
  // deckend gemischt, damit Symbole auch vor der hellen Tagseite stehen; Lichtpunkt auf Schwarz wirkt wie additiv
  gl_FragColor = vec4(col * uGain, mix(exp(-r2 * 4.5), max(max(hull, wing), extra), k) * vA * mix(0.45, 1.0, vLit));
}
`;

const RAD = Math.PI / 180;
// Gezeigter Anteil bei Vergrößerung m: Fläche je Symbol wächst mit m², Anteil fällt mit m^1,5 (4× → jedes achte Objekt)
export const keepShare = (m) => Math.min(1, m ** -1.5);
export function createSats(data, { unit = 1e-3 } = {}) {
  const n = data.obj.length;
  const el = new Float32Array(n * 4), el2 = new Float32Array(n * 4), seed = new Float32Array(n);
  data.obj.forEach((o, i) => {
    el.set([o[0], o[1], o[2] * RAD, o[3] * RAD], i * 4);
    el2.set([o[4] * RAD, o[5] * RAD, o[6], o[7]], i * 4);
    seed[i] = (i * 0.6180339887) % 1;   // goldener Schnitt: jeder Ausschnitt gleichmäßig verteilt
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('el', new THREE.BufferAttribute(el, 4));
  g.setAttribute('el2', new THREE.BufferAttribute(el2, 4));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const u = { uDays: { value: 0 }, uPx: { value: 1 }, uScale: { value: unit }, uMag: { value: 1 }, uKeep: { value: 1 }, uGain: { value: 0.8 }, uShow0: { value: 1 }, uShow1: { value: 1 }, uShow2: { value: 1 }, uShow3: { value: 1 }, uSunL: { value: new THREE.Vector3() } };
  const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, blending: THREE.NormalBlending, depthWrite: false, transparent: true });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.userData = {
    count: n,
    update: (days) => { u.uDays.value = days; u.uMag.value = settings.S.small; u.uKeep.value = keepShare(settings.S.small); },
    setShow: (kind, on) => { u[`uShow${kind}`].value = on ? 1 : 0; },
    setPixelRatio: (pr) => { u.uPx.value = pr; },
    setSun: (dirLocal) => { u.uSunL.value.copy(dirLocal); },
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
