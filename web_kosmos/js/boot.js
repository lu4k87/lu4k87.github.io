// Ladebild beim Aufruf der Seite: Sternhimmel mit Nebel (drei Looks, Knopf unten rechts), Kapitel-Titel „Kosmos · Reise
// durch das All“ und Fortschritt als Lichtlinie. main.js meldet den Stand (set), bootLoad dort lädt den Programmcode aller
// Stationen und baut die Startstation samt Nachbarn; done() blendet aus, sobald die Szene darunter steht. Die Anzeige läuft
// dem gemeldeten Stand weich nach und geht nie zurück.
// Mindestens 10 s Ladebild (User 27.10.2026), damit alles sauber geladen ist; ist die Reise früher bereit, blendet
// „Esc to skip“ ein. Automatisierte Browser (Tests, Standbilder) warten nicht.
import { LOOKS, createNebula, drawGrain } from './boot_nebula.js';

const MIN_MS = 10000;
const LOOK_KEY = 'kosmos.bootNebula';
// Tasten, mit denen main.js den Auftakt-Film überspringt: solange das Ladebild steht, den Film darunter nicht treffen
const FILM_KEYS = ['Escape', 'Enter', ' ', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'PageDown', 'PageUp'];

export function createBoot(root = document.getElementById('boot')) {
  if (!root) return { set() {}, done() {} };
  const bar = root.querySelector('.boot-bar');
  const what = root.querySelector('.boot-what');
  const pct = root.querySelector('.boot-pct');
  const skipBtn = root.querySelector('.boot-skip');
  let target = 0, shown = 0, raf = 0, finish = null, skipNow = null;

  drawSky(root.querySelector('.boot-sky'), { seed: 7, density: 2400, haze: true });
  drawSky(root.querySelector('.boot-near'), { seed: 31, density: 26000, bright: true });
  const nebula = createNebula();
  setupLooks(root, nebula);
  const cap = root.querySelector('.boot-cap');
  fitTitle(cap);
  if (document.fonts) document.fonts.ready.then(() => fitTitle(cap));

  function onKey(ev) {
    if (!FILM_KEYS.includes(ev.key)) return;
    ev.stopImmediatePropagation();
    if (ev.key === 'Escape') { ev.preventDefault(); if (skipNow) skipNow(); }
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

  // Bis 10 s nach Seitenaufruf stehen bleiben; Esc oder Klick auf den Hinweis beendet früher
  function hold() {
    const rest = MIN_MS - performance.now();
    if (rest <= 0 || navigator.webdriver) return Promise.resolve();
    if (skipBtn) { skipBtn.hidden = false; requestAnimationFrame(() => skipBtn.classList.add('is-on')); }
    return new Promise((resolve) => {
      const t = setTimeout(resolve, rest);
      skipNow = () => { clearTimeout(t); resolve(); };
    });
  }

  return {
    set(p, label) {
      target = Math.max(target, Math.min(1, p));
      if (label && label !== (nextLabel !== null ? nextLabel : what.textContent)) showLabel(label);
      if (!raf) raf = requestAnimationFrame(tick);
    },
    // Linie läuft voll, Mindestzeit abwarten, Texte blenden aus, dann das ganze Bild; danach aus dem DOM, damit es keine
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

// Nebel-Look wählen (Knopf unten rechts, A → B → C), Wahl bleibt im Browser; Name blendet kurz ein
function setupLooks(root, nebula) {
  const glow = root.querySelector('.boot-glow'), dust = root.querySelector('.boot-dust');
  const btn = root.querySelector('.boot-neb'), name = root.querySelector('.boot-neb-name');
  if (!nebula || !glow || !dust) { if (btn) btn.hidden = true; return; }
  const pr = Math.min(1.5, window.devicePixelRatio || 1);
  for (const cv of [glow, dust]) {
    const r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * pr); cv.height = Math.round(r.height * pr);
  }
  drawGrain(root.querySelector('.boot-grain'));
  let look = 'B', hide = 0;
  try { const s = localStorage.getItem(LOOK_KEY); if (LOOKS[s]) look = s; } catch (e) { /* privat: Standard */ }
  const apply = (announce) => {
    root.dataset.neb = look;
    nebula.draw(look, glow, dust);
    const label = `Nebel: ${LOOKS[look]}`;
    btn.setAttribute('aria-label', `${label} – wechseln`);
    btn.title = label;
    if (!announce) return;
    name.textContent = label;
    name.classList.add('is-on');
    clearTimeout(hide);
    hide = setTimeout(() => name.classList.remove('is-on'), 1800);
  };
  apply(false);
  btn.addEventListener('click', () => {
    const keys = Object.keys(LOOKS);
    look = keys[(keys.indexOf(look) + 1) % keys.length];
    try { localStorage.setItem(LOOK_KEY, look); } catch (e) { /* privat: nur für diesen Aufruf */ }
    apply(true);
  });
}

// Sterne einmal zeichnen (der Hauptfaden ist beim Laden ausgelastet): Dichte nach Fläche, wenige helle mit Hof, leichte
// Tönung zwischen warm und eisblau, dazu ein schwacher Schleier oben, der zur Milchstraße der Reise passt.
// bright = nur helle Sterne (nahe Ebene der Parallaxe); Größe nach der Ebene, die etwas über den Rand ragt (Kamera)
function drawSky(cv, { seed, density, bright = false, haze = false }) {
  if (!cv) return;
  const pr = Math.min(2, window.devicePixelRatio || 1);
  const rect = cv.getBoundingClientRect();
  const W = cv.width = Math.round((rect.width || window.innerWidth) * pr);
  const H = cv.height = Math.round((rect.height || window.innerHeight) * pr);
  const g = cv.getContext('2d');
  if (haze) {
    const h = g.createRadialGradient(W * 0.62, H * 0.3, 0, W * 0.62, H * 0.3, Math.max(W, H) * 0.6);
    h.addColorStop(0, 'rgba(51, 204, 255, 0.07)');
    h.addColorStop(0.5, 'rgba(90, 110, 200, 0.03)');
    h.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = h;
    g.fillRect(0, 0, W, H);
  }
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tints = ['255, 244, 230', '235, 242, 255', '200, 230, 255', '255, 255, 255'];
  const n = Math.round((W * H) / (density * pr * pr));
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = rnd() * H;
    let m = rnd() ** 3;
    if (bright) m = 0.5 + m * 0.5;
    const r = (0.35 + m * 1.1) * pr;
    g.fillStyle = `rgba(${tints[i % tints.length]}, ${0.18 + m * 0.75})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    if (m > 0.55) {
      const h = g.createRadialGradient(x, y, 0, x, y, r * 6);
      h.addColorStop(0, 'rgba(200, 230, 255, 0.22)');
      h.addColorStop(1, 'rgba(200, 230, 255, 0)');
      g.fillStyle = h;
      g.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    }
  }
}

// Titel einzeilig wie der Kapitel-Titel (hud.js fitCaption): Schrift nach der verfügbaren Breite verkleinern
function fitTitle(cap) {
  const el = cap && cap.querySelector('.cap-title');
  if (!el) return;
  el.style.fontSize = '';
  const cs = getComputedStyle(cap);
  const avail = (cap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 0.98;
  if (el.scrollWidth > avail) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * avail / el.scrollWidth}px`;
}
