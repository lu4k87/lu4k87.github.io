// Station 02C: Jupiter & Monde (Einheit 1 Jupiterradius = 71.492 km), Abstecher vom Sonnensystem. Jupiter abgeplattet
// (Polradius 66.854 km), Bänder mit strömendem Detail (planetfx.js uBand), Atmosphäre als Hülle, Drehung in 9 h 55 min.
// Die vier Galileischen Monde auf ihren Bahnen zum Datum (jovian.js: JPL-Mittelwerte, Raten nach Lieske 1998), gebunden
// rotierend (Länge 0° zu Jupiter). Licht als Parallelstrahl aus der berechneten Sonnenrichtung; Finsternisse aus der
// Scheibenüberdeckung (planetfx.js eclipse): Mondschatten auf Jupiter, Jupiterschatten auf den Monden. Heimpose: Jupiter am
// Bildrand angeschnitten, Licht von der Seite, möglichst viele innere Monde im Bild (aus den Orten zum Datum gewählt).

import * as THREE from 'three';
import { julianDate, equToScene, eclDir, laplaceAxes, laplaceLongitude } from '../astro.js';
import { createStarfield } from '../stars.js';
import { BODY_VERT, SHELL_VERT, PLANET_FRAG, ATMO_FRAG, ATMOS } from '../planetfx.js';
import { registerLayers, refreshLayers } from '../layers.js';
import { STATIONS } from '../content.js';
import { JUPITER, GALILEAN, MOON_IDS, jovianState, laplaceAngle, nextShadowTransit } from '../jovian.js';

const RJ = JUPITER.r;                         // km je Szeneneinheit
const FLAT = JUPITER.rp / JUPITER.r;          // 0,935 (Abplattung 0,06487, NSSDCA)
const TAU = Math.PI * 2;
// Monde: Name, Bahnfarbe, Länge 0° in der Karte (u; Io −180…180 → Mitte, sonst 0…360 → Rand), Gewicht für die Heimpose
const MOON = {
  io: { name: 'Io', col: 0xe8c860, u0: 0.5, w: 3 },
  europa: { name: 'Europa', col: 0xd8d0bc, u0: 0, w: 2.5 },
  ganymede: { name: 'Ganymed', col: 0xb0a490, u0: 0, w: 1.5 },
  callisto: { name: 'Kallisto', col: 0x8c8274, u0: 0, w: 1 },
};
const VIS = 3;   // „Anschaulich“: Monde dreifach vergrößert (Bahnen maßstäblich)
// Zeitraffer [Tage je Sekunde]; Eintrag 0 = Stopp (nur Regler der Infotafel)
const SPEEDS = [[0, 'Stopp'], [1 / 144, '10 min/s'], [1 / 24, '1 h/s'], [0.25, '6 h/s'], [1, '1 Tag/s'], [4, '4 Tage/s']];
// Großer Roter Fleck in jupiter.jpg (Solar System Scope): Mitte bei u = 0,367, v = 0,393 (≈ 20° S), aus der Karte bestimmt
const GRS_UV = [0.367, 0.393];
const uvDir = (u, v) => {
  const phi = u * TAU, th = (1 - v) * Math.PI;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
};
const azimuth = (v) => Math.atan2(-v.z, v.x);   // Winkel, um den rotation.y einen Punkt um die y-Achse weiterdreht

