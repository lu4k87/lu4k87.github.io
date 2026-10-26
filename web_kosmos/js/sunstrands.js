// Plasmafäden der Sonne für den Look „Glut“ und 304 Å der Station Sonne (sunlook.js, levels/sun.js): Magnetbögen als Bündel
// feiner Fäden im Raum statt als Linien auf einer Bildtafel – Bögen der aktiven Regionen zwischen Vorläufer- und
// Nachfolgerfleck, weitere Arkaden (Rand „Bogen-Arkaden“), Protuberanzen als verdrillte Fadenbündel und die Ausbrüche
// (Modus 1 Filament steigt auf, 2 Flare-Arkade über den Bändern, 3 Protuberanz reißt am Scheitel auf). Jeder Faden ist ein
// Band, das sich im Vertex-Shader zur Kamera dreht; aus der Ferne bleibt es mindestens einen Pixel breit und wird dafür
// dunkler (kein Flimmern). Die Kugel verdeckt per Tiefentest, was hinter dem Rand liegt; über die ersten ≈ 4.000 km blenden die
// Fäden in die Oberfläche aus und wurzeln so im hellen Fußpunkt (Moos im Kugel-Shader) statt an einer Kante zu enden.
// Künstlerisch überhöht: Höhen bis ≈ 0,3 R☉ (Arkaden) bzw. ≈ 1,5 R☉ (Eruption), Fäden ≈ 1,5–3 Mm dick, Tempo im Zeitraffer.
//
// API: strandGeometry(loops, rand, segs) baut die Bänder aus Bogen-Beschreibungen { a, b (Fußpunkte, Einheitsvektoren im
// Mesh-System), h (Scheitelhöhe), lean (Neigung aus der Bogenebene), rope (Bündelradius), width (Fadenradius), threads, I,
// twist (Windungen), flow (Strömung ±), flat (0 rundes Seil … 1 Vorhang), delay, seed }; arcadeLoops, prominenceLoops,
// flareArcade, eruptLoop und loopField (Bögen über die ganze Sonne) liefern solche Listen. Material: STRAND_VERT/STRAND_FRAG mit strandUniforms(), additiv, ohne
// Tiefenschreiben; uMode 0 ruhig · 1 Filament-Eruption · 2 Flare-Arkade (Fußpunkte aus uFS, uFE1, uFE2 wie flareDisk in
// sunlook.js) · 3 Protuberanz reißt ab; uK = Fortschritt des Ausbruchs 0 … 1, uPx = Pixelgröße bei Abstand 1, uDens = Anteil
// der ruhigen Bögen (nach Bogen-seed, Zahnrad „Dichte“).

import * as THREE from 'three';
import { NOISE } from './glsl.js';

export const strandUniforms = () => ({
  uTime: { value: 0 }, uPx: { value: 0.001 }, uGain: { value: 1 }, uPal: { value: 0 }, uMode: { value: 0 }, uK: { value: 0 }, uDens: { value: 1 },
  uFoot: { value: 1 }, uMove: { value: new THREE.Vector3(1, 1, 1) }, uDisk: { value: 0.35 }, uLifeR: { value: 1 }, uScale: { value: 1 }, uTear: { value: 4 },
  uBurst: { value: 1 }, uSpray: { value: 1 },
  uFS: { value: new THREE.Vector3(0, 0, 1) }, uFE1: { value: new THREE.Vector3(1, 0, 0) }, uFE2: { value: new THREE.Vector3(0, 1, 0) },
});

