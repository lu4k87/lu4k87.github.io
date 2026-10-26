// Station 02G: Uranus & Monde (Einheit 1 Uranusradius = 25.559 km), Abstecher vom Sonnensystem. Der Eisriese liegt mit
// 97,77° Achsneigung fast auf der Seite: Ringe und die fünf großen Monde kreisen in seiner Äquatorebene, die Sonne steht
// im Lauf der 84 Jahre einmal über dem einen, einmal über dem anderen Pol. Regler „Jahr“ (1986 Voyager 2 … 2070) zeigt das:
// Sonnenrichtung aus den JPL-Bahnelementen des Uranus, Monde aus den mittleren JPL-Elementen (sats/elem) zum gewählten
// Zeitpunkt, um die Tagundnachtgleichen 2007 und 2050 laufen Mondschatten über die Wolken. Zehn schmale Ringe (NASA Uranian Rings
// Fact Sheet) als Ringprofil, die Staubringe ν und μ (τ ≪ 0,01) stark aufgehellt. Mondkarten: NASA/USGS, nur die
// Südhälften von Voyager 2 gesehen, der Rest ist mit der mittleren Helligkeit gefüllt. Monde wählbar vergrößert.

import * as THREE from 'three';
import { PLANETS, planetPosition, julianDate, eclToScene, eclDir, equToScene, laplaceAxes } from '../astro.js';
import { createStarfield } from '../stars.js';
import { BODY_VERT, SHELL_VERT, PLANET_FRAG, ATMO_FRAG, RING_FRAG, ATMOS } from '../planetfx.js';
import { registerLayers, refreshLayers } from '../layers.js';
import { ringTexture, ringMesh, moonOrbit, tidalQuat } from '../moonsys.js';
import { spinAxis } from '../axes.js';

export const R_U = 25559;                 // km, äquatorial (NASA Uranus Fact Sheet)
export const ROT_H = -17.24;              // h, rückläufig um den IAU-Nordpol
export const NORTH = [257.311, -15.175];  // IAU-Nordpol α/δ [°] (WGCCRE 2015); die Monde kreisen um den Gegenpol (Drehsinn des Planeten)
const SPIN = [NORTH[0] - 180, -NORTH[1]];
const UA = PLANETS.find((p) => p.id === 'uranus');
// Schmale Ringe (NASA NSSDCA Uranian Rings Fact Sheet): Radius, Breite [km] (Mitte der Spanne), optische Tiefe τ
// → Deckkraft 1 − e^(−τ); unter 1,5 Pixel der Textur (≈ 7 km) breiter gezeichnet
export const RINGS = [[41837, 1.5, 0.3], [42234, 2, 0.5], [42571, 2, 0.3], [44718, 7, 0.4], [45661, 8, 0.3], [47176, 1.6, 0.4],
  [47627, 2.5, 0.3], [48300, 5, 0.5], [50024, 2, 0.1], [51149, 58, 1.2]].map(([r, w, tau]) => ({ r, w, a: 1 - Math.exp(-tau) }));
