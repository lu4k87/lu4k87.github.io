// Looks A–G (Paletten, Schriften, Signale) + eine Render-Pipeline für alle Looks.
// Pipeline (KONZEPT.md §2): ACES · Hemisphere + Sonne mit weichen Schatten + schwaches Gegenlicht ·
// Kanten-Pass dezent (nur Looks mit edges) · Bloom nur für Emissive · GTAO nur hinter ?ao=1 · reduced-motion ohne Fahrten.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// signal = nur für Abweichungen: ask = wartet auf dich, err = Fehler/Stopp, ok = kurz bestätigt
export const LOOKS = {
  A: {
    name: 'Blaupause', cast: 'paper', bg: '#F0EBDE', paper: '#F0EBDE', paper2: '#E6E0CE', ink: '#1F2BE0', inkSoft: '#5560E5',
    floor: '#F3EFE4', pad: '#ECE6D6', wall: '#F7F4EC', prop: '#FBF9F3', prop2: '#E3DCC8', screen: '#F7F4EC',
    skin: ['#FBF9F3', '#F2D9C4'], body: '#FBF9F3', subBody: '#E6E0CE', player: '#1F2BE0', playerInk: '#F0EBDE',
    signal: { ask: '#FFB000', err: '#F2385A', ok: '#14B87A', info: '#1F2BE0' },
    grid: 'fine', edges: true, edgeColor: '#1F2BE0', hemi: ['#FFFFFF', '#F3EEE2', 2.1], sun: ['#FFFFFF', 1.0], fog: null, wallH: 1.05,
    font: '"Hanken Grotesk", system-ui, sans-serif', mono: '"DM Mono", ui-monospace, monospace', label: { bg: '#F7F4EC', fg: '#1F2BE0', border: '#1F2BE0' },
    walk: '#E6E0CE', walkLine: '#1F2BE0', walkLineA: 0.35, walkDash: [0.6, 0.4],
  },
  B: {
    name: 'Nachtschicht', cast: 'neon', dark: true, bg: '#0B132B', paper: '#0B132B', paper2: '#1C2541', ink: '#6FFFE9', inkSoft: '#5BC0BE',
    floor: '#121A36', pad: '#1C2541', wall: '#1C2541', prop: '#2A3A5C', prop2: '#3A506B', screen: '#0B132B',
    skin: ['#F2C9A8', '#C98E64', '#8D5A3B', '#F7DCC3'], body: '#3A506B', subBody: '#2A3A5C', player: '#E9F1FF', playerInk: '#0B132B',
    signal: { ask: '#FFD23F', err: '#FF4D6D', ok: '#3BCEAC', info: '#70D6FF' },
    roles: { organizer: '#E9F1FF', designer: '#F72585', dev: '#4CC9F0', editor: '#B8C0FF', pm: '#7678ED', scrum: '#FF70A6', research: '#6FFFE9', mkt: '#C77DFF', d3: '#5390D9', tester: '#48BFE3', sync: '#80FFDB' },
    edges: false, hemi: ['#C9D4FF', '#3A4A7A', 2.0], sun: ['#E3E8FF', 0.9], fog: ['#0B132B', 40, 110], wallH: 0.6, neon: true,
    font: '"Chakra Petch", system-ui, sans-serif', mono: '"JetBrains Mono", ui-monospace, monospace', label: { bg: 'rgba(11,19,43,.92)', fg: '#E9F1FF', border: '#4CC9F0' },
    walk: '#1C2541', walkLine: '#4CC9F0', walkLineA: 0.5, walkDash: [0.3, 0.5],
  },
  C: {
    name: 'Bonbon', cast: 'pastel', bg: '#F5F5F0', paper: '#F5F5F0', paper2: '#E9EDC9', ink: '#1E1E1E', inkSoft: '#4A5759',
    floor: '#E2F0DA', pad: '#FAF3DD', wall: '#FFFFFF', prop: '#FFFFFF', prop2: '#FAEDCD', screen: '#FFFFFF',
    skin: ['#F7D9C4', '#E0AC86', '#B07A55', '#7A4E33', '#F4E1D2'], body: '#FFFFFF', subBody: '#E7C6FF', player: '#1E1E1E', playerInk: '#FFFFFF',
    signal: { ask: '#FFB000', err: '#E8423A', ok: '#2BB673', info: '#4E71FF' },
    roles: { organizer: '#FFFFFF', designer: '#C5B5E0', dev: '#8BB4F7', editor: '#A8E6CF', pm: '#F5B895', scrum: '#C4D94E', research: '#A06CE8', mkt: '#FFAFCC', d3: '#CCD5AE', tester: '#83C5BE', sync: '#BDE0FE' },
    edges: true, edgeColor: '#1E1E1E', hemi: ['#FFFFFF', '#F2F7F0', 2.0], sun: ['#FFF6E8', 1.1], fog: null, wallH: 0.8,
    font: '"Fredoka", system-ui, sans-serif', mono: '"Atkinson Hyperlegible", ui-monospace, monospace', label: { bg: '#FFFFFF', fg: '#1E1E1E', border: '#1E1E1E' },
    padR: 0.6, walk: '#FAF3DD', walkW: 2.4, walkLine: '#1E1E1E', walkLineA: 0.35, walkDash: [0.6, 0.4],
  },
  D: {
    name: 'Obsidian', cast: 'metal', dark: true, bg: '#0C0C0E', paper: '#0C0C0E', paper2: '#1A1A1F', ink: '#D8B878', inkSoft: '#8C7650',
    floor: '#141417', pad: '#1C1C21', wall: '#232329', prop: '#2C2C33', prop2: '#3A3A42', screen: '#0C0C0E',
    skin: ['#2C2C33', '#3A3A42'], body: '#2C2C33', subBody: '#1C1C21', player: '#D8B878', playerInk: '#0C0C0E',
    signal: { ask: '#FFC24B', err: '#FF5C5C', ok: '#5FD3A0', info: '#D8B878' },
    roles: { organizer: '#F2E6C9', designer: '#D8B878', dev: '#C9A15A', editor: '#E8D5A8', pm: '#B89254', scrum: '#F0C987', research: '#D0B48A', mkt: '#E2C28F', d3: '#A8895A', tester: '#CDB27E', sync: '#F5E1B5' },
    walk: '#1E1E23', walkLine: '#D8B878', walkLineA: 0.35, walkDash: [0.15, 0.5], stripe: 'rgba(216,184,120,.03)',
    edges: false, leaf: '#3E4A3C', hemi: ['#8A8490', '#1A1A1F', 1.6], sun: ['#FFE7C2', 2.4], fog: ['#0C0C0E', 60, 170], wallH: 0.9, metal: 0.45, rough: 0.42,
    font: '"Syne", system-ui, sans-serif', mono: '"Red Hat Mono", ui-monospace, monospace', label: { bg: 'rgba(12,12,14,.92)', fg: '#F2E6C9', border: '#D8B878' },
  },
  E: {
    name: 'Beton', cast: 'fabric', bg: '#BDB8AF', paper: '#C9C4BB', paper2: '#B3ADA3', ink: '#2B2A28', inkSoft: '#6E6A63',
    floor: '#C9C4BB', pad: '#D6D1C8', wall: '#ABA59B', prop: '#E4E0D8', prop2: '#9C968C', screen: '#E4E0D8',
    skin: ['#E4E0D8', '#D8C9B6'], body: '#E4E0D8', subBody: '#C9C4BB', player: '#2B2A28', playerInk: '#F4F1EA',
    signal: { ask: '#FFB000', err: '#E5383B', ok: '#2A9D6F', info: '#2B2A28' },
    roles: { organizer: '#F4F1EA', designer: '#F7C6D9', dev: '#B8D8F2', editor: '#CDEBC4', pm: '#FCE1B4', scrum: '#E3D0F5', research: '#BFE7E4', mkt: '#F9D0C4', d3: '#D7D2C8', tester: '#C9E0F9', sync: '#E8F0B8' },
    zoneLine: '#2B2A28', zoneLW: 6, zoneA: 1, padR: 0, walk: '#B3ADA3', stripe: 'rgba(43,42,40,.05)', grid: 'coarse',
    edges: false, leaf: '#7E8A6E', hemi: ['#FFFFFF', '#C9C4BB', 1.8], sun: ['#FFFFFF', 1.5], fog: null, wallH: 1.9,
    font: '"Archivo", system-ui, sans-serif', mono: '"Martian Mono", ui-monospace, monospace', label: { bg: '#F4F1EA', fg: '#2B2A28', border: '#2B2A28' },
  },
  F: {
    name: 'Spielbrett', cast: 'toy', bg: '#FFF8E7', paper: '#FFF8E7', paper2: '#FFE9B8', ink: '#141414', inkSoft: '#3D3D3D',
    floor: '#FFF1CF', pad: '#FFFFFF', wall: '#FFFFFF', prop: '#FFFFFF', prop2: '#FFD23F', screen: '#FFFFFF',
    skin: ['#FFFFFF', '#FFE9B8'], body: '#FFFFFF', subBody: '#FFE9B8', player: '#141414', playerInk: '#FFFFFF',
    signal: { ask: '#FFB000', err: '#E63946', ok: '#06A77D', info: '#1D4ED8' },
    roles: { organizer: '#FFFFFF', designer: '#FF5DA2', dev: '#1D4ED8', editor: '#06A77D', pm: '#FF7A00', scrum: '#9B5DE5', research: '#00B4D8', mkt: '#FF5DA2', d3: '#FFD23F', tester: '#1D4ED8', sync: '#06A77D' },
    zoneLine: '#141414', zoneLW: 5, zoneA: 1, padR: 0.35, walk: '#FFFFFF', walkTiles: true,
    edges: true, edgeColor: '#141414', edgeThick: 1.4, leaf: '#06A77D', hemi: ['#FFFFFF', '#FFF1CF', 2.1], sun: ['#FFFFFF', 1.1], fog: null, wallH: 0.45, hop: true,
    font: '"Baloo 2", system-ui, sans-serif', mono: '"Atkinson Hyperlegible", ui-monospace, monospace', label: { bg: '#FFFFFF', fg: '#141414', border: '#141414' },
  },
  G: {
    name: 'Bastelkarton', cast: 'marker', bg: '#B98E62', paper: '#C9A27A', paper2: '#B38B60', ink: '#3B2A1C', inkSoft: '#6B4F37',
    floor: '#C9A27A', pad: '#D8B994', wall: '#BE966B', prop: '#F3EBDD', prop2: '#A97F55', screen: '#F3EBDD',
    skin: ['#F3EBDD', '#E8C9A6', '#B9875E', '#7C553A'], body: '#F3EBDD', subBody: '#E4D6BF', player: '#3B2A1C', playerInk: '#F3EBDD',
    signal: { ask: '#FFE600', err: '#FF3B5C', ok: '#22E39A', info: '#00D1FF' },
    roles: { organizer: '#F3EBDD', designer: '#FF4FB3', dev: '#00D1FF', editor: '#FFE600', pm: '#FF9A1F', scrum: '#B86BFF', research: '#22E39A', mkt: '#FF4FB3', d3: '#F3EBDD', tester: '#00D1FF', sync: '#22E39A' },
    zoneLW: 9, zoneA: 0.85, padR: 0.25, walk: '#B38B60', walkLine: '#3B2A1C', walkLineA: 0.5, walkDash: [0.35, 0.25], fibers: true, stripe: 'rgba(59,42,28,.04)',
    edges: true, edgeColor: '#3B2A1C', edgeThick: 1.1, leaf: '#7FA65A', hemi: ['#FFF4E0', '#B98E62', 1.9], sun: ['#FFE9C9', 1.2], fog: null, wallH: 0.75,
    font: '"Patrick Hand", system-ui, sans-serif', mono: '"Courier Prime", ui-monospace, monospace', label: { bg: '#F3EBDD', fg: '#3B2A1C', border: '#3B2A1C' },
  },
};
export const LOOK_NAMES = Object.fromEntries(Object.entries(LOOKS).map(([k, v]) => [k, v.name]));

