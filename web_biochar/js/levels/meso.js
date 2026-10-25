// Ebene 5: Nanoporen in der Zellwand (Einheit 10 nm), Raymarching über eine Bruchfläche durch die verkohlte Zellwand.
// Befund: Ab ≈ 350 °C ist die Wand amorph, ohne Schichtung (Kwon et al. 2009); die Faserstruktur zerfällt 307–347 °C,
// danach entstehen Nanoporen und wachsen (Paris et al. 2005). Röntgen-Kleinwinkelstreuung an Holzkohle zeigt flache
// Plättchen-Poren – eine Abmessung ≈ 2–3 nm, die beiden anderen deutlich größer – und Mikroporen < 2 nm; beide nehmen mit
// der Temperatur zu (Casteel et al. 1978). Die meisten Mesoporen von Holzkohle messen 2–10 nm (Chen et al. 2018).
// Modell: dichte Matrix mit Schlitzporen (2–3,2 nm dick, 15–30 nm lang, leicht entlang der früheren Faserachse FIB
// ausgerichtet, Paris et al. 2005), wenige rundliche Mesoporen (Ø 16–48 nm), ein Schwundriss (Makropore, 50–70 nm breit),
// Mikroporen nur als feine Grübchen. Holz (pyroState.open = 0): Wand dicht, Relief der Mikrofibrillen-Bündel (≈ 20 nm).
// Luftfeuchte: Wasserfilm auf den Porenwänden (uFilm); Poren füllen nach der Kelvin-Gleichung bis Ø uWaterD (science.js,
// Füll- und Entleerungsast nach Cohan): Schlitze ganz, rundliche Poren von unten mit Meniskus, der Riss als Keil von der
// engen Spitze her.

import * as THREE from 'three';
import { SEM_GLSL, SEM_DET, semDetector } from '../sem.js';
import { pcg3d, vnoise3 } from '../util.js';
import { fillDiameterNm, fmt, labProps, pyroState } from '../science.js';
import { race as raceTable } from '../nanolab.js';
import { settings } from '../settings.js';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Raster der Schlitzporen (PG, 3D) und der rundlichen Poren (VG, 2D entlang der Bruchfläche, Anteil VOID_P), Riss: Lage
// quer zur Faser, Tiefe
const PG = 1.6, VG = 6.0, VOID_P = 0.55, CRACK_V = -4.5, CRACK_D = 11.0;
const FIB = [0.9404, 0, 0.3401], SIDE = [-0.3401, 0, 0.9404];
// Diffusions-Rennen: eine stehende Schlitzpore 24 × 12 × 6 nm (Modell; Weite 6 nm → Knudsen-Zahl ≈ 11, Rennen nur in der
// trockenen Pore), Lage aus findSpots('race'); Moleküle (CH₄, H₂O, N₂, CO₂) laufen entlang FIB und prallen in SIDE-Richtung
// von Wand zu Wand – Knudsen-Diffusion: Stöße mit der Wand, Geschwindigkeit ∝ 1/√M (nanolab.js)
const RACE_RAD = [1.2, 0.6, 0.3];

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCamPos;
uniform mat4 uCamMatrix;
uniform mat4 uInvProj;
uniform mat4 uViewProj;
uniform float uWaterD;
uniform float uDens;     // Anteil der Rasterzellen mit Schlitzpore: wächst mit der BET-Fläche (Casteel et al. 1978)
uniform float uMicro;    // Dichte der Mikroporen-Grübchen
uniform float uOpen;     // 0 Holz (Wand dicht) … 1 Kohle (Poren offen)
uniform float uTime;
uniform vec3 uDet;
uniform vec3 uTint;
uniform float uFilm;     // Wasserfilm auf den Porenwänden: 0 trocken … 1 kurz vor der Sättigung
uniform float uDrift;    // 1 = Glanzpunkte des Films wandern, 0 bei reduzierter Bewegung
uniform vec2 uMarch;     // Raymarching je Qualitätsstufe: Schritte (max. 140) und Schrittfaktor
uniform vec3 uRaceC;     // Mitte der Rennstrecke (Schlitzpore des Diffusions-Rennens)
varying vec2 vUv;
${SEM_GLSL}
const vec3 RACE_RAD = vec3(${RACE_RAD.map((v) => v.toFixed(2)).join(', ')});
const float PG = ${PG.toFixed(2)};
const float VG = ${VG.toFixed(2)};
const float VOID_P = ${VOID_P.toFixed(2)};
const float CRACK_V = ${CRACK_V.toFixed(2)};
const float CRACK_D = ${CRACK_D.toFixed(2)};
const vec3 FIB = vec3(${FIB.map((v) => v.toFixed(4)).join(', ')});
const vec3 SIDE = vec3(${SIDE.map((v) => v.toFixed(4)).join(', ')});

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 h33(vec3 c) { return vec3(pcg3d(uvec3(ivec3(c) + 4096))) * (1.0 / 4294967296.0); }
// neun Zufallswerte (je 10 Bit) aus einem Hash – in JavaScript bitgenau gleich (Hotspots, Messlinien)
void rnd9(vec3 c, int salt, out vec3 r0, out vec3 r1, out vec3 r2) {
  uvec3 v = pcg3d(uvec3(ivec3(c) + 4096 + salt));
  r0 = vec3(v & 1023u) / 1024.0;
  r1 = vec3((v >> 10u) & 1023u) / 1024.0;
  r2 = vec3((v >> 20u) & 1023u) / 1024.0;
}
float vn(vec3 p) {
  vec3 i = floor(p), f = p - i;
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h33(i).x, h33(i + vec3(1, 0, 0)).x, u.x), mix(h33(i + vec3(0, 1, 0)).x, h33(i + vec3(1, 1, 0)).x, u.x), u.y),
             mix(mix(h33(i + vec3(0, 0, 1)).x, h33(i + vec3(1, 0, 1)).x, u.x), mix(h33(i + vec3(0, 1, 1)).x, h33(i + vec3(1, 1, 1)).x, u.x), u.y), u.z);
}
float sdEll(vec3 q, vec3 r) {
  float k0 = length(q / r), k1 = length(q / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-6);
}
float topY(vec2 xz) { return -0.6 + 1.1 * vn(vec3(xz * 0.09, 3.0)) + 0.45 * vn(vec3(xz * 0.31, 7.0)); }

