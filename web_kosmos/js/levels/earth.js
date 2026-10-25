// Station 1: Erde und Mond, maßstäblich (Einheit 1.000 km). Stand für den aktuellen Zeitpunkt: Sonnenrichtung aus den
// JPL-Bahnelementen, Erddrehung aus der Sternzeit Greenwich, Mondort aus der Almanach-Näherung (astro.js).
// Erde: Tagkarte mit Glanzlicht und Fresnel-Schimmer der Ozeane, Wolken mit Schattenwurf auf die Oberfläche,
// Stadtlichter auf der Nachtseite, Atmosphäre als Strahl-Kugel-Schnitt (Weglänge durch die Hülle × Dichte, blau auf der
// Tagseite, rot an der Dämmerungsgrenze, Vorwärtsstreuung, grünes Nachtleuchten der Hochatmosphäre am Nachtrand).
// Mond: gebundene Rotation, Lommel-Seeliger-Reflexion, Erdschein. Himmel: echter Sternkatalog (Yale BSC, 5.044 Sterne)
// mit Sternbildlinien und Namen (catalog.js); Schattenkegel von Erde und Mond (Finsternis-Geometrie), Bahnen von ISS
// und geostationären Satelliten, Linsenreflex der Sonne (flare.js).

import * as THREE from 'three';
import { PLANETS, julianDate, planetPosition, eclToScene, eclDir, moonPosition, gmst, OBLIQUITY, DAY, AU, R_SUN } from '../astro.js';
import { createStarfield } from '../stars.js';
import { createCatalogSky, createConstellationLines, BRIGHT, CONST_INFO } from '../catalog.js';
import { createFlare } from '../flare.js';
import { settings } from '../settings.js';
import { SKY_VERTEX } from '../glsl.js';

const R_E = 6.371, R_M = 1.7374;   // NASA Fact Sheets [1.000 km]
const R_ATM = R_E * 1.025;         // sichtbare Hülle (Dichte fällt mit ≈ 8 km Skalenhöhe; hier etwas dicker gezeichnet)
const GEO = 42.164;                // geostationärer Bahnradius [1.000 km]
const ISS = { r: R_E + 0.42, inc: 51.64 };   // ISS: ≈ 420 km Höhe, 51,64° Bahnneigung (NASA)
const SUN_D = AU / 1e6, SUN_R = R_SUN / 1e6;  // Sonnenabstand und -radius [1.000 km]
const RAD = Math.PI / 180;
const SKY_R = 3000;                // Richtungen des Himmels als Punkte „weit draußen“ (für Beschriftungen)

