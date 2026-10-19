// Ablauf eines Auftrags: Chats (Claude · Codex · Gemini) laufen die Stationen ab, Subagenten kommen aus der Agentur.
// Demo-Daten sind gekennzeichnet (chat.live = false); echte Chats aus Claude Ops /api/state bekommen sid + Titel.
import * as THREE from 'three';
import * as WF from './data/wf.js';
import { makePerson, animatePerson } from './cast.js';
import { drawBoard, drawChatBoard } from './office.js';
import { makeLogo } from './logos.js';

const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * t; };
const TOOLS = { Claude: { door: 0, hooks: 'all', subs: true }, Codex: { door: 1, hooks: 'all', subs: true }, Gemini: { door: 2, hooks: 'prepost', subs: false } };
const SRC2TOOL = { claude: 'Claude', codex: 'Codex', antigravity: 'Gemini', gemini: 'Gemini' };
export const TEMPLATES = [
  { type: 'q', prefix: 'RCU', title: 'Welcher Port hat rosbridge?' },
  { type: 'q', prefix: 'Agent', title: 'Was prüft format_check.py?' },
  { type: 'small', prefix: 'RCU', title: 'Jog-Abstand 8 → 12 px', role: 'designer', skills: ['ui-change'] },
  { type: 'small', prefix: 'Doku', title: 'Setup-Karte: Port korrigieren', role: 'editor', skills: ['docs'], level: 0 },
  { type: 'small', prefix: 'Infra', title: 'check_ports.py: Meldung klarer', role: 'dev', skills: [] },
  { type: 'safe', prefix: 'VLA', title: 'Watchdog: Zielfahrt bei Heartbeat-Ausfall anhalten', role: 'dev', skills: ['root-cause', 'vla-motion'] },
  { type: 'safe', prefix: 'VLA', title: 'Sandbox-Grenze vor dem Greifen prüfen', role: 'dev', skills: ['vla-motion'] },
  { type: 'ui', prefix: 'RCU', title: 'Hinweis-Glocke im Header', role: 'designer', skills: ['ui-change', 'preview', 'variation'] },
  { type: 'ui', prefix: 'Nexus', title: 'Stapel statt Schrittleiste', role: 'designer', skills: ['ui-change', 'preview', 'variation'] },
  { type: 'ui', prefix: 'Mon', title: 'Kennzahlen-Kacheln Evaluierung', role: 'designer', skills: ['ui-change', 'preview', 'dataviz'] },
  { type: 'small', prefix: 'Mon', title: 'SUS-Auswertung als Tabelle', role: 'research', skills: ['research'] },
  { type: 'small', prefix: 'Doku', title: 'Slogan fürs Poster schärfen', role: 'mkt', skills: ['project-copy'], level: 0 },
  { type: 'small', prefix: 'Infra', title: 'Kamerahalter für die ZED drucken', role: 'd3', skills: ['cad-print', 'blender'] },
  { type: 'small', prefix: 'Agent', title: 'Backlog: Erledigtes löschen', role: 'pm', skills: ['scrum'], level: 0 },
  { type: 'small', prefix: 'Agent', title: 'Workflow-Check (Mini-Retro)', role: 'scrum', skills: ['scrum'] },
];
const QUESTIONS = {
  ui: { q: 'Gleiche Änderung auch im UX | Compact Interface?', choices: ['ja', 'später', 'nein'] },
  safe: { q: 'Halt auch bei Servo-Jog oder nur bei Zielfahrt?', choices: ['beides', 'nur Zielfahrt'] },
};
// Station je Schritt (Weg eines Auftrags)
export const STEP_STATION = { 1: 'tresen', 2: 'roles', 3: 'skills', 4: 'roles', 5: 'previews', 6: 'bench', 7: 'qa', 8: 'docs', 9: 'post', 10: 'tresen' };

