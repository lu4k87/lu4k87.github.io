// Nebel der Milchstraße (Station 3): Gas und Staub der Scheibe in 3D, ergänzt die Punktwolke aus buildGalaxy
// (Vorschau 28.10.2026 Nebel:A; Wolken und Schichten als Ideen in der Schatzkammer). Staub, HII-Gas, diffuses Gas und
// Sternlicht per Strahlverfolgung durch eine flache Platte: grobe Felder einmal gebacken, feine Oktaven live, eigene
// Auflösung, neu nur bei Änderung. Dreht im Zeitraffer differentiell mit wie die Sterne (Ω(R) wie levels/galaxy.js) und glimmt langsam.
// fine (Milchstraße, User 08.11.2026 „detaillierter, realistischer“): Arme, Staubbahnen und Höhe rechnet der Strahl live
// statt aus dem Feld (Zellen 0,22 kpc ≥ Breite einer Staubbahn), dazu Staubfasern entlang der Arme, Staubfedern
// zwischen den Armen, Staubbahnen am Balken, Rötung durch Staub (blau wird stärker geschluckt), diffuses Sternlicht der
// Scheibe auch zwischen den Armen, Sternwolken junger Sterne und kompakte HII-Gebiete.

import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { bakeField, offscreen } from './vol.js';
import { armConsts } from './galaxyfx.js';

const RAD = Math.PI / 180;
const EXT = 17.5, H = 1.2;   // Platte: Radius und halbe Dicke [kpc] (Verwerfung außen bis ≈ 0,35 kpc)
const BAR_ANG = 29 * RAD;

// Ω(R) [rad/Mio. J.] wie levels/galaxy.js; unspin dreht einen Ort auf seine Lage zur Zeit 0 zurück
const SPIN_GLSL = /* glsl */ `
float omR(float R) { return 230.0 * (1.0 - exp(-R / 1.2)) / max(R, 0.05) * 1.0227e-3; }
vec3 unspin(vec3 p, float T) {
  float a = omR(length(p.xz)) * T, c = cos(a), s = sin(a);
  return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
}`;

// Farben: Hα-Gebiete rosa-rot (Hα + etwas Hβ), diffuses ionisiertes Gas blasser, Sternlicht warm, junge Sterne bläulich
const C_HII = [1.0, 0.24, 0.34], C_WIM = [0.85, 0.42, 0.5], C_OLD = [1.0, 0.78, 0.56], C_BLUE = [0.5, 0.66, 1.0];
// fine: Licht der Arme (Sterne aller Alter, weißer als die alte Scheibe); Rötung = optische Tiefe je Farbkanal relativ
// zu Grün (Extinktionskurve grob: A_B/A_V ≈ 1,3, A_R/A_V ≈ 0,8); Steigung der Fasern (≈ Mittel der Arme) und der Federn
const C_ARM = [0.86, 0.86, 0.95], EXT_RGB = [0.8, 1.0, 1.3], PITCH_FIB = 12, PITCH_SPUR = 50;
// Verwerfung: außen biegt sich die Scheibe auf der einen Seite nach oben, gegenüber nach unten
const WARP = '0.32 * sin(phi + 0.6) * smoothstep(9.0, 16.0, R)';
// Qualität (ctx.detail 0,55 / 0,8 / 1): niedrig gröber statt ohne Nebel – Feld, Schritte, Auflösung des Zwischenbilds
const TIER = [{ size: 96, steps: 64, scale: 0.4 }, { size: 128, steps: 96, scale: 0.5 }, { size: 160, steps: 128, scale: 0.6 }];
const v3 = (c) => `vec3(${c.map((x) => x.toFixed(3)).join(', ')})`;

