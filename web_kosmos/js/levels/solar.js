// Station 2: Sonnensystem (Einheit 1 AE). Planeten an den Orten von heute aus den JPL-Bahnelementen, Bahnen als echte
// Ellipsen (Exzentrizität, Neigung, Knoten) mit Leuchtspur hinter dem Planeten; Polachsen nach IAU/WGCCRE (Rektaszension,
// Deklination des Nordpols J2000). Asteroidengürtel mit Kirkwood-Lücken (3:1, 5:2, 7:3), Hilda-Gruppe (3:2), Jupiter-
// Trojaner an L4/L5 und Kuipergürtel mit Plutinos (3:2 zu Neptun) laufen nach Kepler im Vertex-Shader.
// Sonne: Photosphäre mit Flecken (Textur), differentieller Rotation (Snodgrass & Ulrich 1990) und brodelnder Granulation,
// Randverdunkelung, Chromosphärensaum, Korona mit Streamern, Protuberanzen als Plasmabögen mit Flares und Massenauswürfen
// (Modell in Szenenzeit), Linsenreflex (flare.js). Planeten: Lambert + Atmosphärensaum je Planet, Erde mit Wolken, Stadt-
// lichtern und Glanzlicht, Saturn mit Ringschatten auf dem Planeten und Planetenschatten auf den Ringen; Mond um die Erde.
// Größen: „Anschaulich“ = R^0,45 gestaucht (Reihenfolge stimmt, Verhältnisse nicht), „Echt“ = wahre Radien.

import * as THREE from 'three';
import { PLANETS, AU, C, julianDate, elementsAt, solveKepler, orbitToEcliptic, eclToScene, eclDir, moonPosition, OBLIQUITY, mulberry32, gauss } from '../astro.js';
import { createStarfield } from '../stars.js';
import { NOISE } from '../glsl.js';
import { createFlare } from '../flare.js';
import { settings } from '../settings.js';
import { registerLayers } from '../layers.js';
import { keepShare } from '../sats.js';