// Platz je Figur: Würfel 0,7 m breit + Arme → Radius 0,4 m × Größe (Helfer 0,78), v2-Menschen 0,3 m; GAP = Abstand belegter Plätze (Reihe + Reihe dahinter)
export const GAP = 1.0;
export const HEAD = 1.5;   // Höhe über dem Kopf der Chat-Würfel: hier sitzt der Logo-Knopf
// Belegter Platz → Nachbarplatz: erst links/rechts, dann versetzt eine Reihe dahinter (vom Tisch weg), dann weiter außen; [quer, zurück] in GAP
const CROWD = [[1, 0], [-1, 0], [0.5, 1], [-0.5, 1], [1.5, 1], [-1.5, 1], [2, 0], [-2, 0], [0, 2], [1, 2], [-1, 2]];
const LANE = 0.6;   // Rechtsverkehr: Abstand der Laufspur zur Mitte des Gangs (Gänge 2,6 m breit → Gegenverkehr läuft 1,2 m nebeneinander vorbei)
// Weg um LANE nach rechts versetzen (je Abschnitt zur Laufrichtung; an Ecken Gehrung), damit sich Gegenverkehr nie frontal begegnet
function keepRight(pts, off) {
  if (pts.length < 2) return pts.map(p => ({ x: p.x, z: p.z }));
  const nrm = (a, b) => { const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1; return [-dz / d, dx / d]; };
  return pts.map((p, i) => {
    const n1 = i > 0 ? nrm(pts[i - 1], p) : null, n2 = i < pts.length - 1 ? nrm(p, pts[i + 1]) : null, a = n1 || n2, b = n2 || n1;
    let nx = a[0] + b[0], nz = a[1] + b[1]; const l = Math.hypot(nx, nz);
    if (l < 1e-3) { nx = a[0]; nz = a[1]; } else { nx /= l; nz /= l; }
    const k = off / Math.max(0.5, nx * a[0] + nz * a[1]);
    return { x: p.x + nx * k, z: p.z + nz * k };
  });
}
let actorN = 0;
export class Actor {
  constructor(scene, P, x, z, h = 0, L) { this.id = ++actorN; this.r = (P.cube ? 0.4 : 0.3) * (P.rig ? P.rig.scale.x : 1); this.lane = ((this.id * 0.618) % 1 - 0.5) * 0.5; this.scene = scene; this.L = L; this.P = P; this.x = x; this.z = z; this.h = h; this.path = []; this.anim = 'idle'; this.faceTo = null; this.speed = 2.2; this.v = 0; this.station = null; scene.add(P.root); this.sync(); }
  sync() { this.P.root.position.set(this.x, 0, this.z); this.P.root.rotation.y = this.h; }
  // Weg mit Anfahren (4,5 m/s²), Bremsen vor dem Ziel (v² = 2·a·s) und abgerundeten Ecken: ein Zwischenpunkt gilt 0,3 m vorher als erreicht
  update(dt) {
    let remain = 0;
    for (let i = 0, px = this.x, pz = this.z; i < this.path.length; i++) { remain += Math.hypot(this.path[i].x - px, this.path[i].z - pz); px = this.path[i].x; pz = this.path[i].z; }
    const want = this.path.length ? Math.min(this.speed, Math.sqrt(2 * 3.2 * remain) + 0.12) : 0;
    this.v += Math.max(-7 * dt, Math.min(4.5 * dt, want - this.v));
    let moving = false;
    if (this.path.length) {
      while (this.path.length > 1 && Math.hypot(this.path[0].x - this.x, this.path[0].z - this.z) < 0.3) this.path.shift();
      const p = this.path[0], dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz), step = this.v * dt;
      if (d > 1e-4) this.h = lerpAngle(this.h, Math.atan2(dx, dz), Math.min(1, dt * 6));
      if (d <= step) { this.x = p.x; this.z = p.z; this.path.shift(); } else if (step > 0) { this.x += dx / d * step; this.z += dz / d * step; }
      moving = true;
    } else if (this.v < 0.02) this.v = 0;
    if (!this.path.length && this.faceTo != null) this.h = lerpAngle(this.h, this.faceTo, Math.min(1, dt * 4));
    animatePerson(this.P, moving ? (this.speed > 3 ? 'run' : 'walk') : this.anim, dt, this.L, this.v / this.speed); this.sync();
  }
}

