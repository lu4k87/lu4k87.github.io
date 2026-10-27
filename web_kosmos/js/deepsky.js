// Tiefer Himmel: was eine lange Belichtung hinter den Sternen zeigt – ferne Galaxien (Tiefenfeld), schwach leuchtender
// Staub der Milchstraße (galaktischer Zirrus, „integrated flux nebula“) und ein Hauch Restlicht statt reinem Schwarz.
// Bei unendlicher Entfernung wie der Sternhimmel (Tiefe = Fernebene), je Station abgestimmt (DEEP), Stärke im Zahnrad.
// Darstellung: fürs Auge viel zu schwach (Galaxien ≈ 20–25 mag, Zirrus ≈ 26 mag/″²) – überhöht wie in einem Astrofoto.

import * as THREE from 'three';
import { eclDir, mulberry32, gauss, blackbody } from './astro.js';
import { NOISE, SKY_VERTEX } from './glsl.js';
import { settings, onSettings } from './settings.js';

// Galaktische Lage je Station (gleiche Richtungen wie createStarfield in levels/<id>.js): ngp = Nordpol, gc = Zentrum.
// cirrus/gal = Stärke der Ebenen; outside = Blick von außerhalb der Milchstraße (kein Zirrus, keine Vermeidungszone).
// Im Sonnensystem überall derselbe echte Himmel (ekliptikale Lage, gleicher Seed). Ohne Eintrag (sgra, web, cmb, bigbang)
// bleibt der Hintergrund, wie die Station ihn zeichnet – dort wirkt der Regler nicht.
const ECL = { ngp: eclDir(180.02, 29.81), gc: eclDir(266.84, -5.54), cirrus: 1, gal: 1, seed: 3 };
const SOLAR_SYSTEM = ['earth', 'hubble', 'jwst', 'euclid', 'roman', 'solar', 'sun', 'iss', 'tiangong', 'moon',
  'jupiter', 'io', 'europa', 'ganymede', 'callisto', 'saturn', 'titan', 'enceladus', 'mars', 'phobos', 'deimos',
  'neptune', 'triton', 'uranus', 'miranda', 'pluto'];
const DEEP = {
  ...Object.fromEntries(SOLAR_SYSTEM.map((id) => [id, ECL])),
  orion: { ngp: [0.2, 0.9, 0.3], gc: [0.9, 0, -0.4], cirrus: 1, gal: 1, seed: 5 },
  crab: { ngp: [0.1, 0.95, -0.2], gc: [-0.2, -0.1, -1], cirrus: 1, gal: 1, seed: 7 },
  asteroid: { cirrus: 1, gal: 1, seed: 11 },   // Sternfeld dort ohne galaktische Lage (Standard-Achsen)
  pulsar: { cirrus: 1, gal: 1, seed: 11 },
  galaxy: { outside: true, cirrus: 0, gal: 1.4, seed: 9 },
  local: { outside: true, cirrus: 0, gal: 0.8, seed: 13 },
};