// Schlitzporen: je Rasterzelle höchstens eine flache Ellipsoid-Pore (halbe Länge ≤ 0,81 Zellen, Versatz ≤ 0,13: zusammen
// < 1) → der 2×2×2-Block um den Punkt genügt. fill = Abstand zur nächsten gefüllten Pore: ein Schlitz der Weite w hat wie
// ein füllender Zylinder mit Ø w einen einfach gekrümmten Meniskus (Radius w/2) → füllt bei uWaterD = w. Ideale Schlitze
// leeren über denselben Meniskus, haben also keine Hysterese (Cohan 1938); dass sie hier mit uWaterD nachlaufen: Modell
float plates(vec3 p, out float fill) {
  vec3 q = p / PG;
  vec3 b = floor(q) + step(0.5, fract(q)) - 1.0;
  float d = 9.0;
  fill = 9.0;
  for (int k = 0; k < 8; k++) {
    vec3 c = b + vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1));
    vec3 r0, r1, r2;
    rnd9(c, 101, r0, r1, r2);
    if (r1.x >= uDens) continue;
    vec3 e = p - ((c + 0.5) * PG + (r0 - 0.5) * 0.4);
    float a = 0.65 + 0.65 * r1.y;
    vec3 rad = vec3(a, a * (0.45 + 0.3 * r1.z), 0.10 + 0.06 * r2.x);
    vec3 L = normalize(FIB + SIDE * (r2.z - 0.5) * 0.8 + vec3(0.0, (fract(r2.y * 7.0) - 0.5) * 0.35, 0.0));
    vec3 N0 = normalize(vec3(-L.z, 0.0, L.x));
    vec3 Nt = cos(r2.y * 3.14159265) * N0 + sin(r2.y * 3.14159265) * cross(N0, L);
    float de = sdEll(vec3(dot(e, L), dot(e, cross(Nt, L)), dot(e, Nt)), rad);
    d = min(d, de);
    if (rad.z * 20.0 < uWaterD) fill = min(fill, de);   // Schlitz der Weite 2·rad.z (10 nm) füllt wie ein Zylinder mit Ø Weite
  }
  return d;
}
// Rennstrecke: stehender Schlitz (dünne Achse = SIDE), von der Bruchfläche angeschnitten; außerhalb der Hülle nur die
// Kugelschranke (untere Grenze des Abstands, Raymarching bleibt sicher)
float raceSlit(vec3 p) {
  vec3 e = p - uRaceC;
  if (dot(e, e) > 2.0) return length(e) - 1.2;
  return sdEll(vec3(dot(e, FIB), e.y, dot(e, SIDE)), RACE_RAD);
}
// Rundliche Mesoporen (Modell, Ø 12–40 nm): abgeflachte Kugeln, von der Bruchfläche angeschnitten (Mitte 15–60 % des
// Halbmessers unter der groben Welle von topY), Rand unregelmäßig (irr); Wasser steht von unten bis zur Füllhöhe
float voids(vec3 p, float irr, out float wat) {
  vec2 q = p.xz / VG;
  vec2 b = floor(q) + step(0.5, fract(q)) - 1.0;
  float d = 9.0;
  wat = 9.0;
  for (int k = 0; k < 4; k++) {
    vec2 c = b + vec2(float(k & 1), float((k >> 1) & 1));
    vec3 r0, r1, r2;
    rnd9(vec3(c.x, 0.0, c.y), 7777, r0, r1, r2);
    if (r1.x >= VOID_P) continue;
    float R = 0.6 + 1.4 * r1.y * r1.y;
    vec2 cxz = (c + 0.5) * VG + (r0.xz - 0.5) * 2.0;
    vec3 ctr = vec3(cxz.x, -0.375 + 1.1 * vn(vec3(cxz * 0.09, 3.0)) - 0.8 * R * (0.15 + 0.45 * r0.y), cxz.y);
    float dv = sdEll(p - ctr, R * vec3(1.0, 0.8, 1.0)) + irr * 0.3 * R;
    d = min(d, dv);
    float size = R * 20.0;
    float f = clamp((uWaterD - size) / (0.2 * size) + 1.0, 0.0, 1.0);
    if (f > 0.01) wat = min(wat, max(dv, p.y - (ctr.y - 0.8 * R + 1.6 * R * f + 0.3 * exp(-max(-dv, 0.0) / 0.35))));
  }
  return d;
}
// Schwundriss entlang der Faser: V-förmig, an der Bruchfläche 52–66 nm breit, CRACK_D tief; Wasser füllt den Keil von
// der Spitze her bis zur Breite uWaterD (Meniskus im Keil einfach gekrümmt wie im Schlitz)
float crack(vec3 p, float ty, out float wat) {
  float u = dot(p.xz, FIB.xz), v = dot(p.xz, SIDE.xz);
  float v0 = CRACK_V + 1.3 * sin(u * 0.13 + 0.7) + 1.2 * (vn(vec3(u * 0.22, 0.0, 5.0)) - 0.5);
  float hw0 = 2.6 + 0.7 * vn(vec3(u * 0.17, 2.0, 9.0));
  float hw = hw0 * clamp(1.0 - (ty - p.y) / CRACK_D, 0.0, 1.0);
  float dc = (abs(v - v0) - hw) * 0.7 + 0.25 * (vn(p * 1.7 + 21.0) - 0.5);
  wat = 9.0;
  if (uWaterD > 0.0) {
    float depW = CRACK_D * (1.0 - uWaterD / (20.0 * hw0));
    if (depW < CRACK_D) wat = max(dc, p.y - (ty - depW + 0.3 * exp(-max(-dc, 0.0) / 0.35)));
  }
  return dc;
}

