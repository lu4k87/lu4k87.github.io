// Ebene 3: dieselben Zellen als 3D-Bruchstück (Einheit µm): Stirnfläche als Wabe, seitlich längs aufgebrochene Röhren,
// gezahnte Bruchkante, Splitter in den Lumina, Thyllen in zwei Gefäßen, behöfte Tüpfel auf den Fasern (Shader in sem.js).
// Pyrolyse: Stärkekörner im Strahlparenchym verschwinden (220–330 °C), die Wände werden glatter und kantiger (glasig),
// Thyllen bleiben – in Holzkohle sind sie erhalten – und schrumpfen mit dem Gewebe (pyroState in science.js).

import * as THREE from 'three';
import { woodTissue } from '../wood.js';
import { buildWalls, buildInstances, flakeGeometry, disposeGroup, shrinkScene } from '../walls.js';
import { semDetector, semMaterial, semBlend, semCharge } from '../sem.js';
import { mulberry32, fbm3, smoothstep, clamp } from '../util.js';
import { tissueScale, pyroState } from '../science.js';
import { settings } from '../settings.js';

const LZ = 340;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// keine Bewegung von selbst: System-Einstellung oder Grundstufe „Aus“ im Zahnrad → Hyphe steht fertig da
const still = () => reduced || settings.S.motion === 'off';
// Pilzhyphe (Ø 2,5 µm) wächst im Zeitraffer in das geöffnete Gefäß: Spitzenwachstum ≈ 0,1–1 µm/s je nach Pilz und
// Temperatur (Richtwert; polares Wachstum nur an der Spitze: Riquelme et al. 2018), hier 0,5 µm/s und 30× beschleunigt
const HY_R = 1.25, HY_RATE = 0.5, HY_LAPSE = 30, HY_SEG = 140, HY_RAD = 10;

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

  const sem = { openZ: 0, openX: XC, depth: 26, base: 0.38, edge: 0.55, edgeW: 0.45, noise: 0.9, z: 0.9, charge: true };   // Kohle: Rückstreu-Ausbeute 0,9, Aufladung an
  const scene = new THREE.Scene();
  const wallGroup = buildWalls(walls, sem);
  scene.add(wallGroup);

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

  // Stärkekörner im Strahlparenchym (Buche: Ø ≈ 4–8 µm, Modell): liegen im Holz in den Lumina der Strahlzellen, an der
  // Bruchkante auch seitlich sichtbar; im Zeitraffer verschwinden sie mit den Hemizellulosen (pyroState.starch), die Kohle
  // behält leere Zellen
  const grains = [];
  for (const s of wood.sites) {
    if (s.type !== 2 || s.x > XC - 1 || !inside(s.x, s.y) || rand() < 0.1) continue;
    const n = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const r = 1.6 + rand() * 1.6;
      const x = Math.min(s.x + (rand() - 0.5) * 2.5, XC - 1.5 - r);
      grains.push({ p: [x, s.y + (rand() - 0.5) * 2.5, -(2.5 + k * 6.5 + rand() * 3)], s: [r, r * 0.9, r * 1.15], r: [rand() * 3, rand() * 3, rand() * 3] });
    }
  }
  // gedämpfte Falschfarbe (ocker) wie bei eingefärbten REM-Bildern (Ebene 4): sonst gehen die Körner im Grau der Wände unter
  const grainMesh = buildInstances(new THREE.SphereGeometry(1, 14, 10), grains, { ...sem, base: 0.62, edge: 0.8, noise: 0.6 });
  grainMesh.material.uniforms.uTint.value.setRGB(1.08, 0.86, 0.62);
  scene.add(grainMesh);
  const grainBase = grains.map((g) => ({ p: new THREE.Vector3(...g.p), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...g.r)), s: new THREE.Vector3(...g.s) }));
  const _m = new THREE.Matrix4(), _s = new THREE.Vector3();
  const setGrains = (f) => {
    grainMesh.visible = f > 0.01;
    if (!grainMesh.visible) return;
    grainBase.forEach((g, k) => grainMesh.setMatrixAt(k, _m.compose(g.p, g.q, _s.copy(g.s).multiplyScalar(f))));
    grainMesh.instanceMatrix.needsUpdate = true;
  };

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
  // Hyphe: von außen über die Bruchkante in das längs geöffnete Gefäß v hinab; die Röhre wächst über drawRange
  // (TubeGeometry: 6 · HY_RAD Indizes je Segment, Segmente folgen der Bogenlänge wie getPointAt), die Spitze ist eine Kugel
  const hyPath = [[XC + 14, v.y + 6, 10], [v.x + 3, v.y + 2, -22], [v.x - 3, v.y - 3, -75], [v.x + 2, v.y + 3, -135], [v.x - 2, v.y - 1, -195], [v.x + 1, v.y + 2, -232]];
  const hyCurve = new THREE.CatmullRomCurve3(hyPath.map((p) => new THREE.Vector3(...p)));
  const hotspots = [
    { id: 'pitwall', kind: 'dive', pos: pitPos, normal: new THREE.Vector3(1, 0, 0) },
    { id: 'vessel', kind: 'info', pos: new THREE.Vector3(vessel.x, vessel.y, 0), normal: new THREE.Vector3(0, 0, 1) },
    // Abzeichen am Anfang des Fadens über der Bruchkante: dort sichtbar, ab ≈ 2 s gewachsen (früher „Lebensraum“ am Ende tief im Gefäß)
    { id: 'hypha', kind: 'info', pos: hyCurve.getPoint(0.1), normal: new THREE.Vector3(1, 0, 0) },
  ];
  if (fiber) hotspots.push({ id: 'fiber', kind: 'info', pos: new THREE.Vector3(fiber.x, fiber.y, 0), normal: new THREE.Vector3(0, 0, 1) });
  if (ray && Math.hypot(ray.x - cx, ray.y - cy) < 150) hotspots.push({ id: 'ray', kind: 'info', pos: new THREE.Vector3(ray.x, ray.y, 0), normal: new THREE.Vector3(0, 0, 1) });

  const hyLen = hyCurve.getLength();
  const hyMat = semMaterial({ ...sem, base: 0.42, edge: 0.3, noise: 2.5, z: 0.8 });
  hyMat.uniforms.uTint.value.setRGB(1.0, 0.91, 0.76);   // Pilz ocker wie in Ebene 4
  const hyMesh = new THREE.Mesh(new THREE.TubeGeometry(hyCurve, HY_SEG, HY_R, HY_RAD), hyMat);
  const hyTip = new THREE.Mesh(new THREE.SphereGeometry(HY_R, 14, 10), hyMat);
  const hyGroup = new THREE.Group();   // Schalter „Pilzhyphe“ im Zahnrad blendet die Gruppe, das Wachstum steuert hyMesh
  hyGroup.add(hyMesh, hyTip);
  scene.add(hyGroup);
  let hyStart = 0.4, hyF = -1;   // Wachstum beginnt kurz nach der Ankunft; Klick auf „Pilzhyphe“ startet es neu
  const growHypha = (age) => {
    const f = still() ? 1 : clamp(((age - hyStart) * HY_RATE * HY_LAPSE) / hyLen, 0, 1);
    if (f === hyF) return;
    hyF = f;
    hyMesh.geometry.setDrawRange(0, Math.floor(f * HY_SEG) * HY_RAD * 6);
    hyMesh.visible = f > 0;
    hyCurve.getPointAt(f, hyTip.position);
  };

  const camera = new THREE.PerspectiveCamera(35, ctx.aspect, 1, 4000);
  const base = hotspots.map((h) => h.pos.clone());
  // Pyrolyse: Schwindung (quer stärker als längs), dünnere Zellwände, Stärke verschwindet, Bruch faserig → glasig
  // (weniger Körnung, hellere Kanten wie bei verkohlten Wänden im REM); gleitet mit dem Regler
  let shownT = ctx.temp, lastT = NaN, age = 0, lastClock = -1;
  function applyTemp() {
    if (shownT === lastT) return;
    lastT = shownT;
    const k = tissueScale(shownT), st = pyroState(shownT);
    wallGroup.userData.setThin(k.wall / k.xy);
    setGrains(st.starch);
    semCharge(shownT);   // Aufladung: unter ≈ 700 °C leitet die Kohle schlecht (Streifen), darüber sauber
    for (const mat of wallGroup.userData.materials) {
      mat.uniforms.uNoise.value = sem.noise * (1 - 0.8 * st.glassy);
      mat.uniforms.uEdge.value = sem.edge + 0.45 * st.glassy;
    }
    shrinkScene(scene, k.xy, k.z, level.home.target);
    hotspots.forEach((h, i) => h.pos.copy(base[i]).multiply(scene.scale).add(scene.position));
  }
  const level = {
    scene, camera,
    unit: 1e-6,
    method: 'REM · Sekundärelektronen (Modell)',
    detector: true,   // Umschalter SE/BSE an der Messleiste
    tone: 0,
    grain: 0.047,
    dof: 3.6,
    bloom: 0.05,
    home: { pos: new THREE.Vector3(v.x + 235, v.y + 100, 215), target: new THREE.Vector3(v.x - 30, v.y + 5, -95) },
    orbit: { minDistance: 60, maxDistance: 800, minPolarAngle: 0.2, maxPolarAngle: 2.9, enablePan: true },
    hotspots,
    update(dt, t) {
      // Uhr ab Ankunft: nach einer Pause beginnt der Zeitraffer neu, das Wachstum der Hyphe auch (Klick-Zeit aus der alten Uhr)
      if (t - lastClock > 0.5) { age = 0; hyStart = 0.4; hyF = -1; } else age += t - lastClock;
      lastClock = t;
      semDetector(t);
      semBlend(dt, reduced);
      applyTemp();
      growHypha(age);
      return true;
    },
    setParam(name, value) {
      if (name === 'temp') { shownT = value; level.dirty = true; }
      if (name === 'detector') level.method = `REM · ${value === 'bse' ? 'Rückstreuelektronen' : 'Sekundärelektronen'} (Modell)`;
    },
    onHotspot(id) {
      if (id === 'hypha') { hyStart = age; hyF = -1; }
    },
    // Zahnrad-Reiter „Ebene“ (layers.js)
    layers: [
      { id: 'hypha', group: 'Leben im Gefäß', label: 'Pilzhyphe wächst ein', type: 'toggle', value: true,
        set: (v) => { hyGroup.visible = v; const h = hotspots.find((x) => x.id === 'hypha'); if (h) h.hidden = h.off = !v; level.dirty = true; },
        hint: 'Spitzenwachstum ≈ 0,5 µm/s (Richtwert), hier 30× beschleunigt – Pilze nutzen die offenen Gefäße als Wege durch die Kohle.' },
      { id: 'hyAgain', sub: true, label: 'Wachstum neu starten', type: 'action', button: 'Starten', run: () => { hyStart = age; hyF = -1; } },
    ],
    dispose() { disposeGroup(scene); },
  };
  applyTemp();
  return level;
}
