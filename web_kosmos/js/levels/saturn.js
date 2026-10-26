// Station 02D: Saturn, Ringe und Monde (Einheit 1 Saturnradius = 60.268 km), Abstecher vom Sonnensystem. Saturn als
// abgeplattetes Ellipsoid (Polradius 54.364 km) mit Ringschatten auf dem Planeten, Planetenschatten auf den Ringen und
// Durchlicht der Ringe (planetfx.js), Sonnenrichtung aus der JPL-Bahn für den Zeitpunkt – daraus der Sonnenstand über der
// Ringebene, der über ein Saturnjahr (29,4 Jahre) zwischen ±26,7° wandert. Die großen Monde Mimas bis Titan laufen auf
// den mittleren JPL-Bahnen (kronian.js), werfen Schatten auf Saturn und verschwinden in seinem Schatten. E-Ring als Staub-
// schleier um die Enceladus-Bahn (Modell), Hexagon am Nordpol (Darstellung über der Textur).
// createSaturn, ellipsoidGeometry, bodyUniforms, colorTexture nutzen auch die Mond-Stationen (Saturn am Himmel).

import * as THREE from 'three';
import { julianDate, eclDir } from '../astro.js';
import { createStarfield } from '../stars.js';
import { BODY_VERT, PLANET_FRAG, RING_FRAG, ATMOS } from '../planetfx.js';
import { registerLayers, refreshLayers } from '../layers.js';
import { SATURN, RINGS, MOONS, MOON_IDS, POLE, kronianState, moonScene, saturnSpin, yearToJd, jdToYear } from '../kronian.js';

const R = SATURN.r;
const Y = new THREE.Vector3(0, 1, 0);
// Zeitraffer [Tage je Sekunde]
const SPEEDS = [[0, 'Stopp'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s'], [4, '4 Tage/s']];
// Farben der Monde ohne eigene Karte (Darstellung nach Cassini-Farbbildern; Titan = orangener Dunst)
const MOON_COL = { mimas: 0xc9c4bd, tethys: 0xe9e6e0, dione: 0xd9d6d0, rhea: 0xd2cec8, titan: 0xd39a52 };
const VIS = 6;   // „Anschaulich“: Monde 6-fach vergrößert
const fmtDeg = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Ellipsoid mit Halbachsen a (x), b (y = Pol), c (z): Kugel strecken, Normale ∝ (x/a, y/b, z/c) – so bleibt das Licht
// richtig (mat3(modelMatrix) · normal in BODY_VERT gilt nur ohne ungleiche Skalierung)
export function ellipsoidGeometry(a, b, c, w = 128, h = 64, opt = {}) {
  const g = new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, opt.theta ?? Math.PI);
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    p.setXYZ(i, v.x * a, v.y * b, v.z * c);
    v.set(v.x / a, v.y / b, v.z / c).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeBoundingSphere();
  return g;
}

// Uniforms für PLANET_FRAG (planetfx.js). o: ring + inv (Ringschatten), wrap/term (Terminator), band (Gasriesen-Detail),
// moon + planetPos + shine (Lommel-Seeliger mit Planetenschein), gain
export function bodyUniforms(map, o = {}) {
  return {
    tMap: { value: map }, tNight: { value: null }, tClouds: { value: null }, tSpec: { value: null }, tRing: { value: o.ring ?? null },
    uHasEarth: { value: 0 }, uCloudU: { value: 0 }, uGain: { value: o.gain ?? 1 }, uRing: { value: o.ring ? 1 : 0 },
    uRingIn: { value: RINGS.cIn / R }, uRingOut: { value: RINGS.aOut / R }, uInv: { value: o.inv ?? new THREE.Matrix4() },
    uWrap: { value: o.wrap ?? 0.02 }, uAmb: { value: o.amb ?? 0.025 }, uBand: { value: o.band ?? 0 }, uTime: { value: 0 },
    uMoon: { value: o.moon ? 1 : 0 }, uEarthPos: { value: o.planetPos ?? new THREE.Vector3() }, uEarthshine: { value: o.shine ?? 0 },
    uTerm: { value: new THREE.Vector3(...(o.term ?? [1, 0.85, 0.7])) }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uOcc: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) }, uOccN: { value: 0 }, uSunAng: { value: 5e-4 },
  };
}