// ───────────────────────── Licht ─────────────────────────
export function addLights(scene, L, bounds) {
  const [x0, z0, x1, z1] = bounds, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  scene.background = new THREE.Color(L.bg);
  if (L.fog) scene.fog = new THREE.Fog(L.fog[0], L.fog[1], L.fog[2]);
  scene.add(new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]));
  const sun = new THREE.DirectionalLight(L.sun[0], L.sun[1]);
  sun.position.set(cx - 16, 34, cz + 22); sun.target.position.set(cx, 0, cz); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4;
  const sc = sun.shadow.camera, R = Math.max(x1 - x0, z1 - z0) * 0.6; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 2; sc.far = 110;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  const back = new THREE.DirectionalLight(L.hemi[0], 0.35); back.position.set(cx + 20, 14, cz - 24); back.target.position.set(cx, 0, cz); scene.add(back, back.target);
  return sun;
}

// ───────────────────────── Pässe ─────────────────────────
// Szene nur mit einem Layer rendern (0 = Geometrie, 1 = Schilder/Sprites), ohne Tausch der Puffer
class LayerPass extends Pass {
  constructor(scene, camera, layer, clear) { super(); this.scene = scene; this.camera = camera; this.layer = layer; this.clear = clear; this.needsSwap = false; }
  render(renderer, writeBuffer, readBuffer) {
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    const auto = renderer.autoClear, bg = this.scene.background; renderer.autoClear = this.clear;
    if (!this.clear) this.scene.background = null;   // Farb-Hintergrund erzwingt sonst ein Löschen und übermalt die Geometrie
    this.camera.layers.set(this.layer);
    renderer.render(this.scene, this.camera);
    this.camera.layers.set(0); this.camera.layers.enable(1);
    this.scene.background = bg; renderer.autoClear = auto;
  }
}
const INK = {
  uniforms: { tDiffuse: { value: null }, tN: { value: null }, tD: { value: null }, res: { value: new THREE.Vector2() }, ink: { value: new THREE.Color() }, near: { value: 0.3 }, far: { value: 260 }, thick: { value: 1 }, mixA: { value: 0.55 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse, tN, tD; uniform vec2 res; uniform vec3 ink; uniform float near, far, thick, mixA; varying vec2 vUv;
    float lin(float d){ return near * far / (far - d * (far - near)); }
    void main(){
      vec2 px = thick / res; vec3 n0 = texture2D(tN, vUv).rgb; float r0 = texture2D(tD, vUv).r; float d0 = lin(r0);
      float en = 0., ed = 0.;
      for (int i = 0; i < 8; i++) {
        vec2 o = vec2(i == 0 ? 1. : i == 1 ? -1. : i == 4 ? 1. : i == 5 ? -1. : i == 6 ? 1. : i == 7 ? -1. : 0., i == 2 ? 1. : i == 3 ? -1. : i == 4 ? 1. : i == 5 ? -1. : i == 6 ? -1. : i == 7 ? 1. : 0.);
        vec2 uv = vUv + o * px; en += distance(texture2D(tN, uv).rgb, n0); ed += abs(lin(texture2D(tD, uv).r) - d0);
      }
      float e = max(smoothstep(1.1, 1.9, en), smoothstep(0.5, 1.0, ed / max(d0, 0.001) * 6.));
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(mix(c.rgb, ink, e * mixA), c.a);
      gl_FragDepth = r0;
    }`,
};

export async function createPipeline(renderer, scene, camera, L, opt = {}) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = L.dark ? 1.45 : 1.12;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const composer = new EffectComposer(renderer);
  const P = { composer, view: scene, size(w, h) {}, render() {} };
  if (opt.mode === 'raw') { // Debug: ohne Composer
    P.size = () => {}; P.setView = v => { P.view = v; }; P.render = () => renderer.render(P.view, camera); return P;
  }
  const geoPass = new LayerPass(scene, camera, 0, true); composer.addPass(geoPass);
  let ink = null, rtN = null, normalMat = null;
  if (L.edges) {
    rtN = new THREE.WebGLRenderTarget(4, 4, { depthTexture: new THREE.DepthTexture(4, 4) });
    normalMat = new THREE.MeshNormalMaterial();
    ink = new ShaderPass(new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(INK.uniforms), vertexShader: INK.vertexShader, fragmentShader: INK.fragmentShader, depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth }));
    const u = ink.material.uniforms; u.tN.value = rtN.texture; u.tD.value = rtN.depthTexture; u.ink.value.set(L.edgeColor); u.near.value = camera.near; u.far.value = camera.far; u.mixA.value = L.edgeMix ?? 0.55;
    composer.addPass(ink);
  }
  const spritePass = new LayerPass(scene, camera, 1, false); composer.addPass(spritePass);
  if (opt.mode === 'simple') { composer.addPass(new OutputPass()); P.size = (w, h) => composer.setSize(w, h); P.setView = v => { P.view = v; geoPass.scene = spritePass.scene = v; }; P.render = () => composer.render(); return P; }
  if (opt.ao) { // SSAO/GTAO nur auf Wunsch (?ao=1): Headless-Aufnahmen bleiben schnell
    const { GTAOPass } = await import('three/addons/postprocessing/GTAOPass.js');
    const ao = new GTAOPass(scene, camera, 4, 4); ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = 0.6; composer.addPass(ao); P.ao = ao;
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.25, 0.4, 1.2); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  P.size = (w, h) => {
    composer.setSize(w, h); const v = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (ink) { rtN.setSize(v.x, v.y); ink.material.uniforms.res.value.set(v.x, v.y); ink.material.uniforms.thick.value = Math.max(1, renderer.getPixelRatio() * 0.8 * (L.edgeThick || 1)); }
    if (P.ao) P.ao.setSize(v.x, v.y);
  };
  P.setView = view => { P.view = view; geoPass.scene = spritePass.scene = view; if (P.ao) P.ao.scene = view; };
  P.render = () => {
    const view = P.view;
    if (ink) {
      const bg = view.background, fog = view.fog; camera.layers.set(0);
      const hide = view.userData.noInk || [], vis = hide.map(o => o.visible); hide.forEach(o => o.visible = false);   // Welt ohne Kontur (sonst Linien durch den Dunst)
      renderer.setRenderTarget(rtN); view.overrideMaterial = normalMat; view.background = null; view.fog = null; renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(view, camera);
      hide.forEach((o, i) => o.visible = vis[i]); view.overrideMaterial = null; view.background = bg; view.fog = fog; camera.layers.set(0); camera.layers.enable(1);
      renderer.setClearColor(L.bg, 1);
    }
    composer.render();
  };
  renderer.setClearColor(L.bg, 1);
  return P;
}
