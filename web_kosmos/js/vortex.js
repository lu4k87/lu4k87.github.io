// Galaxien, Lichtpunkte und Glut im Wirbel des Auftakts (opener.js, User 28.10.2026): mit dem Knall zünden sie von der
// Mitte nach außen, liegen auf den Spiralarmen der Gasscheibe (gleiche Lage uGasM, gleiche Drehung: innen schneller),
// dehnen sich mit ihr aus, und die Kamera fliegt hinein – alles zieht an ihr vorbei, während der Wirbel weiterdreht.
// Die Hälfte liegt als Trichter vor der Scheibe auf der Seite der Kamera (−y, weitet sich nach außen, Arme drehen mit der
// Höhe weiter): durch ihn fliegt die Kamera, so zieht der Strom die ganze Fahrt über an ihr vorbei.
// Lichtpunkte mit Bewegungsunschärfe (Spur zwischen der Lage jetzt und vor einer Belichtungszeit, wie der Staub),
// Galaxien als Kacheln des Atlas (galaxyflight.js), schräg gestaucht wie geneigte Scheiben; nah vor der Kamera weich aus.
// Darstellung: Galaxien gab es erst Hunderte Millionen Jahre nach dem Knall – der Wirbel erzählt, was daraus wird.
import * as THREE from 'three';
import { TILES } from './galaxyflight.js';
import { blackbody, gauss } from './astro.js';

