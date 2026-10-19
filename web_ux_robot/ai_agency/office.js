// Kompaktes Großraumbüro (Bereich Raum A–C): Stationen = Setup-Komponenten, Wege-Graph, Boden, Wände.
// Raum:A Fließband-Loft (Reihe, Bodenstreifen) · Raum:B Rundes Atrium (Ring) · Raum:C Werkbank-Loft (Schleife, Empfehlung).
import * as THREE from 'three';
import { PHASES, ROLES, FACH, LEVELS } from './data/wf.js';
import { tone, shade, hsl, HAT, TOOL } from './cast.js';

const PI = Math.PI;
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const faceTo = (x, z) => Math.atan2(-x, -z);

// Stationen: Objekt im Büro ↔ Setup-Komponente (KONZEPT.md §3)
export const STATIONS = {
  tresen: { name: 'Du · Auftrag', sub: 'Tresen am Eingang', cat: 'Menschen', phase: 'auftrag' },
  doors: { name: 'Chats', sub: 'Claude · Codex · Gemini', cat: 'Werkzeuge', phase: 'auftrag' },
  roles: { name: 'Rollen', sub: 'Hutständer · Leitstand', cat: 'Rollen', phase: 'plan' },
  bench: { name: 'Werkbank', sub: '8 Fachrollen', cat: 'Rollen', phase: 'bau' },
  agents: { name: 'Agentur', sub: '16 Subagenten', cat: 'Agenten', phase: 'pruef' },
  skills: { name: 'Skills', sub: 'Bücherregal · 51', cat: 'Skills', phase: 'plan' },
  memory: { name: 'Memory', sub: 'Aktenschrank', cat: 'Memory', phase: 'plan' },
  repos: { name: 'Repos', sub: 'Tresor · GitHub', cat: 'Repos', phase: 'liefer' },
  mcp: { name: 'MCP', sub: 'Patchfeld', cat: 'MCP', phase: 'bau' },
  hooks: { name: 'Hooks', sub: 'Schaltschrank · 9 Lampen', cat: 'Hooks', phase: 'bau' },
  claims: { name: 'Claims', sub: '🔒 In Arbeit', cat: 'Orchestrierung', phase: 'bau' },
  previews: { name: 'Vorschau-Archiv', sub: 'Galeriewand · Port 8085', cat: 'Orchestrierung', phase: 'plan' },
  settings: { name: 'Settings', sub: 'Sicherungskasten', cat: 'Settings', phase: 'auftrag' },
  sync: { name: 'Sync', sub: '3 Rechner', cat: 'Sync', phase: 'liefer' },
  qa: { name: 'Prüfstand', sub: 'Stufe 0–3', cat: 'Prüfung', phase: 'pruef' },
  robot: { name: 'Roboter-Ecke', sub: 'Sicherheitszone', cat: 'Sicherheit', phase: 'pruef' },
  post: { name: 'Poststelle', sub: 'Commit-Tor', cat: 'Repos', phase: 'liefer' },
  docs: { name: 'Doku-Pult', sub: 'en · de', cat: 'Prüfung', phase: 'pruef' },
};

export const ICON = { tresen: '🛎️', doors: '🚪', roles: '🎩', bench: '🛠️', agents: '🤖', skills: '📚', memory: '🗄️', repos: '🔐', mcp: '🔌', hooks: '🎛️', claims: '📌', previews: '🖼️', settings: '⚙️', sync: '🚉', qa: '🧪', robot: '🦾', post: '📮', docs: '📝' };

// ───────────────────────── Grundrisse ─────────────────────────
// Station: [id, x, z, w, d, rot] – lokal: offene Seite = +z, Rückwand = -z; rot dreht +z nach (sin rot, cos rot)
const ring = (ids, r, w, d, a0, step) => ids.map((id, i) => { const th = (a0 + step * i) * PI / 180; return [id, r * Math.cos(th), r * Math.sin(th), w, d, Math.atan2(-Math.cos(th), -Math.sin(th))]; });
const circle = (r, n = 64) => Array.from({ length: n + 1 }, (_, i) => [r * Math.cos(2 * PI * i / n), r * Math.sin(2 * PI * i / n)]);
const spokes = (r0, r1, n) => Array.from({ length: n }, (_, i) => { const a = 2 * PI * i / n; return [[r0 * Math.cos(a), r0 * Math.sin(a)], [r1 * Math.cos(a), r1 * Math.sin(a)]]; });

export const LAYOUTS = {
  A: {
    name: 'Fließband-Loft', bounds: [-17.5, -9, 17.5, 8], room: [-17, -8.5, 17, 7.5], loud: true,
    walks: [[[-16.2, 3.2], [16.2, 3.2]], [[-16.2, -5.4], [16.2, -5.4]], ...[-16.2, -11.55, -5.75, 4.2, 10, 16.2].map(x => [[x, -5.4], [x, 3.2]])],
    stations: [
      ['tresen', -14.2, -1.5, 5, 6, 0], ['roles', -10, -1.5, 2.6, 6, 0], ['previews', -7.2, -1.5, 2.6, 6, 0], ['bench', -0.8, -1.5, 9.8, 6, 0], ['qa', 5.9, -1.5, 3, 6, 0], ['docs', 8.5, -1.5, 2.2, 6, 0], ['post', 11.6, -1.5, 2.8, 6, 0], ['repos', 14.4, -1.5, 2.8, 6, 0],
      ['skills', -14.5, -7, 4, 2.6, 0], ['memory', -10.5, -7, 3.4, 2.6, 0], ['claims', -7, -7, 3.2, 2.6, 0], ['agents', -3.4, -7, 3.6, 2.6, 0], ['mcp', 0.3, -7, 3, 2.6, 0], ['hooks', 3.6, -7, 3.2, 2.6, 0], ['settings', 6.6, -7, 2.4, 2.6, 0], ['sync', 9.8, -7, 3.4, 2.6, 0], ['robot', 14, -7, 4.2, 3, 0],
      ['doors', -15.8, 5.3, 3.6, 2.4, PI / 2],
    ],
    columns: [['auftrag', -16.7, -11.5], ['plan', -11.5, -5.7], ['bau', -5.7, 4.2], ['pruef', 4.2, 10], ['liefer', 10, 15.8]],
    start: [-12.5, 4.8, 0], main: [[-16.2, 3.2], [16.2, 3.2]],
  },
  B: {
    name: 'Rundes Atrium', bounds: [-17, -17, 17, 17], room: null, radius: 15.6,
    walks: [circle(4.2, 48), circle(8.6, 72), ...spokes(4.2, 8.6, 8)],
    stations: [
      ['tresen', 0, 2.3, 5, 3, PI], ['roles', 0, -2.3, 4, 3, 0], ['bench', 0, 0, 13.6, 13.6, 0],
      ...ring(['doors', 'skills', 'memory', 'previews', 'claims', 'agents', 'mcp', 'hooks', 'settings', 'qa', 'docs', 'robot', 'post', 'repos', 'sync'], 12.2, 4.6, 3.2, 90, 24),
    ],
    start: [0, 6.5, PI], main: circle(8.6, 72),
  },
  C: {
    name: 'Werkbank-Loft', bounds: [-16, -10, 16, 10], room: [-15, -9, 15, 9],
    walks: [[[-10.5, -4.3], [10.6, -4.3]], [[-10.5, 4.3], [10.6, 4.3]], [[-9, -4.3], [-9, 4.3]], [[9.8, -4.3], [9.8, 4.3]]],
    stations: [
      ['bench', 0.5, 0, 15, 5.2, 0],
      ['skills', -11.9, -7, 5, 3, 0], ['memory', -7, -7, 3.6, 3, 0], ['previews', -2.4, -7, 5, 3, 0], ['mcp', 2.2, -7, 3, 3, 0], ['hooks', 5.6, -7, 3.2, 3, 0], ['settings', 8.6, -7, 2.2, 3, 0], ['robot', 12.4, -6.8, 4.5, 4, 0],
      ['doors', -13, -2.8, 4.5, 3, PI / 2], ['roles', -13, 1.8, 3.5, 3, PI / 2],
      ['tresen', -11.5, 6.8, 4.5, 3.5, PI], ['agents', -7, 6.8, 4, 3.5, PI], ['claims', -3, 6.8, 3.5, 3.5, PI], ['docs', 0.5, 6.8, 3, 3.5, PI], ['qa', 5.5, 6.8, 6, 3.5, PI],
      ['post', 13, -2.5, 4, 3, -PI / 2], ['repos', 13, 1.5, 4, 3, -PI / 2], ['sync', 13, 5.5, 4, 3, -PI / 2],
    ],
    start: [-9.5, 4.3, PI / 2], main: [[-9, -4.3], [9.8, -4.3], [9.8, 4.3], [-9, 4.3], [-9, -4.3]],
  },
};

