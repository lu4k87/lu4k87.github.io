// Milchstraße als eigenes Modell auf der Innenseite der Himmelskugel – das ESO-Panorama eso0932a (ESO/S. Brunier,
// CC BY 4.0) ist nur Vorlage und im Zahnrad als Vergleich wählbar („Quelle“). Zwei Stufen:
// 1. Backen (einmal; neu bei „Dicke der Scheibe“ und „Nachbargalaxien“): je Richtung ein Sehstrahl von der Sonne durch ein
//    Modell der Galaxis – dünne + dicke Sternscheibe, Balken/Bulge (nahes Ende bei positivem l), vier Spiralarme und der
//    Orion-Arm, Staubscheibe mit Wolken aus 3D-Rauschen (nahe Wolken erscheinen groß, ferne klein) – dazu Himmels-Details
//    an ihren echten Orten (Dunkelwolken, Hα-Gebiete, Magellansche Wolken, Andromeda). Ergebnis: Würfelkarte in
//    galaktischen Achsen wie tools/milkyway_tex.py (+x Zentrum, +y l = 90°, +z Nordpol), Halbfloat, Kanäle
//    r = Sternlicht ohne Staub (Band ≈ 1), g = Anteil alter, gelber Sterne, b = wirksame optische Tiefe, a = Hα.
// 2. Zeigen (je Bild, billig): Staub, Nebel, Farbe, Kontrast, Struktur, Lichthof, Kern und Sternstaub sind Uniforms –
//    alle Regler im Zahnrad › Global › Milchstraße wirken sofort, ohne neu zu backen.
// Maße des Modells: Richtwerte (R0 = 8,2 kpc, Scheibe hR 2,6 kpc / hz 0,3 kpc, Staub hz 0,11 kpc, Balken 27°), kein Katalog.

import * as THREE from 'three';
import { NOISE, SKY_VERTEX } from './glsl.js';
import { settings, onSettings } from './settings.js';

export const MILKY_TEX = 'milkyway/';   // Würfelkarte des ESO-Fotos (nur Vergleich)

