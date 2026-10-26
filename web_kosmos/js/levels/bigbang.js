// Station 11: Urknall (Vorschau 26.10.2026 „Urknall und Kamerafahrt durch die Galaxien“: Ort:A, Knall:A, Film 45 s).
// Film mit Zeitleiste in vier Abschnitten: Blitz (weißer Lichtblitz mit Lichtstreifen), Netz (violettes Netz der Materie
// wächst mitbewegt aus dem Blitz), Galaxien (leuchten nach und nach auf), Hinaus (der Raum wächst weiter, der Blitz wird zum
// Punkt in einem Feld voller Galaxien). Die Kamera bleibt bedienbar: statt sie hinauszufahren, schrumpft die Szene um den
// Ursprung (Maßstab s = Abstand am Start / Abstand im Film) – dasselbe Bild, und Mausrad, Ziehen und Leerlauf-Fahrt gelten
// wie in jeder Station. Das Netz ist Grat-Rauschen in mitbewegten Koordinaten (Abstand / Radius der Front), einmal in eine
// 3D-Textur gebacken und in halber Auflösung durchstrahlt (vol.js). Der Mittelpunkt ist nur Darstellung: Der Raum dehnte sich
// überall zugleich aus (Hinweis im Film, Feld note). Bringt den Galaxien-Flug zu Station 10 mit (fly, galaxyflight.js).

import * as THREE from 'three';
import { registerLayers } from '../layers.js';
import { NOISE } from '../glsl.js';
import { bakeField, offscreen, disposeScene } from '../vol.js';
import { mulberry32, gauss, blackbody, GLY } from '../astro.js';
import { settings } from '../settings.js';
import { galaxyAtlas, galaxySprites, glowPoints, createCorridor, randTurn } from '../galaxyflight.js';
import { smoothKeys, FLIGHT } from '../flightplan.js';

