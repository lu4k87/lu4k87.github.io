// Station 7: Sagittarius A* (Einheit 1 Schwarzschild-Radius Rs = 2GM/c², M = 4,297·10⁶ M☉ → 1,27·10¹⁰ m).
// Strahlverfolgung je Pixel in der Schwarzschild-Metrik: Photonenbahnen nach d²x/dλ² = −(3/2)·h²·x/r⁵ (h = |x × v|,
// gleichwertig zur Binet-Gleichung u'' + u = (3/2)·u² mit Rs = 1); eingefangen unter r = 1, Schatten bei √27/2 Rs.
// Scheibe in der Ebene y = 0 von der innersten stabilen Bahn (3 Rs) bis 16 Rs: Temperatur nach Novikov-Thorne
// (T ∝ [r⁻³(1 − √(3/r))]^¼), Frequenzverschiebung g = 1 / (u^t · (1 − Ω·L)) aus Kepler-Umlauf (Ω = √(M/r³)) und
// Drehimpuls des Photons; Helligkeit ∝ g⁴, Farbe aus g·T. Der Himmel dahinter (Sterne des Zentralhaufens) wird mit
// gelinst. Weit draußen (r > 70 Rs) ist die Krümmung vernachlässigbar: Strahlen laufen gerade bis zur Kugel r = 70 und
// werden erst dort integriert – so stimmt das Bild auch aus 40.000 Rs (S-Stern-Ansicht). Zeitraffer ×200: ein Umlauf an
// der innersten Bahn dauert echt gut eine halbe Stunde. Flare: heißer Fleck auf ≈ 3,5 Rs (7 GM/c²), Umlauf ≈ 40 min
// (GRAVITY 2018). S-Sterne: Bahn von S2 aus den Elementen (GRAVITY 2020), Ort zum aktuellen Datum.

import * as THREE from 'three';
import { NOISE, BLACKBODY } from '../glsl.js';
import { schwarzschildRadius, C, AU, KPC, julianDate, solveKepler } from '../astro.js';
import { disposeScene, pointCloud } from '../vol.js';

const M_SGR = 4.297e6;            // GRAVITY 2022
const RS = schwarzschildRadius(M_SGR);
const LAPSE = 200;                // Zeitraffer
const RS_C = RS / C;              // Lichtlaufzeit über Rs [s] ≈ 42 s
const D_GC = 8.277 * KPC;
// S2 (GRAVITY 2020): a = 0,125058″, e = 0,884649, i = 134,567°, Ω = 228,171°, ω = 66,263°, P = 16,0455 a, T₀ = 2018,379
const S2 = { a: 0.125058, e: 0.884649, i: 134.567, O: 228.171, w: 66.263, P: 16.0455, T0: 2018.379 };
const RAD = Math.PI / 180;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCam;
uniform mat4 uCamWorld, uProjInv;
uniform float uTime, uSteps, uGain, uT0, uHot, uHotPh;
varying vec2 vUv;
${NOISE}
${BLACKBODY}

