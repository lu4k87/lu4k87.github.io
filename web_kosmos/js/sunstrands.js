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
// flareArcade, eruptLoop liefern solche Listen. Material: STRAND_VERT/STRAND_FRAG mit strandUniforms(), additiv, ohne
// Tiefenschreiben; uMode 0 ruhig · 1 Filament-Eruption · 2 Flare-Arkade (Fußpunkte aus uFS, uFE1, uFE2 wie flareDisk in
// sunlook.js) · 3 Protuberanz reißt ab; uK = Fortschritt des Ausbruchs 0 … 1, uPx = Pixelgröße bei Abstand 1, uDens = Anteil
// der ruhigen Bögen (nach Bogen-seed, Zahnrad „Dichte“).

import * as THREE from 'three';
import { NOISE } from './glsl.js';

export const strandUniforms = () => ({
  uTime: { value: 0 }, uPx: { value: 0.001 }, uGain: { value: 1 }, uPal: { value: 0 }, uMode: { value: 0 }, uK: { value: 0 }, uDens: { value: 1 },
  uFS: { value: new THREE.Vector3(0, 0, 1) }, uFE1: { value: new THREE.Vector3(1, 0, 0) }, uFE2: { value: new THREE.Vector3(0, 1, 0) },
});

export const STRAND_VERT = /* glsl */ `
attribute vec3 aA, aB, aE;
attribute vec4 aL, aT, aS;
uniform float uTime, uPx, uMode, uK, uDens;
uniform vec3 uFS, uFE1, uFE2;
varying float vS, vX, vH, vI, vFlow, vSeed, vCut, vHot, vRes;
varying vec3 vW;
const float PI = 3.14159265;
vec3 gA, gB, gN;
float gH, gLean;
// Mittellinie: Fußpunkte wandern mit (1 − cos)/2 → Beine an den Füßen senkrecht, Scheitel rund
vec3 axisAt(float s) {
  vec3 m = normalize(mix(gA, gB, 0.5 - 0.5 * cos(PI * s)));
  float lift = gH * sin(PI * s);
  return m * (1.0 + lift) + gN * gLean * lift;
}
void main() {
  if (uMode < 0.5 && aE.y > uDens) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // ausgedünnt: ganzer Faden außerhalb
  float s = aS.x, side = aS.y, twist = aS.z, k = clamp(uK, 0.0, 1.0);
  float rope = aL.z, I = aT.w, hot = 0.0, cut = 0.0, life = 1.0, lift = 0.0;
  gA = aA; gB = aB; gH = aL.x; gLean = aL.y;
  if (uMode < 0.5) {
    gH *= 1.0 + 0.05 * sin(uTime * 0.21 + aE.y * 40.0);
  } else if (uMode < 1.5) {
    // Filament-Eruption: Aktivierung (Seil hebt sich, hellt auf), dann Beschleunigung; Bündel weitet und verdrillt sich
    float rise = smoothstep(0.12, 0.85, k);
    gH = gH * (1.0 + 0.8 * smoothstep(0.0, 0.15, k)) + 1.3 * rise * rise;
    gLean *= 1.0 + 2.0 * rise;
    rope *= 1.0 + 2.5 * rise;
    twist += 1.4 * smoothstep(0.05, 0.6, k);
    life = smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.72, 1.0, k));
    I *= (1.0 + 0.5 * exp(-pow((k - 0.16) / 0.07, 2.0))) / (1.0 + 1.6 * rise);
  } else if (uMode < 2.5) {
    // Flare-Arkade: Fußpunkte auf den beiden Bändern, die auseinanderwandern; Bögen wachsen mit ihrem Abstand
    float sep = 0.012 + 0.05 * smoothstep(0.08, 0.7, k);
    float u = aA.x, bend = 0.5 * u * u / 0.09;
    gA = normalize(uFS + uFE1 * u + uFE2 * (bend + sep));
    gB = normalize(uFS + uFE1 * u + uFE2 * (bend - sep));
    gH = aL.x * sep;
    life = smoothstep(0.1 + aE.x, 0.2 + aE.x, k) * (1.0 - smoothstep(0.78, 1.0, k));
    hot = (1.0 - smoothstep(0.14 + aE.x, 0.42 + aE.x, k)) * 0.8;
  } else {
    // Protuberanz reißt ab: Bogen wächst und verdrillt sich, öffnet am Scheitel; das Oberteil steigt davon
    gH = aL.x * mix(0.25, 1.0, smoothstep(0.0, 0.62, k));
    twist += 1.2 * smoothstep(0.2, 0.62, k);
    rope *= 1.0 + 0.8 * smoothstep(0.3, 0.62, k);
    float gap = max(k - 0.6, 0.0) * 0.75;
    cut = abs(s - 0.5) < gap ? 1.0 : 0.0;
    lift = cut * pow(max(k - 0.6, 0.0) / 0.4, 1.4) * 1.1;
    life = smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.85, 1.0, k)) * (1.0 - 0.7 * cut * smoothstep(0.65, 0.95, k));
  }
  gN = cross(gB - gA, gA + gB);
  gN /= max(length(gN), 1e-6);
  vec3 c = axisAt(s);
  vec3 T = normalize(axisAt(min(s + 0.004, 1.0)) - axisAt(max(s - 0.004, 0.0)));
  vec3 N2 = normalize(cross(T, gN)), N1 = cross(N2, T);
  float ang = aT.x + twist * 6.2831853 * s + uTime * 0.05 * sign(twist);
  float taper = 0.3 + 0.7 * sin(PI * s);
  vec3 p = c + (N1 * cos(ang) * (1.0 + 2.5 * aE.z) + N2 * sin(ang) * (1.0 - 0.5 * aE.z)) * aT.y * rope * taper;
  p += normalize(gA + gB) * lift;
  vH = length(p) - 1.0;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vec4 pv = viewMatrix * wp;
  vec3 tv = mat3(viewMatrix) * (mat3(modelMatrix) * T);
  vec3 sd = cross(tv, pv.xyz);
  sd /= max(length(sd), 1e-9);
  // Band = 1,7 × Röhrenradius (Röhre + Leuchthof); Röhre mindestens ≈ 0,7 Pixel, sonst dunkler statt dünner. Nah vor der
  // Kamera (< 0,18 R☉) blenden die Fäden aus, damit kein unscharfes Band durchs Bild zieht.
  float px = uPx * max(-pv.z, 1e-4), cw = max(aL.w, px * 0.7);
  pv.xyz += sd * side * cw * 1.7;
  vS = s; vX = side; vSeed = aT.z; vFlow = aS.w; vHot = hot; vCut = cut; vW = wp.xyz; vRes = aL.w / px;
  vI = I * life * aL.w / cw * smoothstep(0.05, 0.18, -pv.z);
  gl_Position = projectionMatrix * pv;
}
`;

