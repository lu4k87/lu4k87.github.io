// Station 02F1: Triton, größter Mond des Neptun (Einheit 1 Triton-Radius = 1.353,4 km), Abstecher von Neptun & Monde.
// Mondfest wie die Station Mond: Triton ist gebunden, Neptun steht still über dem Längengrad 0, Sonne und Sterne ziehen
// über den Himmel. Lage für den Zeitpunkt aus der mittleren Bahn (JPL sats/elem, Ephemeride NEP098, astro.js laplacePos)
// und Neptuns Bahn (JPL): x = Richtung Neptun, y = Nordpol (IAU, Gegenrichtung zum Bahndrehimpuls: die Bahn ist
// rückläufig), Osten = −z wie die Karte. Weil die Bahn 157° gegen Neptuns Äquator geneigt ist und dessen Achse 28°
// gegen seine Sonnenbahn, wandert die Sonne über die Jahrzehnte weit nach Süden und Norden – beide Pole liegen
// abwechselnd im Dauerlicht. Oberfläche: Voyager-2-Mosaik (PIA18668), Norden ab ≈ 45° N in der Karte aufgefüllt (Modell).
// Stickstoff-Geysire als Partikelfahnen (Säule ≈ 8 km, oben vom Wind > 100 km verweht; Soderblom et al. 1990),
// dünner Stickstoff-Dunst als Hülle, Neptun maßstäblich am Himmel (8°) mit Bändern und Neptunschein auf der Nachtseite.

import * as THREE from 'three';
import { PLANETS, julianDate, planetPosition, eclToScene, eclDir, equToScene, laplacePos, laplaceAxes, DAY, AU, R_SUN } from '../astro.js';
import { BODY_VERT, SHELL_VERT, PLANET_FRAG, ATMO_FRAG, ATMOS } from '../planetfx.js';
import { createStarfield } from '../stars.js';
import { createCatalogSky } from '../catalog.js';
import { createFlare } from '../flare.js';
import { settings } from '../settings.js';
import { SKY_VERTEX } from '../glsl.js';
import { registerLayers, refreshLayers } from '../layers.js';
import { moonOrbit } from '../moonsys.js';

