// Station 02H: Pluto & Charon (Einheit 1 Plutoradius = 1.188 km), Abstecher vom Sonnensystem. Doppelsystem: beide umkreisen
// in 6,387 Tagen den gemeinsamen Schwerpunkt im Ursprung; er liegt 2.126 km von Plutos Mitte, also außerhalb Plutos (eigene
// Rechnung aus Massen und Abstand im Fact Sheet). Doppelt gebunden: Länge 0° beider Körper zeigt stets zum Partner. Ort
// Charons aus den mittleren JPL-Elementen (PLU060, Pluto-Äquatorsystem, Pol α 132,99° δ −6,16°), kleine Monde ebenso, aber um
// den Schwerpunkt; Sonnenrichtung aus der Bahn Plutos (astro.js PLUTO). Oberflächen: USGS-Mosaike aus den LORRI-Bildern von
// New Horizons (Graustufen, 2.048 px, Längen ostwärts, 0° am linken Rand); die Farbe ist ein Modell nach den MVIC-Farbbildern,
// die Helligkeit bleibt die gemessene. Gebiete ohne Daten (Süden, 2015 im Dunkeln) zeigen ein Gradnetz statt erfundener
// Oberfläche. Dunst: Hülle bis 0,2 Plutoradien, Lagen als Modell, Vorwärtsstreuung blau (im Gegenlicht hell). New Horizons:
// Bahn 2015 schematisch aus den Eckdaten (14.07.2015 11:49 UT, 12.500 km über Pluto, ≈ 14 km/s als Richtwert, Anflug von der
// Tagseite über das Herz, danach durch Plutos Schatten).

import * as THREE from 'three';
import { PLUTO, julianDate, elementsAt, solveKepler, orbitToEcliptic, eclToScene, eclDir, laplacePos, laplaceAxes } from '../astro.js';
import { createStarfield } from '../stars.js';
import { BODY_VERT, SHELL_VERT } from '../planetfx.js';
import { registerLayers, refreshLayers } from '../layers.js';
import { spinAxis } from '../axes.js';

