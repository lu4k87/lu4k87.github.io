// Station 8: Lokale Gruppe (Einheit 1 kpc), Milchstraße im Ursprung (galaktische Ebene = y = 0). Andromeda, M33,
// Magellansche Wolken und 25 Zwerggalaxien an galaktischen Koordinaten (l, b) und Entfernung (McConnachie 2012); Größen
// maßstäblich (Milchstraße ≈ 30 kpc Scheibe, M31 ≈ 1,4-fach), Formen als Modell (Generator von Station 3, eigene Arme/Ringe).
// Neigungen: M31 77° (optisch, PA 38°), M33 ≈ 52°, LMC 26° (van der Marel & Kallivayalil 2014). Zukunft: Zweikörper-Modell
// Milchstraße–Andromeda als Punktmassen (1,2 und 1,5·10¹² M☉) mit gemessener Radialgeschwindigkeit −109 km/s und ≈ 17 km/s
// quer (van der Marel 2012); endet beim ersten Vorbeiflug – danach verschmelzen beide über Milliarden Jahre (dynamische
// Reibung, hier nicht gerechnet). Grenze der Gruppe: Nullgeschwindigkeitsfläche ≈ 1 Mpc. Hintergrund: ferne Galaxien 2–6 Mpc.
// Galaxien detailreich über galaxyfx.js: diffuses Licht mit Staubbahnen, Sternentstehung im Zeitraffer (Arme stehen als
// Dichtewelle, Sterne ziehen hindurch), Bulge als Lichthof, Halo mit Kugelsternhaufen, Gezeitenströme (Modell).
// Fahrt hinein zur Milchstraße (Station 3): Vorbeiflug an reifen Galaxien (pass, galaxyflight.js createFlyby) – Darstellung.

import * as THREE from 'three';
import { buildGalaxy, buildHalo, ARMS, R0 } from './galaxy.js';
import { pointCloud, disposeScene } from '../vol.js';
import { galToScene, mulberry32, gauss, blackbody, KPC } from '../astro.js';
import { galaxyGlow, starFormation, lightBlobs, streamCloud } from '../galaxyfx.js';
import { registerLayers } from '../layers.js';
import { galaxyAtlas, createFlyby } from '../galaxyflight.js';

