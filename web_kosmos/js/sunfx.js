// Shader-Bausteine der Sonne (Station Sonnensystem): Photosphäre mit Zell-Granulation und Flecken, Chromosphäre und Korona
// als Bildtafel zur Kamera, Protuberanzen als Plasmabögen, koronaler Massenauswurf. Darstellungs-Übertreibungen (Korona
// verstärkt, Granulen und Flecken vergrößert, Protuberanzen und Granulation im Zeitraffer) stehen jeweils am Shader.
//
// API (unabhängig von den Stationen, nur three.js + glsl.js):
//   SUN_FRAG          Photosphäre; Vertex-Shader mit varyings vN, vP, vO, vUv (z. B. BODY_VERT aus planetfx.js) auf einer
//                     Einheitskugel (y = Sonnenpol). Uniforms: tSun, uGain (≈ 2,3), uTime [s], uDays [Tage], uGran 0|1,
//                     uFine 0|1 (2. Granulations-Oktave), uSpot = spotGroups(rand) (SPOTS × vec4).
//   BILLBOARD_VERT    Bildtafel zur Kamera um den Objekt-Ursprung (PlaneGeometry(2, 2), Uniform uSize).
//   CORONA_FRAG       Korona + Chromosphäre auf der Bildtafel (uSize = uExt · R☉). Uniforms: uTime, uExt, uGain, uLimb (sichtbarer
//                     Rand: 1/√(1 − 1/d²), d = Kameraabstand in R☉), uCorona 0|1, uChromo, uPole (vec2, Pol im Bild),
//                     uStr = STREAMERS × vec3 (Positionswinkel ab Pol, Breite, Stärke; aus streamerSet(rand)).
//   LOOP_VERT/_FRAG   Protuberanzen auf loopsGeometry(n, rand) (Kind der Sonnenkugel). Uniforms: uTime, uRate, uGain, uBurstT,
//                     uBurstSeed, uSunR, uSunC; geometry.userData.meta[i] = { seed, apex, dir, foot } für Flares/Auswürfe.
//   CME_FRAG          Massenauswurf auf BILLBOARD_VERT. Uniforms: uSize, uK (0 … 1), uGain, uSide, uTime, uDir (vec2).
//   SDO-Kanäle (Station Sonne, additiv): uChan 0 = Weißlicht (Standard, Bild wie oben) · 1 = 171 Å · 2 = 304 Å · 3 = 193 Å in
//                     SUN_FRAG (dazu uAct 0 … 1, uHole[HOLES] = Richtung + Winkelradius, uFil/uFilT[FILS] = Filamente; uSpot.w < 0
//                     = Fleck ausgeblendet, aktive Region bleibt), CORONA_FRAG (dazu uPolar 0 … 1 = polare Löcher) und LOOP_FRAG.
//   CLOOP_VERT/_FRAG  Koronaschleifen einer aktiven Region auf coronalLoopsGeometry(a, b, n, rand). Uniforms: uTime, uChan, uGain,
//                     uDens (Anteil der Fäden), uFlareP (Weltort), uFlareT [s seit Flare].

import * as THREE from 'three';
import { NOISE } from './glsl.js';

const RAD = Math.PI / 180;
export const SPOTS = 12;      // Flecken (6 Gruppen × Vorläufer/Nachfolger)
export const STREAMERS = 7;   // Helmstreamer der Korona
export const HOLES = 4;       // koronale Löcher (SDO-Kanäle)
export const FILS = 4;        // Filamente (SDO-Kanäle)

// SDO/AIA-Falschfarben, angelehnt an die Farbtabellen der NASA-Bilder (linear, vor ACES): Helligkeit x → Farbe × x;
// dunkel satt, hell fast weiß. ch 1 = 171 Å gold, 2 = 304 Å rot-orange, 3 = 193 Å bronze.
const EUV_TINT = /* glsl */ `
vec3 euvTint(float x, float ch) {
  vec3 a, b, c;
  if (ch < 1.5) { a = vec3(0.3, 0.13, 0.01); b = vec3(1.0, 0.62, 0.1); c = vec3(1.0, 0.92, 0.62); }
  else if (ch < 2.5) { a = vec3(0.35, 0.03, 0.0); b = vec3(1.0, 0.22, 0.03); c = vec3(1.0, 0.66, 0.36); }
  else { a = vec3(0.24, 0.12, 0.05); b = vec3(0.92, 0.52, 0.24); c = vec3(1.0, 0.86, 0.66); }
  x = max(x, 0.0);
  return (x < 0.6 ? mix(a, b, x / 0.6) : mix(b, c, min((x - 0.6) / 1.2, 1.0))) * x;
}
`;

