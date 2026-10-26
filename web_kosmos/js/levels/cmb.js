// Station 10: Beobachtbares Universum (Einheit 1 Mrd. Lj, mitbewegte Abstände, ΛCDM mit Planck-2018-Werten aus
// astro.js). Wir im Mittelpunkt; Galaxien bis zur Rotverschiebung z ≈ 14 (≈ 34 Mrd. Lj), Farbe nach z röter; dahinter das
// „dunkle Zeitalter“ ohne Sterne; außen die Fläche der letzten Streuung (z = 1 090, ≈ 45,3 Mrd. Lj) mit der
// Hintergrundstrahlung. Ihr Muster ist simuliert: Rauschen in Oktaven, gewichtet wie die Wurzel des gemessenen
// Leistungsspektrums D_ℓ (Sachs-Wolfe-Plateau, erster Peak bei ℓ ≈ 220 ≙ ≈ 0,8°, Dämpfung bei hohen ℓ; Planck 2018).
// Der Dipol (3,36 mK, Richtung l = 264°, b = 48°) stammt von unserer Eigenbewegung und ist üblicherweise abgezogen.
// Der der Kamera zugewandte Teil der Kugel ist ausgeschnitten. Zeitschichten: Schalen zu festen Epochen; Regler „Blick
// zurück“: Schale zur Rückblickzeit mit z, Alter, Temperatur und mitbewegtem Abstand.

import * as THREE from 'three';
import { NOISE } from '../glsl.js';
import { pointCloud, disposeScene } from '../vol.js';
import { galToScene, mulberry32, gauss, blackbody, GLY, YEAR, cosmo, cosmoAge, zAtLookback } from '../astro.js';

const R_LSS = cosmo(1090).dc / GLY, R_GAL = cosmo(14.3).dc / GLY;
// Nachschlagetabelle Abstand → z (200 Stützstellen, logarithmisch in 1+z)
const ZT = Array.from({ length: 220 }, (_, i) => { const z = Math.exp((i / 219) * Math.log(1101)) - 1; return [cosmo(z).dc / GLY, z]; });
const zOf = (r) => { for (let i = 1; i < ZT.length; i++) if (r <= ZT[i][0]) { const [a, za] = ZT[i - 1], [b, zb] = ZT[i]; return za + (zb - za) * (r - a) / (b - a); } return 1090; };
const AGE = cosmoAge() / YEAR / 1e9;
// Epochen (z, Kurzname): Dunkle Energie dominiert ab z ≈ 0,3, Hochzeit der Sternentstehung z ≈ 2, Reionisation endet
// z ≈ 6, fernste bestätigte Galaxie z = 14,3 (JADES), erste Sterne z ≈ 20
const EPOCHS = [[0.3, 'darkenergy'], [2, 'noon'], [6, 'reion'], [14.3, 'dawn'], [20, 'firststars']];

