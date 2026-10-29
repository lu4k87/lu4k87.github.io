// Station 1: Erde und Mond, maßstäblich (Einheit 1.000 km). Stand für den aktuellen Zeitpunkt: Sonnenrichtung aus den
// JPL-Bahnelementen, Erddrehung aus der Sternzeit Greenwich, Mondort aus der Almanach-Näherung (astro.js).
// Erde: Tagkarte bis 16k (NASA Blue Marble) mit Geländerelief und weichem Terminator, Sonnenglitzern mit Windfeldern und Fresnel-Schimmer der Ozeane, Wolken als eigene Kugelschicht mit
// Schattenwurf auf den Boden, Stadtlichter mit warmem Hof auf der Nachtseite, Atmosphäre als Hülle mit Einfachstreuung
// (planetfx.js: Rayleigh-Blau, rot-oranges Dämmerungsband, weicher Glanz über den Rand, grünes Nachtleuchten).
// Polarlichter: Vorhänge mit feinen Strahlen + breite, weiche Glow-Lage im Oval.
// Mond: gebundene Rotation, Lommel-Seeliger-Reflexion, Erdschein. Himmel: echter Sternkatalog (Yale BSC, 5.044 Sterne)
// mit Sternbildlinien und Namen (catalog.js); Schattenkegel von Erde und Mond (Finsternis-Geometrie), Bahnen von ISS
// und geostationären Satelliten, Linsenreflex der Sonne (flare.js). Shader der Erde exportiert für die Orbit-Stationen (orbitview.js).

import * as THREE from 'three';
import { PLANETS, julianDate, planetPosition, eclToScene, eclDir, moonPosition, gmst, OBLIQUITY, DAY, AU, R_SUN, hideBehind } from '../astro.js';
import { createStarfield } from '../stars.js';
import { createCatalogSky, createConstellationLines, BRIGHT, CONST_INFO } from '../catalog.js';
import { createFlare } from '../flare.js';
import { settings } from '../settings.js';
import { SKY_VERTEX, NOISE } from '../glsl.js';
import { loadSats, createSats, satPos, orbitLine, namedIndex, KIND_COLOR } from '../sats.js';
import { speedAt, RE } from '../orbit.js';
import { registerLayers } from '../layers.js';
import { nbsp } from '../figs.js';
import { SHELL_VERT, ATMO_FRAG, CLOUD_FRAG, rayleighUniform } from '../planetfx.js';
import { spinAxis } from '../axes.js';
import { loadL2, trackAt } from '../l2track.js';

const R_E = 6.371, R_M = 1.7374;   // NASA Fact Sheets [1.000 km]
const R_ATM = R_E * 1.065;         // sichtbare Hülle ≈ 410 km (echt: Dichte fällt mit ≈ 8 km Skalenhöhe, Saum ≈ 100 km; dicker gezeichnet, damit der Glanz weich ausläuft)
const R_CLOUD = R_E * 1.006;       // Wolkenschicht ≈ 38 km (echt meist < 12 km; höher gezeichnet, damit Schicht und Schatten sichtbar werden)
const GEO = 42.164;                // geostationärer Bahnradius [1.000 km]
const ISS = { r: R_E + 0.42, inc: 51.64 };   // ISS: ≈ 420 km Höhe, 51,64° Bahnneigung (NASA)
const SUN_D = AU / 1e6, SUN_R = R_SUN / 1e6;  // Sonnenabstand und -radius [1.000 km]
const RAD = Math.PI / 180;
const SKY_R = 3000;                // Richtungen des Himmels als Punkte „weit draußen“ (für Beschriftungen)