const BAKE_VERT = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const BAKE_FRAG = /* glsl */ `
${NOISE}
uniform float uFace, uSize, uWidth, uNear;
const float R0 = 8.2;
const vec3 SUN = vec3(-8.2, 0.0, 0.02);
// Richtung je Texel nach der GL-Würfelregel (Bildzeile 0 = t 0), gleiche Seiten wie tools/milkyway_tex.py
vec3 faceDir(vec2 st) {
  float s = st.x * 2.0 - 1.0, t = st.y * 2.0 - 1.0;
  if (uFace < 0.5) return vec3(1.0, -t, -s);
  if (uFace < 1.5) return vec3(-1.0, -t, s);
  if (uFace < 2.5) return vec3(s, 1.0, t);
  if (uFace < 3.5) return vec3(s, -1.0, -t);
  if (uFace < 4.5) return vec3(s, -t, 1.0);
  return vec3(-s, -t, -1.0);
}
float sech2(float x) { float e = exp(-2.0 * abs(x)); return 4.0 * e / ((1.0 + e) * (1.0 + e)); }
// Spiralarme: vier logarithmische Arme (Steigung 12°), die Sonne liegt zwischen zwei Armen; dazu der Orion-Arm durch
// die Sonne Richtung Cygnus (l ≈ 80°) und Vela (l ≈ 260°)
float arms(vec2 xy, float R) {
  float th = atan(xy.y, xy.x);
  float a = pow(0.5 + 0.5 * cos(4.0 * (th - log(R / R0) / 0.2126) + 3.14159), 5.0);
  vec2 q = xy - SUN.xy, e = vec2(0.174, 0.985);
  float along = dot(q, e), across = q.x * e.y - q.y * e.x;
  return a + 0.7 * exp(-across * across / 0.06) * exp(-along * along / 9.0);
}
// Rauschen mit Detailstufe: Oktaven kleiner als der Schritt längs des Strahls fallen weg (kein Flimmern in der Ferne)
float lodNoise(vec3 q, float f, float ds, int oct) {
  float s = 0.0, a = 0.5;
  q *= f;
  for (int i = 0; i < 5; i++) {
    if (i >= oct) break;
    float w = clamp(1.6 - ds * f, 0.0, 1.0);
    if (w <= 0.0) break;
    s += a * w * gnoise(q);
    q = ROT3 * q * 2.03; f *= 2.03; a *= 0.5;
  }
  return s;
}
// Dichten am Ort p (kpc, galaktozentrisch): x alte Sterne, y junge Sterne, z Staub, w Hα
vec4 galaxy(vec3 p, float ds) {
  float R = length(p.xy), z = p.z, W = uWidth;
  vec3 q = p - SUN;
  float arm = arms(p.xy, max(R, 0.3));
  float edge = 1.0 - smoothstep(13.0, 17.0, R);
  float thin = exp(-(R - R0) / 2.6) * sech2(z / (0.17 * W)) * smoothstep(1.8, 4.2, R) * edge;
  float thick = 0.03 * exp(-(R - R0) / 3.6) * exp(-abs(z) / (0.9 * W)) * edge;
  // Balken + Bulge (Erdnuss): Hauptachse 27° gegen die Linie Sonne–Zentrum, nahes Ende bei positivem l
  vec2 ax = vec2(-0.891, 0.454);
  float u = dot(p.xy, ax), v = p.x * ax.y - p.y * ax.x;
  float rb = length(vec3(u / 1.4, v / 0.55, z / 0.45));
  float bulge = 26.0 * exp(-pow(rb, 1.4)) + 20.0 * exp(-length(vec3(p.xy, z * 1.6)) / 0.15);
  // Sternwolken: grobe Ballung längs des Strahls
  float clump = max(0.0, 1.0 + 1.1 * lodNoise(q, 2.5, ds, 2));
  float young = thin * (0.4 + 2.5 * arm) * clump * sech2(z / (0.09 * W)) / max(sech2(z / (0.17 * W)), 1e-4);
  float old = (thin * 0.8 * clump + thick) + bulge;
  // Staub: dünner als die Sterne, in den Armen dichter, Wolken als log-normales Rauschen; zentrale Molekülzone
  float dust = exp(-(R - R0) / 3.4) * sech2(z / (0.11 * W)) * smoothstep(1.2, 3.2, R) * edge * (0.35 + 1.3 * arm)
             + 5.0 * exp(-R / 0.22) * sech2(z / 0.05);
  dust *= exp(2.4 * lodNoise(q + 7.0, 11.0, ds, 4) - 0.4) * smoothstep(0.06, 0.3, length(q));   // Lokale Blase: kaum Staub um die Sonne
  float hii = young * (0.04 + 1.5 * arm * smoothstep(0.15, 0.55, lodNoise(q + 19.0, 5.0, ds, 2)));   // + schwaches ionisiertes Gas überall
  return vec4(old, young, dust, hii);
}
float wrapL(float x) { return mod(x + 180.0, 360.0) - 180.0; }
// Ellipse am Himmel (Grad): Mitte c = (l, b), Halbachsen r, Drehung ang
float ell(vec2 p, vec2 c, vec2 r, float ang) {
  vec2 q = vec2(wrapL(p.x - c.x) * cos(radians(c.y)), p.y - c.y);
  float ca = cos(radians(ang)), sa = sin(radians(ang));
  q = vec2(ca * q.x + sa * q.y, -sa * q.x + ca * q.y) / r;
  return exp(-dot(q, q));
}
// Schlauch um eine Strecke a–b (Grad), Breite w
float seg(vec2 p, vec2 a, vec2 b, float w) {
  vec2 q = vec2(wrapL(p.x - a.x), p.y - a.y), e = vec2(wrapL(b.x - a.x), b.y - a.y);
  vec2 r = q - e * clamp(dot(q, e) / dot(e, e), 0.0, 1.0);
  return exp(-dot(r, r) / (w * w));
}
float ring(vec2 p, vec2 c, float r, float w) {   // Bogen, z. B. Barnards Loop
  vec2 q = vec2(wrapL(p.x - c.x) * cos(radians(c.y)), p.y - c.y);
  float d = length(q) - r;
  return exp(-d * d / (w * w));
}
// Dunkelwolken vor dem Band (nah, deshalb groß am Himmel): zusätzliche optische Tiefe
float darkClouds(vec2 p) {
  float t = 1.6 * ell(p, vec2(-6.5, 16.5), vec2(2.4, 1.8), 20.0);              // Rho Ophiuchi
  t += 0.9 * seg(p, vec2(-5.0, 15.0), vec2(6.0, 9.0), 1.8);                    // Ophiuchus-Fahnen
  t += 0.7 * seg(p, vec2(-3.0, 17.5), vec2(14.0, 15.0), 1.5);
  t += 0.6 * seg(p, vec2(2.0, 10.0), vec2(9.0, 4.0), 1.6);
  t += 1.3 * seg(p, vec2(-3.5, 6.8), vec2(0.5, 4.8), 0.8);                    // Pfeifennebel: Stiel
  t += 1.6 * ell(p, vec2(1.0, 4.0), vec2(1.6, 1.1), 30.0);                     // … und Kopf
  t += 2.0 * seg(p, vec2(8.0, 2.5), vec2(32.0, 3.5), 2.8);                     // Großer Riss: Aquila
  t += 1.8 * seg(p, vec2(32.0, 3.5), vec2(58.0, 0.5), 2.6);
  t += 1.4 * seg(p, vec2(58.0, 0.5), vec2(88.0, 1.5), 2.2);                    // … bis Cygnus
  t += 1.5 * ell(p, vec2(-59.0, -0.8), vec2(3.0, 2.4), 0.0);                   // Kohlensack
  t += 0.8 * seg(p, vec2(-21.0, 16.0), vec2(-16.0, 10.0), 1.2);                // Lupus
  t += 1.2 * ell(p, vec2(0.0, -19.0), vec2(1.3, 0.5), 30.0);                   // Corona Australis
  t += 0.8 * ell(p, vec2(-60.0, -16.0), vec2(1.8, 1.2), 0.0);                  // Chamaeleon
  t += 0.7 * ell(p, vec2(172.0, -15.0), vec2(7.0, 3.5), 25.0);                 // Taurus
  t += 0.6 * ell(p, vec2(100.0, 4.0), vec2(9.0, 2.5), 0.0);                    // Cepheus
  return t;
}
// Hα-Gebiete (rot leuchtender Wasserstoff)
float halpha(vec2 p) {
  float h = 6.0 * ell(p, vec2(-72.4, -0.6), vec2(0.9, 0.7), 0.0) + 0.8 * ell(p, vec2(-72.4, -0.6), vec2(3.5, 2.2), 0.0);  // Carina
  h += 4.0 * ell(p, vec2(6.0, -1.2), vec2(0.45, 0.3), 0.0);                    // Lagune M8
  h += 2.0 * ell(p, vec2(7.0, -0.3), vec2(0.25), 0.0);                         // Trifid M20
  h += 3.0 * ell(p, vec2(15.1, -0.7), vec2(0.3), 0.0);                         // Omega M17
  h += 2.5 * ell(p, vec2(17.0, 0.8), vec2(0.35), 0.0);                         // Adler M16
  h += 2.5 * ell(p, vec2(-8.8, 0.6), vec2(0.5, 0.35), 0.0);                    // NGC 6357/6334
  h += 2.0 * ell(p, vec2(-23.5, -1.5), vec2(0.6, 0.4), 0.0);                   // NGC 6188
  h += 2.0 * ell(p, vec2(-65.1, -1.8), vec2(0.6), 0.0);                        // IC 2944
  h += 1.6 * ell(p, vec2(-68.7, -0.7), vec2(0.5), 0.0);                        // NGC 3576
  h += 3.0 * ell(p, vec2(85.6, -0.9), vec2(1.3, 1.0), 0.0);                    // Nordamerika + Pelikan
  h += 0.9 * ell(p, vec2(78.2, 1.9), vec2(3.0, 2.0), 0.0);                     // Sadr-Gebiet
  h += 1.4 * ell(p, vec2(99.3, 3.7), vec2(1.2), 0.0);                          // IC 1396
  h += 1.3 * ell(p, vec2(134.7, 0.9), vec2(0.8), 0.0) + 1.2 * ell(p, vec2(137.7, 1.1), vec2(0.8), 0.0);  // Herz, Seele
  h += 1.5 * ell(p, vec2(160.6, -12.1), vec2(1.3, 0.4), -40.0);                // California
  h += 2.0 * ell(p, vec2(-153.7, -2.1), vec2(0.6), 0.0);                       // Rosette
  h += 5.0 * ell(p, vec2(-151.0, -19.4), vec2(0.4, 0.5), 0.0);                 // Orionnebel M42
  h += 0.12 * ring(p, vec2(-153.0, -17.5), 7.0, 0.9) * smoothstep(-2.0, 3.0, wrapL(p.x + 153.0));  // Barnards Loop (Osthälfte)
  h += 0.03 * ell(p, vec2(6.3, 23.6), vec2(7.0), 0.0);                         // Sh2-27 um ζ Ophiuchi
  h += 0.02 * ell(p, vec2(-102.0, -2.0), vec2(14.0, 12.0), 0.0);               // Gum-Nebel
  return h;
}
void main() {
  vec3 d = normalize(faceDir(gl_FragCoord.xy / uSize));
  // Sehstrahl von der Sonne, Schritte wachsen mit dem Abstand (nahe Wolken fein, ferne grob)
  const int N = 56;
  const float S0 = 0.015, S1 = 30.0;
  float dl = log(S1 / S0) / float(N), sa = S0;
  float tau = 0.0, y0 = 0.0, y1 = 0.0, wo = 0.0, wy = 0.0, hn = 0.0;
  for (int i = 0; i < N; i++) {
    float sb = S0 * exp(float(i + 1) * dl), ds = sb - sa, sm = 0.5 * (sa + sb);
    vec3 p = SUN + d * sm;
    if (abs(p.z) > 5.0 || length(p.xy) > 22.0) break;
    vec4 g = galaxy(p, ds);
    float dt = 0.55 * g.z * ds, att = exp(-tau - 0.5 * dt);
    // nahe Sterne (bis ≈ 1–2 kpc) sind einzeln sichtbar und kommen als Punkte (stars.js/catalog.js) – kaum ins Band
    float e = (g.x + g.y) * ds * smoothstep(0.5, 3.0, sm);
    y0 += e;
    y1 += e * att;
    wo += g.x * ds * att;
    wy += g.y * ds * att;
    hn += g.w * ds * att;
    tau += dt;
    sa = sb;
  }
  float tauE = log(max(y0, 1e-6) / max(y1, 1e-7));
  vec2 p = vec2(degrees(atan(d.y, d.x)), degrees(asin(clamp(d.z, -1.0, 1.0))));
  // Himmels-Details: Ränder verwirbelt, Staub als Fäden (Grat-Rauschen), Sternwolken fleckig
  vec2 pw = p + 2.2 * vec2(gnoise(d * 11.0), gnoise(d * 11.0 + 7.0)) + 0.5 * vec2(gnoise(d * 60.0 + 3.0), gnoise(d * 60.0 + 11.0));
  vec3 dw = d + 0.04 * vec3(gnoise(d * 7.0), gnoise(d * 7.0 + 3.0), gnoise(d * 7.0 + 5.0));
  vec3 da = vec3(dw.xy, dw.z * 2.2);   // längs der Ebene gestreckt: Staubbahnen liegen flach im Band
  float fil = smoothstep(-0.3, 0.4, fbm(da * 18.0 + 3.0, 5));
  tauE *= 0.75 + 0.5 * fil;
  // Staubbahnen im Band: Fäden und Flecken längs der Ebene, über dem Zentrum breiter und etwas nördlich (nahe Wolken
  // in Ophiuchus und Scorpius), Stärke zum Zentrum hin größer
  float cen = exp(-pow(p.x / 28.0, 2.0));
  float lat = exp(-pow((pw.y - 0.3 - 2.5 * cen - 1.5 * gnoise(d * 5.0)) / (3.2 + 6.0 * cen), 2.0));
  float pat = 1.5 * smoothstep(-0.22, 0.32, fbm(da * 9.0 + 5.0, 6)) + 0.7 * smoothstep(0.0, 0.4, fbm(da * 22.0 + 2.0, 5));
  tauE += (1.8 + 2.4 * cen) * lat * pat;
  tauE += darkClouds(pw) * (0.3 + 0.9 * smoothstep(-0.25, 0.35, fbm(dw * 30.0 + 1.0, 5))) * (0.6 + 0.8 * fil);
  y0 *= (0.6 + 0.8 * smoothstep(-0.4, 0.5, fbm(dw * 22.0 + 9.0, 5))) * (0.85 + 0.3 * smoothstep(-0.3, 0.4, fbm(d * 110.0, 3)));
  float neb = (hn * 0.12 + halpha(pw) * 0.3) * (0.35 + 1.3 * max(0.0, 0.5 + fbm(d * 60.0 + 2.0, 4)));
  float warm = wo / max(wo + 3.0 * wy, 1e-6);
  // Nachbargalaxien: Große und Kleine Magellansche Wolke, Andromeda (M31)
  if (uNear > 0.5) {
    float tex = smoothstep(-0.35, 0.45, fbm(d * 36.0 + 13.0, 5)) * 1.5;
    float lmc = (1.0 * ell(p, vec2(-79.5, -32.9), vec2(2.6, 0.8), -20.0) + 0.35 * ell(p, vec2(-79.5, -33.5), vec2(4.2, 3.6), 0.0)) * tex;
    float smc = (0.7 * ell(p, vec2(-57.2, -44.3), vec2(1.3, 0.6), 30.0) + 0.2 * ell(p, vec2(-57.2, -44.3), vec2(2.4, 1.9), 30.0)) * tex;
    float m31 = 0.35 * ell(p, vec2(121.2, -21.6), vec2(1.4, 0.35), 35.0) + 0.9 * ell(p, vec2(121.2, -21.6), vec2(0.22, 0.1), 35.0);
    float add = (lmc + smc + m31) * 1.2;
    warm = mix(warm, 0.38 + 0.4 * m31 / max(lmc + smc + m31, 1e-4), add / (add + y0 * 0.2 + 1e-4));
    y0 += add / 0.2;
    neb += 2.0 * ell(p, vec2(-80.5, -31.7), vec2(0.35), 0.0) + 2.5 * lmc * smoothstep(0.55, 0.9, fbm(d * 70.0 + 2.0, 3) + 0.5);  // Tarantelnebel, H-II-Knoten
  }
  gl_FragColor = vec4(y0 * 0.2, warm, min(tauE, 14.0), neb);
}
`;