// Photosphäre. Ort im mitrotierenden Plasma g aus der verschobenen Texturkoordinate: differentielle Rotation
// ω(φ) = 14,713 − 2,396 sin²φ − 1,787 sin⁴φ °/Tag (Snodgrass & Ulrich 1990, uDays = Tage seit Start).
// Granulation als Zellmuster (Worley-Rauschen, 2 Oktaven): helle Zellen = aufsteigendes heißes Gas, dunkle Zwischenräume =
// absinkendes kühleres Gas. Echt ≈ 1.000 km je Zelle (≈ 4.000 Zellen über den Umfang) und 8–10 min Lebensdauer – hier
// ≈ 38 Zellen je Sonnenradius (≈ 25-fach vergrößert) und im Zeitraffer. Aus der Ferne blendet die Granulation aus
// (Pixelgröße aus fwidth), damit nichts flimmert. Randverdunkelung quadratisch für 550 nm; die Farbe folgt der Helligkeit
// (kühler = röter): Rand, Zwischenräume und Umbra orange bis rot, Scheibenmitte gelbweiß. Flecken: Umbra ≈ 20 %,
// Penumbra ≈ 70 % mit radialen Fasern (Evershed-Strömung), in den Aktivitätsgürteln ±6–24° (prozedural, etwa doppelt so
// groß wie echte große Flecken). Die Textur sun.jpg ist eine Aktivitätskarte: helle Gebiete = Fackelfelder, am Rand hell.
export const SUN_FRAG = /* glsl */ `
${NOISE}
#define SPOTS ${SPOTS}
uniform sampler2D tSun;
uniform float uGain, uTime, uDays, uGran, uFine;
uniform vec4 uSpot[SPOTS];
varying vec3 vN, vP, vO;
varying vec2 vUv;

// Abstand zum nächsten und zweitnächsten Zellkern; die Kerne wandern langsam (Brodeln)
vec3 cells(vec3 p, float t) {
  vec3 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 h = hash3(i + o);
    vec3 r = o + 0.5 + 0.4 * sin(t * (0.7 + 0.3 * h.zxy) + 3.14159 * h) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = h.x; } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(vec2(d1, d2)), id);
}
// 0 im dunklen Zwischenraum, ≈ 1 in der Zellmitte; jede Zelle eigene Helligkeit (junge Zellen heller), Fugen weich
float granule(vec3 p, float t) {
  // Zellraum leicht verwirbeln: Zellgrenzen gekrümmt statt gerader Voronoi-Kanten
  p += 0.32 * vec3(gnoise(p * 0.6 + 1.3), gnoise(p * 0.6 + 7.1), gnoise(p * 0.6 + 4.7));
  vec3 c = cells(p, t);
  float own = 0.72 + 0.28 * sin(c.z * 9.0 + t * 0.8);
  return smoothstep(0.0, 0.55, c.y - c.x) * (1.0 - 0.5 * c.x * c.x) * own;
}
// Helligkeit → Farbe (lineare Chromatizität, vor ACES und sRGB-Kodierung): kühl/dunkel rot-orange, heiß goldgelb bis gelbweiß
vec3 ramp(float x) {
  vec3 c0 = vec3(1.0, 0.07, 0.01), c1 = vec3(1.0, 0.13, 0.02), c2 = vec3(1.0, 0.22, 0.045), c3 = vec3(1.0, 0.4, 0.13), c4 = vec3(1.0, 0.56, 0.28);
  x = clamp(x, 0.0, 1.3);
  if (x < 0.3) return mix(c0, c1, x / 0.3);
  if (x < 0.6) return mix(c1, c2, (x - 0.3) / 0.3);
  if (x < 0.92) return mix(c2, c3, (x - 0.6) / 0.32);
  return mix(c3, c4, (x - 0.92) / 0.38);
}
// ---- SDO-Kanäle (uChan > 0): EUV ist optisch dünn → Scheibe zum Rand heller (Weglänge ≈ 1/μ, begrenzt); aktive Regionen
// über den Fleckengruppen hell, koronale Löcher dunkel (193 Å fast schwarz), Filamente als dunkle Fäden (304 Å stark).
// 171 Å: dunkle Scheibe mit Netzwerk und hellen Punkten · 304 Å: Chromosphären-Netzwerk an den Rändern der Supergranulen
// (≈ 30 Mm) · 193 Å: diffuse heiße Korona. Ohne Granulation und Fleckendunkel (die stammen aus der Photosphäre).
#define HOLES ${HOLES}
#define FILS ${FILS}
uniform float uChan, uAct;
uniform vec4 uHole[HOLES], uFil[FILS], uFilT[FILS];
${EUV_TINT}
float holeMask(vec3 g) {
  float m = 0.0;
  for (int i = 0; i < HOLES; i++) {
    vec4 h = uHole[i];
    if (h.w <= 0.0) continue;
    float a = acos(clamp(dot(g, h.xyz), -1.0, 1.0)) + 0.3 * h.w * gnoise(g * 5.0 + float(i) * 3.1);
    m = max(m, 1.0 - smoothstep(h.w * 0.7, h.w * 1.08, a));
  }
  return m;
}
float filMask(vec3 g) {
  float m = 0.0;
  for (int i = 0; i < FILS; i++) {
    vec4 f = uFil[i], ft = uFilT[i];
    if (f.w <= 0.0) continue;
    vec3 dv = g - f.xyz;
    float a = dot(dv, ft.xyz);
    if (abs(a) > f.w * 1.1) continue;
    vec3 nr = normalize(cross(f.xyz, ft.xyz));
    float p = dot(dv, nr) + 0.01 * sin(a * 38.0 + float(i) * 2.3) + 0.004 * gnoise(g * 80.0);
    float w = max(ft.w * (1.0 - a * a / (f.w * f.w)), 1e-4);
    m = max(m, (1.0 - smoothstep(w * 0.35, w, abs(p))) * (0.75 + 0.25 * gnoise(g * 120.0)));
  }
  return clamp(m, 0.0, 1.0);
}
vec3 euvDisc(vec3 g, float mu, float act) {
  float hole = holeMask(g), fil = filMask(g), ar = 0.0;
  for (int i = 0; i < SPOTS; i++) {
    vec4 s = uSpot[i];
    if (s.w == 0.0) continue;
    vec3 d = g - s.xyz;
    ar += exp(-dot(d, d) / 0.005);
  }
  ar = min(ar, 1.6);
  float lb = 1.0 / max(mu, 0.2), t = uTime, I;
  if (uChan < 1.5) {
    float net = ridged(g * 22.0 + vec3(0.0, 0.0, t * 0.01), 3);
    float bp = pow(fbm(g * 60.0 + vec3(t * 0.02), 2) * 0.5 + 0.5, 6.0) * 3.0;
    I = (0.14 + 0.2 * net + 0.25 * bp) * mix(1.0, 0.3, hole) * (0.55 + 0.3 * lb) + 1.1 * ar * (0.6 + 0.4 * net) + 0.25 * act * uAct;
    I *= 1.0 - 0.5 * fil;
  } else if (uChan < 2.5) {
    vec3 q = g + 0.02 * vec3(gnoise(g * 40.0), gnoise(g * 40.0 + 3.7), gnoise(g * 40.0 + 7.1));
    vec3 c = cells(q * 30.0, t * 0.05);
    float edge = 1.0 - smoothstep(0.0, 0.45, c.y - c.x);
    float mott = fbm(g * 110.0 + vec3(t * 0.01), 3) * 0.5 + 0.5;
    I = (0.42 + 0.3 * edge * (0.4 + 0.9 * mott) + 0.22 * mott) * mix(1.0, 0.75, hole) + 0.9 * ar + 0.35 * act * uAct;
    I *= mix(1.0, 0.15, fil) * (0.85 + 0.3 * (1.0 - smoothstep(0.05, 0.35, mu)));
  } else {
    float diff = fbm(g * 5.0 + vec3(t * 0.003), 3) * 0.5 + 0.5;
    float fine = ridged(g * 16.0, 2);
    I = (0.2 + 0.18 * diff + 0.08 * fine) * (0.55 + 0.35 * lb) + 1.3 * ar * (0.7 + 0.3 * fine) + 0.2 * act * uAct;
    I *= mix(1.0, 0.06, hole) * (1.0 - 0.45 * fil);
  }
  return euvTint(I, uChan);
}
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float mu = max(dot(N, V), 0.0), q = 1.0 - mu;
  float ld = 1.0 - 0.93 * q + 0.23 * q * q;
  float s2 = vO.y * vO.y;
  float om = 14.713 - 2.396 * s2 - 1.787 * s2 * s2;
  vec2 uv = vec2(fract(vUv.x - om * uDays / 360.0), vUv.y);
  float ph = uv.x * 6.2831853, th = (1.0 - uv.y) * 3.14159265;
  vec3 g = vec3(-cos(ph) * sin(th), cos(th), sin(ph) * sin(th));
  float px = length(fwidth(vO));
  float t = uTime * 0.12;
  const float GS = 46.0;
  float v1 = 1.0 - smoothstep(0.2, 0.6, px * GS), v2 = (1.0 - smoothstep(0.2, 0.6, px * GS * 2.3)) * uFine;
  float gr = 0.0;
  if (v1 > 0.001) gr += (granule(g * GS, t) - 0.45) * v1;
  if (v2 > 0.001) gr += (granule(g * GS * 2.3 + 7.31, t * 1.4) - 0.45) * 0.5 * v2;
  // Supergranulation und Mesogranulation als schwache großräumige Helligkeitswellen
  float meso = fbm(g * 7.0 + vec3(0.0, 0.0, uTime * 0.004), 2);
  float gran = 1.0 + uGran * (0.32 * gr * (0.25 + 0.75 * sqrt(mu)) + 0.05 * meso);
  // Flecken
  float dark = 1.0, near = 0.0;
  for (int i = 0; i < SPOTS; i++) {
    vec4 s = uSpot[i];
    if (s.w <= 0.0) continue;
    float d = length(g - s.xyz), pen = s.w * 2.4;
    near += 1.0 - smoothstep(pen * 1.2, pen * 5.0, d);
    if (d > pen * 1.2) continue;
    vec3 e1 = normalize(cross(s.xyz, vec3(0.0, 1.0, 0.0)) + 1e-5), e2 = cross(s.xyz, e1), dv = g - s.xyz;
    float a = atan(dot(dv, e2), dot(dv, e1));
    float fil = gnoise(vec3(cos(a) * 9.0, sin(a) * 9.0, d / s.w * 0.6 - uTime * 0.03)) * 0.5 + 0.5;
    float um = 1.0 - smoothstep(s.w * 0.75, s.w * 1.15, d);
    float pe = 1.0 - smoothstep(pen * 0.8, pen * 1.12, d);
    dark = min(dark, mix(mix(1.0, 0.56 + 0.32 * fil, pe), 0.18 + 0.05 * fil, um));
  }
  // Fackeln: heiße Magnetfeldbündel im Netzwerk um aktive Gebiete, Kontrast wächst zum Rand hin
  vec3 tx = texture2D(tSun, uv).rgb;
  float lum = dot(tx, vec3(0.3, 0.59, 0.11));
  float act = smoothstep(0.6, 0.95, lum) * 0.7 + min(near, 1.0);
  float net = fbm(g * 26.0, 2) * 0.5 + 0.5;
  float fac = act * pow(q, 1.6) * (0.35 + 0.65 * net * net) * 0.55;
  float I = ld * gran * dark * (1.0 + (lum - 0.6) * 0.1) + fac * (0.4 + 0.6 * ld);
  gl_FragColor = vec4(ramp(I) * I * uGain, 1.0);
  if (uChan > 0.5) gl_FragColor = vec4(euvDisc(g, mu, act) * uGain, 1.0);
}
`;