const RAD = Math.PI / 180;
const AU_KM = AU / 1e3;
// Radien [km] (NASA Fact Sheets, äquatorial), Rotationsperiode [h] (negativ = rückläufig), Nordpol α/δ [°] (IAU WGCCRE 2015),
// Atmosphärensaum: Farbe, Stärke, Fresnel-Exponent (Darstellung)
const BODY = {
  mercury: { r: 2439.7, rot: 1407.6, pole: [281.01, 61.41], tex: 'mercury.jpg', dot: 0xc9c2b8, atm: null },
  venus: { r: 6051.8, rot: -5832.5, pole: [272.76, 67.16], tex: 'venus_atmosphere.jpg', dot: 0xf2dca8, atm: [[1.0, 0.92, 0.72], 0.9, 2.2] },
  earth: { r: 6378.1, rot: 23.934, pole: [0, 90], tex: 'earth_daymap.jpg', dot: 0x79b2ff, atm: [[0.35, 0.6, 1.0], 1.0, 3.0] },
  mars: { r: 3396.2, rot: 24.623, pole: [317.68, 52.89], tex: 'mars.jpg', dot: 0xe07a50, atm: [[0.9, 0.6, 0.45], 0.35, 3.5] },
  jupiter: { r: 71492, rot: 9.925, pole: [268.06, 64.50], tex: 'jupiter.jpg', dot: 0xe2c193, atm: [[0.95, 0.85, 0.7], 0.35, 3.0] },
  saturn: { r: 60268, rot: 10.656, pole: [40.59, 83.54], tex: 'saturn.jpg', dot: 0xead7a2, atm: [[0.95, 0.88, 0.7], 0.3, 3.0] },
  uranus: { r: 25559, rot: -17.24, pole: [257.31, -15.18], tex: 'uranus.jpg', dot: 0xb3e6ec, atm: [[0.6, 0.95, 1.0], 0.55, 2.8] },
  neptune: { r: 24764, rot: 16.11, pole: [299.36, 43.46], tex: 'neptune.jpg', dot: 0x6d8ff0, atm: [[0.45, 0.65, 1.0], 0.55, 2.8] },
};
const NAME = { mercury: 'Merkur', venus: 'Venus', earth: 'Erde', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptun' };
const SUN_R = 695700, SUN_POLE = [286.13, 63.87], MOON_R = 1737.4;
// Saturnringe: C-Ring innen 74.658 km bis A-Ring außen 136.775 km (NASA Saturnian Rings Fact Sheet)
const RING_IN = 74658, RING_OUT = 136775;
const visR = (km, real) => (real ? km / AU_KM : 0.012 * Math.pow(km / 6371, 0.45));

// Äquatorial (α, δ) → Szene (über die Ekliptik)
function poleDir([ra, dec]) {
  const e = OBLIQUITY * RAD;
  const x = Math.cos(dec * RAD) * Math.cos(ra * RAD), y = Math.cos(dec * RAD) * Math.sin(ra * RAD), z = Math.sin(dec * RAD);
  return new THREE.Vector3(...eclToScene([x, y * Math.cos(e) + z * Math.sin(e), -y * Math.sin(e) + z * Math.cos(e)])).normalize();
}

const ORBIT_VERT = /* glsl */ `
attribute float mfrac;
uniform float uPhase;
varying float vA;
void main() {
  float d = fract(uPhase - mfrac);
  vA = 0.16 + 0.84 * pow(1.0 - d, 12.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const ORBIT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
varying float vA;
void main() { gl_FragColor = vec4(uColor * vA * uGain, 1.0); }
`;

// Kleinkörper: Bahnelemente je Punkt, Ort nach Kepler zur Zeit uDays (Tage seit Start)
const BELT_VERT = /* glsl */ `
attribute vec4 el;    // a [AE], e, i [rad], Ω [rad]
attribute vec2 el2;   // ω [rad], M0 [rad]
attribute float bright;
attribute vec2 seed;  // x: Ausdünnen, y: Form und Größe des Brockens
uniform float uDays, uPx, uMag, uKeep, uRef;
varying float vB, vPx, vSeed;
varying vec2 vL;
void main() {
  float a = el.x, e = el.y;
  float M = el2.y + uDays * 0.0172021 / (a * sqrt(a));
  float E = M;
  for (int k = 0; k < 5; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  float xp = a * (cos(E) - e), yp = a * sqrt(1.0 - e * e) * sin(E);
  float co = cos(el2.x), so = sin(el2.x), cO = cos(el.w), sO = sin(el.w), cI = cos(el.z), sI = sin(el.z);
  vec3 ecl = vec3((co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
                  (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
                  so * sI * xp + co * sI * yp);
  vec4 mv = modelViewMatrix * vec4(ecl.x, ecl.z, -ecl.y, 1.0);
  gl_Position = projectionMatrix * mv;
  // vergrößert (Zahnrad „Satelliten und Kleinkörper“): Größe nach Abstand zum Blickziel, betrachteter Gürtel deutlich,
  // Gürtel weit hinter dem Blickziel klein; nur der Anteil uKeep bleibt sichtbar
  float k = mix(1.0, clamp(uRef / max(-mv.z, 1e-4), 0.3, 1.4), smoothstep(1.0, 2.5, uMag));
  float on = seed.x > uKeep ? 0.0 : 1.0;
  vPx = uPx * 1.6 * mix(1.0, uMag * (0.6 + 1.4 * seed.y * seed.y), smoothstep(1.0, 1.5, uMag)) * k;
  gl_PointSize = vPx * on;
  vB = bright * on * min(k, 1.0);
  vSeed = seed.y;
  // Richtung zur Sonne (Ursprung) im Bild, für die Beleuchtung des Brockens; gl_PointCoord zählt y nach unten
  vec4 sc = projectionMatrix * modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 dl = (sc.xy / sc.w - gl_Position.xy / gl_Position.w) * vec2(projectionMatrix[1][1] / projectionMatrix[0][0], 1.0);
  vL = normalize(vec2(dl.x, -dl.y) * sign(sc.w) + 1e-6);
}
`;
const BELT_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vB, vPx, vSeed;
varying vec2 vL;
void main() {
  if (vB <= 0.001) discard;
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  float r = length(p), a = atan(p.y, p.x), ph = vSeed * 40.0;
  // ab etwa 6 Pixeln unregelmäßiger Brocken mit Tag- und Nachtseite statt Lichtpunkt
  float edge = 0.72 + 0.1 * sin(3.0 * a + ph) + 0.06 * sin(5.0 * a + 2.3 * ph) + 0.04 * sin(9.0 * a + 0.7 * ph);
  float aa = 3.0 / max(vPx, 1.0), inside = 1.0 - smoothstep(edge - aa, edge, r);
  vec2 n2 = p / edge;
  vec3 n = vec3(n2, sqrt(max(0.0, 1.0 - dot(n2, n2))));
  float rock = inside * (0.12 + 1.1 * max(0.0, dot(n, normalize(vec3(vL, 0.35)))));
  gl_FragColor = vec4(uColor * vB * mix(exp(-r * r * 3.5), rock * 1.4, smoothstep(4.0, 8.0, vPx)), 1.0);
}
`;

// Planet als Lichtpunkt, solange die Kugel kleiner als ein paar Pixel ist
const DOT_VERT = /* glsl */ `
attribute vec3 color;
attribute float radius;
uniform float uProj, uPx;
varying vec3 vCol;
varying float vFade;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float rp = radius * uProj / max(-mv.z, 1e-6);
  vFade = 1.0 - smoothstep(2.0, 5.0, rp);
  gl_PointSize = uPx * 7.0;
  vCol = color;
}
`;
const DOT_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vFade;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  gl_FragColor = vec4(vCol * (exp(-r2 * 60.0) * 3.0 + exp(-r2 * 10.0) * 0.25) * vFade, 1.0);
}
`;

