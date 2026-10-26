// Station 8: Lokale Gruppe (Einheit 1 kpc), Milchstraße im Ursprung (galaktische Ebene = y = 0). Andromeda, M33,
// Magellansche Wolken und 25 Zwerggalaxien an galaktischen Koordinaten (l, b) und Entfernung (McConnachie 2012); Größen
// maßstäblich (Milchstraße ≈ 30 kpc Scheibe, M31 ≈ 1,4-fach), Formen als Modell (gleicher Generator wie Station 3).
// Neigungen: M31 77° (optisch, PA 38°), M33 ≈ 52°, LMC 25°. Zukunft: Zweikörper-Modell Milchstraße–Andromeda als
// Punktmassen (1,2 und 1,5·10¹² M☉) mit gemessener Radialgeschwindigkeit −109 km/s und ≈ 17 km/s quer (van der Marel
// 2012); endet beim ersten Vorbeiflug – danach verschmelzen beide über Milliarden Jahre (dynamische Reibung, hier nicht
// gerechnet). Grenze der Gruppe: Nullgeschwindigkeitsfläche ≈ 1 Mpc. Hintergrund: ferne Galaxien 2–6 Mpc statistisch.

import * as THREE from 'three';
import { buildGalaxy, R0 } from './galaxy.js';
import { pointCloud, disposeScene } from '../vol.js';
import { galToScene, mulberry32, gauss, blackbody, KPC } from '../astro.js';

const RAD = Math.PI / 180;
// Zwerggalaxien (l, b in Grad, d in kpc), gerundet nach McConnachie 2012
const DWARFS = [
  ['Sagittarius-Zwerg', 5.6, -14.2, 26], ['Draco', 86.4, 34.7, 76], ['Ursa Minor', 105.0, 44.8, 76], ['Sculptor', 287.5, -83.2, 86],
  ['Sextans', 243.5, 42.3, 86], ['Carina', 260.1, -22.2, 105], ['Fornax-Zwerg', 237.1, -65.7, 147], ['Leo II', 220.2, 67.2, 233],
  ['Leo I', 226.0, 49.1, 254], ['M32', 121.2, -22.0, 785], ['M110', 120.7, -21.1, 824], ['NGC 185', 120.8, -14.5, 617],
  ['NGC 147', 119.8, -14.3, 676], ['IC 10', 119.0, -3.3, 794], ['NGC 6822', 25.3, -18.4, 459], ['IC 1613', 129.8, -60.6, 755],
  ['WLM', 75.9, -73.6, 933], ['Andromeda II', 128.9, -29.2, 652], ['Andromeda I', 121.7, -24.8, 727], ['Pegasus-Zwerg', 94.8, -43.5, 920],
  ['Leo A', 196.9, 52.4, 798], ['Phoenix', 272.2, -68.9, 415], ['Tucana', 322.9, -47.4, 887], ['Aquarius-Zwerg', 34.0, -31.3, 1072],
  ['Sagittarius dIrr', 21.1, -16.3, 1067],
];
// Zweikörper-Bahn Milchstraße–Andromeda: Leapfrog in Myr; G = 4,498·10⁻¹² kpc³/(M☉·Myr²)
const G = 4.498e-12, M_MW = 1.2e12, M_M31 = 1.5e12, KMS = 1.0227e-3;   // km/s → kpc/Myr
function futureTrack(rel0) {
  const mu = G * (M_MW + M_M31);
  const r = rel0.clone();
  const rad = r.clone().normalize();
  const side = new THREE.Vector3().crossVectors(rad, new THREE.Vector3(0, 1, 0)).normalize();
  const v = rad.clone().multiplyScalar(-109.3 * KMS).addScaledVector(side, 17 * KMS);
  const track = [r.clone()];
  const dt = 1;
  let a = r.clone().multiplyScalar(-mu / Math.pow(r.length(), 3));
  for (let t = 0; t < 12000; t++) {
    v.addScaledVector(a, dt / 2);
    r.addScaledVector(v, dt);
    a = r.clone().multiplyScalar(-mu / Math.pow(r.length(), 3));
    v.addScaledVector(a, dt / 2);
    track.push(r.clone());
    if (r.dot(v) > 0 && t > 100) break;   // erstes Perizentrum: Abstand wächst wieder
  }
  return track;
}

