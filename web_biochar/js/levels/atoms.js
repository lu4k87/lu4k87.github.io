// Ebene 7: ein aromatischer Cluster (Einheit Å) mit Randgruppen – Größe und Sauerstoffanteil folgen der
// Pyrolysetemperatur. Vereinfachtes Kugel-Stab-Modell: eben, ohne Fünf-/Siebenring-Defekte; konische Bindungen in
// den Farben der Atome, weiche Elektronenwolke (van-der-Waals-Radius) und weiche Eigenschatten.

import * as THREE from 'three';
import { nanoStructure, fmt } from '../science.js';
import { mulberry32 } from '../util.js';
import { ADDITIVE } from '../sem.js';

const A = 1.42;   // C–C aromatisch
const ELEMENT = {     // r = Kugel im Modell, vdw = van-der-Waals-Radius (Å, Bondi 1964) für die Elektronenwolke
  C: { r: 0.38, vdw: 1.70, color: new THREE.Color(0.2, 0.21, 0.23) },
  O: { r: 0.4, vdw: 1.52, color: new THREE.Color(0.86, 0.2, 0.18) },
  H: { r: 0.26, vdw: 1.20, color: new THREE.Color(0.92, 0.92, 0.94) },
  K: { r: 0.95, vdw: 2.75, color: new THREE.Color(0.55, 0.3, 0.88) },
};

// Elektronenwolke: von innen dichter, zum Rand weich auslaufend (additiv, sehr schwach)
const CLOUD_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vCol;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  vCol = instanceColor;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const CLOUD_FRAG = /* glsl */ `
uniform float uStrength;
varying vec3 vN;
varying vec3 vV;
varying vec3 vCol;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV)));
  float dens = pow(f, 2.2);
  gl_FragColor = vec4(vCol * dens * uStrength, 1.0);
}`;
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n) => String(n).split('').map((d) => SUB[+d]).join('');

function rot2(d, deg) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return new THREE.Vector3(d.x * c - d.y * s, d.x * s + d.y * c, 0);
}

