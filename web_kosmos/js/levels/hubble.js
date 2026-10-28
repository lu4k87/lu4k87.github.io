// Station 01D: Hubble-Weltraumteleskop aus der Nähe (Einheit 1 m), Abstecher von Erde & Mond. Hubble fliegt im
// Bahnsystem (orbitview.js, wie ISS und Tiangong): Flugrichtung x, Erde unten (−y), Steuerbord z; darunter die Erde für den
// angezeigten Zeitpunkt. Bahn aus dem CelesTrak-Schnappschuss (HST).
// Modell nach NASA-Maßen (13 m lang, 4,3 m breit; Spiegel 2,4 m und 0,3 m) und Fotos: Lichtschutzröhre in Silberfolie
// mit offenem Deckel, Geräteteil (größerer Durchmesser) mit Fächern, hellen Ersatzdecken und gelben Haltegriffen, Heck
// mit Instrumentenfächern und Andockring; Spiegel und Sekundärspiegel im Rumpf; zwei starre Solarflügel der dritten
// Generation (Maße nach Fotos geschätzt) auf Masten quer, zwei Hochgewinn-Antennen auf Masten.
// Ausrichtung: Achse V1 (Blickrichtung) fest zum gewählten Ziel am Himmel, Sonne in der Ebene V1–V3 (Rollen), Flügel
// drehen um ihre Masten zur Sonne, Antennen zeigen nach oben (zu den Relais-Satelliten) – vereinfachte Regeln.

import * as THREE from 'three';
import { mulberry32, equToScene } from '../astro.js';
import { createOrbitView, stationMat } from '../orbitview.js';
import { stationKit, V } from '../stationkit.js';
import { registerLayers, refreshLayers } from '../layers.js';

const RAD = Math.PI / 180;
const HST = { aft: -6.6, ssm: -0.9, front: 6.4, r1: 2.1, r2: 1.55 };   // Heck, Ende Geräteteil, Öffnung; Radien [m]
const WING = { len: 7.1, w: 2.6, base: 2.35 };                          // Solarflügel (geschätzt), Abstand vom Rumpf
// Ziele (J2000): Hubble Ultra Deep Field, Säulen der Schöpfung (M16), Andromeda-Galaxie (M31)
const TARGETS = { udf: [53.1625, -27.7914, 'Ultra Deep Field'], m16: [274.7, -13.83, 'Säulen der Schöpfung'], m31: [10.6847, 41.2692, 'Andromeda'] };
const GREYS = [0xf0efe9, 0xd5d7da, 0xa4a8ae, 0x5d6168].map((x) => new THREE.Color(x));