const RAD = Math.PI / 180;
// Zwerggalaxien (l, b in Grad, d in kpc, Typ), gerundet nach McConnachie 2012: S = sphäroidal (alt, rötlich, sehr
// lichtschwach), E = elliptisch (kompakt, hell), I = irregulär (junge blaue Sterne, HII-Regionen)
const DWARFS = [
  ['Sagittarius-Zwerg', 5.6, -14.2, 26, 'S'], ['Draco', 86.4, 34.7, 76, 'S'], ['Ursa Minor', 105.0, 44.8, 76, 'S'], ['Sculptor', 287.5, -83.2, 86, 'S'],
  ['Sextans', 243.5, 42.3, 86, 'S'], ['Carina', 260.1, -22.2, 105, 'S'], ['Fornax-Zwerg', 237.1, -65.7, 147, 'S'], ['Leo II', 220.2, 67.2, 233, 'S'],
  ['Leo I', 226.0, 49.1, 254, 'S'], ['M32', 121.2, -22.0, 785, 'E'], ['M110', 120.7, -21.1, 824, 'E'], ['NGC 185', 120.8, -14.5, 617, 'E'],
  ['NGC 147', 119.8, -14.3, 676, 'E'], ['IC 10', 119.0, -3.3, 794, 'I'], ['NGC 6822', 25.3, -18.4, 459, 'I'], ['IC 1613', 129.8, -60.6, 755, 'I'],
  ['WLM', 75.9, -73.6, 933, 'I'], ['Andromeda II', 128.9, -29.2, 652, 'S'], ['Andromeda I', 121.7, -24.8, 727, 'S'], ['Pegasus-Zwerg', 94.8, -43.5, 920, 'I'],
  ['Leo A', 196.9, 52.4, 798, 'I'], ['Phoenix', 272.2, -68.9, 415, 'I'], ['Tucana', 322.9, -47.4, 887, 'S'], ['Aquarius-Zwerg', 34.0, -31.3, 1072, 'I'],
  ['Sagittarius dIrr', 21.1, -16.3, 1067, 'I'],
];
// Darstellung je Typ (Modell): Radius des Lichthofs [kpc], Farbtemperatur, Helligkeit des Hofs, aufgelöste Sterne
const DTYPE = {
  S: { r: [0.5, 1.0], T: 4500, glow: 0.2, n: 110 },
  E: { r: [0.6, 1.2], T: 4700, glow: 0.9, n: 160 },
  I: { r: [0.6, 1.2], T: 7000, glow: 0.35, n: 150 },
};
// Rotationskurven (Modell): Milchstraße wie Station 3, Musterdrehzahl Ωp = 28,2 km/s/kpc (Dias et al. 2019);
// vmax Andromeda ≈ 250 km/s (Chemin et al. 2009), M33 ≈ 120 km/s (Corbelli et al. 2014), LMC ≈ 92 km/s (van der Marel &
// Kallivayalil 2014). Deren Musterdrehzahlen sind nicht gemessen: Korotation bei ≈ ⅔ des Scheibenrands (Annahme)
const ROT = {
  mw: { vmax: 230, rT: 1.2, omegaP: 28.2 }, m31: { vmax: 250, rT: 1.5, omegaP: 19 },
  m33: { vmax: 120, rT: 3, omegaP: 15 }, lmc: { vmax: 92, rT: 1.5, omegaP: 20 },
};
// Arme in Modelleinheiten des Generators (× scale = kpc). M31: Ring bei ≈ 10 kpc und ein innerer bei ≈ 1,5 kpc (Gordon et al.
// 2006), dazu zwei eng gewundene, schwache Arme; M33: zwei Hauptarme, flockig; LMC: ein Arm am Balken (Magellan-Typ) – Modell
const arm = (a) => ({ ...a, phiRef: a.beta * RAD });
const M31_ARMS = [
  arm({ rRef: 8.5, beta: 0, pitch: 8, span: [60, -260], w: 0.45, width: 0.32 }),
  arm({ rRef: 8.5, beta: 180, pitch: 8, span: [240, -80], w: 0.45, width: 0.32 }),
];
const M31_RINGS = [{ R: 10 / 1.4, width: 0.55, w: 1 }, { R: 1.5 / 1.4, width: 0.22, w: 0.3 }];
const M33_ARMS = [
  arm({ rRef: 6, beta: 30, pitch: 24, span: [120, -200], w: 1, width: 0.55 }),
  arm({ rRef: 6, beta: 210, pitch: 24, span: [300, -20], w: 1, width: 0.55 }),
  arm({ rRef: 9, beta: 110, pitch: 28, span: [140, -60], w: 0.45, width: 0.4 }),
  arm({ rRef: 9, beta: 290, pitch: 28, span: [320, 120], w: 0.45, width: 0.4 }),
];
const LMC_ARMS = [arm({ rRef: 7.5, beta: 120, pitch: 22, span: [150, -60], w: 1, width: 0.55 })];
// Zeitraffer der Sternentstehung: Mio. Jahre je Sekunde (HII-Regionen leben 3–8 Mio. Jahre → höchstens ≈ 1,7 Pulse/s)
const PINK = [1.0, 0.32, 0.48];   // HII-Region: Hα + Hβ
const SPEEDS = [[0.5, '0,5 Mio. J./s'], [1, '1 Mio. J./s'], [2, '2 Mio. J./s'], [5, '5 Mio. J./s']];

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

