// Station 9: Kosmisches Netz (Einheit 1 Mpc), statistisches Voronoi-Modell (van de Weygaert & Icke 1989): Zellkerne =
// Mitten der Leerräume, Galaxien werden auf die Zellgrenzen geschoben – auf Wände (Ebene zwischen zwei Kernen), Fäden
// (Schnitt dreier Zellen) und Knoten (Ecke von vier Zellen, dort Galaxienhaufen). Anteile nach Cautun et al. 2014,
// grob auf Galaxien übertragen: Knoten 15 %, Fäden 45 %, Wände 25 %, Leerräume 15 %. Echte Haufen und Superhaufen an
// gemessenen Richtungen und Abständen (Abell 1989, NED; d = cz/H₀ mit H₀ = 70): Virgo, Fornax, Centaurus, Hydra,
// Norma (= Großer Attraktor), Perseus (mit der Perseus-Pisces-Kette), Coma, Hercules, Shapley. Strömung: Galaxien
// treiben zum Großen Attraktor und weiter zu Shapley – das Einzugsgebiet dieser Strömung ist Laniakea (Tully 2014);
// die Strömung hier schematisch aus Punktmassen, keine gemessene Geschwindigkeitskarte.

import * as THREE from 'three';
import { registerLayers } from '../layers.js';
import { pointCloud, disposeScene } from '../vol.js';
import { galToScene, mulberry32, gauss, blackbody, MPC } from '../astro.js';

