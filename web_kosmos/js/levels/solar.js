// Station 2: Sonnensystem (Einheit 1 AE). Planeten an den Orten von heute aus den JPL-Bahnelementen, Bahnen als echte
// Ellipsen (Exzentrizität, Neigung, Knoten) mit Leuchtspur hinter dem Planeten; Polachsen nach IAU/WGCCRE (Rektaszension,
// Deklination des Nordpols J2000). Asteroidengürtel mit Kirkwood-Lücken (3:1, 5:2, 7:3), Hilda-Gruppe (3:2), Jupiter-
// Trojaner an L4/L5 und Kuipergürtel mit Plutinos (3:2 zu Neptun) laufen nach Kepler im Vertex-Shader.
// Größen: „Anschaulich“ = R^0,45 gestaucht (Reihenfolge stimmt, Verhältnisse nicht), „Echt“ = wahre Radien.

import * as THREE from 'three';
import { PLANETS, AU, julianDate, elementsAt, solveKepler, orbitToEcliptic, eclToScene, eclDir, OBLIQUITY, mulberry32, gauss } from '../astro.js';
import { createStarfield } from '../stars.js';

const RAD = Math.PI / 180;
const AU_KM = AU / 1e3;
// Radien [km] (NASA Fact Sheets, äquatorial), Rotationsperiode [h] (negativ = rückläufig), Nordpol α/δ [°] (IAU WGCCRE 2015)
const BODY = {
  mercury: { r: 2439.7, rot: 1407.6, pole: [281.01, 61.41], tex: 'mercury.jpg', dot: 0xc9c2b8 },
  venus: { r: 6051.8, rot: -5832.5, pole: [272.76, 67.16], tex: 'venus_atmosphere.jpg', dot: 0xf2dca8 },
  earth: { r: 6378.1, rot: 23.934, pole: [0, 90], tex: 'earth_daymap.jpg', dot: 0x79b2ff },
  mars: { r: 3396.2, rot: 24.623, pole: [317.68, 52.89], tex: 'mars.jpg', dot: 0xe07a50 },
  jupiter: { r: 71492, rot: 9.925, pole: [268.06, 64.50], tex: 'jupiter.jpg', dot: 0xe2c193 },
  saturn: { r: 60268, rot: 10.656, pole: [40.59, 83.54], tex: 'saturn.jpg', dot: 0xead7a2 },
  uranus: { r: 25559, rot: -17.24, pole: [257.31, -15.18], tex: 'uranus.jpg', dot: 0xb3e6ec },
  neptune: { r: 24764, rot: 16.11, pole: [299.36, 43.46], tex: 'neptune.jpg', dot: 0x6d8ff0 },
};
const SUN_R = 695700, SUN_POLE = [286.13, 63.87];
// Saturnringe: C-Ring innen 74.658 km bis A-Ring außen 136.775 km (NASA Saturnian Rings Fact Sheet)
const RING_IN = 74658, RING_OUT = 136775;
const visR = (km, real) => (real ? km / AU_KM : 0.012 * Math.pow(km / 6371, 0.45));

// Äquatorial (α, δ) → Szene (über die Ekliptik)
function poleDir([ra, dec]) {
  const e = OBLIQUITY * RAD;
  const x = Math.cos(dec * RAD) * Math.cos(ra * RAD), y = Math.cos(dec * RAD) * Math.sin(ra * RAD), z = Math.sin(dec * RAD);
  return new THREE.Vector3(...eclToScene([x, y * Math.cos(e) + z * Math.sin(e), -y * Math.sin(e) + z * Math.cos(e)])).normalize();
}

const ORBIT_VERT = /* glsl */ `
attribute float mfrac;
uniform float uPhase;
varying float vA;
void main() {
  float d = fract(uPhase - mfrac);
  vA = 0.16 + 0.84 * pow(1.0 - d, 12.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const ORBIT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
varying float vA;
void main() { gl_FragColor = vec4(uColor * vA * uGain, 1.0); }
`;

