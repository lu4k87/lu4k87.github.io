// Station 01B: Chinesische Raumstation Tiangong aus der Nähe (Einheit 1 m), Abstecher von Erde & Mond. Wie die ISS fliegt sie
// im Bahnsystem (orbitview.js): Flugrichtung vorn (x), Erde unten (−y), Steuerbord z; darunter die Erde für den
// angezeigten Zeitpunkt mit Sonnenauf- und -untergängen alle ≈ 46 min, Erdschein, Polarlichtern und Stadtlichtern.
// Modell aus Grundkörpern („Modell, gerundet“): T-Form aus Tianhe (16,6 m, Stamm längs x) mit Andockknoten vorn und den
// Laboren Wentian (+z) und Mengtian (−z) quer am Knoten (je 17,9 m, Ø 4,2 m); Wentian-Solarflügel 2 × 26,5 m (Spannweite
// ≈ 55 m, ≈ 110 m² je Flügel), Mengtian mit Flügeln gleicher Größe angenommen, Tianhe mit zwei kleineren Flügeln (Maße
// geschätzt). Alle Flügel folgen der Sonne über zwei Gelenke (Drehung um die Modulachse, Kippen um die Flügelachse).
// Roboterarme in Parkstellung: Tianhe ≈ 10 m, Wentian 5 m.

import * as THREE from 'three';
import { mulberry32 } from '../astro.js';
import { createOrbitView, stationMat } from '../orbitview.js';
import { registerLayers } from '../layers.js';

const RAD = Math.PI / 180;
const NODE_X = 6.65;                                       // Andockknoten von Tianhe: 8,3 m vor der Mitte − 1,65 m
const LAB = { r: 2.1, z0: 2.0, len: 17.9, wing: 17.0 };    // Labormodule: Ø 4,2 m, 17,9 m lang, Flügelwurzel nahe dem äußeren Ende
const WING = { len: 26.5, w: 4.15, r0: 1.2 };              // Wentian: 2 × 26,5 m + Nabe ≈ 55 m, 26,5 × 4,15 m ≈ 110 m²
const CORE_WING = { len: 11, w: 3.0, r0: 2.4, x: -5.2 };   // Tianhe: Maße nicht belegt, Modell

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Texturen (Modell): Rumpfplatten, goldene Isolierfolie, Solarzellen auf flexiblen Matten, Rückseite
function textures() {
  const rnd = mulberry32(31);
  const hull = (base) => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const k = 0.94 + rnd() * 0.08;
      g.fillStyle = `rgba(${255 * k | 0},${255 * k | 0},${248 * k | 0},0.4)`;
      g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
      g.strokeStyle = 'rgba(96,98,102,0.5)'; g.lineWidth = 2;
      g.strokeRect(i * 128 + 3, j * 128 + 3, 122, 122);
      g.fillStyle = 'rgba(80,82,86,0.55)';
      for (const [u, v] of [[10, 10], [116, 10], [10, 116], [116, 116]]) g.fillRect(i * 128 + u, j * 128 + v, 3, 3);
    }
  });
  const foil = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#a97e34'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const k = 0.7 + rnd() * 0.7;
      g.fillStyle = `rgba(${214 * k | 0},${168 * k | 0},${78 * k | 0},0.55)`;
      g.fillRect(rnd() * w, rnd() * h, 6 + rnd() * 26, 5 + rnd() * 18);
    }
  });
  const cells = canvasTex(128, 1024, (g, w, h) => {
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
      const k = 0.85 + rnd() * 0.28;
      g.fillStyle = `rgb(${34 * k | 0},${42 * k | 0},${78 * k | 0})`;
      g.fillRect(x, y, 8, 8);
    }
    g.fillStyle = 'rgb(86,94,128)';
    for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1);
    for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 1, h);
    g.fillStyle = 'rgb(176,150,92)';
    for (let y = 0; y < h; y += 128) g.fillRect(0, y, w, 3);   // Faltkanten der flexiblen Matte
    g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
  });
  const back = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#b58f52'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(90,60,30,0.3)';
    for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 1);
  });
  return { hull: hull('#d9dbd8'), hull2: hull('#cfd3d4'), foil, cells, back };
}

