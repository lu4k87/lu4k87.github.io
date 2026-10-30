// Ladebild beim Aufruf der Seite: Hintergrund in drei Looks (Text-Umschalter unten rechts, boot_nebula.js), Kapitel-Titel (Text in
// index.html) und Fortschritt als Lichtlinie. main.js meldet den Stand (set), bootLoad dort lädt den Programmcode aller
// Stationen und baut die Startstation samt Nachbarn; done() blendet aus, sobald die Szene darunter steht. Die Anzeige läuft
// dem gemeldeten Stand weich nach und geht nie zurück.
// Ist die Reise bereit, blendet unter dem Ladebalken „Reise starten · Enter“ ein; das Ladebild wartet auf Enter oder
// Klick (User 27.10.2026, ersetzt die 10-s-Mindestzeit). Automatisierte und Headless-Browser (Tests, Standbilder) warten
// nicht: Headless-Chrome über CDP meldet navigator.webdriver = false, daher zusätzlich der User-Agent.
import { LOOKS, createNebula } from './boot_nebula.js';

const LOOK_KEY = 'kosmos.bootNebula';
// Tasten, mit denen main.js den Auftakt-Film überspringt: solange das Ladebild steht, den Film darunter nicht treffen
const FILM_KEYS = ['Escape', 'Enter', ' ', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'PageDown', 'PageUp'];

export function createBoot(root = document.getElementById('boot')) {
  if (!root) return { set() {}, done: () => Promise.resolve() };
  const bar = root.querySelector('.boot-bar');
  const what = root.querySelector('.boot-what');
  const pct = root.querySelector('.boot-pct');
  const skipBtn = root.querySelector('.boot-go');
  let target = 0, shown = 0, raf = 0, finish = null, skipNow = null;

  const nebula = setupLooks(root);
  const cap = root.querySelector('.boot-cap');
  fitTitle(cap);
  if (document.fonts) document.fonts.ready.then(() => fitTitle(cap));

  function onKey(ev) {
    if (!FILM_KEYS.includes(ev.key)) return;
    ev.stopImmediatePropagation();
    if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); if (skipNow) skipNow(); }
  }
  window.addEventListener('keydown', onKey, true);
  if (skipBtn) skipBtn.addEventListener('click', () => skipNow && skipNow());

  // Schritt-Text weich tauschen: alter Text blendet aus, neuer ein; schnelle Folgen zeigen nur den letzten
  let nextLabel = null, swapping = false;
  function showLabel(label) {
    nextLabel = label;
    if (swapping) return;
    swapping = true;
    what.classList.add('is-out');
    setTimeout(() => { what.textContent = nextLabel; what.classList.remove('is-out'); swapping = false; }, 220);
  }

  // Nachlauf nach Zeit statt je Bild (τ ≈ 0,085 s ≙ 18 % je Bild bei 60 Hz): auf einem schwachen Rechner mit 4 Bildern/s
  // hing die Linie sonst ~20 s hinter dem Stand her, bevor das Ladebild ausblendet
  let then = 0;
  function tick(now) {
    const dt = then ? Math.min(0.25, (now - then) / 1000) : 1 / 60;
    then = now;
    shown += (target - shown) * (1 - Math.exp(-dt / 0.085));
    if (target - shown < 0.002) shown = target;
    const n = Math.floor(shown * 100);
    bar.style.setProperty('--p', shown.toFixed(4));
    bar.setAttribute('aria-valuenow', String(n));
    pct.textContent = `${n} %`;
    if (shown < target) raf = requestAnimationFrame(tick);
    else { raf = 0; then = 0; if (finish && shown >= 1) finish(); }
  }

  // Stehen bleiben, bis Enter (still auch Esc) oder Klick auf den Hinweis kommt
  function hold() {
    if (navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent) || !skipBtn) return Promise.resolve();
    skipBtn.hidden = false;
    requestAnimationFrame(() => skipBtn.classList.add('is-on'));
    return new Promise((resolve) => { skipNow = resolve; });
  }

  return {
    set(p, label) {
      target = Math.max(target, Math.min(1, p));
      if (nebula) nebula.setP(target);
      if (label && label !== (nextLabel !== null ? nextLabel : what.textContent)) showLabel(label);
      if (!raf) raf = requestAnimationFrame(tick);
    },
    // Linie läuft voll, auf Enter warten, Texte blenden aus, dann das ganze Bild; danach aus dem DOM, damit es keine
    // Ereignisse mehr fängt. Ergebnis: Promise, sobald das Ladebild fast ausgeblendet ist (shown s nach Beginn) – dann
    // sieht man die Bühne
    done(shown = 0.5) {
      return new Promise((resolve) => {
        finish = () => {
          finish = null;
          hold().then(() => {
            skipNow = null;
            root.classList.add('is-leaving');
            setTimeout(() => {
              root.classList.add('is-done');
              setTimeout(resolve, shown * 1000);
              setTimeout(() => {
                window.removeEventListener('keydown', onKey, true);
                if (nebula) nebula.dispose();
                root.remove();
              }, 1400);
            }, 500);
          });
        };
        this.set(1, 'Bereit');
      });
    },
  };
}

// Look wählen: Text-Umschalter „Nebel · Linse · Lichtpunkt“ unten rechts (Tastatur, aria-pressed), Wahl bleibt im
// Browser; Standard C Lichtpunkt (Empfehlung der Vorschau 28.10.2026). Ohne WebGL 2 kein Hintergrund und kein Umschalter
function setupLooks(root) {
  const cv = root.querySelector('.boot-fx'), bar = root.querySelector('.boot-look');
  let look = 'C';
  try { const s = localStorage.getItem(LOOK_KEY); if (LOOKS[s]) look = s; } catch (e) { /* privat: Standard */ }
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nebula = cv && createNebula(cv, look, still, () => { if (bar) bar.hidden = true; });
  if (!nebula || !bar) return nebula;
  const btns = Object.entries(LOOKS).map(([k, name]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.setAttribute('aria-pressed', String(k === look));
    b.addEventListener('click', () => {
      if (k === look) return;
      look = k;
      btns.forEach((x, i) => x.setAttribute('aria-pressed', String(Object.keys(LOOKS)[i] === k)));
      try { localStorage.setItem(LOOK_KEY, k); } catch (e) { /* privat: nur für diesen Aufruf */ }
      nebula.setLook(k);
    });
    return b;
  });
  btns.forEach((b, i) => {
    if (i) bar.insertAdjacentHTML('beforeend', '<span aria-hidden="true">·</span>');
    bar.append(b);
  });
  bar.hidden = false;
  return nebula;
}

// Titel einzeilig wie der Kapitel-Titel (hud.js fitCaption): Schrift nach der verfügbaren Breite verkleinern
function fitTitle(cap) {
  const el = cap && cap.querySelector('.cap-title');
  if (!el) return;
  el.style.fontSize = '';
  const cs = getComputedStyle(cap);
  const avail = (cap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 0.84;
  if (el.scrollWidth > avail) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * avail / el.scrollWidth}px`;
}
