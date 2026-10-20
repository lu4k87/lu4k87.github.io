/* Funktionsatlas als 3D-Ring „Skala“ (docs/project_docs.html, #atlas-sec; Vorschau „Funktionsatlas-Ring“, Wahl User 20.10.2026):
   flache Sektoren in den unverfälschten Bereichsfarben, an der Innenkante ein Strich je Funktion (85), Name + Zahl außen, Hub mit der Gesamtzahl.
   Der gewählte Bereich dreht nach rechts zur Karte (HTML-Karte der Seite, #at-detail), Leitlinie + einmaliger Ping; Zeiger hellt auf.
   Aufbau einmal beim ersten Einblenden in drei Takten (Striche → Sektoren im Uhrzeigersinn → Namen, Außenring), danach nur der Außenring (sehr langsam).
   Ziehen dreht den Ring, Klick = Link der Bereichs-Kachel (filtert die Liste, js/function_atlas.js); Pfeiltasten wählen, Enter filtert.
   Auswahl, Karte und Autoscan steuert die Seite (#at-ring: atKeys, atCur, atPick(a, user), atGo(a), Ereignis „at-pick“);
   Namen und Hub-Texte liest der Ring aus Kacheln und SVG-Ring (Sprache folgt data-en), Farben aus den Tokens von #atlas (.dark-zone).
   Ohne WebGL/Netz bleibt der SVG-Ring; prefers-reduced-motion: Standbild, rendert nur bei Änderung. Rendert nur, solange sichtbar.
   Klassisches Skript (läuft auch per file://): window.AtlasRing3D.init(THREE, { ring: '#at-ring' }); three.js übergibt das Modul der Seite. */