// r Staub, g HII-Knoten, b diffuses Gas (Platte gestreckt: y im Feld = y · EXT / H)
const fieldBody = (arms, rings) => /* glsl */ `
${armConsts(arms, rings)}
vec4 field(vec3 p) {
  vec3 q = vec3(p.x, p.y * ${(H / EXT).toFixed(5)}, p.z);
  float R = length(q.xz), phi = atan(-q.z, -q.x);
  float young, arm, lane;
  armField(R, phi, young, arm, lane);
  float y = q.y - ${WARP};
  float edge = smoothstep(17.0, 12.5, R);
  float n1 = fbm(vec3(q.x, y * 4.0, q.z) * 0.55 + vec3(3.1, 0.0, 7.4), 4);
  float n2 = fbm(vec3(q.x, y * 3.0, q.z) * 1.6 + vec3(9.0, 2.0, 1.0), 3);
  float clump = clamp(0.45 + 1.5 * n1 + 0.7 * n2, 0.0, 2.2);
  float hz = 0.11 + 0.01 * R;
  float dust = (lane * 1.25 + arm * 0.3 + 0.16 * exp(-R / 5.0) * smoothstep(1.2, 3.0, R)) * clump * exp(-y * y / (hz * hz)) * edge;
  float knots = smoothstep(0.1, 0.5, n2 + 0.6 * n1);
  float hii = young * knots * exp(-y * y / 0.005) * smoothstep(2.6, 3.6, R) * edge;
  float wim = arm * (0.5 + 0.8 * max(n1 + 0.3, 0.0)) * exp(-abs(y) / 0.4) * edge;
  return vec4(dust, hii, wim, 0.0);
}`;

// fine: r Klumpen des Staubs, g Knoten (Häufung der HII-Gebiete), b diffuses Gas, a Sternwolken (Arme und Höhe live)
const fieldFine = (arms, rings) => /* glsl */ `
${armConsts(arms, rings)}
vec4 field(vec3 p) {
  vec3 q = vec3(p.x, p.y * ${(H / EXT).toFixed(5)}, p.z);
  float R = length(q.xz), phi = atan(-q.z, -q.x);
  float young, arm, lane;
  armField(R, phi, young, arm, lane);
  float y = q.y - ${WARP};
  float n1 = fbm(vec3(q.x, y * 4.0, q.z) * 0.55 + vec3(3.1, 0.0, 7.4), 4);
  float n2 = fbm(vec3(q.x, y * 3.0, q.z) * 1.6 + vec3(9.0, 2.0, 1.0), 3);
  float n3 = fbm(vec3(q.x, y * 2.0, q.z) * 3.1 + vec3(1.7, 5.0, 3.3), 3);
  float wim = arm * (0.5 + 0.8 * max(n1 + 0.3, 0.0)) * exp(-abs(y) / 0.4) * smoothstep(17.0, 12.5, R);
  return vec4(clamp(0.5 + 1.4 * n1 + 0.6 * n2, 0.05, 2.2), smoothstep(0.1, 0.5, n2 + 0.6 * n1), wim, n2 + 0.7 * n3);
}`;

