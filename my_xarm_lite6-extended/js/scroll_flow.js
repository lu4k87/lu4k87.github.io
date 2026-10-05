/* Lesefluss-Motion der Projektseiten (docs/{project,present,operate,develop}_*.html) – Skill motion-viz, Styles in css/scroll_flow.css.
   ScrollFlow.init(cfg) baut die Seite beim Scrollen in Lesereihenfolge auf; cfg nennt je Effekt die Selektoren:
     hero     Einstieg, gestaffelt beim Laden          heroFig  Bild im Kopf dreht sich zum Leser
     heroExit Kopf legt sich beim Weiterlesen zurück    heads    Abschnittsköpfe: Eyebrow → Titel kippt auf → Text, Lichtstreif
     items    einzeln einblenden                        groups   Kinder kaskadieren aus der Tiefe (3D)
     cards    wie groups, aber die Elemente selbst (Listen, deren Container auch andere Kinder hat)
     depth    große Flächen, scroll-gebunden aus der Tiefe (CSS view(), sonst einmalig wie groups)
     seq      [{ box, items, step, reverse, x }] Aufbau Schritt für Schritt, sobald box sichtbar wird
     tilt     [{ sel, max, lift, layers }] Zeiger-Tilt mit Glanz (nur Maus), layers = Ebenen mit Parallaxe
     shine    Lichtstreif über Bildern                  count    Zahlen im Text zählen hoch
     rail     { sections, label } Leitlinie im linken Rand mit Knoten je Abschnitt
     progress Lesefortschritt: Selektor einer vorhandenen Linie oder { create: '<Kopfzeile>' }
     nav      { links, reset, hue } aktiver Abschnitt in der Navigation (aria-current); hue = Element im Abschnitt mit --hue
              → Leitlinie + Fortschritt gleiten in dessen Farbe (--sf-glow)
     relay    [{ box, items }] Lichtsaum läuft einmal über die Oberkanten benachbarter Karten (Kette), Karte trägt dabei .sf-lit
     spot     [{ box, items }] Rahmenlicht folgt dem Zeiger, Nachbarkarten im Umkreis leuchten anteilig mit (nur Maus)
     fill     Mini-Balken (Pips, Segmente): Kinder füllen sich nacheinander, synchron zum Hochzählen
     lines    Abschnittsgrenze: Linie zeichnet sich oben von der Mitte nach außen und verblasst
     box ohne items (String) = alle Kinder von box.
   Elemente, die im selben Moment sichtbar werden, staffeln sich in DOM-Reihenfolge (Schub). Einblenden einmal,
   danach nimmt das Skript seine Klassen weg (eigene Übergänge der Seite gelten wieder).
   prefers-reduced-motion: nur Fortschritt + aktiver Abschnitt, keine Bewegung. Ohne JS: alles sichtbar. */
