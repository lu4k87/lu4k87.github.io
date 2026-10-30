// Pulsar (Crab): Plasmawirbel um die Strahlachsen – Schema aus aufgewickelten offenen Feldlinien, kein Messbild.
// Einzeln schaltbar im Zahnrad (pulsar.js registerLayers): Wirbeltrichter (WIRBEL_CONE im Strahl-Shader), Spiralteilchen, Polkappen-Strudel.
import * as THREE from 'three';
import { mulberry32 } from './astro.js';

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

// Zwei Pole: Hauptpol uM, Gegenpol uM2 (nicht genau gegenüber, sondern um 0,1 P versetzt, siehe pulsar.js), je Pol
// zwei Achsen senkrecht dazu als Bezug für den Drehwinkel. nearPole gibt den Kosinus zum näheren Pol, sg = +1 Haupt-, −1 Gegenpol.
export const POLES_GLSL = /* glsl */ `
uniform vec3 uM, uM2, uE1, uE2, uF1, uF2;
float nearPole(vec3 d, out float sg, out vec3 E1, out vec3 E2) {
  float c1 = dot(d, uM), c2 = dot(d, uM2);
  sg = c1 >= c2 ? 1.0 : -1.0;
  E1 = sg > 0.0 ? uE1 : uF1;
  E2 = sg > 0.0 ? uE2 : uF2;
  return max(c1, c2);
}
`;

// Polkappen-Strudel auf der Kruste (alle Varianten): Spiralarme um die Magnetachse, drehen ein
export const CAP_GLSL = /* glsl */ `
${POLES_GLSL}
uniform float uT, uCapS;
float capSwirl(vec3 N) {
  float sg;
  vec3 E1, E2;
  float ang = acos(clamp(nearPole(N, sg, E1, E2), 0.0, 1.0));
  float psi = atan(dot(N, E2) * sg, dot(N, E1));
  float arm = pow(0.5 + 0.5 * cos(4.0 * (psi + 2.6 * log(ang + 0.03)) + uT * 2.2), 3.0);
  return arm * exp(-pow(ang / 0.5, 2.0)) * smoothstep(0.03, 0.12, ang);
}
`;

