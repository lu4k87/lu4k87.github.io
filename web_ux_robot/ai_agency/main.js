// Agenten-Büro v2: Renderer, Kamera (3rd Person), Eingabe, Raycaster für Hover/Klick, Aufnahmen (window.__shot).
// Varianten per URL: ?raum=A|B|C&figur=A|B|C&info=A|B|C&chat=A|B|C&look=A…G (Standard je C, Look A) · ?ao=1 · ?nohud · ?warm=40 · ?freeze · ?auto
import * as THREE from 'three';
import { LOOKS, addLights, createPipeline } from './look.js';
import { makeKit } from './kit.js';
import { buildOffice } from './office.js';
import { makePerson, animatePerson } from './cast.js';
import { createSim, Actor } from './sim.js';
import { createUI } from './ui.js';
import { OPS } from './ops.js';
import * as WF from './data/wf.js';
import SETUP from './data/setup.js';

const Q = new URLSearchParams(location.search);
const up = (key, d) => (Q.get(key) || d).toUpperCase();
const CFG = { nohud: Q.has('nohud'), look: up('look', 'A'), shot: Q.get('shot') || '', warm: +(Q.get('warm') || 0), freeze: Q.has('freeze'), auto: Q.has('auto'), seed: +(Q.get('seed') || 7), ao: Q.get('ao') === '1' };
const V = { raum: up('raum', 'C'), figur: up('figur', 'C'), info: up('info', 'C'), chat: up('chat', 'C') };
const root = document.documentElement; root.dataset.look = CFG.look; Object.entries(V).forEach(([k, v]) => root.dataset[k] = v); if (CFG.nohud) root.classList.add('nohud');
const L = LOOKS[CFG.look] || LOOKS.A;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * t; };

await Promise.all([`700 30px ${L.font}`, `500 20px ${L.font}`, `500 20px ${L.mono}`, '20px "Noto Color Emoji"'].map(f => document.fonts.load(f).catch(() => null)));

// ───────────────────────── Renderer + Welt ─────────────────────────
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 260); camera.layers.enable(1);
const k = makeKit(L, renderer); k.V = V;
const W = buildOffice(scene, k, L, V.raum, SETUP);
addLights(scene, L, W.lay.bounds);
const pipe = await createPipeline(renderer, scene, camera, L, { ao: CFG.ao, mode: Q.get('pipe') || '' });
function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); pipe.size(w, h); }
new ResizeObserver(resize).observe(stage); resize();

// echte Chats aus Claude Ops (Port 18097) – ohne Erreichbarkeit/CORS bleiben Demo-Daten (gekennzeichnet)
const live = { ok: false, n: 0 };
const S = createSim({ scene, W, k, L, CFG, D: SETUP, live });
async function pollLive(first) {   // Claude Ops liefert Chats (/api/state sessions) und echte Claims (claims); ohne Erreichbarkeit oder CORS bleibt alles Demo
  try {
    const r = await fetch(OPS + '/api/state', { signal: AbortSignal.timeout(1500) }); const j = await r.json();
    const sess = (j.sessions || []).filter(s => s.alive);
    if (first && sess.length) S.bind(sess);
    live.ok = true; live.n = sess.length; S.setLiveClaims(j.claims);
  } catch { if (live.ok) { live.ok = false; S.redrawClaims(); } }
  const ds = document.getElementById('data-src'); if (ds) { ds.textContent = live.ok ? `Live: Claude Ops (${live.n} Chats)` : 'Demo-Daten'; ds.className = 'badge ' + (live.ok ? 'live' : 'demo'); }
}
await pollLive(true);
if (!CFG.freeze) setInterval(() => pollLive(false), 30000);

// Spieler (Du)
const youP = makePerson(k, L, { kind: 'player', skin: L.skin[0] });
const you = new Actor(scene, youP, W.lay.start[0], W.lay.start[1], W.lay.start[2], L); you.speed = 3.2;
const youBadge = k.label([{ t: 'Du', size: 22, weight: 800 }, { t: 'Product Owner', size: 15, weight: 500 }], { h: 0.4, order: 10 }); youBadge.position.y = 1.95; youP.root.add(youBadge);
function walkYou(x, z) { const a = W.nav.nearest(you.x, you.z), b = W.nav.nearest(x, z); you.station = null; you.path = [W.nav.n[a], ...W.nav.path(a, b).slice(1), { x, z }]; you.faceTo = null; }