// Strahl im fine-Modus: Sternlicht (alt, Arme, junge Sternwolken), Gas und Staub mit optischer Tiefe je Farbkanal
const sampleFine = ({ bar = 1, bulge = 1, barAng = BAR_ANG, arms, rings }) => /* glsl */ `
${armConsts(arms, rings)}
const float TF = ${(1 / Math.tan(PITCH_FIB * RAD)).toFixed(5)}, TS = ${(1 / Math.tan(PITCH_SPUR * RAD)).toFixed(5)};
void sampleGal(vec3 p, out vec3 e, out vec3 s) {
  vec3 q = unspin(p, uT);
  vec4 f = texture(uField, vec3(q.x, q.y * ${(EXT / H).toFixed(4)}, q.z) / ${(2 * EXT).toFixed(1)} + 0.5);
  float R = length(q.xz), phi = atan(-q.z, -q.x);
  float y = q.y - ${WARP}, ay = abs(y);
  float edge = smoothstep(17.0, 12.0, R);
  // alte Scheibe (auch zwischen den Armen), Balken flach entlang der langen Achse mit Erdnuss-Form, Bulge
  float disk = exp(-R / 2.6) * exp(-ay / 0.3) * edge;
  vec2 bu = vec2(-cos(${barAng.toFixed(5)}), -sin(${barAng.toFixed(5)})), bv = vec2(sin(${barAng.toFixed(5)}), -cos(${barAng.toFixed(5)}));
  float u = dot(q.xz, bu) / 2.1, v = dot(q.xz, bv) / 0.55;
  float w = q.y / (0.3 * (1.0 + 0.6 * exp(-pow((abs(u) - 0.7) / 0.35, 2.0))));
  float bar = exp(-0.5 * (pow(abs(u), 2.6) + v * v + w * w));
  float bulge = exp(-length(q * vec3(1.0, 1.45, 1.0)) / 0.42);
  e = ${v3(C_OLD)} * (disk * 0.7 + bar * ${(0.42 * bar).toFixed(3)} + bulge * ${(0.8 * bulge).toFixed(3)}) * uLight;
  s = vec3(0.0);
  if (ay < 0.65 && R < 17.0) {
    float young, arm, lane, spur;
    armField(R, phi, young, arm, lane, spur);
    float lr = log(max(R, 0.4));
    // Licht der Arme: Sterne aller Alter verdichtet (weißlich), junge Sternwolken bläulich und fleckig
    // (Sternentstehung fällt nach außen flacher ab als die alte Scheibe)
    float sheet = exp(-R / 4.2) * edge;
    e += ${v3(C_ARM)} * sheet * min(arm, 1.4) * exp(-ay / 0.18) * 0.5 * uLight;
    float ob = min(young, 1.4) * sheet * smoothstep(-0.2, 0.6, f.a) * exp(-ay / 0.09) * smoothstep(2.4, 3.6, R);
    e += ${v3(C_BLUE)} * ob * uYoung;
    // Staub: Bahn an der Innenkante in Fasern entlang der Spirale, Hülle der Arme, dünne Schicht der Scheibe
    float x1 = phi + lr * TF;
    float fib = gnoise(vec3(cos(x1) * 15.0, sin(x1) * 15.0 + y * 7.0, lr * 26.0));
    float dust = lane * (0.3 + 1.4 * smoothstep(-0.35, 0.45, fib)) * 3.0 + arm * 0.3 + 0.2 * exp(-R / 5.0) * smoothstep(1.0, 2.6, R);
    // Federn: dünne Staubfäden, die steil aus der Außenseite der Arme in den Raum dazwischen laufen
    if (spur > 0.02) {
      float xs = phi + lr * TS;
      float sn = 1.0 - abs(gnoise(vec3(cos(xs) * 7.5, sin(xs) * 7.5 + y * 4.0, lr * 6.0 + 3.0)));
      dust += spur * pow(sn, 6.0) * 2.4;
    }
    // Staubbahnen am Balken: an der vorauslaufenden Kante, punktsymmetrisch, gehen außen in die Bahnen der Arme über
    float bl = (v + sign(u) * 0.95) / 0.33;
    dust += 1.1 * exp(-bl * bl) * smoothstep(0.15, 0.45, abs(u)) * smoothstep(1.95, 1.3, abs(u));
    // zentrale Molekülzone (≈ 200 pc)
    dust += 1.6 * exp(-pow((R - 0.2) / 0.08, 2.0));
    float hz = 0.085 + 0.008 * R;
    dust *= f.r * exp(-y * y / (hz * hz)) * edge;
    if (dust > 0.02) dust *= 0.5 + 0.95 * smoothstep(-0.3, 0.4, gnoise(q * vec3(6.0, 16.0, 6.0) + 4.0));
    // HII: kompakte Gebiete an den Knoten, stromab der Staubbahn
    float hii = young * f.g * exp(-y * y / 0.004) * smoothstep(2.6, 3.6, R) * edge;
    if (hii > 0.01) {
      float g = gnoise(q * 9.0 + vec3(0.0, uTime * 0.05, 0.0));
      hii *= 9.0 * pow(smoothstep(0.0, 0.38, g), 2.0);
      hii *= 1.0 + uGlim * 0.45 * gnoise(q * 2.2 + vec3(uTime * 0.09, 0.0, 0.0));
    }
    e += (${v3(C_HII)} + ${v3(C_BLUE)} * 0.12) * hii * uHii;
    s = dust * uDust * 2.2 * ${v3(EXT_RGB)};
  }
  float fade = smoothstep(${H.toFixed(2)}, ${(0.45 * H).toFixed(2)}, abs(q.y)) * smoothstep(${EXT.toFixed(1)}, ${(EXT - 3).toFixed(1)}, R);
  e = fade * (e + ${v3(C_WIM)} * f.b * uWim) * uGain;
  s *= fade;
}`;