// 1×1-Textur einer Farbe (Körper ohne Karte)
export function colorTexture(hex) {
  const c = new THREE.Color(hex).convertLinearToSRGB();
  const t = new THREE.DataTexture(new Uint8Array([c.r * 255, c.g * 255, c.b * 255, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// Rand-Dunst des Ellipsoids: dünner Saum über dem Rand, nur auf der Tagseite, an der Dämmerung wärmer (Darstellung)
const HAZE_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform float uGain;
varying vec3 vN, vP, vO;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0), ndl = dot(N, uSunDir);
  vec3 col = mix(vec3(1.0, 0.55, 0.3), vec3(1.0, 0.86, 0.62), smoothstep(0.0, 0.4, ndl)) * rim * smoothstep(-0.15, 0.35, ndl);
  gl_FragColor = vec4(col * uGain, 1.0);
}
`;
// Hexagon am Nordpol: Strahlstrom als sechseckiges Band (≈ 30.000 km quer, NASA), innen leicht bläulich (Darstellung
// nach Cassini 2012/13), beleuchtet wie die Oberfläche; liegt als Kappe knapp über dem Planeten und dreht mit
const HEX_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform float uOn, uWrap, uR0;
varying vec3 vN, vP, vO;
varying vec2 vUv;
void main() {
  float rho = length(vO.xz), phi = atan(vO.z, vO.x);
  float k = mod(phi + 0.5236, 1.0472) - 0.5236;
  float d = rho * cos(k);
  float band = exp(-pow((d - uR0) / 0.011, 2.0)), inside = 1.0 - smoothstep(uR0 - 0.012, uR0 + 0.01, d);
  float lit = clamp((dot(normalize(vN), uSunDir) + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  float a = (band * 0.5 + inside * 0.22) * uOn * smoothstep(0.0, 0.12, lit);
  if (a < 0.002) discard;
  vec3 col = mix(vec3(0.6, 0.66, 0.72), vec3(0.4, 0.37, 0.32), band) * lit;
  gl_FragColor = vec4(col, a);
}
`;

// Saturn mit Ringen (lokal: Nordpol +y, Ringebene x-z; Einheit 1 = Äquatorradius). group in die Szene hängen, verschieben
// und skalieren erlaubt; frame(sunDir, jd, occ, sunAng) je Bild (occ: bis zu 4 THREE.Vector4 Mitte + Radius, Weltmaß).
export function createSaturn(ctx, { seg = 160 } = {}) {
  const group = new THREE.Group();
  group.quaternion.setFromUnitVectors(Y, new THREE.Vector3(...POLE));
  const inv = new THREE.Matrix4();
  const ringTex = ctx.tex('saturn_ring_alpha.png');
  const a = ATMOS.saturn, f = SATURN.rp / R;
  const planetU = bodyUniforms(ctx.tex('saturn.jpg'), { ring: ringTex, inv, wrap: a.wrap, term: a.term, band: 0.6 });
  const planet = new THREE.Mesh(ellipsoidGeometry(1, f, 1, seg, seg / 2), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: planetU }));
  group.add(planet);
  const hazeU = { uSunDir: planetU.uSunDir, uGain: { value: 0.35 } };
  const haze = new THREE.Mesh(ellipsoidGeometry(1.012, f * 1.012, 1.012, seg / 2, seg / 4), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: HAZE_FRAG, uniforms: hazeU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  group.add(haze);
  const hexU = { uSunDir: planetU.uSunDir, uOn: { value: 1 }, uWrap: { value: a.wrap }, uR0: { value: 0.24 } };
  const hex = new THREE.Mesh(ellipsoidGeometry(1.0015, f * 1.0015, 1.0015, 128, 12, { theta: 0.5 }), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: HEX_FRAG, uniforms: hexU, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  planet.add(hex);
  // Ringe: C-Ring innen bis A-Ring außen, Textur radial (u = Anteil der Ringbreite)
  const r0 = RINGS.cIn / R, r1 = RINGS.aOut / R;
  const g = new THREE.RingGeometry(r0, r1, 512, 1);
  const pos = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - r0) / (r1 - r0), 0.5); }
  g.rotateX(-Math.PI / 2);
  const ringU = { tRing: { value: ringTex }, uCenter: { value: new THREE.Vector3() }, uSunDir: planetU.uSunDir, uR: { value: 1 }, uGain: { value: 1.35 } };
  const ring = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: RING_FRAG, uniforms: ringU, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  group.add(ring);
  const ws = new THREE.Vector3();
  return {
    group, planet, ring, haze, hex, planetU,
    frame(sunDir, jd, occ = [], sunAng = 5e-4) {
      planet.rotation.y = saturnSpin(jd);
      planetU.uSunDir.value.copy(sunDir);
      planetU.uTime.value = jd * 86400 % 1e5 / 3600;
      planetU.uOccN.value = Math.min(occ.length, 4);
      occ.slice(0, 4).forEach((o, i) => planetU.uOcc.value[i].copy(o));
      planetU.uSunAng.value = sunAng;
      group.updateMatrixWorld(true);
      inv.copy(group.matrixWorld).invert();
      group.getWorldScale(ws);
      ringU.uCenter.value.setFromMatrixPosition(group.matrixWorld);
      ringU.uR.value = ws.x;
    },
    dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); },
  };
}

