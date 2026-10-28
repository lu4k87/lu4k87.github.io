// Ast der Milchstraße 03C: Cosmic Tornado HH 49/50 im Chamäleon-I-Komplex (Einheit 0,1 Lj), Blick von der Erde = −z,
// oben = +y wie im Webb-Bild weic2506a (dort liegt Norden 152,6° rechts der Senkrechten). Herbig-Haro-Objekt: Ausfluss
// eines jungen Sterns (vermutlich Cederblad 110 IRS4, ≈ 1,5 Lj außerhalb unten rechts) trifft auf das Gas der Wolke und
// heizt es in Stoßfronten auf; warmer Wasserstoff (H₂), CO und angeregter Staub leuchten im Infrarot orange-rot.
// Modell: gestapelte Stoßkappen – runde Spitze, die in eine langsam weiter werdende Röhre zurück zur Quelle übergeht
// (Säule wie im Webb-Bild, leicht gegeneinander verkippt), Abstand zur Haut analytisch, Haut mit feinen Falten, Fäden
// entlang der Achse und Klumpen; oben orange (warmes H₂), zur Quelle hin dunkelrot; ein Auswuchs rechts als eigene Kappe. Achse nach oben links und von uns weg (Ausfluss 100–300 km/s von uns weg, ESA); die Neigung
// gegen die Himmelsebene ist nicht gemessen (Modell 30°). Bildfeld 2,15′ × 2,62′ bei 630 Lj ≈ 0,4 × 0,5 Lj (eigene Rechnung).
// Die ferne Spiralgalaxie an der Spitze steht nur zufällig in derselben Sichtlinie: gezeichnet in sehr großer Entfernung
// (galaxyflight.js), beim Umkreisen löst sie sich von der Spitze.
// Leistung wie orion.js/pillars.js: Wolke in eigener Auflösung (offscreen), neu gerechnet nur bei Änderung – außer
// „Stoßfronten strömen“ ist an.

import * as THREE from 'three';
import { volume, pointCloud, offscreen, disposeScene } from '../vol.js';
import { createStarfield } from '../stars.js';
import { registerLayers, setLayer } from '../layers.js';
import { galaxyAtlas, galaxySprites, glowPoints } from '../galaxyflight.js';
import { mulberry32, gauss, blackbody, LY } from '../astro.js';

const RAD = 4.4;   // Volumenkugel um die Mitte der Säule
const TILT = 30 * Math.PI / 180;   // Neigung der Achse gegen die Himmelsebene (Modell)
const SKY = new THREE.Vector2(-0.48, 0.88).normalize();   // Achse im Bild: nach oben links
const D = new THREE.Vector3(SKY.x * Math.cos(TILT), SKY.y * Math.cos(TILT), -Math.sin(TILT));
const E1 = new THREE.Vector3().crossVectors(D, new THREE.Vector3(0, 0, 1)).normalize();   // quer, im Bild nach rechts oben
const E2 = new THREE.Vector3().crossVectors(E1, D);
const at = (s, q = 0, w = 0) => D.clone().multiplyScalar(s).addScaledVector(E1, q).addScaledVector(E2, w);

// Kappen: Lage der Spitze (entlang D, quer), Radius der Röhre W, Länge der Wand L, Helligkeit, Verkippung –
// nach dem Webb-Bild: schmale Fingerspitze vorn, dahinter breitere Kappen, die Säule wird zur Quelle hin weiter
const SHELLS = (() => {
  const rnd = mulberry32(4950), out = [];
  for (let i = 0; i < 11; i++) {
    const k = i / 10, j = () => rnd() * 2 - 1;
    out.push([3.0 - 4.9 * k + j() * 0.12, j() * 0.12 * (0.4 + k), 0.5 + 0.42 * Math.sqrt(k), 2.2 + 2 * Math.sin(k * 2.6), 1 - 0.55 * k, [j() * 0.08, j() * 0.08]]);
  }
  return out;
})();
const SPUR = { tip: at(1.9, 0.62, 0.1), dir: D.clone().addScaledVector(E1, 0.5).normalize(), R: 0.2, L: 1.6, g: 0.55 };
const SOURCE = at(-12.5, 0.6, 0.4);   // Cederblad 110 IRS4: ≈ 1,5 Lj zurück entlang der Achse, unten rechts
const v3 = (v) => `vec3(${v.toArray().map((x) => x.toFixed(4)).join(', ')})`;