const EARTH_VERT = /* glsl */ `
varying vec3 vN, vP;
varying vec2 vUv;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const EARTH_FRAG = /* glsl */ `
uniform sampler2D tDay, tNight, tSpec, tClouds;
uniform vec3 uSun, uAxis;
uniform float uCloudU, uLights;
varying vec3 vN, vP;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float ndl = dot(N, uSun);
  vec3 day = texture2D(tDay, vUv).rgb;
  float ocean = texture2D(tSpec, vUv).r;
  vec2 cuv = vUv + vec2(uCloudU, 0.0);
  float cl = texture2D(tClouds, cuv).r;
  float lit = smoothstep(-0.06, 0.2, ndl);
  // Dämmerung: Licht wird an der Grenze rötlich (langer Weg durch die Luft)
  vec3 sunCol = mix(vec3(1.0, 0.55, 0.32), vec3(1.0), smoothstep(0.0, 0.35, ndl));
  // Wolkenschatten: Wolkenkarte in Richtung Sonne versetzt abtasten (Tangentialrichtung aus Drehachse und Normale)
  vec3 east = normalize(cross(uAxis, N)), north = cross(N, east);
  vec2 off = vec2(dot(uSun, east), dot(uSun, north)) * 0.0045;
  float shadow = 1.0 - 0.55 * texture2D(tClouds, cuv - off).r * lit;
  vec3 col = day * max(ndl, 0.0) * sunCol * 0.82 * shadow;
  // Glanzlicht auf dem Wasser (Blinn-Phong), unter Wolken gedämpft; flacher Blick aufs Wasser spiegelt den Himmel (Fresnel)
  vec3 H = normalize(uSun + V);
  float glint = pow(max(dot(N, H), 0.0), 420.0) * ocean * (1.0 - cl) * lit;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0) * ocean * lit;
  col += vec3(1.0, 0.92, 0.8) * glint * 0.5 + vec3(0.03, 0.045, 0.065) * pow(max(dot(N, H), 0.0), 18.0) * ocean * lit + vec3(0.25, 0.4, 0.6) * fres * 0.12;
  // Wolken mit eigener Beleuchtung, an der Dämmerungsgrenze rosa angestrahlt
  col = mix(col, vec3(0.88) * max(ndl, 0.0) * sunCol, cl * 0.9);
  // Stadtlichter nur auf der Nachtseite, Wolken dämpfen
  vec3 night = texture2D(tNight, vUv).rgb;
  col += night * night * vec3(1.0, 0.78, 0.5) * uLights * (1.0 - lit) * (1.0 - cl * 0.8);
  // Erdschein der Atmosphäre auf die Nachtseite: sehr schwach blau, Mondlicht noch schwächer
  col += vec3(0.002, 0.004, 0.008) * (1.0 - lit);
  gl_FragColor = vec4(col, 1.0);
}
`;

// Atmosphäre: Weglänge des Sichtstrahls durch die Hülle bis zur Oberfläche, Dichte nach Höhe, Farbe nach Sonnenstand
const ATMO_FRAG = /* glsl */ `
uniform vec3 uSun, uCenter;
uniform float uRp, uRa, uGain;
varying vec3 vP;
void main() {
  vec3 ro = cameraPosition, rd = normalize(vP - cameraPosition);
  vec3 oc = ro - uCenter;
  float b = dot(oc, rd), c = dot(oc, oc) - uRa * uRa, h = b * b - c;
  if (h <= 0.0) discard;
  h = sqrt(h);
  float t0 = max(-b - h, 0.0), t1 = -b + h;
  float hp = b * b - (dot(oc, oc) - uRp * uRp);
  bool ground = hp > 0.0;
  if (ground) t1 = min(t1, -b - sqrt(hp));
  float L = max(t1 - t0, 0.0);
  vec3 pm = ro + rd * (t0 + t1) * 0.5;
  // tiefster Punkt des Strahls (bei Bodenkontakt die Oberfläche)
  float tc = clamp(-b, t0, t1);
  vec3 pc = ro + rd * tc;
  float alt = clamp((length(pc - uCenter) - uRp) / (uRa - uRp), 0.0, 1.0);
  float dens = exp(-alt * 5.0);
  vec3 n = normalize(pm - uCenter);
  float mu = dot(n, uSun);
  float tau = L / (uRa - uRp) * dens;
  vec3 blue = vec3(0.16, 0.42, 1.0), dusk = vec3(1.0, 0.36, 0.12);
  vec3 col = blue * smoothstep(-0.12, 0.35, mu) + dusk * exp(-pow((mu - 0.02) / 0.13, 2.0)) * 0.85;
  float cosT = dot(rd, uSun);
  float phase = 0.8 + 0.6 * cosT * cosT + 3.0 * pow(max(cosT, 0.0), 24.0);
  // Potenz: Senkrechtblick (kurzer Weg) nur leichter Schleier – Ozeane bleiben tiefblau; am Rand (langer Weg) volle Hülle
  vec3 out3 = col * pow(1.0 - exp(-tau * 0.35), 1.6) * phase;
  // Nachtleuchten (Airglow, grün 558 nm) in ≈ 90–100 km Höhe, nur am Rand der Nachtseite sichtbar
  float air = exp(-pow((alt - 0.4) / 0.14, 2.0)) * (1.0 - smoothstep(-0.35, 0.05, mu)) * smoothstep(0.3, 1.0, L / (uRa - uRp));
  out3 += vec3(0.3, 1.0, 0.45) * air * 0.045;
  gl_FragColor = vec4(out3 * uGain, 1.0);
}
`;

const MOON_FRAG = /* glsl */ `
uniform sampler2D tMoon;
uniform vec3 uSun, uEarth;
uniform float uEarthshine;
varying vec3 vN, vP;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vP);
  float mu0 = max(dot(N, uSun), 0.0), mu = max(dot(N, V), 0.0);
  // Lommel-Seeliger: Regolith streut nicht wie eine matte Fläche – der Vollmond wirkt flach, ohne Randabfall
  float ls = mu0 / (mu0 + mu + 1e-4) * 2.0;
  vec3 alb = texture2D(tMoon, vUv).rgb;
  vec3 col = alb * ls * 0.85;
  float e0 = max(dot(N, uEarth), 0.0);
  col += alb * e0 / (e0 + mu + 1e-4) * uEarthshine;
  gl_FragColor = vec4(col, 1.0);
}
`;

const SUN_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vDir;
void main() {
  float a = acos(clamp(dot(normalize(vDir), uSun), -1.0, 1.0));
  // Winkelradius der Sonnenscheibe von der Erde: 0,267° (Strahlungsdichte stark verdichtet, Bloom macht den Lichthof)
  float disk = smoothstep(0.00475, 0.00455, a);
  float glow = exp(-a / 0.012) * 6.0 + exp(-a / 0.08) * 0.25;
  gl_FragColor = vec4(vec3(1.0, 0.96, 0.9) * (disk * 900.0 + glow), 1.0);
}
`;
const SUN_VERT = /* glsl */ `
${SKY_VERTEX}
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = skyPosition(vDir); }
`;

