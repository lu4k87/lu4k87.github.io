// Station 02C1: Io aus der Nähe (Einheit 1.000 km), Abstecher von „Jupiter & Monde“. Mondfest: Io ruht, Jupiter hängt wegen
// der gebundenen Rotation fest über der Jupiterseite (19,5° groß), Sonne, Nachbarmonde und Sterne ziehen. Lage für den Zeitpunkt
// aus jovian.js (JPL-Bahnelemente in der Laplace-Ebene): Nullmeridian zur Jupitermitte, Pol = Laplace-Pol (Bahnneigung 0,04°).
// Oberfläche: USGS-Mosaik (Galileo SSI + Voyager, Farbe) mit PLANET_FRAG (Lommel-Seeliger, Jupiterschein, Jupiterschatten).
// Karte „Positive West“ −180…180: W = 180 − 360·u, also wie moon.jpg (u = 0,5 bei 0°) – geprüft an Pele, Loki, Tvashtar, Prometheus.
// Vulkane: Glut der Lavaseen und dunklen Paterae (Modell, Helligkeit überhöht; im Sonnenlicht kaum, im Jupiterschatten deutlich),
// Fahnen als Teilchen auf ballistischen Bahnen in Ios Schwerefeld (GM aus JPL) mit Startgeschwindigkeit aus der Gipfelhöhe.
// Gezeitenbeule (überhöht), Plasmatorus und Flussröhre als Modelle (Lage aus Bahn und Jupiter-Dipol, Helligkeit stark verstärkt).

import * as THREE from 'three';
import { julianDate, eclDir, equToScene, DAY } from '../astro.js';
import { GALILEAN, JUPITER, jovianState, lineOfSun, laplaceAngle } from '../jovian.js';
import { PLANET_FRAG, SHELL_VERT, ATMO_FRAG, ATMOS } from '../planetfx.js';
import { createStarfield } from '../stars.js';
import { createCatalogSky } from '../catalog.js';
import { createFlare } from '../flare.js';
import { settings } from '../settings.js';
import { SKY_VERTEX } from '../glsl.js';
import { registerLayers, refreshLayers } from '../layers.js';
import { spinAxis } from '../axes.js';

const RAD = Math.PI / 180, Y = new THREE.Vector3(0, 1, 0);
const R_IO = GALILEAN.io.r / 1e3, R_J = JUPITER.r / 1e3, RP_J = JUPITER.rp / 1e3, A_IO = GALILEAN.io.a / 1e3;
const G_IO = 5959.91547 / GALILEAN.io.r ** 2 / 1e3;   // Fallbeschleunigung [1.000 km/s²] aus GM (JPL phys_par) = 1,796 m/s²
const TIDE_H = 1e-4, TIDE_X = 1000;                    // Gezeitenbeule ≈ 100 m [1.000 km] (usgs-io), 1.000-fach überhöht
const PLUME_RATE = 60;                                 // Fahnen laufen 60-fach (Flugzeit Pele ≈ 19 min → 19 s), unabhängig vom Zeitraffer
const TORUS_TILT = 7 * RAD;                            // Plasmatorus in der Zentrifugalebene, gegen Jupiters Äquator geneigt (Modell)
// Zeitraffer [Tage je Sekunde]; Stufe 0 = Echtzeit
const SPEEDS = [[0, 'Echtzeit'], [1 / 1440, '1 min/s'], [1 / 144, '10 min/s'], [1 / 24, '1 h/s'], [0.25, '6 h/s']];
// Vulkane (USGS Gazetteer bzw. Paper; Breite, West-Länge): Fahnenhöhe [km] (0 = keine Fahne), Glut, Radius der Glut [rad]
const VENTS = [
  { id: 'pele', lat: -18.7, w: 255.3, h: 300, glow: 2.2, r: 0.03, col: [1.0, 0.62, 0.3], n: 12000 },
  { id: 'tvashtar', lat: 62, w: 122, h: 350, glow: 1.6, r: 0.035, col: [1.0, 0.5, 0.22], n: 12000 },
  { id: 'prometheus', lat: -1.6, w: 153, h: 80, glow: 1.0, r: 0.03, col: [1.0, 0.45, 0.18], n: 4000 },
  { id: 'loki', lat: 12.6, w: 308.8, h: 0, glow: 1.8, r: 0.07, col: [1.0, 0.35, 0.12], n: 0 },
];
// Breite, West-Länge → Mondsystem (Länge 0 = zu Jupiter auf +x, Norden +y, Osten −z wie die Textur)
const sel = (lat, w, r = R_IO) => new THREE.Vector3(Math.cos(lat * RAD) * Math.cos(-w * RAD), Math.sin(lat * RAD), -Math.cos(lat * RAD) * Math.sin(-w * RAD)).multiplyScalar(r);
const ease = (t) => t * t * (3 - 2 * t);

