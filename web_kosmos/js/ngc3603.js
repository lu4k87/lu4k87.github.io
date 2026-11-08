// NGC 3603 – Kamerafahrt durch ein junges Sternentstehungsgebiet (Vorlage, User 08.11.2026). Vorbild: Hubble-Aufnahme
// heic0715a (NASA, ESA und Hubble Heritage (STScI/AURA)-ESA/Hubble Collaboration). Bausteine (buildNebula, filmPose) nutzt
// die Station levels/ngc3603.js der App; createFilm spielt die Fahrt auf der Test-/Vorlagenseite web/ngc3603.html.
//
// Modell (Einheit 1 Lj, Haufen HD 97950 im Ursprung, Blick von der Erde = −z, Norden = +y):
//   Blase am Rand einer Molekülwolke: Strahlung und Winde des Haufens haben einen Hohlraum geblasen, der zum Betrachter
//   offen ist (im Hubble-Bild links frei, rechts Gas). Je Richtung vom Haufen aus gibt es genau eine Ionisationsfront –
//   die erste Wand, die das UV-Licht trifft; dahinter liegt alles im Schatten. So leuchten die Köpfe der Säulen, wo sie
//   zum Haufen zeigen, und werfen Schatten auf die Wand dahinter.
//   Wand länglich (Gasband oben → unten rechts wie im Bild), zur Wolke hin näher am Haufen, gefaltet und mit Rissen –
//   von weitem kein geschlossenes Oval; dünne Staubfäden kurz vor der Front als schwarze Bahnen.
//   Säulen (Elefantenrüssel): Zylinder mit Köpfen auf der Achse zum Haufen, nach außen breiter; Kante scharf, Rillen längs
//   der Achse, Kopf in Knollen zerfallen, davor ein strähniger Schleier (Photoverdampfung). Bok-Globulen: dichte, zerklüftete
//   Staubknoten in Kometenform (stumpf zur Haufenseite, Schweif nach außen) mit leuchtendem Rand. Sher 25: blauer Überriese mit Ring
//   (0,4 pc, ≈ 64° geneigt) und Sanduhr-Ausströmungen bis ≈ 0,5 pc (Brandner et al. 1997, ApJ 475, L45).
//   Haufen: ≈ 1 Mio. Jahre, Entfernung 6,6–6,9 kpc (Rochau et al. 2010), 1,0–1,6 · 10⁴ Sonnenmassen (Harayama et al. 2008);
//   Lage der Sterne statistisch (Plummer-Profil), Säulen/Globulen/Wand frei nach dem Bild – Modell, keine Karte.
//   Sterne als Punktquellen: Fluss = L/d², Bild wie bei Hubble mit vier Beugungsstrahlen (Streben des Fangspiegels; Rot
//   streut weiter, Beugung ∝ λ). Licht hinter Staub wird gedämpft und gerötet (Extinktion je Stern im Vertex-Shader
//   durch dasselbe Medium integriert, Globulen exakt als Sehne).
// Kamera: eine Fahrt ohne Schnitt; Ort und Blickziel als zentripetale Catmull-Rom-Kurven über dieselben Schlüssel,
//   Fortschritt k(t) monoton kubisch (Fritsch–Carlson) → Tempo stetig, kein Ruck; Blende je Abschnitt (beim Durchflug
//   durch den Haufen weiter zu). apply(t) ist reine Funktion der Zeit → ?t=24 zeigt das Bild bei 24 s angehalten.
// Bild: Wolke per Strahlverfolgung in eigener Auflösung (vol.js offscreen), Schrittweite wächst mit dem Abstand zur
//   Kamera (nah fein, fern grob); Rauschfelder einmal gebacken (bakeField: FIELD grob, FIELD2 mittlere Größen für Risse,
//   Staubfäden, Faltung); Bloom, ACES, Grading wie die App (post.js).

import * as THREE from 'three';
import { NOISE, SKY_VERTEX } from './glsl.js';
import { bakeField, offscreen, pointCloud } from './vol.js';
import { createPost } from './post.js';
import { mulberry32, gauss, blackbody } from './astro.js';

const EXT = 48;   // Feldtextur: Würfel ±48 Lj
const RV = 46;    // Kugel, in der das Gas liegt
const RC = 11;    // mittlerer Radius des Hohlraums
const WALL = new THREE.Vector3(0.92, -0.2, -0.35).normalize();   // Richtung der Molekülwolke vom Haufen aus (im Bild rechts)
const BAND = new THREE.Vector3(0.4, -0.92, -0.1).normalize();    // Längsrichtung der Wand (Gasband oben → unten rechts)
// Säulen: Achse vom Haufen weg, Abstand des Kopfes, Breite (Radius); alle auf der Seite der Wand
export const PILLARS = [
  [[0.85, 0.45, -0.2], 5.4, 0.5],     // Fahne oben rechts, zeigt auf den Haufen (wie im Hubble-Bild)
  [[0.75, -0.55, 0.05], 6.0, 0.8],    // große Säule unten rechts (Vorbeiflug)
  [[0.3, -0.4, -0.85], 6.8, 0.65],    // dahinter
].map(([a, tip, w]) => ({ a: new THREE.Vector3(...a).normalize(), tip, w }));
// Bok-Globulen: Mitte, Radius (klein oben rechts wie im Hubble-Bild, eine nah an der Bahn)
export const GLOBULES = [
  [[6.0, 8.5, 6.0], 0.42], [[7.1, 9.3, 5.2], 0.26], [[5.3, 7.7, 7.0], 0.18], [[-4.2, -6.4, 9.0], 0.45], [[2.6, 4.0, 15.0], 0.8],
].map(([c, r]) => ({ c: new THREE.Vector3(...c), r }));
export const SHER = new THREE.Vector3(-0.9, 2.6, 1.2);                     // ≈ 0,8 pc nördlich des Kerns
const SHER_N = new THREE.Vector3(0.85, 0.25, 0.45).normalize();     // Achse des Rings, ≈ 63° gegen die Sichtlinie
const f4 = (v) => v.toFixed(4);