// Schattenkegel (Kern- und Halbschatten) eines Körpers mit Radius r in Sonnenabstand D: Kernschatten endet bei
// L = r·D/(R☉ − r), der Halbschatten öffnet sich mit (R☉ + r)/D
function shadowCones(r, len) {
  const g = new THREE.Group();
  const Lu = r * SUN_D / (SUN_R - r);
  const umbra = new THREE.Mesh(new THREE.ConeGeometry(r, Lu, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x5577bb, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  umbra.position.y = -Lu / 2;
  umbra.rotation.x = Math.PI;   // Spitze zeigt von der Sonne weg (lokal −y)
  g.add(umbra);
  const Lp = len;
  const rp = r + Lp * (SUN_R + r) / SUN_D;
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(rp, r, Lp, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x334a77, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  pen.position.y = -Lp / 2;
  g.add(pen);
  g.userData.Lu = Lu;
  return g;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 4000);
  const jd0 = julianDate(ctx.date);
  let jd = jd0, rate = 0;
  const earthP = PLANETS.find((p) => p.id === 'earth');

  const sunDir = new THREE.Vector3();
  const moonPos = new THREE.Vector3();
  const earthDir = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);
  let pr = 1;

  // ---------- Himmel: Katalog (Yale BSC) mit Sternbildern; fällt auf den statistischen Himmel zurück ----------
  const ngp = new THREE.Vector3(...eclDir(180.02, 29.81)), gc = new THREE.Vector3(...eclDir(266.84, -5.54));
  const sky = new THREE.Group();
  scene.add(sky);
  let catalog = null, lines = null, consMode = 'off';
  const starLabels = [], conLabels = [];
  const ready = createCatalogSky({ gain: 2.1, limit: 6.5 }).then((g) => {
    catalog = g;
    g.userData.setPixelRatio(pr);
    sky.add(g);
    for (const st of g.userData.named) {
      const b = BRIGHT[st.name];
      if (!b) continue;
      starLabels.push({ id: `star-${st.name}`, kind: 'label', cls: 'hsl--star', pos: st.dir.clone().multiplyScalar(SKY_R), visible: () => consMode === 'names',
        info: { t: st.name, x: `${b.x} Helligkeit ${st.mag.toFixed(2).replace('.', ',')} mag.`, s: 'hipparcos' } });
    }
    return createConstellationLines();
  }).then((l) => {
    lines = l;
    lines.visible = false;
    sky.add(lines);
    for (const c of lines.userData.names) {
      if (!CONST_INFO[c.id]) continue;
      conLabels.push({ id: `con-${c.id}`, kind: 'label', cls: 'hsl--con', pos: c.dir.clone().multiplyScalar(SKY_R), visible: () => consMode !== 'off',
        info: { t: c.de, x: `${CONST_INFO[c.id]} (lateinisch ${c.la})`, s: 'd3-celestial' } });
    }
    hotspots.push(...conLabels, ...starLabels);
  }).catch((err) => {
    console.warn('[kosmos] Sternkatalog nicht geladen, statistischer Himmel:', err);
    const f = createStarfield({ ngp, gc, gain: 0.9, seed: 11 });
    f.userData.setPixelRatio(pr);
    sky.add(f);
    catalog = f;
  });
  // Milchstraßenband und Sonne bleiben prozedural
  sky.add(createStarfield({ count: 1, ngp, gc, gain: 0, band: 1, glint: false }));
  const sunMat = new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms: { uSun: { value: sunDir } }, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true });
  const sunSky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), sunMat);
  sunSky.frustumCulled = false;
  sunSky.renderOrder = -9;
  scene.add(sunSky);
  const flare = createFlare({ strength: 0.85 });
  scene.add(flare);

  // ---------- Erde ----------
  const tilt = new THREE.Group();
  tilt.rotation.x = -OBLIQUITY * RAD;          // Äquator-System → Ekliptik-Szene (Nordpol bei λ = 90°, β = 66,56°)
  scene.add(tilt);
  const spin = new THREE.Group();
  tilt.add(spin);
  const earthMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG,
    uniforms: {
      tDay: { value: ctx.tex('earth_daymap.jpg') }, tNight: { value: ctx.tex('earth_nightmap.jpg') },
      tSpec: { value: ctx.tex('earth_specular.jpg', false) }, tClouds: { value: ctx.tex('earth_clouds.jpg', false) },
      uSun: { value: sunDir }, uAxis: { value: axis }, uCloudU: { value: 0 }, uLights: { value: 1.6 },
    },
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R_E, 192, 96), earthMat);
  spin.add(earth);
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vP; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: ATMO_FRAG,
    uniforms: { uSun: { value: sunDir }, uCenter: { value: new THREE.Vector3() }, uRp: { value: R_E }, uRa: { value: R_ATM }, uGain: { value: 1.6 } },
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R_ATM, 128, 64), atmoMat);
  scene.add(atmo);

  // Bahnen in der Äquatorebene: geostationär (Ring) und ISS (51,6° geneigt, Knotenlage schematisch)
  const lineMat = (c, o) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = (r, segs = 256) => { const pts = []; for (let i = 0; i <= segs; i++) { const a = (i / segs) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); } return new THREE.BufferGeometry().setFromPoints(pts); };
  const geo = new THREE.LineLoop(ring(GEO), lineMat(0x9cc8ff, 0.35));
  tilt.add(geo);
  const issOrbit = new THREE.LineLoop(ring(ISS.r, 180), lineMat(0xffd27a, 0.5));
  issOrbit.rotation.x = ISS.inc * RAD;
  tilt.add(issOrbit);

  // Schattenkegel (Finsternis-Geometrie), zeigen von der Sonne weg
  const earthShadow = shadowCones(R_E, 500), moonShadow = shadowCones(R_M, 60);
  earthShadow.visible = moonShadow.visible = false;
  scene.add(earthShadow, moonShadow);

  // ---------- Mond ----------
  const moonPivot = new THREE.Group();
  scene.add(moonPivot);
  const moonMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT, fragmentShader: MOON_FRAG,
    uniforms: { tMoon: { value: ctx.tex('moon.jpg') }, uSun: { value: sunDir }, uEarth: { value: earthDir }, uEarthshine: { value: 0.0025 } },
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R_M, 96, 48), moonMat);
  moon.rotation.y = -Math.PI / 2;               // Länge 0 (Textur-Mitte) zeigt zur Erde
  moonPivot.add(moon);
  // Mondbahn der nächsten 27,3 Tage als Linie (echter Verlauf, nicht als Kreis)
  const orbitPts = [];
  for (let i = 0; i <= 220; i++) orbitPts.push(new THREE.Vector3(...eclToScene(moonPosition(jd0 + (i / 220) * 27.32))).multiplyScalar(1e-3));
  const moonOrbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPts), lineMat(0xd3dae6, 0.28));
  scene.add(moonOrbit);

  const up = new THREE.Vector3(0, 1, 0);
  function place() {
    const e = planetPosition(earthP, jd);
    sunDir.set(...eclToScene(e)).multiplyScalar(-1).normalize();
    moonPos.set(...eclToScene(moonPosition(jd))).multiplyScalar(1e-3);
    moonPivot.position.copy(moonPos);
    moonPivot.lookAt(0, 0, 0);
    earthDir.copy(moonPos).multiplyScalar(-1).normalize();
    spin.rotation.y = gmst(jd) * RAD;
    tilt.updateMatrixWorld();
    axis.copy(up).applyQuaternion(tilt.quaternion);
    // Kegel: lokale +y zur Sonne, Spitze von der Sonne weg
    earthShadow.quaternion.setFromUnitVectors(up, sunDir);
    moonShadow.quaternion.copy(earthShadow.quaternion);
    moonShadow.position.copy(moonPos);
  }
  place();

  // ---------- Posen ----------
  // Heimpose: gegenüber dem Mond, seitlich versetzt – der Mond steht neben der Erde im Bild, Licht wie jetzt
  const m = moonPos.clone().normalize();
  const side = new THREE.Vector3().crossVectors(m, up).normalize();
  const d = m.clone().multiplyScalar(-1).addScaledVector(side, 0.38).addScaledVector(up, 0.12).normalize();
  const home = { pos: d.clone().multiplyScalar(36), target: new THREE.Vector3() };
  const introDir = d.clone().applyAxisAngle(up, -1.9).addScaledVector(up, 0.25).normalize();
  const intro = { pos: introDir.multiplyScalar(13), target: new THREE.Vector3() };

  // Punkt einer Äquatorbahn, der von der Heimpose aus in Richtung `dir` liegt
  function orbitPoint(dir, r, rotX = 0) {
    tilt.updateMatrixWorld();
    const q = tilt.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotX));
    const local = dir.clone().applyQuaternion(q.clone().invert());
    local.y = 0;
    return local.normalize().multiplyScalar(r).applyQuaternion(q);
  }

  // Abzeichen: Tagrand, Nachtseite (von der Heimpose aus), Mond, Bahnpunkte, Sonnenrichtung, Schattenspitze
  const v = d.clone();
  const limb = sunDir.clone().addScaledVector(v, -sunDir.dot(v)).normalize();
  const upL = new THREE.Vector3().crossVectors(v, limb).normalize();
  const umbraTip = new THREE.Vector3();
  const hotspots = [
    { id: 'atmo', kind: 'info', pos: limb.clone().multiplyScalar(R_E * 1.02).addScaledVector(upL, 1.2) },
    { id: 'night', kind: 'info', pos: limb.clone().multiplyScalar(-0.62).addScaledVector(v, 0.7).normalize().multiplyScalar(R_E) },
    { id: 'moon', kind: 'info', pos: moonPos },
    { id: 'geo', kind: 'info', pos: orbitPoint(side.clone().negate(), GEO) },
    { id: 'iss', kind: 'info', pos: orbitPoint(side.clone().add(upL), ISS.r, ISS.inc * RAD) },
    { id: 'sun', kind: 'info', pos: sunDir.clone().multiplyScalar(90) },
    { id: 'umbra', kind: 'info', pos: umbraTip, visible: () => earthShadow.visible },
  ];

  const controls = [
    { id: 'time', label: 'Zeit', value: 'now', options: [['now', 'Jetzt'], ['hour', '1 h/s'], ['day', '1 Tag/s']],
      set: (val) => { rate = val === 'hour' ? 1 / 24 : val === 'day' ? 1 : 0; if (!rate) jd = julianDate(new Date()); } },
    { id: 'const', label: 'Sternbilder', value: 'off', options: [['off', 'Aus'], ['lines', 'Linien'], ['names', 'Linien + Namen']],
      set: (val) => { consMode = val; if (lines) lines.visible = val !== 'off'; } },
    { id: 'shadow', label: 'Schatten', value: 'off', options: [['off', 'Aus'], ['on', 'Kegel zeigen']],
      set: (val) => { earthShadow.visible = moonShadow.visible = val === 'on'; } },
  ];
  let illum = 0;
  const tmp = new THREE.Vector3();
  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  const occluders = [{ center: new THREE.Vector3(), radius: R_E }, { center: moonPos, radius: R_M }];
  const sunFar = new THREE.Vector3();

  return {
    scene, camera, home, intro, unit: 1e6, hotspots, controls, ready,
    orbit: { minDistance: R_E * 1.28, maxDistance: 1000, cineSpeed: 0.8 },
    look: { exposure: 1.05, bloom: 0.05, sat: 1.06 },
    update(dt, t, cam) {
      jd += rate ? dt * rate : dt / DAY;
      place();
      earthMat.uniforms.uCloudU.value = (jd - jd0) * 0.004;
      // beleuchteter Anteil aus der Elongation Mond–Sonne (Phasenwinkel ≈ 180° − Elongation)
      illum = (1 - tmp.copy(moonPos).normalize().dot(sunDir)) / 2;
      umbraTip.copy(sunDir).multiplyScalar(-earthShadow.userData.Lu * 0.28);
      sunFar.copy(sunDir).multiplyScalar(3500);
      cam.updateMatrixWorld();
      flare.userData.update(sunFar, cam, occluders, settings.S.lens, dt);
    },
    live: () => `Stand ${fmt.format(new Date((jd - 2440587.5) * 864e5))} · Mond zu ${Math.round(illum * 100)} % beleuchtet · ${catalog && catalog.userData.count ? `${catalog.userData.count.toLocaleString('de-DE')} Katalogsterne` : 'Himmel wird geladen'}`,
    setPixelRatio: (p) => { pr = p; if (catalog) catalog.userData.setPixelRatio(p); },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    },
  };
}
