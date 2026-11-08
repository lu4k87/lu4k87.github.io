// Station 7: Sagittarius A* (Einheit 1 Schwarzschild-Radius Rs = 2GM/c², M = 4,297·10⁶ M☉ → 1,27·10¹⁰ m).
// Strahlverfolgung je Pixel in der Schwarzschild-Metrik: Photonenbahnen nach d²x/dλ² = −(3/2)·h²·x/r⁵ (h = |x × v|,
// gleichwertig zur Binet-Gleichung u'' + u = (3/2)·u² mit Rs = 1); eingefangen unter r = 1, Schatten bei √27/2 Rs.
// Scheibe in der Ebene y = 0 von der innersten stabilen Bahn (3 Rs) bis 20 Rs: Temperatur nach Novikov-Thorne
// (T ∝ [r⁻³(1 − √(3/r))]^¼), Frequenzverschiebung g = 1 / (u^t · (1 − Ω·L)) aus Kepler-Umlauf (Ω = √(M/r³)) und
// Drehimpuls des Photons; Helligkeit ∝ g⁴, Farbe = Schwarzkörper bei g·T. Muster der Scheibe: Turbulenz, die mit Ω(r)
// mitläuft und dadurch zu Spiralbögen geschert wird; zwei Schichten blenden im Takt WIN über, damit die Scherung begrenzt
// bleibt (echte Turbulenz entsteht laufend neu, sonst würden nach einigen Umläufen konzentrische Rillen daraus).
// Modell-Ebenen (Zahnrad): heiße, dicke Strömung (RIAF, H/R ≈ 0,4, Leuchtdichte ∝ r⁻³, 0,7 Ω_K) als Volumen entlang des
// gekrümmten Lichtwegs – daher der helle Ring am Schatten; Einfallzone unter 3 Rs auf der Geodäte ab der ISCO
// (E = √(8/9), L = √3 bei Rs = 1) mit Rotverschiebung zum Horizont; Gasströme des Zentrums (Minispirale) am Himmel.
// Der Himmel dahinter (Sterne des Zentralhaufens) wird mit gelinst. Weit draußen (r > 70 Rs) ist die Krümmung
// vernachlässigbar: Strahlen laufen gerade bis zur Kugel r = 70 und werden erst dort integriert – so stimmt das Bild auch
// aus 40.000 Rs (S-Stern-Ansicht). Zeitraffer ×200: ein Umlauf an der innersten Bahn dauert echt gut eine halbe Stunde.
// Flare: heißer Fleck auf ≈ 3,5 Rs (7 GM/c²), Umlauf ≈ 41 min (GRAVITY 2018), läuft mit der Scheibe und zieht einen
// gescherten Schweif nach. S-Sterne: Bahn von S2 aus den Elementen (GRAVITY 2020), Ort zum aktuellen Datum.
// Ansicht „Sternzerriss“ (Szenario, Rechenkern web/js/tde.js): ein sonnenähnlicher Stern auf einer Parabelbahn wird am
// Gezeitenradius zerrissen. Der Strom liegt in der Scheibenebene und wird als Linie aus bis zu 512 Punkten (Daten-Textur,
// Hüllkreise je 16 Punkte zum Überspringen) beim Durchgang des Lichtwegs durch y = 0 getroffen – wie die Scheibe gelinst,
// mit Doppler-Faktor aus der Geschwindigkeit des Gases. Der Stern selbst ist ein gestrecktes Ellipsoid (Segment-Test je
// Schritt), Kreuzungs-Stoß und Ausfluss sind Volumen entlang des Lichtwegs; die neue Scheibe nutzt die Scheibe oben mit
// Helligkeit und Temperatur aus der Rückfallrate. Außerhalb der Kugel r = 70 laufen Strahlen gerade (Strom bis ~10⁴ Rs).

import * as THREE from 'three';
import { NOISE, BLACKBODY } from '../glsl.js';
import { schwarzschildRadius, C, AU, KPC, julianDate, solveKepler } from '../astro.js';
import { disposeScene, pointCloud } from '../vol.js';
import { registerLayers } from '../layers.js';
import { smoothKeys } from '../flightplan.js';
import { tdeModel, MAXP, GRP } from '../tde.js';

const M_SGR = 4.297e6;            // GRAVITY 2022
const RS = schwarzschildRadius(M_SGR);
// Zeitraffer der Scheibe [s je s]; Pause = Echtzeit
const LAPSES = [50, 100, 200, 500];
const RS_C = RS / C;              // Lichtlaufzeit über Rs [s] ≈ 42 s
const D_GC = 8.277 * KPC;
// S2 (GRAVITY 2020): a = 0,125058″, e = 0,884649, i = 134,567°, Ω = 228,171°, ω = 66,263°, P = 16,0455 a, T₀ = 2018,379
const S2 = { a: 0.125058, e: 0.884649, i: 134.567, O: 228.171, w: 66.263, P: 16.0455, T0: 2018.379 };
const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const OM_HOT = Math.sqrt(0.5 / 3.5 ** 3);   // Kepler-Winkelgeschwindigkeit auf 3,5 Rs [c/Rs]
const OM_ISCO = Math.sqrt(0.5 / 27);
const WIN = 150;                  // Überblendtakt der Scheiben-Turbulenz [Rs/c] ≈ 30 s im Zeitraffer

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCam;
uniform mat4 uCamWorld, uProjInv;
uniform float uSteps, uGain, uT0, uHot, uHotPh, uPlPh, uOct;
uniform float uTa, uTb, uSa, uSb, uWa;     // zwei Turbulenz-Schichten: Zeit im Takt, Saat, Gewicht der Schicht a
uniform float uHaze, uPlunge, uGas;
// Sternzerriss: Strom (Textur MAXP × 2: x, z, Halbbreite, log Dichte | vx, vz, T, Lagrange-Koordinate), Hüllkreise,
// Stern (Mitte + Radius, Achse, Streckung, Geschwindigkeit), Kreuzungs-Stoß, Ausfluss, Scheibe (Stärke, Temperatur)
uniform sampler2D uStream;
uniform vec4 uGrp[${MAXP / GRP}];
uniform float uSN, uSGain, uRim, uTime, uPx;
uniform vec4 uStar; uniform vec3 uStarAx, uStarV; uniform float uStarS, uStarOn;
uniform vec4 uShock; uniform float uShockR, uWind, uWindR, uDisk, uHazeH;
varying vec2 vUv;
${NOISE}
${BLACKBODY}

