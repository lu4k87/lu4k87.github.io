// Erde aus dem Orbit – gemeinsamer Teil der Stationen ISS (01A) und Tiangong (01B). Die Szene hängt am Bahnsystem der
// Raumstation (Meter; x Flugrichtung, y vom Erdmittelpunkt weg, z = x × y), so wie die Stationen fliegen (LVLH): die Erde
// bleibt unten, Sonne und Sterne ziehen einmal je Umlauf herum. Erde mit den Shadern aus Station 1 (Tagkarte 8k mit
// Feinstruktur, Stadtlichter, Wolken, Polarlichter), Atmosphäre aus planetfx.js als dünner Saum bis 120 km, Sonne, Mond
// und echter Sternhimmel. Bahn aus dem CelesTrak-Schnappschuss (sats.json, Kepler + J2): Ort, Sonnenauf- und -untergänge,
// Erdschatten, Erdschein und Bahnspur gelten für den angezeigten Zeitpunkt.
// Tiefenpuffer: die Station liegt Meter, die Erde Hunderte Kilometer entfernt. Die ferne Welt (`far`) wird um die Kamera
// auf k = near/500 verkleinert (gleiche Winkelgröße, Parallaxe bleibt), zuerst gezeichnet; danach löscht ein unsichtbarer
// Haken (`ORDER.clear`) den Tiefenpuffer, dann folgt die Station. Stationsteile brauchen deshalb `transparent: true`
// (sie liegen sonst in der Liste vor den durchscheinenden Teilen der fernen Welt) – siehe `stationMat`.
// Himmel: die Sternshader ignorieren die Modellmatrix (glsl.js skyPosition) → Richtungen werden auf der CPU gedreht.

import * as THREE from 'three';
import { PLANETS, julianDate, planetPosition, eclToScene, eclDir, moonPosition, gmst, OBLIQUITY } from './astro.js';
import { createStarfield } from './stars.js';
import { createCatalogSky } from './catalog.js';
import { createFlare } from './flare.js';
import { settings } from './settings.js';
import { loadSats, satPos, namedIndex } from './sats.js';
import { speedAt, periodMin, RE } from './orbit.js';
import { SHELL_VERT, ATMO_FRAG, CLOUD_FRAG } from './planetfx.js';
import { EARTH_VERT, EARTH_VERT_O, EARTH_FRAG, earthMaps, MOON_FRAG, SUN_VERT, SUN_FRAG, AURORA_VERT, AURORA_FRAG, AURORA_GLOW_VERT, AURORA_GLOW_FRAG, auroraGeometry } from './levels/earth.js';

const R_E = 6.371, R_M = 1.7374;     // [1.000 km] NASA Fact Sheets
const R_CLOUD = R_E + 0.012;         // Wolkenobergrenze ≈ 12 km
const R_ATM = R_E + 0.12;            // Hülle bis 120 km: Streulicht-Saum, Nachtleuchten in ≈ 95 km
const KM = 1e6;                      // Meter je Einheit der fernen Welt (1.000 km)
const RAD = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
export const ORDER = { sky: -100, far: -90, clear: -50, station: 0, flare: 50 };
// Zeitraffer [s je s]; Pause = Echtzeit
export const SPEEDS = [[1, 'Echtzeit'], [10, '10×'], [30, '30×'], [120, '2 min/s'], [600, '10 min/s']];

// Material für Stationsteile: in der durchscheinenden Liste nach der fernen Welt (siehe Kopf), deckt trotzdem voll
export const stationMat = (o) => new THREE.MeshStandardMaterial({ transparent: true, ...o });

// Wolken: die 8k-Karte (≈ 5 km je Bildpunkt) bekommt feine Ränder aus Rauschen bis ≈ 0,5 km (Modell)
const CLOUD_FRAG_O = CLOUD_FRAG.replace('fbm(normalize(vO) * 70.0 + vec3(0.0, 0.0, uTime * 0.01), 3)', '(fbm(normalize(vO) * 70.0 + vec3(0.0, 0.0, uTime * 0.01), 3) * 0.6 + fbm(normalize(vO) * 1100.0, 4) * 0.8)')
  .replace('c + n * 0.22 *', 'c + n * 0.34 *');

