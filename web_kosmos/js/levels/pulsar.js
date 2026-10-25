// Station 6: Crab-Pulsar (Einheit 1 km). Neutronenstern R ≈ 13 km (NICER), Drehachse = +y, Magnetachse um 45° geneigt
// (Modellwert, umstritten). Geschlossene Feldlinien des Dipols r = L·sin²θ bis an den Lichtzylinder R_LC = c·P/2π,
// offene Feldlinien von den Polkappen hinaus. Strahlkegel entlang der Magnetachse (hohler Kegel wie im Radio),
// der zweite Kegel gibt den Zwischenpuls. Zeitlupe, weil 30 Blitze pro Sekunde ein Anfallsrisiko wären (WCAG 2.3.1);
// der Ton spielt den echten Takt: Hauptpuls und Zwischenpuls bei 0,4 der Periode. Pulsarwind: Teilchen strömen jenseits
// des Lichtzylinders nahezu mit Lichtgeschwindigkeit nach außen (Zeitlupe wie die Drehung), gebündelt zur Äquatorebene
// („gestreifter Wind“) und entlang der Achse (Jets). Lichtkurve: Pulsprofil des Crab (Hauptpuls, Zwischenpuls bei 0,4 P)
// mit laufender Phasenmarke – die Erde liegt in Richtung +z der Szene.

import * as THREE from 'three';
import { volume, disposeScene } from '../vol.js';
import { C } from '../astro.js';
import { createStarfield } from '../stars.js';
import { lightCylinder, julianDate } from '../astro.js';
import { NOISE, SKY_VERTEX } from '../glsl.js';

const R_NS = 13;
// Periode heute aus ATNF (P = 33,3924 ms bei MJD 48442,5; Ṗ = 4,2097·10⁻¹³) – eigene Rechnung ohne Bremsindex
const P_NOW = (date) => 0.0333924123 + 4.20972e-13 * ((julianDate(date) - 2400000.5 - 48442.5) * 86400);
const ALPHA = 45 * Math.PI / 180;

const BEAM_BODY = /* glsl */ `
uniform vec3 uM;       // Magnetachse (Welt)
uniform float uGain;
void sampleVol(vec3 p, out vec3 e, out float s) {
  float r = length(p);
  s = 0.0;
  if (r < 13.5) { e = vec3(0.0); return; }
  vec3 d = p / r;
  float c = dot(d, uM);
  float ang = acos(clamp(abs(c), 0.0, 1.0));
  float main = c > 0.0 ? 1.0 : 0.6;
  // hohler Kegel: Ring bei 7°, Kern schwächer
  float cone = exp(-pow((ang - 0.12) / 0.06, 2.0)) + 0.4 * exp(-pow(ang / 0.05, 2.0));
  float fall = 1.0 / (1.0 + pow(r / 200.0, 1.5));
  e = vec3(0.55, 0.75, 1.0) * cone * fall * main * uGain;
  // Polkappen-Glühen nahe der Oberfläche
  e += vec3(0.6, 0.8, 1.0) * exp(-pow(ang / 0.25, 2.0)) * exp(-(r - 13.0) / 6.0) * 2.0 * uGain;
}
`;