// Bildtafel zur Kamera um die Sonnenmitte (Einheit: uSize = Ausdehnung in Szeneneinheiten)
export const BILLBOARD_VERT = /* glsl */ `
uniform float uSize;
varying vec2 vQ;
void main() {
  vQ = uv * 2.0 - 1.0;
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  c.xy += position.xy * uSize;
  gl_Position = projectionMatrix * c;
}
`;

// Korona + Chromosphäre auf der Bildtafel. r in Einheiten des sichtbaren Sonnenrands (uLimb gleicht die Perspektive aus:
// nah wirkt die Kugel in der Mittelebene größer als 1). Helligkeit nach Baumbach (1937): I/I☉ = 10⁻⁶ (0,0532 r⁻²·⁵ +
// 1,425 r⁻⁷ + 2,565 r⁻¹⁷) – innen K-Korona steil, außen ∝ r⁻²·⁵. Die Dynamik ist wie bei bearbeiteten Finsternisfotos
// (Radialfilter) mit der Potenz 0,45 gestaucht und die Korona um Größenordnungen verstärkt (echt nur bei Totalität sichtbar).
// Struktur: Helmstreamer (breit am Fuß, darüber schmaler Strahl, drehen mit der Sonne), Polar-Plumes, Filamente aus
// Grat-Rauschen schnell über den Positionswinkel und langsam über log r, langsames Atmen. Chromosphäre: dünner Hα-Saum
// (656 nm, rosa wie im Flash-Spektrum) mit Spikulen; echt ≈ 2.000–10.000 km, hier etwa doppelt so hoch.
export const CORONA_FRAG = /* glsl */ `
${NOISE}
#define STR ${STREAMERS}
uniform float uTime, uExt, uGain, uLimb, uCorona, uChromo;
uniform vec2 uPole;
uniform vec3 uStr[STR];
varying vec2 vQ;
// ---- SDO-Kanäle: EUV-Korona über dem Rand, optisch dünn; Helligkeit fällt mit der Skalenhöhe der Temperatur (H ≈ 50 Mm je
// Mio. K: 171 Å ≈ 0,045 R☉, 193 Å ≈ 0,09 R☉), hell über aktiven Regionen (uStr), dunkel über den polaren Löchern (uPolar) mit
// feinen Plumes. 304 Å: heller Chromosphärensaum mit Spikulen („Fell“), echt ≈ 5.000–10.000 km.
uniform float uChan, uPolar;
${EUV_TINT}
vec3 euvCorona(float r, float h, float pa, vec2 cp, float lr, float px, float rq) {
  float st = 0.0;
  for (int i = 0; i < STR; i++) {
    vec3 s = uStr[i];
    float da = abs(mod(pa - s.x + 3.14159265, 6.2831853) - 3.14159265);
    st += s.z * exp(-da * da / (s.y * s.y * 0.5));
  }
  float rays = ridged(vec3(cp * 30.0, lr * 1.5 - uTime * 0.004), 3);
  float plume = pow(abs(cp.x), 10.0) * (0.3 + 0.9 * (fbm(vec3(cp * 70.0, lr * 0.8), 2) * 0.5 + 0.5));
  float I;
  if (uChan > 1.5 && uChan < 2.5) {
    float sp = gnoise(vec3(cp * 150.0, uTime * 0.1)) * 0.5 + 0.5;
    float top = 0.008 + 0.022 * sp * sp;
    I = (1.0 - smoothstep(top * 0.4, top + px, h)) * min(1.0, (top + 0.004) / (px + 0.004)) * 1.4 + 0.12 * exp(-h / 0.04);
  } else {
    float H = uChan < 1.5 ? 0.045 : 0.09;
    float polar = 1.0 - 0.75 * uPolar * pow(abs(cp.x), 3.0);
    I = (exp(-h / H) * (0.35 + 1.3 * st * (0.55 + 0.7 * rays) + 0.5 * plume) * 0.9 + 0.05 * exp(-h / (H * 6.0))) * polar;
  }
  return euvTint(I, uChan) * (1.0 - smoothstep(0.6, 1.0, rq));
}
void main() {
  float rq = length(vQ);
  float r = rq * uExt / uLimb;
  if (r < 0.995 || rq > 1.0) discard;
  vec2 c = vQ / rq, pe = vec2(-uPole.y, uPole.x);
  float pa = atan(dot(c, pe), dot(c, uPole));
  vec2 cp = vec2(cos(pa), sin(pa));
  float h = r - 1.0, lr = log(r);
  float px = fwidth(r);
  vec3 col = vec3(0.0);
  if (uCorona > 0.0) {
    float K = 0.0532 * pow(r, -2.5) + 1.425 * pow(r, -7.0) + 2.565 * pow(r, -17.0);
    float st = 0.0;
    for (int i = 0; i < STR; i++) {
      vec3 s = uStr[i];
      float da = abs(mod(pa - s.x + 3.14159265, 6.2831853) - 3.14159265);
      float w = s.y * (0.28 + 1.2 * exp(-h / 0.6));
      st += s.z * exp(-da * da / (w * w));
    }
    float fil = ridged(vec3(cp * 15.0, lr * 1.3 - uTime * 0.006), 4);
    float fine = fbm(vec3(cp * 48.0, lr * 0.6 + uTime * 0.004), 2) * 0.5 + 0.5;
    float plume = pow(abs(cp.x), 6.0) * (0.3 + 1.4 * fine * fine);
    float breathe = 1.0 + 0.14 * gnoise(vec3(cp * 1.6, uTime * 0.03));
    float S = (0.1 + 1.7 * st + 0.8 * plume) * (0.15 + 1.2 * fil) * (0.75 + 0.5 * fine) * breathe;
    float I = pow(K * S / 4.04, 0.45);
    float fade = 1.0 - smoothstep(0.6, 1.0, rq);
    vec3 tint = mix(vec3(1.0, 0.86, 0.72), vec3(0.9, 0.95, 1.0), smoothstep(1.0, 1.7, r));
    col += tint * I * fade * uCorona;
  }
  // Chromosphäre mit Spikulen; aus der Ferne (Saum < 1 Pixel) als weicher rosa Rand
  float sp = gnoise(vec3(cp * 120.0, uTime * 0.12)) * 0.5 + 0.5;
  sp = mix(sp, 0.5, smoothstep(0.002, 0.006, px));
  float top = 0.005 + 0.016 * sp * sp;
  float ch = (1.0 - smoothstep(top * 0.5, top + px, h)) * min(1.0, (top + 0.004) / (px + 0.004));
  col += vec3(1.0, 0.09, 0.16) * ch * uChromo;
  if (uChan > 0.5) col += euvCorona(r, h, pa, cp, lr, px, rq);
  gl_FragColor = vec4(col * uGain, 1.0);
}
`;

