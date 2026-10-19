// Figuren: Grundkörper (Capsule) + Berufskleidung je Rolle (WEAR/PROP/HAT) + Comic-Augen + Werkzeug-Kennung (Bereich Figur A–C).
// Figur:A Farbfamilie · Figur:B ein Accessoire · Figur:C Teamfarbe + Emblem (Empfehlung). Subagenten = kleine Helfer (Opus-Violett / Sonnet-Teal).
// Gelb (wartet auf dich) und Rot (Fehler/Stopp) bleiben Signalen vorbehalten → Rollen und Werkzeuge meiden diese Töne.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ───────────────────────── Farben ─────────────────────────
export function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
  return '#' + f(0) + f(8) + f(4);
}
const TONE = {
  organizer: [214, 0.3, 0], designer: [312, 1, 0], dev: [226, 1, -0.05], editor: [172, 1, -0.05], pm: [256, 0.9, 0],
  scrum: [84, 0.85, -0.05], research: [284, 1, 0], mkt: [338, 0.9, 0.04], d3: [26, 0.6, -0.06], tester: [198, 1, 0.02], sync: [224, 0.22, -0.22],
};
const MODE = { paper: [0.52, 0.82], neon: [0.92, 0.64], pastel: [0.6, 0.78], toy: [0.82, 0.56], marker: [0.95, 0.6], fabric: [0.5, 0.74] };
const METAL = { organizer: '#C9CCD3', designer: '#D9A08E', dev: '#6F8BB0', editor: '#5FA39A', pm: '#7C79B8', scrum: '#B5A14E', research: '#9A6FC0', mkt: '#C9787F', d3: '#C77B4A', tester: '#E8E6E1', sync: '#5A5F68' };
export function tone(L, key, dl = 0) {
  if (L.cast === 'metal') return dl ? shade(METAL[key], dl) : METAL[key];
  const t = TONE[key]; const [ms, ml] = MODE[L.cast || 'pastel'];
  return hsl(t[0], clamp(ms * t[1], 0, 1), clamp(ml + t[2] + dl, 0.1, 0.94));
}
export function shade(hex, dl) { const c = new THREE.Color(hex), o = {}; c.getHSL(o, THREE.SRGBColorSpace); return '#' + new THREE.Color().setHSL(o.h, o.s, clamp(o.l + dl, 0.04, 0.97), THREE.SRGBColorSpace).getHexString(); }
const white = L => L.cast === 'metal' ? '#E8E6E1' : L.dark ? '#DCE4F2' : L.cast === 'paper' ? '#FBF9F3' : '#FFFFFF';
const ink = L => L.dark ? '#1A1D26' : '#26262B';

// Werkzeug-Markenfarben (einzige Stelle, an der Terrakotta vorkommt: Claude) + Helfer-Modelle
export const TOOL = {
  Claude: { main: '#D97757', dark: '#A8512F', light: '#F2B596', text: '#1E1E1E', emblem: '✳', hue: 18 },
  Codex: { main: '#2B2F36', dark: '#16181C', light: '#E9EBEE', accent: '#10A37F', text: '#FFFFFF', emblem: '>_', hue: 220 },
  Gemini: { main: '#1A73E8', dark: '#124FA3', light: '#9B72CB', text: '#FFFFFF', emblem: '✦', hue: 238 },
};
export const SUB = { Opus: { main: '#7C5CBF', dark: '#59418F', light: '#B9A4E3' }, Sonnet: { main: '#2BB3A3', dark: '#1E8075', light: '#8FDDD3' } };

// ───────────────────────── Hüte (Form = Rolle) ─────────────────────────
export const HAT = {
  organizer(k, c, h) { const b = k.add(h, 'tor', c, 0, 0.02, 0, 0.42, 0.42, 0.42, 0, { noShadow: true }); b.rotation.z = PI / 2; k.add(h, 'box', c, 0.19, -0.13, 0.12, 0.03, 0.03, 0.18, 0, { noShadow: true }); k.add(h, 'sph', c, 0.19, -0.13, 0.22, 0.06, 0.06, 0.06, 0, { noShadow: true }); },
  designer(k, c, h) { const b = k.add(h, 'sph', c, 0.04, 0.13, 0, 0.42, 0.16, 0.42); b.rotation.z = -0.25; k.add(h, 'sph', c, 0.05, 0.22, 0, 0.05, 0.05, 0.05); },
  dev(k, c, h) { k.add(h, 'tor', c, 0, 0.02, 0, 0.44, 0.44, 0.5, 0, { noShadow: true }); k.add(h, 'cyl', c, -0.2, -0.04, 0, 0.13, 0.08, 0.13).rotation.z = PI / 2; k.add(h, 'cyl', c, 0.2, -0.04, 0, 0.13, 0.08, 0.13).rotation.z = PI / 2; },   // Bügel von Ohr zu Ohr
  editor(k, c, h) { k.add(h, 'cyl', c, 0, 0.14, 0, 0.3, 0.14, 0.3); k.add(h, 'cyl', c, 0, 0.08, 0, 0.5, 0.02, 0.5); },
  pm(k, c, h) { k.add(h, 'half', c, 0, 0.06, 0, 0.38, 0.32, 0.38); k.add(h, 'box', c, 0, 0.07, 0.17, 0.22, 0.02, 0.16); },
  scrum(k, c, h) { const b = k.add(h, 'tor', c, 0, 0.07, 0, 0.4, 0.4, 0.4, 0, { noShadow: true }); b.rotation.x = PI / 2; k.add(h, 'sph', c, 0, 0.0, 0.2, 0.05, 0.05, 0.05); },
  research(k, c, h) { k.add(h, 'cyl', c, -0.07, 0.11, 0.13, 0.1, 0.06, 0.1).rotation.x = PI / 2; k.add(h, 'cyl', c, 0.07, 0.11, 0.13, 0.1, 0.06, 0.1).rotation.x = PI / 2; const b = k.add(h, 'tor', c, 0, 0.11, 0, 0.4, 0.4, 0.4, 0, { noShadow: true }); b.rotation.x = PI / 2; },
  mkt(k, c, h) { k.add(h, 'cyl', c, 0, 0.27, 0, 0.24, 0.3, 0.24); k.add(h, 'cyl', c, 0, 0.12, 0, 0.42, 0.02, 0.42); },
  d3(k, c, h) { k.add(h, 'half', c, 0, 0.07, 0, 0.42, 0.36, 0.42); k.add(h, 'cyl', c, 0, 0.07, 0.04, 0.5, 0.02, 0.5); },
  tester(k, c, h) { k.add(h, 'box', c, 0, 0.0, 0.17, 0.34, 0.08, 0.04); k.add(h, 'tor', c, 0, 0.12, 0, 0.42, 0.42, 0.3, 0, { noShadow: true }).rotation.x = PI / 2; },
  sync(k, c, h) { k.add(h, 'half', c, 0, 0.06, 0, 0.38, 0.3, 0.38); k.add(h, 'box', c, 0, 0.07, -0.18, 0.22, 0.02, 0.16); },
};