// Zeigen: galaktische Richtung g → Licht. SKY_DIR liefert die Richtung (Himmelskugel: vDir, Plattkarte im Test: Pixel)
const SHOW_FRAG = /* glsl */ `
${NOISE}
uniform samplerCube uMw;
uniform vec3 uNgp, uGc, uL90;
uniform float uBand, uLevel, uCon, uBlack, uClar, uSat, uTemp, uDust, uNeb, uCore, uGlow, uGrain, uReady;
const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);
vec3 tint(float w) { return mix(vec3(0.74, 0.76, 1.0), vec3(1.0, 0.92, 0.82), clamp(w + 0.4 * uTemp, 0.0, 1.0)); }
// Sternlicht hinter Staub: Rot kommt besser durch als Blau → Ränder der Staubbahnen rotbraun
vec3 starLight(vec4 m) { return tint(m.g) * m.r * exp(-uDust * m.b * vec3(0.9, 1.0, 1.1)); }
vec3 nebLight(vec4 m) { return vec3(1.0, 0.3, 0.42) * m.a * uNeb; }
// Sternstaub: je Zelle ein Stern mit zufälliger Helligkeit, Energie bleibt erhalten (Mittel = 1). Zellgröße folgt dem
// Pixel (≈ 2,5 px, zwei Stufen überblendet wie Mipmaps): bei jedem Bildwinkel feines Korn, kein Flimmern beim Drehen
float dustLayer(vec3 g, float F, float px) {
  vec3 id = floor(g * F);
  float h = hash13(id + F * 0.37);
  vec3 sp = normalize((id + vec3(hash13(id + 11.1), hash13(id + 23.7), hash13(id + 37.3))) / F);
  float r = length(g - sp) / px, cell = 1.0 / (F * px);
  return pow(h, 3.0) * 4.0 * exp(-r * r / 0.98) * cell * cell / 3.08;
}
float starDust(vec3 g, float px) {
  float lv = log2(1.0 / (px * 2.5)), k = floor(lv);
  return mix(dustLayer(g, exp2(k), px), dustLayer(g, exp2(k + 1.0), px), lv - k);
}
void main() {
  vec3 d = SKY_DIR;
  vec3 g = vec3(dot(d, uGc), dot(d, uL90), dot(d, uNgp));
  vec4 m = textureCube(uMw, g), mn = textureCube(uMw, g, 3.0), mw = textureCube(uMw, g, 6.0);
  vec3 st = starLight(m), sn = starLight(mn);
  // Struktur: lokaler Kontrast gegen die weiche Umgebung (Sternwolken und Staubkanten)
  float y = dot(st, LUM), yn = dot(sn, LUM);
  st *= pow(clamp((y + 0.003) / (yn + 0.003), 0.05, 20.0), 0.55 * uClar);
  st *= mix(1.0, starDust(g, max(0.7 * length(fwidth(g)), 1e-6)), uGrain);
  vec3 c = st + nebLight(m);
  c += uGlow * (0.2 * (sn + nebLight(mn)) + 0.25 * (starLight(mw) + nebLight(mw)));
  float gcA = acos(clamp(g.x, -1.0, 1.0));
  c += vec3(1.0, 0.86, 0.7) * uCore * (1.0 * exp(-pow(gcA / 0.22, 2.0)) * exp(-pow(g.z / 0.1, 2.0)) + 0.1 * exp(-pow(gcA / 0.35, 2.0)));
  // Kontrast um den mittleren Pegel des Bandes (1), weiche Schulter, Schwarzpunkt, Sättigung
  y = dot(c, LUM);
  c *= pow(max(y, 1e-5), uCon - 1.0) * max(y - 0.45 * uBlack, 0.0) / max(y, 1e-5);
  c /= 1.0 + 0.05 * dot(c, LUM);
  c = max(mix(vec3(dot(c, LUM)), c, uSat), 0.0);
  gl_FragColor = vec4(c * 0.45 * uBand * uLevel * uReady, 1.0);
}
`;
const SKY_VERT = /* glsl */ `
${SKY_VERTEX}
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = skyPosition(vDir);
}
`;
// Vergleich: das ESO-Foto (vorher die Milchstraße der Sonnensystem-Stationen), Look wie ein lang belichtetes Astrofoto
const PHOTO_FRAG = /* glsl */ `
uniform samplerCube uMap;
uniform vec3 uNgp, uGc, uL90;
uniform float uBand, uLevel;
varying vec3 vDir;
const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);
void main() {
  vec3 d = normalize(vDir);
  vec3 g = vec3(dot(d, uGc), dot(d, uL90), dot(d, uNgp));
  vec3 c = max(textureCube(uMap, g).rgb - 0.005, 0.0);
  vec3 near = max(textureCube(uMap, g, 4.0).rgb - 0.005, 0.0);
  vec3 wide = max(textureCube(uMap, g, 7.0).rgb - 0.005, 0.0);
  c *= 1.0 + 6.5 * sqrt(smoothstep(0.003, 0.25, dot(near, LUM)));
  c /= 1.0 + 0.35 * dot(c, LUM);
  c = max(mix(vec3(dot(c, LUM)), c, 1.45), 0.0);
  float bulge = exp(-pow(acos(clamp(g.x, -1.0, 1.0)) / 0.32, 2.0)) * exp(-pow(g.z / 0.16, 2.0));
  gl_FragColor = vec4((c + near * 1.7 + wide * 3.5 + vec3(1.0, 0.72, 0.42) * 0.22 * bulge) * 0.2 * uBand * uLevel, 1.0);
}
`;

