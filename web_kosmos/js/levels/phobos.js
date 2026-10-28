// Station 02E1: Phobos (Einheit 1 km), Abstecher von Mars & Monde. Mondfest wie die Uranusmonde: Phobos dreht sich gebunden,
// Mars steht über dem Längengrad 0 still am Himmel – von hier aus rund 42° breit –, Sonne und Sterne ziehen einmal je Umlauf
// (7 h 39 min) herum. Lage aus den JPL-Bahnelementen (martian.js): x = Richtung Mars, y = Nordpol (Bahndrehimpuls, prograd),
// +z = Flugrichtung (vordere Spitze bei 90° W), Osten = −z wie die Karten. Körper als Modell (mars.js moonShape) mit
// Stickney, Kleinkratern und Rillen (Scharen paralleler Furchen um die vordere Spitze, Lage nach Murray et al. 2006, Abstand und
// Tiefe Modell); Licht: Sonne mit Schlagschatten, Marsschein aus Phase und Abstand (Näherung), Finsternis im Marsschatten.
// Mars maßstäblich am Himmel mit Polkappen, Dunst und dem Schatten des Mondes. createMarsMoon nutzt auch deimos.js (02E2).

import * as THREE from 'three';
import { julianDate, laplaceAxes, DAY } from '../astro.js';
import { createStarfield } from '../stars.js';
import { createCatalogSky } from '../catalog.js';
import { createFlare } from '../flare.js';
import { settings } from '../settings.js';
import { NOISE, SKY_VERTEX } from '../glsl.js';
import { registerLayers, refreshLayers } from '../layers.js';
import { moonOrbit } from '../moonsys.js';
import { BUMP } from './asteroid.js';
import { createMars, moonShape, dirLL, R } from './mars.js';
import { MARS, MOONS, marsState, moonScene } from '../martian.js';
import { eclDir } from '../astro.js';
import { spinAxis } from '../axes.js';

const RAD = Math.PI / 180, Y = new THREE.Vector3(0, 1, 0);
const ease = (t) => t * t * (3 - 2 * t);
const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
const dateOf = (jd) => new Date((jd - 2440587.5) * 864e5);
const SUN_I = 5.5;   // Stärke des Sonnenlichts: Albedo 0,07 hell genug neben Mars (Darstellung)

