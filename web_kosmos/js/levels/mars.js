// Station 02E: Mars & Monde (Einheit 1 Marsradius = 3.396,2 km), Abstecher vom Sonnensystem. Mars als abgeplattetes
// Ellipsoid mit der Textur von Solar System Scope, gedreht nach dem Nullmeridian der IAU (Olympus Mons steht zur richtigen
// Zeit an der richtigen Stelle), Sonnenrichtung aus der JPL-Bahn. Jahreszeit Ls (martian.js) mit Regler: Sonnenstand und
// jahreszeitliche Polkappen aus CO₂-Reif (Modell bis ≈ 55° Breite im späten Winter). Staubsturm-Regler: Dunstschicht über
// dem Boden (Herd wächst bis zum ganzen Planeten), Kontrast sinkt, Rand-Dunst wird dichter und rötlich (Modell).
// Phobos und Deimos als unregelmäßige Körper (Modell nach den Halbachsen des Fact Sheets) auf den JPL-Bahnen, gebunden
// gedreht; ihre Schatten auf Mars mit dem echten Radius, im Marsschatten verfinstert.
// createMars und moonShape nutzen auch die Mond-Stationen phobos (02E1) und deimos (02E2) (Mars am Himmel, Körper).

import * as THREE from 'three';
import { julianDate, eclDir, laplaceAxes, mulberry32, hideBehind } from '../astro.js';
import { createStarfield } from '../stars.js';
import { BODY_VERT, SHELL_VERT, PLANET_FRAG, ATMO_FRAG, ATMOS } from '../planetfx.js';
import { NOISE } from '../glsl.js';
import { registerLayers, refreshLayers } from '../layers.js';
import { moonOrbit, tidalQuat } from '../moonsys.js';
import { ellipsoidGeometry, bodyUniforms, colorTexture } from './saturn.js';
import { makeNoise, craterProfile, icoIndexed } from './asteroid.js';
import { MARS, MOONS, MOON_IDS, POLE, NODE, marsState, marsSpin, lsToJd, seasonNorth, capEdge } from '../martian.js';
import { spinAxis } from '../axes.js';