// Regler im Zahnrad → Uniforms (gemeinsame Objekte: jede Himmelskugel liest dieselben Werte)
const LIVE = { mwGain: 'uLevel', mwCon: 'uCon', mwBlack: 'uBlack', mwClar: 'uClar', mwSat: 'uSat', mwTemp: 'uTemp',
  mwDust: 'uDust', mwNeb: 'uNeb', mwCore: 'uCore', mwGlow: 'uGlow', mwGrain: 'uGrain' };
const U = { uMw: { value: null }, uReady: { value: 0 } };
for (const u of Object.values(LIVE)) U[u] = { value: 1 };
const live = () => { for (const [k, u] of Object.entries(LIVE)) U[u].value = settings.S[k]; };
live();

// ---------- Backen: eine Würfelseite je Bild beim ersten Mal (Band bleibt bis dahin aus), neu backen in einem Zug ----------
const B = { r: null, rt: null, mat: null, scene: null, cam: null, todo: [], burst: false, readyAt: 0, timer: 0 };
function bakeFace(face, last) {
  const r = B.r, prev = r.getRenderTarget(), pf = r.getActiveCubeFace(), pm = r.getActiveMipmapLevel(), xr = r.xr.enabled;
  r.xr.enabled = false;
  B.mat.uniforms.uFace.value = face;
  B.rt.texture.generateMipmaps = last;   // Mip-Stufen (Lichthof, Struktur) erst nach der letzten Seite
  r.setRenderTarget(B.rt, face);
  r.render(B.scene, B.cam);
  r.setRenderTarget(prev, pf, pm);
  r.xr.enabled = xr;
}
function pump() {
  for (let n = B.burst ? 6 : 1; n > 0 && B.todo.length; n--) { const f = B.todo.shift(); bakeFace(f, !B.todo.length); }
  if (B.todo.length) { requestAnimationFrame(pump); return; }
  if (!B.readyAt) B.readyAt = performance.now();
  U.uMw.value = B.rt.texture;
}
function bake(burst) {
  if (!B.rt) {
    const size = settings.S.quality === '1' ? 512 : 1024;
    B.rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    B.mat = new THREE.ShaderMaterial({ vertexShader: BAKE_VERT, fragmentShader: BAKE_FRAG, depthTest: false, depthWrite: false,
      uniforms: { uFace: { value: 0 }, uSize: { value: size }, uWidth: { value: 1 }, uNear: { value: 1 } } });
    B.scene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), B.mat);
    quad.frustumCulled = false;
    B.scene.add(quad);
    B.cam = new THREE.OrthographicCamera();
  }
  B.mat.uniforms.uWidth.value = settings.S.mwWidth;
  B.mat.uniforms.uNear.value = settings.S.mwNear ? 1 : 0;
  const idle = !B.todo.length;
  B.todo = [0, 1, 2, 3, 4, 5];
  B.burst = burst;
  if (idle) requestAnimationFrame(pump);
}
// Erstes Bild einer Himmelskugel liefert den Renderer; gebacken wird im nächsten Bild, nie mitten im Rendern
function needBake(r) {
  if (B.r) return;
  B.r = r;
  // Nach einem Absturz der GPU stellt der Browser den Kontext neu her, die gebackene Würfelkarte ist dann leer (übrig
  // bliebe nur der verschmierte Lichthof des Zentrums) → in einem Zug neu backen
  r.domElement.addEventListener('webglcontextrestored', () => bake(true));
  bake(false);
}
// Einblenden nach dem Backen (0,6 s), danach fest
function tickReady() {
  if (B.readyAt && U.uReady.value < 1) U.uReady.value = Math.min(1, (performance.now() - B.readyAt) / 600);
}

