// Ladebild beim Aufruf der Seite: Sternhimmel, Kapitel-Titel „Kosmos · Reise durch das All“ und Fortschritt als Lichtlinie.
// main.js meldet den Stand (set), bootLoad dort lädt den Programmcode aller Stationen und baut die Startstation samt
// Nachbarn; done() blendet aus, sobald die Szene darunter steht. Die Anzeige läuft dem gemeldeten Stand weich nach und
// geht nie zurück.

export function createBoot(root = document.getElementById('boot')) {
  if (!root) return { set() {}, done() {} };
  const bar = root.querySelector('.boot-bar');
  const what = root.querySelector('.boot-what');
  const pct = root.querySelector('.boot-pct');
  let target = 0, shown = 0, raf = 0, finish = null;

  drawSky(root.querySelector('.boot-sky'));
  const cap = root.querySelector('.boot-cap');
  fitTitle(cap);
  if (document.fonts) document.fonts.ready.then(() => fitTitle(cap));

  function tick() {
    shown += (target - shown) * 0.18;
    if (target - shown < 0.002) shown = target;
    const n = Math.floor(shown * 100);
    bar.style.setProperty('--p', shown.toFixed(4));
    bar.setAttribute('aria-valuenow', String(n));
    pct.textContent = `${n} %`;
    if (shown < target) raf = requestAnimationFrame(tick);
    else { raf = 0; if (finish && shown >= 1) finish(); }
  }

  return {
    set(p, label) {
      target = Math.max(target, Math.min(1, p));
      if (label && what.textContent !== label) what.textContent = label;
      if (!raf) raf = requestAnimationFrame(tick);
    },
    // Linie läuft voll, dann blendet das Bild aus; danach aus dem DOM, damit es keine Ereignisse mehr fängt
    done() {
      finish = () => {
        finish = null;
        root.classList.add('is-done');
        setTimeout(() => root.remove(), 1400);
      };
      this.set(1, 'Bereit');
    },
  };
}

// Sterne einmal zeichnen (der Hauptfaden ist beim Laden ausgelastet): Dichte nach Fläche, wenige helle mit Hof, leichte
// Tönung zwischen warm und eisblau, dazu ein schwacher Schleier oben, der zur Milchstraße der Reise passt
function drawSky(cv) {
  if (!cv) return;
  const pr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.width = Math.round(window.innerWidth * pr);
  const H = cv.height = Math.round(window.innerHeight * pr);
  const g = cv.getContext('2d');
  const haze = g.createRadialGradient(W * 0.62, H * 0.3, 0, W * 0.62, H * 0.3, Math.max(W, H) * 0.6);
  haze.addColorStop(0, 'rgba(51, 204, 255, 0.07)');
  haze.addColorStop(0.5, 'rgba(90, 110, 200, 0.03)');
  haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = haze;
  g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tints = ['255, 244, 230', '235, 242, 255', '200, 230, 255', '255, 255, 255'];
  const n = Math.round((W * H) / (2600 * pr * pr));
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = rnd() * H, m = rnd() ** 3;
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