// ---------- Sonne ----------
const BODY_VERT = /* glsl */ `
varying vec3 vN, vP, vO;
varying vec2 vUv;
void main() {
  vUv = uv;
  vO = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
// Photosphäre: Flecken aus der Textur laufen mit der differentiellen Rotation ω(φ) = 14,713 − 2,396 sin²φ − 1,787 sin⁴φ °/Tag
// (Snodgrass & Ulrich 1990), Randverdunkelung quadratisch (550 nm), Granulation als fBm in Szenenzeit (echt ≈ 10 min je Zelle,
// Zellen ≈ 1.000 km – hier größer gezeichnet), Fackeln nahe der Flecken zum Rand hin.
const SUN_FRAG = /* glsl */ `
${NOISE}
uniform sampler2D tSun;
uniform float uGain, uTime, uDays, uGran;
varying vec3 vN, vP, vO;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float mu = max(dot(N, V), 0.0), q = 1.0 - mu;
  float ld = 1.0 - 0.93 * q + 0.23 * q * q;
  float s2 = vO.y * vO.y;
  float om = 14.713 - 2.396 * s2 - 1.787 * s2 * s2;
  float ang = om * uDays * 0.017453292, ca = cos(ang), sa = sin(ang);
  vec2 uv = vec2(fract(vUv.x - om * uDays / 360.0), vUv.y);
  float spots = texture2D(tSun, uv).r;
  vec3 g = vec3(vO.x * ca - vO.z * sa, vO.y, vO.x * sa + vO.z * ca);
  float gr = fbm(g * 70.0 + vec3(0.0, uTime * 0.05, 0.0), 4) + 0.4 * fbm(g * 180.0 - vec3(uTime * 0.08), 3);
  float gran = 1.0 + uGran * 0.3 * gr;
  float fac = q * smoothstep(0.55, 0.8, spots) * 0.25;
  vec3 col = vec3(1.0, 0.86, 0.6) * (0.72 + 0.5 * spots) * gran * ld + vec3(1.0, 0.95, 0.8) * fac;
  gl_FragColor = vec4(col * uGain, 1.0);
}
`;
// Chromosphäre: dünner Hα-Saum (656 nm) knapp über der Photosphäre, nur am Rand sichtbar
const CHROMO_FRAG = /* glsl */ `
uniform float uGain;
varying vec3 vN, vP, vO;
varying vec2 vUv;
void main() {
  float mu = max(dot(normalize(vN), normalize(cameraPosition - vP)), 0.0);
  gl_FragColor = vec4(vec3(1.0, 0.45, 0.5) * pow(1.0 - mu, 7.0) * 2.2 * uGain, 1.0);
}
`;
// Korona als Bildtafel zur Kamera: innere K-Korona fällt steil, außen ∝ r^−2,5 (Baumbach), Streamer und Plumes aus Grat-
// Rauschen in Polarkoordinaten, langsam veränderlich; um Größenordnungen verstärkt (echt nur bei Finsternis sichtbar)
const CORONA_VERT = /* glsl */ `
uniform float uSize;
varying vec2 vQ;
void main() {
  vQ = uv * 2.0 - 1.0;
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  c.xy += position.xy * uSize;
  gl_Position = projectionMatrix * c;
}
`;
const CORONA_FRAG = /* glsl */ `
${NOISE}
uniform float uTime, uExt, uGain;
varying vec2 vQ;
void main() {
  float r = length(vQ) * uExt;
  if (r < 0.985 || r > uExt) discard;
  vec2 c = vQ / max(length(vQ), 1e-4);
  float lr = log(r);
  // Strähnen: schnell über den Winkel, langsam über log r → radial gestreckt
  float st = ridged(vec3(c * 6.0, uTime * 0.02 + lr * 0.25), 4);
  float fine = fbm(vec3(c * 11.0, lr * 0.5 - uTime * 0.03), 3) * 0.5 + 0.5;
  float I = 1.6 * exp(-(r - 1.0) / 0.12) + 0.42 * pow(r, -2.5) * (0.45 + 1.1 * st) * (0.7 + 0.6 * fine);
  float edge = smoothstep(0.985, 1.03, r), fade = 1.0 - smoothstep(uExt * 0.6, uExt, r);
  vec3 col = mix(vec3(1.0, 0.86, 0.72), vec3(0.95, 0.97, 1.0), smoothstep(1.0, 2.5, r));
  gl_FragColor = vec4(col * I * edge * fade * uGain, 1.0);
}
`;
// Protuberanzen: Plasmabögen entlang magnetischer Schleifen, Lebenszyklus (aufsteigen, stehen, verblassen), Plasma fließt
// entlang des Bogens; ein Flare lässt eine Schleife aufblitzen (uBurstT = Sekunden seit Auslösung, uBurstSeed = Schleife)
const LOOP_VERT = /* glsl */ `
attribute float seed;
varying vec2 vUv;
varying float vSeed;
varying vec3 vN, vP;
void main() {
  vUv = uv; vSeed = seed;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const LOOP_FRAG = /* glsl */ `
${NOISE}
uniform float uTime, uRate, uGain, uBurstT, uBurstSeed, uSunR;
uniform vec3 uSunC;
varying vec2 vUv;
varying float vSeed;
varying vec3 vN, vP;
void main() {
  float sp = 0.6 + 0.8 * fract(vSeed * 7.31);
  float cyc = fract(uTime * uRate * 0.02 * sp + vSeed);
  float env = smoothstep(0.0, 0.12, cyc) * (1.0 - smoothstep(0.5, 0.95, cyc));
  float flow = fbm(vec3(vUv.x * 7.0 - uTime * 0.9 * sp, vSeed * 9.0, vUv.y * 3.0), 3) * 0.5 + 0.5;
  float body = pow(max(dot(normalize(vN), normalize(cameraPosition - vP)), 0.0), 0.6);
  float burst = exp(-uBurstT * 1.5) * step(abs(vSeed - uBurstSeed), 0.001) * 5.0;
  // vor der hellen Scheibe unsichtbar (Hα-Filament), nur gegen den dunklen Himmel am Rand sichtbar
  vec3 d = normalize(vP - cameraPosition), oc = uSunC - cameraPosition;
  float tca = dot(oc, d), d2 = dot(oc, oc) - tca * tca;
  float onDisc = (d2 < uSunR * uSunR && tca > length(vP - cameraPosition)) ? 1.0 : 0.0;
  vec3 col = mix(vec3(1.0, 0.82, 0.62), vec3(1.0, 0.42, 0.52), smoothstep(0.1, 0.5, min(vUv.x, 1.0 - vUv.x)));
  float a = (env + min(burst, 1.0)) * (0.35 + 0.65 * flow) * body * uGain * (1.0 + burst) * (1.0 - 0.9 * onDisc);
  gl_FragColor = vec4(col * a, 1.0);
}
`;

// ---------- Planeten ----------
// Lambert + Atmosphärensaum (Fresnel, tags in Saumfarbe, an der Dämmerung warm); Erde zusätzlich Wolken, Glanzlicht,
// Stadtlichter; Saturn: Ringschatten aus dem Strahl Oberfläche → Sonne durch die Ringebene (Alpha der Ringtextur)
const PLANET_FRAG = /* glsl */ `
uniform sampler2D tMap, tNight, tClouds, tSpec, tRing;
uniform float uHasEarth, uCloudU, uAtm, uAtmPow, uGain, uRing, uRingIn, uRingOut;
uniform vec3 uAtmCol;
uniform mat4 uInv;
varying vec3 vN, vP, vO;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP), L = normalize(-vP);
  float ndl = dot(N, L), lit = max(ndl, 0.0);
  vec3 alb = texture2D(tMap, vUv).rgb;
  float sh = 1.0;
  if (uRing > 0.5) {
    vec3 pl = (uInv * vec4(vP, 1.0)).xyz, ll = normalize((uInv * vec4(vP + L, 1.0)).xyz - pl);
    if (abs(ll.y) > 1e-4) {
      float t = -pl.y / ll.y;
      if (t > 0.0) {
        float r = length((pl + ll * t).xz);
        if (r > uRingIn && r < uRingOut) sh = 1.0 - 0.92 * texture2D(tRing, vec2((r - uRingIn) / (uRingOut - uRingIn), 0.5)).a;
      }
    }
  }
  vec3 sunCol = mix(vec3(1.0, 0.6, 0.35), vec3(1.0), smoothstep(0.0, 0.3, ndl));
  vec3 col = alb * lit * sh * sunCol;
  if (uHasEarth > 0.5) {
    float cl = texture2D(tClouds, vUv + vec2(uCloudU, 0.0)).r, ocean = texture2D(tSpec, vUv).r;
    vec3 H = normalize(L + V);
    col += vec3(1.0, 0.92, 0.8) * pow(max(dot(N, H), 0.0), 300.0) * ocean * (1.0 - cl) * lit * 0.6;
    col = mix(col, vec3(0.9) * lit * sunCol, cl * 0.9);
    vec3 night = texture2D(tNight, vUv).rgb;
    col += night * night * vec3(1.0, 0.78, 0.5) * 1.4 * (1.0 - smoothstep(-0.1, 0.15, ndl)) * (1.0 - cl * 0.8);
  }
  float fres = pow(1.0 - max(dot(N, V), 0.0), uAtmPow);
  vec3 atmC = mix(mix(uAtmCol, vec3(1.0, 0.45, 0.2), 0.6), uAtmCol, smoothstep(0.0, 0.4, ndl));
  col += atmC * fres * uAtm * smoothstep(-0.25, 0.3, ndl);
  gl_FragColor = vec4(col * uGain, 1.0);
}
`;
// Ringe: Alpha-Textur, beidseitig beleuchtet (dünn, durchscheinend), Planetenschatten aus dem Strahl Ring → Sonne gegen die Kugel
const RING_FRAG = /* glsl */ `
uniform sampler2D tRing;
uniform vec3 uCenter;
uniform float uR, uGain;
varying vec3 vN, vP, vO;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(tRing, vUv);
  vec3 L = normalize(-vP), oc = vP - uCenter;
  float b = dot(oc, L), h = b * b - (dot(oc, oc) - uR * uR);
  float sh = (h > 0.0 && b < 0.0) ? 0.06 : 1.0;
  float lit = 0.25 + 0.75 * abs(dot(normalize(vN), L));
  gl_FragColor = vec4(t.rgb * lit * sh * uGain, t.a);
}
`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,240,220,1)');
  grd.addColorStop(0.12, 'rgba(255,214,160,0.55)');
  grd.addColorStop(0.35, 'rgba(255,170,90,0.12)');
  grd.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Schleifen-Geometrie: n Halbellipsen auf der Einheitskugel in den aktiven Breiten (±8–35°), zusammengeführt in einen Puffer
