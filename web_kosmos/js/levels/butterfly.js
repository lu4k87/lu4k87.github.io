// Ast der Milchstraße 03D: Schmetterlingsnebel NGC 6302 (Einheit 1 Lj), Blick von der Erde = −z, Norden = +y.
// Bipolarer planetarischer Nebel: zwei offene, zerfranste Flügel entlang der Polachse (im Hubble-Bild von unten links nach
// oben rechts), dazwischen eine enge Taille, die ein dichter Staub-Torus einschnürt – von der Seite gesehen als dunkles Band
// quer über die Mitte, das den Zentralstern im sichtbaren Licht verdeckt (Webb fand ihn erst im mittleren Infrarot,
// Matsuura et al. 2025). Ionisation geschichtet: heißes, hoch ionisiertes Gas (He II, [O III]) nahe am Stern, außen kühleres
// Gas mit Stickstoff und Schwefel an den Rändern (Hubble WFC3, heic0910h). Ein Paar Jets aus Eisen und Nickel läuft schräg
// zur Polachse hinaus (punktsymmetrisch → leichte S-Form). Neigung der Achse, Biegung der Flügel und Ausfransung: Modell.
// Farben je Bauteil als Uniforms (wie pillars.js, spider.js), ein Farbmodus tauscht nur Werte. Leistung: grobe Felder einmal
// in einer 3D-Textur, feine Schlieren prozedural nur innerhalb der Flügel, Wolke offscreen; neu gerechnet nur bei Änderung –
// außer der Zeitraffer läuft.

import * as THREE from 'three';
import { volume, pointCloud, bakeField, offscreen, disposeScene } from '../vol.js';
import { createStarfield } from '../stars.js';
import { registerLayers } from '../layers.js';
import { mulberry32, blackbody, LY } from '../astro.js';

const EXT = 2.6;   // Feldtextur: Würfel ±2,6 Lj um die Volumenkugel (Radius 2,5)
// Polachse: im Bild ≈ 35° über der Waagrechten, Nordwest-Flügel (oben rechts) leicht von uns weg geneigt (Modell)
const AXIS = new THREE.Vector3(Math.cos(0.61), Math.sin(0.61), -0.22).normalize();
const E1 = new THREE.Vector3(0, 0, 1).cross(AXIS).normalize();   // in der Bildebene quer zur Achse (oben links)
const E2 = new THREE.Vector3().crossVectors(AXIS, E1);
const JET = AXIS.clone().addScaledVector(E1, 0.14).normalize();   // Jets schräg zur Achse, Gegenseite gespiegelt

// r großräumige Verwerfung (zerfranste Ränder), g Klumpen, b Klumpen im Staubgürtel
const FIELD = /* glsl */ `
vec4 field(vec3 p) {
  return vec4(fbm(p * 1.1 + vec3(2.0, 7.0, 1.0), 3), fbm(p * 2.6 + 4.0, 3), fbm(p * 3.2 + vec3(6.0, 1.0, 9.0), 3), 0.0);
}
`;