// Teilchen auf Spiralbahnen um beide Strahlachsen, Abstand wächst logarithmisch (beschleunigt hinaus); poles = Uniforms
// von POLES_GLSL (geteilt mit dem Strahl-Shader)
export function spiralParticles(n, poles) {
  const g = new THREE.BufferGeometry();
  const a = new Float32Array(n * 4);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) a.set([rnd(), rnd() * Math.PI * 2, 0.35 + rnd() * 0.9, rnd() < 0.62 ? 1 : -1], i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aS', new THREE.BufferAttribute(a, 4));
  const u = { ...poles, uT: { value: 0 }, uPx: { value: 1 }, uCone: { value: 0.2 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    vertexShader: /* glsl */ `
attribute vec4 aS;   // Startphase, Winkel, Radiusfaktor, Pol
uniform vec3 uM, uM2, uE1, uE2, uF1, uF2;
uniform float uT, uPx, uCone;
varying float vA, vF;
void main() {
  float f = fract(aS.x + uT * 0.07);
  float h = 16.0 * exp(f * log(6500.0 / 16.0));
  float lh = log(h);
  float a = aS.z;
  float psi = aS.y + 2.4 * lh + uT * (0.7 + 1.5 / (a + 0.35));
  float rho = h * tan(uCone * a);
  bool hp = aS.w > 0.0;
  vec3 P = (hp ? uM : uM2) * h + ((hp ? uE1 : uF1) * cos(-psi) + (hp ? uE2 : uF2) * sin(-psi) * aS.w) * rho;
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

// ---------- Kino-Ebenen (Vorschau 27.10.2026 „Pulsar detailreicher“) ----------
// Gravitationslinse: Lichtablenkung im schwachen Feld α = 2 R_s / b (R_s = 2GM/c² ≈ 4,1 km bei 1,4 M☉, b = Stoßparameter).
// Kleinwinkel-Linsengleichung θ − θ_E²/θ = θ_s mit θ_E² = 2 R_s / D (D = Abstand der Kamera): Quellen rücken vom Stern weg,
// innerhalb von θ_E erscheint die Gegenseite gespiegelt (Einstein-Ring). Hinter der Sternscheibe verdeckt der Stern selbst.
export const LENS_GLSL = /* glsl */ `
uniform float uLens, uRs;
vec3 lensRotate(vec3 L, vec3 s, float c, float th) {
  vec3 e = s - L * c;
  float el = length(e);
  e = el < 1e-5 ? normalize(cross(L, abs(L.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))) : e / el;
  return normalize(L * cos(th) + e * sin(th));
}
// Quelle s → scheinbare Richtung (Sterne)
vec3 lensApparent(vec3 s) {
  if (uLens <= 0.0) return s;
  vec3 L = -normalize(cameraPosition);
  float c = dot(s, L), ths = acos(clamp(c, -1.0, 1.0));
  if (ths > 1.4) return s;
  float tE2 = uLens * 2.0 * uRs / length(cameraPosition);
  return lensRotate(L, s, c, 0.5 * (ths + sqrt(ths * ths + 4.0 * tE2)));
}
// scheinbare Richtung d → Quelle (Himmel, Nebelschein)
vec3 lensSource(vec3 d) {
  if (uLens <= 0.0) return d;
  vec3 L = -normalize(cameraPosition);
  float c = dot(d, L), th = acos(clamp(c, -1.0, 1.0));
  if (th > 1.4) return d;
  float tE2 = uLens * 2.0 * uRs / length(cameraPosition);
  return lensRotate(L, d, c, max(th - tE2 / max(th, 0.01), -1.5));
}
`;
// Sternhimmel (stars.js) nachträglich linsen: Eckpunkt-Shader der Punkte bekommt lensApparent(), gleiche Uniforms wie der Himmel
export function lensStars(group, u) {
  const from = 'gl_Position = skyPosition(position);';
  group.traverse((o) => {
    const m = o.material;
    if (!m || !m.vertexShader || !m.vertexShader.includes(from)) return;
    m.vertexShader = m.vertexShader.replace('void main()', `${LENS_GLSL}\nvoid main()`).replace(from, 'gl_Position = skyPosition(lensApparent(normalize(position)));');
    Object.assign(m.uniforms, u);
    m.needsUpdate = true;
  });
}

// Glasflächen (additiv, beidseitig): Stromblatt, Lichtzylinder-Wand, Außenspalt – hell, wo die Fläche zur Kamera zeigt bzw.
// am Rand (Fresnel), sonst durchsichtig; keine harte Kante, kein Verdecken.
const GLASS_VERT = /* glsl */ `
varying vec3 vN, vV, vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = cameraPosition - w.xyz;
  vP = position;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const glass = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: GLASS_VERT, fragmentShader: frag, uniforms, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
const surface = (seg, rings, fn) => {
  const g = new THREE.PlaneGeometry(1, 1, seg, rings);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const [x, y, z] = fn(p.getX(i) + 0.5, p.getY(i) + 0.5); p.setXYZ(i, x, y, z); }
  g.computeVertexNormals();
  return g;
};
const glassMesh = (g, m) => { const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3; return mesh; };

// Stromblatt als Fläche cot θ = tan α · cos(φ − r/R_LC) im Drehrahmen (dreht starr mit): Seite über dem Blatt Cyan, darunter
// Magenta = Feldrichtung wie bei den Windteilchen; von oben die Spirale, von der Seite das S.
const SHEET_FRAG = /* glsl */ `
uniform float uI, uRlc, uFlip;
varying vec3 vN, vV, vP;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV)));
  bool up = gl_FrontFacing != (uFlip > 0.5);
  vec3 col = up ? vec3(0.15, 0.8, 1.0) : vec3(1.0, 0.25, 0.6);
  float x = length(vP) / uRlc;
  float a = (0.04 + 0.4 * pow(1.0 - f, 3.0)) * smoothstep(1.0, 1.2, x) * exp(-(x - 1.0) / 0.9);
  gl_FragColor = vec4(col * a * uI, 1.0);
}`;
export function currentSheet(rlc, tanA) {
  const g = surface(220, 96, (u, v) => {
    const r = rlc * (1.0 + 5.5 * u), phi = v * Math.PI * 2, th = Math.atan2(1, tanA * Math.cos(phi - r / rlc));
    return [r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi)];
  });
  // Vorderseite = Seite über dem Blatt (+y-Anteil der Normale), sonst Farben tauschen
  const n = g.attributes.normal;
  let up = 0;
  for (let i = 0; i < n.count; i += 37) up += n.getY(i);
  return glassMesh(g, glass(SHEET_FRAG, { uI: { value: 1 }, uRlc: { value: rlc }, uFlip: { value: up < 0 ? 1 : 0 } }));
}

// Lichtzylinder als Wand: Fresnel-Rand (hell an der Silhouette), nach oben und unten ausblendend, feine Höhenringe
const WALL_FRAG = /* glsl */ `
uniform float uI, uRlc;
varying vec3 vN, vV, vP;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 4.0);
  float y = vP.y / uRlc;
  float rings = 0.7 + 0.3 * pow(0.5 + 0.5 * cos(y * 31.4), 8.0);
  gl_FragColor = vec4(vec3(0.3, 0.8, 1.0) * f * exp(-y * y * 4.0) * rings * 0.6 * uI, 1.0);
}`;
export function lightCylinderWall(rlc) {
  return glassMesh(new THREE.CylinderGeometry(rlc, rlc, 2.6 * rlc, 180, 1, true), glass(WALL_FRAG, { uI: { value: 1 }, uRlc: { value: rlc } }));
}

// Außenspalt: Fläche der letzten geschlossenen Feldlinie r = R_LC·sin²θ um die Magnetachse (lokal +y) – dort entsteht in
// Außenspalt-Modellen die Gammastrahlung; hell zum Äquator hin, wo die Fläche den Lichtzylinder berührt.
const GAP_FRAG = /* glsl */ `
uniform float uI;
varying vec3 vN, vV, vP;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV)));
  float st = length(vP.xz) / max(length(vP), 1.0);
  gl_FragColor = vec4(vec3(0.72, 0.45, 1.0) * (0.09 * pow(f, 1.5) + 0.07 * pow(1.0 - f, 3.0)) * pow(st, 3.0) * uI, 1.0);
}`;
export function outerGap(rlc, rns) {
  const th0 = Math.asin(Math.sqrt(rns / rlc));
  const g = surface(72, 128, (u, v) => {
    const th = th0 + (Math.PI - 2 * th0) * u, phi = v * Math.PI * 2, r = rlc * Math.sin(th) ** 2;
    return [r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi)];
  });
  return glassMesh(g, glass(GAP_FRAG, { uI: { value: 1 } }));
}

