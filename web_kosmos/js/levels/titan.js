// Station 02D1: Titan, der einzige Mond mit dichter Atmosphäre (Abstecher von Saturn & Monde).
// Gemeinsamer Aufbau mit den Jupitermonden in icymoon.js (Globus, Planet am Himmel in echter Richtung, Größe und Phase, Tageslauf,
// Finsternisse, Schnitt), hier mit dem Planetenadapter SATURN_SYS: Saturn mit Ringen steht fest am Himmel (≈ 2,8° Radius, die
// Ringe fast von der Kante), Titan dreht gebunden in 15,945 Tagen. Dazu der orangene Dunst als Hülle um den Globus (Modell):
// im sichtbaren Licht undurchsichtig, mit „Dunst entfernt“ der Blick durch die Nahinfrarot-Fenster auf die Oberfläche (USGS-Mosaik
// der Kamera ISS). Karte u = östliche Länge / 360; Längen des Gazetteers sind West (surf(lat, west)).

import * as THREE from 'three';
import { createIcyMoon, SATURN_SYS } from '../icymoon.js';

const R_BODY = 1.17, R_DET = 1.185;   // Dunstkörper bis ≈ 440 km, abgesetzte Schicht bei ≈ 480 km [Titanradien]; die Atmosphäre reicht bis ≈ 600 km (nasa-titan-facts)
const R_H = 1.26;            // Hüllkugel für beide
const K_HAZE = 30, K_CLEAR = 0.8;   // Dämpfung je Titanradius: Dunst sichtbar bzw. Fenster im Nahinfrarot (Darstellung)
const SPEEDS = [[0, 'Stopp'], [1 / 144, '10 min/s'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s'], [4, '4 Tage/s']];

// Dunsthülle: Weg des Sehstrahls durch die Schale (bis zum Boden), Dämpfung 1 − exp(−k·Weg); Farbe nach Sonnenstand am Mittelpunkt
// des Weges, Vorwärtsstreuung (Henyey-Greenstein, g = 0,55) → im Gegenlicht ein leuchtender Rand. Ohne Tiefentest: gilt auch,
// wenn die Kamera in der Schale ist und der Dunst vor dem Boden liegt.
const HAZE_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform float uK, uRh, uLit;
varying vec3 vP;
void main() {
  vec3 ro = cameraPosition, rd = normalize(vP - ro);
  float b = dot(ro, rd), g = 0.55;
  float c = dot(rd, uSunDir);
  float fs = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5) / ((1.0 - g * g) / pow(1.0 + g * g, 1.5));
  float lum = mix(0.03, 1.0, uLit);
  // Körper des Dunstes: Weg des Sehstrahls durch die Schale bis zum Boden
  float rh = ${R_BODY.toFixed(3)}, h = b * b - (dot(ro, ro) - rh * rh), a = 0.0;
  vec3 col = vec3(0.0);
  if (h > 0.0) {
    float t0 = max(-b - sqrt(h), 0.0), t1 = -b + sqrt(h);
    float h2 = b * b - (dot(ro, ro) - 1.0);
    if (h2 > 0.0) { float ts = -b - sqrt(h2); if (ts > 0.0) t1 = min(t1, ts); }
    a = 1.0 - exp(-uK * max(t1 - t0, 0.0));
    float ndl = dot(normalize(ro + rd * (t0 + t1) * 0.5), uSunDir);
    float lit = smoothstep(-0.3, 0.5, ndl);
    col = mix(vec3(0.5, 0.2, 0.05), vec3(0.88, 0.45, 0.12), smoothstep(-0.1, 0.6, ndl)) * (0.05 + lit * (0.6 + 0.22 * min(fs, 5.0))) * lum;
  }
  // abgesetzte Dunstschicht: dünner bläulicher Ring in ≈ 500 km Höhe, nur am Rand zu sehen (Cassini)
  vec3 q = ro + rd * max(-b, 0.0);
  float d = length(q), det = exp(-pow((d - ${R_DET.toFixed(3)}) / 0.006, 2.0)) * smoothstep(-0.4, 0.4, dot(normalize(q), uSunDir)) * lum;
  float ad = det * 0.55;
  float aa = a + ad * (1.0 - a);
  if (aa < 0.002) discard;
  col = (col * a + vec3(0.42, 0.55, 0.95) * ad * (1.0 - a)) / aa;
  gl_FragColor = vec4(col, aa);
}
`;

function hazeShell(sunL) {
  const u = { uSunDir: { value: sunL }, uK: { value: K_HAZE }, uRh: { value: R_H }, uLit: { value: 1 } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(R_H, 96, 64), new THREE.ShaderMaterial({ vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG, uniforms: u,
    transparent: true, depthTest: false, depthWrite: false }));
  m.renderOrder = 5;
  return { mesh: m, u };
}
const HAZE_VERT = /* glsl */ `
varying vec3 vP;
void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export function create(ctx) {
  let hazeOn = true;
  const hazy = () => hazeOn, clear = () => !hazeOn;
  return createIcyMoon(ctx, {
    id: 'titan', sys: SATURN_SYS, tex: 'titan.jpg', seed: 71, gain: 1.25, split: 0.5,
    tint: [[0.5, 0.3, 0.14], [1.0, 0.78, 0.5]],
    views: {
      grau: '<b>Nahinfrarot</b> – Mosaik der Kamera ISS der Sonde Cassini (USGS): Nur bei diesen Wellenlängen dringt Licht durch den Dunst. Hell = Hochland und Ebenen, dunkel = Dünenmeere und Seen.',
      farbe: '<b>Tönung</b> – das graue Messbild orange eingefärbt. Wie die Oberfläche in Farbe aussieht, wissen wir nur von der Landestelle: orangebraun.',
    },
    viewNames: { grau: 'Nahinfrarot', farbe: 'Tönung' },
    home: { j: 0.81, s: 0.3, y: 0.5, dist: 2.45, t: 0.95 },
    speeds: SPEEDS, speed0: 4, scanDiv: 120, horizon: 15 * 365.25, eclLead: 1 / 36,
    // Abzeichen auf der Oberfläche nur ohne Dunst; Mitte [° N, ° W] nach dem Gazetteer, Menrva und Xanadu aus der Karte abgelesen
    features: [
      { id: 'kraken', lat: 68, west: 310, focus: 0.9, when: clear },
      { id: 'ligeia', lat: 79.7, west: 247.9, focus: 0.5, when: clear },
      { id: 'huygens', lat: -10.3, west: 192.32, focus: 0.35, when: clear },
      { id: 'menrva', lat: 20, west: 87, focus: 0.5, when: clear },
      { id: 'xanadu', lat: -14, west: 100, focus: 0.9, when: clear },
    ],
    // Schichten [Titanradien], schematisch: Eiskruste, Ozean (Oberkante 55–80 km unter dem Boden), Hochdruckeis, Gesteinskern
    interior: [
      { r: 1, c: [0.82, 0.8, 0.74] },
      { r: 0.97, c: [0.12, 0.3, 0.6], f: 1 },
      { r: 0.82, c: [0.66, 0.7, 0.76] },
      { r: 0.58, c: [0.46, 0.38, 0.31] },
    ],
    oceanR: 0.985,
    extra(c, api) {
      const haze = hazeShell(api.sunL);
      api.scene.add(haze.mesh);
      const side = new THREE.Vector3().crossVectors(api.homeDir, new THREE.Vector3(0, 1, 0)).normalize();
      const limb = side.clone().multiplyScalar(0.85).addScaledVector(new THREE.Vector3(0, 1, 0), 0.5).normalize().multiplyScalar(R_H * 0.97);
      const setHaze = (v) => { hazeOn = v; };
      return {
        layers: [{ id: 'haze', type: 'toggle', group: 'Atmosphäre', label: 'Dunst sichtbar', value: true, set: setHaze, get: () => hazeOn }],
        controls: [{
          id: 'haze', type: 'swatch', label: 'Atmosphäre', value: 'dunst',
          options: [['dunst', 'Dunst', 'radial-gradient(circle, #f3a24a 0%, #b4561c 60%, #3b1a08 100%)'], ['klar', 'Dunst entfernt', 'radial-gradient(circle, #d8d8d8 0%, #7e7e7e 55%, #262626 100%)']],
          detail: (v) => `<p class="sw-cap">${v === 'dunst' ? '<b>Dunst</b> – so sieht das Auge Titan: eine orangene Kugel ohne erkennbare Oberfläche, am Rand ein dünner Saum. Der Dunst ist ein Modell, seine Dichte ist stark vereinfacht.' : '<b>Dunst entfernt</b> – der Blick auf die Oberfläche, wie ihn die Radarkarte und die Nahinfrarot-Kamera von Cassini ermöglichten. Die Oberfläche dahinter ist echt, der Dunst fehlt nur im Bild.'}</p>`,
          set: (v) => { setHaze(v === 'dunst'); }, get: () => (hazeOn ? 'dunst' : 'klar'),
        }],
        hotspots: [{ id: 'haze', kind: 'info', pos: limb, focus: () => 0.9, visible: hazy }],
        update(dt, t, jd, cam) {
          // Schnitt an (icymoon.js): Dunst weicht, sonst deckt er den Keil fast ganz zu (Weg 0,17 × K_HAZE ≈ 99 %)
          const k = hazeOn && !api.cutU.uCut.value ? K_HAZE : K_CLEAR;
          haze.u.uK.value += (k - haze.u.uK.value) * Math.min(1, dt * 4);
          haze.u.uLit.value += ((api.frame.shadow ? 0 : 1) - haze.u.uLit.value) * Math.min(1, dt * 3);
          haze.mesh.material.side = cam.position.length() < R_H ? THREE.BackSide : THREE.FrontSide;
        },
      };
    },
  });
}
