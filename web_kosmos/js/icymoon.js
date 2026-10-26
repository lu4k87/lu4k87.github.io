// Station eines Mondes von Jupiter (Ganymed 02C3, Kallisto 02C4) oder Saturn (Titan 02D1, cfg.sys = SATURN_SYS): Globus aus der USGS-Karte (PLANET_FRAG, Mondpfad mit
// Lommel-Seeliger und Jupiterschein), Jupiter am Himmel in echter Richtung, Größe und Phase, Sonne und Sterne zum Zeitpunkt
// (jovian.js, JPL-Mittelwerte). Bezugssystem dreht mit dem Mond: Er dreht gebunden, also stehen er und Jupiter im Bild still;
// Sonne und Sterne ziehen einmal je Umlauf herum (ein Tag auf dem Mond), Jupiter zeigt Phasen, hinter ihm verschwindet die
// Sonne (Finsternis im Jupiterschatten), vor ihm wirft der Mond seinen Schatten auf die Wolken.
// Achsen am Mond (Einheit = Mondradius): +y Pol der Laplace-Ebene, −x zu Jupiter (0° Länge), −z in Flugrichtung (vorangehende
// Seite, 90° W). Karten (USGS, db3b25f): u = östliche Länge / 360, geprüft an Koordinaten des Gazetteers.
// Modell: Libration (e = 0,001 bzw. 0,007) und Achsneigung des Mondes vernachlässigt, Jupiter ohne Atmosphärenhülle (nur Lichtsaum
// im Gegenlicht), Jupiterschein verstärkt (SHINE_X), Feinstruktur beim Heranzoomen als Rauschen.
// Das Planetensystem steckt im Adapter cfg.sys (JUPITER_SYS, SATURN_SYS): Bahnzeilen, Zustand, Schattenlinie, Planet am Himmel.

import * as THREE from 'three';
import { julianDate, eclDir, equToScene, laplaceAxes } from './astro.js';
import { createStarfield } from './stars.js';
import { BODY_VERT, PLANET_FRAG, ATMOS } from './planetfx.js';
import { NOISE } from './glsl.js';
import { GALILEAN, JUPITER, jovianState, lineOfSun } from './jovian.js';
import { MOONS, SATURN, kronianState, lineOfSun as satLineOfSun } from './kronian.js';
import { createSaturn } from './levels/saturn.js';
import { registerLayers, refreshLayers } from './layers.js';

