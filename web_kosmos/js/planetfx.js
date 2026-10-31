// Shader-Bausteine für Planeten und Monde (Stationen Sonnensystem und Erde & Mond): Oberfläche mit weichem Terminator,
// Atmosphäre als eigene Hülle (Strahl-Kugel-Schnitt mit Einfachstreuung), Wolkenschicht, Saturnringe mit Durchlicht.
// Darstellungs-Übertreibungen (Hüllen dicker, Nachtseite aufgehellt, Wolkenschicht höher) stehen jeweils am Shader.

import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { settings } from './settings.js';

export const rayleighUniform = {
  get value() { return settings.S.rayleigh === false ? 1.0 : 0.0; }
};
// Zahnrad Global „Licht und Schatten“: uLook = Sonnenlicht, Nachtseite, Schatten, weiche Grenze · uLook2 = Spiegelung, Glanz.
// Getter lesen settings.S je Bild; jedes ShaderMaterial, dessen Fragment-Shader uLook nennt (PLANET_FRAG samt Abwandlungen,
// Erde), bekommt sie beim Kompilieren – ohne Eingriff an den rund 20 Stellen, die eigene Uniforms für PLANET_FRAG bauen.
const look = new Float32Array(4), look2 = new Float32Array(2);
const LOOK = {
  uLook: { get value() { const S = settings.S; look.set([S.sunK, S.shade, S.shadow, S.soft]); return look; } },
  uLook2: { get value() { look2.set([settings.S.spec, settings.S.gloss]); return look2; } },
};
THREE.ShaderMaterial.prototype.onBeforeCompile = function (sh) { if (sh.fragmentShader.includes('uLook')) Object.assign(sh.uniforms, LOOK); };

export const BODY_VERT = /* glsl */ `
varying vec3 vN, vP, vO;
varying vec2 vUv;
void main() {
  vUv = uv;
  vO = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
export const SHELL_VERT = /* glsl */ `
varying vec3 vP;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;

