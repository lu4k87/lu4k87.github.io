// Ast der Milchstraße 03B: Roter Spinnennebel NGC 6537 (Einheit 1 Lj), Blick von der Erde = −z, Norden = +y, Osten = −x.
// Bipolarer planetarischer Nebel nach Kastner et al. 2025 (JWST/NIRCam, ALMA): zwei geschlossene, von H2 umrandete Keulen
// je ≈ 1,1 pc entlang der Polachse (Positionswinkel ≈ 45°, 38° gegen die Himmelsebene geneigt; NO-Keule von uns weg,
// SW-Keule zu uns), schmale Taille mit kaltem Staub-Torus (Radius ≈ 0,13 pc, punktsymmetrisch verdichtet), ionisierter
// Kern (Brα) in einem Kokon aus PAH-Staub. [Fe II] leuchtet punktsymmetrisch an gegenüberliegenden Keulenwänden (Südrand
// der NO-Keule, Nordrand der SW-Keule): dort schert ein schneller Ausfluss an früher ausgeworfenem Gas → S-Form.
// Form nach Webb potm2510a und Hubble heic0109: Keulen als Sanduhr-Hälften aus einem Netz von Fäden, Wände gewellt, Spitzen
// ausgefranst und lückenhaft, fleckiger Schleier außen, offene Hörner an der Taille; Stärke dieser Formteile: Modell.
// Symmetrie billig: die Gegenkeule ist die am Zentrum gespiegelte Keule (q = p · sign(h)), so wird alles punktsymmetrisch.
// Farben je Bauteil als Uniforms (wie pillars.js), ein Farbmodus tauscht nur Werte. Leistung wie orion.js: grobe Felder in
// einer 3D-Textur, Fäden nur nahe der Keulenhaut, Wolke offscreen und nur bei Änderung neu; Bewegung (Knoten im Ausfluss,
// Atmen des Zentralsterns) als Punkte außerhalb der Wolke.

import * as THREE from 'three';
import { volume, pointCloud, bakeField, offscreen, disposeScene } from '../vol.js';
import { createStarfield } from '../stars.js';
import { registerLayers, setLayer } from '../layers.js';
import { mulberry32, gauss, blackbody, LY } from '../astro.js';

const VR = 4.6;                        // Volumenkugel (Lj)
const EXT = 4.8;                       // Feldtextur: Würfel ±4,8 Lj um die Volumenkugel
// Keule als Sanduhr-Hälfte: Querschnitt R(h) = LB · s^0,55 · √(1 − s^2,5) / 0,641 mit s = h / LT – an der Taille rasch weit,
// größter Radius LB bei s ≈ 0,6, zur Spitze zulaufend; Spitze bei LT ≈ 3,65 Lj (1,1 pc)
const LT = 3.65, LB = 1.25;
const TILT = 0.12;                     // Keulenachse leicht zur [Fe II]-Seite gedreht (S-Form)
// Polachse: Positionswinkel 45° (Nordost), 38° gegen die Himmelsebene, NO-Keule von uns weg (−z)
const I = (38 * Math.PI) / 180;
const AXIS = new THREE.Vector3(-Math.SQRT1_2 * Math.cos(I), Math.SQRT1_2 * Math.cos(I), -Math.sin(I));
const SIDE = new THREE.Vector3(-Math.SQRT1_2, -Math.SQRT1_2, 0);   // Südost: Seite der NO-Keule, an der [Fe II] leuchtet
const A2 = AXIS.clone().addScaledVector(SIDE, TILT).normalize();
const B2 = SIDE.clone().addScaledVector(A2, -SIDE.dot(A2)).normalize();

// r Verwerfung der Keulenhaut, g Klumpen, b Klumpen im Torus
const FIELD = /* glsl */ `
vec4 field(vec3 p) {
  return vec4(fbm(p * 0.9 + vec3(3.0, 1.0, 7.0), 3), fbm(p * 2.2 + 5.0, 3), fbm(p * 1.6 + vec3(9.0, 4.0, 2.0), 3), 0.0);
}
`;