function loopsGeometry(n, rand) {
  const parts = [], meta = [];
  const Y = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < n; k++) {
    const lon = rand() * Math.PI * 2, lat = (8 + rand() * 27) * RAD * (rand() < 0.5 ? 1 : -1);
    const d = 0.08 + rand() * 0.17, h = 0.12 + rand() * 0.33, tw = (rand() - 0.5) * 0.6;
    const pts = [];
    for (let i = 0; i <= 24; i++) { const a = Math.PI * (1 - i / 24); pts.push(new THREE.Vector3(Math.cos(a) * d, Math.sin(a) * h, Math.sin(a) * h * tw)); }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.006 + rand() * 0.006, 6, false);
    const nrm = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
    const o = new THREE.Object3D();
    o.position.copy(nrm).multiplyScalar(0.995);
    o.quaternion.setFromUnitVectors(Y, nrm);
    o.rotateY(rand() * Math.PI * 2);
    o.updateMatrix();
    tube.applyMatrix4(o.matrix);
    const seed = (k + 0.5) / n;
    tube.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(tube.attributes.position.count).fill(seed), 1));
    parts.push(tube);
    meta.push({ seed, apex: nrm.clone().multiplyScalar(1 + h * 0.9), dir: nrm.clone() });
  }
  const pos = [], nor = [], uv = [], sd = [], idx = [];
  let off = 0;
  for (const g of parts) {
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array); sd.push(...g.attributes.seed.array);
    for (const i of g.index.array) idx.push(i + off);
    off += g.attributes.position.count;
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(sd), 1));
  g.setIndex(idx);
  g.userData.meta = meta;
  return g;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.0005, 600);
  const jd0 = julianDate(ctx.date);
  let jd = jd0, rate = 1, real = false;
  const view = new URLSearchParams(location.search).get('view');   // Screenshots: ?view=sun|saturn|moon|<planet>

  scene.add(createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.8, seed: 23 }));
  const stars = scene.children[0];

  // ---------- Sonne ----------
  const sunG = new THREE.Group();
  sunG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleDir(SUN_POLE));
  scene.add(sunG);
  const sunMat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: SUN_FRAG, uniforms: { tSun: { value: ctx.tex('sun.jpg') }, uGain: { value: 0.7 }, uTime: { value: 0 }, uDays: { value: 0 }, uGran: { value: 1 } } });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), sunMat);
  sunG.add(sun);
  const chromo = new THREE.Mesh(new THREE.SphereGeometry(1.015, 96, 48), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: CHROMO_FRAG, uniforms: { uGain: { value: 2.5 } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sunG.add(chromo);
  const randS = mulberry32(17);
  const loopG = loopsGeometry(Math.max(6, Math.round(10 * ctx.detail)), randS);
  const loopU = { uTime: { value: 0 }, uRate: { value: 1 }, uGain: { value: 1.3 }, uBurstT: { value: 1e3 }, uBurstSeed: { value: -1 }, uSunR: { value: 1 }, uSunC: { value: new THREE.Vector3() } };
  const loops = new THREE.Mesh(loopG, new THREE.ShaderMaterial({ vertexShader: LOOP_VERT, fragmentShader: LOOP_FRAG, uniforms: loopU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
  loops.frustumCulled = false;
  sunG.add(loops);
  const CORONA_EXT = 5;
  const coronaU = { uTime: { value: 0 }, uExt: { value: CORONA_EXT }, uSize: { value: 1 }, uGain: { value: 1.3 } };
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: CORONA_VERT, fragmentShader: CORONA_FRAG, uniforms: coronaU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  corona.frustumCulled = false;
  corona.renderOrder = -1;
  scene.add(corona);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(1.2, 1.0, 0.85) }));
  scene.add(glow);
  const flare = createFlare({ strength: 0.45 });
  scene.add(flare);
  // Massenauswurf: Plasmablase aus der Schleifenspitze, wächst und verblasst (Szenenzeit, echt 250–3.000 km/s)
  const cme = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(1.0, 0.6, 0.45), opacity: 0 }));
  cme.visible = false;
  scene.add(cme);
  const cmeState = { t: 1e3, dir: new THREE.Vector3(), from: new THREE.Vector3() };
  let flareTimer = 18 + randS() * 14, flareRate = 1, flaresOn = true;
  function triggerFlare() {
    const meta = loopG.userData.meta, m = meta[Math.floor(randS() * meta.length)];
    loopU.uBurstT.value = 0; loopU.uBurstSeed.value = m.seed;
    sunG.updateMatrixWorld();
    cmeState.from.copy(m.apex).applyMatrix4(sunG.matrixWorld);
    cmeState.dir.copy(m.dir).applyQuaternion(sunG.quaternion);
    cmeState.t = 0;
    cme.visible = true;
    flareTimer = (14 + randS() * 26) / flareRate;
  }

  // ---------- Planeten ----------
  const inv = new THREE.Matrix4();
  const planets = PLANETS.map((p) => {
    const b = BODY[p.id];
    const tilt = new THREE.Group();
    tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleDir(b.pole));
    const isEarth = p.id === 'earth', isSaturn = p.id === 'saturn';
    const uniforms = {
      tMap: { value: ctx.tex(b.tex) }, tNight: { value: isEarth ? ctx.tex('earth_nightmap.jpg') : null }, tClouds: { value: isEarth ? ctx.tex('earth_clouds.jpg', false) : null },
      tSpec: { value: isEarth ? ctx.tex('earth_specular.jpg', false) : null }, tRing: { value: isSaturn ? ctx.tex('saturn_ring_alpha.png') : null },
      uHasEarth: { value: isEarth ? 1 : 0 }, uCloudU: { value: 0 }, uAtm: { value: b.atm ? b.atm[1] : 0 }, uAtmPow: { value: b.atm ? b.atm[2] : 3 }, uAtmCol: { value: new THREE.Color(...(b.atm ? b.atm[0] : [0, 0, 0])) },
      uGain: { value: 1 }, uRing: { value: isSaturn ? 1 : 0 }, uRingIn: { value: 0 }, uRingOut: { value: 0 }, uInv: { value: isSaturn ? inv : new THREE.Matrix4() },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), mat);
    tilt.add(mesh);
    const holder = new THREE.Group();
    holder.add(tilt);
    scene.add(holder);
    let ring = null, ringMat = null;
    if (isSaturn) {
      const g = new THREE.RingGeometry(RING_IN / b.r, RING_OUT / b.r, 256, 1);
      const pos = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        uv.setXY(i, (v.length() - RING_IN / b.r) / ((RING_OUT - RING_IN) / b.r), 0.5);
      }
      g.rotateX(-Math.PI / 2);
      ringMat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: RING_FRAG, uniforms: { tRing: { value: ctx.tex('saturn_ring_alpha.png') }, uCenter: { value: new THREE.Vector3() }, uR: { value: 1 }, uGain: { value: 1 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false });
      ring = new THREE.Mesh(g, ringMat);
      tilt.add(ring);
    }
    // Bahn: Ellipse aus den Elementen, Parameter = mittlere Anomalie (für die Leuchtspur)
    const el = elementsAt(p, jd0);
    const N = 720, pts = new Float32Array((N + 1) * 3), mf = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const E = (i / N) * Math.PI * 2;
      pts.set(eclToScene(orbitToEcliptic(el, E)), i * 3);
      mf[i] = ((E - el.e * Math.sin(E)) / (Math.PI * 2) + 1) % 1;
    }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    og.setAttribute('mfrac', new THREE.BufferAttribute(mf, 1));
    const om = new THREE.ShaderMaterial({ vertexShader: ORBIT_VERT, fragmentShader: ORBIT_FRAG, uniforms: { uPhase: { value: 0 }, uColor: { value: new THREE.Color(b.dot) }, uGain: { value: 0.9 } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const orbit = new THREE.Line(og, om);
    scene.add(orbit);
    return { p, b, holder, tilt, mesh, mat, ring, ringMat, om, orbit, pos: new THREE.Vector3() };
  });
  const P = Object.fromEntries(planets.map((x) => [x.p.id, x]));

  // Mond: Ort aus der Almanach-Näherung relativ zur Erde; „Anschaulich“ zieht ihn näher heran, sonst läge er in der vergrößerten Erde
  const moonMat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: {
    tMap: { value: ctx.tex('moon.jpg') }, tNight: { value: null }, tClouds: { value: null }, tSpec: { value: null }, tRing: { value: null },
    uHasEarth: { value: 0 }, uCloudU: { value: 0 }, uAtm: { value: 0 }, uAtmPow: { value: 3 }, uAtmCol: { value: new THREE.Color(0, 0, 0) }, uGain: { value: 1 },
    uRing: { value: 0 }, uRingIn: { value: 0 }, uRingOut: { value: 0 }, uInv: { value: new THREE.Matrix4() } } });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), moonMat);
  scene.add(moon);
  const moonPos = moon.position, moonDir = new THREE.Vector3();

  // Lichtpunkte der Planeten
  const dotG = new THREE.BufferGeometry();
  dotG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(planets.length * 3), 3));
  dotG.setAttribute('color', new THREE.BufferAttribute(new Float32Array(planets.flatMap((x) => new THREE.Color(x.b.dot).toArray())), 3));
  dotG.setAttribute('radius', new THREE.BufferAttribute(new Float32Array(planets.length), 1));
  const dotMat = new THREE.ShaderMaterial({ vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, uniforms: { uProj: { value: 500 }, uPx: { value: 1 } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const dots = new THREE.Points(dotG, dotMat);
  dots.frustumCulled = false;
  scene.add(dots);

  // ---------- Kleinkörper ----------
  const rand = mulberry32(5);
  const ray = (s) => Math.abs(gauss(rand)) * s;   // Rayleigh-ähnlich
  const beltObjs = [];
  function belt(n, pick, color, gain) {
    const el = new Float32Array(n * 4), el2 = new Float32Array(n * 2), br = new Float32Array(n), sd = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const o = pick(i);
      el.set([o.a, o.e, o.i, o.node ?? rand() * Math.PI * 2], i * 4);
      el2.set([o.w ?? rand() * Math.PI * 2, o.M ?? rand() * Math.PI * 2], i * 2);
      br[i] = (0.35 + rand() * 0.65) * gain;
      sd.set([(i * 0.6180339887) % 1, (i * 0.7548776662 + 0.5) % 1], i * 2);   // ohne rand(): Verteilung der Gürtel bleibt gleich
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('el', new THREE.BufferAttribute(el, 4));
    g.setAttribute('el2', new THREE.BufferAttribute(el2, 2));
    g.setAttribute('bright', new THREE.BufferAttribute(br, 1));
    g.setAttribute('seed', new THREE.BufferAttribute(sd, 2));
    const m = new THREE.ShaderMaterial({ vertexShader: BELT_VERT, fragmentShader: BELT_FRAG, uniforms: { uDays: { value: 0 }, uPx: { value: 1 }, uMag: { value: 1 }, uKeep: { value: 1 }, uRef: { value: 1 }, uColor: { value: new THREE.Color(color) } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    scene.add(pts);
    beltObjs.push(pts);
    return m;
  }
  const detail = ctx.detail;
  // Hauptgürtel 2,1–3,3 AE, Lücken bei den Jupiter-Resonanzen ausgedünnt
  const gaps = [2.502, 2.825, 2.958, 3.279];
  const mainA = () => {
    for (;;) {
      const a = 2.1 + rand() * 1.2;
      const g = Math.min(...gaps.map((x) => Math.abs(a - x)));
      if (g > 0.03 || rand() < g / 0.03 * 0.25) return a;
    }
  };
  const jup = elementsAt(PLANETS[4], jd0);
  const beltMats = [
    belt(Math.round(9000 * detail), () => ({ a: mainA(), e: ray(0.08), i: ray(0.12) }), 0xd8c8b0, 0.55),
    belt(Math.round(700 * detail), () => ({ a: 3.97 + gauss(rand) * 0.03, e: 0.1 + ray(0.06), i: ray(0.1) }), 0xd8c8b0, 0.5),
    // Trojaner: mittlere Länge 60° vor bzw. hinter Jupiter, gleiche Halbachse
    belt(Math.round(1600 * detail), (i) => {
      const lead = i % 2 ? 60 : -60;
      const node = rand() * Math.PI * 2, w = rand() * Math.PI * 2;
      const L = (jup.L + lead + gauss(rand) * 12) * RAD;
      return { a: 5.2 + gauss(rand) * 0.05, e: ray(0.06), i: ray(0.2), node, w, M: L - node - w };
    }, 0xc8b8a0, 0.5),
    belt(Math.round(4500 * detail), (i) => (i % 5 === 0
      ? { a: 39.4 + gauss(rand) * 0.25, e: 0.1 + ray(0.08), i: ray(0.2) }
      : { a: 42 + rand() * 6, e: ray(0.05), i: ray(0.08) }), 0xa8c0e0, 0.5),
  ];
  const days = () => jd - jd0;

  // ---------- Größen ----------
  let sr = 1;
  function applySizes() {
    sr = visR(SUN_R, real);
    sunG.scale.setScalar(sr);
    coronaU.uSize.value = sr * CORONA_EXT;
    glow.scale.setScalar(sr * 5);
    const rad = dotG.attributes.radius;
    planets.forEach((x, i) => {
      const r = visR(x.b.r, real);
      x.mesh.scale.setScalar(r);
      if (x.ring) { x.ring.scale.setScalar(r); x.mat.uniforms.uRingIn.value = (RING_IN / x.b.r) * r; x.mat.uniforms.uRingOut.value = (RING_OUT / x.b.r) * r; x.ringMat.uniforms.uR.value = r; }
      rad.setX(i, r);
    });
    rad.needsUpdate = true;
    moon.scale.setScalar(visR(MOON_R, real));
  }
  applySizes();

  function place() {
    const dp = dotG.attributes.position;
    planets.forEach((x, i) => {
      const el = elementsAt(x.p, jd);
      const E = solveKepler(el.M * RAD, el.e);
      x.pos.set(...eclToScene(orbitToEcliptic(el, E)));
      x.holder.position.copy(x.pos);
      x.mesh.rotation.y = ((jd - 2451545) * 24 / x.b.rot) % 1 * Math.PI * 2;
      x.om.uniforms.uPhase.value = ((el.M / 360) % 1 + 1) % 1;
      dp.setXYZ(i, x.pos.x, x.pos.y, x.pos.z);
    });
    dp.needsUpdate = true;
    beltMats.forEach((m) => { m.uniforms.uDays.value = days(); });
    P.earth.mat.uniforms.uCloudU.value = days() * 0.004;
    const sat = P.saturn;
    sat.tilt.updateMatrixWorld();
    inv.copy(sat.tilt.matrixWorld).invert();
    sat.ringMat.uniforms.uCenter.value.copy(sat.pos);
    // Mond: Richtung echt, Abstand im Modus „Anschaulich“ auf 2,6 Erdradien (Bild) gezogen
    moonDir.set(...eclToScene(moonPosition(jd)));
    const dist = real ? moonDir.length() / AU_KM : visR(BODY.earth.r, false) * 2.6;
    moonDir.normalize();
    moonPos.copy(P.earth.pos).addScaledVector(moonDir, dist);
    moon.lookAt(P.earth.pos);
    moon.rotateY(-Math.PI / 2);     // Länge 0 (Textur-Mitte) zur Erde (gebundene Rotation)
    loops.rotation.y = days() / 25.0 * Math.PI * 2;
    sunMat.uniforms.uDays.value = days();
  }
  place();

  const home = { pos: new THREE.Vector3(-3.2, 4.4, 7.4), target: new THREE.Vector3(0, 0, 0) };
  const camDir = home.pos.clone().setY(0).normalize();
  const onBelt = (r) => camDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5).multiplyScalar(r);
  const focus = (x) => () => Math.max(visR(x.b.r, real) * 7, 2e-5);
  const flarePos = new THREE.Vector3(), coronaPos = new THREE.Vector3();
  const sideDir = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
  const hotspots = [
    { id: 'sun', kind: 'info', pos: new THREE.Vector3(), focus: () => sr * 4 },
    { id: 'flare', kind: 'info', pos: flarePos, focus: () => sr * 4.5, visible: () => flaresOn },
    { id: 'corona', kind: 'info', pos: coronaPos, focus: () => sr * 8, visible: () => corona.visible },
    { id: 'earth', kind: 'dive', to: 'earth', pos: P.earth.pos },
    { id: 'moon', kind: 'info', pos: moonPos, focus: () => Math.max(visR(MOON_R, real) * 7, 2e-5) },
    { id: 'jupiter', kind: 'info', pos: P.jupiter.pos, focus: focus(P.jupiter) },
    { id: 'saturn', kind: 'info', pos: P.saturn.pos, focus: () => visR(P.saturn.b.r, real) * 9 },
    { id: 'belt', kind: 'info', pos: onBelt(2.75) },
    { id: 'kuiper', kind: 'info', pos: onBelt(44) },
    ...['mercury', 'venus', 'mars', 'uranus', 'neptune'].map((id) => ({ id, kind: 'info', pos: P[id].pos, focus: focus(P[id]) })),
  ];
  // Screenshot-Hilfe: Heimpose nahe an einem Körper
  if (view) {
    const tgt = view === 'sun' ? new THREE.Vector3() : view === 'moon' ? moonPos : P[view] ? P[view].pos : null;
    if (tgt) { const r = view === 'sun' ? sr * 3.2 : view === 'moon' ? visR(MOON_R, real) * 7 : visR(P[view].b.r, real) * 6; home.target = tgt.clone(); home.pos = tgt.clone().addScaledVector(camDir, r).addScaledVector(sideDir, r * 0.35).add(new THREE.Vector3(0, r * 0.3, 0)); }
  }

  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' });
  const controls = [
    { id: 'size', label: 'Größen', value: 'vis', options: [['vis', 'Anschaulich'], ['real', 'Echt']], set: (v) => { real = v === 'real'; applySizes(); } },
    { id: 'time', label: 'Zeit', value: 'day', options: [['now', 'Jetzt'], ['day', '1 Tag/s'], ['month', '1 Monat/s'], ['year', '1 Jahr/s']],
      set: (v) => { rate = { now: 0, day: 1, month: 30.44, year: 365.25 }[v]; if (!rate) jd = julianDate(new Date()); } },
  ];

  // ---------- Ebenen (Zahnrad „Station · Sonnensystem“, Zeitleiste) ----------
  const SPEEDS = [[1, '1 Tag/s'], [7, '1 Woche/s'], [30.44, '1 Monat/s'], [365.25, '1 Jahr/s'], [3652.5, '10 Jahre/s']];
  let clockIdx = 0;
  const setVis = (list, v) => list.forEach((o) => { o.visible = v; });
  registerLayers('solar', [
    { id: 'clock', type: 'play', label: 'Planetenlauf', value: 0, min: 0, max: SPEEDS.length - 1, step: 1, autoplay: true, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, playing) => { clockIdx = Math.round(i); rate = playing ? SPEEDS[clockIdx][0] : 0; if (!playing) jd = julianDate(new Date()); },
      get: () => ({ value: clockIdx, playing: rate !== 0 }), status: () => `Planetenstand ${fmt.format(new Date((jd - 2440587.5) * 864e5))}${rate ? '' : ' · jetzt'}` },
    { id: 'flares', type: 'toggle', label: 'Protuberanzen und Flares', value: true, set: (v) => { flaresOn = v; loops.visible = v; if (!v) cme.visible = false; } },
    { id: 'flareRate', type: 'range', label: 'Häufigkeit', value: 1, min: 0.3, max: 3, step: 0.1, unit: '×', sub: true, set: (v) => { flareRate = v; loopU.uRate.value = v; } },
    { id: 'flareNow', type: 'action', label: 'Flare mit Massenauswurf', button: 'Jetzt auslösen', sub: true, run: () => { if (flaresOn) triggerFlare(); } },
    { id: 'corona', type: 'toggle', label: 'Korona', value: true, set: (v) => { corona.visible = v; } },
    { id: 'gran', type: 'toggle', label: 'Granulation (brodelnde Oberfläche)', value: true, set: (v) => { sunMat.uniforms.uGran.value = v ? 1 : 0; } },
    { id: 'atmos', type: 'toggle', label: 'Atmosphärensaum der Planeten', value: true, set: (v) => planets.forEach((x) => { x.mat.uniforms.uAtm.value = v && x.b.atm ? x.b.atm[1] : 0; }) },
    { id: 'orbits', type: 'toggle', label: 'Bahnen mit Leuchtspur', value: true, set: (v) => setVis(planets.map((x) => x.orbit), v) },
    { id: 'belts', type: 'toggle', label: 'Kleinkörper: Asteroiden, Trojaner, Kuipergürtel', value: true, set: (v) => setVis(beltObjs, v) },
  ]);

  const occluders = planets.map((x) => ({ center: x.pos, radius: 1 }));
  const sunWorld = new THREE.Vector3();
  const f2 = (x) => x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtLight = (au) => { const s = au * AU / C; return s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')} min`; };
  let wT = -1;

  return {
    scene, camera, home, unit: AU, hotspots, controls,
    orbit: { minDistance: 0.05, maxDistance: 160, cineSpeed: 0.6 },
    look: { exposure: 1.0, bloom: 0.07 },
    update(dt, t, cam, flying) {
      if (!flying) jd += dt * rate;
      place();
      // im Flug von bzw. zur Erde: Sonne höchstens ≈ 2,5° Radius – sonst füllt die anschaulich vergrößerte Sonne das Bild
      const s = Math.min(visR(SUN_R, real), flying && !real ? cam.position.distanceTo(sunG.position) * 0.045 : Infinity);
      if (sunG.scale.x !== s) { sr = s; sunG.scale.setScalar(s); coronaU.uSize.value = s * CORONA_EXT; glow.scale.setScalar(s * 5); }
      sunMat.uniforms.uTime.value = t; coronaU.uTime.value = t; loopU.uTime.value = t; loopU.uSunR.value = sr;
      // Flares: Zufallstakt, Aufblitzen der Schleife, Massenauswurf wandert 6 Sonnenradien hinaus
      if (flaresOn && !ctx.still) { flareTimer -= dt; if (flareTimer <= 0) triggerFlare(); }
      loopU.uBurstT.value += dt;
      if (cme.visible) {
        cmeState.t += dt;
        const k = cmeState.t / 7;
        if (k >= 1) cme.visible = false;
        else { cme.position.copy(cmeState.from).addScaledVector(cmeState.dir, k * 6 * sr); cme.scale.setScalar(sr * (0.6 + 2.6 * k)); cme.material.opacity = 0.9 * (1 - k) * (1 - k); }
      }
      flarePos.copy(sideDir).multiplyScalar(sr * 1.35).add(new THREE.Vector3(0, sr * 0.35, 0));
      coronaPos.copy(sideDir).multiplyScalar(-sr * 2.4).add(new THREE.Vector3(0, sr * 0.9, 0));
      // Nah- und Fernebene mit dem Abstand: von 10.000 km vor einem Planeten bis zum Kuipergürtel ohne Flimmern
      const d = cam.position.length() > 0 ? Math.min(cam.position.distanceTo(sunG.position), cam.position.distanceTo(moonPos), ...planets.map((x) => cam.position.distanceTo(x.pos))) : 1;
      const near = Math.min(0.05, Math.max(2e-6, d * 0.02));
      if (Math.abs(near - camera.near) / camera.near > 0.05) { camera.near = near; camera.updateProjectionMatrix(); }
      const H = ctx.renderer.domElement.height;
      dotMat.uniforms.uProj.value = (H / 2) / Math.tan((camera.fov * RAD) / 2);
      planets.forEach((x, i) => { occluders[i].radius = visR(x.b.r, real); });
      cam.updateMatrixWorld();
      const mag = settings.S.small;
      beltMats.forEach((m) => { m.uniforms.uRef.value = cam.position.length(); m.uniforms.uMag.value = mag; m.uniforms.uKeep.value = keepShare(mag); });
      // Linsenreflex nur aus der Ferne: nah an der Sonne wäre sein Lichthof größer als die Scheibe
      const far = cam.position.distanceTo(sunG.position) > sr * 7;
      flare.userData.update(sunWorld.set(0, 0, 0), cam, occluders, settings.S.lens && far, dt);
      flare.visible = far;
    },
    widget: () => `<table><thead><tr><th>Planet</th><th>Sonne</th><th>Erde</th><th>Licht</th></tr></thead><tbody id="w-pl"></tbody></table>
      <p class="w-foot">Abstände aus den JPL-Bahnelementen für den angezeigten Zeitpunkt; Lichtlaufzeit von der Erde aus.</p>`,
    widgetTick(el, t) {
      if (t - wT < 0.5) return;
      wT = t;
      const e = P.earth.pos;
      el.querySelector('#w-pl').innerHTML = planets.map((x) => {
        const isE = x.p.id === 'earth', de = x.pos.distanceTo(e);
        return `<tr${isE ? ' class="is-hi"' : ''}><td>${NAME[x.p.id]}</td><td class="num">${f2(x.pos.length())} AE</td><td class="num">${isE ? '–' : `${f2(de)} AE`}</td><td class="num">${isE ? '–' : fmtLight(de)}</td></tr>`;
      }).join('') + `<tr><td>Mond</td><td class="num">${f2(P.earth.pos.length())} AE</td><td class="num">384.400 km</td><td class="num">1,3 s</td></tr>`;
    },
    live: () => `Planetenstand ${fmt.format(new Date((jd - 2440587.5) * 864e5))}${rate ? ' · Zeitraffer' : ' · jetzt'}`,
    setPixelRatio(pr) {
      stars.userData.setPixelRatio(pr);
      dotMat.uniforms.uPx.value = pr;
      beltMats.forEach((m) => { m.uniforms.uPx.value = pr; });
    },
    dispose() { scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); },
  };
}
