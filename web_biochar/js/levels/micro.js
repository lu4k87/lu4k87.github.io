// Ebene 6: turbostratischer Kohlenstoff (Einheit nm) – gewellte Graphen-Schichten in kleinen Stapeln,
// Mikroporen dazwischen, Gasmoleküle. Größe und Ordnung folgen der Pyrolysetemperatur (science.js).

import * as THREE from 'three';
import { mulberry32, gauss, clamp } from '../util.js';
import { nanoStructure, fmt } from '../science.js';
import { ADDITIVE } from '../sem.js';

const HALF = new THREE.Vector3(5.5, 3.6, 4.2);

// Rand der Schicht (lokal, Radius 0,5 = halber Durchmesser): leicht gewellt, je Schicht anders – gleich in beiden Shadern
const RIM_GLSL = /* glsl */ `
float rimR(float ang, float seed) {
  return 0.5 * (0.86 + 0.08 * sin(ang * 5.0 + seed * 20.0) + 0.06 * sin(ang * 9.0 + seed * 7.0));
}
`;

// Schicht als dünne Platte (Dicke ≈ 0,14 nm, Atomdurchmesser): Ober-/Unterseite mit Gitter, Randband als Schichtdicke
const SHEET_VERT = /* glsl */ `
attribute vec4 aSheet;     // Krümmung, Sattel/Schale (−1/1), Durchmesser nm, Seed
attribute vec2 aPart;      // Seite (+1 oben, −1 unten), 1 = Randband
varying vec2 vLocal;
varying vec4 vSheet;
varying vec3 vN;
varying vec3 vWorld;
varying float vView;
varying float vBand;
${RIM_GLSL}
void main() {
  vec3 p = position;
  float ang = atan(p.y, p.x);
  if (aPart.y > 0.5) p.xy = vec2(cos(ang), sin(ang)) * rimR(ang, aSheet.w);
  float hw = 0.07 / aSheet.z;          // halbe Dicke in lokalen Einheiten ("half" ist in GLSL reserviert)
  p.z = aSheet.x * (p.x * p.x + aSheet.y * p.y * p.y) + aPart.x * hw;
  vec3 n = aPart.y > 0.5 ? normalize(vec3(p.xy, 0.0)) : aPart.x * normalize(vec3(-2.0 * aSheet.x * p.x, -2.0 * aSheet.x * aSheet.y * p.y, 1.0));
  vLocal = p.xy;
  vSheet = aSheet;
  vBand = aPart.y;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
  vec4 mv = viewMatrix * wp;
  vView = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const SHEET_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uFogStart;
varying vec2 vLocal;
varying vec4 vSheet;
varying vec3 vN;
varying vec3 vWorld;
varying float vView;
varying float vBand;
${RIM_GLSL}
float hexDist(vec2 p) { p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
vec4 hexCoords(vec2 uv) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hC = floor(vec4(uv, uv - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(uv - hC.xy * s, uv - (hC.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + 0.5);
}
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vN);
  float facing = abs(dot(N, V));
  float fog = exp(-max(vView - uFogStart, 0.0) * 0.16);
  float lit = 0.72 + 0.32 * abs(dot(N, uLight));
  if (vBand > 0.5) {
#ifdef SHEET_FILL
    discard;
#endif
    // Randband = sichtbare Schichtdicke, hell im Streiflicht
    vec3 col = uColor * (0.26 + 0.3 * (1.0 - facing)) * lit * fog;
    gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
    return;
  }
  float r = length(vLocal);
  float ang = atan(vLocal.y, vLocal.x);
  float rim = rimR(ang, vSheet.w);
  // Randatome als Buckel: Abstand ≈ 0,25 nm entlang des Randes
  float nb = max(6.0, floor(6.2832 * rim * vSheet.z / 0.25));
  float bump = 0.5 + 0.5 * cos(ang * nb + vSheet.w * 40.0);
  float rimB = rim + (0.05 / vSheet.z) * bump;
  if (r > rimB) discard;
  vec2 uv = vLocal * vSheet.z / 0.246 + vSheet.w * 13.0;   // Gitterkonstante 0,246 nm, C–C 0,142 nm
  vec4 hc = hexCoords(uv);
  float e = 0.5 - hexDist(hc.xy);
  vec2 q = abs(hc.xy);
  float dv = min(length(q - vec2(0.5, 0.288675)), length(q - vec2(0.0, 0.57735)));
  float aa = fwidth(uv.x) * 0.9;
  float bond = 1.0 - smoothstep(0.045 - aa, 0.06 + aa, e);
  float atom = 1.0 - smoothstep(0.09 - aa, 0.12 + aa, dv);
  // Fünfring (Schale) bzw. Siebenring (Sattel) in der Mitte gekrümmter Schichten – Ursache der Krümmung (Harris-Modell)
  float warm = 0.0;
  if (vSheet.w > 0.45) {
    float nRing = vSheet.y > 0.0 ? 5.0 : 7.0;
    float seg = 6.2832 / nRing;
    vec2 u0 = vLocal * vSheet.z / 0.246;
    float rr = length(u0), a0 = atan(u0.y, u0.x);
    float RN = 0.5774 / (2.0 * sin(3.14159 / nRing));
    float zone = 1.0 - smoothstep(RN + 0.25, RN + 0.5, rr);
    float ak = floor(a0 / seg + 0.5) * seg;
    float dA = length(u0 - RN * vec2(cos(ak), sin(ak)));
    float dE = abs(rr * cos(mod(a0, seg) - seg * 0.5) - RN * cos(seg * 0.5));
    float ringBond = (1.0 - smoothstep(0.045 - aa, 0.06 + aa, dE)) * (1.0 - smoothstep(RN * 0.6, RN * 0.75, abs(rr - RN * 0.9)));
    float ringAtom = 1.0 - smoothstep(0.09 - aa, 0.12 + aa, dA);
    bond = mix(bond * (1.0 - zone), ringBond, zone);
    atom = mix(atom * (1.0 - zone), ringAtom, zone);
    warm = zone * max(ringBond, ringAtom);
  }
  float detail = smoothstep(0.55, 0.2, fwidth(uv.x));          // aus der Ferne: Fläche statt Gitter
  float m = mix(0.55, max(bond * 0.8, atom), detail);
#ifdef SHEET_FILL
  gl_FragColor = vec4(uColor * (0.022 + 0.022 * (1.0 - facing)) * fog, 1.0);
#else
  if (m < 0.35) discard;
  float edgeAtoms = smoothstep(rim - 0.04, rimB, r) * bump;
  vec3 col = uColor * (0.35 + 0.55 * atom + 0.35 * (1.0 - facing) + 0.45 * edgeAtoms) * lit * fog;
  col = mix(col, col * vec3(1.35, 1.0, 0.62), 0.6 * warm * detail);
  gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
#endif
}
`;

