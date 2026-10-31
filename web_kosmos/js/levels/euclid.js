// Station 01F: Weltraumteleskop Euclid (ESA) am Lagrange-Punkt L2 (Einheit 1 m), Abstecher von Erde & Mond. Szene am
// Sonne-Erde-System (l2view.js): Sonne bei +x, der Sonnenschild mit den Solarzellen zeigt zu ihr, das Teleskop blickt
// quer dazu nach +y. Modell nach ESA-Maßen (4,7 m hoch, 3,7 m Durchmesser) und Fotos: Versorgungsmodul als Sechskant mit
// Isolierdecken, Antenne (folgt der Erde), Sternsensoren und Kaltgas-Düsen; Nutzlastmodul mit dem Teleskop in einer
// schräg geschnittenen Blende (innen schwarz, Hauptspiegel 1,2 m und Sekundärspiegel auf drei Streben sichtbar),
// Radiatoren der Instrumente auf der Schattenseite; Sonnenschild aus drei Feldern mit Solarzellen. Schwenks von Feld zu
// Feld als langsames Drehen um die Sonnenlinie (Modell, kein Beobachtungsplan). Details nach Fotos: drei Zweibeine
// zwischen Versorgungs- und Nutzlastmodul (thermische Entkopplung), Prallblenden im Rohr, Hohlspiegel mit Loch,
// Rahmen und Scharniere auf der Rückseite des Sonnenschilds, Sonnensensoren, Trennring, Stabantennen, Kabelbäume.

import * as THREE from 'three';
import { mulberry32 } from '../astro.js';
import { createL2View, earthLook } from '../l2view.js';
import { stationMat } from '../orbitview.js';
import { stationKit, V } from '../stationkit.js';
import { registerLayers, refreshLayers } from '../layers.js';

const RAD = Math.PI / 180;
const H = { svm: 1.0, top: 4.45 };                // Oberkante Versorgungsmodul, Blende vorn (Sonnenseite) [m]
const R = { svm: 1.6, plm: 1.25 };                // Radien (3,7 m Durchmesser mit Schild)
const EYE = new THREE.Vector3(5, -2.5, 3);        // Blick „Zur Erde“: neben dem Versorgungsmodul

