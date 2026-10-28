// Urknall-Intro v2 (User 28.10.2026): eigenständige Seite web/intro_v2.html zum Ansehen, noch nicht in der App
// (main.js/opener.js) eingebunden. Vorbild: „The Big Bang Simulation Video“ (Simulation World, YouTube 2GqJJ74W4g4,
// 38 s), ganz angesehen: kleiner Nebelfleck mit weißem Kern zieht sich zum Punkt zusammen (0–4 s) → Knall: rosa Schleier
// über dem ganzen Bild, weiße Kugel, Kugel aus Teilchenstrahlen fliegt nach außen (4–6 s) → grün-türkiser und
// orange-brauner Nebel um den weißen Kern, Strahlen klingen aus (6–9 s) → goldene Strahlen wachsen aus dem Kern, vor
// allem nach oben und unten (9–12 s) → langsame Kamerafahrt um den Kern, Strahlen wiegen sich, Staub treibt (12–38 s).
// Eigener Auftakt davor (User): ein winziger Funke in der Mitte blinkt ganz langsam auf, immer wieder, etwas
// unregelmäßig (BLINKS) – dann erst sammelt sich der Nebelfleck und zieht sich zusammen, Herzschlag beschleunigt,
// Luftholen, Knall. Ton: intro_v2_sound.js (synthetisch, klarer als im Video).
// Eine Uhr `film.t`; apply(t) ist reine Funktion der Zeit (Teilchen rechnen ihre Lage im Shader aus uT), Zufall nur gesät
// → ?t=12 zeigt das Bild bei 12 s angehalten (Screenshots), ← → spulen. Bild: Szene additiv in ein HalfFloat-Ziel,
// Bloom in zwei Stufen (¼ und ⅛), Komposition mit Schleier, Blitz, Belichtung, Vignette, Korn, ACES.

import * as THREE from 'three';
import { NOISE, FULLSCREEN_VERT } from './glsl.js';
import { mulberry32 } from './astro.js';
import { createSound } from './intro_v2_sound.js';

// Zeiten [s]: Funke → Sammeln → Luftholen → Knall → Nebel → Strahlen → Fahrt → Abblenden → Ende
export const T = { spark: 0, gather: 10, breath: 14.2, bang: 15, nebula: 15.6, rays: 19, drift: 23, fade: 47, end: 50 };
// Funken: [Start, Anschwellen, Halten, Abklingen, Helligkeit] – unregelmäßige Abstände, jeder etwas heller als der vorige
export const BLINKS = [
  [0.8, 1.8, 0.2, 1.4, 0.30], [3.6, 1.3, 0.1, 1.1, 0.40], [5.3, 1.0, 0.15, 0.9, 0.50],
  [6.9, 1.1, 0.2, 0.8, 0.58], [8.3, 0.7, 0.1, 0.6, 0.70], [9.3, 0.55, 0.15, 0.4, 0.85],
];
const PHASES = [[T.gather, 'Funke'], [T.breath, 'Sammeln'], [T.bang, 'Luftholen'], [T.nebula, 'Knall'], [T.rays, 'Nebel'], [T.drift, 'Strahlen'], [T.fade, 'Fahrt'], [T.end, 'Ende']];
const N = { streaks: 7000, speckles: 6000, filaments: 14, perFilament: 16, diffuse: 70, seed: 110, rays: 14, dust: 3000, stars: 1200 };

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lin = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
const sm = (a, b, x) => { const k = lin(a, b, x); return k * k * (3 - 2 * k); };
// weiches 1D-Rauschen (für das Wackeln der Kamera), deterministisch
function n1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const h = (k) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  return h(i) * (1 - u) + h(i + 1) * u;
}