// Himmel: Sterne des Zentralhaufens (dicht, gerötet durch Staub), diffuses Leuchten mit Staubbahnen
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
    vec3 tint = mix(vec3(1.0, 0.62, 0.38), vec3(0.85, 0.9, 1.0), hash13(c + 3.0));
    float w = k == 0 ? 90.0 : k == 1 ? 45.0 : 70.0;
    col += tint * b * exp(-dd * dd * w);
  }
  float g = 0.5 + 0.5 * fbm(d * 3.0, 4);
  float dust = smoothstep(0.1, 0.5, fbm(d * 6.0 + 2.0, 4));
  col += vec3(0.05, 0.028, 0.018) * g * (0.4 + 0.6 * exp(-abs(d.y) * 3.0)) * (1.0 - 0.6 * dust);
  return col;
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
    if (pos.y * np.y < 0.0) {
      vec3 hit = mix(pos, np, pos.y / (pos.y - np.y));
      float rh = length(hit.xz);
      if (rh > 3.0 && rh < 16.0) {
        float Om = sqrt(0.5 / (rh * rh * rh));
        float ut = 1.0 / sqrt(1.0 - 1.5 / rh);
        float g = 1.0 / (ut * (1.0 - Om * Lphys));
        float Tn = pow(max(1.0 - sqrt(3.0 / rh), 0.0) / (rh * rh * rh), 0.25) / 0.2141;
        float ph = atan(hit.z, hit.x) + Om * uTime;
        vec3 q = vec3(cos(ph) * rh * 0.9, sin(ph) * rh * 0.9, rh * 2.2);
        float n = fbm(q * 0.55, 5);
        float streak = 0.55 + 0.9 * max(n + 0.25, 0.0) + 0.35 * fbm(vec3(rh * 3.0, cos(ph) * 2.0, sin(ph) * 2.0), 3);
        // heißer Fleck (Flare) auf 3,5 Rs, läuft mit Kepler-Winkelgeschwindigkeit um
        float dph = atan(sin(ph - uHotPh), cos(ph - uHotPh));
        float hot = uHot * exp(-pow((rh - 3.5) / 0.55, 2.0) - pow(dph / 0.28, 2.0)) * 3.5;
        float edge = smoothstep(3.0, 3.6, rh) * smoothstep(16.0, 11.0, rh);
        float I = pow(Tn, 4.0) * pow(g, 4.0) * streak * edge * (1.0 + hot);
        vec3 e = blackbodyRGB(uT0 * Tn * g * (1.0 + 0.15 * hot)) * I * uGain;
        float a = clamp(edge * (0.55 + 0.4 * Tn) * min(1.0, streak), 0.0, 0.94);
        col += (1.0 - A) * e * a;
        A += (1.0 - A) * a;
        if (A > 0.985) { done = true; break; }
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
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FRAG,
    uniforms: {
      uCam: { value: new THREE.Vector3() }, uCamWorld: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() },
      uTime: { value: 0 }, uSteps: { value: Math.round(220 + 180 * ctx.detail) }, uGain: { value: 1.1 }, uT0: { value: 6000 },
      uHot: { value: 0 }, uHotPh: { value: 0 },
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

  let eht = 0, ehtOn = false, simT = 0, view = 'cam', hot = 0, hotOn = false, wantDist = 0;
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
    { id: 'hot', label: 'Flare', value: 'off', options: [['off', 'Aus'], ['on', 'Heißer Fleck']], set: (v) => { hotOn = v === 'on'; } },
  ];
  const fmtAU = (rs) => `${Math.round(rs * RS / AU).toLocaleString('de-DE')} AE`;

  return {
    scene, camera, unit: RS, hotspots, controls, post, resScale: 0.62, msaa: false, mips: true,
    home: { pos: new THREE.Vector3(0, 5.4, 25), target: new THREE.Vector3(0, 0, 0) },
    orbit: { minDistance: 6, maxDistance: 140, cineSpeed: 0.5 },
    look: { exposure: 1.0, bloom: 0.08, sat: 1.05, con: 0.12, sh: [0.95, 0.98, 1.06], hi: [1.04, 1.0, 0.95] },
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
      simT += dt * LAPSE / RS_C;   // Zeit in Rs/c
      const u = mat.uniforms;
      cam.updateMatrixWorld();
      u.uCam.value.copy(cam.position);
      u.uCamWorld.value.copy(cam.matrixWorld);
      u.uProjInv.value.copy(cam.projectionMatrixInverse);
      u.uTime.value = simT;
      hot += ((hotOn ? 1 : 0) - hot) * Math.min(1, dt * 2);
      u.uHot.value = hot;
      // Fleck auf 3,5 Rs: Ω = √(0,5/r³) in Rs/c-Einheiten, gleiche Zeitbasis wie die Scheibe
      u.uHotPh.value = Math.sqrt(0.5 / Math.pow(3.5, 3)) * simT * 0.0 + Math.sqrt(0.5 / 42.875) * simT;
      hotspots[4].pos.set(3.5 * Math.cos(u.uHotPh.value), 0.4, 3.5 * Math.sin(u.uHotPh.value));
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
      : `Zeitraffer ×${LAPSE} · innerste stabile Bahn: Umlauf echt ${Math.round(2 * Math.PI / Math.sqrt(0.5 / 27) * RS_C / 60)} min${hotOn ? ' · Flare: Umlauf auf 3,5 Rs echt ≈ 42 min' : ''}`),
    setPixelRatio(pr, H) { s2.userData.setPx(pr, H, camera.fov); periDot.userData.setPx(pr, H, camera.fov); },
    dispose: () => disposeScene(scene),
  };
}
