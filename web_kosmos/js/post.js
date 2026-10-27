// Bildpipeline: Ebenen-Bilder (HDR, linear) → Zusammenführung beim Flug (Iris um den Anker, Zoom-Unschärfe, Lichtschleier,
// EHT-Blick) → Bloom (Mip-Kette nach Jimenez 2014: 13-Tap abwärts, Zelt-Filter aufwärts, energieerhaltend gemischt) →
// Belichtung, Grading, ACES-Tonemapping, Vignette, Farbsaum, Kinobalken, Korn → Bildschirm (sRGB).

import * as THREE from 'three';
import { FULLSCREEN_VERT } from './glsl.js';

const COMP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tA, tB;
uniform float uProg, uMaskR, uBlur, uVeil, uAspect, uTrans, uMix;
uniform vec2 uAnchor, uInner;
uniform vec3 uEhtA, uEhtB;        // x = Anteil, y = Unschärfe (Bildhöhe), z = Verstärkung
varying vec2 vUv;

const vec2 POISSON[12] = vec2[](vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
  vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893), vec2(0.507, 0.064),
  vec2(0.896, 0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598));

vec3 afmhot(float x) { return clamp(vec3(2.0 * x, 2.0 * x - 0.5, 2.0 * x - 1.0), 0.0, 1.0); }

// EHT-Blick: Bild auf die Auflösung des Event Horizon Telescope weichzeichnen und in der üblichen Falschfarbe zeigen
vec3 eht(sampler2D t, vec2 uv, vec3 e) {
  vec3 acc = vec3(0.0);
  float lod = log2(max(1.0, e.y * float(textureSize(t, 0).y) * 0.35));
  for (int i = 0; i < 12; i++) acc += textureLod(t, uv + POISSON[i] * vec2(e.y / uAspect, e.y), lod).rgb;
  float L = dot(acc / 12.0, vec3(0.2126, 0.7152, 0.0722));
  return afmhot(1.0 - exp(-L * e.z));
}

// NaN-Bildpunkte einer Station (Shader-Fehler) als Schwarz lesen: sonst verschmiert die Zoom-Unschärfe sie zu Punktreihen und
// der Bloom zu weißen Scheiben – auch dort, wo das Bild im Flug gar nicht gezeigt wird (NaN × 0 = NaN)
vec3 tex(sampler2D t, vec2 uv) { vec3 c = texture(t, uv).rgb; return any(isnan(c)) ? vec3(0.0) : c; }

