// Ablauf: Stationen laden, Kamera steuern, Stationen im durchgehenden Flug wechseln, Bild zusammenführen (post.js).
// Stationen bilden einen Baum (content.js parent): Hineinfliegen = Kind, Hinaus = Eltern; weiter entfernte Ziele fliegt
// die Reise über die gemeinsamen Eltern an – als eine Fahrt über alle Etappen (eine Zeitachse, Tempo stetig, kein Halt).
// Beide Kameras zoomen mit derselben Rate, logarithmisch im Abstand – so trägt derselbe Flug über 20 Größenordnungen.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STATIONS, ROUTE, pathTo, routeIndex } from './content.js';
import { createPost, LOOK } from './post.js';
import { createHud } from './hud.js';
import { settings, onSettings, globalGrade } from './settings.js';
import { createDeepSky } from './deepsky.js';
import { attachSound, soundTo } from './sound.js';
import { startQuality, createAuto, loadTexture, sceneTextures, releaseTextures } from './perf.js';
import { ZOOM } from './flightplan.js';
import { TURN, planTurn, turnPose, turnPace, smoother } from './turn.js';
import { createBoot } from './boot.js';
import { createOpener } from './opener.js';

// 2D-Canvas im Arbeitsspeicher statt auf der GPU: liegt der Tab länger im Hintergrund, verwirft Chrome GPU-Ressourcen
// (WebGL-Kontext verloren → wiederhergestellt) und leert dabei GPU-gestützte Canvas. three.js lädt die Muster dann leer
// neu hoch – Hüllen und Zellen der Stationen (transparent: true) verschwinden. Gilt für alle Canvas, die Texturen werden.
const getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, opts) {
  return getContext.call(this, type, type === '2d' ? { willReadFrequently: true, ...opts } : opts);
};

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
  // bigbang (Station 11 Urknall): vorerst aus der App genommen, Szene bleibt in levels/bigbang.js (TODOS K1)
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

// Mausrad: notch = ln-Schritt je Raste (Δ 100, ≈ 2,8 %), maxDelta = größtes Δ je Ereignis (schnelles Drehen, Touchpad-Schwung),
// max = größter gesammelter Rest (ln, e^1 ≈ 2,7-fach), glide/ease = Ausrollen und Anlauf je s (kritisch gedämpft:
// ease = 4 · glide, ≈ 0,8 s ohne Nachschwingen), vmax = Höchsttempo (ln/s, e^1,4 ≈ 4-fach je s), edge = Abbremsen vor dem
// Zoom-Anschlag (Anteil des restlichen log. Wegs je s)
const WHEEL = { notch: 0.028, maxDelta: 150, max: 1, glide: 2.5, ease: 10, vmax: 1.4, edge: 6 };
// Rand-Angebot: so viele s nach dem letzten Scrollen am Anschlag bleibt der Hinweis „Hinaus-/Hineinfliegen“ klickbar stehen
const OFFER_HOLD = 4;
// Ankunft mit etwas mehr Abstand als die Heimpose: erst Überblick, dann zoomt der Besucher selbst
const ARRIVE = 1.25;
// Mehr-Etappen-Flug als eine Fahrt: Dauer = Flugdauer × (base + per × Summe der Etappen-Gewichte), höchstens cap;
// Gewicht einer Etappe = w0 + perDecade × Zehnerpotenzen zwischen den Bildbreiten der beiden Stationen, in [lo, hi]
const CHAIN = { base: 0.35, per: 0.55, cap: 2.8, w0: 0.6, perDecade: 0.09, lo: 0.7, hi: 1.5 };
// Leerlauf-Fahrt: nach `delay` s ohne Eingabe weich einblenden; Bogen, Kran und Atmen des Abstands; nach einem Flug schon
// `land` s nach der Landung (die Kamera kommt nie ganz zur Ruhe)
const CINE = { delay: 3, ramp: 5, orbit: 0.012, crane: 0.05, breathe: 0.025, land: 1.2 };
// Kino im Flug, eine Welle über die ganze Fahrt (sin² der Fahrzeit): fov = Blickwinkel weitet sich im schnellsten Teil (Warp),
// ca/vig = Farbsaum und Vignette ziehen an; bank = Rollen in die Kurve (rad je rad/s Gieren, höchstens max, Glättung tau s)
const FLYFX = { fov: 0.12, ca: 1.5, vig: 0.14, bank: 0.05, max: 0.06, tau: 0.35 };
// Bogen statt Gerade (User 27.10.2026): beide Kameras einer Etappe umkreisen ihr Zentrum (äußere den Anker, innere ihr
// Blickziel) mit derselben Winkelrate um die Hochachse – im Bild eine sanft geschwungene Bahn; angle = ganzer Bogen (rad)
const ARC = { angle: 0.3 };
// Auftakt ohne eigene Pose der Station: aus der Nähe (near × Abstand), um yaw seitlich versetzt, in die Heimpose
const INTRO = { dur: 9, yaw: 0.9, near: 0.5 };
// Bühne kleiner als dieser Anteil der Fensterhöhe (Handy, Tablet hochkant) → Blickwinkel weiten, damit die Bühne
// denselben Ausschnitt zeigt wie am Desktop (dort ≥ 0,8)
const STAGE_REF = 0.8, FOV_MAX = 90;

const params = new URLSearchParams(location.search);
const reducedSys = matchMedia('(prefers-reduced-motion: reduce)').matches;
const still = () => reducedSys || settings.S.motion === 'off';
const calm = () => still() || settings.S.motion === 'calm';
const freeze = params.has('freeze') ? Math.min(0.999, Math.max(0, +params.get('freeze'))) : null;
const tour = params.has('tour') ? { dwell: Math.max(4, +params.get('dwell') || 16), since: 0 } : null;
const fps = params.has('fps') ? { n: 0, sum: 0 } : null;
// ?camlog: jede gezeigte Kamera je Bild aufzeichnen (tests/camera.py sucht darin Rucke)
const camlog = params.has('camlog') ? (window.__camlog = []) : null;

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
const cubeLoader = new THREE.CubeTextureLoader();
const texCache = new Map();
// name mit „/“ am Ende = Ordner einer Würfelkarte (Seiten px, nx, py, ny, pz, nz); Bilder entpackt perf.js abseits des
// Haupt-Threads, freigegeben werden sie in dropFar
function tex(name, srgb = true) {
  if (texCache.has(name)) return texCache.get(name);
  const done = () => { for (const lv of state.levels.values()) lv.dirty = true; };
  const t = name.endsWith('/') ? cubeLoader.setPath(`tex/${name}`).load(['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'], done)
    : loadTexture(`tex/${name}`, srgb, done);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texCache.set(name, t);
  return t;
}

