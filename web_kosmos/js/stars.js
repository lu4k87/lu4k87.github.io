// Gemeinsamer Sternhimmel der stellaren Ebenen: Sterne nach Helligkeitsverteilung (mehr schwache als helle), Farben aus
// der Planck-Temperatur, Häufung zur galaktischen Ebene und das diffuse Band der Milchstraße mit Staubbahnen und
// hellerem Zentrum. Im All funkeln Sterne nicht (kein Luftflimmern) – deshalb ruhige Punkte.
// createStarfield(): statistisch, kein Sternkatalog (Kennzeichnung in content.js); starPoints()/glintPoints() nutzen auch
// die Katalog-Himmel (catalog.js): Punkte nach Größenklasse, dazu ein Glanzlicht (weicher Hof + vier feine Strahlen,
// wie das Auge oder eine Kameralinse helle Sterne zeigt) nur für die hellsten Sterne.

import * as THREE from 'three';
import { blackbody, mulberry32, gauss } from './astro.js';
import { NOISE, SKY_VERTEX } from './glsl.js';

const STAR_VERT = /* glsl */ `
${SKY_VERTEX}
attribute vec3 color;
attribute float mag;
uniform float uPx, uGain, uLimit;
varying vec3 vCol;
void main() {
  gl_Position = skyPosition(position);
  float bright = smoothstep(uLimit, -1.5, mag);
  float size = uPx * mix(1.6, 4.6, bright * bright);
  gl_PointSize = size;
  // Energie über die Fläche verteilen: größere Scheibchen werden nicht heller, nur weicher
  float flux = pow(10.0, -0.4 * (mag - 1.0));
  vCol = color * uGain * flux * 9.0 / (size * size) * step(mag, uLimit);
}
`;
const STAR_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = exp(-dot(d, d) * 18.0);
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

// Glanzlicht der hellsten Sterne: Hof + vier Strahlen, Fläche wächst mit dem Fluss, Energie bleibt erhalten
const GLINT_VERT = /* glsl */ `
${SKY_VERTEX}
attribute vec3 color;
attribute float mag;
uniform float uPx, uGain, uLimit;
varying vec3 vCol;
void main() {
  gl_Position = skyPosition(position);
  float flux = pow(10.0, -0.4 * (mag + 1.46));   // Sirius = 1
  float size = uPx * (22.0 + 44.0 * clamp(sqrt(flux), 0.0, 1.0));
  gl_PointSize = size * step(mag, uLimit);
  vCol = color * uGain * flux * 520.0 / (size * size);
}
`;
const GLINT_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  vec2 d = (gl_PointCoord - 0.5) * 2.0;
  float r = length(d);
  float core = exp(-r * r * 16.0);
  float rays = (exp(-abs(d.x) * 30.0) * exp(-abs(d.y) * 2.4) + exp(-abs(d.y) * 30.0) * exp(-abs(d.x) * 2.4)) * 0.35;
  float halo = exp(-r * 4.0) * 0.22;
  float edge = 1.0 - smoothstep(0.8, 1.0, r);
  gl_FragColor = vec4(vCol * (core + rays + halo) * edge, 1.0);
}
`;

const BAND_VERT = /* glsl */ `
${SKY_VERTEX}
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = skyPosition(vDir);
}
`;
const BAND_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uNgp, uGc;
uniform float uGain;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float sb = dot(d, uNgp);                          // sin b
  float gcA = acos(clamp(dot(d, uGc), -1.0, 1.0));  // Winkel zum galaktischen Zentrum
  float band = exp(-pow(sb / 0.16, 2.0));
  float bulge = exp(-pow(gcA / 0.5, 2.0)) * exp(-pow(sb / 0.22, 2.0));
  float clump = 0.55 + 0.45 * fbm(d * 7.0, 5);
  // Staubbahnen (Great Rift): dunkle Fäden genau in der Ebene
  float dust = smoothstep(0.12, 0.0, abs(sb + 0.03 * gnoise(d * 9.0))) * smoothstep(-0.1, 0.4, fbm(d * 5.0 + 3.0, 4));
  float I = (band * clump * (0.45 + 0.55 * exp(-gcA * 0.8)) + bulge * 1.6) * (1.0 - 0.75 * dust);
  vec3 col = mix(vec3(0.75, 0.78, 0.92), vec3(1.0, 0.86, 0.66), bulge + 0.3);
  gl_FragColor = vec4(col * I * uGain, 1.0);
}
`;

