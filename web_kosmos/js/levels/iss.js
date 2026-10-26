// Station 01A: Internationale Raumstation aus der Nähe (Einheit 1 m), Abstecher von Erde & Mond. Die ISS fliegt im
// Bahnsystem (orbitview.js): Flugrichtung vorn (x), Erde unten (−y), Steuerbord z. Darunter die Erde für den angezeigten
// Zeitpunkt, Sonnenaufgang und Sonnenuntergang alle ≈ 46 min, Erdschein von unten, Polarlichter und Stadtlichter auf der Nachtseite.
// Modell aus Grundkörpern, Maße nach NASA gerundet: Gitterträger 94 m, Solarflügel 34 × 12 m (8 Stück, 109 m Spannweite),
// iROSA 18,2 × 6 m auf sechs Flügeln, Radiatoren, Module von Swesda bis Harmony (67 m), Cupola mit sieben Fenstern.
// Solarflügel folgen der Sonne über zwei Gelenke (großes Drehgelenk um den Träger, kleines um jeden Flügel), Radiatoren
// zeigen ihr die Kante – vereinfachte Regel, kein Flugplan. Blick „Cupola“: Kamera in der Kuppel, Blick zur Erde.

import * as THREE from 'three';
import { mulberry32 } from '../astro.js';
import { createOrbitView, stationMat } from '../orbitview.js';
import { registerLayers, refreshLayers } from '../layers.js';

const RAD = Math.PI / 180;
const TRUSS = { x: 4, y: 4.6, half: 47, inner: 27.5 };   // Gitterträger: Mitte über Destiny, 94 m, Drehgelenke bei ±27,5 m
const WING = { len: 34, w: 12, blanket: 4.6 };            // Solarflügel 112 × 39 Fuß (NASA), zwei Matten je Flügel
const IROSA = { len: 18.2, w: 6 };                        // 60 × 20 Fuß (NASA)
// Flügel je Modul (Seite, Lage z, Kanal oben/unten, iROSA ja/nein): iROSA auf 1A, 3A, 1B, 2B, 4A, 4B (Montagen 2021–2023)
const PVM = [
  { side: 1, z: 34.5, up: ['1A', 1], down: ['3A', 1] }, { side: 1, z: 48.5, up: ['1B', 1], down: ['3B', 0] },
  { side: -1, z: 34.5, up: ['2A', 0], down: ['4A', 1] }, { side: -1, z: 48.5, up: ['2B', 1], down: ['4B', 1] },
];
const CUP_EYE = new THREE.Vector3(-3.0, -2.3, -6.4);       // Augenpunkt am oberen Rand der Cupola (Blick nach unten, Weitwinkel)
const CUP_FOV = 72;

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(...repeat);
  return t;
}

// Texturen (Modell): Solarzellen, Kapton-Rückseite, Isolierdecken mit Schutzplatten, Gitter, Radiator, Fenster
function textures() {
  const rnd = mulberry32(17);
  const cells = (base, line) => canvasTex(128, 1024, (g, w, h) => {
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
      const k = 0.82 + rnd() * 0.3;
      g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
      g.fillRect(x, y, 8, 8);
    }
    g.fillStyle = line;
    for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1);
    for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 1, h);
    g.fillStyle = 'rgb(170,176,190)';
    for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 2);   // Faltkanten der Matte
    g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
  });
  const mli = (tone) => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = tone; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const k = 0.9 + rnd() * 0.12;
      g.fillStyle = `rgba(${200 * k | 0},${196 * k | 0},${186 * k | 0},0.55)`;
      g.fillRect(i * 128 + 4, j * 128 + 4, 120, 120);
      g.strokeStyle = 'rgba(90,88,80,0.55)'; g.lineWidth = 2;
      g.strokeRect(i * 128 + 4, j * 128 + 4, 120, 120);
      g.fillStyle = 'rgba(70,70,64,0.6)';
      for (const [u, v] of [[10, 10], [118, 10], [10, 118], [118, 118]]) g.fillRect(i * 128 + u, j * 128 + v, 3, 3);
    }
  });
  const lattice = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgb(205,207,210)'; g.lineCap = 'square';
    g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    g.lineWidth = 9; g.beginPath(); g.moveTo(8, 8); g.lineTo(w - 8, h - 8); g.moveTo(w - 8, 8); g.lineTo(8, h - 8); g.stroke();
  });
  const rad = canvasTex(64, 512, (g, w, h) => {
    g.fillStyle = '#eef0f0'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(150,155,160,0.5)';
    for (let x = 4; x < w; x += 8) g.fillRect(x, 0, 1, h);
    for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 2);
  });
  // Cupola: sechs Trapezfenster (Seitenfläche) und ein rundes Fenster von 80 cm (Boden), Glas fast durchsichtig
  const win = canvasTex(768, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = 'rgb(214,214,206)'; g.fillRect(i * 128, 0, 128, h);
      g.fillStyle = 'rgba(20,30,45,0.12)'; g.fillRect(i * 128 + 16, 20, 96, h - 40);
      g.clearRect(i * 128 + 18, 22, 92, h - 44);
      g.fillStyle = 'rgba(40,60,90,0.14)'; g.fillRect(i * 128 + 18, 22, 92, h - 44);
    }
  });
  const top = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = 'rgb(214,214,206)'; g.fillRect(0, 0, w, h);
    g.save(); g.beginPath(); g.arc(w / 2, h / 2, w * 0.21, 0, Math.PI * 2); g.clip(); g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,60,90,0.14)'; g.fillRect(0, 0, w, h); g.restore();
  });
  return {
    cells: cells([28, 38, 82], 'rgb(60,72,110)'), irosa: cells([22, 26, 40], 'rgb(52,58,78)'),
    back: canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#b48a4e'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(90,60,30,0.35)'; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 1); }),
    mliUS: mli('#dcd8cc'), mliRU: mli('#cfd2c6'), lattice, rad, win, top,
  };
}