export const DUR = 45;
// Filmsekunde → Stand des Modells T (Stützwerte des Prototyps): Zündung in 1 s, Blitz bis 6 s, Netz bis 18 s, Galaxien bis
// 32 s, danach weiter hinaus und am Ende weich auslaufend. Alle Verläufe als glatte Kurven (smoothKeys): keine Halte an den
// Stützstellen, die Fahrt hinaus fließt durch den ganzen Film
const tAt = smoothKeys([[0, 0], [1, 0.05], [6, 0.12], [18, 0.3], [32, 0.6], [DUR, 0.95]], { flat: true });
const CURVE = {
  dist: smoothKeys([[0, 18], [0.05, 26], [0.3, 60], [0.6, 150], [0.95, 340]], { log: true }),
  R: smoothKeys([[0, 8], [0.05, 14], [0.3, 80], [0.6, 260], [0.95, 700]], { log: true }),
  flash: smoothKeys([[0, 0], [0.04, 4], [0.3, 2.4], [0.6, 1.0], [0.95, 0.35]]),
  core: smoothKeys([[0.05, 3.2], [0.3, 3.4], [0.6, 2.5], [0.95, 1.6]]),
  web: smoothKeys([[0, 0], [0.05, 0.5], [0.3, 1.3], [0.6, 1.1], [0.95, 0.3]]),
  hot: smoothKeys([[0.05, 1.0], [0.3, 0.6], [0.6, 0.3], [0.95, 0.1]]),
  exposure: smoothKeys([[0.05, 0.45], [0.3, 0.7], [0.6, 0.9], [0.95, 1.0]]),
  bloom: smoothKeys([[0.05, 0.08], [0.3, 0.12], [0.6, 0.14], [0.95, 0.14]]),
};
const SECTIONS = [[6, 'Blitz'], [18, 'Netz der Materie'], [32, 'Galaxien leuchten auf'], [DUR + 1, 'Der Raum wächst weiter']];
const HINT = { from: 3.5, to: 16, text: 'Der Urknall war keine Explosion an einem Ort: Der Raum selbst dehnte sich überall zugleich aus.' };
const SPEEDS = [[0.5, '0,5×'], [1, '1×'], [2, '2×'], [4, '4×']];
const D0 = 26;   // Abstand der Heimpose; Szene im Maßstab D0 / Abstand des Prototyps
const EXT = 2.8, Q_SCALE = 2.6;   // Netz: gebackener Würfel ±EXT, Muster = (Ort − Kern) / Radius × Q_SCALE
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Netz als gebackenes Feld: r = Grat-Rauschen (Fäden), g = großräumige Dichte (Leerräume), b = Farbmischung
const FIELD = /* glsl */ `
vec4 field(vec3 q) { return vec4(ridged(q + 11.0, 4), fbm(q * 0.45 + 15.0, 3), gnoise(q * 0.7 + 20.0), 1.0); }`;
const BG_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }';
const BG_FRAG = /* glsl */ `
${NOISE}
uniform mat4 uInvProj, uCamWorld; uniform vec3 uCamPos, uRight, uUp;
uniform highp sampler3D uField;
uniform float uFlash, uCoreSize, uR, uWeb, uHot, uStreak;
uniform vec3 uWebA, uWebB;
varying vec2 vUv;
vec3 rayDir() { vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); v /= v.w; return normalize((uCamWorld * vec4(v.xyz, 0.0)).xyz); }
void main() {
  vec3 rd = rayDir(), col = vec3(0.0);
  vec3 toC = -uCamPos; float dC = max(length(toC), 1e-4); vec3 fc = toC / dC;
  float ang = acos(clamp(dot(rd, fc), -1.0, 1.0)), a = ang / max(uCoreSize, 1e-4);
  // Blitz: heller Kern, Strahlenkranz (Winkel-Rauschen um die Blickachse), breiter Schein über das ganze Bild
  vec3 ax = normalize(cross(fc, abs(fc.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  float phi = atan(dot(rd, ax), dot(rd, cross(ax, fc)));
  float rays = 0.55 + 0.45 * gnoise(vec3(phi * 9.0, 0.0, 1.7)) * gnoise(vec3(phi * 23.0, 2.0, 0.3));
  col += vec3(0.86, 0.82, 1.0) * uFlash * (6.0 * exp(-a * a * 6.0) + 0.7 / (1.0 + a * a * 4.0) * rays + 0.05 / (1.0 + a * a * 0.08));
  // Lichtstreifen: waagerecht im Bild durch den Kern (anamorph), nur vor der Kamera
  if (uStreak > 0.0 && dot(rd, fc) > 0.0) {
    float dx = dot(rd - fc, uRight), dy = dot(rd - fc, uUp), w = 0.004 + 0.04 * uCoreSize;
    col += vec3(0.78, 0.68, 1.0) * uFlash * uStreak * exp(-dy * dy / (w * w)) * (0.9 * exp(-abs(dx) / 0.08) + 0.5 * exp(-abs(dx) / 0.5));
  }
  if (uWeb > 0.0) {
    float b = dot(-toC, rd), c = dot(toC, toC) - uR * uR * 1.1025, h = b * b - c;
    if (h > 0.0) {
      float t0 = max(0.0, -b - sqrt(h)), t1 = -b + sqrt(h);
      const int N = 56;
      float dt = (t1 - t0) / float(N), j = hash12(gl_FragCoord.xy), tr = 1.0;
      for (int i = 0; i < N; i++) {
        vec3 p = uCamPos + rd * (t0 + (float(i) + j) * dt);
        float r = length(p);
        float front = smoothstep(uR, uR * 0.8, r);
        if (front <= 0.0) continue;
        vec4 f = texture(uField, p / uR * ${(Q_SCALE / (2 * EXT)).toFixed(5)} + 0.5);
        float d = pow(smoothstep(0.55, 0.9, f.r), 2.5) * smoothstep(-0.1, 0.4, f.g);
        float heat = exp(-r / (uR * 0.18)) * uHot;
        vec3 cc = mix(uWebA, uWebB, 0.5 + 0.5 * f.b);
        cc = mix(cc, vec3(1.0, 0.92, 1.0), clamp(heat, 0.0, 0.5));
        col += tr * cc * d * front * (0.4 + 2.0 * heat) * dt / uR * uWeb * 6.5;
        tr *= exp(-d * dt / uR * 2.5);
      }
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 9000);
  const dir = new THREE.Vector3(0.25, 0.1, 1).normalize();
  const home = { pos: dir.clone().multiplyScalar(D0), target: new THREE.Vector3() };
  const tex = galaxyAtlas();

  // Hintergrund: Blitz, Lichtstreifen und Netz in eigener (halber) Auflösung
  const field = bakeField(ctx.renderer, { size: 128, extent: EXT, body: FIELD });
  const bgU = {
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
    uRight: { value: new THREE.Vector3(1, 0, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uField: { value: field.texture },
    uFlash: { value: 0 }, uCoreSize: { value: 0.1 }, uR: { value: 1 }, uWeb: { value: 0 }, uHot: { value: 0 }, uStreak: { value: 0.55 },
    uWebA: { value: new THREE.Vector3(0.42, 0.2, 0.95) }, uWebB: { value: new THREE.Vector3(0.95, 0.32, 0.85) },
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

  // Galaxien und ferne Lichtpunkte in der wachsenden Gruppe; ein Teil nah an der Blickrichtung zieht beim Hinaus vorbei
  const rand = mulberry32(11);
  const bang = new THREE.Group();
  const field3 = (n, R, rMin, birth0, span) => {
    const list = [];
    while (list.length < n) {
      const p = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(R * Math.cbrt(rand()));
      if (p.length() < rMin) continue;
      const tile = [0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 5, 13][Math.floor(rand() * 16)];
      list.push({ pos: p, size: 1.6 * Math.exp(gauss(rand) * 0.45), tile, tint: blackbody(4800 + rand() * 4500), gain: 1.4 + rand() * 1.6, birth: birth0 + rand() * span, ...randTurn(rand) });
    }
    return list;
  };
  const k = Math.max(0.6, ctx.detail);
  const near = field3(Math.round(1600 * k), 60, 0, 0.22, 0.3).map((g) => { g.pos.addScaledVector(dir, 30 + rand() * 330); g.size *= 1.6; return g; });
  const galList = [...field3(Math.round(4500 * k), 520, 10, 0.22, 0.38), ...near];
  const gals = galaxySprites(galList, tex);
  const dust = glowPoints(Array.from({ length: Math.round(26000 * k) }, () => {
    const p = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(20 + (700 - 20) * Math.cbrt(rand()));
    return { pos: p, size: 0.5 + rand() * 0.6, col: blackbody(4000 + rand() * 6000).map((v) => v * 1.2 * (0.4 + rand())), birth: 0.2 + rand() * 0.4 };
  }));
  bang.add(dust, gals);
  scene.add(bang);

  // Galaxien-Flug zu Station 10 (nur im Flug sichtbar) und Weiß für den Schnitt zwischen Wand und Blitz
  const corridor = createCorridor(ctx, tex);
  corridor.group.visible = false;
  scene.add(corridor.group);
  const white = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform float uW; void main() { gl_FragColor = vec4(vec3(0.96, 0.95, 1.0) * uW * 6.0, 1.0); }',
    uniforms: { uW: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
  }));
  white.frustumCulled = false;
  white.renderOrder = 1000;
  white.visible = false;
  scene.add(white);

  // Film: Stand in Sekunden, Tempo, Abspielen; still = reduzierte Bewegung → Standbild bei 26 s, nichts läuft von selbst
  const film = { t: ctx.still ? 26 : 0, dur: DUR, playing: !ctx.still, spd: 1, tempo: 1, phase: 'bang' };
  let hintOn = true, streakOn = true, webGain = 1;
  const look = { exposure: 0.5, bloom: 0.1, sat: 1.04, con: 0.1, vig: 0.45 };
  const hsExp = new THREE.Vector3(), hsGal = new THREE.Vector3();
  const expDir = new THREE.Vector3(-0.55, 0.42, 0.2).normalize();
  const galBase = near.reduce((b, g) => (g.pos.distanceTo(dir.clone().multiplyScalar(90)) < b.pos.distanceTo(dir.clone().multiplyScalar(90)) ? g : b), near[0]).pos.clone();
  let T = 0, s = 1, R = 1;
  function apply() {
    T = tAt(film.t);
    s = D0 / CURVE.dist(T);
    R = CURVE.R(T) * s;
    bang.scale.setScalar(s);
    for (const m of [gals.material, dust.material]) { m.uniforms.uT.value = T; m.uniforms.uS.value = s; }
    bgU.uFlash.value = CURVE.flash(T);
    bgU.uCoreSize.value = CURVE.core(T) * s / Math.max(camera.position.length(), 1e-3);
    bgU.uR.value = R;
    bgU.uWeb.value = CURVE.web(T) * webGain;
    bgU.uHot.value = CURVE.hot(T);
    bgU.uStreak.value = streakOn && settings.S.lens && settings.S.anamorphic !== false ? 0.55 : 0;
    look.exposure = CURVE.exposure(T);
    look.bloom = CURVE.bloom(T);
    hsExp.copy(expDir).multiplyScalar(R * 0.55);
    hsGal.copy(galBase).multiplyScalar(s);
    bg.invalidate();
  }
  function phase(p, w = 0) {
    film.phase = p;
    const fly = p === 'corridor';
    corridor.group.visible = fly;
    bang.visible = !fly;
    bg.quad.visible = !fly;
    white.visible = w > 0.001;
    white.material.uniforms.uW.value = w;
    if (fly) { look.exposure = 1; look.bloom = 0.12; } else apply();
  }
  const section = () => SECTIONS.find(([end]) => film.t < end)[1];

  registerLayers('bigbang', [
    { id: 'film', type: 'play', group: 'Film', label: 'Film', value: film.spd, min: 0, max: SPEEDS.length - 1, step: 1, autoplay: !ctx.still,
      fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, p) => { film.spd = Math.round(i); if (p && !film.playing && film.t >= DUR - 0.05) film.t = 0; film.playing = p; },
      get: () => ({ value: film.spd, playing: film.playing }),
      status: () => `${mmss(film.t)} / ${mmss(DUR)} · ${section()}` },
    { id: 'hint', type: 'toggle', label: 'Hinweis „keine Explosion an einem Ort“', value: true, set: (v) => { hintOn = v; },
      hint: 'Kurze Zeile in den ersten Sekunden des Films.', active: () => film.t < HINT.to, only: 'Erscheint nur in den ersten Sekunden des Films.' },
    { id: 'streak', type: 'toggle', group: 'Blitz', label: 'Lichtstreifen', value: true, set: (v) => { streakOn = v; apply(); },
      active: () => settings.S.lens, only: 'Wirkt nur mit „Farbsaum und Linsenreflex“ im Reiter Global.' },
    { id: 'web', type: 'range', group: 'Netz der Materie', label: 'Helligkeit', value: 1, min: 0, max: 3, step: 0.1, unit: '×', set: (v) => { webGain = v; apply(); } },
    { id: 'galGain', type: 'range', group: 'Galaxien', label: 'Helligkeit', value: 1, min: 0, max: 3, step: 0.1, unit: '×',
      active: () => T > 0.22, only: 'Galaxien leuchten ab 0:12 im Film auf.',
      set: (v) => { gals.material.uniforms.uGain.value = v; dust.material.uniforms.uGain.value = v; } },
  ]);
  const controls = [
    { id: 'pos', label: 'Stelle im Film', type: 'range', min: 0, max: DUR, step: 0.5, value: film.t, fmt: (v) => `${mmss(v)} · ${SECTIONS.find(([end]) => v < end)[1]}`,
      get: () => film.t, set: (v) => { film.t = v; apply(); } },
    { id: 'again', type: 'action', label: 'Film', button: 'Von vorn abspielen', run: () => { film.t = 0; film.playing = true; apply(); } },
  ];
  const hotspots = [
    { id: 'cmb', kind: 'dive', to: 'cmb', pos: new THREE.Vector3() },
    { id: 'expansion', kind: 'info', pos: hsExp, visible: () => T > 0.14 },
    { id: 'galaxies', kind: 'info', pos: hsGal, visible: () => T > 0.42 },
  ];
  apply();

  return {
    scene, camera, unit: 2.7 * GLY, hotspots, controls, home, look, film,
    orbit: { minDistance: 4, maxDistance: 140, cineSpeed: 0.5 },
    // Shader des Durchflugs und des Weiß schon beim Laden binden (compileAsync übergeht Unsichtbares) – kein Hänger im Flug
    ready: field.ready.then(async () => {
      corridor.group.visible = white.visible = true;
      await ctx.renderer.compileAsync(scene, camera);
      corridor.group.visible = white.visible = false;
      await ctx.renderer.compileAsync(bg.scene, camera);
    }),
    update(dt, t, cam) {
      if (film.phase === 'bang') {
        if (film.playing && film.t < DUR) {
          film.t = Math.min(DUR, film.t + dt * SPEEDS[film.spd][0] * film.tempo);
          if (film.t >= DUR) film.playing = false;
        }
        apply();
        bg.render(cam);
      }
    },
    // Hinweis-Zeile über der Bühne (main.js → hud.hint): angeboten in den ersten Sekunden des Films, die HUD zeigt sie 4,5 s,
    // sobald der Stationstitel ausgeblendet ist
    hint: () => (hintOn && film.phase === 'bang' && film.t > HINT.from && film.t < HINT.to ? HINT.text : ''),
    restart(t0 = 0, tempo = 1) { film.t = t0; film.tempo = tempo; film.playing = true; apply(); },
    live: () => `${section()} · ${mmss(film.t)} von ${mmss(DUR)} · Darstellung, nicht maßstäblich`,
    // Sonderetappe zu Station 10 (main.js): Bild der Station umschalten, Kamera im Tiefenfeld führen, Film beim Schnitt starten
    fly: {
      w: FLIGHT.w,
      phase,
      corridor: (cam, x, down) => corridor.pose(cam, x, down),
      start: () => { film.t = 0.4; film.tempo = 1; film.playing = true; },
    },
    setPixelRatio(pr, H) {
      const px = H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      dust.material.uniforms.uPx.value = px;
      corridor.setPixelRatio(px);
      bg.setSize(Math.round(H * camera.aspect), H);
    },
    dispose: () => { disposeScene(scene); bg.dispose(); field.dispose(); tex.dispose(); },
  };
}