const RAD = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
// Zeitraffer [Tage je Sekunde]
const SPEEDS = [[0, 'Stopp'], [1 / 144, '10 min/s'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s']];
const P_JUP = 0.538;     // geometrische Albedo Jupiters (nasa-jupiter-fs)
const P_SAT = 0.499;     // geometrische Albedo Saturns (NSSDCA Saturn Fact Sheet; die Ringe leuchten zusätzlich, hier außer Acht)
const SHINE_X = 6;       // Jupiterschein verstärkt (echt ≈ 0,2 % des Sonnenlichts bei Ganymed)
const SUN_D = 2500;      // Abstand des Sonnen-Sprites [Mondradien], nur Darstellung
const fmtDate = (jd) => `${new Date((jd - 2440587.5) * 864e5).toLocaleString('de-DE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UT`;

// Ort auf der Kugel aus planetographischer Breite und westlicher Länge [°] (Gazetteer: +West, 0–360)
export function surf(lat, west, r = 1) {
  const e = (360 - west) * RAD, c = Math.cos(lat * RAD);
  return new THREE.Vector3(-Math.cos(e) * c, Math.sin(lat * RAD), Math.sin(e) * c).multiplyScalar(r);
}

// Oberfläche: PLANET_FRAG mit drei Einschüben – Ansicht (0 Messbild grau, 1 Tönung nach Farbaufnahmen, 2 Gelände: dunkle
// Gebiete warm, helles Eis kühl, Grenze uSplit), Rauschen als Feinstruktur erst, wenn ein Kartenpunkt größer als ein Bildpunkt
// wird, und der Schnitt (Viertelkeil zwischen den Ebenen mit Normalen uCutA, uCutB fällt weg)
const MOON_ALB = /* glsl */ `
vec3 moonAlb(vec3 t) {
  float g = dot(t, vec3(0.299, 0.587, 0.114));
  float fade = 1.0 - smoothstep(0.0012, 0.0035, length(fwidth(vO)));
  if (fade > 0.0) g *= 1.0 + fbm(vO * 140.0, 3) * 0.3 * fade;
  if (uView < 0.5) return vec3(g);
  if (uView < 1.5) return g * mix(uTintD, uTintB, smoothstep(0.12, 0.62, g));
  return g * mix(vec3(1.3, 0.82, 0.48), vec3(0.7, 0.96, 1.32), smoothstep(uSplit - 0.05, uSplit + 0.05, g));
}`;
const MOON_FRAG = [
  ['uniform sampler2D tMap,', 'uniform float uView, uSplit, uCut;\nuniform vec3 uTintD, uTintB, uCutA, uCutB;\nuniform sampler2D tMap,'],
  ['void main() {', `${MOON_ALB}\nvoid main() {\n  if (uCut > 0.5 && dot(vO, uCutA) > 0.0 && dot(vO, uCutB) > 0.0) discard;`],
  ['vec3 alb = texture2D(tMap, uv).rgb', 'vec3 alb = moonAlb(texture2D(tMap, uv).rgb)'],
].reduce((s, [a, b]) => {
  if (!s.includes(a)) throw new Error(`icymoon.js: PLANET_FRAG ohne „${a}“ – Einschub anpassen`);
  return s.replace(a, b);
}, PLANET_FRAG);

// Schnittflächen: Schichten nach Radius (uR absteigend, uC Farbe, uF Strömung im Ozean), feine Linie an jeder Grenze,
// gleichmäßig aufgehellt (Schaubild, auch auf der Nachtseite lesbar)
const CUT_VERT = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const CUT_FRAG = /* glsl */ `
uniform float uR[6], uF[6], uTime;
uniform vec3 uC[6], uSun, uNrm;
uniform int uN;
varying vec3 vW;
${NOISE}
void main() {
  float r = length(vW), edge = 1.0, f = uF[0];
  vec3 col = uC[0];
  for (int i = 1; i < 6; i++) {
    if (i >= uN) break;
    if (r < uR[i]) { col = uC[i]; f = uF[i]; }
    edge = min(edge, abs(r - uR[i]));
  }
  col *= 0.88 + 0.24 * fbm(vW * 16.0, 3);
  col *= 1.0 + f * 0.35 * fbm(vW * 26.0 + vec3(0.0, uTime * 0.04, 0.0), 2);
  col = mix(col, col * 0.4, 1.0 - smoothstep(0.0, fwidth(r) * 1.5, edge));
  gl_FragColor = vec4(col * (0.6 + 0.4 * max(dot(uNrm, uSun), 0.0)), 1.0);
}
`;

// Lichtsaum um Jupiter im Gegenlicht (Dunst der Hochatmosphäre streut nach vorn; Modell): Ring knapp außerhalb der Scheibe
const HALO_FRAG = /* glsl */ `
uniform float uK;
varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0) * 1.3;
  float a = (exp(-pow((r - 1.0) / 0.016, 2.0)) * 0.8 + exp(-max(r - 1.0, 0.0) / 0.05) * 0.25) * step(0.985, r);
  gl_FragColor = vec4(vec3(1.0, 0.88, 0.72) * a * uK, 1.0);
}
`;
const HALO_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.08, 'rgba(255,246,228,0.9)');
  grd.addColorStop(0.3, 'rgba(255,214,160,0.18)');
  grd.addColorStop(1, 'rgba(255,200,140,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Uniforms für PLANET_FRAG (wie solar.js planetU) + Sonnenrichtung und Finsternisse
const bodyU = (map, o = {}) => ({
  tMap: { value: map }, tNight: { value: null }, tClouds: { value: null }, tSpec: { value: null }, tRing: { value: null },
  uHasEarth: { value: 0 }, uCloudU: { value: 0 }, uGain: { value: o.gain ?? 1 }, uRing: { value: 0 }, uRingIn: { value: 0 }, uRingOut: { value: 0 },
  uInv: { value: new THREE.Matrix4() }, uWrap: { value: o.wrap ?? 0 }, uAmb: { value: o.amb ?? 0.01 }, uBand: { value: o.band ?? 0 }, uTime: { value: 0 },
  uMoon: { value: o.moon ? 1 : 0 }, uEarthPos: { value: o.earthPos ?? new THREE.Vector3() }, uEarthshine: { value: 0 },
  uTerm: { value: new THREE.Vector3(...(o.term ?? [1, 0.85, 0.7])) }, uSunDir: { value: o.sunDir }, uSunAng: { value: 0 },
  uOcc: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, uOccN: { value: 1 },
});

// ---------- Planetensysteme ----------
// Adapter: planet {r, rp, pole}, els (Bahnzeilen), state(jd, ids) → { sun, sunKm, sunAng, moons }, line(st, id) → { s, q },
// albedo, id/name (Hotspot, Beschriftungen), halo (Lichtsaum), build(ctx, { sunL, rP }) → { group, frame(jupL, qToMoon, jd, t, sunAng) };
// group liegt im Mond-Bezugssystem, rP = Planetradius in Mondradien
const JUPITER_SYS = {
  id: 'jupiter', name: 'Jupiter', planet: JUPITER, els: GALILEAN, state: jovianState, line: lineOfSun, albedo: P_JUP, halo: true,
  build(ctx, { sunL, rP }) {
    const jupU = bodyU(ctx.tex('jupiter.jpg'), { band: 1, wrap: ATMOS.jupiter.wrap, term: ATMOS.jupiter.term, amb: 0.004, sunDir: sunL });
    jupU.uOcc.value[0].set(0, 0, 0, 1);
    const group = new THREE.Group();
    const jup = new THREE.Mesh(new THREE.SphereGeometry(rP, 96, 64), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: jupU }));
    jup.scale.y = JUPITER.rp / JUPITER.r;
    group.add(jup);
    const qPole = new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(...equToScene(...JUPITER.pole)));
    const qSpin = new THREE.Quaternion();
    return {
      group, uniforms: jupU,
      frame(pos, qToMoon, jd, t, sunAng) {
        group.position.copy(pos);
        group.quaternion.copy(qToMoon).multiply(qPole);
        jup.quaternion.copy(qSpin.setFromAxisAngle(Y, 2 * Math.PI * (((jd * 24) / JUPITER.rot) % 1)));
        jupU.uSunAng.value = sunAng;
        jupU.uTime.value = t;
      },
    };
  },
};
// Saturn: createSaturn (Ellipsoid, Ringe mit Schatten auf Saturn und Mond, Hexagon) im Mondmaß; der Mond (Radius 1, im Ursprung)
// wirft seinen Schatten auf Saturn und Ringe
export const SATURN_SYS = {
  id: 'saturn', name: 'Saturn', planet: SATURN, els: MOONS, state: kronianState, line: satLineOfSun, albedo: P_SAT, halo: false,
  build(ctx, { rP }) {
    const group = new THREE.Group(), sat = createSaturn(ctx);
    sat.group.scale.setScalar(rP);
    group.add(sat.group);
    const occ = [new THREE.Vector4(0, 0, 0, 1)];
    return {
      group, uniforms: sat.planetU,
      frame(pos, qToMoon, jd, t, sunAng, sunL) {
        group.position.copy(pos);
        group.quaternion.copy(qToMoon);
        group.updateMatrixWorld(true);
        sat.frame(sunL, jd, occ, sunAng);
      },
    };
  },
};

