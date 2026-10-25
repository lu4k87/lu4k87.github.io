// Ablauf: Ebenen laden, Kamera steuern, Ebenen im durchgehenden Flug wechseln, Bild über gemeinsamem Hintergrund zusammenführen.
// Linse: Tiefenunschärfe (Tiefentextur je Ebene), Bloom auf Glanzlichtern, Farbsaum am Rand, Grading je Stimmung, Korn.
// Qualität: drei Stufen aus quality.js (Auflösung, Kantenglättung, Linse, Schatten, Detailgrad der Ebenen), live umschaltbar;
// darüber die Schalter des Zahnrads (settings.js: Renderskala, Bildraten-Deckel, Linse einzeln, Bewegung, Licht, Details).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHud } from './hud.js';
import { T_ROOM, fillDiameterNm, wetDiameterNm } from './science.js';
import { NOISE_GLSL, SEM_SWING, semDetectorMode, semChargeOn } from './sem.js';
import { quality } from './quality.js';
import { settings, mountSettings, kelvinTint, PERF_KEYS } from './settings.js';

const LOADERS = [
  () => import('./levels/piece.js'),
  () => import('./levels/tissue.js'),
  () => import('./levels/cells.js'),
  () => import('./levels/wall.js'),
  () => import('./levels/meso.js'),
  () => import('./levels/micro.js'),
  () => import('./levels/atoms.js'),
];

// Stimmung je Ebene (linear): Verlauf oben/unten, Lichtpool (x, y, Radius, Stärke), Staub (Dichte, Größe)
// und Grading: Tönung der Schatten (sh) und Lichter (hi), Sättigung, S-Kurve (Kontrast)
const SEM = {
  top: [0.040, 0.044, 0.050], bot: [0.008, 0.009, 0.011], pool: [0.5, 0.62, 0.8, 0.05], dust: [0, 1],
  grade: { sh: [0.95, 0.985, 1.06], hi: [1.02, 1.005, 0.985], sat: 1, con: 0.16 },
};
const MOODS = [
  { top: [0.060, 0.051, 0.042], bot: [0.014, 0.012, 0.010], pool: [0.42, 0.62, 0.75, 0.07], dust: [1.0, 1.0],      // Studio, warm
    grade: { sh: [0.9, 0.98, 1.1], hi: [1.07, 1.0, 0.91], sat: 1.05, con: 0.14 } },
  SEM, SEM, SEM,
  { top: [0.030, 0.045, 0.060], bot: [0.008, 0.012, 0.018], pool: [0.5, 0.6, 0.7, 0.07], dust: [0.35, 0.8],         // feucht, blau
    grade: { sh: [0.9, 0.99, 1.1], hi: [1.0, 1.02, 1.04], sat: 1.04, con: 0.14 } },
  { top: [0.020, 0.030, 0.065], bot: [0.006, 0.008, 0.020], pool: [0.5, 0.6, 0.6, 0.08], dust: [0.6, 1.8],          // Nano, tiefblau
    grade: { sh: [0.88, 0.93, 1.16], hi: [1.06, 1.0, 0.95], sat: 1.08, con: 0.12 } },
  { top: [0.022, 0.028, 0.060], bot: [0.006, 0.008, 0.018], pool: [0.5, 0.55, 0.6, 0.08], dust: [0.45, 2.2],
    grade: { sh: [0.92, 0.93, 1.12], hi: [1.06, 1.01, 0.94], sat: 1.06, con: 0.12 } },
];

// Übergang: beide Kameras zoomen mit derselben Rate – außen auf 35 % des Abstands zum Anker, innen von 1/0,35 × Abstand;
// angekommen wird mit 1,3-fachem Abstand der Heimpose (Überblick zuerst, dann zoomt der Besucher selbst)
const ZOOM = { near: 0.35, arrive: 1.3 };
// Linse: Bloom-Schwelle (linear), Farbsaum am Rand, Ein-/Ausblenden der Effekte (s)
const LENS = { thr: 0.82, ca: 0.005, fadeOut: 0.45, fadeIn: 1.3, fill: 0.018, halo: 0.02 };   // fill/halo: Gegenlicht (linear)
// Leerlauf-Fahrt: nach `delay` s ohne Eingabe weich einblenden (`ramp` s); Ausschläge je Ebene über lv.cine
const CINE = { delay: 2.5, ramp: 4.0, orbit: 0.10, crane: 0.045, dolly: 0.05, drift: 0.02, lift: 0.6 };   // lift: Anteil der Blickdrift nach oben

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// still: keine Bewegung von selbst (System-Einstellung oder Grundstufe „Aus“ im Zahnrad)
let still = reduced;
const params = new URLSearchParams(location.search);
// Prüfhilfe für Screenshots: ?freeze=0.5 hält den ersten Übergang bei diesem Fortschritt an
const freeze = params.has('freeze') ? Math.min(0.999, Math.max(0, +params.get('freeze'))) : null;
// Tour für Ausstellungen: ?tour (optional &dwell=Sekunden) taucht selbständig durch alle Ebenen
// Prüfhilfe für die Qualitätsstufen: ?fps schreibt alle 2 s Bildrate und Stufe in die Konsole
const stats = params.has('fps') ? { n: 0, sum: 0 } : null;
const tour = params.has('tour') ? { dwell: Math.max(1, +params.get('dwell') || 12), since: 0 } : null;

const canvas = document.getElementById('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  document.body.classList.add('no-webgl');
  throw err;
}
renderer.setPixelRatio(pixelRatio(eff()));
renderer.setClearColor(0x000000, 0);   // Ebenen rendern transparent, der Hintergrund entsteht in der Zusammenführung
renderer.shadowMap.enabled = eff().shadows;   // nur Lichter mit castShadow kosten etwas (Ebene 7: weiche Eigenschatten)
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const state = {
  index: -1, active: null, controls: null, tr: null, intro: null, focus: null, dolly: null, dragging: false,
  cine: { idle: 0, w: 0, base: null },
  post: { dof: 0, bloom: 0 },
  temp: 550, rh: 0.8, wet: fillDiameterNm(0.8),   // wet: gefüllt bis Ø (nm), mit Hysterese
  pyro: { shown: 550, playing: false, tween: null },   // gezeigte Temperatur gleitet zur gewählten (Zeitraffer: ab Raumtemperatur)
  det: 'se',   // REM-Detektor der Ebenen 3–4 (Umschalter an der Messleiste): 'se' | 'bse'
  levels: new Map(), loading: new Map(), poses: new Map(), time: 0,
};

