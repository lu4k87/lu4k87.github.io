// Auftakt beim Aufruf der Seite (User 27.10.2026; Vorbild: Intro-Video „Big Bang Explosion“ bis 0:17, Kamera und Effekte
// darüber hinaus): aus dem Schwarz ein winziger blauer Lichtpunkt, der langsam wächst – waagerechter Lichtstreif wie durch
// eine anamorphe Linse, Strahlenkranz, Staub tritt ins Licht. Kurz vor dem Knall zieht sich alles zusammen, dann zerreißt
// es: Druckwelle, der Raum dehnt sich (Teilchen fliegen mit Bewegungsunschärfe an der Kamera vorbei), die Kamera wird ins
// Licht gezogen, alles wird weiß. Im heißen Plasma kühlt die Glut nach Planck-Farbe (blauweiß → weiß → orange), das
// Muster tritt hervor, das Plasma wird durchsichtig (≈ 380.000 Jahre) und zeigt genau die Kugel der Hintergrundstrahlung
// von Station 10 (gleiches Muster aus glsl.js CMB, dieselben Uniforms der Schale) – von dort zieht sich die Kamera im
// Bogen aus der Kugel zurück in die Heimpose der Station, die Galaxien blenden ein.
// Der Lichtpunkt vor dem Knall ist Darstellung: Es gab kein „Außen“, von dem aus man hätte zusehen können.
// Gastgeber (main.js, Vorschau): advance(dt) → apply(station) → Szene mit `view === 'own' ? camera : station.camera` ins
// eigene Ziel rendern, ab mix > 0 die Station dazu (post.js Überblendung); look = Belichtung + Grading des Films.

import * as THREE from 'three';
import { NOISE, CMB } from './glsl.js';
import { LOOK } from './post.js';