// Planetenoberfläche. Licht von der Sonne im Ursprung. Weicher Terminator: „Wrap“-Beleuchtung (uWrap) – die Atmosphäre
// streut Licht ein Stück über die Schattengrenze, an der Grenze rötlich (uTerm). Nachtseite: Rest-Licht ≈ 1,5 % (Sternen-
// und Zodiakallicht, für die Lesbarkeit stark aufgehellt; echt ≈ 10⁻⁸). Gasriesen (uBand): band-ausgerichtetes fBm-Detail
// beim Heranzoomen (in der Breite fein, in der Länge gestreckt), die Bänder strömen gegeneinander (zonale Winde, Zeitraffer).
// Erde: Glanzlicht der Ozeane, Wolkenschatten (Wolkenkarte zur Sonne versetzt), Stadtlichter mit warmem Hof.
// Saturn: Ringschatten aus dem Strahl Oberfläche → Sonne durch die Ringebene. Mond (uMoon): Lommel-Seeliger + Erdschein
// (bzw. Planetenschein: uEarthPos = Mitte des Planeten). Stationen ohne Sonne im Ursprung (Planetensysteme, Monde):
// uSunDir = Einheitsvektor zur Sonne (paralleles Licht); nicht gesetzt (0) → Sonne im Ursprung wie im Sonnensystem.
// Finsternisse: bis zu 4 Verdecker uOcc (xyz Mitte, w Radius; uOccN Anzahl) werfen Kern- und Halbschatten aus dem Überlapp
// der Sonnenscheibe (Winkelradius uSunAng) mit der Scheibe des Verdeckers – Mondschatten auf Jupiter, Jupiterschatten auf Io.
export const PLANET_FRAG = /* glsl */ `
uniform sampler2D tMap, tNight, tClouds, tSpec, tRing;
uniform float uHasEarth, uCloudU, uGain, uRing, uRingIn, uRingOut, uWrap, uAmb, uBand, uTime, uMoon, uEarthshine, uSunAng;
uniform vec3 uTerm, uEarthPos, uSunDir;
uniform vec4 uOcc[4];
uniform int uOccN;
uniform mat4 uInv;
uniform vec4 uLook;   // Zahnrad Global: Sonnenlicht, Nachtseite, Schatten, weiche Grenze (fehlt es → Standard 1)
uniform vec2 uLook2;  // Spiegelung (Ozean-Glanzlicht), Glanz aller Oberflächen
varying vec3 vN, vP, vO;
varying vec2 vUv;
${NOISE}
// Anteil der Sonnenscheibe, der am Punkt p hinter den Verdeckern sichtbar bleibt (Scheibenüberlapp, linear genähert)
float eclipse(vec3 p, vec3 L) {
  float vis = 1.0;
  for (int i = 0; i < 4; i++) {
    if (i >= uOccN) break;
    vec3 d = uOcc[i].xyz - p;
    float dist = length(d);
    if (dot(d, L) <= 0.0 || dist <= uOcc[i].w) continue;
    float ao = asin(uOcc[i].w / dist), as = max(uSunAng, 1e-5);
    float sep = acos(clamp(dot(d / dist, L), -1.0, 1.0));
    float lo = abs(ao - as), hi = ao + as;
    float full = ao >= as ? 0.0 : 1.0 - (ao * ao) / (as * as);
    vis *= mix(full, 1.0, smoothstep(lo, hi, sep));
  }
  return vis;
}
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP), L = dot(uSunDir, uSunDir) > 0.5 ? uSunDir : normalize(-vP);
  float ndl = dot(N, L);
  // Blickwinkel zur Normalen und Dicke der Lufthülle (aus uWrap): steuern Randabdunklung und Rim-Licht (Vorschau 31.10.2026 Planet:B)
  float nv = max(dot(N, V), 0.0), kAtm = clamp(uWrap * 4.0, 0.0, 0.5);
  vec4 lk = uLook.x > 0.0 ? uLook : vec4(1.0);
  vec2 lk2 = uLook.x > 0.0 ? uLook2 : vec2(1.0, 0.0);
  float wrap = uWrap * lk.w;
  vec2 uv = vUv;
  float det = 0.0;
  if (uBand > 0.0) {
    float px = length(fwidth(vO));
    float fade = 1.0 - smoothstep(0.004, 0.016, px);
    if (fade > 0.0) {
      float a = uTime * 0.006 * sin(vO.y * 23.0);
      vec3 q = vec3(vO.x * cos(a) - vO.z * sin(a), vO.y, vO.x * sin(a) + vO.z * cos(a));
      vec3 dp = vec3(q.x * 3.0, q.y * 36.0, q.z * 3.0);
      float w = fbm(dp + vec3(0.0, 0.0, uTime * 0.008), 4);
      uv.y += w * 0.005 * uBand * fade;
      det = fbm(dp * 2.6 + w * 1.6, 2) * uBand * fade;
    }
  }
  vec3 alb = texture2D(tMap, uv).rgb * (1.0 + 0.25 * det);
  float lit = clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0);
  lit = lit * lit * (3.0 - 2.0 * lit) * 0.35 + lit * 0.65;
  float sh = 1.0;
  if (uRing > 0.5) {
    vec3 pl = (uInv * vec4(vP, 1.0)).xyz, ll = normalize((uInv * vec4(vP + L, 1.0)).xyz - pl);
    if (abs(ll.y) > 1e-4) {
      float t = -pl.y / ll.y;
      if (t > 0.0) {
        float r = length((pl + ll * t).xz);
        if (r > uRingIn && r < uRingOut) sh = 1.0 - 0.9 * lk.z * texture2D(tRing, vec2((r - uRingIn) / (uRingOut - uRingIn), 0.5)).a;
      }
    }
  }
  vec3 sunCol = mix(uTerm, vec3(1.0), smoothstep(-wrap, 0.22, ndl));
  vec3 col;
  if (uMoon > 0.5) {
    float mu0 = max(ndl, 0.0), mu = max(dot(N, V), 0.0);
    col = alb * mu0 / (mu0 + mu + 1e-4) * 1.8 * lk.x;
    vec3 E = normalize(uEarthPos - vP);
    float e0 = max(dot(N, E), 0.0);
    col += alb * e0 / (e0 + mu + 1e-4) * uEarthshine;
  } else {
    col = alb * lit * sh * sunCol * lk.x;
    // Kino-Licht (Vorschau 31.10.2026 Planet:B, Darstellung): Sonnenseite kräftiger, leichte Randabdunklung, warmer Lichtsaum
    // (Rim) am beleuchteten Rand in Dämmerungsfarbe, weiches Glanzlicht auf Wolkendecken – nur auf der Tagseite, Ringschatten dämpft
    col *= 1.0 + 0.22 * smoothstep(0.15, 0.9, ndl);
    col *= 1.0 - (0.08 + kAtm * 0.4) * pow(1.0 - nv, 2.0);
    col += mix(vec3(1.0), uTerm, 0.4) * pow(1.0 - nv, 3.5) * smoothstep(-0.15, 0.35, ndl) * (0.3 + kAtm * 0.6) * lk.x;
    col += sunCol * pow(max(dot(N, normalize(L + V)), 0.0), 20.0) * 0.07 * sh * smoothstep(0.0, 0.2, ndl) * lk.x;
  }
  // Glanz (Regler, Standard aus): breites Glanzlicht auf Eis, Wolken und Gestein
  if (lk2.y > 0.0) col += sunCol * pow(max(dot(N, normalize(L + V)), 0.0), 48.0) * 0.12 * lk2.y * lk.x * sh * smoothstep(0.0, 0.2, ndl);
  if (uOccN > 0) col *= mix(1.0, eclipse(vP, L), lk.z);
  if (uHasEarth > 0.5) {
    vec2 cuv = vUv + vec2(uCloudU, 0.0);
    float cl = texture2D(tClouds, cuv).r, ocean = texture2D(tSpec, vUv).r;
    vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(vO)) + 1e-5), north = cross(normalize(vO), east);
    vec3 Lo = normalize((uInv * vec4(L, 0.0)).xyz);
    float csh = 1.0 - 0.5 * texture2D(tClouds, cuv + vec2(dot(Lo, east), dot(Lo, north)) * 0.004).r * lit;
    col *= mix(1.0, csh, lk.z);
    vec3 H = normalize(L + V);
    col += vec3(1.0, 0.9, 0.75) * pow(max(dot(N, H), 0.0), 220.0) * ocean * (1.0 - cl) * lit * 0.9 * lk2.x * lk.x;
    col += vec3(0.25, 0.4, 0.6) * pow(1.0 - max(dot(N, V), 0.0), 5.0) * ocean * lit * 0.1;
    vec3 night = texture2D(tNight, vUv).rgb, glow = texture2D(tNight, vUv, 3.5).rgb;
    float dark = 1.0 - smoothstep(-0.12, 0.12, ndl);
    col += (night * night * 1.6 + glow * 0.35) * vec3(1.0, 0.72, 0.42) * dark * (1.0 - cl * 0.6);
  }
  col += alb * uAmb * 0.6 * lk.y * (1.0 - lit);   // Nachtseite tiefer (Planet:B)
  gl_FragColor = vec4(col * uGain, 1.0);
}
`;

