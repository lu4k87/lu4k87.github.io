// Look „Sonne neu“ der Station Sonne (Vorschau 26.10.2026, Vorlage = Shader-Mockup live/sonne.html in der Schatzkammer):
// Oberfläche als Kugel-Shader – A Glutkruste (dunkle Kruste, glühende Magnetadern) und B Plasmateppich wie SDO 304 Å
// (Netzwerk, Fackelfelder, Filamente und koronale Löcher aus denselben Daten wie die Kanalbilder, SUN_MASKS) –, Rand und
// Ausbrüche auf einer Bildtafel um die Sonnenmitte (BILLBOARD_AIM_VERT, r in Einheiten des sichtbaren Rands): Rand
// Flammenkranz | Bogen-Arkaden | feiner Saum mit Spikulen, Ausbruch Filament-Eruption | Flare mit Schockwelle (Bänder und
// Moreton-Welle auf der Scheibe im Kugel-Shader) | Protuberanz reißt ab. Künstlerisch verstärkt: Höhen, Helligkeit und
// Tempo sind überzeichnet, die Glutkruste ist kein Messbild. Ein Ausbruch dauert ERUPT_T Sekunden mit einem weichen
// Anstieg (kein Blitzen, weit unter 3 Hz, AGENTS.md §0). Linear vor ACES (post.js), daher ohne eigenes Tonemapping.

import { NOISE } from './glsl.js';
import { SUN_MASKS, SPOTS } from './sunfx.js';

export const ERUPT_T = 12;   // Sekunden je Ausbruch (Vorschau F3: alle 12 s)
export const LOOK_EXT = 2.6; // Bildtafel reicht bis 2,6 Randradien (Eruption bis ≈ 2,3)
// Qualitätsstufe (ctx.detail 0,55 | 0,8 | 1) → fbm-Oktaven und Bögen je Arkade
export const lookDefines = (detail) => (detail > 0.9 ? { OCT: 5, ARC_N: 6 } : detail > 0.7 ? { OCT: 4, ARC_N: 5 } : { OCT: 3, ARC_N: 3 });

// Simplex-Rauschen 3D nach Ashima Arts/Stefan Gustavson (MIT) wie im Mockup – die Grat-Potenzen der Adern sind auf seine
// Verteilung abgestimmt. Dazu fbm (OCT Oktaven), fbm3, Zellmuster und Hash-Hilfen.
const SNOISE = /* glsl */ `
vec4 perm4(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 tis4(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = perm4(perm4(perm4(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  vec3 ns = 0.142857142857 * vec3(2.0, 0.5, 1.0) - vec3(0.0, 1.0, 0.0);
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 nr = tis4(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3))); p0 *= nr.x; p1 *= nr.y; p2 *= nr.z; p3 *= nr.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0); m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbmL(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < OCT; i++) { s += a * snoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float fbm3(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * snoise(p); p = p * 2.07 + 9.3; a *= 0.5; } return s; }
// snoise liegt knapp über ±1 → ohne max() wird ridge negativ und pow() NaN; der Bloom bläht das zu weißen Scheiben auf
float ridge(float n) { return max(1.0 - abs(n), 0.0); }
float hash1(float n) { return fract(sin(n) * 43758.5453); }
vec3 hash3u(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
float wrapA(float a) { return mod(a + 3.14159265, 6.2831853) - 3.14159265; }
`;

