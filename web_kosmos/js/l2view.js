// Am Lagrange-Punkt L2 – gemeinsamer Teil der Teleskop-Stationen JWST (01E), Euclid (01F) und Roman (01G). Die Szene hängt
// am Sonne-Erde-System, das sich einmal im Jahr mitdreht (Meter; x zur Sonne, y Ekliptik-Nord, z = x × y): Sonne und
// Erde stehen fast fest, die Sterne ziehen in einem Jahr einmal herum. L2 liegt 1,5 Mio. km hinter der Erde auf der
// Linie Sonne–Erde; die Teleskope kreisen darum auf einer Halo-Bahn, ≈ 6 Monate je Umlauf. Ort zum Datum aus den
// JPL-Horizons-Bahndaten (l2track.js, web/data/l2.json); nur außerhalb ihrer Spanne als Modell: Ellipse quer zur Linie
// mit den Eckwerten der Mission. Darum steht die Erde nie vor der Sonne, sondern einige Grad daneben als schmale
// Sichel – wir sehen vor allem ihre Nachtseite mit den Stadtlichtern; der Mond kreist daneben (echter Ort zum Datum).
// Tiefenpuffer wie in orbitview.js: die ferne Welt (Erde, Mond; Einheit 1.000 km) wird um die Kamera auf FAR m
// verkleinert (gleiche Winkelgröße), zuerst gezeichnet; danach löscht ein Haken den Tiefenpuffer, dann folgt das
// Teleskop. Teleskopteile brauchen deshalb `transparent: true` (stationkit.js, stationMat in orbitview.js).

import * as THREE from 'three';
import { PLANETS, julianDate, planetPosition, eclToScene, eclDir, moonPosition, gmst, OBLIQUITY } from './astro.js';
import { createStarfield } from './stars.js';
import { createCatalogSky } from './catalog.js';
import { createFlare } from './flare.js';
import { settings } from './settings.js';
import { EARTH_VERT_O, EARTH_FRAG, earthMaps, EARTH_VERT, MOON_FRAG, SUN_VERT, SUN_FRAG } from './levels/earth.js';
import { ORDER } from './orbitview.js';
import { spinAxis } from './axes.js';
import { loadL2, trackAt } from './l2track.js';

const R_E = 6.371, R_M = 1.7374;    // [1.000 km] NASA Fact Sheets
const D_L2 = 1500;                  // Erde → L2 [1.000 km], rund 1,5 Mio. km (NASA, ESA)
const AU_K = 149597.8707;           // [1.000 km]
const C_KM = 299792.458;
const FAR = 3e4;                    // Abstand der verkleinerten Erde von der Kamera [m]
const RAD = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
// Zeitraffer [s je s]; der Halo-Umlauf dauert ≈ 6 Monate
export const SPEEDS = [[1, 'Echtzeit'], [3600, '1 h/s'], [86400, '1 Tag/s'], [604800, '1 Woche/s'], [2629800, '1 Monat/s']];

// Dreht Sternpunkte und Milchstraßenband mit dem Sonne-Erde-System (wie orbitview.js)
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

