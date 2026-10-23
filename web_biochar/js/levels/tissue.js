// Ebene 2: Querschnitt des Holzgewebes (Einheit µm), REM-Ansicht eines Bruchstücks nach dem Vorbild echter Aufnahmen:
// Bruchfläche in Terrassen (der Bruch springt zwischen Faserlagen), eingebrochene Mulden mit zackigem Rand und
// Wandtrümmern, Gefäße als tiefe dunkle Kanäle mit Durchbrechungsplatten, Lumina dunkel (Sekundärelektronen entkommen
// nicht aus dem Hohlraum). Pyrolyse: Schwindung, dünnere Wände und ein Radialriss, der sich entlang des breiten
// Holzstrahls öffnet (setParam 'temp').

import * as THREE from 'three';
import { woodTissue, ringY, RAY_CELL_W } from '../wood.js';
import { buildWalls, buildInstances, flakeGeometry, disposeGroup, shrinkScene } from '../walls.js';
import { semDetector, semMaterial } from '../sem.js';
import { mulberry32, fbm3, smoothstep } from '../util.js';
import { fmt, tissueScale } from '../science.js';

const DEPTH = 160;
const OPEN_Z = -8;       // mittlere Höhe der Bruchfläche (Weltebene der Tiefenabdunklung für Teile ohne eigene Oberkante)
const CRACK_MAX = 16;    // µm: Breite des Radialrisses am breiten Strahl bei voller Schwindung (Modell)

// Bruchfläche: Terrassen in Stufen von 10 µm, leicht wellig; Mulden (eingebrochene Bereiche) liegen 40 µm tiefer,
// ihr Rand bricht Zelle für Zelle verschieden tief (zackig)
const terrace = (x, y) => Math.floor(fbm3(x * 0.0042 + 3, y * 0.0042, 7, 2) * 3.999) / 3;
const pit = (x, y) => smoothstep(0.615, 0.645, fbm3(x * 0.0075 + 9, y * 0.0075 + 2, 2, 3));
const surfaceZ = (x, y) => 8 - 30 * terrace(x, y) - 4 * fbm3(x * 0.012, y * 0.012, 1.5, 3)
  - 1.5 * fbm3(x * 0.05, y * 0.05, 4.5, 2) - 42 * pit(x, y);