// ---------- Hüllkurven: alles, was sich mit der Zeit ändert, aus t ----------
function blink(t) {
  let v = 0;
  for (const [s, rise, hold, fall, peak] of BLINKS) {
    if (t < s || t > s + rise + hold + fall) continue;
    const k = t < s + rise ? sm(0, 1, (t - s) / rise) ** 1.6 : t < s + rise + hold ? 1 : 1 - sm(0, 1, (t - s - rise - hold) / fall);
    v += peak * k;
  }
  return v;
}
function heartbeat(t) {   // Takt 0,7 → 2,3 Hz zwischen Sammeln und Knall (unter 3 Hz), Phase geschlossen integriert
  const u = lin(T.gather, T.bang, t);
  const phi = (T.bang - T.gather) * (0.7 * u + 0.8 * u * u);
  return Math.max(0, Math.sin(phi * Math.PI * 2)) ** 4;
}
function envAt(t) {
  const tb = t - T.bang, pre = tb < 0;
  const gather = sm(T.gather, T.bang, t), b = blink(t);
  const e = {};
  if (pre) {
    const base = sm(T.gather, T.gather + 2.5, t) * (0.9 + 0.9 * gather);
    const breath = 1 - 0.65 * sm(T.breath, T.bang - 0.15, t) + 1.6 * sm(T.bang - 0.15, T.bang, t);
    e.coreI = (b * 1.4 + base * (1 + 0.35 * heartbeat(t))) * breath;
    e.coreSize = 0.22 + 0.06 * b + 0.14 * gather * (1 - 0.5 * sm(T.breath, T.bang, t));
    e.coreCol = [0.72 + 0.28 * gather, 0.84 + 0.1 * gather, 1.0 - 0.12 * gather];
  } else {
    e.coreI = 9 * Math.exp(-tb * 1.8) + 3.4 + 0.3 * Math.sin(tb * 0.9);
    e.coreSize = 0.62 + 0.9 * Math.exp(-tb * 1.2);
    e.coreCol = [1.0, 0.94, 0.86];
  }
  e.seedA = sm(T.gather, T.gather + 2.2, t) * (1 - sm(T.bang - 0.05, T.bang, t)) * (1 - 0.6 * sm(T.breath, T.bang, t));
  e.seedScale = 1 - 0.94 * lin(T.gather + 1, T.bang, t) ** 2.2;
  e.seedRot = t * 0.25 + 2.5 * lin(T.gather + 1, T.bang, t) ** 3;
  // weiter Schein um die Mitte: beim Sammeln rosa-weiß, nach dem Knall warm (Glutbett des Nebels)
  e.glowI = pre ? 0.35 * e.seedA * (0.6 + 0.4 * gather) : 0.22 * sm(T.nebula, T.nebula + 4, t);
  e.glowSize = pre ? 1.1 * (0.3 + 0.7 * e.seedScale) : 3.6;
  e.glowCol = pre ? [0.9, 0.55, 0.6] : [0.75, 0.42, 0.22];
  e.ballR = pre ? 0 : 1.4 * (1 - Math.exp(-tb * 2.6));
  e.ballI = pre ? 0 : 4 * Math.exp(-tb * 1.3) * sm(0, 0.08, tb);
  e.ringR = pre ? 0 : 4.0 * (1 - Math.exp(-tb * 2.4));
  e.ringA = pre ? 0 : 0.28 * (1 - sm(0, 1.3, tb));
  e.flash = pre ? 0 : 1.3 * Math.exp(-tb * 6);
  e.haze = pre ? 0 : 0.18 * sm(0, 0.15, tb) * (1 - sm(0.8, 2.6, tb));
  e.nebA = sm(T.nebula, T.nebula + 3.2, t);
  e.spread = 0.5 + 0.5 * sm(T.nebula, T.nebula + 5, t) ** 0.6 + 0.08 * lin(T.drift, T.end, t);
  e.rayGrow = sm(T.rays, T.rays + 4, t);
  e.dustA = sm(T.bang + 1, T.bang + 5, t);
  e.starsA = 0.8 * sm(T.bang + 2, T.bang + 8, t);
  e.expo = 1 - 0.3 * sm(T.breath, T.bang - 0.1, t) + (pre ? 0 : 0.6 * Math.exp(-tb * 2.5));
  e.fade = sm(0, 1.2, t) * (1 - sm(T.fade, T.end, t));
  return e;
}
// Kamera: Anfahrt im Funken, heran beim Sammeln, Dolly-Zoom beim Luftholen, Rückstoß + Wackeln beim Knall, dann Bahn
function camAt(t) {
  const tb = t - T.bang;
  let dist = 7.0 - 0.5 * sm(0, T.gather, t) - 1.0 * sm(T.gather, T.bang, t) ** 1.5, fov = 38, yaw = 0, pitch = 0, roll = 0;
  const br = sm(T.breath, T.bang, t);
  fov -= 6 * br; dist -= 0.3 * br;
  if (tb > 0) {   // Rückstoß weiter weg als vorher, Blickwinkel wieder auf 38°
    dist += 2.2 * (1 - Math.exp(-tb * 4)) - 0.4 * sm(0.6, 3, tb);
    fov += 6 * (1 - Math.exp(-tb * 3));
    const sh = Math.exp(-tb * 1.6) * 0.07 * sm(0, 0.05, tb);
    yaw += sh * n1(tb * 9); pitch += sh * n1(tb * 11 + 5); roll += sh * 0.6 * n1(tb * 7 + 9);
  }
  const td = Math.max(0, t - T.drift), dr = sm(T.drift, T.drift + 4, t);
  yaw += dr * 0.035 * td;
  pitch += 0.10 * Math.sin(td * 0.11) * dr;
  dist += 0.3 * Math.sin(td * 0.07) * dr;
  return { dist, yaw, pitch, roll, fov };
}

