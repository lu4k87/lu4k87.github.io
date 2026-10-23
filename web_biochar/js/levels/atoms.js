// Ebene 7: ein aromatischer Cluster (Einheit Å) mit Randgruppen – Größe und Sauerstoffanteil folgen der
// Pyrolysetemperatur. Vereinfachtes Kugel-Stab-Modell: eben, ohne Fünf-/Siebenring-Defekte; konische Bindungen in
// den Farben der Atome, weiche Elektronenwolke (van-der-Waals-Radius) und weiche Eigenschatten.

import * as THREE from 'three';
import { nanoStructure, fmt, T_MIN, T_MAX } from '../science.js';
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

// feste Pseudozufallszahl 0..1 aus einer Lage (Å), stabil bei gleichem Gitterplatz
const siteHash = (x, y) => { const v = Math.sin(Math.round(x * 50) * 12.9898 + Math.round(y * 50) * 78.233) * 43758.5453; return v - Math.floor(v); };

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

  // Randgruppen: wenige O-Gruppen bei hoher, viele bei niedriger Temperatur; Rest Wasserstoff.
  // Die Plätze sind nach einer festen Rangfolge (Hash der Lage) geordnet: sinkt der O-Anteil, entfallen immer die hinteren
  // Gruppen, die übrigen bleiben – so lässt sich der Übergang zwischen zwei Temperaturen als Abspalten zeigen.
  const nO = Math.max(3, Math.round(edge.length * ns.oxygenShare));
  const types = ['carboxylate', 'phenol', 'carbonyl', 'carboxyl', 'phenol', 'carbonyl', 'carboxyl', 'phenol'];
  const rank = edge
    .map((e, k) => ({ k, h: siteHash(atoms[e.i].p.x, atoms[e.i].p.y) }))
    .sort((a, b) => a.h - b.h);
  const assigned = new Map();
  for (let r = 0; r < nO && r < rank.length; r++) assigned.set(rank[r].k, types[r % types.length]);
  const marks = {};
  const tilt = (base, d, list, deg) => {
    const axis = new THREE.Vector3(d.x, d.y, 0).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(axis, (deg * Math.PI) / 180);
    for (const id of list) atoms[id].p.sub(base).applyQuaternion(q).add(base);
  };
  edge.forEach((e, k) => {
    const p = atoms[e.i].p, d = e.dir;
    const type = assigned.get(k) || 'H';
    const first = atoms.length;
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
    for (let i = first; i < atoms.length; i++) atoms[i].dir = d;   // Abflugrichtung der Gruppe (nach außen)
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

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const keyOfAtom = (a) => `${a.el}:${Math.round(a.p.x * 20)},${Math.round(a.p.y * 20)},${Math.round(a.p.z * 20)}`;
const quant = (T) => Math.min(T_MAX, Math.max(T_MIN, Math.round(T / 25) * 25));   // Struktur in 25-°C-Stufen
const GROW = 0.9, LEAVE = 1.7, FLY = 3.2;   // s Einwachsen, s bis zum Verblassen, Å/s Abflug

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

  // ---- Atome, Bindungen und Ringe als lebender Bestand: Temperaturwechsel gleitet statt neu aufzubauen ----
  // Atom: { el, home, s (0..1 sichtbar), leaving, off (Abflug), vel, dir }. Neue Atome wachsen ein (Kondensation),
  // entfallende Randgruppen (H, OH, COOH …) fliegen als H₂O/CO₂/H₂ nach außen und verblassen (Dehydratisierung, Decarboxylierung).
  const CAP_A = 360, CAP_B = 900, CAP_R = 40;
  const pool = new Map(), bondPool = new Map(), ringPool = new Map();
  let cluster = null, builtQ = NaN, order = { atoms: [], bonds: [] }, orderDirty = true;
  const atomMesh = new THREE.InstancedMesh(sphere, atomMat, CAP_A);
  const cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, CAP_A);
  const bondMesh = new THREE.InstancedMesh(cyl, bondMat, CAP_B);
  const piMesh = new THREE.InstancedMesh(hex, piMat, CAP_R * 2);
  for (const mesh of [atomMesh, bondMesh]) { mesh.castShadow = true; mesh.receiveShadow = true; }
  for (const mesh of [atomMesh, cloudMesh, bondMesh, piMesh]) { mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  group.add(atomMesh, bondMesh, piMesh, cloudMesh);
  const rand = mulberry32(5);
  const GREY = new THREE.Color(0.62, 0.64, 0.68), BLUE = new THREE.Color(0.55, 0.7, 1.0);
  const live = { C: 0, H: 0, O: 0, hc: 0, rings: 0 };

  function retarget(Tq, instant) {
    builtQ = Tq;
    cluster = buildCluster(Tq);
    const nextKeys = new Set();
    const keys = cluster.atoms.map((a) => keyOfAtom(a));
    cluster.atoms.forEach((a, i) => {
      nextKeys.add(keys[i]);
      let e = pool.get(keys[i]);
      if (!e) {
        e = { key: keys[i], el: a.el, home: a.p.clone(), s: instant ? 1 : 0, leaving: false, off: new THREE.Vector3(), vel: new THREE.Vector3(), ph: [rand() * 6.28, rand() * 6.28, rand() * 6.28] };
        pool.set(keys[i], e);
      }
      e.leaving = false;
      e.dir = a.dir;
    });
    for (const e of pool.values()) {
      if (nextKeys.has(e.key) || e.leaving) continue;
      e.leaving = true;
      const d = e.dir || new THREE.Vector3(e.home.x, e.home.y, 0).normalize();
      e.vel.set(d.x, d.y, (rand() - 0.5) * 0.8).normalize().multiplyScalar(FLY * (0.8 + 0.4 * rand()));
    }
    const nextBonds = new Set();
    for (const b of cluster.bonds) {
      const ka = keys[b.i], kb = keys[b.j];
      const bk = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      nextBonds.add(bk);
      let e = bondPool.get(bk);
      if (!e) { e = { a: pool.get(ka), b: pool.get(kb), order: b.order, w: instant ? 1 : 0 }; bondPool.set(bk, e); }
      e.want = 1;
    }
    for (const [bk, e] of bondPool) if (!nextBonds.has(bk)) e.want = e.a.leaving && e.b.leaving ? 1 : 0;   // die abziehende Gruppe bleibt zusammen
    const nextRings = new Set();
    for (const r of cluster.rings) {
      const rk = `${Math.round(r.x * 10)},${Math.round(r.y * 10)}`;
      nextRings.add(rk);
      let e = ringPool.get(rk);
      if (!e) { e = { x: r.x, y: r.y, s: instant ? 1 : 0 }; ringPool.set(rk, e); }
      e.want = 1;
    }
    for (const [rk, e] of ringPool) if (!nextRings.has(rk)) e.want = 0;
    orderDirty = true;
    for (const [k, id] of Object.entries(cluster.marks)) {
      hs[k].pos.copy(cluster.atoms[id].p).add(new THREE.Vector3(0, 0, k === 'carboxyl' ? 1.3 : 0.7));
    }
  }

  function reorder() {
    order = { atoms: [...pool.values()].slice(0, CAP_A), bonds: [...bondPool.values()] };
    order.atoms.forEach((a, k) => {
      atomMesh.setColorAt(k, ELEMENT[a.el].color);
      cloudMesh.setColorAt(k, ELEMENT[a.el].color.clone().lerp(BLUE, 0.6));
    });
    // je Bindung 2 Halbstücke je Ordnung, jedes in der Farbe seines Atoms
    let n = 0;
    for (const b of order.bonds) {
      b.slot = n;
      for (let o = 0; o < b.order; o++) {
        bondMesh.setColorAt(n++, ELEMENT[b.a.el].color.clone().lerp(GREY, 0.55));
        bondMesh.setColorAt(n++, ELEMENT[b.b.el].color.clone().lerp(GREY, 0.55));
      }
    }
    order.nBond = Math.min(n, CAP_B);
    for (const m of [atomMesh, cloudMesh, bondMesh]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    orderDirty = false;
  }

  // Bestand fortschreiben: Wachsen, Abflug, Bindungsbruch; entfernt, was ganz verblasst ist
  function step(dt) {
    let removed = false;
    for (const e of pool.values()) {
      if (e.leaving) {
        e.s -= dt / LEAVE;
        e.vel.multiplyScalar(1 + 0.25 * dt);
        e.off.addScaledVector(e.vel, dt);
        if (e.s <= 0) { pool.delete(e.key); removed = true; }
      } else {
        if (e.s < 1) e.s = Math.min(1, e.s + dt / GROW);
        if (e.off.lengthSq() > 1e-6) e.off.multiplyScalar(Math.exp(-dt * 4));   // zurückgekehrte Gruppe gleitet an ihren Platz
      }
    }
    for (const [bk, e] of bondPool) {
      if (!pool.has(e.a.key) || !pool.has(e.b.key)) { bondPool.delete(bk); removed = true; continue; }
      const k = e.want ? dt / GROW : -dt / 0.35;      // Bruch schnell, Bildung langsam
      e.w = Math.min(1, Math.max(0, e.w + k));
      if (!e.want && e.w <= 0) { bondPool.delete(bk); removed = true; }
    }
    for (const [rk, e] of ringPool) {
      e.s = Math.min(1, Math.max(0, e.s + (e.want ? dt / GROW : -dt / GROW)));
      if (!e.want && e.s <= 0) { ringPool.delete(rk); removed = true; }
    }
    if (removed) orderDirty = true;
  }

  const tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
  const dir = new THREE.Vector3(), side = new THREE.Vector3(), c = new THREE.Vector3(), q2 = new THREE.Quaternion();
  function place(t) {
    if (orderDirty) reorder();
    const { m, q, s, up } = tmp;
    const at = order.atoms;
    let nC = 0, nH = 0, nO = 0;
    at.forEach((a, k) => {
      const amp = a.el === 'K' ? 0.12 : 0.035;
      a.pos ??= new THREE.Vector3();
      a.pos.set(
        a.home.x + a.off.x + amp * Math.sin(t * 7.3 + a.ph[0]), a.home.y + a.off.y + amp * Math.sin(t * 8.1 + a.ph[1]), a.home.z + a.off.z + amp * Math.sin(t * 6.7 + a.ph[2]));
      a.e = a.leaving ? ease(a.s) : ease(a.s);
      s.setScalar(ELEMENT[a.el].r * a.e);
      atomMesh.setMatrixAt(k, m.compose(a.pos, q.identity(), s));
      s.setScalar(ELEMENT[a.el].vdw * 0.85 * a.e);
      cloudMesh.setMatrixAt(k, m.compose(a.pos, q, s));
      if (!a.leaving) { const w = a.s; if (a.el === 'C') nC += w; else if (a.el === 'H') nH += w; else if (a.el === 'O') nO += w; }
    });
    atomMesh.count = cloudMesh.count = at.length;
    let n = 0;
    for (const b of order.bonds) {
      const w = b.w * Math.min(b.a.e, b.b.e) ** 0.5;
      const pi = b.a.pos, pj = b.b.pos;
      dir.subVectors(pj, pi);
      const len = dir.length();
      dir.divideScalar(len || 1);
      q.setFromUnitVectors(up, dir);                    // Hälfte am Atom i: breit unten = bei i
      q2.setFromUnitVectors(up, dir.clone().negate());  // Hälfte am Atom j
      side.set(-dir.y, dir.x, 0).normalize();
      for (let o = 0; o < b.order; o++) {
        if (n + 2 > CAP_B) break;
        const off = b.order === 2 ? (o === 0 ? 0.13 : -0.13) : 0;
        const wd = (b.order === 2 ? 0.1 : 0.16) * w;
        s.set(wd, len / 2, wd);
        c.copy(pi).addScaledVector(dir, len / 4).addScaledVector(side, off);
        bondMesh.setMatrixAt(n++, m.compose(c, q, s));
        c.copy(pj).addScaledVector(dir, -len / 4).addScaledVector(side, off);
        bondMesh.setMatrixAt(n++, m.compose(c, q2, s));
      }
    }
    bondMesh.count = n;
    let r = 0;
    for (const e of ringPool.values()) {
      if (r + 2 > CAP_R * 2) break;
      const f = ease(e.s) + 0.001;
      s.set(f, f, 1);
      piMesh.setMatrixAt(r++, m.compose(c.set(e.x, e.y, 0.95), q.identity(), s));
      piMesh.setMatrixAt(r++, m.compose(c.set(e.x, e.y, -0.95), q, s));
    }
    piMesh.count = r;
    for (const mesh of [atomMesh, cloudMesh, bondMesh, piMesh]) mesh.instanceMatrix.needsUpdate = true;
    live.C = nC; live.H = nH; live.O = nO; live.hc = nC > 0 ? nH / nC : 0;
    live.rings = [...ringPool.values()].reduce((n, e) => n + e.s, 0);
  }

  retarget(quant(ctx.temp), true);
  let shownT = ctx.temp;
  place(0);
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
    liveFacts: true,
    // Summenformel und H/C zählen live mit (Atome, die einwachsen oder abziehen, zählen anteilig)
    facts: () => [
      { value: `C${sub(Math.round(live.C))}H${sub(Math.round(live.H))}O${sub(Math.round(live.O))}`, label: `Summenformel dieses Clusters, ${fmt(live.rings)} Ringe (ohne K⁺)` },
      { value: fmt(live.hc, 2), label: 'molares H/C dieses Modell-Clusters' },
    ],
    update(dt, t) {
      // Lichtführung: Hauptlicht wandert langsam um den Cluster, Gegenlicht pendelt
      key.position.set(6 * Math.cos(t * 0.08) - 8 * Math.sin(t * 0.08) * 0.4, 10, 8 * Math.cos(t * 0.06) + 6 * Math.sin(t * 0.08) * 0.4);
      rim.position.set(-8 + 3 * Math.sin(t * 0.05), -4, -6 + 3 * Math.cos(t * 0.05));
      const q = quant(shownT);
      if (q !== builtQ) {
        retarget(q, reduced);
        if (reduced) for (const [k, e] of pool) if (e.leaving) pool.delete(k);
      }
      step(reduced ? 10 : Math.min(dt, 0.1));
      place(t);
      return true;
    },
    setParam(name, value) {
      if (name === 'quality') {
        // Schatten je Stufe: aus (Leicht), 512 px (Mittel), 1024 px (Fein) – Schattenkarte neu anlegen
        key.castShadow = value.shadows;
        const size = value.detail >= 1 ? 1024 : 512;
        if (key.shadow.mapSize.x !== size) {
          key.shadow.mapSize.set(size, size);
          if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
        }
        level.dirty = true;
        return;
      }
      if (name !== 'temp') return;
      shownT = value;
      level.dirty = true;
    },
    dispose() {
      sphere.dispose(); cyl.dispose(); hex.dispose(); cloudGeo.dispose();
      atomMat.dispose(); bondMat.dispose(); piMat.dispose(); cloudMat.dispose();
    },
  };
  return level;
}