export function create(ctx) {
  const ov = createOrbitView(ctx, { sat: 'CSS (TIANHE)', fallback: [6762.5, 0.0003, 41.47, 250.1, 213.9, 146.16, -0.3814, 3], radius: 50 });
  const { scene, camera } = ov;
  const T = textures();
  T.hull.repeat.set(3, 2); T.hull2.repeat.set(3, 2); T.foil.repeat.set(2, 1);
  const station = new THREE.Group();
  scene.add(station);

  const M = {
    hull: stationMat({ map: T.hull, roughness: 0.62, metalness: 0.12 }),
    hull2: stationMat({ map: T.hull2, roughness: 0.6, metalness: 0.14 }),
    foil: stationMat({ map: T.foil, roughness: 0.4, metalness: 0.5 }),
    metal: stationMat({ color: 0xa9aeb5, roughness: 0.42, metalness: 0.6 }),
    dark: stationMat({ color: 0x3d4148, roughness: 0.6, metalness: 0.5 }),
    cells: stationMat({ map: T.cells, roughness: 0.3, metalness: 0.4 }),
    back: stationMat({ map: T.back, roughness: 0.5, metalness: 0.2 }),
    arm: stationMat({ color: 0xe9e9e4, roughness: 0.6, metalness: 0.05 }),
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
  const tube = (parent, rTop, rBot, len, ax, pos, mat) => {
    const g = new THREE.CylinderGeometry(rTop, rBot, len, 40, 1);
    if (ax === 'x') g.rotateZ(-Math.PI / 2); else if (ax === 'z') g.rotateX(Math.PI / 2);
    return add(parent, g, mat, pos);
  };

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
    add(station, new THREE.CylinderGeometry(0.12, 0.28, 0.6, 12).rotateZ(Math.PI / 2), M.dark, [-7.4, Math.sin(a) * 1.9, Math.cos(a) * 1.9]);
  }

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
    }
    labs[name] = s;
  }

  // ---------- Solarflügel ----------
  // Flügel: Mitte bei Spiegelpunkt sgn · (r0 + len/2), Zellenseite +x, Länge entlang y, Breite entlang z
  const wingMesh = (parent, sgn, d) => {
    const w = new THREE.Group();
    parent.add(w);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.04, d.len, d.w), [M.cells, M.back, M.back, M.back, M.back, M.back]);
    blanket.position.set(0, sgn * (d.r0 + d.len / 2), 0);
    blanket.castShadow = blanket.receiveShadow = true;
    w.add(blanket);
    add(w, new THREE.CylinderGeometry(0.16, 0.16, d.len + 0.4, 10), M.metal, [-0.12, sgn * (d.r0 + d.len / 2), 0]);
    add(w, new THREE.BoxGeometry(0.5, 0.4, d.w + 0.4), M.metal, [-0.05, sgn * (d.r0 + d.len), 0]);
    add(w, new THREE.BoxGeometry(0.9, d.r0 + 0.2, 1.2), M.metal, [0, sgn * (d.r0 + 0.2) / 2, 0]);
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
    { id: 'boost', type: 'toggle', group: 'Station', label: 'Im Erdschatten aufhellen', hint: 'Echt ist die Station im Schatten fast schwarz; aufgehellt bleibt sie erkennbar.', value: true, set: (v) => ov.setBoost(v) },
    { id: 'orbit', type: 'toggle', group: 'Bahn', label: 'Bahnspur am Boden', hint: 'Gelbe Linie: der Weg der Station über den Boden, ein halber Umlauf zurück und anderthalb voraus.', value: true, set: (v) => ov.setTrack(v) },
    ...ov.layers.earth(),
  ]);
  const controls = [
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: ov.speed, min: 0, max: ov.SPEEDS.length - 1, step: 1, fmt: (i) => (i ? ov.SPEEDS[Math.round(i)][1] : 'Echtzeit'),
      set: (v) => { ov.setSpeed(Math.round(v)); }, get: () => ov.speed },
    { id: 'wings', label: 'Solarflügel', value: 'track', options: [['track', 'Der Sonne nach'], ['fixed', 'Fest']], set: (v) => { track = v === 'track'; } },
  ];

  const look = { exposure: 1.0, bloom: 0.07, sat: 1.05 };
  return {
    scene, camera, home, unit: 1, hotspots, controls, look, orbit,
    ready: ov.ready,
    update(dt, t, cam, flying) {
      ov.update(dt, t, cam, flying);
      steer(flying ? 1 : dt);
      placeHotspots();
    },
    widget: () => `<table><thead><tr><th>Tiangong im Moment</th><th>Wert</th></tr></thead><tbody id="w-orb"><tr><td colspan="2">Bahn wird geladen …</td></tr></tbody></table><p class="w-foot">Bahn aus den CelesTrak-Bahnelementen (Stand 25.10.2026), fortgeschrieben mit Kepler + J2; Sonnenauf- und -untergang aus dem Erdschatten (Zylinder).</p>`,
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
