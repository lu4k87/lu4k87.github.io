// Station 02B: Sonne aus der Nähe (Einheit 1 R☉ = 695.700 km), Abstecher vom Sonnensystem. Heimpose knapp über dem
// Sonnenrand: Scheibe unten, darüber Koronaschleifen und Protuberanzen vor dem All. Vier Kanäle wie beim Sonnenobservatorium
// SDO (Shader in sunfx.js, uChan): Weißlicht (Photosphäre mit Granulation, Flecken, Randverdunkelung; Korona wie bei einer
// Finsternis) · 171 Å Fe IX ≈ 0,6 Mio. K (goldene Koronaschleifen, Scheibe dunkel, Rand hell) · 304 Å He II ≈ 50.000 K
// (Chromosphäre: Netzwerk, Protuberanzen hell, Filamente dunkel) · 193 Å Fe XII ≈ 1,3 Mio. K (heiße Korona, koronale Löcher
// dunkel). Aktive Regionen = Fleckengruppen; ihre Koronaschleifen verbinden Vorläufer- und Nachfolgerfleck (Bipol) und drehen
// mit der Rate ihrer Breite (Snodgrass & Ulrich 1990), Flecken, Löcher und Filamente wandern im Shader differentiell mit.
// Modell, kein Foto: Lage und Zahl der Strukturen sind ausgedacht; Rotation, Schleifen, Protuberanzen und Flares im Zeitraffer.

import * as THREE from 'three';
import { mulberry32, eclDir } from '../astro.js';
import { createStarfield } from '../stars.js';
import { BODY_VERT } from '../planetfx.js';
import { SUN_FRAG, BILLBOARD_VERT, BILLBOARD_AIM_VERT, CORONA_FRAG, LOOP_VERT, LOOP_FRAG, CME_FRAG, CLOOP_VERT, CLOOP_FRAG, HOLES, FILS, loopsGeometry, spotGroups, streamerSet, coronalLoopsGeometry } from '../sunfx.js';
import { registerLayers, refreshLayers } from '../layers.js';