// Zuletzt ausgewertete Stelle: gKind 0 Bruchfläche, 1 Porenwand; gWallD = Abstand zur Porenwand (Meniskus)
float gKind = 0.0, gWallD = 9.0;
// x = Abstand, y = Material (0 Kohlenstoff, 1 Wasser)
vec2 map(vec3 p) {
  float ty = topY(p.xz);
  // Holz: Relief der Mikrofibrillen-Bündel entlang der Faser; Welligkeit (≈ 7 nm) und Körnung der Bruchfläche (Modell)
  float top = p.y - ty - (1.0 - uOpen) * 0.14 * (0.5 + 0.5 * sin(dot(p.xz, SIDE.xz) * 1.8 + 1.5 * vn(p * 0.5)))
            - 0.08 * (vn(p * 1.5 + 40.0) - 0.5) - 0.03 * (vn(p * 8.0) - 0.5);
  // Holz → Kohle: jede Porenart ist um ihre halbe Größe „aufgeblasen“, bis sie geschlossen ist (Abstandsfeld bleibt gültig)
  float iP = (1.0 - uOpen) * 0.22, iV = (1.0 - uOpen) * 3.8, iC = (1.0 - uOpen) * 3.0;
  float wP, wV, wC;
  float dRr = raceSlit(p);
  float dP = min(plates(p, wP), dRr) + iP;
  if (RACE_RAD.z * 20.0 < uWaterD) wP = min(wP, dRr);   // 6-nm-Schlitz füllt wie die anderen Schlitze
  float dV = voids(p, vn(p * 0.9 + 50.0) - 0.5, wV) + iV;
  float dC = crack(p, ty, wC) + iC;
  float dPore = min(dP, min(dV, dC));
  float solid = max(top, -dPore);
  gKind = step(top, -dPore);
  gWallD = -dPore;
  float water = 1e3;
  // Wasser bleibt in seiner Pore: ein gefüllter Schlitz endet am Meniskus, wo er Riss oder rundliche Pore anschneidet
  if (uWaterD > 0.0 && uOpen > 0.05)
    water = max(min(max(wP + iP, -min(dV, dC)), min(max(wV + iV, -dC), wC + iC)), top + 0.05);
  return water < solid ? vec2(water, 1.0) : vec2(solid, 0.0);
}
vec3 calcNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.012;
  return normalize(k.xyy * map(p + k.xyy * e).x + k.yyx * map(p + k.yyx * e).x +
                   k.yxy * map(p + k.yxy * e).x + k.xxx * map(p + k.xxx * e).x);
}
void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 vp = uInvProj * vec4(ndc, 1.0, 1.0);
  vp /= vp.w;
  vec3 rd = normalize((uCamMatrix * vec4(vp.xyz, 0.0)).xyz);
  vec3 ro = uCamPos;
  float t = 0.0;
  const float Y_MAX = 1.2;
  if (ro.y > Y_MAX) {
    if (rd.y > -1e-4) { gl_FragDepth = 1.0; gl_FragColor = vec4(0.0); return; }
    t = (ro.y - Y_MAX) / -rd.y;
  }
  float tMax = t + 90.0;
  vec2 h = vec2(1.0, 0.0);
  bool hit = false;
  for (int i = 0; i < 140; i++) {
    if (float(i) >= uMarch.x) break;
    h = map(ro + rd * t);
    if (h.x < 0.0015 * t + 0.004) { hit = true; break; }
    t += max(h.x * uMarch.y, 0.01);
    if (t > tMax) break;
  }
  if (!hit) { gl_FragDepth = 1.0; gl_FragColor = vec4(0.0); return; }
  float kind = gKind, wallD = gWallD;   // vor Normale und AO sichern: die werten map() an Nachbarpunkten aus
  vec3 p = ro + rd * t;
  vec4 clip = uViewProj * vec4(p, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);   // echte Tiefe für die Tiefenunschärfe
  vec3 n = calcNormal(p);
  float ao = 0.0, sca = 1.0;
  for (int i = 1; i <= 4; i++) {
    float hh = 0.12 * float(i);
    ao += (hh - map(p + n * hh).x) * sca;
    sca *= 0.7;
  }
  ao = clamp(1.0 - 2.0 * ao, 0.0, 1.0);
  float depth = max(topY(p.xz) - p.y, 0.0);
  float vis = mix(0.04, 1.0, exp(-depth / 2.2)) * mix(0.35, 1.0, ao) * exp(-max(t - 32.0, 0.0) * 0.035);
  vec3 V = -rd;
  if (h.y > 0.5) {
    float fres = pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 3.0);
    // Wasserfilm lebt: die Oberfläche (Meniskus) schwingt leicht, einzelne Glitzerpunkte blitzen auf (Kapillarwellen, Modell)
    vec3 wob = vec3(vn(p * 4.0 + uTime * 0.7), vn(p * 4.0 + 7.0 - uTime * 0.6), vn(p * 4.0 + 13.0 + uTime * 0.5)) - 0.5;
    n = normalize(n + 0.16 * wob);
    float glint = pow(max(dot(reflect(-V, n), uDet), 0.0), 90.0);
    vec3 col = vec3(0.28, 0.66, 0.92) * (0.42 + 0.6 * fres) + vec3(0.9) * (pow(max(dot(reflect(-V, n), uDet), 0.0), 40.0) * 0.5 + glint * 1.3);
    col *= 1.0 - 0.5 * clamp(depth / 3.2, 0.0, 1.0);                       // tief stehendes Wasser wirkt dunkler
    col += vec3(0.65, 0.88, 1.0) * exp(-max(wallD, 0.0) / 0.12) * 0.75;      // Meniskus: heller Saum an der Wand
    gl_FragColor = vec4(pow(col * max(vis, 0.3), vec3(2.2)), 1.0);
    return;
  }
  // feine Körnung in der Normale; Mikroporen < 2 nm nur als dunkle Grübchen, mehr bei höherer Temperatur
  n = normalize(n + 0.2 * (vec3(vn(p * 26.0), vn(p * 26.0 + 5.0), vn(p * 26.0 + 9.0)) - 0.5));
  float g = semShade(n, V, uDet, 0.38);
  g *= 0.86 + 0.28 * vnoise(p * 3.0) * (0.6 + 0.4 * vnoise(p * 11.0));
  float pit = mix(0.9, 0.74, uMicro);
  g *= 1.0 - 0.55 * smoothstep(pit, pit + 0.05, vn(p * 15.0 + 3.0));
  vec3 tint = uTint;
  if (uFilm > 0.0 && kind > 0.5) {
    // Wasserfilm: Wand dunkler, bläulicher, glänzender; Glanzpunkte driften langsam (Modell, Dicke wächst mit der Feuchte)
    float wet = uFilm * (0.75 + 0.25 * vn(p * 5.0 + vec3(uTime * 0.25, 0.0, -uTime * 0.2) * uDrift));
    g *= 1.0 - 0.3 * wet;
    g += wet * 1.5 * pow(max(dot(reflect(-V, n), uDet), 0.0), 30.0);
    tint = mix(tint, vec3(0.74, 0.88, 1.06), 0.6 * wet);
  }
  gl_FragColor = semOut(g * vis, tint);
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Dieselben Felder in JavaScript, um Hotspots und Messlinien exakt auf Poren und Wände zu setzen
const rnd9 = (cx, cy, cz, salt) => {
  const v = pcg3d(cx + 4096 + salt, cy + 4096 + salt, cz + 4096 + salt);
  return [0, 10, 20].map((s) => v.map((x) => ((x >>> s) & 1023) / 1024));
};
const sdEll = (q, r) => {
  const k0 = Math.hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2]), k1 = Math.hypot(q[0] / (r[0] * r[0]), q[1] / (r[1] * r[1]), q[2] / (r[2] * r[2]));
  return (k0 * (k0 - 1)) / Math.max(k1, 1e-6);
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const fract = (x) => x - Math.floor(x);
function block(p, s) {
  const b = p.map((v) => Math.floor(v / s) + (fract(v / s) >= 0.5 ? 0 : -1));
  return [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [b[0] + (k & 1), b[1] + ((k >> 1) & 1), b[2] + ((k >> 2) & 1)]);
}
function plateD(p, dens) {
  let d = 9;
  for (const c of block(p, PG)) {
    const [r0, r1, r2] = rnd9(...c, 101);
    if (r1[0] >= dens) continue;
    const e = p.map((v, i) => v - ((c[i] + 0.5) * PG + (r0[i] - 0.5) * 0.4));
    const a = 0.65 + 0.65 * r1[1];
    const L = norm([FIB[0] + SIDE[0] * (r2[2] - 0.5) * 0.8, (fract(r2[1] * 7) - 0.5) * 0.35, FIB[2] + SIDE[2] * (r2[2] - 0.5) * 0.8]);
    const N0 = norm([-L[2], 0, L[0]]), M0 = cross(N0, L), th = r2[1] * Math.PI;
    const Nt = N0.map((v, i) => Math.cos(th) * v + Math.sin(th) * M0[i]);
    d = Math.min(d, sdEll([dot(e, L), dot(e, cross(Nt, L)), dot(e, Nt)], [a, a * (0.45 + 0.3 * r1[2]), 0.1 + 0.06 * r2[0]]));
  }
  return d;
}
function voidList(p) {
  const out = [];
  const [bx, , bz] = block(p, VG)[0];
  for (const c of [[bx, 0, bz], [bx + 1, 0, bz], [bx, 0, bz + 1], [bx + 1, 0, bz + 1]]) {
    const [r0, r1] = rnd9(c[0], 0, c[2], 7777);
    if (r1[0] >= VOID_P) continue;
    const R = 0.6 + 1.4 * r1[1] * r1[1], x = (c[0] + 0.5) * VG + (r0[0] - 0.5) * 2, z = (c[2] + 0.5) * VG + (r0[2] - 0.5) * 2;
    out.push({ key: c.join(','), R, ctr: [x, -0.375 + 1.1 * vnoise3(x * 0.09, z * 0.09, 3) - 0.8 * R * (0.15 + 0.45 * r0[1]), z] });
  }
  return out;
}
// Abstand zur nächsten rundlichen Pore und deren Radius
const voidAt = (p) => voidList(p).reduce((b, v) => {
  const d = sdEll(p.map((x, i) => x - v.ctr[i]), [v.R, 0.8 * v.R, v.R]);
  return d < b.d ? { d, R: v.R } : b;
}, { d: 9, R: 0 });
function crackD(p, ty) {
  const u = p[0] * FIB[0] + p[2] * FIB[2], v = p[0] * SIDE[0] + p[2] * SIDE[2];
  const v0 = CRACK_V + 1.3 * Math.sin(u * 0.13 + 0.7) + 1.2 * (vnoise3(u * 0.22, 0, 5) - 0.5);
  const hw0 = 2.6 + 0.7 * vnoise3(u * 0.17, 2, 9);
  return (Math.abs(v - v0) - hw0 * Math.min(1, Math.max(0, 1 - (ty - p[1]) / CRACK_D))) * 0.7;
}
const topY = (x, z) => -0.6 + 1.1 * vnoise3(x * 0.09, z * 0.09, 3) + 0.45 * vnoise3(x * 0.31, z * 0.31, 7);