// Fuß (uFoot): 0 Kante (Faden blendet über ≈ 4.000 km aus) · 1 Fibrillen (Wurzeln liegen fächerförmig auf der Oberfläche,
// Plasma strömt in ihnen zum Fußpunkt und steigt ins Bein) · 2 Kelch (Bein weitet sich unten zu einem glühenden Trichter) ·
// 3 Strudel (Wurzeln spiralig, drehen sich langsam; helle Tropfen steigen aus dem Fuß die Beine hinauf).
// Bewegung (uMove): x Strömen (Knoten laufen schneller, Helligkeit wogt), y Pendeln (Knickwelle läuft den Bogen entlang,
// Bögen neigen sich), z Werden und Vergehen (Bogen wächst aus der Oberfläche, leuchtet kurz auf, läuft leer und verblasst;
// je Bogen 18–60 s geteilt durch uLifeR, kein Blitzen); uScale streckt die Höhe der ruhigen Bögen. Wurzeln: Geometrie läuft über s < 0 (Fuß a) und s > 1 (Fuß b) hinaus, u = Wurzel 0 … 1.
export const STRAND_VERT = /* glsl */ `
attribute vec3 aA, aB, aE;
attribute vec4 aL, aT, aS, aF;
uniform float uTime, uPx, uMode, uK, uDens, uFoot, uLifeR, uScale, uTear, uBurst, uSpray;
uniform vec3 uMove, uFS, uFE1, uFE2;
varying float vS, vX, vH, vI, vFlow, vSeed, vCut, vHot, vRes, vU, vCyc;
varying vec3 vW;
const float PI = 3.14159265;
vec3 gA, gB, gN;
float gH, gLean, gRope, gTwist, gSway;
float hash(float n) { return fract(sin(n) * 43758.5453); }
// Mittellinie: Fußpunkte wandern mit (1 − cos)/2 → Beine an den Füßen senkrecht, Scheitel rund
vec3 axisAt(float s) {
  vec3 m = normalize(mix(gA, gB, 0.5 - 0.5 * cos(PI * s)));
  float lift = gH * sin(PI * s);
  return m * (1.0 + lift) + gN * gLean * lift;
}
// Faden im Bündel: Querschnitt (aT.x Winkel, aT.y Radius), Verdrillung, Verjüngung (Kelch: unten weit), Knickwelle
vec3 threadAt(float s, out vec3 T) {
  vec3 c = axisAt(s);
  T = normalize(axisAt(min(s + 0.004, 1.0)) - axisAt(max(s - 0.004, 0.0)));
  vec3 N2 = normalize(cross(T, gN)), N1 = cross(N2, T);
  float ang = aT.x + gTwist * 6.2831853 * s + uTime * 0.03 * sign(gTwist);
  float kel = uFoot > 1.5 && uFoot < 2.5 ? 3.5 * exp(-min(s, 1.0 - s) / 0.07) : 0.0;
  float taper = 0.3 + 0.7 * sin(PI * s) + kel;
  c += N1 * gSway * sin(PI * s) * sin(6.2831853 * (0.65 * s - uTime * 0.06) + aE.y * 30.0);
  return c + (N1 * cos(ang) * (1.0 + 2.5 * aE.z) + N2 * sin(ang) * (1.0 - 0.5 * aE.z)) * aT.y * gRope * taper;
}
void main() {
  if (uMode < 0.5 && aE.y > uDens) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // ausgedünnt: ganzer Faden außerhalb
  float s = aS.x, side = aS.y, k = clamp(uK, 0.0, 1.0);
  float u = s < 0.0 ? -s : max(s - 1.0, 0.0), sl = clamp(s, 0.0, 1.0);
  float I = aT.w, hot = 0.0, cut = 0.0, life = 1.0, lift = 0.0, cyc = -1.0;
  float th = 0.0, tc = 0.5, tk = 0.0, tg = 0.0, te = 1.0, tf = 1.0;   // Riss (uMode 3): Zufall, Mitte, Fortschritt, Spalt, Abstand, Ausblenden
  gA = aA; gB = aB; gH = aL.x; gLean = aL.y; gRope = aL.z; gTwist = aS.z;
  gSway = uMove.y * (0.04 * aL.x + 0.001);
  if (uMode < 0.5) {
    gH *= (1.0 + 0.035 * sin(uTime * 0.14 + aE.y * 30.0)) * uScale;
    gLean += uMove.y * 0.22 * sin(uTime * (0.08 + 0.14 * fract(aE.y * 7.1)) + aE.y * 18.0);
    if (uMove.z > 0.0) {
      // Werden und Vergehen: Fluss taucht auf (Bogen wächst), Aufhellen beim Umbau, Leerlaufen, Ausblenden; je Zyklus andere Höhe
      float P = (aF.x > 0.0 ? aF.x : 22.0 + 38.0 * fract(aE.y * 13.7)) / uLifeR, cn = uTime / P + aF.y + aE.y;
      cyc = fract(cn);
      float grow = smoothstep(0.0, 0.32, cyc) * (0.65 + 0.6 * hash(floor(cn) + aE.y * 91.0));
      gH *= mix(1.0, grow, uMove.z);
      life = mix(1.0, smoothstep(0.0, 0.1, cyc) * (1.0 - smoothstep(0.72, 1.0, cyc)), uMove.z);
      I *= 1.0 + uMove.z * 1.1 * exp(-pow((cyc - 0.3) / 0.07, 2.0));
      // Spontanes Platzen kleiner & mittlerer Bögen (Pinch-Instabilität & Sonnenwind-Abstoßung)
      float burstLoop = step(0.62, hash(floor(cn) * 17.3 + aE.y * 43.1)) * uBurst;
      if (burstLoop > 0.5 && cyc > 0.55) {
        float bPinch = smoothstep(0.55, 0.75, cyc);
        float dScheitel = abs(sl - 0.5);
        if (dScheitel < 0.12 * bPinch) cut = 1.0;
        hot += 1.4 * exp(-dScheitel / 0.07) * exp(-pow((cyc - 0.70) / 0.06, 2.0));
        float drift = smoothstep(0.65, 1.0, cyc);
        lift += cut * drift * drift * (0.35 + 0.55 * hash(aT.z * 47.1)) * uSpray * aL.x;
        life *= (1.0 - smoothstep(0.78, 1.0, cyc));
      }
    }
  } else if (uMode < 1.5) {
    // Filament-Eruption: Aktivierung (Seil hebt sich, hellt auf), dann Beschleunigung; Bündel weitet und verdrillt sich
    float rise = smoothstep(0.12, 0.85, k);
    gH = gH * (1.0 + 0.8 * smoothstep(0.0, 0.15, k)) + 1.3 * rise * rise;
    gLean *= 1.0 + 2.0 * rise;
    gRope *= 1.0 + 2.5 * rise;
    gTwist += 1.4 * smoothstep(0.05, 0.6, k);
    life = smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.72, 1.0, k));
    I *= (1.0 + 0.5 * exp(-pow((k - 0.16) / 0.07, 2.0))) / (1.0 + 1.6 * rise);
  } else if (uMode < 2.5) {
    // Flare-Arkade: Fußpunkte auf den beiden Bändern, die auseinanderwandern; Bögen wachsen mit ihrem Abstand
    float sep = 0.012 + 0.05 * smoothstep(0.08, 0.7, k);
    float uu = aA.x, bend = 0.5 * uu * uu / 0.09;
    gA = normalize(uFS + uFE1 * uu + uFE2 * (bend + sep));
    gB = normalize(uFS + uFE1 * uu + uFE2 * (bend - sep));
    gH = aL.x * sep;
    life = smoothstep(0.1 + aE.x, 0.2 + aE.x, k) * (1.0 - smoothstep(0.78, 1.0, k));
    hot = (1.0 - smoothstep(0.14 + aE.x, 0.42 + aE.x, k)) * 0.8;
  } else {
    // Protuberanz reißt ab: Bogen wächst und verdrillt sich; jeder Faden schnürt sich nahe dem Scheitel ein und reißt zu
    // eigenem Zeitpunkt an eigener Stelle (ausgefranst statt eines glatten Schnitts), die Rissenden glühen kurz weiß auf.
    // uTear (Zahnrad „Ablösen“): 0 klassisch · 1 Plasmoid steigt auf · 2 Peitsche mit Lichtblitz · 3 Zerfasern im Sonnenwind ·
    // 4 Mischung (Kern der Fäden wird Plasmoid, die äußeren zerfasern)
    th = hash(aT.z * 91.7);
    float V = uTear > 3.5 ? (th < 0.55 ? 1.0 : 3.0) : uTear, k0 = V > 0.5 ? 0.5 : 0.58, sp = V > 2.5 ? 0.14 : 0.07;
    float pre = V > 0.5 ? smoothstep(k0 - 0.14, k0, k) * (1.0 - smoothstep(k0, k0 + 0.1, k)) : 0.0;   // Hals dehnt sich, glüht
    gH = aL.x * mix(0.25, V > 0.5 ? 0.68 : 1.0, smoothstep(0.0, k0 + 0.04, k)) * (1.0 + 0.12 * pre);   // Varianten: Bogen bleibt im Bild
    gTwist += 1.2 * smoothstep(0.2, k0 + 0.04, k) + (V > 0.5 && V < 1.5 ? 1.5 * smoothstep(k0, 1.0, k) : 0.0);
    gRope *= 1.0 + 0.8 * smoothstep(0.3, k0 + 0.04, k);
    tc = 0.5 + 0.12 * (hash(aT.z * 57.3 + 3.1) - 0.5);
    tk = smoothstep(0.0, 1.0, (k - k0 - sp * th) / (V > 1.5 && V < 2.5 ? 0.22 : 0.36));
    tg = (V > 0.5 ? 0.2 : 0.3) * tk;
    te = abs(sl - tc) - tg;
    float neck = smoothstep(k0 - 0.08, k0 + 0.02, k - sp * th);
    cut = te < 0.0 ? 1.0 : 0.0;
    float kc = V < 0.5 ? clamp((k - 0.6) / 0.4, 0.0, 1.0) : clamp((k - k0 - 0.02) / (0.98 - k0), 0.0, 1.0);
    lift = V < 0.5 ? cut * pow(kc, 1.4) * 1.1 * (0.95 + 0.1 * th)
      : V < 1.5 ? cut * (0.04 * kc + 0.42 * kc * kc * kc)                                                   // langsam lösen, dann beschleunigen
      : V < 2.5 ? cut * (0.13 * (1.0 - exp(-kc * 6.0)) + 0.05 * sin(kc * 14.0) * exp(-kc * 4.0) + 0.1 * kc * kc)   // schnellt hoch, federt nach
      : cut * (0.15 + 0.3 * th) * kc * kc;                                                          // je Faden eigenes Tempo
    tf = mix(1.0, smoothstep(0.0, 0.06, abs(te)), neck);
    hot = V > 1.5 && V < 2.5 ? 2.2 * exp(-abs(te) / 0.08) * neck * exp(-tk * 2.5) : 0.9 * exp(-abs(te) / 0.05) * neck * (1.0 - tk) * (1.0 - tk);
    hot += 0.5 * pre * exp(-abs(sl - tc) / 0.08);
    if (V > 1.5 && V < 2.5) I *= 1.0 + 2.5 * exp(-min(sl, 1.0 - sl) / 0.05) * smoothstep(0.0, 0.15, tk) * exp(-2.0 * tk);   // Fußpunkte leuchten auf
    float fade = V < 0.5 ? 0.7 * cut * smoothstep(0.65, 0.95, k) : V < 1.5 ? 0.85 * cut * smoothstep(0.84, 1.0, k)
      : V < 2.5 ? 0.8 * cut * smoothstep(0.72, 0.98, k) : cut * smoothstep(0.45, 0.95, kc + 0.25 * th);
    life = smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(V < 0.5 ? 0.85 : 0.9, 1.0, k)) * (1.0 - fade);
  }
  gN = cross(gB - gA, gA + gB);
  gN /= max(length(gN), 1e-6);
  vec3 T, p = threadAt(sl, T);
  float w = aL.w * mix(0.25, 1.0, tf);   // Rissenden laufen spitz aus
  if (u > 0.0) {
    // Wurzel: vom Fußpunkt des Fadens flach über die Oberfläche hinaus, je Faden eigener Winkel im Fächer (Strudel: spiralig)
    vec3 F = sl < 0.5 ? gA : gB, O = sl < 0.5 ? gB : gA, D = F - O;
    D = normalize(D - F * dot(D, F) + 1e-5 * gN);
    float a = aF.z * 1.25 + (uFoot > 2.5 ? (1.6 + 1.4 * aF.w) * u * sign(aF.z + 1e-3) + uTime * 0.12 * sign(aF.z + 1e-3) : 0.0);
    vec3 Dr = D * cos(a) + cross(F, D) * sin(a);
    float L = (0.006 + 0.7 * length(gA - gB)) * (0.55 + 0.6 * aF.w);
    vec3 q = p + Dr * L * u + cross(F, Dr) * L * 0.2 * aF.z * sin(PI * u);
    vec3 q2 = p + Dr * L * (u + 0.02) + cross(F, Dr) * L * 0.2 * aF.z * sin(PI * (u + 0.02));
    float hr = mix(length(p) - 1.0, 0.0011, smoothstep(0.0, 0.25, u));
    p = normalize(q) * (1.0 + hr);
    T = normalize(normalize(q2) * (1.0 + hr) - p);
    w *= 1.0 - 0.55 * u;
  }
  vec3 R = normalize(gA + gB);
  if (uMode > 2.5 && tk > 0.0 && u <= 0.0) {
    if (cut > 0.5) {
      // Oberteil (gemeinsamer Fortschritt kc, damit es ein Bündel bleibt): weitet sich um den Scheitel, die losen Enden biegen
      // sich nach oben und innen (Flussseil schließt sich); nur die Rissenden fransen je Faden aus
      float V = uTear > 3.5 ? (th < 0.55 ? 1.0 : 3.0) : uTear, kc = V < 0.5 ? clamp((k - 0.6) / 0.4, 0.0, 1.0) : clamp((k - 0.52) / 0.46, 0.0, 1.0), q = pow(min(abs(sl - 0.5) / 0.3, 1.0), 2.0);
      vec3 ap = axisAt(0.5), lat = p - ap;
      lat -= R * dot(lat, R);
      vec4 m = V < 0.5 ? vec4(0.6, 0.25, 0.35, 0.12) : V < 1.5 ? vec4(0.35, 0.6, 0.45, 0.1) : V < 2.5 ? vec4(0.25, 0.2, 0.3 + 0.5 * sin(kc * 10.0) * exp(-kc * 3.0), 0.2)
        : vec4(0.3, 0.1, 0.4 + 0.9 * th, 0.35);   // Weiten, Einrollen der Enden, Hub der Enden, Ausfransen
      p += (p - ap) * m.x * kc - lat * q * m.y * kc + R * q * aL.x * m.z * kc;
      p += (gN * (th - 0.5) + R * (hash(aT.z * 23.9) - 0.5)) * q * aL.x * m.w * tk;
    } else {
      // Beine: das freie Ende schnellt zur Oberfläche zurück, biegt nach außen und schwingt gedämpft aus
      float sn = exp(-te / 0.22) * smoothstep(0.0, 0.35, tk);
      vec3 D = normalize((sl < tc ? gA - gB : gB - gA) + 1e-5 * gN);
      p -= normalize(p) * (length(p) - 1.0) * 0.6 * sn;
      float V = uTear > 3.5 ? (th < 0.55 ? 1.0 : 3.0) : uTear, wa = V > 1.5 && V < 2.5 ? 0.5 : V > 0.5 ? 0.15 : 0.25, wd = V > 1.5 && V < 2.5 ? 2.0 : 3.0;   // Ausschwingen der Beine
      p += D * aL.x * sn * (0.12 + wa * sin(tk * 16.0 + th * 6.0) * exp(-wd * tk));
    }
  }
  p += R * lift;
  vH = length(p) - 1.0;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vec4 pv = viewMatrix * wp;
  vec3 tv = mat3(viewMatrix) * (mat3(modelMatrix) * T);
  vec3 sd = cross(tv, pv.xyz);
  sd /= max(length(sd), 1e-9);
  // Band = 1,7 × Röhrenradius (Röhre + Leuchthof); Röhre mindestens ≈ 0,7 Pixel, sonst dunkler statt dünner. Nah vor der
  // Kamera (< 0,18 R☉) blenden die Fäden aus, damit kein unscharfes Band durchs Bild zieht.
  float px = uPx * max(-pv.z, 1e-4), cw = max(w, px * 0.7);
  pv.xyz += sd * side * cw * 1.7;
  vS = s; vX = side; vSeed = aT.z; vFlow = aS.w; vHot = hot; vCut = cut; vW = wp.xyz; vRes = w / px; vU = u; vCyc = cyc;
  vI = I * life * tf * (1.0 + 3.0 * hot) * w / cw * smoothstep(0.05, 0.18, -pv.z) * (u > 0.0 && (uFoot < 0.5 || (uFoot > 1.5 && uFoot < 2.5)) ? 0.0 : 1.0);
  gl_Position = projectionMatrix * pv;
}
`;