// Drehbuch: Zeit [s], Kamera, Blickziel (Lj)
const KEYS = [
  [0, [-13, 3, 62], [5, 0, 0]],
  [8, [-7, 3.4, 40], [3.5, 1.2, 0]],
  [15, [0.6, 4.6, 22], [2.2, 3.6, 6]],
  [21, [1.3, 5.4, 11.5], [-0.9, 2.6, 1.2]],
  [27, [-2.9, 3.9, 4.6], [-0.9, 2.6, 1.2]],
  [32, [-3.6, 1.0, -1.2], [0, 0, 0]],
  [35.5, [-1.5, -1.9, 1.3], [2.5, -2.0, 0.4]],
  [40, [1.6, -2.6, 2.6], [5.6, -4.1, 0.4]],
  [45, [4.0, -1.4, 4.4], [5.6, -4.1, 0.4]],
  [51, [2.0, 1.4, 9.8], [0.6, -0.6, 0]],
  [58, [-1.2, 2.0, 16.5], [1.0, -0.6, 0]],
];
export const END = KEYS[KEYS.length - 1][0];
// Blende (Belichtung) und leichtes Rollen je Zeitpunkt
const EXPO = [[0, 1.45], [9, 1.38], [20, 1.12], [29, 0.92], [34, 0.5], [38, 0.62], [44, 0.95], [51, 1.1], [58, 1.15]];
const ROLL = [[0, 0], [15, -2.5], [27, 3.5], [36, -5], [44, 2.5], [58, 0]];
export const BEATS = [
  [0, 'Anflug', 'Riesiges H-II-Gebiet im Carina-Arm der Milchstraße, rund 22.000 Lichtjahre entfernt'],
  [10, 'Dunkelwolken', 'Bok-Globulen: dichte Staubknoten – ihr Rand leuchtet im UV-Licht des Haufens'],
  [20, 'Sher 25', 'Blauer Überriese mit Gasring (0,4 pc) und zwei Ausströmungen, ähnlich dem Ring um SN 1987A'],
  [31, 'Durch den Haufen', 'HD 97950: rund 10.000–16.000 Sonnenmassen, etwa 1 Million Jahre jung'],
  [40, 'Säulen', 'Säulen aus Gas und Staub zeigen zum Haufen – sein UV-Licht verdampft ihre Köpfe'],
  [49, 'Rückblick', 'Strahlung und Winde der jungen Sterne haben einen Hohlraum in die Wolke geblasen'],
];

// monotone kubische Interpolation (Fritsch–Carlson): kein Überschwingen, erste Ableitung stetig; s0/s1 = Steigung an den Enden
function monotone(xs, ys, s0, s1) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = s0 ?? d[0];
  m[n - 1] = s1 ?? d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const times = KEYS.map((k) => k[0]);
const progress = monotone(times, KEYS.map((_, i) => i), 0.06, 0.03);   // sanft anfahren, am Ende fast stehen (Gleiten)
const camCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[1])), false, 'centripetal');
const aimCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[2])), false, 'centripetal');
const exposureAt = monotone(EXPO.map((e) => e[0]), EXPO.map((e) => e[1]), 0, 0);
const rollAt = monotone(ROLL.map((e) => e[0]), ROLL.map((e) => (e[1] * Math.PI) / 180), 0, 0);
export const beatAt = (t) => { let b = BEATS[0]; for (const x of BEATS) if (t >= x[0]) b = x; return b; };

// ---------- Medium: Wand, Säulen, Globulen, Hülle, Sher 25 ----------
// Feld: r Rauigkeit der Wand je Richtung, g Turbulenz, b Fäden (Grat-Rauschen), a große Staubbahnen
const FIELD = /* glsl */ `
vec4 field(vec3 p) {
  vec3 d = normalize(p + vec3(1e-3));
  return vec4(fbm(d * 2.4 + vec3(3.1, 1.7, 5.3), 4), fbm(p * 0.085 + vec3(1.0, 7.0, 3.0), 4),
              ridged(p * 0.12 + vec3(5.0, 2.0, 9.0), 4), fbm(p * 0.04 + vec3(9.0, 4.0, 1.0), 3));
}
`;
// zweites Feld (mittlere Größen): x Risse/Löcher der Wand, y dünne Staubfäden, z Faltung der Front, w feine Fäden der Front
const FIELD2 = /* glsl */ `
vec4 field(vec3 p) {
  return vec4(fbm(p * 0.13 + vec3(4.0, 8.0, 2.0), 3), ridged(p * 0.26 + vec3(7.0, 3.0, 5.0), 3),
              fbm(p * 0.2 + vec3(2.0, 6.0, 8.0), 3), ridged(p * 0.45 + vec3(1.0, 4.0, 6.0), 2));
}
`;

