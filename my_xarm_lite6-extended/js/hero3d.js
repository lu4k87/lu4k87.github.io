/* Hero-Bühne der Projektseiten (Skill motion-viz §3): xArm Lite 6 (js/lite6_twin.js) auf Sockel mit Lichtringen,
   Laser-Zielhilfe senkrecht auf den Tisch; Ziehen dreht die Kamera. Szene je Seite (opts.scene):
     dome   Arbeitsraum als Punktkuppel (Reichweite 440 mm um Gelenk 2); Zeiger bewegt den TCP, sonst langsame Acht;
            Pick & Place: drei Ablagefelder + Würfel (Rastergitter), Feld anklicken/antippen → Arm setzt den Würfel um,
            Würfel anklicken/antippen → Arm dreht ihn um 90°; Felder leuchten als Klick-Hinweis unregelmäßig kurz auf,
            Status-Popups oben links (.h3d-steps) blenden die Schritte nacheinander ein; Licht etwas gedämpft
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
let THREE, OrbitControls, toCreasedNormals, RoomEnvironment;

const webgl = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
const CAM = {
  dome: { target: [0, 0, 0.16], camPos: [1.17, -0.9, 0.72] },
  modes: { target: [0, 0, 0.12], camPos: [1.86, -1.46, 1.42] },
  ghost: { target: [0.06, 0, 0.2], camPos: [1.32, -1.05, 0.86] },
  atlas: { target: [0, 0, 0.1], camPos: [1.84, -1.44, 1.5] },
  cell: { target: [0.18, 0, 0.1], camPos: [1.38, -1.12, 0.92] },
};

function init(three, addons, opts = {}) {
  THREE = three; ({ OrbitControls, toCreasedNormals, RoomEnvironment } = addons);
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
  st.controls.autoRotateSpeed = 0;
  // Licht: Gegenlicht im Akzent; Studio-Umgebung (RoomEnvironment) für weiche Reflexe; Hauptlicht wirft weiche Schatten
  // dome: Licht gedämpft (LIT), damit Kuppel und Würfel tragen (Wunsch User 05.10.2026)
  const LIT = scene === 'dome' ? 0.78 : 1;
  let key = null;
  st.scene.traverse(x => {
    if (x.isDirectionalLight && x.color.getHex() === 0x9cc8ff) x.color.copy(ACC2);
    else if (x.isDirectionalLight) { key = x; x.intensity *= LIT; }
    if (x.isHemisphereLight && RoomEnvironment) x.intensity = 0.75 * LIT;
  });
  if (RoomEnvironment) {
    const pm = new THREE.PMREMGenerator(st.renderer);
    st.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; st.scene.environmentIntensity = 0.5 * LIT;
    pm.dispose();
  }
  if (key) {
    st.renderer.shadowMap.enabled = true; st.renderer.shadowMap.type = THREE.PCFShadowMap;
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 5; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.003;
    Object.assign(key.shadow.camera, { left: -0.6, right: 0.6, top: 0.6, bottom: -0.6, near: 0.6, far: 3.4 });
  }
  const shadowCatcher = r => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 96), new THREE.ShadowMaterial({ opacity: 0.42, depthWrite: false })); m.position.z = 0.0008; m.receiveShadow = true; return m; };

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
    // Sockel als Drehkörper mit gerundeter Oberkante (Lichtkante statt harter Kante)
    const prof = [new THREE.Vector2(0.0001, -0.03), new THREE.Vector2(0.42, -0.03)];
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; prof.push(new THREE.Vector2(0.397 + 0.008 * Math.cos(a), -0.008 + 0.008 * Math.sin(a))); }
    prof.push(new THREE.Vector2(0.0001, 0));
    const disc = new THREE.Mesh(new THREE.LatheGeometry(prof, 160).rotateX(Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0x14181b, roughness: 0.5, metalness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.4, envMapIntensity: 0.3 }));
    disc.receiveShadow = true;
    dash = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle(0.47, -0.02, 240)),
      new THREE.LineDashedMaterial({ color: ACC, dashSize: 0.018, gapSize: 0.014, transparent: true, opacity: 0.55 }));
    dash.computeLineDistances();
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), glowMat(0.34 * LIT));
    halo.position.z = -0.032;
    ped.add(disc, shadowCatcher(0.398), ring(0.401, 0.0012, 0.85), ring(0.29, 0.0012, 0.22), ring(0.18, 0.0012, 0.16), dash, halo);
    st.scene.add(ped);
  }

  // ── Roboter + Laser-Zielhilfe (Strahl vom TCP senkrecht auf den Tisch, Ring am Auftreffpunkt) ──
  const robot = L.buildRobot(THREE, { creased: toCreasedNormals,
    material: new THREE.MeshPhysicalMaterial({ color: 0xe4e8ea, roughness: 0.32, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.28 }),
    toolMaterial: new THREE.MeshPhysicalMaterial({ color: 0x1b2023, roughness: 0.38, metalness: 0.6, clearcoat: 0.3 }) });
  robot.group.traverse(m => { if (m.isMesh) m.castShadow = true; });
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
  let q = L.HOME.slice(), goal = q.slice(), follow = false;
  const ptr = new THREE.Vector2();
  const aim = (x, y) => { const s = solve(x, y, goal); if (s) goal = s; };
  const pointerPlane = e => {
    const r = host.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2);
    ray.setFromCamera(ndc, st.camera);
    return ray.ray.intersectPlane(plane, hit) ? hit : null;
  };
  // Kritisch gedämpfte Feder (exakte Lösung je Schritt, stabil bei jedem dt): Geschwindigkeit bleibt stetig → kein Ruck bei neuem Ziel
  const spring = (x, v, g, w, dt) => { const e = x - g, k = v + w * e, ex = Math.exp(-w * dt); return [g + (e + k * dt) * ex, (v - w * k * dt) * ex]; };
  const qv = q.map(() => 0);
  const damp = (dt, rate) => { const w = rate * 1.5; q = q.map((v, i) => { const [x, nv] = spring(v, qv[i], goal[i], w, dt); qv[i] = nv; return x; }); robot.setJoints(q); };

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
  // Ziel in Polarkoordinaten (Winkel um Gelenk 1, Radius 170–320 mm), der TCP-Punkt folgt als Feder, Gelenke per IK daraus.
  // Übergabe ohne Sprung: Zeiger raus → Leerlauf-Acht setzt am nächsten Punkt zur aktuellen TCP-Lage an und läuft sanft an;
  // Zeiger rein → Feder übernimmt mit der laufenden Geschwindigkeit, Steifigkeit steigt weich an.
  // Gelenk 1 endet bei ±178° → Zeiger hinter dem Arm: Seite halten; Seitenwechsel = Schwenk nach vorn, Ziel wandert höchstens W_MAX rad/s.
  const TH = 3.0, R0 = 0.17, R1 = 0.32, IDLE_T = 16, W_MAX = 2.2;
  // Arm arbeitet mit: Werkzeug neigt sich nach außen, je weiter der TCP vom Sockel weg ist (Gelenk 5, bis TILT rad);
  // die Leerlauf-Acht hebt und senkt den TCP dazu in eigenem Takt (Gelenke 2, 3, 5 statt nur Gelenk 1; Wunsch User 05.10.2026)
  const TILT = 0.45;
  const pol = { th: 0, r: 0.25, vth: 0, vr: 0, gth: 0, gr: 0.25, cth: 0, w: 2.6, z: Z, vz: 0, gz: Z, yaw: 0, vyaw: 0, gyaw: 0, tilt: 0, vtilt: 0, gtilt: 0 };
  let job = null;   // Pick & Place (dome): setzt die Ziele statt Zeiger/Acht
  const eight = ph => { const x = 0.25 + 0.05 * Math.sin(2 * ph), y = 0.16 * Math.sin(ph); return [Math.atan2(y, x), Math.hypot(x, y)]; };
  let ph = 0, idleRamp = 1;
  const setGoalXY = (x, y) => {
    const r = Math.hypot(x, y); if (r < 0.02) return;
    let th = Math.atan2(y, x);
    if (Math.abs(th) > TH - 0.5 && Math.sign(th) !== Math.sign(pol.gth || 1)) th = -th;   // hinter dem Arm: Seite halten statt umschlagen
    pol.gth = Math.max(-TH, Math.min(TH, th)); pol.gr = Math.max(R0, Math.min(R1, r));
  };
  const nearestPhase = () => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < 128; i++) { const p = i / 128 * Math.PI * 2, [t, r] = eight(p), d = ((t - pol.th) * pol.r) ** 2 + (r - pol.r) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  };
  const followTick = dt => {
    if (job) job.tick(dt);
    else {
      if (!follow) {
        idleRamp = Math.min(1, idleRamp + dt / 1.6);
        ph += dt * Math.PI * 2 / IDLE_T * idleRamp * idleRamp * (3 - 2 * idleRamp);
        [pol.gth, pol.gr] = eight(ph);
      }
      pol.gtilt = TILT * Math.max(0, Math.min(1, (pol.gr - R0) / (R1 - R0)));
      pol.gz = follow ? Z : Z + 0.03 + 0.03 * Math.sin(3 * ph);
    }
    pol.w += ((job ? 4.5 : follow ? 7 : 2.6) - pol.w) * (1 - Math.exp(-dt * 3));
    pol.cth += Math.max(-W_MAX * dt, Math.min(W_MAX * dt, pol.gth - pol.cth));
    [pol.th, pol.vth] = spring(pol.th, pol.vth, pol.cth, pol.w, dt);
    [pol.r, pol.vr] = spring(pol.r, pol.vr, pol.gr, pol.w, dt);
    [pol.z, pol.vz] = spring(pol.z, pol.vz, pol.gz, 7, dt);
    [pol.yaw, pol.vyaw] = spring(pol.yaw, pol.vyaw, pol.gyaw, 5, dt);   // Werkzeugdrehung (Gelenk 6), nur beim Würfel-Drehen ≠ 0
    [pol.tilt, pol.vtilt] = spring(pol.tilt, pol.vtilt, pol.gtilt, 5, dt);   // Werkzeugneigung (Gelenk 5)
    const s = L.ikDown(pol.r * Math.cos(pol.th), pol.r * Math.sin(pol.th), pol.z, pol.yaw, q, pol.tilt);
    if (s) { q = s; robot.setJoints(q); }
  };
  if (scene === 'dome' || scene === 'cell') {
    if (reduce) { aim(0.26, 0.1); q = goal; robot.setJoints(q); }
    else {
      host.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse' || e.buttons) return;
        const p = pointerPlane(e); if (p) { follow = true; ptr.set(p.x, p.y); if (!job) setGoalXY(p.x, p.y); }
      });
      host.addEventListener('pointerleave', () => { if (!follow) return; follow = false; ph = nearestPhase(); idleRamp = 0; });
    }
  }
  // ── Pick & Place (dome): drei Ablagefelder, Würfel 50 mm; Feld anklicken/antippen → anfahren, senken, Sauger blitzt,
  // heben, schräg nach oben-außen strecken (Werkzeug geneigt), im hohen Bogen zum Ziel, aufrichten, senken, lösen, heben. Würfel anklicken/antippen → greifen, anheben, per Gelenk 6 um 90° drehen, zurücksetzen.
  // Ziele laufen über dieselben Federn (Winkel, Radius, Höhe, Werkzeugdrehung) → kein Ruck; Zwischenpunkte mit grober
  // Toleranz (Bahn rundet ab), Kontaktpunkte genau. Danach übernimmt Zeiger bzw. Acht wie beim Verlassen der Bühne.
  // Klick-Hinweis: Felder leuchten unregelmäßig kurz auf (Welle läuft nach außen, Würfel-Raster hellt mit), nur in Ruhe;
  // nach dem ersten eigenen Klick seltener (Wunsch User 05.10.2026).
  if (scene === 'dome') {
    const CUBE = 0.05, PR = 0.27, LIFT = 0.17, padAng = [-2.05, -0.6, 0.85], table = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const ringMesh = (r0, r1, op) => new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48), new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pads = padAng.map((a, k) => {
      const g = new THREE.Group(), outer = ringMesh(0.031, 0.038, 0.4), inner = ringMesh(0.018, 0.022, 0.15), glow = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), glowMat(0));
      const wave = ringMesh(0.036, 0.039, 0);
      g.position.set(PR * Math.cos(a), PR * Math.sin(a), 0.0025); glow.position.z = -0.0007;
      g.add(outer, inner, glow, wave); st.scene.add(g);
      return { a, g, outer, inner, glow, wave, on: false, t0: -9, next: 1.5 + k * 1.3 + rnd(0, 1.5) };
    });
    // Würfel als 3D-Rastergitter: Hauch Füllung, Raster n × n auf allen Flächen (Rückseiten scheinen durch), helle Kanten, Eckpunkte
    const gridCube = (s, n) => {
      const h = s / 2, v = [];
      for (let ax = 0; ax < 3; ax++) for (const f of [-h, h]) for (let k = 1; k < n; k++) {
        const c = -h + s * k / n, b = (ax + 1) % 3, d = (ax + 2) % 3;
        for (const [u, w] of [[b, d], [d, b]]) { const p0 = [0, 0, 0], p1 = [0, 0, 0]; p0[ax] = p1[ax] = f; p0[u] = p1[u] = c; p0[w] = -h; p1[w] = h; v.push(...p0, ...p1); }
      }
      return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    };
    const box = new THREE.BoxGeometry(CUBE, CUBE, CUBE), cube = new THREE.Group(), ch = CUBE / 2;
    const corners = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
      [0, 1, 2, 3, 4, 5, 6, 7].flatMap(k => [k & 1 ? ch : -ch, k & 2 ? ch : -ch, k & 4 ? ch : -ch]), 3));
    const cubeFill = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.1, depthWrite: false }));
    const cubeGrid = new THREE.LineSegments(gridCube(CUBE, 4), lineMat(0.42));
    cube.add(cubeFill, cubeGrid,
      new THREE.LineSegments(new THREE.EdgesGeometry(box), lineMat(0.95, ACC2)),
      new THREE.Points(corners, new THREE.PointsMaterial({ map: dot, color: ACC2, size: 0.016, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })));
    const flash = ringMesh(0.016, 0.03, 0);
    st.scene.add(cube, flash);
    let at = 0, held = false, hover = -1, hoverCube = false, pending = null, flashT = 1, clicked = false, clk = 0;
    const onPad = i => { cube.position.set(pads[i].g.position.x, pads[i].g.position.y, CUBE / 2); };
    onPad(at);
    // Feld-Zustand + Klick-Hinweis (b = 0…1, Höhe des Aufleuchtens)
    const paint = (p, b = 0) => {
      p.outer.material.opacity = p.on ? 1 : 0.4 + 0.3 * b; p.inner.material.opacity = p.on ? 0.7 : 0.15 + 0.25 * b;
      p.glow.material.opacity = p.on ? 0.75 : 0.22 * b;
    };
    const show = () => {
      const hi = job ? job.to : hover;
      pads.forEach((p, i) => { p.on = i === hi && i !== at; paint(p); });
      cubeGrid.material.opacity = hoverCube && !held ? 0.75 : 0.42; cubeFill.material.opacity = hoverCube && !held ? 0.18 : 0.1;
      host.style.cursor = hoverCube || (hover >= 0 && hover !== at) ? 'pointer' : '';
      st.kick();
    };
    const pickRay = e => {
      const r = host.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2);
      ray.setFromCamera(ndc, st.camera);
    };
    const padAt = (e, tol) => {
      pickRay(e);
      if (!ray.ray.intersectPlane(table, hit)) return -1;
      let best = -1, bd = tol;
      pads.forEach((p, i) => { const d = Math.hypot(hit.x - p.g.position.x, hit.y - p.g.position.y); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    // Würfel getroffen: Strahl trifft den Würfel oder sein Feld (großes Ziel auch für Finger); im Arm nicht wählbar
    const cubeAt = (e, tol) => !held && (padAt(e, tol) === at || ray.intersectObject(cubeFill).length > 0);
    // Status-Popups: Schritte blenden nacheinander ein (≥ 340 ms Abstand), laufender Schritt mit Puls, erledigte mit ✓;
    // „Fertig“ bleibt kurz stehen, dann blenden alle gestaffelt aus. Ergänzt die Bewegung → für Screenreader verborgen.
    const feed = (() => {
      const box = document.createElement('ol'); box.className = 'h3d-steps'; box.setAttribute('aria-hidden', 'true');
      host.appendChild(box);
      const timers = new Set(), later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
      let due = 0;
      const out = stagger => [...box.querySelectorAll('.h3d-step:not(.out)')].forEach((li, k) => {
        li.style.transitionDelay = stagger ? `${k * 60}ms` : '0ms'; li.classList.add('out');
        setTimeout(() => li.remove(), 420 + k * 60);
      });
      return {
        say(text, meta, fin) {
          const now = performance.now(), wait = Math.max(0, due - now); due = Math.max(now, due) + 340;
          later(() => {
            box.querySelectorAll('.h3d-step.on').forEach(li => li.classList.replace('on', 'done'));
            const li = document.createElement('li'), t = document.createElement('span'), m = document.createElement('b');
            li.className = `h3d-step ${fin ? 'done fin' : 'on'}`; t.textContent = text; m.textContent = meta;
            li.append(document.createElement('i'), t, m); box.append(li);
            void li.offsetWidth; li.classList.add('in');
            if (fin) later(() => out(true), 2600);
          }, wait);
        },
        reset() { timers.forEach(clearTimeout); timers.clear(); due = performance.now() + 180; out(false); },
      };
    })();
    const T = (de, en) => (document.documentElement.lang === 'en' ? en : de), mm = v => String(Math.round(v * 1000)).replace('-', '−');
    const xy = p => `x ${mm(p.x)} · y ${mm(p.y)} mm`;
    const blink = () => { flashT = 0; flash.position.set(cube.position.x, cube.position.y, cube.position.z + CUBE / 2 + 0.002); };
    const tcpQ = new THREE.Quaternion(), rel = new THREE.Quaternion(), relP = new THREE.Vector3(), tcpW = new THREE.Vector3();
    // Ablauf als Schrittliste [Winkel, Höhe, Toleranz, Aktion, Werkzeugdrehung, Radius, Neigung]; carry = Meldung nach dem Greifen
    const run = (to, steps, carry) => {
      const t0 = performance.now();
      let i = 0, wait = 0;
      feed.reset();
      feed.say(T('Anfahren', 'Approach'), xy(pads[at].g.position));
      job = { to, tick: dt => {
        const [th, z, tol, act, yaw = 0, r = PR, tilt = 0] = steps[i];
        pol.gth = th; pol.gr = r; pol.gz = z; pol.gyaw = yaw; pol.gtilt = tilt;   // Winkelgrenze W_MAX gilt weiter (followTick)
        if (wait > 0) { wait -= dt; if (wait <= 0) i++; }
        else if (Math.abs(pol.th - th) * pol.r < tol && Math.abs(pol.r - r) < tol && Math.abs(pol.z - z) < tol && Math.abs(pol.tilt - tilt) < tol * 4
          && Math.abs(pol.yaw - yaw) < 0.03 && (!act || Math.abs(pol.vz) < 0.02)) {
          if (act === 'grip') {
            held = true; blink(); wait = 0.22;
            // Würfel hängt fest am Sauger: Lage + Versatz im Werkzeugrahmen merken (bleibt bei geneigtem Werkzeug dran)
            robot.tcp.getWorldQuaternion(tcpQ); rel.copy(tcpQ).invert().multiply(cube.quaternion);
            robot.tcp.getWorldPosition(tcpW); relP.subVectors(cube.position, tcpW).applyQuaternion(tcpQ.clone().invert());
            feed.say(T('Greifen', 'Grip'), T('Sauger an', 'suction on'));
            feed.say(...carry);
          } else if (act === 'drop') {
            held = false; at = to; onPad(at); cube.rotation.set(0, 0, cube.rotation.z); blink(); wait = 0.22;
            feed.say(T('Ablegen', 'Place'), T('Sauger aus', 'suction off'));
          } else i++;
        }
        if (i < steps.length) return;
        job = null; pol.gz = Z; pol.gyaw = 0;
        const sec = ((performance.now() - t0) / 1000).toFixed(1);
        feed.say(T('Fertig', 'Done'), `${T(sec.replace('.', ','), sec)} s`, true);
        if (follow) setGoalXY(ptr.x, ptr.y); else { ph = nearestPhase(); idleRamp = 0; }
        show();
        if (pending) { const n = pending; pending = null; n(); }
      } };
      show();
    };
    // Feld: Würfel umsetzen
    const start = to => {
      if (to === at) return;
      if (reduce) { at = to; onPad(at); show(); feed.reset(); feed.say(T('Abgelegt', 'Placed'), xy(cube.position), true); return; }
      if (job) { pending = () => start(to); return; }
      // Bogen: anheben, schräg nach oben-außen gestreckt (Radius 400 mm, Höhe 310 mm, Werkzeug 49° geneigt), hoch
      // hinüberschwenken, über dem Ziel aufrichten; Zwischenpunkte grob → Federn runden die Bahn ab
      const A = padAng[at], B = padAng[to], via = k => A + (B - A) * k;
      run(to, [[A, Z, 0.02], [A, CUBE, 0.002, 'grip'], [A, 0.13, 0.03],
        [via(0.3), 0.31, 0.05, null, 0, 0.4, 0.85], [via(0.75), 0.26, 0.05, null, 0, 0.36, 0.55],
        [B, 0.13, 0.02], [B, CUBE, 0.002, 'drop'], [B, Z, 0.012]],
        [T('Transport', 'Transfer'), `${T('Schwenk', 'swing')} ${Math.round(Math.abs(B - A) * 180 / Math.PI)}°`]);
    };
    // Würfel: anheben, um 90° drehen, zurücksetzen; Drehsinn so, dass Gelenk 6 (q1 − Drehung) in ±178° bleibt
    const turn = () => {
      const A = padAng[at], d = A > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (reduce) { cube.rotation.z += d; show(); feed.reset(); feed.say(T('Gedreht', 'Rotated'), '90°', true); return; }
      if (job) { pending = turn; return; }
      run(at, [[A, Z, 0.02], [A, CUBE, 0.002, 'grip'], [A, LIFT, 0.02], [A, LIFT, 0.01, null, d], [A, CUBE, 0.002, 'drop', d], [A, Z, 0.012, null, d]],
        [T('Drehen', 'Rotate'), `${T('Gelenk', 'joint')} 6 · ${d > 0 ? '+' : '−'}90°`]);
    };
    let down = null;
    host.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const c = cubeAt(e, 0.07), i = c ? -1 : padAt(e, 0.07);
      if (i !== hover || c !== hoverCube) { hover = i; hoverCube = c; show(); }
    });
    host.addEventListener('pointerleave', () => { if (hover >= 0 || hoverCube) { hover = -1; hoverCube = false; show(); } });
    host.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    // Tippen/Klick = kurz und ohne Ziehen (Ziehen dreht weiter die Kamera)
    host.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 600) return;
      const tol = e.pointerType === 'mouse' ? 0.07 : 0.09;
      if (cubeAt(e, tol)) { clicked = true; turn(); return; }
      const i = padAt(e, tol); if (i >= 0) { clicked = true; start(i); }
    });
    const ex = extra;
    extra = (dt, t) => {
      ex(dt, t);
      if (held) {
        robot.tcp.getWorldPosition(tcpW); robot.tcp.getWorldQuaternion(tcpQ);
        cube.position.copy(relP).applyQuaternion(tcpQ).add(tcpW); cube.quaternion.multiplyQuaternions(tcpQ, rel);
      }
      if (flashT < 1) { flashT = Math.min(1, flashT + dt / 0.45); flash.material.opacity = 0.95 * (1 - flashT); flash.scale.setScalar(1 + flashT * 1.6); }
      if (reduce) return;
      // Klick-Hinweis: je Feld eigener, zufälliger Takt; während Ablauf, Hover oder im Arm verschoben statt gezeigt
      clk += dt;
      let cubeB = 0;
      pads.forEach((p, i) => {
        if (clk >= p.next) {
          if (job || held || hover >= 0 || hoverCube || p.on) p.next = clk + rnd(1, 3);
          else { p.t0 = clk; p.next = clk + rnd(4, 9) * (clicked ? 2.5 : 1); }
        }
        const u = (clk - p.t0) / 1.6;
        if (u > 1.05) return;
        const k = Math.min(1, u), b = Math.sin(Math.PI * k) ** 2;
        if (!p.on) paint(p, b);
        p.wave.material.opacity = 0.32 * (1 - k) * Math.min(1, k * 6); p.wave.scale.setScalar(1 + k * 0.9);
        if (i === at && !held) cubeB = b;
      });
      if (!hoverCube) cubeGrid.material.opacity = 0.42 + 0.25 * cubeB;
    };
    show();
  }
  if (!reduce) st.isBusy = () => true;
  if (reduce && (scene === 'modes' || scene === 'atlas')) { q = goal; robot.setJoints(q); }

  // Auto-Orbit läuft nach Ruhe weich an statt mit voller Geschwindigkeit zu starten
  let orbitRamp = 0;
  tick = (dt, t) => {
    if (!reduce) {
      if (scene === 'dome' || scene === 'cell') followTick(dt);
      else if (scene !== 'ghost') damp(dt, 2.5);
      orbitRamp = st.controls.autoRotate ? Math.min(1, orbitRamp + dt / 2.5) : 0;
      st.controls.autoRotateSpeed = 0.3 * orbitRamp * orbitRamp * (3 - 2 * orbitRamp);
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
