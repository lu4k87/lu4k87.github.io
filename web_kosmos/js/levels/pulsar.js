// Station 6: Crab-Pulsar (Einheit 1 km). Neutronenstern R ≈ 13 km (NICER), Drehachse = +y, Magnetachse um 45° geneigt
// (Modellwert, umstritten). Bildaufbau nach drei Vorlagen (Leuchtturm-Strahlen, wirbelnde Feldlinien, Wind-Spirale mit
// Leuchtring), jedes Element aus der Physik abgeleitet:
// - Strahlkegel entlang der Magnetachse: heller Kern, hohler Rand wie im Radio; der zweite Kegel gibt den Zwischenpuls.
// - Geschlossene Feldlinien des Dipols r = L·sin²θ bis an den Lichtzylinder R_LC = c·P/2π (innen Cyan, außen Violett).
// - Offene Feldlinien verlassen die Polkappen und wickeln sich jenseits von R_LC zur nachlaufenden Spirale auf:
//   φ wächst um r/R_LC, weil das Feld außen der Drehung nicht nachkommt.
// - Lichtzylinder als Leuchtring in der Äquatorebene (erst im Überblick): eine gedachte Grenze, keine Materie.
// - Gestreifter Wind: Teilchen strömen mit ≈ c hinaus, gebündelt um das Stromblatt, an dem das Feld umkehrt. Ballistisch
//   (Wind mit c, der Magnet-Äquator dreht mit) liegt das Blatt bei cot θ = tan α · cos(φ + Φ − r/R_LC), Φ = Drehwinkel
//   (eigene Rechnung): von der Seite ein S, in der Äquatorebene eine zweiarmige Spirale (als Linie eingezeichnet). Farbe = Feldrichtung (Cyan über, Magenta unter dem
//   Blatt), schematisch.
// - Polstrahlen (Jets) entlang der Drehachse schematisch nah am Stern; im Krebsnebel sieht man sie erst Lichtjahre draußen.
// Zeitlupe, weil 30 Blitze pro Sekunde ein Anfallsrisiko wären (WCAG 2.3.1); der Ton spielt den echten Takt: Hauptpuls und
// Zwischenpuls bei 0,4 der Periode. Lichtkurve: Pulsprofil des Crab mit laufender Phasenmarke – die Erde liegt in +z.

import * as THREE from 'three';
import { volume, disposeScene } from '../vol.js';
import { C, lightCylinder, julianDate, mulberry32 } from '../astro.js';
import { createStarfield } from '../stars.js';
import { NOISE, SKY_VERTEX } from '../glsl.js';

const R_NS = 13;
// Periode heute aus ATNF (P = 33,3924 ms bei MJD 48442,5; Ṗ = 4,2097·10⁻¹³) – eigene Rechnung ohne Bremsindex
const P_NOW = (date) => 0.0333924123 + 4.20972e-13 * ((julianDate(date) - 2400000.5 - 48442.5) * 86400);
const ALPHA = 45 * Math.PI / 180;
const TAU = Math.PI * 2;
// Lage des Stromblatts (Polwinkel θ) in Richtung φ im Abstand r beim Drehwinkel ph – gleiche Formel wie in den Shadern
const sheetTheta = (phi, r, ph, rlc) => Math.atan2(1, Math.tan(ALPHA) * Math.cos(phi + ph - r / rlc));