const SHELL_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uCut, uDip;
uniform float uDipOn, uCutCos;
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
  vec3 d = normalize(vP);
  if (dot(d, uCut) > uCutCos) discard;
  // Oktaven ~ ℓ ≈ 10, 25, 50, 100, 220, 450, 900 mit Gewicht √D_ℓ (relativ zum ersten Peak)
  float f = 0.42 * gnoise(d * 5.0) + 0.42 * gnoise(d * 12.0 + 3.1) + 0.45 * gnoise(d * 25.0 + 7.3) + 0.65 * gnoise(d * 50.0 + 1.7)
          + 1.0 * gnoise(d * 100.0 + 4.4) + 0.7 * gnoise(d * 200.0 + 9.2) + 0.5 * gnoise(d * 400.0 + 2.8);
  float x = f * 1.15;   // ≈ ±300 µK auf ±1
  if (uDipOn > 0.5) x = x * 0.09 + dot(d, uDip) * 1.0;   // Dipol ±3,36 mK ≙ ±1, Anisotropie dann winzig
  vec3 col = planck(x);
  float inner = gl_FrontFacing ? 0.2 : 0.4;   // Außenseite dunkler, Innenseite = was wir sehen
  float rim = 1.0 - smoothstep(uCutCos - 0.04, uCutCos, dot(d, uCut));
  gl_FragColor = vec4(col * inner * (0.5 + 0.5 * rim) * 0.9, 1.0);
}
`;
// Zeitschicht: dünne, zarte Kugel mit leichtem Rauschen, Ausschnitt wie die Hauptkugel
const LAYER_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uCut, uColor;
uniform float uCutCos, uGain;
varying vec3 vP;
void main() {
  vec3 d = normalize(vP);
  if (dot(d, uCut) > uCutCos) discard;
  float n = 0.6 + 0.4 * fbm(d * 9.0, 3);
  float rim = 1.0 - smoothstep(uCutCos - 0.1, uCutCos, dot(d, uCut));
  gl_FragColor = vec4(uColor * n * uGain * (0.4 + 0.6 * rim), 1.0);
}
`;

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
  const home = { pos: new THREE.Vector3(78, 48, 104), target: new THREE.Vector3(0, 0, 0) };
  const cut = home.pos.clone().normalize();
  const dip = new THREE.Vector3(...galToScene(264.02, 48.25, 1, 0)).normalize();
  const shellMat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: SHELL_FRAG,
    uniforms: { uCut: { value: cut }, uCutCos: { value: 0.62 }, uDip: { value: dip }, uDipOn: { value: 0 } },
    side: THREE.DoubleSide,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R_LSS, 192, 96), shellMat);
  scene.add(shell);

  // Zeitschichten + bewegliche Schale (Regler)
  const layerMat = (color, gain) => new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: LAYER_FRAG, uniforms: { uCut: { value: cut }, uCutCos: { value: 0.62 }, uColor: { value: new THREE.Color(color) }, uGain: { value: gain } },
    side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const layers = new THREE.Group();
  layers.visible = false;
  scene.add(layers);
  const sideV = new THREE.Vector3().crossVectors(cut, new THREE.Vector3(0, 1, 0)).normalize();
  const back = cut.clone().negate();
  const epochPos = {};
  for (const [z, id] of EPOCHS) {
    const r = cosmo(z).dc / GLY;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 96, 48), layerMat(z < 1 ? 0x7fb8ff : z < 10 ? 0xa9d4ff : 0xffc08a, 0.07));
    layers.add(m);
    epochPos[id] = back.clone().addScaledVector(sideV, -0.35 + (EPOCHS.findIndex((e) => e[1] === id) % 2) * 0.7).add(new THREE.Vector3(0, 0.25, 0)).normalize().multiplyScalar(r);
  }
  const probe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), layerMat(0x33ccff, 0.16));
  probe.visible = false;
  scene.add(probe);

  // Galaxien: gleichmäßig im Volumen mit leichter Häufung, Farbe nach Rotverschiebung, Helligkeit nach Abstand
  const rand = mulberry32(13);
  const pos = [], col = [], size = [];
  const n = Math.round(160000 * ctx.detail);
  const centers = Array.from({ length: 3000 }, () => new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(R_GAL * Math.cbrt(rand())));
  for (let i = 0; i < n; i++) {
    const c = centers[Math.floor(rand() * centers.length)];
    const p = rand() < 0.6 ? c.clone().add(new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).multiplyScalar(0.5))
      : new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(R_GAL * Math.cbrt(rand()));
    const r = p.length();
    if (r > R_GAL) continue;
    const z = zOf(r);
    // beobachtete Farbe: bei wachsendem z zu Rot verschoben (Darstellung der Rotverschiebung)
    const T = 6500 / (1 + z * 0.55);
    pos.push(p.x, p.y, p.z);
    col.push(...blackbody(Math.max(1800, T)).map((v) => v * 6 * (0.25 + rand() * 0.6) * (r < 1 ? 0.3 : 1)));
    size.push(0.05);
  }
  const gal = pointCloud(pos, col, size, { min: 1.05 });
  scene.add(gal);
  const we = pointCloud([0, 0, 0], [6, 5.5, 4.6], [0.05], { min: 3 });
  scene.add(we);

  let back_t = 0, probeInfo = null;
  const probePos = new THREE.Vector3();
  const hotspots = [
    { id: 'we', kind: 'dive', to: 'web', pos: new THREE.Vector3() },
    { id: 'cmb', kind: 'info', pos: back.clone().addScaledVector(sideV, 0.45).normalize().multiplyScalar(R_LSS) },
    { id: 'dawn', kind: 'info', pos: back.clone().addScaledVector(sideV, -0.6).add(new THREE.Vector3(0, 0.3, 0)).normalize().multiplyScalar(R_GAL) },
    { id: 'hubble', kind: 'info', pos: sideV.clone().multiplyScalar(12).add(new THREE.Vector3(0, 6, 0)) },
    { id: 'probe', kind: 'info', pos: probePos, visible: () => back_t > 0 },
    ...EPOCHS.filter(([, id]) => id !== 'dawn').map(([, id]) => ({ id, kind: 'label', cls: 'hsl--faint', pos: epochPos[id], visible: () => layers.visible })),
  ];
  const fmtT = (v) => `${v.toFixed(2).replace('.', ',')} Mrd. J.`;
  const controls = [
    { id: 'dip', label: 'Dipol', value: 'off', options: [['off', 'Abgezogen'], ['on', 'Sichtbar']], set: (v) => { shellMat.uniforms.uDipOn.value = v === 'on' ? 1 : 0; } },
    { id: 'layers', label: 'Zeitschichten', value: 'off', options: [['off', 'Aus'], ['on', 'Epochen']], set: (v) => { layers.visible = v === 'on'; } },
    { id: 'back', label: 'Blick zurück', type: 'range', min: 0, max: Math.floor(AGE * 100) / 100, step: 0.01, value: 0, fmt: (v) => (v ? fmtT(v) : 'heute'),
      set: (v) => {
        back_t = v;
        if (!v) { probe.visible = false; probeInfo = null; return; }
        const z = zAtLookback(v * 1e9 * YEAR);
        const c = cosmo(z);
        const r = c.dc / GLY;
        probe.scale.setScalar(Math.max(r, 0.05));
        probe.visible = true;
        probePos.copy(back).addScaledVector(sideV, 0.2).normalize().multiplyScalar(r);
        probeInfo = { z, r, age: c.age / YEAR / 1e9, T: c.T };
      } },
  ];

  return {
    scene, camera, unit: GLY, hotspots, controls, home,
    orbit: { minDistance: 4, maxDistance: 320, cineSpeed: 0.45 },
    look: { exposure: 1.05, bloom: 0.07, sat: 1.05, con: 0.12 },
    update() {},
    live: () => (probeInfo
      ? `Vor ${fmtT(back_t)}: z = ${probeInfo.z < 10 ? probeInfo.z.toFixed(2).replace('.', ',') : Math.round(probeInfo.z)} · Alter ${probeInfo.age < 1 ? `${Math.round(probeInfo.age * 1000)} Mio. J.` : fmtT(probeInfo.age)} · ${probeInfo.T.toFixed(1).replace('.', ',')} K · heute ${probeInfo.r.toFixed(1).replace('.', ',')} Mrd. Lj entfernt`
      : `ΛCDM (Planck 2018): Alter ${fmtT(AGE)} · Horizont ${R_LSS.toFixed(1).replace('.', ',')} Mrd. Lj · letzte Streuung z = 1.090`),
    setPixelRatio(pr, H) { gal.userData.setPx(pr, H, camera.fov); we.userData.setPx(pr, H, camera.fov); },
    dispose: () => disposeScene(scene),
  };
}
