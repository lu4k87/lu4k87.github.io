// Station 04A: Andromeda-Galaxie M31 als Modell (Einheit 1 kpc) – gleiches Achsenkreuz wie die Lokale Gruppe (Station 4),
// nur um den Ort von M31 verschoben (761 kpc, Li et al. 2021): Flug hinein als Überblendung (main.js sameSpace), Scheibe wie dort
// 77° gegen die Sichtlinie geneigt (PA 38°), Milchstraße und M33 an ihren Orten. Aufbau wie Station 3 (Milchstraße):
// Sterne aus buildGalaxy mit Andromedas Armen und Ringen (Ring bei 10 kpc und innerer Ring bei 1,5 kpc, Gordon et al. 2006),
// schwacher Balken, großer Bulge; Gas und Staub als 3D-Nebel (galaxyneb.js), Sternentstehung mit Lebenslauf (galaxyfx.js,
// Arme stehen als Dichtewelle), Halo aus alten Sternen bis 150 kpc (PAndAS, McConnachie et al. 2009) mit ≈ 450
// Kugelsternhaufen (Caldwell & Romanowsky 2016), Riesen-Sternstrom (Ibata et al. 2001), Begleiter (McConnachie 2012) und
// Doppelkern als exzentrische Sternscheibe um das Schwarze Loch (Tremaine 1995, Bender et al. 2005).

import * as THREE from 'three';
import { registerLayers } from '../layers.js';
import { buildGalaxy } from './galaxy.js';
import { DWARFS, ROT, M31_ARMS, M31_RINGS, M33_ARMS, SUN, at, orient } from './local.js';
import { nebulaVolume } from '../galaxyneb.js';
import { starFormation, lightBlobs, streamCloud } from '../galaxyfx.js';
import { pointCloud, disposeScene } from '../vol.js';
import { mulberry32, gauss, blackbody, KPC } from '../astro.js';

const RAD = Math.PI / 180;
const D = 761, INC = 77, PA = 38, SCALE = 1.4;   // Entfernung [kpc], Neigung, Positionswinkel, Modell → kpc wie in local.js
const M31 = at(121.17, -21.57, D);
const rel = (v) => v.clone().sub(M31);   // Ort in der Lokalen Gruppe → Station
const Q = (() => { const o = new THREE.Object3D(); orient(o, M31, INC, PA); return o.quaternion.clone(); })();
// Achsen am Himmel: Sichtlinie Sonne → M31, große Achse (Knotenlinie), kleine Achse am Himmel und in der Scheibe
const LOS = M31.clone().sub(SUN).normalize();
const NORMAL = new THREE.Vector3(0, 1, 0).applyQuaternion(Q);
const MAJOR = new THREE.Vector3().crossVectors(NORMAL, LOS).normalize();
const SKY = new THREE.Vector3().crossVectors(LOS, MAJOR).normalize();
const DISK = new THREE.Vector3().crossVectors(MAJOR, NORMAL).normalize();   // projiziert sich auf +SKY · cos i
const ARCMIN = D * RAD / 60;   // kpc je Bogenminute in 761 kpc (≈ 0,221)
// Versatz am Himmel [′] entlang großer (x) und kleiner Achse (y) → Ort in der Scheibe (entprojiziert) oder in der Himmelsebene
const skyAt = (x, y, disk) => MAJOR.clone().multiplyScalar(x * ARCMIN).addScaledVector(disk ? DISK : SKY, (disk ? y / Math.cos(INC * RAD) : y) * ARCMIN);
// Hubbles Cepheide V1 (RA 0h41m27,3s, Dec +41°10′10″) und der Kugelsternhaufen G1/Mayall II (0h32m46,5s, +39°34′40″) relativ
// zur Mitte (0h42m44,3s, +41°16′09″), gedreht um PA 38° (eigene Rechnung); welche Seite der großen Achse Südwesten ist, legt
// das Modell fest
const V1 = skyAt(-13.7, 7.7, true), G1 = skyAt(-150.1, 27.2, false);