const UI = createUI({ S, W, k, L, D: SETUP, V, scene, camera, renderer, you, walkYou, live });

// ───────────────────────── Kamera + Steuerung ─────────────────────────
const cam = { yaw: W.lay.start[2] + Math.PI, pitch: 0.5, dist: 11, tx: you.x, tz: you.z };
let fixedCam = null;
const keys = new Set(); let drag = null;
addEventListener('keydown', e => { if (e.target.closest('input,textarea,select')) return; keys.add(e.code); if (e.code === 'KeyE') interact(); if (e.code === 'Escape') UI.closeAll(); });
addEventListener('keyup', e => keys.delete(e.code));
renderer.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch, moved: false }; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', e => { pointer.set(e.clientX, e.clientY); if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; cam.yaw = drag.yaw - dx * 0.006; cam.pitch = Math.min(1.35, Math.max(0.18, drag.pitch + dy * 0.004)); });
renderer.domElement.addEventListener('pointerup', e => { if (drag && !drag.moved) click(e); drag = null; });
renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); cam.dist = Math.min(36, Math.max(4.5, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });

// Raycaster: Stationen über ihre Boxen, Chat-Figuren über ihre Position, Tafeln über das Mesh
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pointer = new THREE.Vector2(-1e4, -1e4);
const boxes = [...W.st.values()].filter(Z => !(Z.id === 'bench' && V.raum === 'B')).map(Z => ({ id: Z.id, box: new THREE.Box3().setFromObject(Z.g) }));
const boards = []; W.st.forEach(Z => Z.g.traverse(o => { if (o.userData.board) boards.push(o); }));
function pick(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1), camera);
  const bh = ray.intersectObjects(boards, false)[0]; if (bh) return { board: bh.object.userData.board, dist: bh.distance };
  let best = null; const tmp = new THREE.Vector3();
  S.chats.forEach(c => { if (!c.alive) return; tmp.set(c.a.x, 0.95, c.a.z); const d = ray.ray.distanceSqToPoint(tmp); if (d < 0.55 && (!best || tmp.distanceTo(ray.ray.origin) < best.dist)) best = { chat: c, dist: tmp.distanceTo(ray.ray.origin) }; });
  if (best) return best;
  boxes.forEach(b => { if (ray.ray.intersectBox(b.box, tmp)) { const d = tmp.distanceTo(ray.ray.origin); if (!best || d < best.dist) best = { station: b.id, dist: d }; } });
  return best;
}
function click(e) {
  const hit = pick(e.clientX, e.clientY);
  if (UI.click(hit)) return;
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, p)) return; walkYou(p.x, p.z);
}
function playerStep(dt) {
  const f = (keys.has('KeyW') || keys.has('ArrowUp')) - (keys.has('KeyS') || keys.has('ArrowDown')), s = (keys.has('KeyD') || keys.has('ArrowRight')) - (keys.has('KeyA') || keys.has('ArrowLeft'));
  if (f || s) {
    you.path = []; const run = keys.has('ShiftLeft') || keys.has('ShiftRight'), sp = (run ? 5.5 : 3.2) * dt;
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let mx = fx * f + rx * s, mz = fz * f + rz * s; const n = Math.hypot(mx, mz); mx /= n; mz /= n;
    const [x0, z0, x1, z1] = W.lay.bounds; you.x = Math.min(x1 - 1, Math.max(x0 + 1, you.x + mx * sp)); you.z = Math.min(z1 - 1, Math.max(z0 + 1, you.z + mz * sp));
    you.h = lerpAngle(you.h, Math.atan2(mx, mz), Math.min(1, dt * 12)); animatePerson(youP, run ? 'run' : 'walk', dt, L); you.sync();
  } else you.update(dt);
}
function camStep(dt, snap = false) {
  const kk = snap || reduced ? 1 : Math.min(1, dt * 6); cam.tx += (you.x - cam.tx) * kk; cam.tz += (you.z - cam.tz) * kk;
  const cp = Math.cos(cam.pitch);
  camera.position.set(cam.tx + Math.sin(cam.yaw) * cp * cam.dist, 1.1 + Math.sin(cam.pitch) * cam.dist, cam.tz + Math.cos(cam.yaw) * cp * cam.dist);
  camera.lookAt(cam.tx, 1.1, cam.tz);
}
function stationAt(x, z) { let best = null, bd = 9; W.st.forEach(Z => { const [, cx, cz, w, d, rot] = Z.def; const dx = x - cx, dz = z - cz, lx = dx * Math.cos(rot) - dz * Math.sin(rot), lz = dx * Math.sin(rot) + dz * Math.cos(rot); const ox = Math.max(0, Math.abs(lx) - w / 2), oz = Math.max(0, Math.abs(lz) - d / 2), dd = ox * ox + oz * oz; if (dd < bd) { bd = dd; best = Z; } }); return best; }
function interact() {
  let b = null, bd = 1e9; S.ex.forEach(ex => { const d = Math.hypot(ex.chat.a.x - you.x, ex.chat.a.z - you.z); if (d < bd) { bd = d; b = ex; } });
  if (b && bd < 3.2) return UI.ask(b);
  const Z = stationAt(you.x, you.z); if (Z) UI.openInfo(Z.id);
}

