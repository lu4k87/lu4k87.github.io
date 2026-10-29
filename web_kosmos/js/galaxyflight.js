// Galaxien als eigenes Modell und Vorbeiflug an Galaxien auf der Fahrt hinein zur Lokalen Gruppe (Station 9 → 8; Vorschau
// 26.10.2026 „Urknall und Kamerafahrt durch die Galaxien“: F5 Modell; Rückmeldung des Users 27.10.2026: der Flug an Galaxien
// vorbei gehört auf die Fahrt vom kosmischen Netz in die Lokale Gruppe, nicht zwischen Station 10 und 11).
// · galaxyAtlas(): 16 Formen, im Browser auf ein Canvas gemalt (Spiralen mit und ohne Balken, flockig, mit großem Bulge,
//   blau, Ellipsen, von der Kante, unregelmäßig, Paar in Wechselwirkung) – keine Teleskopbilder, keine Lizenzfrage.
// · galaxySprites()/glowPoints(): Galaxien als Tafeln mit Tönung, Geburt und Reifung (uT), ferne Galaxien/Sterne als
//   Punkte mit Geburt und Ende; uS = Maßstab der Gruppe (Station 11 lässt den Raum wachsen), uPx = Pixel je Bogenmaß.
// · createFlyby(): reife Galaxien entlang der Fahrt, beim Start an Kamera und Anker ausgerichtet (Lage: flightplan.js
//   flybyField), nur im Flug sichtbar.
import * as THREE from 'three';
import { mulberry32, gauss, blackbody } from './astro.js';
import { sstep, flybyField, FLYBY } from './flightplan.js';

