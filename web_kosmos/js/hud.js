// Bedienoberfläche über der 3D-Szene: Stationsleiste (links: Zeitstrahl-Tabelle mit Suche oder Kacheln mit Kapitel-Spalte,
// beim Zeigen breit über der Bühne), Infotafel (rechts: Kennzahlen-Bento, Schalter der Station, Entdecken-Liste, Darstellung + Quellen),
// Abzeichen mit gewinkelten 45°-Leitlinien (Sechseck wie Biochar), Info-Karte, Messleiste (Bildbreite, Lichtlaufzeit,
// Entfernung, Blick zurück), Reiseroute, Kapitel-Titel beim Ankommen, Rand-Zug-Anzeige.

import { STATIONS, ROUTE, SOURCES, routeIndex } from './content.js';
import { fmtLength, fmtTime, C } from './astro.js';
import { settings, setSetting, mountSettings, onSettings } from './settings.js';
import { getLayer, setLayer, fmtVal } from './layers.js';
import { cardHtml, mountCard, unmountCard } from './cards.js';
import { prose } from './figs.js';
import { renderScaleCompare } from './scale_compare.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const HEX = 'M20 2L35.59 11L35.59 29L20 38L4.41 29L4.41 11z';
const hex = (inner = '', cls = '') => `<svg class="hex ${cls}" viewBox="0 0 40 40" aria-hidden="true"><path class="hex-shape" d="${HEX}"/>${inner}</svg>`;
// Stationsnummer: Route zweistellig (01–10), Abstecher Elternnummer + Buchstabe (02A), Monde + Ziffer (02C1)
const num = (id) => String(STATIONS[id].n).padStart(2, '0');
const hexNum = (n, cls) => hex(`<text x="20" y="24.5" text-anchor="middle">${String(n).padStart(2, '0')}</text>`, cls);