// Atmosphäre als Hülle (Radius uRa um uCenter, Boden uRp): Sichtstrahl in 12 Schritten durch die Hülle, Dichte exponentiell
// mit der Höhe (Skalenhöhe uH als Anteil der Hüllendicke), Einfachstreuung mit Rayleigh- (uBeta, blau stärker) und Mie-
// Anteil (uMie, Vorwärtsstreuung); Licht zur Probe durch die Hülle geschwächt (Chapman-Näherung) → an der Dämmerungsgrenze
// rot-orange, im Planetenschatten dunkel. Weicher Glanz über den Rand hinaus mit exponentiellem Abfall. uAir: Nacht-
// leuchten (Airglow, grün 557,7 nm) als dünne Lage in ≈ 95 km Höhe. Hüllen sind dicker gezeichnet (Erde: sichtbarer Saum
// ≈ 450 km statt ≈ 100 km), damit der Saum aus der Ferne trägt.
export const ATMO_FRAG = /* glsl */ `
uniform vec3 uSun, uCenter, uBeta, uMieCol;
uniform float uRp, uRa, uH, uGain, uMie, uAir, uAirH, uNoRayleigh;
varying vec3 vP;
void main() {
  vec3 ro = cameraPosition, rd = normalize(vP - ro), oc = ro - uCenter;
  float b = dot(oc, rd), c = dot(oc, oc) - uRa * uRa, hh = b * b - c;
  if (hh <= 0.0) discard;
  hh = sqrt(hh);
  float t0 = max(-b - hh, 0.0), t1 = -b + hh;
  float hp = b * b - (dot(oc, oc) - uRp * uRp);
  if (hp > 0.0 && -b - sqrt(hp) > 0.0) t1 = min(t1, -b - sqrt(hp));
  if (t1 <= t0) discard;
  float thick = uRa - uRp, ds = (t1 - t0) / 12.0, dn = ds / thick;
  vec3 sum = vec3(0.0);
  float tauV = 0.0, air = 0.0, airLit = 0.0;
  for (int i = 0; i < 12; i++) {
    vec3 p = ro + rd * (t0 + ds * (float(i) + 0.5)) - uCenter;
    float r = length(p), alt = max(r - uRp, 0.0) / thick;
    float dens = exp(-alt / uH) * (1.0 - smoothstep(0.85, 1.0, alt));
    vec3 n = p / r;
    float mu = dot(n, uSun);
    float cs = sqrt(max(0.0, 1.0 - (uRp * uRp) / (r * r)));
    float vis = smoothstep(-cs - 0.06, -cs + 0.03, mu);
    float tauS = dens * uH / (max(mu, 0.0) + 0.1);
    vec3 att = exp(-(uBeta + uMie * 0.5) * (tauV + tauS));
    sum += dens * att * vis * dn;
    // Mehrschichtige Rayleigh-Dämmerung am Terminator (Optik:B) – nur bei streifendem Blick auf die Hülle (Rand der Kugel), sonst
    // zeichnete sie sich als Balken quer über die Scheibe ab (Vorschau 31.10.2026 Planet:B)
    if (uNoRayleigh < 0.5) {
      float twRange = smoothstep(0.08, -0.04, mu) * smoothstep(-0.25, -0.05, mu);
      float graze = pow(1.0 - abs(dot(rd, n)), 2.0);
      vec3 twCol = mix(vec3(1.0, 0.46, 0.16), vec3(1.0, 0.22, 0.06), smoothstep(0.02, -0.12, mu));
      sum += twCol * twRange * exp(-alt * 2.8) * vis * dn * 3.0 * graze;
    }
    tauV += dens * dn;
    float ag = exp(-pow((alt - uAirH) / 0.05, 2.0)) * dn;
    air += ag;
    airLit += ag * vis;
  }
  float cosT = dot(rd, uSun);
  float phR = 0.75 * (1.0 + cosT * cosT);
  float g = 0.72, phM = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosT, 1.5) * 0.12;
  vec3 col = sum * (uBeta * phR + uMieCol * uMie * phM);
  // Nachtleuchten nur bei langem Weg durch die Lage sichtbar (Rand), daher quadratisch gewichtet
  float an = max(air - airLit * 0.9, 0.0);
  col += vec3(0.32, 1.0, 0.48) * an * an * uAir;
  gl_FragColor = vec4(col * uGain, 1.0);
}
`;