// Platte: Ober- und Unterseite (Polarnetz) + Randband; aPart = (Seite, Band)
function slabGeometry(segA = 56, segR = 8) {
  const pos = [], part = [], idx = [];
  const face = (side) => {
    const base = pos.length / 3;
    for (let j = 0; j <= segR; j++) {
      const r = (0.5 * j) / segR;
      for (let i = 0; i < segA; i++) {
        const a = (i / segA) * Math.PI * 2;
        pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
        part.push(side, 0);
      }
    }
    for (let j = 0; j < segR; j++) {
      for (let i = 0; i < segA; i++) {
        const a = base + j * segA + i, b = base + j * segA + ((i + 1) % segA);
        const c = a + segA, d = b + segA;
        if (side > 0) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d);
      }
    }
  };
  face(1);
  face(-1);
  const base = pos.length / 3;
  for (let i = 0; i < segA; i++) {
    const a = (i / segA) * Math.PI * 2;
    pos.push(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0);
    part.push(1, 1, -1, 1);
  }
  for (let i = 0; i < segA; i++) {
    const a = base + i * 2, b = base + ((i + 1) % segA) * 2;
    idx.push(a, a + 1, b + 1, a, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 2));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
  return g;
}

const MOLECULES = {
  co2: [['C', 0, 0, 0], ['O', 0.116, 0, 0], ['O', -0.116, 0, 0]],
  n2: [['N', 0.055, 0, 0], ['N', -0.055, 0, 0]],
  h2o: [['O', 0, 0, 0], ['H', 0.0757, 0.0586, 0], ['H', -0.0757, 0.0586, 0]],
};
const ELEMENT = {
  C: { r: 0.085, color: new THREE.Color(0.32, 0.33, 0.36) },
  O: { r: 0.08, color: new THREE.Color(0.9, 0.24, 0.22) },
  N: { r: 0.08, color: new THREE.Color(0.3, 0.5, 0.95) },
  H: { r: 0.05, color: new THREE.Color(0.95, 0.95, 0.97) },
};

