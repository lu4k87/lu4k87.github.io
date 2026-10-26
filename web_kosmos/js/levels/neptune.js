// Station 02F: Neptun aus der Nähe (Einheit 1 Neptunradius = 24.764 km), Abstecher vom Sonnensystem. Heimpose: Neptun links
// angeschnitten, Licht von der Seite, rechts die schmalen Ringe und die Bahnen der Monde. Neptun: Karte nach Voyager 2 mit dem
// Großen Dunklen Fleck von 1989, Bänder strömen gegeneinander (PLANET_FRAG uBand), Methan-Hülle (ATMO_FRAG). Ringe Galle,
// Le Verrier, Lassell, Arago und Adams (Radien nep-ring) mit den Bögen im Adams-Ring (Bausteine aus moonsys.js); die Bögen
// laufen mit der Kepler-Umlaufzeit des Adams-Rings um (eigene Rechnung aus der Masse). Monde aus den mittleren Elementen der
// JPL (sats/elem) zum Datum: Triton rückläufig (i 157°), Proteus, Nereid (e 0,75). Sonne aus ihrer wahren Richtung (Bahn aus
// astro.js), Neptunschatten auf Ringen und Monden, Mondschatten auf Neptun. Modell: Ringe stark aufgehellt, Lage der Bögen
// zueinander und Form von Proteus gezeichnet, Zeitraffer.

import * as THREE from 'three';
import { PLANETS, AU, R_SUN, G, julianDate, planetPosition, eclToScene, eclDir, equToScene, laplaceAxes, mulberry32, num } from '../astro.js';
import { createStarfield } from '../stars.js';
import { BODY_VERT, SHELL_VERT, PLANET_FRAG, ATMO_FRAG, RING_FRAG, ATMOS } from '../planetfx.js';
import { ringTexture, ringMesh, moonOrbit, tidalQuat } from '../moonsys.js';
import { registerLayers, refreshLayers } from '../layers.js';
import { spinAxis } from '../axes.js';

const RAD = Math.PI / 180;
const R_N = 24764;                        // km, Äquatorradius bei 1 bar (nep-fact)
const GM = G * 102.409e24;                // m³/s² aus der Masse (nep-fact)
const POLE = [299.36, 43.46];             // Nordpol α, δ [°] (IAU, wie solar.js BODY.neptune)
const ROT_H = 16.11;                      // siderische Rotation [h] (nep-fact)
const J2000 = 2451545.0;
const Y = new THREE.Vector3(0, 1, 0);

// Mittlere Elemente (JPL sats/elem, NEP098 bzw. NEP105; Vorzeichen der Präzession wie in astro.js laplacePos: Triton läuft
// rückwärts, seine Knoten und Apsiden vorwärts). Triton und Proteus im Äquator-System von Neptun, Nereid in der Ekliptik zur
// Epoche ep (2020-01-01.0). r = Halbachsen [km] (nssdc-nepsat); Farbe der kleinen Monde Modell.
const MOONS = [
  { id: 'triton', el: { a: 354800, e: 0, w: 0, M: 63.0, i: 157.3, node: 177.7, P: 5.8792, Pw: 675.2, Pn: 299.4 }, frame: 'eq', r: [1353.4, 1353.4, 1353.4], tex: 'triton.jpg', dot: [0.95, 0.88, 0.84] },
  { id: 'proteus', el: { a: 117700, e: 0.001, w: 357.2, M: 297.4, i: 0.6, node: 355.5, P: 1.1229, Pw: 6.5, Pn: -13.1 }, frame: 'eq', r: [220, 208, 202], grey: [74, 71, 68], dot: [0.75, 0.72, 0.68] },
  { id: 'nereid', el: { a: 5513900, e: 0.751, w: 296.8, M: 318.5, i: 5.1, node: 319.5, P: 360.133039, Pw: 7990.433, Pn: -9426.334 }, frame: 'ecl', ep: 2458849.5, r: [170, 170, 170], grey: [104, 102, 98], dot: [0.8, 0.8, 0.78] },
];
// Ringe (nep-ring): Radius r, Breite w [km], a = Deckkraft im Bild – stark aufgehellt (echte optische Tiefe 0,0001 bis 0,12,
// Albedo ≈ 0,015). Lassell = breites Band zwischen Le Verrier und Arago.
const R_IN = 40000, R_OUT = 64000, R_ADAMS = 62933;
const RINGS = [
  { r: 41900, w: 2000, a: 0.1 },     // Galle
  { r: 53200, w: 100, a: 0.55 },     // Le Verrier
  { r: 55200, w: 4000, a: 0.06 },    // Lassell
  { r: 57200, w: 100, a: 0.32 },     // Arago
  { r: R_ADAMS, w: 15, a: 0.6 },     // Adams
];
// Bögen im Adams-Ring (Namen nep-ring): Mitte und Länge [°] zueinander – Richtwerte nach den Voyager-Bildern, im Bild Modell
const ARCS = [
  { lon: 0, len: 9.6 },     // Fraternité
  { lon: 11.5, len: 1.5 },  // Égalité 1
  { lon: 14, len: 2.5 },    // Égalité 2
  { lon: 22, len: 4 },      // Liberté
  { lon: 30, len: 1.5 },    // Courage
].map((x) => ({ ...x, r: R_ADAMS, w: 15, a: 1 }));
const P_ADAMS = 2 * Math.PI * Math.sqrt((R_ADAMS * 1e3) ** 3 / GM) / 86400;   // Tage (eigene Rechnung, Kepler)
// Zeitraffer: simulierte Sekunden je Sekunde
const SPEEDS = [[0, 'angehalten'], [600, '10 min/s'], [3600, '1 h/s'], [6 * 3600, '6 h/s'], [86400, '1 Tag/s']];
const RING_GAIN = 1.2;

