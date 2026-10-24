// Zellwände als Instanzen: jede Voronoi-Kante = dünne Wandplatte, jede Ecke = Prisma, das die Fuge schließt.

import * as THREE from 'three';
import { semMaterial } from './sem.js';
import { hash13f } from './util.js';

// walls: [{a:[x,y], b:[x,y], t, kind, seed, late, z0, z1, bot?}]; bot = [z +y-Seite, z −y-Seite]: unterhalb davon ist
// die Zelle auf dieser Seite seitlich/hinten offen (keine Hohlraum-Abdunklung)
export function buildWalls(walls, semOpts) {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const data = new Float32Array(walls.length * 4);
  const tops = new Float32Array(walls.length);
  const bot = walls.some((w) => w.bot);
  const bots = new Float32Array(walls.length * 2);
  const wallMat = semMaterial({ ...semOpts, walls: true, pits: semOpts.pits !== false, bot });
  const mesh = new THREE.InstancedMesh(box, wallMat, walls.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const z = new THREE.Vector3(0, 0, 1);

  const joints = new Map();
  const geo = [];    // Lage jeder Wandplatte, damit setThin die Dicke später neu setzen kann
  walls.forEach((w, k) => {
    const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1];
    const len = Math.hypot(dx, dy);
    p.set((w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2, (w.z0 + w.z1) / 2);
    q.setFromAxisAngle(z, Math.atan2(dy, dx));
    s.set(len, w.t, w.z1 - w.z0);
    mesh.setMatrixAt(k, m.compose(p, q, s));
    geo.push({ p: p.clone(), q: q.clone(), s: s.clone() });
    data[k * 4] = w.kind;
    data[k * 4 + 1] = w.seed;
    data[k * 4 + 2] = w.late || 0;
    data[k * 4 + 3] = w.outer ? 1 : 0;      // Außenwand des Bruchstücks: keine Hohlraum-Abdunklung
    tops[k] = w.z1;
    if (bot) bots.set(w.bot, k * 2);
    const wb = bot ? Math.max(...w.bot) : 0;   // Ecke: offen, sobald eine angrenzende Zelle offen ist
    for (const pt of [w.a, w.b]) {
      if (w.openEnd && pt === w.b) continue;
      const key = `${Math.round(pt[0] * 200)},${Math.round(pt[1] * 200)}`;
      const j = joints.get(key);
      if (j) { j.t = Math.max(j.t, w.t); j.z0 = Math.min(j.z0, w.z0); j.z1 = Math.max(j.z1, w.z1); j.bot = Math.max(j.bot, wb); }
      else joints.set(key, { p: pt, t: w.t, z0: w.z0, z1: w.z1, bot: wb });
    }
  });
  box.setAttribute('aWall', new THREE.InstancedBufferAttribute(data, 4));
  box.setAttribute('aTop', new THREE.InstancedBufferAttribute(tops, 1));
  if (bot) box.setAttribute('aBot', new THREE.InstancedBufferAttribute(bots, 2));
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);

  const prism = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
  prism.rotateX(Math.PI / 2);
  const jointMat = semMaterial({ ...semOpts, joint: true, bot });
  const list = [...joints.values()];
  prism.setAttribute('aTop', new THREE.InstancedBufferAttribute(Float32Array.from(list, (j) => j.z1), 1));
  if (bot) prism.setAttribute('aBot', new THREE.InstancedBufferAttribute(Float32Array.from(list.flatMap((j) => [j.bot, j.bot])), 2));
  const jm = new THREE.InstancedMesh(prism, jointMat, list.length);
  // Ecke ragt 0,1 Wanddicken über die höchste Wand: gleich hohe Deckflächen flackern (Z-Fighting), die Ecke deckt so
  // auch die Überlappung der Wandenden ab
  const jgeo = list.map((j) => {
    const top = j.z1 + 0.1 * j.t;
    return { p: new THREE.Vector3(j.p[0], j.p[1], (j.z0 + top) / 2), t: j.t * 0.56, h: top - j.z0 };
  });
  // f = Wanddicke relativ zur Ausgangsdicke; offset(x, y) = Versatz [dx, dy] quer zur Faser (Risse, die sich mit der Schwindung öffnen)
  const setThin = (f, offset) => {
    const shifted = (v) => { const d = offset ? offset(v.x, v.y) : [0, 0]; return p.set(v.x + d[0], v.y + d[1], v.z); };
    geo.forEach((g, k) => mesh.setMatrixAt(k, m.compose(shifted(g.p), g.q, s.set(g.s.x, g.s.y * f, g.s.z))));
    jgeo.forEach((j, k) => jm.setMatrixAt(k, m.compose(shifted(j.p), q.identity(), s.set(j.t * f, j.t * f, j.h))));
    mesh.instanceMatrix.needsUpdate = true;
    jm.instanceMatrix.needsUpdate = true;
  };
  setThin(1);
  group.add(jm);

  group.userData.materials = [wallMat, jointMat];
  group.userData.setThin = setThin;       // Wanddicke relativ zur Ausgangsdicke (Pyrolyse: Masseverlust)
  return group;
}

// Schwindung der ganzen REM-Szene: skaliert die Szene und führt die Welt-Ebenen der Bruchfläche (uOpenZ/uOpenX)
// mit, damit die Tiefenabdunklung an der Fläche bleibt. xy quer zur Faser, z längs.
// pivot = Punkt, der fest bleibt (sonst der Ursprung): das Stück schrumpft an Ort und Stelle statt aus dem Bild zu wandern
export function shrinkScene(scene, xy, z, pivot) {
  scene.scale.set(xy, xy, z);
  if (pivot) scene.position.set(pivot.x * (1 - xy), pivot.y * (1 - xy), pivot.z * (1 - z));
  scene.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const mat of mats) {
      const u = mat.uniforms;
      if (!u || !u.uOpenZ) continue;
      mat.userData.open ??= [u.uOpenZ.value, u.uOpenX.value];
      u.uOpenZ.value = mat.userData.open[0] * z + scene.position.z;
      u.uOpenX.value = mat.userData.open[1] * xy + scene.position.x;
    }
  });
}

// Beliebige Teile als Instanzen im REM-Look: list = [{ p: [x, y, z], s: [sx, sy, sz], r: [rx, ry, rz] }]
export function buildInstances(geometry, list, semOpts) {
  if (semOpts.topMix) geometry.setAttribute('aTop', new THREE.InstancedBufferAttribute(Float32Array.from(list, (it) => it.p[2]), 1));
  const mesh = new THREE.InstancedMesh(geometry, semMaterial(semOpts), list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  list.forEach((it, k) => {
    e.set(it.r[0], it.r[1], it.r[2]);
    mesh.setMatrixAt(k, m.compose(p.fromArray(it.p), q.setFromEuler(e), s.fromArray(it.s)));
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// Splitter und Bruchflocken: kantige Scherbe (verzerrtes Ikosaeder, gleiche Ecken gleich verschoben → geschlossen)
export function flakeGeometry(seed = 1) {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const h = hash13f(v.x * 17.3 + seed, v.y * 11.1 + seed * 3, v.z * 7.7);
    v.multiplyScalar(0.6 + 0.7 * h);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function disposeGroup(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mat) => {
      for (const v of Object.values(mat)) if (v && v.isTexture) v.dispose();
      mat.dispose();
    });
  });
}