const R = 250;
const at = (l, b, d) => new THREE.Vector3(...galToScene(l, b, d, 0));
// Haufen: id, l, b, d [Mpc], Reichtum (Zahl der Galaxien im Modell), Attraktor-Gewicht für die Strömung
export const CLUSTERS = [
  { id: 'virgo', l: 283.8, b: 74.5, d: 16.5, n: 1600, s: 1.5, m: 0.25 },
  { id: 'fornax', l: 236.7, b: -53.6, d: 19, n: 500, s: 1.0, m: 0.08 },
  { id: 'centaurus', l: 302.4, b: 21.6, d: 49, n: 700, s: 1.4, m: 0.2 },
  { id: 'hydra', l: 269.6, b: 26.5, d: 54, n: 500, s: 1.2, m: 0.12 },
  { id: 'ga', l: 325.3, b: -7.3, d: 68, n: 1400, s: 2.2, m: 1.0 },
  { id: 'perseus', l: 150.6, b: -13.3, d: 77, n: 1200, s: 1.8, m: 0.35 },
  { id: 'coma', l: 58.1, b: 88.0, d: 99, n: 1300, s: 1.6, m: 0.4 },
  { id: 'hercules', l: 31.6, b: 44.5, d: 157, n: 700, s: 2.0, m: 0.2 },
  { id: 'shapley', l: 312.0, b: 30.7, d: 206, n: 2200, s: 3.2, m: 1.6 },
].map((c) => ({ ...c, p: at(c.l, c.b, c.d) }));
const PP_END = at(125, -27, 66);   // Perseus-Pisces-Kette: von Perseus Richtung Pisces

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  const rand = mulberry32(77);
  const NN = 900, CELL = 50;
  const nuc = [];
  while (nuc.length < NN) {
    const p = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).multiplyScalar(R * 1.15);
    if (p.length() < R * 1.15) nuc.push(p);
  }
  const grid = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  nuc.forEach((p, i) => {
    const k = key(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  function nearest(p, n = 4) {
    const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), cz = Math.floor(p.z / CELL);
    let cand = [];
    for (let reach = 1; reach <= 3 && cand.length < n + 2; reach++) {
      cand = [];
      for (let x = -reach; x <= reach; x++) for (let y = -reach; y <= reach; y++) for (let z = -reach; z <= reach; z++) {
        const g = grid.get(key(cx + x, cy + y, cz + z));
        if (g) cand.push(...g);
      }
    }
    return cand.map((i) => [i, nuc[i].distanceToSquared(p)]).sort((a, b) => a[1] - b[1]).slice(0, n).map((x) => nuc[x[0]]);
  }
  // Projektion auf die mittelsenkrechte Ebene zwischen a und b
  const toPlane = (p, a, b) => {
    const u = b.clone().sub(a).normalize();
    const m = a.clone().add(b).multiplyScalar(0.5);
    return p.addScaledVector(u, -p.clone().sub(m).dot(u));
  };
  const pos = [], col = [], size = [];
  const push = (p, T, k, s) => {
    const fade = Math.min(1, Math.max(0, (R - p.length()) / (R * 0.3)));
    if (fade <= 0) return;
    pos.push(p.x, p.y, p.z);
    col.push(...blackbody(T).map((v) => v * k * fade));
    size.push(s);
  };
  const n = Math.round(170000 * ctx.detail);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).multiplyScalar(R);
    if (p.length() > R) { i--; continue; }
    const [a, b, c, d] = nearest(p);
    const r = rand();
    const kind = r < 0.15 ? 3 : r < 0.6 ? 2 : r < 0.85 ? 1 : 0;
    // mehr Durchgänge: Fäden und Knoten werden scharf, Wände bleiben flächig
    if (kind >= 1) for (let it = 0; it < (kind === 1 ? 2 : kind === 2 ? 12 : 16); it++) {
      toPlane(p, a, b);
      if (kind >= 2) toPlane(p, a, c);
      if (kind >= 3) toPlane(p, a, d);
    }
    const sc = [6, 1.1, 0.9, 0.9][kind];
    p.add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(sc * (kind === 3 ? Math.abs(gauss(rand)) : 1)));
    const T = kind === 3 ? 4300 + rand() * 900 : 5200 + rand() * 2600;
    push(p, T, [0.14, 0.9, 2.6, 4.2][kind] * (0.4 + rand() * 1.2), 0.22);
  }
  // echte Haufen + Lokale Gruppe mit Faden zum Virgo-Haufen, Perseus-Pisces-Kette
  const cluster = (c, m, s, k) => { for (let i = 0; i < m; i++) push(c.clone().add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(s * Math.abs(gauss(rand)))), 4400 + rand() * 900, k * 3 * (0.5 + rand()), 0.22); };
  for (const c of CLUSTERS) cluster(c.p, Math.round(c.n * (0.4 + 0.6 * ctx.detail)), c.s, 1.0);
  cluster(new THREE.Vector3(), 60, 0.6, 0.9);
  const virgo = CLUSTERS.find((c) => c.id === 'virgo').p, ga = CLUSTERS.find((c) => c.id === 'ga').p, perseus = CLUSTERS.find((c) => c.id === 'perseus').p;
  for (let i = 0; i < 900; i++) {
    const t = rand() * 1.6 - 0.3;
    push(virgo.clone().multiplyScalar(t).add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(1.6)), 5600 + rand() * 2000, 2 * (0.5 + rand()), 0.22);
  }
  for (let i = 0; i < 1800; i++) {
    const t = rand();
    push(perseus.clone().lerp(PP_END, t).add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(2.2)), 4800 + rand() * 2000, 2.4 * (0.5 + rand()), 0.22);
  }
  const web = pointCloud(pos, col, size, { min: 1.15 });
  scene.add(web);

  // Strömung (Laniakea): Teilchen treiben im Feld der Attraktoren (Punktmassen, geglättet) – Punkte + kurze Spuren
  const NP = Math.round(900 * ctx.detail) + 300;
  const fp = new Float32Array(NP * 3), fl = new Float32Array(NP * 6), vel = new Float32Array(NP * 3), age = new Float32Array(NP);
  const spawn = (i) => {
    const p = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(R * 0.95 * Math.cbrt(rand()));
    fp.set([p.x, p.y, p.z], i * 3);
    vel.set([0, 0, 0], i * 3);
    age[i] = rand() * 40;
  };
  for (let i = 0; i < NP; i++) spawn(i);
  const flowPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0x8fd8ff, size: 2.0, sizeAttenuation: false, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  flowPts.geometry.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const flowLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x5fb8ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
  flowLines.geometry.setAttribute('position', new THREE.BufferAttribute(fl, 3));
  const flow = new THREE.Group();
  flow.add(flowPts, flowLines);
  flow.visible = false;
  scene.add(flow);
  const tmp = new THREE.Vector3(), acc = new THREE.Vector3();
  function stepFlow(dt) {
    const h = Math.min(dt, 0.05) * 60;
    for (let i = 0; i < NP; i++) {
      const x = fp[i * 3], y = fp[i * 3 + 1], z = fp[i * 3 + 2];
      acc.set(0, 0, 0);
      for (const c of CLUSTERS) {
        tmp.set(c.p.x - x, c.p.y - y, c.p.z - z);
        const d2 = tmp.lengthSq() + 400;
        acc.addScaledVector(tmp, c.m * 900 / (d2 * Math.sqrt(d2)));
      }
      vel[i * 3] = (vel[i * 3] + acc.x * h) * 0.985; vel[i * 3 + 1] = (vel[i * 3 + 1] + acc.y * h) * 0.985; vel[i * 3 + 2] = (vel[i * 3 + 2] + acc.z * h) * 0.985;
      fp[i * 3] += vel[i * 3] * h; fp[i * 3 + 1] += vel[i * 3 + 1] * h; fp[i * 3 + 2] += vel[i * 3 + 2] * h;
      fl.set([fp[i * 3], fp[i * 3 + 1], fp[i * 3 + 2], fp[i * 3] - vel[i * 3] * 4, fp[i * 3 + 1] - vel[i * 3 + 1] * 4, fp[i * 3 + 2] - vel[i * 3 + 2] * 4], i * 6);
      age[i] += h;
      let near = false;
      for (const c of CLUSTERS) if (c.m >= 1 && Math.hypot(c.p.x - fp[i * 3], c.p.y - fp[i * 3 + 1], c.p.z - fp[i * 3 + 2]) < 9) { near = true; break; }
      if (near || age[i] > 160 || Math.hypot(fp[i * 3], fp[i * 3 + 1], fp[i * 3 + 2]) > R) spawn(i);
    }
    flowPts.geometry.attributes.position.needsUpdate = true;
    flowLines.geometry.attributes.position.needsUpdate = true;
  }

  const home = { pos: new THREE.Vector3(100, 120, 250), target: new THREE.Vector3(0, 0, 0) };
  const hd = home.pos.clone().normalize();
  const voidC = nuc.filter((p) => p.length() > 45 && p.length() < 90).sort((a, b) => b.clone().normalize().dot(hd) - a.clone().normalize().dot(hd))[0] || nuc[0];
  const hotspots = [
    { id: 'lg', kind: 'dive', to: 'local', pos: new THREE.Vector3() },
    { id: 'virgo', kind: 'info', pos: virgo },
    { id: 'ga', kind: 'info', pos: ga },
    { id: 'void', kind: 'info', pos: voidC.clone() },
    { id: 'shapley', kind: 'info', pos: CLUSTERS.find((c) => c.id === 'shapley').p },
    { id: 'coma', kind: 'info', pos: CLUSTERS.find((c) => c.id === 'coma').p },
    { id: 'perseus', kind: 'info', pos: perseus },
    { id: 'flow', kind: 'info', pos: ga.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, 18, 0)), visible: () => flow.visible },
    ...['fornax', 'centaurus', 'hydra', 'hercules'].map((id) => ({ id, kind: 'label', cls: 'hsl--faint', pos: CLUSTERS.find((c) => c.id === id).p })),
  ];
  let flowK = 1, flowG = 1;
  const flowAlpha = () => { flowPts.material.opacity = Math.min(1, 0.4 * flowG); flowLines.material.opacity = Math.min(1, 0.14 * flowG); };
  const flowOnly = 'Wirkt, sobald in der Infotafel „Strömung“ auf Laniakea steht.';
  registerLayers('web', [
    { id: 'netGain', type: 'range', group: 'Netz der Galaxien', label: 'Helligkeit', value: 1, min: 0.25, max: 5, step: 0.25, unit: '×', set: (v) => { web.material.uniforms.uGain.value = v; } },
    { id: 'flowK', type: 'range', group: 'Strömung (Laniakea)', label: 'Tempo', value: 1, min: 0.25, max: 6, step: 0.25, unit: '×', set: (v) => { flowK = v; }, active: () => flow.visible, only: flowOnly },
    { id: 'flowGain', type: 'range', label: 'Helligkeit', value: 1, min: 0.25, max: 6, step: 0.25, unit: '×', set: (v) => { flowG = v; flowAlpha(); }, active: () => flow.visible, only: flowOnly },
  ]);
  const controls = [{ id: 'flow', label: 'Strömung', value: 'off', options: [['off', 'Aus'], ['on', 'Laniakea']], set: (v) => { flow.visible = v === 'on'; } }];
  return {
    scene, camera, unit: MPC, hotspots, controls, home,
    orbit: { minDistance: 8, maxDistance: 900, cineSpeed: 0.5 },
    look: { exposure: 1.2, bloom: 0.1, sat: 1.05, con: 0.12, sh: [0.93, 0.97, 1.1] },
    update(dt) { if (flow.visible) for (let i = 0, n = Math.ceil(flowK); i < n; i++) stepFlow(dt * flowK / n); },
    live: () => (flow.visible ? 'Strömung schematisch: zum Großen Attraktor und weiter zum Shapley-Superhaufen (Laniakea = Einzugsgebiet)' : 'Modell-Netz um echte Haufen: Virgo, Fornax, Centaurus, Hydra, Norma, Perseus–Pisces, Coma, Hercules, Shapley'),
    setPixelRatio(pr, H) { web.userData.setPx(pr, H, camera.fov); },
    dispose: () => disposeScene(scene),
  };
}
