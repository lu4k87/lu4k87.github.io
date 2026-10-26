// Pulsar (Crab): Plasmawirbel um die Strahlachsen – Schema aus aufgewickelten offenen Feldlinien, kein Messbild.
// Einzeln schaltbar im Zahnrad (pulsar.js registerLayers): Wirbeltrichter (WIRBEL_CONE im Strahl-Shader), Spiralteilchen, Polkappen-Strudel.
import * as THREE from 'three';

// Wirbelsturm-Trichter statt glattem Kegel: hohl, innen schneller drehend, Turbulenz in Spiralarmen.
// Erwartet im Strahl-Shader: ang, h, lh, psi (Winkel um die Achse, dreht mit dem Stern), uTime, fbm().
export const WIRBEL_CONE = /* glsl */ `
    float a = ang / 0.2;
    float om = 0.7 + 1.5 / (a + 0.35);
    float tw = psi - 2.4 * lh + uTime * om;
    vec3 q = vec3(cos(tw) * (0.6 + a), sin(tw) * (0.6 + a), lh * 2.2 - uTime * 0.9);
    float w = fbm(q * 1.4, 3);
    float arms = pow(0.5 + 0.5 * cos(4.0 * tw + w * 4.0), 3.0);
    float turb = 0.15 + 1.2 * smoothstep(-0.1, 0.5, fbm(q * 2.6 + w * 2.0, 3));
    float wall = exp(-pow((a - 0.72) / 0.38, 2.0)), inner = exp(-pow(a / 0.4, 2.0));
    float core = exp(-pow(ang / 0.028, 2.0)), halo = exp(-pow(ang / 0.36, 2.0));
    vec3 col = vec3(0.85, 0.97, 1.0) * core * 0.9
      + mix(vec3(0.25, 0.85, 1.0), vec3(0.75, 0.4, 1.0), smoothstep(0.5, 1.2, a)) * arms * wall * turb * 1.6
      + vec3(0.35, 0.75, 1.0) * inner * turb * 0.18 + vec3(0.3, 0.4, 1.0) * halo * 0.03;
    e += col * fall * pole * uGain;
`;

// Polkappen-Strudel auf der Kruste (alle Varianten): Spiralarme um die Magnetachse, drehen ein
export const CAP_GLSL = /* glsl */ `
uniform vec3 uE1, uE2;
uniform float uT, uCapS;
float capSwirl(vec3 N, vec3 M) {
  float c = dot(N, M), sg = c > 0.0 ? 1.0 : -1.0;
  float ang = acos(clamp(abs(c), 0.0, 1.0));
  float psi = atan(dot(N, uE2) * sg, dot(N, uE1));
  float arm = pow(0.5 + 0.5 * cos(4.0 * (psi + 2.6 * log(ang + 0.03)) + uT * 2.2), 3.0);
  return arm * exp(-pow(ang / 0.5, 2.0)) * smoothstep(0.03, 0.12, ang);
}
`;

// Teilchen auf Spiralbahnen um beide Strahlachsen, Abstand wächst logarithmisch (beschleunigt hinaus)
export function spiralParticles(n, uM, uE1, uE2) {
  const g = new THREE.BufferGeometry();
  const a = new Float32Array(n * 4);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) a.set([rnd(), rnd() * Math.PI * 2, 0.35 + rnd() * 0.9, rnd() < 0.62 ? 1 : -1], i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aS', new THREE.BufferAttribute(a, 4));
  const u = { uM: { value: uM }, uE1: { value: uE1 }, uE2: { value: uE2 }, uT: { value: 0 }, uPx: { value: 1 }, uCone: { value: 0.2 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    vertexShader: /* glsl */ `
attribute vec4 aS;   // Startphase, Winkel, Radiusfaktor, Pol
uniform vec3 uM, uE1, uE2;
uniform float uT, uPx, uCone;
varying float vA, vF;
void main() {
  float f = fract(aS.x + uT * 0.07);
  float h = 16.0 * exp(f * log(6500.0 / 16.0));
  float lh = log(h);
  float a = aS.z;
  float psi = aS.y + 2.4 * lh + uT * (0.7 + 1.5 / (a + 0.35));
  float rho = h * tan(uCone * a);
  vec3 P = uM * aS.w * h + (uE1 * cos(-psi) + uE2 * sin(-psi) * aS.w) * rho;
  vec4 mv = modelViewMatrix * vec4(P, 1.0);
  gl_Position = projectionMatrix * mv;
  vF = f;
  vA = smoothstep(0.0, 0.08, f) * pow(1.0 - f, 1.4) * (aS.w > 0.0 ? 1.0 : 0.65);
  gl_PointSize = uPx * (1.5 + 2.5 * (1.0 - f));
}`,
    fragmentShader: /* glsl */ `
varying float vA, vF;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  gl_FragColor = vec4(mix(vec3(0.75, 0.97, 1.0), vec3(0.7, 0.45, 1.0), vF) * vA * exp(-dot(d, d) * 14.0) * 0.9, 1.0);
}`,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = 4;
  p.userData.u = u;
  return p;
}