// Oberfläche ≈ 10⁶ K: blauweiß und selbstleuchtend; die Lichtablenkung zeigt mehr als die halbe Kugel, deshalb kaum
// Randverdunkelung. Heiße Polkappen an der Magnetachse, leichte Fleckung der Kruste (dreht mit).
const NS_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uM;
varying vec3 vN, vP, vL;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float mu = max(dot(N, V), 0.0);
  float pa = acos(clamp(abs(dot(N, uM)), 0.0, 1.0));
  float cap = exp(-pow(pa / 0.16, 2.0)), warm = exp(-pow(pa / 0.55, 2.0));
  float mott = 0.82 + 0.18 * fbm(vL * 0.35, 3);
  float limb = 0.85 + 0.55 * pow(1.0 - mu, 2.5);
  vec3 col = vec3(0.6, 0.73, 1.0) * 1.25 * limb * mott + vec3(0.85, 0.92, 1.0) * (cap * 7.0 + warm * 0.7);
  gl_FragColor = vec4(col, 1.0);
}
`;
const NS_VERT = /* glsl */ `
varying vec3 vN, vP, vL;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vL = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
// Lichthof um den Stern (zur Kamera gedreht): weicher Abfall, wird vom Stern selbst verdeckt
const GLOW_FRAG = /* glsl */ `
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0 * 8.0;   // in Sternradien (Fläche 16 R breit)
  float x = max(r - 1.0, 0.0);
  float g = 0.45 * exp(-x / 0.35) + 0.08 / (1.0 + x * x * 0.6);
  gl_FragColor = vec4(vec3(0.62, 0.76, 1.0) * g * smoothstep(8.0, 5.0, r), 1.0);
}
`;

