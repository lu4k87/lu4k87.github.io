// Station 5: Krebsnebel (Einheit 1 Lj), Ellipsoid 4,1 × 2,7 pc (≈ 13 × 9 Lj, Bühler & Blandford 2014).
// Hülle aus Filamenten (Grat-Rauschen, radial gestreckt): ausgeworfene Sternmaterie, rot durch Hα, gelblich durch
// Helium/Schwefel, mit etwas Staub (leichte Absorption). Innen der Synchrotronnebel: bläulich-weißes Kontinuum, das der
// Pulsar speist, mit faseriger Feldstruktur. Am Pulsar Torus und Jet entlang der Drehachse; „Wisps“ laufen im
// Zeitraffer nach außen (echt ≈ 0,5 c). Spektrum: sichtbar · Röntgen (Chandra: nur der innere Synchrotronnebel mit
// Torus und Jet, die Filamente fehlen – die Röntgen-Elektronen verlieren ihre Energie, bevor sie den Rand erreichen) ·
// Radio (Synchrotron füllt den ganzen Nebel, Falschfarbe). Expansion: Filamente ≈ 1.500 km/s; die Rückrechnung trifft
// nicht 1054, sondern ≈ 1130 – der Pulsarwind hat die Hülle in den ersten Jahrzehnten beschleunigt (Nugent 1998).

import * as THREE from 'three';
import { volume, pointCloud, disposeScene } from '../vol.js';
import { createStarfield } from '../stars.js';
import { blackbody, LY } from '../astro.js';

const BODY = /* glsl */ `
uniform float uGain, uMode, uExp;
uniform mat3 uAxis;   // Rahmen der Drehachse des Pulsars
void sampleVol(vec3 p, out vec3 e, out float s) {
  vec3 q = p / (vec3(6.7, 4.4, 4.6) * uExp);
  float rn = length(q);
  e = vec3(0.0);
  s = 0.0;
  if (rn > 1.06) return;   // außerhalb des Ellipsoids leer – spart den Großteil der Kugel
  vec3 dir = q / max(rn, 1e-4);
  vec3 pe = p / uExp;      // Mitbewegte Koordinaten: die Struktur wächst mit, ihr Muster bleibt
  float shell = smoothstep(0.42, 0.72, rn) * smoothstep(1.06, 0.86, rn);
  float fil = 0.0;
  vec3 fcol = vec3(0.0);
  if (shell > 0.001) {
    // Filamente als Fäden: Schnitt zweier Grat-Flächen (je allein wären es Schichten); radial leicht gestreckt
    vec3 pr = pe - dir * (length(pe) * 0.45);
    float f1 = ridged(pr * 1.25 + vec3(1.3, 2.1, 0.4), 3), f2 = ridged(pr * 1.25 + vec3(5.2, 7.7, 3.1), 3);
    float rid = ridged(pe * 0.42 + vec3(1.3, 2.1, 0.4), 3);
    fil = pow(max(f1 * f2 - 0.34, 0.0) * 2.6, 2.2) * shell * (0.5 + 0.8 * smoothstep(0.3, 0.8, rid));
    // Hα rot, Helium/[S II]-reiche Knoten gelblich, [O III]-Säume grünlich
    float mixn = fbm(pe * 0.7, 2);
    fcol = mix(vec3(1.0, 0.22, 0.1), vec3(1.0, 0.66, 0.22), smoothstep(-0.2, 0.3, mixn));
    fcol = mix(fcol, vec3(0.35, 0.9, 0.6), smoothstep(0.25, 0.45, fbm(pe * 1.1 + 9.0, 2)) * 0.45);
  }
  float sync = pow(max(1.0 - rn * rn, 0.0), 1.7) * (0.6 + 0.55 * fbm(pe * 0.33, 3));
  sync *= 0.7 + 0.4 * ridged(pe * vec3(0.55, 1.3, 0.55) + 5.0, 2);
  // Röntgen: nur der innere Teil (Elektronen kühlen schnell), Radio: der ganze Nebel bis an den Rand
  float xray = pow(max(1.0 - rn * rn / 0.42, 0.0), 1.6) * (0.6 + 0.55 * fbm(pe * 0.5, 3));
  float radio = pow(max(1.0 - rn * rn, 0.0), 0.9) * (0.5 + 0.6 * fbm(pe * 0.4 + 2.0, 3));
  // Torus, Jet und Wisps im Rahmen der Drehachse (nur nahe am Pulsar)
  float inner = 0.0;
  if (dot(pe, pe) < 4.8) {
    vec3 a = uAxis * pe;
    float rho = length(a.xz);
    float torus = exp(-pow((rho - 0.55) / 0.16, 2.0) - pow(a.y / 0.1, 2.0));
    float jet = exp(-pow(rho / 0.07, 2.0)) * smoothstep(1.8, 0.1, a.y) * step(0.0, a.y);
    float cjet = exp(-pow(rho / 0.09, 2.0)) * smoothstep(-1.2, -0.1, a.y) * step(a.y, 0.0) * 0.35;   // Gegenjet, schwächer
    float wisp = 0.0;
    for (int k = 0; k < 3; k++) {
      float f = fract(uTime * 0.05 + float(k) / 3.0);
      wisp += exp(-pow((rho - 0.3 - f * 1.3) / 0.05, 2.0) - pow(a.y / 0.08, 2.0)) * (1.0 - f);
    }
    inner = torus * 1.6 + jet * 1.1 + cjet + wisp * 0.9;
  }
  vec3 cSync = vec3(0.5, 0.68, 1.0);
  if (uMode < 0.5) {
    e = (fcol * fil * 5.5 + cSync * (sync * 0.5 + inner)) * uGain;
    s = fil * 0.8;
  } else if (uMode < 1.5) {
    // Chandra-Blick: Torus + Jet dominieren, innerer Nebel violett-blau, Filamente unsichtbar
    e = (vec3(0.55, 0.5, 1.0) * xray * 0.9 + vec3(0.85, 0.9, 1.0) * inner * 1.8) * uGain;
    s = 0.0;
  } else {
    // Radio-Blick (VLA): Synchrotron bis zum Rand, Filamente als schwache Fäden; Falschfarbe warm
    e = (vec3(1.0, 0.55, 0.2) * radio * 0.9 + vec3(1.0, 0.8, 0.4) * fil * 0.8 + vec3(1.0, 0.9, 0.7) * inner * 0.5) * uGain;
    s = fil * 0.2;
  }
}
`;