// bar/bulge = Anteil von Balken und Bulge am Sternlicht (1 = Milchstraße), barAng = Lage des Balkens
const sampleCoarse = ({ bar = 1, bulge = 1, barAng = BAR_ANG } = {}) => /* glsl */ `
void sampleGal(vec3 p, out vec3 e, out vec3 s) {
  vec3 q = unspin(p, uT);
  vec4 f = texture(uField, vec3(q.x, q.y * ${(EXT / H).toFixed(4)}, q.z) / ${(2 * EXT).toFixed(1)} + 0.5);
  float R = length(q.xz);
  // Sternlicht: exponentielle Scheibe, Balken, Bulge (die Punkte liefern die Sterne, hier nur das unaufgelöste Licht)
  float disk = exp(-R / 2.6) * exp(-abs(q.y) / 0.3) * smoothstep(17.0, 12.0, R);
  vec2 bu = vec2(-cos(${barAng.toFixed(5)}), -sin(${barAng.toFixed(5)})), bv = vec2(sin(${barAng.toFixed(5)}), -cos(${barAng.toFixed(5)}));
  float u = dot(q.xz, bu) / 2.1, v = dot(q.xz, bv) / 0.55, w = q.y / 0.32;
  float bar = exp(-0.5 * (u * u + v * v + w * w));
  float bulge = exp(-length(q * vec3(1.0, 1.45, 1.0)) / 0.42);
  float hii = f.g, dust = f.r;
  // feine Oktave live: Knoten zerfallen in einzelne Gebiete, Staub in Fasern
  if (hii > 0.01) {
    float g = gnoise(q * 7.0 + vec3(0.0, uTime * 0.05, 0.0));
    hii *= 0.35 + 1.3 * smoothstep(-0.25, 0.45, g);
    hii *= 1.0 + uGlim * 0.45 * gnoise(q * 2.2 + vec3(uTime * 0.09, 0.0, 0.0));
  }
  if (dust > 0.02) dust *= 0.55 + 0.9 * smoothstep(-0.3, 0.4, gnoise(q * vec3(5.0, 14.0, 5.0) + 4.0));
  // vor dem Rand der Platte auf null: sonst zeichnet der Strahl die Kanten des Kastens (Blick von der Seite)
  float fade = smoothstep(${H.toFixed(2)}, ${(0.45 * H).toFixed(2)}, abs(q.y)) * smoothstep(${EXT.toFixed(1)}, ${(EXT - 3).toFixed(1)}, R);
  hii *= fade; dust *= fade;
  e = fade * (${v3(C_OLD)} * (disk * 0.55 + bar * ${(0.6 * bar).toFixed(3)} + bulge * ${(1.4 * bulge).toFixed(3)}) * uLight
     + ${v3(C_HII)} * hii * uHii + ${v3(C_BLUE)} * hii * uHii * 0.12 + ${v3(C_WIM)} * f.b * uWim) * uGain;
  s = vec3(dust * uDust * 2.2);
}`;

const volFrag = ({ fine, arms, rings, look }) => /* glsl */ `
uniform vec3 uCam;
uniform float uSteps, uTime, uT, uGain, uDust, uHii, uWim, uLight, uGlim, uYoung;
uniform highp sampler3D uField;
varying vec3 vP;
${NOISE}
${SPIN_GLSL}
${fine ? sampleFine({ ...look, arms, rings }) : sampleCoarse(look)}
void main() {
  // im Achsenkreuz der Platte (Mesh gedreht/skaliert: andere Galaxien, levels/andromeda.js); uCam = Kamera dort
  vec3 ro = uCam, rd = normalize(vP - uCam);
  float b = dot(ro, rd), c = dot(ro, ro) - ${(EXT * EXT).toFixed(2)}, h = b * b - c;
  if (h <= 0.0) discard;
  h = sqrt(h);
  float t0 = max(-b - h, 0.0), t1 = -b + h;
  // nur die Platte |y| < H durchlaufen: alle Schritte dort, wo Gas ist
  if (abs(rd.y) > 1e-5) {
    float ta = (-${H.toFixed(2)} - ro.y) / rd.y, tb = (${H.toFixed(2)} - ro.y) / rd.y;
    t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb));
  } else if (abs(ro.y) > ${H.toFixed(2)}) discard;
  if (t1 <= t0) discard;
  float dt = (t1 - t0) / uSteps;
  float t = t0 + dt * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  // Durchlässigkeit je Farbkanal (Rötung); der Hintergrund (Sternpunkte) wird mit Grün gedämpft
  vec3 L = vec3(0.0), T = vec3(1.0);
  for (int i = 0; i < 224; i++) {
    if (float(i) >= uSteps || t > t1) break;
    vec3 e, s;
    sampleGal(ro + rd * t, e, s);
    vec3 a = exp(-s * dt);
    L += T * e * mix(vec3(dt), (1.0 - a) / max(s, vec3(1e-4)), step(vec3(1e-4), s));
    T *= a;
    if (T.g < 0.004) break;
    t += dt;
  }
  gl_FragColor = vec4(L, 1.0 - T.g);
}`;