// ---------- Shader ----------
const BILLBOARD_VERT = /* glsl */ `
attribute vec3 iPos; attribute vec4 iData; attribute vec3 iCol;
uniform float uSpread, uScale, uRot;
varying vec2 vUv; varying vec4 vData; varying vec3 vCol;
void main() {
  vUv = uv; vData = iData; vCol = iCol;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(iData.y), s = sin(iData.y);
  vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iData.x * (0.4 + 0.6 * uScale);
  float cr = cos(uRot), sr = sin(uRot);
  vec3 p = vec3(cr * iPos.x - sr * iPos.y, sr * iPos.x + cr * iPos.y, iPos.z) * uSpread * uScale;
  gl_Position = projectionMatrix * viewMatrix * vec4(p + right * q.x + up * q.y, 1.0);
}`;
// Wolken aus dem gebackenen Atlas (4 × 2 Kacheln: R Dichte, G Fäden, B Farbvariation), drehen sich langsam je Wolke
const CLOUD_FRAG = /* glsl */ `
uniform sampler2D atlas; uniform float uT, uIn, uGain;
varying vec2 vUv; varying vec4 vData; varying vec3 vCol;
void main() {
  vec2 p = vUv - 0.5; float r = length(p) * 2.0;
  if (r > 1.0) discard;
  float edge = smoothstep(1.0, 0.2, r);
  float ang = uT * 0.012 * (vData.z - 0.5);
  float c = cos(ang), s = sin(ang);
  vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * 0.92;
  vec2 tile = vec2(mod(vData.w, 4.0), floor(vData.w / 4.0));
  vec3 n = texture2D(atlas, (tile + 0.5 + q) / vec2(4.0, 2.0)).rgb;
  float dens = smoothstep(0.42, 0.95, n.r);      // nur die dichten Stellen leuchten → Schleier statt Bälle
  float fil = pow(n.g, 3.0);
  float a = (dens * 0.7 + fil * 0.35) * edge * edge * edge;
  vec3 col = mix(vCol * 0.6, vCol * 1.4, n.b) + vec3(1.0, 0.85, 0.6) * fil * 0.3;
  gl_FragColor = vec4(col * a * uIn * uGain, 1.0);
}`;
// weiter weicher Schein (Nebelfleck beim Sammeln, Glutbett nach dem Knall)
const GLOW_FRAG = /* glsl */ `
uniform float uI; uniform vec3 uCol;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0; float r2 = dot(p, p);
  gl_FragColor = vec4(uCol * exp(-r2 * 3.5) * uI, 1.0);
}`;
const ATLAS_FRAG = NOISE + /* glsl */ `
varying vec2 vUv;
void main() {
  vec2 tuv = fract(vUv * vec2(4.0, 2.0));
  float tile = floor(vUv.x * 4.0) + 4.0 * floor(vUv.y * 2.0);
  vec3 p = vec3((tuv - 0.5) * 3.2, tile * 5.37 + 1.3);
  float n = fbm(p, 6) * 0.5 + 0.5;
  float f = ridged(p * 1.6 + 7.0, 5);
  float m = fbm(p * 0.7 + 21.0, 4) * 0.5 + 0.5;
  gl_FragColor = vec4(n, f, m, 1.0);
}`;
// Kern: Lichtpunkt mit weitem Hof und anamorphem Streif (blau, wie durch eine Linse)
const CORE_FRAG = /* glsl */ `
uniform float uI; uniform vec3 uCol;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
  float a = exp(-r * r * 14.0) + exp(-r * r * 2.2) * 0.10;
  float streak = exp(-abs(p.y) * 40.0) * exp(-abs(p.x) * 2.2) * 0.35;
  gl_FragColor = vec4((uCol * a + vec3(0.55, 0.75, 1.0) * streak) * uI, 1.0);
}`;
// Feuerball nach dem Knall: Rand vom Rauschen zerfranst
const BALL_FRAG = NOISE + /* glsl */ `
uniform float uI, uT;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
  float rr = r * (1.0 + 0.25 * fbm(vec3(p * 4.0, uT * 0.6), 3));
  float a = smoothstep(1.0, 0.3, rr) + pow(max(0.0, 1.0 - rr), 4.0) * 2.0;
  gl_FragColor = vec4(vec3(1.0, 0.9, 0.88) * a * uI, 1.0);
}`;
const RING_FRAG = /* glsl */ `
uniform float uI;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = exp(-pow((r - 0.82) * 6.0, 2.0)) * (1.0 - r);   // breite, weiche Druckwelle
  gl_FragColor = vec4(vec3(1.0, 0.8, 0.85) * a * uI, 1.0);
}`;
// Strahlen vom Kern: Quad steht immer zur Kamera (Zylinder-Billboard um die Strahlachse), wächst je Strahl verzögert
const RAY_VERT = /* glsl */ `
attribute vec3 iDir; attribute vec4 iData;
uniform float uGrow, uT;
varying vec2 vUv; varying vec4 vData;
void main() {
  vUv = uv; vData = iData;
  float sway = 0.04 * sin(uT * 0.21 + iData.z * 9.0);
  vec3 axis = normalize(iDir + vec3(sway, 0.0, -sway));
  float g = smoothstep(iData.w, iData.w + 0.55, uGrow);
  float along = uv.y * iData.x * g;
  vec3 center = axis * along;
  vec3 side = normalize(cross(axis, normalize(cameraPosition - center)));
  float w = iData.y * (0.25 + 0.75 * uv.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(center + side * (uv.x - 0.5) * w, 1.0);
}`;
// Lichtvorhang: weich zur Seite, Rauschen längs und quer (Schlieren wandern langsam nach außen)
const RAY_FRAG = NOISE + /* glsl */ `
uniform float uT, uI;
varying vec2 vUv; varying vec4 vData;
void main() {
  float x = (vUv.x - 0.5) * 2.0;
  float side = exp(-x * x * 3.0);
  float len = pow(1.0 - vUv.y, 1.4) * smoothstep(0.0, 0.06, vUv.y);
  float n = gnoise(vec3(vUv.y * 5.0 - uT * 0.12 + vData.z * 31.0, x * 1.5, vData.z * 7.0)) * 0.5 + 0.5;
  float n2 = gnoise(vec3(x * 2.5 + vData.z * 13.0, vUv.y * 2.0 - uT * 0.05, 3.0)) * 0.5 + 0.5;
  float a = side * len * (0.3 + 0.7 * n) * (0.45 + 0.75 * n2);
  vec3 col = mix(vec3(1.0, 0.82, 0.45), vec3(1.0, 0.55, 0.18), vUv.y);
  gl_FragColor = vec4(col * a * uI, 1.0);
}`;
// Teilchenstrahlen: Lage aus Richtung, Tempo und Zeit seit dem Knall (Bremsung), Schweif = gleiche Bahn kurz vorher
const STREAK_VERT = /* glsl */ `
attribute vec3 aDir; attribute vec4 aInfo;
uniform float uT, uBang;
varying float vA; varying float vTau;
void main() {
  float tau = max(0.0, uT - uBang - aInfo.y);
  float k = 0.85;
  float s = aInfo.x / k * (1.0 - exp(-k * tau));
  float tail = aInfo.x / k * (1.0 - exp(-k * max(0.0, tau - 0.09)));
  vec3 wp = aDir * mix(s, tail, aInfo.w);
  float life = smoothstep(0.0, 0.08, tau) * (1.0 - smoothstep(2.2, 4.0, tau));
  vA = life * (1.0 - 0.6 * aInfo.w) * (0.6 + 0.4 * aInfo.z);
  vTau = tau;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const STREAK_FRAG = /* glsl */ `
