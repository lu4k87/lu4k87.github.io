// Station 02J: Venus (Einheit 1 Venusradius = 6.051,8 km), Abstecher vom Sonnensystem. Boden als Kugel mit der Radarkarte von
// Solar System Scope (Magellan; die Vorlage steht mit Süden oben, beim Umrechnen gespiegelt, geprüft an Maxwell Montes,
// Aphrodite Terra, Artemis), gedreht rückläufig nach dem Nullmeridian der IAU; darüber die Wolkendecke (Karte Solar System
// Scope) in rund 70 km Höhe, die in 4 Tagen einmal umläuft (Superrotation; der Boden braucht 243 Tage). Ansichten wie
// Raumsonden sie sehen: sichtbares Licht (fast strukturlos), Ultraviolett (dunkle Bänder des unbekannten Absorbers), Infrarot
// (Nachtseite: heiße tiefe Schichten leuchten durch Lücken der Wolken), Radar (Wolken weg, Boden wie bei Magellan). Kontrast,
// Farben, Polarwirbel und Lücken sind ein Modell. Sonne, Heimpose und Bezugssystem mit fester Sonne aus levels/mercury.js.

import * as THREE from 'three';
import { julianDate, eclDir, J2000, hideBehind } from '../astro.js';
import { createStarfield } from '../stars.js';
import { BODY_VERT, SHELL_VERT, ATMO_FRAG, ATMOS } from '../planetfx.js';
import { NOISE } from '../glsl.js';
import { registerLayers } from '../layers.js';
import { dirLL } from './mars.js';
import { planetFrame, createSun, sunFixed, homePose, fmtDate } from './mercury.js';
import { INNER, innerState, spinOf } from '../inner.js';
import { spinAxis } from '../axes.js';