export function create(ctx) {
  const ov = createOrbitView(ctx, { sat: 'ISS (ZARYA)', fallback: [6797.6, 0.00069, 51.63, 15.24, 308.06, 51.97, -0.4267, 3], radius: 70 });
  const { scene, camera } = ov;
  const T = textures();
  const station = new THREE.Group();
  scene.add(station);

  // ---------- Materialien ----------
  const M = {
    us: stationMat({ map: T.mliUS, roughness: 0.78, metalness: 0.02 }),
    ru: stationMat({ map: T.mliRU, roughness: 0.7, metalness: 0.05 }),
    metal: stationMat({ color: 0xa9aeb5, roughness: 0.42, metalness: 0.6 }),
    dark: stationMat({ color: 0x3d4148, roughness: 0.6, metalness: 0.5 }),
    lattice: stationMat({ map: T.lattice, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.45 }),
    cells: stationMat({ map: T.cells, roughness: 0.32, metalness: 0.35 }),
    irosa: stationMat({ map: T.irosa, roughness: 0.28, metalness: 0.45 }),
    back: stationMat({ map: T.back, roughness: 0.5, metalness: 0.2 }),
    rad: stationMat({ map: T.rad, roughness: 0.38, metalness: 0.05 }),
    arm: stationMat({ color: 0xe9e9e4, roughness: 0.6, metalness: 0.05 }),
    win: stationMat({ map: T.win, side: THREE.DoubleSide, roughness: 0.15, metalness: 0.3 }),
    top: stationMat({ map: T.top, side: THREE.DoubleSide, roughness: 0.15, metalness: 0.3 }),
  };
  T.mliUS.repeat.set(3, 2); T.mliRU.repeat.set(3, 3);

  const add = (parent, geo, mat, pos, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // Modul als Zylinder entlang einer Achse
  const tube = (r, len, ax, pos, mat = M.us, r2 = r) => {
    const g = new THREE.CylinderGeometry(r2, r, len, 40, 1);
    if (ax === 'x') g.rotateZ(-Math.PI / 2); else if (ax === 'z') g.rotateX(Math.PI / 2);
    return add(station, g, mat, pos);
  };

  // ---------- Druckmodule (vorn → achtern) ----------
  tube(1.4, 1.6, 'x', [16.25, 0, 0], M.metal, 1.0);       // PMA-2 mit Kopplungsadapter
  tube(2.2, 7.2, 'x', [11.85, 0, 0]);                      // Harmony
  tube(2.25, 6.9, 'z', [11.85, 0, 5.65]);                  // Columbus (ESA)
  tube(2.2, 11.2, 'z', [11.85, 0, -7.8]);                  // Kibo, Druckmodul (JAXA)
  tube(2.1, 4.2, 'y', [11.85, 4.3, -8.5]);                 // Kibo, Logistikmodul
  add(station, new THREE.BoxGeometry(4.6, 1.6, 5.6), M.metal, [11.85, -0.4, -16.2]);   // Kibo, Außenplattform
  [[-1.2, 0.6, -15], [1.3, 0.9, -17.2], [0, 0.5, -18.2]].forEach((p) => add(station, new THREE.BoxGeometry(1.4, 1.2, 1.3), M.us, [11.85 + p[0], 0.4 + p[1], p[2]]));
  tube(2.15, 8.5, 'x', [4.0, 0, 0]);                       // Destiny
  tube(2.3, 5.5, 'x', [-3.0, 0, 0]);                       // Unity
  tube(2.0, 5.5, 'z', [-3.0, 0, 5.05]);                    // Quest (Luftschleuse)
  tube(2.25, 6.7, 'z', [-3.0, 0, -5.65]);                  // Tranquility
  tube(2.2, 4.5, 'x', [1.5, 0, -7.0]);                     // Leonardo (vorn an Tranquility)
  tube(1.4, 1.9, 'x', [-6.7, 0, 0], M.metal, 1.0);        // PMA-1
  tube(2.05, 12.6, 'x', [-14.1, 0, 0], M.ru);              // Sarja
  tube(1.15, 6.0, 'y', [-16.5, -5.0, 0], M.ru);            // Rasswet
  add(station, new THREE.SphereGeometry(1.35, 24, 16), M.ru, [-21.3, 0, 0]);   // Kopplungsknoten Swesda
  tube(1.45, 4.0, 'x', [-24.0, 0, 0], M.ru);               // Swesda, Arbeitsteil
  tube(2.1, 7.5, 'x', [-29.75, 0, 0], M.ru);               // Swesda, hinten
  tube(1.25, 4.0, 'y', [-21.3, 3.3, 0], M.ru);             // Poisk
  tube(2.1, 13.0, 'y', [-21.3, -7.8, 0], M.ru);            // Nauka
  add(station, new THREE.SphereGeometry(1.7, 24, 16), M.ru, [-21.3, -16.0, 0]);   // Pritschal

  // Cupola: sechseckige Kuppel unter Tranquility, schmale Seite zur Erde
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.475, 1.0, 1.5, 6, 1), [M.win, M.us, M.top]);
  cup.position.set(-3.0, -2.95, -6.4);
  cup.receiveShadow = true;
  station.add(cup);

  // ---------- Gitterträger: Mittelteil fest, Außenteile drehen mit den Drehgelenken ----------
  const SEG = 4.7;
  const truss = (parent, z0, z1, dx = 0, dy = 0) => {
    for (let z = z0; z < z1 - 0.1; z += SEG) {
      const l = Math.min(SEG, z1 - z), c = z + l / 2;
      add(parent, new THREE.BoxGeometry(4.5, 3.0, l), M.lattice, [dx, dy, c]);
      add(parent, new THREE.BoxGeometry(2.4, 1.6, l * 0.96), M.dark, [dx, dy, c]);
    }
  };
  truss(station, -TRUSS.inner, TRUSS.inner, TRUSS.x, TRUSS.y);
  const sarj = [], bga = [], rads = [], irosaMeshes = [];
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(TRUSS.x, TRUSS.y, 0);
    station.add(g);
    sarj.push(g);
    add(g, new THREE.CylinderGeometry(2.5, 2.5, 1.4, 32).rotateX(Math.PI / 2), M.metal, [0, 0, side * TRUSS.inner]);
    if (side > 0) truss(g, TRUSS.inner + 0.7, TRUSS.half); else truss(g, -TRUSS.half, -TRUSS.inner - 0.7);
  }
  // Solarflügel: je Modul zwei Flügel (oben/unten), jede Matte 4,6 m breit, Mast in der Mitte; Zellenseite +x
  const wingMesh = (parent, sgn, iro) => {
    const w = new THREE.Group();
    parent.add(w);
    for (const dz of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, WING.len, WING.blanket), [M.cells, M.back, M.back, M.back, M.back, M.back]);
      m.position.set(0, sgn * (2 + WING.len / 2), dz * (WING.w / 2 - WING.blanket / 2));
      m.castShadow = m.receiveShadow = true;
      w.add(m);
    }
    add(w, new THREE.CylinderGeometry(0.22, 0.22, WING.len + 0.5, 10), M.metal, [0, sgn * (1.8 + WING.len / 2), 0]);
    add(w, new THREE.BoxGeometry(0.8, 0.5, WING.w), M.metal, [0, sgn * (2 + WING.len), 0]);
    add(w, new THREE.BoxGeometry(1.1, 1.6, 2.4), M.metal, [0, sgn * 1.2, 0]);
    if (iro) {
      // iROSA: auf einem Rahmen über der Zellenseite, schräg nach außen aufgestellt
      const r = new THREE.Group();
      r.position.set(0.25, sgn * 3.0, 0);
      r.rotation.z = sgn * 9 * RAD;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, IROSA.len, IROSA.w), [M.irosa, M.back, M.back, M.back, M.back, M.back]);
      m.position.set(0, sgn * IROSA.len / 2, 0);
      m.castShadow = m.receiveShadow = true;
      r.add(m);
      add(r, new THREE.BoxGeometry(0.3, IROSA.len, 0.25), M.metal, [-0.12, sgn * IROSA.len / 2, 0]);
      w.add(r);
      irosaMeshes.push(r);
    }
    return w;
  };
  for (const p of PVM) {
    const parent = sarj[p.side > 0 ? 0 : 1];
    const base = new THREE.Group();
    base.position.set(0, 0, p.side * p.z);
    parent.add(base);
    add(base, new THREE.BoxGeometry(3.2, 3.2, 3.2), M.metal, [0, 0, 0]);
    const up = wingMesh(base, 1, p.up[1]), down = wingMesh(base, -1, p.down[1]);
    bga.push(up, down);
  }
  // Radiatoren an S1/P1: je Seite drei Platten 23 × 3,2 m, drehbar um die Trägerachse
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(TRUSS.x, TRUSS.y - 1.5, 0);
    station.add(g);
    rads.push(g);
    for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(0.12, 23, 3.2), M.rad, [0, -12.3, side * (11 + i * 3.8)]);
    add(g, new THREE.BoxGeometry(1.0, 1.4, 11.6), M.metal, [0, -0.6, side * 14.8]);
  }
  // Solarflügel von Swesda (zwei Flügel quer, drehen um ihre Längsachse)
  const zvWings = [];
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(-31.0, 0, side * 2.4);
    station.add(g);
    zvWings.push(g);
    const m = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.05, 13), [M.back, M.back, M.cells, M.back, M.back, M.back]);
    m.position.set(0, 0, side * 6.9);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  // Roboterarm Canadarm2 (vereinfacht) in Parkstellung über Destiny
  const armPts = [[5.5, 6.4, -4.0], [12.5, 9.5, -6.5], [19.0, 4.8, -5.0]];
  for (let i = 0; i < 2; i++) {
    const a = new THREE.Vector3(...armPts[i]), b = new THREE.Vector3(...armPts[i + 1]);
    const m = add(station, new THREE.CylinderGeometry(0.18, 0.18, a.distanceTo(b), 12), M.arm, [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  armPts.forEach((p) => add(station, new THREE.SphereGeometry(0.42, 16, 12), M.arm, p));

  // ---------- Nachführung: Drehgelenk um den Träger (α), Flügelgelenk (β), Radiatoren mit der Kante zur Sonne ----------
  let track = true, first = true;
  const ang = { a: 0, b: 0, r: 0, z: 0 };
  const approach = (cur, goal, maxStep) => {
    let d = goal - cur;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return cur + THREE.MathUtils.clamp(d, -maxStep, maxStep);
  };
  function steer(dt) {
    const s = ov.sun;
    const goalA = track ? Math.atan2(s.y, s.x) : 0;
    const goalB = track ? -Math.asin(THREE.MathUtils.clamp(s.z, -1, 1)) : 0;
    // Radiatoren: Kante zur Sonne, Länge nach achtern (sin γ ≤ 0), sonst stießen sie an Kibo
    const th = Math.atan2(s.y, s.x), gr = Math.cos(th) >= 0 ? th - Math.PI / 2 : th + Math.PI / 2;
    const goalR = track ? THREE.MathUtils.clamp(Math.atan2(Math.sin(gr), Math.cos(gr)), -100 * RAD, 0) : 0;
    const goalZ = track ? Math.atan2(-s.x, s.y) : 0;
    const step = first ? 10 : dt * 40 * RAD;
    first = false;
    ang.a = approach(ang.a, goalA, step); ang.b = approach(ang.b, goalB, step);
    ang.r = approach(ang.r, goalR, step); ang.z = approach(ang.z, goalZ, step);
    sarj.forEach((g) => { g.rotation.z = ang.a; });
    bga.forEach((g) => { g.rotation.y = ang.b; });
    rads.forEach((g) => { g.rotation.z = ang.r; });
    zvWings.forEach((g) => { g.rotation.z = ang.z; });
  }

  // ---------- Posen, Blick „Cupola“ ----------
  const home = { pos: new THREE.Vector3(108, 30, 36), target: new THREE.Vector3(0, -2, 0) };
  const orbit = { minDistance: 22, maxDistance: 900, cineSpeed: 0.5 };
  const view = { mode: 'out', t: 1, from: null, fov0: 40 };
  const cupTarget = CUP_EYE.clone().add(new THREE.Vector3(0.12, -0.42, 0.05));
  const ease = (x) => x * x * (3 - 2 * x);
  // Innenlicht der Kuppel (nur im Blick „Cupola“), Bahnspur dort aus: sie läuft genau unter der Station durch
  const cabin = new THREE.PointLight(0xe4e9f0, 0, 4, 2);
  cabin.position.copy(CUP_EYE).add(new THREE.Vector3(0, 0.3, 0));
  scene.add(cabin);
  let trackOn = true;
  function setView(v) { view.mode = v; view.t = 0; view.from = null; ov.setTrack(trackOn && v === 'out'); }

  // ---------- Abzeichen ----------
  const wp = (obj, x, y, z) => () => obj.localToWorld(new THREE.Vector3(x, y, z));
  const S = {
    arrays: wp(bga[2], 0, 22, 0), irosa: wp(irosaMeshes[irosaMeshes.length - 1], 0.1, -9, 0), radiators: wp(rads[0], 0, -14, 15),
  };
  const out = () => view.mode === 'out';
  const hs = {
    cupola: { id: 'cupola', kind: 'info', pos: new THREE.Vector3(-3.0, -3.9, -6.4), focus: () => 12, visible: out },
    labs: { id: 'labs', kind: 'info', pos: new THREE.Vector3(11.85, 2.6, 3), focus: () => 30 },
    truss: { id: 'truss', kind: 'info', pos: new THREE.Vector3(TRUSS.x, TRUSS.y + 1.6, -18), focus: () => 45 },
    arrays: { id: 'arrays', kind: 'info', pos: new THREE.Vector3(), focus: () => 55 },
    irosa: { id: 'irosa', kind: 'info', pos: new THREE.Vector3(), focus: () => 40 },
    radiators: { id: 'radiators', kind: 'info', pos: new THREE.Vector3(), focus: () => 35 },
    russian: { id: 'russian', kind: 'info', pos: new THREE.Vector3(-26, 2.4, 0), focus: () => 35 },
    horizon: { id: 'horizon', kind: 'info', pos: ov.spots.horizon, visible: () => view.mode === 'out' },
    below: { id: 'below', kind: 'info', pos: ov.spots.below },
    sun: { id: 'sun', kind: 'info', pos: ov.spots.sun, visible: () => ov.lit > 0.5 },
  };
  for (const k of ['labs', 'truss', 'arrays', 'irosa', 'radiators', 'russian']) hs[k].visible = out;
  const hotspots = Object.values(hs);
  function placeHotspots() {
    station.updateMatrixWorld(true);
    hs.arrays.pos.copy(S.arrays()); hs.irosa.pos.copy(S.irosa()); hs.radiators.pos.copy(S.radiators());
  }

  // ---------- Ebenen (Zahnrad „Station · ISS“) und Infotafel ----------
  registerLayers('iss', [
    ov.layers.clock('ISS'),
    { id: 'irosa', type: 'toggle', group: 'Station', label: 'iROSA (neue Solarflügel)', value: true, set: (v) => { irosaMeshes.forEach((m) => { m.visible = v; }); } },
    { id: 'boost', type: 'toggle', label: 'Im Erdschatten aufhellen', hint: 'Echt ist die Station im Schatten fast schwarz; aufgehellt bleibt sie erkennbar.', value: true, set: (v) => ov.setBoost(v) },
    { id: 'orbit', type: 'toggle', group: 'Bahn', label: 'Bahnspur am Boden', hint: 'Gelbe Linie: der Weg der Station über den Boden, ein halber Umlauf zurück und anderthalb voraus (im Blick „Cupola“ aus).', value: true, set: (v) => { trackOn = v; ov.setTrack(v && view.mode === 'out'); } },
    ...ov.layers.earth(),
  ]);
  const controls = [
    { id: 'view', label: 'Blick', value: 'out', options: [['out', 'Außen'], ['cupola', 'Cupola']], set: setView },
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: ov.speed, min: 0, max: ov.SPEEDS.length - 1, step: 1, fmt: (i) => (i ? ov.SPEEDS[Math.round(i)][1] : 'Echtzeit'),
      set: (v) => { ov.setSpeed(Math.round(v)); refreshLayers(); }, get: () => ov.speed },
    { id: 'wings', label: 'Solarflügel', value: 'track', options: [['track', 'Der Sonne nach'], ['fixed', 'Fest']], set: (v) => { track = v === 'track'; } },
  ];

  const look = { exposure: 1.0, bloom: 0.07, sat: 1.05 };
  return {
    scene, camera, home, unit: 1, hotspots, controls, look, orbit,
    ready: ov.ready,
    update(dt, t, cam, flying) {
      ov.update(dt, t, cam, flying);
      steer(flying ? 1 : dt);
      cabin.intensity = view.mode === 'cupola' ? 2.2 * ease(view.t) : 0;
      placeHotspots();
    },
    orbitUpdate(c, dt) {
      const o = c.object;
      let free;
      if (view.t < 1) {
        if (!view.from) {
          view.from = { pos: o.position.clone(), target: c.target.clone(), fov: camera.fov };
          if (view.mode === 'cupola' && camera.fov !== CUP_FOV) view.fov0 = camera.fov;
          free = 'free';
          Object.assign(c, { minDistance: 0, maxDistance: Infinity, minPolarAngle: 0, maxPolarAngle: Math.PI });
        }
        const goal = view.mode === 'cupola' ? { pos: CUP_EYE, target: cupTarget } : home;
        view.t = Math.min(1, view.t + dt / (ctx.still ? 0.5 : 2.6));
        const e = ease(view.t);
        // Abstand logarithmisch, damit die Fahrt in die Kuppel nicht am Ende ruckartig bremst
        const fd = view.from.pos.distanceTo(view.from.target), gd = goal.pos.distanceTo(goal.target);
        c.target.lerpVectors(view.from.target, goal.target, e);
        const dir = view.from.pos.clone().sub(view.from.target).normalize().lerp(goal.pos.clone().sub(goal.target).normalize(), e).normalize();
        o.position.copy(c.target).addScaledVector(dir, Math.exp(Math.log(fd) + (Math.log(gd) - Math.log(fd)) * e));
        o.lookAt(c.target);
        camera.fov = THREE.MathUtils.lerp(view.from.fov, view.mode === 'cupola' ? CUP_FOV : view.fov0, e);
        camera.updateProjectionMatrix();
        if (view.t >= 1) {
          if (view.mode === 'cupola') Object.assign(c, { minDistance: gd * 0.98, maxDistance: gd * 1.02, maxPolarAngle: 75 * RAD });
          else Object.assign(c, orbit, { maxPolarAngle: Math.PI });
        }
      } else if (view.mode === 'cupola' && camera.fov !== CUP_FOV) { camera.fov = CUP_FOV; camera.updateProjectionMatrix(); }
      return free;
    },
    widget: () => `<table><thead><tr><th>ISS im Moment</th><th>Wert</th></tr></thead><tbody id="w-orb"><tr><td colspan="2">Bahn wird geladen …</td></tr></tbody></table><p class="w-foot">Bahn aus den CelesTrak-Bahnelementen (Stand 25.10.2026), fortgeschrieben mit Kepler + J2; Sonnenaufgang und Sonnenuntergang aus dem Erdschatten (Zylinder).</p>`,
    widgetTick(el, t) {
      ov.widgetTick(el, t, () => `<tr><td>ein Umlauf · Sonne zur Bahnebene</td><td class="num">${ov.info.period.toFixed(1).replace('.', ',')} min · ${Math.round(ov.info.beta)}°</td></tr>`);
    },
    live: () => `über ${ov.where()} · ${ov.lit > 0.5 ? 'Tag' : 'Nacht im Erdschatten'} · ${ov.speed ? `Zeitraffer ${ov.SPEEDS[ov.speed][1]}` : 'Echtzeit'}`,
    setPixelRatio: (p) => ov.setPixelRatio(p),
    dispose() {
      ov.dispose();
      Object.values(T).forEach((x) => x.dispose());
    },
  };
}