export function create(ctx) {
  const ov = createL2View(ctx, { craft: 'euclid', halo: { ay: 500, az: 300, days: 180, phase: 0.62 }, radius: 6 });
  const { scene, camera } = ov;
  const K = stationKit(ctx), mat = K.mat;
  const obs = new THREE.Group();
  scene.add(obs);
  const body = new THREE.Group();
  body.position.y = -2.35;                         // Mitte der Höhe im Ursprung
  obs.add(body);
  const I = K.inst(body);

  const dark = mat('us').clone(); dark.color.set(0x2b2d33);
  const M = {
    inside: stationMat({ color: 0x050506, roughness: 0.95, metalness: 0, side: THREE.BackSide }),
    mirror: stationMat({ color: 0xdfe3ea, metalness: 1, roughness: 0.06, envMapIntensity: 1.6 }),
    spider: stationMat({ color: 0x18191c, metalness: 0.4, roughness: 0.6 }),
  };
  const add = (geo, m, pos, rot) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(...pos);
    if (rot) o.rotation.set(...rot);
    o.castShadow = o.receiveShadow = true;
    body.add(o);
    return o;
  };

  // ---------- Versorgungsmodul: Sechskant in Gold- und Silberfolie, Platten, Düsen, Sternsensoren ----------
  add(K.tubeUV(new THREE.CylinderGeometry(R.svm, R.svm, H.svm, 6, 1), R.svm, H.svm, 1.2), mat('gold'), [0, H.svm / 2, 0], [0, Math.PI / 6, 0]);
  add(new THREE.CylinderGeometry(R.svm * 1.01, R.svm * 1.01, 0.06, 6), mat('metal'), [0, H.svm + 0.02, 0], [0, Math.PI / 6, 0]);
  add(new THREE.CylinderGeometry(R.svm * 0.98, R.svm * 0.98, 0.05, 6), mat('silver'), [0, 0.0, 0], [0, Math.PI / 6, 0]);
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3, c = Math.cos(a), s = Math.sin(a), q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -a);
    if (k !== 0) I.box(V(c * R.svm * 0.87, 0.5, s * R.svm * 0.87), [0.04, 0.7, 1.2], mat('rad'), q);   // Platten mit Radiatorfolie
    for (const dy of [0.12, 0.88]) I.rod(V(c * R.svm * 0.92, dy, s * R.svm * 0.92), V(c * R.svm * 1.05, dy + (dy < 0.5 ? -0.08 : 0.08), s * R.svm * 1.05), 0.03, mat('nozzle'), K.U.disk);
  }
  for (const [x, z] of [[-0.9, 0.7], [-0.9, -0.7]]) {                               // Sternsensoren mit Blenden
    I.rod(V(x, H.svm + 0.05, z), V(x - 0.25, H.svm + 0.45, z), 0.11, mat('dark'), K.U.disk);
    I.rod(V(x - 0.25, H.svm + 0.45, z), V(x - 0.27, H.svm + 0.48, z), 0.13, mat('metal'), K.U.ring);
  }
  // Antenne (K-Band) auf Gelenk unter dem Modul, zeigt zur Erde
  const hga = new THREE.Group();
  hga.position.set(0.6, -0.35, 0);
  body.add(hga);
  const dish = new THREE.Mesh(new THREE.LatheGeometry(Array.from({ length: 9 }, (_, i) => new THREE.Vector2(i * 0.05, (i * 0.05) ** 2 * 1.1)), 32), mat('paint'));
  dish.material.side = THREE.DoubleSide;
  dish.rotation.z = -Math.PI / 2;
  dish.castShadow = true;
  hga.add(dish);
  I.rod(V(0.6, 0, 0), V(0.6, -0.35, 0), 0.05, mat('metal')).rod(V(0.1, -0.02, 0.4), V(0.1, -0.25, 0.4), 0.06, mat('metal'));
  I.rod(V(0, -0.03, 0), V(0, 0.03, 0), R.svm * 0.96, mat('metal'), K.U.ring);                                  // Trennring zur Rakete
  K.whip(I, V(-0.5, -0.02, -0.9), V(0, -1, 0), 0.5);                                                          // X-Band-Stabantennen
  K.whip(I, V(-0.5, -0.02, 0.9), V(0, -1, 0), 0.5);
  for (const z of [-0.5, 0.5]) I.box(V(R.svm * 0.95, H.svm + 0.1, z), [0.14, 0.14, 0.14], mat('dark'));         // Sonnensensoren
  // Drei Zweibeine tragen das Nutzlastmodul thermisch entkoppelt über dem Versorgungsmodul
  for (let k = 0; k < 3; k++) {
    const a = k * 2 * Math.PI / 3 + Math.PI / 2;
    K.bipod(I, V(Math.cos(a - 0.5) * R.svm * 0.9, H.svm + 0.03, Math.sin(a - 0.5) * R.svm * 0.9), V(Math.cos(a + 0.5) * R.svm * 0.9, H.svm + 0.03, Math.sin(a + 0.5) * R.svm * 0.9), V(Math.cos(a) * (R.plm + 0.06), H.svm + 0.38, Math.sin(a) * (R.plm + 0.06)), 0.035, mat('strut'));
  }

  // ---------- Nutzlastmodul: Blende schräg geschnitten (vorn zur Sonne höher), innen schwarz ----------
  const baffle = new THREE.CylinderGeometry(R.plm, R.plm, 1, 64, 6, true);
  const p = baffle.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + 0.5, x = p.getX(i);                                        // 0 unten, 1 oben
    const top = H.top - 0.55 * (1 - x / R.plm) * 0.5 - 0.2 * (1 - x / R.plm);       // Schnitt fällt zur Schattenseite ab
    p.setY(i, THREE.MathUtils.lerp(H.svm + 0.15, top, t));
  }
  baffle.computeVertexNormals();
  K.tubeUV(baffle, R.plm, 3.3, 1.4);
  add(baffle, dark, [0, 0, 0]);
  add(baffle.clone(), M.inside, [0, 0, 0]);
  // Ring am oberen Rand, Halte- und Entlüftungsdetails
  const rim = [];
  for (let k = 0; k <= 48; k++) { const a = k / 48 * Math.PI * 2, x = Math.cos(a) * R.plm, z = Math.sin(a) * R.plm; rim.push(V(x, H.top - 0.55 * (1 - x / R.plm) * 0.5 - 0.2 * (1 - x / R.plm), z)); }
  for (let k = 0; k < 48; k++) I.rod(rim[k], rim[k + 1], 0.035, mat('metal'));
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.2; I.rod(V(Math.cos(a) * R.plm * 1.01, H.svm + 0.25, Math.sin(a) * R.plm * 1.01), V(Math.cos(a) * R.plm * 1.01, H.svm + 2.4, Math.sin(a) * R.plm * 1.01), 0.025, mat('rail')); }
  // Teleskop im Inneren: Hauptspiegel (1,2 m, Loch in der Mitte), Sekundärspiegel auf drei Streben, Lichtfalle
  add(new THREE.LatheGeometry(Array.from({ length: 8 }, (_, i) => { const r = 0.6 - i * 0.065; return new THREE.Vector2(r, r * r / (4 * 1.5)); }), 48), M.mirror, [0, H.svm + 0.47, 0]);   // Hohlspiegel mit Loch
  add(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 48), M.spider, [0, H.svm + 0.43, 0]);
  K.vanes(I, V(0, 0, 0), V(0, 1, 0), R.plm * 0.96, H.svm + 0.9, H.svm + 2.0, 3, M.spider);                 // Prallblenden
  add(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 24), M.spider, [0, H.svm + 0.46, 0]);
  add(new THREE.CylinderGeometry(R.plm * 0.98, R.plm * 0.98, 0.04, 48, 1, false), M.spider, [0, H.svm + 0.35, 0]);
  const smY = H.svm + 2.35;
  add(new THREE.CylinderGeometry(0.17, 0.2, 0.12, 32), M.mirror, [0, smY, 0]);
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 32), M.spider, [0, smY + 0.14, 0]);
  for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3 + Math.PI / 2; I.rod(V(0, smY + 0.1, 0), V(Math.cos(a) * R.plm * 0.97, smY + 0.35, Math.sin(a) * R.plm * 0.97), 0.03, M.spider); }
  // Radiatoren der Instrumente auf der Schattenseite (−x), Kasten der Instrumente unten seitlich
  for (const z of [-0.55, 0.55]) I.box(V(-R.plm - 0.12, H.svm + 1.2, z), [0.06, 1.6, 0.95], mat('rad'));
  I.box(V(-R.plm - 0.25, H.svm + 0.35, 0), [0.4, 0.5, 1.6], mat('silver'));
  I.box(V(-R.plm - 0.22, H.svm + 1.05, 0), [0.34, 0.6, 0.5], mat('gold'));                                   // Elektronik der Instrumente
  K.harness(I, [V(-R.svm * 0.8, H.svm + 0.02, 0.5), V(-R.plm - 0.15, H.svm + 0.3, 0.45), V(-R.plm - 0.3, H.svm + 0.75, 0.2)], 0.03);

  // ---------- Sonnenschild: drei Felder mit Solarzellen auf der Sonnenseite, Rahmen und Streben ----------
  const SH = { h: 3.55, w: 2.1, x: R.svm + 0.12, y0: 0.9 };
  for (const [z, a] of [[0, 0], [SH.w * 0.95, -26], [-SH.w * 0.95, 26]]) {
    const g = new THREE.Group();
    g.position.set(SH.x - Math.abs(z) * 0.22, SH.y0 + SH.h / 2, z);
    g.rotation.y = a * RAD;
    body.add(g);
    const m = new THREE.Mesh(K.boxUV(new THREE.BoxGeometry(0.05, SH.h, SH.w), 1.2, 1.4), K.panel('cells'));
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    const J = K.inst(g);
    for (const dy of [-SH.h / 2, SH.h / 2]) J.rod(V(-0.04, dy, -SH.w / 2), V(-0.04, dy, SH.w / 2), 0.03, mat('metal'));
    for (const dz of [-SH.w / 2, SH.w / 2]) J.rod(V(-0.04, -SH.h / 2, dz), V(-0.04, SH.h / 2, dz), 0.03, mat('metal'));
    // Rahmen auf der Rückseite: Mittelholm und zwei Diagonalen (Modell nach Fotos der Schattenseite)
    J.rod(V(-0.07, 0, -SH.w / 2), V(-0.07, 0, SH.w / 2), 0.025, mat('strut'));
    J.rod(V(-0.07, -SH.h / 2, -SH.w / 2), V(-0.07, SH.h / 2, SH.w / 2), 0.02, mat('strut')).rod(V(-0.07, -SH.h / 2, SH.w / 2), V(-0.07, SH.h / 2, -SH.w / 2), 0.02, mat('strut'));
    if (z) for (const y of [-SH.h / 2 + 0.4, SH.h / 2 - 0.4]) J.rod(V(-0.05, y - 0.1, -Math.sign(z) * SH.w / 2), V(-0.05, y + 0.1, -Math.sign(z) * SH.w / 2), 0.07, mat('dark'), K.U.disk);   // Scharniere
    J.done();
  }
  for (const y of [1.4, 2.6, 3.8]) for (const z of [-0.7, 0.7]) I.rod(V(R.plm, y, z * 0.8), V(SH.x - 0.04, y, z), 0.03, mat('strut'));
  I.done();

  // ---------- Ausrichtung: Schild zur Sonne, Schwenks von Feld zu Feld (Modell) ----------
  let program = true, roll = 0, goal = 0, nextAt = ov.jd + 0.05;
  const rp = mulberry32(17), X = V(1, 0, 0), qa = new THREE.Quaternion(), qw = new THREE.Quaternion();
  function steer(dt, flying) {
    obs.quaternion.setFromUnitVectors(X, ov.sun);
    // Durchmusterung: neues Feld etwa alle 70 min Bahnzeit, kleine Schritte, Schwenk ≤ 1°/s im Bild (Modell)
    if (program && ov.jd > nextAt) { goal = THREE.MathUtils.clamp(goal + (rp() - 0.5) * 0.25, -0.5, 0.5); nextAt = ov.jd + 0.05; }
    const g = program ? goal : 0, step = (flying ? 10 : dt) * RAD * Math.min(20, ov.speed ? ov.SPEEDS[ov.speed][0] : 1);
    roll += THREE.MathUtils.clamp(g - roll, -step, step);
    body.quaternion.copy(qa.setFromAxisAngle(X, roll));
    obs.updateMatrixWorld(true);
    hga.quaternion.setFromUnitVectors(X, ov.earthDir.clone().applyQuaternion(hga.parent.getWorldQuaternion(qw).invert()));
  }

  // ---------- Posen, Blick „Zur Erde“ ----------
  const home = { pos: new THREE.Vector3(-6.5, 6.5, 9.5), target: new THREE.Vector3(0, 0.2, 0) };
  const intro = { pos: new THREE.Vector3(-2.5, 4.5, 3.5), target: new THREE.Vector3(0, 1.4, 0) };
  const orbit = { minDistance: 4, maxDistance: 400, cineSpeed: 0.5 };
  const look = earthLook(ctx, ov, { home, orbit, eye: EYE, fov: 3 });

  // ---------- Abzeichen ----------
  const wp = (x, y, z) => () => body.localToWorld(new THREE.Vector3(x, y, z));
  const S = {
    telescope: wp(0, H.top + 0.1, 0), vis: wp(-R.plm - 0.15, H.svm + 1.9, 0.6), nisp: wp(-R.plm - 0.45, H.svm + 0.45, -0.6),
    shield: wp(SH.x + 0.1, SH.y0 + SH.h * 0.75, 0), svm: wp(-R.svm, H.svm * 0.5, 0.6), data: wp(0.6, -0.6, 0), survey: wp(0, H.top + 9, 0),
  };
  const out = () => look.mode === 'out';
  const hs = {};
  for (const [id, f] of [['telescope', 7], ['vis', 6], ['nisp', 6], ['shield', 9], ['svm', 7], ['data', 6], ['survey', 18]]) hs[id] = { id, kind: 'info', pos: new THREE.Vector3(), focus: () => f, visible: out };
  hs.earth = { id: 'earth', kind: 'info', pos: ov.spots.earth };
  hs.moon = { id: 'moon', kind: 'info', pos: ov.spots.moon, visible: () => look.mode === 'earth' };
  hs.sun = { id: 'sun', kind: 'info', pos: ov.spots.sun, visible: out };
  hs.halo = { id: 'halo', kind: 'info', pos: ov.spots.l2, visible: out };
  const hotspots = Object.values(hs);
  function placeHotspots() {
    obs.updateMatrixWorld(true);
    for (const k of Object.keys(S)) hs[k].pos.copy(S[k]());
  }

  // ---------- Ebenen (Zahnrad „Station · Euclid“) und Infotafel ----------
  registerLayers('euclid', [
    ov.layers.clock('Euclid'),
    { id: 'program', type: 'toggle', group: 'Teleskop', label: 'Schwenks von Feld zu Feld', hint: 'Euclid schwenkt in kleinen Schritten zum nächsten Feld der Durchmusterung – Modell, nicht der Beobachtungsplan.', value: true, set: (v) => { program = v; } },
    ov.layers.boost('das Teleskop'),
    ...ov.layers.earth(),
  ]);
  const controls = [
    { id: 'view', label: 'Blick', value: 'out', options: [['out', 'Außen'], ['earth', 'Zur Erde']], set: (v) => look.set(v) },
  ];

  return {
    scene, camera, home, intro, unit: 1, hotspots, controls, orbit,
    look: { exposure: 1.0, bloom: 0.08, sat: 1.05 },
    ready: Promise.all([ov.ready, K.ready()]),
    update(dt, t, cam, flying) {
      ov.update(dt, t, cam, flying);
      steer(dt, flying);
      placeHotspots();
    },
    orbitUpdate: (c, dt) => look.orbitUpdate(c, dt),
    widget: () => '<table><thead><tr><th>Euclid im Moment</th><th>Wert</th></tr></thead><tbody id="w-l2"><tr><td colspan="2">Bahn wird berechnet …</td></tr></tbody></table><p class="w-foot">Ort auf der Bahn um L2 aus den JPL-Horizons-Bahndaten (Juli 2023 – Okt. 2031, danach Modell); Erde und Mond an ihren echten Orten zum angezeigten Zeitpunkt.</p>',
    widgetTick(el, t) {
      ov.widgetTick(el, t, () => `<tr><td>Umlauf um L2${ov.info.real ? '' : ' (Modell)'}</td><td class="num">${Math.round(ov.info.phase * 100)} %</td></tr>`);
    },
    live: () => `${(ov.info.dist / 1e6).toFixed(2).replace('.', ',')} Mio. km von der Erde · ${ov.speed ? `Zeitraffer ${ov.SPEEDS[ov.speed][1]}` : 'Echtzeit'}`,
    setPixelRatio: (p2) => ov.setPixelRatio(p2),
    dispose() {
      ov.dispose();
      K.dispose();
      dark.dispose();
      Object.values(M).forEach((m) => m.dispose());
    },
  };
}