const BODY = /* glsl */ `
uniform vec3 uA, uA2, uB2, uE1, uE2;
uniform float uGain, uH2, uIon, uFe, uCore, uPah, uTorus, uDust, uDustT, uFil, uSat, uWarp, uRip, uFray, uOpen, uVeil;
uniform vec3 cH2, cIon, cFe, cCore, cPah, cTor;
uniform highp sampler3D uField;
const float LT = ${LT.toFixed(3)}, LB = ${LB.toFixed(3)};
// Querschnitt der Keule in der Höhe ha (Ellipsoid)
float lobeR(float ha) { float s = clamp(ha / LT, 0.0, 1.0); return LB * pow(s, 0.55) * sqrt(max(1.0 - pow(s, 2.5), 0.0)) / 0.641; }
// R² der Keule und Ableitung nach ha: an der Spitze glatt (linear), darüber hinaus linear fortgesetzt (< 0 = jenseits der Kuppel)
float lobeQ(float ha, out float dQ) {
  const float C = LB * LB / (0.641 * 0.641);
  float s = max(ha / LT, 0.0);
  if (s >= 1.0) { dQ = -2.5 * C / LT; return dQ * (ha - LT); }
  dQ = C / LT * (1.1 * pow(s, 0.1) - 3.6 * pow(s, 2.6));
  return C * pow(s, 1.1) * (1.0 - pow(s, 2.5));
}
void sampleVol(vec3 p, out vec3 e, out float s) {
  vec3 f = texture(uField, p / ${(2 * EXT).toFixed(2)} + 0.5).rgb;
  float h = dot(p, uA);
  vec3 q = h < 0.0 ? -p : p;                         // Gegenkeule = gespiegelte Keule → Punktsymmetrie
  float ha = dot(q, uA2);
  vec3 perp = q - uA2 * ha;
  float rp = length(perp);
  // Wand: Ellipsoid, großräumig verbeult, quer gewellt (Hubble: Wellenkämme der Wände, heic0109); zur Spitze hin zerfranst
  float tip = smoothstep(LT - 1.5, LT, ha);
  float wave = sin(ha * 7.0 + f.r * 4.0 + f.g * 2.5) * 0.05 * uRip * (0.4 + 0.6 * smoothstep(0.3, 1.4, ha));
  float m = 1.0 + 0.32 * f.r * uWarp;
  float R = lobeR(ha) * m + wave;
  float dR = (lobeR(ha + 0.03) - lobeR(ha - 0.03)) / 0.06;
  // Abstand zur Wand (Lj), > 0 außen. Zur Spitze wird R' unendlich, (rp − R) / √(1 + R'²) fiel dort für jedes rp auf 0 und die
  // Haut füllte eine flache Scheibe quer zur Achse (harte Kante); an der Spitze daher über R² (dort glatt) → runde Kuppel
  float dQ, Q = lobeQ(ha, dQ) * m * m;
  float dTip = (rp * rp - Q) / sqrt(4.0 * rp * rp + dQ * dQ * m * m * m * m) - wave;
  float d = mix((rp - R) / sqrt(1.0 + dR * dR), dTip, smoothstep(LT - 1.2, LT - 0.4, ha))
          - 0.1 * f.g * uWarp;                       // kleinräumig verbeult: der Umriss läuft nirgends als gerade Linie
  // H2-Haut der Keulen (Webb potm2510a): kein glatter Ballon, sondern ein Netz aus Fäden längs der Strömung; die Haut wird zur
  // Spitze dicker und löchriger, die Kappe reißt auf (offene Enden), außen hängen Strähnen (Ausfransen). Nach außen läuft die
  // Haut weich und ungleich breit aus, Strähnen hängen an der ganzen Wand (an der Spitze am längsten) – eine dünne, scharfe
  // Schale zeichnete am Rand der Keule eine harte, helle Linie
  float wid = 0.045 + 0.04 * max(f.g + 0.3, 0.0) + 0.16 * tip * uFray;
  float skin = exp(-pow(d / (d > 0.0 ? wid * (1.25 + 1.1 * max(f.r + 0.3, 0.0)) : wid), 2.0));
  float frin = d > 0.0 ? exp(-d / (0.03 + 0.28 * uFray * (0.5 + 0.5 * tip))) * (0.25 + 0.75 * tip) * uFray : 0.0;
  float fil = 0.0, net = 0.0;
  if (skin + frin > 0.02) {
    fil = ridged(perp * 5.2 + uA2 * ha * 1.5 + vec3(1.0, 6.0, 2.0), 3);
    net = fil * fil * fil;
  }
  float open = 1.0 - tip * tip * clamp(uOpen, 0.0, 1.5) * smoothstep(-0.25, 0.25, f.g + 0.6 * f.r + 0.15);
  float h2 = (skin * (0.035 + 3.2 * uFil * net) + frin * 1.8 * uFil * net) * (0.5 + 1.0 * max(f.g + 0.25, 0.0)) * smoothstep(0.1, 0.5, ha)
           * max(open, 0.0) * uH2;
  // Schleier außen: dünner, fleckiger Rest früheren Auswurfs um beide Keulen
  float veil = exp(-pow((d - 0.3) / 0.28, 2.0)) * max(f.r + 0.05, 0.0) * max(f.g + 0.15, 0.0) * (0.3 + net) * 0.3 * uVeil;
  // Hörner an der Taille: offene, gewellte Kegelwände um die Achse, im sichtbaren Licht die vier „Beine“ der Spinne
  float hr = 0.06 + 0.42 * ha * (1.0 + 0.25 * f.r) + 0.015 * sin(ha * 14.0 + f.r * 7.0 + f.g * 3.0) * uRip;
  float inner = exp(-pow((rp - hr) / (0.035 + 0.03 * ha), 2.0)) * smoothstep(1.5, 0.5, ha + 0.4 * f.r) * smoothstep(0.03, 0.12, ha)
              * (0.6 + 0.9 * max(f.g + 0.2, 0.0)) * 1.4 * uIon;
  // [Fe II]: Ausfluss trifft auf die Keulenwand an der Seite uB2, vom Kern aus an die Wand gebogen → S-Form
  vec3 c = uB2 * lobeR(ha) * 0.86 * smoothstep(0.0, 1.5, ha);
  float dj = length(perp - c);
  float knots = 0.45 + 1.4 * max(gnoise(vec3(ha * 4.5, f.g * 2.0, 1.7)), 0.0);
  float fe = exp(-pow(dj / (0.07 + 0.08 * ha / LT), 2.0)) * smoothstep(0.05, 0.4, ha) * smoothstep(LT + 0.1, 0.66 * LT, ha) * knots;
  fe *= 1.0 + 1.4 * exp(-pow((ha - 2.4) / 0.45, 2.0));   // hellere Stoßzone, wo der Ausfluss altes Gas trifft
  fe *= 2.2 * uFe;
  // Torus in der Äquatorebene (kalter Staub, punktsymmetrisch verdichtet), Kern und PAH-Kokon um den Stern
  float r = length(p);
  float rr = length(p - uA * h);
  float phi = atan(dot(p, uE2), dot(p, uE1));
  float tor = exp(-pow(h / 0.15, 2.0)) * exp(-pow((rr - 0.42) / 0.2, 2.0))   /* 0,13 pc = 0,42 Lj (Einheit 1 Lj) */ * (0.45 + 0.55 * cos(2.0 * phi)) * (0.6 + max(f.b + 0.4, 0.0));
  float core = exp(-pow(r / 0.17, 2.0)) * (0.5 + 1.2 * max(f.g + 0.3, 0.0))
             + exp(-pow((r - 0.06 - 0.015 * sin(phi + r * 60.0)) / 0.018, 2.0)) * 1.5;   // unregelmäßig spiraliger Rand
  float pah = exp(-pow((r - 0.3 * (1.0 + 0.3 * f.g)) / 0.08, 2.0)) * (0.5 + 0.9 * max(f.b + 0.3, 0.0));
  vec3 col = cH2 * (h2 + veil) + cIon * inner + cFe * fe + cCore * core * uCore + cPah * pah * uPah + cTor * tor * uTorus;
  col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, uSat), 0.0);
  e = col * uGain * smoothstep(${VR.toFixed(2)}, ${(VR - 0.5).toFixed(2)}, r);   // Fransen vor dem Rand der Volumenkugel weich aus
  s = (tor * 9.0 * uTorus + pah * 1.2 * uPah) * uDust * uDustT + (skin * 0.08 * max(open, 0.0) + veil * 0.6 + core * 0.2) * uDustT;
}
`;