vec3 sampleLevel(sampler2D t, vec2 uv, vec3 e) {
  vec3 c = tex(t, uv);
  if (e.x > 0.001) c = mix(c, eht(t, uv, e) * 1.2, e.x);
  return c;
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Zoom-Unschärfe entlang der Strahlen zum Anker (Bewegung durch die Skala). Gemittelt wird in gestauchten Werten
// (c / (1 + L), danach zurück): ein überheller Punkt wie die Sonne verschmiert so zu einer dünnen Spur statt zu einer
// weißen Scheibe.
vec3 zoomed(sampler2D t, vec2 uv, vec2 c, float amt, vec3 e) {
  if (amt < 0.001) return sampleLevel(t, uv, e);
  vec3 acc = vec3(0.0);
  float w = 0.0;
  for (int i = 0; i < 10; i++) {
    float k = float(i) / 9.0;
    vec2 q = mix(uv, c, k * amt);
    float wi = 1.0 - k * 0.6;
    vec3 s = tex(t, q);
    acc += s / (1.0 + luma(s)) * wi;
    w += wi;
  }
  acc /= w;
  return acc / max(1.0 - luma(acc), 0.02);
}

void main() {
  if (uTrans < 0.5) { gl_FragColor = vec4(sampleLevel(tA, vUv, uEhtA), 1.0); return; }
  // reine Überblendung (Auftakt-Film → Station 10)
  if (uMix >= 0.0) { gl_FragColor = vec4(mix(sampleLevel(tA, vUv, uEhtA), sampleLevel(tB, vUv, uEhtB), uMix), 1.0); return; }
  vec2 d = (vUv - uAnchor) * vec2(uAspect, 1.0);
  float r = length(d);
  vec3 ca = zoomed(tA, vUv, uAnchor, uBlur, uEhtA);
  // inneres Bild ist um den Anker verschoben: außerhalb seines Rahmens gibt es nichts – dort weich auf das äußere Bild
  // zurückfallen (sonst zeichnet sich der Rahmen als Rechteck ab)
  vec2 uvB = vUv - uAnchor + uInner;
  vec2 eb = smoothstep(vec2(0.0), vec2(0.04), uvB) * smoothstep(vec2(1.0), vec2(0.96), uvB);
  float inside = eb.x * eb.y;
  vec3 cb = zoomed(tB, clamp(uvB, 0.0, 1.0), uInner, uBlur, uEhtB);
  float m = 1.0 - smoothstep(uMaskR * 0.45, uMaskR, r);
  float wB = max(m * smoothstep(0.0, 0.2, uProg), smoothstep(0.72, 1.0, uProg)) * mix(inside, 1.0, smoothstep(0.9, 1.0, uProg));
  vec3 col = mix(ca, cb, wB);
  // Lichtschleier: weicher, heller Kern um den Anker in der Mitte der Fahrt; wie „Aufhellen“ gemischt, damit helle
  // Bilder (im Nebel) nicht milchig werden
  float veil = uVeil * exp(-r * r / max(1e-4, uMaskR * uMaskR * 0.6)) * 0.35;
  col += vec3(0.55, 0.62, 0.75) * veil / (1.0 + luma(col) * 2.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

const DOWN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uKaris;
varying vec2 vUv;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * uTexel).rgb; }
float w(vec3 c) { return mix(1.0, 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722)) * 0.25), uKaris); }
void main() {
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 g0 = (a + b + d + e), g1 = (b + c + e + f), g2 = (d + e + g + h), g3 = (e + f + h + i), g4 = (j + k + l + m);
  float w0 = w(g0 * 0.25) * 0.125, w1 = w(g1 * 0.25) * 0.125, w2 = w(g2 * 0.25) * 0.125, w3 = w(g3 * 0.25) * 0.125, w4 = w(g4 * 0.25) * 0.5;
  vec3 o = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) * 0.25 / (w0 + w1 + w2 + w3 + w4);
  gl_FragColor = vec4(min(o, vec3(6e4)), 1.0);
}
`;

const UP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tLow, tHigh;
uniform vec2 uTexel;
varying vec2 vUv;
vec3 s(vec2 o) { return texture(tLow, vUv + o * uTexel).rgb; }
void main() {
  vec3 t = s(vec2(-1, 1)) + 2.0 * s(vec2(0, 1)) + s(vec2(1, 1)) + 2.0 * s(vec2(-1, 0)) + 4.0 * s(vec2(0, 0))
         + 2.0 * s(vec2(1, 0)) + s(vec2(-1, -1)) + 2.0 * s(vec2(0, -1)) + s(vec2(1, -1));
  gl_FragColor = vec4(texture(tHigh, vUv).rgb + t / 16.0, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tComp, tBloom;
uniform float uBloom, uExposure, uSat, uCon, uVig, uCA, uBars, uGrain, uTime, uAspect, uBloomN;
uniform vec3 uSh, uHi;
uniform vec2 uRes;
varying vec2 vUv;

const mat3 ACES_IN = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
const mat3 ACES_OUT = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
vec3 aces(vec3 v) {
  v = ACES_IN * v;
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(ACES_OUT * (a / b), 0.0, 1.0);
}
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

void main() {
  vec2 c = vUv - 0.5;
  float r2 = dot(c * vec2(uAspect, 1.0), c * vec2(uAspect, 1.0));
  // Farbsaum: Rot und Blau minimal radial versetzt, nur zum Rand hin
  vec2 off = c * uCA * r2;
  vec3 col = vec3(texture(tComp, vUv + off).r, texture(tComp, vUv).g, texture(tComp, vUv - off).b);
  vec3 bl = texture(tBloom, vUv).rgb / uBloomN;
  col = mix(col, bl, uBloom);
  col *= uExposure;
  // Grading: Schatten und Lichter getrennt tönen, Sättigung
  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= mix(uSh, uHi, smoothstep(0.0, 1.2, L));
  col = mix(vec3(L), col, uSat);
  col = aces(col);
  // weiche S-Kurve um die Mitte
  col = mix(col, col * col * (3.0 - 2.0 * col), uCon);
  col *= mix(1.0, smoothstep(1.25, 0.25, sqrt(r2)), uVig);
  col = srgb(col);
  col += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;
  float bar = step(0.5 - uBars, abs(c.y));
  gl_FragColor = vec4(col * (1.0 - bar), 1.0);
}
`;

const BLOOM_LEVELS = 6;
// Grading-Grundwerte (je Station überschreibbar: lv.look); auch der Auftakt-Film läuft auf sie zu
export const LOOK = { exposure: 1, bloom: 0.06, sat: 1.04, con: 0.12, sh: [0.96, 0.99, 1.06], hi: [1.04, 1.0, 0.95], vig: 0.38, ca: 0.006, grain: 0.016 };