// Leuchten je Faden: Plasmaröhre (Helligkeit ∝ Weglänge durch den Querschnitt) mit feinen Längsstreifen, sobald sie ein
// paar Pixel breit ist, weicher Hof darum; Plasmaknoten strömen entlang des Fadens (Siphon-Strömung, je Faden eigene
// Richtung), Beine heller als der Scheitel. Fuß je uFoot: Kante blendet aus · Fibrillen/Strudel gehen ohne Kante in die
// Wurzeln über (Knoten laufen dort zum Fußpunkt, Farbe wie die Glut der Oberfläche) · Kelch glüht unten breit und weich.
// Ruhige Bögen atmen langsam (12–45 s) und sind vor der Scheibe schwächer (uDisk; dort leuchtet die Oberfläche selbst).
// Farben linear vor ACES: tiefrot → orange → gelbweiß im heißen Kern; uPal 1 = 304 Å (röter); vHot = frische
// Flare-Schleife (weißglühend, kühlt ab); vCyc = Phase im Zyklus „Werden und Vergehen“ (am Ende regnet Plasma ab).
export const STRAND_FRAG = /* glsl */ `
${NOISE}
uniform float uTime, uGain, uPal, uMode, uK, uFoot, uDisk;
uniform vec3 uMove;
varying float vS, vX, vH, vI, vFlow, vSeed, vCut, vHot, vRes, vU, vCyc;
varying vec3 vW;
vec3 ramp(float x) {
  vec3 lo = uPal < 0.5 ? vec3(1.1, 0.15, 0.012) : vec3(1.1, 0.09, 0.008);
  vec3 mid = uPal < 0.5 ? vec3(2.4, 0.8, 0.12) : vec3(2.2, 0.5, 0.07);
  vec3 c = mix(lo, mid, smoothstep(0.1, 1.0, x));
  c = mix(c, vec3(3.4, 2.4, 1.3), smoothstep(1.0, 3.0, x) * (uPal < 0.5 ? 1.0 : 0.6));
  return mix(c, vec3(3.0, 2.7, 2.3), vHot);
}
void main() {
  if (vCut > 0.02 && vCut < 0.98) discard;
  if (vI <= 0.0) discard;
  float x = vX, t = uTime, sp = 0.7 + 1.6 * uMove.x;
  float xr = x * 1.7, tube = sqrt(max(1.0 - xr * xr, 0.0));
  float prof = tube + 0.2 * exp(-xr * xr * 1.3) * (1.0 - x * x);
  if (vU > 0.0) {
    // Wurzel: Plasma läuft auf der Oberfläche zum Fußpunkt (Knoten wandern zu u = 0), wird dorthin dichter und heller
    float kn = smoothstep(-0.35, 0.6, gnoise(vec3(vU * 7.0 + t * 0.25 * sp, vSeed * 37.0, vSeed * 11.0)));
    float I = vI * prof * pow(max(1.0 - vU, 0.0), 1.6) * (0.35 + 0.9 * kn) * 1.3;   // max: Spitze interpoliert knapp über 1 → NaN
    gl_FragColor = vec4(ramp(I * 0.8) * I * uGain, 1.0);
    return;
  }
  float str = 0.55 + 0.45 * gnoise(vec3(xr * 3.5 + vSeed * 9.0, vS * 4.5 - t * vFlow * 0.2 * sp, vSeed * 23.0));
  prof = tube * mix(1.0, str, smoothstep(2.0, 6.0, vRes)) + 0.2 * exp(-xr * xr * 1.3) * (1.0 - x * x);
  float knots = smoothstep(-0.45, 0.55, gnoise(vec3(vS * 6.5 - t * vFlow * 0.65 * sp, vSeed * 37.0, vSeed * 11.0)));
  float fine = 0.6 + 0.4 * gnoise(vec3(vS * 46.0 + vSeed * 5.0, vSeed * 91.0, t * 0.07));
  float df = min(vS, 1.0 - vS);
  float foot = 1.0 + 1.3 * pow(abs(2.0 * vS - 1.0), 6.0);
  float base = uFoot < 0.5 ? smoothstep(0.0, 0.0055, vH) : smoothstep(-0.0015, 0.0012, vH);
  if (uFoot > 1.5 && uFoot < 2.5) { foot += 2.2 * exp(-df / 0.06); prof = mix(prof, 0.55 * exp(-xr * xr * 1.6), exp(-df / 0.08)); }
  float I = vI * prof * (0.4 + 0.75 * knots) * fine * foot * base;
  if (uFoot > 2.5) {
    // Strudel: helle Tropfen lösen sich aus dem Fuß und steigen die Beine hinauf
    float blob = smoothstep(0.45, 0.85, gnoise(vec3(df * 16.0 - t * 0.9 * sp, vSeed * 13.0, vSeed * 3.0)));
    I += vI * prof * base * blob * 2.2 * exp(-df * 3.0);
  }
  if (uMode < 0.5) {
    I *= 0.4 + 0.6 * smoothstep(0.1, 0.9, 0.5 + 0.5 * sin(t * (0.14 + 0.36 * fract(vSeed * 3.7)) * (1.0 + uMove.x) + vSeed * 40.0));
    if (vCyc > 0.7) {
      // leerlaufender Bogen: Material regnet die Beine hinab
      float rain = smoothstep(0.5, 0.8, gnoise(vec3(df * 20.0 + t * 0.9, vSeed * 13.0, vSeed * 5.0)));
      I = I * 0.6 + vI * prof * rain * 0.9 * base * smoothstep(0.7, 0.8, vCyc);
    }
    vec3 rd = normalize(vW - cameraPosition);
    float tb = -dot(cameraPosition, rd), b2 = dot(cameraPosition, cameraPosition) - tb * tb;
    if (tb > 0.0 && b2 < 1.0) I *= uDisk;
  } else if (uMode > 2.5) {
    // zurückregnendes Material: helle Tropfen laufen nach dem Aufreißen die Beine hinab
    float ds = abs(vS - 0.5);
    float rain = smoothstep(0.38, 0.62, gnoise(vec3(ds * 16.0 - t * 0.8, vSeed * 13.0, vSeed * 5.0))) * smoothstep(0.6, 0.72, uK) * (1.0 - vCut);
    I += vI * prof * rain * 1.2 * base;
  }
  gl_FragColor = vec4(ramp(I) * I * uGain, 1.0);
}
`;