const state = {
  levels: new Map(), loading: new Map(), active: null, id: null, tr: null, chain: null, queue: [], controls: null,
  time: 0, intro: null, follow: null, poses: new Map(), cine: { idle: 0, w: 0, base: null }, offer: null, caption: 0,
  dragging: false,
};
const now = new Date(params.get('date') || Date.now());

// ---------- Qualität: Pixelverhältnis, Detailgrad; Auto schätzt die Startstufe und misst laufend die Bildzeit (perf.js) ----------
const QUALITY = [
  null,
  { pr: 1, scale: 0.7, msaa: 0, detail: 0.55 },
  { pr: 1.25, scale: 0.85, msaa: 4, detail: 0.8 },
  { pr: 2, scale: 1, msaa: 4, detail: 1 },
];
// dyn = Auflösungsfaktor der Auto-Qualität unter „Leicht“ (nur bei Auto, sonst gilt die Wahl im Zahnrad)
const autoQ = createAuto(startQuality(renderer), () => applyQuality());
const isAuto = () => !params.has('q') && settings.S.quality === 'auto';
function pickQuality() {
  const q = +params.get('q') || (settings.S.quality === 'auto' ? autoQ.q : +settings.S.quality);
  return Math.min(3, Math.max(1, q || 2));
}
function applyQuality() {
  resize();
  for (const lv of state.levels.values()) if (lv.setDetail) lv.setDetail(QUALITY[pickQuality()].detail);
}
// schwacher Rechner („Leicht“): beim Start nur die Startstation bauen, im Leerlauf nur Eltern und nächste Station der
// Route vorladen – Abstecher baut erst der Klick (sonst baut das Vorladen minutenlang und das Bild stockt)
const lean = () => pickQuality() === 1;