// ---------- Zusammenführung: Hintergrund, Linse, Tonemapping, Grading je Ebene, Vignette, Korn ----------
const mood = () => ({
  top: { value: new THREE.Vector3() }, bot: { value: new THREE.Vector3() }, pool: { value: new THREE.Vector4() }, dust: { value: new THREE.Vector2() },
  sh: { value: new THREE.Vector3(1, 1, 1) }, hi: { value: new THREE.Vector3(1, 1, 1) }, gr: { value: new THREE.Vector2(1, 0) },
});
const moodA = mood(), moodB = mood();
const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const comp = new THREE.ShaderMaterial({
  uniforms: {
    tOuter: { value: null }, tInner: { value: null }, dOuter: { value: null }, dInner: { value: null }, tBloom: { value: null },
    uAnchor: { value: new THREE.Vector2(0.5, 0.5) }, uRes: { value: new THREE.Vector2(1, 1) },
    uProg: { value: 0 }, uMaskR: { value: 0 }, uBlur: { value: 0 },
    uAspect: { value: 1 }, uTime: { value: 0 }, uFade: { value: 0 },
    uToneOuter: { value: 0 }, uToneInner: { value: 0 }, uGrainOuter: { value: 0 }, uGrainInner: { value: 0 },
    uCamOuter: { value: new THREE.Vector4(0.1, 100, 10, 0) }, uCamInner: { value: new THREE.Vector4(0.1, 100, 10, 0) },
    uBloom: { value: 0 }, uCA: { value: LENS.ca * eff().ca }, uDive: { value: 0 }, uInner: { value: new THREE.Vector2(0.5, 0.5) },
    uFill: { value: LENS.fill }, uHalo: { value: LENS.halo },
    uExposure: { value: 1 }, uPoolK: { value: 1 }, uDustK: { value: 1 }, uVeilK: { value: 1 },   // Zahnrad: Licht + Details
    uTopA: moodA.top, uBotA: moodA.bot, uPoolA: moodA.pool, uDustA: moodA.dust, uShA: moodA.sh, uHiA: moodA.hi, uGrA: moodA.gr,
    uTopB: moodB.top, uBotB: moodB.bot, uPoolB: moodB.pool, uDustB: moodB.dust, uShB: moodB.sh, uHiB: moodB.hi, uGrB: moodB.gr,
  },
  // Abtastpunkte der Tiefenunschärfe und der Zoom-Unschärfe je Qualitätsstufe (Shader wird beim Umschalten neu gebaut)
  defines: { DOF_TAPS: eff().dofTaps, BLUR_TAPS: eff().blurTaps },
  vertexShader: QUAD_VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tOuter, tInner, dOuter, dInner, tBloom;
    uniform vec2 uAnchor, uInner, uRes, uDustA, uDustB, uGrA, uGrB;
    uniform float uProg, uMaskR, uBlur, uAspect, uTime, uFade;
    uniform float uToneOuter, uToneInner, uGrainOuter, uGrainInner, uFill, uHalo;
    uniform vec4 uCamOuter, uCamInner;      // near, far, Fokusabstand, größte Unschärfe in Pixeln (0 = aus)
    uniform float uBloom, uCA, uDive, uExposure, uPoolK, uDustK, uVeilK;
    uniform vec3 uTopA, uBotA, uTopB, uBotB, uShA, uHiA, uShB, uHiB;
    uniform vec4 uPoolA, uPoolB;
    varying vec2 vUv;
    ${NOISE_GLSL}
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    // Staub: je Rasterzelle ein weicher Punkt, langsam aufsteigend und flackernd
    float dustLayer(vec2 q, float cells, float speed, float seed) {
      vec2 g = q * cells + vec2(0.0, -uTime * speed);
      vec2 id = floor(g);
      vec2 f = g - id;
      float h1 = hash13(vec3(id, seed)), h2 = hash13(vec3(id, seed + 7.0)), h3 = hash13(vec3(id, seed + 13.0));
      vec2 p = vec2(0.2 + 0.6 * h1, 0.2 + 0.6 * h2) + 0.08 * vec2(sin(uTime * 0.6 + h3 * 6.28), cos(uTime * 0.45 + h3 * 3.1));
      float d = length(f - p);
      float r = 0.025 + 0.05 * h3;
      return exp(-d * d / (r * r)) * step(0.62, h1 + 0.3 * h2) * (0.55 + 0.45 * sin(uTime * 1.1 + h3 * 9.0));
    }
    vec3 backdrop(vec2 uv, vec3 top, vec3 bot, vec4 pool, vec2 dust) {
      vec2 q = (uv - 0.5) * vec2(uAspect, 1.0);
      float n = vnoise(vec3(q * 1.3 + vec2(uTime * 0.01, 0.0), uTime * 0.02));
      vec3 c = mix(bot, top, smoothstep(-0.65, 0.75, q.y + 0.28 * (n - 0.5)));
      vec2 pc = (pool.xy - 0.5) * vec2(uAspect, 1.0);
      vec2 dp = q - pc;
      c += (top * 2.0 + 0.2) * pool.w * uPoolK * exp(-dot(dp, dp) / (pool.z * pool.z));
      if (dust.x * uDustK > 0.0) {
        float a = dustLayer(q, 6.0 / dust.y, 0.04, 1.0) + 0.6 * dustLayer(q, 11.0 / dust.y, 0.07, 2.0);
        c += normalize(top + 0.05) * 0.07 * dust.x * a;
      }
      return c;
    }
    // ---- Tiefenunschärfe: lineare Tiefe, Unschärfekreis, Sammeln auf einer Spirale (Vordergrund bleibt scharf) ----
    float linZ(sampler2D d, vec2 uv, vec4 cam) {
      float ndc = texture2D(d, uv).x * 2.0 - 1.0;
      return 2.0 * cam.x * cam.y / (cam.y + cam.x - ndc * (cam.y - cam.x));
    }
    float cocPx(float z, vec4 cam) { return cam.w * min(abs(z - cam.z) / max(z, 1e-6) * 1.8, 1.4); }
    vec4 dofTex(sampler2D t, sampler2D d, vec2 uv, vec4 cam, vec4 c0, float zc, float sc) {
      float R = cam.w * 1.4;
      float lod = clamp(log2(R / 7.0), 0.0, 1.5);
      vec4 acc = c0;
      float tot = 1.0;
      float rot = hash(uv * uRes) * 6.2832;
      for (int i = 0; i < DOF_TAPS; i++) {
        float fi = float(i) + 0.5;
        float r = R * sqrt(fi / float(DOF_TAPS));
        float a = fi * 2.39996 + rot;
        vec2 tc = uv + vec2(cos(a), sin(a)) * r / uRes;
        float zt = linZ(d, tc, cam);
        float st = cocPx(zt, cam);
        if (zt > zc) st = min(st, sc * 2.0);        // Hintergrund verwischt nie über einen schärferen Vordergrund
        float m = smoothstep(r - 0.5, r + 0.5, st);
        acc += mix(acc / tot, textureLod(t, tc, lod), m);
        tot += 1.0;
      }
      return acc / tot;
    }
    // Bloom: Mip-Stufen der hellen Anteile (Viertelauflösung), Zelt-Filter gegen Blockbildung
    vec3 bloomAt(vec2 uv) {
      vec2 px = 1.0 / uRes;
      vec3 b = textureLod(tBloom, uv, 0.0).rgb * 0.30;
      vec3 m = vec3(0.0), w = vec3(0.0);
      for (int i = 0; i < 4; i++) {
        vec2 o = vec2(i == 0 || i == 3 ? 1.0 : -1.0, i < 2 ? 1.0 : -1.0);
        m += textureLod(tBloom, uv + o * px * 8.0, 2.0).rgb;
        w += textureLod(tBloom, uv + o * px * 32.0, 4.0).rgb;
      }
      return b + m * 0.25 * 0.55 + w * 0.25 * 0.65;
    }
    // Grading: Sättigung und Tönung von Schatten/Lichtern (linear)
    vec3 grade(vec3 c, vec3 sh, vec3 hi, float sat) {
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, sat);
      return c * mix(sh, hi, smoothstep(0.0, 0.45, l));
    }
    // Ebene über ihrem Hintergrund – scharf/tiefenunscharf oder radial zum Zentrum c verwischt (Zoom-Bewegung)
    vec3 level(sampler2D t, sampler2D d, vec2 uv, vec2 c, float blur, vec3 top, vec3 bot, vec4 pool, vec2 dust,
               float tone, vec4 cam, float bloomK, vec3 sh, vec3 hi, vec2 gr) {
      vec4 c0 = texture2D(t, uv);
      float zc = 0.0, sc = 0.0, lodc = 0.0;
      if (cam.w > 0.3) {
        zc = linZ(d, uv, cam);
        sc = cocPx(zc, cam);
        lodc = clamp(log2(max(sc * 0.6, 1.0)), 0.0, 3.0);
      }
      vec4 s;
      if (blur >= 0.002) {
        s = vec4(0.0);
        for (int i = 0; i < BLUR_TAPS; i++) {
          float k = (float(i) / float(BLUR_TAPS - 1) - 0.5) * blur;
          s += textureLod(t, c + (uv - c) * (1.0 + k), lodc);
        }
        s /= float(BLUR_TAPS);
      } else if (cam.w > 0.3) {
        s = dofTex(t, d, uv, cam, c0, zc, sc);
      } else {
        s = c0;
      }
      // Farbsaum am Bildrand: Rot nach außen, Blau nach innen (gleiche Unschärfe wie die Mitte)
      vec2 e = uv - 0.5;
      float ca = uCA * dot(e, e);
      if (ca > 0.0002) {
        vec4 m0 = textureLod(t, uv, lodc);
        s.r += textureLod(t, 0.5 + e * (1.0 + ca), lodc).r - m0.r;
        s.b += textureLod(t, 0.5 + e * (1.0 - ca), lodc).b - m0.b;
      }
      vec3 col = backdrop(uv, top, bot, pool, dust) * (1.0 - clamp(s.a, 0.0, 1.0)) + max(s.rgb, 0.0);
      // Gegenlicht (User 2026-10-23): schwaches Fuell-Licht auf dem Objekt, in der Tiefe etwas staerker, und ein sanfter
      // Lichthof hinter dem Umriss – dunkle Rueckseiten und das ferne Ende bleiben als Silhouette sichtbar (alle Ebenen)
      float a0 = clamp(s.a, 0.0, 1.0);
      float deep = 1.0 - exp(-linZ(d, uv, cam) / max(cam.z * 2.0, 1.0));
      col += normalize(top + 0.05) * (uFill * (0.5 + 0.9 * deep) * a0 + uHalo * textureLod(t, uv, 5.0).a * (1.0 - a0));
      if (bloomK > 0.0005) col += bloomK * bloomAt(uv);
      col *= uExposure;
      col = mix(col, aces(col), tone);
      return grade(col, sh, hi, gr.x);
    }
    // Lichtschleier beim Durchtauchen (statt Teilchen): weiches Leuchten um den Anker in der Farbe der Stimmungen,
    // mit sehr langsamem Rauschen – keine Formen, nur Licht; am stärksten in der Mitte der Fahrt (uDive)
    vec3 veil(vec2 q, float p) {
      float n = 0.7 + 0.3 * vnoise(vec3(q * 1.4, uTime * 0.06));
      vec3 tint = normalize(mix(uTopA, uTopB, p) + 0.02);
      return tint * exp(-dot(q, q) * 3.2) * n * 0.03 * uDive;
    }
    // mittlere Helligkeit eines Bildes um c (grobe Mip-Stufe); wo nichts gerendert ist, zählt der Hintergrund
    float lumAt(sampler2D t, vec2 c, vec3 top, vec3 bot) {
      const vec3 W = vec3(0.2126, 0.7152, 0.0722);
      vec4 a = textureLod(t, c, 7.0);
      return dot(max(a.rgb, 0.0), W) + dot(mix(bot, top, 0.5), W) * (1.0 - clamp(a.a, 0.0, 1.0));
    }
    void main() {
      vec2 uv = vUv;
      float p = uProg;
      vec3 col;
      float grain, con;
      if (p <= 0.0001) {
        col = level(tOuter, dOuter, uv, vec2(0.5), 0.0, uTopA, uBotA, uPoolA, uDustA, uToneOuter, uCamOuter, uBloom, uShA, uHiA, uGrA);
        grain = uGrainOuter; con = uGrA.y;
      } else if (p >= 0.9999) {
        col = level(tInner, dInner, uv, vec2(0.5), 0.0, uTopB, uBotB, uPoolB, uDustB, uToneInner, uCamInner, 0.0, uShB, uHiB, uGrB);
        grain = uGrainInner; con = uGrB.y;
      } else {
        vec2 q = (uv - uAnchor) * vec2(uAspect, 1.0);
        float r = length(q);
        // Durchgehender Zoom: beide Bilder tragen dieselbe radiale Zoom-Unschärfe um den Anker; das innere Bild
        // sitzt mit seinem Blickziel (uInner) auf dem Anker und wächst mit dem Zoom, bis es das Bild füllt
        vec3 o = level(tOuter, dOuter, uv, uAnchor, uBlur, uTopA, uBotA, uPoolA, uDustA, uToneOuter, uCamOuter, uBloom, uShA, uHiA, uGrA);
        vec2 iuv = uv - uAnchor + uInner;
        vec3 ii = level(tInner, dInner, iuv, uInner, uBlur, uTopB, uBotB, uPoolB, uDustB, uToneInner, uCamInner, 0.0, uShB, uHiB, uGrB);
        // Belichtung angleichen: das innere Bild beginnt mit der Helligkeit des äußeren um den Anker und hellt erst
        // spät auf seine eigene auf – kein Helligkeitssprung, keine sichtbare Kante zwischen den Ebenen
        float kE = clamp(lumAt(tOuter, uAnchor, uTopA, uBotA) / max(lumAt(tInner, uInner, uTopB, uBotB), 1e-3), 0.3, 3.0);
        ii *= mix(kE, 1.0, smoothstep(0.3, 0.95, p));
        // Rand des inneren Bildes weich, solange der Anker noch wandert; am Ende deckt es das ganze Bild
        vec2 fe = min(iuv, 1.0 - iuv);
        float inFrame = mix(smoothstep(0.0, 0.06, min(fe.x, fe.y)), 1.0, smoothstep(0.85, 1.0, p));
        // weit gefiederte Iris, wächst exponentiell mit dem Zoom
        float radial = 1.0 - smoothstep(uMaskR * 0.25, uMaskR * 2.0, r);
        float m = max(radial, smoothstep(0.55, 0.95, p)) * inFrame;
        col = mix(o, ii, m);
        grain = mix(uGrainOuter, uGrainInner, m);
        con = mix(uGrA.y, uGrB.y, m);
      }
      if (uDive * uVeilK > 0.001) col += veil((uv - uAnchor) * vec2(uAspect, 1.0), p);
      vec2 d = (uv - 0.5) * vec2(uAspect, 1.0);
      col *= mix(1.0, smoothstep(1.35, 0.25, length(d)), 0.45);
      col = clamp(toSRGB(col), 0.0, 1.0);
      col = mix(col, col * col * (3.0 - 2.0 * col), con);       // sanfte S-Kurve je Stimmung
      col += (hash(uv * uRes + fract(uTime) * 91.7) - 0.5) * grain;
      gl_FragColor = vec4(col * uFade, 1.0);
    }`,
  depthTest: false,
  depthWrite: false,
});
const compScene = new THREE.Scene();
const compQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp);
compQuad.frustumCulled = false;
compScene.add(compQuad);
const compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// Helle Anteile in Viertelauflösung herausziehen (weiches Knie, je Abtastpunkt vor dem Mitteln) → Mipmaps = weiches Bloom
const bloomRT = new THREE.WebGLRenderTarget(2, 2, {
  type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
});
const bright = new THREE.ShaderMaterial({
  uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) }, uThr: { value: LENS.thr } },
  vertexShader: QUAD_VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tSrc;
    uniform vec2 uTexel;
    uniform float uThr;
    varying vec2 vUv;
    vec3 pick(vec2 uv) {
      vec3 c = max(texture2D(tSrc, uv).rgb, 0.0);
      float l = max(c.r, max(c.g, c.b));
      float k = max(l - uThr, 0.0);
      k = k * k / (k + 0.3);
      return c * (k / max(l, 1e-4));
    }
    void main() {
      vec3 b = pick(vUv + uTexel * vec2(-1.0, -1.0)) + pick(vUv + uTexel * vec2(1.0, -1.0))
             + pick(vUv + uTexel * vec2(-1.0, 1.0)) + pick(vUv + uTexel * vec2(1.0, 1.0));
      gl_FragColor = vec4(min(b * 0.25, vec3(8.0)), 1.0);
    }`,
  depthTest: false,
  depthWrite: false,
});
const brightScene = new THREE.Scene();
const brightQuad = new THREE.Mesh(compQuad.geometry, bright);
brightQuad.frustumCulled = false;
brightScene.add(brightQuad);