// ---------- Atlas: 4 × 4 Kacheln je 512 px, additiv auf Schwarz gemalt (einmal je Seite, das Canvas bleibt im Speicher) ----------
function blob(rgb) {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const g = c.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.18, `rgba(${rgb},0.82)`);
  gr.addColorStop(0.42, `rgba(${rgb},0.35)`);
  gr.addColorStop(0.72, `rgba(${rgb},0.08)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
  return c;
}
let B = null;
const put = (g, b, x, y, r, a) => { g.globalAlpha = a; g.drawImage(b, x - r, y - r, 2 * r, 2 * r); };

function spiral(g, cx, cy, R, rand, o = {}) {
  const arms = o.arms || 2, pitch = o.pitch || 0.32, spread = o.spread || 0.18, n = o.n || 4500;
  g.globalCompositeOperation = 'lighter';
  put(g, B.white, cx, cy, R * 1.3, 0.08);
  put(g, B.warm, cx, cy, R * (o.bulge || 0.32) * 1.7, 0.45);
  put(g, B.core, cx, cy, R * (o.bulge || 0.32), 0.95);
  put(g, B.nucleus, cx, cy, R * (o.bulge || 0.32) * 0.4, 1.0);
  if (o.bar) for (let i = 0; i < 900; i++) { const u = rand() * 2 - 1; put(g, B.warm, cx + Math.cos(o.bar) * u * R * 0.42 + gauss(rand) * 3, cy + Math.sin(o.bar) * u * R * 0.42 + gauss(rand) * 3, 3 + rand() * 5, 0.18); }
  const r0 = o.bar ? R * 0.4 : R * 0.12;

  // Weiche leuchtende Arm-Rückgrate
  for (let k = 0; k < arms; k++) {
    const aTh = (o.bar || 0) + k * 2 * Math.PI / arms;
    for (let r = r0; r < R * 0.95; r += 3) {
      const th = aTh + Math.log(r / r0) / Math.tan(pitch);
      const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
      put(g, o.blue ? B.blue : B.arm, x, y, 6 + (r / R) * 8, 0.14 * (1.1 - (r / R) * 0.5));
    }
  }

  // Sternhaufen und HII-Gebiete
  for (let i = 0; i < n; i++) {
    const k = i % arms, u = Math.pow(rand(), 0.75), r = r0 + u * (R - r0);
    const th = (o.bar || 0) + k * 2 * Math.PI / arms + Math.log(r / r0) / Math.tan(pitch) + gauss(rand) * spread * (o.flocc ? 2.5 : 1);
    const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
    if (i % 14 === 0) put(g, B.hii, x, y, 3 + rand() * 5, 0.55);
    else put(g, i % 3 ? B.arm : B.white, x, y, 1.8 + rand() * 3.4, 0.24 * (1.1 - u * 0.5) * (o.blue ? 1.35 : 1));
  }

  // Staubbahnen an der Innenkante der Arme
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(6,4,10,0.35)'; g.lineWidth = R * 0.026;
  for (let k = 0; k < arms; k++) {
    g.beginPath();
    for (let r = r0 * 1.15; r < R * 0.88; r += 2) {
      const th = (o.bar || 0) + k * 2 * Math.PI / arms + Math.log(r / r0) / Math.tan(pitch) - 0.17;
      g.lineTo(cx + r * Math.cos(th), cy + r * Math.sin(th));
    }
    g.stroke();
  }
  g.globalCompositeOperation = 'lighter';
}
function elliptical(g, cx, cy, R, q, ang, rand, halo = 1.2) {
  g.save(); g.translate(cx, cy); g.rotate(ang); g.scale(1, q);
  put(g, B.warm, 0, 0, R * 1.8 * halo, 0.10);
  for (let i = 0; i < 9; i++) {
    put(g, i < 2 ? B.nucleus : i < 4 ? B.core : B.warm, 0, 0, R * Math.pow(0.60, i) * 1.4, 0.18 + i * 0.06);
  }
  g.restore();
  for (let i = 0; i < 60; i++) put(g, B.warm, cx + gauss(rand) * R * 0.52, cy + gauss(rand) * R * 0.52 * q, 2.0, 0.45);
}
function edgeOn(g, cx, cy, R, ang, rand, bulge = 0.28) {
  g.save(); g.translate(cx, cy); g.rotate(ang);
  // Scheibe flach gestreckt
  g.save(); g.scale(1, 0.12);
  for (let i = 0; i < 2200; i++) put(g, i % 9 ? B.arm : B.hii, gauss(rand) * R * 0.44, gauss(rand) * R * 0.28, 3 + rand() * 6, 0.14);
  g.restore();
  // Zentraler Bulge (sphaeroidales Leuchten)
  g.save(); g.scale(1, 0.58);
  put(g, B.core, 0, 0, R * bulge * 1.7, 0.95);
  put(g, B.nucleus, 0, 0, R * bulge * 0.65, 1.0);
  put(g, B.warm, 0, 0, R * bulge * 3.2, 0.28);
  g.restore();
  // Organische dunkle Staubscheibe quer durch das Zentrum
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(6,4,10,0.68)';
  g.beginPath();
  const dThick = R * 0.022;
  g.moveTo(-R * 0.96, -dThick * 0.4);
  g.quadraticCurveTo(0, -dThick * 1.3, R * 0.96, -dThick * 0.4);
  g.lineTo(R * 0.96, dThick * 0.4);
  g.quadraticCurveTo(0, dThick * 1.3, -R * 0.96, dThick * 0.4);
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'lighter';
  g.restore();
}
function irregular(g, cx, cy, R, rand, clumps = 8) {
  put(g, B.blue, cx, cy, R * 0.95, 0.15);
  for (let c = 0; c < clumps; c++) {
    const x0 = cx + gauss(rand) * R * 0.32, y0 = cy + gauss(rand) * R * 0.28;
    for (let i = 0; i < 200; i++) put(g, i % 6 ? B.blue : B.hii, x0 + gauss(rand) * R * 0.09, y0 + gauss(rand) * R * 0.09, 2 + rand() * 4, 0.25);
    put(g, B.white, x0, y0, R * 0.14, 0.4);
  }
}
let atlasCanvas = null;
// Kacheln: 0–5 Spiralen (2 Arme, Balken, 3 Arme, flockig, großer Bulge, blau), 6–8 Ellipsen, 9–10 von der Kante,
// 11–13 unregelmäßig (groß, klumpig, Zwerg), 14 Linse (S0), 15 Paar in Wechselwirkung
export const TILES = { mature: [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 14, 15], young: [0, 1, 2, 3, 5, 11, 12, 13], first: [11, 12, 13, 13, 5], ellip: [6, 7, 8, 14, 6], spiral: [0, 1, 2, 3, 4, 9, 10, 15] };
export function galaxyAtlas() {
  if (!atlasCanvas) {
    B = { nucleus: blob('255,250,240'), core: blob('255,218,155'), warm: blob('255,232,205'), arm: blob('195,222,255'), white: blob('238,244,255'), hii: blob('255,115,175'), blue: blob('145,188,255') };
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
// Reifung (Urknall-Film): ab aMature wechselt die Galaxie in uMature Sekunden zu Kachel 2, Tönung 2 und aGrow-facher Größe
// (jung klein, blau, klumpig → Spirale oder Ellipse); uFade = Dauer des Aufleuchtens nach der Geburt
const GAL_VERT = /* glsl */ `
attribute float aTile, aTile2, aBirth, aMature, aGain, aSize, aGrow; attribute vec3 aTint, aTint2;
uniform float uT, uS, uFade, uMature, uStreak;
varying vec2 vUv; varying vec3 vTint; varying float vA, vTile, vTile2, vM;
void main() {
  vUv = uv; vTile = aTile; vTile2 = aTile2;
  vM = smoothstep(aMature, aMature + uMature, uT);
  vTint = mix(aTint, aTint2, vM);
  float k = mix(1.0, aGrow, vM);
  vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position * k, 1.0);

  // Dynamischer Vorbeiflug-Streak entlang der radialen Fluchtlinie (Kameraflugeffekt)
  if (uStreak > 0.001) {
    float zDist = max(0.03, -mv.z / (aSize * k * uS));
    vec2 dir = normalize(mv.xy + vec2(1e-4));
    float speed = clamp(length(mv.xy) / zDist, 0.0, 3.5);
    float streak = speed * uStreak;
    mv.xy += dir * dot(position.xy, dir) * streak * (aSize * k * uS);
  }

  // Echtes Vorbeifliegen: Galaxie bleibt bis zum Vorbeizug an der Kamera sichtbar
  float near = smoothstep(0.03, 0.35, -mv.z / (aSize * k * uS));
  vA = aGain * smoothstep(aBirth, aBirth + uFade, uT) * near;
  gl_Position = projectionMatrix * mv;
}`;
const GAL_FRAG = /* glsl */ `
uniform sampler2D uAtlas; uniform float uGain;
varying vec2 vUv; varying vec3 vTint; varying float vA, vTile, vTile2, vM;
vec2 cell(float t) { return (vec2(mod(t, 4.0), 3.0 - floor(t / 4.0)) + clamp(vUv, 0.01, 0.99)) / 4.0; }
void main() {
  if (vA < 0.002) discard;
  vec3 c = texture2D(uAtlas, cell(vTile)).rgb;
  if (vM > 0.0) c = mix(c, texture2D(uAtlas, cell(vTile2)).rgb, vM);
  gl_FragColor = vec4(pow(c, vec3(2.2)) * vTint * vA * uGain, 1.0);
} `;
export function galaxySprites(list, tex) {
  const n = list.length;
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    vertexShader: GAL_VERT, fragmentShader: GAL_FRAG,
    uniforms: {
      uAtlas: { value: tex },
      uT: { value: 1 },
      uS: { value: 1 },
      uGain: { value: 1 },
      uFade: { value: 0.1 },
      uMature: { value: 1 },
      uStreak: { value: 0.0 },
    },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  }), n);
  const f1 = () => new Float32Array(n), tile = f1(), tile2 = f1(), birth = f1(), mature = f1(), gain = f1(), size = f1(), grow = f1();
  const tint = new Float32Array(n * 3), tint2 = new Float32Array(n * 3);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
  list.forEach((g, i) => {
    q.setFromEuler(e.set(g.rx, g.ry, g.rz));
    m.compose(g.pos, q, s.set(g.size, g.size, g.size));
    mesh.setMatrixAt(i, m);
    tile[i] = g.tile; tile2[i] = g.tile2 ?? g.tile; birth[i] = g.birth ?? -1; mature[i] = g.mature ?? 1e9;
    gain[i] = g.gain; size[i] = g.size; grow[i] = g.grow ?? 1;
    tint.set(g.tint, i * 3); tint2.set(g.tint2 || g.tint, i * 3);
  });
  const geo = mesh.geometry;
  for (const [k, a, w] of [['aTile', tile, 1], ['aTile2', tile2, 1], ['aBirth', birth, 1], ['aMature', mature, 1], ['aGain', gain, 1], ['aSize', size, 1], ['aGrow', grow, 1], ['aTint', tint, 3], ['aTint2', tint2, 3]]) {
    geo.setAttribute(k, new THREE.InstancedBufferAttribute(a, w));
  }
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}
export const randTurn = (rand) => ({ rx: rand() * 6.3, ry: rand() * 6.3, rz: rand() * 6.3 });

export function flybyTurn(rand) {
  // Natürliche Inklination zur Flugrichtung (+z): 15° bis 65°,
  // kein Fluchtlinien-Papierschnitt (keine senkrecht zur Flugachse stehenden Kanten)
  const inc = 0.22 + rand() * 0.75;
  const phi = rand() * Math.PI * 2;
  const roll = rand() * Math.PI * 2;
  const e = new THREE.Euler(inc * Math.cos(phi), inc * Math.sin(phi), roll, 'ZXY');
  return { rx: e.x, ry: e.y, rz: e.z };
}

// ---------- Punkte: ferne Galaxien und Sterne, Größe in Szeneneinheiten, unter 1,6 px dunkler statt kleiner ----------
// aBirth/aEnd: leuchtet in uFade Sekunden auf und verlischt ab aEnd ebenso (erste Sterne, Supernova-Blitze)
const PT_VERT = /* glsl */ `
attribute float aSize, aBirth, aEnd; attribute vec3 aCol;
uniform float uPx, uT, uS, uFade;
varying vec3 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float px = aSize * uS * uPx / max(0.01, -mv.z);
  // dicht vor der Kamera weich aus statt groß und flau (Durchflug)
  vCol = aCol * smoothstep(aBirth, aBirth + uFade, uT) * (1.0 - smoothstep(aEnd, aEnd + uFade, uT)) * min(1.0, px / 1.6) * (1.0 - smoothstep(20.0, 56.0, px));
  gl_PointSize = clamp(px, 1.6, 64.0);
  gl_Position = projectionMatrix * mv;
}`;
const PT_FRAG = /* glsl */ `
uniform float uGain;
varying vec3 vCol;
void main() { vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; gl_FragColor = vec4(vCol * uGain * exp(-r * r * 5.0) * step(r, 1.0), 1.0); }`;
export function glowPoints(list) {
  const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), birth = new Float32Array(n), end = new Float32Array(n);
  list.forEach((p, i) => { pos.set([p.pos.x, p.pos.y, p.pos.z], i * 3); col.set(p.col, i * 3); size[i] = p.size; birth[i] = p.birth ?? -1; end[i] = p.end ?? 1e9; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aBirth', new THREE.BufferAttribute(birth, 1));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({ vertexShader: PT_VERT, fragmentShader: PT_FRAG,
    uniforms: { uPx: { value: 1 }, uT: { value: 1 }, uS: { value: 1 }, uGain: { value: 1 }, uFade: { value: 0.1 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  pts.frustumCulled = false;
  pts.renderOrder = 1;
  return pts;
}

// ---------- Vorbeiflug: Gruppe mit Ursprung im Anker, +z zur Startpose der Kamera, Maßstab = Startabstand D ----------
// begin() richtet das Feld an der Fahrt aus (die Kamera fährt auf der Achse auf den Anker zu), step(e) blendet über die
// Etappe ein und aus, end() blendet es weg; w = Gewicht der Etappe für den Fahrplan (main.js planChain)
export function createFlyby(tex) {
  const rand = mulberry32(8);
  const list = flybyField(rand).map((g) => ({
    pos: new THREE.Vector3(g.x, g.y, g.z), size: g.size, gain: 2.2 + rand() * 1.4,
    tile: TILES.mature[Math.floor(rand() * TILES.mature.length)],
    tint: blackbody(5000 + rand() * 2800),
    ...flybyTurn(rand),
  }));
  const mesh = galaxySprites(list, tex), u = mesh.material.uniforms, group = new THREE.Group(), axis = new THREE.Vector3(0, 0, 1);
  group.add(mesh);
  group.visible = false;
  const dir = new THREE.Vector3();
  return {
    group,
    w: FLYBY.w,
    begin(from, anchor) {
      const D = dir.copy(from).sub(anchor).length();
      group.position.copy(anchor);
      group.quaternion.setFromUnitVectors(axis, dir.divideScalar(D));
      group.scale.setScalar(D);
      u.uS.value = D;
      u.uGain.value = 0;
      u.uStreak.value = 0;
      group.visible = true;
    },
    step(e) {
      u.uGain.value = sstep(0, FLYBY.fade[0], e) * (1 - sstep(FLYBY.fade[1], 1, e));
      // Kameraflug-Dynamik: Vorbeiflug-Streak ist im schnellsten Flugteil (Mitte) am stärksten
      u.uStreak.value = 0.22 * Math.sin(Math.PI * e);
    },
    end() { group.visible = false; },
  };
}