export function createHud(h) {
  const body = document.body;
  const rail = $('#rail'), panel = $('#panel-body'), layer = $('#hotspots'), svg = layer.querySelector('svg');
  const leads = svg.querySelector('.leads'), card = $('#hs-card'), caption = $('#caption'), route = $('#route');
  const pull = $('#pull'), btnOut = $('#btn-out'), btnNext = $('#btn-next'), btnPrev = $('#btn-prev');
  const mWidth = $('#m-width'), mLight = $('#m-light'), mDist = $('#m-dist'), mBack = $('#m-back');
  let lv = null, meta = null, markers = [], selected = null, liveEl = null, widgetEl = null, liveT = 0, scaleTabIdx = 0;
  // Info-Karte: Reihenfolge (gewähltes Abzeichen zuerst), Lage, Seite, Größe, Leitlinie
  let ordered = [], dock = null, settle = null, cardW = 0, cardH = 0, cardMaxH = null, lastT = 0;
  const cardLead = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  cardLead.setAttribute('class', 'hs-lead hs-lead--card is-off');
  new ResizeObserver(() => { cardW = card.offsetWidth; cardH = card.offsetHeight; }).observe(card);
  const cardEnv = { getLayer, setLayer, fmt: fmtVal, motion: () => settings.S.motion, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };

  mountSettings($('#cfg'), $('#btn-cfg'));
  onSettings((keys) => {
    if (keys.includes('panel')) { body.classList.toggle('panel-off', !settings.S.panel); h.onRelayout(); }
    if (keys.includes('motion')) card.dataset.motion = settings.S.motion;
    if (keys.includes('scaleCompare') && lv) renderPanel();
  });
  body.classList.toggle('panel-off', !settings.S.panel);
  $('#btn-panel').addEventListener('click', () => setSetting('panel', !settings.S.panel));

  // ---------- Stationsleiste ----------
  // Zwei Ansichten (Vorschau 26.10.2026 „Stationsleiste neu“), Schalter unten links: Zeitstrahl als Tabelle (Zeit:B) und
  // Kacheln mit Kapitel-Spalte (Kachel:B). Beide schmal und kompakt in der Leiste; Maus oder Fokus klappt sie über die Bühne
  // auf 464 bzw. 512 px aus (.rail.is-wide, Ebene über Zeitleiste und Kapitel-Titel). Touch ohne Maus bleibt schmal und wach,
  // unter 760 px bleibt vom Zeitstrahl nur die Punkte-Leiste (CSS).
  // Kapitel: Hub, Name, Zeile im Reiter
  const CHAPTERS = [['earth', 'Erdnähe', 'Erde, Mond und Raumstationen'], ['solar', 'Sonnensystem', 'Sonne, Planeten und Monde'],
    ['galaxy', 'Milchstraße', 'Nebel, Pulsar und Zentrum'], ['local', 'Universum', 'Galaxien bis zum Horizont']];
  const HUBS = CHAPTERS.map(([id]) => id);
  // Abstecher des Sonnensystems nach Abstand zur Sonne statt nach Nummer (Nummern bleiben)
  const SUN_ORDER = ['sun', 'mercury', 'venus', 'mars', 'asteroid', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  const rank = (id) => { const i = SUN_ORDER.indexOf(id); return i < 0 ? SUN_ORDER.length : i; };
  const byRank = (a, b) => rank(a) - rank(b) || num(a).localeCompare(num(b));
  const onRoute = new Set(ROUTE);
  const chapter = (id) => { for (let x = id; x; x = STATIONS[x].parent) if (HUBS.includes(x)) return x; return HUBS[HUBS.length - 1]; };
  const kidsOf = (id) => Object.keys(STATIONS).filter((k) => STATIONS[k].parent === id && !onRoute.has(k)).sort(byRank);
  const below = (id) => kidsOf(id).flatMap((k) => [k, ...below(k)]);
  const stopOf = (id) => { let x = id; while (x && STATIONS[x] && !onRoute.has(x)) x = STATIONS[x].parent; return STATIONS[x] ? x : null; };
  const chName = (id) => CHAPTERS.find(([hub]) => hub === chapter(id))[1];
  const members = (ch) => Object.keys(STATIONS).filter((k) => chapter(k) === ch);
  const title = (id) => esc(STATIONS[id].title);
  const width = (id) => esc(fmtLength(STATIONS[id].width));
  const label = (id) => `${title(id)} – Bildbreite ${width(id)}`;
  // Weg bis zur Elternstation, im Kapitel ab dessen Hub: „Sonnensystem › Jupiter & Monde“; Hubs nennen ihre Eltern
  const crumbs = (id) => {
    const a = [];
    for (let k = STATIONS[id].parent; k; k = STATIONS[k].parent) { a.unshift(title(k)); if (HUBS.includes(k)) break; }
    return a.join(' › ') || esc(chName(id));
  };
  const img = (file, w, hgt, lazy = true) => `<img src="img/thumbs/${file}.jpg" alt="" width="${w}" height="${hgt}"${lazy ? ' loading="lazy"' : ''} decoding="async">`;
  // Monde als Kugel (Oberflächenkarte), alle übrigen mit Standbild
  const isMoon = (id) => !onRoute.has(id) && !!STATIONS[id].parent && !onRoute.has(STATIONS[id].parent);
  const orb = (id, cls) => `<i class="${cls}" style="background-image:url(img/thumbs/${id}${isMoon(id) ? '-tex' : ''}.jpg)"></i>`;
  const VIEW_KEY = 'kosmos.railview.v1';
  const nav = rail.parentElement, tiles = $('#tiles'), viewBtns = nav.querySelectorAll('[data-view]');
  let railFly = null, flyOf = null, railCur = null, liveEls = [], tileLive = null;

  // ---------- Zeitstrahl als Tabelle (Zeit:B) ----------
  // Suchfeld (alle Stationen nach Titel, Art, Nummer; Taste /, Pfeiltasten + Enter fliegt hin), Hier-Karte (Bild, Weg,
  // Bildbreite live), Tabelle Kapitel | Nr. | Station | Bildbreite von oben (Universum) nach unten (Erdnähe). Die aktuelle
  // Station und ihr Weg stehen eingerückt mit └ unter ihrem Halt; „+n“ öffnet die Abstecher seitlich (.rl-fly).
  const railRows = new Map();
  let zbInput = null, zbFound = null, zbRes = null, zbHint = null, zbHere = null, zbHits = [], zbSel = 0;
  const zbRow = (id, d = -1) => {
    const n = d < 0 ? kidsOf(id).length : 0;
    return `<div class="zb-row${d < 0 ? '' : ' zb-sub'}" data-row="${id}"><button type="button" class="zb-go" data-go="${id}" aria-label="${label(id)}, Kapitel ${esc(chName(id))}"><i class="zb-st"></i><span class="n">${num(id)}</span><span class="zb-name">${d < 0 ? '' : `<span class="zb-tree" style="--d:${d}" aria-hidden="true">└</span>`}${title(id)}</span></button>${n
      ? `<button type="button" class="zb-more" aria-expanded="false" aria-controls="rl-fly" aria-label="${n} Abstecher von ${title(id)}">+${n}</button>` : '<span></span>'}<span class="w">${width(id)}</span></div>`;
  };
  // Treffer hervorheben, ohne die Eingabe als Suchmuster zu lesen
  const mark = (s, q) => { const i = s.toLowerCase().indexOf(q); return i < 0 ? esc(s) : `${esc(s.slice(0, i))}<mark>${esc(s.slice(i, i + q.length))}</mark>${esc(s.slice(i + q.length))}`; };
  function buildRail() {
    rail.innerHTML = `<label class="zb-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/></svg>
        <input type="search" role="combobox" placeholder="Station suchen" aria-label="Station suchen" aria-autocomplete="list" aria-controls="zb-res" aria-expanded="false" autocomplete="off" spellcheck="false"><kbd aria-hidden="true">/</kbd></label>
      <div class="zb-found" hidden><div class="zb-res" id="zb-res" role="listbox" aria-label="Treffer"></div><p class="zb-hint" aria-live="polite"></p></div>
      <section class="zb-here" aria-label="Aktuelle Station"></section>
      <div class="zb-tab"><div class="zb-th" aria-hidden="true"><span>Kapitel</span><span>Nr.</span><span>Station</span><span>Bildbreite</span></div>${[...CHAPTERS].reverse().map(([hub, name]) => {
        const ids = [...ROUTE].reverse().filter((id) => chapter(id) === hub);
        return `<section class="zb-grp" data-ch="${hub}" style="--n:${ids.length}" aria-label="${esc(name)}"><div class="zb-chn" aria-hidden="true"><i></i><span>${esc(name)}</span><small>${members(hub).length} Stationen</small></div>
          <div class="zb-rows">${ids.map((id) => `<div class="zb-stop" data-id="${id}">${zbRow(id)}<div class="zb-chain"></div></div>`).join('')}</div></section>`;
      }).join('')}</div><div class="rl-fly" id="rl-fly" role="group" hidden></div>`;
    zbInput = rail.querySelector('.zb-search input');
    [zbFound, zbRes, zbHint, zbHere] = ['.zb-found', '.zb-res', '.zb-hint', '.zb-here'].map((s) => rail.querySelector(s));
    // Liste am Seitenkörper: liegt so über Zeitleiste und Kapitel-Titel, die eigene Ebenen über der HUD haben
    railFly = rail.querySelector('.rl-fly');
    document.body.append(railFly);
    rail.querySelectorAll('.zb-stop').forEach((el) => railRows.set(el.dataset.id, el));
    const onClick = (e) => {
      const go = e.target.closest('[data-go]'), more = e.target.closest('.zb-more');
      if (more) { const id = more.closest('.zb-stop').dataset.id; if (flyOf === id) closeFly(true); else openFly(id); } else if (go) fly(go.dataset.go);
    };
    const onKey = (e) => { if (e.key === 'Escape' && flyOf) { e.stopPropagation(); closeFly(true); } };
    for (const el of [rail, railFly]) { el.addEventListener('click', onClick); el.addEventListener('keydown', onKey); }
    document.addEventListener('pointerdown', (e) => { if (flyOf && !rail.contains(e.target) && !railFly.contains(e.target)) closeFly(); });
    zbInput.addEventListener('input', () => { zbSel = 0; renderHits(); });
    zbInput.addEventListener('keydown', (e) => {
      const n = zbHits.length;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (zbInput.value) clearSearch(); else zbInput.blur(); } else if (!zbFound.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (n) { zbSel = (zbSel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; markHit(); }
      } else if (e.key === 'Enter' && n && !zbFound.hidden) { e.preventDefault(); fly(zbHits[zbSel]); zbInput.blur(); }
    });
    // Taste / sucht, solange der Zeitstrahl zu sehen ist
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, select, textarea, [contenteditable]')) return;
      if (nav.dataset.view !== 'line' || !zbInput.offsetParent) return;
      e.preventDefault();
      zbInput.focus();
    });
  }
  function fly(id) { closeFly(); clearSearch(); h.onInput(); h.onGo(id); }
  function renderHits() {
    const q = zbInput.value.trim().toLowerCase();
    zbFound.hidden = !q;
    rail.classList.toggle('is-search', !!q);
    zbInput.setAttribute('aria-expanded', String(!!q));
    zbHits = q ? Object.keys(STATIONS).filter((k) => `${STATIONS[k].title} ${STATIONS[k].kicker} ${num(k)}`.toLowerCase().includes(q)).sort(byRank) : [];
    zbRes.innerHTML = zbHits.map((k) => `<div role="option" class="zb-hit" id="zb-hit-${k}" data-go="${k}" aria-selected="false">${orb(k, 'zb-orb')}<span class="zb-hit-t"><span><b class="n">${num(k)}</b> ${mark(STATIONS[k].title, q)}</span><small>${crumbs(k)} · ${mark(STATIONS[k].kicker, q)}</small></span><span class="w">${width(k)}</span></div>`).join('');
    const all = Object.keys(STATIONS).length;
    zbHint.textContent = zbHits.length ? `${zbHits.length} Treffer aus ${all} Stationen · Pfeiltasten wählen · Enter fliegt hin` : `Keine Station gefunden · Esc leert die Suche`;
    markHit();
  }
  function markHit() {
    const on = zbHits.length ? zbRes.children[zbSel] : null;
    for (const el of zbRes.children) el.setAttribute('aria-selected', String(el === on));
    if (on) { zbInput.setAttribute('aria-activedescendant', on.id); on.scrollIntoView({ block: 'nearest' }); } else zbInput.removeAttribute('aria-activedescendant');
  }
  function clearSearch() {
    if (!zbInput.value) return;
    zbInput.value = '';
    renderHits();
  }
  // Abstecher-Liste seitlich am Halt: je Abstecher eine Zeile, Monde kompakt als Zeile darunter, aktuelle hervorgehoben
  const rowHtml = (id) => `<button type="button" class="rl-btn" data-go="${id}" aria-label="${label(id)}"><span class="rl-dot"></span><span class="rl-txt"><b>${num(id)}</b> ${title(id)}</span></button>`;
  function openFly(id) {
    closeFly();
    flyOf = id;
    railFly.innerHTML = `<p class="rl-fly-cap">Abstecher von ${title(id)}</p>${kidsOf(id).map((k) => {
      const m = below(k);
      return rowHtml(k) + (m.length ? `<p class="rl-moons">${m.map((x) => `<button type="button" data-go="${x}" aria-label="${label(x)}">${title(x)}</button>`).join('')}</p>` : '');
    }).join('')}`;
    railFly.querySelector(`[data-go="${railCur}"]`)?.classList.add('is-current');
    railFly.hidden = false;
    railRows.get(id).querySelector('.zb-more').setAttribute('aria-expanded', 'true');
    placeFly();
    railFly.querySelector('[data-go]')?.focus({ preventScroll: true });
  }
  function closeFly(refocus) {
    if (!flyOf) return;
    const more = railRows.get(flyOf).querySelector('.zb-more');
    more.setAttribute('aria-expanded', 'false');
    if (refocus) more.focus();
    flyOf = null;
    railFly.hidden = true;
    wake(false);
  }
  function placeFly() {
    const R = rail.getBoundingClientRect(), b = railRows.get(flyOf).querySelector('.zb-more').getBoundingClientRect(), fh = railFly.offsetHeight;
    railFly.style.left = `${R.right + 10}px`;
    railFly.style.top = `${Math.max(R.top, Math.min(R.bottom - fh, b.top + b.height / 2 - fh / 2))}px`;
  }

  // ---------- Kacheln mit Kapitel-Spalte (Kachel:B) ----------
  // Links die Kapitel als Reiter (Bild, Name, Zeile, Anzahl; Pfeil hoch/runter), rechts Hier-Karte, Hauptort („Halt x von 13“)
  // und Kacheln in 2 Spalten: Standbild (img/thumbs/<id>.jpg aus tools/thumbs.py), Nummer, Name, Bildbreite. Kachel = Station
  // des Kapitels, die am Hub hängt oder auf der Route liegt; alle übrigen (Monde) mit Kugel, Name und Bildbreite in der Kachel
  // ihres Planeten (schmal nur die Kugeln, Name beim Zeigen). Der Reiter folgt der Station.
  const isTile = (k) => !HUBS.includes(k) && (onRoute.has(k) || HUBS.includes(STATIONS[k].parent));
  const tileOf = (id) => { let x = id; while (x && !isTile(x) && !HUBS.includes(x)) x = STATIONS[x].parent; return x; };
  let kbTabs = null, kbCh = null, kbHere = null, kbTip = null;
  function buildTiles() {
    tiles.innerHTML = `<div class="kb-tabs" role="tablist" aria-orientation="vertical" aria-label="Kapitel">${CHAPTERS.map(([hub, name, desc]) => `<button type="button" role="tab" class="kb-tab" id="kb-tab-${hub}" data-ch="${hub}" aria-controls="kb-panel" aria-selected="false" tabindex="-1" aria-label="${esc(name)}, ${members(hub).length} Stationen">${img(hub, 112, 112, false)}<span class="kb-tab-t">${esc(name)}</span><span class="kb-tab-d">${esc(desc)}</span><span class="n">${members(hub).length} Stationen</span></button>`).join('')}</div>
      <div class="kb-panel" id="kb-panel" role="tabpanel"><section class="kb-here" aria-label="Aktuelle Station"></section><div class="kb-ch"></div></div>`;
    kbTabs = [...tiles.querySelectorAll('.kb-tab')];
    kbCh = tiles.querySelector('.kb-ch');
    kbHere = tiles.querySelector('.kb-here');
    kbTip = document.createElement('div');
    kbTip.className = 'kb-tip';
    kbTip.hidden = true;
    kbTip.setAttribute('aria-hidden', 'true');
    document.body.append(kbTip);
    tiles.addEventListener('click', (e) => {
      const tab = e.target.closest('.kb-tab'), go = e.target.closest('[data-go]');
      if (tab) { showChapter(tab.dataset.ch); h.onInput(); } else if (go) { kbTip.hidden = true; h.onInput(); h.onGo(go.dataset.go); }
    });
    // Reiter per Pfeiltaste (Muster tablist, senkrecht); stoppt die globalen Pfeiltasten (Station wechseln) nur hier
    tiles.querySelector('.kb-tabs').addEventListener('keydown', (e) => {
      const i = kbTabs.indexOf(e.target), n = kbTabs.length;
      const j = { ArrowDown: i + 1, ArrowUp: i - 1 + n, Home: 0, End: n - 1 }[e.key];
      if (i < 0 || j === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      kbTabs[j % n].focus();
      showChapter(kbTabs[j % n].dataset.ch);
    });
    // schmal: Name + Bildbreite eines Mondes beim Zeigen (Maus oder Fokus); breit stehen sie in der Kachel
    const tip = (e) => {
      const m = e.target.closest?.('.kb-moon');
      if (!m || e.type === 'pointerout' || e.type === 'focusout' || nav.classList.contains('is-wide')) { kbTip.hidden = true; return; }
      const id = m.dataset.go;
      kbTip.innerHTML = `<b>${num(id)}</b>${title(id)} · ${width(id)}`;
      kbTip.hidden = false;
      const b = m.getBoundingClientRect(), w = kbTip.offsetWidth;
      kbTip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, b.left + b.width / 2 - w / 2))}px`;
      kbTip.style.top = `${b.bottom + 6}px`;
    };
    for (const ev of ['pointerover', 'pointerout', 'focusin', 'focusout']) kbCh.addEventListener(ev, tip);
    kbCh.addEventListener('scroll', () => { kbTip.hidden = true; }, { passive: true, capture: true });
    nav.querySelector('.rail-view').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view, true); });
    let v = 'tiles';
    try { if (localStorage.getItem(VIEW_KEY) === 'line') v = 'line'; } catch { /* privater Modus */ }
    setView(v);
  }
  function setView(v, save) {
    nav.dataset.view = v;
    body.classList.toggle('rail-tiles', v === 'tiles');
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    kbTip.hidden = true;
    closeFly();
    if (!save) return;
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* privater Modus */ }
    h.onRelayout();
  }
  function showChapter(ch) {
    kbTabs.forEach((t) => { const on = t.dataset.ch === ch; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    tiles.querySelector('.kb-panel').setAttribute('aria-labelledby', `kb-tab-${ch}`);
    const all = members(ch), halt = ROUTE.indexOf(ch), at = halt < 0 ? '' : `Halt ${halt + 1} von ${ROUTE.length}`;
    kbCh.innerHTML = `<button type="button" class="kb-hub" data-go="${ch}" aria-label="${label(ch)}${at && `, ${at}`}"><span class="kb-hub-t"><b class="n">${num(ch)}</b> ${title(ch)}</span><span class="kb-hub-w"><span class="w">${width(ch)}</span>${at && ` · ${at}`}</span></button>
      <div class="kb-list"><ul class="kb-grid">${all.filter(isTile).sort(byRank).map((id) => {
        const moons = all.filter((k) => k !== ch && !isTile(k) && tileOf(k) === id).sort(byRank);
        return `<li class="kb-tile" data-id="${id}"><button type="button" class="kb-go" data-go="${id}" aria-label="${label(id)}"><span class="kb-im">${img(id, 160, 44)}<span class="kb-no">${num(id)}</span></span><span class="kb-name">${title(id)}</span><span class="w">${width(id)}</span></button>${moons.length
          ? `<ul class="kb-moons">${moons.map((k) => `<li><button type="button" class="kb-moon" data-go="${k}" aria-label="${label(k)}">${orb(k, 'kb-orb')}<span class="kb-moon-t">${title(k)}</span><span class="w">${width(k)}</span></button></li>`).join('')}</ul>` : ''}</li>`;
      }).join('')}</ul></div>`;
    markTiles();
  }
  // Aktuelle Station: Kachel (bei Monden die ihres Planeten) eisblau umrandet, Station als Pille, Bildbreite live
  function markTiles() {
    const cur = railCur, here = tileOf(cur);
    kbCh.querySelectorAll('[data-go]').forEach((b) => {
      const on = b.dataset.go === cur;
      b.classList.toggle('is-current', on);
      if (on) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    kbCh.querySelectorAll('.kb-tile').forEach((el) => el.classList.toggle('is-here', el.dataset.id === here));
    tileLive = kbCh.querySelector('[data-go].is-current .w');
    kbCh.querySelector('.kb-tile.is-here')?.scrollIntoView({ block: 'nearest' });
  }

  // Ruhe bis zur Maus (Vorschau 26.10.2026 Leiste:C) + schmal, beim Zeigen breit (Stationsleiste neu F1/F3): Maus oder Fokus
  // in der Leiste weckt sie und klappt sie über die Bühne aus, 1,2 s nach dem Verlassen wieder schmal und still; ohne Maus
  // (Touch) und unter 760 px immer wach und schmal
  const calm = matchMedia('(hover: hover) and (min-width: 761px)');
  let sleep = 0;
  function setAwake(on, wide) {
    nav.classList.toggle('is-awake', on);
    nav.classList.toggle('is-wide', wide);
    body.classList.toggle('rail-wide', wide);
    if (flyOf) placeFly();
  }
  function wake(on) {
    clearTimeout(sleep);
    if (on || !calm.matches) setAwake(true, on && calm.matches);
    else sleep = setTimeout(() => { if (!nav.matches(':hover, :focus-within') && !flyOf) setAwake(false, false); }, 1200);
  }
  nav.addEventListener('pointerenter', () => wake(true));
  nav.addEventListener('pointerleave', () => wake(false));
  nav.addEventListener('focusin', () => wake(true));
  nav.addEventListener('focusout', () => wake(false));
  calm.addEventListener('change', () => wake(false));
  wake(false);

  // ---------- Reiseroute ----------
  route.innerHTML = ROUTE.map((id, i) => `<li><button type="button" data-id="${id}" aria-label="Station ${i + 1}: ${esc(STATIONS[id].title)}"><span class="rt-dot"></span><span class="rt-name">${esc(STATIONS[id].title)}</span></button></li>`).join('');
  route.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { h.onInput(); h.onGo(b.dataset.id); }));

  btnOut.addEventListener('click', () => { h.onInput(); h.onOut(); });
  btnNext.addEventListener('click', () => { h.onInput(); h.onNext(1); });
  btnPrev.addEventListener('click', () => { h.onInput(); h.onNext(-1); });
  $('#btn-close-card').addEventListener('click', () => closeCard());

  // ---------- Station ----------
  function setStation(level) {
    lv = level;
    meta = level.meta;
    const id = level.id;
    railCur = id;
    closeFly();
    const stop = stopOf(id), chain = [];
    for (let x = id; x && x !== stop; x = STATIONS[x].parent) chain.unshift(x);
    railRows.forEach((el, k) => { el.querySelector('.zb-chain').innerHTML = k === stop ? chain.map((x, i) => zbRow(x, i)).join('') : ''; });
    const hot = new Set([stop, ...chain]);
    rail.querySelectorAll('.zb-row').forEach((r) => {
      const k = r.dataset.row, cur = k === id, go = r.querySelector('.zb-go');
      r.classList.toggle('is-hot', hot.has(k));
      r.classList.toggle('is-done', onRoute.has(k) && ROUTE.indexOf(k) < ROUTE.indexOf(stop));
      r.classList.toggle('is-current', cur);
      if (cur) go.setAttribute('aria-current', 'step'); else go.removeAttribute('aria-current');
      r.querySelector('.w').textContent = fmtLength(STATIONS[k].width);
    });
    // Hier-Karte in beiden Ansichten: Standbild, Weg, Nummer + Name, Art und Bildbreite (live)
    const here = (cls, w, hgt) => `${img(id, w, hgt, false)}<div class="${cls}-t"><p class="${cls}-path">${crumbs(id)}</p><h3><b class="n">${num(id)}</b> ${title(id)}</h3><p class="${cls}-kick">${esc(STATIONS[id].kicker)} · <span class="w">${width(id)}</span></p></div>`;
    zbHere.innerHTML = here('zb-here', 112, 72);
    kbHere.innerHTML = here('kb-here', 340, 96);
    const row = rail.querySelector('.zb-row.is-current');
    liveEls = [zbHere, kbHere, row].filter(Boolean).map((el) => el.querySelector('.w'));
    row?.scrollIntoView({ block: 'nearest' });
    lastW = 0;
    showChapter(chapter(id));
    route.querySelectorAll('button').forEach((b) => {
      const cur = b.dataset.id === id;
      b.classList.toggle('is-current', cur);
      if (cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    const parent = meta.parent && STATIONS[meta.parent];
    btnOut.disabled = !parent;
    $('#nav-out-to').textContent = parent ? parent.title : '–';
    const i = routeIndex(id);
    $('#nav-next-to').textContent = STATIONS[ROUTE[(i + 1) % ROUTE.length]].title;
    btnPrev.setAttribute('aria-label', `Zurück: ${STATIONS[ROUTE[(i - 1 + ROUTE.length) % ROUTE.length]].title}`);
    mDist.textContent = meta.dist ? fmtLength(meta.dist) : 'im Bild';
    mBack.textContent = meta.lookback ? fmtTime(meta.lookback) : 'Gegenwart';
    scaleTabIdx = 0;
    renderPanel();
    buildMarkers();
    closeCard();
  }

  // Schalter der Station: Segment (Standard; mit detail(wert) → HTML darunter, z. B. Ton), Schieberegler ('range'),
  // Farbscheiben mit Erklärung ('swatch': options [wert, name, CSS-Hintergrund], detail(wert)), Knopf ('action': button, run())
  function ctrlHtml(c) {
    if (c.type === 'range') return `
        <label class="cfg-row cfg-range"><span class="cfg-label">${esc(c.label)}</span>
          <input type="range" data-rng="${c.id}" min="${c.min}" max="${c.max}" step="${c.step ?? 1}" value="${c.value}" aria-label="${esc(c.label)}"><output data-rout="${c.id}">${esc(c.fmt ? c.fmt(c.value) : c.value)}</output></label>`;
    if (c.type === 'swatch') return `
        <div class="cfg-box"><span class="cfg-label" id="ctl-${c.id}">${esc(c.label)}</span>
          <div class="swatch" role="radiogroup" aria-labelledby="ctl-${c.id}">${c.options.map(([v, l, bg]) => `<button type="button" role="radio" data-sw="${c.id}" data-val="${v}" aria-checked="${String(c.value === v)}"><i class="sw-disc" style="background:${bg}" aria-hidden="true"></i><b>${esc(l)}</b></button>`).join('')}</div>
          <div class="sw-detail" data-swd="${c.id}">${c.detail(c.value)}</div></div>`;
    if (c.type === 'action') return `
        <div class="cfg-row"><span class="cfg-label">${esc(c.label)}</span><button type="button" class="act-btn" data-act="${c.id}">${esc(c.button)}</button></div>`;
    const seg = `<div class="seg" role="radiogroup" aria-labelledby="ctl-${c.id}">${c.options.map(([v, l]) => `<button type="button" role="radio" data-ctl="${c.id}" data-val="${v}" aria-checked="${String(c.value === v)}">${esc(l)}</button>`).join('')}</div>`;
    if (c.detail) return `
        <div class="cfg-box"><span class="cfg-label" id="ctl-${c.id}">${esc(c.label)}</span>
          ${seg}<div class="sw-detail" data-swd="${c.id}">${c.detail(c.value)}</div></div>`;
    return `
        <div class="cfg-row"><span class="cfg-label" id="ctl-${c.id}">${esc(c.label)}</span>
          ${seg}</div>`;
  }

  function renderPanel() {
    const st = meta;
    const info = (x) => st.hotspots[x.id] || x.info;
    const hs = lv.hotspots.filter((x) => info(x) && x.kind !== 'label' && (!x.listIf || x.listIf()));
    const ctrls = lv.controls || [];
    // Abstecher (Nummer mit Buchstabe, z. B. 02A) nennen ihre Elternstation
    const from = /^\d+$/.test(String(st.n)) || !st.parent ? '' : ` · Abstecher von ${STATIONS[st.parent].title}`;
    panel.innerHTML = `
      <p class="kicker"><span class="kick-n">${num(lv.id)}</span>${esc(st.kicker + from)}</p>
      <h1 class="st-title">${esc(st.title)}</h1>
      <p class="lead">${prose(st.lead)}</p>
      <div class="bento">${st.facts.map((f) => `
        <div class="fact"><p class="fact-v${f.v.length > 9 ? ' is-long' : ''}">${esc(f.v)}${f.u ? `<span class="fact-u">${esc(f.u)}</span>` : ''}</p><p class="fact-l">${prose(f.l)}</p></div>`).join('')}
      </div>
      ${settings.S.scaleCompare !== false ? renderScaleCompare(lv.id, scaleTabIdx) : ''}
      ${lv.live ? '<p class="live" id="live" aria-live="off"></p>' : ''}
      ${lv.widget ? `<div class="widget" id="widget">${lv.widget()}</div>` : ''}
      ${ctrls.length ? `<div class="st-ctrls">${ctrls.map(ctrlHtml).join('')}</div>` : ''}
      <h2 class="sec-h">Entdecken</h2>
      <ul class="explore">${hs.map((x, i) => `
        <li><button type="button" data-hs="${x.id}" class="${x.kind === 'dive' ? 'is-dive' : ''}">${x.kind === 'dive' ? hex('<path d="M14 17l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>', 'hex--mini') : hexNum(i + 1, 'hex--mini')}<span>${esc(info(x).t)}</span>${x.kind === 'dive' ? '<span class="tag">hineinfliegen</span>' : ''}</button></li>`).join('')}
      </ul>
      <details class="note"><summary>Darstellung und Quellen</summary>
        <p>${prose(st.note)}</p>
        <ol class="sources">${st.sources.map((s) => `<li><a href="${SOURCES[s].url}" target="_blank" rel="noopener">${esc(SOURCES[s].t)}</a><span>${esc(SOURCES[s].by)}</span></li>`).join('')}</ol>
      </details>`;
    liveEl = panel.querySelector('#live');
    widgetEl = panel.querySelector('#widget');
    panel.querySelectorAll('[data-sc-tab]').forEach((b) => b.addEventListener('click', () => {
      scaleTabIdx = +b.dataset.scTab;
      renderPanel();
      h.onInput();
    }));
    panel.querySelectorAll('[data-hs]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.hs)));
    panel.querySelectorAll('[data-rng]').forEach((i) => i.addEventListener('input', () => {
      const c = ctrls.find((x) => x.id === i.dataset.rng);
      c.value = +i.value;
      c.set(c.value);
      panel.querySelector(`[data-rout="${c.id}"]`).textContent = c.fmt ? c.fmt(c.value) : String(c.value);
      h.onInput();
    }));
    panel.querySelectorAll('[data-ctl]').forEach((b) => b.addEventListener('click', () => {
      const c = ctrls.find((x) => x.id === b.dataset.ctl);
      c.value = b.dataset.val;
      c.set(c.value);
      // Abzeichen mit listIf (z. B. je Körper) hängen am Schalter: Liste und Abzeichen neu aufbauen
      if (lv.hotspots.some((x) => x.listIf)) { renderPanel(); buildMarkers(); return; }
      panel.querySelectorAll(`[data-ctl="${c.id}"]`).forEach((o) => o.setAttribute('aria-checked', String(o.dataset.val === c.value)));
      if (c.detail) panel.querySelector(`[data-swd="${c.id}"]`).innerHTML = c.detail(c.value);
    }));
    panel.querySelectorAll('[data-sw]').forEach((b) => b.addEventListener('click', () => {
      const c = ctrls.find((x) => x.id === b.dataset.sw);
      c.value = b.dataset.val;
      c.set(c.value);
      panel.querySelectorAll(`[data-sw="${c.id}"]`).forEach((o) => o.setAttribute('aria-checked', String(o.dataset.val === c.value)));
      panel.querySelector(`[data-swd="${c.id}"]`).innerHTML = c.detail(c.value);
      h.onInput();
    }));
    panel.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => { ctrls.find((x) => x.id === b.dataset.act).run(); h.onInput(); }));
  }
  // Regler mit get() (z. B. Zeitraffer, auch im Zahnrad stellbar) folgen ihrem Zustand, außer während der Bedienung
  function syncCtrls() {
    for (const c of lv.controls || []) {
      if (c.type !== 'range' || !c.get) continue;
      const v = c.get(), i = panel.querySelector(`[data-rng="${c.id}"]`);
      if (v === c.value || !i || document.activeElement === i) continue;
      c.value = v;
      i.value = v;
      panel.querySelector(`[data-rout="${c.id}"]`).textContent = c.fmt ? c.fmt(v) : String(v);
    }
  }

  // ---------- Abzeichen ----------
  function buildMarkers() {
    markers.forEach((m) => { m.el.remove(); m.dot.remove(); });
    leads.innerHTML = '';
    leads.appendChild(cardLead);
    let num = 0;
    markers = lv.hotspots.filter((x) => (meta.hotspots[x.id] || x.info) && (!x.listIf || x.listIf())).map((x) => {
      const t = (meta.hotspots[x.id] || x.info).t;
      const label = x.kind === 'label';
      const dot = document.createElement('span');
      dot.className = `hs-dot${x.kind === 'dive' ? ' hs-dot--dive' : ''}${label ? ' hs-dot--label' : ''}`;
      const el = document.createElement('button');
      el.type = 'button';
      if (label) {
        el.className = `hsl${x.cls ? ` ${x.cls}` : ''}`;
        el.innerHTML = `<span>${esc(t)}</span>`;
        el.setAttribute('aria-label', `${t} – Info`);
      } else {
        num++;
        el.className = `hsb ${x.kind === 'dive' ? 'hsb--dive' : 'hsb--info'}`;
        el.innerHTML = `${x.kind === 'dive' ? hex('<path d="M14 17l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>', 'hex--hs') : hexNum(num, 'hex--hs')}<span class="hsb-label">${esc(t)}${x.kind === 'dive' ? '<span class="tag">hineinfliegen</span>' : ''}</span>`;
        el.setAttribute('aria-label', x.kind === 'dive' ? `${t} – hineinfliegen` : `${t} – Info`);
      }
      el.addEventListener('click', () => pick(x.id));
      layer.append(dot, el);
      const path = label ? null : document.createElementNS('http://www.w3.org/2000/svg', 'path');
      if (path) { path.setAttribute('class', `hs-lead${x.kind === 'dive' ? ' hs-lead--dive' : ''}`); leads.appendChild(path); }
      return { x, el, dot, path, w: 0, hgt: 0, side: null, reach: 0, label };
    });
    // Neuaufbau bei offener Karte (Schalter mit listIf): gewähltes Abzeichen bleibt markiert und zuerst platziert
    ordered = selected ? [...markers].sort((a, b) => (b.x.id === selected) - (a.x.id === selected)) : markers;
    markers.forEach((m) => m.el.classList.toggle('is-active', m.x.id === selected));
  }

  function pick(id) {
    h.onInput();
    const x = lv.hotspots.find((k) => k.id === id);
    if (!x) return;
    if (x.kind === 'dive') { closeCard(); h.onDive(x); return; }
    if (x.focus) h.onFocus(x);
    selected = id;
    ordered = [...markers].sort((a, b) => (b.x.id === id) - (a.x.id === id));
    const t = meta.hotspots[id] || x.info;
    card.querySelector('.hs-card-title').innerHTML = `${hex('', 'hex--mini')}<span>${esc(t.t)}</span>`;
    const head = card.querySelector('.hs-card-head');
    while (head.nextSibling) head.nextSibling.remove();
    head.insertAdjacentHTML('afterend', cardHtml(lv.id, id, t, cardEnv));
    mountCard(card, lv.id, id, cardEnv);
    cardW = card.offsetWidth; cardH = card.offsetHeight;
    dock = null; settle = null;
    // unsichtbar öffnen, im nächsten Bild am Abzeichen einblenden (update → placeCard)
    card.classList.remove('is-open');
    void card.offsetWidth;
    card.classList.add('is-open', 'is-away');
    markers.forEach((m) => m.el.classList.toggle('is-active', m.x.id === id));
    panel.querySelectorAll('[data-hs]').forEach((b) => b.classList.toggle('is-active', b.dataset.hs === id));
  }
  function closeCard() {
    selected = null;
    ordered = markers;
    unmountCard();
    card.classList.remove('is-open', 'is-away');
    cardLead.classList.add('is-off');
    dock = null; settle = null;
    markers.forEach((m) => m.el.classList.remove('is-active'));
    panel.querySelectorAll('[data-hs].is-active').forEach((b) => b.classList.remove('is-active'));
  }

  // Lage je Bild: Punkt am Objekt, Abzeichen schräg daneben (45°-Knick), frei von Karte, Kapitel-Titel, Rändern und
  // anderen Abzeichen; einmal gefundene Lage (Seite + Reichweite) bleibt, solange sie frei ist – kein Springen.
  // Offene Karte: zuerst das gewählte Abzeichen, dann die Karte daneben, dann alle übrigen (weichen der Karte aus).
  const OFFS = [[1, -1], [-1, -1], [1, 1], [-1, 1]];
  const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  function update(camera, level, time) {
    const dt = Math.min(0.1, Math.max(0, time - lastT));
    lastT = time;
    if (!markers.length || layer.classList.contains('is-hidden')) { tickLive(time); return; }
    const W = window.innerWidth, H = window.innerHeight;
    const r = stageRect();
    const open = card.classList.contains('is-open'), sheet = open && W <= 760;
    const boxes = [];
    if (caption.classList.contains('is-on')) {
      for (const el of caption.children) {
        const b = el.getBoundingClientRect();
        if (b.width) boxes.push({ l: b.left - 6, r: b.right + 6, t: b.top - 4, b: b.bottom + 4 });
      }
    }
    if (sheet) boxes.push(placeSheet(r));
    const cx = (r.x0 + r.x1) / 2;
    const place = (m) => {
      const p = m.x.pos.clone().project(camera);
      const ax = (p.x + 1) / 2 * W, ay = (1 - p.y) / 2 * H;
      const vis = p.z < 1 && ax > r.x0 + 4 && ax < r.x1 - 4 && ay > r.y0 + 4 && ay < r.y1 - 4 && (!m.x.visible || m.x.visible(camera));
      if (!vis) { hide(m); return null; }
      if (!m.w) { m.w = m.el.offsetWidth; m.hgt = m.el.offsetHeight; }
      m.dot.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
      m.dot.classList.remove('is-off');
      if (m.label) {
        const bx = ax + 10, by = ay - m.hgt / 2;
        const box = { l: bx, r: bx + m.w, t: by, b: by + m.hgt };
        if (box.r > r.x1 || boxes.some((b) => hit(box, b))) { m.el.classList.add('is-off'); return null; }
        boxes.push(box);
        m.el.classList.remove('is-off');
        m.el.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px)`;
        return box;
      }
      const prefer = ax < cx ? [-1, -1] : [1, -1];
      const cands = m.side ? [[...m.side, m.reach]] : [];
      for (const [sx, sy] of [prefer, ...OFFS]) for (const reach of [52, 96]) cands.push([sx, sy, reach]);
      let placed = null;
      for (const [sx, sy, reach] of cands) {
        const bx = ax + sx * (reach + (sx > 0 ? 0 : m.w)), by = ay + sy * reach * 0.8 - m.hgt / 2;
        const box = { l: bx - 4, r: bx + m.w + 4, t: by - 4, b: by + m.hgt + 4 };
        if (box.l < r.x0 || box.r > r.x1 || box.t < r.y0 || box.b > r.y1 || boxes.some((b) => hit(box, b))) continue;
        placed = { bx, by, box, side: [sx, sy], reach };
        break;
      }
      if (!placed) { hide(m, true); return null; }
      m.side = placed.side;
      m.reach = placed.reach;
      boxes.push(placed.box);
      m.el.classList.remove('is-off');
      m.el.style.transform = `translate(${placed.bx.toFixed(1)}px, ${placed.by.toFixed(1)}px)`;
      // Leitlinie: vom Punkt 45° schräg, dann waagrecht an die Kante des Abzeichens
      const ex = placed.side[0] > 0 ? placed.bx : placed.bx + m.w, ey = placed.by + m.hgt / 2;
      const dy = ey - ay, kx = ax + Math.sign(ex - ax) * Math.min(Math.abs(dy), Math.abs(ex - ax) * 0.7);
      m.path.setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)}L${kx.toFixed(1)} ${ey.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`);
      m.path.classList.remove('is-off');
      return placed.box;
    };
    let found = false;
    for (const m of open ? ordered : markers) {
      const box = place(m);
      if (open && !sheet && m.x.id === selected) { found = true; placeCard(box, r, boxes, dt); }
    }
    if (open && !sheet && !found) placeCard(null);   // Abzeichen per Schalter ausgeblendet: Karte wartet unsichtbar
    tickLive(time);
  }

  // Karte am Abzeichen (Vorschau Lage:A): links daneben, sonst darüber, darunter, rechts – erste freie Seite in der Bühne,
  // frei von Kapitel-Titel, Zeitleiste und Zahnrad. Ruhig (Wunsch User 26.10.2026): erscheint erst, wenn das Abzeichen
  // still steht (Folgen-Flug fertig), dockt einmal an und bleibt stehen – nur die Leitlinie folgt dem Abzeichen. Neu
  // andocken (weich gleitend) nur, wenn das Abzeichen unter der Karte zur Ruhe kommt; wandert es weiter (Zeitraffer)
  // oder hinter den Planeten, bleibt die Karte stehen. Ohne sichtbares Abzeichen (Rückseite) dockt sie an einem
  // freien Platz in einer Ecke der Bühne.
  const SIDES = ['left', 'above', 'below', 'right'];
  const ORIGIN = { left: 'right center', right: 'left center', above: 'center bottom', below: 'center top' };
  const SETTLE = 0.3, WAIT_MAX = 2.4, WAIT_HIDDEN = 0.6, STILL_PX = 40;   // s, s, s, px/s
  function placeCard(b, r, boxes, dt) {
    if (!settle) settle = { age: 0, still: 0, prev: null };
    settle.age += dt;
    const M = 8, G = 14, by = b ? (b.t + b.b) / 2 : 0, bx = b ? (b.l + b.r) / 2 : 0;
    if (b) {
      const v = settle.prev ? Math.hypot(bx - settle.prev[0], by - settle.prev[1]) / Math.max(dt, 1e-3) : Infinity;
      settle.prev = [bx, by];
      settle.still = v < STILL_PX ? settle.still + dt : 0;
    } else { settle.prev = null; settle.still = 0; }
    const rested = settle.still >= SETTLE;
    if (!dock && !(b ? rested || settle.age >= WAIT_MAX : settle.age >= WAIT_HIDDEN)) return;
    // Unterkante = Zeitleiste (falls sichtbar); passt die Karte nicht in die Höhe, wird sie niedriger und scrollt
    const tl = $('#timeline'), tq = tl && !tl.hidden ? tl.getBoundingClientRect() : null;
    const yMax = (tq && tq.height ? Math.min(r.y1, tq.top) : r.y1) - M, maxH = Math.floor(yMax - r.y0 - M);
    if (maxH !== cardMaxH) { cardMaxH = maxH; card.style.maxHeight = `${maxH}px`; }
    const w = cardW, hh = Math.min(cardH, maxH);
    const obst = [...boxes], cfg = $('#cfg');
    if (cfg && !cfg.hidden) { const q = cfg.getBoundingClientRect(); if (q.width) obst.push({ l: q.left - M, r: q.right + M, t: q.top - M, b: q.bottom + M }); }
    const cX = (x) => Math.min(r.x1 - M - w, Math.max(r.x0 + M, x)), cY = (y) => Math.min(yMax - hh, Math.max(r.y0 + M, y));
    const clear = ([x, y], list) => !list.some((o) => hit({ l: x, r: x + w, t: y, b: y + hh }, o));
    const inStage = ([x, y]) => x >= r.x0 + M - 0.5 && x + w <= r.x1 - M + 0.5 && y >= r.y0 + M - 0.5 && y + hh <= yMax + 0.5;
    // Lage behalten; neu andocken nur, wenn das Abzeichen unter der Karte zur Ruhe kommt
    const keep = dock && [cX(dock.goal[0]), cY(dock.goal[1])];
    if (!dock || (b && rested && !clear(keep, obst))) {
      let side = 'left', pos;
      if (b) {
        const at = (s) => (s === 'left' ? [b.l - G - w, cY(by - hh / 2)] : s === 'right' ? [b.r + G, cY(by - hh / 2)]
          : s === 'above' ? [cX(b.l), b.t - G - hh] : [cX(b.l), b.b + G]);
        const order = [dock && dock.side, ...SIDES].filter((s, i, a) => s && a.indexOf(s) === i);
        side = order.find((s) => inStage(at(s)) && clear(at(s), obst));
        pos = side && at(side);
        if (!side) {   // nirgends ganz frei: in die Bühne schieben – das gewählte Abzeichen bleibt immer frei
          const into = (s) => { const [x, y] = at(s); return [cX(x), cY(y)]; };
          side = order.find((s) => clear(into(s), [b])) || order[0];
          pos = into(side);
        }
      } else {   // Abzeichen nicht im Bild: freier Platz in einer Ecke der Bühne
        const spots = [[r.x0 + M + 16, r.y0 + M + 16], [r.x0 + M + 16, yMax - hh - 16], [r.x1 - M - w - 16, r.y0 + M + 16]].map(([x, y]) => [cX(x), cY(y)]);
        pos = spots.find((p) => clear(p, obst)) || spots[0];
      }
      if (!dock) dock = { pos, goal: pos, side, box: null };
      else Object.assign(dock, { goal: pos, side });
    } else dock.goal = keep;
    const [gx, gy] = dock.goal;
    if (Math.hypot(gx - dock.pos[0], gy - dock.pos[1]) > 0.5) {   // neu andocken: weich hinübergleiten
      const k = 1 - Math.exp(-dt * 6);
      dock.pos = [dock.pos[0] + (gx - dock.pos[0]) * k, dock.pos[1] + (gy - dock.pos[1]) * k];
    } else dock.pos = dock.goal;
    const [px, py] = dock.pos;
    card.style.translate = `${(px - r.x0).toFixed(1)}px ${(py - r.y0).toFixed(1)}px`;
    card.style.transformOrigin = ORIGIN[dock.side];
    card.classList.remove('is-away');
    const c = { l: px, r: px + w, t: py, b: py + hh };
    dock.box = { l: c.l - 8, r: c.r + 8, t: c.t - 8, b: c.b + 8 };
    boxes.push(dock.box);
    if (!b) { cardLead.classList.add('is-off'); return; }
    // Leitlinie in Akzentfarbe vom Abzeichen zum nächsten Punkt der Karte (Abzeichen kann nach dem Andocken wandern)
    const cl = (v, a, z) => Math.min(z, Math.max(a, v)), f = (v) => v.toFixed(1);
    const ex = cl(bx, c.l, c.r), ey = cl(by, c.t, c.b), sx = cl(ex, b.l + 4, b.r - 4), sy = cl(ey, b.t + 4, b.b - 4);
    if (Math.hypot(ex - sx, ey - sy) < 6) { cardLead.classList.add('is-off'); return; }
    cardLead.setAttribute('d', `M${f(sx)} ${f(sy)}L${f(ex)} ${f(ey)}`);
    cardLead.classList.remove('is-off');
  }
  // Schmal (Handy, Vorschau F2): Karte als Leiste unten in der Bühne über der Zeitleiste, Abzeichen weichen ihr aus
  function placeSheet(r) {
    const tl = $('#timeline'), q = tl && !tl.hidden ? tl.getBoundingClientRect() : null;
    card.style.setProperty('--sheet-b', `${Math.round(q && q.height ? r.y1 - q.top + 8 : 8)}px`);
    if (cardMaxH !== null) { cardMaxH = null; card.style.maxHeight = ''; }   // Höhe regelt hier das CSS
    card.classList.remove('is-away');
    cardLead.classList.add('is-off');
    const b = card.getBoundingClientRect();
    return { l: b.left - 6, r: b.right + 6, t: b.top - 6, b: b.bottom + 6 };
  }
  function hide(m, keepDot = false) {
    m.el.classList.add('is-off');
    if (m.path) m.path.classList.add('is-off');
    if (!keepDot) m.dot.classList.add('is-off');
  }
  function tickLive(time) {
    syncCtrls();
    if (widgetEl && lv.widgetTick) lv.widgetTick(widgetEl, time);
    if (!liveEl || !lv.live || time - liveT < 0.5) return;
    liveT = time;
    liveEl.textContent = lv.live();
  }

  // ---------- Messleiste ----------
  let lastW = 0;
  function setScale(widthM) {
    if (Math.abs(widthM - lastW) / (lastW || 1) < 0.002) return;
    lastW = widthM;
    mWidth.textContent = fmtLength(widthM);
    mLight.textContent = fmtTime(widthM / C);
    for (const el of liveEls) el.textContent = fmtLength(widthM);
    if (tileLive) tileLive.textContent = fmtLength(widthM);
  }

  // ---------- Flug, Kapitel-Titel, Auftakt ----------
  let capTimer = 0;
  // Titel und Zeile darunter einzeilig: Schrift nach der Breite der Bühne verkleinern, gemessen in der breitesten
  // Sperrung vor dem Einblenden; Zeile darunter nie unter 12 px, dann Umbruch nur an den Trennern ·
  function fitCaption() {
    const cs = getComputedStyle(caption);
    const avail = (caption.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 0.98;
    for (const [sel, min] of [['.cap-title', 0], ['.cap-sub', 12]]) {
      const el = caption.querySelector(sel);
      el.style.fontSize = '';
      el.classList.remove('is-wrap');
      if (el.scrollWidth <= avail) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize) * avail / el.scrollWidth;
      el.style.fontSize = `${Math.max(min, fs)}px`;
      el.classList.toggle('is-wrap', fs < min);
    }
  }

  function showCaption(st, opening = false) {
    caption.querySelector('.cap-n').textContent = opening ? 'Kosmos' : String(st.n).padStart(2, '0');
    caption.querySelector('.cap-title').textContent = opening ? 'Reise durch das All' : st.title;
    const parts = opening
      ? ['Von der Erde bis an den Rand des beobachtbaren Universums']
      : [st.kicker, `Bildbreite ${fmtLength(st.width)}`, ...(st.dist ? [`${fmtLength(st.dist)} entfernt`] : [])];
    caption.querySelector('.cap-sub').replaceChildren(...parts.flatMap((t, i) => {
      const seg = document.createElement('span');
      seg.textContent = t;
      return i ? [' · ', seg] : [seg];
    }));
    caption.classList.remove('is-on');
    fitCaption();
    caption.classList.add('is-on');
    clearTimeout(capTimer);
    capTimer = setTimeout(() => {
      caption.classList.remove('is-on');
      if (opening) setTimeout(() => showCaption(st), 1800);
    }, opening ? 6200 : 6000);
  }

  function setFlight(on, st, multi) {
    body.classList.toggle('is-flying', on);
    // Abflug: Titel der alten Station blendet mit der Infotafel aus, der neue kommt kurz vor der Ankunft
    if (on) { pull.classList.remove('is-on'); caption.classList.remove('is-on'); clearTimeout(capTimer); }
    if (on && st) $('#flight-to').textContent = multi ? `Kurs auf ${st.title} …` : `Flug: ${st.title}`;
  }

  function setPull(v, dir) {
    const on = v > 0.04 && lv;
    pull.classList.toggle('is-on', !!on);
    if (!on) return;
    pull.style.setProperty('--p', Math.min(1, v).toFixed(3));
    const tgt = dir > 0 ? STATIONS[meta.parent] : null;
    pull.querySelector('span').textContent = dir > 0 ? `Weiter scrollen: hinaus – ${tgt ? tgt.title : ''}` : 'Weiter scrollen: hineinfliegen';
  }

  function stageRect() {
    const s = $('#stage-area').getBoundingClientRect();
    return { x0: s.left, x1: s.right, y0: s.top, y1: s.bottom };
  }

  buildRail();
  buildTiles();
  return {
    setStation, update, setScale, setPull, stageRect, setFlight,
    caption: (st, opening) => showCaption(st, opening),
    hideMarkers: (on) => { layer.classList.toggle('is-hidden', on); if (on) closeCard(); },
    setLoading: (on) => body.classList.toggle('is-loading', on),
    setRouteTarget: (id) => route.querySelectorAll('button').forEach((b) => b.classList.toggle('is-target', b.dataset.id === id)),
    intro: (on) => body.classList.toggle('is-intro', on),
    // offene Karte: main.js hält die Leerlauf-Fahrt an, damit das Bild beim Lesen ruht
    reading: () => card.classList.contains('is-open'),
    relayout: () => { if (flyOf) placeFly(); markers.forEach((m) => { m.w = 0; }); dock = null; },
  };
}