// Hotspots: Wand ohne Poren (Abstieg zu den Mikroporen), Riss, Schlitzpore, rundliche Pore (Wasser steht dort sichtbar),
// Rennstrecke (freie Wand vorn links, Riss und rundliche Poren fern). Schlitze mit Rasterwert < 0,3 gibt es ab 400 °C bei
// jeder Temperatur.
function findSpots() {
  const want = { wallpore: [-3, 1.5], macro: [5, -3], meso: [-7, -1], water: [2.1, 2.5], race: [-5, 5.5] };
  const best = {};
  for (let x = -14; x <= 14; x += 0.3) {
    for (let z = -12; z <= 12; z += 0.3) {
      const ty = topY(x, z), p = [x, ty - 0.12, z];
      const dP = plateD(p, 0.3), vd = voidAt(p), dV = vd.d, dC = crackD(p, ty);
      const classes = [];
      if (plateD(p, 1) > 0.5 && dV > 1 && dC > 1.5) classes.push(['wallpore', ty + 0.05]);
      if (crackD([x, ty - 2.5, z], ty) < -0.9) classes.push(['macro', ty - 2.5]);
      if (dP < -0.06 && dV > 0.6 && dC > 1) classes.push(['meso', ty - 0.12]);
      if (dV < -0.5 && vd.R > 0.8 && dC > 1) classes.push(['water', ty - 0.6]);
      if (plateD(p, 1) > 0.3 && dV > 1.6 && dC > 3) classes.push(['race', ty]);
      for (const [c, y] of classes) {
        const d = Math.hypot(x - want[c][0], z - want[c][1]);
        if (!best[c] || d < best[c].d) best[c] = { d, pos: new THREE.Vector3(x, y, z) };
      }
    }
  }
  return best;
}

