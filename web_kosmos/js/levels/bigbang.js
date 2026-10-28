// Station 11: Urknall – Film von 55 s in der Reihenfolge der Kosmologie (Rückmeldung des Users 27.10.2026: „annähernd
// realistisch“, Durchflug durch die Galaxien im Film, danach Landung in Station 10; Knall:A aus der Vorschau 26.10.2026
// bleibt). Zeit stückweise logarithmisch, je Abschnitt ein eigenes Bild:
// · Anfang: Lichtblitz verlischt schnell, im Plasma flimmern die Keime des Netzes (dieselben Fäden wie später).
// · Erstes Licht ≈ 370.000 J: die Glut kühlt nach Planck-Farbe (gelb-weiß → orange → dunkelrot → schwarz), der Nebel
//   wird durchsichtig; das Muster zeigt sich als Flecken wie in der Hintergrundstrahlung.
// · Dunkles Zeitalter: fast dunkel, die Fäden ziehen sich schwach violett zusammen.
// · Erste Sterne ≈ 180 Mio. J: blau-weiße Funken nur in den dichtesten Knoten, kurze Supernova-Blitze.
// · Erste Galaxien 0,3–1 Mrd. J: klein, blau, klumpig auf den Fäden, dichteste Knoten zuerst.
// · Durchflug 1 → 13,8 Mrd. J: Fahrt vorwärts entlang eines Fadens, die Galaxien reifen (größer, Spiralen, rote
//   Ellipsen in den Knoten, Paare), am Ende Zug hinaus: das ganze Netz voller Galaxien.
// Ein Netz für alles (cosmicweb.js, einmal auf der CPU gerechnet): dieselbe Dichte zeichnet die Fäden (3D-Textur, in halber
// Auflösung durchstrahlt, vol.js offscreen), setzt Sterne, Galaxien und Lichtpunkte und bestimmt ihre Geburt (dicht =
// früh). Die Kamera bleibt bedienbar: statt sie zu fahren, bewegt sich der Raum – Gruppe in mitbewegten Koordinaten
// (Front = 1) mit Maßstab Rw und Versatz u entlang der Flugachse. Mausrad, Ziehen und Leerlauf-Fahrt gelten wie in jeder
// Station, der Regler „Stelle im Film“ spult alles. Der Mittelpunkt ist nur Darstellung (Hinweis im Film, Feld note).

import * as THREE from 'three';
import { registerLayers } from '../layers.js';
import { NOISE } from '../glsl.js';
import { offscreen, disposeScene } from '../vol.js';
import { mulberry32, gauss, blackbody, GLY } from '../astro.js';
import { settings } from '../settings.js';
import { galaxyAtlas, galaxySprites, glowPoints, randTurn, TILES } from '../galaxyflight.js';
import { smoothKeys } from '../flightplan.js';
import { bakeWeb, sampleWeb, flightAxis, inTube, EXT, THIN } from '../cosmicweb.js';