export const EARTH_VERT = /* glsl */ `
varying vec3 vN, vP;
varying vec2 vUv;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
// Erde mit Objektposition vO (Rauschen in Feinstruktur, Wellen und Wolkenrändern)
export const EARTH_VERT_O = EARTH_VERT.replace('varying vec3 vN, vP;', 'varying vec3 vN, vP, vO;').replace('vUv = uv;', 'vUv = uv; vO = position;');
// Tagkarte bis 16k (≈ 2,4 km je Bildpunkt) mit Feinstruktur darunter, Gelände aus der Normalenkarte, Wasser mit Windfeldern.
export const EARTH_FRAG = /* glsl */ `
uniform sampler2D tDay, tNight, tRelief, tClouds;
uniform vec3 uSun, uAxis;
uniform float uCloudU, uLights, uRelief;
uniform vec4 uLook;   // Zahnrad Global „Licht und Schatten“ (planetfx.js): hier nur Spiegelung uLook2.x
uniform vec2 uLook2;
varying vec3 vN, vP, vO;
varying vec2 vUv;
${NOISE}
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  vec3 east = normalize(cross(uAxis, N)), north = cross(N, east);
  float ndl = dot(N, uSun);
  // Reliefkarte (Solar System Scope): rg = Geländenormale (r nach Osten, g nach Süden), b = Wassermaske
  vec3 rel = texture2D(tRelief, vUv).rgb;
  float ocean = smoothstep(0.3, 0.7, rel.b);
  vec3 day = texture2D(tDay, vUv).rgb;
  // Feinstruktur (Modell): unter der Auflösung der Karte moduliert Rauschen die Helligkeit an Land in 1–6 km, blendet
  // aus, sobald ein Bildpunkt größer ist
  float px = length(fwidth(vO));
  float fine = 1.0 - smoothstep(0.0008, 0.004, px);
  if (fine > 0.0) day *= 1.0 + (fbm(vO * 240.0, 4) * 0.34 + fbm(vO * 1400.0, 2) * 0.16) * fine * (1.0 - ocean);
  vec2 cuv = vUv + vec2(uCloudU, 0.0);
  float cl = texture2D(tClouds, cuv).r;
  // weicher Terminator: die Atmosphäre streut Licht ein Stück über die Schattengrenze, dort rötlich (langer Weg durch die Luft)
  float lit = clamp((ndl + 0.06) / 1.06, 0.0, 1.0);
  vec3 sunCol = mix(vec3(1.0, 0.5, 0.3), vec3(1.0), smoothstep(-0.02, 0.35, ndl));
  // Gelände: Hänge zur Sonne heller, abgewandte dunkler (Normale überhöht, uRelief); am Terminator am deutlichsten
  // (kleine Abweichungen < 3/128 = Rauschen der Kompression → ignoriert)
  vec2 g = (rel.rg - 0.5) * vec2(2.0, -2.0);
  g = sign(g) * max(abs(g) - 0.023, 0.0) * (1.0 - ocean);
  vec3 Ng = normalize(N + (east * g.x + north * g.y) * uRelief);
  float hill = clamp(1.0 + (dot(Ng, uSun) - ndl) * (1.2 + 1.8 * (1.0 - lit)), 0.45, 1.6);
  // Wolkenschatten: die schattende Wolke liegt zwischen Boden und Sonne → Wolkenkarte zur Sonne versetzt abtasten
  vec2 off = vec2(dot(uSun, east), dot(uSun, north)) * 0.004;
  float shadow = 1.0 - 0.6 * smoothstep(0.1, 0.8, texture2D(tClouds, cuv + off).r) * lit;
  vec3 col = day * lit * hill * sunCol * 0.85 * shadow;
  // Wasser: Sonnenglitzern mit Rauigkeit aus Windfeldern (Rauschen, Modell; Beckmann-Verteilung) – ruhige Flecken
  // spiegeln scharf, windige streuen breit; unter Wolken gedämpft. Flacher Blick aufs Wasser spiegelt den Himmel (Fresnel).
  vec3 H = normalize(uSun + V);
  float nh = max(dot(N, H), 1e-3), t2 = (1.0 - nh * nh) / (nh * nh);
  float wind = fbm(normalize(vO) * 22.0, 3) * 0.7 + fbm(normalize(vO) * 160.0, 2) * 0.3;
  float m = mix(0.045, 0.12, smoothstep(-0.35, 0.45, wind));
  float glint = exp(-t2 / (m * m)) * (0.0048 / (m * m)) * ocean * (1.0 - cl) * lit;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0) * ocean * lit;
  float spec = uLook.x > 0.0 ? uLook2.x : 1.0;
  col += vec3(1.0, 0.92, 0.8) * glint * 0.6 * spec + vec3(0.03, 0.045, 0.065) * pow(nh, 18.0) * ocean * lit * spec + vec3(0.25, 0.4, 0.6) * fres * 0.12;
  // Stadtlichter auf der Nachtseite mit warmem Hof (gröbere Mip-Stufe = Lichtglocke über Ballungsräumen); Wolken verdecken
  // sie über die eigene Wolkenschicht
  vec3 night = texture2D(tNight, vUv).rgb, halo = texture2D(tNight, vUv, 4.0).rgb;
  float dark = 1.0 - smoothstep(-0.1, 0.12, ndl);
  col += (night * night + halo * 0.45) * vec3(1.0, 0.72, 0.42) * uLights * dark;
  // Rest-Licht der Nachtseite (Atmosphäre, Sterne): sehr schwach blau
  col += vec3(0.002, 0.004, 0.008) * (1.0 - lit);
  gl_FragColor = vec4(col, 1.0);
}
`;

// Erdkarten nach Grafikkarte (NASA Blue/Black Marble, tools/earth_tex.py): Tag und Wolken in 16k bei Qualität „hoch“
// (Tag ≈ 710 MB Grafikspeicher, Wolken ≈ 180 MB), 8k ab „mittel“ (≈ 180 + 45 MB), sonst 4k; Nacht höchstens 8k
export function earthMaps(ctx) {
  const max = ctx.renderer.capabilities.maxTextureSize;
  const k = max >= 16384 && ctx.detail >= 1 ? '16k' : max >= 8192 && ctx.detail >= 0.8 ? '8k' : '4k';
  // Wolkenkarte driftet (uCloudU > 1) → waagerecht wiederholen, sonst streckt ClampToEdge die Randspalte zu Streifen;
  // Graustufen → ein Kanal (R8) statt RGBA
  const clouds = ctx.tex(`earth_clouds_${k}.jpg`, false);
  clouds.wrapS = THREE.RepeatWrapping;
  clouds.format = THREE.RedFormat;
  const night = ctx.tex(`earth_nightmap_${k === '4k' ? '4k' : '8k'}.jpg`);
  return { day: ctx.tex(`earth_daymap_${k}.jpg`), night, clouds, relief: ctx.tex('earth_relief_4k.jpg', false) };
}

export const MOON_FRAG = /* glsl */ `
uniform sampler2D tMoon;
uniform vec3 uSun, uEarth;
uniform float uEarthshine;
varying vec3 vN, vP;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float mu0 = max(dot(N, uSun), 0.0), mu = max(dot(N, V), 0.0);
  // Lommel-Seeliger: Regolith streut nicht wie eine matte Fläche – der Vollmond wirkt flach, ohne Randabfall
  float ls = mu0 / (mu0 + mu + 1e-4) * 2.0;
  vec3 alb = texture2D(tMoon, vUv).rgb;
  vec3 col = alb * ls * 0.85;
  float e0 = max(dot(N, uEarth), 0.0);
  col += alb * e0 / (e0 + mu + 1e-4) * uEarthshine;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const SUN_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vDir;
