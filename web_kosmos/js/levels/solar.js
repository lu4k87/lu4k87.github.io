// Station 2: Sonnensystem (Einheit 1 AE). Planeten an den Orten von heute aus den JPL-Bahnelementen, Bahnen als echte
// Ellipsen (Exzentrizität, Neigung, Knoten) mit Leuchtspur hinter dem Planeten; Polachsen nach IAU/WGCCRE (Rektaszension,
// Deklination des Nordpols J2000). Asteroidengürtel mit Kirkwood-Lücken (3:1, 5:2, 7:3), Hilda-Gruppe (3:2), Jupiter-
// Trojaner an L4/L5 und Kuipergürtel mit Plutinos (3:2 zu Neptun) laufen nach Kepler im Vertex-Shader.
// Sonne (Shader in sunfx.js): Photosphäre mit Zell-Granulation, Flecken (Umbra/Penumbra), Fackeln, differentieller Rotation
// (Snodgrass & Ulrich 1990) und farbiger Randverdunkelung; Chromosphäre mit Spikulen, Korona nach Baumbach mit Helm-
// streamern, Plumes und Filamenten; Protuberanzen als fließende Plasmabögen mit Lebenszyklus, Flares am Fußpunkt und
// Massenauswürfen mit Stoßfront (Modell in Szenenzeit), Linsenreflex (flare.js). Planeten (planetfx.js): weicher Terminator,
// Atmosphären als eigene Hüllen (Einfachstreuung), Gasriesen mit strömendem Banddetail, Erde mit eigener Wolkenschicht,
// Stadtlichtern und Glanzlicht, Saturn mit Ringschatten, Planetenschatten und Durchlicht der Ringe; Mond (Lommel-Seeliger).
// Größen: „Anschaulich“ = R^0,45 gestaucht (Reihenfolge stimmt, Verhältnisse nicht), „Echt“ = wahre Radien.

import * as THREE from 'three';
import { PLANETS, PLUTO, planetPosition, AU, C, julianDate, elementsAt, solveKepler, orbitToEcliptic, eclToScene, eclDir, moonPosition, OBLIQUITY, mulberry32, gauss } from '../astro.js';
import { createStarfield } from '../stars.js';
import { SUN_FRAG, BILLBOARD_VERT, CORONA_FRAG, LOOP_VERT, LOOP_FRAG, CME_FRAG, loopsGeometry, spotGroups, streamerSet } from '../sunfx.js';
import { BODY_VERT, SHELL_VERT, PLANET_FRAG, ATMO_FRAG, CLOUD_FRAG, RING_FRAG, ATMOS } from '../planetfx.js';
import { createFlare } from '../flare.js';
import { jupiterAurora } from '../jupiterfx.js';
import { settings } from '../settings.js';
import { registerLayers } from '../layers.js';
import { keepShare } from '../sats.js';

