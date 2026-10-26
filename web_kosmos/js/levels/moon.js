// Station 01C: Mond aus der Nähe (Einheit 1.000 km wie Erde & Mond), Abstecher von der Erde. Mondfest: Der Mond steht
// still, Sonne, Erde und Sterne ziehen über seinen Himmel. Lage für den Zeitpunkt aus Mondort (Almanach-Näherung), Erdbahn
// (JPL) und optischer Libration (Meeus Kap. 53, astro.js moonLibration): Nullmeridian zur Erde, Pol nach dem Cassini-Gesetz.
// Oberfläche: Albedo-Karte (Solar System Scope) + Höhenkarte der Laseraltimetrie LOLA (NASA SVS 4720, tools/moon_height.py):
// Relief und Schlagschatten aus dem Höhenfeld (Strahl zur Sonne, Halbschatten der Sonnenscheibe), Lunar-Lambert-Reflexion
// (McEwen 1991) mit Oppositionseffekt, Erdschein nach Erdphase, Kern- und Halbschatten der Erde (Mondfinsternis; Kupferrot
// aus der Brechung in der Erdatmosphäre, aufgehellt). Erde am Himmel maßstäblich (1,9°) mit Tag/Nacht, Stadtlichtern,
// Drehung nach Sternzeit. Blick-Wahl: Mond, von der Erde (Phase + Libration im Zeitraffer), Erdaufgang aus einer niedrigen
// Mondbahn (113 km wie Apollo 8, im Zeitraffer).

import * as THREE from 'three';
import { PLANETS, julianDate, planetPosition, eclToScene, eclDir, moonPosition, moonLibration, MOON_I, gmst, OBLIQUITY, DAY, AU, R_SUN } from '../astro.js';
import { createStarfield } from '../stars.js';
import { createCatalogSky } from '../catalog.js';
import { createFlare } from '../flare.js';
import { settings } from '../settings.js';
import { SKY_VERTEX } from '../glsl.js';
import { registerLayers, refreshLayers } from '../layers.js';