// Bahn mit Leuchtspur hinter dem Mond (mfrac = Anteil des Umlaufs ab Start)
const ORBIT_VERT = /* glsl */ `
attribute float mfrac;
uniform float uPhase;
varying float vA;
void main() {
  float d = fract(uPhase - mfrac);
  vA = 0.14 + 0.86 * pow(1.0 - d, 10.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const ORBIT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
varying float vA;
void main() { gl_FragColor = vec4(uColor * vA * uGain, 1.0); }
`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.08, 'rgba(255,248,230,0.9)');
  grd.addColorStop(0.3, 'rgba(255,230,190,0.18)');
  grd.addColorStop(1, 'rgba(255,220,180,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const planetU = (map, o) => ({
  tMap: { value: map }, tNight: { value: null }, tClouds: { value: null }, tSpec: { value: null }, tRing: { value: null },
  uHasEarth: { value: 0 }, uCloudU: { value: 0 }, uGain: { value: 1 }, uRing: { value: 0 }, uRingIn: { value: 0 }, uRingOut: { value: 0 },
  uInv: { value: new THREE.Matrix4() }, uWrap: { value: o.wrap ?? 0.02 }, uAmb: { value: o.amb ?? 0.02 }, uBand: { value: o.band ?? 0 }, uTime: { value: 0 },
  uMoon: { value: o.moon ? 1 : 0 }, uEarthPos: { value: new THREE.Vector3() }, uEarthshine: { value: o.shine ?? 0 },
  uTerm: { value: new THREE.Vector3(...(o.term ?? [1, 0.85, 0.7])) }, uSunDir: { value: o.sun }, uSunAng: { value: 0 },
  uOcc: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) }, uOccN: { value: 0 },
});