// Himmel im Inneren des Krebsnebels: bläulicher Synchrotron-Schein, rote Filamente am Rand
const NEB_SKY = /* glsl */ `
${NOISE}
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float f = ridged(d * 3.0 + 2.0, 4);
  vec3 col = vec3(0.025, 0.04, 0.075) * (0.6 + 0.6 * fbm(d * 2.5, 4)) + vec3(0.12, 0.025, 0.012) * pow(max(f - 0.6, 0.0) * 2.5, 2.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

const LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() { gl_FragColor = vec4(uColor * vA, 1.0); }
`;
const LINE_VERT = /* glsl */ `
attribute float alpha;
varying float vA;
void main() { vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// Pulsarwind: je Teilchen Richtung + Phase; Ort = Richtung × (R_LC + Weg mod Länge), außen und innen weich ausgeblendet
const WIND_VERT = /* glsl */ `
attribute float phase;
attribute float speed;
uniform float uT, uRlc, uLen, uPx;
varying float vA;
void main() {
  float d = mod(phase * uLen + uT * speed, uLen);
  float r = uRlc * 1.02 + d;
  vec3 p = position * r;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float f = d / uLen;
  vA = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.55, 1.0, f)) * 0.9;
  gl_PointSize = uPx * (1.6 + 1.6 * (1.0 - f));
}
`;
const WIND_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  gl_FragColor = vec4(uColor * vA * exp(-dot(d, d) * 16.0), 1.0);
}
`;
function buildWind(n, rlc) {
  const pos = new Float32Array(n * 3), ph = new Float32Array(n), sp = new Float32Array(n);
  let seed = 3;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let i = 0; i < n; i++) {
    // Richtung: 70 % äquatornah (|sin b| klein … Band ±25°), 15 % je Jet-Kegel (±12° um die Achse)
    const u = rand();
    let th;
    if (u < 0.7) th = Math.PI / 2 + (rand() * 2 - 1) * 0.45 * Math.abs(rand() - 0.5) * 2;
    else th = (u < 0.85 ? 0 : Math.PI) + (rand() * 2 - 1) * 0.2;
    const phi = rand() * Math.PI * 2;
    pos.set([Math.sin(th) * Math.cos(phi), Math.cos(th), Math.sin(th) * Math.sin(phi)], i * 3);
    ph[i] = rand();
    sp[i] = 0.85 + rand() * 0.3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('speed', new THREE.BufferAttribute(sp, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: WIND_VERT, fragmentShader: WIND_FRAG,
    uniforms: { uT: { value: 0 }, uRlc: { value: rlc }, uLen: { value: rlc * 6 }, uPx: { value: 1 }, uColor: { value: new THREE.Color(0.55, 0.72, 1.0) } },
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = 4;
  return p;
}

// Pulsprofil (schematisch nach dem optischen Crab-Profil): Hauptpuls scharf, Zwischenpuls bei 0,4 P schwächer und breiter
const profile = (f) => 0.03 + Math.exp(-(((f - 0.5) / 0.018) ** 2)) + 0.42 * Math.exp(-(((f - 0.9) / 0.03) ** 2)) + 0.06 * Math.exp(-(((f - 0.5) / 0.08) ** 2));

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 40000);
  const P = P_NOW(ctx.date);
  const RLC = lightCylinder(P) / 1e3;
  let slow = 200, phase = 0;

  scene.add(createStarfield({ gain: 0.6, seed: 61, band: 0.4 }));
  const stars = scene.children[0];
  const skyMat = new THREE.ShaderMaterial({ vertexShader: `${SKY_VERTEX}\nvarying vec3 vDir; void main() { vDir = position; gl_Position = skyPosition(normalize(position)); }`, fragmentShader: NEB_SKY, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true });
  const neb = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
  neb.frustumCulled = false;
  neb.renderOrder = -12;
  scene.add(neb);

  const spin = new THREE.Group();
  scene.add(spin);
  const mag = new THREE.Group();
  mag.rotation.z = ALPHA;
  spin.add(mag);
  const mWorld = new THREE.Vector3();

  const nsMat = new THREE.ShaderMaterial({ vertexShader: NS_VERT, fragmentShader: NS_FRAG, uniforms: { uM: { value: mWorld } } });
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(R_NS, 64, 32), nsMat));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(R_NS * 16, R_NS * 16), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: GLOW_FRAG, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  glow.renderOrder = 2;
  scene.add(glow);

  // Feldlinien im Rahmen der Magnetachse (lokal +y): r = L·sin²θ, θ vom Pol gemessen
  const lineMat = (c) => new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, uniforms: { uColor: { value: new THREE.Color(c) } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const closed = lineMat(0x6fb6ff), open = lineMat(0xb08cff);
  const Ls = [22, 34, 52, 80, 130, 220, 380, 650, 1050, RLC * 0.97];
  for (const L of Ls) {
    const th0 = Math.asin(Math.sqrt(R_NS / L));
    for (let k = 0; k < 8; k++) {
      const phi = (k / 8) * Math.PI * 2 + (L % 7) * 0.1;
      const pts = [], al = [];
      for (let i = 0; i <= 160; i++) {
        const th = th0 + (Math.PI - 2 * th0) * (i / 160);
        const r = L * Math.sin(th) ** 2;
        pts.push(r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi));
        al.push((0.5 + 0.5 * Math.sin(th)) * (L === Ls[Ls.length - 1] ? 1.1 : 0.55) * Math.min(1, 90 / L + 0.25));
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.setAttribute('alpha', new THREE.Float32BufferAttribute(al, 1));
      mag.add(new THREE.Line(g, closed));
    }
  }
  // offene Feldlinien: vom Polkappenrand dem Dipol folgend bis nahe R_LC, dann hinaus und gegen die Drehung zurückgebogen
  for (const pole of [1, -1]) {
    for (let k = 0; k < 10; k++) {
      const phi = (k / 10) * Math.PI * 2;
      const L = RLC * (1.4 + (k % 3) * 0.8);
      const th0 = Math.asin(Math.sqrt(R_NS / L));
      const pts = [], al = [];
      for (let i = 0; i <= 120; i++) {
        const f = i / 120;
        const th = th0 + f * 0.9 * (Math.asin(Math.sqrt(Math.min(1, RLC / L))) - th0);
        const r = L * Math.sin(th) ** 2;
        const out = Math.max(0, f - 0.85) * 18 * RLC;
        const rr = r + out;
        const sw = out / RLC * 0.6;
        pts.push(rr * Math.sin(th) * Math.cos(phi + sw), pole * rr * Math.cos(th), rr * Math.sin(th) * Math.sin(phi + sw));
        al.push(0.45 * (1 - f * 0.6));
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.setAttribute('alpha', new THREE.Float32BufferAttribute(al, 1));
      mag.add(new THREE.Line(g, open));
    }
  }

  // Schrittweite wächst mit dem Abstand (der Kegel wird nach außen breiter) – sonst verfehlen die Strahlen den schmalen Kegel am Stern
  const beams = volume({ radius: 1400, body: BEAM_BODY, adapt: 0.07 - 0.025 * ctx.detail, minStep: 1.5, maxSteps: 200, uniforms: { uM: { value: mWorld }, uGain: { value: 0.07 } } });
  beams.renderOrder = 3;
  scene.add(beams);

  // Lichtzylinder: Ringe oben, unten, in der Mitte + senkrechte Striche (dreht nicht mit)
  const lc = new THREE.Group();
  const ring = (y, a) => {
    const pts = [], al = [];
    for (let i = 0; i <= 256; i++) { const t = (i / 256) * Math.PI * 2; pts.push(Math.cos(t) * RLC, y, Math.sin(t) * RLC); al.push(a); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('alpha', new THREE.Float32BufferAttribute(al, 1));
    return new THREE.Line(g, lineMat(0xf3b552));
  };
  [-1400, 0, 1400].forEach((y) => lc.add(ring(y, y ? 0.2 : 0.16)));
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([Math.cos(t) * RLC, -1400, Math.sin(t) * RLC, Math.cos(t) * RLC, 1400, Math.sin(t) * RLC], 3));
    g.setAttribute('alpha', new THREE.Float32BufferAttribute([0.02, 0.02], 1));
    lc.add(new THREE.Line(g, lineMat(0xf3b552)));
  }
  scene.add(lc);
  const wind = buildWind(Math.round(5000 * ctx.detail) + 1500, RLC);
  scene.add(wind);
  let windT = 0;

  // ---------- Ton: echter Takt (Hauptpuls + Zwischenpuls bei 0,4 P) ----------
  let audio = null;
  function sound(on) {
    if (audio) { audio.close(); audio = null; }
    if (!on) return;
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const n = Math.round(P * ac.sampleRate);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    const pulse = (t0, amp, w) => { for (let i = 0; i < n; i++) { const t = i / ac.sampleRate - t0; d[i] += amp * Math.exp(-(t * t) / (2 * w * w)) * (Math.random() * 2 - 1); } };
    pulse(0.003, 0.9, 0.0007);
    pulse(0.003 + 0.4 * P, 0.4, 0.0009);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ac.createGain();
    g.gain.value = 0.22;
    src.connect(g).connect(ac.destination);
    src.start();
    audio = ac;
  }

  const base = { beam: new THREE.Vector3(0, 260, 0), field: new THREE.Vector3(52 * Math.sin(1) ** 3, 52 * Math.sin(1) ** 2 * Math.cos(1), 0), cap: new THREE.Vector3(0, R_NS * 1.02, 0), inter: new THREE.Vector3(0, -200, 0) };
  const hotspots = [
    { id: 'star', kind: 'info', pos: new THREE.Vector3(0, R_NS, 0) },
    { id: 'beam', kind: 'info', pos: new THREE.Vector3() },
    { id: 'field', kind: 'info', pos: new THREE.Vector3() },
    { id: 'lc', kind: 'info', pos: new THREE.Vector3(RLC * 0.7071, 0, RLC * 0.7071) },
    { id: 'wind', kind: 'info', pos: new THREE.Vector3(RLC * 2.2, RLC * 0.25, RLC * 1.1) },
    { id: 'polecap', kind: 'info', pos: new THREE.Vector3() },
    { id: 'interpulse', kind: 'info', pos: new THREE.Vector3() },
  ];
  // Lichtkurve in der Infotafel: Profil als Pfad, Phasenmarke läuft mit der Drehung (Hauptpuls, wenn die Magnetachse
  // zur Erde = +z zeigt)
  const W = 300, H = 64;
  const curve = Array.from({ length: 121 }, (_, i) => { const f = i / 120; return `${(f * W).toFixed(1)},${(H - 6 - profile(f) * (H - 12)).toFixed(1)}`; }).join(' ');
  const widget = () => `<svg viewBox="0 0 ${W} ${H}" aria-label="Lichtkurve des Crab-Pulsars"><polyline points="${curve}" fill="none" stroke="#9cc8ff" stroke-width="1.6"/><line id="w-ph" x1="0" x2="0" y1="4" y2="${H - 4}" stroke="#f3b552" stroke-width="1.6"/><circle id="w-dot" cx="0" cy="${H - 6}" r="3" fill="#f3b552"/></svg><div class="w-cap"><span>Lichtkurve · Hauptpuls</span><span>Zwischenpuls bei 0,4 P</span></div>`;
  let lastPh = -1;
  const controls = [
    { id: 'slow', label: 'Zeitlupe', value: '200', options: [['600', '1 : 600'], ['200', '1 : 200'], ['60', '1 : 60']], set: (v) => { slow = +v; } },
    { id: 'sound', label: 'Ton', value: 'off', options: [['off', 'Aus'], ['on', 'Echter Takt']], set: (v) => sound(v === 'on') },
  ];

  return {
    scene, camera, unit: 1e3, hotspots, controls,
    home: { pos: new THREE.Vector3(70, 38, 150), target: new THREE.Vector3(0, 0, 0) },
    orbit: { minDistance: 30, maxDistance: 9000, cineSpeed: 0.4 },
    look: { exposure: 1.0, bloom: 0.12, sat: 1.05, con: 0.12, sh: [0.95, 0.98, 1.08] },
    update(dt, t, cam, flying) {
      phase += (dt / (P * slow)) * Math.PI * 2;
      spin.rotation.y = phase;
      glow.quaternion.copy(cam.quaternion);
      spin.updateMatrixWorld();
      mWorld.set(0, 1, 0).applyQuaternion(mag.getWorldQuaternion(new THREE.Quaternion()));
      hotspots[1].pos.copy(base.beam).applyMatrix4(mag.matrixWorld);
      hotspots[2].pos.copy(base.field).applyMatrix4(mag.matrixWorld);
      hotspots[5].pos.copy(base.cap).applyMatrix4(mag.matrixWorld);
      hotspots[6].pos.copy(base.inter).applyMatrix4(mag.matrixWorld);
      beams.material.uniforms.uTime.value = t;
      // Wind: ≈ c in derselben Zeitlupe wie die Drehung (Weg in km je Sekunde Echtzeit / slow)
      windT += dt * (C / 1e3) / slow;
      wind.material.uniforms.uT.value = windT;
      // Nahebene mit dem Abstand (Stern 13 km bis Lichtzylinder 1.600 km)
      const near = Math.max(0.2, cam.position.length() * 0.01);
      if (Math.abs(near - camera.near) / camera.near > 0.1) { camera.near = near; camera.updateProjectionMatrix(); }
      if (flying && audio) { /* Ton bleibt, bis er ausgeschaltet wird */ }
    },
    live: () => `Echte Periode ${(P * 1e3).toFixed(2).replace('.', ',')} ms · hier eine Umdrehung in ${(P * slow).toFixed(1).replace('.', ',')} s · Lichtzylinder ${Math.round(RLC).toLocaleString('de-DE')} km`,
    widget,
    widgetTick(el) {
      // Phase 0,5 = Magnetachse zeigt zur Erde (+z) → Hauptpuls
      const az = Math.atan2(mWorld.x, mWorld.z);
      const f = ((az / (2 * Math.PI)) % 1 + 1.5) % 1;
      if (Math.abs(f - lastPh) < 0.002) return;
      lastPh = f;
      const x = (f * W).toFixed(1), y = (H - 6 - profile(f) * (H - 12)).toFixed(1);
      const ph = el.querySelector('#w-ph'), dot = el.querySelector('#w-dot');
      if (ph) { ph.setAttribute('x1', x); ph.setAttribute('x2', x); }
      if (dot) { dot.setAttribute('cx', x); dot.setAttribute('cy', y); }
    },
    setPixelRatio(pr) { stars.userData.setPixelRatio(pr); wind.material.uniforms.uPx.value = pr; },
    dispose() { sound(false); disposeScene(scene); },
  };
}
