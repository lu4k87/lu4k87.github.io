// Ablauf: Stationen laden, Kamera steuern, Stationen im durchgehenden Flug wechseln, Bild zusammenführen (post.js).
// Stationen bilden einen Baum (content.js parent): Hineinfliegen = Kind, Hinaus = Eltern; weiter entfernte Ziele fliegt
// die Reise über die gemeinsamen Eltern an (mehrere Etappen ohne Halt). Beide Kameras zoomen mit derselben Rate,
// logarithmisch im Abstand – so trägt derselbe Flug über 20 Größenordnungen.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STATIONS, ROUTE, pathTo } from './content.js';
import { createPost } from './post.js';
import { createHud } from './hud.js';
import { settings, onSettings } from './settings.js';

const LOADERS = {
  earth: () => import('./levels/earth.js'),
  solar: () => import('./levels/solar.js'),
  galaxy: () => import('./levels/galaxy.js'),
  orion: () => import('./levels/orion.js'),
  crab: () => import('./levels/crab.js'),
  pulsar: () => import('./levels/pulsar.js'),
  sgra: () => import('./levels/sgra.js'),
  local: () => import('./levels/local.js'),
  web: () => import('./levels/web.js'),
  cmb: () => import('./levels/cmb.js'),
};

// Flug: äußere Kamera zoomt um ZOOM auf den Anker zu, die innere kommt aus ZOOM-fachem Abstand an (gleiche Rate)
const ZOOM = 22;
// Ankunft mit etwas mehr Abstand als die Heimpose: erst Überblick, dann zoomt der Besucher selbst
const ARRIVE = 1.25;
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
const texCache = new Map();
function tex(name, srgb = true) {
  if (texCache.has(name)) return texCache.get(name);
  const t = texLoader.load(`tex/${name}`, () => { for (const lv of state.levels.values()) lv.dirty = true; });
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texCache.set(name, t);
  return t;
}