// Feste Stammliste der Schichtstapel (Lage und Zufallswerte), unabhängig von der Temperatur: Größe, Schichtzahl,
// Abstand, Krümmung und Ausrichtung sind Funktionen von T und gleiten mit dem Regler (Pyrolyse-Labor).
// Die Abstände sind so gewählt, dass sich die Stapel auch in der größten Ausbildung (800 °C) nicht durchdringen.
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function masterUnits(seed) {
  const rand = mulberry32(seed);
  const big = nanoStructure(800);
  const units = [];
  for (let tries = 0; tries < 6000 && units.length < 330; tries++) {
    const c = new THREE.Vector3((rand() * 2 - 1) * HALF.x, (rand() * 2 - 1) * HALF.y, (rand() * 2 - 1) * HALF.z);
    const z = gauss(rand);
    const dMax = clamp(big.sheetNm * (1 + 0.25 * z), 0.45, 2.6);
    if (units.some((u) => u.c.distanceTo(c) < 0.38 * (u.dMax + dMax) + 0.12)) continue;
    const u = {
      c, z, dMax, n0: new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize(), spin: rand() * 6.28,
      zl: gauss(rand), slots: [],
    };
    for (let k = 0; k < 4; k++) {
      u.slots.push({
        jit: 1 + (rand() - 0.5) * 0.08, tilt: (rand() - 0.5) * 0.5, dRand: 0.85 + rand() * 0.3,
        curv: 0.5 + rand(), shape: rand() < 0.5 ? -1 : 1, seed: rand(),
      });
    }
    units.push(u);
  }
  return units;
}

const ALIGN = new THREE.Vector3(0.25, 1, 0.1).normalize();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _qs = new THREE.Quaternion(), _n = new THREE.Vector3();
// Sichtbare Schichten bei der Temperatur T (gleitende Werte); Schichten ohne Gewicht entfallen.
// Unter ≈ 300 °C gibt es noch keine aromatischen Schichten (Lignozellulose), sie wachsen zwischen 280 und 380 °C heran.
function sheetsAt(units, T) {
  const ns = nanoStructure(T);
  const born = sstep(280, 380, T);
  const sheets = [], vis = [];
  if (born <= 0) return { ns, sheets, vis };
  for (const u of units) {
    const d = clamp(ns.sheetNm * (1 + 0.25 * u.z), 0.45, 2.6) * born;
    _n.copy(u.n0);
    if (ns.k > 0.3) _n.lerp(ALIGN, (ns.k - 0.3) * 0.35).normalize();
    _q.setFromUnitVectors(Z_AXIS, _n).multiply(_qs.setFromAxisAngle(Z_AXIS, u.spin));
    const Lf = ns.layers + 0.7 * u.zl;
    const w = u.slots.map((_, k) => (k === 0 ? 1 : sstep(k + 0.2, k + 0.8, Lf)));
    const leff = w.reduce((a, b) => a + b, 0);
    let layers = 0;
    u.slots.forEach((sl, k) => {
      if (w[k] <= 0.01) return;
      layers++;
      const off = (k - (leff - 1) / 2) * ns.d002 * sl.jit;
      sheets.push({
        pos: u.c.clone().addScaledVector(_n, off),
        q: _q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, sl.tilt)),
        d: d * sl.dRand * w[k], curv: ns.curvature * sl.curv, shape: sl.shape, seed: sl.seed,
      });
    });
    vis.push({ c: u.c, d, n: _n.clone(), layers, ref: u });
  }
  return { ns, sheets, vis };
}

// Abstand eines Punktes zur nächsten Schicht (Scheibe mit Radius R); Schichten als Zahlenfelder für Tempo
function sheetTable(sheets) {
  const n = new THREE.Vector3();
  return sheets.map((s) => {
    n.set(0, 0, 1).applyQuaternion(s.q);
    return [s.pos.x, s.pos.y, s.pos.z, n.x, n.y, n.z, s.d * 0.45];
  });
}

