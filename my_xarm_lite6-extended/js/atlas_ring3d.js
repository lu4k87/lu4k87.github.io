/* Funktionsatlas als 3D-Segment-Ring (docs/project_docs.html, #atlas-sec; Vorschau „Segment-Ring“, Wunsch User 06.10.2026):
   Hub (83 Funktionen, 9 Bereiche), 9 extrudierte Glas-Segmente in den Bereichsfarben, Speichen + Lichtimpuls Hub → Segment.
   Gewähltes Segment dreht nach vorn und hebt sich; Zeiger hebt leicht an, Icon leuchtet (Glow); Icons groß, drehen sich leicht.
   Ziehen dreht den Ring, Klick = Link der Bereichs-Kachel (filtert die Liste, js/function_atlas.js); Pfeiltasten wählen, Enter filtert.
   Auswahl, Detail-Panel und Autoscan steuert die Seite (#at-ring: atKeys, atCur, atPick(a, user), atGo(a), Ereignis „at-pick“);
   Namen und Hub-Texte liest der Ring aus Kacheln und SVG-Ring (Sprache folgt data-en), Farben aus den Tokens von #atlas (.dark-zone).
   Ohne WebGL/Netz bleibt der SVG-Ring; prefers-reduced-motion: Standbild, rendert nur bei Änderung. Rendert nur, solange sichtbar.
   Klassisches Skript (läuft auch per file://): window.AtlasRing3D.init(THREE, { ring: '#at-ring' }); three.js übergibt das Modul der Seite. */