const BODY = /* glsl */ `
uniform vec3 uA, uE1, uE2, uJ;
uniform float uGain, uSat, uHot, uMid, uEdge, uFe, uCore, uTorus, uDust, uDustT, uOpen, uLen, uFil, uRag, uFlow;
uniform vec3 cHot, cMid, cEdge, cFe, cCore, cTor;
uniform highp sampler3D uField;
void sampleVol(vec3 p, out vec3 e, out float s) {
  vec3 f = texture(uField, p / ${(2 * EXT).toFixed(2)} + 0.5).rgb;
  float h = dot(p, uA);
  float sg = h < 0.0 ? -1.0 : 1.0;
  float ha = abs(h);
  // Flügel biegen sich leicht: der obere nach oben, der untere nach unten (Modell nach dem Hubble-Bild)
  vec3 perp = p - uA * h - uE1 * (sg > 0.0 ? 0.11 : -0.07) * ha * ha;
  float rp = length(perp);
  float r = length(p);
  // Querschnitt: enge Taille, rasch weit offen, der untere Flügel etwas breiter, der obere länger
  float R = uOpen * (0.07 + 0.74 * ha * (1.0 - 0.18 * ha)) * (sg > 0.0 ? 1.0 : 1.12) * (1.0 + 0.6 * f.r * uRag);
  float L = uLen * (sg > 0.0 ? 1.65 : 1.4) + 0.45 * f.r * uRag;
  float x = rp / max(R, 1e-3);
  float along = smoothstep(L, L - 0.55, ha) * smoothstep(0.0, 0.08, ha);
  float shell = exp(-pow((x - 0.82) / 0.26, 2.0));
  // Flecken und Lücken: die Flügel sind kein glatter Kegel, sondern zerrissene Wolken
  float dens = (0.3 * smoothstep(1.05, 0.6, x) + shell) * along * (0.2 + 1.6 * smoothstep(-0.3, 0.35, f.g + 0.4 * f.r));
  // Schlieren längs der Strömung (strömt mit uFlow nach außen), nur wo Gas ist
  float fil = 1.0;
  if (dens > 0.01) {
    vec3 q = p - normalize(p + 1e-4) * uFlow * 0.06;
    float rg = ridged(vec3(perp * 8.0 + vec3(1.0, 3.0, 2.0)) + uA * ha * 1.6 + q * 0.8, 3);
    fil = mix(1.0, 0.1 + 2.4 * rg * rg * rg, uFil) * (0.8 + 0.4 * max(gnoise(q * 3.0), 0.0));
  }
  // Schichten der Ionisation vom Stern nach außen; Ränder (außen und an der Haut) rot von Stickstoff
  float hot = exp(-r / 0.32) * (0.5 + 0.7 * smoothstep(0.75, 0.2, x));
  float mid = smoothstep(0.1, 0.45, r) * exp(-max(r - 0.8, 0.0) / 0.6);
  float edge = smoothstep(0.6, 1.0, x) * 1.2 + smoothstep(0.6, 1.4, r) * 1.4;
  vec3 col = (cHot * hot * uHot + cMid * mid * uMid + cEdge * edge * uEdge) * dens * fil;
  // Jets aus Eisen und Nickel: schmal, schräg zur Achse, in Knoten
  vec3 qj = p * sg;
  float t = dot(qj, uJ);
  float dj = length(qj - uJ * t);
  float fe = exp(-pow(dj / (0.03 + 0.03 * t), 2.0)) * smoothstep(0.08, 0.3, t) * smoothstep(1.75 * uLen, 1.1 * uLen, t)
           * (0.4 + 1.4 * max(gnoise(vec3(t * 7.0 - uFlow * 0.4, f.g * 2.0, 3.1)), 0.0));
  // Staubgürtel in der Taille (von der Seite gesehen dunkles Band), flach nach außen auslaufend
  float rr = length(p - uA * h);
  float tor = exp(-pow(h / (0.05 + 0.12 * rr), 2.0)) * (exp(-pow((rr - 0.16) / 0.1, 2.0)) + 0.35 * exp(-rr / 0.45)) * (0.6 + max(f.b + 0.4, 0.0));
  float core = exp(-pow(r / 0.08, 2.0));
  col += cFe * fe * uFe + cTor * tor * uTorus + cCore * core * uCore;
  col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, uSat), 0.0);
  e = col * uGain;
  s = (tor * 10.0 * uTorus * uDust + dens * 0.35) * uDustT;
}
`;

// Farben je Modus: Hubble sichtbar (WFC3, heic0910h/ESA 2025: innen weiß-blau, Flügel orange von Stickstoff und Wasserstoff,
// Ränder rot), Webb MIRI (warmer Staub des Torus und der Stern leuchten, Gas schwächer), Schichten = je Bauteil eine Farbe
const LOOKS = {
  hubble: { hot: [0.7, 0.8, 1.0], mid: [1.0, 0.42, 0.1], edge: [0.95, 0.12, 0.03], fe: [1.0, 0.35, 0.5], core: [0.6, 0.65, 0.8], tor: [0.0, 0.0, 0.0],
    dustT: 1, star: 2, stars: 1 },
  miri: { hot: [0.45, 0.55, 0.8], mid: [0.75, 0.4, 0.3], edge: [0.35, 0.12, 0.2], fe: [0.55, 0.85, 1.0], core: [1.0, 0.75, 0.45], tor: [1.0, 0.45, 0.12],
    dustT: 0.3, star: 40, stars: 0.35 },
  layers: { hot: [0.25, 0.45, 1.0], mid: [0.2, 0.9, 0.4], edge: [1.0, 0.15, 0.1], fe: [1.0, 0.25, 0.85], core: [1.0, 1.0, 1.0], tor: [1.0, 0.8, 0.25],
    dustT: 0.15, star: 30, stars: 0.6 },
};