// Messlinien: rundliche Poren, die die Bruchfläche fast mittig schneiden (Öffnung ≈ Ø der Pore), im Startbild (16:10),
// mit Abstand zu Hotspots, Riss und untereinander; Ø der Öffnung wie im Shader (Modell)
function findMeasures(home, avoid) {
  const cam = new THREE.PerspectiveCamera(45, 1.6, 0.1, 500);
  cam.position.copy(home.pos);
  cam.lookAt(home.target);
  cam.updateMatrixWorld();
  const seen = new Map();
  for (let x = home.target.x - 18; x <= home.target.x + 18; x += VG / 2) {
    for (let z = home.target.z - 18; z <= home.target.z + 18; z += VG / 2) {
      for (const v of voidList([x, topY(x, z), z])) seen.set(v.key, v);
    }
  }
  const cand = [];
  for (const v of seen.values()) {
    const ty = topY(v.ctr[0], v.ctr[2]), s = (ty - v.ctr[1]) / (0.8 * v.R);
    if (Math.abs(s) > 0.7) continue;
    const pos = new THREE.Vector3(v.ctr[0], ty - 0.1, v.ctr[2]);
    const sp = pos.clone().project(cam);
    if (sp.x < -0.75 || sp.x > 0.6 || sp.y < -0.6 || sp.y > 0.7 || crackD([pos.x, ty, pos.z], ty) < 2.5) continue;
    if (!avoid.every((a) => a.distanceTo(pos) > 3)) continue;
    cand.push({ pos, sp, nm: Math.round(20 * v.R * Math.sqrt(1 - s * s)) });
  }
  cand.sort((a, b) => a.pos.distanceTo(home.target) - b.pos.distanceTo(home.target));
  const out = [];
  // Beschriftungen dürfen sich im Startbild nicht berühren: Abstand im Raum und auf dem Schirm
  const apart = (o, c) => o.pos.distanceTo(c.pos) > 5 && (Math.abs(o.sp.x - c.sp.x) > 0.5 || Math.abs(o.sp.y - c.sp.y) > 0.15);
  for (const c of cand) if (out.length < 3 && c.nm >= 14 && out.every((o) => apart(o, c))) out.push(c);
  return out.map((c) => ({ pos: c.pos, nm: c.nm, name: 'Mesopore' }));
}