const shellCalls = () => SHELLS.map(([s, q, R, L, g, [a, b]], i) => {
  const dir = D.clone().addScaledVector(E1, a).addScaledVector(E2, b).normalize();
  const e1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize(), e2 = new THREE.Vector3().crossVectors(e1, dir);
  return `bow(p, ${v3(at(s, q))}, ${v3(dir)}, ${v3(e1)}, ${v3(e2)}, ${R.toFixed(3)}, ${L.toFixed(3)}, ${g.toFixed(3)}, ${(i * 1.7).toFixed(2)}, ${(i / (SHELLS.length - 1)).toFixed(3)}, nz, fil, wr, em, lay);`;
}).join('\n  ');
const spurCall = () => {
  const e1 = new THREE.Vector3().crossVectors(SPUR.dir, new THREE.Vector3(0, 0, 1)).normalize(), e2 = new THREE.Vector3().crossVectors(e1, SPUR.dir);
  return `bow(p, ${v3(SPUR.tip)}, ${v3(SPUR.dir)}, ${v3(e1)}, ${v3(e2)}, ${SPUR.R.toFixed(3)}, ${SPUR.L.toFixed(3)}, ${SPUR.g.toFixed(3)} * uSpur, 4.1, 0.35, nz, fil, wr, em, lay);`;
};

