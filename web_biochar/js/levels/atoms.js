// Ebene 7: ein aromatischer Cluster (Einheit Å) mit Randgruppen – Größe und Sauerstoffanteil folgen der
// Pyrolysetemperatur. Vereinfachtes Kugel-Stab-Modell: konische Bindungen in den Farben der Atome, weiche Elektronenwolke
// (van-der-Waals-Radius) und weiche Eigenschatten. Ab 7 Ringen trägt der Cluster einen Stone-Wales-Defekt (zwei Fünf-, zwei
// Siebenringe aus einer um 90° gedrehten Bindung, Stone & Wales 1986) und wölbt sich (Harris 2005: gekrümmte Schichten,
// deshalb kein Graphit); Stärke der Wölbung: Modell.

import * as THREE from 'three';
import { nanoStructure, fmt, T_MIN, T_MAX } from '../science.js';
import { mulberry32 } from '../util.js';
import { ADDITIVE } from '../sem.js';
import { settings } from '../settings.js';

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

// Holz (unter 350 °C): Lignin-Bruchstück – zwei Guaiacyl-Einheiten, β-O-4-verknüpft (häufigste Bindung im Lignin, Ralph et al.
// 2004), C₁₇H₂₀O₆: Ring A mit phenolischer OH- und Methoxygruppe, Propan-Seitenkette (Cα–OH, Cβ–O–Ring B, Cγ–OH), Ring B mit
// Methoxygruppe. Drei Stufen (Modell): 25 °C vollständig · 200 °C Seitenketten-OH als Wasser abgespalten · 300 °C Methoxy-
// gruppen und Ether-O weg (Methanol, CO), die Ringe rücken auf ihre Plätze im Cluster zu. Ringkohlenstoffe und Cα/Cβ tragen
// die Schlüssel der Cluster-Atome bei 350 °C, damit sie beim Übergang gleiten statt neu zu wachsen (Kondensation der Ringe).
function buildWood(T) {
  const target = buildCluster(T_MIN);
  const stage = T < 190 ? 0 : T < 290 ? 1 : 2;
  const mix = [0, 0.12, 0.55][stage];
  const atoms = [], bonds = [], marks = {};
  const dir = (deg) => new THREE.Vector3(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0);
  const at = (p, deg, r) => p.clone().addScaledVector(dir(deg), r);
  const add = (el, p, tgt) => {
    const a = { el, p: tgt === undefined ? p : p.clone().lerp(target.atoms[tgt].p, mix), key: tgt === undefined ? undefined : keyOfAtom(target.atoms[tgt]) };
    atoms.push(a);
    return atoms.length - 1;
  };
  const bond = (i, j, order = 1) => bonds.push({ i, j, order });
  const group = (ids, outDeg) => { for (const id of ids) atoms[id].dir = dir(outDeg); };
  const hydrogen = (id, deg) => { const h = add('H', at(atoms[id].p, deg, 1.09)); bond(id, h); atoms[h].dir = dir(deg); return h; };
  const methoxy = (id, deg) => {                       // –O–CH₃
    const o = add('O', at(atoms[id].p, deg, 1.36)), c = add('C', at(atoms[o].p, deg + 60, 1.43));
    const hs = [add('H', at(atoms[c].p, deg + 60, 1.09)), add('H', atoms[c].p.clone().add(new THREE.Vector3(0, 0, 0.95))), add('H', atoms[c].p.clone().add(new THREE.Vector3(0, 0, -0.95)))];
    bond(id, o); bond(o, c); for (const h of hs) bond(c, h);
    group([o, c, ...hs], deg);
  };
  const hydroxyl = (id, deg) => { const o = add('O', at(atoms[id].p, deg, 1.4)), h = add('H', at(atoms[o].p, deg - 50, 0.96)); bond(id, o); bond(o, h); group([o, h], deg); return o; };
  const ring = (c, tgt) => {
    const ids = [];
    for (let k = 0; k < 6; k++) ids.push(add('C', at(c, 30 + 60 * k, A), tgt[k]));
    for (let k = 0; k < 6; k++) bond(ids[k], ids[(k + 1) % 6]);
    return ids;
  };
  // Ring A (links), Seitenkette, Ring B (unten rechts) – Koordinaten in Å, Bindungslängen gerundet
  const cA = new THREE.Vector3(-3.0, 0.3, 0);
  const ra = ring(cA, [0, 1, 2, 3, 4, 5]);
  const ca = add('C', at(atoms[ra[0]].p, 30, 1.51), 12);             // Cα
  const cb = add('C', at(atoms[ca].p, -30, 1.53), 13);               // Cβ
  const cg = add('C', at(atoms[cb].p, 30, 1.53));                    // Cγ (geht bei 350 °C als CO ab)
  bond(ra[0], ca); bond(ca, cb); bond(cb, cg);
  hydrogen(ca, 150);
  const hb = add('H', atoms[cb].p.clone().add(new THREE.Vector3(0, 0, 1.05))); bond(cb, hb);
  hydrogen(cg, -45); const hg = add('H', atoms[cg].p.clone().add(new THREE.Vector3(0, 0, 1.05))); bond(cg, hg);
  const oe = add('O', at(atoms[cb].p, -90, 1.43));                   // Ether-O der β-O-4-Bindung
  const cB = at(at(atoms[oe].p, -90, 1.36), -90, A);
  const rb = ring(cB, [6, 7, 8, 9, 10, 11]);
  if (stage < 2) { bond(cb, oe); bond(oe, rb[1]); atoms[oe].dir = dir(0); } else atoms.pop();   // Stufe 2: Ether gespalten, O weg
  if (stage === 2) { for (const b of bonds) { if (b.i === oe || b.j === oe) b.i = b.j = -1; } }
  if (stage < 1) { hydroxyl(ca, 90); hydroxyl(cg, 30); }            // Cα–OH, Cγ–OH (Wasser ab 200 °C)
  marks.phenol = hydroxyl(ra[3], 210);                                // phenolische OH-Gruppe bleibt
  if (stage < 2) { methoxy(ra[4], 270); methoxy(rb[2], 150); }       // Methoxygruppen (Methanol ab 300 °C)
  else { hydrogen(ra[4], 270); hydrogen(rb[2], 150); }
  marks.edgeh = hydrogen(ra[1], 90); hydrogen(ra[2], 150); hydrogen(ra[5], 330);
  hydrogen(rb[0], 30); hydrogen(rb[3], 210); hydrogen(rb[4], 270); hydrogen(rb[5], 330);
  const count = { C: 0, H: 0, O: 0, K: 0 };
  for (const a of atoms) count[a.el]++;
  const ringAt = (ids) => ids.reduce((v, id) => v.add(atoms[id].p), new THREE.Vector3()).multiplyScalar(1 / 6);
  const rA = ringAt(ra), rB = ringAt(rb);
  return {
    ns: target.ns, rings: [{ x: rA.x, y: rA.y }, { x: rB.x, y: rB.y }], atoms, bonds: bonds.filter((b) => b.i >= 0), marks, ringAt: rA,
    formula: `C${sub(count.C)}H${sub(count.H)}O${sub(count.O)}`, hc: count.H / count.C, nRings: 2,
  };
}