const R_M = 1.7374, R_E = 6.371;            // NASA Fact Sheets [1.000 km]
const H_MIN = -9, H_MAX = 10.6;             // moon_height.png: Grauwert 0…1 ↦ −9 … +10,6 km über 1.737,4 km (tools/moon_height.py)
const RAD = Math.PI / 180, Y = new THREE.Vector3(0, 1, 0);
const SUN_ANG = Math.atan(R_SUN / AU);      // Winkelradius der Sonne ≈ 0,267°
const ALT_RISE = 0.065;                     // Bahnhöhe Erdaufgang: 113 km (Apollo 8: ≈ 110 km)
// Zeitraffer [Tage je Sekunde]; Stufe 0 = Echtzeit
const SPEEDS = [[0, 'Echtzeit'], [1 / 144, '10 min/s'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s'], [3, '3 Tage/s']];
// Totale Mondfinsternis 26.06.2029, Maximum 03:23 (NASA, Espenak); Start knapp 2 h vorher (Halbschatten)
const ECLIPSE = Date.UTC(2029, 5, 26, 3, 23);
// Selenographische Breite/Länge [Grad, Ost positiv] → Mondsystem (Länge 0 auf +x, Norden +y, Osten −z wie die Textur)
const sel = (lat, lon, r = R_M) => new THREE.Vector3(Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.sin(lat * RAD), -Math.cos(lat * RAD) * Math.sin(lon * RAD)).multiplyScalar(r);
const ease = (t) => t * t * (3 - 2 * t);

const VERT = /* glsl */ `
varying vec3 vN, vP;
varying vec2 vUv;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const moonFrag = (steps) => /* glsl */ `
uniform sampler2D tAlb, tH;
uniform vec3 uSun, uEarth;
uniform vec2 uTexel;
uniform float uRelief, uEarthshine, uEarthLit, uSunAng, uGain;
varying vec3 vN, vP;
varying vec2 vUv;
const float R = ${R_M}, HS = ${((H_MAX - H_MIN) / 1000).toFixed(4)}, TAU = 6.2831853, PI = 3.1415927;
float hgt(vec2 uv) { return texture2D(tH, uv).r * HS; }
// Schlagschatten: Strahl von der Oberfläche zur Sonne über das Höhenfeld (Krümmung der Kugel eingerechnet); Anteil der
// Sonnenscheibe über dem höchsten Hindernis → Halbschatten. Höhen mit der Überhöhung uRelief.
float castShadow(vec2 uv, vec3 N, vec3 E, vec3 Nn, float cl, float h0) {
  float sinE = dot(N, uSun);
  if (sinE > 0.4) return 1.0;
  vec3 t = uSun - N * sinE;
  float lt = length(t);
  if (lt < 1e-4) return 1.0;
  t /= lt;
  vec2 dir = vec2(dot(t, E) / (TAU * R * cl), dot(t, Nn) / (PI * R));
  float tanE = sinE / lt, vis = 1.0, d = 0.004;
  for (int i = 0; i < ${steps}; i++) {
    float dh = (hgt(uv + dir * d) - h0) * uRelief - d * tanE - d * d / (2.0 * R);
    vis = min(vis, clamp(0.5 - dh / (d * 2.0 * uSunAng), 0.0, 1.0));
    d *= ${steps > 10 ? '1.42' : '1.8'};
  }
  return vis;
}
// Erdschatten: Überlapp der Sonnenscheibe mit der Erdscheibe (Radius + 2 % für die Atmosphäre), gesehen vom Punkt p
float earthShadow(vec3 p) {
  vec3 d = uEarth - p;
  float dist = length(d);
  vec3 n = d / dist;
  if (dot(n, uSun) <= 0.0) return 1.0;
  float aE = asin(min(${R_E * 1.02} / dist, 1.0)), th = acos(clamp(dot(n, uSun), -1.0, 1.0));
  return smoothstep(aE - uSunAng, aE + uSunAng, th);
}
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  vec3 E = vec3(N.z, 0.0, -N.x);              // Osten = Y × N
  float cl = max(length(E), 0.02);
  E = length(E) > 1e-4 ? E / length(E) : vec3(0.0, 0.0, -1.0);
  vec3 Nn = cross(N, E);
  // Relief: Steigung der LOLA-Höhen nach Ost und Nord (zentrale Differenzen), überhöht mit uRelief
  float h0 = hgt(vUv);
  vec2 du = vec2(uTexel.x, 0.0), dv = vec2(0.0, uTexel.y);
  float sx = (hgt(vUv + du) - hgt(vUv - du)) / (2.0 * uTexel.x * TAU * R * cl);
  float sy = (hgt(vUv + dv) - hgt(vUv - dv)) / (2.0 * uTexel.y * PI * R);
  vec3 Nr = normalize(N - uRelief * (sx * E + sy * Nn));
  vec3 alb = texture2D(tAlb, vUv).rgb;
  float mu0 = max(dot(Nr, uSun), 0.0), mu = max(dot(Nr, V), 1e-3);
  // Lunar-Lambert (McEwen 1991): Lommel-Seeliger-Anteil sinkt mit dem Phasenwinkel g; Oppositionseffekt nahe g = 0
  float g = acos(clamp(dot(uSun, V), -1.0, 1.0));
  float Lw = exp(-g / 1.05);
  float refl = (2.0 * Lw * mu0 / (mu0 + mu) + (1.0 - Lw) * mu0) * (1.0 + 0.35 * exp(-g / 0.1));
  float sh = dot(N, uSun) > -0.2 && mu0 > 0.0 ? castShadow(vUv, N, E, Nn, cl, h0) : 0.0;
  float ecl = earthShadow(vP);
  vec3 col = alb * refl * sh * ecl * uGain * vec3(1.0, 0.98, 0.95);
  // Kernschatten: Sonnenlicht, das die Erdatmosphäre bricht und rötet (Modell, stark aufgehellt)
  col += alb * vec3(0.75, 0.22, 0.06) * 0.4 * (1.0 - ecl) * max(dot(N, uSun) + 0.2, 0.0) * uGain;
  // Erdschein: Licht der (vom Mond aus gesehen) beleuchteten Erdseite, ebenfalls Lommel-Seeliger
  vec3 Ed = normalize(uEarth - vP);
  float e0 = max(dot(Nr, Ed), 0.0);
  col += alb * 2.0 * e0 / (e0 + mu) * uEarthshine * uEarthLit;
  gl_FragColor = vec4(col, 1.0);
}
`;
// Erde am Mondhimmel: Tagkarte mit Wolken, Stadtlichter, blauer Saum am Tagrand, roter Ring im Gegenlicht (Finsternis)
const EARTH_FRAG = /* glsl */ `
uniform sampler2D tDay, tNight, tClouds;
uniform vec3 uSun;
varying vec3 vN, vP;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float ndl = dot(N, uSun);
  float lit = clamp((ndl + 0.06) / 1.06, 0.0, 1.0);
  vec3 sunCol = mix(vec3(1.0, 0.5, 0.3), vec3(1.0), smoothstep(-0.02, 0.35, ndl));
  float cl = texture2D(tClouds, vUv).r;
  vec3 col = mix(texture2D(tDay, vUv).rgb, vec3(0.95), cl * 0.85) * lit * sunCol * 0.85;
  vec3 night = texture2D(tNight, vUv).rgb;
  col += night * night * vec3(1.0, 0.72, 0.42) * 2.2 * (1.0 - smoothstep(-0.1, 0.12, ndl)) * (1.0 - 0.7 * cl);
  float rim = 1.0 - max(dot(N, V), 0.0);
  col += vec3(0.25, 0.5, 1.0) * pow(rim, 3.0) * smoothstep(-0.2, 0.3, ndl) * 0.7;
  col += vec3(1.0, 0.35, 0.12) * pow(rim, 6.0) * smoothstep(0.9, 1.0, -dot(V, uSun)) * 0.8;
  gl_FragColor = vec4(col, 1.0);
}
`;
const SUN_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vDir;
void main() {
  float a = acos(clamp(dot(normalize(vDir), uSun), -1.0, 1.0));
  // Winkelradius der Sonnenscheibe 0,267° (Strahlungsdichte verdichtet; ohne Luft kein Himmelsblau, nur der Lichthof der Optik)
  float disk = smoothstep(0.00475, 0.00455, a);
  float glow = exp(-a / 0.012) * 5.0 + exp(-a / 0.08) * 0.15;
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * (disk * 900.0 + glow), 1.0);
}
`;
const SUN_VERT = /* glsl */ `
${SKY_VERTEX}
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = skyPosition(vDir); }
`;

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 3000);
  const earthP = PLANETS.find((p) => p.id === 'earth');
  let jd = julianDate(ctx.date), spdIdx = 2, rate = SPEEDS[spdIdx][0];

  // ---------- Lage: Mondsystem (körperfest) ↔ Ekliptik-Szene ----------
  const sun = new THREE.Vector3(), earthPos = new THREE.Vector3(), sunE = new THREE.Vector3(), geo = new THREE.Vector3();
  const P = new THREE.Vector3(), eW = new THREE.Vector3(), x0 = new THREE.Vector3(), z0 = new THREE.Vector3();
  const mB = new THREE.Matrix4(), qB = new THREE.Quaternion(), qInv = new THREE.Quaternion();
  const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -OBLIQUITY * RAD), qSpin = new THREE.Quaternion();
  const state = { dist: 384.4, lib: { l: 0, b: 0 }, illum: 0, earthLit: 0, umbra: 0 };

  // ---------- Himmel: Katalog (Yale BSC) + Milchstraßenband; drehen mit der Mondlage ----------
  const ngp = new THREE.Vector3(...eclDir(180.02, 29.81)), gc = new THREE.Vector3(...eclDir(266.84, -5.54));
  const sky = new THREE.Group();
  scene.add(sky);
  let catalog = null, pr = 1;
  const ready = createCatalogSky({ gain: 1.8, limit: 6.5 }).then((g) => { catalog = g; sky.add(g); g.userData.setPixelRatio(pr); })
    .catch((err) => {
      console.warn('[kosmos] Sternkatalog nicht geladen, statistischer Himmel:', err);
      catalog = createStarfield({ ngp, gc, gain: 0.8, seed: 13 });
      catalog.userData.setPixelRatio(pr);
      sky.add(catalog);
    });
  sky.add(createStarfield({ count: 1, ngp, gc, gain: 0, band: 1, glint: false, tex: ctx.tex }));
  const sunSky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG,
    uniforms: { uSun: { value: sun } }, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }));
  sunSky.frustumCulled = false;
  sunSky.renderOrder = -9;
  scene.add(sunSky);
  const flare = createFlare({ strength: 0.85 });
  scene.add(flare);

  // ---------- Mond ----------
  const tH = ctx.tex('moon_height.png', false);
  tH.wrapS = THREE.RepeatWrapping;
  const moonU = {
    tAlb: { value: ctx.tex('moon.jpg') }, tH: { value: tH }, uTexel: { value: new THREE.Vector2(1 / 1440, 1 / 720) },
    uSun: { value: sun }, uEarth: { value: earthPos }, uRelief: { value: 2 }, uEarthshine: { value: 0.04 }, uEarthLit: { value: 0 },
    uSunAng: { value: SUN_ANG }, uGain: { value: 1.15 },
  };
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R_M, 256, 128),
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: moonFrag(ctx.detail > 0.7 ? 14 : 8), uniforms: moonU }));
  scene.add(moon);

  // ---------- Erde am Himmel (maßstäblich) ----------
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R_E, 96, 48), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: EARTH_FRAG,
    uniforms: { tDay: { value: ctx.tex('earth_daymap.jpg') }, tNight: { value: ctx.tex('earth_nightmap.jpg') }, tClouds: { value: ctx.tex('earth_clouds.jpg', false) }, uSun: { value: sun } } }));
  scene.add(earth);

  const tmp = new THREE.Vector3();
  function place() {
    const mg = moonPosition(jd);
    sunE.set(...eclToScene(planetPosition(earthP, jd))).multiplyScalar(-1).normalize();   // Sonne von der Erde (≈ vom Mond)
    geo.set(...eclToScene(mg)).multiplyScalar(1e-3);
    state.dist = geo.length();
    const lib = moonLibration(jd);
    state.lib = lib;
    P.set(...eclDir(lib.node + 90, 90 - MOON_I));                   // Pol des Mondäquators (Cassini)
    eW.copy(geo).multiplyScalar(-1 / state.dist);                   // Richtung Mond → Erde
    // Nullmeridian: Erdrichtung in die Äquatorebene, um die Libration in Länge zurückgedreht
    x0.copy(eW).addScaledVector(P, -eW.dot(P)).normalize().applyAxisAngle(P, -lib.l * RAD);
    z0.crossVectors(x0, P);
    mB.makeBasis(x0, P, z0);
    qB.setFromRotationMatrix(mB);
    qInv.copy(qB).invert();
    sun.copy(sunE).applyQuaternion(qInv);
    earthPos.copy(eW).multiplyScalar(state.dist).applyQuaternion(qInv);
    sky.quaternion.copy(qInv);
    earth.position.copy(earthPos);
    earth.quaternion.copy(qInv).multiply(qTilt).multiply(qSpin.setFromAxisAngle(Y, gmst(jd) * RAD));
    // Phase: Mond von der Erde (beleuchteter Anteil) und Erde vom Mond (Gegenstück, treibt den Erdschein)
    const m = tmp.copy(geo).normalize().dot(sunE);
    state.illum = (1 - m) / 2;
    state.earthLit = (1 + m) / 2;
    moonU.uEarthLit.value = state.earthLit;
  }
  place();

  // ---------- Posen ----------
  const e = () => tmp.copy(earthPos).normalize();
  // Mond: von der Erdseite, zum Terminator gedreht (Phasenwinkel 70–110°), leicht von Norden
  function homePose() {
    const ed = e().clone(), cg = THREE.MathUtils.clamp(ed.dot(sun), -1, 1), g = Math.acos(cg);
    const w = ed.clone().addScaledVector(sun, -cg);
    if (w.lengthSq() < 1e-6) w.crossVectors(sun, Y);
    w.normalize();
    const g1 = THREE.MathUtils.clamp(g, 70 * RAD, 110 * RAD);
    const c = sun.clone().multiplyScalar(Math.cos(g1)).addScaledVector(w, Math.sin(g1)).addScaledVector(Y, 0.2).normalize();
    return { pos: c.multiplyScalar(R_M * 6.2), target: new THREE.Vector3(), up: Y };
  }
  const home = homePose();
  // Erdaufgang: Punkt am Rand (von der Erde aus) mit tiefer Sonne; die Kamera steht in 113 km Höhe so weit hinter dem Rand,
  // dass die Erde knapp über dem Horizont steht (Höhe δ − β über der Kimm, δ = Kimmtiefe)
  function riseSide() {
    const ed = e().clone(), a = sun.clone().addScaledVector(ed, -sun.dot(ed));
    const la = a.length();
    if (la < 1e-4) return new THREE.Vector3().crossVectors(ed, Y).normalize();
    a.divideScalar(la);
    const b = new THREE.Vector3().crossVectors(ed, a), phi = Math.acos(Math.min(1, 0.3 / la));
    return a.multiplyScalar(Math.cos(phi)).addScaledVector(b, Math.sin(phi));
  }
  const DIP = Math.acos(1 / (1 + ALT_RISE));
  function risePose(k, elev) {
    const ed = e().clone(), p = k.clone().addScaledVector(ed, -k.dot(ed)).normalize(), beta = DIP - elev;
    const u = p.clone().multiplyScalar(Math.cos(beta)).addScaledVector(ed, -Math.sin(beta));
    const pos = u.clone().multiplyScalar(R_M * (1 + ALT_RISE));
    return { pos, target: pos.clone().addScaledVector(ed, R_M * 3), up: u };
  }
  // Von der Erde: auf der Linie Mond–Erde – Phase und Libration wie mit dem Fernglas (Abstand verkürzt)
  const earthPose = () => ({ pos: e().clone().multiplyScalar(R_M * 8), target: new THREE.Vector3(), up: Y });

  // Blick-Wechsel: Kamera gleitet hin (Richtung auf der Kugel, Abstand logarithmisch) und hält, bis der Besucher selbst dreht
  const view = { mode: null, t: 0, from: null, k: null, rise: 0 };
  function setView(v) {
    view.mode = v === 'moon' ? 'home' : v;
    view.t = 0;
    view.from = null;
    view.rise = 0;
    view.k = v === 'rise' ? riseSide() : null;
  }
  const releaseView = () => { view.mode = null; };
  // Eingriff des Besuchers (Ziehen, Zoomen auf der Bühne) gibt die Kamera frei
  const canvas = ctx.renderer.domElement;
  canvas.addEventListener('pointerdown', releaseView);
  canvas.addEventListener('wheel', releaseView, { passive: true });
  function goal(dt) {
    if (view.mode === 'home') return homePose();
    if (view.mode === 'earth') return earthPose();
    // Erdaufgang: erst Erde 1,2° unter der Kimm, dann steigt sie in 14 s auf 3,5° (echt ≈ 1,5 min bei 2 h Umlauf)
    if (view.t >= 1) view.rise = Math.min(1, view.rise + dt / (ctx.still ? 0.5 : 14));
    return risePose(view.k, (-1.2 + 4.7 * ease(view.rise)) * RAD);
  }
  const qa = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3();
  function blendPos(out, a, b, k) {
    const ra = a.length(), rb = b.length();
    va.copy(a).normalize(); vb.copy(b).normalize();
    qa.setFromUnitVectors(va, vb);
    out.copy(va).applyQuaternion(new THREE.Quaternion().slerp(qa, k)).multiplyScalar(Math.exp(Math.log(ra) + (Math.log(rb) - Math.log(ra)) * k));
  }

  // ---------- Abzeichen (Gruppen über den Schalter „Abzeichen“) ----------
  let group = 'apollo', showEarth = true;
  const facing = (p, cam) => tmp.copy(cam.position).sub(p).normalize().dot(va.copy(p).normalize());
  const surf = (id, g, lat, lon, focus = 0.9) => {
    const pos = sel(lat, lon);
    return { id, kind: 'info', pos, focus: () => { releaseView(); return R_M * focus; }, visible: (cam) => group === g && facing(pos, cam) > 0.06 };
  };
  const phasePos = new THREE.Vector3();
  // Erde verdeckt? (Strahl Kamera → Erde schneidet die Mondkugel)
  const hidden = (cam) => {
    const d = vb.copy(earthPos).sub(cam.position), L = d.length();
    d.divideScalar(L);
    const s = -cam.position.dot(d);
    return s > 0 && s < L && cam.position.lengthSq() - s * s < R_M * R_M;
  };
  const hotspots = [
    { id: 'phase', kind: 'info', pos: phasePos, focus: () => { releaseView(); return R_M * 1.1; }, visible: (cam) => facing(phasePos, cam) > 0.06 },
    { id: 'earth', kind: 'info', pos: earthPos, visible: (cam) => showEarth && !hidden(cam) },
    // Landestellen der Mondfähren (NSSDCA, LRO-Koordinaten, Wagner et al. 2017)
    surf('apollo11', 'apollo', 0.67416, 23.47314, 0.6),
    surf('apollo12', 'apollo', -3.0128, -23.4219, 0.6),
    surf('apollo15', 'apollo', 26.13239, 3.63330, 0.6),
    surf('apollo17', 'apollo', 20.1911, 30.7723, 0.6),
    // Krater und Meere (Mitten nach dem IAU-Verzeichnis, gerundet; Tycho USGS)
    surf('tycho', 'geo', -43.30, -11.22, 0.7),
    surf('copernicus', 'geo', 9.62, -20.08, 0.7),
    surf('imbrium', 'geo', 32.8, -15.6, 1.4),
    surf('tranquillitatis', 'geo', 8.35, 30.83, 1.4),
    surf('procellarum', 'geo', 18.4, -57.4, 1.6),
    surf('crisium', 'geo', 16.18, 59.1, 1.1),
    // Pole und Rückseite
    surf('southpole', 'poles', -89.5, 0, 0.8),
    surf('aitken', 'poles', -53, -169, 1.6),
    surf('farside', 'poles', 10, 180, 1.8),
  ];

  // ---------- Schalter der Infotafel ----------
  const controls = [
    { id: 'view', label: 'Blick', value: 'moon', options: [['moon', 'Mond'], ['earth', 'Von der Erde'], ['rise', 'Erdaufgang']], set: setView },
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: spdIdx, min: 0, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (v) => setSpeed(Math.round(v)), get: () => (rate ? spdIdx : 0) },
    { id: 'marks', label: 'Abzeichen', value: group, options: [['apollo', 'Apollo'], ['geo', 'Krater & Meere'], ['poles', 'Pole & Rückseite']], set: (v) => { group = v; } },
    { id: 'eclipse', type: 'action', label: 'Ereignis', button: 'Mondfinsternis 26.06.2029', run: () => {
      jd = julianDate(new Date(ECLIPSE)) - 1.9 / 24;
      setSpeed(1);
      setView('earth');
    } },
  ];
  function setSpeed(i) {
    if (i > 0) { spdIdx = i; rate = SPEEDS[i][0]; } else { rate = 0; jd = julianDate(new Date()); }
    refreshLayers();
  }

  // ---------- Ebenen (Zahnrad „Station · Mond“, Zeitleiste) ----------
  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
  const de1 = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°`;
  registerLayers('moon', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', hint: 'Mondphase, Libration, Erddrehung und Sternhimmel im gewählten Tempo; Pause = Echtzeit.',
      value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, autoplay: true, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, playing) => { spdIdx = Math.max(1, Math.round(i)); rate = playing ? SPEEDS[spdIdx][0] : 0; if (!playing) jd = julianDate(new Date()); },
      get: () => ({ value: spdIdx, playing: rate !== 0 }), status: () => `${fmt.format(new Date((jd - 2440587.5) * 864e5))} UTC${rate ? '' : ' · Echtzeit'}` },
    { id: 'relief', type: 'range', group: 'Oberfläche', label: 'Relief-Überhöhung', value: 2, min: 0, max: 5, step: 0.5, unit: '×',
      hint: 'Höhen der Laseraltimetrie LOLA (≈ 7,6 km je Bildpunkt). 1× = maßstäblich; 0 = glatte Kugel.', set: (v) => { moonU.uRelief.value = v; } },
    { id: 'earthshine', type: 'range', group: 'Licht', label: 'Erdschein', value: 1, min: 0, max: 3, step: 0.25, unit: '×',
      hint: 'Licht der Erde auf der Nachtseite, am stärksten bei schmaler Mondsichel (volle Erde). Schon 1× ist mehr als hundertfach aufgehellt (eigene Abschätzung).', set: (v) => { moonU.uEarthshine.value = 0.04 * v; } },
    { id: 'earth', type: 'toggle', group: 'Himmel', label: 'Erde am Himmel', value: true, set: (v) => { showEarth = v; earth.visible = v; } },
  ]);

  const occluders = [{ center: new THREE.Vector3(), radius: R_M }, { center: earthPos, radius: R_E }];
  const sunFar = new THREE.Vector3();

  return {
    scene, camera, home, unit: 1e6, hotspots, controls, ready,
    orbit: { minDistance: 0.02, maxDistance: 120, cineSpeed: 0.5 },
    look: { exposure: 1.0, bloom: 0.05, sat: 1.04 },
    update(dt, t, cam, flying) {
      if (!flying) jd += rate ? dt * rate : dt / DAY;
      place();
      // Abzeichen Terminator: Punkt der Schattengrenze, der der Erde am nächsten liegt
      const ed = e(), s = ed.dot(sun);
      phasePos.copy(ed).addScaledVector(sun, -s);
      if (phasePos.lengthSq() < 1e-6) phasePos.crossVectors(sun, Y);
      phasePos.setLength(R_M);
      // Kernschatten (für die Zeile unter dem Titel): Mondmitte in der Erdschatten-Achse?
      const n = tmp.copy(earthPos).normalize(), aE = Math.asin(R_E * 1.02 / state.dist), th = Math.acos(THREE.MathUtils.clamp(n.dot(sun), -1, 1));
      state.umbra = n.dot(sun) > 0 ? (th < aE - SUN_ANG - R_M / state.dist ? 2 : th < aE + SUN_ANG + R_M / state.dist ? 1 : 0) : 0;
      sunFar.copy(sun).multiplyScalar(2500);
      cam.updateMatrixWorld();
      flare.userData.update(sunFar, cam, occluders, settings.S.lens, dt);
    },
    orbitUpdate(c, dt) {
      const o = c.object;
      let free;
      if (view.mode) {
        if (!view.from) { view.from = { pos: o.position.clone(), target: c.target.clone(), up: o.up.clone() }; free = 'free'; }
        const gl = goal(dt);
        view.t = Math.min(1, view.t + dt / (ctx.still ? 0.5 : 2.2));
        const k = ease(view.t);
        blendPos(o.position, view.from.pos, gl.pos, k);
        c.target.copy(view.from.target).lerp(gl.target, k);
        o.up.copy(view.from.up).lerp(gl.up, k).normalize();
        o.lookAt(c.target);
        if (view.mode === 'home' && view.t >= 1) releaseView();
      } else if (o.up.distanceToSquared(Y) > 1e-8) o.up.lerp(Y, Math.min(1, dt * 1.5)).normalize();
      // über der Oberfläche bleiben (≥ 20 km); Nahebene mit der Höhe
      const r = o.position.length();
      if (r < R_M * 1.012) o.position.multiplyScalar(R_M * 1.012 / r);
      const nr = THREE.MathUtils.clamp((o.position.length() - R_M) * 0.3, 0.002, 0.05);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
      return free;
    },
    live: () => {
      const L = state.lib;
      return `${fmt.format(new Date((jd - 2440587.5) * 864e5))} UTC · ${Math.round(state.illum * 100)} % beleuchtet · Libration ${de1(L.l)} Länge, ${de1(L.b)} Breite · `
        + `Erde ${Math.round(state.dist * 1e3).toLocaleString('de-DE')} km${state.umbra === 2 ? ' · totale Mondfinsternis' : state.umbra === 1 ? ' · im Erdschatten' : ''}`;
    },
    setPixelRatio: (p) => { pr = p; if (catalog) catalog.userData.setPixelRatio(p); },
    dispose() {
      canvas.removeEventListener('pointerdown', releaseView);
      canvas.removeEventListener('wheel', releaseView);
      scene.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); });
    },
  };
}
