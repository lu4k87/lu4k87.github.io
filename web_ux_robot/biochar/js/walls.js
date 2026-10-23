// Zellwände als Instanzen: jede Voronoi-Kante = dünne Wandplatte, jede Ecke = Prisma, das die Fuge schließt.

import * as THREE from 'three';
import { semMaterial } from './sem.js';
import { hash13f } from './util.js';

// walls: [{a:[x,y], b:[x,y], t, kind, seed, late, z0, z1}]
export function buildWalls(walls, semOpts) {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const data = new Float32Array(walls.length * 4);
  const wallMat = semMaterial({ ...semOpts, walls: true, pits: semOpts.pits !== false });
  const mesh = new THREE.InstancedMesh(box, wallMat, walls.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const z = new THREE.Vector3(0, 0, 1);

  const joints = new Map();
  walls.forEach((w, k) => {
    const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1];
    const len = Math.hypot(dx, dy);
    p.set((w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2, (w.z0 + w.z1) / 2);
    q.setFromAxisAngle(z, Math.atan2(dy, dx));
    s.set(len, w.t, w.z1 - w.z0);
    mesh.setMatrixAt(k, m.compose(p, q, s));
    data[k * 4] = w.kind;
    data[k * 4 + 1] = w.seed;
    data[k * 4 + 2] = w.late || 0;
    for (const pt of [w.a, w.b]) {
      if (w.openEnd && pt === w.b) continue;
      const key = `${Math.round(pt[0] * 200)},${Math.round(pt[1] * 200)}`;
      const j = joints.get(key);
      if (j) { j.t = Math.max(j.t, w.t); j.z0 = Math.min(j.z0, w.z0); j.z1 = Math.max(j.z1, w.z1); }
      else joints.set(key, { p: pt, t: w.t, z0: w.z0, z1: w.z1 });
    }
  });
  box.setAttribute('aWall', new THREE.InstancedBufferAttribute(data, 4));
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);

  const prism = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
  prism.rotateX(Math.PI / 2);
  const jointMat = semMaterial({ ...semOpts, joint: true });
  const list = [...joints.values()];
  const jm = new THREE.InstancedMesh(prism, jointMat, list.length);
  list.forEach((j, k) => {
    p.set(j.p[0], j.p[1], (j.z0 + j.z1) / 2);
    q.identity();
    s.set(j.t * 0.56, j.t * 0.56, j.z1 - j.z0);
    jm.setMatrixAt(k, m.compose(p, q, s));
  });
  jm.instanceMatrix.needsUpdate = true;
  group.add(jm);

  group.userData.materials = [wallMat, jointMat];
  return group;
}

// Beliebige Teile als Instanzen im REM-Look: list = [{ p: [x, y, z], s: [sx, sy, sz], r: [rx, ry, rz] }]
export function buildInstances(geometry, list, semOpts) {
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
