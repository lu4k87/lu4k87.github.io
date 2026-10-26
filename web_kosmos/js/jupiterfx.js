// Jupiter-Polarlicht und Magnetosphäre (Station Sonnensystem), Einheit = Jupiterradius, Kind des Planetenkörpers (dreht mit).
// Schema, kein Messbild: Hauptoval ≈ 14° vom Magnetpol (Dipolneigung 9,6°, JUNO/Hubble heic1613), Polwirbel, Polar-Flares,
// Fußpunkte von Io, Europa, Ganymed (Schweif ostwärts), Magnetscheibe mit Spiralarmen, gestreckte Feldlinien, Teilchenregen.
// Teile einzeln schaltbar: jupiterAurora(detail) → Gruppe, g.userData.parts = { oval, cap, disk, lines, flow }, g.userData.capU = { uSwirl, uFlare, uFoot };
// auroraLayers(g) = Zahnrad-Ebenen dazu, gleich in den Stationen Sonnensystem und Jupiter & Monde.
import * as THREE from 'three';
import { NOISE } from './glsl.js';
const TILT = 9.6 * Math.PI / 180;
const add = { blending: THREE.AdditiveBlending, depthWrite: false, transparent: true };
// Breite des Hauptovals (Kobreite in Grad vom Magnetpol), Norden nierenförmig, Süden runder – gleiche Formel in GLSL
const OVAL = /* glsl */ `
float ovalC(float u, float hem) {
  return hem > 0.0 ? 14.0 + 3.0 * sin(2.0 * u + 0.6) + 2.2 * cos(u - 0.4) : 12.0 + 1.2 * sin(2.0 * u) + 0.8 * cos(u + 1.0);
}
`;
const CURTAIN_VERT = /* glsl */ `
${NOISE}
${OVAL}
attribute vec3 aU;   // u, Höhe 0..1, Blatt w
attribute float aH;  // Halbkugel
uniform float uT;
varying float vV, vU, vW, vH;
void main() {
  float u = aU.x, w = aU.z;
  float c = ovalC(u, aH) + 1.8 * w + 0.12 * sin(u * 14.0 - uT * 0.4 + w * 3.0) + 0.5 * gnoise(vec3(cos(u) * 4.0, sin(u) * 4.0, uT * 0.05 + w));
  c = radians(c);
  vec3 dir = vec3(sin(c) * cos(u), aH * cos(c), sin(c) * sin(u));
  vV = aU.y; vU = u; vW = w; vH = aH;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * (1.004 + 0.04 * aU.y), 1.0);
}`;
const CURTAIN_FRAG = /* glsl */ `
${NOISE}
uniform float uT;
varying float vV, vU, vW, vH;
void main() {
  float rays = ridged(vec3(cos(vU) * 60.0, sin(vU) * 60.0, uT * 0.3 + vW * 9.0), 2);
  float wave = 0.6 + 0.4 * sin(vU * 9.0 - uT * 0.35 + vW * 2.0);
  // Morgensturm: ein Sektor hellt alle 18 s auf und klingt ab
  float ph = fract(uT / 18.0);
  float storm = exp(-pow(atan(sin(vU - 1.2), cos(vU - 1.2)) / 0.35, 2.0)) * smoothstep(0.0, 0.1, ph) * (1.0 - smoothstep(0.35, 0.9, ph));
  float up = 0.65 + 0.35 * sin(vV * 10.0 - uT * 1.8 + vU * 25.0);
  float prof = smoothstep(0.0, 0.05, vV) * pow(max(1.0 - vV, 0.0), 1.5);
  vec3 col = mix(vec3(0.75, 0.85, 1.0), vec3(0.62, 0.38, 1.0), smoothstep(0.1, 0.8, vV));
  float b = (0.35 + 0.9 * rays * rays) * wave * up * (1.0 + 2.2 * storm) * (vH > 0.0 ? 1.0 : 0.8);
  gl_FragColor = vec4(col * b * prof * 0.85, 1.0);
}`;
// Polkappe: Wirbel im Inneren des Ovals, Polar-Flares, Fußpunkte der Monde mit Schweif
const CAP_VERT = 'varying vec3 vL; varying vec3 vN; varying vec3 vP; void main() { vL = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const CAP_FRAG = /* glsl */ `
${NOISE}
${OVAL}
uniform float uT, uSwirl, uFlare, uFoot;
uniform vec3 uMoons;   // Länge der Fußpunkte Io, Europa, Ganymed (Rahmen des Planeten)
varying vec3 vL, vN, vP;
float foot(float lon, float colat, float c0, float u, float c, float hem) {
  float du = atan(sin(u - lon), cos(u - lon));
  float spot = exp(-pow((c - c0) / 0.9, 2.0) - pow(du * sin(radians(c0)) / 0.025, 2.0));
  float tail = exp(-pow((c - c0) / 0.6, 2.0)) * (du < 0.0 ? exp(du / 0.9) : 0.0) * smoothstep(0.0, -0.03, du);
  return spot * 3.2 + tail * 0.7;
}
void main() {
  vec3 p = normalize(vL);
  float hem = p.y >= 0.0 ? 1.0 : -1.0;
  float c = degrees(acos(abs(p.y)));
  if (c > 30.0) discard;
  float u = atan(p.z, p.x);
  float oc = ovalC(u, hem);
  // Wirbel im Polgebiet: Flecken drehen langsam gegen den Planeten, Spiralarme
  float r = c / oc;
  float sw = fbm(vec3(cos(u + uT * 0.06 + r * 2.5) * r * 3.0, sin(u + uT * 0.06 + r * 2.5) * r * 3.0, uT * 0.04 + hem), 4);
  float swirl = smoothstep(-0.1, 0.6, sw) * smoothstep(1.0, 0.75, r) * 0.35 * uSwirl;
  // Polar-Flares: einzelne Flecken leuchten auf (Zyklus 7–11 s)
  float fl = 0.0;
  for (int i = 0; i < 3; i++) {
    if (uFlare < 0.5) break;
    float fi = float(i);
    float per = 7.0 + 2.0 * fi, ph = fract(uT / per + fi * 0.37);
    vec2 at = vec2(cos(fi * 2.3 + floor(uT / per + fi * 0.37) * 1.7), sin(fi * 2.3 + floor(uT / per + fi * 0.37) * 1.7)) * 0.45 * oc;
    vec2 q = vec2(cos(u), sin(u)) * c;
    fl += exp(-dot(q - at, q - at) / 4.0) * smoothstep(0.0, 0.15, ph) * (1.0 - smoothstep(0.2, 0.7, ph));
  }
  float io = foot(uMoons.x, hem > 0.0 ? 24.0 : 22.5, 0.0, u, c, hem);
  float eu = foot(uMoons.y, hem > 0.0 ? 18.5 : 17.5, 0.0, u, c, hem);
  float ga = foot(uMoons.z, hem > 0.0 ? 16.8 : 16.0, 0.0, u, c, hem);
  float mu = max(dot(normalize(vN), normalize(cameraPosition - vP)), 0.0);
  vec3 col = vec3(0.55, 0.45, 1.0) * swirl + vec3(0.8, 0.75, 1.0) * fl * 0.9 + vec3(0.9, 0.85, 1.0) * (io + 0.6 * eu + 0.5 * ga) * uFoot;
  gl_FragColor = vec4(col / (mu + 0.45) * 0.55, 1.0);
}`;
function curtainGeo() {
  const N = 300, W = [0.1, 0.45, 0.85], a = [], h = [], idx = [];
  let base = 0;
  for (const hem of [1, -1]) for (const w of W) {
    for (let i = 0; i <= N; i++) for (const v of [0, 1]) { a.push((i / N) * Math.PI * 2, v, w); h.push(hem); }
    for (let i = 0; i < N; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    base += (N + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base * 3), 3));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(a, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(h, 1));
  g.setIndex(idx);
  return g;
}
// Teilchen auf Dipol-Feldlinien r = L·sin²θ (Magnetrahmen), je Zeile: Länge, L, Phase, Halbkugel; f läuft 0 → 1 zum Fußpunkt
const FLOW_VERT = /* glsl */ `
attribute vec4 aS;
uniform float uT, uPx, uSpeed, uLonRate, uLon0;
varying float vA, vF;
void main() {
  float f = fract(aS.z + uT * uSpeed);
  float L = aS.y;
  float thF = asin(sqrt(1.01 / L));
  float th = mix(1.5707963, thF, pow(f, 0.8));
  float r = L * pow(sin(th), 2.0);
  float lon = aS.x + uLon0 - uT * uLonRate;
  vec3 dir = vec3(sin(th) * cos(lon), aS.w * cos(th), sin(th) * sin(lon));
  vec4 mv = modelViewMatrix * vec4(dir * r, 1.0);
  gl_Position = projectionMatrix * mv;
  vF = f;
  vA = smoothstep(0.0, 0.1, f) * (1.0 - smoothstep(0.97, 1.0, f));
  gl_PointSize = uPx * (1.4 + 2.6 * smoothstep(0.85, 1.0, f));
}`;
const FLOW_FRAG = /* glsl */ `
uniform vec3 uC;
varying float vA, vF;
void main() { vec2 d = gl_PointCoord - 0.5; gl_FragColor = vec4(mix(uC, vec3(0.95, 0.9, 1.0), vF * vF) * vA * exp(-dot(d, d) * 14.0), 1.0); }`;
function flow(rows, U, color) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rows.length * 3), 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(rows.flat(), 4));
  const m = new THREE.ShaderMaterial({ vertexShader: FLOW_VERT, fragmentShader: FLOW_FRAG, uniforms: { ...U, uC: { value: new THREE.Color(...color) } }, ...add });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}
function fieldLine(L, lon, hems = [1, -1], n = 90) {
  const pts = [];
  for (const hem of hems) {
    const thF = Math.asin(Math.sqrt(1.01 / L));
    for (let i = 0; i <= n; i++) {
      const th = Math.PI / 2 + (thF - Math.PI / 2) * (i / n), r = L * Math.sin(th) ** 2;
      pts.push(new THREE.Vector3(Math.sin(th) * Math.cos(lon) * r, hem * Math.cos(th) * r, Math.sin(th) * Math.sin(lon) * r));
    }
  }
  return pts;
}
export function jupiterAurora(detail = 1) {
  const g = new THREE.Group();
  const mag = new THREE.Group();
  mag.rotation.x = TILT;
  g.add(mag);
  let s = 5;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const U = { uT: { value: 0 }, uPx: { value: 1 } };
  const curtain = new THREE.Mesh(curtainGeo(), new THREE.ShaderMaterial({ vertexShader: CURTAIN_VERT, fragmentShader: CURTAIN_FRAG, uniforms: U, side: THREE.DoubleSide, ...add }));
  curtain.frustumCulled = false;
  mag.add(curtain);
  const moons = new THREE.Vector3(0.4, 2.1, 4.0);
  const capU = { ...U, uMoons: { value: moons }, uSwirl: { value: 1 }, uFlare: { value: 1 }, uFoot: { value: 1 } };
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1.003, 128, 64), new THREE.ShaderMaterial({ vertexShader: CAP_VERT, fragmentShader: CAP_FRAG, uniforms: capU, ...add }));
  mag.add(cap);
  // Monde laufen langsamer um als der Planet dreht → im mitdrehenden Rahmen rückwärts (Zeitraffer, Schema)
  const RATE = { io: 0.12, eu: 0.14, ga: 0.15 };
  // Plasmascheibe: dreht innen mit, außen bleibt sie zurück → Spiralarme
  const disk = new THREE.Mesh(new THREE.RingGeometry(5, 42, 256, 8), new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide, ...add,
    vertexShader: 'varying vec2 vQ; void main() { vQ = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${NOISE}
uniform float uT;
varying vec2 vQ;
void main() {
  float r = length(vQ), a = atan(vQ.y, vQ.x);
  float lag = a + log(r) * 2.2 - uT * 0.25 / (1.0 + r / 20.0);
  float arms = pow(0.5 + 0.5 * cos(2.0 * lag), 3.0);
  float n = 0.5 + 0.5 * fbm(vec3(cos(lag) * r * 0.25, sin(lag) * r * 0.25, uT * 0.03), 3);
  float fall = smoothstep(5.0, 9.0, r) * (1.0 - smoothstep(25.0, 42.0, r));
  gl_FragColor = vec4(vec3(0.45, 0.5, 1.0) * (0.25 + arms) * n * fall * 0.09, 1.0);
}` }));
  disk.rotation.x = -Math.PI / 2;
  mag.add(disk);
  const lines = new THREE.Group();
  mag.add(lines);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x7f9cff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let k = 0; k < 18; k++) for (const L of [16, 26]) lines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fieldLine(L + (k % 3) * 3, (k / 18) * Math.PI * 2, [1]).concat(fieldLine(L + (k % 3) * 3, (k / 18) * Math.PI * 2, [-1]).reverse())), lineMat));
  const rows = [];
  for (let i = 0, n = Math.round(7000 * detail); i < n; i++) rows.push([rnd() * Math.PI * 2, 15 + rnd() * 25, rnd(), rnd() < 0.55 ? 1 : -1]);
  const stream = flow(rows, { ...U, uSpeed: { value: 0.06 }, uLonRate: { value: 0 }, uLon0: { value: 0 } }, [0.5, 0.65, 1.0]);
  mag.add(stream);
  g.userData.update = (t) => {
    U.uT.value = t;
    moons.set(0.4 - t * RATE.io, 2.1 - t * RATE.eu, 4.0 - t * RATE.ga);
  };
  g.userData.U = U;
  g.userData.capU = capU;
  g.userData.parts = { oval: curtain, cap, disk, lines, flow: stream };
  return g;
}
export function auroraLayers(g) {
  const P = g.userData.parts, U = g.userData.capU;
  return [
    { id: 'jOval', type: 'toggle', group: 'Jupiter-Polarlicht', label: 'Hauptoval (UV-Falschfarbe)', value: true, set: (v) => { P.oval.visible = P.cap.visible = v; },
      hint: 'Schema: Oval ≈ 14° vom Magnetpol (Dipolneigung 9,6°), Norden nierenförmig, Süden runder. Echt leuchtet es im UV; die Farbe ist Falschfarbe.' },
    { id: 'jSwirl', type: 'toggle', label: 'Polwirbel', value: true, sub: true, set: (v) => { U.uSwirl.value = v ? 1 : 0; } },
    { id: 'jFlares', type: 'toggle', label: 'Polar-Flares', value: true, sub: true, set: (v) => { U.uFlare.value = v ? 1 : 0; } },
    { id: 'jFeet', type: 'toggle', label: 'Fußpunkte von Io, Europa, Ganymed', value: true, sub: true, set: (v) => { U.uFoot.value = v ? 1 : 0; },
      hint: 'Die Monde ziehen Spuren ins Polarlicht; ihr Umlauf ist hier im Zeitraffer, die Lagen sind schematisch.' },
    { id: 'jDisk', type: 'toggle', group: 'Jupiter-Magnetosphäre', label: 'Magnetscheibe mit Spiralarmen', value: true, set: (v) => { P.disk.visible = v; } },
    { id: 'jLines', type: 'toggle', label: 'Gestreckte Feldlinien', value: true, set: (v) => { P.lines.visible = v; } },
    { id: 'jFlow', type: 'toggle', label: 'Teilchenströme ins Oval', value: true, set: (v) => { P.flow.visible = v; } },
  ];
}
