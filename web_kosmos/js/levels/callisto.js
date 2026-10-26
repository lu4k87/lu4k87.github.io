// Station 02C4: Kallisto, die am dichtesten verkraterte Oberfläche im Sonnensystem (Abstecher von Jupiter & Monde).
// Gemeinsamer Aufbau mit Ganymed in icymoon.js (Globus, Jupiter am Himmel, Tageslauf, Finsternisse, Schnitt). Hier dazu: die
// Mehrringbecken Valhalla (3.000 km) und Asgard (1.400 km) als Kreise auf der Oberfläche markierbar – Mitte und äußerer
// Durchmesser nach dem Gazetteer der IAU/USGS, die Ringe dazwischen schematisch. Kallisto liegt weit draußen und außerhalb der
// Laplace-Resonanz; Jupiters Schatten trifft sie nur in manchen Jahren (Knopf „Nächste Finsternis“ sucht bis zu 6 Jahre voraus).

import * as THREE from 'three';
import { GALILEAN } from '../jovian.js';
import { createIcyMoon, surf, CUT_DISCARD } from '../icymoon.js';

const R_KM = GALILEAN.callisto.r;
// Becken: Mitte [° N, ° W], äußerer Radius [km] (usgs-gazetteer)
const BASINS = [{ lat: 14.7, west: 56, r: 1500 }, { lat: 32.2, west: 139.9, r: 700 }];
const RINGS = [0.14, 0.3, 0.48, 0.66, 0.83, 1];

// Kleinkreise um die Beckenmitte, knapp über dem Boden
// Linien knapp über dem Boden, im Schnitt-Keil ausgespart
const RING_VERT = /* glsl */ `
varying vec3 vO;
void main() { vO = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const RING_FRAG = /* glsl */ `
uniform float uCut;
uniform vec3 uCutA, uCutB;
varying vec3 vO;
void main() {
  ${CUT_DISCARD}
  gl_FragColor = vec4(1.0, 0.85, 0.63, 0.5);
}
`;

function basinRings(cutU) {
  const pts = [];
  for (const b of BASINS) {
    const c = surf(b.lat, b.west);
    const u = new THREE.Vector3(0, 1, 0).addScaledVector(c, -c.y).normalize(), v = new THREE.Vector3().crossVectors(c, u);
    for (const f of RINGS) {
      const th = (b.r / R_KM) * f, n = 128;
      for (let k = 0; k < n; k++) {
        for (const kk of [k, k + 1]) {
          const t = (kk / n) * Math.PI * 2;
          const p = c.clone().multiplyScalar(Math.cos(th)).addScaledVector(u, Math.cos(t) * Math.sin(th)).addScaledVector(v, Math.sin(t) * Math.sin(th));
          pts.push(...p.multiplyScalar(1.003).toArray());
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms: { ...cutU }, transparent: true, depthWrite: false }));
}

export function create(ctx) {
  return createIcyMoon(ctx, {
    id: 'callisto', tex: 'callisto.jpg', seed: 59, gain: 1.8, split: 0.27,
    tint: [[0.58, 0.48, 0.38], [1.0, 0.97, 0.93]],
    views: {
      grau: '<b>Messbild</b> – Mosaik aus Galileo- und Voyager-Aufnahmen (USGS), so wie die Kameras es in Graustufen sahen.',
      farbe: '<b>Tönung</b> – grau eingefärbt nach Farbaufnahmen: dunkle Staubdecke bräunlich, frische Krater hell. Kein Messwert.',
      gelaende: '<b>Gelände</b> – nach Helligkeit getrennt: helle Flecken sind Krater, die helleres Eis freigelegt haben.',
    },
    home: { j: 0.81, s: 0.3, y: 0.5, dist: 2.3, t: 0.95 },
    features: [
      { id: 'valhalla', lat: 14.7, west: 56, focus: 1.6 },
      { id: 'asgard', lat: 32.2, west: 139.9, focus: 0.9 },
      { id: 'burr', lat: 42.7, west: 134.5, focus: 0.3 },
      { id: 'craters', lat: -25, west: 190, focus: 0.5 },
    ],
    // Schichten [Mondradien], schematisch: Eiskruste, möglicher Ozean (Tiefe unsicher), Eis-Gestein-Gemisch, gesteinsreicher Kern
    interior: [
      { r: 1, c: [0.78, 0.82, 0.86] },
      { r: 0.94, c: [0.12, 0.32, 0.62], f: 1 },
      { r: 0.91, c: [0.56, 0.54, 0.5] },
      { r: 0.55, c: [0.46, 0.38, 0.31] },
    ],
    oceanR: 0.925,
    eclLead: 1 / 36, horizon: 6 * 365.25,
    extra(c, api) {
      const rings = basinRings(api.cutU);
      rings.visible = false;
      api.scene.add(rings);
      return {
        layers: [{ id: 'basins', type: 'toggle', group: 'Oberfläche', label: 'Ringbecken markieren', value: false, set: (v) => { rings.visible = v; } }],
      };
    },
  });
}