export const DUR = 55;
// Verläufe über die Filmsekunde als glatte Kurven (smoothKeys: kein Halt an den Stützstellen, kein Überschwingen).
// Rw = Radius der Front in Szeneneinheiten (Heimpose 26 vor der Mitte), u = Fahrt entlang der Flugachse (mitbewegt)
const CURVE = {
  Rw: smoothKeys([[0, 2], [1, 6], [5, 13], [10, 17], [15, 19], [21, 21], [32, 24], [38, 32], [44, 46], [48, 56], [51, 26], [DUR, 9.5]], { log: true, flat: true }),
  u: smoothKeys([[0, 0], [31, 0], [34, 0.12], [40, 0.4], [46, 0.62], [48.5, 0.66], [DUR, 0]], { flat: true }),
  flash: smoothKeys([[0, 0], [0.25, 5], [1.2, 2.4], [3, 0.6], [5, 0.08], [7, 0]]),
  core: smoothKeys([[0, 0.06], [1.2, 0.14], [5, 0.2]]),
  plasma: smoothKeys([[0, 0], [0.4, 1], [5.5, 1], [8, 0.6], [10.5, 0.1], [13, 0]]),
  temp: smoothKeys([[0, 25000], [2.5, 11000], [5.5, 5500], [7.5, 3000], [9, 1800], [10.5, 1100], [13, 700]], { log: true }),
  fog: smoothKeys([[0, 4], [6, 4], [8.5, 0.25], [10, 0]]),
  spots: smoothKeys([[0, 0.1], [5, 0.25], [7.5, 0.9], [10, 1]]),
  seed: smoothKeys([[0, 1], [4, 0.7], [7, 0.2], [9, 0]]),
  web: smoothKeys([[0, 0], [8, 0], [10.5, 0.3], [15, 0.45], [21, 0.9], [32, 0.9], [38, 0.45], [47, 0.35], [51, 0.6], [DUR, 0.85]]),
  thin: smoothKeys([[0, THIN - 0.16], [9, THIN - 0.12], [15, THIN], [21, THIN + 0.02]]),
  exposure: smoothKeys([[0, 0.45], [5, 0.6], [10, 1], [15, 1.3], [21, 1.15], [32, 1], [DUR, 1]]),
  bloom: smoothKeys([[0, 0.08], [6, 0.12], [15, 0.14], [DUR, 0.12]]),
};
// Abschnitte mit Zeitangabe, Zahlen wie in der Infotafel (content.js)
const SECTIONS = [
  [5, 'Der Anfang · heiß und dicht'], [10, 'Erstes Licht · ≈ 370.000 Jahre'], [15, 'Dunkles Zeitalter · bis ≈ 100 Mio. Jahre'],
  [21, 'Erste Sterne · ≈ 180 Mio. Jahre'], [32, 'Erste Galaxien · 0,3–1 Mrd. Jahre'], [49, 'Durchflug · 1 → 13,8 Mrd. Jahre'],
  [DUR + 1, 'Heute · 13,8 Mrd. Jahre'],
];
const HINT = { from: 1, to: 9, text: 'Der Urknall war keine Explosion an einem Ort: Der Raum selbst dehnte sich überall zugleich aus.' };
const SPEEDS = [[0.5, '0,5×'], [1, '1×'], [2, '2×'], [4, '4×']];
const D0 = 26;   // Abstand der Heimpose
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const sectionAt = (t) => SECTIONS.find(([end]) => t < end)[1];

