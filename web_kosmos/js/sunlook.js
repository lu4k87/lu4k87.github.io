// Look „Sonne neu“ der Station Sonne (Vorschau 26.10.2026, Vorlage = Shader-Mockup live/sonne.html in der Schatzkammer;
// Kino-Überarbeitung 26.10.2026): Oberfläche als Kugel-Shader – A Glutkruste (dunkle Kruste, glühende Magnetadern,
// Flecken mit Penumbra-Fasern) und B Plasmateppich wie SDO 304 Å (Netzwerk, Fackelfelder, Filamente und koronale Löcher
// aus denselben Daten wie die Kanalbilder, SUN_MASKS), beide mit hellem „Moos“ an den Fußpunkten der Bögen –, darüber die
// Atmosphäre als Strahlrechnung je Pixel (LOOK_ATMO_*): Chromosphäre, Spikulen, Flammen, Hecken und Korona-Schein als
// Schichten über der Kugel, am Rand gesehen als Säule bis zum tiefsten Punkt des Strahls, auf der Scheibe als vordere
// Hälfte – so geht der Rand pixelweich und aus jedem Blickwinkel stimmig in die Oberfläche über. Bögen, Protuberanzen
// und die Fäden der Ausbrüche sind 3D-Fadenbündel (sunstrands.js); auf der Tafel bleiben nur Auswurf-Blase und
// Flare-Schein. Künstlerisch verstärkt: Höhen, Helligkeit und Tempo sind überzeichnet, die Glutkruste ist kein Messbild.
// Ein Ausbruch dauert ERUPT_T Sekunden mit einem weichen Anstieg (kein Blitzen, weit unter 3 Hz, AGENTS.md §0). Linear vor
// ACES (post.js), daher ohne eigenes Tonemapping.

import { NOISE } from './glsl.js';
import { SUN_MASKS, SPOTS } from './sunfx.js';