// Kleinkörper: Bahnelemente je Punkt, Ort nach Kepler zur Zeit uDays (Tage seit Start)
const BELT_VERT = /* glsl */ `
attribute vec4 el;    // a [AE], e, i [rad], Ω [rad]
attribute vec2 el2;   // ω [rad], M0 [rad]
attribute float bright;
uniform float uDays, uPx;
varying float vB;
void main() {
  float a = el.x, e = el.y;
  float M = el2.y + uDays * 0.0172021 / (a * sqrt(a));
  float E = M;
  for (int k = 0; k < 5; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  float xp = a * (cos(E) - e), yp = a * sqrt(1.0 - e * e) * sin(E);
  float co = cos(el2.x), so = sin(el2.x), cO = cos(el.w), sO = sin(el.w), cI = cos(el.z), sI = sin(el.z);
  vec3 ecl = vec3((co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
                  (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
                  so * sI * xp + co * sI * yp);
  vec4 mv = modelViewMatrix * vec4(ecl.x, ecl.z, -ecl.y, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * 1.6;
  vB = bright;
}
`;
const BELT_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vB;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  gl_FragColor = vec4(uColor * vB * exp(-dot(d, d) * 14.0), 1.0);
}
`;

// Planet als Lichtpunkt, solange die Kugel kleiner als ein paar Pixel ist
const DOT_VERT = /* glsl */ `
attribute vec3 color;
attribute float radius;
uniform float uProj, uPx;
varying vec3 vCol;
varying float vFade;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float rp = radius * uProj / max(-mv.z, 1e-6);
  vFade = 1.0 - smoothstep(2.0, 5.0, rp);
  gl_PointSize = uPx * 7.0;
  vCol = color;
}
`;
const DOT_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vFade;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  gl_FragColor = vec4(vCol * (exp(-r2 * 60.0) * 3.0 + exp(-r2 * 10.0) * 0.25) * vFade, 1.0);
}
`;