const NP = PILLARS.length, NG = GLOBULES.length;
const MEDIUM = /* glsl */ `
#define NP ${NP}
#define NG ${NG}
const float EXT = ${f4(EXT)}, RV = ${f4(RV)}, RC = ${f4(RC)};
const vec3 WALL = vec3(${f4(WALL.x)}, ${f4(WALL.y)}, ${f4(WALL.z)}), BAND = vec3(${f4(BAND.x)}, ${f4(BAND.y)}, ${f4(BAND.z)});
uniform highp sampler3D uField, uField2;
uniform vec4 uPil[NP];     // xyz Achse, w Abstand des Kopfes
uniform float uPilW[NP];   // Breite
uniform vec4 uGlob[NG];    // xyz Mitte, w Radius
uniform vec3 uSher, uSherN;
uniform float uGain, uDust;

// fine: feine Oktave (nah an der Kamera) · star: 1 = nur Dichte für die Extinktion der Sterne (weiche Säulen, Globulen
// rechnet der Stern exakt als Sehne)
void medium(vec3 p, float fine, float star, out vec3 e, out float s) {
  e = vec3(0.0);
  s = 0.0;
  float r = length(p);
  if (r > RV) return;
  vec3 uvw = p * (0.5 / EXT) + 0.5;
  vec4 f = texture(uField, uvw), f2 = texture(uField2, uvw);
  vec3 d = p / max(r, 1e-3);
  float tb = f.g, fil = smoothstep(0.22, 0.78, f.b);
  if (fine > 0.01) {
    tb += fine * 0.22 * gnoise(p * 0.9 + vec3(3.0, 1.0, 7.0));
    float fr = 1.0 - abs(gnoise(p * 2.3 + vec3(1.0, 9.0, 4.0)));
    fil = mix(fil, fil * (0.35 + 1.3 * fr * fr), fine);
  }
  float flux = 1.0 / (1.0 + r * r / 40.0);   // UV des Haufens ∝ 1/d², weich im Kern
  // Wand der Molekülwolke: zum Betrachter offen, Rand ausgefranst; Front gefaltet (Turbulenz), damit die dünne Haut von
  // der Kante gesehen als heller Faden erscheint – so entstehen die Filamente der H-II-Gebiete
  // breiter, verrauschter Übergang zur offenen Seite und Faltung in mittlerer Größe: sonst zeichnet sich der Rand der
  // Schale als glatter heller Umriss ab (Kante der Haut von der Seite gesehen)
  float wd = dot(d, WALL);
  float side = smoothstep(-0.05, 0.75, wd + 0.45 * f.a + 0.35 * tb + 0.4 * (f.b - 0.45) + 0.35 * f2.x);
  // Risse: Löcher in der Wand, zum offenen Rand hin häufiger → der Rand zerfällt in Fetzen statt eines Ovals
  side *= smoothstep(-0.16, 0.06, f2.x + 0.12 * wd);
  // asymmetrisch: zur Molekülwolke hin näher am Haufen; Faltung (f2.z) legt die Front in Überhänge → mehrere helle Grate
  float bd = dot(d, BAND);
  float Rw = (RC * (1.0 + 0.6 * f.r) + 4.5 * tb + 3.0 * (f.b - 0.45)) * (1.0 - 0.15 * wd) * (1.0 + 0.45 * bd * bd) + 4.0 * f2.z;
  float rs = r - Rw;
  // dünne Staubfäden kurz vor und auf der Front: schwarze Bahnen vor dem hellen Gas
  float laneF = smoothstep(0.64, 0.79, f2.y) * exp(-pow((rs + 0.8) / 1.4, 2.0)) * side;
  // Säulen: Zylinder mit rundem Kopf, nach außen breiter, Achse leicht gewunden, Oberfläche zerfressen
  float bodyP = 0.0, headP = 0.0, rimP = 0.0, shade = 0.0, evP = 0.0;
  for (int i = 0; i < NP; i++) {
    vec3 a = uPil[i].xyz;
    float tip = uPil[i].w, h = dot(p, a), fi = float(i);
    if (h < tip - 3.0) continue;
    vec3 q = p - a * h;
    float w0 = uPilW[i];
    vec3 bx = normalize(cross(a, vec3(0.31, 0.95, 0.12))), by = cross(a, bx);
    q -= (bx * (sin(h * 0.55 + fi * 2.1) * 0.35 + sin(h * 1.3 + fi) * 0.12) + by * sin(h * 0.42 + fi * 4.7) * 0.3) * w0 * smoothstep(tip - 1.0, tip + 3.0, h);
    float qd = length(q);
    float w = w0 * (1.0 + 0.3 * tb + 0.2 * max(h - tip, 0.0));
    if (qd > w + 2.5) continue;
    float sd = h > tip ? qd - w : length(vec2(qd, tip - h)) - w;
    // Fäden längs der Achse (Rauschen in Achsrichtung 8× gestreckt): Rillen am Körper, Strähnen vor dem Kopf
    float str = 0.0;
    if (star < 0.5 && sd < 1.6) {
      str = gnoise(vec3(dot(q, bx), dot(q, by), h * 0.12) * (3.2 / w0) + vec3(fi * 5.0, 1.0, 2.0));
      // Kopf in Knollen und Finger zerfallen (Gas verdampft ungleich), Körper mit scharfen Rillen
      if (abs(sd) < 0.9) {
        float head = smoothstep(tip + 2.5 * w0, tip, h);
        sd += w * (0.3 + 0.12 * head) * gnoise(p * (1.1 / w0) + vec3(fi * 7.0, 3.0, 1.0))
            + w * 0.14 * head * gnoise(p * (3.0 / w0) + vec3(2.0, fi, 6.0)) + w * 0.09 * str;
      }
    }
    float soft = star > 0.5 ? 0.9 : 0.05;
    // dichter Kern, Kante scharf (Ionisationsfront), außen nur die Strähnen
    bodyP = max(bodyP, smoothstep(soft, -soft * 1.6, sd) * smoothstep(Rw + 5.0, Rw + 1.0, h) * 0.65);
    if (star > 0.5) continue;
    // Kopf: leuchtende Haut, wo die Oberfläche zum Haufen zeigt; Seiten nur schwach (diffuses Licht)
    vec3 n = h > tip ? q / max(qd, 1e-3) : normalize(p - a * tip);
    float skin = exp(-pow(sd / (0.03 + 0.02 * w0), 2.0));
    // aufgeraute Haut: feine Grate (verdampfendes Gas) statt glatter Kappe
    float gr2 = 1.0 - abs(gnoise(p * 3.2 + vec3(fi, 5.0, 2.0)));
    float fac = max(dot(n, -d), 0.0);
    headP += skin * max(dot(n, -d) * 1.2 + 0.05, 0.0) * (0.3 + fil) * (0.35 + 1.1 * gr2 * gr2);
    rimP += skin * smoothstep(tip + 7.0, tip, h) * smoothstep(tip - 0.4 * w0, tip + 0.4 * w0, h) * (0.15 + 1.6 * smoothstep(-0.1, 0.5, str));
    // verdampfender Kopf: dünner, strähniger Schleier vor der Kappe zum Haufen hin (Photoverdampfung)
    if (sd > 0.0) evP += exp(-sd / (0.06 + 0.16 * w0)) * fac * fac * smoothstep(tip + 1.5 * w0, tip - 0.2, h) * smoothstep(0.05, 0.7, str);
    // Schatten des Kopfes auf allem dahinter (Strahl vom Haufen trifft zuerst die Säule)
    shade = max(shade, smoothstep(w * 1.1, w * 0.75, qd) * smoothstep(tip - 0.2, tip + 0.6, h));
  }
  float bodyW = side * smoothstep(-0.2, 0.8, rs) * exp(-max(rs, 0.0) / 10.0) * (0.35 + 2.0 * max(tb + 0.2, 0.0));
  // Staubbahnen vor der Wand (nur Absorption) und schwache Hα-Fäden weit draußen – nie ein flächiger Schleier
  float shell = exp(-pow((r - 21.0) / 8.0, 2.0));
  float lane = smoothstep(0.42, 0.8, f.b) * smoothstep(-0.1, 0.25, f.a) * shell * smoothstep(-0.15, 0.35, dot(d, WALL));
  float env = smoothstep(0.38, 0.8, f.b) * smoothstep(-0.25, 0.1, -f.a) * shell;
  if (star > 0.5) { s = (bodyW * 0.9 + bodyP * 3.0 + lane * 1.4 + laneF * 3.2) * uDust; return; }
  // Haut der Ionisationsfront auf der Wand, im Schatten der Säulen dunkel; feine Fäden (f2.w) zerreißen die Haut
  fil *= 0.45 + 1.1 * f2.w;
  float skinW = exp(-pow((rs - 0.2) / 0.42, 2.0)) * side * side * (1.0 - shade) * (0.02 + 2.4 * fil * fil);
  // Hohlraum: dünnes ionisiertes Gas, nur nah am Haufen
  float cav = rs < 0.0 ? exp(-r / 3.5) * max(tb + 0.25, 0.0) * 0.025 : 0.0;
  // Bok-Globulen: dichter, unregelmäßiger Kern, Schweif vom Haufen weg, leuchtender Rand zur Haufenseite
  float glob = 0.0, rimG = 0.0;
  for (int j = 0; j < NG; j++) {
    vec3 c = uGlob[j].xyz;
    float g = uGlob[j].w;
    vec3 v = p - c;
    float dg = length(v);
    if (dg > g * 5.0) continue;
    vec3 ax = normalize(c);
    float al = dot(v, ax), pe = length(v - ax * al);
    // Kometenform: zur Haufenseite stumpf, nach außen gestreckt; Rand in drei Größen zerklüftet (Knoten, Buchten)
    float fj = float(j);
    vec3 el = normalize(cross(ax, vec3(sin(fj * 2.4), cos(fj * 1.7), 0.5)));
    vec3 vw = v + el * (g * 0.45 * gnoise(v * (0.8 / g) + c.zxy));
    dg = length(vw - ax * dot(vw, ax) * (al > 0.0 ? 0.5 : 0.15) - el * dot(vw, el) * 0.5);
    float gr = g * (1.0 + 0.5 * gnoise(v * (1.0 / g) + c) + 0.22 * gnoise(v * (2.3 / g) - c) + 0.1 * gnoise(v * (5.5 / g) + c.yzx));
    glob += smoothstep(gr, gr * 0.6, dg) * 9.0 / g + smoothstep(gr * 1.5, gr * 0.95, dg) * 0.8 / g;
    if (al > 0.0) glob += smoothstep(gr * 0.75, 0.0, pe + al * 0.14) * exp(-al / (g * 2.2)) * 3.0 / g;
    float fac = clamp(dot(v / max(dg, 1e-3), -ax) * 1.4 - 0.1, 0.0, 1.0);
    rimG += exp(-pow((dg - gr * 0.88) / (0.05 * g + 0.012), 2.0)) * fac * fac / (1.0 + dot(c, c) / 40.0);
  }
  // Farben: Hα + [N II] tiefrot (hell → lachs, über ACES), nah am Haufen [O III] und Streulicht bläulich
  vec3 HA = vec3(1.0, 0.31, 0.13), O3 = vec3(0.45, 0.72, 1.0), HOT = vec3(1.0, 0.7, 0.5);
  float o3 = exp(-r / 6.5);
  vec3 cg = mix(HA, O3, o3 * 0.6);
  e = (skinW + headP * 1.6 + rimP * 0.3) * flux * mix(cg, HOT, 0.3 * flux)
    + evP * flux * mix(HOT, O3, 0.45) * 0.2
    + rimG * HOT * 1.4
    + cav * mix(HA, O3, 0.5 + 0.5 * o3)
    + env * HA * 0.006
    + (bodyW + bodyP) * flux * vec3(0.5, 0.22, 0.12) * 0.006;
  // Kern: Licht tausender unaufgelöster Sterne
  e += vec3(0.75, 0.86, 1.0) * (exp(-r * r / 0.12) * 0.5 + exp(-r / 0.9) * 0.012);
  // Sher 25: dünner Ring, schwache Sanduhr, bläulicher Schein (aus der Nähe ein Detail, von weitem kaum sichtbar)
  vec3 v = p - uSher;
  float dv = length(v);
  if (dv < 3.2) {
    float hh = dot(v, uSherN), rr = length(v - uSherN * hh);
    float ring = exp(-pow(length(vec2(rr - 0.65, hh)) / 0.045, 2.0)) * (0.4 + 1.0 * smoothstep(-0.3, 0.5, gnoise(v * 5.0)));
    float ell = length(vec2(rr / 0.62, (abs(hh) - 0.8) / 0.8));
    float lobe = exp(-pow((ell - 1.0) / 0.05, 2.0)) * smoothstep(0.1, 0.4, abs(hh)) * smoothstep(0.1, 0.5, rr)
               * smoothstep(0.1, 0.7, 1.0 - abs(gnoise(v * 3.0 + 2.0)));
    e += ring * vec3(1.0, 0.32, 0.4) * 0.5 + lobe * vec3(0.9, 0.45, 0.6) * 0.035 + exp(-dv * dv / 0.04) * vec3(0.6, 0.75, 1.0) * 0.1;
    s += ring * 0.3;
  }
  e *= uGain;
  s += (bodyW * 0.9 + bodyP * 3.0 + glob + lane * 1.4 + laneF * 3.2 + skinW * 0.03) * uDust;
}
`;