// Körper mit Gezeitenbeule: Auslenkung ∝ P₂(cos ψ) zur Jupiterrichtung, Stärke uTide (schwankt mit dem Bahnabstand)
const TIDE_VERT = /* glsl */ `
uniform vec3 uJdir;
uniform float uTide;
varying vec3 vN, vP, vO;
varying vec2 vUv;
void main() {
  vUv = uv;
  vO = position;
  float c = dot(normalize(position), uJdir);
  vec3 pos = position * (1.0 + uTide * 0.5 * (3.0 * c * c - 1.0));
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(pos, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
// Glut der Vulkane als Hülle knapp über dem Boden (additiv): benannte Vulkane als weiche Flecken, deren Form der dunklen Patera
// der Karte folgt, dazu schwach alle dunklen Paterae (Modell). Tagseite nur 6 %: Lava ist im sichtbaren Licht neben dem
// Sonnenlicht kaum zu sehen; im Jupiterschatten (uSunVis → 0) treten die Vulkane hervor. Langsames Atmen < 0,1 Hz.
const GLOW_FRAG = /* glsl */ `
uniform sampler2D tMap;
uniform vec3 uSunDir;
uniform vec4 uVent[4];
uniform vec3 uVentCol[4];
uniform float uVentR[4], uGlow, uTime, uSunVis;
varying vec3 vN, vP, vO;
varying vec2 vUv;
void main() {
  vec3 n = normalize(vO), alb = texture2D(tMap, vUv).rgb;
  // dunkle Paterae: lineare Helligkeit der Karte unter ≈ 0,04 (sRGB ≈ 0,2)
  float pat = 1.0 - smoothstep(0.02, 0.06, dot(alb, vec3(0.2126, 0.7152, 0.0722)));
  vec3 col = vec3(1.0, 0.3, 0.08) * pat * 0.3;
  for (int i = 0; i < 4; i++) {
    float d = acos(clamp(dot(n, uVent[i].xyz), -1.0, 1.0)) / uVentR[i];
    float g = exp(-d * d) * (0.35 + 0.65 * pat) + 0.18 * exp(-d * d / 9.0);
    col += uVentCol[i] * g * uVent[i].w * (0.85 + 0.15 * sin(uTime * 0.4 + float(i) * 1.7));
  }
  float day = smoothstep(-0.08, 0.2, dot(normalize(vN), uSunDir)) * uSunVis;
  gl_FragColor = vec4(col * uGlow * (1.0 - 0.94 * day), 1.0);
}
`;
// Fahne: Teilchen auf Wurfbahnen über der gekrümmten Oberfläche (Startwinkel bis uCone vom Lot, Azimut gleichverteilt);
// aP = Phase, Winkel-Anteil, Azimut, Helligkeit. Große Fahnen sind nach New Horizons nicht rein ballistisch – Näherung.
const PLUME_VERT = /* glsl */ `
attribute vec4 aP;
uniform vec3 uN, uE1, uE2;
uniform float uR, uV, uG, uT, uCone, uScale, uTide;
uniform vec3 uJdir;
varying float vA;
varying vec3 vW;
void main() {
  float th = aP.y * uCone, vz = uV * cos(th), vh = uV * sin(th);
  float T = 2.0 * vz / uG, tau = fract(uT / T + aP.x) * T;
  float h = vz * tau - 0.5 * uG * tau * tau, ang = vh * tau / uR;
  vec3 p = (cos(ang) * uN + sin(ang) * (cos(aP.z) * uE1 + sin(aP.z) * uE2));
  float c = dot(p, uJdir);
  p *= uR * (1.0 + uTide * 0.5 * (3.0 * c * c - 1.0)) + h;
  float k = tau / T;
  vA = smoothstep(0.0, 0.1, k) * (1.0 - smoothstep(0.8, 1.0, k)) * aP.w;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  vec4 mv = viewMatrix * w;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uScale / -mv.z, 1.0, 7.0);
}
`;
// Licht der Fahne: Staub und Schwefeldioxid-Reif streuen vor allem vorwärts (im Gegenlicht hell, bläulich); im Schatten von Io
// und im Jupiterschatten dunkel
const PLUME_FRAG = /* glsl */ `
uniform vec3 uSunDir, uCol;
uniform float uR, uGain, uSunVis;
varying float vA;
varying vec3 vW;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  if (r2 > 0.25) discard;
  float s = dot(vW, uSunDir);
  vec3 q = vW - s * uSunDir;
  float lit = s < 0.0 && dot(q, q) < uR * uR ? 0.0 : 1.0;
  float fwd = pow(max(dot(normalize(vW - cameraPosition), uSunDir), 0.0), 6.0);
  gl_FragColor = vec4(uCol * vA * exp(-r2 * 14.0) * lit * uSunVis * (0.3 + 2.6 * fwd) * uGain, 1.0);
}
`;
// Plasmatorus: Sichtstrahl ab der Kamera in 40 Schritten (Abstand exponentiell), Dichte gaußförmig um den Ring (Radius uA,
// Breite uW) in der geneigten Ebene uAxis; endet an Io oder Jupiter. Leuchten von S⁺ bei 673 nm (rot), stark verstärkt.
const TORUS_FRAG = /* glsl */ `
uniform vec3 uJ, uAxis, uCol;
uniform float uA, uW, uRJ, uRIo, uGain;
varying vec3 vDir;
float hit(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 oc = ro - c;
  float b = dot(oc, rd), h = b * b - dot(oc, oc) + r * r;
  if (h < 0.0) return 1e9;
  float t = -b - sqrt(h);
  return t > 0.0 ? t : 1e9;
}
void main() {
  vec3 ro = cameraPosition, rd = normalize(vDir);
  float tEnd = min(hit(ro, rd, vec3(0.0), uRIo), hit(ro, rd, uJ, uRJ));
  float sum = 0.0, t0 = 0.0;
  for (int i = 0; i < 40; i++) {
    float t1 = 0.4 * pow(3000.0, float(i + 1) / 40.0);
    if (t0 >= tEnd) break;
    float tm = 0.5 * (t0 + min(t1, tEnd));
    vec3 v = ro + rd * tm - uJ;
    float z = dot(v, uAxis), rho = length(v - z * uAxis);
    sum += exp(-((rho - uA) * (rho - uA) + z * z) / (2.0 * uW * uW)) * (min(t1, tEnd) - t0);
    t0 = t1;
  }
  gl_FragColor = vec4(uCol * smoothstep(40.0, 420.0, sum) * uGain, 1.0);
}
`;
const SKY_VERT = /* glsl */ `
${SKY_VERTEX}
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = skyPosition(vDir); }
`;
// Sonne am Himmel: bei 5,2 AE nur 0,05° Winkelradius, dazu der Lichthof der Optik
const SUN_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uAng;
varying vec3 vDir;
void main() {
  float a = acos(clamp(dot(normalize(vDir), uSun), -1.0, 1.0));
  float disk = smoothstep(uAng * 1.08, uAng * 0.92, a);
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * (disk * 600.0 + exp(-a / 0.01) * 3.0 + exp(-a / 0.07) * 0.08), 1.0);
}
`;
// Flussröhre: Leuchten am Rand der Röhre (flach geschnitten = hell), Wellen laufen langsam zu Jupiter (≈ 0,2 Hz)
const FLUX_VERT = /* glsl */ `
attribute float aU;
varying float vU;
varying vec3 vN, vP;
void main() {
  vU = aU;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const FLUX_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uTime, uGain;
varying float vU;
varying vec3 vN, vP;
void main() {
  float edge = 1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vP)));
  float wave = 0.55 + 0.45 * sin(abs(vU) * 40.0 - uTime * 1.2);
  float fade = smoothstep(0.0, 0.05, abs(vU)) * 0.6 + 0.4;
  gl_FragColor = vec4(uCol * pow(edge, 2.0) * wave * fade * uGain, 1.0);
}
`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(200,220,255,0.35)');
  grd.addColorStop(1, 'rgba(160,190,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 4000);
  let jd = julianDate(ctx.date), spdIdx = 2, rate = SPEEDS[spdIdx][0], tPlume = 0, pr = 1;
  const state = { jdist: A_IO, sunVis: 1, jLit: 0.5 };

  // ---------- Lage: Mondsystem (körperfest) ↔ Ekliptik-Szene ----------
  const sun = new THREE.Vector3(), jpos = new THREE.Vector3(), jdir = new THREE.Vector3(1, 0, 0);
  const P = new THREE.Vector3(...equToScene(GALILEAN.io.ra, GALILEAN.io.dec)), PJ = new THREE.Vector3(...equToScene(...JUPITER.pole));
  const x0 = new THREE.Vector3(), z0 = new THREE.Vector3(), mB = new THREE.Matrix4(), qInv = new THREE.Quaternion();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), qTmp = new THREE.Quaternion();
  const others = ['europa', 'ganymede', 'callisto'];
  const otherPos = Object.fromEntries(others.map((id) => [id, new THREE.Vector3()]));

  // ---------- Himmel: Katalog (Yale BSC) + Milchstraßenband; drehen mit der Lage ----------
  const ngp = new THREE.Vector3(...eclDir(180.02, 29.81)), gc = new THREE.Vector3(...eclDir(266.84, -5.54));
  const sky = new THREE.Group();
  scene.add(sky);
  let catalog = null;
  const ready = createCatalogSky({ gain: 1.6, limit: 6.5 }).then((g) => { catalog = g; sky.add(g); g.userData.setPixelRatio(pr); })
    .catch((err) => {
      console.warn('[kosmos] Sternkatalog nicht geladen, statistischer Himmel:', err);
      catalog = createStarfield({ ngp, gc, gain: 0.8, seed: 17 });
      catalog.userData.setPixelRatio(pr);
      sky.add(catalog);
    });
  sky.add(createStarfield({ count: 1, ngp, gc, gain: 0, band: 1, glint: false, tex: ctx.tex }));
  const sunU = { uSun: { value: sun }, uAng: { value: 0.0009 } };
  const sunSky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SUN_FRAG,
    uniforms: sunU, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }));
  sunSky.frustumCulled = false;
  sunSky.renderOrder = -9;
  scene.add(sunSky);
  const flare = createFlare({ strength: 0.6 });
  scene.add(flare);

  // ---------- Io ----------
  const occ = Array.from({ length: 4 }, () => new THREE.Vector4());
  const planetU = (map, o) => ({
    tMap: { value: map }, tNight: { value: null }, tClouds: { value: null }, tSpec: { value: null }, tRing: { value: null },
    uHasEarth: { value: 0 }, uCloudU: { value: 0 }, uGain: { value: o.gain }, uRing: { value: 0 }, uRingIn: { value: 0 }, uRingOut: { value: 0 },
    uInv: { value: new THREE.Matrix4() }, uWrap: { value: o.wrap ?? 0.02 }, uAmb: { value: o.amb ?? 0.004 }, uBand: { value: o.band ?? 0 }, uTime: { value: 0 },
    uMoon: { value: o.moon ? 1 : 0 }, uEarthPos: { value: o.shinePos ?? new THREE.Vector3() }, uEarthshine: { value: 0 }, uSunAng: { value: 0.0009 },
    uTerm: { value: new THREE.Vector3(...(o.term ?? [1, 0.85, 0.7])) }, uSunDir: { value: sun }, uOcc: { value: o.occ ?? occ }, uOccN: { value: 0 },
    uJdir: { value: jdir }, uTide: { value: 0 },
  });
  const ioMap = ctx.tex('io.jpg');
  const ioU = planetU(ioMap, { moon: true, gain: 1.05, shinePos: jpos });
  const io = new THREE.Mesh(new THREE.SphereGeometry(R_IO, 256, 128), new THREE.ShaderMaterial({ vertexShader: TIDE_VERT, fragmentShader: PLANET_FRAG, uniforms: ioU }));
  scene.add(io);
  spinAxis(io);
  const vents = VENTS.map((v) => ({ ...v, dir: sel(v.lat, v.w, 1) }));
  const glowU = {
    tMap: { value: ioMap }, uSunDir: { value: sun }, uGlow: { value: 1 }, uTime: { value: 0 }, uSunVis: { value: 1 }, uJdir: { value: jdir }, uTide: ioU.uTide,
    uVent: { value: vents.map((v) => new THREE.Vector4(v.dir.x, v.dir.y, v.dir.z, v.glow)) },
    uVentCol: { value: vents.map((v) => new THREE.Vector3(...v.col)) }, uVentR: { value: vents.map((v) => v.r) },
  };
  const glow = new THREE.Mesh(new THREE.SphereGeometry(R_IO * 1.0015, 192, 96), new THREE.ShaderMaterial({ vertexShader: TIDE_VERT, fragmentShader: GLOW_FRAG,
    uniforms: glowU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.renderOrder = 2;
  scene.add(glow);

  // ---------- Fahnen ----------
  const plumeMats = [];
  const plumes = new THREE.Group();
  scene.add(plumes);
  const nScale = ctx.detail > 0.7 ? 1 : 0.5;
  for (let k = 0, seed = 7; k < vents.length; k++) {
    const v = vents[k];
    if (!v.h) continue;
    const n = Math.round(v.n * nScale), a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      seed = (seed * 16807) % 2147483647; const r1 = seed / 2147483647;
      seed = (seed * 16807) % 2147483647; const r2 = seed / 2147483647;
      seed = (seed * 16807) % 2147483647; const r3 = seed / 2147483647;
      seed = (seed * 16807) % 2147483647; const r4 = seed / 2147483647;
      a.set([r1, Math.sqrt(r2), r3 * Math.PI * 2, 0.4 + 0.6 * r4], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aP', new THREE.BufferAttribute(a, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R_IO * 2);
    const e1 = new THREE.Vector3().crossVectors(Y, v.dir).normalize(), e2 = new THREE.Vector3().crossVectors(v.dir, e1);
    const u = {
      uN: { value: v.dir }, uE1: { value: e1 }, uE2: { value: e2 }, uR: { value: R_IO }, uV: { value: Math.sqrt(2 * G_IO * v.h / 1e3) },
      uG: { value: G_IO }, uT: { value: 0 }, uCone: { value: 0.75 }, uScale: { value: 1 }, uTide: ioU.uTide, uJdir: { value: jdir },
      uSunDir: { value: sun }, uCol: { value: new THREE.Vector3(...(v.id === 'pele' ? [0.8, 0.8, 0.9] : [0.7, 0.82, 1.0])) },
      uGain: { value: v.id === 'pele' ? 0.11 : 0.09 }, uSunVis: glowU.uSunVis,
    };
    const m = new THREE.ShaderMaterial({ vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG, uniforms: u, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    plumeMats.push(m);
    plumes.add(new THREE.Points(g, m));
  }

  // ---------- Jupiter (Bänder, Atmosphärensaum, Schatten der Monde) ----------
  const jOcc = Array.from({ length: 4 }, () => new THREE.Vector4());
  const at = ATMOS.jupiter;
  const jupU = planetU(ctx.tex('jupiter.jpg'), { gain: 1.0, band: 1, wrap: at.wrap, term: at.term, amb: 0.003, occ: jOcc });
  jupU.uOccN.value = 4;
  const jupG = new THREE.Group();
  const jupiter = new THREE.Mesh(new THREE.SphereGeometry(R_J, 192, 96), new THREE.ShaderMaterial({ vertexShader: TIDE_VERT, fragmentShader: PLANET_FRAG, uniforms: jupU }));
  jupiter.scale.y = RP_J / R_J;
  jupG.add(jupiter);
  spinAxis(jupiter);
  scene.add(jupG);
  const jAtmo = new THREE.Mesh(new THREE.SphereGeometry(R_J * at.ra, 96, 48), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: ATMO_FRAG, uniforms: {
    uSun: { value: sun }, uCenter: { value: jpos }, uBeta: { value: new THREE.Vector3(...at.beta) }, uMieCol: { value: new THREE.Vector3(...at.mieCol) },
    uRp: { value: R_J }, uRa: { value: R_J * at.ra }, uH: { value: at.h }, uGain: { value: at.gain }, uMie: { value: at.mie }, uAir: { value: 0 }, uAirH: { value: 0.2 } },
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  scene.add(jAtmo);

  // ---------- Nachbarmonde am Himmel (Europa bis 0,7° groß) ----------
  const moons = others.map((id) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(GALILEAN[id].r / 1e3, 48, 24), new THREE.ShaderMaterial({ vertexShader: TIDE_VERT, fragmentShader: PLANET_FRAG,
      uniforms: planetU(ctx.tex(`${id}.jpg`), { moon: true, gain: 1.05 }) }));
    m.material.uniforms.uEarthPos.value = jpos;
    spinAxis(m);
    scene.add(m);
    return m;
  });

  // ---------- Plasmatorus und Flussröhre ----------
  const torusU = { uJ: { value: jpos }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uCol: { value: new THREE.Vector3(1.0, 0.3, 0.48) },
    uA: { value: A_IO }, uW: { value: 0.6 * R_J }, uRJ: { value: R_J }, uRIo: { value: R_IO }, uGain: { value: 0.07 } };
  const torus = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: TORUS_FRAG,
    uniforms: torusU, side: THREE.BackSide, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, transparent: true }));
  torus.frustumCulled = false;
  torus.renderOrder = 5;
  scene.add(torus);
  // Feldlinie des Dipols durch Io (L = 5,9): r = L·cos²λ, Röhre wird zu Jupiter hin enger (Querschnitt ∝ 1/B ∝ r³)
  const L0 = Math.acos(Math.sqrt(R_J / A_IO));   // Breite des Fußpunkts ≈ 65,7°
  const fluxG = new THREE.Group();
  const fluxU = { uCol: { value: new THREE.Vector3(0.55, 0.7, 1.0) }, uTime: { value: 0 }, uGain: { value: 0.22 } };
  {
    const NS = 160, NR = 20, pos = [], nor = [], au = [], idx = [];
    const pt = (lam) => { const r = A_IO * Math.cos(lam) ** 2; return new THREE.Vector3(A_IO - r * Math.cos(lam), r * Math.sin(lam), 0); };
    for (let i = 0; i <= NS; i++) {
      const lam = -L0 + 2 * L0 * i / NS, c = pt(lam), t = pt(lam + 1e-3).sub(pt(lam - 1e-3)).normalize();
      const nA = new THREE.Vector3(0, 0, 1), nB = new THREE.Vector3().crossVectors(t, nA).normalize();
      const rad = Math.max(R_IO * 1.15 * Math.cos(lam) ** 3, 0.12);
      for (let j = 0; j <= NR; j++) {
        const a = j / NR * Math.PI * 2, d = nA.clone().multiplyScalar(Math.cos(a)).addScaledVector(nB, Math.sin(a));
        pos.push(...c.clone().addScaledVector(d, rad).toArray());
        nor.push(...d.toArray());
        au.push(lam / L0);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) {
      const a = i * (NR + 1) + j, b = a + NR + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aU', new THREE.Float32BufferAttribute(au, 1));
    g.setIndex(idx);
    fluxG.add(new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: FLUX_VERT, fragmentShader: FLUX_FRAG, uniforms: fluxU,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
    const spot = new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0x9fbfff, opacity: 0.9 });
    for (const s of [-1, 1]) {
      const sp = new THREE.Sprite(spot);
      sp.position.copy(pt(s * L0 * 0.995));
      sp.scale.setScalar(5);
      fluxG.add(sp);
    }
  }
  fluxG.visible = false;
  scene.add(fluxG);

  // ---------- Zeitpunkt anwenden ----------
  function place() {
    const st = jovianState(jd), m = st.moons.io;
    state.jdist = Math.hypot(...m) / 1e3;
    tmp.set(-m[0], -m[1], -m[2]).normalize();                        // Io → Jupiter (Szene)
    x0.copy(tmp).addScaledVector(P, -tmp.dot(P)).normalize();
    z0.crossVectors(x0, P);
    mB.makeBasis(x0, P, z0);
    qInv.setFromRotationMatrix(mB).invert();
    sun.set(...st.sun).applyQuaternion(qInv);
    jpos.copy(tmp).multiplyScalar(state.jdist).applyQuaternion(qInv);
    jdir.copy(jpos).normalize();
    sky.quaternion.copy(qInv);
    // Jupiter: Pol nach JUPITER.pole, Drehung System III (Länge des Roten Flecks nicht nach Messung)
    jupG.position.copy(jpos);
    jupG.quaternion.copy(qInv).multiply(qTmp.setFromUnitVectors(Y, PJ)).multiply(new THREE.Quaternion().setFromAxisAngle(Y, ((jd * 24 / JUPITER.rot) % 1) * Math.PI * 2));
    // Nachbarmonde relativ zu Io
    others.forEach((id, i) => {
      const p = st.moons[id];
      otherPos[id].set(p[0] - m[0], p[1] - m[1], p[2] - m[2]).multiplyScalar(1e-3).applyQuaternion(qInv);
      moons[i].position.copy(otherPos[id]);
      jOcc[i + 1].set(otherPos[id].x, otherPos[id].y, otherPos[id].z, GALILEAN[id].r / 1e3);
    });
    jOcc[0].set(0, 0, 0, R_IO);
    occ[0].set(jpos.x, jpos.y, jpos.z, R_J);
    ioU.uOccN.value = 1;
    for (const u of [ioU, jupU, ...moons.map((o) => o.material.uniforms)]) u.uSunAng.value = st.sunAng;
    sunU.uAng.value = st.sunAng;
    // Jupiterschatten auf Io (Mitte): Ein- und Austritt über einen Io-Durchmesser
    const ls = lineOfSun(st, 'io');
    state.sunVis = ls.s > 0 ? 1 : THREE.MathUtils.smoothstep(ls.q, 1 - GALILEAN.io.r / JUPITER.r, 1 + GALILEAN.io.r / JUPITER.r);
    glowU.uSunVis.value = state.sunVis;
    // Jupiterschein: voller Jupiter ≈ Albedo 0,538 · (R_J/d)² = 1,5 % des Sonnenlichts, mal beleuchteter Anteil (eigene Rechnung)
    state.jLit = (1 - jdir.dot(sun)) / 2;
    ioU.uEarthshine.value = 1.8 * 0.538 * (R_J / state.jdist) ** 2 * state.jLit * shineX;
    // Gezeitenbeule: Anteil, der mit dem Bahnabstand schwankt (∝ 1/r³), überhöht
    // (normiert auf 100 m bei größtem bzw. kleinstem Abstand; Gezeiten ∝ 1/r³, also im Perijovum am stärksten)
    ioU.uTide.value = tideOn ? TIDE_H * TIDE_X / R_IO * -(state.jdist / A_IO - 1) / GALILEAN.io.e : 0;
    // Plasmatorus in der Zentrifugalebene, die mit Jupiters Drehung um den Pol taumelt
    const ph = ((jd * 24 / JUPITER.rot) % 1) * Math.PI * 2;
    tmp2.set(Math.cos(ph), 0, Math.sin(ph));
    torusU.uAxis.value.copy(Y).applyAxisAngle(tmp2, TORUS_TILT).normalize();
  }

  // ---------- Blicke ----------
  // Io: Jupiter schräg dahinter links (≈ 17° neben der Blickachse), Phasenwinkel möglichst ≈ 70° (aus 72 Richtungen), leicht von Norden
  function homePose() {
    let best = null, bs = -Infinity;
    for (let k = 0; k < 72; k++) {
      const a = k / 72 * Math.PI * 2, c = new THREE.Vector3(Math.cos(a), 0.22, Math.sin(a)).normalize();
      const ph = Math.acos(THREE.MathUtils.clamp(c.dot(sun), -1, 1)) / RAD;
      const right = tmp2.crossVectors(c, Y).multiplyScalar(-1).normalize();
      const s = -(((ph - 70) / 50) ** 2) - ((c.dot(jdir) + 0.955) / 0.05) ** 2 - (jdir.dot(right) > 0 ? 1.5 : 0);
      if (s > bs) { bs = s; best = c; }
    }
    return { pos: best.multiplyScalar(R_IO * 5.4), target: jdir.clone().multiplyScalar(R_IO * 0.9), up: Y };
  }
  const home = homePose();
  // Fahne am Rand: Sichtlinie streift den Vulkan, Sonne 35° neben der Blickrichtung (Gegenlicht → Vorwärtsstreuung)
  function plumePose(id) {
    const v = vents.find((x) => x.id === id), n = v.dir;
    const s = sun.clone().addScaledVector(n, -sun.dot(n));
    if (s.lengthSq() < 1e-6) s.crossVectors(n, Y);
    const t = s.normalize().applyAxisAngle(n, 35 * RAD);
    const c = n.clone().multiplyScalar(R_IO + v.h * 6e-4);
    return { pos: c.clone().addScaledVector(t, -R_IO * 0.85).addScaledVector(n, R_IO * 0.06), target: c, up: n.clone() };
  }
  // Jupiterhimmel: 20 km über dem Boden, 70° von der Jupitermitte → Jupiter ≈ 20° über dem Horizont, Blick knapp darunter
  function skyPose() {
    const p = sel(8, -70, R_IO * 1.011), up = p.clone().normalize();
    const aim = jpos.clone().sub(p).normalize().addScaledVector(up, -0.2).normalize();
    return { pos: p, target: p.clone().addScaledVector(aim, R_IO * 3), up };
  }
  const view = { mode: null, t: 0, from: null };
  // Fahnen-Blick: liegt der Vulkan im Dunkeln, springt die Zeit (Schritt 10 min) zum nächsten Vormittag oder Nachmittag dort
  // (Sonnenhöhe 17–37°), damit die Fahne im Sonnenlicht steht
  function toDaylight(v) {
    const n = vents.find((x) => x.id === v).dir;
    if (n.dot(sun) > 0.25) return;
    const jd0 = jd;
    for (let i = 1; i < 270; i++) {
      jd = jd0 + i / 144;
      place();
      const e = n.dot(sun);
      if (e > 0.3 && e < 0.6) return;
    }
    jd = jd0;
    place();
  }
  const setView = (v) => { if (v === 'pele' || v === 'tvashtar') toDaylight(v); view.mode = v; view.t = 0; view.from = null; };
  const releaseView = () => { view.mode = null; };
  const canvas = ctx.renderer.domElement;
  canvas.addEventListener('pointerdown', releaseView);
  canvas.addEventListener('wheel', releaseView, { passive: true });
  const goal = () => (view.mode === 'io' ? homePose() : view.mode === 'sky' ? skyPose() : plumePose(view.mode));
  const qa = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3();
  function blendPos(out, a, b, k) {
    const ra = a.length(), rb = b.length();
    va.copy(a).normalize(); vb.copy(b).normalize();
    qa.setFromUnitVectors(va, vb);
    out.copy(va).applyQuaternion(new THREE.Quaternion().slerp(qa, k)).multiplyScalar(Math.exp(Math.log(ra) + (Math.log(rb) - Math.log(ra)) * k));
  }

  // ---------- Abzeichen (Gruppen über den Schalter „Abzeichen“) ----------
  let group = 'volcano', tideOn = false, shineX = 3;
  const facing = (p, cam) => tmp.copy(cam.position).sub(p).normalize().dot(va.copy(p).normalize());
  const surf = (id, lat, w, focus = 0.9) => {
    const pos = sel(lat, w);
    return { id, kind: 'info', pos, focus: () => { releaseView(); return R_IO * focus; }, visible: (cam) => group === 'volcano' && facing(pos, cam) > 0.06 };
  };
  const hidden = (cam, p, r = 0) => {
    const d = vb.copy(p).sub(cam.position), L = d.length();
    d.divideScalar(L);
    const s = -cam.position.dot(d);
    return s > 0 && s < L - r && cam.position.lengthSq() - s * s < R_IO * R_IO;
  };
  const torusPos = new THREE.Vector3(), fluxPos = new THREE.Vector3();
  const space = (id, pos, r = 0) => ({ id, kind: 'info', pos, visible: (cam) => group === 'space' && !hidden(cam, pos, r) });
  const hotspots = [
    surf('pele', -18.7, 255.3, 0.7),
    surf('loki', 12.6, 308.8, 0.7),
    surf('tvashtar', 62, 122, 0.7),
    surf('prometheus', -1.6, 153, 0.6),
    surf('sulfur', -62, 300, 1.2),
    surf('tide', 0, 0, 1.4),
    space('jupiter', jpos, R_J),
    space('torus', torusPos),
    space('flux', fluxPos),
  ];
  hotspots.find((h) => h.id === 'flux').visible = (cam) => group === 'space' && fluxG.visible && !hidden(cam, fluxPos);

  // ---------- Schalter der Infotafel ----------
  const controls = [
    { id: 'view', label: 'Blick', value: 'io', options: [['io', 'Io'], ['pele', 'Fahne Pele'], ['tvashtar', 'Fahne Tvashtar'], ['sky', 'Jupiterhimmel']], set: setView },
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: spdIdx, min: 0, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (v) => setSpeed(Math.round(v)), get: () => (rate ? spdIdx : 0) },
    { id: 'marks', label: 'Abzeichen', value: group, options: [['volcano', 'Vulkane'], ['space', 'Jupiter & Torus']], set: (v) => { group = v; } },
    { id: 'eclipse', type: 'action', label: 'Ereignis', button: 'Io im Jupiterschatten', run: () => {
      // nächster Eintritt in den Kernschatten (Schritt 5 min), 10 min vorher starten, Zeitraffer 1 min/s
      for (let t = jd + 1 / 288, was = true; t < jd + 2; t += 1 / 288) {
        const l = lineOfSun(jovianState(t), 'io'), inside = l.s < 0 && l.q < 1;
        if (inside && !was) { jd = t - 10 / 1440; break; }
        was = inside;
      }
      setSpeed(1);
      setView('io');
    } },
  ];
  function setSpeed(i) {
    if (i > 0) { spdIdx = i; rate = SPEEDS[i][0]; } else { rate = 0; jd = julianDate(new Date()); }
    refreshLayers();
  }

  // ---------- Ebenen (Zahnrad „Station · Io“, Zeitleiste) ----------
  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
  registerLayers('io', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', hint: 'Ios Umlauf (1,77 Tage), Sonnenstand, Jupiterphase und Nachbarmonde im gewählten Tempo; Pause = Echtzeit.',
      value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, autoplay: true, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, playing) => { spdIdx = Math.max(1, Math.round(i)); rate = playing ? SPEEDS[spdIdx][0] : 0; if (!playing) jd = julianDate(new Date()); },
      get: () => ({ value: spdIdx, playing: rate !== 0 }), status: () => `${fmt.format(new Date((jd - 2440587.5) * 864e5))} UTC${rate ? '' : ' · Echtzeit'}` },
    { id: 'plumes', type: 'toggle', group: 'Vulkane', label: 'Fahnen (Pele, Tvashtar, Prometheus)', value: true,
      hint: 'Wurfbahnen in Ios Schwerkraft, 60-fach beschleunigt: Pele ≈ 300 km (Richtwert), eine Bahn dauert dort rund 19 Minuten.', set: (v) => { plumes.visible = v; } },
    { id: 'glow', type: 'range', label: 'Glut der Lavaseen', value: 1, min: 0, max: 3, step: 0.25, unit: '×',
      hint: 'Stark überhöht. Im Sonnenlicht ist glühende Lava im sichtbaren Licht kaum zu sehen; im Jupiterschatten leuchten die Vulkane.', set: (v) => { glowU.uGlow.value = v; } },
    { id: 'tide', type: 'toggle', label: 'Gezeitenbeule (1.000-fach überhöht)', value: false,
      hint: 'Der schwankende Teil der Verformung: Auf der elliptischen Bahn wächst und schrumpft die Beule zu Jupiter hin um über 100 m.', set: (v) => { tideOn = v; } },
    { id: 'torus', type: 'toggle', group: 'Magnetosphäre', label: 'Plasmatorus', value: true, set: (v) => { torus.visible = v; } },
    { id: 'torusGain', type: 'range', label: 'Helligkeit', value: 1, min: 0.25, max: 3, step: 0.25, unit: '×', sub: true,
      hint: 'Modell, um Größenordnungen verstärkt: Mit bloßem Auge wäre der Ring aus Schwefel- und Sauerstoff-Ionen nicht zu sehen.', set: (v) => { torusU.uGain.value = 0.07 * v; } },
    { id: 'flux', type: 'toggle', label: 'Flussröhre zu Jupiters Polen', value: false, set: (v) => { fluxG.visible = v; } },
    { id: 'jshine', type: 'range', group: 'Licht', label: 'Jupiterschein', value: shineX, min: 0, max: 5, step: 0.5, unit: '×',
      hint: '1× = echt: Der volle Jupiter beleuchtet Io mit rund 1,5 % des Sonnenlichts (eigene Rechnung aus Radius, Abstand und Albedo).', set: (v) => { shineX = v; } },
    { id: 'jupiter', type: 'toggle', group: 'Himmel', label: 'Jupiter', value: true, set: (v) => { jupG.visible = jAtmo.visible = v; } },
    { id: 'moons', type: 'toggle', label: 'Europa, Ganymed, Kallisto', value: true, set: (v) => { moons.forEach((m) => { m.visible = v; }); } },
  ]);
  place();
  Object.assign(home, homePose());

  const occluders = [{ center: new THREE.Vector3(), radius: R_IO }, { center: jpos, radius: R_J }];
  const sunFar = new THREE.Vector3();
  return {
    scene, camera, home, unit: 1e6, hotspots, controls, ready,
    orbit: { minDistance: 0.03, maxDistance: 120, cineSpeed: 0.5 },
    look: { exposure: 1.0, bloom: 0.07, sat: 1.05 },
    update(dt, t, cam, flying) {
      if (!flying) jd += rate ? dt * rate : dt / DAY;
      tPlume += dt * (ctx.still ? PLUME_RATE / 4 : PLUME_RATE);
      place();
      const ta = ctx.still ? t * 0.2 : t;
      jupU.uTime.value = ta;
      glowU.uTime.value = ta;
      fluxU.uTime.value = ta;
      const h = ctx.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
      for (const m of plumeMats) { m.uniforms.uT.value = tPlume; m.uniforms.uScale.value = 0.007 * h; }
      // Abzeichen Torus: Punkt auf dem Ring 25° vor Io; Flussröhre: Scheitel der nördlichen Feldlinie
      torusPos.set(A_IO - A_IO * Math.cos(25 * RAD), 0, -A_IO * Math.sin(25 * RAD));
      fluxPos.set(A_IO * (1 - Math.cos(L0 * 0.5) ** 3), A_IO * Math.cos(L0 * 0.5) ** 2 * Math.sin(L0 * 0.5), 0);
      sunFar.copy(sun).multiplyScalar(3000);
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
        if (view.mode === 'io' && view.t >= 1) releaseView();
      } else if (o.up.distanceToSquared(Y) > 1e-8) o.up.lerp(Y, Math.min(1, dt * 1.5)).normalize();
      // über der Oberfläche bleiben (≥ 15 km); Nahebene mit der Höhe
      const r = o.position.length();
      if (r < R_IO * 1.008) o.position.multiplyScalar(R_IO * 1.008 / r);
      const nr = THREE.MathUtils.clamp((o.position.length() - R_IO) * 0.3, 0.002, 0.05);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
      return free;
    },
    live: () => `${fmt.format(new Date((jd - 2440587.5) * 864e5))} UTC · Jupiter ${Math.round(state.jLit * 100)} % beleuchtet · `
      + `Abstand ${Math.round(state.jdist * 1e3).toLocaleString('de-DE')} km · Laplace-Winkel ${Math.round(laplaceAngle(jd))}°`
      + `${state.sunVis < 0.02 ? ' · im Jupiterschatten' : state.sunVis < 0.98 ? ' · tritt in den Jupiterschatten' : ''}`,
    setPixelRatio: (p) => { pr = p; if (catalog) catalog.userData.setPixelRatio(p); },
    dispose() {
      canvas.removeEventListener('pointerdown', releaseView);
      canvas.removeEventListener('wheel', releaseView);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    },
  };
}
