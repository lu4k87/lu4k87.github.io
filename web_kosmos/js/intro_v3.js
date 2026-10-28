// Urknall-Intro v3 (User 28.10.2026): 30-s-Spot als eine einzige ununterbrochene Kamerafahrt (One-Shot: kein Schnitt,
// kein Schwenk, keine harten Richtungswechsel) nach dem Drehbuch des Users:
//   KONTRAKTION (0–7,2 s): langsame Vorwärtsfahrt durch Dunkelheit; ein ultrakompakter Lichtpunkt in der Mitte flimmert,
//     Materie stürzt spiralig hinein, der Punkt zieht sich zusammen, bis er blendet.
//   INITIALE EXPANSION (7,2–12 s): die Fahrt beschleunigt weich (C²-Tempoprofil), der Punkt wird zur omnidirektionalen
//     Druckwelle aus Plasma (Schale + Feuerball + Druckring); die Welle überrollt die Kamera (Weiß), die Kamera fliegt
//     mitten durch den Ausbruch, und um sie baut sich ein Korridor aus rotierenden Gas- und Energiebändern auf.
//   STRUDEL & GALAXIEN-VORBEIFLUG (12–23,5 s): gleichförmige Fahrt plus sehr weicher 360°-Korkenzieher (Rollen um die
//     eigene Achse); aus den Nebeln kondensieren Sternhaufen und Galaxienscheiben, die links, rechts, oben, unten nah an
//     der Linse vorbeiziehen, mit bläulichen und goldenen Sternentstehungsgebieten.
//   AUSGLEITEN (23,5–30 s): die Fahrt bremst stetig bis zum schwerelosen Gleiten, die Wände lösen sich auf, das weite
//     Universum voller glimmender Galaxien füllt das Bild. Kein Stopp – das Bild steht am Ende nur still.
// Eigenständige Seite web/intro_v3.html, noch nicht in der App (main.js/opener.js) eingebunden.
// Eine Uhr `film.t`; apply(t) ist reine Funktion der Zeit (Lage aller Teilchen im Shader aus uT, Zufall nur gesät) →
// ?t=12 zeigt das Bild bei 12 s angehalten (Screenshots), ← → spulen. Kamera: nur Fahrt entlang der Achse (Weg = Tempo
// als Tabelle integriert) + Rollen, Blick immer geradeaus. Bild wie v2: Szene additiv in HalfFloat, Bloom in drei Stufen,
// Komposition mit Fahrt-Unschärfe, Farbsaum, Blitz, Schleier, Vignette, Korn, ACES. Ton: intro_v3_sound.js.

import * as THREE from 'three';
import { NOISE, FULLSCREEN_VERT } from './glsl.js';
import { mulberry32 } from './astro.js';
import { createSound } from './intro_v3_sound.js';

// Zeiten [s]: Kontraktion → Beschleunigen → Ausbruch → Durchflug durch die Mitte → Strudel (Rollen roll0…roll1) → Ausgleiten → Ende
export const T = { contract: 0, surge: 7.2, burst: 8.0, through: 10.4, vortex: 12.0, roll0: 12.5, roll1: 23.0, glide: 23.5, end: 30 };
// Tempo [Einheiten/s]: Kriechen → Höchsttempo im Strudel → Gleiten; die Fahrt ist nie null
export const V = { creep: 1.1, max: 24, glide: 1.2 };
const SHELL = { max: 64, tau: 2.3 };   // Plasmaschale: Radius = max · (1 − e^(−t/τ)), anfangs ≈ 28 Einheiten/s
const PHASES = [[T.surge, 'Kontraktion'], [T.vortex, 'Expansion'], [T.glide, 'Strudel'], [T.end, 'Ausgleiten'], [Infinity, 'Ende']];
const N = { infall: 2600, stars: 5000, clouds: 1100, endClouds: 70, galaxies: 64, uniGalaxies: 120, farGalaxies: 8000, tinyGalaxies: 14000, clusters: 44, perCluster: 150, dust: 5000 };

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lin = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
const sm = (a, b, x) => { const k = lin(a, b, x); return k * k * (3 - 2 * k); };
// smootherstep: erste und zweite Ableitung an beiden Enden null → Tempo ohne Ruck, Rollen ohne Knick
const ss = (a, b, x) => { const k = lin(a, b, x); return k * k * k * (k * (k * 6 - 15) + 10); };
// weiches 1D-Rauschen (Flimmern), deterministisch
function n1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const h = (k) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  return h(i) * (1 - u) + h(i + 1) * u;
}

// ---------- Kamerafahrt: Tempo → Weg (Tabelle), Rollen ----------
export function velAt(t) {
  if (t < T.surge) return V.creep + 0.3 * sm(0, T.surge, t);                              // ganz leicht anziehend
  if (t < T.vortex) return 1.4 + (V.max - 1.4) * ss(T.surge, T.vortex, t);                // Ease-In ohne Erschütterung
  if (t < T.glide) return V.max;
  if (t < T.glide + 5.5) return V.max + (V.glide - V.max) * ss(T.glide, T.glide + 5.5, t); // stetiges Drosseln
  return V.glide;
}
const DT = 1 / 240, NT = Math.ceil(T.end / DT) + 2;
const S = new Float64Array(NT);
for (let i = 1; i < NT; i++) S[i] = S[i - 1] + 0.5 * (velAt((i - 1) * DT) + velAt(i * DT)) * DT;
function sAt(t) { const x = clamp(t, 0, T.end) / DT, i = Math.min(NT - 2, Math.floor(x)); return S[i] + (S[i + 1] - S[i]) * (x - i); }
function tAtS(s) {   // Umkehrung (S steigt streng)
  let lo = 0, hi = NT - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] < s) lo = m; else hi = m; }
  return (lo + (s - S[lo]) / Math.max(1e-9, S[hi] - S[lo])) * DT;
}
const Z0 = sAt(T.through);                    // Start so, dass die Kamera bei T.through genau durch die Mitte fliegt
export const camZ = (t) => Z0 - sAt(t);
export const rollAt = (t) => Math.PI * 2 * ss(T.roll0, T.roll1, t);
const shellR = (t) => t < T.burst ? 0 : SHELL.max * (1 - Math.exp(-(t - T.burst) / SHELL.tau));
// Zeitpunkt, an dem die Druckwelle die Kamera erreicht (Weiß)
export const TX = (() => { for (let t = T.burst; t < T.through; t += DT) if (shellR(t) >= camZ(t)) return t; return T.through - 0.5; })();
// Flimmern des Lichtpunkts: zwei Rauschlagen, gelegentlich fast dunkel
const flick = (t) => clamp(0.5 + 0.5 * n1(t * 9) + 0.3 * n1(t * 27 + 7), 0.04, 1.3);

