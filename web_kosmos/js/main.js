// Ablauf: Stationen laden, Kamera steuern, Stationen im durchgehenden Flug wechseln, Bild zusammenführen (post.js).
// Stationen bilden einen Baum (content.js parent): Hineinfliegen = Kind, Hinaus = Eltern; weiter entfernte Ziele fliegt
// die Reise über die gemeinsamen Eltern an – als eine Fahrt über alle Etappen (eine Zeitachse, Tempo stetig, kein Halt).
// Beide Kameras zoomen mit derselben Rate, logarithmisch im Abstand – so trägt derselbe Flug über 20 Größenordnungen.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STATIONS, ROUTE, pathTo, routeIndex } from './content.js';
import { createPost } from './post.js';
import { createHud } from './hud.js';
import { settings, onSettings, globalGrade } from './settings.js';
import { createDeepSky } from './deepsky.js';
import { attachSound, soundTo } from './sound.js';
import { flightPlan } from './flightplan.js';
import { TURN, planTurn, turnPose, turnPace } from './turn.js';
import { createBoot } from './boot.js';

const LOADERS = {
  earth: () => import('./levels/earth.js'),
  solar: () => import('./levels/solar.js'),
  asteroid: () => import('./levels/asteroid.js'),
  galaxy: () => import('./levels/galaxy.js'),
  orion: () => import('./levels/orion.js'),
  crab: () => import('./levels/crab.js'),
  pulsar: () => import('./levels/pulsar.js'),
  sgra: () => import('./levels/sgra.js'),
  local: () => import('./levels/local.js'),
  web: () => import('./levels/web.js'),
  cmb: () => import('./levels/cmb.js'),
  bigbang: () => import('./levels/bigbang.js'),
  // Einfügemarken je Etappe (docs/plan_ebenen.md §2): jeder Chat fügt nur direkt unter seiner Marke ein
  // [E1] Sonne
  sun: () => import('./levels/sun.js'),
  // [E2] Erde nah
  iss: () => import('./levels/iss.js'),
  tiangong: () => import('./levels/tiangong.js'),
  hubble: () => import('./levels/hubble.js'),
  jwst: () => import('./levels/jwst.js'),
  euclid: () => import('./levels/euclid.js'),
  roman: () => import('./levels/roman.js'),
  // [E2] Mond
  moon: () => import('./levels/moon.js'),
  // [E3] Jupiter-System
  jupiter: () => import('./levels/jupiter.js'),
  // [E3] Io, Europa
  io: () => import('./levels/io.js'),
  europa: () => import('./levels/europa.js'),
  // [E3] Ganymed, Kallisto
  ganymede: () => import('./levels/ganymede.js'),
  callisto: () => import('./levels/callisto.js'),
  // [E4] Saturn + Mars
  saturn: () => import('./levels/saturn.js'),
  enceladus: () => import('./levels/enceladus.js'),
  // [E4] Titan
  titan: () => import('./levels/titan.js'),
  // [E4] Mars
  mars: () => import('./levels/mars.js'),
  phobos: () => import('./levels/phobos.js'),
  deimos: () => import('./levels/deimos.js'),
  // [E5] Neptun, Uranus, Pluto
  neptune: () => import('./levels/neptune.js'),
  // [E5] Triton
  triton: () => import('./levels/triton.js'),
  // [E5] Uranus
  uranus: () => import('./levels/uranus.js'),
  miranda: () => import('./levels/miranda.js'),
  // [E5] Pluto
  pluto: () => import('./levels/pluto.js'),
};

// Flug: äußere Kamera zoomt um ZOOM auf den Anker zu, die innere kommt aus ZOOM-fachem Abstand an (gleiche Rate)
const ZOOM = 22;
// Mausrad: notch = ln-Schritt je Raste (Δ 100, ≈ 2,8 %), maxDelta = größtes Δ je Ereignis (schnelles Drehen, Touchpad-Schwung),
// max = größter gesammelter Rest (ln, e^1 ≈ 2,7-fach), glide/ease = Ausrollen und Anlauf je s (kritisch gedämpft:
// ease = 4 · glide, ≈ 0,8 s ohne Nachschwingen), vmax = Höchsttempo (ln/s, e^1,4 ≈ 4-fach je s)
const WHEEL = { notch: 0.028, maxDelta: 150, max: 1, glide: 2.5, ease: 10, vmax: 1.4 };
// Ankunft mit etwas mehr Abstand als die Heimpose: erst Überblick, dann zoomt der Besucher selbst
const ARRIVE = 1.25;
// Mehr-Etappen-Flug als eine Fahrt: Dauer = Flugdauer × (base + per × Summe der Etappen-Gewichte), höchstens cap;
// Gewicht einer Etappe = w0 + perDecade × Zehnerpotenzen zwischen den Bildbreiten der beiden Stationen, in [lo, hi]
const CHAIN = { base: 0.35, per: 0.55, cap: 2.8, w0: 0.6, perDecade: 0.09, lo: 0.7, hi: 1.5 };
// Leerlauf-Fahrt: nach `delay` s ohne Eingabe weich einblenden; Bogen, Kran und Atmen des Abstands
const CINE = { delay: 3, ramp: 5, orbit: 0.012, crane: 0.05, breathe: 0.025 };
// Bühne kleiner als dieser Anteil der Fensterhöhe (Handy, Tablet hochkant) → Blickwinkel weiten, damit die Bühne
// denselben Ausschnitt zeigt wie am Desktop (dort ≥ 0,8)
const STAGE_REF = 0.8, FOV_MAX = 90;
// Grading-Grundwerte (je Station überschreibbar: lv.look)
const LOOK = { exposure: 1, bloom: 0.06, sat: 1.04, con: 0.12, sh: [0.96, 0.99, 1.06], hi: [1.04, 1.0, 0.95], vig: 0.38, ca: 0.006, grain: 0.016 };

const params = new URLSearchParams(location.search);
const reducedSys = matchMedia('(prefers-reduced-motion: reduce)').matches;
const still = () => reducedSys || settings.S.motion === 'off';
const calm = () => still() || settings.S.motion === 'calm';
const freeze = params.has('freeze') ? Math.min(0.999, Math.max(0, +params.get('freeze'))) : null;
const tour = params.has('tour') ? { dwell: Math.max(4, +params.get('dwell') || 16), since: 0 } : null;
const fps = params.has('fps') ? { n: 0, sum: 0 } : null;

const canvas = document.getElementById('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  if (!renderer.capabilities.isWebGL2) throw new Error('webgl2');
} catch (err) {
  document.body.classList.add('is-fatal', 'fatal-webgl');
  throw err;
}
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(0x000000, 1);
renderer.autoClear = true;

const post = createPost(renderer);
const texLoader = new THREE.TextureLoader();
const cubeLoader = new THREE.CubeTextureLoader();
const texCache = new Map();
// name mit „/“ am Ende = Ordner einer Würfelkarte (Seiten px, nx, py, ny, pz, nz)
function tex(name, srgb = true) {
  if (texCache.has(name)) return texCache.get(name);
  const done = () => { for (const lv of state.levels.values()) lv.dirty = true; };
  const t = name.endsWith('/') ? cubeLoader.setPath(`tex/${name}`).load(['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'], done)
    : texLoader.load(`tex/${name}`, done);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texCache.set(name, t);
  return t;
}

const state = {
  levels: new Map(), loading: new Map(), active: null, id: null, tr: null, chain: null, queue: [], controls: null,
  time: 0, intro: null, follow: null, poses: new Map(), cine: { idle: 0, w: 0, base: null }, pull: 0, pullDir: 0, caption: 0,
  quality: 2, dragging: false,
};
const now = new Date(params.get('date') || Date.now());

