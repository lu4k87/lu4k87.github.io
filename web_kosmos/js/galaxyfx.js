// Galaxien aus der Ferne (Station Lokale Gruppe), ergänzt die Punktwolke aus buildGalaxy (levels/galaxy.js):
// galaxyGlow() = diffuses Licht der Scheibe als Shader-Fläche (Sternlicht, Arme, Balken, Staubbahnen, fleckiges Gas),
// starFormation() = junge Sterne und HII-Regionen mit Lebenslauf, lightBlobs() = weiche Lichthöfe (Bulge, Zwerggalaxien,
// Sternentstehungsgebiete), streamCloud() = Gezeitenströme als Punktband entlang einer Kurve.
// Bewegung im mitrotierenden System des Spiralmusters (Dichtewelle): die Arme stehen, Sterne und Gas ziehen mit Ω(R) − Ωp
// hindurch. Junge Sterne entstehen an der Staubbahn (Innenkante eines Arms), ziehen mit und verlöschen nach ihrer Lebensdauer –
// so bleibt das Muster erhalten und wickelt sich nicht auf. Rotationskurve v(R) = vmax · (1 − e^(−R/rT)), Zeit in Mio. Jahren.

import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { pointCloud } from './vol.js';
import { mulberry32, gauss, blackbody } from './astro.js';

const RAD = Math.PI / 180;
const MAX_ARMS = 6, MAX_RINGS = 3;

// Ω(R) − Ωp in rad je Mio. Jahre (1 km/s/kpc = 1,0227·10⁻³ rad/Myr); R in Modelleinheiten, uSc rechnet in kpc um
const OMEGA = /* glsl */ `
uniform vec3 uRot;
uniform float uSc;
float dOm(float R) {
  float r = max(R * uSc, 0.05);
  return (uRot.x * (1.0 - exp(-r / uRot.y)) / r - uRot.z) * 1.0227e-3;
}
`;
const rotUniform = (rot) => ({ value: new THREE.Vector3(rot.vmax, rot.rT, rot.omegaP) });

const GLOW_VERT = /* glsl */ `
varying vec3 vL, vW, vN;
void main() {
  vL = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const GLOW_FRAG = /* glsl */ `
