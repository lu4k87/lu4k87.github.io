// Ast der Milchstraße 03A: Säulen der Schöpfung im Adlernebel M16 (Einheit 1 Lj), Blick von der Erde = −z, oben = +y.
// Drei Säulen aus kaltem Gas und Staub, von oben rechts angestrahlt vom jungen Haufen NGC 6611. Lage nach MUSE (ESO 2015,
// McLeod et al.): die Spitze der linken Säule zeigt zu uns, die Säule steht hinter NGC 6611; die übrigen Spitzen zeigen
// von uns weg. Linke Säule ≈ 4 Lj, etwa doppelt so hoch wie die rechte.
// Licht: die UV-Strahlung des Haufens trifft nur die ihm zugewandten Flächen (optische Tiefe zum Haufen einmal gebacken,
// Kanal g) → dünne leuchtende Ionisationsfront, davor strömt verdampfendes Gas zum Haufen hin (Photoverdampfung, Hester
// 1996). Farbmodi nach den Webb-Aufnahmen (NIRCam, MIRI, beide gemischt) und Hubble im sichtbaren Licht; Farben je
// Bauteil als Uniforms, damit ein Modus nur Werte tauscht.
// Leistung wie orion.js: grobe Felder in einer 3D-Textur (bakeField), feine Oktaven nur nahe der Oberfläche, Wolke in
// eigener Auflösung (offscreen); neu gerechnet nur bei Änderung – außer „Strömen“ ist an.

import * as THREE from 'three';
import { volume, pointCloud, bakeField, offscreen, disposeScene } from '../vol.js';
import { createStarfield } from '../stars.js';
import { registerLayers } from '../layers.js';
import { mulberry32, gauss, blackbody, LY } from '../astro.js';

const EXT = 13;   // Feldtextur: Würfel ±13 Lj um die Volumenkugel (Radius 12,5)

// Säule = quadratische Bézier-Achse Fuß → Spitze; Radius Fuß, Hals, Kopf (Globule an der Spitze)
// Lage nach MUSE: linke Säule hinten, Spitze zu uns; mittlere und rechte vorn, Spitzen von uns weg; NGC 6611 dazwischen
const LAYOUT = {
  cluster: [3.0, 6.6, -0.2],
  pillars: [
    [[-2.4, -7.4, -2.3], [-2.1, -1.6, -2.1], [-1.0, 0.25, -0.8], 1.05, 0.5, 0.6],
    [[0.5, -7.4, 1.3], [0.75, -3.2, 1.25], [0.95, -1.35, 0.45], 1.0, 0.62, 0.7],
    [[2.75, -7.4, 1.5], [2.6, -3.8, 1.4], [2.4, -2.35, 0.65], 0.8, 0.46, 0.5],
  ],
};
const v3 = (a) => `vec3(${a.map((x) => x.toFixed(3)).join(', ')})`;

// r Abstand zur Oberfläche (< 0 innen), g optische Tiefe zum Haufen, b Turbulenz für das Gas in der Höhle – alle in 0…1
// kodiert (Abstand −4…12 Lj, Tiefe 0…10), weil das Feld je nach Gerät auf 0…1 gekappt wird
const fieldBody = (L) => /* glsl */ `
vec3 bez(vec3 a, vec3 b, vec3 c, float s) { return mix(mix(a, b, s), mix(b, c, s), s); }
float pil(vec3 p, vec3 a, vec3 b, vec3 c, float ra, float rt, float rh) {
  float d = 1e9;
  vec3 q0 = a;
  for (int i = 1; i <= 10; i++) {
    float s1 = float(i) / 10.0;
    vec3 q1 = bez(a, b, c, s1);
    vec3 e = q1 - q0;
    float h = clamp(dot(p - q0, e) / dot(e, e), 0.0, 1.0);
    float s = s1 - 0.1 + 0.1 * h;
    float r = mix(ra, rt, smoothstep(0.0, 0.8, s)) + (rh - rt) * smoothstep(0.7, 0.97, s);
    d = min(d, length(p - q0 - e * h) - r);
    q0 = q1;
  }
  return d;
}
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float shape(vec3 p) {
  float d = ${L.pillars.map((P) => `pil(p, ${v3(P[0])}, ${v3(P[1])}, ${v3(P[2])}, ${P[3].toFixed(2)}, ${P[4].toFixed(2)}, ${P[5].toFixed(2)})`)
    .reduce((a, b) => `smin(${a}, ${b}, 0.5)`)};
  // Wolkenbank, aus der die Säulen wachsen (unten aus dem Bild hinaus)
  float bank = max(p.y + 6.6 - 1.4 * fbm(vec3(p.x, 0.0, p.z) * 0.3 + 3.0, 3), length(vec2(p.x - 0.3, p.z * 1.6)) - 6.0);
  return smin(d, bank, 0.8);
}
float coarse(vec3 p) { return shape(p) + (fbm(p * 0.55 + 7.0, 2) - 0.1) * 0.8; }
vec4 field(vec3 p) {
  float sd = shape(p) + (fbm(p * 0.55 + 7.0, 3) - 0.1) * 0.8;
  vec3 C = ${v3(L.cluster)};
  vec3 dir = C - p;
  float len = min(length(dir), 9.0);
  dir = normalize(dir);
  float tau = 0.0, st = len / 20.0;
  for (int i = 1; i <= 20; i++) tau += smoothstep(0.3, -0.3, coarse(p + dir * st * float(i))) * st * 2.5;
  return clamp(vec4(sd / 16.0 + 0.25, tau / 10.0, fbm(p * 0.22 + vec3(1.0, 4.0, 2.0), 3) * 0.5 + 0.5, 0.0), 0.0, 1.0);
}
`;