export const RING_IN = 41000, RING_OUT = 52000, EPS = 51149;
// Staubringe ν (R/2003 U 2) und μ (R/2003 U 1): τ ≪ 0,01, als Schleier mit 5–6 % Deckkraft sichtbar gemacht
const DUST = [{ r: 67300, w: 3800, a: 0.06 }, { r: 97700, w: 17000, a: 0.05 }];
const DUST_IN = 60000, DUST_OUT = 112000;
// Fünf große Monde: Radius [km] (NASA Uranian Satellite Fact Sheet; Miranda Mittel der Halbachsen), mittlere Elemente
// (JPL sats/elem, URA182, Äquator des Uranus, Epoche J2000): Apsiden vorwärts, Knoten rückwärts; dive = eigene Station
// (Exporte für die Mond-Stationen, uranusmoon.js)
export const MOONS = [
  { id: 'miranda', r: 235.7, tex: 'miranda.jpg', dot: 0xa9c4cc, dive: true, el: { a: 129846, e: 0.001, w: 154.8, M: 73.0, i: 4.4, node: 100.9, P: 1.413479, Pw: 8.939, Pn: -17.787 } },
  { id: 'ariel', r: 581.1, tex: 'ariel.jpg', dot: 0x9fb4bd, el: { a: 190929, e: 0.001, w: 9.6, M: 193.5, i: 0, node: 0, P: 2.520379, Pw: 28.901, Pn: 0 } },
  { id: 'umbriel', r: 584.7, tex: 'umbriel.jpg', dot: 0x8a9aa2, el: { a: 265986, e: 0.004, w: 183.4, M: 253.0, i: 0.1, node: 174.8, P: 4.144177, Pw: 64.126, Pn: -129.945 } },
  { id: 'titania', r: 788.9, tex: 'titania.jpg', dot: 0xb7cbd2, el: { a: 436298, e: 0.002, w: 184.0, M: 68.1, i: 0.1, node: 29.5, P: 8.705869, Pw: 579.928, Pn: -1644.649 } },
  { id: 'oberon', r: 761.4, tex: 'oberon.jpg', dot: 0xa3b2b8, el: { a: 583511, e: 0.002, w: 132.2, M: 143.6, i: 0.1, node: 76.8, P: 13.463237, Pw: 158.604, Pn: -192.798 } },
];
// Zeitraffer [Tage je Sekunde]
const SPEEDS = [[0, 'aus'], [1 / 24, '1 Stunde/s'], [0.25, '6 Stunden/s'], [1, '1 Tag/s'], [4, '4 Tage/s']];
const SUN_ANG = 695700 / (19.19 * 1.495978707e8);   // Winkelradius der Sonne bei 19,19 AE [rad]

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 4000);
  scene.add(createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.75, seed: 37, tex: ctx.tex }));
  const stars = scene.children[0];
  const jdNow = julianDate(ctx.date), yearNow = ctx.date.getUTCFullYear();
  let year = yearNow, days = 0, spdIdx = 2, playing = !ctx.still, big = 8;
  const jdAt = () => jdNow + (year - yearNow) * 365.25 + days;

  const north = new THREE.Vector3(...equToScene(...NORTH));
  const axes = laplaceAxes(...SPIN);
  const sunDir = new THREE.Vector3();
  const sunAt = (jd) => sunDir.set(...eclToScene(planetPosition(UA, jd))).negate().normalize();
  sunAt(jdAt());

  // ---------- Uranus: Wolkenkugel, Atmosphäre, Ringschatten ----------
  const tilt = new THREE.Group();
  tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), north);
  scene.add(tilt);
  tilt.updateMatrixWorld(true);
  const ringTex = ringTexture(RINGS, RING_IN, RING_OUT, { w: 2048, color: [0.62, 0.62, 0.64] });
  const occ = Array.from({ length: 4 }, () => new THREE.Vector4());
  const planetU = {
    tMap: { value: ctx.tex('uranus.jpg') }, tRing: { value: ringTex }, uRing: { value: 1 }, uRingIn: { value: RING_IN / R_U }, uRingOut: { value: RING_OUT / R_U },
    uInv: { value: tilt.matrixWorld.clone().invert() }, uWrap: { value: ATMOS.uranus.wrap }, uAmb: { value: 0.02 }, uBand: { value: 0.2 }, uTime: { value: 0 },
    uGain: { value: 1.1 }, uMoon: { value: 0 }, uEarthshine: { value: 0 }, uTerm: { value: new THREE.Vector3(...ATMOS.uranus.term) },
    uSunDir: { value: sunDir }, uSunAng: { value: SUN_ANG }, uOcc: { value: occ }, uOccN: { value: 0 },
  };
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: planetU }));
  tilt.add(planet);
  spinAxis(planet);
  const a = ATMOS.uranus;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(a.ra, 96, 48), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: ATMO_FRAG, uniforms: {
    uSun: { value: sunDir }, uCenter: { value: new THREE.Vector3() }, uBeta: { value: new THREE.Vector3(...a.beta) }, uMieCol: { value: new THREE.Vector3(...a.mieCol) },
    uRp: { value: 1 }, uRa: { value: a.ra }, uH: { value: a.h }, uGain: { value: a.gain }, uMie: { value: a.mie }, uAir: { value: 0 }, uAirH: { value: 0.2 } },
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  scene.add(shell);

  // ---------- Ringe: schmale Ringe + Staubringe, Planetenschatten aus RING_FRAG ----------
  const ringMat = (tex, gain) => new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: RING_FRAG, uniforms: {
    tRing: { value: tex }, uCenter: { value: new THREE.Vector3() }, uSunDir: { value: sunDir }, uR: { value: 1 }, uGain: { value: gain } },
    transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const rings = ringMesh(ringMat(ringTex, 3), RING_IN, RING_OUT, R_U, 1024);
  const dust = ringMesh(ringMat(ringTexture(DUST, DUST_IN, DUST_OUT, { w: 512, color: [0.5, 0.56, 0.66] }), 0.7), DUST_IN, DUST_OUT, R_U, 512);
  tilt.add(rings, dust);

  // ---------- Monde: Karte, Lommel-Seeliger + Uranusschein, Schatten des Planeten; Bahn mit Leuchtspur ----------
  const moons = MOONS.map((m) => {
    const u = {
      tMap: { value: ctx.tex(m.tex) }, uMoon: { value: 1 }, uEarthPos: { value: new THREE.Vector3() }, uEarthshine: { value: 0.006 }, uGain: { value: 1.05 },
      uWrap: { value: 0 }, uAmb: { value: 0.012 }, uTerm: { value: new THREE.Vector3(1, 1, 1) }, uSunDir: { value: sunDir }, uSunAng: { value: SUN_ANG },
      uOcc: { value: [new THREE.Vector4(0, 0, 0, 1), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, uOccN: { value: 1 },
    };
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: u }));
    scene.add(mesh);
    spinAxis(mesh);
    const orbit = moonOrbit(m.el, axes, R_U, m.dot, jdAt(), 0.7);
    scene.add(orbit.line);
    return { ...m, mesh, orbit, pos: mesh.position, rv: 0 };
  });
  const M = Object.fromEntries(moons.map((m) => [m.id, m]));
  const toU = new THREE.Vector3();
  function placeMoons(jd) {
    for (const m of moons) {
      m.orbit.update(jd, m.pos);
      m.rv = (m.r / R_U) * big;
      m.mesh.scale.setScalar(m.rv);
      tidalQuat(m.mesh.quaternion, toU.copy(m.pos).negate(), north);
    }
    // Mondschatten auf den Wolken: die vier größten Monde als Verdecker (in der Größe, in der sie gezeichnet sind)
    ['titania', 'oberon', 'umbriel', 'ariel'].forEach((id, k) => occ[k].set(M[id].pos.x, M[id].pos.y, M[id].pos.z, M[id].rv));
    planetU.uOccN.value = 4;
  }
  placeMoons(jdAt());

  // ---------- Heimpose: 50° über der Ringebene auf der sonnenabgewandten Seite des Pols → Ringe offen, Licht schräg
  // von der Seite (Phasenwinkel ≈ 60° bei hochstehender Sonne); Uranus links, rechts die inneren Mondbahnen ----------
  const up = new THREE.Vector3(0, 1, 0);
  const sPerp = sunDir.clone().addScaledVector(north, -sunDir.dot(north));
  if (sPerp.lengthSq() < 1e-6) sPerp.crossVectors(north, up);
  const hemi = Math.sign(sunDir.dot(north)) || 1;
  const camDir = north.clone().multiplyScalar(hemi * Math.sin(50 * Math.PI / 180)).addScaledVector(sPerp.normalize(), -Math.cos(50 * Math.PI / 180)).normalize();
  const right = new THREE.Vector3().crossVectors(camDir, up).normalize().negate();
  const home = { pos: camDir.clone().multiplyScalar(13), target: right.clone().multiplyScalar(-2.6) };

  // ---------- Zeit, Ebenen, Infotafel ----------
  const fmtYear = (v) => (v === 1986 ? '1986 · Voyager 2' : v === 2007 || v === 2050 ? `${v} · Tagundnachtgleiche` : v === 2030 ? '2030 · Sonne über dem Nordpol' : String(v));
  const setYear = (v) => { year = Math.round(v); days = 0; refreshLayers(); };
  registerLayers('uranus', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Monde im Zeitraffer', value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, p) => { spdIdx = Math.round(i); playing = p; }, get: () => ({ value: spdIdx, playing }),
      status: () => `${playing ? 'Zeitraffer' : 'Angehalten'} · ${fmtDays(days)} seit Start` },
    { id: 'year', type: 'range', label: 'Jahr (Stand der Sonne)', value: year, min: 1986, max: 2070, step: 1, fmt: fmtYear, set: setYear, get: () => year },
    { id: 'rings', type: 'toggle', group: 'System', label: 'Ringe', value: true, set: (v) => { rings.visible = v; planetU.uRing.value = v ? 1 : 0; } },
    { id: 'dust', type: 'toggle', label: 'Staubringe ν und μ (stark aufgehellt)', value: true, sub: true, set: (v) => { dust.visible = v; } },
    { id: 'orbits', type: 'toggle', label: 'Mondbahnen', value: true, set: (v) => { moons.forEach((m) => { m.orbit.line.visible = v; }); } },
    { id: 'big', type: 'range', label: 'Monde vergrößert', value: big, min: 1, max: 10, step: 1, fmt: (v) => (v === 1 ? 'maßstäblich' : `${v}×`), set: (v) => { big = Math.round(v); } },
  ]);
  const controls = [
    { id: 'year', type: 'range', label: 'Jahr · Stand der Sonne', value: year, min: 1986, max: 2070, step: 1, fmt: fmtYear, set: setYear, get: () => year },
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: playing ? spdIdx : 0, min: 0, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (v) => { if (v) { spdIdx = v; playing = true; } else playing = false; refreshLayers(); }, get: () => (playing ? spdIdx : 0) },
  ];

  // ---------- Abzeichen ----------
  const ringPos = new THREE.Vector3(), polePos = north.clone().multiplyScalar(1.45);
  const hotspots = [
    ...moons.map((m) => ({ id: m.id, kind: m.dive ? 'dive' : 'info', to: m.dive && m.id, pos: m.pos, focus: () => Math.max(m.rv * 9, 0.3) })),
    { id: 'rings', kind: 'info', pos: ringPos, focus: () => 3.2, visible: () => rings.visible },
    { id: 'axis', kind: 'info', pos: polePos, focus: () => 4.5 },
  ];
  const tmp = new THREE.Vector3();
  function placeRingSpot(cam) {
    // Punkt des ε-Rings an der Seite (Ansa), quer zur Blickrichtung
    tmp.crossVectors(north, cam.position);
    if (tmp.lengthSq() < 1e-8) tmp.crossVectors(north, up);
    ringPos.copy(tmp.normalize()).multiplyScalar(EPS / R_U);
  }
  placeRingSpot({ position: home.pos });

  const subsolar = () => Math.asin(THREE.MathUtils.clamp(sunDir.dot(north), -1, 1)) * 180 / Math.PI;
  const look = { exposure: 1.05, bloom: 0.07 };
  return {
    scene, camera, home, unit: R_U * 1e3, hotspots, controls, look,
    orbit: { minDistance: 1.2, maxDistance: 160, cineSpeed: 0.5 },
    update(dt, t, cam, flying) {
      if (!flying && playing) days += dt * SPEEDS[spdIdx][0];
      const jd = jdAt();
      sunAt(jd);
      planetU.uTime.value = t;
      planet.rotation.y = (((jd * 24) / ROT_H) % 1) * Math.PI * 2;
      placeMoons(jd);
      placeRingSpot(cam);
      // Nahebene mit dem Abstand zum nächsten Körper (Uranus)
      const nr = THREE.MathUtils.clamp((cam.position.length() - 1) * 0.15, 0.002, 0.5);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
    },
    orbitUpdate(c) {
      const r = c.object.position.length();
      if (r < 1.08) c.object.position.multiplyScalar(1.08 / r);
    },
    live: () => {
      const s = subsolar();
      return `${year} · Sonne über ${Math.abs(Math.round(s))}° ${s >= 0 ? 'N' : 'S'} · ${playing ? `Zeitraffer ${SPEEDS[spdIdx][1]}` : 'Zeit angehalten'}`;
    },
    setPixelRatio(pr) { stars.userData.setPixelRatio(pr); },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      ringTex.dispose();
    },
  };
}

function fmtDays(d) {
  if (d < 1) return `${Math.round(d * 24)} h`;
  return `${String(Math.round(d * 10) / 10).replace('.', ',')} Tage`;
}
