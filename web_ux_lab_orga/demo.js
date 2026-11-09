// Klick-Demo (statisch, GitHub Pages; tools/export_demo.py): Formulare ohne Wirkung,
// Ansicht A/B/C und Farbschema werden nur in diesem Browser gemerkt. Läuft im <head> vor app.js.
(() => {
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ohne Speicher gilt die Wahl nur bis zum nächsten Klick */ } },
  };
  const root = document.documentElement;
  const applyTheme = (t) => { if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme; };
  applyTheme(store.get('demo-theme'));

  // team.html / team.team-B.html → team · Variante = eigene Datei je Bereich
  const baseOf = (file) => (file || 'index.html').replace(/(\.\w+-[A-Z])?\.html$/, '');
  const variantFile = (file, area, v) => `${baseOf(file)}.${area}-${v}.html`;
  let say = () => {};

  // app.js schickt die Phasen-Tafel per form.submit() (ohne submit-Ereignis) → hier abfangen
  HTMLFormElement.prototype.submit = function demoSubmit() { say('Demo: Verschieben speichert nichts.'); };

  const markSeg = (form, value) => form.querySelectorAll('button[name=variant]').forEach((b) => {
    const on = b.value === value;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });

  document.addEventListener('DOMContentLoaded', () => {
    const msg = document.querySelector('.demo-msg');
    say = (text) => { if (msg) msg.textContent = text; };

    document.querySelectorAll('a[data-demo-area]').forEach((a) => {
      const v = store.get(`demo-view-${a.dataset.demoArea}`);
      if (!v) return;
      const [file, frag] = a.getAttribute('href').split('#');
      a.setAttribute('href', variantFile(file, a.dataset.demoArea, v) + (frag ? `#${frag}` : ''));
    });
    document.querySelectorAll('a[data-demo-off]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      say('Diese Seite gibt es nur in der echten App.');
    }));
    const themeForm = document.querySelector('input[name=area][value=theme]')?.form;
    if (themeForm) markSeg(themeForm, store.get('demo-theme') || 'system');

    document.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = e.submitter;
      const area = form.querySelector('input[name=area]')?.value;
      if (area && btn?.name === 'variant') {
        if (area === 'theme') {
          store.set('demo-theme', btn.value);
          applyTheme(btn.value);
          markSeg(form, btn.value);
          say('Farbschema gewechselt (nur in diesem Browser).');
          return;
        }
        store.set(`demo-view-${area}`, btn.value);
        location.href = variantFile(location.pathname.split('/').pop(), area, btn.value);
        return;
      }
      const what = (btn?.textContent || '').trim();
      say(`Demo: ${what ? `„${what}“ ` : ''}speichert nichts – alle Daten sind erfunden.`);
    }, true);
  });
})();