const BODY = /* glsl */ `
uniform highp sampler3D uField;
uniform vec3 uC, cSkin, cFlow, cBody, cHaze, cVeil, cCool;
uniform float uGain, uOpac, uLit, uRough, uSkin, uFlow, uFlowV, uHaze, uVeil, uCool, uShadow;
float fbmTail(vec3 p) {
  p = ROT3 * (ROT3 * p * 2.03) * 2.03;
  float s = 0.0, a = 0.125;
  for (int i = 2; i < OCT; i++) { s += a * gnoise(p); p = ROT3 * p * 2.03; a *= 0.5; }
  return s;
}
void sampleVol(vec3 p, out vec3 e, out float s) {
  vec4 f = texture(uField, p / ${(2 * EXT).toFixed(1)} + 0.5) * vec4(16.0, 10.0, 2.0, 1.0) - vec4(4.0, 0.0, 1.0, 0.0);
  float r = length(p);
  // ausgefranster Rand statt Kugel: Rauschen schiebt den Rand nur nach innen (≥ 0), Lappen + Fasern
  float off = 2.4 * (gnoise(p * 0.17 + 7.0) + 0.75) + 1.1 * (gnoise(p * 0.5 + 1.7) + 0.7) + 0.5 * (gnoise(p * 1.3 + 4.1) + 0.7);
  float edge = smoothstep(12.4, 8.0, r + 0.7 * off);
  float fade = smoothstep(12.4, 6.0, r + 0.8 * off);
  fade *= sqrt(fade);
  float sd = f.r;
  // feine Oktaven und senkrechte Furchen nur nahe der Oberfläche
  if (sd > -1.2 && sd < 1.4) sd += (fbmTail(p * 1.3) * 1.2 + (ridged(p * vec3(1.6, 0.4, 1.6) + 3.0, 3) - 0.55) * 0.45) * uRough;
  float dens = smoothstep(0.08, -0.3, sd) * edge;
  float lit = exp(-f.g * uShadow);
  vec3 L = normalize(uC - p);
  // Ionisationsfront: dünne Haut direkt vor der Oberfläche, nur wo das UV des Haufens ankommt
  float skin = exp(-abs(sd - 0.07) / (0.08 * uSkin)) * lit * edge;
  // Photoverdampfung: Gas löst sich von der Haut und strömt zum Haufen (uTime > 0 lässt es wandern)
  float flow = 0.0;
  if (sd > 0.0 && sd < 2.2 && lit > 0.02) {
    vec3 q = p - L * uTime * 0.08 * uFlowV;
    flow = exp(-sd / 0.5) * smoothstep(0.0, 0.12, sd) * lit * (0.3 + max(gnoise(q * 2.2) + 0.6 * gnoise(q * 4.6 + 2.0), 0.0)) * edge;
  }
  // ionisiertes Gas in der Höhle – nach hinten dichter (die „blaue Tiefe“), Schleier vor den Säulen
  float haze = (0.35 + max(f.b + 0.25, 0.0)) * (1.0 - dens) * fade * mix(0.35, 1.0, smoothstep(3.0, -7.0, p.z));
  float veil = exp(-pow((p.z - 3.6) / 1.6, 2.0)) * smoothstep(-0.05, 0.4, f.b) * fade;
  float cool = smoothstep(1.5, 5.0, p.y) * (0.4 + max(f.b + 0.3, 0.0)) * exp(-pow(p.z / 3.0, 2.0)) * fade;
  e = (cSkin * skin * 2.2 + cFlow * flow * uFlow + cBody * dens * mix(0.3, 1.0, lit) * uLit * 3.0 + cHaze * haze * uHaze * 0.035
       + cVeil * veil * uVeil * 0.09 + cCool * cool * uCool * 0.03) * uGain;
  s = dens * uOpac + veil * uVeil * 0.03;
}
`;

