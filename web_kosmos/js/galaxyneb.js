// Nebel der Milchstraße (Station 3): Gas und Staub der Scheibe in 3D, ergänzt die Punktwolke aus buildGalaxy
// (Vorschau 28.10.2026 Nebel:A; Wolken und Schichten als Ideen in der Schatzkammer). Staub, HII-Gas, diffuses Gas und
// Sternlicht per Strahlverfolgung durch eine flache Platte: grobe Felder einmal gebacken, feine Oktaven live, eigene
// Auflösung, neu nur bei Änderung. Dreht im Zeitraffer differentiell mit wie die Sterne (Ω(R) wie levels/galaxy.js) und glimmt langsam.

import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { bakeField, offscreen } from './vol.js';
import { armConsts } from './galaxyfx.js';

const RAD = Math.PI / 180;
const EXT = 17.5, H = 1.2;   // Platte: Radius und halbe Dicke [kpc] (Verwerfung außen bis ≈ 0,35 kpc)
const BAR_ANG = 29 * RAD;

// Ω(R) [rad/Mio. J.] wie levels/galaxy.js; unspin dreht einen Ort auf seine Lage zur Zeit 0 zurück
const SPIN_GLSL = /* glsl */ `
float omR(float R) { return 230.0 * (1.0 - exp(-R / 1.2)) / max(R, 0.05) * 1.0227e-3; }
vec3 unspin(vec3 p, float T) {
  float a = omR(length(p.xz)) * T, c = cos(a), s = sin(a);
  return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
}`;

// Farben: Hα-Gebiete rosa-rot (Hα + etwas Hβ), diffuses ionisiertes Gas blasser, Sternlicht warm, junge Sterne bläulich
const C_HII = [1.0, 0.24, 0.34], C_WIM = [0.85, 0.42, 0.5], C_OLD = [1.0, 0.78, 0.56], C_BLUE = [0.5, 0.66, 1.0];
// Qualität (ctx.detail 0,55 / 0,8 / 1): niedrig gröber statt ohne Nebel – Feld, Schritte, Auflösung des Zwischenbilds
const TIER = [{ size: 96, steps: 64, scale: 0.4 }, { size: 128, steps: 96, scale: 0.5 }, { size: 160, steps: 128, scale: 0.6 }];
const v3 = (c) => `vec3(${c.map((x) => x.toFixed(3)).join(', ')})`;

// r Staub, g HII-Knoten, b diffuses Gas (Platte gestreckt: y im Feld = y · EXT / H)
const fieldBody = (arms) => /* glsl */ `
${armConsts(arms, [])}
vec4 field(vec3 p) {
  vec3 q = vec3(p.x, p.y * ${(H / EXT).toFixed(5)}, p.z);
  float R = length(q.xz), phi = atan(-q.z, -q.x);
  float young, arm, lane;
  armField(R, phi, young, arm, lane);
  // Verwerfung: außen biegt sich die Scheibe auf der einen Seite nach oben, gegenüber nach unten
  float y = q.y - 0.32 * sin(phi + 0.6) * smoothstep(9.0, 16.0, R);
  float edge = smoothstep(17.0, 12.5, R);
  float n1 = fbm(vec3(q.x, y * 4.0, q.z) * 0.55 + vec3(3.1, 0.0, 7.4), 4);
  float n2 = fbm(vec3(q.x, y * 3.0, q.z) * 1.6 + vec3(9.0, 2.0, 1.0), 3);
  float clump = clamp(0.45 + 1.5 * n1 + 0.7 * n2, 0.0, 2.2);
  float hz = 0.11 + 0.01 * R;
  float dust = (lane * 1.25 + arm * 0.3 + 0.16 * exp(-R / 5.0) * smoothstep(1.2, 3.0, R)) * clump * exp(-y * y / (hz * hz)) * edge;
  float knots = smoothstep(0.1, 0.5, n2 + 0.6 * n1);
  float hii = young * knots * exp(-y * y / 0.005) * smoothstep(2.6, 3.6, R) * edge;
  float wim = arm * (0.5 + 0.8 * max(n1 + 0.3, 0.0)) * exp(-abs(y) / 0.4) * edge;
  return vec4(dust, hii, wim, 0.0);
}`;

