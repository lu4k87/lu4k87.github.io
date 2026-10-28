// Station 5: Krebsnebel (Einheit 1 Lj), Ellipsoid 4,1 × 2,7 pc (≈ 13 × 9 Lj, Bühler & Blandford 2014). Bild: lange
// Achse x = Nordwest (+x) – Südost, Norden rechts oben, Osten links oben, Erde in +z.
// Hülle aus Filamenten: grobes Netz (Schnitt zweier Grat-Flächen) aus radial gestreckten Rayleigh-Taylor-Fingern, darin
// feine Fäden in dreifacher Dichte; ausgeworfene Sternmaterie, rot durch Hα, gelblich durch Helium/Schwefel, grünliche
// [O III]-Säume, dichte Kerne heller, mit Staub (Absorption). Umriss nicht glatt: Lappen, Buchten im Osten und Westen
// (Fesen et al. 1992), der Nordschlot ragt als schwache Röhre aus [O III]-Fäden heraus (Gull & Fesen 1982). Innen der
// Synchrotronnebel: bläulich-weißes Kontinuum, das der Pulsar speist, mit Fasern längs des Magnetfelds, das sich um die
// Drehachse windet. Drehachse nach Ng & Romani 2004 (Positionswinkel 124°, 63° gegen die Sichtlinie): innerer Ring mit
// Knoten, Torus, gebogener Jet nach Südosten, schwacher Gegenjet; „Wisps“ laufen im Zeitraffer vom Ring zum Torus
// (echt ≈ 0,5 c), die zugewandte Seite ist heller (Doppler, hängt vom Blickwinkel ab). Spektrum: sichtbar · Röntgen
// (Chandra: nur der innere Synchrotronnebel mit Ring, Torus und Jet, die Filamente fehlen – die Röntgen-Elektronen
// verlieren ihre Energie, bevor sie den Rand erreichen) · Radio (Synchrotron füllt den ganzen Nebel, Falschfarbe).
// Expansion: Filamente ≈ 1.500 km/s; die Rückrechnung trifft nicht 1054, sondern ≈ 1130 – der Pulsarwind hat die Hülle in
// den ersten Jahrzehnten beschleunigt (Nugent 1998). Maße von Ring, Torus, Jet und Schlot: Richtwerte nach den Bildern.

import * as THREE from 'three';
import { registerLayers } from '../layers.js';
import { volume, pointCloud, disposeScene } from '../vol.js';
import { createStarfield } from '../stars.js';
import { blackbody, LY } from '../astro.js';