export function buildCluster(T) {
  const ns = nanoStructure(T);
  const cand = [];
  for (let q = -5; q <= 5; q++) {
    for (let r = -5; r <= 5; r++) {
      const x = Math.sqrt(3) * A * (q + r / 2), y = 1.5 * A * r;
      cand.push({ x, y, d: Math.hypot(x, y) + 0.001 * Math.atan2(y, x) });
    }
  }
  cand.sort((a, b) => a.d - b.d);
  const rings = cand.slice(0, ns.rings);

  const atoms = [];
  const keyOf = new Map();
  const bonds = new Map();
  const addAtom = (el, p) => { atoms.push({ el, p }); return atoms.length - 1; };
  const carbon = (x, y) => {
    const k = `${Math.round(x * 100)},${Math.round(y * 100)}`;
    if (!keyOf.has(k)) keyOf.set(k, addAtom('C', new THREE.Vector3(x, y, 0)));
    return keyOf.get(k);
  };
  const bond = (i, j, order = 1) => bonds.set(i < j ? `${i}-${j}` : `${j}-${i}`, { i, j, order });
  for (const ring of rings) {
    const ids = [];
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      ids.push(carbon(ring.x + A * Math.cos(a), ring.y + A * Math.sin(a)));
    }
    for (let k = 0; k < 6; k++) bond(ids[k], ids[(k + 1) % 6]);
  }
  const ringCarbons = atoms.length;
  const degree = new Array(ringCarbons).fill(0);
  const neighbors = Array.from({ length: ringCarbons }, () => []);
  for (const b of bonds.values()) {
    degree[b.i]++; degree[b.j]++;
    neighbors[b.i].push(b.j); neighbors[b.j].push(b.i);
  }
  const edge = [];
  for (let i = 0; i < ringCarbons; i++) {
    if (degree[i] !== 2) continue;
    const p = atoms[i].p;
    const mid = atoms[neighbors[i][0]].p.clone().add(atoms[neighbors[i][1]].p).multiplyScalar(0.5);
    edge.push({ i, dir: p.clone().sub(mid).normalize(), ang: Math.atan2(p.y, p.x) });
  }
  edge.sort((a, b) => a.ang - b.ang);

  // Randgruppen: wenige O-Gruppen bei hoher, viele bei niedriger Temperatur; Rest Wasserstoff
  const nO = Math.max(3, Math.round(edge.length * ns.oxygenShare));
  const types = ['carboxylate', 'phenol', 'carbonyl', 'carboxyl', 'phenol', 'carbonyl', 'carboxyl', 'phenol'];
  const assigned = new Map();
  for (let k = 0; k < nO; k++) assigned.set(Math.floor((k * edge.length) / nO + 1) % edge.length, types[k % types.length]);
  const marks = {};
  const tilt = (base, d, list, deg) => {
    const axis = new THREE.Vector3(d.x, d.y, 0).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(axis, (deg * Math.PI) / 180);
    for (const id of list) atoms[id].p.sub(base).applyQuaternion(q).add(base);
  };
  edge.forEach((e, k) => {
    const p = atoms[e.i].p, d = e.dir;
    const type = assigned.get(k) || 'H';
    if (type === 'H') {
      const h = addAtom('H', p.clone().addScaledVector(d, 1.09));
      bond(e.i, h);
      marks.edgeh ??= h;
    } else if (type === 'phenol') {
      const o = addAtom('O', p.clone().addScaledVector(d, 1.36));
      const h = addAtom('H', atoms[o].p.clone().add(rot2(d, 65).multiplyScalar(0.96)));
      bond(e.i, o); bond(o, h);
      marks.phenol ??= o;
    } else if (type === 'carbonyl') {
      const o = addAtom('O', p.clone().addScaledVector(d, 1.23));
      bond(e.i, o, 2);
      marks.carbonyl ??= o;
    } else {
      const c = addAtom('C', p.clone().addScaledVector(d, 1.48));
      const cp = atoms[c].p;
      const ionic = type === 'carboxylate';
      const o1 = addAtom('O', cp.clone().add(rot2(d, 60).multiplyScalar(ionic ? 1.26 : 1.21)));
      const o2 = addAtom('O', cp.clone().add(rot2(d, -60).multiplyScalar(ionic ? 1.26 : 1.32)));
      bond(e.i, c); bond(c, o1, ionic ? 1 : 2); bond(c, o2);
      const group = [c, o1, o2];
      if (ionic) {
        const kk = addAtom('K', cp.clone().addScaledVector(d, 2.75));
        group.push(kk);
        marks.carboxyl ??= kk;
      } else {
        const h = addAtom('H', atoms[o2].p.clone().add(rot2(d, -10).multiplyScalar(0.97)));
        bond(o2, h);
        group.push(h);
      }
      tilt(p.clone(), d, group, ionic ? 22 : -28);
    }
  });

  const count = { C: 0, H: 0, O: 0, K: 0 };
  for (const a of atoms) count[a.el]++;
  return {
    ns, rings, atoms, bonds: [...bonds.values()], marks,
    formula: `C${sub(count.C)}H${sub(count.H)}O${sub(count.O)}`,
    hc: count.H / count.C,
    nRings: rings.length,
  };
}