// Volumen: Strahlkegel, Polkappen, Polstrahlen. Jeder Anteil nur dort gerechnet, wo er etwas beiträgt. Das Stromblatt
// zeigen die Teilchen: als leuchtende Fläche bildete es dort, wo man es streifend sieht, eine harte helle Kante.
const BEAM_BODY = /* glsl */ `
uniform vec3 uM;       // Magnetachse (Welt)
uniform float uGain, uRlc, uWT, uJet;
void sampleVol(vec3 p, out vec3 e, out float s) {
  float r = length(p);
  s = 0.0;
  e = vec3(0.0);
  if (r < 13.5) return;
  vec3 d = p / r;
  float edge = 1.0 - smoothstep(0.45 * uR, uR, r);
  // Strahlkegel: heller Kern + hohler Rand; Hauptpol stärker als der Pol des Zwischenpulses
  float c = dot(d, uM);
  float ang = acos(min(abs(c), 1.0));
  if (ang < 0.6) {
    float pole = c > 0.0 ? 1.0 : 0.62;
    float fall = edge / (1.0 + pow(r / 380.0, 1.5));
    float core = exp(-pow(ang / 0.045, 2.0)), rim = exp(-pow((ang - 0.12) / 0.045, 2.0)), halo = exp(-pow(ang / 0.3, 2.0));
    e += (vec3(0.82, 0.97, 1.0) * core * 1.3 + vec3(0.3, 0.82, 1.0) * rim * 0.4 + vec3(0.25, 0.45, 1.0) * halo * 0.02) * fall * pole * uGain;
    // Polkappen-Glühen nahe der Oberfläche
    e += vec3(0.6, 0.85, 1.0) * exp(-pow(ang / 0.25, 2.0)) * exp(-(r - 13.0) / 6.0) * 2.0 * uGain;
  }
  // Polstrahlen entlang der Drehachse (+y); die Knoten wandern mit dem Wind hinaus
  if (abs(d.y) > 0.93 && r > 0.2 * uRlc) {
    float angS = acos(min(abs(d.y), 1.0));
    float jet = exp(-pow(angS / (0.028 + 18.0 / r), 2.0)) * smoothstep(0.25 * uRlc, 0.9 * uRlc, r) / (1.0 + pow(r / uRlc, 3.0));
    float knots = 0.55 + 0.45 * gnoise(vec3((r - uWT) * 0.0035, d.x * 9.0, d.z * 9.0));
    e += vec3(0.78, 0.74, 1.0) * jet * knots * edge * uJet;
  }
}
`;

// Oberfläche ≈ 10⁶ K: blauweiß und selbstleuchtend; die Lichtablenkung zeigt mehr als die halbe Kugel, deshalb kaum
// Randverdunkelung. Heiße Polkappen an der Magnetachse, leichte Fleckung der Kruste (dreht mit).
const NS_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uM;
varying vec3 vN, vP, vL;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float mu = max(dot(N, V), 0.0);
  float pa = acos(clamp(abs(dot(N, uM)), 0.0, 1.0));
  float cap = exp(-pow(pa / 0.16, 2.0)), warm = exp(-pow(pa / 0.55, 2.0));
  float mott = 0.82 + 0.18 * fbm(vL * 0.35, 3);
  float limb = 0.85 + 0.55 * pow(1.0 - mu, 2.5);
  vec3 col = vec3(0.6, 0.76, 1.0) * 1.35 * limb * mott + vec3(0.85, 0.94, 1.0) * (cap * 7.0 + warm * 0.7);
  gl_FragColor = vec4(col, 1.0);
}
`;
const NS_VERT = /* glsl */ `
varying vec3 vN, vP, vL;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vL = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const BILLBOARD_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// Lichthof um den Stern (zur Kamera gedreht): weicher Abfall, wird vom Stern selbst verdeckt
const GLOW_FRAG = /* glsl */ `
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0 * 8.0;   // in Sternradien (Fläche 16 R breit)
  float x = max(r - 1.0, 0.0);
  float g = 0.45 * exp(-x / 0.35) + 0.08 / (1.0 + x * x * 0.6);
  gl_FragColor = vec4(vec3(0.62, 0.78, 1.0) * g * smoothstep(8.0, 5.0, r), 1.0);
}
`;
// Glanz aus der Ferne: wächst mit dem Abstand, damit der Stern im Überblick ein heller Punkt mit Strahlenkranz bleibt
const GLARE_FRAG = /* glsl */ `
uniform float uI;
varying vec2 vUv;
void main() {
  vec2 q = (vUv - 0.5) * 2.0;
  float r = length(q), a = atan(q.y, q.x);
  float g = 0.9 * exp(-r / 0.012) + 0.2 * exp(-r / 0.06) + 0.045 * exp(-r / 0.25);
  g += pow(abs(cos(2.0 * a)), 90.0) * exp(-r / 0.18) * 0.32 + pow(abs(cos(2.0 * a + 0.785)), 160.0) * exp(-r / 0.08) * 0.1;
  gl_FragColor = vec4(vec3(0.75, 0.9, 1.0) * g * smoothstep(1.0, 0.6, r) * uI, 1.0);
}
`;