// ---------- Lupe der Info-Karte: Live-Ausschnitt der Szene um den gewählten Punkt (Vorschau 2026-10-24, Objekt:A) ----------
// Eigene Kamera blickt aus der Richtung der Hauptkamera auf den Punkt und schwenkt langsam ±25° (reduced-motion: still).
// Bildbreite und Abstand einmal bei der Auswahl: ≈ 160 px der Hauptansicht um den Punkt. Die Zusammenführung (Hintergrund,
// Grading, Tonemapping; ohne Tiefenunschärfe, Bloom, Farbsaum) läuft per Viewport in die linke untere Ecke des Bildschirms,
// wird sofort in die Lupe kopiert und danach vom normalen Bild übermalt. Jedes 2. Bild; Stufe „Leicht“: ein Standbild.
const LOUPE = { viewPx: 160, swing: THREE.MathUtils.degToRad(25), period: 18 };
const loupe = {
  cam: new THREE.PerspectiveCamera(30, 1, 0.1, 100),
  rt: new THREE.WebGLRenderTarget(2, 2, {
    type: THREE.HalfFloatType, samples: eff().msaa,
    generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
    depthTexture: new THREE.DepthTexture(2, 2),
  }),
  canvas: null, ctx: null, size: 0, dist: 1, t: 0, skip: false, done: false,
  dir: new THREE.Vector3(), up: new THREE.Vector3(), vp: new THREE.Vector4(), res: new THREE.Vector2(), cam4: new THREE.Vector4(),
};