const SKY_VERT = /* glsl */ `
${SKY_VERTEX}
varying vec3 vDir;
void main() { vDir = position; gl_Position = skyPosition(normalize(position)); }
`;
// Restlicht: großräumig kühl ↔ warm getönt · Zirrus: fädige Staubwolken (Grat-Rauschen) in Feldern (fBm), vor allem in
// mittleren galaktischen Breiten; bräunlich-grau, dünne Fäden etwas bläulich (gestreutes Sternlicht)
const SKY_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uNgp;
uniform float uFloor, uCirrus;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float w = 0.5 + 0.5 * gnoise(d * 1.7);
  vec3 col = mix(vec3(0.55, 0.68, 1.0), vec3(1.0, 0.8, 0.62), w) * (0.75 + 0.25 * gnoise(d * 3.3 + 5.0)) * uFloor;
  if (uCirrus > 0.0) {
    float sb = dot(d, uNgp);
    float lat = exp(-pow(sb / 0.6, 2.0)) * (1.0 - 0.5 * exp(-pow(sb / 0.1, 2.0)));
    float field = smoothstep(0.02, 0.42, fbm(d * 2.3 + 11.0, 4));
    float fil = ridged(d * 7.0 + 3.0, 5);
    float cir = field * fil * fil * fil * lat;
    col += mix(vec3(0.95, 0.82, 0.68), vec3(0.72, 0.78, 0.92), smoothstep(0.6, 0.95, fil)) * cir * uCirrus;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

// Ferne Galaxien als Punktbilder: Spiralen als geneigte Exponentialscheibe mit gelblichem Kern (große mit angedeuteten
// Armen), elliptische steil zur Mitte und warm; Lagewinkel und Neigung zufällig
const GAL_VERT = /* glsl */ `
${SKY_VERTEX}
attribute vec3 color;
attribute vec4 shape;   // Größe (px), Achsenverhältnis, Lagewinkel, Spirale (0/1)
uniform float uPx, uGain;
varying vec3 vCol;
varying vec4 vShape;
void main() {
  gl_Position = skyPosition(position);
  gl_PointSize = shape.x * uPx;
  vCol = color * uGain;
  vShape = vec4(shape.x * uPx, shape.yzw);
}
`;
const GAL_FRAG = /* glsl */ `
varying vec3 vCol;
varying vec4 vShape;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float c = cos(vShape.z), s = sin(vShape.z);
  p = mat2(c, -s, s, c) * p;
  p.y /= vShape.y;
  float r = length(p);
  float arms = 1.0 + vShape.w * smoothstep(10.0, 18.0, vShape.x) * 0.5 * cos(2.0 * atan(p.y, p.x) - 7.0 * log(r + 0.08));
  vec3 spiral = vCol * exp(-5.0 * r) * arms + vec3(1.0, 0.82, 0.6) * length(vCol) * 0.5 * exp(-r * r * 80.0);
  vec3 ell = vCol * exp(-5.0 * sqrt(r));
  gl_FragColor = vec4(mix(ell, spiral, vShape.w) * (1.0 - smoothstep(0.6, 1.0, r)), 1.0);
}
`;

function galaxies(cfg, n, rand) {
  const ngp = new THREE.Vector3(...(cfg.ngp || [0, 1, 0])).normalize();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), shape = new Float32Array(n * 4);
  // ein Drittel sitzt in Gruppen und Haufen (≈ 1–2° groß) – das echte Tiefenfeld ist nicht gleichmäßig
  const centers = Array.from({ length: 60 }, () => new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize());
  const d = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    for (;;) {
      if (rand() < 0.35) d.copy(centers[Math.floor(rand() * centers.length)]).add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(0.025));
      else d.set(gauss(rand), gauss(rand), gauss(rand));
      d.normalize();
      // Vermeidungszone: der Staub der Milchstraße verdeckt ferne Galaxien nahe ihrer Ebene
      const sb = Math.abs(d.dot(ngp));
      if (cfg.outside || rand() < THREE.MathUtils.smoothstep(sb, 0.08, 0.4)) break;
    }
    pos.set([d.x, d.y, d.z], i * 3);
    // viele kleine, schwache; wenige größere
    const b = Math.pow(rand(), 3), spiral = rand() < 0.6;
    const T = spiral ? 6000 + rand() * 6000 : 4000 + rand() * 1200;
    const peak = 0.06 + 0.22 * b;
    col.set(blackbody(T).map((x) => (0.5 + 0.5 * x) * peak), i * 3);
    const size = 5 + 10 * b + (rand() < 0.03 ? 8 + 14 * rand() : 0);
    shape.set([size, spiral ? 0.2 + 0.8 * rand() : 0.55 + 0.45 * rand(), rand() * Math.PI, spiral ? 1 : 0], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('shape', new THREE.BufferAttribute(shape, 4));
  const m = new THREE.ShaderMaterial({
    vertexShader: GAL_VERT, fragmentShader: GAL_FRAG, uniforms: { uPx: { value: 1 }, uGain: { value: 1 } },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = -12;
  return p;
}

// ?deep=0 … 4 überschreibt das Zahnrad (Screenshots, Vergleich mit reinem Schwarz)
const URL_K = new URLSearchParams(location.search).get('deep');
const strength = () => (URL_K !== null && URL_K !== '' && Number.isFinite(+URL_K) ? Math.min(4, Math.max(0, +URL_K)) : settings.S.deep);
const live = new Set();
function apply(group) {
  const k = strength(), { sky, gal, cfg } = group.userData;
  group.visible = k > 0;
  sky.material.uniforms.uFloor.value = 0.016 * k;
  sky.material.uniforms.uCirrus.value = 0.16 * cfg.cirrus * k;
  if (gal) gal.material.uniforms.uGain.value = cfg.gal * k;
}
onSettings((keys) => { if (keys.includes('deep')) live.forEach(apply); });

// Hintergrund für Station `id` oder null; group.userData.setPixelRatio(pr) wie beim Sternfeld
export function createDeepSky(id) {
  const cfg = DEEP[id];
  if (!cfg) return null;
  const rand = mulberry32(cfg.seed);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    uniforms: { uNgp: { value: new THREE.Vector3(...(cfg.ngp || [0, 1, 0])).normalize() }, uFloor: { value: 0 }, uCirrus: { value: 0 } },
    side: THREE.BackSide, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, transparent: true,
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -13;
  const group = new THREE.Group();
  group.add(sky);
  const gal = cfg.gal > 0 ? galaxies(cfg, Math.round(4500 * Math.min(cfg.gal, 1.5)), rand) : null;
  if (gal) group.add(gal);
  group.userData = { sky, gal, cfg, setPixelRatio: (pr) => { if (gal) gal.material.uniforms.uPx.value = pr; } };
  apply(group);
  live.add(group);
  sky.material.addEventListener('dispose', () => live.delete(group));
  return group;
}
