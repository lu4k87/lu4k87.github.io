// Station 02C2: Europa aus der Nähe (Einheit 1.000 km), Abstecher von Jupiter & Monde. Europafest wie moon.js: Europa ruht,
// Jupiter, Sonne, die anderen Galileischen Monde und die Sterne ziehen über ihren Himmel. Lage zum Datum aus jovian.js
// (JPL-Mittelwerte): gebundene Rotation, Länge 0° zeigt zu Jupiter, Pol = Bahnnormale; die Drehung ist gleichförmig, die Bahn
// leicht exzentrisch (e = 0,009) → Jupiter pendelt am Himmel um ±1° (optische Libration 2e, eigene Rechnung).
// Oberfläche: USGS-Mosaik Voyager/Galileo (grau, Ostlänge = 360·u, an Pwyll und Conamara Chaos geprüft) mit Farbe aus der
// Helligkeit (Modell), Lommel-Seeliger und Jupiterschein nach Jupiters Phase (planetfx.js uMoon), Jupiterschatten aus der
// Scheibenüberdeckung (Finsternis bei jedem Umlauf). Jupiter am Himmel maßstäblich (12,2°), abgeplattet, mit Bändern,
// Hülle und den Schatten der Monde. Ozean-Schnitt: Keil im Norden der Jupiter abgewandten Seite, Schichten schematisch
// (maßstäblich oder überhöht). Wasserdampf-Fahne (umstritten; Ort, Höhe und Tempo schematisch), Europa Clipper auf einem
// schematischen Vorbeiflug (stark vergrößert).

import * as THREE from 'three';
import { julianDate, eclDir, equToScene, laplaceLongitude, DAY } from '../astro.js';
import { createStarfield } from '../stars.js';
import { createCatalogSky } from '../catalog.js';
import { createFlare } from '../flare.js';
import { settings } from '../settings.js';
import { SKY_VERTEX, NOISE } from '../glsl.js';
import { BODY_VERT, SHELL_VERT, PLANET_FRAG, ATMO_FRAG, ATMOS } from '../planetfx.js';
import { registerLayers, refreshLayers } from '../layers.js';
import { STATIONS } from '../content.js';
import { JUPITER, GALILEAN, jovianState, moonScene, lineOfSun } from '../jovian.js';
import { spinAxis } from '../axes.js';

const EL = GALILEAN.europa;
const R = EL.r / 1000, RJ = JUPITER.r / 1000;   // Europa 1.560,8 km, Jupiter 71.492 km (Szene: 1.000 km)
const FLAT = JUPITER.rp / JUPITER.r;
const RAD = Math.PI / 180, TAU = Math.PI * 2, Y = new THREE.Vector3(0, 1, 0);
// Zeitraffer [Tage je Sekunde]; Stufe 0 = Echtzeit. Ein Umlauf (3,55 Tage) dauert bei 1 h/s rund 85 s.
const SPEEDS = [[0, 'Echtzeit'], [1 / 144, '10 min/s'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s']];
// Schichten im Schnitt [Anteil des Radius]: Unterkante Eis, Unterkante Ozean, Kern. Maßstäblich mit den Mittelwerten der
// NASA-Schätzung (Eis 15–25 → 20 km, Ozean 60–150 → 100 km); Kern und Mantelgrenze schematisch; überhöht für die Lesbarkeit.
const LAYERS = { true: [1 - 20 / 1560.8, 1 - 120 / 1560.8, 0.4], exag: [0.93, 0.72, 0.4] };
// Großer Roter Fleck in jupiter.jpg (Solar System Scope): u = 0,367 (aus der Karte bestimmt, wie jupiter.js)
const GRS_U = 0.367;
const OTHERS = { io: { u0: 0.5 }, ganymede: { u0: 0 }, callisto: { u0: 0 } };   // Länge 0° in der Karte (u)
const PLUME = [-70, 180];        // Fahne: Breite, Ostlänge – schematisch im Südpolgebiet (Roth et al. 2014)
const PLUME_H = 0.2;             // Höhe ≈ 200 km, schematisch
const CLIPPER_X = 4000;          // Europa Clipper vergrößert (Spannweite 30,5 m → ≈ 120 km)
// Breite/Ostlänge [°] → Europasystem (Länge 0 auf +x zu Jupiter, Norden +y, Osten −z wie die Karte)
const sel = (lat, lon, r = R) => new THREE.Vector3(Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.sin(lat * RAD), -Math.cos(lat * RAD) * Math.sin(lon * RAD)).multiplyScalar(r);
const ease = (t) => t * t * (3 - 2 * t);
const prec = (p) => (p ? 360 / (p * 365.25) : 0);
// Mittlere Anomalie [rad] aus mittlerer Länge minus Perizentrumslänge (astro.js laplaceLongitude, Apsiden-/Knotendrehung)
const meanAnomaly = (jd) => (laplaceLongitude(EL, jd) - EL.node - EL.w - (prec(EL.Pn) + prec(EL.Pw)) * (jd - 2451545.0)) * RAD;
const bodyU = (map, o) => ({
  tMap: { value: map }, tNight: { value: null }, tClouds: { value: null }, tSpec: { value: null }, tRing: { value: null },
  uHasEarth: { value: 0 }, uCloudU: { value: 0 }, uGain: { value: o.gain ?? 1 }, uRing: { value: 0 }, uRingIn: { value: 0 }, uRingOut: { value: 0 },
  uInv: { value: new THREE.Matrix4() }, uWrap: { value: o.wrap ?? 0.02 }, uAmb: { value: o.amb ?? 0.006 }, uBand: { value: o.band ?? 0 }, uTime: { value: 0 },
  uMoon: { value: o.moon ? 1 : 0 }, uEarthPos: { value: o.shinePos ?? new THREE.Vector3() }, uEarthshine: { value: o.shine ?? 0 },
  uTerm: { value: new THREE.Vector3(...(o.term ?? [1, 0.85, 0.7])) }, uSunDir: { value: o.sun }, uSunAng: { value: 0 },
  uOcc: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) }, uOccN: { value: 0 },
});
const inject = (src, a, b) => {
  if (!src.includes(a)) throw new Error(`[kosmos] europa: Shader-Stelle fehlt: ${a.slice(0, 48)}`);
  return src.replace(a, b);
};