function nearestSheet(table, px, py, pz, stopBelow) {
  let d = Infinity;
  for (const [cx, cy, cz, nx, ny, nz, R] of table) {
    const vx = px - cx, vy = py - cy, vz = pz - cz;
    const dist2 = vx * vx + vy * vy + vz * vz;
    if (dist2 > (d + R) * (d + R)) continue;
    const h = vx * nx + vy * ny + vz * nz;
    const radial = Math.sqrt(Math.max(0, dist2 - h * h));
    const dd = radial < R ? Math.abs(h) : Math.hypot(h, radial - R);
    if (dd < d) {
      d = dd;
      if (d < stopBelow) break;
    }
  }
  return d;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  scene.environment = ctx.env;
  scene.environmentIntensity = 0.8;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 8, 6);
  const rimL = new THREE.DirectionalLight(0x9fc2ff, 1.1);
  rimL.position.set(-6, -2, -7);
  scene.add(key, rimL);

  const geo = slabGeometry();
  const uniforms = { uColor: { value: new THREE.Color(0.62, 0.8, 1.0) }, uFogStart: { value: 10 }, uLight: { value: new THREE.Vector3(0.4, 0.8, 0.45).normalize() } };
  const lineMat = new THREE.ShaderMaterial({ uniforms, vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, side: THREE.DoubleSide });
  const fillMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, side: THREE.DoubleSide,
    defines: { SHEET_FILL: '' }, ...ADDITIVE,
  });
  const group = new THREE.Group();
  scene.add(group);

  // Mikropore als Sonde
  const probe = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({
    color: 0xffa040, opacity: 0.06, ...ADDITIVE,
  }));
  scene.add(probe);

  // Gasmoleküle
  const rand = mulberry32(55);
  const mols = [];
  const kinds = [...Array(20).fill('co2'), ...Array(12).fill('n2'), ...Array(10).fill('h2o')];
  for (const kind of kinds) {
    mols.push({
      kind, pos: new THREE.Vector3((rand() * 2 - 1) * HALF.x, (rand() * 2 - 1) * HALF.y, (rand() * 2 - 1) * HALF.z),
      vel: new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(0.35),
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6)),
      spin: new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(0.8),
    });
  }
  const atomCount = mols.reduce((n, m) => n + MOLECULES[m.kind].length, 0);
  // Abgespaltene Gase (CO₂, H₂O) verlassen beim Aufheizen das Gefüge: Pool, der hinter den Gasmolekülen im selben Mesh liegt
  const ESC = 28, escKinds = ['co2', 'h2o'];
  const escapes = Array.from({ length: ESC }, () => ({ kind: 'co2', life: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), spin: new THREE.Vector3() }));
  const atomMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshStandardMaterial({ roughness: 0.35 }), atomCount + ESC * 3);
  {
    let i = 0;
    for (const m of mols) for (const [el] of MOLECULES[m.kind]) atomMesh.setColorAt(i++, ELEMENT[el].color);
    for (let k = 0; k < ESC * 3; k++) atomMesh.setColorAt(i++, ELEMENT.C.color);
  }
  scene.add(atomMesh);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hs = {
    sheet: { id: 'sheet', kind: 'dive', pos: new THREE.Vector3(), normal: new THREE.Vector3() },
    stack: { id: 'stack', kind: 'info', pos: new THREE.Vector3(), normal: null },
    micropore: { id: 'micropore', kind: 'info', pos: new THREE.Vector3(), normal: null },
    gas: { id: 'gas', kind: 'info', pos: new THREE.Vector3(), normal: null },
  };
  let model = null;
  let poreD = 0;
  const camera = new THREE.PerspectiveCamera(45, ctx.aspect, 0.05, 200);
  const homePos = new THREE.Vector3(1.2, 1.6, 13);

  const units = masterUnits(1234);
  const CAP = units.length * 4;
  const sheetAttr = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
  sheetAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aSheet', sheetAttr);
  const lines = new THREE.InstancedMesh(geo, lineMat, CAP);
  const fill = new THREE.InstancedMesh(geo, fillMat, CAP);
  fill.instanceMatrix = lines.instanceMatrix;
  lines.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  lines.frustumCulled = fill.frustumCulled = false;
  group.add(lines, fill);
  const _m = new THREE.Matrix4(), _sc = new THREE.Vector3();
  let shownT = ctx.temp, builtT = NaN, searchedT = NaN, prevT = ctx.temp, emitCredit = 0;

  // Schichten für die gezeigte Temperatur setzen; Hotspots und Mikropore nur alle ≈ 12 °C neu suchen (teuer)
  function rebuild(T) {
    builtT = T;
    model = sheetsAt(units, T);
    const { sheets } = model;
    sheets.forEach((sh, k) => {
      lines.setMatrixAt(k, _m.compose(sh.pos, sh.q, _sc.setScalar(sh.d)));
      sheetAttr.array.set([sh.curv, sh.shape, sh.d, sh.seed], k * 4);
    });
    lines.count = fill.count = sheets.length;
    lines.instanceMatrix.needsUpdate = true;
    sheetAttr.needsUpdate = true;
    if (!sheets.length) { probe.visible = false; return; }
    if (Math.abs(T - searchedT) < 12) return;
    searchedT = T;
    probe.visible = true;

    // Hotspots: großer Cluster nahe der Mitte (Tauchziel), dicker Stapel, größte leere Kugel, ein CO2-Molekül
    const near = (u) => u.c.length() + Math.abs(u.c.z - 1.5) * 0.3;
    const bigU = model.vis.filter((u) => u.d >= model.ns.sheetNm).sort((a, b) => near(a) - near(b))[0] || model.vis[0];
    const nrm = bigU.n.clone();
    if (nrm.dot(homePos.clone().sub(bigU.c)) < 0) nrm.negate();
    hs.sheet.pos.copy(bigU.c).addScaledVector(nrm, 0.25);
    hs.sheet.normal.copy(nrm);
    const stack = model.vis.filter((u) => u.layers >= 2 && u !== bigU).sort((a, b) => a.c.distanceTo(new THREE.Vector3(-2.5, 1, 1)) - b.c.distanceTo(new THREE.Vector3(-2.5, 1, 1)))[0] || bigU;
    hs.stack.pos.copy(stack.c);
    const r = mulberry32(99);
    const table = sheetTable(sheets);
    let best = null, bestD = 0;
    for (let k = 0; k < 2500; k++) {
      const px = (r() * 2 - 1) * 3, py = (r() * 2 - 1) * 2, pz = (r() * 2 - 1) * 2.5;
      const d = nearestSheet(table, px, py, pz, bestD);
      if (d > bestD && d < 1.0) { bestD = d; best = new THREE.Vector3(px, py, pz); }
    }
    poreD = 2 * bestD;
    hs.micropore.pos.copy(best || new THREE.Vector3());
    probe.position.copy(hs.micropore.pos);
    probe.scale.setScalar(Math.max(bestD - 0.05, 0.05));
  }

  function placeMolecules(dt) {
    let i = 0;
    const m = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
    for (const mol of mols) {
      if (dt > 0) {
        mol.vel.x += gauss(rand) * 0.6 * dt; mol.vel.y += gauss(rand) * 0.6 * dt; mol.vel.z += gauss(rand) * 0.6 * dt;
        mol.vel.clampLength(0.1, 0.6);
        mol.pos.addScaledVector(mol.vel, dt);
        for (const ax of ['x', 'y', 'z']) {
          if (Math.abs(mol.pos[ax]) > HALF[ax]) { mol.pos[ax] = Math.sign(mol.pos[ax]) * HALF[ax]; mol.vel[ax] *= -1; }
        }
        q.setFromEuler(new THREE.Euler(mol.spin.x * dt, mol.spin.y * dt, mol.spin.z * dt));
        mol.q.multiply(q);
      }
      for (const [el, x, y, z] of MOLECULES[mol.kind]) {
        p.set(x, y, z).applyQuaternion(mol.q).add(mol.pos);
        s.setScalar(ELEMENT[el].r);
        atomMesh.setMatrixAt(i++, m.compose(p, q.identity(), s));
      }
    }
    atomMesh.instanceMatrix.needsUpdate = true;
    hs.gas.pos.copy(mols[0].pos);
  }

  // Abgespaltene Moleküle: starten am Rand einer Schicht, fliegen nach außen, blenden am Ende aus (Farben je Element)
  const ESC_LIFE = 4.5;
  function spawnEscape() {
    const e = escapes.find((x) => x.life <= 0);
    if (!e || !model.sheets.length) return;
    const sh = model.sheets[Math.floor(rand() * model.sheets.length)];
    e.kind = escKinds[rand() < 0.55 ? 0 : 1];
    e.life = ESC_LIFE;
    e.pos.copy(sh.pos).add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(sh.d * 0.2));
    e.vel.copy(e.pos).normalize().add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(0.35)).multiplyScalar(0.7 + rand() * 0.7);
    e.q.setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6));
    e.spin.set(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(1.5);
  }
  const _col = new THREE.Color();
  function placeEscapes(dt) {
    const m = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
    let i = atomCount;
    for (const e of escapes) {
      const mol = MOLECULES[e.kind];
      if (e.life > 0 && dt > 0) {
        e.life -= dt;
        e.pos.addScaledVector(e.vel, dt);
        e.q.multiply(q.setFromEuler(new THREE.Euler(e.spin.x * dt, e.spin.y * dt, e.spin.z * dt)));
      }
      const fade = e.life > 0 ? Math.min(1, (ESC_LIFE - e.life) / 0.4, e.life / 1.2) : 0;
      for (let k = 0; k < 3; k++) {
        if (k < mol.length && fade > 0) {
          const [el, x, y, z] = mol[k];
          p.set(x, y, z).applyQuaternion(e.q).add(e.pos);
          s.setScalar(ELEMENT[el].r * fade);
          atomMesh.setColorAt(i, _col.copy(ELEMENT[el].color));
        } else { p.set(0, 0, 0); s.setScalar(0); }
        atomMesh.setMatrixAt(i++, m.compose(p, q.identity(), s));
      }
    }
    atomMesh.instanceMatrix.needsUpdate = true;
    atomMesh.instanceColor.needsUpdate = true;
  }

  rebuild(ctx.temp);
  placeMolecules(0);
  placeEscapes(0);
  const level = {
    scene, camera,
    unit: 1e-9,
    method: 'Modell nach XRD und HRTEM',
    tone: 1,
    grain: 0.025,
    dof: 3.5,
    bloom: 0.12,
    home: { pos: homePos, target: new THREE.Vector3(0, 0, 0) },
    orbit: { minDistance: 3, maxDistance: 26, enablePan: false, autoRotate: false },
    hotspots: [hs.sheet, hs.stack, hs.micropore, hs.gas],
    liveFacts: true,
    facts: () => [
      { value: `≈ ${fmt(model.ns.sheetNm * sstep(280, 380, shownT), 1)} nm · ${fmt(model.ns.layers, 1)}`, label: 'mittlere Schichtgröße · Schichten je Stapel (Modell)' },
      { value: `${fmt(poreD, 1)} nm`, label: 'Durchmesser der markierten Mikropore' },
    ],
    update(dt, t) {
      uniforms.uFogStart.value = camera.position.length() - 1;
      // Licht wandert langsam: Hauptlicht schwenkt, kühles Gegenlicht kreist
      uniforms.uLight.value.set(0.4 + 0.35 * Math.sin(t * 0.09), 0.8, 0.45 + 0.35 * Math.cos(t * 0.07)).normalize();
      key.position.set(4 + 3 * Math.sin(t * 0.09), 8, 6 + 3 * Math.cos(t * 0.07));
      rimL.position.set(-6 * Math.cos(t * 0.05), -2, -7 * Math.sin(t * 0.05 + 1));
      // Aufheizen setzt Gase frei (≈ 1 Molekül je 12 °C zwischen 150 und 800 °C)
      const dT = shownT - prevT;
      prevT = shownT;
      if (shownT !== builtT) rebuild(shownT);
      if (dT > 0 && dT < 200 && shownT > 150 && !reducedMotion) {
        emitCredit = Math.min(emitCredit + dT / 12, 6);
        while (emitCredit >= 1) { emitCredit--; spawnEscape(); }
      }
      placeMolecules(dt);
      placeEscapes(dt);
      return true;
    },
    setParam(name, value) {
      if (name !== 'temp') return;
      shownT = value;
      level.dirty = true;
    },
    dispose() {
      geo.dispose(); lineMat.dispose(); fillMat.dispose();
      atomMesh.geometry.dispose(); atomMesh.material.dispose();
      probe.geometry.dispose(); probe.material.dispose();
    },
  };
  return level;
}