// Wolkenschicht als eigene Kugel (Alpha aus der Wolkenkarte, driftet), beleuchtet mit weichem Terminator und rosa
// Dämmerungslicht, dünne Ränder leuchten gegen die Sonne (Vorwärtsstreuung), beim Heranzoomen feine Kanten aus Rauschen.
// Auf der Nachtseite dunkel – sie verdecken die Stadtlichter. Schichthöhe vergrößert (Parallaxe sichtbar).
export const CLOUD_FRAG = /* glsl */ `
uniform sampler2D tClouds;
uniform vec3 uSun, uAxis;
uniform float uCloudU, uTime, uGain, uOpacity;
varying vec3 vN, vP, vO;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 cu = vUv + vec2(uCloudU, 0.0);
  float c = texture2D(tClouds, cu).r;
  float px = length(fwidth(normalize(vO)));
  float fade = 1.0 - smoothstep(0.0015, 0.008, px);
  float n = fade > 0.0 ? fbm(normalize(vO) * 70.0 + vec3(0.0, 0.0, uTime * 0.01), 3) * fade : 0.0;
  float a = smoothstep(0.1, 0.8, c + n * 0.22 * smoothstep(0.05, 0.5, c));
  if (a < 0.003) discard;
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float ndl = dot(N, uSun);
  float lit = clamp((ndl + 0.1) / 1.1, 0.0, 1.0);
  vec3 sunCol = mix(vec3(1.0, 0.42, 0.25), vec3(1.0), smoothstep(-0.03, 0.3, ndl));
  float fwd = pow(max(dot(-V, uSun), 0.0), 8.0) * (1.0 - a) * 0.8;
  // Wolkenrelief (Modell, Höhe ∝ Dichte): weichere Mip-Stufe (glättet Kompressionsblöcke) zur Sonne versetzt abtasten –
  // Seiten der Türme zur Sonne hell, dahinter Eigenschatten; bei tiefer Sonne am stärksten. Nur mit Polachse uAxis (Erde).
  float relief = 0.0;
  if (dot(uAxis, uAxis) > 0.5) {
    float cb = texture2D(tClouds, cu, 1.5).r;
    vec3 e = cross(uAxis, N);
    float cosLat = max(length(e), 0.05);
    vec3 east = e / cosLat, north = cross(N, east);
    vec2 sd = vec2(dot(uSun, east) / cosLat, dot(uSun, north) * 2.0);
    relief = (cb - texture2D(tClouds, cu + sd * 0.0004, 1.5).r) * 1.6 + (cb - texture2D(tClouds, cu + sd * 0.0012, 2.5).r) * 0.9;
  }
  float shape = clamp(1.0 + relief * (0.5 + 1.3 * (1.0 - clamp(ndl, 0.0, 1.0))), 0.4, 1.45);
  vec3 col = vec3(0.93, 0.94, 0.96) * lit * sunCol * (0.85 + 0.15 * c) * shape + sunCol * fwd * lit + vec3(0.012, 0.018, 0.03) * lit;
  gl_FragColor = vec4(col * uGain, a * uOpacity);
}
`;

