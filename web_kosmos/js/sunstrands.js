// Plasmafäden der Sonne für den Look „Glut“ und 304 Å der Station Sonne (sunlook.js, levels/sun.js): Magnetbögen als Bündel
// feiner Fäden im Raum statt als Linien auf einer Bildtafel – Bögen der aktiven Regionen zwischen Vorläufer- und
// Nachfolgerfleck, weitere Arkaden (Rand „Bogen-Arkaden“), Protuberanzen als verdrillte Fadenbündel und die Ausbrüche
// (Modus 1 Filament steigt als Ω-Bogen auf, 2 Flare-Arkade über den Bändern, 3 Protuberanz schnürt sich ab: oben steigt ein
// Plasmoid auf, unten bleibt ein neuer Bogen – ohne Schnittkante, siehe place()). Jeder Faden ist ein
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
// sunlook.js) · 3 Protuberanz schnürt sich ab (uTear Art des Ablösens); uK = Fortschritt des Ausbruchs 0 … 1, uPx = Pixelgröße
// bei Abstand 1, uDens = Anteil der ruhigen Bögen (nach Bogen-seed, Zahnrad „Dichte“), uBurst Anteil der ruhigen Bögen, die
// je Zyklus platzen (× 38 %), uSpray Hub ihrer Plasmoide.

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
attribute vec3 aA, aB;
attribute vec4 aE, aL, aT, aS, aF;
uniform float uTime, uPx, uMode, uK, uDens, uFoot, uLifeR, uScale, uTear, uBurst, uSpray;
uniform vec3 uMove, uFS, uFE1, uFE2;
varying float vS, vX, vH, vI, vFlow, vSeed, vCut, vHot, vRes, vU, vCyc, vSh, vLen;
varying vec3 vW;
const float PI = 3.14159265;
vec3 gA, gB, gN, gE, gR;
float gH, gLean, gRope, gTwist, gSway, gBul = 0.0;
// Abschnüren (Modus 0 Platzen, 3 Abriss): gG halbe Länge des Oberteils in s (Hals bei s = 0,5 ± gG), gPin Einschnürung 0 … 1,
// gSep Trennung nach der Rekonnexion 0 … 1, gUp Hub, gEx Aufweiten und gCurl Runden des Plasmoids, gRel Übergang des
// Unterteils in einen neuen Bogen (Höhe des Halses × (1 − gDn)), gWob Ausschwingen, gFray Auffächern je Faden in Richtung gFc
// (Anteile gN, gE, gR)
float gG = 0.25, gPin = 0.0, gSep = 0.0, gUp = 0.0, gEx = 0.0, gCurl = 0.0, gRel = 0.0, gDn = 0.0, gWob = 0.0, gFray = 0.0;
vec3 gFc = vec3(0.0);
float hash(float n) { return fract(sin(n) * 43758.5453); }
// Mittellinie mit Scheitelhöhe h: Fußpunkte wandern mit (1 − cos)/2 → Beine an den Füßen senkrecht, Scheitel rund; gBul bläht
// den oberen Teil seitlich auf (Ω-Form des aufsteigenden Flussseils)
vec3 axisH(float s, float h) {
  vec3 m = normalize(mix(gA, gB, 0.5 - 0.5 * cos(PI * s)));
  float sn = sin(PI * s), lift = h * sn;
  return m * (1.0 + lift) + gN * gLean * lift + gE * gBul * h * sin(2.0 * PI * s) * sn * sn;
}
vec3 axisAt(float s) { return axisH(s, gH); }
// Faden im Bündel relativ zur Mittellinie: Querschnitt (aT.x Winkel, aT.y Radius), Verdrillung, Verjüngung (Kelch: unten
// weit), Knickwelle
vec3 offAt(float s) {
  vec3 T = normalize(axisAt(min(s + 0.004, 1.0)) - axisAt(max(s - 0.004, 0.0)));
  vec3 N2 = normalize(cross(T, gN)), N1 = cross(N2, T);
  float ang = aT.x + gTwist * 6.2831853 * s + uTime * 0.03 * sign(gTwist);
  float kel = uFoot > 1.5 && uFoot < 2.5 ? 3.5 * exp(-min(s, 1.0 - s) / 0.07) : 0.0;
  float taper = 0.3 + 0.7 * sin(PI * s) + kel;
  vec3 sw = N1 * gSway * sin(PI * s) * sin(6.2831853 * (0.65 * s - uTime * 0.06) + aE.y * 30.0);
  return sw + (N1 * cos(ang) * (1.0 + 2.5 * aE.z) + N2 * sin(ang) * (1.0 - 0.5 * aE.z)) * aT.y * gRope * taper;
}
// Unterteil und Oberteil teilen die Ecken des Fadens am Hals (s = 0,5 ± gG) unter sich auf: der neue Bogen läuft über
// s < 0,5 − gG bzw. > 0,5 + gG (sp 0 … 0,5 bzw. 0,5 … 1), das Plasmoid über das Stück dazwischen (su). Beide erreichen ihr
// Ende eine Ecke (aE.w) vor dem Hals und halten dort an – so liegt je Faden eine Ecke genau im Scheitel des neuen Bogens
// und eine genau am Hals des Plasmoids, die Beine treffen sich ohne Lücke. gFree = 1 rechnet über das Ende hinaus weiter
// (nur für die Richtung der Nachbarn).
float gFree = 0.0;
float lowS(float s) {
  float t = (s < 0.5 ? s : 1.0 - s) / (0.5 - gG - aE.w);
  t = gFree > 0.5 ? t : min(t, 1.0);
  return s < 0.5 ? 0.5 * t : 1.0 - 0.5 * t;
}
float upS(float s) {
  float t = abs(s - 0.5) * gG / max(gG - aE.w, 1e-3);
  return 0.5 + sign(s - 0.5) * (gFree > 0.5 ? t : min(t, gG));
}
// Mittellinie + Faden mit Einschnürung am Hals: Beine laufen zur Symmetrieachse zusammen, die Fäden beider Beine legen
// sich dort spiegelgleich übereinander (gleiche Lage bei s und 1 − s → am Hals keine Stufe)
vec3 pinchOff(float s, float nk) { return mix(offAt(s), 0.5 * (offAt(s) + offAt(1.0 - s)), nk) * (1.0 - 0.6 * nk); }
vec3 pinched(float s) {
  vec3 c = axisAt(s);
  float d = gG - abs(s - 0.5), nk = gPin * exp(-d * d / 0.008);
  return mix(c, 0.5 * (c + axisAt(1.0 - s)), nk) + pinchOff(s, nk);
}
// Ort des Fadens bei s. Abschnüren wie im Standardmodell eines Flares: die Beine laufen am Hals zusammen, die Rekonnexion
// verbindet sie dort neu – oben ein geschlossenes Plasmoid (rundet sich, weitet sich, steigt, fasert je nach Art auf), unten
// ein neuer Bogen mit der Spitze am Hals (sinkt, rundet sich, schwingt aus). lo Unterteil, up Oberteil, W = 0 Unterteil |
// 1 Oberteil; das einzige Stück dazwischen (Spitze → Plasmoid, die Stromschicht) blendet STRAND_FRAG je Pixel weich aus –
// kein Faden endet an einer Kante, kein Stück fliegt lose.
void place(float s, out vec3 lo, out vec3 up, out float W) {
  W = 0.0;
  if (gPin <= 0.0) { lo = up = axisAt(s) + offAt(s); return; }
  lo = up = pinched(s);
  if (gSep <= 0.0) return;
  W = step(0.0, gG - abs(s - 0.5));
  float su = mix(s, upS(s), smoothstep(0.0, 0.05, gSep)), du = gG - abs(su - 0.5), nk = gPin * exp(-du * du / 0.008);
  vec3 cu = axisAt(su), pc = mix(cu, 0.5 * (cu + axisAt(1.0 - su)), nk), po = pinchOff(su, nk);
  // Runden: gleichmäßig verteilt auf einen Ring in der Bogenebene (unten am Hals beginnend, über den Scheitel zurück)
  vec3 X = 0.5 * (axisAt(0.5 - gG) + axisAt(0.5 + gG)), top = axisAt(0.5), ctr = mix(X, top, 0.5), v = pc - ctr;
  float ang = PI * (su - 0.5 + gG) / gG, r0 = 0.45 * (length(top - X) + 0.5 * length(axisAt(0.5 - gG) - axisAt(0.5 + gG)));
  v = mix(v, (normalize(X - ctr + 1e-6 * gR) * cos(ang) + gE * sin(ang)) * r0, gCurl);
  up = ctr + v * (1.0 + gEx) + po * (1.0 + 0.5 * gEx) + gR * gUp + (gN * gFc.x + gE * gFc.y + gR * gFc.z) * gFray * smoothstep(0.0, gG, du);
  float sp = lowS(s), sn = sin(PI * sp);
  lo = mix(lo, axisH(sp, gH * sin(PI * (0.5 - gG)) * (1.0 - gDn)) + offAt(sp) * (1.0 - 0.5 * sn), gRel) + (gR * 0.7 + gE * 0.5) * gWob * sn;
}
void main() {
  if (uMode < 0.5 && aE.y > uDens) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // ausgedünnt: ganzer Faden außerhalb
  float s = aS.x, side = aS.y, k = clamp(uK, 0.0, 1.0);
  float u = s < 0.0 ? -s : max(s - 1.0, 0.0), sl = clamp(s, 0.0, 1.0);
  float I = aT.w, hot = 0.0, life = 1.0, cyc = -1.0, flash = 0.0, fade = 1.0, th = hash(aT.z * 91.7);
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
      // Platzen (Pinch): je Zyklus schnürt sich ein Teil der Bögen ab (Zahnrad „Taktung“: Anteil 38 % × uBurst) – Hals,
      // weiches Aufleuchten der Rekonnexion, oben löst sich ein kleines Plasmoid (steigt, weitet sich, verblasst; uSpray),
      // unten sinkt der Bogen und rundet sich
      if (cyc > 0.46 && hash(floor(cn) * 17.3 + aE.y * 43.1) > 1.0 - clamp(0.38 * uBurst, 0.0, 0.95)) {
        float st = 0.02 * (th - 0.5), e = clamp((cyc - 0.64 - st) / 0.3, 0.0, 1.0);
        gG = 0.15 + 0.04 * (hash(aT.z * 57.3) - 0.5);
        gPin = smoothstep(0.46, 0.64, cyc + st);
        gSep = e;
        gUp = aL.x * uSpray * (0.3 * e + 1.3 * e * e);
        gEx = 0.9 * e; gCurl = smoothstep(0.0, 0.45, e); gRel = smoothstep(0.0, 0.6, e); gDn = 0.25;
        flash = 0.55 * exp(-pow((cyc - 0.645 - st) / 0.022, 2.0));
        fade = 1.0 - smoothstep(0.15, 0.85, e);
      }
    }
  } else if (uMode < 1.5) {
    // Filament-Eruption: Aktivierung (Seil hebt sich langsam, hellt auf), dann stetige Beschleunigung ohne Anhalten; das Seil
    // bläht sich zur Ω-Form, weitet und verdrillt sich, die Beine bleiben verankert
    float a = max(k - 0.12, 0.0) / 0.88;
    gH = gH * (1.0 + 0.8 * smoothstep(0.0, 0.15, k)) + 1.4 * pow(a, 2.2);
    gBul = 0.32 * smoothstep(0.08, 0.6, k);
    gLean *= 1.0 + 2.0 * smoothstep(0.1, 0.9, k);
    gRope *= 1.0 + 2.5 * smoothstep(0.1, 0.9, k);
    gTwist += 1.4 * smoothstep(0.05, 0.6, k);
    life = smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.72, 1.0, k));
    I *= (1.0 + 0.5 * exp(-pow((k - 0.16) / 0.07, 2.0))) / (1.0 + 1.4 * a);
  } else if (uMode < 2.5) {
    // Flare-Arkade: Fußpunkte auf den beiden Bändern, die auseinanderwandern; Bögen wachsen mit ihrem Abstand. Frisch
    // verbundene Bögen stehen höher und schrumpfen um ≈ 25 % (Kontraktion nach der Rekonnexion), heiß → kühl
    float sep = 0.012 + 0.05 * smoothstep(0.08, 0.7, k), form = smoothstep(0.1 + aE.x, 0.45 + aE.x, k);
    float uu = aA.x, bend = 0.5 * uu * uu / 0.09;
    gA = normalize(uFS + uFE1 * uu + uFE2 * (bend + sep));
    gB = normalize(uFS + uFE1 * uu + uFE2 * (bend - sep));
    gH = aL.x * sep * (1.3 - 0.3 * form);
    life = smoothstep(0.1 + aE.x, 0.2 + aE.x, k) * (1.0 - smoothstep(0.78, 1.0, k));
    hot = (1.0 - smoothstep(0.14 + aE.x, 0.42 + aE.x, k)) * 0.8;
  } else {
    // Protuberanz reißt ab (Standardmodell CSHKP): der Bogen wächst und verdrillt sich, die Beine schnüren sich unter dem
    // Scheitel ein, bei k ≈ 0,5 verbinden sie sich neu (weiches Aufleuchten am Hals, Fußpunkte leuchten auf); oben steigt ein
    // geschlossenes Plasmoid auf, unten bleibt ein heißer Bogen, der sinkt, sich rundet und abkühlt. Fäden ±0,2 s versetzt.
    // uTear (Zahnrad „Ablösen“): 0 klassisch · 1 Plasmoid (langsam lösen, dann beschleunigen, rundet sich zum Ring) ·
    // 2 Peitsche (schnellt hoch, Bogen schwingt gedämpft nach) · 3 Zerfasern (Fäden fächern auf, je eigenes Tempo) ·
    // 4 Mischung (Kern Plasmoid, außen Zerfasern) · 5 Spray-Schockwelle (schnell, Fäden spritzen im Kegel auseinander)
    float V = uTear > 4.5 ? 5.0 : uTear > 3.5 ? (th < 0.55 ? 1.0 : 3.0) : uTear, st = 0.03 * (th - 0.5);
    float g0 = smoothstep(0.0, 0.5, k), e = clamp((k - 0.5 - st) / 0.5, 0.0, 1.0);
    vec3 h3 = vec3(hash(aT.z * 23.9), hash(aT.z * 71.3), hash(aT.z * 13.1)) - 0.5;
    gH = aL.x * mix(0.25, V > 0.5 ? 0.8 : 1.0, g0 * g0 * (3.0 - 2.0 * g0));
    gTwist += 1.2 * smoothstep(0.15, 0.5, k);
    gRope *= 1.0 + 0.6 * smoothstep(0.2, 0.5, k);
    gG = 0.24 + 0.05 * (hash(aT.z * 57.3) - 0.5);
    gPin = smoothstep(0.32, 0.5, k + st);
    gSep = e;
    flash = 0.7 * exp(-pow((k - 0.505 - st) / 0.03, 2.0));
    gDn = 0.3; gRel = smoothstep(0.0, 0.6, e);
    if (V < 0.5) { gUp = 1.15 * pow(e, 1.5); gEx = 0.6 * e; gCurl = 0.5 * smoothstep(0.0, 0.5, e); fade = 1.0 - smoothstep(0.55, 1.0, e); }
    else if (V < 1.5) { gUp = 0.08 * e + 0.95 * e * e * e; gEx = 0.9 * e; gCurl = smoothstep(0.0, 0.35, e); gTwist += 1.5 * e; fade = 1.0 - smoothstep(0.7, 1.0, e); }
    else if (V < 2.5) {
      gUp = 0.6 * (1.0 - exp(-6.0 * e)) + 0.3 * e * e; gEx = 0.5 * e; gCurl = 0.6 * smoothstep(0.0, 0.3, e); gRel = smoothstep(0.0, 0.25, e); gDn = 0.4;
      gWob = 0.3 * aL.x * sin(e * 16.0) * exp(-3.5 * e) * smoothstep(0.0, 0.04, e); fade = 1.0 - smoothstep(0.45, 1.0, e);
    } else if (V < 3.5) {
      gUp = (0.45 + 0.6 * th) * e * e; gEx = 0.35 * e; gRel = smoothstep(0.0, 0.7, e); gDn = 0.25;
      gFray = (0.6 + 0.8 * th) * e * aL.x; gFc = vec3(1.2 * h3.x, 1.4 * h3.y, 1.0 + 1.6 * (h3.z + 0.5)); fade = 1.0 - smoothstep(0.3 + 0.3 * th, 1.0, e);
    } else {
      gUp = (1.1 + 0.6 * th) * (0.35 * e + 0.65 * e * e); gEx = 0.6 * e; gCurl = 0.3 * smoothstep(0.0, 0.3, e); gRel = smoothstep(0.0, 0.4, e); gDn = 0.35;
      gFray = (1.0 + 0.6 * th) * e * aL.x; gFc = vec3(2.2 * h3.x, 2.6 * h3.y, 0.8 + 1.4 * (h3.z + 0.5)); fade = 1.0 - smoothstep(0.35, 1.0, e);
    }
    gUp *= aL.x / 0.34;
    I *= 1.0 + 1.5 * exp(-min(sl, 1.0 - sl) / 0.05) * exp(-3.0 * e) * smoothstep(0.0, 0.05, e);   // Fußpunkte (Flare-Bänder)
    life = smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.9, 1.0, k));
  }
  gN = cross(gB - gA, gA + gB);
  gN /= max(length(gN), 1e-6);
  gE = normalize(gA - gB + 1e-6 * gN);
  gR = normalize(gA + gB);
  // Ort und Richtung: Bogen und Plasmoid je aus ihrer eigenen Kurve (Nachbarn über das Ende hinaus gerechnet)
  float W, Wx, fl = 1.0 - abs(2.0 * lowS(sl) - 1.0);
  vec3 L0, U0, L1, U1, L2, U2;
  place(sl, L0, U0, W);
  gFree = 1.0;
  place(min(sl + 0.003, 1.0), L1, U1, Wx);
  place(max(sl - 0.003, 0.0), L2, U2, Wx);
  vec3 p = mix(L0, U0, W), T = normalize((W < 0.5 ? L1 - L2 : U1 - U2) + 1e-7 * gR);
  float w = aL.w;
  vSh = 1.0;
  vLen = length(U0 - L0) / aL.w;   // Länge der Stromschicht in Fadenbreiten (für die Blende je Pixel)
  if (gPin > 0.0) {
    // Hals: Fäden laufen schmaler zusammen und glühen vor dem Riss; Rekonnexion leuchtet weich auf (≈ 0,4 s, einmal); danach
    // glimmt die Stromschicht kurz nach (vSh), Spitze des neuen Bogens heiß → kühlt ab, Plasmoid verblasst beim
    // Aufweiten (Dichte sinkt)
    float d = gG - abs(sl - 0.5), nk = gPin * exp(-d * d / 0.008);
    w *= 1.0 - 0.45 * nk;
    vSh = 0.25 * exp(-4.0 * gSep) * (1.0 - smoothstep(0.15, 0.4, gSep));
    hot += (0.35 * gPin * (1.0 - smoothstep(0.0, 0.2, gSep)) + flash) * exp(-abs(d) / 0.035);
    hot += (1.0 - W) * 0.9 * fl * fl * smoothstep(0.0, 0.03, gSep) * exp(-2.5 * gSep) + W * 0.35 * exp(-4.0 * gSep) * smoothstep(0.0, 0.03, gSep);
    I *= mix(1.0, fade / (1.0 + 1.5 * gEx), W);
  }
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
  vS = s; vX = side; vSeed = aT.z; vFlow = aS.w; vHot = hot; vCut = W; vW = wp.xyz; vRes = w / px; vU = u; vCyc = cyc;
  vI = I * life * (1.0 + 3.0 * hot) * w / cw * smoothstep(0.05, 0.18, -pv.z) * (u > 0.0 && (uFoot < 0.5 || (uFoot > 1.5 && uFoot < 2.5)) ? 0.0 : 1.0);
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
varying float vS, vX, vH, vI, vFlow, vSeed, vCut, vHot, vRes, vU, vCyc, vSh, vLen;
varying vec3 vW;
vec3 ramp(float x) {
  vec3 lo = uPal < 0.5 ? vec3(1.1, 0.15, 0.012) : vec3(1.1, 0.09, 0.008);
  vec3 mid = uPal < 0.5 ? vec3(2.4, 0.8, 0.12) : vec3(2.2, 0.5, 0.07);
  vec3 c = mix(lo, mid, smoothstep(0.1, 1.0, x));
  c = mix(c, vec3(3.4, 2.4, 1.3), smoothstep(1.0, 3.0, x) * (uPal < 0.5 ? 1.0 : 0.6));
  return mix(c, vec3(3.0, 2.7, 2.3), min(vHot, 1.0));
}
void main() {
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
  // Stromschicht zwischen Spitze und Plasmoid (vCut 0 … 1 entlang der gestreckten Strecke): je Pixel nach einer Fadenbreite
  // Abstand von Spitze bzw. Plasmoid weich auf vSh – gleich kurz, wie weit das Plasmoid auch schon gestiegen ist
  I *= mix(1.0, vSh, smoothstep(0.0, 1.0, vCut * vLen) * smoothstep(0.0, 1.0, (1.0 - vCut) * vLen));
  gl_FragColor = vec4(ramp(I) * I * uGain, 1.0);
}
`;

// Bänder aller Fäden: je Faden (segs + 1 + 2 · ROOT) × 2 Ecken – Bogen s 0 … 1, davor und danach je ROOT Stücke Wurzel (s < 0,
// s > 1) –, Dreiecksstreifen als Index. 'position' = Fußpunkt a (nur für three.js). aF: Zyklus „Werden und Vergehen“ (Dauer,
// Phase; 0 = aus dem seed) und je Faden Winkel im Wurzel-Fächer (−1 … 1) und Wurzellänge (0 … 1); aE.w = 1 / segs (Abstand der
// Ecken in s, für das Abschnüren).
const ROOT = 8;
export function strandGeometry(loops, rand, segs = 40) {
  const per = segs + 1 + 2 * ROOT, nT = loops.reduce((n, L) => n + L.threads, 0), nv = nT * per * 2;
  const A = new Float32Array(nv * 3), B = new Float32Array(nv * 3), E = new Float32Array(nv * 4);
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
          A.set([L.a.x, L.a.y, L.a.z], v * 3); B.set([L.b.x, L.b.y, L.b.z], v * 3); E.set([L.delay || 0, L.seed, L.flat || 0, 1 / segs], v * 4);
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
  for (const [k, a, n] of [['aA', A, 3], ['aB', B, 3], ['aE', E, 4], ['aL', Lb, 4], ['aT', T, 4], ['aS', S, 4], ['aF', F, 4]]) g.setAttribute(k, new THREE.BufferAttribute(a, n));
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
