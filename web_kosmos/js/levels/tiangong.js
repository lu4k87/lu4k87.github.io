// Station 01B: Chinesische Raumstation Tiangong aus der Nähe (Einheit 1 m), Abstecher von Erde & Mond. Wie die ISS fliegt sie
// im Bahnsystem (orbitview.js): Flugrichtung vorn (x), Erde unten (−y), Steuerbord z; darunter die Erde für den
// angezeigten Zeitpunkt mit Sonnenaufgängen und Sonnenuntergängen alle ≈ 46 min, Erdschein, Polarlichtern und Stadtlichtern.
// Modell aus Grundkörpern („Modell, gerundet“): T-Form aus Tianhe (16,6 m, Stamm längs x) mit Andockknoten vorn und den
// Laboren Wentian (+z) und Mengtian (−z) quer am Knoten (je 17,9 m, Ø 4,2 m); Wentian-Solarflügel 2 × 26,5 m (Spannweite
// ≈ 55 m, ≈ 110 m² je Flügel), Mengtian mit Flügeln gleicher Größe angenommen, Tianhe mit zwei kleineren Flügeln (Maße
// geschätzt). Alle Flügel folgen der Sonne über zwei Gelenke (Drehung um die Modulachse, Kippen um die Flügelachse).
// Roboterarme in Parkstellung: Tianhe ≈ 10 m, Wentian 5 m. Details nach Fotos (Modell): lackierte Hülle mit Platten und
// Nieten, Goldfolie, Haltegriffe und Geräte, Flügel mit Mast, Relaisantenne, Außenplattform an Mengtian; Besuchsschiffe in
// typischer Belegung (Shenzhou vorn, Tianzhou am Heck – nicht der Flugplan). Oberflächen aus stationkit.js. Weitere Details
// nach Fotos (Modell): Luken an den freien Stutzen, Bullaugen und Radiatorstreifen auf den Hüllen, Lagedüsen, Greifpunkte
// für den Arm, Navigationsantennen, Ausstiegsluke der Wentian-Schleuse, zweite Relaisantenne an Mengtian.

import * as THREE from 'three';
import { mulberry32 } from '../astro.js';
import { createOrbitView } from '../orbitview.js';
import { stationKit, V } from '../stationkit.js';
import { registerLayers } from '../layers.js';

const RAD = Math.PI / 180;
const NODE_X = 6.65;                                       // Andockknoten von Tianhe: 8,3 m vor der Mitte − 1,65 m
const LAB = { r: 2.1, z0: 2.0, len: 17.9, wing: 17.0 };    // Labormodule: Ø 4,2 m, 17,9 m lang, Flügelwurzel nahe dem äußeren Ende
const WING = { len: 26.5, w: 4.15, r0: 1.2 };              // Wentian: 2 × 26,5 m + Nabe ≈ 55 m, 26,5 × 4,15 m ≈ 110 m²
const CORE_WING = { len: 11, w: 3.0, r0: 2.4, x: -5.2 };   // Tianhe: Maße nicht belegt, Modell

const TILE = 3;                                            // Kachel der Hüllenplatten [m]