// Farben je Modus: Webb NIRCam nach potm2510a (H2 blau, [Fe II] violett, Brα rot, PAH orange), Hubble sichtbar (Hα + [N II]
// rot, H2 und [Fe II] kaum), Schichten = je Bauteil eine eigene Farbe
const LOOKS = {
  nircam: { h2: [0.2, 0.45, 1.0], ion: [0.55, 0.45, 0.9], fe: [0.85, 0.3, 1.0], core: [1.0, 0.45, 0.35], pah: [1.0, 0.5, 0.15], tor: [0.25, 0.08, 0.02],
    dustT: 0.35, star: [1.0, 0.35, 0.2], knot: [0.85, 0.35, 1.0], stars: 1 },
  vis: { h2: [0.12, 0.02, 0.02], ion: [1.0, 0.18, 0.12], fe: [0.25, 0.04, 0.04], core: [1.0, 0.55, 0.4], pah: [0.08, 0.02, 0.01], tor: [0.02, 0.01, 0.0],
    dustT: 1, star: [0.6, 0.75, 1.0], knot: [0.9, 0.2, 0.15], stars: 0.8 },
  layers: { h2: [0.1, 0.85, 1.0], ion: [0.2, 0.9, 0.35], fe: [1.0, 0.2, 0.75], core: [1.0, 0.2, 0.15], pah: [1.0, 0.85, 0.2], tor: [0.9, 0.55, 0.25],
    dustT: 0.15, star: [1.0, 1.0, 1.0], knot: [1.0, 0.3, 0.85], stars: 0.6 },
};

