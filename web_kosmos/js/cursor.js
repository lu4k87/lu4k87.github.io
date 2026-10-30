// Eigener Mauszeiger über der 3D-Ansicht (Vorschau 30.10.2026 „5 Ideen für einen eigenen Maus-Cursor“, Standard A Orbit-Ring):
// Orbit-Ring · Peil-Sucher · Komet · Hex-Sonde · Aktions-Etikett, Wahl in den Allgemeinen Einstellungen → Oberfläche „Mauszeiger“
// (settings.S.cursor, „System“ = aus). Gilt nur mit Maus oder Touchpad über der Szene (#stage) und den Abzeichen
// (.hsb, .hsl); über Panels und Suche bleibt der System-Zeiger – außer mit „Mauszeiger gilt: Überall“ (settings.S.cursorAll),
// dann auch dort (Bedienelemente = Zustand „link“), nur Textfelder behalten die Schreibmarke. Touch und Stift sind unverändert (Geräte mit
// Finger als Hauptzeiger, pointer: coarse, ganz aus; sonst entscheidet pointerType jedes Ereignisses).
// Bewegung „Ruhig“/„Aus“ (settings.S.motion) oder „Bewegung reduzieren“ im System: kein Umlauf, kein Schweif, kein Nachziehen.
// Leistung: ein rAF-Takt nur solange der Zeiger sichtbar ist, nur transform/opacity; das Ziel kommt aus pointerover (kein
// elementFromPoint je Bild), die Lage des Abzeichens für den Peil-Sucher wird nur bei Mausbewegung gelesen.
import { up } from './content.js';
import { settings, onSettings } from './settings.js';

// Kapitel wie hud.js CHAPTERS → Ebenen-Farbe --ch über [data-ch] (kosmos.css)
const HUBS = ['earth', 'solar', 'galaxy', 'local'];
const chapter = (id) => { for (let x = id; x; x = up(x)) if (HUBS.includes(x)) return x; return HUBS[HUBS.length - 1]; };
// „Überall“: Schreibmarke bleibt in Textfeldern; Bedienelemente zeigen den Zustand „link“ (wie Info, ohne Etikett)
const TEXT = 'input:not([type=range], [type=checkbox], [type=radio], [type=button]), textarea, [contenteditable="true"]';
const LINK = 'button, a[href], select, summary, label, input, [role=tab], [role=button], [role=radio], [role=option]';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const HEX = 'M20 2L35.59 11L35.59 29L20 38L4.41 29L4.41 11z';   // Form der .hex in hud.js
const ARROW = '<path d="M1 1 L1 18.5 L5.6 14.4 L8.7 21.2 L11.6 19.9 L8.6 13.2 L14.6 13.2 Z" fill="#fff" stroke="#03161a" stroke-width="1.4" stroke-linejoin="round"/>';
const TAIL = 16;
const BUILD = {
  orbit: () => '<div class="kc-ring"><div class="kc-rim"><div class="kc-orbit"><i class="kc-moon"></i></div></div></div><i class="kc-core"></i>',
  seeker: () => '<div class="kc-box"><i></i><i></i><i></i><i></i></div><i class="kc-dot"></i><p class="kc-tag"></p>',
  comet: () => '<i class="kc-t"></i>'.repeat(TAIL) + '<div class="kc-halo"><i></i></div><div class="kc-head"><i></i></div>',
  hex: () => `<div class="kc-hexw"><svg class="kc-hex" viewBox="0 0 40 40"><path class="kc-hx" d="${HEX}"/><circle class="kc-g kc-g-dot" cx="20" cy="20" r="3"/>`
    + '<path class="kc-g kc-g-dive" d="M13 17l7 7 7-7" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<g class="kc-g kc-g-info"><circle cx="20" cy="13" r="2.4"/><rect x="18.2" y="17.5" width="3.6" height="11" rx="1.2"/></g></svg></div>',
  label: () => `<svg class="kc-arrow" viewBox="0 0 20 22">${ARROW}</svg><div class="kc-chip"></div>`,
};
// Hinweis des Aktions-Etiketts je Zustand; Szene erst nach kurzer Ruhe, damit der Hinweis beim Überfahren nicht flackert
const LABEL = {
  dive: (n) => `<kbd>Klick</kbd>${esc(n)} · hineinfliegen`,
  info: (n) => `<kbd>Klick</kbd>${esc(n)} · Info`,
  space: () => '<kbd>Ziehen</kbd>drehen <kbd>Rad</kbd>Zoom',
  drag: () => '<kbd>Ziehen</kbd>Blick drehen',
};