// Rennteilnehmer als Kalottenmodell (van-der-Waals-Radien, Bondi 1964; Koordinaten in nm wie in Ebene 6), CH₄ tetraedrisch
const ELEMENT = { C: { r: 0.17, color: [0.32, 0.33, 0.36] }, O: { r: 0.152, color: [0.9, 0.24, 0.22] }, N: { r: 0.155, color: [0.3, 0.5, 0.95] }, H: { r: 0.12, color: [0.95, 0.95, 0.97] } };
const TET = 0.109 / Math.sqrt(3);
const MOLECULES = {
  ch4: [['C', 0, 0, 0], ['H', TET, TET, TET], ['H', -TET, -TET, TET], ['H', -TET, TET, -TET], ['H', TET, -TET, -TET]],
  h2o: [['O', 0, 0, 0], ['H', 0.0757, 0.0586, 0], ['H', -0.0757, 0.0586, 0]],
  n2: [['N', 0.055, 0, 0], ['N', -0.055, 0, 0]],
  co2: [['C', 0, 0, 0], ['O', 0.116, 0, 0], ['O', -0.116, 0, 0]],
};
// Rennen: Strecke ±U entlang FIB, CH₄ (schnellstes) mit V0 Einheiten/s (stark verlangsamt, real ≈ 630 m/s), die anderen
// ∝ 1/√M; nach dem Einlauf des CO₂ kurze Pause, dann Neustart mit Ein-/Ausblenden
const RACE = { U: 0.95, V0: 0.42, pause: 1.2, fade: 0.35 };
const tri = (x) => 2 * Math.abs(x - Math.floor(x + 0.5));   // Dreieckwelle 0 → 1 → 0, Periode 1