const mediumUniforms = (fieldTex, field2Tex) => ({
  uField: { value: fieldTex }, uField2: { value: field2Tex },
  uPil: { value: PILLARS.map((p) => new THREE.Vector4(p.a.x, p.a.y, p.a.z, p.tip)) },
  uPilW: { value: PILLARS.map((p) => p.w) },
  uGlob: { value: GLOBULES.map((g) => new THREE.Vector4(g.c.x, g.c.y, g.c.z, g.r)) },
  uSher: { value: SHER }, uSherN: { value: SHER_N }, uGain: { value: 1.5 }, uDust: { value: 0.6 },
});

// Strahlverfolgung durch die Kugel RV; Schrittweite ∝ Abstand zur Kamera (uK), nah an Sher 25 fein
function cloudMesh(fieldTex, field2Tex) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vP; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
uniform float uK, uDmin, uDmax;
varying vec3 vP;
${NOISE}
${MEDIUM}
void main() {
  vec3 ro = cameraPosition, rd = normalize(vP - cameraPosition);
  float b = dot(ro, rd), c = dot(ro, ro) - RV * RV, h = b * b - c;
  if (h <= 0.0) discard;
  h = sqrt(h);
  float t0 = max(-b - h, 0.0), t1 = -b + h;
  if (t1 <= 0.0) discard;
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float t = t0 + clamp(t0 * uK, uDmin, uDmax) * jit;
  vec3 L = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < 420; i++) {
    if (t > t1) break;
    vec3 p = ro + rd * t;
    float dt = clamp(t * uK, uDmin, uDmax);
    vec3 ps = p - uSher;
    if (dot(ps, ps) < 10.0) dt = min(dt, max(0.035, t * 0.0025));   // fern: Ring ohnehin nur 1–2 px breit
    vec3 e;
    float s;
    medium(p, 1.0 - smoothstep(5.0, 12.0, t), 0.0, e, s);
    float a = exp(-s * dt);
    L += T * e * (s > 1e-4 ? (1.0 - a) / s : dt);
    T *= a;
    if (T < 0.004) break;
    t += dt;
  }
  gl_FragColor = vec4(L, 1.0 - T);
}`,
    uniforms: { ...mediumUniforms(fieldTex, field2Tex), uK: { value: 0.015 }, uDmin: { value: 0.035 }, uDmax: { value: 1.2 } },
    side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(RV, 48, 24), mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ---------- Sterne: Punktquellen mit Beugungsstrahlen, Extinktion durch das Medium ----------
const STAR_VERT = /* glsl */ `
attribute vec3 color;
attribute float lum;
uniform float uPx, uStarGain, uExt;
varying vec3 vCol, vSpCol;
varying float vSize, vSig, vSpike;
${NOISE}
${MEDIUM}
void main() {
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = length(mv.xyz);
  // Helligkeit gestaucht wie ein lang belichtetes Astrofoto (Fluss^0,35): schwache Sterne bleiben sichtbar, nahe nicht blendend
  float b = min(pow(lum / max(d * d, 0.02) * uStarGain, 0.35), 10.0);
  // Extinktion längs der Sichtlinie: Medium in 32 Stützstellen, Globulen exakt als Sehne; Rötung nach Extinktionsgesetz
  vec3 ro = cameraPosition, seg = position - ro;
  float tau = 0.0;
  for (int i = 0; i < 32; i++) {
    vec3 e;
    float s;
    medium(ro + seg * ((float(i) + 0.5) / 32.0), 0.0, 1.0, e, s);
    tau += s;
  }
  tau *= d / 32.0;
  float ss = dot(seg, seg);
  for (int j = 0; j < NG; j++) {
    vec3 c = uGlob[j].xyz;
    float g = uGlob[j].w, k = dot(c - ro, seg) / ss;
    if (k <= 0.0 || k >= 1.0) continue;
    float m = length(ro + seg * k - c);
    float gc = g * 0.85;
    if (m < gc) tau += 7.0 * sqrt(gc * gc - m * m) * uDust;
  }
  vec3 tr = exp(-tau * uExt * vec3(0.6, 0.78, 1.0));
  float vis = smoothstep(0.06, 0.2, d);   // nie durch einen Stern hindurch
  vSig = uPx * (0.55 + 0.12 * min(b, 6.0));
  vSpike = uPx * min(18.0 * pow(max(b - 0.9, 0.0), 0.9), 240.0);
  vSize = min(max(vSig * 7.0, vSpike * 3.2 + 4.0), 1000.0);
  gl_PointSize = vSize;
  vCol = color * tr * vis * b * 2.9 / (6.2832 * vSig * vSig / (uPx * uPx));
  vSpCol = color * tr * vis * min(b, 6.0) * 0.07;
}
`;
const STAR_FRAG = /* glsl */ `
uniform float uPx;
varying vec3 vCol, vSpCol;
varying float vSize, vSig, vSpike;
void main() {
  vec2 d = (gl_PointCoord - 0.5) * vSize, ad = abs(d);
  float r2 = dot(d, d);
  vec3 c = vCol * (exp(-r2 / (2.0 * vSig * vSig)) + 0.03 * exp(-sqrt(r2) / (vSig * 4.0)));
  if (vSpike > 0.5) {
    // vier Beugungsstrahlen, für Rot länger als für Blau; leise Ringe längs der Strahlen
    float w = uPx * 0.65;
    vec3 L = vSpike * vec3(0.44, 0.37, 0.30);
    vec3 rays = exp(-ad.y * ad.y / (2.0 * w * w)) * exp(-ad.x / L) + exp(-ad.x * ad.x / (2.0 * w * w)) * exp(-ad.y / L);
    c += vSpCol * rays * (0.86 + 0.14 * cos(sqrt(r2) / uPx * 1.1));
  }
  vec2 q = abs(gl_PointCoord - 0.5);
  gl_FragColor = vec4(c * (1.0 - smoothstep(0.4, 0.5, max(q.x, q.y))), 1.0);
}
`;

// Himmel dahinter (unendlich fern): Milchstraße als dichtes Band schwacher Sterne – NGC 3603 liegt in der Ebene
const SKY_VERT = /* glsl */ `
${SKY_VERTEX}
attribute vec3 color;
attribute float mag;
uniform float uPx;
varying vec3 vCol;
varying float vSig;
void main() {
  gl_Position = skyPosition(position);
  vSig = uPx * 0.6;
  gl_PointSize = vSig * 7.0;
  vCol = color * pow(10.0, -0.4 * (mag - 2.0)) * 0.9;
}
`;
const SKY_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vSig;
void main() {
  vec2 d = (gl_PointCoord - 0.5) * vSig * 7.0;
  gl_FragColor = vec4(vCol * exp(-dot(d, d) / (2.0 * vSig * vSig)), 1.0);
}
`;