// Farben je Modus (linear, vor ACES): Haut, Strömung, Säulenkörper, Gas der Höhle, Schleier, kühler Staub (MIRI-„V“);
// opac = Undurchsichtigkeit der Säulen, lit = Eigenleuchten der beleuchteten Säulenseite, stars = Sternhelligkeit
const LOOKS = {
  mix: { skin: [1, 0.66, 0.4], flow: [1, 0.5, 0.24], body: [0.42, 0.3, 0.22], haze: [0.1, 0.24, 0.65], veil: [1, 0.4, 0.12], cool: [0, 0, 0],
    opac: 2.8, lit: 0.55, hazeAmt: 1, veilAmt: 1, coolAmt: 0, stars: 1 },
  nircam: { skin: [1, 0.78, 0.5], flow: [1, 0.6, 0.3], body: [0.95, 0.5, 0.2], haze: [0.2, 0.42, 0.6], veil: [0.9, 0.5, 0.25], cool: [0, 0, 0],
    opac: 1.5, lit: 0.8, hazeAmt: 1, veilAmt: 0.35, coolAmt: 0, stars: 1.2 },
  miri: { skin: [0.7, 0.78, 0.92], flow: [0.5, 0.55, 0.66], body: [0.55, 0.58, 0.64], haze: [0.04, 0.045, 0.06], veil: [0, 0, 0], cool: [0.75, 0.12, 0.08],
    opac: 3.2, lit: 0.9, hazeAmt: 0.6, veilAmt: 0, coolAmt: 1, stars: 0.25 },
  vis: { skin: [1, 0.86, 0.55], flow: [0.9, 0.75, 0.45], body: [0.2, 0.15, 0.09], haze: [0.1, 0.42, 0.45], veil: [0, 0, 0], cool: [0, 0, 0],
    opac: 4.5, lit: 0.45, hazeAmt: 1, veilAmt: 0, coolAmt: 0, stars: 0.8 },
};

// Webb-Sternspitzen: sechs Hauptstrahlen (Spiegel aus Sechsecken) + zwei schwache waagrechte (Halterung des Sekundärspiegels);
// feste Bildgröße je Helligkeit, damit ein Stern auch fern seine Spitzen behält
const SPIKE_VERT = /* glsl */ `
attribute vec3 color;
attribute float size;
uniform float uPx, uGain;
varying vec3 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(size * 40.0 / max(-mv.z, 1.0), 10.0, 150.0) * uPx;
  vCol = color * uGain;
}`;
const SPIKE_FRAG = /* glsl */ `
varying vec3 vCol;
float ray(vec2 d, float a, float w) {
  vec2 dir = vec2(cos(a), sin(a));
  float t = dot(d, dir);
  vec2 n = d - dir * t;
  return exp(-dot(n, n) * w) * pow(max(1.0 - abs(t) * 2.0, 0.0), 2.0);
}
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float sp = ray(d, 1.5708, 9000.0) + ray(d, 0.5236, 9000.0) + ray(d, 2.618, 9000.0) + 0.35 * ray(d * vec2(1.0, 1.0), 0.0, 14000.0) * step(abs(d.x), 0.3);
  gl_FragColor = vec4(vCol * sp, 1.0);
}`;
// junge Sterne an den Spitzen: weiches Atmen (0,1–0,4 Hz, weit unter der Grenze von 3 Hz)
const YSO_VERT = /* glsl */ `
attribute vec3 color;
attribute float size;
attribute float phase;
uniform float uPx, uScale, uGain, uTime, uFlick;
varying vec3 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(size * uScale / max(-mv.z, 1e-6), 1.5 * uPx, 30.0 * uPx);
  float f = 1.0 + uFlick * 0.4 * sin(uTime * (0.6 + 1.9 * fract(phase * 7.13)) + phase * 6.283);
  vCol = color * uGain * f;
}`;