function renderLoupe(lv, L, real) {
  const h = lv.hotspots.find((x) => x.id === L.id);
  if (!h) return;
  const c = loupe.cam, main = lv.camera;
  if (L.canvas !== loupe.canvas) {
    // neue Karte: Bildbreite ≈ 160 px der Hauptansicht um den Punkt, Abstand wie die Hauptkamera
    loupe.canvas = L.canvas;
    loupe.ctx = L.canvas.getContext('2d', { alpha: false });
    loupe.size = 0;
    loupe.t = 0;
    loupe.skip = false;
    loupe.done = false;
    loupe.dist = main.position.distanceTo(h.pos);
    c.fov = THREE.MathUtils.radToDeg(2 * Math.atan((LOUPE.viewPx / window.innerHeight) * Math.tan(THREE.MathUtils.degToRad(main.fov) / 2)));
    c.near = main.near;
    c.far = main.far;
    c.updateProjectionMatrix();
  } else if ((loupe.skip = !loupe.skip) || loupe.done) {
    return;
  }
  const pr = renderer.getPixelRatio();
  if (!loupe.size) {
    const cw = L.canvas.clientWidth;
    if (!cw) return;
    loupe.size = Math.max(2, Math.round(cw * pr));
    L.canvas.width = L.canvas.height = loupe.size;
    if (loupe.rt.width !== loupe.size) loupe.rt.setSize(loupe.size, loupe.size);
  }
  const px = loupe.size;
  if (!still) loupe.t += real;
  // aus der Blickrichtung der Hauptkamera, um deren Bild-Hochachse geschwenkt
  loupe.up.setFromMatrixColumn(main.matrixWorld, 1).normalize();
  loupe.dir.subVectors(h.pos, main.position).normalize().applyAxisAngle(loupe.up, LOUPE.swing * Math.sin((loupe.t * 2 * Math.PI) / LOUPE.period));
  c.position.copy(h.pos).addScaledVector(loupe.dir, -loupe.dist);
  c.up.copy(loupe.up);
  c.lookAt(h.pos);
  c.updateMatrixWorld();
  // Schatten hängen nicht an der Kamera: die Schattenkarte des Hauptbilds weiterverwenden (Ebene 7)
  const shadowAuto = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(loupe.rt);
  renderer.render(lv.scene, c);
  renderer.shadowMap.autoUpdate = shadowAuto;
  // Zusammenführung mit dem Lupenbild, Linse aus
  const u = comp.uniforms;
  const keep = { t: u.tOuter.value, d: u.dOuter.value, aspect: u.uAspect.value, bloom: u.uBloom.value, ca: u.uCA.value };
  loupe.res.copy(u.uRes.value);
  loupe.cam4.copy(u.uCamOuter.value);
  u.tOuter.value = loupe.rt.texture;
  u.dOuter.value = loupe.rt.depthTexture;
  u.uAspect.value = 1;
  u.uBloom.value = 0;
  u.uCA.value = 0;
  u.uRes.value.set(px, px);
  u.uCamOuter.value.set(c.near, c.far, loupe.dist, 0);
  renderer.setRenderTarget(null);
  renderer.setViewport(0, 0, px / pr, px / pr);
  renderer.render(compScene, compCam);
  renderer.getCurrentViewport(loupe.vp);   // Gerätepixel nach der Rundung in three.js
  const H = renderer.domElement.height;
  loupe.ctx.drawImage(renderer.domElement, 0, H - loupe.vp.w, loupe.vp.z, loupe.vp.w, 0, 0, px, px);
  const { w, h: vh } = viewSize();
  renderer.setViewport(0, 0, w, vh);
  u.tOuter.value = keep.t;
  u.dOuter.value = keep.d;
  u.uAspect.value = keep.aspect;
  u.uBloom.value = keep.bloom;
  u.uCA.value = keep.ca;
  u.uRes.value.copy(loupe.res);
  u.uCamOuter.value.copy(loupe.cam4);
  loupe.done = eff().id === 'light';
}

function setMood(target, index) {
  const m = MOODS[index];
  target.top.value.fromArray(m.top);
  target.bot.value.fromArray(m.bot);
  target.pool.value.fromArray(m.pool);
  target.dust.value.fromArray(m.dust);
  target.sh.value.fromArray(m.grade.sh);
  target.hi.value.fromArray(m.grade.hi);
  target.gr.value.set(m.grade.sat, m.grade.con);
}