export function buildCluster(T) {
  if (T < T_MIN) return buildWood(T);
  const ns = nanoStructure(T);
  const cand = [];
  for (let q = -5; q <= 5; q++) {
    for (let r = -5; r <= 5; r++) {
      const x = Math.sqrt(3) * A * (q + r / 2), y = 1.5 * A * r;
      cand.push({ x, y, q, r, d: Math.hypot(x, y) + 0.001 * Math.atan2(y, x) });
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
  const bkey = (i, j) => (i < j ? `${i}-${j}` : `${j}-${i}`);
  const bond = (i, j, order = 1) => bonds.set(bkey(i, j), { i, j, order });
  const ringIds = rings.map((ring) => {
    const ids = [];
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      ids.push(carbon(ring.x + A * Math.cos(a), ring.y + A * Math.sin(a)));
    }
    for (let k = 0; k < 6; k++) bond(ids[k], ids[(k + 1) % 6]);
    return ids;
  });
  // Stone-Wales-Defekt (Stone & Wales 1986): ab 7 Ringen (erste Schale voll, ≈ 525 °C) dreht sich die Bindung zwischen dem
  // Mittelring (0,0) und seinem Nachbarn (0,−1) um 90°. Die beiden Ringe an der Bindung verlieren je ein Atom (Fünfringe),
  // die beiden Ringe an ihren Enden gewinnen je eins (Siebenringe); alle sechs Atome bleiben dreibindig. Die gedrehten Atome
  // behalten den Schlüssel ihrer Gitterlage – im Übergang gleiten sie, die Bindungen brechen und schließen sich neu.
  let sw = null;
  if (rings.length >= 7) {
    const idx = (q, r) => rings.findIndex((g) => g.q === q && g.r === r);
    const iL = idx(0, 0), iR = idx(0, -1), iT = idx(1, -1), iB = idx(-1, 0);
    if (iL >= 0 && iR >= 0 && iT >= 0 && iB >= 0) {
      const [a, b] = ringIds[iL].filter((id) => ringIds[iR].includes(id));
      const nbOf = (i) => [...bonds.values()].filter((bd) => bd.i === i || bd.j === i).map((bd) => (bd.i === i ? bd.j : bd.i));
      const others = [...nbOf(a).filter((x) => x !== b), ...nbOf(b).filter((x) => x !== a)];
      const pa = atoms[a].p, pb = atoms[b].p, mid = pa.clone().add(pb).multiplyScalar(0.5);
      const keyA = keyOfAtom(atoms[a]), keyB = keyOfAtom(atoms[b]);
      atoms[a].p = new THREE.Vector3(mid.x - (pa.y - mid.y), mid.y + (pa.x - mid.x), 0);
      atoms[b].p = new THREE.Vector3(mid.x - (pb.y - mid.y), mid.y + (pb.x - mid.x), 0);
      atoms[a].key = keyA; atoms[b].key = keyB;
      for (const o of others) { bonds.delete(bkey(a, o)); bonds.delete(bkey(b, o)); }
      others.sort((x, y) => atoms[x].p.distanceTo(atoms[a].p) - atoms[y].p.distanceTo(atoms[a].p));
      bond(a, others[0]); bond(a, others[1]); bond(b, others[2]); bond(b, others[3]);
      // Fünfring = Rest des Rings plus das gedrehte Atom, das noch an ihm hängt; Siebenring = Rest plus beide
      const linked = (ids, id) => ids.some((x) => x !== a && x !== b && bonds.has(bkey(id, x)));
      for (const i of [iL, iR]) { const rest = ringIds[i].filter((x) => x !== a && x !== b); ringIds[i] = [...rest, linked(rest, a) ? a : b]; }
      for (const i of [iT, iB]) ringIds[i] = [...ringIds[i].filter((x) => x !== a && x !== b), a, b];
      const dir = atoms[b].p.clone().sub(atoms[a].p).normalize();
      sw = { at: mid, normal: new THREE.Vector3(-dir.y, dir.x, 0), hex: idx(1, 0) };
    }
  }
  const ringOut = rings.map((r, i) => {
    const c = ringIds[i].reduce((v, id) => v.add(atoms[id].p), new THREE.Vector3()).multiplyScalar(1 / ringIds[i].length);
    return { x: r.x, y: r.y, cx: c.x, cy: c.y, n: ringIds[i].length };
  });
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
  // Abzeichen „Aromatischer Ring“ auf einem unversehrten Sechsring: mit Defekt der Nachbar (1,0), sonst die Mitte
  const hexRing = sw ? ringOut[sw.hex] : ringOut[0];
  return {
    ns, rings: ringOut, atoms, bonds: [...bonds.values()], marks, sw, ringAt: new THREE.Vector3(hexRing.cx, hexRing.cy, 0),
    formula: `C${sub(count.C)}H${sub(count.H)}O${sub(count.O)}`,
    hc: count.H / count.C,
    nRings: rings.length,
  };
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const keyOfAtom = (a) => `${a.el}:${Math.round(a.p.x * 20)},${Math.round(a.p.y * 20)},${Math.round(a.p.z * 20)}`;
// Struktur in 25-°C-Stufen; unter 350 °C drei Holz-Stufen (Lignin-Bruchstück → Abspaltungen → Kondensation)
const quant = (T) => (T < T_MIN ? (T < 190 ? 25 : T < 290 ? 200 : 300) : Math.min(T_MAX, Math.round(T / 25) * 25));
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
  // π-Elektronen über und unter den Ringen: weiche Scheiben statt harter Sechsecke; Fünf- und Siebenringe golden (wie die
  // Markierung in Ebene 6), Scheibe skaliert mit dem Umkreis des Rings
  const piMat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `varying vec2 vP; varying vec3 vC; void main() { vP = position.xy; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `varying vec2 vP; varying vec3 vC; void main() { float r = length(vP) / ${(A * 1.15).toFixed(3)}; gl_FragColor = vec4(vC * (1.0 - smoothstep(0.2, 1.0, r)), 1.0); }`,
    ...ADDITIVE, side: THREE.DoubleSide,
  });
  const PI_HEX = new THREE.Color(0.48, 0.64, 1.0).multiplyScalar(0.022), PI_DEFECT = new THREE.Color(1.0, 0.72, 0.28).multiplyScalar(0.07);
  const RING_R = { 5: 1.208 / A, 6: 1, 7: 1.636 / A };   // Umkreis relativ zum Sechsring (A / (2·sin(π/n)))
  const hex = new THREE.CircleGeometry(A * 1.15, 24);
  const group = new THREE.Group();
  scene.add(group);

  const hs = {
    ring: { id: 'ring', kind: 'info', pos: new THREE.Vector3(0, 0, 0.9), normal: null },
    carboxyl: { id: 'carboxyl', kind: 'info', pos: new THREE.Vector3(), normal: null },
    phenol: { id: 'phenol', kind: 'info', pos: new THREE.Vector3(), normal: null },
    carbonyl: { id: 'carbonyl', kind: 'info', pos: new THREE.Vector3(), normal: null },
    edgeh: { id: 'edgeh', kind: 'info', pos: new THREE.Vector3(), normal: null },
    sw: { id: 'sw', kind: 'info', pos: new THREE.Vector3(0, 0, 1e4), normal: null },
  };
  // Wölbung (Modell nach Harris 2005): mit dem Defekt wird die Schicht schalenförmig (Krümmungsradius 2 nm wie die Schichten
  // in Ebene 6) und kippt an der gedrehten Bindung sinusförmig – die Seite des einen Fünfrings hebt sich, die andere senkt
  // sich. swMix blendet die Wölbung ein, wenn der Defekt entsteht
  const BOWL_R = 20, SW_AMP = 0.9, SW_SIG = 3.2;
  let swMix = 0, swWant = 0;
  const swC = new THREE.Vector3(), swN = new THREE.Vector3(1, 0, 0);
  const warpZ = (x, y, mix = swMix) => {
    if (mix <= 0) return 0;
    const dx = x - swC.x, dy = y - swC.y;
    return mix * (-(x * x + y * y) / (2 * BOWL_R) + SW_AMP * ((dx * swN.x + dy * swN.y) / SW_SIG) * Math.exp(-(dx * dx + dy * dy) / (2 * SW_SIG * SW_SIG)));
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
    const keys = cluster.atoms.map((a) => a.key || keyOfAtom(a));
    cluster.atoms.forEach((a, i) => {
      nextKeys.add(keys[i]);
      let e = pool.get(keys[i]);
      if (!e) {
        e = { key: keys[i], el: a.el, home: a.p.clone(), s: instant ? 1 : 0, leaving: false, off: new THREE.Vector3(), vel: new THREE.Vector3(), ph: [rand() * 6.28, rand() * 6.28, rand() * 6.28] };
        pool.set(keys[i], e);
      } else if (!e.home.equals(a.p)) {
        // gleicher Platz im Gefüge, neue Lage (Holz → Kohle): Atom gleitet von der alten Lage an die neue (off klingt ab)
        if (!instant) e.off.add(e.home).sub(a.p);
        e.home.copy(a.p);
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
      const rk = `${Math.round(r.x * 10)},${Math.round(r.y * 10)}`;   // Schlüssel = Gitterlage; Mitte und Ringgröße gleiten
      nextRings.add(rk);
      let e = ringPool.get(rk);
      if (!e) { e = { x: r.x, y: r.y, s: instant ? 1 : 0 }; ringPool.set(rk, e); }
      e.want = 1; e.cx = r.cx; e.cy = r.cy; e.n = r.n;
    }
    for (const [rk, e] of ringPool) if (!nextRings.has(rk)) e.want = 0;
    orderDirty = true;
    if (cluster.sw) { swC.copy(cluster.sw.at); swN.copy(cluster.sw.normal); swWant = 1; } else swWant = 0;
    if (instant) swMix = swWant;
    for (const k of ['carboxyl', 'phenol', 'carbonyl', 'edgeh']) {
      const id = cluster.marks[k];
      hs[k].hidden = id === undefined;
      if (id === undefined) hs[k].pos.set(0, 0, 0.9 + warpZ(0, 0, swWant));   // Gruppe gibt es in dieser Stufe nicht → Abzeichen außer Sicht, Lupe zeigt Cluster
      else { const p = cluster.atoms[id].p; hs[k].pos.set(p.x, p.y, p.z + warpZ(p.x, p.y, swWant) + (k === 'carboxyl' ? 1.3 : 0.7)); }
    }
    const ra = cluster.ringAt || new THREE.Vector3();
    hs.ring.pos.set(ra.x, ra.y, 0.9 + warpZ(ra.x, ra.y, swWant));
    hs.sw.hidden = !cluster.sw;
    if (cluster.sw) hs.sw.pos.set(swC.x, swC.y, 1.1 + warpZ(swC.x, swC.y, 1)); else hs.sw.pos.set(0, 0, 1.1);
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
    order.rings = [...ringPool.values()].slice(0, CAP_R);
    order.rings.forEach((e, k) => { const c = e.n === 6 || !e.n ? PI_HEX : PI_DEFECT; piMesh.setColorAt(2 * k, c); piMesh.setColorAt(2 * k + 1, c); });
    for (const m of [atomMesh, cloudMesh, bondMesh, piMesh]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
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
    const calm = reduced || settings.S.motion === 'off';
    let nC = 0, nH = 0, nO = 0;
    at.forEach((a, k) => {
      const amp = calm ? 0 : a.el === 'K' ? 0.12 : 0.035;
      a.pos ??= new THREE.Vector3();
      const hx = a.home.x + a.off.x, hy = a.home.y + a.off.y;
      a.pos.set(hx + amp * Math.sin(t * 7.3 + a.ph[0]), hy + amp * Math.sin(t * 8.1 + a.ph[1]), a.home.z + a.off.z + warpZ(hx, hy) + amp * Math.sin(t * 6.7 + a.ph[2]));
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
    for (const e of order.rings || []) {
      const f = (ease(e.s) + 0.001) * (RING_R[e.n] || 1), cx = e.cx ?? e.x, cy = e.cy ?? e.y, wz = warpZ(cx, cy);
      s.set(f, f, 1);
      piMesh.setMatrixAt(r++, m.compose(c.set(cx, cy, 0.95 + wz), q.identity(), s));
      piMesh.setMatrixAt(r++, m.compose(c.set(cx, cy, -0.95 + wz), q, s));
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
      { value: `C${sub(Math.round(live.C))}H${sub(Math.round(live.H))}O${sub(Math.round(live.O))}`, label: `Summenformel dieses Clusters, ${fmt(live.rings)} Ringe${cluster && cluster.sw ? ', davon 2 Fünf- und 2 Siebenringe' : ''} (ohne K⁺)` },
      { value: fmt(live.hc, 2), label: 'molares H/C dieses Modell-Clusters' },
    ],
    update(dt, t) {
      const calm = reduced || settings.S.motion === 'off', tl = calm ? 0 : t;
      // Lichtführung: Hauptlicht wandert langsam um den Cluster, Gegenlicht pendelt
      key.position.set(6 * Math.cos(tl * 0.08) - 8 * Math.sin(tl * 0.08) * 0.4, 10, 8 * Math.cos(tl * 0.06) + 6 * Math.sin(tl * 0.08) * 0.4);
      rim.position.set(-8 + 3 * Math.sin(tl * 0.05), -4, -6 + 3 * Math.cos(tl * 0.05));
      const q = quant(shownT);
      if (q !== builtQ) {
        retarget(q, calm);
        if (calm) for (const [k, e] of pool) if (e.leaving) pool.delete(k);
      }
      step(calm ? 10 : Math.min(dt, 0.1));
      swMix += (swWant - swMix) * (calm ? 1 : 1 - Math.exp(-dt * 2.5));   // Wölbung gleitet mit dem Defekt ein/aus
      place(tl);
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