// ───────────────────────── Wege (Graph) ─────────────────────────
export class Nav {
  constructor() { this.n = []; this.adj = []; }
  node(x, z) { for (let i = 0; i < this.n.length; i++) if (Math.hypot(this.n[i].x - x, this.n[i].z - z) < 0.25) return i; this.n.push({ x, z }); this.adj.push(new Set()); return this.n.length - 1; }
  link(a, b) { if (a !== b) { this.adj[a].add(b); this.adj[b].add(a); } }
  edges() { const out = []; this.adj.forEach((s, a) => s.forEach(b => { if (a < b) out.push([a, b]); })); return out; }
  split(a, b, x, z) { const c = this.node(x, z); if (c === a || c === b) return c; this.adj[a].delete(b); this.adj[b].delete(a); this.link(a, c); this.link(c, b); return c; }
  build(polys) {
    polys.forEach(p => { let prev = this.node(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) { const c = this.node(p[i][0], p[i][1]); this.link(prev, c); prev = c; } });
    for (let guard = 0; guard < 400; guard++) {
      const E = this.edges(); let hit = null;
      outer: for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
        const [a, b] = E[i], [c, d] = E[j]; if (a === c || a === d || b === c || b === d) continue;
        const P = this.n[a], Q = this.n[b], R = this.n[c], S = this.n[d];
        const den = (Q.x - P.x) * (S.z - R.z) - (Q.z - P.z) * (S.x - R.x); if (Math.abs(den) < 1e-9) continue;
        const t = ((R.x - P.x) * (S.z - R.z) - (R.z - P.z) * (S.x - R.x)) / den, u = ((R.x - P.x) * (Q.z - P.z) - (R.z - P.z) * (Q.x - P.x)) / den;
        if (t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999) { hit = [a, b, c, d, P.x + t * (Q.x - P.x), P.z + t * (Q.z - P.z)]; break outer; }
      }
      if (!hit) break;
      const [a, b, c, d, x, z] = hit; const m = this.split(a, b, x, z); const m2 = this.split(c, d, x, z); this.link(m, m2);
    }
    this.n.forEach((p, i) => { if (this.adj[i].size === 1) { const k = this.nearestOnEdge(p.x, p.z, i); if (k && k.d < 0.6) { const m = this.split(k.a, k.b, k.x, k.z); this.link(i, m); } } });
  }
  nearestOnEdge(x, z, skip = -1) {
    let best = null;
    for (const [a, b] of this.edges()) {
      if (a === skip || b === skip) continue;
      const P = this.n[a], Q = this.n[b], vx = Q.x - P.x, vz = Q.z - P.z, L = vx * vx + vz * vz;
      const t = Math.max(0, Math.min(1, ((x - P.x) * vx + (z - P.z) * vz) / L)), px = P.x + t * vx, pz = P.z + t * vz, d = Math.hypot(x - px, z - pz);
      if (!best || d < best.d) best = { a, b, x: px, z: pz, d };
    }
    return best;
  }
  attach(x, z) { const k = this.nearestOnEdge(x, z); return this.split(k.a, k.b, k.x, k.z); }
  nearest(x, z) { let b = 0, bd = 1e9; this.n.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; b = i; } }); return b; }
  path(from, to) {
    const N = this.n.length, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    dist[from] = 0;
    for (;;) {
      let u = -1, best = Infinity; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0 || u === to) break; done[u] = 1;
      for (const v of this.adj[u]) { const w = best + Math.hypot(this.n[u].x - this.n[v].x, this.n[u].z - this.n[v].z); if (w < dist[v]) { dist[v] = w; prev[v] = u; } }
    }
    const out = []; for (let v = to; v >= 0; v = prev[v]) { out.unshift(this.n[v]); if (v === from) break; }
    return out;
  }
}