// Stellschrauben (Vorschau-Regler). Zeiten in Filmsekunden: build = Aufbau bis zum Knall, plasma = Abkühlen bis klar,
// crane = Rückzug in die Heimpose; arc/rise = Bogen und Kranhöhe am Anfang des Rückzugs (°), end* = Endpose relativ zur
// Heimpose (Abstand ×, Drehung °); Look-Werte wirken als Faktor und laufen bis zum Ende auf den Look der Station zu.
export const TUNE = {
  tempo: 1, build: 14.6, plasma: 6.5, crane: 9,
  core: 1, streak: 1, streakLen: 1, rays: 1, rayLen: 1, hue: 204, sat: 0.8,
  dust: 1, burst: 1, blur: 1, bokeh: 1, shock: 0, shake: 1,
  push: 1, drift: 1, arc: 28, rise: 12, endDist: 1, endAz: 0, endEl: 0,
  exposure: 1, bloom: 1, grain: 1, ca: 1, vig: 1, bars: 1,
};
const FLASH = 1.4, HOLD = 0.45, FADE = 1.0;   // Knall → weiß, weiß halten, Überblendung in die Station (s)
export const marks = (k) => {
  const bang = k.build, white = bang + FLASH, cool = white + HOLD, clear = cool + k.plasma;
  return { bang, white, cool, clear, end: clear + k.crane };
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (e) => 1 - Math.pow(1 - e, 3) * (1 + 3 * e);   // aus dem Stand, langes Ausrollen (wie der Auftakt in main.js)
const DEG = Math.PI / 180;

const BG_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }';
const BG_FRAG = /* glsl */ `
${NOISE}
${CMB}
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uCamPos, uO;
uniform vec2 uC;
uniform float uAspect, uTime;
uniform float uCore, uSize, uHalo, uSpread, uGlow, uStreak, uStreakW, uStreakL, uRays, uRayL, uRayRot, uShock, uShockR, uFlash;
uniform vec3 uTint, uDeep;
uniform float uPlasma, uTemp, uBright, uContrast, uFog, uDetail, uFalse, uExpand, uR;
uniform vec3 uCut, uDip;
uniform float uCutCos, uDipOn;
varying vec2 vUv;

// Glut des Plasmas nach Temperatur (Planck-Farbe, für glühendes Gas etwas satter): blauweiß → weiß → gold → orange
vec3 ember(float T) {
  float t = clamp(log(T / 3000.0) / log(40000.0 / 3000.0), 0.0, 1.0);
  vec3 c0 = vec3(1.0, 0.5, 0.18), c1 = vec3(1.0, 0.76, 0.45), c2 = vec3(1.0, 0.95, 0.88), c3 = vec3(0.72, 0.84, 1.0);
  if (t < 0.15) return mix(c0, c1, t / 0.15);
  if (t < 0.4) return mix(c1, c2, (t - 0.15) / 0.25);
  return mix(c2, c3, (t - 0.4) / 0.6);
}
vec3 rayDir() { vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); v /= v.w; return normalize((uCamWorld * vec4(v.xyz, 0.0)).xyz); }

// Strahlenkranz: n Fächer um den Kern, je Fach ein dünner Strahl mit eigener Länge, Stärke, Lage und Funkeln
float rays(float phi, float r, float n, float rot, float seed, float L) {
  float a = (phi + rot) / 6.2831853 * n, id = floor(a), f = fract(a) - 0.5;
  float h1 = hash12(vec2(id, seed)), h2 = hash12(vec2(id, seed + 7.1)), h3 = hash12(vec2(id, seed + 3.3));
  // Abstand zur Strahlmitte in Bildhöhen: Strahlen bleiben dünne Linien statt sich zum Kegel zu weiten
  float off = (h3 - 0.5) * 0.5, perp = abs(f - off) * 6.2831853 / n * r, wl = mix(0.0012, 0.0035, h2) * (1.0 + r * 1.5);
  float prof = exp(-pow(perp / wl, 2.0)) + 0.14 * exp(-pow(perp / (wl * 5.0), 2.0));
  prof *= smoothstep(0.5, 0.32, abs(f));
  float tw = 0.82 + 0.18 * sin(uTime * (1.3 + 2.1 * h2) + h1 * 40.0);
  return pow(h1, 3.0) * tw * prof * exp(-r / (L * mix(0.15, 1.0, h1 * h1)));
}

void main() {
  vec3 col = vec3(0.0);
  if (uPlasma < 0.5) {
    vec2 p = (vUv - uC) * vec2(uAspect, 1.0);
    float r = length(p), phi = atan(p.y, p.x), q = r / uSize;
    // Kern, Lichthof der Linse (in Kerngrößen), blauer Schleier über dem ganzen Bild
    col += mix(vec3(1.0), uTint, 0.15) * uCore * exp(-q * q);
    float rh = r / uSpread;
    col += mix(vec3(1.0), uTint, 0.8) * uHalo * (0.6 * exp(-rh / 0.012) + 0.3 * exp(-rh / 0.05) + 0.1 * exp(-rh / 0.15));
    col += uDeep * uGlow * (exp(-r / 0.35) + 0.4 * exp(-r / 1.2));
    // Lichtstreif (anamorph): heller Faden, weicher Schleier darum, leicht faserig
    if (uStreak > 0.0) {
      float w = uStreakW, ay = abs(p.y), ax = abs(p.x);
      float wisp = 0.8 + 0.2 * gnoise(vec3(p.x * 6.0, p.y * 30.0, uTime * 0.25));
      float line = exp(-ay * ay / (w * w)) * (1.3 * exp(-ax / (uStreakL * 0.06)) + 0.55 * exp(-ax / (uStreakL * 0.4)) + 0.22 * exp(-ax / (uStreakL * 1.6)));
      float haze = exp(-ay * ay / (36.0 * w * w)) * (exp(-ax / (uStreakL * 0.2)) + 0.3 * exp(-ax / uStreakL));
      col += uStreak * (mix(vec3(1.0), uTint, 0.6) * line + uDeep * haze * 0.6) * wisp;
    }
    if (uRays > 0.0) {
      float k = rays(phi, r, 36.0, uRayRot, 1.0, uRayL) + 0.7 * rays(phi, r, 72.0, -0.6 * uRayRot, 5.0, uRayL * 0.55)
              + 0.35 * rays(phi, r, 11.0, 0.35 * uRayRot, 9.0, uRayL * 1.8);
      col += mix(vec3(1.0), uTint, 0.75) * uRays * k * smoothstep(uSize * 0.6, uSize * 3.0 + 0.003, r);
    }
    // Druckwelle: heller Ring mit leichtem Farbsaum, dahinter Licht
    if (uShock > 0.0) {
      float th = 0.006 + 0.03 * uShockR;
      vec3 ring = vec3(exp(-pow((r - uShockR * 1.012) / th, 2.0)), exp(-pow((r - uShockR) / th, 2.0)), exp(-pow((r - uShockR * 0.988) / th, 2.0)));
      col += (mix(vec3(1.0), uTint, 0.5) * ring + uTint * 0.06 * smoothstep(uShockR, 0.0, r)) * uShock;
    }
    col += mix(vec3(0.95, 0.97, 1.0), uTint * 1.3, smoothstep(0.35, 0.95, r)) * uFlash * 9.0;   // Weiß, zu den Ecken blau
  } else {
    // im Plasma: Strahl trifft von innen die Kugel der letzten Streuung um O (= Mitte der Station 10)
    vec3 rd = rayDir(), oc = uCamPos - uO;
    float b = dot(oc, rd), h = b * b - dot(oc, oc) + uR * uR;
    vec3 d = normalize(oc + rd * (-b + sqrt(max(h, 0.0))));
    float x = cmbValue(d, uDetail, uDipOn, uDip);
    // Glut nach Planck-Farbe, heiße Flecken heller (stark übertrieben, echt ≈ 1/100.000); Wogen, solange es trüb ist
    float wave = fbm(rd * 1.6 / uExpand + vec3(0.0, 0.0, uTime * 0.04), 4);
    vec3 glow = ember(uTemp * (1.0 + 0.12 * x * uContrast)) * uBright * (1.0 + 0.35 * x * uContrast) * (1.0 + 0.4 * uFog * wave);
    glow = max(vec3(0.0), mix(vec3(dot(glow, vec3(0.2126, 0.7152, 0.0722))), glow, 1.3));   // Glut satt statt bräunlich
    // dieselbe Schale wie in Station 10 (Innenseite 0,4, Rand am Fenster, im Fenster nichts)
    float c = dot(d, uCut);
    vec3 shell = c > uCutCos ? vec3(0.0) : cmbColor(x) * 0.4 * (0.5 + 0.5 * (1.0 - smoothstep(uCutCos - 0.04, uCutCos, c))) * 0.9;
    // Wechsel in die Falschfarbe der Station 10: weich von der Bildmitte nach außen
    float rs = length((vUv - 0.5) * vec2(uAspect, 1.0));
    col = mix(glow, shell, smoothstep(0.0, 1.0, uFalse * 1.3 - rs * 0.3));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// Staub und Teilchen: je Teilchen ein Viereck entlang seiner Bildbahn (Bewegungsunschärfe aus zwei Lagen im Abstand der
// Belichtungszeit), Größe nach Tiefe plus Unschärfekreis (Bokeh: außerhalb der Schärfe große, schwache Scheiben)
const DUST_VERT = /* glsl */ `
uniform float uT, uBang, uShut, uPx, uAspect, uH, uFocus, uCoc, uVis, uLight, uHot, uGain, uSwirl, uIn, uA, uTau, uV;
uniform vec3 uTintA, uTintB;
attribute vec3 aP;
attribute vec4 aD;   // Größe, Auftauchen, Helligkeit, Farbe
varying vec3 vU, vCol;
varying float vSize, vBokeh;
// Maßstab des Raums: vor dem Knall zieht er sich zusammen, danach dehnt er sich aus – erst schlagartig, dann stetig
float scaleAt(float t) {
  float s = t - uBang;
  if (s < 0.0) { float k = smoothstep(uBang - 1.3, uBang, t); return 1.0 - uIn * k * k; }
  return 1.0 - uIn + uA * (1.0 - exp(-s / uTau)) + uV * s;
}
vec3 posAt(float t) {
  float r = length(aP), a = uSwirl * t / (0.6 + r), c = cos(a), s = sin(a);   // innen schneller: nichts steht still
  return vec3(c * aP.x - s * aP.z, aP.y, s * aP.x + c * aP.z) * scaleAt(t);
}
void main() {
  vU = vec3(0.0); vCol = vec3(0.0); vSize = 1.0; vBokeh = 0.0;
  float on = smoothstep(aD.y, aD.y + 0.08, uVis);
  vec4 w1 = modelMatrix * vec4(posAt(uT), 1.0), w0 = modelMatrix * vec4(posAt(uT - uShut), 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * w1, c0 = projectionMatrix * viewMatrix * w0;
  if (on <= 0.0 || c1.w < 0.08) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (c0.w < 0.08) c0 = c1;
  vec2 k = vec2(uAspect, 1.0) * 0.5 * uH;
  vec2 P1 = c1.xy / c1.w * k, P0 = c0.xy / c0.w * k, V = P1 - P0;
  float depth = c1.w, len = min(length(V), 0.6 * uH);
  float size = clamp(aD.x * uPx / depth, 0.7, 5.0) + min(uCoc * abs(depth - uFocus) / depth, 24.0);
  vec2 dir = length(V) > 0.01 ? normalize(V) : vec2(1.0, 0.0), nrm = vec2(-dir.y, dir.x);
  P0 = P1 - dir * len;
  vec2 P = mix(P0, P1, position.x * 0.5 + 0.5) + dir * position.x * size + nrm * position.y * size;
  gl_Position = vec4(P / k, 0.0, 1.0);
  vU = vec3(position.x * (0.5 * len + size), position.y * size, 0.5 * len);
  vSize = size;
  vBokeh = smoothstep(2.5, 9.0, size);
  // vom Kern beleuchtet (nah hell), nach dem Knall selbst heiß; Energie auf Fläche und Spur verteilt
  float d = length(w1.xyz - modelMatrix[3].xyz);
  float e = (uLight / (1.0 + d * d * 0.08) + uHot * (0.6 + 0.4 * aD.z)) * aD.z * on;
  vec3 col = mix(uTintA, uTintB, aD.w);
  col = mix(col, vec3(1.0), clamp(uHot * 0.02 + step(0.86, aD.w) * 0.5, 0.0, 0.7));
  vCol = col * e * uGain / (size * size * 3.14159 * mix(0.35, 1.0, vBokeh) + 2.0 * size * len);
}`;
const DUST_FRAG = /* glsl */ `
varying vec3 vU, vCol;
varying float vSize, vBokeh;
void main() {
  float r = length(vec2(max(abs(vU.x) - vU.z, 0.0), vU.y)) / vSize;
  if (r >= 1.0) discard;
  float disk = smoothstep(1.0, 0.8, r) * (0.7 + 0.3 * r * r);   // Bokeh-Scheibe mit hellerem Rand wie bei echten Linsen
  gl_FragColor = vec4(vCol * mix(exp(-r * r * 5.0), disk, vBokeh), 1.0);
}`;

function createDust(n, rand) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const P = new Float32Array(n * 3), D = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    // dicht um den Punkt, dünn bis um die Kamera herum; Richtung gleichverteilt
    const r = rand() < 0.15 ? 0.3 + 2 * rand() : 1.5 + 13 * Math.pow(rand(), 1.2), z = 2 * rand() - 1, a = 2 * Math.PI * rand(), q = Math.sqrt(1 - z * z);
    P.set([r * q * Math.cos(a), r * z, r * q * Math.sin(a)], i * 3);
    D.set([0.004 + 0.012 * rand() ** 2, rand(), Math.exp((rand() - 0.7) * 2.4), rand()], i * 4);
  }
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(P, 3));
  g.setAttribute('aD', new THREE.InstancedBufferAttribute(D, 4));
  g.instanceCount = n;
  return g;
}

// ctx: { detail }, station: { home, shell: { radius, uniforms } } von Station 10 (levels/cmb.js), endLook = deren Look
export function createOpener(ctx, station, tune = { ...TUNE }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 4000);
  const O = station.home.target.clone();
  const axis = station.home.pos.clone().sub(O).normalize();
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(axis, up).normalize();
  const homeDist = station.home.pos.distanceTo(O);
  const film = { t: 0, playing: false };
  let k = { ...tune }, M = marks(k);

  const su = station.shell.uniforms;
  const bgU = {
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uO: { value: O },
    uC: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1 }, uTime: { value: 0 },
    uCore: { value: 0 }, uSize: { value: 0.001 }, uHalo: { value: 0 }, uSpread: { value: 1 }, uGlow: { value: 0 }, uStreak: { value: 0 }, uStreakW: { value: 0.002 }, uStreakL: { value: 0.1 },
    uRays: { value: 0 }, uRayL: { value: 0.1 }, uRayRot: { value: 0 }, uShock: { value: 0 }, uShockR: { value: 0 }, uFlash: { value: 0 },
    uTint: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() },
    uPlasma: { value: 0 }, uTemp: { value: 40000 }, uBright: { value: 1 }, uContrast: { value: 0 }, uFog: { value: 1 }, uDetail: { value: 0 },
    uFalse: { value: 0 }, uExpand: { value: 1 }, uR: { value: station.shell.radius },
    uCut: su.uCut, uCutCos: su.uCutCos, uDip: su.uDip, uDipOn: su.uDipOn,
  };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: bgU, depthTest: false, depthWrite: false }));
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  bg.onBeforeRender = (r, s, cam) => {
    bgU.uInvProj.value.copy(cam.projectionMatrixInverse);
    bgU.uCamWorld.value.copy(cam.matrixWorld);
    bgU.uCamPos.value.copy(cam.position);
  };
  scene.add(bg);

  let seed = 20261027;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dU = {
    uT: { value: 0 }, uBang: { value: M.bang }, uShut: { value: 0.02 }, uPx: { value: 600 }, uAspect: { value: 1 }, uH: { value: 900 },
    uFocus: { value: 10 }, uCoc: { value: 20 }, uVis: { value: 0 }, uLight: { value: 0 }, uHot: { value: 0 }, uGain: { value: 1 },
    uSwirl: { value: 0.05 }, uIn: { value: 0.16 }, uA: { value: 1.2 }, uTau: { value: 0.6 }, uV: { value: 0.6 },
    uTintA: { value: new THREE.Color() }, uTintB: { value: new THREE.Color() },
  };
  const dust = new THREE.Mesh(createDust(Math.round(10000 * Math.max(0.5, ctx.detail)), rand), new THREE.ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: dU, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
  }));
  dust.frustumCulled = false;
  dust.position.copy(O);
  scene.add(dust);

  // Lage um O: Richtung der Heimpose um el gehoben und um az um die Hochachse gedreht, Abstand dist
  const _v = new THREE.Vector3(), _t = new THREE.Vector3();
  const orbit = (cam, dist, az, el) => {
    _v.copy(axis).applyAxisAngle(side, el).applyAxisAngle(up, az);
    cam.position.copy(O).addScaledVector(_v, dist);
  };
  // Handkamera: langsames Schweben (Summe unharmonischer Sinus), nach dem Knall Wackeln, das schnell abklingt
  const wob = (t, a, b, c) => Math.sin(t * a) * 0.5 + Math.sin(t * b + 1.7) * 0.3 + Math.sin(t * c + 4.1) * 0.2;

  const look = { ...LOOK, sh: [...LOOK.sh], hi: [...LOOK.hi] };
  const END = station.look || {};
  const endLook = Object.fromEntries(Object.keys(LOOK).map((key) => [key, END[key] ?? LOOK[key]]));
  const FILM = { exposure: 1, bloom: 0.13, sat: 1.12, con: 0.14, sh: [0.9, 0.97, 1.12], hi: [1.0, 1.0, 1.02], vig: 0.5, ca: 0.011, grain: 0.022 };

  function setTune(t) {
    k = { ...TUNE, ...t };
    M = marks(k);
    const a = new THREE.Color().setHSL(k.hue / 360, k.sat, 0.55), b = new THREE.Color().setHSL((k.hue + 14) / 360, Math.min(1, k.sat + 0.1), 0.42);
    bgU.uTint.value.copy(a);
    bgU.uDeep.value.copy(b);
    dU.uTintA.value.setHSL((k.hue - 8) / 360, k.sat * 0.9, 0.6);
    dU.uTintB.value.setHSL((k.hue + 10) / 360, k.sat, 0.5);
    dU.uBang.value = M.bang;
    dU.uA.value = 1.2 * k.burst;
    dU.uV.value = 0.6 * k.burst;
  }
  setTune(tune);

  // Stand zur Filmzeit t: Uniforms, eigene Kamera (bis weiß) bzw. Kamera der Station (danach), Überblendung, Look
  const out = { view: 'own', mix: 0, rise: 0 };
  function apply(lv) {
    const t = film.t, u = clamp01(t / M.bang), s = t - M.bang, f = sstep(M.bang, M.white, t);
    bgU.uTime.value = t;
    dU.uT.value = t;
    dU.uShut.value = k.blur * k.tempo / 96;   // 180°-Verschluss bei 48 Bildern/s
    out.view = t < M.white ? 'own' : 'level';
    bgU.uPlasma.value = out.view === 'own' ? 0 : 1;
    dust.visible = out.view === 'own';

    // Licht vor dem Knall: erst sichtbar, dann langsam, am Ende schneller wachsend; kurz davor holt es Luft (dunkler)
    const grow = (Math.exp(4.2 * u) - 1) / (Math.exp(4.2) - 1);
    const breathe = 1 - 0.35 * sstep(M.bang - 0.95, M.bang - 0.15, t) * (1 - sstep(M.bang - 0.1, M.bang + 0.02, t));
    const I = (0.22 * sstep(0, 0.22, u) + 0.78 * grow) * sstep(0.004, 0.08, u) * breathe;
    const boom = s > 0 ? Math.exp(Math.min(s, FLASH) * 2.4) : 1;
    const fov = lerp(32, 28, ease(u)) + 24 * Math.pow(f, 1.3);

    // eigene Kamera: Anfahrt (push), Bogen (drift), vor dem Knall leicht zurück, danach ins Licht gezogen
    let D = 12 * (1 - 0.3 * k.push * sstep(0, 1, u));
    D += 0.3 * k.push * sstep(M.bang - 1.1, M.bang - 0.15, t) * (1 - f);
    D *= Math.exp(-3.0 * Math.pow(sstep(0.35, 1, f), 1.5));
    camera.fov = fov;
    camera.updateProjectionMatrix();
    orbit(camera, D, k.drift * lerp(0.12, 0.03, ease(u)), k.drift * lerp(0.05, 0.015, u));
    const shake = s > 0 ? k.shake * 0.022 * Math.exp(-s / 0.4) * sstep(0, 0.04, s) : 0;
    const hand = 0.006 * k.drift;
    _t.copy(O)
      .addScaledVector(side, D * (hand * wob(t, 0.31, 0.53, 0.89) + shake * wob(s, 61, 97, 139)))
      .addScaledVector(up, D * (hand * wob(t + 7, 0.27, 0.47, 0.83) + shake * wob(s + 3, 71, 113, 151)));
    camera.up.set(0, 1, 0).applyAxisAngle(_v.copy(axis), k.drift * 0.01 * wob(t, 0.13, 0.21, 0.37) + shake * 0.6 * wob(s + 9, 53, 89, 127));
    camera.lookAt(_t);
    camera.updateMatrixWorld();

    // Lichtpunkt: Bildort, Kern als Anteil der Bildhöhe (wächst mit dem Licht, nach dem Knall schlagartig), Linse
    const p = _t.copy(O).project(camera);
    bgU.uC.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
    const pinch = 1 - 0.3 * sstep(M.bang - 0.8, M.bang, t) * (1 - f);
    bgU.uSize.value = (0.0025 + 0.009 * I) * pinch * boom;
    bgU.uCore.value = k.core * (20 + 50 * I) * (1 + 3 * f) * sstep(0.004, 0.06, u);
    bgU.uHalo.value = k.core * (0.35 + 3.6 * I) * (1 + 0.6 * f) * sstep(0.004, 0.06, u);
    bgU.uSpread.value = 1 + (boom - 1) * 0.15;
    bgU.uGlow.value = k.core * (0.01 + 0.22 * I * I) * (1 + 0.8 * f);
    bgU.uStreak.value = k.streak * (0.3 + 2.2 * I) * sstep(0.02, 0.12, u) * (1 + 3 * f);
    bgU.uStreakL.value = k.streakLen * (0.15 + 0.85 * sstep(0.03, 0.7, u)) * (1 + 2 * f);
    bgU.uStreakW.value = (0.0013 + 0.0025 * I) * (1 + 10 * f * f);
    bgU.uRays.value = k.rays * sstep(0.18, 0.5, u) * (0.15 + 2.2 * Math.pow(I, 1.6)) * (1 + 0.8 * f);
    bgU.uRayL.value = k.rayLen * (0.03 + 0.17 * Math.pow(I, 1.5)) * (1 + 2.5 * f);
    bgU.uRayRot.value = 0.018 * t;
    bgU.uShock.value = s > 0 ? k.shock * 0.25 * Math.exp(-s / 0.4) * sstep(0, 0.05, s) : 0;
    bgU.uShockR.value = s > 0 ? 0.02 + 1.2 * (1 - Math.exp(-s / 0.45)) : 0;
    bgU.uFlash.value = Math.pow(sstep(0.86, 1, f), 2);

    // Staub: tritt ab ≈ 60 % des Aufbaus ins Licht, nach dem Knall alles; Schärfe auf dem Punkt
    dU.uVis.value = (s > 0 ? 0.35 + 0.75 * sstep(0, 0.9, s) : 0.35 * Math.pow(sstep(0.78, 1.0, u), 1.2)) * Math.min(1, k.dust);
    dU.uLight.value = (0.1 + 2.2 * I) * (1 + 4 * f);
    dU.uHot.value = s > 0 ? 22 * sstep(0, 0.35, s) * Math.exp(-s / 1.2) : 0;
    dU.uGain.value = Math.max(1, k.dust);
    dU.uFocus.value = D;
    dU.uCoc.value = 9 * k.bokeh;
    dU.uPx.value = dU.uH.value / (2 * Math.tan(fov * DEG / 2));

    // Plasma: kühlt nach Planck (40.000 K → 3.000 K), Muster wird deutlich, Nebel klart auf, dann Falschfarbe
    const c = clamp01((t - M.cool) / k.plasma);
    const T = Math.exp(lerp(Math.log(40000), Math.log(3000), sstep(0, 0.62, c)));
    bgU.uTemp.value = T;
    bgU.uBright.value = lerp(3, 1.15, sstep(0, 0.35, c));
    bgU.uContrast.value = lerp(0.15, 1, sstep(0.05, 0.55, c));
    bgU.uFog.value = 1 - sstep(0.4, 0.82, c);
    bgU.uDetail.value = sstep(0.25, 0.9, c);
    bgU.uFalse.value = sstep(0.6, 1.0, c);
    bgU.uExpand.value = 1 + 2.5 * sstep(M.white, M.clear, t);

    // Kamera der Station ab weiß: im Plasma fast in der Mitte, dann Rückzug im Bogen in die Heimpose
    if (lv && out.view === 'level') {
      const e = clamp01((t - M.clear) / k.crane), ea = sstep(0, 1, e), d0 = 1.2;
      const dist = t < M.clear ? lerp(0.55, d0, sstep(M.white, M.clear, t)) : Math.exp(lerp(Math.log(d0), Math.log(homeDist * k.endDist), ease(e)));
      const az = lerp(k.arc, k.endAz, ea) * DEG + (t < M.clear ? 0.1 * (1 - sstep(M.white, M.clear, t)) : 0);
      orbit(lv.camera, dist, az, lerp(-k.rise, k.endEl, ea) * DEG);
      lv.camera.up.set(0, 1, 0);
      lv.camera.lookAt(O);
      lv.camera.updateMatrixWorld();
      if (lv.target) lv.target.copy(O);
    }
    out.mix = sstep(M.clear, M.clear + FADE, t);
    out.rise = sstep(M.clear + 0.15 * k.crane, M.clear + 0.75 * k.crane, t);
    if (lv && lv.opening) lv.opening(out.view === 'level' ? out.rise : 1);

    // Look: Film-Look, beim Knall heller und mehr Glühen, im Plasma Anpassung des Auges bis zum Look der Station
    const a = sstep(M.cool, M.clear, t), tl = 1 - sstep(M.cool, M.clear + FADE, t);
    for (const key of Object.keys(LOOK)) {
      const x = FILM[key], y = endLook[key];
      look[key] = Array.isArray(x) ? x.map((v, i) => lerp(v, y[i], a)) : lerp(x, y, a);
    }
    const flare = 1 + 2 * sstep(0.75, 1, f);
    look.exposure = (out.view === 'own' ? FILM.exposure * flare : Math.exp(lerp(Math.log(3), Math.log(endLook.exposure), sstep(0, 0.3, c)))) * lerp(1, k.exposure, tl);
    look.bloom = (out.view === 'own' ? FILM.bloom + 0.08 * f : lerp(0.3, endLook.bloom, a)) * lerp(1, k.bloom, tl);
    look.grain *= lerp(1, k.grain, tl);
    look.ca *= lerp(1, k.ca, tl);
    look.vig *= lerp(1, k.vig, tl) * (out.view === 'own' ? 1 - 0.7 * f : lerp(0.3, 1, a));   // im Weiß keine grauen Ecken
    return out;
  }

  return {
    scene, camera, film, look, out, apply, setTune, get marks() { return M; }, get tune() { return k; },
    get done() { return film.t >= M.end; },
    advance(dt) { if (film.playing) film.t = Math.min(M.end, film.t + dt * k.tempo); },
    // Größe des Bilds (Pixel des Ziels) und Seitenverhältnis des Fensters; eigene Kamera mittig im Fenster
    setSize(w, h) {
      camera.aspect = w / h;
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
      bgU.uAspect.value = w / h;
      dU.uAspect.value = w / h;
      dU.uH.value = h;
    },
    dispose() { bg.geometry.dispose(); bg.material.dispose(); dust.geometry.dispose(); dust.material.dispose(); },
  };
}