// Begleiter (Typ wie local.js): Darstellung je Typ – Radius [kpc], Sterne, Farbtemperatur, Lichthof; M32 kompakt (r ≈ 0,1 kpc)
const SAT = {
  S: { r: 0.5, n: 1400, T: 4300, dT: 900, k: 0.9, glow: 0.12 },
  E: { r: 0.45, n: 5000, T: 4100, dT: 900, k: 1.3, glow: 0.35 },
  I: { r: 0.6, n: 2500, T: 4500, dT: 9000, k: 1.5, glow: 0.2 },
};
const SIZE = { M32: 0.12, M110: 0.7 };
const PINK = [1.0, 0.32, 0.48];
const SPEEDS = [[0.5, '0,5 Mio. J./s'], [1, '1 Mio. J./s'], [2, '2 Mio. J./s'], [5, '5 Mio. J./s']];

// Doppelkern (Lauer et al. 1993, Tremaine 1995): Sterne auf ausgerichteten Kepler-Ellipsen um das Schwarze Loch. Am Apozentrum
// verweilen sie am längsten → heller Fleck P1 rund 1,8 pc vom Loch; P2 = Loch mit dem Haufen junger blauer Sterne P3
// (Bender et al. 2005). Einheit kpc, Ebene der Scheibe (Modell)
function nucleus(det, rand) {
  const pos = [], col = [], size = [];
  const PC = 0.001;
  for (let i = 0; i < Math.round(9000 * det) + 2000; i++) {
    const a = (0.6 + rand() * 2.4) * PC, e = 0.55 + rand() * 0.2;
    // Zeit gleichmäßig → mittlere Anomalie M; exzentrische Anomalie per Newton
    const M = rand() * 2 * Math.PI;
    let E = M;
    for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const x = a * (Math.cos(E) - e), z = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const tw = gauss(rand) * 0.12;   // leicht verdrillte Ellipsen
    pos.push(-x * Math.cos(tw) - z * Math.sin(tw), gauss(rand) * 0.12 * a, -z * Math.cos(tw) + x * Math.sin(tw));
    col.push(...blackbody(4300 + rand() * 700).map((v) => v * (0.35 + rand() * 0.5)));
    size.push(0.00012);
  }
  for (let i = 0; i < 400; i++) {   // P3: junge A-Sterne, ≈ 0,1 pc um das Loch
    const r = Math.abs(gauss(rand)) * 0.06 * PC, p = rand() * 2 * Math.PI;
    pos.push(r * Math.cos(p), gauss(rand) * 0.01 * PC, r * Math.sin(p));
    col.push(...blackbody(10000 + rand() * 6000).map((v) => v * 1.2));
    size.push(0.00008);
  }
  return pointCloud(pos, col, size, { min: 1.0, max: 10, fade: 40 });
}