// Himmel: Sterne des Zentralhaufens (dicht, gerötet durch Staub), diffuses Leuchten mit Staubbahnen,
// ionisierte Gasströme (Minispirale Sgr A West: Fäden in Hα-Rot) – hinter dem Loch gelinst
vec3 sky(vec3 d) {
  vec3 col = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float sc = k == 0 ? 320.0 : k == 1 ? 150.0 : 62.0;
    vec3 c = floor(d * sc);
    vec3 j = hash3(c) * 0.35 + 0.5;
    vec3 sp = normalize(c + j);
    float h = hash13(c + 7.0);
    float dd = length(d - sp) * sc;
    float b = k == 0 ? pow(h, 14.0) * 0.55 : k == 1 ? pow(h, 26.0) * 1.6 : pow(h, 13.0) * 7.0;
    // helle Sterne: junge blaue Riesen (IRS 16, S-Sterne) zwischen roten Riesen
    vec3 tint = mix(vec3(1.0, 0.62, 0.38), vec3(0.8, 0.88, 1.0), k == 2 ? smoothstep(0.3, 0.8, hash13(c + 3.0)) : hash13(c + 3.0));
    float w = k == 0 ? 90.0 : k == 1 ? 45.0 : 70.0;
    col += tint * b * exp(-dd * dd * w);
  }
  float g = 0.5 + 0.5 * fbm(d * 3.0, 4);
  float dust = smoothstep(0.1, 0.5, fbm(d * 6.0 + 2.0, 4));
  col += vec3(0.05, 0.028, 0.018) * g * (0.4 + 0.6 * exp(-abs(d.y) * 3.0)) * (1.0 - 0.6 * dust);
  if (uGas > 0.0) {
    // Fäden an den Nulldurchgängen, in großen Bögen gebündelt; Staub schluckt einen Teil
    float arm = smoothstep(0.05, 0.55, fbm(d * 1.6 + 11.0, 3));
    float fil = ridged(d * 4.5 + vec3(0.0, 3.0, 0.0), 4);
    col += vec3(0.11, 0.022, 0.03) * uGas * arm * pow(fil, 3.0) * (1.0 - 0.7 * dust);
  }
  return col;
}

// Dichte der Scheibe in einer Schicht: Muster läuft mit Ω(r) um (Zeit tt < WIN → Scherung begrenzt), Fäden durch
// verzerrtes Grat-Rauschen, Klumpen durch fbm; innen schneller geschert = enge Spiralbögen, außen ruhige Wolken
float diskLayer(vec2 xz, float rh, float tt, float seed) {
  float ph = atan(xz.y, xz.x) + sqrt(0.5 / (rh * rh * rh)) * tt;
  vec3 q = vec3(cos(ph) * rh, sin(ph) * rh, rh * 0.9) * 0.6 + vec3(seed * 17.3, seed * 5.1, tt * 0.004);
  vec3 w = vec3(fbm(q * 0.8 + 3.1, 2), fbm(q * 0.8 + 7.7, 2), 0.0);
  float big = fbm(q + w * 1.1, 4);
  float fib = ridged(q * 2.4 + w * 1.6, int(uOct));
  return big * 1.6 + (fib - 0.32) * 0.5;
}
float diskDens(vec2 xz, float rh) {
  float a = uWa > 0.02 ? diskLayer(xz, rh, uTa, uSa) : 0.0;
  float b = uWa < 0.98 ? diskLayer(xz, rh, uTb, uSb) : 0.0;
  // Überblenden ohne Kontrastverlust in der Mitte (zwei unabhängige Muster)
  float n = (a * uWa + b * (1.0 - uWa)) * inversesqrt(uWa * uWa + (1.0 - uWa) * (1.0 - uWa));
  return clamp(0.62 + 0.95 * n, 0.0, 2.2);
}

// Doppler- und Gravitationsfaktor für Gas mit Geschwindigkeit v am Ort r (Photon läuft entlang −dir)
float gfac(vec3 v, float r, vec3 dir) {
  float f = max(1.0 - 1.0 / r, 0.02);
  return clamp(sqrt(max(f - dot(v, v), 0.01)) / max(1.0 + dot(v, normalize(dir)), 0.1), 0.2, 3.0);
}