// ───────────────────────── Bildschirme, Tafeln ─────────────────────────
function screenDraw(L, kind) {
  return (x, W, H) => {
    x.fillStyle = L.screen; x.fillRect(0, 0, W, H); x.globalAlpha = 0.9;
    if (kind === 'chart') { x.strokeStyle = L.ink; x.lineWidth = 6; x.beginPath(); [0.8, 0.55, 0.62, 0.35, 0.42, 0.2].forEach((v, i) => { const px = 20 + i * (W - 40) / 5, py = v * H; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); return; }
    if (kind === 'design') { const cols = L.roles ? Object.values(L.roles).slice(1, 5) : [L.ink, L.inkSoft, L.paper2, L.ink]; cols.forEach((c, i) => { x.fillStyle = c; x.fillRect(16 + i * (W - 32) / 4, 18, (W - 32) / 4 - 8, H * 0.45); }); x.fillStyle = L.ink; x.fillRect(16, H * 0.7, W * 0.6, 10); x.fillRect(16, H * 0.82, W * 0.4, 10); return; }
    for (let i = 0; i < 7; i++) { x.fillStyle = i % 3 === 1 ? L.inkSoft : L.ink; const ind = (i % 3) * 18; x.fillRect(16 + ind, 14 + i * (H - 24) / 7, (W - 60) * (0.35 + ((i * 37) % 50) / 100), 8); }
  };
}
export function drawBoard(x, W, H, L, claims, live = false) {
  x.fillStyle = L.dark ? '#121A36' : L.wall; x.fillRect(0, 0, W, H);
  x.fillStyle = L.ink; x.font = `700 ${H * 0.1}px ${L.font}`; x.textAlign = 'left'; x.fillText('TODOS.md · 🔒 In Arbeit', W * 0.04, H * 0.14);
  // Herkunft immer sichtbar: live aus Claude Ops oder erfundene Demo-Claims
  x.font = `700 ${H * 0.066}px ${L.mono}`; const tag = live ? 'live · Claude Ops' : 'Demo-Daten', tw = x.measureText(tag).width + W * 0.04;
  x.strokeStyle = L.ink; x.lineWidth = 2; x.strokeRect(W * 0.96 - tw, H * 0.165, tw, H * 0.1); x.fillText(tag, W * 0.96 - tw + W * 0.02, H * 0.165 + H * 0.075);
  x.font = `500 ${H * 0.068}px ${L.mono}`;
  claims.slice(0, 6).forEach((c, i) => { x.fillStyle = c.conflict ? L.signal.ask : L.ink; x.fillText((c.text || `${c.who} · ${c.task}`).slice(0, 44), W * 0.04, H * (0.38 + i * 0.105)); });
  if (!claims.length) { x.globalAlpha = 0.7; x.fillText(live ? '– keine Claims –' : '– noch keine Demo-Claims –', W * 0.04, H * 0.4); x.globalAlpha = 1; }
}
// Chat-Tafel an den Türen: ein Terminal je Werkzeug mit den laufenden Chats (Bereich Chat:B, in allen Räumen sichtbar)
export function drawChatBoard(x, W, H, L, chats) {
  x.fillStyle = L.dark ? '#0E1424' : L.wall; x.fillRect(0, 0, W, H);
  const tools = ['Claude', 'Codex', 'Gemini'], cw = W / 3;
  tools.forEach((t, i) => {
    const T = TOOL[t], x0 = i * cw + 8;
    x.fillStyle = T.main; x.fillRect(x0, 8, cw - 16, H * 0.17); x.fillStyle = t === 'Claude' ? '#1E1E1E' : '#FFFFFF'; x.font = `700 ${H * 0.115}px ${L.font}`; x.textAlign = 'left'; x.fillText(`${T.emblem} ${t}`, x0 + 10, H * 0.19);
    x.fillStyle = L.dark ? '#E9F1FF' : L.ink; x.font = `600 ${H * 0.085}px ${L.mono}`;
    const mine = chats.filter(c => c.tool === t).slice(0, 5);
    mine.forEach((c, j) => { const yy = H * (0.36 + j * 0.12); if (c.ask) { x.fillStyle = L.signal.ask; x.fillRect(x0 + 2, yy - H * 0.075, cw - 20, H * 0.1); x.fillStyle = '#1E1E1E'; } else x.fillStyle = L.dark ? '#E9F1FF' : L.ink; x.fillText((c.ask ? '❓ ' : '● ') + c.id, x0 + 6, yy, cw - 28); });
    if (!mine.length) { x.globalAlpha = 0.7; x.fillText('– kein Chat –', x0 + 6, H * 0.36); x.globalAlpha = 1; }
  });
}

// ───────────────────────── Requisiten ─────────────────────────
function standDesk(k, L, g, x, z, ry = 0, kind = 'code', top = true) {
  const d = new THREE.Group(); d.position.set(x, 0, z); d.rotation.y = ry; g.add(d);
  if (top) { k.add(d, 'box', L.prop, 0, 0.62, 0, 1.25, 0.05, 0.62); k.add(d, 'box', L.prop2, -0.55, 0.31, 0, 0.06, 0.62, 0.5); k.add(d, 'box', L.prop2, 0.55, 0.31, 0, 0.06, 0.62, 0.5); }
  k.add(d, 'box', L.prop2, 0, 0.83, -0.22, 0.62, 0.38, 0.04);
  k.panel(d, 0.56, 0.32, screenDraw(L, kind), 0, 0.83, -0.197, 0, 192);
  k.add(d, 'box', L.prop2, 0, 0.66, 0.1, 0.4, 0.02, 0.14);
  // Hook-Lampe: leuchtet bei jedem Werkzeug-Aufruf (Pre → Werkzeug → Post)
  const lamp = k.add(d, 'tor', L.inkSoft, 0, 1.12, -0.22, 0.22, 0.22, 0.22, 0, { noShadow: true });
  lamp.rotation.x = PI / 2; lamp.material = lamp.material.clone(); lamp.userData.base = lamp.material.color.clone(); lamp.userData.hideAfter = true; lamp.visible = false;
  d.userData.lamp = lamp; return d;
}
function plant(k, L, g, x, z, s = 1) { k.add(g, 'cyl', L.prop2, x, 0.18 * s, z, 0.32 * s, 0.36 * s, 0.32 * s); const leaf = L.leaf || (L.roles ? '#9ED9A4' : L.paper2); for (let i = 0; i < 5; i++) { const a = i / 5 * 2 * PI; const l = k.add(g, 'sph', shade(leaf, (i % 2) * 0.06), x + Math.sin(a) * 0.18 * s, (0.55 + (i % 2) * 0.12) * s, z + Math.cos(a) * 0.18 * s, 0.4 * s, 0.07 * s, 0.28 * s); l.rotation.set(Math.cos(a) * 0.5, a, -Math.sin(a) * 0.5); } }
function shelf(k, L, g, x, z, w, n, colors, ry = 0) {
  const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s);
  k.add(s, 'box', L.prop2, 0, 0.9, 0, w, 1.8, 0.36);
  for (let r = 0; r < 4; r++) k.add(s, 'box', L.prop, 0, 0.18 + r * 0.42, 0.04, w - 0.08, 0.04, 0.34);
  const per = Math.ceil(n / 4), bw = (w - 0.3) / per;
  const inst = new THREE.InstancedMesh(k.GEO.box, k.m('#ffffff'), n), M = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < n; i++) { const r = Math.floor(i / per), c = i % per, hh = 0.26 + ((i * 53) % 9) / 100; M.compose(new THREE.Vector3(-w / 2 + 0.18 + c * bw + bw / 2, 0.2 + r * 0.42 + hh / 2, 0.08), new THREE.Quaternion(), new THREE.Vector3(bw * 0.82, hh, 0.24)); inst.setMatrixAt(i, M); inst.setColorAt(i, col.set(colors[i % colors.length])); }
  inst.castShadow = true; s.add(inst); return s;
}
function arch(k, L, g, x, z, w, color, ry = 0) {
  const a = new THREE.Group(); a.position.set(x, 0, z); a.rotation.y = ry; g.add(a);
  k.add(a, 'box', L.prop2, -w / 2, 0.95, 0, 0.16, 1.9, 0.3); k.add(a, 'box', L.prop2, w / 2, 0.95, 0, 0.16, 1.9, 0.3); k.add(a, 'box', L.prop2, 0, 1.95, 0, w + 0.16, 0.18, 0.3);
  const bar = k.add(a, 'box', color, 0, 1.83, 0.16, w - 0.1, 0.06, 0.02, 0, { emissive: color, noShadow: true });
  bar.material = bar.material.clone(); bar.userData.base = new THREE.Color(color); a.userData.bar = bar; return a;
}
function robotArm(k, L, g, x, z) {
  const base = new THREE.Group(); base.position.set(x, 0.62, z); g.add(base);
  const c1 = L.dark ? '#E9F1FF' : L.prop, c2 = L.dark ? '#3A506B' : L.prop2;
  k.add(base, 'cyl', c2, 0, 0.06, 0, 0.36, 0.12, 0.36);
  const j1 = new THREE.Group(); j1.position.y = 0.12; base.add(j1); k.add(j1, 'cyl', c1, 0, 0.14, 0, 0.24, 0.28, 0.24);
  const j2 = new THREE.Group(); j2.position.y = 0.3; j1.add(j2); k.add(j2, 'sph', c1, 0, 0, 0, 0.2, 0.2, 0.2); k.add(j2, 'box', c1, 0, 0.32, 0, 0.12, 0.62, 0.12);
  const j3 = new THREE.Group(); j3.position.y = 0.62; j2.add(j3); k.add(j3, 'sph', c1, 0, 0, 0, 0.17, 0.17, 0.17); k.add(j3, 'box', c1, 0, 0.26, 0, 0.1, 0.5, 0.1);
  const tool = new THREE.Group(); tool.position.y = 0.52; j3.add(tool); k.add(tool, 'cyl', c2, 0, 0.04, 0, 0.12, 0.1, 0.12); k.add(tool, 'box', c2, -0.05, 0.12, 0, 0.03, 0.12, 0.06); k.add(tool, 'box', c2, 0.05, 0.12, 0, 0.03, 0.12, 0.06);
  return { base, j1, j2, j3 };
}
function pendant(k, L, g, x, z, col) {
  k.add(g, 'cyl', L.dark ? '#2A2A31' : '#3A3A40', x, 3.15, z, 0.015, 0.7, 0.015, 0, { noShadow: true });
  const sh = k.add(g, new THREE.ConeGeometry(0.34, 0.3, 24, 1, true), col, x, 2.72, z, 1, 1, 1, 0, { noShadow: true }); sh.material = sh.material.clone(); sh.material.side = THREE.DoubleSide;
  k.add(g, 'sph', '#FFF1C9', x, 2.6, z, 0.14, 0.14, 0.14, 0, { basic: true, noShadow: true });
  if (L.dark) k.glow(g, x, 0.03, z, 3.6, '#FFD9A0', 0.28);
}
// v3: wohnliche, sinnvolle Einrichtung – Pendelleuchte in Phasenfarbe über jedem Bereich, Pflanze an der offenen Ecke
function dress(k, L, g, id, w, d) {
  if (id === 'bench') { [-0.3, 0, 0.3].forEach(f => pendant(k, L, g, f * w, 0, L.prop2)); return; }
  if (!['robot', 'qa', 'doors', 'roles', 'sync'].includes(id)) plant(k, L, g, w / 2 - 0.35, d / 2 - 0.4, 0.7);
  pendant(k, L, g, 0, 0.1, L.prop2);
}
const lbl = (k, g, lines, x, y, z, h = 0.34) => { const s = k.label(lines, { h }); s.position.set(x, y, z); g.add(s); return s; };