// Andere Galaxien (Station Andromeda): rings wie buildGalaxy, look = { bar, bulge, barAng } für das Sternlicht,
// quat/scale legen die Platte ins Achsenkreuz der Station (Modelleinheiten × scale = kpc wie buildGalaxy)
// fine = Milchstraße im Detail (Kopf der Datei); steps = Schritte des Strahls (fine: mehr, die Staubschicht ist dünn)
export function nebulaVolume(renderer, { arms, rings = [], detail = 1, look = {}, quat = null, scale = 1, fine = false }) {
  const q = TIER[detail > 0.9 ? 2 : detail > 0.7 ? 1 : 0];
  const field = bakeField(renderer, { size: q.size, extent: EXT, body: (fine ? fieldFine : fieldBody)(arms, rings) });
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: volFrag({ fine, arms, rings, look }),
    uniforms: {
      uCam: { value: new THREE.Vector3() }, uField: { value: field.texture }, uSteps: { value: Math.round(q.steps * (fine ? 1.4 : 1)) }, uTime: { value: 0 }, uT: { value: 0 },
      uGain: { value: 1 }, uDust: { value: 3.0 }, uHii: { value: 3.0 }, uWim: { value: 0.05 }, uLight: { value: fine ? 1.1 : 0.1 }, uGlim: { value: 1 }, uYoung: { value: 3.2 },
    },
    side: THREE.BackSide, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(EXT, 48, 24), mat);
  mesh.frustumCulled = false;
  if (quat) mesh.quaternion.copy(quat);
  mesh.scale.setScalar(scale);
  mesh.updateMatrixWorld(true);
  const vol = offscreen(renderer, mesh);
  vol.setScale(q.scale);
  vol.quad.renderOrder = 3;   // nach Sternen und Punkt-Staub: dämpft das Licht dahinter
  const u = mat.uniforms;
  const base = { uHii: u.uHii.value, uWim: u.uWim.value, uDust: u.uDust.value };
  let step = -1;
  return {
    object: vol.quad, uniforms: u, ready: field.ready.then(() => renderer.compileAsync(vol.scene, new THREE.PerspectiveCamera())),
    // Glimmen ist langsam: 12 neue Bilder je Sekunde reichen, dazwischen nur bei Kamerabewegung
    update(t, T, cam) {
      if (!vol.quad.visible) return;
      u.uCam.value.copy(cam.position);
      mesh.worldToLocal(u.uCam.value);
      const k = u.uGlim.value > 0 ? Math.floor(t * 12) : 0;
      if (k !== step || u.uT.value !== T) { step = k; u.uTime.value = k / 12; u.uT.value = T; vol.invalidate(); }
      vol.render(cam);
    },
    // Zahnrad: an/aus, Leuchten des Gases und Staub als Faktor auf die Grundwerte, Glimmen an/aus
    setOn(v) { vol.quad.visible = v; vol.invalidate(); },
    setGas(k) { u.uHii.value = base.uHii * k; u.uWim.value = base.uWim * k; vol.invalidate(); },
    setDust(k) { u.uDust.value = base.uDust * k; vol.invalidate(); },
    setGlim(v) { u.uGlim.value = v ? 1 : 0; vol.invalidate(); },
    setSize: (w, h) => vol.setSize(w, h),
    dispose() { vol.dispose(); field.dispose(); },
  };
}