const VERT = /* glsl */ `
uniform mat3 uM;
uniform float uS, uS0, uSpin, uSpin0, uOn, uPx, uAspect, uH, uGain, uArmB;
attribute vec4 aA;   // Radius, Winkel beim Knall, Höhe (Scheiben-Einheiten), Größe
attribute vec4 aB;   // Kachel (−1 = Lichtpunkt), Helligkeit, Zünden (0 … 1), Drehung im Bild
attribute vec3 aCol;
varying vec3 vU, vCol;
varying vec2 vUv;
varying float vSize, vTile;
// Lage im Wirbel: beim Knall auf den Armen (Musterdrehung uArmB), danach dreht der Winkel wie das Gas (Drall seit dem
// Knall, innen schneller), Maßstab wie die Scheibe
vec3 at(float S, float spin) {
  float a = aA.y - uArmB - spin / (0.4 + aA.x);
  return uM * vec3(aA.x * cos(a), aA.z, aA.x * sin(a)) * S;
}
void main() {
  vU = vec3(0.0); vCol = vec3(0.0); vUv = vec2(0.0); vSize = 1.0; vTile = aB.x;
  float on = smoothstep(aB.z, aB.z + 0.12, uOn);
  vec4 c1 = projectionMatrix * viewMatrix * modelMatrix * vec4(at(uS, uSpin), 1.0);
  vec4 c0 = projectionMatrix * viewMatrix * modelMatrix * vec4(at(uS0, uSpin0), 1.0);
  if (on <= 0.0 || c1.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (c0.w < 0.05) c0 = c1;
  vec2 k = vec2(uAspect, 1.0) * 0.5 * uH;
  vec2 P1 = c1.xy / c1.w * k, P0 = c0.xy / c0.w * k;
  float px = aA.w * uS * uPx / c1.w;
  // dicht vor der Kamera weich aus (Durchflug), statt bildfüllend und flau
  float near = 1.0 - smoothstep(0.12 * uH, 0.4 * uH, px);
  if (aB.x < 0.0) {
    vec2 V = P1 - P0;
    float len = min(length(V), 0.5 * uH), size = clamp(px, 0.8, 7.0);
    vec2 dir = length(V) > 0.01 ? normalize(V) : vec2(1.0, 0.0), nrm = vec2(-dir.y, dir.x);
    vec2 P = mix(P1 - dir * len, P1, position.x * 0.5 + 0.5) + dir * position.x * size + nrm * position.y * size;
    gl_Position = vec4(P / k, 0.0, 1.0);
    vU = vec3(position.x * (0.5 * len + size), position.y * size, 0.5 * len);
    vSize = size;
    // Energie auf Fläche und Spur verteilt; unter 0,8 px dunkler statt kleiner
    vCol = aCol * aB.y * on * near * uGain * min(1.0, px / 0.8) * 3.0 / (size * size * 1.1 + 2.0 * size * len);
  } else {
    // Galaxie: Kachel um die eigene Achse gedreht, gestaucht wie eine geneigte Scheibe
    float size = max(px, 1.5), c = cos(aB.w), s = sin(aB.w), sq = 0.35 + 0.65 * fract(aB.w * 3.7);
    vec2 q = position.xy * vec2(1.0, sq);
    gl_Position = vec4((P1 + vec2(c * q.x - s * q.y, s * q.x + c * q.y) * size) / k, 0.0, 1.0);
    vUv = position.xy * 0.5 + 0.5;
    vCol = aCol * aB.y * on * near * uGain * min(1.0, px / 1.5);
  }
}`;
const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
varying vec3 vU, vCol;
varying vec2 vUv;
varying float vSize, vTile;
vec2 cell(float t) { return (vec2(mod(t, 4.0), 3.0 - floor(t / 4.0)) + clamp(vUv, 0.01, 0.99)) / 4.0; }
void main() {
  if (vTile < 0.0) {
    float r = length(vec2(max(abs(vU.x) - vU.z, 0.0), vU.y)) / vSize;
    if (r >= 1.0) discard;
    gl_FragColor = vec4(vCol * exp(-r * r * 5.0), 1.0);
  } else {
    gl_FragColor = vec4(pow(texture2D(uAtlas, cell(vTile)).rgb, vec3(2.2)) * vCol, 1.0);
  }
}`;

// Farben der Lichtpunkte: junge Sterne blauweiß, Wasserstoff rosa, Sauerstoff türkis, warme Glut (Webb-Farben, wie das Gas)
const HUES = [[0.75, 0.85, 1.0], [1.0, 0.42, 0.68], [0.4, 0.88, 1.0], [1.0, 0.78, 0.48]];

// rand = Zufall (mulberry32), atlas = Galaxien-Atlas, n = Zahl der Lichtpunkte, ng = Zahl der Galaxien, R = Radius der
// Gasscheibe (Scheiben-Einheiten), pitch = Steigung der Arme (wie gasSample in opener.js)
export function createVortex(rand, atlas, { n = 6000, ng = 700, R = 4.2, pitch = 2.2 } = {}) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const N = n + ng, A = new Float32Array(N * 4), Bv = new Float32Array(N * 4), C = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const gal = i >= n;
    // auf einem der zwei Arme (Winkel = Steigung · log r), gestreut; ein Teil frei in der Scheibe; Trichter: Höhe h vor
    // der Scheibe, Radius wächst mit h
    const funnel = rand() < 0.5, h = funnel ? 3 * Math.pow(rand(), 0.8) : 0;
    const r = funnel ? (0.2 + 1.1 * Math.pow(rand(), 0.7)) * (1 + 0.5 * h) : 0.35 + (R - 0.6) * Math.pow(rand(), gal ? 0.7 : 0.85);
    const free = rand() < (gal ? 0.3 : 0.2), spread = free ? Math.PI : 0.32 + 0.1 * r;
    const th = (rand() < 0.5 ? 0 : Math.PI) + pitch * Math.log(r + 0.25) + 0.7 * h + gauss(rand) * spread;
    const y = gauss(rand) * (0.05 + 0.03 * r) - h;
    // zünden von innen nach außen (Welle des Knalls), etwas gestreut
    const birth = Math.min(0.95, 0.6 * Math.min(1, (r - 0.2) / (R - 0.6) + 0.15 * h) + 0.25 * rand());
    if (gal) {
      const ell = rand() < 0.25, set = ell ? TILES.ellip : rand() < 0.3 ? TILES.young : TILES.spiral;
      A.set([r, th, y, 0.07 + 0.16 * rand() ** 2], i * 4);
      Bv.set([set[Math.floor(rand() * set.length)], 2.5 + 2.5 * rand(), birth, rand() * 6.283], i * 4);
      C.set(ell ? blackbody(4200 + 900 * rand()) : rand() < 0.4 ? blackbody(9000 + 9000 * rand()) : blackbody(5600 + 2400 * rand()), i * 3);
    } else {
      const h = HUES[rand() < 0.55 ? 0 : 1 + Math.floor(rand() * 3)], b = Math.exp(gauss(rand) * 0.6);
      A.set([r, th, y, 0.006 + 0.014 * rand() ** 3], i * 4);
      Bv.set([-1, b, birth, 0], i * 4);
      C.set(h, i * 3);
    }
  }
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(A, 4));
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(Bv, 4));
  g.setAttribute('aCol', new THREE.InstancedBufferAttribute(C, 3));
  g.instanceCount = N;
  const u = {
    uM: { value: new THREE.Matrix3() }, uS: { value: 1 }, uS0: { value: 1 }, uSpin: { value: 0 }, uSpin0: { value: 0 }, uOn: { value: 0 },
    uPx: { value: 600 }, uAspect: { value: 1 }, uH: { value: 900 }, uGain: { value: 0 }, uArmB: { value: 0 }, uAtlas: { value: atlas },
  };
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: u, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}