// ---------- Kugel: Oberfläche A/B + Flare-Bänder und Schockwelle (Ausbruch B) ----------
// g = mitrotierender Ort wie in SUN_FRAG (differentielle Rotation über uDays), damit aktive Regionen (uSpot), Filamente
// und Löcher an denselben Stellen liegen wie in den Kanalbildern und unter den Abzeichen. Aus der Nähe (Pixel klein,
// fwidth) kommen feinere Adern bzw. Körnung dazu; aus der Ferne blenden sie aus, damit nichts flimmert.
export const LOOK_SURF_FRAG = /* glsl */ `
${NOISE}
${SNOISE}
#define SPOTS ${SPOTS}
uniform vec4 uSpot[SPOTS];
${SUN_MASKS}
uniform float uTime, uDays, uSurf, uAct, uGain, uFlK;
uniform vec3 uFlS;
varying vec3 vN, vP, vO;
varying vec2 vUv;
vec2 cells2(vec3 p, float t) {
  vec3 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)); vec3 h = hash3u(i + g);
    vec3 r = g + 0.5 + 0.38 * sin(t * 0.6 + 6.2831 * h) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(vec2(d1, d2));
}
// A Glutkruste (Vorlage „Star in Blender“): Adern dort heller, wo die Sonne aktiv ist (uAct, aktive Regionen ar)
vec3 surfA(vec3 q, float t, float mu, float ar, float fine) {
  vec3 w = q * 2.0 + 0.7 * vec3(fbm3(q * 1.6 + vec3(0.0, t * 0.02, 0.0)), fbm3(q * 1.6 + vec3(5.2, 1.3, t * 0.02)), fbm3(q * 1.6 + vec3(2.1, 7.7, -t * 0.02)));
  float act = max(smoothstep(0.0, 0.5, fbm3(q * 1.3 + 3.0)) * (0.5 + 0.7 * uAct), 0.9 * min(ar, 1.0));
  float flow = 0.5 + 0.5 * fbm3(w * vec3(0.8, 2.4, 0.8) + t * 0.01);
  float v1 = pow(ridge(snoise(w + t * 0.015)), 11.0);
  float v2 = pow(ridge(snoise(w * 2.3 - t * 0.02)), 16.0);
  float v3 = pow(ridge(snoise(w * 5.2 + t * 0.03)), 22.0);
  float v4 = fine > 0.001 ? pow(ridge(snoise(w * 11.0 - t * 0.04)), 26.0) * fine : 0.0;
  float veins = (v1 + 0.5 * v2 + 0.25 * v3 + 0.15 * v4) * (0.15 + 1.1 * act) * (0.6 + 0.8 * flow);
  float crust = 0.5 + 0.5 * fbmL(q * 7.0 + t * 0.01);
  if (fine > 0.001) crust = clamp(crust + 0.12 * fine * snoise(q * 40.0 + t * 0.02), 0.0, 1.0);
  vec3 col = mix(vec3(0.03, 0.004, 0.0), vec3(0.32, 0.06, 0.006), crust * crust * (0.35 + 0.9 * act));
  col += veins * mix(vec3(1.9, 0.42, 0.04), vec3(4.6, 2.6, 0.8), clamp(veins - 0.45, 0.0, 1.0));
  col *= 0.55 + 0.45 * sqrt(mu);
  return col + vec3(1.6, 0.4, 0.04) * pow(1.0 - mu, 3.0) * 1.1;
}
// B Plasmateppich (SDO 304 Å, He II ≈ 50.000 K): Netzwerk an Supergranulen-Rändern, Fackelfelder über den aktiven
// Regionen, Filamente dunkel (filMask + feine Fäden), koronale Löcher gedämpft (holeMask)
vec3 surfB(vec3 q, float t, float mu, float ar, float fine) {
  float lat = asin(clamp(q.y, -1.0, 1.0));
  vec3 w = q + 0.04 * vec3(snoise(q * 9.0 + t * 0.03), snoise(q * 9.0 + 3.1), snoise(q * 9.0 - t * 0.03));
  vec2 c = cells2(w * 16.0, t * 0.4);
  float net = 1.0 - smoothstep(0.03, 0.16, c.y - c.x);
  float mott = 0.5 + 0.5 * fbmL(q * 34.0 + t * 0.04);
  if (fine > 0.001) mott = clamp(mott + 0.15 * fine * snoise(q * 140.0 + t * 0.05), 0.0, 1.0);
  float belt = exp(-pow((abs(lat) - 0.33) / 0.2, 2.0));
  float plage = smoothstep(0.18, 0.62, fbm3(q * 2.2 + 1.7)) * (0.35 + 0.65 * belt) * (0.4 + 0.8 * uAct);
  plage = max(plage, 0.8 * min(ar, 1.2));
  float thin = pow(ridge(snoise(q * vec3(2.6, 6.5, 2.6) + 9.0)), 28.0) * smoothstep(0.0, 0.4, fbm3(q * 1.4 + 4.0));
  float fil = max(filMask(q), 0.6 * thin), hole = holeMask(q);
  vec3 col = vec3(0.62, 0.1, 0.008) * (0.3 + 0.7 * mott + 0.65 * net);
  col += vec3(2.8, 0.95, 0.18) * plage * (0.35 + 1.0 * net) * (0.6 + 0.7 * mott);
  col *= (1.0 - 0.85 * fil) * (1.0 - 0.6 * hole);
  col *= 0.75 + 0.25 * mu;
  return col + vec3(1.3, 0.22, 0.02) * pow(1.0 - mu, 5.0) * 1.5;
}
// Ausbruch B auf der Scheibe: zwei gebogene Flare-Bänder um uFlS, die auseinanderwandern, und die Moreton-Welle
vec3 flareDisk(vec3 n, float k, float t) {
  vec3 S = uFlS;
  float gg = acos(clamp(dot(n, S), -1.0, 1.0));
  float front = 0.06 + 1.5 * smoothstep(0.1, 0.75, k);
  if (gg > 0.35 && abs(gg - front) > 0.12) return vec3(0.0);
  float rib = smoothstep(0.08, 0.16, k) * (1.0 - smoothstep(0.45, 0.95, k));
  vec3 e1 = normalize(cross(vec3(0.0, 1.0, 0.0), S)); vec3 e2 = cross(S, e1);
  vec3 dlt = n - S; float u = dot(dlt, e1), v = dot(dlt, e2);
  float sep = 0.012 + 0.05 * smoothstep(0.08, 0.7, k);
  float bend = 0.5 * u * u / 0.09;
  float knots = max(0.35 + 0.9 * fbm3(vec3(u * 30.0, v * 10.0, t * 0.2)), 0.0);
  float band = exp(-pow((abs(v - bend) - sep) / 0.011, 2.0)) * exp(-pow(u / 0.08, 2.0)) * knots;
  vec3 col = vec3(4.0, 2.4, 0.8) * band * rib * 1.2;
  float broken = max(0.3 + 0.9 * fbm3(n * 9.0 + t * 0.05), 0.0);
  col += vec3(2.2, 0.75, 0.12) * exp(-pow((gg - front) / 0.03, 2.0)) * 0.35 * broken * smoothstep(0.16, 0.3, k) * (1.0 - smoothstep(0.55, 0.85, k));
  return col;
}
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float mu = clamp(dot(N, V), 0.0, 1.0);
  float s2 = vO.y * vO.y;
  float om = 14.713 - 2.396 * s2 - 1.787 * s2 * s2;
  vec2 uv = vec2(fract(vUv.x - om * uDays / 360.0), vUv.y);
  float ph = uv.x * 6.2831853, th = (1.0 - uv.y) * 3.14159265;
  vec3 g = vec3(-cos(ph) * sin(th), cos(th), sin(ph) * sin(th));
  float fine = 1.0 - smoothstep(0.0015, 0.005, length(fwidth(vO)));
  float ar = 0.0;
  for (int i = 0; i < SPOTS; i++) {
    vec4 s = uSpot[i];
    if (s.w == 0.0) continue;
    vec3 d = g - s.xyz;
    ar += exp(-dot(d, d) / 0.005);
  }
  vec3 col = uSurf < 0.5 ? surfA(g, uTime, mu, ar, fine) : surfB(g, uTime, mu, ar, fine);
  if (uFlK >= 0.0) col += flareDisk(g, uFlK, uTime);
  gl_FragColor = vec4(col * uGain, 1.0);
}
`;

