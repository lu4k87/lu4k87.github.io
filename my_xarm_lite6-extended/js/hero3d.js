/* Hero-Bühne der Projektseiten (Skill motion-viz §3): xArm Lite 6 (js/lite6_twin.js) auf Sockel mit Lichtringen,
   Laser-Zielhilfe senkrecht auf den Tisch; Ziehen dreht die Kamera. Szene je Seite (opts.scene):
     dome   Arbeitsraum als Punktkuppel (Reichweite 440 mm um Gelenk 2); Zeiger bewegt den TCP, sonst langsame Acht
     modes  Steuerwege als Lichtpunkte im Ring (opts.items); aktiver Punkt schickt einen Impuls zum Arm, der Arm zeigt hin
     ghost  Ghost-Arm plant voraus → Freigabe → Arm fährt nach („Erst virtuell, dann real“); Zeiger setzt das Ziel
     atlas  Funktionen als Punktring nach Bereichen (opts.areas: n je Bereich); Bereich unter dem Zeiger leuchtet
     cell   Arbeitsplatz: Tisch mit Raster, ZED Mini mit Sichtkegel, Greifobjekte, Korb; Zeiger bewegt den TCP
   Beschriftungen (modes, atlas) im Overlay (.h3d-lbl, css/landing.css): nur die aktive ist sichtbar und klickbar (Wunsch User
   04.10.2026), für Screenreader verborgen (die Seite nennt alle Einträge selbst). opts.onActive(i) meldet den aktiven Eintrag,
   opts.onPhase(key) die Ghost-Phase (plan, ok, run). Ohne WebGL/Netz bleibt das Bild der Seite; prefers-reduced-motion:
   Standbild. Rendert nur, solange sichtbar (Lite6.stage). Farben aus den Tokens von opts.wrap (Hero = .dark-zone).
   Klassisches Skript (läuft auch per file://, wo ES-Module aus Dateien gesperrt sind): window.Hero3D.init(THREE, addons, opts);
   three.js + Addons übergibt das Modul der Seite (Import-Map auf jsDelivr, Version wie src/http_robot_control_ui_p8081/lib/three). */
