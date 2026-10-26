// Station 02C3: Ganymed, größter Mond des Sonnensystems und einziger mit eigenem Magnetfeld (Abstecher von Jupiter & Monde).
// Gemeinsamer Aufbau mit Kallisto in icymoon.js (Globus, Jupiter am Himmel, Tageslauf, Finsternisse, Schnitt). Hier dazu:
// Feldlinien (schematisch: geschlossen um den Äquator, auf der stromaufwärts liegenden Rückseite gestaucht, an den Polen offen
// und zu Jupiters Feld gebogen – „Alfvén-Flügel“, leicht stromab geneigt), Teilchen laufen langsam die Linien entlang; zwei
// Polarlicht-Ovale, die im Takt der Jupiterdrehung schaukeln – mit Ozean 2°, ohne 6° (Hubble 2015, hst-ganymede-2015).
// Das Dipolmoment zeigt fast entgegen der Drehachse (Neigung ≈ 176°): Feldlinien laufen von Süd nach Nord.

import * as THREE from 'three';
import { BODY_VERT } from '../planetfx.js';
import { NOISE } from '../glsl.js';
import { GALILEAN, JUPITER } from '../jovian.js';
import { createIcyMoon, CUT_DISCARD } from '../icymoon.js';

const RAD = Math.PI / 180;
// Schaukeln der Ovale aus Ganymeds Sicht im Takt der Jupiterdrehung (synodisch, eigene Rechnung ≈ 10,5 h)
const T_SYN = 1 / (1 / JUPITER.rot - 1 / (GALILEAN.ganymede.P * 24));
const OVAL = 45 * RAD;   // Breite der Ovale (schematisch)
const ROCK = { ocean: 2 * RAD, none: 6 * RAD };
const Z = new THREE.Vector3(0, 0, 1);