// ---------- Hilfen ----------
const clampf = (x, a, b) => Math.min(b, Math.max(a, x));
const smootherstep = (t) => { t = clampf(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const smooth = (a, b, x) => { const t = clampf((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const pose = (pos, target) => ({ pos: pos.clone(), target: target.clone() });

// Tauchfahrt: sanft anfahren, lange mit konstanter Zoomrate, sanft ankommen (Anteil a je Rampe)
function easeDive(t, a = 0.25) {
  t = clampf(t, 0, 1);
  const k = 1 / (1 - a);
  if (t < a) return (k * t * t) / (2 * a);
  if (t > 1 - a) return 1 - (k * (1 - t) * (1 - t)) / (2 * a);
  return k * (t - a / 2);
}

// Kamera zwischen zwei Posen: Ziel linear, Abstand logarithmisch (gleichmäßiges Zoomgefühl)
function lerpPose(cam, a, b, k) {
  const tgt = a.target.clone().lerp(b.target, k);
  const da = a.pos.clone().sub(a.target), db = b.pos.clone().sub(b.target);
  const la = Math.max(da.length(), 1e-6), lb = Math.max(db.length(), 1e-6);
  const dir = da.divideScalar(la).lerp(db.divideScalar(lb), k).normalize();
  cam.position.copy(tgt).addScaledVector(dir, la * Math.pow(lb / la, k));
  cam.lookAt(tgt);
  return tgt;
}

const hfwOf = (lv, dist) => 2 * dist * Math.tan(THREE.MathUtils.degToRad(lv.camera.fov) / 2) * lv.camera.aspect * lv.unit;

// wirksame Stufe: Qualitätsstufe (quality.js) mit den Hauptreglern (Detailgrad, Schatten, Effekte) und Leistungsschaltern
// des Zahnrads (settings.js) darüber
function eff() {
  const Q = quality.get(), S = settings.S;
  const dof = S.dof && S.fx > 0;
  return {
    ...Q, shadows: Q.shadows && S.shadow !== 'off', detail: Q.detail * S.detail,
    dof: dof ? Q.dof * S.fx : 0, dofTaps: dof ? Q.dofTaps : 0, bloom: S.bloom ? Q.bloom * S.fx : 0, ca: S.ca ? Q.ca * S.fx : 0,
  };
}
// Renderskala wirkt auf das Pixelverhältnis der Stufe (auch unter 1 Gerätepixel: weiche, aber flüssige Bilder)
function pixelRatio(Q) {
  return Math.min(window.devicePixelRatio, Q.dpr) * settings.S.scale;
}

function viewSize() {
  return { w: window.innerWidth, h: window.innerHeight, dpr: renderer.getPixelRatio() };
}

// Bildmitte der Szene in die freie Fläche zwischen Skalen-Leiter und Infotafel legen
function stageShift() {
  if (window.innerWidth <= 860 || document.body.classList.contains('panel-collapsed')) return 0;
  const panel = document.getElementById('panel').getBoundingClientRect();
  const ladder = document.querySelector('.ladder').getBoundingClientRect();
  return (panel.width - ladder.width) / 2;
}

function fitLevel(lv) {
  const { w, h, dpr } = viewSize();
  const s = (lv.resScale || 1) * eff().res;
  lv.rt.setSize(Math.max(2, Math.round(w * dpr * s)), Math.max(2, Math.round(h * dpr * s)));
  lv.camera.aspect = w / h;
  lv.camera.setViewOffset(w, h, stageShift(), 0, w, h);
  lv.dirty = true;
}

function resize() {
  const { w, h, dpr } = viewSize();
  renderer.setSize(w, h, false);
  comp.uniforms.uAspect.value = w / h;
  comp.uniforms.uRes.value.set(w * dpr, h * dpr);
  bloomRT.setSize(Math.max(2, Math.round((w * dpr) / 4)), Math.max(2, Math.round((h * dpr) / 4)));
  for (const lv of state.levels.values()) fitLevel(lv);
  loupe.size = 0;      // Lupe neu vermessen und zeichnen (Pixelverhältnis, Größe im schmalen Fenster)
  loupe.done = false;
}

// Qualitätsstufe anwenden (Start und Umschalten): Pixelverhältnis, Schatten, Farbsaum, Abtastpunkte des Shaders,
// Kantenglättung der Ebenen-Bilder (Ziel neu anlegen) und Detailgrad der geladenen Ebenen
function applyQuality(Q) {
  renderer.setPixelRatio(pixelRatio(Q));
  renderer.shadowMap.enabled = Q.shadows;
  comp.uniforms.uCA.value = LENS.ca * Q.ca;
  const d = comp.defines;
  if (d.DOF_TAPS !== Q.dofTaps || d.BLUR_TAPS !== Q.blurTaps) {
    d.DOF_TAPS = Q.dofTaps;
    d.BLUR_TAPS = Q.blurTaps;
    comp.needsUpdate = true;
  }
  for (const lv of state.levels.values()) {
    const samples = (lv.resScale || 1) < 1 ? 0 : Q.msaa;
    if (lv.rt.samples !== samples) { lv.rt.samples = samples; lv.rt.dispose(); }
    if (lv.setParam) lv.setParam('quality', Q);
    lv.dirty = true;
  }
  if (loupe.rt.samples !== Q.msaa) { loupe.rt.samples = Q.msaa; loupe.rt.dispose(); }
  resize();
}
quality.onChange((Q, changed) => { if (changed) applyQuality(eff()); });

// Zahnrad (settings.js): Bewegung, Licht, Details sofort; Leistungsschalter über applyQuality; alle Ebenen neu zeichnen
const keyTint = new THREE.Color(1, 1, 1);
settings.on((S, keys) => {
  still = reduced || S.motion === 'off';
  SEM_SWING.k = still || !S.sem ? 0 : 1;
  semChargeOn(S.charge);
  const u = comp.uniforms;
  u.uExposure.value = S.exposure;
  u.uPoolK.value = S.pool;
  u.uDustK.value = S.dust ? 1 : 0;
  u.uVeilK.value = S.veil ? 1 : 0;
  keyTint.setRGB(...kelvinTint(S.kelvin), THREE.SRGBColorSpace);
  document.body.classList.toggle('hotspots-off', !S.hotspots);
  if (state.controls && (still || !S.orbit)) state.controls.autoRotate = false;
  if (keys && keys.some((k) => PERF_KEYS.includes(k))) applyQuality(eff());
  for (const lv of state.levels.values()) lv.dirty = true;
});
mountSettings(() => renderer.domElement.width * renderer.domElement.height);

// ---------- Ebenen ----------
// quiet = Vorladen im Hintergrund ohne Ladeanzeige; die Anzeige zählt nur sichtbar angeforderte Ebenen
let waiting = 0;
function getLevel(i, quiet = false) {
  if (state.levels.has(i)) return Promise.resolve(state.levels.get(i));
  let job = state.loading.get(i);
  if (!job) job = buildLevel(i);
  if (!quiet) {
    waiting++;
    hud.setLoading(true);
    const done = () => hud.setLoading(--waiting > 0);
    job.then(done, done);
  }
  return job;
}

function buildLevel(i) {
  const job = (async () => {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const mod = await LOADERS[i]();
    const lv = mod.create({ env, aspect: window.innerWidth / window.innerHeight, temp: state.pyro.shown, rh: state.rh, wet: state.wet, quality: eff() });
    lv.index = i;
    if (lv.setParam) { lv.setParam('target', state.temp); lv.setParam('play', state.pyro.playing); lv.setParam('quality', eff()); lv.setParam('detector', state.det); }
    lv.scene.background = null;
    // Farbe mit Mipmaps (Bloom, weiche Unschärfe) und Tiefe als Textur (Tiefenunschärfe)
    lv.rt = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType, samples: (lv.resScale || 1) < 1 ? 0 : eff().msaa,
      generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
      depthTexture: new THREE.DepthTexture(2, 2),
    });
    lv.camera.position.copy(lv.home.pos);
    lv.camera.lookAt(lv.home.target);
    lv.target = lv.home.target.clone();
    fitLevel(lv);
    renderer.compile(lv.scene, lv.camera);
    state.levels.set(i, lv);
    state.loading.delete(i);
    return lv;
  })();
  state.loading.set(i, job);
  job.catch(() => state.loading.delete(i));   // fehlgeschlagen → der nächste Aufruf baut neu
  return job;
}

function idle(fn) {
  (window.requestIdleCallback || ((f) => setTimeout(f, 400)))(fn, { timeout: 2500 });
}

function activate(lv) {
  state.index = lv.index;
  state.active = lv;
  state.cine = { idle: 0, w: 0, base: null };
  if (state.controls) state.controls.dispose();
  const c = new OrbitControls(lv.camera, canvas);
  c.enableDamping = true;
  c.dampingFactor = 0.045;
  c.rotateSpeed = 0.5;
  c.zoomSpeed = 0.7;
  c.panSpeed = 0.6;
  Object.assign(c, { ...lv.orbit, autoRotate: !still && settings.S.orbit && !!lv.orbit.autoRotate });
  c.autoRotateSpeed = 0.22;
  c.target.copy(lv.target);
  c.addEventListener('start', () => { cineCommit(); c.autoRotate = false; state.focus = null; state.dolly = null; state.dragging = true; });
  c.addEventListener('end', () => { state.dragging = false; });
  c.update();
  state.controls = c;
  setMood(moodA, lv.index);
  hud.setLevel(lv.index, lv, state);
  hud.setRailRange(hfwOf(lv, c.minDistance), hfwOf(lv, c.maxDistance));
  history.replaceState(null, '', `#ebene=${lv.index + 1}`);
  lv.dirty = true;
  for (const [k, other] of state.levels) {
    if (Math.abs(k - lv.index) > 1) {
      other.dispose();
      other.rt.dispose();
      state.levels.delete(k);
    }
  }
  setTimeout(() => idle(() => {
    if (lv.index + 1 < LOADERS.length && state.index === lv.index && !state.tr) getLevel(lv.index + 1, true);
  }), 3000);
}

// Auftakt abbrechen, sobald der Besucher eingreift – die Kamera bleibt, wo sie gerade ist
function endIntro() {
  if (!state.intro) return;
  state.intro = null;
  state.controls.target.copy(state.active.home.target);
  state.controls.enabled = true;
  state.controls.update();
  cineCommit();
}

async function goTo(target, via = null) {
  if (state.tr || !state.active || target === state.index || target < 0 || target >= LOADERS.length) return;
  endIntro();
  const from = state.active;
  const to = await getLevel(target);
  if (state.tr || state.active !== from) return;
  const down = target > from.index;
  const adjacent = Math.abs(target - from.index) === 1;
  const outer = down ? from : to;
  const inner = down ? to : from;
  cineCommit();   // die gerade sichtbare Pose ist der Start der Fahrt
  let anchorWorld;
  if (down) {
    anchorWorld = via ? via.pos.clone() : state.controls.target.clone();
    state.poses.set(from.index, { ...pose(from.camera.position, state.controls.target), anchorWorld: anchorWorld.clone(), adjacent: adjacent && !!via });
  } else {
    const saved = state.poses.get(to.index);
    anchorWorld = saved && saved.adjacent && adjacent ? saved.anchorWorld.clone() : to.home.target.clone();
  }
  state.controls.enabled = false;
  state.focus = null;

  const near = (p) => {
    const dir = p.pos.clone().sub(anchorWorld);
    const dist = dir.length();
    return { pos: anchorWorld.clone().addScaledVector(dir.normalize(), Math.max(dist * ZOOM.near, 1e-4)), target: anchorWorld.clone() };
  };
  const far = (p) => ({ pos: p.target.clone().add(p.pos.clone().sub(p.target).multiplyScalar(1 / ZOOM.near)), target: p.target.clone() });
  const arrival = (lv) => {
    const dir = lv.home.pos.clone().sub(lv.home.target);
    const d = Math.min(dir.length() * ZOOM.arrive, (lv.orbit.maxDistance || Infinity) * 0.95);
    return { pos: lv.home.target.clone().addScaledVector(dir.normalize(), d), target: lv.home.target.clone() };
  };
  let outerFrom, outerTo, innerFrom, innerTo;
  if (down) {
    outerFrom = pose(from.camera.position, state.controls.target);
    outerTo = near(outerFrom);
    innerTo = arrival(to);
    innerFrom = far(innerTo);
  } else {
    const saved = state.poses.get(to.index);
    outerTo = saved && adjacent ? pose(saved.pos, saved.target) : pose(to.home.pos, to.home.target);
    outerFrom = near(outerTo);
    innerFrom = pose(from.camera.position, state.controls.target);
    innerTo = far(innerFrom);
  }
  state.tr = {
    t: 0, dur: still ? 1.0 : adjacent ? settings.S.dive : settings.S.dive * 0.8, down, outer, inner, to, anchorWorld,
    outerFrom, outerTo, innerFrom, innerTo, focusOuter: 1, focusInner: 1, e: 0,
  };
  setMood(moodA, outer.index);
  setMood(moodB, inner.index);
  hud.hideMarkers(true);
}

function stepTransition(dt) {
  const tr = state.tr;
  tr.t = freeze !== null ? freeze : Math.min(1, tr.t + dt / tr.dur);
  const e = still ? smootherstep(tr.t) : easeDive(tr.t);
  tr.e = e;
  const p = tr.down ? e : 1 - e;            // 0 = nur äußeres Bild, 1 = nur inneres
  let outerTgt, innerTgt;
  if (still) {
    outerTgt = lerpPose(tr.outer.camera, tr.outerFrom, tr.outerTo, tr.down ? 0 : 1);
    innerTgt = lerpPose(tr.inner.camera, tr.innerFrom, tr.innerTo, tr.down ? 1 : 0);
  } else {
    outerTgt = lerpPose(tr.outer.camera, tr.outerFrom, tr.outerTo, e);
    innerTgt = lerpPose(tr.inner.camera, tr.innerFrom, tr.innerTo, e);
  }
  tr.focusOuter = tr.outer.camera.position.distanceTo(outerTgt);
  tr.focusInner = tr.inner.camera.position.distanceTo(innerTgt);
  // Anker im äußeren Bild (wandert mit der Kamerafahrt zum Blickziel) und Blickziel des inneren Bildes;
  // Matrizen vorher aktualisieren, sonst rechnet project() im ersten Bild der Fahrt mit der alten Blickrichtung
  tr.outer.camera.updateMatrixWorld();
  tr.inner.camera.updateMatrixWorld();
  const a = tr.anchorWorld.clone().project(tr.outer.camera);
  const b = innerTgt.clone().project(tr.inner.camera);
  const u = comp.uniforms;
  u.uAnchor.value.set(clampf((a.x + 1) / 2, 0.08, 0.92), clampf((a.y + 1) / 2, 0.08, 0.92));
  u.uInner.value.set((b.x + 1) / 2, (b.y + 1) / 2);
  u.uProg.value = p;
  // Iris wächst exponentiell wie der Zoom: 6 % der Bildhöhe → über die Bilddiagonale hinaus
  u.uMaskR.value = 0.06 * Math.pow(18, p) * smooth(0, 0.06, p);
  u.uBlur.value = still ? 0 : 0.11 * Math.sin(Math.PI * p);
  // Lichtschleier: am stärksten in der Mitte der Fahrt
  u.uDive.value = still ? 0 : Math.pow(Math.sin(Math.PI * e), 1.5);
  // Zoom-Zähler in der Messleiste läuft logarithmisch mit
  const hOut = hfwOf(tr.outer, tr.focusOuter);
  const hIn = hfwOf(tr.inner, tr.focusInner);
  hud.updateScale(Math.exp(Math.log(hOut) * (1 - p) + Math.log(hIn) * p), window.innerWidth, p < 0.5 ? tr.outer : tr.inner);
  if (tr.t >= 1) {
    const to = tr.to;
    const end = tr.down ? tr.innerTo : tr.outerTo;
    to.camera.position.copy(end.pos);
    to.camera.lookAt(end.target);
    to.target = end.target.clone();
    state.tr = null;
    u.uProg.value = 0;
    u.uBlur.value = 0;
    u.uDive.value = 0;
    activate(to);
    hud.hideMarkers(false);
  }
}

// ---------- Leerlauf-Fahrt: langsamer Bogen, Kran, Dolly und Blickdrift statt starrer Kamera ----------
// Der Versatz wird nach controls.update() aufgesetzt und vor dem nächsten Update wieder abgenommen.
// Greift der Besucher ein, wird die sichtbare Pose zur Grundpose (kein Sprung).
function cineUndo(lv) {
  const b = state.cine.base;
  if (!b) return;
  lv.camera.position.copy(b.pos);
  state.controls.target.copy(b.target);
  state.cine.base = null;
}
function cineCommit() {
  state.cine.base = null;
  state.cine.idle = 0;
  state.cine.w = 0;
}
const _sph = new THREE.Spherical(), _v = new THREE.Vector3(), _right = new THREE.Vector3(), _up = new THREE.Vector3();
function cineApply(lv, real) {
  const ci = state.cine, c = state.controls;
  ci.idle += real;
  ci.w = still || !settings.S.cine || state.dragging || state.focus || state.dolly || freeze !== null ? 0 : smooth(CINE.delay, CINE.delay + CINE.ramp, ci.idle);
  if (ci.w <= 0.0005) return;
  ci.base = { pos: lv.camera.position.clone(), target: c.target.clone() };
  const o = { ...CINE, ...(lv.cine || {}) };
  const t = state.time, w = ci.w;
  _sph.setFromVector3(_v.copy(lv.camera.position).sub(c.target));
  _sph.theta += w * o.orbit * (0.75 * Math.sin(t * 0.105 + 0.7) + 0.25 * Math.sin(t * 0.047 + 2.0));
  _sph.phi += w * o.crane * Math.sin(t * 0.077 + 2.1);
  _sph.radius *= 1 + w * o.dolly * Math.sin(t * 0.091 + 0.3);
  if (Number.isFinite(c.minAzimuthAngle) && Number.isFinite(c.maxAzimuthAngle)) _sph.theta = clampf(_sph.theta, c.minAzimuthAngle, c.maxAzimuthAngle);
  _sph.phi = clampf(_sph.phi, Math.max(0.02, c.minPolarAngle), Math.min(Math.PI - 0.02, c.maxPolarAngle));
  _sph.radius = clampf(_sph.radius, c.minDistance, c.maxDistance);
  _right.setFromMatrixColumn(lv.camera.matrixWorld, 0);
  _up.setFromMatrixColumn(lv.camera.matrixWorld, 1);
  const drift = o.drift * _sph.radius * w;
  c.target.addScaledVector(_right, drift * Math.sin(t * 0.13 + 1.3)).addScaledVector(_up, o.lift * drift * Math.sin(t * 0.171 + 0.4));
  lv.camera.position.copy(c.target).add(_v.setFromSpherical(_sph));
  lv.camera.lookAt(c.target);
}

function render(lv, dt, force) {
  const animated = lv.update ? lv.update(dt, state.time) : false;
  lv.camera.updateMatrixWorld();
  const e = lv.camera.matrixWorld.elements, p = lv.camera.projectionMatrix.elements;
  const last = lv.lastCam || (lv.lastCam = new Float64Array(32));
  let moved = false;
  for (let i = 0; i < 16; i++) {
    if (last[i] !== e[i]) { moved = true; last[i] = e[i]; }
    if (last[16 + i] !== p[i]) { moved = true; last[16 + i] = p[i]; }
  }
  if (force || animated || moved || lv.dirty) {
    renderer.setRenderTarget(lv.rt);
    const lit = lightUp(lv);
    renderer.render(lv.scene, lv.camera);
    if (lit) lightDown(lv);
    lv.dirty = false;
  }
}

// Licht aus dem Zahnrad, nur für die Dauer des Renderns: die Ebenen animieren ihre Lichter selbst (Gegenlicht, Glut), deshalb
// Faktoren auf den aktuellen Wert und danach zurück. Hauptlicht = hellstes gerichtetes Licht (bekommt auch die Farbtemperatur),
// übrige gerichtete = Gegenlicht, Halbkugel-/Umgebungslicht + Umgebungsbild = Umgebung; Lichtstärke wirkt auf alle (auch Glut);
// Schatten „Weich“ hellt die Schatten der Licht-Werfer auf (shadow.intensity 0,55)
const _keyColor = new THREE.Color();
function lightUp(lv) {
  const S = settings.S;
  if (S.light === 1 && S.key === 1 && S.rim === 1 && S.env === 1 && S.kelvin === 6500 && S.shadow !== 'soft') return false;
  if (!lv.lights) {
    lv.lights = [];
    lv.scene.traverse((o) => { if (o.isLight) lv.lights.push(o); });
    lv.keyLight = lv.lights.filter((l) => l.isDirectionalLight).sort((a, b) => b.intensity - a.intensity)[0] || null;
    lv.lightBase = new Float32Array(lv.lights.length);
    lv.shadowBase = new Float32Array(lv.lights.length);
  }
  const soft = S.shadow === 'soft';
  lv.lights.forEach((l, i) => {
    lv.lightBase[i] = l.intensity;
    if (l.shadow && 'intensity' in l.shadow) { lv.shadowBase[i] = l.shadow.intensity; if (soft) l.shadow.intensity *= 0.55; }
    l.intensity *= S.light * (l === lv.keyLight ? S.key : l.isDirectionalLight || l.isSpotLight ? S.rim : l.isHemisphereLight || l.isAmbientLight ? S.env : 1);
  });
  if (lv.keyLight) { _keyColor.copy(lv.keyLight.color); lv.keyLight.color.multiply(keyTint); }
  lv.envBase = lv.scene.environmentIntensity;
  lv.scene.environmentIntensity *= S.env * S.light;
  return true;
}
function lightDown(lv) {
  lv.lights.forEach((l, i) => {
    l.intensity = lv.lightBase[i];
    if (l.shadow && 'intensity' in l.shadow) l.shadow.intensity = lv.shadowBase[i];
  });
  if (lv.keyLight) lv.keyLight.color.copy(_keyColor);
  lv.scene.environmentIntensity = lv.envBase;
}

// Kamera-Werte für die Linse: near, far, Fokusabstand, größte Unschärfe in Gerätepixeln (lv.dof gilt für 1080 px Höhe)
function lensUniform(u, lv, focus, amount) {
  const c = lv.camera;
  u.set(c.near, c.far, Math.max(focus, c.near * 2), (lv.dof || 0) * amount * renderer.domElement.height / 1080);
}

// ---------- Eingaben ----------
function diveHotspot(id) {
  const lv = state.active;
  if (!lv) return;
  const h = id ? lv.hotspots.find((x) => x.id === id) : lv.hotspots.find((x) => x.kind === 'dive');
  if (h && h.kind === 'dive') goTo(lv.index + 1, h);
}

const hud = createHud({
  onJump: (i) => goTo(i),
  onUp: () => goTo(state.index - 1),
  onDown: () => diveHotspot(),
  onDive: (id) => diveHotspot(id),
  onDetector: (mode) => {
    state.det = mode;
    semDetectorMode(mode);
    for (const lv of state.levels.values()) if (lv.setParam) lv.setParam('detector', mode);
  },
  onHotspot: (id, fromMarker) => {
    if (state.tr || !state.active) return;
    const h = state.active.hotspots.find((x) => x.id === id);
    if (!h) return;
    if (fromMarker && h.kind === 'dive') { diveHotspot(id); return; }
    endIntro();
    hud.select(id, state);
    if (state.active.onHotspot) state.active.onHotspot(id);
    const c = state.controls;
    c.autoRotate = false;
    cineCommit();
    // Blick sanft zum Punkt schwenken und ein Stück heranfahren
    state.focus = {
      t: 0,
      fromT: c.target.clone(), toT: c.target.clone().lerp(h.pos, 0.6),
      fromP: c.object.position.clone(), toP: c.object.position.clone().lerp(h.pos, 0.1),
    };
  },
  // Zoom-Schiene: Bildbreite → Kameraabstand; losgelassen jenseits des Anschlags → Ebene wechseln
  onRail: (hfw, phase) => {
    if (state.tr || !state.active) return;
    endIntro();
    const lv = state.active, c = state.controls;
    const dist = hfw / (2 * Math.tan(THREE.MathUtils.degToRad(lv.camera.fov) / 2) * lv.camera.aspect * lv.unit);
    c.autoRotate = false;
    cineCommit();
    state.focus = null;
    state.dolly = { to: clampf(dist, c.minDistance, c.maxDistance) };
    if (phase !== 'end') return;
    if (dist > c.maxDistance * 1.05 && lv.index > 0) goTo(lv.index - 1);
    else if (dist < c.minDistance * 0.95) diveHotspot();
  },
  onTemp: (v) => {
    const p = state.pyro;
    state.temp = v;
    pushParam('target', v);
    if (p.playing) endPlay();
    startGlide(p.shown, v, GLIDE_SECONDS, false);
  },
  onPlay: () => togglePlay(),
  onSeek: (T) => seekPyro(T),
  onRh: (v) => {
    state.rh = v;
    state.wet = wetDiameterNm(state.wet, v);
    for (const lv of state.levels.values()) if (lv.setParam) { lv.setParam('rh', v); lv.setParam('wet', state.wet); }
    return state.wet;
  },
});

const wheel = { acc: 0, dir: '', timer: 0 };
canvas.addEventListener('wheel', (e) => {
  endIntro();
  if (state.tr || !state.controls) return;
  const c = state.controls;
  const dist = c.object.position.distanceTo(c.target);
  const dy = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
  let dir = '';
  if (dy > 0 && dist >= c.maxDistance * 0.985 && state.index > 0) dir = 'up';
  if (dy < 0 && dist <= c.minDistance * 1.015 && state.active.hotspots.some((h) => h.kind === 'dive')) dir = 'down';
  if (!dir || (wheel.dir && wheel.dir !== dir)) { wheel.acc = 0; wheel.dir = ''; hud.setEdgeMeter('', 0); return; }
  wheel.dir = dir;
  wheel.acc += Math.abs(dy);
  hud.setEdgeMeter(dir, Math.min(1, wheel.acc / 500));
  clearTimeout(wheel.timer);
  wheel.timer = setTimeout(() => { wheel.acc = 0; wheel.dir = ''; hud.setEdgeMeter('', 0); }, 700);
  if (wheel.acc > 500) {
    wheel.acc = 0; wheel.dir = '';
    hud.setEdgeMeter('', 0);
    if (dir === 'up') goTo(state.index - 1); else diveHotspot();
  }
}, { passive: true });
canvas.addEventListener('pointerdown', endIntro);

window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape' && hud.closeCard()) e.preventDefault();
  else if (e.key === 'Escape' || e.key === 'PageUp') { e.preventDefault(); goTo(state.index - 1); }
  else if (e.key === 'PageDown') { e.preventDefault(); diveHotspot(); }
  else if (/^[1-7]$/.test(e.key)) goTo(+e.key - 1);
});

window.addEventListener('hashchange', () => {
  const m = /ebene=(\d)/.exec(location.hash);
  if (m && +m[1] - 1 !== state.index) goTo(+m[1] - 1);
});
window.addEventListener('resize', resize);
document.getElementById('btn-panel').addEventListener('click', () => requestAnimationFrame(resize));

if (tour) ['pointerdown', 'wheel', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { tour.dwell = Infinity; }, { once: true }));
function stepTour(real) {
  if (!tour || state.tr || state.intro || !state.active) return;
  tour.since += real;
  if (tour.since < tour.dwell) return;
  tour.since = 0;
  if (state.active.hotspots.some((h) => h.kind === 'dive')) diveHotspot();
  else goTo(0);
}

