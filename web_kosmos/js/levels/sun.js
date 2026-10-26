// Station 02B: Sonne aus der Nähe (Einheit 1 R☉ = 695.700 km), Abstecher vom Sonnensystem. Heimpose knapp über dem
// Sonnenrand: Scheibe unten, darüber Koronaschleifen und Protuberanzen vor dem All. Start mit dem Look „Glut“ (sunlook.js:
// Glutkruste, Rand und Ausbrüche wie in der Vorschau „Sonne neu“, künstlerisch), dazu vier Kanäle wie beim Sonnenobservatorium
// SDO (Shader in sunfx.js, uChan): Weißlicht (Photosphäre mit Granulation, Flecken, Randverdunkelung; Korona wie bei einer
// Finsternis) · 171 Å Fe IX ≈ 0,6 Mio. K (goldene Koronaschleifen, Scheibe dunkel, Rand hell) · 304 Å He II ≈ 50.000 K
// (Chromosphäre als Plasmateppich aus sunlook.js: Netzwerk, Protuberanzen hell, Filamente dunkel) · 193 Å Fe XII ≈ 1,3 Mio. K (heiße Korona, koronale Löcher
// dunkel). Aktive Regionen = Fleckengruppen; ihre Koronaschleifen verbinden Vorläufer- und Nachfolgerfleck (Bipol) und drehen
// mit der Rate ihrer Breite (Snodgrass & Ulrich 1990), Flecken, Löcher und Filamente wandern im Shader differentiell mit.
// Modell, kein Foto: Lage und Zahl der Strukturen sind ausgedacht; Rotation, Schleifen, Protuberanzen und Flares im Zeitraffer.
// Im Look (Glut, 304 Å) sind Bögen, Protuberanzen und die Fäden der Ausbrüche 3D-Fadenbündel (sunstrands.js), die in der
// Oberfläche wurzeln; Rand und Korona-Schein rechnet die Atmosphären-Tafel je Pixel (LOOK_ATMO_* in sunlook.js).

import * as THREE from 'three';
import { mulberry32, eclDir } from '../astro.js';
import { createStarfield } from '../stars.js';
import { BODY_VERT } from '../planetfx.js';
import { SUN_FRAG, BILLBOARD_VERT, BILLBOARD_AIM_VERT, CORONA_FRAG, LOOP_VERT, LOOP_FRAG, CME_FRAG, CLOOP_VERT, CLOOP_FRAG, HOLES, FILS, loopsGeometry, spotGroups, streamerSet, coronalLoopsGeometry } from '../sunfx.js';
import { registerLayers, refreshLayers } from '../layers.js';
import { LOOK_SURF_FRAG, LOOK_ATMO_VERT, LOOK_ATMO_FRAG, LOOK_EXT, ERUPT_T, lookDefines } from '../sunlook.js';
import { STRAND_VERT, STRAND_FRAG, strandUniforms, strandGeometry, arcadeLoops, prominenceLoops, flareArcade, eruptLoop, loopField } from '../sunstrands.js';

const RAD = Math.PI / 180;
const R_SUN = 6.957e8;   // m (nasa-sun: 695.700 km)
const Y = new THREE.Vector3(0, 1, 0);
// Rotationsrate [°/Tag] in der Breite lat [rad] (Snodgrass & Ulrich 1990) – dieselbe Formel wie im Shader
const omega = (lat) => { const s2 = Math.sin(lat) ** 2; return 14.713 - 2.396 * s2 - 1.787 * s2 * s2; };
const latOf = (v) => Math.asin(THREE.MathUtils.clamp(v.y / v.length(), -1, 1));
// Scheiben (Werte für ?ctl=chan:171): Shader-Nummer, Look-Oberfläche (sunlook.js: 0 Glut, 1 Plasmateppich), Farbscheibe
// (SDO-Falschfarbe), Schichten im Schichtschnitt, Erklärzeile
const CH = [
  { v: 'glut', n: 0, look: 0, name: 'Glut', on: [], shows: 'keine einzelne Schicht, ein künstlerisches Bild',
    disc: 'radial-gradient(circle, #5a1a04 0%, #2a0a02 46%, #b8400c 80%, #ffb24a 94%, #3a0e02 100%)',
    cap: '<b>Glut · künstlerisch</b> – kein Messbild: Die dunkle Kruste mit glühenden Adern zeigt, wie Magnetfelder das Plasma dort bündeln, wo die Sonne aktiv ist. Kruste, Rand, Ausbruch und Bögen stellst du im Zahnrad ein.' },
  { v: 'wl', n: 0, name: 'Weißlicht', on: [0], shows: 'die Photosphäre',
    disc: 'radial-gradient(circle, #fff4d8 0%, #f6c66e 55%, #c8701e 92%, #7a3a0c 100%)',
    cap: '<b>Weißlicht · Photosphäre · 5.772 K</b> – die sichtbare Oberfläche: brodelnde Granulation, dunkle Flecken, zum Rand hin dunkler. Darum die Korona, wie sonst nur bei einer totalen Finsternis.' },
  { v: '171', n: 1, name: '171 Å', on: [2, 3], shows: 'Übergangsregion und ruhige Korona',
    disc: 'radial-gradient(circle, #fbe9a0 0%, #d9b030 50%, #7d5e0a 88%, #2a1f02 100%)',
    cap: '<b>171 Å · Eisen IX · ≈ 0,6 Mio. K</b> – goldene Koronaschleifen: heißes Plasma folgt den Magnetfeldbögen über aktiven Regionen; die Scheibe wirkt dunkel, der Rand hell.' },
  { v: '304', n: 2, look: 1, name: '304 Å', on: [1, 2], shows: 'Chromosphäre und Übergangsregion',
    disc: 'radial-gradient(circle, #ffb07a 0%, #e0582a 50%, #8a2408 88%, #2e0802 100%)',
    cap: '<b>304 Å · Helium II · ≈ 50.000 K</b> – Chromosphäre: helles Netzwerk, Fackelfelder über aktiven Regionen, Protuberanzen leuchten über dem Rand, Filamente liegen als dunkle Fäden auf der Scheibe.' },
  { v: '193', n: 3, name: '193 Å', on: [3], shows: 'die heiße Korona',
    disc: 'radial-gradient(circle, #f0d2a0 0%, #b98545 52%, #5e3a14 88%, #1e1206 100%)',
    cap: '<b>193 Å · Eisen XII · ≈ 1,3 Mio. K</b> – heiße Korona: aktive Regionen hell, koronale Löcher als dunkle Flecken; aus ihnen strömt schneller Sonnenwind.' },
];
const chOf = (v) => CH.find((c) => c.v === v) || CH[0];
const LAYERS = ['Photo&shy;sphäre', 'Chromo&shy;sphäre', 'Über&shy;gangs&shy;region', 'Korona'];
// Aktivität: Name, Zahl der Fleckengruppen (aktive Regionen), Winkelradius der polaren Löcher [rad], Flare-Takt (Faktor), Glut
// (Helligkeit von Kruste, Adern, Rand und Fäden im Look); „sehr hoch“ und „extrem“ sind künstlerisch überhöht
const ACT = [['Minimum', 0, 0.55, 0, 1], ['niedrig', 1, 0.45, 0.3, 1], ['mittel', 2, 0.34, 0.6, 1], ['hoch', 4, 0.22, 1, 1], ['Maximum', 6, 0.12, 1.5, 1.2],
  ['sehr hoch', 6, 0.1, 2, 1.6], ['extrem', 6, 0.08, 2.6, 2.2]];