const VOL_FRAG = /* glsl */ `
uniform float uSteps, uTime, uT, uGain, uDust, uHii, uWim, uLight, uGlim;
uniform highp sampler3D uField;
varying vec3 vP;
${NOISE}
${SPIN_GLSL}
void sampleGal(vec3 p, out vec3 e, out float s) {
  vec3 q = unspin(p, uT);
  vec4 f = texture(uField, vec3(q.x, q.y * ${(EXT / H).toFixed(4)}, q.z) / ${(2 * EXT).toFixed(1)} + 0.5);
  float R = length(q.xz);
  // Sternlicht: exponentielle Scheibe, Balken, Bulge (die Punkte liefern die Sterne, hier nur das unaufgelöste Licht)
  float disk = exp(-R / 2.6) * exp(-abs(q.y) / 0.3) * smoothstep(17.0, 12.0, R);
  vec2 bu = vec2(-cos(${BAR_ANG.toFixed(5)}), -sin(${BAR_ANG.toFixed(5)})), bv = vec2(sin(${BAR_ANG.toFixed(5)}), -cos(${BAR_ANG.toFixed(5)}));
  float u = dot(q.xz, bu) / 2.1, v = dot(q.xz, bv) / 0.55, w = q.y / 0.32;
  float bar = exp(-0.5 * (u * u + v * v + w * w));
  float bulge = exp(-length(q * vec3(1.0, 1.45, 1.0)) / 0.42);
  float hii = f.g, dust = f.r;
  // feine Oktave live: Knoten zerfallen in einzelne Gebiete, Staub in Fasern
  if (hii > 0.01) {
    float g = gnoise(q * 7.0 + vec3(0.0, uTime * 0.05, 0.0));
    hii *= 0.35 + 1.3 * smoothstep(-0.25, 0.45, g);
    hii *= 1.0 + uGlim * 0.45 * gnoise(q * 2.2 + vec3(uTime * 0.09, 0.0, 0.0));
  }
  if (dust > 0.02) dust *= 0.55 + 0.9 * smoothstep(-0.3, 0.4, gnoise(q * vec3(5.0, 14.0, 5.0) + 4.0));
  // vor dem Rand der Platte auf null: sonst zeichnet der Strahl die Kanten des Kastens (Blick von der Seite)
  float fade = smoothstep(${H.toFixed(2)}, ${(0.45 * H).toFixed(2)}, abs(q.y)) * smoothstep(${EXT.toFixed(1)}, ${(EXT - 3).toFixed(1)}, R);
  hii *= fade; dust *= fade;
  e = fade * (${v3(C_OLD)} * (disk * 0.55 + bar * 0.6 + bulge * 1.4) * uLight
     + ${v3(C_HII)} * hii * uHii + ${v3(C_BLUE)} * hii * uHii * 0.12 + ${v3(C_WIM)} * f.b * uWim) * uGain;
  s = dust * uDust * 2.2;
}
void main() {
  vec3 ro = cameraPosition, rd = normalize(vP - cameraPosition);
  float b = dot(ro, rd), c = dot(ro, ro) - ${(EXT * EXT).toFixed(2)}, h = b * b - c;
  if (h <= 0.0) discard;
  h = sqrt(h);
  float t0 = max(-b - h, 0.0), t1 = -b + h;
  // nur die Platte |y| < H durchlaufen: alle Schritte dort, wo Gas ist
  if (abs(rd.y) > 1e-5) {
    float ta = (-${H.toFixed(2)} - ro.y) / rd.y, tb = (${H.toFixed(2)} - ro.y) / rd.y;
    t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb));
  } else if (abs(ro.y) > ${H.toFixed(2)}) discard;
  if (t1 <= t0) discard;
  float dt = (t1 - t0) / uSteps;
  float t = t0 + dt * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 L = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < 192; i++) {
    if (float(i) >= uSteps || t > t1) break;
    vec3 e;
    float s;
    sampleGal(ro + rd * t, e, s);
    float a = exp(-s * dt);
    L += T * e * (s > 1e-4 ? (1.0 - a) / s : dt);
    T *= a;
    if (T < 0.004) break;
    t += dt;
  }
  gl_FragColor = vec4(L, 1.0 - T);
}`;

export function nebulaVolume(renderer, { arms, detail = 1 }) {
  const q = TIER[detail > 0.9 ? 2 : detail > 0.7 ? 1 : 0];
  const field = bakeField(renderer, { size: q.size, extent: EXT, body: fieldBody(arms) });
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vP; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: VOL_FRAG,
    uniforms: {
      uField: { value: field.texture }, uSteps: { value: q.steps }, uTime: { value: 0 }, uT: { value: 0 },
      uGain: { value: 1 }, uDust: { value: 1.8 }, uHii: { value: 2.2 }, uWim: { value: 0.05 }, uLight: { value: 0.1 }, uGlim: { value: 1 },
    },
    side: THREE.BackSide, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(EXT, 48, 24), mat);
  mesh.frustumCulled = false;
  const vol = offscreen(renderer, mesh);
  vol.setScale(q.scale);
  vol.quad.renderOrder = 3;   // nach Sternen und Punkt-Staub: dämpft das Licht dahinter
  const u = mat.uniforms;
  const base = { uHii: u.uHii.value, uWim: u.uWim.value, uDust: u.uDust.value };
  let step = -1;
  return {
    object: vol.quad, uniforms: u, ready: field.ready.then(() => renderer.compileAsync(vol.scene, new THREE.PerspectiveCamera())),
    // Glimmen ist langsam: 12 neue Bilder je Sekunde reichen, dazwischen nur bei Kamerabewegung
    update(t, T, cam) {
      if (!vol.quad.visible) return;
      const k = u.uGlim.value > 0 ? Math.floor(t * 12) : 0;
      if (k !== step || u.uT.value !== T) { step = k; u.uTime.value = k / 12; u.uT.value = T; vol.invalidate(); }
      vol.render(cam);
    },
    // Zahnrad: an/aus, Leuchten des Gases und Staub als Faktor auf die Grundwerte, Glimmen an/aus
    setOn(v) { vol.quad.visible = v; vol.invalidate(); },
    setGas(k) { u.uHii.value = base.uHii * k; u.uWim.value = base.uWim * k; vol.invalidate(); },
    setDust(k) { u.uDust.value = base.uDust * k; vol.invalidate(); },
    setGlim(v) { u.uGlim.value = v ? 1 : 0; vol.invalidate(); },
    setSize: (w, h) => vol.setSize(w, h),
    dispose() { vol.dispose(); field.dispose(); },
  };
}