// E-Ring: Staubschleier von 3,0 bis 8,0 Saturnradien, am dichtesten an der Enceladus-Bahn, nach außen dicker; als Schar
// flacher Lagen (Pseudo-Volumen). Feiner Eisstaub streut vor allem nach vorn → hell im Gegenlicht (Modell, Dichte und Dicke geschätzt)
const ERING_VERT = /* glsl */ `
uniform float uLayer;
varying vec3 vP;
varying float vR;
void main() {
  float r = length(position.xz);
  vR = r;
  vec3 p = position + vec3(0.0, uLayer * (0.05 + 0.045 * max(r - 3.95, 0.0)), 0.0);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const ERING_FRAG = /* glsl */ `
uniform vec3 uSunDir, uCenter;
uniform float uLayer, uGain, uR;
varying vec3 vP;
varying float vR;
void main() {
  float dens = smoothstep(2.99, 3.95, vR) * exp(-max(vR - 3.95, 0.0) / 1.5) * (1.0 - smoothstep(7.2, 7.96, vR));
  dens *= exp(-uLayer * uLayer * 1.6);
  vec3 V = normalize(vP - cameraPosition), oc = vP - uCenter;
  float fwd = pow(max(dot(V, uSunDir), 0.0), 6.0);
  float b = dot(oc, uSunDir), sh = (b < 0.0 && dot(oc, oc) - b * b < uR * uR) ? 0.05 : 1.0;
  vec3 col = vec3(0.55, 0.74, 1.0) * dens * (0.12 + 2.6 * fwd) * sh * uGain * 0.05;
  gl_FragColor = vec4(col, 1.0);
}
`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 800);
  scene.add(createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.6, seed: 47 }));
  const stars = scene.children[0];
  const P = new THREE.Vector3(...POLE);
  const jd0 = julianDate(ctx.date);
  let jdBase = jd0, days = 0, spdIdx = 1, playing = !ctx.still, real = false, viewH = 800;
  const jd = () => jdBase + days;
  let st = kronianState(jd0);
  const sunDir = new THREE.Vector3(...st.sun);

  // ---------- Saturn ----------
  const sat = createSaturn(ctx, { seg: Math.round(128 + 64 * ctx.detail) });
  scene.add(sat.group);

  // ---------- Monde: Kugeln mit echtem mittlerem Radius (Anschaulich ×6), gebunden gedreht (Länge 0 zum Saturn) ----------
  const moons = MOON_IDS.map((id) => {
    const m = MOONS[id];
    const map = id === 'enceladus' ? ctx.tex('enceladus.jpg') : colorTexture(MOON_COL[id]);
    const u = bodyUniforms(map, { moon: true, shine: 0.015, gain: id === 'enceladus' ? 1.7 : 1 });
    u.uOccN.value = 1;
    u.uOcc.value[0].set(0, 0, 0, 1);   // Saturn als Verdecker: Mond im Planetenschatten
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: u }));
    scene.add(mesh);
    const line = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color(MOON_COL[id] ?? 0xdde8ff), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(line);
    return { id, m, mesh, u, line, own: map.isDataTexture ? map : null, pos: mesh.position };
  });
  const M = Object.fromEntries(moons.map((x) => [x.id, x]));
  const applySizes = () => moons.forEach((x) => x.mesh.scale.setScalar(x.m.r / R * (real ? 1 : VIS)));
  applySizes();
  function buildOrbits() {
    for (const x of moons) {
      const N = 256, pts = new Float32Array(N * 3);
      for (let k = 0; k < N; k++) {
        const p = moonScene(x.id, jd() + x.m.P * k / N);
        pts.set([p[0] / R, p[1] / R, p[2] / R], k * 3);
      }
      x.line.geometry.dispose();
      x.line.geometry = new THREE.BufferGeometry();
      x.line.geometry.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    }
  }
  buildOrbits();
  // Lichtpunkte der Monde (bleiben aus der Ferne sichtbar, verblassen, sobald die Kugel einige Pixel groß ist)
  const dotG = new THREE.BufferGeometry();
  dotG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(moons.length * 3), 3));
  dotG.setAttribute('color', new THREE.BufferAttribute(new Float32Array(moons.length * 3), 3));
  const glow = glowTexture();
  const dots = new THREE.Points(dotG, new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, map: glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  dots.frustumCulled = false;
  scene.add(dots);

  // ---------- E-Ring ----------
  const eG = new THREE.RingGeometry(2.95, 8.0, 256, 24).rotateX(-Math.PI / 2);
  const eringU = { uSunDir: { value: sunDir }, uCenter: { value: new THREE.Vector3() }, uGain: { value: 1 }, uR: { value: 1 } };
  const ering = new THREE.Group();
  for (let k = -4; k <= 4; k++) {
    ering.add(new THREE.Mesh(eG, new THREE.ShaderMaterial({ vertexShader: ERING_VERT, fragmentShader: ERING_FRAG, uniforms: { ...eringU, uLayer: { value: k / 2 } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide })));
  }
  ering.quaternion.copy(sat.group.quaternion);
  scene.add(ering);

  // ---------- Heimpose: von der beleuchteten Ringseite, Sonne seitlich (Phase ≈ 55°) ----------
  const sp = sunDir.clone().addScaledVector(P, -sunDir.dot(P)).normalize();
  const el = (st.ringSun < 0 ? -1 : 1) * 21 * Math.PI / 180;
  const dir = sp.clone().applyAxisAngle(P, 55 * Math.PI / 180).multiplyScalar(Math.cos(el)).addScaledVector(P, Math.sin(el)).normalize();
  const home = { pos: dir.clone().multiplyScalar(5.2), target: new THREE.Vector3() };
  // Ansae der Ringe aus Sicht der Heimpose
  const ansa = new THREE.Vector3().crossVectors(P, dir).normalize();

  // ---------- Ebenen (Zahnrad „Station · Saturn“, Zeitleiste) ----------
  const fmtYear = (y) => { const b = kronianState(yearToJd(y)).ringSun; return `${Math.floor(y)} · Sonne ${fmtDeg(Math.abs(b))}° ${b < 0 ? 'südlich' : 'nördlich'}`; };
  const fmtDate = () => new Date((jd() - 2440587.5) * 864e5).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  let orbitsOn = true;
  registerLayers('saturn', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Umläufe und Drehung im Zeitraffer', value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, autoplay: !ctx.still, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, p) => { spdIdx = Math.round(i); playing = p; }, get: () => ({ value: spdIdx, playing }),
      status: () => `${fmtDate()} · ${playing ? `Zeitraffer ${SPEEDS[spdIdx][1]}` : 'angehalten'}` },
    { id: 'orbits', type: 'toggle', group: 'Ringe und Monde', label: 'Bahnen der Monde', value: true, set: (v) => { orbitsOn = v; moons.forEach((x) => { x.line.visible = v; }); } },
    { id: 'ering', type: 'toggle', label: 'E-Ring (Eisstaub von Enceladus)', value: true, set: (v) => { ering.visible = v; } },
    { id: 'eringGain', type: 'range', label: 'Helligkeit', value: 1, min: 0.5, max: 4, step: 0.5, unit: '×', sub: true, set: (v) => { eringU.uGain.value = v; } },
    { id: 'hex', type: 'toggle', group: 'Planet', label: 'Hexagon am Nordpol hervorheben', value: true, set: (v) => { sat.hex.visible = v; } },
    { id: 'haze', type: 'toggle', label: 'Dunst am Planetenrand', value: true, set: (v) => { sat.haze.visible = v; } },
  ]);
  // Jahr wechseln: Kamera dreht mit der Sonne um den Pol (gleiche Phase) und wechselt mit ihr die Ringseite – so bleibt die
  // Tagseite im Blick und man sieht, wie sich Sonnenstand und Schatten ändern
  let turn = null;
  function setYear(y) {
    const s0 = sunDir.clone().addScaledVector(P, -sunDir.dot(P)), b0 = st.ringSun;
    jdBase = yearToJd(y); days = 0;
    const st1 = kronianState(jd()), s1 = new THREE.Vector3(...st1.sun);
    s1.addScaledVector(P, -s1.dot(P));
    const ang = Math.atan2(P.dot(new THREE.Vector3().crossVectors(s0, s1)), s0.dot(s1));
    turn = { q: new THREE.Quaternion().setFromAxisAngle(P, ang), flip: Math.sign(b0) !== Math.sign(st1.ringSun) && Math.abs(st1.ringSun) > 0.3 };
    buildOrbits();
    refreshLayers();
  }
  const mirror = (v) => v.addScaledVector(P, -2 * v.dot(P));

  // ---------- Infotafel ----------
  const controls = [
    { id: 'year', type: 'range', label: 'Saturnjahr · Sonnenstand', value: Math.round(jdToYear(jd0) * 4) / 4, min: 2009, max: 2039, step: 0.25, fmt: fmtYear, set: setYear, get: () => Math.round(jdToYear(jd()) * 4) / 4 },
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: playing ? spdIdx : 0, min: 0, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (v) => { if (v) { spdIdx = v; playing = true; } else playing = false; refreshLayers(); }, get: () => (playing ? spdIdx : 0) },
    { id: 'size', label: 'Größe der Monde', value: 'vis', options: [['vis', 'Anschaulich'], ['real', 'Echt']], set: (v) => { real = v === 'real'; applySizes(); } },
  ];

  // ---------- Abzeichen ----------
  const facing = (p, cam) => p.clone().normalize().dot(cam.position.clone().sub(p).normalize());
  const moonFocus = (id) => () => M[id].mesh.scale.x * 9;
  const hs = {
    rings: { id: 'rings', kind: 'info', pos: ansa.clone().multiplyScalar(1.75), focus: () => 3.2 },
    cassini: { id: 'cassini', kind: 'info', pos: ansa.clone().multiplyScalar(-(RINGS.bOut + RINGS.aIn) / 2 / R), focus: () => 2.6 },
    shadow: { id: 'shadow', kind: 'info', pos: new THREE.Vector3(), focus: () => 2.6, visible: (cam) => Math.abs(st.ringSun) > 0.5 && facing(hs.shadow.pos, cam) > 0.1 },
    hexagon: { id: 'hexagon', kind: 'info', pos: new THREE.Vector3(), focus: () => 1.6, visible: (cam) => facing(hs.hexagon.pos, cam) > -0.2 },
    ering: { id: 'ering', kind: 'info', pos: ansa.clone().applyAxisAngle(P, 2.6).multiplyScalar(4.6), focus: () => 7, visible: () => ering.visible },
    titan: { id: 'titan', kind: 'dive', to: 'titan', pos: M.titan.pos, focus: moonFocus('titan') },
    enceladus: { id: 'enceladus', kind: 'info', pos: M.enceladus.pos, focus: moonFocus('enceladus') },
    ...Object.fromEntries(['mimas', 'tethys', 'dione', 'rhea'].map((id) => [id, { id, kind: 'info', pos: M[id].pos, focus: moonFocus(id) }])),
  };
  const hotspots = Object.values(hs);

  // ---------- je Bild ----------
  const occ = Array.from({ length: 4 }, () => new THREE.Vector4()), cand = [];
  const dotC = new THREE.Color(), tmp = new THREE.Vector3(), mx = new THREE.Matrix4(), bx = new THREE.Vector3(), bz = new THREE.Vector3();
  const fovPx = () => viewH / 2 / Math.tan(camera.fov * Math.PI / 360);
  function place(cam) {
    st = kronianState(jd());
    sunDir.set(...st.sun);
    // Schatten der Monde auf Saturn: die (höchstens 4) Monde auf der Sonnenseite, die der Linie Sonne–Saturn am nächsten sind
    cand.length = 0;
    for (const x of moons) {
      x.pos.set(...st.moons[x.id]).multiplyScalar(1 / R);
      const s = x.pos.dot(sunDir), dq = tmp.copy(x.pos).addScaledVector(sunDir, -s).length();
      if (s > 0 && dq < 1.3) cand.push([dq, x]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const nOcc = Math.min(cand.length, 4);
    for (let i = 0; i < nOcc; i++) occ[i].set(cand[i][1].pos.x, cand[i][1].pos.y, cand[i][1].pos.z, cand[i][1].m.r / R);
    sat.frame(sunDir, jd(), occ.slice(0, nOcc), st.sunAng);
    // Monde gebunden wie icymoon.js: −x zum Saturn (Länge 0, Karten u = östliche Länge / 360), +y ≈ Laplace-Pol, −z in Flugrichtung
    const col = dotG.attributes.color, dp = dotG.attributes.position, k = fovPx();
    moons.forEach((x, i) => {
      bx.copy(x.pos).normalize();
      bz.crossVectors(bx, P).normalize();
      mx.makeBasis(bx, tmp.crossVectors(bz, bx), bz);
      x.mesh.quaternion.setFromRotationMatrix(mx);
      x.u.uSunDir.value.copy(sunDir);
      x.u.uSunAng.value = st.sunAng;
      dp.setXYZ(i, x.pos.x, x.pos.y, x.pos.z);
      const px = x.mesh.scale.x / Math.max(cam.position.distanceTo(x.pos), 1e-6) * k;
      const s = x.pos.dot(sunDir), lit = s > 0 ? 1 : 0.08 + 0.92 * THREE.MathUtils.smoothstep(tmp.copy(x.pos).addScaledVector(sunDir, -s).length(), 0.95, 1.05);
      const c = dotC.set(MOON_COL[x.id] ?? 0xffffff).multiplyScalar((1 - THREE.MathUtils.smoothstep(px, 1.5, 5)) * 0.9 * lit);
      col.setXYZ(i, c.r, c.g, c.b);
    });
    col.needsUpdate = true;
    dp.needsUpdate = true;
    // Ringschatten auf dem Planeten: Schatten des B-Rings (r = 1,8) auf der Sonnenseite, entlang des Lichts auf die Kugel
    const sp2 = tmp.copy(sunDir).addScaledVector(P, -sunDir.dot(P)).normalize().multiplyScalar(1.8);
    const b = sp2.dot(sunDir), t = b - Math.sqrt(Math.max(b * b - sp2.lengthSq() + 1, 0));
    hs.shadow.pos.copy(sp2).addScaledVector(sunDir, -t);
    hs.hexagon.pos.copy(P).multiplyScalar(SATURN.rp / R * 1.02);
  }
  place({ position: home.pos });

  const look = { exposure: 1.05, bloom: 0.07 };
  return {
    scene, camera, home, unit: R * 1e3, hotspots, controls, look,
    orbit: { minDistance: 0.02, maxDistance: 80, cineSpeed: 0.35 },
    update(dt, t, cam, flying) {
      if (!flying && playing) days += dt * SPEEDS[spdIdx][0];
      place(cam);
      // Nahebene mit dem Abstand zur nächsten Oberfläche
      let near = cam.position.length() - 1;
      for (const x of moons) near = Math.min(near, cam.position.distanceTo(x.pos) - x.mesh.scale.x);
      const nr = THREE.MathUtils.clamp(near * 0.25, 1e-5, 0.5);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
    },
    // Kamera bleibt außerhalb von Saturn und den Monden
    orbitUpdate(c) {
      if (turn) {
        for (const v of [c.object.position, c.target]) { v.applyQuaternion(turn.q); if (turn.flip) mirror(v); }
        turn = null;
      }
      const p = c.object.position, r = p.length();
      if (r < 1.03) p.multiplyScalar(1.03 / r);
      for (const x of moons) {
        tmp.copy(p).sub(x.pos);
        const d = tmp.length(), m = x.mesh.scale.x * 1.05;
        if (d < m) p.copy(x.pos).addScaledVector(tmp.normalize(), m);
      }
    },
    live: () => `${fmtYear(jdToYear(jd()))} der Ringebene · ${playing ? `Zeitraffer ${SPEEDS[spdIdx][1]}` : 'angehalten'}`,
    setPixelRatio(pr, h) { stars.userData.setPixelRatio(pr); if (h) viewH = h; },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      glow.dispose();
      moons.forEach((x) => x.own && x.own.dispose());
    },
  };
}
