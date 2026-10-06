/* Hero-Bühne der Projektseiten (Skill motion-viz §3): xArm Lite 6 (js/lite6_twin.js) auf Sockel mit Lichtringen,
   Laser-Zielhilfe senkrecht auf den Tisch; Ziehen dreht die Kamera. Szene je Seite (opts.scene):
     dome   Arbeitsraum als Punktkuppel (Reichweite 440 mm um Gelenk 2); Zeiger bewegt den TCP, sonst langsame Acht;
            Pick & Place: drei Ablagefelder + Würfel (Rastergitter, pulsierender Lichthof), Feld anklicken/antippen → Arm setzt den Würfel um,
            Würfel anklicken/antippen → Arm dreht ihn um 90°; Felder leuchten als Klick-Hinweis unregelmäßig kurz auf,
            Status-Leiste unten mittig (.h3d-steps) blendet die Schritte nacheinander ein; Licht etwas gedämpft
     modes  Steuerwege als Lichtpunkte im Ring (opts.items); aktiver Punkt schickt einen Impuls zum Arm, der Arm zeigt hin
     ghost  Ghost-Arm plant voraus → Freigabe → Arm fährt nach („Erst virtuell, dann real“); Zeiger setzt das Ziel
     atlas  Look wie dome (Punktkuppel, Kamera, Licht); Funktionen als Punktbögen je Bereich auf dem Sockel (opts.areas: n je
            Bereich); Laser fährt die Bögen langsam ab, Bereich unter dem Laser leuchtet; Zeiger lenkt den Arm, Ring anklicken = Link
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
  dome: { target: [0, 0, 0.16], camPos: [1.47, -1.13, 0.87] },  // 1,26 × Abstand: ganze Kuppel im Bild (Wunsch User 06.10.2026)
  modes: { target: [0, 0, 0.12], camPos: [1.86, -1.46, 1.42] },
  ghost: { target: [0.06, 0, 0.2], camPos: [1.32, -1.05, 0.86] },
  atlas: { target: [0, 0, 0.16], camPos: [1.47, -1.13, 0.87] },  // wie dome (Wunsch User 06.10.2026)
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
  // dome, atlas: Licht gedämpft (LIT), damit Kuppel, Würfel und Punktbögen tragen (Wunsch User 05./06.10.2026)
  const LIT = scene === 'dome' || scene === 'atlas' ? 0.78 : 1;
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
    ped.add(disc, shadowCatcher(0.398), ring(0.401, 0.0012, 0.85), ring(0.18, 0.0012, 0.16), dash, halo);
    if (scene !== 'atlas') ped.add(ring(0.29, 0.0012, 0.22));   // atlas: dort liegen die Punktbögen
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
  // half = halbe Breite der Beschriftung (px): bleibt dann ganz auf der Bühne statt am Rand abgeschnitten
  const project = (p, el, half = 0) => {
    v3.copy(p).project(st.camera);
    const w = host.clientWidth, h = host.clientHeight;
    const x = half ? Math.max(half + 6, Math.min(w - half - 6, (v3.x + 1) / 2 * w)) : (v3.x + 1) / 2 * w;
    el.style.transform = `translate(${x.toFixed(1)}px, ${((1 - v3.y) / 2 * h).toFixed(1)}px) translate(-50%, -135%)`;
    return [x, (1 - v3.y) / 2 * h];
  };
  const nearest = (e, pts, maxPx = 70) => {
    const r = host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = maxPx;
    pts.forEach((p, i) => { v3.copy(p).project(st.camera); const d = Math.hypot((v3.x + 1) / 2 * r.width - x, (1 - v3.y) / 2 * r.height - y); if (d < bd) { bd = d; best = i; } });
    return best;
  };

  // ════ Szenen ════
  let extra = () => {};
  if (scene === 'dome' || scene === 'atlas') {
    // Arbeitsraum: Punktkuppel (Fibonacci-Kugel r = 440 mm um Gelenk 2, nur über dem Tisch), Breiten- und Längenkreise
    const SH = L.JOINTS[0][2], R = L.REACH, dome = new THREE.Group(), pts = [];
    for (let i = 0, M = 640; i < M; i++) {
      const k = i + 0.5, phi = Math.acos(1 - 2 * k / M), th = Math.PI * (1 + Math.sqrt(5)) * k, z = SH + R * Math.cos(phi);
      if (z > 0.01) pts.push(R * Math.sin(phi) * Math.cos(th), R * Math.sin(phi) * Math.sin(th), z);
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const DO = scene === 'atlas' ? 0.6 : 1;   // atlas: Kuppel leiser, die farbigen Bögen tragen
    dome.add(new THREE.Points(pg, new THREE.PointsMaterial({ map: dot, color: ACC, size: 0.014, transparent: true, opacity: 0.8 * DO, depthWrite: false, blending: THREE.AdditiveBlending })));
    [0.0015, 0.16, 0.34, 0.52].forEach((z, i) => dome.add(ring(Math.sqrt(R * R - (z - SH) ** 2), z, i ? 0.12 : 0.6)));
    const rim = Math.acos(-SH / R);
    for (let m = 0; m < 8; m++) {
      const a = m / 8 * Math.PI * 2, arc = [];
      for (let j = 0; j <= 40; j++) { const p = j / 40 * rim; arc.push(new THREE.Vector3(R * Math.sin(p) * Math.cos(a), R * Math.sin(p) * Math.sin(a), SH + R * Math.cos(p))); }
      dome.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arc), lineMat(0.1 * DO)));
    }
    st.scene.add(dome);
    extra = dt => { dome.rotation.z += dt * Math.PI * 2 / 90; };
  }

  // Steuerwege: N Lichtpunkte im Ring, Leitung zum Sockel; aktiver Punkt pulsiert zum Arm, Arm zeigt hin
  let active = 0, pick = null;
  if (scene === 'modes') {
    const items = o.items || [];
    const RM = 0.6, nodes = [], lbls = [];
    items.forEach((it, i) => {
      const a = Math.PI * 0.5 - i / items.length * Math.PI * 2, p = new THREE.Vector3(RM * Math.cos(a), RM * Math.sin(a), 0.004);
      const g = new THREE.Group(), s = sprite(0.075, 0.9), r = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 40), new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      s.position.copy(p).setZ(0.03); r.position.copy(p);
      const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, new THREE.Vector3(0.47 * Math.cos(a), 0.47 * Math.sin(a), 0.004)]), lineMat(0.22));
      g.add(s, r, wire); st.scene.add(g);
      nodes.push({ a, p, s, r, wire, at: s.position });
      lbls.push(label(it.label, it.href));
    });
    const pulse = sprite(0.05, 0), pulseT = { t: 1, from: new THREE.Vector3() };
    st.scene.add(pulse);
    const setActive = i => {
      active = i;
      nodes.forEach((n, k) => {
        const on = k === i;
        n.s.scale.setScalar(on ? 0.13 : 0.075); n.s.material.opacity = on ? 1 : 0.7; n.wire.material.opacity = on ? 0.75 : 0.18;
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
      const i = nearest(e, nodes.map(n => n.at), 70);
      hover = i >= 0;
      if (hover && i !== active) setActive(i);
    });
    host.addEventListener('pointerleave', () => { hover = false; });
    setActive(0);
    extra = (dt, t) => {
      if (!reduce && !hover && t > next) { if (next) setActive((active + 1) % nodes.length); next = t + 2800; }
      nodes.forEach((n, k) => { n.r.scale.setScalar(k === active ? 1 + 0.25 * Math.sin(t / 260) : 1); });
      if (pulseT.t < 1) {
        pulseT.t = Math.min(1, pulseT.t + dt / 0.7);
        pulse.position.lerpVectors(pulseT.from, new THREE.Vector3(0, 0, 0.03), pulseT.t);
        pulse.material.opacity = Math.sin(pulseT.t * Math.PI);
      }
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
  const TH = 3.0, R0 = 0.17, R1 = 0.32, IDLE_T = scene === 'dome' ? 24 : 16, W_MAX = 2.2;
  // Arm arbeitet mit: Werkzeug neigt sich nach außen, je weiter der TCP vom Sockel weg ist (Gelenk 5, bis TILT rad);
  // die Leerlauf-Acht hebt und senkt den TCP dazu in eigenem Takt (Gelenke 2, 3, 5 statt nur Gelenk 1; Wunsch User 05.10.2026)
  const TILT = 0.45;
  const pol = { th: 0, r: 0.25, vth: 0, vr: 0, gth: 0, gr: 0.25, cth: 0, w: 2.6, z: Z, vz: 0, gz: Z, yaw: 0, vyaw: 0, gyaw: 0, tilt: 0, vtilt: 0, gtilt: 0, soft: 1 };
  let job = null;   // Pick & Place (dome): führt die Lage statt Zeiger/Acht
  const eight = ph => { const x = 0.25 + 0.05 * Math.sin(2 * ph), y = 0.16 * Math.sin(ph); return [Math.atan2(y, x), Math.hypot(x, y)]; };
  // dome (Hero mit Pick & Place): Schlangenlinie im Bogen um den Sockel (±143°, Radius 190–310 mm), TCP hebt und senkt
  // sich dazu (100–190 mm, bleibt über dem Würfel); Wunsch User 06.10.2026
  const snake = ph => [2.5 * Math.sin(ph), 0.25 + 0.06 * Math.sin(7 * ph)];
  const loop = scene === 'dome' ? snake : eight;
  const lift = scene === 'dome' ? ph => Z + 0.045 + 0.045 * Math.sin(5 * ph + 1) : ph => Z + 0.03 + 0.03 * Math.sin(3 * ph);
  let ph = 0, idleRamp = 1, idle = null;   // idle(dt): eigener Leerlauf statt Acht (atlas), setzt pol.gth/gr/gz
  const W_FOLLOW = scene === 'atlas' ? 4 : 7;   // atlas: Arm folgt dem Zeiger ruhiger (Ring statt Zielpunkt)
  const setGoalXY = (x, y) => {
    const r = Math.hypot(x, y); if (r < 0.02) return;
    let th = Math.atan2(y, x);
    if (Math.abs(th) > TH - 0.5 && Math.sign(th) !== Math.sign(pol.gth || 1)) th = -th;   // hinter dem Arm: Seite halten statt umschlagen
    pol.gth = Math.max(-TH, Math.min(TH, th)); pol.gr = Math.max(R0, Math.min(R1, r));
  };
  const nearestPhase = () => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < 256; i++) { const p = i / 256 * Math.PI * 2, [t, r] = loop(p), d = ((t - pol.th) * pol.r) ** 2 + (r - pol.r) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  };
  // Pick & Place (job) führt die Lage direkt über seine Bahn; danach übernehmen die Federn aus der Ruhe: Schwenkrate und
  // Steifigkeit (Radius, Höhe, Werkzeug) steigen in ~1,2 s weich an (soft) → kein Ruck beim Übergang zu Zeiger bzw. Acht
  const followTick = dt => {
    if (job) { job.tick(dt); pol.cth = pol.th; pol.soft = 0; }
    else {
      if (!follow) {
        idleRamp = Math.min(1, idleRamp + dt / 1.6);
        const ramp = idleRamp * idleRamp * (3 - 2 * idleRamp);
        if (idle) idle(dt * ramp);
        else { ph += dt * Math.PI * 2 / IDLE_T * ramp; [pol.gth, pol.gr] = loop(ph); pol.gz = lift(ph); }
      } else pol.gz = Z;
      pol.gtilt = TILT * Math.max(0, Math.min(1, (pol.gr - R0) / (R1 - R0)));
      pol.soft = Math.min(1, pol.soft + dt / 1.2);
      const k = 0.2 + 0.8 * pol.soft * pol.soft * (3 - 2 * pol.soft);
      pol.w += ((follow ? W_FOLLOW : 2.6) - pol.w) * (1 - Math.exp(-dt * 3));
      const wl = Math.min(W_MAX, 0.5 / Math.max(R0, pol.r)) * k * dt;   // Schwenk ≤ 500 mm/s am TCP (Lite 6)
      pol.cth += Math.max(-wl, Math.min(wl, pol.gth - pol.cth));
      [pol.th, pol.vth] = spring(pol.th, pol.vth, pol.cth, pol.w, dt);
      [pol.r, pol.vr] = spring(pol.r, pol.vr, pol.gr, pol.w * k, dt);
      [pol.z, pol.vz] = spring(pol.z, pol.vz, pol.gz, 7 * k, dt);
      [pol.yaw, pol.vyaw] = spring(pol.yaw, pol.vyaw, pol.gyaw, 5 * k, dt);   // Werkzeugdrehung (Gelenk 6), nach dem Ablegen zurück auf 0
      [pol.tilt, pol.vtilt] = spring(pol.tilt, pol.vtilt, pol.gtilt, 5 * k, dt);   // Werkzeugneigung (Gelenk 5)
    }
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
  // ── Funktionsatlas (atlas): Bereiche als Punktbögen auf dem Sockel (n Punkte je Bereich, 3 Reihen, Farbe je Bereich);
  // die Lücke hinter dem Arm liegt auf ±180°, weil Gelenk 1 bei ±178° endet. Leerlauf: Laser fährt die Bögen langsam ab,
  // an der Bogenmitte langsamer, am letzten Bereich kehrt er um (kein Umlauf über die Gelenkgrenze). Zeiger: Arm folgt dem
  // Winkel unter dem Zeiger; Ring anklicken = Link der Beschriftung; Tippen: Arm fährt hin und hält 6 s, zweites Tippen
  // auf denselben Bereich = Link. Aktiv = Bereich unter dem TCP: Beschriftung, Bogen zeichnet sich in Fahrtrichtung,
  // Punkte nahe am Laser hellen auf, Laser nimmt die Bereichsfarbe an, beim Wechsel läuft ein Echo-Bogen nach außen
  // (Wunsch User 06.10.2026).
  if (scene === 'atlas' && (o.areas || []).length) {
    const items = o.areas, RA = 0.29, DR = 0.02, RT = RA + DR, GAP = 1.6, HYS = 0.03, SEG = 64;
    const total = items.reduce((s, a) => s + a.n, 0), step = Math.PI * 2 / (total + GAP * items.length);
    const nodes = [], lbls = [], tint = ACC.clone(), cBuf = new THREE.Color();
    let a = Math.PI - step * (1 + GAP) / 2;
    items.forEach(it => {
      const col = new THREE.Color(it.color || ACC), pos = [], ang = [], a0 = a;
      for (let k = 0; k < it.n; k++, a -= step) for (let row = 0; row < 3; row++) { ang.push(a); pos.push((RA + row * DR) * Math.cos(a), (RA + row * DR) * Math.sin(a), 0.004); }
      const a1 = a + step, mid = (a0 + a1) / 2, geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: dot, vertexColors: true, size: 0.022, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const arc = r => new THREE.BufferGeometry().setFromPoints(circle(r, 0.003, SEG, a0 + step * 0.3, a1 - step * 0.3));
      const base = new THREE.Line(arc(RA - 0.022), lineMat(0.2, col)), hi = new THREE.Line(arc(RA - 0.022), lineMat(0.9, col)), echo = new THREE.Line(arc(RA + 3 * DR), lineMat(0, col));
      hi.geometry.setDrawRange(0, 0);
      st.scene.add(pts, base, hi, echo);
      nodes.push({ a0, a1, mid, col, ang, pts, hi, echo, glow: 0, eT: 1, fromEnd: false, at: new THREE.Vector3(0.47 * Math.cos(mid), 0.47 * Math.sin(mid), 0.02) });
      lbls.push(label(`<b>${it.n}</b> ${it.label}`, it.href, it.css || null));
      a -= step * GAP;
    });
    const N = nodes.length, mids = nodes.map(n => n.mid);
    let half = 0;
    const off = (n, th) => Math.max(0, th - n.a0, n.a1 - th);   // 0 = TCP über dem Bogen
    const areaAt = th => nodes.reduce((b, n, i) => (off(n, th) < off(nodes[b], th) ? i : b), 0);
    const setActive = i => {
      const n = nodes[i];
      active = i; n.eT = 0; n.fromEnd = pol.th < n.mid;   // Bogen zeichnet sich von der Seite, über die der Laser kommt
      lbls.forEach((l, k) => l.classList.toggle('on', k === i));
      o.onActive && o.onActive(i);
      half = lbls[i].offsetWidth / 2;   // nach onActive: die Seite schreibt die Beschriftung ggf. neu
      st.kick();
    };
    // Lage direkt setzen (Start, reduzierte Bewegung): Laser über der Bogenmitte, Werkzeug geneigt wie im Lauf
    const poseAt = th => {
      Object.assign(pol, { th, cth: th, gth: th, r: RT, gr: RT, z: Z, gz: Z, vth: 0, vr: 0, vz: 0 });
      pol.tilt = pol.gtilt = TILT * (RT - R0) / (R1 - R0);
      followTick(0);
    };
    // Leerlauf: u = Lage in Bereichen (0 … N−1), Weg je Abschnitt mit weichem Profil (an den Mitten langsamer, nie Stillstand)
    const ease = f => 0.35 * f + 0.65 * f * f * f * (10 + f * (6 * f - 15));
    const angAt = u => { if (N < 2) return mids[0]; const i = Math.min(N - 2, Math.floor(u)); return mids[i] + (mids[i + 1] - mids[i]) * ease(u - i); };
    const uFrom = th => { let best = 0, bd = Infinity; for (let u = 0; u <= N - 1; u += 0.02) { const d = Math.abs(angAt(u) - th); if (d < bd) { bd = d; best = u; } } return best; };
    const camA = Math.atan2(cam.camPos[1], cam.camPos[0]);
    let u = areaAt(camA), dir = 1, hold = null, bob = 0;
    idle = dt => {
      if (hold) { pol.gth = hold.th; if (performance.now() > hold.until) { hold = null; u = uFrom(pol.th); } }
      else if (N > 1) {
        const i = Math.min(N - 2, Math.floor(u));
        u += dir * dt / (1.8 + 2.4 * Math.abs(mids[i + 1] - mids[i]));
        if (u >= N - 1) { u = N - 1; dir = -1; } else if (u <= 0) { u = 0; dir = 1; }
        pol.gth = angAt(u);
      }
      bob += dt; pol.gr = RT; pol.gz = Z + 0.012 + 0.01 * Math.sin(bob * 0.9);
    };
    const leave = () => { follow = false; u = uFrom(pol.th); idleRamp = 0; };
    const disc = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.004);
    // Zeiger auf der Sockelebene (nicht auf Z): Laserpunkt landet dort, wo der Zeiger auf dem Ring steht
    const discAt = e => {
      const r = host.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2);
      ray.setFromCamera(ndc, st.camera);
      return ray.ray.intersectPlane(disc, hit);
    };
    const ringAt = e => {
      if (!discAt(e)) return -1;
      const d = Math.hypot(hit.x, hit.y); if (d < RA - 0.045 || d > RA + 2 * DR + 0.045) return -1;
      const th = Math.atan2(hit.y, hit.x), i = areaAt(th);
      if (off(nodes[active], th) < step * (1 + GAP)) return active;   // Lücke neben dem leuchtenden Bogen zählt zu ihm
      return off(nodes[i], th) < step * 1.5 ? i : -1;
    };
    host.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      if (!reduce) {
        const p = discAt(e);
        if (p && Math.hypot(p.x, p.y) > 0.08) {
          // Winkel direkt (nicht gespiegelt wie bei dome); nur in der Lücke hinter dem Arm (|θ| > TH) Seite halten
          const th = Math.atan2(p.y, p.x);
          follow = true; hold = null; pol.gr = RT;
          pol.gth = Math.abs(th) > TH && Math.sign(th) !== Math.sign(pol.gth || 1) ? Math.sign(pol.gth || 1) * TH : Math.max(-TH, Math.min(TH, th));
        }
        else if (follow) leave();
      }
      const i = ringAt(e);
      host.style.cursor = i >= 0 ? 'pointer' : '';
      if (reduce && i >= 0 && i !== active) { setActive(i); poseAt(mids[i]); }
    });
    host.addEventListener('pointerleave', () => { host.style.cursor = ''; if (follow) leave(); });
    let down = null;
    host.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    host.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 600) return;
      const i = ringAt(e); if (i < 0) return;
      if (e.pointerType === 'mouse' || (hold && hold.i === i) || (reduce && active === i)) { lbls[i].click(); return; }
      if (reduce) { setActive(i); poseAt(mids[i]); return; }
      hold = { i, th: mids[i], until: performance.now() + 6000 };
    });
    pick = i => { if (!nodes[i]) return; if (reduce) { setActive(i); poseAt(mids[i]); } else hold = { i, th: mids[i], until: performance.now() + 6000 }; };
    poseAt(mids[Math.round(u)]); setActive(Math.round(u));
    const ex = extra;
    extra = (dt, t) => {
      ex(dt, t);
      const th = pol.th;
      if (!reduce) { const i = areaAt(th); if (i !== active && off(nodes[i], th) + HYS < off(nodes[active], th)) setActive(i); }
      const k = reduce ? 1 : 1 - Math.exp(-dt * 5);
      tint.lerp(nodes[active].col, reduce ? 1 : 1 - Math.exp(-dt * 3));
      beam.material.color.copy(tint); spot.material.color.copy(tint); spotGlow.material.color.copy(tint);
      nodes.forEach((n, i) => {
        n.glow += ((i === active ? 1 : 0) - n.glow) * k;
        // Punkte: Grundhelle, aktiver Bereich heller, Lichtkegel des Lasers (Gauß ~35 mm) wandert mit
        const c = n.pts.geometry.attributes.color;
        for (let v = 0; v < n.ang.length; v++) {
          const d = (n.ang[v] - th) * RT / 0.035, b = 0.3 + 0.45 * n.glow + 0.9 * Math.exp(-d * d);
          cBuf.copy(n.col).multiplyScalar(b); c.setXYZ(v, cBuf.r, cBuf.g, cBuf.b);
        }
        c.needsUpdate = true;
        const m = Math.round(SEG * Math.min(1, n.glow * 1.15));
        n.hi.geometry.setDrawRange(n.fromEnd ? SEG - m : 0, m);
        if (n.eT < 1 && !reduce) { n.eT = Math.min(1, n.eT + dt / 1.2); const e = 1 - (1 - n.eT) ** 3; n.echo.scale.setScalar(1 + 0.2 * e); n.echo.material.opacity = 0.5 * (1 - n.eT); }
        project(n.at, lbls[i], i === active ? half : 0);
      });
    };
  }
  // ── Pick & Place (dome): drei Ablagefelder, Würfel 50 mm. Würfel anklicken/antippen → anfahren, senkrecht aufsetzen,
  // Sauger an, senkrecht lösen, dabei hoch heben (300 mm) und per Gelenk 6 um 90° drehen; der Arm hält ihn schwebend
  // und meldet „Ablageort wählen“, bis eines der drei Felder gewählt ist (auch das eigene: zurücklegen; nach 25 s von selbst).
  // Feld direkt anklicken → greifen und ohne Halt umsetzen. Transport im hohen Bogen: erst nach vorn gestreckt, Werkzeug
  // geneigt, über dem Ziel wieder eingezogen, senkrecht absetzen, lösen, abheben.
  // Bahnen = Spline durch Stützpunkte mit Minimal-Ruck-Zeitprofil (Weg, Geschwindigkeit, Beschleunigung stetig; Start und
  // Kontakt in Ruhe, Kontaktpunkte exakt); Gelenk 6 bleibt in ±178° (Würfel ist 90°-symmetrisch → Drehlage frei wählbar).
  // Klick-Hinweis: Felder leuchten unregelmäßig kurz auf (Welle läuft nach außen, Würfel-Raster hellt mit), nur in Ruhe;
  // nach dem ersten eigenen Klick seltener; beim Halten pulsieren alle drei im Takt (Wunsch User 05./06.10.2026).
  if (scene === 'dome') {
    const CUBE = 0.05, PR = 0.27, padAng = [-2.05, -0.6, 0.85], table = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
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
    // Puls-Schein (Wunsch User 06.10.2026): Lichthof + Bodenschein atmen langsam (4 s, kleine Amplitude, nur Sinus –
    // nicht an die zufälligen Feld-Blitze gekoppelt, sonst springt er); Lichthof nur so groß/hoch, dass ihn die Tischebene nicht abschneidet
    const aura = sprite(0.1, 0.16), pool = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), glowMat(0)), PULSE = 4;
    const cornerMat = cube.children[3].material, edgeMat = cube.children[2].material;
    // Materialisieren (Wunsch User 06.10.2026): abgelegt bekommt der Würfel ein rotes Material, in Zeitlupe (2,6 s): Scan-Ebene
    // steigt von unten nach oben (darunter fest, darüber noch Raster), Farbe gleitet vom Akzent zu Rot, frisch Materialisiertes
    // glüht warm und kühlt aus. Beim Greifen läuft es schneller (0,9 s) zurück ins Raster. Schnitt = Clipping-Ebenen im Würfelrahmen.
    st.renderer.localClippingEnabled = true;
    const RED = new THREE.Color(0xd9262e), RED2 = new THREE.Color(0xff9a8a), HOT = new THREE.Color(0xffb36b);
    const cutLo = new THREE.Plane(), cutHi = new THREE.Plane();
    const solidMat = new THREE.MeshPhysicalMaterial({ color: RED, roughness: 0.36, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25,
      emissive: HOT, emissiveIntensity: 0, clippingPlanes: [cutLo], clipShadows: true });
    const solid = new THREE.Mesh(box, solidMat); solid.castShadow = true; solid.visible = false;
    const scanLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new THREE.Vector3(x * ch * 1.04, y * ch * 1.04, 0))), lineMat(0));
    const scanGlow = new THREE.Mesh(new THREE.PlaneGeometry(CUBE * 1.9, CUBE * 1.9), glowMat(0)); scanGlow.material.side = THREE.DoubleSide;
    cube.add(solid, scanLine, scanGlow);
    [cubeFill, cubeGrid, cube.children[3]].forEach(o => { o.material.clippingPlanes = [cutHi]; });
    const mat = { v: 0, to: 0, D: 1 };   // v: 0 = Raster … 1 = rotes Material
    const matTo = (to, D) => { mat.to = to; mat.D = D; if (reduce) mat.v = to; };
    const up = new THREE.Vector3(), mid = new THREE.Vector3();
    const applyMat = dt => {
      const fwd = mat.to === 1;
      if (mat.v !== mat.to) mat.v = fwd ? Math.min(1, mat.v + dt / mat.D) : Math.max(0, mat.v - dt / mat.D);
      // Scan-Lage (Minimal-Ruck, im ersten ¾) und Farbanteil (ease-out) aus demselben Fortschritt → Rückweg spielt rückwärts
      const v = mat.v, s = ease5(Math.min(1, v / 0.75)), k = 1 - (1 - v) ** 3, z = -ch * 1.02 + CUBE * 1.04 * s;
      up.set(0, 0, 1).applyQuaternion(cube.quaternion); mid.copy(up).multiplyScalar(z * cube.scale.x).add(cube.position);
      cutHi.setFromNormalAndCoplanarPoint(up, mid); cutLo.copy(cutHi).negate();
      solid.visible = v > 0;
      solidMat.color.copy(ACC).lerp(RED, k);
      const heat = fwd ? 0.7 * (1 - v) ** 2 : 0;
      solidMat.emissive.copy(RED).lerp(HOT, heat / 0.7);
      solidMat.emissiveIntensity = heat + (hoverCube && !held ? 0.25 : 0);
      const b = Math.sin(Math.PI * s);   // Scan-Licht nur unterwegs
      scanLine.position.z = scanGlow.position.z = z;
      scanLine.material.opacity = 0.95 * b; scanGlow.material.opacity = 0.35 * b;
      scanLine.material.color.copy(ACC2).lerp(RED2, k); scanGlow.material.color.copy(ACC).lerp(RED, k);
      edgeMat.color.copy(ACC2).lerp(RED2, k); edgeMat.opacity = 0.95 - 0.5 * k; cornerMat.color.copy(edgeMat.color);
      aura.material.color.copy(ACC).lerp(RED, k); pool.material.color.copy(aura.material.color);
    };
    const flash = ringMesh(0.016, 0.03, 0);
    st.scene.add(cube, flash, aura, pool);
    let at = 0, held = false, hover = -1, hoverCube = false, pending = -1, flashT = 1, clicked = false, clk = 0, touch = false;
    // Ruhe-Hüpfer (Wunsch User 06.10.2026): liegt der Würfel 5 s still, hebt er kurz ab (12 mm, 1,1 s) und dreht sich dabei um
    // 15° (abwechselnd hin und zurück → bleibt am Feld ausgerichtet), landet weich (sin^1.5: Abheben/Aufsetzen ohne Ruck, kein
    // Überschwinger); danach alle 3 s wieder. Ablauf, Würfel im Arm oder Zeiger auf dem Würfel setzen die 5 s neu.
    const HOP_H = 0.012, HOP_D = 1.1, HOP_ROT = Math.PI / 12, HOP_FIRST = 5, HOP_EVERY = 3;
    let rest = 0, hopWait = HOP_FIRST, hopT = -1, hopDir = 1, hopYaw = 0;
    const onPad = i => { cube.position.set(pads[i].g.position.x, pads[i].g.position.y, CUBE / 2); };
    onPad(at);
    // Feld-Zustand + Klick-Hinweis (b = 0…1, Höhe des Aufleuchtens)
    const paint = (p, b = 0) => {
      p.outer.material.opacity = p.on ? 1 : 0.4 + 0.3 * b; p.inner.material.opacity = p.on ? 0.7 : 0.15 + 0.25 * b;
      p.glow.material.opacity = p.on ? 0.75 : 0.22 * b;
    };
    const show = () => {
      const hi = job && job.to >= 0 ? job.to : hover;   // im Arm ist auch das eigene Feld ein Ziel
      pads.forEach((p, i) => { p.on = i === hi && (i !== at || held); paint(p); });
      cubeGrid.material.opacity = hoverCube && !held ? 0.75 : 0.42; cubeFill.material.opacity = hoverCube && !held ? 0.18 : 0.1;
      host.style.cursor = hoverCube || (hover >= 0 && (hover !== at || held)) ? 'pointer' : '';
      applyMat(0); st.kick();
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
    // Lage = [Winkel Gelenk 1, Radius, Höhe TCP, Werkzeugdrehung, Neigung]; Gewichte machen daraus grob Meter (Bahnlänge)
    const KEY = ['th', 'r', 'z', 'yaw', 'tilt'], VEL = ['vth', 'vr', 'vz', 'vyaw', 'vtilt'], W8 = [PR, 1, 1, 0.05, 0.12];   // W8[0] nur für Richtungen (Starttempo)
    const P = (th, r, z, yaw = 0, tilt = 0) => [th, r, z, yaw, tilt];
    const VCAP = 0.5;   // m/s, TCP-Höchstgeschwindigkeit xArm Lite 6 (Datenblatt)
    const pose = () => KEY.map(k => pol[k]);
    const setPose = (p, dt) => KEY.forEach((k, i) => { if (dt > 0) pol[VEL[i]] = (p[i] - pol[k]) / dt; pol[k] = p[i]; });
    // Schwenk zählt mit dem tatsächlichen Radius (Bogenlänge am TCP)
    const gap = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + ((v - b[i]) * (i ? W8[i] : (a[1] + b[1]) / 2)) ** 2, 0));
    const ease5 = u => u * u * u * (10 + u * (6 * u - 15));   // Minimal-Ruck: v und a an beiden Enden 0
    // Bahn ab aktueller Lage: zentripetaler Catmull-Rom (Barry-Goldman, ohne Schleifen/Überschwinger), Dauer aus Länge und
    // vmax (Spitze = 1,875 × Mittel). Laufende Geschwindigkeit wird übernommen: Anteil längs der Bahn als Starttempo im
    // quintischen Zeitprofil (s' (0) = sig), Rest quer dazu klingt in ~0,3 s aus → kein Einbruch, kein Ruck beim Übergang
    const wdot = (a, b) => a.reduce((s, v, i) => s + v * b[i] * W8[i] * W8[i], 0);
    const bahn = (pts, vmax) => {
      const v0 = VEL.map(k => pol[k]), Q = [pose(), ...pts], n = Q.length;
      const E = [Q[0].map((v, i) => 2 * v - Q[1][i]), ...Q, Q[n - 1].map((v, i) => 2 * v - Q[n - 2][i])];
      const tk = [0]; for (let i = 1; i < E.length; i++) tk.push(tk[i - 1] + Math.max(1e-3, Math.sqrt(gap(E[i - 1], E[i]))));
      const lin = (a, b, ta, tb, u) => a.map((v, i) => v + (b[i] - v) * (u - ta) / (tb - ta));
      const u0 = tk[1], U = tk[n] - u0;
      const at = s => {
        const u = u0 + U * s;
        let k = 1; while (k < n - 1 && u > tk[k + 1]) k++;
        const [t0, t1, t2, t3] = tk.slice(k - 1, k + 3), [p0, p1, p2, p3] = E.slice(k - 1, k + 3);
        const a1 = lin(p0, p1, t0, t1, u), a2 = lin(p1, p2, t1, t2, u), a3 = lin(p2, p3, t2, t3, u);
        return lin(lin(a1, a2, t0, t2, u), lin(a2, a3, t1, t3, u), t1, t2, u);
      };
      let len = 0, prev = Q[0];
      for (let i = 1; i <= 48; i++) { const c = at(i / 48); len += gap(prev, c); prev = c; }
      const tan = at(1e-3).map((v, i) => (v - Q[0][i]) / 1e-3), tt = wdot(tan, tan);
      let D = Math.max(0.7, 1.875 * len / vmax), sig = 0, vq = v0;
      const pos = t => {
        const x = Math.min(1, t / D), e = ease5(x), c = at(e + sig * x * (1 - x) ** 3 * (1 + 3 * x)), f = t * Math.exp(-t / 0.3) * (1 - e);
        return c.map((v, i) => v + vq[i] * f);
      };
      // Starttempo übernehmen, dann Dauer strecken, bis die Spitze ≤ VCAP bleibt (übernommenes Tempo bleibt dabei gleich)
      for (let pass = 0; pass < 3; pass++) {
        sig = tt > 1e-9 ? Math.max(0, Math.min(2, D * wdot(v0, tan) / tt)) : 0; vq = v0.map((v, i) => v - tan[i] * sig / D);
        let top = 0, a = pos(0);
        for (let i = 1; i <= 60; i++) { const b = pos(D * i / 60); top = Math.max(top, gap(a, b) * 60 / D); a = b; }
        if (top <= VCAP) break;
        D *= top / VCAP * 1.02;
      }
      return { D, at: pos };
    };
    // Werkzeugdrehung am Ziel: nächste 90°-Lage, bei der Gelenk 6 (= Winkel − Drehung) sicher in ±178° bleibt
    const yawFor = (th, y) => {
      let best = 0, bd = Infinity;
      for (let k = -4; k <= 4; k++) { const c = Math.round(y / (Math.PI / 2)) * Math.PI / 2 + k * Math.PI / 2; if (Math.abs(th - c) < 2.7 && Math.abs(c - y) < bd) { bd = Math.abs(c - y); best = c; } }
      return best;
    };
    const grip = () => {
      if (hopT >= 0) { hopT = -1; cube.position.z = ch; }   // greift mitten im Ruhe-Hüpfer: erst landen
      held = true; blink(); matTo(0, 0.9);
      // Würfel hängt fest am Sauger: Lage + Versatz im Werkzeugrahmen merken (bleibt bei geneigtem Werkzeug dran)
      robot.tcp.getWorldQuaternion(tcpQ); rel.copy(tcpQ).invert().multiply(cube.quaternion);
      robot.tcp.getWorldPosition(tcpW); relP.subVectors(cube.position, tcpW).applyQuaternion(tcpQ.clone().invert());
    };
    const drop = () => { held = false; at = job.to; onPad(at); cube.rotation.set(0, 0, cube.rotation.z); blink(); matTo(1, 2.6); };
    let busy = 0, lean = 0, vlean = 0;
    // Ablauf = Liste: { pts, v } Bahn · { act, dwell } Greifen/Lösen mit Verweilzeit · { hold } schweben bis Ziel gewählt ·
    // { lazy } wird erst beim Erreichen zu Schritten (Lage dann bekannt); say = Status-Popup beim Start des Schritts
    const go = (ops, to) => {
      let i = -1, op = null, t = 0, path = null;
      const next = () => {
        op = ops[++i]; t = 0; path = null;
        if (op && op.lazy) { ops.splice(i, 1, ...op.lazy()); op = ops[i]; }
        if (!op) return finish();
        if (op.say) feed.say(...op.say);
        if (op.pts) path = bahn(op.pts, op.v);
        if (op.act) op.act();
        if (op.hold && job.to < 0) {
          job.hold = true; lean = vlean = 0;
          feed.say(T('Ablageort wählen', 'Choose a drop spot'), touch ? T('einen der 3 Kreise antippen', 'tap one of the 3 circles') : T('einen der 3 Kreise anklicken', 'click one of the 3 circles'));
          pads.forEach((p, k) => { p.next = clk + 0.3 + k * 0.25; });
          show();
        }
      };
      job = { to, hold: false, tick: dt => {
        t += dt; if (!job.hold) busy += dt;
        if (op.hold && job.to < 0 && t > 25) { job.to = at; show(); }   // niemand wählt → zurücklegen
        if (op.hold && job.to >= 0) { job.hold = false; ops.push(...place(job.to, false)); next(); t = dt; }   // gleich im selben Frame los
        if (path) { setPose(path.at(t), dt); if (t >= path.D) next(); return; }
        if (op.hold) {
          // Schweben: leichtes Wiegen + Würfel pendelt um die Hochachse; Arm neigt sich zum Feld unter dem Zeiger
          const H = op.hold, e = Math.min(1, t / 1.5), env = e * e * (3 - 2 * e);
          const g = hover >= 0 ? Math.max(-0.3, Math.min(0.3, 0.2 * (padAng[hover] - H[0]))) : 0;
          [lean, vlean] = spring(lean, vlean, g, 3, dt);
          setPose(P(H[0] + lean + env * 0.05 * Math.sin(0.9 * t), H[1] + env * 0.012 * Math.sin(0.7 * t + 1),
            H[2] + env * 0.01 * Math.sin(1.3 * t), H[3] + env * 0.2 * Math.sin(0.6 * t)), dt);
          return;
        }
        setPose(pose(), dt);
        if (t >= (op.dwell || 0)) next();
      } };
      const finish = () => {
        job = null; pol.gyaw = 0;
        const sec = busy.toFixed(1);
        feed.say(T('Fertig', 'Done'), `${T(sec.replace('.', ','), sec)} s`, true);
        if (follow) setGoalXY(ptr.x, ptr.y); else { ph = nearestPhase(); idleRamp = 0; }
        show();
        if (pending >= 0) { const n = pending; pending = -1; start(n); }
      };
      next(); show();
    };
    // Ablegen auf Feld B, ab Halteposition oder (low) direkt vom Greifen: senkrecht lösen, Bogen nach vorn gestreckt,
    // über dem Ziel eingezogen, senkrecht absetzen; danach senkrecht abheben, Werkzeug dreht zurück
    const place = (to, low) => {
      const A = padAng[at], B = padAng[to], y0 = pol.yaw, yB = yawFor(B, y0), m = k => A + (B - A) * k, y = k => y0 + (yB - y0) * k;
      const pts = low ? [P(A, PR, CUBE + 0.035, y0)] : [];
      if (to === at) pts.push(P(A, 0.25, 0.19, yB));
      else pts.push(P(m(0.2), 0.3, 0.31, y(0.2), 0.35), P(m(0.55), 0.37, 0.29, y(0.55), 0.7), P(m(0.85), 0.29, 0.2, y(0.85), 0.25));
      pts.push(P(B, PR, 0.11, yB), P(B, PR, 0.08, yB), P(B, PR, CUBE, yB));
      const deg = Math.round(Math.abs(B - A) * 180 / Math.PI);
      return [
        { pts, v: 0.38, say: to === at ? [T('Zurücklegen', 'Put back'), xy(pads[to].g.position)] : [T('Transport', 'Transfer'), `${T('Schwenk', 'swing')} ${deg}°`] },
        { act: drop, dwell: 0.25, say: [T('Ablegen', 'Place'), T('Sauger aus', 'suction off')] },
        { pts: [P(B, PR, CUBE + 0.03, yB), P(B, 0.25, 0.14)], v: 0.22 },
      ];
    };
    // Greifen am eigenen Feld: anfahren, die letzten 30 mm senkrecht absetzen, Sauger an; Ziel schon bekannt → direkt
    // ablegen, sonst drehend hoch heben und warten. Drehsinn so, dass Gelenk 6 in ±178° bleibt.
    const pick = to => {
      const A = padAng[at], d = A > 0 ? Math.PI / 2 : -Math.PI / 2;
      feed.reset(); busy = 0;
      go([
        { pts: [P(A, PR, 0.11), P(A, PR, 0.08), P(A, PR, CUBE)], v: 0.36, say: [T('Anfahren', 'Approach'), xy(pads[at].g.position)] },
        { act: grip, dwell: 0.25, say: [T('Greifen', 'Grip'), T('Sauger an', 'suction on')] },
        { lazy: () => job.to >= 0 ? place(job.to, true) : [
          { pts: [P(A, PR, CUBE + 0.035), P(A, 0.25, 0.18, d * 0.45), P(A, 0.23, 0.3, d)], v: 0.25,
            say: [T('Anheben + drehen', 'Lift + rotate'), `z 300 mm · ${T('Gelenk', 'joint')} 6 ${d > 0 ? '+' : '−'}90°`] },
          { hold: P(A, 0.23, 0.3, d) }] },
      ], to);
    };
    // Feld gewählt: im Arm → dort ablegen; Würfel liegt → greifen und umsetzen; Arm beschäftigt → danach
    const start = to => {
      if (reduce) { if (to !== at) { at = to; onPad(at); matTo(1); show(); feed.reset(); feed.say(T('Abgelegt', 'Placed'), xy(cube.position), true); } return; }
      if (job) { if (job.to < 0) { job.to = to; show(); } else if (to !== job.to) pending = to; return; }
      if (to !== at) pick(to);
    };
    const grab = () => {
      if (reduce) { feed.reset(); feed.say(T('Ablageort wählen', 'Choose a drop spot'), T('Kreis wählen', 'pick a circle'), true); return; }
      if (!job) pick(-1);
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
      touch = e.pointerType !== 'mouse';
      if (cubeAt(e, tol)) { clicked = true; grab(); return; }
      const i = padAt(e, tol); if (i >= 0) { clicked = true; start(i); }
    });
    const ex = extra;
    extra = (dt, t) => {
      ex(dt, t);
      if (held) {
        robot.tcp.getWorldPosition(tcpW); robot.tcp.getWorldQuaternion(tcpQ);
        cube.position.copy(relP).applyQuaternion(tcpQ).add(tcpW); cube.quaternion.multiplyQuaternions(tcpQ, rel);
      }
      // Ruhe-Hüpfer vor applyMat: Schnittebenen des Materials folgen der Lage im selben Frame
      if (!reduce) {
        if (hopT >= 0) {
          hopT = Math.min(1, hopT + dt / HOP_D);
          cube.position.z = ch + HOP_H * Math.sin(Math.PI * hopT) ** 1.5;
          cube.rotation.z = hopYaw + hopDir * HOP_ROT * ease5(hopT);
          if (hopT === 1) { hopT = -1; hopDir = -hopDir; rest = 0; hopWait = HOP_EVERY; }
        } else if (job || held || hoverCube) { rest = 0; hopWait = HOP_FIRST; }
        else if ((rest += dt) >= hopWait) { hopT = 0; hopYaw = cube.rotation.z; }
      }
      applyMat(dt);
      if (flashT < 1) { flashT = Math.min(1, flashT + dt / 0.45); flash.material.opacity = 0.95 * (1 - flashT); flash.scale.setScalar(1 + flashT * 1.6); }
      if (reduce) return;
      // Klick-Hinweis: je Feld eigener, zufälliger Takt; während Ablauf, Hover oder im Arm verschoben statt gezeigt
      clk += dt;
      let cubeB = 0;
      pads.forEach((p, i) => {
        if (clk >= p.next) {
          if (job && job.hold) { p.t0 = clk; p.next = clk + 1.8; }   // Ablageort gesucht: alle im Takt
          else if (job || held || hover >= 0 || hoverCube || p.on) p.next = clk + rnd(1, 3);
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
      const pu = Math.sin(Math.PI * t / PULSE) ** 2, r = 0.05 + 0.006 * pu;
      aura.material.opacity = 0.16 + 0.08 * pu; aura.scale.setScalar(2 * r);
      aura.position.copy(cube.position); if (!held) aura.position.z = Math.max(aura.position.z, r + 0.003);
      pool.visible = !held; pool.position.set(cube.position.x, cube.position.y, 0.0028);
      const air = held ? 0 : Math.max(0, cube.position.z - ch) / HOP_H;   // Bodenschein wird beim Abheben etwas kleiner + schwächer
      pool.material.opacity = (0.2 + 0.1 * pu) * (1 - 0.3 * air); pool.scale.setScalar((0.95 + 0.06 * pu) * (1 - 0.12 * air));
      cornerMat.size = 0.016 + 0.003 * pu; cube.scale.setScalar(1 + 0.008 * pu);
      if (!hoverCube) cubeFill.material.opacity = 0.09 + 0.03 * pu;
    };
    show();
  }
  if (!reduce) st.isBusy = () => true;
  if (reduce && scene === 'modes') { q = goal; robot.setJoints(q); }

  // Auto-Orbit läuft nach Ruhe weich an statt mit voller Geschwindigkeit zu starten
  let orbitRamp = 0;
  tick = (dt, t) => {
    if (!reduce) {
      if (scene === 'dome' || scene === 'cell' || scene === 'atlas') followTick(dt);
      else if (scene !== 'ghost') damp(dt, 2.5);
      orbitRamp = st.controls.autoRotate ? Math.min(1, orbitRamp + dt / 2.5) : 0;
      st.controls.autoRotateSpeed = 0.3 * orbitRamp * orbitRamp * (3 - 2 * orbitRamp);
      if (dash) dash.rotation.z -= dt * Math.PI * 2 / 60;
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