// Dreht die Richtungen eines Himmels (Sternpunkte, Milchstraßenband) mit dem Bahnsystem
function skyRotator() {
  const items = [], m3 = new THREE.Matrix3(), m4 = new THREE.Matrix4();
  return {
    add(obj) {
      obj.traverse((o) => {
        const u = o.material && o.material.uniforms;
        if (u && u.uNgp) items.push({ u, ngp: u.uNgp.value.clone(), gc: u.uGc.value.clone() });
        else if ((o.isPoints || o.isLine || o.isLineSegments) && o.geometry.attributes.position) items.push({ a: o.geometry.attributes.position, src: o.geometry.attributes.position.array.slice() });
      });
    },
    set(q) {
      const e = m3.setFromMatrix4(m4.makeRotationFromQuaternion(q)).elements;
      for (const it of items) {
        if (it.u) { it.u.uNgp.value.copy(it.ngp).applyQuaternion(q); it.u.uGc.value.copy(it.gc).applyQuaternion(q); continue; }
        const s = it.src, d = it.a.array;
        for (let i = 0; i < s.length; i += 3) {
          const x = s[i], y = s[i + 1], z = s[i + 2];
          d[i] = e[0] * x + e[3] * y + e[6] * z; d[i + 1] = e[1] * x + e[4] * y + e[7] * z; d[i + 2] = e[2] * x + e[5] * y + e[8] * z;
        }
        it.a.needsUpdate = true;
      }
    },
  };
}