// Auftakt: weiter Bogen um das Stück – von oben und weit weg in einem langen Kranschwenk herab auf die Heimpose
function stepIntro(lv, real) {
  const it = state.intro;
  it.t = Math.min(1, it.t + real / it.dur);
  const k = smootherstep(it.t);
  const kr = 1 - Math.pow(1 - it.t, 2.6);                     // Abstand: früh heran, lange weich auslaufend
  _sph.set(
    Math.exp(Math.log(it.from.radius) + (Math.log(it.to.radius) - Math.log(it.from.radius)) * kr),
    it.from.phi + (it.to.phi - it.from.phi) * k,
    it.from.theta + (it.to.theta - it.from.theta) * k,
  );
  lv.camera.position.copy(it.target).add(_v.setFromSpherical(_sph));
  lv.camera.lookAt(it.target);
  if (it.t >= 1) endIntro();
}

// ---------- Pyrolyse-Labor: gezeigte Temperatur ----------
// Ein Zielwechsel gleitet ≈ 1,2 s; „Pyrolyse abspielen“ fährt am Stück von Raumtemperatur zur gewählten Temperatur
// (steht die gezeigte Temperatur nach einem Kapitel-Sprung darunter, ab dort – wie ein Video ab dem Abspielpunkt).
// Alle Ebenen bekommen den laufenden Wert (setParam 'temp'), sie blenden ihre Strukturen selbst weich über.
const GLIDE_SECONDS = 1.2, PLAY_URL = +params.get('playsec');   // ?playsec=4 verkürzt den Zeitraffer (Prüfläufe), sonst Zahnrad
function pushParam(name, value) {
  for (const lv of state.levels.values()) if (lv.setParam) lv.setParam(name, value);
}
function startGlide(from, to, dur, play) {
  state.pyro.tween = still && !play ? { from: to, to, t: 0, dur: 0.001, play } : { from, to, t: 0, dur, play };
}
function endPlay() {
  state.pyro.playing = false;
  pushParam('play', false);
}
function togglePlay() {
  const p = state.pyro;
  if (p.playing) {
    endPlay();
    startGlide(p.shown, state.temp, GLIDE_SECONDS, false);
    return;
  }
  p.playing = true;
  pushParam('play', true);
  pushParam('target', state.temp);
  const from = p.shown < state.temp - 1 ? p.shown : T_ROOM;
  startGlide(from, state.temp, still ? 1 : playSeconds(from), true);
}
const playSeconds = (from) => Math.max(0.5, (PLAY_URL || settings.S.play) * (state.temp - from) / Math.max(1, state.temp - T_ROOM));
// Kapitel der Zeitleiste: gezeigte Temperatur springt an den Phasenbeginn; ein laufender Zeitraffer spielt von dort
// bis zum Ziel weiter, sonst gleitet die Szene hin und bleibt dort stehen
function seekPyro(T) {
  const p = state.pyro;
  if (p.playing && T < state.temp) { startGlide(T, state.temp, still ? 1 : playSeconds(T), true); return; }
  if (p.playing) endPlay();
  startGlide(p.shown, T, GLIDE_SECONDS, false);
}
function stepPyro(real) {
  const p = state.pyro, tw = p.tween;
  if (!tw) return;
  tw.t += real;
  const k = clampf(tw.t / tw.dur, 0, 1);
  // Zeitraffer fast linear (Phasen gleichmäßig lesbar), Reglerwechsel weich
  const e = tw.play ? 0.75 * k + 0.25 * k * k * (3 - 2 * k) : smootherstep(k);
  p.shown = tw.from + (tw.to - tw.from) * e;
  pushParam('temp', p.shown);
  if (k >= 1) {
    p.tween = null;
    if (p.playing) endPlay();
  }
  hud.setLive(p.shown, p.playing, k >= 1);
}