// Sonne am Himmel: Scheibe mit dem echten Winkelradius (aus 1,4–1,7 AE rund 0,17°) und Lichthof der Optik
const SUN_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uAng, uVis;
varying vec3 vDir;
void main() {
  float a = acos(clamp(dot(normalize(vDir), uSun), -1.0, 1.0));
  float disc = 1.0 - smoothstep(uAng * 0.92, uAng * 1.08, a);
  float glow = exp(-a / (uAng * 3.0)) * 1.5 + exp(-a / 0.06) * 0.05;
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * (disc * 40.0 + glow) * uVis, 1.0);
}
`;
const SUN_VERT = /* glsl */ `
${SKY_VERTEX}
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = skyPosition(vDir); }
`;

// Oberfläche (eingehängt in MeshStandardMaterial): dunkles, leicht rötliches Gestein (Albedo 0,07–0,08), Kleinkrater als
// Zellen-Höhenfeld, Phobos zusätzlich Rillen: Scharen paralleler Ebenen (uGN: Normale, Abstand km), Tiefe schwankt entlang der
// Rille wie Kraterketten, um die vordere Spitze (+z) am dichtesten, Tiefe 60 m (etwa doppelt überhöht). Um Stickney ein Hauch bläulicher (NASA: Teile des
// Kraters erscheinen in Falschfarben blau). Alles Modell; Bump nach Mikkelsen 2010 (asteroid.js BUMP).
const SURF = /* glsl */ `
uniform float uGroove, uFeat, uSoft;
uniform vec4 uGN[4], uStick;
uniform vec3 uBase;
varying vec3 vObj;
varying float vH, vAO;
float craterCells(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float h = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)), c = i + g;
    vec3 o = hash3(c) * 0.5 + 0.5;
    float hr = hash13(c + 5.1), r = 0.1 + 0.42 * hr * hr;
    float d = length(g + o - f) / r;
    if (d < 1.6 && hash13(c + 2.3) < 0.45) {
      float cav = d < 1.0 ? d * d - 1.0 : 0.0;
      h += (max(cav, -0.65) + 0.28 * exp(-pow((d - 1.05) / 0.18, 2.0))) * r;
    }
  }
  return h;
}
`;
const SURF_MAIN = /* glsl */ `
vec3 sP = vObj * uFeat;
float sFw = length(fwidth(sP));
float sF1 = 1.0 - smoothstep(0.35, 0.9, sFw), sF2 = 1.0 - smoothstep(0.13, 0.33, sFw);
float sN = fbm(vObj * 0.22, 4);
float sG = fbm(sP * 2.5, 3) * (1.0 - smoothstep(0.15, 0.5, sFw));
float sHF = (craterCells(sP) * sF1 + craterCells(sP * 2.7 + 11.0) * 0.45 * sF2) * uSoft * 0.45 / uFeat + sG * 0.04 / uFeat;
float sGr = 0.0;
if (uGroove > 0.5) {
  float apex = smoothstep(-0.35, 0.55, normalize(vObj).z);
  for (int k = 0; k < 4; k++) {
    float s = dot(vObj, uGN[k].xyz) / uGN[k].w, w = fwidth(s);
    float dd = abs(fract(s + 0.5) - 0.5);
    float tr = 1.0 - smoothstep(0.0, 0.08 + w, dd);
    float pits = 0.55 + 0.45 * sin(length(cross(vObj, uGN[k].xyz)) * 7.0 + s * 2.3 + float(k));
    float seg = smoothstep(0.02, 0.2, fbm(vObj * 0.16 + float(k) * 7.3, 2));
    sGr = max(sGr, tr * pits * seg * (1.0 - smoothstep(0.25, 0.45, w)));
  }
  sGr *= apex;
  sHF -= sGr * 0.06;
}
vec3 sCol = uBase * (0.78 + 0.44 * smoothstep(-0.4, 0.4, sN * 2.0 + sG)) * mix(1.0, 0.6, sGr);
float sSt = 1.0 - smoothstep(uStick.w * 0.6, uStick.w * 1.6, length(vObj - uStick.xyz));
sCol *= mix(vec3(1.0), vec3(0.9, 0.97, 1.12), sSt * 0.8);
diffuseColor.rgb = sCol;
`;

function makeMaterial(cfg, stick) {
  const u = {
    uGroove: { value: cfg.grooves ? 1 : 0 }, uFeat: { value: cfg.feat }, uSoft: { value: cfg.soft }, uBase: { value: new THREE.Vector3(...cfg.base) },
    uStick: { value: stick }, uGN: { value: cfg.grooveSets.map(([lat, lon, sp]) => { const n = dirLL(lat, lon); return new THREE.Vector4(n.x, n.y, n.z, sp); }) },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aH;\nattribute float aAO;\nvarying vec3 vObj;\nvarying float vH, vAO;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position; vH = aH; vAO = aAO;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}\n${SURF}`)
      .replace('#include <map_fragment>', SURF_MAIN)
      .replace('#include <normal_fragment_maps>', BUMP)
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= vAO;\nreflectedLight.indirectSpecular *= vAO;\nreflectedLight.directDiffuse *= mix(1.0, vAO, 0.5);');
  };
  return m;
}

// Anteil der Sonnenscheibe, der hinter einer Scheibe (Winkelradius ao, Abstand sep) sichtbar bleibt – wie eclipse() in planetfx.js
function sunVisible(ao, as, sep) {
  const lo = Math.abs(ao - as), hi = ao + as;
  const full = ao >= as ? 0 : 1 - (ao * ao) / (as * as);
  return full + (1 - full) * THREE.MathUtils.smoothstep(sep, lo, hi);
}

