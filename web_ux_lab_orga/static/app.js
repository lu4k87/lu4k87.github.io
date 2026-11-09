// UX Lab Orga – kleine Helfer ohne Abhängigkeiten: Strg+K → Suche · Link kopieren · Phasen-Tafel ziehen.
const EN = document.documentElement.lang === 'en';  // Sprache wie der Server (app/i18n.py)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    const q = document.getElementById('q');
    if (q) { e.preventDefault(); q.focus(); q.select(); }
  }
});

document.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
  const el = document.getElementById(btn.dataset.copy);
  const out = document.getElementById(btn.dataset.copy + '-st');
  try {
    await navigator.clipboard.writeText(el.textContent.trim());
    out.textContent = EN ? 'Link copied.' : 'Link kopiert.';
  } catch {
    // ohne HTTPS gibt es keine Zwischenablage-API → Link markieren
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    out.textContent = EN ? 'Link selected – copy with Ctrl+C.' : 'Link markiert – mit Strg+C kopieren.';
  }
}));

const phaseForm = document.getElementById('phaseform');
if (phaseForm) {
  let dragId = null;
  document.querySelectorAll('.kc[draggable=true]').forEach((card) => {
    card.addEventListener('dragstart', (e) => { dragId = card.dataset.id; e.dataTransfer.effectAllowed = 'move'; });
    card.addEventListener('dragend', () => { dragId = null; });
  });
  document.querySelectorAll('.kb .col').forEach((col) => {
    col.addEventListener('dragover', (e) => { if (dragId) { e.preventDefault(); col.classList.add('over'); } });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('over');
      if (!dragId) return;
      phaseForm.action = phaseForm.dataset.base.replace('__ID__', dragId);
      phaseForm.elements.phase.value = col.dataset.phase;
      phaseForm.submit();
    });
  });
}

// Kopf-Infos (templates/_kopf.html): Uhr im Minutentakt · Fenster am Knopf ausrichten · Reiter Zeit/Netz (Kopf:B).
(() => {
  // gleiche Namen wie app/i18n.py (EN aus Pythons calendar): DE „Mo, 9. Nov.“ · EN „Mon, 9 Nov“
  const WD = EN ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const WDL = EN ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    : ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MS = EN ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
  const ML = EN ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
    'November', 'December'] : ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September',
    'Oktober', 'November', 'Dezember'];
  const day = (d, names) => (EN ? `${d.getDate()} ${names[d.getMonth()]}` : `${d.getDate()}. ${names[d.getMonth()]}`);
  const two = (n) => String(n).padStart(2, '0');
  const isoWeek = (d) => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  };
  const fmt = {
    time: (d) => `${two(d.getHours())}:${two(d.getMinutes())}`,
    date: (d) => `${WD[d.getDay()]}, ${day(d, MS)}`,
    long: (d) => `${WDL[d.getDay()]}, ${day(d, ML)}`,
    kw: (d) => String(isoWeek(d)),
  };
  const clocks = document.querySelectorAll('[data-clock]');
  const tick = () => {
    const d = new Date();
    clocks.forEach((el) => { el.textContent = fmt[el.dataset.clock](d); });
    setTimeout(tick, 60050 - (d.getSeconds() * 1000 + d.getMilliseconds()));
  };
  if (clocks.length) tick();

  // Fenster unter den Knopf legen, nie über den Rand; Scrollen/Größe ändern schließt es (Lage stimmt dann nicht mehr)
  const pops = document.querySelectorAll('.hi-pop[popover]');
  pops.forEach((pop) => pop.addEventListener('beforetoggle', (e) => {
    const btn = document.querySelector(`[popovertarget="${pop.id}"]`);
    if (e.newState !== 'open' || !btn) return;
    const r = btn.getBoundingClientRect();
    const w = Math.min(parseFloat(getComputedStyle(pop).width) || 340, innerWidth - 16);
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.min(Math.max(8, r.right - w), innerWidth - 8 - w)}px`;
    pop.style.top = `${r.bottom + 8}px`;
    pop.style.maxHeight = `${Math.max(160, innerHeight - r.bottom - 16)}px`;
  }));
  const closeAll = (e) => {
    if (e.target instanceof Element && e.target.closest('.hi-pop')) return;
    pops.forEach((p) => { if (p.matches(':popover-open')) p.hidePopover(); });
  };
  if (pops.length) {
    addEventListener('scroll', closeAll, { passive: true, capture: true });
    addEventListener('resize', closeAll);
  }

  document.querySelectorAll('[data-hi-tabs]').forEach((box) => {
    const tabs = [...box.querySelectorAll('[role=tab]')];
    const show = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
      try { localStorage.setItem('hi-tab', tab.id); } catch { /* ohne Speicher wird der Reiter nur nicht gemerkt */ }
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(t));
      t.addEventListener('keydown', (e) => {
        const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (to !== undefined) { e.preventDefault(); show(tabs[(to + tabs.length) % tabs.length], true); }
      });
    });
    let saved = null;
    try { saved = localStorage.getItem('hi-tab'); } catch { /* s. o. */ }
    const pick = tabs.find((t) => t.id === saved);
    if (pick) show(pick);
  });
})();