const BODY = /* glsl */ `
uniform float uGain, uMode, uExp, uFil, uFine, uDust;
uniform mat3 uAxis;   // Rahmen der Drehachse des Pulsars
const vec3 SEMI = vec3(6.7, 4.4, 4.6);
// Richtungen der Buchten (im Raum des Ellipsoids, Osten links oben, Westen rechts unten); Nordschlot: Fuß am Nordrand
const vec3 BAY_E = vec3(-0.55, 0.84, 0.0), BAY_W = vec3(0.55, -0.84, 0.0);
const vec3 CH_BASE = vec3(3.3, 3.4, 0.3), CH_DIR = vec3(0.6, 0.8, 0.0);
float chimney(vec3 pe) {
  vec3 c = pe - CH_BASE;
  float h = dot(c, CH_DIR);
  if (h < -0.4 || h > 2.9) return 0.0;
  vec3 w = c - CH_DIR * h;
  w.x -= 0.12 * h;   // leicht nach Osten geneigt
  float wall = exp(-pow((length(w) - 0.6 + 0.08 * h) / 0.12, 2.0));
  // Fäden längs der Röhre: Grat-Rauschen quer gestaucht
  float str = ridged(vec3(w.x * 2.6, h * 0.5, w.z * 2.6) + 4.0, 2);
  return wall * smoothstep(-0.4, 0.4, h) * smoothstep(2.9, 1.4, h) * (0.1 + 1.4 * str * str);
}
void sampleVol(vec3 p, out vec3 e, out float s) {
  e = vec3(0.0);
  s = 0.0;
  vec3 pe = p / uExp;      // mitbewegte Koordinaten: die Struktur wächst mit, ihr Muster bleibt
  float chim = uMode < 0.5 && pe.y > 2.6 ? chimney(pe) : 0.0;
  vec3 q = pe / SEMI;
  float rn = length(q);
  if (rn > 1.16) {   // außerhalb des Ellipsoids nur der Schlot – spart den Großteil der Kugel
    e = vec3(0.5, 0.95, 0.75) * chim * 0.2 * uFil * uGain;
    return;
  }
  vec3 dir = q / max(rn, 1e-4);
  // verformter Radius (1 = Rand): Lappen je Richtung, die Buchten schnüren die Hülle ein
  float bay = exp(-pow(length(dir - BAY_E) / 0.3, 2.0)) + exp(-pow(length(dir - BAY_W) / 0.3, 2.0));
  float rs = rn * (1.0 + 0.08 * gnoise(dir * 2.2 + 3.0) + 0.14 * bay);
  float shell = smoothstep(0.5, 0.78, rs) * smoothstep(1.06, 0.9, rs);   // dünne Hülle: wenige Lagen je Sehstrahl
  float fil = 0.0;
  vec3 fcol = vec3(0.0);
  if (shell > 0.001) {
    // Rayleigh-Taylor-Finger: radial gestreckt (zeigen nach innen); Fäden = Schnitt zweier Grat-Flächen
    vec3 pr = pe - dir * (length(pe) * 0.55);
    float f1 = ridged(pr * 1.25 + vec3(1.3, 2.1, 0.4), OCT), f2 = ridged(pr * 1.25 + vec3(5.2, 7.7, 3.1), OCT);
    float cage = smoothstep(0.48, 0.72, f1 * f2);   // steile Kanten: Fäden statt Dunst
    fil = cage * cage * cage * 2.2;
    // feine Fäden: zweites Netz in dreifacher Dichte, nur am und nahe dem groben Netz (große Filamente zerfasern)
    if (uFine > 0.0 && f1 * f2 > 0.32) {
      float g1 = ridged(pr * 3.6 + vec3(8.1, 3.3, 6.2), 2), g2 = ridged(pr * 3.6 + vec3(2.7, 9.4, 1.5), 2);
      float g = smoothstep(0.36, 0.54, g1 * g2);
      fil += g * g * g * smoothstep(0.32, 0.52, f1 * f2) * 0.9 * uFine;
    }
    float rid = ridged(pe * 0.42 + vec3(1.3, 2.1, 0.4), 3);
    fil *= shell * (0.45 + 0.85 * smoothstep(0.3, 0.8, rid));
    if (uMode < 0.5) {
      // Hα rot, Helium/[S II]-reiche Knoten gelblich, [O III]-Säume grünlich, dichte Kerne heller und weißer
      fcol = mix(vec3(1.0, 0.22, 0.1), vec3(1.0, 0.66, 0.22), smoothstep(-0.2, 0.3, fbm(pe * 0.7, 2)));
      fcol = mix(fcol, vec3(0.35, 0.9, 0.6), smoothstep(0.25, 0.45, fbm(pe * 1.1 + 9.0, 2)) * 0.45);
      fcol = mix(fcol, vec3(1.0, 0.82, 0.66), smoothstep(0.3, 1.2, fil) * 0.35);
      fcol = mix(fcol, vec3(1.0, 0.16, 0.08), smoothstep(0.88, 1.0, rs) * 0.5);   // ganz außen fast nur Hα
    }
  }
  // Rahmen der Drehachse: Fasern des Synchrotronnebels längs des toroidalen Feldes (Rauschen auf einem Kreis je Ort,
  // nahtlos: der Umlauf spannt nur wenige Einheiten auf und streckt die Struktur entlang des Umlaufs)
  vec3 a = uAxis * pe;
  float rho = length(a.xz);
  vec2 cs = a.xz / max(rho, 1e-3);
  float fib = 1.0 - abs(gnoise(vec3(rho * 1.7 + cs.x * 0.6, a.y * 1.7, cs.y * 0.6) + 5.0));
  fib *= fib;
  // Torus, Jet und Wisps (nur nahe am Pulsar)
  float inner = 0.0;
  if (dot(pe, pe) < 5.3) {
    vec3 v = normalize(uAxis * (cameraPosition - p));
    float dop = 1.0 + 0.55 * dot(vec3(cs.x, 0.0, cs.y), v);   // Strömung nach außen: zugewandte Seite heller
    float knots = 0.6 + 0.8 * smoothstep(0.0, 0.45, gnoise(vec3(cs * 3.0, 1.7)));
    float ring = exp(-pow((rho - 0.5) / 0.08, 2.0) - pow(a.y / 0.08, 2.0)) * knots;
    float torus = exp(-pow((rho - 1.3) / 0.22, 2.0) - pow(a.y / 0.18, 2.0));
    if (torus > 0.01) torus *= 0.7 + 0.6 * fbm(a * 2.5, 2);
    vec2 jo = a.xz - vec2(0.1, 0.05) * a.y * a.y;   // Jet biegt nach außen ab
    float jet = exp(-pow(length(jo) / (0.08 + 0.06 * max(a.y, 0.0)), 2.0)) * smoothstep(2.0, 0.2, a.y) * step(0.0, a.y);
    float cjet = exp(-pow(rho / 0.09, 2.0)) * smoothstep(-1.2, -0.1, a.y) * step(a.y, 0.0) * 0.3;   // Gegenjet, schwächer
    float wisp = 0.0;
    for (int k = 0; k < 3; k++) {
      float f = fract(uTime * 0.05 + float(k) / 3.0);
      wisp += exp(-pow((rho - 0.5 - f * 0.9) / 0.07, 2.0) - pow(a.y / 0.09, 2.0)) * (1.0 - f) * knots;
    }
    inner = (ring * 1.4 + torus * 0.9 + wisp * 0.8) * dop + jet * 1.8 + cjet;
  }
  vec3 cSync = vec3(0.5, 0.68, 1.0);
  if (uMode < 0.5) {
    float sync = pow(max(1.0 - rs * rs, 0.0), 1.7) * (0.6 + 0.55 * fbm(pe * 0.33, 3)) * (0.55 + 0.6 * fib);
    e = (fcol * fil * 6.2 * uFil + cSync * (sync * 0.65 + inner * 0.6) + vec3(0.5, 0.95, 0.75) * chim * 0.2 * uFil) * uGain;
    s = fil * 0.9 * uDust;
  } else if (uMode < 1.5) {
    // Chandra-Blick: Ring, Torus + Jet dominieren, innerer Nebel violett-blau, Filamente unsichtbar
    float xray = pow(max(1.0 - rs * rs / 0.3, 0.0), 1.6) * (0.6 + 0.55 * fbm(pe * 0.5, 3)) * (0.6 + 0.5 * fib);
    e = (vec3(0.55, 0.5, 1.0) * xray * 0.6 + vec3(0.85, 0.9, 1.0) * inner * 3.5) * uGain;
  } else {
    // Radio-Blick (VLA): Synchrotron bis zum Rand, Filamente als schwache Fäden; Falschfarbe warm
    float radio = pow(max(1.0 - rs * rs, 0.0), 0.9) * (0.5 + 0.6 * fbm(pe * 0.4 + 2.0, 3)) * (0.7 + 0.4 * fib);
    e = (vec3(1.0, 0.55, 0.2) * radio * 0.9 + vec3(1.0, 0.8, 0.4) * fil * 0.8 * uFil + vec3(1.0, 0.9, 0.7) * inner * 0.5) * uGain;
    s = fil * 0.2;
  }
}
`;