function pixelRatio() {
  return Math.min(window.devicePixelRatio || 1, QUALITY[pickQuality()].pr) * (isAuto() ? autoQ.dyn : 1);
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
  sizeOpener();
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

// Welcher Schritt einer Station gerade läuft (Ladebild beim Aufruf): bootLoad setzt den Empfänger, sonst still
let onStep = null;
const step = (id, what) => { if (onStep) onStep(id, what); };

async function makeLevel(id) {
  const mod = await LOADERS[id]();
  await calmFrame();
  step(id, 'Szene bauen');
  const q = QUALITY[pickQuality()];
  const t0 = performance.now();
  const lv = mod.create({ renderer, tex, date: now, detail: q.detail, still: still() });
  if (fps) console.log(`[kosmos] Bau ${id}: ${Math.round(performance.now() - t0)} ms`);   // ?fps: Hänger beim Vorladen finden
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
  if (lv.ready) step(id, 'Modell laden');
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
  const texs = sceneTextures(lv.scene);
  // Bilder fertig laden, bevor die Station fliegt – sonst lädt three.js sie im Flug hoch (Hänger); höchstens 30 s
  const loaded = Promise.all([...texs].map((t) => t.userData.loaded));
  const imgs = [...texs].map((t) => t.userData.loaded).filter(Boolean);
  let got = 0, up = 0;   // Bilder fertig · Texturen hochgeladen (danach meldet ein spätes Bild nichts mehr)
  const say = () => !up && step(lv.id, got < imgs.length ? `Bilder ${got}/${imgs.length} · Shader binden` : 'Shader binden');
  for (const p of imgs) p.then(() => { got++; say(); });
  say();
  await Promise.all([renderer.compileAsync(lv.scene, lv.camera), Promise.race([loaded, new Promise((r) => setTimeout(r, 30000))])]);
  const ups = [...texs].filter((t) => !t.isRenderTargetTexture && t.image).length;
  for (const t of texs) {
    if (t.isRenderTargetTexture || !t.image) continue;
    step(lv.id, `Hochladen ${++up}/${ups}`);
    await calmFrame();
    renderer.initTexture(t);
  }
  step(lv.id, 'Erstes Bild');
  await calmFrame();
  renderer.setRenderTarget(lv.rt);
  renderer.render(lv.scene, lv.camera);
  renderer.setRenderTarget(null);
}

// ---------- Ladebild beim Aufruf: erst der Programmcode aller Stationen (spätere Flüge warten nicht mehr aufs Netz), dann
// die Startstation samt Nachbarn bauen – genau das, was activate() behält, sonst gibt dropFar es gleich wieder frei.
// Anteile: Code 15 %, Stationen 85 %; innerhalb einer Station zählen ihre Texturen (DefaultLoadingManager) bis 40 %,
// dazwischen kriecht der Anteil langsam gegen 95 % (Shader binden und Hochladen in warmUp melden keinen Anteil), damit
// die Linie nie steht. Der Text nennt den laufenden Schritt (step). Fehler einzelner Nachbarn halten den Start nicht auf.
const boot = createBoot();
async function bootLoad(first) {
  const ids = (lean() ? [first] : [...new Set([first, ...neighbours(first), nextOnRoute(first)])]).filter((id) => LOADERS[id]);
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
    onStep = (sid, what) => { if (sid === id) show(`${STATIONS[id].title} · ${what}`); };
    const creep = setInterval(() => { part = Math.max(part, 0.95 * (1 - Math.exp((t0 - performance.now()) / 2000))); show(); }, 120);
    mgr.onProgress = (url, n, total) => { part = Math.max(part, 0.4 * n / Math.max(1, total)); show(); };
    await getLevel(id, true).catch(() => null);
    onStep = null;
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

// Texturen der freigegebenen Stationen mitfreigeben (material.dispose() lässt sie liegen) und aus dem Cache nehmen:
// sonst bleiben Grafikspeicher und entpackte Bilder aller je besuchten Stationen belegt
function dropFar(keep) {
  const free = new Set();
  for (const [id, lv] of state.levels) {
    if (keep.includes(id)) continue;
    sceneTextures(lv.scene, free);
    lv.dispose();
    lv.rt.dispose();
    state.levels.delete(id);
  }
  if (!free.size) return;
  const gone = releaseTextures(free, state.levels.values());
  for (const [k, t] of texCache) if (gone.has(t)) texCache.delete(k);
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
  state.offer = null;
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
  // Ziehen gleichmäßig: OrbitControls rechnet bei jedem Zeiger-Ereignis zusätzlich einen Dämpfungsschritt – je nach Zahl der
  // Ereignisse im Bild dreht die Kamera ein- oder zweimal so weit und bremst beim Loslassen auf die Hälfte. Hier rechnet
  // nur die Bildschleife.
  let quiet = false;
  for (const k of Object.keys(OrbitControls.prototype).concat(Object.getOwnPropertyNames(OrbitControls.prototype))) {
    if (!/^_handle(Mouse|Touch)Move/.test(k) || typeof c[k] !== 'function') continue;
    const f = c[k];
    c[k] = function (...a) { quiet = true; try { return f.apply(this, a); } finally { quiet = false; } };
  }
  const update = c.update.bind(c);
  c.update = (...a) => (quiet ? false : update(...a));
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
  // erst nach der Kranfahrt bzw. dem Film: ein Bau mitten darin ruckelt sichtbar
  const preload = () => {
    if (state.id !== lv.id || state.tr) return;
    if (state.intro || state.opener) { setTimeout(() => idle(preload), 1000); return; }
    for (const n of lean() ? [lv.meta.parent, nextOnRoute(lv.id)] : neighbours(lv.id)) if (n && n !== lv.id) getLevel(n, true);
  };
  setTimeout(() => idle(preload), 2500);
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
// swing = Schwenk um das Blickziel der äußeren Station (clearSwing), bend(pos, e) = Bogen am Etappenanfang (carryBend);
// beide wirken vor dem Blick; up(tk) = Hochachse für lookAt (upPath); arc = Bogen um das Zentrum (arcPair)
function flyPose(cam, a, b, e, tk = e, pivot = null, bend = null, swing = null, up = null, arc = null) {
  const target = a.target.clone().lerp(b.target, tk);
  const c0 = pivot || a.target, c1 = pivot || b.target;
  _d0.copy(a.pos).sub(c0);
  _d1.copy(b.pos).sub(c1);
  const l0 = Math.log(Math.max(_d0.length(), 1e-9)), l1 = Math.log(Math.max(_d1.length(), 1e-9));
  _q.setFromUnitVectors(_d0.normalize(), _d1.normalize());
  const dir = _d0.clone().applyQuaternion(new THREE.Quaternion().slerp(_q, e));
  cam.position.copy(pivot ? c0 : target).addScaledVector(dir, Math.exp(l0 + (l1 - l0) * e));
  if (arc) { const c = pivot || target; cam.position.sub(c).applyAxisAngle(arc.axis, arc.angle(e)).add(c); }
  if (swing) cam.position.sub(swing.T).applyAxisAngle(swing.axis, swing.angle(e)).add(swing.T);
  if (bend) bend(cam.position, e);
  if (pivot) {
    // Blick gleichmäßig im Winkel drehen statt das Blickziel linear zu schieben: liegt der Anker seitlich oder hinter
    // der Kamera, läuft das geschobene Ziel nah an ihr vorbei und der Blick reißt herum. a.look = feste Startrichtung
    // (hinein): fährt die Kamera am Blickziel vorbei, zieht es seitlich aus dem Bild, statt dass der Blick ihm nach- und
    // dann zum Anker zurückschwingt
    if (a.look) _d0.copy(a.look);
    else _d0.copy(a.target).sub(cam.position).normalize();
    _d1.copy(b.target).sub(cam.position).normalize();
    _q.setFromUnitVectors(_d0, _d1);
    target.copy(cam.position).add(_d0.applyQuaternion(new THREE.Quaternion().slerp(_q, tk)));
  }
  aim(cam, target, up && up(tk));
  return target;
}
function turnCam(cam, tn, x) {
  const p = turnPose(tn, x), target = new THREE.Vector3().fromArray(p.target);
  if (!tn.up) {
    const ends = [-1, 1].map((k) => turnPose(tn, k)).map((q) => pose(new THREE.Vector3().fromArray(q.pos), new THREE.Vector3().fromArray(q.target)));
    tn.up = upPath(ends[0], ends[1], cam.up);
  }
  cam.position.fromArray(p.pos);
  aim(cam, target, tn.up(smoother(-1, 1, x)));
  return target;
}
// Hochachse im Flug: aus der Kameralage, die vom Bild am Start zu dem am Ziel dreht (Quaternion-Slerp), statt fest die
// Welt-Hochachse – blickt die Kamera unterwegs fast senkrecht nach oben oder unten (Übersicht von oben, Mond über dem Pol),
// dreht lookAt das Bild sonst schlagartig um die Blickachse. An beiden Enden gleich lookAt mit der Hochachse der Kamera (w):
// Start und Landung passen zur Steuerung.
const _qu = new THREE.Quaternion(), _uk = new THREE.Vector3(), _m4 = new THREE.Matrix4();
const lookQuat = (p, w) => new THREE.Quaternion().setFromRotationMatrix(_m4.lookAt(p.pos, p.target, w));
function upPath(a, b, w) {
  const qa = lookQuat(a, w), qb = lookQuat(b, w), out = new THREE.Vector3();
  return (k) => out.set(0, 1, 0).applyQuaternion(_qu.copy(qa).slerp(qb, k));
}
function aim(cam, target, up) {
  if (!up) { cam.lookAt(target); return; }
  _uk.copy(cam.up);
  cam.up.copy(up);
  cam.lookAt(target);
  cam.up.copy(_uk);
}
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

// Freie Bahn: führt die Gerade zum Anker dicht am Blickziel T der äußeren Station vorbei (Anker hinter dem Körper, z. B. Mond
// hinter der Erde), schießt die Kamera am Körper vorbei und der Blick reißt herum. Stattdessen fährt sie die Gerade von einem
// um T geschwenkten Punkt aus, an dem sie mindestens k × Abstand an T vorbeiführt, und schwenkt zu Beginn (hinein) bzw. am
// Ende (hinaus) weich um T dorthin – solange sie noch im Umfeld von T ist (bis reach × Abstand, Anteil span der Etappe)
const CLEAR = { k: 0.6, step: 0.03, max: 1.6, reach: 2.5, span: [0.15, 0.4] };
const _cs = new THREE.Vector3(), _ct = new THREE.Vector3();
function passBy(P, A, T) {
  _cs.subVectors(A, P);
  const t = THREE.MathUtils.clamp(_ct.subVectors(T, P).dot(_cs) / Math.max(_cs.lengthSq(), 1e-30), 0, 1);
  return _ct.copy(P).addScaledVector(_cs, t).distanceTo(T);
}
// P = Kamera an T (hinein: Start, hinaus: Ziel), A = Anker, up = Hochachse der Kamera (Anker genau hinter T: seitlich ausweichen)
function clearSwing(P, T, A, down, up) {
  const r = P.distanceTo(T), c = CLEAR.k * r;
  if (A.distanceTo(T) < 1.5 * c || passBy(P, A, T) >= c) return null;
  const v = P.clone().sub(T), u = A.clone().sub(T);
  const axis = new THREE.Vector3().crossVectors(v, u);   // dreht v zum Anker hin
  if (axis.lengthSq() < 1e-6 * v.lengthSq() * u.lengthSq()) axis.copy(up).projectOnPlane(v);
  axis.normalize();
  const at = new THREE.Vector3();
  let g = 0;
  do { g += CLEAR.step; at.copy(v).applyAxisAngle(axis, g).add(T); } while (g < CLEAR.max && passBy(at, A, T) < c);
  g = Math.min(CLEAR.max, g + CLEAR.step);
  at.copy(v).applyAxisAngle(axis, g).add(T);
  // Anteil der Etappe, bis die gerade Fahrt (log. auf den Anker zu) das Umfeld von T verlassen hat
  const d = at.clone().sub(A), l0 = Math.log(d.length()), q = new THREE.Vector3();
  d.normalize();
  let span = CLEAR.span[1];
  for (let k = 1; k <= 40; k++) {
    const e = (k / 40) * CLEAR.span[1];
    if (q.copy(A).addScaledVector(d, Math.exp(l0 - e * Math.log(ZOOM))).distanceTo(T) >= CLEAR.reach * r) { span = Math.max(CLEAR.span[0], e); break; }
  }
  const angle = down ? (e) => -g * (1 - smoother(0, span, e)) : (e) => -g * smoother(1 - span, 1, e);
  return { T: T.clone(), axis, at, angle };
}
const upOf = (cam) => new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
// Bogen (ARC) je Etappe: die Kamera der Startstation (from) beginnt ohne Versatz, die der Zielstation (to) landet ohne –
// Start, Landung und Zwischenhalt bleiben, wo sie waren; dazwischen dreht sich beider Versatz gleich schnell, die Fahrt
// liest sich wie eine Bahn. Richtung einmal je Fahrt: die Bahn holt zur Gegenseite des Ziels aus und schwenkt dann ein
// (wie eine Kurve), statt schräg darauf zuzuschneiden; P/C = Kamera und Zentrum der Startkamera
function arcPair(ch, from, to, P, C) {
  if (ch.arcSign === undefined) {
    const d = P.clone().sub(C), right = new THREE.Vector3(1, 0, 0).applyQuaternion(from.camera.quaternion);
    ch.arcSign = -Math.sign(new THREE.Vector3().crossVectors(from.camera.up, d).dot(right) * C.clone().sub(P).dot(right)) || 1;
  }
  const a = ch.arcSign * ARC.angle * (calm() ? 0.5 : 1);
  return {
    from: { axis: from.camera.up.clone().normalize(), angle: (e) => a * smoother(0, 1, e) },
    to: { axis: to.camera.up.clone().normalize(), angle: (e) => a * (smoother(0, 1, e) - 1) },
  };
}

// Zwischenhalt einer Mehr-Etappen-Fahrt (die Fahrt hält dort nicht): statt der Übersicht eine Pose auf dem Weg – sonst fährt
// die Kamera mit Reisetempo dicht am Ziel vorbei und der Blick reißt herum. Hinein: der nächste Anker A liegt vor der Kamera
// (näher als die Übersicht: zwischen Kamera und Ziel, um side seitlich; weiter weg: hinter dem Ziel, um behind versetzt);
// hinaus: die Kamera zieht sich hinter den Anker zurück (out × Abstand des Ankers), Anker und Ziel liegen beide vorn
const PASS = { side: 0.45, behind: 0.8, out: 1.6 };
function passPose(lv, A, down) {
  const ov = arrival(lv), T = ov.target, r = ov.pos.distanceTo(T);
  const u = A.clone().sub(T), rho = u.length();
  // Anker im Zentrum (Sonne im Sonnensystem, Sgr A* in der Milchstraße): keine Richtung → Übersicht; sonst fällt die Pose
  // in den Anker, Kamera = Blickziel, die Projektion wird NaN und das Bild der ganzen Etappe schwarz
  if (rho < 1e-6 * r) return pose(ov.pos, T);
  u.normalize();
  const axis = new THREE.Vector3().crossVectors(u, ov.pos.clone().sub(T).normalize());   // dreht u zur gewohnten Seite
  if (axis.lengthSq() < 1e-8) axis.copy(upOf(lv.camera)).projectOnPlane(u);
  axis.normalize();
  const far = down && rho >= 0.8 * r;
  const dir = far ? u.negate().applyAxisAngle(axis, -PASS.behind) : u.applyAxisAngle(axis, PASS.side);
  return { pos: T.clone().addScaledVector(dir, down ? r : Math.max(r, PASS.out * rho)), target: T.clone() };
}
// opt.dur = feste Dauer der ganzen Fahrt (s), opt.opener = Fahrt des Auftakt-Films (sonst ist Navigation im Film gesperrt),
// opt.home = Landung in der Heimpose des Ziels
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
  state.chain.home = !!opt.home;   // Landung in der Heimpose statt im etwas weiteren Ankunftsblick
  // Blickwinkel vor der Fahrt merken (Warp rechnet relativ dazu), Rollen beginnt bei null
  state.chain.cams = [state.active, ...lvs].map((lv) => ({ lv, fov: lv.camera.fov }));
  for (const lv of [state.active, ...lvs]) lv.bank = null;
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
  // Vorbeiflug an Galaxien (pass der äußeren Station, nur hinein): eigenes Gewicht, die Fahrt wird um diesen Anteil länger
  let extra = 0;
  if (!still()) legs.forEach((l, k) => { const o = lvs[k]; if (l.down && o.pass) { extra += o.pass.w - l.w; l.w = o.pass.w; } });
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
  if (n === 1) return smoother(0, 1, u);
  return unwarp(ch.cum, runEase(u, ch.ramp)) * n;
}

function hop() {
  const ch = state.chain, toId = state.queue.shift();
  const to = toId && state.levels.get(toId);
  if (!to) {
    if (ch) warp(ch, 0);
    state.chain = null;
    state.queue = [];
    hud.setFlight(false);
    hud.hideMarkers(false);
    return;
  }
  const from = state.active, next = state.queue[0];
  const down = to.meta.parent === from.id;
  const outer = down ? from : to;
  const inner = down ? to : from;
  const anchor = anchorOf(outer, inner.id);
  // Leerlauf-Fahrt nicht zurücknehmen: der Flug startet in der sichtbaren Pose (sonst springt das erste Bild)
  state.cine.base = null;
  state.controls.enabled = false;
  // Zwischenstation: genau an der Endpose der vorigen Etappe weiter (die Steuerung könnte sie begrenzt haben)
  const cur = ch.end ? pose(ch.end.pos, ch.end.target) : pose(from.camera.position, state.controls.target);
  let outerFrom, outerTo, innerFrom, innerTo, outerEnd = null, swing = null, carryC = null;
  // die Wendestation fährt ihren eigenen Bogen (turn.js)
  const turning = ch.turn && ch.turn.id === outer.id;
  if (down) {
    // nach einer Wende die Pose ohne Schwenk auf den Anker merken (Rückflug landet im gewohnten Blick)
    const keep = ch.turn && ch.turn.id === from.id ? ch.turn.pose : cur;
    keep.child = to.id;
    state.poses.set(from.id, keep);
    swing = turning ? null : clearSwing(cur.pos, cur.target, anchor, true, upOf(from.camera));
    outerFrom = swing ? pose(swing.at, cur.target) : pose(cur.pos, cur.target);
    outerFrom.look = cur.target.clone().sub(cur.pos).normalize();
    outerTo = poseAt(anchor, outerFrom.pos, Math.max(outerFrom.pos.distanceTo(anchor) / ZOOM, 1e-9));
    innerTo = next && STATIONS[next].parent === to.id ? passPose(to, anchorOf(to, next), true) : ch.home ? pose(to.home.pos, to.home.target) : arrival(to);
    innerFrom = poseAt(innerTo.target, innerTo.pos, innerTo.pos.distanceTo(innerTo.target) * ZOOM);
  } else {
    const saved = state.poses.get(to.id);
    outerTo = next && to.meta.parent === next ? passPose(to, anchor, false) : saved && saved.child === from.id ? saved : arrival(to);
    swing = turning ? null : clearSwing(outerTo.pos, outerTo.target, anchor, false, upOf(to.camera));
    if (swing) {
      outerEnd = outerTo;
      outerTo = pose(swing.at, outerEnd.target);
      // Mitte der Weiterfahrt (carryBend): der Anker mit derselben Drehung wie die Kamera am Ende
      carryC = anchor.clone().sub(swing.T).applyAxisAngle(swing.axis, swing.angle(1)).add(swing.T);
    }
    // vom Anker aus gesehen in Richtung der Zielpose, nah dran
    outerFrom = poseAt(anchor, outerTo.pos, Math.max(outerTo.pos.distanceTo(anchor) / ZOOM, 1e-9));
    innerFrom = cur;
    innerTo = poseAt(cur.target, cur.pos, cur.pos.distanceTo(cur.target) * ZOOM);
  }
  const multi = state.queue.length > 0;
  // gleiche Richtung wie die vorige Etappe → Bogen statt Knick; an einer Wende fährt die Wendestation ihren Bogen (turn.js)
  const carry = ch.carry && ch.carry.down === down ? carryBend(ch.carry) : null;
  ch.carry = null;
  // Bogen nicht in der Wendestation (fährt ihren eigenen) und nicht bei reduzierter Bewegung
  const arcs = turning || still() ? null : arcPair(ch, from, to, cur.pos, down ? anchor : cur.target);
  state.tr = {
    k: ch.legs.length - state.queue.length - 1, down, outer, inner, to, anchor, carry, swing, carryC,
    arcOuter: arcs && (down ? arcs.from : arcs.to), arcInner: arcs && (down ? arcs.to : arcs.from),
    outerFrom, outerTo, outerEnd, innerFrom, innerTo, prog: 0,
    // Hochachse je Kamera vom Bild am Etappenanfang (Blick der weiterfahrenden Kamera) zu dem am Ende
    upOuter: upPath(down ? cur : pose(outerFrom.pos, anchor), down ? pose(outerTo.pos, anchor) : outerEnd || outerTo, outer.camera.up),
    upInner: upPath(innerFrom, innerTo, inner.camera.up), maskR: 0, blur: 0, veil: 0,
    anchorUv: new THREE.Vector2(0.5, 0.5), innerUv: new THREE.Vector2(0.5, 0.5), captioned: false,
  };
  // Vorbeiflug an Galaxien auf der Fahrt hinein (Station 9 → 8): Feld entlang der Zoom-Linie der äußeren Kamera
  if (down && outer.pass && !still()) { state.tr.pass = outer.pass; outer.pass.begin(outerFrom.pos, anchor); }
  // Station beginnt beim Hinausflug in sie (Urknall: Film von vorn, die Explosion kommt vor der Landung)
  if (!down && to.enter) to.enter();
  hud.hideMarkers(true);
  hud.setFlight(true, to.meta, multi);
}

// Stärke der Kino-Effekte im Flug (0 … 1): eine Welle über die ganze Fahrt, „Ruhig“ halb, „Aus“/reduzierte Bewegung nichts
function flightFx(ch) {
  return still() ? 0 : Math.pow(Math.sin(Math.PI * ch.t), 2) * (calm() ? 0.5 : 1);
}
const _fw = new THREE.Vector3(), _rt = new THREE.Vector3();
// Rollen in die Kurve: Gierrate des Blicks (nach lookAt, ohne Rollen) geglättet → Drehung um die Blickachse; k blendet aus
function bank(lv, dt, k) {
  const cam = lv.camera;
  _fw.set(0, 0, -1).applyQuaternion(cam.quaternion);
  const b = lv.bank || (lv.bank = { f: _fw.clone(), roll: 0 });
  const yaw = dt > 0 ? _rt.set(1, 0, 0).applyQuaternion(cam.quaternion).dot(_fw.clone().sub(b.f)) / dt : 0;
  b.f.copy(_fw);
  const want = THREE.MathUtils.clamp(-yaw * FLYFX.bank, -FLYFX.max, FLYFX.max) * k;
  b.roll += (want - b.roll) * (1 - Math.exp(-dt / FLYFX.tau));
  cam.rotateZ(b.roll * k);
}
function warp(ch, fx) {
  for (const c of ch.cams) {
    const f = c.fov * (1 + FLYFX.fov * fx);
    if (Math.abs(c.lv.camera.fov - f) > 1e-6) { c.lv.camera.fov = f; c.lv.camera.updateProjectionMatrix(); }
  }
}

function stepTransition(dt) {
  const tr = state.tr, ch = state.chain;
  ch.t = freeze !== null ? freeze : Math.min(1, ch.t + dt / ch.T);
  const fx = flightFx(ch);
  warp(ch, fx);
  const e = ch.t >= 1 ? 1 : Math.min(1, Math.max(0, chainPos(ch, ch.t) - tr.k));
  const p = tr.down ? e : 1 - e;            // 0 = nur äußeres Bild, 1 = nur inneres
  // äußeres Blickziel schwenkt früh auf den Anker (beim Hinausfliegen erst am Ende weg davon) – über 70 % der Etappe,
  // damit der Blick auch bei seitlichem Anker ruhig dreht
  const tkOuter = tr.down ? smoother(0, 0.7, e) : smoother(0.3, 1, e);
  // weiterfahrende Kamera = die der Station, an der die vorige Etappe endete (hinein: äußere, hinaus: innere);
  // die Wendestation fährt Steigen, Kuppe und Sinken als einen Bogen (x = Etappen-Koordinate ab der Wende)
  const tn = ch.turn, x = tn && tr.outer.id === tn.id ? tr.k + e - tn.at : null;
  const outerTgt = x !== null ? turnCam(tr.outer.camera, tn, x)
    : flyPose(tr.outer.camera, tr.outerFrom, tr.outerTo, e, tkOuter, tr.anchor, tr.down ? tr.carry : null, tr.swing, tr.upOuter, tr.arcOuter);
  if (x !== null) tr.outer.target = outerTgt;   // Maßstab in der Leiste misst zum gleitenden Blickpunkt
  const innerTgt = flyPose(tr.inner.camera, tr.innerFrom, tr.innerTo, e, e, null, tr.down ? null : tr.carry, null, tr.upInner, tr.arcInner);
  tr.outerTgt = outerTgt;
  tr.innerTgt = innerTgt;
  if (tr.pass) tr.pass.step(e);
  // Rollen klingt zum Ende der Fahrt sicher auf null aus (danach dreht die Steuerung ohne Rollen weiter)
  const bk = still() ? 0 : 1 - smoother(0.8, 1, ch.t);
  bank(tr.outer, dt, bk);
  bank(tr.inner, dt, bk);
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
  if (!tr.captioned && e > 0.62 && state.queue.length === 0) { tr.captioned = true; hud.caption(tr.to.meta); }
  if (e >= 1) {
    const to = tr.to;
    const end = tr.down ? tr.innerTo : x !== null ? pose(tr.outer.camera.position, outerTgt) : tr.outerEnd || tr.outerTo;
    to.camera.position.copy(end.pos);
    to.camera.lookAt(end.target);
    to.target = end.target.clone();
    if (tr.pass) tr.pass.end();
    state.tr = null;
    ch.end = end;
    // Bewegung am Ende dieser Etappe für den Bogen der nächsten: hinein = auf das Blickziel zu, hinaus = vom Anker weg
    ch.carry = tr.down ? { down: true, c: end.target.clone(), from: end.pos.clone(), s: -1 }
      : { down: false, c: (tr.carryC || tr.anchor).clone(), from: end.pos.clone(), s: 1 };
    activate(to);
    // nächste Etappe im selben Bild weiterrechnen: kein Standbild an der Zwischenstation
    if (state.queue.length) { hop(); if (state.tr) stepTransition(0); return; }
    warp(ch, 0);
    state.chain = null;
    // Leerlauf-Fahrt setzt bald nach der Landung weich ein
    state.cine.idle = CINE.delay - CINE.land;
    hud.setFlight(false);
    hud.hideMarkers(false);
    if (tour) tour.since = 0;
  }
}

// ---------- Auftakt-Film beim Aufruf (User 27.10.2026): Urknall → Plasma → Hintergrundstrahlung, Landung in Station 10 ----------
// opener.js spielt den Film; Station 10 ist von Anfang an aktiv (Bedienung ausgeblendet, Kinobalken), ab dem weißen Bild
// führt der Film ihre Kamera und blendet am Ende in ihr Bild über. Läuft bei jedem Aufruf ohne Stations-Link und bei jedem
// Neuladen (das #station=… setzt activate() selbst), nicht bei ?tour oder reduzierter Bewegung; ?auftakt erzwingt ihn,
// ?auftakt=0 schaltet ihn ab (Tests). Überspringen (Esc, Enter, Leertaste, Reisetasten, Klick): kurz abblenden, Heimpose.
// skipFade = Abblenden beim Überspringen, veil = Aufblenden danach (s)
const OPENER = { on: true, land: 'cmb', skipFade: 0.35, veil: 0.6 };
state.opener = null;
state.veil = 0;
let opener = null;   // einmal gebaut, beim Wiederholen neu gestartet
async function startOpener(lv) {
  if (!OPENER.on || state.opener || state.tr || state.chain || still()) return;
  endIntro();
  state.follow = null;
  if (!opener) {
    opener = createOpener({ detail: QUALITY[pickQuality()].detail, renderer }, lv);
    opener.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
    sizeOpener();
    opener.apply(null);
    await Promise.all([renderer.compileAsync(opener.scene, opener.camera), opener.ready]);
  }
  opener.film.t = 0;
  opener.film.playing = false;
  state.opener = { o: opener, lv, skip: 0 };
  hud.intro(true);
  hud.skip(true);
  hud.caption(null);
  state.controls.enabled = false;
}
function sizeOpener() {
  if (!opener) return;
  const pr = renderer.getPixelRatio(), s = QUALITY[pickQuality()].scale;
  const w = Math.max(2, Math.round(window.innerWidth * pr * s)), h = Math.max(2, Math.round(window.innerHeight * pr * s));
  opener.rt.setSize(w, h);
  opener.setSize(w, h);
}
function stepOpener(real) {
  const a = state.opener;
  a.o.advance(real);
  if (a.skip) a.skip += real;
  if (a.o.done || a.skip >= OPENER.skipFade) endOpener();
}
// Film ins eigene Ziel (eigene Kamera bis zum weißen Bild, danach die der Station), zur Überblendung auch die Station
function renderOpener(o, lv, real) {
  o.apply(lv);
  renderer.setRenderTarget(o.rt);
  renderer.render(o.scene, o.out.view === 'own' ? o.camera : lv.camera);
  if (o.out.mix > 0) renderLevel(lv, real);
}
// Ende (oder Überspringen): Bedienung blendet ein, Titel, Kamera frei in der Heimpose der Station 10
function endOpener() {
  const a = state.opener;
  if (!a) return;
  state.opener = null;
  const lv = a.lv;
  if (!a.o.done) {
    lv.camera.up.set(0, 1, 0);
    lv.camera.position.copy(lv.home.pos);
    lv.camera.lookAt(lv.home.target);
    state.veil = 1;
  }
  if (lv.opening) lv.opening(1);
  lv.target = lv.home.target.clone();
  hud.skip(false);
  hud.hint('');
  hud.intro(false);
  hud.caption(lv.meta, true);
  state.controls.target.copy(lv.target);
  state.controls.enabled = true;
  state.controls.update();
  state.cine = { idle: 0, w: 0, base: null };
}
function skipOpener() {
  if (state.opener && !state.opener.skip) state.opener.skip = 1e-6;
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
    const e = smoother(0, 1, f.t);
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
// Auftaktpose: eigene der Station (lv.intro) oder aus der Nähe, seitlich versetzt – die Kamera zieht sich im Bogen in die
// Heimpose zurück und gibt die Szene frei
function introPose(lv) {
  if (lv.intro) return lv.intro;
  const T = lv.home.target, v = lv.home.pos.clone().sub(T).applyAxisAngle(lv.camera.up, INTRO.yaw).multiplyScalar(INTRO.near);
  return { pos: T.clone().add(v), target: T.clone() };
}
function startIntro(lv) {
  if (still()) return;
  state.intro = { t: 0, dur: INTRO.dur, from: introPose(lv), to: pose(lv.home.pos, lv.home.target) };
  state.controls.enabled = false;
  hud.intro(true);
}
function stepIntro(dt) {
  const it = state.intro;
  it.t = Math.min(1, it.t + dt / it.dur);
  // Anfahren aus dem Stand, langes Ausrollen: Tempo 12 t (1 − t)², am Anfang und Ende null
  const e = 1 - Math.pow(1 - it.t, 3) * (1 + 3 * it.t);
  const lv = state.active;
  it.tgt = flyPose(lv.camera, it.from, it.to, e, smooth(0, 0.8, it.t));
  if (it.t >= 1) endIntro();
}
function endIntro() {
  const it = state.intro;
  if (!it) return;
  state.intro = null;
  // abgebrochen: um den Punkt weiterdrehen, auf den die Kamera gerade blickt – der Blick springt nicht
  state.controls.target.copy(it.tgt || state.active.home.target);
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
  const off = lv.camera.position.clone().sub(c.target), d = off.length();
  // vor dem Anschlag weich abbremsen statt im letzten Bild hart zu stoppen: je Bild höchstens ein Anteil des restlichen Wegs
  const room = Math.max(0, step > 0 ? Math.log(c.maxDistance / d) : Math.log(d / c.minDistance));
  const lim = room * (1 - Math.exp(-dt * WHEEL.edge));
  if (Math.abs(step) > lim) { step = Math.sign(step) * lim; state.zoomV = dt > 0 ? step / dt : 0; }
  state.zoom -= step;
  const d1 = THREE.MathUtils.clamp(d * Math.exp(step), c.minDistance, c.maxDistance);
  if (d1 === d) { state.zoom = 0; state.zoomV = 0; return; }   // am Anschlag Rest verwerfen – weiter scrollen übernimmt der Rand-Zug
  lv.camera.position.copy(c.target).addScaledVector(off, d1 / d);
}

// ---------- Rand-Angebot: am Zoom-Anschlag weiter scrollen → dezenter Hinweis, erst der Klick darauf fliegt hinaus bzw. hinein
// (User 2026-10-27: kein Ebenenwechsel allein durchs Mausrad) ----------
canvas.addEventListener('wheel', (ev) => {
  const c = state.controls, lv = state.active;
  if (!c || state.tr || state.intro || state.opener || !ev.deltaY) return;
  const d = lv.camera.position.distanceTo(c.target);
  const out = ev.deltaY > 0;
  const atMax = d >= (c.maxDistance || Infinity) * 0.985;
  const atMin = d <= (c.minDistance || 0) * 1.04;
  const to = out ? atMax && lv.meta.parent : atMin && diveCandidate()?.to;
  // vom Anschlag weg scrollen oder kein Ziel mehr in der Mitte: Hinweis zurückziehen
  state.offer = to ? { out, to, t: OFFER_HOLD } : null;
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
const KINO_BARS = 1.3;   // Kino-Modus: Balken etwas dicker als 2,39:1 (User 27.10.2026)

// advanced: die Welt der Station (bewegte Objekte) wurde in diesem Bild schon vor der Kamera weitergerückt (frame)
function renderLevel(lv, dt, advanced = false) {
  if (lv.advance && !advanced) lv.advance(dt, state.time, !!state.tr);
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
  let lv = state.active, advanced = false;
  if (!lv) return;
  if (state.tr) {
    stepTransition(real);
    lv = state.active;   // am Ende einer Etappe ist schon die Zielstation aktiv
  } else if (state.opener) stepOpener(real);
  else if (state.intro) stepIntro(real);
  else {
    cineUndo(lv);
    // Welt vor der Kamera: bewegte Objekte (Europa Clipper) stehen schon an der Lage dieses Bildes, bevor die Folgen-Kamera
    // auf sie zielt – sonst hinkt die Kamera ein Bild hinterher und Objekt, Punkt und Abzeichen zittern bei ungleichen Bildzeiten
    if (lv.advance) { lv.advance(real, state.time, false); advanced = true; }
    if (state.follow) stepFollow(lv, real);
    // Rückgabe 'free': die Station übernimmt die Kamera (z. B. Blick-Wechsel), Folgen endet
    if (lv.orbitUpdate && lv.orbitUpdate(state.controls, real) === 'free') state.follow = null;
    stepZoom(lv, real);
    state.controls.update();
    cineApply(lv, real);
  }
  const tr = state.tr, op = state.opener && state.opener.o;
  if (tr) {
    renderLevel(tr.outer, real);
    renderLevel(tr.inner, real);
  } else if (op) renderOpener(op, lv, real);
  else renderLevel(lv, real, advanced);
  if (camlog) logCams(real);

  // Grading: im Flug zwischen den Stationen überblenden
  if (tr) blendLook(lookA, tr.outer.look || {}, tr.inner.look || {}, smooth(0.2, 0.8, tr.prog));
  else { const la = op ? op.look : lv.look || {}; blendLook(lookA, la, la, 0); }   // Auftakt-Film: eigener Look, läuft auf den der Station zu
  // Farblook aus dem Zahnrad Global: Kontrast, Sättigung, Tönung, Vignette ersetzen den Look der Station, Belichtung und Bloom
  // wirken relativ (Station bleibt so hell, wie sie gebaut ist); „Station“ = null → Look der Station
  const G = globalGrade(), fx = tr && state.chain ? flightFx(state.chain) : 0;
  look.exposure = lookA.exposure * (G ? G.exposure : 1) * settings.S.exposure;
  if (state.opener && state.opener.skip) look.exposure *= Math.max(0, 1 - state.opener.skip / OPENER.skipFade);   // Überspringen: abblenden
  if (state.veil > 0) {   // danach aus dem Schwarz aufblenden
    look.exposure *= 1 - state.veil * state.veil * (3 - 2 * state.veil);
    state.veil = Math.max(0, state.veil - real / OPENER.veil);
  }
  look.bloom = settings.S.bloom ? lookA.bloom * (G ? G.bloom / 0.12 : 1) : 0;
  look.sat = G ? G.sat : lookA.sat; look.con = G ? G.con : lookA.con; look.vig = ((G ? G.vig : lookA.vig) + FLYFX.vig * fx) * settings.S.vig;
  look.ca = settings.S.lens ? lookA.ca * (1 + FLYFX.ca * fx) : 0;
  look.grain = settings.S.grain ? lookA.grain : 0;
  look.sh.fromArray(G ? G.sh : lookA.sh); look.hi.fromArray(G ? G.hi : lookA.hi);
  const ehtOf = (x) => (x && x.post ? x.post.eht : null);
  const ea = ehtOf(tr ? tr.outer : lv), eb = ehtOf(tr ? tr.inner : null);
  look.ehtA.set(ea ? ea[0] : 0, ea ? ea[1] : 0, ea ? ea[2] : 0);
  look.ehtB.set(eb ? eb[0] : 0, eb ? eb[1] : 0, eb ? eb[2] : 0);
  // Kinobalken: Auftakt fest, sonst Zahnrad „Kinobalken 2,39:1“ (Balkenhöhe je Seite aus dem Fensterformat)
  bars += ((state.opener ? 0.11 * state.opener.o.tune.bars : state.intro ? 0.11 : settings.S.bars ? Math.max(0, (1 - innerWidth / innerHeight / 2.39) / 2) * KINO_BARS : 0) - bars) * Math.min(1, real * 2.5);
  look.bars = bars;
  const mixed = op && op.out.mix > 0;
  post.render(op ? op.rt : tr ? tr.outer.rt : lv.rt, mixed ? lv.rt : tr ? tr.inner.rt : null,
    mixed ? { mix: op.out.mix } : tr ? { prog: tr.prog, maskR: tr.maskR, blur: tr.blur, veil: tr.veil, anchor: tr.anchorUv, inner: tr.innerUv } : null, look, state.time);

  if (!tr) hud.update(lv.camera, lv, state.time);
  hud.hint(!tr && lv.hint ? lv.hint() : '');   // Hinweis-Zeile des Films (Station 11)
  if (state.offer && (state.offer.t -= real) <= 0) state.offer = null;
  hud.setOffer(tr ? null : state.offer);
  stepTour(real);
  stepProbe(real);
  if (fps) {
    fps.n++; fps.sum += real;
    if (fps.sum > 2) { console.log(`[kosmos] ${Math.round(fps.n / fps.sum)} fps · Stufe ${pickQuality()}`); fps.n = 0; fps.sum = 0; }
  }
}

// je Bild: Zeit, Bildzeit, Lage, Flugstand, je Kamera Station, Ort, Bezugspunkt (Abstand dorthin = Maß der Fahrt: Anker der
// äußeren Kamera, sonst Blickziel), Drehung (Quaternion), Blickwinkel
function logCams(real) {
  const tr = state.tr, mode = tr ? 'fly' : state.intro ? 'intro' : state.follow ? 'follow' : state.cine.w > 0 ? 'cine' : 'free';
  const turning = tr && state.chain.turn && tr.outer.id === state.chain.turn.id;
  const cams = tr ? [[tr.outer, turning ? tr.outerTgt : tr.anchor], [tr.inner, tr.innerTgt]] : [[state.active, state.controls.target]];
  camlog.push({
    t: state.time, dt: real, mode, prog: tr ? tr.prog : null,
    cams: cams.map(([l, tg]) => [l.id, ...l.camera.position.toArray(), ...tg.toArray(), ...l.camera.quaternion.toArray(), l.camera.fov]),
  });
}

function stepTour(dt) {
  if (!tour || state.tr || state.intro) return;
  tour.since += dt;
  if (tour.since > tour.dwell) { tour.since = 0; goTo(nextOnRoute(state.id)); }
}

// Auto-Qualität (perf.js): misst nur ruhige Bilder – kein Flug, kein Auftakt-Film, keine Station im Bau
function stepProbe(dt) {
  if (isAuto()) autoQ.step(dt, !state.tr && !state.opener && !state.loading.size, settings.S.fpsCap);
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
  onOffer: () => { const o = state.offer; state.offer = null; if (o) goTo(o.to); },
});

onSettings((keys) => {
  if (keys.includes('quality')) applyQuality();
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
// Film erneut abspielen (Ereignis kosmos:auftakt): erst in Station 10, dann von vorn
window.addEventListener('kosmos:auftakt', async () => {
  if (state.opener || state.tr || still()) return;
  const lv = await getLevel(OPENER.land);
  if (state.active !== lv) { activate(lv); resize(); }
  await startOpener(lv);
  if (state.opener) state.opener.o.film.playing = true;
});

async function start() {
  try {
    resize();
    const id = (location.hash.match(/station=(\w+)/) || [])[1];
    // Auftakt-Film bei jedem Aufruf ohne Stations-Link und bei jedem Neuladen, danach steht Station 10; ohne Film wie
    // bisher: Stations-Link oder erste Station der Route, Kranfahrt in die Heimpose
    const reload = (performance.getEntriesByType('navigation')[0] || {}).type === 'reload';
    const film = OPENER.on && !still() && (params.has('auftakt') ? params.get('auftakt') !== '0' : !tour && (!STATIONS[id] || reload));
    const first = film ? OPENER.land : STATIONS[id] ? id : ROUTE[0];
    await bootLoad(first);
    const lv = await getLevel(first);
    activate(lv);
    resize();
    if (film) await startOpener(lv);
    document.body.classList.add('is-ready');
    if (!state.opener) {
      hud.caption(lv.meta, !id);
      if (!id) startIntro(lv);
    }
    requestAnimationFrame(frame);
    // Film erst starten, wenn das Ladebild fast weg ist – sonst läuft der Anfang unter dem Ladebild
    boot.done().then(() => { if (state.opener) state.opener.o.film.playing = true; });
  } catch (err) {
    console.error(err);
    document.body.classList.add('is-fatal', 'fatal-start');
  }
}
start();
