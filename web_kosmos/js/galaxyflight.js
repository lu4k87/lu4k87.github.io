// Galaxien als eigenes Modell und Vorbeiflug an Galaxien auf der Fahrt hinein zur Lokalen Gruppe (Station 05 → 04; Vorschau
// 26.10.2026 „Urknall und Kamerafahrt durch die Galaxien“: F5 Modell; Rückmeldung des Users 27.10.2026: der Flug an Galaxien
// vorbei gehört auf die Fahrt vom kosmischen Netz in die Lokale Gruppe, nicht zwischen Station 06 und 07).
// · galaxyAtlas(): 16 Formen, im Browser auf ein Canvas gemalt (Spiralen mit und ohne Balken, flockig, mit großem Bulge,
//   blau, Ellipsen, von der Kante, unregelmäßig, Paar in Wechselwirkung) – keine Teleskopbilder, keine Lizenzfrage.
// · galaxySprites()/glowPoints(): Galaxien als Tafeln mit Tönung, Geburt und Reifung (uT), ferne Galaxien/Sterne als
//   Punkte mit Geburt und Ende; uS = Maßstab der Gruppe (Station 07 lässt den Raum wachsen), uPx = Pixel je Bogenmaß.
// · galaxyField(): Galaxien prozedural im Shader (User 04.11.2026: Atlas-Tafeln wirkten flach, kopiert und rosa) – jede
//   Galaxie eine eigene Form aus Seed, Typ (Spirale, Ellipse, unregelmäßig, Linse), Armzahl, Steigung, Balken, Bulge, Staub,
//   Flockigkeit; echte Neigung im Raum (Scheibe als dünne Schicht mit Höhe, von der Kante schmal mit Staubband), Staubbahnen
//   an der Innenkante der Arme (vorn stärker), HII-Knoten dezent, Lichthof; Billboard-Tafel, Scheibe per Strahl–Ebene-Schnitt.
// · createFlyby(): Galaxien entlang der Fahrt (Lage: flightplan.js flybyField), beim Start an Kamera und Anker ausgerichtet,
//   nur im Flug sichtbar; der Atlas bleibt für den Auftakt-Film (opener.js) und Station 07.
import * as THREE from 'three';
import { mulberry32, gauss, blackbody } from './astro.js';
import { NOISE } from './glsl.js';
import { sstep, flybyField, deepField, FLYBY } from './flightplan.js';
import { settings } from './settings.js';

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
uniform float uT, uS, uFade, uMature; uniform vec2 uNear;
varying vec2 vUv; varying vec3 vTint; varying float vA, vTile, vTile2, vM;
void main() {
  vUv = uv; vTile = aTile; vTile2 = aTile2;
  vM = smoothstep(aMature, aMature + uMature, uT);
  vTint = mix(aTint, aTint2, vM);
  float k = mix(1.0, aGrow, vM);
  vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position * k, 1.0);
  // nah an der Kamera weich aus: uNear = Abstand in Durchmessern, ab dem sie ausblendet (Vorbeiflug früher, sonst erst dicht davor)
  float near = smoothstep(uNear.x, uNear.y, -mv.z / (aSize * k * uS));
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
      uNear: { value: new THREE.Vector2(0.03, 0.35) },
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
// ---------- Galaxien prozedural: Instanz = Tafel zur Kamera, Scheibe liegt als dünne Schicht im Raum (Normale aN) ----------
// Je Bildpunkt: Sichtstrahl schneidet die Scheibenebene (schräge Scheiben perspektivisch richtig); nahe der Kante zählt
// stattdessen der dem Zentrum nächste Punkt des Strahls, gewichtet mit der Höhe über der Ebene (Dicke hz) und der Weglänge
// durch die Schicht – so bleibt eine Galaxie von der Kante ein schmaler heller Strich mit Staubband statt zu verschwinden.
// aP0 = (Seed, Typ 0 Spirale · 1 Ellipse · 2 unregelmäßig · 3 Linse, Armzahl, Steigung), aP1 = (Balkenlänge, Bulge-Radius,
// Staub, Flockigkeit), alles in Einheiten des Scheibenhalbmessers; aSize = Durchmesser, Tönung = Planck-Farbe der Sterne
const PROC_VERT = /* glsl */ `
attribute vec4 aP0, aP1; attribute vec3 aN, aE1, aTint; attribute float aSize, aGain;
uniform float uS; uniform vec2 uNear;
varying vec2 vXY; varying vec3 vC, vN, vE1, vE2, vTint; varying vec4 vP0, vP1; varying float vA, vR;
void main() {
  vec3 c = (modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float R = 0.5 * aSize * uS;
  vXY = position.xy * 4.8 * R;   // Tafel 2,4 Halbmesser je Seite: Platz für Hof und Bulge
  mat3 nm = mat3(modelViewMatrix);
  vN = normalize(nm * aN); vE1 = normalize(nm * aE1); vE2 = cross(vN, vE1);
  vC = c; vR = R; vP0 = aP0; vP1 = aP1; vTint = aTint;
  // nah an der Kamera weich aus: uNear = Abstand in Durchmessern (vorbeiziehende Galaxien füllen nie das ganze Bild)
  float near = smoothstep(uNear.x, uNear.y, -c.z / (2.0 * R));
  vA = aGain * near;
  gl_Position = projectionMatrix * vec4(c + vec3(vXY, 0.0), 1.0);
}`;
const PROC_FRAG = /* glsl */ `
${NOISE}
uniform float uGain, uArmBlue, uFib;   // Einstellungen „Arme blau“, „Staubfasern“ (1 = Look NGC 4536, 0 = ohne)
varying vec2 vXY; varying vec3 vC, vN, vE1, vE2, vTint; varying vec4 vP0, vP1; varying float vA, vR;
void main() {
  if (vA < 0.002) discard;
  float R = vR, seed = vP0.x, type = vP0.y, arms = vP0.z, pitch = vP0.w;
  float bar = vP1.x, bulge = vP1.y, dust = vP1.z, clump = vP1.w;
  float rb = length(vXY) / R;   // Abstand in der Tafel (Bulge, Hof: Projektion ist bei fernen Tafeln die Sichtlinie)
  if (rb > 2.3) discard;
  vec3 P = vC + vec3(vXY, 0.0), v = normalize(P), d = P - vC;
  float cv = dot(v, vN), acv = abs(cv);
  float cvs = cv >= 0.0 ? max(cv, 1e-4) : min(cv, -1e-4);
  float tStar = -dot(d, vN) / cvs;   // Schnitt des Strahls mit der Scheibenebene
  float tNear = -dot(d, v);          // Strahlpunkt mit dem kleinsten Abstand zum Zentrum
  bool ell = type > 0.5 && type < 1.5, irr = type > 1.5 && type < 2.5, lent = type > 2.5;
  float hz = ell ? 0.6 : irr ? 0.22 : lent ? 0.1 : 0.07;   // Dicke (Skalenhöhe) in Halbmessern
  float wEdge = ell ? 1.0 : 1.0 - smoothstep(0.05, 0.35, acv);
  float t = mix(clamp(tStar, tNear - 3.0 * R, tNear + 3.0 * R), tNear, wEdge);
  vec3 X = d + t * v;
  float u = dot(X, vE1) / R, w = dot(X, vE2) / R, h = dot(X, vN) / R;
  float r = length(vec2(u, w));
  float hw = exp(-h * h / (2.0 * hz * hz));                                   // Höhe über der Ebene
  float path = pow((1.0 + hz * hz) / (acv * acv + hz * hz), 0.3);          // Weglänge durch die Schicht (Kante heller)
  vec3 tint = vTint;
  vec3 cDisc = tint * vec3(1.0, 0.96, 0.9), cArm = tint * max(vec3(0.0), mix(vec3(0.8, 0.9, 1.06), vec3(0.55, 0.78, 1.35), uArmBlue)), cBulge = tint * vec3(1.25, 0.82, 0.48);   // Arme blau, Bulge golden wie NGC 4536 (Vorschau 08.11.2026)
  vec3 light = vec3(0.0);
  if (ell) {
    // Ellipse: glattes Sphäroid (abgeplattet entlang aN), warm, ohne Struktur
    float rr = sqrt(u * u + w * w + h * h / (hz * hz)) / max(bulge, 0.05);
    light = cBulge * (pow(1.0 + rr * rr, -1.25) * (1.0 - smoothstep(1.4, 2.6, rr)) + 0.8 * exp(-rr * rr * 20.0));
  } else {
    float disc = exp(-r / 0.3) * (1.0 - smoothstep(0.85, 1.1, r));
    float tex = 1.0, armP = 0.0, gate = 0.0, hii = 0.0, lane = 0.0, dn = 0.0;
    if (r < 1.15) {
      vec3 q = vec3(u, w, seed);
      float n1 = fbm(q * 5.0, 4), n2 = fbm(q * 2.2 + 7.0, 3);
      float rIn = bar > 0.0 ? bar : 0.12;
      float phase = atan(w, u) - log(max(r, 0.03) / rIn) / tan(pitch) + (0.25 + 0.6 * clump) * n2;
      armP = arms > 0.5 ? pow(0.5 + 0.5 * cos(arms * phase), 2.0 + 2.0 * (1.0 - clump)) : 0.0;
      gate = smoothstep(rIn * 0.8, rIn + 0.15, r) * (1.0 - smoothstep(0.75, 1.0, r));
      tex = irr ? max(0.0, 0.3 + 1.5 * (n1 + 0.5 * n2)) : max(0.1, 0.85 + (0.5 + 0.7 * clump) * n1);
      dn = ridged(q * 11.0 + 3.0, 4);   // feine Staubfasern
      lane = pow(0.5 + 0.5 * cos(arms * phase + 1.1), 3.0) * gate * mix(1.0, 0.35 + 0.65 * dn, min(uFib, 1.0));
      hii = smoothstep(0.35, 0.6, fbm(q * 14.0 + 21.0, 2)) * (irr ? disc * tex * 0.6 : armP * gate * disc);
    }
    float armAmp = arms > 0.5 ? mix(0.5, 0.25, clump) : 0.0;
    float dsk = disc * (1.0 - armAmp + 2.0 * armAmp * armP * gate) * tex;
    float barD = bar > 0.0 ? exp(-2.0 * (u * u / (bar * bar) + w * w / (0.08 * bar * bar))) : 0.0;
    // Staub: Bahnen an der Innenkante der Arme + Flecken, bei Neigung auf der zugewandten Hälfte dunkler
    float sinI = sqrt(max(0.0, 1.0 - acv * acv));
    float nearSide = smoothstep(0.15, -0.35, dot(X, v) / R);
    float dustK = dust * (0.4 + 0.6 * sinI) * (0.45 + 0.55 * nearSide);
    float dustF = 1.0 - clamp(1.5 * dustK * (0.85 * lane + 0.7 * uFib * smoothstep(0.3, 0.7, dn) * disc), 0.0, 0.92);
    light = (mix(cDisc, cArm, clamp(armP * gate * 0.75 + smoothstep(0.35, 0.9, r) * 0.6 * min(uArmBlue, 1.0), 0.0, 1.0)) * dsk + cBulge * barD * 1.2 + vec3(1.0, 0.45, 0.9) * hii * 1.3) * hw * path * dustF;
    // Bulge als Sphäroid in der Tafel, Hof der alten Sterne
    float xb = rb / max(bulge, 0.02);
    float bulgeD = irr ? 0.0 : pow(1.0 + xb * xb, -1.6) + 0.6 * exp(-xb * xb * 12.0);
    light += cBulge * bulgeD * (lent ? 1.6 : 1.2) + tint * 0.02 * exp(-rb * 2.0);
    // von der Kante: Staubband durch die Mitte vor Scheibe und Bulge
    float band = wEdge * dust * exp(-pow(h / (0.45 * hz), 2.0)) * smoothstep(0.0, 0.1, r);
    light *= 1.0 - 0.7 * band;
  }
  gl_FragColor = vec4(light * vA * uGain, 1.0);
}`;
// list: { pos, size, gain, tint, n, e1, p0: [seed, type, arms, pitch], p1: [bar, bulge, dust, clump] }
export function galaxyField(list) {
  const n = list.length;
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    vertexShader: PROC_VERT, fragmentShader: PROC_FRAG,
    uniforms: { uS: { value: 1 }, uGain: { value: 1 }, uNear: { value: new THREE.Vector2(0.3, 1.2) }, uArmBlue: { value: 1 }, uFib: { value: 1 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  }), n);
  const p0 = new Float32Array(n * 4), p1 = new Float32Array(n * 4), nn = new Float32Array(n * 3), e1 = new Float32Array(n * 3);
  const tint = new Float32Array(n * 3), size = new Float32Array(n), gain = new Float32Array(n);
  const m = new THREE.Matrix4();
  list.forEach((g, i) => {
    mesh.setMatrixAt(i, m.makeTranslation(g.pos.x, g.pos.y, g.pos.z));
    p0.set(g.p0, i * 4); p1.set(g.p1, i * 4);
    nn.set([g.n.x, g.n.y, g.n.z], i * 3); e1.set([g.e1.x, g.e1.y, g.e1.z], i * 3);
    tint.set(g.tint, i * 3); size[i] = g.size; gain[i] = g.gain;
  });
  const geo = mesh.geometry;
  for (const [k, a, w] of [['aP0', p0, 4], ['aP1', p1, 4], ['aN', nn, 3], ['aE1', e1, 3], ['aTint', tint, 3], ['aSize', size, 1], ['aGain', gain, 1]]) {
    geo.setAttribute(k, new THREE.InstancedBufferAttribute(a, w));
  }
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}
// Zufällige Lage einer Scheibe: Normale gleichverteilt auf der Kugel, e1 senkrecht dazu (Richtung des Balkens)
export function randDisc(rand) {
  const n = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize();
  const a = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const e1 = new THREE.Vector3().crossVectors(n, a).normalize();
  const b = new THREE.Vector3().crossVectors(n, e1);
  const phi = rand() * Math.PI * 2;
  return { n, e1: e1.multiplyScalar(Math.cos(phi)).addScaledVector(b, Math.sin(phi)).normalize() };
}
// Eigenschaften einer Galaxie: Typanteile grob nach dem nahen Universum (Spiralen überwiegen), Tönung aus der Sternpopulation
export function randGalaxy(rand) {
  const t = rand(), type = t < 0.62 ? 0 : t < 0.8 ? 1 : t < 0.9 ? 2 : 3;
  const arms = type === 0 ? (rand() < 0.55 ? 2 : rand() < 0.5 ? 3 : 4) : 0;
  const bar = type === 0 && rand() < 0.6 ? 0.22 + rand() * 0.18 : 0;
  const bulge = type === 1 ? 0.35 + rand() * 0.35 : type === 3 ? 0.3 + rand() * 0.2 : type === 2 ? 0 : 0.08 + rand() * 0.14;
  const dust = type === 0 ? 0.5 + rand() * 0.5 : type === 3 ? 0.25 : type === 2 ? 0.3 : 0;
  const T = type === 1 ? 4300 + rand() * 600 : type === 2 ? 6500 + rand() * 2500 : 5000 + rand() * 1600;
  return {
    p0: [rand() * 100, type, arms, 0.25 + rand() * 0.35], p1: [bar, bulge, dust, type === 2 ? 1 : Math.pow(rand(), 1.5)],
    tint: blackbody(T), ...randDisc(rand),
  };
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
// Helligkeit wie eine Leuchtkraftfunktion: die meisten schwach, wenige hell (keine überstrahlten Flecken); jede Galaxie
// eine eigene Form (galaxyField), gleichmäßig über das Bild verteilt (flybyField)
export function createFlyby() {
  const rand = mulberry32(8);
  const list = [...flybyField(rand), ...deepField(rand)].map((g) => {
    const gal = randGalaxy(rand);
    return { pos: new THREE.Vector3(g.x, g.y, g.z), size: g.size, gain: (0.45 + 1.25 * rand() ** 3) * (gal.p0[1] === 1 ? 0.8 : 1), ...gal };
  });
  const mesh = galaxyField(list), u = mesh.material.uniforms, group = new THREE.Group(), axis = new THREE.Vector3(0, 0, 1);
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
      u.uArmBlue.value = settings.S.flyBlue;
      u.uFib.value = settings.S.flyFib;
      group.visible = true;
    },
    step(e) {
      u.uGain.value = sstep(0, FLYBY.fade[0], e) * (1 - sstep(FLYBY.fade[1], 1, e));
    },
    end() { group.visible = false; },
  };
}