export const ERUPT_T = 12;   // Sekunden je Ausbruch (Vorschau F3: alle 12 s)
export const LOOK_EXT = 2.6; // Bildtafel reicht bis 2,6 Randradien (Auswurf-Blase bis ≈ 2,3)
// Qualitätsstufe (ctx.detail 0,55 | 0,8 | 1) → fbm-Oktaven, feine Flecken-/Moos-Details
export const lookDefines = (detail) => (detail > 0.9 ? { OCT: 5, FINE: 1 } : detail > 0.7 ? { OCT: 4, FINE: 1 } : { OCT: 3, FINE: 0 });
export const LIGHTS = 16;    // Bögen mit Licht auf der Kruste (uLA/uLB: aktive Regionen + weitere Arkaden)

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
uniform float uTime, uDays, uSurf, uAct, uGain, uFlK, uGlow, uHot, uTex, uRelief, uVisc, uNest, uLL;
vec3 gNs, gVs;   // Normale und Blickrichtung für das Relief-Licht (magmaC)
uniform vec3 uFlS;
#define LIGHTS ${LIGHTS}
uniform vec4 uLA[LIGHTS], uLB[LIGHTS], uQk;
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
// A Glutkruste (Vorlage „Star in Blender“): Adern dort heller, wo die Sonne aktiv ist (uAct, aktive Regionen ar); über
// „Maximum“ glüht alles stärker (uGlow) und wird bei Weißglut (uHot) gelbweiß
vec3 surfA(vec3 q, float t, float mu, float ar, float fine) {
  vec3 w = q * 2.0 + 0.7 * vec3(fbm3(q * 1.6 + vec3(0.0, t * 0.02, 0.0)), fbm3(q * 1.6 + vec3(5.2, 1.3, t * 0.02)), fbm3(q * 1.6 + vec3(2.1, 7.7, -t * 0.02)));
  float act = max(smoothstep(0.0, 0.5, fbm3(q * 1.3 + 3.0)) * (0.5 + 0.7 * uAct), 0.9 * min(ar, 1.0));
  float flow = 0.5 + 0.5 * fbm3(w * vec3(0.8, 2.4, 0.8) + t * 0.01);
  float v1 = pow(ridge(snoise(w + t * 0.015)), 11.0);
  float v2 = pow(ridge(snoise(w * 2.3 - t * 0.02)), 16.0);
  float v3 = pow(ridge(snoise(w * 5.2 + t * 0.03)), 22.0);
  float v4 = fine > 0.001 ? pow(ridge(snoise(w * 11.0 - t * 0.04)), 26.0) * fine : 0.0;
  float veins = (v1 + 0.5 * v2 + 0.25 * v3 + 0.15 * v4) * (0.15 + 1.1 * act) * (0.6 + 0.8 * flow) * uGlow;
  float crust = 0.5 + 0.5 * fbmL(q * 7.0 + t * 0.01);
  if (fine > 0.001) crust = clamp(crust + 0.12 * fine * snoise(q * 40.0 + t * 0.02), 0.0, 1.0);
  vec3 col = mix(vec3(0.03, 0.004, 0.0), mix(vec3(0.32, 0.06, 0.006), vec3(0.9, 0.3, 0.05), uHot) * (0.7 + 0.3 * uGlow), crust * crust * (0.35 + 0.9 * act));
  col += veins * mix(mix(vec3(1.9, 0.42, 0.04), vec3(3.2, 1.5, 0.35), uHot), mix(vec3(4.6, 2.6, 0.8), vec3(5.0, 4.3, 2.8), uHot), clamp(veins - 0.45, 0.0, 1.0));
  col *= 0.55 + 0.45 * sqrt(mu);
  return col + vec3(1.6, 0.4, 0.04) * pow(1.0 - mu, 3.0) * 0.4;
}
// Kruste je uTex (Look „Glut“): 0 Adern (surfA allein) · 1 Zellnetz – Adern ruhiger, dazu das Netzwerk der Supergranulen
// mit hellen Rändern und glimmenden Zellen · 2 Plasmafell – viele feine, kurze Glutfasern in einem Strömungsfeld (wie die
// fasrige Struktur in den SDO-Bildern), Zellen als Helligkeit · 3 SDO-Komposit – Plasmateppich (Netzwerk, Sprenkel,
// Fackelfelder) in Glutfarben mit hellen Kernen der aktiven Regionen wie das Kompositbild 171/304 Å.
vec3 surfNet(vec3 q, float t, float mu, float ar, float fine) {
  vec3 col = surfA(q, t, mu, ar, fine) * 0.7;
  vec3 w = q + 0.03 * vec3(snoise(q * 8.0 + t * 0.03), snoise(q * 8.0 + 3.1), snoise(q * 8.0 - t * 0.03));
  vec2 c = cells2(w * 20.0, t * 0.35);
  float net = 1.0 - smoothstep(0.02, 0.13, c.y - c.x), cell = 1.0 - smoothstep(0.0, 0.85, c.x);
  float act = max(smoothstep(0.0, 0.5, fbm3(q * 1.3 + 3.0)) * (0.5 + 0.7 * uAct), 0.9 * min(ar, 1.0));
  float mott = 0.5 + 0.5 * fbmL(q * 30.0 + t * 0.04);
  col += mix(vec3(1.3, 0.38, 0.05), vec3(3.0, 1.6, 0.45), uHot) * net * (0.25 + 0.9 * act) * (0.5 + 0.7 * mott) * uGlow;
  col += vec3(0.35, 0.07, 0.008) * cell * mott * (0.6 + 0.6 * act) * uGlow;
  return col * (0.6 + 0.4 * sqrt(mu));
}
vec3 surfFur(vec3 q, float t, float mu, float ar, float fine) {
  vec3 w = q * 3.0 + 0.9 * vec3(fbm3(q * 2.5 + vec3(0.0, t * 0.02, 0.0)), fbm3(q * 2.5 + vec3(5.2, 1.3, t * 0.02)), fbm3(q * 2.5 + vec3(2.1, 7.7, -t * 0.02)));
  float act = max(smoothstep(0.0, 0.5, fbm3(q * 1.3 + 3.0)) * (0.5 + 0.7 * uAct), 0.9 * min(ar, 1.0));
  float f1 = pow(ridge(snoise(w * 5.0 + t * 0.02)), 8.0);
  float f2 = pow(ridge(snoise(w * 11.0 - t * 0.03)), 10.0);
  float f3 = pow(ridge(snoise(w * 23.0 + t * 0.04)), 12.0);
  float f4 = fine > 0.001 ? pow(ridge(snoise(w * 47.0 - t * 0.05)), 12.0) * fine : 0.0;
  float fur = f1 + 0.85 * f2 + 0.7 * f3 + 0.5 * f4;
  vec2 c = cells2(q * 16.0 + 0.08 * w, t * 0.3);
  float cell = 1.0 - smoothstep(0.1, 0.95, c.x), mott = 0.5 + 0.5 * fbmL(q * 18.0 + t * 0.03);
  vec3 col = vec3(0.14, 0.025, 0.002) * (0.4 + 1.3 * mott) * (0.7 + 0.3 * uGlow);
  col += mix(vec3(1.0, 0.26, 0.03), vec3(2.4, 1.4, 0.5), uHot) * fur * (0.2 + 0.9 * act) * (0.35 + 0.9 * cell) * uGlow;
  col += mix(vec3(2.6, 1.2, 0.25), vec3(4.0, 3.3, 2.1), uHot) * fur * fur * act * act * uGlow;
  col *= 0.55 + 0.45 * sqrt(mu);
  return col + vec3(1.6, 0.4, 0.04) * pow(1.0 - mu, 3.0) * 0.4;
}
vec3 surfSDO(vec3 q, float t, float mu, float ar, float fine) {
  float lat = asin(clamp(q.y, -1.0, 1.0));
  vec3 w = q + 0.05 * vec3(snoise(q * 9.0 + t * 0.03), snoise(q * 9.0 + 3.1), snoise(q * 9.0 - t * 0.03));
  vec2 c = cells2(w * 18.0, t * 0.4);
  float net = 1.0 - smoothstep(0.03, 0.2, c.y - c.x);
  float mott = 0.5 + 0.5 * fbmL(q * 30.0 + t * 0.04);
  if (fine > 0.001) mott = clamp(mott + 0.18 * fine * snoise(q * 120.0 + t * 0.05), 0.0, 1.0);
  float fib = pow(ridge(snoise(w * vec3(14.0, 40.0, 14.0) + t * 0.03)), 6.0) * 0.6 + pow(ridge(snoise(w * 26.0 - t * 0.04)), 8.0);
  float belt = exp(-pow((abs(lat) - 0.33) / 0.22, 2.0));
  float plage = smoothstep(0.15, 0.6, fbm3(q * 2.2 + 1.7)) * (0.35 + 0.65 * belt) * (0.4 + 0.8 * uAct);
  plage = max(plage, 0.9 * min(ar, 1.3));
  float hole = holeMask(q), fil = filMask(q);
  vec3 col = vec3(0.17, 0.032, 0.003) * (0.2 + 0.9 * mott + 0.8 * net) * (0.7 + 0.3 * uGlow);
  col += mix(vec3(1.1, 0.3, 0.035), vec3(2.6, 1.5, 0.5), uHot) * fib * (0.25 + 0.75 * mott) * (0.3 + 0.8 * plage + 0.3 * uAct) * uGlow;
  col += mix(vec3(1.9, 0.65, 0.1), vec3(3.8, 2.8, 1.4), uHot) * plage * (0.3 + 0.9 * net) * (0.45 + 0.8 * mott) * uGlow;
  col += mix(vec3(3.0, 1.7, 0.5), vec3(4.6, 4.0, 2.8), uHot) * pow(plage, 3.0) * (0.4 + net) * uGlow;
  col *= (1.0 - 0.8 * fil) * (1.0 - 0.55 * hole);
  col *= 0.6 + 0.4 * sqrt(mu);
  return col + vec3(1.8, 0.55, 0.06) * pow(1.0 - mu, 4.0) * 0.7;
}
// Weitere Magma-Krusten (Vorschau „Sonne: Abriss + Kruste“ 26.10.2026, uTex 5–7): 5 Konvektion fein – Zellen in drei Größen
// mit verwirbelten, unterbrochenen Rändern statt gerader Polygonlinien, Granulen mit dunklen Gassen, aus der Nähe Körnung ·
// 6 Lavaplatten – dunkle Platten, Rissnetz in drei Stufen (das feinste nur aus der Nähe) · 7 Plasma-Relief – Höhe aus Zellen,
// Granulen und Schlieren je Pixel, streifendes Licht schattiert sie (Glanzkanten wandern beim Drehen mit). Relief und
// Viskosität (uRelief, uVisc) wirken wie bei Magma-Brodeln.
vec3 magWarp(vec3 q, float t, float visc, float a) {
  vec3 w = q + a * vec3(fbm3(q * 7.0 + t * 0.015 * visc), fbm3(q * 7.0 + 3.1), fbm3(q * 7.0 - t * 0.015 * visc));
  return w + 0.012 * vec3(snoise(q * 34.0 + t * 0.03 * visc), snoise(q * 34.0 + 7.3), snoise(q * 34.0 - t * 0.03 * visc));
}
vec3 magmaA(vec3 q, float t, float mu, float ar, float fine) {
  float visc = max(uVisc, 0.2), relief = max(uRelief, 0.0);
  vec3 w = magWarp(q, t, visc, 0.05);
  vec2 c = cells2(w * 16.0, t * 0.18 * visc), gr = cells2(w * 58.0 + 11.0, t * 0.55 * visc);
  float dome = 1.0 - smoothstep(0.05, 0.95, c.x), domeH = dome * dome * relief;
  float net = (1.0 - smoothstep(0.015, 0.1, c.y - c.x)) * (0.45 + 0.55 * smoothstep(-0.4, 0.5, snoise(w * 46.0 + t * 0.02)));
  float lane = 1.0 - smoothstep(0.02, 0.14, gr.y - gr.x), gran = 1.0 - smoothstep(0.0, 0.85, gr.x);
  float micro = mix(0.5, 0.5 + 0.5 * snoise(w * 170.0 + t * 0.06 * visc), fine);
  float mott = 0.5 + 0.5 * fbmL(q * 28.0 + t * 0.03 * visc);
  float act = max(smoothstep(0.0, 0.5, fbm3(q * 1.3 + 3.0)) * (0.5 + 0.7 * uAct), 0.9 * min(ar, 1.0));
  vec3 hotCore = mix(vec3(1.3, 0.42, 0.05), vec3(3.2, 1.7, 0.45), uHot), whiteGlow = mix(vec3(3.2, 2.1, 0.9), vec3(4.8, 4.2, 2.9), uHot);
  vec3 col = vec3(0.08, 0.012, 0.002) * (0.4 + 0.8 * mott) * (0.7 + 0.3 * uGlow);
  float body = dome * (0.55 + 0.45 * gran) * (1.0 - 0.6 * lane) * (0.8 + 0.4 * micro);
  col += hotCore * body * 1.6 * (0.65 + 0.55 * domeH * (0.6 + 0.4 * mu)) * (0.4 + 0.9 * act) * (0.5 + 0.6 * mott) * uGlow;
  col += hotCore * 0.55 * gran * (1.0 - 0.7 * lane) * (1.0 - dome) * (0.4 + 0.9 * act) * uGlow;
  col += whiteGlow * net * 0.55 * (0.35 + 0.9 * act) * uGlow;
  col += whiteGlow * pow(dome * gran, 3.0) * 0.6 * (0.2 + 0.8 * act) * uGlow;
  col *= 0.58 + 0.42 * sqrt(mu);
  return col + vec3(1.7, 0.45, 0.05) * pow(1.0 - mu, 3.5) * 0.5;
}
vec3 magmaB(vec3 q, float t, float mu, float ar, float fine) {
  float visc = max(uVisc, 0.2), relief = max(uRelief, 0.0);
  vec3 w = magWarp(q, t, visc, 0.07);
  vec2 c1 = cells2(w * 13.0, t * 0.12 * visc), c2 = cells2(w * 37.0 + 4.0, t * 0.25 * visc);
  float e1 = c1.y - c1.x, k1 = 1.0 - smoothstep(0.0, 0.06, e1), halo = exp(-e1 / 0.09);
  float k2 = (1.0 - smoothstep(0.0, 0.045, c2.y - c2.x)) * smoothstep(0.15, 0.5, e1);
  vec2 c3 = cells2(w * 96.0 + 9.0, t * 0.4 * visc);
  float k3 = (1.0 - smoothstep(0.0, 0.05, c3.y - c3.x)) * fine * smoothstep(0.1, 0.4, e1);
  float plate = smoothstep(0.0, 0.7, c1.x), crust = 0.5 + 0.5 * fbmL(q * 40.0 + t * 0.02);
  float act = max(smoothstep(0.0, 0.5, fbm3(q * 1.3 + 3.0)) * (0.5 + 0.7 * uAct), 0.9 * min(ar, 1.0));
  vec3 hotCore = mix(vec3(1.3, 0.42, 0.05), vec3(3.2, 1.7, 0.45), uHot), whiteGlow = mix(vec3(3.2, 2.1, 0.9), vec3(4.8, 4.2, 2.9), uHot);
  vec3 col = vec3(0.11, 0.018, 0.002) * (0.3 + 1.1 * crust) * (1.0 - 0.35 * plate * relief) * (0.7 + 0.3 * uGlow);
  col += hotCore * (1.1 * halo + 0.45 * (1.0 - plate)) * (0.4 + 0.9 * act) * uGlow;
  col += whiteGlow * (0.9 * k1 + 0.45 * k2 + 0.25 * k3) * (0.3 + 0.9 * act) * uGlow;
  col *= 0.58 + 0.42 * sqrt(mu);
  return col + vec3(1.7, 0.45, 0.05) * pow(1.0 - mu, 3.5) * 0.5;
}
vec3 magmaC(vec3 q, float t, float mu, float ar, float fine) {
  float visc = max(uVisc, 0.2), relief = max(uRelief, 0.0);
  vec3 w = magWarp(q, t, visc, 0.05);
  vec2 c = cells2(w * 16.0, t * 0.18 * visc), gr = cells2(w * 48.0 + 11.0, t * 0.45 * visc);
  float dome = 1.0 - smoothstep(0.05, 0.95, c.x);
  float sch = pow(ridge(snoise(w * 22.0 + vec3(0.0, t * 0.02 * visc, 0.0))), 5.0) + 0.5 * pow(ridge(snoise(w * 47.0 - t * 0.03 * visc)), 7.0);
  float H = 0.6 * dome * dome + 0.25 * (1.0 - smoothstep(0.0, 0.9, gr.x)) + 0.12 * sch;
  // Relief aus der Höhe je Pixel (Oberflächengradient), Licht streift tangential über die Kugel
  vec3 dpx = dFdx(vP), dpy = dFdy(vP), r1 = cross(dpy, gNs), r2 = cross(gNs, dpx);
  float det = dot(dpx, r1);
  vec3 Nb = normalize(abs(det) * gNs - sign(det) * (dFdx(H) * r1 + dFdy(H) * r2) * 0.014 * relief);
  vec3 Lt = normalize(cross(gNs, normalize(vec3(0.35, 1.0, 0.2))));
  float shade = clamp(1.0 + 2.2 * dot(Nb - gNs, Lt), 0.25, 2.2);
  float spec = pow(max(dot(reflect(-gVs, Nb), normalize(gNs * 0.4 + Lt)), 0.0), 14.0);
  float mott = 0.5 + 0.5 * fbmL(q * 28.0 + t * 0.03 * visc);
  float edge = 1.0 - smoothstep(0.015, 0.1, c.y - c.x);
  float act = max(smoothstep(0.0, 0.5, fbm3(q * 1.3 + 3.0)) * (0.5 + 0.7 * uAct), 0.9 * min(ar, 1.0));
  vec3 hotCore = mix(vec3(1.3, 0.42, 0.05), vec3(3.2, 1.7, 0.45), uHot), whiteGlow = mix(vec3(3.2, 2.1, 0.9), vec3(4.8, 4.2, 2.9), uHot);
  vec3 col = vec3(0.08, 0.012, 0.002) * (0.4 + 0.8 * mott) * (0.7 + 0.3 * uGlow);
  col += hotCore * (0.25 + H) * shade * (0.4 + 0.9 * act) * (0.5 + 0.6 * mott) * uGlow;
  col += whiteGlow * (0.45 * sch * (0.4 + dome) + 0.35 * edge) * (0.35 + 0.9 * act) * uGlow;
  col += whiteGlow * spec * 0.5 * (0.3 + 0.7 * act) * uGlow;
  col *= 0.58 + 0.42 * sqrt(mu);
  return col + vec3(1.7, 0.45, 0.05) * pow(1.0 - mu, 3.5) * 0.5;
}
// Magma-Brodeln (Lava:B): Hydrodynamische Konvektionswülste mit 3D-Relief-Wölbung, zäh aufwallenden Zentren und absinkenden dunkleren Kühlrändern
vec3 surfMagma(vec3 q, float t, float mu, float ar, float fine) {
  float visc = max(uVisc, 0.2);
  float relief = max(uRelief, 0.0);
  vec3 w = q + 0.04 * vec3(snoise(q * 8.0 + t * 0.02 * visc), snoise(q * 8.0 + 3.1), snoise(q * 8.0 - t * 0.02 * visc));
  vec2 c = cells2(w * 16.0, t * 0.18 * visc);
  float dCenter = c.x, dEdge = c.y - c.x;
  float dome = 1.0 - smoothstep(0.05, 0.95, dCenter);
  float domeH = dome * dome * relief;
  float edgeCrack = 1.0 - smoothstep(0.02, 0.12, dEdge);
  float mott = 0.5 + 0.5 * fbmL(q * 28.0 + t * 0.03 * visc);
  if (fine > 0.001) mott = clamp(mott + 0.16 * fine * snoise(q * 80.0 + t * 0.04 * visc), 0.0, 1.0);
  float schlieren = pow(ridge(snoise(w * 14.0 + t * 0.025 * visc)), 5.0) * 0.7 + pow(ridge(snoise(w * 28.0 - t * 0.03 * visc)), 7.0) * 0.4;
  float act = max(smoothstep(0.0, 0.5, fbm3(q * 1.3 + 3.0)) * (0.5 + 0.7 * uAct), 0.9 * min(ar, 1.0));
  float bumpLight = 0.65 + 0.55 * domeH * (0.6 + 0.4 * mu);
  vec3 coldSlag = vec3(0.08, 0.012, 0.002);
  vec3 hotCore = mix(vec3(1.3, 0.42, 0.05), vec3(3.2, 1.7, 0.45), uHot);
  vec3 whiteGlow = mix(vec3(3.2, 2.1, 0.9), vec3(4.8, 4.2, 2.9), uHot);
  vec3 col = coldSlag * (0.4 + 0.8 * mott) * (0.7 + 0.3 * uGlow);
  col += hotCore * dome * bumpLight * (0.4 + 0.9 * act) * (0.5 + 0.6 * mott) * uGlow;
  col += whiteGlow * (edgeCrack * 0.6 + schlieren * 0.5) * (0.35 + 0.9 * act) * uGlow;
  col += whiteGlow * pow(dome, 4.0) * (0.2 + 0.8 * act) * (0.5 + 0.5 * mott) * uGlow;
  col *= 0.58 + 0.42 * sqrt(mu);
  return col + vec3(1.7, 0.45, 0.05) * pow(1.0 - mu, 3.5) * 0.5;
}
// Flecken in der Glutkruste: Umbra fast schwarz mit glimmenden Punkten, Penumbra aus radialen Glutfasern, in denen Knoten
// nach außen laufen (Evershed-Strömung); Größe wie in SUN_FRAG (Umbra uSpot.w, Penumbra 2,4-fach). rgb = Leuchten, a = Abdunkeln.
vec4 spotsA(vec3 g, float t, float fine) {
  vec3 add = vec3(0.0); float dark = 0.0;
  for (int i = 0; i < SPOTS; i++) {
    vec4 s = uSpot[i];
    if (s.w <= 0.0) continue;
    vec3 d = g - s.xyz; float r = length(d), rp = s.w * 2.4;
    if (r > rp * 1.25) continue;
    vec3 e1 = normalize(cross(s.xyz, vec3(0.0, 1.0, 0.0))), e2 = cross(s.xyz, e1);
    float ang = atan(dot(d, e2), dot(d, e1)), x = r / rp, fi = float(i);
    vec3 ring = vec3(cos(ang), sin(ang), 0.0);
    float edge = 0.08 * snoise(ring * 2.5 + vec3(0.0, 0.0, fi * 3.7));
    float um = 1.0 - smoothstep(0.34, 0.44, x + edge);
    float pen = (1.0 - smoothstep(0.86, 1.08, x + edge)) * (1.0 - um);
    float fil = pow(0.5 + 0.5 * sin(ang * 72.0 + 2.6 * snoise(ring * 4.0 + vec3(x * 3.0, fi, t * 0.02))), 2.2);
    float ev = 0.6 + 0.4 * sin((x * 9.0 - t * 0.5) * 3.1415 + fi + 0.5 * snoise(ring * 9.0));
    dark = max(dark, um * 0.95 + pen * 0.7);
    add += vec3(1.7, 0.45, 0.05) * pen * fil * ev * (0.35 + 0.65 * smoothstep(0.35, 0.95, x));
    if (FINE > 0) add += vec3(0.5, 0.08, 0.005) * um * pow(0.5 + 0.5 * snoise(g * 1400.0 + fi), 8.0) * fine;
  }
  return vec4(add, min(dark, 1.0));
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
  col += mix(vec3(2.8, 0.95, 0.18), vec3(3.6, 2.4, 1.0), uHot) * plage * uGlow * (0.35 + 1.0 * net) * (0.6 + 0.7 * mott);
  col *= (1.0 - 0.85 * fil) * (1.0 - 0.6 * hole);
  col *= 0.75 + 0.25 * mu;
  return col + vec3(1.3, 0.22, 0.02) * pow(1.0 - mu, 5.0) * 0.6;
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
// Bögen werfen Licht (Vorschau „Sonne optimieren“ 28.10.2026, Bogen:A): je Bogenbündel ein Punktlicht über dem Scheitel
// (uLA = Fuß a + Stärke, uLB = Fuß b + Höhe), ohne Schatten, fällt mit dem Abstand ab; dazu glühen die Fußpunkte.
// x = Licht auf der Kruste, y = Glut der Fußpunkte
vec2 loopLight(vec3 g) {
  vec2 L = vec2(0.0);
  for (int i = 0; i < LIGHTS; i++) {
    vec4 a = uLA[i], b = uLB[i];
    if (a.w <= 0.0) continue;
    float h = b.w;
    vec3 d = normalize(a.xyz + b.xyz) * (1.0 + h) - g, da = g - a.xyz, db = g - b.xyz;
    float d2 = dot(d, d), fs = 0.08 * h * h + 2e-5;
    L.x += a.w * max(dot(g, d), 0.0) * inversesqrt(d2) * h * h / (d2 + 0.3 * h * h);
    L.y += a.w * (exp(-dot(da, da) / fs) + exp(-dot(db, db) / fs));
  }
  return L * uLL;
}
// Sonnenbeben (Ereig:A, Kosovichev & Zharkova 1998): drei Ringwellen um den Flare-Ort uQk.xyz, uQk.w Sekunden nach dem
// Flare; jede läuft schneller nach außen (wie die beobachteten Wellen, ≈ 10 → 100 km/s), wird breiter und schwächer –
// helle Front, dunkles Tal dahinter
float quake(vec3 g) {
  float gg = acos(clamp(dot(g, uQk.xyz), -1.0, 1.0)), q = 0.0;
  for (int i = 0; i < 3; i++) {
    float t = uQk.w - 0.9 * float(i);
    if (t <= 0.0) continue;
    float x = (gg - 0.02 - 0.06 * t - 0.01 * t * t) / (0.01 + 0.006 * t);
    q += x * exp(-x * x) * exp(-t / 3.5) * (1.0 - 0.25 * float(i));
  }
  return q;
}
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  gNs = N; gVs = V;
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
  vec3 col = uSurf > 0.5 ? surfB(g, uTime, mu, ar, fine) : uTex < 0.5 ? surfA(g, uTime, mu, ar, fine) : uTex < 1.5 ? surfNet(g, uTime, mu, ar, fine)
    : uTex < 2.5 ? surfFur(g, uTime, mu, ar, fine) : uTex < 3.5 ? surfSDO(g, uTime, mu, ar, fine) : uTex < 4.5 ? surfMagma(g, uTime, mu, ar, fine)
    : uTex < 5.5 ? magmaA(g, uTime, mu, ar, fine) : uTex < 6.5 ? magmaB(g, uTime, mu, ar, fine) : magmaC(g, uTime, mu, ar, fine);
  if (uSurf < 0.5) { vec4 sp = spotsA(g, uTime, fine); col = col * (1.0 - sp.a) + sp.rgb; }
  // Moos: helle, körnige Fußpunkte der Bögen über den aktiven Regionen – dort wurzeln die Fäden (sunstrands.js)
  float mossF = 1.0 - smoothstep(0.002, 0.008, length(fwidth(vO)));
  float moss = 0.5 + 0.5 * (0.6 * snoise(g * 140.0 + vec3(0.0, 0.0, uTime * 0.04)) + 0.4 * snoise(g * 330.0 - vec3(0.0, uTime * 0.05, 0.0)));
  moss = mix(0.12, moss * moss * 0.9, mossF) * smoothstep(0.5, 1.4, ar) * (0.6 + 0.4 * mu);
  col += (uSurf < 0.5 ? vec3(2.4, 0.9, 0.15) : vec3(2.2, 0.6, 0.08)) * moss * 0.8 * uGlow;
  // Aktive Regionen aus der Ferne als helle Nester (Fern:C): breiter Hof um die Flecken hellt die Kruste auf, erst ab ≈ 2 R☉
  // Abstand (Nahansicht bleibt unverändert)
  float far = smoothstep(1.6, 2.6, length(cameraPosition));
  if (uNest > 0.0 && far > 0.0) {
    float nest = 0.0;
    for (int i = 0; i < SPOTS; i++) {
      vec4 s = uSpot[i];
      if (s.w == 0.0) continue;
      vec3 d = g - s.xyz;
      nest += exp(-dot(d, d) / 0.01);
    }
    nest = min(nest, 1.4) * far * uNest;
    col = col * (1.0 + 1.6 * nest) + (uSurf < 0.5 ? vec3(2.2, 0.85, 0.16) : vec3(2.0, 0.55, 0.08)) * nest * 0.3 * uGlow;
  }
  if (uLL > 0.0) {
    vec2 L = loopLight(g);
    col = col * (1.0 + 1.5 * L.x) + vec3(1.4, 0.5, 0.09) * L.x * 0.35 + vec3(3.0, 1.5, 0.45) * min(L.y, 2.0) * 0.8;
  }
  if (uQk.w > 0.0) { float q = quake(g); col = col * max(1.0 + 2.2 * q, 0.0) + vec3(2.4, 1.1, 0.25) * max(q, 0.0) * 1.2; }
  if (uFlK >= 0.0) col += flareDisk(g, uFlK, uTime);
  gl_FragColor = vec4(col * uGain, 1.0);
}
`;


// ---------- Atmosphäre: Bildtafel um die Sonnenmitte, je Pixel ein Strahl durch die Schichten über der Kugel ----------
// Tafel wie BILLBOARD_AIM_VERT (vQ-Achsen gleich, damit uEDir/uESp aus sun.js passen), dazu die Strahlrichtung vRd in Welt-
// koordinaten (Sonnenmitte = Ursprung, Radius 1).
export const LOOK_ATMO_VERT = /* glsl */ `
uniform float uSize;
varying vec2 vQ;
varying vec3 vRd;
void main() {
  vQ = uv * 2.0 - 1.0;
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 w = normalize(c.xyz);
  vec3 u = normalize(cross(w, abs(w.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0)));
  vec3 v = cross(u, w);
  c.xyz += (u * position.x + v * position.y) * uSize;
  vRd = (vec4(c.xyz, 0.0) * viewMatrix).xyz;
  gl_Position = projectionMatrix * c;
}
`;

// Schichten als Funktion von Richtung q (mitdrehend, uSunInv) und Höhe h: Strahl am Rand vorbei → Säule bis zum tiefsten
// Punkt (h = Abstand − 1); q = sichtbarer Randpunkt in der Ebene Kamera–Mitte–Strahl, also auf jeder radialen Bildlinie
// derselbe (bei naher Kamera wandert der tiefste Punkt mit der Bildhöhe, Muster würden zu Flecken) → Spikulen, Flammen
// und Strahlen stehen radial und wurzeln am Rand. Strahl auf die Kugel →
// vordere Hälfte der Säule (h = 0 am Auftreffpunkt), schwächer je steiler der Blick (μ); am Rand gleich, die Kante zwischen
// beiden wird über einen Pixel gemischt. Höhen (überhöht): Chromosphäre ≈ 2.200 km Skalenhöhe, Spikulen uSpH (≈ 8–14 Mm),
// Flammen bis ≈ 0,25 R☉, Hecken bis ≈ 0,05 R☉, Korona-Schein mit drei Skalenhöhen und Streamern über den aktiven Regionen
// (uAR: Weltrichtung + an/aus; uCor 0 = Korona aus). uRim: 0 aus · 1 Flammenkranz · 2 Bogen-Arkaden (Bögen = sunstrands.js)
// · 3 feiner Saum.
export const LOOK_ATMO_FRAG = /* glsl */ `
${SNOISE}
uniform float uTime, uExt, uGain, uSurf, uRim, uE, uEK, uEB, uSpH, uCor, uEA, uHaze;
uniform vec2 uEDir, uESp;
uniform mat3 uSunInv;
uniform vec4 uAR[6];
varying vec2 vQ;
varying vec3 vRd;
// Chromosphäre + Spikulen: Jets mit eigener Höhe (steigen und fallen in 4–9 s), feine Streifen nur, wenn sie ein paar
// Pixel breit sind (fq = Winkel je Pixel)
float chromo(vec3 q, float h, float t, float fq) {
  float ch = exp(-h / 0.0032);
  if (uSpH <= 0.0) return 1.4 * ch;
  float n1 = 0.5 + 0.5 * snoise(q * 64.0 + vec3(0.0, 0.0, t * 0.11));
  float hs = uSpH * (0.3 + 0.95 * n1 * n1);
  float st = 0.5 + 0.5 * snoise(q * 340.0 + vec3(0.0, t * 0.02, 0.0));
  st = mix(0.55, 1.7 * st * st, 1.0 - smoothstep(0.003, 0.009, fq));
  return 1.4 * ch + 0.8 * st * smoothstep(hs, 0.12 * hs, h);
}
// Flammenkranz: Zungen wachsen vom Rand aus (Höhe je Richtung in zwei Größen, lodert langsam), unten voll, nach oben weich;
// innen radiale Schlieren (Muster in Randrichtung feiner als in der Höhe), die nach außen strömen
float flame(vec3 q, float h, float t) {
  float hf = 0.035 + 0.15 * smoothstep(-0.4, 0.8, snoise(q * 3.0 + vec3(0.0, 0.0, t * 0.035)));
  float ht = hf * (0.2 + 0.8 * smoothstep(-0.6, 0.7, 0.65 * snoise(q * 16.0 + vec3(0.0, 0.0, t * 0.15)) + 0.35 * snoise(q * 47.0 + vec3(0.0, 0.0, t * 0.3))));
  if (h > ht * 1.7) return 0.0;
  vec3 X = q * 38.0 + vec3(0.0, 0.0, (t * 0.03 - h) * 9.0);
  float n1 = fbm3(X), n2 = snoise(X * 2.3 + n1);
  float tongue = 1.0 - smoothstep(0.0, ht * 1.6, h + 0.3 * ht * n1);
  return tongue * tongue * (0.45 + 0.4 * n1 + 0.8 * pow(ridge(n2), 4.0)) * (0.5 + 0.5 * exp(-h * 12.0));
}
vec3 flameCol(float f) {
  vec3 lo = uSurf < 0.5 ? vec3(1.4, 0.36, 0.04) : vec3(1.3, 0.2, 0.02), hi = uSurf < 0.5 ? vec3(3.4, 1.8, 0.45) : vec3(3.0, 1.1, 0.25);
  return mix(lo, hi, clamp(f - 0.2, 0.0, 1.0)) * f * 1.2;
}
// feiner Saum: niedrige Protuberanz-Hecken aus Wolken und senkrechten Fäden, nur stellenweise
float hedge(vec3 q, float h, float t) {
  float hh = 0.05 * smoothstep(0.1, 0.45, fbm3(q * 4.5 + 7.0));
  if (hh < 0.003 || h > hh) return 0.0;
  float cloud = max(fbm3(q * 24.0 + vec3(0.0, h * 30.0 - t * 0.08, 0.0)) + 0.35, 0.0);
  float thr = pow(ridge(snoise(q * 130.0 + vec3(0.0, h * 6.0, t * 0.05))), 5.0);
  return (cloud + 0.9 * thr) * smoothstep(hh, hh * 0.35, h);
}
// Korona-Schein: drei Skalenhöhen, Streamer über aktiven Regionen, feine radiale Strahlen
float corona(vec3 qW, vec3 q, float h, float t) {
  float s = 0.0;
  for (int i = 0; i < 6; i++) s += uAR[i].w * exp(-(1.0 - dot(qW, uAR[i].xyz)) / 0.035);
  s = min(s, 1.5);
  float rays = 0.88 + 0.12 * snoise(q * 9.0 + vec3(0.0, 0.0, t * 0.006));
  return (exp(-h / 0.03) * 0.09 + exp(-h / 0.15) * 0.025 + exp(-h / 0.7) * 0.006) * (0.6 + s) * rays + exp(-h / 0.4) * 0.02 * s * rays;
}
// Ausbruch A: Auswurf-Blase um das aufsteigende Filament (helle Front, davor schwach die Stoßfront; das Seil selbst sind
// Fäden in 3D). p in Randradien auf der Tafel. Die Front wird nach außen dunkler (Dichte sinkt) und ist vor dem Rand der
// Tafel (LOOK_EXT, weich ab 0,85) schon ausgeblendet – keine Kante, wo die Tafel endet.
vec3 cmeA(vec2 p, float t, float k) {
  float r = length(p), y = r - 1.0;
  if (y < 0.0) return vec3(0.0);
  float x = wrapA(atan(p.y, p.x) - atan(uEDir.y, uEDir.x)) * r;
  float L = mix(0.15, 1.7, smoothstep(0.2, 0.95, k));
  float fade = smoothstep(0.22, 0.4, k) * (1.0 - smoothstep(0.75, 1.0, k));
  float e = length(vec2(x / (0.8 * L), (y - 0.45 * L) / (0.85 * L)));
  float tex = 0.35 + 0.9 * max(fbm3(vec3(x * 4.0, y * 4.0 - t * 0.1, t * 0.05)), 0.0);
  float front = exp(-pow((e - 1.0) / 0.1, 2.0)) * tex;
  float shock = exp(-pow((e - 1.12) / 0.025, 2.0)) * smoothstep(0.3, 0.5, k);
  return (vec3(1.6, 0.66, 0.22) * front * 0.28 + vec3(1.2, 0.7, 0.35) * shock * 0.07) * fade * smoothstep(0.0, 0.03, y) * (1.0 - smoothstep(1.55, 2.2, r));
}
// Ausbruch B: weiches Aufleuchten über dem Fußpunkt (≈ 0,7 s an, ≈ 3 s ab – kein Blitzen)
vec3 flashB(vec2 p, float k) {
  float f = smoothstep(0.08, 0.14, k) * (1.0 - smoothstep(0.14, 0.42, k));
  float ds = length(p - uESp);
  return (vec3(3.0, 2.2, 1.3) * exp(-ds / 0.045) + vec3(1.5, 0.75, 0.3) * exp(-ds / 0.25) * 0.25) * f;
}
void main() {
  float rq = length(vQ);
  if (rq > 1.0) discard;
  float t = uTime;
  vec3 ro = cameraPosition, rd = normalize(vRd);
  float tb = -dot(ro, rd);
  vec3 pc = ro + rd * max(tb, 0.0);
  float b = length(pc), pb = max(fwidth(b), 1e-5);
  float d = length(ro);
  vec3 w = -ro / d, e = rd - w * dot(rd, w);
  e /= max(length(e), 1e-6);
  vec3 qW = normalize(e * sqrt(max(1.0 - 1.0 / (d * d), 0.0)) - w / d), q = uSunInv * qW;
  float fq = length(fwidth(q));
  float wd = tb > 0.0 ? smoothstep(-pb, pb, 1.0 - b) : 0.0;
  vec3 cC = uSurf < 0.5 ? vec3(2.3, 0.5, 0.05) : vec3(2.1, 0.32, 0.03), cK = uSurf < 0.5 ? vec3(1.5, 0.42, 0.07) : vec3(1.4, 0.28, 0.05);
  vec3 col = vec3(0.0);
  // Hitzeflimmern + Dunst (Bogen:C, künstlerisch – im All flimmert keine Luft): nur in der Nahansicht; Schlieren steigen
  // langsam auf, versetzen die Höhe der unteren Schichten um Bruchteile (der Horizont wabert) und legen warmen Dunst darüber
  float hz = uHaze * (1.0 - smoothstep(1.35, 2.1, d));
  if (wd < 1.0) {
    float h = max(b - 1.0, 0.0);
    if (hz > 0.0 && h < 0.25) {
      float sh = snoise(vec3(q.x * 70.0 + q.z * 40.0, h * 260.0 - t * 1.1, q.y * 70.0 + t * 0.15));
      h = max(h + 0.003 * hz * sh * exp(-h / 0.03), 0.0);
      col += vec3(1.3, 0.48, 0.08) * hz * (exp(-h / 0.06) * 0.45 + exp(-h / 0.012) * 0.4) * (0.75 + 0.25 * sh) * (1.0 - wd);
    }
    vec3 c = cK * corona(qW, q, h, t) * uCor;
    if (h < 0.06) c += cC * chromo(q, h, t, fq);
    if (uRim > 0.5 && uRim < 1.5 && h < 0.45) c += flameCol(flame(q, h, t));
    if (uRim > 2.5 && h < 0.06) c += cC * 1.1 * hedge(q, h, t);
    col += (1.0 - wd) * c;
  }
  if (wd > 0.0) {
    float mu = sqrt(max(1.0 - b * b, 0.0));
    vec3 P = ro + rd * (tb - mu), qD = uSunInv * P;
    vec3 c = mu < 0.9 ? cK * corona(P, qD, 0.0, t) * exp(-mu / 0.35) * uCor : vec3(0.0);
    if (mu < 0.3) c += cC * chromo(qD, 0.0, t, fq) * exp(-mu / 0.05);
    if (uRim > 0.5 && uRim < 1.5 && mu < 0.4) c += flameCol(flame(qD, 0.0, t)) * exp(-mu / 0.07) * 0.7;
    if (hz > 0.0) c += vec3(1.3, 0.48, 0.08) * hz * 0.5 * exp(-mu / 0.12);
    col += wd * 0.5 * c;
  }
  if (uEK >= 0.0) {
    vec2 p = vQ * uExt;
    if (uE < 1.5) col += cmeA(p, t, uEK);
    else if (uE < 2.5) col += flashB(p, uEK) * uEB;
    else if (uEA > 0.0) col += cmeA(p, t, clamp((uEK - 0.45) / 0.55, 0.0, 1.0)) * uEA;   // Abriss: Blase hinter dem Oberteil
  }
  gl_FragColor = vec4(col * uGain * (1.0 - smoothstep(0.85, 1.0, rq)), 1.0);
}
`;