// opts: sat = Name in sats.json, fallback = Bahnelemente wie in sats.json (falls der Katalog fehlt), radius = halbe
// Ausdehnung der Station [m] (Schattenkamera, Nahebene), color = Farbe von Bahn und Bahnspur
export function createOrbitView(ctx, { sat, fallback, radius = 60, color = 0xf3b552 }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 1e5);
  let jd = julianDate(ctx.date), spd = 2, playing = true, k = 1e-4;
  const earthP = PLANETS.find((p) => p.id === 'earth');
  let obj = fallback, satJd = 2461339.4261;

  // ---------- Bahnsystem: Lage der Station in der fernen Welt (Ekliptik-Szene wie Station 1, Einheit 1.000 km) ----------
  const P = new THREE.Vector3(), V = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3(), stb = new THREE.Vector3();
  const qS = new THREE.Quaternion(), qT = new THREE.Quaternion(), qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -OBLIQUITY * RAD);
  const basis = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const sunFar = new THREE.Vector3(1, 0, 0), sun = new THREE.Vector3(1, 0, 0), moonFar = new THREE.Vector3();
  const info = { alt: 0, v: 0, period: 0, lat: 0, lon: 0, beta: 0, next: null };

  function placeFrame() {
    const days = jd - satJd;
    satPos(obj, days, a).applyQuaternion(qTilt);
    satPos(obj, days + 1e-4, b).applyQuaternion(qTilt);
    P.copy(a);
    V.copy(b).sub(a);
    up.copy(P).normalize();
    fwd.copy(V).addScaledVector(up, -V.dot(up)).normalize();
    stb.crossVectors(fwd, up);
    basis.makeBasis(fwd, up, stb);
    qS.setFromRotationMatrix(basis);
    qT.copy(qS).invert();
    sunFar.set(...eclToScene(planetPosition(earthP, jd))).multiplyScalar(-1).normalize();
    sun.copy(sunFar).applyQuaternion(qT);
    moonFar.set(...eclToScene(moonPosition(jd))).multiplyScalar(1e-3);
  }

  const order = (o, r) => o.traverse((x) => { x.renderOrder = r; });

  // ---------- Himmel ----------
  const sky = new THREE.Group();
  scene.add(sky);
  const rot = skyRotator();
  let catalog = null, pr = 1;
  const ngp = new THREE.Vector3(...eclDir(180.02, 29.81)), gc = new THREE.Vector3(...eclDir(266.84, -5.54));
  const band = createStarfield({ count: 1, ngp, gc, gain: 0, band: 1.2, glint: false, tex: ctx.tex });
  sky.add(band);
  rot.add(band);
  const skyReady = createCatalogSky({ gain: 2.1, limit: 6.5 }).then((g) => { catalog = g; g.userData.setPixelRatio(pr); order(g, ORDER.sky); sky.add(g); rot.add(g); })
    .catch((err) => { console.warn('[kosmos] Sternkatalog nicht geladen, statistischer Himmel:', err); const f = createStarfield({ ngp, gc, gain: 0.9, seed: 11, band: 0 }); f.userData.setPixelRatio(pr); order(f, ORDER.sky); sky.add(f); rot.add(f); catalog = f; });
  const sunSky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms: { uSun: { value: sun } }, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }));
  sunSky.frustumCulled = false;
  scene.add(sunSky);

  // ---------- ferne Welt: Erde, Wolken, Polarlichter, Atmosphäre, Mond ----------
  const far = new THREE.Group();
  scene.add(far);
  const tilt = new THREE.Group();
  tilt.quaternion.copy(qTilt);
  far.add(tilt);
  const spin = new THREE.Group();
  tilt.add(spin);
  const axis = new THREE.Vector3();
  const maps = earthMaps(ctx);
  const earthU = {
    tDay: { value: maps.day }, tNight: { value: maps.night }, tRelief: { value: maps.relief }, tClouds: { value: maps.clouds },
    uSun: { value: sun }, uAxis: { value: axis }, uCloudU: { value: 0 }, uLights: { value: 2.6 }, uRelief: { value: 7 },
  };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R_E, 256, 128), new THREE.ShaderMaterial({ vertexShader: EARTH_VERT_O, fragmentShader: EARTH_FRAG, uniforms: earthU }));
  spin.add(earth);
  const cloudU = { tClouds: earthU.tClouds, uSun: { value: sun }, uAxis: { value: axis }, uCloudU: { value: 0 }, uTime: { value: 0 }, uGain: { value: 0.95 }, uOpacity: { value: 0.96 } };
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R_CLOUD, 256, 128), new THREE.ShaderMaterial({ vertexShader: EARTH_VERT_O, fragmentShader: CLOUD_FRAG_O, uniforms: cloudU, transparent: true, depthWrite: false }));
  spin.add(clouds);
  // Polarlicht-Oval wie Station 1 (geomagnetischer Nordpol 2025: 80,8° N, 72,8° W, IGRF-14)
  const GM = [80.8 * RAD, -72.8 * RAD];
  const sunL = new THREE.Vector3(1, 0, 0);
  const auroraU = { uPole: { value: new THREE.Vector3(Math.cos(GM[0]) * Math.cos(GM[1]), Math.sin(GM[0]), -Math.cos(GM[0]) * Math.sin(GM[1])) }, uSunL: { value: sunL }, uKp: { value: 4 }, uTime: { value: 0 }, uGain: { value: 1 }, uRp: { value: R_E } };
  const aurora = new THREE.Mesh(auroraGeometry(), new THREE.ShaderMaterial({ vertexShader: AURORA_VERT, fragmentShader: AURORA_FRAG, uniforms: auroraU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
  aurora.frustumCulled = false;
  const auroraGlow = new THREE.Mesh(new THREE.SphereGeometry(R_E + 0.11, 192, 96), new THREE.ShaderMaterial({ vertexShader: AURORA_GLOW_VERT, fragmentShader: AURORA_GLOW_FRAG, uniforms: auroraU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  spin.add(auroraGlow, aurora);
  // Atmosphäre: echte Skalenhöhe (≈ 8,5 km → uH 0,07 der 120-km-Hülle), Nachtleuchten in 95 km (uAirH 0,79); der Weg
  // durch die dünne Hülle ist relativ lang (∝ 1/Dicke, Leuchten quadratisch) → uAir viel kleiner als in Station 1
  const atmoU = { uSun: { value: sun }, uCenter: { value: new THREE.Vector3() }, uBeta: { value: new THREE.Vector3(0.1, 0.26, 0.72) }, uMieCol: { value: new THREE.Vector3(1.0, 0.95, 0.9) },
    uRp: { value: R_E }, uRa: { value: R_ATM }, uH: { value: 0.07 }, uGain: { value: 1.6 }, uMie: { value: 0.18 }, uAir: { value: 0.004 }, uAirH: { value: 0.79 } };
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R_ATM, 256, 128), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: ATMO_FRAG, uniforms: atmoU, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  far.add(atmo);
  const moonU = { tMoon: { value: ctx.tex('moon.jpg') }, uSun: { value: sun }, uEarth: { value: new THREE.Vector3() }, uEarthshine: { value: 0.0025 } };
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R_M, 64, 32), new THREE.ShaderMaterial({ vertexShader: EARTH_VERT, fragmentShader: MOON_FRAG, uniforms: moonU }));
  far.add(moon);

  // Bahnspur auf dem Boden (erdfest, spin): ein halber Umlauf zurück, anderthalb voraus
  const TN = 300, trackPos = new Float32Array((TN + 1) * 3), trackCol = new Float32Array((TN + 1) * 3);
  const trackG = new THREE.BufferGeometry();
  trackG.setAttribute('position', new THREE.BufferAttribute(trackPos, 3));
  trackG.setAttribute('color', new THREE.BufferAttribute(trackCol, 3));
  const track = new THREE.Line(trackG, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  track.frustumCulled = false;
  spin.add(track);
  const tc = new THREE.Color(color), tv = new THREE.Vector3();
  function updateTrack(days) {
    const per = periodMin(obj[0]) / 1440;
    for (let i = 0; i <= TN; i++) {
      const dd = days + (-0.5 + 2 * i / TN) * per;
      satPos(obj, dd, tv).applyAxisAngle(Y, -gmst(satJd + dd) * RAD).setLength(R_E + 0.015);
      trackPos.set([tv.x, tv.y, tv.z], i * 3);
      const f = i < TN / 4 ? 0.25 : 0.9 * (1 - 0.6 * (i - TN / 4) / (TN * 0.75));
      trackCol.set([tc.r * f, tc.g * f, tc.b * f], i * 3);
    }
    trackG.attributes.position.needsUpdate = trackG.attributes.color.needsUpdate = true;
  }

  order(sky, ORDER.sky); sunSky.renderOrder = ORDER.sky + 1;
  order(clouds, ORDER.far); order(auroraGlow, ORDER.far + 1); order(aurora, ORDER.far + 2); order(atmo, ORDER.far + 3); order(track, ORDER.far + 4);

  // Tiefenpuffer leeren, bevor die Station gezeichnet wird
  const hook = new THREE.Mesh(new THREE.PlaneGeometry(1e-6, 1e-6), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, transparent: true }));
  hook.frustumCulled = false;
  hook.renderOrder = ORDER.clear;
  hook.onBeforeRender = (r) => { r.state.buffers.depth.setMask(true); r.clearDepth(); };
  scene.add(hook);

  const flare = createFlare({ strength: 0.7 });
  order(flare, ORDER.flare);
  scene.add(flare);

  // ---------- Licht der Station: Sonne (mit Schatten), Erdschein von unten, Restlicht ----------
  ctx.renderer.shadowMap.enabled = true;   // nur Stationen mit castShadow-Licht nutzen die Schattenkarte; andere unverändert
  const sunLight = new THREE.DirectionalLight(0xffffff, 3);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunLight.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 1, far: radius * 4 });
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.04;
  scene.add(sunLight, sunLight.target);
  const night = new THREE.AmbientLight(0x6f86b8, 0);
  scene.add(night);
  // Erdschein als Umgebung: unten die Erde (bis 20° unter die Waagerechte, aus 400 km), Saum der Lufthülle, oben Schwarz;
  // spiegelnde Teile (Metall, Zellen) zeigen sie, Stärke folgt der Tagseite unter der Station
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({ side: THREE.BackSide,
    vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD;
void main() {
  float d = normalize(vD).y, hz = -0.34;
  vec3 c = vec3(0.3, 0.42, 0.62) * smoothstep(hz + 0.02, hz - 0.12, d) + vec3(0.35, 0.55, 1.0) * exp(-pow((d - hz) / 0.025, 2.0)) * 0.5;
  gl_FragColor = vec4(c, 1.0);
}` })));
  const pmrem = new THREE.PMREMGenerator(ctx.renderer);
  const envRT = pmrem.fromScene(envScene, 0, 0.1, 10);
  pmrem.dispose();
  envScene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  scene.environment = envRT.texture;
  const SUNSET = new THREE.Color(1.0, 0.45, 0.2), WHITE = new THREE.Color(1, 1, 1);
  let lit = -1, boost = true;

  // Schattengrenze von der Station aus: Winkel Sonne–Erdmitte gegen den Winkelradius der Erde; Übergang durch die Lufthülle
  // (≈ 2°), danach weich nachgeführt (≥ 0,5 s), damit der Zeitraffer nicht blitzt
  function sunState() {
    const rho = Math.asin(R_E / P.length()), th = Math.acos(THREE.MathUtils.clamp(-sun.y, -1, 1));
    const t = THREE.MathUtils.smoothstep(th, rho - 0.3 * RAD, rho + 2.0 * RAD);
    const red = 1 - THREE.MathUtils.smoothstep(th, rho + 0.2 * RAD, rho + 3.0 * RAD);
    return { t, red };
  }
  // nächster Wechsel Tag/Nacht: Zylinderschatten der Erde entlang der Bahn
  const inShadow = (p) => p.dot(sunFar) < 0 && p.lengthSq() - p.dot(sunFar) ** 2 < R_E * R_E;
  function nextEvent() {
    const days = jd - satJd, step = 15 / 86400, now = inShadow(satPos(obj, days, tv).applyQuaternion(qTilt));
    for (let i = 1; i < 480; i++) if (inShadow(satPos(obj, days + i * step, tv).applyQuaternion(qTilt)) !== now) return { rise: now, min: i * step * 1440 };
    return null;
  }

  // ---------- Abzeichen der Erde (Lage in Szenen-Metern, jedes Bild nachgeführt) ----------
  const spots = { horizon: new THREE.Vector3(), below: new THREE.Vector3(), sun: new THREE.Vector3(), moon: new THREE.Vector3() };
  const hv = new THREE.Vector3();
  function placeSpots(cam) {
    const r = P.length(), phi = Math.acos(R_E / r);
    hv.copy(fwd).multiplyScalar(0.55).addScaledVector(stb, 0.83).normalize();
    spots.horizon.copy(up).multiplyScalar(Math.cos(phi)).addScaledVector(hv, Math.sin(phi)).multiplyScalar(R_E + 0.03);
    far.localToWorld(spots.horizon);
    spots.below.copy(up).multiplyScalar(R_E);
    far.localToWorld(spots.below);
    spots.sun.copy(sun).multiplyScalar(radius * 6).add(cam.position);
    spots.moon.copy(moonFar);
    far.localToWorld(spots.moon);
  }

  let wT = -1, trackT = -1, nextT = -1;
  const ready = Promise.all([skyReady, loadSats().then((d) => {
    const i = namedIndex(d, sat);
    if (i >= 0) { obj = d.obj[i]; satJd = d.jd; }
  }).catch((err) => console.warn('[kosmos] Bahnelemente nicht geladen, Ersatzbahn:', err))]).then(() => { placeFrame(); updateTrack(jd - satJd); });
  placeFrame();

  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  // Breite/Länge als Text, z. B. „48,1° N · 11,6° O“
  const deg = (x) => Math.abs(x).toFixed(1).replace('.', ',');
  const where = () => `${deg(info.lat)}° ${info.lat >= 0 ? 'N' : 'S'} · ${deg(info.lon)}° ${info.lon >= 0 ? 'O' : 'W'}`;
  const tmpQ = new THREE.Quaternion();
  const occluders = [{ center: new THREE.Vector3(), radius: 1 }];
  const sunFarPt = new THREE.Vector3();

  return {
    scene, camera, far, sun, spots, info, SPEEDS,
    get lit() { return lit; },
    get jd() { return jd; },
    ready,
    layers: {
      clock: (station) => ({ id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', hint: `Umlauf der ${station}, Erddrehung, Sonnenauf- und -untergänge im gewählten Tempo; Pause = Echtzeit.`,
        value: spd, min: 0, max: SPEEDS.length - 1, step: 1, autoplay: true, fmt: (i) => SPEEDS[Math.round(i)][1],
        set: (i, on) => { spd = Math.round(i); playing = on; }, get: () => ({ value: spd, playing }),
        status: () => `${fmt.format(new Date((jd - 2440587.5) * 864e5))}${playing && spd ? '' : ' · Echtzeit'}` }),
      earth: () => [
        { id: 'clouds', type: 'toggle', group: 'Erde', label: 'Wolkenschicht', value: true, set: (v) => { clouds.visible = v; } },
        { id: 'aurora', type: 'toggle', label: 'Polarlichter', value: true, set: (v) => { aurora.visible = auroraGlow.visible = v; } },
        { id: 'kp', type: 'range', label: 'Kp-Index', value: 4, min: 0, max: 9, step: 1, sub: true, fmt: (v) => `Kp ${v}`, set: (v) => { auroraU.uKp.value = v; },
          hint: 'Geomagnetische Aktivität: je höher, desto weiter reicht das Oval zum Äquator (NOAA).' },
        { id: 'lights', type: 'range', label: 'Stadtlichter', value: 2.6, min: 0, max: 5, step: 0.1, fmt: (v) => `${Math.round(v / 2.6 * 100)} %`, set: (v) => { earthU.uLights.value = v; } },
        { id: 'atmo', type: 'toggle', label: 'Lufthülle am Horizont', value: true, set: (v) => { atmo.visible = v; } },
      ],
    },
    setSpeed(i) { spd = i; playing = i > 0; },
    get speed() { return playing ? spd : 0; },
    setTrack(v) { track.visible = v; },
    setBoost(v) { boost = v; },
    update(dt, t, cam, flying) {
      jd += (playing && !flying ? SPEEDS[spd][0] : 1) * dt / 86400;
      placeFrame();
      const days = jd - satJd;
      // Nahebene mit dem Abstand zur Station; die ferne Welt um die Kamera auf k = near/500 verkleinert
      const d = cam.position.length();
      const near = THREE.MathUtils.clamp((d - radius) * 0.25, 0.05, 200);
      if (Math.abs(near - camera.near) / camera.near > 0.05) { camera.near = near; k = near / 500; camera.far = Math.max(k * 5e8, (d + radius) * 2); camera.updateProjectionMatrix(); }
      const S = k * KM;
      far.scale.setScalar(S);
      far.quaternion.copy(qT);
      far.position.copy(P).multiplyScalar(-S).applyQuaternion(qT).addScaledVector(cam.position, 1 - k);
      far.updateMatrixWorld(true);
      spin.rotation.y = gmst(jd) * RAD;
      spin.updateMatrixWorld(true);
      axis.copy(Y).applyQuaternion(qTilt).applyQuaternion(qT);
      atmoU.uCenter.value.copy(far.position);
      atmoU.uRp.value = R_E * S; atmoU.uRa.value = R_ATM * S;
      moon.position.copy(moonFar);
      moonU.uEarth.value.copy(moonFar).negate().normalize().applyQuaternion(qT);
      earthU.uCloudU.value = cloudU.uCloudU.value = (jd - 2461339.5) * 0.004;
      cloudU.uTime.value = auroraU.uTime.value = t * (ctx.still ? 0.2 : 1);
      spin.getWorldQuaternion(tmpQ);
      sunL.copy(sun).applyQuaternion(tmpQ.invert());
      rot.set(qT);
      if (t - trackT > 0.5 || spd >= 3) { trackT = t; updateTrack(days); }
      // Licht: Tag/Nacht weich nachgeführt, Abend- und Morgenrot an der Schattengrenze, Erdschein nach der Tagseite unter uns
      const st = sunState();
      lit = lit < 0 ? st.t : lit + (st.t - lit) * (1 - Math.exp(-dt / 0.5));
      sunLight.color.copy(WHITE).lerp(SUNSET, st.red * 0.8);
      sunLight.intensity = 3.2 * lit;
      sunLight.position.copy(sun).multiplyScalar(radius * 2);
      const day = THREE.MathUtils.smoothstep(up.dot(sunFar), -0.35, 0.75);
      scene.environmentIntensity = 0.05 + 1.25 * day;
      night.intensity = boost ? 0.45 * (1 - lit) * (1 - day) + 0.04 : 0.02;
      // Linsenreflex der Sonne, von der Erde verdeckt
      occluders[0].center.copy(far.position); occluders[0].radius = R_E * S;
      sunFarPt.copy(sun).multiplyScalar(k * 1e9).add(cam.position);
      cam.updateMatrixWorld();
      flare.userData.update(sunFarPt, cam, occluders, settings.S.lens, dt);
      placeSpots(cam);
      // Kennwerte für Infotafel und Widget
      const rkm = satPos(obj, days, tv).length() * 1e3;
      info.alt = rkm - RE; info.v = speedAt(obj[0], rkm); info.period = periodMin(obj[0]);
      tv.applyAxisAngle(Y, -gmst(jd) * RAD);
      info.lat = Math.asin(tv.y / tv.length()) / RAD; info.lon = Math.atan2(-tv.z, tv.x) / RAD;
      info.beta = Math.asin(THREE.MathUtils.clamp(sun.z, -1, 1)) / RAD;
      if (t - nextT > 1) { nextT = t; info.next = nextEvent(); }
    },
    // Breite/Länge als Text, z. B. „48,1° N · 11,6° O“
    where,
    dateText: () => fmt.format(new Date((jd - 2440587.5) * 864e5)),
    widgetTick(el, t, rows) {
      if (t - wT < 0.5) return;
      wT = t;
      const n = info.next;
      el.querySelector('#w-orb').innerHTML = `<tr><td>Höhe · Geschwindigkeit</td><td class="num">${Math.round(info.alt)} km · ${info.v.toFixed(2).replace('.', ',')} km/s</td></tr>
        <tr><td>über</td><td class="num">${where()}</td></tr>
        <tr class="${lit > 0.5 ? '' : 'is-hi'}"><td>${lit > 0.5 ? 'Tag' : 'Nacht (Erdschatten)'}</td><td class="num">${n ? `${n.rise ? 'Sonnenaufgang' : 'Sonnenuntergang'} in ${Math.max(1, Math.round(n.min))} min` : '–'}</td></tr>
        ${rows ? rows() : ''}`;
    },
    setPixelRatio(p) { pr = p; band.userData.setPixelRatio(p); if (catalog) catalog.userData.setPixelRatio(p); },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
      if (sunLight.shadow.map) sunLight.shadow.map.dispose();
      envRT.dispose();
    },
  };
}
