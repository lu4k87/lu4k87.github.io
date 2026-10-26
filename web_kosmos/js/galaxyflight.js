// Galaxien als eigenes Modell und Tiefenfeld-Durchflug zwischen Station 10 und 11 (Vorschau 26.10.2026 „Urknall und
// Kamerafahrt durch die Galaxien“: F5 Modell, Flug:A).
// · galaxyAtlas(): 16 Formen, im Browser auf ein Canvas gemalt (Spiralen mit und ohne Balken, flockig, mit großem Bulge,
//   blau, Ellipsen, von der Kante, unregelmäßig, Paar in Wechselwirkung) – keine Teleskopbilder, keine Lizenzfrage.
// · galaxySprites()/glowPoints(): Galaxien als Tafeln mit Tönung und Geburtszeit (uT), ferne Galaxien/Sterne als Punkte;
//   uS = Maßstab der Gruppe (Station 11 lässt den Raum wachsen), uPx = Pixel je Bogenmaß.
// · createCorridor(): Feld aus Galaxien entlang −z; je tiefer, desto früher: kleiner, unregelmäßiger, röter, dann das dunkle
//   Zeitalter fast ohne Galaxien, am Ende die Wand der Hintergrundstrahlung (Fleckenmuster wie Station 10, weicher).
// Rechenkern ohne three.js (Kurven, Fahrplan der Sonderetappe): flightplan.js.

import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { mulberry32, gauss, blackbody } from './astro.js';
import { key } from './flightplan.js';