// ---------- Hüllkurven: alles, was sich mit der Zeit ändert, aus t ----------
function envAt(t) {
  const v = velAt(t), vn = v / V.max, cz = camZ(t), tb = t - T.burst, post = tb > 0;
  const g = sm(0, T.surge, t), blind = sm(T.surge, T.burst, t);
  const uni = sm(T.glide - 1, T.glide + 4.5, t);
  const e = { v, vn, cz, roll: rollAt(t), uni };
  const amp = 1 - 0.75 * g;   // Flimmern beruhigt sich, je dichter der Punkt wird
  e.coreI = (0.5 + 3.0 * g * g + 7 * blind * blind) * (1 - amp * 0.45 + amp * 0.9 * flick(t)) * (1 - sm(T.burst, T.burst + 0.35, t));
  e.coreR = 0.11 - 0.085 * g;                       // Kernradius relativ zum Billboard: ultrakompakt
  e.coreSpk = 0.25 + 0.75 * g;
  e.lensI = 0.3 * sm(2.5, 6.5, t) * (1 - sm(T.surge + 0.3, T.burst, t));
  e.lensR = 0.32 - 0.16 * g;
  e.shellR = shellR(t);
  e.shellI = post ? 0.9 * Math.exp(-tb * 0.55) * sm(0, 0.08, tb) * (1 - 0.4 * sm(TX, TX + 0.3, t) - 0.6 * sm(TX + 0.3, TX + 2.5, t)) : 0;
  e.ballI = post ? 2.2 * Math.exp(-tb * 0.8) * sm(0, 0.06, tb) * sm(1.5, 4.5, Math.abs(cz)) : 0;   // blendet vor der Mitte aus, sonst füllt er das Bild flächig
  e.ballR = post ? 2.8 * (1 - Math.exp(-tb * 1.8)) : 0;
  e.ringR = post ? 42 * (1 - Math.exp(-tb * 1.4)) : 0;
  e.ringA = post && cz > 0.01 ? 0.35 * (1 - sm(0, 1.8, tb)) * (1 - sm(0.7, 0.98, e.ringR / cz)) : 0;
  e.flash = 0.8 * Math.exp(-(((t - TX) / 0.15) ** 2)) + 0.12 * Math.exp(-(((t - T.through) / 0.22) ** 2));   // nur kurze Blitze: Fläche + Gamma macht jedes Grundlicht grau
  e.haze = 0.1 * sm(TX - 0.1, TX + 0.2, t) * (1 - sm(T.through - 0.5, T.through + 1.5, t));
  e.hazeCol = [1 - 0.6 * uni, 0.62 - 0.12 * uni, 0.38 + 0.52 * uni];
  e.expo = 1 - 0.3 * sm(TX - 0.3, TX, t) * (1 - sm(T.through + 0.5, T.through + 3, t)) + 0.1 * uni;
  e.wall = sm(T.through - 0.8, T.through + 2.0, t) * (1 - sm(T.glide, T.glide + 4, t));
  e.galI = sm(T.through + 0.5, T.through + 2.5, t);
  e.dustI = sm(T.through, T.through + 1.5, t) * (0.35 + 0.65 * vn);
  e.dustLen = 0.05 + 1.2 * vn ** 1.3;
  e.warp = 0.016 * vn ** 1.6 + 0.01 * Math.exp(-(((t - TX) / 0.3) ** 2));
  e.ca = 0.0035 * vn + 0.002 * Math.min(1, e.flash);
  e.starsA = 0.12 * sm(T.through, T.vortex, t) + 0.5 * uni;   // anfangs absolute Dunkelheit
  e.fade = sm(0, 1.6, t);
  e.fov = 40 + 14 * vn + 6 * sm(T.glide, T.glide + 5.5, t);
  const hx = 0.1 * sm(T.through + 1, T.vortex + 2, t) * (1 - sm(T.glide, T.glide + 4, t));   // winzige Schraubenbahn, kein Schwenk
  e.cam = [hx * Math.sin(t * 0.37), hx * Math.cos(t * 0.29), cz];
  return e;
}

// ---------- Shader ----------
// Billboard zur Kamera an fester Stelle (Kern, Linsenring, Feuerball, Druckring); `up` ist das gerollte Kamera-Oben →
// der anamorphe Streif dreht mit der Linse, wie bei echter Optik
const BB_VERT = /* glsl */ `
uniform vec3 uPos; uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  gl_Position = projectionMatrix * viewMatrix * vec4(uPos + (right * position.x + up * position.y) * uSize, 1.0);
}`;
// Lichtpunkt: heißer Kern (Radius uCore), blauer Hof, anamorpher Streif, sechs Beugungsstrahlen mit Spektralsaum
const CORE_FRAG = /* glsl */ `
uniform float uI, uCore, uSpk, uT; uniform vec3 uCol;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
  float rc = r / uCore;
  float core = exp(-rc * rc) * 3.0 + exp(-rc * rc * 0.11) * 0.5 + exp(-r * 2.6) * 0.1;
  float streak = exp(-abs(p.y) * 70.0) * exp(-abs(p.x) * 3.0);
  float spikes = 0.0;
  for (int i = 0; i < 3; i++) {
    float a = float(i) * 1.0471976 + 0.5236;
    vec2 d = vec2(cos(a), sin(a));
    float along = abs(dot(p, d)), across = abs(dot(p, vec2(-d.y, d.x)));
    spikes += exp(-across * 90.0) * exp(-along * 4.5) * (0.6 + 0.4 * sin(along * 60.0 + uT * 0.3));
  }
  vec3 fringe = mix(vec3(1.0, 0.95, 0.9), vec3(0.45, 0.6, 1.0), smoothstep(0.0, 0.5, r));
  vec3 c = uCol * core + vec3(0.6, 0.78, 1.0) * streak * 0.5 + fringe * spikes * uSpk;
  gl_FragColor = vec4(c * uI, 1.0);
}`;
// Lichtring um den Punkt (Hinweis auf die Krümmung), vom Rauschen leicht verzerrt
const LENS_FRAG = NOISE + /* glsl */ `
uniform float uI, uR, uT;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
  float rr = uR * (1.0 + 0.06 * gnoise(vec3(p * 6.0, uT * 0.4)));
  float x = r - rr;
  float a = exp(-x * x * 3600.0) + 0.25 * exp(-x * x * 196.0);
  gl_FragColor = vec4(vec3(0.7, 0.82, 1.0) * a * uI, 1.0);
}`;
// Feuerball in der Mitte nach dem Ausbruch: Rand vom Rauschen zerfranst
const BALL_FRAG = NOISE + /* glsl */ `
uniform float uI, uT;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
  float rr = r * (1.0 + 0.25 * fbm(vec3(p * 4.0, uT * 0.6), 3));
  float a = smoothstep(1.0, 0.3, rr) + pow(max(0.0, 1.0 - rr), 4.0) * 2.0;
  gl_FragColor = vec4(vec3(1.0, 0.9, 0.85) * a * uI, 1.0);
}`;
const RING_FRAG = /* glsl */ `
uniform float uI;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float x = (r - 0.84) * 7.0;
  float a = exp(-x * x) * max(1.0 - r, 0.0);
  gl_FragColor = vec4(vec3(1.0, 0.85, 0.8) * a * uI, 1.0);
}`;
// Plasmaschale der Druckwelle: Kugel, von außen am Rand dichter (Sehstrahl durch mehr Plasma), von innen ein Himmel aus Glut
const SHELL_VERT = /* glsl */ `
varying vec3 vN, vW;
void main() {
  vN = normalize(position);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const SHELL_FRAG = NOISE + /* glsl */ `
