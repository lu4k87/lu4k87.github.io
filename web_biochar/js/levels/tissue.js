// Ebene 2: Holzgewebe als längliches Bruchstück (Einheit µm, lang in Faserrichtung −z wie das Stück auf Ebene 1), REM-Ansicht
// nach dem Vorbild echter Aufnahmen: Stirnfläche in großen Stufen (der Bruch springt zwischen Faserlagen), darauf feine
// Terrassen, einzelne eingebrochene Zellen, Rand als abgestufte Bruchkante, Längsseiten frei liegend, Gefäße als tiefe
// dunkle Kanäle mit Durchbrechungsplatten, Lumina dunkel (Sekundärelektronen entkommen nicht aus dem Hohlraum). Längsseiten
// als Splitter: Faserbündel brechen außen unterschiedlich lang ab, Tüpfel auf den frei liegenden Längswänden.
// Pyrolyse: Schwindung, dünnere Wände und Schwundrisse, die sich nacheinander öffnen (setParam 'temp'): erst am breiten
// Holzstrahl, dann an zwei schmalen Strahlen, zuletzt entlang der Jahrringgrenze – die Kohle zerfällt in Blöcke.

import * as THREE from 'three';
import { woodTissue, ringY, RAY_CELL_W } from '../wood.js';
import { buildWalls, buildInstances, flakeGeometry, disposeGroup, shrinkScene } from '../walls.js';
import { semDetector, semMaterial } from '../sem.js';
import { mulberry32, fbm3, smoothstep, clamp } from '../util.js';
import { fmt, tissueScale, capillaryRise, wettability } from '../science.js';
import { settings } from '../settings.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const LENGTH = 1100;     // Länge des Bruchstücks in Faserrichtung
const HALF_X = 330, HALF_Y = 240;   // Stirnfläche (Superellipse)
const OPEN_Z = -30;      // mittlere Höhe der Stirnfläche (Weltebene der Tiefenabdunklung für Teile ohne eigene Oberkante)
const OPEN_ALL = 1e5;    // Zellöffnung „überall“: Zelle außerhalb des Umrisses oder ohne Nachbar
const CRACK_MAX = 24;    // µm: Breite des Radialrisses am breiten Strahl bei voller Schwindung (Modell)
const CRACK_RAY = 14;    // µm: Radialrisse an schmalen Strahlen (Modell)
const CRACK_RING = 11;   // µm: Tangentialriss an der Jahrringgrenze (Modell)

// Stirnfläche: drei große Stufen (≈ 40 µm, zur −x-Seite hin tiefer, Kante unregelmäßig), darauf Terrassen von 10 µm,
// leichte Welligkeit und wenige Mulden (eingebrochene Bereiche, 30 µm tiefer)
const stair = (x, y) => Math.floor((HALF_X - x + 80 * fbm3(x * 0.006, y * 0.006, 11, 2)) / 230);
const terrace = (x, y) => Math.floor(fbm3(x * 0.0042 + 3, y * 0.0042, 7, 2) * 3.999) / 3;
const pit = (x, y) => smoothstep(0.64, 0.665, fbm3(x * 0.0075 + 9, y * 0.0075 + 2, 2, 3));
const surfaceZ = (x, y) => 8 - 40 * stair(x, y) - 30 * terrace(x, y) - 4 * fbm3(x * 0.012, y * 0.012, 1.5, 3)
  - 1.5 * fbm3(x * 0.05, y * 0.05, 4.5, 2) - 30 * pit(x, y);