// ───────────────────────── Requisiten in der Hand ─────────────────────────
const PROP = {
  organizer(k, L, h, c) { k.add(h, 'box', c.dark, 0, -0.02, 0.07, 0.2, 0.15, 0.02).rotation.x = -0.9; k.add(h, 'box', L.screen, 0, -0.01, 0.083, 0.17, 0.12, 0.005, 0, { basic: true, noShadow: true }).rotation.x = -0.9; },
  designer(k, L, h, c) { const g = new THREE.Group(); g.rotation.x = 0.5; h.add(g); k.add(g, 'cyl', '#8A6A4A', 0, 0.06, 0.04, 0.03, 0.26, 0.03); k.add(g, 'cone', c.main, 0, 0.22, 0.04, 0.05, 0.1, 0.05); },
  dev(k, L, h, c) { const g = new THREE.Group(); g.position.set(0, -0.04, 0.12); h.add(g); k.add(g, 'box', c.dark, 0, 0, 0, 0.3, 0.02, 0.2); const s = k.add(g, 'box', c.dark, 0, 0.09, -0.1, 0.3, 0.19, 0.015); s.rotation.x = -0.25; k.add(g, 'box', L.screen, 0, 0.09, -0.09, 0.26, 0.15, 0.005, 0, { basic: true, noShadow: true }).rotation.x = -0.25; },
  editor(k, L, h, c) { k.add(h, 'box', c.main, 0, -0.02, 0.08, 0.17, 0.22, 0.06); k.add(h, 'box', c.white, 0, -0.02, 0.08, 0.155, 0.2, 0.065); k.add(h, 'box', c.dark, -0.08, -0.02, 0.08, 0.02, 0.22, 0.065); },
  pm(k, L, h, c) { k.add(h, 'box', '#9A7650', 0, -0.03, 0.07, 0.18, 0.24, 0.015).rotation.x = -0.4; k.add(h, 'box', c.white, 0, -0.04, 0.078, 0.15, 0.18, 0.006, 0, { noShadow: true }).rotation.x = -0.4; k.add(h, 'box', c.dark, 0, 0.08, 0.04, 0.08, 0.03, 0.02); },
  scrum(k, L, h, c) { const w = k.add(h, 'cyl', c.white, 0, -0.03, 0.07, 0.13, 0.03, 0.13); w.rotation.x = PI / 2; k.add(h, 'tor', c.dark, 0, -0.03, 0.07, 0.13, 0.13, 0.13, 0, { noShadow: true }); k.add(h, 'cyl', c.dark, 0, 0.05, 0.07, 0.03, 0.04, 0.03); },
  research(k, L, h, c) { k.add(h, 'sph', c.light, 0, -0.06, 0.08, 0.15, 0.15, 0.15, 0, { opacity: 0.75 }); k.add(h, 'cyl', c.light, 0, 0.04, 0.08, 0.05, 0.1, 0.05, 0, { opacity: 0.75 }); k.add(h, 'sph', c.main, 0, -0.08, 0.08, 0.1, 0.07, 0.1); },
  mkt(k, L, h, c) { const g = new THREE.Group(); g.position.set(0, -0.02, 0.1); g.rotation.x = PI / 2; h.add(g); k.add(g, 'cone', c.main, 0, 0.08, 0, 0.17, 0.22, 0.17).rotation.x = PI; k.add(g, 'cyl', c.dark, 0, -0.06, 0, 0.05, 0.08, 0.05); },
  d3(k, L, h, c) { const b = k.add(h, 'box', c.light, 0, -0.05, 0.09, 0.14, 0.14, 0.14); b.rotation.set(0.5, 0.6, 0); },
  tester(k, L, h, c) { const g = new THREE.Group(); g.position.set(0, 0, 0.06); g.rotation.x = -0.3; h.add(g); k.add(g, 'cyl', c.dark, 0, 0.0, 0, 0.03, 0.14, 0.03); k.add(g, 'tor', c.dark, 0, 0.13, 0, 0.13, 0.13, 0.13, 0, { noShadow: true }); k.add(g, 'cyl', c.light, 0, 0.13, 0, 0.11, 0.01, 0.11, 0, { opacity: 0.5 }).rotation.x = PI / 2; },
  sync(k, L, h, c) { k.add(h, 'box', '#C9A27A', 0, -0.06, 0.1, 0.22, 0.16, 0.18); k.add(h, 'box', c.main, 0, -0.06, 0.1, 0.05, 0.165, 0.185); },
  coffee(k, L, h, c) { k.add(h, 'cyl', c.white, 0, -0.02, 0.07, 0.08, 0.1, 0.08); k.add(h, 'tor', c.white, 0.05, -0.02, 0.07, 0.05, 0.05, 0.05, 0, { noShadow: true }).rotation.y = PI / 2; k.add(h, 'cyl', '#5A3A22', 0, 0.025, 0.07, 0.07, 0.01, 0.07, 0, { noShadow: true }); },
  wrench(k, L, h, c) { const g = new THREE.Group(); g.position.set(0, -0.02, 0.06); g.rotation.x = 0.4; h.add(g); k.add(g, 'box', c.metal, 0, 0.05, 0, 0.03, 0.18, 0.02); k.add(g, 'tor', c.metal, 0, 0.16, 0, 0.06, 0.06, 0.06, 0, { noShadow: true }); },
  lens(k, L, h, c) { PROP.tester(k, L, h, c); },
};