const pale = (T, k = 0.25) => blackbody(T).map((c) => k + (1 - k) * c);

function buildStars(rand, pathPts) {
  const pos = [], col = [], lum = [];
  const add = (x, y, z, T, L) => { pos.push(x, y, z); col.push(...pale(T, 0.2)); lum.push(L); };
  // Kern: drei WNh-Sterne (HD 97950 A1, B, C) dicht beieinander
  [[0.04, 0.02, 0.03, 42000, 40], [-0.05, 0.03, -0.02, 40000, 30], [0.02, -0.06, 0.01, 41000, 28]].forEach((s) => add(...s));
  // O-Sterne im Kern
  for (let i = 0; i < 70; i++) add(gauss(rand) * 0.4, gauss(rand) * 0.4, gauss(rand) * 0.4, 33000 + rand() * 12000, 2 + rand() * 10);
  // Haufenmitglieder (Plummer-Profil, a = 0,6 Lj), meist massearm und noch kühl
  for (let i = 0; i < 4000; i++) {
    const u = 0.02 + rand() * 0.97;
    const r = Math.min(7, 0.6 / Math.sqrt(Math.pow(u, -2 / 3) - 1));
    const v = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(r);
    const L = 0.002 * Math.pow(rand(), -0.85);
    const T = L > 0.08 ? 15000 + rand() * 18000 : rand() < 0.5 ? 3500 + rand() * 1500 : 6000 + rand() * 7000;
    add(v.x, v.y, v.z, T, Math.min(L, 1.5));
  }
  // ältere junge Sterne im weiten Umfeld (≈ 5 Mio. Jahre)
  for (let i = 0; i < 2000; i++) {
    const L = 0.001 * Math.pow(rand(), -0.8);
    add(gauss(rand) * 4.5, gauss(rand) * 3.5, gauss(rand) * 4.5, L > 0.02 ? 9000 + rand() * 20000 : 3600 + rand() * 4000, Math.min(L, 0.5));
  }
  // Sher 25 (B1.5 Ia) und Vordergrundsterne der Milchstraße (viele rote und orange, wenige helle)
  add(SHER.x, SHER.y, SHER.z, 22000, 9);
  for (let i = 0; i < 22000; i++) {
    const x = (rand() - 0.5) * 110, y = (rand() - 0.5) * 80, z = -50 + rand() * 145;
    const r = rand(), L = Math.min(1.2, 0.0012 * Math.pow(rand(), -0.8));
    add(x, y, z, r < 0.45 ? 3200 + rand() * 1200 : r < 0.85 ? 4600 + rand() * 1900 : 7000 + Math.pow(rand(), 2) * 18000, L);
  }
  add(-14, 12, 46, 3000, 2.5);    // roter Riese oben links (wie im Hubble-Bild)
  add(-17, -11, 44, 20000, 3);    // heller blauer Stern unten links
  // Bahn freihalten: kein Stern näher als 0,35 Lj an der Kamerabahn → nahe Vorbeiflüge, aber kein Durchflug
  const p = new THREE.Vector3(), best = new THREE.Vector3();
  for (let i = 0; i < pos.length; i += 3) {
    p.set(pos[i], pos[i + 1], pos[i + 2]);
    let dmin = Infinity;
    for (const q of pathPts) { const dd = p.distanceToSquared(q); if (dd < dmin) { dmin = dd; best.copy(q); } }
    if (dmin < 0.35 * 0.35) {
      const dir = p.clone().sub(best);
      if (dir.lengthSq() < 1e-8) dir.set(gauss(rand), gauss(rand), gauss(rand));
      p.copy(best).addScaledVector(dir.normalize(), 0.35 + rand() * 0.3);
      pos[i] = p.x; pos[i + 1] = p.y; pos[i + 2] = p.z;
    }
  }
  return { pos, col, lum };
}