const SUN_VERT = /* glsl */ `
varying vec3 vN, vP;
varying vec2 vUv;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const SUN_FRAG = /* glsl */ `
uniform sampler2D tSun;
uniform float uGain;
varying vec3 vN, vP;
varying vec2 vUv;
void main() {
  float mu = max(dot(normalize(vN), normalize(cameraPosition - vP)), 0.0);
  // Randverdunkelung, lineares Gesetz mit u ≈ 0,6 im Sichtbaren
  float ld = 1.0 - 0.6 * (1.0 - mu);
  vec3 t = texture2D(tSun, vUv).rgb;
  gl_FragColor = vec4(vec3(1.0, 0.93, 0.82) * (0.75 + 0.5 * t.r) * ld * uGain, 1.0);
}
`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,240,220,1)');
  grd.addColorStop(0.12, 'rgba(255,214,160,0.55)');
  grd.addColorStop(0.35, 'rgba(255,170,90,0.12)');
  grd.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.0005, 600);
  const jd0 = julianDate(ctx.date);
  let jd = jd0, rate = 1, real = false;

  scene.add(createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.8, seed: 23 }));
  const stars = scene.children[0];
  scene.add(new THREE.PointLight(0xfff4e8, 3.3, 0, 0));
  scene.add(new THREE.AmbientLight(0x223044, 0.05));

  // ---------- Sonne ----------
  const sunMat = new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms: { tSun: { value: ctx.tex('sun.jpg') }, uGain: { value: 14 } } });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), sunMat);
  sun.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleDir(SUN_POLE));
  scene.add(sun);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(1.6, 1.4, 1.2) }));
  scene.add(corona);

  // ---------- Planeten ----------
  const planets = PLANETS.map((p) => {
    const b = BODY[p.id];
    const tilt = new THREE.Group();
    tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleDir(b.pole));
    const mat = new THREE.MeshStandardMaterial({ map: ctx.tex(b.tex), roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
    tilt.add(mesh);
    const holder = new THREE.Group();
    holder.add(tilt);
    scene.add(holder);
    let ring = null;
    if (p.id === 'saturn') {
      const g = new THREE.RingGeometry(RING_IN / b.r, RING_OUT / b.r, 256, 1);
      const pos = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        uv.setXY(i, (v.length() - RING_IN / b.r) / ((RING_OUT - RING_IN) / b.r), 0.5);
      }
      g.rotateX(-Math.PI / 2);
      ring = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: ctx.tex('saturn_ring_alpha.png'), transparent: true, side: THREE.DoubleSide, roughness: 1, metalness: 0, depthWrite: false }));
      tilt.add(ring);
    }
    // Bahn: Ellipse aus den Elementen, Parameter = mittlere Anomalie (für die Leuchtspur)
    const el = elementsAt(p, jd0);
    const N = 720, pts = new Float32Array((N + 1) * 3), mf = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const E = (i / N) * Math.PI * 2;
      pts.set(eclToScene(orbitToEcliptic(el, E)), i * 3);
      mf[i] = ((E - el.e * Math.sin(E)) / (Math.PI * 2) + 1) % 1;
    }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    og.setAttribute('mfrac', new THREE.BufferAttribute(mf, 1));
    const om = new THREE.ShaderMaterial({ vertexShader: ORBIT_VERT, fragmentShader: ORBIT_FRAG, uniforms: { uPhase: { value: 0 }, uColor: { value: new THREE.Color(b.dot) }, uGain: { value: 0.9 } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const orbit = new THREE.Line(og, om);
    scene.add(orbit);
    return { p, b, holder, tilt, mesh, ring, om, pos: new THREE.Vector3() };
  });

  // Lichtpunkte der Planeten
  const dotG = new THREE.BufferGeometry();
  dotG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(planets.length * 3), 3));
  dotG.setAttribute('color', new THREE.BufferAttribute(new Float32Array(planets.flatMap((x) => new THREE.Color(x.b.dot).toArray())), 3));
  dotG.setAttribute('radius', new THREE.BufferAttribute(new Float32Array(planets.length), 1));
  const dotMat = new THREE.ShaderMaterial({ vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, uniforms: { uProj: { value: 500 }, uPx: { value: 1 } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const dots = new THREE.Points(dotG, dotMat);
  dots.frustumCulled = false;
  scene.add(dots);

  // ---------- Kleinkörper ----------
  const rand = mulberry32(5);
  const ray = (s) => Math.abs(gauss(rand)) * s;   // Rayleigh-ähnlich
  function belt(n, pick, color, gain) {
    const el = new Float32Array(n * 4), el2 = new Float32Array(n * 2), br = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const o = pick(i);
      el.set([o.a, o.e, o.i, o.node ?? rand() * Math.PI * 2], i * 4);
      el2.set([o.w ?? rand() * Math.PI * 2, o.M ?? rand() * Math.PI * 2], i * 2);
      br[i] = (0.35 + rand() * 0.65) * gain;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('el', new THREE.BufferAttribute(el, 4));
    g.setAttribute('el2', new THREE.BufferAttribute(el2, 2));
    g.setAttribute('bright', new THREE.BufferAttribute(br, 1));
    const m = new THREE.ShaderMaterial({ vertexShader: BELT_VERT, fragmentShader: BELT_FRAG, uniforms: { uDays: { value: 0 }, uPx: { value: 1 }, uColor: { value: new THREE.Color(color) } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    scene.add(pts);
    return m;
  }
  const detail = ctx.detail;
  // Hauptgürtel 2,1–3,3 AE, Lücken bei den Jupiter-Resonanzen ausgedünnt
  const gaps = [2.502, 2.825, 2.958, 3.279];
  const mainA = () => {
    for (;;) {
      const a = 2.1 + rand() * 1.2;
      const g = Math.min(...gaps.map((x) => Math.abs(a - x)));
      if (g > 0.03 || rand() < g / 0.03 * 0.25) return a;
    }
  };
  const jup = elementsAt(PLANETS[4], jd0);
  const beltMats = [
    belt(Math.round(9000 * detail), () => ({ a: mainA(), e: ray(0.08), i: ray(0.12) }), 0xd8c8b0, 0.55),
    belt(Math.round(700 * detail), () => ({ a: 3.97 + gauss(rand) * 0.03, e: 0.1 + ray(0.06), i: ray(0.1) }), 0xd8c8b0, 0.5),
    // Trojaner: mittlere Länge 60° vor bzw. hinter Jupiter, gleiche Halbachse
    belt(Math.round(1600 * detail), (i) => {
      const lead = i % 2 ? 60 : -60;
      const node = rand() * Math.PI * 2, w = rand() * Math.PI * 2;
      const L = (jup.L + lead + gauss(rand) * 12) * RAD;
      return { a: 5.2 + gauss(rand) * 0.05, e: ray(0.06), i: ray(0.2), node, w, M: L - node - w };
    }, 0xc8b8a0, 0.5),
    belt(Math.round(4500 * detail), (i) => (i % 5 === 0
      ? { a: 39.4 + gauss(rand) * 0.25, e: 0.1 + ray(0.08), i: ray(0.2) }
      : { a: 42 + rand() * 6, e: ray(0.05), i: ray(0.08) }), 0xa8c0e0, 0.5),
  ];
  // Hilda/Trojaner/Kuiper laufen mit Jupiter mit: Startphase so, dass die Trojaner zu Jupiter passen
  const days = () => jd - jd0;

  // ---------- Größen ----------
  function applySizes() {
    sun.scale.setScalar(visR(SUN_R, real));
    corona.scale.setScalar(visR(SUN_R, real) * 9);
    const rad = dotG.attributes.radius;
    planets.forEach((x, i) => { const r = visR(x.b.r, real); x.mesh.scale.setScalar(r); if (x.ring) x.ring.scale.setScalar(r); rad.setX(i, r); });
    rad.needsUpdate = true;
  }
  applySizes();

  function place() {
    const dp = dotG.attributes.position;
    planets.forEach((x, i) => {
      const el = elementsAt(x.p, jd);
      const E = solveKepler(el.M * RAD, el.e);
      x.pos.set(...eclToScene(orbitToEcliptic(el, E)));
      x.holder.position.copy(x.pos);
      x.mesh.rotation.y = ((jd - 2451545) * 24 / x.b.rot) % 1 * Math.PI * 2;
      x.om.uniforms.uPhase.value = ((el.M / 360) % 1 + 1) % 1;
      dp.setXYZ(i, x.pos.x, x.pos.y, x.pos.z);
    });
    dp.needsUpdate = true;
    beltMats.forEach((m) => { m.uniforms.uDays.value = days(); });
  }
  place();

  const P = Object.fromEntries(planets.map((x) => [x.p.id, x]));
  const home = { pos: new THREE.Vector3(-3.2, 4.4, 7.4), target: new THREE.Vector3(0, 0, 0) };
  const camDir = home.pos.clone().setY(0).normalize();
  const onBelt = (r) => camDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5).multiplyScalar(r);
  const focus = (x) => () => Math.max(visR(x.b.r, real) * 7, 2e-5);
  const hotspots = [
    { id: 'sun', kind: 'info', pos: new THREE.Vector3(), focus: () => visR(SUN_R, real) * 6 },
    { id: 'earth', kind: 'dive', to: 'earth', pos: P.earth.pos },
    { id: 'jupiter', kind: 'info', pos: P.jupiter.pos, focus: focus(P.jupiter) },
    { id: 'saturn', kind: 'info', pos: P.saturn.pos, focus: () => visR(P.saturn.b.r, real) * 9 },
    { id: 'belt', kind: 'info', pos: onBelt(2.75) },
    { id: 'kuiper', kind: 'info', pos: onBelt(44) },
    ...['mercury', 'venus', 'mars', 'uranus', 'neptune'].map((id) => ({ id, kind: 'label', pos: P[id].pos, focus: focus(P[id]) })),
  ];

  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' });
  const controls = [
    { id: 'size', label: 'Größen', value: 'vis', options: [['vis', 'Anschaulich'], ['real', 'Echt']], set: (v) => { real = v === 'real'; applySizes(); } },
    { id: 'time', label: 'Zeit', value: 'day', options: [['now', 'Jetzt'], ['day', '1 Tag/s'], ['month', '1 Monat/s'], ['year', '1 Jahr/s']],
      set: (v) => { rate = { now: 0, day: 1, month: 30.44, year: 365.25 }[v]; if (!rate) jd = julianDate(new Date()); } },
  ];

  return {
    scene, camera, home, unit: AU, hotspots, controls,
    orbit: { minDistance: 0.05, maxDistance: 160, cineSpeed: 0.6 },
    look: { exposure: 1.0, bloom: 0.07 },
    update(dt, t, cam, flying) {
      if (!flying) jd += dt * rate;
      place();
      // im Flug von bzw. zur Erde: Sonne höchstens ≈ 2,5° Radius – sonst füllt die anschaulich vergrößerte Sonne das Bild
      const sr = Math.min(visR(SUN_R, real), flying && !real ? cam.position.distanceTo(sun.position) * 0.045 : Infinity);
      if (sun.scale.x !== sr) { sun.scale.setScalar(sr); corona.scale.setScalar(sr * 9); }
      // Nah- und Fernebene mit dem Abstand: von 10.000 km vor einem Planeten bis zum Kuipergürtel ohne Flimmern
      const d = cam.position.length() > 0 ? Math.min(cam.position.distanceTo(sun.position), ...planets.map((x) => cam.position.distanceTo(x.pos))) : 1;
      const near = Math.min(0.05, Math.max(2e-6, d * 0.02));
      if (Math.abs(near - camera.near) / camera.near > 0.05) { camera.near = near; camera.updateProjectionMatrix(); }
      const H = ctx.renderer.domElement.height;
      dotMat.uniforms.uProj.value = (H / 2) / Math.tan((camera.fov * RAD) / 2);
    },
    live: () => `Planetenstand ${fmt.format(new Date((jd - 2440587.5) * 864e5))}${rate ? ' · Zeitraffer' : ' · jetzt'}`,
    setPixelRatio(pr) {
      stars.userData.setPixelRatio(pr);
      dotMat.uniforms.uPx.value = pr;
      beltMats.forEach((m) => { m.uniforms.uPx.value = pr; });
    },
    dispose() { scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); },
  };
}
