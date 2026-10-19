// Drei Zoom-Ebenen mit ruhiger Kamerafahrt: 1 Haus (Überblick) · 2 Bereich (Station) · 3 Detail (Objekt oder Figur).
// Flug ≈ 3–4,5 s auf glatter Bahn (smootherstep: Tempo und Beschleunigung an beiden Enden null, leichter Bogen nach oben,
// langsamer bei großem Schwenk oder langem Weg). Eine Dämpfungsschicht (kritisch gedämpfte Feder) glättet jeden Sprung
// des Ziels: unterbrochene Flüge, Folgen einer Figur, Rad-Zoom, Ziehen, Fenstergröße. prefers-reduced-motion → sofort am Ziel.
// Folgen einer Figur (Ebene 3) in drei Arten (Wahl des Users 2026-10-16: alle wählbar, Ansicht-Menü): ruhig (Standard) · schulter · regie.
import * as THREE from 'three';
import * as WF from './data/wf.js';

const ease = u => u * u * u * (u * (u * 6 - 15) + 10), dEase = u => 30 * u * u * (u - 1) * (u - 1);
const bis = (f, target) => { let lo = 0, hi = 0.5; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (f(m) < target) lo = m; else hi = m; } return lo; };   // f steigt auf [0, ½]
const angDiff = (a, b) => ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FLY = 3.0;       // Grunddauer eines Flugs in s
const SMOOTH = 0.3;    // Dämpfung der Kamera (smoothTime in s): folgt dem Flug, schluckt jeden Ruck
export const CAMS = ['ruhig', 'schulter', 'regie'];
const FOLLOW_SMOOTH = { ruhig: [0.6, 0.6], schulter: [0.35, 1.6], regie: [0.9, 1.4] };   // Folgen: smoothTime [Weg, Drehung] in s

// kritisch gedämpfte Feder (SmoothDamp): nähert cur an goal an, die Geschwindigkeit bleibt stetig, kein Überschwingen
function damp(cur, goal, vel, key, dt, smooth) {
  const w = 2 / smooth, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const ch = cur - goal, tmp = (vel[key] + w * ch) * dt;
  vel[key] = (vel[key] - w * tmp) * e;
  let out = goal + (ch + tmp) * e;
  if ((goal - cur > 0) === (out > goal)) { out = goal; vel[key] = 0; }
  return out;
}