(function () {
'use strict';
const D = Math.PI / 180, FOV = 30, FRONT = 90;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), eo = x => 1 - (1 - x) ** 3;
const sub = (p, s, d) => eo(clamp((p - s) / d));
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
  const fns = keys.map(a => [...document.querySelectorAll(`article.fn[data-a="${a}"]`)]);
  const cnt = fns.map(f => f.length);
  const mid = i => (i + .5) * 360 / N;
  const polar = (a, r, y = 0) => new THREE.Vector3(r * Math.sin(a * D), y, -r * Math.cos(a * D));

  ring.classList.add('at-3d');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.append(renderer.domElement);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(FOV, 1, 10, 8000), world = new THREE.Group(); scene.add(world);
  scene.add(new THREE.AmbientLight(0xffffff, 1.15)); const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-300, 700, 400); scene.add(key);

  const font = tok('font') || 'sans-serif', mono = tok('mono') || 'monospace';
  let cols = [], fg = '#eef2f3', fg2 = '#9aa6ad', accent = '#2ee6c8', bg = '#0d1114';
  const canvasTex = (w, h, paint) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const drawIcon = (c, sym, s, color) => {
    c.save(); c.scale(s / 24, s / 24); c.strokeStyle = color; c.lineWidth = 1.7; c.lineCap = c.lineJoin = 'round';
    for (const n of sym ? sym.children : []) {
      const A = k => +n.getAttribute(k) || 0, p = new Path2D();
      if (n.tagName === 'path') p.addPath(new Path2D(n.getAttribute('d')));
      else if (n.tagName === 'circle') p.arc(A('cx'), A('cy'), A('r'), 0, Math.PI * 2);
      else if (n.tagName === 'rect') p.roundRect(A('x'), A('y'), A('width'), A('height'), A('rx'));
      c.stroke(p);
    }
    c.restore();
  };
  const glowTex = canvasTex(128, 128, g => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
  const sprite = (w, h, scale, extra = {}) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, ...extra }));
    sp.renderOrder = 10; sp.scale.set(scale, scale * h / w, 1); sp.userData.size = [w, h]; return sp;
  };
  const paint = (sp, fn) => { sp.material.map?.dispose(); sp.material.map = canvasTex(...sp.userData.size, fn); sp.material.needsUpdate = true; };
  const icoSprite = (i, size) => { const sp = sprite(128, 128, size); sp.userData.i = i; return sp; };
  const paintIco = sp => paint(sp, c => drawIcon(c, document.querySelector(tiles[sp.userData.i].querySelector('use')?.getAttribute('href')), 128, '#fff'));
  const sector = (r1, r2, a0, a1, depth = 0) => {   // Winkel in Grad, Uhrzeigersinn ab oben (wie polar)
    a0 *= D; a1 *= D; const s = new THREE.Shape();
    s.moveTo(r2 * Math.sin(a0), r2 * Math.cos(a0)); s.absarc(0, 0, r2, Math.PI / 2 - a0, Math.PI / 2 - a1, true);
    s.lineTo(r1 * Math.sin(a1), r1 * Math.cos(a1)); s.absarc(0, 0, r1, Math.PI / 2 - a1, Math.PI / 2 - a0, false);
    const g = depth ? new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20 }) : new THREE.ShapeGeometry(s, 20);
    g.rotateX(-Math.PI / 2); return g;
  };
  const basic = (color, o = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, depthWrite: false });
  const labelPaint = (i, w, h, withCount = true) => (c) => {
    const t = tiles[i].querySelector('b').textContent.trim(); c.textAlign = 'center'; c.textBaseline = 'middle';
    const nm = `700 ${h * .42}px ${font}`, ct = `800 ${h * .38}px ${mono}`; c.font = nm; const w1 = c.measureText(t).width;
    c.font = ct; const w2 = withCount ? c.measureText(String(cnt[i])).width : 0, gap = withCount ? h * .22 : 0, x0 = (w - (w1 + gap + w2)) / 2;
    c.textAlign = 'left'; c.font = nm; c.fillStyle = '#fff'; c.fillText(t, x0, h / 2);
    if (withCount) { c.font = ct; c.fillText(String(cnt[i]), x0 + w1 + gap, h / 2 + 1); }
  };

  /* gemeinsamer Zustand */
  let cur = 0, hover = -1, rot = 0, rotTarget = 0, first = true, introT = reduce ? 99 : 0, introOn = reduce, visible = false, drag = null, vel = 0;
  const lift = new Array(N).fill(0), hov = new Array(N).fill(0), pickables = [];
  const API = { THREE, world, scene, cam, N, keys, cnt, mid, polar, tiles, sector, basic, sprite, paint, icoSprite, paintIco, canvasTex, drawIcon, glowTex, labelPaint, sub, clamp, eo, reduce,
    get cols() { return cols; }, get fg() { return fg; }, get fg2() { return fg2; }, get accent() { return accent; }, get bg() { return bg; }, get cur() { return cur; }, font, mono,
    lift, hov, pickables, get intro() { return introT; }, get rot() { return rot; }, host };
  const S = scene_(API);

  function recolor() {
    cols = keys.map((_, i) => new THREE.Color(hueOf(i)));
    fg = tok('fg') || fg; fg2 = tok('fg-2') || fg2; accent = tok('accent') || accent; bg = tok('bg') || bg;
    S.recolor(); sel(cur, false);
  }
  function sel(a, anim = true) {
    const i = Math.max(0, keys.indexOf(a)); const prev = cur; cur = i;
    let t = (FRONT - mid(i)) * D; while (t - rotTarget > Math.PI) t -= 2 * Math.PI; while (t - rotTarget < -Math.PI) t += 2 * Math.PI;
    rotTarget = t; if (first || reduce) { rot = rotTarget; lift.forEach((_, k) => { lift[k] = k === i ? 1 : 0; }); first = false; }
    S.select(i, prev, anim && !reduce); need();
  }
  ring.addEventListener('at-pick', e => sel(e.detail.a));

  /* Zeiger */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), cv = renderer.domElement, pointer = { x: 0, y: 0, in: false };
  const pick = e => {
    const r = cv.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ptr, cam); const h = ray.intersectObjects(pickables, false)[0]; return h ? h.object.userData.i : -1;
  };
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, id: e.pointerId, moved: false }; });
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(); pointer.x = (e.clientX - r.left) / r.width * 2 - 1; pointer.y = (e.clientY - r.top) / r.height * 2 - 1; pointer.in = true;
    if (drag) {
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 4) { drag.moved = true; cv.setPointerCapture(drag.id); cv.style.cursor = 'grabbing'; }
      if (drag.moved) { vel = dx * .006; rot += vel; rotTarget = rot; drag.x = e.clientX; need(); }
      return;
    }
    const h = pick(e); if (h !== hover) { hover = h; cv.style.cursor = h >= 0 ? 'pointer' : 'grab'; need(); }
    need();
  });
  cv.addEventListener('pointerup', e => { if (drag && !drag.moved) { const i = pick(e); if (i >= 0) ring.atGo(keys[i]); } drag = null; cv.style.cursor = hover >= 0 ? 'pointer' : 'grab'; });
  cv.addEventListener('pointercancel', () => { drag = null; });
  cv.addEventListener('pointerleave', () => { pointer.in = false; if (hover >= 0) { hover = -1; } need(); });
  host.addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); ring.atPick(keys[(cur + step + N) % N], true); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ring.atGo(keys[cur]); }
  });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); S.resize(w, h); need();
  }
  let raf = 0, last = 0, tt = 0;
  const need = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
  function frame(now) {
    raf = 0; const dt = last ? Math.min((now - last) / 1000, .05) : .016; last = now; tt += dt;
    if (introOn && introT < 90) introT += dt;
    if (!drag) { if (Math.abs(vel) > .0005 && !reduce) { rot += vel; rotTarget = rot; vel *= .92; } else { vel = 0; rot += (rotTarget - rot) * (reduce ? 1 : Math.min(1, dt * 3.2)); } }
    const k1 = reduce ? 1 : Math.min(1, dt * 7);
    for (let k = 0; k < N; k++) { hov[k] += ((k === hover ? 1 : 0) - hov[k]) * k1; lift[k] += ((k === cur ? 1 : 0) - lift[k]) * Math.min(1, k1 * .8); }
    world.rotation.y = -rot;
    S.tick(tt, dt, pointer);
    renderer.render(scene, cam);
    const busy = !reduce && (introT < 4 || S.ambient) || Math.abs(rotTarget - rot) > .001 || lift.some((v, k) => Math.abs(v - (k === cur ? 1 : 0)) > .002) || S.busy?.();
    if (busy) need(); else last = 0;
  }
  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) introOn = true; last = 0; need(); }, { threshold: .25 }).observe(host);
  document.addEventListener('visibilitychange', () => { last = 0; need(); });
  new MutationObserver(m => (m.some(r => r.attributeName === 'lang') ? (S.relabel(), need()) : recolor())).observe(root, { attributes: true, attributeFilter: ['lang', 'data-theme'] });
  recolor(); resize(); S.relabel();
  document.fonts?.ready.then(() => { S.relabel(); need(); });
  host.dataset.ready = '1';
  return { renderer, scene, camera: cam, select: a => ring.atPick(a, true) };
}