const RAD = Math.PI / 180;
const SPEEDS = [[0, 'Stopp'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s'], [4, '4 Tage/s']];
const CLOUD_R = 1 + 70 / 6051.8;     // Wolkenobergrenze ≈ 70 km (Darstellung als eine Schale)
const CLOUD_DAYS = 4;                // Umlauf der Wolken an der Obergrenze (Horinouchi et al. 2020)
const C_MEAN = 0.76, C_STD = 0.06;   // Helligkeit der Wolkenkarte: Mittel, Streuung (zum Normieren des Kontrasts)
const MODES = { vis: 0, uv: 1, ir: 2, radar: 3 };
const fmtDeg = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

// Boden im Radarbild: Rückstreuung der Karte, gleichmäßig aufgehellt (Radar bringt sein Licht selbst mit), Tag/Nacht nur
// angedeutet; Feinstruktur beim Heranzoomen
const SURF_FRAG = /* glsl */ `
uniform sampler2D tMap;
uniform vec3 uSunDir;
varying vec3 vN, vP, vO;
varying vec2 vUv;
${NOISE}
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  vec3 t = texture2D(tMap, vUv).rgb;
  float fade = 1.0 - smoothstep(0.0008, 0.003, length(fwidth(vO)));
  if (fade > 0.0) t *= 1.0 + fbm(vO * 300.0, 3) * 0.16 * fade;
  float ndl = dot(N, uSunDir);
  float view = max(dot(N, normalize(V * 0.7 + uSunDir * 0.3)), 0.0);
  float day = mix(0.6, 1.0, smoothstep(-0.12, 0.12, ndl));
  gl_FragColor = vec4(t * (0.22 + 0.88 * view) * day, 1.0);
}`;

// Wolkendecke: Karte (Schale dreht mit der Superrotation) + langsam strömendes Rauschen; Ansicht uMode 0 sichtbar, 1 UV,
// 2 Infrarot; Polarwirbel als Spirale um beide Pole (Modell, Venus Express sah den Doppelwirbel am Südpol)
const CLOUD_FRAG = /* glsl */ `
uniform sampler2D tCloud;
uniform vec3 uSunDir;
uniform float uMode, uTime, uVortex, uGain;
varying vec3 vN, vP, vO;
varying vec2 vUv;
${NOISE}
void main() {
  vec3 d = normalize(vO);
  float w = uTime * 0.008;
  float n = fbm(d * 5.0 + vec3(w, 0.0, -w * 0.7), 4);
  vec2 uv = vUv + vec2(n * 0.006, n * 0.002);
  float z = (dot(texture2D(tCloud, uv).rgb, vec3(0.299, 0.587, 0.114)) - ${C_MEAN.toFixed(3)}) / ${C_STD.toFixed(3)};
  float fade = 1.0 - smoothstep(0.0006, 0.003, length(fwidth(vO)));
  z += (fbm(d * 60.0 + vec3(0.0, w * 3.0, 0.0), 3) * 0.8 + n * 1.2) * (0.4 + 0.6 * fade);
  float pol = smoothstep(0.84, 0.97, abs(d.y)) * uVortex;
  if (pol > 0.0) {
    float r = length(d.xz), a = atan(d.z, d.x);
    float arm = sin(2.0 * a + r * 34.0 - uTime * 0.35 * sign(d.y));
    z = mix(z, arm * 1.4 - 1.6 * smoothstep(0.1, 0.0, r) + 0.9 * smoothstep(0.32, 0.22, r) * smoothstep(0.14, 0.24, r), pol);
  }
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float ndl = dot(N, uSunDir), mu = max(dot(N, V), 0.0);
  float lit = clamp((ndl + 0.14) / 1.14, 0.0, 1.0);
  lit = lit * lit * (3.0 - 2.0 * lit) * 0.4 + lit * 0.6;
  vec3 col;
  if (uMode < 0.5) {
    col = vec3(0.98, 0.9, 0.7) * (1.0 + z * 0.06) * lit;
  } else if (uMode < 1.5) {
    float u = clamp(0.58 + z * 0.17, 0.0, 1.0);
    col = mix(vec3(0.14, 0.18, 0.3), vec3(0.86, 0.91, 1.0), u) * lit;
  } else {
    float night = 1.0 - smoothstep(-0.12, 0.04, ndl);
    float gap = smoothstep(-0.4, 1.6, -z);
    col = vec3(0.92, 0.88, 0.8) * (1.0 + z * 0.05) * lit * 0.5 + vec3(1.0, 0.34, 0.09) * gap * gap * night * (0.55 + 0.45 * mu);
  }
  col *= mix(vec3(1.0, 0.86, 0.7), vec3(1.0), smoothstep(-0.04, 0.14, ndl));
  gl_FragColor = vec4(col * uGain, 1.0);
}`;

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 6000);
  scene.add(createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.6, seed: 37, tex: ctx.tex }));
  const stars = scene.children[0];
  const jd0 = julianDate(ctx.date);
  let jdBase = jd0, days = 0, spdIdx = 1, playing = !ctx.still, mode = 'vis', superOn = true;
  const jd = () => jdBase + days;
  let st = innerState('venus', jd0);
  const fix = sunFixed(stars, 'venus', jd0), sunDir = fix.sun, real = new THREE.Vector3();

  // ---------- Boden, Wolken, Dunst ----------
  const { group, spin, P } = planetFrame('venus');
  const Q0 = group.quaternion.clone();
  scene.add(group);
  const hi = ctx.detail >= 0.8, seg = Math.round(128 + 96 * ctx.detail);
  const surfU = { tMap: { value: ctx.tex(hi ? 'venus_surface_4k.jpg' : 'venus_surface.jpg') }, uSunDir: { value: sunDir } };
  const surface = new THREE.Mesh(new THREE.SphereGeometry(1, seg, seg / 2), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: SURF_FRAG, uniforms: surfU }));
  surface.visible = false;
  spin.add(surface);
  spinAxis(surface);
  const cloudU = { tCloud: { value: ctx.tex(hi ? 'venus_atmosphere_4k.jpg' : 'venus_atmosphere.jpg') }, uSunDir: { value: sunDir }, uMode: { value: 0 }, uTime: { value: 0 }, uVortex: { value: 1 }, uGain: { value: 0.95 } };
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(CLOUD_R, seg, seg / 2), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: CLOUD_FRAG, uniforms: cloudU }));
  group.add(clouds);
  const a = ATMOS.venus;
  const atmoU = {
    uSun: { value: sunDir }, uCenter: { value: new THREE.Vector3() }, uBeta: { value: new THREE.Vector3(0.45, 0.44, 0.42) }, uMieCol: { value: new THREE.Vector3(1.0, 0.96, 0.86) },
    uRp: { value: CLOUD_R }, uRa: { value: a.ra }, uH: { value: a.h }, uGain: { value: a.gain }, uMie: { value: a.mie }, uAir: { value: 0 }, uAirH: { value: 0.2 },
  };
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(a.ra, 96, 48), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: ATMO_FRAG, uniforms: atmoU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  scene.add(atmo);
  const sun = createSun();
  scene.add(sun.group);
  function setMode(v) {
    mode = v;
    cloudU.uMode.value = MODES[v];
    clouds.visible = v !== 'radar';
    surface.visible = v === 'radar';
    atmoU.uGain.value = a.gain * (v === 'radar' ? 0.2 : 0.5);
  }

  // ---------- Heimpose: Tagseite schräg von der Seite (Phase ≈ 62°) ----------
  const home = homePose(sunDir, P, 62, 6.2);

  // ---------- Zeit, Ebenen ----------
  // Wolken: Winkel der Schale, rückläufig wie der Boden; eine Runde in CLOUD_DAYS Tagen
  const cloudSpin = (x) => ((((-360 / CLOUD_DAYS) * (x - J2000)) % 360 + 360) % 360) * RAD;
  registerLayers('venus', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Wolken und Drehung im Zeitraffer', value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, autoplay: !ctx.still,
      hint: 'Die Wolken umrunden Venus in rund 4 Tagen, der Boden dreht sich in 243 Tagen einmal – rückwärts. Von Mittag zu Mittag vergehen 117 Erdtage.',
      fmt: (i) => SPEEDS[Math.round(i)][1], now: () => jd(), span: 8,
      set: (i, p) => { spdIdx = Math.max(1, Math.round(i)); playing = p; }, get: () => ({ value: spdIdx, playing }),
      status: () => `${fmtDate(jd())} · ${playing ? `Zeitraffer ${SPEEDS[spdIdx][1]}` : 'angehalten'}` },
    { id: 'super', type: 'toggle', group: 'Wolken', label: 'Superrotation', value: true,
      hint: 'Aus: Die Wolken drehen sich mit dem Boden – so langsam, wie es ohne Superrotation wäre.', set: (v) => { superOn = v; } },
    { id: 'vortex', type: 'toggle', label: 'Polarwirbel (Modell)', value: true, set: (v) => { cloudU.uVortex.value = v ? 1 : 0; } },
    { id: 'haze', type: 'toggle', label: 'Dunst über den Wolken', value: true, set: (v) => { atmo.visible = v; } },
  ]);

  // ---------- Infotafel: Ansicht ----------
  const DETAIL = {
    vis: '<b>Sichtbares Licht</b> – so sähe das Auge Venus: eine fast strukturlose, hell gelbliche Wolkenkugel. Die Wolken aus Schwefelsäure werfen gut drei Viertel des Sonnenlichts zurück.',
    uv: '<b>Ultraviolett</b> – im Licht um 365 nm schlucken die Wolken unterschiedlich stark; dunkle Bänder und das liegende „Y“ werden sichtbar. Woraus der Absorber besteht, ist offen. Kontrast und Farbe: Modell.',
    ir: '<b>Infrarot</b> – auf der Nachtseite leuchten die heißen tiefen Schichten durch Lücken der Wolkendecke; dichte Wolken stehen dunkel davor. Lücken und Farbe: Modell.',
    radar: '<b>Radar</b> – Radarwellen dringen durch die Wolken. So kartierte die Sonde Magellan 1990–1994 den Boden; helle Flächen sind rau oder steil, dunkle glatt.',
  };
  const controls = [
    { id: 'mode', type: 'swatch', label: 'Ansicht', value: 'vis',
      options: [['vis', 'Sichtbar', 'radial-gradient(circle, #fbf1d8 0%, #e2cfa2 60%, #6b5a3a 100%)'], ['uv', 'Ultraviolett', 'radial-gradient(circle, #e6ecff 0%, #8494b8 55%, #222a40 100%)'],
        ['ir', 'Infrarot', 'radial-gradient(circle, #ff7a2a 0%, #8a2a0c 55%, #1c0904 100%)'], ['radar', 'Radar', 'radial-gradient(circle, #ffd27a 0%, #c06a1c 55%, #3a1a06 100%)']],
      detail: (v) => `<p class="sw-cap">${DETAIL[v]}</p>`, set: setMode, get: () => mode },
  ];

  // ---------- Abzeichen (Gazetteer: Länge Ost); Wolken-Abzeichen ziehen mit der Wolkendecke ----------
  const facing = (p, cam) => p.clone().normalize().dot(cam.position.clone().sub(p).normalize());
  const spot = (id, lat, lon, focus, on = spin, r = 1.01) => {
    const h = { id, kind: 'info', pos: new THREE.Vector3(), focus: () => focus, visible: (cam) => facing(h.pos, cam) > 0.08, lat, lon, on, r };
    return h;
  };
  const hs = [
    spot('maxwell', 65.2, 3.3, 2.3),
    spot('maat', 0.5, 194.6, 2.3),
    spot('sif', 22.0, 352.4, 2.3),
    spot('mead', 12.5, 57.2, 2.2),
    spot('niobe', 21.0, 112.3, 2.5),
    spot('clouds', 12, 300, 2.8, clouds, CLOUD_R + 0.01),
    spot('vortex', -86, 0, 2.4, clouds, CLOUD_R + 0.01),
  ];
  hideBehind(hs, [{ center: { x: 0, y: 0, z: 0 }, radius: CLOUD_R }]);

  // ---------- je Bild ----------
  function place() {
    st = innerState('venus', jd());
    group.quaternion.copy(fix.rot(real.set(...st.sun))).multiply(Q0);
    spin.rotation.y = spinOf('venus', jd());
    clouds.rotation.y = superOn ? cloudSpin(jd()) : spin.rotation.y;
    sun.update(sunDir, st.sunAng);
    group.updateMatrixWorld(true);
    for (const h of hs) h.on.localToWorld(dirLL(h.lat, h.lon, h.pos).multiplyScalar(h.r));
  }
  place();
  setMode('vis');

  const look = { exposure: 0.95, bloom: 0.07 };
  return {
    scene, camera, home, unit: INNER.venus.r * 1e3, hotspots: hs, controls, look,
    orbit: { minDistance: 0.003, maxDistance: 60, cineSpeed: 0.3 },
    update(dt, tt, cam, flying) {
      if (!flying && playing) days += dt * SPEEDS[spdIdx][0];
      cloudU.uTime.value = tt;
      place();
      const nr = THREE.MathUtils.clamp((cam.position.length() - (mode === 'radar' ? 1 : CLOUD_R)) * 0.25, 2e-6, 0.5);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
    },
    orbitUpdate(c) {
      const p = c.object.position, r = p.length(), min = (mode === 'radar' ? 1 : CLOUD_R) + 0.004;
      if (r < min) p.multiplyScalar(min / r);
    },
    live: () => `${fmtDate(jd())} · ${fmtDeg(st.km / 1e6, 1)} Mio. km von der Sonne · Sonne über ${fmtDeg(st.subLon)}° O`,
    setPixelRatio(pr) { stars.userData.setPixelRatio(pr); },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      sun.dispose();
    },
  };
}