// Bänder aller Fäden: je Faden (segs + 1 + 2 · ROOT) × 2 Ecken – Bogen s 0 … 1, davor und danach je ROOT Stücke Wurzel (s < 0,
// s > 1) –, Dreiecksstreifen als Index. 'position' = Fußpunkt a (nur für three.js). aF: Zyklus „Werden und Vergehen“ (Dauer,
// Phase; 0 = aus dem seed) und je Faden Winkel im Wurzel-Fächer (−1 … 1) und Wurzellänge (0 … 1).
const ROOT = 8;
export function strandGeometry(loops, rand, segs = 40) {
  const per = segs + 1 + 2 * ROOT, nT = loops.reduce((n, L) => n + L.threads, 0), nv = nT * per * 2;
  const A = new Float32Array(nv * 3), B = new Float32Array(nv * 3), E = new Float32Array(nv * 3);
  const Lb = new Float32Array(nv * 4), T = new Float32Array(nv * 4), S = new Float32Array(nv * 4), F = new Float32Array(nv * 4);
  const idx = new Uint32Array(nT * (per - 1) * 6);
  let v = 0, ii = 0;
  for (const L of loops) {
    for (let j = 0; j < L.threads; j++) {
      // Fäden im Querschnitt verteilt (gleichmäßig in der Fläche), je eigene Breite, Helligkeit und Strömung
      const phi = rand() * Math.PI * 2, rho = Math.sqrt(rand()), w = L.width * (0.7 + 0.6 * rand());
      const I = L.I * (0.55 + 0.7 * rand()), seed = rand(), flow = L.flow * (0.7 + 0.6 * rand());
      const fan = rand() * 2 - 1, rl = rand();
      const v0 = v;
      for (let i = -ROOT; i <= segs + ROOT; i++) {
        const s = i < 0 ? i / ROOT : i > segs ? 1 + (i - segs) / ROOT : i / segs;
        for (const side of [-1, 1]) {
          A.set([L.a.x, L.a.y, L.a.z], v * 3); B.set([L.b.x, L.b.y, L.b.z], v * 3); E.set([L.delay || 0, L.seed, L.flat || 0], v * 3);
          Lb.set([L.h, L.lean, L.rope, w], v * 4); T.set([phi, rho, seed, I], v * 4); S.set([s, side, L.twist, flow], v * 4);
          F.set([L.life || 0, L.phase || 0, fan, rl], v * 4);
          v++;
        }
      }
      for (let i = 0; i < per - 1; i++) {
        const o = v0 + i * 2;
        idx.set([o, o + 2, o + 1, o + 1, o + 2, o + 3], ii);   // gegen den Uhrzeigersinn: Seite = Tangente × Sehstrahl
        ii += 6;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(A, 3));
  for (const [k, a, n] of [['aA', A, 3], ['aB', B, 3], ['aE', E, 3], ['aL', Lb, 4], ['aT', T, 4], ['aS', S, 4], ['aF', F, 4]]) g.setAttribute(k, new THREE.BufferAttribute(a, n));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// Bogenfeld über die ganze Sonne (kind 1 feiner Kranz wie SDO 171 Å, 2 gestaffelt, 3 Nester): Höhe nach Potenzgesetz
// zwischen hMin und hMax (viele kleine, einige mittlere, wenige große), Fußabstand ≈ Höhe, Ebene meist Ost–West (Hale)
// mit Streuung; 65 % in den Aktivitätsgürteln (5–35° Breite), der Rest überall (ruhige Sonne, Netzwerk-Bögen). Nester:
// drei Viertel der Bögen in Gruppen um wenige Zentren, innen klein, außen größer. Je Bogen eigener Zyklus (life, phase).
const FIELD = [null, { n: 1300, hMin: 0.005, hMax: 0.1, k: 2.2 }, { n: 520, hMin: 0.006, hMax: 0.26, k: 3.0 }, { n: 560, hMin: 0.005, hMax: 0.16, k: 2.2, nests: 28 }];
export function loopField(kind, rand, thr = 2) {
  const P = FIELD[kind], Y = new THREE.Vector3(0, 1, 0), out = [];
  const at = (lat, lon) => new THREE.Vector3(-Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat));
  const belt = () => at((5 + 30 * rand()) * (Math.PI / 180) * (rand() < 0.5 ? 1 : -1), rand() * Math.PI * 2);
  const any = () => at(Math.asin(rand() * 2 - 1), rand() * Math.PI * 2);
  const nests = P.nests ? Array.from({ length: P.nests }, belt) : null;
  for (let i = 0; i < P.n; i++) {
    let c, x = Math.pow(rand(), P.k);
    if (nests && i < P.n * 0.75) {
      const m = nests[i % nests.length], t = new THREE.Vector3().crossVectors(m, any()).normalize();
      c = m.clone().addScaledVector(t, (0.004 + 0.05 * rand()) * (0.4 + x)).normalize();
    } else c = rand() < 0.65 ? belt() : any();
    const h = P.hMin * Math.pow(P.hMax / P.hMin, x), half = h / (0.75 + 0.6 * rand());
    const e = new THREE.Vector3().crossVectors(Y, c).normalize().applyAxisAngle(c, (rand() - 0.5) * 1.4);
    out.push({
      a: c.clone().addScaledVector(e, half).normalize(), b: c.clone().addScaledVector(e, -half).normalize(),
      h, lean: (rand() - 0.5) * 0.6, rope: 0.0012 + h * 0.035, width: 0.0006 + 0.001 * rand() + h * 0.006,
      threads: h > 0.05 ? 1 + thr : rand() < 0.2 * thr ? 2 : 1, I: (0.8 + 2.2 * rand() ** 2) * (0.9 + 4 * h),
      twist: (rand() - 0.5) * 0.8, flow: (rand() < 0.5 ? -1 : 1) * (0.25 + 0.45 * rand()), flat: 0, delay: 0, seed: rand(),
      life: 18 + 42 * rand(), phase: rand(),
    });
  }
  return out;
}

// Bögen einer aktiven Region zwischen den Polaritäten a, b (wie coronalLoopsGeometry in sunfx.js): innen kurze, flache
// Bögen, außen ein Fächer bis ≈ 2-fach so weit; Ebenen leicht geschert (verdrilltes Feld). Je Bogen eine Röhre (≈ 2–5 Mm),
// wenige helle und viele schwache. o.size streckt die Höhe, o.I die Helligkeit, o.threads (Qualität) = Anteil doppelter Röhren.
export function arcadeLoops(a, b, n, rand, o = {}) {
  const mid = a.clone().add(b).normalize(), e1 = a.clone().sub(b);
  e1.addScaledVector(mid, -e1.dot(mid));
  const half = e1.length() / 2;
  e1.normalize();
  const e2 = new THREE.Vector3().crossVectors(mid, e1), out = [];
  for (let k = 0; k < n; k++) {
    const s = 0.35 + 1.6 * Math.pow(rand(), 1.5), w = half * s;
    const off = (rand() - 0.5) * half * (0.8 + s), shear = (rand() - 0.5) * half * 0.9;
    out.push({
      a: mid.clone().addScaledVector(e1, w).addScaledVector(e2, off + shear).normalize(),
      b: mid.clone().addScaledVector(e1, -w).addScaledVector(e2, off - shear).normalize(),
      h: w * (0.75 + 0.6 * rand()) * (o.size ?? 1), lean: (rand() - 0.5) * 0.5, rope: 0.003 + w * 0.02,
      width: 0.0016 + 0.0018 * rand(), threads: rand() < 0.15 * (o.threads ?? 2) ? 2 : 1, I: (o.I ?? 1) * (0.25 + 1.1 * rand() ** 2),
      twist: (rand() - 0.5) * 0.8, flow: (rand() < 0.5 ? -1 : 1) * (0.25 + 0.4 * rand()), flat: 0, delay: 0, seed: rand(),
    });
  }
  return out;
}

// Protuberanzen an den Orten von loopsGeometry (sunfx.js, meta: dir, apex) – damit Abzeichen und Kanalbilder dieselben
// Stellen zeigen: verdrillte Bögen aus vielen Fäden, als Vorhang etwas breiter als tief.
export function prominenceLoops(meta, rand, threads) {
  return meta.map((m) => {
    const n = m.dir.clone().normalize(), h = (m.apex.length() - 1) / 0.9, d = h * (0.55 + 0.4 * rand());
    const t = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0.3, 1, 0.2).normalize()).normalize().applyAxisAngle(n, rand() * Math.PI * 2);
    return { a: n.clone().addScaledVector(t, d).normalize(), b: n.clone().addScaledVector(t, -d).normalize(), h, lean: (rand() - 0.5) * 0.6,
      rope: 0.006 + h * 0.06, width: 0.0022 + 0.0014 * rand(), threads, I: 0.7 + 0.5 * rand(), twist: 0.6 + rand() * 1.2,
      flow: (rand() < 0.5 ? -1 : 1) * (0.2 + 0.3 * rand()), flat: 0.5 + 0.4 * rand(), delay: 0, seed: m.seed };
  });
}

