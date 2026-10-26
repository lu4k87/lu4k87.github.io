// Bausteine für Planetensysteme (Etappe E5: Uranus, Neptun; docs/plan_ebenen.md): Ringprofil aus einer Liste schmaler
// Ringe als Textur für RING_FRAG (planetfx.js), Ringscheibe in der Äquatorebene mit radialem uv, Mondbahnen aus den
// mittleren JPL-Elementen (astro.js laplacePos) mit Leuchtspur hinter dem Mond, Ausrichtung gebunden rotierender Monde.

import * as THREE from 'three';
import { laplacePos } from './astro.js';

// Ringprofil: u = Abstand rIn … rOut [km] auf w Pixel, v = Azimut / 360° auf h Zeilen (ohne Bögen 1 Zeile).
// rings: [{ r, w, a }] Mitte und Breite [km], Deckkraft 0…1; schmaler als minPx Pixel → auf minPx verbreitert (sonst
// verschwinden 2 km breite Ringe bei 5 km je Pixel), Deckkraft bleibt. opts.arcs: [{ r, w, a, lon, len }] Bögen
// (Mitte lon [°] im Azimut der Ringscheibe, Länge len [°], weiche Enden), z. B. Neptuns Adams-Ring; opts.color [r, g, b] 0…1.
export function ringTexture(rings, rIn, rOut, opts = {}) {
  const W = opts.w ?? 2048, H = opts.arcs ? (opts.h ?? 256) : 1, minPx = opts.minPx ?? 1.5;
  const px = (rOut - rIn) / W;
  const col = (opts.color ?? [0.6, 0.6, 0.6]).map((c) => Math.round(c * 255));
  // Deckung eines Bands [r − w/2, r + w/2] je Pixel (Überlapp-Anteil), Deckkräfte überlagern sich wie Schleier
  const band = (out, { r, w, a }) => {
    const hw = Math.max(w, minPx * px) / 2;
    const i0 = Math.max(0, Math.floor((r - hw - rIn) / px)), i1 = Math.min(W - 1, Math.floor((r + hw - rIn) / px));
    for (let i = i0; i <= i1; i++) {
      const lo = rIn + i * px, cov = Math.max(0, Math.min(lo + px, r + hw) - Math.max(lo, r - hw)) / px;
      out[i] = 1 - (1 - out[i]) * (1 - a * cov);
    }
  };
  const base = new Float32Array(W);
  for (const g of rings) band(base, g);
  const data = new Uint8Array(W * H * 4);
  const row = new Float32Array(W);
  for (let j = 0; j < H; j++) {
    row.set(base);
    for (const g of opts.arcs ?? []) {
      const d = Math.abs((((j + 0.5) / H) * 360 - g.lon + 540) % 360 - 180);
      const k = THREE.MathUtils.smoothstep(g.len / 2 + 1.5, g.len / 2, d);
      if (k > 0) band(row, { r: g.r, w: g.w, a: g.a * k });
    }
    for (let i = 0; i < W; i++) data.set([col[0], col[1], col[2], Math.round(row[i] * 255)], (j * W + i) * 4);
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// Ringscheibe rIn … rOut [km] in Einheiten von unit [km] in der x-z-Ebene (y = Pol): uv.x radial wie ringTexture,
// uv.y = Azimut / 2π, gezählt von +x in Drehrichtung um +y. Material: RING_FRAG mit den Uniforms aus planetfx.js.
export function ringMesh(material, rIn, rOut, unit, segs = 512) {
  const g = new THREE.RingGeometry(rIn / unit, rOut / unit, segs, 1);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, Math.floor(i / (segs + 1)), (i % (segs + 1)) / segs);
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, material);
}

// Leuchtspur: hell am Mond, nach hinten abklingend (wie die Planetenbahnen im Sonnensystem)
export const ORBIT_VERT = /* glsl */ `
attribute float mfrac;
uniform float uPhase;
varying float vA;
void main() {
  float d = fract(uPhase - mfrac);
  vA = 0.16 + 0.84 * pow(1.0 - d, 12.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
export const ORBIT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
varying float vA;
void main() { gl_FragColor = vec4(uColor * vA * uGain, 1.0); }
`;

// Laplace-Koordinaten [km] → Szene in Einheiten von unit [km]; axes = laplaceAxes(ra, dec) aus astro.js
export function laplaceToScene(p, axes, unit, out = new THREE.Vector3()) {
  const { x, y, z } = axes;
  return out.set(x[0] * p[0] + y[0] * p[1] + z[0] * p[2], x[1] * p[0] + y[1] * p[1] + z[1] * p[2], x[2] * p[0] + y[2] * p[1] + z[2] * p[2]).divideScalar(unit);
}

// Mondbahn aus einer JPL-Zeile sats/elem (el, siehe astro.js laplacePos): Linie über einen Umlauf ab jd, Leuchtspur
// endet am Mond. Apsiden und Knoten wandern (Miranda: Knoten in 17,8 Jahren einmal herum) → Linie neu, wenn der
// Zeitpunkt mehr als 2 % einer Knotenperiode (mindestens 20 Umläufe) vom Stand der Linie abweicht.
export function moonOrbit(el, axes, unit, color, jd, gain = 0.8) {
  const N = 360, pts = new Float32Array((N + 1) * 3), mf = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) mf[i] = i / N;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  geo.setAttribute('mfrac', new THREE.BufferAttribute(mf, 1));
  const mat = new THREE.ShaderMaterial({ vertexShader: ORBIT_VERT, fragmentShader: ORBIT_FRAG,
    uniforms: { uPhase: { value: 0 }, uColor: { value: new THREE.Color(color) }, uGain: { value: gain } },
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const line = new THREE.Line(geo, mat);
  const v = new THREE.Vector3(), redo = Math.max(20 * el.P, 0.02 * Math.abs(el.Pn || el.Pw || 0) * 365.25);
  let jd0 = NaN;
  function build(jd) {
    jd0 = jd;
    for (let i = 0; i <= N; i++) pts.set(laplaceToScene(laplacePos(el, jd + (i / N) * el.P), axes, unit, v).toArray(), i * 3);
    geo.attributes.position.needsUpdate = true;
    geo.computeBoundingSphere();
  }
  build(jd);
  return {
    line,
    // Ort des Mondes zum Zeitpunkt jd (Szene) und Spur nachführen
    update(jd, out) {
      if (!(Math.abs(jd - jd0) < redo)) build(jd);
      mat.uniforms.uPhase.value = ((((jd - jd0) / el.P) % 1) + 1) % 1;
      return laplaceToScene(laplacePos(el, jd), axes, unit, out);
    },
  };
}

// Gebundene Rotation: Länge 0° zeigt zum Planeten (toPlanet), +y = Nordpol des Mondes (north), Länge wächst nach Osten
// um +y (Karten mit 0° in der Bildmitte, Osten rechts → three.js-Kugel: u = 0,5 bei +x, u = 0,75 bei −z)
const qx = new THREE.Vector3(), qz = new THREE.Vector3(), qm = new THREE.Matrix4();
export function tidalQuat(q, toPlanet, north) {
  qx.copy(toPlanet).addScaledVector(north, -toPlanet.dot(north)).normalize();
  qz.crossVectors(qx, north);
  return q.setFromRotationMatrix(qm.makeBasis(qx, north, qz));
}