const state = {
  levels: new Map(), loading: new Map(), active: null, id: null, tr: null, queue: [], controls: null,
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

function buildLevel(id) {
  const job = (async () => {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const mod = await LOADERS[id]();
    const q = QUALITY[pickQuality()];
    const lv = mod.create({ renderer, tex, date: now, detail: q.detail, still: still() });
    lv.id = id;
    lv.meta = STATIONS[id];
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
    renderer.compile(lv.scene, lv.camera);
    state.levels.set(id, lv);
    state.loading.delete(id);
    return lv;
  })();
  state.loading.set(id, job);
  job.catch((err) => { console.error(`[kosmos] Station ${id}:`, err); state.loading.delete(id); });
  return job;
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
  Object.assign(c, lv.orbit || {});
  c.autoRotate = false;
  c.target.copy(lv.target);
  c.addEventListener('start', () => { userInput(); state.dragging = true; });
  c.addEventListener('end', () => { state.dragging = false; });
  c.update();
  state.controls = c;
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
  const i = ROUTE.indexOf(id);
  return ROUTE[(i + step + ROUTE.length) % ROUTE.length];
}

// ---------- Flug ----------
const pose = (pos, target) => ({ pos: pos.clone(), target: target.clone() });
function poseAt(target, from, dist) {
  const dir = from.clone().sub(target).normalize();
  return { pos: target.clone().addScaledVector(dir, dist), target: target.clone() };
}
const _d0 = new THREE.Vector3(), _d1 = new THREE.Vector3(), _q = new THREE.Quaternion();
// Pose zwischen a und b: Blickziel linear (früher am Ziel: tk), Richtung als Kugelbogen, Abstand logarithmisch
function flyPose(cam, a, b, e, tk = e) {
  const target = a.target.clone().lerp(b.target, tk);
  _d0.copy(a.pos).sub(a.target);
  _d1.copy(b.pos).sub(b.target);
  const l0 = Math.log(Math.max(_d0.length(), 1e-9)), l1 = Math.log(Math.max(_d1.length(), 1e-9));
  _q.setFromUnitVectors(_d0.normalize(), _d1.normalize());
  const dir = _d0.clone().applyQuaternion(new THREE.Quaternion().slerp(_q, e));
  cam.position.copy(target).addScaledVector(dir, Math.exp(l0 + (l1 - l0) * e));
  cam.lookAt(target);
  return target;
}
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

async function goTo(targetId) {
  if (!STATIONS[targetId] || state.tr || !state.active || targetId === state.id) return;
  endIntro();
  state.queue = pathTo(state.id, targetId);
  hud.setRouteTarget(targetId);
  // alle Etappen gleich laden, damit die Fahrt ohne Halt durchläuft
  await Promise.all(state.queue.map((id) => getLevel(id)));
  hop();
}

async function hop() {
  const toId = state.queue.shift();
  if (!toId) return;
  const from = state.active;
  const to = await getLevel(toId);
  if (state.tr || state.active !== from) return;
  const down = to.meta.parent === from.id;
  const outer = down ? from : to;
  const inner = down ? to : from;
  const anchor = anchorOf(outer, inner.id);
  cineUndo(from);
  state.controls.enabled = false;
  const cur = pose(from.camera.position, state.controls.target);
  let outerFrom, outerTo, innerFrom, innerTo;
  const arrival = (lv) => poseAt(lv.home.target, lv.home.pos, lv.home.pos.distanceTo(lv.home.target) * ARRIVE);
  if (down) {
    state.poses.set(from.id, cur);
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
  if (down) state.poses.get(from.id).child = to.id;
  const multi = state.queue.length > 0;
  state.tr = {
    t: 0, dur: still() ? 1.2 : settings.S.dive * (multi ? 0.75 : 1), down, outer, inner, to, anchor,
    outerFrom, outerTo, innerFrom, innerTo, prog: 0, maskR: 0, blur: 0, veil: 0,
    anchorUv: new THREE.Vector2(0.5, 0.5), innerUv: new THREE.Vector2(0.5, 0.5), captioned: false,
  };
  hud.hideMarkers(true);
  hud.setFlight(true, to.meta, multi);
}

function stepTransition(dt) {
  const tr = state.tr;
  tr.t = freeze !== null ? freeze : Math.min(1, tr.t + dt / tr.dur);
  const e = still() ? tr.t : easeInOut(tr.t);
  const p = tr.down ? e : 1 - e;            // 0 = nur äußeres Bild, 1 = nur inneres
  // äußeres Blickziel schwenkt früh auf den Anker (beim Hinausfliegen erst am Ende weg davon)
  const tkOuter = tr.down ? smooth(0, 0.45, e) : smooth(0.55, 1, e);
  flyPose(tr.outer.camera, tr.outerFrom, tr.outerTo, e, tkOuter);
  const innerTgt = flyPose(tr.inner.camera, tr.innerFrom, tr.innerTo, e);
  tr.outer.camera.updateMatrixWorld();
  tr.inner.camera.updateMatrixWorld();
  const a = tr.anchor.clone().project(tr.outer.camera);
  const b = innerTgt.clone().project(tr.inner.camera);
  tr.anchorUv.set(Math.min(0.95, Math.max(0.05, (a.x + 1) / 2)), Math.min(0.95, Math.max(0.05, (a.y + 1) / 2)));
  tr.innerUv.set((b.x + 1) / 2, (b.y + 1) / 2);
  tr.prog = p;
  tr.maskR = 0.05 * Math.pow(ZOOM, p) * smooth(0, 0.08, p);
  tr.blur = still() ? 0 : 0.09 * Math.sin(Math.PI * p);
  tr.veil = still() ? 0 : Math.pow(Math.sin(Math.PI * e), 1.6);
  // Maßstab in der Leiste läuft logarithmisch mit
  const wOut = fieldWidth(tr.outer), wIn = fieldWidth(tr.inner);
  hud.setScale(Math.exp(Math.log(wOut) * (1 - p) + Math.log(wIn) * p), p < 0.5 ? tr.outer : tr.inner);
  if (!tr.captioned && tr.t > 0.62 && state.queue.length === 0) { tr.captioned = true; hud.caption(tr.to.meta); }
  if (tr.t >= 1) {
    const to = tr.to;
    const end = tr.down ? tr.innerTo : tr.outerTo;
    to.camera.position.copy(end.pos);
    to.camera.lookAt(end.target);
    to.target = end.target.clone();
    state.tr = null;
    activate(to);
    if (state.queue.length) { hop(); return; }
    hud.setFlight(false);
    hud.hideMarkers(false);
    if (tour) tour.since = 0;
  }
}

// ---------- Folgen: Blickziel gleitet zu einem Objekt und bleibt darauf (Planeten laufen im Zeitraffer weiter) ----------
function startFollow(h) {
  const c = state.controls, lv = state.active;
  if (!c || state.tr || !h.focus) return;
  cineUndo(lv);
  state.follow = { h, t: 0, t0: c.target.clone(), d0: lv.camera.position.distanceTo(c.target), d1: h.focus() };
  c.minDistance = Math.min((lv.orbit && lv.orbit.minDistance) || Infinity, h.focus() * 0.3);
}
function stepFollow(lv, dt) {
  const f = state.follow, c = state.controls, cam = lv.camera;
  if (f.t < 1) {
    f.t = Math.min(1, f.t + dt / (still() ? 0.6 : 1.8));
    const e = easeInOut(f.t);
    const dir = cam.position.clone().sub(c.target).normalize();
    c.target.copy(f.t0).lerp(f.h.pos, e);
    cam.position.copy(c.target).addScaledVector(dir, Math.exp(Math.log(f.d0) + (Math.log(f.d1) - Math.log(f.d0)) * e));
  } else {
    const delta = f.h.pos.clone().sub(c.target);
    c.target.add(delta);
    cam.position.add(delta);
  }
}

// ---------- Leerlauf-Fahrt ----------
function cineUndo(lv) {
  const b = state.cine.base;
  if (!b) return;
  lv.camera.position.copy(b);
  state.cine.base = null;
}
function userInput() {
  endIntro();
  cineUndo(state.active);
  state.cine.idle = 0;
  state.cine.w = 0;
  if (tour) tour.since = -1e9;   // Tour endet bei Eingabe
}
function cineApply(lv, dt) {
  const ci = state.cine;
  ci.idle += dt;
  const on = !calm() && settings.S.cine && !state.dragging;
  ci.w = on ? Math.min(1, ci.w + (ci.idle > CINE.delay ? dt / CINE.ramp : -dt)) : Math.max(0, ci.w - dt);
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
  const lv = state.active;
  if (!lv) return;
  if (state.tr) stepTransition(real);
  else if (state.intro) stepIntro(real);
  else {
    cineUndo(lv);
    if (state.follow) stepFollow(lv, real);
    if (lv.orbitUpdate) lv.orbitUpdate(state.controls, real);
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
  look.exposure = lookA.exposure * settings.S.exposure;
  look.bloom = settings.S.bloom ? lookA.bloom : 0;
  look.sat = lookA.sat; look.con = lookA.con; look.vig = lookA.vig;
  look.ca = settings.S.lens ? lookA.ca : 0;
  look.grain = settings.S.grain ? lookA.grain : 0;
  look.sh.fromArray(lookA.sh); look.hi.fromArray(lookA.hi);
  const ehtOf = (x) => (x && x.post ? x.post.eht : null);
  const ea = ehtOf(tr ? tr.outer : lv), eb = ehtOf(tr ? tr.inner : null);
  look.ehtA.set(ea ? ea[0] : 0, ea ? ea[1] : 0, ea ? ea[2] : 0);
  look.ehtB.set(eb ? eb[0] : 0, eb ? eb[1] : 0, eb ? eb[2] : 0);
  bars += ((state.intro ? 0.11 : 0) - bars) * Math.min(1, real * 2.5);
  look.bars = bars;
  post.render(tr ? tr.outer.rt : lv.rt, tr ? tr.inner.rt : null, tr ? { prog: tr.prog, maskR: tr.maskR, blur: tr.blur, veil: tr.veil, anchor: tr.anchorUv, inner: tr.innerUv } : null, look, state.time);

  if (!tr) hud.update(lv.camera, lv, state.time);
  hud.setPull(state.pull, state.pullDir);
  state.pull = Math.max(0, state.pull - real * 0.6);
  stepTour(real);
  stepProbe(real);
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
});

onSettings((keys) => {
  if (keys.includes('quality')) { probe.done = settings.S.quality !== 'auto'; resize(); }
  if (keys.includes('motion') && still()) cineUndo(state.active);
  for (const lv of state.levels.values()) if (lv.setMotion) lv.setMotion(settings.S.motion, reducedSys);
});

window.addEventListener('keydown', (ev) => {
  if (ev.target.closest && ev.target.closest('input, select, textarea')) return;
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
canvas.addEventListener('pointerdown', () => userInput());

async function start() {
  try {
    resize();
    const id = (location.hash.match(/station=(\w+)/) || [])[1];
    const first = STATIONS[id] ? id : ROUTE[0];
    const lv = await getLevel(first);
    activate(lv);
    resize();
    document.body.classList.add('is-ready');
    hud.caption(lv.meta, first === ROUTE[0] && !id);
    if (first === ROUTE[0] && !id) startIntro(lv);
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    document.body.classList.add('is-fatal', 'fatal-start');
  }
}
start();