const BG_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }';
const BG_FRAG = /* glsl */ `
${NOISE}
uniform mat4 uInvProj, uCamWorld; uniform vec3 uCamPos, uRight, uUp, uCenter;
uniform highp sampler3D uField;
uniform float uFlash, uCoreSize, uR, uWeb, uThin, uStreak, uPlasma, uFog, uSpots, uSeed, uTime;
uniform vec3 uWebA, uWebB, uGlow;
varying vec2 vUv;
vec3 rayDir() { vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); v /= v.w; return normalize((uCamWorld * vec4(v.xyz, 0.0)).xyz); }
void main() {
  vec3 rd = rayDir(), col = vec3(0.0);
  vec3 toC = uCenter - uCamPos; float dC = max(length(toC), 1e-4); vec3 fc = toC / dC;
  // Blitz: heller Kern, Strahlenkranz (Winkel-Rauschen um die Blickachse), breiter Schein über das ganze Bild
  if (uFlash > 0.0) {
    float a = acos(clamp(dot(rd, fc), -1.0, 1.0)) / max(uCoreSize, 1e-4);
    vec3 ax = normalize(cross(fc, abs(fc.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    float phi = atan(dot(rd, ax), dot(rd, cross(ax, fc)));
    float rays = 0.55 + 0.45 * gnoise(vec3(phi * 9.0, 0.0, 1.7)) * gnoise(vec3(phi * 23.0, 2.0, 0.3));
    col += vec3(0.86, 0.82, 1.0) * uFlash * (6.0 * exp(-a * a * 6.0) + 0.7 / (1.0 + a * a * 4.0) * rays + 0.05 / (1.0 + a * a * 0.08));
    // Lichtstreifen: waagerecht im Bild durch den Kern (anamorph), nur vor der Kamera
    if (uStreak > 0.0 && dot(rd, fc) > 0.0) {
      float dx = dot(rd - fc, uRight), dy = dot(rd - fc, uUp), w = 0.004 + 0.04 * uCoreSize;
      col += vec3(0.78, 0.68, 1.0) * uFlash * uStreak * exp(-dy * dy / (w * w)) * (0.9 * exp(-abs(dx) / 0.08) + 0.5 * exp(-abs(dx) / 0.5));
    }
  }
  // Raum innerhalb der Front: Plasma (glüht in Planck-Farbe, trüb) und Netz (Fäden aus dem Grat-Rauschen)
  if (uWeb > 0.0 || uPlasma > 0.0) {
    vec3 oc = uCamPos - uCenter;
    float b = dot(oc, rd), c = dot(oc, oc) - uR * uR * 1.1025, h = b * b - c;
    if (h > 0.0 && -b + sqrt(h) > 0.0) {
      float t0 = max(0.0, -b - sqrt(h)), t1 = -b + sqrt(h);
      const int N = 56;
      float dt = (t1 - t0) / float(N), ds = dt / uR, j = hash12(gl_FragCoord.xy), tr = 1.0;
      for (int i = 0; i < N; i++) {
        vec3 q = (uCamPos + rd * (t0 + (float(i) + j) * dt) - uCenter) / uR;
        float front = smoothstep(1.0, 0.8, length(q));
        if (front <= 0.0) continue;
        vec4 f = texture(uField, q * ${(1 / (2 * EXT)).toFixed(5)} + 0.5);
        float g = f.g * 2.0 - 1.0;
        float d = pow(smoothstep(uThin, 0.95, f.r), 2.5) * smoothstep(-0.1, 0.4, g);
        vec3 e = mix(uWebA, uWebB, f.b) * d * uWeb * 6.5;
        if (uPlasma > 0.0) {
          // Flecken aus der großräumigen Dichte (wie in der Hintergrundstrahlung), feines Flimmern der Netz-Keime
          float m = 1.0 + uSpots * (g * 2.2 + (f.r - 0.5) * 0.8) + uSeed * (f.r - 0.45) * (1.2 + 0.6 * sin(uTime * 19.0 + f.b * 40.0));
          e += uGlow * uPlasma * max(m, 0.0) * 1.6;
        }
        col += tr * e * front * ds;
        tr *= exp(-(d * 2.5 + uFog) * front * ds);
        if (tr < 0.01) break;
      }
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 9000);
  const dir = new THREE.Vector3(0.24, 0.1, 0.96).normalize();   // Flugachse (nach dem Backen entlang des Netzes)
  const home = { pos: dir.clone().multiplyScalar(D0), target: new THREE.Vector3() };
  const tex = galaxyAtlas();
  const k = Math.max(0.6, ctx.detail);

  // Hintergrund: Blitz, Lichtstreifen, Plasma und Netz in eigener (halber) Auflösung
  let field = null;
  const bgU = {
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
    uRight: { value: new THREE.Vector3(1, 0, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uCenter: { value: new THREE.Vector3() }, uField: { value: null },
    uFlash: { value: 0 }, uCoreSize: { value: 0.1 }, uR: { value: 1 }, uWeb: { value: 0 }, uThin: { value: THIN }, uStreak: { value: 0.55 },
    uPlasma: { value: 0 }, uFog: { value: 0 }, uSpots: { value: 0 }, uSeed: { value: 0 }, uTime: { value: 0 },
    uWebA: { value: new THREE.Vector3(0.42, 0.2, 0.95) }, uWebB: { value: new THREE.Vector3(0.95, 0.32, 0.85) }, uGlow: { value: new THREE.Vector3() },
  };
  const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: bgU, depthTest: false, depthWrite: false }));
  bgMesh.frustumCulled = false;
  bgMesh.onBeforeRender = (r, s, cam) => {
    bgU.uInvProj.value.copy(cam.projectionMatrixInverse);
    bgU.uCamWorld.value.copy(cam.matrixWorld);
    bgU.uCamPos.value.copy(cam.position);
    bgU.uRight.value.setFromMatrixColumn(cam.matrixWorld, 0);
    bgU.uUp.value.setFromMatrixColumn(cam.matrixWorld, 1);
  };
  const bg = offscreen(ctx.renderer, bgMesh);
  bg.quad.renderOrder = -10;
  scene.add(bg.quad);

  // Raum in mitbewegten Koordinaten (Front = 1): Sterne, Supernovae, Galaxien, Lichtpunkte – entsteht nach dem Backen
  const bang = new THREE.Group();
  scene.add(bang);
  let pop = null;
  const hsExp = new THREE.Vector3(), hsGal = new THREE.Vector3(), galSeed = new THREE.Vector3();
  const expDir = new THREE.Vector3(-0.55, 0.42, 0.2).normalize();

  async function build() {
    const w = await bakeWeb(112, () => new Promise((r) => setTimeout(r, 0)));
    field = bgU.uField.value = new THREE.Data3DTexture(w.data, w.size, w.size, w.size);
    field.minFilter = field.magFilter = THREE.LinearFilter;
    field.unpackAlignment = 1;
    field.needsUpdate = true;
    const rand = mulberry32(11);
    dir.fromArray(flightAxis(w, rand, dir.toArray()));
    home.pos.copy(dir).multiplyScalar(D0);
    const V = (s) => new THREE.Vector3(s.x, s.y, s.z);
    // Rang nach Dichte → Zeitpunkt: dicht = früh (frac 0 … 1)
    const ranked = (list) => list.sort((a, b) => b.d - a.d).map((s, i) => Object.assign(s, { frac: (i + rand()) / list.length }));
    // Erste Sterne in den dichtesten Knoten (blau-weiß, verlöschen, wenn die Galaxien übernehmen), dazu Supernova-Blitze
    const sites = ranked(sampleWeb(w, rand, Math.round(1400 * k), { power: 3, top: 0.2 }));
    const stars = glowPoints(sites.map((s) => ({ pos: V(s), size: 0.005, col: blackbody(18000 + rand() * 7000).map((v) => v * (1.4 + rand())),
      birth: 15 + 6 * Math.pow(s.frac, 1.3), end: 27 + rand() * 5 })));
    stars.material.uniforms.uFade.value = 0.8;
    const novae = glowPoints(Array.from({ length: Math.round(70 * k) }, () => {
      const s = sites[Math.floor(rand() * sites.length)], b = 16.5 + rand() * 9;
      return { pos: V(s), size: 0.022, col: blackbody(9000).map((v) => v * 5), birth: b, end: b + 0.15 };
    }));
    novae.material.uniforms.uFade.value = 0.35;
    // Galaxien: jung klein, blau, klumpig; reifen im Durchflug zu Spiralen, in dichten Knoten zu roten Ellipsen
    const galaxy = (s, near) => {
      const ell = s.d > 0.12 && rand() < 0.5, mat = ell ? TILES.ellip : TILES.spiral;
      return { pos: V(s), size: (near ? 0.006 : 0.008) * Math.exp(gauss(rand) * 0.35), gain: 1.6 + rand() * 1.4,
        tile: TILES.first[Math.floor(rand() * TILES.first.length)], tint: blackbody(14000 + rand() * 11000),
        tile2: mat[Math.floor(rand() * mat.length)], tint2: ell ? blackbody(3900 + rand() * 700) : blackbody(5600 + rand() * 2200),
        birth: near ? 21 + 12 * s.frac : 21 + 15 * Math.pow(s.frac, 1.6), mature: 33 + 13 * s.frac + rand() * 3, grow: 2 + rand() * 1.4, ...randTurn(rand) };
    };
    // nah an der Flugachse eigene Galaxien (Schlauch um die Fahrt), damit der Durchflug dicht an ihnen vorbeiführt
    const far = ranked(sampleWeb(w, rand, Math.round(5000 * k), { top: 0.15 }));
    const near = ranked(sampleWeb(w, rand, Math.round(1600 * k), { top: 0.08, power: 0.6, pick: inTube(dir.toArray(), [-0.6, 0.95], [0.035, 0.16]) }));
    const gals = galaxySprites([...far.map((s) => galaxy(s, false)), ...near.map((s) => galaxy(s, true))], tex);
    Object.assign(gals.material.uniforms, { uFade: { value: 1.2 }, uMature: { value: 5 } });
    galSeed.copy(V(far[0]));
    // ferne, schwache Galaxien als Lichtpunkte auf dem Netz
    const dust = glowPoints(ranked(sampleWeb(w, rand, Math.round(20000 * k), { top: 0.1, power: 0.5 })).map((s) => ({
      pos: V(s), size: 0.0035, col: blackbody(4500 + rand() * 6000).map((v) => v * (0.4 + rand())), birth: 22 + 20 * Math.pow(s.frac, 1.3) })));
    dust.material.uniforms.uFade.value = 1.5;
    bang.add(dust, stars, novae, gals);
    pop = { stars, novae, gals, dust, all: [stars, novae, gals, dust] };
    for (const m of pop.all) m.material.uniforms.uGain.value = galGain;
    if (px) for (const m of [stars, novae, dust]) m.material.uniforms.uPx.value = px;
  }

  // Film: Stand in Sekunden, Tempo, Abspielen; still = reduzierte Bewegung → Standbild am Ende (Netz voller Galaxien)
  const film = { t: ctx.still ? DUR : 0, dur: DUR, playing: !ctx.still, spd: 1, tempo: 1 };
  let hintOn = true, streakOn = true, webGain = 1, galGain = 1, px = 0;
  const look = { exposure: 0.5, bloom: 0.1, sat: 1.04, con: 0.1, vig: 0.45 };
  function apply() {
    const t = film.t, Rw = CURVE.Rw(t), u = CURVE.u(t);
    // Welt = (mitbewegt − F) · Rw mit F = −u · Achse: die Kamera fliegt (scheinbar) entlang der Achse durch das Netz
    bang.scale.setScalar(Rw);
    bang.position.copy(dir).multiplyScalar(u * Rw);
    if (pop) for (const m of pop.all) { m.material.uniforms.uT.value = t; m.material.uniforms.uS.value = Rw; }
    bgU.uCenter.value.copy(bang.position);
    bgU.uR.value = Rw;
    bgU.uFlash.value = CURVE.flash(t);
    bgU.uCoreSize.value = CURVE.core(t);
    bgU.uStreak.value = streakOn && settings.S.lens && settings.S.anamorphic !== false ? 0.55 : 0;
    bgU.uWeb.value = CURVE.web(t) * webGain;
    bgU.uThin.value = CURVE.thin(t);
    const T = CURVE.temp(t), pl = CURVE.plasma(t);
    bgU.uPlasma.value = pl;
    if (pl > 0) bgU.uGlow.value.fromArray(blackbody(T)).multiplyScalar(Math.pow(T / 3000, 1.2));
    bgU.uFog.value = CURVE.fog(t);
    bgU.uSpots.value = CURVE.spots(t);
    bgU.uSeed.value = CURVE.seed(t);
    bgU.uTime.value = t;
    look.exposure = CURVE.exposure(t);
    look.bloom = CURVE.bloom(t);
    hsExp.copy(expDir).multiplyScalar(Rw * 0.55).add(bang.position);
    hsGal.copy(galSeed).multiplyScalar(Rw).add(bang.position);
    bg.invalidate();
  }
  // Abzeichen nur, solange die Szene von außen zu sehen ist (nicht im Durchflug)
  const outside = () => film.t < 31 || film.t > 53;

  registerLayers('bigbang', [
    { id: 'film', type: 'play', group: 'Film', label: 'Film', value: film.spd, min: 0, max: SPEEDS.length - 1, step: 1, autoplay: !ctx.still,
      fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, p) => { film.spd = Math.round(i); if (p && !film.playing && film.t >= DUR - 0.05) film.t = 0; film.playing = p; },
      get: () => ({ value: film.spd, playing: film.playing }),
      status: () => `${mmss(film.t)} / ${mmss(DUR)} · ${sectionAt(film.t)}` },
    { id: 'hint', type: 'toggle', label: 'Hinweis „keine Explosion an einem Ort“', value: true, set: (v) => { hintOn = v; },
      hint: 'Kurze Zeile in den ersten Sekunden des Films.', active: () => film.t < HINT.to, only: 'Erscheint nur in den ersten Sekunden des Films.' },
    { id: 'streak', type: 'toggle', group: 'Blitz', label: 'Lichtstreifen', value: true, set: (v) => { streakOn = v; apply(); },
      active: () => settings.S.lens, only: 'Wirkt nur mit „Linsenreflex“ im Reiter Global.' },
    { id: 'web', type: 'range', group: 'Netz der Materie', label: 'Helligkeit', value: 1, min: 0, max: 3, step: 0.1, unit: '×', set: (v) => { webGain = v; apply(); } },
    { id: 'galGain', type: 'range', group: 'Sterne und Galaxien', label: 'Helligkeit', value: 1, min: 0, max: 3, step: 0.1, unit: '×',
      active: () => film.t > 15, only: 'Die ersten Sterne leuchten ab 0:15 im Film auf.',
      set: (v) => { galGain = v; if (pop) for (const m of pop.all) m.material.uniforms.uGain.value = v; } },
  ]);
  const controls = [
    { id: 'pos', label: 'Stelle im Film', type: 'range', show: true, min: 0, max: DUR, step: 0.5, value: film.t, fmt: (v) => `${mmss(v)} · ${sectionAt(v)}`,
      get: () => film.t, set: (v) => { film.t = v; apply(); } },
    { id: 'again', type: 'action', label: 'Film', button: 'Von vorn abspielen', run: () => { film.t = 0; film.playing = true; apply(); } },
  ];
  const hotspots = [
    { id: 'cmb', kind: 'dive', to: 'cmb', pos: new THREE.Vector3() },
    { id: 'expansion', kind: 'info', pos: hsExp, visible: () => film.t > 3 && outside() },
    { id: 'galaxies', kind: 'info', pos: hsGal, visible: () => film.t > 24 && outside() },
  ];
  apply();

  return {
    scene, camera, unit: 2.7 * GLY, hotspots, controls, home, look, film,
    orbit: { minDistance: 4, maxDistance: 140, cineSpeed: 0.5 },
    ready: build().then(() => { apply(); return ctx.renderer.compileAsync(scene, camera); }),
    update(dt, t, cam) {
      if (film.playing && film.t < DUR) {
        film.t = Math.min(DUR, film.t + dt * SPEEDS[film.spd][0] * film.tempo);
        if (film.t >= DUR) film.playing = false;
      }
      apply();
      bg.render(cam);
    },
    // Hinweis-Zeile über der Bühne (main.js → hud.hint): angeboten in den ersten Sekunden des Films, die HUD zeigt sie 4,5 s,
    // sobald der Stationstitel ausgeblendet ist
    hint: () => (hintOn && film.t > HINT.from && film.t < HINT.to ? HINT.text : ''),
    restart(t0 = 0, tempo = 1) { film.t = t0; film.tempo = tempo; film.playing = true; apply(); },
    live: () => `${sectionAt(film.t)} · ${mmss(film.t)} von ${mmss(DUR)} · Darstellung, nicht maßstäblich`,
    // Fahrt hinaus aus Station 10 beginnt (main.js hop): Film von vorn, der Blitz kommt vor der Landung
    enter() { if (!ctx.still) { film.t = 0; film.tempo = 1; film.playing = true; apply(); } },
    setPixelRatio(pr, H) {
      px = H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      if (pop) for (const m of [pop.stars, pop.novae, pop.dust]) m.material.uniforms.uPx.value = px;
      bg.setSize(Math.round(H * camera.aspect), H);
    },
    dispose: () => { disposeScene(scene); bg.dispose(); if (field) field.dispose(); tex.dispose(); },
  };
}