export function create(ctx) {
  const ov = createOrbitView(ctx, { sat: 'CSS (TIANHE)', fallback: [6762.5, 0.0003, 41.47, 250.1, 213.9, 146.16, -0.3814, 3], radius: 50 });
  const { scene, camera } = ov;
  const K = stationKit(ctx), mat = K.mat;
  const station = new THREE.Group();
  scene.add(station);
  const I = K.inst(station), late = [];

  const M = {
    hull: mat('hull'), hull2: mat('hull2'), foil: mat('gold'), metal: mat('metal'), dark: mat('dark'),
    arm: mat('box'),
  };

  const add = (parent, geo, mat, pos, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // Zylinder/Kegelstumpf entlang einer Achse: rTop am +Ende, rBot am −Ende
  const tube = (parent, rTop, rBot, len, ax, pos, m) => {
    const g = K.tubeUV(new THREE.CylinderGeometry(rTop, rBot, len, 48, 1), Math.max(rTop, rBot), len, TILE);
    if (ax === 'x') g.rotateZ(-Math.PI / 2); else if (ax === 'z') g.rotateX(Math.PI / 2);
    return add(parent, g, m, pos);
  };
  const DRESS = { rail: 'railGrey', rails: 6, ends: false };

  // ---------- Tianhe: Stamm längs x, Heck −8,3 m, Bug +8,3 m ----------
  tube(station, 1.5, 1.0, 0.8, 'x', [-7.9, 0, 0], M.metal);       // Heck-Anlegestelle
  tube(station, 2.1, 2.1, 4.5, 'x', [-5.25, 0, 0], M.hull2);      // Ressourcenabschnitt
  tube(station, 2.1, 2.1, 5.5, 'x', [-0.25, 0, 0], M.hull);       // Arbeitsabschnitt
  tube(station, 1.4, 2.1, 0.9, 'x', [2.95, 0, 0], M.foil);        // Übergang auf den schmalen Teil
  tube(station, 1.4, 1.4, 1.9, 'x', [4.35, 0, 0], M.hull2);       // schmaler Abschnitt (Ø 2,8 m)
  add(station, new THREE.SphereGeometry(1.5, 32, 20), M.hull, [NODE_X, 0, 0]);   // Andockknoten
  tube(station, 0.9, 1.1, 0.8, 'x', [7.9, 0, 0], M.metal);        // Anlegestelle vorn
  tube(station, 0.9, 1.1, 0.8, 'y', [NODE_X, 1.9, 0], M.metal);   // oben
  tube(station, 1.1, 0.9, 0.8, 'y', [NODE_X, -1.9, 0], M.metal);  // unten (zur Erde)
  for (const s of [1, -1]) tube(station, s > 0 ? 0.9 : 1.1, s > 0 ? 1.1 : 0.9, 0.9, 'z', [NODE_X, 0, s * 1.8], M.metal);   // seitlich zu den Laboren
  // Triebwerke am Heck
  for (let i = 0; i < 4; i++) {
    const a = (i + 0.5) * Math.PI / 2;
    add(station, new THREE.CylinderGeometry(0.12, 0.28, 0.6, 12).rotateZ(Math.PI / 2), mat('nozzle'), [-7.4, Math.sin(a) * 1.9, Math.cos(a) * 1.9]);
  }
  // Haltegriffe und Geräte an Tianhe, Ringe an den Abschnitten, Relaisantenne auf einem Ausleger
  K.dress(I, 'x', V(-2.75, 0, 0), 2.1, 10.0, { ...DRESS, gear: 6, seed: 201 });
  K.dress(I, 'x', V(4.35, 0, 0), 1.4, 1.9, { ...DRESS, rails: 4, gear: 1, seed: 202 });
  for (const x of [-7.5, -3.0, 2.5]) I.rod(V(x - 0.1, 0, 0), V(x + 0.1, 0, 0), 2.14, M.metal, K.U.ring);
  I.rod(V(-6.4, 1.9, -1.2), V(-6.4, 3.1, -2.3), 0.07, M.metal);
  const dish = add(station, new THREE.LatheGeometry(Array.from({ length: 8 }, (_, i) => new THREE.Vector2(i * 0.1, (i * 0.1) ** 2 * 0.45)), 40), mat('paint'), [-6.4, 3.15, -2.35]);
  dish.rotation.x = -0.6;
  dish.material.side = THREE.DoubleSide;

  // ---------- Labore Wentian (+z) und Mengtian (−z), quer am Knoten ----------
  // Abschnitt von z0 bis z1 (nach außen), rIn am inneren Ende, rOut am äußeren
  const labTube = (s, rIn, rOut, z0, z1, mat) => tube(station, s > 0 ? rOut : rIn, s > 0 ? rIn : rOut, z1 - z0, 'z', [NODE_X, 0, s * (z0 + z1) / 2], mat);
  const zEnd = LAB.z0 + LAB.len;
  const labs = {};
  for (const [name, s] of [['wentian', 1], ['mengtian', -1]]) {
    labTube(s, 1.1, LAB.r, LAB.z0, LAB.z0 + 1.0, M.foil);              // Kegel an der Anlegestelle
    labTube(s, LAB.r, LAB.r, LAB.z0 + 1.0, 9.0, M.hull);               // Arbeitskabine
    labTube(s, LAB.r, LAB.r, 12.0, zEnd - 0.7, M.hull2);               // Ressourcenabschnitt
    labTube(s, LAB.r, 1.0, zEnd - 0.7, zEnd, M.metal);                 // äußere Anlegestelle
    if (name === 'wentian') {
      // Schleusenkabine: außen eckig, innen rund
      add(station, new THREE.BoxGeometry(3.9, 3.9, 3.0), M.hull2, [NODE_X, 0, s * 10.5]);
      add(station, new THREE.BoxGeometry(4.1, 4.1, 0.3), M.foil, [NODE_X, 0, s * 8.9]);
      add(station, new THREE.BoxGeometry(4.1, 4.1, 0.3), M.foil, [NODE_X, 0, s * 12.1]);
    } else {
      labTube(s, LAB.r, LAB.r, 9.0, 12.0, M.hull);
      labTube(s, 2.25, 2.25, 10.2, 10.8, M.foil);
      // Außenplattform am Ressourcenabschnitt: Rahmen mit Nutzlasten zum All (Modell)
      const rp = mulberry32(5);
      I.box(V(NODE_X, LAB.r + 0.2, s * 15.5), [2.6, 0.2, 5.6], M.metal);
      for (const dz of [-2.0, -0.6, 0.8, 2.1]) {
        const t = [0.9 + rp() * 0.6, 0.5 + rp() * 0.6, 1.0 + rp() * 0.3];
        I.box(V(NODE_X + (rp() - 0.5) * 0.8, LAB.r + 0.3 + t[1] / 2, s * 15.5 + dz), t, rp() < 0.35 ? M.foil : mat('box'));
      }
    }
    K.dress(I, 'z', V(NODE_X, 0, s * (LAB.z0 + 1.0 + 4.0)), LAB.r, 8.0, { ...DRESS, gear: 4, seed: 210 + s });
    K.dress(I, 'z', V(NODE_X, 0, s * (12.0 + (zEnd - 12.7) / 2)), LAB.r, zEnd - 12.7, { ...DRESS, rails: 4, gear: 3, seed: 220 + s });
    for (const z of [LAB.z0 + 1.0, 9.0, 12.0]) I.rod(V(NODE_X, 0, s * z - 0.1), V(NODE_X, 0, s * z + 0.1), LAB.r + 0.04, M.metal, K.U.ring);
    labs[name] = s;
  }

  // ---------- Kleinteile: Luken, Bullaugen, Radiatoren, Düsen, Greifpunkte, Antennen ----------
  {
    const up = V(0, 1, 0), rad = new THREE.Vector3(), q = new THREE.Quaternion();
    const onHull = (x, ang, r) => rad.set(0, Math.cos(ang), Math.sin(ang)).clone().multiplyScalar(r).add(V(x, 0, 0));
    K.hatch(I, V(NODE_X, 2.3, 0), V(0, 1, 0), 0.9);                                  // freie Stutzen des Knotens oben und unten
    K.hatch(I, V(NODE_X, -2.3, 0), V(0, -1, 0), 0.9);
    for (const s of [1, -1]) K.hatch(I, V(NODE_X, 0, s * zEnd), V(0, 0, s), 1.0);      // äußere Enden der Labore
    K.hatch(I, V(NODE_X, 1.95, 10.5), V(0, 1, 0), 0.5, { latches: 6 });                // Ausstiegsluke der Wentian-Schleuse
    for (const [x, a] of [[-0.6, 0.5], [1.4, -0.6], [-2.2, 2.4]]) {                     // Bullaugen am Arbeitsabschnitt
      const p = onHull(x, a, 2.08), d = rad.clone();
      I.rod(p, p.clone().addScaledVector(d, 0.07), 0.24, M.metal, K.U.disk).rod(p.clone().addScaledVector(d, 0.05), p.clone().addScaledVector(d, 0.08), 0.18, mat('glass'), K.U.disk);
    }
    for (const a of [55, 125, 235, 305]) {                                             // Radiatorstreifen auf dem Ressourcenabschnitt
      rad.set(0, Math.cos(a * RAD), Math.sin(a * RAD));
      q.setFromUnitVectors(up, rad);
      I.box(rad.clone().multiplyScalar(2.13).add(V(-5.25, 0, 0)), [3.8, 0.05, 0.9], mat('rad'), q);
    }
    for (const s of [1, -1]) for (const sx of [1, -1]) I.box(V(NODE_X + sx * (LAB.r + 0.03), 0, s * 15.6), [0.05, 1.1, 5.6], mat('rad'));   // Radiatoren der Labore
    for (const a of [45, 135, 225, 315]) {                                             // Lagedüsen am Heck und an den Laborenden
      const p = onHull(-7.0, a * RAD, 2.05);
      K.nozzle(I, p.clone().addScaledVector(rad, 0.3), rad, 0.08, 0.3);
      K.nozzle(I, p.clone().add(V(-0.4, 0, 0)), V(-1, 0, 0), 0.07, 0.25);
    }
    for (const s of [1, -1]) for (const a of [45, 225]) { const r = V(0, Math.cos(a * RAD), Math.sin(a * RAD)); K.nozzle(I, V(NODE_X, 0, s * (zEnd - 0.5)).addScaledVector(r, 1.25), r, 0.06, 0.22); }
    for (const [x, a] of [[-5.5, 1.1], [0.4, 2.3], [3.2, -1.2]]) {                      // Greifpunkte für den Roboterarm
      const p = onHull(x, a, 2.1), d = rad.clone();
      I.rod(p, p.clone().addScaledVector(d, 0.12), 0.2, M.metal, K.U.disk).rod(p.clone().addScaledVector(d, 0.12), p.clone().addScaledVector(d, 0.32), 0.05, M.dark);
    }
    for (const z of [-0.6, 0.6]) I.rod(V(4.6, 1.38, z), V(4.6, 1.48, z), 0.16, mat('box'), K.U.disk);   // Navigationsantennen (GNSS)
    K.whip(I, V(7.2, 0.9, 0.5), V(0.3, 1, 0), 0.6);                                   // Stabantennen der Anlegestelle vorn
    K.whip(I, V(7.2, -0.9, -0.5), V(0.3, -1, 0), 0.6);
    // zweite Relaisantenne am Ende von Mengtian
    I.rod(V(NODE_X + 1.2, 1.9, -17.2), V(NODE_X + 2.0, 3.0, -17.6), 0.06, M.metal);
    const dish2 = add(station, new THREE.LatheGeometry(Array.from({ length: 7 }, (_, i) => new THREE.Vector2(i * 0.09, (i * 0.09) ** 2 * 0.5)), 32), mat('paint'), [NODE_X + 2.05, 3.05, -17.65]);
    dish2.rotation.set(-0.5, 0, 0.6);
    dish2.material.side = THREE.DoubleSide;
  }

  // ---------- Solarflügel ----------
  // Flügel: Mitte bei Spiegelpunkt sgn · (r0 + len/2), Zellenseite +x, Länge entlang y, Breite entlang z
  const wingMesh = (parent, sgn, d) => {
    const w = new THREE.Group();
    parent.add(w);
    // flexible Matte (Zellenseite +x), dahinter der ausfahrbare Mast als Gitter, Kasten am Fuß, Balken an der Spitze
    const blanket = new THREE.Mesh(K.boxUV(new THREE.BoxGeometry(0.03, d.len, d.w), d.w / 2, 2.6), K.panel('cellsCN'));
    blanket.position.set(0, sgn * (d.r0 + d.len / 2), 0);
    blanket.castShadow = blanket.receiveShadow = true;
    w.add(blanket);
    const J = K.inst(w);
    K.lattice(J, V(-0.32, sgn * d.r0, 0), V(-0.32, sgn * (d.r0 + d.len), 0), { w: 0.45, bay: 0.5, r: 0.025, m: mat('strut'), side: V(0, 0, 1) });
    J.box(V(-0.05, sgn * (d.r0 + d.len), 0), [0.5, 0.35, d.w + 0.4], M.metal);
    J.box(V(-0.1, sgn * (d.r0 + 0.1), 0), [0.6, 0.4, d.w + 0.3], mat('gold'));
    J.box(V(0, sgn * (d.r0 + 0.2) / 2, 0), [0.9, d.r0 + 0.2, 1.2], M.metal);
    late.push(J);
    return w;
  };
  const labSarj = [], labWings = [];
  for (const s of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(NODE_X, 0, s * LAB.wing);
    station.add(g);
    labSarj.push(g);
    tube(g, 2.5, 2.5, 1.0, 'z', [0, 0, 0], M.metal);
    labWings.push(wingMesh(g, 1, WING), wingMesh(g, -1, WING));
  }
  // Tianhe: Flügel zeigen quer (±z); Rahmen dreht die Hilfsachsen (lokal x → y, y → z, z → x), damit dieselbe Regel gilt
  const frame = new THREE.Group();
  frame.position.set(CORE_WING.x, 0, 0);
  frame.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
  station.add(frame);
  const coreSarj = new THREE.Group();
  frame.add(coreSarj);
  tube(coreSarj, 2.35, 2.35, 1.0, 'z', [0, 0, 0], M.metal);
  const coreWings = [wingMesh(coreSarj, 1, CORE_WING), wingMesh(coreSarj, -1, CORE_WING)];

  // Roboterarme in Parkstellung: Tianhe ≈ 10 m (zwei Ausleger), Wentian 5 m auf der Schleuse
  const boom = (pts, r) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]);
      const m = add(station, new THREE.CylinderGeometry(r, r, a.distanceTo(b), 12), M.arm, [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    }
    pts.forEach((p) => add(station, new THREE.SphereGeometry(r * 2.1, 16, 12), M.arm, p));
  };
  boom([[5.2, 2.5, 0], [0.6, 3.2, 0], [-4.2, 2.4, 0]], 0.2);
  boom([[NODE_X, 2.3, 11.6], [NODE_X, 4.2, 10.2], [NODE_X, 2.6, 8.8]], 0.13);

  // Besuchsschiffe (typische Belegung, Modell): Shenzhou am vorderen Hafen, Tianzhou am Heck
  const ships = new THREE.Group();
  station.add(ships);
  K.dock(ships, K.ship.shenzhou(), V(8.3, 0, 0), V(1, 0, 0));
  K.dock(ships, K.ship.tianzhou(), V(-8.3, 0, 0), V(-1, 0, 0));
  I.done();
  late.forEach((J) => J.done());

  // ---------- Nachführung: Drehgelenk um die Modulachse (α), Flügelgelenk um die Flügelachse (β) ----------
  let track = true, first = true;
  const ang = { a: 0, b: 0, c: 0, d: 0 };
  const approach = (cur, goal, maxStep) => {
    let d = goal - cur;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return cur + THREE.MathUtils.clamp(d, -maxStep, maxStep);
  };
  function steer(dt) {
    const s = ov.sun, cl = THREE.MathUtils.clamp;
    const step = first ? 10 : dt * 40 * RAD;
    first = false;
    // Labore: Modulachse z, Zellenseite +x; Tianhe: Modulachse x, Zellenseite +y (Rahmen)
    ang.a = approach(ang.a, track ? Math.atan2(s.y, s.x) : 0, step);
    ang.b = approach(ang.b, track ? -Math.asin(cl(s.z, -1, 1)) : 0, step);
    ang.c = approach(ang.c, track ? Math.atan2(s.z, s.y) : 0, step);
    ang.d = approach(ang.d, track ? -Math.asin(cl(s.x, -1, 1)) : 0, step);
    labSarj.forEach((g) => { g.rotation.z = ang.a; });
    labWings.forEach((g) => { g.rotation.y = ang.b; });
    coreSarj.rotation.z = ang.c;
    coreWings.forEach((g) => { g.rotation.y = ang.d; });
  }

  // ---------- Pose ----------
  const home = { pos: new THREE.Vector3(84, 34, 78), target: new THREE.Vector3(4, 0, 0) };
  const orbit = { minDistance: 14, maxDistance: 800, cineSpeed: 0.5 };

  // ---------- Abzeichen ----------
  const wp = (obj, x, y, z) => () => obj.localToWorld(new THREE.Vector3(x, y, z));
  const S = { arrays: wp(labWings[0], 0, WING.r0 + WING.len * 0.6, 0) };
  const hs = {
    core: { id: 'core', kind: 'info', pos: new THREE.Vector3(-2.5, -2.6, 0), focus: () => 24 },
    hub: { id: 'hub', kind: 'info', pos: new THREE.Vector3(NODE_X + 1.6, 2.3, 0), focus: () => 18 },
    wentian: { id: 'wentian', kind: 'info', pos: new THREE.Vector3(NODE_X, -2.8, 12), focus: () => 36 },
    mengtian: { id: 'mengtian', kind: 'info', pos: new THREE.Vector3(NODE_X, -2.8, -12), focus: () => 36 },
    arrays: { id: 'arrays', kind: 'info', pos: new THREE.Vector3(), focus: () => 60 },
    arm: { id: 'arm', kind: 'info', pos: new THREE.Vector3(0.6, 3.6, 0), focus: () => 22 },
    ships: { id: 'ships', kind: 'info', pos: new THREE.Vector3(12.5, 2.0, 0), focus: () => 24, visible: () => ships.visible },
    horizon: { id: 'horizon', kind: 'info', pos: ov.spots.horizon },
    below: { id: 'below', kind: 'info', pos: ov.spots.below },
    sun: { id: 'sun', kind: 'info', pos: ov.spots.sun, visible: () => ov.lit > 0.5 },
  };
  const hotspots = Object.values(hs);
  function placeHotspots() {
    station.updateMatrixWorld(true);
    hs.arrays.pos.copy(S.arrays());
  }

  // ---------- Ebenen (Zahnrad „Station · Tiangong“) und Infotafel ----------
  registerLayers('tiangong', [
    ov.layers.clock('Tiangong'),
    { id: 'ships', type: 'toggle', group: 'Station', label: 'Besuchsschiffe', hint: 'Shenzhou vorn, Tianzhou am Heck – typische Belegung als Modell, nicht der Flugplan am angezeigten Tag.', value: true, set: (v) => { ships.visible = v; } },
    { id: 'boost', type: 'toggle', label: 'Im Erdschatten aufhellen', hint: 'Echt ist die Station im Schatten fast schwarz; aufgehellt bleibt sie erkennbar.', value: true, set: (v) => ov.setBoost(v) },
    { id: 'orbit', type: 'toggle', group: 'Bahn', label: 'Bahnspur am Boden', hint: 'Gelbe Linie: der Weg der Station über den Boden, ein halber Umlauf zurück und anderthalb voraus.', value: true, set: (v) => ov.setTrack(v) },
    ...ov.layers.earth(),
  ]);
  const controls = [
    { id: 'wings', label: 'Solarflügel', value: 'track', options: [['track', 'Der Sonne nach'], ['fixed', 'Fest']], set: (v) => { track = v === 'track'; } },
  ];

  const look = { exposure: 1.0, bloom: 0.07, sat: 1.05 };
  return {
    scene, camera, home, unit: 1, hotspots, controls, look, orbit,
    ready: Promise.all([ov.ready, K.ready()]),
    update(dt, t, cam, flying) {
      ov.update(dt, t, cam, flying);
      steer(flying ? 1 : dt);
      placeHotspots();
    },
    widget: () => `<table><thead><tr><th>Tiangong im Moment</th><th>Wert</th></tr></thead><tbody id="w-orb"><tr><td colspan="2">Bahn wird geladen …</td></tr></tbody></table><p class="w-foot">Bahn aus den CelesTrak-Bahnelementen (Stand 25.10.2026), fortgeschrieben mit Kepler + J2; Sonnenaufgang und Sonnenuntergang aus dem Erdschatten (Zylinder).</p>`,
    widgetTick(el, t) {
      ov.widgetTick(el, t, () => `<tr><td>ein Umlauf · Sonne zur Bahnebene</td><td class="num">${ov.info.period.toFixed(1).replace('.', ',')} min · ${Math.round(ov.info.beta)}°</td></tr>`);
    },
    live: () => `über ${ov.where()} · ${ov.lit > 0.5 ? 'Tag' : 'Nacht im Erdschatten'} · ${ov.speed ? `Zeitraffer ${ov.SPEEDS[ov.speed][1]}` : 'Echtzeit'}`,
    setPixelRatio: (p) => ov.setPixelRatio(p),
    dispose() {
      ov.dispose();
      K.dispose();
    },
  };
}
