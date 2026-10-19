// Agenten-Büro v3 (Bonbon): Würfel-Wesen nach den Vorlagen des Users, 3 Zoom-Ebenen mit ruhiger Kamerafahrt,
// sechs Oberflächen (?v=A…F, Standard F). Aufnahmen für die Vorschau: window.__shot(name, arg).
import * as THREE from 'three';
import { addLights, createPipeline } from './look.js';
import { makeKit } from './kit.js';
import { buildOffice, ICON } from './office.js';
import { makePerson, animatePerson } from './cast.js';
import { createSim, Actor, HEAD } from './sim.js';
import { logoSize, hotLogo } from './logos.js';
import { VARIANTS, lookFor, THEME } from './v3.js';
import { createLevels } from './levels.js';
import { buildWorld } from './world.js';
import { createShell } from './shell.js';
import { createMarks } from './marks.js';
import { OPS } from './ops.js';
import { homeOf } from './items.js';
import * as WF from './data/wf.js';
import SETUP from './data/setup.js';

const Q = new URLSearchParams(location.search);
const VK = (Q.get('v') || 'K').toUpperCase(), V = VARIANTS[VK] || VARIANTS.K;   // Standard = Kombination (Wahl des Users 2026-10-14)
const CFG = { nohud: Q.has('nohud'), warm: +(Q.get('warm') || 0), freeze: Q.has('freeze'), auto: Q.has('auto'), seed: +(Q.get('seed') || 7), ao: Q.get('ao') === '1' };
const root = document.documentElement; root.classList.add('v3'); root.dataset.look = 'C'; root.dataset.shell = V.shell; root.dataset.v = VK; root.dataset.theme = THEME;
document.getElementById('hud')?.remove();   // HUD von v2 wird hier nicht gebraucht: sonst doppelte IDs (#safe, #mode, #reply)
if (CFG.nohud) root.classList.add('nohud');
await new Promise(res => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = './v3.css'; l.onload = l.onerror = res; document.head.appendChild(l); });
const L = lookFor(V);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
await Promise.all([`700 30px ${L.font}`, `500 20px ${L.font}`, `500 20px ${L.mono}`, '20px "Noto Color Emoji"'].map(f => document.fonts.load(f).catch(() => null)));

// ───────────────────────── Renderer + Welt ─────────────────────────
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); stage.appendChild(renderer.domElement);
const cv = renderer.domElement;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 260); camera.layers.enable(1);
const k = makeKit(L, renderer); k.V = { cube: V };
const W = buildOffice(scene, k, L, 'C', SETUP);
addLights(scene, L, W.lay.bounds);
const WO = buildWorld(scene, k, L, W, THEME === 'nacht');   // Campus-Park (Wahl des Users 2026-10-16), Schalter „Umgebung“ im Ansicht-Menü
const pipe = await createPipeline(renderer, scene, camera, L, { ao: CFG.ao });
let shell = null;
function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); pipe.size(w, h); if (shell) shell.pads(); }
new ResizeObserver(resize).observe(stage); resize();

// echte Chats + Claims aus Claude Ops: unter /agenten-buero/ gleicher Origin (CSP connect-src 'self'), auf Port 8766 per CORS nur lesen – sonst Demo-Daten, gekennzeichnet
const live = { ok: false, n: 0 };
const S = createSim({ scene, W, k, L, CFG, D: SETUP, live });
async function pollLive(first) {
  try {
    const r = await fetch(OPS + '/api/state', { signal: AbortSignal.timeout(1500) }); const j = await r.json();
    const sess = (j.sessions || []).filter(s => s.alive);
    if (first && sess.length) S.bind(sess);
    live.ok = true; live.n = sess.length; S.setLiveClaims(j.claims);
  } catch { if (live.ok) { live.ok = false; S.redrawClaims(); } }
}
await pollLive(true);
if (!CFG.freeze) setInterval(() => pollLive(false), 30000);

