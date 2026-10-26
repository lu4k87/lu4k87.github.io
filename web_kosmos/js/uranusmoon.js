// Station eines Uranusmondes (Miranda 02G1, Titania 02G2; Etappe E5, docs/plan_ebenen.md). Mondfest wie die Station Triton:
// Der Mond ist gebunden, Uranus steht über dem Längengrad 0 still am Himmel, Sonne und Sterne ziehen einmal je Umlauf herum.
// Lage aus den mittleren JPL-Elementen (URA182, uranus.js MOONS) und der Uranusbahn (JPL): x = Richtung Uranus, y = Nordpol
// (IAU; Uranus und seine Monde drehen rückläufig um ihn, also Gegenrichtung zum Bahndrehimpuls), Osten = −z wie die Karten
// (0° Länge in der Bildmitte, Osten rechts). Körper wahlweise als dreiachsiges Ellipsoid (x zu Uranus, y Pol, z Bahnrichtung).
// Uranus maßstäblich mit Ringen und Ringschatten, Schatten des Mondes auf den Wolken; die übrigen großen Monde maßstäblich an
// ihren Orten. Karten (NASA 3D Resources, USGS/Tammy Becker & JPL/Caltech): Voyager 2 sah 1986 nur die Südhälften, die Masken
// <id>_seen.png (weiß = gesehen) zeigen den Rest als Gradnetz (Schalter „Voyager-2-Abdeckung“). Licht: Start am 24.01.1986
// (Sonne nahe dem Südpol, die kartierte Seite hell), „Heute“ = Zeitpunkt der Seite.
// Modell: Libration und Neigung der Achse gegen die Bahn vernachlässigt, Uranusschein aus Radius, Abstand, Albedo und
// beleuchtetem Anteil (Näherung), Mondschatten auf Uranus mit dem mittleren Radius.

import * as THREE from 'three';
import { PLANETS, julianDate, planetPosition, eclToScene, eclDir, equToScene, laplacePos, laplaceAxes, DAY, AU, R_SUN } from './astro.js';
import { BODY_VERT, SHELL_VERT, PLANET_FRAG, ATMO_FRAG, RING_FRAG, ATMOS } from './planetfx.js';
import { createStarfield } from './stars.js';
import { createCatalogSky } from './catalog.js';
import { createFlare } from './flare.js';
import { settings } from './settings.js';
import { SKY_VERTEX } from './glsl.js';
import { registerLayers, refreshLayers } from './layers.js';
import { ringTexture, ringMesh, moonOrbit, laplaceToScene, tidalQuat } from './moonsys.js';
import { R_U, ROT_H, NORTH, RINGS, RING_IN, RING_OUT, MOONS } from './levels/uranus.js';