export function create(ctx) {
  const ov = createOrbitView(ctx, { sat: 'HST', fallback: [6847.8, 0.0002, 28.47, 270.53, 155.4, 204.67, -0.6432, 0], radius: 16, color: 0x9cc8ff });
  const { scene, camera } = ov;
  const K = stationKit(ctx), mat = K.mat;
  const hst = new THREE.Group();          // Körper: x = V1 (Blickrichtung), y = V3, z = V2
  scene.add(hst);
  const I = K.inst(hst), late = [];
  const M = {
    inside: stationMat({ color: 0x060607, roughness: 0.95, metalness: 0, side: THREE.BackSide }),
    mirror: stationMat({ color: 0xe8ebf0, metalness: 1, roughness: 0.05, envMapIntensity: 1.5 }),
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
  const tube = (r, x0, x1, m, r2 = r, open = false, tile = 2.4) => {
    const g = K.tubeUV(new THREE.CylinderGeometry(r2, r, x1 - x0, 64, 1, open), Math.max(r, r2), x1 - x0, tile);
    g.rotateZ(-Math.PI / 2);
    return add(hst, g, m, [(x0 + x1) / 2, 0, 0]);
  };

  // ---------- Rumpf: Heck und Geräteteil (Ø 4,2 m), Lichtschutzröhre (Ø 3,1 m) mit Deckel ----------
  tube(HST.r1, HST.aft, HST.aft + 2.4, mat('silver'));                       // Heck mit Instrumentenfächern
  tube(HST.r1, HST.aft + 2.4, HST.ssm, mat('silver'));                       // Geräteteil
  tube(HST.r1 * 0.98, HST.ssm, HST.ssm + 0.25, mat('metal'), HST.r2 * 1.02);   // Übergang
  tube(HST.r2, HST.ssm + 0.25, HST.front, mat('silver'), HST.r2, true, 3.2);  // Lichtschutzröhre (offen)
  tube(HST.r2 * 0.99, HST.ssm + 0.25, HST.front, M.inside, HST.r2 * 0.99, true);
  add(hst, new THREE.CircleGeometry(HST.r1, 64), mat('metal'), [HST.aft - 0.01, 0, 0], [0, -Math.PI / 2, 0]);
  // Andockring am Heck (seit 2009) und Ringe zwischen den Abschnitten
  I.rod(V(HST.aft - 0.35, 0, 0), V(HST.aft, 0, 0), 1.1, mat('dark'), K.U.ring).rod(V(HST.aft - 0.4, 0, 0), V(HST.aft - 0.33, 0, 0), 1.15, mat('metal'), K.U.ring);
  for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3; I.box(V(HST.aft - 0.2, Math.cos(a) * 0.95, Math.sin(a) * 0.95), [0.4, 0.25, 0.25], mat('box'), null, GREYS[1]); }
  for (const x of [HST.aft + 0.05, HST.aft + 2.4, HST.ssm - 0.05]) I.rod(V(x - 0.08, 0, 0), V(x + 0.08, 0, 0), HST.r1 + 0.04, mat('metal'), K.U.ring);
  for (const x of [1.6, 4.1, HST.front - 0.05]) I.rod(V(x - 0.06, 0, 0), V(x + 0.06, 0, 0), HST.r2 + 0.03, mat('metal'), K.U.ring);
  // Ersatzdecken (hell) und Fachtüren auf dem Geräteteil, gelbe Haltegriffe längs
  const rp = mulberry32(31), q = new THREE.Quaternion(), up = V(0, 1, 0), rad = new THREE.Vector3();
  for (let k = 0; k < 10; k++) {
    const a = (k + 0.5) * Math.PI / 5;
    rad.set(0, Math.cos(a), Math.sin(a));
    q.setFromUnitVectors(up, rad);
    const x = HST.aft + 2.4 + (HST.ssm - HST.aft - 2.4) / 2;
    if (rp() < 0.55) I.box(rad.clone().multiplyScalar(HST.r1 + 0.02).add(V(x + (rp() - 0.5) * 0.8, 0, 0)), [2.2 + rp() * 1.2, 0.03, 1.0], mat('us'), q);
    I.box(rad.clone().multiplyScalar(HST.r1 + 0.012).add(V(x, 0, 0)), [3.5, 0.02, 0.05], mat('dark'), q);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k + 0.5) * Math.PI / 2;
    rad.set(0, Math.cos(a), Math.sin(a));
    q.setFromUnitVectors(up, rad);
    I.box(rad.clone().multiplyScalar(HST.r1 + 0.012).add(V(HST.aft + 1.2, 0, 0)), [1.6, 0.02, 1.4], mat('us'), q);   // Instrumententüren
  }
  K.dress(I, 'x', V((HST.aft + HST.ssm) / 2, 0, 0), HST.r1, HST.ssm - HST.aft, { rails: 8, rail: 'rail', gear: 5, seed: 33, ends: false });
  K.dress(I, 'x', V((HST.ssm + HST.front) / 2, 0, 0), HST.r2, HST.front - HST.ssm, { rails: 4, rail: 'rail', gear: 3, seed: 34, ends: false });
  // Deckel am vorderen Ende: Scharnier oben (+y), offen um ≈ 105°
  const door = new THREE.Group();
  door.position.set(HST.front, HST.r2, 0);
  door.rotation.z = 105 * RAD;
  hst.add(door);
  add(door, new THREE.CylinderGeometry(HST.r2 * 1.02, HST.r2 * 1.02, 0.12, 48), mat('silver'), [0, -HST.r2, 0], [0, 0, Math.PI / 2]);
  I.rod(V(HST.front - 0.1, HST.r2 + 0.05, -0.5), V(HST.front - 0.1, HST.r2 + 0.05, 0.5), 0.09, mat('metal'));
  // Optik im Rumpf: Hauptspiegel 2,4 m mit Loch, Prallblenden, Sekundärspiegel 0,3 m auf vier Streben
  const pmX = HST.ssm + 0.6;
  add(hst, new THREE.CylinderGeometry(1.2, 1.2, 0.18, 64), M.mirror, [pmX, 0, 0], [0, 0, Math.PI / 2]);
  add(hst, new THREE.CylinderGeometry(0.3, 0.3, 0.6, 32), M.black, [pmX + 0.3, 0, 0], [0, 0, Math.PI / 2]);
  const smX = pmX + 4.9;
  add(hst, new THREE.CylinderGeometry(0.15, 0.15, 0.08, 32), M.mirror, [smX, 0, 0], [0, 0, Math.PI / 2]);
  add(hst, new THREE.CylinderGeometry(0.22, 0.26, 0.6, 32), M.black, [smX + 0.34, 0, 0], [0, 0, Math.PI / 2]);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; I.rod(V(smX + 0.3, 0, 0), V(smX + 0.3, Math.cos(a) * HST.r2 * 0.98, Math.sin(a) * HST.r2 * 0.98), 0.02, M.black); }
  for (const x of [pmX + 1.4, pmX + 2.6, pmX + 3.8]) I.rod(V(x - 0.02, 0, 0), V(x + 0.02, 0, 0), HST.r2 * 0.97, M.black, K.U.ring);

  // ---------- Solarflügel: Masten quer (±z = V2), Felder drehen um den Mast zur Sonne ----------
  const wings = [];
  for (const s of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(HST.ssm - 0.6, 0, s * HST.r1);
    hst.add(g);
    wings.push(g);
    const J = K.inst(g);
    late.push(J);
    J.rod(V(0, 0, 0), V(0, 0, s * (WING.base + WING.len + 0.2)), 0.07, mat('metal'));
    J.rod(V(0, 0, s * 0.05), V(0, 0, s * 0.45), 0.2, mat('metal'), K.U.disk);
    const m = new THREE.Mesh(K.boxUV(new THREE.BoxGeometry(WING.w, 0.03, WING.len), 1.3, 1.4), [mat('back'), mat('back'), mat('cells'), mat('back'), mat('back'), mat('back')]);
    m.position.set(0, 0, s * (WING.base + WING.len / 2));
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    for (const dx of [-WING.w / 2, WING.w / 2]) J.rod(V(dx, 0, s * WING.base), V(dx, 0, s * (WING.base + WING.len)), 0.03, mat('metal'));
    for (let k = 0; k <= 4; k++) J.rod(V(-WING.w / 2, 0, s * (WING.base + k * WING.len / 4)), V(WING.w / 2, 0, s * (WING.base + k * WING.len / 4)), 0.02, mat('metal'));
  }
  // Hochgewinn-Antennen auf Masten (±y = V3), Schüsseln zeigen nach oben (Relais-Satelliten)
  const dishes = [];
  for (const s of [1, -1]) {
    I.rod(V(HST.ssm - 1.6, s * HST.r1, 0), V(HST.ssm - 1.6, s * (HST.r1 + 3.6), 0), 0.06, mat('metal'));
    const g = new THREE.Group();
    g.position.set(HST.ssm - 1.6, s * (HST.r1 + 3.7), 0);
    hst.add(g);
    const dsh = add(g, new THREE.LatheGeometry(Array.from({ length: 10 }, (_, i) => new THREE.Vector2(i * 0.075, (i * 0.075) ** 2 * 0.45)), 36), mat('paint'), [0, 0, 0]);
    dsh.material.side = THREE.DoubleSide;
    const J = K.inst(g);
    late.push(J);
    for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3; J.rod(V(Math.cos(a) * 0.62, 0.17, Math.sin(a) * 0.62), V(0, 0.55, 0), 0.012, mat('metal')); }
    J.rod(V(0, -0.25, 0), V(0, 0.02, 0), 0.12, mat('dark'), K.U.disk);
    dishes.push(g);
  }
  I.done();
  late.forEach((J) => J.done());

  // ---------- Ausrichtung: V1 zum Ziel, Sonne in der Ebene V1–V3, Flügel zur Sonne, Antennen nach oben ----------
  let target = 'udf';
  const tgtEcl = new THREE.Vector3(), tgt = new THREE.Vector3(), v3 = new THREE.Vector3(), v2 = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const qGoal = new THREE.Quaternion(), qInv = new THREE.Quaternion(), sunB = new THREE.Vector3(), upB = new THREE.Vector3();
  const setTarget = (k) => { target = k; tgtEcl.set(...equToScene(TARGETS[k][0], TARGETS[k][1])); };
  setTarget(target);
  let first = true, wingAng = 0;
  const vis = { free: true, ang: 0 };
  function steer(dt, flying) {
    tgt.copy(tgtEcl).applyQuaternion(ov.far.quaternion);
    // Sonne in die Ebene V1–V3: V3 = Anteil der Sonne senkrecht zur Blickrichtung (zur Sonne hin)
    v3.copy(ov.sun).addScaledVector(tgt, -ov.sun.dot(tgt));
    if (v3.lengthSq() < 1e-6) v3.set(0, 1, 0);
    v3.normalize().negate();          // −V3 zur Sonne: Flügel und Rumpf-Unterseite (Schatten der Röhre)
    v2.crossVectors(tgt, v3).normalize();
    v3.crossVectors(v2, tgt);
    m4.makeBasis(tgt, v3, v2);
    qGoal.setFromRotationMatrix(m4);
    // träge nachführen (Hubble dreht ≈ 1°/min, im Bild schneller); beim Flug und am Anfang sofort
    if (first || flying) hst.quaternion.copy(qGoal); else hst.quaternion.rotateTowards(qGoal, dt * 6 * RAD * Math.max(1, ov.speed ? ov.SPEEDS[ov.speed][0] / 10 : 1));
    first = false;
    qInv.copy(hst.quaternion).invert();
    sunB.copy(ov.sun).applyQuaternion(qInv);
    // Flügel: Zellen (+y der Felder) zur Sonne, Drehung um den Mast (z)
    const goalW = Math.atan2(-sunB.x, sunB.y);
    wingAng = flying ? goalW : wingAng + THREE.MathUtils.clamp(Math.atan2(Math.sin(goalW - wingAng), Math.cos(goalW - wingAng)), -dt, dt);
    wings.forEach((g) => { g.rotation.z = wingAng; });
    upB.set(0, 1, 0).applyQuaternion(qInv);
    dishes.forEach((g) => g.quaternion.setFromUnitVectors(V(0, 1, 0), upB));
    // Ziel frei oder hinter der Erde (Winkel zur Erdmitte gegen ihren Winkelradius, + 1° Lufthülle)
    const rho = Math.asin(6371 / (6371 + ov.info.alt));
    vis.ang = Math.acos(THREE.MathUtils.clamp(-tgt.y, -1, 1));
    vis.free = vis.ang > rho + RAD;
  }

  // ---------- Posen ----------
  const home = { pos: new THREE.Vector3(-14, 12, 30), target: new THREE.Vector3(0, -1, 0) };
  const intro = { pos: new THREE.Vector3(9, 3, 11), target: new THREE.Vector3(2, 0, 0) };
  const orbit = { minDistance: 6, maxDistance: 600, cineSpeed: 0.5 };

  // ---------- Abzeichen ----------
  const wp = (obj, x, y, z) => () => obj.localToWorld(new THREE.Vector3(x, y, z));
  const S = {
    mirror: wp(hst, HST.front - 0.4, 0.6, 0), door: wp(door, 0.15, -HST.r2, 0), arrays: wp(wings[0], 0, 0.1, WING.base + WING.len * 0.7),
    antennas: wp(dishes[0], 0, 0.3, 0), instruments: wp(hst, HST.aft + 1.2, HST.r1 * 0.75, HST.r1 * 0.75), service: wp(hst, (HST.aft + HST.ssm) / 2, -HST.r1 * 0.72, -HST.r1 * 0.72),
    target: wp(hst, HST.front + 14, 0, 0),
  };
  const hs = {};
  for (const [id, f] of [['mirror', 14], ['door', 10], ['arrays', 18], ['antennas', 10], ['instruments', 12], ['service', 14], ['target', 30]]) hs[id] = { id, kind: 'info', pos: new THREE.Vector3(), focus: () => f };
  hs.horizon = { id: 'horizon', kind: 'info', pos: ov.spots.horizon };
  hs.below = { id: 'below', kind: 'info', pos: ov.spots.below };
  hs.sun = { id: 'sun', kind: 'info', pos: ov.spots.sun, visible: () => ov.lit > 0.5 };
  const hotspots = Object.values(hs);
  function placeHotspots() {
    hst.updateMatrixWorld(true);
    for (const k of Object.keys(S)) hs[k].pos.copy(S[k]());
  }

  // ---------- Ebenen (Zahnrad „Station · Hubble“) und Infotafel ----------
  registerLayers('hubble', [
    ov.layers.clock('Hubble'),
    { id: 'door', type: 'toggle', group: 'Teleskop', label: 'Deckel offen', value: true, set: (v) => { door.rotation.z = (v ? 105 : 0) * RAD; } },
    { id: 'boost', type: 'toggle', label: 'Im Erdschatten aufhellen', hint: 'Echt ist das Teleskop im Schatten fast schwarz; aufgehellt bleibt es erkennbar.', value: true, set: (v) => ov.setBoost(v) },
    { id: 'orbit', type: 'toggle', group: 'Bahn', label: 'Bahnspur am Boden', hint: 'Blaue Linie: der Weg über den Boden, ein halber Umlauf zurück und anderthalb voraus.', value: true, set: (v) => ov.setTrack(v) },
    ...ov.layers.earth(),
  ]);
  const controls = [
    { id: 'target', label: 'Ziel', value: 'udf', options: Object.entries(TARGETS).map(([k, v]) => [k, v[2]]), set: setTarget },
  ];

  return {
    scene, camera, home, intro, unit: 1, hotspots, controls, orbit,
    look: { exposure: 1.0, bloom: 0.07, sat: 1.05 },
    ready: Promise.all([ov.ready, K.ready()]),
    update(dt, t, cam, flying) {
      ov.update(dt, t, cam, flying);
      steer(dt, flying);
      placeHotspots();
    },
    widget: () => '<table><thead><tr><th>Hubble im Moment</th><th>Wert</th></tr></thead><tbody id="w-orb"><tr><td colspan="2">Bahn wird geladen …</td></tr></tbody></table><p class="w-foot">Bahn aus den CelesTrak-Bahnelementen (Stand 25.10.2026), fortgeschrieben mit Kepler + J2; Ziel frei oder hinter der Erde: eigene Rechnung aus Bahnhöhe und Zielrichtung.</p>',
    widgetTick(el, t) {
      ov.widgetTick(el, t, () => `<tr><td>Umlauf · Bahnneigung</td><td class="num">${ov.info.period.toFixed(1).replace('.', ',')} min · 28,5°</td></tr>
        <tr class="${vis.free ? '' : 'is-hi'}"><td>Ziel ${TARGETS[target][2]}</td><td class="num">${vis.free ? 'frei' : 'hinter der Erde'}</td></tr>`);
    },
    live: () => `über ${ov.where()} · ${ov.lit > 0.5 ? 'Tag' : 'Nacht im Erdschatten'} · Ziel ${TARGETS[target][2]}${vis.free ? '' : ' hinter der Erde'}`,
    setPixelRatio: (p) => ov.setPixelRatio(p),
    dispose() {
      ov.dispose();
      K.dispose();
      Object.values(M).forEach((m) => m.dispose());
    },
  };
}