// Du (Product Owner) am Tresen · Kubi, der Lotse (nur Variante F)
const T = W.st.get('tresen'), sp = T.toW(T.S.tresen);
const youP = makePerson(k, L, { kind: 'player' });
const you = new Actor(scene, youP, sp.x + 0.9, sp.z, sp.face, L); you.speed = 3.0;
const youBadge = k.label([{ t: 'Du', size: 22, weight: 800 }, { t: 'Product Owner', size: 15, weight: 500 }], { h: 0.4, order: 10 }); youBadge.position.y = 1.75; youP.root.add(youBadge);
let kubi = null;
if (V.shell === 'guide' || V.combo) {
  const P = makePerson(k, L, { kind: 'player', who: 'Lotse' }); kubi = new Actor(scene, P, sp.x - 0.9, sp.z, sp.face, L);
  const b = k.label([{ t: 'Kubi', size: 22, weight: 800 }, { t: 'dein Lotse', size: 15, weight: 500 }], { h: 0.4, order: 10 }); b.position.y = 1.75; P.root.add(b);
}
S.crowd.push(...[you, kubi].filter(Boolean));   // Du + Kubi halten auch Abstand zu den Figuren
const marks = createMarks(scene, W, reduced);
const sim = { paused: false, speed: 1 };   // Pause (Leertaste, Knopf in der Kopfleiste) + Tempo (Ansicht-Menü)
function walkYou(x, z) { const a = W.nav.nearest(you.x, you.z), b = W.nav.nearest(x, z); you.path = [W.nav.n[a], ...W.nav.path(a, b).slice(1), { x, z }]; you.faceTo = null; }

const levels = createLevels({ camera, W, S, reduced });
// Eintrag der Oberfläche → Markierung im Raum: Figur (Chat, Agent), Platz (Fachrolle an der Werkbank) oder Bereich
function markOf(spec) {
  if (!spec) return null;
  if (spec.item) {
    const it = spec.item, a = actorFor(it); if (a) return { actor: a };
    if (it.type === 'role' && WF.FACH.includes(it.id)) { const B = W.st.get('bench'), p = B.toW(B.S.seats[WF.FACH.indexOf(it.id)]); return { x: p.x, z: p.z, r: 0.55 }; }
    if (it.type === 'order') { const o = S.orders.find(x => x.id === it.id), c = o && o.chat; if (c && c.alive) return { actor: c.a }; }
    spec = { station: it.station || homeOf(it.type, it.id) };
  }
  return spec.station && W.st.has(spec.station) ? { station: spec.station } : null;
}
const hilite = spec => { const m = markOf(spec), lv = levels.state; marks.set('hov', m && m.station && lv.level >= 2 && m.station === lv.station ? null : m); };
shell = createShell({ S, W, D: SETUP, V, levels, live, camera, renderer, walkYou, hilite, sim, anchor: () => marks.anchor(), world: on => WO.show(on) });
WO.show(shell.prefs.welt !== false);   // ?welt=0 = ohne Umgebung (Aufnahmen)
for (let i = 0; i < 4; i++) S.newOrder();
S.tpl = 9; S.nextOrder = 8;
if (CFG.warm) { const dt = 1 / 30; for (let t = 0; t < CFG.warm; t += dt) S.step(dt); }
shell.go(1, {}, { instant: true });

// ───────────────────────── Eingabe ─────────────────────────
let drag = null; const pointer = new THREE.Vector2(-1e4, -1e4);
cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  pointer.set(e.clientX, e.clientY); if (!drag) return;
  if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 5) drag.moved = true;
  if (drag.moved) levels.drag(e.clientX - drag.lx, e.clientY - drag.ly); drag.lx = e.clientX; drag.ly = e.clientY;
});
cv.addEventListener('pointerup', e => { if (drag && !drag.moved) click(e); drag = null; });
cv.addEventListener('pointerleave', () => pointer.set(-1e4, -1e4));
cv.addEventListener('wheel', e => { e.preventDefault(); levels.zoom(Math.sign(e.deltaY)); }, { passive: false });
addEventListener('keydown', e => {
  const t = e.target; if (t && t.closest && t.closest('input, textarea, select')) { if (e.key === 'Escape') t.blur(); return; }   // Ereignis kann auch vom Fenster kommen (kein Element)
  if (e.key === 'Escape' || e.key === 'Backspace') shell.up();
  if (e.key === ' ' && (t === document.body || t === cv || !t.closest)) { e.preventDefault(); shell.togglePause(); }   // Leertaste nur ohne Fokus auf einem Knopf (dort drückt sie den Knopf)
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && levels.state.level === 2 && !(t && t.closest && t.closest('#viewmenu, select'))) shell.step(e.key === 'ArrowLeft' ? -1 : 1);
  if (e.key === '/' && (V.shell === 'cmd' || V.combo)) { e.preventDefault(); if (V.combo) shell.openFind(); else document.getElementById('cmd-in').focus(); }
});

