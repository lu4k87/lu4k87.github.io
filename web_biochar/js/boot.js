// Ladebild beim Aufruf der Seite (wie Kosmos): Titel, Fortschritt als Lichtlinie, dahinter ein Kohlenstoff-Gitter, das mit
// dem Fortschritt aufglüht (boot.css, nur CSS – läuft weiter, während der Hauptfaden Ebenen baut). main.js meldet den Stand
// (set), bootLoad dort lädt den Programmcode aller Ebenen und baut die Startebene samt Nachbarn; done() blendet aus, sobald
// die Szene darunter steht. Die Anzeige läuft dem gemeldeten Stand weich nach und geht nie zurück.
// Ist alles bereit, blendet „Reise starten · Enter“ ein und das Ladebild wartet auf Enter oder Klick. Nicht warten:
// Ausstellung (?tour) sowie automatisierte und Headless-Browser (Prüfläufe, Screenshots) – dort verschwindet es sofort.

const AUTO = navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent);

export function createBoot({ wait = true } = {}, root = document.getElementById('boot')) {
  const reveal = () => document.body.classList.add('is-shown');   // Bühne sichtbar: Einstieg der Zoom-Schiene
  if (!root) return { set() {}, done: () => Promise.resolve(reveal()) };
  const bar = root.querySelector('.boot-bar');
  const what = root.querySelector('.boot-what');
  const pct = root.querySelector('.boot-pct');
  const goBtn = root.querySelector('.boot-go');
  let target = 0, shown = 0, raf = 0, finish = null, goNow = null;

  const cap = root.querySelector('.boot-cap');
  fitTitle(cap);
  if (document.fonts) document.fonts.ready.then(() => fitTitle(cap));

  // Solange das Ladebild steht, keine Taste an die Szene darunter (Pfeile, Zahlen); Enter, Leertaste, Esc starten
  function onKey(ev) {
    if (ev.key === 'Tab') return;
    ev.stopImmediatePropagation();
    if (['Enter', ' ', 'Escape'].includes(ev.key)) { ev.preventDefault(); if (goNow) goNow(); }
  }
  window.addEventListener('keydown', onKey, true);
  if (goBtn) goBtn.addEventListener('click', () => goNow && goNow());

  // Schritt-Text weich tauschen: alter Text blendet aus, neuer ein; schnelle Folgen zeigen nur den letzten
  let nextLabel = null, swapping = false;
  function showLabel(label) {
    nextLabel = label;
    if (swapping) return;
    swapping = true;
    what.classList.add('is-out');
    setTimeout(() => { what.textContent = nextLabel; what.classList.remove('is-out'); swapping = false; }, 220);
  }

  // Nachlauf nach Zeit statt je Bild (τ ≈ 0,085 s): auch bei wenigen Bildern je Sekunde hängt die Linie nicht nach
  let then = 0;
  function tick(now) {
    const dt = then ? Math.min(0.25, (now - then) / 1000) : 1 / 60;
    then = now;
    shown += (target - shown) * (1 - Math.exp(-dt / 0.085));
    if (target - shown < 0.002) shown = target;
    const n = Math.floor(shown * 100);
    root.style.setProperty('--p', shown.toFixed(4));
    bar.setAttribute('aria-valuenow', String(n));
    pct.textContent = `${n} %`;
    if (shown < target) raf = requestAnimationFrame(tick);
    else { raf = 0; then = 0; if (finish && shown >= 1) finish(); }
  }

  function hold() {
    if (!wait || !goBtn) return Promise.resolve();
    goBtn.hidden = false;
    requestAnimationFrame(() => { goBtn.classList.add('is-on'); goBtn.focus({ preventScroll: true }); });
    return new Promise((resolve) => { goNow = resolve; });
  }

  function remove() {
    window.removeEventListener('keydown', onKey, true);
    root.remove();
    reveal();
  }

  return {
    set(p, label) {
      target = Math.max(target, Math.min(1, p));
      if (label && label !== (nextLabel !== null ? nextLabel : what.textContent)) showLabel(label);
      if (!raf) raf = requestAnimationFrame(tick);
    },
    // Linie läuft voll, auf Enter warten, Texte blenden aus, dann das ganze Bild; danach aus dem DOM. Ergebnis: Promise,
    // sobald das Ladebild fast ausgeblendet ist (fade s nach Beginn) – dann sieht man die Bühne
    done(fade = 0.5) {
      if (AUTO) { remove(); return Promise.resolve(); }
      return new Promise((resolve) => {
        finish = () => {
          finish = null;
          hold().then(() => {
            goNow = null;
            root.classList.add('is-leaving');
            reveal();
            setTimeout(() => {
              root.classList.add('is-done');
              setTimeout(resolve, fade * 1000);
              setTimeout(remove, 1400);
            }, 500);
          });
        };
        this.set(1, 'Bereit');
      });
    },
  };
}

// Titel einzeilig wie in Kosmos: Schrift nach der verfügbaren Breite verkleinern
function fitTitle(cap) {
  const el = cap && cap.querySelector('.cap-title');
  if (!el) return;
  el.style.fontSize = '';
  const cs = getComputedStyle(cap);
  const avail = (cap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 0.92;
  if (el.scrollWidth > avail) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * avail / el.scrollWidth}px`;
}
