/* Hero-Bühne der Projektseiten (Skill motion-viz §3): xArm Lite 6 (js/lite6_twin.js) auf Sockel mit Lichtringen,
   Laser-Zielhilfe senkrecht auf den Tisch; Ziehen dreht die Kamera. Szene je Seite (opts.scene):
     dome   Arbeitsraum als Punktkuppel (Reichweite 440 mm um Gelenk 2); Zeiger bewegt den TCP, sonst langsame Acht;
            Mini-Spiel „Missionen“: Würfel, Quader, Zylinder (Rastergitter) in die passende Aussparung legen lassen, Sprechblasen,
            Missionsliste (.h3d-quest), Klänge per WebAudio; Formen leuchten als Klick-Hinweis kurz auf,
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
  // ── Pick & Place (dome) als Mini-Spiel „Missionen“ (Wunsch User 06.10.2026, Vorschau „Pick & Place als Mini-Spiel“, Variante C):
  // drei Objekte als Raster (Würfel 50 mm, Quader 80 × 40 × 30 mm, Zylinder Ø 48 × 50 mm) liegen zufällig im Greifbereich,
  // dazu drei passende Aussparungen (Schablonen). Objekt anklicken/antippen → anfahren, senkrecht aufsetzen, Sauger an, drehend
  // auf 300 mm heben und schwebend halten, bis eine Form gewählt ist. Passende Form → Transport im hohen Bogen, senkrecht absetzen,
  // Objekt rutscht in die Form (sinkt 8 mm, richtet sich aus), materialisiert in seiner Farbe (Würfel blau, Quader rot, Zylinder
  // grün) und bedankt sich per Sprechblase. Falsche Form → „Da pass ich nicht rein!“, Arm hält weiter. Startplatz anklicken oder
  // 25 s nichts wählen → zurücklegen. Alle drei zu Hause → Abzeichen, nach 6,5 s neue Runde mit neuer Lage.
  // Missionsliste oben links; Lage, Stand, Runden und Klang an/aus in localStorage (F3). Klänge per WebAudio, nur als Antwort
  // auf eigene Klicks (Browser erlaubt Ton erst nach einer Geste), leise, abschaltbar.
  // Bahnen = Spline durch Stützpunkte mit Minimal-Ruck-Zeitprofil (Weg, Geschwindigkeit, Beschleunigung stetig; Start und
  // Kontakt in Ruhe, Kontaktpunkte exakt); Gelenk 6 bleibt in ±178°.
  if (scene === 'dome') {
    const T = (de, en) => (document.documentElement.lang === 'en' ? en : de), mm = v => String(Math.round(v * 1000)).replace('-', '−');
    const PR = 0.27, SINK = 0.008, BACK = 3, table = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const rnd = (a, b) => a + Math.random() * (b - a);
    const KINDS = [
      { id: 'cube', de: 'Würfel', en: 'cube', S: [0.05, 0.05, 0.05], sym: Math.PI / 2, color: 0x2f6fe8, glow: 0x9cc0ff },
      { id: 'box', de: 'Quader', en: 'cuboid', S: [0.08, 0.04, 0.03], sym: Math.PI, color: 0xd9262e, glow: 0xff9a8a },
      { id: 'cyl', de: 'Zylinder', en: 'cylinder', S: [0.048, 0.048, 0.05], sym: 0, color: 0x23a55a, glow: 0x9ef0b8 },
    ];
    const HOT = new THREE.Color(0xffb36b);
    const segs = v => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    // Umriss der Grundfläche (m = Rand nach außen), für Aussparung, Scan-Linie, Welle
    const outline = (K, m, z = 0) => K.id === 'cyl'
      ? [...Array(48)].map((_, i) => new THREE.Vector3((K.S[0] / 2 + m) * Math.cos(i / 48 * 2 * Math.PI), (K.S[0] / 2 + m) * Math.sin(i / 48 * 2 * Math.PI), z))
      : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new THREE.Vector3(x * (K.S[0] / 2 + m), y * (K.S[1] / 2 + m), z));
    const lineLoop = (pts, op) => new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat(op));
    // Raster auf allen Flächen (Rückseiten scheinen durch), Linienabstand ~12,5 mm
    const gridBox = S => {
      const v = [];
      for (let ax = 0; ax < 3; ax++) for (const f of [-S[ax] / 2, S[ax] / 2]) {
        const b = (ax + 1) % 3, d = (ax + 2) % 3;
        for (const [u, w] of [[b, d], [d, b]]) {
          const n = Math.max(2, Math.round(S[u] / 0.0125));
          for (let k = 1; k < n; k++) { const p0 = [0, 0, 0], p1 = [0, 0, 0]; p0[ax] = p1[ax] = f; p0[u] = p1[u] = -S[u] / 2 + S[u] * k / n; p0[w] = -S[w] / 2; p1[w] = S[w] / 2; v.push(...p0, ...p1); }
        }
      }
      return segs(v);
    };
    const gridCyl = (r, h) => {
      const v = [], ring = (z, rr) => { for (let i = 0; i < 48; i++) { const a = i / 48 * 2 * Math.PI, b = (i + 1) / 48 * 2 * Math.PI; v.push(rr * Math.cos(a), rr * Math.sin(a), z, rr * Math.cos(b), rr * Math.sin(b), z); } };
      for (let k = 1; k < 4; k++) ring(-h / 2 + h * k / 4, r);
      for (const z of [-h / 2, h / 2]) ring(z, r / 2);
      for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * Math.PI, x = r * Math.cos(a), y = r * Math.sin(a); v.push(x, y, -h / 2, x, y, h / 2); }
      return segs(v);
    };
    // Objekt: Hauch Füllung, Raster, helle Kanten, Eckpunkte; dazu festes Material (Materialisieren per Scan-Ebene, Clipping im Objektrahmen)
    st.renderer.localClippingEnabled = true;
    const makeObj = K => {
      const [sx, sy, sz] = K.S, cyl = K.id === 'cyl';
      const body = cyl ? new THREE.CylinderGeometry(sx / 2, sx / 2, sz, 40).rotateX(Math.PI / 2) : new THREE.BoxGeometry(sx, sy, sz);
      const g = new THREE.Group(), col = new THREE.Color(K.color);
      const fill = new THREE.Mesh(body, new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.1, depthWrite: false }));
      const grid = new THREE.LineSegments(cyl ? gridCyl(sx / 2, sz) : gridBox(K.S), lineMat(0.42));
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(body, 30), lineMat(0.95, ACC2));
      const cp = cyl ? [...Array(16)].flatMap((_, k) => { const a = (k % 8) / 8 * 2 * Math.PI; return [sx / 2 * Math.cos(a), sx / 2 * Math.sin(a), k < 8 ? -sz / 2 : sz / 2]; })
        : [0, 1, 2, 3, 4, 5, 6, 7].flatMap(k => [(k & 1 ? 1 : -1) * sx / 2, (k & 2 ? 1 : -1) * sy / 2, (k & 4 ? 1 : -1) * sz / 2]);
      const pts = new THREE.Points(segs(cp), new THREE.PointsMaterial({ map: dot, color: ACC2, size: 0.016, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      const cutLo = new THREE.Plane(), cutHi = new THREE.Plane();
      const solidMat = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.36, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25,
        emissive: HOT, emissiveIntensity: 0, clippingPlanes: [cutLo], clipShadows: true });
      const solid = new THREE.Mesh(body, solidMat); solid.castShadow = true; solid.visible = false;
      const scanLine = lineLoop(outline(K, 0.001), 0);
      const scanGlow = new THREE.Mesh(new THREE.PlaneGeometry(sx * 1.9, sy * 1.9), glowMat(0)); scanGlow.material.side = THREE.DoubleSide;
      [fill, grid, pts].forEach(o => { o.material.clippingPlanes = [cutHi]; });
      g.add(fill, grid, edge, pts, solid, scanLine, scanGlow);
      const aura = sprite(0.1, 0.16), pool = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), glowMat(0));
      st.scene.add(g, aura, pool);
      return { K, h: sz, g, fill, grid, edge, pts, solid, solidMat, scanLine, scanGlow, cutLo, cutHi, col, glow: new THREE.Color(K.glow), aura, pool,
        slot: null, home: false, mat: { v: 0, to: 0, D: 1 }, hopT: -1, hopDir: 1, hopYaw: 0, swell: 0, popT: 1, sinkT: 1, yaw0: 0, yaw1: 0, shake: 0 };
    };
    // Aussparung: dunkle Grundfläche + Rand (innen schwächere Kante = Tiefe), Schein und Welle als Klick-Hinweis
    const makeTpl = K => {
      const g = new THREE.Group(), M = 0.006;
      const hole = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(outline(K, M).map(p => new THREE.Vector2(p.x, p.y))), 24),
        new THREE.MeshBasicMaterial({ color: 0x05080a, transparent: true, opacity: 0.55, depthWrite: false }));
      const rim = lineLoop(outline(K, M), 0.55), lip = lineLoop(outline(K, M - 0.004), 0.18), wave = lineLoop(outline(K, M + 0.002), 0);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), glowMat(0)); glow.position.z = -0.0007;
      g.add(hole, glow, rim, lip, wave); st.scene.add(g);
      return { K, g, rim, lip, glow, wave, col: new THREE.Color(K.color), slot: null, on: false, full: false, t0: -9, next: 2 + rnd(0, 3) };
    };
    const OBJ = KINDS.map(makeObj), TPL = KINDS.map(makeTpl);
    const flash = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.03, 48), new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    st.scene.add(flash);
    let cur = null, held = false, hover = -1, hoverObj = null, flashT = 1, clicked = false, clk = 0, touch = false, rounds = 0, mute = false, newRoundAt = 0;
    const slotXY = s => [s.r * Math.cos(s.a), s.r * Math.sin(s.a)];
    const xy = s => { const [x, y] = slotXY(s); return `x ${mm(x)} · y ${mm(y)} mm`; };
    const ring = (x, y, z) => { flashT = 0; flash.position.set(x, y, z); };
    // Zufallslage: 6 Plätze im Greifbereich (Winkel −140° … +72°, vor und neben dem Arm; Radius 210–320 mm; ≥ 115 mm Abstand)
    const layout = () => {
      const s = [], dist = (p, q) => { const [a, b] = slotXY(p), [c, d] = slotXY(q); return Math.hypot(a - c, b - d); };
      for (let n = 0; n < 3000 && s.length < 6; n++) { const c = { a: rnd(-2.45, 1.25), r: rnd(0.21, 0.32) }; if (s.every(o => dist(o, c) > 0.115)) s.push(c); }
      if (s.length < 6) s.splice(0, 6, ...[[-2.2, 0.24], [-0.9, 0.24], [0.4, 0.24], [-1.55, 0.3], [-0.25, 0.3], [1.05, 0.3]].map(([a, r]) => ({ a, r })));
      return { objs: s.slice(0, 3), tpls: s.slice(3).map(c => ({ ...c, yaw: rnd(-0.6, 0.6) })), home: [false, false, false] };
    };
    const putAt = (o, s) => { o.slot = s; const [x, y] = slotXY(s); o.g.position.set(x, y, o.h / 2 - (o.home ? SINK : 0)); };
    // Speichern: Lage, Stand, Runden, Klang (privates Fenster/gesperrt → Spiel läuft ohne Merken)
    const STORE = 'hero3d.missions.v1';
    const save = () => { try { localStorage.setItem(STORE, JSON.stringify({ rounds, mute, objs: OBJ.map(o => ({ a: o.slot.a, r: o.slot.r })), tpls: TPL.map(t => t.slot), home: OBJ.map(o => o.home) })); } catch (e) { /* ohne Merken */ } };
    const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } })();
    rounds = Number.isInteger(saved.rounds) && saved.rounds > 0 ? saved.rounds : 0; mute = saved.mute === true;

    // Klänge (Wunsch User 06.10.2026: dezent, an sinnvoller Stelle): kurze Sinus-/Dreieckstöne mit weicher Hüllkurve, nur nach
    // eigenem Klick (Greifen, Ablegen, zu Hause, falsche Form, Runde geschafft, Sprechblase); nie im Leerlauf
    const sfx = (() => {
      let ac = null, out = null;
      const tone = (f, t0, d, vol = 0.05, type = 'sine', f1 = f) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
        o.type = type; o.frequency.setValueAtTime(f, t); if (f1 !== f) o.frequency.exponentialRampToValueAtTime(f1, t + d);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
      };
      const SND = {
        grip: () => tone(330, 0, 0.11, 0.06, 'triangle', 170),                                   // Sauger an: weiches „Plopp“ abwärts
        release: () => tone(190, 0, 0.12, 0.045, 'triangle', 360),                               // Sauger aus: kurz aufwärts
        pop: () => tone(900, 0, 0.07, 0.03, 'sine', 1350),                                       // Sprechblase
        home: () => [523.25, 659.25, 783.99].forEach((f, k) => tone(f, k * 0.09, 0.55, 0.04)), // C-Dur aufwärts
        nope: () => { tone(233, 0, 0.13, 0.05, 'triangle', 207); tone(196, 0.13, 0.2, 0.05, 'triangle', 175); },
        win: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => tone(f, 0.55 + k * 0.12, 0.9, 0.035)),
      };
      const play = name => { if (mute || !ac || ac.state !== 'running') return; try { SND[name](); } catch (e) { /* ohne Ton weiter */ } };
      // Erst in einer Nutzergeste anlegen/fortsetzen (Autoplay-Regel der Browser)
      play.unlock = () => {
        try {
          if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; ac = new C(); out = ac.createGain(); out.gain.value = 0.8; out.connect(ac.destination); }
          if (ac.state === 'suspended') ac.resume();
        } catch (e) { ac = null; }
      };
      return play;
    })();
    // Sprechblase am Objekt (HTML über der Bühne, folgt der Lage auf dem Bildschirm); eine zur Zeit
    const say = (() => {
      const el = document.createElement('div'); el.className = 'h3d-say'; el.setAttribute('aria-hidden', 'true'); host.appendChild(el);
      const v = new THREE.Vector3();
      let o = null, until = 0;
      const place = () => {
        v.copy(o.g.position); v.z += o.h * 0.6 + 0.02; v.project(st.camera);
        el.style.left = `${(v.x + 1) / 2 * host.clientWidth}px`; el.style.top = `${(1 - v.y) / 2 * host.clientHeight}px`;
      };
      return {
        show(obj, text, ms = 2600, quiet = false) {
          o = obj; el.textContent = text; place(); el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
          until = performance.now() + ms; if (!quiet) sfx('pop');
        },
        hide() { el.classList.remove('in'); until = 0; },
        tick() { if (!o) return; place(); if (until && performance.now() > until) { el.classList.remove('in'); until = 0; } },
      };
    })();
    // Missionsliste oben links mit Abzeichen-Zeile; Klang-Knopf (einziges Bedienelement, 32 px)
    const quest = (() => {
      const box = document.createElement('div'); box.className = 'h3d-quest';
      box.innerHTML = '<div class="h3d-q-head"><b></b><span></span><button type="button" class="h3d-q-snd"><svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path class="w" d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/><path class="x" d="M16 9.5l5 5M21 9.5l-5 5"/></svg></button></div>' +
        '<ul></ul><div class="h3d-q-bar"><i></i></div><p></p>';
      const badge = document.createElement('div'); badge.className = 'h3d-badge'; badge.setAttribute('role', 'status');
      box.append(badge); host.append(box);   // Abzeichen als Zeile in der Liste: überdeckt nie die Bühne
      const [title, count, btn] = box.querySelector('.h3d-q-head').children, list = box.querySelector('ul'), bar = box.querySelector('.h3d-q-bar i'), foot = box.querySelector('p');
      let badgeT = 0;
      const render = () => {
        const n = OBJ.filter(o => o.home).length;
        title.textContent = T('Missionen', 'Missions'); count.textContent = `${n} / 3`;
        list.replaceChildren(...OBJ.map(o => {
          const li = document.createElement('li'), i = document.createElement('i'), s = document.createElement('span');
          li.className = o.home ? 'ok' : ''; li.style.setProperty('--c', `#${o.K.color.toString(16).padStart(6, '0')}`);
          s.textContent = T(`${o.K.de} nach Hause bringen`, `Bring the ${o.K.en} home`); li.append(i, s);
          if (o.home) { const ck = document.createElement('b'); ck.className = 'ck'; ck.textContent = '✓'; li.append(ck); }   // erledigt: grüner Haken dahinter, Text bleibt lesbar
          return li;
        }));
        bar.style.width = `${n / 3 * 100}%`;
        foot.textContent = T(`Runden geschafft: ${rounds}`, `Rounds completed: ${rounds}`); foot.hidden = !rounds;
        box.classList.toggle('muted', mute);
        btn.setAttribute('aria-pressed', String(!mute)); btn.setAttribute('aria-label', T('Klänge', 'Sounds'));
        btn.title = mute ? T('Klänge einschalten', 'Turn sounds on') : T('Klänge ausschalten', 'Turn sounds off');
      };
      btn.addEventListener('click', () => { mute = !mute; render(); save(); if (!mute) { sfx.unlock(); sfx('pop'); } });
      new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      return {
        render,
        badge() {
          badge.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-star"/></svg><span></span>';
          badge.lastChild.textContent = T(`Pick-&-Place-Profi · Runde ${rounds} geschafft!`, `Pick & place pro · round ${rounds} done!`);
          badge.classList.add('in'); clearTimeout(badgeT); badgeT = setTimeout(() => badge.classList.remove('in'), 5200);
        },
      };
    })();
    // Neue Runde: Formen + Objekte an ihre Plätze, Objekte ploppen gestaffelt auf (0,6 s, ease-out)
    const newRound = Lx => {
      newRoundAt = 0; say.hide();
      Lx.tpls.forEach((s, k) => { const t = TPL[k]; t.slot = s; const [x, y] = slotXY(s); t.g.position.set(x, y, 0.0025); t.g.rotation.z = s.yaw; t.full = false; });
      OBJ.forEach((o, k) => {
        o.home = !!Lx.home[k]; TPL[k].full = o.home; o.hopT = -1; o.swell = 0; o.sinkT = 1;
        o.g.rotation.set(0, 0, o.home ? TPL[k].slot.yaw : rnd(-0.5, 0.5)); putAt(o, o.home ? TPL[k].slot : Lx.objs[k]);
        o.mat.v = o.mat.to = o.home ? 1 : 0; o.popT = reduce ? 1 : -0.15 * k;
      });
      quest.render(); save(); show();
    };
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
    // Materialisieren (Wunsch User 06.10.2026): zu Hause bekommt das Objekt sein Material in Zeitlupe (2,6 s): Scan-Ebene steigt
    // von unten nach oben (darunter fest, darüber noch Raster), Farbe gleitet vom Akzent zur Objektfarbe, frisch Materialisiertes
    // glüht warm und kühlt aus. Schnitt = Clipping-Ebenen im Objektrahmen.
    const up = new THREE.Vector3(), mid = new THREE.Vector3();
    const applyMat = (o, dt) => {
      const m = o.mat, fwd = m.to === 1;
      if (m.v !== m.to) m.v = fwd ? Math.min(1, m.v + dt / m.D) : Math.max(0, m.v - dt / m.D);
      // Scan-Lage (Minimal-Ruck, im ersten ¾) und Farbanteil (ease-out) aus demselben Fortschritt → Rückweg spielt rückwärts
      const v = m.v, s = ease5(Math.min(1, v / 0.75)), k = 1 - (1 - v) ** 3, z = -o.h / 2 * 1.02 + o.h * 1.04 * s;
      up.set(0, 0, 1).applyQuaternion(o.g.quaternion); mid.copy(up).multiplyScalar(z * o.g.scale.x).add(o.g.position);
      o.cutHi.setFromNormalAndCoplanarPoint(up, mid); o.cutLo.copy(o.cutHi).negate();
      o.solid.visible = v > 0;
      o.solidMat.color.copy(ACC).lerp(o.col, k);
      const heat = fwd ? 0.7 * (1 - v) ** 2 : 0;
      o.solidMat.emissive.copy(o.col).lerp(HOT, heat / 0.7);
      o.solidMat.emissiveIntensity = heat;
      const b = Math.sin(Math.PI * s);   // Scan-Licht nur unterwegs
      o.scanLine.position.z = o.scanGlow.position.z = z;
      o.scanLine.material.opacity = 0.95 * b; o.scanGlow.material.opacity = 0.35 * b;
      o.scanLine.material.color.copy(ACC2).lerp(o.glow, k); o.scanGlow.material.color.copy(ACC).lerp(o.col, k);
      o.edge.material.color.copy(ACC2).lerp(o.glow, k); o.edge.material.opacity = 0.95 - 0.5 * k; o.pts.material.color.copy(o.edge.material.color);
      o.aura.material.color.copy(ACC).lerp(o.col, k); o.pool.material.color.copy(o.aura.material.color);
    };
    // Form-Zustand + Klick-Hinweis (b = 0…1, Höhe des Aufleuchtens); belegte Form: Rand in Objektfarbe
    const paintT = (t, b = 0) => {
      t.rim.material.color.copy(t.full ? t.col : ACC);
      t.rim.material.opacity = t.full ? 0.5 : t.on ? 1 : 0.55 + 0.35 * b; t.lip.material.opacity = t.full ? 0.1 : t.on ? 0.5 : 0.18 + 0.2 * b;
      t.glow.material.opacity = t.full ? 0 : t.on ? 0.75 : 0.22 * b;
    };
    const show = () => {
      const hi = job && job.to >= 0 && job.to !== BACK ? job.to : hover;
      TPL.forEach((t, k) => { t.on = !t.full && k === hi; paintT(t); });
      OBJ.forEach(o => { if (o === hoverObj) { o.grid.material.opacity = 0.75; o.fill.material.opacity = 0.18; } applyMat(o, 0); });
      host.style.cursor = hoverObj || hover >= 0 ? 'pointer' : '';
      st.kick();
    };
    const pickRay = e => {
      const r = host.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2);
      ray.setFromCamera(ndc, st.camera);
    };
    // Objekt unter dem Zeiger: Strahl trifft den Körper oder den Boden nahe am Objekt (großes Ziel auch für Finger);
    // zu Hause, im Arm oder während eines Ablaufs nicht wählbar
    const objAt = (e, tol) => {
      if (job) return null;
      const free = OBJ.filter(o => !o.home && o.popT >= 0.6);
      pickRay(e);
      const h = ray.intersectObjects(free.map(o => o.fill))[0];
      if (h) return free.find(o => o.fill === h.object);
      if (!ray.ray.intersectPlane(table, hit)) return null;
      let best = null, bd = tol;
      free.forEach(o => { const d = Math.hypot(hit.x - o.g.position.x, hit.y - o.g.position.y); if (d < bd) { bd = d; best = o; } });
      return best;
    };
    // Ziel unter dem Zeiger: freie Form (Index) oder Startplatz des gewählten Objekts (BACK)
    const tplAt = (e, tol) => {
      pickRay(e);
      if (!ray.ray.intersectPlane(table, hit)) return -1;
      let best = -1, bd = tol;
      TPL.forEach((t, k) => { if (t.full) return; const d = Math.hypot(hit.x - t.g.position.x, hit.y - t.g.position.y); if (d < bd) { bd = d; best = k; } });
      if (cur) { const [x, y] = slotXY(cur.slot); if (Math.hypot(hit.x - x, hit.y - y) < bd) best = BACK; }
      return best;
    };
    const grip = () => {
      const o = cur;
      if (o.hopT >= 0) { o.hopT = -1; o.swell = 0; o.g.position.z = o.h / 2; o.g.rotation.x = 0; }   // greift mitten im Hüpfer: erst landen
      held = true; ring(o.g.position.x, o.g.position.y, o.g.position.z + o.h / 2 + 0.002); sfx('grip');
      // Objekt hängt fest am Sauger: Lage + Versatz im Werkzeugrahmen merken (bleibt bei geneigtem Werkzeug dran)
      robot.tcp.getWorldQuaternion(tcpQ); rel.copy(tcpQ).invert().multiply(o.g.quaternion);
      robot.tcp.getWorldPosition(tcpW); relP.subVectors(o.g.position, tcpW).applyQuaternion(tcpQ.clone().invert());
    };
    // Drehlage in der Form: nächste Lage, die zur Form passt (Würfel 90°, Quader 180°, Zylinder beliebig)
    const alignYaw = (y, target, sym) => sym ? target + Math.round((y - target) / sym) * sym : y;
    const drop = () => {
      const o = cur, to = job.to; held = false;
      o.g.rotation.set(0, 0, o.g.rotation.z); sfx('release');
      if (to === BACK) { putAt(o, o.slot); return; }
      const t = TPL[to]; t.full = true; putAt(o, t.slot); o.home = true; o.g.position.z = o.h / 2;   // sinkt erst beim Einrutschen
      o.yaw0 = o.g.rotation.z; o.yaw1 = alignYaw(o.yaw0, t.slot.yaw, o.K.sym); o.sinkT = 0;
      o.mat.to = 1; o.mat.D = 2.6;
    };
    // Zu Hause angekommen (nach dem Einrutschen): Dank, Klang, Mission abhaken; alle drei → Abzeichen, neue Runde
    // Dank-Sprüche (Wunsch User 06.10.2026), nie zweimal hintereinander derselbe
    const THANKS = [['Ahh…, endlich Zuhause!', 'Ahh…, home at last!'], ['Hier bin ich sicher.', "I'm safe here."], ["War ja 'n Kinderspiel!", 'That was child’s play!']];
    let thx = -1;
    const arrived = o => {
      thx = (thx + 1 + Math.floor(Math.random() * (THANKS.length - 1))) % THANKS.length;
      say.show(o, T(...THANKS[thx]), 3000, true); sfx('home');
      if (OBJ.every(x => x.home)) { rounds++; quest.badge(); sfx('win'); newRoundAt = clk + 6.5; }
      quest.render(); save(); show();
    };
    const nope = () => {
      say.show(cur, T('Da pass ich nicht rein!', "I don't fit in there!"), 2200, true); sfx('nope'); cur.shake = 1;
    };
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
          feed.say(T('Form wählen', 'Choose a shape'), touch ? T('passende Form antippen', 'tap the matching shape') : T('passende Form anklicken', 'click the matching shape'));
          TPL.forEach((p, k) => { p.next = clk + 0.3 + k * 0.25; });
          show();
        }
      };
      job = { to, hold: false, tick: dt => {
        t += dt; if (!job.hold) busy += dt;
        if (op.hold && job.to < 0 && t > 25) { job.to = BACK; show(); }   // niemand wählt → zurücklegen
        if (op.hold && job.to >= 0) { job.hold = false; ops.push(...place(job.to, false)); next(); t = dt; }   // gleich im selben Frame los
        if (path) { setPose(path.at(t), dt); if (t >= path.D) next(); return; }
        if (op.hold) {
          // Schweben: leichtes Wiegen + Objekt pendelt um die Hochachse; Arm neigt sich zum Ziel unter dem Zeiger
          const H = op.hold, e = Math.min(1, t / 1.5), env = e * e * (3 - 2 * e);
          const ha = hover === BACK ? cur.slot.a : hover >= 0 ? TPL[hover].slot.a : H[0];
          [lean, vlean] = spring(lean, vlean, Math.max(-0.3, Math.min(0.3, 0.2 * (ha - H[0]))), 3, dt);
          setPose(P(H[0] + lean + env * 0.05 * Math.sin(0.9 * t), H[1] + env * 0.012 * Math.sin(0.7 * t + 1),
            H[2] + env * 0.01 * Math.sin(1.3 * t), H[3] + env * 0.2 * Math.sin(0.6 * t)), dt);
          return;
        }
        setPose(pose(), dt);
        if (t >= (op.dwell || 0)) next();
      } };
      const finish = () => {
        job = null; cur = null; pol.gyaw = 0;
        const sec = busy.toFixed(1);
        feed.say(T('Fertig', 'Done'), `${T(sec.replace('.', ','), sec)} s`, true);
        if (follow) setGoalXY(ptr.x, ptr.y); else { ph = nearestPhase(); idleRamp = 0; }
        show();
      };
      next(); show();
    };
    // Ablegen in Form B (oder zurück auf den Startplatz), ab Halteposition oder (low) direkt vom Greifen: senkrecht lösen,
    // Bogen nach vorn gestreckt (≤ 370 mm), über dem Ziel eingezogen, senkrecht absetzen; danach senkrecht abheben, Werkzeug dreht zurück
    const place = (to, low) => {
      const o = cur, A = o.slot.a, R = o.slot.r, H = o.h, S = to === BACK ? o.slot : TPL[to].slot, B = S.a, RB = S.r;
      const y0 = pol.yaw, yB = yawFor(B, y0), m = k => A + (B - A) * k, y = k => y0 + (yB - y0) * k;
      const rr = (k, b) => Math.min(0.37, R + (RB - R) * k + b);
      const pts = low ? [P(A, R, H + 0.035, y0)] : [];
      if (to === BACK) pts.push(P(A, 0.25, 0.19, yB));
      else pts.push(P(m(0.2), rr(0.2, 0.03), 0.31, y(0.2), 0.35), P(m(0.55), rr(0.55, 0.1), 0.29, y(0.55), 0.7), P(m(0.85), rr(0.85, 0.02), 0.2, y(0.85), 0.25));
      pts.push(P(B, RB, H + 0.06, yB), P(B, RB, H + 0.03, yB), P(B, RB, H, yB));
      const deg = Math.round(Math.abs(B - A) * 180 / Math.PI);
      return [
        { pts, v: 0.38, say: to === BACK ? [T('Zurücklegen', 'Put back'), xy(S)] : [T('Transport', 'Transfer'), `${T('Schwenk', 'swing')} ${deg}°`] },
        { act: drop, dwell: 0.25, say: [T('Ablegen', 'Place'), T('Sauger aus', 'suction off')] },
        { pts: [P(B, RB, H + 0.03, yB), P(B, 0.25, 0.14)], v: 0.22 },
      ];
    };
    // Greifen am Startplatz: anfahren, die letzten 30 mm senkrecht absetzen, Sauger an; Ziel schon bekannt → direkt
    // ablegen, sonst drehend hoch heben und warten. Drehsinn so, dass Gelenk 6 in ±178° bleibt.
    const pick = to => {
      const o = cur, A = o.slot.a, R = o.slot.r, H = o.h, d = A > 0 ? Math.PI / 2 : -Math.PI / 2;
      feed.reset(); busy = 0;
      go([
        { pts: [P(A, R, H + 0.06), P(A, R, H + 0.03), P(A, R, H)], v: 0.36, say: [T('Anfahren', 'Approach'), xy(o.slot)] },
        { act: grip, dwell: 0.25, say: [T('Greifen', 'Grip'), T('Sauger an', 'suction on')] },
        { lazy: () => job.to >= 0 ? place(job.to, true) : [
          { pts: [P(A, R, H + 0.035), P(A, 0.25, 0.18, d * 0.45), P(A, 0.23, 0.3, d)], v: 0.25,
            say: [T('Anheben + drehen', 'Lift + rotate'), `z 300 mm · ${T('Gelenk', 'joint')} 6 ${d > 0 ? '+' : '−'}90°`] },
          { hold: P(A, 0.23, 0.3, d) }] },
      ], to);
    };
    // Objekt gewählt → greifen (reduzierte Bewegung: nur markieren)
    const grab = o => {
      if (job) return;
      cur = o; say.hide();
      if (reduce) { feed.reset(); feed.say(T('Form wählen', 'Choose a shape'), T('passende Form wählen', 'pick the matching shape'), true); show(); return; }
      pick(-1);
    };
    // Ziel gewählt: passende Form → ablegen; falsche → ablehnen; Startplatz → zurücklegen; ohne Objekt → Hinweis
    const target = k => {
      if (!cur) { feed.reset(); feed.say(T('Erst ein Objekt anheben', 'Lift an object first'), touch ? T('Objekt antippen', 'tap an object') : T('Objekt anklicken', 'click an object'), true); return; }
      if (job && job.to >= 0) return;   // Ziel steht schon fest
      if (k !== BACK && TPL[k].K !== cur.K) { nope(); return; }
      if (reduce) {
        const o = cur; cur = null;
        if (k !== BACK) { o.home = true; TPL[k].full = true; o.g.rotation.set(0, 0, TPL[k].slot.yaw); putAt(o, TPL[k].slot); o.mat.v = o.mat.to = 1; arrived(o); }
        show(); return;
      }
      if (job && job.to < 0) { job.to = k; show(); }
    };
    let down = null;
    host.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const o = objAt(e, 0.06), k = o || !cur ? -1 : tplAt(e, 0.07);
      if (o !== hoverObj || k !== hover) { hoverObj = o; hover = k; show(); }
    });
    host.addEventListener('pointerleave', () => { if (hover >= 0 || hoverObj) { hover = -1; hoverObj = null; show(); } });
    host.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    // Tippen/Klick = kurz und ohne Ziehen (Ziehen dreht weiter die Kamera); Klang-Knopf hat eigenen Klick
    host.addEventListener('pointerup', e => {
      if (e.target.closest('button') || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 600) return;
      const tol = e.pointerType === 'mouse' ? 0.06 : 0.08;
      touch = e.pointerType !== 'mouse'; sfx.unlock();
      const o = objAt(e, tol); if (o) { clicked = true; grab(o); return; }
      const k = tplAt(e, tol + 0.01); if (k >= 0) { clicked = true; target(k); }
    });
    // Ruhe-Hüpfer (Wunsch User 06.10.2026, bewusst gegen soft-motion §5: Klick-Einladung): liegt alles 5 s still, hebt ein freies
    // Objekt ab (24 mm, 1,3 s), dreht sich um 30° und kippt leicht (abwechselnd hin und zurück), schwillt um 8 % an, Lichthof hellt
    // auf; landet weich (sin^1.5) mit Ring am Boden; danach alle 3 s das nächste. Vor dem ersten Klick sagt jedes dritte „Heb mich auf!“.
    const HOP_H = 0.024, HOP_D = 1.3, HOP_ROT = Math.PI / 6, HOP_TILT = 0.12, HOP_SWELL = 0.08, HOP_FIRST = 5, HOP_EVERY = 3;
    let rest = 0, hopWait = HOP_FIRST, hopIdx = 0, hops = 0;
    // Puls-Schein: Lichthof + Bodenschein atmen langsam (4 s, nur Sinus); eigene Uhr in s (pt). Mesh-Fade: alle 8 s blendet das
    // Raster weich auf 45 % und zurück (1,8 s, sin²), bei Hover, Ablauf oder im Arm klingt der Fade aus
    const PULSE = 4, FADE_EVERY = 8, FADE_D = 1.8, FADE_MIN = 0.45, ZAX = new THREE.Vector3(0, 0, 1);
    let pt = 0, fadeAmp = 1;
    const ex = extra;
    extra = (dt, t) => {
      ex(dt, t);
      clk += dt; pt += dt;
      if (newRoundAt && clk >= newRoundAt && !job) newRound(layout());
      if (held) {
        robot.tcp.getWorldPosition(tcpW); robot.tcp.getWorldQuaternion(tcpQ);
        cur.g.position.copy(relP).applyQuaternion(tcpQ).add(tcpW); cur.g.quaternion.multiplyQuaternions(tcpQ, rel);
        if (cur.shake > 0) { cur.shake = Math.max(0, cur.shake - dt / 0.6); cur.g.rotateOnWorldAxis(ZAX, 0.14 * Math.sin(cur.shake * Math.PI * 4) * cur.shake); }   // „nein“: kurz schütteln
      }
      // Ruhe-Hüpfer + Einrutschen vor applyMat: Schnittebenen des Materials folgen der Lage im selben Frame
      if (!reduce) {
        const hopping = OBJ.find(o => o.hopT >= 0);
        if (hopping) {
          const o = hopping, arc = Math.sin(Math.PI * (o.hopT = Math.min(1, o.hopT + dt / HOP_D)));
          o.g.position.z = o.h / 2 + HOP_H * arc ** 1.5;
          o.g.rotation.z = o.hopYaw + o.hopDir * HOP_ROT * ease5(o.hopT);
          o.g.rotation.x = o.hopDir * HOP_TILT * arc ** 2; o.swell = arc ** 2;
          if (o.hopT === 1) { o.hopT = -1; o.hopDir = -o.hopDir; o.swell = 0; o.g.rotation.x = 0; rest = 0; hopWait = HOP_EVERY; ring(o.g.position.x, o.g.position.y, 0.003); }
        } else if (job || cur || hoverObj || newRoundAt) { rest = 0; hopWait = HOP_FIRST; }
        else if ((rest += dt) >= hopWait) {
          const free = OBJ.filter(o => !o.home && o.popT >= 1);
          if (free.length) {
            const o = free[hopIdx++ % free.length]; o.hopT = 0; o.hopYaw = o.g.rotation.z;
            if (!clicked && hops++ % 3 === 0) say.show(o, T('Heb mich auf!', 'Pick me up!'), 2200, true);
          }
          rest = 0;
        }
      }
      OBJ.forEach(o => {
        if (o.sinkT < 1) {
          o.sinkT = reduce ? 1 : Math.min(1, o.sinkT + dt / 0.55);
          const e = ease5(o.sinkT);
          o.g.position.z = o.h / 2 - SINK * e; o.g.rotation.z = o.yaw0 + (o.yaw1 - o.yaw0) * e;
          if (o.sinkT === 1) arrived(o);
        }
        if (o.popT < 1) o.popT = Math.min(1, o.popT + dt / 0.6);
        applyMat(o, dt);
      });
      if (flashT < 1) { flashT = Math.min(1, flashT + dt / 0.45); flash.material.opacity = 0.95 * (1 - flashT); flash.scale.setScalar(1 + flashT * 1.6); }
      say.tick();
      // Klick-Hinweis der Formen: in Ruhe selten und zufällig, während ein Objekt eine Form sucht alle im Takt
      if (!reduce) TPL.forEach(p => {
        if (p.full) return;
        if (clk >= p.next) {
          if (cur && (!job || job.hold)) { p.t0 = clk; p.next = clk + 1.8; }
          else if (job || hover >= 0 || hoverObj || p.on) p.next = clk + rnd(1, 3);
          else { p.t0 = clk; p.next = clk + rnd(5, 10) * (clicked ? 2 : 1); }
        }
        const u = (clk - p.t0) / 1.6;
        if (u > 1.05) return;
        const k = Math.min(1, u), b = Math.sin(Math.PI * k) ** 2;
        if (!p.on) paintT(p, b);
        p.wave.material.opacity = 0.32 * (1 - k) * Math.min(1, k * 6); p.wave.scale.setScalar(1 + k * 0.5);
      });
      const fu = ((pt + 3) % FADE_EVERY) / FADE_D, quiet = !(job || held || hoverObj);
      fadeAmp += ((quiet ? 1 : 0) - fadeAmp) * Math.min(1, dt * 3);
      const fade = reduce ? 1 : 1 - (1 - FADE_MIN) * fadeAmp * (fu < 1 ? Math.sin(Math.PI * fu) ** 2 : 0);
      const pu = reduce ? 0.5 : Math.sin(Math.PI * pt / PULSE) ** 2, r = 0.05 + 0.006 * pu;
      OBJ.forEach(o => {
        const inArm = held && o === cur, f = o.home ? 1 : fade, pop = o.popT <= 0 ? 0.001 : 1 - (1 - o.popT) ** 3;
        if (o !== hoverObj) { o.grid.material.opacity = 0.42 * f; o.fill.material.opacity = (0.09 + 0.03 * pu) * f; }
        o.edge.material.opacity *= f; o.pts.material.opacity = 0.9 * f; o.pts.material.size = 0.016 + 0.003 * pu;
        o.aura.material.opacity = ((o.home ? 0.07 : 0.16 + 0.08 * pu) + 0.14 * o.swell) * pop; o.aura.scale.setScalar(2 * r * (1 + 0.25 * o.swell));
        o.aura.position.copy(o.g.position); if (!inArm) o.aura.position.z = Math.max(o.aura.position.z, r + 0.003);
        o.pool.visible = !inArm; o.pool.position.set(o.g.position.x, o.g.position.y, 0.0028);
        const air = inArm ? 0 : Math.max(0, o.g.position.z - o.h / 2) / HOP_H;   // Bodenschein wird beim Abheben etwas kleiner + schwächer
        o.pool.material.opacity = (0.2 + 0.1 * pu) * (1 - 0.3 * air) * (o.home ? 0.5 : 1) * pop; o.pool.scale.setScalar((0.95 + 0.06 * pu) * (1 - 0.12 * air));
        o.g.scale.setScalar(pop * (1 + 0.008 * pu + HOP_SWELL * o.swell));
      });
    };
    // Start: gemerkte Runde (gültig und nicht schon fertig) oder neue Zufallslage
    const okSlot = s => s && Number.isFinite(s.a) && Number.isFinite(s.r) && s.r > 0.15 && s.r < 0.35 && Math.abs(s.a) < 2.6;
    const arr3 = a => Array.isArray(a) && a.length === 3;
    newRound(arr3(saved.objs) && saved.objs.every(okSlot) && arr3(saved.tpls) && saved.tpls.every(s => okSlot(s) && Number.isFinite(s.yaw))
      && arr3(saved.home) && !saved.home.every(Boolean) ? { objs: saved.objs, tpls: saved.tpls, home: saved.home.map(Boolean) } : layout());
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