// ───────────────────────── Stationen ─────────────────────────
// je Station: baut Requisiten im lokalen Rahmen (offene Seite +z), füllt S (Arbeitsplätze, bewegliche Teile)
const BUILD = {
  tresen(k, L, g, w, d, S) {
    k.add(g, 'box', L.prop2, 0, 0.5, d / 2 - 0.9, w - 1.2, 1.0, 0.5); k.add(g, 'box', L.prop, 0, 1.02, d / 2 - 0.9, w - 1.0, 0.06, 0.62);
    S.tresen = [0, d / 2 + 0.35, PI]; S.tresenIn = [0, d / 2 - 1.7, 0];
    S.queue = [[0, d / 2 + 0.35, PI], [0, d / 2 + 1.15, PI], [-0.45, d / 2 + 1.95, PI]];   // Chats stellen sich an statt übereinander zu stehen
    k.add(g, 'box', L.prop2, w / 2 - 0.6, 0.3, -d / 2 + 0.5, 0.7, 0.6, 0.5); S.inbox = k.add(g, 'box', L.prop, w / 2 - 0.6, 0.64, -d / 2 + 0.5, 0.5, 0.06, 0.4);
    const desk = standDesk(k, L, g, -w / 4, -d / 2 + 0.8, 0, 'chart'); S.desk = desk; S.work.push([-w / 4, -d / 2 + 1.5, PI]);
    plant(k, L, g, -w / 2 + 0.5, d / 2 - 0.5, 0.9);
    k.panel(g, 0.9, 0.5, (x, W, H) => { x.fillStyle = L.wall; x.fillRect(0, 0, W, H); x.fillStyle = L.ink; x.font = `700 ${H * 0.22}px ${L.font}`; x.textAlign = 'center'; x.fillText('Antwortformat', W / 2, H * 0.32); x.font = `500 ${H * 0.16}px ${L.mono}`; x.fillText('Ergebnis · ⚠️ · Details · Schluss', W / 2, H * 0.68); }, 0, 1.6, -d / 2 + 0.1, 0, 256);
  },
  doors(k, L, g, w, d, S, D) {
    const xs = [-w / 3, 0, w / 3], names = ['Claude', 'Codex', 'Gemini'];
    xs.forEach((x, i) => {
      const T = TOOL[names[i]];
      k.add(g, 'box', L.prop2, x - 0.65, 1.1, -d / 2 + 0.15, 0.14, 2.2, 0.3); k.add(g, 'box', L.prop2, x + 0.65, 1.1, -d / 2 + 0.15, 0.14, 2.2, 0.3); k.add(g, 'box', L.prop2, x, 2.25, -d / 2 + 0.15, 1.44, 0.14, 0.3);
      k.add(g, 'box', T.main, x, 1.08, -d / 2 + 0.05, 1.16, 2.12, 0.05); k.add(g, 'box', T.light, x, 1.7, -d / 2 + 0.09, 0.5, 0.5, 0.02, 0, { noShadow: true });
      lbl(k, g, [{ t: `${T.emblem} ${names[i]}`, size: 22 }, { t: i ? 'Bridge' : 'nativ', size: 16, weight: 500, mono: true }], x, 2.7, -d / 2 + 0.3, 0.42);
      S.door = S.door || []; S.door.push([x, -d / 2 + 0.7, 0]);
    });
    S.gate = arch(k, L, g, 0, 0.5, w - 1.0, L.signal.info); S.work.push([0, 1.3, 0]);
    // Chat-Tafel neben den Türen (Chat:B): ein Terminal je Werkzeug
    [-1.55, 1.55].forEach(x => k.add(g, 'cyl', L.prop2, x, 3.0, -d / 2 + 0.3, 0.06, 2.0, 0.06)); k.add(g, 'box', L.prop2, 0, 3.75, -d / 2 + 0.28, 3.55, 1.65, 0.05);
    S.board = k.panel(g, 3.4, 1.5, (x, W, H) => drawChatBoard(x, W, H, L, []), 0, 3.75, -d / 2 + 0.34, 0, 680); S.board.userData.board = 'chat';
  },
  roles(k, L, g, w, d, S) {
    k.add(g, 'cyl', L.prop2, 0, 0.9, 0, 0.1, 1.8, 0.1); k.add(g, 'cyl', L.prop2, 0, 0.04, 0, 0.9, 0.08, 0.9);
    const order = ['organizer', 'designer', 'dev', 'editor', 'pm', 'scrum', 'research', 'mkt', 'd3', 'tester', 'sync'];
    order.forEach((r, i) => { const a = i / order.length * 2 * PI, rr = 0.55, y = i % 2 ? 1.25 : 1.6; k.add(g, 'cyl', L.prop2, Math.sin(a) * rr / 2, y - 0.06, Math.cos(a) * rr / 2, 0.025, 0.04, rr).rotation.y = a; const hg = new THREE.Group(); hg.position.set(Math.sin(a) * rr, y, Math.cos(a) * rr); hg.rotation.y = a; g.add(hg); HAT[r](k, tone(L, r), hg); });
    lbl(k, g, [{ t: 'Rollen', size: 24 }, { t: 'Organizer → Fachrolle → Prüfer → Synchronizer', size: 14, weight: 500 }], 0, 2.45, 0, 0.46);
    k.add(g, 'cyl', L.prop2, -w / 2 + 0.6, 0.3, -d / 2 + 0.6, 1.1, 0.6, 1.1); S.holo = k.add(g, 'cyl', L.ink, -w / 2 + 0.6, 0.64, -d / 2 + 0.6, 1.0, 0.03, 1.0, 0, { emissive: L.ink, noShadow: true, opacity: 0.35 });
    S.work.push([-0.9, 0.9, faceTo(-0.9, 0.9)], [0.9, 0.9, faceTo(0.9, 0.9)], [0, -1.0, faceTo(0, -1.0)]);
  },
  bench(k, L, g, w, d, S, D, raum) {
    S.seats = []; S.deskOf = [];
    const kinds = { designer: 'design', dev: 'code', editor: 'code', pm: 'chart', scrum: 'chart', research: 'chart', mkt: 'design', d3: 'design' };
    const seat = (i, x, z, ry, top = true) => { const dsk = standDesk(k, L, g, x, z, ry, kinds[FACH[i]], top); const sx = x - Math.sin(ry) * 0.75, sz = z - Math.cos(ry) * 0.75; S.seats[i] = [sx, sz, ry + PI]; S.deskOf[i] = dsk; const R = ROLES[FACH[i]]; lbl(k, g, [{ t: `${R.icon} ${R.name}`, size: 17 }], x, 1.5, z, 0.3); };
    if (raum === 'A') { FACH.forEach((r, i) => { const row = i < 4 ? 0 : 1, x = -w / 2 + 1.5 + (i % 4) * ((w - 3) / 3), z = row ? 1.1 : -d / 2 + 0.9; seat(i, x, z, row ? PI : 0); }); }
    else if (raum === 'B') { FACH.forEach((r, i) => { const a = i / 8 * 2 * PI + PI / 8, rr = 6.2; seat(i, Math.sin(a) * rr, Math.cos(a) * rr, a); }); }
    else { // Werkbank: eine lange Tischplatte, 4 Plätze je Seite
      k.add(g, 'box', L.prop, 0, 0.72, 0, w - 1.2, 0.08, 1.7); [-1, 1].forEach(s => [-0.4, 0, 0.4].forEach(f => k.add(g, 'box', L.prop2, f * (w - 1.2), 0.36, s * 0.65, 0.1, 0.72, 0.1)));
      FACH.forEach((r, i) => { const side = i < 4 ? -1 : 1, x = -w / 2 + 2.3 + (i % 4) * ((w - 4.6) / 3), z = side * 0.5; seat(i, x, z, side < 0 ? 0 : PI, false); });
      for (let i = 0; i < 3; i++) plant(k, L, g, -w / 2 + 2.1 + i * ((w - 4.2) / 2), 0, 0.5);
    }
  },
  agents(k, L, g, w, d, S, D) {
    const ch = L.rich ? 0.34 : 0.9;   // v3: niedrige Theke, Gesichter der Helfer (Würfel 0,78) bleiben dahinter ganz sichtbar
    k.add(g, 'box', L.prop2, 0, ch / 2, d / 2 - 1.2, w - 0.4, ch, 0.45); k.add(g, 'box', L.prop, 0, ch + 0.03, d / 2 - 1.2, w - 0.2, 0.06, 0.6);
    const n = (D.agents || []).length || 16; lbl(k, g, [{ t: `${n} Agenten`, size: 22 }, { t: 'Opus: Urteil · Sonnet: leichte Prüfarbeit', size: 14, weight: 500 }], 0, 2.3, -d / 2 + 0.3, 0.46);
    // 16–18 Plätze in 3 versetzten Reihen à 6 (Helfer-Würfel ≈ 0,6 m breit): bei 8 je Reihe standen sie ineinander
    const z0 = d / 2 - 1.9, dz = Math.min(0.65, Math.max(0.4, (z0 + d / 2 - 0.3) / 2)), dx = (w - 0.9) / 5;
    for (let i = 0; i < Math.min(18, Math.max(16, n)); i++) { const row = Math.floor(i / 6), c = i % 6; S.work.push([-w / 2 + 0.45 + c * dx + (row % 2 ? dx / 2 : 0), z0 - row * dz, 0]); }
    S.front = [0, d / 2 - 0.4, PI];
  },
  skills(k, L, g, w, d, S, D) {
    const gl = (D.skills || []).filter(s => s.scope === 'global').length || 32, dw = (D.skills || []).length - gl || 19;
    const cg = L.roles ? Object.values(L.roles) : [L.ink, L.inkSoft, L.paper2, L.prop2, '#ffffff'], cd = L.roles ? Object.values(L.roles).slice(3) : [L.inkSoft, L.ink];
    shelf(k, L, g, -w / 4, -d / 2 + 0.3, w / 2 - 0.5, gl, cg); shelf(k, L, g, w / 4, -d / 2 + 0.3, w / 2 - 0.5, dw, cd);
    lbl(k, g, [{ t: `${gl} allgemein`, size: 20 }], -w / 4, 2.05, -d / 2 + 0.5, 0.3); lbl(k, g, [{ t: `${dw} dev_ws`, size: 20 }], w / 4, 2.05, -d / 2 + 0.5, 0.3);
    k.add(g, 'box', L.prop, 0, 0.45, 0.5, 1.4, 0.06, 0.8); k.add(g, 'box', L.prop2, 0, 0.21, 0.5, 1.1, 0.42, 0.5);
    S.work.push([-w / 4, -d / 2 + 1.1, PI], [w / 4, -d / 2 + 1.1, PI]);
  },
  memory(k, L, g, w, d, S, D) {
    const gl = (D.memory || []).filter(m => m.scope === 'global').length || 10, pr = (D.memory || []).length - gl || 9;
    [[-w / 4, gl, 'gemeinsam'], [w / 4, pr, 'dev_ws']].forEach(([x, n, t]) => {
      const rows = Math.min(6, n); k.add(g, 'box', L.prop2, x, 0.8, -d / 2 + 0.45, w / 2 - 0.5, 1.6, 0.7);
      for (let j = 0; j < rows; j++) k.add(g, 'box', L.prop, x, 0.2 + j * (1.3 / rows), -d / 2 + 0.82, w / 2 - 0.65, 1.1 / rows, 0.04);
      lbl(k, g, [{ t: `${n} ${t}`, size: 18 }, { t: 'MEMORY.md', size: 14, weight: 500, mono: true }], x, 2.05, -d / 2 + 0.6, 0.4);
    });
    S.work.push([-w / 4, -d / 2 + 1.4, PI], [w / 4, -d / 2 + 1.4, PI]);
  },
  repos(k, L, g, w, d, S, D) {
    const n = (D.repos || []).length || 10, metal = L.dark ? '#4E555F' : '#8F969F';
    k.add(g, 'box', metal, 0, 1.0, -d / 2 + 0.7, Math.min(w - 1.2, 2.2), 2.0, 1.1); k.add(g, 'box', shade(metal, 0.1), 0, 1.0, -d / 2 + 1.27, Math.min(w - 1.5, 1.8), 1.7, 0.05);
    k.add(g, 'tor', L.ink, 0.35, 1.05, -d / 2 + 1.32, 0.3, 0.3, 0.3, 0, { noShadow: true }); k.add(g, 'cyl', L.ink, 0.35, 1.05, -d / 2 + 1.32, 0.08, 0.1, 0.08, 0, { noShadow: true }).rotation.x = PI / 2; k.add(g, 'box', L.ink, -0.45, 1.05, -d / 2 + 1.33, 0.08, 0.5, 0.04, 0, { noShadow: true });
    lbl(k, g, [{ t: `${n} Repos`, size: 22 }, { t: 'GitHub · origin', size: 15, weight: 500, mono: true }], 0, 2.45, -d / 2 + 0.7, 0.44);
    S.uplink = k.add(g, 'cyl', L.ink, w / 2 - 0.4, 1.9, -d / 2 + 0.5, 0.07, 3.8, 0.07, 0, { emissive: L.ink }); k.add(g, 'sph', L.signal.info, w / 2 - 0.4, 3.85, -d / 2 + 0.5, 0.16, 0.16, 0.16, 0, { emissive: L.signal.info, noShadow: true });
    S.work.push([0, d / 2 - 0.7, PI]);
  },
  mcp(k, L, g, w, d, S, D) {
    const items = (D.mcp || []).slice(0, 3), n = Math.max(1, items.length);
    k.add(g, 'box', L.prop2, 0, 1.15, -d / 2 + 0.15, w - 0.5, 1.5, 0.12);
    items.forEach((m, i) => {
      const x = (i - (n - 1) / 2) * ((w - 1.2) / n), col = [L.signal.info, L.inkSoft, L.ink][i % 3];
      k.add(g, 'tor', col, x, 1.45, -d / 2 + 0.24, 0.22, 0.22, 0.22, 0, { noShadow: true, emissive: col }); lbl(k, g, [{ t: m.id, size: 16, mono: true }], x, 1.85, -d / 2 + 0.4, 0.26);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 1.45, -d / 2 + 0.3), new THREE.Vector3(x + 0.2, 0.9, -d / 2 + 0.6), new THREE.Vector3(x, 0.25, -d / 2 + 1.2)]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.03, 8), k.m(col)); tube.castShadow = true; g.add(tube);
      k.add(g, 'box', L.prop, x, 0.18, -d / 2 + 1.3, 0.5, 0.36, 0.4); k.add(g, 'box', col, x, 0.2, -d / 2 + 1.51, 0.08, 0.08, 0.02, 0, { emissive: col, noShadow: true });
    });
    S.work.push([0, -d / 2 + 2.0, PI]);
  },
  hooks(k, L, g, w, d, S, D) {
    const hooks = (D.hooks || []).slice(0, 9); S.lamps = []; S.lampOf = {};
    k.add(g, 'box', L.prop2, 0, 1.0, -d / 2 + 0.4, Math.min(w - 0.4, 2.6), 2.0, 0.7); k.add(g, 'box', L.prop, 0, 1.05, -d / 2 + 0.77, Math.min(w - 0.6, 2.4), 1.7, 0.03);
    for (let i = 0; i < 9; i++) {
      const c = i % 3, r = Math.floor(i / 3), x = (c - 1) * 0.72, y = 1.6 - r * 0.5;
      const lamp = k.add(g, 'sph', L.inkSoft, x, y, -d / 2 + 0.82, 0.14, 0.14, 0.14, 0, { noShadow: true }); lamp.material = lamp.material.clone(); lamp.userData.base = lamp.material.color.clone(); S.lamps.push(lamp);
      const h = hooks[i]; const t = h ? (h.event || h.file || '').replace('UserPromptSubmit', 'Prompt').replace('PreToolUse', 'Pre').replace('PostToolUse', 'Post').replace('SessionStart', 'Start') : `Hook ${i + 1}`;
      lbl(k, g, [{ t: t.slice(0, 12), size: 13, mono: true, weight: 500 }], x, y - 0.2, -d / 2 + 0.86, 0.17); if (h) S.lampOf[h.event] = S.lampOf[h.event] ?? i;
    }
    lbl(k, g, [{ t: `${hooks.length || 9} Hooks`, size: 22 }, { t: 'Start · Prompt · Pre · Post · Stop · pre-commit', size: 14, weight: 500 }], 0, 2.5, -d / 2 + 0.4, 0.46);
    // Stop-Pult: Antwortschluss (format_check.py)
    k.add(g, 'box', L.prop2, w / 2 - 0.6, 0.45, d / 2 - 0.8, 0.6, 0.9, 0.5); S.stopLamp = k.add(g, 'sph', L.inkSoft, w / 2 - 0.6, 1.05, d / 2 - 0.8, 0.16, 0.16, 0.16, 0, { noShadow: true }); S.stopLamp.material = S.stopLamp.material.clone(); S.stopLamp.userData.base = S.stopLamp.material.color.clone();
    S.work.push([0, -d / 2 + 1.7, PI]);
  },
  claims(k, L, g, w, d, S, D) {
    k.add(g, 'box', L.prop2, 0, 1.15, -d / 2 + 0.12, w - 0.4, 1.7, 0.06);
    S.board = k.panel(g, w - 0.6, 1.5, (x, W, H) => drawBoard(x, W, H, L, [], false), 0, 1.15, -d / 2 + 0.16, 0, 384); S.board.userData.board = 'claims';
    k.add(g, 'cyl', L.prop, 0.6, 0.42, 0.5, 1.4, 0.06, 1.4); k.add(g, 'cyl', L.prop2, 0.6, 0.2, 0.5, 0.25, 0.4, 0.25);
    S.work.push([0, -d / 2 + 1.0, PI], [-0.9, 0.8, faceTo(-0.9 - 0.6, 0.8 - 0.5)]);
  },
  previews(k, L, g, w, d, S, D) {
    const n = (D.previews || []).length || 150, cols = ['#4E71FF', '#2BB673', '#FFB000', '#C77DFF', '#FF70A6', '#48BFE3'];
    k.add(g, 'box', L.prop2, 0, 1.3, -d / 2 + 0.1, w - 0.3, 2.2, 0.08);
    for (let i = 0; i < 6; i++) { const x = -w / 2 + 0.55 + i * ((w - 1.1) / 5), y = 1.3 + (i % 2 ? -0.42 : 0.42); k.add(g, 'box', L.ink, x, y, -d / 2 + 0.16, 0.62, 0.46, 0.03, 0, { noShadow: true }); k.panel(g, 0.56, 0.4, (c, W, H) => { c.fillStyle = L.screen; c.fillRect(0, 0, W, H); c.fillStyle = cols[i]; c.fillRect(8, 8, W * 0.45, H * 0.5); c.fillStyle = L.ink; c.fillRect(8, H * 0.7, W * 0.8, 6); c.fillRect(W * 0.58, 8, W * 0.34, H * 0.5); }, x, y, -d / 2 + 0.18, 0, 128); }
    lbl(k, g, [{ t: `${n} Vorschauseiten`, size: 20 }, { t: 'localhost:8085 · Varianten A/B/C', size: 14, weight: 500, mono: true }], 0, 2.75, -d / 2 + 0.3, 0.44);
    k.add(g, 'cyl', L.prop2, w / 2 - 0.5, 0.45, 0.6, 0.5, 0.9, 0.5); S.button = k.add(g, 'cyl', L.ink, w / 2 - 0.5, 0.95, 0.6, 0.3, 0.1, 0.3, 0, { noShadow: true }); S.button.material = S.button.material.clone();
    S.work.push([0, -d / 2 + 1.2, PI]);
  },
  settings(k, L, g, w, d, S, D) {
    const n = (D.settings || []).length || 5;
    k.add(g, 'box', L.prop2, 0, 1.25, -d / 2 + 0.2, Math.min(w - 0.4, 1.4), 1.1, 0.3); k.add(g, 'box', L.prop, 0, 1.25, -d / 2 + 0.37, Math.min(w - 0.6, 1.2), 0.9, 0.03);
    for (let i = 0; i < n; i++) k.add(g, 'box', i % 2 ? L.ink : L.signal.ok, -0.45 + i * (0.9 / Math.max(1, n - 1)), 1.25 + (i % 2 ? 0.08 : -0.08), -d / 2 + 0.42, 0.1, 0.22, 0.06, 0, { noShadow: true });
    lbl(k, g, [{ t: 'Settings', size: 20 }, { t: `${n} Dateien`, size: 14, weight: 500, mono: true }], 0, 2.2, -d / 2 + 0.3, 0.4);
    S.work.push([0, -d / 2 + 1.2, PI]);
  },
  sync(k, L, g, w, d, S, D) {
    const names = (D.sync && D.sync.machines) || ['Laptop', 'Labor', 'Home-PC'];
    names.forEach((n, i) => { const x = (i - 1) * ((w - 1.4) / 2); k.add(g, 'box', L.prop, x, 0.4, -d / 2 + 0.8, 1.0, 0.8, 0.7); k.add(g, 'box', L.prop2, x, 1.0, -d / 2 + 0.7, 0.8, 0.5, 0.05); lbl(k, g, [{ t: n, size: 17 }], x, 1.5, -d / 2 + 0.8, 0.28); });
    k.add(g, 'cyl', L.prop2, w / 2 - 0.4, 1.8, -d / 2 + 0.3, 0.06, 3.6, 0.06); [0.4, 0.7].forEach((r, i) => k.add(g, 'tor', L.ink, w / 2 - 0.4, 3.0 + i * 0.4, -d / 2 + 0.3, r, r, r, 0, { noShadow: true, emissive: L.ink }).rotation.x = PI / 2);
    k.add(g, 'box', L.prop2, 0, 0.04, d / 2 - 0.9, w - 0.8, 0.08, 0.3, 0, { noShadow: true }); S.shuttle = k.add(g, 'box', L.ink, 0, 0.3, d / 2 - 0.9, 0.7, 0.4, 0.5, 0, { emissive: L.ink }); S.shuttleX = (w - 1.4) / 2;
    lbl(k, g, [{ t: 'tools/ws_sync.sh', size: 15, mono: true }], 0, 0.95, d / 2 - 0.9, 0.24);
    S.work.push([0, d / 2 - 1.6, 0]);
  },
  qa(k, L, g, w, d, S) {
    S.lane = []; S.arches = [];
    for (let i = 0; i < 4; i++) {
      const x = -w / 2 + 0.8 + i * ((w - 1.6) / 3);
      k.add(g, 'box', L.prop2, x, 0.02, 0, Math.min(1.2, (w - 1.6) / 3 - 0.1), 0.04, d - 1.0, 0, { noShadow: true });
      const a = arch(k, L, g, x, -0.3, 1.1, L.inkSoft); a.scale.setScalar(0.8); S.arches.push(a);
      lbl(k, g, [{ t: 'Stufe ' + i, size: 18 }, { t: LEVELS[i].name, size: 13, weight: 500 }], x, 1.95, -0.3, 0.34);
      S.lane.push([x, 0.8, PI]);
    }
    S.work.push([w / 2 - 0.5, d / 2 - 0.5, PI]);
  },
  robot(k, L, g, w, d, S) {
    const fx = w / 2 - 0.35, fz0 = -d / 2 + 0.3, fz1 = d / 2 - 1.5;
    for (let i = 0; i <= 4; i++) { const z = fz0 + i * (fz1 - fz0) / 4; k.add(g, 'cyl', L.prop2, -fx, 0.6, z, 0.07, 1.2, 0.07); k.add(g, 'cyl', L.prop2, fx, 0.6, z, 0.07, 1.2, 0.07); }
    k.add(g, 'box', L.prop2, -fx, 1.15, (fz0 + fz1) / 2, 0.05, 0.05, fz1 - fz0); k.add(g, 'box', L.prop2, fx, 1.15, (fz0 + fz1) / 2, 0.05, 0.05, fz1 - fz0); k.add(g, 'box', L.prop2, 0, 1.15, fz0, 2 * fx, 0.05, 0.05);
    k.add(g, 'box', L.prop, 0, 0.3, -0.6, 1.4, 0.6, 1.2); S.arm = robotArm(k, L, g, 0, -0.8);
    for (let i = 0; i < 3; i++) k.add(g, 'box', [L.ink, L.inkSoft, L.prop2][i], -0.45 + i * 0.3, 0.67, -0.25, 0.14, 0.14, 0.14);
    // Sicherheitszone fest: E-STOP (rot = Stopp) + Schild Robot | Digital Twin / Robot | Hardware
    k.add(g, 'box', L.prop2, w / 2 - 0.6, 0.5, d / 2 - 0.7, 0.36, 1.0, 0.36); k.add(g, 'cyl', L.signal.err, w / 2 - 0.6, 1.06, d / 2 - 0.7, 0.3, 0.12, 0.3, 0, { emissive: L.signal.err }); lbl(k, g, [{ t: 'E-STOP', size: 14, weight: 800, mono: true }], w / 2 - 0.6, 1.4, d / 2 - 0.7, 0.2);
    S.modeSign = lbl(k, g, [{ t: 'Robot | Digital Twin', size: 20 }, { t: 'Domain 94 · grasp_e2e.py', size: 14, weight: 500, mono: true }], 0, 2.3, -0.8, 0.42);
    S.work.push([-0.4, d / 2 - 0.6, PI], [0.9, d / 2 - 0.8, PI]);
  },
  post(k, L, g, w, d, S) {
    standDesk(k, L, g, -w / 2 + 0.9, -d / 2 + 0.8, 0, 'code');
    S.gate = arch(k, L, g, w / 4, -0.2, 1.6, L.inkSoft); lbl(k, g, [{ t: 'tools/pre-commit', size: 16, mono: true }], w / 4, 2.3, -0.2, 0.28);
    for (let i = 0; i < 3; i++) k.add(g, 'box', L.prop2, w / 2 - 0.5, 0.2 + i * 0.34, -d / 2 + 0.6, 0.7, 0.3, 0.55);
    S.work.push([-w / 2 + 0.9, -d / 2 + 1.5, PI]); S.gateIn = [w / 4, 0.8, PI]; S.gateOut = [w / 4, -1.2, PI];
  },
  docs(k, L, g, w, d, S) {
    standDesk(k, L, g, 0, -d / 2 + 0.8, 0, 'code'); lbl(k, g, [{ t: 'en · de', size: 18, mono: true }, { t: 'docs · README · Handbuch', size: 13, weight: 500 }], 0, 1.75, -d / 2 + 0.8, 0.34);
    [-0.9, 0.9].forEach(x => { for (let i = 0; i < 4; i++) k.add(g, 'box', i % 2 ? L.prop : L.prop2, x, 0.08 + i * 0.12, 0.3, 0.5 - i * 0.04, 0.1, 0.4, i * 0.2); });
    S.work.push([0, -d / 2 + 1.5, PI]);
  },
};