const RAD = Math.PI / 180, Y = new THREE.Vector3(0, 1, 0);
const AXES = laplaceAxes(NORTH[0] - 180, -NORTH[1]);   // Laplace-Ebene = Äquator des Uranus, Drehsinn der Monde (wie uranus.js)
const UA = PLANETS.find((p) => p.id === 'uranus');
const P_U = 0.488;                                     // geometrische Albedo des Uranus (NSSDCA Uranus Fact Sheet)
const VOYAGER = Date.UTC(1986, 0, 24, 17);             // Voyager 2 im Uranussystem, 24.01.1986 (Uhrzeit gerundet)
// Zeitraffer [Tage je Sekunde]; Stufe 0 = Echtzeit
const SPEEDS = [[0, 'Echtzeit'], [1 / 144, '10 min/s'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s']];
const ease = (t) => t * t * (3 - 2 * t);
const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
const dateOf = (jd) => new Date((jd - 2440587.5) * 864e5);

const SUN_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vDir;
void main() {
  float a = acos(clamp(dot(normalize(vDir), uSun), -1.0, 1.0));
  // Aus 19 AE misst die Sonne nur 0,014°: ein gleißender Stern mit dem Lichthof der Optik
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
// Voyager-2-Abdeckung: ungesehener Teil leicht getönt mit Gradnetz alle 15°, Grenze als Linie (Breite in Bildpunkten über
// fwidth, Naht der Karte bei u = 0/1 ohne Sprung); leuchtet schwach selbst, damit es auch auf der Nachtseite lesbar bleibt
const SEEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SEEN_FRAG = /* glsl */ `
uniform sampler2D tSeen;
uniform vec3 uCol;
varying vec2 vUv;
void main() {
  float s = texture2D(tSeen, vUv).r;
  vec2 g = vec2(vUv.x * 24.0, vUv.y * 12.0);
  vec2 w = vec2(min(fwidth(vUv.x), fwidth(fract(vUv.x + 0.5))) * 24.0, fwidth(vUv.y) * 12.0);
  vec2 d = abs(fract(g + 0.5) - 0.5) / max(w, vec2(1e-5));
  float line = 1.0 - smoothstep(0.5, 1.5, min(d.x, d.y));
  float edge = 1.0 - smoothstep(0.5, 1.5, abs(s - 0.5) / max(fwidth(s), 1e-4));
  float a = (0.05 + 0.3 * line) * (1.0 - smoothstep(0.3, 0.7, s)) + 0.8 * edge;
  gl_FragColor = vec4(uCol, a);
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
function atmoShell(a, rp, center, sun) {
  return new THREE.Mesh(new THREE.SphereGeometry(rp * a.ra, 96, 48), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: ATMO_FRAG, uniforms: {
    uSun: { value: sun }, uCenter: { value: center }, uBeta: { value: new THREE.Vector3(...a.beta) }, uMieCol: { value: new THREE.Vector3(...a.mieCol) },
    uRp: { value: rp }, uRa: { value: rp * a.ra }, uH: { value: a.h }, uGain: { value: a.gain }, uMie: { value: a.mie }, uAir: { value: 0 }, uAirH: { value: 0.2 } },
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
}

// cfg: id (= uranus.js MOONS), name, km (Einheit = mittlerer Radius), axes [x, y, z] Halbachsen [km] (sonst Kugel), tex, seen
// (Maske), spots [[id, Breite, Länge Ost, Fokus in Radien]] (Gazetteer, planetozentrisch), horizon [Breite, Länge] (Standpunkt
// „Uranus am Horizont“), north [Breite, Länge] (Abzeichen „Unbekannter Norden“). Texte der Abzeichen: content.js STATIONS[id].
export function createUranusMoon(ctx, cfg) {
  const self = MOONS.find((m) => m.id === cfg.id);
  const ax = new THREE.Vector3(...(cfg.axes ?? [cfg.km, cfg.km, cfg.km])).divideScalar(cfg.km);
  const rU = R_U / cfg.km;
  // Breite/Länge [Grad, Ost positiv] → Punkt auf dem Körper (h = Höhe als Anteil), so gestreckt wie die Karte auf dem Ellipsoid
  const sel = (lat, lon, h = 0) => new THREE.Vector3(Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.sin(lat * RAD), -Math.cos(lat * RAD) * Math.sin(lon * RAD))
    .multiply(ax).multiplyScalar(1 + h);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 12000);
  let jd = julianDate(new Date(VOYAGER)), spdIdx = 2, rate = SPEEDS[spdIdx][0];

  // ---------- Lage: Mond-System (körperfest) ↔ Ekliptik-Szene ----------
  const sun = new THREE.Vector3(), sunE = new THREE.Vector3(), uPos = new THREE.Vector3(), uPole = new THREE.Vector3();
  const pM = new THREE.Vector3(), vM = new THREE.Vector3(), x0 = new THREE.Vector3(), P = new THREE.Vector3(), z0 = new THREE.Vector3();
  const mB = new THREE.Matrix4(), qInv = new THREE.Quaternion();
  const state = { lat: 0, uLit: 0, sunAU: 19.2, dist: self.el.a / cfg.km };
  const scenePos = (el, t, out) => laplaceToScene(laplacePos(el, t), AXES, cfg.km, out);

  // ---------- Himmel: Katalog (Yale BSC) + Milchstraßenband; drehen mit der Lage ----------
  const ngp = new THREE.Vector3(...eclDir(180.02, 29.81)), gc = new THREE.Vector3(...eclDir(266.84, -5.54));
  const sky = new THREE.Group();
  scene.add(sky);
  let catalog = null, pr = 1;
  const ready = createCatalogSky({ gain: 1.8, limit: 6.5 }).then((g) => { catalog = g; sky.add(g); g.userData.setPixelRatio(pr); })
    .catch((err) => {
      console.warn('[kosmos] Sternkatalog nicht geladen, statistischer Himmel:', err);
      catalog = createStarfield({ ngp, gc, gain: 0.8, seed: 23 });
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

  // ---------- Mond: Voyager-Karte, Lommel-Seeliger + Uranusschein, Schatten des Uranus (Finsternis) ----------
  const mU = planetU(ctx.tex(cfg.tex), { moon: true, earthPos: uPos, sun });
  mU.uOccN.value = 1;
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 96), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: mU }));
  moon.scale.copy(ax);
  scene.add(moon);
  const seen = new THREE.Mesh(new THREE.SphereGeometry(1.002, 192, 96), new THREE.ShaderMaterial({ vertexShader: SEEN_VERT, fragmentShader: SEEN_FRAG,
    uniforms: { tSeen: { value: ctx.tex(cfg.seen, false) }, uCol: { value: new THREE.Color(0x33ccff) } }, transparent: true, depthWrite: false }));
  seen.visible = false;
  moon.add(seen);

  // ---------- Uranus am Himmel: maßstäblich, Ringe in der Äquatorebene, eigene Drehung (rückläufig um den IAU-Nordpol) ----------
  const uHold = new THREE.Group(), uSpin = new THREE.Group();
  uHold.scale.setScalar(rU);
  uHold.add(uSpin);
  scene.add(uHold);
  const AT = ATMOS.uranus;
  const ringTex = ringTexture(RINGS, RING_IN, RING_OUT, { w: 2048, color: [0.62, 0.62, 0.64] });
  const uU = planetU(ctx.tex('uranus.jpg'), { sun, band: 0.2, wrap: AT.wrap, term: AT.term, amb: 0.003, gain: 1.1 });
  Object.assign(uU, { tRing: { value: ringTex }, uRing: { value: 1 }, uRingIn: { value: RING_IN / R_U }, uRingOut: { value: RING_OUT / R_U } });
  uU.uOcc.value[0].set(0, 0, 0, 1);
  uU.uOccN.value = 1;
  const uranus = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: uU }));
  uSpin.add(uranus);
  const uShell = atmoShell(AT, rU, uPos, sun);
  scene.add(uShell);
  const rings = ringMesh(new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: RING_FRAG, uniforms: {
    tRing: { value: ringTex }, uCenter: { value: uPos }, uSunDir: { value: sun }, uR: { value: rU }, uGain: { value: 3 } },
    transparent: true, side: THREE.DoubleSide, depthWrite: false }), RING_IN, RING_OUT, R_U, 1024);
  uHold.add(rings);

  // ---------- Die übrigen großen Monde: maßstäblich, gebunden, mit Uranusschein ----------
  const others = MOONS.filter((m) => m.id !== cfg.id).map((m) => {
    const u = planetU(ctx.tex(m.tex), { moon: true, earthPos: uPos, sun });
    u.uEarthshine.value = 0.01;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(m.r / cfg.km, 48, 24), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: u }));
    scene.add(mesh);
    return { m, mesh, u };
  });

  // ---------- Bahn (moonsys.js): Leuchtspur um Uranus, im Mond-System mitgedreht – endet am Mond ----------
  const orbit = moonOrbit(self.el, AXES, cfg.km, 0x33ccff, jd, 0.6), orbitLine = new THREE.Group();
  orbitLine.add(orbit.line);
  scene.add(orbitLine);

  const tmp = new THREE.Vector3(), toU = new THREE.Vector3();
  function place() {
    sunE.set(...eclToScene(planetPosition(UA, jd)));
    state.sunAU = sunE.length();
    sunE.multiplyScalar(-1 / state.sunAU);                           // Sonne von Uranus (≈ vom Mond)
    scenePos(self.el, jd, pM);
    vM.copy(scenePos(self.el, jd + 0.001, vM)).sub(pM);
    x0.copy(pM).multiplyScalar(-1).normalize();                      // Mond → Uranus = Längengrad 0
    P.crossVectors(pM, vM).multiplyScalar(-1);                       // Nordpol (IAU): gegen den Bahndrehimpuls
    P.addScaledVector(x0, -P.dot(x0)).normalize();
    z0.crossVectors(x0, P);
    qInv.setFromRotationMatrix(mB.makeBasis(x0, P, z0)).invert();
    sun.copy(sunE).applyQuaternion(qInv);
    sky.quaternion.copy(qInv);
    state.dist = pM.length();
    uPos.set(state.dist, 0, 0);
    uPole.set(...equToScene(...NORTH)).applyQuaternion(qInv);
    uHold.position.copy(uPos);
    uHold.quaternion.setFromUnitVectors(Y, uPole);
    uSpin.rotation.y = (((jd - 2451545) * 24 / ROT_H) % 1) * Math.PI * 2;
    uHold.updateMatrixWorld(true);
    uU.uInv.value.copy(uranus.matrixWorld).invert();
    uShell.position.copy(uPos);
    state.lat = Math.asin(THREE.MathUtils.clamp(sun.y, -1, 1)) / RAD;
    state.uLit = (1 - sun.x) / 2;                                    // beleuchteter Anteil des Uranus, vom Mond gesehen
    const sunAng = R_SUN / (state.sunAU * AU);
    mU.uSunAng.value = uU.uSunAng.value = sunAng;
    mU.uOcc.value[0].set(uPos.x, 0, 0, rU);
    for (const o of others) {
      scenePos(o.m.el, jd, o.mesh.position).sub(pM).applyQuaternion(qInv);
      tidalQuat(o.mesh.quaternion, toU.copy(uPos).sub(o.mesh.position), uPole);
      o.u.uSunAng.value = sunAng;
    }
    orbitLine.position.copy(uPos);
    orbitLine.quaternion.copy(qInv);
    orbit.update(jd, tmp);
  }
  place();

  // ---------- Posen ----------
  // Mond: von der Uranus-abgewandten Seite, 14° nach Osten versetzt → der Mond links angeschnitten, Uranus geht rechts hinter
  // seinem Rand auf (frei von der Infotafel); Höhe ±12° nach dem Licht: der Phasenwinkel am nächsten an 70°
  function homePose() {
    let best = null;
    for (const el of [-12, 12]) {
      const c = new THREE.Vector3(-Math.cos(14 * RAD) * Math.cos(el * RAD), Math.sin(el * RAD), Math.sin(14 * RAD) * Math.cos(el * RAD));
      const g = Math.abs(Math.acos(THREE.MathUtils.clamp(c.dot(sun), -1, 1)) - 70 * RAD);
      if (!best || g < best.g) best = { g, c };
    }
    const pos = best.c.multiplyScalar(5), dU = uPos.clone().sub(pos).normalize(), dM = pos.clone().multiplyScalar(-1).normalize();
    return { pos, target: pos.clone().addScaledVector(dM.multiplyScalar(0.28).addScaledVector(dU, 0.72).normalize(), 5), up: Y };
  }
  const home = homePose();
  // Uranus am Horizont: 2,5 km über dem Standpunkt (die Kimm liegt auf dem kleinen Körper dort schon rund 8° tief), Blick
  // knapp unter die Planetenmitte, damit Boden und ganze Planetenscheibe ins Bild passen
  const horizonView = () => {
    const n = sel(...cfg.horizon).normalize();
    return { pos: sel(...cfg.horizon, 2.5 / cfg.km), target: uPos.clone().addScaledVector(n, -rU * 0.27), up: n };
  };
  // Bahn: weit über der Bahnebene auf der Tagseite – Uranus, Ringe, Bahnkreis und (winzig) der Mond
  const orbitView = () => ({ pos: new THREE.Vector3(state.dist * 0.55, state.dist * 1.6 * (sun.y < 0 ? -1 : 1), state.dist * 1.25), target: new THREE.Vector3(state.dist * 0.8, 0, 0), up: Y });

  // Blick-Wechsel: Kamera gleitet hin (Richtung auf der Kugel, Abstand logarithmisch) und hält, bis der Besucher selbst dreht
  const view = { mode: null, t: 0, from: null };
  function setView(v) {
    view.mode = v;
    view.t = 0;
    view.from = null;
  }
  const releaseView = () => { view.mode = null; };
  const canvas = ctx.renderer.domElement;
  canvas.addEventListener('pointerdown', releaseView);
  canvas.addEventListener('wheel', releaseView, { passive: true });
  function goal() {
    if (view.mode === 'uranus') return horizonView();
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
  let showU = true;
  const facing = (p, cam) => tmp.copy(cam.position).sub(p).normalize().dot(va.copy(p).normalize());
  const surf = (id, lat, lon, focus) => {
    const pos = sel(lat, lon);
    return { id, kind: 'info', pos, focus: () => { releaseView(); return focus; }, visible: (cam) => cam.position.length() < 30 && facing(pos, cam) > 0.06 };
  };
  // Uranus verdeckt? (Strahl Kamera → Uranus schneidet den Mond)
  const hidden = (cam) => {
    const d = vb.copy(uPos).sub(cam.position), L = d.length();
    d.divideScalar(L);
    const s = -cam.position.dot(d);
    return s > 0 && s < L && cam.position.lengthSq() - s * s < ax.x * ax.x;
  };
  const origin = new THREE.Vector3();
  const hotspots = [
    { id: 'uranus', kind: 'info', pos: uPos, visible: (cam) => showU && !hidden(cam) },
    { id: 'orbit', kind: 'info', pos: origin, visible: (cam) => cam.position.length() > 30 },
    ...cfg.spots.map(([id, lat, lon, f]) => surf(id, lat, lon, f)),
    surf('north', ...cfg.north, 1.6),
  ];

  // ---------- Schalter der Infotafel ----------
  const controls = [
    { id: 'view', label: 'Blick', value: 'home', options: [['home', cfg.name], ['uranus', 'Uranus am Horizont'], ['orbit', 'Bahn']], set: setView },
    { id: 'light', label: 'Licht', value: 'voyager', options: [['voyager', 'Voyager 2 · 1986'], ['now', 'Heute']], set: (v) => {
      jd = julianDate(v === 'now' ? ctx.date : new Date(VOYAGER));
      setView('home');
      refreshLayers();
    } },
    { id: 'seen', label: 'Voyager-2-Abdeckung', value: 'off', options: [['off', 'Aus'], ['on', 'Gradnetz']], set: (v) => { seen.visible = v === 'on'; } },
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: spdIdx, min: 0, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (v) => setSpeed(Math.round(v)), get: () => (rate ? spdIdx : 0) },
  ];
  function setSpeed(i) {
    if (i > 0) { spdIdx = i; rate = SPEEDS[i][0]; } else rate = 0;
    refreshLayers();
  }

  // ---------- Ebenen (Zahnrad „Station · <Mond>“, Zeitleiste) ----------
  let ushine = 1;
  const dayH = (self.el.P * 24).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  registerLayers(cfg.id, [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', hint: `Sonne, Sterne und die Drehung des Uranus im gewählten Tempo; ein Tag auf ${cfg.name} dauert ${dayH} Stunden. Pause = Echtzeit.`,
      value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, autoplay: true, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, playing) => { spdIdx = Math.max(1, Math.round(i)); rate = playing ? SPEEDS[spdIdx][0] : 0; },
      get: () => ({ value: spdIdx, playing: rate !== 0 }), status: () => `${fmt.format(dateOf(jd))} UTC${rate ? '' : ' · Echtzeit'}` },
    { id: 'ushine', type: 'range', group: cfg.name, label: 'Uranusschein', value: 1, min: 0, max: 3, step: 0.25, unit: '×',
      hint: 'Licht des Uranus auf der Nachtseite, folgt seiner Phase. 1× entspricht ungefähr der echten Stärke (Näherung aus Radius, Abstand und Albedo).',
      set: (v) => { ushine = v; } },
    { id: 'uranus', type: 'toggle', group: 'Himmel', label: 'Uranus am Himmel', value: true, set: (v) => { showU = v; uHold.visible = v; uShell.visible = v; } },
    { id: 'rings', type: 'toggle', label: 'Ringe', value: true, sub: true, set: (v) => { rings.visible = v; uU.uRing.value = v ? 1 : 0; } },
    { id: 'moons', type: 'toggle', label: 'Weitere große Monde', value: true, set: (v) => { others.forEach((o) => { o.mesh.visible = v; }); } },
    { id: 'orbit', type: 'toggle', label: 'Bahn', value: true, set: (v) => { orbitLine.visible = v; } },
    { id: 'stars', type: 'toggle', label: 'Sterne und Milchstraße', value: true, set: (v) => { sky.visible = v; } },
  ]);

  const occluders = [{ center: origin, radius: 1 }, { center: uPos, radius: rU }];
  const sunFar = new THREE.Vector3();
  const kMin = 1 + 2 / cfg.km;                                       // mindestens 2 km über dem Boden

  return {
    scene, camera, home, unit: cfg.km * 1e3, hotspots, controls, ready,
    orbit: { minDistance: 0.01, maxDistance: Math.ceil(state.dist * 4), cineSpeed: 0.5 },
    look: { exposure: 1.0, bloom: 0.06, sat: 1.02 },
    update(dt, t, cam, flying) {
      if (!flying) jd += rate ? dt * rate : dt / DAY;
      place();
      mU.uEarthshine.value = 1.8 * P_U * (rU / state.dist) ** 2 * state.uLit * ushine;
      uU.uTime.value = t;
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
      // über der Oberfläche bleiben (Abstand im Maß des Ellipsoids); Nahebene mit der Höhe
      const k = tmp.copy(o.position).divide(ax).length();
      if (k < kMin) o.position.multiplyScalar(kMin / k);
      const nr = THREE.MathUtils.clamp((Math.max(k, kMin) - 1) * 0.3, 0.0004, 0.5);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
      return free;
    },
    live: () => {
      const lat = Math.round(Math.abs(state.lat));
      return `${fmt.format(dateOf(jd))} UTC · Sonne im Zenit über ${lat}° ${state.lat < 0 ? 'Süd' : 'Nord'} · Uranus ${Math.round(state.uLit * 100)} % beleuchtet`;
    },
    setPixelRatio: (p) => { pr = p; if (catalog) catalog.userData.setPixelRatio(p); },
    dispose() {
      canvas.removeEventListener('pointerdown', releaseView);
      canvas.removeEventListener('wheel', releaseView);
      scene.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); });
      ringTex.dispose();
    },
  };
}