// ───────────────────────── Start ─────────────────────────
UI.init();
[7, 5, 2, 0, 8].forEach((i, n) => { if (n < 4) S.newOrder(); }); S.tpl = 9; S.nextOrder = 8;
if (CFG.warm) { const dt = 1 / 30; for (let t = 0; t < CFG.warm; t += dt) S.step(dt); }
camStep(0, true);

// ───────────────────────── Aufnahmen (Vorschau) ─────────────────────────
// window.__shot('raum' | 'figur' | 'info' | 'chat'): feste Kameras/Bühnen je Motiv, gleicher Ausschnitt für alle Varianten
function makeStage(build) {
  const st = new THREE.Scene(); st.background = new THREE.Color(L.bg);
  st.add(new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]));
  const sun = new THREE.DirectionalLight(L.sun[0], L.sun[1]); sun.position.set(-5, 12, 10); st.add(sun);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const c = sun.shadow.camera; c.left = -10; c.right = 10; c.top = 10; c.bottom = -10; c.near = 1; c.far = 40; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  const back = new THREE.DirectionalLight(L.hemi[0], 0.35); back.position.set(6, 6, -8); st.add(back);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ color: L.floor, roughness: 0.95 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; st.add(fl);
  build(st); return st;
}
const tag = (st, lines, x, y, z) => { const s = k.label(lines, { h: 0.3, depthTest: false, order: 20 }); s.position.set(x, y, z); st.add(s); };
function lookFrom(t, yaw, pitch, dist) { const cp = Math.cos(pitch); fixedCam = { p: new THREE.Vector3(t[0] + Math.sin(yaw) * cp * dist, t[1] + Math.sin(pitch) * dist, t[2] + Math.cos(yaw) * cp * dist), t: new THREE.Vector3(...t) }; }
function stationCam(id, yaw = 0.4, pitch = 0.5, dist = 7.5) { const Z = W.st.get(id), [, , , , , rot] = Z.def; lookFrom([Z.g.position.x, 0.9, Z.g.position.z], rot + yaw, pitch, dist); }
const stages = {};
// Kamera so versetzen, dass die Station neben dem offenen Panel steht (Schublade/Terminal rechts, Tafel/Antwortfeld unten)
function framed(t, yaw, pitch, dist, panel) {
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)], sx = (panel === 'right' ? 0.19 : panel === 'right-s' ? 0.1 : 0) * 2 * Math.tan(THREE.MathUtils.degToRad(20)) * dist * 1.78, ly = panel === 'bottom' ? -1.3 : panel === 'above' ? 1.0 : 0;
  lookFrom([t[0] + right[0] * sx, t[1] + ly, t[2] + right[2] * sx], yaw, pitch, dist);
}
const askNow = () => { for (let i = 0; i < 4000 && !S.ex.length; i++) S.step(1 / 30); };   // offene Rückfrage sichtbar machen (nur Simulation, kein Rendern)
const stationPos = id => { const Z = W.st.get(id); return [Z.g.position.x, 0.9, Z.g.position.z]; };
window.__shot = name => {
  pipe.setView(scene); youP.root.visible = true;
  if (name === 'raum') {
    root.classList.add('nohud'); youP.root.visible = false; const [x0, z0, x1, z1] = W.lay.bounds, B = V.raum === 'B';
    lookFrom([(x0 + x1) / 2, 0.3, (z0 + z1) / 2 + (B ? 0.5 : 1.6)], B ? 0.2 : 0.0, B ? 0.98 : 0.74, Math.max(x1 - x0, (z1 - z0) * 1.55) * (B ? 0.78 : 0.8));
    return 'ok';
  }
  if (name === 'figur') {
    root.classList.add('nohud');
    stages.figur ||= makeStage(st => {
      const tools = ['Claude', 'Codex', 'Gemini'], rows = [['designer', 0.5], ['dev', -1.3]], X = [-2.3, -0.7, 0.9];
      rows.forEach(([role, z], r) => tools.forEach((t, i) => { const P = makePerson(k, L, { kind: 'chat', tool: t, scale: 1.3, skin: L.skin[(i + r) % L.skin.length] }); P.setRole(role); P.root.position.set(X[i], 0, z); st.add(P.root); animatePerson(P, 'idle', 0.5, L); }));
      tools.forEach((t, i) => tag(st, [{ t: t, size: 26, weight: 800 }, { t: ['nativ', 'Bridge', 'Bridge'][i], size: 17, weight: 500, mono: true }], X[i], 0.04, 1.45));
      [['Opus', true], ['Sonnet', false]].forEach(([m, ed], i) => { const P = makePerson(k, L, { kind: 'sub', scale: 1.05, agent: { id: m, model: m, edits: ed }, skin: L.skin[0] }); P.root.position.set(2.9 + i * 1.3, 0, 0.5); st.add(P.root); animatePerson(P, 'idle', 0.5, L); tag(st, [{ t: 'Subagent', size: 22, weight: 700 }, { t: `${m} · ${ed ? 'ändert' : 'liest'}`, size: 17, weight: 500, mono: true }], P.root.position.x, 0.04, 1.45); });
    });
    pipe.setView(stages.figur); fixedCam = { p: new THREE.Vector3(0.7, 2.3, 6.7), t: new THREE.Vector3(0.7, 0.9, -0.3) };
    return 'ok';
  }
  if (name === 'info') {
    root.classList.remove('nohud'); youP.root.visible = false; const id = 'agents', Z = W.st.get(id), rot = Z.def[5];
    askNow(); UI.closeAll(); UI.hover({ station: id }); UI.openInfo(id);
    framed(stationPos(id), rot + 0.35, 0.5, 9.0, V.info === 'C' ? 'right' : V.info === 'A' ? 'bottom' : '');
    return 'ok';
  }
  if (name === 'chat') {
    root.classList.remove('nohud'); youP.root.visible = false;
    askNow();
    const c = (S.ex[0] && S.ex[0].chat) || S.chats.find(x => x.alive);
    if (!c) return 'kein Chat';
    UI.closeAll(); UI.openChat(c);
    if (V.chat === 'B') { const D = W.st.get('doors'), bp = D.S.board.getWorldPosition(new THREE.Vector3()); framed([bp.x, 3.3, bp.z], D.def[5] + 0.2, 0.2, 7.0, 'right-s'); }
    else framed([c.a.x, 1.0, c.a.z], c.a.h + Math.PI + 0.55, 0.36, 6.4, V.chat === 'C' ? 'right' : 'above');
    return 'ok';
  }
  return 'unbekannt: ' + name;
};

let last = performance.now(), hudT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!CFG.freeze && !(reduced && S.t > (CFG.warm || 0) + 1)) { S.step(dt); playerStep(dt); S.ambient(dt); }
  else you.update(0);
  if (fixedCam) { camera.position.copy(fixedCam.p); camera.lookAt(fixedCam.t); } else camStep(dt, CFG.freeze);
  if (!fixedCam) UI.hover(drag ? null : pick(pointer.x, pointer.y));
  UI.frame(dt);
  S.chats.forEach(c => { if (c.badge) c.badge.material.opacity = Math.min(1, Math.max(0.22, (Math.hypot(c.a.x - camera.position.x, 1.9 - camera.position.y, c.a.z - camera.position.z) - 3) / 2.5)); });
  hudT += dt; if (hudT > 0.12 || CFG.freeze) { hudT = 0; UI.tick(); }
  pipe.render();
  if (!document.hidden) requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });
requestAnimationFrame(frame);
root.classList.add('ready');
window.__dbg = { S, W, you, scene, camera, V, L, UI }; window.__agentsReady = true;