export function create(ctx) {
  const scene = new THREE.Scene();
  scene.environment = ctx.env;
  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight(0xfff4e8, 1.8);
  key.position.set(6, 10, 8);
  key.castShadow = true;                        // weiche Eigenschatten (PCF, Rand weich)
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
  const rim = new THREE.DirectionalLight(0x9db8ff, 1.3);
  rim.position.set(-8, -4, -6);
  scene.add(key, rim);

  const sphere = new THREE.SphereGeometry(1, 28, 18);
  // Halbbindung als Kegelstumpf: breit am Atom (unten), schmal zur Mitte (oben)
  const cyl = new THREE.CylinderGeometry(0.62, 1, 1, 14, 1, true);
  const atomMat = new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0 });
  const bondMat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.05 });
  const cloudGeo = new THREE.SphereGeometry(1, 24, 16);
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: 0.02 } }, vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, ...ADDITIVE,
  });
  // π-Elektronen über und unter den Ringen: weiche Scheiben statt harter Sechsecke
  const piMat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `varying vec2 vP; void main() { float r = length(vP) / ${(A * 1.15).toFixed(3)}; gl_FragColor = vec4(vec3(0.48, 0.64, 1.0) * 0.022 * (1.0 - smoothstep(0.2, 1.0, r)), 1.0); }`,
    ...ADDITIVE, side: THREE.DoubleSide,
  });
  const hex = new THREE.CircleGeometry(A * 1.15, 24);
  const group = new THREE.Group();
  scene.add(group);

  const hs = {
    ring: { id: 'ring', kind: 'info', pos: new THREE.Vector3(0, 0, 0.9), normal: null },
    carboxyl: { id: 'carboxyl', kind: 'info', pos: new THREE.Vector3(), normal: null },
    phenol: { id: 'phenol', kind: 'info', pos: new THREE.Vector3(), normal: null },
    carbonyl: { id: 'carbonyl', kind: 'info', pos: new THREE.Vector3(), normal: null },
    edgeh: { id: 'edgeh', kind: 'info', pos: new THREE.Vector3(), normal: null },
  };
  let cluster, atomMesh, bondMesh, cloudMesh, phases;
  const rand = mulberry32(5);

  function rebuild(T) {
    for (const c of [...group.children]) { group.remove(c); c.dispose?.(); }
    cluster = buildCluster(T);
    phases = cluster.atoms.map(() => [rand() * 6.28, rand() * 6.28, rand() * 6.28]);
    atomMesh = new THREE.InstancedMesh(sphere, atomMat, cluster.atoms.length);
    cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, cluster.atoms.length);
    cluster.atoms.forEach((a, k) => {
      atomMesh.setColorAt(k, ELEMENT[a.el].color);
      cloudMesh.setColorAt(k, ELEMENT[a.el].color.clone().lerp(new THREE.Color(0.55, 0.7, 1.0), 0.6));
    });
    const nb = cluster.bonds.reduce((n, b) => n + b.order, 0) * 2;
    bondMesh = new THREE.InstancedMesh(cyl, bondMat, nb);
    {
      const grey = new THREE.Color(0.62, 0.64, 0.68);
      let n = 0;
      for (const b of cluster.bonds) {
        for (let o = 0; o < b.order; o++) {
          bondMesh.setColorAt(n++, ELEMENT[cluster.atoms[b.i].el].color.clone().lerp(grey, 0.55));
          bondMesh.setColorAt(n++, ELEMENT[cluster.atoms[b.j].el].color.clone().lerp(grey, 0.55));
        }
      }
    }
    for (const mesh of [atomMesh, bondMesh]) { mesh.castShadow = true; mesh.receiveShadow = true; }
    const pi = new THREE.InstancedMesh(hex, piMat, cluster.rings.length * 2);
    const m = new THREE.Matrix4();
    cluster.rings.forEach((r, k) => {
      pi.setMatrixAt(2 * k, m.makeTranslation(r.x, r.y, 0.95));
      pi.setMatrixAt(2 * k + 1, m.makeTranslation(r.x, r.y, -0.95));
    });
    group.add(atomMesh, bondMesh, pi, cloudMesh);
    for (const [k, id] of Object.entries(cluster.marks)) {
      hs[k].pos.copy(cluster.atoms[id].p).add(new THREE.Vector3(0, 0, k === 'carboxyl' ? 1.3 : 0.7));
    }
    place(0);
  }

  const tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
  const pos = [];
  function place(t) {
    const { m, q, s, up } = tmp;
    cluster.atoms.forEach((a, k) => {
      const ph = phases[k];
      const amp = a.el === 'K' ? 0.12 : 0.035;
      pos[k] = (pos[k] || new THREE.Vector3()).set(
        a.p.x + amp * Math.sin(t * 7.3 + ph[0]), a.p.y + amp * Math.sin(t * 8.1 + ph[1]), a.p.z + amp * Math.sin(t * 6.7 + ph[2]));
      s.setScalar(ELEMENT[a.el].r);
      atomMesh.setMatrixAt(k, m.compose(pos[k], q.identity(), s));
      s.setScalar(ELEMENT[a.el].vdw * 0.85);
      cloudMesh.setMatrixAt(k, m.compose(pos[k], q, s));
    });
    let n = 0;
    const dir = new THREE.Vector3(), side = new THREE.Vector3(), c = new THREE.Vector3();
    const q2 = new THREE.Quaternion();
    for (const b of cluster.bonds) {
      dir.subVectors(pos[b.j], pos[b.i]);
      const len = dir.length();
      dir.divideScalar(len);
      q.setFromUnitVectors(up, dir);                    // Hälfte am Atom i: breit unten = bei i
      q2.setFromUnitVectors(up, dir.clone().negate());  // Hälfte am Atom j
      side.set(-dir.y, dir.x, 0).normalize();
      for (let o = 0; o < b.order; o++) {
        const off = b.order === 2 ? (o === 0 ? 0.13 : -0.13) : 0;
        const w = b.order === 2 ? 0.1 : 0.16;
        s.set(w, len / 2, w);
        c.copy(pos[b.i]).addScaledVector(dir, len / 4).addScaledVector(side, off);
        bondMesh.setMatrixAt(n++, m.compose(c, q, s));
        c.copy(pos[b.j]).addScaledVector(dir, -len / 4).addScaledVector(side, off);
        bondMesh.setMatrixAt(n++, m.compose(c, q2, s));
      }
    }
    atomMesh.instanceMatrix.needsUpdate = true;
    bondMesh.instanceMatrix.needsUpdate = true;
    cloudMesh.instanceMatrix.needsUpdate = true;
  }

  rebuild(ctx.temp);
  const camera = new THREE.PerspectiveCamera(40, ctx.aspect, 0.1, 300);
  const level = {
    scene, camera,
    unit: 1e-10,
    method: 'Molekülmodell (vereinfacht)',
    tone: 1,
    grain: 0.018,
    dof: 2.5,
    bloom: 0.18,
    home: { pos: new THREE.Vector3(5, 9, 21), target: new THREE.Vector3(0, 0, 0) },
    orbit: { minDistance: 6, maxDistance: 45, enablePan: false, autoRotate: true },
    hotspots: Object.values(hs),
    facts: () => [
      { value: cluster.formula, label: `Summenformel dieses Clusters, ${cluster.nRings} Ringe (ohne K⁺)` },
      { value: fmt(cluster.hc, 2), label: 'molares H/C dieses Modell-Clusters' },
    ],
    update(dt, t) {
      // Lichtführung: Hauptlicht wandert langsam um den Cluster, Gegenlicht pendelt
      key.position.set(6 * Math.cos(t * 0.08) - 8 * Math.sin(t * 0.08) * 0.4, 10, 8 * Math.cos(t * 0.06) + 6 * Math.sin(t * 0.08) * 0.4);
      rim.position.set(-8 + 3 * Math.sin(t * 0.05), -4, -6 + 3 * Math.cos(t * 0.05));
      place(t);
      return true;
    },
    setParam(name, value) {
      if (name !== 'temp') return;
      rebuild(value);
      level.dirty = true;
    },
    dispose() {
      sphere.dispose(); cyl.dispose(); hex.dispose(); cloudGeo.dispose();
      atomMat.dispose(); bondMat.dispose(); piMat.dispose(); cloudMat.dispose();
    },
  };
  return level;
}
