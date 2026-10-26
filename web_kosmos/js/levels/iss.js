// Station 01A: Internationale Raumstation aus der Nähe (Einheit 1 m), Abstecher von Erde & Mond. Die ISS fliegt im
// Bahnsystem (orbitview.js): Flugrichtung vorn (x), Erde unten (−y), Steuerbord z. Darunter die Erde für den angezeigten
// Zeitpunkt, Sonnenaufgang und Sonnenuntergang alle ≈ 46 min, Erdschein von unten, Polarlichter und Stadtlichter auf der Nachtseite.
// Modell nach NASA-Maßen (gerundet) und Fotos: Gitterträger 94 m als Fachwerk mit Geräteboxen und Schienen, Solarflügel
// 34 × 12 m (8 Stück, 109 m Spannweite) mit FAST-Mast, iROSA 18,2 × 6 m auf sechs Flügeln, Radiatoren aus je 8 Platten,
// Module von Swesda bis Harmony (67 m) mit Isolierdecken, Haltegriffen und Geräten, Cupola mit sieben Fenstern und offenen
// Läden, Z1 mit Ku-Band-Antenne, AMS-02, vier ELC-Plattformen, BEAM, Bishop, Canadarm2 auf der Mobilen Basis, ERA an
// Nauka. Besuchsschiffe in typischer Belegung (Modell, nicht der Flugplan): Crew Dragon an Harmony vorn, Cargo Dragon an
// Harmony oben, Sojus an Rasswet, Progress an Swesda hinten und an Poisk. Oberflächen aus stationkit.js.
// Solarflügel folgen der Sonne über zwei Gelenke (großes Drehgelenk um den Träger, kleines um jeden Flügel), Radiatoren
// zeigen ihr die Kante – vereinfachte Regel, kein Flugplan. Blick „Cupola“: Kamera in der Kuppel, Blick zur Erde.

import * as THREE from 'three';
import { mulberry32 } from '../astro.js';
import { createOrbitView, stationMat } from '../orbitview.js';
import { stationKit, V } from '../stationkit.js';
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
const TILE = 3;                                            // Kachel der Isolierdecken auf den Modulen [m] (4 × 4 Felder)
const GREYS = [0xf0efe9, 0xd5d7da, 0xa4a8ae, 0x5d6168, 0x3a3d42].map((x) => new THREE.Color(x));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Cupola: sechs Trapezfenster (Seitenfläche) und ein rundes Fenster von 80 cm (Boden), Glas fast durchsichtig
function cupolaTextures() {
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
  return { win, top };
}