const RES = [0.35, 0.5, 0.7, 1], RES_N = ['Niedrig', 'Mittel', 'Hoch', 'Voll'];
const STEPS = [96, 128, 176, 224], STEPS_N = ['Grob', 'Mittel', 'Fein', 'Sehr fein'];
// Zeitraffer der Strömung: Stufen als Vielfaches des Grundtempos
const SPD = [0.25, 0.5, 1, 2, 3];
const times = (v) => (v ? `×${String(v).replace('.', ',')}` : 'aus');

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 500);
  // dichter Himmel: NGC 6302 liegt im Skorpion fast in der galaktischen Ebene (l = 349,5°, b = +1,1°), nahe Richtung Zentrum
  const sky = createStarfield({ count: 30000, gain: 0.5, band: 0.5, seed: 6302, ngp: new THREE.Vector3(-0.02, 1, 0.02), gc: new THREE.Vector3(0.18, 0.02, -1) });
  scene.add(sky);

  const col3 = () => ({ value: new THREE.Vector3(1, 1, 1) });
  const field = bakeField(ctx.renderer, { size: 128, extent: EXT, body: FIELD });
  const neb = volume({ radius: 2.5, body: BODY, steps: STEPS[1], maxSteps: STEPS[3], uniforms: {
    uField: { value: field.texture }, uA: { value: AXIS }, uE1: { value: E1 }, uE2: { value: E2 }, uJ: { value: JET },
    uGain: { value: 1.5 }, uSat: { value: 1 }, uHot: { value: 1 }, uMid: { value: 1 }, uEdge: { value: 1 }, uFe: { value: 1 }, uCore: { value: 1 },
    uTorus: { value: 1 }, uDust: { value: 1 }, uDustT: { value: 1 }, uOpen: { value: 1 }, uLen: { value: 1 }, uFil: { value: 1 }, uRag: { value: 1 }, uFlow: { value: 0 },
    cHot: col3(), cMid: col3(), cEdge: col3(), cFe: col3(), cCore: col3(), cTor: col3(),
  } });
  const vol = offscreen(ctx.renderer, neb);
  vol.quad.renderOrder = 1;
  scene.add(vol.quad);
  const u = neb.material.uniforms;

  // Zentralstern (≈ 220.000 K, im sichtbaren Licht hinter dem Torus verborgen) und Feldsterne davor und dahinter
  const rand = mulberry32(6302);
  const star = pointCloud([0, 0, 0], [1, 1, 1], [0.03], { min: 2.2 });
  star.renderOrder = 3;
  scene.add(star);
  const pos = [], col = [], size = [];
  for (let i = 0; i < 1800; i++) {
    const v = new THREE.Vector3((rand() - 0.5) * 24, (rand() - 0.5) * 24, (rand() - 0.5) * 24);
    if (v.length() < 2.2) continue;
    const T = rand() < 0.12 ? 9000 + rand() * 16000 : 3000 + rand() * 3200;
    pos.push(v.x, v.y, v.z); col.push(...blackbody(T).map((c) => c * (0.25 + rand() * rand() * 3))); size.push(0.03);
  }
  const stars = pointCloud(pos, col, size, { min: 1.1 });
  stars.renderOrder = 2;
  scene.add(stars);

  let mode = 'hubble', starGain = 1, dustMul = 1, flowOn = true, speed = 1, breathe = true, flowT = 0, spdIdx = 2;
  const applyLook = () => {
    const k = LOOKS[mode];
    for (const [n, key] of [['cHot', 'hot'], ['cMid', 'mid'], ['cEdge', 'edge'], ['cFe', 'fe'], ['cCore', 'core'], ['cTor', 'tor']]) u[n].value.set(...k[key]);
    u.uDustT.value = k.dustT * dustMul;
    star.geometry.attributes.color.setXYZ(0, ...blackbody(mode === 'miri' ? 1100 : 30000).map((x) => x * k.star));
    star.geometry.attributes.color.needsUpdate = true;
    stars.material.uniforms.uGain.value = starGain * k.stars;
    sky.userData.material.uniforms.uGain.value = 0.5 * starGain * k.stars;
    vol.invalidate();
  };
  applyLook();

  const hotspots = [
    { id: 'star', kind: 'info', pos: new THREE.Vector3(0, 0, 0) },
    { id: 'torus', kind: 'info', pos: E1.clone().multiplyScalar(0.3) },
    { id: 'nw', kind: 'info', pos: AXIS.clone().multiplyScalar(1.3).addScaledVector(E1, 0.35) },
    { id: 'se', kind: 'info', pos: AXIS.clone().multiplyScalar(-1.0).addScaledVector(E1, -0.15) },
    { id: 'jets', kind: 'info', pos: JET.clone().multiplyScalar(0.7) },
    { id: 'edges', kind: 'info', pos: AXIS.clone().multiplyScalar(1.25).addScaledVector(E1, -0.5) },
  ];
  const controls = [{
    id: 'mode', label: 'Farben', value: 'hubble', options: [['hubble', 'Hubble: sichtbar'], ['miri', 'Webb: MIRI'], ['layers', 'Schichten']],
    set: (v) => { mode = v; applyLook(); },
  }];

  const to = (k, f = (v) => v) => (v) => { u[k].value = f(v); vol.invalidate(); };
  const fine = ctx.detail > 0.9;
  registerLayers('butterfly', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', value: spdIdx, min: 0, max: SPD.length - 1, step: 1, autoplay: !ctx.still, fmt: (i) => times(SPD[Math.round(i)]),
      hint: 'Das Gas strömt nach außen, in Wirklichkeit mit über 950.000 km/h – für eine Flügellänge braucht es trotzdem gut tausend Jahre. Hier stark beschleunigt.',
      set: (i, playing) => { spdIdx = Math.round(i); speed = SPD[spdIdx]; flowOn = playing; vol.invalidate(); },
      get: () => ({ value: spdIdx, playing: flowOn }), status: () => (flowOn ? 'Gas strömt' : 'angehalten') },
    { id: 'gain', type: 'range', group: 'Licht des Gases', label: 'Helligkeit', min: 0.25, max: 6, step: 0.25, value: 1, fmt: times, set: to('uGain', (v) => 1.5 * v) },
    { id: 'sat', type: 'range', label: 'Farbsättigung', min: 0, max: 3, step: 0.1, value: 1, fmt: (v) => (v ? `${Math.round(v * 100)} %` : 'grau'), set: to('uSat') },
    { id: 'hot', type: 'range', label: 'Heißes Gas am Stern', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: to('uHot'),
      hint: 'Nahe am Stern ist das Gas hoch ionisiert (Helium, Sauerstoff) – im Hubble-Bild weiß-blau.' },
    { id: 'mid', type: 'range', label: 'Gas der Flügel', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: to('uMid') },
    { id: 'edge', type: 'range', label: 'Rote Ränder (Stickstoff)', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: to('uEdge'),
      hint: 'An den äußeren Rändern leuchtet vor allem Stickstoff – das kühlste Gas des Nebels.' },
    { id: 'open', type: 'range', group: 'Flügel', label: 'Öffnung der Flügel', min: 0.5, max: 1.6, step: 0.1, value: 1, fmt: times, set: to('uOpen') },
    { id: 'len', type: 'range', label: 'Länge der Flügel', min: 0.6, max: 1.4, step: 0.1, value: 1, fmt: times, set: to('uLen') },
    { id: 'fil', type: 'range', label: 'Schlieren und Fäden', min: 0, max: 1, step: 0.1, value: 1, fmt: (v) => `${Math.round(v * 100)} %`, set: to('uFil') },
    { id: 'rag', type: 'range', label: 'Zerfranste Ränder', min: 0, max: 3, step: 0.25, value: 1, fmt: times, set: to('uRag') },
    { id: 'fe', type: 'range', group: 'Ausfluss', label: 'Jets aus Eisen und Nickel', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: to('uFe'),
      hint: 'Webb zeigt ein Paar Jets in Eisen- und Nickellinien, die in entgegengesetzte Richtungen aus der Mitte schießen.' },
    { id: 'torus', type: 'range', group: 'Staubgürtel und Stern', label: 'Staub-Torus', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: to('uTorus'),
      hint: 'Ein dichter Ring aus Staub schnürt die Taille ein und lenkt das Gas in zwei Flügel. Wir sehen ihn von der Seite.' },
    { id: 'dust', type: 'range', label: 'Abdunkeln durch Staub', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: (v) => { dustMul = v; applyLook(); } },
    { id: 'core', type: 'range', label: 'Glut der Mitte', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: to('uCore') },
    { id: 'breathe', type: 'toggle', label: 'Zentralstern atmet', value: true, set: (v) => { breathe = v; } },
    { id: 'stars', type: 'range', group: 'Sterne', label: 'Helligkeit der Sterne', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: (v) => { starGain = v; applyLook(); } },
    { id: 'res', type: 'range', group: 'Qualität der Wolke', label: 'Detailstufe', ordered: true, min: 0, max: 3, step: 1, value: fine ? 1 : 2, fmt: (i) => RES_N[i], set: (i) => vol.setScale(RES[i]),
      hint: 'Die Wolke wird in eigener Auflösung gerechnet und weich vergrößert, Sterne bleiben scharf. Niedriger = schneller.' },
    { id: 'steps', type: 'range', label: 'Rechengenauigkeit', ordered: true, min: 0, max: 3, step: 1, value: fine ? 2 : 1, fmt: (i) => STEPS_N[i], set: to('uSteps', (i) => STEPS[i]),
      hint: 'Mehr Schritte zeigen die feinen Schlieren gleichmäßiger, kosten aber Bildrate.' },
  ]);

  const view = new URLSearchParams(location.search).get('view');
  const HOME = { side: [0.2, 0.3, -0.2].map((x, i) => x + E1.toArray()[i] * 6), top: [0.3, 6, 1.2], near: [0.15, 0.1, 1.6] }[view] || [0.25, 0.1, 8.5];
  return {
    scene, camera, unit: LY, hotspots, controls, msaa: false,
    ready: field.ready.then(() => ctx.renderer.compileAsync(vol.scene, camera)),
    home: { pos: new THREE.Vector3(...HOME), target: new THREE.Vector3(0, 0, 0) },
    orbit: { minDistance: 0.3, maxDistance: 25, cineSpeed: 0.6 },
    look: { exposure: 1.1, bloom: 0.14, sat: 1.12, con: 0.14, sh: [0.97, 0.97, 1.05] },
    update(dt, t, cam) {
      if (flowOn) { flowT += Math.min(dt, 0.1) * speed; u.uFlow.value = flowT; vol.invalidate(); }
      // < 1 Hz und nur ±15 % (WCAG 2.3.1)
      star.material.uniforms.uGain.value = breathe ? 1 + 0.15 * Math.sin(t * Math.PI * 2 * 0.2) : 1;
      vol.render(cam);
    },
    live: () => ({ hubble: 'Hubble, sichtbares Licht: innen weiß-blau (heißes Gas), Flügel orange (Stickstoff, Wasserstoff), Ränder rot; der Stern liegt hinter dem Staubband',
      miri: 'Webb MIRI (mittleres Infrarot): warmer Staub des Torus leuchtet, der Zentralstern wird sichtbar, Jets in Eisen- und Nickellinien',
      layers: 'Schichten: heißes Gas blau, Flügel grün, Stickstoff-Ränder rot, Jets magenta, Torus gelb' })[mode],
    setPixelRatio(pr, H) {
      sky.userData.setPixelRatio(pr);
      for (const p of [star, stars]) p.userData.setPx(pr, H, camera.fov);
      vol.setSize(Math.round(H * camera.aspect), H);
    },
    dispose: () => { disposeScene(scene); vol.dispose(); field.dispose(); },
  };
}