// Europa: PLANET_FRAG mit Farbe aus der Graukarte (natürlich: cremeweiß mit braunen Rissen; verstärkt: blauweißes Eis,
// rotbraune Lineae wie in den Falschfarben-Mosaiken – beides Modell) und dem Keil für den Ozean-Schnitt (Norden, Länge 135–225°)
const EUROPA_FRAG = inject(inject(PLANET_FRAG,
  'void main() {',
  `uniform float uCut, uTint;
vec3 europaColor(vec2 uv) {
  // Graukarte linear: Median ≈ 0,31 (5 %: 0,16, 95 %: 0,46); d = örtlich dunkler als die Umgebung (Risse, Chaos)
  float g = texture2D(tMap, uv).r, gb = texture2D(tMap, uv, 4.0).r;
  float gN = smoothstep(0.12, 0.5, g), d = clamp((gb - g) * 4.0, 0.0, 1.0);
  vec3 nat = mix(vec3(0.55, 0.46, 0.37), vec3(0.97, 0.95, 0.91), gN) * (1.0 - 0.25 * d);
  vec3 ice = mix(vec3(0.5, 0.58, 0.7), vec3(0.86, 0.93, 1.0), gN);
  vec3 enh = mix(ice, vec3(0.6, 0.29, 0.15), clamp(d * 2.0 + (1.0 - gN) * 0.6 - 0.2, 0.0, 1.0));
  return mix(nat, enh, uTint);
}
void main() {
  if (uCut > 0.5 && vO.y > 0.0 && vO.x < 0.0 && abs(vO.z) < -vO.x) discard;`),
  'vec3 alb = texture2D(tMap, uv).rgb * (1.0 + 0.25 * det);',
  'vec3 alb = europaColor(uv) * (1.0 + 0.25 * det);');