// Halo: Sterne ρ ∝ r⁻³ von 2 bis 150 kpc (leicht abgeplattet, rötlich), Kugelsternhaufen N(<r) ∝ r⁰·⁵ bis 150 kpc, G1 hell
function halo(det, rand) {
  const pos = [], col = [], size = [];
  const put = (p, T, k, s) => { pos.push(p.x, p.y, p.z); col.push(...blackbody(T).map((v) => v * k)); size.push(s); };
  const cluster = (c, n, r, k) => { for (let i = 0; i < n; i++) put(new THREE.Vector3(c.x + gauss(rand) * r, c.y + gauss(rand) * r, c.z + gauss(rand) * r), 4700 + rand() * 900, k * (0.5 + rand()), 0.06); };
  const g1 = G1.clone().applyQuaternion(Q.clone().invert());
  cluster(g1, Math.round(40 * det) + 10, 0.06, 2.6);
  for (let i = 0; i < 450; i++) {
    const u = rand();
    const r = Math.pow(Math.pow(1.5, -0.5) - u * (Math.pow(1.5, -0.5) - Math.pow(150, -0.5)), -2) * (0.15 + 0.85 * rand() ** 0.15);
    cluster(new THREE.Vector3(gauss(rand), gauss(rand) * 0.8, gauss(rand)).normalize().multiplyScalar(Math.max(r, 1.2)), Math.round(10 * det) + 4, 0.05, 1.2);
  }
  for (let i = 0; i < Math.round(16000 * det); i++) {
    const u = rand();
    const r = Math.pow(Math.pow(2, -1) - u * (Math.pow(2, -1) - Math.pow(150, -1)), -1);
    put(new THREE.Vector3(gauss(rand), gauss(rand) * 0.85, gauss(rand)).normalize().multiplyScalar(r), 3800 + rand() * 1200, 0.22 + rand() * 0.3, 0.05);
  }
  return { cloud: pointCloud(pos, col, size, { min: 1.1, max: 24, fade: 16 }), g1 };
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.0002, 3000);
  const det = ctx.detail;
  const rand = mulberry32(31);
  const px = [];
  const keep = (o) => { px.push(o); return o; };

  // Andromeda im Achsenkreuz der Scheibe (y = Normale), wie die Milchstraße in Station 3
  const gal = new THREE.Group();
  gal.quaternion.copy(Q);
  scene.add(gal);
  const stars = keep(buildGalaxy({ n: Math.round(280000 * det), seed: 31, scale: SCALE, arms: M31_ARMS, rings: M31_RINGS, young: false, dust: false, bar: 0.35, bulge: 1.8 }));
  gal.add(stars);
  const young = keep(starFormation({ arms: M31_ARMS, rings: M31_RINGS, n: Math.round(26000 * det), scale: SCALE, rot: ROT.m31, seed: 131, gain: 1.1, rIn: 0.8, hii: 0.05 }));
  gal.add(young);
  const core = keep(lightBlobs([0, 0, 0], blackbody(4300).map((v) => v * 0.22), [3.2]));
  gal.add(core);
  const nuc = keep(nucleus(det, rand));
  gal.add(nuc);
  const neb = nebulaVolume(ctx.renderer, { arms: M31_ARMS, rings: M31_RINGS, detail: det, look: { bar: 0.35, bulge: 1.8 }, quat: Q, scale: SCALE });
  scene.add(neb.object);
  const { cloud: haloCloud, g1 } = halo(det, rand);
  gal.add(keep(haloCloud));

  // Riesen-Sternstrom wie in local.js (südlich der Scheibe, das ferne Ende rund 100 kpc hinter M31; Bahn als Modell)
  const UP = new THREE.Vector3(0, 1, 0);
  const ea = new THREE.Vector3().crossVectors(LOS, UP).normalize(), eb = new THREE.Vector3().crossVectors(ea, LOS).normalize();
  const gssAt = (s, a, l) => new THREE.Vector3().addScaledVector(eb, -s).addScaledVector(ea, a).addScaledVector(LOS, l);
  const gss = keep(streamCloud([gssAt(4, 2, 0), gssAt(22, 3, 18), gssAt(42, 6, 48), gssAt(60, 10, 95)],
    { n: Math.round(14000 * det), width: [1.5, 6], seed: 66, color: blackbody(4600), k: 0.3, size: 0.12, gas: 0.05 }));
  scene.add(gss);

  // Begleiter im Umkreis von 300 kpc (McConnachie 2012): aufgelöste Sterne + Lichthof
  const sats = DWARFS.map(([name, l, b, d, type]) => ({ name, type, p: rel(at(l, b, d)) })).filter((s) => s.p.length() < 300);
  const sp = [], sc = [], ss = [], hp = [], hc = [], hs = [];
  for (const s of sats) {
    const t = SAT[s.type], r = SIZE[s.name] || t.r * (0.8 + rand() * 0.5), n = Math.round((s.name === 'M32' || s.name === 'M110' ? 2 : 1) * t.n * det) + 60;
    for (let i = 0; i < n; i++) {
      const q = Math.abs(gauss(rand)) ** 1.4;   // zur Mitte dichter
      const v = new THREE.Vector3(gauss(rand), gauss(rand) * 0.75, gauss(rand)).normalize().multiplyScalar(q * r);
      sp.push(s.p.x + v.x, s.p.y + v.y, s.p.z + v.z);
      sc.push(...blackbody(t.T + rand() * t.dT).map((x) => x * t.k * (0.4 + rand())));
      ss.push(0.035);
    }
    if (s.type === 'I') for (let i = 0; i < 5; i++) { const v = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(r * 0.4); sp.push(s.p.x + v.x, s.p.y + v.y, s.p.z + v.z); sc.push(...PINK.map((x) => x * 4)); ss.push(0.08); }
    hp.push(s.p.x, s.p.y, s.p.z); hc.push(...blackbody(t.T).map((x) => x * t.glow * (s.name === 'M32' ? 3 : 1))); hs.push(r * 3);
  }
  const satGroup = new THREE.Group();
  satGroup.add(keep(pointCloud(sp, sc, ss, { min: 1.1, max: 20, fade: 16 })), keep(lightBlobs(hp, hc, hs)));
  scene.add(satGroup);

  // Milchstraße (761 kpc) und M33 an ihren Orten – klein am Himmel; Galaxien-Generator von Station 3
  const mwPos = rel(new THREE.Vector3());
  const mw = new THREE.Group();
  mw.position.copy(mwPos);
  mw.add(keep(buildGalaxy({ n: Math.round(40000 * det), seed: 9, scale: 1, gain: 9, dust: false })), keep(lightBlobs([0, 0, 0], blackbody(4300).map((v) => v * 0.5), [5])));
  scene.add(mw);
  const m33 = new THREE.Group();
  const m33L = at(133.61, -31.33, 840);
  orient(m33, m33L, 52, 23);
  m33.position.copy(rel(m33L));
  m33.add(keep(buildGalaxy({ n: Math.round(20000 * det), seed: 33, scale: 0.55, gain: 9, dust: false, arms: M33_ARMS, bar: 0.15, bulge: 0.25 })));
  scene.add(m33);

  // Linien: Ringe bei 10 und 1,5 kpc, große Achse, Sichtlinie zur Milchstraße
  const lineMat = (c, o) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const lines = new THREE.Group();
  for (const r of M31_RINGS) {
    const pts = Array.from({ length: 181 }, (_, i) => new THREE.Vector3(-Math.cos(i * 2 * RAD), 0, -Math.sin(i * 2 * RAD)).multiplyScalar(r.R * SCALE));
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat(0xffb070, 0.3));
    ring.quaternion.copy(Q);
    lines.add(ring);
  }
  lines.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([MAJOR.clone().multiplyScalar(-26), MAJOR.clone().multiplyScalar(26)]), lineMat(0xa9d4ff, 0.3)));
  lines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), mwPos]), lineMat(0xa9d4ff, 0.25)));
  lines.visible = false;
  scene.add(lines);

  // Zeitraffer der Sternentstehung (mitrotierendes System der Arme, wie Station 4)
  let T = 0, spdIdx = 1, playing = !ctx.still, labelsOn = false;
  const num = (v) => String(v).replace('.', ',');
  const nebOnly = { active: () => neb.object.visible, only: 'Wirkt, solange „Gas und Staub als 3D-Nebel“ an ist.' };
  registerLayers('andromeda', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Sternentstehung im Zeitraffer', value: spdIdx, min: 0, max: SPEEDS.length - 1, step: 1, autoplay: !ctx.still,
      fmt: (i) => SPEEDS[Math.round(i)][1], set: (i, p) => { spdIdx = Math.round(i); playing = p; }, get: () => ({ value: spdIdx, playing }),
      status: () => `Arme und Ringe stehen, Sterne ziehen hindurch · +${Math.round(T).toLocaleString('de-DE')} Mio. Jahre · ${playing ? SPEEDS[spdIdx][1] : 'angehalten'}` },
    { id: 'young', type: 'toggle', group: 'Andromeda', label: 'Junge Sterne und HII-Regionen', value: true, set: (v) => { young.visible = v; } },
    { id: 'halo', type: 'toggle', label: 'Halo mit Kugelsternhaufen', value: true, set: (v) => { haloCloud.visible = v; } },
    { id: 'gss', type: 'toggle', label: 'Riesen-Sternstrom', value: true, set: (v) => { gss.visible = v; } },
    { id: 'sats', type: 'toggle', label: 'Begleitgalaxien', value: true, set: (v) => { satGroup.visible = v; } },
    { id: 'nuc', type: 'toggle', label: 'Doppelkern im Zentrum', value: true, set: (v) => { nuc.visible = v; } },
    { id: 'core', type: 'range', label: 'Leuchten des Bulge', value: 1, min: 0, max: 2, step: 0.1, unit: '×', set: (v) => { core.material.uniforms.uGain.value = v; core.visible = v > 0; } },
    { id: 'neb', type: 'toggle', group: 'Nebel', label: 'Gas und Staub als 3D-Nebel', value: true, set: (v) => neb.setOn(v) },
    { id: 'nebGas', type: 'range', sub: true, label: 'Leuchten des Gases', value: 1, min: 0, max: 2, step: 0.1, unit: '×', set: (v) => neb.setGas(v), ...nebOnly },
    { id: 'nebDust', type: 'range', sub: true, label: 'Staub', value: 1, min: 0, max: 2, step: 0.1, unit: '×', set: (v) => neb.setDust(v), ...nebOnly },
    { id: 'nebGlim', type: 'toggle', sub: true, label: 'Glimmen der Gaswolken', value: true, set: (v) => neb.setGlim(v), ...nebOnly },
  ]);
  const controls = [
    { id: 'lines', label: 'Linien', value: 'off', options: [['off', 'Aus'], ['on', 'Ringe, Achse, Sichtlinie']], set: (v) => { lines.visible = v === 'on'; } },
    { id: 'labels', label: 'Namen', value: 'off', options: [['off', 'Aus'], ['on', 'Begleitgalaxien']], set: (v) => { labelsOn = v === 'on'; } },
  ];

  const inGal = (v) => v.clone().applyQuaternion(Q);
  const m32 = sats.find((s) => s.name === 'M32'), m110 = sats.find((s) => s.name === 'M110');
  const hotspots = [
    { id: 'mw', kind: 'dive', to: 'galaxy', pos: mwPos },
    { id: 'core', kind: 'info', pos: new THREE.Vector3(), focus: () => 0.012 },
    { id: 'bulge', kind: 'info', pos: inGal(new THREE.Vector3(1.6, 0.9, -1.2)) },
    { id: 'ring', kind: 'info', pos: inGal(new THREE.Vector3(-M31_RINGS[0].R * SCALE * 0.7, 0, M31_RINGS[0].R * SCALE * 0.71)) },
    { id: 'inner', kind: 'info', pos: inGal(new THREE.Vector3(M31_RINGS[1].R * SCALE * 0.71, 0, M31_RINGS[1].R * SCALE * 0.7)), focus: () => 6 },
    { id: 'v1', kind: 'info', pos: V1, focus: () => 3 },
    { id: 'g1', kind: 'info', pos: G1, focus: () => 2, visible: () => haloCloud.visible },
    { id: 'gss', kind: 'info', pos: gssAt(30, 4, 30), visible: () => gss.visible },
    { id: 'halo', kind: 'info', pos: inGal(new THREE.Vector3(30, 45, -20)), visible: () => haloCloud.visible },
    ...(m32 ? [{ id: 'm32', kind: 'info', pos: m32.p, visible: () => satGroup.visible }] : []),
    ...(m110 ? [{ id: 'm110', kind: 'info', pos: m110.p, visible: () => satGroup.visible }] : []),
    { id: 'sats', kind: 'info', pos: sats.find((s) => s.name === 'NGC 185').p, visible: () => satGroup.visible },
    { id: 'm33', kind: 'info', pos: m33.position },
    ...sats.filter((s) => s !== m32 && s !== m110).map((s) => ({ id: `sat-${s.name}`, kind: 'label', cls: 'hsl--faint', pos: s.p, visible: () => labelsOn && satGroup.visible,
      info: { t: s.name, x: `${s.name}: ${{ S: 'sphäroidale', E: 'elliptische', I: 'irreguläre' }[s.type]} Zwerggalaxie, rund ${Math.round(s.p.length() * 3.2616).toLocaleString('de-DE')} Tsd. Lj von Andromedas Mitte (Abstand aus den Entfernungen nach McConnachie 2012).`, s: 'mcconnachie-2012' } })),
  ];

  // Heimpose: Blick von der Erde – auf der Sichtlinie, etwas versetzt, damit die Scheibe räumlich wirkt (77° geneigt)
  const toSun = LOS.clone().negate();
  const home = { pos: toSun.clone().multiplyScalar(44).addScaledVector(SKY, 9), target: new THREE.Vector3() };

  return {
    scene, camera, unit: KPC, hotspots, controls, home,
    ready: neb.ready,
    orbit: { minDistance: 0.004, maxDistance: 1500, cineSpeed: 0.5 },
    look: { exposure: 1.1, bloom: 0.09, sat: 1.08, con: 0.14 },
    update(dt, t, cam) {
      if (playing) T += dt * SPEEDS[spdIdx][0];
      young.material.uniforms.uT.value = T;
      neb.update(t, 0, cam);
    },
    live: () => (T > 0
      ? `Sternentstehung im Zeitraffer: +${Math.round(T).toLocaleString('de-DE')} Mio. Jahre · vor allem im Ring bei 10 kpc`
      : 'Stand heute · 2,5 Mio. Lj entfernt · nähert sich der Milchstraße mit 109 km/s'),
    setPixelRatio(pr, H) {
      for (const o of px) o.userData.setPx(pr, H, camera.fov);
      neb.setSize(Math.round(H * camera.aspect), H);
    },
    dispose: () => { disposeScene(scene); neb.dispose(); },
  };
}