// ---------- Qualität: Pixelverhältnis, Detailgrad; Auto misst in den ersten Sekunden die Bildzeit ----------
const QUALITY = [
  null,
  { pr: 1, scale: 0.7, msaa: 0, detail: 0.55 },
  { pr: 1.25, scale: 0.85, msaa: 4, detail: 0.8 },
  { pr: 2, scale: 1, msaa: 4, detail: 1 },
];
function pickQuality() {
  const q = +params.get('q') || (settings.S.quality === 'auto' ? state.quality : +settings.S.quality);
  return Math.min(3, Math.max(1, q || 2));
}
const probe = { t: 0, n: 0, sum: 0, done: params.has('q') || settings.S.quality !== 'auto' };

function pixelRatio() {
  return Math.min(window.devicePixelRatio || 1, QUALITY[pickQuality()].pr);
}

// ---------- Größen ----------
function stageCenter() {
  const r = hud.stageRect();
  return { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
}
function fit(lv) {
  const W = window.innerWidth, H = window.innerHeight;
  const c = stageCenter(), r = hud.stageRect();
  const k = Math.max(1, STAGE_REF / Math.max(0.1, Math.min(r.x1 - r.x0, r.y1 - r.y0) / H));
  lv.camera.fov = Math.min(FOV_MAX, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(lv.baseFov) / 2) * k)));
  lv.camera.aspect = W / H;
  lv.camera.setViewOffset(W, H, W / 2 - c.x, H / 2 - c.y, W, H);
  lv.camera.updateProjectionMatrix();
  const pr = renderer.getPixelRatio();
  const s = QUALITY[pickQuality()].scale * (lv.resScale || 1);
  lv.rt.setSize(Math.max(2, Math.round(W * pr * s)), Math.max(2, Math.round(H * pr * s)));
  if (lv.setPixelRatio) lv.setPixelRatio(pr * s, lv.rt.height);
  if (lv.deep) lv.deep.userData.setPixelRatio(pr * s);
  lv.dirty = true;
}
function resize() {
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const pr = renderer.getPixelRatio();
  post.setSize(Math.round(window.innerWidth * pr), Math.round(window.innerHeight * pr));
  for (const lv of state.levels.values()) fit(lv);
}

// ---------- Stationen ----------
let waiting = 0;
function getLevel(id, quiet = false) {
  if (state.levels.has(id)) return Promise.resolve(state.levels.get(id));
  if (!quiet) builds.urgent.add(id);   // angefordert: überholt das Vorladen
  let job = state.loading.get(id);
  if (!job) job = buildLevel(id);
  if (!quiet) {
    waiting++;
    hud.setLoading(true);
    const done = () => hud.setLoading(--waiting > 0);
    job.then(done, done);
  }
  return job;
}

// Vorladen baut eine Station nach der anderen: nie mehrere Shader-Schübe im selben Bild
const builds = { busy: false, urgent: new Set() };
function buildLevel(id) {
  const job = (async () => {
    do await calmFrame(); while (builds.busy && !builds.urgent.has(id));
    const gated = !builds.urgent.has(id);
    if (gated) builds.busy = true;
    try { return await makeLevel(id); } finally { if (gated) builds.busy = false; builds.urgent.delete(id); }
  })();
  state.loading.set(id, job);
  job.catch((err) => { console.error(`[kosmos] Station ${id}:`, err); state.loading.delete(id); });
  return job;
}

async function makeLevel(id) {
  const mod = await LOADERS[id]();
  await calmFrame();
  const q = QUALITY[pickQuality()];
  const lv = mod.create({ renderer, tex, date: now, detail: q.detail, still: still() });
  lv.id = id;
  lv.meta = STATIONS[id];
  lv.deep = createDeepSky(id);   // ferne Galaxien, Zirrus, Restlicht hinter den Sternen (deepsky.js)
  if (lv.deep) lv.scene.add(lv.deep);
  attachSound(lv);   // Schalter „Ton“ mit echten Aufnahmen, wo es welche gibt (sound.js)
  lv.baseFov = lv.camera.fov;
  lv.rt = new THREE.WebGLRenderTarget(2, 2, {
    type: THREE.HalfFloatType, samples: lv.msaa === false ? 0 : q.msaa,
    generateMipmaps: !!lv.mips, minFilter: lv.mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
  });
  lv.camera.position.copy(lv.home.pos);
  lv.camera.lookAt(lv.home.target);
  lv.target = lv.home.target.clone();
  fit(lv);
  if (lv.ready) await lv.ready;
  await warmUp(lv);
  state.levels.set(id, lv);
  state.loading.delete(id);
  return lv;
}

// Erstes Flugbild ohne Hänger: Shader parallel binden, Texturen einzeln je Bild hochladen, einmal ins eigene Ziel rendern.
// Vorladen arbeitet nur zwischen Flügen (calmFrame): die für einen Flug nötigen Stationen sind vor dem Start fertig.
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
async function calmFrame() { do await nextFrame(); while (state.tr); }
async function warmUp(lv) {
  if (lv.update) lv.update(0, state.time, lv.camera, true);   // Station stellt ihren Flugzustand ein (Sichtbarkeit, Uniforms)
  await renderer.compileAsync(lv.scene, lv.camera);
  const texs = new Set();
  lv.scene.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      for (const v of Object.values(m)) if (v && v.isTexture) texs.add(v);
      for (const u of Object.values(m.uniforms || {})) if (u.value && u.value.isTexture) texs.add(u.value);
    }
  });
  for (const t of texs) {
    if (t.isRenderTargetTexture || !t.image) continue;
    await calmFrame();
    renderer.initTexture(t);
  }
  await calmFrame();
  renderer.setRenderTarget(lv.rt);
  renderer.render(lv.scene, lv.camera);
  renderer.setRenderTarget(null);
}

// ---------- Ladebild beim Aufruf: erst der Programmcode aller Stationen (spätere Flüge warten nicht mehr aufs Netz), dann
// die Startstation samt Nachbarn bauen – genau das, was activate() behält, sonst gibt dropFar es gleich wieder frei.
// Anteile: Code 15 %, Stationen 85 %; innerhalb einer Station zählen ihre Texturen (DefaultLoadingManager) bis 40 %,
// dazwischen kriecht der Anteil langsam gegen 95 % (Shader binden und Hochladen in warmUp melden keinen Stand), damit
// die Linie nie steht. Fehler einzelner Nachbarn halten den Start nicht auf.
const boot = createBoot();
async function bootLoad(first) {
  const ids = [...new Set([first, ...neighbours(first), nextOnRoute(first)])].filter((id) => LOADERS[id]);
  const mods = Object.values(LOADERS);
  let code = 0, built = 0, part = 0;
  const show = (label) => boot.set(0.15 * code / mods.length + 0.85 * (built + part) / ids.length, label);
  show('Vorladen · Programmcode');
  await Promise.all(mods.map((load) => load().catch(() => null).then(() => { code++; show(); })));
  const mgr = THREE.DefaultLoadingManager;
  for (const id of ids) {
    const label = `Vorladen · ${STATIONS[id].title}`;
    part = 0;
    show(label);
    const t0 = performance.now();
    const creep = setInterval(() => { part = Math.max(part, 0.95 * (1 - Math.exp((t0 - performance.now()) / 2000))); show(); }, 120);
    mgr.onProgress = (url, n, total) => { part = Math.max(part, 0.4 * n / Math.max(1, total)); show(); };
    await getLevel(id, true).catch(() => null);
    clearInterval(creep);
    built++;
    part = 0;
    show();
  }
  mgr.onProgress = undefined;
}