function buildSky(rand) {
  const n = 16000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), mag = new Float32Array(n);
  const ng = new THREE.Vector3(0.2, 0.97, -0.1).normalize();
  const u = new THREE.Vector3(1, 0, 0).addScaledVector(ng, -ng.x).normalize(), w = new THREE.Vector3().crossVectors(ng, u);
  const dir = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const m = 2 + Math.log(1 + rand() * (Math.exp(1.1 * 7) - 1)) / 1.1;
    if (rand() < 0.7) {
      const l = rand() * Math.PI * 2, b = gauss(rand) * 0.12;
      dir.copy(u).multiplyScalar(Math.cos(b) * Math.cos(l)).addScaledVector(w, Math.cos(b) * Math.sin(l)).addScaledVector(ng, Math.sin(b));
    } else dir.set(gauss(rand), gauss(rand), gauss(rand)).normalize();
    pos.set([dir.x, dir.y, dir.z], i * 3);
    col.set(pale(rand() < 0.5 ? 3600 + rand() * 1600 : 5000 + rand() * 4000, 0.3), i * 3);
    mag[i] = m;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
  const m = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: { uPx: { value: 1 } },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

// ---------- Bausteine: gemeinsam für die Testseite (createFilm) und die Station der App (levels/ngc3603.js) ----------
// Kamera auf der Fahrt zur Zeit t (s): Ort, Blickziel, Rollen; reine Funktion der Zeit, gibt das Blickziel zurück
const aimV = new THREE.Vector3();
export function filmPose(t, camera) {
  const k = progress(t) / (KEYS.length - 1);
  camCurve.getPoint(k, camera.position);
  aimCurve.getPoint(k, aimV);
  camera.up.set(0, 1, 0);
  camera.lookAt(aimV);
  camera.rotateZ(rollAt(t));
  camera.updateMatrixWorld();
  return aimV;
}
export { exposureAt };
// Endpose der Fahrt (Heimpose der Station: dort beginnt das freie Umsehen ohne Sprung)
export const FILM_END = { pos: new THREE.Vector3(...KEYS[KEYS.length - 1][1]), target: new THREE.Vector3(...KEYS[KEYS.length - 1][2]) };
export const FILM_START = { pos: new THREE.Vector3(...KEYS[0][1]), target: new THREE.Vector3(...KEYS[0][2]) };