function pointsOf(pos, col, mag, vert, frag, uniforms, order) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, uniforms,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = order;
  return p;
}

// Sterne als Punkte (Richtung = Position, Helligkeit mag); limit = schwächste gezeichnete Größenklasse
export function starPoints(pos, col, mag, { gain = 1, limit = 7.2 } = {}) {
  return pointsOf(pos, col, mag, STAR_VERT, STAR_FRAG, { uPx: { value: 1 }, uGain: { value: gain }, uLimit: { value: limit } }, -10);
}
// Glanzlichter nur für die hellsten Sterne (bis `limit` mag)
export function glintPoints(pos, col, mag, { gain = 1, limit = 1.6 } = {}) {
  return pointsOf(pos, col, mag, GLINT_VERT, GLINT_FRAG, { uPx: { value: 1 }, uGain: { value: gain }, uLimit: { value: limit } }, -9);
}

// Diffuses Band der Milchstraße: ngp = galaktischer Nordpol, gc = galaktisches Zentrum (beide in der Szene der Ebene)
export function milkyBand(ngp, gc, gain = 1) {
  const n = ngp.clone().normalize();
  const u = gc.clone().addScaledVector(n, -gc.dot(n)).normalize();
  const bandMat = new THREE.ShaderMaterial({
    vertexShader: BAND_VERT, fragmentShader: BAND_FRAG,
    uniforms: { uNgp: { value: n }, uGc: { value: u }, uGain: { value: 0.035 * gain } },
    side: THREE.BackSide, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, transparent: true,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), bandMat);
  sky.frustumCulled = false;
  sky.renderOrder = -11;
  return sky;
}

// ngp = Richtung galaktischer Nordpol, gc = Richtung galaktisches Zentrum (beide in der Szene der Ebene)
export function createStarfield({ count = 9000, seed = 7, ngp = new THREE.Vector3(0, 1, 0), gc = new THREE.Vector3(1, 0, 0),
  gain = 1, band = 1, limit = 7.2, glint = true } = {}) {
  const rand = mulberry32(seed);
  const n = ngp.clone().normalize();
  const u = gc.clone().addScaledVector(n, -gc.dot(n)).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), mag = new Float32Array(count);
  const dir = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // Helligkeit: Anzahl wächst etwa ×3 je Größenklasse (Seares-Gesetz, grob)
    const m = -1.4 + Math.log(1 + rand() * (Math.exp(1.1 * 8.6) - 1)) / 1.1;
    // schwächere Sterne häufen sich zur galaktischen Ebene
    const inPlane = rand() < 0.25 + 0.35 * Math.min(1, Math.max(0, (m - 3) / 4));
    if (inPlane) {
      const l = rand() * Math.PI * 2, b = gauss(rand) * 0.18;
      dir.copy(u).multiplyScalar(Math.cos(b) * Math.cos(l)).addScaledVector(v, Math.cos(b) * Math.sin(l)).addScaledVector(n, Math.sin(b));
    } else {
      dir.set(gauss(rand), gauss(rand), gauss(rand)).normalize();
    }
    pos.set([dir.x, dir.y, dir.z], i * 3);
    // Temperaturen: viele K-Riesen und G-Sterne, einige heiße A/B-Sterne unter den hellen
    const r = rand();
    const T = r < 0.3 ? 3400 + rand() * 1600 : r < 0.75 ? 5000 + rand() * 2200 : 7200 + Math.pow(rand(), 2) * 18000;
    col.set(blackbody(T), i * 3);
    mag[i] = m;
  }
  const group = new THREE.Group();
  const points = starPoints(pos, col, mag, { gain, limit });
  group.add(points);
  const mats = [points.material];
  if (glint) {
    const g = glintPoints(pos, col, mag, { gain: gain * 0.8, limit: 0.6 });
    group.add(g);
    mats.push(g.material);
  }
  if (band > 0) group.add(milkyBand(n, u, band));
  group.userData.setPixelRatio = (pr) => mats.forEach((m) => { m.uniforms.uPx.value = pr; });
  group.userData.material = points.material;
  return group;
}