// ---------- Himmelskugeln ----------
const bands = new Set();
let photoTex = null;
function applyMode(holder) {
  const { mesh, model, tex } = holder.userData;
  mesh.visible = settings.S.mw;
  const usePhoto = settings.S.mwSrc === 'photo' && tex;
  if (usePhoto && !holder.userData.photo) {
    photoTex = photoTex || tex(MILKY_TEX);
    holder.userData.photo = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: PHOTO_FRAG,
      uniforms: { uMap: { value: photoTex }, uNgp: model.uniforms.uNgp, uGc: model.uniforms.uGc, uL90: model.uniforms.uL90, uBand: model.uniforms.uBand, uLevel: U.uLevel },
      side: THREE.BackSide, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, transparent: true });
  }
  mesh.material = usePhoto ? holder.userData.photo : model;
}
onSettings((keys) => {
  if (keys.some((k) => k in LIVE)) live();
  if (B.r && (keys.includes('mwWidth') || keys.includes('mwNear'))) { clearTimeout(B.timer); B.timer = setTimeout(() => bake(true), 250); }
  if (keys.includes('mw') || keys.includes('mwSrc')) bands.forEach(applyMode);
});

// Material des Modells; pano = Plattkarte für tests/milkyway.html (l = 0 in der Mitte, l wächst nach links)
export function milkyMaterial({ pano = false, gain = 1 } = {}) {
  const head = pano ? 'varying vec2 vUv;\n#define SKY_DIR vec3(cos((vUv.y - 0.5) * 3.14159265) * cos((0.5 - vUv.x) * 6.2831853), cos((vUv.y - 0.5) * 3.14159265) * sin((0.5 - vUv.x) * 6.2831853), sin((vUv.y - 0.5) * 3.14159265))\n'
    : 'varying vec3 vDir;\n#define SKY_DIR normalize(vDir)\n';
  return new THREE.ShaderMaterial({
    vertexShader: pano ? 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }' : SKY_VERT,
    fragmentShader: head + SHOW_FRAG,
    uniforms: { ...U, uBand: { value: gain }, uNgp: { value: new THREE.Vector3(0, 0, 1) }, uGc: { value: new THREE.Vector3(1, 0, 0) }, uL90: { value: new THREE.Vector3(0, 1, 0) } },
    side: pano ? THREE.FrontSide : THREE.BackSide, depthWrite: false, depthTest: !pano, blending: pano ? THREE.NoBlending : THREE.AdditiveBlending, transparent: !pano,
  });
}
// Test-Seite: backen ohne Himmelskugel
export function bakeMilkyWay(renderer) { needBake(renderer); return new Promise((ok) => { const w = () => (U.uMw.value ? ok() : requestAnimationFrame(w)); w(); }); }
export const milkyUniforms = U;

