// Station 3: Milchstraße als Modell (Einheit 1 kpc), von Norden gesehen dreht sie im Uhrzeigersinn.
// Sterne: exponentielle Scheibe (Skalenlänge 2,6 kpc, Skalenhöhe 0,3 kpc), Balken (Halblänge 5,0 kpc, 29° gegen die
// Linie Sonne–Zentrum, Wegg et al. 2015) mit Bulge, Spiralarme als logarithmische Spiralen nach den Maser-Parallaxen von Reid et al. 2019
// (Bezugsradius, -azimut, Steigung), junge blaue Sterne und rosa HII-Regionen in den Armen, Staubbahnen an deren
// Innenkante (multiplikativ), diffuses Sternlicht. Stationen an galaktischen Koordinaten (l, b, Entfernung).
// Optional differentielle Rotation im Zeitraffer (flache Rotationskurve ≈ 230 km/s, innen ansteigend).

import * as THREE from 'three';
import { registerLayers } from '../layers.js';
import { galToScene, diskPoint, spiralPhi, mulberry32, gauss, blackbody, KPC } from '../astro.js';
import { pointCloud, volume, disposeScene } from '../vol.js';
import { nebulaVolume } from '../galaxyneb.js';

const RAD = Math.PI / 180;
export const R0 = 8.277, Z_SUN = 0.0208;   // GRAVITY 2022; Bennett & Bovy 2019
const BAR = { half: 5.0, angle: 29, width: 1.5 };   // Wegg et al. 2015
// Arme: rRef [kpc] bei phiRef (= Reid β_kink), Steigung ψ, Spanne in φ (Grad, Drehrichtung positiv), Stärke
export const ARMS = [
  { id: 'scutum', rRef: 4.91, beta: 23, pitch: 13.0, span: [23, -330], w: 1.0, width: 0.38 },
  { id: 'perseus', rRef: 8.87, beta: 40, pitch: 9.4, span: [208, -150], w: 1.0, width: 0.4 },
  { id: 'sagittarius', rRef: 6.04, beta: 24, pitch: 14.0, span: [110, -175], w: 0.6, width: 0.3 },
  { id: 'norma', rRef: 4.6, beta: 200, pitch: 11.5, span: [200, -110], w: 0.6, width: 0.32 },
  { id: 'local', rRef: 8.26, beta: 9, pitch: 11.4, span: [34, -16], w: 0.45, width: 0.22 },
].map((a) => ({ ...a, phiRef: a.beta * RAD }));
const armR = (a, phi) => a.rRef * Math.exp(-(phi - a.phiRef) * Math.tan(a.pitch * RAD));

// Rotationskurve [km/s] und Winkelgeschwindigkeit [rad/Mio. Jahre]: 1 km/s/kpc = 1,0227·10⁻³ rad/Myr
const vRot = (R) => 230 * (1 - Math.exp(-R / 1.2));
const omega = (R) => (vRot(R) / Math.max(R, 0.05)) * 1.0227e-3;

const STAR_VERT = /* glsl */ `
attribute vec3 color;
attribute float size;
attribute float om;
uniform float uPx, uScale, uT;
varying vec3 vCol;
void main() {
  // differentielle Rotation: Azimut wächst in Drehrichtung (Drehung um +y mit −ω t)
  float a = -om * uT;
  float c = cos(a), s = sin(a);
  vec3 p = vec3(position.x * c + position.z * s, position.y, -position.x * s + position.z * c);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = size * uScale / max(-mv.z, 1e-3);   // Bildpixel der Ebene
  float d = clamp(px, 1.2 * uPx, 36.0 * uPx);
  gl_PointSize = d;
  // Energie erhalten: unter einem Pixel wird der Punkt dunkler statt kleiner; nahe der Kamera (ab 20 px) weich
  // ausblenden, damit der Flug durch die Scheibe ein Sternenfeld bleibt und keine Blasen-Wand wird
  float near = 1.0 - smoothstep(20.0 * uPx, 60.0 * uPx, px);
  vCol = color * min(1.0, (px * px) / (d * d) * 4.0) * near;
}
`;
const STAR_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d) * 4.0;
  gl_FragColor = vec4(vCol * exp(-r2 * 3.2), 1.0);
}
`;
const DUST_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d) * 4.0;
  // Absorption: dst × (1 − a); leicht rötlich (blaues Licht wird stärker geschluckt)
  gl_FragColor = vec4(vCol * exp(-r2 * 2.2), 1.0);
}
`;

