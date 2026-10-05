/* Landing-Verhalten der Projektseiten (docs/{project,present,operate,develop}_*.html), Styles in css/landing.css. Klassisches Skript am Ende von <body>:
     Hero      Claim-Zeilen steigen aus der Maske (.hero.is-in, nur mit html.sf-on aus js/scroll_flow.js),
               --hdr = Höhe der Kopfzeile .top
     Zahlen    [data-num] zählen einmal hoch, sobald sichtbar (≤ 900 ms)
     Folien    [data-deck] mit .deck-track > .slide: blenden mit Richtung über, Inhalt [data-k] gestaffelt; Glas-Pfeile
               [data-deck-prev|next], Punkte [data-deck-dots], Zähler [data-deck-count], URL [data-deck-url] (data-url je Folie),
               Sprungknöpfe [data-slide-to], Tasten ←/→, Wischen (Touch). Kein Autoplay. Ohne JS stehen die Folien untereinander.
   Texte DE/EN folgen <html lang> (MutationObserver). prefers-reduced-motion: keine Bewegung. Herkunft: project_docs.html (cab50a03). */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = (de, en) => (root.lang === 'en' ? en : de);
  const onLang = fn => new MutationObserver(fn).observe(root, { attributes: true, attributeFilter: ['lang'] });

  // ── Hero ──
  const hdr = document.querySelector('.top');
  if (hdr) new ResizeObserver(() => root.style.setProperty('--hdr', `${hdr.offsetHeight}px`)).observe(hdr);
  const hero = document.querySelector('.hero');
  if (hero) requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-in')));

  // ── Zahlen zählen einmal hoch ──
  document.querySelectorAll('[data-num]').forEach(el => {
    const end = +el.dataset.num;
    if (reduce || !end) return;
    el.textContent = '0';
    new IntersectionObserver(([en], obs) => {
      if (!en.isIntersecting) return; obs.disconnect();
      const t0 = performance.now(), dur = Math.min(900, 300 + end * 12);
      const f = now => { const k = Math.min(1, (now - t0) / dur); el.textContent = String(Math.round(end * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }, { threshold: .6 }).observe(el);
  });

  // ── Folien ──
  document.querySelectorAll('[data-deck]').forEach(deck => {
    const slides = [...deck.querySelectorAll('.slide')];
    if (slides.length < 2) return;
    const track = deck.querySelector('.deck-track'), dotsBox = deck.querySelector('[data-deck-dots]');
    const countEl = deck.querySelector('[data-deck-count]'), urlEl = deck.querySelector('[data-deck-url]');
    const jumps = [...deck.querySelectorAll('[data-slide-to]')];
    const title = s => (s.querySelector('[data-slide-title]') || s).textContent.trim();
    let cur = 0;
    slides.forEach(s => s.querySelectorAll('[data-k]').forEach((el, i) => el.style.setProperty('--k', i)));
    const dots = slides.map((s, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'deck-dot';
      b.addEventListener('click', () => go(i));
      dotsBox?.append(b);
      return b;
    });
    const label = () => {
      slides.forEach((s, i) => { s.setAttribute('role', 'group'); s.setAttribute('aria-roledescription', T('Folie', 'slide')); s.setAttribute('aria-label', `${i + 1} / ${slides.length}`); });
      dots.forEach((b, i) => b.setAttribute('aria-label', `${T('Folie', 'Slide')} ${i + 1}: ${title(slides[i])}`));
    };
    const sync = () => {
      slides.forEach((s, i) => { const on = i === cur; s.classList.toggle('is-on', on); s.inert = !on; s.setAttribute('aria-hidden', String(!on)); });
      dots.forEach((b, i) => b.setAttribute('aria-current', String(i === cur)));
      jumps.forEach(b => b.setAttribute('aria-current', String(+b.dataset.slideTo === cur)));
      if (countEl) countEl.innerHTML = `<b>${String(cur + 1).padStart(2, '0')}</b> / ${String(slides.length).padStart(2, '0')}`;
      if (urlEl && slides[cur].dataset.url) urlEl.textContent = slides[cur].dataset.url;
      deck.dispatchEvent(new CustomEvent('deck:change', { detail: { index: cur } }));
    };
    function go(i, dir) {
      const n = (i + slides.length) % slides.length;
      if (n === cur) return;
      const d = dir || (n > cur ? 1 : -1), prev = slides[cur], next = slides[n];
      deck.style.setProperty('--dir', d);
      slides.forEach(s => { if (s !== prev) s.classList.remove('is-out'); });
      // neue Folie ohne Übergang auf ihre Startseite (aus Richtung d) setzen, dann einblenden
      next.style.transition = 'none'; void next.offsetWidth; next.style.removeProperty('transition');
      prev.classList.add('is-out');
      cur = n; sync();
    }
    deck.querySelectorAll('[data-deck-prev]').forEach(b => b.addEventListener('click', () => go(cur - 1, -1)));
    deck.querySelectorAll('[data-deck-next]').forEach(b => b.addEventListener('click', () => go(cur + 1, 1)));
    jumps.forEach(b => b.addEventListener('click', () => go(+b.dataset.slideTo)));
    deck.addEventListener('deck:go', e => go(e.detail.index));
    deck.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d || e.target.closest('input, textarea, select, [role="tablist"]')) return;
      e.preventDefault(); go(cur + d, d);
    });
    let x0 = null, y0 = 0;
    track.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { x0 = e.clientX; y0 = e.clientY; } });
    track.addEventListener('pointercancel', () => { x0 = null; });
    track.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    });
    deck.classList.add('deck-on');
    label(); sync();
    onLang(label);
  });
})();