uniform float uI, uT;
varying vec3 vN, vW;
void main() {
  vec3 n = normalize(vN);
  float f = fbm(n * 4.0 + uT * 0.35, 5) * 0.5 + 0.5;
  float fil = ridged(n * 7.0 + vec3(0.0, uT * 0.2, 0.0), 4);
  vec3 vd = normalize(cameraPosition - vW);
  float facing = abs(dot(n, vd));
  float limb = pow(max(1.0 - facing, 0.0), 1.5);   // max: Rundung > 1 gäbe NaN, der Bloom zieht es zum schwarzen Quadrat
  float dens = 0.35 + 0.65 * smoothstep(0.3, 0.9, f) + 0.6 * pow(fil, 2.0);
  vec3 col = mix(vec3(1.0, 0.55, 0.3), vec3(1.0, 0.95, 0.9), f) + vec3(0.4, 0.6, 1.0) * pow(fil, 3.0);
  gl_FragColor = vec4(col * dens * (0.25 + 0.75 * limb + 0.35 * facing) * uI, 1.0);
}`;
// Einstürzende Materie vor dem Ausbruch: Linien (Kopf + Schweif), Lage aus Spirale um eine je Teilchen eigene Ebene
const INFALL_VERT = /* glsl */ `
attribute vec3 aE1, aE2; attribute vec4 aInfo; attribute float aTail;
uniform float uT, uEnd, uI;
varying float vA; varying vec3 vCol;
void main() {
  float span = max(uEnd - aInfo.z, 0.5);
  float u = clamp((uT - aInfo.z) / span, 0.0, 1.0);
  float ut = clamp(u - 0.018 - 0.03 * u, 0.0, 1.0);
  float uu = mix(u, ut, aTail);
  float r = aInfo.x * pow(1.0 - uu, 0.55) + 0.03;
  float ang = aInfo.y + 5.0 * (1.0 - pow(1.0 - uu, 0.5)) + uT * 0.04;
  vec3 wp = (cos(ang) * aE1 + sin(ang) * aE2) * r;
  float heat = clamp(1.0 - r / aInfo.x, 0.0, 1.0);
  vA = uI * smoothstep(0.0, 0.6, uT - aInfo.z) * (0.2 + 0.8 * heat * heat) * (1.0 - smoothstep(uEnd - 0.2, uEnd, uT)) * (0.4 + 0.6 * aInfo.w) * (1.0 - 0.6 * aTail);
  vCol = mix(vec3(0.45, 0.6, 1.0), vec3(1.0, 0.93, 0.82), heat * heat);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const LINE_FRAG = /* glsl */ `
varying float vA; varying vec3 vCol;
void main() { gl_FragColor = vec4(vCol * vA, 1.0); }`;
// Korridor: Zylinder längs der Achse, Wand wellt organisch und weitet sich am Ende; Gas aus Rauschen in Zylinderkoordinaten
// (cos/sin → nahtlos), Energiebänder als Schraubenlinien, Farbe vom Ausbruch (weißheiß) bis in die Tiefe (eisblau/türkis)
const TUNNEL_VERT = /* glsl */ `
uniform float uT;
varying vec3 vW; varying float vAng;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  float ang = atan(w.y, w.x);
  float flare = 1.0 + 2.5 * smoothstep(-290.0, -340.0, w.z);
  float wob = 1.0 + 0.07 * sin(w.z * 0.06 + ang * 3.0 + uT * 0.3) + 0.05 * sin(w.z * 0.11 - ang * 2.0 - uT * 0.2);
  w.xy *= flare * wob;
  vW = w.xyz; vAng = ang;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const TUNNEL_FRAG = NOISE + /* glsl */ `
uniform float uT, uI, uWall, uCamZ, uFlow, uSeed, uOct;
varying vec3 vW; varying float vAng;
void main() {
  float z = vW.z, ahead = uCamZ - z;
  float a = vAng + uT * (0.22 + 0.08 * sin(z * 0.021));
  vec3 q = vec3(cos(a) * 2.2, sin(a) * 2.2, z * 0.035 + uT * uFlow);
  float gas = fbm(q * 1.4 + uSeed, 4) * 0.5 + 0.5;
  float fil = ridged(q * 2.6 + vec3(0.0, 0.0, uT * 0.1), 3);
  float band = 0.0;
  for (int i = 0; i < 2; i++) {
    float k = float(i);
    float ph = a * (3.0 + k) + z * (0.11 - 0.04 * k) + uT * (1.1 + 0.5 * k);
    float s = 0.5 + 0.5 * sin(ph);
    band += pow(s, 18.0 + 6.0 * k) * (0.5 + 0.5 * fbm(vec3(z * 0.05, cos(a) * 1.5, sin(a) * 1.5 + k * 9.0), 2));
  }
  float d = clamp(-z / 320.0, 0.0, 1.0);
  vec3 hot = vec3(1.0, 0.9, 0.8), orange = vec3(1.0, 0.45, 0.2), magenta = vec3(0.85, 0.25, 0.6), violet = vec3(0.45, 0.3, 0.9), ice = vec3(0.3, 0.7, 1.0), teal = vec3(0.25, 0.85, 0.8);
  vec3 col = d < 0.18 ? mix(hot, orange, d / 0.18) : d < 0.4 ? mix(orange, magenta, (d - 0.18) / 0.22) : d < 0.65 ? mix(magenta, violet, (d - 0.4) / 0.25) : d < 0.85 ? mix(violet, ice, (d - 0.65) / 0.2) : mix(ice, teal, (d - 0.85) / 0.15);
  float dens = smoothstep(0.5, 0.95, gas) * 0.8 + pow(fil, 4.0) * 0.9;   // viel Schwarz zwischen den Schwaden
  vec3 c = col * dens + vec3(0.75, 0.85, 1.0) * band * 1.4;
  float fog = exp(-max(ahead, 0.0) * 0.012);
  float near = smoothstep(-2.0, 6.0, ahead);
  float tail = smoothstep(-340.0, -300.0, z);
  gl_FragColor = vec4(c * uI * uWall * fog * near * tail, 1.0);
}`;
// Wolken des Korridors: Billboards auf Kreisbahnen um die Achse (Strudel: innen schneller), gedreht je Wolke; Lage aus uT
const CLOUD_VERT = /* glsl */ `
attribute vec4 iPol; attribute vec4 iData; attribute vec3 iCol;
uniform float uT, uCamZ;
varying vec2 vUv; varying vec4 vData; varying vec3 vCol; varying float vFade;
void main() {
  vUv = uv; vData = iData; vCol = iCol;
  float a = iPol.y + iPol.w * uT;
  vec3 c = vec3(cos(a) * iPol.x, sin(a) * iPol.x, iPol.z);
  float ahead = uCamZ - iPol.z;
  vFade = smoothstep(1.0, 7.0, ahead) * smoothstep(170.0, 90.0, ahead);
  if (vFade <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float cs = cos(iData.y + uT * 0.05), sn = sin(iData.y + uT * 0.05);
  vec2 q = vec2(cs * position.x - sn * position.y, sn * position.x + cs * position.y) * iData.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(c + right * q.x + up * q.y, 1.0);
}`;
const CLOUD_FRAG = /* glsl */ `
uniform sampler2D atlas; uniform float uT, uI;
varying vec2 vUv; varying vec4 vData; varying vec3 vCol; varying float vFade;
void main() {
  vec2 p = vUv - 0.5; float r = length(p) * 2.0;
  if (r > 1.0) discard;
  float edge = smoothstep(1.0, 0.2, r);
  float ang = uT * 0.012 * (vData.z - 0.5);
  float c = cos(ang), s = sin(ang);
  vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * 0.92;
  vec2 tile = vec2(mod(vData.w, 4.0), floor(vData.w / 4.0));
  vec3 n = texture2D(atlas, (tile + 0.5 + q) / vec2(4.0, 2.0)).rgb;
  float dens = smoothstep(0.42, 0.95, n.r);
  float fil = pow(n.g, 3.0);
  float a = (dens * 0.7 + fil * 0.35) * edge * edge * edge;
  vec3 col = mix(vCol * 0.6, vCol * 1.4, n.b) + vec3(1.0, 0.85, 0.6) * fil * 0.25;
  gl_FragColor = vec4(col * a * uI * vFade, 1.0);
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
// Galaxie prozedural: p = Scheibenkoordinate (−1 … 1), sA/sB Saat, type < 0,85 Spirale mit 2–4 Armen, sonst elliptisch;
// Bulge golden, Arme mit Staubbahn an der Innenkante, Sternentstehungsgebiete bläulich oder golden; k = Kondensation
// (0 diffuser Fleck … 1 fertige Scheibe), t = Zeit (die Arme drehen langsam – kinematisch, nicht astrophysikalisch)
const GALAXY_FN = NOISE + /* glsl */ `
vec3 galaxy(vec2 p, float sA, float sB, float type, float k, float t) {
  float r = length(p);
  float seed = sA * 17.0;
  float m = 2.0 + floor(min(type, 0.849) * 3.53);
  float ell = step(0.85, type);
  float wind = 2.0 + sB * 2.2;
  float ang = atan(p.y, p.x) + t * 0.10 * (sB - 0.5);
  float lr = log(max(r, 0.015));
  float phi = ang * m - lr * wind * m + seed;
  float arm = mix(pow(0.5 + 0.5 * cos(phi), 2.4), 0.45, ell);
  float n = fbm(vec3(p * 5.0, seed), 4) * 0.5 + 0.5;
  float clump = ridged(vec3(p * 7.0 + 3.0, seed + 5.0), 4);
  float disk = exp(-r * mix(3.4, 2.6, ell));
  float bulge = exp(-r * r * mix(28.0, 9.0, ell)) * mix(1.4, 0.8, ell);
  float arms = arm * disk * (0.45 + 0.9 * n) * smoothstep(0.03, 0.2, r) * mix(1.0, 0.5, ell);
  float lane = arm * smoothstep(0.1, 0.6, r) * pow(0.5 + 0.5 * cos(phi + 1.2), 6.0) * 0.6 * (1.0 - ell);
  float hii = pow(clump, 3.0) * arm * smoothstep(0.15, 0.4, r) * (1.0 - smoothstep(0.75, 1.0, r)) * (1.0 - ell);
  vec3 old = vec3(1.0, 0.86, 0.66), young = vec3(0.55, 0.72, 1.0), gold = vec3(1.0, 0.72, 0.35);
  float pick = smoothstep(0.4, 0.6, fbm(vec3(p * 2.0 + 9.0, seed), 2) * 0.5 + 0.5);
  vec3 col = (old * (bulge + arms * 0.55) + young * arms * 0.5 + mix(gold, young, pick) * hii * 2.4) * (1.0 - lane);
  float blob = exp(-r * r * 2.6) * (0.35 + 0.65 * n);
  return mix(vec3(0.6, 0.7, 1.0) * blob * 0.45, col * mix(1.0, 0.55, ell), k) * smoothstep(1.0, 0.72, r);
}`;
// Galaxienscheibe als Quad mit eigener Lage im Raum (iE1/iE2 = Scheibenebene), kondensiert beim Näherkommen
const GALAXY_VERT = /* glsl */ `
attribute vec3 iPos, iE1, iE2; attribute vec4 iData;
uniform float uCamZ, uNear, uFar;
varying vec2 vUv; varying vec4 vData; varying float vK, vFade;
void main() {
  vUv = uv; vData = iData;
  float ahead = uCamZ - iPos.z;
  vK = smoothstep(uFar, uNear, ahead);
  vFade = smoothstep(-1.0, 1.5, ahead);
  if (vFade <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 w = iPos + (iE1 * position.x + iE2 * position.y) * iData.x * 2.0 * (1.0 + 0.5 * (1.0 - vK));
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const GALAXY_FRAG = GALAXY_FN + /* glsl */ `
uniform float uT, uI;
varying vec2 vUv; varying vec4 vData; varying float vK, vFade;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  if (dot(p, p) > 1.0) discard;
  gl_FragColor = vec4(galaxy(p, vData.y, vData.z, vData.w, vK, uT) * uI * vFade, 1.0);
}`;
const GALAXY_ATLAS_FRAG = GALAXY_FN + /* glsl */ `
varying vec2 vUv;
void main() {
  vec2 tuv = fract(vUv * vec2(4.0, 2.0));
  float tile = floor(vUv.x * 4.0) + 4.0 * floor(vUv.y * 2.0);
  float type = tile < 6.0 ? fract(tile * 0.29) * 0.84 : 0.9;
  gl_FragColor = vec4(galaxy((tuv - 0.5) * 2.0, fract(tile * 0.37 + 0.11), fract(tile * 0.61 + 0.43), type, 1.0, 0.0), 1.0);
}`;
// ferne Galaxien als Punkt-Sprites aus dem gebackenen Atlas, je Punkt gedreht
const FAR_VERT = /* glsl */ `
attribute float aSize, aTile, aRot; attribute vec3 aCol;
uniform float uPx;
varying vec3 vCol; varying float vTile, vRot;
void main() {
  vCol = aCol; vTile = aTile; vRot = aRot;
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx;
  gl_Position = projectionMatrix * mv;
}`;
const FAR_FRAG = /* glsl */ `
uniform sampler2D atlas; uniform float uA;
varying vec3 vCol; varying float vTile, vRot;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  vec2 p = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  if (dot(p, p) > 0.25) discard;
  vec2 tile = vec2(mod(vTile, 4.0), floor(vTile / 4.0));
  gl_FragColor = vec4(texture2D(atlas, (tile + 0.5 + p) / vec2(4.0, 2.0)).rgb * vCol * uA, 1.0);
}`;
// Sternhaufen: Punkte um ein Zentrum, kondensieren aus einer weiteren Wolke, funkeln
const CLUSTER_VERT = /* glsl */ `
attribute vec3 aCenter, aCol; attribute vec2 aInfo;
uniform float uT, uCamZ, uNear, uFar, uPx, uI;
varying float vA; varying vec3 vCol;
void main() {
  vCol = aCol;
  float ahead = uCamZ - aCenter.z;
  float k = smoothstep(uFar, uNear, ahead);
  vec3 p = aCenter + (position - aCenter) * (1.0 + 0.8 * (1.0 - k));
  float tw = 0.6 + 0.4 * sin(uT * (3.0 + aInfo.x * 4.0) + aInfo.x * 40.0);
  vA = uI * k * tw * smoothstep(-0.5, 2.0, ahead) * (0.5 + 0.5 * aInfo.y);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = uPx * (0.7 + aInfo.y) * clamp(10.0 / max(1.0, -mv.z), 0.4, 2.5);
  gl_Position = projectionMatrix * mv;
}`;
// Staub im Korridor als Linien: Schweif entgegen der Fahrt, Länge mit dem Tempo (Bewegungsunschärfe)
const DUST_VERT = /* glsl */ `
attribute float aTail, aSeed;
uniform float uCamZ, uLen, uI;
varying float vA; varying vec3 vCol;
void main() {
  float ahead = uCamZ - position.z;
  vec3 p = position; p.z += aTail * uLen;
  float near = smoothstep(0.3, 3.0, ahead) * smoothstep(140.0, 50.0, ahead);
  vA = uI * near * (0.5 + 0.5 * aSeed) * (1.0 - 0.75 * aTail);
  vCol = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.65), aSeed);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
