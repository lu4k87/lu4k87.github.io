// Auftakt beim Aufruf der Seite (User 27.10.2026; Vorbild: Intro-Video „Big Bang Explosion“ bis 0:17, Kamera und Effekte
// darüber hinaus): aus dem Schwarz ein winziger blauer Lichtpunkt, der langsam wächst – waagerechter Lichtstreif wie durch
// eine anamorphe Linse, Strahlenkranz, Staub tritt ins Licht. Kurz vor dem Knall zieht sich alles zusammen, dann zerreißt
// es. Ablauf (User 27.10.2026, zweite Fassung: Anfang schneller, Knall nicht mehr schlagartig, Übergänge fließend):
// Zünden (≈ 1 s) → Wachsen → Spannung (Licht pulsiert wie ein Herzschlag, unter 2 Hz; Strahlen wachsen, Staub wird
// spiralig zum Punkt gesogen, Kamera fährt an) → Luftholen (Licht dunkelt ab, alles zieht sich zusammen, Dolly-Zoom) →
// Knall in Stufen über 4,2 s (User 27.10.2026, dritte Fassung: weniger weiße Fläche, mehr Detail, geführte Kamera statt
// Wackeln): Zündung, zwei Nachstöße im Kern, Strahlen und Lichtfäden schießen nach außen, ein Feuerball aus turbulenter
// Glut mit hellen Adern wächst bis in die Ecken; die Kamera weicht weich zurück, schwingt einmal nach, umkreist den
// Feuerball im Bogen und wird gedreht hineingezogen → kurzes Weiß →
// Flug durch den Nebel des jungen Plasmas (User 27.10.2026, vierte Fassung: länger, eine Wolkenlandschaft statt einer
// Wolke – Strahlverfolgung durch ein gebackenes 3D-Feld mit Hauptwolke, Säulen, Seitenwolke, Zielwolke, dunklen Bahnen
// und zartem Schleier; die Kamera fliegt auf einer Bahn hindurch: aus der Hauptwolke heraus, an Säulen und einer
// durchleuchteten Wolke vorbei in die Zielwolke; Fäden, heiße Adern, kühle dunkle Bahnen, leuchtende Ränder; der Nebel
// kühlt nach Planck-Farbe blauweiß → weiß → gold → orange, der Raum dehnt sich) → der Nebel lichtet sich, das Plasma wird
// durchsichtig (≈ 380.000 Jahre), die Rekombination wandert als glühende Front fleckig über das Bild und lässt genau die
// Kugel der Hintergrundstrahlung von Station 10 zurück (gleiches Muster aus glsl.js CMB, dieselben Uniforms der Schale) →
// dunkles Zeitalter: der Grund erlischt, die Keime des kosmischen Netzes glimmen violett, die ersten Sterne zünden
// blauweiß in den dichtesten Knoten, einzelne Supernova-Blitze → erste Galaxien auf den Fäden, klein, blau, klumpig; die
// Kamera stürzt durch das Netz voller Galaxien (User 27.10.2026: der Flug durch die Galaxien aus dem Film der Station 11,
// länger und dichter; cosmicweb.js, galaxyflight.js), die Galaxien reifen zu Spiralen und Ellipsen, der Raum dehnt sich →
// Wende im Bogen tief hinter der Mitte → Rückzug rückwärts an den Galaxien vorbei aus der Kugel (Fahrplan flightplan.js
// openerCurves: eine Zoom-Fahrt ohne Halt) in die Heimpose der Station 10, deren Galaxien blenden ein (cmb.opening).
// Fünfte Fassung (Vorschau „Auftakt langsamer“, User 28.10.2026: Tempo B + C, Effekte A + B + C, Gas B + C, Blau dezenter):
// ganzer Film 10 % langsamer; Luftholen in zwei Atemzügen (zusammen, kurz loslassen, tiefer zusammen), ab dem zweiten
// Atemzug bis kurz nach dem Knall Zeitlupe; dabei zieht sich ein Linsenring in den Punkt, Lichtfäden stürzen hinein, die
// Herzschläge senden Ringe aus, die beim Luftholen zurücklaufen (beim Knall eine Druckwelle), und die Farbe weicht (Stille)
// – mit dem Knall kehrt sie zurück; eine wirbelnde Gasscheibe umkreist den Punkt, wird eingesogen und zerrissen; der
// Nebel nach dem Knall trägt Webb-Farben (künstlerisch, Planck-Glut darunter).
// Sechste Fassung (User 28.10.2026): Vorspann – erst Schwarz, dann ein winziger ferner Lichtpunkt, der funkelt und
// langsam wächst (feines Beugungskreuz, Lichthof, erster Staub im Licht, Kamera schwebt heran), bis er nahtlos in den
// bisherigen Anfang übergeht; der Wirbel (Gasscheibe) detailreicher und schneller: Arme drehen starr (wickeln sich nicht
// zu Ringen auf), das Gas darin differentiell mit Strähnen, Staubbahnen und rosa Knoten, weniger weiße Ringe; mit dem
// Knall zünden Galaxien und Lichtpunkte im Wirbel (vortex.js), die Kamera fliegt hinein und alles zieht an ihr vorbei,
// der Feuerball kommt erst danach und führt ins Weiß.
// Der Lichtpunkt vor dem Knall ist Darstellung: Es gab kein „Außen“, von dem aus man hätte zusehen können.
// Gastgeber (main.js, Vorschau): advance(dt) → apply(station) → Szene mit `view === 'own' ? camera : station.camera` ins
// eigene Ziel rendern, ab mix > 0 die Station dazu (post.js Überblendung); look = Belichtung + Grading des Films.

import * as THREE from 'three';
import { NOISE, CMB } from './glsl.js';
import { LOOK } from './post.js';
import { bakeField } from './vol.js';
import { smoothKeys, openerMarks, openerCurves } from './flightplan.js';
import { mulberry32, gauss, blackbody } from './astro.js';
import { galaxyAtlas, galaxySprites, glowPoints, randTurn, TILES } from './galaxyflight.js';
import { bakeWeb, sampleWeb, flightAxis, inTube, EXT as WEB_EXT, THIN } from './cosmicweb.js';
import { createVortex } from './vortex.js';

// Stellschrauben (Vorschau-Regler). Zeiten in Filmsekunden: pre = Vorspann (Schwarz, dann wächst der ferne Lichtpunkt),
// build = Aufbau bis zum Knall (Spannung ab der Hälfte),
// plasma = Nebel bis klar, dark = dunkles Zeitalter + erste Sterne, galaxies = Flug durch die Galaxien, crane = Rückzug in
// die Heimpose; charge = Stärke des Spannungsaufbaus, warp = Lichtfäden nach dem Knall, flow = Weg durch den Nebel,
// neb/fil/hot/edge = Dichte, Fäden, Farbspiel, Leuchtsaum des Nebels; web/gal/stars = Netz, Galaxien, erste Sterne;
// ghosts/spikes = Linsenreflexe und Blendenstrahlen des Lichtpunkts; arc/rise = Bogen und Kranhöhe der Wende (°),
// end* = Endpose relativ zur Heimpose (Abstand ×, Drehung °); inhale/flash = Luftholen und Knall bis weiß (s), slow =
// Zeitlupe am Kipppunkt (Film läuft dort mit 1 − slow), suck/pulse/hush = Lichtsog, Pulswellen, Stille, disk = Gasscheibe,
// webb = Webb-Farben im Nebel, swirl = Drehung des Wirbels, swarm = Galaxien und Lichtpunkte im Wirbel nach dem Knall;
// Look-Werte wirken als Faktor und laufen bis zum Ende auf den Look der Station zu.
export const TUNE = {
  pre: 7, tempo: 0.9, inhale: 3.8, flash: 5, slow: 0.55, suck: 1, pulse: 0.15, hush: 1, disk: 1, webb: 1, swirl: 1, swarm: 1,
  build: 11.5, plasma: 16, dark: 4.5, galaxies: 11, crane: 12, charge: 1, warp: 1, flow: 1, neb: 1, fil: 1, hot: 1, edge: 1,
  web: 1, gal: 1, stars: 1,
  core: 1, streak: 1, streakLen: 1, rays: 1, rayLen: 1, ghosts: 1, spikes: 1, hue: 204, sat: 0.8,
  dust: 1, burst: 1, blur: 1, bokeh: 1, shock: 0, shake: 1,
  push: 1, drift: 1, arc: 28, rise: 12, endDist: 1, endAz: 0, endEl: 0,
  exposure: 1, bloom: 1, grain: 1, ca: 1, vig: 1, bars: 1,
};
// weiß halten (s)
const HOLD = 0.25;
export const marks = (k) => openerMarks(k, { inhale: k.inhale, flash: k.flash, hold: HOLD });

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (e) => 1 - Math.pow(1 - e, 3) * (1 + 3 * e);   // aus dem Stand, langes Ausrollen (wie der Auftakt in main.js)
const DEG = Math.PI / 180;
// Abspieltempo zur Filmzeit t: Zeitlupe ab dem zweiten Atemzug bis kurz nach dem Knall, weich ein- und ausgeblendet
function rateAt(k, M, t) {
  const L = M.bang - 0.12 - M.inhale;
  return k.tempo * (1 - k.slow * sstep(M.inhale + 0.45 * L, M.inhale + 0.6 * L, t) * (1 - sstep(M.bang + 1.2, M.bang + 3, t)));
}