// Flare-Arkade (uMode 2): n Bögen entlang der Bänder; a.x = Lage u entlang der Neutrallinie, h = Höhe je Bandabstand,
// delay = späterer Einsatz außen (die Arkade wächst von der Mitte aus).
export function flareArcade(n, rand) {
  return Array.from({ length: n }, (_, i) => {
    const u = (i / (n - 1) - 0.5) * 0.16 + (rand() - 0.5) * 0.006, a = new THREE.Vector3(u, 0, 0);
    return { a, b: a, h: 0.8 + 0.9 * rand(), lean: (rand() - 0.5) * 0.4, rope: 0.002, width: 0.001 + 0.0008 * rand(), threads: 1 + (rand() < 0.4 ? 1 : 0),
      I: (0.5 + 0.9 * rand()) * (1.1 - Math.abs(u) / 0.1), twist: 0.15, flow: (rand() < 0.5 ? -1 : 1) * 0.5, flat: 0, delay: Math.abs(u) / 0.08 * 0.12, seed: rand() };
  });
}

// Ausbruch am Rand (uMode 1 Filament, 3 Protuberanz): ein Bündel zwischen foot ± span · tan (tan = waagerecht im Bild)
export function eruptLoop(mode, foot, tan, rand, threads) {
  const span = mode === 1 ? 0.1 : 0.15;
  return [{ a: foot.clone().addScaledVector(tan, span).normalize(), b: foot.clone().addScaledVector(tan, -span).normalize(),
    h: mode === 1 ? 0.045 : 0.34, lean: mode === 1 ? 0.2 : 0.1, rope: mode === 1 ? 0.011 : 0.028, width: mode === 1 ? 0.0028 : 0.0034, threads,
    I: mode === 1 ? 1.6 : 1.3, twist: mode === 1 ? 1.8 : 0.7, flow: 0.5, flat: mode === 1 ? 0.25 : 0.65, delay: 0, seed: rand() }];
}