// Ringe: Alpha-Textur; beleuchtete Seite diffus mit leichter Rückstreuung (Oppositionseffekt), Schattenseite im Durchlicht
// (Staub und dünne Ringe leuchten gegen die Sonne, dichter B-Ring bleibt dunkel), Planetenschatten aus dem Strahl Ring → Sonne.
export const RING_FRAG = /* glsl */ `
uniform sampler2D tRing;
uniform vec3 uCenter, uSunDir;
uniform float uR, uGain;
varying vec3 vN, vP, vO;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(tRing, vUv);
  vec3 L = dot(uSunDir, uSunDir) > 0.5 ? uSunDir : normalize(-vP), V = normalize(cameraPosition - vP), N = normalize(vN), oc = vP - uCenter;
  float b = dot(oc, L), h = b * b - (dot(oc, oc) - uR * uR);
  float sh = (h > 0.0 && b < 0.0) ? 0.04 : 1.0;
  float nl = dot(N, L), nv = dot(N, V);
  float sameSide = step(0.0, nl * nv);
  float back = pow(max(dot(V, L), 0.0), 12.0);
  float fwd = pow(max(dot(-V, L), 0.0), 3.0);
  float diff = (0.3 + 0.7 * abs(nl)) * (1.0 + 0.35 * back);
  float trans = t.a * (1.0 - t.a) * 3.2 * (0.35 + 2.2 * fwd);
  vec3 col = t.rgb * mix(trans, diff, sameSide) * sh;
  gl_FragColor = vec4(col * uGain, mix(max(t.a * 0.85, trans * 0.5), t.a, sameSide));
}
`;

// Atmosphären je Planet: Hülle [Planetenradien], Skalenhöhe [Anteil der Hülle], Rayleigh-Farbe, Mie-Stärke + Farbe,
// Helligkeit, Terminator-Farbe + Wrap (Oberfläche), Airglow. Werte = Darstellung (Farbe nach Aufnahmen, Dicke vergrößert).
export const ATMOS = {
  mercury: null,
  venus: { ra: 1.05, h: 0.35, beta: [0.62, 0.55, 0.36], mie: 0.6, mieCol: [1.0, 0.95, 0.8], gain: 1.6, term: [1.0, 0.75, 0.45], wrap: 0.14 },
  earth: { ra: 1.06, h: 0.22, beta: [0.1, 0.26, 0.72], mie: 0.18, mieCol: [1.0, 0.95, 0.9], gain: 2.2, term: [1.0, 0.5, 0.3], wrap: 0.07 },
  mars: { ra: 1.03, h: 0.35, beta: [0.32, 0.2, 0.12], mie: 0.35, mieCol: [0.55, 0.7, 1.0], gain: 1.6, term: [1.0, 0.7, 0.55], wrap: 0.04 },
  jupiter: { ra: 1.025, h: 0.35, beta: [0.42, 0.38, 0.3], mie: 0.3, mieCol: [1.0, 0.92, 0.8], gain: 1.4, term: [1.0, 0.72, 0.5], wrap: 0.12 },
  saturn: { ra: 1.03, h: 0.35, beta: [0.45, 0.4, 0.28], mie: 0.3, mieCol: [1.0, 0.92, 0.78], gain: 1.4, term: [1.0, 0.75, 0.5], wrap: 0.12 },
  uranus: { ra: 1.04, h: 0.35, beta: [0.2, 0.5, 0.55], mie: 0.2, mieCol: [0.8, 1.0, 1.0], gain: 1.8, term: [0.7, 0.9, 0.95], wrap: 0.12 },
  neptune: { ra: 1.04, h: 0.35, beta: [0.14, 0.3, 0.75], mie: 0.2, mieCol: [0.7, 0.85, 1.0], gain: 1.8, term: [0.6, 0.75, 1.0], wrap: 0.12 },
};