const SUN = new THREE.Vector3(-R0, 0, 0), UP = new THREE.Vector3(0, 1, 0);
const at = (l, b, d) => new THREE.Vector3(...galToScene(l, b, d, R0));
// Richtung von der Sonne (galaktisch, Einheitsvektor) → Szene in Entfernung d
const dirLB = (l, b) => new THREE.Vector3(Math.cos(b * RAD) * Math.cos(l * RAD), Math.cos(b * RAD) * Math.sin(l * RAD), Math.sin(b * RAD));
const helio = (u, d) => new THREE.Vector3(-R0 + u.x * d, u.z * d, -u.y * d);
// Ausrichtung einer Scheibe: Normale um `inc` gegen die Sichtlinie von der Sonne geneigt, Lage nach Positionswinkel
function orient(group, pos, inc, pa) {
  const los = pos.clone().sub(SUN).normalize();
  const e1 = new THREE.Vector3().crossVectors(los, UP).normalize();
  const e2 = new THREE.Vector3().crossVectors(e1, los).normalize();
  const tilt = e1.multiplyScalar(Math.cos(pa * RAD)).add(e2.multiplyScalar(Math.sin(pa * RAD)));
  const n = los.clone().multiplyScalar(-Math.cos(inc * RAD)).addScaledVector(tilt, Math.sin(inc * RAD)).normalize();
  group.quaternion.setFromUnitVectors(UP, n);
  group.position.copy(pos);
  group.updateMatrixWorld(true);
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 20000);
  const det = ctx.detail;
  const px = [], timed = [], glows = [], young = [], streams = [];
  const keep = (o, list) => { px.push(o); if (list) list.push(o); return o; };

  // Spiralgalaxie = Punktwolke (alte Sterne, Balken, Staub) + diffuses Licht + Sternentstehung + Bulge-Hof
  function spiral({ n, seed, scale, gain, arms, rings = [], rot, glow, sf, bulgeHof, ...rest }) {
    const g = new THREE.Group();
    const stars = keep(buildGalaxy({ n, seed, scale, gain, arms, rings, young: false, diffuse: 0, ...rest }));
    const gl = galaxyGlow({ arms, rings, scale, rot, seed, ...glow });
    const sfp = keep(starFormation({ arms, rings, scale, rot, seed: seed + 100, ...sf }), young);
    g.add(stars, gl, sfp);
    glows.push(gl);
    timed.push(gl.material, sfp.material);
    if (bulgeHof) g.add(keep(lightBlobs([0, 0, 0], blackbody(4300).map((v) => v * bulgeHof[1]), [bulgeHof[0]]), glows));
    return g;
  }

  // Milchstraße: Bulge-Hof ≈ 5 kpc, diffuses Licht mit Skalenlänge 2,6 kpc wie die Punktwolke
  const mw = spiral({
    n: Math.round(70000 * det), seed: 9, scale: 1, gain: 14, arms: ARMS, rot: ROT.mw, bulgeHof: [5, 0.55],
    glow: { gain: 0.4, young: 0.6, dust: 0.65, bar: 0.55 }, sf: { n: Math.round(16000 * det), gain: 14 * 0.4 },
  });
  scene.add(mw);
  const halo = keep(buildHalo(det * 0.6, mulberry32(17)));
  scene.add(halo);

  const m31pos = at(121.17, -21.57, 761);
  const m31 = spiral({
    n: Math.round(90000 * det), seed: 31, scale: 1.4, gain: 13, arms: M31_ARMS, rings: M31_RINGS, rot: ROT.m31, bulgeHof: [9, 0.8],
    glow: { gain: 0.35, young: 0.55, dust: 0.75, bar: 0.25, h: 3.8, rIn: 0.8 }, sf: { n: Math.round(18000 * det), gain: 13 * 0.4, rIn: 0.8 },
  });
  orient(m31, m31pos, 77, 38);
  scene.add(m31);
  const m33pos = at(133.61, -31.33, 840);
  const m33 = spiral({
    n: Math.round(30000 * det), seed: 33, scale: 0.55, gain: 14, dust: false, arms: M33_ARMS, rot: ROT.m33, bar: 0.15, bulge: 0.25, bulgeHof: [1.6, 0.35],
    glow: { gain: 0.35, young: 0.8, dust: 0.3, bar: 0.1, h: 3.2, rIn: 1.2 }, sf: { n: Math.round(9000 * det), gain: 14 * 0.5, rIn: 1.2, hii: 0.06 },
  });
  orient(m33, m33pos, 52, 23);
  scene.add(m33);

  // Große Magellansche Wolke: Balken + ein Arm, flach, Tarantelnebel (30 Doradus) am Ostende des Balkens
  const lmc = at(280.47, -32.89, 49.6), smc = at(302.81, -44.33, 62.4);
  const lmcG = spiral({
    n: Math.round(16000 * det), seed: 50, scale: 0.28, gain: 12, dust: false, arms: LMC_ARMS, rot: ROT.lmc, bulge: 0,
    glow: { gain: 0.3, young: 0.7, dust: 0.25, bar: 0.9, h: 5.4, rIn: 4 }, sf: { n: Math.round(4000 * det), gain: 12 * 0.5, rIn: 4, hii: 0.05 },
  });
  orient(lmcG, lmc, 26, 154);
  const tarantula = new THREE.Vector3(...[-4.5 * Math.cos(64 * RAD), 0, -4.5 * Math.sin(64 * RAD)].map((v) => v * 0.28));
  lmcG.add(keep(lightBlobs([tarantula.x, 0, tarantula.z], PINK.map((v) => v * 1.6), [0.9]), glows));
  scene.add(lmcG);
  const tarantulaW = tarantula.clone().applyMatrix4(lmcG.matrixWorld);
  // NGC 604: Riesen-HII-Region in M33, nordöstlich vom Kern (≈ 4 kpc; Lage im Modell)
  const ngc604 = new THREE.Vector3(-7.2, 0, 1.4).multiplyScalar(0.55);
  m33.add(keep(lightBlobs([ngc604.x, 0, ngc604.z], PINK.map((v) => v * 1.2), [0.7]), glows));
  const ngc604W = ngc604.clone().applyMatrix4(m33.matrixWorld);

  // Zwerge und SMC: aufgelöste Sterne + weicher Lichthof; M31-Begleiter liegen in `kids` und laufen mit Andromeda mit
  const rand = mulberry32(8);
  const bags = { own: { pos: [], col: [], size: [], hp: [], hc: [], hs: [] }, kids: { pos: [], col: [], size: [], hp: [], hc: [], hs: [] } };
  const star = (b, p, c, s = 0.12) => { b.pos.push(p.x, p.y, p.z); b.col.push(...c); b.size.push(s); };
  const hof = (b, p, T, k, d) => { b.hp.push(p.x, p.y, p.z); b.hc.push(...blackbody(T).map((v) => v * k)); b.hs.push(d); };
  const blob = (b, c, n, r, k, T, dT, flat = 1) => {
    for (let i = 0; i < n; i++) star(b, new THREE.Vector3(c.x + gauss(rand) * r, c.y + gauss(rand) * r * flat, c.z + gauss(rand) * r), blackbody(T + rand() * dT).map((v) => v * k * (0.5 + rand())));
  };
  // SMC: unregelmäßig, junge Sterne, NGC 346 als rosa Knoten
  blob(bags.own, smc, Math.round(4000 * det), 1.0, 1.1, 5200, 5000, 0.6);
  hof(bags.own, smc, 6500, 0.3, 4.2);
  for (let i = 0; i < 6; i++) star(bags.own, smc.clone().add(new THREE.Vector3(gauss(rand), gauss(rand) * 0.5, gauss(rand)).multiplyScalar(0.7)), PINK.map((v) => v * 7), 0.16);
  const dwarfPos = DWARFS.map(([name, l, b, d, type]) => ({ name, type, p: at(l, b, d), kid: ['M32', 'M110', 'NGC 185', 'NGC 147'].includes(name) || name.startsWith('Andromeda') }));
  for (const dw of dwarfPos) {
    const ty = DTYPE[dw.type], bag = dw.kid ? bags.kids : bags.own;
    const r = dw.name === 'M32' ? 0.3 : ty.r[0] + rand() * (ty.r[1] - ty.r[0]);
    hof(bag, dw.p, ty.T, ty.glow * (dw.name === 'M32' ? 3 : 1), r * 3);
    blob(bag, dw.p, Math.round(ty.n * det) + 30, r * 0.5, dw.type === 'S' ? 1.2 : 1.8, dw.type === 'I' ? 4500 : 3900, dw.type === 'I' ? 9000 : 1200, 0.8);
    if (dw.type === 'I') for (let i = 0; i < 3; i++) star(bag, dw.p.clone().add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(r * 0.4)), PINK.map((v) => v * 5), 0.14);
  }
  const cloud = (b) => { const g = new THREE.Group(); g.add(keep(pointCloud(b.pos, b.col, b.size, { min: 1.1 })), keep(lightBlobs(b.hp, b.hc, b.hs), glows)); return g; };
  scene.add(cloud(bags.own));
  const kids = cloud(bags.kids);
  scene.add(kids);

  // Gezeitenströme (Modell). Magellan-Strom: Großkreis mit Pol (l, b) = (188,5°, −7,5°) durch die LMC (Nidever et al. 2008),
  // nachlaufend bis L_MS ≈ −140° über den südlichen galaktischen Pol, Leading Arm bis ≈ +60° nach Norden (zusammen > 200°,
  // Nidever et al. 2010); Entfernung entlang des Stroms nicht gemessen – hier 50 kpc an den Wolken bis ≈ 100 kpc am Ende.
  // Neutraler Wasserstoff, nur im Radiolicht (21 cm) sichtbar → Falschfarbe
  const P = dirLB(188.5, -7.5), D0 = dirLB(280.47, -32.89);
  const E1 = D0.clone().addScaledVector(P, -D0.dot(P)).normalize(), E2 = new THREE.Vector3().crossVectors(P, E1);
  const ms = (L, d) => helio(E1.clone().multiplyScalar(Math.cos(L * RAD)).addScaledVector(E2, Math.sin(L * RAD)), d);
  const mid = lmc.clone().lerp(smc, 0.4);
  const HI = [0.35, 0.75, 0.95];
  const msPath = [mid, ...Array.from({ length: 14 }, (_, i) => ms(-10 * (i + 1), 50 + 3.6 * (i + 1)))];
  const laPath = [lmc, ...Array.from({ length: 6 }, (_, i) => ms(10 * (i + 1), 50 - 2.5 * (i + 1)))];
  const gas = new THREE.Group();
  gas.add(keep(streamCloud(msPath, { n: Math.round(5000 * det), width: [2, 6], seed: 61, color: HI, k: 0.22, size: 0.25, gas: 0.3 })));
  gas.add(keep(streamCloud(laPath, { n: Math.round(1600 * det), width: [1.5, 4], seed: 62, color: HI, k: 0.25, size: 0.25, gas: 0.35 })));
  gas.add(keep(streamCloud([smc, smc.clone().lerp(lmc, 0.5).add(new THREE.Vector3(0, -1.5, 0)), lmc], { n: Math.round(900 * det), width: [0.8, 1.4], seed: 63, color: HI, k: 0.4, size: 0.2, gas: 0.3 })));
  streams.push(gas);
  // Sagittarius-Strom: Bahnebene durch Zentrum, Zwerggalaxie und Sonne (fast polar, Majewski et al. 2003), Ellipsen mit
  // Perizentrum ≈ 16 kpc und Apozentren 47 kpc (vorlaufend) bzw. 100 kpc (nachlaufend; Belokurov et al. 2014)
  const sgr = dwarfPos[0].p;
  const sn = new THREE.Vector3().crossVectors(sgr, SUN).normalize();
  const s1 = sgr.clone().normalize(), s2 = new THREE.Vector3().crossVectors(sn, s1);
  if (s2.y < 0) s2.negate();   // vorlaufend nach Norden: die Zwerggalaxie läuft auf die Scheibe zu
  const orbit = (ra, th) => 2 / (1 / 16 + 1 / ra + (1 / 16 - 1 / ra) * Math.cos(th + 0.6));
  const sgrPath = (ra, sign, turns) => Array.from({ length: Math.round(18 * turns) + 1 }, (_, i) => {
    const th = sign * (i / 18) * 2 * Math.PI;
    return i ? s1.clone().multiplyScalar(Math.cos(th)).addScaledVector(s2, Math.sin(th)).multiplyScalar(orbit(ra, th)) : sgr.clone();
  });
  const stellar = new THREE.Group();
  const OLD = blackbody(4600);
  stellar.add(keep(streamCloud(sgrPath(47, 1, 1.1), { n: Math.round(4500 * det), width: [0.8, 3], seed: 64, color: OLD, k: 0.35, size: 0.1, gas: 0.05 })));
  stellar.add(keep(streamCloud(sgrPath(100, -1, 1.2), { n: Math.round(5500 * det), width: [0.8, 4], seed: 65, color: OLD, k: 0.35, size: 0.1, gas: 0.05 })));
  // Andromedas Riesen-Sternstrom (Ibata et al. 2001): südlich der Scheibe, ≈ 100 kpc lang, das ferne Ende rund 100 kpc
  // hinter M31 (McConnachie et al. 2003) – Bahn als Modell
  const los = m31pos.clone().sub(SUN).normalize();
  const ea = new THREE.Vector3().crossVectors(los, UP).normalize(), eb = new THREE.Vector3().crossVectors(ea, los).normalize();
  const gssAt = (s, a, l) => m31pos.clone().addScaledVector(eb, -s).addScaledVector(ea, a).addScaledVector(los, l);
  const gssPath = [gssAt(4, 2, 0), gssAt(22, 3, 18), gssAt(42, 6, 48), gssAt(60, 10, 95)];
  const gss = keep(streamCloud(gssPath, { n: Math.round(3500 * det), width: [1.5, 6], seed: 66, color: OLD, k: 0.3, size: 0.12, gas: 0.05 }));
  kids.add(gss);
  streams.push(stellar, gss);   // der Andromeda-Strom hängt an `kids` (läuft mit M31) und schaltet mit
  scene.add(gas, stellar);

  // ferne Hintergrund-Galaxien (2–6 Mpc), schwach – geben dem Raum Tiefe
  const bp = [], bc = [], bs = [];
  for (let i = 0; i < Math.round(2600 * det); i++) {
    const dir = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(2000 + rand() * 4000);
    bp.push(dir.x, dir.y, dir.z);
    bc.push(...blackbody(4200 + rand() * 2500).map((v) => v * 1.4 * (0.3 + rand())));
    bs.push(8 + rand() * 14);
  }
  const back = keep(pointCloud(bp, bc, bs, { min: 1.0, max: 6, fade: 5 }));
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

  // Zukunft: Bahn von M31 relativ zur Milchstraße (Milchstraße bleibt im Ursprung); Begleiter und Strom ziehen mit
  const track = futureTrack(m31pos);
  const tMax = track.length - 1;
  const trackLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(track), new THREE.LineBasicMaterial({ color: 0x33ccff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  trackLine.visible = false;
  scene.add(trackLine);
  // Vorbeiflug an Galaxien auf der Fahrt hinein zur Milchstraße (nur im Flug sichtbar)
  const flyby = createFlyby(galaxyAtlas());
  scene.add(flyby.group);
  let future = 0, labelsOn = false, streamsOn = true;
  const m31Kids = dwarfPos.filter((d) => d.kid);
  const kidBase = m31Kids.map((d) => d.p.clone());
  const gssMark = gssAt(30, 4, 30), gssBase = gssMark.clone();
  function setFuture(myr) {
    future = Math.min(myr, tMax);
    const p = track[Math.round(future)], delta = p.clone().sub(track[0]);
    m31.position.copy(p);
    m31pos.copy(p);
    kids.position.copy(delta);
    m31Kids.forEach((d, i) => d.p.copy(kidBase[i]).add(delta));
    gssMark.copy(gssBase).add(delta);
    trackLine.visible = future > 0;
  }

  // Zeitraffer der Sternentstehung (mitrotierendes System der Spiralmuster)
  let T = 0, spdIdx = 1, playing = !ctx.still;
  registerLayers('local', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Sternentstehung im Zeitraffer', value: spdIdx, min: 0, max: SPEEDS.length - 1, step: 1, autoplay: !ctx.still,
      fmt: (i) => SPEEDS[Math.round(i)][1], set: (i, p) => { spdIdx = Math.round(i); playing = p; }, get: () => ({ value: spdIdx, playing }),
      status: () => `Arme stehen, Sterne ziehen hindurch · +${Math.round(T).toLocaleString('de-DE')} Mio. Jahre · ${playing ? SPEEDS[spdIdx][1] : 'angehalten'}` },
    { id: 'glow', type: 'toggle', group: 'Galaxien', label: 'Diffuses Licht, Bulge und Staubbahnen', value: true, set: (v) => { glows.forEach((o) => { o.visible = v; }); } },
    { id: 'young', type: 'toggle', label: 'Junge Sterne und HII-Regionen', value: true, set: (v) => { young.forEach((o) => { o.visible = v; }); } },
    { id: 'halo', type: 'toggle', label: 'Halo der Milchstraße mit Kugelsternhaufen', value: true, set: (v) => { halo.visible = v; } },
    { id: 'streams', type: 'toggle', group: 'Gezeitenströme (Modell)', label: 'Magellan-, Sagittarius- und Andromeda-Strom', value: true,
      set: (v) => { streamsOn = v; streams.forEach((o) => { o.visible = v; }); } },
  ]);

  const SGR_MARK = sgrPath(100, -1, 1.2)[8];
  const hotspots = [
    { id: 'mw', kind: 'dive', to: 'galaxy', pos: new THREE.Vector3(0, 0, 0) },
    { id: 'm31', kind: 'info', pos: m31pos },
    { id: 'm33', kind: 'info', pos: m33pos },
    { id: 'lmc', kind: 'info', pos: lmc },
    { id: 'mstream', kind: 'info', pos: ms(-70, 75), visible: () => streamsOn,
      info: { t: 'Magellan-Strom', x: 'Ein Band aus Wasserstoffgas, das die Magellanschen Wolken hinter sich herziehen – mit dem vorauslaufenden Arm über 200° quer über den Südhimmel. Es leuchtet nur im Radiolicht (21 cm) und ist hier in Falschfarbe gezeigt; seine Entfernung ist nicht gemessen (Bahn als Modell).', s: 'Nidever et al. 2010, ApJ 723, 1618' } },
    { id: 'sgrstream', kind: 'info', pos: SGR_MARK, visible: () => streamsOn,
      info: { t: 'Sagittarius-Strom', x: 'Die Sagittarius-Zwerggalaxie wird von der Milchstraße zerrissen. Ihre Sterne liegen als Band fast senkrecht zur Scheibe um die Galaxis; die Umkehrpunkte der beiden Arme liegen rund 47 und 100 kpc (150.000 und 330.000 Lj) vom Zentrum. Bahn als Modell.', s: 'Belokurov et al. 2014, MNRAS 437, 116' } },
    { id: 'gss', kind: 'info', pos: gssMark, visible: () => streamsOn,
      info: { t: 'Andromedas Riesen-Sternstrom', x: 'Ein Band aus Sternen südlich von Andromeda, das weit hinter die Galaxie reicht: die Reste einer Begleitgalaxie, die Andromeda verschluckt hat. Bahn als Modell.', s: 'Ibata et al. 2001, Nature 412, 49' } },
    { id: 'bound', kind: 'info', pos: bary.clone().add(new THREE.Vector3(0, 1000, 0)), visible: () => bound.visible },
    { id: 'future', kind: 'info', pos: m31pos, visible: () => future > 0 },
    { id: 'tarantula', kind: 'label', cls: 'hsl--faint', pos: tarantulaW, visible: () => labelsOn,
      info: { t: 'Tarantelnebel (30 Doradus)', x: 'Eines der hellsten Sternentstehungsgebiete der Lokalen Gruppe, in der Großen Magellanschen Wolke – im Bild der rosa Lichtfleck am Ende des Balkens (Lage im Modell).' } },
    { id: 'ngc604', kind: 'label', cls: 'hsl--faint', pos: ngc604W, visible: () => labelsOn,
      info: { t: 'NGC 604', x: 'Riesige HII-Region im Dreiecksnebel M33: Gas, das von vielen jungen, heißen Sternen zum Leuchten gebracht wird (Lage im Modell).' } },
    ...dwarfPos.map((d) => ({ id: `dw-${d.name}`, kind: 'label', cls: 'hsl--faint', pos: d.p, visible: () => labelsOn,
      info: { t: d.name, x: `${d.name}: ${{ S: 'sphäroidale', E: 'elliptische', I: 'irreguläre' }[d.type]} Zwerggalaxie der Lokalen Gruppe, ${Math.round(d.p.distanceTo(SUN) * 3.2616).toLocaleString('de-DE')} Tsd. Lj von der Sonne (McConnachie 2012).`, s: 'mcconnachie-2012' } })),
  ];
  const controls = [
    { id: 'labels', label: 'Namen', value: 'off', options: [['off', 'Aus'], ['on', 'Zwerggalaxien + Grenze']], set: (v) => { labelsOn = v === 'on'; bound.visible = labelsOn; } },
    { id: 'future', label: 'Zukunft', type: 'range', min: 0, max: Math.floor(tMax / 100) * 100, step: 20, value: 0, fmt: (v) => (v ? `+${(v / 1000).toFixed(1).replace('.', ',')} Mrd. J.` : 'heute'), set: (v) => setFuture(v) },
  ];
  // Blick über die Milchstraße hinweg auf Andromeda: beide auf einer Linie, die Kamera darüber (Abstand oben/unten
  // statt links/rechts, damit das Bild auch im Hochformat trägt)
  const u = m31pos.clone().normalize();
  const side = new THREE.Vector3().crossVectors(u, UP).normalize();
  const lift = new THREE.Vector3().crossVectors(side, u).normalize();
  const target = u.clone().multiplyScalar(170);
  let home = { pos: u.clone().multiplyScalar(-210).addScaledVector(lift, 135).addScaledVector(side, 45), target };
  // Screenshots: ?view=mw | m31 | m33 | lmc setzt die Heimpose nah an die Galaxie
  const view = new URLSearchParams(location.search).get('view');
  const near = { mw: [mw, 48], m31: [m31, 80], m33: [m33, 34], lmc: [lmcG, 26] }[view];
  if (near) {
    const [g, d] = near, n = UP.clone().applyQuaternion(g.quaternion), s = new THREE.Vector3(1, 0, 0.3).cross(n).normalize();
    home = { pos: g.position.clone().addScaledVector(n.addScaledVector(s, 0.8).normalize(), d), target: g.position.clone() };
  }

  return {
    scene, camera, unit: KPC, hotspots, controls, home,
    orbit: { minDistance: 30, maxDistance: 4500, cineSpeed: 0.5 },
    pass: flyby,
    // Shader des Vorbeiflugs schon beim Laden binden (compileAsync übergeht Unsichtbares) – kein Hänger beim ersten Flug
    ready: (async () => { flyby.group.visible = true; await ctx.renderer.compileAsync(scene, camera); flyby.group.visible = false; })(),
    look: { exposure: 1.15, bloom: 0.09, sat: 1.08, con: 0.12 },
    update(dt) {
      if (playing) T += dt * SPEEDS[spdIdx][0];
      for (const m of timed) m.uniforms.uT.value = T;
    },
    live: () => (future > 0
      ? `In ${(future / 1000).toFixed(1).replace('.', ',')} Mrd. Jahren: Andromeda ${Math.round(m31pos.length() * 3.2616).toLocaleString('de-DE')} Tsd. Lj entfernt${future >= tMax ? ' · erster Vorbeiflug, danach Verschmelzung (Modellende)' : ''}`
      : `Heute: Andromeda ${Math.round(m31pos.length() * 3.2616 / 10) / 100} Mio. Lj entfernt, nähert sich mit 109 km/s · Modell: nächste Begegnung in ≈ ${(tMax / 1000).toFixed(1).replace('.', ',')} Mrd. Jahren`),
    setPixelRatio(pr, H) {
      for (const o of px) o.userData.setPx(pr, H, camera.fov);
    },
    dispose: () => disposeScene(scene),
  };
}
