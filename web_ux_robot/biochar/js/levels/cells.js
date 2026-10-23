// Ebene 3: dieselben Zellen als 3D-Bruchstück (Einheit µm): Stirnfläche als Wabe, seitlich längs aufgebrochene Röhren,
// gezahnte Bruchkante, Splitter in den Lumina, Thyllen in zwei Gefäßen, behöfte Tüpfel auf den Fasern (Shader in sem.js).

import * as THREE from 'three';
import { woodTissue } from '../wood.js';
import { buildWalls, buildInstances, flakeGeometry, disposeGroup } from '../walls.js';
import { semDetector } from '../sem.js';
import { mulberry32, fbm3, smoothstep } from '../util.js';

const LZ = 340;

export function create(ctx) {
  const wood = woodTissue();
  const rand = mulberry32(777);
  const v = wood.dive;
  const XC = v.x + v.r * 0.3;                // Bruchebene öffnet das Einstiegsgefäß der Länge nach
  const cx = v.x - 75, cy = v.y;
  const inside = (x, y) => {
    const ang = Math.atan2(y - cy, x - cx);
    const rr = Math.hypot((x - cx) / 160, (y - cy) / 118);
    return rr < 1 - 0.14 * fbm3(Math.cos(ang) * 2 + 9, Math.sin(ang) * 2 + 9, 0.3, 3);
  };
  // Zahnkante: Faserbündel brechen verschieden lang → Sägezahn über y, zur Bruchebene hin tiefer
  const saw = (y) => { const f = y / 34 + 0.35 * fbm3(y * 0.02, 1.7, 2.2, 2); return f - Math.floor(f); };

  const walls = [];
  for (const e of wood.edges) {
    let a = e.a, b = e.b, openEnd = false;
    if (a[0] > XC && b[0] > XC) continue;
    if (a[0] > XC) [a, b] = [b, a];
    if (b[0] > XC) {
      const t = (XC - a[0]) / (b[0] - a[0]);
      b = [XC, a[1] + (b[1] - a[1]) * t];
      openEnd = true;
    }
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (!inside(mx, my) || Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.3) continue;
    let z1 = -2.5 * fbm3(mx * 0.03, my * 0.03, 2.5, 3) - rand() * 0.6;
    const near = smoothstep(XC - 50, XC - 4, mx);
    if (near > 0.02) z1 = Math.min(z1, -(6 + (20 + 150 * saw(my)) * near + 12 * rand() * near));
    else if (rand() < 0.03) z1 -= 5 + rand() * 30;
    const z0 = -LZ - rand() * 40;
    walls.push({ a, b, t: e.t, kind: e.kind, seed: e.seed, late: e.late, z0, z1, openEnd });
  }

  const sem = { openZ: 0, openX: XC, depth: 26, base: 0.38, edge: 0.55, edgeW: 0.45, noise: 0.9 };
  const scene = new THREE.Scene();
  scene.add(buildWalls(walls, sem));

  // Splitter in den längs geöffneten Röhren und in Gefäßen nahe der Bruchkante
  const flakes = [];
  for (const s of wood.sites) {
    if (!inside(s.x, s.y) || s.x > XC) continue;
    const cut = s.x > XC - 12;
    if (!cut && !(s.type === 1 && s.x > XC - 70)) continue;
    const n = cut ? (rand() < 0.5 ? 1 : 0) : 3 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const sz = 0.8 + Math.pow(rand(), 2) * (s.type === 1 ? 5 : 2.2);
      const x = cut ? XC - 1.2 - rand() * 2 : s.x + (rand() - 0.5) * (s.r || 3);
      const y = s.y + (rand() - 0.5) * (s.r || 3);
      flakes.push({ p: [x, y, -(25 + rand() * 280)], s: [sz, sz * 0.6, sz * 0.25], r: [rand() * 3, rand() * 3, rand() * 3] });
    }
  }
  scene.add(buildInstances(flakeGeometry(5), flakes, { ...sem, base: 0.44, noise: 2 }));

  // Thyllen (Buche: v. a. im Rotkern): blasige Auswüchse der Parenchymzellen, die ein Gefäß abschnittsweise füllen
  const tyloses = [];
  const fill = (vs, zTop, zBot, clipX) => {
    for (let z = zTop; z > zBot; z -= vs.r * (0.55 + 0.3 * rand())) {
      const rad = vs.r * (0.48 + 0.25 * rand());
      const off = (vs.r - rad) * 0.7;
      const a = rand() * 6.28;
      let x = vs.x + Math.cos(a) * off * rand();
      if (clipX !== undefined) x = Math.min(x, clipX - 0.25 * rad);
      tyloses.push({ p: [x, vs.y + Math.sin(a) * off * rand(), z], s: [rad, rad * (0.85 + 0.25 * rand()), rad * (1.2 + 0.5 * rand())], r: [0, 0, rand() * 3] });
    }
  };
  const vessels = wood.vessels.filter((o) => o !== v && inside(o.x, o.y) && o.r > 7);
  const cutVessel = vessels.find((o) => o.x < XC && o.x + o.r > XC - 1);
  const faceVessel = vessels.filter((o) => o.x < XC - 40).sort((p, q) => Math.hypot(p.x - cx + 40, p.y - cy + 30) - Math.hypot(q.x - cx + 40, q.y - cy + 30))[0];
  if (cutVessel) fill(cutVessel, -60, -250, XC);
  if (faceVessel) fill(faceVessel, -10, -140);
  scene.add(buildInstances(new THREE.SphereGeometry(1, 22, 16), tyloses, { ...sem, base: 0.4, noise: 1.2 }));

  // Hotspots: Gefäßwand an der Bruchkante, ein ganzes Gefäß, Faser, Strahl, offener Kanal
  const pitWall = walls
    .filter((w) => w.kind === 1 && Math.abs(w.b[1] - w.a[1]) > 1.4 * Math.abs(w.b[0] - w.a[0]) && w.z1 > -20)
    .map((w) => ({ w, d: Math.hypot((w.a[0] + w.b[0]) / 2 - v.x, (w.a[1] + w.b[1]) / 2 - v.y) }))
    .sort((p, q) => p.d - q.d)[0]?.w;
  const pitPos = pitWall
    ? new THREE.Vector3((pitWall.a[0] + pitWall.b[0]) / 2 + pitWall.t / 2 + 0.4, (pitWall.a[1] + pitWall.b[1]) / 2, -120)
    : new THREE.Vector3(v.x, v.y, -120);
  const nearest = (type, tx, ty) => {
    let best = null, bd = Infinity;
    for (const s of wood.sites) {
      if (s.type !== type || s.x > XC - 15 || !inside(s.x, s.y)) continue;
      const d = Math.hypot(s.x - tx, s.y - ty);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  };
  const vessel = nearest(1, cx - 40, cy - 40) || v;
  const fiber = nearest(0, cx - 30, cy + 70);
  const ray = nearest(2, cx - 60, cy);
  const hotspots = [
    { id: 'pitwall', kind: 'dive', pos: pitPos, normal: new THREE.Vector3(1, 0, 0) },
    { id: 'vessel', kind: 'info', pos: new THREE.Vector3(vessel.x, vessel.y, 0), normal: new THREE.Vector3(0, 0, 1) },
    { id: 'habitat', kind: 'info', pos: new THREE.Vector3(XC, v.y + 4, -250), normal: new THREE.Vector3(1, 0, 0) },
  ];
  if (fiber) hotspots.push({ id: 'fiber', kind: 'info', pos: new THREE.Vector3(fiber.x, fiber.y, 0), normal: new THREE.Vector3(0, 0, 1) });
  if (ray && Math.hypot(ray.x - cx, ray.y - cy) < 150) hotspots.push({ id: 'ray', kind: 'info', pos: new THREE.Vector3(ray.x, ray.y, 0), normal: new THREE.Vector3(0, 0, 1) });

  const camera = new THREE.PerspectiveCamera(35, ctx.aspect, 1, 4000);
  return {
    scene, camera,
    unit: 1e-6,
    method: 'REM · Sekundärelektronen (Modell)',
    tone: 0,
    grain: 0.07,
    dof: 2.0,
    bloom: 0.05,
    home: { pos: new THREE.Vector3(v.x + 235, v.y + 100, 215), target: new THREE.Vector3(v.x - 30, v.y + 5, -95) },
    orbit: { minDistance: 60, maxDistance: 800, minPolarAngle: 0.2, maxPolarAngle: 2.9, enablePan: true },
    hotspots,
    update(dt, t) {
      semDetector(t);
      return true;
    },
    dispose() { disposeGroup(scene); },
  };
}