export function create(ctx) {
  const wood = woodTissue();
  const rand = mulberry32(4242);
  const inside = (x, y) => {
    const ang = Math.atan2(y, x);
    const rr = Math.pow(Math.pow(Math.abs(x) / 570, 4) + Math.pow(Math.abs(y) / 396, 4), 0.25);
    return rr < 0.98 - 0.09 * fbm3(Math.cos(ang) * 2.2 + 5, Math.sin(ang) * 2.2 + 5, 0.5, 3);
  };
  // Risslinie: Außenkante (+x) des breiten Holzstrahls; alles rechts davon wandert mit der Rissöffnung nach +x
  const ray = wood.broad;
  const crackX = (y) => wood.rayX(ray, y) + (ray.cells * RAY_CELL_W) / 2 + 1.5;
  const side = (x, y) => (x > crackX(y) ? 1 : 0);

  // eingebrochene Zellen: ihre Wände enden 12–40 µm tiefer (je Wand etwas anders → zackig)
  const broken = new Map();
  for (let tries = 0; tries < 600 && broken.size < 24; tries++) {
    const k = Math.floor(rand() * wood.sites.length);
    const s = wood.sites[k];
    if (Math.abs(s.x) > 430 || Math.abs(s.y) > 290 || s.type === 2) continue;
    broken.set(k, 12 + rand() * 28);
  }
  const walls = [];
  for (const e of wood.edges) {
    const mx = (e.a[0] + e.b[0]) / 2, my = (e.a[1] + e.b[1]) / 2;
    if (!inside(mx, my)) continue;
    let z1 = surfaceZ(mx, my) - rand() * 0.8;
    const drop = Math.max(broken.get(e.i) || 0, broken.get(e.j) || 0);
    if (drop) z1 -= drop * (0.55 + 0.45 * rand());
    else if (rand() < 0.015) z1 -= 6 + rand() * 25;      // vereinzelt abgebrochene Wände
    walls.push({ a: e.a, b: e.b, t: e.t, kind: e.kind, seed: e.seed, late: e.late, z0: -DEPTH, z1 });
  }

  // Tiefenabdunklung ab der eigenen Bruchkante (topMix): tiefere Terrassen bleiben hell, Lumina und Gefäße dunkeln ab
  const sem = { openZ: OPEN_Z, depth: 16, base: 0.34, edge: 0.62, edgeW: 1.0, noise: 0.5, shade: 0.45, topMix: 0.75 };
  const scene = new THREE.Scene();
  const wallGroup = buildWalls(walls, { ...sem, pits: false });
  scene.add(wallGroup);
  const left = new THREE.Group(), right = new THREE.Group();   // Teile links/rechts des Risses
  scene.add(left, right);
  const addSplit = (geometry, list, opts) => {
    const parts = [list.filter((it) => !side(it.p[0], it.p[1])), list.filter((it) => side(it.p[0], it.p[1]))];
    parts.forEach((part, k) => { if (part.length) (k ? right : left).add(buildInstances(geometry.clone(), part, opts)); });
  };

  // Durchbrechungsplatten: schräge Ringleiste (einfach) oder Sprossen (leiterförmig) in einigen Gefäßen, knapp unter der Fläche
  const rims = [], bars = [];
  for (const v of wood.vessels) {
    if (!inside(v.x, v.y) || rand() > 0.5) continue;
    const z = surfaceZ(v.x, v.y) - (10 + rand() * 30), tilt = 0.55 + rand() * 0.35, az = rand() * Math.PI;
    const r = v.r * 0.94;
    if (v.r >= 8.5) {
      rims.push({ p: [v.x, v.y, z], s: [r, r / Math.cos(tilt), r], r: [tilt, 0, az], order: 'ZYX' });
    } else {
      const nb = 4 + Math.floor(rand() * 4), gap = (2 * r) / (nb + 1);
      for (let k = 0; k < nb; k++) {
        const yl = (k - (nb - 1) / 2) * gap;
        const half = Math.sqrt(Math.max(r * r - yl * yl, 0)) * 0.96;
        const c = Math.cos(az), s = Math.sin(az);
        bars.push({ p: [v.x - s * yl, v.y + c * yl, z + yl * Math.tan(tilt)], s: [2 * half, 0.8, 0.8], r: [0, 0, az] });
      }
    }
  }
  const cavity = { ...sem, topMix: 0 };   // im Gefäß: Abdunklung ab der Weltebene (Hohlraum)
  const torus = new THREE.TorusGeometry(1, 0.075, 6, 36);
  for (const [k, part] of [rims.filter((it) => !side(it.p[0], it.p[1])), rims.filter((it) => side(it.p[0], it.p[1]))].entries()) {
    if (!part.length) continue;
    const rimMesh = new THREE.InstancedMesh(torus, semMaterial(cavity), part.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    part.forEach((it, i) => {
      e.set(it.r[0], it.r[1], it.r[2], it.order);
      rimMesh.setMatrixAt(i, m.compose(new THREE.Vector3(...it.p), q.setFromEuler(e), new THREE.Vector3(...it.s)));
    });
    rimMesh.instanceMatrix.needsUpdate = true;
    (k ? right : left).add(rimMesh);
  }
  addSplit(new THREE.BoxGeometry(1, 1, 1), bars, cavity);

  // Bruchflocken auf der Fläche (viele kleine, wenige große), Trümmer in eingebrochenen Zellen,
  // abgebrochene Wandstücke in den Mulden (liegen schräg auf dem Grund)
  const flakes = [], slabs = [];
  for (let k = 0; k < 360; k++) {
    const x = (rand() - 0.5) * 1000, y = (rand() - 0.5) * 680;
    if (!inside(x, y)) continue;
    const s = 1.5 + Math.pow(rand(), 2.4) * 10;
    flakes.push({ p: [x, y, surfaceZ(x, y) + 0.3 * s], s: [s, s * (0.5 + 0.5 * rand()), s * 0.22], r: [(rand() - 0.5) * 0.9, (rand() - 0.5) * 0.9, rand() * 6.28] });
  }
  for (const [k, drop] of broken) {
    const c = wood.sites[k];
    for (let j = 0; j < 3; j++) {
      const s = 2 + rand() * 4;
      flakes.push({ p: [c.x + (rand() - 0.5) * 6, c.y + (rand() - 0.5) * 6, surfaceZ(c.x, c.y) - drop * 0.8], s: [s, s * 0.7, s * 0.3], r: [rand() * 3, rand() * 3, rand() * 3] });
    }
  }
  for (let k = 0; k < 900 && slabs.length < 70; k++) {
    const x = (rand() - 0.5) * 1000, y = (rand() - 0.5) * 680;
    if (!inside(x, y) || pit(x, y) < 0.6) continue;
    const l = 5 + rand() * 9;
    slabs.push({ p: [x, y, surfaceZ(x, y) + 0.6 + rand() * 1.5], s: [l, 2.5 + rand() * 4, 0.7], r: [(rand() - 0.5) * 0.7, (rand() - 0.5) * 0.5, rand() * 6.28] });
  }
  addSplit(flakeGeometry(3), flakes, { ...sem, base: 0.42, noise: 1.4 });
  addSplit(new THREE.BoxGeometry(1, 1, 1), slabs, { ...sem, base: 0.4, edge: 0.5, noise: 0.9 });

  const camera = new THREE.PerspectiveCamera(35, ctx.aspect, 1, 6000);
  const dv = wood.dive;
  const porosity = wood.porosity(-400, -270, 400, 270);
  const zAt = (x, y) => surfaceZ(x, y) + 1;
  const rayX = wood.rayX(ray, -160);
  const hotspots = [
      { id: 'vessels', kind: 'dive', pos: new THREE.Vector3(dv.x, dv.y, zAt(dv.x, dv.y)), normal: new THREE.Vector3(0, 0, 1) },
      { id: 'ring', kind: 'info', pos: new THREE.Vector3(-270, ringY(-270), zAt(-270, ringY(-270))), normal: new THREE.Vector3(0, 0, 1) },
      { id: 'ray', kind: 'info', pos: new THREE.Vector3(rayX, -160, zAt(rayX, -160)), normal: new THREE.Vector3(0, 0, 1) },
      { id: 'porosity', kind: 'info', pos: new THREE.Vector3(300, -150, zAt(300, -150)), normal: new THREE.Vector3(0, 0, 1) },
  ];
  const base = hotspots.map((h) => h.pos.clone());
  // Pyrolyse: die Gewebeprobe schwindet (quer stärker als längs), die Zellwände werden dünner, der Radialriss am
  // breiten Strahl öffnet sich – alles gleitet mit dem Regler
  let shownT = ctx.temp, lastT = NaN;
  function applyTemp() {
    if (shownT === lastT) return;
    lastT = shownT;
    const k = tissueScale(shownT);
    const gap = CRACK_MAX * k.crack;
    wallGroup.userData.setThin(k.wall / k.xy, (x, y) => side(x, y) * gap);   // die Szenenskalierung trifft die Wand mit
    right.position.x = gap;
    shrinkScene(scene, k.xy, k.z);
    hotspots.forEach((h, i) => h.pos.set((base[i].x + side(base[i].x, base[i].y) * gap) * k.xy, base[i].y * k.xy, base[i].z * k.z));
  }
  applyTemp();
  const level = {
    scene, camera,
    unit: 1e-6,
    method: 'REM · Sekundärelektronen (Modell)',
    tone: 0,
    grain: 0.065,
    dof: 1.2,         // REM: große Schärfentiefe, nur der Rand weich
    bloom: 0.05,
    home: { pos: new THREE.Vector3(40, -230, 700), target: new THREE.Vector3(0, 0, -20) },
    orbit: { minDistance: 220, maxDistance: 1500, minAzimuthAngle: -0.75, maxAzimuthAngle: 0.75, minPolarAngle: 0.95, maxPolarAngle: 2.2, enablePan: true },
    hotspots,
    facts: () => [{ value: `${fmt(porosity * 100)} %`, label: 'Porenanteil dieses Modells (Zelllumen / Fläche)' }],
    update(dt, t) {
      semDetector(t);
      applyTemp();
      return true;
    },
    setParam(name, value) {
      if (name === 'temp') { shownT = value; level.dirty = true; }
    },
    dispose() { disposeGroup(scene); },
  };
  return level;
}