// Kleidung über dem Körper je Rolle („Berufskleidung“)
const WEAR = {
  organizer(k, L, P, c) { HAT.organizer(k, c.dark, P.hat); },
  designer(k, L, P, c) { HAT.designer(k, c.main, P.hat); scarf(k, P, c.light); },
  dev(k, L, P, c) { k.add(P.head, 'half', c.main, 0, 0.02, -0.07, P.hr * 1.08, P.hr * 0.95, P.hr * 1.02).rotation.x = -0.5; HAT.dev(k, c.dark, P.hat); },
  editor(k, L, P, c) { vest(k, P, c.dark); glasses(k, P, c.ink); },
  pm(k, L, P, c) { k.add(P.outfit, 'box', c.dark, 0, 0.7, P.front + 0.012, 0.05, 0.2, 0.02, 0, { noShadow: true }); k.add(P.outfit, 'box', c.dark, 0, 0.81, P.front + 0.012, 0.08, 0.04, 0.025, 0, { noShadow: true }); HAT.pm(k, c.main, P.hat); },
  scrum(k, L, P, c) { const b = k.add(P.head, 'tor', c.light, 0, 0.06, 0, P.hr * 0.98, P.hr * 0.98, P.hr * 0.9, 0, { noShadow: true }); b.rotation.x = PI / 2; stripes(k, P, c.white); k.add(P.outfit, 'cyl', c.dark, 0.05, 0.74, P.front + 0.02, 0.04, 0.05, 0.04, 0, { noShadow: true }).rotation.x = PI / 2; },
  research(k, L, P, c) { coat(k, P, c.white, c.main); const g = k.add(P.head, 'tor', c.dark, 0, 0.12, 0.02, P.hr * 0.92, P.hr * 0.92, P.hr * 0.7, 0, { noShadow: true }); g.rotation.x = PI / 2 - 0.25; k.add(P.head, 'box', c.light, 0, 0.12, P.hr / 2 - 0.01, 0.2, 0.07, 0.04, 0, { opacity: 0.8, noShadow: true }); },
  mkt(k, L, P, c) { scarf(k, P, c.light); k.add(P.outfit, 'box', c.dark, -0.07, 0.76, P.front + 0.01, 0.06, 0.16, 0.02, 0.3, { noShadow: true }); k.add(P.outfit, 'box', c.dark, 0.07, 0.76, P.front + 0.01, 0.06, 0.16, 0.02, -0.3, { noShadow: true }); HAT.mkt(k, c.main, P.hat); },
  d3(k, L, P, c) { k.add(P.outfit, 'box', c.main, 0, 0.6, P.front + 0.008, 0.2, 0.2, 0.03); k.add(P.outfit, 'box', c.main, -0.08, 0.76, P.front + 0.004, 0.035, 0.18, 0.025); k.add(P.outfit, 'box', c.main, 0.08, 0.76, P.front + 0.004, 0.035, 0.18, 0.025); HAT.d3(k, c.light, P.hat); },
  tester(k, L, P, c) { coat(k, P, c.white, c.main); HAT.tester(k, c.dark, P.hat); },
  sync(k, L, P, c) { HAT.sync(k, c.dark, P.hat); const s = k.add(P.outfit, 'tor', c.dark, 0, 0.66, 0, 0.42, 0.52, 0.32, 0, { noShadow: true }); s.rotation.set(0, PI / 2, 0.75); k.add(P.outfit, 'box', c.dark, 0.17, 0.46, 0.02, 0.06, 0.16, 0.2); },
};
function scarf(k, P, col, g = P.outfit) { const s = k.add(g, 'tor', col, 0, 0.88, 0, 0.36, 0.36, 0.5, 0, { noShadow: true }); s.rotation.x = PI / 2; k.add(g, 'box', col, 0.06, 0.78, P.front + 0.02, 0.06, 0.16, 0.03, 0.2, { noShadow: true }); }
function vest(k, P, col) { k.add(P.outfit, 'box', col, -0.07, 0.68, P.front + 0.008, 0.1, 0.3, 0.03, 0.08); k.add(P.outfit, 'box', col, 0.07, 0.68, P.front + 0.008, 0.1, 0.3, 0.03, -0.08); }
function glasses(k, P, col) { [-0.08, 0.08].forEach(x => k.add(P.head, 'tor', col, x, 0.03, P.hr / 2 - 0.005, 0.12, 0.12, 0.12, 0, { noShadow: true })); k.add(P.head, 'box', col, 0, 0.03, P.hr / 2, 0.06, 0.012, 0.012, 0, { noShadow: true }); }
function stripes(k, P, col) { [-0.06, 0.06].forEach(x => k.add(P.outfit, 'box', col, x, 0.66, P.front + 0.006, 0.025, 0.36, 0.02, 0, { noShadow: true })); }
function coat(k, P, col, trim) {
  const g = new THREE.CylinderGeometry(0.17, 0.22, 0.56, 16, 1, true, 0.35, 2 * PI - 0.7);
  const m = k.add(P.outfit, g, col, 0, 0.55, 0, 1, 1, 0.9); m.material = m.material.clone(); m.material.side = THREE.DoubleSide;
  [-1, 1].forEach(s => k.add(P.outfit, 'box', trim, s * 0.055, 0.6, P.front + 0.03, 0.025, 0.44, 0.02, s * 0.1, { noShadow: true }));
  P.armL.userData.mesh.material = P.armR.userData.mesh.material = k.m(col);
}

// ───────────────────────── Körper ─────────────────────────
function baseBody(k, L, o) {
  const sc = o.scale || 1;
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig); rig.scale.setScalar(sc);
  const P = { root, rig, kind: o.kind, phase: Math.random() * 6, role: null, mood: 'idle', blink: 2 + Math.random() * 3 };
  P.hips = new THREE.Group(); P.hips.position.y = 0.4; rig.add(P.hips);
  const legGeo = new THREE.CapsuleGeometry(0.08, 0.2, 4, 10), armGeo = new THREE.CapsuleGeometry(0.064, 0.2, 4, 10);
  const limb = (geo, mat, x, y, len, par) => { const p = new THREE.Group(); p.position.set(x, y, 0); const mm = new THREE.Mesh(geo, mat); mm.castShadow = mm.receiveShadow = true; mm.position.y = -len / 2; p.add(mm); p.userData.mesh = mm; par.add(p); return p; };
  P.legL = limb(legGeo, o.pants, -0.09, 0, 0.34, P.hips); P.legR = limb(legGeo, o.pants, 0.09, 0, 0.34, P.hips);
  [P.legL, P.legR].forEach(l => k.add(l, 'box', o.shoes, 0, -0.33, 0.03, 0.13, 0.07, 0.19));
  P.torso = k.add(rig, new THREE.CapsuleGeometry(0.19, 0.16, 6, 14), null, 0, 0.66, 0, 1, 1, 0.9, 0, { mat: o.shirt });
  P.front = 0.17;
  P.armL = limb(armGeo, o.shirt, -0.23, 0.84, 0.32, rig); P.armR = limb(armGeo, o.shirt, 0.23, 0.84, 0.32, rig);
  [P.armL, P.armR].forEach(a => k.add(a, 'sph', o.skin, 0, -0.33, 0, 0.12, 0.12, 0.12));
  P.hand = new THREE.Group(); P.hand.position.y = -0.33; P.armR.add(P.hand);
  P.head = new THREE.Group(); P.head.position.y = 1.08; rig.add(P.head);
  P.hr = 0.46; P.headShape = 'sph';
  P.skull = k.add(P.head, 'sph', o.skin, 0, 0, 0, P.hr, P.hr, P.hr);
  P.hat = new THREE.Group(); P.hat.position.y = P.hr * 0.32; P.head.add(P.hat);
  P.outfit = new THREE.Group(); rig.add(P.outfit);      // Rollenkleidung (wechselt mit der Rolle)
  P.toolkit = new THREE.Group(); rig.add(P.toolkit);    // Werkzeug-Kennung (bleibt)
  P.card = new THREE.Group(); P.card.position.set(0, -0.3, 0.06); P.armR.add(P.card); P.card.visible = false;
  k.add(P.card, 'box', L.prop, 0, 0, 0, 0.26, 0.18, 0.02, 0, { noShadow: true });
  P.stripe = k.add(P.card, 'box', L.ink, 0, 0.065, 0.012, 0.26, 0.05, 0.005, 0, { noShadow: true });
  P.setCard = (on, color) => { P.card.visible = on; P.hand.visible = !on; if (color) P.stripe.material = k.m(color); };
  return P;
}
function hair(k, L, P, col) { const h = P.hr; const cap = k.add(P.head, 'half', col, 0, h * 0.06, -0.02, h * 1.06, h * 0.98, h * 1.06); cap.rotation.x = -0.32; return cap; }
function frontZ(P, x, y) { const r = P.hr / 2; return Math.sqrt(Math.max(0, r * r - x * x - y * y)) - 0.006; }