function anchorOf(outer, innerId) {
  const h = outer.hotspots.find((x) => x.to === innerId);
  return (h ? h.pos : outer.home.target).clone();
}

function dropFar(keep) {
  for (const [id, lv] of state.levels) {
    if (keep.includes(id)) continue;
    lv.dispose();
    lv.rt.dispose();
    state.levels.delete(id);
  }
}

function neighbours(id) {
  const m = STATIONS[id];
  const kids = Object.keys(STATIONS).filter((k) => STATIONS[k].parent === id);
  return [id, m.parent, ...kids].filter(Boolean);
}

function activate(lv) {
  state.follow = null;
  state.id = lv.id;
  state.active = lv;
  state.cine = { idle: 0, w: 0, base: null };
  state.pull = 0;
  if (state.controls) state.controls.dispose();
  const c = new OrbitControls(lv.camera, canvas);
  c.enableDamping = true;
  c.dampingFactor = 0.05;
  c.rotateSpeed = 0.5;
  c.zoomSpeed = 0.8;
  c.enablePan = false;
  // Mausrad weich: statt je Raste zu springen sammelt das Rad nur das Ziel (log. Abstand), stepZoom rollt es je Bild aus;
  // Δ kommt von OrbitControls schon in Pixeln (Zeilen/Seiten umgerechnet), Pinch auf Touch bleibt beim Original
  state.zoom = 0;
  state.zoomV = 0;
  if (c._handleMouseWheel) c._handleMouseWheel = (ev) => {
    const dy = THREE.MathUtils.clamp(ev.deltaY, -WHEEL.maxDelta, WHEEL.maxDelta);
    state.zoom = THREE.MathUtils.clamp(state.zoom + WHEEL.notch * dy / 100, -WHEEL.max, WHEEL.max);
  };
  Object.assign(c, lv.orbit || {});
  c.autoRotate = false;
  c.target.copy(lv.target);
  c.addEventListener('start', () => { userInput(); state.dragging = true; });
  c.addEventListener('end', () => { state.dragging = false; });
  c.update();
  state.controls = c;
  soundTo(lv);   // Ton an → überblenden auf den Ton dieser Station (vor setStation: Schalter zeigt ihn)
  hud.setStation(lv);
  // ?ctl=id:wert,id:wert setzt Schalter der Station (Screenshots, Tests), z. B. ctl=const:names,shadow:on
  if (params.get('ctl') && !lv.ctlApplied) {
    lv.ctlApplied = true;
    for (const kv of params.get('ctl').split(',')) {
      const [id, val] = kv.split(':');
      const c = (lv.controls || []).find((x) => x.id === id);
      if (c) { c.value = c.type === 'range' ? +val : val; c.set(c.value); }
    }
    hud.setStation(lv);
  }
  history.replaceState(null, '', `${location.search}#station=${lv.id}`);
  lv.dirty = true;
  // Nachbarn behalten, Rest freigeben; nächste Station der Route im Leerlauf vorladen
  dropFar([...neighbours(lv.id), nextOnRoute(lv.id), ...state.queue]);
  setTimeout(() => idle(() => {
    if (state.id !== lv.id || state.tr) return;
    for (const n of neighbours(lv.id)) if (n !== lv.id) getLevel(n, true);
  }), 2500);
}

