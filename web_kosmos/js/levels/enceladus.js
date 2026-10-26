// Station 02D2: Enceladus, der weiße Eismond mit den Fontänen am Südpol (Abstecher von Saturn & Monde).
// Gemeinsamer Aufbau mit den anderen Mond-Stationen in icymoon.js (Globus, Saturn am Himmel mit Ringen von der Kante,
// Tageslauf, Finsternisse im Saturnschatten, Schnitt, Adapter SATURN_SYS). Hier dazu:
// · die vier Tigerstreifen (Alexandria, Cairo, Baghdad, Damascus Sulcus) als Linien – Mitte und Länge nach dem Gazetteer der
//   IAU/USGS, Richtung aus der Karte (Strukturtensor im Südpolbild, eigene Rechnung), als Großkreise gezeichnet;
// · Fontänen: Teilchen auf Wurfbahnen aus Quellen entlang der Streifen. Höhe aus der Ballistik (400 m/s, Fallbeschleunigung
//   0,113 m/s² – eigene Rechnung), Teilchen verlangsamt; im Gegenlicht (Vorwärtsstreuung) heller; im Mondschatten dunkel, so
//   ragen sie in der Polarnacht aus dem Schatten ins Licht;
// · Stärke nach Bahnlage: Hedman et al. 2013 fanden die Fontäne am sonnenfernen Punkt der Bahn (Apozentrum) etwa 3-mal heller als
//   am nächsten. Hier als Kosinus über der mittleren Anomalie (Modell: Verlauf und Phase vereinfacht).

import * as THREE from 'three';
import { MOONS } from '../kronian.js';
import { createIcyMoon, surf, SATURN_SYS, CUT_DISCARD } from '../icymoon.js';
import { J2000 } from '../astro.js';

const RAD = Math.PI / 180;
const EL = MOONS.enceladus, R_KM = EL.r;
const V_MAX = 400, G_SURF = 0.113;                 // m/s (nasa-enceladus), Fallbeschleunigung [m/s²] (eigene Rechnung)
const H_MAX = V_MAX ** 2 / (2 * G_SURF) / 1e3 / R_KM;   // höchste Wurfhöhe [Mondradien] ≈ 2,8
// Tigerstreifen: Mitte [° S, ° W], Länge [km] (Gazetteer), Peilung der Linie an der Mitte [°, von Nord über Ost]
const STRIPES = [
  { id: 'alexandria', lat: -75.63, west: 137.56, len: 111, bearing: 112 },
  { id: 'cairo', lat: -81.62, west: 154.48, len: 165, bearing: 130 },
  { id: 'baghdad', lat: -86.91, west: 230.54, len: 176, bearing: 17 },
  { id: 'damascus', lat: -80.59, west: 285.87, len: 125, bearing: 57 },
];
const N_SRC = 12, PER_SRC = 110, VENTS = STRIPES.length * N_SRC;   // „mehr als 30 Strahlen“ (nasa-enceladus-jets)

// Punkt auf dem Großkreis durch c mit der Peilung b [rad], s = Winkelabstand [rad]
function along(c, b, s, out = new THREE.Vector3()) {
  const e = new THREE.Vector3(c.z, 0, -c.x).normalize();        // Richtung wachsender Ostlänge (d/de von surf)
  const n = new THREE.Vector3(0, 1, 0).addScaledVector(c, -c.y).normalize();
  const d = n.multiplyScalar(Math.cos(b)).addScaledVector(e, Math.sin(b));
  return out.copy(c).multiplyScalar(Math.cos(s)).addScaledVector(d, Math.sin(s));
}
const stripeAt = (st, t, out) => along(surf(st.lat, st.west), st.bearing * RAD, t * st.len / R_KM / 2, out);