const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const boxes = [...W.st.values()].map(Z => ({ id: Z.id, box: new THREE.Box3().setFromObject(Z.g) }));
const actorFor = it => it.type === 'kubi' ? kubi : it.type === 'chat' ? S.chats.find(c => c.id === it.id && c.alive)?.a : it.type === 'agent' ? S.subPool?.get(it.id)?.actor : null;
function pick(cx, cy) {
  const r = cv.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1), camera);
  let best = null; const tmp = new THREE.Vector3();
  const person = (a, item, logo) => {
    tmp.set(a.x, 0.7, a.z); let d = ray.ray.distanceSqToPoint(tmp), dd = tmp.distanceTo(ray.ray.origin);
    if (logo && logo.visible) { const r = logo.scale.x / 2; tmp.set(a.x, logo.position.y + r, a.z); const dl = ray.ray.distanceSqToPoint(tmp); if (dl < r * r && dl / (r * r) < d / 0.36) { d = 0; dd = tmp.distanceTo(ray.ray.origin); } }   // Logo-Knopf über dem Kopf trifft auch
    if (d < 0.36 && (!best || dd < best.dist)) best = { item, dist: dd };
  };
  S.chats.forEach(c => { if (c.alive) person(c.a, { type: 'chat', id: c.id, station: c.a.station || 'doors' }, c.logo); });
  if (levels.state.level > 1 && S.subPool) S.subPool.forEach((p, id) => person(p.actor, { type: 'agent', id, station: 'agents' }));
  if (kubi && V.combo) person(kubi, { type: 'kubi', id: 'Kubi' });   // Kubi anklicken = Lotse an
  if (best) return best;
  boxes.forEach(b => { if (ray.ray.intersectBox(b.box, tmp)) { const d = tmp.distanceTo(ray.ray.origin); if (!best || d < best.dist) best = { station: b.id, dist: d }; } });
  return best;
}
function click(e) {
  const hit = pick(e.clientX, e.clientY), st = levels.state;
  if (hit && hit.item && hit.item.type === 'kubi') { if (shell.prefs.lotse) shell.tourGo(0); else shell.setPref('lotse', true); return; }   // erster Klick: Lotse an, danach Tour
  if (hit && hit.item) return shell.go(3, { item: hit.item });
  if (hit && hit.station && !(st.level >= 2 && hit.station === st.station)) return shell.go(2, { station: hit.station });
  if (st.level >= 2) { const p = new THREE.Vector3(); if (ray.ray.intersectPlane(plane, p)) walkYou(p.x, p.z); }   // im Bereich: Du läufst hin
}
let hoverKey = '', hoverSign = null;
function hover() {
  const hit = drag || levels.flying() ? null : pick(pointer.x, pointer.y), lv = levels.state.level;
  const key = hit ? (hit.item ? hit.item.type + hit.item.id : 's' + hit.station) : '';
  cv.style.cursor = hit ? 'pointer' : drag ? 'grabbing' : 'grab';
  if (key === hoverKey) { if (hoverSign && hit && hit.item) { const a = actorFor(hit.item); if (a) hoverSign.position.set(a.x, 2.2, a.z); } return; }
  S.chats.forEach(c => { if (c.logo) hotLogo(c.logo, !!(hit && hit.item && hit.item.type === 'chat' && hit.item.id === c.id)); });
  hoverKey = key; if (hoverSign) { scene.remove(hoverSign); hoverSign.material.map.dispose(); hoverSign = null; }
  marks.set('ptr', !hit ? null : hit.item ? (actorFor(hit.item) ? { actor: actorFor(hit.item) } : null) : lv >= 2 && hit.station === levels.state.station ? null : { station: hit.station });
  if (!hit || (hit.station && lv === 1)) return;   // Haus: Schilder stehen schon über jedem Bereich
  if (hit.item) { const a = actorFor(hit.item); if (!a) return; hoverSign = k.label([{ t: hit.item.id, size: 22, weight: 700 }, { t: hit.item.type === 'kubi' ? (shell.prefs.lotse ? 'Klick: Tour starten' : 'Klick: Lotse erklärt') : 'Klick: ganz nah', size: 15, weight: 500 }], { h: 0.46, order: 14, depthTest: false }); hoverSign.position.set(a.x, 2.2, a.z); }
  else { const Z = W.st.get(hit.station), here = lv >= 2 && hit.station === levels.state.station; hoverSign = k.label([{ t: `${ICON[hit.station]} ${Z.info.name}`, size: 24, weight: 700 }, { t: here ? 'Klick: Du läufst hin' : 'Klick: hinfliegen', size: 15, weight: 500 }], { h: 0.5, order: 14, depthTest: false }); hoverSign.position.set(Z.g.position.x, Z.top + 0.5, Z.g.position.z); }
  scene.add(hoverSign);
}

