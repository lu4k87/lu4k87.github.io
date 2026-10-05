/* xArm Lite 6 für die three.js-Szenen der Projektseiten (project_presentation.html, project_showcase.html).
   Klassisches Skript (läuft auch per file://): window.Lite6. three.js wird von der Seite übergeben
   (Import-Map auf jsDelivr, Version wie src/http_robot_control_ui_p8081/lib/three).
   Kinematik: xarm_description/config/kinematics/default/lite6_default_kinematics.yaml; Meshes: docs/js/lite6_mesh.js
   (tools/make_docs_lite6.py). Welt = URDF-Rahmen link_base (Z oben, Meter). Werkzeug: Vakuum-Sauger 61 mm. */
(function () {
  'use strict';
  // x, y, z, roll, pitch, yaw je Gelenk (URDF-Origin), danach Drehung um lokales Z
  const JOINTS = [
    [0, 0, 0.2435, 0, 0, 0],
    [0, 0, 0, 1.5708, -1.5708, 3.1416],
    [0.2002, 0, 0, -3.1416, 0, 1.5708],
    [0.087, -0.22761, 0, 1.5708, 0, 0],
    [0, 0, 0, 1.5708, 0, 0],
    [0, 0.0625, 0, -1.5708, 0, 0],
  ];
  const LIMITS = [[-3.11, 3.11], [-2.618, 2.618], [-0.061, 3.11], [-3.11, 3.11], [-2.164, 2.164], [-3.11, 3.11]];
  const TOOL = 0.061;            // Vakuum-Sauger (Twin/Sandbox)
  const WRIST = 0.0625 + TOOL;   // Gelenk 5 → TCP bei senkrechtem Werkzeug
  const REACH = 0.44;            // Reichweite laut Datenblatt
  const HOME = [0, 0.35, 1.05, 0, 0.7, 0];

  // ── 4×4-Mathematik (Zeilen-Major) ──
  const mul = (a, b) => {
    const r = new Array(16).fill(0);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j]; r[i * 4 + j] = s;
    }
    return r;
  };
  const rpy = (x, y, z, r, p, w) => {
    const cr = Math.cos(r), sr = Math.sin(r), cp = Math.cos(p), sp = Math.sin(p), cw = Math.cos(w), sw = Math.sin(w);
    return [cw * cp, cw * sp * sr - sw * cr, cw * sp * cr + sw * sr, x,
      sw * cp, sw * sp * sr + cw * cr, sw * sp * cr - cw * sr, y,
      -sp, cp * sr, cp * cr, z, 0, 0, 0, 1];
  };
  const rotZ = q => { const c = Math.cos(q), s = Math.sin(q); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
  const ORIGINS = JOINTS.map(j => rpy(...j));

  /** Vorwärtskinematik: Gelenkrahmen + TCP (Weltkoordinaten in m). */
  function fk(q) {
    let t = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const frames = [];
    for (let i = 0; i < 6; i++) { t = mul(mul(t, ORIGINS[i]), rotZ(q[i])); frames.push(t); }
    const tcp = mul(t, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, TOOL, 0, 0, 0, 1]);
    return { frames, tcp: [tcp[3], tcp[7], tcp[11]], toolZ: [tcp[2], tcp[6], tcp[10]] };
  }

  // Ebene Kinematik bei q1 = q4 = q6 = 0 und q5 = q3 − q2 (Werkzeug senkrecht nach unten): Handgelenk (r, z)
  const wristRZ = (q2, q3) => { const f = fk([0, q2, q3, 0, q3 - q2, 0]).frames[4]; return [f[3], f[11]]; };

  /** Inverse Kinematik für Greifen von oben: TCP auf (x, y, z), Werkzeug senkrecht. null = keine Lösung. */
  function ikDown(x, y, z, yaw = 0, seed = HOME) {
    const r = Math.hypot(x, y), wz = z + WRIST;
    if (Math.hypot(r, wz - JOINTS[0][2]) > REACH + 0.02) return null;
    let q2 = seed[1], q3 = seed[2];
    for (let it = 0; it < 40; it++) {
      const [fr, fz] = wristRZ(q2, q3), er = r - fr, ez = wz - fz;
      if (Math.hypot(er, ez) < 2e-4) break;
      const h = 1e-4, [a1, b1] = wristRZ(q2 + h, q3), [a2, b2] = wristRZ(q2, q3 + h);
      const j11 = (a1 - fr) / h, j12 = (a2 - fr) / h, j21 = (b1 - fz) / h, j22 = (b2 - fz) / h;
      const lam = 1e-4, det = (j11 * j11 + j21 * j21 + lam) * (j12 * j12 + j22 * j22 + lam) - (j11 * j12 + j21 * j22) ** 2;
      // gedämpfte kleinste Quadrate (2×2)
      const g1 = j11 * er + j21 * ez, g2 = j12 * er + j22 * ez;
      const a = j12 * j12 + j22 * j22 + lam, b = -(j11 * j12 + j21 * j22), d = j11 * j11 + j21 * j21 + lam;
      q2 += (a * g1 + b * g2) / det; q3 += (b * g1 + d * g2) / det;
    }
    const [fr, fz] = wristRZ(q2, q3);
    if (Math.hypot(r - fr, wz - fz) > 3e-3) return null;
    const q1 = Math.atan2(y, x), q = [q1, q2, q3, 0, q3 - q2, q1 - yaw];
    return q.every((v, i) => v >= LIMITS[i][0] - 1e-6 && v <= LIMITS[i][1] + 1e-6) ? q : null;
  }

  const lerpQ = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

  // ── Meshes ──
  let geoCache = null;
  function geometries(THREE, creased) {
    if (geoCache) return geoCache;
    const src = window.LITE6_MESH; if (!src) throw new Error('lite6_mesh.js fehlt');
    const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
    geoCache = {};
    for (const [name, m] of Object.entries(src)) {
      const q = new Int16Array(b64(m.pos)), pos = new Float32Array(q.length);
      for (let i = 0; i < q.length; i++) pos[i] = m.min[i % 3] + (q[i] + 32768) / 65535 * m.size[i % 3];
      let g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setIndex(new THREE.BufferAttribute(new Uint16Array(b64(m.idx)), 1));
      g = creased ? creased(g, Math.PI / 5) : (g.computeVertexNormals(), g);
      geoCache[name] = g;
    }
    return geoCache;
  }

  /** Roboter als three.js-Gruppe. opts: { material, toolMaterial, creased } → { group, setJoints, q, tcp } */
  function buildRobot(THREE, opts = {}) {
    const geos = geometries(THREE, opts.creased);
    const mat = opts.material || new THREE.MeshStandardMaterial({ color: 0xe9ecf1, roughness: 0.42, metalness: 0.08 });
    const toolMat = opts.toolMaterial || new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.6 });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geos.link_base, mat));
    const pivots = []; let parent = group;
    JOINTS.forEach((j, i) => {
      const origin = new THREE.Group();
      origin.position.set(j[0], j[1], j[2]);
      origin.rotation.set(j[3], j[4], j[5], 'ZYX');
      const pivot = new THREE.Group();
      origin.add(pivot); parent.add(origin);
      pivot.add(new THREE.Mesh(geos['link' + (i + 1)], mat));
      pivots.push(pivot); parent = pivot;
    });
    // Vakuum-Sauger 61 mm (Körper + Saugnapf)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.045, 28), toolMat);
    body.rotation.x = Math.PI / 2; body.position.z = 0.0225;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.008, 0.016, 24), toolMat);
    cup.rotation.x = Math.PI / 2; cup.position.z = 0.053;
    const tcp = new THREE.Object3D(); tcp.position.z = TOOL;
    parent.add(body, cup, tcp);
    group.traverse(o => { if (o.isMesh) o.userData.robot = true; });
    const state = { q: HOME.slice() };
    const setJoints = q => { state.q = q.slice(); pivots.forEach((p, i) => { p.rotation.z = q[i]; }); };
    setJoints(HOME);
    return { group, setJoints, get q() { return state.q; }, tcp, materials: [mat, toolMat] };
  }

  /** Farben aus den CSS-Tokens der Seite. */
  function tokens() {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    return {
      accent: v('--accent') || '#38bdf8', violet: v('--violet') || '#a78bfa', teal: v('--teal') || '#2dd4bf',
      gold: v('--gold') || '#fbbf24', red: v('--red') || '#ef4444', green: v('--green') || '#34d399',
      indigo: v('--indigo') || '#818cf8', text: v('--fg') || v('--text') || '#e7ebf3', line: v('--line') || '#2a3446',
      bg: v('--bg') || '#0b1220', surface: v('--surface') || v('--panel') || '#111a2b',
      dark: (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) !== 'light',
    };
  }

  /**
   * Bühne: Renderer, Kamera, Licht, OrbitControls, Rendern nur wenn sichtbar.
   * opts: { OrbitControls, target:[x,y,z], camPos:[x,y,z], fov, autoRotate, minDist, maxDist, onFrame(dt, t) }
   */
  function stage(THREE, host, opts = {}) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Füllrate begrenzt die Bildrate (gemessen: DPR 2 + MSAA → 20 fps) → Pixelratio ≤ 1.5, MSAA nur bei DPR < 1.5
    const renderer = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 1.5, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y';
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(opts.fov || 34, 1, 0.01, 20);
    camera.up.set(0, 0, 1);
    camera.position.set(...(opts.camPos || [1.05, -0.75, 0.62]));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x334155, 1.6); hemi.position.set(0, 0, 1);
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(0.8, -0.6, 1.6);
    const rim = new THREE.DirectionalLight(0x9cc8ff, 0.9); rim.position.set(-1, 0.8, 0.6);
    scene.add(hemi, key, rim);
    let visible = false, raf = 0, last = 0, busyUntil = 0;
    let controls = null;
    if (opts.OrbitControls) {
      controls = new opts.OrbitControls(camera, renderer.domElement);
      controls.target.set(...(opts.target || [0.18, 0, 0.16]));
      controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
      controls.minDistance = opts.minDist || 0.6; controls.maxDistance = opts.maxDist || 2.4;
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.autoRotate = !reduce && opts.autoRotate !== false; controls.autoRotateSpeed = 0.45;
      let idle = 0;
      const stop = () => { controls.autoRotate = false; clearTimeout(idle); };
      const resume = () => { clearTimeout(idle); if (!reduce && opts.autoRotate !== false) idle = setTimeout(() => { controls.autoRotate = true; kick(); }, 4000); };
      renderer.domElement.addEventListener('pointerdown', stop);
      renderer.domElement.addEventListener('pointerup', resume);
      renderer.domElement.addEventListener('wheel', () => { stop(); resume(); }, { passive: true });
      controls.addEventListener('change', () => kick());
      controls.update();
    } else camera.lookAt(...(opts.target || [0.18, 0, 0.16]));

    const api = { scene, camera, renderer, controls, reduce, render: () => renderer.render(scene, camera) };
    const frame = t => {
      raf = 0;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
      opts.onFrame && opts.onFrame(dt, t);
      if (controls) controls.update(dt);
      renderer.render(scene, camera);
      const moving = (controls && controls.autoRotate) || t < busyUntil || (api.isBusy && api.isBusy());
      if (visible && !document.hidden && !reduce && moving) raf = requestAnimationFrame(frame);
      else if (visible && !document.hidden && controls && controls.enableDamping && t < busyUntil + 600) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    function kick(ms = 0) {
      busyUntil = Math.max(busyUntil, performance.now() + ms);
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    api.kick = kick;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(300); }, { rootMargin: '80px' }).observe(host);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(300); });
    new ResizeObserver(() => {
      const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); kick(50);
    }).observe(host);
    return api;
  }

  /** Tisch mit 50-mm-Raster und Rand (Z = 0 = Oberkante). */
  function table(THREE, c, size = [0.9, 0.8], center = [0.2, 0]) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], 0.02),
      new THREE.MeshStandardMaterial({ color: c.dark ? 0x1a2333 : 0xe6ebf2, roughness: 0.9 }));
    top.position.set(center[0], center[1], -0.0101); top.receiveShadow = true;
    g.add(top);
    const grid = new THREE.GridHelper(Math.max(...size), Math.round(Math.max(...size) / 0.05),
      new THREE.Color(c.line), new THREE.Color(c.line));
    grid.rotation.x = Math.PI / 2; grid.position.set(center[0], center[1], 0.0005);
    grid.material.transparent = true; grid.material.opacity = c.dark ? 0.55 : 0.7;
    g.add(grid);
    g.userData.retheme = cc => {
      top.material.color.set(cc.dark ? 0x1a2333 : 0xe6ebf2);
      const col = new THREE.Color(cc.line), attr = grid.geometry.getAttribute('color');
      for (let i = 0; i < attr.count; i++) attr.setXYZ(i, col.r, col.g, col.b);
      attr.needsUpdate = true; grid.material.opacity = cc.dark ? 0.55 : 0.7;
    };
    return g;
  }

  /** Szenen-Bausteine für die Projektseiten (Objekte, Korb, ZED Mini, Beschriftung, Bahnen, Tweens). */
  function kit(THREE) {
    const L = window.Lite6, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, ...extra });
    const ghostMat = c => new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.26, depthWrite: false, roughness: 0.6 });
    function makeObjects() {
      const defs = [
        { id: 'cube', n: ['Würfel', 'Cube'], x: 0.25, y: -0.14, h: 0.04, color: 0xd9463b, geo: () => new THREE.BoxGeometry(0.04, 0.04, 0.04) },
        { id: 'ball', n: ['Kugel', 'Ball'], x: 0.31, y: -0.02, h: 0.044, color: 0x3d74e0, geo: () => new THREE.SphereGeometry(0.022, 32, 18) },
        { id: 'cyl', n: ['Zylinder', 'Cylinder'], x: 0.22, y: 0.11, h: 0.08, color: 0x22a06b, geo: () => new THREE.CylinderGeometry(0.02, 0.02, 0.08, 32).rotateX(Math.PI / 2) },
      ];
      return defs.map(d => {
        const mesh = new THREE.Mesh(d.geo(), std(d.color));
        mesh.position.set(d.x, d.y, d.h / 2); mesh.userData.obj = d.id;
        return { ...d, mesh, home: mesh.position.clone() };
      });
    }
    function makeBasket(x, y) {
      const g = new THREE.Group(), m = std(0xb98a3e, { roughness: 0.8 }), W = 0.13, D = 0.1, H = 0.055, t = 0.005;
      const add = (w, d, h, px, py, pz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), m); b.position.set(px, py, pz); g.add(b); };
      add(W, D, t, 0, 0, t / 2); add(W, t, H, 0, D / 2, H / 2); add(W, t, H, 0, -D / 2, H / 2); add(t, D, H, W / 2, 0, H / 2); add(t, D, H, -W / 2, 0, H / 2);
      g.position.set(x, y, 0); g.userData = { W, D, H, floor: t };
      return g;
    }
    function edgesBox(w, d, h, color) {
      return new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, d, h)), new THREE.LineBasicMaterial({ color, transparent: true }));
    }
    // ZED Mini auf Stativ: kalibrierte Pose aus robot_vision_cameras_bringup (tf 0.473 / 0 / 0.368, Pitch 57,5°)
    function makeZed(c) {
      const g = new THREE.Group(), pos = new THREE.Vector3(0.473, 0, 0.368), pitch = 1.00356;
      const f = new THREE.Vector3(-Math.cos(pitch), 0, -Math.sin(pitch)), r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 0, 1)).normalize(), u = new THREE.Vector3().crossVectors(r, f);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.124, 0.027), std(0x22262e));
      body.position.copy(pos); body.lookAt(pos.clone().add(new THREE.Vector3(0, 0, 1))); body.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f, r, u)); g.add(body);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, pos.z - 0.02, 12).rotateX(Math.PI / 2), std(0x5b6475));
      pole.position.set(pos.x + 0.03, 0, (pos.z - 0.02) / 2); g.add(pole);
      // Sichtkegel bis zur Tischebene (H 85°, V 54°)
      const th = Math.tan(85 / 2 * Math.PI / 180), tv = Math.tan(54 / 2 * Math.PI / 180), pts = [];
      const hits = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
        const d = f.clone().addScaledVector(r, sx * th).addScaledVector(u, sy * tv);
        const t = d.z < 0 ? Math.min(-pos.z / d.z, 1.1) : 0.6;
        return pos.clone().addScaledVector(d, t);
      });
      hits.forEach((h, i) => { pts.push(pos, h, h, hits[(i + 1) % 4]); });
      const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: c.green, transparent: true, opacity: 0.9 }));
      const shape = new THREE.Shape(hits.map(h => new THREE.Vector2(h.x, h.y)));
      const foot = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: c.green, transparent: true, opacity: 0.1, depthWrite: false }));
      foot.position.z = 0.001;
      g.add(lines, foot);
      return { group: g, pos, foot: hits, lines, footMesh: foot };
    }
    // HTML-Beschriftung, folgt einem 3D-Punkt
    function labeler(host, camera) {
      const items = [];
      const add = (getPos, html, c) => { const el = document.createElement('span'); el.className = 'lbl3'; el.style.setProperty('--c', c); el.innerHTML = html; host.appendChild(el); const it = { el, getPos, on: true }; items.push(it); return it; };
      const v = new THREE.Vector3();
      const update = () => {
        const w = host.clientWidth, h = host.clientHeight;
        items.forEach(it => {
          it.el.hidden = !it.on; if (!it.on) return;
          v.copy(it.getPos()).project(camera);
          it.el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%, -150%)`;
        });
      };
      return { add, update, items };
    }
    // Bahn aus Segmenten → Gelenk-Stützpunkte (Gelenkfahrt oder gerade Linie mit IK je Stützpunkt)
    function buildPlan(q0, segs) {
      const out = []; let q = q0.slice();
      for (const s of segs) {
        if (s.wait) { out.push({ ...s, qs: [q] }); continue; }
        const qs = [];
        if (s.line) {
          const a = L.fk(q).tcp, N = 18;
          for (let i = 1; i <= N; i++) {
            const k = L.ease(i / N), p = a.map((v, j) => v + (s.line[j] - v) * k);
            const qi = L.ikDown(p[0], p[1], p[2], 0, qs[qs.length - 1] || q); if (!qi) return null; qs.push(qi);
          }
        } else {
          const qt = s.to ? L.ikDown(...s.to, 0, q) : s.q.slice(); if (!qt) return null;
          for (let i = 1; i <= 28; i++) qs.push(L.lerpQ(q, qt, L.ease(i / 28)));
        }
        q = qs[qs.length - 1]; out.push({ ...s, qs });
      }
      return out;
    }
    const tcpPath = plan => plan.flatMap(s => s.qs.map(q => new THREE.Vector3(...L.fk(q).tcp)));
    function tween(ms, fn, ok) {
      return new Promise(res => {
        if (reduce || ms <= 0) { fn(1); return res(ok()); }
        const t0 = performance.now();
        const f = now => { if (!ok()) return res(false); const k = Math.max(0, Math.min(1, (now - t0) / ms)); fn(k); if (k < 1) requestAnimationFrame(f); else res(true); };
        requestAnimationFrame(f);
      });
    }
    async function playPlan(plan, robot, ok, onSeg) {
      for (const s of plan) {
        if (!ok()) return false;
        onSeg && onSeg(s);
        if (s.wait) { if (!await tween(s.wait, () => {}, ok)) return false; continue; }
        const qs = s.qs, n = qs.length;
        if (!await tween(s.ms, k => { const x = k * (n - 1), i = Math.min(n - 2, Math.floor(x)); robot.setJoints(n > 1 ? L.lerpQ(qs[i], qs[i + 1], x - i) : qs[0]); }, ok)) return false;
      }
      return true;
    }
    return { std, ghostMat, makeObjects, makeBasket, edgesBox, makeZed, labeler, buildPlan, tcpPath, tween, playPlan };
  }

  window.Lite6 = { JOINTS, LIMITS, TOOL, REACH, HOME, fk, ikDown, lerpQ, ease, buildRobot, stage, table, tokens, kit };
})();