export function mountCursor(canvas = document.getElementById('stage')) {
  const coarse = matchMedia('(pointer: coarse)'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const el = document.createElement('div');
  el.className = 'kc';
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  // zone: none (außerhalb) · ui (Panels, System-Zeiger) · space (Szene) · dive/info (Abzeichen)
  const st = { x: 0, y: 0, seen: false, mouse: false, zone: 'none', hs: null, link: false, name: '', press: false, drag: false,
    vx: 0, vy: 0, ang: 0, rot: 0, still: 0, hist: [], box: null, lock: null, chip: '', chipW: 0, chipH: 0 };
  let kind = null, raf = 0, last = 0;
  const $ = (s) => el.querySelector(s);
  const calm = () => settings.S.motion !== 'full' || reduced.matches;
  const on = () => kind !== 'system' && !coarse.matches && st.mouse;
  const all = () => settings.S.cursorAll === 'all';
  const shown = () => on() && st.seen && (st.drag || ['space', 'dive', 'info'].includes(st.zone) || (st.zone === 'ui' && all()));

  const build = () => {
    kind = settings.S.cursor;
    el.innerHTML = kind === 'system' ? '' : BUILD[kind]();
    el.dataset.kind = kind;
    st.hist = []; st.box = null; st.chip = '';
    update();
  };
  const tint = () => { el.dataset.ch = chapter(root.dataset.station || 'earth'); };
  // Ziel unter dem Zeiger; Abzeichen = Knopf in #hotspots (hud.js), Name aus aria-label „Mond – hineinfliegen“
  const zoneOf = (t) => {
    if (!(t instanceof Element)) return { zone: 'none', hs: null };
    if (t === canvas) return { zone: 'space', hs: null };
    const hs = t.closest('#hotspots .hsb, #hotspots .hsl');
    if (hs) return { zone: hs.classList.contains('hsb--dive') ? 'dive' : 'info', hs };
    if (t.closest(TEXT)) return { zone: 'text', hs: null };
    return { zone: 'ui', hs: null, link: !!t.closest(LINK) };
  };
  const setZone = (t) => {
    const z = zoneOf(t);
    if (z.hs !== st.hs) st.name = z.hs ? (z.hs.getAttribute('aria-label') || '').split(' – ')[0] : '';
    Object.assign(st, z);
    readLock();
    update();
  };
  // Mittelpunkt des Hex-Abzeichens (Peil-Sucher rastet dort ein); nur bei Ereignissen gelesen, nie je Bild
  const readLock = () => {
    if (kind !== 'seeker' || !st.hs) { st.lock = null; return; }
    const r = (st.hs.querySelector('.hex--hs') || st.hs).getBoundingClientRect();
    st.lock = [r.left + r.width / 2, r.top + r.height / 2];
  };
  const update = () => {
    root.classList.toggle('kc-on', on());
    root.classList.toggle('kc-all', all());
    el.classList.toggle('is-calm', calm());
    const vis = shown();
    el.classList.toggle('is-on', vis);
    if (vis && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };

  const T = (n, x, y, extra = '') => { if (n) n.style.transform = `translate(${x}px, ${y}px)${extra ? ` ${extra}` : ''}`; };
  function render(dt) {
    const { x, y } = st, still = calm();
    const state = st.drag ? 'drag' : st.zone === 'dive' || st.zone === 'info' ? st.zone : st.zone === 'ui' && st.link ? 'link' : 'rest';
    if (el.dataset.state !== state) el.dataset.state = state;
    el.classList.toggle('is-down', st.press);
    if (kind === 'orbit') {
      const sp = still ? 0 : Math.min(1, Math.hypot(st.vx, st.vy) / 30), k = state === 'drag' ? 1 + sp * 0.6 : 1;
      T($('.kc-ring'), x, y, k > 1.001 ? `rotate(${st.ang}rad) scale(${k}, ${1 / Math.sqrt(k)})` : '');
      T($('.kc-core'), x, y);
    } else if (kind === 'seeker') {
      const box = $('.kc-box'), tag = $('.kc-tag'), lock = (state === 'dive' || state === 'info') && st.lock;
      const [tx, ty] = lock || [x, y], size = lock ? 38 : 26;
      if (!st.box || still) st.box = [tx, ty];
      const f = 1 - Math.exp(-dt * 26);
      st.box[0] += (tx - st.box[0]) * f; st.box[1] += (ty - st.box[1]) * f;
      T(box, st.box[0], st.box[1], state === 'drag' && !still ? `scale(${size / 26 * 0.85}) rotate(45deg)` : `scale(${size / 26})`);
      T($('.kc-dot'), x, y);
      const text = state === 'dive' ? `LOCK · ${st.name}` : state === 'info' ? `INFO · ${st.name}` : state === 'drag' ? 'DREHEN' : '';
      if (tag.textContent !== text) tag.textContent = text;
      const ty2 = st.box[1] - size / 2 - 27;
      T(tag, st.box[0] - size / 2, ty2 < 4 ? st.box[1] + size / 2 + 6 : ty2);
    } else if (kind === 'comet') {
      if (!still) { st.hist.unshift([x, y]); if (st.hist.length > TAIL) st.hist.length = TAIL; } else st.hist.length = 0;
      el.querySelectorAll('.kc-t').forEach((d, i) => {
        const p = st.hist[i], o = p ? (0.75 * (1 - i / TAIL)).toFixed(2) : '0';
        if (d.style.opacity !== o) d.style.opacity = o;
        if (p) T(d, p[0], p[1], `scale(${(1 - i / TAIL).toFixed(2)})`);
      });
      T($('.kc-halo'), x, y); T($('.kc-head'), x, y);
    } else if (kind === 'hex') {
      T($('.kc-hexw'), x, y, state === 'drag' && !still ? `rotate(${st.rot}deg)` : '');
    } else if (kind === 'label') {
      T($('.kc-arrow'), x, y);
      const chip = $('.kc-chip'), key = state === 'rest' ? (st.zone === 'space' && st.still > 0.6 ? 'space' : '') : state;
      const html = LABEL[key] ? LABEL[key](st.name) : '';   // Bedienelemente (link) ohne Etikett
      if (html !== st.chip) {
        st.chip = html;
        if (html) { chip.innerHTML = html; st.chipW = chip.offsetWidth; st.chipH = chip.offsetHeight; }   // Maß nur beim Wechsel
        chip.classList.toggle('on', !!html);
      }
      // am rechten bzw. unteren Rand klappt das Etikett auf die andere Seite des Pfeils
      const cx = x + 18 + st.chipW > innerWidth - 8 ? x - 8 - st.chipW : x + 18, cy = y + 24 + st.chipH > innerHeight - 8 ? y - 8 - st.chipH : y + 24;
      T(chip, cx, cy);
    }
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!shown()) { raf = 0; return; }
    st.still += dt;
    const d = Math.exp(-dt * 10);
    st.vx *= d; st.vy *= d;
    render(dt);
    raf = requestAnimationFrame(frame);
  }

  addEventListener('pointermove', (e) => {
    const mouse = e.pointerType === 'mouse';
    if (mouse !== st.mouse) { st.mouse = mouse; if (!mouse) st.hist = []; update(); }
    if (!mouse) return;   // Touch und Stift: System wie bisher
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (st.seen && Math.hypot(dx, dy) > 0.5) { st.vx = dx; st.vy = dy; st.ang = Math.atan2(dy, dx); st.still = 0; if (st.drag) st.rot += dx * 1.5; }
    st.x = e.clientX; st.y = e.clientY;
    if (!st.seen) { st.seen = true; setZone(e.target); }
    else if (st.lock) readLock();   // Abzeichen wandert mit der Szene
  }, { passive: true });
  document.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse' && !st.drag) setZone(e.target); });
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    st.press = true;
    st.drag = e.target === canvas;
    update();
  });
  const release = (e) => {
    if (!st.press) return;
    st.press = st.drag = false;
    // nach dem Ziehen (Zeiger an der Szene gefangen) einmal nachsehen, was jetzt darunter liegt
    setZone(document.elementFromPoint(e.clientX, e.clientY));
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  root.addEventListener('pointerleave', () => { if (!st.drag) { st.zone = 'none'; st.hs = null; update(); } });
  addEventListener('blur', () => { st.press = st.drag = false; st.zone = 'none'; update(); });
  coarse.addEventListener('change', update);
  reduced.addEventListener('change', update);
  onSettings((keys) => { if (keys.includes('cursor')) build(); else if (keys.includes('motion') || keys.includes('cursorAll')) update(); });
  new MutationObserver(tint).observe(root, { attributes: true, attributeFilter: ['data-station'] });
  tint();
  build();
}