export function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 3000);
  scene.add(createStarfield({ ngp: new THREE.Vector3(...eclDir(180.02, 29.81)), gc: new THREE.Vector3(...eclDir(266.84, -5.54)), gain: 0.75, seed: 41 }));
  const stars = scene.children[0];
  const jd0 = julianDate(ctx.date);
  let jd = jd0;
  let st = jovianState(jd);
  const sunDir = new THREE.Vector3(...st.sun);
  const pole = new THREE.Vector3(...equToScene(...JUPITER.pole)).normalize();
  const lap = laplaceAxes(GALILEAN.io.ra, GALILEAN.io.dec);
  const lapX = new THREE.Vector3(...lap.x), lapY = new THREE.Vector3(...lap.y);

  // ---------- Jupiter ----------
  const A = ATMOS.jupiter;
  const tilt = new THREE.Group();
  tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pole);
  scene.add(tilt);
  const jupU = planetU(ctx.tex('jupiter.jpg'), { sun: sunDir, wrap: A.wrap, term: A.term, band: 1, amb: 0.02 });
  jupU.uOccN.value = 4;
  const jup = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 96), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: jupU }));
  jup.scale.set(1, FLAT, 1);
  tilt.add(jup);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(A.ra, 128, 64), new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: ATMO_FRAG, uniforms: {
    uSun: { value: sunDir }, uCenter: { value: new THREE.Vector3() }, uBeta: { value: new THREE.Vector3(...A.beta) }, uMieCol: { value: new THREE.Vector3(...A.mieCol) },
    uRp: { value: 1 }, uRa: { value: A.ra }, uH: { value: A.h }, uGain: { value: A.gain }, uMie: { value: A.mie }, uAir: { value: 0 }, uAirH: { value: 0.2 } },
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  shell.scale.set(1, FLAT, 1);
  tilt.add(shell);

  // ---------- Sonne (Richtung echt; 5,2 AE entfernt nur ein heller Punkt mit Lichthof) ----------
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff1da, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sun.scale.setScalar(1500 * 0.05);
  scene.add(sun);

  // ---------- Monde ----------
  const moons = MOON_IDS.map((id) => {
    const el = GALILEAN[id], m = MOON[id], aR = el.a / RJ;
    const u = planetU(ctx.tex(`${id}.jpg`), { sun: sunDir, moon: true, shine: 0.7 / (aR * aR), amb: 0.012 });
    u.uOcc.value[0].set(0, 0, 0, 1);
    u.uOccN.value = 1;
    const holder = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: PLANET_FRAG, uniforms: u }));
    mesh.rotation.y = (0.5 - m.u0) * TAU;    // Länge 0° nach +x (zu Jupiter)
    holder.add(mesh);
    scene.add(holder);
    // Bahn über einen Umlauf ab Start (Umlaufzeit aus der Rate der mittleren Länge)
    const P = 360 / el.n, N = 512, pts = new Float32Array(N * 3), mf = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const p = jovianState(jd0 + (P * i) / N).moons[id];
      pts.set([p[0] / RJ, p[1] / RJ, p[2] / RJ], i * 3);
      mf[i] = i / N;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    g.setAttribute('mfrac', new THREE.BufferAttribute(mf, 1));
    const om = new THREE.ShaderMaterial({ vertexShader: ORBIT_VERT, fragmentShader: ORBIT_FRAG, uniforms: { uPhase: { value: 0 }, uColor: { value: new THREE.Color(m.col) }, uGain: { value: 0.55 } },
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const orbit = new THREE.LineLoop(g, om);
    scene.add(orbit);
    return { id, el, m, P, holder, mesh, u, om, orbit, pos: new THREE.Vector3(), r: 1 };
  });
  const M = Object.fromEntries(moons.map((x) => [x.id, x]));

  // ---------- Zustand ----------
  let real = false, spdIdx = 1, playing = !ctx.still, shadowsOn = true;
  const basis = new THREE.Matrix4(), bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3();
  function applySizes() { moons.forEach((x) => { x.r = (x.el.r / RJ) * (real ? 1 : VIS); x.holder.scale.setScalar(x.r); }); }
  applySizes();
  // Drehung: Phase so gewählt, dass der Große Rote Fleck zum Start auf der Tagseite zur Kamera steht (seine echte Länge driftet)
  let rot0 = 0;
  const rotAt = (t) => rot0 + ((t - jd0) * 24 / JUPITER.rot) * TAU;
  function place() {
    st = jovianState(jd);
    sunDir.set(...st.sun);
    sun.position.copy(sunDir).multiplyScalar(1500);
    jupU.uSunAng.value = st.sunAng;
    jup.rotation.y = rotAt(jd) % TAU;
    moons.forEach((x, i) => {
      const p = st.moons[x.id];
      x.pos.set(p[0] / RJ, p[1] / RJ, p[2] / RJ);
      x.holder.position.copy(x.pos);
      // gebundene Rotation: +x zu Jupiter, +y zum Pol der Bahn
      bx.copy(x.pos).negate().normalize();
      by.copy(pole).addScaledVector(bx, -pole.dot(bx)).normalize();
      bz.crossVectors(bx, by);
      x.holder.quaternion.setFromRotationMatrix(basis.makeBasis(bx, by, bz));
      x.u.uSunAng.value = st.sunAng;
      x.om.uniforms.uPhase.value = (((jd - jd0) / x.P) % 1 + 1) % 1;
      jupU.uOcc.value[i].set(x.pos.x, x.pos.y, x.pos.z, x.r);
    });
    jupU.uOccN.value = shadowsOn ? 4 : 0;
    moons.forEach((x) => { x.u.uOccN.value = shadowsOn ? 1 : 0; });
  }
  place();

  // ---------- Heimpose: Jupiter am linken oder rechten Rand angeschnitten, Licht von der Seite, innere Monde im Bild ----------
  const DIST = 3.4, TURN = 11 * Math.PI / 180, EL = 9 * Math.PI / 180;
  const e1 = new THREE.Vector3().crossVectors(pole, sunDir).normalize(), e2 = new THREE.Vector3().crossVectors(e1, pole);
  const tmp = new THREE.Vector3(), ray = new THREE.Vector3();
  const hidden = (C, p) => {
    // Strahl Kamera → Punkt trifft Jupiter vorher?
    ray.copy(p).sub(C);
    const L = ray.length();
    ray.divideScalar(L);
    const b = C.dot(ray), c = C.lengthSq() - 1, h = b * b - c;
    return h > 0 && -b - Math.sqrt(h) > 0 && -b - Math.sqrt(h) < L;
  };
  let best = { s: -Infinity };
  for (let k = 0; k < 72; k++) {
    const az = (k / 72) * TAU;
    const d = e2.clone().multiplyScalar(Math.cos(az)).addScaledVector(e1, Math.sin(az)).multiplyScalar(Math.cos(EL)).addScaledVector(pole, Math.sin(EL)).normalize();
    const phase = Math.acos(THREE.MathUtils.clamp(d.dot(sunDir), -1, 1)) * 180 / Math.PI;
    if (phase < 40 || phase > 105) continue;
    const C = d.clone().multiplyScalar(DIST);
    // Blick nach rechts gedreht: Jupiter am linken Rand (rechts liegt am Desktop die Infotafel)
    const f = d.clone().negate().applyAxisAngle(pole, -TURN);
    const right = new THREE.Vector3().crossVectors(f, pole).normalize();
    // Licht von der offenen Bildseite (Tagseite zur Bildmitte, Nachtrand unter der Stationsliste)
    if (sunDir.dot(right) < 0.2) continue;
    let s = -Math.abs(phase - 70) / 60;
    for (const x of moons) {
      tmp.copy(x.pos).sub(C);
      const along = tmp.dot(f), dist = tmp.length();
      if (along < 0.6 || dist < 0.8 || hidden(C, x.pos)) continue;
      if (Math.acos(along / dist) < 27 * Math.PI / 180) s += x.m.w;
    }
    if (s > best.s) best = { s, C, f };
  }
  const home = { pos: best.C.clone(), target: best.C.clone().addScaledVector(best.f, DIST) };
  // Großer Roter Fleck zur Mitte zwischen Kamera und Sonne drehen
  {
    const want = home.pos.clone().normalize().add(sunDir).normalize().applyQuaternion(tilt.quaternion.clone().invert());
    rot0 = azimuth(want) - azimuth(uvDir(...GRS_UV));
    place();
  }

  // ---------- Abzeichen ----------
  const facing = (p, cam) => tmp.copy(cam.position).sub(p).normalize().dot(ray.copy(p).normalize());
  const grsLocal = uvDir(...GRS_UV);
  const grsPos = new THREE.Vector3(), bandPos = new THREE.Vector3(), shadowPos = new THREE.Vector3(), sunPos = new THREE.Vector3(), resPos = new THREE.Vector3();
  let shadowOn = false;
  const moonHs = moons.map((x) => ({
    id: x.id, kind: STATIONS[x.id] ? 'dive' : 'info', to: STATIONS[x.id] ? x.id : undefined, pos: x.pos, focus: () => Math.max(x.r * 9, 0.12),
  }));
  const hotspots = [
    { id: 'grs', kind: 'info', pos: grsPos, focus: () => 0.7, visible: (cam) => facing(grsPos, cam) > 0.08 },
    { id: 'bands', kind: 'info', pos: bandPos, focus: () => 2.2 },
    ...moonHs,
    { id: 'shadow', kind: 'info', pos: shadowPos, focus: () => 0.6, visible: (cam) => shadowOn && facing(shadowPos, cam) > 0.08 },
    { id: 'res', kind: 'info', pos: resPos, focus: () => 16 },
    { id: 'sun', kind: 'info', pos: sunPos },
  ];
  // Fester Ort für das Resonanz-Abzeichen: Europabahn in Blickrichtung der Heimpose
  resPos.copy(best.f).addScaledVector(pole, -best.f.dot(pole)).normalize().multiplyScalar(GALILEAN.europa.a / RJ).addScaledVector(pole, 0.6);
  const sideV = new THREE.Vector3();
  function placeHotspots(cam) {
    jup.updateMatrixWorld(true);
    jup.localToWorld(grsPos.copy(grsLocal));
    // Bänder: Punkt auf der sichtbaren Tagseite, 12° nördlich des Äquators (Nordäquatorialband)
    sideV.copy(cam.position).normalize().add(sunDir).addScaledVector(pole, -sideV.dot(pole)).normalize();
    bandPos.copy(sideV).multiplyScalar(Math.cos(0.21)).addScaledVector(pole, Math.sin(0.21) * FLAT);
    sunPos.copy(sunDir).multiplyScalar(60);
    // Mondschatten: Schnitt der Linie Mond → von der Sonne weg mit Jupiter (Kugel), nur auf der Tagseite
    shadowOn = false;
    for (const x of moons) {
      const b = -x.pos.dot(sunDir), c = x.pos.lengthSq() - 1, h = b * b - c;
      if (b > 0 && h > 0) { shadowPos.copy(x.pos).addScaledVector(sunDir, -(b - Math.sqrt(h))); shadowOn = shadowsOn; break; }
    }
  }
  placeHotspots({ position: home.pos });

  // ---------- Ebenen (Zahnrad „Station · Jupiter & Monde“, Zeitleiste) ----------
  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
  const dateStr = () => `${fmt.format(new Date((jd - 2440587.5) * 864e5))} UT`;
  function jumpToShadow() {
    const ev = nextShadowTransit(jd);
    if (!ev) return;
    jd = ev.jd + 0.025;   // ≈ 35 min nach dem Eintritt: der Schatten liegt ganz auf der Scheibe
    spdIdx = 1;
    place();
    refreshLayers();
  }
  registerLayers('jupiter', [
    { id: 'clock', type: 'play', group: 'Zeit', label: 'Mondlauf', value: spdIdx, min: 1, max: SPEEDS.length - 1, step: 1, autoplay: !ctx.still,
      fmt: (i) => SPEEDS[Math.round(i)][1], set: (i, on) => { spdIdx = Math.round(i); playing = on; }, get: () => ({ value: spdIdx, playing }),
      status: () => `Stand ${dateStr()}${playing ? '' : ' · angehalten'}` },
    { id: 'transit', type: 'action', label: 'Nächster Schattendurchgang', button: 'Vorspulen', sub: true, run: jumpToShadow },
    { id: 'now', type: 'action', label: 'Zeitpunkt der Station', button: 'Zurück', sub: true, run: () => { jd = jd0; place(); } },
    { id: 'shadows', type: 'toggle', group: 'Jupiter und Monde', label: 'Schatten und Finsternisse', value: true, set: (v) => { shadowsOn = v; place(); } },
    { id: 'orbits', type: 'toggle', label: 'Bahnen mit Leuchtspur', value: true, set: (v) => moons.forEach((x) => { x.orbit.visible = v; }) },
    { id: 'atmos', type: 'toggle', label: 'Dunstsaum der Atmosphäre', value: true, set: (v) => { shell.visible = v; } },
    { id: 'band', type: 'toggle', label: 'Strömende Wolkenbänder', value: true, set: (v) => { jupU.uBand.value = v ? 1 : 0; } },
  ]);

  // ---------- Infotafel ----------
  const controls = [
    { id: 'size', label: 'Größe der Monde', value: 'vis', options: [['vis', 'Anschaulich'], ['real', 'Echt']], set: (v) => { real = v === 'real'; applySizes(); place(); } },
    { id: 'speed', type: 'range', label: 'Zeitraffer', value: playing ? spdIdx : 0, min: 0, max: SPEEDS.length - 1, step: 1, fmt: (i) => SPEEDS[Math.round(i)][1],
      set: (v) => { if (v) { spdIdx = Math.round(v); playing = true; } else playing = false; refreshLayers(); }, get: () => (playing ? spdIdx : 0) },
    { id: 'transit', type: 'action', label: 'Ereignis', button: 'Nächster Schattendurchgang', run: jumpToShadow },
  ];

  // Widget: Resonanz-Uhr von Norden gesehen (mittlere Längen in der Laplace-Ebene, Sonne als Strich am Rand)
  const RING = { io: 20, europa: 31, ganymede: 42, callisto: 53 };
  const f1 = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  let wT = -1;
  const widget = () => `<svg viewBox="0 0 240 124" role="img" aria-label="Resonanz-Uhr: Io, Europa, Ganymed und Kallisto von Norden gesehen">
      ${MOON_IDS.map((id) => `<circle cx="62" cy="62" r="${RING[id]}" fill="none" stroke="rgba(255,255,255,0.14)"/>`).join('')}
      <circle cx="62" cy="62" r="6" fill="#d9b98a"/>
      <line id="w-sun" x1="62" y1="62" x2="62" y2="2" stroke="rgba(255,236,200,0.55)" stroke-dasharray="2 3"/>
      ${MOON_IDS.map((id) => `<g id="w-${id}"><circle r="3.6" fill="#${MOON[id].col.toString(16)}"/><text x="5" y="-4" font-size="10" fill="rgba(255,255,255,0.85)">${MOON[id].name[0]}</text></g>`).join('')}
      <text x="128" y="30" font-size="11" fill="rgba(255,255,255,0.9)">λI − 3 λE + 2 λG</text>
      <text id="w-phi" x="128" y="52" font-size="18" fill="#fff">180,0°</text>
      <text x="128" y="78" font-size="11" fill="rgba(255,255,255,0.9)">Umläufe G : E : I</text>
      <text x="128" y="96" font-size="13" fill="#fff">1 : 2,01 : 4,04</text>
    </svg>
    <div class="w-cap"><span>I Io · E Europa · G Ganymed · K Kallisto</span><span>– – Sonne</span></div>
    <p class="w-foot">Mittlere Längen zum angezeigten Zeitpunkt (JPL, Lieske 1998). Der Winkel bleibt bei 180°: Io, Europa und Ganymed stehen nie zu dritt auf einer Seite.</p>`;
  function widgetTick(el, t) {
    if (t - wT < 0.1) return;
    wT = t;
    for (const id of MOON_IDS) {
      const l = laplaceLongitude(GALILEAN[id], jd) * Math.PI / 180, r = RING[id];
      const g = el.querySelector(`#w-${id}`);
      if (g) g.setAttribute('transform', `translate(${(62 + r * Math.cos(l)).toFixed(1)} ${(62 - r * Math.sin(l)).toFixed(1)})`);
    }
    const sl = Math.atan2(sunDir.dot(lapY), sunDir.dot(lapX));
    const s = el.querySelector('#w-sun');
    if (s) { s.setAttribute('x2', (62 + 60 * Math.cos(sl)).toFixed(1)); s.setAttribute('y2', (62 - 60 * Math.sin(sl)).toFixed(1)); }
    const p = el.querySelector('#w-phi');
    if (p) p.textContent = `${f1(laplaceAngle(jd))}°`;
  }

  return {
    scene, camera, home, unit: RJ * 1e3, hotspots, controls, widget, widgetTick,
    orbit: { minDistance: 0.05, maxDistance: 90, cineSpeed: 0.4 },
    look: { exposure: 1.0, bloom: 0.07 },
    update(dt, t, cam, flying) {
      if (!flying && playing) jd += dt * SPEEDS[spdIdx][0];
      place();
      jupU.uTime.value = t * (ctx.still ? 0.2 : 1);
      // Nahebene mit dem Abstand zur nächsten Oberfläche
      const d = Math.min(cam.position.length() - 1, ...moons.map((x) => cam.position.distanceTo(x.pos) - x.r));
      const near = THREE.MathUtils.clamp(d * 0.2, 2e-4, 0.05);
      if (Math.abs(near - camera.near) / camera.near > 0.05) { camera.near = near; camera.updateProjectionMatrix(); }
      placeHotspots(cam);
    },
    // Kamera bleibt außerhalb von Jupiter
    orbitUpdate(c) {
      const r = c.object.position.length();
      if (r < 1.03) c.object.position.multiplyScalar(1.03 / r);
    },
    live: () => `${dateStr()} · ${playing ? `Zeitraffer ${SPEEDS[spdIdx][1]}` : 'angehalten'}`,
    setPixelRatio(pr) { stars.userData.setPixelRatio(pr); },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      sun.material.map.dispose();
    },
  };
}