export function createPost(renderer) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);
  const run = (mat, target) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
  };
  const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const comp = new THREE.WebGLRenderTarget(2, 2, opts);
  const down = [], up = [];
  for (let i = 0; i < BLOOM_LEVELS; i++) {
    down.push(new THREE.WebGLRenderTarget(2, 2, opts));
    if (i < BLOOM_LEVELS - 1) up.push(new THREE.WebGLRenderTarget(2, 2, opts));
  }
  const mat = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const compMat = mat(COMP_FRAG, {
    tA: { value: null }, tB: { value: null }, uProg: { value: 0 }, uMaskR: { value: 0 }, uBlur: { value: 0 }, uVeil: { value: 0 },
    uAspect: { value: 1 }, uTrans: { value: 0 }, uMix: { value: -1 }, uAnchor: { value: new THREE.Vector2(0.5, 0.5) }, uInner: { value: new THREE.Vector2(0.5, 0.5) },
    uEhtA: { value: new THREE.Vector3() }, uEhtB: { value: new THREE.Vector3() },
  });
  const downMat = mat(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uKaris: { value: 0 } });
  const upMat = mat(UP_FRAG, { tLow: { value: null }, tHigh: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const finalMat = mat(FINAL_FRAG, {
    tComp: { value: comp.texture }, tBloom: { value: null }, uBloom: { value: 0.06 }, uExposure: { value: 1 }, uSat: { value: 1 },
    uCon: { value: 0.1 }, uVig: { value: 0.35 }, uCA: { value: 0.006 }, uBars: { value: 0 }, uGrain: { value: 0.018 },
    uTime: { value: 0 }, uAspect: { value: 1 }, uBloomN: { value: BLOOM_LEVELS }, uSh: { value: new THREE.Vector3(1, 1, 1) },
    uHi: { value: new THREE.Vector3(1, 1, 1) }, uRes: { value: new THREE.Vector2(1, 1) },
  });

  function setSize(w, h) {
    comp.setSize(w, h);
    let bw = w, bh = h;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      bw = Math.max(1, Math.floor(bw / 2));
      bh = Math.max(1, Math.floor(bh / 2));
      down[i].setSize(bw, bh);
      if (i < BLOOM_LEVELS - 1) up[i].setSize(bw, bh);
    }
    compMat.uniforms.uAspect.value = w / h;
    finalMat.uniforms.uAspect.value = w / h;
    finalMat.uniforms.uRes.value.set(w, h);
  }

  function bloom() {
    let src = comp;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      downMat.uniforms.tSrc.value = src.texture;
      downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      downMat.uniforms.uKaris.value = i === 0 ? 1 : 0;
      run(downMat, down[i]);
      src = down[i];
    }
    let low = down[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      upMat.uniforms.tLow.value = low.texture;
      upMat.uniforms.tHigh.value = down[i].texture;
      upMat.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
      run(upMat, up[i]);
      low = up[i];
    }
    return up[0].texture;
  }

  // a = einzige bzw. äußere Ebene, b = innere Ebene (nur im Flug), tr = Werte des Flugs (tr.mix: Überblendung statt Iris),
  // look = Belichtung + Grading
  function render(a, b, tr, look, time) {
    const u = compMat.uniforms;
    u.tA.value = a.texture;
    u.tB.value = b ? b.texture : a.texture;
    u.uTrans.value = tr ? 1 : 0;
    u.uMix.value = tr && tr.mix != null ? tr.mix : -1;
    if (tr && tr.mix == null) {
      u.uProg.value = tr.prog;
      u.uMaskR.value = tr.maskR;
      u.uBlur.value = tr.blur;
      u.uVeil.value = tr.veil;
      u.uAnchor.value.copy(tr.anchor);
      u.uInner.value.copy(tr.inner);
    }
    u.uEhtA.value.copy(look.ehtA);
    u.uEhtB.value.copy(look.ehtB);
    run(compMat, comp);
    const f = finalMat.uniforms;
    f.tBloom.value = bloom();
    f.uBloom.value = look.bloom;
    f.uExposure.value = look.exposure;
    f.uSat.value = look.sat;
    f.uCon.value = look.con;
    f.uSh.value.copy(look.sh);
    f.uHi.value.copy(look.hi);
    f.uBars.value = look.bars;
    f.uGrain.value = look.grain;
    f.uVig.value = look.vig;
    f.uCA.value = look.ca;
    f.uTime.value = time;
    run(finalMat, null);
  }

  return { setSize, render };
}