const at = (l, b, d) => new THREE.Vector3(...galToScene(l, b, d, R0));
// Ausrichtung einer Scheibe: Normale um `inc` gegen die Sichtlinie von der Sonne geneigt, Lage nach Positionswinkel
function orient(group, pos, inc, pa) {
  const los = pos.clone().sub(new THREE.Vector3(-R0, 0, 0)).normalize();
  const north = new THREE.Vector3(0, 1, 0);
  const e1 = new THREE.Vector3().crossVectors(los, north).normalize();
  const e2 = new THREE.Vector3().crossVectors(e1, los).normalize();
  const tilt = e1.multiplyScalar(Math.cos(pa * RAD)).add(e2.multiplyScalar(Math.sin(pa * RAD)));
  const n = los.clone().multiplyScalar(-Math.cos(inc * RAD)).addScaledVector(tilt, Math.sin(inc * RAD)).normalize();
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  group.position.copy(pos);
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 20000);
  const det = ctx.detail;
  const mw = buildGalaxy({ n: Math.round(70000 * det), seed: 9, gain: 14, dust: true });
  scene.add(mw);
  const m31pos = at(121.17, -21.57, 761);
  const m31 = buildGalaxy({ n: Math.round(90000 * det), seed: 31, scale: 1.4, gain: 13 });
  orient(m31, m31pos, 77, 38);
  scene.add(m31);
  const m33pos = at(133.61, -31.33, 840);
  const m33 = buildGalaxy({ n: Math.round(30000 * det), seed: 33, scale: 0.55, gain: 14, dust: false });
  orient(m33, m33pos, 52, 23);
  scene.add(m33);

  // irreguläre Galaxien und Zwerge als Punktwolken
  const rand = mulberry32(8);
  const pos = [], col = [], size = [];
  const blob = (c, n, r, k, flat = 1, T = 5200) => {
    for (let i = 0; i < n; i++) {
      pos.push(c.x + gauss(rand) * r, c.y + gauss(rand) * r * flat, c.z + gauss(rand) * r);
      col.push(...blackbody(T + rand() * 3000).map((v) => v * k * 5 * (0.5 + rand())));
      size.push(0.12);
    }
  };
  const lmc = at(280.47, -32.89, 49.6), smc = at(302.81, -44.33, 62.4);
  blob(lmc, Math.round(9000 * det), 1.6, 0.9, 0.5, 6000);
  blob(lmc, Math.round(3000 * det), 0.6, 1.2, 0.4, 5000);
  blob(smc, Math.round(4000 * det), 1.0, 0.8, 0.6, 6500);
  const dwarfPos = DWARFS.map(([name, l, b, d]) => ({ name, p: at(l, b, d), big: d > 400 && !name.startsWith('Leo') }));
  for (const dw of dwarfPos) blob(dw.p, Math.round((dw.big ? 420 : 260) * det) + 40, dw.big ? 0.9 + rand() * 0.6 : 0.5 + rand() * 0.6, dw.big ? 0.7 : 0.55, 0.8, 4600);
  const small = pointCloud(pos, col, size, { min: 1.1 });
  scene.add(small);
  // M31-Begleiter M32/M110 laufen mit Andromeda mit (Versatz zu M31 merken)
  const m31Kids = dwarfPos.filter((d) => d.name === 'M32' || d.name === 'M110' || d.name.startsWith('Andromeda') || d.name.startsWith('NGC 1'));

  // ferne Hintergrund-Galaxien (2–6 Mpc), schwach – geben dem Raum Tiefe
  const bp = [], bc = [], bs = [];
  for (let i = 0; i < Math.round(2600 * det); i++) {
    const dir = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(2000 + rand() * 4000);
    bp.push(dir.x, dir.y, dir.z);
    bc.push(...blackbody(4200 + rand() * 2500).map((v) => v * 1.4 * (0.3 + rand())));
    bs.push(8 + rand() * 14);
  }
  const back = pointCloud(bp, bc, bs, { min: 1.0, max: 6, fade: 5 });
  scene.add(back);

  // Grenze der Gruppe: Nullgeschwindigkeitsfläche ≈ 1 Mpc um den Schwerpunkt (zwischen MW und M31) – drei Ringe
  const bary = m31pos.clone().multiplyScalar(M_M31 / (M_MW + M_M31));
  const bound = new THREE.Group();
  const ringMat = new THREE.LineBasicMaterial({ color: 0x8fb0e0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const ax of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    const pts = [];
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const v = ax[1] ? new THREE.Vector3(Math.cos(a), 0, Math.sin(a)) : ax[0] ? new THREE.Vector3(0, Math.cos(a), Math.sin(a)) : new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
      pts.push(v.multiplyScalar(1000).add(bary));
    }
    bound.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
  }
  bound.visible = false;
  scene.add(bound);

  // Zukunft: Bahn von M31 relativ zur Milchstraße (Milchstraße bleibt im Ursprung)
  const track = futureTrack(m31pos);
  const tMax = track.length - 1;
  const trackLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(track), new THREE.LineBasicMaterial({ color: 0x33ccff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  trackLine.visible = false;
  scene.add(trackLine);
  let future = 0, labelsOn = false;
  const dwarfBase = dwarfPos.map((d) => d.p.clone());
  const m31Now = m31pos.clone();
  const smallPos = small.geometry.attributes.position;
  const kidRanges = [];   // Punktbereiche der M31-Begleiter in der Punktwolke (für das Mitführen)
  {
    let idx = (Math.round(9000 * det) + Math.round(3000 * det) + Math.round(4000 * det));
    for (const dw of dwarfPos) {
      const n = Math.round((dw.big ? 420 : 260) * det) + 40;
      if (m31Kids.includes(dw)) kidRanges.push([idx, idx + n]);
      idx += n;
    }
  }
  function setFuture(myr) {
    future = Math.min(myr, tMax);
    const p = track[Math.round(future)];
    const delta = p.clone().sub(m31Now);
    m31.position.copy(p);
    m31Now.copy(p);
    m31pos.copy(p);
    for (const dw of m31Kids) dw.p.copy(dwarfBase[dwarfPos.indexOf(dw)]).add(p).sub(track[0]);
    for (const [a, b] of kidRanges) for (let i = a; i < b; i++) smallPos.setXYZ(i, smallPos.getX(i) + delta.x, smallPos.getY(i) + delta.y, smallPos.getZ(i) + delta.z);
    smallPos.needsUpdate = true;
    trackLine.visible = future > 0;
  }

  const hotspots = [
    { id: 'mw', kind: 'dive', to: 'galaxy', pos: new THREE.Vector3(0, 0, 0) },
    { id: 'm31', kind: 'info', pos: m31pos },
    { id: 'm33', kind: 'info', pos: m33pos },
    { id: 'lmc', kind: 'info', pos: lmc },
    { id: 'bound', kind: 'info', pos: bary.clone().add(new THREE.Vector3(0, 1000, 0)), visible: () => bound.visible },
    { id: 'future', kind: 'info', pos: m31pos, visible: () => future > 0 },
    ...dwarfPos.map((d) => ({ id: `dw-${d.name}`, kind: 'label', cls: 'hsl--faint', pos: d.p, visible: () => labelsOn,
      info: { t: d.name, x: `${d.name}: Zwerggalaxie der Lokalen Gruppe, ${Math.round(d.p.distanceTo(new THREE.Vector3(-R0, 0, 0)) * 3.2616).toLocaleString('de-DE')} Tsd. Lj von der Sonne (McConnachie 2012).`, s: 'mcconnachie-2012' } })),
  ];
  const controls = [
    { id: 'labels', label: 'Namen', value: 'off', options: [['off', 'Aus'], ['on', 'Zwerggalaxien + Grenze']], set: (v) => { labelsOn = v === 'on'; bound.visible = labelsOn; } },
    { id: 'future', label: 'Zukunft', type: 'range', min: 0, max: Math.floor(tMax / 100) * 100, step: 20, value: 0, fmt: (v) => (v ? `+${(v / 1000).toFixed(1).replace('.', ',')} Mrd. J.` : 'heute'), set: (v) => setFuture(v) },
  ];
  // Blick über die Milchstraße hinweg auf Andromeda: beide auf einer Linie, die Kamera darüber (Abstand oben/unten
  // statt links/rechts, damit das Bild auch im Hochformat trägt)
  const u = m31pos.clone().normalize();
  const side = new THREE.Vector3().crossVectors(u, new THREE.Vector3(0, 1, 0)).normalize();
  const lift = new THREE.Vector3().crossVectors(side, u).normalize();
  const target = u.clone().multiplyScalar(170);

  return {
    scene, camera, unit: KPC, hotspots, controls,
    home: { pos: u.clone().multiplyScalar(-210).addScaledVector(lift, 135).addScaledVector(side, 45), target },
    orbit: { minDistance: 30, maxDistance: 4500, cineSpeed: 0.5 },
    look: { exposure: 1.15, bloom: 0.09, sat: 1.08, con: 0.12 },
    update() {},
    live: () => (future > 0
      ? `In ${(future / 1000).toFixed(1).replace('.', ',')} Mrd. Jahren: Andromeda ${Math.round(m31pos.length() * 3.2616).toLocaleString('de-DE')} Tsd. Lj entfernt${future >= tMax ? ' · erster Vorbeiflug, danach Verschmelzung (Modellende)' : ''}`
      : `Heute: Andromeda ${Math.round(m31pos.length() * 3.2616 / 10) / 100} Mio. Lj entfernt, nähert sich mit 109 km/s · Modell: nächste Begegnung in ≈ ${(tMax / 1000).toFixed(1).replace('.', ',')} Mrd. Jahren`),
    setPixelRatio(pr, H) {
      for (const g of [mw, m31, m33]) g.userData.setPx(pr, H, camera.fov);
      small.userData.setPx(pr, H, camera.fov);
      back.userData.setPx(pr, H, camera.fov);
    },
    dispose: () => disposeScene(scene),
  };
}