export const R = MARS.r;
const RAD = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
// Zeitraffer [Tage je Sekunde]
const SPEEDS = [[0, 'Stopp'], [1 / 1440, '1 min/s'], [1 / 144, '10 min/s'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [4, '4 Tage/s'], [20, '20 Tage/s']];
// Farben der Monde (Albedo 0,07 bzw. 0,08 nach NSSDCA, leicht rötlich-grau; Darstellung)
export const MOON_COL = { phobos: 0x4d4642, deimos: 0x574b42 };
const ORBIT_COL = { phobos: 0xd9b7a0, deimos: 0xc9b8a8 };
const VIS = 20;   // „Anschaulich“: Monde 20-fach vergrößert
const fmtDeg = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
// Breite/Länge [°, Ost positiv] → Richtung im Körper (Länge 0 bei +x, Osten = −z wie die Karten)
export const dirLL = (lat, lon, out = new THREE.Vector3()) => out.set(Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.sin(lat * RAD), -Math.cos(lat * RAD) * Math.sin(lon * RAD));

// Jahreszeitliche Polkappen: Reif von der bleibenden Kappe bis zur Grenzbreite (uN/uS = Sinus), Rand ausgefranst, zur Grenze
// hin dünner; beleuchtet wie der Boden (Modell)
const CAP_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform float uN, uS, uWrap;
varying vec3 vN, vP, vO;
varying vec2 vUv;
${NOISE}
void main() {
  vec3 d = normalize(vO);
  float s = d.y + fbm(d * 9.0, 3) * 0.035;
  float e = max(smoothstep(uN - 0.015, uN + 0.01, s), smoothstep(uS - 0.015, uS + 0.01, -s));
  float thick = max(smoothstep(uN, uN + 0.1, s), smoothstep(uS, uS + 0.1, -s));
  float a = e * (0.32 + 0.48 * thick);
  if (a < 0.003) discard;
  float lit = clamp((dot(normalize(vN), uSunDir) + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  vec3 col = vec3(0.82, 0.8, 0.78) * lit * (0.88 + 0.24 * fbm(d * 30.0, 2));
  gl_FragColor = vec4(col, a);
}
`;
// Staubsturm: Dunstschicht knapp über dem Boden. Der Herd (uC, Körperkoordinaten) wächst mit dem Regler vom Fleck bis zum
// ganzen Planeten, Wolkenfelder aus Rauschen ziehen langsam; am Rand dichter (langer Weg durch die Schicht). Modell.
const DUST_FRAG = /* glsl */ `
uniform vec3 uSunDir, uC;
uniform float uDust, uTime, uWrap;
varying vec3 vN, vP, vO;
varying vec2 vUv;
${NOISE}
void main() {
  vec3 d = normalize(vO), N = normalize(vN), V = normalize(cameraPosition - vP);
  float w = uTime * 0.012;
  float n = fbm(d * 2.4 + vec3(w, 0.0, -w * 0.6), 4), n2 = fbm(d * 7.5 + n * 2.0 + vec3(0.0, w, 0.0), 3);
  float ang = acos(clamp(dot(d, uC), -1.0, 1.0)), rad = mix(0.15, 3.8, uDust);
  float mask = 1.0 - smoothstep(rad * 0.55, rad, ang + n * 0.7);
  float cov = mask * smoothstep(-0.3, 0.25, n + n2 * 0.45 + uDust * 0.55);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float a = min(cov * mix(0.5, 0.9, uDust) * (1.0 + rim * 0.5), 0.96);
  if (a < 0.003) discard;
  float lit = clamp((dot(N, uSunDir) + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  vec3 col = vec3(0.62, 0.32, 0.14) * lit * (0.82 + 0.36 * n2);
  gl_FragColor = vec4(col, a);
}
`;
const DUST_C = dirLL(-30, 40);   // Herd des Modells im Süden zwischen Noachis und Hellas (frei gewählt)

// Mars (lokal: +y Nordpol, x = Knoten des Äquators = Nullmeridian bei W = 0; Einheit 1 = Äquatorradius). group in die Szene
// hängen, verschieben und skalieren erlaubt; frame(sunDir, jd, ls, occ, sunAng, t) je Bild (occ: Vector4 Mitte + Radius, Weltmaß)
export function createMars(ctx, { seg = 160, sky = false } = {}) {
  const group = new THREE.Group(), spin = new THREE.Group();
  const P = new THREE.Vector3(...POLE), N = new THREE.Vector3(...NODE);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(N, P, N.clone().cross(P)));
  group.add(spin);
  const a = ATMOS.mars, f = MARS.rp / R;
  const planetU = bodyUniforms(ctx.tex('mars.jpg'), { wrap: a.wrap, term: a.term, amb: 0.02 });
  const planet = new THREE.Mesh(ellipsoidGeometry(1, f, 1, seg, seg / 2), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: planetU }));
  spin.add(planet);
  spinAxis(planet);
  const capU = { uSunDir: planetU.uSunDir, uN: { value: 1 }, uS: { value: 1 }, uWrap: { value: a.wrap } };
  const caps = new THREE.Mesh(ellipsoidGeometry(1.0012, f * 1.0012, 1.0012, seg, seg / 2), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: CAP_FRAG, uniforms: capU, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  spin.add(caps);
  const dustU = { uSunDir: planetU.uSunDir, uC: { value: DUST_C }, uDust: { value: 0 }, uTime: { value: 0 }, uWrap: { value: 0.1 } };
  const dust = new THREE.Mesh(ellipsoidGeometry(1.004, f * 1.004, 1.004, seg, seg / 2), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: DUST_FRAG, uniforms: dustU, transparent: true, depthWrite: false }));
  dust.visible = false;
  spin.add(dust);
  // Atmosphäre als Hülle (planetfx.js); Mitte und Radien in Weltmaß aus der Lage der Gruppe
  const MIE0 = new THREE.Vector3(...a.mieCol), MIE1 = new THREE.Vector3(1.0, 0.62, 0.35);
  const atmoU = {
    uSun: planetU.uSunDir, uCenter: { value: new THREE.Vector3() }, uBeta: { value: new THREE.Vector3(...a.beta) }, uMieCol: { value: MIE0.clone() },
    uRp: { value: 1 }, uRa: { value: a.ra }, uH: { value: a.h }, uGain: { value: a.gain }, uMie: { value: a.mie }, uAir: { value: 0 }, uAirH: { value: 0.2 },
  };
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(a.ra, 96, 48), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: ATMO_FRAG, uniforms: atmoU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  group.add(atmo);
  // Am Himmel einer Mond-Station: ohne Tiefentest in fester Reihenfolge vor dem Mond (Tiefenpuffer über 10.000 km zu grob);
  // der Planet schreibt Tiefe, damit die Bahnlinie dahinter verdeckt bleibt
  if (sky) [planet, caps, dust, atmo].forEach((o, i) => { o.material.depthTest = false; o.renderOrder = -6 + i; });
  let storm = 0;
  const ws = new THREE.Vector3();
  return {
    group, spin, planet, caps, dust, atmo, planetU,
    get storm() { return storm; },
    // Staubsturm 0 = klar … 1 = global: Dunstschicht, Rand-Dunst dichter und rötlicher
    setStorm(v) {
      storm = v;
      dustU.uDust.value = v;
      dust.visible = v > 0.005;
      atmoU.uMie.value = a.mie + 1.4 * v;
      atmoU.uGain.value = a.gain * (1 + 0.8 * v);
      atmoU.uMieCol.value.lerpVectors(MIE0, MIE1, Math.min(1, v * 1.5));
    },
    frame(sunDir, jd, ls, occ = [], sunAng = 0.003, t = 0) {
      spin.rotation.y = marsSpin(jd);
      planetU.uSunDir.value.copy(sunDir);
      planetU.uOccN.value = Math.min(occ.length, 4);
      occ.slice(0, 4).forEach((o, i) => planetU.uOcc.value[i].copy(o));
      planetU.uSunAng.value = sunAng;
      capU.uN.value = Math.sin(capEdge(ls, 1) * RAD);
      capU.uS.value = Math.sin(capEdge(ls, -1) * RAD);
      dustU.uTime.value = t;
      group.updateMatrixWorld(true);
      group.getWorldScale(ws);
      atmoU.uCenter.value.setFromMatrixPosition(group.matrixWorld);
      atmoU.uRp.value = ws.x;
      atmoU.uRa.value = ws.x * a.ra;
    },
    // Punkt auf der Oberfläche (Breite, Länge Ost) in Weltkoordinaten, h = Höhe als Anteil des Radius
    surface(lat, lon, h = 0, out = new THREE.Vector3()) {
      dirLL(lat, lon, out);
      out.y *= f;
      return spin.localToWorld(out.multiplyScalar(1 + h));
    },
    dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); },
  };
}

// Phobos und Deimos als unregelmäßige Körper (Modell, Einheit km): Ellipsoid mit den Halbachsen des Fact Sheets (x zu Mars,
// y Pol, z entlang der Bahn), fBm-Verformung, Krater nach Potenzgesetz; Phobos mit Stickney (Gazetteer: 1° N, 49° W, 9 km),
// Deimos glatter und mit flachen Kratern (Staubmantel). Länge 0° (+x) zu Mars, Osten = −z, +z = Spitze in Flugrichtung.
// surf(lat, lon, h) → Punkt der Oberfläche [km]; aH/aAO = Höhe über der Grundform [km] und Verschattung (Kraterinneres).
export function moonShape(id, detail) {
  const m = MOONS[id], [ax, ay, az] = m.axes, ph = id === 'phobos';
  const rand = mulberry32(ph ? 4011 : 4022), N = makeNoise(ph ? 401 : 402);
  const base = (d, o) => o.copy(d).multiplyScalar(1 / Math.hypot(d.x / ax, d.y / ay, d.z / az));
  const randDir = () => { const z = rand() * 2 - 1, t = rand() * Math.PI * 2, s = Math.sqrt(1 - z * z); return new THREE.Vector3(s * Math.cos(t), z, s * Math.sin(t)); };
  const craters = [];
  const crater = (d, r, depth, floor = -0.7) => craters.push({ c: base(d, new THREE.Vector3()), r, depth: depth * r, floor });
  // Kraterzahl je Radius: viele kleine, wenige große (Radius rMin … rMax km)
  const many = (n, rMin, rMax, slope, depth) => {
    for (let i = 0; i < n; i++) crater(randDir(), rMin * (rMax / rMin) ** (rand() ** slope), depth * (0.7 + 0.6 * rand()), -0.55 - 0.3 * rand());
  };
  let rough, freq;
  if (ph) {
    crater(dirLL(1, -49), 4.5, 0.55, -0.75);   // Stickney: 9 km, Tiefe ≈ 1/5 des Durchmessers (Modell)
    many(90, 0.18, 2.2, 2.2, 0.38);
    rough = 0.85; freq = 0.075;
  } else {
    many(40, 0.15, 1.15, 2.4, 0.05);           // größter Krater ≈ 2,3 km (NASA), vom Staub zum Teil gefüllt
    rough = 0.5; freq = 0.1;
  }
  const b = new THREE.Vector3();
  const shape = (d, o) => {
    base(d, b);
    let h = rough * (N.fbm(b.x * freq, b.y * freq, b.z * freq, 5) + 0.8 * N.fbm(b.x * freq * 0.45 + 7, b.y * freq * 0.45 + 3, b.z * freq * 0.45 + 1, 3)), cav = 0;
    for (const c of craters) {
      const dx = b.x - c.c.x, dy = b.y - c.c.y, dz = b.z - c.c.z, rr = c.r * 1.45, q2 = dx * dx + dy * dy + dz * dz;
      if (q2 > rr * rr) continue;
      const p = craterProfile(Math.sqrt(q2) / c.r, c.floor);
      h += p * c.depth;
      if (p < 0) cav = Math.max(cav, -p);
    }
    const L = b.length();
    o.copy(b).multiplyScalar((L + h) / L);
    return [h, 1 - 0.5 * Math.min(1, cav * 1.3)];
  };
  const sphere = icoIndexed(detail);
  const pos = sphere.attributes.position, n = pos.count;
  const aH = new Float32Array(n), aAO = new Float32Array(n), d = new THREE.Vector3(), o = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const [h, ao] = shape(d, o);
    pos.setXYZ(i, o.x, o.y, o.z);
    aH[i] = h; aAO[i] = ao;
  }
  sphere.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  sphere.setAttribute('aAO', new THREE.BufferAttribute(aAO, 1));
  sphere.computeVertexNormals();
  sphere.computeBoundingSphere();
  const surf = (lat, lon, lift = 0, out = new THREE.Vector3()) => { shape(dirLL(lat, lon), out); return out.multiplyScalar(1 + lift / out.length()); };
  return { geo: sphere, surf };
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 1200);
  scene.add(createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.6, seed: 61, tex: ctx.tex }));
  const stars = scene.children[0];
  const P = new THREE.Vector3(...POLE);
  const jd0 = julianDate(ctx.date);
  let jdBase = jd0, days = 0, spdIdx = 3, playing = !ctx.still, real = false, viewH = 800, t = 0;
  const jd = () => jdBase + days;
  let st = marsState(jd0);
  const sunDir = new THREE.Vector3(...st.sun);

  // ---------- Mars ----------
  const mars = createMars(ctx, { seg: Math.round(128 + 64 * ctx.detail) });
  scene.add(mars.group);

  // ---------- Monde: unregelmäßige Körper, Lommel-Seeliger + Marsschein, im Marsschatten verfinstert ----------
  const T0 = (jd0 - 2451545) / 36525;
  const moons = MOON_IDS.map((id) => {
    const m = MOONS[id];
    const map = colorTexture(MOON_COL[id]);
    const u = bodyUniforms(map, { moon: true, gain: 1.5 });
    u.uOccN.value = 1;
    u.uOcc.value[0].set(0, 0, 0, MARS.rm / R);
    const geo = moonShape(id, Math.round(16 + 12 * ctx.detail)).geo;
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: u }));
    scene.add(mesh);
    spinAxis(mesh);
    // Bahn mit Leuchtspur; Phobos' Beschleunigung als feste Verschiebung zum Startzeitpunkt (über Stunden unmerklich)
    const orbit = moonOrbit({ ...m, M: m.M + m.acc * T0 * T0 }, laplaceAxes(m.ra, m.dec), R, ORBIT_COL[id], jd0, 0.55);
    scene.add(orbit.line);
    return { id, m, mesh, u, map, orbit, pos: mesh.position, k: 1 };
  });
  const M = Object.fromEntries(moons.map((x) => [x.id, x]));
  const applySizes = () => moons.forEach((x) => { x.k = (real ? 1 : VIS) / R; x.mesh.scale.setScalar(x.k); });
  applySizes();
  // Lichtpunkte der Monde (aus der Ferne sichtbar, verblassen, sobald der Körper einige Pixel groß ist)
  const dotG = new THREE.BufferGeometry();
  dotG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(moons.length * 3), 3));
  dotG.setAttribute('color', new THREE.BufferAttribute(new Float32Array(moons.length * 3), 3));
  const glow = glowTexture();
  const dots = new THREE.Points(dotG, new THREE.PointsMaterial({ size: 8, sizeAttenuation: false, map: glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  dots.frustumCulled = false;
  scene.add(dots);

  // ---------- Heimpose: Tagseite schräg von der Seite (Phase ≈ 55°), etwas über dem Äquator auf der Sommerseite ----------
  const sp = sunDir.clone().addScaledVector(P, -sunDir.dot(P)).normalize();
  const el = (st.subLat < 0 ? -1 : 1) * 16 * RAD;
  const dir = sp.clone().applyAxisAngle(P, 55 * RAD).multiplyScalar(Math.cos(el)).addScaledVector(P, Math.sin(el)).normalize();
  const side = new THREE.Vector3().crossVectors(P, dir).normalize();
  const home = { pos: dir.clone().multiplyScalar(6.2), target: side.clone().multiplyScalar(0.7) };

  // ---------- Jahreszeit, Staubsturm, Zeit ----------
  const fmtLs = (ls) => `Ls ${Math.round(ls)}° · ${seasonNorth(ls)} im Norden`;
  const fmtDate = () => new Date((jd() - 2440587.5) * 864e5).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtStorm = (v) => (v < 0.02 ? 'klar' : v < 0.6 ? `regional · ${Math.round(v * 100)} %` : `planetenweit · ${Math.round(v * 100)} %`);
  // Jahreszeit wechseln: Kamera dreht mit der Sonne um die Bahnachse (gleiche Phase), die Tagseite bleibt im Blick
  let turn = null;
  function setLs(ls) {
    const s0 = sunDir.clone();
    jdBase = lsToJd(ls, jd()); days = 0;
    const s1 = new THREE.Vector3(...marsState(jd()).sun);
    turn = new THREE.Quaternion().setFromUnitVectors(s0, s1);
    refreshLayers();
  }
  registerLayers('mars', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Drehung und Umläufe im Zeitraffer', value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, autoplay: !ctx.still, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, p) => { spdIdx = Math.round(i); playing = p; }, get: () => ({ value: spdIdx, playing }),
      status: () => `${fmtDate()} · ${fmtLs(st.ls)} · ${playing ? `Zeitraffer ${SPEEDS[spdIdx][1]}` : 'angehalten'}` },
    { id: 'storm', type: 'range', group: 'Mars', label: 'Staubsturm', value: 0, min: 0, max: 1, step: 0.05, fmt: fmtStorm,
      hint: 'Modell: Staubdunst über dem Boden, der Herd wächst bis zum ganzen Planeten wie 2018; Oberfläche verschwimmt, der Rand wird dichter und rötlich.',
      set: (v) => mars.setStorm(v), get: () => mars.storm },
    { id: 'caps', type: 'toggle', label: 'Jahreszeitliche Polkappen (Modell)', value: true, set: (v) => { mars.caps.visible = v; } },
    { id: 'haze', type: 'toggle', label: 'Dunst am Planetenrand', value: true, set: (v) => { mars.atmo.visible = v; } },
    { id: 'orbits', type: 'toggle', group: 'Monde', label: 'Bahnen von Phobos und Deimos', value: true, set: (v) => { moons.forEach((x) => { x.orbit.line.visible = v; }); } },
  ]);

  // ---------- Infotafel ----------
  const controls = [
    { id: 'season', type: 'range', show: true, label: 'Jahreszeit · Sonnenstand', value: Math.round(st.ls / 5) * 5 % 360, min: 0, max: 355, step: 5, fmt: fmtLs, set: setLs, get: () => Math.round(st.ls / 5) * 5 % 360 },
    { id: 'size', label: 'Größe der Monde', value: 'vis', options: [['vis', 'Anschaulich'], ['real', 'Echt']], set: (v) => { real = v === 'real'; applySizes(); } },
  ];

  // ---------- Abzeichen ----------
  const facing = (p, cam) => p.clone().normalize().dot(cam.position.clone().sub(p).normalize());
  const spot = (id, lat, lon, focus) => {
    const h = { id, kind: 'info', pos: new THREE.Vector3(), focus: () => focus, visible: (cam) => facing(h.pos, cam) > 0.08, lat, lon };
    return h;
  };
  const shadowPos = new THREE.Vector3();
  let shadowOn = false;
  const hs = [
    spot('olympus', 18.65, 226.2, 1.9),
    spot('valles', -13.9, 300.8, 2.3),
    spot('caps', 84, 0, 2.2),
    spot('storms', -30, 40, 2.6),
    { id: 'shadow', kind: 'info', pos: shadowPos, focus: () => 1.6, visible: (cam) => shadowOn && facing(shadowPos, cam) > 0.15 },
    ...moons.map((x) => ({ id: x.id, kind: 'dive', to: x.id, pos: x.pos, focus: () => Math.max(x.mesh.scale.x * x.m.axes[0] * 10, 0.08) })),
  ];
  hideBehind(hs, [{ center: { x: 0, y: 0, z: 0 }, radius: 1 }]);   // Monde und Orte nie hinter Mars

  // ---------- je Bild ----------
  const occ = [new THREE.Vector4(), new THREE.Vector4()];
  const dotC = new THREE.Color(), tmp = new THREE.Vector3(), toM = new THREE.Vector3();
  const fovPx = () => viewH / 2 / Math.tan(camera.fov * Math.PI / 360);
  function place(cam) {
    st = marsState(jd());
    sunDir.set(...st.sun);
    const col = dotG.attributes.color, dp = dotG.attributes.position, k = fovPx();
    moons.forEach((x, i) => {
      x.orbit.update(jd(), x.pos);
      tidalQuat(x.mesh.quaternion, toM.copy(x.pos).negate(), P);
      x.u.uSunDir.value.copy(sunDir);
      x.u.uSunAng.value = st.sunAng;
      // Marsschein: Albedo × (Radius/Abstand)² × beleuchteter Anteil des Mars vom Mond aus (Näherung)
      const d = x.pos.length();
      x.u.uEarthshine.value = MARS.albedo / (d * d) * (1 + tmp.copy(x.pos).normalize().dot(sunDir)) / 2 * 4;
      occ[i].set(x.pos.x, x.pos.y, x.pos.z, x.m.r / R);
      dp.setXYZ(i, x.pos.x, x.pos.y, x.pos.z);
      const px = x.mesh.scale.x * x.m.axes[0] / Math.max(cam.position.distanceTo(x.pos), 1e-6) * k;
      const s = x.pos.dot(sunDir), lit = s > 0 ? 1 : 0.06 + 0.94 * THREE.MathUtils.smoothstep(tmp.copy(x.pos).addScaledVector(sunDir, -s).length(), 0.97, 1.03);
      const c = dotC.set(0xffe6d0).multiplyScalar((1 - THREE.MathUtils.smoothstep(px, 1.5, 5)) * 0.85 * lit);
      col.setXYZ(i, c.r, c.g, c.b);
    });
    col.needsUpdate = true;
    dp.needsUpdate = true;
    mars.frame(sunDir, jd(), st.ls, occ, st.sunAng, t);
    for (const h of hs) if (h.lat !== undefined) mars.surface(h.lat, h.lon, 0.01, h.pos);
    // Schatten von Phobos auf Mars: Strahl vom Mond gegen die Sonne trifft die Kugel
    const p = M.phobos.pos, b = p.dot(sunDir), disc = b * b - p.lengthSq() + 1;
    shadowOn = b > 0 && disc > 0;
    if (shadowOn) shadowPos.copy(p).addScaledVector(sunDir, -(b - Math.sqrt(disc))).multiplyScalar(1.01);
  }
  place({ position: home.pos });

  const look = { exposure: 1.05, bloom: 0.06 };
  return {
    scene, camera, home, unit: R * 1e3, hotspots: hs, controls, look,
    orbit: { minDistance: 0.003, maxDistance: 60, cineSpeed: 0.35 },
    update(dt, tt, cam, flying) {
      t = tt;
      if (!flying && playing) days += dt * SPEEDS[spdIdx][0];
      place(cam);
      // Nahebene mit dem Abstand zur nächsten Oberfläche
      let near = cam.position.length() - 1;
      for (const x of moons) near = Math.min(near, cam.position.distanceTo(x.pos) - x.mesh.scale.x * x.m.axes[0]);
      const nr = THREE.MathUtils.clamp(near * 0.25, 2e-6, 0.5);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
    },
    // Kamera bleibt außerhalb von Mars und den Monden
    orbitUpdate(c) {
      if (turn) {
        for (const v of [c.object.position, c.target]) v.applyQuaternion(turn);
        turn = null;
      }
      const p = c.object.position, r = p.length();
      if (r < 1.02) p.multiplyScalar(1.02 / r);
      for (const x of moons) {
        tmp.copy(p).sub(x.pos);
        const d = tmp.length(), m = x.mesh.scale.x * x.m.axes[0] * 1.1;
        if (d < m) p.copy(x.pos).addScaledVector(tmp.normalize(), m);
      }
    },
    live: () => `${fmtDate()} · ${fmtLs(st.ls)} · Sonne über ${fmtDeg(Math.abs(st.subLat))}° ${st.subLat < 0 ? 'Süd' : 'Nord'}`,
    setPixelRatio(pr, h) { stars.userData.setPixelRatio(pr); if (h) viewH = h; },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      glow.dispose();
      moons.forEach((x) => x.map.dispose());
    },
  };
}