const DOT_FRAG = /* glsl */ `
varying float vA;
varying vec3 vC;
void main() { vec2 d = gl_PointCoord - 0.5; gl_FragColor = vec4(vC * vA * exp(-dot(d, d) * 16.0), 1.0); }`;
// Teilchen auf den geschlossenen Feldlinien (Magnetrahmen): pendeln zwischen den Spiegelpunkten nahe der Oberfläche,
// r = L·sin²θ; innen Cyan, außen Violett wie die Linien selbst
const BEAD_VERT = /* glsl */ `
attribute vec4 aB;   // L, φ, Startphase, Tempo
uniform float uT, uPx, uRns;
varying float vA;
varying vec3 vC;
void main() {
  float th0 = asin(sqrt(uRns / aB.x));
  float tri = abs(2.0 * fract(aB.z + uT * aB.w) - 1.0);
  float th = th0 + (3.14159265 - 2.0 * th0) * tri;
  float r = aB.x * sin(th) * sin(th);
  vec4 mv = modelViewMatrix * vec4(r * sin(th) * cos(aB.y), r * cos(th), r * sin(th) * sin(aB.y), 1.0);
  gl_Position = projectionMatrix * mv;
  vC = mix(vec3(0.6, 0.95, 1.0), vec3(0.7, 0.5, 1.0), smoothstep(40.0, 1300.0, aB.x));
  vA = 1.3;
  gl_PointSize = uPx * 3.4;
}`;
export function fieldBeads(n, Ls, rns) {
  const rand = mulberry32(97);
  const a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) a.set([Ls[Math.floor(rand() * Ls.length)], rand() * Math.PI * 2, rand(), 0.05 + rand() * 0.1], i * 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aB', new THREE.BufferAttribute(a, 4));
  const u = { uT: { value: 0 }, uPx: { value: 1 }, uRns: { value: rns } };
  const p = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: BEAD_VERT, fragmentShader: DOT_FRAG, uniforms: u, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  p.frustumCulled = false; p.renderOrder = 4; p.userData.u = u;
  return p;
}

