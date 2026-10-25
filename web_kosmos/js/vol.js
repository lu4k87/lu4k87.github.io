// Gemeinsame Bausteine der Nebel-, Pulsar-, Galaxien- und Netz-Stationen:
// volume(): Strahlverfolgung durch ein Volumen in einer Kugel um den Ursprung (Emission + Absorption je Schritt exakt
// integriert, Startpunkt je Pixel versetzt gegen Streifen), Mischung „vorgemultipliert“: Bild = Licht + Hintergrund × T.
// pointCloud(): Punkte mit Größe in Szeneneinheiten; unter der Mindestgröße bleibt der Punkt klein und wird mit
// dem Quadrat des Abstands dunkler (wie der Strahlungsfluss einer Punktquelle).

import * as THREE from 'three';
import { NOISE } from './glsl.js';

// adapt = Schrittweite als Anteil des Abstands zum Ursprung (feine Strukturen, die nach außen breiter werden, z. B.
// Strahlkegel): innen dicht, außen grob; minStep begrenzt nach unten, maxSteps die Kosten.
export function volume({ radius, body, uniforms = {}, steps = 64, maxSteps = 160, adapt = 0, minStep = 1 }) {
  const mat = new THREE.ShaderMaterial({
    defines: adapt ? { ADAPT: adapt.toFixed(4), ADAPT_MIN: minStep.toFixed(4) } : {},
    vertexShader: /* glsl */ `
varying vec3 vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
uniform float uR, uSteps, uTime;
varying vec3 vP;
${NOISE}
${body}
void main() {
  vec3 ro = cameraPosition, rd = normalize(vP - cameraPosition);
  float b = dot(ro, rd), c = dot(ro, ro) - uR * uR, h = b * b - c;
  if (h <= 0.0) discard;
  h = sqrt(h);
  float t0 = max(-b - h, 0.0), t1 = -b + h;
  if (t1 <= 0.0) discard;
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
#ifdef ADAPT
  float dt = clamp(length(ro + rd * t0) * ADAPT, ADAPT_MIN, uR);
#else
  float dt = (t1 - t0) / uSteps;
#endif
  float t = t0 + dt * jit;
  vec3 L = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < ${maxSteps}; i++) {
#ifdef ADAPT
    if (t > t1) break;
    dt = clamp(length(ro + rd * t) * ADAPT, ADAPT_MIN, uR);
#else
    if (float(i) >= uSteps) break;
#endif
    vec3 e;
    float s;
    sampleVol(ro + rd * t, e, s);
    float a = exp(-s * dt);
    L += T * e * (s > 1e-4 ? (1.0 - a) / s : dt);
    T *= a;
    if (T < 0.004) break;
    t += dt;
  }
  gl_FragColor = vec4(L, 1.0 - T);
}`,
    uniforms: { uR: { value: radius }, uSteps: { value: steps }, uTime: { value: 0 }, ...uniforms },
    side: THREE.BackSide, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  mesh.frustumCulled = false;
  return mesh;
}

// Nahe der Kamera (Punkt größer als uFade px) weich ausblenden: ein Punkt bleibt ein Punkt und wird beim Durchflug
// kein Klecks – so bleibt der Flug durch eine Punktwolke ein Sternenfeld statt einer Blasen-Wand.
const PC_VERT = /* glsl */ `
attribute vec3 color;
attribute float size;
uniform float uPx, uScale, uMin, uMax, uFade;
varying vec3 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = size * uScale / max(-mv.z, 1e-6);
  float d = clamp(px, uMin * uPx, uMax * uPx);
  gl_PointSize = d;
  float near = 1.0 - smoothstep(uFade * uPx, uFade * 3.0 * uPx, px);
  vCol = color * min(1.0, (px * px) / (d * d) * 4.0) * near;
}
`;
const PC_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  gl_FragColor = vec4(vCol * exp(-dot(d, d) * 12.8), 1.0);
}
`;

export function pointCloud(pos, col, size, { min = 1.3, max = 40, fade = 24, frag = PC_FRAG, blending = THREE.AdditiveBlending } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: PC_VERT, fragmentShader: frag,
    uniforms: { uPx: { value: 1 }, uScale: { value: 600 }, uMin: { value: min }, uMax: { value: max }, uFade: { value: fade } },
    blending, depthWrite: false, transparent: true,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.userData.setPx = (pr, H, fov) => { m.uniforms.uPx.value = pr; m.uniforms.uScale.value = (H / 2) / Math.tan((fov * Math.PI) / 360); };
  return p;
}

export function disposeScene(scene) {
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}