(function () {
'use strict';
const D = Math.PI / 180, R1 = 150, R2 = 270, FRONT = 180;   // Radien in Szenen-Einheiten; gewähltes Segment steht vorn (zur Kamera)
const EL = 38 * D, FOV = 30;                                  // Kamera-Neigung, senkrechtes Sichtfeld
const LABEL_MIN_W = 440;                                      // schmalere Bühne: Namen < 12 px → nur Icons, Name steht im Panel

const webgl = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };

function init(THREE, opts = {}) {
  const ring = document.querySelector(opts.ring || '#at-ring'), host = ring && ring.querySelector('.at-stage');
  if (!ring || !host || !ring.atPick || !webgl()) return null;
  try { return build(THREE, ring, host); } catch (e) { console.warn('Atlas-Ring 3D:', e); ring.classList.remove('at-3d'); return null; }
}

function build(THREE, ring, host) {
  const root = document.documentElement, box = ring.closest('.dark-zone') || ring;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const keys = ring.atKeys, N = keys.length;
  const tiles = keys.map(a => document.querySelector(`.at-area[data-a="${a}"]`));
  const tok = n => getComputedStyle(box).getPropertyValue('--' + n).trim();
  const hueOf = i => { const m = /var\(--([\w-]+)\)/.exec(tiles[i].style.getPropertyValue('--c')); return tok(m ? m[1] : 'accent'); };
  const mid = i => (i + .5) * 360 / N;
  const polar = (a, r, y = 0) => new THREE.Vector3(r * Math.sin(a * D), y, -r * Math.cos(a * D));

  ring.classList.add('at-3d');   // Bühne sichtbar → Größe messbar
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.append(renderer.domElement);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(FOV, 1, 10, 6000);
  scene.add(new THREE.AmbientLight(0xffffff, .9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-300, 700, 500); scene.add(key);
  const hot = new THREE.PointLight(0xffffff, 0, 420, 1.4); scene.add(hot);   // Licht über dem gewählten Segment
  const world = new THREE.Group(); scene.add(world);

  /* Canvas-Texturen: Icons aus den SVG-Symbolen der Seite (Path2D, kein Tainting), Texte in der Seitenschrift */
  const font = tok('font') || 'sans-serif', mono = tok('mono') || 'monospace';
  const canvasTex = (w, h, paint) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const drawIcon = (c, sym, s, color) => {
    c.save(); c.scale(s / 24, s / 24); c.strokeStyle = color; c.lineWidth = 1.8; c.lineCap = c.lineJoin = 'round';
    for (const n of sym ? sym.children : []) {
      const A = k => +n.getAttribute(k) || 0, p = new Path2D();
      if (n.tagName === 'path') p.addPath(new Path2D(n.getAttribute('d')));
      else if (n.tagName === 'circle') p.arc(A('cx'), A('cy'), A('r'), 0, Math.PI * 2);
      else if (n.tagName === 'rect') p.roundRect(A('x'), A('y'), A('width'), A('height'), A('rx'));
      c.stroke(p);
    }
    c.restore();
  };
  const glowTex = canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
  const sprite = (w, h, scale) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
    sp.renderOrder = 10; sp.scale.set(scale, scale * h / w, 1); sp.userData.size = [w, h]; return sp;
  };
  const paint = (sp, fn) => { sp.material.map?.dispose(); sp.material.map = canvasTex(...sp.userData.size, fn); sp.material.needsUpdate = true; };

  /* Grundplatte, Rand, Innenfläche */
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(R2 + 24, R2 + 30, 14, 120), new THREE.MeshStandardMaterial({ color: 0x15191c, roughness: .7, metalness: .3 }));
  plate.position.y = -14; world.add(plate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R2 + 14, 1.4, 8, 160), new THREE.MeshBasicMaterial({ transparent: true, opacity: .35 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = -6; world.add(rim);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(R1 - 6, R1 - 6, 4, 96), new THREE.MeshStandardMaterial({ color: 0x0b0d0f, roughness: .9 }));
  inner.position.y = -4; world.add(inner);

  /* Segmente: extrudiertes Glas, Kante + Knopf in Bereichsfarbe, großes Icon, Name, Schein */
  const segs = [], spokes = [], nodes = [];
  keys.forEach((a, i) => {
    const a0 = (i * 360 / N + .6) * D, a1 = ((i + 1) * 360 / N - .6) * D, am = mid(i);
    const s = new THREE.Shape();
    s.moveTo(R2 * Math.sin(a0), R2 * Math.cos(a0));
    s.absarc(0, 0, R2, Math.PI / 2 - a0, Math.PI / 2 - a1, true);
    s.lineTo(R1 * Math.sin(a1), R1 * Math.cos(a1));
    s.absarc(0, 0, R1, Math.PI / 2 - a1, Math.PI / 2 - a0, false);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 16, bevelEnabled: true, bevelThickness: 3, bevelSize: 2.5, bevelSegments: 3, curveSegments: 24 });
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhysicalMaterial({ roughness: .28, metalness: .15, clearcoat: 1, clearcoatRoughness: .15, transparent: true, opacity: .9, emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(geo, mat); mesh.userData.i = i;
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ transparent: true, opacity: .3 }));
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 4, 48), new THREE.MeshStandardMaterial({ color: 0x2c353b, roughness: .35, metalness: .3, emissiveIntensity: .08 }));
    knob.position.copy(polar(am, 226, 22));
    const ico = new THREE.Mesh(new THREE.PlaneGeometry(58, 58), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    ico.position.copy(polar(am, 226, 58)); ico.renderOrder = 9;
    const icoGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    icoGlow.scale.set(130, 130, 1); icoGlow.position.copy(ico.position);
    const label = sprite(512, 96, 150); label.position.copy(polar(am, 172, 34));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(300, 300, 1); glow.position.copy(polar(am, 206, 8));
    const g = new THREE.Group(); g.add(mesh, edge, knob, icoGlow, ico, label, glow);
    g.userData = { mat, edge, knob, ico, icoGlow, label, glow, a: am, lift: 0, hover: 0, target: 0, sym: tiles[i].querySelector('use')?.getAttribute('href') };
    world.add(g); segs.push(g);
    const sp = new THREE.Line(new THREE.BufferGeometry().setFromPoints([polar(am, 70, 2), polar(am, R1 - 6, 2)]), new THREE.LineBasicMaterial());
    world.add(sp); spokes.push(sp);
    const nd = new THREE.Mesh(new THREE.SphereGeometry(5.5, 20, 12), new THREE.MeshStandardMaterial({ color: 0x2a2f34, emissiveIntensity: 0 }));
    nd.position.copy(polar(am, i % 2 ? 92 : 118, 3)); world.add(nd); nodes.push(nd);
  });

  /* Hub mit Ring und Beschriftung (Texte aus dem SVG-Ring) */
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(62, 68, 34, 72), new THREE.MeshPhysicalMaterial({ color: 0x1d2328, roughness: .25, metalness: .4, clearcoat: 1 }));
  hub.position.y = 15; world.add(hub);
  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(70, 1.2, 8, 96), new THREE.MeshBasicMaterial());
  hubRing.rotation.x = Math.PI / 2; hubRing.position.y = 32; world.add(hubRing);
  const hubLab = sprite(256, 256, 150); hubLab.position.set(0, 64, 0); scene.add(hubLab);

  /* Lichtimpuls Hub → Segment */
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 12), new THREE.MeshBasicMaterial());
  const pglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pglow.scale.set(60, 60, 1); pulse.add(pglow); pulse.visible = false; world.add(pulse);

  const LINE = 0x3b4248, BASE = new THREE.Color(0x232b31);
  let cols = [], fg = '#eef2f3', accent = '#2ee6c8';
  function recolor() {   // Tokens neu lesen (Theme): Bereichsfarben, Akzent, Schrift
    cols = keys.map((_, i) => new THREE.Color(hueOf(i))); fg = tok('fg') || fg; accent = tok('accent') || accent;
    segs.forEach((g, i) => {
      const u = g.userData, c = cols[i];
      u.mat.color.copy(BASE).lerp(c, .14); u.mat.emissive.copy(c); u.edge.material.color.copy(c);
      u.knob.material.emissive.copy(c); u.icoGlow.material.color.copy(c); u.glow.material.color.copy(c);
      nodes[i].material.emissive.copy(c);
      u.ico.material.map?.dispose();
      u.ico.material.map = canvasTex(256, 256, cx => { cx.translate(16, 16); drawIcon(cx, document.querySelector(u.sym), 224, c.getStyle()); });
      u.ico.material.needsUpdate = true;
    });
    rim.material.color.set(accent); hubRing.material.color.set(accent);
    relabel(); sel(ring.atCur(), false);
  }
  function relabel() {   // Namen + Hub-Texte in der aktuellen Sprache
    segs.forEach((g, i) => paint(g.userData.label, (c, w, h) => {
      const t = tiles[i].querySelector('b').textContent.trim();
      let px = 60; c.font = `700 ${px}px ${font}`;
      while (c.measureText(t).width > w - 16 && px > 30) { px -= 2; c.font = `700 ${px}px ${font}`; }
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fg;
      c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = 8; c.fillText(t, w / 2, h / 2);
    }));
    const num = ring.querySelector('.at-num'), big = num ? num.dataset.num || num.textContent : '', lbl = ring.querySelector('.at-lbl')?.textContent || '', sub = ring.querySelector('.at-sub')?.textContent || '';
    paint(hubLab, (c, w) => {
      c.textAlign = 'center'; c.fillStyle = fg;
      c.font = `800 64px ${mono}`; c.fillText(big, w / 2, 110);
      c.font = `700 30px ${font}`; c.fillText(lbl, w / 2, 160);
      c.fillStyle = accent; c.font = `700 24px ${mono}`; c.fillText(sub, w / 2, 198);
    });
    need();
  }

  /* Auswahl: Ring dreht das Segment nach vorn, Speiche + Knoten leuchten, Impuls läuft vom Hub hinaus */
  let rot = 0, rotTarget = 0, hover = -1, pulseT = 1, pulseSeg = 0, drag = null, vel = 0, cur = 0, first = true;
  function sel(a, anim = true) {
    const i = Math.max(0, keys.indexOf(a)); cur = i;
    segs.forEach((g, k) => { g.userData.target = k === i ? 1 : 0; });
    spokes.forEach((s, k) => s.material.color.set(k === i ? cols[k] : LINE));
    nodes.forEach((n, k) => { n.material.emissiveIntensity = k === i ? 1.2 : 0; });
    let t = (FRONT - mid(i)) * D; while (t - rotTarget > Math.PI) t -= 2 * Math.PI; while (t - rotTarget < -Math.PI) t += 2 * Math.PI;
    rotTarget = t; pulseSeg = i; pulse.material.color.copy(cols[i]); pglow.material.color.copy(cols[i]); hot.color.copy(cols[i]);
    pulseT = anim && !reduce ? 0 : 1;
    if (first || reduce) { rot = rotTarget; segs.forEach(g => { g.userData.lift = g.userData.target; }); first = false; }
    need();
  }
  ring.addEventListener('at-pick', e => sel(e.detail.a));

  /* Zeiger: Hover hebt an, Klick filtert, waagerechtes Ziehen dreht (senkrecht scrollt die Seite: touch-action pan-y) */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), meshes = segs.map(g => g.children[0]), cv = renderer.domElement;
  const pick = e => {
    const r = cv.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ptr, cam); const h = ray.intersectObjects(meshes)[0]; return h ? h.object.userData.i : -1;
  };
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, id: e.pointerId, moved: false }; });
  cv.addEventListener('pointermove', e => {
    if (drag) {
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 4) { drag.moved = true; cv.setPointerCapture(drag.id); cv.style.cursor = 'grabbing'; }
      if (drag.moved) { vel = dx * .006; rot += vel; rotTarget = rot; drag.x = e.clientX; need(); }
      return;
    }
    const h = pick(e); if (h !== hover) { hover = h; cv.style.cursor = h >= 0 ? 'pointer' : 'grab'; need(); }
  });
  cv.addEventListener('pointerup', e => { if (drag && !drag.moved) { const i = pick(e); if (i >= 0) ring.atGo(keys[i]); } drag = null; cv.style.cursor = hover >= 0 ? 'pointer' : 'grab'; });
  cv.addEventListener('pointercancel', () => { drag = null; });
  cv.addEventListener('pointerleave', () => { if (hover >= 0) { hover = -1; need(); } });
  host.addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); ring.atPick(keys[(cur + step + N) % N], true); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ring.atGo(keys[cur]); }
  });

  /* Größe: Kamera rückt so weit ab, dass der Ring mit Rand in die Bühne passt; schmale Bühne ohne Namen */
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h;
    const tv = Math.tan(FOV / 2 * D), th = tv * cam.aspect, RR = R2 + 34;
    const d = Math.max(RR / th * 1.06, (RR * Math.sin(EL) + 70) / tv * 1.04);
    cam.position.set(0, d * Math.sin(EL), d * Math.cos(EL)); cam.lookAt(0, 4, 18); cam.updateProjectionMatrix();
    segs.forEach(g => { g.userData.label.visible = w >= LABEL_MIN_W; });
    need();
  }

  /* Bild: läuft nur sichtbar + Tab im Vordergrund; reduced-motion = Standbild je Änderung */
  let visible = false, raf = 0, last = 0;
  const camQ = new THREE.Quaternion(), yawQ = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  function need() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min((now - last) / 1000, .05) : .016, t = now / 1000; last = now;
    let busy = !reduce;   // Ambient (Icons, Hub-Ring) läuft weiter, solange Bewegung erlaubt ist
    if (!drag) {
      if (Math.abs(vel) > .0005 && !reduce) { rot += vel; rotTarget = rot; vel *= .92; }
      else { vel = 0; rot += (rotTarget - rot) * (reduce ? 1 : Math.min(1, dt * 4)); }
    }
    world.rotation.y = -rot;
    camQ.copy(world.quaternion).invert().multiply(cam.quaternion);   // Icons zur Kamera, dann leichte Drehung um die Hochachse
    segs.forEach((g, k) => {
      const u = g.userData, k1 = reduce ? 1 : Math.min(1, dt * 8);
      u.hover += ((k === hover ? 1 : 0) - u.hover) * k1;
      u.lift += (Math.max(u.target, .45 * u.hover) - u.lift) * k1;
      g.position.copy(polar(u.a, 10 * u.lift, 12 * u.lift));
      u.mat.emissiveIntensity = .55 * u.lift; u.edge.material.opacity = .3 + .6 * u.lift;
      u.glow.material.opacity = .55 * u.target * u.lift;
      u.icoGlow.material.opacity = .35 * Math.max(u.hover, .6 * u.target);
      yawQ.setFromAxisAngle(UP, reduce ? 0 : .3 * Math.sin(t * .7 + k * .9));
      u.ico.quaternion.copy(camQ).multiply(yawQ);
    });
    if (pulseT < 1) { pulseT = Math.min(1, pulseT + dt / .65); busy = true; }
    const f = pulseT < .5 ? 2 * pulseT * pulseT : 1 - (-2 * pulseT + 2) ** 2 / 2;
    pulse.position.copy(polar(mid(pulseSeg), 70 + (R1 - 76) * f, 8)); pulse.visible = pulseT < 1;
    const s = segs[cur];
    hot.position.copy(s.position).add(polar(mid(cur), 200, 120)).applyAxisAngle(UP, -rot); hot.intensity = 9000 * s.userData.lift;
    hubRing.rotation.z = reduce ? 0 : t * .15;
    renderer.render(scene, cam);
    if (busy || Math.abs(rotTarget - rot) > .001 || segs.some(g => Math.abs(g.userData.lift - Math.max(g.userData.target, .45 * g.userData.hover)) > .002)) need();
    else last = 0;
  }

  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = 0; need(); }).observe(host);
  document.addEventListener('visibilitychange', () => { last = 0; need(); });
  new MutationObserver(m => (m.some(r => r.attributeName === 'lang') ? relabel() : recolor()))
    .observe(root, { attributes: true, attributeFilter: ['lang', 'data-theme'] });
  recolor(); resize();
  document.fonts?.ready.then(relabel);
  host.dataset.ready = '1';
  return { renderer, scene, camera: cam, select: a => ring.atPick(a, true) };
}

window.AtlasRing3D = { init };
})();