// cfg: id (martian.js MOONS), name, speeds [[Tage je s, Name]], spdIdx, homeDist [km], feat (Kleinkrater je km), soft (Stärke),
// base (Farbe linear), grooves + grooveSets [[Breite, Länge, Abstand km]] der Normalen, stick [Breite, Länge, Radius km] oder null,
// spots [[id, Breite, Länge Ost, Fokus km]], horizon [Breite, Länge, Höhe km, Blick unter die Marsmitte °] (Standpunkt
// „Mars über dem Horizont“). Texte: content.js
export function createMarsMoon(ctx, cfg) {
  const m = MOONS[cfg.id];
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 2e5);
  let jd = julianDate(ctx.date), spdIdx = cfg.spdIdx, rate = cfg.speeds[spdIdx][0];

  // ---------- Lage: Mond-System (körperfest) ↔ Ekliptik-Szene ----------
  const sun = new THREE.Vector3(), sunE = new THREE.Vector3(), uPos = new THREE.Vector3();
  const pM = new THREE.Vector3(), vM = new THREE.Vector3(), x0 = new THREE.Vector3(), P = new THREE.Vector3(), z0 = new THREE.Vector3();
  const mB = new THREE.Matrix4(), qInv = new THREE.Quaternion();
  const state = { dist: m.a, lit: 0.5, vis: 1, ls: 0, sunAng: 0.003 };

  // ---------- Himmel: Katalog (Yale BSC) + Milchstraßenband; drehen mit der Lage ----------
  const ngp = new THREE.Vector3(...eclDir(180.02, 29.81)), gc = new THREE.Vector3(...eclDir(266.84, -5.54));
  const sky = new THREE.Group();
  scene.add(sky);
  let catalog = null, pr = 1;
  const ready = createCatalogSky({ gain: 1.6, limit: 6.5 }).then((g) => { catalog = g; sky.add(g); g.userData.setPixelRatio(pr); })
    .catch((err) => {
      console.warn('[kosmos] Sternkatalog nicht geladen, statistischer Himmel:', err);
      catalog = createStarfield({ ngp, gc, gain: 0.8, seed: 41 });
      catalog.userData.setPixelRatio(pr);
      sky.add(catalog);
    });
  sky.add(createStarfield({ count: 1, ngp, gc, gain: 0, band: 1, glint: false, tex: ctx.tex }));
  const sunU = { uSun: { value: sun }, uAng: { value: 0.003 }, uVis: { value: 1 } };
  const sunSky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG,
    uniforms: sunU, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }));
  sunSky.frustumCulled = false;
  sunSky.renderOrder = -9;
  scene.add(sunSky);
  const flare = createFlare({ strength: 0.5 });
  scene.add(flare);

  // ---------- Mars am Himmel: maßstäblich, ohne Tiefentest vor dem Himmel gezeichnet (Tiefenpuffer zu grob über 10.000 km) ----------
  const hold = new THREE.Group();
  scene.add(hold);
  const mars = createMars(ctx, { seg: Math.round(160 + 96 * ctx.detail), sky: true });
  mars.group.scale.setScalar(R);
  hold.add(mars.group);
  const marsOcc = [new THREE.Vector4(0, 0, 0, m.r)];

  // ---------- Körper: Modell mit Schlagschatten der Sonne ----------
  const prevShadow = ctx.renderer.shadowMap.enabled, prevType = ctx.renderer.shadowMap.type;
  ctx.renderer.shadowMap.enabled = true;
  ctx.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const shape = moonShape(cfg.id, Math.round(60 + 60 * ctx.detail));
  const stick = cfg.stick ? shape.surf(cfg.stick[0], cfg.stick[1]) : new THREE.Vector3(0, 0, 999);
  const body = new THREE.Mesh(shape.geo, makeMaterial(cfg, new THREE.Vector4(stick.x, stick.y, stick.z, cfg.stick ? cfg.stick[2] : 0)));
  body.castShadow = body.receiveShadow = true;
  spinAxis(body);
  // in die Liste der transparenten Objekte (deckend, schreibt Tiefe): three.js zeichnet sie nach allen deckenden – so kommt der
  // Körper nach den Himmelsschichten des Mars (Dunst, Kappen ohne Tiefentest) und wird nicht übermalt
  body.material.transparent = true;
  body.renderOrder = 1;
  scene.add(body);
  const ext = m.axes[0] * 1.2;
  const sunL = new THREE.DirectionalLight(0xfff4e6, SUN_I);
  sunL.castShadow = true;
  const ms = ctx.detail >= 0.8 ? 2048 : 1024;
  sunL.shadow.mapSize.set(ms, ms);
  Object.assign(sunL.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: ext * 6 });
  sunL.shadow.bias = -0.0004;
  sunL.shadow.normalBias = 0.012 * m.axes[0];
  const marsL = new THREE.DirectionalLight(0xffb08a, 0);
  const amb = new THREE.AmbientLight(0x404a60, 0.02);
  scene.add(sunL, sunL.target, marsL, marsL.target, amb);

  // ---------- Bahn: Leuchtspur um Mars, im Mond-System mitgedreht – endet am Mond ----------
  const T0 = (jd - 2451545) / 36525;
  const orbit = moonOrbit({ ...m, M: m.M + m.acc * T0 * T0 }, laplaceAxes(m.ra, m.dec), 1, 0x33ccff, jd, 0.6), orbitLine = new THREE.Group();
  orbitLine.add(orbit.line);
  scene.add(orbitLine);

  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  let marsShine = 1;
  function place() {
    const st = marsState(jd);
    sunE.set(...st.sun);
    pM.set(...moonScene(cfg.id, jd));
    vM.set(...moonScene(cfg.id, jd + 0.001)).sub(pM);
    x0.copy(pM).multiplyScalar(-1).normalize();                      // Mond → Mars = Längengrad 0
    P.crossVectors(pM, vM);                                          // Nordpol: Bahndrehimpuls (prograd)
    P.addScaledVector(x0, -P.dot(x0)).normalize();
    z0.crossVectors(x0, P);
    qInv.setFromRotationMatrix(mB.makeBasis(x0, P, z0)).invert();
    sun.copy(sunE).applyQuaternion(qInv);
    sky.quaternion.copy(qInv);
    state.dist = pM.length();
    uPos.set(state.dist, 0, 0);
    hold.quaternion.copy(qInv);
    mars.group.position.copy(pM).negate();
    state.ls = st.ls;
    state.sunAng = st.sunAng;
    state.lit = (1 - sun.x) / 2;                                     // beleuchteter Anteil des Mars, vom Mond gesehen
    // Finsternis: Mars vor der Sonne (Scheibenüberlapp vom Mondmittelpunkt aus)
    state.vis = sunVisible(Math.asin(MARS.rm / state.dist), st.sunAng, Math.acos(THREE.MathUtils.clamp(sun.x, -1, 1)));
    mars.frame(sun, jd, st.ls, marsOcc, st.sunAng);
    sunU.uAng.value = st.sunAng;
    sunU.uVis.value = 0.15 + 0.85 * state.vis;
    sunL.position.copy(sun).multiplyScalar(ext * 3);
    sunL.intensity = SUN_I * state.vis;
    // Marsschein: Albedo × (Radius/Abstand)² × beleuchteter Anteil (Näherung), 1× ≈ echte Stärke
    marsL.position.set(ext * 3, 0, 0);
    marsL.intensity = SUN_I * MARS.albedo * (MARS.rm / state.dist) ** 2 * state.lit * marsShine * 4;
    orbitLine.position.copy(uPos);
    orbitLine.quaternion.copy(qInv);
    orbit.update(jd, tmp);
  }
  place();

  // ---------- Posen ----------
  // Mond: von der Mars-abgewandten Seite, seitlich versetzt → der Körper links angeschnitten, Mars füllt rechts den Himmel;
  // Höhe ±15° nach dem Licht: der Phasenwinkel am nächsten an 65°
  function homePose() {
    let best = null;
    for (const el of [-15, 15]) {
      const c = new THREE.Vector3(-Math.cos(cfg.homeAz * RAD) * Math.cos(el * RAD), Math.sin(el * RAD), Math.sin(cfg.homeAz * RAD) * Math.cos(el * RAD));
      const g = Math.abs(Math.acos(THREE.MathUtils.clamp(c.dot(sun), -1, 1)) - 65 * RAD);
      if (!best || g < best.g) best = { g, c };
    }
    const pos = best.c.multiplyScalar(cfg.homeDist), dU = uPos.clone().sub(pos).normalize(), dM = pos.clone().multiplyScalar(-1).normalize();
    return { pos, target: pos.clone().addScaledVector(dM.multiplyScalar(cfg.homeMix).addScaledVector(dU, 1 - cfg.homeMix).normalize(), cfg.homeDist), up: Y };
  }
  const home = homePose();
  // Mars über dem Horizont: wenige Dutzend Meter über dem Standpunkt, Blick etwas unter die Marsmitte – Mars steht über dem
  // nahen Horizont (auf dem kleinen Körper liegt die Kimm schon aus 30 m Höhe 3–6° tief)
  const horizonView = () => {
    const [lat, lon, hKm, drop] = cfg.horizon;
    const ground = shape.surf(lat, lon), n = ground.clone().normalize(), pos = ground.clone().addScaledVector(n, hKm);
    const toM = uPos.clone().sub(pos).normalize(), h = toM.clone().addScaledVector(n, -toM.dot(n)).normalize();
    const e = Math.asin(THREE.MathUtils.clamp(toM.dot(n), -1, 1)) - drop * RAD;
    return { pos, target: pos.clone().add(h.multiplyScalar(Math.cos(e)).addScaledVector(n, Math.sin(e)).multiplyScalar(100)), up: n };
  };
  // Bahn: weit über dem Nordpol des Mars auf der Tagseite – Mars, Bahnkreis und (winzig) der Mond
  const orbitView = () => ({ pos: new THREE.Vector3(state.dist * 0.4, state.dist * 2.2, state.dist * 0.9), target: new THREE.Vector3(state.dist * 0.85, 0, 0), up: Y });

  const view = { mode: null, t: 0, from: null };
  const setView = (v) => { view.mode = v; view.t = 0; view.from = null; };
  const releaseView = () => { view.mode = null; };
  const canvas = ctx.renderer.domElement;
  canvas.addEventListener('pointerdown', releaseView);
  canvas.addEventListener('wheel', releaseView, { passive: true });
  const goal = () => (view.mode === 'mars' ? horizonView() : view.mode === 'orbit' ? orbitView() : homePose());
  const qa = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3();
  function blendPos(out, a, b, k) {
    const ra = a.length(), rb = b.length();
    va.copy(a).normalize(); vb.copy(b).normalize();
    qa.setFromUnitVectors(va, vb);
    out.copy(va).applyQuaternion(new THREE.Quaternion().slerp(qa, k)).multiplyScalar(Math.exp(Math.log(ra) + (Math.log(rb) - Math.log(ra)) * k));
  }

  // ---------- Abzeichen ----------
  let showMars = true;
  const facing = (p, cam) => tmp.copy(cam.position).sub(p).normalize().dot(va.copy(p).normalize());
  const surf = (id, lat, lon, focus) => {
    const pos = shape.surf(lat, lon, 0.2);
    return { id, kind: 'info', pos, focus: () => { releaseView(); return focus; }, visible: (cam) => cam.position.length() < m.a * 0.3 && facing(pos, cam) > 0.06 };
  };
  // Mars verdeckt? (Strahl Kamera → Mars schneidet den Mond)
  const hidden = (cam) => {
    const d = vb.copy(uPos).sub(cam.position), L = d.length();
    d.divideScalar(L);
    const s = -cam.position.dot(d);
    return s > 0 && s < L && cam.position.lengthSq() - s * s < m.axes[1] * m.axes[1];
  };
  const origin = new THREE.Vector3();
  const hotspots = [
    { id: 'mars', kind: 'info', pos: uPos, visible: (cam) => showMars && !hidden(cam) },
    { id: 'orbit', kind: 'info', pos: origin, visible: (cam) => cam.position.length() > m.a * 0.3 },
    ...cfg.spots.map(([id, lat, lon, f]) => surf(id, lat, lon, f)),
  ];

  // ---------- Schalter der Station (Reiter Station) ----------
  const controls = [
    { id: 'view', label: 'Blick', value: 'home', options: [['home', cfg.name], ['mars', 'Mars über dem Horizont'], ['orbit', 'Bahn']], set: setView },
    { id: 'now', type: 'action', label: 'Finsternis', button: 'Nächste Finsternis', mark: 'Finsternis', horizon: 1374,
      at: eclipseAt, go: goEclipse, run: () => { const t = eclipseAt(jd, jd + 1374); if (t !== null) goEclipse(t); } },
  ];
  // Finsternis = Mars verdeckt die Sonne zur Hälfte. Erster Eintritt zwischen from und until in Schritten von 1/200 Umlauf →
  // Zeitpunkt oder null (Deimos: nur um die Tagundnachtgleichen des Mars, daher sucht der Knopf bis zu 2 Marsjahre voraus)
  function eclipseAt(from, until) {
    const step = m.P / 200;
    const dark = (jj) => { const s = new THREE.Vector3(...marsState(jj).sun), p = tmp2.set(...moonScene(cfg.id, jj)); return s.dot(p) < 0 && p.clone().addScaledVector(s, -s.dot(p)).length() < MARS.rm; };
    let was = dark(from);
    for (let j = from + step; j < until; j += step) { const now = dark(j); if (now && !was) return j; was = now; }
    return null;
  }
  function goEclipse(t) { jd = t - (m.P / 200) * 3; refreshLayers(); }

  // ---------- Ebenen (Zahnrad „Station · <Mond>“, Zeitleiste) ----------
  const dayH = (m.P * 24).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  registerLayers(cfg.id, [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', hint: `Sonne, Sterne und die Drehung des Mars im gewählten Tempo; ein Tag auf ${cfg.name} dauert so lange wie ein Umlauf, ${dayH} Stunden. Pause = Echtzeit.`,
      value: spdIdx, min: 1, max: cfg.speeds.length - 1, step: 1, autoplay: true, fmt: (i) => cfg.speeds[Math.round(i)][1], now: () => jd, span: Math.max(1, m.P * 3),
      set: (i, playing) => { spdIdx = Math.max(1, Math.round(i)); rate = playing ? cfg.speeds[spdIdx][0] : 0; },
      get: () => ({ value: spdIdx, playing: rate !== 0 }), status: () => `${fmt.format(dateOf(jd))} UTC${rate ? '' : ' · Echtzeit'}` },
    { id: 'shine', type: 'range', group: 'Licht', label: 'Marsschein', value: 1, min: 0, max: 6, step: 0.25, unit: '×',
      hint: 'Licht des Mars auf der Nachtseite, folgt seiner Phase; aus Radius, Abstand und Albedo genähert und für die Lesbarkeit 4-fach verstärkt.',
      set: (v) => { marsShine = v; } },
    { id: 'shadows', type: 'toggle', label: 'Schlagschatten der Sonne', value: true, set: (v) => { sunL.castShadow = v; } },
    { id: 'mars', type: 'toggle', group: 'Himmel', label: 'Mars am Himmel', value: true, set: (v) => { showMars = v; hold.visible = v; } },
    { id: 'storm', type: 'range', label: 'Staubsturm auf Mars', value: 0, min: 0, max: 1, step: 0.05, sub: true, fmt: (v) => (v < 0.02 ? 'klar' : `${Math.round(v * 100)} %`), set: (v) => mars.setStorm(v) },
    { id: 'orbit', type: 'toggle', label: 'Bahn zeigen', value: true, set: (v) => { orbitLine.visible = v; } },
  ]);

  const occluders = [{ center: origin, radius: m.r }, { center: uPos, radius: R }];
  const sunFar = new THREE.Vector3();
  const kMin = 0.02;   // mindestens 20 m über dem Boden

  return {
    scene, camera, home, unit: 1e3, hotspots, controls, ready,
    orbit: { minDistance: 0.02, maxDistance: Math.ceil(state.dist * 4), cineSpeed: 0.5 },
    look: { exposure: cfg.exposure, bloom: 0.06, sat: 1.02 },
    update(dt, t, cam, flying) {
      if (!flying) jd += rate ? dt * rate : dt / DAY;
      place();
      sunFar.copy(sun).multiplyScalar(5e4);
      cam.updateMatrixWorld();
      flare.userData.update(sunFar, cam, occluders, settings.S.lens && state.vis > 0.02, dt);
      // Mond hinter Mars (nur von weit draußen): Körper ausblenden, Mars wird ohne Tiefentest gezeichnet
      const d = vb.copy(cam.position).negate(), Ld = d.length();
      d.divideScalar(Ld);
      const s = tmp.copy(uPos).sub(cam.position).dot(d);
      body.visible = !(showMars && s > 0 && s < Ld && tmp.copy(cam.position).addScaledVector(d, s).sub(uPos).length() < R);
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
      // über der Oberfläche bleiben (Abstand im Maß des Körpers); Nahebene mit der Höhe
      tmp.copy(o.position);
      const r = tmp.length(), g = shape.surf(Math.asin(THREE.MathUtils.clamp(tmp.y / r, -1, 1)) / RAD, Math.atan2(-tmp.z, tmp.x) / RAD, 0, tmp2).length();
      if (r < g + kMin) o.position.multiplyScalar((g + kMin) / r);
      const nr = THREE.MathUtils.clamp((Math.max(r, g + kMin) - g) * 0.3, 0.004, 50);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
      return free;
    },
    live: () => `${fmt.format(dateOf(jd))} UTC · Mars ${Math.round(state.lit * 100)} % beleuchtet${state.vis < 0.98 ? ` · Finsternis: Sonne zu ${Math.round((1 - state.vis) * 100)} % verdeckt` : ''}`,
    setPixelRatio: (p) => { pr = p; if (catalog) catalog.userData.setPixelRatio(p); },
    dispose() {
      canvas.removeEventListener('pointerdown', releaseView);
      canvas.removeEventListener('wheel', releaseView);
      scene.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); });
      ctx.renderer.shadowMap.enabled = prevShadow;
      ctx.renderer.shadowMap.type = prevType;
    },
  };
}