const RES = [0.35, 0.5, 0.7, 1], RES_N = ['Niedrig', 'Mittel', 'Hoch', 'Voll'];
const STEPS = [64, 96, 128, 160], STEPS_N = ['Grob', 'Mittel', 'Fein', 'Sehr fein'];
const times = (v) => (v ? `×${String(v).replace('.', ',')}` : 'aus');

export function create(ctx) {
  const lay = LAYOUT;
  const C = new THREE.Vector3(...lay.cluster);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 500);
  const sky = createStarfield({ gain: 0.8, seed: 16, ngp: new THREE.Vector3(-0.5, 0.2, 0.85), gc: new THREE.Vector3(0.1, 0.95, -0.2) });
  scene.add(sky);

  const field = bakeField(ctx.renderer, { size: 128, extent: EXT, body: fieldBody(lay) });
  const col3 = (a) => ({ value: new THREE.Vector3(...a) });
  const neb = volume({ radius: 12.5, body: `#define OCT ${ctx.detail > 0.7 ? 5 : 4}\n${BODY}`, steps: STEPS[2], maxSteps: STEPS[3], uniforms: {
    uField: { value: field.texture }, uC: { value: C }, uGain: { value: 0.5 }, uOpac: { value: 2.8 }, uLit: { value: 0.55 }, uRough: { value: 1 },
    uSkin: { value: 1 }, uFlow: { value: 1 }, uFlowV: { value: 1 }, uHaze: { value: 1 }, uVeil: { value: 1 }, uCool: { value: 0 }, uShadow: { value: 1 },
    cSkin: col3([1, 1, 1]), cFlow: col3([1, 1, 1]), cBody: col3([1, 1, 1]), cHaze: col3([1, 1, 1]), cVeil: col3([1, 1, 1]), cCool: col3([1, 1, 1]),
  } });
  const vol = offscreen(ctx.renderer, neb);
  vol.quad.renderOrder = 1;
  scene.add(vol.quad);
  const u = neb.material.uniforms;

  // Sterne: NGC 6611 (heiße O- und B-Sterne, oben rechts außerhalb des klassischen Bildausschnitts) + Feldsterne im Raum
  const rand = mulberry32(6611);
  const pos = [], col = [], size = [], sp = [], sc = [], ss = [];
  const add = (v, T, k, s) => { pos.push(v.x, v.y, v.z); col.push(...blackbody(T).map((x) => x * k)); size.push(s); };
  const spike = (v, T, k) => { sp.push(v.x, v.y, v.z); sc.push(...blackbody(T).map((x) => x * k)); ss.push(Math.sqrt(k)); };
  for (let i = 0; i < 70; i++) {
    const v = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(1.1).add(C);
    const hot = i < 12;
    add(v, hot ? 30000 + rand() * 12000 : 9000 + rand() * 12000, hot ? 30 : 2 + rand() * 4, 0.05);
    if (hot) spike(v, 32000, 1.6);
  }
  for (let i = 0; i < 1400; i++) {
    const v = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(2 + 10.5 * Math.cbrt(rand()));
    const T = rand() < 0.15 ? 9000 + rand() * 15000 : 3200 + rand() * 3000;
    const k = 0.3 + rand() * rand() * 4;
    add(v, T, k, 0.03);
    if (k > 2.4) spike(v, T, k * 0.3);
  }
  const stars = pointCloud(pos, col, size, { min: 1.2 });
  stars.renderOrder = 2;
  scene.add(stars);
  const spikes = pointCloud(sp, sc, ss, { vert: SPIKE_VERT, frag: SPIKE_FRAG });
  spikes.renderOrder = 3;
  scene.add(spikes);

  // junge Sterne und Ausflüsse an den Säulenspitzen (rot, im Infrarot sichtbar; „wenige hunderttausend Jahre“ alt)
  const yp = [], yc = [], ys = [], yph = [];
  lay.pillars.forEach(([, , tip, , , rh], j) => {
    for (let i = 0; i < 3 + j; i++) {
      const v = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(rh * (0.6 + rand() * 0.5)).add(new THREE.Vector3(...tip));
      yp.push(v.x, v.y, v.z); yc.push(...blackbody(1800 + rand() * 900).map((x) => x * (4 + rand() * 8))); ys.push(0.05); yph.push(rand());
    }
  });
  const ysos = pointCloud(yp, yc, ys, { vert: YSO_VERT });
  ysos.geometry.setAttribute('phase', new THREE.Float32BufferAttribute(yph, 1));
  Object.assign(ysos.material.uniforms, { uTime: { value: 0 }, uFlick: { value: 1 } });
  ysos.renderOrder = 2;
  scene.add(ysos);

  let mode = 'mix', starGain = 1, hazeMul = 1, opacMul = 1, veilMul = 1, flowOn = true;
  const applyLook = () => {
    const k = LOOKS[mode];
    for (const [n, key] of [['cSkin', 'skin'], ['cFlow', 'flow'], ['cBody', 'body'], ['cHaze', 'haze'], ['cVeil', 'veil'], ['cCool', 'cool']]) u[n].value.set(...k[key]);
    u.uOpac.value = k.opac * opacMul; u.uLit.value = k.lit; u.uHaze.value = k.hazeAmt * hazeMul; u.uVeil.value = k.veilAmt * veilMul; u.uCool.value = k.coolAmt;
    stars.material.uniforms.uGain.value = starGain * k.stars;
    spikes.material.uniforms.uGain.value = spikes.visible ? starGain * k.stars : 0;
    ysos.material.uniforms.uGain.value = starGain * (mode === 'vis' ? 0.15 : 1);
    vol.invalidate();
  };
  const tips = lay.pillars.map((P) => new THREE.Vector3(...P[2]));
  const hotspots = [
    { id: 'p1', kind: 'info', pos: tips[0].clone().add(new THREE.Vector3(0, 0.6, 0)) },
    { id: 'p2', kind: 'info', pos: tips[1].clone().add(new THREE.Vector3(0, 0.7, 0)) },
    { id: 'p3', kind: 'info', pos: tips[2].clone().add(new THREE.Vector3(0, 0.5, 0)) },
    { id: 'ngc6611', kind: 'info', pos: C.clone() },
    { id: 'evap', kind: 'info', pos: tips[1].clone().add(new THREE.Vector3(0.8, 1.1, 0)) },
    { id: 'ysos', kind: 'info', pos: tips[2].clone().add(new THREE.Vector3(0.5, -0.2, 0)) },
  ];
  const controls = [{
    id: 'mode', label: 'Farben', value: 'mix', options: [['mix', 'Webb: NIRCam + MIRI'], ['nircam', 'Webb: NIRCam'], ['miri', 'Webb: MIRI'], ['vis', 'Hubble: sichtbar']],
    set: (v) => { mode = v; applyLook(); },
  }];
  applyLook();

  const to = (k, f = (v) => v) => (v) => { u[k].value = f(v); vol.invalidate(); };
  const fine = ctx.detail > 0.9;
  registerLayers('pillars', [
    { id: 'gain', type: 'range', group: 'Licht des Gases', label: 'Helligkeit', min: 0.25, max: 6, step: 0.25, value: 1, fmt: times, set: to('uGain', (v) => 0.5 * v) },
    { id: 'skin', type: 'range', label: 'Leuchtende Kante', min: 0.5, max: 3, step: 0.25, value: 1, fmt: times, set: to('uSkin'),
      hint: 'Ionisationsfront: Hier trifft das UV-Licht von NGC 6611 auf die Säulen und bringt eine dünne Gasschicht zum Leuchten.' },
    { id: 'haze', type: 'range', label: 'Gas in der Höhle', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: (v) => { hazeMul = v; applyLook(); } },
    { id: 'veil', type: 'range', label: 'Oranger Schleier', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: (v) => { veilMul = v; applyLook(); },
      active: () => mode === 'mix' || mode === 'nircam', only: 'Wirkt bei den Webb-Farben NIRCam + MIRI und NIRCam.',
      hint: 'Dünner Staub vor den Säulen, in den Webb-Bildern als oranger Hauch.' },
    { id: 'shadow', type: 'range', group: 'Struktur', label: 'Schatten der Säulen', min: 0, max: 3, step: 0.25, value: 1, fmt: times, set: to('uShadow'),
      hint: 'Was im UV-Schatten der Köpfe liegt, wird nicht verdampft – so entstehen die Säulen überhaupt.' },
    { id: 'rough', type: 'range', label: 'Furchen und Klumpen', min: 0, max: 3, step: 0.25, value: 1, fmt: times, set: to('uRough') },
    { id: 'opac', type: 'range', label: 'Dichte der Säulen', min: 0.25, max: 3, step: 0.25, value: 1, fmt: times, set: (v) => { opacMul = v; applyLook(); } },
    { id: 'flow', type: 'toggle', group: 'Bewegung', label: 'Verdampfendes Gas strömt', value: true, set: (v) => { flowOn = v; u.uTime.value = 0; vol.invalidate(); },
      hint: 'Rund 70 Sonnenmassen je Million Jahre lösen sich von den Säulen (ESO 2015) – hier stark beschleunigt.' },
    { id: 'flowv', type: 'range', label: 'Tempo des Strömens', min: 0.25, max: 4, step: 0.25, value: 1, fmt: times, set: to('uFlowV'),
      active: () => flowOn, only: 'Wirkt, wenn „Verdampfendes Gas strömt“ an ist.' },
    { id: 'flick', type: 'toggle', label: 'Junge Sterne atmen', value: true, set: (v) => { ysos.material.uniforms.uFlick.value = v ? 1 : 0; } },
    { id: 'spikes', type: 'toggle', group: 'Sterne', label: 'Webb-Sternspitzen', value: true, set: (v) => { spikes.visible = v; applyLook(); } },
    { id: 'stars', type: 'range', label: 'Helligkeit der Sterne', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: (v) => { starGain = v; applyLook(); } },
    { id: 'res', type: 'range', group: 'Qualität der Wolke', label: 'Detailstufe', min: 0, max: 3, step: 1, value: fine ? 1 : 2, fmt: (i) => RES_N[i], set: (i) => vol.setScale(RES[i]) },
    { id: 'steps', type: 'range', label: 'Rechengenauigkeit', min: 0, max: 3, step: 1, value: fine ? 2 : 1, fmt: (i) => STEPS_N[i], set: to('uSteps', (i) => STEPS[i]) },
  ]);

  const view = new URLSearchParams(location.search).get('view');
  const HOME = { side: [15, -1.6, 1.2], top: [1.2, 13, 3.5], near: [-0.6, 0.2, 4.5], far: [0.6, -1.4, 30] }[view] || [0.6, -1.4, 14];
  return {
    scene, camera, unit: LY, hotspots, controls, msaa: false,
    ready: field.ready.then(() => ctx.renderer.compileAsync(vol.scene, camera)),
    home: { pos: new THREE.Vector3(...HOME), target: new THREE.Vector3(0.3, -2.6, 0) },
    orbit: { minDistance: 1.2, maxDistance: 40, cineSpeed: 0.6 },
    look: { exposure: 1.1, bloom: 0.1, sat: 1.1, con: 0.12, sh: [0.96, 0.98, 1.06] },
    update(dt, t, cam) {
      ysos.material.uniforms.uTime.value = t;
      if (flowOn) { u.uTime.value = t; vol.invalidate(); }
      vol.render(cam);
    },
    live: () => ({ mix: 'Webb NIRCam + MIRI: Staub der Säulen grau-braun, oranger Schleier, ionisiertes Gas blau',
      nircam: 'Webb NIRCam (0,9–4,7 µm): Säulen durchscheinend orange, junge Sterne mit roten Ausflüssen',
      miri: 'Webb MIRI (7,7–15 µm): nur warmer Staub leuchtet, die meisten Sterne verschwinden',
      vis: 'Hubble, sichtbares Licht: dichter Staub verdeckt das Innere, die Kanten leuchten' })[mode],
    setPixelRatio(pr, H) {
      sky.userData.setPixelRatio(pr);
      for (const p of [stars, spikes, ysos]) p.userData.setPx(pr, H, camera.fov);
      vol.setSize(Math.round(H * camera.aspect), H);
    },
    dispose: () => { disposeScene(scene); vol.dispose(); field.dispose(); },
  };
}