export function create(ctx) {
  const ov = createOrbitView(ctx, { sat: 'ISS (ZARYA)', fallback: [6797.6, 0.00069, 51.63, 15.24, 308.06, 51.97, -0.4267, 3], radius: 70 });
  const { scene, camera } = ov;
  const K = stationKit(ctx), mat = K.mat;
  const C = cupolaTextures();
  const station = new THREE.Group();
  scene.add(station);
  const I = K.inst(station);

  const M = {
    win: stationMat({ map: C.win, side: THREE.DoubleSide, roughness: 0.15, metalness: 0.3 }),
    top: stationMat({ map: C.top, side: THREE.DoubleSide, roughness: 0.15, metalness: 0.3 }),
    arm: stationMat({ color: 0xe9e9e4, roughness: 0.6, metalness: 0.05 }),
  };

  const add = (parent, geo, m, pos, rot) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(...pos);
    if (rot) o.rotation.set(...rot);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  // Modul als Zylinder entlang einer Achse, Muster in Metern; dress = Ringe, Haltegriffe, Geräte (false = ohne)
  let seed = 100;
  const tube = (r, len, ax, pos, m = mat('us'), r2 = r, dress = {}) => {
    const g = K.tubeUV(new THREE.CylinderGeometry(r2, r, len, 48, 1), Math.max(r, r2), len, TILE);
    if (ax === 'x') g.rotateZ(-Math.PI / 2); else if (ax === 'z') g.rotateX(Math.PI / 2);
    const o = add(station, g, m, pos);
    if (dress) K.dress(I, ax, V(...pos), Math.max(r, r2), len, { seed: seed++, ...dress });
    return o;
  };
  const RU = { rail: 'railGrey', rails: 5 };

  // ---------- Druckmodule (vorn → achtern) ----------
  tube(1.4, 1.6, 'x', [16.25, 0, 0], mat('us'), 1.0, false);   // PMA-2 mit Kopplungsadapter IDA-2
  I.rod(V(17.05, 0, 0), V(17.45, 0, 0), 0.95, mat('metal'), K.U.disk).rod(V(17.0, 0, 0), V(17.15, 0, 0), 1.05, mat('dark'), K.U.disk);
  tube(2.2, 7.2, 'x', [11.85, 0, 0]);                        // Harmony
  tube(1.4, 1.6, 'y', [11.85, 3.0, 0], mat('us'), 1.0, false); // PMA-3 oben mit IDA-3
  I.rod(V(11.85, 3.8, 0), V(11.85, 4.2, 0), 0.95, mat('metal'), K.U.disk).rod(V(11.85, 3.75, 0), V(11.85, 3.9, 0), 1.05, mat('dark'), K.U.disk);
  tube(2.25, 6.9, 'z', [11.85, 0, 5.65]);                    // Columbus (ESA)
  tube(2.2, 11.2, 'z', [11.85, 0, -7.8]);                    // Kibo, Druckmodul (JAXA)
  tube(2.1, 4.2, 'y', [11.85, 4.3, -8.5], mat('us'), 2.1, { rails: 4 });   // Kibo, Logistikmodul
  tube(2.15, 8.5, 'x', [4.0, 0, 0]);                         // Destiny
  tube(2.3, 5.5, 'x', [-3.0, 0, 0]);                         // Unity
  tube(2.0, 5.5, 'z', [-3.0, 0, 5.05]);                      // Quest (Luftschleuse)
  tube(2.25, 6.7, 'z', [-3.0, 0, -5.65]);                    // Tranquility
  tube(2.2, 4.5, 'x', [1.5, 0, -7.0], mat('us'), 2.2, { rails: 4 });   // Leonardo (vorn an Tranquility)
  tube(1.4, 1.9, 'x', [-6.7, 0, 0], mat('us'), 1.0, false);  // PMA-1
  tube(2.05, 12.6, 'x', [-14.1, 0, 0], mat('ru'), 2.05, RU); // Sarja
  tube(1.15, 6.0, 'y', [-16.5, -5.0, 0], mat('ru'), 1.15, { ...RU, rails: 3 });   // Rasswet
  add(station, new THREE.SphereGeometry(1.35, 32, 20), mat('ru'), [-21.3, 0, 0]);  // Kopplungsknoten Swesda
  tube(1.45, 4.0, 'x', [-24.0, 0, 0], mat('ru'), 1.45, { ...RU, rails: 4 });      // Swesda, Arbeitsteil
  tube(2.1, 7.5, 'x', [-29.75, 0, 0], mat('ru'), 2.1, RU);   // Swesda, hinten
  tube(1.25, 4.0, 'y', [-21.3, 3.3, 0], mat('ru'), 1.25, { ...RU, rails: 3 });    // Poisk
  tube(2.1, 13.0, 'y', [-21.3, -7.8, 0], mat('ru'), 2.1, RU);  // Nauka
  add(station, new THREE.SphereGeometry(1.7, 32, 20), mat('ru'), [-21.3, -16.0, 0]);  // Pritschal
  // Swesda: Kurs-Antenne und Stabantennen am Heck
  I.rod(V(-32.6, 2.0, 0.8), V(-32.6, 3.3, 1.4), 0.04, mat('metal')).rod(V(-31.2, -2.0, -0.6), V(-31.2, -3.4, -1.2), 0.03, mat('metal'));
  I.rod(V(-32.6, 3.3, 1.4), V(-32.6, 3.42, 1.46), 0.42, mat('box'), K.U.disk);
  // Quest: vier Gasdruckbehälter (Sauerstoff, Stickstoff) außen
  for (const a of [45, 135, 225, 315]) I.ball(V(-3.0 + Math.cos(a * RAD) * 2.45, Math.sin(a * RAD) * 2.45, 6.4), 0.55, mat('us'));
  // BEAM: aufblasbares Modul an Tranquility achtern (Stoffhülle), Bishop: Schleuse in Glockenform an Tranquility backbord
  tube(1.6, 3.4, 'x', [-7.0, 0, -7.0], mat('beam'), 1.6, false);
  for (const s of [-1, 1]) { const cap = add(station, new THREE.SphereGeometry(1.6, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('beam'), [-7.0 + s * 1.7, 0, -7.0]); cap.rotation.z = -s * Math.PI / 2; cap.scale.y = 0.35; }
  const bishop = add(station, new THREE.LatheGeometry([[1.0, 0], [1.05, 0.3], [1.55, 0.85], [1.82, 1.45], [1.78, 1.9], [1.2, 2.15], [0.05, 2.2]].map(([r, y]) => new THREE.Vector2(r, y)), 48), mat('us'), [-3.0, 0, -9.0]);
  bishop.rotation.x = -Math.PI / 2;
  I.rod(V(-3, 0, -10.35), V(-3, 0, -10.6), 1.84, mat('gold'), K.U.ring);

  // Kibo: Außenplattform mit Nutzlasten, Roboterarm in Parkstellung; Columbus: Nutzlasten am Ende und Bartolomeo vorn
  const rp = mulberry32(7);
  const payload = (pos, s) => (rp() < 0.3 ? I.box(pos, s, mat('gold')) : I.box(pos, s, mat('box'), null, GREYS[(rp() * 4) | 0]));
  I.box(V(11.85, -0.4, -16.2), [4.4, 0.7, 5.4], mat('us'));
  for (const [dx, dz] of [[-1.3, -14.5], [1.2, -15.4], [-1.1, -16.9], [1.3, -17.6], [0, -18.4]]) { const s = [1.3 + rp() * 0.5, 0.8 + rp() * 0.7, 1.1 + rp() * 0.4]; payload(V(11.85 + dx, -0.05 + s[1] / 2, dz), s); }
  for (const [p, q] of [[V(11.85, 2.3, -11.0), V(11.85, 3.6, -13.4)], [V(11.85, 3.6, -13.4), V(12.6, 2.8, -15.6)]]) I.rod(p, q, 0.13, M.arm);
  for (const dx of [-0.9, 0.9]) for (const dy of [-1, 1]) payload(V(11.85 + dx, dy * 2.65, 8.0), [1.1, 0.75, 1.2]);
  I.box(V(14.35, 0.4, 6.4), [0.3, 2.4, 2.6], mat('metal'));
  payload(V(14.9, 1.0, 6.0), [0.8, 1.0, 1.0]); payload(V(14.9, -0.3, 6.8), [0.8, 0.9, 1.1]);

  // Cupola: sechseckige Kuppel unter Tranquility, schmale Seite zur Erde; Läden der Seitenfenster offen nach außen
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.475, 1.0, 1.5, 6, 1), [M.win, mat('us'), M.top]);
  cup.position.set(-3.0, -2.95, -6.4);
  cup.receiveShadow = true;
  station.add(cup);
  {
    const q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), up = V(0, 1, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i + 0.5) * Math.PI / 3, rad = V(Math.sin(a), 0, Math.cos(a)), tan = V(Math.cos(a), 0, -Math.sin(a));
      const dir = rad.clone().multiplyScalar(Math.cos(20 * RAD)).addScaledVector(up, Math.sin(20 * RAD));
      const hinge = V(-3.0, -2.2, -6.4).addScaledVector(rad, 1.3);
      q.setFromRotationMatrix(m4.makeBasis(tan, dir, new THREE.Vector3().crossVectors(tan, dir)));
      I.box(hinge.addScaledVector(dir, 0.72), [1.1, 1.4, 0.05], mat('us'), q);
    }
  }

  // Z1 auf Unity mit Ku-Band-Antenne (Schüssel auf Ausleger)
  I.box(V(-3.0, 3.45, 0), [3.0, 2.3, 3.2], mat('us'));
  I.rod(V(-3.0, 4.5, 1.0), V(-3.0, 6.3, 2.3), 0.09, mat('metal'));
  const dish = add(station, new THREE.LatheGeometry(Array.from({ length: 9 }, (_, i) => new THREE.Vector2(i * 0.12, (i * 0.12) ** 2 * 0.35)), 40), mat('paint'), [-3.0, 6.35, 2.35]);
  dish.rotation.x = 0.55;
  dish.material.side = THREE.DoubleSide;

  // ---------- Gitterträger: Fachwerk mit Geräteboxen, Schienen der Mobilen Basis, Kabelkanal; Außenteile drehen ----------
  const truss = (J, z0, z1, cx, cy, sd) => {
    const rnd = mulberry32(sd);
    K.lattice(J, V(cx, cy, z0), V(cx, cy, z1), { w: 4.5, h: 3.0, bay: 2.35, r: 0.08, m: mat('strut'), side: V(1, 0, 0) });
    const n = Math.max(1, Math.round((z1 - z0) / 2.35)), L = (z1 - z0) / n;
    for (let i = 0; i < n; i++) {
      const z = z0 + (i + 0.5) * L, pick = rnd(), s = [2.2 + rnd() * 1.0, 1.1 + rnd() * 0.8, L * (0.55 + rnd() * 0.35)];
      if (pick < 0.22) J.box(V(cx, cy, z), s, mat('gold'));
      else if (pick < 0.45) J.box(V(cx, cy, z), s, mat('us'));
      else J.box(V(cx, cy, z), s, mat('box'), null, GREYS[(rnd() * GREYS.length) | 0]);
      if (rnd() < 0.55) {
        const t = [0.8 + rnd() * 0.8, 0.45 + rnd() * 0.4, 0.7 + rnd() * 0.7], sg = rnd() < 0.5 ? 1 : -1;
        J.box(V(cx - 0.8 + rnd() * 1.6, cy + sg * (1.5 + t[1] / 2), z), t, mat('box'), null, GREYS[(rnd() * 3) | 0]);
      }
    }
    for (const dy of [-1.1, 1.1]) J.rod(V(cx + 2.35, cy + dy, z0), V(cx + 2.35, cy + dy, z1), 0.06, mat('metal'));
    J.rod(V(cx - 1.95, cy + 1.6, z0), V(cx - 1.95, cy + 1.6, z1), 0.13, mat('dark'));
  };
  truss(I, -TRUSS.inner, TRUSS.inner, TRUSS.x, TRUSS.y, 3);
  const sarj = [], bga = [], rads = [], irosaMeshes = [], late = [];
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(TRUSS.x, TRUSS.y, 0);
    station.add(g);
    sarj.push(g);
    const J = K.inst(g);
    late.push(J);
    J.rod(V(0, 0, side * (TRUSS.inner - 0.7)), V(0, 0, side * (TRUSS.inner + 0.7)), 2.5, mat('metal'), K.U.disk);
    for (const dz of [-0.55, 0.55]) J.rod(V(0, 0, side * TRUSS.inner + dz - 0.08), V(0, 0, side * TRUSS.inner + dz + 0.08), 2.56, mat('dark'), K.U.ring);
    if (side > 0) truss(J, TRUSS.inner + 0.7, TRUSS.half, 0, 0, 11); else truss(J, -TRUSS.half, -TRUSS.inner - 0.7, 0, 0, 12);
  }

  // Solarflügel: je Modul zwei Flügel (oben/unten), zwei Matten je 4,6 m mit FAST-Mast dazwischen; Zellenseite +x
  const wingMesh = (parent, sgn, iro) => {
    const w = new THREE.Group();
    parent.add(w);
    const J = K.inst(w);
    for (const dz of [-1, 1]) {
      const z = dz * (WING.w / 2 - WING.blanket / 2);
      const m = new THREE.Mesh(K.boxUV(new THREE.BoxGeometry(0.03, WING.len, WING.blanket), 2.3, 2.6), K.panel('cells'));
      m.position.set(0, sgn * (2 + WING.len / 2), z);
      m.castShadow = m.receiveShadow = true;
      w.add(m);
      J.box(V(0, sgn * 1.75, z), [0.45, 0.5, WING.blanket + 0.2], mat('us'));            // Deckenkasten
      J.box(V(0, sgn * (2.1 + WING.len), z), [0.3, 0.25, WING.blanket + 0.1], mat('metal')); // Spitze
    }
    K.lattice(J, V(0, sgn * 1.6, 0), V(0, sgn * (2.15 + WING.len), 0), { w: 0.75, bay: 0.62, r: 0.035, m: mat('strut'), side: V(1, 0, 0) });
    J.rod(V(0, sgn * 0.3, 0), V(0, sgn * 1.6, 0), 0.55, mat('gold'), K.U.disk);            // Mastkanister
    J.box(V(0, sgn * (2.25 + WING.len), 0), [0.4, 0.3, WING.w + 0.3], mat('metal'));     // Spitzenbalken
    if (iro) {
      // iROSA: auf einem Rahmen über der Zellenseite, schräg nach außen aufgestellt; Verbundausleger an beiden Kanten,
      // Rolle an der Spitze
      const r = new THREE.Group();
      r.position.set(0.25, sgn * 3.0, 0);
      r.rotation.z = sgn * 9 * RAD;
      const m = new THREE.Mesh(K.boxUV(new THREE.BoxGeometry(0.03, IROSA.len, IROSA.w), 1.5), K.panel('irosa'));
      m.position.set(0, sgn * IROSA.len / 2, 0);
      m.castShadow = m.receiveShadow = true;
      r.add(m);
      const Jr = K.inst(r);
      for (const dz of [-1, 1]) Jr.rod(V(-0.06, 0, dz * IROSA.w / 2), V(-0.06, sgn * IROSA.len, dz * IROSA.w / 2), 0.07, mat('strut'));
      Jr.rod(V(-0.12, sgn * IROSA.len, -IROSA.w / 2 - 0.15), V(-0.12, sgn * IROSA.len, IROSA.w / 2 + 0.15), 0.17, mat('dark'), K.U.disk);
      Jr.rod(V(-0.12, 0, -IROSA.w / 2 - 0.15), V(-0.12, 0, IROSA.w / 2 + 0.15), 0.2, mat('metal'), K.U.disk);
      Jr.rod(V(-0.12, 0, 0), V(-0.4, -sgn * 1.2, 0), 0.08, mat('strut'));
      late.push(Jr);
      w.add(r);
      irosaMeshes.push(r);
    }
    late.push(J);
    return w;
  };
  for (const p of PVM) {
    const parent = sarj[p.side > 0 ? 0 : 1];
    const base = new THREE.Group();
    base.position.set(0, 0, p.side * p.z);
    parent.add(base);
    const J = K.inst(base);
    // IEA: Kasten mit Batterien, PVR-Radiator nach achtern (Kante zur Sonne, im Schatten der Flügel)
    J.box(V(0, 0, 0), [3.2, 3.2, 3.2], mat('us'));
    for (const dy of [-1.1, 0, 1.1]) J.box(V(1.75, dy, 0), [0.3, 0.9, 2.6], mat('box'), null, GREYS[3]);
    for (let k = 0; k < 6; k++) J.box(V(-2.0 - k * 2.05, 0, 0), [1.95, 0.06, 3.4], mat('rad'));
    J.rod(V(-1.6, 0, -1.75), V(-14.3, 0, -1.75), 0.04, mat('metal')).rod(V(-1.6, 0, 1.75), V(-14.3, 0, 1.75), 0.04, mat('metal'));
    late.push(J);
    const up = wingMesh(base, 1, p.up[1]), down = wingMesh(base, -1, p.down[1]);
    bga.push(up, down);
  }
  // Radiatoren an S1/P1: je Seite drei Radiatoren aus 8 Platten (23 × 3,2 m), Scherengestänge an den Kanten, drehbar
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(TRUSS.x, TRUSS.y - 1.5, 0);
    station.add(g);
    rads.push(g);
    const J = K.inst(g);
    for (let i = 0; i < 3; i++) {
      const z = side * (11 + i * 3.8);
      for (let p = 0; p < 8; p++) {
        const y0 = -0.8 - p * 2.88, y1 = y0 - 2.76;
        J.box(V(0, (y0 + y1) / 2, z), [0.08, 2.76, 3.2], mat('rad'));
        for (const e of [-1, 1]) J.rod(V(p % 2 ? 0.22 : -0.22, y0, z + e * 1.66), V(p % 2 ? -0.22 : 0.22, y1, z + e * 1.66), 0.03, mat('metal'));
      }
    }
    J.box(V(0, -0.6, side * 14.8), [1.0, 1.4, 11.6], mat('us'));
    late.push(J);
  }
  // Solarflügel von Swesda (zwei Flügel quer aus je 4 Feldern, drehen um ihre Längsachse)
  const zvWings = [], zvPanel = [mat('back'), mat('back'), mat('cellsRU'), mat('back'), mat('back'), mat('back')];
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(-31.0, 0, side * 2.4);
    station.add(g);
    zvWings.push(g);
    const J = K.inst(g);
    J.rod(V(0, 0, 0), V(0, 0, side * 13.4), 0.07, mat('metal'));
    for (let i = 0; i < 4; i++) {
      const z = side * (0.45 + i * 3.2 + 1.55);
      J.box(V(0, 0, z), [3.4, 0.04, 3.05], zvPanel);
      for (const dx of [-1.72, 1.72]) J.rod(V(dx, 0, z - 1.52), V(dx, 0, z + 1.52), 0.03, mat('metal'));
    }
    late.push(J);
  }
  // Roboterarme: Canadarm2 auf der Mobilen Basis (Parkstellung über Destiny) mit Gelenken und Greifern, ERA an Nauka
  const arm = (pts, r, base) => {
    for (let i = 0; i < pts.length - 1; i++) I.rod(V(...pts[i]), V(...pts[i + 1]), r, M.arm);
    pts.forEach((p, i) => {
      const a = V(...p), d = V(...pts[Math.max(1, i)]).sub(V(...pts[Math.max(1, i) - 1])).normalize(), n = new THREE.Vector3().crossVectors(d, V(0, 0, 1)).normalize();
      I.rod(a.clone().addScaledVector(n, -0.5 * r / 0.18), a.clone().addScaledVector(n, 0.5 * r / 0.18), r * 1.9, M.arm, K.U.disk);
      I.rod(a.clone().addScaledVector(n, -0.12), a.clone().addScaledVector(n, 0.12), r * 2.0, mat('dark'), K.U.ring);
      if (i === 0 || i === pts.length - 1) {
        const o = i === 0 ? -1 : 1, tip = a.clone().addScaledVector(d, o * 1.1 * r / 0.18);
        I.rod(a, tip, r * 1.5, M.arm, K.U.disk).rod(tip, tip.clone().addScaledVector(d, o * 0.12), r * 1.55, mat('dark'), K.U.disk);
      }
    });
    if (base) I.box(V(...base[0]), base[1], mat('us'));
  };
  arm([[5.5, 6.9, -4.0], [12.5, 9.5, -6.5], [19.0, 4.8, -5.0]], 0.18, [[5.3, 6.35, -4.0], [2.6, 0.5, 2.8]]);
  arm([[-19.0, -3.8, 2.3], [-18.9, -8.8, 2.4], [-19.3, -12.6, 2.2]], 0.12);

  // AMS-02 auf S3 oben: Vakuumgehäuse des Magneten in Folie, Detektor oben, Hauptradiatoren zu Bug und Heck
  const ams = V(TRUSS.x, TRUSS.y + 1.55, 17.5);
  I.box(ams.clone().add(V(0, 0.12, 0)), [3.8, 0.25, 3.2], mat('metal'));
  I.rod(ams.clone().add(V(0, 0.25, 0)), ams.clone().add(V(0, 2.5, 0)), 1.4, mat('silver'), K.U.disk);
  I.rod(ams.clone().add(V(0, 2.5, 0)), ams.clone().add(V(0, 3.3, 0)), 1.2, mat('us'), K.U.disk);
  for (const s of [-1, 1]) I.box(ams.clone().add(V(s * 1.95, 1.7, 0)), [0.1, 2.9, 3.0], mat('rad'));
  I.box(ams.clone().add(V(0.6, 3.6, 0.9)), [1.2, 0.6, 1.1], mat('gold'));
  // ELC-Plattformen (Ersatzteile, Experimente) oben und unten an S3 und P3
  for (const [z, s] of [[23.5, 1], [23.5, -1], [-23.5, 1], [-23.5, -1]]) {
    const y = TRUSS.y + s * 1.65;
    I.box(V(TRUSS.x, y, z), [2.8, 0.25, 4.0], mat('metal'));
    for (const [dx, dz] of [[-0.7, -1.1], [0.7, -1.0], [-0.6, 0.6], [0.75, 1.2]]) { const t = [1.0 + rp() * 0.4, 0.5 + rp() * 0.7, 1.2 + rp() * 0.5]; payload(V(TRUSS.x + dx, y + s * (0.12 + t[1] / 2), z + dz), t); }
  }

  // ---------- Besuchsschiffe (typische Belegung, Modell) ----------
  const ships = new THREE.Group();
  station.add(ships);
  K.dock(ships, K.ship.dragon({ crew: true }), V(17.45, 0, 0), V(1, 0, 0));
  K.dock(ships, K.ship.dragon({ crew: false }), V(11.85, 4.2, 0), V(0, 1, 0));
  K.dock(ships, K.ship.soyuz(), V(-16.5, -8.0, 0), V(0, -1, 0));
  K.dock(ships, K.ship.soyuz({ cargo: true }), V(-33.5, 0, 0), V(-1, 0, 0));
  K.dock(ships, K.ship.soyuz({ cargo: true }), V(-21.3, 5.3, 0), V(0, 1, 0));
  I.done();
  late.forEach((J) => J.done());

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
  const shipsOut = () => out() && ships.visible;
  const hs = {
    cupola: { id: 'cupola', kind: 'info', pos: new THREE.Vector3(-3.0, -3.9, -6.4), focus: () => 12, visible: out },
    labs: { id: 'labs', kind: 'info', pos: new THREE.Vector3(11.85, 2.6, 3), focus: () => 30 },
    truss: { id: 'truss', kind: 'info', pos: new THREE.Vector3(TRUSS.x, TRUSS.y + 1.6, -18), focus: () => 45 },
    arrays: { id: 'arrays', kind: 'info', pos: new THREE.Vector3(), focus: () => 55 },
    irosa: { id: 'irosa', kind: 'info', pos: new THREE.Vector3(), focus: () => 40 },
    radiators: { id: 'radiators', kind: 'info', pos: new THREE.Vector3(), focus: () => 35 },
    russian: { id: 'russian', kind: 'info', pos: new THREE.Vector3(-26, 2.4, 0), focus: () => 35 },
    ships: { id: 'ships', kind: 'info', pos: new THREE.Vector3(21.0, 2.6, 0), focus: () => 26, visible: shipsOut },
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
    { id: 'ships', type: 'toggle', label: 'Besuchsschiffe', hint: 'Crew Dragon, Cargo Dragon, Sojus und zwei Progress an typischen Häfen – Modell, nicht der Flugplan am angezeigten Tag.', value: true, set: (v) => { ships.visible = v; } },
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
    ready: Promise.all([ov.ready, K.ready()]),
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
      K.dispose();
      Object.values(C).forEach((x) => x.dispose());
    },
  };
}