export function create(ctx) {
  const wood = woodTissue();
  const rand = mulberry32(4242);
  // Umriss der Stirnfläche (0 Mitte … 1 Rand) und Bruchkante: außen brechen die Fasern kürzer, der Rand fällt ab
  const rim = (x, y) => {
    const ang = Math.atan2(y, x);
    const rr = Math.pow(Math.pow(Math.abs(x) / HALF_X, 4) + Math.pow(Math.abs(y) / HALF_Y, 4), 0.25);
    return rr / (0.98 - 0.09 * fbm3(Math.cos(ang) * 2.2 + 5, Math.sin(ang) * 2.2 + 5, 0.5, 3));
  };
  const inside = (x, y) => rim(x, y) < 1;
  const edgeDrop = (x, y) => 40 * Math.pow(clamp((rim(x, y) - 0.86) / 0.14, 0, 1), 2);
  // Längsseiten: das Stück ist ein Splitter – außen brechen die Fasern kurz ab, innen laufen sie weiter (Hülle verjüngt
  // sich zum fernen Ende), Bündel brechen gemeinsam (fbm), jede Wand etwas anders, einzelne Fasern ragen heraus
  const breakLen = (x, y) => {
    const n = 0.24 * (fbm3(x * 0.011 + 1, y * 0.011 + 2, 3, 3) - 0.5);
    return LENGTH * Math.pow(clamp((1.08 + n - rim(x, y)) / 0.6, 0, 1), 1.3);
  };
  // Schwundrisse (Würfelmuster, Modell): radial an der Außenkante (+x) des breiten Strahls und zweier schmaler Strahlen
  // im Abstand von ≈ 190 µm, tangential an der Jahrringgrenze zwischen dem linken und dem breiten Radialriss (endet an
  // beiden). Die Blöcke dazwischen wandern starr mit der Rissöffnung: rechts eines Radialrisses nach +x, oberhalb des
  // Ringrisses (Frühholz) nach +y
  const ray = wood.broad;
  const rayEdge = (r) => (y) => wood.rayX(r, y) + (r.cells * RAY_CELL_W) / 2 + 1.5;
  const nearRay = (x0) => wood.rays.filter((r) => !r.broad).reduce((a, r) => (Math.abs(r.x - x0) < Math.abs(a.x - x0) ? r : a));
  const radial = [
    { x: rayEdge(nearRay(ray.x - 380)), w: CRACK_RAY, open: 'crackRay', gap: 0 },
    { x: rayEdge(nearRay(ray.x - 190)), w: CRACK_RAY, open: 'crackRay', gap: 0 },
    { x: rayEdge(ray), w: CRACK_MAX, open: 'crack', gap: 0 },
  ];
  const ring = { y: (x) => ringY(x) + 1.5, w: CRACK_RING, open: 'crackRing', gap: 0 };
  // Block eines Punkts: Spalte = Zahl der Radialrisse links davon, ungerade = oberhalb des Ringrisses
  const blockOf = (x, y) => {
    const col = radial.filter((c) => x > c.x(y)).length;
    return col * 2 + (col >= 1 && col <= 2 && y > ring.y(x) ? 1 : 0);
  };
  const shiftOf = (b) => [radial.slice(0, b >> 1).reduce((sum, c) => sum + c.gap, 0), (b & 1) * ring.gap];

  // eingebrochene Zellen: ihre Wände enden 12–40 µm tiefer (je Wand etwas anders → zackig)
  const broken = new Map();
  for (let tries = 0; tries < 600 && broken.size < 14; tries++) {
    const k = Math.floor(rand() * wood.sites.length);
    const s = wood.sites[k];
    if (rim(s.x, s.y) > 0.75 || s.type === 2) continue;
    broken.set(k, 12 + rand() * 28);
  }
  const walls = [];
  const openCell = new Set();   // Zellen am Umriss, denen Wände fehlen: ihr Lumen liegt auf ganzer Länge frei
  for (const e of wood.edges) {
    const mx = (e.a[0] + e.b[0]) / 2, my = (e.a[1] + e.b[1]) / 2;
    if (!inside(mx, my)) { openCell.add(e.i); if (e.j >= 0) openCell.add(e.j); continue; }
    const si = wood.sites[e.i], sj = e.j >= 0 ? wood.sites[e.j] : null;
    const outer = !sj || !inside(si.x, si.y) || !inside(sj.x, sj.y);
    let z1 = surfaceZ(mx, my) - edgeDrop(mx, my) * (0.7 + 0.3 * rand()) - rand() * 2.5;
    const drop = Math.max(broken.get(e.i) || 0, broken.get(e.j) || 0);
    if (drop) z1 -= drop * (0.55 + 0.45 * rand());
    else if (rand() < 0.012) z1 -= 6 + rand() * 25;      // vereinzelt abgebrochene Wände
    let len = breakLen(mx, my) * (0.86 + 0.28 * rand()) + (rand() < 0.04 ? 180 + rand() * 220 : 0);
    len = clamp(len, 30, LENGTH + 120);
    walls.push({ a: e.a, b: e.b, t: e.t, kind: e.kind, seed: e.seed, late: e.late, z0: Math.min(z1 - len, z1 - 15), z1, outer, i: e.i, j: e.j });
  }
  // Splitter-Flanken und Rückseite: unterhalb der ersten endenden Wand einer Zelle ist ihr Lumen seitlich bzw. hinten
  // offen – dort keine Hohlraum-Abdunklung, sonst bleiben die Längsseiten und das ferne Ende schwarz (User 2026-10-24)
  const cellBot = new Map();
  for (const w of walls) for (const c of [w.i, w.j]) if (c >= 0) cellBot.set(c, Math.max(cellBot.get(c) ?? -Infinity, w.z0));
  const botOf = (c) => (c < 0 || openCell.has(c) || !inside(wood.sites[c].x, wood.sites[c].y) ? OPEN_ALL : cellBot.get(c));
  for (const w of walls) {
    const s = wood.sites[w.i], dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1];
    const iLeft = dx * (s.y - w.a[1]) - dy * (s.x - w.a[0]) > 0;   // Zelle i liegt auf der +y-Seite der Wandplatte
    w.bot = iLeft ? [botOf(w.i), botOf(w.j)] : [botOf(w.j), botOf(w.i)];
  }

  // Tiefenabdunklung ab der eigenen Bruchkante (topMix): tiefere Stufen bleiben hell, Lumina und Gefäße dunkeln ab
  const sem = { openZ: OPEN_Z, depth: 16, base: 0.34, edge: 0.62, edgeW: 1.0, noise: 0.5, shade: 0.45, topMix: 0.75 };
  const scene = new THREE.Scene();
  const wallGroup = buildWalls(walls, sem);     // mit Tüpfeln: die frei liegenden Längswände zeigen Struktur
  scene.add(wallGroup);
  const blocks = new Map();     // Gruppe je Block: Einbauten (Durchbrechungsplatten, Trümmer) wandern mit ihrem Block
  const blockGroup = (b) => {
    if (!blocks.has(b)) { const g = new THREE.Group(); blocks.set(b, g); scene.add(g); }
    return blocks.get(b);
  };
  const byBlock = (list) => {
    const parts = new Map();
    for (const it of list) {
      const b = blockOf(it.p[0], it.p[1]);
      parts.set(b, [...(parts.get(b) || []), it]);
    }
    return parts;
  };
  const addSplit = (geometry, list, opts) => {
    for (const [b, part] of byBlock(list)) blockGroup(b).add(buildInstances(geometry.clone(), part, opts));
  };

  // Durchbrechungsplatten: schräge Ringleiste (einfach) oder Sprossen (leiterförmig) in einigen Gefäßen, knapp unter der Fläche
  const rims = [], bars = [];
  for (const v of wood.vessels) {
    if (rim(v.x, v.y) > 0.85 || rand() > 0.5) continue;
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
  for (const [b, part] of byBlock(rims)) {
    const rimMesh = new THREE.InstancedMesh(torus, semMaterial(cavity), part.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    part.forEach((it, i) => {
      e.set(it.r[0], it.r[1], it.r[2], it.order);
      rimMesh.setMatrixAt(i, m.compose(new THREE.Vector3(...it.p), q.setFromEuler(e), new THREE.Vector3(...it.s)));
    });
    rimMesh.instanceMatrix.needsUpdate = true;
    blockGroup(b).add(rimMesh);
  }
  addSplit(new THREE.BoxGeometry(1, 1, 1), bars, cavity);

  // Nur kleine Trümmer tief in den eingebrochenen Zellen (keine losen Flocken auf der Fläche, Wunsch User 2026-10-23)
  const flakes = [];
  for (const [k, drop] of broken) {
    const c = wood.sites[k];
    for (let j = 0; j < 3; j++) {
      const s = 1.5 + rand() * 3;
      flakes.push({ p: [c.x + (rand() - 0.5) * 5, c.y + (rand() - 0.5) * 5, surfaceZ(c.x, c.y) - drop * 0.85], s: [s, s * 0.7, s * 0.3], r: [rand() * 3, rand() * 3, rand() * 3] });
    }
  }
  addSplit(flakeGeometry(3), flakes, { ...sem, base: 0.42, noise: 1.4 });

  const camera = new THREE.PerspectiveCamera(35, ctx.aspect, 1, 6000);
  const dv = wood.dive;
  const porosity = wood.porosity(-300, -200, 300, 200);
  const zAt = (x, y) => surfaceZ(x, y) + 1;
  const rayX = wood.rayX(ray, -160);
  const hotspots = [
      { id: 'vessels', kind: 'dive', pos: new THREE.Vector3(dv.x, dv.y, zAt(dv.x, dv.y)), normal: new THREE.Vector3(0, 0, 1) },
      { id: 'ring', kind: 'info', pos: new THREE.Vector3(-230, ringY(-230), zAt(-230, ringY(-230))), normal: new THREE.Vector3(0, 0, 1) },
      { id: 'ray', kind: 'info', pos: new THREE.Vector3(rayX, -160, zAt(rayX, -160)), normal: new THREE.Vector3(0, 0, 1) },
      { id: 'porosity', kind: 'info', pos: new THREE.Vector3(250, -110, zAt(250, -110)), normal: new THREE.Vector3(0, 0, 1) },
  ];
  // Kapillar-Aufstieg (Vorschau 2026-10-25, Kapil:A): Wasser berührt die Stirnfläche und dringt in jedes offene Gefäß ein, die
  // Eindringtiefe folgt je Gefäßradius Lucas-Washburn (science.js capillaryRise, θ aus wettability), Zeitlupe 1500×. Die Gruppe am
  // Abzeichen schimmert zusätzlich blass durch die Wände (Lage der Front, F4); wasserabweisende Kohle: kein Aufstieg, Hinweis (F5)
  const SLOW = 1500, CAP_PERIOD = 14;
  const stillNow = () => reduced || settings.S.motion === 'off';
  const vesselsIn = wood.vessels.filter((v) => inside(v.x, v.y) && rim(v.x, v.y) < 0.9);
  const capAt = [dv.x - 120, dv.y + 70];
  const capV = vesselsIn.reduce((a, v) => (Math.hypot(v.x - capAt[0], v.y - capAt[1]) < Math.hypot(a.x - capAt[0], a.y - capAt[1]) ? v : a));
  hotspots.push({ id: 'capillary', kind: 'info', pos: new THREE.Vector3(capV.x, capV.y, zAt(capV.x, capV.y)), normal: new THREE.Vector3(0, 0, 1) });
  const capList = vesselsIn.map((v) => ({ v, p: [v.x, v.y], top: surfaceZ(v.x, v.y) - 1.5, len: clamp(breakLen(v.x, v.y) * 0.9, 60, LENGTH),
    group: Math.hypot(v.x - capV.x, v.y - capV.y) < 75 }));
  const colGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1).rotateX(Math.PI / 2);   // Achse → z, Länge 1
  const waterMat = new THREE.MeshBasicMaterial({ color: 0x5aaaff, transparent: true, opacity: 0.62, depthWrite: false });
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x5aaaff, transparent: true, opacity: 0.24, depthTest: false, depthWrite: false });
  const cols = [], colMeshes = [];
  for (const [b, part] of byBlock(capList)) {
    const mesh = new THREE.InstancedMesh(colGeo, waterMat, part.length);
    const ghost = new THREE.InstancedMesh(colGeo, ghostMat, part.length);
    mesh.renderOrder = 2;
    ghost.renderOrder = 1;
    mesh.frustumCulled = ghost.frustumCulled = false;
    part.forEach((c, i) => cols.push({ mesh, ghost, i, c }));
    colMeshes.push(mesh, ghost);
    blockGroup(b).add(mesh, ghost);
  }
  const capCol = cols.find((o) => o.c.v === capV);
  const capInfo = { on: false, tMs: 0, h: 0, theta: 40 };
  const capPts = [new THREE.Vector3(), new THREE.Vector3()];
  const cm4 = new THREE.Matrix4(), ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
  const setCols = (tMs, alpha) => {
    waterMat.opacity = 0.62 * alpha;
    ghostMat.opacity = 0.24 * alpha;
    const hOf = (c) => Math.min(c.len, capillaryRise(c.v.r, tMs * 1e-3, shownT));
    for (const { mesh, ghost, i, c } of cols) {
      const hh = hOf(c);
      if (hh < 0.5) { mesh.setMatrixAt(i, ZERO_M); ghost.setMatrixAt(i, ZERO_M); continue; }   // trocken: keine Scheibe auf der Fläche
      cm4.makeScale(c.v.r * 0.9, c.v.r * 0.9, hh).setPosition(c.v.x, c.v.y, c.top - hh / 2);
      mesh.setMatrixAt(i, cm4);
      ghost.setMatrixAt(i, c.group ? cm4 : ZERO_M);
    }
    for (const m of colMeshes) m.instanceMatrix.needsUpdate = true;
    Object.assign(capInfo, { on: alpha > 0.05, tMs, theta: wettability(shownT).theta, h: capillaryRise(12, tMs * 1e-3, shownT) });
    // Maßlinie neben der Flanke (−y): von der Stirnfläche bis zur Front des Gefäßes am Abzeichen, in Weltkoordinaten
    const c = capCol.c, h = Math.max(hOf(c), 150), k = tissueScale(shownT), [dx, dy] = shiftOf(blockOf(c.v.x, c.v.y));
    const x = (c.v.x + dx) * k.xy, y = (-HALF_Y - 70 + dy) * k.xy;
    capPts[0].set(x, y, c.top * k.z);
    capPts[1].set(x, y, (c.top - h) * k.z);
  };
  // Zyklus: 0,5 s trocken · 6 s Front (0 → 4 ms) · 3,5 s halten · 1 s ausblenden · Pause; Bewegung „Voll“ wiederholt, „Ruhig“ einmal
  // + auf Klick, „Aus“/reduced-motion: ruhende Front bei 1,5 ms
  let capT = -1, capRuns = 0, capIdle = 0;
  const capStep = (dt) => {
    const on = settings.S.capillary !== false;
    for (const m of colMeshes) m.visible = on;
    if (!on) { capInfo.on = false; return; }
    if (stillNow()) capT = -1;
    else if (capT >= 0) { capT += dt; if (capT >= CAP_PERIOD) capT = settings.S.motion === 'full' ? 0 : -1; }
    else if (settings.S.motion === 'full' || capRuns === 0) { capIdle += dt; if (capIdle > 2.0) { capT = 0; capRuns++; capIdle = 0; } }
    const c = capT;
    const [tMs, alpha] = c < 0 ? [1.5, 1] : c < 0.5 ? [0, 1] : c < 6.5 ? [((c - 0.5) * 1000) / SLOW, 1] : c < 10 ? [4, 1] : c < 11 ? [4, 11 - c] : [0, 0];
    setCols(tMs, alpha);
  };
  const base = hotspots.map((h) => h.pos.clone());
  const baseBlock = base.map((p) => blockOf(p.x, p.y));
  // Pyrolyse: die Gewebeprobe schwindet (quer stärker als längs), die Zellwände werden dünner, die Schwundrisse öffnen
  // sich nacheinander – alles gleitet mit dem Regler
  let shownT = ctx.temp, lastT = NaN;
  function applyTemp() {
    if (shownT === lastT) return;
    lastT = shownT;
    const k = tissueScale(shownT);
    for (const c of [...radial, ring]) c.gap = c.w * k[c.open];
    wallGroup.userData.setThin(k.wall / k.xy, (x, y) => shiftOf(blockOf(x, y)));   // die Szenenskalierung trifft die Wand mit
    for (const [b, g] of blocks) g.position.set(...shiftOf(b), 0);
    shrinkScene(scene, k.xy, k.z);
    hotspots.forEach((h, i) => {
      const [dx, dy] = shiftOf(baseBlock[i]);
      h.pos.set((base[i].x + dx) * k.xy, (base[i].y + dy) * k.xy, base[i].z * k.z);
    });
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
    home: { pos: new THREE.Vector3(470, -560, 820), target: new THREE.Vector3(-30, -40, -150) },
    orbit: { minDistance: 220, maxDistance: 1800, minAzimuthAngle: -1.2, maxAzimuthAngle: 1.2, minPolarAngle: 0.8, maxPolarAngle: 2.75, enablePan: true },
    hotspots,
    facts: () => [{ value: `${fmt(porosity * 100)} %`, label: 'Porenanteil dieses Modells (Zelllumen / Fläche)' }],
    update(dt, t) {
      semDetector(t);
      applyTemp();
      capStep(dt);
      return true;
    },
    onHotspot(id) {
      if (id === 'capillary' && !stillNow()) { capT = 0; capRuns++; }   // Klick startet den Aufstieg neu
    },
    setParam(name, value) {
      if (name === 'temp') { shownT = value; level.dirty = true; }
    },
    dispose() { disposeGroup(scene); },
  };
  level.overlays = [{
    cls: 'ov-capillary', pts: () => capPts, arrow: 'end', active: () => capInfo.on,
    text: () => (capInfo.theta > 90
      ? `<b>θ ≈ ${fmt(capInfo.theta)}°</b> · wasserabweisend: kein Kapillar-Aufstieg`
      : `<b>t = ${fmt(capInfo.tMs, 1)} ms</b> · h ≈ ${fmt(capInfo.h / 1000, 2)} mm · Zeitlupe ${SLOW}× (Lucas-Washburn)`),
  }];
  return level;
}
