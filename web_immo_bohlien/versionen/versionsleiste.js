/* Versionsleiste: oberste Zeile im Header jeder Seite, verlinkt alle Entwürfe.
   Eingebunden per <script src="…/versionen/versionsleiste.js" defer>; Links relativ zu dieser Datei. */
(() => {
  const here = document.currentScript.src;
  const versions = [
    ['../index.html', 'Modell'],
    ['1-atelier.html', 'Atelier'],
    ['2-uebersicht.html', 'Übersicht'],
    ['3-kartografie.html', 'Kartografie'],
    ['5-expose.html', 'Exposé'],
    ['0-drei-looks.html', 'Drei Looks'],
    ['index.html', 'Alle Entwürfe'],
  ];
  const header = document.querySelector('header');
  if (!header) return;

  const css = document.createElement('style');
  css.textContent = `
    .vbar-host { flex-direction: column; row-gap: 2px; }
    .vbar-row { display: flex; align-self: stretch; align-items: inherit; justify-content: inherit; column-gap: inherit; pointer-events: none; }
    .vbar-row > * { pointer-events: auto; }
    .vbar { align-self: stretch; display: flex; align-items: center; gap: 2px; margin: -6px 0 0;
      font: 500 .84rem/1.2 Jost, "Helvetica Neue", Arial, sans-serif; letter-spacing: 0; text-transform: none;
      overflow-x: auto; scrollbar-width: thin; white-space: nowrap; pointer-events: auto; }
    .vbar b { font-weight: 500; padding-right: 6px; opacity: .8; }
    header nav.vbar a:not(.btn) { display: inline-block; color: inherit; text-decoration: none; padding: 8px 10px; border-radius: 4px; }
    .vbar a:hover { text-decoration: underline; text-underline-offset: 5px; text-decoration-thickness: 1px; }
    .vbar a[aria-current] { font-weight: 600; text-decoration: underline; text-underline-offset: 5px; text-decoration-thickness: 2px; }
  `;
  document.head.append(css);

  const nav = document.createElement('nav');
  nav.className = 'vbar';
  nav.setAttribute('aria-label', 'Entwürfe der Seite');
  nav.innerHTML = '<b>Entwurf:</b>';
  const page = new URL(location.pathname, location.href).href.replace(/\/$/, '/index.html');
  for (const [file, label] of versions) {
    const a = document.createElement('a');
    a.href = new URL(file, here).href;
    a.textContent = label;
    if (a.href === page) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  // Flex-Header (Logo | Menü in einer Zeile): bisherige Zeile bleibt unverändert, Leiste kommt als eigene Zeile darüber
  const isFlex = el => el && getComputedStyle(el).display.includes('flex');
  const host = isFlex(header) || !isFlex(header.firstElementChild) ? header : header.firstElementChild;
  if (isFlex(host)) {
    const row = document.createElement('div');
    row.className = 'vbar-row';
    row.append(...host.childNodes);
    host.classList.add('vbar-host');
    host.append(row);
  }
  host.prepend(nav);
  // für Seiten, die Platz unter einem festen Header reservieren (calc(… + var(--vbar-h)))
  document.documentElement.style.setProperty('--vbar-h', nav.offsetHeight + 'px');
})();