// craft: Schlüssel in l2.json (jwst, euclid, roman) – echte Orte, solange die Daten reichen; sonst Modell:
// halo: { ay, az, days, phase } – Halbachsen quer zur Linie Sonne–Erde [1.000 km] in der Ekliptik (y) und senkrecht dazu
// (z), Umlauf in Tagen, Phase zum JD 2461340 (Modell); trip: { launch, cruise, arrive } in JD = Anreise (Roman): bis
// `cruise` wächst der Abstand zur Erde, bis `arrive` schwingt die Halo-Bahn auf (Modell). radius = halbe Ausdehnung des
// Teleskops [m] (Schattenkamera, Nahebene)
export function createL2View(ctx, { craft, halo, trip = null, radius = 15 }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2e5);
  let jd = julianDate(ctx.date), spd = 1, playing = true;   // Start mit 1 h/s: Halo-Bahn und Erde wandern ruhig
  const earthP = PLANETS.find((p) => p.id === 'earth');

  // ---------- Bezugssystem: x zur Sonne, y Ekliptik-Nord (Szene der Ekliptik wie Station 1: Einheit 1.000 km) ----------
  const X = new THREE.Vector3(), Zv = new THREE.Vector3(), basis = new THREE.Matrix4(), qS = new THREE.Quaternion(), qT = new THREE.Quaternion();
  const T = new THREE.Vector3();          // Teleskop relativ zur Erde, Ekliptik-Szene [1.000 km]
  const off = new THREE.Vector3();        // Halo-Versatz im Bezugssystem [1.000 km]
  const sun = new THREE.Vector3(1, 0, 0), earthDir = new THREE.Vector3(-1, 0, 0), moonDir = new THREE.Vector3(), moonFar = new THREE.Vector3();
  const info = { dist: D_L2, fromL2: 0, angle: 0, phase: 0, moonDist: 0, trip: null, real: false };
  let track = null;
  const pos = [0, 0, 0];
  const tracked = loadL2().then((d) => { track = d.craft[craft] || null; })
    .catch((err) => console.warn('[kosmos] L2-Bahndaten nicht geladen, Modell:', err));
  const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -OBLIQUITY * RAD);
  const tmp = new THREE.Vector3();

  // Halo-Versatz und Anreise zum Zeitpunkt jd (Modell, siehe Kopf)
  function haloAt(j, out) {
    const ph = 2 * Math.PI * ((j - 2461340) / halo.days + halo.phase);
    let k = 1, along = 0;
    if (trip) {
      const s = THREE.MathUtils.clamp((j - trip.launch) / (trip.cruise - trip.launch), 0, 1);
      along = -D_L2 * (1 - (1 - s) * (1 - s));                                // abbremsend auf 1,5 Mio. km
      k = THREE.MathUtils.smoothstep(j, trip.cruise, trip.arrive);
    }
    out.set(trip ? along + D_L2 : 0, halo.ay * k * Math.sin(ph), halo.az * k * Math.cos(ph));
    info.phase = (((ph / (2 * Math.PI)) % 1) + 1) % 1;
    return out;
  }

  function place() {
    X.set(...eclToScene(planetPosition(earthP, jd))).multiplyScalar(-1).normalize();   // Erde → Sonne
    Zv.crossVectors(X, Y).normalize();
    basis.makeBasis(X, Y, Zv);
    qS.setFromRotationMatrix(basis);
    qT.copy(qS).invert();
    const p = track && trackAt(track, jd, pos);
    info.real = !!p;
    if (p) {
      // echter Ort (Ekliptik); Versatz von L2 im Bezugssystem für Kennwerte und Abzeichen
      T.set(...eclToScene(p));
      off.copy(T).applyQuaternion(qT);
      off.x += D_L2;
      info.phase = (Math.atan2(off.y, off.z) / (2 * Math.PI) + 1) % 1;
    } else {
      // Modell: L2 auf der Gegenseite der Sonne; Teleskop = L2 + Versatz (im Bezugssystem gerechnet, in die Ekliptik gedreht)
      haloAt(jd, off);
      T.set(-D_L2 + off.x, off.y, off.z).applyQuaternion(qS);
    }
    if (T.length() < R_E * 2) T.setLength(R_E * 2);                                      // Start: nie in der Erde
    if (trip) info.trip = jd < trip.arrive ? { day: Math.max(0, jd - trip.launch), of: trip.arrive - trip.launch } : null;
    const sunRel = tmp.copy(X).multiplyScalar(AU_K).sub(T);
    sun.copy(sunRel).normalize().applyQuaternion(qT);
    earthDir.copy(T).negate().normalize().applyQuaternion(qT);
    moonFar.set(...eclToScene(moonPosition(jd))).multiplyScalar(1e-3);
    moonDir.copy(moonFar).sub(T).normalize().applyQuaternion(qT);
    info.dist = T.length() * 1e3;
    info.fromL2 = Math.hypot(off.x, off.y, off.z) * 1e3;
    info.angle = Math.acos(THREE.MathUtils.clamp(sun.dot(earthDir), -1, 1)) / RAD;
    info.moonDist = moonFar.distanceTo(T) * 1e3;
  }

  const order = (o, r) => o.traverse((x) => { x.renderOrder = r; });

  // ---------- Himmel, Sonne ----------
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

  // ---------- ferne Welt: Erde mit Nachtseite und Stadtlichtern, Mond ----------
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
    uSun: { value: sun }, uAxis: { value: axis }, uCloudU: { value: 0 }, uLights: { value: 2.6 }, uRelief: { value: 4 },
  };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R_E, 128, 64), new THREE.ShaderMaterial({ vertexShader: EARTH_VERT_O, fragmentShader: EARTH_FRAG, uniforms: earthU }));
  spin.add(earth);
  spinAxis(earth);
  const moonU = { tMoon: { value: ctx.tex('moon.jpg') }, uSun: { value: sun }, uEarth: { value: new THREE.Vector3() }, uEarthshine: { value: 0.0025 } };
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R_M, 64, 32), new THREE.ShaderMaterial({ vertexShader: EARTH_VERT, fragmentShader: MOON_FRAG, uniforms: moonU }));
  far.add(moon);
  spinAxis(moon);
  order(sky, ORDER.sky); sunSky.renderOrder = ORDER.sky + 1;
  order(far, ORDER.far);

  const hook = new THREE.Mesh(new THREE.PlaneGeometry(1e-6, 1e-6), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, transparent: true }));
  hook.frustumCulled = false;
  hook.renderOrder = ORDER.clear;
  hook.onBeforeRender = (r) => { r.state.buffers.depth.setMask(true); r.clearDepth(); };
  scene.add(hook);

  const flare = createFlare({ strength: 0.7 });
  order(flare, ORDER.flare);
  scene.add(flare);

  // ---------- Licht: Sonne (mit Schatten), Aufhellung der kalten Seite (Darstellung), Umgebung ----------
  ctx.renderer.shadowMap.enabled = true;
  const sunLight = new THREE.DirectionalLight(0xfff6ea, 3.4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunLight.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 1, far: radius * 4 });
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight, sunLight.target);
  // Echt liegt die Seite hinter dem Sonnenschild im Dunkeln (nur Sternlicht); aufgehellt von schräg vorn, kühl getönt
  const fill = new THREE.DirectionalLight(0x9fb6e8, 0);
  scene.add(fill, fill.target);
  const night = new THREE.AmbientLight(0x6f86b8, 0);
  scene.add(night);
  // Umgebung für Spiegel und Folien: schwarzer Himmel mit hellem Hof Richtung Sonne und schwachem Studio-Schimmer
  // auf der Gegenseite (Darstellung – sonst spiegelte der Goldspiegel nur Schwarz)
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({ side: THREE.BackSide,
    vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD;
void main() {
  vec3 d = normalize(vD);
  vec3 c = vec3(1.0, 0.95, 0.88) * pow(max(d.x, 0.0), 6.0) * 2.0 + vec3(0.62, 0.66, 0.78) * smoothstep(0.2, -0.8, d.x) * (0.55 + 0.45 * d.y) + vec3(0.05, 0.055, 0.07);
  gl_FragColor = vec4(c, 1.0);
}` })));
  const pmrem = new THREE.PMREMGenerator(ctx.renderer);
  const envRT = pmrem.fromScene(envScene, 0, 0.1, 10);
  pmrem.dispose();
  envScene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  scene.environment = envRT.texture;
  let boost = true;

  // ---------- Abzeichen am Himmel (Lage in Szenen-Metern, jedes Bild nachgeführt) ----------
  const spots = { earth: new THREE.Vector3(), moon: new THREE.Vector3(), sun: new THREE.Vector3(), l2: new THREE.Vector3() };
  const occluders = [{ center: new THREE.Vector3(), radius: 1 }];
  const sunFarPt = new THREE.Vector3();
  const ready = Promise.all([skyReady, tracked]).then(() => place());
  place();

  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  const de = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  let wT = -1;

  return {
    scene, camera, sun, earthDir, moonDir, spots, info, SPEEDS,
    get jd() { return jd; },
    ready,
    layers: {
      clock: (name) => ({ id: 'clock', type: 'play', group: 'Zeit', label: 'Zeitraffer', hint: `Umlauf von ${name} um L2 (≈ 6 Monate), Erde und Mond am Himmel, Sterne ziehen in einem Jahr einmal herum; Pause = Echtzeit.`,
        value: spd, min: 0, max: SPEEDS.length - 1, step: 1, autoplay: true, fmt: (i) => SPEEDS[Math.round(i)][1],
        set: (i, on) => { spd = Math.round(i); playing = on; }, get: () => ({ value: spd, playing }),
        status: () => `${fmt.format(new Date((jd - 2440587.5) * 864e5))}${playing && spd ? '' : ' · Echtzeit'}` }),
      earth: () => [
        { id: 'lights', type: 'range', group: 'Erde am Himmel', label: 'Stadtlichter', value: 2.6, min: 0, max: 10, step: 0.1, fmt: (v) => `${Math.round(v / 2.6 * 100)} %`, set: (v) => { earthU.uLights.value = v; },
          hint: 'Von L2 aus sehen wir fast nur die Nachtseite der Erde – mit 0,5° etwa so groß wie der Vollmond von der Erde aus.' },
      ],
      boost: (what) => ({ id: 'boost', type: 'toggle', group: 'Licht', label: 'Kalte Seite aufhellen', hint: `Echt liegt ${what} hinter dem Sonnenschild fast im Dunkeln (nur Sternlicht); aufgehellt bleibt es erkennbar.`, value: true, set: (v) => { boost = v; } }),
    },
    setSpeed(i) { spd = i; playing = i > 0; },
    get speed() { return playing ? spd : 0; },
    update(dt, t, cam, flying) {
      jd += (playing && !flying ? SPEEDS[spd][0] : 1) * dt / 86400;
      place();
      // ferne Welt: um die Kamera auf FAR m verkleinert (Richtungen und Winkelgrößen bleiben)
      const S = FAR / info.dist * 1e3;
      far.scale.setScalar(S);
      far.quaternion.copy(qT);
      far.position.copy(T).multiplyScalar(-S).applyQuaternion(qT).add(cam.position);
      far.updateMatrixWorld(true);
      spin.rotation.y = gmst(jd) * RAD;
      axis.copy(Y).applyQuaternion(qTilt).applyQuaternion(qT);
      moon.position.copy(moonFar);
      moonU.uEarth.value.copy(moonFar).negate().normalize().applyQuaternion(qT);
      earthU.uCloudU.value = (jd - 2461339.5) * 0.004;
      rot.set(qT);
      sunLight.position.copy(sun).multiplyScalar(radius * 2);
      fill.position.set(-0.6, 0.55, 0.6).multiplyScalar(radius * 2);
      fill.intensity = boost ? 1.7 : 0;
      night.intensity = boost ? 0.35 : 0.015;
      scene.environmentIntensity = boost ? 1.1 : 0.2;
      // Linsenreflex der Sonne, die Erdscheibe kann sie nur streifen (Halo-Bahn hält Abstand)
      occluders[0].center.copy(earthDir).multiplyScalar(FAR).add(cam.position); occluders[0].radius = R_E * S;
      sunFarPt.copy(sun).multiplyScalar(1e5).add(cam.position);
      cam.updateMatrixWorld();
      flare.userData.update(sunFarPt, cam, occluders, settings.S.lens, dt);
      spots.earth.copy(earthDir).multiplyScalar(FAR).add(cam.position);
      spots.moon.copy(moonDir).multiplyScalar(FAR).add(cam.position);
      spots.sun.copy(sun).multiplyScalar(radius * 8).add(cam.position);
      // Richtung zum Punkt L2 (Mitte der Halo-Bahn); am Ziel der Anreise ohne Versatz → seitlich der Erde
      if (off.lengthSq() > 1) spots.l2.copy(off).negate().normalize().multiplyScalar(FAR).add(cam.position);
      else spots.l2.copy(earthDir).negate().multiplyScalar(FAR).add(cam.position);
    },
    dateText: () => fmt.format(new Date((jd - 2440587.5) * 864e5)),
    // Kennwerte als Tabellenzeilen; rows() hängt eigene Zeilen an
    widgetTick(el, t, rows) {
      if (t - wT < 0.5) return;
      wT = t;
      const tr = info.trip;
      el.querySelector('#w-l2').innerHTML = `${tr ? `<tr class="is-hi"><td>Anreise nach L2${info.real ? '' : ' (Modell)'}</td><td class="num">Tag ${Math.floor(tr.day)} von ≈ ${Math.round(tr.of)}</td></tr>` : ''}
        <tr><td>Entfernung zur Erde</td><td class="num">${de(Math.round(info.dist / 1000) * 1000)} km</td></tr>
        <tr><td>Funk bis zur Erde</td><td class="num">${de(info.dist / C_KM, 1)} s</td></tr>
        <tr><td>Abstand von L2</td><td class="num">${de(Math.round(info.fromL2 / 1000) * 1000)} km</td></tr>
        <tr><td>Erde neben der Sonne</td><td class="num">${de(info.angle, 1)}°</td></tr>
        <tr><td>Ort aus</td><td class="num">${info.real ? 'JPL-Bahndaten' : 'Modell'}</td></tr>
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

// Blick „Außen“ ↔ „Zur Erde“: Kamera wechselt weich zu einem Augenpunkt `eye` (Szenen-Meter) mit engem Blickwinkel `fov`
// Richtung Erde (folgt ihr, solange der Blick gilt); home/orbit = Heimpose und Grenzen der Station
export function earthLook(ctx, ov, { home, orbit, eye, fov = 3 }) {
  const camera = ov.camera;
  const view = { mode: 'out', t: 1, from: null, fov0: 40 };
  const goalT = new THREE.Vector3();
  const ease = (x) => x * x * (3 - 2 * x);
  return {
    get mode() { return view.mode; },
    set(v) { view.mode = v; view.t = 0; view.from = null; },
    orbitUpdate(c, dt) {
      const o = c.object;
      let free;
      goalT.copy(eye).addScaledVector(ov.earthDir, 0.5);
      if (view.t < 1) {
        if (!view.from) {
          view.from = { pos: o.position.clone(), target: c.target.clone(), fov: camera.fov };
          if (view.mode === 'earth' && camera.fov !== fov) view.fov0 = camera.fov;
          free = 'free';
          Object.assign(c, { minDistance: 0, maxDistance: Infinity, minPolarAngle: 0, maxPolarAngle: Math.PI });
        }
        const goal = view.mode === 'earth' ? { pos: eye, target: goalT } : home;
        view.t = Math.min(1, view.t + dt / (ctx.still ? 0.5 : 2.6));
        const e = ease(view.t);
        const fd = view.from.pos.distanceTo(view.from.target), gd = goal.pos.distanceTo(goal.target);
        c.target.lerpVectors(view.from.target, goal.target, e);
        const dir = view.from.pos.clone().sub(view.from.target).normalize().lerp(goal.pos.clone().sub(goal.target).normalize(), e).normalize();
        o.position.copy(c.target).addScaledVector(dir, Math.exp(Math.log(fd) + (Math.log(gd) - Math.log(fd)) * e));
        o.lookAt(c.target);
        camera.fov = THREE.MathUtils.lerp(view.from.fov, view.mode === 'earth' ? fov : view.fov0, e);
        camera.updateProjectionMatrix();
        if (view.t >= 1) {
          if (view.mode === 'earth') Object.assign(c, { minDistance: 0.49, maxDistance: 0.51, maxPolarAngle: Math.PI });
          else Object.assign(c, orbit, { maxPolarAngle: Math.PI });
        }
      } else if (view.mode === 'earth') {
        // Nachführen: die Erde wandert im Zeitraffer über den Himmel
        c.target.copy(goalT);
        o.position.copy(eye);
        if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      }
      return free;
    },
  };
}
