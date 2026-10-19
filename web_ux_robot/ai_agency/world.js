// Welt um das Büro (Abschnitt 3/6, Wahl des Users 2026-10-16: Welt:C Campus-Park, detailreich statt low-poly):
// Terrasse, Rundweg mit Bordstein, Laternen, Bänke, Hecken, Teich mit Steinufer, Straße mit weißer Markierung,
// drei Baumarten mit unregelmäßigen Kronen, Waldrand, Campus-Gebäude, Hügel. Kein Gelb/Rot (Gelb = „wartet auf dich“,
// Rot = Fehler). Nacht = Standard, Tag = gleiche Welt hell. Nicht im Kanten-Pass (scene.userData.noInk), Schatten nur im Büro.
// Schalter „Umgebung“ im Ansicht-Menü blendet alles aus (show(false)) → wieder die leere Fläche von früher.
import * as THREE from 'three';

const PI = Math.PI;
const rnd = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

const PAL = {
  nacht: { sky: '#0A0F19', fog: [70, 240], grass: ['#0E2224', '#123033', '#0B1B1F'], path: ['#243247', '#2C3B52'], kerb: '#3A4A63', terr: '#18233A', road: ['#10161F', '#151C27'], mark: '#9FB4C8', walk: '#202B3E',
    crown: ['#164A40', '#1D5A4E', '#183F4D', '#22503F'], fir: ['#123A36', '#0F3030'], trunk: '#2E2A33', lamp: '#E6F7FF', lampK: 2.4, pole: '#3A4458', water: '#0E2A3C', stone: '#2F3A4A', hill: '#0F2024', bench: '#33425E', bld: '#17223A', win: '#9BDCFF', winA: 0.35, hedge: '#13352F' },
  tag: { sky: '#DDEFF0', fog: [80, 260], grass: ['#8FC78A', '#A3D39A', '#7DB97C'], path: ['#E4DFD4', '#D6D0C3'], kerb: '#C2BCB0', terr: '#F1EEE8', road: ['#8D96A0', '#98A1AA'], mark: '#FFFFFF', walk: '#D9D5CD',
    crown: ['#4E9D60', '#64B06C', '#3F8C63', '#79BE78'], fir: ['#3E7E5A', '#336F52'], trunk: '#7A6352', lamp: '#DDE4EA', lampK: 0, pole: '#7C8792', water: '#7CC3D4', stone: '#A9A49A', hill: '#93C58F', bench: '#8C9AA6', bld: '#EDF1F4', win: '#7E9FB8', winA: 0.6, hedge: '#4C8F5A' },
};

// ── Texturen (Canvas, einmal je Welt) ──
function canvasTex(px, draw, rep) {
  const c = document.createElement('canvas'); c.width = c.height = px; draw(c.getContext('2d'), px);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (rep) t.repeat.set(rep, rep); return t;
}
const grassTex = (P, r) => canvasTex(512, (x, n) => {
  x.fillStyle = P.grass[0]; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 26; i++) { const g = x.createRadialGradient(r() * n, r() * n, 0, r() * n, r() * n, 40 + r() * 90); g.addColorStop(0, P.grass[1 + (i % 2)] + 'AA'); g.addColorStop(1, P.grass[1 + (i % 2)] + '00'); x.fillStyle = g; x.fillRect(0, 0, n, n); }
  for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; x.fillRect(r() * n, r() * n, 1, 2 + r() * 3); }   // Halme
});
const paveTex = P => canvasTex(256, (x, n) => {   // Platten 0,5 m (UV in Metern, 1 Kachel = 2 m)
  const r = rnd(11); x.fillStyle = P.kerb; x.fillRect(0, 0, n, n);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) { x.fillStyle = P.path[(row + col + (r() < 0.3 ? 1 : 0)) % 2]; x.fillRect(col * 64 + (row % 2) * 32 - 32 + 2, row * 64 + 2, 60, 60); x.fillRect(col * 64 + (row % 2) * 32 + 32 + 2, row * 64 + 2, 60, 60); }
  for (let i = 0; i < 1500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; x.fillRect(r() * n, r() * n, 2, 2); }
});
const roadTex = P => canvasTex(256, (x, n) => {   // Asphalt mit Körnung
  const r = rnd(23); x.fillStyle = P.road[0]; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 7000; i++) { x.fillStyle = r() < 0.5 ? P.road[1] : 'rgba(0,0,0,.18)'; x.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
});
const facadeTex = (P, r) => canvasTex(128, (x, n) => {
  x.fillStyle = P.bld; x.fillRect(0, 0, n, n);
  for (let row = 0; row < 8; row++) { const on = r() < P.winA; for (let col = 0; col < 8; col++) { x.fillStyle = on && r() < 0.85 ? P.win : 'rgba(0,0,0,.25)'; x.fillRect(col * 16 + 3, row * 16 + 4, 10, 8); } }
});

