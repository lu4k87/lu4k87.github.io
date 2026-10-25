// Station 4: Orion-Nebel (Einheit 1 Lj), Blickrichtung von der Erde = −z, Norden = +y, Osten = −x. Modell nach O'Dell
// et al. 2009: die Ionisationsfront ist eine gekrümmte Schale auf der Vorderseite der Molekülwolke OMC-1 (Paraboloid, zu
// uns offen), davor eine leuchtende Schicht von ≈ 0,1 pc; θ¹ Ori C steht ≈ 0,2 pc vor der Front. Emission ∝ Dichte ×
// UV-Fluss (1/d²), Linien nach Abstand: [O III] 501 nm innen (grünlich), Hα 656 nm überall, [S II] 672 nm außen.
// Dahinter ist die Wolke undurchsichtig (keine Sterne), davor dünner Staub (Dunkle Bucht im Nordosten) mit Staubfingern.
// Orion-Balken als Grat im Südosten, M43 (de Mairans Nebel) als eigene Blase um NU Ori im Nordosten. Farbmodi: sichtbar,
// Hubble-Palette (SHO: [S II] → rot, Hα → grün, [O III] → blau) und Infrarot (Staub durchsichtig, eingebettete junge
// Sterne und die BN/KL-Region hinter der Front werden sichtbar, wie bei 2MASS/JWST).

import * as THREE from 'three';
import { volume, pointCloud, disposeScene } from '../vol.js';
import { createStarfield } from '../stars.js';
import { mulberry32, gauss, blackbody, LY } from '../astro.js';

const STAR = new THREE.Vector3(0, 0, 0.65);
const M43 = new THREE.Vector3(-1.7, 2.1, 0.9);   // ≈ 7′ nordöstlich des Trapezes (0,8 pc bei 390 pc)