/* Szene: Sektoren, 85 Strichmarken (eine je Funktion), Namen außen, Leitlinie zur Karte */
function scene_(X) {
  const { THREE, world, scene, cam, N, keys, cnt, mid, polar, sector, basic, sprite, paint, icoSprite, paintIco, labelPaint, sub, pickables, lift, hov, host } = X;
  const R0 = 128, R1 = 160, R2 = 238, SPAN = 360 / N, G = 1.4;
  const secs = [], bars = [], pings = [], icos = [], labs = [];
  keys.forEach((a, i) => {
    const a0 = i * SPAN + G, a1 = (i + 1) * SPAN - G, m = mid(i);
    const fill = new THREE.Mesh(sector(R1, R2, a0, a1), basic(0xffffff, .14)); fill.userData.i = i; world.add(fill); secs.push(fill); pickables.push(fill);
    const bar = new THREE.Mesh(sector(R2 - 5, R2 + 1, a0, a1), basic(0xffffff, .9)); world.add(bar); bars.push(bar);
    const ping = new THREE.Mesh(sector(R2 - 5, R2 + 1, a0, a1), basic(0xffffff, 0)); ping.visible = false; world.add(ping); pings.push(ping);
    const ico = icoSprite(i, 38); ico.position.copy(polar(m, (R1 + R2) / 2 - 4, 2)); world.add(ico); icos.push(ico);
    const lab = sprite(480, 84, 275); scene.add(lab); labs.push(lab);
  });
  /* Strichmarken: eine je Funktion, im Winkelbereich ihres Bereichs */
  const ticks = []; keys.forEach((a, i) => { const n = cnt[i], a0 = i * SPAN + G + 5, a1 = (i + 1) * SPAN - G - 5; for (let k = 0; k < n; k++) ticks.push({ i, a: n > 1 ? a0 + (a1 - a0) * k / (n - 1) : mid(i), k }); });
  const tg = new THREE.PlaneGeometry(1.7, 1); tg.rotateX(-Math.PI / 2);
  const tm = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), ticks.length); world.add(tm);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), SC = new THREE.Vector3(), PO = new THREE.Vector3(), CC = new THREE.Color();
  /* feiner Außenring (sehr langsam), Hub-Kreis, Leitlinie zur Karte */
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.2, 7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: .22, depthWrite: false }), 120);
  for (let k = 0; k < 120; k++) { const a = k * 3; E.set(0, -a * D, 0); Q.setFromEuler(E); M.compose(polar(a, R2 + 24), Q, SC.set(1, 1, 1)); dashes.setMatrixAt(k, M); }
  const dashG = new THREE.Group(); dashG.add(dashes); scene.add(dashG);
  const hubRing = new THREE.Mesh(new THREE.RingGeometry(R0 - 22, R0 - 21, 120).rotateX(-Math.PI / 2), basic(0xffffff, .22)); scene.add(hubRing);
  const hubLab = sprite(256, 256, 150); hubLab.position.set(0, 2, 0); scene.add(hubLab);
  const lead = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.4).rotateX(-Math.PI / 2), basic(0xffffff, .5)); scene.add(lead);
  let bgC = new THREE.Color(), fgC = new THREE.Color(), extX = 460, extY = 322;

  const S = {
    ambient: true,
    recolor() {
      secs.forEach((m, i) => { m.material.color.copy(X.cols[i]); bars[i].material.color.copy(X.cols[i]); pings[i].material.color.copy(X.cols[i]); });
      lead.material.color.copy(X.cols[X.cur]); bgC.set(X.bg); fgC.set(X.fg); hubRing.material.color.set(X.fg);
      icos.forEach(paintIco); labs.forEach((l, i) => paint(l, labelPaint(i, 480, 84)));
    },
    relabel() { labs.forEach((l, i) => paint(l, labelPaint(i, 480, 84))); const num = document.querySelector('#at-ring .at-num'), lbl = document.querySelector('#at-ring .at-lbl')?.textContent || '', sub2 = document.querySelector('#at-ring .at-sub')?.textContent || '';
      paint(hubLab, (c, w) => { c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = `800 92px ${X.mono}`; c.fillText(num ? num.dataset.num || num.textContent : '85', w / 2, 118); c.font = `700 28px ${X.font}`; c.fillText(lbl, w / 2, 160); c.font = `600 21px ${X.mono}`; c.globalAlpha = .7; c.fillText(sub2, w / 2, 196); });
      hubLab.material.color.set(X.fg); },
    select(i, prev, anim) { lead.material.color.copy(X.cols[i]); if (anim) { pings[i].visible = true; pings[i].userData.t = 0; } },
    resize(w, h) {
      const tv = Math.tan(FOV / 2 * D), th = tv * cam.aspect, lab = w >= 440, d = Math.max((lab ? extX : 270) / th, (lab ? extY : 270) / tv);
      cam.position.set(0, d, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
      labs.forEach(l => { l.visible = w >= 440; });
    },
    tick(t, dt) {
      const p = X.intro, sc = X.reduce ? 0 : 1;
      secs.forEach((m, i) => { const r = sub(p, .25 + i * .09, .7), l = lift[i], h = hov[i];
        m.material.opacity = (.07 + .09 * r) * (1 - l) + (.34 * r) * l + .06 * h; const s = .94 + .06 * r; m.scale.set(s, 1, s);
        bars[i].material.opacity = r * (.5 + .5 * Math.max(l, h)); bars[i].scale.set(1 + .03 * l, 1, 1 + .03 * l); bars[i].scale.set(s, 1, s);
        icos[i].material.color.copy(X.cols[i]); icos[i].material.opacity = r * (.62 + .38 * Math.max(l, h));
        labs[i].material.color.copy(l > .5 ? X.cols[i] : fgC); labs[i].material.opacity = r * (.62 + .38 * Math.max(l, h));
        const pg = pings[i]; if (pg.visible) { pg.userData.t += dt / .9; const u = pg.userData.t; if (u >= 1) pg.visible = false; else { const q = 1 + .09 * (1 - (1 - u) ** 3); pg.scale.set(q, 1, q); pg.material.opacity = .7 * (1 - u); } }
      });
      ticks.forEach((tk, n) => {
        const l = lift[tk.i], h = hov[tk.i], r = sub(p, .1 + n * .011, .45), len = (9 + 9 * l + 4 * h) * r;
        E.set(0, -tk.a * D, 0); Q.setFromEuler(E); M.compose(polar(tk.a, R0 + len / 2, 1), Q, SC.set(1, 1, Math.max(len, .01)));
        tm.setMatrixAt(n, M); CC.copy(X.cols[tk.i]).lerp(bgC, .55 * (1 - Math.max(l, h * .6))); tm.setColorAt(n, CC);
      });
      tm.instanceMatrix.needsUpdate = true; tm.instanceColor.needsUpdate = true;
      hubLab.material.opacity = sub(p, .1, .6);
      hubRing.material.opacity = .22 * sub(p, 0, .8);
      dashG.rotation.y = -t * .02 * sc; dashes.material.opacity = .22 * sub(p, 1.2, 1);
      /* Leitlinie: von der gewählten Beschriftung nach rechts zur Karte */
      labs.forEach((l, i) => { const a = mid(i) + X.rot / D, w = 275 * .6, h = 44, r = R2 + 22 + w * Math.abs(Math.sin(a * D)) * .5 + h * Math.abs(Math.cos(a * D)) * .5; l.position.copy(polar(a, r, 2)); });
      lead.scale.set(26, 1, 1); lead.position.set(R2 + 13, 1, 0); lead.material.opacity = .6 * sub(p, 1.1, .8);
    },
    busy: () => false
  };
  return S;
}

window.AtlasRing3D = { init };
})();
