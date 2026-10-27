// Gemeinsame Bausteine der Nebel-, Pulsar-, Galaxien- und Netz-Stationen:
// volume(): Strahlverfolgung durch ein Volumen in einer Kugel um den Ursprung (Emission + Absorption je Schritt exakt
// integriert, Startpunkt je Pixel versetzt gegen Streifen), Mischung „vorgemultipliert“: Bild = Licht + Hintergrund × T.
// bakeField(): grobe Rauschfelder einmal auf der GPU in eine 3D-Textur rechnen. offscreen(): Volumen in eigener, kleinerer
// Auflösung rendern und als Bildtafel einblenden, neu nur bei Änderung.
// pointCloud(): Punkte mit Größe in Szeneneinheiten; unter der Mindestgröße bleibt der Punkt klein und wird mit
// dem Quadrat des Abstands dunkler (wie der Strahlungsfluss einer Punktquelle).

import * as THREE from 'three';
import { NOISE } from './glsl.js';

// adapt = Schrittweite als Anteil des Abstands zum Ursprung (feine Strukturen, die nach außen breiter werden, z. B.
// Strahlkegel): innen dicht, außen grob; minStep begrenzt nach unten, maxSteps die Kosten.
export function volume({ radius, body, uniforms = {}, steps = 64, maxSteps = 160, adapt = 0, minStep = 1 }) {
  const mat = new THREE.ShaderMaterial({
    defines: adapt ? { ADAPT: adapt.toFixed(4), ADAPT_MIN: minStep.toFixed(4) } : {},
    vertexShader: /* glsl */ `
varying vec3 vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
uniform float uR, uSteps, uTime;
varying vec3 vP;
${NOISE}
${body}
void main() {
  vec3 ro = cameraPosition, rd = normalize(vP - cameraPosition);
  float b = dot(ro, rd), c = dot(ro, ro) - uR * uR, h = b * b - c;
  if (h <= 0.0) discard;
  h = sqrt(h);
  float t0 = max(-b - h, 0.0), t1 = -b + h;
  if (t1 <= 0.0) discard;
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
#ifdef ADAPT
  float dt = clamp(length(ro + rd * t0) * ADAPT, ADAPT_MIN, uR);
#else
  float dt = (t1 - t0) / uSteps;
#endif
  float t = t0 + dt * jit;
  vec3 L = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < ${maxSteps}; i++) {
#ifdef ADAPT
    if (t > t1) break;
    dt = clamp(length(ro + rd * t) * ADAPT, ADAPT_MIN, uR);
#else
    if (float(i) >= uSteps) break;
#endif
    vec3 e;
    float s;
    sampleVol(ro + rd * t, e, s);
    float a = exp(-s * dt);
    L += T * e * (s > 1e-4 ? (1.0 - a) / s : dt);
    T *= a;
    if (T < 0.004) break;
    t += dt;
  }
  gl_FragColor = vec4(L, 1.0 - T);
}`,
    uniforms: { uR: { value: radius }, uSteps: { value: steps }, uTime: { value: 0 }, ...uniforms },
    side: THREE.BackSide, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  mesh.frustumCulled = false;
  return mesh;
}

const QUAD_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const quad = (mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); m.frustumCulled = false; return m; };

// Würfel ±extent mit size³ Zellen (Halbfloat, linear gefiltert); body definiert vec4 field(vec3 p). Der Strahl liest die
// groben Oktaven dann mit einem Texturzugriff statt mit Dutzenden Rauschaufrufen je Schritt. Gebacken wird in ready
// (Shader parallel gebunden), Zugriff im Volumen: texture(uField, p / (2.0 * extent) + 0.5).
export function bakeField(renderer, { size = 128, extent, body }) {
  const rt = new THREE.WebGL3DRenderTarget(size, size, size, { type: THREE.HalfFloatType, depthBuffer: false });
  const tex = rt.texture;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
  const mat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: /* glsl */ `
uniform float uZ;
varying vec2 vUv;
${NOISE}
${body}
void main() { gl_FragColor = field((vec3(vUv, uZ) * 2.0 - 1.0) * ${extent.toFixed(4)}); }`,
    uniforms: { uZ: { value: 0 } }, depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene().add(quad(mat)), cam = new THREE.Camera();
  const bake = () => {
    const prev = renderer.getRenderTarget();
    for (let z = 0; z < size; z++) {
      mat.uniforms.uZ.value = (z + 0.5) / size;
      renderer.setRenderTarget(rt, z);
      renderer.render(scene, cam);
    }
    renderer.setRenderTarget(prev);
  };
  const ready = renderer.compileAsync(scene, cam).then(bake);
  // Nach einem Absturz der GPU ist das Feld leer → neu backen (Szene bleibt dafür bis dispose)
  renderer.domElement.addEventListener('webglcontextrestored', bake);
  return { texture: tex, ready, dispose: () => { renderer.domElement.removeEventListener('webglcontextrestored', bake); disposeScene(scene); rt.dispose(); } };
}

// Nebel sind weich: halbe Kantenlänge kostet ein Viertel, Sterne der Station bleiben scharf. Die Tafel (quad, gleiche
// Mischung wie volume()) kommt in die Szene der Station, render(kamera) in update(); ohne Zeitabhängigkeit rechnet es nur
// neu, wenn Kamera, Größe oder Werte sich ändern (Werte → invalidate()).
export function offscreen(renderer, mesh) {
  const scene = new THREE.Scene().add(mesh);
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
  const tile = quad(new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: 'uniform sampler2D uTex; varying vec2 vUv; void main() { gl_FragColor = texture2D(uTex, vUv); }',
    uniforms: { uTex: { value: rt.texture } }, transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  }));
  const seen = new THREE.Matrix4(), proj = new THREE.Matrix4();
  let w = 2, h = 2, scale = 0.5, dirty = true;
  const fit = () => { rt.setSize(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))); dirty = true; };
  // Nach einem Absturz der GPU ist das Bild leer → neu zeichnen, auch wenn die Kamera steht
  const restore = () => { dirty = true; };
  renderer.domElement.addEventListener('webglcontextrestored', restore);
  return {
    quad: tile, scene,
    setSize(W, H) { w = W; h = H; fit(); },
    setScale(s) { scale = s; fit(); },
    invalidate() { dirty = true; },
    render(cam) {
      cam.updateMatrixWorld();
      if (!dirty && seen.equals(cam.matrixWorld) && proj.equals(cam.projectionMatrix)) return;
      seen.copy(cam.matrixWorld); proj.copy(cam.projectionMatrix); dirty = false;
      const prev = renderer.getRenderTarget(), a = renderer.getClearAlpha();
      renderer.setRenderTarget(rt);
      renderer.setClearAlpha(0);
      renderer.render(scene, cam);
      renderer.setClearAlpha(a);
      renderer.setRenderTarget(prev);
    },
    dispose() { renderer.domElement.removeEventListener('webglcontextrestored', restore); disposeScene(scene); rt.dispose(); },
  };
}