(() => {
  'use strict';
  const STAGGER = 70, MAX_STAGGER = 8;
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fineHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const scrollTL = window.CSS && CSS.supports('animation-timeline: view()');
  const list = s => (Array.isArray(s) ? s : s ? [s] : []);
  const $$ = (s, el = document) => (s ? [...el.querySelectorAll(s)] : []);
  const docOrder = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  const positioned = el => { if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; };
  const span = (cls, parent) => { const s = document.createElement('span'); s.className = cls; s.setAttribute('aria-hidden', 'true'); parent.append(s); return s; };
  const onScroll = fn => { let raf = 0; const run = () => { raf = 0; fn(); }; const q = () => { if (!raf) raf = requestAnimationFrame(run); };
    addEventListener('scroll', q, { passive: true }); addEventListener('resize', q, { passive: true }); return q; };

  // ── Lesefortschritt: CSS scroll() wo möglich, sonst per Scroll-Ereignis ──
  function progress(p) {
    let bar = typeof p === 'string' ? document.querySelector(p) : null;
    if (p && p.create) { const top = document.querySelector(p.create); if (!top) return; positioned(top); bar = span('sf-progress', top); }
    if (!bar || CSS.supports('animation-timeline: scroll()')) return;
    onScroll(() => { const max = root.scrollHeight - innerHeight; bar.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max) : 0); })();
  }

  // ── aktiver Abschnitt in der Navigation (Lesefortschritt) ──
  function navSpy({ links, reset, hue }) {
    const map = new Map($$(links).map(a => [a.getAttribute('href').slice(1), a]).filter(([id]) => id && document.getElementById(id)));
    const tint = id => {
      const el = hue && id && document.getElementById(id).querySelector(hue);
      const c = el && getComputedStyle(el).getPropertyValue('--hue').trim();
      if (c) root.style.setProperty('--sf-glow', c); else root.style.removeProperty('--sf-glow');
    };
    const mark = id => { map.forEach((a, k) => a.setAttribute('aria-current', String(k === id))); tint(id); };
    const opt = { rootMargin: '-35% 0px -60% 0px' };
    const spy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) mark(e.target.id); }), opt);
    map.forEach((a, id) => spy.observe(document.getElementById(id)));
    const r = reset && document.querySelector(reset);
    if (r) new IntersectionObserver(([e]) => { if (e.isIntersecting) mark(''); }, opt).observe(r);
  }

  // ── Einblenden ──
  const marked = el => el.parentElement && el.parentElement.closest('.sf, .sf-depth');
  const cleanup = el => { el.classList.remove('sf', 'sf-3d', 'sf-x', 'sf-turn', 'sf-in', 'sf-h'); el.style.removeProperty('--sf-d'); delete el.dataset.sfD; };
  const show = (el, d) => {
    const at = (+el.dataset.sfD || 0) + d;
    el.style.setProperty('--sf-d', `${at}ms`);
    el.classList.add('sf-in');
    if (el.classList.contains('sf-h')) setTimeout(() => { el.querySelector(':scope > .sf-sweep')?.remove(); cleanup(el); }, at + 1800);
  };
  const io = !reduce && 'IntersectionObserver' in window && new IntersectionObserver(es => {
    es.filter(e => e.isIntersecting).map(e => e.target).sort(docOrder).forEach((el, i) => { io.unobserve(el); show(el, Math.min(i, MAX_STAGGER) * STAGGER); });
  }, { threshold: .1, rootMargin: '0px 0px -7% 0px' });
  const done = e => { const el = e.currentTarget; if (e.target !== el || e.propertyName !== 'opacity' || !el.classList.contains('sf-in')) return; el.removeEventListener('transitionend', done); cleanup(el); };
  function mark(el, variant, delay) {
    if (!io || marked(el) || el.matches('.sf, .sf-kick, .sf-title, .sf-text')) return false;
    el.classList.add('sf'); if (variant) el.classList.add(variant);
    if (delay) el.dataset.sfD = delay;
    el.addEventListener('transitionend', done);
    return true;
  }
  const reveal = (sel, variant) => list(sel).forEach(s => $$(s).forEach(el => { if (mark(el, variant)) io.observe(el); }));

  function heads(sel, parts) {
    $$(sel).forEach(h => {
      if (!io || marked(h)) return;
      h.classList.add('sf-h');
      $$(parts.kick, h).forEach(e => e.classList.add('sf-kick'));
      $$(parts.title, h).forEach(e => e.classList.add('sf-title'));
      $$(parts.text, h).forEach(e => { if (!e.closest('.sf-kick, .sf-title, .sf')) e.classList.add('sf-text'); });
      span('sf-sweep', h);
      io.observe(h);
    });
  }

  function seq(steps) {
    list(steps).forEach(({ box, items, step = 90, reverse = false, x = false, variant }) => $$(box).forEach(b => {
      const els = $$(items, b);
      if (reverse) els.reverse();
      const ok = els.filter((el, i) => mark(el, variant || (x ? 'sf-x' : ''), i * step));
      if (!ok.length) return;
      const o = new IntersectionObserver(([en]) => { if (!en.isIntersecting) return; o.disconnect(); ok.forEach(el => show(el, 0)); }, { threshold: .15, rootMargin: '0px 0px -7% 0px' });
      o.observe(b);
    }));
  }

  function depth(sel) {
    list(sel).forEach(s => $$(s).forEach(el => {
      if (!io || marked(el)) return;
      if (scrollTL) el.classList.add('sf-depth');
      else if (mark(el, 'sf-3d')) io.observe(el);
    }));
  }

  // ── Zeiger-Tilt mit Glanz: kippt höchstens max Grad zum Zeiger, Ebenen (layers) verschieben sich mit Parallaxe ──
  function tilt(defs) {
    if (reduce || !fineHover) return;
    list(defs).forEach(def => {
      const { sel, max = 4, lift = 0, layers = '' } = typeof def === 'string' ? { sel: def } : def;
      $$(sel).forEach(el => {
        positioned(el); el.classList.add('sf-tilt'); span('sf-glare', el);
        const lay = $$(layers, el);
        let raf = 0, x = 0, y = 0;
        const apply = () => {
          raf = 0;
          el.style.transform = `perspective(900px) translate3d(0, ${lift}px, 0) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
          lay.forEach((l, i) => { const k = 5 + i * 3; l.style.transform = `translate3d(${(x * k).toFixed(1)}px, ${(y * k).toFixed(1)}px, 0)`; });
        };
        el.addEventListener('pointermove', e => {
          if (e.pointerType !== 'mouse' || el.classList.contains('sf')) return;
          const r = el.getBoundingClientRect();
          x = (e.clientX - r.left) / r.width - .5; y = (e.clientY - r.top) / r.height - .5;
          el.style.setProperty('--sf-mx', `${(e.clientX - r.left).toFixed(0)}px`); el.style.setProperty('--sf-my', `${(e.clientY - r.top).toFixed(0)}px`);
          el.classList.add('sf-hover');
          if (!raf) raf = requestAnimationFrame(apply);
        });
        el.addEventListener('pointerleave', () => {
          cancelAnimationFrame(raf); raf = 0;
          el.classList.remove('sf-hover'); el.style.removeProperty('transform');
          lay.forEach(l => l.style.removeProperty('transform'));
        });
      });
    });
  }

  // ── Lichtstreif über Bildern, einmal beim ersten Sichtbarwerden ──
  function shine(sel) {
    if (reduce) return;
    const o = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return; o.unobserve(en.target);
      const s = en.target.querySelector(':scope > .sf-shine'); s.classList.add('go');
      s.addEventListener('animationend', () => s.remove(), { once: true });
    }), { threshold: .4 });
    list(sel).forEach(q => $$(q).forEach(el => { positioned(el); span('sf-shine', el); o.observe(el); }));
  }

  // ── Zahlen im Text zählen einmal hoch (Format bleibt: Dezimalkomma, Einheit), danach kurzes Aufleuchten ──
  function count(sel) {
    if (reduce) return;
    list(sel).forEach(q => $$(q).forEach(el => {
      const tn = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.data));
      const m = tn && tn.data.match(/(\d+)(?:([.,])(\d+))?/);
      if (!m) return;
      const end = parseFloat(`${m[1]}.${m[3] || 0}`), dec = m[3] ? m[3].length : 0, orig = tn.data;
      if (!end) return;
      const fmt = v => orig.replace(m[0], v.toFixed(dec).replace('.', m[2] || '.'));
      tn.data = fmt(0);
      const o = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return; o.disconnect();
        const t0 = performance.now(), dur = Math.min(900, 400 + end * 6);
        const step = t => {
          const k = Math.min(1, (t - t0) / dur);
          if (k < 1) { tn.data = fmt(end * (1 - (1 - k) ** 3)); requestAnimationFrame(step); return; }
          tn.data = orig; el.classList.add('sf-pop');
          el.addEventListener('animationend', () => el.classList.remove('sf-pop'), { once: true });
        };
        requestAnimationFrame(step);
      }, { threshold: .6 });
      o.observe(el);
    }));
  }

  // ── Leitlinie: roter Faden im linken Rand, füllt sich bis zur Leselinie (40 % Fensterhöhe) ──
  function rail({ sections, label }) {
    const secs = $$(sections);
    if (reduce || secs.length < 3) return;
    const el = document.createElement('div'); el.className = 'sf-rail'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="sf-rail-line"></span><span class="sf-rail-fill"></span><span class="sf-rail-head"></span>';
    const nodes = secs.map((s, i) => {
      const n = span('sf-rail-node', el), b = document.createElement('b');
      b.textContent = (label && s.querySelector(label)?.textContent.trim()) || String(i + 1).padStart(2, '0');
      n.append(b); return n;
    });
    document.body.append(el);
    let top = 0, h = 1, ys = [];
    const layout = () => {
      const r0 = secs[0].getBoundingClientRect(), last = secs[secs.length - 1].getBoundingClientRect();
      const wrap = secs[0].querySelector('.wrap') || secs[0].closest('.wrap') || secs[0];
      const left = wrap.getBoundingClientRect().left + parseFloat(getComputedStyle(wrap).paddingLeft);
      el.hidden = left < 72;
      top = r0.top + scrollY; h = Math.max(1, last.bottom - r0.top);
      ys = secs.map(s => s.getBoundingClientRect().top + scrollY - top);
      el.style.cssText = `left:${Math.round(left - 40)}px;top:${Math.round(top)}px;height:${Math.round(h)}px`;
      nodes.forEach((n, i) => { n.style.top = `${ys[i]}px`; });
    };
    let cur = -1;
    const update = () => {
      if (el.hidden) return;
      const y = Math.max(0, Math.min(h, scrollY + innerHeight * .4 - top));
      el.style.setProperty('--sf-p', (y / h).toFixed(4));
      el.style.setProperty('--sf-y', `${y.toFixed(1)}px`);
      let c = -1;
      nodes.forEach((n, i) => { const on = ys[i] <= y + 1; n.classList.toggle('on', on); if (on) c = i; });
      if (c !== cur) { nodes.forEach((n, i) => n.classList.toggle('cur', i === c)); cur = c; }
    };
    // Scrollen → nur update(); Größenänderung (Bilder geladen, Umbruch, Sprache) → erst layout()
    let raf = 0, full = false;
    const queue = all => { full = full || all; if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (full) layout(); full = false; update(); }); };
    addEventListener('scroll', () => queue(false), { passive: true });
    new ResizeObserver(() => queue(true)).observe(document.body);
    layout(); update();
  }

  // ── Kartenreihen: [{ box, items }] oder box (alle Kinder) → [Kartenliste je box] ──
  const rows = defs => list(defs).flatMap(d => {
    const { box, items } = typeof d === 'string' ? { box: d } : d;
    return $$(box).map(b => (items ? $$(items, b) : [...b.children])).filter(r => r.length > 1);
  });
  const once = (el, fn, opt) => { const o = new IntersectionObserver(([en]) => { if (en.isIntersecting) { o.disconnect(); fn(); } }, opt); o.observe(el); };

  // ── Lichtsaum läuft einmal von Karte zu Karte über die Oberkanten (Signal entlang der Kette) ──
  function relay(defs) {
    if (reduce) return;
    rows(defs).forEach(cards => {
      once(cards[0], () => cards.forEach((c, i) => {
        positioned(c);
        const s = span('sf-relay', c);
        s.style.setProperty('--sf-d', `${450 + i * 170}ms`);
        setTimeout(() => c.classList.add('sf-lit'), 450 + i * 170 + 250);
        setTimeout(() => c.classList.remove('sf-lit'), 450 + i * 170 + 900);
        s.addEventListener('animationend', () => s.remove(), { once: true });
      }), { threshold: .5 });
    });
  }

  // ── Rahmenlicht folgt dem Zeiger über die ganze Reihe: jede Karte zeichnet den Kegel relativ zu sich (Nachbarn glühen mit) ──
  function spot(defs) {
    if (reduce || !fineHover) return;
    rows(defs).forEach(cards => {
      const box = cards[0].parentElement === cards[1].parentElement ? cards[0].parentElement : cards[0].parentElement.parentElement;
      cards.forEach(c => { positioned(c); span('sf-spot', c); });
      let rects = [], raf = 0, x = 0, y = 0;
      const apply = () => { raf = 0; cards.forEach((c, i) => { c.style.setProperty('--sf-sx', `${(x - rects[i].left).toFixed(0)}px`); c.style.setProperty('--sf-sy', `${(y - rects[i].top).toFixed(0)}px`); }); };
      box.addEventListener('pointerenter', () => { rects = cards.map(c => c.getBoundingClientRect()); box.classList.add('sf-spot-on'); });
      box.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        if (!rects.length) rects = cards.map(c => c.getBoundingClientRect());
        x = e.clientX; y = e.clientY; if (!raf) raf = requestAnimationFrame(apply);
      });
      box.addEventListener('pointerleave', () => { box.classList.remove('sf-spot-on'); rects = []; });
      addEventListener('scroll', () => { rects = []; }, { passive: true });
    });
  }

  // ── Mini-Balken füllen sich nacheinander (Gesamtdauer ~ Hochzählen, ≤ 900 ms) ──
  function fill(sel) {
    if (reduce) return;
    list(sel).forEach(q => $$(q).forEach(bar => {
      const n = bar.children.length; if (!n) return;
      [...bar.children].forEach((c, i) => c.style.setProperty('--sf-i', i));
      bar.style.setProperty('--sf-step', `${Math.round(700 / n)}ms`);
      bar.classList.add('sf-fill');
      once(bar, () => { bar.classList.add('go'); setTimeout(() => bar.classList.remove('sf-fill', 'go'), 2400); }, { threshold: .6 });
    }));
  }

  // ── Abschnittsgrenze: Linie zeichnet sich von der Mitte nach außen und verblasst zur normalen Linie ──
  function lines(sel) {
    if (reduce) return;
    list(sel).forEach(q => $$(q).forEach(el => {
      positioned(el);
      const s = span('sf-line', el);
      once(el, () => { s.classList.add('go'); s.addEventListener('animationend', () => s.remove(), { once: true }); }, { rootMargin: '0px 0px -25% 0px' });
    }));
  }

  window.ScrollFlow = {
    init(cfg = {}) {
      if (cfg.progress) progress(cfg.progress);
      if (cfg.nav && 'IntersectionObserver' in window) navSpy(cfg.nav);
      if (!io) return;
      root.classList.add('sf-on');
      // Einstieg: sofort, gestaffelt; Bild dreht sich zum Leser
      const first = [];
      list(cfg.hero).forEach(s => $$(s).forEach((el, i) => { if (mark(el, '', 90 + Math.min(i, MAX_STAGGER) * 90)) first.push(el); }));
      list(cfg.heroFig).forEach(s => $$(s).forEach(el => { if (mark(el, 'sf-turn', 260)) first.push(el); }));
      requestAnimationFrame(() => requestAnimationFrame(() => first.forEach(el => show(el, 0))));
      if (scrollTL) list(cfg.heroExit).forEach(s => $$(s).forEach(el => el.classList.add('sf-exit')));
      if (cfg.heads) heads(cfg.heads, { kick: '.eyebrow, .kicker', title: 'h2', text: 'p, .lede', ...cfg.headParts });
      depth(cfg.depth);
      seq(cfg.seq);
      list(cfg.groups).forEach(s => $$(s).forEach(g => [...g.children].forEach(el => { if (mark(el, 'sf-3d')) io.observe(el); })));
      reveal(cfg.cards, 'sf-3d');
      reveal(cfg.items);
      tilt(cfg.tilt);
      shine(cfg.shine);
      count(cfg.count);
      if (cfg.rail) rail(cfg.rail);
      relay(cfg.relay);
      spot(cfg.spot);
      fill(cfg.fill);
      lines(cfg.lines);
    },
  };
})();