// Strom im Punkt p der Ebene y = 0: nächstes Segment der Linie (Hüllkreise überspringen ferne Gruppen), Querschnitt mit
// Fäden längs des Gases (Lagrange-Koordinate läuft mit) und Klumpen; Farbe = Schwarzkörper bei T·g, Helligkeit gestaucht;
// Rand im Licht des Rückfalls rot (Rekombination, Hα). Rückgabe rgb = Licht, a = Deckkraft
// dc = Abstand zur Kamera: unter etwa einem Bildpunkt Breite wird der Strom auf diese Breite gezogen und dafür
// entsprechend blasser (Bedeckung), sonst flimmert er aus der Ferne oder verschwindet
vec4 streamAt(vec2 p, vec3 dir, float r, float dc) {
  float best = 1e9, bt = 0.0, side = 1.0, wb = 1.0;
  float wMin = 1.4 * uPx * dc / max(abs(normalize(dir).y), 0.3);
  int bi = -1;
  for (int g = 0; g < ${MAXP / GRP}; g++) {
    if (float(g * ${GRP}) >= uSN - 1.0) break;
    vec4 G = uGrp[g];
    if (G.z < 0.0 || length(p - G.xy) > G.z) continue;
    for (int k = 0; k < ${GRP}; k++) {
      int i = g * ${GRP} + k;
      if (float(i) >= uSN - 1.0) break;
      vec4 A = texelFetch(uStream, ivec2(i, 0), 0), B = texelFetch(uStream, ivec2(i + 1, 0), 0);
      vec2 ab = B.xy - A.xy;
      float t = clamp(dot(p - A.xy, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
      vec2 q = A.xy + ab * t;
      float w = mix(A.z, B.z, t), d = length(p - q) / max(w, wMin);
      if (d < best) { best = d; bi = i; bt = t; wb = w; side = sign(ab.x * (p.y - q.y) - ab.y * (p.x - q.x) + 1e-9); }
    }
  }
  if (bi < 0 || best > 3.2) return vec4(0.0);
  vec4 P0 = mix(texelFetch(uStream, ivec2(bi, 0), 0), texelFetch(uStream, ivec2(bi + 1, 0), 0), bt);
  vec4 P1 = mix(texelFetch(uStream, ivec2(bi, 1), 0), texelFetch(uStream, ivec2(bi + 1, 1), 0), bt);
  float cov = clamp(wb / max(wMin, 1e-6), 0.6, 1.0);
  float fil = gnoise(vec3(P1.w * 170.0, best * side * 1.7, 3.7));
  float clump = gnoise(vec3(P1.w * 46.0, 0.0, 9.1));
  float thin = clamp((P0.w + 9.0) / 6.0, 0.3, 1.0);
  float prof = exp(-best * best * 1.7) * max(0.5 + 0.9 * fil, 0.0) * (0.75 + 0.5 * clump);
  float g = gfac(vec3(P1.x, 0.0, P1.y), r, dir);
  float T = P1.z * g;
  float a = clamp(prof * thin * 1.5, 0.0, 0.94) * cov;
  // Flächenhelligkeit ∝ T⁴ ist für den Bildschirm zu steil: gestaucht auf T^0,8 (kühler Strom glimmt rot, aufgeheizter
  // leuchtet weiß-bläulich ohne zu überstrahlen), Beaming g²
  vec3 e = blackbodyRGB(T) * 1.4 * pow(T / 6000.0, 0.8) * g * g * a * uSGain;
  e += vec3(1.0, 0.17, 0.24) * uRim * exp(-pow(best - 1.25, 2.0) * 1.4) * thin * max(0.45 + 0.7 * fil, 0.0) * cov;
  return vec4(e, a);
}

// Stern als gestrecktes Ellipsoid entlang uStarAx: nächster Abstand des Segments p0 → p1 in Stern-Koordinaten
// (Achse um uStarS gestaucht → Kugel); Randverdunkelung + schmaler Hof für den Bloom
vec4 starSeg(vec3 p0, vec3 p1, vec3 dir, float r) {
  vec3 a = p0 - uStar.xyz, b = p1 - uStar.xyz;
  float k = 1.0 - 1.0 / uStarS;
  a -= k * dot(a, uStarAx) * uStarAx;
  b -= k * dot(b, uStarAx) * uStarAx;
  vec3 ab = b - a;
  float t = clamp(-dot(a, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
  float d = length(a + ab * t) / uStar.w;
  if (d > 6.0) return vec4(0.0);
  float core = step(d, 1.0), mu = sqrt(max(1.0 - d * d, 0.0));
  float g = gfac(uStarV, r, dir);
  vec3 e = blackbodyRGB(5800.0 * g) * (4.0 * core * (0.4 + 0.6 * mu) * g * g * g * g + 0.35 * exp(-d * d * 0.9)) * uStarOn;
  return vec4(e, core * uStarOn);
}

// gerades Stück außerhalb r = 70 (Krümmung vernachlässigt): Stern und Strom beim Durchgang durch y = 0
void straight(vec3 p0, vec3 dir, float len, inout vec3 col, inout float A) {
  if (uStarOn > 0.0) {
    vec4 st = starSeg(p0, p0 + dir * len, dir, 1e4);
    col += (1.0 - A) * st.rgb; A += (1.0 - A) * st.a;
  }
  if (uSN > 1.0 && abs(dir.y) > 1e-6) {
    float tc = -p0.y / dir.y;
    if (tc > 0.0 && tc < len) {
      vec3 hit = p0 + dir * tc;
      vec4 sa = streamAt(hit.xz, dir, length(hit), length(hit - uCam));
      col += (1.0 - A) * sa.rgb; A += (1.0 - A) * sa.a;
    }
  }
}

void main() {
  vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(mat3(uCamWorld) * normalize(v.xyz / v.w));
  vec3 pos = uCam;
  // weit draußen gerade bis zur Kugel r = 70 laufen (Krümmung dort < 1 %); vorbei → nur Himmel
  float R0 = 70.0;
  vec3 col = vec3(0.0);
  float A = 0.0;
  bool tde = uSN > 1.0 || uStarOn > 0.0;
  if (dot(pos, pos) > R0 * R0) {
    float b = dot(pos, dir), c = dot(pos, pos) - R0 * R0, h = b * b - c;
    if (h <= 0.0 || b > 0.0) {
      if (tde) straight(pos, dir, 3e4, col, A);
      gl_FragColor = vec4(col + (1.0 - A) * sky(dir), 1.0); return;
    }
    float tin = -b - sqrt(h);
    if (tde) straight(pos, dir, tin, col, A);
    pos = pos + dir * tin;
  }
  vec3 hv = cross(pos, dir);
  float h2 = dot(hv, hv);
  float Lphys = -hv.y;                 // Drehimpuls des Photons um die Scheibenachse (Lichtweg rückwärts verfolgt)
  bool done = false;
  for (int i = 0; i < 420; i++) {
    if (float(i) >= uSteps) break;
    float r = length(pos);
    float dt = clamp(0.07 * (r - 0.6), 0.015, 1.6);
    vec3 acc = -1.5 * h2 * pos / pow(r, 5.0);
    vec3 np = pos + dir * dt + 0.5 * acc * dt * dt;
    float nr = length(np);
    vec3 nacc = -1.5 * h2 * np / pow(nr, 5.0);
    dir += 0.5 * (acc + nacc) * dt;

    // heiße, dicke Strömung: Volumen entlang des Lichtwegs (optisch dünn), Mitte des Schritts
    if (uHaze > 0.0) {
      vec3 m = 0.5 * (pos + np);
      float rm = length(m);
      if (rm < 24.0 && rm > 1.02) {
        float R = length(m.xz);
        float hz = m.y / (uHazeH * rm);
        float f = 1.0 - 1.0 / rm;
        // Umlauf 0,7 Ω_K, aber lokal höchstens 0,8 c (innerhalb der Photonensphäre gibt es keine Kreisbahn mehr)
        float Om = min(0.7 * sqrt(0.5 / (rm * rm * rm)), 0.8 * sqrt(f) / max(R, 0.05));
        float ut = inversesqrt(f - Om * Om * R * R);
        float g = min(1.0 / (ut * max(1.0 - Om * Lphys, 0.2)), 2.5);
        float pa = atan(m.z, m.x), pb = pa;
        pa += Om * uTa; pb += Om * uTb;
        float wa = gnoise(vec3(cos(pa) * rm, sin(pa) * rm, m.y * 1.6) * 0.42 + uSa * 9.1);
        float wb = gnoise(vec3(cos(pb) * rm, sin(pb) * rm, m.y * 1.6) * 0.42 + uSb * 9.1);
        float wisp = max(0.0, 0.75 + 1.1 * mix(wb, wa, uWa));
        float rho = exp(-hz * hz) * pow(rm, -3.0) * smoothstep(1.0, 1.6, rm) * smoothstep(24.0, 10.0, rm) * wisp;
        float g2 = g * g;
        col += (1.0 - A) * blackbodyRGB(uT0 * 1.1 * g) * rho * g2 * g2 * length(np - pos) * 0.45 * uHaze * uGain;
      }
    }

    if (tde) {
      vec3 m = 0.5 * (pos + np);
      float rm = length(m), sl = length(np - pos);
      // Kreuzungs-Stoß: heißes Gas um den Kreuzungspunkt, flackernd
      if (uShock.w > 0.0) {
        vec3 q = (m - uShock.xyz) / uShockR;
        float d2 = dot(q, q);
        if (d2 < 9.0) {
          float n = 0.55 + 0.9 * gnoise(q * 1.4 + vec3(0.0, uTime * 0.03, 0.0));
          col += (1.0 - A) * blackbodyRGB(45000.0) * uShock.w * exp(-d2 * 1.2) * max(n, 0.0) * sl / uShockR * 1.6;
        }
      }
      // Ausfluss: dünnes Gas streut das Licht des Rückfalls (bläulich), Strahlen nach außen, zu den Polen hin dichter
      if (uWind > 0.0 && rm > 2.2 && rm < uWindR) {
        vec3 nd = m / rm;
        float ray = gnoise(nd * 9.0 + 4.0) * 0.6 + gnoise(nd * 23.0 - vec3(0.0, 0.0, log(rm) * 1.3 - uTime * 0.004)) * 0.4;
        float rho = pow(rm, -2.1) * (0.3 + 0.7 * nd.y * nd.y) * smoothstep(uWindR, uWindR * 0.6, rm) * smoothstep(2.2, 4.0, rm);
        col += (1.0 - A) * vec3(0.5, 0.56, 1.0) * rho * max(0.15 + 1.3 * ray, 0.0) * uWind * sl * 3.2;
      }
      if (uStarOn > 0.0 && length(m - uStar.xyz) < sl + 8.0 * uStar.w * uStarS) {
        vec4 st = starSeg(pos, np, dir, rm);
        col += (1.0 - A) * st.rgb; A += (1.0 - A) * st.a;
        if (A > 0.985) { done = true; break; }
      }
    }

    if (pos.y * np.y < 0.0) {
      vec3 hit = mix(pos, np, pos.y / (pos.y - np.y));
      float rh = length(hit.xz);
      if (uSN > 1.0) {
        vec4 sa = streamAt(hit.xz, dir, length(hit), length(hit - uCam));
        col += (1.0 - A) * sa.rgb; A += (1.0 - A) * sa.a;
        if (A > 0.985) { done = true; break; }
      }
      if (rh > 3.0 && rh < 20.0 && uDisk > 0.0) {
        float Om = sqrt(0.5 / (rh * rh * rh));
        float ut = 1.0 / sqrt(1.0 - 1.5 / rh);
        float g = 1.0 / (ut * (1.0 - Om * Lphys));
        float Tn = pow(max(1.0 - sqrt(3.0 / rh), 0.0) / (rh * rh * rh), 0.25) / 0.2141;
        float dens = diskDens(hit.xz, rh);
        // heißer Fleck (Flare) auf 3,5 Rs, läuft starr mit der Scheibe um; Schweif hinter dem Fleck (Scherung)
        float dph = atan(sin(atan(hit.z, hit.x) + uHotPh), cos(atan(hit.z, hit.x) + uHotPh));
        float hot = uHot * exp(-pow((rh - 3.5) / 0.5, 2.0)) * (dph < 0.0 ? exp(-pow(dph / 0.22, 2.0)) : exp(-pow(dph / 0.95, 2.0)) * 0.85) * 3.0;
        float edge = smoothstep(3.0, 3.6, rh) * smoothstep(20.0, 12.0, rh);
        float g2 = g * g;
        float I = pow(Tn, 4.0) * g2 * g2 * edge * (dens * (1.0 + hot) + 0.25 * hot);
        // dichte Klumpen etwas heißer: feine Farbunterschiede in der Scheibe
        vec3 e = blackbodyRGB(uT0 * Tn * g * (0.93 + 0.08 * dens) * (1.0 + 0.25 * hot)) * I * uGain;
        float a = clamp(edge * (0.4 + 0.55 * Tn) * smoothstep(0.08, 0.95, dens + hot), 0.0, 0.95) * min(uDisk, 1.0);
        col += (1.0 - A) * e * a * max(uDisk, 1.0);
        A += (1.0 - A) * a;
        if (A > 0.985) { done = true; break; }
      } else if (rh > 1.0 && rh <= 3.0 && uPlunge * uDisk > 0.0) {
        // Einfallzone: Gas auf der Geodäte ab der ISCO, dünn; Rotverschiebung → 0 am Horizont (Radialanteil genähert)
        float f = 1.0 - 1.0 / rh;
        float ut = 0.9428 / f, uph = 1.7321 / (rh * rh);
        float ur = sqrt(max(0.8889 - f * (1.0 + 3.0 / (rh * rh)), 0.0));
        float kr = dot(-normalize(dir), hit / rh);
        float g = min(1.0 / max(ut - uph * Lphys + kr * ur / f, 0.4), 2.0);
        float sp = atan(hit.z, hit.x) + uPlPh + 1.8 * log(rh - 0.9);
        float n = fbm(vec3(cos(sp) * 1.6, sin(sp) * 1.6, log(rh - 0.9) * 3.0), 3);
        float dens = clamp(0.55 + 1.2 * n, 0.0, 1.6) * smoothstep(1.0, 1.4, rh);
        float g2 = g * g;
        float I = 0.5 * pow(rh / 3.0, 3.0) * g2 * g2 * dens * uPlunge;
        float a = clamp(0.35 * dens * uPlunge, 0.0, 0.6) * min(uDisk, 1.0);
        col += (1.0 - A) * blackbodyRGB(uT0 * 0.9 * g) * I * uGain * a;
        A += (1.0 - A) * a * 0.5;
      }
    }
    pos = np;
    if (nr < 1.0) { done = true; break; }
    if (nr > 70.0 && dot(pos, dir) > 0.0) break;
  }
  if (!done && tde && length(pos) > 60.0) straight(pos, normalize(dir), 3e4, col, A);
  if (!done) col += (1.0 - A) * sky(normalize(dir));
  gl_FragColor = vec4(col, 1.0);
}
`;

// Bahn von S2 in Szenen-Einheiten (Rs): Bahnebene → Himmel (Nord, Ost, Sichtlinie) → Szene (Erde in +z, Norden +y, Osten −x)
function s2Point(E) {
  const aRs = S2.a * RAD / 3600 * D_GC / RS;
  const X = aRs * (Math.cos(E) - S2.e), Y = aRs * Math.sqrt(1 - S2.e * S2.e) * Math.sin(E);
  const cw = Math.cos(S2.w * RAD), sw = Math.sin(S2.w * RAD), cO = Math.cos(S2.O * RAD), sO = Math.sin(S2.O * RAD), ci = Math.cos(S2.i * RAD), si = Math.sin(S2.i * RAD);
  const n = X * (cw * cO - sw * sO * ci) - Y * (sw * cO + cw * sO * ci);
  const e = X * (cw * sO + sw * cO * ci) - Y * (sw * sO - cw * cO * ci);
  const z = (X * sw + Y * cw) * si;   // positiv = von uns weg
  return new THREE.Vector3(-e, n, -z);
}
const s2Anomaly = (date) => {
  const yr = 2000 + (julianDate(date) - 2451545) / 365.25;
  const M = ((yr - S2.T0) / S2.P) * 2 * Math.PI;
  return solveKepler(((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), S2.e);
};

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200000);
  const steps = (d) => Math.round(220 + 180 * d);
  // Strom-Linie für den Shader (Zeile 0: Ort/Breite/Dichte, Zeile 1: Geschwindigkeit/Temperatur/Lagrange-Koordinate)
  const streamBuf = new Float32Array(MAXP * 2 * 4), grpBuf = new Float32Array((MAXP / GRP) * 4);
  const streamTex = new THREE.DataTexture(streamBuf, MAXP, 2, THREE.RGBAFormat, THREE.FloatType);
  streamTex.minFilter = streamTex.magFilter = THREE.NearestFilter;
  streamTex.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FRAG,
    uniforms: {
      uCam: { value: new THREE.Vector3() }, uCamWorld: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() },
      uSteps: { value: steps(ctx.detail) }, uOct: { value: ctx.detail > 0.7 ? 4 : 3 }, uGain: { value: 0.85 }, uT0: { value: 3600 },
      uHot: { value: 0 }, uHotPh: { value: 0 }, uPlPh: { value: 0 },
      uTa: { value: 0 }, uTb: { value: 0 }, uSa: { value: 0 }, uSb: { value: 0.5 }, uWa: { value: 1 },
      uHaze: { value: 1 }, uPlunge: { value: 1 }, uGas: { value: 1 },
      uStream: { value: streamTex }, uGrp: { value: Array.from({ length: MAXP / GRP }, () => new THREE.Vector4(0, 0, -1, 0)) },
      uSN: { value: 0 }, uSGain: { value: 1 }, uRim: { value: 0 }, uTime: { value: 0 }, uPx: { value: 0.0013 },
      uStar: { value: new THREE.Vector4(0, 0, 0, 0.05) }, uStarAx: { value: new THREE.Vector3(1, 0, 0) }, uStarV: { value: new THREE.Vector3() },
      uStarS: { value: 1 }, uStarOn: { value: 0 },
      uShock: { value: new THREE.Vector4() }, uShockR: { value: 2 }, uWind: { value: 0 }, uWindR: { value: 60 }, uDisk: { value: 1 }, uHazeH: { value: 0.4 },
    },
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  quad.renderOrder = -100;
  scene.add(quad);

  // S2: Bahn, aktueller Ort, zurückgelegter Bogen seit dem Perizentrum 2018 (nur in der S-Stern-Ansicht)
  const sgroup = new THREE.Group();
  sgroup.visible = false;
  scene.add(sgroup);
  const orbitPts = [];
  for (let i = 0; i <= 400; i++) orbitPts.push(s2Point((i / 400) * Math.PI * 2));
  const orbitLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbitPts), new THREE.LineBasicMaterial({ color: 0x9cc8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  sgroup.add(orbitLine);
  const E0 = s2Anomaly(ctx.date);
  const s2pos = s2Point(E0);
  const s2 = pointCloud([s2pos.x, s2pos.y, s2pos.z], [9, 8.4, 7.2], [120], { min: 4 });
  s2.material.depthTest = false;
  sgroup.add(s2);
  const peri = s2Point(0);
  const periDot = pointCloud([peri.x, peri.y, peri.z], [2.2, 1.6, 1.0], [60], { min: 2.5 });
  periDot.material.depthTest = false;
  sgroup.add(periDot);

  let eht = 0, ehtOn = false, simT = 0, lapseIdx = 2, lapseOn = true, view = 'cam', hot = 0, hotOn = false, wantDist = 0, hazeBase = 1;
  // Sternzerriss: Modell erst beim ersten Öffnen der Ansicht (≈ 0,1 s), Film über die Zeit des Ereignisses
  let tde = null, beta = 2, wScale = 3, rimOn = true, windOn = true, camOn = true, tdeAmt = 0, wantDir = null, tau = 0, tauOf = null, distOf = null;
  let sLen = 0, lumN = 0, mdotE = 0;
  const film = { t: 0 };
  const FILM = [0.5, 1, 1.5, 2];   // Tempo des Films je Stufe des Zeitraffer-Reglers
  const TDE_DUR = 78;
  const sDir = new THREE.Vector3(1, 0, 0);
  // Blickziel folgt im Anflug halb, beim Zerreißen ganz dem Stern bzw. der Mitte des jungen Stroms (Nahaufnahme)
  const followOf = smoothKeys([[0, 0.45], [9, 0.45], [12, 1], [23, 1], [27, 0], [TDE_DUR, 0]], { flat: true });
  const center = new THREE.Vector3();
  const build = () => {
    tde = tdeModel({ mBH: M_SGR, beta });
    const D = tde.day;
    // Zeit über die Filmsekunde: glatte Kurve in asinh(τ / 6 min) – Vorzeichen bleibt, Zeitlupe um das Perizentrum,
    // danach logarithmisch bis zehn Jahre; Rückkehr und Höhepunkt aus dem Modell
    const U = (d) => Math.asinh(d / 0.004);
    const keys = [[0, -0.2], [8, -0.06], [14, -0.012], [20, 0.006], [26, 0.06], [32, 1], [40, 20], [48, (0.85 * tde.tMin) / D],
      [54, tde.tFirst / D + 1.5], [62, tde.tPk / D], [70, 550], [TDE_DUR, 3650]];
    const fu = smoothKeys(keys.map(([s, d]) => [s, U(d)]));
    tauOf = (s) => 0.004 * Math.sinh(fu(s)) * D;
    distOf = smoothKeys([[0, 110], [8, 60], [12, 22], [15, 13], [21, 13], [24, 24], [27, 70], [32, 260], [40, 1500], [47, 1600], [52, 260], [56, 140], [62, 115], [TDE_DUR, 115]], { log: true, flat: true });
    // Richtung zum Umkehrpunkt der gebundenen Hälfte: die Kamera stellt sich so, dass der Strom im Bild nach rechts läuft
    const p = tde.piece(0, tde.tMin / 2);
    sDir.set(p.x, 0, p.z).normalize();
  };
  // Blickrichtung: Bild-rechts zwischen +x (Perizentrum genau seitlich links) und der Strom-Richtung, 29° über der Ebene
  const camDir = () => {
    const R = new THREE.Vector3(1, 0, 0).lerp(sDir, 0.4).normalize();
    return new THREE.Vector3(-R.z, 0, R.x).multiplyScalar(Math.cos(0.5)).add(new THREE.Vector3(0, Math.sin(0.5), 0)).normalize();
  };
  const whenText = (t) => {
    if (!tde) return '';
    const h = (t / tde.day) * 24;
    if (Math.abs(h) < 1) return h < 0 ? `noch ${Math.round(-h * 60)} min bis zum Perizentrum` : `${Math.round(h * 60)} min nach dem Perizentrum`;
    if (Math.abs(h) < 48) return h < 0 ? `noch ${Math.round(-h)} h bis zum Perizentrum` : `${Math.round(h)} h nach dem Perizentrum`;
    const d = h / 24;
    return d < 730 ? `Tag ${Math.round(d)}` : `Jahr ${(d / 365.25).toFixed(1).replace('.', ',')}`;
  };
  const post = { eht: [0, 0, 1.6] };
  const disk = () => view === 'cam' || view === 'eht';
  const after = (t) => view === 'tde' && tde && tau > t;
  const starPos = new THREE.Vector3(), streamPos = new THREE.Vector3(), crossPos = new THREE.Vector3();
  const hotspots = [
    { id: 'shadow', kind: 'info', pos: new THREE.Vector3(0, 0, 0) },
    { id: 'photon', kind: 'info', pos: new THREE.Vector3(0, 2.7, 0), visible: disk },
    { id: 'doppler', kind: 'info', pos: new THREE.Vector3(-8.5, 0, 1.5), visible: disk },
    { id: 'isco', kind: 'info', pos: new THREE.Vector3(3.1, 0, -0.6), visible: disk },
    { id: 'flare', kind: 'info', pos: new THREE.Vector3(3.5, 0.4, 0), visible: () => hotOn && disk() },
    { id: 's2', kind: 'info', pos: s2pos, visible: () => view === 'stars' },
    { id: 'peri', kind: 'info', pos: peri, visible: () => view === 'stars' },
    { id: 'cluster', kind: 'info', pos: new THREE.Vector3(-30000, 12000, -20000), visible: () => view === 'stars' },
    { id: 'tstar', kind: 'info', pos: starPos, visible: () => view === 'tde' && !!tde && tau < tde.tD },
    { id: 'tstream', kind: 'info', pos: streamPos, visible: () => after(tde ? tde.tD + tde.day * 0.05 : 0) && tau < tde.tFirst + 20 * tde.day },
    { id: 'tcross', kind: 'info', pos: crossPos, visible: () => after(tde ? tde.tFirst : 0) },
    { id: 'tdisk', kind: 'info', pos: new THREE.Vector3(-7, 0, 6), visible: () => after(tde ? tde.tFirst + 8 * tde.day : 0) },
    { id: 'twind', kind: 'info', pos: new THREE.Vector3(0, 16, 0), visible: () => after(tde ? tde.tFirst + 2 * tde.day : 0) && windOn && u.uWind.value > 0.05 },
  ];
  const HOME_D = 25.6, STARS_D = 52000;
  const orbitCenter = s2Point(0).add(s2Point(Math.PI)).multiplyScalar(0.5);   // Mitte der Ellipse (Peri- und Apozentrum)
  const wantTarget = new THREE.Vector3();
  const TDE_ONLY = 'Wirkt in der Ansicht „Sternzerriss“.';
  const setView = (v) => {
    view = v; ehtOn = v === 'eht'; sgroup.visible = v === 'stars';
    wantDist = v === 'stars' ? STARS_D : v === 'tde' ? 0 : HOME_D;
    wantTarget.copy(v === 'stars' ? orbitCenter : new THREE.Vector3());
    if (v === 'tde') { if (!tde) build(); film.t = 0; wantDir = camDir(); if (!camOn) wantDist = 110; }
    else wantDir = null;
  };
  const controls = [
    { id: 'view', label: 'Ansicht', value: 'cam', options: [['cam', 'Horizont'], ['eht', 'EHT-Blick'], ['stars', 'S-Sterne'], ['tde', 'Sternzerriss']], set: setView },
    { id: 'hot', label: 'Flare', show: true, value: 'off', options: [['off', 'Aus'], ['on', 'Heißer Fleck']], set: (v) => { hotOn = v === 'on'; } },
    { id: 'tdepos', label: 'Stelle im Sternzerriss', type: 'range', show: true, min: 0, max: TDE_DUR, step: 0.5, value: 0,
      marks: [[13, 'Zerriss'], [34, 'Strom'], [54, 'Rückkehr'], [62, 'Höhepunkt']],
      fmt: (v) => (tde ? whenText(tauOf(v)) : `${String(v).replace('.', ',')} s`), get: () => film.t, set: (v) => { film.t = v; },
      active: () => view === 'tde', only: TDE_ONLY },
    { id: 'tdeGo', type: 'action', label: 'Sternzerriss', button: 'Stern losschicken', run: () => { controls[0].value = 'tde'; setView('tde'); } },
  ];
  const u = mat.uniforms;
  const lapse = () => (lapseOn ? LAPSES[lapseIdx] : 1);
  const tdeL = (o) => ({ ...o, active: () => view === 'tde', only: TDE_ONLY });
  registerLayers('sgra', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', value: lapseIdx, min: 0, max: LAPSES.length - 1, step: 1, autoplay: !ctx.still,
      fmt: (i) => (view === 'tde' ? `Film ×${String(FILM[Math.round(i)]).replace('.', ',')}` : `×${LAPSES[Math.round(i)]}`),
      hint: 'Die Scheibe dreht innen schneller als außen (Kepler); ein Umlauf an der innersten stabilen Bahn dauert echt gut eine halbe Stunde. Pause = Echtzeit. In der Ansicht „Sternzerriss“ steuert der Regler das Tempo des Films (78 s für zehn Jahre).',
      set: (i, playing) => { lapseIdx = Math.round(i); if (view === 'tde' && playing && !lapseOn && film.t >= TDE_DUR - 0.05) film.t = 0; lapseOn = playing; },
      get: () => ({ value: lapseIdx, playing: lapseOn }),
      status: () => (view === 'tde' && tde ? `Sternzerriss · ${whenText(tau)}` : lapseOn ? `Scheibe ×${LAPSES[lapseIdx]}` : 'Echtzeit') },
    { id: 'riaf', type: 'range', group: 'Gas um das Loch', label: 'Heiße Strömung', min: 0, max: 4, step: 0.1, value: 1, fmt: (v) => (v ? `×${String(v).replace('.', ',')}` : 'aus'),
      set: (v) => { hazeBase = v; },
      hint: 'Modell: Sgr A* frisst wenig – das Gas bildet eine dünne, heiße und dicke Strömung um die Scheibe. Ihr Licht läuft auf denselben gekrümmten Wegen; Licht, das das Loch fast umrundet, sammelt sich zum hellen Ring am Schatten.' },
    { id: 'plunge', type: 'toggle', label: 'Einfallzone innerhalb 3 Rs', value: true, set: (v) => { u.uPlunge.value = v ? 1 : 0; },
      hint: 'Modell: Innerhalb der innersten stabilen Bahn stürzt das Gas auf Spiralbahnen ins Loch. Sein Licht wird zum Horizont hin immer stärker rotverschoben und verlischt.' },
    { id: 'gas', type: 'toggle', label: 'Gasströme im Zentrum (Minispirale)', value: true, set: (v) => { u.uGas.value = v ? 1 : 0; },
      hint: 'Ionisierte Gasfäden von Sgr A West, rund 1 bis 3 Lichtjahre um das Loch; Lage und Form hier als Modell, die Fäden werden hinter dem Loch mit gelinst.' },
    tdeL({ id: 'tdeBeta', type: 'range', group: 'Sternzerriss', label: 'Eindringtiefe β', min: 2, max: 3, step: 0.5, value: 2, fmt: (v) => `β = ${String(v).replace('.', ',')}`,
      set: (v) => { if (v !== beta) { beta = v; if (tde) build(); } },
      hint: 'Gezeitenradius geteilt durch den kleinsten Abstand der Bahn. Ab β ≈ 1,85 wird ein sonnenähnlicher Stern ganz zerrissen (Guillochon & Ramirez-Ruiz 2013). Je tiefer der Vorbeiflug, desto stärker knickt die Bahn ab und desto näher am Loch kreuzt sich der Strom.' }),
    tdeL({ id: 'tdeWidth', type: 'range', label: 'Breite des Stroms', min: 1, max: 5, step: 1, value: 3, fmt: (v) => `×${v}`, set: (v) => { wScale = v; },
      hint: 'Modell: anfangs so breit wie der Stern, nach außen mit der Wurzel des Abstands breiter. ×1 = Modellbreite; im Bild sonst kaum sichtbar.' }),
    tdeL({ id: 'tdeRim', type: 'toggle', label: 'Roter Rand im Licht des Rückfalls', value: true, set: (v) => { rimOn = v; },
      hint: 'Sobald Gas zurückfällt und aufleuchtet, wird die Oberfläche des Stroms ionisiert; Wasserstoff leuchtet beim Rekombinieren rot (Hα).' }),
    tdeL({ id: 'tdeWind', type: 'toggle', label: 'Ausfluss', value: true, set: (v) => { windOn = v; },
      hint: 'Fällt mehr Gas zurück, als das Loch schlucken kann, bläst die Strahlung einen Teil davon fort – bei ASASSN-14li mit 12.000 bis 36.000 km/s (Alexander et al. 2016). Im Bild streut das dünne Gas das Licht des Zentrums.' }),
    tdeL({ id: 'tdeCam', type: 'toggle', label: 'Kamera folgt dem Film', value: true, set: (v) => { camOn = v; },
      hint: 'Abstand und Blickziel folgen dem Geschehen: nah am Perizentrum, weit draußen, wenn der Strom sich ausdehnt. Drehen geht immer.' }),
  ]);
  const fmtAU = (rs) => { const a = (rs * RS) / AU; return `${a < 10 ? a.toFixed(1).replace('.', ',') : Math.round(a).toLocaleString('de-DE')} AE`; };

  // Sternzerriss je Bild: Film, Stern, Strom-Textur, Leuchtkraft → Scheibe, Strömung, Stoß, Ausfluss; außerhalb der
  // Ansicht blenden alle Anteile weich auf den Normalzustand zurück
  function stepTde(dt, cam) {
    const on = view === 'tde' && !!tde;
    tdeAmt += ((on ? 1 : 0) - tdeAmt) * Math.min(1, dt * 2.5);
    if (!tde || (!on && tdeAmt < 0.003)) {
      tdeAmt = on ? tdeAmt : 0;
      u.uSN.value = 0; u.uStarOn.value = 0; u.uShock.value.w = 0; u.uWind.value = 0; u.uDisk.value = 1; u.uT0.value = 3600;
      u.uHazeH.value = 0.4; u.uHaze.value = hazeBase; u.uRim.value = 0;
      return;
    }
    if (on && lapseOn) film.t = Math.min(TDE_DUR, film.t + dt * FILM[lapseIdx]);
    tau = tauOf(film.t);
    const D = tde.day;
    if (tau < tde.tD) {
      const st = tde.star(tau);
      starPos.set(st.x, 0, st.z);
      // Radius wie die Strombreite überhöht, mindestens knapp zwei Bildpunkte (sonst aus der Ferne unsichtbar)
      u.uStar.value.set(st.x, 0, st.z, Math.max(tde.rs * wScale, 1.8 * u.uPx.value * cam.position.distanceTo(starPos)));
      u.uStarAx.value.set(st.x, 0, st.z).normalize();
      u.uStarS.value = st.stretch;
      u.uStarV.value.set(st.vx, 0, st.vz);
      u.uStarOn.value = tdeAmt;
    } else u.uStarOn.value = 0;
    const N = tde.stream(tau, streamBuf, grpBuf, wScale);
    u.uSN.value = N;
    streamTex.needsUpdate = true;
    for (let g = 0; g < MAXP / GRP; g++) u.uGrp.value[g].set(grpBuf[g * 4], grpBuf[g * 4 + 1], grpBuf[g * 4 + 2], 0);
    sLen = 0;
    for (let i = 1; i < N; i++) sLen += Math.hypot(streamBuf[i * 4] - streamBuf[i * 4 - 4], streamBuf[i * 4 + 1] - streamBuf[i * 4 - 3]);
    if (tau < tde.tD) center.copy(starPos);
    else if (N) { center.set(0, 0, 0); for (let i = 0; i < N; i++) { center.x += streamBuf[i * 4] / N; center.z += streamBuf[i * 4 + 1] / N; } }
    if (tau >= tde.tD) {
      const k = Math.round(tde.pieces.length * 0.3), b = tde.pieces[k];
      if (tau < b.tEnd) { const p = tde.piece(k, tau); streamPos.set(p.x, 0, p.z); }
    }
    crossPos.set(tde.cross.x, 0, tde.cross.z);
    // Leuchtkraft relativ zum Höhepunkt; die neue Scheibe baut sich nach der ersten Kreuzung auf
    const L = tde.lum(tau);
    lumN = L / tde.Lpk;
    mdotE = tde.mdot(tau) / tde.mdotEdd;
    const build01 = THREE.MathUtils.smoothstep(tau, tde.tFirst, tde.tFirst + 0.35 * tde.tMin);
    const diskT = build01 * (0.12 + 2.0 * Math.pow(lumN, 0.6));
    u.uSGain.value = tdeAmt;
    u.uDisk.value = 1 + (diskT - 1) * tdeAmt;
    // Temperatur der Scheibe ∝ L^¼ (Höhepunkt ≈ 30.000 K), dicke Strömung bei Rückfall über der Eddington-Rate
    const T = Math.max(3600, 30000 * Math.pow(Math.max(lumN, 1e-6), 0.25));
    u.uT0.value = 3600 + (T - 3600) * tdeAmt * build01;
    u.uHazeH.value = 0.4 + 0.45 * Math.min(1, mdotE) * build01 * tdeAmt;
    u.uHaze.value = hazeBase * (1 + 4 * lumN * build01 * tdeAmt);
    const sh = tde.mdot(tau) / tde.mdot(tde.tPk);
    u.uShock.value.set(tde.cross.x, 0, tde.cross.z, tdeAmt * Math.min(2.5, 2.2 * Math.pow(sh, 0.8)));
    u.uShockR.value = 1.2 + 0.04 * tde.cross.r;
    u.uWind.value = windOn ? tdeAmt * build01 * Math.min(1.4, 1.3 * Math.pow(lumN, 0.8)) : 0;
    u.uWindR.value = 60;
    u.uRim.value = rimOn && tau > tde.tFirst ? tdeAmt * Math.min(1.5, 0.15 + 1.4 * Math.sqrt(lumN)) : 0;
    void D;
  }

  return {
    scene, camera, unit: RS, hotspots, controls, post, resScale: 0.62, msaa: false, mips: true,
    home: { pos: new THREE.Vector3(0, 5.4, 25), target: new THREE.Vector3(0, 0, 0) },
    orbit: { minDistance: 6, maxDistance: 140, cineSpeed: 0.5 },
    // warme Lichter, neutrale Schatten: die Farbe kommt aus der Scheibe (Schwarzkörper + Doppler), Bloom für den Glutschein
    look: { exposure: 1.0, bloom: 0.13, sat: 1.2, con: 0.16, sh: [0.99, 0.99, 1.03], hi: [1.05, 1.0, 0.93], vig: 0.46 },
    // Ansichtswechsel: Grenzen der Steuerung, Abstand (logarithmisch), Blickziel und – beim Sternzerriss – Blickrichtung weich
    // nachführen; im Film folgen Abstand und Ziel der Filmsekunde (abschaltbar)
    orbitUpdate(c, dt) {
      c.maxDistance = view === 'stars' ? 120000 : view === 'tde' ? 6000 : 140;
      c.minDistance = view === 'stars' ? 2000 : 6;
      if (view === 'tde' && tde && camOn) {
        const want = distOf(film.t);
        wantTarget.set(1, 0, 0).lerp(sDir, 0.4).normalize().multiplyScalar((want > 400 ? 0.3 : 0.22) * want).lerp(center, followOf(film.t));
        wantDist = want;
      }
      if (wantDir) {
        const off = camera.position.clone().sub(c.target), d = off.length();
        off.normalize().lerp(wantDir, Math.min(1, dt * 1.6)).normalize();
        camera.position.copy(c.target).addScaledVector(off, d);
        if (off.dot(wantDir) > 0.9995) wantDir = null;
      }
      if (!wantDist) return;
      const k = Math.min(1, dt * 2.2);
      const off = camera.position.clone().sub(c.target);
      c.target.lerp(wantTarget, k);
      const d = off.length();
      const nd = Math.exp(Math.log(d) + (Math.log(wantDist) - Math.log(d)) * k);
      camera.position.copy(c.target).addScaledVector(off.normalize(), nd);
      if (view !== 'tde' && Math.abs(Math.log(nd / wantDist)) < 0.01 && c.target.distanceTo(wantTarget) < wantDist * 0.01) wantDist = 0;
    },
    update(dt, t, cam) {
      simT += dt * lapse() / RS_C;   // Zeit in Rs/c
      stepTde(dt, cam);
      u.uTime.value = simT % 1e5;
      cam.updateMatrixWorld();
      u.uCam.value.copy(cam.position);
      u.uCamWorld.value.copy(cam.matrixWorld);
      u.uProjInv.value.copy(cam.projectionMatrixInverse);
      // Turbulenz-Schichten: a und b um einen halben Takt versetzt, jede beim Neubeginn unsichtbar (Gewicht 0)
      const ph = simT / WIN, fa = ph % 1;
      u.uTa.value = fa * WIN; u.uSa.value = Math.floor(ph) % 64;
      u.uTb.value = ((ph + 0.5) % 1) * WIN; u.uSb.value = (Math.floor(ph + 0.5) % 64) + 0.5;
      u.uWa.value = 1 - Math.abs(2 * fa - 1);
      hot += ((hotOn ? 1 : 0) - hot) * Math.min(1, dt * 2);
      u.uHot.value = hot;
      // Fleck auf 3,5 Rs dreht wie die Scheibe (Winkel atan(z, x) nimmt ab); Phase in double gerechnet
      u.uHotPh.value = (OM_HOT * simT) % TAU;
      u.uPlPh.value = (OM_ISCO * simT) % TAU;
      hotspots[4].pos.set(3.5 * Math.cos(-u.uHotPh.value), 0.4, 3.5 * Math.sin(-u.uHotPh.value));
      // EHT-Auflösung ≈ 20 µas FWHM; 1 Rs ≙ 10,25 µas bei 8,28 kpc → σ ≈ 0,83 Rs, als Anteil der Bildhöhe
      eht += ((ehtOn ? 1 : 0) - eht) * Math.min(1, dt * 3);
      const d = cam.position.length();
      post.eht[0] = eht;
      post.eht[1] = 0.83 / (2 * d * Math.tan((camera.fov * Math.PI) / 360));
      const near = Math.max(0.1, d * 0.002);
      if (Math.abs(near - camera.near) / camera.near > 0.2) { camera.near = near; camera.updateProjectionMatrix(); }
    },
    live: () => {
      if (view === 'stars') return `S2 heute ${fmtAU(s2pos.length())} vom Loch · Perizentrum ${fmtAU(peri.length())} (Mai 2018, 7.650 km/s) · Umlauf 16,05 Jahre`;
      if (view === 'tde' && tde) {
        const w = whenText(tau);
        if (tau < tde.tD) return `Stern im Anflug · ${w} · Abstand ${fmtAU(starPos.length())} · Gezeitenradius ${fmtAU(tde.rt)}`;
        if (tau < tde.tFirst) return `${w} · Trümmerstrom ${fmtAU(sLen)} lang · die gebundene Hälfte kehrt nach rund ${Math.round(tde.tMin / tde.day)} Tagen zurück, die andere entkommt`;
        return `${w} · Rückfall ${mdotE >= 1 ? `${mdotE.toFixed(1).replace('.', ',')}-fach über` : `${Math.round(mdotE * 100)} % der`} Eddington-Rate · Strom kreuzt sich ${fmtAU(tde.cross.r)} vom Loch`;
      }
      return `${lapseOn ? `Zeitraffer ×${lapse()}` : 'Echtzeit'} · innerste stabile Bahn: Umlauf echt ${Math.round(TAU / OM_ISCO * RS_C / 60)} min${hotOn ? ` · Flare: Umlauf auf 3,5 Rs echt ≈ ${Math.round(TAU / OM_HOT * RS_C / 60)} min` : ''}`;
    },
    setDetail(d) { u.uSteps.value = steps(d); u.uOct.value = d > 0.7 ? 4 : 3; },
    setPixelRatio(pr, H) {
      s2.userData.setPx(pr, H, camera.fov); periDot.userData.setPx(pr, H, camera.fov);
      u.uPx.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, H);   // Winkel je Bildpunkt (H = Höhe des Bildpuffers)
    },
    dispose: () => { streamTex.dispose(); disposeScene(scene); },
  };
}