const BG_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }';
const BG_FRAG = /* glsl */ `
${NOISE}
${CMB}
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uCamPos, uO;
uniform vec2 uC;
uniform float uAspect, uTime;
uniform float uCore, uSize, uHalo, uSpread, uGlow, uStreak, uStreakW, uStreakL, uRays, uRayL, uRayRot, uShock, uShockR, uFlash;
uniform float uWarp, uWarpT, uFill, uFillI, uRing, uStack, uGhost, uSpike;
uniform float uSuck, uPulseA, uFxP, uFxIn, uPulse, uGas, uGasS, uGasL, uGasHot, uGasSpin, uGasArm, uJW, uCross, uCrossL, uTwinkle;
uniform mat3 uGasM;
uniform vec3 uTint, uDeep;
uniform float uPlasma, uTemp, uBright, uContrast, uFog, uDetail, uFalse, uExpand, uR, uShellK;
uniform float uNeb, uFil, uHot, uEdge, uThr, uAbs, uGround;
uniform vec3 uNebPos;
uniform highp sampler3D uField;
uniform highp sampler3D uWebField;
uniform vec3 uWebC, uWebA, uWebB;
uniform mat3 uWebM;
uniform float uWebS, uWeb, uThin;
uniform vec3 uCut, uDip;
uniform float uCutCos, uDipOn;
varying vec2 vUv;

// Glut des Plasmas nach Temperatur (Planck-Farbe, für glühendes Gas etwas satter): blauweiß → weiß → gold → orange
vec3 ember(float T) {
  float t = clamp(log(T / 3000.0) / log(40000.0 / 3000.0), 0.0, 1.0);
  vec3 c0 = vec3(1.0, 0.45, 0.14), c1 = vec3(1.0, 0.74, 0.4), c2 = vec3(1.0, 0.94, 0.82), c3 = vec3(0.72, 0.92, 1.0), c4 = vec3(0.38, 0.6, 1.0);
  if (t < 0.15) return mix(c0, c1, t / 0.15);
  if (t < 0.4) return mix(c1, c2, (t - 0.15) / 0.25);
  if (t < 0.7) return mix(c2, c3, (t - 0.4) / 0.3);
  return mix(c3, c4, (t - 0.7) / 0.3);
}
vec3 rayDir() { vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); v /= v.w; return normalize((uCamWorld * vec4(v.xyz, 0.0)).xyz); }

// Strahlenkranz: n Fächer um den Kern, je Fach ein dünner Strahl mit eigener Länge, Stärke, Lage und Funkeln
float rays(float phi, float r, float n, float rot, float seed, float L) {
  float a = (phi + rot) / 6.2831853 * n, id = floor(a), f = fract(a) - 0.5;
  float h1 = hash12(vec2(id, seed)), h2 = hash12(vec2(id, seed + 7.1)), h3 = hash12(vec2(id, seed + 3.3));
  // Abstand zur Strahlmitte in Bildhöhen: Strahlen bleiben dünne Linien statt sich zum Kegel zu weiten
  float off = (h3 - 0.5) * 0.5, perp = abs(f - off) * 6.2831853 / n * r, wl = mix(0.0012, 0.0035, h2) * (1.0 + r * 1.5);
  float prof = exp(-pow(perp / wl, 2.0)) + 0.14 * exp(-pow(perp / (wl * 5.0), 2.0));
  prof *= smoothstep(0.5, 0.32, abs(f));
  float tw = 0.82 + 0.18 * sin(uTime * (1.3 + 2.1 * h2) + h1 * 40.0);
  return pow(h1, 3.0) * tw * prof * exp(-r / (L * mix(0.15, 1.0, h1 * h1)));
}
// vier Fächer übereinander: lange Hauptstrahlen, doppelt so viele kürzere, elf sehr lange, feinste Nebenstrahlen nur nahe
// am Kern
float raySet(float phi, float r) {
  return rays(phi, r, 36.0, uRayRot, 1.0, uRayL) + 0.7 * rays(phi, r, 72.0, -0.6 * uRayRot, 5.0, uRayL * 0.55)
       + 0.35 * rays(phi, r, 11.0, 0.35 * uRayRot, 9.0, uRayL * 1.8) + 0.5 * rays(phi, r, 160.0, 0.8 * uRayRot, 13.0, uRayL * 0.22);
}

// Lichtsog nach dem Knall: dünne Lichtfäden schießen radial nach außen, jeder mit eigenem Tempo und Abstand
float warp(float phi, float r, float n, float seed) {
  float a = phi / 6.2831853 * n, id = floor(a), f = fract(a) - 0.5;
  float h1 = hash12(vec2(id, seed)), h2 = hash12(vec2(id, seed + 4.7)), h3 = hash12(vec2(id, seed + 8.9));
  float perp = abs(f) * 6.2831853 / n * r, w = 0.0007 + 0.0025 * r;
  float head = fract(h2 + uWarpT * (0.35 + 0.65 * h3)) * 1.9, len = 0.05 + 0.45 * head;
  float along = smoothstep(head - len, head, r) * smoothstep(head + 0.012, head - 0.004, r);
  return step(0.45, h1) * h1 * exp(-pow(perp / w, 2.0)) * along;
}

// Gasscheibe vor dem Knall (Darstellung wie der Lichtpunkt), sechste Fassung: zwei Hauptarme und zwei schwächere
// Nebenarme als logarithmische Spirale, die als Muster starr dreht (uGasArm – wickelt sich nicht zu Ringen auf); das Gas
// darin dreht differentiell (innen schneller, uGasSpin) und wird so zu Strähnen geschert: Wolken, feine Fäden, dunkle
// Staubbahnen an der Innenkante der Arme, rosa Knoten (Wasserstoff) und türkise Säume (Sauerstoff) wie auf den
// Webb-Bildern, innen heiß und weißblau; q = Lage in der Scheibe (Maßstab heraus)
void gasSample(vec3 q, out float dens, out vec3 e) {
  float rr = length(q.xz), a0 = atan(q.z, q.x), lr = log(rr + 0.25);
  float a = a0 + uGasSpin / (0.4 + rr), aa = a0 + uGasArm - 2.2 * lr;
  vec3 qr = vec3(rr * cos(a), q.y * 2.5, rr * sin(a));
  float vert = exp(-pow(q.y / (0.07 + 0.05 * rr), 2.0));
  float arm = pow(0.5 + 0.5 * cos(2.0 * aa), 2.5), arm2 = pow(0.5 + 0.5 * cos(4.0 * aa + 1.3), 4.0);
  float lane = pow(0.5 + 0.5 * cos(2.0 * aa + 0.55), 10.0) * smoothstep(0.5, 1.2, rr);
  float cloud = fbm(qr * 1.7 + 2.0, 5), fil = ridged(qr * 4.2 + cloud, 3), knot = smoothstep(0.62, 0.95, fbm(qr * 5.0 + 9.0, 3) + 0.5 * arm);
  float edge = smoothstep(GAS_R, GAS_R - 1.6, rr) * smoothstep(0.05, 0.45, rr);
  float body = vert * edge * (0.12 + 0.88 * arm + 0.35 * arm2) * clamp(0.55 + 1.4 * cloud + 0.5 * fil * fil, 0.0, 1.8);
  vec3 cIn = vec3(1.0, 0.8, 0.52), cArm = mix(vec3(0.12, 0.5, 1.0), vec3(0.35, 0.85, 1.0), fil);
  vec3 c = mix(mix(cIn, cArm, smoothstep(0.3, 1.3, rr)), vec3(0.6, 0.3, 0.95), smoothstep(2.2, 3.8, rr) * 0.6);
  c = mix(c, vec3(1.0, 0.36, 0.62), knot * 0.85 * smoothstep(0.6, 1.4, rr));
  c += vec3(0.25, 0.9, 1.0) * 0.5 * fil * fil * fil * arm;
  dens = body * 0.3 + vert * edge * lane * 1.1;
  e = c * body * (1.1 + 1.6 * fil * fil * arm + 2.2 * knot) * (1.0 - 0.85 * lane) + vec3(1.0, 0.75, 0.5) * uGasHot * body;
}

// Glut satt statt bräunlich
vec3 satur(vec3 v, float k) { return max(vec3(0.0), mix(vec3(dot(v, vec3(0.2126, 0.7152, 0.0722))), v, k)); }

// Nebel nach dem Knall (das Plasma als Wolkenlandschaft): Wolkenkörper, Wärmeflecken und grobe Fäden aus dem gebackenen
// Feld (eine Texturprobe je Schritt), feine Fäden aus Grat-Rauschen; Dichte → Glut nach Planck-Farbe (Fäden heißer und
// heller, kühle Bahnen dunkel), dünne Ränder leuchten heißer (durchleuchteter Saum) und Absorption (dunkle Bahnen vor
// hellem Grund), bis das Plasma klar wird (uThr hoch, uAbs 0)
void nebSample(vec3 p, float s, out vec3 e, out float sig) {
  vec4 f = texture(uField, p / NEB_EXT2 + 0.5);
  float fine = ridged(p * 9.0 + f.a * 1.5, OCTF), fil = f.b;
  // Körper aus dem Feld (0 = leerer Raum), ausgefranst durch die feinen Fäden; Dichte bleibt weich (feine Fäden wirken
  // über die Glut der Adern, nicht über die Dichte – sonst Körnung zwischen den Schritten)
  float body = f.r * (0.75 + 0.5 * fine) + uFil * 0.3 * (fil - 0.5) * f.r;
  float dens = smoothstep(uThr, uThr + 0.3, body) * uNeb * smoothstep(0.1, 0.6, s);
  float edge = 4.0 * dens * (1.0 - dens);
  // Quellfunktion (Glut je Absorption) muss mit der Dichte wachsen, sonst zeigt dichter Nebel eine einfarbige Fläche:
  // Glut ∝ Dichte², Adern dazu; kühle Bahnen glühen schwach und schlucken das Licht dahinter
  float filv = fil * (0.6 + 0.4 * fine), vein = pow(filv, 4.0) * dens, emit = 0.15 + 0.85 * clamp(0.5 + 1.8 * f.g, 0.0, 1.0);
  // ×0,3 … ×2,6: heiße Fäden blau, kühle dichte Bahnen orange bis rot
  float Tl = uTemp * exp(uHot * (2.4 * f.g + 1.5 * fil * fil - 0.6)) * mix(1.0, 0.4, (1.0 - emit) * dens);
  // feine Fäden als Filigran in der Glut aller Wolken (ohne die Dichte zu kräuseln); Saum heißer als der Körper
  e = ember(Tl) * (2.5 * dens * dens * (0.15 + 1.1 * emit) * (0.45 + 1.3 * fine * fine) + 6.0 * vein * dens) * uBright
    + ember(Tl * 1.8) * edge * uEdge * (0.3 + 0.7 * fine) * 0.8 * uBright;
  sig = dens * uAbs;
  // Webb-Farben (künstlerisch): Wolkenkörper orange-braun, Säume türkis, Adern goldweiß, dichtere dunkle Bahnen
  if (uJW > 0.0) {
    vec3 jw = vec3(0.95, 0.45, 0.16) * 2.2 * dens * dens * (0.3 + 0.9 * emit) * (0.45 + 1.3 * fine * fine)
            + vec3(0.3, 0.75, 1.0) * edge * uEdge * (0.4 + 0.8 * fine) * 1.6 + vec3(1.0, 0.85, 0.55) * 6.0 * vein * dens;
    e = mix(e, jw * uBright, uJW);
    sig *= 1.0 + 0.8 * uJW;
  }
}

void main() {
  vec3 col = vec3(0.0);
  if (uPlasma < 0.5) {
    vec2 p = (vUv - uC) * vec2(uAspect, 1.0);
    float r = length(p), phi = atan(p.y, p.x), q = r / uSize;
    // Kern, Lichthof der Linse (in Kerngrößen), blauer Schleier über dem ganzen Bild; im Vorspann funkelt der ferne Punkt
    // (langsam, unter 2 Hz, kein Blitzen)
    float tw = 1.0 + uTwinkle * (0.55 * sin(uTime * 6.9) * sin(uTime * 2.3 + 1.0) + 0.45 * sin(uTime * 10.7 + 2.0) * sin(uTime * 1.3));
    col += mix(vec3(1.0), uTint, 0.15) * uCore * exp(-q * q) * tw;
    // Vorspann: feines Beugungskreuz des fernen Punkts, wächst mit dem Licht und geht in den Lichtstreif über
    if (uCross > 0.0) {
      float ax = abs(p.x), ay = abs(p.y), w2 = 0.0011 * 0.0011;
      col += mix(vec3(1.0), uTint, 0.45) * uCross * tw * smoothstep(uSize * 0.8, uSize * 2.5, r)
           * (exp(-ay * ay / w2) * exp(-ax / uCrossL) + 0.7 * exp(-ax * ax / w2) * exp(-ay / (0.8 * uCrossL)));
    }
    float rh = r / uSpread;
    col += mix(vec3(1.0), uTint, 0.8) * uHalo * (0.6 * exp(-rh / 0.012) + 0.3 * exp(-rh / 0.05) + 0.1 * exp(-rh / 0.15));
    col += uDeep * uGlow * 0.5 * (exp(-r / 0.3) + 0.12 * exp(-r / 1.2));   // Blau dezent, Grund bleibt schwarz (User 28.10.2026)
    // feine Beugungsringe dicht um den Kern (zwei zarte Ringe), nur solange der Kern ein Punkt ist
    col += mix(vec3(1.0), uTint, 0.5) * uCore * 0.008 * (exp(-pow((q - 2.3) / 0.28, 2.0)) + 0.5 * exp(-pow((q - 3.7) / 0.35, 2.0))) * (1.0 - uFillI);
    // Lichtstreif (anamorph): heller Faden, weicher Schleier darum, leicht faserig; Rot und Blau laufen verschieden weit
    // (Spektralsaum an den Spitzen), dazu ein schwacher senkrechter Streif (Kreuz der Linse)
    if (uStreak > 0.0) {
      float w = uStreakW, ay = abs(p.y), ax = abs(p.x);
      float wisp = 0.8 + 0.2 * gnoise(vec3(p.x * 6.0, p.y * 30.0, uTime * 0.25));
      vec3 line;
      for (int ch = 0; ch < 3; ch++) {
        float axc = ax * (1.0 + (float(ch) - 1.0) * 0.05);
        float v = exp(-ay * ay / (w * w)) * (1.3 * exp(-axc / (uStreakL * 0.06)) + 0.55 * exp(-axc / (uStreakL * 0.4)) + 0.22 * exp(-axc / (uStreakL * 1.6)));
        if (ch == 0) line.r = v; else if (ch == 1) line.g = v; else line.b = v;
      }
      float haze = exp(-ay * ay / (36.0 * w * w)) * (exp(-ax / (uStreakL * 0.2)) + 0.3 * exp(-ax / uStreakL));
      col += uStreak * (mix(vec3(1.0), uTint, 0.6) * line + uDeep * haze * 0.6) * wisp;
      col += uStreak * 0.1 * mix(vec3(1.0), uTint, 0.7) * exp(-ax * ax / (9.0 * w * w)) * exp(-ay / (uStreakL * 0.1)) * wisp;
      // gestaffelte Nebenstreifen der Linse (nur im Knall): schwächer, schmaler, etwas kürzer
      if (uStack > 0.0) {
        float o = 0.035 + 0.02 * uStack, l2 = exp(-ax / (uStreakL * 0.3));
        col += uStack * mix(vec3(1.0), uTint, 0.8) * l2 * 0.35 * (exp(-pow((ay - o) / w, 2.0)) + exp(-pow((ay - 2.1 * o) / w, 2.0)) * 0.5);
      }
    }
    if (uRays > 0.0) {
      // Dispersion: Rot, Grün und Blau je etwas anders gestreckt (Spektralsaum an den Spitzen), die Spitzen laufen ins
      // tiefe Blau aus
      vec3 kk = vec3(raySet(phi, r * 0.988), raySet(phi, r), raySet(phi, r * 1.012));
      vec3 tipc = mix(mix(vec3(1.0), uTint, 0.75), uDeep * 1.2, smoothstep(0.08, 0.7, r / max(uRayL, 1e-3)));
      col += tipc * kk * uRays * smoothstep(uSize * 0.6, uSize * 3.0 + 0.003, r);
      // Blendenstrahlen: acht feine Spitzen wie an einer Irisblende, dazu sechs schwächere, leicht gedreht
      if (uSpike > 0.0) {
        float sp = pow(abs(sin(4.0 * (phi + 0.3 * uRayRot))), 90.0) * exp(-r / (uRayL * 1.6))
                 + 0.45 * pow(abs(sin(3.0 * (phi - 0.4 * uRayRot + 0.5))), 120.0) * exp(-r / (uRayL * 2.4));
        col += mix(vec3(1.0), uTint, 0.5) * sp * uSpike * uRays * 0.5 * smoothstep(uSize * 0.8, uSize * 2.5, r);
      }
    }
    // Ring der Linse (schwacher Regenbogen-Geist um den Punkt), wächst mit der Spannung
    if (uRing > 0.0) {
      float rr = 0.22 + 0.05 * uRing;
      vec3 ring = vec3(exp(-pow((r - rr * 1.03) / 0.012, 2.0)), exp(-pow((r - rr) / 0.012, 2.0)), exp(-pow((r - rr * 0.97) / 0.012, 2.0)));
      col += ring * uRing * 0.01 * (0.7 + 0.3 * sin(phi * 3.0 + uTime * 0.4));   // dezent (User 28.10.2026: weniger Ringe)
    }
    // Lichtsog: Ring der Gravitationslinse zieht sich mit dem Luftholen in den Punkt, Lichtfäden stürzen hinein
    if (uSuck > 0.0) {
      float R = mix(0.5, uSize * 2.5, uFxP), th = 0.003 + 0.012 * (1.0 - uFxP);
      vec3 ring = vec3(exp(-pow((r - R * 1.02) / th, 2.0)), exp(-pow((r - R) / th, 2.0)), exp(-pow((r - R * 0.98) / th, 2.0)));
      col += mix(vec3(1.0), uTint, 0.5) * ring * uSuck * 0.12 * (0.25 + 0.75 * uFxP) * (0.75 + 0.25 * gnoise(vec3(phi * 3.0, uTime, 0.0)));
      float a = phi / 6.2831853 * 120.0, id = floor(a), f = fract(a) - 0.5;
      float h1 = hash12(vec2(id, 21.0)), h2 = hash12(vec2(id, 23.7)), h3 = hash12(vec2(id, 27.1));
      float head = (1.0 - fract(h2 + uTime * (0.25 + 0.35 * h3))) * 0.9, len = 0.06 + 0.25 * head;
      float perp = abs(f) * 6.2831853 / 120.0 * r, w = 0.0006 + 0.0018 * r;
      float along = smoothstep(head + len, head, r) * smoothstep(head - 0.01, head + 0.004, r);
      col += uTint * uSuck * 1.4 * step(0.55, h1) * exp(-pow(perp / w, 2.0)) * along * smoothstep(uSize * 2.0, uSize * 6.0, r);
    }
    // Pulswellen: jeder Herzschlag schickt einen Ring nach außen, beim Luftholen laufen sie in den Punkt zurück
    if (uPulseA > 0.0) {
      for (int i = 0; i < 3; i++) {
        float fi = float(i), age = fract(uPulse) + fi, R = mix(0.03 + 0.32 * age, (0.6 - 0.17 * fi) * (1.0 - uFxP), uFxIn);
        float g = mix(exp(-age * 1.3), (0.25 + 0.75 * uFxP) * (1.0 - 0.25 * fi), uFxIn), th = 0.003 + 0.012 * age * (1.0 - uFxIn);
        vec3 ring = vec3(exp(-pow((r - R * 1.015) / th, 2.0)), exp(-pow((r - R) / th, 2.0)), exp(-pow((r - R * 0.985) / th, 2.0)));
        col += mix(vec3(1.0), uTint, 0.6) * ring * g * uPulseA * 0.45;
      }
    }
    // Linsenreflexe: schwache farbige Scheiben auf der Linie Lichtpunkt → Bildmitte (Spiegelungen zwischen den Linsen),
    // nur bei hellem Kern; im Knall werden sie größer
    if (uGhost > 0.0) {
      vec2 pc = (vec2(0.5) - uC) * vec2(uAspect, 1.0);
      for (int i = 0; i < 4; i++) {
        float fi = float(i), g = -0.6 + 0.85 * fi;
        vec2 dp = p - pc * g;
        float rg = length(dp), R = 0.04 + 0.045 * fract(fi * 0.37 + 0.2) + 0.1 * uFillI;
        float disk = smoothstep(R, R * 0.82, rg) * (0.3 + 0.7 * smoothstep(R * 0.5, R, rg)) + 0.25 * exp(-rg / (R * 0.6));
        vec3 gc = i == 0 ? vec3(0.5, 0.9, 1.0) : i == 1 ? vec3(0.7, 0.55, 1.0) : i == 2 ? vec3(1.0, 0.8, 0.5) : vec3(0.55, 1.0, 0.75);
        col += gc * disk * uGhost * (0.5 + 0.5 * fract(fi * 0.61));
      }
    }
    if (uWarp > 0.0) {
      float w = warp(phi, r, 140.0, 2.0) + 0.6 * warp(phi + 0.011, r, 230.0, 6.0);
      col += mix(vec3(1.0), uTint, 0.55) * uWarp * w * smoothstep(uSize * 1.5, uSize * 4.0, r);
    }
    // Druckwelle: heller Ring mit leichtem Farbsaum, dahinter Licht
    if (uShock > 0.0) {
      float th = 0.006 + 0.03 * uShockR;
      vec3 ring = vec3(exp(-pow((r - uShockR * 1.012) / th, 2.0)), exp(-pow((r - uShockR) / th, 2.0)), exp(-pow((r - uShockR * 0.988) / th, 2.0)));
      col += (mix(vec3(1.0), uTint, 0.5) * ring + uTint * 0.06 * smoothstep(uShockR, 0.0, r)) * uShock;
    }
    // das Licht frisst sich von der Mitte nach außen: weiße Fläche mit weicher, blau gesäumter Front, zuletzt alles weiß
    if (uFillI > 0.0) {
      vec3 dq = vec3(cos(phi), sin(phi), uTime * 0.8);
      float fr = uFill * (1.0 + 0.12 * gnoise(dq * 3.0) + 0.05 * gnoise(dq * 11.0 + 4.0));
      // Feuerball statt flacher Fläche: turbulente Glut, die mitwächst (Muster in Feuerball-Radien), helle Adern,
      // weißer Kern, zum Rand hin blau; Helligkeit bleibt im Bereich, in dem das Tonemapping noch Zeichnung zeigt
      vec3 fq = vec3(p / max(fr, 0.06) * 2.4, uTime * 0.3);
      fq += 0.9 * vec3(gnoise(fq * 0.6), gnoise(fq * 0.6 + 3.7), 0.0);
      float tb = fbm(fq, 5), vein = pow(1.0 - min(1.0, abs(tb) * 2.6), 7.0);
      float inside = smoothstep(fr, fr * 0.5 - 0.01, r), kern = exp(-pow(r / max(fr * 0.14, 0.01), 2.0)), g = clamp(tb + 0.5, 0.0, 1.0);
      col *= 1.0 - 0.85 * inside * uFillI;   // der Feuerball verdeckt das grelle Kernlicht hinter sich
      // Farbtiefe: tiefes Blau in den Tälern, Cyan auf den Wölbungen, weiße Adern und ein kleiner weißer Kern
      vec3 fire = uDeep * (0.25 + 0.6 * g) + uTint * 1.4 * g * g + vec3(0.95, 0.97, 1.0) * (1.5 * vein + 1.2 * kern);
      col += fire * uFillI * inside;
      col += uTint * uFillI * 1.6 * exp(-pow((r - fr) / (0.05 + 0.15 * uFill), 2.0));
    }
    // Gasscheibe: Strahl durch die Kugel um den Punkt, Licht des Kerns fällt mit dem Abstand ab, das Gas schluckt etwas
    // Licht dahinter (liegt vor dem Feuerball)
    if (uGas > 0.0) {
      vec3 rd = rayDir(), oc = uCamPos - uO;
      float Rg = GAS_R * uGasS, b = dot(oc, rd), h = b * b - dot(oc, oc) + Rg * Rg;
      if (h > 0.0 && -b + sqrt(h) > 0.0) {
        float t0 = max(0.0, -b - sqrt(h)), t1 = -b + sqrt(h), dt = (t1 - t0) / float(NGAS), j = hash12(gl_FragCoord.xy + 3.0), T = 1.0;
        vec3 L = vec3(0.0);
        for (int i = 0; i < NGAS; i++) {
          vec3 x = oc + rd * (t0 + (float(i) + j) * dt);
          float d = length(x), dens;
          vec3 e;
          gasSample(uGasM * x / uGasS, dens, e);
          float sg = dens / uGasS, a = exp(-sg * dt);
          L += T * e * (uGasL / (1.0 + d * d * 0.35)) * (sg > 1e-4 ? (1.0 - a) / sg : dt) / uGasS;
          T *= a;
          if (T < 0.01) break;
        }
        col = col * mix(1.0, T, uGas) + L * uGas;
      }
    }
    col += mix(vec3(0.95, 0.97, 1.0), uTint * 1.3, smoothstep(0.35, 0.95, r)) * uFlash * 9.0;   // Weiß, zu den Ecken blau
  } else {
    // im Plasma: Strahl trifft von innen die Kugel der letzten Streuung um O (= Mitte der Station 10)
    vec3 rd = rayDir(), oc = uCamPos - uO;
    float b = dot(oc, rd), h = b * b - dot(oc, oc) + uR * uR;
    vec3 d = normalize(oc + rd * (-b + sqrt(max(h, 0.0))));
    float x = cmbValue(d, uDetail, uDipOn, uDip);
    // ferner Grund hinter dem Nebel: Glut nach Planck-Farbe mit langsamen Wogen, heiße Flecken des Musters heller
    // (stark übertrieben, echt ≈ 1/100.000)
    float wave = fbm(rd * 1.6 / uExpand + vec3(0.0, 0.0, uTime * 0.04), 3);
    vec3 far = satur(ember(uTemp * 1.6 * (1.0 + 0.12 * x * uContrast)) * uBright * (uGround + 0.12 * x * uContrast) * (1.0 + 0.4 * uFog * wave), 1.3);
    // dieselbe Schale wie in Station 10 (Innenseite 0,4, Rand am Fenster, im Fenster nichts)
    float c = dot(d, uCut);
    vec3 shell = c > uCutCos ? vec3(0.0) : cmbColor(x) * 0.26 * (0.5 + 0.5 * (1.0 - smoothstep(uCutCos - 0.04, uCutCos, c))) * uShellK;   // wie SHELL_FRAG in levels/cmb.js
    // Rekombination: das Plasma wird fleckig von der Bildmitte nach außen durchsichtig, die Front glüht kurz nach
    float rs = length((vUv - 0.5) * vec2(uAspect, 1.0)), n = 0.5 * gnoise(rd * 2.5) + 0.25 * gnoise(rd * 7.0 + 3.0);
    float m = smoothstep(0.0, 1.0, uFalse * 2.0 - 0.5 - rs * 0.3 + 0.45 * n), edge = 1.0 - abs(2.0 * m - 1.0);
    // Nebel: Strahl von der Kamera (uNebPos auf der Flugbahn, Feld-Einheiten) durch die Wolkenlandschaft (Würfel ±NEB_EXT;
    // Emission + Absorption je Schritt exakt integriert wie vol.js), Schritte nah fein und fern grob, Start je Bildpunkt
    // versetzt gegen Streifen; der Raum dehnt sich um die Kamera (Wolken wachsen auf sie zu)
    vec3 L = vec3(0.0);
    float T = 1.0, ex = 1.0 + 0.6 * (uExpand - 1.0);
    if (uNeb > 0.0) {
      float jit = 0.25 * hash12(gl_FragCoord.xy), s = NEB_S0 * pow(NEB_S1 / NEB_S0, jit / float(NSTEPS));
      for (int i = 0; i < NSTEPS; i++) {
        float s2 = NEB_S0 * pow(NEB_S1 / NEB_S0, (float(i) + 1.0 + jit) / float(NSTEPS)), dt = s2 - s;
        vec3 pp = uNebPos + rd * (s / ex);
        if (max(abs(pp.x), max(abs(pp.y), abs(pp.z))) < NEB_EXT1) {   // nur im gebackenen Würfel
          vec3 e;
          float sg;
          nebSample(pp, s, e, sg);
          float a = exp(-sg * dt);
          L += T * e * (sg > 1e-4 ? (1.0 - a) / sg : dt);
          T *= a;
          if (T < 0.004) break;
        }
        s = s2;
      }
      L = satur(L, 1.25);
    }
    // Nebel vor dem Grund; wo die Front durch ist, liegt die Schale ohne Nebel da
    col = L * (1.0 - m) + mix(T, 1.0, m) * mix(far, shell, m) + ember(3000.0) * pow(edge, 3.0) * 0.5 * sin(3.14159 * clamp(uFalse, 0.0, 1.0));
    // Netz der Materie (Galaxien-Ära): Fäden aus dem Grat-Rauschen des gebackenen Felds (cosmicweb.js) in der Kugel um
    // uWebC, Maßstab uWebS, Feld-Lage über uWebM; erst violette Keime, dann das Netz, auf dem die Galaxien sitzen
    if (uWeb > 0.0) {
      vec3 o2 = uCamPos - uWebC;
      float R2 = uWebS * 0.95, b2 = dot(o2, rd), c2 = dot(o2, o2) - R2 * R2, h2 = b2 * b2 - c2;
      if (h2 > 0.0 && -b2 + sqrt(h2) > 0.0) {
        float t0 = max(0.0, -b2 - sqrt(h2)), t1 = -b2 + sqrt(h2);
        const int N = 40;
        float dt = (t1 - t0) / float(N), ds = dt / uWebS, j = hash12(gl_FragCoord.xy + 7.0), tr = 1.0;
        vec3 Lw = vec3(0.0);
        for (int i = 0; i < N; i++) {
          vec3 q = uWebM * (o2 + rd * (t0 + (float(i) + j) * dt)) / uWebS;
          float front = smoothstep(0.95, 0.75, length(q));
          vec4 f = texture(uWebField, q * WEB_K + 0.5);
          float g = f.g * 2.0 - 1.0;
          float dn = pow(smoothstep(uThin, 0.95, f.r), 2.5) * smoothstep(-0.1, 0.4, g) * front;
          Lw += tr * mix(uWebA, uWebB, f.b) * dn * 6.5 * ds;
          tr *= exp(-dn * 2.5 * ds);
          if (tr < 0.01) break;
        }
        col += Lw * uWeb;
      }
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// Staub und Teilchen: je Teilchen ein Viereck entlang seiner Bildbahn (Bewegungsunschärfe aus zwei Lagen im Abstand der
// Belichtungszeit), Größe nach Tiefe plus Unschärfekreis (Bokeh: außerhalb der Schärfe große, schwache Scheiben)
const DUST_VERT = /* glsl */ `
uniform float uInh, uT, uBang, uShut, uPx, uAspect, uH, uFocus, uCoc, uVis, uLight, uHot, uGain, uSwirl, uIn, uA, uTau, uV, uC0, uPull, uSpin;
uniform vec3 uTintA, uTintB;
attribute vec3 aP;
attribute vec4 aD;   // Größe, Auftauchen, Helligkeit, Farbe
varying vec3 vU, vCol;
varying float vSize, vBokeh;
// Maßstab des Raums: in der Spannung langsamer Sog zum Punkt, beim Luftholen schnell zusammen, danach dehnt er sich aus –
// erst schlagartig, dann stetig
float scaleAt(float t) {
  float s = t - uBang;
  if (s < 0.0) { float p = smoothstep(uC0, uBang, t), k = smoothstep(uBang - uInh, uBang, t); return 1.0 - uPull * p * p - uIn * k * k; }
  return 1.0 - uPull - uIn + uA * (1.0 - exp(-s / uTau)) + uV * s;
}
// Drall: stetig, in der Spannung immer schneller (Winkel wächst kubisch), nach dem Knall wieder stetig
float spinAt(float t) { float L = max(uBang - uC0, 0.1); return t + uSpin * L * pow(clamp((t - uC0) / L, 0.0, 1.0), 3.0); }
vec3 posAt(float t) {
  float r = length(aP), a = uSwirl * spinAt(t) / (0.6 + r), c = cos(a), s = sin(a);   // innen schneller: nichts steht still
  return vec3(c * aP.x - s * aP.z, aP.y, s * aP.x + c * aP.z) * scaleAt(t);
}
void main() {
  vU = vec3(0.0); vCol = vec3(0.0); vSize = 1.0; vBokeh = 0.0;
  float on = smoothstep(aD.y, aD.y + 0.08, uVis);
  vec4 w1 = modelMatrix * vec4(posAt(uT), 1.0), w0 = modelMatrix * vec4(posAt(uT - uShut), 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * w1, c0 = projectionMatrix * viewMatrix * w0;
  if (on <= 0.0 || c1.w < 0.08) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (c0.w < 0.08) c0 = c1;
  vec2 k = vec2(uAspect, 1.0) * 0.5 * uH;
  vec2 P1 = c1.xy / c1.w * k, P0 = c0.xy / c0.w * k, V = P1 - P0;
  float depth = c1.w, len = min(length(V), 0.6 * uH);
  float size = clamp(aD.x * uPx / depth, 0.7, 5.0) + min(uCoc * abs(depth - uFocus) / depth, 24.0);
  vec2 dir = length(V) > 0.01 ? normalize(V) : vec2(1.0, 0.0), nrm = vec2(-dir.y, dir.x);
  P0 = P1 - dir * len;
  vec2 P = mix(P0, P1, position.x * 0.5 + 0.5) + dir * position.x * size + nrm * position.y * size;
  gl_Position = vec4(P / k, 0.0, 1.0);
  vU = vec3(position.x * (0.5 * len + size), position.y * size, 0.5 * len);
  vSize = size;
  vBokeh = smoothstep(2.5, 9.0, size);
  // vom Kern beleuchtet (nah hell), nach dem Knall selbst heiß; Energie auf Fläche und Spur verteilt
  float d = length(w1.xyz - modelMatrix[3].xyz);
  float e = (uLight / (1.0 + d * d * 0.08) + uHot * (0.6 + 0.4 * aD.z)) * aD.z * on;
  vec3 col = mix(uTintA, uTintB, aD.w);
  col = mix(col, vec3(1.0), clamp(uHot * 0.02 + step(0.86, aD.w) * 0.5, 0.0, 0.7));
  vCol = col * e * uGain / (size * size * 3.14159 * mix(0.35, 1.0, vBokeh) + 2.0 * size * len);
}`;
const DUST_FRAG = /* glsl */ `
varying vec3 vU, vCol;
varying float vSize, vBokeh;
void main() {
  float r = length(vec2(max(abs(vU.x) - vU.z, 0.0), vU.y)) / vSize;
  if (r >= 1.0) discard;
  float disk = smoothstep(1.0, 0.8, r) * (0.7 + 0.3 * r * r);   // Bokeh-Scheibe mit hellerem Rand wie bei echten Linsen
  gl_FragColor = vec4(vCol * mix(exp(-r * r * 5.0), disk, vBokeh), 1.0);
}`;

function createDust(n, rand) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const P = new Float32Array(n * 3), D = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    // dicht um den Punkt, dünn bis um die Kamera herum; Richtung gleichverteilt
    const r = rand() < 0.15 ? 0.3 + 2 * rand() : 1.5 + 13 * Math.pow(rand(), 1.2), z = 2 * rand() - 1, a = 2 * Math.PI * rand(), q = Math.sqrt(1 - z * z);
    P.set([r * q * Math.cos(a), r * z, r * q * Math.sin(a)], i * 3);
    D.set([0.004 + 0.012 * rand() ** 2, rand(), Math.exp((rand() - 0.7) * 2.4), rand()], i * 4);
  }
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(P, 3));
  g.setAttribute('aD', new THREE.InstancedBufferAttribute(D, 4));
  g.instanceCount = n;
  return g;
}

// Wolkenlandschaft des Nebels, einmal gebacken (vol.js bakeField, Würfel ±NEB_EXT): r = Wolkenkörper (0 = leerer Raum),
// g = Wärmeflecken, b = grobe Fäden, a = Warp (versetzt die feinen Fäden je Schritt). Die Wolken liegen entlang der
// Flugbahn (fwd = Flugrichtung, side/up = Seite und Hoch im Bild): Hauptwolke um den Start, zwei Säulen rechts, eine
// Seitenwolke links (von außen gesehen, durchleuchtet), Zielwolke am Ende, zarter Schleier oben, zwei dunkle Bahnen davor.
const NEB_EXT = 4.2;
// Flugbahn durch den Nebel in Feld-Einheiten je Anteil c (0 … 1): vorwärts entlang fwd, seitlich ein weicher Schwung
const NEB_ALONG = smoothKeys([[0, -2.7], [0.22, -1.5], [0.5, 0.3], [0.8, 1.7], [1, 2.4]]);
function nebulaField(fwd, side, upv) {
  const at = (a, b, c) => { const v = new THREE.Vector3().addScaledVector(fwd, a).addScaledVector(side, b).addScaledVector(upv, c); return `vec3(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`; };
  return /* glsl */ `
float blob(vec3 q, vec3 c, vec3 r) { vec3 d = (q - c) / r; return exp(-dot(d, d) * 1.4); }
vec4 field(vec3 p) {
  vec3 w = vec3(fbm(p * 1.6 + vec3(1.7, 9.2, 3.1), 3), fbm(p * 1.6 + vec3(8.3, 2.8, 5.6), 3), fbm(p * 1.6 + vec3(4.1, 6.6, 0.9), 3));
  vec3 q = p + 0.6 * w;   // kräftiger Warp: Schlieren, Wirbel und ausgefranste Ränder statt runder Klumpen
  float m = blob(q, ${at(-0.6, 0.35, -0.15)}, vec3(1.5, 1.2, 1.4)) + 0.6 * blob(q, ${at(-1.9, -1.3, 0.45)}, vec3(0.8, 0.7, 0.85))
          + 0.9 * blob(q, ${at(0.5, 1.25, -0.3)}, vec3(0.5, 1.8, 0.55)) + 0.75 * blob(q, ${at(0.9, 1.6, 0.4)}, vec3(0.4, 1.4, 0.45))
          + 0.95 * blob(q, ${at(1.5, -1.6, 0.5)}, vec3(1.35, 1.0, 1.25))
          + 0.95 * blob(q, ${at(2.7, 0.3, -0.2)}, vec3(1.25, 1.1, 1.35))
          + 0.3 * blob(q, ${at(0.8, 0.3, 1.7)}, vec3(2.6, 1.0, 2.2));
  float lanes = 0.85 * blob(q, ${at(0.1, -0.3, 0.25)}, vec3(1.1, 0.2, 1.2)) + 0.7 * blob(q, ${at(2.0, 0.9, 0.0)}, vec3(0.25, 1.5, 0.9));
  float n = fbm(q * 4.6, 3), rg = ridged(q * 3.0, 2);
  float body = clamp(m * (0.5 + 0.8 * n + 0.4 * rg) - lanes * 0.9, 0.0, 1.0);
  float box = smoothstep(${NEB_EXT.toFixed(2)}, ${(NEB_EXT - 0.8).toFixed(2)}, max(abs(p.x), max(abs(p.y), abs(p.z))));
  return vec4(body * box, fbm(p * 2.4 + vec3(13.0, 4.0, 7.0), 3), ridged(q * 7.0 + vec3(3.0, 1.0, 5.0), 3), w.x);
}`;
}
// Schritte und Oktaven der feinen Fäden je Qualitätsstufe (main.js QUALITY detail 0,55 / 0,8 / 1)
const NEB_Q = (detail) => (detail >= 0.9 ? { NSTEPS: 56, OCTF: 3 } : detail >= 0.7 ? { NSTEPS: 44, OCTF: 2 } : { NSTEPS: 30, OCTF: 2 });

// ctx: { detail, renderer }, station: { home, shell: { radius, uniforms }, opening } von Station 10 (levels/cmb.js), endLook =
// deren Look; ready = Feld des Nebels gebacken und Galaxien-Ära gebaut (vor dem ersten Bild abwarten)
export function createOpener(ctx, station, tune = { ...TUNE }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 4000);
  const O = station.home.target.clone();
  const axis = station.home.pos.clone().sub(O).normalize();
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(axis, up).normalize();
  const fwd = axis.clone().negate(), upv = new THREE.Vector3().crossVectors(fwd, side).normalize();   // Flug: Blick zur Mitte
  const homeDist = station.home.pos.distanceTo(O);
  const film = { t: 0, playing: false };
  let k = { ...tune }, M = marks(k), CV = openerCurves(M, k, homeDist);

  const su = station.shell.uniforms;
  const field = bakeField(ctx.renderer, { size: 128, extent: NEB_EXT, body: nebulaField(fwd, side, upv) });
  const bgU = {
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uO: { value: O },
    uC: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1 }, uTime: { value: 0 },
    uCore: { value: 0 }, uSize: { value: 0.001 }, uHalo: { value: 0 }, uSpread: { value: 1 }, uGlow: { value: 0 }, uStreak: { value: 0 }, uStreakW: { value: 0.002 }, uStreakL: { value: 0.1 },
    uRays: { value: 0 }, uRayL: { value: 0.1 }, uRayRot: { value: 0 }, uShock: { value: 0 }, uShockR: { value: 0 }, uFlash: { value: 0 },
    uWarp: { value: 0 }, uWarpT: { value: 0 }, uFill: { value: 0 }, uFillI: { value: 0 }, uRing: { value: 0 }, uStack: { value: 0 }, uGhost: { value: 0 }, uSpike: { value: 1 },
    uSuck: { value: 0 }, uPulseA: { value: 0 }, uFxP: { value: 0 }, uFxIn: { value: 0 }, uPulse: { value: 0 }, uJW: { value: 0 },
    uGas: { value: 0 }, uGasS: { value: 1 }, uGasL: { value: 0 }, uGasHot: { value: 0 }, uGasSpin: { value: 0 }, uGasArm: { value: 0 }, uCross: { value: 0 }, uCrossL: { value: 0.01 }, uTwinkle: { value: 0 }, uGasM: { value: new THREE.Matrix3() },
    uTint: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() },
    uPlasma: { value: 0 }, uTemp: { value: 40000 }, uBright: { value: 1 }, uContrast: { value: 0 }, uFog: { value: 1 }, uDetail: { value: 0 },
    uFalse: { value: 0 }, uExpand: { value: 1 }, uR: { value: station.shell.radius }, uShellK: { value: 1 },
    uNeb: { value: 0 }, uFil: { value: 1 }, uHot: { value: 1 }, uEdge: { value: 1 }, uThr: { value: 0 }, uAbs: { value: 1.6 }, uGround: { value: 0.1 }, uNebPos: { value: new THREE.Vector3() },
    uField: { value: field.texture },
    uWebField: { value: null }, uWebC: { value: new THREE.Vector3() }, uWebA: { value: new THREE.Vector3(0.42, 0.2, 0.95) }, uWebB: { value: new THREE.Vector3(0.95, 0.32, 0.85) },
    uWebM: { value: new THREE.Matrix3() }, uWebS: { value: 1 }, uWeb: { value: 0 }, uThin: { value: THIN },
    uCut: su.uCut, uCutCos: su.uCutCos, uDip: su.uDip, uDipOn: su.uDipOn,
  };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: bgU, depthTest: false, depthWrite: false,
    defines: { ...NEB_Q(ctx.detail), NEB_EXT1: NEB_EXT.toFixed(2), NEB_EXT2: (2 * NEB_EXT).toFixed(2), NEB_S0: '0.06', NEB_S1: '5.0', GAS_R: '4.2', NGAS: ctx.detail >= 0.9 ? 48 : 32, WEB_K: (1 / (2 * WEB_EXT)).toFixed(5) },
  }));
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  bg.onBeforeRender = (r, s, cam) => {
    bgU.uInvProj.value.copy(cam.projectionMatrixInverse);
    bgU.uCamWorld.value.copy(cam.matrixWorld);
    bgU.uCamPos.value.copy(cam.position);
  };
  scene.add(bg);

  let seed = 20261027;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dU = {
    uInh: { value: 1.2 }, uT: { value: 0 }, uBang: { value: M.bang }, uShut: { value: 0.02 }, uPx: { value: 600 }, uAspect: { value: 1 }, uH: { value: 900 },
    uFocus: { value: 10 }, uCoc: { value: 20 }, uVis: { value: 0 }, uLight: { value: 0 }, uHot: { value: 0 }, uGain: { value: 1 },
    uSwirl: { value: 0.05 }, uIn: { value: 0.16 }, uA: { value: 1.2 }, uTau: { value: 0.6 }, uV: { value: 0.6 }, uC0: { value: 0 }, uPull: { value: 0.12 }, uSpin: { value: 18 },
    uTintA: { value: new THREE.Color() }, uTintB: { value: new THREE.Color() },
  };
  const dust = new THREE.Mesh(createDust(Math.round(10000 * Math.max(0.5, ctx.detail)), rand), new THREE.ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: dU, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
  }));
  dust.frustumCulled = false;
  dust.position.copy(O);
  scene.add(dust);

  // Wirbel nach dem Knall: Galaxien und Lichtpunkte auf den Armen der Gasscheibe (vortex.js), Lage wie die Scheibe
  const atlas = galaxyAtlas();
  const kq = Math.max(0.6, ctx.detail);
  const swarm = createVortex(rand, atlas, { n: Math.round(7000 * kq), ng: Math.round(800 * kq), R: 4.2 });
  const sU = swarm.material.uniforms;
  swarm.position.copy(O);
  scene.add(swarm);

  // Galaxien-Ära: kosmisches Netz (cosmicweb.js, einmal auf der CPU) als Gruppe um C = Mitte − 10 auf der Fahrachse,
  // dichter Schlauch entlang der Fahrt (flightAxis → Fahrachse), Maßstab S wächst (der Raum dehnt sich); Fäden als
  // Strahlverfolgung im Hintergrund (uWebField), erste Sterne, Supernova-Blitze, Galaxien (jung klein und blau, reifen zu
  // Spiralen und Ellipsen) und ferne Lichtpunkte. Zeit der Ära e: 0 = klar, 1 = Ende des Flugs, im Rückzug > 1 (Reifung).
  const WEB_C = O.clone().addScaledVector(axis, -10);
  const era = new THREE.Group();
  era.position.copy(WEB_C);
  era.visible = false;
  scene.add(era);
  bgU.uWebC.value.copy(WEB_C);
  let crowd = null, webTex = null;
  async function buildEra() {
    const w = await bakeWeb(96, () => new Promise((r) => setTimeout(r, 0)));
    webTex = new THREE.Data3DTexture(w.data, w.size, w.size, w.size);
    webTex.minFilter = webTex.magFilter = THREE.LinearFilter;
    webTex.unpackAlignment = 1;
    webTex.needsUpdate = true;
    bgU.uWebField.value = webTex;
    const wr = mulberry32(11);
    const fdir = flightAxis(w, wr, [0.24, 0.1, 0.96]);
    era.quaternion.setFromUnitVectors(new THREE.Vector3(...fdir), axis);
    bgU.uWebM.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(era.quaternion.clone().invert()));
    const V = (s) => new THREE.Vector3(s.x, s.y, s.z);
    // Rang nach Dichte → Zeitpunkt: dicht = früh (frac 0 … 1)
    const ranked = (list) => list.sort((a, b) => b.d - a.d).map((s, i) => Object.assign(s, { frac: (i + wr()) / list.length }));
    // erste Sterne in den dichtesten Knoten (blauweiß, verlöschen, wenn die Galaxien übernehmen), dazu wenige
    // Supernova-Blitze (≈ 1 je Sekunde, kein Blitzen über 3 Hz)
    const sites = ranked(sampleWeb(w, wr, Math.round(1400 * kq), { power: 3, top: 0.2 }));
    const stars = glowPoints(sites.map((s) => ({ pos: V(s), size: 0.005, col: blackbody(18000 + wr() * 7000).map((v) => v * (1.4 + wr())),
      birth: 0.08 + 0.42 * Math.pow(s.frac, 1.3), end: 0.75 + wr() * 0.3 })));
    stars.material.uniforms.uFade.value = 0.12;
    const novae = glowPoints(Array.from({ length: 10 }, (_, i) => {
      const s = sites[Math.floor(wr() * Math.min(60, sites.length))], b = 0.18 + 0.6 * (i + wr()) / 10;
      return { pos: V(s), size: 0.03, col: blackbody(9000).map((v) => v * 6), birth: b, end: b + 0.02 };
    }));
    novae.material.uniforms.uFade.value = 0.008;
    // Galaxien: jung klein, blau, klumpig; reifen im Flug zu Spiralen, in dichten Knoten zu roten Ellipsen
    const galaxy = (s, near) => {
      const ell = s.d > 0.12 && wr() < 0.5, mat = ell ? TILES.ellip : TILES.spiral;
      return { pos: V(s), size: (near ? 0.009 : 0.01) * Math.exp(gauss(wr) * 0.35), gain: 1.6 + wr() * 1.4,
        tile: TILES.first[Math.floor(wr() * TILES.first.length)], tint: blackbody(14000 + wr() * 11000),
        tile2: mat[Math.floor(wr() * mat.length)], tint2: ell ? blackbody(3900 + wr() * 700) : blackbody(5600 + wr() * 2200),
        birth: near ? 0.3 + 0.4 * s.frac : 0.3 + 0.55 * Math.pow(s.frac, 1.6), mature: near ? 0.6 + 0.4 * s.frac : 0.75 + 0.5 * s.frac + wr() * 0.1,
        grow: 2.4 + wr() * 1.6, ...randTurn(wr) };
    };
    // nah an der Fahrachse eigene Galaxien (Schlauch um die Fahrt), damit der Flug dicht an ihnen vorbeiführt
    const far = ranked(sampleWeb(w, wr, Math.round(6000 * kq), { top: 0.15 }));
    const near = ranked(sampleWeb(w, wr, Math.round(2000 * kq), { top: 0.08, power: 0.6, pick: inTube(fdir, [-0.75, 0.95], [0.03, 0.16]) }));
    const gals = galaxySprites([...far.map((s) => galaxy(s, false)), ...near.map((s) => galaxy(s, true))], atlas);
    gals.material.uniforms.uFade.value = 0.12;
    gals.material.uniforms.uMature.value = 0.35;
    // ferne, schwache Galaxien als Lichtpunkte auf dem Netz
    const dots = glowPoints(ranked(sampleWeb(w, wr, Math.round(20000 * kq), { top: 0.1, power: 0.5 })).map((s) => ({
      pos: V(s), size: 0.0035, col: blackbody(4500 + wr() * 6000).map((v) => v * (0.4 + wr())), birth: 0.4 + 0.6 * Math.pow(s.frac, 1.3) })));
    dots.material.uniforms.uFade.value = 0.2;
    era.add(dots, stars, novae, gals);
    crowd = { stars, novae, gals, dots, all: [stars, novae, gals, dots], pts: [stars, novae, dots] };
    era.visible = true;
    await ctx.renderer.compileAsync(scene, camera);
    era.visible = false;
  }

  // Lage um O: Richtung der Heimpose um el gehoben und um az um die Hochachse gedreht, Abstand dist
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3(), _u = new THREE.Vector3();
  // Gasscheibe schräg zur Blickachse (um die Querachse gekippt), damit man auf sie schaut
  bgU.uGasM.value.setFromMatrix4(new THREE.Matrix4().makeRotationAxis(side, 1.15));
  sU.uM.value.copy(bgU.uGasM.value).transpose();
  // Stand vor dem Knall zur Filmzeit t: Spannung cg, Luftholen inh (zwei Atemzüge: zusammen, kurz loslassen, tiefer
  // zusammen), inP (Luftholen stetig 0 … 1), snap (Einrasten kurz vor dem Knall); s = Zeit seit dem Knall
  function phase(t) {
    const s = t - M.bang, cg = sstep(M.charge, M.inhale, t) * k.charge, Li = M.bang - 0.12 - M.inhale, i0 = M.inhale;
    const inh = s >= 0 ? 0 : clamp01(0.7 * sstep(i0, i0 + 0.35 * Li, t) - 0.45 * sstep(i0 + 0.35 * Li, i0 + 0.5 * Li, t) * (1 - sstep(i0 + 0.5 * Li, i0 + 0.7 * Li, t)) + 0.3 * sstep(i0 + 0.55 * Li, i0 + Li, t));
    return { s, cg, inh, Li, i0, snap: sstep(M.bang - 0.12, M.bang, t), inP: s >= 0 ? 1 : sstep(i0, M.bang - 0.05, t) };
  }
  // Wirbel (stetig, auch über den Knall): Drall des Gases (differentiell, rad bei r = 0,6), Musterdrehung der Arme (rad),
  // Maßstab der Scheibe (in der Spannung enger, beim Luftholen im Atemtakt, nach dem Knall rasch, dann stetig weiter)
  const gasSpin = (P, t) => 3 * k.swirl * (0.08 * t + 1.1 * P.cg * P.cg + 2.2 * P.inP + (P.s > 0 ? 0.6 * P.s : 0));
  const gasArm = (P, t) => k.swirl * (0.14 * t + 2.4 * P.cg * P.cg + 4.5 * P.inP + (P.s > 0 ? 1.1 * P.s : 0));
  const gasScale = (P, w = 1) => (P.s < 0 ? 1 - 0.12 * P.cg - 0.3 * P.inh * (1 - P.snap)
    : 1 - 0.12 * k.charge + w * (2 * (1 - Math.exp(-P.s / 1.1)) + 0.45 * P.s));
  // Galaxien und Lichtpunkte dehnen sich langsamer als das Gas, damit sie im Bild an der Kamera vorbeiziehen
  const SW = 0.55;
  const orbit = (cam, dist, az, el) => {
    _v.copy(axis).applyAxisAngle(side, el).applyAxisAngle(up, az);
    cam.position.copy(O).addScaledVector(_v, dist);
  };
  // Handkamera: langsames Schweben (Summe unharmonischer Sinus), nach dem Knall Wackeln, das schnell abklingt
  const wob = (t, a, b, c) => Math.sin(t * a) * 0.5 + Math.sin(t * b + 1.7) * 0.3 + Math.sin(t * c + 4.1) * 0.2;

  const look = { ...LOOK, sh: [...LOOK.sh], hi: [...LOOK.hi] };
  const END = station.look || {};
  const endLook = Object.fromEntries(Object.keys(LOOK).map((key) => [key, END[key] ?? LOOK[key]]));
  const FILM = { exposure: 1, bloom: 0.13, sat: 1.12, con: 0.14, sh: [0.97, 0.99, 1.04], hi: [1.0, 1.0, 1.02], vig: 0.5, ca: 0.011, grain: 0.022 };

  function setTune(t) {
    k = { ...TUNE, ...t };
    M = marks(k);
    CV = openerCurves(M, k, homeDist);
    const a = new THREE.Color().setHSL(k.hue / 360, k.sat, 0.55), b = new THREE.Color().setHSL((k.hue + 14) / 360, Math.min(1, k.sat + 0.1), 0.42);
    bgU.uTint.value.copy(a);
    bgU.uDeep.value.copy(b);
    dU.uTintA.value.setHSL((k.hue - 8) / 360, k.sat * 0.9, 0.6);
    dU.uTintB.value.setHSL((k.hue + 10) / 360, k.sat, 0.5);
    dU.uBang.value = M.bang;
    dU.uInh.value = M.bang - M.inhale;
    dU.uC0.value = M.charge;
    dU.uPull.value = 0.12 * k.charge;
    dU.uSpin.value = 18 * k.charge;
    dU.uA.value = 1.2 * k.burst;
    dU.uV.value = 0.6 * k.burst;
  }
  setTune(tune);

  // Stand zur Filmzeit t: Uniforms, eigene Kamera (bis weiß) bzw. Kamera der Station (danach), Überblendung, Look
  const out = { view: 'own', mix: 0, rise: 0 };
  function apply(lv) {
    const t = film.t, u = clamp01((t - M.start) / (M.bang - M.start)), s = t - M.bang, f = sstep(M.bang, M.white, t), fb = clamp01(s / (M.white - M.bang));
    bgU.uTime.value = t;
    dU.uT.value = t;
    dU.uShut.value = k.blur * rateAt(k, M, t) / 96;   // 180°-Verschluss bei 48 Bildern/s
    out.view = t < M.white ? 'own' : 'level';
    bgU.uPlasma.value = out.view === 'own' ? 0 : 1;
    dust.visible = out.view === 'own';

    // Vorspann: erst Schwarz, dann ein winziger ferner Lichtpunkt, der funkelt und immer schneller wächst (ign 0 … 1);
    // an seinem Ende steht genau der Lichtpunkt, mit dem der Aufbau beginnt
    const em = sstep(Math.min(1.4, 0.2 * M.start), M.start, t), ign = M.start > 0 ? Math.pow(em, 1.6) : 1;
    // Licht vor dem Knall: wächst; in der Spannung heller und pulsierend (Herzschlag, Takt steigt von 0,6 auf 1,9 Hz –
    // sanft, kein Blitzen), beim Luftholen (zwei Atemzüge) dunkelt es ab und zieht sich zusammen, dann der Knall
    const P = phase(t), { cg, inh, snap, inP, Li, i0 } = P;
    const Tc = M.inhale - M.charge, xc = Math.min(Math.max(0, t - M.charge), Tc), ph = 0.6 * xc + 0.65 * xc * xc / Tc;
    const beat = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * ph), 6) * cg * (1 - inh);
    const grow = (Math.exp(3 * u) - 1) / (Math.exp(3) - 1);
    const I = (0.3 * ign + 0.7 * grow) * (1 + 0.35 * cg) * (1 + 0.16 * beat) * (1 - 0.55 * inh * (1 - snap));
    // Knall: Zündung, dann zwei Nachstöße im Kern (weich, ≥ 1 s auseinander – kein Blitzen); der Kern wächst nur mäßig,
    // das Bild trägt der Feuerball
    const kick = (a, w) => (s > a ? sstep(a, a + 0.25, s) * Math.exp(-(s - a) / w) : 0);
    const pop = kick(0, 0.9) + 0.55 * kick(1.2, 0.6) + 0.35 * kick(2.4, 0.5);
    const boom = s > 0 ? (1 + 2 * pop) * (1 + 4 * Math.pow(fb, 2.2)) : 1;
    const fov = lerp(32, 28, ease(u)) + 5 * inh * (1 - snap) + 26 * Math.pow(sstep(0.3, 1, fb), 1.6);

    // eigene Kamera: Anfahrt (push), Bogen (drift), in der Spannung näher, beim Luftholen Dolly-Zoom (näher, weiter Winkel),
    // beim Knall Rückstoß, danach ins Licht gezogen und dabei gedreht
    let D = 12 * (1 + 0.4 * (1 - ease(em))) * (1 - 0.3 * k.push * sstep(0, 1, u)) * (1 - 0.12 * k.push * cg) * (1 - 0.1 * inh * (1 - snap));
    // Knall: weicher Rückstoß (Kamera weicht zurück und kommt zur Ruhe), dann langsamer Sog ins Licht
    const recoil = s > 0 ? sstep(0, 0.6, s) * Math.exp(-s / 1.4) : 0;
    D *= 1 + 0.25 * k.shake * recoil;
    // Flug in den Wirbel: gleich nach dem Rückstoß zieht es die Kamera hinein, Galaxien und Gas ziehen an ihr vorbei
    D *= Math.exp(-3 * Math.pow(sstep(0.1, 1, fb), 1.35));
    camera.fov = fov;
    camera.updateProjectionMatrix();
    // Bogen um den Punkt: im Aufbau langsam, im Knall umkreist die Kamera den Feuerball (Staub zeigt die Tiefe)
    orbit(camera, D, k.drift * (lerp(0.12, 0.03, ease(u)) + 0.1 * (1 - ease(em)) - 0.04 * cg - 0.45 * ease(fb)), k.drift * (lerp(0.05, 0.015, u) + 0.16 * sstep(0, 1, fb)));
    // Schweben aus langsamen Sinus statt Zittern; der Druckstoß als eine gedämpfte Schwingung (≈ 1 Hz, wie eine
    // Kamerakran-Federung), nicht als Rütteln
    const sway = s > 0 ? k.shake * 0.012 * sstep(0, 0.3, s) * Math.exp(-s / 1.3) : 0;
    const hand = 0.006 * k.drift * (1 + 0.5 * cg);
    _t.copy(O)
      .addScaledVector(side, D * (hand * wob(t, 0.31, 0.53, 0.89) + sway * Math.sin(2 * Math.PI * 0.9 * s)))
      .addScaledVector(up, D * (hand * wob(t + 7, 0.27, 0.47, 0.83) + sway * 0.7 * Math.sin(2 * Math.PI * 1.15 * s + 1.1)));
    const roll = k.drift * 0.01 * wob(t, 0.13, 0.21, 0.37) + 2.5 * sway * Math.sin(2 * Math.PI * 0.6 * s + 0.4) + 0.14 * k.drift * Math.pow(sstep(0.3, 1, fb), 1.6);
    camera.up.set(0, 1, 0).applyAxisAngle(_v.copy(axis), roll);
    camera.lookAt(_t);
    camera.updateMatrixWorld();

    // Lichtpunkt: Bildort, Kern als Anteil der Bildhöhe, Linse
    const p = _t.copy(O).project(camera);
    bgU.uC.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
    const pinch = 1 - 0.45 * inh * (1 - snap);
    const lit = sstep(0, 0.3, em);
    bgU.uSize.value = (0.001 + 0.0015 * ign + 0.009 * I) * pinch * boom;
    bgU.uCore.value = k.core * (20 + 50 * I) * (1 + 3 * pop) * (1 - 0.75 * sstep(0.25, 0.8, fb)) * lit;
    bgU.uHalo.value = k.core * (0.35 * ign + 3.6 * I) * (1 + 1.5 * pop) * (1 - 0.6 * f) * lit;
    bgU.uSpread.value = 1 + 0.15 * (boom - 1) / 11;
    bgU.uTwinkle.value = 0.22 * lit * (1 - sstep(0.4, 1, em));
    bgU.uCross.value = k.core * 0.35 * sstep(0.25, 0.8, em) * (1 - sstep(0, 0.1, u));
    bgU.uCrossL.value = 0.004 + 0.05 * ign;
    bgU.uGlow.value = k.core * (0.01 * ign + 0.22 * I * I) * (1 + 2 * pop) * (1 - 0.5 * f);
    bgU.uStreak.value = k.streak * (0.3 + 2.2 * I) * sstep(0.01, 0.08, u) * (1 + 1.5 * f + 3 * pop) * (1 - 0.4 * inh * (1 - snap));
    bgU.uStreakL.value = k.streakLen * (0.2 + 0.8 * sstep(0.02, 0.4, u)) * (1 + 0.4 * cg) * (1 - 0.6 * inh * (1 - snap)) * (1 + 3 * sstep(0, 1.0, s));
    bgU.uStreakW.value = (0.0013 + 0.0025 * I) * (1 + 6 * f * f);
    bgU.uStack.value = s > 0 ? k.streak * sstep(0, 0.5, s) * (1 - sstep(0.55, 0.9, fb)) : 0;
    bgU.uRays.value = k.rays * sstep(0.08, 0.3, u) * (0.15 + 1.8 * Math.pow(I, 1.6)) * (1 + 0.15 * cg) * (1 + 0.6 * f + 0.8 * pop);
    bgU.uRayL.value = k.rayLen * (0.03 + 0.14 * Math.pow(I, 1.5)) * (1 + 0.25 * cg) * (1 - 0.5 * inh * (1 - snap)) * (1 + 3.5 * sstep(0, 1.0, s));
    bgU.uRayRot.value = 0.018 * t + 0.08 * cg * cg + (s > 0 ? 0.05 * s : 0);
    bgU.uRing.value = (cg * (1 - inh) + 2 * pop) * k.core;
    bgU.uGhost.value = k.ghosts * 0.03 * I * (1 + 1.5 * cg) * (1 + 2 * pop) * lit * (1 - 0.6 * f) * (1 - 0.5 * inh * (1 - snap));
    bgU.uSpike.value = k.spikes;
    bgU.uWarp.value = s > 0 ? k.warp * 0.9 * sstep(0.1, 0.7, s) * (1 - sstep(0.75, 0.98, fb)) : 0;
    bgU.uWarpT.value = s > 0 ? s * (0.5 + 0.35 * s) : 0;
    bgU.uFill.value = 1.8 * Math.pow(sstep(0.5, 1, fb), 1.8);
    bgU.uFillI.value = sstep(0.5, 0.66, fb);
    bgU.uShock.value = s > 0 ? k.shock * 0.25 * Math.exp(-s / 0.6) * sstep(0, 0.05, s) : 0;
    bgU.uShockR.value = s > 0 ? 0.02 + 1.4 * (1 - Math.exp(-s / 0.7)) : 0;
    bgU.uFlash.value = 0.15 * Math.pow(sstep(0.93, 1, fb), 2);   // nur ein Hauch Weiß als Brücke ins Plasma
    // Kipppunkt: Lichtsog und Pulswellen (beim Knall eine Druckwelle), Stille = Licht wird klein (Look unten)
    const pre = s < 0 ? 1 : 1 - sstep(0, 0.4, s), hush = k.hush * inh * (1 - snap);
    bgU.uFxP.value = inP;
    bgU.uFxIn.value = sstep(i0 - 0.3, i0 + 0.3, t);
    bgU.uSuck.value = k.suck * (0.35 * cg + 1.2 * inh) * pre;
    bgU.uPulseA.value = k.pulse * (0.8 * cg + 0.8 * inh) * pre;
    bgU.uPulse.value = ph;
    if (s > 0) {
      bgU.uShock.value += k.pulse * 0.3 * Math.exp(-s / 0.9) * sstep(0, 0.05, s);
      bgU.uShockR.value = 0.02 + 1.4 * (1 - Math.exp(-s / (k.shock > 0 ? 0.7 : 0.9)));
    }
    bgU.uCore.value *= 1 - 0.5 * hush;
    bgU.uRays.value *= 1 - 0.6 * hush;
    bgU.uStreak.value *= 1 - 0.5 * hush;
    // nach dem Knall klingt das grelle Licht rasch ab, der Blick wird frei für den Flug in den Wirbel
    const calm = s > 0 ? sstep(0.25, 1.4, s) * (1 - sstep(0.6, 0.9, fb)) : 0;
    bgU.uCore.value *= 1 - 0.85 * calm;
    bgU.uSize.value *= 1 - 0.55 * calm;
    bgU.uHalo.value *= 1 - 0.85 * calm;
    bgU.uGlow.value *= 1 - 0.7 * calm;
    bgU.uRays.value *= 1 - 0.95 * calm;
    bgU.uStreak.value *= 1 - 0.85 * calm;
    bgU.uStack.value *= 1 - calm;
    bgU.uGhost.value *= 1 - calm;
    bgU.uWarp.value *= 1 - 0.6 * calm;
    // Wirbel (Gasscheibe): im Aufbau sichtbar, mit der Spannung zum Punkt gezogen und immer schneller gedreht, beim
    // Luftholen eng zusammen, im Knall glühend nach außen gerissen – die Kamera fliegt hinein, bis der Feuerball übernimmt
    bgU.uGas.value = out.view === 'own' ? k.disk * sstep(0.15, 0.45, u) * (1 - 0.6 * sstep(0.6, 0.95, fb)) : 0;
    bgU.uGasS.value = gasScale(P);
    bgU.uGasL.value = 0.75 * (0.25 + 1.6 * I) * (1 + 1.2 * pop) * (1 + 0.8 * f);
    bgU.uGasHot.value = s > 0 ? 0.8 * sstep(0, 0.3, s) * Math.exp(-s / 1.8) : 0;
    bgU.uGasSpin.value = gasSpin(P, t);
    bgU.uGasArm.value = gasArm(P, t);
    // Galaxien und Lichtpunkte im Wirbel: zünden mit dem Knall von innen nach außen, drehen und dehnen sich mit dem Gas
    // (Lage eine Belichtungszeit zuvor für die Spur), blenden mit dem Feuerball aus
    const PB = phase(M.bang), tp = t - dU.uShut.value, P0 = phase(tp);
    swarm.visible = out.view === 'own' && s > 0 && k.swarm > 0;
    sU.uOn.value = sstep(0.05, 2.2, s);
    sU.uS.value = gasScale(P, SW);
    sU.uS0.value = gasScale(P0, SW);
    sU.uSpin.value = gasSpin(P, t) - gasSpin(PB, M.bang);
    sU.uSpin0.value = gasSpin(P0, tp) - gasSpin(PB, M.bang);
    sU.uArmB.value = gasArm(PB, M.bang);
    sU.uGain.value = k.swarm * sstep(0, 0.4, s) * (1 - sstep(0.72, 0.97, fb));
    bgU.uJW.value = k.webb;

    // Staub: tritt mit der Spannung ins Licht (zum Punkt gesogen, Drall), nach dem Knall alles; Schärfe auf dem Punkt
    dU.uVis.value = (s > 0 ? 0.4 + 0.7 * sstep(0, 0.9, s) : Math.max(0.1 * sstep(0.45, 1, em), 0.4 * Math.pow(sstep(0.4, 1.0, u), 1.2))) * Math.min(1, k.dust);
    dU.uLight.value = (0.1 + 2.2 * I) * (1 + 4 * f + 3 * pop);
    dU.uHot.value = s > 0 ? 22 * sstep(0, 0.35, s) * Math.exp(-s / 1.6) : 0;
    dU.uGain.value = Math.max(1, k.dust);
    dU.uFocus.value = D;
    dU.uCoc.value = 9 * k.bokeh;
    dU.uPx.value = dU.uH.value / (2 * Math.tan(fov * DEG / 2));
    sU.uPx.value = dU.uPx.value;

    // Nebel: kühlt nach Planck (22.000 K → 3.000 K), anfangs dichter Dunst, aus dem Fäden und Adern hervortreten; die
    // Kamera fliegt auf ihrer Bahn durch die Wolkenlandschaft (uNebPos), der Raum dehnt sich; ab 60 % lichtet sich der
    // Nebel (dünner, durchsichtig), das Muster wird deutlich, dann Rekombination in die Falschfarbe
    const c = clamp01((t - M.cool) / k.plasma), lift = sstep(0.6, 0.95, c);
    const T = Math.exp(lerp(Math.log(22000), Math.log(3000), sstep(0, 0.7, c)));
    bgU.uTemp.value = T;
    bgU.uBright.value = lerp(0.75, 1.05, sstep(0.05, 0.35, c));
    bgU.uContrast.value = lerp(0.15, 1, sstep(0.3, 0.75, c));
    bgU.uFog.value = 1 - sstep(0.5, 0.9, c);
    bgU.uDetail.value = sstep(0.35, 0.9, c);
    bgU.uFalse.value = sstep(0.72, 1.0, c);
    bgU.uExpand.value = 1 + 1.2 * sstep(M.white, M.clear, t);
    bgU.uNeb.value = k.neb * lerp(0.7, 1, sstep(0, 0.2, c)) * (1 - lift);
    bgU.uThr.value = lerp(0.2, 0.24, sstep(0, 0.35, c)) + 0.15 * lift;   // dichte Klumpen bleiben selten, dazwischen dünnes Gas und dunkle Leere
    bgU.uAbs.value = 1.4 * (1 - sstep(0.55, 0.92, c));
    // aus dem Weiß: heller Grund, der binnen 1 s in die dunkle Leere abdunkelt; im dunklen Zeitalter erlischt er ganz
    bgU.uGround.value = lerp(0.1, 0.06, sstep(0.5, 0.95, c)) * (1 - sstep(M.clear, M.dawn, t)) + 0.4 * (1 - sstep(0, 0.04, c));
    bgU.uFil.value = k.fil * lerp(0.6, 1, sstep(0.05, 0.4, c));
    bgU.uHot.value = k.hot * lerp(0.5, 1.15, sstep(0.1, 0.6, c));
    bgU.uEdge.value = k.edge * lerp(0.4, 1, sstep(0.1, 0.5, c));
    bgU.uNebPos.value.copy(fwd).multiplyScalar(NEB_ALONG(c) * k.flow)
      .addScaledVector(side, 0.45 * Math.sin(1.3 * Math.PI * c)).addScaledVector(upv, 0.25 * Math.sin(0.8 * Math.PI * c + 1) - 0.1);

    // Galaxien-Ära: Zeit e (0 = klar, 1 = Ende des Flugs), Maßstab des Felds, Helligkeiten; auf dem Rückzug blendet sie
    // in die Galaxien der Station über (gfade), das Netz glimmt erst als violette Keime
    const e = (t - M.clear) / (M.gal - M.clear), dcam = CV.d(t), S = CV.S(t), gfade = 1 - sstep(10, 40, dcam);
    era.visible = out.view === 'level' && e > -0.05 && gfade > 0.001 && !!crowd;
    era.scale.setScalar(S);
    if (crowd) {
      for (const mm of crowd.all) { mm.material.uniforms.uT.value = e; mm.material.uniforms.uS.value = S; }
      crowd.stars.material.uniforms.uGain.value = 2.5 * k.stars * gfade;
      crowd.novae.material.uniforms.uGain.value = k.stars * gfade;
      crowd.gals.material.uniforms.uGain.value = 2 * k.gal * gfade;
      crowd.dots.material.uniforms.uGain.value = k.gal * gfade;
      if (lv) { const px = dU.uH.value / (2 * Math.tan(lv.camera.fov * DEG / 2)); for (const mm of crowd.pts) mm.material.uniforms.uPx.value = px; }
    }
    bgU.uShellK.value = 1 - 0.9 * sstep(M.clear, M.dawn, t) * (1 - sstep(12, 40, dcam));
    bgU.uWebS.value = S;
    bgU.uWeb.value = out.view === 'level' && webTex ? k.web * (0.4 * sstep(M.clear, M.dawn, t) + 0.5 * sstep(M.dawn, M.gal, t)) * gfade : 0;
    bgU.uThin.value = THIN - 0.08 * (1 - sstep(M.dawn, M.gal, t));

    // Kamera der Station ab weiß, eine durchgehende Fahrt ohne Halt (flightplan.js openerCurves): nahe der Mitte durch den
    // Nebel (leichter Schwenk), Sturzflug durch die Galaxien, Wende im Bogen, Rückzug rückwärts in die Heimpose; dazu das
    // Schweben der Handkamera (Ort und Blickziel verschoben, Rollen), das am Ende ausläuft
    if (lv && out.view === 'level') {
      const pan = 1 - sstep(M.clear, M.dawn, t), sw = CV.sway(t) * k.drift, farT = CV.far(t);
      const az = (CV.az(t) + 7 * k.drift * pan * Math.sin(0.35 * (t - M.white))) * DEG;
      const el = (CV.el(t) + 4 * k.drift * pan * Math.sin(0.27 * (t - M.white) + 1)) * DEG;
      _v.copy(axis).applyAxisAngle(side, el).applyAxisAngle(up, az);
      _s.crossVectors(_v, up).normalize();
      _u.crossVectors(_s, _v).normalize();
      const hx = sw * wob(t, 0.23, 0.41, 0.67), hy = sw * wob(t + 5, 0.19, 0.37, 0.59);
      lv.camera.position.copy(O).addScaledVector(_v, dcam).addScaledVector(_s, hx).addScaledVector(_u, hy);
      _t.copy(O).addScaledVector(_v, -farT).addScaledVector(_s, hx * 0.7).addScaledVector(_u, hy * 0.7);
      lv.camera.up.copy(up).applyAxisAngle(_v, CV.roll(t) * k.drift * wob(t, 0.11, 0.19, 0.31));
      lv.camera.lookAt(_t);
      lv.camera.updateMatrixWorld();
      if (lv.target) lv.target.copy(O);
      out.mix = sstep(26, 42, dcam);
      out.rise = sstep(14, 40, dcam);
    } else { out.mix = 0; out.rise = 0; }
    if (lv && lv.opening) lv.opening(out.view === 'level' ? out.rise : 1);

    // Look: Film-Look; Spannung = mehr Farbsaum, Glühen und atmende Vignette, Knall = Farbsaum-Schlag, im Plasma Anpassung
    // des Auges, im dunklen Zeitalter dunkler, im Rückzug Übergang auf den Look der Station
    const a = sstep(M.gal, M.end - 0.5, t), tl = 1 - sstep(M.gal, M.end, t);
    for (const key of Object.keys(LOOK)) {
      const x = FILM[key], y = endLook[key];
      look[key] = Array.isArray(x) ? x.map((v, i) => lerp(v, y[i], a)) : lerp(x, y, a);
    }
    const flare = 1 + 0.5 * sstep(0.6, 1, f);
    const adapt = Math.exp(lerp(Math.log(1.25), 0, sstep(-0.04, 0.25, c)));
    const dark = 1 - 0.3 * sstep(M.clear, M.dawn, t) * (1 - sstep(M.dawn, M.dawn + 0.5 * k.galaxies, t));
    look.exposure = (out.view === 'own' ? FILM.exposure * flare : adapt * dark * lerp(1, endLook.exposure, a)) * lerp(1, k.exposure, tl);
    look.bloom = (out.view === 'own' ? FILM.bloom + 0.05 * cg + 0.1 * pop - 0.04 * f : lerp(lerp(0.15, 0.17, sstep(M.clear, M.gal, t)), endLook.bloom, a)) * lerp(1, k.bloom, tl);
    look.grain *= lerp(1, k.grain, tl);
    // Farbsaum: in der Spannung und im Knall kräftig, im Flug durch den Wirbel zurückgenommen (sonst Regenbogenränder)
    look.ca *= lerp(1, k.ca, tl) * (out.view === 'own' ? 1 + (1.2 * cg + 4 * pop + 1.5 * f) * (1 - 0.9 * calm) : 1);
    if (out.view === 'own') {
      // Stille vor dem Knall: Farbe weicht, Vignette schließt, Farbsaum und Korn; mit dem Knall kehrt die Farbe satt zurück
      const hush = k.hush * inh * (1 - snap);
      look.sat *= 1 - 0.25 * hush + 0.35 * k.hush * (s > 0 ? sstep(0, 0.4, s) * Math.exp(-s / 1.5) : 0);
      look.ca *= 1 + 3 * hush;
      look.vig *= 1 + 1.4 * hush;
      look.grain *= 1 + 1.5 * hush;
      look.exposure *= 1 - 0.25 * hush;
    }
    look.vig *= lerp(1, k.vig, tl) * (out.view === 'own' ? (1 + 0.25 * beat + 0.3 * inh * (1 - snap)) * (1 - 0.7 * f) : lerp(0.3, 1, sstep(M.cool, M.clear, t)));   // im Weiß keine grauen Ecken
    return out;
  }

  return {
    scene, camera, film, look, out, apply, setTune, ready: Promise.all([field.ready, buildEra()]), get marks() { return M; }, get tune() { return k; },
    get done() { return film.t >= M.end; },
    advance(dt) { if (film.playing) film.t = Math.min(M.end, film.t + dt * rateAt(k, M, film.t)); },
    // Filmzeit nach real Sekunden Abspielen (Vorschau: Bilder in echter Zeit)
    filmAt(real) { let t = 0; for (let x = 0; x < real; x += 1 / 240) t = Math.min(M.end, t + rateAt(k, M, t) / 240); return t; },
    // Größe des Bilds (Pixel des Ziels) und Seitenverhältnis des Fensters; eigene Kamera mittig im Fenster
    setSize(w, h) {
      camera.aspect = w / h;
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
      bgU.uAspect.value = w / h;
      dU.uAspect.value = w / h;
      dU.uH.value = h;
      swarm.material.uniforms.uAspect.value = w / h;
      swarm.material.uniforms.uH.value = h;
    },
    dispose() {
      bg.geometry.dispose(); bg.material.dispose(); dust.geometry.dispose(); dust.material.dispose(); swarm.geometry.dispose(); swarm.material.dispose();
      era.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      field.dispose(); if (webTex) webTex.dispose(); atlas.dispose();
    },
  };
}