// ───────────────────────── Aufnahmen (Vorschau) ─────────────────────────
let fixed = null, flyView = null;
function makeStage(build) {
  const st = new THREE.Scene(); st.background = new THREE.Color(L.bg);
  st.add(new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]));
  const sun = new THREE.DirectionalLight(L.sun[0], L.sun[1]); sun.position.set(-4, 10, 9); st.add(sun);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4; const c = sun.shadow.camera; c.left = -8; c.right = 8; c.top = 8; c.bottom = -8; c.near = 1; c.far = 40; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  const back = new THREE.DirectionalLight('#FFFFFF', 0.4); back.position.set(6, 6, -8); st.add(back);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ color: L.floor, roughness: 0.95 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; st.add(fl);
  build(st); return st;
}
const tag = (st, lines, x, y, z) => { const s = k.label(lines, { h: 0.3, depthTest: false, order: 20 }); s.position.set(x, y, z); st.add(s); };
const stages = {};
const lookAtFrom = (t, yaw, pitch, dist) => { const cp = Math.cos(pitch); return { p: new THREE.Vector3(t[0] + Math.sin(yaw) * cp * dist, t[1] + Math.sin(pitch) * dist, t[2] + Math.cos(yaw) * cp * dist), t: new THREE.Vector3(...t) }; };
const askNow = () => { for (let i = 0; i < 4000 && !S.ex.length; i++) S.step(1 / 30); };   // offene Rückfrage sichtbar (nur Simulation)
window.__shot = (name, arg) => {
  fixed = null; flyView = null; pipe.setView(scene); root.classList.remove('nohud');
  if (['e1', 'e2', 'e3', 'search', 'tour'].includes(name)) askNow();
  const [x0, z0, x1, z1] = W.lay.bounds;
  if (name === 'haus') { root.classList.add('nohud'); fixed = lookAtFrom([(x0 + x1) / 2, -2, (z0 + z1) / 2 + 2], 0.32, 0.62, 98); return 'ok'; }   // Haus mit Umgebung
  if (name === 'welt') { root.classList.add('nohud'); fixed = lookAtFrom([(x0 + x1) / 2, 0, (z0 + z1) / 2], 0.62, 0.2, 60); return 'ok'; }   // Blick zum Horizont
  if (name === 'hero') {   // gleiche Kamera wie das Vorher-Bild (v2 Raum:C, Bonbon)
    root.classList.add('nohud'); fixed = lookAtFrom([(x0 + x1) / 2, 0.3, (z0 + z1) / 2 + 1.6], 0, 0.74, Math.max(x1 - x0, (z1 - z0) * 1.55) * 0.8); return 'ok';
  }
  if (name === 'einrichtung') { root.classList.add('nohud'); shell.go(2, { station: 'roles' }, { instant: true }); fixed = lookAtFrom([-9.5, 0.6, 1.2], 1.15, 0.52, 11.5); return 'ok'; }   // Blick über Türen, Rollen, Skills, Tresen, Agentur: fünf Phasenfarben
  if (name === 'avatar') {
    root.classList.add('nohud');
    stages.avatar ||= makeStage(st => {
      const row = [['Claude', 'designer', 'idle'], ['Codex', 'dev', 'work'], ['Gemini', 'tester', 'wait']];
      row.forEach(([t, r, m], i) => { const P = makePerson(k, L, { kind: 'chat', tool: t }); P.setRole(r); P.lockMood = m; P.root.position.set(-1.45 + i * 1.1, 0, 0); P.root.rotation.y = (1 - i) * 0.12; st.add(P.root); animatePerson(P, m === 'work' ? 'work' : m === 'wait' ? 'wait' : 'idle', 0.6, L); tag(st, [{ t, size: 24, weight: 800 }, { t: `${WF.ROLES[r].icon} ${WF.ROLES[r].name}`, size: 17, weight: 500 }], P.root.position.x, 0.04, 0.85); });
      [['Opus', true], ['Sonnet', false]].forEach(([m, ed], i) => { const P = makePerson(k, L, { kind: 'sub', agent: { id: m, model: m, edits: ed } }); P.root.position.set(1.85 + i * 0.95, 0, 0.35); st.add(P.root); animatePerson(P, 'idle', 0.6, L); tag(st, [{ t: 'Subagent', size: 20, weight: 700 }, { t: `${m} · ${ed ? 'ändert' : 'liest'}`, size: 16, weight: 500 }], P.root.position.x, 0.04, 0.85); });
      const you2 = makePerson(k, L, { kind: 'player' }); you2.root.position.set(-2.6, 0, 0.35); st.add(you2.root); animatePerson(you2, 'idle', 0.6, L); tag(st, [{ t: 'Du', size: 24, weight: 800 }, { t: 'Product Owner', size: 16, weight: 500 }], -2.6, 0.04, 0.85);
    });
    pipe.setView(stages.avatar); fixed = { p: new THREE.Vector3(0.1, 1.3, 6.3), t: new THREE.Vector3(0.1, 0.58, 0) }; return 'ok';
  }
  if (name === 'posen') {   // alle Rollen als Würfel + Bewegungsposen (Laufen in 3 Phasen, Arbeiten, Reden, Warten, Jubel)
    root.classList.add('nohud');
    stages.posen ||= makeStage(st => {
      const roles = Object.keys(WF.ROLES), tools = ['Claude', 'Codex', 'Gemini'];
      roles.forEach((r, i) => { const P = makePerson(k, L, { kind: 'chat', tool: tools[i % 3] }); P.setRole(r); P.root.position.set(-5.5 + i * 1.1, 0, -2.4); st.add(P.root); animatePerson(P, 'idle', 0.6, L); tag(st, [{ t: `${WF.ROLES[r].icon} ${WF.ROLES[r].name}`, size: 15, weight: 600 }], P.root.position.x, 0.04, -1.6); });
      [['walk', 0], ['walk', Math.PI / 2], ['walk', Math.PI], ['work', 1], ['talk', 1], ['wait', 1], ['cheer', 1]].forEach(([m, ph], i) => {
        const P = makePerson(k, L, { kind: 'chat', tool: tools[i % 3] }); P.setRole('dev'); P.root.position.set(-3.3 + i * 1.1, 0, 1.4); st.add(P.root);
        P.gait = m === 'walk' ? 1 : 0; P.phase = ph - (m === 'walk' ? 10 : 3) * 0.6; animatePerson(P, m, 0.6, L, 1);   // eine Glättung von 0,6 s = Pose voll erreicht
        tag(st, [{ t: m === 'walk' ? `walk ${['0', '½π', 'π'][i]}` : m, size: 15, weight: 600, mono: true }], P.root.position.x, 0.04, 2.2);
      });
    });
    pipe.setView(stages.posen); fixed = { p: new THREE.Vector3(0, 6.0, 8.0), t: new THREE.Vector3(0, 0.2, -0.5) }; return 'ok';
  }
  if (name === 'e1') { shell.go(1, {}, { instant: true }); return 'ok'; }
  if (name === 'e2') { shell.go(2, { station: arg || 'agents' }, { instant: true }); return 'ok'; }
  if (name === 'e3') { const [type, id, station] = (arg || 'agent:safety-reviewer:agents').split(':'); shell.go(3, { item: { type, id, station } }, { instant: true }); return 'ok'; }
  if (name === 'fly') { root.classList.add('nohud'); shell.go(1, {}, { instant: true }); flyView = levels.sample(levels.home(), levels.stationView('agents'), +arg || 0); return 'ok'; }
  if (name === 'search') { shell.go(1, {}, { instant: true }); shell.search(arg || 'safe'); return 'ok'; }
  if (name === 'tour') { shell.tourGo(+arg || 0); return 'ok'; }
  if (name === 'menu') { shell.go(+arg || 2, +arg === 1 ? {} : { station: 'agents' }, { instant: true }); shell.openMenu(true); return 'ok'; }
  return 'unbekannt: ' + name;
};