function idle(fn) {
  (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(fn, { timeout: 3000 });
}

function nextOnRoute(id, step = 1) {
  const i = routeIndex(id);
  return ROUTE[(i + step + ROUTE.length) % ROUTE.length];
}

// ---------- Flug ----------
const pose = (pos, target) => ({ pos: pos.clone(), target: target.clone() });
function poseAt(target, from, dist) {
  const dir = from.clone().sub(target).normalize();
  return { pos: target.clone().addScaledVector(dir, dist), target: target.clone() };
}
const _d0 = new THREE.Vector3(), _d1 = new THREE.Vector3(), _q = new THREE.Quaternion();
// Pose zwischen a und b: Blickziel linear (früher am Ziel: tk), Richtung als Kugelbogen, Abstand logarithmisch.
// pivot = Anker der äußeren Kamera: Ort um den Anker statt um das wandernde Blickziel – die Kamera fährt gerade auf
// den Anker zu und schwenkt nur den Blick; sonst kreist sie bei nahem, seitlichem Anker (Monde) an ihm vorbei.
// bend(pos, e) = Bogen am Etappenanfang (carryBend), wirkt vor dem Blick
function flyPose(cam, a, b, e, tk = e, pivot = null, bend = null) {
  const target = a.target.clone().lerp(b.target, tk);
  const c0 = pivot || a.target, c1 = pivot || b.target;
  _d0.copy(a.pos).sub(c0);
  _d1.copy(b.pos).sub(c1);
  const l0 = Math.log(Math.max(_d0.length(), 1e-9)), l1 = Math.log(Math.max(_d1.length(), 1e-9));
  _q.setFromUnitVectors(_d0.normalize(), _d1.normalize());
  const dir = _d0.clone().applyQuaternion(new THREE.Quaternion().slerp(_q, e));
  cam.position.copy(pivot ? c0 : target).addScaledVector(dir, Math.exp(l0 + (l1 - l0) * e));
  if (bend) bend(cam.position, e);
  if (pivot) {
    // Blick gleichmäßig im Winkel drehen statt das Blickziel linear zu schieben: liegt der Anker seitlich oder hinter
    // der Kamera, läuft das geschobene Ziel nah an ihr vorbei und der Blick reißt herum
    _d0.copy(a.target).sub(cam.position).normalize();
    _d1.copy(b.target).sub(cam.position).normalize();
    _q.setFromUnitVectors(_d0, _d1);
    target.copy(cam.position).add(_d0.applyQuaternion(new THREE.Quaternion().slerp(_q, tk)));
  }
  cam.lookAt(target);
  return target;
}
function turnCam(cam, tn, x) {
  const p = turnPose(tn, x), target = new THREE.Vector3().fromArray(p.target);
  cam.position.fromArray(p.pos);
  cam.lookAt(target);
  return target;
}
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Zwischenstation ohne Knick: jede Etappe ist eine Gerade (auf den Anker zu bzw. von ihm weg), an der Station wechselt
// die Richtung. Die weiterfahrende Kamera setzt deshalb die Bewegung der vorigen Etappe fort (gleiche Mitte, gleiche
// logarithmische Rate) und blendet bis e = CARRY weich auf die neue Gerade über – Ort und Tempo stetig, Bahn als Bogen.
const CARRY = 0.5;
const _ext = new THREE.Vector3();
function carryBend(cr) {
  return (pos, e) => {
    if (e >= CARRY) return;
    _ext.copy(cr.from).sub(cr.c).multiplyScalar(Math.pow(ZOOM, cr.s * e)).add(cr.c);
    pos.copy(_ext.lerp(pos, smooth(0, CARRY, e)));
  };
}

// opt.dur = feste Dauer der ganzen Fahrt (s), opt.opener = Fahrt des Auftakt-Films (sonst ist Navigation im Film gesperrt)
async function goTo(targetId, opt = {}) {
  if (!STATIONS[targetId] || state.tr || state.chain || !state.active || targetId === state.id) return;
  if (state.opener && !opt.opener) return;
  endIntro();
  const fromId = state.id, path = pathTo(fromId, targetId);
  hud.setRouteTarget(targetId);
  // alle Etappen gleich laden, damit die Fahrt ohne Halt durchläuft
  const lvs = await Promise.all(path.map((id) => getLevel(id)));
  if (state.tr || state.chain || state.id !== fromId) return;
  state.queue = path;
  state.chain = planChain([state.active, ...lvs], opt.dur);
  hop();
}

// ---------- Fahrplan: alle Etappen auf einer Zeitachse, Tempo stetig, kein Halt – auch nicht an einer Wende ----------
const homeWidth = (lv) => lv.home.pos.distanceTo(lv.home.target) * Math.tan(THREE.MathUtils.degToRad(lv.camera.fov) / 2) * lv.unit;
const arrival = (lv) => poseAt(lv.home.target, lv.home.pos, lv.home.pos.distanceTo(lv.home.target) * ARRIVE);
function planChain(lvs, dur) {
  const legs = lvs.slice(1).map((to, i) => {
    const dec = Math.abs(Math.log10(homeWidth(lvs[i]) / homeWidth(to)));
    return { down: to.meta.parent === lvs[i].id, w: Math.min(CHAIN.hi, Math.max(CHAIN.lo, CHAIN.w0 + CHAIN.perDecade * dec)) };
  });
  // Sonderetappe (Galaxien-Flug, fly der äußeren Station): eigenes Gewicht, die Fahrt wird um diesen Anteil länger
  let extra = 0;
  if (!still()) legs.forEach((l, k) => { const o = l.down ? lvs[k] : lvs[k + 1]; if (o.fly) { extra += o.fly.w - l.w; l.w = o.fly.w; } });
  const n = legs.length, ws = legs.map((l) => l.w), W = ws.reduce((s, w) => s + w, 0);
  // Wende (hinaus → hinein) an Station i: deren Kamera fährt einen Bogen, das Tempo folgt dort der Bildbewegung
  const i = legs.findIndex((l, k) => k && l.down && !legs[k - 1].down);
  const turn = i > 0 ? planTurnAt(lvs, i) : null;
  const { cum, gain } = warpTable(ws, turn && ((s) => turn.pace(s - turn.at)));
  const T = still() ? 1.2 * n : dur || (n === 1 ? settings.S.dive * (extra ? legs[0].w : 1)
    : settings.S.dive * Math.min(CHAIN.cap + CHAIN.per * extra, CHAIN.base + CHAIN.per * W) * gain);
  // Anfahren und Abbremsen dauern etwa eine Etappe
  return { legs, turn, T, t: 0, end: null, ramp: Math.min(0.5, 0.9 / n), cum };
}
// Bogen in der Wendestation zwischen dem Anker des Kindes, aus dem die Fahrt kommt (E), und dem des nächsten (M);
// Übersicht O wie bei der Ankunft dort (gemerkte Pose oder Heimpose)
function planTurnAt(lvs, i) {
  const st = lvs[i], saved = state.poses.get(st.id);
  const O = saved && saved.child === lvs[i - 1].id ? saved : arrival(st);
  const tn = planTurn(anchorOf(st, lvs[i - 1].id).toArray(), anchorOf(st, lvs[i + 1].id).toArray(), O.pos.toArray(), ZOOM);
  const tanH = Math.tan(THREE.MathUtils.degToRad(st.camera.fov) / 2);
  // pose = Übersicht ohne Bogen: der Rückflug landet im gewohnten Blick
  return Object.assign(tn, { id: st.id, at: i, pose: pose(O.pos, O.target), pace: turnPace(tn, tanH, st.camera.aspect) });
}
// Tempo-Rampe (Weg bei Geschwindigkeit 0 → 1), an Start und Ziel weich
const ramp = (x) => x * x * x - x * x * x * x / 2;
function runEase(u, k) {
  const A = 1 - k;
  if (u < k) return (k * ramp(u / k)) / A;
  if (u > 1 - k) return 1 - (k * ramp((1 - u) / k)) / A;
  return (k / 2 + u - k) / A;
}
// Zeitdichte entlang der Fahrt: Gewicht je Etappenmitte, dazwischen linear → das Tempo wechselt stetig; pace(s) =
// Bildbewegung der Wende (sonst 1), gain = so viel länger wird die Fahrt dadurch (die Etappen behalten ihr Tempo)
function warpTable(ws, pace) {
  const m = ws.length, N = 48 * m, cum = [0];
  const rho = (s) => {
    if (m === 1) return ws[0];
    const x = Math.min(m - 1, Math.max(0, s - 0.5)), i = Math.min(m - 2, Math.floor(x));
    return ws[i] + (ws[i + 1] - ws[i]) * (x - i);
  };
  let plain = 0;
  for (let k = 1; k <= N; k++) {
    const s = (k - 0.5) * m / N, r = rho(s);
    plain += r;
    cum.push(cum[k - 1] + r * (pace ? pace(s) : 1));
  }
  return { cum: cum.map((c) => c / cum[N]), gain: Math.min(TURN.gain, cum[N] / plain) };
}
function unwarp(cum, q) {
  let k = 1;
  while (k < cum.length - 1 && cum[k] < q) k++;
  return (k - 1 + (q - cum[k - 1]) / (cum[k] - cum[k - 1])) / (cum.length - 1);
}
// Stand der Fahrt zur Zeit u ∈ [0, 1] als Etappen-Koordinate s ∈ [0, n] (ganzzahlig = Station erreicht)
function chainPos(ch, u) {
  const n = ch.legs.length;
  if (still()) return u * n;
  if (n === 1) return easeInOut(u);
  return unwarp(ch.cum, runEase(u, ch.ramp)) * n;
}

function hop() {
  const ch = state.chain, toId = state.queue.shift();
  const to = toId && state.levels.get(toId);
  if (!to) {
    state.chain = null;
    state.queue = [];
    hud.setFlight(false);
    hud.hideMarkers(false);
    return;
  }
  const from = state.active;
  const down = to.meta.parent === from.id;
  const outer = down ? from : to;
  const inner = down ? to : from;
  const anchor = anchorOf(outer, inner.id);
  // Leerlauf-Fahrt nicht zurücknehmen: der Flug startet in der sichtbaren Pose (sonst springt das erste Bild)
  state.cine.base = null;
  state.controls.enabled = false;
  // Zwischenstation: genau an der Endpose der vorigen Etappe weiter (die Steuerung könnte sie begrenzt haben)
  const cur = ch.end ? pose(ch.end.pos, ch.end.target) : pose(from.camera.position, state.controls.target);
  let outerFrom, outerTo, innerFrom, innerTo;
  if (down) {
    // nach einer Wende die Pose ohne Schwenk auf den Anker merken (Rückflug landet im gewohnten Blick)
    const keep = ch.turn && ch.turn.id === from.id ? ch.turn.pose : cur;
    keep.child = to.id;
    state.poses.set(from.id, keep);
    outerFrom = cur;
    outerTo = poseAt(anchor, cur.pos, Math.max(cur.pos.distanceTo(anchor) / ZOOM, 1e-9));
    innerTo = arrival(to);
    innerFrom = poseAt(innerTo.target, innerTo.pos, innerTo.pos.distanceTo(innerTo.target) * ZOOM);
  } else {
    const saved = state.poses.get(to.id);
    outerTo = saved && saved.child === from.id ? saved : arrival(to);
    // vom Anker aus gesehen in Richtung der Zielpose, nah dran
    outerFrom = poseAt(anchor, outerTo.pos, Math.max(outerTo.pos.distanceTo(anchor) / ZOOM, 1e-9));
    innerFrom = cur;
    innerTo = poseAt(cur.target, cur.pos, cur.pos.distanceTo(cur.target) * ZOOM);
  }
  const multi = state.queue.length > 0;
  // gleiche Richtung wie die vorige Etappe → Bogen statt Knick; an einer Wende fährt die Wendestation ihren Bogen (turn.js)
  const carry = ch.carry && ch.carry.down === down ? carryBend(ch.carry) : null;
  ch.carry = null;
  state.tr = {
    k: ch.legs.length - state.queue.length - 1, down, outer, inner, to, anchor, carry,
    outerFrom, outerTo, innerFrom, innerTo, prog: 0, maskR: 0, blur: 0, veil: 0,
    anchorUv: new THREE.Vector2(0.5, 0.5), innerUv: new THREE.Vector2(0.5, 0.5), captioned: false,
  };
  if (outer.fly && !still()) state.tr.fly = flyLeg(state.tr);   // Galaxien-Flug zwischen Station 10 und 11
  hud.hideMarkers(true);
  hud.setFlight(true, to.meta, multi);
}

function stepTransition(dt) {
  const tr = state.tr, ch = state.chain;
  ch.t = freeze !== null ? freeze : Math.min(1, ch.t + dt / ch.T);
  const e = ch.t >= 1 ? 1 : Math.min(1, Math.max(0, chainPos(ch, ch.t) - tr.k));
  const p = tr.down ? e : 1 - e;            // 0 = nur äußeres Bild, 1 = nur inneres
  // äußeres Blickziel schwenkt früh auf den Anker (beim Hinausfliegen erst am Ende weg davon)
  const tkOuter = tr.down ? smooth(0, 0.45, e) : smooth(0.55, 1, e);
  // weiterfahrende Kamera = die der Station, an der die vorige Etappe endete (hinein: äußere, hinaus: innere);
  // die Wendestation fährt Steigen, Kuppe und Sinken als einen Bogen (x = Etappen-Koordinate ab der Wende)
  const tn = ch.turn, x = tn && tr.outer.id === tn.id ? tr.k + e - tn.at : null;
  const outerTgt = x !== null ? turnCam(tr.outer.camera, tn, x)
    : flyPose(tr.outer.camera, tr.outerFrom, tr.outerTo, e, tkOuter, tr.anchor, tr.down ? tr.carry : null);
  if (x !== null) tr.outer.target = outerTgt;   // Maßstab in der Leiste misst zum gleitenden Blickpunkt
  const innerTgt = flyPose(tr.inner.camera, tr.innerFrom, tr.innerTo, e, e, null, tr.down ? null : tr.carry);
  if (tr.fly) flyPoses(tr, e);   // Galaxien-Flug: eigene Kameraführung (ersetzt die Posen oben)
  tr.outer.camera.updateMatrixWorld();
  tr.inner.camera.updateMatrixWorld();
  const a = tr.anchor.clone().project(tr.outer.camera);
  // Anker hinter der Kamera: Projektion ist gespiegelt → zurückspiegeln, damit die Iris am richtigen Rand bleibt
  if (tr.anchor.clone().applyMatrix4(tr.outer.camera.matrixWorldInverse).z > 0) a.set(-a.x * 1e3, -a.y * 1e3, a.z);
  const b = innerTgt.clone().project(tr.inner.camera);
  // Anker außerhalb des Bildes: Iris bleibt mit ihm draußen und gleitet erst mit ihm herein (statt in einer Ecke zu kleben)
  const uv = (v) => Math.min(1.3, Math.max(-0.3, (v + 1) / 2));
  tr.anchorUv.set(uv(a.x), uv(a.y));
  tr.innerUv.set((b.x + 1) / 2, (b.y + 1) / 2);
  tr.prog = p;
  tr.maskR = 0.05 * Math.pow(ZOOM, p) * smooth(0, 0.08, p);
  tr.blur = still() ? 0 : 0.09 * Math.sin(Math.PI * p);
  tr.veil = still() ? 0 : Math.pow(Math.sin(Math.PI * e), 1.6);
  if (tr.fly) flyMix(tr);   // Galaxien-Flug: Überblendung statt Iris
  // Maßstab in der Leiste läuft logarithmisch mit
  const wOut = fieldWidth(tr.outer), wIn = fieldWidth(tr.inner);
  hud.setScale(Math.exp(Math.log(wOut) * (1 - p) + Math.log(wIn) * p), p < 0.5 ? tr.outer : tr.inner);
  if (!tr.captioned && e > 0.62 && state.queue.length === 0) { tr.captioned = true; hud.caption(tr.to.meta); }
  if (e >= 1) {
    const to = tr.to;
    const end = tr.down ? tr.innerTo : x !== null ? pose(tr.outer.camera.position, outerTgt) : tr.outerTo;
    to.camera.position.copy(end.pos);
    to.camera.lookAt(end.target);
    to.target = end.target.clone();
    state.tr = null;
    ch.end = end;
    // Bewegung am Ende dieser Etappe für den Bogen der nächsten: hinein = auf das Blickziel zu, hinaus = vom Anker weg
    ch.carry = tr.down ? { down: true, c: end.target.clone(), from: end.pos.clone(), s: -1 }
      : { down: false, c: tr.anchor.clone(), from: end.pos.clone(), s: 1 };
    activate(to);
    // nächste Etappe im selben Bild weiterrechnen: kein Standbild an der Zwischenstation
    if (state.queue.length) { hop(); if (state.tr) stepTransition(0); return; }
    state.chain = null;
    hud.setFlight(false);
    hud.hideMarkers(false);
    if (tour) tour.since = 0;
  }
}

// ---------- Galaxien-Flug zwischen Station 10 und 11 (galaxyflight.js, Vorschau 26.10.2026 Flug:A) ----------
// Die äußere Station (Urknall) bringt ihn mit (lv.fly). Hinaus: die Kamera von Station 10 taucht auf uns zu, das Bild blendet
// in den Tiefenfeld-Durchflug (tiefer = früher) bis zur Wand der Hintergrundstrahlung; sie glüht weiß auf → Schnitt in den
// Blitz, der Film beginnt. Hinein: in den Blitz, Schnitt in die weiße Wand, vorwärts in der Zeit, zuletzt Überblendung in die
// Anfahrt an Station 10. Alle Kameras fahren vorwärts – beim Überblenden kehrt keine Bewegung um.
function flyLeg(tr) {
  tr.outer.fly.phase(tr.down ? 'bang' : 'corridor', 0);
  if (!tr.down) tr.captioned = true;   // Titel „Urknall“ erst nach dem Schnitt (flyPoses), nicht über dem Durchflug
  return { fly: tr.outer.fly, started: false, plan: null };
}
// Kamera um ein Ziel: Abstand logarithmisch von der Startpose bis zum k-ten Teil, Blick vom alten Ziel weich zum neuen
const _fv = new THREE.Vector3();
function divePose(cam, from, target, k, x) {
  _fv.copy(from.pos).sub(target);
  cam.position.copy(target).addScaledVector(_fv, Math.pow(k, -x));
  return _fv.copy(from.target).lerp(target, x);
}
function flyPoses(tr, e) {
  const f = tr.fly, P = f.plan = flightPlan(e, tr.down), oc = tr.outer.camera, ic = tr.inner.camera;
  if (P.phase === 'corridor') f.fly.corridor(oc, P.x, tr.down);
  else if (tr.down) oc.lookAt(divePose(oc, tr.outerFrom, tr.anchor, ZOOM, P.dive));   // in den Blitz
  else { oc.position.copy(tr.outerTo.pos); oc.lookAt(tr.outerTo.target); }             // Heimpose, der Film läuft
  if (!tr.down) {
    // Station 10 taucht auf uns zu; kommt die Fahrt von Station 9, setzt sie deren Bewegung erst fort (Bogen statt Knick)
    const tgt = divePose(ic, tr.innerFrom, tr.inner.home.target, ZOOM, P.dive);
    if (tr.carry) tr.carry(ic.position, e);
    ic.lookAt(tgt);
    if (P.phase === 'bang' && !f.started) { f.started = true; f.fly.start(); }
    if (P.phase === 'bang' && P.white < 0.08 && !f.cap) { f.cap = true; hud.caption(tr.to.meta); }
  }
  // Schnitt unter vollem Weiß (Wand ↔ Blitz): Kamera springt gewollt; ?camlog merkt die Zeit (tests/camera.py überspringt sie)
  if (f.last && f.last !== P.phase && window.__camlog) (window.__camcut ||= []).push(state.time);
  f.last = P.phase;
  // am Ende hinein: Station 11 wieder im Bild des Urknalls (der Durchflug gehört nur in den Flug)
  f.fly.phase(tr.down && e >= 1 ? 'bang' : P.phase, e >= 1 ? 0 : P.white);
}
// Fluchtpunkt der Kamera im Bild (Mitte der Zoom-Unschärfe)
const vanish = (cam, out) => { _fv.set(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(1e3).add(cam.position).project(cam); return out.set((_fv.x + 1) / 2, (_fv.y + 1) / 2); };
function flyMix(tr) {
  const P = tr.fly.plan;
  tr.mix = tr.prog = P.mix;
  tr.blur = P.phase === 'corridor' ? 0.06 * Math.min(1, P.x * 8, (1 - P.x) * 8) : 0;
  tr.veil = 0;
  vanish(tr.outer.camera, tr.anchorUv);
  vanish(tr.inner.camera, tr.innerUv);
}
// ---------- Auftakt-Film (Vorschau 26.10.2026 Ort:C, Rückmeldung des Users 26.10.2026): beim ersten Besuch der Urknall ----------
// Film in Station 11 mit Kinobalken, Bedienung ausgeblendet, dezent „Überspringen“ (Esc, Klick); danach Landung in Station 11,
// der obersten Ebene – keine Fahrt hinunter zur ISS. Gemerkt in localStorage; der Knopf „Film vom Urknall“ (Station 10,
// Zahnrad) spielt ihn erneut (Ereignis kosmos:auftakt). tempo = Tempo des Films, fade = Abblenden vor dem erneuten
// Abspielen (s). ?auftakt erzwingt ihn, ?auftakt=0 schaltet ihn ab (Tests)
const OPENER = { key: 'kosmos.auftakt.v1', tempo: 1.5, fade: 0.8 };
state.opener = null;
const openerSeen = () => { try { return localStorage.getItem(OPENER.key) === '1'; } catch { return false; } };
async function startOpener(replay) {
  if (state.opener || state.tr || state.chain || still()) return;
  endIntro();
  state.follow = null;
  const a = state.opener = { phase: 'load', fade: 1, skip: false };
  hud.intro(true);
  hud.skip(true);
  if (state.controls) state.controls.enabled = false;
  const job = getLevel('bigbang');
  while (replay && a.fade > 0 && state.opener === a) await nextFrame();   // frame() blendet ab
  const bb = await job;
  if (state.opener !== a) return;
  bb.camera.position.copy(bb.home.pos);
  bb.camera.lookAt(bb.home.target);
  bb.target = bb.home.target.clone();
  activate(bb);
  resize();
  bb.restart(0, OPENER.tempo);
  a.phase = 'film';
  hud.caption(null);   // kein Titel über dem Film, er kommt bei der Landung
  if (a.skip) endOpener(); else state.controls.enabled = false;
}
function stepOpener(real) {
  const a = state.opener, f = state.active.film;
  if (a.phase === 'load') a.fade = Math.max(0, a.fade - real / OPENER.fade);
  else if (f && f.t >= f.dur) endOpener();   // Film zu Ende: Landung in Station 11
}
// Landung in Station 11: Bedienung blendet ein, Titel „Kosmos“ und der Station, der Film läuft im normalen Tempo weiter
function endOpener() {
  if (!state.opener) return;
  state.opener = null;
  try { localStorage.setItem(OPENER.key, '1'); } catch { /* privat */ }
  hud.skip(false);
  hud.hint('');
  hud.intro(false);
  if (state.controls) state.controls.enabled = true;
  const lv = state.active;
  if (lv && lv.film) lv.film.tempo = 1;
  if (lv) hud.caption(lv.meta, true);
}
// Überspringen: sofort in Station 11 landen (lädt sie noch, dann gleich nach dem Laden)
function skipOpener() {
  const a = state.opener;
  if (!a) return;
  if (a.phase === 'load') { a.skip = true; hud.skip(false); return; }
  endOpener();
}

// ---------- Folgen: Blickziel gleitet zu einem Objekt und bleibt darauf (Planeten laufen im Zeitraffer weiter) ----------
function startFollow(h) {
  const c = state.controls, lv = state.active;
  if (!c || state.tr || !h.focus) return;
  cineUndo(lv);
  // Schwung der laufenden Fahrt (oder des verfolgten Objekts) mitnehmen: Zielwechsel ohne Ruck
  const prev = state.follow;
  state.follow = {
    h, t: 0, t0: c.target.clone(), d0: lv.camera.position.distanceTo(c.target), d1: h.focus(),
    v0: prev ? prev.v.clone() : new THREE.Vector3(), lv0: prev ? prev.lv : 0, v: new THREE.Vector3(), lv: 0,
  };
  c.minDistance = Math.min((lv.orbit && lv.orbit.minDistance) || Infinity, h.focus() * 0.3);
}
function stepFollow(lv, dt) {
  const f = state.follow, c = state.controls, cam = lv.camera;
  const t0 = c.target.clone(), l0 = Math.log(cam.position.distanceTo(c.target));
  if (f.t < 1) {
    const T = still() ? 0.6 : 1.8;
    f.t = Math.min(1, f.t + dt / T);
    const e = easeInOut(f.t);
    // Start läuft mit dem mitgenommenen Schwung weiter und klingt ab (Zeitkonstante FOLLOW_KEEP s)
    const keep = FOLLOW_KEEP * (1 - Math.exp(-f.t * T / FOLLOW_KEEP));
    const dir = cam.position.clone().sub(c.target).normalize();
    c.target.copy(f.t0).addScaledVector(f.v0, keep).lerp(f.h.pos, e);
    const la = Math.log(f.d0) + f.lv0 * keep;
    cam.position.copy(c.target).addScaledVector(dir, Math.exp(la + (Math.log(f.d1) - la) * e));
  } else {
    const delta = f.h.pos.clone().sub(c.target);
    c.target.add(delta);
    cam.position.add(delta);
  }
  if (dt > 0) {
    f.v.copy(c.target).sub(t0).divideScalar(dt);
    f.lv = (Math.log(cam.position.distanceTo(c.target)) - l0) / dt;
  }
}
const FOLLOW_KEEP = 0.35;

// ---------- Leerlauf-Fahrt ----------
function cineUndo(lv) {
  const b = state.cine.base;
  if (!b) return;
  lv.camera.position.copy(b);
  state.cine.base = null;
}
function userInput() {
  endIntro();
  // Leerlauf-Fahrt klingt in cineApply weich aus (w sinkt), statt die Kamera auf die Grundpose zurückspringen zu lassen
  cineUndo(state.active);
  state.cine.idle = 0;
  if (tour) tour.since = -1e9;   // Tour endet bei Eingabe
}
function cineApply(lv, dt) {
  const ci = state.cine;
  ci.idle += dt;
  const on = !calm() && settings.S.cine && !state.dragging && !hud.reading();   // offene Info-Karte: Bild ruht
  ci.w = on ? Math.min(1, Math.max(0, ci.w + (ci.idle > CINE.delay ? dt / CINE.ramp : -dt))) : Math.max(0, ci.w - dt);
  if (ci.w <= 0) return;
  const c = state.controls;
  const k = ci.w * ci.w * (3 - 2 * ci.w);
  const t = state.time;
  // langsamer Bogen über die Steuerung (bleibt nach Eingriff erhalten), Kran und Atmen nur als Versatz
  const sp = (lv.orbit && lv.orbit.cineSpeed) || 1;
  const off = lv.camera.position.clone().sub(c.target);
  off.applyAxisAngle(c.object.up, -CINE.orbit * sp * k * dt * 6);
  lv.camera.position.copy(c.target).add(off);
  c.update();
  ci.base = lv.camera.position.clone();
  const right = new THREE.Vector3().crossVectors(off, c.object.up).normalize();
  off.applyAxisAngle(right, Math.sin(t * 0.11) * CINE.crane * k);
  off.multiplyScalar(1 + Math.sin(t * 0.07 + 1.3) * CINE.breathe * k);
  if (off.length() < (c.minDistance || 0)) off.setLength(c.minDistance);
  lv.camera.position.copy(c.target).add(off);
  lv.camera.lookAt(c.target);
}

// ---------- Auftakt: Bogen über die Nachtseite der Erde in den Sonnenaufgang, Kinobalken ----------
function startIntro(lv) {
  if (still() || !lv.intro) return;
  state.intro = { t: 0, dur: 9, from: lv.intro, to: pose(lv.home.pos, lv.home.target) };
  state.controls.enabled = false;
  hud.intro(true);
}
function stepIntro(dt) {
  const it = state.intro;
  it.t = Math.min(1, it.t + dt / it.dur);
  const e = 1 - Math.pow(1 - it.t, 3);
  const lv = state.active;
  flyPose(lv.camera, it.from, it.to, e, smooth(0, 0.8, it.t));
  if (it.t >= 1) endIntro();
}
function endIntro() {
  if (!state.intro) return;
  state.intro = null;
  state.controls.target.copy(state.active.home.target);
  state.controls.enabled = true;
  state.controls.update();
  hud.intro(false);
}

// ---------- Weiches Zoomen: Tempo folgt dem gesammelten Rest (Ausrollen), läuft selbst weich an und ist gedeckelt ----------
function stepZoom(lv, dt) {
  const c = state.controls;
  if (!state.zoom && !state.zoomV) return;
  const want = THREE.MathUtils.clamp(state.zoom * WHEEL.glide, -WHEEL.vmax, WHEEL.vmax);
  state.zoomV += (want - state.zoomV) * (1 - Math.exp(-dt * WHEEL.ease));
  let step = state.zoomV * dt;
  // Rest erreicht (oder fast nichts mehr übrig): genau den Rest gehen, kein Überschießen
  if ((step * state.zoom > 0 && Math.abs(step) >= Math.abs(state.zoom)) || (Math.abs(state.zoom) < 1e-4 && Math.abs(state.zoomV) < 1e-3)) {
    step = state.zoom;
    state.zoomV = 0;
  }
  state.zoom -= step;
  const off = lv.camera.position.clone().sub(c.target), d = off.length();
  const d1 = THREE.MathUtils.clamp(d * Math.exp(step), c.minDistance, c.maxDistance);
  if (d1 === d) { state.zoom = 0; state.zoomV = 0; return; }   // am Anschlag Rest verwerfen – weiter scrollen übernimmt der Rand-Zug
  lv.camera.position.copy(c.target).addScaledVector(off, d1 / d);
}

// ---------- Rand-Zug: am Zoom-Anschlag weiter scrollen → hinaus bzw. hinein ----------
canvas.addEventListener('wheel', (ev) => {
  const c = state.controls, lv = state.active;
  if (!c || state.tr || state.intro) return;
  const d = lv.camera.position.distanceTo(c.target);
  const out = ev.deltaY > 0;
  const atMax = d >= (c.maxDistance || Infinity) * 0.985;
  const atMin = d <= (c.minDistance || 0) * 1.04;
  const dir = out && atMax && lv.meta.parent ? 1 : !out && atMin && diveCandidate() ? -1 : 0;
  if (!dir) { state.pull = 0; return; }
  if (dir !== state.pullDir) state.pull = 0;
  state.pullDir = dir;
  state.pull += Math.min(0.2, Math.abs(ev.deltaY) / 600);
  if (state.pull >= 1) {
    state.pull = 0;
    if (dir > 0) goTo(lv.meta.parent);
    else goTo(diveCandidate().to);
  }
}, { passive: true });

function diveCandidate() {
  const lv = state.active;
  let best = null, bd = 0.3;
  for (const h of lv.hotspots) {
    if (h.kind !== 'dive') continue;
    const p = h.pos.clone().project(lv.camera);
    if (p.z > 1) continue;
    const d = Math.hypot(p.x, p.y);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}

function fieldWidth(lv) {
  const c = lv.camera;
  const target = state.active === lv && state.controls && !state.tr ? state.controls.target : lv.target;
  const d = c.position.distanceTo(target);
  return 2 * d * Math.tan(THREE.MathUtils.degToRad(c.fov) / 2) * c.aspect * lv.unit;
}

// ---------- Zeichnen ----------
const lookA = {}, lookB = {};
const blendLook = (out, a, b, k) => {
  for (const key of Object.keys(LOOK)) {
    const x = a[key] ?? LOOK[key], y = b[key] ?? LOOK[key];
    out[key] = Array.isArray(x) ? x.map((v, i) => v + (y[i] - v) * k) : x + (y - x) * k;
  }
  return out;
};
const look = {
  exposure: 1, bloom: 0.06, sat: 1, con: 0.1, sh: new THREE.Vector3(), hi: new THREE.Vector3(), vig: 0.35, ca: 0.006,
  grain: 0.016, bars: 0, ehtA: new THREE.Vector3(), ehtB: new THREE.Vector3(),
};
let bars = 0;

function renderLevel(lv, dt) {
  if (lv.update) lv.update(dt, state.time, lv.camera, !!state.tr);
  renderer.setRenderTarget(lv.rt);
  renderer.render(lv.scene, lv.camera);
}

let last = performance.now();
function frame(nowMs) {
  requestAnimationFrame(frame);
  const real = Math.min(0.1, (nowMs - last) / 1000);
  last = nowMs;
  if (settings.S.fpsCap && real < 1 / settings.S.fpsCap - 0.002) { last -= real * 1000; return; }
  state.time += real;
  let lv = state.active;
  if (!lv) return;
  if (state.tr) {
    stepTransition(real);
    lv = state.active;   // am Ende einer Etappe ist schon die Zielstation aktiv
  } else if (state.intro) stepIntro(real);
  else {
    cineUndo(lv);
    if (state.follow) stepFollow(lv, real);
    // Rückgabe 'free': die Station übernimmt die Kamera (z. B. Blick-Wechsel), Folgen endet
    if (lv.orbitUpdate && lv.orbitUpdate(state.controls, real) === 'free') state.follow = null;
    stepZoom(lv, real);
    state.controls.update();
    cineApply(lv, real);
    hud.setScale(fieldWidth(lv), lv);
  }
  const tr = state.tr;
  if (tr) {
    renderLevel(tr.outer, real);
    renderLevel(tr.inner, real);
  } else renderLevel(lv, real);

  // Grading: im Flug zwischen den Stationen überblenden
  if (tr) blendLook(lookA, tr.outer.look || {}, tr.inner.look || {}, smooth(0.3, 0.7, tr.prog));
  else blendLook(lookA, lv.look || {}, lv.look || {}, 0);
  // Farblook aus dem Zahnrad Global: Kontrast, Sättigung, Tönung, Vignette ersetzen den Look der Station, Belichtung und Bloom
  // wirken relativ (Station bleibt so hell, wie sie gebaut ist); „Station“ = null → Look der Station
  const G = globalGrade();
  look.exposure = lookA.exposure * (G ? G.exposure : 1) * settings.S.exposure;
  if (state.opener && state.opener.phase === 'load') look.exposure *= state.opener.fade;   // Abblenden vor dem Auftakt-Film
  look.bloom = settings.S.bloom ? lookA.bloom * (G ? G.bloom / 0.12 : 1) : 0;
  look.sat = G ? G.sat : lookA.sat; look.con = G ? G.con : lookA.con; look.vig = (G ? G.vig : lookA.vig) * settings.S.vig;
  look.ca = settings.S.lens ? lookA.ca : 0;
  look.grain = settings.S.grain ? lookA.grain : 0;
  look.sh.fromArray(G ? G.sh : lookA.sh); look.hi.fromArray(G ? G.hi : lookA.hi);
  const ehtOf = (x) => (x && x.post ? x.post.eht : null);
  const ea = ehtOf(tr ? tr.outer : lv), eb = ehtOf(tr ? tr.inner : null);
  look.ehtA.set(ea ? ea[0] : 0, ea ? ea[1] : 0, ea ? ea[2] : 0);
  look.ehtB.set(eb ? eb[0] : 0, eb ? eb[1] : 0, eb ? eb[2] : 0);
  // Kinobalken: Auftakt fest, sonst Zahnrad „Kinobalken 2,39:1“ (Balkenhöhe je Seite aus dem Fensterformat)
  bars += ((state.intro || state.opener ? 0.11 : settings.S.bars ? Math.max(0, (1 - innerWidth / innerHeight / 2.39) / 2) : 0) - bars) * Math.min(1, real * 2.5);
  look.bars = bars;
  post.render(tr ? tr.outer.rt : lv.rt, tr ? tr.inner.rt : null, tr ? { prog: tr.prog, maskR: tr.maskR, blur: tr.blur, veil: tr.veil, mix: tr.mix, anchor: tr.anchorUv, inner: tr.innerUv } : null, look, state.time);

  if (!tr) hud.update(lv.camera, lv, state.time);
  hud.hint(!tr && lv.hint ? lv.hint() : '');   // Hinweis-Zeile des Films (Station 11)
  hud.setPull(state.pull, state.pullDir);
  state.pull = Math.max(0, state.pull - real * 0.6);
  stepTour(real);
  stepProbe(real);
  if (state.opener) stepOpener(real);
  if (fps) {
    fps.n++; fps.sum += real;
    if (fps.sum > 2) { console.log(`[kosmos] ${Math.round(fps.n / fps.sum)} fps · Stufe ${pickQuality()}`); fps.n = 0; fps.sum = 0; }
  }
}

function stepTour(dt) {
  if (!tour || state.tr || state.intro) return;
  tour.since += dt;
  if (tour.since > tour.dwell) { tour.since = 0; goTo(nextOnRoute(state.id)); }
}

// Auto-Qualität: 4 s nach dem Start die mittlere Bildzeit messen und einmal eine Stufe wählen
function stepProbe(dt) {
  if (probe.done || state.tr || state.intro === null && state.time < 1) return;
  probe.t += dt; probe.n++; probe.sum += dt;
  if (probe.t < 4) return;
  probe.done = true;
  const ms = (probe.sum / probe.n) * 1000;
  const q = ms > 30 ? 1 : ms < 13 && (window.devicePixelRatio || 1) > 1.2 ? 3 : 2;
  if (q !== state.quality) {
    state.quality = q;
    resize();
    for (const lv of state.levels.values()) if (lv.setDetail) lv.setDetail(QUALITY[q].detail);
  }
}

// ---------- Bedienung ----------
const hud = createHud({
  onGo: (id) => goTo(id),
  onOut: () => state.active && state.active.meta.parent && goTo(state.active.meta.parent),
  onNext: (step = 1) => state.active && goTo(nextOnRoute(state.id, step)),
  onDive: (h) => { if (h.to) goTo(h.to); },
  onFocus: (h) => startFollow(h),
  onInput: () => userInput(),
  onRelayout: () => requestAnimationFrame(resize),
  onSkip: () => skipOpener(),
});

onSettings((keys) => {
  if (keys.includes('quality')) { probe.done = settings.S.quality !== 'auto'; resize(); }
  if (keys.includes('motion') && still()) cineUndo(state.active);
  for (const lv of state.levels.values()) if (lv.setMotion) lv.setMotion(settings.S.motion, reducedSys);
});

window.addEventListener('keydown', (ev) => {
  if (ev.target.closest && ev.target.closest('input, select, textarea')) return;
  // im Auftakt-Film: Esc, Enter, Leertaste und die Reisetasten überspringen ihn
  if (state.opener) {
    if (['Escape', 'Enter', ' ', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'PageDown', 'PageUp'].includes(ev.key)) { ev.preventDefault(); skipOpener(); }
    return;
  }
  if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { ev.preventDefault(); goTo(nextOnRoute(state.id)); }
  else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); goTo(nextOnRoute(state.id, -1)); }
  else if (ev.key === 'ArrowUp' && state.active && state.active.meta.parent) { ev.preventDefault(); goTo(state.active.meta.parent); }
  else return;
  userInput();
});
window.addEventListener('resize', () => { hud.relayout(); resize(); });
window.addEventListener('hashchange', () => {
  const id = (location.hash.match(/station=(\w+)/) || [])[1];
  if (id && id !== state.id) goTo(id);
});
canvas.addEventListener('pointerdown', () => (state.opener ? skipOpener() : userInput()));
window.addEventListener('kosmos:auftakt', () => startOpener(true));

async function start() {
  try {
    resize();
    const id = (location.hash.match(/station=(\w+)/) || [])[1];
    const first = STATIONS[id] ? id : ROUTE[0];
    // erster Besuch: Auftakt-Film vom Urknall, Landung in Station 11 (sonst Kranfahrt an der ISS)
    const film = !id && !still() && (params.has('auftakt') ? params.get('auftakt') !== '0' : !tour && !openerSeen());
    await bootLoad(film ? 'bigbang' : first);
    if (film) await startOpener(false);
    let lv = null;
    if (!state.active && !state.opener) {
      lv = await getLevel(first);
      activate(lv);
      resize();
    }
    document.body.classList.add('is-ready');
    if (lv) {
      hud.caption(lv.meta, first === ROUTE[0] && !id);
      if (first === ROUTE[0] && !id) startIntro(lv);
    }
    requestAnimationFrame(frame);
    boot.done();
  } catch (err) {
    console.error(err);
    document.body.classList.add('is-fatal', 'fatal-start');
  }
}
start();