const LINE_VERT = /* glsl */ `
attribute float s;
varying float vS, vR;
void main() { vS = s; vR = length(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// Teilchen als weiche Pulse entlang der Linie (≈ 0,25 Hz an einem Ort – Bewegung, kein Blinken)
const LINE_FRAG = /* glsl */ `
uniform float uTime, uGain;
uniform vec3 uCol;
varying float vS, vR;
void main() {
  float pulse = pow(0.5 + 0.5 * sin(vS * 24.0 - uTime * 1.5), 8.0);
  float fade = 1.0 - smoothstep(2.4, 4.6, vR);
  gl_FragColor = vec4(uCol * (0.22 + 0.78 * pulse) * fade * uGain, 1.0);
}
`;
// Polarlicht-Ovale als Hülle knapp über dem Boden: Band um ±OVAL, als Ganzes um die Strömungsachse (z) gekippt (uTilt),
// am Rand heller (längerer Weg durch die leuchtende Schicht); Farbe blau statt ultraviolett
const AURORA_FRAG = /* glsl */ `
uniform float uTime, uTilt, uLat, uGain, uCut;
uniform vec3 uCutA, uCutB;
varying vec3 vN, vP, vO;
varying vec2 vUv;
${NOISE}
void main() {
  ${CUT_DISCARD}
  vec3 p = normalize(vO);
  float c = cos(uTilt), s = sin(uTilt);
  p = vec3(c * p.x + s * p.y, -s * p.x + c * p.y, p.z);
  float lat = asin(clamp(p.y, -1.0, 1.0)), lon = atan(p.z, -p.x);
  float w = 0.04 + 0.012 * sin(lon * 3.0 + uTime * 0.15);
  float dN = (lat - uLat) / w, dS = (lat + uLat) / w;
  float a = exp(-dN * dN) + exp(-dS * dS);
  a *= 0.7 + 0.45 * fbm(vec3(lon * 2.5, lat * 10.0, uTime * 0.05), 3);
  vec3 V = normalize(cameraPosition - vP);
  float limb = min(1.0 / (abs(dot(normalize(vN), V)) + 0.35), 2.2);
  gl_FragColor = vec4(vec3(0.35, 0.62, 1.0) * a * limb * uGain, 1.0);
}
`;

// Feldlinien als Liniensegmente mit Bogenlänge s
function fieldLines() {
  const closed = [], open = [];
  const push = (arr, pts) => {
    let s = 0;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k], ds = a.distanceTo(b);
      arr.push([a, s], [b, s + ds]);
      s += ds;
    }
  };
  // geschlossen: Dipol r = L·cos²λ, stromauf (+z, Rückseite) gestaucht, stromab (−z) gestreckt
  for (const Ls of [1.3, 1.6, 1.95]) {
    const l0 = Math.acos(Math.sqrt(1 / Ls));
    for (let j = 0; j < 12; j++) {
      const phi = (j / 12) * Math.PI * 2, pts = [];
      for (let k = 0; k <= 64; k++) {
        const lam = -l0 + (2 * l0 * k) / 64, r = Ls * Math.cos(lam) ** 2;
        const p = new THREE.Vector3(r * Math.cos(lam) * Math.cos(phi), r * Math.sin(lam), r * Math.cos(lam) * Math.sin(phi));
        p.z *= p.z > 0 ? 1 - 0.14 * (r - 1) : 1 + 0.3 * (r - 1);
        pts.push(p);
      }
      push(closed, pts);
    }
  }
  // offen: von hohen Breiten radial hinaus, dann entlang Jupiters Feld (±y), stromab geneigt
  for (const sgn of [1, -1]) {
    for (const lat of [62, 72]) {
      for (let j = 0; j < 8; j++) {
        const phi = ((j + (lat === 72 ? 0.5 : 0)) / 8) * Math.PI * 2;
        const p = new THREE.Vector3(Math.cos(lat * RAD) * Math.cos(phi), sgn * Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.sin(phi));
        const far = new THREE.Vector3(0, sgn, -0.4).normalize(), pts = [p.clone()];
        for (let k = 1; k <= 90; k++) {
          const dir = p.clone().normalize().lerp(far, THREE.MathUtils.smoothstep(k / 90, 0, 0.45)).normalize();
          p.addScaledVector(dir, 0.05);
          pts.push(p.clone());
        }
        push(open, sgn > 0 ? pts.reverse() : pts);   // Feld läuft von Süd nach Nord
      }
    }
  }
  const geo = (arr) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr.flatMap(([p]) => [p.x, p.y, p.z]), 3));
    g.setAttribute('s', new THREE.Float32BufferAttribute(arr.map(([, s]) => s), 1));
    return g;
  };
  return { closed: geo(closed), open: geo(open) };
}

export function create(ctx) {
  return createIcyMoon(ctx, {
    id: 'ganymede', tex: 'ganymede.jpg', seed: 53, gain: 2.0, split: 0.3,
    tint: [[0.62, 0.53, 0.43], [1.0, 0.98, 0.95]],
    views: {
      grau: '<b>Messbild</b> – Mosaik aus Voyager- und Galileo-Aufnahmen (USGS), so wie die Kameras es in Graustufen sahen.',
      farbe: '<b>Tönung</b> – grau eingefärbt nach Farbaufnahmen: dunkles Gelände bräunlich, helles Eis fast weiß. Kein Messwert.',
      gelaende: '<b>Gelände</b> – nach Helligkeit getrennt: dunkle, dicht verkraterte Regionen warm, helle Furchen kühl.',
    },
    home: { j: 0.81, s: 0.3, y: 0.5, dist: 2.3, t: 0.95 },
    features: [
      { id: 'galileo', lat: 45, west: 127, focus: 1.2 },
      { id: 'uruk', lat: 3.4, west: 160, focus: 0.7 },
      { id: 'osiris', lat: -38, west: 166.31, focus: 0.35 },
    ],
    // Schichten [Mondradien]: Eiskruste 150 km, Ozean 100 km (hst-ganymede-2015); darunter Eis, Gesteinsmantel, Eisenkern schematisch
    interior: [
      { r: 1, c: [0.82, 0.88, 0.94] },
      { r: 1 - 150 / 2631.2, c: [0.1, 0.32, 0.68], f: 1 },
      { r: 1 - 250 / 2631.2, c: [0.6, 0.7, 0.8] },
      { r: 0.62, c: [0.5, 0.38, 0.28] },
      { r: 0.3, c: [0.75, 0.52, 0.32] },
    ],
    oceanR: 1 - 200 / 2631.2,
    eclLead: 1 / 48, horizon: 3 * GALILEAN.ganymede.P,
    extra(c, api) {
      const { closed, open } = fieldLines();
      const lineMat = (col, gain) => new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG,
        uniforms: { uTime: { value: 0 }, uGain: { value: gain }, uCol: { value: new THREE.Vector3(...col) } },
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      const field = new THREE.Group();
      field.add(new THREE.LineSegments(closed, lineMat([0.25, 0.8, 1.0], 0.4)), new THREE.LineSegments(open, lineMat([0.45, 0.55, 1.0], 0.16)));
      api.scene.add(field);
      const auroraU = { uTime: { value: 0 }, uTilt: { value: 0 }, uLat: { value: OVAL }, uGain: { value: 0.12 }, ...api.cutU };
      const aurora = new THREE.Mesh(new THREE.SphereGeometry(1.012, 128, 96), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: AURORA_FRAG,
        uniforms: auroraU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      api.scene.add(aurora);
      let rock = 'ocean';
      // Abzeichen fest zur Heimpose: Feldlinien seitlich am Rand, Juice darunter, Oval nördlich zur Kamera hin
      const Y = new THREE.Vector3(0, 1, 0), d = api.homeDir.clone().setY(0).normalize();
      const auroraPos = new THREE.Vector3();
      const ovalBase = d.clone().applyAxisAngle(Y, 20 * RAD).multiplyScalar(Math.cos(OVAL)).setY(Math.sin(OVAL));
      return {
        layers: [
          { id: 'field', type: 'toggle', group: 'Magnetfeld', label: 'Feldlinien (schematisch)', value: true, set: (v) => { field.visible = v; } },
          { id: 'aurora', type: 'toggle', label: 'Polarlichter (UV, blau gezeigt)', value: true, set: (v) => { aurora.visible = v; } },
        ],
        controls: [
          { id: 'rock', label: 'Polarlichter schaukeln', value: rock, options: [['ocean', 'mit Ozean · 2°'], ['none', 'ohne Ozean · 6°']], set: (v) => { rock = v; } },
        ],
        hotspots: [
          { id: 'field', kind: 'info', pos: d.clone().applyAxisAngle(Y, 70 * RAD).multiplyScalar(1.75).setY(0.25), focus: () => 2.6, visible: () => field.visible },
          { id: 'aurora', kind: 'info', pos: auroraPos, focus: () => 0.8, visible: (cam) => aurora.visible && cam.position.y > -0.2 && !api.inWedge(auroraPos) },
          { id: 'juice', kind: 'info', pos: d.clone().applyAxisAngle(Y, -55 * RAD).setY(-1.0), focus: () => 1.6, visible: () => true },
        ],
        update(dt, t, jd, cam) {
          field.children.forEach((l) => { l.material.uniforms.uTime.value = t; });
          auroraU.uTime.value = t;
          auroraU.uTilt.value = ROCK[rock] * Math.sin((2 * Math.PI * ((jd * 24) % T_SYN)) / T_SYN);
          auroraPos.copy(ovalBase).applyAxisAngle(Z, auroraU.uTilt.value).multiplyScalar(1.02);   // schaukelt mit dem Oval
        },
        live: () => (rock === 'ocean' ? 'Polarlichter mit Ozean' : 'Polarlichter ohne Ozean'),
      };
    },
  });
}