export function createLevels({ camera, W, S, reduced }) {
  const [x0, z0, x1, z1] = W.lay.bounds, bw = x1 - x0, bd = z1 - z0;
  const pad = { x: 0, y: 0 };
  // Haus: Abstand so, dass das ganze Büro in die freie Fläche passt (Seitenverhältnis + Platz, den die Oberfläche braucht)
  function home() {
    const pitch = 0.88, tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), th = tv * camera.aspect;
    const freeW = Math.max(0.3, 1 - 2 * Math.abs(pad.x) - 0.04), freeH = Math.max(0.3, 1 - 2 * Math.abs(pad.y) - 0.08);
    const need = Math.max(bw * 1.04 / (2 * th * freeW), (bd * Math.sin(pitch) + 2.6 * Math.cos(pitch)) * 1.18 / (2 * tv * freeH));
    return { t: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2 + 0.6), yaw: 0.14, pitch, dist: clamp(need, 24, 60) };
  }
  const copy = v => ({ t: v.t.clone(), yaw: v.yaw, pitch: v.pitch, dist: v.dist });
  const cur = home(), goal = copy(cur), vel = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, dist: 0, uy: 0, up: 0, uz: 0 };
  const user = { yaw: 0, pitch: 0, zoom: 1 }, want = { yaw: 0, pitch: 0, zoom: 1 };
  let fly = null, follow = null, now = 0, speedNow = 0, camOk = false, padSnap = true;
  const prevCam = new THREE.Vector3(), padNow = { x: 0, y: 0 };   // Kamera-Tempo des letzten Bildes · weich nachgeführter Platz für die Oberfläche
  const camPos = v => new THREE.Vector3(v.t.x + Math.sin(v.yaw) * Math.cos(v.pitch) * v.dist, v.t.y + Math.sin(v.pitch) * v.dist, v.t.z + Math.cos(v.yaw) * Math.cos(v.pitch) * v.dist);
  const state = { level: 1, station: null, item: null, view: home() };

  function stationView(id) {
    const Z = W.st.get(id), [, x, z, w, d, rot] = Z.def, big = Math.max(w, d);
    return { t: new THREE.Vector3(x, 0.7, z), yaw: rot + 0.28, pitch: 0.6, dist: id === 'bench' ? 15 : clamp(big * 1.1 + 4.5, 8, 12) };
  }
  // Figur zum Eintrag: Chat (Mitarbeiter), Agent (Helfer in der Agentur), Fachrolle (Platz an der Werkbank)
  function actorOf(item) {
    if (item.type === 'chat') { const c = S.chats.find(x => x.id === item.id); return c && c.alive ? c.a : null; }
    if (item.type === 'agent') { const p = S.subPool && S.subPool.get(item.id); return p ? p.actor : null; }
    return null;
  }
  // Folge-Kamera: fs = Zustand (geglättetes Tempo der Figur, Stillstand, gemerkte Blickrichtung)
  let cam = 'ruhig';
  const fs = { vx: 0, vz: 0, px: null, pz: null, still: 0, yaw: null, hold: 0 };
  function followView(a, dt) {
    if (fs.px === null || !dt) { fs.px = a.x; fs.pz = a.z; fs.vx = 0; fs.vz = 0; }
    else { const rx = (a.x - fs.px) / dt, rz = (a.z - fs.pz) / dt, k = 1 - Math.exp(-dt / 0.35); fs.px = a.x; fs.pz = a.z; fs.vx += (rx - fs.vx) * k; fs.vz += (rz - fs.vz) * k; }
    const sp = Math.hypot(fs.vx, fs.vz), dir = Math.atan2(fs.vx, fs.vz);
    fs.still = sp < 0.15 ? fs.still + (dt || 0) : 0;
    if (cam === 'schulter') {   // hinter der Figur, dreht erst nach 0,5 s in neuer Richtung und dann weich; steht sie länger als 3 s, Blick schräg aufs Gesicht
      const behind = dir + Math.PI + 0.3;
      if (fs.yaw === null) fs.yaw = a.h + Math.PI + 0.3;
      if (sp > 0.4 && Math.abs(angDiff(fs.yaw, behind)) > 0.5) { fs.hold += dt || 0; if (fs.hold > 0.5) { fs.yaw = behind; fs.hold = 0; } } else fs.hold = 0;
      if (fs.still > 3) fs.yaw = a.h + 0.6;
      const la = Math.min(1, sp * 0.4);
      return { t: new THREE.Vector3(a.x + Math.sin(dir) * la, 0.9, a.z + Math.cos(dir) * la), yaw: fs.yaw, pitch: 0.38, dist: 4.6 };
    }
    if (cam === 'regie') {   // Figur und Ziel ihres Wegs zusammen im Bild, Blick quer zur Laufrichtung von der Raummitte her; am Ziel Nahaufnahme
      const end = a.path.length ? a.path[a.path.length - 1] : { x: a.x, z: a.z }, dx = end.x - a.x, dz = end.z - a.z, d = Math.hypot(dx, dz);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, toC = Math.atan2(cx - a.x, cz - a.z) + 0.3;
      if (fs.yaw === null) fs.yaw = toC;
      if (d < 1.5) { if (fs.still > 0.6) fs.yaw = toC; return { t: new THREE.Vector3(a.x, 0.85, a.z), yaw: fs.yaw, pitch: 0.42, dist: 4.4 }; }
      // Seite mit der kleineren Drehung; zur anderen nur, wenn sie deutlich näher an der Raummitte liegt (Hysterese 3 m, kein Umspringen, nie zur Wand)
      const side = Math.atan2(dx, dz) + Math.PI / 2, opt = [side, side + Math.PI], far = o => Math.hypot(a.x + Math.sin(o) * 6 - cx, a.z + Math.cos(o) * 6 - cz);
      const near = Math.abs(angDiff(fs.yaw, opt[0])) < Math.abs(angDiff(fs.yaw, opt[1])) ? 0 : 1;
      fs.yaw = far(opt[1 - near]) < far(opt[near]) - 3 ? opt[1 - near] : opt[near];
      const m = Math.min(2.5, d * 0.35);
      return { t: new THREE.Vector3(a.x + dx / d * m, 0.7, a.z + dz / d * m), yaw: fs.yaw - 0.25, pitch: 0.58, dist: clamp(4.8 + d * 0.55, 5.5, 11) };
    }
    // ruhig: Blickrichtung des Hauses (Norden bleibt oben), dreht nie von selbst; geht weich mit, schaut bis 1,6 m in Laufrichtung voraus
    const la = Math.min(1.6, sp * 0.7);
    return { t: new THREE.Vector3(a.x + Math.sin(dir) * la, 0.75, a.z + Math.cos(dir) * la), yaw: 0.59, pitch: 0.66, dist: 6.2 };
  }
  function itemView(item) {
    const a = actorOf(item);
    if (a) { fs.px = null; fs.yaw = null; fs.still = 0; return { ...followView(a, 0), follow: a }; }
    if (item.type === 'role' && WF.FACH.includes(item.id)) {
      const B = W.st.get('bench'), s = B.S.seats[WF.FACH.indexOf(item.id)], p = B.toW(s);
      return { t: new THREE.Vector3(p.x, 0.85, p.z), yaw: p.face + 0.3, pitch: 0.28, dist: 3.8 };
    }
    const Z = W.st.get(item.station || 'tresen'), [, x, z, , , rot] = Z.def;
    return { t: new THREE.Vector3(x, 1.0, z), yaw: rot + 0.42, pitch: 0.34, dist: 4.8 };
  }
  function viewFor(level, p) { return level === 1 ? home() : level === 2 ? stationView(p.station) : itemView(p.item); }

  function snap(to) { Object.assign(cur, copy(to)); Object.assign(goal, copy(to)); Object.assign(user, want); Object.keys(vel).forEach(k => { vel[k] = 0; }); fly = null; padSnap = true; }
  function go(level, p = {}, opt = {}) {
    const to = viewFor(level, p);
    const dl = Math.abs(level - state.level) || 1;
    state.level = level; state.station = level >= 2 ? p.station || (p.item && p.item.station) || state.station : null; state.item = level === 3 ? p.item : null; state.view = to;
    follow = to.follow || null; want.yaw = 0; want.pitch = 0; want.zoom = 1;
    if (opt.instant || reduced) { snap(to); return; }
    // Dauer wächst mit Schwenk (Anteil einer halben Drehung) und Weg: große Perspektivwechsel laufen langsamer
    const swing = Math.abs(angDiff(goal.yaw, to.yaw)) / Math.PI, way = Math.min(1.5, goal.t.distanceTo(to.t) / 20);
    const dur = clamp(FLY * (0.85 + 0.6 * swing + 0.35 * way + 0.15 * (dl - 1)), FLY * 0.85, FLY * 1.6);
    const lift = 0.22 * Math.max(goal.dist, to.dist) * (0.4 + 0.6 * Math.min(1, way * 2)), tilt = 0.1 * Math.min(1, swing * 1.5 + way);
    // Unterbrochener Flug: neue Bahn beginnt bei dem Fortschritt u0, an dem sie das aktuelle Kamera-Tempo hat (e′(u)/(1−e(u)) = v·dur/Weg),
    // mit virtuellem Startpunkt hinter dem Sollwert (nicht hinter der gedämpften Kamera: ihr Vorlauf bleibt, sonst sackt das Tempo kurz ab)
    let u0 = 0; const D = camPos(goal).distanceTo(camPos(to)), dy = angDiff(to.yaw, goal.yaw);
    if (speedNow > 0.3 && D > 1) { u0 = bis(u => dEase(u) / (1 - ease(u)), speedNow * dur / D); const maxE = 1 - Math.abs(dy) / (0.9 * Math.PI); if (maxE <= 0) u0 = 0; else if (ease(u0) > maxE) u0 = bis(ease, maxE); }
    const e0 = ease(u0), arc0 = Math.sin(Math.PI * e0), kk = 1 / (1 - e0);
    const from = { t: goal.t.clone().addScaledVector(to.t, -e0).multiplyScalar(kk), yaw: to.yaw + dy * kk, pitch: to.pitch + (goal.pitch - arc0 * tilt - to.pitch) * kk, dist: to.dist + (goal.dist - arc0 * lift - to.dist) * kk };
    fly = { from, to, t0: now - u0 * dur, dur, lift, tilt };
  }
  // Zwischenbild eines Flugs (auch Vorschau-Aufnahme „Kamerafahrt“): u = 0 … 1; Bogen hängt am Fortschritt, nicht an der Zeit
  function sample(from, to, u, lift = 0.22 * Math.max(from.dist, to.dist), tilt = 0) {
    const e = ease(u), arc = Math.sin(Math.PI * e);
    return { t: from.t.clone().lerp(to.t, e), yaw: from.yaw + angDiff(from.yaw, to.yaw) * e, pitch: from.pitch + (to.pitch - from.pitch) * e + arc * tilt,
      dist: from.dist + (to.dist - from.dist) * e + arc * lift };
  }
  function update(dt) {
    now += dt;
    if (fly) { const u = Math.min(1, (now - fly.t0) / fly.dur); Object.assign(goal, sample(fly.from, fly.to, u, fly.lift, fly.tilt)); if (u >= 1) fly = null; }
    else {
      const v = state.level === 1 ? home() : state.view;   // Haus je Bild neu: reagiert auf Fenster und Oberfläche
      const f = follow ? followView(follow, dt) : v;
      goal.t.copy(f.t); goal.yaw = f.yaw; goal.pitch = f.pitch; goal.dist = f.dist;
    }
    if (reduced || padSnap) { padNow.x = pad.x; padNow.y = pad.y; padSnap = false; }
    else { padNow.x = damp(padNow.x, pad.x, vel, 'px', dt, 0.6); padNow.y = damp(padNow.y, pad.y, vel, 'py', dt, 0.6); }
    if (reduced) { Object.assign(cur, copy(goal)); Object.assign(user, want); return; }
    if (dt > 0 && camOk) speedNow = Math.min(80, camera.position.distanceTo(prevCam) / dt); prevCam.copy(camera.position); camOk = true;
    const FS = FOLLOW_SMOOTH[cam], s = follow && !fly ? FS[0] : SMOOTH;
    cur.t.x = damp(cur.t.x, goal.t.x, vel, 'x', dt, s); cur.t.y = damp(cur.t.y, goal.t.y, vel, 'y', dt, s); cur.t.z = damp(cur.t.z, goal.t.z, vel, 'z', dt, s);
    cur.yaw = damp(cur.yaw, cur.yaw + angDiff(cur.yaw, goal.yaw), vel, 'yaw', dt, follow && !fly ? FS[1] : s);
    cur.pitch = damp(cur.pitch, goal.pitch, vel, 'pitch', dt, s); cur.dist = damp(cur.dist, goal.dist, vel, 'dist', dt, s);
    user.yaw = damp(user.yaw, want.yaw, vel, 'uy', dt, 0.18); user.pitch = damp(user.pitch, want.pitch, vel, 'up', dt, 0.18); user.zoom = damp(user.zoom, want.zoom, vel, 'uz', dt, 0.32);
  }
  const right = new THREE.Vector3(), up = new THREE.Vector3();
  function apply(v = cur) {
    const yaw = v.yaw + user.yaw, pitch = clamp(v.pitch + user.pitch, 0.1, 1.35), dist = v.dist * user.zoom, cp = Math.cos(pitch);
    camera.position.set(v.t.x + Math.sin(yaw) * cp * dist, v.t.y + Math.sin(pitch) * dist, v.t.z + Math.cos(yaw) * cp * dist);
    camera.lookAt(v.t);
    // Platz für die Oberfläche: Szene in die freie Fläche schieben (pad = Anteil der Bildbreite/-höhe; x > 0 → Szene nach links);
    // padNow folgt dem Sollwert gedämpft, damit ein Ebenenwechsel die Szene nicht seitlich springen lässt
    if (padNow.x || padNow.y) {
      const hH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hW = hH * camera.aspect;
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
      camera.position.addScaledVector(right, padNow.x * hW).addScaledVector(up, -padNow.y * hH);
    }
    camera.updateMatrixWorld();   // lookAt() hat die Matrix vor dem Versatz festgehalten: ohne Neuberechnung projizieren Pin, Schilder und Treffer-Strahl daneben
  }
  return {
    state, go, update, apply, sample, home, stationView, itemView, cur, user, pad, padNow,
    flying: () => !!fly,
    setCam(m) { if (CAMS.includes(m)) { cam = m; fs.yaw = null; } }, cam: () => cam,
    drag(dx, dy) { want.yaw = clamp(want.yaw - dx * 0.005, -1.2, 1.2); want.pitch = clamp(want.pitch + dy * 0.003, -0.35, 0.35); },
    zoom(sign) { want.zoom = clamp(want.zoom * (1 + sign * 0.1), 0.6, 1.5); },
    target: () => cur.t,
  };
}