(function () {
'use strict';
let THREE, OrbitControls, toCreasedNormals;

const webgl = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
const CAM = {
  dome: { target: [0, 0, 0.21], camPos: [1.47, -1.13, 1.08] },
  modes: { target: [0, 0, 0.12], camPos: [1.86, -1.46, 1.42] },
  ghost: { target: [0.06, 0, 0.2], camPos: [1.32, -1.05, 0.86] },
  atlas: { target: [0, 0, 0.1], camPos: [1.84, -1.44, 1.5] },
  cell: { target: [0.18, 0, 0.1], camPos: [1.38, -1.12, 0.92] },
};

function init(three, addons, opts = {}) {
  THREE = three; ({ OrbitControls, toCreasedNormals } = addons);
  const L = window.Lite6, wrap = document.querySelector(opts.wrap || '#hero-stage'), host = document.querySelector(opts.host || '#hero3d');
  if (!L || !window.LITE6_MESH || !host || !wrap || !webgl()) return null;
  try { return build(L, wrap, host, opts); } catch (e) { console.warn('Hero-3D:', e); return null; }
}

function build(L, wrap, host, o) {
  const scene = o.scene || 'dome', cam = { ...CAM[scene], ...o.cam };
  const cs = getComputedStyle(wrap), tok = n => cs.getPropertyValue(n).trim();
  const ACC = new THREE.Color(tok('--accent') || '#2ee6c8'), ACC2 = new THREE.Color(tok('--indigo') || '#8ff3e1');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tick = () => {};
  const st = L.stage(THREE, host, { OrbitControls, target: cam.target, camPos: cam.camPos, fov: 32, minDist: 1.1, maxDist: 3.6, onFrame: (dt, t) => tick(dt, t) });
  st.controls.autoRotateSpeed = 0.3;
  st.scene.traverse(x => { if (x.isDirectionalLight && x.color.getHex() === 0x9cc8ff) x.color.copy(ACC2); });   // Gegenlicht im Akzent

  // ── Bausteine: weicher Lichtpunkt, Kreise, Linien, Schein ──
  const dot = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  })();
  const circle = (r, z, n = 160, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n }, (_, i) => { const a = a0 + (a1 - a0) * i / (n - 1 || 1); return new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), z); });
  const lineMat = (op, color = ACC) => new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false });
  const ring = (r, z, op) => new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle(r, z)), lineMat(op));
  const glowMat = (op, color = ACC) => new THREE.MeshBasicMaterial({ map: dot, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  const sprite = (size, op, color = ACC) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(size, size, 1); return s; };

  // ── Boden: Sockel mit Lichtringen (alle außer cell) oder Tisch mit Raster ──
  let dash = null;
  if (scene === 'cell') {
    const c = { ...L.tokens(), dark: true, line: tok('--line-strong') || '#3b4248', green: tok('--accent') || '#2ee6c8' };
    const k = L.kit(THREE), zed = k.makeZed(c), objs = k.makeObjects(), basket = k.makeBasket(0.2, 0.27);
    st.scene.add(L.table(THREE, c, [0.9, 0.8], [0.2, 0]), zed.group, basket, ...objs.map(x => x.mesh));
  } else {
    const ped = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.03, 96).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15191c, roughness: 0.5, metalness: 0.45 }));
    disc.position.z = -0.0155;
    dash = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle(0.47, -0.02, 240)),
      new THREE.LineDashedMaterial({ color: ACC, dashSize: 0.018, gapSize: 0.014, transparent: true, opacity: 0.55 }));
    dash.computeLineDistances();
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), glowMat(0.34));
    halo.position.z = -0.032;
    ped.add(disc, ring(0.405, 0.0005, 0.85), ring(0.29, 0.0005, 0.22), ring(0.18, 0.0005, 0.16), dash, halo);
    st.scene.add(ped);
  }

  // ── Roboter + Laser-Zielhilfe (Strahl vom TCP senkrecht auf den Tisch, Ring am Auftreffpunkt) ──
  const robot = L.buildRobot(THREE, { creased: toCreasedNormals,
    material: new THREE.MeshStandardMaterial({ color: 0xdfe5e7, roughness: 0.34, metalness: 0.2 }),
    toolMaterial: new THREE.MeshStandardMaterial({ color: 0x1b2023, roughness: 0.5 }) });
  const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lineMat(0.9));
  const spot = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.019, 40), new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  const spotGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), glowMat(0.7));
  st.scene.add(robot.group, beam, spot, spotGlow);
  const tcp = new THREE.Vector3();
  const place = () => {
    robot.tcp.getWorldPosition(tcp);
    const p = beam.geometry.attributes.position;
    p.setXYZ(0, tcp.x, tcp.y, tcp.z); p.setXYZ(1, tcp.x, tcp.y, 0.002); p.needsUpdate = true;
    beam.geometry.computeBoundingSphere();
    spot.position.set(tcp.x, tcp.y, 0.002); spotGlow.position.set(tcp.x, tcp.y, 0.0015);
  };

  // ── Zielführung: Ziel = TCP auf Höhe Z über dem Tisch, Radius 170–320 mm; Gelenke folgen gedämpft ──
  const Z = 0.1, hit = new THREE.Vector3(), ndc = new THREE.Vector2(), ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z);
  const solve = (x, y, seed) => { const r = Math.hypot(x, y); if (r < 1e-3) return null; const rc = Math.min(0.32, Math.max(0.17, r)); return L.ikDown(x / r * rc, y / r * rc, Z, 0, seed); };
  const toward = (a, r = 0.28) => [r * Math.cos(a), r * Math.sin(a)];
  const idle = t => { const a = t / 16000 * Math.PI * 2; return [0.25 + 0.05 * Math.sin(2 * a), 0.16 * Math.sin(a)]; };
  let q = L.HOME.slice(), goal = q.slice(), follow = false;
  const aim = (x, y) => { const s = solve(x, y, goal); if (s) goal = s; };
  const pointerPlane = e => {
    const r = host.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2);
    ray.setFromCamera(ndc, st.camera);
    return ray.ray.intersectPlane(plane, hit) ? hit : null;
  };
  const damp = (dt, rate) => { const k = 1 - Math.exp(-dt * rate); q = q.map((v, i) => v + (goal[i] - v) * k); robot.setJoints(q); };

  // ── Beschriftung im Overlay: Link folgt einem 3D-Punkt ──
  const lblBox = document.createElement('div'); lblBox.className = 'h3d-lbls';
  host.appendChild(lblBox);
  const v3 = new THREE.Vector3();
  const label = (html, href, hue) => {
    const a = document.createElement(href ? 'a' : 'span'); a.className = 'h3d-lbl'; a.innerHTML = html;
    if (href) a.href = href;
    a.tabIndex = -1; a.setAttribute('aria-hidden', 'true');
    if (hue) a.style.setProperty('--c', hue);
    lblBox.append(a); return a;
  };
  const project = (p, el) => {
    v3.copy(p).project(st.camera);
    const w = host.clientWidth, h = host.clientHeight;
    el.style.transform = `translate(${((v3.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v3.y) / 2 * h).toFixed(1)}px) translate(-50%, -135%)`;
    return [(v3.x + 1) / 2 * w, (1 - v3.y) / 2 * h];
  };
  const nearest = (e, pts, maxPx = 70) => {
    const r = host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = maxPx;
    pts.forEach((p, i) => { v3.copy(p).project(st.camera); const d = Math.hypot((v3.x + 1) / 2 * r.width - x, (1 - v3.y) / 2 * r.height - y); if (d < bd) { bd = d; best = i; } });
    return best;
  };

  // ════ Szenen ════
  let extra = () => {};
  if (scene === 'dome') {
    // Arbeitsraum: Punktkuppel (Fibonacci-Kugel r = 440 mm um Gelenk 2, nur über dem Tisch), Breiten- und Längenkreise
    const SH = L.JOINTS[0][2], R = L.REACH, dome = new THREE.Group(), pts = [];
    for (let i = 0, M = 640; i < M; i++) {
      const k = i + 0.5, phi = Math.acos(1 - 2 * k / M), th = Math.PI * (1 + Math.sqrt(5)) * k, z = SH + R * Math.cos(phi);
      if (z > 0.01) pts.push(R * Math.sin(phi) * Math.cos(th), R * Math.sin(phi) * Math.sin(th), z);
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    dome.add(new THREE.Points(pg, new THREE.PointsMaterial({ map: dot, color: ACC, size: 0.014, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })));
    [0.0015, 0.16, 0.34, 0.52].forEach((z, i) => dome.add(ring(Math.sqrt(R * R - (z - SH) ** 2), z, i ? 0.12 : 0.6)));
    const rim = Math.acos(-SH / R);
    for (let m = 0; m < 8; m++) {
      const a = m / 8 * Math.PI * 2, arc = [];
      for (let j = 0; j <= 40; j++) { const p = j / 40 * rim; arc.push(new THREE.Vector3(R * Math.sin(p) * Math.cos(a), R * Math.sin(p) * Math.sin(a), SH + R * Math.cos(p))); }
      dome.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arc), lineMat(0.1)));
    }
    st.scene.add(dome);
    extra = dt => { dome.rotation.z += dt * Math.PI * 2 / 90; };
  }

  // Steuerwege: N Lichtpunkte im Ring, Leitung zum Sockel; aktiver Punkt pulsiert zum Arm, Arm zeigt hin
  let active = 0, pick = null;
  if (scene === 'modes' || scene === 'atlas') {
    const items = scene === 'modes' ? (o.items || []) : (o.areas || []);
    const RM = scene === 'modes' ? 0.6 : 0.58, nodes = [], lbls = [];
    let segs = [];
    if (scene === 'modes') {
      items.forEach((it, i) => {
        const a = Math.PI * 0.5 - i / items.length * Math.PI * 2, p = new THREE.Vector3(RM * Math.cos(a), RM * Math.sin(a), 0.004);
        const g = new THREE.Group(), s = sprite(0.075, 0.9), r = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 40), new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
        s.position.copy(p).setZ(0.03); r.position.copy(p);
        const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, new THREE.Vector3(0.47 * Math.cos(a), 0.47 * Math.sin(a), 0.004)]), lineMat(0.22));
        g.add(s, r, wire); st.scene.add(g);
        nodes.push({ a, p, s, r, wire, at: s.position });
        lbls.push(label(it.label, it.href));
      });
    } else {
      // Bereiche als Bögen: n Punkte je Bereich, Lücke zwischen den Bereichen, Farbe je Bereich
      const total = items.reduce((s, a) => s + a.n, 0), gap = 1.6, slots = total + gap * items.length, step = Math.PI * 2 / slots;
      let a = Math.PI * 0.5;
      const grp = new THREE.Group(); st.scene.add(grp);
      items.forEach(it => {
        const col = new THREE.Color(it.color || ACC), pos = [];
        const a0 = a;
        for (let k = 0; k < it.n; k++, a -= step) for (let row = 0; row < 3; row++) pos.push((RM + row * 0.028) * Math.cos(a), (RM + row * 0.028) * Math.sin(a), 0.006 + row * 0.004);
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: dot, color: col, size: 0.026, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
        const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circle(RM - 0.05, 0.003, 40, a0 + step * 0.4, a + step * 0.6)), lineMat(0.5, col));
        const mid = (a0 + a + step) / 2, at = new THREE.Vector3((RM + 0.03) * Math.cos(mid), (RM + 0.03) * Math.sin(mid), 0.05);
        grp.add(pts, arc);
        nodes.push({ a: mid, at, pts, arc });
        lbls.push(label(`<b>${it.n}</b> ${it.label}`, it.href, it.css || null));
        a -= step * gap;
      });
      segs = nodes;
    }
    const pulse = sprite(0.05, 0), pulseT = { t: 1, from: new THREE.Vector3() };
    st.scene.add(pulse);
    const setActive = i => {
      active = i;
      nodes.forEach((n, k) => {
        const on = k === i;
        if (n.s) { n.s.scale.setScalar(on ? 0.13 : 0.075); n.s.material.opacity = on ? 1 : 0.7; n.wire.material.opacity = on ? 0.75 : 0.18; }
        if (n.pts) { n.pts.material.size = on ? 0.04 : 0.024; n.pts.material.opacity = on ? 1 : 0.42; n.arc.material.opacity = on ? 0.95 : 0.25; }
        lbls[k].classList.toggle('on', on);
      });
      const [x, y] = toward(nodes[i].a); aim(x, y);
      pulseT.t = 0; pulseT.from.copy(nodes[i].at).setZ(0.03);
      o.onActive && o.onActive(i);
    };
    pick = setActive;
    let hover = false, next = 0;
    host.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const i = nearest(e, nodes.map(n => n.at), scene === 'atlas' ? 90 : 70);
      hover = i >= 0;
      if (hover && i !== active) setActive(i);
    });
    host.addEventListener('pointerleave', () => { hover = false; });
    setActive(0);
    extra = (dt, t) => {
      if (!reduce && !hover && t > next) { if (next) setActive((active + 1) % nodes.length); next = t + 2800; }
      nodes.forEach((n, k) => { n.r && n.r.scale.setScalar(k === active ? 1 + 0.25 * Math.sin(t / 260) : 1); });
      if (pulseT.t < 1) {
        pulseT.t = Math.min(1, pulseT.t + dt / 0.7);
        pulse.position.lerpVectors(pulseT.from, new THREE.Vector3(0, 0, 0.03), pulseT.t);
        pulse.material.opacity = Math.sin(pulseT.t * Math.PI);
      }
      if (dash) dash.rotation.z -= dt * Math.PI * 2 / 60;
      nodes.forEach((n, k) => project(n.at, lbls[k]));
    };
  }

  // Ghost: Plan (Ghost fährt zum Ziel) → Freigabe (Ring blitzt am Ziel) → Fahrt (Arm folgt) → Pause
  if (scene === 'ghost') {
    const gm = new THREE.MeshStandardMaterial({ color: ACC, emissive: ACC, emissiveIntensity: 0.35, transparent: true, opacity: 0.3, depthWrite: false, roughness: 0.6 });
    const ghost = L.buildRobot(THREE, { creased: toCreasedNormals, material: gm, toolMaterial: gm });
    st.scene.add(ghost.group);
    const N = 90, trail = new Float32Array(N * 3), tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(trail, 3));
    const trailLine = new THREE.Line(tg, new THREE.LineDashedMaterial({ color: ACC, dashSize: 0.012, gapSize: 0.01, transparent: true, opacity: 0.85 }));
    const flash = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.026, 48), new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    st.scene.add(trailLine, flash);
    const gtcp = new THREE.Vector3(), last = new THREE.Vector3();
    let tn = 0;
    let gq = q.slice(), gGoal = q.slice(), phase = 'run', tPhase = 0, wp = 0, rest = 0, start = new THREE.Vector3();
    const WAY = [[0.27, -0.15], [0.3, 0.12], [0.2, 0.2], [0.22, -0.05]];
    const setPhase = (p, t) => { phase = p; tPhase = t; o.onPhase && o.onPhase(p); };
    const plan = (x, y, t) => {
      const s = solve(x, y, gGoal); if (!s) return;
      gGoal = s; robot.tcp.getWorldPosition(start); tn = 0; tg.setDrawRange(0, 0); setPhase('plan', t);
    };
    host.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const p = pointerPlane(e); if (!p) return;
      follow = true; rest = performance.now();
      const s = solve(p.x, p.y, gGoal); if (s) { gGoal = s; if (phase !== 'plan') { robot.tcp.getWorldPosition(start); tn = 0; tg.setDrawRange(0, 0); setPhase('plan', rest); } }
    });
    host.addEventListener('pointerleave', () => { follow = false; });
    if (reduce) { const s = solve(0.27, -0.15, q); if (s) { gq = gGoal = s; ghost.setJoints(gq); } }
    else setTimeout(() => plan(...WAY[0], performance.now()), 200);
    extra = (dt, t) => {
      if (reduce) return;
      // Ghost folgt dem Plan zügig, Spur = Weg des Ghost-TCP
      const k = 1 - Math.exp(-dt * 4); gq = gq.map((v, i) => v + (gGoal[i] - v) * k); ghost.setJoints(gq);
      ghost.tcp.getWorldPosition(gtcp);
      if (phase === 'plan') {
        if (tn < N && (!tn || gtcp.distanceTo(last) > 0.004)) {
          trail.set(tn ? [gtcp.x, gtcp.y, gtcp.z] : [start.x, start.y, start.z], tn * 3); last.copy(tn ? gtcp : start); tn++;
          tg.setDrawRange(0, tn); tg.attributes.position.needsUpdate = true; tg.computeBoundingSphere(); trailLine.computeLineDistances();
        }
        const settled = gq.every((v, i) => Math.abs(v - gGoal[i]) < 0.01);
        if (settled && t - tPhase > 900 && (!follow || t - rest > 700)) { setPhase('ok', t); flash.position.set(gtcp.x, gtcp.y, 0.003); }
      } else if (phase === 'ok') {
        const u = (t - tPhase) / 650; flash.material.opacity = Math.max(0, 1 - u); flash.scale.setScalar(1 + u * 2.2);
        if (u >= 1) { goal = gGoal.slice(); setPhase('run', t); }
      } else if (phase === 'run') {
        if (!follow && q.every((v, i) => Math.abs(v - goal[i]) < 0.008) && t - tPhase > 1800) { wp = (wp + 1) % WAY.length; plan(...WAY[wp], t); }
      }
      damp(dt, 2.2);
      trailLine.material.opacity = phase === 'run' ? Math.max(0.15, 0.85 - (t - tPhase) / 2000) : 0.85;
    };
  }

  // ── Zeiger folgt (dome, cell): TCP fährt zum Punkt unter dem Zeiger ──
  if (scene === 'dome' || scene === 'cell') {
    if (reduce) { aim(0.26, 0.1); q = goal; robot.setJoints(q); }
    else {
      host.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse' || e.buttons) return;
        const p = pointerPlane(e); if (p) { follow = true; aim(p.x, p.y); }
      });
      host.addEventListener('pointerleave', () => { follow = false; });
    }
  }
  if (!reduce) st.isBusy = () => true;
  if (reduce && (scene === 'modes' || scene === 'atlas')) { q = goal; robot.setJoints(q); }

  tick = (dt, t) => {
    if (!reduce) {
      if ((scene === 'dome' || scene === 'cell') && !follow) aim(...idle(t));
      if (scene !== 'ghost') damp(dt, follow ? 6 : 2.5);
      if (dash && scene !== 'modes' && scene !== 'atlas') dash.rotation.z -= dt * Math.PI * 2 / 60;
    }
    extra(dt, t);
    place();
  };
  tick(0, 0); st.kick(100);
  wrap.classList.add('is-3d');
  return { stage: st, pick: i => pick && pick(i), get active() { return active; } };
}

window.Hero3D = { init };
})();