// Halbscheibe in der Ebene (u, Y) auf der Seite +u – Schnittfläche des Keils
function halfDisc(u) {
  const n = 96, pos = [0, 0, 0];
  for (let k = 0; k <= n; k++) {
    const t = -Math.PI / 2 + (Math.PI * k) / n;
    pos.push(u.x * Math.cos(t), Math.sin(t), u.z * Math.cos(t));
  }
  const idx = [];
  for (let k = 1; k <= n; k++) idx.push(0, k, k + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// Keil-Ausschnitt für Ebenen über dem Boden (Ringe, Polarlicht): uniform uCut, uCutA, uCutB + vO (Ort am Mond)
export const CUT_DISCARD = 'if (uCut > 0.5 && dot(vO, uCutA) > 0.0 && dot(vO, uCutB) > 0.0) discard;';

// cfg: id, tex, seed, gain, tint [dunkel, hell], split, views {grau, farbe, gelaende: Erklärzeile}, home {j, s, y, dist, t},
// features [{ id, lat, west, focus, r?, when? }], interior [{ r, c: [r,g,b], f? }] + oceanR, eclLead [d], horizon [d],
// sys (JUPITER_SYS | SATURN_SYS), speeds [[Tage/s, Name]] + speed0 (Startstufe), scanDiv (Suchschritt = Umlauf / n),
// viewKeys (Teil von grau/farbe/gelaende), extra(ctx, api) → { layers, controls, hotspots, update(dt, t, jd, cam), live() }
export function createIcyMoon(ctx, cfg) {
  const sys = cfg.sys ?? JUPITER_SYS, PL = sys.planet, SPD = cfg.speeds ?? SPEEDS;
  const el = sys.els[cfg.id], R = el.r;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 6000);
  const pole = new THREE.Vector3(...laplaceAxes(el.ra, el.dec).z);
  const jd0 = julianDate(ctx.date), rJ = PL.r / R;
  const shineBase = 1.8 * sys.albedo * (PL.r / el.a) ** 2 * SHINE_X;
  let days = 0;

  // ---------- Bezugssystem zum Zeitpunkt jd: Szene (Ekliptik) → Mond (dreht mit) ----------
  const toMoon = new THREE.Matrix4(), qToMoon = new THREE.Quaternion();
  const xA = new THREE.Vector3(), zA = new THREE.Vector3(), mv = new THREE.Vector3(), sv = new THREE.Vector3(), tv = new THREE.Vector3();
  const sunL = new THREE.Vector3(), jupL = new THREE.Vector3();
  const frame = { sunAng: 0, phase: 0, shadow: false };
  function solve(jd) {
    const st = sys.state(jd, [cfg.id]);
    mv.set(...st.moons[cfg.id]);                                      // Jupiter → Mond [km]
    xA.copy(mv).addScaledVector(pole, -mv.dot(pole)).normalize();     // weg von Jupiter
    zA.crossVectors(xA, pole);
    toMoon.makeBasis(xA, pole, zA).transpose();
    qToMoon.setFromRotationMatrix(toMoon);
    tv.set(...st.sun);
    sunL.copy(tv).multiplyScalar(st.sunKm).sub(mv).normalize().applyMatrix4(toMoon);
    jupL.copy(mv).negate().applyMatrix4(toMoon).divideScalar(R);
    frame.sunAng = st.sunAng;
    frame.phase = (1 + mv.normalize().dot(tv)) / 2;                   // beleuchteter Anteil der Jupiterscheibe, vom Mond aus
    const l = sys.line(st, cfg.id);
    frame.shadow = l.s < 0 && l.q < 1;
  }
  solve(jd0);

  // ---------- Sterne (Fernebene) drehen mit: skyPosition() kennt keine Modellmatrix → eigene Drehung im Vertex-Shader ----------
  const stars = createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.8, seed: cfg.seed });
  const skyRot = { value: new THREE.Matrix3() };
  stars.traverse((o) => {
    const m = o.material;
    if (!m || !m.vertexShader || !m.vertexShader.includes('= skyPosition(')) return;
    m.vertexShader = m.vertexShader.replace(/= skyPosition\(/g, '= skyPosition(uSkyRot * ').replace('void main', 'uniform mat3 uSkyRot;\nvoid main');
    m.uniforms.uSkyRot = skyRot;
    m.needsUpdate = true;
  });
  scene.add(stars);

  // ---------- Sonne: Glanz-Sprite in Sonnenrichtung (Scheibe von Jupiter aus 0,1°) ----------
  const glow = glowTexture();
  const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff1d6, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sunSpr.scale.setScalar(SUN_D * 0.045);
  scene.add(sunSpr);

  // ---------- Planet: echte Richtung, Größe, Abplattung, Drehung, Phase; Mondschatten auf Wolken (und Ringen) ----------
  const planet = sys.build(ctx, { sunL, rP: rJ });
  scene.add(planet.group);
  const haloU = { uK: { value: 0 } };
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6 * rJ, 2.6 * rJ), new THREE.ShaderMaterial({ vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, uniforms: haloU,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.visible = sys.halo;
  scene.add(halo);

  // ---------- Mond ----------
  const moonU = Object.assign(bodyU(ctx.tex(cfg.tex), { moon: true, gain: cfg.gain, amb: 0.045, earthPos: jupL, sunDir: sunL }), {
    uView: { value: 0 }, uSplit: { value: cfg.split }, uCut: { value: 0 }, uTintD: { value: new THREE.Vector3(...cfg.tint[0]) },
    uTintB: { value: new THREE.Vector3(...cfg.tint[1]) }, uCutA: { value: new THREE.Vector3() }, uCutB: { value: new THREE.Vector3() },
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: MOON_FRAG, uniforms: moonU }));
  scene.add(moon);

  // ---------- Heimpose: hinter dem Mond (von Jupiter abgewandt) und darüber, Jupiter rechts über dem Rand (frei von der
  // Infotafel); das Licht kommt so, wie die Sonne zum Zeitpunkt steht, der Tageslauf zieht die Schattengrenze weiter ----------
  const J = jupL.clone().normalize(), right = new THREE.Vector3().crossVectors(J, Y).normalize();
  const H = cfg.home;
  const dCam = J.clone().multiplyScalar(-H.j).addScaledVector(right, H.s).addScaledVector(Y, H.y).normalize();
  const toJ = J.clone().addScaledVector(dCam, -J.dot(dCam)).normalize();
  const home = { pos: dCam.clone().multiplyScalar(H.dist), target: toJ.clone().multiplyScalar(H.t) };

  // ---------- Schnitt: Viertelkeil schräg zur Heimpose, zwei Halbscheiben mit den Schichten ----------
  const w = dCam.clone().setY(0).normalize().applyAxisAngle(Y, 35 * RAD);   // etwas zur Seite: Schnitt und Oberfläche zugleich
  const cutA = w.clone().applyAxisAngle(Y, Math.PI / 4), cutB = w.clone().applyAxisAngle(Y, -Math.PI / 4);
  moonU.uCutA.value.copy(cutA);
  moonU.uCutB.value.copy(cutB);
  const L = cfg.interior;
  const cutU = (nrm) => ({ uR: { value: L.map((l) => l.r).concat([0, 0, 0, 0, 0, 0]).slice(0, 6) }, uF: { value: L.map((l) => l.f || 0).concat([0, 0, 0, 0, 0, 0]).slice(0, 6) },
    uC: { value: L.map((l) => new THREE.Vector3(...l.c)).concat(Array.from({ length: 6 }, () => new THREE.Vector3())).slice(0, 6) },
    uN: { value: L.length }, uTime: { value: 0 }, uSun: { value: sunL }, uNrm: { value: nrm } });
  const cut = new THREE.Group();
  for (const [u, n] of [[cutB, cutA], [cutA, cutB]]) {
    cut.add(new THREE.Mesh(halfDisc(u), new THREE.ShaderMaterial({ vertexShader: CUT_VERT, fragmentShader: CUT_FRAG, uniforms: cutU(n), side: THREE.DoubleSide })));
  }
  cut.visible = false;
  scene.add(cut);
  const inWedge = (p) => cut.visible && p.dot(cutA) > 0 && p.dot(cutB) > 0;
  // Ozean-Abzeichen auf der Schnittfläche, die zur Heimpose zeigt: [Normale, Richtung in der Fläche]
  const oceanFace = dCam.dot(cutA) > dCam.dot(cutB) ? [cutA, cutB] : [cutB, cutA];

  // ---------- Zeit, Ereignisse ----------
  let spdIdx = cfg.speed0 ?? 2, dayOn = !ctx.still, note = '', noteT = 0;
  const jdNow = () => jd0 + days;
  // erster Zeitpunkt ab jd, an dem pred wahr wird (Schritt P/240, Eintritt auf ≈ 1 s genau)
  function scan(pred, horizon) {
    const jd = jdNow(), step = el.P / (cfg.scanDiv ?? 240);
    let was = pred(jd);
    for (let t = jd + step; t < jd + horizon; t += step) {
      const now = pred(t);
      if (now && !was) {
        let lo = t - step, hi = t;
        for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (pred(m)) hi = m; else lo = m; }
        return hi;
      }
      was = now;
    }
    return null;
  }
  const eclipsed = (t) => { const l = sys.line(sys.state(t, [cfg.id]), cfg.id); return l.s < 0 && l.q < 1; };
  const transit = (t) => { const l = sys.line(sys.state(t, [cfg.id]), cfg.id); return l.s > 0 && l.q < 1; };
  function jump(pred, what) {
    const t = scan(pred, cfg.horizon);
    if (t === null) note = `kein${what === 'Finsternis' ? 'e' : ''} ${what} bis ${fmtDate(jdNow() + cfg.horizon)}`;
    else { days = t - cfg.eclLead - jd0; spdIdx = 1; dayOn = true; note = `${what} ab ${fmtDate(t)}`; }
    noteT = 12;
    refreshLayers();
  }
  const jumpEclipse = () => jump(eclipsed, 'Finsternis');
  const jumpTransit = () => jump(transit, 'Schattendurchgang');

  // ---------- Erweiterungen der Station (Magnetfeld, Becken …) ----------
  const ext = cfg.extra ? cfg.extra(ctx, { scene, moon, sunL, jupL, inWedge, jdNow, homeDir: dCam, cutU: { uCut: moonU.uCut, uCutA: moonU.uCutA, uCutB: moonU.uCutB } }) : {};

  // ---------- Ebenen (Zahnrad „Station · …“, Zeitleiste) ----------
  registerLayers(cfg.id, [
    { id: 'day', type: 'play', group: 'Zeit', label: 'Tageslauf im Zeitraffer', value: spdIdx, min: 1, max: SPD.length - 1, step: 1, autoplay: !ctx.still,
      fmt: (i) => SPD[Math.round(i)][1], set: (i, playing) => { spdIdx = Math.round(i); dayOn = playing; }, get: () => ({ value: spdIdx, playing: dayOn }),
      status: () => [dayOn ? `Zeitraffer ${SPD[spdIdx][1]}` : 'angehalten', fmtDate(jdNow()), frame.shadow ? `im ${sys.name}schatten` : '', note].filter(Boolean).join(' · ') },
    ...(ext.layers || []),
    { id: 'cut', type: 'toggle', group: 'Innerer Aufbau', label: 'Schnitt durch den Mond (schematisch)', value: false, set: (v) => { cut.visible = v; moonU.uCut.value = v ? 1 : 0; } },
    { id: 'ecl', type: 'action', group: 'Ereignisse', label: `Finsternis im ${sys.name}schatten`, button: 'Zur nächsten', run: jumpEclipse },
    { id: 'transit', type: 'action', label: `Eigener Schatten auf ${sys.name}`, button: 'Zum nächsten', run: jumpTransit },
  ]);

  // ---------- Infotafel ----------
  const VIEWS_ALL = [
    ['grau', 'Messbild', 'radial-gradient(circle, #e2e2e2 0%, #8c8c8c 55%, #2a2a2a 100%)'],
    ['farbe', 'Tönung', 'radial-gradient(circle, #eadfcd 0%, #9a8064 55%, #34271b 100%)'],
    ['gelaende', 'Gelände', 'linear-gradient(135deg, #a8642e 0%, #a8642e 49%, #9fd8f2 51%, #9fd8f2 100%)'],
  ];
  const VIEWS = VIEWS_ALL.filter((v) => cfg.views[v[0]]);
  const controls = [
    { id: 'view', type: 'swatch', label: 'Ansicht', value: VIEWS[0][0], options: VIEWS.map((v) => [v[0], cfg.viewNames?.[v[0]] ?? v[1], v[2]]), detail: (v) => `<p class="sw-cap">${cfg.views[v]}</p>`,
      set: (v) => { moonU.uView.value = Math.max(0, VIEWS_ALL.findIndex((x) => x[0] === v)); } },
    ...(ext.controls || []),
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: spdIdx, min: 0, max: SPD.length - 1, step: 1, fmt: (i) => SPD[Math.round(i)][1],
      set: (v) => { if (v) { spdIdx = v; dayOn = true; } else dayOn = false; refreshLayers(); }, get: () => (dayOn ? spdIdx : 0) },
    { id: 'ecl', type: 'action', label: 'Ereignis', button: 'Nächste Finsternis', run: jumpEclipse },
  ];

  // ---------- Abzeichen ----------
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const facing = (p, cam) => tmp.copy(cam.position).sub(p).normalize().dot(tmp2.copy(p).normalize());
  // verdeckt der Mond den Punkt p (Sichtlinie Kamera → p schneidet die Einheitskugel)?
  const hidden = (p, cam) => {
    const o = cam.position, d = tmp.copy(p).sub(o), len = d.length();
    d.divideScalar(len);
    const t = -o.dot(d);
    return t > 0 && t < len && tmp2.copy(o).addScaledVector(d, t).length() < 1;
  };
  const hotspots = [
    ...cfg.features.map((f) => {
      const pos = surf(f.lat, f.west, f.r ?? 1.0);
      return { id: f.id, kind: 'info', pos, focus: () => f.focus, visible: (cam) => (!f.when || f.when()) && facing(pos, cam) > 0.08 && !inWedge(pos) };
    }),
    ...(ext.hotspots || []),
    { id: 'ocean', kind: 'info', pos: oceanFace[1].clone().multiplyScalar(Math.cos(20 * RAD)).addScaledVector(Y, Math.sin(20 * RAD)).multiplyScalar(cfg.oceanR),
      focus: () => 0.8, visible: (cam) => cut.visible && tmp.copy(cam.position).dot(oceanFace[0]) > 0 },
    { id: sys.id, kind: 'info', pos: jupL.clone(), visible: (cam) => !hidden(jupL, cam) },
  ];
  const jupHs = hotspots[hotspots.length - 1];

  // ---------- je Bild ----------
  const vC = new THREE.Vector3();
  function apply(t) {
    const jd = jdNow();
    solve(jd);
    skyRot.value.setFromMatrix4(toMoon);
    sunSpr.position.copy(sunL).multiplyScalar(SUN_D);
    planet.frame(jupL, qToMoon, jd, t, frame.sunAng, sunL);
    moonU.uSunAng.value = frame.sunAng;
    moonU.uOcc.value[0].set(jupL.x, jupL.y, jupL.z, rJ);
    moonU.uEarthshine.value = shineBase * frame.phase;
    jupHs.pos.copy(jupL);
    cut.children.forEach((m) => { m.material.uniforms.uTime.value = t; });
  }
  apply(0);

  const look = { exposure: 1.0, bloom: 0.06 };
  return {
    scene, camera, home, unit: R * 1e3, hotspots, controls, look,
    orbit: { minDistance: 0.05, maxDistance: 40, cineSpeed: 0.5 },
    update(dt, t, cam, flying) {
      if (!flying && dayOn) days += dt * SPD[spdIdx][0];
      if (noteT > 0 && (noteT -= dt) <= 0) note = '';
      apply(t);
      // Nahebene mit dem Abstand zur Oberfläche
      const nr = THREE.MathUtils.clamp((cam.position.length() - 1) * 0.2, 0.004, 0.05);
      if (Math.abs(nr - camera.near) / camera.near > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
      // Lichtsaum: nur wenn die Sonne (von der Kamera aus) hinter dem Planeten steht
      halo.position.copy(jupL);
      halo.quaternion.copy(cam.quaternion);
      const dist = vC.copy(jupL).sub(cam.position).length(), rho = Math.asin(Math.min(1, rJ / dist));
      haloU.uK.value = THREE.MathUtils.smoothstep(sunL.dot(vC.divideScalar(dist)), Math.cos(2.5 * rho), Math.cos(0.6 * rho));
      if (ext.update) ext.update(dt, t, jdNow(), cam);
    },
    // Kamera bleibt über der Oberfläche
    orbitUpdate(c) {
      const r = c.object.position.length();
      if (r < 1.02) c.object.position.multiplyScalar(1.02 / r);
    },
    live: () => [dayOn ? `Tageslauf ${SPD[spdIdx][1]}` : 'Zeit angehalten', fmtDate(jdNow()), ext.live ? ext.live() : ''].filter(Boolean).join(' · '),
    setPixelRatio(pr) { stars.userData.setPixelRatio(pr); },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      glow.dispose();
    },
  };
}