// Leuchten je Faden: Plasmaröhre (Helligkeit ∝ Weglänge durch den Querschnitt) mit feinen Längsstreifen, sobald sie ein
// paar Pixel breit ist, weicher Hof darum; Plasmaknoten strömen entlang des Fadens (Siphon-Strömung, je Faden eigene
// Richtung), Beine heller als der Scheitel, Fuß blendet in die Oberfläche. Ruhige Bögen atmen langsam (12–45 s)
// und sind vor der Scheibe deutlich schwächer (dort leuchtet die Oberfläche selbst, kühles Plasma wirkt eher dunkel). Farben linear vor ACES: tiefrot → orange →
// gelbweiß im heißen Kern; uPal 1 = 304 Å (röter); vHot = frische Flare-Schleife (weißglühend, kühlt ab).
export const STRAND_FRAG = /* glsl */ `
${NOISE}
uniform float uTime, uGain, uPal, uMode, uK;
varying float vS, vX, vH, vI, vFlow, vSeed, vCut, vHot, vRes;
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
  float x = vX, t = uTime;
  float xr = x * 1.7, tube = sqrt(max(1.0 - xr * xr, 0.0));
  float str = 0.55 + 0.45 * gnoise(vec3(xr * 3.5 + vSeed * 9.0, vS * 5.0 - t * vFlow * 0.25, vSeed * 23.0));
  float prof = tube * mix(1.0, str, smoothstep(2.0, 6.0, vRes)) + 0.2 * exp(-xr * xr * 1.3) * (1.0 - x * x);
  float knots = smoothstep(-0.45, 0.55, gnoise(vec3(vS * 9.0 - t * vFlow, vSeed * 37.0, vSeed * 11.0)));
  float fine = 0.6 + 0.4 * gnoise(vec3(vS * 46.0 + vSeed * 5.0, vSeed * 91.0, t * 0.07));
  float foot = 1.0 + 1.3 * pow(abs(2.0 * vS - 1.0), 6.0);
  float base = smoothstep(0.0, 0.0055, vH);
  float I = vI * prof * (0.4 + 0.75 * knots) * fine * foot * base;
  if (uMode < 0.5) {
    I *= 0.4 + 0.6 * smoothstep(0.1, 0.9, 0.5 + 0.5 * sin(t * (0.14 + 0.36 * fract(vSeed * 3.7)) + vSeed * 40.0));
    vec3 rd = normalize(vW - cameraPosition);
    float tb = -dot(cameraPosition, rd), b2 = dot(cameraPosition, cameraPosition) - tb * tb;
    if (tb > 0.0 && b2 < 1.0) I *= 0.35;
  } else if (uMode > 2.5) {
    // zurückregnendes Material: helle Tropfen laufen nach dem Aufreißen die Beine hinab
    float ds = abs(vS - 0.5);
    float rain = smoothstep(0.38, 0.62, gnoise(vec3(ds * 16.0 - t * 0.8, vSeed * 13.0, vSeed * 5.0))) * smoothstep(0.6, 0.72, uK) * (1.0 - vCut);
    I += vI * prof * rain * 1.2 * base;
  }
  gl_FragColor = vec4(ramp(I) * I * uGain, 1.0);
}
`;