#define PI 3.14159265
uniform float uGain, uT, uH, uRMax, uRIn, uDust, uYoung, uBar, uBarHalf, uBarAng;
uniform vec4 uArmA[${MAX_ARMS}], uArmB[${MAX_ARMS}], uRing[${MAX_RINGS}];
uniform int uNArms, uNRings;
uniform vec3 uOld, uBlue, uOff;
varying vec3 vL, vW, vN;
${NOISE}
${OMEGA}
// Gasflecken ziehen differentiell mit; zwei um eine halbe Periode versetzte Lagen werden überblendet und abwechselnd
// zurückgesetzt (Strömungskarte), damit sich die Flecken nicht endlos zu Fäden aufwickeln
float mottle(float R, float phi) {
  const float P = 80.0;
  float a = fract(uT / P), b = fract(uT / P + 0.5), om = dOm(R);
  float pa = phi - om * a * P, pb = phi - om * b * P;
  float na = fbm(vec3(-R * cos(pa), -R * sin(pa), 0.0) * 0.9 + uOff, 4);
  float nb = fbm(vec3(-R * cos(pb), -R * sin(pb), 5.0) * 0.9 + uOff, 4);
  return mix(nb, na, 1.0 - abs(2.0 * a - 1.0));
}
void main() {
  float R = length(vL.xz), phi = atan(-vL.z, -vL.x);
  if (R > uRMax) discard;
  float m = mottle(R, phi);
  float young = 0.0, arm = 0.0, lane = 0.0;
  for (int i = 0; i < ${MAX_ARMS}; i++) {
    if (i >= uNArms) break;
    vec4 A = uArmA[i], B = uArmB[i];   // A: rRef, φRef, tan ψ, Stärke · B: Breite, Spanne Anfang/Ende, sin ψ
    float pa = A.y - log(max(R, 0.01) / A.x) / A.z;
    float t = (B.y - pa) / (B.y - B.z);
    float fade = clamp(t / 0.08, 0.0, 1.0) * clamp((1.0 - t) / 0.4, 0.0, 1.0) * A.w;
    if (fade <= 0.0) continue;
    float s = R * (mod(phi - pa + PI, 2.0 * PI) - PI) * B.w;   // senkrechter Abstand zum Arm, innen negativ
    float wid = B.x * (0.7 + R / 12.0), sig = 0.6 * wid;
    young += fade * exp(-0.5 * s * s / (sig * sig));
    arm += fade * exp(-0.125 * s * s / (sig * sig));
    float ls = (s + 0.45 * wid) / (0.45 * sig);
    lane += fade * exp(-0.5 * ls * ls);
  }
  for (int i = 0; i < ${MAX_RINGS}; i++) {
    if (i >= uNRings) break;
    vec4 G = uRing[i];   // Radius, Breite, Stärke
    float d = (R - G.x) / G.y, ld = (d + 0.75) / 0.4;
    young += G.z * exp(-0.5 * d * d);
    arm += G.z * exp(-0.125 * d * d);
    lane += G.z * exp(-0.5 * ld * ld);
  }
  young *= smoothstep(uRIn * 0.75, uRIn * 1.2, R) * smoothstep(uRMax, uRMax * 0.6, R);
  float disk = exp(-R / uH) * smoothstep(uRMax, uRMax * 0.7, R);
  vec2 bu = vec2(-cos(uBarAng), -sin(uBarAng)), bv = vec2(sin(uBarAng), -cos(uBarAng));
  float u = dot(vL.xz, bu) / (0.42 * uBarHalf), v = dot(vL.xz, bv) / 0.55;
  float bar = uBar * exp(-0.5 * (u * u + v * v));
  float clump = clamp(0.55 + 1.3 * m, 0.05, 1.8);
  vec3 col = uOld * (disk * (0.55 + 0.7 * min(arm, 1.4)) * (0.85 + 0.35 * m) + bar)
           + uBlue * uYoung * min(young, 1.4) * clump;
  col *= 1.0 - uDust * clamp(lane * (0.7 + 0.9 * m), 0.0, 0.85);
  // dünne, optisch dünne Schicht: schräg gesehen mehr Licht je Bildpunkt (begrenzt, sonst gleißt die Kante)
  float mu = abs(dot(normalize(vN), normalize(vW - cameraPosition)));
  gl_FragColor = vec4(col * uGain / max(mu, 0.22), 1.0);
}`;

function armUniforms(arms, rings) {
  const A = [], B = [], G = [];
  for (let i = 0; i < MAX_ARMS; i++) {
    const a = arms[i];
    A.push(a ? new THREE.Vector4(a.rRef, a.phiRef, Math.tan(a.pitch * RAD), a.w) : new THREE.Vector4());
    B.push(a ? new THREE.Vector4(a.width, a.span[0] * RAD, a.span[1] * RAD, Math.sin(a.pitch * RAD)) : new THREE.Vector4());
  }
  for (let i = 0; i < MAX_RINGS; i++) G.push(rings[i] ? new THREE.Vector4(rings[i].R, rings[i].width, rings[i].w, 0) : new THREE.Vector4());
  return { uArmA: { value: A }, uArmB: { value: B }, uRing: { value: G }, uNArms: { value: arms.length }, uNRings: { value: rings.length } };
}

// Scheibe in der x-z-Ebene der Galaxie (Modelleinheiten wie buildGalaxy, scale = Modell → kpc)
export function galaxyGlow({ arms = [], rings = [], scale = 1, rot, seed = 0, h = 2.6, rMax = 17, rIn = 3, gain = 0.2, young = 0.4,
  dust = 0.6, bar = 0.5, barHalf = 5, barAngle = 29, old = 4700, blue = 14000 }) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
    uniforms: {
      ...armUniforms(arms, rings), uRot: rotUniform(rot), uSc: { value: scale }, uT: { value: 0 },
      uGain: { value: gain }, uH: { value: h }, uRMax: { value: rMax }, uRIn: { value: rIn }, uDust: { value: dust }, uYoung: { value: young },
      uBar: { value: bar }, uBarHalf: { value: barHalf }, uBarAng: { value: barAngle * RAD },
      uOld: { value: new THREE.Vector3(...blackbody(old)) }, uBlue: { value: new THREE.Vector3(...blackbody(blue)) },
      uOff: { value: new THREE.Vector3(seed * 1.37, seed * 0.71, seed * 2.13) },
    },
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(rMax, 160).rotateX(-Math.PI / 2), mat);
  mesh.scale.setScalar(scale);
  mesh.renderOrder = 1;   // vor dem Staub der Punktwolke (renderOrder 2), damit er auch das diffuse Licht dämpft
  mesh.frustumCulled = false;
  return mesh;
}

const SF_VERT = /* glsl */ `
attribute vec3 color;
attribute float size;
attribute vec4 aFlow;   // R (Modell), Azimut bei der Geburt, Lebensdauer [Mio. J.], Phase 0 … 1
uniform float uPx, uScale, uT;
varying vec3 vCol;
${OMEGA}
void main() {
  float age = mod(uT + aFlow.w * aFlow.z, aFlow.z), a = age / aFlow.z;
  float phi = aFlow.y + dOm(aFlow.x) * age;
  vec4 mv = modelViewMatrix * vec4(vec3(-aFlow.x * cos(phi), position.y, -aFlow.x * sin(phi)) * uSc, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = size * uScale / max(-mv.z, 1e-3);
  float d = clamp(px, 1.2 * uPx, 36.0 * uPx);
  gl_PointSize = d;
  float near = 1.0 - smoothstep(20.0 * uPx, 60.0 * uPx, px);
  // aufleuchten, lange gleich hell, weich verlöschen: am Ende dunkel, der Neubeginn springt also nicht
  float life = smoothstep(0.0, 0.15, a) * (1.0 - smoothstep(0.55, 1.0, a));
  vCol = color * life * min(1.0, (px * px) / (d * d) * 4.0) * near;
}`;
const SF_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  gl_FragColor = vec4(vCol * exp(-dot(d, d) * 12.8), 1.0);
}`;

// Junge Sterne (blau, 10–35 Mio. Jahre) und HII-Regionen (rosa Knoten aus Hα + Hβ, 3–8 Mio. Jahre) – Lebensdauern als Richtwert
export function starFormation({ arms = [], rings = [], n, scale = 1, rot, seed = 1, gain = 1, rIn = 3, rOut = 17, hii = 0.03 }) {
  const rand = mulberry32(seed);
  const pos = [], col = [], size = [], flow = [];
  const put = (R, phi, y, c, s, life, ph) => {
    pos.push(0, y * scale, 0);
    col.push(c[0] * gain, c[1] * gain, c[2] * gain);
    size.push(s * scale);
    flow.push(R, phi, life, ph);
  };
  const wSum = arms.reduce((s, a) => s + a.w, 0) + rings.reduce((s, r) => s + r.w, 0);
  // Geburtsort an der Staubbahn (Innenkante) eines Arms oder Rings
  const birth = () => {
    let k = rand() * wSum;
    for (const a of arms) {
      if ((k -= a.w) > 0) continue;
      const t = rand();
      const p = (a.span[0] + (a.span[1] - a.span[0]) * t) * RAD;
      const R = a.rRef * Math.exp(-(p - a.phiRef) * Math.tan(a.pitch * RAD));
      if (R < rIn || R > rOut || rand() > Math.min(1, t / 0.08) * Math.min(1, (1 - t) / 0.4)) return null;
      const wid = a.width * (0.7 + R / 12);
      return { R, phi: p + (-0.45 + gauss(rand) * 0.4) * wid / (R * Math.sin(a.pitch * RAD)) };
    }
    for (const r of rings) {
      if ((k -= r.w) > 0) continue;
      return { R: r.R + (-0.75 + gauss(rand) * 0.3) * r.width, phi: rand() * Math.PI * 2 };
    }
    return null;
  };
  for (let i = 0; i < n; i++) {
    const b = birth();
    if (b) put(b.R, b.phi, gauss(rand) * 0.06, blackbody(9000 + rand() * 16000).map((v) => v * (0.7 + rand() * 0.8)), 0.04 + rand() * 0.05, 10 + rand() * 25, rand());
  }
  for (let i = 0; i < n * hii; i++) {
    const b = birth();
    if (!b) continue;
    const life = 3 + rand() * 5, ph = rand(), c = [1.0, 0.32, 0.48].map((v) => v * (0.8 + 0.9 * rand()));
    for (let j = 2 + Math.floor(rand() * 5); j > 0; j--) put(b.R + gauss(rand) * 0.05, b.phi + gauss(rand) * 0.05 / b.R, gauss(rand) * 0.02, c, 0.07 + rand() * 0.07, life, ph);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 4));
  const mat = new THREE.ShaderMaterial({
    vertexShader: SF_VERT, fragmentShader: SF_FRAG,
    uniforms: { uPx: { value: 1 }, uScale: { value: 600 }, uT: { value: 0 }, uRot: rotUniform(rot), uSc: { value: scale } },
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.userData.setPx = (pr, H, fov) => { mat.uniforms.uPx.value = pr; mat.uniforms.uScale.value = (H / 2) / Math.tan(fov * RAD / 2); };
  return pts;
}

// Weicher Lichthof je Punkt (Plummer-artig, Kern ≈ 0,28 des Radius); size = Durchmesser in Szeneneinheiten
const BLOB_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float q = r / 0.28;
  gl_FragColor = vec4(vCol * (1.0 - r * r) / ((1.0 + q * q) * (1.0 + q * q)), 1.0);
}`;
export const lightBlobs = (pos, col, size) => pointCloud(pos, col, size, { min: 1, max: 1500, fade: 1e6, frag: BLOB_FRAG });

// Punktband entlang einer Kurve (path: Vector3[]): u = 0 an der Quelle, 1 am Ende; Breite σ wächst von width[0] auf width[1],
// Helligkeit läuft zum Ende aus. Feine Punkte (Sterne) und optional große, schwache Flecken (Gas)
export function streamCloud(path, { n, width = [1, 4], seed = 1, color = [1, 1, 1], k = 1, size = 0.12, gas = 0 }) {
  const rand = mulberry32(seed);
  const curve = new THREE.CatmullRomCurve3(path);
  const pos = [], col = [], sz = [];
  const side = new THREE.Vector3(), up = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const u = Math.pow(rand(), 1.3);
    const p = curve.getPointAt(u), t = curve.getTangentAt(u);
    side.crossVectors(t, Math.abs(t.y) < 0.9 ? THREE.Object3D.DEFAULT_UP : new THREE.Vector3(1, 0, 0)).normalize();
    up.crossVectors(side, t);
    const w = width[0] + (width[1] - width[0]) * u;
    const isGas = rand() < gas;
    p.addScaledVector(side, gauss(rand) * w).addScaledVector(up, gauss(rand) * w * 0.6);
    pos.push(p.x, p.y, p.z);
    const b = k * Math.min(1, u / 0.04) * Math.pow(1 - u, 0.8) * (0.4 + rand() * 0.8) * (isGas ? 0.12 : 1);
    col.push(color[0] * b, color[1] * b, color[2] * b);
    sz.push(isGas ? w * (0.6 + rand() * 0.7) : size * (0.6 + rand() * 0.8));
  }
  return pointCloud(pos, col, sz, { min: 1, max: 160, fade: 120 });
}