const RAD = Math.PI / 180;
const R_P = 1188, R_C = 606;                  // Radien [km] (nssdc-pluto)
const Q = 1.586e21 / 1.303e22;                // Massenverhältnis Charon : Pluto ≈ 0,122 (nssdc-pluto)
const POLE = [132.993, -6.163];               // Pol α, δ [°] (nssdc-pluto)
// Mittlere Elemente (JPL sats/elem, PLU060, J2000) im Pluto-Äquatorsystem; Charon: Abstand zu Pluto, kleine Monde: Abstand
// zum Schwerpunkt (nssdc-pluto); Knoten von Kerberos und Hydra laufen rückwärts (Vorzeichen wie in astro.js)
const CHARON = { a: 19596, e: 0, w: 0, M: 304.1, i: 0, node: 0, P: 6.387222 };
const MOONS = [
  { a: 42413, e: 0.025, w: 322.5, M: 358.1, i: 0, node: 0, P: 20.16 },                 // Styx
  { a: 48690, e: 0.015, w: 31.4, M: 338.2, i: 0, node: 0, P: 24.85 },                  // Nix
  { a: 57750, e: 0.010, w: 32.1, M: 276.1, i: 0.4, node: 314.3, P: 32.17, Pn: -9 },    // Kerberos
  { a: 64721, e: 0.009, w: 139.3, M: 335.0, i: 0.3, node: 114.3, P: 38.20, Pn: -14 },  // Hydra
];
// New Horizons: größte Annäherung (nasa-newhorizons), Abstand zur Mitte [R_P], Tempo [R_P/Tag] (Richtwert), Winkel der
// Flugrichtung gegen die Sonnenrichtung (Modell: so kreuzt die Bahn eine Stunde danach Plutos Schatten)
const NH_T = julianDate(new Date(Date.UTC(2015, 6, 14, 11, 49)));
const NH_B = (R_P + 12500) / R_P, NH_V = 13.8 * 86400 / R_P, NH_TH = 15 * RAD, NH_SPAN = 0.12;
// Zeitraffer [Tage je Sekunde]
const SPEEDS = [[0, 'Stopp'], [1 / 144, '10 min/s'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s']];
// Farbmodell je Körper (sRGB, nach MVIC): dunkel → mittel → hell, Polkappe (Pluto gelblich-grau, Charon rötlich)
const TINT = {
  pluto: { dark: '#5c3426', mid: '#c4925f', bright: '#f1e9dc', pole: '#cbbd98', poleK: 0.6 },
  charon: { dark: '#77716b', mid: '#a7a29b', bright: '#d9d6d0', pole: '#8c4c33', poleK: 1 },
};
const fmtDate = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

// Eisoberfläche: Graustufen-Karte (Daten 16…255, 0 = keine Daten) → Helligkeit gemessen, Farbton als Modell; Licht aus
// Lambert und Lommel-Seeliger gemischt (Eis streut stärker zurück als Gestein); Kern- und Halbschatten des Partners aus dem
// Überlapp der Sonnenscheibe; Nachtseite schwach vom Partner beleuchtet (Pluto- bzw. Charonschein, aufgehellt)
const ICE_FRAG = /* glsl */ `
uniform sampler2D tMap;
uniform vec3 uSunDir, uOther, uDark, uMid, uBright, uPoleCol;
uniform float uOtherR, uSunAng, uGain, uColor, uGrid, uPoleK, uShine, uAmb;
varying vec3 vN, vP, vO;
varying vec2 vUv;
void main() {
  float t = texture2D(tMap, vUv).r;
  float has = smoothstep(0.025, 0.05, t);
  float g = clamp((t - 0.0627) / 0.9373, 0.0, 1.0);
  vec3 tint = mix(uDark, uMid, smoothstep(0.05, 0.45, g));
  tint = mix(tint, uBright, smoothstep(0.45, 0.85, g));
  float lat = asin(clamp(normalize(vO).y, -1.0, 1.0));
  tint = mix(tint, uPoleCol, smoothstep(1.0, 1.3, lat) * uPoleK);
  tint /= max(dot(tint, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
  vec3 alb = pow(g, 2.2) * mix(vec3(1.0), tint, uColor);
  // keine Daten: Gradnetz alle 15°, leuchtet schwach selbst (auch auf der Nachtseite erkennbar)
  vec2 q = vUv * vec2(24.0, 12.0), d = min(fract(q), 1.0 - fract(q)) / max(fwidth(q), vec2(1e-4));
  float line = (1.0 - smoothstep(0.5, 1.5, min(d.x, d.y))) * uGrid * (1.0 - has);
  alb = mix(vec3(0.012, 0.013, 0.016), alb, has);
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP), L = uSunDir;
  float mu0 = max(dot(N, L), 0.0), mu = max(dot(N, V), 0.0);
  float lit = mix(mu0, mu0 / (mu0 + mu + 1e-4) * 2.0, 0.35);
  vec3 dO = uOther - vP;
  float dist = length(dO);
  if (dot(dO, L) > 0.0 && dist > uOtherR) {
    float ao = asin(uOtherR / dist), as = max(uSunAng, 1e-6);
    float sep = acos(clamp(dot(dO / dist, L), -1.0, 1.0));
    float full = ao >= as ? 0.0 : 1.0 - ao * ao / (as * as);
    lit *= mix(full, 1.0, smoothstep(abs(ao - as), ao + as, sep));
  }
  float e0 = max(dot(N, dO / dist), 0.0);
  vec3 col = alb * (lit + e0 * uShine + uAmb) + vec3(0.016, 0.021, 0.028) * line;
  gl_FragColor = vec4(col * uGain, 1.0);
}
`;

// Dunst: Sichtstrahl durch die Hülle (Radius uRa um uCenter, Boden uRp), Dichte exponentiell mit der Höhe, nur wo die Sonne
// hinkommt (Plutoschatten); Lagen nach der Höhe des tiefsten Punkts auf dem Strahl (scharfe Ringe am Rand wie auf den
// Gegenlichtbildern, Zahl und Abstand Modell); Henyey-Greenstein-Vorwärtsstreuung, blau
const HAZE_FRAG = /* glsl */ `
uniform vec3 uSunDir, uCenter;
uniform float uRp, uRa, uGain;
varying vec3 vP;
void main() {
  vec3 ro = cameraPosition, rd = normalize(vP - ro), oc = ro - uCenter;
  float b = dot(oc, rd), c = dot(oc, oc) - uRa * uRa, h = b * b - c;
  if (h <= 0.0) discard;
  h = sqrt(h);
  float t0 = max(-b - h, 0.0), t1 = -b + h;
  float hp = b * b - (dot(oc, oc) - uRp * uRp);
  if (hp > 0.0 && -b - sqrt(hp) > 0.0) t1 = min(t1, -b - sqrt(hp));
  if (t1 <= t0) discard;
  float thick = uRa - uRp, ds = (t1 - t0) / 20.0, sum = 0.0;
  for (int i = 0; i < 20; i++) {
    vec3 p = ro + rd * (t0 + ds * (float(i) + 0.5)) - uCenter;
    float r = length(p), alt = max(r - uRp, 0.0) / thick;
    float cs = sqrt(max(0.0, 1.0 - uRp * uRp / (r * r)));
    float vis = smoothstep(-cs - 0.02, -cs + 0.02, dot(p / r, uSunDir));
    sum += exp(-alt / 0.22) * (1.0 - smoothstep(0.75, 1.0, alt)) * vis * ds / thick;
  }
  float altT = max(sqrt(max(dot(oc, oc) - b * b, 0.0)) - uRp, 0.0) / thick;
  sum *= 0.6 + 0.4 * sin(altT * 75.0);
  float ct = dot(rd, uSunDir), g = 0.65;
  float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * ct, 1.5);
  gl_FragColor = vec4(vec3(0.32, 0.55, 1.0) * sum * (0.12 + 0.45 * hg) * uGain, 1.0);
}
`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
// Sonnenort (heliozentrisch, Szene, AE) aus den Bahnelementen Plutos
function helio(jd, out = new THREE.Vector3()) {
  const el = elementsAt(PLUTO, jd);
  return out.set(...eclToScene(orbitToEcliptic(el, solveKepler(el.M * RAD, el.e))));
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 8000);
  const stars = createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.8, seed: 43, tex: ctx.tex });
  scene.add(stars);
  const glow = glowTexture();

  // ---------- Bezugssystem: Pluto-Äquator (JPL „equatorial“) → Szene (Ekliptik), Längen in Plutoradien ----------
  const A = laplaceAxes(...POLE);
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(...A.x), new THREE.Vector3(...A.y), new THREE.Vector3(...A.z));
  const pole = new THREE.Vector3(...A.z);
  const toScene = (km, out) => out.set(...km).applyMatrix4(basis).multiplyScalar(1 / R_P);
  const jd0 = julianDate(ctx.date);
  let jd = jd0;

  // ---------- Pluto, Charon, Dunst ----------
  const sunDir = new THREE.Vector3(), sunAng = { value: 0 };
  const bodyU = (map, tint, otherR) => ({
    tMap: { value: ctx.tex(map, false) }, uSunDir: { value: sunDir }, uOther: { value: new THREE.Vector3() }, uOtherR: { value: otherR }, uSunAng: sunAng,
    uDark: { value: new THREE.Color(tint.dark) }, uMid: { value: new THREE.Color(tint.mid) }, uBright: { value: new THREE.Color(tint.bright) },
    uPoleCol: { value: new THREE.Color(tint.pole) }, uPoleK: { value: tint.poleK }, uColor: { value: 1 }, uGrid: { value: 1 },
    uGain: { value: 2.6 }, uShine: { value: 0.004 }, uAmb: { value: 0.006 },
  });
  const plutoU = bodyU('pluto.jpg', TINT.pluto, R_C / R_P), charonU = bodyU('charon.jpg', TINT.charon, 1);
  const pluto = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 80), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: ICE_FRAG, uniforms: plutoU }));
  const charon = new THREE.Mesh(new THREE.SphereGeometry(R_C / R_P, 128, 64), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: ICE_FRAG, uniforms: charonU }));
  const hazeU = { uSunDir: { value: sunDir }, uCenter: { value: new THREE.Vector3() }, uRp: { value: 1 }, uRa: { value: 1.2 }, uGain: { value: 3 } };
  const haze = new THREE.Mesh(new THREE.SphereGeometry(1.2, 96, 48), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: HAZE_FRAG, uniforms: hazeU, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }));
  scene.add(pluto, charon, haze);
  spinAxis(pluto);
  spinAxis(charon);

  // ---------- Bahnen: Charon und Plutos Mitte um den Schwerpunkt, kleine Monde, Schwerpunkt-Marke ----------
  const lineMat = (opacity, color = 0x9fdcff) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const ring = (r, n = 256) => new THREE.BufferGeometry().setFromPoints(Array.from({ length: n }, (_, i) => new THREE.Vector3(r * Math.cos(i / n * Math.PI * 2), r * Math.sin(i / n * Math.PI * 2), 0).applyMatrix4(basis)));
  const aPC = CHARON.a / R_P;
  const orbits = new THREE.Group();
  orbits.add(new THREE.LineLoop(ring(aPC / (1 + Q)), lineMat(0.32)), new THREE.LineLoop(ring(aPC * Q / (1 + Q), 128), lineMat(0.6, 0xffd9a0)), new THREE.LineLoop(ring(0.12, 48), lineMat(0.9, 0xffd9a0)));
  const tmp = new THREE.Vector3();
  for (const el of MOONS) {
    const pts = Array.from({ length: 192 }, (_, i) => toScene(laplacePos(el, jd0 + (i / 192) * el.P), new THREE.Vector3()));
    orbits.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat(0.1)));
  }
  scene.add(orbits);
  const moonG = new THREE.BufferGeometry();
  moonG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOONS.length * 3), 3));
  const moonPts = new THREE.Points(moonG, new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, map: glow, color: 0xe8e2d8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(moonPts);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff2dc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sun.scale.setScalar(70);
  scene.add(sun);

  // ---------- New Horizons: Gerade durch das System, festgelegt mit Sonnen- und Charonrichtung am 14.07.2015 ----------
  const sNH = helio(NH_T).negate().normalize();
  const rNH = toScene(laplacePos(CHARON, NH_T), new THREE.Vector3());
  const wNH = rNH.clone().normalize().addScaledVector(sNH, -rNH.clone().normalize().dot(sNH)).normalize();
  const vNH = sNH.clone().multiplyScalar(-Math.cos(NH_TH)).addScaledVector(wNH, Math.sin(NH_TH));
  const S = NH_B / Math.sin(NH_TH);
  const caNH = rNH.clone().multiplyScalar(-Q / (1 + Q)).addScaledVector(sNH, -S).addScaledVector(vNH, -S * Math.cos(NH_TH));   // Ort der größten Annäherung
  const nhAt = (j, out) => out.copy(caNH).addScaledVector(vNH, NH_V * (j - NH_T));
  const nhLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([nhAt(NH_T - NH_SPAN, new THREE.Vector3()), nhAt(NH_T + NH_SPAN, new THREE.Vector3())]), lineMat(0.45, 0x33ccff));
  const probe = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff0c8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false }));
  probe.scale.setScalar(0.022);
  scene.add(nhLine, probe);

  // ---------- Stand zum Zeitpunkt jd ----------
  const plutoPos = pluto.position, charonPos = charon.position, cDir = new THREE.Vector3(), rel = new THREE.Vector3();
  const ex = new THREE.Vector3(), ez = new THREE.Vector3(), m4 = new THREE.Matrix4();
  let lambda = 0;   // Richtung zu Charon [rad, um den Pol] – für die mitdrehende Kamera
  function place() {
    toScene(laplacePos(CHARON, jd), rel);
    cDir.copy(rel).normalize();
    plutoPos.copy(rel).multiplyScalar(-Q / (1 + Q));
    charonPos.copy(rel).multiplyScalar(1 / (1 + Q));
    // gebundene Drehung: Länge 0° (Kugel-UV 0 = lokal −x) zeigt zum Partner, Pol = lokal +y, Osten = Drehsinn
    ex.copy(cDir).negate();
    pluto.quaternion.setFromRotationMatrix(m4.makeBasis(ex, pole, ez.crossVectors(ex, pole)));
    ex.copy(cDir);
    charon.quaternion.setFromRotationMatrix(m4.makeBasis(ex, pole, ez.crossVectors(ex, pole)));
    lambda = Math.atan2(cDir.dot(new THREE.Vector3(...A.y)), cDir.dot(new THREE.Vector3(...A.x)));
    plutoU.uOther.value.copy(charonPos);
    charonU.uOther.value.copy(plutoPos);
    hazeU.uCenter.value.copy(plutoPos);
    haze.position.copy(plutoPos);
    const h = helio(jd, tmp);
    sunAng.value = 695700 / (h.length() * 1.495978707e8);
    sunDir.copy(h).negate().normalize();
    sun.position.copy(sunDir).multiplyScalar(3000);
    const mp = moonG.attributes.position;
    MOONS.forEach((el, i) => { toScene(laplacePos(el, jd), tmp); mp.setXYZ(i, tmp.x, tmp.y, tmp.z); });
    mp.needsUpdate = true;
    probe.visible = nhOn && Math.abs(jd - NH_T) < NH_SPAN;
    if (probe.visible) nhAt(jd, probe.position);
  }

  // ---------- Heimpose: auf der Charon abgewandten Seite (Herz im Blick), 28° über der Linie Pluto–Charon → Charon steht
  // im Bild über Pluto; von drei Drehungen um diese Linie die am besten beleuchtete; Blickziel so, dass Pluto links unten
  // in der freien Bildmitte liegt (rechts die Infotafel) ----------
  let nhOn = true;
  place();
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(cDir, -cDir.y).normalize();
  const camDir = (phi) => cDir.clone().multiplyScalar(-Math.cos(28 * RAD)).addScaledVector(up.clone().applyAxisAngle(cDir, phi), Math.sin(28 * RAD)).normalize();
  const dHome = [-35, 0, 35].map((a) => camDir(a * RAD)).reduce((b, d) => (d.dot(sunDir) > b.dot(sunDir) ? d : b));
  const homePos = plutoPos.clone().addScaledVector(dHome, 5.2);
  const fwd = dHome.clone().negate(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const home = { pos: homePos, target: plutoPos.clone().addScaledVector(right, 0.57).addScaledVector(new THREE.Vector3().crossVectors(right, fwd), 0.43) };

  // ---------- Zeit, Ebenen, Infotafel ----------
  let spdIdx = 2, playing = !ctx.still, corot = true, turn = 0;
  const setColor = (v) => { plutoU.uColor.value = charonU.uColor.value = v === 'model' ? 1 : 0; };
  function flyby() {
    jd = NH_T - 0.09;
    spdIdx = 1;
    playing = true;
    if (!nhOn) { nhOn = true; nhLine.visible = true; }
    refreshLayers();
  }
  registerLayers('pluto', [
    { id: 'orbit', type: 'play', group: 'Zeit', label: 'Umlauf im Zeitraffer', value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1], autoplay: !ctx.still,
      set: (i, p) => { spdIdx = Math.round(i); playing = p; }, get: () => ({ value: spdIdx, playing }),
      status: () => `${fmtDate.format(new Date((jd - 2440587.5) * 864e5))} UT · ${playing ? `Zeitraffer ${SPEEDS[spdIdx][1]}` : 'angehalten'}` },
    { id: 'corot', type: 'toggle', group: 'Ansicht', label: 'Kamera dreht mit dem Paar', value: true, set: (v) => { corot = v; } },
    { id: 'orbits', type: 'toggle', group: 'System', label: 'Bahnen und Schwerpunkt', value: true, set: (v) => { orbits.visible = v; } },
    { id: 'moons', type: 'toggle', label: 'Kleine Monde (vergrößert)', value: true, set: (v) => { moonPts.visible = v; } },
    { id: 'haze', type: 'toggle', group: 'Oberfläche', label: 'Dunst der Atmosphäre', value: true, set: (v) => { haze.visible = v; } },
    { id: 'hazeGain', type: 'range', label: 'Stärke', value: 1, min: 0.3, max: 6, step: 0.1, unit: '×', sub: true, set: (v) => { hazeU.uGain.value = 3 * v; } },
    { id: 'grid', type: 'toggle', label: 'Gebiete ohne Karte als Gradnetz', value: true, set: (v) => { plutoU.uGrid.value = charonU.uGrid.value = v ? 1 : 0; } },
    { id: 'nh', type: 'toggle', group: 'New Horizons', label: 'Bahn beim Vorbeiflug 2015', value: true, set: (v) => { nhOn = v; nhLine.visible = v; probe.visible = v && probe.visible; } },
    { id: 'flyby', type: 'action', label: 'Vorbeiflug', button: 'Abspielen', sub: true, run: flyby },
  ]);
  const controls = [
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: playing ? spdIdx : 0, min: 0, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (v) => { if (v) { spdIdx = v; playing = true; } else playing = false; refreshLayers(); }, get: () => (playing ? spdIdx : 0) },
    { id: 'color', label: 'Farbe', value: 'model', options: [['model', 'Modell (MVIC)'], ['gray', 'Messbild (LORRI)']], set: setColor },
    { id: 'flyby', type: 'action', label: 'New Horizons', button: 'Vorbeiflug 2015', run: flyby },
  ];

  // ---------- Abzeichen ----------
  const local = (lat, lon) => new THREE.Vector3(-Math.cos(lon * RAD) * Math.cos(lat * RAD), Math.sin(lat * RAD), Math.sin(lon * RAD) * Math.cos(lat * RAD));
  const HEART = local(22, 177), CTHULHU = local(-4, 117), NPOLE = new THREE.Vector3(0, 1, 0);
  const f1 = new THREE.Vector3(), f2 = new THREE.Vector3();
  const facing = (p, center, cam) => f1.copy(p).sub(center).normalize().dot(f2.copy(cam.position).sub(p).normalize());
  const hs = {
    heart: { id: 'heart', kind: 'info', pos: new THREE.Vector3(), focus: () => 2.4, visible: (cam) => facing(hs.heart.pos, plutoPos, cam) > 0.05 },
    cthulhu: { id: 'cthulhu', kind: 'info', pos: new THREE.Vector3(), focus: () => 2.4, visible: (cam) => facing(hs.cthulhu.pos, plutoPos, cam) > 0.05 },
    pole: { id: 'pole', kind: 'info', pos: new THREE.Vector3(), focus: () => 3, visible: (cam) => facing(hs.pole.pos, plutoPos, cam) > -0.2 },
    haze: { id: 'haze', kind: 'info', pos: new THREE.Vector3(), focus: () => 2.2, visible: () => haze.visible },
    charon: { id: 'charon', kind: 'info', pos: charonPos, focus: () => 2.2 },
    bary: { id: 'bary', kind: 'info', pos: new THREE.Vector3(), focus: () => 7, visible: () => orbits.visible },
    moons: { id: 'moons', kind: 'info', pos: new THREE.Vector3(), focus: () => 30, visible: () => moonPts.visible },
    nh: { id: 'nh', kind: 'info', pos: new THREE.Vector3(), focus: () => 20, visible: () => nhOn },
  };
  const hotspots = Object.values(hs);
  const view = new THREE.Vector3();
  function placeHotspots(cam) {
    pluto.updateMatrixWorld();
    hs.heart.pos.copy(HEART).applyMatrix4(pluto.matrixWorld);
    hs.cthulhu.pos.copy(CTHULHU).applyMatrix4(pluto.matrixWorld);
    hs.pole.pos.copy(NPOLE).multiplyScalar(1.02).applyMatrix4(pluto.matrixWorld);
    // Dunst: am Rand, zur Sonne hin (quer zur Blickrichtung)
    view.copy(plutoPos).sub(cam.position).normalize();
    tmp.copy(sunDir).addScaledVector(view, -sunDir.dot(view));
    if (tmp.lengthSq() < 1e-6) tmp.copy(pole).addScaledVector(view, -pole.dot(view));
    hs.haze.pos.copy(plutoPos).addScaledVector(tmp.normalize(), 1.1);
    hs.moons.pos.set(...moonG.attributes.position.array.slice(9, 12));
    if (probe.visible) hs.nh.pos.copy(probe.position); else hs.nh.pos.copy(caNH);
  }
  placeHotspots({ position: home.pos });

  const look = { exposure: 1.05, bloom: 0.06 };
  const axis = pole.clone();
  return {
    scene, camera, home, unit: R_P * 1e3, hotspots, controls, look,
    orbit: { minDistance: 0.4, maxDistance: 320, cineSpeed: 0.35 },
    update(dt, t, cam, flying) {
      const l0 = lambda;
      if (!flying && playing) jd += dt * SPEEDS[spdIdx][0];
      place();
      if (!flying && corot) turn += ((lambda - l0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      placeHotspots(cam);
    },
    // „Kamera dreht mit“: Kamera und Blickziel drehen um die Polachse durch den Schwerpunkt mit Charon mit – Pluto und
    // Charon stehen dann still, Sterne und Sonne ziehen vorbei; außerdem bleibt die Kamera außerhalb beider Körper
    orbitUpdate(c) {
      if (turn) { c.object.position.applyAxisAngle(axis, turn); c.target.applyAxisAngle(axis, turn); turn = 0; }
      for (const [p, r] of [[plutoPos, 1.03], [charonPos, (R_C / R_P) * 1.03]]) {
        const d = rel.copy(c.object.position).sub(p);
        if (d.length() < r) c.object.position.copy(p).addScaledVector(d.normalize(), r);
      }
    },
    live: () => `${fmtDate.format(new Date((jd - 2440587.5) * 864e5))} UT · Charon ${((lambda / RAD) % 360 + 360) % 360 | 0}° · ${playing ? `Zeitraffer ${SPEEDS[spdIdx][1]}` : 'angehalten'}`,
    setPixelRatio(pr) { stars.userData.setPixelRatio(pr); moonPts.material.size = 7 * pr; },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      glow.dispose();
    },
  };
}
