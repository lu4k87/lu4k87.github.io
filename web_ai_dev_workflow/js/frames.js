/* Frames (N98, Form Wf:C): Bühne folgt der Scroll-Position wie eine HyperFrames-Szene an seek(t).
   Aktiver Frame = letzter Frame, dessen Oberkante die Leselinie passiert hat; t = Fortschritt im Frame (0–1)
   blendet Zeilen der Szene, Konsole und Nachrichten des Frames nacheinander ein. Ohne JS zeigt die Bühne Frame 01.
   Dazu: Begriffe antippen (Erklärung aus dem Glossar des Frames, in den Textfluss), Zähler, Selbsttest.
   prefers-reduced-motion: Zustände wechseln ohne Bewegung, alle Zeilen sofort sichtbar. */
(() => {
  const fx = document.getElementById('frames');
  if (!fx) return;
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = matchMedia('(max-width: 960px)');
  const T = (de, en) => (root.lang === 'en' ? en : de);
  const $$ = (sel, el = fx) => [...el.querySelectorAll(sel)];

  const frames = $$('.fr');
  const stage = fx.querySelector('.st');
  const msgs = $$('.st-msg');
  const layers = $$('.st-scene, .st-con');
  const beats = $$('.st-beats li');
  const fno = fx.querySelector('.st-fno b');
  const count = fx.querySelector('.st-count');
  const meter = fx.querySelector('.st-meter');
  const gloss = [...document.querySelectorAll('.gl-i')];
  const total = new Set(gloss.map(g => g.dataset.t)).size;
  const seen = new Set();
  let cur = 0, prog = -1;

  const showCount = () => {
    count.textContent = `${seen.size} / ${total}`;
    meter.style.setProperty('--p', `${Math.round((seen.size / total) * 100)}%`);
  };
  // Elemente der Liste erscheinen nacheinander bis 70 % des Frames
  const reveal = (els, t) => els.forEach((e, i) => e.classList.toggle('is-wait', t < (i / els.length) * 0.7));

  const show = (n, t) => {
    if (n !== cur) {
      cur = n;
      msgs.forEach(m => { const f = +m.dataset.f; m.classList.toggle('is-future', f > n); m.classList.toggle('is-cur', f === n); });
      layers.forEach(l => l.classList.toggle('is-on', +l.dataset.f === n));
      beats.forEach(b => { const f = +b.dataset.f; b.classList.toggle('is-done', f < n); b.classList.toggle('is-cur', f === n); });
      frames.forEach(f => f.classList.toggle('is-cur', +f.dataset.f === n));
      fno.textContent = String(n).padStart(2, '0');
      gloss.forEach(g => { if (+g.dataset.f <= n) seen.add(g.dataset.t); });
      showCount();
      prog = -1;
    }
    const q = reduce ? 1 : Math.round(t * 50) / 50;
    if (q === prog) return;
    prog = q;
    reveal(msgs.filter(m => +m.dataset.f === n), q);
    layers.filter(l => +l.dataset.f === n).forEach(l => reveal($$('.st-row, .st-cl', l), q));
  };

  // Leselinie: Desktop 45 % der Fensterhöhe; schmal knapp unter der Bühne
  const measure = () => {
    const line = narrow.matches ? stage.getBoundingClientRect().bottom + 40 : innerHeight * 0.45;
    let n = 1, t = 0;
    for (const f of frames) {
      const r = f.getBoundingClientRect();
      if (r.top > line) break;
      n = +f.dataset.f;
      t = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height)));
    }
    show(n, t);
  };
  let raf = 0;
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; measure(); }); };
  fx.classList.add('is-live');
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  measure();

  // Begriffe antippen: Erklärung aus dem Glossar (einzige Quelle) unter den Absatz, mit Verweis auf den Frame der Erklärung
  const openDef = btn => {
    const fr = btn.closest('.fr');
    const box = fr.querySelector('.fr-def');
    const g = document.querySelector(`.gl-i[data-t="${btn.dataset.t}"]`);
    if (!g) return;
    const same = !box.hidden && box.dataset.t === btn.dataset.t;
    fr.querySelectorAll('.term[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (same) { box.hidden = true; box.dataset.t = ''; return; }
    const at = +g.dataset.f;
    const link = at !== +fr.dataset.f ? ` <a href="#f${String(at).padStart(2, '0')}">${T('→ erklärt in Frame', '→ explained in frame')} ${String(at).padStart(2, '0')}</a>` : '';
    box.innerHTML = `<span><b>${g.querySelector('dt').innerHTML}</b> – ${g.querySelector('dd').innerHTML}${link}</span>`;
    box.dataset.t = btn.dataset.t;
    box.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    if (at === +fr.dataset.f) { g.classList.add('is-flash'); setTimeout(() => g.classList.remove('is-flash'), 900); }
    seen.add(btn.dataset.t);
    showCount();
  };
  const paintTerms = () => $$('.term').forEach(b => {
    const box = b.closest('.fr').querySelector('.fr-def');
    b.setAttribute('aria-controls', box.id);
    b.setAttribute('aria-expanded', String(!box.hidden && box.dataset.t === b.dataset.t));
    b.title = T('Begriff erklären', 'Explain term');
  });
  fx.addEventListener('click', e => { const b = e.target.closest('.term'); if (b) openDef(b); });

  // Selbsttest: Wahl markieren, richtige Antwort immer zeigen, Erklärung einblenden
  const quiz = document.getElementById('selbsttest');
  const score = quiz?.querySelector('.qz-score');
  const paintQuiz = () => {
    if (!quiz) return;
    let done = 0, ok = 0;
    quiz.querySelectorAll('.qz').forEach(q => {
      const pick = q.querySelector('.qz-o.is-pick');
      const res = q.querySelector('.qz-res');
      if (!pick) return;
      done++;
      const right = pick.dataset.ok === '1';
      if (right) ok++;
      res.textContent = right ? T('Richtig.', 'Correct.') : T('Nicht ganz.', 'Not quite.');
    });
    score.textContent = done ? T(`${ok} von ${done} richtig${done === 3 ? (ok === 3 ? ' – du kennst die Leitplanken.' : ' – lies die Erklärungen oben noch einmal.') : ''}`,
      `${ok} of ${done} correct${done === 3 ? (ok === 3 ? ' – you know the guard rails.' : ' – read the explanations again.') : ''}`) : '';
  };
  quiz?.addEventListener('click', e => {
    const o = e.target.closest('.qz-o');
    if (!o) return;
    const q = o.closest('.qz');
    q.querySelectorAll('.qz-o').forEach(b => {
      b.classList.toggle('is-pick', b === o);
      b.classList.toggle('is-ok', b.dataset.ok === '1');
      b.classList.toggle('is-bad', b === o && b.dataset.ok !== '1');
      b.setAttribute('aria-pressed', String(b === o));
    });
    q.querySelector('.qz-why').hidden = false;
    paintQuiz();
  });

  // Sprache: die Seite tauscht [data-en] per innerHTML → Begriffe, offene Erklärungen, Zähler neu
  new MutationObserver(() => {
    $$('.fr-def').forEach(box => {
      if (box.hidden || !box.dataset.t) return;
      const b = box.closest('.fr').querySelector(`.term[data-t="${box.dataset.t}"]`);
      box.hidden = true;
      if (b) openDef(b);
    });
    paintTerms();
    paintQuiz();
  }).observe(root, { attributes: true, attributeFilter: ['lang'] });
  paintTerms();
})();