const RAD = Math.PI / 180;
const R_SUN = 6.957e8;   // m (nasa-sun: 695.700 km)
const Y = new THREE.Vector3(0, 1, 0);
// Rotationsrate [°/Tag] in der Breite lat [rad] (Snodgrass & Ulrich 1990) – dieselbe Formel wie im Shader
const omega = (lat) => { const s2 = Math.sin(lat) ** 2; return 14.713 - 2.396 * s2 - 1.787 * s2 * s2; };
const latOf = (v) => Math.asin(THREE.MathUtils.clamp(v.y / v.length(), -1, 1));
// Kanäle (Werte für ?ctl=chan:171): Shader-Nummer, Farbscheibe (SDO-Falschfarbe), Schichten im Schichtschnitt, Erklärzeile
const CH = [
  { v: 'wl', n: 0, name: 'Weißlicht', on: [0], shows: 'die Photosphäre',
    disc: 'radial-gradient(circle, #fff4d8 0%, #f6c66e 55%, #c8701e 92%, #7a3a0c 100%)',
    cap: '<b>Weißlicht · Photosphäre · 5.772 K</b> – die sichtbare Oberfläche: brodelnde Granulation, dunkle Flecken, zum Rand hin dunkler. Darum die Korona, wie sonst nur bei einer totalen Finsternis.' },
  { v: '171', n: 1, name: '171 Å', on: [2, 3], shows: 'Übergangsregion und ruhige Korona',
    disc: 'radial-gradient(circle, #fbe9a0 0%, #d9b030 50%, #7d5e0a 88%, #2a1f02 100%)',
    cap: '<b>171 Å · Eisen IX · ≈ 0,6 Mio. K</b> – goldene Koronaschleifen: heißes Plasma folgt den Magnetfeldbögen über aktiven Regionen; die Scheibe wirkt dunkel, der Rand hell.' },
  { v: '304', n: 2, name: '304 Å', on: [1, 2], shows: 'Chromosphäre und Übergangsregion',
    disc: 'radial-gradient(circle, #ffb07a 0%, #e0582a 50%, #8a2408 88%, #2e0802 100%)',
    cap: '<b>304 Å · Helium II · ≈ 50.000 K</b> – Chromosphäre: helles Netzwerk, Protuberanzen leuchten über dem Rand, Filamente liegen als dunkle Fäden auf der Scheibe.' },
  { v: '193', n: 3, name: '193 Å', on: [3], shows: 'die heiße Korona',
    disc: 'radial-gradient(circle, #f0d2a0 0%, #b98545 52%, #5e3a14 88%, #1e1206 100%)',
    cap: '<b>193 Å · Eisen XII · ≈ 1,3 Mio. K</b> – heiße Korona: aktive Regionen hell, koronale Löcher als dunkle Flecken; aus ihnen strömt schneller Sonnenwind.' },
];
const chOf = (v) => CH.find((c) => c.v === v) || CH[0];
const LAYERS = ['Photo&shy;sphäre', 'Chromo&shy;sphäre', 'Über&shy;gangs&shy;region', 'Korona'];
// Aktivität: Name, Zahl der Fleckengruppen (aktive Regionen), Winkelradius der polaren Löcher [rad], Flare-Takt (Faktor)
const ACT = [['Minimum', 0, 0.55, 0], ['niedrig', 1, 0.45, 0.3], ['mittel', 2, 0.34, 0.6], ['hoch', 4, 0.22, 1], ['Maximum', 6, 0.12, 1.5]];
// Zeitraffer der Rotation [Tage je Sekunde]
const SPEEDS = [[0, 'Stopp'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s'], [3, '3 Tage/s']];
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
  scene.add(createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.7, seed: 31 }));
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
    regions.push({ mesh, mid, lat: latOf(mid) });
  }

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
  let chan = 'wl', actIdx = 3, nAct = ACT[3][1], spdIdx = 1, rotOn = false, days = 0;
  let granOn = true, spotsOn = true, promOn = true, flaresOn = true, flareRate = 1, cloopsOn = true, holesOn = true, coronaOn = true;
  let flareTimer = 10 + rand() * 10;
  const regionWorld = (r, out, h = 1) => out.copy(r.mid).multiplyScalar(h).applyAxisAngle(Y, omega(r.lat) * days * RAD).applyQuaternion(sunG.quaternion);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const facing = (p, cam) => tmp.copy(cam.position).sub(p).normalize().dot(tmp2.copy(p).normalize());

  function triggerFlare(cam) {
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
      for (const i of [2 * k, 2 * k + 1]) spots[i].w = on ? (spotsOn ? spotW[i] : -spotW[i]) : 0;
      if (streamers[k]) streamers[k].on = on ? 1 : 0.25;
    });
    holeBase.forEach((h, i) => { const r = i < 2 ? ACT[actIdx][2] : h.r; holes[i].set(h.d.x, h.d.y, h.d.z, holesOn ? r : 0); });
    filBase.forEach((f, i) => { fils[i].set(f.c.x, f.c.y, f.c.z, promOn ? f.L : 0); filT[i].set(f.t.x, f.t.y, f.t.z, f.w); });
    coronaU.uPolar.value = ACT[actIdx][2] / 0.55;
    sunU.uAct.value = actIdx / 4;
  }
  function setChan(v) {
    chan = chOf(v).v;
    const n = chOf(v).n;
    sunU.uChan.value = coronaU.uChan.value = loopU.uChan.value = cloopU.uChan.value = n;
    sunU.uGain.value = n ? 1 : 2.2;
    sunU.uGran.value = !n && granOn ? 1 : 0;
    coronaU.uCorona.value = !n && coronaOn ? 1 : 0;
    coronaU.uChromo.value = n ? 0 : 2.0;
    cmeU.uGain.value = n ? 0.6 : 1.1;
    flash.material.color.setRGB(...FLASH[n]);
    applyRegions();
  }
  function setActivity(i) { actIdx = Math.round(i); nAct = ACT[actIdx][1]; applyRegions(); }

  // ---------- Ebenen (Zahnrad „Station · Sonne“, Zeitleiste) ----------
  registerLayers('sun', [
    { id: 'rot', type: 'play', group: 'Zeit', label: 'Rotation im Zeitraffer', value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, playing) => { spdIdx = Math.round(i); rotOn = playing; }, get: () => ({ value: spdIdx, playing: rotOn }),
      status: () => (rotOn ? `Sonnenrotation · ${fmtDays(days)} vergangen` : `Sonnenrotation angehalten · ${fmtDays(days)}`) },
    { id: 'gran', type: 'toggle', group: 'Oberfläche', label: 'Granulation (brodelnde Oberfläche)', value: true, set: (v) => { granOn = v; sunU.uGran.value = v && chan === 'wl' ? 1 : 0; } },
    { id: 'spots', type: 'toggle', label: 'Sonnenflecken', value: true, set: (v) => { spotsOn = v; applyRegions(); } },
    { id: 'prom', type: 'toggle', group: 'Ausbrüche', label: 'Protuberanzen und Filamente', value: true, set: (v) => { promOn = v; loops.visible = v; applyRegions(); } },
    { id: 'flares', type: 'toggle', label: 'Flares mit Massenauswurf', value: true, set: (v) => { flaresOn = v; if (!v) cme.visible = flash.visible = false; } },
    { id: 'flareRate', type: 'range', label: 'Häufigkeit', value: 1, min: 0.3, max: 3, step: 0.1, unit: '×', sub: true, set: (v) => { flareRate = v; } },
    { id: 'flareNow', type: 'action', label: 'Flare mit Massenauswurf', button: 'Jetzt auslösen', sub: true, run: () => { if (flaresOn) triggerFlare(camera); } },
    { id: 'cloops', type: 'toggle', group: 'Korona', label: 'Koronaschleifen (171 Å, 193 Å)', value: true, set: (v) => { cloopsOn = v; applyRegions(); } },
    { id: 'cloopDens', type: 'range', label: 'Dichte', value: 1, min: 0.2, max: 1, step: 0.1, fmt: (v) => `${Math.round(v * 100)} %`, sub: true, set: (v) => { cloopU.uDens.value = v; } },
    { id: 'holes', type: 'toggle', label: 'Koronale Löcher', value: true, set: (v) => { holesOn = v; applyRegions(); } },
    { id: 'corona', type: 'toggle', label: 'Korona und Streamer (Weißlicht)', value: true, set: (v) => { coronaOn = v; coronaU.uCorona.value = v && chan === 'wl' ? 1 : 0; } },
  ]);

  // ---------- Infotafel: Kanal, Aktivität, Zeitraffer, Flare ----------
  const LAY = (c) => `<div class="sw-cut" role="img" aria-label="Schichtschnitt, schematisch: ${c.name} zeigt ${c.shows}">${LAYERS.map((l, i) => `<span${c.on.includes(i) ? ' class="is-on"' : ''}>${l}</span>`).join('')}</div>
    <p class="sw-axis">von der Oberfläche nach außen →</p><p class="sw-cap">${c.cap}</p>`;
  const controls = [
    { id: 'chan', type: 'swatch', label: 'Wellenlänge · Schicht', value: 'wl', options: CH.map((c) => [c.v, c.name, c.disc]), set: setChan, detail: (v) => LAY(chOf(v)) },
    { id: 'act', type: 'range', label: 'Aktivität', value: actIdx, min: 0, max: ACT.length - 1, step: 1, fmt: (i) => ACT[Math.round(i)][0], set: setActivity },
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: rotOn ? spdIdx : 0, min: 0, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (v) => { if (v) { spdIdx = v; rotOn = true; } else rotOn = false; refreshLayers(); }, get: () => (rotOn ? spdIdx : 0) },
    { id: 'flare', type: 'action', label: 'Ereignis', button: 'Flare auslösen', run: () => { if (flaresOn) triggerFlare(camera); } },
  ];
  setChan('wl');

  // ---------- Abzeichen: folgen ihren Strukturen; wechseln auf eine sichtbare, wenn sie hinter den Rand drehen ----------
  const H = (id, focus, visible) => ({ id, kind: 'info', pos: new THREE.Vector3(), focus: () => focus, visible });
  const hs = {
    region: H('region', 0.5, (cam) => nAct > 0 && facing(hs.region.pos, cam) > -0.35),
    spots: H('spots', 0.35, (cam) => nAct > 0 && spotsOn && facing(hs.spots.pos, cam) > 0.05),
    gran: H('gran', 0.25, (cam) => facing(hs.gran.pos, cam) > 0.05),
    prom: H('prom', 0.5, () => promOn),
    filament: H('filament', 0.5, (cam) => promOn && facing(hs.filament.pos, cam) > 0.05),
    hole: H('hole', 0.8, (cam) => holesOn && facing(hs.hole.pos, cam) > 0.05),
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
  }

  const look = { exposure: 1.0, bloom: 0.08 };
  return {
    scene, camera, home, unit: R_SUN, hotspots, controls, look,
    orbit: { minDistance: 0.12, maxDistance: 40, cineSpeed: 0.4 },
    update(dt, t, cam, flying) {
      if (!flying && rotOn) days += dt * SPEEDS[spdIdx][0];
      const ta = t * ta0;
      sunU.uTime.value = ta; sunU.uDays.value = days;
      coronaU.uTime.value = ta; loopU.uTime.value = ta; cloopU.uTime.value = ta; cmeU.uTime.value = ta;
      loops.rotation.y = promOff + PROM_RATE * days * RAD;
      regions.forEach((r) => { r.mesh.rotation.y = omega(r.lat) * days * RAD; });
      // Nahebene mit dem Abstand zur Oberfläche
      const nr = THREE.MathUtils.clamp((cam.position.length() - 1) * 0.2, 5e-4, 0.05);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
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
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      flash.material.map.dispose();
    },
  };
}