// Optionen für andere Galaxien (Station Lokale Gruppe): eigene Arme/Ringe, young = false (junge Sterne und HII-Regionen
// liefert dann galaxyfx.js mit Lebenslauf), bar/bulge/diffuse = Anteil von Balken, Bulge und diffusem Licht (1 = Milchstraße)
export function buildGalaxy({ n = 220000, seed = 9, scale = 1, gain = 1, dust = true, faceTilt = 0, arms = ARMS, rings = [], young = true, bar = 1, bulge = 1, diffuse = 1 } = {}) {
  const rand = mulberry32(seed);
  const pos = [], col = [], size = [], om = [];
  const dpos = [], dcol = [], dsize = [], dom = [];
  const push = (arr, x, y, z) => arr.push(x, y, z);
  const add = (p, c, s, k = 1) => {
    push(pos, p[0] * scale, p[1] * scale, p[2] * scale);
    push(col, c[0] * k * gain, c[1] * k * gain, c[2] * k * gain);
    size.push(s * scale);
    om.push(omega(Math.hypot(p[0], p[2])));
  };
  const addDust = (p, a, s) => {
    push(dpos, p[0] * scale, p[1] * scale, p[2] * scale);
    push(dcol, a * 0.75, a * 0.85, a);
    dsize.push(s * scale);
    dom.push(omega(Math.hypot(p[0], p[2])));
  };
  const old = (T) => blackbody(T);
  const expR = (h, max) => { for (;;) { const r = -h * Math.log(1 - rand() * 0.9999); if (r < max) return r; } };
  const armPoint = (a) => {
    const t = rand();
    const phi = (a.span[0] + (a.span[1] - a.span[0]) * t) * RAD;
    // Arme laufen außen aus (sonst schließen sich die langen, flachen Arme optisch zu Ringen)
    return { phi, R: armR(a, phi), fade: Math.min(1, t / 0.08) * Math.min(1, (1 - t) / 0.4) };
  };
  const armDensity = (R, phi) => {
    let d = 0;
    for (const a of arms) {
      // nächster Durchgang des Arms bei diesem Radius (mehrere Windungen)
      const p0 = spiralPhi(R, a);
      let dphi = ((phi - p0) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      const lo = Math.min(a.span[0], a.span[1]) * RAD, hi = Math.max(a.span[0], a.span[1]) * RAD;
      const pa = phi - dphi;
      const inSpan = pa >= lo - 0.4 && pa <= hi + 0.4 ? 1 : 0.25;
      const dist = Math.abs(dphi) * R * Math.sin(a.pitch * RAD + 0.0001) / Math.sin(a.pitch * RAD) * Math.sin(a.pitch * RAD + Math.PI / 2 - a.pitch * RAD);
      d += a.w * inSpan * Math.exp(-((dist / (a.width * (0.7 + R / 12))) ** 2));
    }
    for (const r of rings) d += r.w * Math.exp(-(((R - r.R) / r.width) ** 2));
    return Math.min(1.4, d);
  };

  const N = n;
  // Scheibe: exponentiell, durch die Arme verdichtet
  for (let i = 0; i < N * 0.5; i++) {
    const R = expR(2.6, 17);
    const phi = rand() * Math.PI * 2;
    const ad = armDensity(R, phi);
    if (rand() > 0.28 + 0.72 * Math.min(1, ad)) continue;
    const y = gauss(rand) * (0.12 + R * 0.012);
    const p = diskPoint(R, phi, y);
    const T = ad > 0.5 && rand() < 0.35 ? 7000 + rand() * 12000 : 3600 + rand() * 2800;
    add(p, old(T), 0.035 + rand() * 0.03, 0.22 + ad * 0.25);
  }
  // junge, helle Sterne entlang der Arme
  for (let i = 0; i < (young ? N * 0.22 : 0); i++) {
    const a = arms[Math.floor(rand() * arms.length)];
    if (rand() > a.w) continue;
    const { phi, R, fade } = armPoint(a);
    if (R < 3 || R > 17 || rand() > fade) continue;
    const off = gauss(rand) * a.width * 0.6 * (0.7 + R / 12);
    const p = diskPoint(R + off, phi + gauss(rand) * 0.015, gauss(rand) * 0.06);
    add(p, old(8000 + rand() * 16000), 0.04 + rand() * 0.05, 0.6 + rand() * 0.8);
  }
  // HII-Regionen: rosa Knoten (Hα + Hβ) am Innenrand der Arme
  for (let i = 0; i < (young ? N * 0.006 : 0); i++) {
    const a = arms[Math.floor(rand() * arms.length)];
    const { phi, R, fade } = armPoint(a);
    if (R < 3.2 || R > 15 || rand() > fade) continue;
    const c = diskPoint(R - a.width * 0.25, phi, gauss(rand) * 0.03);
    const k = 2 + Math.floor(rand() * 6);
    for (let j = 0; j < k; j++) add([c[0] + gauss(rand) * 0.06, c[1] + gauss(rand) * 0.02, c[2] + gauss(rand) * 0.06], [1.0, 0.32, 0.48], 0.07 + rand() * 0.07, 0.5 + 0.7 * rand());
  }
  // Balken (dreiachsig, „Erdnuss“) und Bulge aus alten Sternen
  const ba = BAR.angle * RAD;
  const bu = diskPoint(1, ba), bv = diskPoint(1, ba + Math.PI / 2);
  for (let i = 0; i < N * 0.16 * bar; i++) {
    const u = gauss(rand) * BAR.half * 0.42, v = gauss(rand) * 0.55, y = gauss(rand) * (0.28 + 0.25 * Math.exp(-Math.abs(u) / 1.5));
    if (Math.abs(u) > BAR.half * 1.15) continue;
    const p = [bu[0] * u + bv[0] * v, y, bu[2] * u + bv[2] * v];
    add(p, old(3800 + rand() * 1600), 0.04 + rand() * 0.03, 0.35 + 0.6 * Math.exp(-Math.hypot(u, v) / 1.2));
  }
  for (let i = 0; i < N * 0.06 * bulge; i++) {
    const r = expR(0.45, 3);
    const d = new THREE.Vector3(gauss(rand), gauss(rand) * 0.7, gauss(rand)).normalize().multiplyScalar(r);
    add([d.x, d.y, d.z], old(4000 + rand() * 1200), 0.045, 0.6 + 0.8 * Math.exp(-r / 0.5));
  }
  // diffuses Licht der unaufgelösten Sterne
  for (let i = 0; i < N * 0.03 * diffuse; i++) {
    const R = expR(3.0, 15), phi = rand() * Math.PI * 2;
    const ad = armDensity(R, phi);
    add(diskPoint(R, phi, gauss(rand) * 0.1), old(5200), 0.7 + rand() * 0.6, 0.009 + ad * 0.008);
  }
  if (bulge) add([0, 0, 0], old(4600), 3.2, 0.06 * bulge);
  // Staub: Innenkante der Arme + dünne Schicht der Scheibe
  if (dust) {
    for (let i = 0; i < N * 0.09; i++) {
      const a = arms[Math.floor(rand() * arms.length)];
      const { phi, R, fade } = armPoint(a);
      if (R < 2.8 || R > 16 || rand() > fade) continue;
      const p = diskPoint(R - a.width * (0.45 + gauss(rand) * 0.18) * (0.7 + R / 12), phi, gauss(rand) * 0.03);
      addDust(p, (0.12 + rand() * 0.18) * a.w, 0.16 + rand() * 0.18);
    }
    for (let i = 0; i < N * 0.03; i++) {
      const R = expR(3.5, 14), phi = rand() * Math.PI * 2;
      addDust(diskPoint(R, phi, gauss(rand) * 0.04), 0.05 + rand() * 0.06, 0.4);
    }
    // Ringe: Staub am Innenrand
    for (const r of rings) {
      for (let i = 0; i < N * 0.03 * r.w; i++) addDust(diskPoint(r.R + (-0.75 + gauss(rand) * 0.3) * r.width, rand() * Math.PI * 2, gauss(rand) * 0.03), (0.12 + rand() * 0.18) * r.w, 0.16 + rand() * 0.18);
    }
  }

  const mk = (P, Cc, S, O, frag, blending) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    g.setAttribute('size', new THREE.Float32BufferAttribute(S, 1));
    g.setAttribute('om', new THREE.Float32BufferAttribute(O, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT, fragmentShader: frag, uniforms: { uPx: { value: 1 }, uScale: { value: 600 }, uT: { value: 0 } },
      depthWrite: false, transparent: true, ...blending,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    return pts;
  };
  const group = new THREE.Group();
  const stars = mk(pos, col, size, om, STAR_FRAG, { blending: THREE.AdditiveBlending });
  group.add(stars);
  const mats = [stars.material];
  if (dust && dpos.length) {
    const d = mk(dpos, dcol, dsize, dom, DUST_FRAG, {
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcColorFactor,
    });
    d.renderOrder = 2;
    group.add(d);
    mats.push(d.material);
  }
  group.rotation.x = faceTilt;
  group.userData.mats = mats;
  group.userData.setPx = (pr, H, fov) => mats.forEach((m) => { m.uniforms.uPx.value = pr; m.uniforms.uScale.value = (H / 2) / Math.tan(fov * RAD / 2); });
  return group;
}

// Kugelsternhaufen (Harris 1996/2010): die zehn bekanntesten an ihren galaktischen Koordinaten (l, b, d [kpc]) + ein
// statistischer Halo (≈ 150 bekannt, Dichte ∝ r⁻³·⁵, Hälfte innerhalb ≈ 5 kpc); Halo-Sterne ∝ r⁻³ bis 50 kpc
export const GLOBULARS = [
  ['omega', 'ω Centauri', 309.10, 14.97, 5.2], ['47tuc', '47 Tucanae', 305.89, -44.89, 4.5], ['m13', 'M13', 59.01, 40.91, 7.1],
  ['m22', 'M22', 9.89, -7.55, 3.2], ['m4', 'M4', 350.97, 15.97, 2.2], ['m5', 'M5', 3.86, 46.80, 7.5], ['m15', 'M15', 65.01, -27.31, 10.4],
  ['m3', 'M3', 42.22, 78.71, 10.2], ['m2', 'M2', 53.37, -35.77, 11.5], ['m92', 'M92', 68.34, 34.86, 8.3],
];
export function buildHalo(det, rand) {
  const pos = [], col = [], size = [];
  const put = (x, y, z, T, k, s) => { pos.push(x, y, z); col.push(...blackbody(T).map((v) => v * k)); size.push(s); };
  const cluster = (c, n, r, k) => { for (let i = 0; i < n; i++) put(c.x + gauss(rand) * r, c.y + gauss(rand) * r, c.z + gauss(rand) * r, 4700 + rand() * 900, k * (0.5 + rand()), 0.06); };
  for (const [, , l, b, d] of GLOBULARS) cluster(new THREE.Vector3(...galToScene(l, b, d, R0, Z_SUN)), Math.round(26 * det) + 6, 0.07, 2.2);
  // Halo-Haufen: r aus N(<r) ∝ r⁻⁰·⁵ zwischen 1,5 und 40 kpc, leicht abgeplattet
  for (let i = 0; i < 140; i++) {
    const u = rand();
    const r = Math.pow(Math.pow(1.5, -0.5) - u * (Math.pow(1.5, -0.5) - Math.pow(40, -0.5)), -2);
    const dir = new THREE.Vector3(gauss(rand), gauss(rand) * 0.8, gauss(rand)).normalize().multiplyScalar(r);
    cluster(dir, Math.round(14 * det) + 4, 0.05, 1.2);
  }
  // alte Halo-Sterne, dünn und rötlich
  for (let i = 0; i < Math.round(9000 * det); i++) {
    const u = rand();
    const r = Math.pow(Math.pow(2, -1) - u * (Math.pow(2, -1) - Math.pow(50, -1)), -1);   // N(<r) ∝ r⁻¹ (ρ ∝ r⁻³)
    const dir = new THREE.Vector3(gauss(rand), gauss(rand) * 0.85, gauss(rand)).normalize().multiplyScalar(r);
    put(dir.x, dir.y, dir.z, 3900 + rand() * 1200, 0.22 + rand() * 0.3, 0.045);
  }
  return pointCloud(pos, col, size, { min: 1.1, max: 24, fade: 16 });
}

// Fermi-Blasen (Su, Slatyer & Finkbeiner 2010): zwei Gammastrahlen-Lappen ≈ 50° über und unter dem Zentrum, von der
// Sonne aus gesehen ≈ 8 kpc hoch; hier als weiche Lappen mit gezackten Rändern (Falschfarbe, Darstellung)
const FERMI_BODY = /* glsl */ `
uniform float uGain;
void sampleVol(vec3 p, out vec3 e, out float s) {
  s = 0.0;
  float side = sign(p.y);
  vec3 c = vec3(0.0, side * 4.4, 0.0);
  vec3 q = (p - c) / vec3(3.0, 4.4, 3.0);
  float r = length(q);
  float n = fbm(p * 0.45 + vec3(1.0, 3.0, 7.0), 4);
  float edge = smoothstep(1.05 + n * 0.25, 0.55 + n * 0.2, r);
  float rim = smoothstep(0.35, 0.95, r) * edge;
  float waist = smoothstep(0.0, 1.2, abs(p.y));   // am Zentrum eingeschnürt
  e = (vec3(0.55, 0.25, 0.9) * rim * 0.9 + vec3(0.25, 0.12, 0.5) * edge * 0.25) * waist * uGain;
}
`;

// Leuchtmarke für Stationen (weicher Punkt mit Farbe)
function marker(color, s, k = 1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new THREE.Color(color).toArray().map((v) => v * k), 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute([s], 1));
  g.setAttribute('om', new THREE.Float32BufferAttribute([0], 1));
  const m = new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: { uPx: { value: 1 }, uScale: { value: 600 }, uT: { value: 0 } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.005, 400);
  const gal = buildGalaxy({ n: Math.round(260000 * ctx.detail), dust: false });
  scene.add(gal);
  // Gas und Staub als 3D-Nebel (Vorschau 28.10.2026 Nebel:A) statt Staub-Punkten (die machten im Zentrum einen dunklen Fleck)
  const neb = nebulaVolume(ctx.renderer, { arms: ARMS, detail: ctx.detail });
  scene.add(neb.object);
  const halo = buildHalo(ctx.detail, mulberry32(17));
  scene.add(halo);
  const fermi = volume({ radius: 10.5, body: FERMI_BODY, steps: Math.round(28 + 20 * ctx.detail), uniforms: { uGain: { value: 0.09 } } });
  fermi.renderOrder = 3;
  fermi.visible = false;
  scene.add(fermi);

  const sun = new THREE.Vector3(...galToScene(0, 0, 0, R0, Z_SUN));
  const orion = new THREE.Vector3(...galToScene(209.01, -19.38, 0.390, R0, Z_SUN));
  const crab = new THREE.Vector3(...galToScene(184.56, -5.78, 1.90, R0, Z_SUN));
  const sgra = new THREE.Vector3(...galToScene(359.944, -0.046, R0, R0, Z_SUN));
  const pillars = new THREE.Vector3(...galToScene(16.95, 0.79, 1.99, R0, Z_SUN));   // M16, 6.500 Lj (ESA/Webb)
  const butterfly = new THREE.Vector3(...galToScene(349.51, 1.06, 1.165, R0, Z_SUN));   // NGC 6302, 3.800 Lj (Hubble)
  const spider = new THREE.Vector3(...galToScene(10.10, 0.74, 1.8, R0, Z_SUN));   // NGC 6537 (Kastner 2025)
  const tornado = new THREE.Vector3(...galToScene(297.22, -15.86, 0.193, R0, Z_SUN));   // HH 49/50, 630 Lj (ESA/Webb)
  const marks = [
    [sun, 0xffe2a8, 0.05, 6], [orion, 0xff7aa0, 0.07, 5], [crab, 0xb8d4ff, 0.06, 5], [sgra, 0xfff1dd, 0.06, 8], [spider, 0xff6a5a, 0.05, 5],
    [pillars, 0xffb070, 0.05, 5],
    [butterfly, 0xffa060, 0.05, 5],
    [tornado, 0xff9a5a, 0.05, 5],
  ].map(([p, c, s, k]) => { const m = marker(c, s, k); m.position.copy(p); scene.add(m); return { m, p, base: p.clone() }; });

  // Sonnenbahn (Kreis mit R0, ≈ 220 Mio. Jahre Umlauf) und Sichtlinien Sonne → Stationen (schaltbar)
  const lineMat = (c, o) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const ringPts = [];
  for (let i = 0; i <= 360; i++) ringPts.push(new THREE.Vector3(...diskPoint(R0, (i / 360) * Math.PI * 2, Z_SUN)));
  const sunOrbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts), lineMat(0xffe2a8, 0.22));
  sunOrbit.visible = false;
  scene.add(sunOrbit);
  const sight = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([sun, orion, sun, crab, sun, sgra]), lineMat(0xa9d4ff, 0.45));
  sight.visible = false;
  scene.add(sight);

  const sc = ARMS.find((a) => a.id === 'scutum'), pe = ARMS.find((a) => a.id === 'perseus'), sg = ARMS.find((a) => a.id === 'sagittarius'), no = ARMS.find((a) => a.id === 'norma'), lo = ARMS.find((a) => a.id === 'local');
  const at = (a, deg) => new THREE.Vector3(...diskPoint(armR(a, deg * RAD), deg * RAD));
  const omegaCen = new THREE.Vector3(...galToScene(309.10, 14.97, 5.2, R0, Z_SUN));
  const hotspots = [
    { id: 'sun', kind: 'dive', to: 'solar', pos: marks[0].p },
    { id: 'orion', kind: 'dive', to: 'orion', pos: marks[1].p },
    { id: 'crab', kind: 'dive', to: 'crab', pos: marks[2].p },
    { id: 'sgra', kind: 'dive', to: 'sgra', pos: marks[3].p },
    { id: 'pillars', kind: 'dive', to: 'pillars', pos: pillars },
    { id: 'spider', kind: 'dive', to: 'spider', pos: marks[4].p },
    { id: 'tornado', kind: 'dive', to: 'tornado', pos: tornado },
    { id: 'butterfly', kind: 'dive', to: 'butterfly', pos: butterfly },
    { id: 'bar', kind: 'info', pos: new THREE.Vector3(...diskPoint(BAR.half * 0.9, BAR.angle * RAD)) },
    { id: 'omega', kind: 'info', pos: omegaCen, focus: () => 1.2 },
    { id: 'halo', kind: 'info', pos: new THREE.Vector3(9, 13, -11) },
    { id: 'sunorbit', kind: 'info', pos: new THREE.Vector3(...diskPoint(R0, -0.55, Z_SUN)), visible: () => sunOrbit.visible },
    { id: 'fermi', kind: 'info', pos: new THREE.Vector3(0.5, 7.5, 1.5), visible: () => fermi.visible },
    { id: 'perseus', kind: 'label', pos: at(pe, -40) },
    { id: 'scutum', kind: 'label', pos: at(sc, -150) },
    { id: 'sagittarius', kind: 'label', pos: at(sg, -60) },
    { id: 'norma', kind: 'label', pos: at(no, 60) },
    { id: 'localarm', kind: 'label', pos: at(lo, 20) },
  ];
  const armMarks = hotspots.filter((h) => h.kind === 'label' || h.id === 'bar').map((h) => ({ p: h.pos, base: h.pos.clone() }));

  // Zeitraffer der Drehung: Stationen drehen mit ihrer eigenen Winkelgeschwindigkeit mit
  let T = 0, rate = 0;
  const spinAll = () => {
    for (const k of [...marks, ...armMarks]) {
      const R = Math.hypot(k.base.x, k.base.z);
      k.p.copy(k.base).applyAxisAngle(new THREE.Vector3(0, 1, 0), -omega(R) * T);
      if (k.m) k.m.position.copy(k.p);
    }
  };
  // Zahnrad: Teile der Galaxis, Tempo des Zeitraffers, Helligkeit der Fermi-Blasen (die Schalter dazu stehen im Reiter Station unter Ansicht)
  let spinK = 1;
  const num = (v) => String(v).replace('.', ',');
  const nebOnly = { active: () => neb.object.visible, only: 'Wirkt, solange „Gas und Staub als 3D-Nebel“ an ist.' };
  registerLayers('galaxy', [
    { id: 'halo', type: 'toggle', group: 'Milchstraße', label: 'Halo mit Kugelsternhaufen', value: true, set: (v) => { halo.visible = v; } },
    { id: 'marks', type: 'toggle', label: 'Leuchtpunkte der Stationen', value: true, set: (v) => marks.forEach((k) => { k.m.visible = v; }) },
    { id: 'spinK', type: 'range', group: 'Drehung', label: 'Tempo im Zeitraffer', value: 1, min: 0.25, max: 20, step: 0.25, fmt: (v) => `${num(v)} Mio. Jahre/s`,
      set: (v) => { spinK = v; if (rate) rate = v; }, active: () => rate > 0, only: 'Wirkt, sobald unter Zeigen „Drehung“ auf Zeitraffer steht.' },
    { id: 'neb', type: 'toggle', group: 'Nebel', label: 'Gas und Staub als 3D-Nebel', value: true,
      set: (v) => neb.setOn(v) },
    { id: 'nebGas', type: 'range', sub: true, label: 'Leuchten des Gases', value: 1, min: 0, max: 2, step: 0.1, unit: '×', set: (v) => neb.setGas(v), ...nebOnly },
    { id: 'nebDust', type: 'range', sub: true, label: 'Staub', value: 1, min: 0, max: 2, step: 0.1, unit: '×', set: (v) => neb.setDust(v), ...nebOnly },
    { id: 'nebGlim', type: 'toggle', sub: true, label: 'Glimmen der Gaswolken', value: true, set: (v) => neb.setGlim(v), ...nebOnly },
    { id: 'fermiGain', type: 'range', group: 'Fermi-Blasen', label: 'Helligkeit', value: 1, min: 0.25, max: 5, step: 0.25, unit: '×',
      set: (v) => { fermi.material.uniforms.uGain.value = 0.09 * v; }, active: () => fermi.visible, only: 'Erst im Reiter Station unter Ansicht „Fermi-Blasen“ einschalten.' },
  ]);
  const controls = [
    { id: 'spin', label: 'Drehung', show: true, value: 'off', options: [['off', 'Stand heute'], ['on', 'Zeitraffer']], set: (v) => { rate = v === 'on' ? spinK : 0; } },
    { id: 'lines', label: 'Linien', value: 'off', options: [['off', 'Aus'], ['on', 'Sonnenbahn + Sichtlinien']], set: (v) => { sunOrbit.visible = sight.visible = v === 'on'; } },
    { id: 'fermi', label: 'Fermi-Blasen', value: 'off', options: [['off', 'Aus'], ['on', 'Gammastrahlung']], set: (v) => { fermi.visible = v === 'on'; } },
  ];

  return {
    scene, camera, unit: KPC, hotspots, controls,
    ready: neb.ready,
    home: { pos: new THREE.Vector3(-14, 21, 19), target: new THREE.Vector3(-1.2, 0, 0.6) },
    orbit: { minDistance: 0.25, maxDistance: 80, cineSpeed: 0.5 },
    look: { exposure: 1.1, bloom: 0.09, sat: 1.1, con: 0.14 },
    update(dt, t, cam, flying) {
      if (!flying && rate) { T += dt * rate; spinAll(); }
      for (const m of gal.userData.mats) m.uniforms.uT.value = T;
      fermi.material.uniforms.uTime.value = t;
      neb.update(t, T, cam);
    },
    live: () => (T > 0 ? `Seit heute: ${T.toFixed(0).replace('.', ',')} Mio. Jahre · Sonne ${(omega(R0) * T / RAD).toFixed(1).replace('.', ',')}° weiter` : 'Stand heute · Sonne auf Kurs in Richtung Schwan (Cygnus) · 150 Kugelsternhaufen im Halo'),
    setPixelRatio(pr, H) {
      gal.userData.setPx(pr, H, camera.fov);
      halo.userData.setPx(pr, H, camera.fov);
      neb.setSize(Math.round(H * camera.aspect), H);
      marks.forEach((k) => { k.m.material.uniforms.uPx.value = pr; k.m.material.uniforms.uScale.value = (H / 2) / Math.tan(camera.fov * RAD / 2); });
    },
    dispose: () => { disposeScene(scene); neb.dispose(); },
  };
}