// Himmel, Wolke (offscreen), Sterne, Staubkörner; quality 0–2 = Auflösung der Wolke und Schrittweite je Abstand
const QUAL = [[0.4, 0.016], [0.6, 0.011], [0.85, 0.008]];
export function buildNebula(renderer, { quality = 1 } = {}) {
  const rand = mulberry32(3603);
  const sky = buildSky(rand);
  sky.renderOrder = 0;

  const field = bakeField(renderer, { size: 144, extent: EXT, body: FIELD });
  const field2 = bakeField(renderer, { size: 144, extent: EXT, body: FIELD2 });
  const cloud = cloudMesh(field.texture, field2.texture);
  const Q = QUAL[Math.max(0, Math.min(2, quality))];
  cloud.material.uniforms.uK.value = Q[1];
  const vol = offscreen(renderer, cloud);
  vol.setScale(Q[0]);
  vol.quad.renderOrder = 1;

  const pathPts = [];
  for (let i = 0; i <= 600; i++) pathPts.push(camCurve.getPoint(i / 600));
  const st = buildStars(rand, pathPts);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(st.pos, 3));
  sg.setAttribute('color', new THREE.Float32BufferAttribute(st.col, 3));
  sg.setAttribute('lum', new THREE.Float32BufferAttribute(st.lum, 1));
  const starMat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
    uniforms: { ...mediumUniforms(field.texture, field2.texture), uPx: { value: 1 }, uStarGain: { value: 6200 }, uExt: { value: 1 } },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true,
  });
  const stars = new THREE.Points(sg, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = 2;

  // Staubkörner nah an der Bahn: ziehen beim Flug vorbei (Gefühl für Tempo und Tiefe), vom Haufen angeleuchtet
  const mp = [], mc = [], ms = [];
  for (let i = 0; i < 5000; i++) {
    const q = pathPts[Math.floor(rand() * pathPts.length)];
    const x = q.x + gauss(rand) * 1.2, y = q.y + gauss(rand) * 1.2, z = q.z + gauss(rand) * 1.2;
    const k = 0.35 / (1 + (x * x + y * y + z * z) / 60);
    mp.push(x, y, z);
    mc.push(1.0 * k, 0.62 * k, 0.48 * k);
    ms.push(0.004 + rand() * 0.006);
  }
  const motes = pointCloud(mp, mc, ms, { min: 0.8, max: 5, fade: 4 });
  motes.renderOrder = 3;

  return {
    objects: [sky, vol.quad, stars, motes], vol, cloud, stars, sky, motes,
    ready: Promise.all([field.ready, field2.ready]),
    // dpr = Bildpunkte je CSS-Pixel des Ziels, H = Höhe des Ziels in Bildpunkten
    setPx(dpr, H, fov) {
      starMat.uniforms.uPx.value = dpr;
      sky.material.uniforms.uPx.value = dpr;
      motes.userData.setPx(dpr, H, fov);
    },
    dispose() {
      for (const o of [sky, stars, motes]) { o.geometry.dispose(); o.material.dispose(); }
      vol.dispose(); field.dispose(); field2.dispose();
    },
  };
}

