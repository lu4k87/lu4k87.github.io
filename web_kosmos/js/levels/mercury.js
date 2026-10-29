// Station 02I: Merkur (Einheit 1 Merkurradius = 2.439,7 km), Abstecher vom Sonnensystem. Kugel mit der Karte von Solar System
// Scope (MESSENGER-Mosaik, Länge 0° in der Bildmitte, geprüft an Kuiper, Raditladi, Hokusai), gedreht nach dem Nullmeridian der
// IAU; Sonnenrichtung und -abstand aus der JPL-Bahn (inner.js). 3:2-Kopplung: zwei Umläufe = drei Drehungen, im Perihel steht
// die Sonne über 0° oder 180° Länge (heiße Pole). Die Sonne steht im Bild fest, Planet und Sterne drehen um die Bahnachse (Tagseite
// bleibt im Bild); so sieht man im Zeitraffer, wie die Sonne über dem Boden kurz rückwärts läuft, wenn Merkur am Perihel schneller um
// die Sonne zieht, als er sich dreht. Ebenen: Wärmebild (Modell aus Sonnenabstand und Zenitwinkel), Natriumschweif (Teilchen,
// Stärke nach der Radialgeschwindigkeit, Modell), Magnetfeld (Dipol 484 km nach Norden versetzt, Schema). Sonne als Scheibe in
// echter Winkelgröße (2,1- bis 3,2-mal so breit wie von der Erde). planetFrame, createSun, sunFixed und homePose nutzt auch levels/venus.js.

import * as THREE from 'three';
import { julianDate, eclDir, hideBehind } from '../astro.js';
import { createStarfield } from '../stars.js';
import { BODY_VERT, PLANET_FRAG } from '../planetfx.js';
import { NOISE } from '../glsl.js';
import { registerLayers, refreshLayers } from '../layers.js';
import { bodyUniforms } from './saturn.js';
import { dirLL } from './mars.js';
import { INNER, innerState, nextAnomaly, poleOf, nodeOf, spinOf, subsolarT, T_NIGHT } from '../inner.js';
import { spinAxis } from '../axes.js';