varying float vA; varying float vTau;
void main() {
  vec3 col = mix(vec3(1.0, 0.97, 0.92), vec3(1.0, 0.72, 0.45), smoothstep(0.5, 3.0, vTau));
  gl_FragColor = vec4(col * vA * 0.9, 1.0);
}`;
const SPECK_VERT = /* glsl */ `
attribute vec4 aInfo;
uniform float uT, uBang, uPx;
varying float vA;
void main() {
  float tau = max(0.0, uT - uBang - aInfo.y);
  float k = 1.3;
  vec3 wp = position * (aInfo.x / k * (1.0 - exp(-k * tau)));
  float life = smoothstep(0.0, 0.05, tau) * (1.0 - smoothstep(1.2, 3.2, tau));
  vA = life * (0.5 + 0.5 * aInfo.z);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_PointSize = uPx * (1.2 + 1.4 * aInfo.w) * (1.0 - 0.5 * smoothstep(0.0, 3.0, tau)) * 6.0 / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const POINT_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uI;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(uCol * vA * uI * (1.0 - r * r), 1.0);
}`;
const DUST_VERT = /* glsl */ `
attribute vec3 aCol; attribute float aSeed;
uniform float uT, uPx, uA, uDepth;
varying float vA; varying vec3 vCol;
void main() {
  vCol = aCol;
  float tw = 0.6 + 0.4 * sin(uT * (0.6 + aSeed) + aSeed * 20.0);
  vA = uA * tw;
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_PointSize = uPx * (0.6 + 0.9 * aSeed) * mix(1.0, 6.0 / max(1.0, -mv.z), uDepth);   // Staub nah größer, Sterne fest
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FRAG = /* glsl */ `
varying float vA; varying vec3 vCol;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(vCol * vA * (1.0 - r * r), 1.0);
}`;
// Nachbearbeitung: heller Anteil verkleinern, zweimal weichzeichnen, zusammensetzen
const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tex; uniform vec2 texel; uniform float thr;
varying vec2 vUv;
void main() {
  vec3 c = (texture2D(tex, vUv + texel * vec2(-0.5, -0.5)).rgb + texture2D(tex, vUv + texel * vec2(0.5, -0.5)).rgb
          + texture2D(tex, vUv + texel * vec2(-0.5, 0.5)).rgb + texture2D(tex, vUv + texel * vec2(0.5, 0.5)).rgb) * 0.25;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * clamp((l - thr) / max(l, 1e-4), 0.0, 1.0), 1.0);
}`;
const BLUR_FRAG = /* glsl */ `
uniform sampler2D tex; uniform vec2 dir;
varying vec2 vUv;
void main() {
  float w[5]; w[0] = 0.227; w[1] = 0.1946; w[2] = 0.1216; w[3] = 0.0540; w[4] = 0.0162;
  vec3 c = texture2D(tex, vUv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture2D(tex, vUv + dir * float(i)).rgb * w[i];
    c += texture2D(tex, vUv - dir * float(i)).rgb * w[i];
  }
  gl_FragColor = vec4(c, 1.0);
}`;
const COMPOSITE_FRAG = NOISE + /* glsl */ `
uniform sampler2D tex, b1, b2; uniform float uExpo, uFlash, uHaze, uT, uFade;
varying vec2 vUv;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec3 c = texture2D(tex, vUv).rgb + texture2D(b1, vUv).rgb * 0.9 + texture2D(b2, vUv).rgb * 0.7;
  vec2 q = vUv - 0.5;
  c += vec3(0.55, 0.22, 0.27) * uHaze * (0.35 + 0.65 * (1.0 - smoothstep(0.0, 0.6, length(q))));   // rosa Schleier, zur Mitte dichter
  c += vec3(1.0, 0.96, 0.92) * uFlash;
  c *= uExpo;
  c *= clamp(1.0 - 1.1 * dot(q, q), 0.0, 1.0);
  c = aces(c);
  c += (hash12(gl_FragCoord.xy + fract(uT) * 1000.0) - 0.5) * 0.025;
  c *= uFade;
  gl_FragColor = vec4(pow(max(c, 0.0), vec3(1.0 / 2.2)), 1.0);
}`;

// ---------- Aufbau ----------
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.autoClear = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const rand = mulberry32(2026);
const add = { transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending };

function additive(vertexShader, fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, ...add });
}
function quadGeometry(n) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.instanceCount = n;
  return g;
}
function mesh(geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.frustumCulled = false;
  scene.add(m);
  return m;
}
// Wolken-Atlas einmal backen (8 Kacheln Rauschen), danach billig je Pixel
const atlas = new THREE.WebGLRenderTarget(2048, 1024, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
const fsq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
function pass(material, target) {
  fsq.material = material;
  renderer.setRenderTarget(target);
  renderer.render(fsq, ortho);
}
pass(new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: ATLAS_FRAG }), atlas);

// Wolken: Nebel nach dem Knall (abgeplattete Wolke um den Kern, türkis + bernstein) und Nebelfleck vor dem Knall (Scheibe)
function clouds(n, place, uniforms) {
  const g = quadGeometry(n), pos = new Float32Array(n * 3), data = new Float32Array(n * 4), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = place(i);
    pos.set(p.pos, i * 3); data.set([p.size, rand() * Math.PI * 2, rand(), Math.floor(rand() * 8)], i * 4); col.set(p.col, i * 3);
  }
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
  g.setAttribute('iData', new THREE.InstancedBufferAttribute(data, 4));
  g.setAttribute('iCol', new THREE.InstancedBufferAttribute(col, 3));
  return mesh(g, additive(BILLBOARD_VERT, CLOUD_FRAG, { atlas: { value: atlas.texture }, uT: { value: 0 }, uIn: { value: 0 }, uGain: { value: 1 }, uSpread: { value: 1 }, uScale: { value: 1 }, uRot: { value: 0 }, ...uniforms }));
}
const TEAL = [0.2, 0.62, 0.45], AMBER = [0.6, 0.32, 0.1], RUST = [0.42, 0.17, 0.12], ROSE = [0.8, 0.35, 0.4];
function gaussian() { let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function tint(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
// Nebel nach dem Knall wie im Video: Fäden, die vom Kern nach außen laufen (Bögen mit kleinen Wolken darauf, nach außen
// feiner), dazu verstreute Wolken; türkis überwiegt, bernstein und rostbraun dazwischen, viel Schwarz dazwischen
const nebulaSpots = [];
for (let f = 0; f < N.filaments; f++) {
  const a = rand() * Math.PI * 2, el = (rand() - 0.5) * 1.2, len = 1.6 + rand() * 1.4;
  const d = [Math.cos(a) * Math.cos(el), Math.sin(el) * 0.7, Math.sin(a) * Math.cos(el)];
  const bend = [gaussian() * 0.5, gaussian() * 0.4, gaussian() * 0.5];
  const c = rand() < 0.6 ? TEAL : rand() < 0.6 ? AMBER : RUST;
  for (let i = 0; i < N.perFilament; i++) {
    const u = (i + rand()) / N.perFilament, w = u * (1 - u) * 4;
    nebulaSpots.push({ pos: [d[0] * u * len + bend[0] * w + gaussian() * 0.08, d[1] * u * len + bend[1] * w + gaussian() * 0.08, d[2] * u * len + bend[2] * w + gaussian() * 0.08],
      size: 0.9 + rand() * 0.8 - 0.4 * u, col: tint(c, 0.7 + rand() * 0.6) });
  }
}
for (let i = 0; i < N.diffuse; i++) {
  const c = rand() < 0.55 ? TEAL : rand() < 0.5 ? AMBER : RUST;
  nebulaSpots.push({ pos: [gaussian() * 0.95, gaussian() * 0.55, gaussian() * 0.7], size: 0.8 + rand() * 1.0, col: tint(c, 0.6 + rand() * 0.6) });
}
const nebula = clouds(nebulaSpots.length, (i) => nebulaSpots[i]);
nebula.material.uniforms.uGain.value = 0.32;
// Nebelfleck vor dem Knall: dichte flache Wolke um die Mitte, türkis und rosa, nach außen dünner
const seed = clouds(N.seed, () => {
  const c = rand() < 0.55 ? TEAL : ROSE, r = Math.abs(gaussian()) * 0.45 + 0.08, a = rand() * Math.PI * 2;
  return { pos: [Math.cos(a) * r, Math.sin(a) * r * 0.6, (rand() - 0.5) * 0.2], size: 0.16 + rand() * 0.3, col: tint(c, 0.7 + rand() * 0.8) };
});
seed.material.uniforms.uGain.value = 0.7;

// Kern, Feuerball, Druckring: je ein Billboard mit eigenem Shader (Größe über uScale, Lage 0)
function billboard(frag, uniforms) {
  const g = quadGeometry(1);
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array([0, 0, 0]), 3));
  g.setAttribute('iData', new THREE.InstancedBufferAttribute(new Float32Array([1, 0, 0, 0]), 4));
  g.setAttribute('iCol', new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1]), 3));
  const vert = BILLBOARD_VERT.replace('(0.4 + 0.6 * uScale)', 'uScale');
  return mesh(g, additive(vert, frag, { uSpread: { value: 1 }, uScale: { value: 1 }, uRot: { value: 0 }, uT: { value: 0 }, ...uniforms }));
}
const core = billboard(CORE_FRAG, { uI: { value: 0 }, uCol: { value: new THREE.Vector3(0.72, 0.84, 1.0) } });
const glow = billboard(GLOW_FRAG, { uI: { value: 0 }, uCol: { value: new THREE.Vector3(1, 1, 1) } });
const ball = billboard(BALL_FRAG, { uI: { value: 0 } });
const ring = billboard(RING_FRAG, { uI: { value: 0 } });

// Strahlen: zwei Bündel oben und unten (wie im Video), ein paar Streuner; Länge, Breite, Keim, Verzögerung
const rays = (() => {
  const g = quadGeometry(N.rays), dir = new Float32Array(N.rays * 3), data = new Float32Array(N.rays * 4);
  for (let i = 0; i < N.rays; i++) {
    let d;
    if (i < 10) {
      const up = i % 2 ? 1 : -1, a = (rand() - 0.5) * 0.7, b = (rand() - 0.5) * 0.7;
      d = [Math.sin(a) * 0.8 + 0.15, up * Math.cos(a) * Math.cos(b), Math.sin(b) * 0.8];
    } else d = [gaussian(), gaussian() * 0.5, gaussian()];
    const l = Math.hypot(...d);
    dir.set(d.map((x) => x / l), i * 3);
    data.set([2.8 + rand() * 2.8, 0.3 + rand() * 0.9, rand(), rand() * 0.45], i * 4);
  }
  g.setAttribute('iDir', new THREE.InstancedBufferAttribute(dir, 3));
  g.setAttribute('iData', new THREE.InstancedBufferAttribute(data, 4));
  const uv = g.getAttribute('uv');   // Quad von 0 (Kern) bis 1 (Spitze) entlang y
  uv.setXY(0, 0, 0); uv.setXY(1, 1, 0); uv.setXY(2, 1, 1); uv.setXY(3, 0, 1);
  return mesh(g, additive(RAY_VERT, RAY_FRAG, { uGrow: { value: 0 }, uT: { value: 0 }, uI: { value: 0.4 } }));
})();

// Teilchen des Knalls: Strahlen als Linien (zwei Enden je Teilchen), Kugel aus feinen Punkten
function unit() { const z = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), r * Math.sin(a), z]; }
const streaks = (() => {
  const n = N.streaks, dir = new Float32Array(n * 6), info = new Float32Array(n * 8);
  for (let i = 0; i < n; i++) {
    const d = unit(), v = 0.6 + rand() ** 2 * 2.2, t0 = rand() * 0.25, s = rand();
    for (let e = 0; e < 2; e++) { dir.set(d, i * 6 + e * 3); info.set([v, t0, s, e], i * 8 + e * 4); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  const m = new THREE.LineSegments(g, additive(STREAK_VERT, STREAK_FRAG, { uT: { value: 0 }, uBang: { value: T.bang } }));
  m.frustumCulled = false; scene.add(m);
  return m;
})();
const speckles = (() => {
  const n = N.speckles, pos = new Float32Array(n * 3), info = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { pos.set(unit(), i * 3); info.set([0.3 + rand() ** 1.5 * 1.6, rand() * 0.2, rand(), rand()], i * 4); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  const m = new THREE.Points(g, additive(SPECK_VERT, POINT_FRAG, { uT: { value: 0 }, uBang: { value: T.bang }, uPx: { value: 2 }, uCol: { value: new THREE.Vector3(1, 0.95, 0.9) }, uI: { value: 0.8 } }));
  m.frustumCulled = false; scene.add(m);
  return m;
})();
// Staub im Raum (Parallaxe auf der Fahrt) und ferne Sterne
function points(n, radius, size, colors, depth) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = unit(), r = radius * (0.3 + 0.7 * Math.cbrt(rand()));
    pos.set([u[0] * r, u[1] * r, u[2] * r], i * 3);
    col.set(colors[Math.floor(rand() * colors.length)], i * 3);
    s[i] = rand();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
  const m = new THREE.Points(g, additive(DUST_VERT, DUST_FRAG, { uT: { value: 0 }, uPx: { value: size }, uA: { value: 0 }, uDepth: { value: depth } }));
  m.frustumCulled = false; scene.add(m);
  return m;
}
const dust = points(N.dust, 4.5, 1.6, [[1, 0.9, 0.75], [1, 0.9, 0.75], [0.7, 1, 0.85], [1, 0.7, 0.45]], 1);
const stars = points(N.stars, 60, 1.4, [[0.9, 0.93, 1], [1, 0.95, 0.85]], 0);

// Nachbearbeitung
const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rtScene = new THREE.WebGLRenderTarget(2, 2, rtOpts);
const rtQ = [new THREE.WebGLRenderTarget(2, 2, rtOpts), new THREE.WebGLRenderTarget(2, 2, rtOpts)];
const rtE = [new THREE.WebGLRenderTarget(2, 2, rtOpts), new THREE.WebGLRenderTarget(2, 2, rtOpts)];
const bright = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: BRIGHT_FRAG, uniforms: { tex: { value: null }, texel: { value: new THREE.Vector2() }, thr: { value: 0.7 } } });
const blur = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: BLUR_FRAG, uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } } });
const composite = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: COMPOSITE_FRAG,
  uniforms: { tex: { value: rtScene.texture }, b1: { value: rtQ[0].texture }, b2: { value: rtE[0].texture }, uExpo: { value: 1 }, uFlash: { value: 0 }, uHaze: { value: 0 }, uT: { value: 0 }, uFade: { value: 0 } } });

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  rtScene.setSize(W, H);
  rtQ.forEach((r) => r.setSize(Math.ceil(W / 4), Math.ceil(H / 4)));
  rtE.forEach((r) => r.setSize(Math.ceil(W / 8), Math.ceil(H / 8)));
  const px = 1.8 * dpr;
  speckles.material.uniforms.uPx.value = px; dust.material.uniforms.uPx.value = 1.6 * dpr; stars.material.uniforms.uPx.value = 1.4 * dpr;
}
// eine Bloom-Stufe: hellen Anteil aus `src` in pair[0] verkleinern, waagerecht nach pair[1], senkrecht zurück nach pair[0]
function bloomLevel(src, pair, thr) {
  bright.uniforms.tex.value = src.texture; bright.uniforms.texel.value.set(1 / src.width, 1 / src.height); bright.uniforms.thr.value = thr;
  pass(bright, pair[0]);
  blur.uniforms.tex.value = pair[0].texture; blur.uniforms.dir.value.set(1.5 / pair[0].width, 0); pass(blur, pair[1]);
  blur.uniforms.tex.value = pair[1].texture; blur.uniforms.dir.value.set(0, 1.5 / pair[0].height); pass(blur, pair[0]);
}
function renderFrame() {
  renderer.setRenderTarget(rtScene); renderer.clear();
  renderer.render(scene, camera);
  bloomLevel(rtScene, rtQ, 0.7);
  bloomLevel(rtQ[0], rtE, 0);
  pass(composite, null);
}

// ---------- Zeit → Bild ----------
const tmp = new THREE.Vector3();
function apply(t) {
  const e = envAt(t), c = camAt(t);
  const U = (m) => m.material.uniforms;
  U(core).uI.value = e.coreI; U(core).uScale.value = e.coreSize; U(core).uCol.value.fromArray(e.coreCol);
  U(seed).uIn.value = e.seedA; U(seed).uScale.value = e.seedScale; U(seed).uRot.value = e.seedRot; U(seed).uT.value = t;
  U(glow).uI.value = e.glowI; U(glow).uScale.value = e.glowSize; U(glow).uCol.value.fromArray(e.glowCol);
  U(ball).uI.value = e.ballI; U(ball).uScale.value = e.ballR * 2; U(ball).uT.value = t;
  U(ring).uI.value = e.ringA; U(ring).uScale.value = e.ringR * 2;
  U(streaks).uT.value = t; U(speckles).uT.value = t;
  U(nebula).uIn.value = e.nebA; U(nebula).uSpread.value = e.spread; U(nebula).uT.value = t;
  U(rays).uGrow.value = e.rayGrow; U(rays).uT.value = t;
  U(dust).uA.value = e.dustA; U(dust).uT.value = t;
  U(stars).uA.value = e.starsA; U(stars).uT.value = t;
  composite.uniforms.uExpo.value = e.expo; composite.uniforms.uFlash.value = e.flash; composite.uniforms.uHaze.value = e.haze;
  composite.uniforms.uT.value = t; composite.uniforms.uFade.value = e.fade;
  camera.fov = c.fov; camera.updateProjectionMatrix();
  camera.position.set(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch)).multiplyScalar(c.dist);
  camera.up.set(0, 1, 0);
  camera.lookAt(tmp.set(0, 0, 0));
  camera.rotateZ(c.roll);
  camera.updateMatrixWorld();
}

// ---------- Gastgeber: Uhr, Tasten, Ton, Anzeige ----------
const film = { t: 0, playing: false, started: false, muted: false };
const sound = createSound(T, BLINKS);
const el = { start: document.getElementById('start'), tc: document.getElementById('tc'), phase: document.getElementById('phase'), paused: document.getElementById('paused') };
const q = new URLSearchParams(location.search);
if (q.get('bars') === '0') document.body.classList.add('no-bars');

function phaseName(t) { return (PHASES.find(([end]) => t < end) || PHASES[PHASES.length - 1])[1]; }
function hud() {
  el.tc.textContent = film.t.toFixed(1).replace('.', ',') + ' s';
  el.phase.textContent = phaseName(film.t);
  el.paused.textContent = film.playing ? '' : 'Pause';
}
function start(muted) {
  if (film.t >= T.end) film.t = 0;   // „Noch einmal“
  film.started = true; film.muted = muted; film.playing = true;
  el.start.classList.add('is-hidden');
  document.body.classList.add('is-running');
  if (!muted) { sound.play(film.t); sound.setMuted(false); }
}
function seek(t) {
  film.t = clamp(t, 0, T.end);
  if (!film.muted && film.playing) sound.play(film.t);
}
function setPlaying(on) {
  film.playing = on;
  if (film.muted) return;
  if (on) sound.play(film.t); else sound.stop();
}
document.getElementById('go').addEventListener('click', () => start(false));
document.getElementById('go-mute').addEventListener('click', () => start(true));
window.addEventListener('keydown', (ev) => {
  if (!film.started || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  if (ev.key === ' ') { setPlaying(!film.playing); ev.preventDefault(); }
  else if (ev.key === 'ArrowRight') seek(film.t + (ev.shiftKey ? 5 : 1));
  else if (ev.key === 'ArrowLeft') seek(film.t - (ev.shiftKey ? 5 : 1));
  else if (ev.key === 'r' || ev.key === 'R') { seek(0); if (!film.playing) setPlaying(true); }
  else if (ev.key === 'm' || ev.key === 'M') { film.muted = !film.muted; if (film.muted) sound.stop(); else if (film.playing) { sound.play(film.t); sound.setMuted(false); } }
  else if (ev.key === 'b' || ev.key === 'B') document.body.classList.toggle('no-bars');
  else return;
  hud();
});
window.addEventListener('resize', resize);
resize();

// ?t=12 → Bild bei 12 s, angehalten, ohne Ton (Screenshots); ?play=1 dazu → läuft ab dort
if (q.has('t')) {
  film.t = clamp(parseFloat(q.get('t')) || 0, 0, T.end);
  film.started = true; film.muted = true; film.playing = q.get('play') === '1';
  el.start.classList.add('is-hidden');
  document.body.classList.add('is-running');
}

let last = performance.now(), frames = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (film.playing) {
    film.t += dt;
    if (film.t >= T.end) { film.t = T.end; film.playing = false; el.start.classList.remove('is-hidden'); document.getElementById('go').textContent = 'Noch einmal · mit Ton'; document.getElementById('go-mute').textContent = 'Noch einmal · ohne Ton'; film.started = false; }
  }
  apply(film.t);
  renderFrame();
  if ((frames++ & 7) === 0) hud();
  if (frames === 3) window.__introReady = true;   // Tests: drei Bilder gezeichnet
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