void main() {
  float a = acos(clamp(dot(normalize(vDir), uSun), -1.0, 1.0));
  // Winkelradius der Sonnenscheibe von der Erde: 0,267° (Strahlungsdichte stark verdichtet, Bloom macht den Lichthof)
  float disk = smoothstep(0.00475, 0.00455, a);
  float glow = exp(-a / 0.012) * 6.0 + exp(-a / 0.08) * 0.25;
  gl_FragColor = vec4(vec3(1.0, 0.96, 0.9) * (disk * 900.0 + glow), 1.0);
}
`;
export const SUN_VERT = /* glsl */ `
${SKY_VERTEX}
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = skyPosition(vDir); }
`;

// Polarlicht-Oval um den geomagnetischen Pol: äquatorwärtige Grenze nach Kp (NOAA: Kp 0 → 66,5°, Kp 9 → 48,1° geomagnetische
// Breite), mittags ≈ 5° polwärts, Breite 4° + 0,6°·Kp; Vorhänge 100–320 km hoch, Falten und Strahlen aus Rauschen (Modell).
// Farben nach den Emissionslinien: Sauerstoff grün 557,7 nm unten, rot 630 nm oben, N₂⁺ blau-violett an der Unterkante.
export const AURORA_VERT = /* glsl */ `
${NOISE}
attribute vec2 auv;
attribute float aw, ah;
uniform vec3 uPole, uSunL;
uniform float uKp, uTime, uRp, uWaves, uSub;
varying float vVi, vU, vW, vNight, vFold, vSub;
void main() {
  vec3 e3 = normalize(uPole) * ah;
  vec3 e1 = normalize(uSunL - e3 * dot(uSunL, e3));
  vec3 e2 = cross(e3, e1);
  float u = auv.x, cu = cos(u);
  float latEq = (66.5 - 2.044 * uKp) + 2.5 * (1.0 + cu);
  float width = 4.0 + 0.6 * uKp - cu;
  float fold = fbm(vec3(cos(u) * 2.0, sin(u) * 2.0 + aw * 2.0 + ah, uTime * 0.08), 3) * 2.4 + fbm(vec3(cos(u) * 7.0, sin(u) * 7.0 + aw * 5.0, uTime * 0.2), 2) * 0.8;
  // Wellen und Wirbel laufen am Bogen entlang (Kelvin-Helmholtz-Locken), Falten wandern
  if (uWaves > 0.5) fold += 0.32 * sin(u * 22.0 + 1.6 * sin(u * 5.0 + uTime * 0.25) - uTime * 0.5 + aw * 2.0) + 0.14 * sin(u * 61.0 - uTime * 1.1 + aw * 5.0);
  float lat = latEq + width * aw + fold;
  // Teilsturm: Ausbuchtung um Mitternacht wächst polwärts und nach Westen, Zyklus 22 s (in Wirklichkeit ≈ 1–2 h, hier gerafft)
  float sub = 0.0;
  if (uSub > 0.5) {
    float ph = fract(uTime / 22.0);
    float env = smoothstep(0.0, 0.07, ph) * (1.0 - smoothstep(0.5, 0.97, ph));
    float du = atan(sin(u - 3.14159265), cos(u - 3.14159265));
    float wdt = 0.22 + 1.4 * ph;
    sub = env * exp(-pow(du / wdt, 2.0));
    float surge = exp(-pow((du - wdt * 0.9) / 0.12, 2.0)) * env;   // Westwärts-Welle: Locke an der Front
    lat += sub * (2.0 + 7.0 * ph) * aw + surge * 2.5 * sin(aw * 6.0 - uTime * 1.5);
  }
  float th = (90.0 - lat) * 0.017453292;
  vec3 dir = sin(th) * (cu * e1 + sin(u) * e2) + cos(th) * e3;
  vec3 pos = dir * (uRp + mix(0.1, uWaves > 0.5 ? 0.52 : 0.4, auv.y));
  vVi = auv.y; vU = u; vW = aw; vFold = fold; vSub = sub;
  vNight = 1.0 - smoothstep(-0.2, 0.05, dot(dir, uSunL));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;
export const AURORA_FRAG = /* glsl */ `
${NOISE}
uniform float uTime, uKp, uGain, uWaves;
varying float vVi, vU, vW, vNight, vFold, vSub;
void main() {
  // MSAA wertet am Bildpunkt-Mittelpunkt aus, auch knapp neben flach angeschnittenen Blättern: dort läuft die Höhe weit aus
  // [0, 1] hinaus und das Produkt unten wird NaN – der Bloom bläht das zu weißen Flecken auf (Flug Erde → ISS)
  float vV = clamp(vVi, 0.0, 1.0);
  float ray = ridged(vec3(cos(vU) * 5.0 + vFold * 0.6, sin(vU) * 5.0, vW * 4.0 + uTime * 0.25), 2);
  // feine senkrechte Strahlen (entlang der Feldlinien), wandern und flackern; Helligkeitswellen laufen am Vorhang entlang
  float rays = ridged(vec3(cos(vU) * 70.0 + vFold * 2.0, sin(vU) * 70.0, uTime * 0.35 + vW * 11.0), 2);
  float ray2 = gnoise(vec3(cos(vU) * 16.0, sin(vU) * 16.0, vV * 2.0 - uTime * 0.4 + vW * 7.0)) * 0.5 + 0.5;
  // Bögen in Segmente mit Lücken brechen (jedes Blatt eigenes Muster), langsam wandernd
  float seg = smoothstep(-0.15, 0.35, gnoise(vec3(cos(vU) * 3.5, sin(vU) * 3.5, vW * 6.0 + uTime * 0.04)));
  float b = seg * (0.25 + 0.75 * ray) * (0.6 + 0.4 * ray2) * (0.45 + 1.1 * rays * rays) * (0.8 + 0.3 * sin(vU * 40.0 + vFold * 3.0 - uTime * 0.9));
  float prof = smoothstep(0.0, 0.07, vV) * pow(max(1.0 - vV, 0.0), 1.7);
  vec3 green = vec3(0.35, 1.0, 0.45), red = vec3(1.0, 0.25, 0.35), violet = vec3(0.55, 0.35, 1.0);
  vec3 col = mix(green, red, smoothstep(0.3, 0.9, vV));
  col = mix(col, violet, (1.0 - smoothstep(0.0, 0.18, vV)) * clamp((uKp - 3.0) / 6.0, 0.0, 1.0) * 0.7);
  float mlt = 0.55 + 0.45 * (0.5 - 0.5 * cos(vU));
  b *= 1.0 + 1.3 * vSub;
  if (uWaves > 0.5) {
    // Helligkeit läuft die Strahlen hinauf, scharfe Unterkante (N₂ rosa-violett), roter Saum oben
    float up = 0.55 + 0.45 * sin(vV * 13.0 - uTime * 2.2 + rays * 5.0 + vU * 30.0);
    b *= mix(1.0, up, 0.65);
    float lower = exp(-vV / 0.04) * seg;
    col = mix(col, vec3(1.0, 0.22, 0.32), smoothstep(0.45, 0.95, vV) * 0.85);
    col += vec3(1.0, 0.35, 0.8) * lower * (0.55 + 1.2 * vSub);
    prof = smoothstep(0.0, 0.035, vV) * pow(max(1.0 - vV, 0.0), 1.3);
    b *= 2.1;
  }
  mlt = mix(mlt, 1.0, vSub);
  gl_FragColor = vec4(col * b * prof * mlt * vNight * (0.5 + 0.12 * uKp) * uGain, 1.0);
}
`;
// Breite, weiche Glow-Lage des Ovals (diffuse Aurora, ≈ 110 km Höhe): gleiche Oval-Geometrie wie die Vorhänge, wandernde
// Flecken (pulsierende Aurora), polwärts mehr Rot; am Rand der Erdscheibe heller (längerer Weg durch die Lage)
export const AURORA_GLOW_VERT = /* glsl */ `
varying vec3 vL, vN, vP;
void main() {
  vL = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
export const AURORA_GLOW_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uPole, uSunL;
uniform float uKp, uTime, uGain, uWaves, uSub, uPulse;
varying vec3 vL, vN, vP;
void main() {
  vec3 p = normalize(vL), e3 = normalize(uPole);
  float s = dot(p, e3);
  e3 *= s >= 0.0 ? 1.0 : -1.0;
  vec3 e1 = normalize(uSunL - e3 * dot(uSunL, e3)), e2 = cross(e3, e1);
  float lat = degrees(asin(abs(s)));
  float u = atan(dot(p, e2), dot(p, e1)), cu = cos(u);
  float latEq = (66.5 - 2.044 * uKp) + 2.5 * (1.0 + cu);
  float width = 4.0 + 0.6 * uKp - cu;
  float x = (lat - latEq - width * 0.45) / (width * 0.8);
  float band = exp(-x * x);
  if (band < 0.01) discard;
  float spot = fbm(p * 9.0 + vec3(0.0, 0.0, uTime * 0.04), 3) * 0.5 + 0.5;
  float night = 1.0 - smoothstep(-0.2, 0.05, dot(p, uSunL));
  float mlt = 0.55 + 0.45 * (0.5 - 0.5 * cu);
  float mu = max(dot(normalize(vN), normalize(cameraPosition - vP)), 0.0);
  vec3 col = mix(vec3(0.3, 1.0, 0.5), vec3(0.95, 0.3, 0.45), 0.15 + 0.3 * smoothstep(0.0, 1.5, x));
  if (uWaves > 0.5) {
    spot = 0.6 * spot + 0.6 * smoothstep(0.1, 0.6, fbm(p * 22.0 + vec3(uTime * 0.03, 0.0, -uTime * 0.05), 3));
    band *= 0.8;
  }
  float ph = fract(uTime / 22.0);
  float env = smoothstep(0.0, 0.07, ph) * (1.0 - smoothstep(0.5, 0.97, ph));
  float du = atan(sin(u - 3.14159265), cos(u - 3.14159265));
  if (uSub > 0.5) band *= 1.0 + 0.9 * env * exp(-pow(du / (0.22 + 1.4 * ph), 2.0));
  if (uPulse > 0.5) {
    // pulsierende Flecken im Morgensektor: an/aus mit 4–9 s (unter 3 Hz)
    vec3 cell = floor(p * 26.0);
    float hh = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float on = smoothstep(0.35, 0.5, fract(uTime / (4.0 + 5.0 * hh) + hh)) * (1.0 - smoothstep(0.75, 0.9, fract(uTime / (4.0 + 5.0 * hh) + hh)));
    float morning = exp(-pow((du + 1.6) / 0.7, 2.0));
    spot += morning * on * smoothstep(0.2, 0.7, gnoise(p * 60.0)) * 1.6;
  }
  gl_FragColor = vec4(col * band * (0.35 + 1.0 * spot * spot) * night * mlt / (mu + 0.35) * (0.15 + 0.07 * uKp) * uGain, 1.0);
}
`;
// Vorhang-Geometrie: je Halbkugel drei Blätter quer durch das Oval (w), 240 Segmente, zwei Höhenreihen
export function auroraGeometry() {
  const N = 240, W = [0.08, 0.28, 0.5, 0.72, 0.92], uv = [], w = [], h = [], idx = [];
  let base = 0;
  for (const hemi of [1, -1]) for (const wi of W) {
    for (let i = 0; i <= N; i++) for (const v of [0, 1]) { uv.push((i / N) * Math.PI * 2, v); w.push(wi); h.push(hemi); }
    for (let i = 0; i < N; i++) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    base += (N + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base * 3), 3));
  g.setAttribute('auv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('aw', new THREE.BufferAttribute(new Float32Array(w), 1));
  g.setAttribute('ah', new THREE.BufferAttribute(new Float32Array(h), 1));
  g.setIndex(idx);
  return g;
}

// Schattenkegel (Kern- und Halbschatten) eines Körpers mit Radius r in Sonnenabstand D: Kernschatten endet bei
// L = r·D/(R☉ − r), der Halbschatten öffnet sich mit (R☉ + r)/D
function shadowCones(r, len) {
  const g = new THREE.Group();
  const Lu = r * SUN_D / (SUN_R - r);
  const umbra = new THREE.Mesh(new THREE.ConeGeometry(r, Lu, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x5577bb, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  umbra.position.y = -Lu / 2;
  umbra.rotation.x = Math.PI;   // Spitze zeigt von der Sonne weg (lokal −y)
  g.add(umbra);
  const Lp = len;
  const rp = r + Lp * (SUN_R + r) / SUN_D;
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(rp, r, Lp, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x334a77, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  pen.position.y = -Lp / 2;
  g.add(pen);
  g.userData.Lu = Lu;
  return g;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 4000);
  const jd0 = julianDate(ctx.date);
  let jd = jd0, rate = 0;
  const earthP = PLANETS.find((p) => p.id === 'earth');

  const sunDir = new THREE.Vector3();
  const moonPos = new THREE.Vector3();
  const earthDir = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);
  let pr = 1;

  // ---------- Himmel: Katalog (Yale BSC) mit Sternbildern; fällt auf den statistischen Himmel zurück ----------
  const ngp = new THREE.Vector3(...eclDir(180.02, 29.81)), gc = new THREE.Vector3(...eclDir(266.84, -5.54));
  const sky = new THREE.Group();
  scene.add(sky);
  let catalog = null, lines = null, consMode = 'off';
  const starLabels = [], conLabels = [];
  const ready = createCatalogSky({ gain: 2.1, limit: 6.5 }).then((g) => {
    catalog = g;
    g.userData.setPixelRatio(pr);
    sky.add(g);
    for (const st of g.userData.named) {
      const b = BRIGHT[st.name];
      if (!b) continue;
      starLabels.push({ id: `star-${st.name}`, kind: 'label', cls: 'hsl--star', pos: st.dir.clone().multiplyScalar(SKY_R), visible: () => consMode === 'names',
        info: { t: st.name, x: `${b.x} Helligkeit ${st.mag.toFixed(2).replace('.', ',')} mag.`, s: 'hipparcos' } });
    }
    return createConstellationLines();
  }).then((l) => {
    lines = l;
    lines.visible = false;
    lines.userData.show(consMode !== 'off');
    sky.add(lines);
    for (const c of lines.userData.names) {
      if (!CONST_INFO[c.id]) continue;
      conLabels.push({ id: `con-${c.id}`, kind: 'label', cls: 'hsl--con', pos: c.dir.clone().multiplyScalar(SKY_R), visible: () => consMode !== 'off',
        info: { t: c.de, x: `${CONST_INFO[c.id]} (lateinisch ${c.la})`, s: 'd3-celestial' } });
    }
    hotspots.push(...conLabels, ...starLabels);
  }).catch((err) => {
    console.warn('[kosmos] Sternkatalog nicht geladen, statistischer Himmel:', err);
    const f = createStarfield({ ngp, gc, gain: 0.9, seed: 11, tex: ctx.tex });
    f.userData.setPixelRatio(pr);
    sky.add(f);
    catalog = f;
  });
  // Milchstraßenband und Sonne bleiben prozedural
  sky.add(createStarfield({ count: 1, ngp, gc, gain: 0, band: 1, glint: false, tex: ctx.tex }));
  const sunMat = new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms: { uSun: { value: sunDir } }, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true });
  const sunSky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), sunMat);
  sunSky.frustumCulled = false;
  sunSky.renderOrder = -9;
  scene.add(sunSky);
  const flare = createFlare({ strength: 0.85 });
  scene.add(flare);

  // ---------- Erde ----------
  const tilt = new THREE.Group();
  tilt.rotation.x = -OBLIQUITY * RAD;          // Äquator-System → Ekliptik-Szene (Nordpol bei λ = 90°, β = 66,56°)
  scene.add(tilt);
  const spin = new THREE.Group();
  tilt.add(spin);
  const maps = earthMaps(ctx);
  const earthMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT_O, fragmentShader: EARTH_FRAG,
    uniforms: {
      tDay: { value: maps.day }, tNight: { value: maps.night }, tRelief: { value: maps.relief }, tClouds: { value: maps.clouds },
      uSun: { value: sunDir }, uAxis: { value: axis }, uCloudU: { value: 0 }, uLights: { value: 2.6 }, uRelief: { value: 7 },
    },
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R_E, 192, 96), earthMat);
  spin.add(earth);
  spinAxis(earth);
  // Wolken als eigene Kugelschicht (drehen mit der Erde, driften zusätzlich)
  const cloudU = { tClouds: { value: maps.clouds }, uSun: { value: sunDir }, uAxis: { value: axis }, uCloudU: { value: 0 }, uTime: { value: 0 }, uGain: { value: 0.95 }, uOpacity: { value: 0.96 } };
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R_CLOUD, 192, 96), new THREE.ShaderMaterial({ vertexShader: EARTH_VERT_O,
    fragmentShader: CLOUD_FRAG, uniforms: cloudU, transparent: true, depthWrite: false }));
  spin.add(clouds);
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: SHELL_VERT, fragmentShader: ATMO_FRAG,
    uniforms: { uSun: { value: sunDir }, uCenter: { value: new THREE.Vector3() }, uBeta: { value: new THREE.Vector3(0.1, 0.26, 0.72) }, uMieCol: { value: new THREE.Vector3(1.0, 0.95, 0.9) },
      uRp: { value: R_E }, uRa: { value: R_ATM }, uH: { value: 0.12 }, uGain: { value: 1.25 }, uMie: { value: 0.15 }, uAir: { value: 0.1 }, uAirH: { value: 0.23 },
      uNoRayleigh: rayleighUniform },
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R_ATM, 160, 80), atmoMat);
  scene.add(atmo);

  // ---------- Polarlichter (drehen mit der Erde; geomagnetischer Nordpol 2025: 80,8° N, 72,8° W, IGRF-14) ----------
  const GM = [80.8 * RAD, -72.8 * RAD];
  const poleL = new THREE.Vector3(Math.cos(GM[0]) * Math.cos(GM[1]), Math.sin(GM[0]), -Math.cos(GM[0]) * Math.sin(GM[1]));
  const sunL = new THREE.Vector3(1, 0, 0);
  const auroraU = { uPole: { value: poleL }, uSunL: { value: sunL }, uKp: { value: 4 }, uTime: { value: 0 }, uGain: { value: 1 }, uRp: { value: R_E }, uWaves: { value: 1 }, uSub: { value: 1 }, uPulse: { value: 1 } };
  const aurora = new THREE.Mesh(auroraGeometry(), new THREE.ShaderMaterial({ vertexShader: AURORA_VERT, fragmentShader: AURORA_FRAG, uniforms: auroraU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
  aurora.frustumCulled = false;
  spin.add(aurora);
  const auroraGlow = new THREE.Mesh(new THREE.SphereGeometry(R_E + 0.11, 160, 80), new THREE.ShaderMaterial({ vertexShader: AURORA_GLOW_VERT, fragmentShader: AURORA_GLOW_FRAG, uniforms: auroraU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  spin.add(auroraGlow);
  const auroraPos = new THREE.Vector3(), poleW = new THREE.Vector3(), qSpin = new THREE.Quaternion();

  // ---------- Satelliten und Trümmer (CelesTrak-Schnappschuss, sats.js) ----------
  let satData = null, sats = null, iss = null, tg = null, hst = null;
  const sunSat = new THREE.Vector3(), qTiltInv = new THREE.Quaternion();
  const satLines = [], issLocal = new THREE.Vector3(), issWorld = new THREE.Vector3(), tgLocal = new THREE.Vector3(), tgWorld = new THREE.Vector3(), satInfo = { alt: 0, v: 0 };
  const hstLocal = new THREE.Vector3(), hstWorld = new THREE.Vector3();
  // Teleskope am Lagrange-Punkt L2: echte Orte zum Datum aus den JPL-Horizons-Bahndaten (l2track.js); bis sie geladen
  // sind oder außerhalb ihrer Spanne 1,5 Mio. km hinter der Erde (Gegenseite der Sonne), seitlich versetzt wie auf ihren
  // Halo-Bahnen (Modell, Abstände nach STScI/ESA: einige 100.000 km von L2); vor dem Start ohne Abzeichen
  const L2 = { d: 1500, jwst: [0, 520], euclid: [500, 0], roman: [-380, -220] }, l2World = { jwst: new THREE.Vector3(), euclid: new THREE.Vector3(), roman: new THREE.Vector3() };
  let l2Data = null;
  const l2Ready = loadL2().then((d) => { l2Data = d.craft; placeL2(); }).catch((err) => console.warn('[kosmos] L2-Bahndaten nicht geladen, Modell:', err));
  const l2Pos = [0, 0, 0];
  const launched = (k) => !l2Data || !l2Data[k] || jd >= l2Data[k].v[0][0];
  const show = { sats: true, debris: true, orbits: true };
  let linesT = -1;
  const satsReady = loadSats().then((d) => {
    satData = d;
    sats = createSats(d);
    sats.userData.setPixelRatio(pr);
    tilt.add(sats);
    for (const [name, col, op] of [['ISS (ZARYA)', 0xf3b552, 0.55], ['CSS (TIANHE)', 0xffd27a, 0.4], ['HST', 0x9cc8ff, 0.35]]) {
      const k = namedIndex(d, name);
      if (k < 0) continue;
      const line = orbitLine(d.obj[k], col, op);
      tilt.add(line);
      satLines.push(line);
      if (name === 'ISS (ZARYA)') iss = d.obj[k];
      if (name === 'CSS (TIANHE)') tg = d.obj[k];
      if (name === 'HST') hst = d.obj[k];
    }
    applyShow();
  }).catch((err) => console.warn('[kosmos] Satelliten nicht geladen:', err));
  function applyShow() {
    if (!sats) return;
    sats.visible = show.sats;
    sats.userData.setShow(2, show.debris);
    satLines.forEach((l) => { l.visible = show.sats && show.orbits; });
    issOrbit.visible = !iss;
  }

  // Bahnen in der Äquatorebene: geostationär (Ring) und ISS (51,6° geneigt, Knotenlage schematisch)
  const lineMat = (c, o) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = (r, segs = 256) => { const pts = []; for (let i = 0; i <= segs; i++) { const a = (i / segs) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); } return new THREE.BufferGeometry().setFromPoints(pts); };
  const geo = new THREE.LineLoop(ring(GEO), lineMat(0x9cc8ff, 0.35));
  tilt.add(geo);
  const issOrbit = new THREE.LineLoop(ring(ISS.r, 180), lineMat(0xffd27a, 0.5));
  issOrbit.rotation.x = ISS.inc * RAD;
  tilt.add(issOrbit);

  // Schattenkegel (Finsternis-Geometrie), zeigen von der Sonne weg
  const earthShadow = shadowCones(R_E, 500), moonShadow = shadowCones(R_M, 60);
  earthShadow.visible = moonShadow.visible = false;
  scene.add(earthShadow, moonShadow);

  // ---------- Mond ----------
  const moonPivot = new THREE.Group();
  scene.add(moonPivot);
  const moonMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT, fragmentShader: MOON_FRAG,
    uniforms: { tMoon: { value: ctx.tex('moon.jpg') }, uSun: { value: sunDir }, uEarth: { value: earthDir }, uEarthshine: { value: 0.0025 } },
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R_M, 96, 48), moonMat);
  moon.rotation.y = -Math.PI / 2;               // Länge 0 (Textur-Mitte) zeigt zur Erde
  moonPivot.add(moon);
  spinAxis(moon);
  // Mondbahn der nächsten 27,3 Tage als Linie (echter Verlauf, nicht als Kreis)
  const orbitPts = [];
  for (let i = 0; i <= 220; i++) orbitPts.push(new THREE.Vector3(...eclToScene(moonPosition(jd0 + (i / 220) * 27.32))).multiplyScalar(1e-3));
  const moonOrbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPts), lineMat(0xd3dae6, 0.28));
  scene.add(moonOrbit);

  const up = new THREE.Vector3(0, 1, 0);
  function place() {
    const e = planetPosition(earthP, jd);
    sunDir.set(...eclToScene(e)).multiplyScalar(-1).normalize();
    moonPos.set(...eclToScene(moonPosition(jd))).multiplyScalar(1e-3);
    moonPivot.position.copy(moonPos);
    moonPivot.lookAt(0, 0, 0);
    earthDir.copy(moonPos).multiplyScalar(-1).normalize();
    spin.rotation.y = gmst(jd) * RAD;
    tilt.updateMatrixWorld();
    axis.copy(up).applyQuaternion(tilt.quaternion);
    // Kegel: lokale +y zur Sonne, Spitze von der Sonne weg
    earthShadow.quaternion.setFromUnitVectors(up, sunDir);
    moonShadow.quaternion.copy(earthShadow.quaternion);
    moonShadow.position.copy(moonPos);
  }
  place();

  // ---------- Posen ----------
  // Heimpose: gegenüber dem Mond, seitlich versetzt – der Mond steht neben der Erde im Bild, Licht wie jetzt
  const m = moonPos.clone().normalize();
  const side = new THREE.Vector3().crossVectors(m, up).normalize();
  const d = m.clone().multiplyScalar(-1).addScaledVector(side, 0.38).addScaledVector(up, 0.12).normalize();
  const home = { pos: d.clone().multiplyScalar(36), target: new THREE.Vector3() };
  // Screenshots: ?view=night (Nachtseite mit Polarlichtern) · ?view=moon (Mond nah)
  const view = new URLSearchParams(location.search).get('view');
  if (view === 'aurora') { home.pos = sunDir.clone().negate().multiplyScalar(0.93).addScaledVector(up, 0.36).normalize().multiplyScalar(15.5); home.target = up.clone().multiplyScalar(R_E * 0.7).addScaledVector(sunDir, -R_E * 0.12); }
  else if (view === 'night') home.pos = sunDir.clone().negate().addScaledVector(up, 0.45).normalize().multiplyScalar(30);
  else if (view === 'moon') { home.target = moonPos.clone(); home.pos = moonPos.clone().addScaledVector(d, R_M * 7); }
  const introDir = d.clone().applyAxisAngle(up, -1.9).addScaledVector(up, 0.25).normalize();
  const intro = { pos: introDir.multiplyScalar(13), target: new THREE.Vector3() };

  // Punkt einer Äquatorbahn, der von der Heimpose aus in Richtung `dir` liegt
  function orbitPoint(dir, r, rotX = 0) {
    tilt.updateMatrixWorld();
    const q = tilt.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotX));
    const local = dir.clone().applyQuaternion(q.clone().invert());
    local.y = 0;
    return local.normalize().multiplyScalar(r).applyQuaternion(q);
  }

  // Orte der L2-Teleskope aus der Sonnenrichtung (jedes Bild, die Sonne wandert im Zeitraffer)
  const l2a = new THREE.Vector3();
  function placeL2() {
    l2a.crossVectors(sunDir, up).normalize();
    for (const k of ['jwst', 'euclid', 'roman']) {
      const p = l2Data && l2Data[k] && trackAt(l2Data[k], jd, l2Pos);
      if (p) l2World[k].set(...eclToScene(p));
      else l2World[k].copy(sunDir).multiplyScalar(-L2.d).addScaledVector(l2a, L2[k][0]).addScaledVector(up, L2[k][1]);
    }
  }
  placeL2();

  // Abzeichen: Tagrand, Nachtseite (von der Heimpose aus), Mond, Bahnpunkte, Sonnenrichtung, Schattenspitze
  const v = d.clone();
  const limb = sunDir.clone().addScaledVector(v, -sunDir.dot(v)).normalize();
  const upL = new THREE.Vector3().crossVectors(v, limb).normalize();
  const umbraTip = new THREE.Vector3();
  const hotspots = [
    { id: 'atmo', kind: 'info', pos: limb.clone().multiplyScalar(R_E * 1.02).addScaledVector(upL, 1.2) },
    { id: 'night', kind: 'info', pos: limb.clone().multiplyScalar(-0.62).addScaledVector(v, 0.7).normalize().multiplyScalar(R_E) },
    { id: 'moon', kind: 'dive', to: 'moon', pos: moonPos, focus: () => R_M * 6 },
    { id: 'aurora', kind: 'info', pos: auroraPos, visible: () => aurora.visible },
    { id: 'sats', kind: 'info', pos: d.clone().multiplyScalar(R_E + 0.55), visible: () => !!sats && show.sats },
    { id: 'geo', kind: 'info', pos: orbitPoint(side.clone().negate(), GEO) },
    { id: 'iss', kind: 'dive', to: 'iss', focus: () => 1.2, pos: issWorld.copy(orbitPoint(side.clone().add(upL), ISS.r, ISS.inc * RAD)) },
    { id: 'tiangong', kind: 'dive', to: 'tiangong', focus: () => 1.2, pos: tgWorld.copy(orbitPoint(side.clone().negate().add(upL), R_E + 0.384, 41.47 * RAD)) },
    { id: 'hubble', kind: 'dive', to: 'hubble', focus: () => 1.2, pos: hstWorld.copy(orbitPoint(side.clone().addScaledVector(upL, -1), R_E + 0.48, 28.47 * RAD)) },
    { id: 'jwst', kind: 'dive', to: 'jwst', focus: () => 40, pos: l2World.jwst, visible: () => launched('jwst') },
    { id: 'euclid', kind: 'dive', to: 'euclid', focus: () => 40, pos: l2World.euclid, visible: () => launched('euclid') },
    { id: 'roman', kind: 'dive', to: 'roman', focus: () => 40, pos: l2World.roman, visible: () => launched('roman') },
    { id: 'sun', kind: 'info', pos: sunDir.clone().multiplyScalar(90) },
    { id: 'umbra', kind: 'info', pos: umbraTip, visible: () => earthShadow.visible },
  ];
  // Abzeichen hinter Erde oder Mond ausblenden (Polarlicht, Nachtseite, Satelliten, Stationen, Teleskope bei L2)
  hideBehind(hotspots, [{ center: { x: 0, y: 0, z: 0 }, radius: R_E }, { center: moonPos, radius: R_M }]);

  const controls = [
    { id: 'const', label: 'Sternbilder', value: 'off', options: [['off', 'Aus'], ['lines', 'Linien'], ['names', 'Linien + Namen']],
      set: (val) => { consMode = val; if (lines) lines.userData.show(val !== 'off'); } },
    { id: 'shadow', label: 'Erdschatten', value: 'off', options: [['off', 'Aus'], ['on', 'Kegel zeigen']],
      set: (val) => { earthShadow.visible = moonShadow.visible = val === 'on'; } },
  ];
  let illum = 0;
  const tmp = new THREE.Vector3();
  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

  // ---------- Ebenen (Zahnrad „Station · Erde & Mond“, Zeitleiste) ----------
  const SPEEDS = [[1 / 1440, '1 min/s'], [1 / 144, '10 min/s'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s']];
  let clockIdx = 0;
  registerLayers('earth', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', hint: 'Erddrehung, Mondlauf, Satelliten und ISS im gewählten Tempo; Pause = Echtzeit.', value: 0, min: 0, max: SPEEDS.length - 1, step: 1, autoplay: true, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, playing) => { clockIdx = Math.round(i); rate = playing ? SPEEDS[clockIdx][0] : 0; if (!playing) jd = julianDate(new Date()); },
      get: () => ({ value: clockIdx, playing: rate !== 0 }), status: () => `${fmt.format(new Date((jd - 2440587.5) * 864e5))}${rate ? '' : ' · Echtzeit'}` },
    { id: 'atmo', type: 'toggle', group: 'Lufthülle', label: 'Atmosphäre (Streulicht-Hülle)', value: true, set: (v) => { atmo.visible = v; } },
    { id: 'clouds', type: 'toggle', label: 'Wolkenschicht', value: true, set: (v) => { clouds.visible = v; } },
    { id: 'aurora', type: 'toggle', group: 'Polarlichter', label: 'Polarlichter', value: true, set: (v) => { aurora.visible = auroraGlow.visible = v; } },
    { id: 'kp', type: 'range', label: 'Kp-Index', value: 4, min: 0, max: 9, step: 1, sub: true, fmt: (v) => `Kp ${v}`, set: (v) => { auroraU.uKp.value = v; },
      hint: 'Geomagnetische Aktivität. Kp 0–2: nur am Polarkreis · Kp 5: Sturm, bis Norddeutschland · Kp 9: bis in den Mittelmeerraum (NOAA).' },
    { id: 'auroraWaves', type: 'toggle', label: 'Wellen, Strahlen, Farbsäume', value: true, sub: true, set: (v) => { auroraU.uWaves.value = v ? 1 : 0; },
      hint: 'Locken laufen am Bogen entlang, Helligkeit steigt die Strahlen hinauf, rosa Unterkante und roter Saum oben.' },
    { id: 'auroraSub', type: 'toggle', label: 'Teilsturm (Zyklus 22 s)', value: true, sub: true, set: (v) => { auroraU.uSub.value = v ? 1 : 0; },
      hint: 'Ausbuchtung um Mitternacht wächst polwärts und nach Westen. Echte Teilstürme dauern ein bis zwei Stunden, hier gerafft.' },
    { id: 'auroraPulse', type: 'toggle', label: 'Pulsierende Flecken (Morgensektor)', value: true, sub: true, set: (v) => { auroraU.uPulse.value = v ? 1 : 0; } },
    { id: 'auroraGain', type: 'range', label: 'Leuchtstärke', value: 1, min: 0.3, max: 5, step: 0.1, sub: true, unit: '×', set: (v) => { auroraU.uGain.value = v; } },
    { id: 'sats', type: 'toggle', group: 'Erdumlaufbahn', label: 'Satelliten (CelesTrak-Katalog)', value: true, set: (v) => { show.sats = v; applyShow(); } },
    { id: 'debris', type: 'toggle', label: 'Trümmerwolken', value: true, sub: true, set: (v) => { show.debris = v; applyShow(); } },
    { id: 'orbits', type: 'toggle', label: 'Bahnen ISS, Tiangong, Hubble', value: true, sub: true, set: (v) => { show.orbits = v; applyShow(); } },
  ]);
  let wT = -1;
  const num = (x) => x.toLocaleString('de-DE');
  const dot = (k) => `<span class="w-dot" style="--c:${KIND_COLOR[k]}"></span>`;
  const occluders = [{ center: new THREE.Vector3(), radius: R_E }, { center: moonPos, radius: R_M }];
  const sunFar = new THREE.Vector3();

  return {
    scene, camera, home, intro, unit: 1e6, hotspots, controls, ready: ready.then(() => Promise.all([satsReady, l2Ready])),
    orbit: { minDistance: R_E * 1.28, maxDistance: 1000, cineSpeed: 0.8 },
    look: { exposure: 1.05, bloom: 0.05, sat: 1.06 },
    update(dt, t, cam) {
      jd += rate ? dt * rate : dt / DAY;
      place();
      earthMat.uniforms.uCloudU.value = cloudU.uCloudU.value = (jd - jd0) * 0.004;
      cloudU.uTime.value = t * (ctx.still ? 0.2 : 1);
      // beleuchteter Anteil aus der Elongation Mond–Sonne (Phasenwinkel ≈ 180° − Elongation)
      illum = (1 - tmp.copy(moonPos).normalize().dot(sunDir)) / 2;
      umbraTip.copy(sunDir).multiplyScalar(-earthShadow.userData.Lu * 0.28);
      sunFar.copy(sunDir).multiplyScalar(3500);
      cam.updateMatrixWorld();
      flare.userData.update(sunFar, cam, occluders, settings.S.lens, dt);
      // Polarlichter: Sonnenrichtung in das mitdrehende Erdsystem, Abzeichen am Mitternachtsrand des Nord-Ovals
      spin.getWorldQuaternion(qSpin);
      sunL.copy(sunDir).applyQuaternion(qSpin.clone().invert());
      auroraU.uTime.value = t * (ctx.still ? 0.2 : 1);
      if (lines) lines.userData.update(dt, t, ctx.still);
      if (aurora.visible) {
        poleW.copy(poleL).applyQuaternion(qSpin);
        const noon = tmp.copy(sunDir).addScaledVector(poleW, -sunDir.dot(poleW)).normalize();
        const kp = auroraU.uKp.value, lat = (66.5 - 2.044 * kp) + (5 + 0.6 * kp) * 0.5, th = (90 - lat) * RAD;
        auroraPos.copy(noon).multiplyScalar(-Math.sin(th)).addScaledVector(poleW, Math.cos(th)).multiplyScalar(R_E + 0.25);
      }
      // Satelliten: Tage seit dem Schnappschuss; Bahnlinien jede halbe Sekunde, ISS- und Tiangong-Ort je Bild
      // (Abzeichen und Folgen-Kamera hängen daran – gedrosselt springen sie dem Punkt hinterher)
      if (sats) {
        const days = jd - satData.jd;
        sats.userData.update(days);
        sats.userData.setSun(sunSat.copy(sunDir).applyQuaternion(qTiltInv.copy(tilt.quaternion).invert()));
        if (t - linesT > 0.5 || rate > 0.01) {
          linesT = t;
          satLines.forEach((l) => l.userData.update(days));
        }
        if (iss) {
          satPos(iss, days, issLocal);
          tilt.localToWorld(issWorld.copy(issLocal));
          const rkm = issLocal.length() * 1e3;
          satInfo.alt = rkm - RE; satInfo.v = speedAt(iss[0], rkm);
        }
        if (tg) {
          satPos(tg, days, tgLocal);
          tilt.localToWorld(tgWorld.copy(tgLocal));
        }
        if (hst) {
          satPos(hst, days, hstLocal);
          tilt.localToWorld(hstWorld.copy(hstLocal));
        }
      }
      placeL2();
    },
    widget: () => `<table><thead><tr><th>Objekte um die Erde</th><th>Anzahl</th></tr></thead><tbody id="w-sats"><tr><td colspan="2">Katalog wird geladen …</td></tr></tbody></table><p class="w-foot" id="w-sats-foot"></p>`,
    widgetTick(el, t) {
      if (t - wT < 0.5 || !satData) return;
      wT = t;
      const c = satData.counts;
      el.querySelector('#w-sats').innerHTML = `<tr><td>${dot(0)}aktive Satelliten gesamt</td><td class="num">${num(c.active)}</td></tr>
        <tr><td>${dot(1)}davon Starlink</td><td class="num">${num(c.starlink)}</td></tr>
        <tr><td>davon geostationär · Navigation</td><td class="num">${num(c.geo)} · ${num(c.gnss)}</td></tr>
        <tr><td>${dot(2)}Trümmer der vier großen Wolken</td><td class="num">${num(c.debris)}</td></tr>
        ${iss ? `<tr class="is-hi"><td>${dot(3)}ISS: Höhe · Geschwindigkeit</td><td class="num">${Math.round(satInfo.alt)} km · ${satInfo.v.toFixed(2).replace('.', ',')} km/s</td></tr>` : ''}`;
      el.querySelector('#w-sats-foot').textContent = nbsp(`Bahnelemente CelesTrak, Stand ${satData.epoch.slice(0, 10)}, Fortschreibung Kepler + J2. Dazu schätzt die ESA ≈ 1,2 Mio. Teile von 1–10 cm und über 100 Mio. von 1 mm–1 cm, zu klein für den Katalog.`);
    },
    live: () => `Stand ${fmt.format(new Date((jd - 2440587.5) * 864e5))} · Mond zu ${Math.round(illum * 100)} % beleuchtet · ${catalog && catalog.userData.count ? `${catalog.userData.count.toLocaleString('de-DE')} Katalogsterne` : 'Himmel wird geladen'}`,
    setPixelRatio: (p) => { pr = p; if (catalog) catalog.userData.setPixelRatio(p); if (sats) sats.userData.setPixelRatio(p); },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    },
  };
}