// Protuberanzen: Plasmabögen entlang magnetischer Schleifen. Lebenszyklus je Bogen (aufsteigen, stehen, vergehen) im
// Zeitraffer (echt Stunden bis Monate, hier ≈ 40–80 s). Eruption (uBurstSeed): Bogen hebt ab und verblasst, der Massen-
// auswurf übernimmt. Plasma fließt sichtbar entlang des Bogens von der Spitze zu den Fußpunkten (koronaler Regen),
// verdrillte Fäden; zweilagig: heller Kern + weicher Halo (Hα rosa-rot). Vor der Scheibe unsichtbar (Strahl-Kugel-Test).
export const LOOP_VERT = /* glsl */ `
attribute float seed;
attribute vec3 base;
uniform float uTime, uRate, uBurstT, uBurstSeed;
varying vec2 vUv;
varying float vSeed, vEnv, vBurst;
varying vec3 vN, vP;
void main() {
  float sp = 0.6 + 0.8 * fract(seed * 7.31);
  float cyc = fract(uTime * uRate * 0.02 * sp + seed);
  float env = smoothstep(0.0, 0.15, cyc) * (1.0 - smoothstep(0.6, 0.95, cyc));
  float grow = 0.35 + 0.65 * smoothstep(0.0, 0.35, cyc);
  float act = step(abs(seed - uBurstSeed), 0.001) * (1.0 - step(12.0, uBurstT));
  float bt = act * clamp(uBurstT / 5.0, 0.0, 1.0);
  vec3 p = base + (position - base) * grow * (1.0 + 5.0 * bt * bt);
  vEnv = mix(env, max(env, 0.85) * (1.0 - smoothstep(1.5, 5.0, uBurstT)), act);
  vBurst = act * exp(-uBurstT * 1.1);
  vUv = uv; vSeed = seed;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
export const LOOP_FRAG = /* glsl */ `
${NOISE}
uniform float uTime, uGain, uSunR;
uniform vec3 uSunC;
varying vec2 vUv;
varying float vSeed, vEnv, vBurst;
varying vec3 vN, vP;
// SDO-Kanäle: 304 Å zeigt das kühle Plasma hell (He II), 171/193 Å kaum (zu kühl, dort eher dunkel vor der Korona)
uniform float uChan;
${EUV_TINT}
vec3 promChan(vec3 col) {
  float l = dot(col, vec3(0.45, 0.4, 0.15));
  return uChan > 1.5 && uChan < 2.5 ? euvTint(l * 1.1, 2.0) : euvTint(l * 0.12, uChan);
}
void main() {
  if (vEnv < 0.003 && vBurst < 0.003) discard;
  float sp = 0.6 + 0.8 * fract(vSeed * 7.31);
  float s = abs(vUv.x - 0.5) * 2.0;
  float ang = vUv.y * 6.2831853 + vUv.x * 9.0;
  vec2 ring = vec2(cos(ang), sin(ang));
  float flow = fbm(vec3(s * 8.0 - uTime * 0.5 * sp, ring * 0.7 + vSeed * 13.0), 3) * 0.5 + 0.5;
  float thr = ridged(vec3(ring * 1.8, vUv.x * 7.0 - uTime * 0.25 * sp + vSeed * 5.0), 2);
  float mu = max(dot(normalize(vN), normalize(cameraPosition - vP)), 0.0);
  float core = pow(mu, 4.0), halo = pow(mu, 1.4);
  float foot = smoothstep(0.7, 1.0, s);
  vec3 d = normalize(vP - cameraPosition), oc = uSunC - cameraPosition;
  float tca = dot(oc, d), d2 = dot(oc, oc) - tca * tca;
  float onDisc = (d2 < uSunR * uSunR && tca > length(vP - cameraPosition)) ? 1.0 : 0.0;
  // Knoten und Lücken entlang des Bogens (Plasma ballt sich), Beine dichter als die Spitze
  float knots = smoothstep(0.25, 0.75, fbm(vec3(s * 3.0 - uTime * 0.2 * sp, vSeed * 17.0, 1.7), 2) * 0.5 + 0.5);
  float dens = (0.15 + 1.3 * flow * flow) * (0.45 + 0.9 * thr) * (0.25 + 0.95 * knots) * (0.7 + 0.5 * foot);
  // Farben linear (vor ACES/sRGB): Hα tiefrot-rosa, heißer Kern orange
  vec3 ha = vec3(1.0, 0.07, 0.11), hot = vec3(1.0, 0.32, 0.18);
  vec3 col = ha * (core * dens * 2.0 + halo * 0.5 * dens * dens) + hot * core * dens * (0.15 + 0.5 * foot);
  col *= vEnv;
  col += vec3(1.0, 0.92, 0.88) * vBurst * core * (1.5 + 7.0 * foot);
  if (uChan > 0.5) col = promChan(col);
  gl_FragColor = vec4(col * uGain * (1.0 - 0.95 * onDisc), 1.0);
}
`;

// Koronaler Massenauswurf auf einer Bildtafel: heller Rand (verdichtetes Plasma, weiß im Thomson-Streulicht wie im
// Koronagraphen), dunkle Kavität, rosa Kern (Rest der Protuberanz), davor die Stoßfront als feiner Ring. uK = Lebensanteil,
// uDir = Ausbreitungsrichtung im Bild, uSide = wie stark sie in der Bildebene liegt (0 = Halo-Auswurf auf uns zu).
// Echt 250–3.000 km/s, also Stunden bis 6 Sonnenradien – hier ≈ 9 s.
export const CME_FRAG = /* glsl */ `
${NOISE}
uniform float uK, uGain, uSide, uTime;
uniform vec2 uDir;
varying vec2 vQ;
void main() {
  float r = length(vQ);
  if (r > 1.0) discard;
  vec2 n = vQ / max(r, 1e-4);
  float lead = mix(1.0, smoothstep(-0.35, 0.85, dot(n, uDir)), uSide);
  float wob = fbm(vec3(n * 3.0, uK * 2.0 + uTime * 0.05), 3);
  float rs = 0.6 + 0.05 * wob;
  float shell = exp(-pow((r - rs) / (0.05 + 0.03 * uK), 2.0)) * lead * (0.6 + 0.9 * (fbm(vec3(n * 9.0, uK * 3.0), 2) * 0.5 + 0.5));
  float cavity = smoothstep(rs, rs - 0.25, r) * 0.08 * lead;
  vec2 kc = vQ + uDir * uSide * 0.22;
  float core = exp(-dot(kc, kc) / 0.012) * (0.6 + 0.6 * wob);
  float shock = exp(-pow((r - 0.86) / 0.018, 2.0)) * mix(1.0, smoothstep(-0.6, 0.9, dot(n, uDir)), uSide) * 0.3;
  float life = smoothstep(0.0, 0.06, uK) * (1.0 - uK) * (1.0 - uK);
  vec3 col = vec3(0.95, 0.96, 1.0) * (shell + cavity + shock) + vec3(1.0, 0.35, 0.42) * core;
  gl_FragColor = vec4(col * life * uGain * smoothstep(1.0, 0.92, r), 1.0);
}
`;

// Schleifen-Geometrie: n Bögen auf der Einheitskugel (Ort im Sonnen-System, y = Pol), meist in den Aktivitätsgürteln
// ±8–35°, zwei ruhende Polarkranz-Protuberanzen bei 50–65°; Größen von kleinen Schleifen bis zu großen Bögen (Höhe bis
// ≈ 0,38 R☉ – große ruhende Protuberanzen erreichen echt 0,1–0,3 R☉, hier etwas höher gezeichnet).
// Attribute: seed (je Bogen), base (Fußmitte, für Aufsteigen und Eruption).
export function loopsGeometry(n, rand) {
  const parts = [], meta = [];
  const Y = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < n; k++) {
    const polar = k < 2;
    const lon = rand() * Math.PI * 2, lat = (polar ? 50 + rand() * 15 : 8 + rand() * 27) * RAD * (rand() < 0.5 ? 1 : -1);
    const big = rand();
    const d = 0.035 + big * big * 0.19, h = Math.min(0.38, d * (0.7 + rand() * 1.4) + (polar ? 0.06 : 0));
    const tw = (rand() - 0.5) * 0.7, rt = 0.014 + rand() * 0.016 + d * 0.05;
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const a = Math.PI * (1 - i / 28), sa = Math.sin(a);
      pts.push(new THREE.Vector3(Math.cos(a) * d, sa * h * (1 + 0.15 * Math.sin(a * 3 + k)), sa * h * tw));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, rt, 8, false);
    const nrm = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
    const o = new THREE.Object3D();
    o.position.copy(nrm).multiplyScalar(0.995);
    o.quaternion.setFromUnitVectors(Y, nrm);
    o.rotateY(rand() * Math.PI * 2);
    o.updateMatrix();
    tube.applyMatrix4(o.matrix);
    const seed = (k + 0.5) / n, cnt = tube.attributes.position.count;
    tube.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(cnt).fill(seed), 1));
    const bs = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) bs.set([o.position.x, o.position.y, o.position.z], i * 3);
    tube.setAttribute('base', new THREE.BufferAttribute(bs, 3));
    parts.push(tube);
    meta.push({ seed, apex: nrm.clone().multiplyScalar(1 + h * 0.9), dir: nrm.clone(), foot: nrm.clone().multiplyScalar(1.004) });
  }
  const names = ['position', 'normal', 'uv', 'seed', 'base'];
  const arr = Object.fromEntries(names.map((k) => [k, []])), idx = [];
  let off = 0;
  for (const g of parts) {
    for (const k of names) arr[k].push(...g.attributes[k].array);
    for (const i of g.index.array) idx.push(i + off);
    off += g.attributes.position.count;
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  const size = { position: 3, normal: 3, uv: 2, seed: 1, base: 3 };
  for (const k of names) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(arr[k]), size[k]));
  g.setIndex(idx);
  g.userData.meta = meta;
  return g;
}

// Fleckengruppen im mitrotierenden Plasma (y = Pol): Vorläufer näher am Äquator (Joy'sches Gesetz), Nachfolger kleiner,
// in Rotationsrichtung dahinter. Umbra-Radius 0,005–0,013 R☉ (Penumbra 2,4-fach) – etwa doppelt so groß wie echte große Flecken.
export function spotGroups(rand) {
  const out = [];
  for (let k = 0; k < SPOTS / 2; k++) {
    const hemi = rand() < 0.5 ? 1 : -1, lat = (6 + rand() * 18) * RAD * hemi, lon = rand() * Math.PI * 2;
    const w = 0.005 + rand() * 0.008, sep = (3 + rand() * 6) * RAD;
    const at = (la, lo) => { const c = Math.cos(la); return new THREE.Vector3(-Math.cos(lo) * c, Math.sin(la), Math.sin(lo) * c); };
    out.push(new THREE.Vector4(...at(lat - hemi * 1.5 * RAD, lon).toArray(), w));
    out.push(new THREE.Vector4(...at(lat + hemi * 1.5 * RAD, lon - sep).toArray(), rand() < 0.75 ? w * (0.5 + rand() * 0.4) : 0));
  }
  return out;
}

// Helmstreamer: Richtung im Sonnen-System (y = Pol), Winkelbreite [rad], Stärke. Um das Maximum (2024–26) in allen Breiten.
export function streamerSet(rand) {
  return Array.from({ length: STREAMERS }, () => {
    const lat = (rand() - 0.5) * 2 * 60 * RAD, lon = rand() * Math.PI * 2;
    return { dir: new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)), w: 0.12 + rand() * 0.16, amp: 0.5 + rand() * 0.8 };
  });
}

// Bildtafel senkrecht zur Linie Kamera → Objekt-Ursprung (statt zur Blickachse): für Kameras nah an der Sonne, die neben die
// Mitte blicken (Station Sonne, Blick über den Rand) – dort gilt die Randformel uLimb nur in dieser Ebene. Achsen vQ: u =
// waagerecht, v = senkrecht im Bild (wie bei BILLBOARD_VERT, wenn die Kamera auf die Mitte blickt); Pol und Streamer im Bild
// daher auf (u, v) projizieren (aimAxes in sun.js).
export const BILLBOARD_AIM_VERT = /* glsl */ `
uniform float uSize;
varying vec2 vQ;
void main() {
  vQ = uv * 2.0 - 1.0;
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 w = normalize(c.xyz);
  vec3 u = normalize(cross(w, abs(w.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0)));
  vec3 v = cross(u, w);
  c.xyz += (u * position.x + v * position.y) * uSize;
  gl_Position = projectionMatrix * c;
}
`;

// Koronaschleifen (171/193 Å): heißes Plasma entlang der Feldlinien einer aktiven Region. Fäden mit weichem Rand, jeder
// atmet langsam (25–60 s), Plasma läuft sichtbar entlang (< 0,5 Hz, kein Flackern), Fußpunkte heller („Moos“). Nach einem
// Flare leuchten die Schleifen um uFlareP weich auf (Anstieg ≈ 1 s, Abklingen ≈ 4 s – kein Blitzen, WCAG 2.3.1).
// In 193 Å breiter und schwächer als in 171 Å.
export const CLOOP_VERT = /* glsl */ `
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
export const CLOOP_FRAG = /* glsl */ `
uniform float uTime, uChan, uGain, uDens, uFlareT;
uniform vec3 uFlareP;
varying vec2 vUv;
varying float vSeed;
varying vec3 vN, vP;
${EUV_TINT}
void main() {
  if (vSeed > uDens) discard;
  float mu = abs(dot(normalize(vN), normalize(cameraPosition - vP)));
  float prof = mu * mu;
  float life = smoothstep(0.15, 0.85, sin(uTime * (0.1 + 0.15 * fract(vSeed * 3.7)) + vSeed * 40.0) * 0.5 + 0.5);
  float flow = 0.8 + 0.2 * sin((vUv.x * 7.0 - uTime * (0.2 + 0.2 * fract(vSeed * 5.3))) * 6.2831853 + vSeed * 17.0);
  float foot = 1.0 + 1.2 * pow(abs(vUv.x - 0.5) * 2.0, 8.0);
  float d = distance(vP, uFlareP);
  float fl = smoothstep(0.0, 1.0, uFlareT) * exp(-uFlareT * 0.25) * exp(-d * d / 0.012);
  float I = prof * ((0.25 + 0.75 * life) * flow * foot * (0.8 + 0.4 * fract(vSeed * 11.0)) + 3.0 * fl);
  gl_FragColor = vec4(euvTint(I * (uChan > 2.5 ? 0.55 : 1.0), uChan) * uGain, 1.0);
}
`;

