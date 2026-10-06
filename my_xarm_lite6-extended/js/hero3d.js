/* Hero-Bühne der Projektseiten (Skill motion-viz §3): xArm Lite 6 (js/lite6_twin.js) auf Sockel mit Lichtringen,
   Laser-Zielhilfe senkrecht auf den Tisch; Ziehen dreht die Kamera. Szene je Seite (opts.scene):
     dome   Arbeitsraum als Punktkuppel (Reichweite 440 mm um Gelenk 2); Zeiger bewegt den TCP, sonst langsame Acht;
            Mini-Spiel „Missionen“: Würfel, Quader, Zylinder (Rastergitter) in die passende Aussparung legen lassen, Sprechblasen,
            Missionsstand in der Szene (Bögen am Bodenring, Lichtschrift davor, Klang-Knopf .h3d-snd), Klänge der Robot Control UI (docs/sounds/); freie Objekte wandern langsam über die
            Kreisfläche; Formen leuchten als Klick-Hinweis kurz auf,
            Arm spricht per Sprechblase am Werkzeug (Spruch + Fortschritt · Schritt · Messwert), Objekte antworten; Licht etwas gedämpft
     modes  Steuerwege als Lichtpunkte im Ring (opts.items); aktiver Punkt schickt einen Impuls zum Arm, der Arm zeigt hin
     ghost  Ghost-Arm plant voraus → Freigabe → Arm fährt nach („Erst virtuell, dann real“); Zeiger setzt das Ziel;
            next() plant sofort das nächste Ziel (Teilhabe: neuer Steuerweg = neue Eingabe)
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
// Klänge (dome) liegen neben dem Skript in docs/sounds/; currentScript gibt es nur beim Laden
const SND_DIR = document.currentScript ? new URL('../sounds/', document.currentScript.src).href : 'sounds/';

const webgl = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
const CAM = {
  dome: { target: [0, 0, 0.16], camPos: [1.47, -1.13, 0.87] },  // 1,26 × Abstand: ganze Kuppel im Bild (Wunsch User 06.10.2026)
  modes: { target: [0, 0, 0.12], camPos: [1.86, -1.46, 1.42] },
  ghost: { target: [0.06, 0, 0.16], camPos: [1.22, -0.97, 0.77] },  // näher: Arm füllt die breite Bühne (Teilhabe, Wunsch User 06.10.2026)
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
  let active = 0, pick = null, next = null;
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
      gGoal = s; robot.tcp.getWorldPosition(start); tn = 0; tg.setDrawRange(0, 0); flash.material.opacity = 0; setPhase('plan', t);
    };
    host.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const p = pointerPlane(e); if (!p) return;
      follow = true; rest = performance.now();
      const s = solve(p.x, p.y, gGoal); if (s) { gGoal = s; if (phase !== 'plan') { robot.tcp.getWorldPosition(start); tn = 0; tg.setDrawRange(0, 0); setPhase('plan', rest); } }
    });
    host.addEventListener('pointerleave', () => { follow = false; });
    next = () => { if (reduce) return; wp = (wp + 1) % WAY.length; plan(...WAY[wp], performance.now()); };
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
  // dome (Hero mit Pick & Place): Schlangenlinie im Bogen um den Sockel (±146°, Radius 170–340 mm aus zwei Wellen), TCP hebt
  // und senkt sich dazu in zwei eigenen Takten (100–250 mm, bleibt über dem Würfel), Werkzeug dreht (±23°) und nickt (±7°) mit;
  // alle Frequenzen ganzzahlig → Bahn schließt sich nach IDLE_T. Mehr Raum, gleiche Ruhe (Wunsch User 06.10.2026)
  const snake = ph => [2.55 * Math.sin(ph), 0.255 + 0.055 * Math.sin(7 * ph) + 0.03 * Math.sin(2 * ph + 0.8)];
  const loop = scene === 'dome' ? snake : eight;
  const lift = scene === 'dome' ? ph => Z + 0.075 + 0.05 * Math.sin(5 * ph + 1) + 0.025 * Math.sin(3 * ph) : ph => Z + 0.03 + 0.03 * Math.sin(3 * ph);
  const turn = scene === 'dome' ? ph => 0.4 * Math.sin(3 * ph + 0.5) : () => 0;
  const nod = scene === 'dome' ? ph => 0.12 * Math.sin(4 * ph + 2) : () => 0;
  // ZF = TCP-Höhe beim Folgen (dome tiefer: Türme ab zwei Objekten sind im Weg → umstoßen); clearZ = Leerlauf bleibt darüber
  const ZF = scene === 'dome' ? 0.07 : Z;
  let ph = 0, idleRamp = 1, idle = null, clearZ = 0, wave = 0;   // idle(dt): eigener Leerlauf statt Acht (atlas), setzt pol.gth/gr/gz
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
        else { ph += dt * Math.PI * 2 / IDLE_T * ramp; [pol.gth, pol.gr] = loop(ph); pol.gz = Math.max(clearZ, lift(ph)); pol.gyaw = turn(ph); wave = nod(ph); }
      } else { pol.gz = ZF; pol.gyaw = 0; wave = 0; }
      pol.gtilt = TILT * Math.max(0, Math.min(1, (pol.gr - R0) / (R1 - R0))) + wave;
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
  // Freie Ablage (Wunsch User 06.10.2026): statt einer Form jede freie Stelle der Kreisfläche anklicken → Objekt liegt dort
  // (neuer Startplatz); Umriss unter dem Zeiger zeigt die Lage, belegte Stelle → „Hier ist kein Platz!“.
  // Stoppuhr (Wunsch User 06.10.2026, Vorschau „Missionen-Board mit Stoppuhr“, Variante C): startet beim ersten Objekt-Klick der
  // Runde; läuft, solange der Arm fährt oder der Zeiger auf der Bühne ist und es in den letzten 15 s eine Eingabe gab; sonst Pause.
  // Zählt nur gezeichnete Bilder (Tab verdeckt, Bühne aus dem Bild → Uhr steht); drittes Objekt zu Hause → Endzeit, ggf. Bestzeit.
  // Missionsliste oben links; Lage, Stand, Runden, Zeit, Bestzeit und Klang an/aus in localStorage (F3). Klänge der Robot Control UI,
  // nur als Antwort auf eigene Klicks (Browser erlaubt Ton erst nach einer Geste), leise, abschaltbar.
  // Wandern: freie Objekte gleiten langsam auf zufälligen Bahnen über die Kreisfläche, ohne sich oder die Formen zu berühren.
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
      // Schnitt: Material behält, was nicht über cutLo UND unter cutX liegt (Schnittmenge), Raster nur zwischen cutHi und cutY;
      // ohne Schimmer-Band schneidet cutX alles und cutY nichts → eine Scan-Ebene wie beim Materialisieren
      const cutLo = new THREE.Plane(), cutHi = new THREE.Plane(), cutX = new THREE.Plane(), cutY = new THREE.Plane();
      const solidMat = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.36, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25,
        emissive: HOT, emissiveIntensity: 0, clippingPlanes: [cutLo, cutX], clipIntersection: true, clipShadows: true });
      const solid = new THREE.Mesh(body, solidMat); solid.castShadow = true; solid.visible = false;
      const scanLine = lineLoop(outline(K, 0.001), 0), scanLine2 = lineLoop(outline(K, 0.001), 0);
      const scanGlow = new THREE.Mesh(new THREE.PlaneGeometry(sx * 1.9, sy * 1.9), glowMat(0)); scanGlow.material.side = THREE.DoubleSide;
      [fill, grid, pts].forEach(o => { o.material.clippingPlanes = [cutHi, cutY]; });
      g.add(fill, grid, edge, pts, solid, scanLine, scanLine2, scanGlow);
      const aura = sprite(0.1, 0.16), pool = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), glowMat(0));
      st.scene.add(g, aura, pool);
      // Zielerfassung: vier Eckwinkel um die Grundfläche, zwei Wellen im Umriss; Ablage-Umriss (Vorschau der freien Stelle)
      // Winkel + Wellen als Flächen (4 mm bzw. 3 mm breit): 1-px-Linien gehen auf der hellen Kreisfläche unter
      const flat = op => new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false });
      const X = sx / 2 + 0.012, Y = (cyl ? sx : sy) / 2 + 0.012, Lk = 0.35 * Math.min(X, Y) + 0.008, BW = 0.004, bv = [];
      const bar = (x0, y0, x1, y1) => bv.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
      [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([u, w]) => { bar(u * (X + BW / 2), w * (Y + BW / 2), u * (X - Lk), w * (Y - BW / 2)); bar(u * (X + BW / 2), w * (Y + BW / 2), u * (X - BW / 2), w * (Y - Lk)); });
      const lock = new THREE.Group(), brk = new THREE.Mesh(segs(bv), flat(0));
      const tips = new THREE.Points(segs([[1, 1], [-1, 1], [-1, -1], [1, -1]].flatMap(([u, w]) => [u * X, w * Y, 0])),
        new THREE.PointsMaterial({ map: dot, color: ACC2, size: 0.022, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      const band = new THREE.Shape(outline(K, 0.009).map(p => new THREE.Vector2(p.x, p.y)));
      band.holes.push(new THREE.Path(outline(K, 0.006).map(p => new THREE.Vector2(p.x, p.y))));
      const waves = [0, 1].map(() => new THREE.Mesh(new THREE.ShapeGeometry(band, 24), flat(0)));
      lock.add(brk, tips); lock.visible = false; waves.forEach(w => { w.visible = false; });
      const ghost = new THREE.Group(), gFill = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(outline(K, 0.002).map(p => new THREE.Vector2(p.x, p.y))), 24),
        new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.14, depthWrite: false }));
      const gRim = lineLoop(outline(K, 0.002), 0.9);
      ghost.add(gFill, gRim); ghost.visible = false;
      st.scene.add(lock, ...waves, ghost);
      return { K, h: sz, g, fill, grid, edge, pts, solid, solidMat, scanLine, scanLine2, scanGlow, cutLo, cutHi, cutX, cutY, col, sw: -1, swUp: true, swNext: rnd(3, 7), glow: new THREE.Color(K.glow), aura, pool,
        lock, brk, tips, waves, ghost, gFill, gRim, yawG: 0,
        slot: null, home: false, mat: { v: 0, to: 0, D: 1 }, hopT: -1, hopDir: 1, hopYaw: 0, swell: 0, popT: 1, sinkT: 1, yaw0: 0, yaw1: 0, shake: 0,
        on: null, from: null, fall: null, pickTop: sz };
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
    // Leitstrahl TCP → Objekt während des Anfahrens: Linie + Lichtpunkte, die vom Objekt zum Sauger steigen
    const BEAM_N = 5, beamPos = new Float32Array(BEAM_N * 3);
    const beamLine = new THREE.Line(segs([0, 0, 0, 0, 0, 0]), lineMat(0, ACC2));
    const beamDots = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(beamPos, 3)),
      new THREE.PointsMaterial({ map: dot, color: ACC2, size: 0.026, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    beamLine.frustumCulled = beamDots.frustumCulled = false; beamLine.visible = beamDots.visible = false;
    st.scene.add(beamLine, beamDots);
    // Freie Ablage: Ziel FREE = Stelle spot (unter dem Zeiger) bzw. freeS (gewählt)
    // Stapeln (Wunsch User 06.10.2026): Ziel STACK + i = oben auf Objekt i (freies, oberstes Objekt eines Turms); o.on = Objekt darunter
    const FREE = 4, STACK = 5, foot = K => Math.hypot(K.S[0], K.S[1]) / 2 + 0.006;
    const topZ = o => o.g.position.z + o.h / 2, above = o => OBJ.find(q => q.on === o) || null, floorZ = o => (o.on ? topZ(o.on) : 0);
    const topOf = o => { while (above(o)) o = above(o); return o; };
    let spot = null, freeS = null, fx = null;   // fx = laufende Zielerfassung { o, t, out }
    let stackObj = null;   // Turm-Ziel unter dem Zeiger bzw. gewählt (Raster hell, Umriss oben drauf)
    let cur = null, held = false, hover = -1, hoverObj = null, flashT = 1, clicked = false, greeted = false, clk = 0, touch = false, rounds = 0, mute = false, newRoundAt = 0;
    // Stoppuhr: tRun = Laufzeit der Runde (s), best = Bestzeit (s, 0 = keine), inside = Maus auf der Bühne, lastIn = letzte Eingabe (clk)
    let tRun = 0, started = false, finished = false, best = 0, newBest = false, inside = false, lastIn = -1e9;
    const IDLE = 15;
    const slotXY = s => [s.r * Math.cos(s.a), s.r * Math.sin(s.a)];
    const xy = s => { const [x, y] = slotXY(s); return `x ${mm(x)} · y ${mm(y)} mm`; };
    const ring = (x, y, z) => { flashT = 0; flash.position.set(x, y, z); };
    // Zufallslage: 6 Plätze im Greifbereich (Winkel −140° … +72°, vor und neben dem Arm; Radius 210–320 mm; ≥ 115 mm Abstand)
    const layout = () => {
      const s = [], dist = (p, q) => { const [a, b] = slotXY(p), [c, d] = slotXY(q); return Math.hypot(a - c, b - d); };
      for (let n = 0; n < 3000 && s.length < 6; n++) { const c = { a: rnd(-2.45, 1.25), r: rnd(0.21, 0.32) }; if (s.every(o => dist(o, c) > 0.115)) s.push(c); }
      if (s.length < 6) s.splice(0, 6, ...[[-2.2, 0.24], [-0.9, 0.24], [0.4, 0.24], [-1.55, 0.3], [-0.25, 0.3], [1.05, 0.3]].map(([a, r]) => ({ a, r })));
      return { objs: s.slice(0, 3), tpls: s.slice(3).map(c => ({ ...c, yaw: rnd(-0.6, 0.6) })), home: [false, false, false], on: [-1, -1, -1], mat: [0, 0, 0] };
    };
    const putAt = (o, s) => { o.slot = s; const [x, y] = slotXY(s); o.g.position.set(x, y, (o.on ? topZ(o.on) : 0) + o.h / 2 - (o.home ? SINK : 0)); };
    // Speichern: Lage, Stand, Runden, Klang (privates Fenster/gesperrt → Spiel läuft ohne Merken)
    const STORE = 'hero3d.missions.v1';
    const save = () => { try { localStorage.setItem(STORE, JSON.stringify({ rounds, mute, t: tRun, best, objs: OBJ.map(o => ({ a: o.slot.a, r: o.slot.r })), tpls: TPL.map(t => t.slot), home: OBJ.map(o => o.home),
      on: OBJ.map(o => OBJ.indexOf(o === cur && held ? o.from : o.on)), mat: OBJ.map(o => o.mat.to) })); } catch (e) { /* ohne Merken */ } };
    const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } })();
    rounds = Number.isInteger(saved.rounds) && saved.rounds > 0 ? saved.rounds : 0; mute = saved.mute === true;
    const secs = v => (Number.isFinite(v) && v > 0 && v < 36000 ? v : 0);
    best = secs(saved.best);
    // m:ss,z (Zehntel; en mit Punkt)
    const fmt = v => { const z = Math.floor(v * 10), m = Math.floor(z / 600); return `${m}:${String(Math.floor(z / 10) % 60).padStart(2, '0')}${T(',', '.')}${z % 10}`; };

    // Klänge (Wunsch User 06.10.2026: dezent, an sinnvoller Stelle, Klänge der Robot Control UI): Dateien aus ~/dev_ws/sounds,
    // zugeschnitten (Stille weg, Ausblenden), mono, auf −3 dB Spitze angeglichen → docs/sounds/hero_*.mp3. Bedeutung wie in der
    // Robot Control UI: Objekt wählen = Auswahl-Klick + Ansage („blue cube“, „red rectangle“, „green cylinder“ – passen zu den
    // Objekten), Arm fährt los = Motor-Klang, falsche Form/kein Platz = Fehlerton, zu Hause = Chime, Runde geschafft = Chime eine
    // Quinte höher über dem Dreiklang, Sprechblase/Klang an = UI-Klick. Sauger an/aus bleiben kurze WebAudio-Töne (kein passender
    // Klang vorhanden). Jede Wiedergabe ±3 % verstimmt (Wiederholung klingt nicht mechanisch); fehlt eine Datei → WebAudio-Ersatzton.
    // Nur nach eigenem Klick, nie im Leerlauf.
    const sfx = (() => {
      let ac = null, out = null, on = false, said = '', saidAt = 0;
      const tone = (f, t0, d, vol = 0.05, type = 'sine', f1 = f) => {
        if (!ac || ac.state !== 'running') return;
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
        o.type = type; o.frequency.setValueAtTime(f, t); if (f1 !== f) o.frequency.exponentialRampToValueAtTime(f1, t + d);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
      };
      // Datei-Klang: vol 0…1, rate = Tonhöhe (1 = original), at = Verzögerung (s), alt = Ersatzton; Audio-Element statt WebAudio-Puffer,
      // weil fetch() unter file:// gesperrt ist
      const FILES = ['select', 'voice_cube', 'voice_box', 'voice_cyl', 'click', 'error', 'chime', 'motor'], el = {};
      const smp = (id, vol, { rate = 1, at = 0, jit = 0.03, alt } = {}) => {
        const go = () => {
          if (mute) return;
          const a = el[id].cloneNode(); a.volume = vol; a.preservesPitch = false; a.playbackRate = rate * (1 + (Math.random() * 2 - 1) * jit);
          a.play().catch(() => alt && alt());
        };
        if (at) setTimeout(go, at * 1000); else go();
      };
      const SND = {
        // Objekt gewählt: Auswahl-Klick, dann Ansage des Objekts (gleiche Ansage nicht öfter als alle 6 s)
        lock: o => {
          smp('select', 0.32, { alt: () => { tone(660, 0, 0.07, 0.03, 'sine', 990); tone(1320, 0.08, 0.1, 0.02); } });
          const v = `voice_${o.K.id}`; if (v !== said || clk - saidAt > 6) { said = v; saidAt = clk; smp(v, 0.42, { at: 0.38, jit: 0 }); }
        },
        move: () => smp('motor', 0.2, { jit: 0.05 }),                                             // Arm fährt los (Anfahren, Heben, Transport)
        grip: () => tone(330, 0, 0.11, 0.06, 'triangle', 170),                                   // Sauger an: weiches „Plopp“ abwärts
        release: () => tone(190, 0, 0.12, 0.045, 'triangle', 360),                               // Sauger aus: kurz aufwärts
        thud: () => tone(130, 0, 0.16, 0.06, 'triangle', 70),                                    // umgekipptes Objekt schlägt auf
        pop: () => smp('click', 0.4, { alt: () => tone(900, 0, 0.07, 0.03, 'sine', 1350) }),      // Sprechblase
        home: () => smp('chime', 0.42, { alt: () => [523.25, 659.25, 783.99].forEach((f, k) => tone(f, k * 0.09, 0.55, 0.04)) }),
        nope: () => smp('error', 0.26, { alt: () => { tone(233, 0, 0.13, 0.05, 'triangle', 207); tone(196, 0.13, 0.2, 0.05, 'triangle', 175); } }),
        win: () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => tone(f, 0.55 + k * 0.12, 0.9, 0.03)); smp('chime', 0.36, { rate: 1.5, at: 0.6, jit: 0 }); },
      };
      const play = (name, arg) => { if (mute || !on) return; try { SND[name](arg); } catch (e) { /* ohne Ton weiter */ } };
      // Erst in einer Nutzergeste anlegen/fortsetzen (Autoplay-Regel der Browser); Dateien dann vorladen
      play.unlock = () => {
        if (!on) { on = true; FILES.forEach(id => { el[id] = Object.assign(new Audio(`${SND_DIR}hero_${id}.mp3`), { preload: 'auto' }); }); }
        try {
          if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; ac = new C(); out = ac.createGain(); out.gain.value = 0.8; out.connect(ac.destination); }
          if (ac.state === 'suspended') ac.resume();
        } catch (e) { ac = null; }
      };
      return play;
    })();
    // Sprechblase (HTML über der Bühne, folgt der Lage auf dem Bildschirm); eine je Sprecher. still() = anderer spricht gerade:
    // Blase aus, Restzeit steht, danach wieder ein → Dialog, nie zwei Blasen übereinander. swap = nur Inhalt tauschen (kein Pop)
    const bubble = (cls, still = () => false) => {
      const el = document.createElement('div'); el.className = `h3d-say ${cls}`.trim(); el.setAttribute('aria-hidden', 'true'); host.appendChild(el);
      const v = new THREE.Vector3();
      let o = null, until = 0, rest = 0, wait = false;   // Uhr = echte Zeit (läuft auch bei reduzierter Bewegung ohne dt)
      // bleibt 8 px innerhalb der Bühne (schmale Bildschirme); Spitze (--dx) zeigt weiter auf den Sprecher
      const place = () => {
        v.copy(o.g.position); v.z += o.h * 0.6 + 0.02; v.project(st.camera);
        const W = host.clientWidth, x = (v.x + 1) / 2 * W, h = el.offsetWidth / 2, cx = Math.max(h + 8, Math.min(W - h - 8, x));
        el.style.left = `${cx}px`; el.style.top = `${(1 - v.y) / 2 * host.clientHeight}px`;
        el.style.setProperty('--dx', `${Math.max(12 - h, Math.min(h - 12, x - cx))}px`);
      };
      const pop = () => { place(); el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); };
      return {
        get left() { return (wait ? rest : until ? until - performance.now() : 0) / 1000; },
        get busy() { return this.left > 0; },
        show(obj, content, ms = 2600, quiet = false, swap = false) {
          const live = this.busy && !wait && o === obj;
          o = obj; el.replaceChildren(...[].concat(content)); until = performance.now() + ms;
          wait = still(); if (wait) { rest = ms; el.classList.remove('in'); } else if (!(swap && live)) pop();
          if (!quiet) sfx('pop');
        },
        hide() { el.classList.remove('in'); until = rest = 0; wait = false; },
        tick() {
          if (!o) return;
          const now = performance.now();
          if (this.busy && still()) { if (!wait) { wait = true; rest = until - now; el.classList.remove('in'); } return; }
          if (wait) { wait = false; until = now + rest; rest = 0; pop(); }
          place(); if (until && now > until) { until = 0; el.classList.remove('in'); }
        },
      };
    };
    const say = bubble('');
    // Sprüche je Anlass (Wunsch User 06.10.2026): zufällig, nie zweimal hintereinander derselbe; Eintrag [de, en] oder k => [de, en]
    const L = {
      hi: [['Hallo! Gib mir was zu tun.', 'Hi! Give me something to do.'], ['Na, eine Runde?', 'Fancy a round?']],
      go: [['Komme schon!', 'Coming!'], ['Bin unterwegs.', 'On my way.'], ['Moment …', 'One moment …']],
      grip: [['Hab dich!', 'Got you!'], ['Erwischt!', 'Caught you!'], ['Gut festhalten!', 'Hold on tight!']],
      lift: [['Und hoch!', 'Up we go!'], ['Hoch mit dir!', 'Up you come!']],
      hold: [['Wohin damit?', 'Where to?'], ['Wohin soll’s gehen?', 'Where shall it go?']],
      wait: [['Ich warte …', 'I’m waiting …'], ['Mein Arm wird schwer!', 'My arm is getting heavy!']],
      home: [['Ab nach Hause!', 'Off home you go!'], ['Gleich da.', 'Almost there.'], ['Festhalten!', 'Hang on!']],
      stack: [['Ein Turm? Mutig!', 'A tower? Bold!'], ['Schön gerade stapeln …', 'Nice and straight …']],
      back: [['Na gut, zurück.', 'Fine, back it goes.'], ['Dann eben zurück.', 'Back it goes, then.']],
      free: [['Neuer Platz!', 'New spot!'], ['Hier passt’s.', 'This works.']],
      drop: [['Und ab!', 'And down!'], ['Vorsichtig …', 'Gently …'], ['Sauber.', 'Neat.']],
      done: [['Erledigt!', 'Done!'], ['Fertig!', 'All set!']],
      near: [['Noch einer!', 'One more!'], ['Fast geschafft!', 'Almost there!']],
      thanks: [['Ahh…, endlich Zuhause!', 'Ahh…, home at last!'], ['Hier bin ich sicher.', 'I’m safe here.'], ['War ja ’n Kinderspiel!', 'That was child’s play!']],
      nope: [['Da pass ich nicht rein!', 'I don’t fit in there!'], K => [`Ich bin doch kein ${K.de}!`, `I’m not a ${K.en}!`], ['Das ist nicht meine Form!', 'That’s not my shape!']],
      full: [['Hier ist kein Platz!', 'No room here!']],
      whoa: [['Huch!', 'Whoa!'], ['Hoppla!', 'Oops!'], ['Mir wird schwindelig!', 'I’m getting dizzy!']],
      pick: [['Heb mich auf!', 'Pick me up!']],
    };
    const lastLine = new Map();
    const line = (pool, arg) => {
      const n = pool.length, k0 = lastLine.get(pool) ?? -1, k = k0 < 0 || n < 2 ? Math.floor(Math.random() * n) : (k0 + 1 + Math.floor(Math.random() * (n - 1))) % n;
      lastLine.set(pool, k); const e = pool[k]; return T(...(typeof e === 'function' ? e(arg) : e));
    };
    // Missionen in der Szene statt Card (Wunsch User 06.10.2026, Vorschau Variante A): je Objekt ein Bogen auf dem gestrichelten
    // Bodenring (gestrichelt + Umriss = offen; Band in Objektfarbe läuft 600 ms ein + gefülltes Symbol mit ✓ = zu Hause), Zeit ·
    // Runde · Bestzeit als Lichtschrift auf einer schrägen Bodenplatte davor (35° zur Kamera geneigt: flach am Boden wäre sie bei
    // ~20° Blickhöhe auf ein Drittel gestaucht). Gruppe dreht mit der Kamera (bleibt vorn, nie hinter dem Sockel). Runde geschafft
    // = Lichtwelle über den Sockel (Ping 1,2 s) + Sprechblase am Arm. Klang-Knopf frei unten rechts, Stand für Screenreader als
    // unsichtbare Zeile (nur bei Missionswechsel, nie je Zehntel); beide neben dem Canvas, nicht im role=img
    const quest = (() => {
      const g = new THREE.Group(); st.scene.add(g);
      const R = 0.47, Z = -0.02, W = 0.66, GAP = 0.09, FILL = 0.6, TILT = 35 * Math.PI / 180, CT = Math.cos(TILT), ST = Math.sin(TILT);
      const fg = tok('--glass-fg') || '#e8f4f2', warn = tok('--warn') || '#ffb36b', gold = '#f2c14e', acc = `#${ACC.getHexString()}`;
      const mono = tok('--mono') || 'monospace', aniso = st.renderer.capabilities.getMaxAnisotropy();
      const canvasTex = (w, h) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = aniso; return [c.getContext('2d'), tx];
      };
      // schräge Platte am Boden: Unterkante auf Radius r im Winkel a, Bildseite zeigt nach außen-oben
      const slab = (tx, w, h, a, r) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
        const c = Math.cos(a), s = Math.sin(a), x = new THREE.Vector3(-s, c, 0), y = new THREE.Vector3(-CT * c, -CT * s, ST);
        m.matrixAutoUpdate = false; m.matrix.makeBasis(x, y, new THREE.Vector3().crossVectors(x, y)).setPosition((r - h / 2 * CT) * c, (r - h / 2 * CT) * s, -0.03 + h / 2 * ST);
        g.add(m); return m;
      };
      const SEG = 48;
      const arcs = OBJ.map((o, k) => {
        const mid = (k - 1) * (W + GAP), a0 = mid - W / 2, col = `#${o.K.color.toString(16).padStart(6, '0')}`;
        const dashed = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circle(R, Z, 64, a0, a0 + W)),
          new THREE.LineDashedMaterial({ color: o.K.color, dashSize: 0.006, gapSize: 0.012, transparent: true, opacity: 0.7 }));
        dashed.computeLineDistances();
        const band = new THREE.Mesh(new THREE.RingGeometry(R - 0.007, R + 0.007, SEG, 1, a0, W), new THREE.MeshBasicMaterial({ color: o.K.color, transparent: true, depthWrite: false }));
        const glow = new THREE.Mesh(new THREE.RingGeometry(R - 0.022, R + 0.022, SEG, 1, a0, W), new THREE.MeshBasicMaterial({ color: o.K.color, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
        band.position.z = glow.position.z = Z;
        g.add(dashed, band, glow);
        const [ctx, tx] = canvasTex(128, 128);
        slab(tx, 0.044, 0.044, mid, R + 0.075);
        return { o, col, dashed, band, glow, ctx, tx, f: 0, on: null };
      });
      // Formsymbol unter dem Bogen: offen = Umriss, zu Hause = gefüllt + ✓ (nicht nur Farbe)
      const symbol = a => {
        const { ctx: c, col } = a, id = a.o.K.id; c.clearRect(0, 0, 128, 128); c.lineWidth = 8; c.strokeStyle = c.fillStyle = col;
        c.beginPath();
        if (id === 'cube') c.rect(30, 30, 68, 68); else if (id === 'box') c.rect(14, 41, 100, 46); else c.arc(64, 64, 36, 0, Math.PI * 2);
        if (a.on) { c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 11; c.lineCap = c.lineJoin = 'round'; c.beginPath(); c.moveTo(44, 65); c.lineTo(58, 79); c.lineTo(85, 50); }
        c.stroke(); a.tx.needsUpdate = true;
      };
      // Lichtschrift: Zeit groß, darunter Pause (Symbol + Wort) · Runde · Bestzeit bzw. Rekord (Stern)
      const [tc, ttx] = canvasTex(1152, 256);   // 4,5 : 1 wie die Platte
      const plate = slab(ttx, 0.36, 0.08, 0, 0.67);
      const PAUSE_D = (c, x, y, s) => { c.beginPath(); c.arc(x + s / 2, y, s / 2 - 2, 0, Math.PI * 2); c.moveTo(x + s * 0.4, y - s * 0.17); c.lineTo(x + s * 0.4, y + s * 0.17); c.moveTo(x + s * 0.6, y - s * 0.17); c.lineTo(x + s * 0.6, y + s * 0.17); c.stroke(); };
      let shown = '';
      const clock = paused => {
        const key = `${fmt(tRun)}|${paused}|${rounds}|${best}|${newBest}|${document.documentElement.lang}`;
        if (key === shown) return; shown = key;
        const c = tc; c.clearRect(0, 0, 1152, 256); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.shadowColor = acc; c.shadowBlur = 22; c.fillStyle = acc; c.font = `800 112px ${mono}`; c.fillText(fmt(tRun), 576, 86);
        c.shadowBlur = 0; c.font = `700 48px ${mono}`;
        const parts = [];
        if (paused) parts.push({ t: T('PAUSE', 'PAUSED'), col: warn, icon: PAUSE_D });
        parts.push({ t: `${T('RUNDE', 'ROUND')} ${rounds + (finished ? 0 : 1)}`, col: fg });
        if (best) parts.push(newBest ? { t: `★ ${T('REKORD', 'RECORD')} ${fmt(best)}`, col: gold } : { t: `${T('BESTZEIT', 'BEST')} ${fmt(best)}`, col: fg });
        const sep = '  ·  ', IS = 44, w = parts.reduce((s, p, i) => s + c.measureText(p.t).width + (p.icon ? IS + 10 : 0) + (i ? c.measureText(sep).width : 0), 0);
        let x = 576 - w / 2; c.textAlign = 'left'; c.lineWidth = 5; c.lineCap = 'round';
        parts.forEach((p, i) => {
          if (i) { c.fillStyle = fg; c.fillText(sep, x, 200); x += c.measureText(sep).width; }
          c.fillStyle = c.strokeStyle = p.col;
          if (p.icon) { p.icon(c, x, 200, IS); x += IS + 10; }
          c.fillText(p.t, x, 200); x += c.measureText(p.t).width;
        });
        ttx.needsUpdate = true;
      };
      // Lichtwelle: Ring läuft einmal vom Arm bis an die Sockelkante (Ping: 1,2 s ease-out, Deckkraft .8 → 0)
      const wave = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 128), new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      wave.position.z = 0.0015; wave.visible = false; st.scene.add(wave);
      let waveT = -1;
      // Klang-Knopf + Screenreader-Zeile neben dem Canvas (gleiche Rasterzelle der Bühne, kein position: absolute)
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'h3d-snd';
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path class="w" d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/><path class="x" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
      const sr = document.createElement('p'); sr.className = 'h3d-sr'; sr.setAttribute('role', 'status');
      host.after(btn, sr);
      const render = () => {
        const n = OBJ.filter(o => o.home).length;
        arcs.forEach(a => { if (a.on === a.o.home) return; a.on = a.o.home; if (!a.on || reduce) a.f = a.on ? 1 : 0; symbol(a); });
        sr.textContent = finished ? T(`Pick-&-Place-Profi: Runde ${rounds} in ${fmt(tRun)} geschafft`, `Pick & place pro: round ${rounds} done in ${fmt(tRun)}`)
          : T(`Missionen: ${n} von 3 zu Hause · Runde ${rounds + 1}`, `Missions: ${n} of 3 home · round ${rounds + 1}`);
        btn.setAttribute('aria-pressed', String(!mute)); btn.setAttribute('aria-label', T('Klänge', 'Sounds'));
        btn.title = mute ? T('Klänge einschalten', 'Turn sounds on') : T('Klänge ausschalten', 'Turn sounds off');
        shown = '';
      };
      btn.addEventListener('click', () => { mute = !mute; render(); save(); if (!mute) { sfx.unlock(); sfx('pop'); } });
      new MutationObserver(() => { arcs.forEach(a => { a.on = null; }); render(); show(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      document.fonts?.ready.then(() => { shown = ''; show(); });
      const tgt = st.controls.target, eo = u => 1 - (1 - u) ** 3;
      return {
        render, clock,
        tick(dt) {
          g.rotation.z = Math.atan2(st.camera.position.y - tgt.y, st.camera.position.x - tgt.x);
          arcs.forEach(a => {
            if (a.on && a.f < 1) a.f = Math.min(1, a.f + dt / FILL);
            const e = eo(a.f), n = Math.round(SEG * e) * 6;
            a.band.geometry.setDrawRange(0, n); a.glow.geometry.setDrawRange(0, n);
            a.band.visible = a.glow.visible = n > 0; a.dashed.visible = !a.on;
          });
          if (waveT < 0) return;
          waveT += dt; const u = Math.min(1, waveT / 1.2), s = 0.06 + 0.34 * eo(u);
          wave.scale.set(s, s, 1); wave.material.opacity = 0.8 * (1 - u); wave.visible = u < 1; if (u === 1) waveT = -1;
        },
        // Runde geschafft: Sprechblase am Arm (folgt dem TCP) + Lichtwelle; Screenreader-Zeile setzt render()
        badge() {
          arm.say(newBest ? T(`Neue Bestzeit! ${fmt(tRun)} ★`, `New best time! ${fmt(tRun)} ★`)
            : T(`Runde ${rounds} in ${fmt(tRun)} geschafft!`, `Round ${rounds} done in ${fmt(tRun)}!`), null, 3400, 2);
          if (!reduce) waveT = 0;
        },
        // wichtige Hinweise (falsche Form, kein Platz, erst ein Objekt) auch für Screenreader; render() setzt danach wieder den Stand
        tell(text) { sr.textContent = text; },
      };
    })();
    // Neue Runde: Formen + Objekte an ihre Plätze, Objekte ploppen gestaffelt auf (0,6 s, ease-out)
    const newRound = (Lx, t = 0) => {
      newRoundAt = 0; say.hide(); arm.hide(); tRun = t; started = t > 0; finished = newBest = false;
      Lx.tpls.forEach((s, k) => { const t = TPL[k]; t.slot = s; const [x, y] = slotXY(s); t.g.position.set(x, y, 0.0025); t.g.rotation.z = s.yaw; t.full = false; });
      OBJ.forEach((o, k) => { o.on = Lx.on[k] >= 0 ? OBJ[Lx.on[k]] : null; o.from = o.fall = null; });
      // Türme von unten nach oben aufbauen (Höhe hängt am Objekt darunter); gestapelt = genau über dem Objekt darunter
      const depth = o => (o.on ? 1 + depth(o.on) : 0);
      [...OBJ].sort((a, b) => depth(a) - depth(b)).forEach(o => {
        const k = OBJ.indexOf(o);
        o.home = !!Lx.home[k]; TPL[k].full = o.home; o.hopT = -1; o.swell = 0; o.sinkT = 1;
        o.g.rotation.set(0, 0, o.home ? TPL[k].slot.yaw : rnd(-0.5, 0.5));
        putAt(o, o.home ? TPL[k].slot : o.on ? { a: o.on.slot.a, r: o.on.slot.r } : Lx.objs[k]);
        o.mat.v = o.mat.to = o.home || Lx.mat[k] ? 1 : 0; o.popT = reduce ? 1 : -0.15 * k;
      });
      quest.render(); save(); show();
    };
    const tcpQ = new THREE.Quaternion(), rel = new THREE.Quaternion(), relP = new THREE.Vector3(), tcpW = new THREE.Vector3();
    // Arm spricht am Werkzeug (Wunsch User 06.10.2026, Vorschau Variante C; ersetzt die Schritt-Leiste unten mittig): Spruch oben,
    // darunter Fortschritt ●●○○ (Phase 0 Greifen … 3 Ablegen, 4 fertig) · Schritt · Messwert. Schrittwechsel tauscht nur den Text;
    // prio: Ereignis (1) und Rundenende (2) überschreibt kein Schritt (0). Spricht ein Objekt, wartet der Arm
    const arm = (() => {
      const b = bubble('arm', () => say.busy), at = { g: { position: tcpW }, h: 0.05 };
      let prio = 0;
      return {
        say(text, step = null, ms = 2600, p = 0) {
          if (b.busy && p < prio) return;
          prio = p;
          const kids = [Object.assign(document.createElement('span'), { textContent: text })];
          if (step) {
            const [name, val, ph] = step, s = document.createElement('small'), u = document.createElement('u');
            u.textContent = '●'.repeat(ph + 1).slice(0, 4).padEnd(4, '○');
            s.append(u, [name, val].filter(Boolean).join(' · ')); kids.push(s);
          }
          b.show(at, kids, ms, true, p === 0);
        },
        // Schritt eines Ablaufs: [Sprüche, Schritt, Wert, Phase]; steht bis zum nächsten Schritt
        step([pool, name, val, ph], ms = 60000) { this.say(line(pool), [name, val, ph], ms); },
        get left() { return b.left; },
        hide() { b.hide(); prio = 0; },
        tick: () => b.tick(),
      };
    })();
    // reduzierte Bewegung = Standbild, rendert nur nach Eingaben → solange eine Blase mit Ablaufzeit steht, je 250 ms ein Frame
    // (sonst bliebe der Dank stehen und der Arm käme nie zu Wort); Halte-Blase (1e6 ms) braucht keinen Takt
    if (reduce) setInterval(() => { if (say.busy || (arm.left > 0 && arm.left < 30)) st.kick(); }, 250);
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
    // Materialisieren (Wunsch User 06.10.2026): bei jedem Absetzen (Form, freie Stelle, Turm) bekommt das Objekt sein Material in
    // Zeitlupe (2,6 s): Scan-Ebene steigt von unten nach oben (darunter fest, darüber noch Raster), Farbe gleitet vom Akzent zur
    // Objektfarbe, frisch Materialisiertes glüht warm und kühlt aus; beim Anheben läuft es rückwärts (1,2 s). Danach wandert ab und
    // zu ein Schimmer-Band (42 % der Höhe, 1,8 s, Minimal-Ruck) über das Objekt: darin Raster statt Material, beide Kanten leuchten,
    // abwechselnd auf- und abwärts. Schnitt = Clipping-Ebenen im Objektrahmen.
    const up = new THREE.Vector3(), mid = new THREE.Vector3();
    const applyMat = (o, dt) => {
      const m = o.mat, fwd = m.to === 1;
      if (m.v !== m.to) m.v = fwd ? Math.min(1, m.v + dt / m.D) : Math.max(0, m.v - dt / m.D);
      // Scan-Lage (Minimal-Ruck, im ersten ¾) und Farbanteil (ease-out) aus demselben Fortschritt → Rückweg spielt rückwärts
      const v = m.v, s = ease5(Math.min(1, v / 0.75)), k = 1 - (1 - v) ** 3, z = -o.h / 2 * 1.02 + o.h * 1.04 * s;
      // Schimmer-Band (nur fertig materialisiert): Band aus Raster wandert über das Objekt, abwechselnd auf- und abwärts
      const sw = o.sw >= 0 && v === 1, BW = o.h * 0.42, u = sw ? ease5(o.sw) : 0;
      const c = (o.swUp ? 1 : -1) * (-(o.h + BW) / 2 + (o.h + BW) * u), lo = sw ? c - BW / 2 : z, hi = c + BW / 2;
      up.set(0, 0, 1).applyQuaternion(o.g.quaternion); mid.copy(up).multiplyScalar(lo * o.g.scale.x).add(o.g.position);
      o.cutHi.setFromNormalAndCoplanarPoint(up, mid); o.cutLo.copy(o.cutHi).negate();
      if (sw) { mid.copy(up).multiplyScalar(hi * o.g.scale.x).add(o.g.position); o.cutX.setFromNormalAndCoplanarPoint(up, mid); o.cutY.copy(o.cutX).negate(); }
      else { o.cutX.set(up, -1e6); o.cutY.set(up, 1e6); }
      o.solid.visible = v > 0;
      o.solidMat.color.copy(ACC).lerp(o.col, k);
      const heat = fwd ? 0.7 * (1 - v) ** 2 : 0;
      o.solidMat.emissive.copy(o.col).lerp(HOT, heat / 0.7);
      o.solidMat.emissiveIntensity = heat;
      const b = sw ? 0.85 * Math.sin(Math.PI * o.sw) : Math.sin(Math.PI * s);   // Scan-Licht nur unterwegs
      const lead = sw ? (o.swUp ? hi : lo) : z;
      o.scanLine.position.z = o.scanGlow.position.z = lead; o.scanLine2.position.z = o.swUp ? lo : hi;
      o.scanLine.material.opacity = 0.95 * b; o.scanGlow.material.opacity = 0.35 * b; o.scanLine2.material.opacity = sw ? 0.6 * b : 0;
      o.scanLine.material.color.copy(ACC2).lerp(o.glow, k); o.scanLine2.material.color.copy(o.scanLine.material.color); o.scanGlow.material.color.copy(ACC).lerp(o.col, k);
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
      const hi = job && job.to >= 0 && job.to < BACK ? job.to : hover;
      TPL.forEach((t, k) => { t.on = !t.full && k === hi; paintT(t); });
      const sk = job && job.to >= STACK ? job.to : !job || job.to < 0 ? hover : -1;
      stackObj = cur && sk >= STACK ? OBJ[sk - STACK] : null;
      OBJ.forEach(o => { if (o === hoverObj || o === stackObj) { o.grid.material.opacity = 0.75; o.fill.material.opacity = 0.18; } applyMat(o, 0); });
      // Ablage-Umriss: gewählte freie Stelle oder Stelle unter dem Zeiger (belegt → blass)
      const gs = job && job.to === FREE && freeS ? { ...freeS, ok: true } : cur && (!job || job.to < 0) && hover === FREE ? spot : null;
      OBJ.forEach(o => { o.ghost.visible = !!(gs || stackObj) && o === cur; });
      if (gs && cur) {
        const g = cur.ghost; g.position.set(gs.r * Math.cos(gs.a), gs.r * Math.sin(gs.a), 0.003); g.rotation.z = landYaw(gs.a);
        cur.gFill.material.opacity = gs.ok ? 0.14 : 0.04; cur.gRim.material.opacity = gs.ok ? 0.9 : 0.3;
      } else if (stackObj && cur) {   // Turm: Umriss liegt oben auf dem Ziel-Objekt
        const g = cur.ghost, b = stackObj.g.position; g.position.set(b.x, b.y, topZ(stackObj) + 0.002); g.rotation.z = landYaw(stackObj.slot.a);
        cur.gFill.material.opacity = 0.14; cur.gRim.material.opacity = 0.9;
      }
      host.style.cursor = hoverObj || (hover >= 0 && hover !== FREE) ? 'pointer' : hover === FREE ? (spot && spot.ok ? 'pointer' : 'not-allowed') : '';
      st.kick();
    };
    // Lage des Objekts nach dem Absetzen an Winkel B: Werkzeug hält seine Drehung im Raum (ikDown), das Objekt dreht nur um
    // die Werkzeugdrehung am Ziel gegenüber dem Greifen (dort 0)
    const landYaw = B => (held ? cur.yawG + yawFor(B, pol.yaw) : cur.g.rotation.z + yawFor(B, 0));
    // Freie Stelle am Treffpunkt hit (auf der Kreisfläche, r ≤ 400 mm): in den Greifbereich gezogen (Radius 170–340 mm,
    // Gelenk 1 ±146°); frei, wenn die Grundfläche keine anderen Objekte und Formen berührt
    const freeAt = () => {
      const r0 = Math.hypot(hit.x, hit.y); if (r0 > 0.4) return null;
      const r = Math.max(0.17, Math.min(0.34, r0)), a = Math.max(-2.55, Math.min(2.55, Math.atan2(hit.y, hit.x)));
      const x = r * Math.cos(a), y = r * Math.sin(a), f = foot(cur.K), clear = (p, K) => Math.hypot(x - p.x, y - p.y) > f + foot(K);
      return { a, r, ok: OBJ.every(o => o === cur || clear(o.g.position, o.K)) && TPL.every(t => clear(t.g.position, t.K)) };
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
      const free = OBJ.filter(o => !o.home && !o.fall && o.popT >= 0.6);
      pickRay(e);
      const h = ray.intersectObjects(free.map(o => o.fill))[0];
      if (h) return topOf(free.find(o => o.fill === h.object));   // Turm: immer das oberste Objekt
      if (!ray.ray.intersectPlane(table, hit)) return null;
      let best = null, bd = tol;
      free.forEach(o => { const d = Math.hypot(hit.x - o.g.position.x, hit.y - o.g.position.y); if (d < bd) { bd = d; best = o; } });
      return best && topOf(best);
    };
    // Ziel unter dem Zeiger: freie Form (Index), Startplatz des gewählten Objekts (BACK) oder freie Stelle (FREE, Lage in spot)
    const tplAt = (e, tol) => {
      pickRay(e); spot = null;
      // Turm: oberstes freies Objekt unter dem Zeiger (Startobjekt darunter = zurücklegen)
      const tops = cur ? OBJ.filter(o => o !== cur && !o.home && !o.fall && o.popT >= 1 && !above(o)) : [];
      const th = ray.intersectObjects(tops.map(o => o.fill))[0], so = th && tops.find(o => o.fill === th.object);
      if (so) return so === cur.from ? BACK : STACK + OBJ.indexOf(so);
      if (!ray.ray.intersectPlane(table, hit)) return -1;
      let best = -1, bd = tol;
      TPL.forEach((t, k) => { if (t.full) return; const d = Math.hypot(hit.x - t.g.position.x, hit.y - t.g.position.y); if (d < bd) { bd = d; best = k; } });
      if (cur) { const [x, y] = slotXY(cur.slot); if (Math.hypot(hit.x - x, hit.y - y) < bd) best = BACK; }
      tops.forEach(o => { const d = Math.hypot(hit.x - o.g.position.x, hit.y - o.g.position.y); if (d < bd * 0.8) { bd = d / 0.8; best = o === cur.from ? BACK : STACK + OBJ.indexOf(o); } });
      if (best < 0 && cur && (spot = freeAt())) best = FREE;
      return best;
    };
    const grip = () => {
      const o = cur;
      if (o.hopT >= 0) { o.hopT = -1; o.swell = 0; o.g.position.z = o.h / 2; o.g.rotation.x = 0; }   // greift mitten im Hüpfer: erst landen
      held = true; ring(o.g.position.x, o.g.position.y, o.g.position.z + o.h / 2 + 0.002); sfx('grip');
      o.from = o.on; o.on = null; o.mat.to = 0; o.mat.D = 1.2;   // vom Turm genommen; Material löst sich beim Anheben (Scan rückwärts)
      o.yawG = o.g.rotation.z; if (fx) fx.out = 0;   // Zielerfassung zieht sich zusammen und verlischt
      // Objekt hängt fest am Sauger: Lage + Versatz im Werkzeugrahmen merken (bleibt bei geneigtem Werkzeug dran)
      robot.tcp.getWorldQuaternion(tcpQ); rel.copy(tcpQ).invert().multiply(o.g.quaternion);
      robot.tcp.getWorldPosition(tcpW); relP.subVectors(o.g.position, tcpW).applyQuaternion(tcpQ.clone().invert());
    };
    // Drehlage in der Form: nächste Lage, die zur Form passt (Würfel 90°, Quader 180°, Zylinder beliebig)
    const alignYaw = (y, target, sym) => sym ? target + Math.round((y - target) / sym) * sym : y;
    const drop = () => {
      const o = cur, to = job.to; held = false;
      o.g.rotation.set(0, 0, o.g.rotation.z); sfx('release');
      o.mat.to = 1; o.mat.D = 2.6;   // jedes Absetzen materialisiert (Wunsch User 06.10.2026)
      if (to === BACK) { o.on = o.from; putAt(o, o.slot); return; }
      if (to === FREE) { putAt(o, freeS); freeS = null; ring(o.g.position.x, o.g.position.y, 0.003); save(); return; }   // neuer Startplatz
      if (to >= STACK) { const b = OBJ[to - STACK]; o.on = b; putAt(o, { a: b.slot.a, r: b.slot.r }); ring(o.g.position.x, o.g.position.y, topZ(b) + 0.002); save(); return; }
      const t = TPL[to]; t.full = true; putAt(o, t.slot); o.home = true; o.g.position.z = o.h / 2;   // sinkt erst beim Einrutschen
      o.yaw0 = o.g.rotation.z; o.yaw1 = alignYaw(o.yaw0, t.slot.yaw, o.K.sym); o.sinkT = 0;
    };
    // Zu Hause angekommen (nach dem Einrutschen): Dank (Objekt), Klang, Mission abhaken; danach antwortet der Arm: 2 von 3 →
    // „fast geschafft“, alle drei → Rundenende/Bestzeit + Abzeichen, neue Runde
    const arrived = o => {
      say.show(o, line(L.thanks), 3000, true); sfx('home');
      if (OBJ.every(x => x.home)) {
        finished = true; rounds++; newBest = !best || tRun < best; if (newBest) best = tRun;
        quest.badge(); sfx('win'); newRoundAt = clk + 6.5;
      } else if (OBJ.filter(x => x.home).length === 2) arm.say(line(L.near), null, 2600, 1);
      quest.render(); save(); show();
    };
    // Objekt lehnt ab (falsche Form → K = Form des Ziels, kein Platz); Hinweis auch für Screenreader
    const nope = (pool = L.nope, K) => {
      const text = line(pool, K); say.show(cur, text, 2200, true); quest.tell(text); sfx('nope'); cur.shake = 1;
    };
    let busy = 0, lean = 0, vlean = 0;
    // Ablauf = Liste: { pts, v } Bahn · { act, dwell } Greifen/Lösen mit Verweilzeit · { hold } schweben bis Ziel gewählt ·
    // { lazy } wird erst beim Erreichen zu Schritten (Lage dann bekannt); say = Sprechblase des Arms beim Start des Schritts
    const go = (ops, to) => {
      let i = -1, op = null, t = 0, path = null;
      const next = () => {
        op = ops[++i]; t = 0; path = null;
        if (op && op.lazy) { ops.splice(i, 1, ...op.lazy()); op = ops[i]; }
        if (!op) return finish();
        if (op.say) arm.step(op.say);
        if (op.pts) { path = bahn(op.pts, op.v); if (op.say) sfx('move'); }
        if (op.act) op.act();
        if (op.hold && job.to < 0) {
          job.hold = true; lean = vlean = 0;
          arm.step([L.hold, T('Ziel wählen', 'Choose a target'), T('Form, Stelle, Objekt', 'shape, spot, object'), 1], 1e6);
          TPL.forEach((p, k) => { p.next = clk + 0.3 + k * 0.25; });
          show();
        }
      };
      job = { to, hold: false, tick: dt => {
        t += dt; if (!job.hold) busy += dt;
        if (op.hold && job.to < 0 && t > 8 && !op.bored) { op.bored = true; arm.step([L.wait, T('Ziel wählen', 'Choose a target'), T('Form, Stelle, Objekt', 'shape, spot, object'), 1], 1e6); }
        if (op.hold && job.to < 0 && t > 25) { job.to = BACK; show(); }   // niemand wählt → zurücklegen
        if (op.hold && job.to >= 0) { job.hold = false; ops.push(...place(job.to, false)); next(); t = dt; }   // gleich im selben Frame los
        if (path) { setPose(path.at(t), dt); if (t >= path.D) next(); return; }
        if (op.hold) {
          // Schweben: leichtes Wiegen + Objekt pendelt um die Hochachse; Arm neigt sich zum Ziel unter dem Zeiger
          const H = op.hold, e = Math.min(1, t / 1.5), env = e * e * (3 - 2 * e);
          const ha = hover === BACK ? cur.slot.a : hover === FREE && spot ? spot.a : hover >= STACK ? OBJ[hover - STACK].slot.a : hover >= 0 ? TPL[hover].slot.a : H[0];
          [lean, vlean] = spring(lean, vlean, Math.max(-0.3, Math.min(0.3, 0.2 * (ha - H[0]))), 3, dt);
          setPose(P(H[0] + lean + env * 0.08 * Math.sin(0.9 * t), H[1] + env * 0.022 * Math.sin(0.7 * t + 1),
            H[2] + env * 0.02 * Math.sin(1.3 * t), H[3] + env * 0.28 * Math.sin(0.6 * t), H[4] + env * 0.1 * Math.sin(0.5 * t + 1)), dt);
          return;
        }
        setPose(pose(), dt);
        if (t >= (op.dwell || 0)) next();
      } };
      const finish = () => {
        job = null; cur = null; pol.gyaw = 0;
        const sec = busy.toFixed(1);
        arm.step([L.done, T('Fertig', 'Done'), `${T(sec.replace('.', ','), sec)} s`, 4], 2600);
        if (follow) setGoalXY(ptr.x, ptr.y); else { ph = nearestPhase(); idleRamp = 0; }
        show();
      };
      next(); show();
    };
    // Ablegen in Form B, auf einen Turm (STACK) oder zurück auf den Startplatz, ab Halteposition oder (low) direkt vom Greifen:
    // senkrecht lösen, hoher Bogen weit nach außen geschwungen (≤ 390 mm, 360 mm hoch, Werkzeug neigt sich in die Kurve), über dem
    // Ziel eingezogen, senkrecht absetzen (Hs = Oberkante am Ziel); danach senkrecht abheben, Werkzeug dreht zurück (Wunsch User 06.10.2026)
    const place = (to, low) => {
      const o = cur, A = o.slot.a, R = o.slot.r, H = o.h, Hp = o.pickTop, base = to >= STACK ? OBJ[to - STACK] : null;
      const S = to === BACK ? o.slot : to === FREE ? freeS : base ? base.slot : TPL[to].slot, B = S.a, RB = S.r;
      const Hs = base ? topZ(base) + H : to === BACK ? Hp : H;
      const y0 = pol.yaw, yB = yawFor(B, y0), m = k => A + (B - A) * k, y = k => y0 + (yB - y0) * k;
      const rr = (k, b) => Math.min(0.39, R + (RB - R) * k + b);
      const pts = low ? [P(A, R, Hp + 0.035, y0)] : [];
      if (to === BACK) pts.push(P(A, 0.25, Math.max(0.24, Hp + 0.08), yB));
      else pts.push(P(m(0.15), rr(0.15, 0.04), 0.33, y(0.15), 0.4), P(m(0.5), rr(0.5, 0.13), 0.36, y(0.5), 0.85),
        P(m(0.85), rr(0.85, 0.03), Math.max(0.22, Hs + 0.1), y(0.85), 0.3));
      pts.push(P(B, RB, Hs + 0.06, yB), P(B, RB, Hs + 0.03, yB), P(B, RB, Hs, yB));
      const deg = Math.round(Math.abs(B - A) * 180 / Math.PI);
      return [
        { pts, v: 0.42, say: to === BACK ? [L.back, T('Zurücklegen', 'Put back'), xy(S), 2] : base ? [L.stack, T('Stapeln', 'Stack'), `z ${mm(Hs)} mm`, 2]
          : [to === FREE ? L.free : L.home, T('Transport', 'Transfer'), `${T('Schwenk', 'swing')} ${deg}°`, 2] },
        { act: drop, dwell: 0.25, say: [L.drop, T('Ablegen', 'Place'), T('Sauger aus', 'suction off'), 3] },
        { pts: [P(B, RB, Hs + 0.03, yB), P(B, 0.24, Math.max(0.2, Hs + 0.08))], v: 0.26 },
      ];
    };
    // Greifen am Startplatz: anfahren, die letzten 30 mm senkrecht absetzen, Sauger an; Ziel schon bekannt → direkt
    // ablegen, sonst drehend hoch heben und warten. Drehsinn so, dass Gelenk 6 in ±178° bleibt.
    // Anheben mit Schwung: erst zur Mitte ausholen, dann im Bogen zurück auf 330 mm (Wunsch User 06.10.2026)
    const pick = to => {
      const o = cur, A = o.slot.a, R = o.slot.r, H = o.pickTop = (o.on ? topZ(o.on) : 0) + o.h, d = A > 0 ? Math.PI / 2 : -Math.PI / 2, s = A > 0 ? 1 : -1;
      busy = 0;
      const up = clearZ > pol.z ? [P(pol.th, pol.r, clearZ, pol.yaw, pol.tilt)] : [];   // erst über die Türme
      go([
        { pts: [...up, P(A, R, Math.max(H + 0.06, clearZ)), P(A, R, H + 0.03), P(A, R, H)], v: 0.36, say: [L.go, T('Anfahren', 'Approach'), xy(o.slot), 0] },
        { act: grip, dwell: 0.25, say: [L.grip, T('Greifen', 'Grip'), T('Sauger an', 'suction on'), 0] },
        { lazy: () => job.to >= 0 ? place(job.to, true) : [
          { pts: [P(A, R, H + 0.035), P(A - s * 0.2, 0.28, H + 0.13, d * 0.45, 0.35), P(A, 0.22, 0.33, d)], v: 0.3,
            say: [L.lift, T('Anheben + drehen', 'Lift + rotate'), `z 330 mm · ${T('Gelenk', 'joint')} 6 ${d > 0 ? '+' : '−'}90°`, 1] },
          { hold: P(A, 0.22, 0.33, d) }] },
      ], to);
    };
    // Objekt gewählt → greifen (reduzierte Bewegung: nur markieren)
    const grab = o => {
      if (job) return;
      cur = o; say.hide(); if (!finished) started = true;
      if (reduce) { arm.step([L.hold, T('Ziel wählen', 'Choose a target'), T('Form, Stelle, Objekt', 'shape, spot, object'), 1], 1e6); show(); return; }
      fx = { o, t: 0, out: -1 }; o.jolt = o.hopT < 0 ? 0 : -1; sfx('lock', o); ring(o.g.position.x, o.g.position.y, floorZ(o) + 0.003);
      pick(-1);
    };
    // Ziel gewählt: passende Form → ablegen; falsche → ablehnen; Startplatz → zurücklegen; ohne Objekt → Hinweis
    const target = k => {
      if (!cur) { const text = touch ? T('Erst ein Objekt antippen!', 'Tap an object first!') : T('Erst ein Objekt anklicken!', 'Click an object first!'); arm.say(text, null, 2200, 1); quest.tell(text); return; }
      if (job && job.to >= 0) return;   // Ziel steht schon fest
      if (k === FREE) { if (!spot.ok) { nope(L.full); return; } freeS = { a: spot.a, r: spot.r }; }
      else if (k < BACK && TPL[k].K !== cur.K) { nope(L.nope, TPL[k].K); return; }
      if (reduce) {
        const o = cur; cur = null; arm.hide();
        if (k !== BACK) o.on = null;
        if (k >= STACK) { const b = OBJ[k - STACK]; o.on = b; putAt(o, { a: b.slot.a, r: b.slot.r }); o.mat.v = o.mat.to = 1; save(); show(); return; }
        if (k === FREE) { putAt(o, freeS); freeS = null; o.mat.v = o.mat.to = 1; save(); show(); return; }
        if (k !== BACK) { o.home = true; TPL[k].full = true; o.g.rotation.set(0, 0, TPL[k].slot.yaw); putAt(o, TPL[k].slot); o.mat.v = o.mat.to = 1; arrived(o); }
        show(); return;
      }
      if (job && job.to < 0) { job.to = k; show(); }
    };
    let down = null;
    // Eingabe auf der Bühne hält die Uhr wach; Maus raus → Pause (Touch meldet beim Loslassen „leave“ → dort zählt nur der Leerlauf)
    const awake = () => { lastIn = clk; inside = true; };
    host.addEventListener('pointerenter', awake);
    host.addEventListener('wheel', awake, { passive: true });
    host.addEventListener('pointermove', e => {
      awake();
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const o = objAt(e, 0.06), k = o || !cur ? -1 : tplAt(e, 0.07);
      if (o !== hoverObj || k !== hover) { hoverObj = o; hover = k; show(); }
    });
    host.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') inside = false; if (hover >= 0 || hoverObj) { hover = -1; hoverObj = null; show(); } });
    host.addEventListener('pointerdown', e => { awake(); down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    // Tippen/Klick = kurz und ohne Ziehen (Ziehen dreht weiter die Kamera); Klang-Knopf hat eigenen Klick
    host.addEventListener('pointerup', e => {
      if (e.target.closest('button') || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 600) return;
      const tol = e.pointerType === 'mouse' ? 0.06 : 0.08;
      touch = e.pointerType !== 'mouse'; sfx.unlock();
      const o = objAt(e, tol); if (o) { clicked = true; grab(o); return; }
      const k = tplAt(e, tol + 0.01); if (k >= 0) { clicked = true; target(k); }
    });
    // Zielerfassung beim Objekt-Klick (Wunsch User 06.10.2026): vier Eckwinkel fliegen um 45° gedreht aus 2,4-facher Größe
    // auf die Grundfläche und rasten mit leichtem Überschwingen ein (0,45 s), zwei Wellen im Umriss laufen über den Tisch,
    // das Objekt hüpft kurz vor Freude (14 mm, gestaucht/gestreckt, 0,42 s). Bis zum Greifen atmen die Winkel, ein Leitstrahl
    // verbindet TCP und Objekt (Lichtpunkte steigen zum Sauger); beim Greifen ziehen sich die Winkel zusammen und verlöschen (0,3 s).
    const backOut = u => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;
    const JOLT_D = 0.42, JOLT_H = 0.014, beamA = new THREE.Vector3(), beamB = new THREE.Vector3();
    const lockTick = dt => {
      const o = fx.o, t = fx.t += dt, L = o.lock, m = L.children[0].material, d = L.children[1].material;
      if (fx.out >= 0) fx.out = Math.min(1, fx.out + dt / 0.3);
      const u = Math.min(1, t / 0.45), e = backOut(u), fin = fx.out < 0 ? 1 : 1 - fx.out;
      L.visible = true; L.position.set(o.g.position.x, o.g.position.y, floorZ(o) + 0.003);
      L.rotation.z = o.g.rotation.z + (1 - u) ** 3 * Math.PI / 4;
      L.scale.setScalar(fx.out >= 0 ? 1 - 0.4 * fx.out : 2.4 - 1.4 * e + (u === 1 ? 0.05 * Math.sin(Math.PI * 2 * (t - 0.45) / 0.9) : 0));
      m.opacity = 0.95 * Math.min(1, u * 3) * fin; d.opacity = m.opacity; d.size = 0.022 + (u < 1 ? 0.03 * (1 - u) : 0);
      o.waves.forEach((w, k) => {
        const v = (t - 0.08 - 0.14 * k) / 0.8; w.visible = v > 0 && v < 1;
        if (!w.visible) return;
        w.position.set(o.g.position.x, o.g.position.y, floorZ(o) + 0.003); w.rotation.z = o.g.rotation.z;
        w.scale.setScalar(1 + 2.4 * (1 - (1 - v) ** 3)); w.material.opacity = 0.7 * (1 - v) ** 1.5;
      });
      // Freudenhüpfer (nicht, wenn das Objekt gerade von selbst hüpft)
      if (o.jolt >= 0 && !held) {
        o.jolt = Math.min(1, o.jolt + dt / JOLT_D); const a = Math.sin(Math.PI * o.jolt);
        o.g.position.z = floorZ(o) + o.h / 2 + JOLT_H * a; o.swell = a * a;
        if (o.jolt === 1) { o.jolt = -1; o.g.position.z = floorZ(o) + o.h / 2; o.swell = 0; }
      }
      // Leitstrahl: blendet nach dem Einrasten ein, beim Greifen aus
      const bOp = Math.min(1, Math.max(0, (t - 0.25) / 0.3)) * fin;
      beamLine.visible = beamDots.visible = bOp > 0;
      if (bOp > 0) {
        robot.tcp.getWorldPosition(beamA); beamB.copy(o.g.position); beamB.z += o.h / 2;
        const p = beamLine.geometry.attributes.position; p.setXYZ(0, beamA.x, beamA.y, beamA.z); p.setXYZ(1, beamB.x, beamB.y, beamB.z); p.needsUpdate = true;
        for (let k = 0; k < BEAM_N; k++) { const f = (k / BEAM_N + t / 0.7) % 1; beamPos.set([beamB.x + (beamA.x - beamB.x) * f, beamB.y + (beamA.y - beamB.y) * f, beamB.z + (beamA.z - beamB.z) * f], k * 3); }
        beamDots.geometry.attributes.position.needsUpdate = true;
        beamLine.material.opacity = 0.7 * bOp; beamDots.material.opacity = bOp;
      }
      if (fx.out === 1) { L.visible = beamLine.visible = beamDots.visible = false; o.waves.forEach(w => { w.visible = false; }); fx = null; }
    };
    // Ruhe-Hüpfer (Wunsch User 06.10.2026, bewusst gegen soft-motion §5: Klick-Einladung): liegt alles 5 s still, hebt ein freies
    // Objekt ab (24 mm, 1,3 s), dreht sich um 30° und kippt leicht (abwechselnd hin und zurück), schwillt um 8 % an, Lichthof hellt
    // auf; landet weich (sin^1.5) mit Ring am Boden; danach alle 3 s das nächste. Vor dem ersten Klick sagt jedes dritte „Heb mich auf!“.
    const HOP_H = 0.024, HOP_D = 1.3, HOP_ROT = Math.PI / 6, HOP_TILT = 0.12, HOP_SWELL = 0.08, HOP_FIRST = 5, HOP_EVERY = 3;
    let rest = 0, hopWait = HOP_FIRST, hopIdx = 0, hops = 0;
    // Puls-Schein: Lichthof + Bodenschein atmen langsam (4 s, nur Sinus); eigene Uhr in s (pt). Mesh-Fade: alle 8 s blendet das
    // Raster weich auf 45 % und zurück (1,8 s, sin²), bei Hover, Ablauf oder im Arm klingt der Fade aus
    const PULSE = 4, FADE_EVERY = 8, FADE_D = 1.8, FADE_MIN = 0.45, ZAX = new THREE.Vector3(0, 0, 1);
    let pt = 0, fadeAmp = 1;
    // Wandern (Wunsch User 06.10.2026): freie Objekte gleiten dauerhaft langsam (12 mm/s) auf unregelmäßigen Bahnen über die
    // Kreisfläche. Kurs dreht mit der Summe zweier langsamer Sinus (eigene Phasen je Objekt) → nie dieselbe Bahn. Abstand zu den
    // anderen Objekten, allen Formen, dem Startplatz des gewählten Objekts (Rückweg) und der gewählten freien Stelle: weiche
    // Abstoßung lenkt den Kurs ab 60 mm vorher um (um 20° nach rechts gedreht → zwei Objekte weichen einander aus statt sich
    // festzuschieben), harte Grenze hält sie nie näher als Grundfläche + 15 mm. Bleibt im Greifbereich (Radius 210–330 mm, Gelenk 1
    // ±140°, sanft vom Rand weggelenkt). Steht: zu Hause, gewählt/im Arm, beim Aufploppen, unter dem Zeiger (leicht anklickbar),
    // 3 s nach dem Ablegen; an- und auslaufen weich (0,8 s). Quader und Würfel drehen sich langsam in Fahrtrichtung.
    const W_V = 0.012, W_R0 = 0.21, W_R1 = 0.33, W_A = 2.45, W_GAP = 0.015, W_SEE = 0.06, W_REST = 3;
    const W_C = Math.cos(-0.35), W_S = Math.sin(-0.35), wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
    OBJ.forEach(o => Object.assign(o, { wTh: rnd(-Math.PI, Math.PI), wP: [rnd(0, 7), rnd(0, 7)], wS: 0, wRest: 0, wFix: true }));
    const wander = dt => {
      const obs = TPL.map(t => ({ x: t.g.position.x, y: t.g.position.y, f: foot(t.K) + 0.005 }));
      if (cur) { const [x, y] = slotXY(cur.slot); obs.push({ x, y, f: foot(cur.K) }); }
      if (cur && freeS) obs.push({ x: freeS.r * Math.cos(freeS.a), y: freeS.r * Math.sin(freeS.a), f: foot(cur.K) });
      OBJ.forEach(o => {
        const fix = o.home || o === cur || o.popT < 1 || o.on || o.fall || above(o) || (cur && cur.from === o);   // Türme stehen
        if (fix) { o.wS = 0; o.wFix = true; return; }
        if (o.wFix) { o.wFix = false; o.wRest = clk + W_REST; }   // eben abgelegt/aufgeploppt: erst liegen bleiben
        const run = o !== hoverObj && clk >= o.wRest && !newRoundAt;
        o.wS += ((run ? 1 : 0) - o.wS) * Math.min(1, dt / 0.8);
        if (o.wS < 1e-3) return;
        const p = o.g.position, fo = foot(o.K), near = [...obs, ...OBJ.filter(q => q !== o && !q.home && q !== cur).map(q => ({ x: q.g.position.x, y: q.g.position.y, f: foot(q.K) }))];
        let ax = 0, ay = 0;
        near.forEach(n => {
          const dx = p.x - n.x, dy = p.y - n.y, d = Math.hypot(dx, dy) || 1e-6, m = fo + n.f + W_GAP;
          if (d < m + W_SEE) { const k = 2.5 * (1 - (d - m) / W_SEE) ** 2; ax += k * (dx * W_C - dy * W_S) / d; ay += k * (dx * W_S + dy * W_C) / d; }
        });
        const r = Math.hypot(p.x, p.y), a = Math.atan2(p.y, p.x), ux = p.x / r, uy = p.y / r, edge = (v, m) => 2.5 * Math.max(0, 1 - v / m) ** 2;
        const kr = edge(r - W_R0, W_SEE) - edge(W_R1 - r, W_SEE), ka = edge(W_A - Math.abs(a), 0.25) * Math.sign(a);
        ax += kr * ux + ka * uy; ay += kr * uy - ka * ux;
        o.wTh += dt * (0.45 * Math.sin(0.23 * clk + o.wP[0]) + 0.3 * Math.sin(0.37 * clk + o.wP[1]));
        if (ax || ay) o.wTh += wrapA(Math.atan2(Math.sin(o.wTh) + ay, Math.cos(o.wTh) + ax) - o.wTh) * Math.min(1, dt * 1.6);
        const v = W_V * o.wS * dt;
        p.x += v * Math.cos(o.wTh); p.y += v * Math.sin(o.wTh);
        // harte Grenzen: nie in ein Hindernis, nie aus dem sicheren Greifbereich (wie freie Ablage: 170–340 mm, ±146°)
        near.forEach(n => { const dx = p.x - n.x, dy = p.y - n.y, d = Math.hypot(dx, dy) || 1e-6, m = fo + n.f + W_GAP; if (d < m) { p.x = n.x + dx / d * m; p.y = n.y + dy / d * m; } });
        const rr = Math.max(0.17, Math.min(0.34, Math.hypot(p.x, p.y))), aa = Math.max(-2.55, Math.min(2.55, Math.atan2(p.y, p.x)));
        p.x = rr * Math.cos(aa); p.y = rr * Math.sin(aa); o.slot = { a: aa, r: rr };
        if (o.hopT < 0 && o.K.sym) { const y = o.g.rotation.z; o.g.rotation.z += (alignYaw(y, o.wTh, o.K.sym) - y) * Math.min(1, dt * 0.8) * o.wS; }
      });
    };
    // Umkippen (Wunsch User 06.10.2026): fährt der Arm beim Folgen (TCP 70 mm hoch) gegen einen Turm, kippt alles über dem
    // untersten Objekt in Schubrichtung um die Unterkante (Winkel wächst mit t² wie unter Schwerkraft, dreht dabei leicht), fällt
    // auf die Seite, federt zweimal nach und rutscht aus (0,4 s), liegt 1,4 s und hüpft dann von selbst wieder aufrecht (0,75 s,
    // Ring am Boden) → wieder greifbar. Landestelle im Greifbereich, frei von Objekten und Formen; höhere Objekte fallen weiter.
    // Material bleibt (Objekt war schon abgesetzt).
    const FALL_D = 0.55, BOUNCE_D = 0.4, LIE_D = 1.4, RISE_D = 0.75, SW_D = 1.8;
    const qa = new THREE.Quaternion(), qz = new THREE.Quaternion(), qL = new THREE.Quaternion(), qU = new THREE.Quaternion(), fAx = new THREE.Vector3();
    const mtx = new THREE.Matrix4(), tcpPrev = new THREE.Vector3();
    // halbe Höhe in Lage q (Mitte → Tisch): Spalten der Drehmatrix = Objektachsen, deren z-Anteil zählt
    const halfH = (o, q) => {
      const e = mtx.makeRotationFromQuaternion(q).elements, [sx, sy, sz] = o.K.S;
      return o.K.id === 'cyl' ? sz / 2 * Math.abs(e[10]) + sx / 2 * Math.sqrt(Math.max(0, 1 - e[10] * e[10]))
        : (Math.abs(e[2]) * sx + Math.abs(e[6]) * sy + Math.abs(e[10]) * sz) / 2;
    };
    // Landestelle: in Schubrichtung, sonst seitlich gefächert und weiter weg; im Greifbereich (190–320 mm + 12 mm Rutschen, ±143°)
    const landAt = (o, x0, y0, dir, k) => {
      const obs = OBJ.filter(q => q !== o && !q.home).map(q => (q.fall ? { x: q.fall.lx, y: q.fall.ly, f: foot(q.K) } : { x: q.g.position.x, y: q.g.position.y, f: foot(q.K) }))
        .concat(TPL.map(t => ({ x: t.g.position.x, y: t.g.position.y, f: foot(t.K) })));
      let first = null;
      for (let j = 0; j < 5; j++) for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) {
        const dd = 0.07 + 0.045 * k + 0.03 * j, x = x0 + dd * Math.cos(dir + da), y = y0 + dd * Math.sin(dir + da);
        const r = Math.max(0.19, Math.min(0.32, Math.hypot(x, y))), a = Math.max(-2.5, Math.min(2.5, Math.atan2(y, x))), c = [r * Math.cos(a), r * Math.sin(a)];
        if (!first) first = c;
        if (obs.every(b => Math.hypot(c[0] - b.x, c[1] - b.y) > foot(o.K) + b.f + 0.01)) return c;
      }
      return first;
    };
    const topple = (b, dx, dy) => {
      let o = above(b), k = 0;
      say.show(topOf(b), line(L.whoa), 1600, true);
      while (o) {
        const nx = above(o); o.on = null;
        const [lx, ly] = landAt(o, b.g.position.x, b.g.position.y, Math.atan2(dy, dx), k);
        o.fall = { t: -0.07 * k, k, lx, ly, dx, dy, x0: o.g.position.x, y0: o.g.position.y, c0: o.g.position.z - o.h / 2,
          q0: o.g.quaternion.clone(), yaw: o.g.rotation.z, spin: rnd(-0.7, 0.7), hit: false };
        o.hopT = -1; o.jolt = -1; o.swell = 0;
        o = nx; k++;
      }
    };
    // Lage beim Kippen: Drehung um die waagerechte Achse quer zur Schubrichtung (oben kippt in Schubrichtung), dazu Drall um z
    const tipQ = (F, th, sp) => { fAx.set(-F.dy, F.dx, 0); qa.setFromAxisAngle(fAx, th); qz.setFromAxisAngle(ZAX, sp); return qL.copy(qz).multiply(qa).multiply(F.q0); };
    const fallTick = (o, dt) => {
      const F = o.fall, t = F.t += dt; if (t < 0) return;
      const T1 = FALL_D + 0.06 * F.k, T2 = T1 + BOUNCE_D, T3 = T2 + LIE_D, SL = 0.012, p = o.g.position;
      if (t < T1) {   // kippen + fallen
        const u = t / T1, g = u * u, q = tipQ(F, Math.PI / 2 * g, F.spin * g);
        o.g.quaternion.copy(q); p.set(F.x0 + (F.lx - F.x0) * u, F.y0 + (F.ly - F.y0) * u, F.c0 * (1 - g) + halfH(o, q));
      } else if (t < T3) {   // aufschlagen, nachfedern, ausrutschen, liegen
        if (!F.hit) { F.hit = true; sfx('thud'); ring(F.lx, F.ly, 0.003); }
        const v = Math.min(1, (t - T1) / BOUNCE_D), fade = (1 - v) ** 2, q = tipQ(F, Math.PI / 2 + 0.07 * Math.sin(3 * Math.PI * v) * fade, F.spin), s = SL * (1 - fade);
        o.g.quaternion.copy(q); p.set(F.lx + F.dx * s, F.ly + F.dy * s, halfH(o, q) + 0.01 * Math.abs(Math.sin(2 * Math.PI * v)) * fade);
      } else {   // aufrichten: kleiner Hüpfer zurück auf die Grundfläche
        const w = Math.min(1, (t - T3) / RISE_D), e = ease5(w), lie = tipQ(F, Math.PI / 2, F.spin), zl = halfH(o, lie);
        qU.setFromAxisAngle(ZAX, F.yaw + F.spin); o.g.quaternion.copy(lie).slerp(qU, e);
        p.z = zl + (o.h / 2 - zl) * e + 0.03 * Math.sin(Math.PI * w);
        if (w === 1) {
          o.fall = null; o.g.rotation.set(0, 0, F.yaw + F.spin); p.z = o.h / 2;
          o.slot = { a: Math.atan2(p.y, p.x), r: Math.hypot(p.x, p.y) }; ring(p.x, p.y, 0.003); save();
        }
      }
    };
    const ex = extra;
    extra = (dt, t) => {
      ex(dt, t);
      clk += dt; pt += dt;
      // Begrüßung einmal je Seitenaufruf, sobald die Bühne läuft (rendert nur sichtbar) und noch niemand gespielt hat
      if (!greeted && clk > 1.5) { greeted = true; if (!clicked && !job) arm.say(line(L.hi), null, 3600, 1); }
      if (newRoundAt && clk >= newRoundAt && !job) newRound(layout());
      // Stoppuhr: Arm fährt → zählt immer; sonst nur mit Zeiger auf der Bühne und Eingabe in den letzten 15 s
      const ticking = started && !finished && ((job && !job.hold) || (inside && clk - lastIn < IDLE));
      if (ticking) tRun += dt;
      quest.clock(started && !finished && !ticking); quest.tick(dt);
      if (!reduce) wander(dt);
      // Arm fährt beim Folgen gegen einen Turm → umkippen, Schubrichtung = Fahrtrichtung des TCP; Leerlauf bleibt über den Türmen
      robot.tcp.getWorldPosition(tcpW);
      if (follow && !job && !reduce) OBJ.forEach(b => {
        if (b.on || b.fall || b.home || !above(b)) return;
        const p = b.g.position, dx = p.x - tcpW.x, dy = p.y - tcpW.y, d = Math.hypot(dx, dy);
        let w = foot(b.K); for (let q = above(b); q; q = above(q)) w = Math.max(w, foot(q.K));
        if (tcpW.z > topZ(topOf(b)) - 0.004 || d > w + 0.01) return;
        let vx = tcpW.x - tcpPrev.x, vy = tcpW.y - tcpPrev.y; const v = Math.hypot(vx, vy);
        if (v > 1e-4) { vx /= v; vy /= v; } else { vx = dx / (d || 1); vy = dy / (d || 1); }
        topple(b, vx, vy);
      });
      tcpPrev.copy(tcpW);
      clearZ = OBJ.reduce((m, o) => (o.on ? Math.max(m, topZ(o) + 0.045) : m), 0);
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
          const free = OBJ.filter(o => !o.home && o.popT >= 1 && !o.on && !o.fall && !above(o));
          if (free.length) {
            const o = free[hopIdx++ % free.length]; o.hopT = 0; o.hopYaw = o.g.rotation.z;
            if (!clicked && hops++ % 3 === 0) say.show(o, line(L.pick), 2200, true);
          }
          rest = 0;
        }
      }
      if (fx) lockTick(dt);
      OBJ.forEach(o => {
        if (o.fall) fallTick(o, dt);
        // Schimmer: materialisierte Objekte, je 5–9 s versetzt, 1,8 s je Durchlauf; im Arm oder beim Lösen keiner
        if (!reduce && o.mat.v === 1 && o.mat.to === 1 && !(held && o === cur)) {
          if (o.sw >= 0) { o.sw = Math.min(1, o.sw + dt / SW_D); if (o.sw === 1) { o.sw = -1; o.swUp = !o.swUp; o.swNext = clk + rnd(5, 9); } }
          else if (clk >= o.swNext) o.sw = 0;
        } else { o.sw = -1; o.swNext = Math.max(o.swNext, clk + rnd(1.5, 3)); }
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
      say.tick(); arm.tick();
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
        if (o !== hoverObj && o !== stackObj) { o.grid.material.opacity = 0.42 * f; o.fill.material.opacity = (0.09 + 0.03 * pu) * f; }
        o.edge.material.opacity *= f; o.pts.material.opacity = 0.9 * f; o.pts.material.size = 0.016 + 0.003 * pu;
        o.aura.material.opacity = ((o.home ? 0.07 : 0.16 + 0.08 * pu) + 0.14 * o.swell) * pop; o.aura.scale.setScalar(2 * r * (1 + 0.25 * o.swell));
        o.aura.position.copy(o.g.position); if (!inArm) o.aura.position.z = Math.max(o.aura.position.z, r + 0.003);
        o.pool.visible = !inArm && !o.on; o.pool.position.set(o.g.position.x, o.g.position.y, 0.0028);
        const air = inArm ? 0 : Math.max(0, o.g.position.z - o.h / 2) / HOP_H;   // Bodenschein wird beim Abheben etwas kleiner + schwächer
        o.pool.material.opacity = (0.2 + 0.1 * pu) * (1 - 0.3 * air) * (o.home ? 0.5 : 1) * pop; o.pool.scale.setScalar((0.95 + 0.06 * pu) * (1 - 0.12 * air));
        o.g.scale.setScalar(pop * (1 + 0.008 * pu + HOP_SWELL * o.swell));
      });
    };
    // Start: gemerkte Runde (gültig und nicht schon fertig) oder neue Zufallslage
    const okSlot = s => s && Number.isFinite(s.a) && Number.isFinite(s.r) && s.r > 0.15 && s.r < 0.35 && Math.abs(s.a) < 2.6;
    const arr3 = a => Array.isArray(a) && a.length === 3;
    // gemerkte Türme: Index −1…2, nie auf sich selbst, nicht zu Hause, je Objekt höchstens eins oben drauf, ohne Kreis
    const okOn = (on, home) => arr3(on) && on.every((b, k) => Number.isInteger(b) && b >= -1 && b <= 2 && b !== k && !home[k] && (b < 0 || !home[b]))
      && on.every((b, k) => b < 0 || on.indexOf(b) === k) && on.every((b, k) => { let n = 0; for (let i = k; on[i] >= 0 && n < 4; i = on[i]) n++; return n < 3; });
    newRound(arr3(saved.objs) && saved.objs.every(okSlot) && arr3(saved.tpls) && saved.tpls.every(s => okSlot(s) && Number.isFinite(s.yaw))
      && arr3(saved.home) && !saved.home.every(Boolean) ? { objs: saved.objs, tpls: saved.tpls, home: saved.home.map(Boolean),
        on: okOn(saved.on, saved.home) ? saved.on : [-1, -1, -1], mat: arr3(saved.mat) ? saved.mat.map(Boolean) : [0, 0, 0] } : layout(), secs(saved.t));
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
  return { stage: st, pick: i => pick && pick(i), next: () => next && next(), get active() { return active; } };
}

window.Hero3D = { init };
})();