// Zeitraffer der Rotation [Tage je Sekunde]
const SPEEDS = [[0, 'Stopp'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s'], [3, '3 Tage/s']];
// Look: Rand und Ausbruch (Zahnrad, Glut und 304 Å)
const RIMS = ['aus', 'Flammenkranz', 'Bogen-Arkaden', 'feiner Saum'];
const SPICULE_H = [0, 0.006, 0.012, 0.02];   // Höhe der Spikulen je Rand [R☉] (echt ≈ 0,007–0,014)
const ERUPTS = ['Filament-Eruption', 'Flare mit Schockwelle', 'Protuberanz reißt ab'];
// Look: Bögen über die ganze Sonne (loopField), Fuß der Fäden (uFoot in sunstrands.js), Glut über „Maximum“ (applyGlow)
const FIELDS = ['aus', 'feiner Kranz', 'gestaffelt', 'Nester'];
const FEET = ['Kante', 'Fibrillen', 'Kelch', 'Strudel'];
const GLOWS = ['Rotglut', 'Strahlenkranz', 'Weißglut'];
const TEXS = ['Adern', 'Zellnetz', 'Plasmafell', 'SDO-Komposit'];   // Kruste im Look „Glut“ (uTex in sunlook.js)
const fmtDays = (d) => `${d.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Tage`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,240,220,0.45)');
  grd.addColorStop(1, 'rgba(255,220,180,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.002, 400);
  scene.add(createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.7, seed: 31, tex: ctx.tex }));
  const stars = scene.children[0];
  // Bewegung reduziert (ctx.still): Brodeln, Schleifen, Protuberanzen mit 20 % Tempo, keine Flares von selbst
  const ta0 = ctx.still ? 0.2 : 1;
  const rand = mulberry32(29);

  // ---------- Heimpose: Kamera 0,25 R☉ über der Oberfläche, Blick über den Rand ----------
  // Q = oberster Randpunkt aus Sicht der Kamera (Tangente in der y-z-Ebene), Blickziel knapp darüber
  const C0 = new THREE.Vector3(0, 0.55, 1.12);
  const aL = Math.acos(1 / C0.length());   // Winkel Kamerafußpunkt → Rand
  const bQ = Math.atan2(C0.y, C0.z) + aL;
  const Q = new THREE.Vector3(0, Math.sin(bQ), Math.cos(bQ));
  const home = { pos: C0.clone(), target: Q.clone().multiplyScalar(1.06) };
  // Screenshots: ?view=disk zeigt die ganze Scheibe (Blick aus 3 R☉ auf die Mitte, Hauptregion am oberen Rand)
  if (new URLSearchParams(location.search).get('view') === 'disk') { home.pos.setLength(3); home.target.set(0, 0, 0); }

  // ---------- Ausrichtung: Pol nach links geneigt, sodass der Rand oben durch die Breite der Hauptregion läuft ----------
  const spots = spotGroups(rand);
  if (spots[0].y < 0) { spots[0].y *= -1; spots[1].y *= -1; }
  const lat0 = latOf(new THREE.Vector3(spots[0].x + spots[1].x, spots[0].y + spots[1].y, spots[0].z + spots[1].z));
  const P = Q.clone().multiplyScalar(Math.sin(lat0)).add(new THREE.Vector3(-Math.cos(lat0), 0, 0)).normalize();
  const sunG = new THREE.Group();
  sunG.quaternion.setFromUnitVectors(Y, P);
  scene.add(sunG);
  const qInv = sunG.quaternion.clone().invert();
  // Punkte der sichtbaren Kappe im Sonnen-System: a = Winkel vom Kamerafußpunkt, b = Richtung (0 = zum oberen Rand)
  const dC = C0.clone().normalize().applyQuaternion(qInv), dQ = Q.clone().applyQuaternion(qInv);
  const e1 = dQ.clone().addScaledVector(dC, -dQ.dot(dC)).normalize(), e2 = new THREE.Vector3().crossVectors(dC, e1);
  const capPt = (a, b) => dC.clone().multiplyScalar(Math.cos(a)).addScaledVector(e1, Math.cos(b) * Math.sin(a)).addScaledVector(e2, Math.sin(b) * Math.sin(a)).normalize();
  // Fleckengruppe auf einen Punkt der Kappe drehen (Lage zueinander bleibt)
  const moveGroup = (k, to) => {
    const m = new THREE.Vector3(spots[2 * k].x + spots[2 * k + 1].x, spots[2 * k].y + spots[2 * k + 1].y, spots[2 * k].z + spots[2 * k + 1].z).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(m, to);
    for (const s of [spots[2 * k], spots[2 * k + 1]]) { const v = new THREE.Vector3(s.x, s.y, s.z).applyQuaternion(q); s.set(v.x, v.y, v.z, s.w); }
  };
  moveGroup(0, capPt(aL - 4 * RAD, 0));          // Hauptregion: Schleifen ragen über den Rand
  moveGroup(1, capPt(aL - 13 * RAD, -0.6));      // zweite Gruppe auf der sichtbaren Scheibe
  const spotW = spots.map((s) => s.w);

  // ---------- Photosphäre bzw. Kanalbild ----------
  const holes = Array.from({ length: HOLES }, () => new THREE.Vector4());
  const holeBase = [
    { d: new THREE.Vector3(0, 1, 0), r: 0 }, { d: new THREE.Vector3(0, -1, 0), r: 0 },    // polar, Größe je Aktivität
    { d: capPt(aL - 16 * RAD, 1.1), r: 0.13 },                                          // sichtbar, niedrige Breite
    { d: new THREE.Vector3(Math.cos(-20 * RAD), Math.sin(-20 * RAD), 0).applyAxisAngle(Y, rand() * Math.PI * 2), r: 0.17 },
  ];
  const fils = Array.from({ length: FILS }, () => new THREE.Vector4()), filT = Array.from({ length: FILS }, () => new THREE.Vector4());
  const filBase = [];
  const addFil = (c, psi, L, w) => {
    const t = e2.clone().multiplyScalar(Math.cos(psi)).addScaledVector(e1, Math.sin(psi));
    t.addScaledVector(c, -t.dot(c)).normalize();
    filBase.push({ c, t, L, w });
  };
  addFil(capPt(aL - 9 * RAD, 0.5), 0.25, 0.11, 0.012);
  for (let k = 1; k < FILS; k++) {
    const lat = (k === FILS - 1 ? 58 : 22 + rand() * 25) * RAD * (rand() < 0.5 ? 1 : -1), lon = rand() * Math.PI * 2;
    const c = new THREE.Vector3(-Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat));
    const east = new THREE.Vector3().crossVectors(Y, c).normalize();
    filBase.push({ c, t: east.applyAxisAngle(c, (rand() - 0.5) * 0.8), L: 0.08 + rand() * 0.12, w: 0.008 + rand() * 0.006 });
  }
  const sunU = {
    tSun: { value: ctx.tex('sun.jpg') }, uGain: { value: 2.2 }, uTime: { value: 0 }, uDays: { value: 0 }, uGran: { value: 1 },
    uFine: { value: ctx.detail > 0.7 ? 1 : 0 }, uSpot: { value: spots }, uChan: { value: 0 }, uAct: { value: 0.75 },
    uHole: { value: holes }, uFil: { value: fils }, uFilT: { value: filT },
  };
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 96), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: SUN_FRAG, uniforms: sunU }));
  sunG.add(sun);
  // Look „Sonne neu“ (Glut, 304 Å): eigenes Material auf derselben Kugel, gleiche Daten (Regionen, Löcher, Filamente, Rotation)
  const sunMat = sun.material;
  const lookU = { uTime: sunU.uTime, uDays: sunU.uDays, uSpot: sunU.uSpot, uHole: sunU.uHole, uFil: sunU.uFil, uFilT: sunU.uFilT, uAct: { value: 0.75 },
    uSurf: { value: 0 }, uGain: { value: 0.8 }, uFlK: { value: -1 }, uFlS: { value: new THREE.Vector3(0, 0, 1) }, uGlow: { value: 1 }, uHot: { value: 0 }, uTex: { value: 1 } };
  const lookMat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: LOOK_SURF_FRAG, uniforms: lookU, defines: lookDefines(ctx.detail) });

  // ---------- Koronaschleifen je aktiver Region (171/193 Å), drehen mit der Rate ihrer Breite ----------
  const cloopU = { uTime: { value: 0 }, uChan: { value: 0 }, uGain: { value: 1 }, uDens: { value: 1 }, uFlareT: { value: 1e3 }, uFlareP: { value: new THREE.Vector3(0, 0, 1e3) } };
  const cloopMat = new THREE.ShaderMaterial({ vertexShader: CLOOP_VERT, fragmentShader: CLOOP_FRAG, uniforms: cloopU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const regions = [];
  for (let k = 0; k < spots.length / 2; k++) {
    const a = new THREE.Vector3(spots[2 * k].x, spots[2 * k].y, spots[2 * k].z), b = new THREE.Vector3(spots[2 * k + 1].x, spots[2 * k + 1].y, spots[2 * k + 1].z);
    const mid = a.clone().add(b).normalize();
    const n = Math.round((k === 0 ? 70 : 40) + 40 * ctx.detail);
    const mesh = new THREE.Mesh(coronalLoopsGeometry(a, b, n, rand), cloopMat);
    mesh.frustumCulled = false;
    sunG.add(mesh);
    regions.push({ mesh, mid, lat: latOf(mid), a, b });
  }

  // ---------- Look (Glut, 304 Å): Bögen, weitere Arkaden, Protuberanzen und Ausbrüche als 3D-Fäden (sunstrands.js) ----------
  // eigener Zufall, damit Flecken, Löcher, Protuberanzen und Streamer an denselben Stellen bleiben wie in den Kanalbildern;
  // Lage der Bögen (rs) unabhängig von der Qualität, nur die Fäden je Bogen (eigener Zufall je Mesh) hängen an ihr
  const rs = mulberry32(73);
  const thr = ctx.detail > 0.9 ? 3 : ctx.detail > 0.7 ? 2 : 1;   // Fäden je Bogen nach Qualität
  const strandU = strandUniforms();
  const strandMat = new THREE.ShaderMaterial({ vertexShader: STRAND_VERT, fragmentShader: STRAND_FRAG, uniforms: strandU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  // hohe Bögen nicht unter der Heimkamera (sie stünden sonst als unscharfes Band im Bild); rotY = Drehung des Meshes
  const clearOfHome = (rotY = 0) => (L) => L.h < 0.12 || L.a.clone().add(L.b).normalize().applyAxisAngle(Y, rotY).angleTo(dC) > 28 * RAD;
  let meshSeed = 101;
  const strandMesh = (loopsList, mat = strandMat) => {
    const m = new THREE.Mesh(strandGeometry(loopsList, mulberry32(meshSeed++)), mat);
    m.frustumCulled = false;
    sunG.add(m);
    return m;
  };
  regions.forEach((r, k) => { r.look = strandMesh(arcadeLoops(r.a, r.b, k === 0 ? 24 : 14, rs, { size: 0.8, threads: thr }).filter(clearOfHome())); });
  // Rand „Bogen-Arkaden“: weitere Arkaden in den Aktivitätsgürteln, zwei davon am oberen Rand der Heimpose
  const arcSites = [capPt(aL + 1.5 * RAD, 0.6), capPt(aL + 0.5 * RAD, -0.55)];
  for (let k = 0; k < 7; k++) {
    const lat = (8 + rs() * 24) * RAD * (rs() < 0.5 ? 1 : -1), lon = rs() * Math.PI * 2;
    arcSites.push(new THREE.Vector3(-Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat)));
  }
  const arcX = strandMesh(arcSites.flatMap((c) => {
    const e = new THREE.Vector3().crossVectors(Y, c).normalize().applyAxisAngle(c, (rs() - 0.5) * 0.6), sep = (2.5 + rs() * 3) * RAD;
    return arcadeLoops(c.clone().addScaledVector(e, sep).normalize(), c.clone().addScaledVector(e, -sep).normalize(), 10, rs, { size: 0.85, I: 0.8, threads: thr });
  }).filter(clearOfHome()));

  // ---------- Protuberanzen (304 Å hell, Weißlicht Hα-rosa wie im Sonnensystem) ----------
  const loopG = loopsGeometry(10 + Math.round(6 * ctx.detail), rand);
  const loopU = { uTime: { value: 0 }, uRate: { value: 1 }, uGain: { value: 2.6 }, uBurstT: { value: 1e3 }, uBurstSeed: { value: -1 }, uSunR: { value: 1 }, uSunC: { value: new THREE.Vector3() }, uChan: { value: 0 } };
  const loops = new THREE.Mesh(loopG, new THREE.ShaderMaterial({ vertexShader: LOOP_VERT, fragmentShader: LOOP_FRAG, uniforms: loopU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  loops.frustumCulled = false;
  sunG.add(loops);
  // eine kleinere Protuberanz knapp hinter den sichtbaren Rand drehen (im Profil vor dem All; große wirken so nah unscharf)
  const promAt = capPt(aL + 3 * RAD, 0.75), promMeta = loopG.userData.meta;
  const small = promMeta.slice(2).filter((m) => m.apex.length() < 1.14);
  const promNear = (small.length ? small : promMeta.slice(2)).reduce((m, x) => (Math.abs(latOf(x.dir) - latOf(promAt)) < Math.abs(latOf(m.dir) - latOf(promAt)) ? x : m));
  const lonOf = (v) => Math.atan2(v.z, -v.x);
  const promOff = lonOf(promAt) - lonOf(promNear.dir);
  const PROM_RATE = omega(15 * RAD);
  // Protuberanzen und Ausbruch mit eigenem Material (Zahnrad „Dichte“ dünnt nur die Bögen aus); Zeit, Pixel, Farbe gemeinsam
  const strandMat2 = (u) => { Object.assign(u, { uTime: strandU.uTime, uPx: strandU.uPx, uPal: strandU.uPal, uGain: strandU.uGain, uFoot: strandU.uFoot, uMove: strandU.uMove,
    uLifeR: strandU.uLifeR });
    return new THREE.ShaderMaterial({ vertexShader: STRAND_VERT, fragmentShader: STRAND_FRAG, uniforms: u, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }); };
  const promLook = strandMesh(prominenceLoops(promMeta, rs, 5 + 2 * thr).filter(clearOfHome(promOff)), strandMat2(strandUniforms()));
  // Ausbruch im Look: Fadenbündel, bei jedem Auslösen neu gebaut (Fußpunkte mitdrehend wie erupt.g, Breite evLat)
  const evU = strandUniforms();
  const ev = new THREE.Mesh(new THREE.BufferGeometry(), strandMat2(evU));
  ev.frustumCulled = false;
  ev.visible = false;
  sunG.add(ev);
  let evLat = 0;
  // Bögen über die ganze Sonne (Zahnrad „Bögen auf der ganzen Sonne“): eigenes Material, „Menge“ dünnt nach Bogen-seed aus;
  // drehen mit der Rate bei 15° Breite wie die weiteren Arkaden
  const fieldU = strandUniforms();
  fieldU.uDisk.value = 0.6;
  const field = new THREE.Mesh(new THREE.BufferGeometry(), strandMat2(fieldU));
  field.frustumCulled = false;
  sunG.add(field);
  let fieldKind = 0;
  function setField(k) {
    if (k === fieldKind) return;
    fieldKind = k;
    field.geometry.dispose();
    field.geometry = k ? strandGeometry(loopField(k, mulberry32(211 + k), thr).filter(clearOfHome()), mulberry32(311 + k), 28) : new THREE.BufferGeometry();
  }

  // ---------- Korona + Chromosphäre als Bildtafel; Streamer über den aktiven Regionen ----------
  const CORONA_EXT = 6;
  const streamers = streamerSet(rand);
  regions.forEach((r, i) => { if (streamers[i]) streamers[i].dir.copy(r.mid); });
  const coronaU = { uTime: { value: 0 }, uExt: { value: CORONA_EXT }, uSize: { value: CORONA_EXT }, uGain: { value: 1.0 }, uLimb: { value: 1 }, uCorona: { value: 1 }, uChromo: { value: 2.0 },
    uPole: { value: new THREE.Vector2(0, 1) }, uStr: { value: streamers.map(() => new THREE.Vector3()) }, uChan: { value: 0 }, uPolar: { value: 0.4 } };
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: BILLBOARD_AIM_VERT, fragmentShader: CORONA_FRAG, uniforms: coronaU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  corona.frustumCulled = false;
  corona.renderOrder = -1;
  scene.add(corona);
  // Look: Atmosphäre (Chromosphäre, Spikulen, Flammen, Hecken, Korona-Schein) und 2D-Teile der Ausbrüche als Bildtafel;
  // ohne Tiefentest, weil die Tafel durch die Sonnenmitte geht – sie rechnet die Kugel selbst (Strahl je Pixel)
  const rimU = { uTime: coronaU.uTime, uSurf: lookU.uSurf, uExt: { value: LOOK_EXT }, uSize: { value: LOOK_EXT }, uGain: { value: 0.8 },
    uRim: { value: 2 }, uSpH: { value: SPICULE_H[2] }, uCor: { value: 1 }, uE: { value: 1 }, uEK: { value: -1 }, uEB: { value: 0 }, uEDir: { value: new THREE.Vector2(0, 1) },
    uESp: { value: new THREE.Vector2() }, uSunInv: { value: new THREE.Matrix3() }, uAR: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) } };
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: LOOK_ATMO_VERT, fragmentShader: LOOK_ATMO_FRAG, uniforms: rimU,
    defines: lookDefines(ctx.detail), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
  rim.frustumCulled = false;
  scene.add(rim);

  // ---------- Flare + Massenauswurf ----------
  const cmeU = { uSize: { value: 1 }, uK: { value: 0 }, uGain: { value: 1.1 }, uSide: { value: 1 }, uTime: { value: 0 }, uDir: { value: new THREE.Vector2(1, 0) } };
  const cme = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: BILLBOARD_VERT, fragmentShader: CME_FRAG, uniforms: cmeU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  cme.frustumCulled = false;
  cme.visible = false;
  scene.add(cme);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  flash.visible = false;
  scene.add(flash);
  const FLASH = [[1.6, 1.5, 1.4], [1.6, 1.35, 0.8], [1.6, 0.9, 0.55], [1.5, 1.2, 0.9]];
  const cmeState = { t: 1e3, dir: new THREE.Vector3(), from: new THREE.Vector3(), foot: new THREE.Vector3() };

  // ---------- Zustand ----------
  let chan = 'glut', lookOn = true, rimIdx = 2, eruptIdx = 0, actIdx = 3, nAct = ACT[3][1], spdIdx = 1, rotOn = false, days = 0;
  let granOn = true, spotsOn = true, promOn = true, flaresOn = true, flareRate = 1, cloopsOn = true, holesOn = true, coronaOn = true;
  let flareTimer = 10 + rand() * 10, glowMode = 2, loopGain = 1;
  const look = { exposure: 1.0, bloom: 0.12 };
  // Glut je Aktivität (ACT[i][4]): 0 Rotglut (Kruste und Adern) · 1 Strahlenkranz (Rand, Korona-Schein, Bloom) · 2 Weißglut
  // (Adern gelbweiß, alles heller); unterhalb „hoch“ kaum Unterschied
  function applyGlow() {
    const g = ACT[actIdx][4];
    const [gs, ga, gb, hot] = glowMode === 0 ? [g, Math.sqrt(g), Math.sqrt(g), 0] : glowMode === 1 ? [Math.sqrt(g), g ** 1.4, g ** 1.3, 0]
      : [g, g, g, THREE.MathUtils.clamp((g - 1.1) / 1.2, 0, 1)];
    lookU.uGlow.value = gs; lookU.uHot.value = hot; rimU.uGain.value = 0.8 * ga; strandU.uGain.value = g ** 0.7 * loopGain; look.bloom = 0.12 * gb;
  }
  const regionWorld = (r, out, h = 1) => out.copy(r.mid).multiplyScalar(h).applyAxisAngle(Y, omega(r.lat) * days * RAD).applyQuaternion(sunG.quaternion);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const facing = (p, cam) => tmp.copy(cam.position).sub(p).normalize().dot(tmp2.copy(p).normalize());

  // Look: ein Ausbruch je ERUPT_T s. Filament (A) und Protuberanz (C) am sichtbaren Rand über einer aktiven Region oder unter
  // der Bildmitte, Flare (B) auf der sichtbaren Scheibe nahe dem Rand – jeweils möglichst nah an der Bildmitte.
  const erupt = { k: -1, type: 0, g: new THREE.Vector3(), dir: new THREE.Vector3() };
  const ndc = new THREE.Vector3(), awW = new THREE.Vector3(), fwd = new THREE.Vector3();
  function limbOf(cam, dir, out) {   // sichtbarer Randpunkt (Tangentenpunkt) in Richtung dir
    const d = cam.position.length();
    awW.copy(cam.position).multiplyScalar(-1 / d);
    out.copy(dir).addScaledVector(awW, -dir.dot(awW));
    if (out.lengthSq() < 1e-6) return null;
    return out.normalize().multiplyScalar(Math.sqrt(Math.max(1 - 1 / (d * d), 0))).addScaledVector(awW, -1 / d);
  }
  const screenScore = (p, cam) => { ndc.copy(p).project(cam); return Math.abs(ndc.x) < 0.9 && Math.abs(ndc.y) < 0.9 ? -(ndc.x * ndc.x + ndc.y * ndc.y) : -10; };
  const toG = (w, out) => { out.copy(w).normalize().applyQuaternion(qInv); return out.applyAxisAngle(Y, -omega(latOf(out)) * days * RAD); };
  function triggerLook(cam) {
    cam.updateMatrixWorld();
    const type = eruptIdx, cands = regions.slice(0, Math.max(nAct, 1)).map((r) => regionWorld(r, new THREE.Vector3()));
    fwd.set(0, 0, -1).transformDirection(cam.matrixWorld);
    if (type !== 1) cands.push(fwd.clone());
    else {   // Flare: dazu der Punkt der Scheibe etwas unter der Bildmitte (Heimpose: Scheibe unten)
      const d = ndc.set(0, -0.35, 0.5).unproject(cam).sub(cam.position).normalize(), b = cam.position.dot(d), h = b * b - cam.position.lengthSq() + 1;
      if (h > 0) cands.push(cam.position.clone().addScaledVector(d, -b - Math.sqrt(h)));
    }
    let best = null, bs = -Infinity;
    for (const c of cands) {
      const f = facing(c, cam);
      const p = type === 1 ? (f > 0.08 ? c : null) : limbOf(cam, c.clone().normalize(), new THREE.Vector3());
      if (!p) continue;
      const s = screenScore(p, cam) - (type === 1 ? Math.abs(f - 0.3) : 0);
      if (s > bs) { bs = s; best = p; }
    }
    if (!best) best = limbOf(cam, fwd, new THREE.Vector3()) || new THREE.Vector3(0, 1, 0);
    erupt.type = type;
    erupt.k = 0;
    if (type === 1) toG(best, erupt.g); else erupt.dir.copy(best);
    cmeState.foot.copy(best).multiplyScalar(1.003);
    buildEvent(type, best, cam);
    cmeState.t = 0;
    flareTimer = ERUPT_T / Math.min(1, Math.max(flareRate * ACT[actIdx][3], 0.05));
  }

  // Fäden des Ausbruchs: A Filament (Modus 1) und C Protuberanz (3) zwischen zwei Fußpunkten entlang des Rands (waagerecht im
  // Bild), B Flare-Arkade (2) über den Bändern um erupt.g; alles im mitdrehenden System der Breite evLat
  const qEv = new THREE.Quaternion(), tanW = new THREE.Vector3();
  function buildEvent(type, best, cam) {
    const S = type === 1 ? erupt.g : toG(best, new THREE.Vector3());
    evLat = latOf(S);
    let list;
    if (type === 1) {
      list = flareArcade(Math.round(10 + 3 * thr), rs);
      const e1 = new THREE.Vector3().crossVectors(Y, S).normalize();
      evU.uFS.value.copy(S); evU.uFE1.value.copy(e1); evU.uFE2.value.crossVectors(S, e1);
    } else {
      tanW.copy(best).normalize().cross(tmp.copy(best).sub(cam.position)).normalize();
      qEv.setFromAxisAngle(Y, -omega(evLat) * days * RAD).multiply(qInv);
      list = eruptLoop(type === 0 ? 1 : 3, S, tanW.applyQuaternion(qEv), rs, type === 0 ? 8 + 3 * thr : 8 + 3 * thr);
    }
    ev.geometry.dispose();
    ev.geometry = strandGeometry(list, mulberry32(meshSeed++), 56);
    evU.uMode.value = [1, 2, 3][type];
  }

  function triggerFlare(cam) {
    if (lookOn) { triggerLook(cam); return; }
    // aktive Region, bevorzugt sichtbar und nahe am Rand (dort am eindrucksvollsten)
    const list = regions.slice(0, Math.max(nAct, 1));
    let best = list[0], bs = -Infinity;
    for (const r of list) {
      const f = facing(regionWorld(r, cmeState.foot, 1.003), cam);
      const s = f > -0.1 ? 1 - Math.abs(f - 0.25) : -1 + f;
      if (s > bs) { bs = s; best = r; }
    }
    regionWorld(best, cmeState.foot, 1.003);
    cmeState.dir.copy(cmeState.foot).normalize();
    cmeState.from.copy(cmeState.dir).multiplyScalar(1.15);
    cmeState.t = 0;
    cloopU.uFlareP.value.copy(cmeState.foot).multiplyScalar(1.05);
    cloopU.uFlareT.value = 0;
    cme.visible = true;
    flash.visible = true;
    flareTimer = (24 + rand() * 30) / (flareRate * Math.max(ACT[actIdx][3], 0.05));
  }

  function applyRegions() {
    const showLoops = cloopsOn && (chan === '171' || chan === '193');
    regions.forEach((r, k) => {
      const on = k < nAct;
      r.mesh.visible = showLoops && on;
      r.look.visible = lookOn && on && cloopsOn;
      for (const i of [2 * k, 2 * k + 1]) spots[i].w = on ? (spotsOn ? spotW[i] : -spotW[i]) : 0;
      if (streamers[k]) streamers[k].on = on ? 1 : 0.25;
    });
    holeBase.forEach((h, i) => { const r = i < 2 ? ACT[actIdx][2] : h.r; holes[i].set(h.d.x, h.d.y, h.d.z, holesOn ? r : 0); });
    filBase.forEach((f, i) => { fils[i].set(f.c.x, f.c.y, f.c.z, promOn ? f.L : 0); filT[i].set(f.t.x, f.t.y, f.t.z, f.w); });
    coronaU.uPolar.value = ACT[actIdx][2] / 0.55;
    sunU.uAct.value = Math.min(actIdx / 4, 1);
    lookU.uAct.value = actIdx / 4;
    loops.visible = promOn && !lookOn;
    promLook.visible = promOn && lookOn;
    arcX.visible = lookOn && rimIdx === 2 && cloopsOn;
    field.visible = lookOn && cloopsOn && fieldKind > 0;
  }
  function setChan(v) {
    const c = chOf(v), n = c.n;
    chan = c.v;
    lookOn = c.look !== undefined;
    sun.material = lookOn ? lookMat : sunMat;
    lookU.uSurf.value = c.look ?? 0;
    rim.visible = lookOn;
    corona.visible = !lookOn;
    if (lookOn) { cme.visible = flash.visible = false; if (erupt.k < 0) flareTimer = Math.min(flareTimer, 2.5); } else erupt.k = -1;
    sunU.uChan.value = coronaU.uChan.value = cloopU.uChan.value = n;
    loopU.uChan.value = n;
    strandU.uPal.value = c.look ?? 0;
    sunU.uGain.value = n ? 1 : 2.2;
    sunU.uGran.value = !n && granOn ? 1 : 0;
    coronaU.uCorona.value = !n && coronaOn ? 1 : 0;
    coronaU.uChromo.value = n ? 0 : 2.0;
    cmeU.uGain.value = n ? 0.6 : 1.1;
    flash.material.color.setRGB(...FLASH[n]);
    applyRegions();
  }
  function setActivity(i) { actIdx = Math.round(i); nAct = ACT[actIdx][1]; applyRegions(); applyGlow(); }

  // ---------- Ebenen (Zahnrad „Station · Sonne“, Zeitleiste) ----------
  registerLayers('sun', [
    { id: 'rot', type: 'play', group: 'Zeit', label: 'Rotation im Zeitraffer', value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, playing) => { spdIdx = Math.round(i); rotOn = playing; }, get: () => ({ value: spdIdx, playing: rotOn }),
      status: () => (rotOn ? `Sonnenrotation · ${fmtDays(days)} vergangen` : `Sonnenrotation angehalten · ${fmtDays(days)}`) },
    { id: 'gran', type: 'toggle', group: 'Oberfläche', label: 'Granulation (brodelnde Oberfläche)', value: true, set: (v) => { granOn = v; sunU.uGran.value = v && chan === 'wl' ? 1 : 0; } },
    { id: 'spots', type: 'toggle', label: 'Sonnenflecken', value: true, set: (v) => { spotsOn = v; applyRegions(); } },
    { id: 'tex', type: 'range', label: 'Kruste (Glut)', value: 1, min: 0, max: TEXS.length - 1, step: 1, fmt: (i) => TEXS[Math.round(i)], set: (v) => { lookU.uTex.value = Math.round(v); } },
    { id: 'glow', type: 'range', label: 'Glut ab „sehr hoch“', value: glowMode, min: 0, max: GLOWS.length - 1, step: 1, fmt: (i) => GLOWS[Math.round(i)], set: (v) => { glowMode = Math.round(v); applyGlow(); } },
    { id: 'rim', type: 'range', label: 'Rand (Glut, 304 Å)', value: rimIdx, min: 0, max: RIMS.length - 1, step: 1, fmt: (i) => RIMS[Math.round(i)], set: (v) => { rimIdx = Math.round(v); rimU.uRim.value = rimIdx; rimU.uSpH.value = SPICULE_H[rimIdx]; applyRegions(); } },
    { id: 'prom', type: 'toggle', group: 'Ausbrüche', label: 'Protuberanzen und Filamente', value: true, set: (v) => { promOn = v; applyRegions(); } },
    { id: 'flares', type: 'toggle', label: 'Flares mit Massenauswurf', value: true, set: (v) => { flaresOn = v; if (!v) { cme.visible = flash.visible = ev.visible = false; erupt.k = -1; } } },
    { id: 'erupt', type: 'range', label: 'Ausbruch (Glut, 304 Å)', value: eruptIdx, min: 0, max: ERUPTS.length - 1, step: 1, fmt: (i) => ERUPTS[Math.round(i)], sub: true, set: (v) => { eruptIdx = Math.round(v); } },
    { id: 'flareRate', type: 'range', label: 'Häufigkeit', value: 1, min: 0.3, max: 3, step: 0.1, unit: '×', sub: true, set: (v) => { flareRate = v; } },
    { id: 'flareNow', type: 'action', label: 'Flare mit Massenauswurf', button: 'Jetzt auslösen', sub: true, run: () => { if (flaresOn) triggerFlare(camera); } },
    { id: 'cloops', type: 'toggle', group: 'Korona', label: 'Magnetbögen und Koronaschleifen', value: true, set: (v) => { cloopsOn = v; applyRegions(); } },
    { id: 'cloopDens', type: 'range', label: 'Dichte', value: 1, min: 0.2, max: 1, step: 0.1, fmt: (v) => `${Math.round(v * 100)} %`, sub: true, set: (v) => { cloopU.uDens.value = strandU.uDens.value = v; } },
    { id: 'holes', type: 'toggle', label: 'Koronale Löcher', value: true, set: (v) => { holesOn = v; applyRegions(); } },
    { id: 'corona', type: 'toggle', label: 'Korona und Streamer', value: true, set: (v) => { coronaOn = v; coronaU.uCorona.value = v && chan === 'wl' ? 1 : 0; rimU.uCor.value = v ? 1 : 0; } },
    { id: 'field', type: 'range', group: 'Bögen und Flares', label: 'Bögen auf der ganzen Sonne', value: 2, min: 0, max: FIELDS.length - 1, step: 1, fmt: (i) => FIELDS[Math.round(i)], set: (v) => { setField(Math.round(v)); applyRegions(); } },
    { id: 'fieldAmt', type: 'range', label: 'Menge', value: 1, min: 0.1, max: 1, step: 0.1, fmt: (v) => `${Math.round(v * 100)} %`, sub: true, set: (v) => { fieldU.uDens.value = v; } },
    { id: 'loopSize', type: 'range', label: 'Höhe der Bögen', value: 1, min: 0.5, max: 2, step: 0.1, unit: '×', sub: true, set: (v) => { strandU.uScale.value = fieldU.uScale.value = v; } },
    { id: 'loopGain', type: 'range', label: 'Leuchtkraft der Bögen', value: 1, min: 0.3, max: 2.5, step: 0.1, unit: '×', sub: true, set: (v) => { loopGain = v; applyGlow(); } },
    { id: 'foot', type: 'range', label: 'Fuß der Bögen', value: 1, min: 0, max: FEET.length - 1, step: 1, fmt: (i) => FEET[Math.round(i)], set: (v) => { strandU.uFoot.value = Math.round(v); } },
    { id: 'life', type: 'toggle', label: 'Werden und Vergehen', value: true, set: (v) => { strandU.uMove.value.z = v ? 1 : 0; } },
    { id: 'lifeRate', type: 'range', label: 'Tempo', value: 1, min: 0.3, max: 3, step: 0.1, unit: '×', sub: true, set: (v) => { strandU.uLifeR.value = v; } },
    { id: 'flow', type: 'range', label: 'Strömen', value: 0.5, min: 0, max: 2, step: 0.1, unit: '×', set: (v) => { strandU.uMove.value.x = v; } },
    { id: 'sway', type: 'range', label: 'Pendeln', value: 0.5, min: 0, max: 2, step: 0.1, unit: '×', set: (v) => { strandU.uMove.value.y = v; } },
  ]);

  // ---------- Infotafel: Kanal, Aktivität, Zeitraffer, Flare ----------
  const LAY = (c) => `<div class="sw-cut" role="img" aria-label="Schichtschnitt, schematisch: ${c.name} zeigt ${c.shows}">${LAYERS.map((l, i) => `<span${c.on.includes(i) ? ' class="is-on"' : ''}>${l}</span>`).join('')}</div>
    <p class="sw-axis">von der Oberfläche nach außen →</p><p class="sw-cap">${c.cap}</p>`;
  const controls = [
    { id: 'chan', type: 'swatch', label: 'Wellenlänge · Schicht', value: 'glut', options: CH.map((c) => [c.v, c.name, c.disc]), set: setChan, detail: (v) => LAY(chOf(v)) },
    { id: 'act', type: 'range', label: 'Aktivität', value: actIdx, min: 0, max: ACT.length - 1, step: 1, fmt: (i) => ACT[Math.round(i)][0], set: setActivity },
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: rotOn ? spdIdx : 0, min: 0, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (v) => { if (v) { spdIdx = v; rotOn = true; } else rotOn = false; refreshLayers(); }, get: () => (rotOn ? spdIdx : 0) },
    { id: 'flare', type: 'action', label: 'Ereignis', button: 'Flare auslösen', run: () => { if (flaresOn) triggerFlare(camera); } },
  ];
  setChan('glut');

  // ---------- Abzeichen: folgen ihren Strukturen; wechseln auf eine sichtbare, wenn sie hinter den Rand drehen ----------
  const H = (id, focus, visible) => ({ id, kind: 'info', pos: new THREE.Vector3(), focus: () => focus, visible });
  const hs = {
    region: H('region', 0.5, (cam) => nAct > 0 && facing(hs.region.pos, cam) > -0.35),
    spots: H('spots', 0.35, (cam) => nAct > 0 && spotsOn && !lookOn && facing(hs.spots.pos, cam) > 0.05),
    gran: H('gran', 0.25, (cam) => !lookOn && facing(hs.gran.pos, cam) > 0.05),
    prom: H('prom', 0.5, () => promOn),
    filament: H('filament', 0.5, (cam) => promOn && chan !== 'glut' && facing(hs.filament.pos, cam) > 0.05),
    hole: H('hole', 0.8, (cam) => holesOn && chan !== 'glut' && facing(hs.hole.pos, cam) > 0.05),
    flare: H('flare', 0.6, (cam) => flaresOn && facing(hs.flare.pos, cam) > -0.3),
    pole: H('pole', 1.2, (cam) => facing(hs.pole.pos, cam) > -0.1),
    wind: H('wind', 3, () => true),
  };
  const hotspots = Object.values(hs);
  const granLocal = capPt(aL - 8 * RAD, -0.25);
  const pickState = { spots: -1, prom: -1, filament: -1, hole: -1 };
  const surfShader = (v, out) => out.copy(v).applyAxisAngle(Y, omega(latOf(v)) * days * RAD).applyQuaternion(sunG.quaternion);
  // Kandidaten im Weltraum; behalten, solange gut sichtbar, sonst den am besten sichtbaren nehmen
  function pick(key, list, keep, score) {
    const i = pickState[key];
    if (i >= 0 && i < list.length && keep(list[i])) return list[i];
    let best = 0, bs = -Infinity;
    list.forEach((p, k) => { const s = score(p); if (s > bs) { bs = s; best = k; } });
    pickState[key] = best;
    return list[best];
  }
  const cand = { spots: [], prom: [], filament: [], hole: [] };
  function placeHotspots(cam) {
    regionWorld(regions[0], hs.region.pos, 1.12);
    cand.spots = regions.slice(0, Math.max(nAct, 1)).map((r) => regionWorld(r, new THREE.Vector3()));
    hs.spots.pos.copy(pick('spots', cand.spots, (p) => facing(p, cam) > 0.15, (p) => facing(p, cam)));
    hs.gran.pos.copy(granLocal).applyQuaternion(sunG.quaternion);
    sunG.updateMatrixWorld(true);
    cand.prom = promMeta.slice(2).map((m) => loops.localToWorld(m.apex.clone()));
    hs.prom.pos.copy(pick('prom', cand.prom, (p) => Math.abs(facing(p, cam)) < 0.3, (p) => -Math.abs(facing(p, cam) - 0.05)));
    cand.filament = filBase.map((f) => surfShader(f.c, new THREE.Vector3()));
    hs.filament.pos.copy(pick('filament', cand.filament, (p) => facing(p, cam) > 0.15, (p) => facing(p, cam)));
    cand.hole = holeBase.map((h) => surfShader(h.d, new THREE.Vector3()));
    hs.hole.pos.copy(pick('hole', cand.hole, (p) => facing(p, cam) > 0.15, (p) => facing(p, cam)));
    if (cmeState.t < 40) hs.flare.pos.copy(cmeState.foot);
    else regionWorld(regions[0], hs.flare.pos, 1.02);
    hs.pole.pos.copy(P);
    hs.wind.pos.copy(Q).multiplyScalar(2.4);
  }
  placeHotspots({ position: home.pos });

  // ---------- je Bild: sichtbarer Rand, Pol und Streamer im Bild ----------
  const vS = new THREE.Vector3(), poleV = new THREE.Vector3(), qStr = new THREE.Quaternion();
  // Achsen der Bildtafel (BILLBOARD_AIM_VERT): w = Kamera → Sonnenmitte, u waagerecht, v senkrecht (im Kamerasystem)
  const aw = new THREE.Vector3(), au = new THREE.Vector3(), av = new THREE.Vector3();
  const onTile = (d) => { const x = d.dot(au), y = d.dot(av); d.set(x, y, 0); return d; };
  function coronaFrame(cam) {
    const dist = cam.position.length();
    coronaU.uLimb.value = dist > 1.02 ? 1 / Math.sqrt(1 - 1 / (dist * dist)) : 5;
    const view = cam.matrixWorldInverse;
    aw.set(0, 0, 0).applyMatrix4(view).normalize();
    au.crossVectors(aw, Math.abs(aw.y) < 0.999 ? Y : new THREE.Vector3(0, 0, 1)).normalize();
    av.crossVectors(au, aw);
    onTile(poleV.copy(P).transformDirection(view));
    const pl = Math.hypot(poleV.x, poleV.y) || 1, px = poleV.x / pl, py = poleV.y / pl;
    coronaU.uPole.value.set(px, py);
    streamers.forEach((s, i) => {
      qStr.copy(sunG.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(Y, omega(latOf(s.dir)) * days * RAD));
      onTile(vS.copy(s.dir).applyQuaternion(qStr).transformDirection(view));
      const l = Math.hypot(vS.x, vS.y);
      coronaU.uStr.value[i].set(Math.atan2(-vS.x * py + vS.y * px, vS.x * px + vS.y * py), s.w, s.amp * (s.on ?? 1) * (0.3 + 0.7 * l));
    });
    if (rim.visible) { lookFrame(cam, view); atmoFrame(); }
  }
  // Look je Bild: Tafel deckt LOOK_EXT Randradien; Ausbruch-Ort auf die Tafel (A, C: Richtung des Randpunkts; B: Fußpunkt,
  // entlang des Sehstrahls auf die Tafelebene projiziert, in Randradien)
  const cv = new THREE.Vector3(), wv = new THREE.Vector3();
  function lookFrame(cam, view) {
    const limb = coronaU.uLimb.value;
    rimU.uSize.value = LOOK_EXT * limb;
    if (erupt.k < 0) return;
    if (erupt.type === 1) {
      surfShader(erupt.g, wv);
      rimU.uEB.value = THREE.MathUtils.smoothstep(facing(wv, cam), -0.05, 0.1);
      cv.set(0, 0, 0).applyMatrix4(view);
      wv.applyMatrix4(view);
      wv.multiplyScalar(cv.dot(aw) / wv.dot(aw)).sub(cv);
      rimU.uESp.value.set(wv.dot(au) / limb, wv.dot(av) / limb);
      lookU.uFlS.value.copy(erupt.g);
    } else {
      onTile(wv.copy(erupt.dir).transformDirection(view));
      rimU.uEDir.value.set(wv.x, wv.y).normalize();
    }
  }
  // Atmosphäre je Bild: Welt → mitdrehende Sonnenkoordinaten (Rate bei 15° Breite) und Richtungen der aktiven Regionen
  const qAt = new THREE.Quaternion(), mAt = new THREE.Matrix4();
  function atmoFrame() {
    qAt.setFromAxisAngle(Y, -PROM_RATE * days * RAD).multiply(qInv);
    rimU.uSunInv.value.setFromMatrix4(mAt.makeRotationFromQuaternion(qAt));
    regions.forEach((r, k) => { const a = rimU.uAR.value[k]; regionWorld(r, tmp); a.set(tmp.x, tmp.y, tmp.z, k < nAct ? 1 : 0); });
  }

  return {
    scene, camera, home, unit: R_SUN, hotspots, controls, look,
    orbit: { minDistance: 0.12, maxDistance: 40, cineSpeed: 0.4 },
    update(dt, t, cam, flying) {
      if (!flying && rotOn) days += dt * SPEEDS[spdIdx][0];
      const ta = t * ta0;
      sunU.uTime.value = ta; sunU.uDays.value = days;
      coronaU.uTime.value = ta; loopU.uTime.value = ta; cloopU.uTime.value = ta; cmeU.uTime.value = ta;
      loops.rotation.y = promLook.rotation.y = promOff + PROM_RATE * days * RAD;
      regions.forEach((r) => { r.mesh.rotation.y = r.look.rotation.y = omega(r.lat) * days * RAD; });
      arcX.rotation.y = field.rotation.y = PROM_RATE * days * RAD;
      strandU.uTime.value = ta;
      strandU.uPx.value = 2 * Math.tan(cam.fov * RAD / 2) / Math.max(ctx.renderer.domElement.height, 1);
      // Nahebene mit dem Abstand zur Oberfläche
      const nr = THREE.MathUtils.clamp((cam.position.length() - 1) * 0.2, 5e-4, 0.05);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
      if (erupt.k >= 0) { erupt.k += dt * ta0 / ERUPT_T; if (erupt.k >= 1) erupt.k = -1; }
      rimU.uEK.value = erupt.k;
      rimU.uE.value = erupt.type + 1;
      lookU.uFlK.value = erupt.type === 1 ? erupt.k : -1;
      ev.visible = lookOn && flaresOn && erupt.k >= 0;
      evU.uK.value = erupt.k;
      ev.rotation.y = omega(evLat) * days * RAD;
      cam.updateMatrixWorld();
      coronaFrame(cam);
      // Flares: Zufallstakt je Aktivität, Schleifen um den Fußpunkt leuchten weich auf, Massenauswurf wandert hinaus
      if (flaresOn && !ctx.still && !flying && ACT[actIdx][3] > 0) { flareTimer -= dt; if (flareTimer <= 0) triggerFlare(cam); }
      cloopU.uFlareT.value = Math.min(cloopU.uFlareT.value + dt * ta0, 1e3);
      cmeState.t += dt * ta0;
      if (cme.visible) {
        const k = cmeState.t / 9;
        if (k >= 1) cme.visible = false;
        else {
          cme.position.copy(cmeState.from).addScaledVector(cmeState.dir, k * 5);
          cmeU.uSize.value = 0.45 + 3.4 * k;
          cmeU.uK.value = k;
          vS.copy(cmeState.dir).transformDirection(cam.matrixWorldInverse);
          const l = Math.hypot(vS.x, vS.y);
          cmeU.uSide.value = Math.min(1, l * 1.3);
          if (l > 1e-4) cmeU.uDir.value.set(vS.x / l, vS.y / l);
        }
      }
      // Flare-Licht am Fußpunkt: weich an (0,6 s) und ab (≈ 1,3 s) – ein Ereignis, kein Blitzen
      if (flash.visible) {
        const ft = cmeState.t, f = THREE.MathUtils.smoothstep(ft, 0, 0.6) * Math.exp(-ft * 0.8) * 1.6;
        flash.position.copy(cmeState.foot);
        flash.scale.setScalar(0.08 + 0.12 * Math.min(ft, 1));
        flash.material.opacity = Math.min(1, f) * THREE.MathUtils.smoothstep(facing(cmeState.foot, cam), -0.05, 0.1);
        if (ft > 6) flash.visible = false;
      }
      placeHotspots(cam);
    },
    // Kamera bleibt über der Oberfläche (die Steuerung kreist um einen Punkt über dem Rand)
    orbitUpdate(c) {
      const r = c.object.position.length();
      if (r < 1.04) c.object.position.multiplyScalar(1.04 / r);
    },
    live: () => `${chOf(chan).name} · Aktivität ${ACT[actIdx][0]} · ${rotOn ? `Zeitraffer ${SPEEDS[spdIdx][1]}` : 'Rotation angehalten'}`,
    setPixelRatio(pr) { stars.userData.setPixelRatio(pr); },
    setDetail(d) { for (const m of [lookMat, rim.material]) { m.defines = lookDefines(d); m.needsUpdate = true; } },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      flash.material.map.dispose();
      lookMat.dispose();
      sunMat.dispose();
    },
  };
}
