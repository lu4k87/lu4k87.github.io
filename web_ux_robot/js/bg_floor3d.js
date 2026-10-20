/* Seitenhintergrund „Hallenboden des Digital Twin“ (docs/project_docs.html; Vorschau „dezenter three.js-Hintergrund“, Wahl User 20.10.2026: Bg:C):
   Bodenraster in Perspektive im unteren Drittel, wandert beim Scrollen um höchstens eine Rasterweite; über der Textspalte (Inhalt ≤ 1240 px)
   auf 35 % abgeschwächt. Einziger Blickfang: ein Lichtstreif quert alle 12 s den Boden (2,4 s), pausiert bei sichtbarem Hero und im Hintergrund-Tab.
   Fester Canvas hinter dem Inhalt (z-index -1): dark-zones (Hero, Atlas, Showcase, Architektur, Kontakt) decken ihn ab.
   Keine Unschärfe, keine Verläufe im CSS (Nexus-WebKit malt auf CPU); zwischen zwei Streifen rendert er nur beim Scrollen.
   Start im Leerlauf nach der Hero-Einblendung (die drei WebGL-Szenen der Seite laden zuerst); ohne WebGL/Netz bleibt die Fläche leer.
   prefers-reduced-motion: Standbild, rendert nur bei Größe/Theme.
   Klassisches Skript (läuft auch per file://): window.BgFloor3D.init(THREE); three.js übergibt das Modul der Seite. */
(function () {
'use strict';
const SCAN_MS = 12000, SCAN_RUN = 0.2;   // Umlauf, Anteil mit laufendem Streif (2,4 s)
const webgl = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };

function init(THREE, opts = {}) {
  if (!webgl()) return;
  const start = () => { try { build(THREE); } catch (e) { console.warn('Hintergrund 3D:', e); } };
  const idle = () => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(start, { timeout: 2000 }) : start()), opts.delay ?? 1500);
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });
}

function build(THREE) {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = n => getComputedStyle(root).getPropertyValue(n).trim();

  const cv = document.createElement('canvas');
  cv.className = 'bg3d';
  cv.setAttribute('aria-hidden', 'true');
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '-1', pointerEvents: 'none',
    opacity: '0', transition: reduce ? 'none' : 'opacity 900ms cubic-bezier(.2,.7,.2,1)' });
  document.body.prepend(cv);

  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 2.2, 6); camera.lookAt(0, 3.2, -20);

  // Raster 1 m, 60 × 44 Linien; Deckkraft fällt zur Mitte (Textspalte) auf uMid und nach hinten aus, Streif hebt eine Tiefe kurz an
  const U = { uColor: { value: new THREE.Color() }, uAlpha: { value: 0.12 }, uMid: { value: 0.35 }, uHalf: { value: 620 },
    uW: { value: 1 }, uPR: { value: 1 }, uShift: { value: 0 }, uScan: { value: -1 } };
  const pos = [];
  for (let i = -30; i <= 30; i++) pos.push(i, 0, -40, i, 0, 4);
  for (let j = -40; j <= 4; j++) pos.push(-30, 0, j, 30, 0, j);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  scene.add(new THREE.LineSegments(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: U,
    vertexShader: `uniform float uShift; varying float vZ;
      void main() { vec3 p = position; p.z += uShift; vZ = p.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha, uMid, uHalf, uW, uPR, uScan; varying float vZ;
      void main() {
        float d = abs(gl_FragCoord.x / uPR - uW * .5), mask = mix(uMid, 1., smoothstep(uHalf - 160., uHalf + 40., d));
        float far = smoothstep(-34., -6., vZ), s = uScan < 0. ? 0. : exp(-pow((vZ - uScan) * .9, 2.));
        gl_FragColor = vec4(uColor, uAlpha * far * (1. + s * 2.2) * mask); }` })));

  const theme = () => {
    U.uColor.value.set(css('--accent') || '#2ee6c8');
    const hsl = {}; new THREE.Color(css('--bg') || '#111315').getHSL(hsl);
    U.uAlpha.value = hsl.l < 0.5 ? 0.16 : 0.12;
  };

  let raf = 0, timer = 0, heroOn = true;
  const t0 = performance.now();
  const progress = () => scrollY / Math.max(1, root.scrollHeight - innerHeight);
  const frame = now => {
    raf = 0; clearTimeout(timer);
    U.uShift.value = reduce ? 0 : (progress() * 60) % 1;
    const cyc = ((now - t0) / SCAN_MS) % 1, run = !reduce && !heroOn && !document.hidden && cyc < SCAN_RUN;
    U.uScan.value = run ? -34 + cyc / SCAN_RUN * 38 : -1;
    renderer.render(scene, camera);
    if (run) raf = requestAnimationFrame(frame);
    else if (!reduce && !heroOn && !document.hidden) timer = setTimeout(kick, (1 - cyc) * SCAN_MS);   // bis zum nächsten Streif ruhen
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    U.uW.value = innerWidth; U.uPR.value = renderer.getPixelRatio(); U.uHalf.value = Math.min(620, innerWidth / 2 - 24);
    kick();
  };
  const hero = document.querySelector('.hero');
  if (hero) new IntersectionObserver(([e]) => { heroOn = e.intersectionRatio > 0.35; kick(); }, { threshold: [0, 0.35, 1] }).observe(hero);
  else heroOn = false;
  if (!reduce) addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; clearTimeout(timer); } else kick(); });
  const recolor = () => { theme(); kick(); };
  new MutationObserver(recolor).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);
  theme(); resize();
  requestAnimationFrame(() => { cv.style.opacity = '1'; });
}

window.BgFloor3D = { init };
})();