const BODY = () => /* glsl */ `
uniform vec3 cShock, cHot, cDeep, cHaze, cOld, cNew;
uniform float uGain, uThick, uTwist, uFil, uRough, uHaze, uSpur, uLayers, uFlowV;
// eine Stoßkappe um die Spitze H (Achse D): Profil r(b) = W'·sqrt(1 − e^(−2b/W)) – vorn rund mit Radius W, dahinter
// eine Röhre, die langsam weiter wird (W' = W·(1 + 0.07 b)); f = Abstand zur Haut (Steigung ausgeglichen). Die Haut leuchtet
// dünn, vorn am stärksten, die Wand läuft nach L aus; Falten (wr) und Klumpen (nz) verbiegen sie, Fäden (fil) liegen
// entlang der Achse; Helligkeit windet sich leicht um die Achse (Verdrillung, daher „Tornado“)
float capR(float b, float W) { return W * (1.0 + 0.07 * b) * sqrt(max(1.0 - exp(-2.0 * b / W), 0.0)); }
void bow(vec3 p, vec3 H, vec3 D, vec3 E1, vec3 E2, float W, float L, float g, float ph, float idx, float nz, float fil, float wr, inout float em, inout float lay) {
  vec3 q = p - H;
  float b = -dot(q, D);
  if (b < -0.4 || b > L + 0.3) return;
  vec3 r = q + b * D;
  float rho = length(r);
  float phi = atan(dot(r, E2), dot(r, E1));
  W *= 1.0 + 0.1 * sin(2.0 * phi + ph) + 0.07 * sin(3.0 * phi - ph * 1.3) + 0.12 * nz;   // Querschnitt verbeult
  float f;
  if (b <= 0.0) f = sqrt(rho * rho + b * b);
  else {
    float rs = capR(b, W), d = (capR(b + 0.02, W) - rs) / 0.02;
    f = (rho - rs) * inversesqrt(1.0 + d * d);
  }
  float bp = max(b, 0.0);
  f -= (nz * 0.08 + (wr - 0.5) * 0.07) * uRough * (0.6 + 0.4 * min(bp, 2.0));
  float w = uThick * (0.032 + 0.012 * min(bp, 3.0));
  if (abs(f) > 5.0 * w) return;
  float wing = smoothstep(-0.25, 0.05, b) * smoothstep(L, L * 0.35, b);
  float twist = 1.0 + uTwist * 0.6 * sin(phi + b * 1.6 + ph);
  float head = 0.45 + 0.55 * exp(-bp / (1.2 * W));
  float c = exp(-f * f / (w * w)) * wing * max(twist, 0.0) * g * head * max(1.0 + uFil * (fil - 0.4) * 2.4, 0.0);
  em += c;
  lay += c * idx;
}
void sampleVol(vec3 p, out vec3 e, out float s) {
  float r = length(p);
  float edge = smoothstep(${RAD.toFixed(2)}, ${(RAD - 0.8).toFixed(2)}, r);
  // Rauschen einmal je Punkt, mit der Strömung entlang der Achse verschoben (uTime > 0 lässt es wandern)
  vec3 pf = p - ${v3(D)} * uTime * uFlowV;
  float nz = fbm(pf * 2.6 + vec3(3.0, 1.0, 7.0), OCT);
  // Fäden entlang der Achse (Rauschen längs D gestreckt), feine Falten quer dazu
  vec3 pa = vec3(dot(pf, ${v3(E1)}) * 6.5, dot(pf, ${v3(E2)}) * 6.5, dot(pf, ${v3(D)}) * 1.4);
  float fil = ridged(pa + vec3(1.0, 9.0, 4.0), 3);
  float wr = ridged(pf * 11.0 + vec3(7.0, 2.0, 5.0), 2);
  float em = 0.0, lay = 0.0;
  ${shellCalls()}
  ${spurCall()}
  em *= edge;
  em = em * em / (em + 0.3);   // Kontrast: schwacher Grund dunkler, Falten und Ränder bleiben hell
  float t = lay / max(em, 1e-5);
  // Farbe: Webb-Look = orange (H₂ 4,7 µm), helle Kerne heller und gelblicher; Schichten = Alter der Front (Modell)
  vec3 col = mix(cDeep, cShock, smoothstep(-1.2, 3.2, dot(p, ${v3(D)})));
  col = mix(col, cHot, smoothstep(0.8, 2.6, em));
  col = mix(col, mix(cOld, cNew, t), uLayers);
  // Wolke des Chamäleon-Komplexes dahinter: schwacher PAH-Schein (7,7 µm rot), Staub wenig dicht
  float hz = max(fbm(p * 0.55 + vec3(5.0, 2.0, 8.0), 3) + 0.15, 0.0) * smoothstep(${RAD.toFixed(2)}, 1.2, r) * mix(0.4, 1.0, smoothstep(1.5, -2.5, p.z));
  e = (col * em * 3.0 + cHaze * hz * uHaze * 0.06) * uGain;
  s = em * 0.6 + hz * uHaze * 0.08;
}
`;

// Farben je Modus (linear, vor ACES)
const LOOKS = {
  webb: { shock: [1, 0.45, 0.14], hot: [1, 0.8, 0.52], deep: [0.62, 0.08, 0.04], haze: [0.75, 0.12, 0.12], layers: 0, stars: 1 },
  h2: { shock: [1, 0.5, 0.16], hot: [1, 0.62, 0.3], deep: [1, 0.5, 0.16], haze: [0.08, 0.03, 0.01], layers: 0, stars: 0.6 },
  layers: { shock: [1, 0.5, 0.2], hot: [1, 0.8, 0.6], deep: [1, 0.5, 0.2], haze: [0.12, 0.1, 0.16], layers: 1, stars: 0.6 },
};
// Grundlook (Regler „Look der Stoßfronten“ setzt die Regler darunter); Ausgewogen = Startwert
const PRESETS = [
  { thick: 1, twist: 0.4, fil: 1, rough: 1, haze: 1 },
  { thick: 0.6, twist: 1.2, fil: 0.4, rough: 0.4, haze: 0.4 },
  { thick: 1.6, twist: 0.2, fil: 1.8, rough: 2, haze: 1.7 },
];
const PRESET_N = ['Ausgewogen', 'Klare Fronten', 'Wolkig'];