// Bänder aller Fäden: je Faden (segs + 1) × 2 Ecken, Dreiecksstreifen als Index. 'position' = Fußpunkt a (nur für three.js).
export function strandGeometry(loops, rand, segs = 40) {
  const nT = loops.reduce((n, L) => n + L.threads, 0), nv = nT * (segs + 1) * 2;
  const A = new Float32Array(nv * 3), B = new Float32Array(nv * 3), E = new Float32Array(nv * 3);
  const Lb = new Float32Array(nv * 4), T = new Float32Array(nv * 4), S = new Float32Array(nv * 4);
  const idx = new Uint32Array(nT * segs * 6);
  let v = 0, ii = 0;
  for (const L of loops) {
    for (let j = 0; j < L.threads; j++) {
      // Fäden im Querschnitt verteilt (gleichmäßig in der Fläche), je eigene Breite, Helligkeit und Strömung
      const phi = rand() * Math.PI * 2, rho = Math.sqrt(rand()), w = L.width * (0.7 + 0.6 * rand());
      const I = L.I * (0.55 + 0.7 * rand()), seed = rand(), flow = L.flow * (0.7 + 0.6 * rand());
      const v0 = v;
      for (let i = 0; i <= segs; i++) {
        for (const side of [-1, 1]) {
          A.set([L.a.x, L.a.y, L.a.z], v * 3); B.set([L.b.x, L.b.y, L.b.z], v * 3); E.set([L.delay || 0, L.seed, L.flat || 0], v * 3);
          Lb.set([L.h, L.lean, L.rope, w], v * 4); T.set([phi, rho, seed, I], v * 4); S.set([i / segs, side, L.twist, flow], v * 4);
          v++;
        }
      }
      for (let i = 0; i < segs; i++) {
        const o = v0 + i * 2;
        idx.set([o, o + 2, o + 1, o + 1, o + 2, o + 3], ii);   // gegen den Uhrzeigersinn: Seite = Tangente × Sehstrahl
        ii += 6;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(A, 3));
  for (const [k, a, n] of [['aA', A, 3], ['aB', B, 3], ['aE', E, 3], ['aL', Lb, 4], ['aT', T, 4], ['aS', S, 4]]) g.setAttribute(k, new THREE.BufferAttribute(a, n));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
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