export function createSim(ctx) {
  const { scene, W, k, L, CFG, D, live } = ctx;
  let _s = CFG.seed || 7;
  const rnd = () => { _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const hex = n => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('');
  const S = { chats: [], subs: [], orders: [], ex: [], log: [], claims: [], liveClaims: [], inbox: [], t: 0, stats: { done: 0, commits: 0, red: 0, hooks: 0, wait: 0, cycle: [] }, nextOrder: 0, tpl: 0, real: [], hardware: false, rnd, pick, hex };
  const evt = (kind, text, who, chat) => { S.log.unshift({ t: S.t, kind, text, who, cid: chat ? chat.id : null }); S.log.length = Math.min(S.log.length, 60); if (chat) chat.push(kind === 'ask' ? 'ask' : 'ai', text); };

  // ── Effekte: Lampen und Tore kurz aufleuchten lassen
  const flashes = [];
  function flash(mesh, color, dur = 0.7) { if (!mesh) return; if (!mesh.userData.base) mesh.userData.base = mesh.material.color.clone(); mesh.visible = true; flashes.push({ mesh, color: new THREE.Color(color), t: 0, dur }); }
  function updateFlashes(dt) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]; f.t += dt; const kk = Math.max(0, 1 - f.t / f.dur), m = f.mesh.material;
      m.color.copy(f.mesh.userData.base || m.color).lerp(f.color, kk); if (m.emissive) { m.emissive.copy(f.color).multiplyScalar(kk); m.emissiveIntensity = 2.2; }
      if (f.t >= f.dur) { if (f.mesh.userData.hideAfter) f.mesh.visible = false; if (m.emissive) m.emissive.setRGB(0, 0, 0); m.color.copy(f.mesh.userData.base || m.color); flashes.splice(i, 1); }
    }
  }
  const HOOK_COLOR = { SessionStart: L.signal.info, UserPromptSubmit: L.signal.info, PreToolUse: L.inkSoft, PostToolUse: L.signal.ok, Stop: L.signal.ok, 'pre-commit': L.signal.ok, 'pre-push': L.signal.ok };
  function flashHook(event) {
    const H = W.st.get('hooks'); if (!H) return; const lamps = H.S.lamps || []; if (!lamps.length) return;
    const names = Object.keys(H.S.lampOf || {}); let i = H.S.lampOf[event]; if (i == null) i = names.length ? Math.abs([...event].reduce((a, c) => a + c.charCodeAt(0), 0)) % lamps.length : 0;
    flash(lamps[i], HOOK_COLOR[event] || L.signal.ok, 0.8); S.stats.hooks++;
    if (event === 'Stop' && H.S.stopLamp) flash(H.S.stopLamp, L.signal.ok, 0.9);
  }
  S.flash = flash; S.flashHook = flashHook;

  // ── Wege
  function route(a, stationId, spot) {
    const Z = W.st.get(stationId), from = a.station ? W.st.get(a.station) : null, pts = [];
    if (from !== Z) { if (from) pts.push(from.open); pts.push(...keepRight(W.nav.path(from ? from.entry : W.nav.nearest(a.x, a.z), Z.entry), LANE + Math.abs(a.lane) * 0.25), Z.open); }   // Rechtsverkehr + leicht eigene Spur je Figur
    pts.push(spot); a.station = stationId; return pts;
  }
  function spot(stationId, key = 'work', idx = null) {
    const Z = W.st.get(stationId), raw = Z.S[key] || Z.S.work, v = Array.isArray(raw[0]) ? raw : [raw];
    Z.occ = Z.occ || {}; const occ = Z.occ[key] = Z.occ[key] || [];
    let i = idx ?? v.reduce((b, _, j) => (occ[j] || 0) < (occ[b] || 0) ? j : b, 0); if (i < 0 || i >= v.length) i = 0;
    // Platz schon belegt → Nachbarplatz nach CROWD (quer zur Blickrichtung, dann Reihe dahinter) statt in die andere Figur
    const n = occ[i] || 0; occ[i] = n + 1; const w = Z.toW(v[i]);
    if (n) { const [q, r] = CROWD[n - 1] || [(n % 2 ? 1 : -1) * Math.ceil(n / 2), 0]; w.x += (Math.cos(w.face) * q - Math.sin(w.face) * r) * GAP; w.z += (-Math.sin(w.face) * q - Math.cos(w.face) * r) * GAP; }
    w.release = () => { occ[i] = Math.max(0, occ[i] - 1); }; w.idx = i; return w;
  }
  function* wait(s) { let t = 0; while (t < s) t += yield; }
  function* walk(a, stationId, sp) { a.path = route(a, stationId, sp); a.faceTo = sp.face; a.anim = 'idle'; while (a.path.length) yield; }
  S.spot = spot; S.walk = walk;

  const badge = (lines, o = {}) => k.label(lines, { h: o.h || 0.4, order: 10, ...o });
  // Pinnwand: live aus Claude Ops, sonst nur die erfundenen Demo-Claims der Demo-Chats (mit „Demo ·“ davor)
  S.boardClaims = () => live && live.ok ? S.liveClaims.map(c => ({ who: c.who, task: c.task, files: c.files, text: `${c.who} · ${c.task}` })) : S.claims.map(c => ({ ...c, text: 'Demo · ' + c.text }));
  function drawClaims() { const b = W.st.get('claims').S.board; b.userData.redraw(x => drawBoard(x, b.userData.canvas.width, b.userData.canvas.height, L, S.boardClaims(), !!(live && live.ok))); }
  S.setLiveClaims = list => { S.liveClaims = (list || []).map(c => ({ who: c.who || '?', task: c.task || '', files: Array.isArray(c.files) ? c.files.join(', ') : (c.files || '') })); drawClaims(); };
  S.redrawClaims = drawClaims;
  function drawChats() { const b = W.st.get('doors').S.board; if (b) b.userData.redraw(x => drawChatBoard(x, b.userData.canvas.width, b.userData.canvas.height, L, S.chatList())); }
  S.chatList = () => S.chats.filter(c => c.alive).map(c => ({ tool: c.tool, id: c.id, ask: S.ex.some(e => e.chat === c), chat: c }));

  class Chat {
    constructor(order) {
      this.order = order; order.chat = this; this.tool = order.tool; this.cap = TOOLS[this.tool];
      const r = order.mine ? null : S.real.find(x => x.tool === this.tool && !x.used);   // eigener Auftrag im Büro = immer Demo, nie mit dem Namen eines echten Chats
      if (r) { r.used = true; this.id = r.name; this.sid = r.sid; this.src = r.src; this.title = r.title; this.live = true; }
      else {   // Demo-Name, eindeutig unter den Chats im Büro (sonst zeigt ein Klick den falschen Chat)
        const make = () => this.tool === 'Claude' ? 'dev-ws-' + hex(2) : this.tool === 'Codex' ? 'codex-' + hex(6) : 'antigravity-' + pick(['laptop', 'labor', 'home']);
        let id = make(); for (let i = 0; i < 20 && S.chats.some(c => c.id === id); i++) id = i < 10 ? make() : `${make()}-${hex(2)}`;
        this.id = id; this.live = false; this.src = { Claude: 'claude', Codex: 'codex', Gemini: 'antigravity' }[this.tool]; }
      this.P = makePerson(k, L, { kind: 'chat', skin: pick(L.skin), tool: this.tool });
      this.logo = makeLogo(this.tool); this.logo.position.y = HEAD; this.P.root.add(this.logo);   // Werkzeug-Logo als Knopf über dem Kopf (Größe + Höhe je Bild: main3.js)
      const d = spot('doors', 'door', this.cap.door); this.a = new Actor(scene, this.P, d.x, d.z, d.face, L); this.a.station = 'doors'; this.sp = d;
      this.role = null; this.step = 0; this.skills = new Set(); this.badge = null; this.bubble = null; this.msgs = []; this.gen = this.life(); this.alive = true;
      this.push('user', `[${order.prefix}] ${order.title}`);
      S.chats.push(this); drawChats();
    }
    get name() { return `[${this.tool}] ${this.id}`; }
    push(role, text) { this.msgs.push({ role, text, t: S.t }); if (this.msgs.length > 40) this.msgs.shift(); }
    setRole(r) { this.role = r; this.P.setRole(r); this.refresh(); }
    refresh() {
      if (this.badge) { this.P.root.remove(this.badge); this.badge.material.map.dispose(); }
      const R = this.role ? WF.ROLES[this.role] : null;
      this.badge = badge([{ t: this.name, size: 20, weight: 700 }, { t: `${R ? R.icon + ' ' + R.name : 'Chat-Start'} · [${this.order.prefix}]${this.live ? '' : ' · Demo'}`, size: 15, weight: 500 }], { h: 0.42 });
      this.badge.position.y = 1.9; this.P.root.add(this.badge);
    }
    say(text, kind = 'ask') {
      if (this.bubble) { this.P.root.remove(this.bubble); this.bubble = null; }
      this.P.lockMood = text ? ({ ask: 'wait', err: 'err', ok: 'ok' }[kind] || null) : null;
      if (!text) return;
      const col = { ask: L.signal.ask, err: L.signal.err, ok: L.signal.ok, info: L.label.bg }[kind];
      this.bubble = k.label([{ t: text, size: 22, weight: 700, color: kind === 'info' ? L.label.fg : '#1E1E1E' }], { h: 0.38, bg: col, border: kind === 'info' ? L.label.border : '#1E1E1E', order: 11 });
      this.bubble.position.y = 2.46; this.bubble.userData.kind = kind; this.P.root.add(this.bubble);
    }
    setStep(n) { this.step = n; this.order.stepsDone.add(n); }
    *work(sec, stationId, opt = {}) {
      this.a.anim = 'work'; const Z = W.st.get(stationId); const lamp = opt.lamp || ((Z.S.desks || []).length ? pick(Z.S.desks).userData.lamp : null);
      let t = 0, n = 0;
      while (t < sec) { const dt = yield; t += dt; if (opt.hooks && t > n * 1.1) { n++; if (lamp) flash(lamp, n % 2 ? L.inkSoft : L.signal.ok, 0.5); flashHook(n % 2 ? 'PreToolUse' : 'PostToolUse'); } }
      this.a.anim = 'idle';
    }
    *goto(stationId, key = 'work', idx = null) { if (this.sp && this.sp.release) this.sp.release(); this.sp = spot(stationId, key, idx); yield* walk(this.a, stationId, this.sp); }
    *exception(kind, data) {
      if (this.live && live && live.ok) { yield* wait(1.2); return data.choices[0]; }   // echter Chat: keine erfundene Rückfrage im Namen eines echten Chats
      const ex = { id: hex(4), kind, chat: this, station: this.a.station, ...data, since: S.t, done: false, choice: null };
      S.ex.push(ex); this.say(data.bubble, 'ask'); this.a.anim = 'wait'; evt('ask', data.title, this.name, this); drawChats();
      while (!ex.done) { const dt = yield; S.stats.wait += dt; if (CFG.auto && S.t - ex.since > 7) S.resolveEx(ex, ex.choices[0], true); }
      this.say(null); this.a.anim = 'idle'; drawChats(); return ex.choice;
    }
    *callSub(agentId, where, sec, result) {
      if (!this.cap.subs) { evt('info', `${agentId}: Prüfliste selbst abgearbeitet (Antigravity ohne Subagenten)`, this.name, this); yield* this.work(sec * 0.6, this.a.station); return; }
      const sub = new Sub(agentId, this, where, sec, result); while (!sub.reported) yield;
    }
    *life() {
      const o = this.order, T = WF.ORDER_TYPES[o.type], hooksAll = this.cap.hooks === 'all';
      this.refresh();
      yield* this.goto('doors', 'work');
      if (hooksAll) { flash(W.st.get('doors').S.gate.userData.bar, L.signal.ok, 0.9); flashHook('SessionStart'); this.say('Lagebild', 'info'); evt('hook', 'SessionStart · session_overview.py: Lagebild, Übergaben', this.name, this); }
      else evt('info', 'Antigravity: Claims + git status selbst gelesen (kein SessionStart-Hook)', this.name, this);
      yield* wait(0.8); this.say(null);
      this.setStep(1); yield* this.goto('tresen', 'queue'); this.a.anim = 'talk';
      if (hooksAll) { flashHook('UserPromptSubmit'); evt('hook', 'UserPromptSubmit · chat_length_hint.py', this.name); }
      yield* wait(1.0); this.P.setCard(true, L.ink); this.a.anim = 'idle'; evt('info', `Auftrag übernommen: [${o.prefix}] ${o.title}`, this.name, this);
      this.setStep(2); this.setRole('organizer'); yield* this.goto('roles'); yield* this.work(1.4, 'roles');
      evt('info', `Aufwand §0b: ${T.name}` + (o.role ? ` → ${WF.ROLES[o.role].name}` : ' → kurze Antwort'), this.name, this);
      this.setStep(3);
      const need = (o.skills || []).filter(s => !this.skills.has(s));
      if (o.type === 'q' || !need.length) { yield* this.goto('memory'); yield* this.work(1.2, 'memory'); evt('info', 'Kontext: AGENTS.md + MEMORY.md liegen bei', this.name, this); }
      else { yield* this.goto('skills'); yield* this.work(1.4, 'skills'); need.forEach(s => this.skills.add(s)); evt('skill', 'Skills geladen: ' + need.join(', '), this.name, this); }
      if (o.type !== 'q' && this.cap.subs && rnd() < 0.35) yield* this.callSub('ws-explorer', 'skills', 2.2, 'Fundstellen: 4 Dateien');
      if (o.type === 'q') { yield* this.answer(); return; }
      if (T.steps.includes(4)) {
        this.setStep(4); yield* this.goto('roles'); yield* this.work(1.0, 'roles');
        const Qn = QUESTIONS[o.type];
        if (Qn) { const c = yield* this.exception('ask', { title: `❓ F1 ${Qn.q}`, bubble: '❓ F1', question: Qn.q, choices: Qn.choices }); evt('info', `F1 → ${c} (deine Auswahl ist die Antwort)`, this.name, this); }
      }
      if (T.steps.includes(5)) {
        this.setStep(5); yield* this.goto('previews'); yield* this.work(2.0, 'previews', { hooks: true }); evt('info', 'Vorschau gebaut: spec.json → capture.py → build.py', this.name, this);
        const st = W.st.get('previews').S; st.button.material.color.set(L.signal.ask);
        const c = yield* this.exception('preview', { title: '🖼️ Vorschau wartet: Variante wählen', bubble: '🖼️ A · B · C', question: 'Welche Variante?', choices: ['A', 'B', 'C'] });
        st.button.material.color.set(L.ink); evt('info', `„An Chat senden“: Variante ${c} – endgültig`, this.name, this);
      }
      let tries = 0;
      for (;;) {
        this.setStep(6); this.setRole(o.role);
        if (!this.claimed) yield* this.claim();
        if (o.role === 'd3') { yield* this.goto('mcp'); yield* this.work(1.2, 'mcp'); evt('mcp', 'MCP blender: Live-Zugriff auf die Szene', this.name, this); }
        const seat = WF.FACH.indexOf(o.role); yield* this.goto('bench', 'seats', seat);
        if (this.cap.subs && o.type === 'small' && rnd() < 0.4 && o.role !== 'dev') yield* this.callSub('ws-worker', 'bench', 2.4, 'Änderung fertig – Haupt-Chat prüft git diff');
        const dsk = W.st.get('bench').S.deskOf[seat]; yield* this.work(3.2 + rnd() * 1.6, 'bench', { hooks: true, lamp: dsk && dsk.userData.lamp });
        evt('hook', 'PreToolUse → Edit → PostToolUse: post_edit_check.py ohne Befund', this.name, this);
        this.setStep(7); this.setRole('tester');
        const lvl = o.level ?? T.level; yield* this.goto('qa', 'lane', lvl);
        if (lvl >= 1 && o.role === 'designer') yield* this.callSub('ui-verifier', 'qa', 2.6, 'hell + dunkel, 360/1280 px: ohne Befund');
        else if (lvl === 3) { yield* this.callSub('safety-reviewer', 'robot', 3.0, '§0 geprüft: Halt greift, Sandbox unverändert'); yield* this.robotTest(); }
        else if (o.role === 'd3') yield* this.callSub('print-reviewer', 'bench', 2.2, 'druckbar, Passung 0,2 mm ok');
        else if (lvl >= 1) yield* this.callSub('test-runner', 'qa', 2.2, 'pytest 42/42');
        yield* this.work(1.4, 'qa');
        const arch = W.st.get('qa').S.arches[lvl];
        if (lvl >= 1 && tries < 1 && rnd() < 0.2) { tries++; S.stats.red++; flash(arch.userData.bar, L.signal.err, 1.4); this.say('❌ Test rot', 'err'); evt('err', 'Test rot → zurück ins Bauen, erneut prüfen', this.name, this); yield* wait(1.2); this.say(null); continue; }
        flash(arch.userData.bar, L.signal.ok, 1.0); evt('ok', `Prüfstufe ${lvl}: Beleg aus diesem Chat ✓`, this.name, this);
        break;
      }
      if (T.steps.includes(8)) {
        this.setStep(8); this.setRole('editor'); yield* this.goto('docs'); yield* this.work(1.8, 'docs', { hooks: true });
        if (rnd() < 0.3) yield* this.callSub('docs-auditor', 'docs', 2.0, '0 Abweichungen en/de');
        evt('info', 'Doku nachgezogen: docs/en + docs/de, Handbuch', this.name, this);
      }
      this.setStep(9); this.setRole('sync');
      yield* this.goto('post', 'gateIn'); const post = W.st.get('post').S;
      yield* this.goto('post', 'gateOut'); flash(post.gate.userData.bar, L.signal.ok, 1.0); flashHook('pre-commit');
      o.hash = hex(7); S.stats.commits++;
      evt('hook', `git commit · tools/pre-commit ✓ → ${o.type === 'safe' ? 'fix' : 'feat'}(${o.prefix.toLowerCase()}): ${o.hash}`, this.name, this);
      yield* this.goto('repos'); this.a.anim = 'work'; yield* wait(0.9); flash(W.st.get('repos').S.uplink, L.signal.ok, 1.2); flashHook('pre-push');
      evt('ok', `Push ${o.hash} → origin (nur Fast-Forward)`, this.name, this); this.a.anim = 'idle';
      yield* this.answer();
    }
    *claim() {
      const other = S.claims.find(c => c.prefix === this.order.prefix && c.chat !== this);
      const c = { chat: this, prefix: this.order.prefix, who: this.id, task: this.order.title, text: `${this.name} · [${this.order.prefix}] ${this.order.title.slice(0, 26)}`, conflict: false };
      yield* this.goto('claims');
      if (other && rnd() < 0.7) { c.conflict = true; S.claims.unshift(c); drawClaims(); this.say('💬 SendMessage', 'info'); evt('warn', `Claim-Konflikt mit ${other.who}: abstimmen statt überschreiben`, this.name, this); yield* wait(2.0); c.conflict = false; this.say(null); evt('info', 'abgestimmt: getrennte Dateien', this.name, this); }
      else S.claims.unshift(c);
      this.claimed = c; drawClaims(); evt('hook', 'todo_claim_hook.py: Zeile „🔒 In Arbeit“ in TODOS.md, sofort gepusht', this.name, this); yield* wait(0.4);
    }
    *robotTest() {
      const R = W.st.get('robot').S; yield* this.goto('robot'); R.busy = 2.6; evt('info', 'grasp_e2e.py --quick in Domain 94 (Robot | Digital Twin)', this.name, this); yield* wait(2.6);
      if (rnd() < 0.5) {
        const c = yield* this.exception('approve', { title: '🔒 Robot | Hardware freigeben?', bubble: '🔒 Freigabe?', question: 'Test auf echter Hardware? Nur du darfst freigeben.', choices: ['nein, Digital Twin reicht', 'freigeben'] });
        if (c === 'freigeben') { S.setRobotMode(true); R.busy = 3; evt('warn', 'Robot | Hardware – freigegeben von dir in diesem Chat', this.name, this); yield* wait(3); S.setRobotMode(false); }
        else evt('info', 'bleibt Robot | Digital Twin', this.name, this);
      }
    }
    *answer() {
      this.setStep(10); yield* this.goto('tresen', 'queue');
      if (this.cap.hooks === 'all') { if (rnd() < 0.12) { this.say('⚠️ Schluss neu', 'ask'); evt('warn', 'Stop · format_check.py blockt: Schluss neu ausgeben', this.name, this); yield* wait(1.2); } flashHook('Stop'); evt('hook', 'Stop · format_check.py: Antwortformat ok', this.name); }
      const o = this.order; this.P.setCard(false); this.say('✅ Antwort', 'ok'); this.a.anim = 'cheer';
      S.inbox.unshift({ order: o, chat: this.name, role: this.role ? WF.ROLES[this.role].name : 'Claude Chat Organizer', hash: o.hash, t: S.t });
      o.done = true; S.stats.done++; S.stats.cycle.push(S.t - o.t0);
      if (this.claimed) { S.claims.splice(S.claims.indexOf(this.claimed), 1); drawClaims(); }
      evt('ok', `🏁 [${o.prefix}] ${o.title}` + (o.hash ? ` · gepusht ${o.hash}` : ''), this.name, this);
      yield* wait(1.4); this.say(null); this.a.anim = 'idle';
      yield* this.goto('doors', 'door', this.cap.door); this.alive = false; drawChats();
    }
  }
  const subPool = new Map();
  class Sub {
    constructor(agentId, caller, where, sec, result) {
      const A = (D.agents || []).find(a => a.id === agentId) || WF.AGENTS.find(a => a.id === agentId) || { id: agentId, model: 'Sonnet', edits: false };
      this.A = A; this.caller = caller; this.reported = false; this.result = result;
      let P = subPool.get(agentId); if (P && P.busy) P = null; this.clone = !P;
      if (!P) { P = { P: makePerson(k, L, { kind: 'sub', skin: pick(L.skin), agent: A }), busy: false }; P.actor = new Actor(scene, P.P, 0, 0, 0, L); const sp = spot('agents'); P.home = sp; P.actor.x = sp.x; P.actor.z = sp.z; P.actor.station = 'agents'; P.actor.sync(); }
      this.pool = P; P.busy = true; this.a = P.actor; this.a.speed = 2.6;
      if (!P.badge) { P.badge = badge([{ t: A.id, size: 19, weight: 700 }, { t: `Subagent · ${A.model}${A.edits ? ' · ändert' : ' · nur lesen'}`, size: 15, weight: 500 }], { h: 0.36 }); P.badge.position.y = 1.55; P.P.root.add(P.badge); }
      this.gen = this.life(where, sec); S.subs.push(this);
      evt('agent', `Agent ${A.id} (${A.model}) mit Briefing: Zweck · Umfang · Fokus`, caller.name, caller);
    }
    *life(where, sec) {
      const sp = spot(where); yield* walk(this.a, where, sp); this.a.anim = 'work';
      let t = 0; while (t < sec) t += yield; sp.release();
      const c = this.caller.a, b = { x: c.x + Math.sin(c.h) * 0.9, z: c.z + Math.cos(c.h) * 0.9, face: c.h + Math.PI };
      yield* walk(this.a, this.caller.a.station, b); this.a.anim = 'talk'; yield* wait(0.8);
      evt('agent', `Befund ${this.A.id}: ${this.result}`, this.caller.name, this.caller); this.reported = true; this.a.anim = 'idle';
      const home = this.pool.home || spot('agents'); yield* walk(this.a, 'agents', home); this.a.anim = 'idle'; this.pool.busy = false; this.done = true;   // Stammplatz behalten, sonst füllt sich die Agentur mit Phantom-Belegungen
      if (this.clone) home.release();
      if (this.clone) scene.remove(this.a.P.root);
    }
  }
  // Agentur: alle Agenten warten sichtbar hinter der Theke
  (D.agents || WF.AGENTS).slice(0, 18).forEach(A => { const P = makePerson(k, L, { kind: 'sub', skin: pick(L.skin), agent: A }); const sp = spot('agents'); const a = new Actor(scene, P, sp.x, sp.z, sp.face, L); a.station = 'agents'; const b = badge([{ t: A.id, size: 19, weight: 700 }, { t: `${A.model}${A.edits ? ' · ändert' : ' · nur lesen'}`, size: 15, weight: 500 }], { h: 0.36 }); b.position.y = 1.55; P.root.add(b); subPool.set(A.id, { P, actor: a, busy: false, badge: b, home: sp }); });
  S.subPool = subPool;

  S.setRobotMode = hw => {
    const R = W.st.get('robot'); R.g.remove(R.S.modeSign);
    R.S.modeSign = k.label(hw ? [{ t: 'Robot | Hardware', size: 20 }, { t: 'freigegeben von dir', size: 14, weight: 500 }] : [{ t: 'Robot | Digital Twin', size: 20 }, { t: 'Domain 94 · grasp_e2e.py', size: 14, weight: 500, mono: true }], { h: 0.42, bg: hw ? L.signal.ask : undefined, fg: hw ? '#1E1E1E' : undefined });
    R.S.modeSign.position.set(0, 2.3, -0.8); R.g.add(R.S.modeSign); S.hardware = hw;
  };
  S.resolveEx = (ex, choice, auto = false) => { ex.choice = choice; ex.done = true; S.ex.splice(S.ex.indexOf(ex), 1); ex.chat.push('user', choice); if (auto) evt('info', `Demo-Autopilot: ${choice}`, ex.chat.name); };
  S.newOrder = (tpl, tool) => {
    tpl = tpl || TEMPLATES[S.tpl++ % TEMPLATES.length];
    tool = tool || (rnd() < 0.6 ? 'Claude' : rnd() < 0.5 ? 'Codex' : 'Gemini');
    const o = { ...tpl, tool, id: hex(4), t0: S.t, stepsDone: new Set(), done: false };
    S.orders.unshift(o); S.orders.length = Math.min(S.orders.length, 12);
    new Chat(o); evt('order', `Neuer Auftrag: [${o.prefix}] ${o.title}`, 'Du'); S.log[0].cid = o.chat.id;
    return o;
  };
  // echte Chats aus Claude Ops: {id (sid), src, title, ask} → Namen für die nächsten Figuren
  S.bind = sessions => {
    S.real = sessions.filter(s => s.alive !== false).map(s => { const t = SRC2TOOL[s.src] || 'Claude'; const m = /(dev-ws-\w+|codex-\w+|antigravity-[\w-]+)/.exec(s.chat || s.title || ''); return { sid: s.id, src: s.src, tool: t, title: s.title || '', name: m ? m[1] : (s.chat || (s.title || '').replace(/^[^·]*·\s*/, '').slice(0, 22) || s.id.slice(0, 8)), ask: s.ask || '', used: false }; });
  };
  // Demo-Antwort in Demo-Chats (echte Chats antworten über Claude Ops)
  S.demoReply = (chat, text) => { chat.push('user', text); const ex = S.ex.find(e => e.chat === chat); if (ex && ex.choices.some(c => text.toLowerCase().startsWith(c.toLowerCase()))) { S.resolveEx(ex, ex.choices.find(c => text.toLowerCase().startsWith(c.toLowerCase()))); return 'Antwort übernommen – der Chat arbeitet weiter'; } setTimeout(() => chat.push('ai', `Demo-Chat ${chat.id}: „${text.slice(0, 40)}“ notiert – echte Zustellung nur über Claude Ops (Port 18097)`), 900); return 'Demo: Text im Verlauf, keine echte Zustellung'; };

  // Abstand halten in drei Stufen: 1) vorausschauen – Laufende reihen sich hinter Gleichlaufende ein (bremsen statt drängeln)
  // und weichen Entgegenkommenden/Stehenden rechtzeitig seitlich aus; 2) Überlappung (a.r + b.r) sofort lösen; 3) Stehende halten
  // weich etwas Luft (ROOM), damit keine Trauben entstehen
  S.crowd = [];
  const LOOK = 1.9, ROOM = 0.3;
  function separate(dt) {
    const list = [...S.chats.map(c => c.a), ...S.subs.filter(s => s.clone).map(s => s.a), ...[...subPool.values()].map(p => p.actor), ...S.crowd];
    const walking = a => a.path.length && a.v > 0.2;
    for (const a of list) {
      if (!walking(a)) continue;
      const fx = Math.sin(a.h), fz = Math.cos(a.h); let cap = Infinity, push = 0;
      for (const b of list) {
        if (b === a) continue;
        const rx = b.x - a.x, rz = b.z - a.z, along = rx * fx + rz * fz; if (along <= 0 || along > LOOK) continue;
        const lat = rx * fz - rz * fx, need = a.r + b.r + 0.12; if (Math.abs(lat) >= need) continue;
        if (walking(b) && Math.sin(b.h) * fx + Math.cos(b.h) * fz > 0.5) { cap = Math.min(cap, along < need + 0.3 ? b.v * 0.8 : b.v); continue; }   // gleiche Richtung: einreihen
        const side = Math.abs(lat) < 0.05 ? -1 : -Math.sign(lat);   // weg von b; genau mittig → zur eigenen Spurseite
        push += side * (1 - along / LOOK) * 1.6;
        if (!walking(b)) cap = Math.min(cap, Math.max(0.7, a.v * 0.97));   // an Stehenden etwas langsamer vorbei
      }
      if (cap < a.v) a.v = cap;
      if (push) { const m = Math.max(-1.3, Math.min(1.3, push)) * dt; a.x += fz * m; a.z -= fx * m; }
    }
    const nudge = (a, px, pz) => {
      if (a.path.length) { const fx = Math.sin(a.h), fz = Math.cos(a.h), along = px * fx + pz * fz; let sx = px - along * fx, sz = pz - along * fz;
        if (Math.hypot(sx, sz) < 1e-3) { const m = Math.hypot(px, pz), side = a.lane < 0 ? -1 : 1; sx = fz * m * side; sz = -fx * m * side; }
        px = sx + along * fx * 0.3; pz = sz + along * fz * 0.3; }
      a.x += px; a.z += pz;
    };
    const soft = Math.min(1, dt * 2);
    for (let it = 0; it < 2; it++) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {   // 2 Durchgänge: auch Dreiergruppen lösen sich
      const a = list[i], b = list[j]; let dx = b.x - a.x, dz = b.z - a.z; const d = Math.hypot(dx, dz);
      const gap = a.r + b.r, still = !a.path.length && !b.path.length;
      if (d >= gap + (still ? ROOM : 0)) continue;
      if (d < 1e-3) { const t = a.id * 2.399; dx = Math.sin(t); dz = Math.cos(t); } else { dx /= d; dz /= d; }
      if (d >= gap) { if (it) continue; const k = (gap + ROOM - d) * soft * 0.5; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; continue; }   // nur Luft: weich, einmal je Bild
      const wa = a.path.length ? 1 : 0.25, wb = b.path.length ? 1 : 0.25, k = (gap - d) / (wa + wb);
      nudge(a, -dx * k * wa, -dz * k * wa); nudge(b, dx * k * wb, dz * k * wb);
    }
    list.forEach(a => a.sync());
  }

  S.step = dt => {
    S.t += dt;
    if (S.t >= S.nextOrder) { const busy = S.chats.filter(c => c.alive).length; if (busy < 6) S.newOrder(); S.nextOrder = S.t + (busy < 3 ? 6 : 14) + rnd() * 6; }
    for (const c of S.chats) { if (c.alive) { const r = c.gen.next(dt); if (r.done && c.alive) c.alive = false; } c.a.update(dt); }
    for (let i = S.chats.length - 1; i >= 0; i--) { const c = S.chats[i]; if (!c.alive && !c.a.path.length) { scene.remove(c.P.root); if (c.sp && c.sp.release) c.sp.release(); S.chats.splice(i, 1); drawChats(); } }
    for (const s of S.subs) { if (!s.done) s.gen.next(dt); if (s.clone) s.a.update(dt); }
    S.subs = S.subs.filter(s => !s.done);
    subPool.forEach(p => p.actor.update(dt));
    separate(dt);
    const R = W.st.get('robot').S; if (R.busy > 0) { R.busy -= dt; const t = S.t * (S.hardware ? 1.2 : 2.2); R.arm.j1.rotation.y = Math.sin(t) * 0.9; R.arm.j2.rotation.z = -0.4 + Math.sin(t * 1.3) * 0.35; R.arm.j3.rotation.z = 0.8 + Math.sin(t * 0.9) * 0.4; }
    const Y = W.st.get('sync').S; const ph = (S.t / 22) % 1; Y.shuttle.position.x = -Y.shuttleX + (ph < 0.4 ? (ph / 0.4) * 2 * Y.shuttleX : 0);
    if (ph < 0.01 && !Y.logged) { Y.logged = true; evt('sync', 'tools/ws_sync.sh: Laptop · Labor · Home-PC holen denselben Stand', 'Bahnhof'); } if (ph > 0.5) Y.logged = false;
    const H = W.st.get('roles').S; if (H.holo) H.holo.rotation.y += dt * 0.3;
    updateFlashes(dt);
  };
  S.ambient = dt => { S.chats.forEach(c => { if (c.bubble) c.bubble.position.y = (c.topY || 2.46) + Math.sin(S.t * 3) * 0.04; }); };   // topY: über Logo + Schild (main3.js)
  drawClaims(); drawChats();
  return S;
}