const RES = [0.35, 0.5, 0.7, 1], RES_N = ['Niedrig', 'Mittel', 'Hoch', 'Voll'];
const STEPS = [96, 128, 176, 224], STEPS_N = ['Grob', 'Mittel', 'Fein', 'Sehr fein'];
// Zeitraffer der Knoten: Stufen als Vielfaches des Grundtempos
const SPD = [0.25, 0.5, 1, 2, 3];
const times = (v) => (v ? `×${String(v).replace('.', ',')}` : 'aus');
// Startformen der Keulen (Vorschau 28.10.2026 „echte Nebelform“: alle drei gewählt → Standard = Mischung aus A, B, C);
// die Formwahl setzt nur die Regler, jeder bleibt einzeln verstellbar
const FORM_N = ['Mischung', 'Fadennetz', 'Zerfranst', 'Wellen'];
const FORMS = [
  { fil: 1.25, rip: 1.25, warp: 1.25, fray: 1.25, open: 0.7, veil: 1.25, ion: 1.25 },
  { fil: 2, rip: 0.5, warp: 1, fray: 0.5, open: 0.2, veil: 0.5, ion: 1 },
  { fil: 1.25, rip: 1, warp: 1.75, fray: 2.5, open: 1.3, veil: 1, ion: 1 },
  { fil: 0.75, rip: 2.5, warp: 1, fray: 1, open: 0.6, veil: 2, ion: 2 },
];
const KNOTS = 36;   // je Keule; laufen entlang der [Fe II]-Bahn nach außen
// Bahn der Knoten in der Höhe ha (gleiche Kurve wie im Shader, Gegenkeule gespiegelt)
const lobeR = (ha) => { const s = Math.min(Math.max(ha / LT, 0), 1); return (LB * s ** 0.55 * Math.sqrt(Math.max(1 - s ** 2.5, 0))) / 0.641; };
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 500);
  // dichter Himmel: NGC 6537 liegt im Schützen fast in der galaktischen Ebene (l = 10,1°, b = +0,7°), nahe am Zentrum
  const sky = createStarfield({ count: 42000, gain: 0.8, band: 1.6, seed: 6537, ngp: new THREE.Vector3(0.5, 0.85, 0.15), gc: new THREE.Vector3(0.17, -0.1, -1) });
  scene.add(sky);

  const e1 = B2.clone().addScaledVector(AXIS, -B2.dot(AXIS)).normalize().applyAxisAngle(AXIS, 0.35);   // Torus ≈ 20° verdreht
  const e2 = new THREE.Vector3().crossVectors(AXIS, e1);
  const col3 = () => ({ value: new THREE.Vector3(1, 1, 1) });
  const field = bakeField(ctx.renderer, { size: 128, extent: EXT, body: FIELD });
  const neb = volume({ radius: VR, body: BODY, steps: STEPS[1], maxSteps: STEPS[3], uniforms: {
    uField: { value: field.texture }, uA: { value: AXIS }, uA2: { value: A2 }, uB2: { value: B2 }, uE1: { value: e1 }, uE2: { value: e2 },
    uGain: { value: 1.4 }, uH2: { value: 1 }, uIon: { value: 1 }, uFe: { value: 1 }, uCore: { value: 1 }, uPah: { value: 1 }, uTorus: { value: 1 },
    uDust: { value: 1 }, uDustT: { value: 1 }, uFil: { value: 1 }, uSat: { value: 1 }, uWarp: { value: 1 },
    uRip: { value: 1 }, uFray: { value: 1 }, uOpen: { value: 0.7 }, uVeil: { value: 1 },
    cH2: col3(), cIon: col3(), cFe: col3(), cCore: col3(), cPah: col3(), cTor: col3(),
  } });
  const vol = offscreen(ctx.renderer, neb);
  vol.quad.renderOrder = 1;
  scene.add(vol.quad);
  const u = neb.material.uniforms;

  // Zentralstern (≈ 160.000 K; bei Webb rot durch heißen Staub ≈ 1.000 K in einer Scheibe) und Feldsterne im Raum davor/dahinter
  const rand = mulberry32(6537);
  const star = pointCloud([0, 0, 0], [1, 1, 1], [0.05], { min: 2.4 });
  star.renderOrder = 3;
  scene.add(star);
  const pos = [], col = [], size = [];
  for (let i = 0; i < 1800; i++) {
    const v = new THREE.Vector3((rand() - 0.5) * 30, (rand() - 0.5) * 30, (rand() - 0.5) * 30);
    if (v.length() < 2) continue;
    const T = rand() < 0.12 ? 9000 + rand() * 16000 : 3000 + rand() * 3200;
    add(pos, col, size, v, T, 0.25 + rand() * rand() * 3, 0.03);
  }
  const field3 = pointCloud(pos, col, size, { min: 1.1 });
  field3.renderOrder = 2;
  scene.add(field3);

  // Knoten im Ausfluss: Lage je Bild auf der CPU entlang der [Fe II]-Bahn; Gegenkeule gespiegelt
  const kp = new Float32Array(KNOTS * 2 * 3), kc = new Float32Array(KNOTS * 2 * 3), ks = new Float32Array(KNOTS * 2).fill(0.035);
  const ku = Array.from({ length: KNOTS }, () => rand()), kj = Array.from({ length: KNOTS }, () => [gauss(rand) * 0.05, gauss(rand) * 0.05, 0.6 + rand() * 0.8]);
  const knots = pointCloud(kp, kc, ks, { min: 1.4 });
  knots.renderOrder = 2;
  scene.add(knots);
  const kPos = knots.geometry.attributes.position, kCol = knots.geometry.attributes.color;
  const tmp = new THREE.Vector3(), w2 = new THREE.Vector3().crossVectors(A2, B2);
  let knotTint = [1, 1, 1], speed = 1;
  const placeKnots = (dt) => {
    for (let i = 0; i < KNOTS; i++) {
      ku[i] = (ku[i] + dt * 0.035 * speed * kj[i][2]) % 1;
      const ha = 0.15 + ku[i] * 3.2, off = lobeR(ha) * 0.86 * smooth(0, 1.5, ha);
      tmp.copy(A2).multiplyScalar(ha).addScaledVector(B2, off + kj[i][0]).addScaledVector(w2, kj[i][1]);
      const k = Math.sin(Math.PI * ku[i]) * kj[i][2];
      for (const [j, sg] of [[i, 1], [i + KNOTS, -1]]) {
        kPos.setXYZ(j, tmp.x * sg, tmp.y * sg, tmp.z * sg);
        kCol.setXYZ(j, knotTint[0] * k, knotTint[1] * k, knotTint[2] * k);
      }
    }
    kPos.needsUpdate = true; kCol.needsUpdate = true;
  };

  let mode = 'nircam', starGain = 1, dustMul = 1, flowOn = true, breathe = true, spdIdx = 2;
  const applyLook = () => {
    const k = LOOKS[mode];
    for (const [n, key] of [['cH2', 'h2'], ['cIon', 'ion'], ['cFe', 'fe'], ['cCore', 'core'], ['cPah', 'pah'], ['cTor', 'tor']]) u[n].value.set(...k[key]);
    u.uDustT.value = k.dustT * dustMul;
    star.geometry.attributes.color.setXYZ(0, ...k.star.map((x) => x * 40));
    star.geometry.attributes.color.needsUpdate = true;
    knotTint = k.knot.map((x) => x * (mode === 'vis' ? 0.6 : 2.2));
    field3.material.uniforms.uGain.value = starGain * k.stars;
    sky.userData.material.uniforms.uGain.value = 0.8 * starGain * k.stars;
    placeKnots(0);
    vol.invalidate();
  };
  applyLook();

  const hotspots = [
    { id: 'star', kind: 'info', pos: new THREE.Vector3(0, 0, 0) },
    { id: 'lobene', kind: 'info', pos: AXIS.clone().multiplyScalar(2.6) },
    { id: 'lobesw', kind: 'info', pos: AXIS.clone().multiplyScalar(-2.6) },
    { id: 'iron', kind: 'info', pos: A2.clone().multiplyScalar(2.4).addScaledVector(B2, lobeR(2.4) * 0.86) },
    { id: 'torus', kind: 'info', pos: e1.clone().multiplyScalar(0.4) },
  ];
  const controls = [{
    id: 'mode', label: 'Farben', value: 'nircam', options: [['nircam', 'Webb: NIRCam'], ['vis', 'Hubble: sichtbar'], ['layers', 'Schichten']],
    set: (v) => { mode = v; applyLook(); },
  }];

  const to = (k, f = (v) => v) => (v) => { u[k].value = f(v); vol.invalidate(); };
  const fine = ctx.detail > 0.9;
  let formReady = false;   // Laden stellt die gespeicherten Einzelwerte, die Formwahl wirkt erst bei Bedienung
  const F0 = FORMS[0];
  registerLayers('spider', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', value: spdIdx, min: 0, max: SPD.length - 1, step: 1, autoplay: !ctx.still, fmt: (i) => times(SPD[Math.round(i)]),
      hint: 'Knoten strömen nach außen, in Wirklichkeit mit 300–400 km/s – für eine Keulenlänge brauchen sie rund 3.700 Jahre. Hier stark beschleunigt.',
      set: (i, playing) => { spdIdx = Math.round(i); speed = SPD[spdIdx]; flowOn = playing; },
      get: () => ({ value: spdIdx, playing: flowOn }), status: () => (flowOn ? 'Knoten strömen' : 'angehalten') },
    { id: 'gain', type: 'range', group: 'Licht des Gases', label: 'Helligkeit', min: 0.25, max: 6, step: 0.25, value: 1, fmt: times, set: to('uGain', (v) => 1.4 * v) },
    { id: 'sat', type: 'range', label: 'Farbsättigung', min: 0, max: 3, step: 0.1, value: 1, fmt: (v) => (v ? `${Math.round(v * 100)} %` : 'grau'), set: to('uSat') },
    { id: 'form', type: 'range', group: 'Keulen', label: 'Form der Keulen', min: 0, max: 3, step: 1, value: 0, fmt: (i) => FORM_N[i],
      set: (i) => { if (formReady) for (const [k, v] of Object.entries(FORMS[i])) setLayer('spider', k, v); },
      hint: 'Fadennetz wie bei Webb, zerfranste offene Spitzen, gewellte Wände wie bei Hubble – oder die Mischung. Setzt die Regler darunter.' },
    { id: 'h2', type: 'range', label: 'H2-Haut der Keulen', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: to('uH2'),
      hint: 'Warmer molekularer Wasserstoff (2,12 µm) umrandet beide Keulen wie eine Blase; angeregt durch Stöße des schnellen Ausflusses.' },
    { id: 'fil', type: 'range', label: 'Fäden in der Haut', min: 0, max: 3, step: 0.25, value: F0.fil, fmt: times, set: to('uFil'),
      hint: 'Die Haut ist ein Netz feiner Fäden längs der Strömung; aus 0 wird eine glatte, gleichmäßig dünne Haut.' },
    { id: 'rip', type: 'range', label: 'Wellen der Wände', min: 0, max: 3, step: 0.25, value: F0.rip, fmt: times, set: to('uRip'),
      hint: 'Hubble sah die Wände gewellt, die Kämme rund 100 Milliarden km hoch – der Wind des Sterns treibt sie nach außen.' },
    { id: 'warp', type: 'range', label: 'Unebenheit der Keulen', min: 0, max: 3, step: 0.25, value: F0.warp, fmt: times, set: to('uWarp') },
    { id: 'fray', type: 'range', label: 'Ausfransen der Spitzen', min: 0, max: 3, step: 0.25, value: F0.fray, fmt: times, set: to('uFray'),
      hint: 'Zur Spitze hin wird die Haut dicker und zerfasert in Strähnen. Stärke und Länge der Strähnen: Modell.' },
    { id: 'open', type: 'range', label: 'Offene Enden', min: 0, max: 1.5, step: 0.1, value: F0.open, fmt: (v) => (v ? `${Math.round(v * 100)} %` : 'zu'), set: to('uOpen'),
      hint: 'Webb zeigt die Keulen als geschlossene Blasen; ihre Kappen sind aber lückenhaft und lichtschwach. Hier reißen sie auf.' },
    { id: 'veil', type: 'range', label: 'Schleier außen', min: 0, max: 4, step: 0.25, value: F0.veil, fmt: times, set: to('uVeil'),
      hint: 'Dünnes, fleckiges Gas früherer Auswürfe um beide Keulen (Modell).' },
    { id: 'ion', type: 'range', label: 'Hörner an der Taille', min: 0, max: 4, step: 0.25, value: F0.ion, fmt: times, set: to('uIon'),
      hint: 'Offene, gewellte Innenwände nahe der Taille, im Licht des Sterns ionisiert – im sichtbaren Licht die vier „Beine“ der Spinne.' },
    { id: 'fe', type: 'range', group: 'Ausfluss', label: '[Fe II]-Band (S-Form)', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: to('uFe'),
      hint: 'Ionisiertes Eisen (1,64 µm) zeigt, wo ein schneller Ausfluss an der Keulenwand auf früher ausgeworfenes Gas trifft.' },
    { id: 'core', type: 'range', group: 'Kern', label: 'Ionisierter Kern', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: to('uCore') },
    { id: 'pah', type: 'range', label: 'Staubkokon (PAH)', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: to('uPah') },
    { id: 'torus', type: 'range', label: 'Staub-Torus', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: to('uTorus'),
      hint: 'Kalter Staub und Gas in der Äquatorebene (ALMA), Radius ≈ 0,13 pc; schnürt die Taille der Spinne ein.' },
    { id: 'dust', type: 'range', label: 'Abdunkeln durch Staub', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: (v) => { dustMul = v; applyLook(); } },
    { id: 'breathe', type: 'toggle', group: 'Sterne', label: 'Zentralstern atmet', value: true, set: (v) => { breathe = v; } },
    { id: 'stars', type: 'range', label: 'Helligkeit der Sterne', min: 0, max: 4, step: 0.25, value: 1, fmt: times, set: (v) => { starGain = v; applyLook(); } },
    { id: 'res', type: 'range', group: 'Qualität der Wolke', label: 'Detailstufe', ordered: true, min: 0, max: 3, step: 1, value: fine ? 1 : 2, fmt: (i) => RES_N[i], set: (i) => vol.setScale(RES[i]),
      hint: 'Die Wolke wird in eigener Auflösung gerechnet und weich vergrößert, Sterne bleiben scharf. Niedriger = schneller.' },
    { id: 'steps', type: 'range', label: 'Rechengenauigkeit', ordered: true, min: 0, max: 3, step: 1, value: fine ? 2 : 1, fmt: (i) => STEPS_N[i], set: to('uSteps', (i) => STEPS[i]),
      hint: 'Mehr Schritte zeigen die dünne Keulenhaut gleichmäßiger, kosten aber Bildrate.' },
  ]);
  formReady = true;

  return {
    scene, camera, unit: LY, hotspots, controls, msaa: false,
    ready: field.ready.then(() => ctx.renderer.compileAsync(vol.scene, camera)),
    home: { pos: new THREE.Vector3(0.8, 0.4, 11), target: new THREE.Vector3(0, 0, 0) },
    orbit: { minDistance: 0.4, maxDistance: 40, cineSpeed: 0.6 },
    look: { exposure: 1.1, bloom: 0.12, sat: 1.1, con: 0.14, sh: [0.95, 0.97, 1.08] },
    update(dt, t, cam) {
      if (flowOn) placeKnots(Math.min(dt, 0.1));
      // < 1 Hz und nur ±15 % (WCAG 2.3.1)
      star.material.uniforms.uGain.value = breathe ? 1 + 0.15 * Math.sin(t * Math.PI * 2 * 0.2) : 1;
      vol.render(cam);
    },
    live: () => ({ nircam: 'Webb NIRCam: H2-Keulen blau, [Fe II] violett, Kern rot (Brα), Staubkokon orange; Zentralstern rot durch heißen Staub',
      vis: 'Hubble, sichtbares Licht: Hα und [N II] rot, die Innenränder an der Taille als „Hörner“, Zentralstern blau',
      layers: 'Schichten: H2-Haut, Innenränder, [Fe II], Kern, PAH-Kokon und Torus je in eigener Farbe' })[mode],
    setPixelRatio(pr, H) {
      sky.userData.setPixelRatio(pr);
      for (const p of [star, field3, knots]) p.userData.setPx(pr, H, camera.fov);
      vol.setSize(Math.round(H * camera.aspect), H);
    },
    dispose: () => { disposeScene(scene); vol.dispose(); field.dispose(); },
  };
}

function add(pos, col, size, v, T, k, s) { pos.push(v.x, v.y, v.z); col.push(...blackbody(T).map((x) => x * k)); size.push(s); }