// Schnittflächen: Schichten nach dem Abstand zur Mitte (schematisch, weich beleuchtet, damit sie auch nachts lesbar bleiben)
const CUT_FRAG = /* glsl */ `
uniform vec3 uB, uSun;
uniform float uR, uTime;
varying vec3 vN, vP, vO;
varying vec2 vUv;
${NOISE}
void main() {
  float r = length(vO) / uR;
  vec3 q = vO / uR;
  vec3 col;
  if (r > uB.x) col = mix(vec3(0.62, 0.78, 0.92), vec3(0.93, 0.97, 1.0), smoothstep(uB.x, 1.0, r));
  else if (r > uB.y) col = vec3(0.04, 0.2, 0.46) * (0.85 + 0.3 * fbm(q * 9.0 + vec3(0.0, uTime * 0.02, 0.0), 3));
  else if (r > uB.z) col = vec3(0.34, 0.27, 0.22) * (0.8 + 0.4 * fbm(q * 14.0, 3));
  else col = mix(vec3(0.62, 0.42, 0.26), vec3(0.92, 0.6, 0.3), 1.0 - smoothstep(0.0, uB.z, r));
  float w = fwidth(r) * 1.5;
  float edge = max(max(1.0 - smoothstep(0.0, w, abs(r - uB.x)), 1.0 - smoothstep(0.0, w, abs(r - uB.y))), 1.0 - smoothstep(0.0, w, abs(r - uB.z)));
  col = mix(col, vec3(0.95), edge * 0.6);
  float lit = 0.72 + 0.28 * abs(dot(normalize(vN), uSun));
  gl_FragColor = vec4(col * lit, 1.0);
}
`;
// Sonne am Himmel: Scheibe mit Winkelradius uAng (bei Jupiter 0,05°, für die Darstellung mindestens 0,07°) und Lichthof
const SUN_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uAng;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float a = dot(d, uSun) > 0.0 ? asin(min(length(cross(d, uSun)), 1.0)) : 3.14159;
  float ang = max(uAng, 0.0012);
  float disk = smoothstep(ang * 1.2, ang * 0.8, a);
  float glow = exp(-a / 0.006) * 4.0 + exp(-a / 0.06) * 0.12;
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * (disk * 600.0 + glow), 1.0);
}
`;
const SUN_VERT = /* glsl */ `
${SKY_VERTEX}
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = skyPosition(vDir); }
`;
// Fahne: Teilchen auf Wurfbahnen (Fontäne), weich ein- und ausgeblendet, im Gegenlicht heller (Vorwärtsstreuung)
const PLUME_VERT = /* glsl */ `
uniform float uTime, uH, uPx;
uniform vec3 uVent, uN, uT, uB;
attribute vec3 aRnd;
varying float vA;
void main() {
  float t = fract(uTime / 11.0 + aRnd.x);
  vec3 p = uVent + uN * (4.0 * uH * (0.55 + 0.45 * fract(aRnd.x * 7.3)) * t * (1.0 - t)) + (uT * aRnd.y + uB * aRnd.z) * uH * 0.6 * t;
  vA = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.65, 1.0, t));
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uPx * projectionMatrix[1][1] * 0.012 / -mv.z, 1.0, 28.0);
  gl_Position = projectionMatrix * mv;
}
`;
const PLUME_FRAG = /* glsl */ `
uniform vec3 uSun, uN;
uniform float uOn, uFwd;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float s = exp(-dot(c, c) * 14.0);
  float lit = 0.25 + 0.75 * smoothstep(-0.25, 0.3, dot(uN, uSun));
  gl_FragColor = vec4(vec3(0.75, 0.88, 1.0) * s * vA * lit * (0.05 + 0.12 * uFwd) * uOn, 1.0);
}
`;

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 4000);
  const jd0 = julianDate(ctx.date);
  let jd = jd0, spdIdx = 2, rate = SPEEDS[spdIdx][0], st = jovianState(jd);

  // ---------- Lage: Europasystem (körperfest) ↔ Ekliptik-Szene ----------
  const sun = new THREE.Vector3(), jupPos = new THREE.Vector3(), jupDir = new THREE.Vector3();
  const pv = new THREE.Vector3(), vv = new THREE.Vector3(), P = new THREE.Vector3(), x0 = new THREE.Vector3(), z0 = new THREE.Vector3();
  const mB = new THREE.Matrix4(), qB = new THREE.Quaternion(), qInv = new THREE.Quaternion(), tmp = new THREE.Vector3();
  const poleJ = new THREE.Vector3(...equToScene(...JUPITER.pole)).normalize(), qPole = new THREE.Quaternion().setFromUnitVectors(Y, poleJ);
  const state = { dist: EL.a, lib: 0, jupLit: 0, eclipse: false };

  // ---------- Himmel: Katalog (Yale BSC) + Milchstraßenband; drehen mit der Lage Europas ----------
  const ngp = new THREE.Vector3(...eclDir(180.02, 29.81)), gc = new THREE.Vector3(...eclDir(266.84, -5.54));
  const sky = new THREE.Group();
  scene.add(sky);
  let catalog = null, pr = 1;
  const ready = createCatalogSky({ gain: 1.8, limit: 6.5 }).then((g) => { catalog = g; sky.add(g); g.userData.setPixelRatio(pr); })
    .catch((err) => {
      console.warn('[kosmos] Sternkatalog nicht geladen, statistischer Himmel:', err);
      catalog = createStarfield({ ngp, gc, gain: 0.8, seed: 17 });
      catalog.userData.setPixelRatio(pr);
      sky.add(catalog);
    });
  sky.add(createStarfield({ count: 1, ngp, gc, gain: 0, band: 1, glint: false, tex: ctx.tex }));
  const sunU = { uSun: { value: sun }, uAng: { value: st.sunAng } };
  const sunSky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG,
    uniforms: sunU, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }));
  sunSky.frustumCulled = false;
  sunSky.renderOrder = -9;
  scene.add(sunSky);
  const flare = createFlare({ strength: 0.7 });
  scene.add(flare);

  // ---------- Europa ----------
  const eu = bodyU(ctx.tex('europa.jpg'), { sun, moon: true, shinePos: jupPos, shine: 0.033 });
  eu.uCut = { value: 0 };
  eu.uTint = { value: 0 };
  eu.uOccN.value = 1;
  const europa = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 128).rotateY(Math.PI),   // Karte: Länge 0° bei u = 0 → +x
    new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: EUROPA_FRAG, uniforms: eu }));
  scene.add(europa);
  spinAxis(europa);

  // ---------- Ozean-Schnitt: zwei Viertelscheiben (Längen 135° und 225°) + Sektor in der Äquatorebene ----------
  const cutU = { uB: { value: new THREE.Vector3(...LAYERS.exag) }, uSun: { value: sun }, uR: { value: R }, uTime: { value: 0 } };
  const cutMat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: CUT_FRAG, uniforms: cutU, side: THREE.DoubleSide });
  const cut = new THREE.Group();
  for (const g of [new THREE.CircleGeometry(R, 96, 0, Math.PI / 2).rotateY(135 * RAD), new THREE.CircleGeometry(R, 96, 0, Math.PI / 2).rotateY(225 * RAD),
    new THREE.CircleGeometry(R, 96, 135 * RAD, Math.PI / 2).rotateX(-Math.PI / 2)]) cut.add(new THREE.Mesh(g, cutMat));
  cut.visible = false;
  scene.add(cut);
  let cutMode = 'off';
  const oceanPos = new THREE.Vector3();
  function setCut(m) {
    cutMode = m;
    const on = m !== 'off';
    eu.uCut.value = on ? 1 : 0;
    cut.visible = on;
    if (on) {
      const b = LAYERS[m];
      cutU.uB.value.set(...b);
      oceanPos.copy(sel(40, 135, R * (b[0] + b[1]) / 2));
      setView('cut');
    }
  }

  // ---------- Jupiter am Himmel (maßstäblich, abgeplattet, Bänder strömen, Hülle) ----------
  const A = ATMOS.jupiter;
  const jTilt = new THREE.Group();
  scene.add(jTilt);
  const jupU = bodyU(ctx.tex('jupiter.jpg'), { sun, wrap: A.wrap, term: A.term, band: 1, amb: 0.02 });
  jupU.uOccN.value = 4;
  const jup = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 96), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: jupU }));
  jup.scale.set(RJ, RJ * FLAT, RJ);
  jTilt.add(jup);
  spinAxis(jup);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(RJ * A.ra, 128, 64), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: ATMO_FRAG, uniforms: {
    uSun: { value: sun }, uCenter: { value: jupPos }, uBeta: { value: new THREE.Vector3(...A.beta) }, uMieCol: { value: new THREE.Vector3(...A.mieCol) },
    uRp: { value: RJ }, uRa: { value: RJ * A.ra }, uH: { value: A.h }, uGain: { value: A.gain }, uMie: { value: A.mie }, uAir: { value: 0 }, uAirH: { value: 0.2 } },
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  scene.add(shell);
  let spin0 = null;
  const az = (v) => Math.atan2(-v.z, v.x);

  // ---------- Io, Ganymed, Kallisto am Himmel (maßstäblich, gebunden rotierend) ----------
  const others = Object.keys(OTHERS).map((id) => {
    const u = bodyU(ctx.tex(`${id}.jpg`), { sun, moon: true, shinePos: jupPos, shine: 0.01 });
    u.uOccN.value = 1;
    const holder = new THREE.Group(), mesh = new THREE.Mesh(new THREE.SphereGeometry(GALILEAN[id].r / 1000, 64, 32),
      new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: u }));
    mesh.rotation.y = (0.5 - OTHERS[id].u0) * TAU;
    holder.add(mesh);
    spinAxis(mesh);
    scene.add(holder);
    return { id, u, holder, pos: holder.position };
  });
  const O = Object.fromEntries(others.map((x) => [x.id, x]));

  // ---------- Wasserdampf-Fahne (umstritten) ----------
  const NP = 1600, rnd = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) {
    const a = Math.random() * TAU, s = Math.pow(Math.random(), 1.6);
    rnd.set([Math.random(), Math.cos(a) * s, Math.sin(a) * s], i * 3);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  pg.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3));
  const ventN = sel(PLUME[0], PLUME[1], 1), ventT = new THREE.Vector3().crossVectors(ventN, Y).normalize(), ventB = new THREE.Vector3().crossVectors(ventN, ventT);
  const plumeU = { uTime: { value: 0 }, uH: { value: PLUME_H }, uPx: { value: 500 }, uVent: { value: ventN.clone().multiplyScalar(R) }, uN: { value: ventN },
    uT: { value: ventT }, uB: { value: ventB }, uSun: { value: sun }, uOn: { value: 1 }, uFwd: { value: 0 } };
  const plume = new THREE.Points(pg, new THREE.ShaderMaterial({ vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG, uniforms: plumeU,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  plume.frustumCulled = false;
  scene.add(plume);
  const plumePos = ventN.clone().multiplyScalar(R + PLUME_H * 0.8);

  // ---------- Europa Clipper (vereinfacht, stark vergrößert) auf einem schematischen Vorbeiflug ----------
  const clipper = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, metalness: 0.6, roughness: 0.45 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x1c2a4a, metalness: 0.3, roughness: 0.35, emissive: 0x050a18 });
  clipper.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 3), metal));
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(13, 0.08, 4), panel);
    w.position.x = s * 7.6;
    clipper.add(w);
  }
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.4, 0.5, 32), metal);
  dish.position.z = -1.8;
  dish.rotation.x = Math.PI / 2;
  clipper.add(dish);
  clipper.scale.setScalar((30.5 / 28.4) * CLIPPER_X * 1e-6);   // Modell 28,4 Einheiten breit → 30,5 m, vergrößert
  scene.add(clipper);
  const light = new THREE.DirectionalLight(0xffffff, 2.4);
  scene.add(light, new THREE.AmbientLight(0xffffff, 0.08));
  // Bahn: Gerade 100 km über 25° N, 200° O, schwach gekrümmt; ein Durchgang in 40 s (nicht im Zeitraffer)
  const cq = sel(25, 200, 1), ce = new THREE.Vector3().crossVectors(Y, cq).normalize();
  const clipAt = (s, out) => out.copy(cq).multiplyScalar(R + 0.1 + 0.9 * s * s).addScaledVector(ce, s * R * 3);
  const pathPts = [];
  for (let i = 0; i <= 120; i++) pathPts.push(clipAt(-1 + i / 60, new THREE.Vector3()));
  const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pathPts), new THREE.LineBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.22, depthWrite: false }));
  scene.add(path);
  let clipT = 0.35, showClipper = true;

  function place() {
    st = jovianState(jd);
    pv.set(...st.moons.europa);
    vv.set(...moonScene('europa', jd + 0.01)).sub(pv);
    P.crossVectors(pv, vv).normalize();                                   // Bahnnormale = Drehachse
    state.dist = pv.length();
    // Länge 0° zeigt in die mittlere Richtung zu Jupiter: wahre Richtung um −(ν − M) gedreht (Mittelpunktsgleichung)
    const M = meanAnomaly(jd), e = EL.e;
    state.lib = 2 * e * Math.sin(M) + 1.25 * e * e * Math.sin(2 * M);
    x0.copy(pv).multiplyScalar(-1).addScaledVector(P, pv.dot(P)).normalize().applyAxisAngle(P, -state.lib);
    z0.crossVectors(x0, P);
    mB.makeBasis(x0, P, z0);
    qB.setFromRotationMatrix(mB);
    qInv.copy(qB).invert();
    sun.set(...st.sun).applyQuaternion(qInv);
    jupPos.copy(pv).multiplyScalar(-1e-3).applyQuaternion(qInv);
    jupDir.copy(jupPos).normalize();
    sky.quaternion.copy(qInv);
    sunU.uAng.value = st.sunAng;
    // Jupiter: Pol aus α/δ, Drehung 9 h 55 min (inertial; vom gebundenen Europa aus wirkt sie langsamer)
    jTilt.position.copy(jupPos);
    jTilt.quaternion.copy(qInv).multiply(qPole);
    shell.position.copy(jupPos);
    if (spin0 === null) {   // Großer Roter Fleck zum Start zur Europa-Seite (seine echte Länge driftet)
      const want = tmp.copy(jupPos).multiplyScalar(-1).applyQuaternion(jTilt.quaternion.clone().invert());
      spin0 = az(want) - az(new THREE.Vector3(-Math.cos(TAU * GRS_U), 0, Math.sin(TAU * GRS_U)));
    }
    jup.rotation.y = (spin0 + ((jd - jd0) * 24 / JUPITER.rot) * TAU) % TAU;
    // Andere Monde relativ zu Europa, gebunden: Länge 0° zu Jupiter
    for (const o of others) {
      o.pos.set(...st.moons[o.id]).sub(pv).multiplyScalar(1e-3).applyQuaternion(qInv);
      const toJ = tmp.copy(jupPos).sub(o.pos);
      toJ.addScaledVector(Y, -toJ.dot(Y)).normalize();
      o.holder.quaternion.setFromRotationMatrix(mB.makeBasis(toJ, Y, new THREE.Vector3().crossVectors(toJ, Y)));
      o.u.uOcc.value[0].set(jupPos.x, jupPos.y, jupPos.z, RJ);
      o.u.uSunAng.value = st.sunAng;
    }
    // Schatten: Jupiter auf Europa; Europa, Io, Ganymed, Kallisto auf Jupiter
    eu.uOcc.value[0].set(jupPos.x, jupPos.y, jupPos.z, RJ);
    eu.uSunAng.value = jupU.uSunAng.value = st.sunAng;
    jupU.uOcc.value[0].set(0, 0, 0, R);
    others.forEach((o, i) => jupU.uOcc.value[i + 1].set(o.pos.x, o.pos.y, o.pos.z, GALILEAN[o.id].r / 1000));
    // Jupiterschein nach Jupiters Phase (von Europa aus beleuchteter Anteil)
    state.jupLit = (1 - jupDir.dot(sun)) / 2;
    eu.uEarthshine.value = shineK * state.jupLit;
    const l = lineOfSun(st, 'europa');
    state.eclipse = l.s < 0 && l.q < 1;
    light.position.copy(sun).multiplyScalar(10);
  }
  let shineK = 0.033;
  place();

  // ---------- Posen ----------
  // Seitenrichtung: Anteil der Sonne quer zur Jupiterrichtung (sonst die Bahnrichtung)
  const side = () => {
    const w = tmp.copy(sun).addScaledVector(jupDir, -sun.dot(jupDir));
    return w.lengthSq() > 0.0025 ? w.normalize().clone() : new THREE.Vector3(0, 0, 1);
  };
  // Europa: von der Jupiter abgewandten Seite; die Kamera rückt 10° nach oben (etwas nach links), damit Jupiter über
  // Europas Rand hervorschaut – links liegt die Stationsliste, rechts die Infotafel
  function homePose() {
    const f = jupDir.clone().addScaledVector(Y, -0.12).normalize();          // Blickrichtung von der Anti-Jupiter-Seite
    const right = new THREE.Vector3().crossVectors(f, Y).normalize(), up = new THREE.Vector3().crossVectors(right, f);
    const s = right.multiplyScalar(-0.35).addScaledVector(up, 0.94).normalize();
    const c = f.multiplyScalar(-Math.cos(10 * RAD)).addScaledVector(s, Math.sin(10 * RAD)).normalize();
    return { pos: c.multiplyScalar(R * 5.6), target: new THREE.Vector3(), up: Y };
  }
  const home = homePose();
  // Jupiter am Himmel: 12 km über einem Punkt 72° vom Jupiter-Fußpunkt (zur Sonne hin): Jupiter ≈ 18° hoch, die Kimm liegt
  // 7° unter der Waagerechten; Blick so gesenkt, dass Jupiter und ein Streifen Eis ins Bild passen
  function skyPose() {
    const k = jupDir.clone().multiplyScalar(Math.cos(72 * RAD)).addScaledVector(side(), Math.sin(72 * RAD)).normalize();
    const pos = k.clone().multiplyScalar(R + 0.012);
    const toJ = jupPos.clone().sub(pos).normalize(), el = Math.asin(THREE.MathUtils.clamp(toJ.dot(k), -1, 1));
    const h = toJ.clone().addScaledVector(k, -toJ.dot(k)).normalize(), a = el - 12 * RAD;
    const look = h.multiplyScalar(Math.cos(a)).addScaledVector(k, Math.sin(a));
    return { pos, target: pos.clone().addScaledVector(look, R * 3), up: k };
  }
  // Ozean-Schnitt: über dem Keil (Länge 180°, 28° N)
  const cutPose = () => ({ pos: sel(28, 180, R * 3.4), target: new THREE.Vector3(), up: Y });

  // Blick-Wechsel wie moon.js: Kamera gleitet hin und hält, bis der Besucher selbst dreht
  const view = { mode: null, t: 0, from: null };
  function setView(v) { view.mode = v === 'europa' ? 'home' : v; view.t = 0; view.from = null; }
  const releaseView = () => { view.mode = null; };
  const canvas = ctx.renderer.domElement;
  canvas.addEventListener('pointerdown', releaseView);
  canvas.addEventListener('wheel', releaseView, { passive: true });
  const goal = () => (view.mode === 'home' ? homePose() : view.mode === 'sky' ? skyPose() : cutPose());
  const qa = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3();
  function blendPos(out, a, b, k) {
    const ra = a.length(), rb = b.length();
    va.copy(a).normalize(); vb.copy(b).normalize();
    qa.setFromUnitVectors(va, vb);
    out.copy(va).applyQuaternion(new THREE.Quaternion().slerp(qa, k)).multiplyScalar(Math.exp(Math.log(ra) + (Math.log(rb) - Math.log(ra)) * k));
  }

  // ---------- Abzeichen ----------
  let group = 'geo', showJup = true, showMoons = true, plumeOn = true;
  const facing = (p, cam) => tmp.copy(cam.position).sub(p).normalize().dot(va.copy(p).normalize());
  // im offenen Ozean-Schnitt herausgeschnitten (Keil wie im Shader: Norden, Länge 135–225°)?
  const inCut = (p) => cutMode !== 'off' && p.y > 0 && p.x < 0 && Math.abs(p.z) < -p.x;
  const surf = (id, g, lat, lon, focus = 0.9) => {
    const pos = sel(lat, lon);
    return { id, kind: 'info', pos, focus: () => { releaseView(); return R * focus; }, visible: (cam) => group === g && !inCut(pos) && facing(pos, cam) > 0.06 };
  };
  // Strahl Kamera → p verdeckt von Europa (oder Jupiter)?
  const blocked = (cam, p, c, r) => {
    const d = vb.copy(p).sub(cam.position), L = d.length();
    d.divideScalar(L);
    const oc = tmp.copy(c).sub(cam.position), s = oc.dot(d);
    return s > 0 && s < L - r * 1.01 && oc.lengthSq() - s * s < r * r;
  };
  const ORIGIN = new THREE.Vector3();
  const sky1 = (p, cam) => !blocked(cam, p, ORIGIN, R);
  const hotspots = [
    { id: 'jupiter', kind: 'info', pos: jupPos, visible: (cam) => showJup && sky1(jupPos, cam) },
    ...others.map((o) => ({ id: o.id, kind: STATIONS[o.id] ? 'dive' : 'info', to: o.id, pos: o.pos,
      visible: (cam) => showMoons && sky1(o.pos, cam) && !blocked(cam, o.pos, jupPos, RJ) })),
    { id: 'ocean', kind: 'info', pos: oceanPos, focus: () => { releaseView(); return R * 1.2; }, visible: (cam) => cutMode !== 'off' && facing(oceanPos, cam) > -0.5 },
    { id: 'plume', kind: 'info', pos: plumePos, focus: () => { releaseView(); return R * 0.8; }, visible: (cam) => plumeOn && facing(plumePos, cam) > -0.1 },
    { id: 'clipper', kind: 'info', pos: clipper.position, focus: () => { releaseView(); return R * 0.5; }, visible: (cam) => showClipper && sky1(clipper.position, cam) },
    // Risse und Chaos-Gebiete (Mittelpunkte: USGS Gazetteer of Planetary Nomenclature, Ostlänge)
    surf('conamara', 'geo', 9.7, 87.3, 0.6),
    surf('thera', 'geo', -46.7, 178.8, 0.6),
    surf('agenor', 'geo', -43.8, 146.5, 1.0),
    surf('sidon', 'geo', -66.4, 176.6, 1.0),
    surf('minos', 'geo', 47.2, 164.8, 1.2),
    // Krater
    surf('pwyll', 'impact', -25.2, 88.6, 0.6),
    surf('tyre', 'impact', 33.6, 213.4, 0.6),
    surf('callanish', 'impact', -16.7, 25.5, 0.6),
    surf('manannan', 'impact', 3.1, 120.3, 0.5),
  ];

  // ---------- Schalter der Infotafel ----------
  // Nächster Eintritt in den Jupiterschatten (Schritt 10 min, höchstens 5 Tage voraus)
  function nextEclipse(from) {
    let was = state.eclipse;
    for (let t = from + 1 / 144; t < from + 5; t += 1 / 144) {
      const l = lineOfSun(jovianState(t), 'europa'), now = l.s < 0 && l.q < 1;
      if (now && !was) return t;
      was = now;
    }
    return null;
  }
  const controls = [
    { id: 'view', label: 'Blick', value: 'europa', options: [['europa', 'Europa'], ['sky', 'Jupiter am Himmel']], set: setView },
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: spdIdx, min: 0, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (v) => setSpeed(Math.round(v)), get: () => (rate ? spdIdx : 0) },
    { id: 'marks', label: 'Abzeichen', value: group, options: [['geo', 'Risse & Chaos'], ['impact', 'Krater']], set: (v) => { group = v; } },
    { id: 'cut', label: 'Ozean-Schnitt', value: 'off', options: [['off', 'Aus'], ['true', 'Maßstäblich'], ['exag', 'Überhöht']], set: setCut },
    { id: 'eclipse', type: 'action', label: 'Ereignis', button: 'Nächste Jupiterfinsternis', run: () => {
      const t = nextEclipse(jd);
      if (t === null) return;
      jd = t - 25 / 1440;
      setSpeed(1);
      setView('sky');
    } },
  ];
  function setSpeed(i) {
    if (i > 0) { spdIdx = i; rate = SPEEDS[i][0]; } else { rate = 0; jd = julianDate(new Date()); }
    refreshLayers();
  }

  // ---------- Ebenen (Zahnrad „Station · Europa“, Zeitleiste) ----------
  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
  registerLayers('europa', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', hint: 'Sonne, Jupiter und die anderen Monde ziehen über Europas Himmel; ein Umlauf dauert 3,55 Tage. Pause = Echtzeit.',
      value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, autoplay: true, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, playing) => { spdIdx = Math.max(1, Math.round(i)); rate = playing ? SPEEDS[spdIdx][0] : 0; if (!playing) jd = julianDate(new Date()); },
      get: () => ({ value: spdIdx, playing: rate !== 0 }), status: () => `${fmt.format(new Date((jd - 2440587.5) * 864e5))} UTC${rate ? '' : ' · Echtzeit'}` },
    { id: 'transit', type: 'action', label: 'Europas Schatten auf Jupiter', button: 'Vorspulen', sub: true, run: () => {
      for (let t = jd + 1 / 144; t < jd + 5; t += 1 / 144) {
        const l = lineOfSun(jovianState(t), 'europa');
        if (l.s > 0 && l.q < 0.9) { jd = t - 20 / 1440; setSpeed(1); setView('sky'); return; }
      }
    } },
    { id: 'tint', type: 'toggle', group: 'Oberfläche', label: 'Verstärkte Farben', value: false,
      hint: 'Wie die Falschfarben-Mosaiken der Sonde Galileo: Eis blauweiß, Risse und Chaos-Gebiete rotbraun (Salze, Schwefel). Beide Farbgebungen sind aus der grauen Karte abgeleitet (Modell).', set: (v) => { eu.uTint.value = v ? 1 : 0; } },
    { id: 'shine', type: 'range', group: 'Licht', label: 'Jupiterschein', value: 3, min: 0, max: 12, step: 0.5, unit: '×',
      hint: 'Licht von Jupiters Tagseite auf Europas Nachtseite. 1× = echt: bei voller Jupiterscheibe ≈ 0,6 % des Sonnenlichts (eigene Rechnung aus Albedo 0,538 und Abstand).', set: (v) => { shineK = 0.011 * v; } },
    { id: 'plume', type: 'toggle', group: 'Ozean', label: 'Wasserdampf-Fahne (umstritten)', value: true,
      hint: 'Hinweise aus Hubble-Aufnahmen, aber nicht sicher bestätigt. Ort, Höhe und Tempo schematisch, Teilchen verlangsamt.', set: (v) => { plumeOn = v; plume.visible = v; } },
    { id: 'jupiter', type: 'toggle', group: 'Himmel', label: 'Jupiter', value: true, set: (v) => { showJup = v; jTilt.visible = v; shell.visible = v; } },
    { id: 'moons', type: 'toggle', label: 'Io, Ganymed, Kallisto', value: true, set: (v) => { showMoons = v; others.forEach((o) => { o.holder.visible = v; }); } },
    { id: 'clipper', type: 'toggle', label: 'Europa Clipper (Vorbeiflug schematisch)', value: true, set: (v) => { showClipper = v; clipper.visible = v; path.visible = v; } },
  ]);

  const occluders = [{ center: ORIGIN, radius: R }, { center: jupPos, radius: RJ }];
  const sunFar = new THREE.Vector3(), cv = new THREE.Vector3();

  return {
    scene, camera, home, unit: 1e6, hotspots, controls, ready,
    orbit: { minDistance: 0.02, maxDistance: 60, cineSpeed: 0.5 },
    look: { exposure: 1.0, bloom: 0.06, sat: 1.04 },
    update(dt, t, cam, flying) {
      if (!flying) jd += rate ? dt * rate : dt / DAY;
      place();
      const tt = ctx.still ? 4 : t;
      jupU.uTime.value = tt;
      cutU.uTime.value = tt;
      plumeU.uTime.value = tt;
      plumeU.uFwd.value = Math.pow(Math.max(0, cv.copy(plumePos).sub(cam.position).normalize().dot(sun)), 4);
      plumeU.uPx.value = 500 * pr;
      // Clipper: ein Durchgang in 40 s, Flugrichtung = Bahntangente
      if (!ctx.still) clipT = (clipT + dt / 40) % 1;
      clipAt(clipT * 2 - 1, clipper.position);
      clipper.lookAt(clipAt(clipT * 2 - 1 + 0.01, cv));
      sunFar.copy(sun).multiplyScalar(3500);
      cam.updateMatrixWorld();
      flare.userData.update(sunFar, cam, occluders, settings.S.lens, dt);
    },
    orbitUpdate(c, dt) {
      const o = c.object;
      let free;
      if (view.mode) {
        if (!view.from) { view.from = { pos: o.position.clone(), target: c.target.clone(), up: o.up.clone() }; free = 'free'; }
        const gl = goal();
        view.t = Math.min(1, view.t + dt / (ctx.still ? 0.5 : 2.4));
        const k = ease(view.t);
        blendPos(o.position, view.from.pos, gl.pos, k);
        c.target.copy(view.from.target).lerp(gl.target, k);
        o.up.copy(view.from.up).lerp(gl.up, k).normalize();
        o.lookAt(c.target);
        if (view.mode === 'home' && view.t >= 1) releaseView();
      } else if (o.up.distanceToSquared(Y) > 1e-8) o.up.lerp(Y, Math.min(1, dt * 1.5)).normalize();
      // über der Oberfläche bleiben (≥ 10 km, im offenen Schnitt auch darunter); Nahebene mit der Höhe
      const r = o.position.length();
      if (cutMode === 'off' && r < R * 1.0064) o.position.multiplyScalar(R * 1.0064 / r);
      const nr = THREE.MathUtils.clamp((Math.abs(o.position.length() - R)) * 0.3, 0.002, 0.05);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
      return free;
    },
    live: () => {
      const ang = 2 * Math.atan(JUPITER.r / state.dist) / RAD;
      return `${fmt.format(new Date((jd - 2440587.5) * 864e5))} UTC · Jupiter ${Math.round(state.dist).toLocaleString('de-DE')} km, `
        + `${ang.toLocaleString('de-DE', { maximumFractionDigits: 1 })}° groß, ${Math.round(state.jupLit * 100)} % beleuchtet`
        + `${state.eclipse ? ' · Europa im Jupiterschatten' : ''}`;
    },
    setPixelRatio: (p) => { pr = p; if (catalog) catalog.userData.setPixelRatio(p); },
    dispose() {
      canvas.removeEventListener('pointerdown', releaseView);
      canvas.removeEventListener('wheel', releaseView);
      scene.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); });
    },
  };
}