// ---------- Bildtafel: Glühen, Rand A/B/C, Ausbruch A/B/C ----------
// p in Randradien im Bild (Achsen u, v der Tafel), uPole = Pol im Bild; Bögen der Arkaden sitzen relativ zum Pol (uArc:
// erste Arkade über der Hauptregion der Heimpose). Ausbruch: uEK = Fortschritt 0 … 1 (< 0 = keiner), uEDir = Richtung des
// Randpunkts (A, C), uESp = Fußpunkt auf der Scheibe (B), uEB = Sichtbarkeit von B. Dünne Bögen werden aus der Ferne
// mindestens einen Pixel breit (Helligkeit bleibt erhalten), sonst flimmern sie.
export const LOOK_RIM_FRAG = /* glsl */ `
${SNOISE}
uniform float uTime, uExt, uGain, uSurf, uRim, uE, uEK, uEB, uArc;
uniform vec2 uPole, uEDir, uESp;
varying vec2 vQ;
// A Flammenkranz: Zungen, die nach außen lodern (Muster strömt nach außen, Formen im Bildraum – keine Speichen)
vec3 rimA(vec2 p, float r, float t) {
  vec2 d = p / r; float h = max(r - 1.0, 0.0);
  float hmax = 0.08 + 0.42 * smoothstep(-0.25, 0.65, snoise(vec3(d * 1.7, t * 0.04)));
  vec2 fp = p - d * (t * 0.11);
  float n1 = fbm3(vec3(fp * 3.0, t * 0.05));
  float n2 = fbm3(vec3(fp * 7.0 + n1 * 0.9, t * 0.08));
  float tongue = smoothstep(0.0, 0.5, 0.45 + 0.6 * n1 + 0.35 * n2 - h / hmax);
  float wisp = pow(ridge(snoise(vec3(fp * 8.0 + vec2(n1, n2) * 1.3, t * 0.1))), 9.0);
  float curl = pow(ridge(snoise(vec3(fp * 15.0 + vec2(n2, -n1) * 1.8, t * 0.14))), 14.0);
  float f = tongue * (0.4 + 0.8 * n2 + 1.1 * wisp + 0.6 * curl) * exp(-h * 2.2);
  float inside = r < 1.0 ? smoothstep(0.88, 1.0, r) * 0.5 : 1.0;
  vec3 col = mix(vec3(1.4, 0.38, 0.04), vec3(3.4, 1.8, 0.45), clamp(f - 0.2, 0.0, 1.0)) * f * 1.2;
  col += vec3(1.2, 0.36, 0.04) * exp(-h * 10.0) * 0.8;
  return col * inside;
}
// B Bogen-Arkaden: vier Aktivgebiete am Rand, je ARC_N Magnetschleifen nebeneinander, Licht läuft entlang der Bögen
vec3 rimB(vec2 p, float r, float t, float px) {
  float ang = atan(p.y, p.x) - atan(uPole.y, uPole.x) - uArc; float h = r - 1.0; vec3 col = vec3(0.0);
  float cw = max(0.0034, 0.7 * px), cg = 0.0034 / cw, mid = 0.5 * float(ARC_N - 1);
  for (int i = 0; i < 4 * ARC_N; i++) {
    float fi = float(i); float ci = floor(fi / float(ARC_N)); float ki = mod(fi, float(ARC_N));
    float sd = hash1(ci * 7.13 + 1.0); float sk = hash1(fi * 3.31 + 0.7);
    float a = ci * 1.57 + (sd - 0.5) * 0.6 * step(0.5, ci) + (ki - mid) * 0.075 + (sk - 0.5) * 0.05;
    float ag = (1.0 - abs(ki - mid) * 0.16) * (0.45 + 0.55 * hash1(fi * 9.1));
    float w = 0.028 + 0.06 * sk;
    float H = (0.06 + 0.26 * pow(hash1(fi * 5.3 + 3.0), 1.4) * (0.6 + 0.4 * ag)) * (1.0 + 0.07 * sin(t * 0.35 + sk * 6.0));
    float tilt = (sd - 0.5) * 0.8 + (sk - 0.5) * 0.6;
    float x = wrapA(ang - a) * r; float y = h + 0.004; x -= tilt * y;
    if (y < 0.0 || abs(x) > w * 1.8) continue;
    for (int k = 0; k < 2; k++) {
      float fk = float(k); float ww = w * (0.94 + 0.08 * fk); float hh = H * (0.95 + 0.07 * fk);
      float e = length(vec2(x / ww, y / hh));
      float dd = (e - 1.0) * e / max(length(vec2(x / (ww * ww), y / (hh * hh))), 1e-3);
      float s = atan(y / hh, x / ww);
      float run = 0.5 + 0.5 * sin(s * 4.0 - t * 1.3 + sd * 9.0 + fk * 1.3);
      float foot = 0.55 + 0.45 * (1.0 - sin(s));
      float core = exp(-pow(dd / cw, 2.0)) * cg; float halo = exp(-abs(dd) / 0.02) * 0.16;
      col += (core * mix(vec3(1.7, 0.45, 0.05), vec3(3.6, 1.8, 0.45), run * foot) + halo * vec3(1.6, 0.4, 0.05)) * (0.35 + 0.65 * run) * foot * (0.2 + 0.8 * ag);
    }
  }
  return col + vec3(1.3, 0.36, 0.04) * exp(-max(h, 0.0) * 12.0) * (r > 1.0 ? 1.0 : smoothstep(0.93, 1.0, r));
}
// C feiner SDO-Saum (Vorlage CME 4K): Spikulen-Wald als Haarsaum, niedrige Protuberanz-Hecken, schwache Korona
vec3 rimC(vec2 p, float r, float t) {
  float h = r - 1.0;
  if (r < 1.0) return vec3(1.7, 0.25, 0.03) * smoothstep(0.985, 1.0, r);
  vec2 d = p / r; float ang = atan(p.y, p.x) - atan(uPole.y, uPole.x);
  float hs = 0.02 + 0.05 * (0.5 + 0.5 * snoise(vec3(d * 9.0, t * 0.05)));
  float jets = pow(max(0.5 + 0.5 * snoise(vec3(d * 150.0, h * 12.0 - t * 0.5)), 0.0), 4.0);
  vec3 col = vec3(2.6, 0.5, 0.06) * jets * smoothstep(hs, 0.0, h) * 2.2;
  col += vec3(2.2, 0.32, 0.03) * exp(-h * 26.0);
  float hedge = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i); float a = fi * 1.05 + 0.3 + 0.3 * sin(fi * 4.1);
    hedge += exp(-pow(wrapA(ang - a) / (0.06 + 0.08 * hash1(fi)), 2.0)) * (0.08 + 0.12 * hash1(fi + 5.0));
  }
  float cloud = max(fbm3(vec3(d * 20.0, h * 14.0 - t * 0.12)) + 0.3, 0.0);
  float wisps = pow(ridge(snoise(vec3(d * 40.0, h * 20.0 - t * 0.2))), 6.0);
  col += vec3(2.6, 0.5, 0.07) * (cloud + 0.8 * wisps) * smoothstep(hedge, 0.0, h) * step(0.001, hedge) * 2.0;
  return col + vec3(1.3, 0.32, 0.05) * exp(-h * 5.0) * 0.3 * (0.7 + 0.3 * snoise(vec3(d * 5.0, t * 0.04)));
}
// A Filament-Eruption: verdrillter Plasmaschlauch hebt ab, Auswurf-Blase dahinter
vec3 erA(vec2 p, float r, float t, float k) {
  float a0 = atan(uEDir.y, uEDir.x);
  float x = wrapA(atan(p.y, p.x) - a0) * max(r, 1.0); float y = r - 1.0;
  float L = mix(0.04, 1.05, smoothstep(0.04, 0.8, k)); float fade = 1.0 - smoothstep(0.8, 1.0, k);
  vec3 col = vec3(0.0);
  if (y > -0.03 && y < L + 0.2) {
    float yy = max(y, 0.0);
    float xc = -0.1 * pow(yy, 1.2) + 0.035 * sin(yy * 7.0 - t * 0.7);
    float dx = (x - xc) / (0.022 + 0.07 * yy);
    float braid = 0.5 + 0.5 * sin(dx * 5.0 + yy * 22.0 - t * 2.2);
    float tex = max(0.55 + 0.7 * fbm3(vec3(dx * 0.8, yy * 8.0 - t * 0.4, t * 0.1)), 0.0);
    float I = exp(-dx * dx * 1.8) * (0.3 + pow(braid, 3.0)) * tex * (1.0 - smoothstep(L - 0.3, L, yy)) * fade * (1.0 - 0.35 * smoothstep(0.0, 1.0, yy));
    col += mix(vec3(1.8, 0.32, 0.03), vec3(4.8, 2.9, 1.0), clamp(I * 1.3 - 0.35, 0.0, 1.0)) * I * 1.5;
  }
  if (k > 0.3 && y > 0.0) {
    float e = length(vec2(x / (0.7 * L), y / (1.1 * L)));
    float shell = exp(-pow((e - 1.0) / 0.14, 2.0)) * (0.3 + 0.9 * max(fbm3(vec3(x, y, t * 0.05) * 5.0), 0.0));
    col += vec3(1.5, 0.6, 0.18) * shell * 0.2 * smoothstep(0.3, 0.5, k) * fade;
  }
  float sw = smoothstep(0.04, 0.16, k) * (1.0 - smoothstep(0.3, 0.7, k));
  return col + vec3(4.0, 2.4, 0.9) * exp(-length(vec2(x, y + 0.02)) / 0.05) * sw * 1.2;
}
// B Flare (Teil über der Scheibe): Bogen-Arkade über dem Fußpunkt, weiches Aufleuchten (≈ 0,7 s an, ≈ 1 s ab)
vec3 erB(vec2 p, float k, float px) {
  vec2 Sp = uESp; vec2 rd = length(Sp) > 1e-3 ? normalize(Sp) : vec2(0.0, 1.0); vec2 tg = vec2(-rd.y, rd.x);
  vec2 lq = vec2(dot(p - Sp, tg), dot(p - Sp, rd));
  float flash = exp(-pow((k - 0.14) / 0.06, 2.0));
  float rib = smoothstep(0.08, 0.16, k) * (1.0 - smoothstep(0.45, 0.95, k));
  float grow = 0.02 + 0.09 * smoothstep(0.12, 0.8, k);
  float cw = max(0.003, 0.7 * px), cg = 0.003 / cw;
  vec3 col = vec3(0.0);
  if (lq.y >= 0.0) for (int j = 0; j < 7; j++) {
    float fj = float(j); float ww = 0.02 + 0.03 * smoothstep(0.08, 0.6, k);
    float hh = grow * (0.8 + 0.3 * hash1(fj));
    float d = abs(length(vec2((lq.x - (fj - 3.0) * 0.022) / ww, lq.y / hh)) - 1.0) * min(ww, hh);
    col += vec3(3.8, 2.4, 1.0) * exp(-pow(d / cw, 2.0)) * cg * rib * 0.9;
  }
  float ds = length(p - Sp);
  return col + vec3(3.0, 1.9, 0.9) * exp(-ds / 0.07) * flash * 1.1 + vec3(1.2, 0.7, 0.3) * exp(-ds / 0.3) * flash * 0.3;
}
// C Protuberanz reißt ab: Bogen wächst, verdrillt sich, öffnet am Scheitel, Material regnet zurück
vec3 erC(vec2 p, float r, float t, float k) {
  float a1 = atan(uEDir.y, uEDir.x);
  float x = wrapA(atan(p.y, p.x) - a1) * max(r, 1.0); float y = r - 1.0;
  if (y < -0.01) return vec3(0.0);
  float w = 0.26; float H = mix(0.14, 0.72, smoothstep(0.0, 0.62, k));
  float gap = max(k - 0.6, 0.0) * 2.6, lift = max(k - 0.62, 0.0) * 0.9;
  vec3 col = vec3(0.0);
  for (int j = 0; j < 5; j++) {
    float fj = float(j);
    float ww = w * (1.0 - 0.05 * fj); float hh = H * (1.0 - 0.06 * fj);
    float e = length(vec2(x / ww, y / hh)); float s = atan(y / hh, x / ww);
    float d = (e - 1.0) * e / max(length(vec2(x / (ww * ww), y / (hh * hh))), 1e-3) + 0.018 * sin(s * 9.0 + t * 1.1 + fj * 1.7);
    float open = gap > 0.0 ? smoothstep(gap * 0.5, gap * 0.5 + 0.12, abs(s - 1.5707963)) : 1.0;
    float tex = max(0.5 + 0.8 * fbm3(vec3(s * 3.0, fj, t * 0.15)), 0.0);
    col += mix(vec3(2.6, 0.45, 0.08), vec3(5.0, 1.9, 0.5), tex * 0.5) * exp(-pow(d / 0.009, 2.0)) * tex * open * 0.6;
    col += vec3(1.3, 0.2, 0.04) * exp(-abs(d) / 0.03) * 0.08 * open;
  }
  if (lift > 0.0) {
    float b = length(vec2(x, y) - vec2(0.0, H + lift));
    col += vec3(2.6, 0.6, 0.12) * exp(-pow(b / (0.06 + lift * 0.15), 2.0)) * 0.9 * (1.0 - smoothstep(0.85, 1.0, k)) * (0.6 + 0.6 * fbm3(vec3(x, y, t) * 8.0));
    for (int m = 0; m < 14; m++) {
      float fm = float(m); float side = mod(fm, 2.0) < 1.0 ? -1.0 : 1.0;
      float s = 1.5707963 - side * (0.25 + fract(hash1(fm * 3.1) + t * 0.22) * 1.25);
      vec2 dp = vec2(cos(s) * w * (1.0 - 0.05 * mod(fm, 5.0)), sin(s) * H * (1.0 - 0.06 * mod(fm, 5.0))) - vec2(x, y);
      col += vec3(3.6, 1.0, 0.25) * exp(-dot(dp, dp) / 0.00006) * smoothstep(0.62, 0.7, k);
    }
  }
  return col;
}
void main() {
  float rq = length(vQ);
  if (rq > 1.0) discard;
  vec2 p = vQ * uExt; float r = length(p), t = uTime, px = fwidth(r);
  vec3 gc = uSurf < 0.5 ? vec3(1.6, 0.4, 0.04) : vec3(1.5, 0.26, 0.03);
  vec3 col = vec3(0.0);
  if (r > 1.0) col += gc * (exp(-(r - 1.0) * 7.0) * 0.14 * (uSurf < 0.5 ? 1.0 : 0.8) + exp(-(r - 1.0) * 1.8) * 0.02);
  if (r > 0.86 && uRim > 0.5) col += uRim < 1.5 ? rimA(p, r, t) : (uRim < 2.5 ? rimB(p, r, t, px) : rimC(p, r, t));
  if (uEK >= 0.0) {
    if (uE < 1.5) { if (r > 0.96) col += erA(p, r, t, uEK); }
    else if (uE < 2.5) col += erB(p, uEK, px) * uEB;
    else if (r > 0.98) col += erC(p, r, t, uEK);
  }
  gl_FragColor = vec4(col * uGain * (1.0 - smoothstep(0.85, 1.0, rq)), 1.0);
}
`;