const TODAY = 2026, T0 = 1130;   // Konvergenzjahr der Filament-Bewegung (Nugent 1998: 1130 ± 16)

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 500);
  const sky = createStarfield({ gain: 0.75, seed: 51, ngp: new THREE.Vector3(0.1, 0.95, -0.2), gc: new THREE.Vector3(-0.2, -0.1, -1) });
  scene.add(sky);
  // Drehachse des Pulsars: in der Bildebene ≈ 124° (Nordwest–Südost), gegen die Sichtlinie geneigt
  const axis = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.45, 0, -0.6));
  const neb = volume({
    radius: 7.4, body: BODY, steps: Math.round(76 + 60 * ctx.detail),
    uniforms: { uGain: { value: 0.2 }, uMode: { value: 0 }, uExp: { value: 1 }, uAxis: { value: new THREE.Matrix3().setFromMatrix4(axis).invert() } },
  });
  neb.renderOrder = 1;
  scene.add(neb);
  const psr = pointCloud([0, 0, 0], blackbody(30000).map((v) => v * 60), [0.02], { min: 2.2 });
  psr.renderOrder = 2;
  scene.add(psr);

  let mode = 'vis', year = TODAY;
  const edge = new THREE.Vector3(-4.6, 2.2, 2.2), edgeBase = edge.clone();
  const hotspots = [
    { id: 'pulsar', kind: 'dive', to: 'pulsar', pos: new THREE.Vector3(0, 0, 0) },
    { id: 'filaments', kind: 'info', pos: edge },
    { id: 'sync', kind: 'info', pos: new THREE.Vector3(2.4, -1.2, 1.6) },
    { id: 'wisps', kind: 'info', pos: new THREE.Vector3(0.5, 0.5, 0).applyMatrix4(axis) },
    { id: 'expansion', kind: 'info', pos: new THREE.Vector3(5.2, 1.6, -1.8) },
    { id: 'xray', kind: 'info', pos: new THREE.Vector3(0, 1.4, 0).applyMatrix4(axis), visible: () => mode === 'xray' },
    { id: 'radio', kind: 'info', pos: new THREE.Vector3(-2.5, -2.4, 2.0), visible: () => mode === 'radio' },
  ];
  const scaleOf = (y) => Math.max(0.03, (y - T0) / (TODAY - T0));
  const controls = [
    { id: 'mode', label: 'Spektrum', value: 'vis', options: [['vis', 'Sichtbar'], ['xray', 'Röntgen'], ['radio', 'Radio']],
      set: (v) => { mode = v; neb.material.uniforms.uMode.value = v === 'vis' ? 0 : v === 'xray' ? 1 : 2; } },
    { id: 'year', label: 'Jahr', type: 'range', min: 1054, max: 2600, step: 1, value: TODAY, fmt: (v) => `${v} n. Chr.`,
      set: (v) => { year = v; const k = scaleOf(v); neb.material.uniforms.uExp.value = k; edge.copy(edgeBase).multiplyScalar(k); } },
  ];

  return {
    scene, camera, unit: LY, hotspots, controls, resScale: 0.55 + 0.3 * ctx.detail, msaa: false,
    home: { pos: new THREE.Vector3(1.5, 2.5, 19), target: new THREE.Vector3(0, 0, 0) },
    orbit: { minDistance: 1.0, maxDistance: 60, cineSpeed: 0.7 },
    look: { exposure: 1.1, bloom: 0.08, sat: 1.1, con: 0.13 },
    update(dt, t) { neb.material.uniforms.uTime.value = t; },
    live: () => {
      const k = scaleOf(year);
      const size = `${(13.4 * k).toFixed(1).replace('.', ',')} × ${(8.8 * k).toFixed(1).replace('.', ',')} Lj`;
      const when = year === TODAY ? 'heute' : year < TODAY ? `${year}: ${year < T0 + 10 ? 'Hülle noch im Beschleunigen (Modell ab 1130)' : 'Rückrechnung, gleichmäßige Expansion'}` : `${year}: Vorausrechnung ohne Abbremsung`;
      return `${size} · ${when}${mode === 'xray' ? ' · Röntgen: Torus + Jet (Chandra)' : mode === 'radio' ? ' · Radio: Synchrotron bis zum Rand' : ''}`;
    },
    setPixelRatio(pr, H) { sky.userData.setPixelRatio(pr); psr.userData.setPx(pr, H, camera.fov); },
    dispose: () => disposeScene(scene),
  };
}
