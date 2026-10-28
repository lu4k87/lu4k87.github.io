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

import * as THREE from 'three';
import { NOISE, BLACKBODY } from '../glsl.js';
import { schwarzschildRadius, C, AU, KPC, julianDate, solveKepler } from '../astro.js';
import { disposeScene, pointCloud } from '../vol.js';
import { registerLayers } from '../layers.js';

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

void main() {
  vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(mat3(uCamWorld) * normalize(v.xyz / v.w));
  vec3 pos = uCam;
  // weit draußen gerade bis zur Kugel r = 70 laufen (Krümmung dort < 1 %); vorbei → nur Himmel
  float R0 = 70.0;
  if (dot(pos, pos) > R0 * R0) {
    float b = dot(pos, dir), c = dot(pos, pos) - R0 * R0, h = b * b - c;
    if (h <= 0.0 || b > 0.0) { gl_FragColor = vec4(sky(dir), 1.0); return; }
    pos = pos + dir * (-b - sqrt(h));
  }
  vec3 hv = cross(pos, dir);
  float h2 = dot(hv, hv);
  float Lphys = -hv.y;                 // Drehimpuls des Photons um die Scheibenachse (Lichtweg rückwärts verfolgt)
  vec3 col = vec3(0.0);
  float A = 0.0;
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
        float hz = m.y / (0.4 * rm);
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

    if (pos.y * np.y < 0.0) {
      vec3 hit = mix(pos, np, pos.y / (pos.y - np.y));
      float rh = length(hit.xz);
      if (rh > 3.0 && rh < 20.0) {
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
        float a = clamp(edge * (0.4 + 0.55 * Tn) * smoothstep(0.08, 0.95, dens + hot), 0.0, 0.95);
        col += (1.0 - A) * e * a;
        A += (1.0 - A) * a;
        if (A > 0.985) { done = true; break; }
      } else if (rh > 1.0 && rh <= 3.0 && uPlunge > 0.0) {
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
        float a = clamp(0.35 * dens * uPlunge, 0.0, 0.6);
        col += (1.0 - A) * blackbodyRGB(uT0 * 0.9 * g) * I * uGain * a;
        A += (1.0 - A) * a * 0.5;
      }
    }
    pos = np;
    if (nr < 1.0) { done = true; break; }
    if (nr > 70.0 && dot(pos, dir) > 0.0) break;
  }
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
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FRAG,
    uniforms: {
      uCam: { value: new THREE.Vector3() }, uCamWorld: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() },
      uSteps: { value: steps(ctx.detail) }, uOct: { value: ctx.detail > 0.7 ? 4 : 3 }, uGain: { value: 0.85 }, uT0: { value: 3600 },
      uHot: { value: 0 }, uHotPh: { value: 0 }, uPlPh: { value: 0 },
      uTa: { value: 0 }, uTb: { value: 0 }, uSa: { value: 0 }, uSb: { value: 0.5 }, uWa: { value: 1 },
      uHaze: { value: 1 }, uPlunge: { value: 1 }, uGas: { value: 1 },
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

  let eht = 0, ehtOn = false, simT = 0, lapseIdx = 2, lapseOn = true, view = 'cam', hot = 0, hotOn = false, wantDist = 0;
  const post = { eht: [0, 0, 1.6] };
  const hotspots = [
    { id: 'shadow', kind: 'info', pos: new THREE.Vector3(0, 0, 0) },
    { id: 'photon', kind: 'info', pos: new THREE.Vector3(0, 2.7, 0), visible: () => view !== 'stars' },
    { id: 'doppler', kind: 'info', pos: new THREE.Vector3(-8.5, 0, 1.5), visible: () => view !== 'stars' },
    { id: 'isco', kind: 'info', pos: new THREE.Vector3(3.1, 0, -0.6), visible: () => view !== 'stars' },
    { id: 'flare', kind: 'info', pos: new THREE.Vector3(3.5, 0.4, 0), visible: () => hotOn && view !== 'stars' },
    { id: 's2', kind: 'info', pos: s2pos, visible: () => view === 'stars' },
    { id: 'peri', kind: 'info', pos: peri, visible: () => view === 'stars' },
    { id: 'cluster', kind: 'info', pos: new THREE.Vector3(-30000, 12000, -20000), visible: () => view === 'stars' },
  ];
  const HOME_D = 25.6, STARS_D = 52000;
  const orbitCenter = s2Point(0).add(s2Point(Math.PI)).multiplyScalar(0.5);   // Mitte der Ellipse (Peri- und Apozentrum)
  const wantTarget = new THREE.Vector3();
  const controls = [
    { id: 'view', label: 'Ansicht', value: 'cam', options: [['cam', 'Horizont'], ['eht', 'EHT-Blick'], ['stars', 'S-Sterne']],
      set: (v) => { view = v; ehtOn = v === 'eht'; sgroup.visible = v === 'stars'; wantDist = v === 'stars' ? STARS_D : HOME_D; wantTarget.copy(v === 'stars' ? orbitCenter : new THREE.Vector3()); } },
    { id: 'hot', label: 'Flare', show: true, value: 'off', options: [['off', 'Aus'], ['on', 'Heißer Fleck']], set: (v) => { hotOn = v === 'on'; } },
  ];
  const u = mat.uniforms;
  const lapse = () => (lapseOn ? LAPSES[lapseIdx] : 1);
  registerLayers('sgra', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', value: lapseIdx, min: 0, max: LAPSES.length - 1, step: 1, autoplay: !ctx.still, fmt: (i) => `×${LAPSES[Math.round(i)]}`,
      hint: 'Die Scheibe dreht innen schneller als außen (Kepler); ein Umlauf an der innersten stabilen Bahn dauert echt gut eine halbe Stunde. Pause = Echtzeit.',
      set: (i, playing) => { lapseIdx = Math.round(i); lapseOn = playing; },
      get: () => ({ value: lapseIdx, playing: lapseOn }), status: () => (lapseOn ? `Scheibe ×${LAPSES[lapseIdx]}` : 'Echtzeit') },
    { id: 'riaf', type: 'range', group: 'Gas um das Loch', label: 'Heiße Strömung', min: 0, max: 4, step: 0.1, value: 1, fmt: (v) => (v ? `×${String(v).replace('.', ',')}` : 'aus'),
      set: (v) => { u.uHaze.value = v; },
      hint: 'Modell: Sgr A* frisst wenig – das Gas bildet eine dünne, heiße und dicke Strömung um die Scheibe. Ihr Licht läuft auf denselben gekrümmten Wegen; Licht, das das Loch fast umrundet, sammelt sich zum hellen Ring am Schatten.' },
    { id: 'plunge', type: 'toggle', label: 'Einfallzone innerhalb 3 Rs', value: true, set: (v) => { u.uPlunge.value = v ? 1 : 0; },
      hint: 'Modell: Innerhalb der innersten stabilen Bahn stürzt das Gas auf Spiralbahnen ins Loch. Sein Licht wird zum Horizont hin immer stärker rotverschoben und verlischt.' },
    { id: 'gas', type: 'toggle', label: 'Gasströme im Zentrum (Minispirale)', value: true, set: (v) => { u.uGas.value = v ? 1 : 0; },
      hint: 'Ionisierte Gasfäden von Sgr A West, rund 1 bis 3 Lichtjahre um das Loch; Lage und Form hier als Modell, die Fäden werden hinter dem Loch mit gelinst.' },
  ]);
  const fmtAU = (rs) => `${Math.round(rs * RS / AU).toLocaleString('de-DE')} AE`;

  return {
    scene, camera, unit: RS, hotspots, controls, post, resScale: 0.62, msaa: false, mips: true,
    home: { pos: new THREE.Vector3(0, 5.4, 25), target: new THREE.Vector3(0, 0, 0) },
    orbit: { minDistance: 6, maxDistance: 140, cineSpeed: 0.5 },
    // warme Lichter, neutrale Schatten: die Farbe kommt aus der Scheibe (Schwarzkörper + Doppler), Bloom für den Glutschein
    look: { exposure: 1.0, bloom: 0.13, sat: 1.2, con: 0.16, sh: [0.99, 0.99, 1.03], hi: [1.05, 1.0, 0.93], vig: 0.46 },
    // Ansichtswechsel: Grenzen der Steuerung und Abstand weich (logarithmisch) nachführen
    orbitUpdate(c, dt) {
      c.maxDistance = view === 'stars' ? 120000 : 140;
      c.minDistance = view === 'stars' ? 2000 : 6;
      if (!wantDist) return;
      const k = Math.min(1, dt * 2.2);
      const off = camera.position.clone().sub(c.target);
      c.target.lerp(wantTarget, k);
      const d = off.length();
      const nd = Math.exp(Math.log(d) + (Math.log(wantDist) - Math.log(d)) * k);
      camera.position.copy(c.target).addScaledVector(off.normalize(), nd);
      if (Math.abs(Math.log(nd / wantDist)) < 0.01 && c.target.distanceTo(wantTarget) < wantDist * 0.01) wantDist = 0;
    },
    update(dt, t, cam) {
      simT += dt * lapse() / RS_C;   // Zeit in Rs/c
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
    live: () => (view === 'stars'
      ? `S2 heute ${fmtAU(s2pos.length())} vom Loch · Perizentrum ${fmtAU(peri.length())} (Mai 2018, 7.650 km/s) · Umlauf 16,05 Jahre`
      : `${lapseOn ? `Zeitraffer ×${lapse()}` : 'Echtzeit'} · innerste stabile Bahn: Umlauf echt ${Math.round(TAU / OM_ISCO * RS_C / 60)} min${hotOn ? ` · Flare: Umlauf auf 3,5 Rs echt ≈ ${Math.round(TAU / OM_HOT * RS_C / 60)} min` : ''}`),
    setDetail(d) { u.uSteps.value = steps(d); u.uOct.value = d > 0.7 ? 4 : 3; },
    setPixelRatio(pr, H) { s2.userData.setPx(pr, H, camera.fov); periDot.userData.setPx(pr, H, camera.fov); },
    dispose: () => disposeScene(scene),
  };
}
