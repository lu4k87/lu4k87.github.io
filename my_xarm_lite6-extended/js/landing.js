/* Landing-Verhalten der Projektseiten (docs/{project,present,operate,develop}_*.html), Styles in css/landing.css. Klassisches Skript am Ende von <body>:
     Hero      Claim-Zeilen steigen aus der Maske (.hero.is-in, nur mit html.sf-on aus js/scroll_flow.js),
               --hdr = Höhe der Kopfzeile .top
     Zahlen    [data-num] zählen einmal hoch, sobald sichtbar (≤ 900 ms)
     Folien    [data-deck] mit .deck-track > .slide: neue Folie wischt per Maske aus der Laufrichtung herein (data-dir, --dir),
               Inhalt [data-k] gestaffelt; Ziehen mit Maus/Touch führt die Maske mit (--p), Loslassen ab 22 % oder schnell = weiter;
               Glas-Pfeile [data-deck-prev|next], Punkte [data-deck-dots], Zähler [data-deck-count], URL [data-deck-url] (data-url
               je Folie), Sprungknöpfe [data-slide-to] mit gleitender Markierung .deck-ind, Tasten ←/→. Kein Autoplay.
               Bilder laden vor, sobald das Deck in die Nähe kommt. Ohne JS stehen die Folien untereinander.
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
    // gleitende Markierung hinter den Sprungknöpfen (nur wenn alle im selben Container stehen)
    const box = jumps[0]?.parentElement, ind = box && jumps.every(b => b.parentElement === box) ? document.createElement('span') : null;
    if (ind) { ind.className = 'deck-ind'; ind.setAttribute('aria-hidden', 'true'); box.classList.add('deck-ind-box'); box.prepend(ind); }
    const place = () => {
      const b = jumps.find(j => +j.dataset.slideTo === cur);
      if (!ind || !b) return;
      Object.assign(ind.style, { width: `${b.offsetWidth}px`, height: `${b.offsetHeight}px`, transform: `translate3d(${b.offsetLeft}px, ${b.offsetTop}px, 0)` });
    };
    const roll = el => { el.classList.remove('deck-roll'); void el.offsetWidth; el.classList.add('deck-roll'); };
    let moved = false;
    const sync = () => {
      slides.forEach((s, i) => { const on = i === cur; s.classList.toggle('is-on', on); s.inert = !on; s.setAttribute('aria-hidden', String(!on)); });
      dots.forEach((b, i) => b.setAttribute('aria-current', String(i === cur)));
      jumps.forEach(b => b.setAttribute('aria-current', String(+b.dataset.slideTo === cur)));
      place();
      if (countEl) countEl.innerHTML = `<b${moved ? ' class="deck-roll"' : ''}>${String(cur + 1).padStart(2, '0')}</b> / ${String(slides.length).padStart(2, '0')}`;
      if (urlEl && slides[cur].dataset.url) { urlEl.textContent = slides[cur].dataset.url; if (moved) roll(urlEl); }
      deck.dispatchEvent(new CustomEvent('deck:change', { detail: { index: cur } }));
    };
    const setDir = d => { deck.dataset.dir = d > 0 ? 'next' : 'prev'; deck.style.setProperty('--dir', d); };
    // peeked = Folie, die beim Ziehen schon offen liegt: startet ohne Zurücksetzen dort, wo die Maske steht
    function go(i, dir, peeked) {
      const n = (i + slides.length) % slides.length;
      if (n === cur) return;
      const d = dir || (n > cur ? 1 : -1), prev = slides[cur], next = slides[n];
      setDir(d);
      // alle außer alter + gezogener Folie ohne Übergang auf die Startkante (aus Richtung d) setzen, dann einblenden
      slides.forEach(s => { if (s !== prev && !(peeked && s === next)) { s.classList.add('is-prep'); s.classList.remove('is-out'); } });
      void deck.offsetWidth;
      slides.forEach(s => s.classList.remove('is-prep', 'is-peek'));
      deck.classList.remove('deck-drag'); deck.style.removeProperty('--p');
      prev.classList.add('is-out');
      cur = n; moved = true; sync();
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
    // Ziehen: waagrecht ab 8 px übernimmt das Deck (senkrecht bleibt Seiten-Scroll), Nachbarfolie folgt dem Zeiger
    let drag = null;
    const peek = d => {
      const n = (cur + d + slides.length) % slides.length;
      if (drag.d === d) return slides[n];
      slides.forEach(s => s.classList.remove('is-peek'));
      setDir(d);
      slides[n].classList.add('is-prep'); void slides[n].offsetWidth; slides[n].classList.remove('is-prep');
      slides[n].classList.add('is-peek'); drag.d = d;
      return slides[n];
    };
    const endDrag = commit => {
      const dr = drag; drag = null;
      if (!dr?.on) return;
      if (commit) { go(cur + dr.d, dr.d, true); return; }
      slides.forEach(s => s.classList.remove('is-peek'));
      deck.classList.remove('deck-drag'); deck.style.removeProperty('--p');
    };
    track.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      drag = { x0: e.clientX, y0: e.clientY, t0: performance.now(), id: e.pointerId, on: false, d: 0, p: 0 };
    });
    track.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.on) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        if (Math.abs(dx) < 8) return;
        drag.on = true; track.setPointerCapture(e.pointerId); deck.classList.add('deck-drag');
      }
      if (!dx) return;
      peek(dx < 0 ? 1 : -1);
      drag.p = Math.min(1, Math.abs(dx) / track.offsetWidth);
      if (!reduce) deck.style.setProperty('--p', drag.p.toFixed(4));
    });
    track.addEventListener('pointerup', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const v = Math.abs(e.clientX - drag.x0) / Math.max(1, performance.now() - drag.t0);
      endDrag(drag.d && (drag.p > .22 || v > .5));
    });
    track.addEventListener('pointercancel', () => endDrag(false));
    // Bilder vorladen, sobald das Deck in die Nähe kommt (sonst wischt die Maske über ein leeres Feld)
    new IntersectionObserver(([en], obs) => {
      if (!en.isIntersecting) return; obs.disconnect();
      slides.forEach(s => s.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; }));
    }, { rootMargin: '600px 0px' }).observe(deck);
    if (ind) new ResizeObserver(place).observe(box);
    deck.classList.add('deck-on');
    label(); sync();
    if (ind) requestAnimationFrame(() => ind.classList.add('is-ready'));
    onLang(label);
  });
})();