// Phobos: Halbachsen 13,0 × 9,1 × 11,4 km (NSSDCA), Stickney 1° N, 49° W, Radius 4,5 km (Gazetteer); Rillen in vier Scharen,
// Normalen nahe der Polachse geneigt (Furchen etwa parallel zur Bahnebene), Abstand 1,3–1,9 km (Modell)
export const PHOBOS = {
  id: 'phobos', name: 'Phobos', exposure: 1.1, spdIdx: 2,
  speeds: [[0, 'Echtzeit'], [1 / 1440, '1 min/s'], [1 / 144, '10 min/s'], [1 / 48, '30 min/s'], [1 / 24, '1 h/s']],
  homeDist: 46, homeAz: 18, homeMix: 0.25, feat: 1.3, soft: 0.55, base: [0.066, 0.05, 0.04],
  grooves: true, grooveSets: [[78, 0, 1.5], [70, 40, 1.9], [62, -30, 1.3], [84, 110, 1.7]],
  stick: [1, -49, 4.5],
  spots: [['stickney', 1, -49, 26], ['grooves', 8, -100, 22], ['regolith', -40, 160, 22]],
  horizon: [0, 80, 0.03, 8],
};

export function create(ctx) {
  return createMarsMoon(ctx, PHOBOS);
}