const R_T = 1353.4;                                 // km, Einheit der Station (NSSDCA Neptunian Satellite Fact Sheet)
const R_N = 24764 / R_T, RP_N = 24341 / 24764;     // Neptun: Äquatorradius [Triton-Radien], Polradius/Äquatorradius (NSSDCA)
const NEP_POLE = [299.36, 43.46], NEP_ROT = 16.11; // Neptuns Nordpol α/δ J2000 [°], Rotation [h] (wie solar.js)
// Mittlere Bahnelemente Triton (JPL sats/elem, NEP098, Laplace-Ebene = Neptuns Äquator, Epoche J2000); rückläufig
// (i > 90°): Knoten und Apsiden laufen vorwärts → Pw, Pn positiv (Format astro.js laplacePos)
const TRITON = { a: 354800, e: 0, w: 0, M: 63.0, i: 157.3, node: 177.7, P: 5.8792, Pw: 675.2, Pn: 299.4 };
const AXES = laplaceAxes(...NEP_POLE);
const GEY_H = 8 / R_T, GEY_L = 120 / R_T;           // Geysir: Säule ≈ 8 km, Fahne > 100 km (Soderblom 1990; Länge Richtwert)
const RAD = Math.PI / 180, Y = new THREE.Vector3(0, 1, 0);
// Zeitraffer [Tage je Sekunde]; Stufe 0 = Echtzeit. Ein Umlauf (= ein Triton-Tag) dauert 5,88 Tage
const SPEEDS = [[0, 'Echtzeit'], [1 / 144, '10 min/s'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s']];
const VOYAGER = Date.UTC(1989, 7, 25, 9);           // Vorbeiflug von Voyager 2 am 25.08.1989 (Uhrzeit gerundet)
// Breite/Länge [Grad, Ost positiv] → Triton-System (Länge 0 = Richtung Neptun auf +x, Norden +y, Osten −z wie die Karte)
const sel = (lat, lon, r = 1) => new THREE.Vector3(Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.sin(lat * RAD), -Math.cos(lat * RAD) * Math.sin(lon * RAD)).multiplyScalar(r);
const ease = (t) => t * t * (3 - 2 * t);
// Geysire: Lage im Gebiet der Voyager-Funde auf der Südpolkappe (Modell, die genauen Orte stehen nicht in den Quellen),
// Stärke, Windrichtung oben [° von Nord über Ost, angenommen]
const PLUMES = [[-50, 8, 1.0, 250], [-56, 26, 0.8, 250], [-52, 44, 0.9, 245], [-58, 60, 0.6, 255]];

const SUN_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vDir;
void main() {
  float a = acos(clamp(dot(normalize(vDir), uSun), -1.0, 1.0));
  // Aus 30 AE misst die Sonne nur 0,009°: ein gleißender Stern mit dem Lichthof der Optik
  float core = exp(-a * a / 2.0e-6) * 60.0;
  float glow = exp(-a / 0.006) * 2.5 + exp(-a / 0.05) * 0.06;
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * (core + glow), 1.0);
}
`;
const SUN_VERT = /* glsl */ `
${SKY_VERTEX}
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = skyPosition(vDir); }
`;
// Geysir-Teilchen: Säule steigt senkrecht auf (Phase 0…0,28), oben treibt die Wolke mit dem Wind und weitet sich auf.
// Dunkles Material (Soderblom 1990: dunkle Teilchen + Stickstoffeis), beleuchtet nach dem Sonnenstand am Fußpunkt.
const PLUME_VERT = /* glsl */ `
uniform float uTime, uH, uL, uPx;
uniform vec3 uSun;
attribute vec3 aBase, aWind, aSide;
attribute vec4 aRnd;
varying float vA;
varying vec3 vCol;
void main() {
  float ph = fract(uTime * (0.03 + 0.012 * aRnd.w) + aRnd.x);
  vec3 p;
  float size;
  if (ph < 0.28) {
    float k = ph / 0.28;
    float h = uH * pow(k, 0.6);
    p = aBase * (1.0 + h) + (aWind * aRnd.y + aSide * aRnd.z) * 0.0004 * (0.3 + k);
    size = 0.0006 + 0.0008 * k;
  } else {
    float k = (ph - 0.28) / 0.72;
    float h = uH * (1.0 + 0.15 * aRnd.y * k);
    p = normalize(aBase + aWind * uL * k + aSide * aRnd.z * (0.002 + 0.016 * k)) * (1.0 + h);
    size = 0.002 + 0.009 * k;
  }
  vA = aRnd.w * smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.6, 1.0, ph));
  float lit = 0.2 + 0.8 * smoothstep(-0.1, 0.4, dot(aBase, uSun));
  vCol = mix(vec3(0.09, 0.085, 0.08), vec3(0.32, 0.31, 0.3), smoothstep(0.2, 0.9, ph)) * lit;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(size * uPx / -mv.z, 1.0, 48.0);
  gl_Position = projectionMatrix * mv;
}
`;
const PLUME_FRAG = /* glsl */ `
uniform float uAlpha;
varying float vA;
varying vec3 vCol;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  gl_FragColor = vec4(vCol, vA * uAlpha * (1.0 - r2) * (1.0 - r2));
}
`;

// Uniforms für PLANET_FRAG (planetfx.js); paralleles Sonnenlicht über uSunDir
function planetU(map, o = {}) {
  return {
    tMap: { value: map }, tNight: { value: null }, tClouds: { value: null }, tSpec: { value: null }, tRing: { value: null },
    uHasEarth: { value: 0 }, uCloudU: { value: 0 }, uGain: { value: o.gain ?? 1 }, uRing: { value: 0 }, uRingIn: { value: 0 }, uRingOut: { value: 0 },
    uWrap: { value: o.wrap ?? 0 }, uAmb: { value: o.amb ?? 0.004 }, uBand: { value: o.band ?? 0 }, uTime: { value: 0 }, uMoon: { value: o.moon ? 1 : 0 },
    uEarthshine: { value: 0 }, uSunAng: { value: 1e-4 }, uTerm: { value: new THREE.Vector3(...(o.term ?? [1, 1, 1])) },
    uEarthPos: { value: o.earthPos ?? new THREE.Vector3() }, uSunDir: { value: o.sun }, uInv: { value: new THREE.Matrix4() },
    uOcc: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, uOccN: { value: 0 },
  };
}
function atmoShell(a, rp, center, sun, gain = a.gain) {
  return new THREE.Mesh(new THREE.SphereGeometry(rp * a.ra, 96, 48), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: ATMO_FRAG, uniforms: {
    uSun: { value: sun }, uCenter: { value: center }, uBeta: { value: new THREE.Vector3(...a.beta) }, uMieCol: { value: new THREE.Vector3(...a.mieCol) },
    uRp: { value: rp }, uRa: { value: rp * a.ra }, uH: { value: a.h }, uGain: { value: gain }, uMie: { value: a.mie }, uAir: { value: 0 }, uAirH: { value: 0.2 } },
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 6000);
  const nep = PLANETS.find((p) => p.id === 'neptune');
  let jd = julianDate(ctx.date), spdIdx = 2, rate = SPEEDS[spdIdx][0];

  // ---------- Lage: Triton-System (körperfest) ↔ Ekliptik-Szene ----------
  const sun = new THREE.Vector3(), sunE = new THREE.Vector3(), nepPos = new THREE.Vector3(), nepPole = new THREE.Vector3();
  const pT = new THREE.Vector3(), vT = new THREE.Vector3(), x0 = new THREE.Vector3(), P = new THREE.Vector3(), z0 = new THREE.Vector3();
  const mB = new THREE.Matrix4(), qB = new THREE.Quaternion(), qInv = new THREE.Quaternion();
  const state = { lat: 0, nepLit: 0, sunAU: 30, dist: TRITON.a / R_T };
  const scenePos = (t, out) => {
    const [x, y, z] = laplacePos(TRITON, t);
    return out.set(...[0, 1, 2].map((k) => AXES.x[k] * x + AXES.y[k] * y + AXES.z[k] * z));
  };

  // ---------- Himmel: Katalog (Yale BSC) + Milchstraßenband; drehen mit der Lage ----------
  const ngp = new THREE.Vector3(...eclDir(180.02, 29.81)), gc = new THREE.Vector3(...eclDir(266.84, -5.54));
  const sky = new THREE.Group();
  scene.add(sky);
  let catalog = null, pr = 1;
  const ready = createCatalogSky({ gain: 1.8, limit: 6.5 }).then((g) => { catalog = g; sky.add(g); g.userData.setPixelRatio(pr); })
    .catch((err) => {
      console.warn('[kosmos] Sternkatalog nicht geladen, statistischer Himmel:', err);
      catalog = createStarfield({ ngp, gc, gain: 0.8, seed: 17 });
      catalog.userData.setPixelRatio(pr);
      sky.add(catalog);
    });
  sky.add(createStarfield({ count: 1, ngp, gc, gain: 0, band: 1, glint: false, tex: ctx.tex }));
  const sunSky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG,
    uniforms: { uSun: { value: sun } }, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }));
  sunSky.frustumCulled = false;
  sunSky.renderOrder = -9;
  scene.add(sunSky);
  const flare = createFlare({ strength: 0.5 });
  scene.add(flare);

  // ---------- Triton: Voyager-Mosaik, Lommel-Seeliger + Neptunschein, Schatten Neptuns (Finsternis) ----------
  const triU = planetU(ctx.tex('triton.jpg'), { moon: true, earthPos: nepPos, sun, gain: 1.0 });
  triU.uOccN.value = 1;
  const triton = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 96), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: triU }));
  scene.add(triton);
  // Dunst: dünne Stickstoff-Atmosphäre, Hülle 3 % (≈ 40 km) und Helligkeit überzeichnet
  const HAZE = { ra: 1.03, h: 0.3, beta: [0.32, 0.46, 0.85], mie: 0.3, mieCol: [0.9, 0.95, 1.0], gain: 0.9 };
  const haze = atmoShell(HAZE, 1, new THREE.Vector3(), sun);
  scene.add(haze);

  // ---------- Neptun am Himmel (maßstäblich, abgeplattet, Bänder, eigene Drehung um seine Achse) ----------
  const nepHold = new THREE.Group(), nepSpin = new THREE.Group();
  nepHold.add(nepSpin);
  scene.add(nepHold);
  const AN = ATMOS.neptune;
  const nepU = planetU(ctx.tex('neptune.jpg'), { sun, band: 0.45, wrap: AN.wrap, term: AN.term, amb: 0.003 });
  const neptune = new THREE.Mesh(new THREE.SphereGeometry(R_N, 128, 64), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: nepU }));
  neptune.scale.set(1, RP_N, 1);
  nepSpin.add(neptune);
  const nepShell = atmoShell(AN, R_N, nepPos, sun);
  scene.add(nepShell);

  // ---------- Bahn (moonsys.js): Leuchtspur um Neptun, im Triton-System mitgedreht – endet an Triton ----------
  const orbit = moonOrbit(TRITON, AXES, R_T, 0x33ccff, jd, 1.4), orbitLine = new THREE.Group();
  orbitLine.add(orbit.line);
  scene.add(orbitLine);

  // ---------- Geysire: Partikelfahnen ----------
  const perPlume = ctx.detail > 0.7 ? 1400 : 700, nP = PLUMES.length * perPlume;
  const aBase = new Float32Array(nP * 3), aWind = new Float32Array(nP * 3), aSide = new Float32Array(nP * 3), aRnd = new Float32Array(nP * 4);
  const plumePos = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  PLUMES.forEach(([lat, lon, str, az], j) => {
    const n = sel(lat, lon), e = new THREE.Vector3(n.z, 0, -n.x).normalize(), no = new THREE.Vector3().crossVectors(n, e);
    const w = no.clone().multiplyScalar(Math.cos(az * RAD)).addScaledVector(e, Math.sin(az * RAD)), s = new THREE.Vector3().crossVectors(n, w);
    plumePos.push(n);
    for (let k = j * perPlume; k < (j + 1) * perPlume; k++) {
      n.toArray(aBase, k * 3); w.toArray(aWind, k * 3); s.toArray(aSide, k * 3);
      aRnd.set([rnd(), rnd() * 2 - 1, (rnd() + rnd() + rnd() - 1.5) / 1.5, str * (0.6 + 0.4 * rnd())], k * 4);
    }
  });
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nP * 3), 3));
  pg.setAttribute('aBase', new THREE.BufferAttribute(aBase, 3));
  pg.setAttribute('aWind', new THREE.BufferAttribute(aWind, 3));
  pg.setAttribute('aSide', new THREE.BufferAttribute(aSide, 3));
  pg.setAttribute('aRnd', new THREE.BufferAttribute(aRnd, 4));
  const plumeU = { uTime: { value: 0 }, uH: { value: GEY_H * 5 }, uL: { value: GEY_L }, uPx: { value: 500 }, uSun: { value: sun }, uAlpha: { value: 0.22 } };
  const plumes = new THREE.Points(pg, new THREE.ShaderMaterial({ vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG, uniforms: plumeU, transparent: true, depthWrite: false }));
  plumes.frustumCulled = false;
  scene.add(plumes);

  const tmp = new THREE.Vector3();
  function place() {
    sunE.set(...eclToScene(planetPosition(nep, jd)));
    state.sunAU = sunE.length();
    sunE.multiplyScalar(-1 / state.sunAU);                           // Sonne von Neptun (≈ von Triton)
    scenePos(jd, pT);
    vT.copy(scenePos(jd + 0.001, vT)).sub(pT);
    x0.copy(pT).multiplyScalar(-1).normalize();                      // Triton → Neptun = Längengrad 0
    P.crossVectors(pT, vT).multiplyScalar(-1);                       // Nordpol: gegen den Bahndrehimpuls (rückläufig)
    P.addScaledVector(x0, -P.dot(x0)).normalize();
    z0.crossVectors(x0, P);
    mB.makeBasis(x0, P, z0);
    qB.setFromRotationMatrix(mB);
    qInv.copy(qB).invert();
    sun.copy(sunE).applyQuaternion(qInv);
    sky.quaternion.copy(qInv);
    nepPos.set(state.dist, 0, 0);
    nepPole.set(...equToScene(...NEP_POLE)).applyQuaternion(qInv);
    nepHold.position.copy(nepPos);
    nepHold.quaternion.setFromUnitVectors(Y, nepPole);
    nepSpin.rotation.y = (((jd - 2451545) * 24 / NEP_ROT) % 1) * Math.PI * 2;
    state.lat = Math.asin(THREE.MathUtils.clamp(sun.y, -1, 1)) / RAD;
    state.nepLit = (1 - sun.x) / 2;                                  // beleuchteter Anteil Neptuns, von Triton gesehen
    const sunAng = R_SUN / (state.sunAU * AU);
    triU.uSunAng.value = sunAng;
    triU.uOcc.value[0].set(nepPos.x, 0, 0, R_N);
    orbitLine.position.copy(nepPos);
    orbitLine.quaternion.copy(qInv);
    orbit.update(jd, tmp);
  }
  place();

  // ---------- Posen ----------
  // Triton: von der Neptun-abgewandten Seite, seitlich versetzt (Neptun steht hinter dem Rand im Bild), Licht möglichst
  // von der Seite: unter den Versätzen ±20° der mit dem Phasenwinkel am nächsten an 90°; Bildmitte näher an Triton
  function homePose() {
    let best = null;
    for (const az of [-20, 20]) {
      const c = new THREE.Vector3(-Math.cos(az * RAD), 0, Math.sin(az * RAD)).addScaledVector(Y, 0.22).normalize();
      const g = Math.abs(Math.acos(THREE.MathUtils.clamp(c.dot(sun), -1, 1)) - Math.PI / 2);
      if (!best || g < best.g) best = { g, c };
    }
    const pos = best.c.multiplyScalar(5), dN = nepPos.clone().sub(pos).normalize(), dT = pos.clone().multiplyScalar(-1).normalize();
    return { pos, target: pos.clone().addScaledVector(dT.multiplyScalar(0.65).addScaledVector(dN, 0.35).normalize(), 5), up: Y };
  }
  const home = homePose();
  // Neptun am Horizont: 5 km über 20° S, 80° W – Neptun steht dort rund 9° über der Kimm
  const nepView = () => {
    const n = sel(-20, -80), pos = n.clone().multiplyScalar(1.004);
    return { pos, target: nepPos.clone().addScaledVector(n, -R_N * 0.6), up: n };
  };
  // Geysire: 55 km über der Südpolkappe, Blick flach über das Geysirfeld
  const geyView = () => {
    const c = sel(-45, 50), f = sel(-55, 30), pos = c.clone().multiplyScalar(1.04);
    return { pos, target: f.multiplyScalar(1.01), up: c };
  };
  // Bahn: schräg über der Bahnebene – ganzer Bahnkreis um Neptun, Triton (winzig) links auf dem Kreis
  const orbitView = () => ({ pos: new THREE.Vector3(state.dist * 0.15, state.dist * 1.5, state.dist * 1.6), target: new THREE.Vector3(state.dist * 0.45, 0, 0), up: Y });

  // Blick-Wechsel: Kamera gleitet hin (Richtung auf der Kugel, Abstand logarithmisch) und hält, bis der Besucher selbst dreht
  const view = { mode: null, t: 0, from: null };
  function setView(v) {
    view.mode = v === 'triton' ? 'home' : v;
    view.t = 0;
    view.from = null;
  }
  const releaseView = () => { view.mode = null; };
  const canvas = ctx.renderer.domElement;
  canvas.addEventListener('pointerdown', releaseView);
  canvas.addEventListener('wheel', releaseView, { passive: true });
  function goal() {
    if (view.mode === 'neptune') return nepView();
    if (view.mode === 'geysers') return geyView();
    if (view.mode === 'orbit') return orbitView();
    return homePose();
  }
  const qa = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3();
  function blendPos(out, a, b, k) {
    const ra = a.length(), rb = b.length();
    va.copy(a).normalize(); vb.copy(b).normalize();
    qa.setFromUnitVectors(va, vb);
    out.copy(va).applyQuaternion(new THREE.Quaternion().slerp(qa, k)).multiplyScalar(Math.exp(Math.log(ra) + (Math.log(rb) - Math.log(ra)) * k));
  }

  // ---------- Abzeichen ----------
  let showGey = true, showNep = true;
  const facing = (p, cam) => tmp.copy(cam.position).sub(p).normalize().dot(va.copy(p).normalize());
  const surf = (id, lat, lon, focus = 0.9, vis = () => true) => {
    const pos = sel(lat, lon);
    return { id, kind: 'info', pos, focus: () => { releaseView(); return focus; }, visible: (cam) => vis() && cam.position.length() < 30 && facing(pos, cam) > 0.06 };
  };
  // Neptun verdeckt? (Strahl Kamera → Neptun schneidet Triton)
  const hidden = (cam) => {
    const d = vb.copy(nepPos).sub(cam.position), L = d.length();
    d.divideScalar(L);
    const s = -cam.position.dot(d);
    return s > 0 && s < L && cam.position.lengthSq() - s * s < 1;
  };
  const subSun = new THREE.Vector3(), origin = new THREE.Vector3();
  const hotspots = [
    { id: 'neptune', kind: 'info', pos: nepPos, visible: (cam) => showNep && !hidden(cam) },
    { id: 'orbit', kind: 'info', pos: origin, visible: (cam) => cam.position.length() > 30 },
    surf('geysers', -54, 32, 0.35, () => showGey),
    surf('streaks', -38, 20, 0.6),
    surf('cap', -25, -5, 1.2),
    surf('cantaloupe', 20, -35, 0.7),
    surf('north', 62, 0, 1.4),
    { id: 'season', kind: 'info', pos: subSun, focus: () => { releaseView(); return 1.3; }, visible: (cam) => cam.position.length() < 30 && facing(subSun, cam) > 0.06 },
  ];

  // ---------- Schalter der Infotafel ----------
  const yearOf = () => new Date((jd - 2440587.5) * 864e5).getUTCFullYear();
  const controls = [
    { id: 'view', label: 'Blick', value: 'triton', options: [['triton', 'Triton'], ['neptune', 'Neptun am Horizont'], ['geysers', 'Geysire'], ['orbit', 'Bahn']], set: setView },
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: spdIdx, min: 0, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (v) => setSpeed(Math.round(v)), get: () => (rate ? spdIdx : 0) },
    { id: 'year', type: 'range', label: 'Jahr', value: yearOf(), min: 1900, max: 2150, step: 1, fmt: (y) => String(Math.round(y)),
      set: (y) => { jd += (Math.round(y) - yearOf()) * 365.25; }, get: yearOf },
    { id: 'voyager', type: 'action', label: 'Ereignis', button: 'Voyager 2 · 25.08.1989', run: () => {
      jd = julianDate(new Date(VOYAGER));
      setSpeed(1);
      setView('triton');
    } },
  ];
  function setSpeed(i) {
    if (i > 0) { spdIdx = i; rate = SPEEDS[i][0]; } else { rate = 0; jd = julianDate(new Date()); }
    refreshLayers();
  }

  // ---------- Ebenen (Zahnrad „Station · Triton“, Zeitleiste) ----------
  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
  let nshine = 1;
  registerLayers('triton', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', hint: 'Sonne, Sterne und Neptuns Drehung im gewählten Tempo; ein Triton-Tag dauert 5,9 Erdtage. Pause = Echtzeit.',
      value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, autoplay: true, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, playing) => { spdIdx = Math.max(1, Math.round(i)); rate = playing ? SPEEDS[spdIdx][0] : 0; if (!playing) jd = julianDate(new Date()); },
      get: () => ({ value: spdIdx, playing: rate !== 0 }), status: () => `${fmt.format(new Date((jd - 2440587.5) * 864e5))} UTC${rate ? '' : ' · Echtzeit'}` },
    { id: 'geysers', type: 'toggle', group: 'Triton', label: 'Stickstoff-Geysire', value: true, set: (v) => { showGey = v; plumes.visible = v; } },
    { id: 'geyh', type: 'range', label: 'Geysir-Überhöhung', value: 5, min: 1, max: 10, step: 1, unit: '×', sub: true,
      hint: 'Säulen sind echt ≈ 8 km hoch, die Fahnen über 100 km lang. 1× = maßstäblich; die Höhe ist überhöht, damit sie aus der Ferne trägt.',
      set: (v) => { plumeU.uH.value = GEY_H * v; } },
    { id: 'haze', type: 'range', label: 'Dunst', value: 1, min: 0, max: 3, step: 0.25, unit: '×',
      hint: 'Dünne Stickstoff-Atmosphäre als Saum am Rand. Schon 1× ist dicker und heller gezeichnet als in Wirklichkeit.',
      set: (v) => { haze.material.uniforms.uGain.value = HAZE.gain * v; haze.visible = v > 0; } },
    { id: 'nshine', type: 'range', group: 'Licht', label: 'Neptunschein', value: 1, min: 0, max: 3, step: 0.25, unit: '×',
      hint: 'Licht Neptuns auf Tritons Nachtseite, folgt Neptuns Phase. Für die Lesbarkeit aufgehellt.', set: (v) => { nshine = v; } },
    { id: 'neptune', type: 'toggle', group: 'Himmel', label: 'Neptun am Himmel', value: true, set: (v) => { showNep = v; nepHold.visible = v; nepShell.visible = v; } },
    { id: 'orbit', type: 'toggle', label: 'Bahn', value: true, set: (v) => { orbitLine.visible = v; } },
  ]);

  const occluders = [{ center: new THREE.Vector3(), radius: 1 }, { center: nepPos, radius: R_N }];
  const sunFar = new THREE.Vector3();

  return {
    scene, camera, home, unit: R_T * 1e3, hotspots, controls, ready,
    orbit: { minDistance: 0.012, maxDistance: 1600, cineSpeed: 0.5 },
    look: { exposure: 1.0, bloom: 0.06, sat: 1.02 },
    update(dt, t, cam, flying) {
      if (!flying) jd += rate ? dt * rate : dt / DAY;
      place();
      subSun.copy(sun);
      triU.uEarthshine.value = 0.03 * state.nepLit * nshine;
      nepU.uTime.value = t;
      plumeU.uTime.value += ctx.still ? 0 : dt;
      plumeU.uPx.value = canvas.height / (2 * Math.tan(cam.fov * RAD / 2));
      sunFar.copy(sun).multiplyScalar(5000);
      cam.updateMatrixWorld();
      flare.userData.update(sunFar, cam, occluders, settings.S.lens, dt);
    },
    orbitUpdate(c, dt) {
      const o = c.object;
      let free;
      if (view.mode) {
        if (!view.from) { view.from = { pos: o.position.clone(), target: c.target.clone(), up: o.up.clone() }; free = 'free'; }
        const gl = goal();
        view.t = Math.min(1, view.t + dt / (ctx.still ? 0.5 : 2.4));
        const k = ease(view.t);
        blendPos(o.position, view.from.pos, gl.pos, k);
        c.target.copy(view.from.target).lerp(gl.target, k);
        o.up.copy(view.from.up).lerp(gl.up, k).normalize();
        o.lookAt(c.target);
        if (view.mode === 'home' && view.t >= 1) releaseView();
      } else if (o.up.distanceToSquared(Y) > 1e-8) o.up.lerp(Y, Math.min(1, dt * 1.5)).normalize();
      // über der Oberfläche bleiben (≥ 3 km); Nahebene mit der Höhe
      const r = o.position.length();
      if (r < 1.0022) o.position.multiplyScalar(1.0022 / r);
      const nr = THREE.MathUtils.clamp((o.position.length() - 1) * 0.3, 0.0006, 0.5);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
      return free;
    },
    live: () => {
      const lat = Math.round(Math.abs(state.lat));
      return `${fmt.format(new Date((jd - 2440587.5) * 864e5))} UTC · Sonne im Zenit über ${lat}° ${state.lat < 0 ? 'Süd' : 'Nord'} · `
        + `Neptun ${Math.round(state.nepLit * 100)} % beleuchtet · Sonne ${state.sunAU.toLocaleString('de-DE', { maximumFractionDigits: 1 })} AE`;
    },
    setPixelRatio: (p) => { pr = p; if (catalog) catalog.userData.setPixelRatio(p); },
    dispose() {
      canvas.removeEventListener('pointerdown', releaseView);
      canvas.removeEventListener('wheel', releaseView);
      scene.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); });
    },
  };
}