// Nahe der Kamera (Punkt größer als uFade px) weich ausblenden: ein Punkt bleibt ein Punkt und wird beim Durchflug
// kein Klecks – so bleibt der Flug durch eine Punktwolke ein Sternenfeld statt einer Blasen-Wand.
const PC_VERT = /* glsl */ `
attribute vec3 color;
attribute float size;
uniform float uPx, uScale, uMin, uMax, uFade, uGain;
varying vec3 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = size * uScale / max(-mv.z, 1e-6);
  float d = clamp(px, uMin * uPx, uMax * uPx);
  gl_PointSize = d;
  float near = 1.0 - smoothstep(uFade * uPx, uFade * 3.0 * uPx, px);
  vCol = color * uGain * min(1.0, (px * px) / (d * d) * 4.0) * near;
}
`;
const PC_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  gl_FragColor = vec4(vCol * exp(-dot(d, d) * 12.8), 1.0);
}
`;

export function pointCloud(pos, col, size, { min = 1.3, max = 40, fade = 24, vert = PC_VERT, frag = PC_FRAG, blending = THREE.AdditiveBlending } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag,
    uniforms: { uPx: { value: 1 }, uScale: { value: 600 }, uMin: { value: min }, uMax: { value: max }, uFade: { value: fade }, uGain: { value: 1 } },
    blending, depthWrite: false, transparent: true,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.userData.setPx = (pr, H, fov) => { m.uniforms.uPx.value = pr; m.uniforms.uScale.value = (H / 2) / Math.tan((fov * Math.PI) / 360); };
  return p;
}

export function disposeScene(scene) {
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}