// Punkte mit weichem Rand: Sterne (fest), winzige ferne Galaxien
const POINT_VERT = /* glsl */ `
attribute vec3 aCol; attribute float aSeed;
uniform float uT, uPx, uA, uTwinkle;
varying float vA; varying vec3 vCol;
void main() {
  vCol = aCol;
  vA = uA * (1.0 - uTwinkle * 0.4 * (0.5 + 0.5 * sin(uT * (0.6 + aSeed) + aSeed * 20.0)));
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_PointSize = uPx * (0.6 + 0.9 * aSeed);
  gl_Position = projectionMatrix * mv;
}`;
const POINT_FRAG = /* glsl */ `
varying float vA; varying vec3 vCol;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(vCol * vA * (1.0 - r * r), 1.0);
}`;
// Nachbearbeitung: heller Anteil verkleinern, weichzeichnen (drei Stufen), zusammensetzen
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
// Komposition: Fahrt-Unschärfe radial (uWarp), Bloom mit Farbsaum (uCA), Schleier, Blitz, Belichtung, Vignette, ACES, Korn
const COMPOSITE_FRAG = NOISE + /* glsl */ `
uniform sampler2D tex, b1, b2, b3; uniform float uExpo, uFlash, uHaze, uT, uFade, uWarp, uCA; uniform vec3 uHazeCol;
varying vec2 vUv;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec2 q = vUv - 0.5;
  vec3 c = vec3(0.0);
  for (int i = 0; i < 8; i++) { float k = (float(i) - 3.5) / 3.5; c += texture2D(tex, vUv - q * k * uWarp).rgb; }
  c *= 0.125;
  vec2 ca = q * uCA;
  c += vec3(texture2D(b1, vUv + ca).r, texture2D(b1, vUv).g, texture2D(b1, vUv - ca).b) * 0.85
     + vec3(texture2D(b2, vUv + ca * 2.0).r, texture2D(b2, vUv).g, texture2D(b2, vUv - ca * 2.0).b) * 0.6
     + texture2D(b3, vUv).rgb * 0.3;
  c += uHazeCol * uHaze * (0.5 + 0.5 * (1.0 - smoothstep(0.0, 0.7, length(q))));
  c += vec3(1.0, 0.97, 0.93) * uFlash;
  c *= uExpo;
  c *= clamp(1.0 - 0.9 * dot(q, q), 0.0, 1.0);
  c = aces(c);
  c += (hash12(gl_FragCoord.xy + fract(uT) * 1000.0) - 0.5) * 0.022;
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
const far = new THREE.Group();   // folgt der Kamera (Sterne und fernes Universum ohne Parallaxe)
scene.add(far);
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 1200);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const rand = mulberry32(2030);
const add = { transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending };
const additive = (vertexShader, fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, ...add });
function unit() { const z = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), r * Math.sin(a), z]; }
function gaussian() { let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// Scheibenebene aus einer Normalen: zwei Einheitsvektoren darin
function basis(n) { const e1 = norm(cross(n, unit())); return [e1, cross(n, e1)]; }
// Farbe des Korridors entlang der Achse (gleiche Stützstellen wie im Wand-Shader)
const STOPS = [[0, [1, 0.9, 0.8]], [0.18, [1, 0.45, 0.2]], [0.4, [0.85, 0.25, 0.6]], [0.65, [0.45, 0.3, 0.9]], [0.85, [0.3, 0.7, 1]], [1, [0.25, 0.85, 0.8]]];
function corridorColor(z) {
  const d = clamp(-z / 320, 0, 1);
  for (let i = 1; i < STOPS.length; i++) if (d <= STOPS[i][0]) { const k = lin(STOPS[i - 1][0], STOPS[i][0], d); return STOPS[i - 1][1].map((c, j) => c + (STOPS[i][1][j] - c) * k); }
  return STOPS[STOPS.length - 1][1];
}

function quadGeometry(n) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.instanceCount = n;
  return g;
}
function place(obj, parent = scene) { obj.frustumCulled = false; parent.add(obj); return obj; }
const fsq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
function pass(material, target) {
  fsq.material = material;
  renderer.setRenderTarget(target);
  renderer.render(fsq, ortho);
}
// Atlanten einmal backen: Wolken (8 Kacheln Rauschen), Galaxien (6 Spiralen, 2 elliptische)
const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const cloudAtlas = new THREE.WebGLRenderTarget(2048, 1024, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
pass(new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: ATLAS_FRAG }), cloudAtlas);
const galaxyAtlas = new THREE.WebGLRenderTarget(2048, 1024, rtOpts);
pass(new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: GALAXY_ATLAS_FRAG }), galaxyAtlas);

// Billboards in der Mitte: Kern, Linsenring, Feuerball, Druckring
function billboard(frag, size, uniforms) {
  const m = place(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), additive(BB_VERT, frag, { uPos: { value: new THREE.Vector3() }, uSize: { value: size }, uT: { value: 0 }, ...uniforms })));
  return m;
}
const core = billboard(CORE_FRAG, 2.4, { uI: { value: 0 }, uCore: { value: 0.1 }, uSpk: { value: 0.3 }, uCol: { value: new THREE.Vector3(0.9, 0.95, 1.0) } });
const lens = billboard(LENS_FRAG, 1.6, { uI: { value: 0 }, uR: { value: 0.3 } });
const ball = billboard(BALL_FRAG, 1, { uI: { value: 0 } });
const ring = billboard(RING_FRAG, 1, { uI: { value: 0 } });
// Plasmaschale
const shell = place(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 12), additive(SHELL_VERT, SHELL_FRAG, { uI: { value: 0 }, uT: { value: 0 } })));
shell.material.side = THREE.DoubleSide;

// Einstürzende Materie: je Teilchen eigene Bahnebene (zur Blickachse hin geneigt, damit die Spiralen zu sehen sind)
const infall = (() => {
  const n = N.infall, e1 = new Float32Array(n * 6), e2 = new Float32Array(n * 6), info = new Float32Array(n * 8), tail = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const u = unit(), nrm = norm([u[0] * 0.5, u[1] * 0.5, u[2] * 0.5 + 1]), [a, b] = basis(nrm);
    const d = [1.5 + rand() ** 1.5 * 9, rand() * Math.PI * 2, rand() * 4.5, rand()];
    for (let e = 0; e < 2; e++) { e1.set(a, i * 6 + e * 3); e2.set(b, i * 6 + e * 3); info.set(d, i * 8 + e * 4); tail[i * 2 + e] = e; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  g.setAttribute('aE1', new THREE.BufferAttribute(e1, 3));
  g.setAttribute('aE2', new THREE.BufferAttribute(e2, 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  g.setAttribute('aTail', new THREE.BufferAttribute(tail, 1));
  return place(new THREE.LineSegments(g, additive(INFALL_VERT, LINE_FRAG, { uT: { value: 0 }, uEnd: { value: T.burst - 0.05 }, uI: { value: 1 } })));
})();

// Korridor: zwei Wände (innen fein und schnell, außen weit und ruhig), Zylinder längs z von 0 bis −340
function tunnel(radius, seed, flow, gain) {
  const m = place(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 340, 96, 64, true),
    additive(TUNNEL_VERT, TUNNEL_FRAG, { uT: { value: 0 }, uI: { value: gain }, uWall: { value: 0 }, uCamZ: { value: 0 }, uFlow: { value: flow }, uSeed: { value: seed } })));
  m.material.side = THREE.DoubleSide;
  m.rotation.x = Math.PI / 2;   // Achse des Zylinders (y) → Welt z
  m.position.z = -170;
  return m;
}
const wallIn = tunnel(6.5, 0, 0.5, 0.09), wallOut = tunnel(11, 7, 0.25, 0.045);

// Wolken: Korridor (auf Kreisbahnen, innen schneller) und Dunst des Universums am Ende (fast ruhend)
function clouds(n, make) {
  const g = quadGeometry(n), pol = new Float32Array(n * 4), data = new Float32Array(n * 4), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = make(i);
    pol.set(c.pol, i * 4); data.set([c.size, rand() * Math.PI * 2, rand(), Math.floor(rand() * 8)], i * 4); col.set(c.col, i * 3);
  }
  g.setAttribute('iPol', new THREE.InstancedBufferAttribute(pol, 4));
  g.setAttribute('iData', new THREE.InstancedBufferAttribute(data, 4));
  g.setAttribute('iCol', new THREE.InstancedBufferAttribute(col, 3));
  return place(new THREE.Mesh(g, additive(CLOUD_VERT, CLOUD_FRAG, { atlas: { value: cloudAtlas.texture }, uT: { value: 0 }, uI: { value: 0 }, uCamZ: { value: 0 } })));
}
const tint = (c, k) => c.map((x) => x * k);
const corridorClouds = clouds(N.clouds, (i) => {
  const r = 5 + rand() * 6, z = -6 - (i + rand()) / N.clouds * 330;
  return { pol: [r, rand() * Math.PI * 2, z, 0.5 * (6 / r) ** 0.8 * (0.8 + 0.4 * rand())], size: 2 + rand() * 3, col: tint(corridorColor(z), 0.5 + rand() * 0.7) };
});
const endClouds = clouds(N.endClouds, () => {
  const r = 8 + rand() * 60, z = -360 - rand() * 260;
  return { pol: [r, rand() * Math.PI * 2, z, (rand() - 0.5) * 0.004], size: 14 + rand() * 24, col: tint(rand() < 0.5 ? [0.35, 0.45, 0.9] : [0.6, 0.4, 0.8], 0.12 + rand() * 0.1) };
});

// Galaxienscheiben: im Korridor (nah an der Linse) und im Universum am Ende (größer, ferner)
function galaxies(n, make, near, farD) {
  const g = quadGeometry(n), pos = new Float32Array(n * 3), e1 = new Float32Array(n * 3), e2 = new Float32Array(n * 3), data = new Float32Array(n * 4);
  const list = [];
  for (let i = 0; i < n; i++) {
    const gx = make(i), [a, b] = basis(unit());
    pos.set(gx.pos, i * 3); e1.set(a, i * 3); e2.set(b, i * 3); data.set([gx.size, rand(), rand(), rand()], i * 4);
    list.push(gx);
  }
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
  g.setAttribute('iE1', new THREE.InstancedBufferAttribute(e1, 3));
  g.setAttribute('iE2', new THREE.InstancedBufferAttribute(e2, 3));
  g.setAttribute('iData', new THREE.InstancedBufferAttribute(data, 4));
  const m = place(new THREE.Mesh(g, additive(GALAXY_VERT, GALAXY_FRAG, { uT: { value: 0 }, uI: { value: 0 }, uCamZ: { value: 0 }, uNear: { value: near }, uFar: { value: farD } })));
  m.userData.list = list;
  return m;
}
const nearGalaxies = galaxies(N.galaxies, (i) => {   // Rand der Scheibe bleibt ≥ 1,3 Einheiten neben der Flugachse
  const size = 1.2 + rand() * 2.3, r = size + 1.3 + rand() * 3.2, a = rand() * Math.PI * 2, z = -28 - (i + rand()) / N.galaxies * 297;
  return { pos: [Math.cos(a) * r, Math.sin(a) * r, z], r, a, z, size };
}, 22, 70);
const uniGalaxies = galaxies(N.uniGalaxies, () => {
  const r = 4 + rand() ** 0.7 * 110, a = rand() * Math.PI * 2, z = -330 - rand() * 420;
  return { pos: [Math.cos(a) * r, Math.sin(a) * r, z], r, a, z, size: 3 + rand() ** 1.5 * 9 };
}, 120, 240);

// Sternhaufen im Korridor: gaußsch um ein Zentrum, blau-weiß oder golden
const clusters = (() => {
  const n = N.clusters * N.perCluster, pos = new Float32Array(n * 3), cen = new Float32Array(n * 3), col = new Float32Array(n * 3), info = new Float32Array(n * 2);
  for (let c = 0; c < N.clusters; c++) {
    const r = 2 + rand() * 5, a = rand() * Math.PI * 2, z = -24 - (c + rand()) / N.clusters * 300, rad = 0.4 + rand() * 0.8;
    const center = [Math.cos(a) * r, Math.sin(a) * r, z], gold = rand() < 0.35;
    for (let j = 0; j < N.perCluster; j++) {
      const i = c * N.perCluster + j, f = Math.abs(gaussian()) ** 1.3;
      const u = unit();
      pos.set([center[0] + u[0] * rad * f, center[1] + u[1] * rad * f, center[2] + u[2] * rad * f], i * 3);
      cen.set(center, i * 3);
      col.set(gold ? (rand() < 0.7 ? [1, 0.85, 0.6] : [1, 0.95, 0.9]) : (rand() < 0.7 ? [0.7, 0.82, 1] : [1, 0.97, 0.92]), i * 3);
      info.set([rand(), rand()], i * 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCenter', new THREE.BufferAttribute(cen, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
  return place(new THREE.Points(g, additive(CLUSTER_VERT, POINT_FRAG, { uT: { value: 0 }, uCamZ: { value: 0 }, uNear: { value: 20 }, uFar: { value: 60 }, uPx: { value: 2 }, uI: { value: 0 } })));
})();
// Staub im Korridor (Linien, Schweif nach dem Tempo)
const dust = (() => {
  const n = N.dust, pos = new Float32Array(n * 6), tail = new Float32Array(n * 2), seed = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const r = 1.2 + rand() * 8, a = rand() * Math.PI * 2, z = -5 - rand() * 335, s = rand();
    for (let e = 0; e < 2; e++) { pos.set([Math.cos(a) * r, Math.sin(a) * r, z], i * 6 + e * 3); tail[i * 2 + e] = e; seed[i * 2 + e] = s; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aTail', new THREE.BufferAttribute(tail, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return place(new THREE.LineSegments(g, additive(DUST_VERT, LINE_FRAG, { uCamZ: { value: 0 }, uLen: { value: 0.1 }, uI: { value: 0 } })));
})();
// Punkte um die Kamera: Sterne, winzige ferne Galaxien (Dichte), ferne Galaxien aus dem Atlas
function points(n, make, size, twinkle) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = make(); pos.set(p.pos, i * 3); col.set(p.col, i * 3); s[i] = rand(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
  return place(new THREE.Points(g, additive(POINT_VERT, POINT_FRAG, { uT: { value: 0 }, uPx: { value: size }, uA: { value: 0 }, uTwinkle: { value: twinkle } })), far);
}
const sphere = (rMin, rMax) => { const u = unit(), r = rMin + (rMax - rMin) * Math.cbrt(rand()); return [u[0] * r, u[1] * r, u[2] * r]; };
const stars = points(N.stars, () => ({ pos: sphere(700, 900), col: rand() < 0.75 ? [0.85, 0.9, 1] : [1, 0.93, 0.8] }), 1.5, 1);
const tinyGalaxies = points(N.tinyGalaxies, () => ({ pos: sphere(300, 800), col: tint(rand() < 0.5 ? [1, 0.88, 0.7] : [0.75, 0.82, 1], 0.5 + rand() * 0.5) }), 1.3, 0);
const farGalaxies = (() => {
  const n = N.farGalaxies, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), tile = new Float32Array(n), rot = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos.set(sphere(180, 700), i * 3);
    col.set(tint(rand() < 0.5 ? [1, 0.92, 0.8] : [0.8, 0.86, 1], 0.3 + rand() * 0.4), i * 3);
    size[i] = 3 + rand() ** 2.5 * 16; tile[i] = Math.floor(rand() * 8); rot[i] = rand() * Math.PI * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aTile', new THREE.BufferAttribute(tile, 1));
  g.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
  return place(new THREE.Points(g, additive(FAR_VERT, FAR_FRAG, { atlas: { value: galaxyAtlas.texture }, uPx: { value: 1 }, uA: { value: 0 } })), far);
})();

// Nachbearbeitung
const rtScene = new THREE.WebGLRenderTarget(2, 2, rtOpts);
const rtQ = [new THREE.WebGLRenderTarget(2, 2, rtOpts), new THREE.WebGLRenderTarget(2, 2, rtOpts)];
const rtE = [new THREE.WebGLRenderTarget(2, 2, rtOpts), new THREE.WebGLRenderTarget(2, 2, rtOpts)];
const rtS = [new THREE.WebGLRenderTarget(2, 2, rtOpts), new THREE.WebGLRenderTarget(2, 2, rtOpts)];
const bright = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: BRIGHT_FRAG, uniforms: { tex: { value: null }, texel: { value: new THREE.Vector2() }, thr: { value: 0.7 } } });
const blur = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: BLUR_FRAG, uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } } });
const composite = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: COMPOSITE_FRAG,
  uniforms: { tex: { value: rtScene.texture }, b1: { value: rtQ[0].texture }, b2: { value: rtE[0].texture }, b3: { value: rtS[0].texture }, uExpo: { value: 1 }, uFlash: { value: 0 }, uHaze: { value: 0 },
    uHazeCol: { value: new THREE.Vector3(1, 0.6, 0.4) }, uT: { value: 0 }, uFade: { value: 0 }, uWarp: { value: 0 }, uCA: { value: 0 } } });

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  rtScene.setSize(W, H);
  rtQ.forEach((r) => r.setSize(Math.ceil(W / 4), Math.ceil(H / 4)));
  rtE.forEach((r) => r.setSize(Math.ceil(W / 8), Math.ceil(H / 8)));
  rtS.forEach((r) => r.setSize(Math.ceil(W / 16), Math.ceil(H / 16)));
  clusters.material.uniforms.uPx.value = 2.2 * dpr; stars.material.uniforms.uPx.value = 1.5 * dpr;
  tinyGalaxies.material.uniforms.uPx.value = 1.4 * dpr; farGalaxies.material.uniforms.uPx.value = dpr;
}
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
  bloomLevel(rtE[0], rtS, 0);
  pass(composite, null);
}

// ---------- Zeit → Bild ----------
const tmp = new THREE.Vector3();
function apply(t) {
  const e = envAt(t);
  const U = (m) => m.material.uniforms;
  U(core).uI.value = e.coreI; U(core).uCore.value = e.coreR; U(core).uSpk.value = e.coreSpk; U(core).uT.value = t;
  U(lens).uI.value = e.lensI; U(lens).uR.value = e.lensR; U(lens).uT.value = t;
  U(ball).uI.value = e.ballI; U(ball).uSize.value = e.ballR * 2; U(ball).uT.value = t;
  U(ring).uI.value = e.ringA; U(ring).uSize.value = e.ringR * 2;
  const off = Math.abs(e.cz) > 0.3;
  core.visible = e.coreI > 1e-4 && off; lens.visible = e.lensI > 1e-4 && off; ball.visible = e.ballI > 1e-4 && off; ring.visible = e.ringA > 1e-4 && off;
  U(shell).uI.value = e.shellI; U(shell).uT.value = t;
  shell.scale.setScalar(Math.max(0.01, e.shellR)); shell.visible = e.shellI > 0.001;
  U(infall).uT.value = t;
  for (const w of [wallIn, wallOut]) { U(w).uT.value = t; U(w).uWall.value = e.wall; U(w).uCamZ.value = e.cz; }
  U(corridorClouds).uT.value = t; U(corridorClouds).uI.value = 0.1 * e.wall; U(corridorClouds).uCamZ.value = e.cz;
  U(endClouds).uT.value = t; U(endClouds).uI.value = 0.6 * e.uni; U(endClouds).uCamZ.value = e.cz;
  U(nearGalaxies).uT.value = t; U(nearGalaxies).uI.value = e.galI; U(nearGalaxies).uCamZ.value = e.cz;
  U(uniGalaxies).uT.value = t; U(uniGalaxies).uI.value = 0.65 * e.uni; U(uniGalaxies).uCamZ.value = e.cz;
  U(clusters).uT.value = t; U(clusters).uI.value = e.galI; U(clusters).uCamZ.value = e.cz;
  U(dust).uCamZ.value = e.cz; U(dust).uLen.value = e.dustLen; U(dust).uI.value = e.dustI;
  U(stars).uA.value = e.starsA; U(stars).uT.value = t;
  U(tinyGalaxies).uA.value = 0.8 * e.uni; U(farGalaxies).uA.value = e.uni;
  const C = composite.uniforms;
  C.uExpo.value = e.expo; C.uFlash.value = e.flash; C.uHaze.value = e.haze; C.uHazeCol.value.fromArray(e.hazeCol);
  C.uT.value = t; C.uFade.value = e.fade; C.uWarp.value = e.warp; C.uCA.value = e.ca;
  camera.fov = e.fov; camera.updateProjectionMatrix();
  camera.position.fromArray(e.cam);
  camera.up.set(0, 1, 0);
  camera.lookAt(tmp.set(e.cam[0], e.cam[1], e.cam[2] - 1));   // Blick immer geradeaus
  camera.rotateZ(e.roll);
  camera.updateMatrixWorld();
  far.position.copy(camera.position);
}

// ---------- Ton-Ereignisse aus dem Film (deterministisch): Flimmer-Spitzen, Vorbeiflüge naher Galaxien ----------
const TICKS = (() => {
  const out = []; let lastT = -1, prev = 0, rising = false;
  for (let t = 0.3; t < T.surge; t += 1 / 120) {
    const f = flick(t);
    if (f > prev) rising = true;
    else if (rising) { rising = false; if (prev > 0.72 && t - lastT > 0.18) { out.push([t, Math.min(1, (prev - 0.72) / 0.5)]); lastT = t; } }
    prev = f;
  }
  return out;
})();
// [Filmzeit, Seite im Bild −1 … 1 (Rollen eingerechnet), Nähe 0 … 1] je Galaxie, die dicht an der Linse vorbeizieht
const PASSES = nearGalaxies.userData.list.filter((g) => g.r - g.size < 3.5).map((g) => {
  const t = tAtS(Z0 - g.z);
  return [t, Math.cos(g.a - rollAt(t)), clamp(1.4 - (g.r - g.size) / 3, 0.2, 1)];
}).sort((a, b) => a[0] - b[0]);

// ---------- Gastgeber: Uhr, Tasten, Ton, Anzeige ----------
const film = { t: 0, playing: false, started: false, muted: false, frames: 0 };
const sound = createSound({ T, V, TX, TICKS, PASSES, velAt, rollAt });
const el = { start: document.getElementById('start'), tc: document.getElementById('tc'), phase: document.getElementById('phase'), speed: document.getElementById('speed'), paused: document.getElementById('paused') };
const q = new URLSearchParams(location.search);
if (q.get('bars') === '0') document.body.classList.add('no-bars');

function phaseName(t) { return PHASES.find(([end]) => t < end)[1]; }
function hud() {
  el.tc.textContent = film.t.toFixed(1).replace('.', ',') + ' s';
  el.phase.textContent = phaseName(film.t);
  el.speed.textContent = 'Tempo ' + Math.round(velAt(film.t) / V.max * 100) + ' %';
  el.paused.textContent = film.playing ? '' : 'Pause';
}
function start(muted) {
  if (film.t >= T.end) film.t = 0;
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
renderer.compile(scene, camera);   // alle Shader jetzt übersetzen (alles noch sichtbar), sonst ruckelt der Knall, wenn Feuerball und Ring erstmals auftauchen

// ?t=12 → Bild bei 12 s, angehalten, ohne Ton (Screenshots); ?play=1 dazu → läuft ab dort
if (q.has('t')) {
  film.t = clamp(parseFloat(q.get('t')) || 0, 0, T.end);
  film.started = true; film.muted = true; film.playing = q.get('play') === '1';
  el.start.classList.add('is-hidden');
  document.body.classList.add('is-running');
}
window.__intro = film;   // Tests: Uhr und Bildzähler

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (film.playing) {
    film.t += dt;
    if (film.t >= T.end) {   // das letzte Bild bleibt stehen, die Startkarte kommt zurück
      film.t = T.end; film.playing = false; film.started = false;
      el.start.classList.remove('is-hidden');
      document.getElementById('go').textContent = 'Noch einmal · mit Ton'; document.getElementById('go-mute').textContent = 'Noch einmal · ohne Ton';
    }
  }
  apply(film.t);
  renderFrame();
  if ((film.frames++ & 7) === 0) hud();
  if (film.frames === 3) window.__introReady = true;   // Tests: drei Bilder gezeichnet
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