// Brust-Emblem (✳ Claude · >_ Codex · ✦ Gemini) als Canvas-Scheibe
const embCache = new Map();
function emblemTex(tool) {
  if (embCache.has(tool)) return embCache.get(tool);
  const T = TOOL[tool], c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = tool === 'Codex' ? T.accent : T.light; x.beginPath(); x.arc(64, 64, 60, 0, 2 * PI); x.fill();
  x.fillStyle = tool === 'Codex' ? '#FFFFFF' : T.dark; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = tool === 'Codex' ? '800 54px "JetBrains Mono", ui-monospace, monospace' : '800 84px system-ui, sans-serif';
  x.fillText(T.emblem, 64, tool === 'Codex' ? 66 : 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; embCache.set(tool, t); return t;
}
function emblem(k, parent, tool, x, y, z, r) {
  const mesh = new THREE.Mesh(k.GEO.disc, new THREE.MeshBasicMaterial({ map: emblemTex(tool), transparent: true }));
  mesh.scale.set(r * 2, r * 2, 1); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}

// Comic-Augen mit Pupillen + Brauen, Stimmung je Zustand
function faceComic(k, L, P) {
  const F = new THREE.Group(); P.head.add(F); const eye = ink(L), W = '#FFFFFF';
  const xs = [-0.082, 0.082], ey = 0.03;
  xs.forEach(x => k.add(F, 'sph', W, x, ey, frontZ(P, x, ey) - 0.02, 0.11, 0.13, 0.06, 0, { basic: true, noShadow: true }));
  P.eyes = xs.map(x => k.add(F, 'sph', eye, x, ey, frontZ(P, x, ey) + 0.008, 0.055, 0.065, 0.03, 0, { basic: true, noShadow: true }));
  P.eyes.forEach(e => { const h = new THREE.Mesh(k.GEO.sph, k.m('#FFFFFF', { basic: true })); h.scale.set(0.35, 0.3, 0.3); h.position.set(0.012 / 0.055, 0.015 / 0.065, 0.4); e.add(h); });
  const brows = xs.map(x => k.add(F, 'box', eye, x, 0.12, frontZ(P, x, 0.12) + 0.004, 0.08, 0.016, 0.016, 0, { basic: true, noShadow: true }));
  const smile = k.add(F, new THREE.TorusGeometry(0.04, 0.01, 6, 14, PI), eye, 0, -0.05, frontZ(P, 0, -0.05), 1, 1, 1, 0, { basic: true, noShadow: true });
  const flat = k.add(F, 'box', eye, 0, -0.07, frontZ(P, 0, -0.07), 0.06, 0.012, 0.012, 0, { basic: true, noShadow: true });
  const o = k.add(F, 'tor', eye, 0, -0.075, frontZ(P, 0, -0.075), 0.06, 0.07, 0.06, 0, { basic: true, noShadow: true });
  P.setMood = m => {
    smile.visible = m === 'ok' || m === 'idle' || m === 'err'; flat.visible = m === 'work'; o.visible = m === 'wait';
    smile.rotation.z = m === 'err' ? 0 : PI; smile.position.y = m === 'err' ? -0.085 : -0.05; smile.scale.setScalar(m === 'ok' ? 1.3 : 0.9);
    const a = { idle: 0, work: 0.28, wait: -0.3, ok: -0.12, err: -0.45 }[m] || 0;
    brows[0].rotation.z = -a; brows[1].rotation.z = a; brows.forEach(b => b.position.y = m === 'wait' ? 0.14 : m === 'work' ? 0.105 : 0.12);
    P.eyes.forEach(e => { e.scale.y = m === 'ok' ? 0.025 : 0.065; e.position.y = m === 'wait' ? ey + 0.012 : ey; });
  };
}

// ───────────────────────── Chat-Figur mit Werkzeug-Kennung ─────────────────────────
function roleColors(L, role) { const main = tone(L, role); return { main, dark: shade(main, -0.24), light: shade(main, 0.16), white: white(L), ink: ink(L), metal: '#8A929C' }; }
function dressRole(k, L, P) { // Berufskleidung: Rolle = Kleidung + Werkzeug in der Hand (Figur:B + C)
  return role => {
    if (P.role === role) return; P.role = role; P.hat.clear(); P.outfit.clear(); P.hand.clear();
    const shirt = role ? k.m(tone(L, role)) : k.m(L.body);
    P.torso.material = P.armL.userData.mesh.material = P.armR.userData.mesh.material = shirt;
    P.head.children.filter(c => c.userData.wear).forEach(c => P.head.remove(c));
    if (!role || !WEAR[role]) return;
    const c = roleColors(L, role);
    const before = P.head.children.length; WEAR[role](k, L, P, c); P.head.children.slice(before).forEach(ch => ch.userData.wear = true);
    if (PROP[role]) PROP[role](k, L, P.hand, c);
  };
}
function figChat(k, L, o) {
  const F = k.V.figur || 'C', tool = o.tool || 'Claude', T = TOOL[tool];
  const pantsCol = L.cast === 'metal' ? '#24242A' : L.dark ? '#1C2541' : L.prop2;
  const shirt = F === 'A' ? k.m(T.main) : k.m(L.body), pants = F === 'A' ? k.m(T.dark) : k.m(pantsCol);
  const P = baseBody(k, L, { ...o, shirt, pants, shoes: ink(L) });
  P.tool = tool;
  if (F === 'A') { // Farbfamilie: ganze Kleidung in Werkzeug-Farbe, Rolle nur als Hut
    hair(k, L, P, T.dark);
    if (tool === 'Codex') { const c = k.add(P.toolkit, 'tor', T.light, 0, 0.87, 0, 0.34, 0.34, 0.4, 0, { noShadow: true }); c.rotation.x = PI / 2; k.add(P.toolkit, 'box', T.accent, 0, 0.68, P.front + 0.012, 0.05, 0.3, 0.02, 0, { noShadow: true }); }
    else if (tool === 'Gemini') { P.torso.visible = false; const c2 = k.m(T.light); [[shirt, 0], [c2, PI]].forEach(([mm, th]) => k.add(P.rig, new THREE.CylinderGeometry(0.19, 0.17, 0.44, 16, 1, false, th, PI), null, 0, 0.66, 0, 1, 1, 0.85, 0, { mat: mm })); P.armR.userData.mesh.material = c2; }
    else { [P.armL, P.armR].forEach(a => k.add(a, 'tor', T.light, 0, -0.27, 0, 0.17, 0.17, 0.17, 0, { noShadow: true }).rotation.x = PI / 2); }
    P.setRole = role => { if (P.role === role) return; P.role = role; P.hat.clear(); if (role && HAT[role]) HAT[role](k, tone(L, role), P.hat); };
    return P;
  }
  if (F === 'B') { // Ein Accessoire: Berufskleidung bleibt
    hair(k, L, P, shade(T.main, -0.25));
    if (tool === 'Claude') { const t = k.add(P.toolkit, 'tor', T.dark, 0, 0.9, 0, 0.34, 0.34, 0.6, 0, { noShadow: true }); t.rotation.x = PI / 2; emblem(k, P.toolkit, tool, -0.1, 0.78, P.front + 0.02, 0.085); }
    else if (tool === 'Codex') { const hood = k.add(P.head, 'half', T.main, 0, 0.0, -0.1, P.hr * 1.12, P.hr * 1.0, P.hr * 1.12); hood.rotation.x = 0.55; [-0.082, 0.082].forEach(x => k.add(P.head, 'box', '#111318', x, 0.03, frontZ(P, x, 0.03) + 0.012, 0.11, 0.09, 0.02, 0, { noShadow: true, opacity: 0.85 })); k.add(P.head, 'box', '#111318', 0, 0.03, frontZ(P, 0, 0.03) + 0.014, 0.05, 0.014, 0.014, 0, { noShadow: true }); }
    else { const band = k.add(P.head, 'tor', T.main, 0, 0.1, 0, P.hr * 1.0, P.hr * 1.0, P.hr * 0.8, 0, { noShadow: true }); band.rotation.x = PI / 2 - 0.2; k.add(P.head, 'box', T.light, 0.12, 0.34, 0.02, 0.26, 0.055, 0.04, 0, { noShadow: true, emissive: T.light }); k.add(P.head, 'box', T.light, 0.12, 0.34, 0.02, 0.055, 0.26, 0.04, 0, { noShadow: true, emissive: T.light }); scarf(k, P, T.main, P.toolkit); }
    P.setRole = dressRole(k, L, P);
    return P;
  }
  // Figur:C – Teamfarbe + Emblem: Kragen, Ärmelbündchen, Haar in Werkzeug-Farbe, Brust-Emblem
  hair(k, L, P, T.main);
  const col = k.add(P.toolkit, 'tor', T.main, 0, 0.89, 0, 0.36, 0.36, 0.46, 0, { noShadow: true }); col.rotation.x = PI / 2;
  [P.armL, P.armR].forEach(a => k.add(a, 'tor', T.main, 0, -0.27, 0, 0.17, 0.17, 0.17, 0, { noShadow: true }).rotation.x = PI / 2);
  emblem(k, P.toolkit, tool, 0.0, 0.79, P.front + 0.02, 0.06);
  P.setRole = dressRole(k, L, P);
  return P;
}
// Helfer (Subagent): Opus größer + violett, Sonnet kleiner + teal; nur der ändernde Agent hat einen Schraubenschlüssel
function figSub(k, L, o) {
  const A = o.agent || { model: 'Sonnet', edits: false }, op = A.model === 'Opus', C = SUB[op ? 'Opus' : 'Sonnet'];
  const P = baseBody(k, L, { ...o, scale: (o.scale || 0.82) * (op ? 1.04 : 0.96), shirt: k.m(C.main), pants: k.m(C.dark), shoes: ink(L) });
  const c = { main: C.main, dark: C.dark, light: C.light, white: white(L), metal: L.dark ? '#B8C2D0' : '#7D8794', ink: ink(L) };
  k.add(P.head, 'half', C.dark, 0, P.hr * 0.12, 0, P.hr * 1.04, P.hr * 0.7, P.hr * 1.04); // Mütze
  k.add(P.head, 'sph', C.light, 0, P.hr * 0.5, 0, 0.09, 0.09, 0.09, 0, { emissive: C.light });
  if (A.edits) { const b = k.add(P.toolkit, 'tor', '#7A5A3A', 0, 0.47, 0, 0.4, 0.4, 0.4, 0, { noShadow: true }); b.rotation.x = PI / 2; PROP.wrench(k, L, P.hand, c); } else PROP.lens(k, L, P.hand, c);
  P.halo = k.add(P.root, 'tor', C.light, 0, 0.03, 0, 0.8, 0.8, 0.8, 0, { noShadow: true, emissive: C.light }); P.halo.rotation.x = PI / 2;
  P.setRole = () => {}; P.sub = true;
  return P;
}
function figPlayer(k, L, o) {
  const P = baseBody(k, L, { ...o, scale: (o.scale || 1) * 1.06, shirt: k.m(L.body), pants: k.m(L.cast === 'metal' ? '#24242A' : L.dark ? '#1C2541' : L.prop2), shoes: ink(L) });
  hair(k, L, P, ink(L)); coat(k, P, L.player, L.cast === 'metal' ? '#F2E6C9' : white(L)); PROP.coffee(k, L, P.hand, { white: white(L) });
  const r = k.add(P.root, 'tor', L.player, 0, 0.03, 0, 1.1, 1.1, 1.1, 0, { noShadow: true }); r.rotation.x = PI / 2;
  P.setRole = () => {};
  return P;
}

// ───────────────────────── Fabrik ─────────────────────────
// opt: kind (chat|sub|player), tool (Claude|Codex|Gemini), agent ({model, edits}), skin, scale
export function makePerson(k, L, opt = {}) {
  const o = { kind: 'chat', skin: L.skin[0], ...opt };
  if (k.V && k.V.cube) return makeCube(k, L, o);   // v3: Würfel-Wesen
  const P = o.kind === 'sub' ? figSub(k, L, o) : o.kind === 'player' ? figPlayer(k, L, o) : figChat(k, L, o);
  faceComic(k, L, P); P.setMood('idle');
  (P.eyes || []).forEach(e => e.userData.sy = e.scale.y);
  k.blob(P.root, o.kind === 'sub' ? 0.36 : 0.46);
  P.lockMood = null;
  P.root.traverse(m => { if (m.isMesh) m.userData.person = P; });
  return P;
}

// Bewegung je Zustand, zeitbasiert geglättet (kein Ruck bei Zustandswechsel); ratio = Anteil des Lauftempos (Anfahren, Bremsen).
// Laufen: Schritt + Armschwung gegengleich, Hüpfer bei geschlossenen Beinen mit Squash/Stretch, leichte Vorlage, Schulterschwung ·
// Arbeiten: Tippen, Nicken, Gewicht verlagern · Reden: Gesten · Warten: Gewicht verlagern, umschauen · Jubel: Hüpfer mit V-Armen.
// Laufanteil P.gait blendet Lauf- und Standpose weich ineinander (≈ 0,15 s).
export function animatePerson(P, state, dt, L, ratio = 1) {
  if (P.tick) P.tick(dt);
  const moving = state === 'walk' || state === 'run', run = state === 'run';
  P.gait ??= moving ? 1 : 0; P.gait += ((moving ? 1 : 0) - P.gait) * Math.min(1, dt * 7);
  P.sc ??= P.rig.scale.x; P.z0 ??= [P.armL.rotation.z, P.armR.rotation.z];
  const g = P.gait, r = moving ? clamp(ratio, 0.15, 1) : 0;
  P.phase += dt * (moving ? (run ? 7 : 5) * (1 + r) : 3);
  const ph = P.phase, s = Math.sin(ph), ac = Math.abs(Math.cos(ph)), hop = L && L.hop ? 0.2 : 0.065;
  const amp = (run ? 0.85 : 0.6) * (0.35 + 0.65 * r);
  // Laufpose (Gewicht g) · Standpose I (Gewicht 1 − g); z = Arm seitlich (positiv = nach außen)
  const W = { lL: s * amp, lR: -s * amp, aL: -s * amp * 0.8, aR: s * amp * 0.8, zL: s * 0.06, zR: s * 0.06, bob: ac * hop, sq: 1 + (ac - 0.5) * 0.06, lean: 0.05 + 0.07 * r, sway: s * 0.045, twist: -s * 0.06 };
  const I = { lL: 0, lR: 0, aL: 0.05, aR: -0.05, zL: 0, zR: 0, bob: Math.sin(ph * 0.6) * 0.01, sq: 1 + Math.sin(ph * 0.6) * 0.012, lean: 0, sway: Math.sin(ph * 0.23) * 0.015, twist: 0 };
  if (state === 'work') { I.aL = -1.0 + Math.sin(ph * 3.3) * 0.14; I.aR = -1.0 + Math.sin(ph * 3.3 + 2.1) * 0.14; I.zL = Math.sin(ph * 3.3 + 0.7) * 0.05; I.zR = -Math.sin(ph * 3.3 + 2.8) * 0.05; I.lean = 0.07 + Math.sin(ph * 0.8) * 0.03; I.sway = Math.sin(ph * 0.5) * 0.02; I.bob = Math.sin(ph * 1.65) * 0.01; }
  else if (state === 'talk') { I.aR = -1.9 + Math.sin(ph * 1.7) * 0.35; I.aL = 0.1 + Math.sin(ph * 1.1) * 0.1; I.zR = 0.12 + Math.sin(ph * 1.3) * 0.08; I.lean = 0.03 + Math.sin(ph * 0.9) * 0.03; I.twist = Math.sin(ph * 0.7) * 0.06; I.bob = Math.sin(ph) * 0.01; }
  else if (state === 'wait') { I.aL = 0.25; I.aR = -0.25; I.zL = 0.06; I.zR = 0.06; I.bob = Math.sin(ph * 0.7) * 0.012; I.sq = 1 + Math.sin(ph * 0.7) * 0.02; I.sway = Math.sin(ph * 0.5) * 0.04; I.twist = Math.sin(ph * 0.35) * 0.08; }
  else if (state === 'cheer') { const j = Math.abs(Math.sin(ph * 1.5)); I.aL = -2.7 + Math.sin(ph * 4) * 0.2; I.aR = -2.7 - Math.sin(ph * 4) * 0.2; I.zL = 0.25; I.zR = 0.25; I.bob = j * 0.14; I.sq = 1 + (j - 0.5) * 0.08; I.twist = Math.sin(ph * 1.5) * 0.1; I.lL = -j * 0.25; I.lR = -j * 0.25; }
  else if (!moving && P.hand && P.hand.children.length) I.aR = -0.55;
  if (P.card && P.card.visible && state !== 'work') I.aR = -0.9;
  const mix = key => W[key] * g + I[key] * (1 - g), k = 1 - Math.exp(-dt * 14);
  P.legL.rotation.x += (mix('lL') - P.legL.rotation.x) * k; P.legR.rotation.x += (mix('lR') - P.legR.rotation.x) * k;
  P.armL.rotation.x += (mix('aL') - P.armL.rotation.x) * k; P.armR.rotation.x += (mix('aR') - P.armR.rotation.x) * k;
  P.armL.rotation.z += (P.z0[0] - mix('zL') - P.armL.rotation.z) * k; P.armR.rotation.z += (P.z0[1] + mix('zR') - P.armR.rotation.z) * k;
  const sq = mix('sq');
  P.rig.position.y = mix('bob'); P.rig.scale.set(P.sc / Math.sqrt(sq), P.sc * sq, P.sc / Math.sqrt(sq)); P.rig.rotation.set(mix('lean'), mix('twist'), mix('sway'));
  if (P.halo) P.halo.rotation.z += dt * 1.2;
  const mood = P.lockMood || (state === 'work' ? 'work' : state === 'cheer' ? 'ok' : 'idle');
  if (mood !== P.mood) { P.mood = mood; P.setMood(mood); }
  if (P.eyes && P.mood !== 'ok') { P.blink -= dt; const closed = P.blink < 0.12; P.eyes.forEach(e => { e.scale.y = closed ? 0.012 : e.userData.sy; }); if (P.blink < 0) P.blink = 2.5 + Math.random() * 3; }
}

// ───────────────────────── v3: Würfel-Wesen (Vorlagen des Users, 2026-10-14) ─────────────────────────
// Körper = weicher Würfel (Gelee, Ton oder Satin), Gesicht als Canvas auf der Vorderseite, kurze Arme mit Fäustlingen,
// kurze Beine (Stiefel je Variante). Werkzeug = Körperfarbe + Fäustlinge + Emblem, Rolle = Hut + Requisit (+ Band/Fäustlinge).
export const CUBE = {
  Claude: { body: '#F6A07F', accent: '#C2577F', emblem: '✳' },
  Codex: { body: '#7FDDB5', accent: '#2F3A45', emblem: '>_' },
  Gemini: { body: '#8DB2FF', accent: '#8A62C9', emblem: '✦' },
  Du: { body: '#5ED3E2', accent: '#3B5BDB', emblem: '' },
  Lotse: { body: '#FFA6CF', accent: '#7B5CD6', emblem: '' },
  Opus: { body: '#BBA3F2', accent: '#6B4FB8', emblem: '' },
  Sonnet: { body: '#8FDCEB', accent: '#23889A', emblem: '' },
};
const FACE_INK = '#3A2620', MOUTH = '#7A2240', TONGUE = '#FF8FA3', BLUSH = 'rgba(255,120,150,.5)';
const faceCache = new Map();
// style: glanz (Vorlage 1: Glanzaugen, Brauen, offener Mund) · knopf (Vorlage 3: Knopfaugen, offener Mund) · bogen (Vorlage 2: Lächelbögen)
export function drawFace(style, mood, closed, emblem, sparkle) {
  const id = [style, mood, closed, emblem, sparkle].join('|'); if (faceCache.has(id)) return faceCache.get(id);
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.lineCap = 'round'; x.lineJoin = 'round';
  const E = [[86, 102], [170, 102]], happy = mood === 'ok', shut = closed || happy;
  x.fillStyle = BLUSH; [[48, 150], [208, 150]].forEach(([bx, by]) => { x.beginPath(); x.ellipse(bx, by, 22, 13, 0, 0, 2 * PI); x.fill(); });
  if (shut) { x.strokeStyle = FACE_INK; x.lineWidth = 9; E.forEach(([ex, ey]) => { x.beginPath(); if (happy) x.arc(ex, ey + 12, 20, PI * 1.15, PI * 1.85); else { x.moveTo(ex - 20, ey + 6); x.lineTo(ex + 20, ey + 6); } x.stroke(); }); }
  else if (style === 'glanz') E.forEach(([ex, ey]) => {
    const dy = mood === 'work' ? 7 : mood === 'wait' ? -3 : 0;
    x.fillStyle = '#FFFFFF'; x.beginPath(); x.ellipse(ex, ey, 31, 38, 0, 0, 2 * PI); x.fill(); x.lineWidth = 4; x.strokeStyle = FACE_INK; x.stroke();
    x.fillStyle = '#5A3420'; x.beginPath(); x.arc(ex + 2, ey + 6 + dy, 22, 0, 2 * PI); x.fill();
    x.fillStyle = '#120A07'; x.beginPath(); x.arc(ex + 2, ey + 6 + dy, 12, 0, 2 * PI); x.fill();
    x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(ex + 10, ey - 4 + dy, 8, 0, 2 * PI); x.fill(); x.beginPath(); x.arc(ex - 6, ey + 15 + dy, 4, 0, 2 * PI); x.fill();
  });
  else if (style === 'knopf') E.forEach(([ex, ey]) => { x.fillStyle = '#1A1210'; x.beginPath(); x.ellipse(ex, ey + 8, 15, 18, 0, 0, 2 * PI); x.fill(); x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(ex + 5, ey + 2, 5, 0, 2 * PI); x.fill(); });
  else E.forEach(([ex, ey]) => { x.fillStyle = '#22303A'; x.beginPath(); x.arc(ex, ey - 4, 23, 0, PI); x.closePath(); x.fill(); x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(ex + 9, ey + 4, 5, 0, 2 * PI); x.fill(); });
  const browA = { idle: 0, work: 0.24, wait: -0.3, ok: -0.1, err: -0.42 }[mood] || 0;
  if (style === 'glanz' || mood !== 'idle') {
    x.strokeStyle = style === 'glanz' ? '#5B3A24' : FACE_INK; x.lineWidth = style === 'glanz' ? 12 : 8;
    E.forEach(([ex, ey], i) => { const s = i ? 1 : -1, by = ey - (style === 'glanz' ? 56 : 42) - (mood === 'wait' ? 8 : 0); x.save(); x.translate(ex, by); x.rotate(-s * browA); x.beginPath(); x.moveTo(-20, 5); x.quadraticCurveTo(0, -8, 20, 5); x.stroke(); x.restore(); });
  }
  const mx = 128, my = 170; x.strokeStyle = FACE_INK; x.lineWidth = 7;
  if (mood === 'work') { x.beginPath(); x.moveTo(mx - 16, my); x.quadraticCurveTo(mx, my + 7, mx + 16, my); x.stroke(); }
  else if (mood === 'wait') { x.fillStyle = MOUTH; x.beginPath(); x.ellipse(mx, my + 2, 11, 14, 0, 0, 2 * PI); x.fill(); }
  else if (mood === 'err') { x.beginPath(); x.moveTo(mx - 24, my + 12); x.quadraticCurveTo(mx, my - 10, mx + 24, my + 12); x.stroke(); x.fillStyle = '#7CC8F5'; x.beginPath(); x.moveTo(216, 62); x.quadraticCurveTo(230, 88, 216, 94); x.quadraticCurveTo(202, 88, 216, 62); x.fill(); }
  else if (style === 'bogen') { x.lineWidth = 9; x.beginPath(); x.arc(mx, my - 30, happy ? 44 : 40, PI * 0.18, PI * 0.82); x.stroke(); }
  else {
    const w = style === 'knopf' ? 36 : 30, h = happy ? 36 : 28;
    x.fillStyle = MOUTH; x.beginPath(); x.moveTo(mx - w, my - 8); x.quadraticCurveTo(mx, my - 2, mx + w, my - 8); x.quadraticCurveTo(mx + w * 0.85, my + h, mx, my + h); x.quadraticCurveTo(mx - w * 0.85, my + h, mx - w, my - 8); x.fill();
    x.save(); x.clip(); x.fillStyle = TONGUE; x.beginPath(); x.ellipse(mx + 4, my + h - 2, w * 0.6, 13, 0, 0, 2 * PI); x.fill(); x.restore();
  }
  if (sparkle) { x.fillStyle = 'rgba(255,255,255,.92)'; [[36, 212, 11], [220, 200, 8]].forEach(([sx, sy, r]) => { x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * PI / 4, rr = i % 2 ? r * 0.32 : r; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } x.closePath(); x.fill(); }); }
  if (emblem) { x.fillStyle = 'rgba(255,255,255,.94)'; x.beginPath(); x.arc(128, 228, 21, 0, 2 * PI); x.fill(); x.fillStyle = FACE_INK; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = emblem === '>_' ? '800 18px "JetBrains Mono", monospace' : '800 27px system-ui, sans-serif'; x.fillText(emblem, 128, 230); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; faceCache.set(id, t); return t;
}
let CUBE_GEO = null;
function cubeMat(k, color, finish) {
  const id = 'cube|' + color + '|' + finish; if (k.cache2.has(id)) return k.cache2.get(id);
  const m = finish === 'clay' ? new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0 })
    : new THREE.MeshPhysicalMaterial({ color, roughness: finish === 'satin' ? 0.46 : 0.24, metalness: 0, clearcoat: finish === 'satin' ? 0.55 : 1, clearcoatRoughness: 0.12, sheen: 0.5, sheenRoughness: 0.4, sheenColor: new THREE.Color(shade(color, 0.2)) });
  k.cache2.set(id, m); return m;
}
function makeCube(k, L, o) {
  const V = k.V.cube, kind = o.kind || 'chat', finish = V.finish || 'jelly', limbFinish = finish === 'clay' ? 'clay' : 'satin';
  const who = o.who || (kind === 'player' ? 'Du' : kind === 'sub' ? ((o.agent && o.agent.model) === 'Opus' ? 'Opus' : 'Sonnet') : (o.tool || 'Claude'));
  const C = CUBE[who] || CUBE.Claude, sc = (o.scale || 1) * (kind === 'sub' ? 0.78 : kind === 'player' ? 1.06 : 1);
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig); rig.scale.setScalar(sc);
  const P = { root, rig, kind, cube: true, phase: Math.random() * 6, role: null, mood: 'idle', blink: 2 + Math.random() * 3, closed: false, hr: 0.5, headShape: 'box' };
  const BW = 0.7, BH = 0.66, BD = 0.6, LEG = 0.3;
  const accentLimbs = V.limbs === 'accent' || kind !== 'chat';
  const limbMat = cubeMat(k, accentLimbs ? C.accent : shade(C.body, -0.1), limbFinish);
  P.hips = new THREE.Group(); P.hips.position.y = LEG; rig.add(P.hips);
  const legGeo = new THREE.CapsuleGeometry(0.085, 0.12, 4, 10), armGeo = new THREE.CapsuleGeometry(0.066, 0.14, 4, 10);
  const limb = (geo, mat, x, y, len, par) => { const p = new THREE.Group(); p.position.set(x, y, 0); const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; m.position.y = -len / 2; p.add(m); p.userData.mesh = m; par.add(p); return p; };
  const legMat = cubeMat(k, shade(C.body, -0.12), limbFinish);
  P.legL = limb(legGeo, legMat, -0.15, 0, 0.26, P.hips); P.legR = limb(legGeo, legMat, 0.15, 0, 0.26, P.hips);
  const bootMat = cubeMat(k, V.boots || kind === 'player' ? C.accent : shade(C.body, -0.24), limbFinish);
  [P.legL, P.legR].forEach(l => k.add(l, 'box', null, 0, -0.27, 0.03, 0.2, 0.1, 0.25, 0, { mat: bootMat }));
  CUBE_GEO ||= new RoundedBoxGeometry(BW, BH, BD, 5, 0.17);
  const body = new THREE.Mesh(CUBE_GEO, cubeMat(k, C.body, finish)); body.position.y = LEG + BH / 2; body.castShadow = body.receiveShadow = true; rig.add(body); P.torso = body; P.front = BD / 2;
  const sy = LEG + BH * 0.42;
  P.armL = limb(armGeo, limbMat, -(BW / 2 + 0.06), sy, 0.2, rig); P.armR = limb(armGeo, limbMat, BW / 2 + 0.06, sy, 0.2, rig);
  P.armL.rotation.z = -0.18; P.armR.rotation.z = 0.18;
  const mittMat = cubeMat(k, C.accent, limbFinish);
  P.mitts = [P.armL, P.armR].map(a => k.add(a, 'sph', null, 0, -0.23, 0, 0.21, 0.21, 0.21, 0, { mat: mittMat }));
  P.hand = new THREE.Group(); P.hand.position.y = -0.24; P.armR.add(P.hand);
  P.face = new THREE.Mesh(new THREE.PlaneGeometry(BW * 0.86, BH * 0.86), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false }));
  P.face.position.set(0, LEG + BH / 2, BD / 2 + 0.006); rig.add(P.face);
  P.head = new THREE.Group(); P.head.position.y = LEG + BH; rig.add(P.head);
  // Hüte sind für den Rundkopf gebaut (Basis knapp unter dem Scheitel): auf dem Würfel etwas versenkt und breiter, damit Bänder,
  // Ringe und Krempen die Oberkante umfassen statt darüber zu schweben
  P.hat = new THREE.Group(); P.hat.position.y = -0.14; P.hat.scale.set(1.8, 1.35, 1.7); P.head.add(P.hat);
  P.outfit = new THREE.Group(); rig.add(P.outfit);
  if (V.band && kind === 'chat') { P.band = k.add(rig, 'box', null, 0, LEG + 0.11, 0, BW + 0.02, 0.08, BD + 0.02, 0, { mat: cubeMat(k, '#FFFFFF', 'satin') }); P.band.visible = false; }
  P.card = new THREE.Group(); P.card.position.set(0, -0.28, 0.08); P.armR.add(P.card); P.card.visible = false;
  k.add(P.card, 'box', L.prop, 0, 0, 0, 0.26, 0.18, 0.02, 0, { noShadow: true });
  P.stripe = k.add(P.card, 'box', L.ink, 0, 0.065, 0.012, 0.26, 0.05, 0.005, 0, { noShadow: true });
  P.setCard = (on, color) => { P.card.visible = on; P.hand.visible = !on; if (color) P.stripe.material = k.m(color); };
  const emblem = kind === 'chat' ? C.emblem : '';
  P.draw = () => { P.face.material.map = drawFace(V.face, P.mood, P.closed, emblem, !!V.sparkle); P.face.material.needsUpdate = true; };
  P.setMood = m => { P.mood = m; P.draw(); };
  P.tick = dt => { P.blink -= dt; const c = P.blink < 0.12 && P.mood !== 'ok'; if (c !== P.closed) { P.closed = c; P.draw(); } if (P.blink < 0) P.blink = 2.5 + Math.random() * 3; };
  P.setRole = role => {
    if (kind !== 'chat' || P.role === role) return; P.role = role; P.hat.clear(); P.hand.clear();
    if (role && HAT[role]) HAT[role](k, tone(L, role), P.hat);
    if (role === 'research') P.hat.children.slice(0, 2).forEach(c => { c.position.z = 0.2; });   // Schutzbrille vor die Vorderkante, sonst im Würfel
    if (role && PROP[role]) PROP[role](k, L, P.hand, roleColors(L, role));
    if (V.limbs === 'role') { const m = cubeMat(k, role ? tone(L, role, -0.06) : C.accent, limbFinish); P.mitts.forEach(mm => mm.material = m); }
    if (P.band) { P.band.visible = !!role; if (role) P.band.material = cubeMat(k, tone(L, role, -0.04), 'satin'); }
  };
  const c = { main: C.accent, dark: shade(C.accent, -0.15), light: shade(C.body, 0.15), white: '#FFFFFF', metal: '#7D8794', ink: '#26262B' };
  if (kind === 'sub') { ((o.agent && o.agent.edits) ? PROP.wrench : PROP.lens)(k, L, P.hand, c); P.halo = k.add(root, 'tor', C.body, 0, 0.03, 0, 0.78, 0.78, 0.78, 0, { noShadow: true, emissive: C.body }); P.halo.rotation.x = PI / 2; }
  if (kind === 'player') { PROP.coffee(k, L, P.hand, { white: '#FFFFFF' }); const r = k.add(root, 'tor', C.accent, 0, 0.03, 0, 1.05, 1.05, 1.05, 0, { noShadow: true }); r.rotation.x = PI / 2; }
  P.draw(); k.blob(root, kind === 'sub' ? 0.36 : 0.5); P.lockMood = null;
  root.traverse(m => { if (m.isMesh) m.userData.person = P; });
  return P;
}