// Streifen-Netz: radiale Linien im Drehrahmen, Farbe = Feldrichtung cot θ − tan α · cos(φ − r/R_LC) (Cyan über, Magenta
// unter dem Stromblatt). Im mitdrehenden Rahmen steht das Muster still – die Linien dürfen deshalb feste Geometrie sein;
// eine Helligkeitswelle läuft mit c (uFlow = Weg des Winds) nach außen und zeigt die Strömung.
const NET_VERT = /* glsl */ `
attribute vec3 aC;
attribute float aA, aR;
uniform float uFlow, uRlc, uI;
varying vec3 vC;
varying float vA;
void main() {
  vC = aC;
  vA = aA * (0.8 + 0.2 * cos((aR - uFlow) / (0.35 * uRlc))) * uI;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const NET_FRAG = 'varying vec3 vC; varying float vA; void main() { gl_FragColor = vec4(vC * vA, 1.0); }';
export function stripeNet(rlc, tanA, nPhi = 36, nTh = 7, nR = 150) {
  const pos = [], col = [], al = [], rad = [];
  for (let i = 0; i < nPhi; i++) {
    const phi = (i / nPhi) * Math.PI * 2;
    for (let j = 0; j < nTh; j++) {
      const th = Math.PI / 2 + ((j - (nTh - 1) / 2) / ((nTh - 1) / 2)) * 0.63;
      let prev = null;
      for (let k = 0; k <= nR; k++) {
        const f = k / nR, r = rlc * (1.05 + 10 * f);
        const pol = Math.cos(th) / Math.sin(th) - tanA * Math.cos(phi - r / rlc);
        const c = pol > 0 ? [0.2, 0.8, 1.0] : [1.0, 0.25, 0.6];
        const a = Math.min(1, Math.abs(pol) / 0.25) * (1 - f) ** 1.6 * 0.3 * Math.sin(th) ** 2;
        const p = [r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi), ...c, a, r];
        if (prev) { pos.push(...prev.slice(0, 3), ...p.slice(0, 3)); col.push(...prev.slice(3, 6), ...p.slice(3, 6)); al.push(prev[6], p[6]); rad.push(prev[7], p[7]); }
        prev = p;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aC', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aA', new THREE.Float32BufferAttribute(al, 1));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(rad, 1));
  const u = { uFlow: { value: 0 }, uRlc: { value: rlc }, uI: { value: 1 } };
  const l = new THREE.LineSegments(g, new THREE.ShaderMaterial({ vertexShader: NET_VERT, fragmentShader: NET_FRAG, uniforms: u, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  l.frustumCulled = false; l.renderOrder = 4; l.userData.u = u;
  return l;
}
