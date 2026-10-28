// Station 10: Beobachtbares Universum (Einheit 1 Mrd. Lj, mitbewegte Abstände, ΛCDM mit Planck-2018-Werten aus
// astro.js). Wir im Mittelpunkt; Galaxien bis zur Rotverschiebung z ≈ 14 (≈ 34 Mrd. Lj), Farbe nach z röter; dahinter das
// „dunkle Zeitalter“ ohne Sterne; außen die Fläche der letzten Streuung (z = 1 090, ≈ 45,3 Mrd. Lj) mit der
// Hintergrundstrahlung. Ihr Muster ist simuliert: Rauschen in Oktaven, gewichtet wie die Wurzel des gemessenen
// Leistungsspektrums D_ℓ (Sachs-Wolfe-Plateau, erster Peak bei ℓ ≈ 220 ≙ ≈ 0,8°, Dämpfung bei hohen ℓ; Planck 2018).
// Der Dipol (3,36 mK, Richtung l = 264°, b = 48°) stammt von unserer Eigenbewegung und ist üblicherweise abgezogen.
// Der der Kamera zugewandte Teil der Kugel ist ausgeschnitten. Zeitschichten: Schalen zu festen Epochen; Regler „Blick
// zurück“: Schale zur Rückblickzeit mit z, Alter, Temperatur und mitbewegtem Abstand. Fliegt die Kamera in die
// Galaxienwolke hinein, dunkelt die Schale ab, die Galaxien funkeln leise, ferne werden dunstig, große bekommen einen
// feinen Lichthof, die Wolke driftet langsam (Parallaxe) und farbige Gasschleier ziehen durch (alles Darstellung, kein
// Messwert; die Schleier stehen für das dünne, warme Gas zwischen den Galaxien).