const RAD = Math.PI / 180;
const AU_KM = AU / 1e3;
// Radien [km] (NASA Fact Sheets, äquatorial), Rotationsperiode [h] (negativ = rückläufig), Nordpol α/δ [°] (IAU WGCCRE 2015),
// Atmosphären: ATMOS in planetfx.js
const BODY = {
  mercury: { r: 2439.7, rot: 1407.6, pole: [281.01, 61.41], tex: 'mercury.jpg', dot: 0xc9c2b8 },
  venus: { r: 6051.8, rot: -5832.5, pole: [272.76, 67.16], tex: 'venus_atmosphere.jpg', dot: 0xf2dca8 },
  earth: { r: 6378.1, rot: 23.934, pole: [0, 90], tex: 'earth_daymap.jpg', dot: 0x79b2ff },
  mars: { r: 3396.2, rot: 24.623, pole: [317.68, 52.89], tex: 'mars.jpg', dot: 0xe07a50 },
  jupiter: { r: 71492, rot: 9.925, pole: [268.06, 64.50], tex: 'jupiter.jpg', dot: 0xe2c193 },
  saturn: { r: 60268, rot: 10.656, pole: [40.59, 83.54], tex: 'saturn.jpg', dot: 0xead7a2 },
  uranus: { r: 25559, rot: -17.24, pole: [257.31, -15.18], tex: 'uranus.jpg', dot: 0xb3e6ec },
  neptune: { r: 24764, rot: 16.11, pole: [299.36, 43.46], tex: 'neptune.jpg', dot: 0x6d8ff0 },
};
const NAME = { mercury: 'Merkur', venus: 'Venus', earth: 'Erde', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptun' };
const SUN_R = 695700, SUN_POLE = [286.13, 63.87], MOON_R = 1737.4;
// Saturnringe: C-Ring innen 74.658 km bis A-Ring außen 136.775 km (NASA Saturnian Rings Fact Sheet)
const RING_IN = 74658, RING_OUT = 136775;
const visR = (km, real) => (real ? km / AU_KM : 0.012 * Math.pow(km / 6371, 0.45));

// Äquatorial (α, δ) → Szene (über die Ekliptik)
function poleDir([ra, dec]) {
  const e = OBLIQUITY * RAD;
  const x = Math.cos(dec * RAD) * Math.cos(ra * RAD), y = Math.cos(dec * RAD) * Math.sin(ra * RAD), z = Math.sin(dec * RAD);
  return new THREE.Vector3(...eclToScene([x, y * Math.cos(e) + z * Math.sin(e), -y * Math.sin(e) + z * Math.cos(e)])).normalize();
}

const ORBIT_VERT = /* glsl */ `
attribute float mfrac;
uniform float uPhase;
varying float vA;
void main() {
  float d = fract(uPhase - mfrac);
  vA = 0.16 + 0.84 * pow(1.0 - d, 12.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const ORBIT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
varying float vA;
void main() { gl_FragColor = vec4(uColor * vA * uGain, 1.0); }
`;

// Kleinkörper: Bahnelemente je Punkt, Ort nach Kepler zur Zeit uDays (Tage seit Start)
const BELT_VERT = /* glsl */ `
attribute vec4 el;    // a [AE], e, i [rad], Ω [rad]
attribute vec2 el2;   // ω [rad], M0 [rad]
attribute float bright;
attribute vec2 seed;  // x: Ausdünnen, y: Form und Größe des Brockens
uniform float uDays, uPx, uMag, uKeep, uRef;
varying float vB, vPx, vSeed;
varying vec2 vL;
void main() {
  float a = el.x, e = el.y;
  float M = el2.y + uDays * 0.0172021 / (a * sqrt(a));
  float E = M;
  for (int k = 0; k < 5; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  float xp = a * (cos(E) - e), yp = a * sqrt(1.0 - e * e) * sin(E);
  float co = cos(el2.x), so = sin(el2.x), cO = cos(el.w), sO = sin(el.w), cI = cos(el.z), sI = sin(el.z);
  vec3 ecl = vec3((co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
                  (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
                  so * sI * xp + co * sI * yp);
  vec4 mv = modelViewMatrix * vec4(ecl.x, ecl.z, -ecl.y, 1.0);
  gl_Position = projectionMatrix * mv;
  // vergrößert (Zahnrad „Satelliten und Kleinkörper“): Größe nach Abstand zum Blickziel, betrachteter Gürtel deutlich,
  // Gürtel weit hinter dem Blickziel klein; nur der Anteil uKeep bleibt sichtbar
  float k = mix(1.0, clamp(uRef / max(-mv.z, 1e-4), 0.3, 1.4), smoothstep(1.0, 2.5, uMag));
  // kleine Brocken (seed.y klein) bleiben beim Ausdünnen öfter stehen: viele kleine, wenige große
  float on = seed.x > min(1.0, uKeep * (1.0 + 2.0 * (1.0 - seed.y))) ? 0.0 : 1.0;
  vPx = uPx * 1.3 * mix(1.0, uMag * (0.4 + 1.2 * seed.y * seed.y * seed.y), smoothstep(1.0, 1.5, uMag)) * k;
  gl_PointSize = vPx * on;
  vB = bright * on * min(k, 1.0);
  vSeed = seed.y;
  // Richtung zur Sonne (Ursprung) im Bild, für die Beleuchtung des Brockens; gl_PointCoord zählt y nach unten
  vec4 sc = projectionMatrix * modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 dl = (sc.xy / sc.w - gl_Position.xy / gl_Position.w) * vec2(projectionMatrix[1][1] / projectionMatrix[0][0], 1.0);
  vL = normalize(vec2(dl.x, -dl.y) * sign(sc.w) + 1e-6);
}
`;
const BELT_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vB, vPx, vSeed;
varying vec2 vL;
void main() {
  if (vB <= 0.001) discard;
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  float r = length(p), a = atan(p.y, p.x), ph = vSeed * 40.0;
  // ab etwa 6 Pixeln unregelmäßiger Brocken mit Tag- und Nachtseite statt Lichtpunkt
  float edge = 0.72 + 0.1 * sin(3.0 * a + ph) + 0.06 * sin(5.0 * a + 2.3 * ph) + 0.04 * sin(9.0 * a + 0.7 * ph);
  float aa = 3.0 / max(vPx, 1.0), inside = 1.0 - smoothstep(edge - aa, edge, r);
  vec2 n2 = p / edge;
  vec3 n = vec3(n2, sqrt(max(0.0, 1.0 - dot(n2, n2))));
  float rock = inside * (0.12 + 1.1 * max(0.0, dot(n, normalize(vec3(vL, 0.35)))));
  gl_FragColor = vec4(uColor * vB * mix(exp(-r * r * 3.5), rock * 1.4, smoothstep(4.0, 8.0, vPx)), 1.0);
}
`;

// Planet als Lichtpunkt, solange die Kugel kleiner als ein paar Pixel ist
const DOT_VERT = /* glsl */ `
attribute vec3 color;
attribute float radius;
uniform float uProj, uPx;
varying vec3 vCol;
varying float vFade;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float rp = radius * uProj / max(-mv.z, 1e-6);
  vFade = 1.0 - smoothstep(2.0, 5.0, rp);
  gl_PointSize = uPx * 7.0;
  vCol = color;
}
`;
const DOT_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vFade;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  gl_FragColor = vec4(vCol * (exp(-r2 * 60.0) * 3.0 + exp(-r2 * 10.0) * 0.25) * vFade, 1.0);
}
`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,240,220,1)');
  grd.addColorStop(0.12, 'rgba(255,214,160,0.55)');
  grd.addColorStop(0.35, 'rgba(255,170,90,0.12)');
  grd.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.0005, 600);
  const jd0 = julianDate(ctx.date);
  let jd = jd0, rate = 1, real = false;
  const view = new URLSearchParams(location.search).get('view');   // Screenshots: ?view=sun|saturn|moon|jupole|jupwide|<planet>

  scene.add(createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.8, seed: 23 }));
  const stars = scene.children[0];

  // ---------- Sonne (Shader: sunfx.js) ----------
  // Bewegung reduziert (ctx.still): Brodeln, Korona und Protuberanzen laufen mit 20 % Tempo, keine Flares von selbst
  const ta0 = ctx.still ? 0.2 : 1;
  const sunG = new THREE.Group();
  sunG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleDir(SUN_POLE));
  scene.add(sunG);
  const randS = mulberry32(17);
  const sunMat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: SUN_FRAG, uniforms: {
    tSun: { value: ctx.tex('sun.jpg') }, uGain: { value: 2.2 }, uTime: { value: 0 }, uDays: { value: 0 }, uGran: { value: 1 },
    uFine: { value: ctx.detail > 0.7 ? 1 : 0 }, uSpot: { value: spotGroups(randS) } } });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), sunMat);
  sunG.add(sun);
  const loopG = loopsGeometry(12 + Math.round(6 * ctx.detail), randS);
  const loopU = { uTime: { value: 0 }, uRate: { value: 1 }, uGain: { value: 2.6 }, uBurstT: { value: 1e3 }, uBurstSeed: { value: -1 }, uSunR: { value: 1 }, uSunC: { value: new THREE.Vector3() } };
  const loops = new THREE.Mesh(loopG, new THREE.ShaderMaterial({ vertexShader: LOOP_VERT, fragmentShader: LOOP_FRAG, uniforms: loopU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  loops.frustumCulled = false;
  sunG.add(loops);
  // Korona + Chromosphäre als Bildtafel; Helmstreamer drehen mit der Sonne (Carrington-Periode 25,38 Tage)
  const CORONA_EXT = 6;
  const streamers = streamerSet(randS);
  const coronaU = { uTime: { value: 0 }, uExt: { value: CORONA_EXT }, uSize: { value: 1 }, uGain: { value: 1.0 }, uLimb: { value: 1 }, uCorona: { value: 1 }, uChromo: { value: 2.0 },
    uPole: { value: new THREE.Vector2(0, 1) }, uStr: { value: streamers.map(() => new THREE.Vector3()) } };
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: BILLBOARD_VERT, fragmentShader: CORONA_FRAG, uniforms: coronaU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  corona.frustumCulled = false;
  corona.renderOrder = -1;
  scene.add(corona);
  let coronaOn = true;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(1.0, 0.5, 0.2), opacity: 0.4 }));
  scene.add(glow);
  const flare = createFlare({ strength: 0.45 });
  scene.add(flare);
  // Massenauswurf (Bildtafel mit Front, Kavität, Kern, Stoßfront) und Flare-Blitz am Fußpunkt (Weißlicht-Flare, echt Minuten)
  const cmeU = { uSize: { value: 1 }, uK: { value: 0 }, uGain: { value: 1.1 }, uSide: { value: 1 }, uTime: { value: 0 }, uDir: { value: new THREE.Vector2(1, 0) } };
  const cme = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: BILLBOARD_VERT, fragmentShader: CME_FRAG, uniforms: cmeU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  cme.frustumCulled = false;
  cme.visible = false;
  scene.add(cme);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, color: new THREE.Color(1.6, 1.5, 1.4), opacity: 0 }));
  flash.visible = false;
  scene.add(flash);
  const cmeState = { t: 1e3, dir: new THREE.Vector3(), from: new THREE.Vector3(), foot: new THREE.Vector3() };
  let flareTimer = 18 + randS() * 14, flareRate = 1, flaresOn = true;
  function triggerFlare() {
    const meta = loopG.userData.meta, m = meta[Math.floor(randS() * meta.length)];
    loopU.uBurstT.value = 0; loopU.uBurstSeed.value = m.seed;
    sunG.updateMatrixWorld(true);
    cmeState.from.copy(m.apex).applyMatrix4(loops.matrixWorld);
    cmeState.foot.copy(m.foot).applyMatrix4(loops.matrixWorld);
    cmeState.dir.copy(m.dir).transformDirection(loops.matrixWorld);
    cmeState.t = 0;
    cme.visible = true;
    flash.visible = true;
    flareTimer = (14 + randS() * 26) / flareRate;
  }
  // je Bild: sichtbarer Rand (Perspektive), Pol und Streamer im Bild
  const vS = new THREE.Vector3(), poleV = new THREE.Vector3(), qStr = new THREE.Quaternion(), qRot = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  function coronaFrame(cam) {
    const dist = cam.position.distanceTo(sunG.position) / sr;
    coronaU.uLimb.value = dist > 1.02 ? 1 / Math.sqrt(1 - 1 / (dist * dist)) : 5;
    const view = cam.matrixWorldInverse;
    poleV.copy(Y).applyQuaternion(sunG.quaternion).transformDirection(view);
    const pl = Math.hypot(poleV.x, poleV.y) || 1, px = poleV.x / pl, py = poleV.y / pl;
    coronaU.uPole.value.set(px, py);
    qStr.copy(sunG.quaternion).multiply(qRot.setFromAxisAngle(Y, days() / 25.38 * Math.PI * 2));
    streamers.forEach((s, i) => {
      vS.copy(s.dir).applyQuaternion(qStr).transformDirection(view);
      const l = Math.hypot(vS.x, vS.y);
      coronaU.uStr.value[i].set(Math.atan2(-vS.x * py + vS.y * px, vS.x * px + vS.y * py), s.w, s.amp * (0.3 + 0.7 * l));
    });
  }

  // ---------- Planeten (Shader: planetfx.js) ----------
  const inv = new THREE.Matrix4();
  const planetU = (map, o = {}) => ({
    tMap: { value: map }, tNight: { value: o.night ?? null }, tClouds: { value: o.clouds ?? null }, tSpec: { value: o.spec ?? null }, tRing: { value: o.ring ?? null },
    uHasEarth: { value: o.earth ? 1 : 0 }, uCloudU: { value: 0 }, uGain: { value: 1 }, uRing: { value: o.ring ? 1 : 0 }, uRingIn: { value: 0 }, uRingOut: { value: 0 },
    uInv: { value: o.inv ?? new THREE.Matrix4() }, uWrap: { value: o.wrap ?? 0.02 }, uAmb: { value: 0.025 }, uBand: { value: o.band ?? 0 }, uTime: { value: 0 },
    uMoon: { value: o.moon ? 1 : 0 }, uEarthPos: { value: o.earthPos ?? new THREE.Vector3() }, uEarthshine: { value: o.moon ? 0.012 : 0 },
    uTerm: { value: new THREE.Vector3(...(o.term ?? [1, 0.85, 0.7])) },
  });
  // Stärke des Banddetails (Gasriesen; Venus: Wolkenstreifen)
  const BAND = { jupiter: 1, saturn: 0.6, uranus: 0.2, neptune: 0.45, venus: 0.35 };
  const cloudTex = ctx.tex('earth_clouds.jpg', false);
  const planets = PLANETS.map((p) => {
    const b = BODY[p.id], a = ATMOS[p.id];
    const tilt = new THREE.Group();
    tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleDir(b.pole));
    const isEarth = p.id === 'earth', isSaturn = p.id === 'saturn';
    const earthInv = new THREE.Matrix4();
    const mat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: planetU(ctx.tex(b.tex), {
      night: isEarth ? ctx.tex('earth_nightmap.jpg') : null, clouds: isEarth ? cloudTex : null, spec: isEarth ? ctx.tex('earth_specular.jpg', false) : null,
      ring: isSaturn ? ctx.tex('saturn_ring_alpha.png') : null, earth: isEarth, inv: isSaturn ? inv : isEarth ? earthInv : null,
      wrap: a ? a.wrap : 0.02, term: a ? a.term : undefined, band: BAND[p.id] }) });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), mat);
    tilt.add(mesh);
    const holder = new THREE.Group();
    holder.add(tilt);
    scene.add(holder);
    // Wolken der Erde: eigene Kugel R·1,004 (echt ≈ 10 km über dem Boden, hier ≈ 25 km), driftet gegen den Boden
    let clouds = null;
    if (isEarth) {
      clouds = new THREE.Mesh(new THREE.SphereGeometry(1.004, 128, 64), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: CLOUD_FRAG,
        uniforms: { tClouds: { value: cloudTex }, uSun: { value: new THREE.Vector3() }, uCloudU: { value: 0 }, uTime: { value: 0 }, uGain: { value: 1 }, uOpacity: { value: 0.95 } },
        transparent: true, depthWrite: false }));
      mesh.add(clouds);
    }
    // Atmosphäre als eigene additive Hülle (Strahl-Kugel-Schnitt)
    let shell = null;
    if (a) {
      shell = new THREE.Mesh(new THREE.SphereGeometry(a.ra, 96, 48), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: ATMO_FRAG, uniforms: {
        uSun: { value: new THREE.Vector3() }, uCenter: { value: new THREE.Vector3() }, uBeta: { value: new THREE.Vector3(...a.beta) }, uMieCol: { value: new THREE.Vector3(...a.mieCol) },
        uRp: { value: 1 }, uRa: { value: a.ra }, uH: { value: a.h }, uGain: { value: a.gain }, uMie: { value: a.mie }, uAir: { value: isEarth ? 0.5 : 0 }, uAirH: { value: 0.2 } },
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      holder.add(shell);
    }
    let ring = null, ringMat = null;
    if (isSaturn) {
      const g = new THREE.RingGeometry(RING_IN / b.r, RING_OUT / b.r, 256, 1);
      const pos = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        uv.setXY(i, (v.length() - RING_IN / b.r) / ((RING_OUT - RING_IN) / b.r), 0.5);
      }
      g.rotateX(-Math.PI / 2);
      ringMat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: RING_FRAG, uniforms: { tRing: { value: ctx.tex('saturn_ring_alpha.png') }, uCenter: { value: new THREE.Vector3() }, uR: { value: 1 }, uGain: { value: 1 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false });
      ring = new THREE.Mesh(g, ringMat);
      tilt.add(ring);
    }
    // Bahn: Ellipse aus den Elementen, Parameter = mittlere Anomalie (für die Leuchtspur)
    const el = elementsAt(p, jd0);
    const N = 720, pts = new Float32Array((N + 1) * 3), mf = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const E = (i / N) * Math.PI * 2;
      pts.set(eclToScene(orbitToEcliptic(el, E)), i * 3);
      mf[i] = ((E - el.e * Math.sin(E)) / (Math.PI * 2) + 1) % 1;
    }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    og.setAttribute('mfrac', new THREE.BufferAttribute(mf, 1));
    const om = new THREE.ShaderMaterial({ vertexShader: ORBIT_VERT, fragmentShader: ORBIT_FRAG, uniforms: { uPhase: { value: 0 }, uColor: { value: new THREE.Color(b.dot) }, uGain: { value: 0.9 } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const orbit = new THREE.Line(og, om);
    scene.add(orbit);
    return { p, b, holder, tilt, mesh, mat, ring, ringMat, om, orbit, shell, clouds, earthInv, pos: new THREE.Vector3() };
  });
  const P = Object.fromEntries(planets.map((x) => [x.p.id, x]));
  const jAur = jupiterAurora(ctx.detail);
  P.jupiter.mesh.add(jAur);
  const jP = jAur.userData.parts, jU = jAur.userData.capU;

  // Mond: Ort aus der Almanach-Näherung relativ zur Erde; „Anschaulich“ zieht ihn näher heran, sonst läge er in der vergrößerten Erde
  const moonMat = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: planetU(ctx.tex('moon.jpg'), { moon: true, earthPos: P.earth.pos }) });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), moonMat);
  scene.add(moon);
  const moonPos = moon.position, moonDir = new THREE.Vector3();

  // Lichtpunkte der Planeten
  const dotG = new THREE.BufferGeometry();
  dotG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(planets.length * 3), 3));
  dotG.setAttribute('color', new THREE.BufferAttribute(new Float32Array(planets.flatMap((x) => new THREE.Color(x.b.dot).toArray())), 3));
  dotG.setAttribute('radius', new THREE.BufferAttribute(new Float32Array(planets.length), 1));
  const dotMat = new THREE.ShaderMaterial({ vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, uniforms: { uProj: { value: 500 }, uPx: { value: 1 } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const dots = new THREE.Points(dotG, dotMat);
  dots.frustumCulled = false;
  scene.add(dots);

  // ---------- Kleinkörper ----------
  const rand = mulberry32(5);
  const ray = (s) => Math.abs(gauss(rand)) * s;   // Rayleigh-ähnlich
  const beltObjs = [];
  function belt(n, pick, color, gain) {
    const el = new Float32Array(n * 4), el2 = new Float32Array(n * 2), br = new Float32Array(n), sd = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const o = pick(i);
      el.set([o.a, o.e, o.i, o.node ?? rand() * Math.PI * 2], i * 4);
      el2.set([o.w ?? rand() * Math.PI * 2, o.M ?? rand() * Math.PI * 2], i * 2);
      br[i] = (0.35 + rand() * 0.65) * gain;
      sd.set([(i * 0.6180339887) % 1, (i * 0.7548776662 + 0.5) % 1], i * 2);   // ohne rand(): Verteilung der Gürtel bleibt gleich
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('el', new THREE.BufferAttribute(el, 4));
    g.setAttribute('el2', new THREE.BufferAttribute(el2, 2));
    g.setAttribute('bright', new THREE.BufferAttribute(br, 1));
    g.setAttribute('seed', new THREE.BufferAttribute(sd, 2));
    const m = new THREE.ShaderMaterial({ vertexShader: BELT_VERT, fragmentShader: BELT_FRAG, uniforms: { uDays: { value: 0 }, uPx: { value: 1 }, uMag: { value: 1 }, uKeep: { value: 1 }, uRef: { value: 1 }, uColor: { value: new THREE.Color(color) } }, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    scene.add(pts);
    beltObjs.push(pts);
    return m;
  }
  const detail = ctx.detail;
  // Hauptgürtel 2,1–3,3 AE, Lücken bei den Jupiter-Resonanzen ausgedünnt
  const gaps = [2.502, 2.825, 2.958, 3.279];
  const mainA = () => {
    for (;;) {
      const a = 2.1 + rand() * 1.2;
      const g = Math.min(...gaps.map((x) => Math.abs(a - x)));
      if (g > 0.03 || rand() < g / 0.03 * 0.25) return a;
    }
  };
  const jup = elementsAt(PLANETS[4], jd0);
  const beltMats = [
    belt(Math.round(20000 * detail), () => ({ a: mainA(), e: ray(0.08), i: ray(0.12) }), 0xd8c8b0, 0.55),
    belt(Math.round(1400 * detail), () => ({ a: 3.97 + gauss(rand) * 0.03, e: 0.1 + ray(0.06), i: ray(0.1) }), 0xd8c8b0, 0.5),
    // Trojaner: mittlere Länge 60° vor bzw. hinter Jupiter, gleiche Halbachse
    belt(Math.round(3000 * detail), (i) => {
      const lead = i % 2 ? 60 : -60;
      const node = rand() * Math.PI * 2, w = rand() * Math.PI * 2;
      const L = (jup.L + lead + gauss(rand) * 12) * RAD;
      return { a: 5.2 + gauss(rand) * 0.05, e: ray(0.06), i: ray(0.2), node, w, M: L - node - w };
    }, 0xc8b8a0, 0.5),
    belt(Math.round(8000 * detail), (i) => (i % 5 === 0
      ? { a: 39.4 + gauss(rand) * 0.25, e: 0.1 + ray(0.08), i: ray(0.2) }
      : { a: 42 + rand() * 6, e: ray(0.05), i: ray(0.08) }), 0xa8c0e0, 0.5),
  ];
  const days = () => jd - jd0;

  // ---------- Größen ----------
  let sr = 1;
  function applySizes() {
    sr = visR(SUN_R, real);
    sunG.scale.setScalar(sr);
    coronaU.uSize.value = sr * CORONA_EXT;
    glow.scale.setScalar(sr * 5);
    const rad = dotG.attributes.radius;
    planets.forEach((x, i) => {
      const r = visR(x.b.r, real);
      x.mesh.scale.setScalar(r);
      if (x.shell) { x.shell.scale.setScalar(r); x.shell.material.uniforms.uRp.value = r; x.shell.material.uniforms.uRa.value = r * ATMOS[x.p.id].ra; }
      if (x.ring) { x.ring.scale.setScalar(r); x.mat.uniforms.uRingIn.value = (RING_IN / x.b.r) * r; x.mat.uniforms.uRingOut.value = (RING_OUT / x.b.r) * r; x.ringMat.uniforms.uR.value = r; }
      rad.setX(i, r);
    });
    rad.needsUpdate = true;
    moon.scale.setScalar(visR(MOON_R, real));
  }
  applySizes();

  function place() {
    const dp = dotG.attributes.position;
    planets.forEach((x, i) => {
      const el = elementsAt(x.p, jd);
      const E = solveKepler(el.M * RAD, el.e);
      x.pos.set(...eclToScene(orbitToEcliptic(el, E)));
      x.holder.position.copy(x.pos);
      x.mesh.rotation.y = ((jd - 2451545) * 24 / x.b.rot) % 1 * Math.PI * 2;
      x.om.uniforms.uPhase.value = ((el.M / 360) % 1 + 1) % 1;
      dp.setXYZ(i, x.pos.x, x.pos.y, x.pos.z);
    });
    dp.needsUpdate = true;
    beltMats.forEach((m) => { m.uniforms.uDays.value = days(); });
    planets.forEach((x) => {
      if (!x.shell) return;
      const u = x.shell.material.uniforms;
      u.uCenter.value.copy(x.pos);
      u.uSun.value.copy(x.pos).negate().normalize();
    });
    // Erde: Wolken driften gegen den Boden (≈ 1,4° je Tag, Darstellung); Licht im Kugelsystem für den Wolkenschatten
    const ea = P.earth;
    ea.mat.uniforms.uCloudU.value = days() * 0.004;
    ea.clouds.material.uniforms.uCloudU.value = days() * 0.004;
    ea.clouds.material.uniforms.uSun.value.copy(ea.pos).negate().normalize();
    ea.holder.updateMatrixWorld(true);
    ea.earthInv.copy(ea.mesh.matrixWorld).invert();
    const sat = P.saturn;
    sat.tilt.updateMatrixWorld();
    inv.copy(sat.tilt.matrixWorld).invert();
    sat.ringMat.uniforms.uCenter.value.copy(sat.pos);
    // Mond: Richtung echt, Abstand im Modus „Anschaulich“ auf 2,6 Erdradien (Bild) gezogen
    moonDir.set(...eclToScene(moonPosition(jd)));
    const dist = real ? moonDir.length() / AU_KM : visR(BODY.earth.r, false) * 2.6;
    moonDir.normalize();
    moonPos.copy(P.earth.pos).addScaledVector(moonDir, dist);
    moon.lookAt(P.earth.pos);
    moon.rotateY(-Math.PI / 2);     // Länge 0 (Textur-Mitte) zur Erde (gebundene Rotation)
    loops.rotation.y = days() / 25.0 * Math.PI * 2;
    sunMat.uniforms.uDays.value = days();
    plutoAt.set(...eclToScene(planetPosition(PLUTO, jd)));
  }
  const plutoAt = new THREE.Vector3();
  place();

  const home = { pos: new THREE.Vector3(-3.2, 4.4, 7.4), target: new THREE.Vector3(0, 0, 0) };
  const camDir = home.pos.clone().setY(0).normalize();
  const onBelt = (r) => camDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5).multiplyScalar(r);
  const focus = (x) => () => Math.max(visR(x.b.r, real) * 7, 2e-5);
  const flarePos = new THREE.Vector3(), coronaPos = new THREE.Vector3();
  const sideDir = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
  const hotspots = [
    { id: 'sun', kind: 'dive', to: 'sun', pos: new THREE.Vector3(), focus: () => sr * 4 },
    { id: 'flare', kind: 'info', pos: flarePos, focus: () => sr * 4.5, visible: () => flaresOn },
    { id: 'corona', kind: 'info', pos: coronaPos, focus: () => sr * 8, visible: () => coronaOn },
    { id: 'earth', kind: 'dive', to: 'earth', pos: P.earth.pos },
    { id: 'moon', kind: 'info', pos: moonPos, focus: () => Math.max(visR(MOON_R, real) * 7, 2e-5) },
    { id: 'jupiter', kind: 'dive', to: 'jupiter', pos: P.jupiter.pos, focus: focus(P.jupiter) },
    { id: 'saturn', kind: 'dive', to: 'saturn', pos: P.saturn.pos, focus: () => visR(P.saturn.b.r, real) * 9 },
    { id: 'belt', kind: 'info', pos: onBelt(2.75) },
    { id: 'asteroid', kind: 'dive', to: 'asteroid', pos: onBelt(2.95).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.22) },
    { id: 'kuiper', kind: 'info', pos: onBelt(44) },
    ...['mercury', 'venus'].map((id) => ({ id, kind: 'info', pos: P[id].pos, focus: focus(P[id]) })),
    // je Planet eine Zeile: Abstecher der Etappen E4/E5 (docs/plan_ebenen.md) ändern nur ihre eigene
    { id: 'mars', kind: 'info', pos: P.mars.pos, focus: focus(P.mars) },
    { id: 'uranus', kind: 'dive', to: 'uranus', pos: P.uranus.pos, focus: focus(P.uranus) },
    { id: 'neptune', kind: 'dive', to: 'neptune', pos: P.neptune.pos, focus: focus(P.neptune) },
    { id: 'pluto', kind: 'dive', to: 'pluto', pos: plutoAt },
  ];
  // Screenshot-Hilfe: Heimpose nahe an einem Körper
  if (view) {
    if (view === 'jupole' || view === 'jupwide') {   // Polarlicht von oben nah · Magnetosphäre weit
      const r = visR(P.jupiter.b.r, real), pole = new THREE.Vector3(0, 1, 0).applyQuaternion(P.jupiter.tilt.quaternion), near = view === 'jupole';
      home.target = P.jupiter.pos.clone().addScaledVector(pole, near ? r * 0.55 : 0);
      home.pos = P.jupiter.pos.clone().add(camDir.clone().multiplyScalar(near ? 0.62 : 0.85).addScaledVector(sideDir, 0.3).addScaledVector(pole, near ? 1.05 : 0.42).normalize().multiplyScalar(r * (near ? 3.6 : 15)));
    }
    const tgt = view === 'sun' ? new THREE.Vector3() : view === 'moon' ? moonPos : P[view] ? P[view].pos : null;
    if (tgt) { const r = view === 'sun' ? sr * 3.2 : view === 'moon' ? visR(MOON_R, real) * 7 : visR(P[view].b.r, real) * 6; home.target = tgt.clone(); home.pos = tgt.clone().addScaledVector(camDir, r).addScaledVector(sideDir, r * 0.35).add(new THREE.Vector3(0, r * 0.3, 0)); }
  }

  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' });
  const controls = [
    { id: 'size', label: 'Größen', value: 'vis', options: [['vis', 'Anschaulich'], ['real', 'Echt']], set: (v) => { real = v === 'real'; applySizes(); } },
    { id: 'time', label: 'Zeit', value: 'day', options: [['now', 'Jetzt'], ['day', '1 Tag/s'], ['month', '1 Monat/s'], ['year', '1 Jahr/s']],
      set: (v) => { rate = { now: 0, day: 1, month: 30.44, year: 365.25 }[v]; if (!rate) jd = julianDate(new Date()); } },
  ];

  // ---------- Ebenen (Zahnrad „Station · Sonnensystem“, Zeitleiste) ----------
  const SPEEDS = [[1, '1 Tag/s'], [7, '1 Woche/s'], [30.44, '1 Monat/s'], [365.25, '1 Jahr/s'], [3652.5, '10 Jahre/s']];
  let clockIdx = 0;
  const setVis = (list, v) => list.forEach((o) => { o.visible = v; });
  registerLayers('solar', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Planetenlauf', value: 0, min: 0, max: SPEEDS.length - 1, step: 1, autoplay: true, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (i, playing) => { clockIdx = Math.round(i); rate = playing ? SPEEDS[clockIdx][0] : 0; if (!playing) jd = julianDate(new Date()); },
      get: () => ({ value: clockIdx, playing: rate !== 0 }), status: () => `Planetenstand ${fmt.format(new Date((jd - 2440587.5) * 864e5))}${rate ? '' : ' · jetzt'}` },
    { id: 'flares', type: 'toggle', group: 'Sonne', label: 'Protuberanzen und Flares', value: true, set: (v) => { flaresOn = v; loops.visible = v; if (!v) cme.visible = flash.visible = false; } },
    { id: 'flareRate', type: 'range', label: 'Häufigkeit', value: 1, min: 0.3, max: 3, step: 0.1, unit: '×', sub: true, set: (v) => { flareRate = v; loopU.uRate.value = v; } },
    { id: 'flareNow', type: 'action', label: 'Flare mit Massenauswurf', button: 'Jetzt auslösen', sub: true, run: () => { if (flaresOn) triggerFlare(); } },
    { id: 'corona', type: 'toggle', label: 'Korona', value: true, set: (v) => { coronaOn = v; coronaU.uCorona.value = v ? 1 : 0; } },
    { id: 'gran', type: 'toggle', label: 'Granulation (brodelnde Oberfläche)', value: true, set: (v) => { sunMat.uniforms.uGran.value = v ? 1 : 0; } },
    { id: 'atmos', type: 'toggle', group: 'Planeten und Kleinkörper', label: 'Atmosphären der Planeten', value: true, set: (v) => planets.forEach((x) => { if (x.shell) x.shell.visible = v; }) },
    { id: 'clouds', type: 'toggle', label: 'Wolken der Erde', value: true, sub: true, set: (v) => { P.earth.clouds.visible = v; } },
    { id: 'orbits', type: 'toggle', label: 'Bahnen mit Leuchtspur', value: true, set: (v) => setVis(planets.map((x) => x.orbit), v) },
    { id: 'belts', type: 'toggle', label: 'Kleinkörper: Asteroiden, Trojaner, Kuipergürtel', value: true, set: (v) => setVis(beltObjs, v) },
    { id: 'jOval', type: 'toggle', group: 'Jupiter-Polarlicht', label: 'Hauptoval (UV-Falschfarbe)', value: true, set: (v) => { jP.oval.visible = jP.cap.visible = v; },
      hint: 'Schema: Oval ≈ 14° vom Magnetpol (Dipolneigung 9,6°), Norden nierenförmig, Süden runder. Echt leuchtet es im UV; die Farbe ist Falschfarbe.' },
    { id: 'jSwirl', type: 'toggle', label: 'Polwirbel', value: true, sub: true, set: (v) => { jU.uSwirl.value = v ? 1 : 0; } },
    { id: 'jFlares', type: 'toggle', label: 'Polar-Flares', value: true, sub: true, set: (v) => { jU.uFlare.value = v ? 1 : 0; } },
    { id: 'jFeet', type: 'toggle', label: 'Fußpunkte von Io, Europa, Ganymed', value: true, sub: true, set: (v) => { jU.uFoot.value = v ? 1 : 0; },
      hint: 'Die Monde ziehen Spuren ins Polarlicht; ihr Umlauf ist hier im Zeitraffer, die Lagen sind schematisch.' },
    { id: 'jDisk', type: 'toggle', group: 'Jupiter-Magnetosphäre', label: 'Magnetscheibe mit Spiralarmen', value: true, set: (v) => { jP.disk.visible = v; } },
    { id: 'jLines', type: 'toggle', label: 'Gestreckte Feldlinien', value: true, set: (v) => { jP.lines.visible = v; } },
    { id: 'jFlow', type: 'toggle', label: 'Teilchenströme ins Oval', value: true, set: (v) => { jP.flow.visible = v; } },
  ]);

  const occluders = planets.map((x) => ({ center: x.pos, radius: 1 }));
  const sunWorld = new THREE.Vector3();
  const f2 = (x) => x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtLight = (au) => { const s = au * AU / C; return s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')} min`; };
  let wT = -1;

  return {
    scene, camera, home, unit: AU, hotspots, controls,
    orbit: { minDistance: 0.05, maxDistance: 160, cineSpeed: 0.6 },
    look: { exposure: 1.0, bloom: 0.07 },
    update(dt, t, cam, flying) {
      if (!flying) jd += dt * rate;
      place();
      // im Flug von bzw. zur Erde: Sonne höchstens ≈ 2,5° Radius – sonst füllt die anschaulich vergrößerte Sonne das Bild
      const s = Math.min(visR(SUN_R, real), flying && !real ? cam.position.distanceTo(sunG.position) * 0.045 : Infinity);
      if (sunG.scale.x !== s) { sr = s; sunG.scale.setScalar(s); coronaU.uSize.value = s * CORONA_EXT; glow.scale.setScalar(s * 5); }
      const ta = t * ta0;
      sunMat.uniforms.uTime.value = ta; coronaU.uTime.value = ta; loopU.uTime.value = ta; loopU.uSunR.value = sr;
      planets.forEach((x) => { x.mat.uniforms.uTime.value = ta; });
      P.earth.clouds.material.uniforms.uTime.value = ta;
      jAur.userData.update(t);
      // Flares: Zufallstakt, Aufblitzen der Schleife, Massenauswurf wandert 6 Sonnenradien hinaus
      if (flaresOn && !ctx.still) { flareTimer -= dt; if (flareTimer <= 0) triggerFlare(); }
      loopU.uBurstT.value += dt * ta0;
      cmeState.t += dt * ta0;
      flarePos.copy(sideDir).multiplyScalar(sr * 1.35).add(new THREE.Vector3(0, sr * 0.35, 0));
      coronaPos.copy(sideDir).multiplyScalar(-sr * 2.4).add(new THREE.Vector3(0, sr * 0.9, 0));
      // Nah- und Fernebene mit dem Abstand: von 10.000 km vor einem Planeten bis zum Kuipergürtel ohne Flimmern
      const d = cam.position.length() > 0 ? Math.min(cam.position.distanceTo(sunG.position), cam.position.distanceTo(moonPos), ...planets.map((x) => cam.position.distanceTo(x.pos))) : 1;
      const near = Math.min(0.05, Math.max(2e-6, d * 0.02));
      if (Math.abs(near - camera.near) / camera.near > 0.05) { camera.near = near; camera.updateProjectionMatrix(); }
      const H = ctx.renderer.domElement.height;
      dotMat.uniforms.uProj.value = (H / 2) / Math.tan((camera.fov * RAD) / 2);
      planets.forEach((x, i) => { occluders[i].radius = visR(x.b.r, real); });
      cam.updateMatrixWorld();
      const mag = settings.S.small;
      beltMats.forEach((m) => { m.uniforms.uRef.value = cam.position.length(); m.uniforms.uMag.value = mag; m.uniforms.uKeep.value = keepShare(mag); });
      coronaFrame(cam);
      // Massenauswurf: wächst und verblasst, Front in Ausbreitungsrichtung (im Bild); Flare-Blitz nur auf der sichtbaren Seite
      if (cme.visible) {
        const k = cmeState.t / 9;
        if (k >= 1) cme.visible = false;
        else {
          cme.position.copy(cmeState.from).addScaledVector(cmeState.dir, k * 5 * sr);
          cmeU.uSize.value = sr * (0.45 + 3.4 * k);
          cmeU.uK.value = k; cmeU.uTime.value = ta;
          vS.copy(cmeState.dir).transformDirection(cam.matrixWorldInverse);
          const l = Math.hypot(vS.x, vS.y);
          cmeU.uSide.value = Math.min(1, l * 1.3);
          if (l > 1e-4) cmeU.uDir.value.set(vS.x / l, vS.y / l);
        }
      }
      if (flash.visible) {
        const f = Math.exp(-cmeState.t * 1.4);
        flash.position.copy(cmeState.foot);
        flash.scale.setScalar(sr * (0.14 + 0.3 * (1 - f)));
        const facing = THREE.MathUtils.smoothstep(vS.copy(cam.position).sub(cmeState.foot).dot(cmeState.dir), -0.02 * sr, 0.05 * sr);
        flash.material.opacity = f * facing;
        if (f < 0.01) flash.visible = false;
      }
      // Linsenreflex nur aus der Ferne: nah an der Sonne wäre sein Lichthof größer als die Scheibe
      const far = cam.position.distanceTo(sunG.position) > sr * 7;
      flare.userData.update(sunWorld.set(0, 0, 0), cam, occluders, settings.S.lens && far, dt);
      flare.visible = far;
    },
    widget: () => `<table><thead><tr><th>Planet</th><th>Sonne</th><th>Erde</th><th>Licht</th></tr></thead><tbody id="w-pl"></tbody></table>
      <p class="w-foot">Abstände aus den JPL-Bahnelementen für den angezeigten Zeitpunkt; Lichtlaufzeit von der Erde aus.</p>`,
    widgetTick(el, t) {
      if (t - wT < 0.5) return;
      wT = t;
      const e = P.earth.pos;
      el.querySelector('#w-pl').innerHTML = planets.map((x) => {
        const isE = x.p.id === 'earth', de = x.pos.distanceTo(e);
        return `<tr${isE ? ' class="is-hi"' : ''}><td>${NAME[x.p.id]}</td><td class="num">${f2(x.pos.length())} AE</td><td class="num">${isE ? '–' : `${f2(de)} AE`}</td><td class="num">${isE ? '–' : fmtLight(de)}</td></tr>`;
      }).join('') + `<tr><td>Mond</td><td class="num">${f2(P.earth.pos.length())} AE</td><td class="num">384.400 km</td><td class="num">1,3 s</td></tr>`;
    },
    live: () => `Planetenstand ${fmt.format(new Date((jd - 2440587.5) * 864e5))}${rate ? ' · Zeitraffer' : ' · jetzt'}`,
    setPixelRatio(pr) {
      stars.userData.setPixelRatio(pr);
      dotMat.uniforms.uPx.value = jAur.userData.U.uPx.value = pr;
      beltMats.forEach((m) => { m.uniforms.uPx.value = pr; });
    },
    dispose() { scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); },
  };
}