// ── Geometrie zusammenfassen (ohne Zusatzmodul): nicht-indiziert, Position + Normale + Farbe ──
function merge(parts) {
  const geos = parts.map(([geo, col]) => { const g = geo.index ? geo.toNonIndexed() : geo; const n = g.attributes.position.count, c = new Float32Array(n * 3), cc = new THREE.Color(col); for (let i = 0; i < n; i++) cc.toArray(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; });
  const out = new THREE.BufferGeometry();
  ['position', 'normal', 'color'].forEach(a => { const arr = new Float32Array(geos.reduce((s, g) => s + g.attributes[a].array.length, 0)); let o = 0; geos.forEach(g => { arr.set(g.attributes[a].array, o); o += g.attributes[a].array.length; }); out.setAttribute(a, new THREE.BufferAttribute(arr, 3)); });
  return out;
}
// Krone aus Kugeln mit Beulen: weich schattiert, unten dunkler (Vertex-Farbe), kein Low-Poly-Facettenlook
function lumpy(r0, seed, seg = 28) {   // SphereGeometry ist indiziert → weiche Normalen (Icosahedron wäre facettiert)
  const g = new THREE.SphereGeometry(r0, seg, Math.round(seg * 0.65)), p = g.attributes.position, r = rnd(seed), k = [r() * 9, r() * 9, r() * 9], v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize(); const b = 1 + 0.09 * Math.sin(n.x * 7 + k[0]) * Math.sin(n.y * 6 + k[1]) + 0.05 * Math.sin(n.z * 13 + k[2]) + 0.03 * Math.sin(n.x * 29 + n.z * 23 + k[1]); v.multiplyScalar(b); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function treeKinds() {
  const T = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => { const g = geo.clone(); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
  const trunk = (h, r0) => new THREE.CylinderGeometry(r0 * 0.6, r0, h, 10);
  const W0 = '#FFFFFF';
  // Laubbaum: Stamm + 2 Äste, Krone aus 5 Kugeln mit Beulen
  const leaf = { trunk: merge([[T(trunk(2.6, 0.2), 0, 1.3, 0), W0], [T(new THREE.CylinderGeometry(0.05, 0.09, 1.4, 6).rotateZ(0.8), 0.45, 2.4, 0), W0], [T(new THREE.CylinderGeometry(0.05, 0.09, 1.2, 6).rotateZ(-0.9), -0.4, 2.3, 0.1), W0]]),
    crown: merge([[0, 3.6, 0, 1.45], [0.9, 3.2, 0.3, 1.0], [-0.85, 3.25, -0.2, 1.05], [0.2, 4.4, -0.4, 1.0], [-0.2, 3.0, 0.8, 0.9]].map(([x, y, z, s], i) => [T(lumpy(1, 31 + i), x, y, z, s, s * 0.92, s), W0])) };
  // Nadelbaum: drei Kegel übereinander
  const fir = { trunk: merge([[T(trunk(1.4, 0.18), 0, 0.7, 0), W0]]), crown: merge([[1.6, 2.2, 1.4], [1.25, 1.9, 2.6], [0.85, 1.6, 3.7]].map(([r0, h, y]) => [T(new THREE.ConeGeometry(r0, h, 18, 3), 0, y, 0), W0])) };
  // Säulenbaum: schlank und hoch
  const pop = { trunk: merge([[T(trunk(1.6, 0.16), 0, 0.8, 0), W0]]), crown: merge([[T(lumpy(1, 77), 0, 3.2, 0, 0.85, 2.3, 0.85), W0], [T(lumpy(1, 78), 0.15, 4.9, 0.1, 0.6, 1.2, 0.6), W0]]) };
  // Krone: Verlauf unten dunkel → oben hell (Licht in der Krone), Grundton kommt je Baum aus der Instanz-Farbe
  [leaf, fir, pop].forEach(({ crown }) => { crown.computeBoundingBox(); const bb = crown.boundingBox, p = crown.attributes.position.array, c = crown.attributes.color.array; for (let i = 0; i < c.length; i += 3) c[i] = c[i + 1] = c[i + 2] = 0.62 + 0.5 * (p[i + 1] - bb.min.y) / (bb.max.y - bb.min.y); });
  return { leaf, fir, pop };
}

export function buildWorld(scene, k, L, W, night) {
  const P = PAL[night ? 'nacht' : 'tag'], [x0, z0, x1, z1] = W.lay.bounds, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hw = (x1 - x0) / 2, hd = (z1 - z0) / 2, r = rnd(5);
  const g = new THREE.Group(); g.name = 'welt';
  const old = { bg: scene.background, fog: scene.fog, groundMat: W.ground.material };
  const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, ...o });
  // Rasen (ersetzt die leere Fläche) + Terrasse
  const grassMat = mat({ map: grassTex(P, rnd(3)) }); grassMat.map.repeat.set(70, 70);
  const flat = (geo, m, y) => { const o = new THREE.Mesh(geo, m); o.rotation.x = -PI / 2; o.position.y = y; o.receiveShadow = true; g.add(o); return o; };
  const pave = paveTex(P); pave.repeat.set(0.5, 0.5);   // ShapeGeometry: UV = Meter
  const paveMat = mat({ map: pave }), kerbMat = mat({ color: P.kerb }), roadMat = mat({ map: roadTex(P) }); roadMat.map.repeat.set(0.25, 0.25);
  const rect = (w, d) => { const s = new THREE.Shape(); s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); return new THREE.ShapeGeometry(s); };
  const box = (col, x, y, z, w, h, d, ry = 0) => k.add(g, 'box', col, x, y, z, w, h, d, ry, { noShadow: true });
  const terr = flat(rect(hw * 2 + 5, hd * 2 + 5), mat({ map: pave.clone() }), -0.006); terr.position.set(cx, -0.006, cz); terr.material.map.repeat.set(0.35, 0.35); terr.material.color.set(P.terr);
  // Rundweg mit Bordstein (abgerundetes Rechteck mit Loch), vier Wege nach außen, Zugang zur Terrasse
  const R0 = 9, ox = hw + 10, oz = hd + 10, pw = 2.6;
  const rr = (s, a, c, rad) => { s.moveTo(-a + rad, -c); s.lineTo(a - rad, -c); s.quadraticCurveTo(a, -c, a, -c + rad); s.lineTo(a, c - rad); s.quadraticCurveTo(a, c, a - rad, c); s.lineTo(-a + rad, c); s.quadraticCurveTo(-a, c, -a, c - rad); s.lineTo(-a, -c + rad); s.quadraticCurveTo(-a, -c, -a + rad, -c); };
  const ring = (a, c, rad, w) => { const s = new THREE.Shape(); rr(s, a, c, rad); const h = new THREE.Path(); rr(h, a - w, c - w, rad - w); s.holes.push(h); return new THREE.ShapeGeometry(s, 24); };
  flat(ring(ox + 0.18, oz + 0.18, R0 + 0.18, pw + 0.36), kerbMat, -0.004).position.set(cx, 0.01, cz);
  flat(ring(ox, oz, R0, pw), paveMat, 0.02).position.set(cx, 0.02, cz);
  const ROAD = oz + 32, rw = 7;
  [[cx, cz + (oz + ROAD) / 2, pw, ROAD - oz], [cx, cz - oz - 70, pw, 140], [cx + ox + 70, cz, 140, pw], [cx - ox - 70, cz, 140, pw], [cx, cz + hd + 5, pw, 10]].forEach(([x, z, w, d]) => {
    flat(rect(w + 0.36, d), kerbMat, -0.004).position.set(x, -0.004, z); flat(rect(w, d), paveMat, 0.012).position.set(x, 0.012, z);
  });
  // Straße am Südrand des Campus: Asphalt, weiße Strichlinie, Gehweg beidseitig
  flat(rect(600, rw), roadMat, -0.01).position.set(cx, -0.01, cz + ROAD);
  [-1, 1].forEach(sd => { flat(rect(600, 2.4), mat({ color: P.walk }), 0.02).position.set(cx, 0.02, cz + ROAD + sd * (rw / 2 + 1.2)); box(P.kerb, cx, 0.06, cz + ROAD + sd * rw / 2, 600, 0.12, 0.18); });
  const markMat = mat({ color: P.mark, roughness: 0.6 }), dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(3, 0.16), markMat, 100), M = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI / 2, 0, 0)), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 100; i++) dash.setMatrixAt(i, M.compose(new THREE.Vector3(cx - 300 + i * 6, 0.003, cz + ROAD), q, one)); g.add(dash);
  // Teich mit Steinufer
  const PX = cx + ox + 26, PZ = cz - 18;
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 64), mat({ color: P.water, roughness: 0.08, metalness: 0.35 })); pond.rotation.x = -PI / 2; pond.scale.set(16, 9, 1); pond.position.set(PX, 0.005, PZ); g.add(pond);
  const stones = new THREE.InstancedMesh(lumpy(1, 9, 8), mat({ color: P.stone, roughness: 0.9 }), 90);
  for (let i = 0; i < 90; i++) { const a = (i / 90) * 2 * PI, s = 0.35 + r() * 0.45; stones.setMatrixAt(i, M.compose(new THREE.Vector3(PX + Math.cos(a) * (16.3 + r() * 0.5), 0.05, PZ + Math.sin(a) * (9.3 + r() * 0.4)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * PI, 0)), new THREE.Vector3(s * 1.3, s * 0.55, s))); }
  g.add(stones);
  // Laternen am Rundweg: Mast, Arm, Leuchtkopf (kaltweiß), nachts Lichtfleck am Boden
  const per = 2 * (2 * ox + 2 * oz), n = Math.round(per / 10), poleM = mat({ color: P.pole, roughness: 0.5, metalness: 0.4 });
  const headM = new THREE.MeshStandardMaterial({ color: P.lamp, emissive: P.lampK ? P.lamp : '#000000', emissiveIntensity: P.lampK, roughness: 0.4 });
  for (let i = 0; i < n; i++) {
    let u = (i / n) * per, x, z, ry; const A = 2 * ox, C = 2 * oz;
    if (u < A) { x = -ox + u; z = -oz - 1.4; ry = 0; } else if ((u -= A) < C) { x = ox + 1.4; z = -oz + u; ry = PI / 2; } else if ((u -= C) < A) { x = ox - u; z = oz + 1.4; ry = PI; } else { u -= A; x = -ox - 1.4; z = oz - u; ry = -PI / 2; }
    if (Math.abs(x) > ox - R0 && Math.abs(z) > oz - R0) continue;
    const L1 = new THREE.Group(); L1.position.set(cx + x, 0, cz + z); L1.rotation.y = ry; g.add(L1);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 3.6, 10), poleM); pole.position.y = 1.8; L1.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8), poleM); arm.rotation.x = PI / 2; arm.position.set(0, 3.55, 0.38); L1.add(arm);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.16, 16), headM); head.position.set(0, 3.45, 0.75); L1.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.3, 0.12, 16), poleM); cap.position.set(0, 3.58, 0.75); L1.add(cap);
    if (P.lampK) k.glow(L1, 0, 0.03, 0.75, 6, '#CFEFFF', 0.12);
  }
  // Bänke mit Latten an Rundweg
  const benchM = mat({ color: P.bench, roughness: 0.7 });
  [[0, oz + 3.3, PI], [ox * 0.5, -oz - 3.3, 0], [-ox - 3.3, 4, -PI / 2], [-ox * 0.5, oz + 3.3, PI], [ox + 3.3, -6, PI / 2]].forEach(([x, z, ry]) => {
    const b = new THREE.Group(); b.position.set(cx + x, 0, cz + z); b.rotation.y = ry; g.add(b);
    for (let s = 0; s < 3; s++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(2, 0.05, 0.14), benchM); sl.position.set(0, 0.46, -0.2 + s * 0.17); b.add(sl); }
    for (let s = 0; s < 2; s++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.04), benchM); sl.position.set(0, 0.68 + s * 0.17, -0.3); sl.rotation.x = -0.15; b.add(sl); }
    [-0.85, 0.85].forEach(lx => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.5), poleM); f.position.set(lx, 0.23, -0.05); b.add(f); });
  });
  // Hecken entlang der Terrasse (unterbrochen am Zugang)
  const hedge = new THREE.InstancedMesh(lumpy(1, 51, 14), mat({ color: P.hedge, roughness: 0.9 }), 120); let hi = 0;
  const hedgeAt = (x, z) => { if (hi < 120) hedge.setMatrixAt(hi++, M.compose(new THREE.Vector3(x, 0.35, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * PI, 0)), new THREE.Vector3(0.75 + r() * 0.2, 0.5 + r() * 0.12, 0.7))); };
  for (let x = -hw - 1.8; x <= hw + 1.8; x += 1.25) { if (Math.abs(x) > 2.2) hedgeAt(cx + x, cz + hd + 3.4); hedgeAt(cx + x, cz - hd - 3.4); }
  hedge.count = hi; g.add(hedge);
  // Bäume: drei Arten als Instanzen, Gruppen am Weg, dichter Waldrand ab 70 m; Farbe je Baum leicht anders
  const K = treeKinds(), crownCol = new THREE.Color(), pts = { leaf: [], fir: [], pop: [] };
  const free = (x, z) => !(Math.abs(x) < ox + 4 && Math.abs(z) < oz + 4) && Math.abs(x) > 3.5 && Math.abs(z) > 3.5 && Math.hypot(x - ox - 26, (z + 18) * 1.7) > 21 && Math.abs(z - ROAD) > rw / 2 + 4;
  let tries = 0;
  while (pts.leaf.length + pts.fir.length + pts.pop.length < 560 && tries++ < 20000) {
    const a = r() * 2 * PI, R = r() < 0.3 ? 28 + r() * 40 : 70 + r() * 125, x = Math.cos(a) * R * 1.25, z = Math.sin(a) * R; if (!free(x, z)) continue;
    const kind = R > 90 && r() < 0.45 ? 'fir' : r() < 0.15 ? 'pop' : 'leaf'; pts[kind].push([x, z, 0.75 + r() * 0.6, r() * 2 * PI]);
  }
  for (let i = 0; i < 9; i++) pts.pop.push([-ox - 6, -oz + 4 + i * ((2 * oz - 8) / 8), 0.9, r() * PI]);   // Allee am Westweg
  const crownMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), trunkMat = mat({ color: P.trunk, roughness: 0.9 });
  Object.entries(pts).forEach(([kind, list]) => {
    const tr = new THREE.InstancedMesh(K[kind].trunk, trunkMat, list.length), cr = new THREE.InstancedMesh(K[kind].crown, crownMat, list.length), tint = kind === 'fir' ? P.fir : P.crown;
    list.forEach(([x, z, s, ry], i) => {
      M.compose(new THREE.Vector3(cx + x, 0, cz + z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s * (0.9 + r() * 0.25), s)); tr.setMatrixAt(i, M); cr.setMatrixAt(i, M);
      cr.setColorAt(i, crownCol.set(tint[i % tint.length]).offsetHSL(0, 0, (r() - 0.5) * 0.05));
    });
    g.add(tr, cr);
  });
  // Campus-Gebäude mit Fensterraster + flache Hügel am Horizont
  const fac = facadeTex(P, rnd(17));
  [[-95, -70, 30, 12, 16], [110, -40, 22, 15, 20], [-60, 110, 36, 9, 14], [95, 120, 18, 18, 18], [-140, 20, 26, 10, 22]].forEach(([x, z, w, h, d]) => {
    const t = fac.clone(); t.repeat.set(Math.round(w / 6), Math.round(h / 3.4)); t.needsUpdate = true;
    const fm = mat({ map: t, roughness: 0.7, emissiveMap: night ? t : null, emissive: night ? '#FFFFFF' : '#000000', emissiveIntensity: night ? 0.55 : 0 }), roof = mat({ color: P.kerb });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [fm, fm, roof, roof, fm, fm]); m.position.set(cx + x, h / 2, cz + z); m.rotation.y = 0.1; g.add(m);
  });
  const hillM = mat({ color: P.hill });
  for (let i = 0; i < 14; i++) { const a = (i / 14) * 2 * PI, R = 215 + r() * 25, h = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), hillM); h.scale.set(90 + r() * 50, 30 + r() * 18, 60); h.position.set(cx + Math.cos(a) * R, -6, cz + Math.sin(a) * R); h.rotation.y = a; g.add(h); }
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  scene.add(g); (scene.userData.noInk ||= []).push(g);
  // an/aus: Himmel, Dunst und Rasen gehören zur Welt; aus = leere Fläche in Hintergrundfarbe wie vorher
  function show(on) {
    g.visible = on;
    scene.background = on ? new THREE.Color(P.sky) : old.bg; scene.fog = on ? new THREE.Fog(P.sky, P.fog[0], P.fog[1]) : old.fog;
    W.ground.material = on ? grassMat : old.groundMat;
  }
  show(true);
  return { group: g, show };
}