const RAD = Math.PI / 180;
// Zeitraffer [Tage je Sekunde]
const SPEEDS = [[0, 'Stopp'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s'], [4, '4 Tage/s'], [16, '16 Tage/s']];
export const SUN_D = 3000;          // Abstand der Sonnenscheibe [Planetenradien], nur Darstellung
const OFFSET = 484 / 2439.7;         // Dipol nach Norden versetzt (Anderson et al. 2011)
const TAIL_LEN = 40;                 // Natriumschweif im Bild [Merkurradien]; echt ≈ 1.400 (Baumgardner et al. 2008)
const fmtDeg = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtDate = (jd) => new Date((jd - 2440587.5) * 864e5).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

// Gruppe im Planetensystem: x = Knoten des Äquators, y = Nordpol (inner.js); spin dreht um y mit W
export function planetFrame(id) {
  const group = new THREE.Group(), spin = new THREE.Group();
  const P = new THREE.Vector3(...poleOf(id)), N = new THREE.Vector3(...nodeOf(id));
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(N, P, N.clone().cross(P)));
  group.add(spin);
  return { group, spin, P };
}

function discTexture(soft) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (soft) {
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.35)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.42, 'rgba(255,255,255,1)');   // Scheibe bis Radius 0,5 mit leichter Randverdunkelung
    grd.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.56, 'rgba(255,255,255,0)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
  }
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Sonne am Himmel: Scheibe in echter Winkelgröße + Lichthof (Darstellung), in Sonnenrichtung im Abstand SUN_D
export function createSun() {
  const disc = discTexture(false), soft = discTexture(true);
  const group = new THREE.Group();
  const mat = (map, color, opacity) => new THREE.SpriteMaterial({ map, color, opacity, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const core = new THREE.Sprite(mat(disc, 0xfff6e8, 1)), halo = new THREE.Sprite(mat(soft, 0xffe2b0, 0.55));
  group.add(halo, core);
  return {
    group,
    update(sunDir, sunAng) {
      group.position.copy(sunDir).multiplyScalar(SUN_D);
      const d = 2 * SUN_D * Math.tan(sunAng);   // Durchmesser der Scheibe; die Textur füllt die halbe Sprite-Breite
      core.scale.setScalar(d * 2);
      halo.scale.setScalar(d * 14);
    },
    dispose() { disc.dispose(); soft.dispose(); },
  };
}

// Bezugssystem mit fester Sonne: Planet und Sterne drehen um die Bahnachse, die Tagseite bleibt im Bild (die Kamera führt
// die Leerlauf-Fahrt in main.js). Sterne über einen Einschub in skyPosition() wie in icymoon.js. rot(s) → Drehung, die die
// echte Sonnenrichtung s auf die feste legt; zugleich Drehung des Sternhimmels.
export function sunFixed(stars, id, jd0) {
  const s0 = new THREE.Vector3(...innerState(id, jd0).sun), n = s0.clone().cross(new THREE.Vector3(...innerState(id, jd0 + 1).sun)).normalize();
  const skyRot = { value: new THREE.Matrix3() };
  stars.traverse((o) => {
    const m = o.material;
    if (!m || !m.vertexShader || !m.vertexShader.includes('= skyPosition(')) return;
    m.vertexShader = m.vertexShader.replace(/= skyPosition\(/g, '= skyPosition(uSkyRot * ').replace('void main', 'uniform mat3 uSkyRot;\nvoid main');
    m.uniforms.uSkyRot = skyRot;
    m.needsUpdate = true;
  });
  const q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), v = new THREE.Vector3(), w = new THREE.Vector3();
  return {
    sun: s0,
    rot(s) {
      v.copy(s).addScaledVector(n, -s.dot(n)).normalize();
      q.setFromAxisAngle(n, Math.atan2(n.dot(w.crossVectors(v, s0)), v.dot(s0)));
      skyRot.value.setFromMatrix4(m4.makeRotationFromQuaternion(q));
      return q;
    },
  };
}

// Heimpose: Tagseite schräg von der Seite (Phase phase°), etwas über dem Äquator
export function homePose(sunDir, P, phase, dist, lift = 14) {
  const sp = sunDir.clone().addScaledVector(P, -sunDir.dot(P)).normalize();
  const dir = sp.clone().applyAxisAngle(P, phase * RAD).multiplyScalar(Math.cos(lift * RAD)).addScaledVector(P, Math.sin(lift * RAD)).normalize();
  const side = new THREE.Vector3().crossVectors(P, dir).normalize();
  return { pos: dir.clone().multiplyScalar(dist), target: side.multiplyScalar(dist * 0.11) };
}

// Oberfläche: PLANET_FRAG (Mondpfad: Lommel-Seeliger, ohne Atmosphäre) mit Feinstruktur beim Heranzoomen und Wärmebild
// (uTemp): T = Tss · cos^¼ z auf der Tagseite, Nachtseite kühlt zum Morgen auf ≈ 100 K (Modell), Farbskala 80 … 720 K
const MERC_ALB = /* glsl */ `
vec3 mercAlb(vec3 t) {
  float fade = 1.0 - smoothstep(0.0008, 0.003, length(fwidth(vO)));
  if (fade > 0.0) t *= 1.0 + (fbm(vO * 160.0, 3) * 0.2 + fbm(vO * 900.0, 2) * 0.1) * fade;
  return t;
}
vec3 heat(float x) {
  x = clamp(x, 0.0, 1.0);
  vec3 c = mix(vec3(0.04, 0.06, 0.32), vec3(0.42, 0.1, 0.55), smoothstep(0.0, 0.18, x));
  c = mix(c, vec3(0.86, 0.16, 0.12), smoothstep(0.16, 0.42, x));
  c = mix(c, vec3(1.0, 0.5, 0.08), smoothstep(0.4, 0.64, x));
  c = mix(c, vec3(1.0, 0.82, 0.25), smoothstep(0.62, 0.84, x));
  return mix(c, vec3(1.0, 0.97, 0.82), smoothstep(0.86, 1.0, x));
}`;
const MERC_FRAG = [
  ['uniform sampler2D tMap,', 'uniform float uTemp, uTss, uTn;\nuniform sampler2D tMap,'],
  ['void main() {', `${MERC_ALB}\nvoid main() {`],
  ['vec3 alb = texture2D(tMap, uv).rgb', 'vec3 alb = mercAlb(texture2D(tMap, uv).rgb)'],
  ['  gl_FragColor = vec4(col * uGain, 1.0);', `  if (uTemp > 0.0) {
    float tDay = uTss * pow(max(ndl, 1e-4), 0.25), tNight = uTn + 70.0 * exp(ndl * 7.0);
    float T = mix(tNight, max(tDay, tNight), smoothstep(-0.03, 0.03, ndl));
    float g = dot(alb, vec3(0.299, 0.587, 0.114));
    col = mix(col, heat((T - 80.0) / 640.0) * (0.62 + 0.9 * g), uTemp);
  }
  gl_FragColor = vec4(col * uGain, 1.0);`],
].reduce((s, [a, b]) => {
  if (!s.includes(a)) throw new Error(`mercury.js: PLANET_FRAG ohne „${a}“ – Einschub anpassen`);
  return s.replace(a, b);
}, PLANET_FRAG);

// Natriumschweif: Teilchen strömen gegen die Sonne nach außen, Fächer weitet sich, Licht der Na-D-Linien (589 nm)
const TAIL_VERT = /* glsl */ `
attribute vec3 aSeed;
uniform vec3 uAnti, uU, uV;
uniform float uTime, uLen, uGain, uSize;
varying float vA;
void main() {
  float s = fract(aSeed.x + uTime * 0.02);
  float x = 0.9 + s * uLen;
  float w = (0.45 + 0.16 * s * uLen) * sqrt(aSeed.y);
  float a = aSeed.z * 6.2831853;
  vec3 p = uAnti * x + (uU * cos(a) + uV * sin(a)) * w;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uSize / max(-mv.z, 1e-3), 2.0, 28.0);
  vA = uGain * 0.08 * pow(1.0 - s, 1.8) * smoothstep(0.0, 0.03, s) * (1.0 - 0.6 * aSeed.y);
}`;
const TAIL_FRAG = /* glsl */ `
varying float vA;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = dot(q, q) * 4.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(vec3(1.0, 0.76, 0.3) * vA * exp(-r * 3.5), 1.0);
}`;

// Feldlinien des versetzten Dipols (Schema, ohne Sonnenwind): r = L · cos² λ um die Mitte des Dipols
function fieldLines() {
  const pts = [];
  for (const L of [1.45, 1.85, 2.4]) {
    for (let k = 0; k < 12; k++) {
      const ph = (k / 12) * Math.PI * 2;
      let prev = null;
      for (let i = 0; i <= 96; i++) {
        const lam = -Math.PI / 2 + (i / 96) * Math.PI, r = L * Math.cos(lam) ** 2;
        const p = new THREE.Vector3(r * Math.cos(lam) * Math.cos(ph), r * Math.sin(lam) + OFFSET, r * Math.cos(lam) * Math.sin(ph));
        const out = p.length() > 1.01;
        if (prev && out) pts.push(prev, p);
        prev = out ? p : null;
      }
    }
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 6000);
  scene.add(createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.6, seed: 23, tex: ctx.tex }));
  const stars = scene.children[0];
  const jd0 = julianDate(ctx.date);
  let jdBase = jd0, days = 0, spdIdx = 3, playing = !ctx.still, viewH = 800, t = 0, temp = 0;
  const jd = () => jdBase + days;
  let st = innerState('mercury', jd0);
  const fix = sunFixed(stars, 'mercury', jd0), sunDir = fix.sun, real = new THREE.Vector3();

  // ---------- Merkur ----------
  const { group, spin, P } = planetFrame('mercury');
  const Q0 = group.quaternion.clone();
  scene.add(group);
  const map = ctx.tex(ctx.detail >= 0.8 ? 'mercury_4k.jpg' : 'mercury.jpg');
  const u = bodyUniforms(map, { moon: true, amb: 0.015 });
  Object.assign(u, { uTemp: { value: 0 }, uTss: { value: subsolarT(st.au) }, uTn: { value: T_NIGHT } });
  const seg = Math.round(128 + 96 * ctx.detail);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, seg, seg / 2), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: MERC_FRAG, uniforms: u }));
  spin.add(planet);
  spinAxis(planet);

  // ---------- Sonne, Natriumschweif, Magnetfeld ----------
  const sun = createSun();
  scene.add(sun.group);
  const nTail = Math.round(9000 + 9000 * ctx.detail), rnd = Float32Array.from({ length: nTail * 3 }, () => Math.random());
  const tailG = new THREE.BufferGeometry();
  tailG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nTail * 3), 3));
  tailG.setAttribute('aSeed', new THREE.BufferAttribute(rnd, 3));
  const tailU = { uAnti: { value: new THREE.Vector3() }, uU: { value: new THREE.Vector3() }, uV: { value: new THREE.Vector3() }, uTime: { value: 0 }, uLen: { value: TAIL_LEN }, uGain: { value: 0.5 }, uSize: { value: 4 } };
  const tail = new THREE.Points(tailG, new THREE.ShaderMaterial({ vertexShader: TAIL_VERT, fragmentShader: TAIL_FRAG, uniforms: tailU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  tail.frustumCulled = false;
  scene.add(tail);
  let tailGain = 1;
  const field = fieldLines();
  field.visible = false;
  group.add(field);

  // ---------- Heimpose: Tagseite schräg von der Seite (Phase ≈ 60°) ----------
  const home = homePose(sunDir, P, 60, 6.4);

  // ---------- Zeit, Ereignisse ----------
  const live = () => `${fmtDate(jd())} · ${fmtDeg(st.km / 1e6, 1)} Mio. km von der Sonne · Sonne über ${fmtDeg(st.subLon)}° O`;
  const at = (m) => (from, until) => { const x = nextAnomaly('mercury', from - 1e-6, m); return x <= until ? x : null; };
  const go = (x) => { jdBase = x - 2; days = 0; refreshLayers(); };
  registerLayers('mercury', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Drehung und Umlauf im Zeitraffer', value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, autoplay: !ctx.still,
      hint: 'Merkur dreht sich in 58,6 Tagen einmal und umläuft die Sonne in 88 Tagen – zwei Umläufe, drei Drehungen. Von Mittag zu Mittag vergehen 176 Erdtage.',
      fmt: (i) => SPEEDS[Math.round(i)][1], now: () => jd(), span: INNER.mercury.year,
      set: (i, p) => { spdIdx = Math.max(1, Math.round(i)); playing = p; }, get: () => ({ value: spdIdx, playing }),
      status: () => `${fmtDate(jd())} · ${playing ? `Zeitraffer ${SPEEDS[spdIdx][1]}` : 'angehalten'}` },
    { id: 'tail', type: 'toggle', group: 'Exosphäre', label: 'Natriumschweif (Modell)', value: true,
      hint: 'Natriumatome aus dem Boden, vom Licht der Sonne fortgedrückt. Mit bloßem Auge unsichtbar, nur im Licht der Natriumlinie; im Bild 40 statt rund 1.400 Merkurradien lang.',
      set: (v) => { tail.visible = v; } },
    { id: 'tailGain', type: 'range', sub: true, label: 'Helligkeit des Schweifs', value: 1, min: 0.25, max: 3, step: 0.25, unit: '×', set: (v) => { tailGain = v; }, get: () => tailGain },
    { id: 'field', type: 'toggle', group: 'Magnetfeld', label: 'Feldlinien (Schema)', value: false,
      hint: 'Dipolfeld, dessen Mitte 484 km nördlich der Planetenmitte liegt; ohne die Verformung durch den Sonnenwind.',
      set: (v) => { field.visible = v; } },
  ]);

  // ---------- Infotafel: Ansicht und Sprünge auf der Bahn ----------
  const controls = [
    { id: 'view', label: 'Ansicht', value: 'photo', options: [['photo', 'Foto'], ['temp', 'Wärmebild (Modell)']],
      set: (v) => { temp = v === 'temp' ? 1 : 0; u.uTemp.value = temp; } },
    { id: 'peri', type: 'action', label: 'Perihel', button: 'Nächstes Perihel', mark: 'Perihel', horizon: 88, at: at(0), go, run: () => go(nextAnomaly('mercury', jd(), 0)) },
    { id: 'aph', type: 'action', label: 'Aphel', button: 'Nächstes Aphel', mark: 'Aphel', horizon: 88, at: at(180), go, run: () => go(nextAnomaly('mercury', jd(), 180)) },
  ];

  // ---------- Abzeichen (Gazetteer: Länge Ost) ----------
  const facing = (p, cam) => p.clone().normalize().dot(cam.position.clone().sub(p).normalize());
  const spot = (id, lat, lon, focus) => {
    const h = { id, kind: 'info', pos: new THREE.Vector3(), focus: () => focus, visible: (cam) => facing(h.pos, cam) > 0.08, lat, lon };
    return h;
  };
  const tailPos = new THREE.Vector3(), fieldPos = new THREE.Vector3();
  const hs = [
    spot('caloris', 31.65, 162.0, 2.6),
    spot('hotpole', 0, 0, 2.6),
    spot('ice', 85.77, 62.9, 2.2),
    spot('hollows', 27.15, 119.06, 2.1),
    spot('scarp', -36.54, 76.54, 2.3),
    spot('borealis', 67.3, 32.6, 2.5),
    { id: 'tail', kind: 'info', pos: tailPos, focus: () => 9, visible: () => tail.visible },
    { id: 'field', kind: 'info', pos: fieldPos, focus: () => 5 },
  ];
  hideBehind(hs, [{ center: { x: 0, y: 0, z: 0 }, radius: 1 }]);

  // ---------- je Bild ----------
  const tmp = new THREE.Vector3();
  function place() {
    st = innerState('mercury', jd());
    group.quaternion.copy(fix.rot(real.set(...st.sun))).multiply(Q0);
    spin.rotation.y = spinOf('mercury', jd());
    u.uSunDir.value.copy(sunDir);
    u.uSunAng.value = st.sunAng;
    u.uTss.value = subsolarT(st.au);
    sun.update(sunDir, st.sunAng);
    // Schweif gegen die Sonne; Stärke nach der Radialgeschwindigkeit (Dopplerverschiebung der Na-D-Linien, Modell)
    tailU.uAnti.value.copy(sunDir).negate();
    tailU.uU.value.copy(tmp.set(0, 1, 0).cross(sunDir).normalize());
    tailU.uV.value.copy(tmp.copy(sunDir).cross(tailU.uU.value).normalize());
    tailU.uGain.value = 0.9 * tailGain * (0.25 + 0.75 * Math.min(1, Math.abs(st.vr) / 10));
    tailPos.copy(sunDir).multiplyScalar(-3.4);
    fieldPos.set(0, 1.75, 0).applyQuaternion(group.quaternion);
    group.updateMatrixWorld(true);
    for (const h of hs) if (h.lat !== undefined) spin.localToWorld(dirLL(h.lat, h.lon, h.pos).multiplyScalar(1.01));
  }
  place();

  const look = { exposure: 1.0, bloom: 0.08 };
  return {
    scene, camera, home, unit: INNER.mercury.r * 1e3, hotspots: hs, controls, look,
    orbit: { minDistance: 0.003, maxDistance: 80, cineSpeed: 0.35 },
    update(dt, tt, cam, flying) {
      t = tt;
      if (!flying && playing) days += dt * SPEEDS[spdIdx][0];
      tailU.uTime.value = tt;
      place();
      const nr = THREE.MathUtils.clamp((cam.position.length() - 1) * 0.25, 2e-6, 0.5);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
    },
    orbitUpdate(c) {
      const p = c.object.position, r = p.length();
      if (r < 1.004) p.multiplyScalar(1.004 / r);
    },
    live,
    setPixelRatio(pr, h) { stars.userData.setPixelRatio(pr); if (h) viewH = h; tailU.uSize.value = viewH * 0.09 * pr; },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      sun.dispose();
    },
  };
}