// Himmel im Inneren des Krebsnebels: bläulicher Synchrotron-Schein, rote Filamente am Rand
const NEB_SKY = /* glsl */ `
${NOISE}
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float f = ridged(d * 3.0 + 2.0, 4);
  vec3 col = vec3(0.025, 0.04, 0.075) * (0.6 + 0.6 * fbm(d * 2.5, 4)) + vec3(0.12, 0.025, 0.012) * pow(max(f - 0.6, 0.0) * 2.5, 2.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

// Linien mit Farbverlauf nach dem Abstand vom Stern (innen uColor, außen uColor2)
const LINE_FRAG = /* glsl */ `
uniform vec3 uColor, uColor2;
uniform float uR0, uR1;
varying float vA, vR;
void main() { gl_FragColor = vec4(mix(uColor, uColor2, smoothstep(uR0, uR1, vR)) * vA, 1.0); }
`;
const LINE_VERT = /* glsl */ `
attribute float alpha;
varying float vA, vR;
void main() { vA = alpha; vR = length(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// Leuchtring (Torus): hell, wo die Röhre zur Kamera zeigt – wirkt aus jedem Blickwinkel wie ein weicher Lichtstrang
const RING_VERT = /* glsl */ `
varying vec3 vN, vV;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = cameraPosition - w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const RING_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uK, uI;
varying vec3 vN, vV;
void main() { gl_FragColor = vec4(uColor * pow(abs(dot(normalize(vN), normalize(vV))), uK) * uI, 1.0); }
`;

// Gestreifter Wind: Teilchen fliegen geradlinig (ballistisch) mit knapp c hinaus. Ihre Farbe ist die Feldrichtung an ihrem
// Ort: Vorzeichen von cot θ − tan α · cos(φ + Φ − r/R_LC) (Cyan über, Magenta unter dem Stromblatt) – in der Äquatorebene
// ergibt das die zweiarmige Spirale; am Blatt selbst leuchten sie heller. Jedes siebte Teilchen sitzt als Spur direkt
// auf dem Blatt (von der Seite das S). Kopf = Teilchen, Schweif radial nach innen; Punkte und Striche teilen den Rechenweg.
const WIND_VERT = /* glsl */ `
attribute vec4 aP;     // φ, Wegphase 0..1, θ (Wind) bzw. Abstand zum Stromblatt (Spur, Polstrahl), Tempo
attribute float aK;    // 0 = Spur auf dem Stromblatt, 2 = gestreifter Wind, +1/−1 = Polstrahl Nord/Süd
attribute float aEnd;  // Striche: 0 = Kopf, 1 = Schweif
uniform float uT, uRlc, uLen, uPhase, uTanA, uPx, uStreak, uCam;
varying float vA;
varying vec3 vC;
void main() {
  float d = mod(aP.y * uLen + uT * aP.w, uLen);
  float f = d / uLen;
  float r0 = aK == 0.0 ? 1.03 * uRlc : 0.35 * uRlc;
  float r = r0 + d;
  float th, w;
  if (aK == 0.0) {
    th = clamp(atan(1.0, uTanA * cos(aP.x + uPhase - r / uRlc)) + aP.z, 0.06, 3.08);
    w = 0.6;
    vC = vec3(0.75, 0.93, 1.0);
  } else if (aK == 2.0) {
    th = aP.z;
    float pol = cos(th) / max(sin(th), 1e-3) - uTanA * cos(aP.x + uPhase - r / uRlc);
    vC = mix(vec3(1.0, 0.2, 0.55), vec3(0.18, 0.78, 1.0), smoothstep(-0.12, 0.12, pol));
    w = 0.6 + 0.4 * exp(-pow(pol / 0.12, 2.0));
  } else {
    th = aK > 0.0 ? abs(aP.z) : 3.14159265 - abs(aP.z);
    w = 0.35;
    vC = vec3(0.8, 0.75, 1.0);
  }
  vec3 dir = vec3(sin(th) * cos(aP.x), cos(th), sin(th) * sin(aP.x));
  float rr = max(r - aEnd * uStreak * (0.35 + 0.65 * f), r0);
  vec4 mv = modelViewMatrix * vec4(dir * rr, 1.0);
  gl_Position = projectionMatrix * mv;
    // weich über den ganzen Weg ausblenden: keine helle Außenkante der Teilchenhülle
  vA = smoothstep(0.0, 0.03, f) * pow(1.0 - f, abs(aK) == 1.0 ? 9.0 : 1.2) * w * (1.0 - aEnd);
  // dicht vor der Kamera ausblenden: sonst zögen Schweife quer durchs Bild
  vA *= smoothstep(0.1, 0.35, -mv.z / uCam);
  gl_PointSize = uPx * (1.2 + 1.5 * w);
}
`;
const WIND_DOT = /* glsl */ `
varying float vA;
varying vec3 vC;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  gl_FragColor = vec4(vC * vA * exp(-dot(d, d) * 16.0), 1.0);
}
`;
const WIND_LINE = /* glsl */ `
varying float vA;
varying vec3 vC;
void main() { gl_FragColor = vec4(vC * vA * 0.4, 1.0); }
`;
function buildWind(n, rlc) {
  const rand = mulberry32(61);
  const P = new Float32Array(n * 4), K = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let o, k;
    const u = rand();
    if (u < 0.15) { k = 0; o = (rand() * 2 - 1) * 0.04; }   // Spur auf dem Stromblatt
    else if (u < 0.97) {
      // gestreifter Wind: Breite gebündelt zur Äquatorebene (σ ≈ 16°, höchstens ≈ 47°), Richtung bleibt fest
      k = 2;
      o = Math.PI / 2 - (rand() + rand() + rand() - 1.5) * 0.55;
    } else { k = rand() < 0.5 ? 1 : -1; o = rand() * 0.05; }   // Polstrahl
    // Tempo knapp unter c: die Streifen sind im Wind eingefroren, ein Teilchen behält seine Farbe fast immer
    P.set([rand() * TAU, rand(), o, 0.9 + rand() * 0.1], i * 4);
    K[i] = k;
  }
  const uniforms = {
    uT: { value: 0 }, uRlc: { value: rlc }, uLen: { value: rlc * 11 }, uPhase: { value: 0 }, uTanA: { value: Math.tan(ALPHA) },
    uPx: { value: 1 }, uStreak: { value: rlc * 0.45 }, uCam: { value: 8000 },
  };
  const mat = (frag) => new THREE.ShaderMaterial({ vertexShader: WIND_VERT, fragmentShader: frag, uniforms, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  // Punkte: ein Eckpunkt je Teilchen · Striche: Kopf + Schweif je Teilchen
  const dots = new THREE.BufferGeometry();
  dots.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  dots.setAttribute('aP', new THREE.BufferAttribute(P, 4));
  dots.setAttribute('aK', new THREE.BufferAttribute(K, 1));
  dots.setAttribute('aEnd', new THREE.BufferAttribute(new Float32Array(n), 1));
  const P2 = new Float32Array(n * 8), K2 = new Float32Array(n * 2), E2 = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    P2.set(P.subarray(i * 4, i * 4 + 4), i * 8);
    P2.set(P.subarray(i * 4, i * 4 + 4), i * 8 + 4);
    K2[i * 2] = K2[i * 2 + 1] = K[i];
    E2[i * 2 + 1] = 1;
  }
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  lines.setAttribute('aP', new THREE.BufferAttribute(P2, 4));
  lines.setAttribute('aK', new THREE.BufferAttribute(K2, 1));
  lines.setAttribute('aEnd', new THREE.BufferAttribute(E2, 1));
  const group = new THREE.Group();
  const pts = new THREE.Points(dots, mat(WIND_DOT)), seg = new THREE.LineSegments(lines, mat(WIND_LINE));
  for (const o of [pts, seg]) { o.frustumCulled = false; o.renderOrder = 4; group.add(o); }
  group.userData.uniforms = uniforms;
  return group;
}

// Pulsprofil (schematisch nach dem optischen Crab-Profil): Hauptpuls scharf, Zwischenpuls bei 0,4 P schwächer und breiter
const profile = (f) => 0.03 + Math.exp(-(((f - 0.5) / 0.018) ** 2)) + 0.42 * Math.exp(-(((f - 0.9) / 0.03) ** 2)) + 0.06 * Math.exp(-(((f - 0.5) / 0.08) ** 2));

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 60000);
  const P = P_NOW(ctx.date);
  const RLC = lightCylinder(P) / 1e3;
  let slow = 200, phase = 0;

  scene.add(createStarfield({ gain: 0.6, seed: 61, band: 0.4 }));
  const stars = scene.children[0];
  const skyMat = new THREE.ShaderMaterial({ vertexShader: `${SKY_VERTEX}\nvarying vec3 vDir; void main() { vDir = position; gl_Position = skyPosition(normalize(position)); }`, fragmentShader: NEB_SKY, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true });
  const neb = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
  neb.frustumCulled = false;
  neb.renderOrder = -12;
  scene.add(neb);

  const spin = new THREE.Group();
  scene.add(spin);
  const mag = new THREE.Group();
  mag.rotation.z = ALPHA;
  spin.add(mag);
  const mWorld = new THREE.Vector3();

  const nsMat = new THREE.ShaderMaterial({ vertexShader: NS_VERT, fragmentShader: NS_FRAG, uniforms: { uM: { value: mWorld } } });
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(R_NS, 64, 32), nsMat));
  const additive = { blending: THREE.AdditiveBlending, depthWrite: false, transparent: true };
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(R_NS * 16, R_NS * 16), new THREE.ShaderMaterial({ vertexShader: BILLBOARD_VERT, fragmentShader: GLOW_FRAG, ...additive }));
  glow.renderOrder = 2;
  scene.add(glow);
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: BILLBOARD_VERT, fragmentShader: GLARE_FRAG, uniforms: { uI: { value: 1 } }, ...additive }));
  glare.renderOrder = 5;
  scene.add(glare);

  const lineMat = (c, c2 = c, r0 = 0, r1 = 1) => new THREE.ShaderMaterial({
    vertexShader: LINE_VERT, fragmentShader: LINE_FRAG,
    uniforms: { uColor: { value: new THREE.Color(c) }, uColor2: { value: new THREE.Color(c2) }, uR0: { value: r0 }, uR1: { value: r1 } }, ...additive,
  });
  const addLine = (parent, pts, al, m) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('alpha', new THREE.Float32BufferAttribute(al, 1));
    parent.add(new THREE.Line(g, m));
  };
  // Geschlossene Feldlinien im Rahmen der Magnetachse (lokal +y): r = L·sin²θ, θ vom Pol gemessen
  const closed = lineMat(0x86e6ff, 0x8a72ff, 40, 1300);
  const Ls = [20, 30, 44, 64, 95, 140, 210, 320, 480, 720, 1050, RLC * 0.97];
  for (const L of Ls) {
    const th0 = Math.asin(Math.sqrt(R_NS / L));
    for (let k = 0; k < 10; k++) {
      const phi = (k / 10) * TAU + (L % 7) * 0.1;
      const pts = [], al = [];
      for (let i = 0; i <= 160; i++) {
        const th = th0 + (Math.PI - 2 * th0) * (i / 160);
        const r = L * Math.sin(th) ** 2;
        pts.push(r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi));
        al.push((0.5 + 0.5 * Math.sin(th)) * (L === Ls[Ls.length - 1] ? 0.9 : 0.42) * Math.min(1, 90 / L + 0.3));
      }
      addLine(mag, pts, al, closed);
    }
  }
  // Offene Feldlinien: vom Polkappenrand dem Dipol folgend bis 0,9 R_LC, dann radial hinaus und um die Drehachse
  // nachlaufend aufgewickelt (φ + Δr/R_LC) – im Rahmen der Drehung, damit die Spirale starr mitdreht wie das Feld
  const open = lineMat(0x9fb4ff, 0xc070ff, 600, 6000);
  const ca = Math.cos(ALPHA), sa = Math.sin(ALPHA);
  for (const pole of [1, -1]) {
    for (let k = 0; k < 12; k++) {
      const phi = (k / 12) * TAU;
      const L = RLC * (1.15 + (k % 3) * 0.5);
      const th0 = Math.asin(Math.sqrt(R_NS / L)), th1 = Math.asin(Math.sqrt((0.9 * RLC) / L));
      const pts = [], al = [];
      let end = null;
      for (let i = 0; i <= 90; i++) {
        const th = th0 + (th1 - th0) * (i / 90);
        const r = L * Math.sin(th) ** 2;
        const x = r * Math.sin(th) * Math.cos(phi), y = pole * r * Math.cos(th), z = r * Math.sin(th) * Math.sin(phi);
        end = [x * ca - y * sa, x * sa + y * ca, z];   // Magnetrahmen → Drehrahmen (Rz(α))
        pts.push(...end);
        al.push(0.4);
      }
      const r1 = Math.hypot(...end), thE = Math.acos(end[1] / r1), phE = Math.atan2(end[2], end[0]);
      for (let i = 1; i <= 140; i++) {
        const f = i / 140, r = r1 + f * (5 * RLC - r1), ph = phE + (r - r1) / RLC;
        pts.push(r * Math.sin(thE) * Math.cos(ph), r * Math.cos(thE), r * Math.sin(thE) * Math.sin(ph));
        al.push(0.4 * (1 - f) ** 1.5);
      }
      addLine(spin, pts, al, open);
    }
  }

  // Schrittweite wächst mit dem Abstand (der Kegel wird nach außen breiter) – sonst verfehlen die Strahlen den schmalen Kegel am Stern
  const beams = volume({
    radius: 6000, body: BEAM_BODY, adapt: 0.07 - 0.025 * ctx.detail, minStep: 1.5, maxSteps: 260,
    uniforms: {
      uM: { value: mWorld }, uGain: { value: 0.09 }, uRlc: { value: RLC }, uWT: { value: 0 }, uJet: { value: 0.003 },
    },
  });
  beams.renderOrder = 3;
  scene.add(beams);

  // Lichtzylinder: Leuchtring in der Äquatorebene (Kern + weicher Hof), dazu blasse Ringe oben und unten
  const ringMat = (color, k, i) => new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms: { uColor: { value: new THREE.Color(...color) }, uK: { value: k }, uI: { value: i } }, ...additive });
  const lc = new THREE.Group();
  for (const [tube, m] of [[14, ringMat([0.55, 0.92, 1.0], 1.2, 1.5)], [90, ringMat([0.2, 0.55, 1.0], 3, 0.2)]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RLC, tube, 12, 320), m);
    ring.rotation.x = Math.PI / 2;
    ring.renderOrder = 4;
    lc.add(ring);
  }
  const faint = lineMat(0x5fb0ff);
  for (const y of [-1400, 1400]) {
    const pts = [], al = [];
    for (let i = 0; i <= 256; i++) { const t = (i / 256) * TAU; pts.push(Math.cos(t) * RLC, y, Math.sin(t) * RLC); al.push(0.1); }
    addLine(lc, pts, al, faint);
  }
  scene.add(lc);
  const lcMats = lc.children.filter((o) => o.isMesh).map((o) => o.material);
  // Stromblatt in der Äquatorebene: dort schneidet es die Ebene entlang zweier Archimedes-Spiralen φ = π/2 + kπ + r/R_LC
  // (im Rahmen der Drehung starr, also mitdrehend) – von oben die Spirale der Vorlage, aus der Physik gerechnet
  const spiral = lineMat(0xcdefff, 0x8fb8ff, 2 * RLC, 10 * RLC);
  for (const k of [0, 1]) {
    for (const off of [-0.035, 0, 0.035]) {
      const pts = [], al = [];
      for (let i = 0; i <= 480; i++) {
        const f = i / 480, r = RLC * (1.02 + f * 11), ph = Math.PI / 2 + k * Math.PI + r / RLC + off;
        pts.push(r * Math.cos(ph), 0, r * Math.sin(ph));
        al.push((off ? 0.1 : 0.26) * Math.min(1, f * 25) * (1 - f) ** 1.2);
      }
      addLine(spin, pts, al, spiral);
    }
  }
  // Wind bis ≈ 12 R_LC: erst dort ist die Spirale zu sehen (Streifenbreite = c·P ≈ 2π R_LC)
  const wind = buildWind(Math.round(11000 * ctx.detail) + 3000, RLC);
  const wu = wind.userData.uniforms;
  scene.add(wind);
  let windT = 0;

  // ---------- Ton: echter Takt (Hauptpuls + Zwischenpuls bei 0,4 P) ----------
  let audio = null;
  function sound(on) {
    if (audio) { audio.close(); audio = null; }
    if (!on) return;
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const n = Math.round(P * ac.sampleRate);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    const pulse = (t0, amp, w) => { for (let i = 0; i < n; i++) { const t = i / ac.sampleRate - t0; d[i] += amp * Math.exp(-(t * t) / (2 * w * w)) * (Math.random() * 2 - 1); } };
    pulse(0.003, 0.9, 0.0007);
    pulse(0.003 + 0.4 * P, 0.4, 0.0009);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ac.createGain();
    g.gain.value = 0.22;
    src.connect(g).connect(ac.destination);
    src.start();
    audio = ac;
  }

  // Abzeichen: Lage im Magnetrahmen (drehen mit) bzw. auf dem Stromblatt (läuft mit der Drehung um)
  const L_F = 1050;
  const base = {
    beam: new THREE.Vector3(0, 2000, 0), field: new THREE.Vector3(L_F * Math.sin(1) ** 3, L_F * Math.sin(1) ** 2 * Math.cos(1), 0),
    cap: new THREE.Vector3(0, R_NS * 1.02, 0), inter: new THREE.Vector3(0, -1700, 0),
  };
  const WIND_AT = { phi: 0.5, r: 2.6 * RLC };
  const hs = {
    star: { id: 'star', kind: 'info', pos: new THREE.Vector3(0, R_NS, 0) },
    beam: { id: 'beam', kind: 'info', pos: new THREE.Vector3() },
    field: { id: 'field', kind: 'info', pos: new THREE.Vector3() },
    lc: { id: 'lc', kind: 'info', pos: new THREE.Vector3(RLC * 0.7071, 0, RLC * 0.7071) },
    wind: { id: 'wind', kind: 'info', pos: new THREE.Vector3() },
    jet: { id: 'jet', kind: 'info', pos: new THREE.Vector3(0, 2.4 * RLC, 0) },
    // nur nah am Stern: aus der Ferne läge es auf dem Abzeichen des Sterns
    polecap: { id: 'polecap', kind: 'info', pos: new THREE.Vector3(), visible: (cam) => cam.position.length() < 2500 },
    interpulse: { id: 'interpulse', kind: 'info', pos: new THREE.Vector3() },
  };
  const hotspots = Object.values(hs);
  // Lichtkurve in der Infotafel: Profil als Pfad, Phasenmarke läuft mit der Drehung (Hauptpuls, wenn die Magnetachse
  // zur Erde = +z zeigt)
  const W = 300, H = 64;
  const curve = Array.from({ length: 121 }, (_, i) => { const f = i / 120; return `${(f * W).toFixed(1)},${(H - 6 - profile(f) * (H - 12)).toFixed(1)}`; }).join(' ');
  const widget = () => `<svg viewBox="0 0 ${W} ${H}" aria-label="Lichtkurve des Crab-Pulsars"><polyline points="${curve}" fill="none" stroke="#9cc8ff" stroke-width="1.6"/><line id="w-ph" x1="0" x2="0" y1="4" y2="${H - 4}" stroke="#f3b552" stroke-width="1.6"/><circle id="w-dot" cx="0" cy="${H - 6}" r="3" fill="#f3b552"/></svg><div class="w-cap"><span>Lichtkurve · Hauptpuls</span><span>Zwischenpuls bei 0,4 P</span></div>`;
  let lastPh = -1;
  const controls = [
    { id: 'slow', label: 'Zeitlupe', value: '200', options: [['600', '1 : 600'], ['200', '1 : 200'], ['60', '1 : 60']], set: (v) => { slow = +v; } },
    { id: 'sound', label: 'Ton', value: 'off', options: [['off', 'Aus'], ['on', 'Echter Takt']], set: (v) => sound(v === 'on') },
  ];
  const q = new THREE.Quaternion();

  // Überblick leicht über der Äquatorebene: Leuchtring als Ellipse, Stromblatt als S, Strahlen und Polstrahlen im Bild.
  // Screenshots: ?view=top (Spirale von oben, weit draußen) · ?view=side (S von der Seite) · ?view=near (Stern und Polkappen nah)
  const home = { pos: new THREE.Vector3(2600, 2900, 7000), target: new THREE.Vector3(0, 0, 0) };
  const view = new URLSearchParams(location.search).get('view');
  if (view === 'top') home.pos.set(0, 26000, 1);
  else if (view === 'side') home.pos.set(0, 250, 8600);
  else if (view === 'near') home.pos.set(70, 38, 150);

  return {
    scene, camera, unit: 1e3, hotspots, controls, home,
    orbit: { minDistance: 30, maxDistance: 30000, cineSpeed: 0.4 },
    look: { exposure: 1.0, bloom: 0.2, sat: 1.08, con: 0.14, sh: [0.94, 0.98, 1.1] },
    update(dt, t, cam) {
      phase = (phase + (dt / (P * slow)) * TAU) % TAU;
      spin.rotation.y = phase;
      const dist = cam.position.length();
      glow.quaternion.copy(cam.quaternion);
      glare.quaternion.copy(cam.quaternion);
      glare.scale.setScalar(dist * 0.3);
      glare.material.uniforms.uI.value = THREE.MathUtils.smoothstep(dist, 400, 2000);
      spin.updateMatrixWorld();
      mWorld.set(0, 1, 0).applyQuaternion(mag.getWorldQuaternion(q));
      hs.beam.pos.copy(base.beam).applyMatrix4(mag.matrixWorld);
      hs.field.pos.copy(base.field).applyMatrix4(mag.matrixWorld);
      hs.polecap.pos.copy(base.cap).applyMatrix4(mag.matrixWorld);
      hs.interpulse.pos.copy(base.inter).applyMatrix4(mag.matrixWorld);
      // Abzeichen des Winds sitzt knapp über dem Stromblatt (Cyan-Seite) und läuft mit
      const th = sheetTheta(WIND_AT.phi, WIND_AT.r, phase, RLC) - 0.08;
      hs.wind.pos.set(Math.sin(th) * Math.cos(WIND_AT.phi), Math.cos(th), Math.sin(th) * Math.sin(WIND_AT.phi)).multiplyScalar(WIND_AT.r);
      // Wind: ≈ c in derselben Zeitlupe wie die Drehung (Weg in km je Sekunde Echtzeit / slow)
      windT += dt * (C / 1e3) / slow;
      const u = beams.material.uniforms;
      u.uTime.value = t;
      u.uWT.value = windT;
      wu.uT.value = windT;
      wu.uPhase.value = phase;
      wu.uCam.value = dist;
      // Leuchtring erst im Überblick: von innen läge er als breiter Balken quer im Bild
      const ringI = THREE.MathUtils.smoothstep(dist, 400, 2500);
      lcMats[0].uniforms.uI.value = 1.5 * ringI;
      lcMats[1].uniforms.uI.value = 0.2 * ringI;
      // Nahebene mit dem Abstand (Stern 13 km bis Wind ≈ 20.000 km)
      const near = Math.max(0.2, dist * 0.01);
      if (Math.abs(near - camera.near) / camera.near > 0.1) { camera.near = near; camera.updateProjectionMatrix(); }
    },
    live: () => `Echte Periode ${(P * 1e3).toFixed(2).replace('.', ',')} ms · hier eine Umdrehung in ${(P * slow).toFixed(1).replace('.', ',')} s · Lichtzylinder ${Math.round(RLC).toLocaleString('de-DE')} km`,
    widget,
    widgetTick(el) {
      // Phase 0,5 = Magnetachse zeigt zur Erde (+z) → Hauptpuls
      const az = Math.atan2(mWorld.x, mWorld.z);
      const f = ((az / TAU) % 1 + 1.5) % 1;
      if (Math.abs(f - lastPh) < 0.002) return;
      lastPh = f;
      const x = (f * W).toFixed(1), y = (H - 6 - profile(f) * (H - 12)).toFixed(1);
      const ph = el.querySelector('#w-ph'), dot = el.querySelector('#w-dot');
      if (ph) { ph.setAttribute('x1', x); ph.setAttribute('x2', x); }
      if (dot) { dot.setAttribute('cx', x); dot.setAttribute('cy', y); }
    },
    setPixelRatio(pr) { stars.userData.setPixelRatio(pr); wu.uPx.value = pr; },
    dispose() { sound(false); disposeScene(scene); },
  };
}