// Fäden einer aktiven Region zwischen Vorläufer- und Nachfolgerpolarität (a, b: Einheitsvektoren im Sonnen-System, y = Pol).
// Innen kurze, flache Bögen, außen ein Fächer bis ≈ 0,25 R☉ hoch; Ebenen leicht geschert (verdrilltes Feld). Echt 1–2 Mm
// dick, hier ≈ 1,5–3 Mm. Attribut seed (0 … 1) je Faden – uDens blendet Fäden über seed aus.
export function coronalLoopsGeometry(a, b, n, rand) {
  const mid = a.clone().add(b).normalize();
  const e1 = a.clone().sub(b);
  e1.addScaledVector(mid, -e1.dot(mid));
  const half = e1.length() / 2;
  e1.normalize();
  const e2 = new THREE.Vector3().crossVectors(mid, e1);
  const pos = [], nrm = [], uvs = [], seeds = [], idx = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const s = 0.4 + 2.0 * Math.pow(rand(), 1.6), w = half * s;
    const off = (rand() - 0.5) * half * (0.8 + s), shear = (rand() - 0.5) * half * 0.9;
    const h = w * (0.7 + 0.6 * rand()), bulge = (rand() - 0.5) * w * 0.5;
    A.copy(mid).addScaledVector(e1, w).addScaledVector(e2, off + shear).normalize();
    B.copy(mid).addScaledVector(e1, -w).addScaledVector(e2, off - shear).normalize();
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, sa = Math.sin(Math.PI * u);
      pts.push(A.clone().lerp(B, u).normalize().multiplyScalar(1 + h * sa).addScaledVector(e2, bulge * sa));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.0022 + 0.0022 * rand(), 4, false);
    const o = pos.length / 3, seed = rand(), at = tube.attributes;
    pos.push(...at.position.array); nrm.push(...at.normal.array); uvs.push(...at.uv.array);
    for (let i = 0; i < at.position.count; i++) seeds.push(seed);
    for (const i of tube.index.array) idx.push(i + o);
    tube.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1));
  g.setIndex(idx);
  return g;
}