const lerp = (a, b, x) => a + (b - a) * x;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ---------- Atlas: 4 × 4 Kacheln je 512 px, additiv auf Schwarz gemalt (einmal je Seite, das Canvas bleibt im Speicher) ----------
function blob(rgb) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.35, `rgba(${rgb},0.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
}
let B = null;
const put = (g, b, x, y, r, a) => { g.globalAlpha = a; g.drawImage(b, x - r, y - r, 2 * r, 2 * r); };

function spiral(g, cx, cy, R, rand, o = {}) {
  const arms = o.arms || 2, pitch = o.pitch || 0.32, spread = o.spread || 0.18, n = o.n || 4200;
  g.globalCompositeOperation = 'lighter';
  put(g, B.white, cx, cy, R * 1.25, 0.10);
  put(g, B.core, cx, cy, R * (o.bulge || 0.32), 0.95);
  put(g, B.core, cx, cy, R * (o.bulge || 0.32) * 0.45, 0.9);
  if (o.bar) for (let i = 0; i < 700; i++) { const u = rand() * 2 - 1; put(g, B.warm, cx + Math.cos(o.bar) * u * R * 0.42 + gauss(rand) * 3, cy + Math.sin(o.bar) * u * R * 0.42 + gauss(rand) * 3, 3 + rand() * 4, 0.16); }
  const r0 = o.bar ? R * 0.4 : R * 0.12;
  for (let i = 0; i < n; i++) {
    const k = i % arms, u = Math.pow(rand(), 0.75), r = r0 + u * (R - r0);
    const th = (o.bar || 0) + k * 2 * Math.PI / arms + Math.log(r / r0) / Math.tan(pitch) + gauss(rand) * spread * (o.flocc ? 2.5 : 1);
    const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
    if (i % 17 === 0) put(g, B.hii, x, y, 3 + rand() * 5, 0.45);
    else put(g, i % 3 ? B.arm : B.white, x, y, 1.6 + rand() * 3.2, 0.22 * (1.1 - u * 0.6) * (o.blue ? 1.3 : 1));
  }
  // Staubbahnen an der Innenkante der Arme
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = R * 0.03;
  for (let k = 0; k < arms; k++) {
    g.beginPath();
    for (let r = r0 * 1.2; r < R * 0.85; r += 2) { const th = (o.bar || 0) + k * 2 * Math.PI / arms + Math.log(r / r0) / Math.tan(pitch) - 0.18; g.lineTo(cx + r * Math.cos(th), cy + r * Math.sin(th)); }
    g.stroke();
  }
  g.globalCompositeOperation = 'lighter';
}
function elliptical(g, cx, cy, R, q, ang, rand, halo = 1) {
  g.save(); g.translate(cx, cy); g.rotate(ang); g.scale(1, q);
  for (let i = 0; i < 9; i++) put(g, i < 3 ? B.core : B.warm, 0, 0, R * Math.pow(0.62, i) * 1.3, 0.16 + i * 0.06);
  put(g, B.warm, 0, 0, R * 1.6 * halo, 0.08);
  g.restore();
  for (let i = 0; i < 40; i++) put(g, B.warm, cx + gauss(rand) * R * 0.5, cy + gauss(rand) * R * 0.5 * q, 1.5, 0.4);
}
function edgeOn(g, cx, cy, R, ang, rand, bulge = 0.25) {
  g.save(); g.translate(cx, cy); g.rotate(ang);
  g.save(); g.scale(1, 0.11);
  for (let i = 0; i < 1800; i++) put(g, i % 9 ? B.arm : B.hii, gauss(rand) * R * 0.42, gauss(rand) * R * 0.3, 3 + rand() * 6, 0.12);
  g.restore();
  g.save(); g.scale(1, 0.62); put(g, B.core, 0, 0, R * bulge * 1.6, 0.9); put(g, B.warm, 0, 0, R * bulge * 3, 0.25); g.restore();
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(-R * 0.95, -R * 0.012, R * 1.9, R * 0.03);
  g.globalCompositeOperation = 'lighter';
  g.restore();
}
function irregular(g, cx, cy, R, rand, clumps = 7) {
  put(g, B.blue, cx, cy, R * 0.9, 0.12);
  for (let c = 0; c < clumps; c++) {
    const x0 = cx + gauss(rand) * R * 0.32, y0 = cy + gauss(rand) * R * 0.28;
    for (let i = 0; i < 180; i++) put(g, i % 7 ? B.blue : B.hii, x0 + gauss(rand) * R * 0.09, y0 + gauss(rand) * R * 0.09, 2 + rand() * 4, 0.2);
    put(g, B.white, x0, y0, R * 0.12, 0.35);
  }
}
let atlasCanvas = null;
// Kacheln: 0–5 Spiralen (2 Arme, Balken, 3 Arme, flockig, großer Bulge, blau), 6–8 Ellipsen, 9–10 von der Kante,
// 11–13 unregelmäßig (groß, klumpig, Zwerg), 14 Linse (S0), 15 Paar in Wechselwirkung
export const TILES = { mature: [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 14, 15], young: [0, 1, 2, 3, 5, 11, 12, 13], first: [11, 12, 13, 13, 5], ellip: [6, 7, 8, 14, 6] };
export function galaxyAtlas() {
  if (!atlasCanvas) {
    B = { core: blob('255,214,150'), warm: blob('255,232,200'), arm: blob('190,215,255'), white: blob('235,240,255'), hii: blob('255,120,170'), blue: blob('140,180,255') };
    const S = 512, c = document.createElement('canvas'); c.width = c.height = 4 * S;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'lighter';
    const rand = mulberry32(2026);
    const at = (i) => [(i % 4) * S + S / 2, Math.floor(i / 4) * S + S / 2];
    const R = S * 0.42;
    spiral(g, ...at(0), R, rand, { arms: 2, pitch: 0.3 });
    spiral(g, ...at(1), R, rand, { arms: 2, pitch: 0.36, bar: 0.6 });
    spiral(g, ...at(2), R, rand, { arms: 3, pitch: 0.42, spread: 0.24 });
    spiral(g, ...at(3), R, rand, { arms: 4, pitch: 0.4, flocc: true, n: 5200 });
    spiral(g, ...at(4), R, rand, { arms: 2, pitch: 0.18, bulge: 0.5, n: 3000 });
    spiral(g, ...at(5), R * 0.9, rand, { arms: 2, pitch: 0.45, blue: true, bulge: 0.18 });
    elliptical(g, ...at(6), R * 0.55, 1, 0, rand);
    elliptical(g, ...at(7), R * 0.6, 0.55, 0.5, rand);
    elliptical(g, ...at(8), R * 0.5, 0.85, 1.1, rand, 1.8);
    edgeOn(g, ...at(9), R, 0.1, rand);
    edgeOn(g, ...at(10), R * 0.9, -0.2, rand, 0.42);
    irregular(g, ...at(11), R * 0.8, rand);
    irregular(g, ...at(12), R * 0.7, rand, 11);
    irregular(g, ...at(13), R * 0.45, rand, 4);
    elliptical(g, ...at(14), R * 0.45, 0.4, -0.4, rand); edgeOn(g, ...at(14), R * 0.8, -0.4, rand, 0.1);
    const [mx, my] = at(15);
    spiral(g, mx - R * 0.3, my - R * 0.1, R * 0.45, rand, { arms: 2, pitch: 0.4, n: 1500 });
    spiral(g, mx + R * 0.32, my + R * 0.15, R * 0.4, rand, { arms: 2, pitch: 0.38, n: 1300 });
    for (let i = 0; i < 900; i++) { const u = rand(), th = u * 2.6; put(g, B.arm, mx - R * 0.3 + Math.cos(th + 2) * R * (0.4 + u * 0.5), my - R * 0.1 - Math.sin(th + 2) * R * (0.3 + u * 0.4), 2 + rand() * 2, 0.12); }
    atlasCanvas = c;
  }
  const tex = new THREE.CanvasTexture(atlasCanvas);
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// ---------- Galaxien als Instanzen: Kachel, Tönung, Helligkeit, Geburtszeit; nah an der Kamera weich ausgeblendet ----------
const GAL_VERT = /* glsl */ `
attribute float aTile, aBirth, aGain, aSize; attribute vec3 aTint;
uniform float uT, uS;
varying vec2 vUv; varying vec3 vTint; varying float vA, vTile;
void main() {
  vUv = uv; vTint = aTint; vTile = aTile;
  vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  float near = smoothstep(0.35, 2.2, -mv.z / (aSize * uS));
  vA = aGain * smoothstep(aBirth, aBirth + 0.1, uT) * near;
  gl_Position = projectionMatrix * mv;
}`;
const GAL_FRAG = /* glsl */ `
uniform sampler2D uAtlas; uniform float uGain;
varying vec2 vUv; varying vec3 vTint; varying float vA, vTile;
void main() {
  if (vA < 0.002) discard;
  vec2 uv = (vec2(mod(vTile, 4.0), 3.0 - floor(vTile / 4.0)) + clamp(vUv, 0.01, 0.99)) / 4.0;
  vec3 c = pow(texture2D(uAtlas, uv).rgb, vec3(2.2));
  gl_FragColor = vec4(c * vTint * vA * uGain, 1.0);
}`;
export function galaxySprites(list, tex) {
  const n = list.length;
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    vertexShader: GAL_VERT, fragmentShader: GAL_FRAG, uniforms: { uAtlas: { value: tex }, uT: { value: 1 }, uS: { value: 1 }, uGain: { value: 1 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  }), n);
  const tile = new Float32Array(n), birth = new Float32Array(n), gain = new Float32Array(n), size = new Float32Array(n), tint = new Float32Array(n * 3);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
  list.forEach((g, i) => {
    q.setFromEuler(e.set(g.rx, g.ry, g.rz));
    m.compose(g.pos, q, s.set(g.size, g.size, g.size));
    mesh.setMatrixAt(i, m);
    tile[i] = g.tile; birth[i] = g.birth ?? -1; gain[i] = g.gain; size[i] = g.size; tint.set(g.tint, i * 3);
  });
  const geo = mesh.geometry;
  geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 1));
  geo.setAttribute('aBirth', new THREE.InstancedBufferAttribute(birth, 1));
  geo.setAttribute('aGain', new THREE.InstancedBufferAttribute(gain, 1));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}
export const randTurn = (rand) => ({ rx: rand() * 6.3, ry: rand() * 6.3, rz: rand() * 6.3 });

// ---------- Punkte: ferne Galaxien und Sterne, Größe in Szeneneinheiten, unter 1,6 px dunkler statt kleiner ----------
const PT_VERT = /* glsl */ `
attribute float aSize, aBirth; attribute vec3 aCol;
uniform float uPx, uT, uS;
varying vec3 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float px = aSize * uS * uPx / max(0.01, -mv.z);
  vCol = aCol * smoothstep(aBirth, aBirth + 0.1, uT) * min(1.0, px / 1.6);
  gl_PointSize = clamp(px, 1.6, 64.0);
  gl_Position = projectionMatrix * mv;
}`;
const PT_FRAG = /* glsl */ `
uniform float uGain;
varying vec3 vCol;
void main() { vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; gl_FragColor = vec4(vCol * uGain * exp(-r * r * 5.0) * step(r, 1.0), 1.0); }`;
export function glowPoints(list) {
  const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), birth = new Float32Array(n);
  list.forEach((p, i) => { pos.set([p.pos.x, p.pos.y, p.pos.z], i * 3); col.set(p.col, i * 3); size[i] = p.size; birth[i] = p.birth ?? -1; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aBirth', new THREE.BufferAttribute(birth, 1));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({ vertexShader: PT_VERT, fragmentShader: PT_FRAG,
    uniforms: { uPx: { value: 1 }, uT: { value: 1 }, uS: { value: 1 }, uGain: { value: 1 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  pts.frustumCulled = false;
  pts.renderOrder = 1;
  return pts;
}

// ---------- Tiefenfeld: L Einheiten tief entlang −z, Wand der Hintergrundstrahlung dahinter ----------
// OFF = Lage des Feldes in der Szene: weit abseits des Urknalls im Ursprung (Anker der Flüge) – die Kamera fährt nie dicht
// an ihm vorbei, die Fahrt relativ zum Anker bleibt so stetig wie im Bild
const L = 1000, WALL = -1.02 * L, FRONT = 120, Z0 = 30, Z1 = -L + 10, OFF = -6000;
// Hintergrundstrahlung als Wand: Farbskala wie Station 10, weicher; glüht zuletzt weiß auf (uGlow)
const WALL_FRAG = /* glsl */ `
${NOISE}
uniform float uGlow;
varying vec3 vP;
vec3 planck(float x) {
  x = clamp(x * 0.5 + 0.5, 0.0, 1.0);
  vec3 c0 = vec3(0.0, 0.03, 0.35), c1 = vec3(0.0, 0.55, 1.0), c2 = vec3(1.0, 0.97, 0.85), c3 = vec3(1.0, 0.5, 0.0), c4 = vec3(0.6, 0.0, 0.0);
  if (x < 0.25) return mix(c0, c1, x / 0.25);
  if (x < 0.5) return mix(c1, c2, (x - 0.25) / 0.25);
  if (x < 0.75) return mix(c2, c3, (x - 0.5) / 0.25);
  return mix(c3, c4, (x - 0.75) / 0.25);
}
void main() {
  vec3 q = vP * 0.012;
  float f = 0.5 * gnoise(q) + 0.5 * gnoise(q * 2.3 + 3.1) + 0.6 * gnoise(q * 5.0 + 7.3) + 0.8 * gnoise(q * 11.0 + 1.7) + 0.5 * gnoise(q * 23.0 + 4.4);
  float r = length(vP.xy) / 600.0;
  gl_FragColor = vec4(planck(f * 1.1) * uGlow * (0.6 + 1.6 * exp(-r * r * 6.0)) + vec3(1.0, 0.9, 0.8) * uGlow * 1.2 * exp(-r * r * 40.0), 1.0);
}`;

export function createCorridor(ctx, tex) {
  const group = new THREE.Group();
  group.position.z = OFF;
  const rand = mulberry32(21), list = [], dots = [];
  const nGal = Math.round(11000 * Math.max(0.6, ctx.detail)), nDot = Math.round(40000 * Math.max(0.5, ctx.detail));
  // f = Tiefe 0 … 1 (früher): ab 0,68 dünnt das Feld aus (dunkles Zeitalter), ab 0,9 fast leer
  const keep = (f, a, b) => f < a || rand() < Math.max(0.03, 1 - (f - a) / b);
  for (let i = 0; i < nGal; i++) {
    const z = FRONT - rand() * (L + FRONT), f = clamp01(-z / L);
    if (!keep(f, 0.68, 0.22)) continue;
    const rr = 48 * Math.sqrt(rand()), th = rand() * 6.283;
    const set = f > 0.55 ? TILES.first : f > 0.3 ? TILES.young : TILES.mature;
    list.push({ pos: new THREE.Vector3(rr * Math.cos(th), rr * Math.sin(th), z), size: 2.6 * (1 - 0.6 * f) * Math.exp(gauss(rand) * 0.4),
      tile: set[Math.floor(rand() * set.length)], tint: blackbody(lerp(7200, 2100, Math.pow(f, 0.8))), gain: 1.6 + rand() * 1.4, ...randTurn(rand) });
  }
  for (let i = 0; i < nDot; i++) {
    const z = FRONT - rand() * (L + FRONT), f = clamp01(-z / L);
    if (!keep(f, 0.7, 0.2)) continue;
    const rr = 70 * Math.sqrt(rand()), th = rand() * 6.283;
    dots.push({ pos: new THREE.Vector3(rr * Math.cos(th), rr * Math.sin(th), z), size: 0.35, col: blackbody(lerp(7000, 2000, f)).map((v) => v * (0.5 + rand())) });
  }
  const gal = galaxySprites(list, tex), pts = glowPoints(dots);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: WALL_FRAG, uniforms: { uGlow: { value: 0 } }, depthWrite: false, depthTest: false,
  }));
  wall.position.z = WALL;
  wall.renderOrder = -5;
  group.add(wall, pts, gal);
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
  return {
    group,
    // x = Stand der Fahrt 0 … 1; hinaus (down = false) von heute zur Wand, Blick nach −z; hinein umgekehrt, Blick nach +z.
    // Tiefe wächst mit x^1,12 (tief hinten etwas schneller), leichtes Schlingern wie aus der Hand
    pose(cam, x, down) {
      const u = down ? 1 - x : x, z = Z0 + (Z1 - Z0) * Math.pow(u, 1.12), w = u * 7;
      pos.set(Math.sin(w) * 3, Math.cos(w * 0.72) * 2, z);
      tgt.set(Math.sin(w + 0.4) * 2, Math.cos(w * 0.72 + 0.3) * 1.5, z + (down ? 60 : -60));
      pos.z += OFF;
      tgt.z += OFF;
      cam.position.copy(pos);
      cam.up.set(0, 1, 0);
      cam.lookAt(tgt);
      // Wand glüht mit der Nähe auf: zuerst kaum, dann Fleckenmuster, zuletzt fast weiß
      wall.material.uniforms.uGlow.value = key([[0.5, 0], [0.72, 0.006], [0.86, 0.03], [0.95, 0.15], [1, 0.5]], -z / L);
      return tgt;
    },
    setPixelRatio(px) { pts.material.uniforms.uPx.value = px; },
  };
}