// ---------- Schleife ----------
let last = performance.now(), nextAt = 0;
function frame(now) {
  requestAnimationFrame(frame);   // zuerst: ein Fehler in einem einzelnen Bild hält die Schleife nicht dauerhaft an
  // Bildraten-Deckel (Zahnrad): zu frühe Bilder auslassen; nextAt läuft im Takt weiter (2 ms Spiel), hängt nie hinterher
  const cap = settings.S.fps;
  if (cap) {
    if (now < nextAt - 2) return;
    nextAt = Math.max(nextAt + 1000 / cap, now);
  }
  // echte Zeit für Einblenden, Intro und Übergänge (auch bei wenigen Bildern pro Sekunde),
  // gedeckelte Zeit für Bewegungen in den Szenen
  const real = Math.min(0.25, (now - last) / 1000);
  const dt = Math.min(0.05, real);
  last = now;
  state.time += dt;
  stepPyro(real);
  hud.tickFacts(real);
  quality.tick(real, cap ? 1 / cap : 1 / 60);
  settings.frame(real);
  const Q = eff(), gk = settings.S.grain ? settings.S.fx : 0;
  if (stats) {
    stats.n++; stats.sum += real;
    if (stats.sum >= 2) { console.log(`fps ${(stats.n / stats.sum).toFixed(1)} · ${(1000 * stats.sum / stats.n).toFixed(1)} ms · Qualität ${Q.name}`); stats.n = 0; stats.sum = 0; }
  }
  const { w, h } = viewSize();
  const lv = state.active;
  if (state.tr) stepTransition(real);
  else stepTour(real);
  // Linse: während der Fahrt weg, nach der Ankunft zieht die Schärfe weich nach (Fokus-Zug)
  const post = state.post, on = state.tr ? 0 : 1;
  const rate = on ? real / LENS.fadeIn : real / LENS.fadeOut;
  post.dof = clampf(post.dof + (on ? rate : -rate), 0, 1);
  post.bloom = clampf(post.bloom + (on ? rate : -rate), 0, 1);
  const u = comp.uniforms;
  let src = null;
  if (state.tr) {
    const tr = state.tr;
    render(tr.outer, dt, true);
    render(tr.inner, dt, true);
    u.tOuter.value = tr.outer.rt.texture;
    u.tInner.value = tr.inner.rt.texture;
    u.dOuter.value = tr.outer.rt.depthTexture;
    u.dInner.value = tr.inner.rt.depthTexture;
    u.uToneOuter.value = tr.outer.tone;
    u.uToneInner.value = tr.inner.tone;
    u.uGrainOuter.value = tr.outer.grain * gk;
    u.uGrainInner.value = tr.inner.grain * gk;
    lensUniform(u.uCamOuter.value, tr.outer, tr.focusOuter, post.dof * Q.dof);
    lensUniform(u.uCamInner.value, tr.inner, tr.focusInner, 0);
    u.uBloom.value = (tr.outer.bloom ?? 0.2) * smootherstep(post.bloom) * Q.bloom;
    src = tr.outer;
  } else if (lv) {
    if (state.intro) {
      stepIntro(lv, real);
    } else {
      cineUndo(lv);
      if (state.dolly) {
        // Abstand logarithmisch nachführen, Blickrichtung bleibt
        const t = state.controls.target;
        const dir = lv.camera.position.clone().sub(t);
        const d = dir.length();
        const next = Math.exp(Math.log(d) + (Math.log(state.dolly.to) - Math.log(d)) * Math.min(1, real * 7));
        lv.camera.position.copy(t).addScaledVector(dir.divideScalar(d), next);
        if (Math.abs(Math.log(next / state.dolly.to)) < 0.003) state.dolly = null;
      }
      if (state.focus) {
        const f = state.focus;
        f.t = Math.min(1, f.t + real / 1.6);
        const k = smootherstep(f.t);
        state.controls.target.lerpVectors(f.fromT, f.toT, k);
        lv.camera.position.lerpVectors(f.fromP, f.toP, k);
        if (f.t >= 1) state.focus = null;
      }
      state.controls.update(dt);
      lv.camera.updateMatrixWorld();
      cineApply(lv, real);
    }
    render(lv, dt, false);
    u.tOuter.value = lv.rt.texture;
    u.dOuter.value = lv.rt.depthTexture;
    u.uToneOuter.value = lv.tone;
    u.uGrainOuter.value = lv.grain * gk;
    const focusTarget = state.intro ? state.intro.target : state.controls.target;
    const dist = lv.camera.position.distanceTo(focusTarget);
    lensUniform(u.uCamOuter.value, lv, dist, smootherstep(post.dof) * Q.dof);
    u.uBloom.value = (lv.bloom ?? 0.2) * smootherstep(post.bloom) * Q.bloom;
    src = lv;
    hud.updateScale(hfwOf(lv, dist), w, lv);
    hud.updateMarkers(lv.camera, w, h);
  }
  // Bloom-Vorstufe aus der führenden Ebene (bei 0 übersprungen)
  if (src && u.uBloom.value > 0.0005) {
    bright.uniforms.tSrc.value = src.rt.texture;
    bright.uniforms.uTexel.value.set(1 / src.rt.width, 1 / src.rt.height);
    renderer.setRenderTarget(bloomRT);
    renderer.render(brightScene, compCam);
    u.tBloom.value = bloomRT.texture;
  }
  u.uFade.value = Math.min(1, u.uFade.value + real / 1.4);
  u.uTime.value = state.time;
  // Lupe der Info-Karte vor dem Hauptbild (das übermalt die benutzte Ecke); nicht im Übergang und im Auftakt
  const L = lv && !state.tr && !state.intro ? hud.lens() : null;
  if (L) renderLoupe(lv, L, real);
  renderer.setRenderTarget(null);
  renderer.render(compScene, compCam);
}