// Schlitz- und Mikroporen nehmen mit der Temperatur zu (Casteel et al. 1978); Stärke folgt der BET-Fläche
// (5 → 390 m²/g, science.js) – Richtung belegt, Maß Modell
const bet = (T) => Math.min(1, labProps(T).bet / 390);
const plateDens = (T) => 0.3 + 0.6 * bet(T);
// Wasserfilm auf den Wänden (Modell, Darstellung): wächst mit der Feuchte, ab ≈ 95 % voll
const film = (rh) => Math.pow(Math.min(1, rh / 0.95), 1.2);

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, ctx.aspect, 0.1, 500);
  const uniforms = {
    uCamPos: { value: new THREE.Vector3() },
    uCamMatrix: { value: new THREE.Matrix4() },
    uInvProj: { value: new THREE.Matrix4() },
    uViewProj: { value: new THREE.Matrix4() },
    uWaterD: { value: ctx.wet },
    uDens: { value: plateDens(ctx.temp) },
    uMicro: { value: bet(ctx.temp) },
    uOpen: { value: pyroState(ctx.temp).open },
    uTime: { value: 0 },
    uDet: SEM_DET,
    uTint: { value: new THREE.Color(0.93, 0.95, 0.98) },
    uFilm: { value: film(ctx.rh) },
    uDrift: { value: still ? 0 : 1 },
    uMarch: { value: new THREE.Vector2(140, 0.75) },
    uRaceC: { value: new THREE.Vector3(0, -99, 0) },
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth,
  }));
  quad.frustumCulled = false;
  quad.renderOrder = -1;   // zuerst zeichnen (AlwaysDepth): die Moleküle des Rennens prüfen danach gegen die echte Tiefe
  // Strahlen aus der Kamera, mit der gerade gerendert wird: Hauptbild oder Lupe der Info-Karte
  quad.onBeforeRender = (r, s, cam) => {
    uniforms.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
    uniforms.uCamMatrix.value.copy(cam.matrixWorld);
    uniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
    uniforms.uViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  };
  scene.add(quad);

  const spots = findSpots();
  const at = (k, fallback) => (spots[k] ? spots[k].pos : new THREE.Vector3(...fallback));
  const up = new THREE.Vector3(0, 1, 0);
  const ty0 = topY(0, 0);
  // Startbild mit Überblick über die Bruchfläche (Bildbreite ≈ 270 nm), Riss im Hintergrund, Tiefenschärfe trägt das
  // Bild; im Leerlauf gleitet die Kamera an der Wand
  const wall = at('wallpore', [-3, ty0, 1.5]);
  const home = { pos: wall.clone().add(new THREE.Vector3(4.8, 9.6, 17.6)), target: wall.clone() };
  // ---- Diffusions-Rennen in der 6-nm-Schlitzpore (Knudsen, nanolab.js) ----
  const RT = raceTable(RACE_RAD[2] * 20);   // CH₄ · H₂O · N₂ · CO₂, rel = Geschwindigkeit relativ zu CH₄
  const F = new THREE.Vector3(...FIB), SD = new THREE.Vector3(...SIDE);
  const raceC = at('race', [-5, ty0, 5.5]).clone();
  raceC.y -= 0.1;   // Mitte 1 nm unter der Bruchfläche: die Fläche schneidet den Schlitz als ≈ 24 × 6 nm großen Spalt an
  uniforms.uRaceC.value.copy(raceC);
  const surfAt = (u, lift = 0.02) => { const x = raceC.x + F.x * u, z = raceC.z + F.z * u; return new THREE.Vector3(x, topY(x, z) + lift, z); };
  const nAtoms = RT.reduce((n, g) => n + MOLECULES[g.id].length, 0);
  const molMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0 }), nAtoms);
  { let i = 0; for (const g of RT) for (const [el] of MOLECULES[g.id]) molMesh.setColorAt(i++, new THREE.Color(...ELEMENT[el].color)); }
  molMesh.frustumCulled = false;
  molMesh.renderOrder = 1;
  molMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const molLight = new THREE.DirectionalLight(0xffffff, 2.2);
  scene.add(molMesh, molLight, new THREE.HemisphereLight(0xdde8ff, 0x3a3027, 0.8));
  const raceLen = 2 * RACE.U, lap = raceLen / (RACE.V0 * RT[RT.length - 1].rel) + RACE.pause;
  const mols = RT.map((g, k) => ({ g, k, pos: new THREE.Vector3(), q: new THREE.Quaternion(), ax: new THREE.Vector3(0.3 + 0.2 * k, 0.9, 0.1 - 0.15 * k).normalize(), f: 0, w: 0.1 }));
  let raceT = 0;
  // Lage je Molekül: entlang der Strecke nach der eigenen Geschwindigkeit, quer als Zickzack von Wand zu Wand (Knudsen:
  // Stöße mit der Wand), knapp unter der Bruchfläche gestaffelt; der Weg liegt zur hinteren Wand hin (von der Startkamera
  // schräg oben verdeckt die vordere Kante sonst die Moleküle); Pore voll Wasser oder Holz → ausgeblendet; „Aus“/reduced-motion → ruhend
  function placeRace(dt) {
    const calm = still || settings.S.motion === 'off';
    const on = uniforms.uOpen.value > 0.85 && uniforms.uWaterD.value < RACE_RAD[2] * 20;
    if (!calm && dt > 0) { raceT += dt; if (raceT > lap) raceT -= lap; }
    const fade = Math.min(1, raceT / RACE.fade, Math.max(0, (lap - raceT) / RACE.fade));
    for (const m of mols) {
      m.w = RACE_RAD[2] * 0.82 - m.g.d / 20 - 0.012;   // freier Querweg: halbe Weite minus Molekül
      let u, s;
      if (calm) { u = -RACE.U + 0.55 * m.k; s = -0.5 * m.w; m.f = on ? 1 : 0; }
      else {
        const dist = Math.min(RACE.V0 * m.g.rel * raceT, raceLen);
        u = -RACE.U + dist;
        s = (tri((dist * 0.85) / (4 * m.w) + 0.25 * m.k) * 1.4 - 1) * m.w;   // −w … +0,4 w
        m.f = on ? fade : 0;
        m.q.setFromAxisAngle(m.ax, dist * 4 + m.k);
      }
      const x = raceC.x + F.x * u + SD.x * s, z = raceC.z + F.z * u + SD.z * s;
      m.pos.set(x, topY(x, z) - 0.04 - 0.012 * m.k, z);
    }
    writeMols();
  }
  // Moleküle maßstäblich (van-der-Waals-Radien in nm → Einheit 10 nm; Wahl User 2026-10-25): aus der Übersicht winzig,
  // beim Heranzoomen und in der Lupe sichtbar
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), Q0 = new THREE.Quaternion();
  function writeMols() {
    let i = 0;
    for (const m of mols) {
      for (const [el, x, y, z] of MOLECULES[m.g.id]) {
        _p.set(x, y, z).multiplyScalar(0.1).applyQuaternion(m.q).add(m.pos);
        _s.setScalar(ELEMENT[el].r * 0.1 * m.f);
        molMesh.setMatrixAt(i++, _m.compose(_p, Q0, _s));
      }
    }
    molMesh.instanceMatrix.needsUpdate = true;
  }
  placeRace(0);

  const hotspots = [
    { id: 'wallpore', kind: 'dive', pos: wall, normal: up },
    { id: 'macro', kind: 'info', pos: at('macro', [5, ty0 - 2.5, -3]), normal: up },
    { id: 'meso', kind: 'info', pos: at('meso', [-7, ty0, -1]), normal: up },
    { id: 'race', kind: 'info', pos: surfAt(-1.0), normal: up, side: 'left' },   // Abzeichen links vom Spaltanfang: der Spalt bleibt frei
    { id: 'water', kind: 'info', pos: at('water', [2.1, ty0, 2.5]), normal: up },
  ];
  // Riss, Schlitzpore und Kapillarwasser gibt es erst in der Kohle: im Holz ist die Wand dicht, Abzeichen bleiben aus
  const showPores = () => { for (const h of hotspots) if (h.kind === 'info') h.hidden = uniforms.uOpen.value < 0.5; };
  showPores();
  let rh = ctx.rh, wet = ctx.wet;
  const level = {
    scene, camera,
    unit: 1e-8,
    method: 'Modell nach Kleinwinkelstreuung und Gasadsorption',
    tone: 0,
    grain: 0.045,
    resScale: 0.8,
    dof: 2.5,
    bloom: 0.04,
    home,
    orbit: { minDistance: 5, maxDistance: 70, minPolarAngle: 0.12, maxPolarAngle: 1.3, enablePan: true, screenSpacePanning: false },
    cine: { orbit: 0.12, crane: 0.03, dolly: 0.04, drift: 0.28, lift: 0.15 },   // Leerlauf: seitlich an der Wand entlang
    hotspots,
    measures: findMeasures(home, hotspots.map((h) => h.pos)),
    measuresOn: pyroState(ctx.temp).open > 0.85,   // im Holz sind die Poren zu
    raceLine: [surfAt(-0.9, 0.01), surfAt(0.9, 0.01)],   // Messhilfe entlang des Spalts (hud.js)
    raceGases: RT,
    facts: () => [{
      value: `≈ ${fmt(wet, 0)} nm`,
      label: `bei ${fmt(rh * 100)} % Luftfeuchte mit Wasser gefüllte Poren (Kelvin-Gleichung${wet > fillDiameterNm(rh) + 0.5 ? ', beim Trocknen Hysterese' : ''})`,
    }],
    update(dt, t) {
      uniforms.uTime.value = t;
      // Wasserstand und Film gleiten zum Reglerwert (bei reduzierter Bewegung sofort)
      const k = still ? 1 : 1 - Math.exp(-dt * 4);
      uniforms.uWaterD.value += (wet - uniforms.uWaterD.value) * k;
      uniforms.uFilm.value += (film(rh) - uniforms.uFilm.value) * k;
      semDetector(t);
      molLight.position.copy(SEM_DET.value).multiplyScalar(10).add(raceC);   // Moleküle im Licht des „Detektors“
      placeRace(dt);
      return true;
    },
    setParam(name, value) {
      if (name === 'temp') {
        uniforms.uDens.value = plateDens(value);
        uniforms.uMicro.value = bet(value);
        uniforms.uOpen.value = pyroState(value).open;
        level.measuresOn = uniforms.uOpen.value > 0.85;
        showPores();
        level.dirty = true;
        return;
      }
      // Qualitätsstufe: weniger, dafür längere Schritte (Leicht ≈ 63, Mittel ≈ 98, Fein 140)
      if (name === 'quality') { uniforms.uMarch.value.set(Math.round(140 * value.detail), 1 - 0.25 * value.detail); level.dirty = true; return; }
      if (name === 'rh') rh = value;
      else if (name === 'wet') wet = value;
    },
    dispose() {
      quad.geometry.dispose();
      quad.material.dispose();
      molMesh.geometry.dispose();
      molMesh.material.dispose();
    },
  };
  return level;
}