const RES = [0.35, 0.5, 0.7, 1], RES_N = ['Niedrig', 'Mittel', 'Hoch', 'Voll'];
const STEPS = [64, 96, 128, 160], STEPS_N = ['Grob', 'Mittel', 'Fein', 'Sehr fein'];
const times = (v) => (v ? `×${String(v).replace('.', ',')}` : 'aus');

export function create(ctx) {
  const pre = PRESETS[0];

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 6000);
  const sky = createStarfield({ gain: 0.55, seed: 4950, ngp: new THREE.Vector3(0.45, 0.8, -0.4), gc: new THREE.Vector3(0.85, -0.2, -0.5) });
  scene.add(sky);

  const col3 = (a) => ({ value: new THREE.Vector3(...a) });
  const neb = volume({ radius: RAD, body: `#define OCT ${ctx.detail > 0.7 ? 4 : 3}\n${BODY()}`, steps: STEPS[2], maxSteps: STEPS[3], uniforms: {
    uGain: { value: 0.6 }, uThick: { value: pre.thick }, uTwist: { value: pre.twist }, uFil: { value: pre.fil }, uRough: { value: pre.rough },
    uHaze: { value: pre.haze }, uSpur: { value: 1 }, uLayers: { value: 0 }, uFlowV: { value: 0.05 },
    cShock: col3([1, 1, 1]), cHot: col3([1, 1, 1]), cDeep: col3([1, 1, 1]), cHaze: col3([1, 1, 1]), cOld: col3([0.9, 0.2, 0.12]), cNew: col3([0.35, 0.85, 1]),
  } });
  const vol = offscreen(ctx.renderer, neb);
  vol.quad.renderOrder = 1;
  scene.add(vol.quad);
  const u = neb.material.uniforms;

  // Ferne Spiralgalaxie von oben (blauer Kern aus alten Sternen, rötliche Arme), genau hinter der Spitze vom Startblick;
  // dahinter viele kleine ferne Galaxien. Gezeichnet vor der Wolke (renderOrder 0), damit die Wolke sie abdeckt.
  const home = { pos: new THREE.Vector3(0.9, 0.5, 11.2), target: new THREE.Vector3(0.15, 0.35, 0) };
  const tip = at(SHELLS[0][0] + 0.12);
  const sight = tip.clone().addScaledVector(E2, 0.12).addScaledVector(E1, -0.1).sub(home.pos).normalize();   // knapp über der Spitze wie im Bild
  if (new URLSearchParams(location.search).get('view') === 'side') home.pos.sub(home.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.95).add(home.target);
  const GD = 1500, ANG = 0.09;   // Abstand der Tafel (Szeneneinheiten) und Winkelgröße (rad) wie im Webb-Bild
  const turn = new THREE.Object3D();
  turn.lookAt(sight.clone().negate());
  const atlas = galaxyAtlas();
  const galaxy = galaxySprites([{ pos: sight.clone().multiplyScalar(GD), size: GD * ANG, tile: 1, tint: [0.75, 0.82, 1.15], gain: 1.6,
    rx: turn.rotation.x, ry: turn.rotation.y, rz: turn.rotation.z + 0.7 }], atlas);
  galaxy.renderOrder = 0;
  const rand = mulberry32(4950);
  const far = [];
  for (let i = 0; i < 900; i++) {
    const v = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(GD * (1.1 + rand()));
    far.push({ pos: v, size: GD * (0.0015 + rand() * rand() * 0.006), col: (rand() < 0.5 ? [1, 0.75, 0.55] : [0.7, 0.8, 1]).map((x) => x * (0.3 + rand())) });
  }
  const farGals = glowPoints(far);
  farGals.renderOrder = 0;
  // Ferne: Gruppe wandert mit der Kamera (Richtung fest im Raum, wie der Sternhimmel) → Ausrichtung zerfällt beim Umkreisen;
  // Galaxien in echter Ferne: Gruppe wandert mit der Kamera (unendlich weit), dreht nicht mit
  const backdrop = new THREE.Group();
  backdrop.add(galaxy, farGals);
  scene.add(backdrop);

  // Sterne im Feld und die vermutete Quelle Cederblad 110 IRS4 (Klasse-I-Protostern, im Infrarot rötlich)
  const pos = [], col = [], size = [];
  const add = (v, T, k, s) => { pos.push(v.x, v.y, v.z); col.push(...blackbody(T).map((x) => x * k)); size.push(s); };
  for (let i = 0; i < 260; i++) {
    const v = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(4 + 36 * Math.cbrt(rand()));
    add(v, rand() < 0.2 ? 8000 + rand() * 12000 : 3200 + rand() * 2800, 0.2 + rand() * rand() * 3, 0.02);
  }
  add(SOURCE, 1500, 60, 0.12);
  const stars = pointCloud(pos, col, size, { min: 1.2 });
  stars.renderOrder = 2;
  scene.add(stars);

  let mode = 'webb', starGain = 1, flowOn = true;
  const applyLook = () => {
    const k = LOOKS[mode];
    u.cShock.value.set(...k.shock); u.cHot.value.set(...k.hot); u.cDeep.value.set(...k.deep); u.cHaze.value.set(...k.haze); u.uLayers.value = k.layers;
    stars.material.uniforms.uGain.value = starGain * k.stars;
    vol.invalidate();
  };
  applyLook();

  const hotspots = [
    { id: 'apex', kind: 'info', pos: tip.clone() },
    { id: 'bows', kind: 'info', pos: at(1.35, -0.7) },
    { id: 'spur', kind: 'info', pos: SPUR.tip.clone() },
    { id: 'ced110', kind: 'info', pos: SOURCE.clone() },
    { id: 'galaxy', kind: 'info', pos: tip.clone().addScaledVector(sight, 1.2) },
    { id: 'layers', kind: 'info', pos: at(0.2, 0.9), visible: () => mode === 'layers' },
  ];
  const controls = [{
    id: 'mode', label: 'Farben', value: 'webb', options: [['webb', 'Webb: NIRCam + MIRI'], ['h2', 'Nur H₂ (4,7 µm)'], ['layers', 'Stoßfronten nach Alter']],
    set: (v) => { mode = v; applyLook(); },
  }];

  const to = (k, f = (v) => v) => (v) => { u[k].value = f(v); vol.invalidate(); };
  const fine = ctx.detail > 0.9;
  let lookReady = false;   // Laden stellt die gespeicherten Einzelwerte, die Wahl des Looks wirkt erst bei Bedienung
  registerLayers('tornado', [
    { id: 'gain', type: 'range', group: 'Licht des Gases', label: 'Helligkeit', min: 0.25, max: 6, step: 0.25, value: 1, fmt: times, set: to('uGain', (v) => 0.6 * v) },
    { id: 'haze', type: 'range', label: 'Schein der Wolke dahinter', min: 0, max: 4, step: 0.25, value: pre.haze, fmt: times, set: to('uHaze'),
      hint: 'Schwacher Schein von Staub und PAH-Molekülen im Chamäleon-Komplex (MIRI 7,7 µm, im Bild rot).' },
    { id: 'look', type: 'range', group: 'Stoßfronten', label: 'Look der Stoßfronten', min: 0, max: 2, step: 1, value: 0, fmt: (i) => PRESET_N[i],
      set: (i) => { if (lookReady) for (const [k, v] of Object.entries(PRESETS[i])) setLayer('tornado', k, v); },
      hint: 'Ausgewogen wie im Webb-Bild, klar getrennte Fronten zum Erklären oder wolkiges Gas. Setzt die Regler darunter.' },
    { id: 'thick', type: 'range', label: 'Dicke der Fronten', min: 0.4, max: 3, step: 0.1, value: pre.thick, fmt: times, set: to('uThick') },
    { id: 'twist', type: 'range', label: 'Verdrillung', min: 0, max: 2, step: 0.1, value: pre.twist, fmt: times, set: to('uTwist'),
      hint: 'Helligkeit windet sich um die Achse – der Eindruck, dem das Objekt seinen Spitznamen verdankt (Modell).' },
    { id: 'fil', type: 'range', label: 'Fäden', min: 0, max: 3, step: 0.1, value: pre.fil, fmt: times, set: to('uFil') },
    { id: 'rough', type: 'range', label: 'Wellen und Klumpen', min: 0, max: 3, step: 0.1, value: pre.rough, fmt: times, set: to('uRough') },
    { id: 'spur', type: 'toggle', label: 'Auswuchs oben rechts', value: true, set: to('uSpur', (v) => (v ? 1 : 0)) },
    { id: 'flow', type: 'toggle', group: 'Bewegung', label: 'Stoßfronten strömen', value: true, set: (v) => { flowOn = v; u.uTime.value = 0; vol.invalidate(); },
      hint: 'Das Gas fließt mit 100–300 km/s von der Quelle weg (ESA) – hier um ein Vielfaches beschleunigt.' },
    { id: 'stars', type: 'range', group: 'Hintergrund', label: 'Helligkeit der Sterne', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: (v) => { starGain = v; applyLook(); } },
    { id: 'gals', type: 'range', label: 'Ferne Galaxien', min: 0, max: 3, step: 0.25, value: 1, fmt: times,
      set: (v) => { galaxy.material.uniforms.uGain.value = v; farGals.material.uniforms.uGain.value = v; } },
    { id: 'res', type: 'range', group: 'Qualität der Wolke', label: 'Detailstufe', min: 0, max: 3, step: 1, value: fine ? 1 : 2, fmt: (i) => RES_N[i], set: (i) => vol.setScale(RES[i]) },
    { id: 'steps', type: 'range', label: 'Rechengenauigkeit', min: 0, max: 3, step: 1, value: fine ? 2 : 1, fmt: (i) => STEPS_N[i], set: to('uSteps', (i) => STEPS[i]) },
  ]);
  lookReady = true;

  return {
    scene, camera, unit: 0.1 * LY, hotspots, controls, msaa: false,
    ready: ctx.renderer.compileAsync(vol.scene, camera),
    home,
    orbit: { minDistance: 0.6, maxDistance: 40, cineSpeed: 0.5 },
    look: { exposure: 1.1, bloom: 0.12, sat: 1.1, con: 0.12, sh: [1.02, 0.98, 0.96] },
    update(dt, t, cam) {
      backdrop.position.copy(cam.position);
      if (flowOn) { u.uTime.value = t; vol.invalidate(); }
      vol.render(cam);
    },
    live: () => ({ webb: 'Webb NIRCam + MIRI: warmer Wasserstoff, CO und Staub orange-rot, die ferne Galaxie blau-weiß',
      h2: 'Nur molekularer Wasserstoff (NIRCam 4,7 µm): die Stoßfronten allein',
      layers: 'Stoßfronten nach Alter (Modell): rot = vorn und älter, blau = näher an der Quelle und jünger' })[mode],
    setPixelRatio(pr, H) {
      sky.userData.setPixelRatio(pr); stars.userData.setPx(pr, H, camera.fov);
      farGals.material.uniforms.uPx.value = pr * H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      vol.setSize(Math.round(H * camera.aspect), H);
    },
    dispose: () => { disposeScene(scene); vol.dispose(); },
  };
}