// Himmelskugel der Milchstraße: ngp = galaktischer Nordpol, gc = galaktisches Zentrum (beide in der Szene der Station);
// tex = Textur-Lader der Station (ctx.tex) → im Zahnrad „Quelle: ESO-Foto“ wählbar (nur mit echter Lage, d. h. im Sonnensystem)
export function milkyBand(ngp, gc, gain = 1, tex = null) {
  const n = ngp.clone().normalize();
  const u = gc.clone().addScaledVector(n, -gc.dot(n)).normalize();
  const model = milkyMaterial({ gain });
  model.uniforms.uNgp.value.copy(n);
  model.uniforms.uGc.value.copy(u);
  model.uniforms.uL90.value.crossVectors(n, u);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), model);
  mesh.frustumCulled = false;
  mesh.renderOrder = -11;
  mesh.onBeforeRender = (r) => { needBake(r); tickReady(); };
  // Hülle: followStars (Zahnrad „Sterne und Milchstraße“) schaltet die Hülle, „Milchstraße zeigen“ das Netz darin
  const holder = new THREE.Group();
  holder.add(mesh);
  holder.userData = { mesh, model, tex };
  bands.add(holder);
  mesh.geometry.addEventListener('dispose', () => bands.delete(holder));   // Station freigegeben (traverse + dispose)
  applyMode(holder);
  return holder;
}