// ---------- Testseite web/ngc3603.html: eigener Renderer, Fahrt als Film ----------
export function createFilm(canvas, { quality = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  if (!renderer.capabilities.isWebGL2) throw new Error('webgl2');
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  const post = createPost(renderer);
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
  const neb = buildNebula(renderer, { quality });
  scene.add(...neb.objects);
  const vol = neb.vol;

  const look = {
    exposure: 1, bloom: 0.1, sat: 1.22, con: 0.22, sh: new THREE.Vector3(0.95, 0.98, 1.07), hi: new THREE.Vector3(1.05, 1.0, 0.94),
    vig: 0.42, grain: 0.012, bars: 0, ehtA: new THREE.Vector3(), ehtB: new THREE.Vector3(),
  };
  let barsOn = true, H = 1, W = 1;

  function apply(t) {
    filmPose(t, camera);
    look.exposure = exposureAt(t);
  }

  function setSize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    W = Math.round(w * dpr); H = Math.round(h * dpr);
    rt.setSize(W, H);
    post.setSize(W, H);
    vol.setSize(W, H);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 72 : 50;   // hochkant: mehr Blickwinkel, damit die Fahrt lesbar bleibt
    camera.updateProjectionMatrix();
    neb.setPx(dpr, H, camera.fov);
  }

  function render(time) {
    look.bars = barsOn && W > H ? Math.max(0, (1 - W / H / 2.39) / 2) : 0;   // hochkant ohne Balken (sonst nur ein Streifen Bild)
    vol.render(camera);
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    post.render(rt, null, null, look, time);
  }

  const ready = neb.ready.then(() => renderer.compileAsync(scene, camera)).then(() => renderer.compileAsync(vol.scene, camera));
  return {
    ready, apply, render, setSize,
    setBars(on) { barsOn = on; },
    get bars() { return barsOn; },
  };
}