const TODAY = 2026, T0 = 1130;   // Konvergenzjahr der Filament-Bewegung (Nugent 1998: 1130 ± 16)
const R = 8;                     // Volumenkugel: Ellipsoid samt Nordschlot

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 500);
  const sky = createStarfield({ gain: 0.75, seed: 51, ngp: new THREE.Vector3(0.1, 0.95, -0.2), gc: new THREE.Vector3(-0.2, -0.1, -1) });
  scene.add(sky);
  // Drehachse des Pulsars (Ng & Romani 2004): Positionswinkel 124° (von Norden über Osten; Norden liegt im Bild bei 45°),
  // 63° gegen die Sichtlinie, Jet nach Südosten und zu uns hin
  const pa = THREE.MathUtils.degToRad(45 + 124), incl = THREE.MathUtils.degToRad(63);
  const jetDir = new THREE.Vector3(Math.cos(pa) * Math.sin(incl), Math.sin(pa) * Math.sin(incl), Math.cos(incl));
  const axis = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), jetDir));
  const neb = volume({
    radius: R, body: `#define OCT ${ctx.detail > 0.9 ? 4 : 3}\n${BODY}`, steps: Math.round(88 + 64 * ctx.detail), maxSteps: 160,
    uniforms: { uGain: { value: 0.2 }, uFil: { value: 1 }, uFine: { value: 1 }, uDust: { value: 1 }, uMode: { value: 0 }, uExp: { value: 1 },
      uAxis: { value: new THREE.Matrix3().setFromMatrix4(axis).invert() } },
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
  registerLayers('crab', [
    { id: 'gain', type: 'range', group: 'Krebsnebel', label: 'Helligkeit', value: 1, min: 0.25, max: 5, step: 0.25, unit: '×', set: (v) => { neb.material.uniforms.uGain.value = 0.2 * v; } },
    { id: 'fil', type: 'range', label: 'Filamente', value: 1, min: 0, max: 4, step: 0.25, unit: '×', set: (v) => { neb.material.uniforms.uFil.value = v; },
      hint: 'Leuchtende Fäden aus Wasserstoff, Sauerstoff und Schwefel am Rand; im Röntgenbild unsichtbar.' },
    { id: 'fine', type: 'range', label: 'Feine Fäden', value: 1, min: 0, max: 2, step: 0.25, unit: '×', set: (v) => { neb.material.uniforms.uFine.value = v; },
      hint: 'Die großen Filamente zerfasern in dünnere Stränge. Aus = schneller auf schwachen Grafikkarten.' },
    { id: 'dust', type: 'range', label: 'Staub', value: 1, min: 0, max: 3, step: 0.25, unit: '×', set: (v) => { neb.material.uniforms.uDust.value = v; },
      hint: 'Staub in den Filamenten dunkelt das bläuliche Licht dahinter ab.' },
    { id: 'psr', type: 'toggle', group: 'Pulsar', label: 'Pulsar in der Mitte', value: true, set: (v) => { psr.visible = v; } },
  ]);
  const scaleOf = (y) => Math.max(0.03, (y - T0) / (TODAY - T0));
  const controls = [
    { id: 'mode', label: 'Spektrum', value: 'vis', options: [['vis', 'Sichtbar'], ['xray', 'Röntgen'], ['radio', 'Radio']],
      set: (v) => { mode = v; neb.material.uniforms.uMode.value = v === 'vis' ? 0 : v === 'xray' ? 1 : 2; } },
    // Kugel wächst mit: kein Abschneiden in der Zukunft, und in der Vergangenheit dichtere Schritte im kleinen Nebel
    { id: 'year', label: 'Jahr', type: 'range', show: true, marks: [[1054, 'Supernova']], min: 1054, max: 2600, step: 1, value: TODAY, fmt: (v) => `${v} n. Chr.`,
      set: (v) => {
        year = v;
        const k = scaleOf(v);
        neb.material.uniforms.uExp.value = k;
        neb.material.uniforms.uR.value = R * k;
        neb.scale.setScalar(k);
        edge.copy(edgeBase).multiplyScalar(k);
      } },
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
      return `${size} · ${when}${mode === 'xray' ? ' · Röntgen: Ring, Torus + Jet (Chandra)' : mode === 'radio' ? ' · Radio: Synchrotron bis zum Rand' : ''}`;
    },
    setPixelRatio(pr, H) { sky.userData.setPixelRatio(pr); psr.userData.setPx(pr, H, camera.fov); },
    dispose: () => disposeScene(scene),
  };
}