import * as THREE from 'three';
import { registerLayers } from '../layers.js';
import { NOISE, CMB } from '../glsl.js';
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
${CMB}
uniform vec3 uCut, uDip;
uniform float uDipOn, uCutCos, uRim, uGlow, uTime, uDim, uIn, uOut, uSat, uAmp, uFine, uEdge, uFlick;
varying vec3 vP, vW;
void main() {
  vec3 d = normalize(vP);
  float c = dot(d, uCut);
  if (c > uCutCos) discard;
  vec3 col = cmbColor(cmbValue(d, uFine, uDipOn, uDip) * uAmp);
  float rim = 1.0 - smoothstep(uCutCos - 0.04, uCutCos, c);
  if (!gl_FrontFacing) { gl_FragColor = vec4(col * 0.26 * uIn * (0.5 + 0.5 * rim) * uDim, 1.0); return; }   // Innenseite = was wir sehen, gedämpft (User 28.10.2026)
  // Außenseite als dünne Glashaut: Muster entsättigt und gedimmt, kühler Saum an der Silhouette (Fresnel)
  col = mix(vec3(dot(col, vec3(0.3, 0.55, 0.15))), col, uSat) * 0.14 * uOut * (0.5 + 0.5 * rim);
  float fr = pow(1.0 - abs(dot(d, normalize(cameraPosition - vW))), 3.0);
  col += vec3(0.55, 0.78, 1.0) * fr * 0.3 * uRim;
  // Schnittkante: schmale Wandstärke (× uEdge); glüht wie das 3000 K heiße Plasma der letzten Streuung (Schwarzkörperfarbe),
  // Glut flackert sehr langsam (≈ 40 s, kein Blitzen; Stärke uFlick) und läuft weich auf die Außenseite aus
  float px = 1.5 * fwidth(c);   // Kante mindestens gut ein Pixel breit, sonst zerfällt sie aus der Ferne in Striche
  float lip = smoothstep(uCutCos - 0.006 * uEdge - px, uCutCos - 0.0015 * uEdge, c);
  col = mix(col, vec3(0.62, 0.70, 0.80) * (0.55 + 0.25 * gnoise(d * 300.0)), lip * (1.0 - min(uGlow, 1.0)));
  float fl = 1.0 + uFlick * (0.25 * gnoise(d * 40.0 + vec3(uTime * 0.15)) - 0.25);
  float core = smoothstep(uCutCos - 0.004 * uEdge - px, uCutCos - 0.0005 * uEdge, c);
  col += vec3(1.0, 0.63, 0.33) * (0.9 * fl * exp(-(uCutCos - c) / (0.018 * uEdge * fl)) + 2.2 * core * mix(1.0, fl, 0.3)) * uGlow;   // Kern flackert schwächer, sonst wirkt er gestrichelt
  gl_FragColor = vec4(col, 1.0);
}
`;
// Galaxien: Punkt-Shader aus vol.js plus Funkeln – je Punkt eigene Phase, Periode 3–10 s (weit unter 3 Hz) und Stärke;
// meist gedämpft, selten ein weicher Höhepunkt (w³). Tiefen-Dunst: ferne Punkte dunkler und kühler. Lichthof: große
// Punkte werden breiter gezeichnet, der Kern bleibt gleich groß (vK), der Rest ist ein schwacher Hof. uTw, uHaze, uHalo
// sind außerhalb der Wolke 0
const GAL_VERT = /* glsl */ `
attribute vec3 color;
attribute float size, phase;
uniform float uPx, uScale, uMin, uMax, uFade, uGain, uTime, uTw, uHaze, uHalo;
varying vec3 vCol;
varying float vK, vHalo;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = size * uScale / max(-mv.z, 1e-6);
  float d = clamp(px, uMin * uPx, uMax * uPx);
  float near = 1.0 - smoothstep(uFade * uPx, uFade * 3.0 * uPx, px);
  float w = 0.5 + 0.5 * sin(uTime * (0.6 + 1.5 * fract(phase * 7.31)) + phase * 6.2832);
  float tw = mix(1.0, 0.55 + 1.15 * w * w * w, uTw * fract(phase * 3.17));
  vec3 haze = mix(vec3(1.0), vec3(0.35, 0.45, 0.75), clamp(uHaze * smoothstep(3.0, 28.0, -mv.z), 0.0, 1.0));
  vCol = color * haze * uGain * tw * min(1.0, (px * px) / (d * d) * 4.0) * near;
  vHalo = uHalo * smoothstep(0.065, 0.1, size);
  vK = 1.0 + 1.5 * min(vHalo, 1.0);
  gl_PointSize = d * vK;
}
`;
const GAL_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vK, vHalo;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float q = dot(d, d);
  gl_FragColor = vec4(vCol * (exp(-q * 12.8 * vK * vK) + 0.22 * vHalo * exp(-q * 14.0)), 1.0);
}
`;
// Gasschleier: große, zur Kamera gedrehte Scheiben mit langsam ziehendem Rauschen; nah an einer Scheibe blendet sie aus,
// sonst wirkt sie flach und füllt das ganze Bild
const VEIL_VERT = /* glsl */ `
uniform vec3 uC;
uniform float uS;
varying vec2 vUv;
varying float vNear;
void main() {
  vec4 mv = viewMatrix * vec4(uC, 1.0);
  mv.xy += position.xy * uS;
  vUv = position.xy;
  vNear = smoothstep(uS * 0.35, uS * 0.9, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;
const VEIL_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uColor;
uniform float uSeed, uTime, uGain;
varying vec2 vUv;
varying float vNear;
void main() {
  float r = length(vUv);
  if (r > 1.0 || vNear < 0.001) discard;
  vec3 p = vec3(vUv * 1.6, uSeed) + vec3(0.004, -0.003, 0.006) * uTime;
  float m = smoothstep(0.42, 0.85, 0.5 + 0.5 * fbm(p, 3) + 0.25 * fbm(p * 2.7 + 3.1, 2));
  gl_FragColor = vec4(uColor * m * pow(1.0 - r, 1.6) * vNear * uGain, 1.0);
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
    vertexShader: 'varying vec3 vP, vW; void main() { vP = position; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
    fragmentShader: SHELL_FRAG,
    uniforms: { uCut: { value: cut }, uCutCos: { value: 0.62 }, uDip: { value: dip }, uDipOn: { value: 0 }, uRim: { value: 1 }, uGlow: { value: 1 }, uTime: { value: 0 }, uDim: { value: 1 },
      uIn: { value: 1 }, uOut: { value: 1 }, uSat: { value: 0.55 }, uAmp: { value: 1 }, uFine: { value: 1 }, uEdge: { value: 1 }, uFlick: { value: 1 } },
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

  // Galaxien: gleichmäßig im Volumen mit leichter Häufung, Farbe nach Rotverschiebung, Helligkeit nach Abstand; Größe
  // gestreut (meist klein, wenige große), Phase für das Funkeln
  const rand = mulberry32(13);
  const pos = [], col = [], size = [], phase = [];
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
    size.push(0.05 * (0.5 + 0.6 * rand() + 1.1 * rand() ** 8));
    phase.push(rand());
  }
  const gal = pointCloud(pos, col, size, { min: 1.05, fade: 9, vert: GAL_VERT, frag: GAL_FRAG });   // nahe Punkte früh aus, sonst weiche Flecken
  gal.geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phase, 1));
  Object.assign(gal.material.uniforms, { uTime: { value: 0 }, uTw: { value: 0 }, uHaze: { value: 0 }, uHalo: { value: 0 } });
  scene.add(gal);
  // Gasschleier: 7 Scheiben im inneren Teil der Wolke, gedämpfte Farben (Türkis, Altrosa, Violett, Bernstein)
  const veils = new THREE.Group();
  const veilGeo = new THREE.PlaneGeometry(2, 2);
  const VEIL_COL = [0x3f8f9a, 0xa0587a, 0x6a5aa8, 0xa77a45];
  const veilAt = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Vector3(gauss(rand), gauss(rand), gauss(rand)).normalize().multiplyScalar(3 + rand() * R_GAL * 0.6);
    veilAt.push(c);
    const m = new THREE.Mesh(veilGeo, new THREE.ShaderMaterial({
      vertexShader: VEIL_VERT, fragmentShader: VEIL_FRAG, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true,
      uniforms: { uC: { value: c.clone() }, uS: { value: 6 + rand() * 8 }, uColor: { value: new THREE.Color(VEIL_COL[i % 4]) }, uSeed: { value: rand() * 50 }, uTime: { value: 0 }, uGain: { value: 0 } },
    }));
    m.frustumCulled = false;
    veils.add(m);
  }
  veils.visible = false;
  scene.add(veils);
  const we = pointCloud([0, 0, 0], [6, 5.5, 4.6], [0.05], { min: 3 });
  scene.add(we);

  // Auftakt (opener.js): Galaxien und „Wir“ blenden beim Rückzug aus der Kugel ein (rise 0 … 1), Regler bleibt Grundwert
  let galBase = 1, rise = 1;
  const gains = () => { gal.material.uniforms.uGain.value = galBase * rise; we.material.uniforms.uGain.value = rise; };

  // Kamera in der Wolke (inside 0 … 1 zwischen ihrem Rand und gut halbem Radius): Schale dunkler, Galaxien funkeln
  let dimMax = 0.9, twBase = 1, hazeBase = 1, haloBase = 1, driftBase = 1, veilBase = 1;
  const drift = new THREE.Vector3();

  let back_t = 0, probeInfo = null;
  const probePos = new THREE.Vector3();
  const hs0 = new THREE.Vector3(), hs1 = new THREE.Vector3(), cmbPos = () => hotspots[1].pos;
  const hotspots = [
    { id: 'we', kind: 'dive', to: 'web', pos: new THREE.Vector3() },
    { id: 'cmb', kind: 'info', pos: back.clone().addScaledVector(sideV, 0.45).normalize().multiplyScalar(R_LSS),
      // von außen nur auf der zugewandten Seite der Schale (sonst liegt der Punkt hinter ihr)
      visible: (cam) => cam.position.length() < R_LSS || hs0.copy(cam.position).sub(cmbPos()).normalize().dot(hs1.copy(cmbPos()).normalize()) > 0.15 },
    { id: 'dawn', kind: 'info', pos: back.clone().addScaledVector(sideV, -0.6).add(new THREE.Vector3(0, 0.3, 0)).normalize().multiplyScalar(R_GAL) },
    { id: 'hubble', kind: 'info', pos: sideV.clone().multiplyScalar(12).add(new THREE.Vector3(0, 6, 0)) },
    { id: 'probe', kind: 'info', pos: probePos, visible: () => back_t > 0 },
    ...EPOCHS.filter(([, id]) => id !== 'dawn').map(([, id]) => ({ id, kind: 'label', cls: 'hsl--faint', pos: epochPos[id], visible: () => layers.visible })),
  ];
  const fmtT = (v) => `${v.toFixed(2).replace('.', ',')} Mrd. J.`;
  // Reiter „Kugel“ (Fläche der letzten Streuung): Muster, Hülle, Schnittkante. Öffnung gilt gemeinsam für Schale,
  // Zeitschichten und Regler-Schale; alle übrigen Werte sind Darstellung, die Messwerte bleiben unberührt
  const cutMats = [shellMat, probe.material, ...layers.children.map((m) => m.material)];
  const su = (k) => (v) => { shellMat.uniforms[k].value = v; };
  registerLayers('cmb', [
    { id: 'amp', type: 'range', group: 'Hintergrundstrahlung', label: 'Kontrast des Musters', value: 1, min: 0.25, max: 3, step: 0.25, unit: '×', set: su('uAmp'),
      hint: 'Spreizt die Temperaturschwankungen auf der Farbskala; 1× ≙ ±300 µK von Blau bis Rot.' },
    { id: 'fine', type: 'range', group: 'Hintergrundstrahlung', label: 'Feine Flecken', value: 100, min: 0, max: 100, step: 5, fmt: (v) => `${v} %`, set: (v) => { shellMat.uniforms.uFine.value = v / 100; },
      hint: 'Anteil der kleinen Flecken (hohe ℓ, unter 1°); 0 = nur die großen Flecken des Sachs-Wolfe-Plateaus.' },
    { id: 'cut', type: 'range', group: 'Hülle der Kugel', label: 'Öffnung der Schale', value: 52, min: 0, max: 85, step: 1, fmt: (v) => (v ? `${v}°` : 'geschlossen'),
      set: (v) => cutMats.forEach((m) => { m.uniforms.uCutCos.value = v ? Math.cos(v * Math.PI / 180) : 2; }),
      hint: 'Halber Öffnungswinkel des Fensters zur Kamera; geschlossen zeigt die ganze Kugel von außen.' },
    { id: 'inner', type: 'range', group: 'Hülle der Kugel', label: 'Helligkeit innen', value: 1, min: 0, max: 3, step: 0.25, unit: '×', set: su('uIn'),
      hint: 'Innenseite, also der Himmel, den wir von der Erde aus sehen; 0 = dunkel.' },
    { id: 'outer', type: 'range', group: 'Hülle der Kugel', label: 'Helligkeit außen', value: 1, min: 0, max: 4, step: 0.25, unit: '×', set: su('uOut'),
      hint: 'Außenseite als dünne Glashaut; 0 = nur Randlicht und Schnittkante.' },
    { id: 'sat', type: 'range', group: 'Hülle der Kugel', label: 'Farbe außen', value: 55, min: 0, max: 100, step: 5, fmt: (v) => `${v} %`, set: (v) => { shellMat.uniforms.uSat.value = v / 100; },
      hint: 'Wie bunt das Muster auf der Außenseite bleibt; 0 = grau, 100 % = Farbe wie innen.' },
    { id: 'rim', type: 'range', group: 'Hülle der Kugel', label: 'Randlicht der Hülle', value: 1, min: 0, max: 3, step: 0.25, unit: '×',
      set: su('uRim'), hint: 'Kühler Lichtsaum am Umriss der Kugel; 0 = aus.' },
    { id: 'dim', type: 'range', group: 'Hülle der Kugel', label: 'Abdunkeln von innen', value: 90, min: 0, max: 95, step: 5, fmt: (v) => `${v} %`,
      set: (v) => { dimMax = v / 100; }, hint: 'Wie stark die Schale dunkler wird, wenn die Kamera auf die Galaxien zu und zwischen sie fliegt; 0 = gleich hell.' },
    { id: 'glow', type: 'range', group: 'Schnittkante', label: 'Glut der Schnittkante', value: 1, min: 0, max: 3, step: 0.25, unit: '×',
      set: su('uGlow'), hint: 'Kante leuchtet in der Farbe des 3.000 K heißen Plasmas; 0 = nur die Wandstärke.' },
    { id: 'edge', type: 'range', group: 'Schnittkante', label: 'Wandstärke', value: 1, min: 0.25, max: 4, step: 0.25, unit: '×', set: su('uEdge'),
      hint: 'Breite der Kante und ihres Glühens; in Wirklichkeit ist die Schale gut 40 Mio. Lj dick (Dauer der Rekombination).' },
    { id: 'flick', type: 'range', group: 'Schnittkante', label: 'Flackern der Glut', value: 1, min: 0, max: 2, step: 0.25, unit: '×', set: su('uFlick'),
      hint: 'Glut wogt sehr langsam (≈ 40 s, kein Blitzen); 0 = ruhig.' },
    { id: 'galGain', type: 'range', group: 'Galaxien', label: 'Helligkeit', value: 1, min: 0, max: 5, step: 0.25, unit: '×', set: (v) => { galBase = v; gains(); } },
    { id: 'twinkle', type: 'range', group: 'Galaxien', label: 'Funkeln in der Wolke', value: 1, min: 0, max: 2, step: 0.25, unit: '×',
      set: (v) => { twBase = v; }, hint: 'Galaxien leuchten einzeln langsam auf und ab, sobald die Kamera zwischen ihnen ist; 0 = ruhig.' },
    { id: 'haze', type: 'range', group: 'Galaxien', label: 'Tiefen-Dunst', value: 1, min: 0, max: 2, step: 0.25, unit: '×',
      set: (v) => { hazeBase = v; }, hint: 'In der Wolke werden ferne Galaxien dunkler und bläulich, nahe bleiben klar; 0 = aus.' },
    { id: 'halo', type: 'range', group: 'Galaxien', label: 'Lichthof großer Galaxien', value: 1, min: 0, max: 2, step: 0.25, unit: '×',
      set: (v) => { haloBase = v; }, hint: 'Die wenigen großen Galaxien bekommen in der Wolke einen feinen, weichen Hof; 0 = aus.' },
    { id: 'drift', type: 'range', group: 'Galaxien', label: 'Eigendrift', value: 1, min: 0, max: 2, step: 0.25, unit: '×',
      set: (v) => { driftBase = v; }, hint: 'Die Wolke treibt in der Nähe ganz langsam hin und her; nahe Galaxien ziehen schneller vorbei als ferne; 0 = still.' },
    { id: 'veils', type: 'range', group: 'Galaxien', label: 'Gasschleier', value: 1, min: 0, max: 3, step: 0.25, unit: '×',
      set: (v) => { veilBase = v; }, hint: 'Farbige Schleier für das dünne, warme Gas zwischen den Galaxien, nur in der Wolke; 0 = aus.' },
    { id: 'layerGain', type: 'range', group: 'Zeitschichten', label: 'Helligkeit', value: 1, min: 0.25, max: 6, step: 0.25, unit: '×',
      set: (v) => layers.children.forEach((m) => { m.material.uniforms.uGain.value = 0.07 * v; }), active: () => layers.visible, only: 'Erst im Reiter Station unter Ansicht „Zeitschichten“ einschalten.' },
  ]);
  const controls = [
    { id: 'dip', label: 'Dipol', value: 'off', options: [['off', 'Abgezogen'], ['on', 'Sichtbar']], set: (v) => { shellMat.uniforms.uDipOn.value = v === 'on' ? 1 : 0; } },
    { id: 'layers', label: 'Zeitschichten', value: 'off', options: [['off', 'Aus'], ['on', 'Epochen']], set: (v) => { layers.visible = v === 'on'; } },
    { id: 'back', label: 'Blick zurück', type: 'range', show: true, min: 0, max: Math.floor(AGE * 100) / 100, step: 0.01, value: 0, fmt: (v) => (v ? fmtT(v) : 'heute'),
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
    // Schale für den Auftakt-Film: Radius und dieselben Uniforms (Öffnung, Dipol), damit sein letztes Bild deckungsgleich ist
    shell: { radius: R_LSS, uniforms: shellMat.uniforms },
    opening(k) { rise = k; gains(); },
    orbit: { minDistance: 4, maxDistance: 320, cineSpeed: 0.45 },
    look: { exposure: 1.05, bloom: 0.07, sat: 1.05, con: 0.12 },
    update(dt, t) {
      const r = camera.position.length();
      const inside = 1 - THREE.MathUtils.smoothstep(r, R_GAL * 0.45, R_GAL * 1.05);
      shellMat.uniforms.uTime.value = t;
      // Schale dunkelt schon beim Heranzoomen ab (ab gut 2 × Schalenradius), voll ab dem Rand der Galaxienwolke (User 28.10.2026)
      shellMat.uniforms.uDim.value = 1 - dimMax * (1 - THREE.MathUtils.smoothstep(r, R_GAL, R_LSS * 2.2));
      const gu = gal.material.uniforms;
      gu.uTime.value = t;
      gu.uTw.value = twBase * inside;
      gu.uHaze.value = hazeBase * inside;
      gu.uHalo.value = haloBase * inside;
      // Drift: Perioden 200–370 s, höchstens gut 1 Mrd. Lj Ausschlag; draußen steht die Wolke an ihrem Platz
      drift.set(Math.sin(t * 0.031), Math.sin(t * 0.023 + 1), Math.sin(t * 0.017 + 2)).multiplyScalar(1.2 * driftBase * inside);
      gal.position.copy(drift);
      const vg = 0.7 * veilBase * inside;
      veils.visible = vg > 0.001;
      if (veils.visible) veils.children.forEach((m, i) => { const u = m.material.uniforms; u.uTime.value = t; u.uGain.value = vg; u.uC.value.copy(veilAt[i]).add(drift); });
    },
    live: () => (probeInfo
      ? `Vor ${fmtT(back_t)}: z = ${probeInfo.z < 10 ? probeInfo.z.toFixed(2).replace('.', ',') : Math.round(probeInfo.z)} · Alter ${probeInfo.age < 1 ? `${Math.round(probeInfo.age * 1000)} Mio. J.` : fmtT(probeInfo.age)} · ${probeInfo.T.toFixed(1).replace('.', ',')} K · heute ${probeInfo.r.toFixed(1).replace('.', ',')} Mrd. Lj entfernt`
      : `ΛCDM (Planck 2018): Alter ${fmtT(AGE)} · Horizont ${R_LSS.toFixed(1).replace('.', ',')} Mrd. Lj · letzte Streuung z = 1.090`),
    setPixelRatio(pr, H) { gal.userData.setPx(pr, H, camera.fov); we.userData.setPx(pr, H, camera.fov); },
    dispose: () => disposeScene(scene),
  };
}
