// Station 01G: Nancy-Grace-Roman-Weltraumteleskop (NASA) auf dem Weg nach L2 (Einheit 1 m), Abstecher von Erde & Mond.
// Szene am Sonne-Erde-System (l2view.js): Sonne bei +x, der Solarflügel-Sonnenschild zeigt zu ihr, das Teleskop blickt
// quer dazu nach +y. Gestartet am 30.08.2026; Ort ab dem Abtrennen aus den JPL-Bahndaten (l2view.js,
// `craft: 'roman'`), vor dem Start Modell (`trip`); der Tageszähler der Anreise rechnet bis zur erwarteten Ankunft nach
// ≈ 100 Tagen.
// Modell nach Fotos (Einzelmaße geschätzt): Bus als Sechskant (4 m breit, 2 m hoch, IPAC) mit Antenne (folgt der Erde),
// Sternsensoren, Düsen; Instrumententräger mit Weitwinkel-Instrument (WFI), Koronograph (CGI) und unteren Sonnenblenden;
// Teleskop in der Außenröhre (2,4-m-Spiegel, Sekundärspiegel auf Streben), Deckel vorn als Hutkrempe auf drei Auslegern;
// Solarflügel-Sonnenschild aus sechs Feldern (2 fest an der Röhre, 4 ausgeklappt).

import * as THREE from 'three';
import { mulberry32 } from '../astro.js';
import { createL2View, earthLook } from '../l2view.js';
import { stationMat } from '../orbitview.js';
import { stationKit, V } from '../stationkit.js';
import { registerLayers, refreshLayers } from '../layers.js';

const RAD = Math.PI / 180;
const LAUNCH = 2461282.9764;                       // 30.08.2026, 11:26 UTC (NASA)
const BUS = { r: 2.25, h: 2.0 };                   // Sechskant, 4 m über die Flächen (IPAC)
const TUBE = { r: 1.6, y0: 3.4, y1: 8.9 };         // Außenröhre des Teleskops (geschätzt)
const EYE = new THREE.Vector3(6, -4, 3);           // Blick „Zur Erde“