const BODY = /* glsl */ `
uniform vec3 uStar, uStar43;
uniform float uGain, uMode, uDustT;
void sampleVol(vec3 p, out vec3 e, out float s) {
  float r = length(p);
  float edge = smoothstep(15.0, 8.5, r);
  float turb = fbm(p * 0.5 + vec3(2.0, 7.0, 1.0), OCT);
  const vec3 K = vec3(5.2, 1.3, 9.1);
  float warp = (fbm(p * 0.16 + K, 3) - fbm(K, 3)) * 3.0;
  float zf = -0.3 + 0.045 * dot(p.xy, p.xy) + warp;
  float sd = p.z - zf;
  float d = length(p - uStar);
  float flux = 1.0 / (1.0 + d * d * 0.07);
  // leuchtende Haut vor der Front, mit feinen Fäden (Grat-Rauschen) aufgeraut
  float fil = ridged(p * 1.1 + vec3(3.0, 1.0, 5.0), 3);
  float skin = exp(-pow((sd - 0.4) / (0.5 + 0.3 * turb), 2.0)) * (0.7 + 0.6 * fil);
  vec2 bq = p.xy - vec2(3.6, -2.8);
  float bar = exp(-pow(dot(bq, vec2(0.6, 0.8)) / 0.4, 2.0)) * exp(-pow(dot(bq, vec2(-0.8, 0.6)) / 3.2, 2.0)) * exp(-pow(sd / 1.1, 2.0)) * (0.8 + 0.5 * fil);
  float ne = (skin * (0.3 + 1.5 * max(turb + 0.3, 0.0)) + bar * 1.5) * edge;
  float cav = smoothstep(-0.2, 1.5, sd) * exp(-d / 4.5) * 0.16 * (0.5 + max(turb + 0.5, 0.0)) * edge;
  // M43: kleine Blase um NU Ori, durch eine Staubbahn von M42 getrennt
  float d43 = length(p - uStar43);
  float m43 = exp(-pow(d43 / 0.9, 2.0)) * (0.5 + 0.8 * max(fbm(p * 1.3 + 4.0, 3) + 0.3, 0.0)) * smoothstep(-0.6, 0.6, sd + 0.3);
  float flux43 = 0.35 / (1.0 + d43 * d43 * 2.5);
  float em = (ne + cav) * flux + m43 * flux43 * 1.6;
  float o3 = exp(-d / 2.8);
  float s2 = smoothstep(4.0, 10.0, d);
  float ha = 1.0;
  // Linien → Farbe je Modus: 0 sichtbar, 1 Hubble-Palette (SHO), 2 Infrarot (Hα/[O III] schwach, Staub glüht warm)
  vec3 cHa = vec3(1.0, 0.12, 0.2), cHb = vec3(0.35, 0.45, 1.0), cO3 = vec3(0.1, 0.95, 0.72), cS2 = vec3(0.9, 0.04, 0.04);
  vec3 col = cHa * ha + cHb * 0.14 + cO3 * o3 * 1.7 + cS2 * s2 * 0.5;
  vec3 sho = vec3(0.35 + s2 * 1.6, ha * 0.9, 0.3 + o3 * 1.9);
  vec3 ir = vec3(0.75, 0.5, 0.34) * (0.5 + 0.6 * o3);
  col = uMode < 0.5 ? col : uMode < 1.5 ? sho : ir;
  e = em * col * uGain;
  float mol = max(smoothstep(0.25, -1.0, sd) * (0.6 + turb), 0.0) * smoothstep(16.0, 10.0, r);
  // Dunkle Bucht und Staubfinger vor dem Nebel (Nordosten), feine Fäden aus Grat-Rauschen
  float bay = exp(-pow((p.z - 4.5) / 1.4, 2.0)) * smoothstep(0.05, 0.35, fbm(p * 0.3 + 11.0, 3) + (p.y - p.x) * 0.05) * edge;
  float fingers = exp(-pow((p.z - 3.2) / 2.2, 2.0)) * smoothstep(0.55, 0.85, ridged(p * 0.7 + vec3(9.0, 2.0, 4.0), 3)) * smoothstep(-1.0, 3.0, p.y - p.x * 0.4) * edge;
  float lane43 = exp(-pow((dot(p.xy - vec2(-0.9, 1.0), normalize(vec2(0.75, -0.66)))) / 0.22, 2.0)) * smoothstep(2.6, 0.8, length(p.xy - vec2(-0.9, 1.0))) * smoothstep(-0.8, 0.8, sd + 0.4);
  float dust = (bay * 0.9 + fingers * 1.4 + lane43 * 1.6) * uDustT;
  s = mol * 2.2 * uDustT + dust + ne * 0.04;
  // Molekülwolke glüht im Infrarot warm (erwärmter Staub), sonst nur ein Hauch
  e += vec3(0.5, 0.3, 0.2) * mol * flux * (uMode > 1.5 ? 0.55 : 0.025) * uGain + vec3(0.9, 0.5, 0.25) * (bay + fingers) * (uMode > 1.5 ? 0.14 : 0.0) * uGain;
}
`;

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 500);
  const sky = createStarfield({ gain: 0.7, seed: 41, ngp: new THREE.Vector3(0.2, 0.9, 0.3), gc: new THREE.Vector3(0.9, 0, -0.4) });
  scene.add(sky);

  const steps = Math.round(60 + 52 * ctx.detail);
  const neb = volume({ radius: 15.5, body: `#define OCT ${ctx.detail > 0.7 ? 6 : 5}\n${BODY}`, steps, uniforms: { uStar: { value: STAR }, uStar43: { value: M43 }, uGain: { value: 0.4 }, uMode: { value: 0 }, uDustT: { value: 1 } } });
  neb.renderOrder = 1;
  scene.add(neb);

  // Trapez (θ¹ Ori A–D, Abstände ≈ 0,05 Lj), NU Ori in M43 und der Orionnebel-Haufen (meist massearme, rötliche junge Sterne)
  const rand = mulberry32(42);
  const pos = [], col = [], size = [];
  const add = (x, y, z, T, k, s) => { pos.push(x, y, z); col.push(...blackbody(T).map((v) => v * k)); size.push(s); };
  [[0.05, 0.035, 30000, 40], [-0.04, 0.05, 28000, 26], [0, 0, 39000, 120], [0.03, -0.05, 31000, 30]]
    .forEach(([x, y, T, k]) => add(STAR.x + x, STAR.y + y, STAR.z + (rand() - 0.5) * 0.03, T, k, 0.06));
  add(M43.x, M43.y, M43.z + 0.2, 26000, 18, 0.05);
  for (let i = 0; i < 2200; i++) {
    const u = rand();
    const r = Math.min(9, 0.25 * u / Math.pow(1 - u, 0.9));
    const v = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(r);
    const hot = rand() < 0.03;
    add(v.x, v.y, STAR.z + Math.abs(v.z) * 0.6 - 0.2, hot ? 12000 + rand() * 14000 : 2900 + rand() * 1600, hot ? 6 : 0.35 + rand() * 1.2, 0.03);
  }
  const cluster = pointCloud(pos, col, size, { min: 1.2 });
  cluster.renderOrder = 2;
  scene.add(cluster);
  // eingebettete Population hinter der Front (nur im Infrarot sichtbar): BN/KL-Region und gerötete Protosterne in OMC-1
  const ep = [], ec = [], es = [];
  const addE = (x, y, z, T, k, s) => { ep.push(x, y, z); ec.push(...blackbody(T).map((v) => v * k)); es.push(s); };
  const BNKL = new THREE.Vector3(0.3, 0.35, -0.7);
  addE(BNKL.x, BNKL.y, BNKL.z, 2200, 30, 0.09);
  for (let i = 0; i < 60; i++) addE(BNKL.x + gauss(rand) * 0.25, BNKL.y + gauss(rand) * 0.25, BNKL.z + gauss(rand) * 0.2, 1900 + rand() * 900, 3 + rand() * 6, 0.05);
  for (let i = 0; i < 900; i++) {
    const v = new THREE.Vector3(gauss(rand) * 2.2, gauss(rand) * 2.6, -0.6 - Math.abs(gauss(rand)) * 2.5);
    addE(v.x, v.y, v.z, 2000 + rand() * 1500, 0.6 + rand() * 2.5, 0.035);
  }
  const embedded = pointCloud(ep, ec, es, { min: 1.2 });
  embedded.renderOrder = 2;
  embedded.visible = false;
  scene.add(embedded);

  let mode = 'vis';
  const hotspots = [
    { id: 'trapez', kind: 'info', pos: STAR.clone() },
    { id: 'proplyds', kind: 'info', pos: new THREE.Vector3(0.4, -0.3, 0.75) },
    { id: 'omc', kind: 'info', pos: new THREE.Vector3(-1.2, 0.6, -2.8) },
    { id: 'ionbar', kind: 'info', pos: new THREE.Vector3(3.7, -2.9, 0.9) },
    { id: 'bay', kind: 'info', pos: new THREE.Vector3(-3.0, 3.4, 4.5) },
    { id: 'm43', kind: 'info', pos: M43.clone() },
    { id: 'bnkl', kind: 'info', pos: BNKL.clone(), visible: () => mode === 'ir' },
    { id: 'sho', kind: 'info', pos: new THREE.Vector3(2.2, 1.8, 1.2), visible: () => mode === 'sho' },
  ];
  const controls = [{
    id: 'mode', label: 'Farben', value: 'vis', options: [['vis', 'Sichtbar'], ['sho', 'Hubble-Palette'], ['ir', 'Infrarot']],
    set: (v) => {
      mode = v;
      const u = neb.material.uniforms;
      u.uMode.value = v === 'vis' ? 0 : v === 'sho' ? 1 : 2;
      u.uDustT.value = v === 'ir' ? 0.12 : 1;
      embedded.visible = v === 'ir';
    },
  }];

  return {
    scene, camera, unit: LY, hotspots, controls, resScale: 0.55 + 0.3 * ctx.detail, msaa: false,
    home: { pos: new THREE.Vector3(3.5, 2.2, 24), target: new THREE.Vector3(0, 0, 0) },
    orbit: { minDistance: 1.2, maxDistance: 70, cineSpeed: 0.7 },
    look: { exposure: 1.15, bloom: 0.08, sat: 1.12, con: 0.14, sh: [0.94, 0.98, 1.08] },
    update(dt, t) { neb.material.uniforms.uTime.value = t; },
    live: () => (mode === 'vis' ? 'Sichtbares Licht: Hα rot, [O III] grünlich, [S II] tiefrot' : mode === 'sho' ? 'Hubble-Palette: [S II] → rot, Hα → grün, [O III] → blau (Falschfarben)' : 'Infrarot: Staub wird durchsichtig, die eingebetteten Protosterne und BN/KL erscheinen'),
    setPixelRatio(pr, H) { sky.userData.setPixelRatio(pr); cluster.userData.setPx(pr, H, camera.fov); embedded.userData.setPx(pr, H, camera.fov); },
    dispose: () => disposeScene(scene),
  };
}