// ───────────────────────── Boden ─────────────────────────
function paintFloor(L, lay, stations, raum) {
  const [x0, z0, x1, z1] = lay.bounds, ppm = Math.min(64, 4096 / (x1 - x0));
  const c = document.createElement('canvas'); c.width = Math.round((x1 - x0) * ppm); c.height = Math.round((z1 - z0) * ppm);
  const x = c.getContext('2d'), X = v => (v - x0) * ppm, Z = v => (v - z0) * ppm;
  x.fillStyle = L.floor; x.fillRect(0, 0, c.width, c.height);
  if (L.grid === 'coarse') { x.strokeStyle = L.ink; x.globalAlpha = 0.12; x.lineWidth = 2; for (let v = Math.ceil(x0 / 4) * 4; v <= x1; v += 4) { x.beginPath(); x.moveTo(X(v), 0); x.lineTo(X(v), c.height); x.stroke(); } for (let v = Math.ceil(z0 / 4) * 4; v <= z1; v += 4) { x.beginPath(); x.moveTo(0, Z(v)); x.lineTo(c.width, Z(v)); x.stroke(); } x.globalAlpha = 1; }
  if (L.grid === 'fine') { for (let v = Math.ceil(x0); v <= x1; v++) { x.strokeStyle = L.ink; x.globalAlpha = v % 5 ? 0.07 : 0.16; x.lineWidth = v % 5 ? 1 : 2; x.beginPath(); x.moveTo(X(v), 0); x.lineTo(X(v), c.height); x.stroke(); } for (let v = Math.ceil(z0); v <= z1; v++) { x.strokeStyle = L.ink; x.globalAlpha = v % 5 ? 0.07 : 0.16; x.lineWidth = v % 5 ? 1 : 2; x.beginPath(); x.moveTo(0, Z(v)); x.lineTo(c.width, Z(v)); x.stroke(); } x.globalAlpha = 1; }
  if (L.fibers) { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; x.lineWidth = 1.2; for (let i = 0; i < c.width * c.height / 900; i++) { const a = r() * c.width, b = r() * c.height, t = r() * PI; x.strokeStyle = r() < 0.5 ? 'rgba(59,42,28,.10)' : 'rgba(255,240,215,.12)'; x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(t) * ppm * 0.4, b + Math.sin(t) * ppm * 0.4); x.stroke(); } }
  // Phasen-Spalten (Raum:A)
  if (lay.columns) lay.columns.forEach(([ph, a, b], i) => { if (i % 2) { x.fillStyle = L.stripe || (L.dark ? 'rgba(255,255,255,.03)' : 'rgba(31,43,224,.035)'); x.fillRect(X(a), 0, X(b) - X(a), c.height); } });
  // Wege
  const wcol = L.walk || L.paper2;
  const stroke = (p, w, col, dash = [], alpha = 1) => { x.strokeStyle = col; x.globalAlpha = alpha; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.setLineDash(dash); x.beginPath(); p.forEach(([a, b], i) => i ? x.lineTo(X(a), Z(b)) : x.moveTo(X(a), Z(b))); x.stroke(); x.setLineDash([]); x.globalAlpha = 1; };
  lay.walks.forEach(p => { stroke(p, ppm * (L.walkW || 2.0), wcol); if (L.walkTiles) { x.lineCap = 'butt'; stroke(p, ppm * 1.7, '#FFFFFF', [ppm * 1.6, ppm * 0.25]); } if (L.walkLine) stroke(p, 3, L.walkLine, L.walkDash.map(v => v * ppm), L.walkLineA); });
  // Hauptweg: A = lauter Bodenstreifen in Phasenfarben mit Pfeilen · B = Ring · C = Schleife (dezent)
  if (lay.main) {
    if (lay.loud) {
      lay.columns.forEach(([ph, a, b]) => { const col = hsl({ auftrag: 28, plan: 266, bau: 212, pruef: 172, liefer: 330 }[ph], 0.55, L.dark ? 0.32 : 0.78); x.fillStyle = col; x.fillRect(X(a), Z(3.2) - ppm * 1.0, X(b) - X(a), ppm * 2.0); });
      x.fillStyle = L.ink; x.globalAlpha = 0.85; x.textBaseline = 'middle'; x.textAlign = 'left';
      lay.columns.forEach(([ph, a, b]) => { const P = PHASES.find(p => p.id === ph), txt = `0${P.n} ${P.name.toUpperCase()}`; let px = ppm * 0.4; x.font = `800 ${px}px ${L.font}`; while (x.measureText(txt).width > (b - a) * ppm - ppm * 0.8 && px > 8) { px *= 0.94; x.font = `800 ${px}px ${L.font}`; } x.fillText(txt, X(a) + ppm * 0.4, Z(3.2)); });
      x.globalAlpha = 1;
    } else stroke(lay.main, ppm * 0.18, L.signal.info, [ppm * 0.5, ppm * 0.35], 0.5);
  }
  // Stations-Flächen + Name am offenen Rand
  stations.forEach(([id, cx, cz, w, d, rot]) => {
    if (id === 'bench' && raum === 'B') return;
    x.save(); x.translate(X(cx), Z(cz)); x.rotate(-rot);
    x.fillStyle = (L.padOf && L.padOf[STATIONS[id].phase]) || L.pad; x.globalAlpha = 0.92; x.beginPath(); x.roundRect(-w / 2 * ppm, -d / 2 * ppm, w * ppm, d * ppm, L.padR ? ppm * L.padR : 3); x.fill(); x.globalAlpha = 1;
    x.strokeStyle = L.zoneLine || L.ink; x.lineWidth = L.zoneLW || 2.5; x.globalAlpha = L.zoneA ?? 0.5; x.stroke(); x.globalAlpha = 1;
    x.fillStyle = L.ink; x.font = `700 ${ppm * 0.34}px ${L.font}`; x.textAlign = 'center'; x.textBaseline = 'bottom';
    x.fillText(STATIONS[id].name.toUpperCase(), 0, d / 2 * ppm - ppm * 0.14);
    x.restore();
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, w: x1 - x0, d: z1 - z0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
}

// ───────────────────────── Büro aufbauen ─────────────────────────
// D = echte Setup-Daten (setup.js), raum = 'A' | 'B' | 'C'
// Werkbank-Loft etwas größer (Wunsch des Users 2026-10-16: mehr Platz für die Figuren, nicht zu groß): Abstände × 1,15, Möbel bleiben gleich groß
function grow(lay, f) {
  const xz = p => [p[0] * f, p[1] * f, ...p.slice(2)];
  lay.bounds = lay.bounds.map(v => v * f); if (lay.room) lay.room = lay.room.map(v => v * f);
  lay.walks = lay.walks.map(w => w.map(xz)); lay.stations = lay.stations.map(([id, x, z, ...r]) => [id, x * f, z * f, ...r]);
  if (lay.start) lay.start = xz(lay.start); if (Array.isArray(lay.main)) lay.main = lay.main.map(xz);
}
grow(LAYOUTS.C, 1.15);

export function buildOffice(scene, k, L, raum, D) {
  if (D) { const n = a => (a || []).length; if (n(D.agents)) STATIONS.agents.sub = `${n(D.agents)} Subagenten`; if (n(D.skills)) STATIONS.skills.sub = `Bücherregal · ${n(D.skills)}`; }   // Zahlen aus den echten Daten, nicht fest
  const lay = LAYOUTS[raum];
  const nav = new Nav(); nav.build(lay.walks);
  const st = new Map();
  lay.stations.forEach(def => {
    const [id, x, z, w, d, rot] = def;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    const S = { work: [] };
    const ph = STATIONS[id].phase, Ls = L.frameOf ? { ...L, prop2: L.frameOf[ph] || L.prop2 } : L;   // v3: Gestelle in Phasenfarbe
    BUILD[id](k, Ls, g, w, d, S, D, raum);
    if (L.rich) dress(k, Ls, g, id, w, d);
    S.desks = []; g.traverse(o => { if (o.userData.lamp) S.desks.push(o); });
    if (L.dark && id !== 'bench') pendant(k, L, g, 0, 0, L.ink);
    g.traverse(o => { if (o.isMesh) o.userData.station = id; });
    const open = new THREE.Vector3(0, 0, d / 2 + 0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(g.position);
    const entry = nav.attach(open.x, open.z);
    const toW = p => { const v = new THREE.Vector3(p[0], 0, p[1]).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(g.position); return { x: v.x, z: v.z, face: (p[2] ?? 0) + rot }; };
    st.set(id, { id, def, g, S, entry, open: { x: open.x, z: open.z }, toW, info: STATIONS[id], top: id === 'bench' ? 1.9 : 2.9, baseY: 0 });
    if (L.rich) { const s1 = k.label([{ t: `${ICON[id]}  ${STATIONS[id].name}`, size: 26, weight: 700 }], { h: 0.62, order: 6 }); s1.position.set(x, id === 'bench' ? 2.4 : 3.2, z); scene.add(s1); st.get(id).sign1 = s1; }
  });
  // Wände: Rechteck (A, C) oder Rundung (B)
  const wallCol = L.wall, H = 1.5, t = 0.22;
  if (lay.room) {
    const [hx0, hz0, hx1, hz1] = lay.room;
    k.add(scene, 'box', wallCol, (hx0 + hx1) / 2, H / 2, hz0, hx1 - hx0, H, t); k.add(scene, 'box', wallCol, hx0, H / 2, (hz0 + hz1) / 2, t, H, hz1 - hz0); k.add(scene, 'box', wallCol, hx1, H / 2, (hz0 + hz1) / 2, t, H, hz1 - hz0);
    k.add(scene, 'box', wallCol, (hx0 + hx1) / 2, 0.14, hz1, hx1 - hx0, 0.28, t);
    if (lay.columns) lay.columns.forEach(([ph, a, b]) => { const P = PHASES.find(p => p.id === ph); const s = k.label([{ t: `0${P.n} ${P.name}`, size: 32, weight: 800 }, { t: P.who, size: 17, weight: 500 }], { h: 0.9 }); s.position.set((a + b) / 2, 3.0, hz0 + 0.3); scene.add(s); });
  } else {
    const n = 36, r = lay.radius; for (let i = 0; i < n; i++) { const a = 2 * PI * (i + 0.5) / n; k.add(scene, 'box', wallCol, Math.cos(a) * r, 0.3, Math.sin(a) * r, 2 * PI * r / n + 0.05, 0.6, t, -a + PI / 2); }
    const s = k.label([{ t: 'Atrium', size: 32, weight: 800 }, { t: 'Tresen + Leitstand in der Mitte', size: 17, weight: 500 }], { h: 0.9 }); s.position.set(0, 3.4, -4.6); scene.add(s);
  }
  // Boden
  const F = paintFloor(L, lay, lay.stations, raum);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(F.w, F.d), new THREE.MeshStandardMaterial({ map: F.tex, roughness: 0.95, metalness: 0 }));
  floor.rotation.x = -PI / 2; floor.position.set(F.cx, 0, F.cz); floor.receiveShadow = true; scene.add(floor);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: L.bg, roughness: 1 })); ground.rotation.x = -PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
  return { lay, nav, st, floor, ground };
}