async function start() {
  resize();
  const m = /ebene=(\d)/.exec(location.hash);
  const first = m ? Math.min(LOADERS.length - 1, Math.max(0, +m[1] - 1)) : 0;
  const T = parseFloat(params.get('T'));   // ?T=abc oder leer → Standard behalten
  if (Number.isFinite(T)) state.temp = state.pyro.shown = Math.min(800, Math.max(T_ROOM, T));
  const lv = await getLevel(first);
  activate(lv);
  if (first === 0 && !still && settings.S.intro && freeze === null) {
    // Auftakt: ≈ 110° um das Stück, von schräg oben und 2,6-fachem Abstand; jede Eingabe beendet ihn
    const target = lv.home.target.clone();
    const to = new THREE.Spherical().setFromVector3(lv.home.pos.clone().sub(target));
    const from = new THREE.Spherical(to.radius * 2.6, Math.max(0.3, to.phi - 0.6), to.theta - 1.9);
    state.controls.enabled = false;
    state.intro = { t: 0, dur: 9.0, target, from, to };
    stepIntro(lv, 0);
  }
  document.body.classList.add('is-ready');
  if (params.has('play')) setTimeout(togglePlay, 600);
  requestAnimationFrame(frame);
  if (freeze !== null) diveHotspot();
}

start().catch((err) => {
  console.error(err);
  document.body.classList.add('has-error');
});