// Mittlere Anomalie [°] (JPL-Mittelwerte, wie astro.js laplacePos)
const prec = (p) => (p ? 360 / (p * 365.25) : 0);
const anomaly = (jd) => (((EL.M + (EL.n - prec(EL.Pw) - prec(EL.Pn)) * (jd - J2000)) % 360) + 360) % 360;
// Stärke 1/3 (Pericentrum) … 1 (Apozentrum)
const tideK = (jd) => (2 - Math.cos(anomaly(jd) * RAD)) / 3;

const LINE_VERT = /* glsl */ `
varying vec3 vO;
void main() { vO = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const LINE_FRAG = /* glsl */ `
uniform float uCut;
uniform vec3 uCutA, uCutB;
varying vec3 vO;
void main() {
  ${CUT_DISCARD}
  gl_FragColor = vec4(0.55, 0.85, 1.0, 0.7);
}
`;

// Teilchen: Wurfbahn (Parabel) aus der Quelle aV, Geschwindigkeit nach aR.y (v² ~ Höhe), Neigung und Richtung zufällig,
// langsam ein- und ausgeblendet; Schatten des Mondes (Zylinder), Vorwärtsstreuung zur Sonne
const JET_VERT = /* glsl */ `
uniform float uTime, uH, uPx;
uniform vec3 uSun;
attribute vec3 aV;
attribute vec4 aR;
attribute float aJ;
varying float vA, vFwd, vLit;
void main() {
  vec3 n = normalize(aV);
  vec3 ref = abs(n.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 t1 = normalize(cross(n, ref)), t2 = cross(n, t1);
  float s = fract(uTime / 14.0 + aR.x);
  float v = mix(0.12, 1.0, pow(aR.y, 1.4));
  float h = uH * v * v * 4.0 * s * (1.0 - s);
  float az = aR.z * 6.2831853, tilt = (aR.w - 0.5) * 1.1;
  vec3 p = n * 1.002 + n * h + (t1 * cos(az) + t2 * sin(az)) * h * tan(tilt) * 0.6;
  vA = smoothstep(0.0, 0.07, s) * (1.0 - smoothstep(0.6, 1.0, s)) * aJ;
  float sd = dot(p, uSun);
  vLit = sd < 0.0 ? mix(1.0, 0.03, smoothstep(1.04, 0.96, length(p - sd * uSun))) : 1.0;
  vFwd = pow(max(0.0, dot(normalize(p - cameraPosition), uSun)), 4.0);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uPx * projectionMatrix[1][1] * 0.012 / -mv.z * (1.0 - 0.4 * s), 1.0, 12.0);
  gl_Position = projectionMatrix * mv;
}
`;
const JET_FRAG = /* glsl */ `
uniform float uK;
varying float vA, vFwd, vLit;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 14.0);
  gl_FragColor = vec4(vec3(0.82, 0.92, 1.0) * a * vA * vLit * (0.12 + 0.6 * vFwd) * uK, 1.0);
}
`;

function jets() {
  const n = VENTS * PER_SRC, vent = new Float32Array(n * 3), rnd = new Float32Array(n * 4), strength = new Float32Array(n);
  const c = new THREE.Vector3();
  let k = 0;
  for (const st of STRIPES) {
    for (let i = 0; i < N_SRC; i++) {
      const p = stripeAt(st, ((i + 0.5) / N_SRC) * 2 - 1, c), j = 0.4 + 0.6 * Math.random();
      for (let m = 0; m < PER_SRC; m++, k++) {
        vent.set([p.x, p.y, p.z], k * 3);
        rnd.set([Math.random(), Math.random(), Math.random(), Math.random()], k * 4);
        strength[k] = j;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aV', new THREE.BufferAttribute(vent, 3));
  g.setAttribute('aR', new THREE.BufferAttribute(rnd, 4));
  g.setAttribute('aJ', new THREE.BufferAttribute(strength, 1));
  return g;
}

function stripeLines() {
  const pts = [], p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
  for (const st of STRIPES) {
    const n = 48;
    for (let i = 0; i < n; i++) {
      stripeAt(st, (i / n) * 2 - 1, p0);
      stripeAt(st, ((i + 1) / n) * 2 - 1, p1);
      pts.push(...p0.multiplyScalar(1.004).toArray(), ...p1.multiplyScalar(1.004).toArray());
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

export function create(ctx) {
  return createIcyMoon(ctx, {
    id: 'enceladus', tex: 'enceladus.jpg', sys: SATURN_SYS, seed: 67, gain: 3.2, split: 0.5,
    tint: [[0.9, 0.95, 1.0], [1.0, 1.0, 1.0]],
    views: {
      grau: '<b>Relief</b> – Cassini-Mosaik (USGS) nach einem Hochpassfilter: Es zeigt Furchen, Brüche und Krater, nicht die Helligkeit. Enceladus selbst ist fast überall weiß.',
    },
    home: { j: 0.55, s: 0.75, y: -0.3, dist: 4.2, t: 0.35 },
    features: [
      { id: 'stripes', lat: -86.91, west: 230.54, focus: 0.9 },
      { id: 'samaria', lat: 26.86, west: 225.13, focus: 0.7 },
    ],
    // Schichten [Mondradien], schematisch: Eiskruste (20–25 km), Ozean, Gesteinskern (Dicken unsicher)
    interior: [
      { r: 1, c: [0.9, 0.95, 1.0] },
      { r: 0.91, c: [0.1, 0.3, 0.6], f: 1 },
      { r: 0.78, c: [0.5, 0.42, 0.36] },
    ],
    oceanR: 0.95,
    speed0: 2, eclLead: 1 / 36, horizon: 400,
    extra(c, api) {
      const geo = jets(), jetU = { uTime: { value: 0 }, uH: { value: H_MAX }, uPx: { value: 500 }, uSun: { value: api.sunL }, uK: { value: 1 } };
      const jet = new THREE.Points(geo, new THREE.ShaderMaterial({ vertexShader: JET_VERT, fragmentShader: JET_FRAG, uniforms: jetU,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      jet.frustumCulled = false;
      api.scene.add(jet);
      const lines = new THREE.LineSegments(stripeLines(), new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG,
        uniforms: { ...api.cutU }, transparent: true, depthWrite: false }));
      lines.visible = false;
      api.scene.add(lines);
      let on = true, tide = true, gain = 2;
      const k = () => (tide ? tideK(api.jdNow()) : 0.7);
      const pole = new THREE.Vector3(0, -1, 0), plumePos = pole.clone().multiplyScalar(1 + H_MAX * 0.2);
      return {
        layers: [
          { id: 'jets', type: 'toggle', group: 'Fontänen', label: 'Fontänen am Südpol', value: true, set: (v) => { on = v; jet.visible = v; } },
          { id: 'tide', type: 'toggle', label: 'Stärke folgt der Bahnlage (Hedman 2013)', value: true, sub: true,
            hint: 'Am sonnenfernen Punkt der Bahn etwa 3-mal heller als am nächsten; Verlauf als Kosinus (Modell). Aus: konstante Stärke.',
            set: (v) => { tide = v; } },
          { id: 'jetGain', type: 'range', label: 'Helligkeit', value: gain, min: 0.5, max: 4, step: 0.5, unit: '×', sub: true, set: (v) => { gain = v; } },
          { id: 'stripes', type: 'toggle', group: 'Oberfläche', label: 'Tigerstreifen markieren', value: false, set: (v) => { lines.visible = v; } },
        ],
        hotspots: [{ id: 'plume', kind: 'info', pos: plumePos, focus: () => 1.4, visible: () => on }],
        update(dt, t) {
          jetU.uTime.value = c.still ? 4 : t;
          jetU.uK.value = k() * gain;
        },
        setPixelRatio(pr) { jetU.uPx.value = 500 * pr; },
        live: () => (on ? `Fontänen ${Math.round(k() * 100)} % der Höchststärke` : ''),
      };
    },
  });
}