// Unregelmäßiger Körper: Kugel mit Senken (Krater, Modell), danach auf die Halbachsen gestreckt
function lumpy(rand) {
  const g = new THREE.SphereGeometry(1, 72, 36), p = g.attributes.position, v = new THREE.Vector3();
  const dents = Array.from({ length: 26 }, (_, k) => ({
    d: new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize(),
    r: k === 0 ? 0.85 : 0.12 + rand() * 0.4, h: k === 0 ? 0.11 : 0.02 + rand() * 0.06,
  }));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let s = 1;
    for (const k of dents) {
      const a = Math.acos(THREE.MathUtils.clamp(v.dot(k.d), -1, 1));
      if (a < k.r) s -= k.h * (1 - (a / k.r) ** 2) ** 2;
    }
    p.setXYZ(i, v.x * s, v.y * s, v.z * s);
  }
  g.computeVertexNormals();
  return g;
}

function greyTex([r, g, b]) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// Leuchtpunkte der Monde (feste Pixelgröße, hinter der eigenen Oberfläche verdeckt)
const DOT_VERT = /* glsl */ `
attribute vec3 color;
uniform float uPx;
varying vec3 vC;
void main() { vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = 5.0 * uPx; }
`;
const DOT_FRAG = /* glsl */ `
varying vec3 vC;
void main() { float a = smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vC * a, a); }
`;

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
  scene.add(createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.75, seed: 47, tex: ctx.tex }));
  const stars = scene.children[0];
  const rand = mulberry32(53);
  const jd0 = julianDate(ctx.date);

  // ---------- Sonne und Achse: Licht aus der wahren Richtung am Datum ----------
  const nepAU = new THREE.Vector3(...eclToScene(planetPosition(PLANETS.find((p) => p.id === 'neptune'), jd0)));
  const sunDir = nepAU.clone().normalize().negate();
  const sunAng = R_SUN / (nepAU.length() * AU);
  const poleV = new THREE.Vector3(...equToScene(...POLE)).normalize();

  // ---------- Heimpose: 85° neben der Sonnenrichtung (Licht von der Seite), 16° über der Ringebene auf der Sonnenseite ----------
  const sPerp = sunDir.clone().addScaledVector(poleV, -sunDir.dot(poleV)).normalize();
  const side = Math.sign(sunDir.dot(poleV)) || 1;
  const camDir = sPerp.clone().applyAxisAngle(poleV, -85 * RAD).multiplyScalar(Math.cos(16 * RAD)).addScaledVector(poleV, side * Math.sin(16 * RAD)).normalize();
  // Blickziel zur beleuchteten Seite versetzt → Neptun links angeschnitten, Ringe und Bahnen im Bild
  const sProj = sunDir.clone().addScaledVector(camDir, -sunDir.dot(camDir)).normalize();
  const home = { pos: camDir.clone().multiplyScalar(6.2), target: sProj.clone().multiplyScalar(0.8) };

  // ---------- Körper (Shader: planetfx.js) ----------
  const bodyU = (map, o = {}) => ({
    tMap: { value: map }, tNight: { value: null }, tClouds: { value: null }, tSpec: { value: null }, tRing: { value: null },
    uHasEarth: { value: 0 }, uCloudU: { value: 0 }, uGain: { value: o.gain ?? 1 }, uRing: { value: 0 }, uRingIn: { value: 0 }, uRingOut: { value: 0 },
    uInv: { value: new THREE.Matrix4() }, uWrap: { value: o.wrap ?? 0.02 }, uAmb: { value: o.amb ?? 0.02 }, uBand: { value: o.band ?? 0 }, uTime: { value: 0 },
    uMoon: { value: o.moon ? 1 : 0 }, uEarthPos: { value: new THREE.Vector3() }, uEarthshine: { value: o.moon ? 0.006 : 0 },
    uTerm: { value: new THREE.Vector3(...(o.term ?? [1, 0.85, 0.7])) }, uSunDir: { value: sunDir }, uSunAng: { value: sunAng },
    uOcc: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) }, uOccN: { value: 0 },
  });
  const A = ATMOS.neptune, BAND = 0.45;
  const tilt = new THREE.Group();
  tilt.quaternion.setFromUnitVectors(Y, poleV);
  scene.add(tilt);
  const nepU = bodyU(ctx.tex('neptune.jpg'), { wrap: A.wrap, term: A.term, band: BAND, amb: 0.03 });
  const nep = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 80), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: nepU }));
  tilt.add(nep);
  spinAxis(nep);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(A.ra, 96, 48), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: ATMO_FRAG, uniforms: {
    uSun: { value: sunDir }, uCenter: { value: new THREE.Vector3() }, uBeta: { value: new THREE.Vector3(...A.beta) }, uMieCol: { value: new THREE.Vector3(...A.mieCol) },
    uRp: { value: 1 }, uRa: { value: A.ra }, uH: { value: A.h }, uGain: { value: A.gain }, uMie: { value: A.mie }, uAir: { value: 0 }, uAirH: { value: 0.2 } },
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  scene.add(shell);

  // ---------- Ringe mit Bögen (moonsys.js), Ebene = Äquator ----------
  // Staub rötlich-grau (Farbe Modell); Bögen = Zeilen der Textur (v = Azimut)
  const ringU = { tRing: { value: ringTexture(RINGS, R_IN, R_OUT, { arcs: ARCS, h: 256, color: [0.78, 0.7, 0.64] }) }, uCenter: { value: new THREE.Vector3() },
    uR: { value: 1 }, uGain: { value: RING_GAIN }, uSunDir: { value: sunDir } };
  const ring = ringMesh(new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: RING_FRAG, uniforms: ringU, transparent: true, side: THREE.DoubleSide, depthWrite: false }), R_IN, R_OUT, R_N);
  tilt.add(ring);

  // ---------- Monde: Globus, Bahn, Leuchtpunkt ----------
  const ECL = { x: [1, 0, 0], y: [0, 0, -1], z: [0, 1, 0] };     // Ekliptik J2000 in der Szene (eclToScene)
  const EQ = laplaceAxes(...POLE);
  const moons = MOONS.map((m) => {
    const ax = m.frame === 'eq' ? EQ : ECL;
    const u = bodyU(m.tex ? ctx.tex(m.tex) : greyTex(m.grey), { moon: true });
    u.uOccN.value = 1;                                             // Neptun wirft Schatten
    u.uOcc.value[0].set(0, 0, 0, 1);
    const geo = m.id === 'proteus' ? lumpy(rand) : new THREE.SphereGeometry(1, m.tex ? 96 : 32, m.tex ? 48 : 16);
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: u }));
    mesh.scale.set(m.r[0] / R_N, m.r[1] / R_N, m.r[2] / R_N);
    spinAxis(mesh);
    scene.add(mesh);
    const shift = m.ep ? m.ep - J2000 : 0;
    const orbit = moonOrbit(m.el, ax, R_N, new THREE.Color(...m.dot), jd0 - shift, 0.7);
    scene.add(orbit.line);
    return { m, mesh, orbit, shift, pos: mesh.position, rMean: (m.r[0] + m.r[1] + m.r[2]) / 3 / R_N };
  });
  const M = Object.fromEntries(moons.map((x) => [x.m.id, x]));
  const dotG = new THREE.BufferGeometry();
  dotG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(moons.length * 3), 3));
  dotG.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MOONS.flatMap((m) => m.dot)), 3));
  const dotU = { uPx: { value: 1 } };
  const dots = new THREE.Points(dotG, new THREE.ShaderMaterial({ vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, uniforms: dotU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  dots.frustumCulled = false;
  scene.add(dots);

  // ---------- Zustand, Zeit ----------
  let days = 0, spdIdx = 1, rotOn = !ctx.still, ringsOn = true, ringGain = 1;
  const toN = new THREE.Vector3();
  function place() {
    const jd = jd0 + days;
    nep.rotation.y = (days * 24 / ROT_H) * Math.PI * 2;
    ring.rotation.y = (days / P_ADAMS) * Math.PI * 2;
    moons.forEach((x, i) => {
      const p = x.orbit.update(jd - x.shift, x.pos);
      // gebunden: Länge 0 bzw. lange Achse zu Neptun, Pol ≈ Neptunpol
      tidalQuat(x.mesh.quaternion, toN.copy(p).negate().normalize(), poleV);
      dotG.attributes.position.setXYZ(i, p.x, p.y, p.z);
    });
    dotG.attributes.position.needsUpdate = true;
    // Mondschatten auf Neptun (Triton, Proteus)
    nepU.uOccN.value = 2;
    nepU.uOcc.value[0].set(M.triton.pos.x, M.triton.pos.y, M.triton.pos.z, M.triton.rMean);
    nepU.uOcc.value[1].set(M.proteus.pos.x, M.proteus.pos.y, M.proteus.pos.z, M.proteus.rMean);
  }
  place();

  const fmtSpan = (d) => (d < 2 ? `${num(d * 24, 1)} h` : `${num(d, 1)} Tage`);
  registerLayers('neptune', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Umläufe im Zeitraffer', value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, playing) => { spdIdx = Math.round(i); rotOn = playing; }, get: () => ({ value: spdIdx, playing: rotOn }),
      status: () => `${rotOn ? 'Zeitraffer' : 'Angehalten'} · ${fmtSpan(days)} vergangen` },
    { id: 'bands', type: 'toggle', group: 'Neptun', label: 'Bänder strömen (Wolkendetail)', value: true, set: (v) => { nepU.uBand.value = v ? BAND : 0; } },
    { id: 'atmo', type: 'toggle', label: 'Methan-Hülle am Rand', value: true, set: (v) => { shell.visible = v; } },
    { id: 'rings', type: 'toggle', group: 'Ringe', label: 'Ringe mit Bögen', value: true, set: (v) => { ringsOn = v; ring.visible = v; } },
    { id: 'ringGain', type: 'range', label: 'Aufhellung', value: 1, min: 0.3, max: 5, step: 0.1, unit: '×', sub: true, set: (v) => { ringGain = v; ringU.uGain.value = RING_GAIN * v; } },
    { id: 'orbits', type: 'toggle', group: 'Monde', label: 'Bahnen von Proteus, Triton und Nereid', value: true, set: (v) => { moons.forEach((x) => { x.orbit.line.visible = v; }); } },
    { id: 'dots', type: 'toggle', label: 'Leuchtpunkte der Monde', value: true, set: (v) => { dots.visible = v; } },
  ]);
  const controls = [
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: rotOn ? spdIdx : 0, min: 0, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (v) => { if (v) { spdIdx = Math.round(v); rotOn = true; } else rotOn = false; refreshLayers(); }, get: () => (rotOn ? spdIdx : 0) },
    { id: 'ring', type: 'range', label: 'Ringe aufhellen', value: ringGain, min: 0.3, max: 5, step: 0.1, fmt: (v) => `${num(v, 1)} ×`,
      set: (v) => { ringGain = v; ringU.uGain.value = RING_GAIN * v; refreshLayers(); }, get: () => ringGain },
  ];

  // ---------- Abzeichen ----------
  const facing = (p, cam) => p.clone().normalize().dot(cam.position.clone().sub(p).normalize());
  // Strahl Kamera → Punkt trifft Neptun vorher?
  const hidden = (p, cam) => {
    const o = cam.position, d = p.clone().sub(o), L = d.length();
    d.divideScalar(L);
    const b = o.dot(d), c = o.lengthSq() - 1, h = b * b - c;
    return h > 0 && -b - Math.sqrt(h) > 0 && -b - Math.sqrt(h) < L;
  };
  const H = (id, focus, visible, o = {}) => ({ id, kind: 'info', pos: new THREE.Vector3(), focus: () => focus, visible, ...o });
  const hs = {
    gds: H('gds', 1.4, (cam) => facing(hs.gds.pos, cam) > 0.1),
    winds: H('winds', 2.4, () => true),
    atmo: H('atmo', 2.4, () => true),
    pole: H('pole', 2.6, (cam) => !hidden(hs.pole.pos, cam)),
    voyager: H('voyager', 2.6, (cam) => !hidden(hs.voyager.pos, cam)),
    rings: H('rings', 3.2, (cam) => ringsOn && !hidden(hs.rings.pos, cam)),
    arcs: H('arcs', 0.9, (cam) => ringsOn && !hidden(hs.arcs.pos, cam)),
    triton: H('triton', 0.45, (cam) => !hidden(hs.triton.pos, cam), { kind: 'dive', to: 'triton' }),   // [E5] Triton
    proteus: H('proteus', 0.08, (cam) => !hidden(hs.proteus.pos, cam)),
    nereid: H('nereid', 0.08, (cam) => !hidden(hs.nereid.pos, cam)),
  };
  const hotspots = Object.values(hs);
  // Kartenort des Flecks (Textur u 0,547, Breite −16°) auf der Kugel (Konvention SphereGeometry)
  const gdsLocal = (() => { const lon = 0.547 * Math.PI * 2, lat = -16 * RAD; return new THREE.Vector3(-Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat)); })();
  const tq = new THREE.Quaternion(), tqi = new THREE.Quaternion(), cl = new THREE.Vector3();
  // Punkt im Neptun-System (Breite lat, Länge = Blickrichtung der Kamera + dLon) → Szene
  const atCam = (out, cam, lat, dLon, r) => {
    cl.copy(cam.position).applyQuaternion(tqi);
    const lon = Math.atan2(cl.z, cl.x) + dLon * RAD;
    return out.set(Math.cos(lat * RAD) * Math.cos(lon), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.sin(lon)).multiplyScalar(r).applyQuaternion(tq);
  };
  const arcLocal = new THREE.Vector3(R_ADAMS / R_N, 0, 0);
  function placeHotspots(cam) {
    tq.copy(tilt.quaternion); tqi.copy(tq).invert();
    nep.updateMatrixWorld(true);
    hs.gds.pos.copy(gdsLocal).applyMatrix4(nep.matrixWorld);
    atCam(hs.winds.pos, cam, -42, -28, 1);
    atCam(hs.atmo.pos, cam, 8, 74, 1.02);
    hs.pole.pos.copy(poleV).multiplyScalar(-1.08);
    hs.voyager.pos.copy(poleV).multiplyScalar(1 + 4800 / R_N);
    atCam(hs.rings.pos, cam, 0, 55, 55200 / R_N);
    ring.updateMatrixWorld(true);
    hs.arcs.pos.copy(arcLocal).applyAxisAngle(Y, 15 * RAD).applyMatrix4(ring.matrixWorld);
    for (const id of ['triton', 'proteus', 'nereid']) hs[id].pos.copy(M[id].pos);
  }
  placeHotspots({ position: home.pos });

  const look = { exposure: 1.1, bloom: 0.07 };
  const fmtDate = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  return {
    scene, camera, home, unit: R_N * 1e3, hotspots, controls, look,
    orbit: { minDistance: 0.004, maxDistance: 700, cineSpeed: 0.5 },
    update(dt, t, cam, flying) {
      if (!flying && rotOn) days += dt * SPEEDS[spdIdx][0] / 86400;
      nepU.uTime.value = t * (ctx.still ? 0.2 : 1);
      place();
      // Nahebene mit dem Abstand zur nächsten Oberfläche
      let gap = cam.position.length() - 1;
      for (const x of moons) gap = Math.min(gap, cam.position.distanceTo(x.pos) - x.rMean * 1.2);
      const nr = THREE.MathUtils.clamp(gap * 0.3, 2e-5, 0.05);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
      placeHotspots(cam);
    },
    // Kamera bleibt außerhalb von Neptun und den Monden
    orbitUpdate(c) {
      const p = c.object.position, r = p.length();
      if (r < 1.03) p.multiplyScalar(1.03 / r);
      for (const x of moons) {
        const d = p.distanceTo(x.pos), lim = x.rMean * 1.15;
        if (d < lim) p.sub(x.pos).multiplyScalar(lim / Math.max(d, 1e-9)).add(x.pos);
      }
    },
    live: () => `${fmtDate.format(new Date(ctx.date.getTime() + days * 864e5))} · ${rotOn ? `Zeitraffer ${SPEEDS[spdIdx][1]}` : 'angehalten'}`,
    setPixelRatio(pr) { stars.userData.setPixelRatio(pr); dotU.uPx.value = pr; },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    },
  };
}