// ───────────────────────── Takt ─────────────────────────
let last = performance.now(), hudT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!CFG.freeze && !sim.paused && !(reduced && S.t > (CFG.warm || 0) + 1)) { S.step(dt * sim.speed); S.ambient(dt); }
  you.update(dt); if (kubi) kubi.update(dt);
  levels.update(dt);
  if (fixed) { camera.position.copy(fixed.p); camera.lookAt(fixed.t); } else levels.apply(flyView || undefined);
  // Namensschilder: Haus ohne (ruhig) · Bereich: Chats + Agenten im Einsatz (die 17 Wartenden decken sich sonst gegenseitig zu;
  // Name zeigt der Zeiger) · Detail: keine (Ring + Karte zeigen die Figur, Schilder wären aus der Nähe riesig)
  const ls = levels.state, lv = ls.level;
  // Logo-Knopf über dem Kopf: 40–64 px hoch auf jeder Ebene; Schild (Ebene 2) und Sprechblase stapeln sich darüber, nichts überdeckt sich
  const vh = cv.clientHeight || 720;
  S.chats.forEach(c => {
    if (c.badge) c.badge.visible = lv === 2 && c.a.station === ls.station;   // nur wer in diesem Bereich ist (Vordergrund-Schilder wären riesig)
    if (!c.logo) return;
    const d = camera.position.distanceTo(c.P.root.position), z = logoSize(camera, d, vh) * (c.logo.userData.hot ? 1.15 : 1), gap = z * 0.18;
    c.logo.scale.set(z, z, 1); let y = HEAD + z + gap;
    if (c.badge && c.badge.visible) { c.badge.position.y = y + c.badge.scale.y / 2; y += c.badge.scale.y + gap; }
    c.topY = y + 0.2;
  });
  if (S.subPool) S.subPool.forEach(p => { if (p.badge) p.badge.visible = lv === 2 && p.busy && p.actor.station === ls.station; });
  youBadge.visible = lv < 3; if (kubi) kubi.P.root.children.forEach(o => { if (o.isSprite) o.visible = lv < 3; });
  marks.set('sel', lv === 2 ? { station: ls.station } : lv === 3 && ls.item ? markOf({ item: ls.item }) : null); marks.update(now / 1000, camera.position.distanceTo(levels.target()));
  if (!fixed && !flyView) hover();
  shell.frame();
  hudT += dt; if (hudT > 1.2) { hudT = 0; shell.tick(); }
  pipe.render();
  if (!document.hidden) requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });
requestAnimationFrame(frame);
root.classList.add('ready');
window.__dbg = { S, W, you, scene, camera, V, L, levels, shell }; window.__agentsReady = true;