export function create(ctx) {
  const ov = createL2View(ctx, { craft: 'roman', halo: { ay: 600, az: 400, days: 180, phase: 0.35 }, trip: { launch: LAUNCH, cruise: LAUNCH + 30, arrive: LAUNCH + 100 }, radius: 9 });
  const { scene, camera } = ov;
  const K = stationKit(ctx), mat = K.mat;
  const obs = new THREE.Group();
  scene.add(obs);
  const body = new THREE.Group();
  body.position.y = -5.3;
  obs.add(body);
  const I = K.inst(body);

  const dark = mat('us').clone(); dark.color.set(0x34363c);
  const M = {
    inside: stationMat({ color: 0x050506, roughness: 0.95, metalness: 0, side: THREE.BackSide }),
    mirror: stationMat({ color: 0xe6e8ec, metalness: 1, roughness: 0.05, envMapIntensity: 1.6 }),
    black: stationMat({ color: 0x141518, metalness: 0.3, roughness: 0.7 }),
  };
  const add = (parent, geo, m, pos, rot) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(...pos);
    if (rot) o.rotation.set(...rot);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };

  // ---------- Bus: Sechskant mit Isolierdecken, Fächern, Düsen, Sternsensoren ----------
  add(body, K.tubeUV(new THREE.CylinderGeometry(BUS.r, BUS.r, BUS.h, 6, 1), BUS.r, BUS.h, 1.6), mat('us'), [0, BUS.h / 2, 0], [0, Math.PI / 6, 0]);
  add(body, new THREE.CylinderGeometry(BUS.r * 1.01, BUS.r * 1.01, 0.08, 6), mat('metal'), [0, BUS.h, 0], [0, Math.PI / 6, 0]);
  add(body, new THREE.CylinderGeometry(BUS.r * 0.97, BUS.r * 0.97, 0.06, 6), mat('silver'), [0, 0, 0], [0, Math.PI / 6, 0]);
  const rb = mulberry32(23), GREYS = [0xf0efe9, 0xd5d7da, 0xa4a8ae, 0x5d6168].map((x) => new THREE.Color(x));
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3, c = Math.cos(a), s = Math.sin(a), q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -a);
    I.box(V(c * BUS.r * 0.87, 1.0, s * BUS.r * 0.87), [0.05, 1.5, 1.9], k % 2 ? mat('rad') : mat('gold'), q);
    for (let j = 0; j < 2; j++) I.box(V(c * BUS.r * 0.9, 0.5 + j * 0.9, s * BUS.r * 0.9 + (rb() - 0.5)), [0.12, 0.3, 0.4], mat('box'), q, GREYS[(rb() * 4) | 0]);
    for (const dy of [0.1, 1.9]) I.rod(V(c * BUS.r * 0.9, dy, s * BUS.r * 0.9), V(c * BUS.r * 1.02, dy + (dy < 1 ? -0.1 : 0.1), s * BUS.r * 1.02), 0.04, mat('nozzle'), K.U.disk);
  }
  for (const z of [-0.8, 0.8]) {
    I.rod(V(-1.4, BUS.h, z), V(-1.75, BUS.h + 0.5, z), 0.14, mat('dark'), K.U.disk);
    I.rod(V(-1.75, BUS.h + 0.5, z), V(-1.78, BUS.h + 0.54, z), 0.16, mat('metal'), K.U.ring);
  }
  // Antenne: große Schüssel auf Ausleger unter dem Bus, zeigt zur Erde
  const hga = new THREE.Group();
  hga.position.set(1.3, -1.1, 0.9);
  body.add(hga);
  const dish = new THREE.Mesh(new THREE.LatheGeometry(Array.from({ length: 11 }, (_, i) => new THREE.Vector2(i * 0.09, (i * 0.09) ** 2 * 0.35)), 40), mat('paint'));
  dish.material.side = THREE.DoubleSide;
  dish.rotation.z = -Math.PI / 2;
  dish.castShadow = true;
  hga.add(dish);
  const Jh = K.inst(hga);                           // Speisehorn auf drei Streben vor der Schüssel
  for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3; Jh.rod(V(0.25, Math.cos(a) * 0.8, Math.sin(a) * 0.8), V(0.75, 0, 0), 0.015, mat('metal')); }
  Jh.rod(V(0.7, 0, 0), V(0.82, 0, 0), 0.08, mat('dark'), K.U.disk);
  Jh.done();
  I.rod(V(0.6, 0, 0.5), V(1.3, -1.1, 0.9), 0.07, mat('metal'));

  // ---------- Instrumententräger: WFI (groß), CGI, untere Sonnenblenden zur Sonne ----------
  I.box(V(0, 2.7, 0), [3.4, 1.3, 3.2], mat('metal'));
  add(body, K.boxUV(new THREE.BoxGeometry(2.0, 1.1, 1.7), 1.5), mat('gold'), [-0.5, 2.75, 0.55]);       // WFI
  add(body, K.boxUV(new THREE.BoxGeometry(1.0, 0.8, 1.1), 1.2), mat('us'), [-0.6, 2.7, -1.05]);        // CGI
  for (const z of [-0.95, 0.95]) {
    I.box(V(BUS.r + 0.15, 3.0, z), [0.08, 2.1, 1.9], mat('us'));
    I.rod(V(BUS.r - 0.4, 2.2, z), V(BUS.r + 0.1, 2.2, z), 0.04, mat('strut'));
  }
  I.box(V(-1.75, 2.8, 0), [0.08, 1.1, 2.6], mat('rad'));

  // ---------- Teleskop: Außenröhre, innen schwarz, 2,4-m-Spiegel, Sekundärspiegel auf Streben ----------
  const tubeLen = TUBE.y1 - TUBE.y0;
  add(body, K.tubeUV(new THREE.CylinderGeometry(TUBE.r, TUBE.r, tubeLen, 64, 1, true), TUBE.r, tubeLen, 2.2), dark, [0, (TUBE.y0 + TUBE.y1) / 2, 0]);
  add(body, new THREE.CylinderGeometry(TUBE.r * 0.99, TUBE.r * 0.99, tubeLen, 64, 1, true), M.inside, [0, (TUBE.y0 + TUBE.y1) / 2, 0]);
  K.dress(I, 'y', V(0, (TUBE.y0 + TUBE.y1) / 2, 0), TUBE.r, tubeLen, { rails: 4, rail: 'railGrey', gear: 4, seed: 61 });
  add(body, new THREE.CylinderGeometry(1.2, 1.2, 0.14, 64), M.mirror, [0, TUBE.y0 + 0.5, 0]);
  add(body, new THREE.CylinderGeometry(0.2, 0.2, 0.18, 24), M.black, [0, TUBE.y0 + 0.52, 0]);
  const smY = TUBE.y0 + 3.4;
  add(body, new THREE.CylinderGeometry(0.15, 0.2, 0.12, 32), M.mirror, [0, smY, 0]);
  add(body, new THREE.CylinderGeometry(0.26, 0.26, 0.3, 32), M.black, [0, smY + 0.2, 0]);
  for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3 + Math.PI / 2; I.rod(V(0, smY + 0.2, 0), V(Math.cos(a) * TUBE.r * 0.98, smY - 1.2, Math.sin(a) * TUBE.r * 0.98), 0.035, M.black); }

  // Deckel vorn: Hutkrempe auf der Sonnenseite, auf drei Auslegern, zwei Lagen Decke
  const dac = new THREE.Group();
  dac.position.set(0, TUBE.y1, 0);
  body.add(dac);
  const brim = new THREE.CylinderGeometry(TUBE.r + 0.75, TUBE.r + 0.05, 1.6, 48, 1, true, -Math.PI * 0.62, Math.PI * 1.24);
  brim.rotateY(Math.PI / 2);
  add(dac, brim, mat('silver'), [0.25, 0.75, 0]).material.side = THREE.DoubleSide;
  for (const a of [-0.55, 0, 0.55]) { const x = Math.cos(a) * (TUBE.r + 0.05), z = Math.sin(a) * (TUBE.r + 0.05); I.rod(V(x, TUBE.y1 - 0.2, z), V(x * 1.35 + 0.25, TUBE.y1 + 1.55, z * 1.35), 0.04, mat('strut')); }
  I.rod(V(0, TUBE.y1 - 0.05, 0), V(0, TUBE.y1 + 0.05, 0), TUBE.r + 0.06, mat('metal'), K.U.ring);

  // ---------- Solarflügel-Sonnenschild: 3 Spalten × 2 Reihen, Mitte fest, Seiten ausgeklappt ----------
  const SA = { w: 2.15, h: 2.55, x: TUBE.r + 0.55, y0: TUBE.y0 + 0.1 };
  const wings = [];
  for (const [col, ang] of [[0, 0], [1, -32], [-1, 32]]) {
    const g = new THREE.Group();
    g.position.set(SA.x - Math.abs(col) * 0.45, 0, col * SA.w * 0.93);
    g.rotation.y = ang * RAD;
    body.add(g);
    wings.push(g);
    const J = K.inst(g);
    for (let row = 0; row < 2; row++) {
      const y = SA.y0 + SA.h / 2 + row * (SA.h + 0.06);
      J.box(V(0, y, 0), [0.05, SA.h, SA.w], K.panel('cells'));
      for (const dy of [-SA.h / 2, SA.h / 2]) J.rod(V(-0.04, y + dy, -SA.w / 2), V(-0.04, y + dy, SA.w / 2), 0.03, mat('metal'));
      for (const dz of [-SA.w / 2, SA.w / 2]) J.rod(V(-0.04, y - SA.h / 2, dz), V(-0.04, y + SA.h / 2, dz), 0.03, mat('metal'));
    }
    if (col) J.rod(V(-0.05, SA.y0 + 0.4, -col * SA.w / 2), V(-0.05, SA.y0 + 2 * SA.h - 0.4, -col * SA.w / 2), 0.05, mat('metal'));   // Scharnier
    J.done();
  }
  for (const y of [TUBE.y0 + 1, TUBE.y0 + 4.2]) I.rod(V(TUBE.r, y, 0), V(SA.x - 0.05, y, 0), 0.05, mat('strut'));
  I.done();

  // ---------- Ausrichtung: Schild zur Sonne, Inbetriebnahme mit langsamen Schwenks (Modell) ----------
  let program = true, roll = 0, goal = 0, nextAt = ov.jd + 0.3;
  const rp = mulberry32(29), X = V(1, 0, 0), qa = new THREE.Quaternion(), qw = new THREE.Quaternion();
  function steer(dt, flying) {
    obs.quaternion.setFromUnitVectors(X, ov.sun);
    if (program && ov.jd > nextAt) { goal = (rp() - 0.5) * 1.0; nextAt = ov.jd + 0.3 + rp() * 0.4; }
    const g = program ? goal : 0, step = (flying ? 10 : dt) * RAD * Math.min(20, ov.speed ? ov.SPEEDS[ov.speed][0] : 1);
    roll += THREE.MathUtils.clamp(g - roll, -step, step);
    body.quaternion.copy(qa.setFromAxisAngle(X, roll));
    obs.updateMatrixWorld(true);
    hga.quaternion.setFromUnitVectors(X, ov.earthDir.clone().applyQuaternion(body.getWorldQuaternion(qw).invert()));
  }

  // ---------- Posen, Blick „Zur Erde“ ----------
  const home = { pos: new THREE.Vector3(-12, 7, 15), target: new THREE.Vector3(0, 0.3, 0) };
  const intro = { pos: new THREE.Vector3(-4, 6, 6), target: new THREE.Vector3(0, 2.5, 0) };
  const orbit = { minDistance: 6, maxDistance: 500, cineSpeed: 0.5 };
  const look = earthLook(ctx, ov, { home, orbit, eye: EYE, fov: 3 });

  // ---------- Abzeichen ----------
  const wp = (obj, x, y, z) => () => obj.localToWorld(new THREE.Vector3(x, y, z));
  const S = {
    telescope: wp(body, -0.6, TUBE.y1 - 0.4, 0.4), wfi: wp(body, -1.5, 2.9, 0.8), cgi: wp(body, -1.1, 2.7, -1.6), sass: wp(wings[1], 0.1, SA.y0 + SA.h * 1.6, 0),
    dac: wp(dac, 1.6, 1.4, 0), bus: wp(body, -BUS.r, 1.0, 0.6), hga: wp(hga, 0.5, 0, 0),
  };
  const out = () => look.mode === 'out';
  const hs = {};
  for (const [id, f] of [['telescope', 11], ['wfi', 8], ['cgi', 8], ['sass', 14], ['dac', 10], ['bus', 10], ['hga', 7]]) hs[id] = { id, kind: 'info', pos: new THREE.Vector3(), focus: () => f, visible: out };
  hs.trip = { id: 'trip', kind: 'info', pos: ov.spots.l2, visible: out };
  hs.earth = { id: 'earth', kind: 'info', pos: ov.spots.earth };
  hs.moon = { id: 'moon', kind: 'info', pos: ov.spots.moon, visible: () => look.mode === 'earth' };
  hs.sun = { id: 'sun', kind: 'info', pos: ov.spots.sun, visible: out };
  const hotspots = Object.values(hs);
  function placeHotspots() {
    obs.updateMatrixWorld(true);
    for (const k of Object.keys(S)) hs[k].pos.copy(S[k]());
  }

  // ---------- Ebenen (Zahnrad „Station · Roman“) und Infotafel ----------
  registerLayers('roman', [
    ov.layers.clock('Roman'),
    { id: 'program', type: 'toggle', group: 'Teleskop', label: 'Schwenks', hint: 'Langsame Schwenks um die Linie zur Sonne, wie bei Tests in der Inbetriebnahme – Modell, nicht der Flugplan.', value: true, set: (v) => { program = v; } },
    { id: 'dac', type: 'toggle', label: 'Deckel vorn', value: true, set: (v) => { dac.visible = v; } },
    ov.layers.boost('das Teleskop'),
    ...ov.layers.earth(),
  ]);
  const controls = [
    { id: 'view', label: 'Blick', value: 'out', options: [['out', 'Außen'], ['earth', 'Zur Erde']], set: (v) => look.set(v) },
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: ov.speed, min: 0, max: ov.SPEEDS.length - 1, step: 1, fmt: (i) => (i ? ov.SPEEDS[Math.round(i)][1] : 'Echtzeit'),
      set: (v) => { ov.setSpeed(Math.round(v)); refreshLayers(); }, get: () => ov.speed },
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
    widget: () => '<table><thead><tr><th>Roman im Moment</th><th>Wert</th></tr></thead><tbody id="w-l2"><tr><td colspan="2">Bahn wird berechnet …</td></tr></tbody></table><p class="w-foot">Anreise und Bahn um L2 aus den JPL-Horizons-Bahndaten (ab 30.08.2026, künftige Orte als Vorhersage der Mission); Ankunft nach ≈ 100 Tagen erwartet; Erde und Mond an ihren echten Orten zum angezeigten Zeitpunkt.</p>',
    widgetTick(el, t) {
      ov.widgetTick(el, t, () => `<tr><td>seit dem Start</td><td class="num">${Math.max(0, Math.floor(ov.jd - LAUNCH))} Tage</td></tr>`);
    },
    live: () => `${ov.info.trip ? 'Anreise · ' : ''}${(ov.info.dist / 1e6).toFixed(2).replace('.', ',')} Mio. km von der Erde · ${ov.speed ? `Zeitraffer ${ov.SPEEDS[ov.speed][1]}` : 'Echtzeit'}`,
    setPixelRatio: (p) => ov.setPixelRatio(p),
    dispose() {
      ov.dispose();
      K.dispose();
      dark.dispose();
      Object.values(M).forEach((m) => m.dispose());
    },
  };
}
