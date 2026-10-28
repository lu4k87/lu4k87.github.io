// Bedienoberfläche über der 3D-Szene: Stationsleiste (Band oben über die volle Breite: Route, darunter beim Zeigen
// Abstecher → Monde; Suche in der Kopfzeile), Infotafel (rechts: Kennzahlen-Bento, Schalter der Station, Entdecken-Liste, Darstellung + Quellen),
// Abzeichen mit gewinkelten 45°-Leitlinien (Sechseck wie Biochar), Info-Karte, Messleiste (echtes Maß, Lichtlaufzeit,
// Entfernung, Blick zurück), Reiseroute, Kapitel-Titel beim Ankommen, Rand-Zug-Anzeige.

import { STATIONS, ROUTE, SOURCES, routeIndex } from './content.js';
import { fmtLength, fmtTime, C } from './astro.js';
import { settings, setSetting, mountSettings, onSettings } from './settings.js';
import { getLayer, setLayer, fmtVal, paintRange } from './layers.js';
import { cardHtml, mountCard, unmountCard } from './cards.js';
import { prose, nbsp } from './figs.js';
import { renderScaleCompare } from './scale_compare.js';
import { mountQuick } from './quick.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const HEX = 'M20 2L35.59 11L35.59 29L20 38L4.41 29L4.41 11z';
const hex = (inner = '', cls = '') => `<svg class="hex ${cls}" viewBox="0 0 40 40" aria-hidden="true"><path class="hex-shape" d="${HEX}"/>${inner}</svg>`;
// Stationsnummer: Route zweistellig (01–10), Abstecher Elternnummer + Buchstabe (02A), Monde + Ziffer (02C1)
const num = (id) => String(STATIONS[id].n).padStart(2, '0');
// ?dbg: Lage der Abzeichen für tests/overlap.py freigeben (window.__ovl, je Bild neu)
const DBG = new URLSearchParams(location.search).has('dbg');
const hexNum = (n, cls) => hex(`<text x="20" y="24.5" text-anchor="middle">${String(n).padStart(2, '0')}</text>`, cls);

export function createHud(h) {
  const body = document.body;
  const rail = $('#rail'), panel = $('#panel-body'), foot = $('#panel-foot'), layer = $('#hotspots'), svg = layer.querySelector('svg');
  const leads = svg.querySelector('.leads'), card = $('#hs-card'), caption = $('#caption'), route = $('#route');
  const pull = $('#pull'), btnOut = $('#btn-out'), btnNext = $('#btn-next'), btnPrev = $('#btn-prev');
  const mSizeL = $('#m-size-l'), mSize = $('#m-size'), mLight = $('#m-light'), mDist = $('#m-dist'), mBack = $('#m-back');
  let lv = null, meta = null, markers = [], selected = null, liveEl = null, widgetEl = null, liveT = 0, scaleTabIdx = 0;
  // Info-Karte: Reihenfolge (gewähltes Abzeichen zuerst), Lage, Seite, Größe, Leitlinie
  let ordered = [], dock = null, settle = null, cardW = 0, cardH = 0, cardMaxH = null, lastT = 0;
  const cardLead = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  cardLead.setAttribute('class', 'hs-lead hs-lead--card is-off');
  // Karte höher als ihr Platz: unten weich ausblenden statt mitten in der Zeile abschneiden (Fehler „Karte schneidet Text ab“),
  // weiterlesen per Scrollen; ganz unten verschwindet die Blende
  const moreCard = () => card.classList.toggle('is-more', card.scrollTop + card.clientHeight < card.scrollHeight - 2);
  card.addEventListener('scroll', moreCard, { passive: true });
  new ResizeObserver(() => { cardW = card.offsetWidth; cardH = card.offsetHeight; moreCard(); }).observe(card);
  const cardEnv = { getLayer, setLayer, fmt: fmtVal, motion: () => settings.S.motion, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };

  const side = mountSettings($('#cfg'), $('#btn-cfg'));
  onSettings((keys) => {
    if (keys.includes('panel')) { body.classList.toggle('panel-off', !settings.S.panel); h.onRelayout(); }
    if (keys.includes('motion')) card.dataset.motion = settings.S.motion;
    if (keys.includes('scaleCompare') && lv) renderPanel();
  });
  body.classList.toggle('panel-off', !settings.S.panel);
  // Knopf „Infotafel“ (Fenster:C): steht ein Fenster in der Spalte, holt er die Tafel zurück, sonst blendet er sie ein/aus
  $('#btn-panel').addEventListener('click', () => {
    if (side.view()) { side.open(false); if (!settings.S.panel) setSetting('panel', true); } else setSetting('panel', !settings.S.panel);
  });
  const syncPanelBtn = () => $('#btn-panel').setAttribute('aria-expanded', String(!!settings.S.panel && !side.view()));
  onSettings(syncPanelBtn);
  syncPanelBtn();
  addEventListener('kosmos:info', () => { if (!settings.S.panel) setSetting('panel', true); });
  // Fenster auf/zu: bei ausgeblendeter Infotafel entsteht bzw. verschwindet die Spalte → Szene neu einpassen
  addEventListener('kosmos:side', () => { syncPanelBtn(); if (!settings.S.panel) h.onRelayout(); });

  // ---------- Stationsleiste ----------
  // Band oben über die volle Breite (Vorschau 26.10.2026 „Stationsleiste oben“ Leiste:C, Baum-Panorama): Zeilen Route →
  // Abstecher → Monde, links die Namen der Ebenen, Linien in Kapitelfarbe, Erdnähe links. In Ruhe nur die Route; Abstecher
  // und Monde zeigt die Schublade darunter beim Zeigen (Maus, Fokus) oder solange ihr Parent ausgewählt ist (aktuelle Station
  // oder auf ihrem Weg). Unter 760 px (oder zu eng für die Namen) nur die Route als Punkte mit Kapitel-Streifen.
  // Kapitel: Hub, Name, Beschreibung (Name der Gruppe für Screenreader)
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
  const stopOf = (id) => { let x = id; while (x && STATIONS[x] && !onRoute.has(x)) x = STATIONS[x].parent; return STATIONS[x] ? x : null; };
  const chName = (id) => CHAPTERS.find(([hub]) => hub === chapter(id))[1];
  const title = (id) => esc(STATIONS[id].title);
  // echtes Maß des Hauptobjekts: „Durchmesser 12.742 km“
  const size = (id) => { const z = STATIONS[id].size; return z ? esc(`${z.l} ${fmtLength(z.v)}`) : ''; };
  // Entfernung zur Erde: Maß, sonst „hier“ (Erde) bzw. „Erde liegt darin“ (Hülle der Erde, ohne Urknall als Wurzel)
  const away = (id) => {
    const st = STATIONS[id];
    if (st.dist) return `${fmtLength(st.dist)} von der Erde`;
    if (id === 'earth') return 'hier';
    for (let x = STATIONS.earth.parent; x; x = STATIONS[x].parent) if (x === id && st.parent) return 'Erde liegt darin';
    return '';
  };
  const label = (id) => `${title(id)} – ${size(id)}`;
  // Weg bis zur Elternstation, im Kapitel ab dessen Hub: „Sonnensystem › Jupiter & Monde“; Hubs nennen ihre Eltern
  const crumbs = (id) => {
    const a = [];
    for (let k = STATIONS[id].parent; k; k = STATIONS[k].parent) { a.unshift(title(k)); if (HUBS.includes(k)) break; }
    return a.join(' › ') || esc(chName(id));
  };
  // Monde als Kugel (Oberflächenkarte), alle übrigen mit Standbild
  const isMoon = (id) => !onRoute.has(id) && !!STATIONS[id].parent && !onRoute.has(STATIONS[id].parent);
  const orb = (id, cls) => `<i class="${cls}" style="background-image:url(img/thumbs/${id}${isMoon(id) ? '-tex' : ''}.jpg)"></i>`;
  const nav = rail.parentElement, find = $('#find');
  let railCur = null;

  // ---------- Suche in der Kopfzeile ----------
  // Alle Stationen nach Titel, Art, Nummer; Taste /, Pfeiltasten + Enter fliegt hin, Esc leert; Treffer als Liste unter dem Feld
  let zbInput = null, zbFound = null, zbRes = null, zbHint = null, zbHits = [], zbSel = 0;
  // Treffer hervorheben, ohne die Eingabe als Suchmuster zu lesen
  const mark = (s, q) => { const i = s.toLowerCase().indexOf(q); return i < 0 ? esc(s) : `${esc(s.slice(0, i))}<mark>${esc(s.slice(i, i + q.length))}</mark>${esc(s.slice(i + q.length))}`; };
  function buildSearch() {
    find.innerHTML = `<label class="zb-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/></svg>
        <input type="search" role="combobox" placeholder="Station suchen" aria-label="Station suchen" aria-autocomplete="list" aria-controls="zb-res" aria-expanded="false" autocomplete="off" spellcheck="false"><kbd aria-hidden="true">/</kbd></label>
      <div class="zb-found" hidden><div class="zb-res" id="zb-res" role="listbox" aria-label="Treffer"></div><p class="zb-hint" aria-live="polite"></p></div>`;
    zbInput = find.querySelector('input');
    [zbFound, zbRes, zbHint] = ['.zb-found', '.zb-res', '.zb-hint'].map((s) => find.querySelector(s));
    // Klick in die Liste behält den Fokus im Feld, sonst schließt sie vor dem Klick
    zbFound.addEventListener('pointerdown', (e) => e.preventDefault());
    zbFound.addEventListener('click', (e) => { const go = e.target.closest('[data-go]'); if (go) { fly(go.dataset.go); zbInput.blur(); } });
    zbInput.addEventListener('input', () => { zbSel = 0; renderHits(); });
    zbInput.addEventListener('focus', () => { if (zbInput.value) renderHits(); });
    zbInput.addEventListener('blur', () => { zbFound.hidden = true; zbInput.setAttribute('aria-expanded', 'false'); });
    zbInput.addEventListener('keydown', (e) => {
      const n = zbHits.length;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (zbInput.value) clearSearch(); else zbInput.blur(); } else if (!zbFound.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (n) { zbSel = (zbSel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; markHit(); }
      } else if (e.key === 'Enter' && n && !zbFound.hidden) { e.preventDefault(); fly(zbHits[zbSel]); zbInput.blur(); }
    });
    // Taste / sucht, solange das Feld zu sehen ist (unter 760 px ausgeblendet)
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, select, textarea, [contenteditable]')) return;
      if (!zbInput.offsetParent) return;
      e.preventDefault();
      zbInput.focus();
    });
  }
  function fly(id) { hideTip(); clearSearch(); h.onInput(); h.onGo(id); }
  function renderHits() {
    const q = zbInput.value.trim().toLowerCase();
    zbFound.hidden = !q;
    zbInput.setAttribute('aria-expanded', String(!!q));
    zbHits = q ? Object.keys(STATIONS).filter((k) => `${STATIONS[k].title} ${STATIONS[k].kicker} ${num(k)}`.toLowerCase().includes(q)).sort(byRank) : [];
    zbRes.innerHTML = zbHits.map((k) => `<div role="option" class="zb-hit" id="zb-hit-${k}" data-go="${k}" aria-selected="false">${orb(k, 'zb-orb')}<span class="zb-hit-t"><span><b class="n">${num(k)}</b> ${mark(STATIONS[k].title, q)}</span><small>${crumbs(k)} · ${mark(STATIONS[k].kicker, q)}</small></span><span class="w">${esc(fmtLength(STATIONS[k].size.v))}</span></div>`).join('');
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

  // ---------- Band: Route (Ruhe) und Schublade mit Abstechern → Monden ----------
  // Lage aus der gemessenen Wortbreite (höchstens zwei Zeilen je Name, Kapitel nur als Linienfarbe), sonst
  // kleiner; passt auch das nicht (oder unter 760 px), zeigt das Band die Route als Punkte mit Kapitel-Streifen (.is-dots).
  // Feste Höhe in Ruhe, damit die Bühne beim Zeigen nicht springt; die Schublade liegt über der Bühne.
  const NS = 'http://www.w3.org/2000/svg', PAD = 10, GAP = 0;
  const BAND_H = 70, DOTS_H = 40, ROUTE_Y = 24, BUS_Y = 12, KID_Y = 42, MOONS_Y = 108, BRK_Y = 103;
  // Stufen: Schrift, Luft je Name, Spalte links (0 = keine)
  const SIZES = [[13, 16, 0], [12, 10, 0], [12, 8, 0]];
  const wide = matchMedia('(min-width: 761px)'), still = matchMedia('(prefers-reduced-motion: reduce)');
  const ctx2d = document.createElement('canvas').getContext('2d');
  const textW = (s, font) => { ctx2d.font = font; return ctx2d.measureText(s).width; };
  const need = (id, px, pad) => {
    const font = `600 ${px}px "IBM Plex Sans", system-ui, sans-serif`, t = STATIONS[id].title;
    // Messlineal (Route:C): Namen bis 16 Zeichen einzeilig, längere („Beobachtbares Universum“) zweizeilig
    return Math.max(24, ...t.split(/[\s-]+/).map((s) => textW(s, font)), textW(t, font) / (t.length > 16 ? 2 : 1)) + pad;
  };
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const node = (id, cls = '', style = '') => `<button type="button" class="bd-node${cls}"${style && ` style="${style}"`} data-go="${id}" data-ch="${chapter(id)}" aria-label="${label(id)}, Kapitel ${esc(chName(id))}"><span class="bd-dot"></span><span class="n">${num(id)}</span><span class="bd-nm">${title(id)}</span></button>`;
  const groups = () => CHAPTERS.map(([hub]) => [hub, ROUTE.filter((r) => chapter(r) === hub)]).filter(([, rs]) => rs.length);
  let cv = null, wires = null, drawer = null, dcv = null, dwires = null, tip = null;
  let pos = {}, fit = null, bandH = 0, hovId = null, shown = ['', ''], sleep = 0, comet = null;

  function buildRail() {
    rail.innerHTML = `<div class="bd-cv"><svg class="bd-wires" aria-hidden="true"></svg>${groups().map(([hub, rs], i) => {
        const [, name, desc] = CHAPTERS.find(([c]) => c === hub);
        return `<div class="bd-grp" role="group" data-ch="${hub}" style="--i:${i}" aria-label="${esc(name)}: ${esc(desc)}">${rs.map((id) => node(id)).join('')}</div>`;
      }).join('')}</div>`;
    nav.insertAdjacentHTML('beforeend', `<div class="bd-drawer" role="group" inert><div class="bd-cv"><svg class="bd-wires" aria-hidden="true"></svg><div class="bd-kids"></div><div class="bd-mrow"></div></div></div>`);
    cv = rail.querySelector('.bd-cv');
    wires = cv.querySelector('.bd-wires');
    drawer = nav.querySelector('.bd-drawer');
    dcv = drawer.querySelector('.bd-cv');
    dwires = dcv.querySelector('.bd-wires');
    tip = document.createElement('div');
    tip.className = 'bd-tip';
    tip.setAttribute('aria-hidden', 'true');
    document.body.append(tip);

    nav.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) fly(b.dataset.go); });
    // Zeigen (Maus oder Fokus) öffnet den Zweig des Knotens; das Verlassen des Bands kehrt nach einer Weile zur Station zurück
    const over = (e) => {
      const b = e.target.closest?.('[data-go]');
      if (!b) return;
      clearTimeout(sleep);
      hovId = b.dataset.go;
      hot(hovId);
      renderDrawer();
      if (e.type === 'focusin' || e.pointerType === 'mouse') showTip(hovId, nav.querySelector(`[data-go="${hovId}"]`));
    };
    const out = (e) => { const b = e.target.closest?.('[data-go]'); if (b && !b.contains(e.relatedTarget)) { hideTip(); hot(null); } };
    const leave = () => {
      hideTip();
      hot(null);
      clearTimeout(sleep);
      sleep = setTimeout(() => { if (nav.matches(':hover, :focus-within')) return; hovId = null; renderDrawer(); }, 700);
    };
    nav.addEventListener('pointerover', over);
    nav.addEventListener('focusin', over);
    nav.addEventListener('pointerout', out);
    nav.addEventListener('pointerleave', leave);
    nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget)) leave(); });
    // Pfeiltasten im Band: links/rechts in der Zeile, runter in den Zweig, hoch zum Parent (die Reisetasten der Szene ruhen hier)
    nav.addEventListener('keydown', (e) => {
      const b = e.target.closest?.('[data-go]');
      if (!b || !['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const id = b.dataset.go, moon = b.classList.contains('bd-moon'), kid = !moon && drawer.contains(b);
      const row = [...(moon ? drawer.querySelectorAll('.bd-moon') : kid ? drawer.querySelectorAll('.bd-kids .bd-node') : rail.querySelectorAll('.bd-node'))];
      let to = null;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') to = row[row.indexOf(b) + (e.key === 'ArrowRight' ? 1 : -1)];
      else if (e.key === 'ArrowDown') to = kid ? (shown[1] === id && drawer.querySelector('.bd-moon')) : !moon && shown[0] === id && drawer.querySelector('.bd-kids .bd-node');
      else if (moon || kid) to = nav.querySelector(`.bd-node[data-go="${STATIONS[id].parent}"]`);
      to?.focus();
    });
    let first = true;
    const relayout = () => requestAnimationFrame(() => {
      layoutBand();
      if (!first) return;
      first = false;
      // Einzeichnen beim ersten Aufbau: Linien ziehen sich, Kapitel gestaffelt herein
      nav.classList.add('is-intro');
      setTimeout(() => nav.classList.remove('is-intro'), 2400);
    });
    new ResizeObserver(relayout).observe(nav);
    document.fonts?.ready.then(relayout);
    wide.addEventListener('change', relayout);
    // Lichtpunkt läuft alle 8 s die Route entlang bis zur aktuellen Station
    setInterval(runComet, 8000);
  }

  function layoutBand() {
    const W = nav.clientWidth;
    if (!W) return;
    const gs = groups();
    fit = null;
    if (wide.matches) {
      for (const [px, pad, lv] of SIZES) {
        const stops = gs.map(([, rs]) => sum(rs.map((r) => need(r, px, pad))));
        const weights = stops;
        const f = (W - lv - 2 * PAD - GAP * (gs.length - 1)) / sum(weights);
        if (f >= 1) { fit = { px, pad, lv, f, stops, weights }; break; }
      }
    }
    const dots = !fit, ry = dots ? DOTS_H / 2 : ROUTE_Y, cw = W - (dots ? 0 : fit.lv);
    nav.classList.toggle('is-dots', dots);
    nav.classList.toggle('is-compact', !!fit && fit.px < SIZES[0][0]);
    cv.style.setProperty('--ry', `${ry}px`);
    const each = (cw - 2 * PAD - 8 * (gs.length - 1)) / ROUTE.length;
    pos = {};
    let x = PAD;
    const paths = [`<defs><linearGradient id="bd-comet-g" x1="0" x2="1"><stop offset="0" stop-color="#33ccff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>`];
    gs.forEach(([hub, rs], i) => {
      const g = cv.querySelector(`.bd-grp[data-ch="${hub}"]`), w = dots ? each * rs.length : fit.weights[i] * fit.f;
      g.style.left = `${x}px`;
      g.style.width = `${w}px`;
      let acc = 0;
      rs.forEach((r) => {
        const n = dots ? each : need(r, fit.px, fit.pad) * (w / fit.stops[i]);
        pos[r] = { x: x + acc + n / 2, w: n };
        const b = g.querySelector(`[data-go="${r}"]`);
        b.style.left = `${acc + n / 2}px`;
        b.style.width = `${n - 4}px`;
        acc += n;
      });
      if (dots) paths.push(`<path class="bd-stripe" data-ch="${hub}" d="M${x + 3} ${ry} H${x + w - 3}"/>`);
      x += w + (dots ? 8 : GAP);
    });
    ROUTE.forEach((r, i) => {
      if (!i) return;
      const a = pos[ROUTE[i - 1]].x, b = pos[r].x, d = dots ? 5 : 8;
      paths.push(`<path class="bd-wire bd-seg" data-ch="${chapter(r)}" data-seg="${r}" pathLength="1" style="--d:${350 + i * 55}ms" d="M${a + d} ${ry + 0.5} H${b - d}"/>`);
    });
    paths.push('<path class="bd-wire bd-drop" pathLength="1"/><path class="bd-comet"/>');
    wires.innerHTML = paths.join('');
    const H = dots ? DOTS_H : BAND_H;
    nav.style.setProperty('--band-h', `${H}px`);
    if (bandH && bandH !== H) h.onRelayout();
    bandH = H;
    markBand();
    renderDrawer(true);
  }

  // Zweig einer Station: Halt mit Abstechern und Abstecher mit Monden auf ihrem Weg
  function branchOf(id) {
    const stop = stopOf(id);
    if (!stop) return ['', ''];
    let kid = id;
    while (kid && STATIONS[kid].parent !== stop) kid = STATIONS[kid].parent;
    return [kidsOf(stop).length ? stop : '', kid && kid !== stop && kidsOf(kid).length ? kid : ''];
  }
  // Gezeigter Zweig: beim Zeigen der des Knotens (Halt ohne Abstecher und Abstecher ohne Monde lassen das Offene stehen),
  // sonst der Weg zur aktuellen Station
  function wantBranch() {
    if (!fit || !railCur) return ['', ''];
    const sel = branchOf(railCur);
    if (!hovId) return sel;
    const [s, k] = branchOf(hovId);
    if (!s) return shown[0] ? shown : sel;
    return [s, k || (s === shown[0] ? shown[1] : '')];
  }
  function renderDrawer(force) {
    const [s, k] = wantBranch();
    const newStop = force || s !== shown[0];
    if (!newStop && k === shown[1]) return;
    shown = [s, k];
    nav.classList.toggle('has-drawer', !!s);
    drawer.classList.toggle('is-open', !!s);
    drawer.inert = !s;
    const drop = wires.querySelector('.bd-drop');
    if (!s) { drop?.removeAttribute('d'); return; }
    const ks = kidsOf(s), px = fit.px - 0.5, cw = nav.clientWidth - fit.lv;
    // rechte Grenze: links der Infotafel, wenn sie zu sehen ist
    const panelEl = $('#panel'), nr = nav.getBoundingClientRect();
    const right = Math.min(cw - PAD, panelEl.offsetParent ? panelEl.getBoundingClientRect().left - nr.left - fit.lv - 12 : cw - PAD);
    if (newStop) {
      const ws = ks.map((id) => need(id, px, fit.pad) * 1.04), kn = sum(ws);
      let x = Math.max(PAD, Math.min(Math.max(right, PAD + kn) - kn, pos[s].x - kn / 2));
      const kpos = {};
      ks.forEach((id, i) => { kpos[id] = x + ws[i] / 2; x += ws[i]; });
      drawer.dataset.of = s;
      drawer.setAttribute('aria-label', `Abstecher von ${STATIONS[s].title}`);
      dcv.querySelector('.bd-kids').innerHTML = ks.map((id, i) => node(id, ' bd-kid', `left:${kpos[id]}px;width:${ws[i] - 4}px;--i:${Math.min(i, 8)}`)).join('')
        + ks.filter((id) => kidsOf(id).length).map((id) => `<span class="bd-md" data-of="${id}" data-ch="${chapter(id)}" style="left:${kpos[id]}px" aria-hidden="true">${'<i></i>'.repeat(kidsOf(id).length)}</span>`).join('');
      const moons = ks.some((id) => kidsOf(id).length);
      drawer.classList.toggle('has-mrow', moons);
      drawer.style.setProperty('--dr-h', `${moons ? MOONS_Y + 36 : KID_Y + 62}px`);
      drawer.style.setProperty('--dr-w', `${fit.lv + Math.max(x, pos[s].x + 20) + PAD}px`);
      drawer.kpos = kpos;
      const xs = Object.values(kpos), sx = pos[s].x, c = chapter(s);
      dwires.innerHTML = `<path class="bd-wire bd-bus" data-ch="${c}" pathLength="1" d="M${sx} -1 V${BUS_Y} M${Math.min(sx, ...xs)} ${BUS_Y} H${Math.max(sx, ...xs)}"/>`
        + ks.map((id) => `<path class="bd-wire bd-kidw" data-ch="${c}" data-to="${id}" pathLength="1" d="M${kpos[id]} ${BUS_Y} V${KID_Y - 25}"/>`).join('')
        + '<path class="bd-wire bd-mw" pathLength="1"/>';
      const sb = cv.querySelector(`.bd-node[data-go="${s}"]`);
      drop.setAttribute('d', `M${sx} ${sb.offsetTop + sb.offsetHeight + 2} V${BAND_H}`);
      drop.dataset.ch = c;
    }
    // Monde des gezeigten Abstechers als Reihe unter ihm (Punkte der übrigen weichen), Klammer von seinem Fuß aus
    const mrow = dcv.querySelector('.bd-mrow'), mw = dwires.querySelector('.bd-mw');
    drawer.classList.toggle('has-moons', !!k);
    if (!k) { mrow.replaceChildren(); mw.removeAttribute('d'); markBand(); return; }
    const ms = kidsOf(k), kx = drawer.kpos[k];
    mrow.innerHTML = `<div class="bd-moons" data-ch="${chapter(k)}">${ms.map((id) => `<button type="button" class="bd-moon" data-go="${id}" data-ch="${chapter(id)}" aria-label="${label(id)}"><span class="n">${num(id)}</span>${title(id)}</button>`).join('')}</div>`;
    const box = mrow.firstChild, bw = box.offsetWidth, xs = Object.values(drawer.kpos);
    const lo = Math.min(...xs) - 30, hi = Math.max(right, Math.max(...xs) + 30);
    const left = Math.max(lo, Math.min(hi - bw, kx - bw / 2));
    box.style.left = `${left}px`;
    const kb = dcv.querySelector(`.bd-node[data-go="${k}"]`), cs = [...box.children].map((el) => left + el.offsetLeft + el.offsetWidth / 2);
    mw.setAttribute('d', `M${kx} ${kb.offsetTop + kb.offsetHeight + 2} V${BRK_Y} M${Math.min(kx, ...cs)} ${BRK_Y} H${Math.max(kx, ...cs)} ${cs.map((c) => `M${c} ${BRK_Y} V${MOONS_Y}`).join(' ')}`);
    mw.dataset.ch = chapter(k);
    markBand();
  }

  // Aktuelle Station eisblau mit Lichthof, Halte davor gefüllt, Halt auf ihrem Weg hervorgehoben
  function markBand() {
    if (!railCur || !cv) return;
    const stop = stopOf(railCur), si = ROUTE.indexOf(stop), path = new Set();
    for (let x = railCur; x; x = STATIONS[x].parent) { path.add(x); if (x === stop) break; }
    nav.querySelectorAll('[data-go]').forEach((b) => {
      const id = b.dataset.go, cur = id === railCur;
      b.classList.toggle('is-cur', cur);
      b.classList.toggle('is-path', !cur && path.has(id));
      b.classList.toggle('is-done', onRoute.has(id) && ROUTE.indexOf(id) < si);
      if (cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    wires.querySelectorAll('.bd-seg').forEach((p) => p.classList.toggle('is-done', ROUTE.indexOf(p.dataset.seg) <= si));
    dwires.querySelectorAll('.bd-kidw').forEach((p) => p.classList.toggle('is-done', path.has(p.dataset.to)));
  }
  // Weg zum gezeigten Knoten leuchtet: Knoten bis zum Halt, Route bis dorthin, Linien des Zweigs
  function hot(id) {
    nav.querySelectorAll('.is-hot').forEach((el) => el.classList.remove('is-hot'));
    if (!id) return;
    const stop = stopOf(id), si = ROUTE.indexOf(stop), path = [];
    for (let x = id; x; x = STATIONS[x].parent) { path.push(x); if (x === stop) break; }
    path.forEach((x) => nav.querySelectorAll(`[data-go="${x}"], .bd-kidw[data-to="${x}"]`).forEach((el) => el.classList.add('is-hot')));
    wires.querySelectorAll('.bd-seg').forEach((p) => { if (ROUTE.indexOf(p.dataset.seg) <= si) p.classList.add('is-hot'); });
    if (path.length > 1 && stop === shown[0]) {
      wires.querySelector('.bd-drop')?.classList.add('is-hot');
      dwires.querySelector('.bd-bus')?.classList.add('is-hot');
      if (shown[1] && STATIONS[id].parent === shown[1]) dwires.querySelector('.bd-mw')?.classList.add('is-hot');
    }
  }
  // Hinweis unter dem Band (bzw. der offenen Schublade), zwei Zeilen: Nummer, Name, Halt der Route · Art, echtes Maß, Entfernung zur Erde
  function showTip(id, b) {
    if (!b) return;
    const st = STATIONS[id], halt = ROUTE.indexOf(id);
    tip.dataset.ch = chapter(id);
    // Teile brechen nur am „ · “ um, nie mitten im Maß (wie .cap-sub)
    const sub = [esc(st.kicker), size(id), away(id)].filter(Boolean).map((t) => `<span>${t}</span>`).join(' · ');
    tip.innerHTML = `<span class="bd-tip-head"><span class="n">${num(id)}</span><b>${title(id)}</b>${halt < 0 ? '' : `<span class="bd-tip-halt">Halt ${halt + 1} von ${ROUTE.length}</span>`}</span><span class="bd-tip-sub">${sub}</span>`;
    const r = b.getBoundingClientRect(), base = (drawer.classList.contains('is-open') ? drawer : nav).getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    tip.style.top = `${base.bottom + 8}px`;
    tip.classList.add('is-on');
  }
  function hideTip() { tip?.classList.remove('is-on'); }
  function runComet() {
    const p = wires?.querySelector('.bd-comet'), a = pos[ROUTE[0]], b = pos[stopOf(railCur)];
    if (!p || !a || !b || !fit || still.matches || document.hidden || b.x - a.x < 40) return;
    const L = b.x - 10 - a.x;
    p.setAttribute('d', `M${a.x} ${ROUTE_Y + 0.5} H${b.x - 10}`);
    p.style.strokeDasharray = `46 ${L + 60}`;
    comet?.cancel();
    comet = p.animate([{ strokeDashoffset: 46, opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.85 }, { strokeDashoffset: 4 - L, opacity: 0 }], { duration: 2600, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' });
  }

  // ---------- Reiseroute ----------
  route.innerHTML = ROUTE.map((id, i) => `<li><button type="button" data-id="${id}" aria-label="Station ${i + 1}: ${esc(STATIONS[id].title)}"><span class="rt-dot"></span><span class="rt-name">${esc(STATIONS[id].title)}</span></button></li>`).join('');
  route.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { h.onInput(); h.onGo(b.dataset.id); }));

  btnOut.addEventListener('click', () => { h.onInput(); h.onOut(); });
  pull.addEventListener('click', () => { h.onInput(); h.onOffer(); });
  btnNext.addEventListener('click', () => { h.onInput(); h.onNext(1); });
  btnPrev.addEventListener('click', () => { h.onInput(); h.onNext(-1); });
  $('#btn-close-card').addEventListener('click', () => closeCard());

  // ---------- Station ----------
  const quick = mountQuick($('.top-actions'), () => h.onInput());
  function setStation(level) {
    lv = level;
    quick.station(level);
    meta = level.meta;
    const id = level.id;
    railCur = id;
    // Band: Marken setzen, Zweig der neuen Station öffnen (beim Zeigen bleibt der gezeigte), Lichtpunkt bis hierher
    if (!hovId) hot(null);
    markBand();
    renderDrawer();
    runComet();
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
    mSizeL.textContent = meta.size ? meta.size.l : 'Größe';
    mSize.textContent = meta.size ? fmtLength(meta.size.v) : '–';
    mLight.textContent = meta.size ? fmtTime(meta.size.v / C) : '–';
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
    // Ton schaltet der Knopf in der Kopfzeile (quick.js, Vorschau 26.10.2026: aus der Infotafel entfernt)
    const ctrls = (lv.controls || []).filter((c) => c.id !== 'sound');
    // Abstecher (Nummer mit Buchstabe, z. B. 02A) nennen ihre Elternstation
    const from = /^\d+$/.test(String(st.n)) || !st.parent ? '' : ` · Abstecher von ${STATIONS[st.parent].title}`;
    // Infotafel als Messblatt (Tafel:C): Kopf in Satzschreibung, Kennzahlen als Wertetabelle (Zahl rechtsbündig), Maßstab auf
    // Grundlinie; Zustand (live) und Knöpfe der Station (action) im festen Fuß unter dem Scrollbereich
    const acts = ctrls.filter((c) => c.type === 'action' && !c.sub), rest = ctrls.filter((c) => !acts.includes(c));
    panel.innerHTML = `
      <div class="t-head"><p class="kicker">Station <span class="kick-n">${num(lv.id)}</span> · ${esc(st.kicker + from)}</p>
      <h1 class="st-title">${esc(st.title)}</h1>
      <p class="lead">${prose(st.lead)}</p></div>
      <dl class="kpi">${st.facts.map((f) => `
        <div><dt>${prose(f.l)}</dt><dd>${esc(f.v)}${f.u ? ` <span>${esc(f.u)}</span>` : ''}</dd></div>`).join('')}
      </dl>
      ${settings.S.scaleCompare !== false ? renderScaleCompare(lv.id, scaleTabIdx) : ''}
      ${lv.widget ? `<div class="widget" id="widget">${lv.widget()}</div>` : ''}
      ${rest.length ? `<div class="st-ctrls">${rest.map(ctrlHtml).join('')}</div>` : ''}
      <h2 class="sec-h">Entdecken</h2>
      <ul class="explore">${hs.map((x, i) => `
        <li><button type="button" data-hs="${x.id}" class="${x.kind === 'dive' ? 'is-dive' : ''}">${x.kind === 'dive' ? hex('<path d="M14 17l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>', 'hex--mini') : hexNum(i + 1, 'hex--mini')}<span>${esc(info(x).t)}</span>${x.kind === 'dive' ? '<span class="tag">hineinfliegen</span>' : ''}</button></li>`).join('')}
      </ul>
      <details class="note"><summary>Darstellung und Quellen</summary>
        <p>${prose(st.note)}</p>
        <ol class="sources">${st.sources.map((s) => `<li><a href="${SOURCES[s].url}" target="_blank" rel="noopener">${prose(SOURCES[s].t)}</a><span>${prose(SOURCES[s].by)}</span></li>`).join('')}</ol>
      </details>`;
    foot.innerHTML = `${lv.live ? '<p class="live" id="live" aria-live="off"></p>' : ''}${acts.map((c) => `<button type="button" class="act-btn act-btn--prim" data-act="${c.id}">${esc(c.button)}</button>`).join('')}`;
    foot.hidden = !lv.live && !acts.length;
    foot.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => { acts.find((x) => x.id === b.dataset.act).run(); h.onInput(); }));
    liveEl = foot.querySelector('#live');
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
    panel.querySelectorAll('input[type=range]').forEach((i) => paintRange(i));
  }
  // Regler mit get() (z. B. Zeitraffer, auch im Zahnrad stellbar) folgen ihrem Zustand, außer während der Bedienung
  function syncCtrls() {
    for (const c of lv.controls || []) {
      if (c.type !== 'range' || !c.get) continue;
      const v = c.get(), i = panel.querySelector(`[data-rng="${c.id}"]`);
      if (v === c.value || !i || document.activeElement === i) continue;
      c.value = v;
      i.value = v;
      paintRange(i);
      panel.querySelector(`[data-rout="${c.id}"]`).textContent = c.fmt ? c.fmt(v) : String(v);
    }
  }
  // Füllung jedes Reglers folgt der Bedienung (Infotafel, Info-Karte; Fenster malen in ihrem sync)
  addEventListener('input', (e) => { if (e.target.type === 'range') paintRange(e.target); }, true);

  // ---------- Abzeichen ----------
  // Größe eines Abzeichens neu messen, sobald sie sich ändert (z. B. Webschrift nachgeladen) – sonst passt die Box nicht
  const sizeObs = new ResizeObserver((es) => { for (const e of es) { const m = markers.find((k) => k.el === e.target); if (m) m.w = 0; } });
  function buildMarkers() {
    markers.forEach((m) => { sizeObs.unobserve(m.el); m.el.remove(); m.dot.remove(); });
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
      sizeObs.observe(el);
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
    const n = markers.find((m) => m.x.id === id)?.el.querySelector('.hex text')?.textContent || '';
    card.querySelector('.hs-card-title').innerHTML = `${n ? `<span class="hs-card-n">${n}</span>` : ''}<span>${esc(t.t)}</span>`;
    const head = card.querySelector('.hs-card-head');
    while (head.nextSibling) head.nextSibling.remove();
    head.insertAdjacentHTML('afterend', cardHtml(lv.id, id, t, cardEnv));
    mountCard(card, lv.id, id, cardEnv);
    card.querySelectorAll('input[type=range]').forEach((i) => paintRange(i));
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

  // Lage je Bild: Punkt am Objekt, Abzeichen schräg daneben (45°-Knick), frei von Karte, Bedienung über der Bühne (Kapitel-Titel,
  // Zahnrad, Zeitleiste, offene Schublade), Rändern, anderen Abzeichen und fremden Punkten; die Leitlinie schneidet kein fremdes
  // Abzeichen. Einmal gefundene Lage (Seite + Reichweite) bleibt, solange sie frei ist – kein Springen.
  // Offene Karte: zuerst das gewählte Abzeichen, dann die Karte daneben, dann alle übrigen (weichen der Karte aus).
  const OFFS = [[1, -1], [-1, -1], [1, 1], [-1, 1]];
  const DOT = 5;   // px um den Punkt (6 px) frei halten
  const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  // Strecke p→q schneidet Box o mehr als 1 px (Liang–Barsky)
  const cuts = ([x1, y1], [x2, y2], o) => {
    const dx = x2 - x1, dy = y2 - y1;
    let t0 = 0, t1 = 1;
    for (const [p, q] of [[-dx, x1 - o.l], [dx, o.r - x1], [-dy, y1 - o.t], [dy, o.b - y1]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const u = q / p;
      if (p < 0) t0 = Math.max(t0, u); else t1 = Math.min(t1, u);
      if (t0 > t1) return false;
    }
    return Math.hypot(dx, dy) * (t1 - t0) > 1;
  };
  // Bedienung, die über der Bühne liegt: Hindernis für Abzeichen und Karte
  function uiBoxes() {
    const out = [];
    const add = (el, mx, my) => { const q = el.getBoundingClientRect(); if (q.width && q.height) out.push({ l: q.left - mx, r: q.right + mx, t: q.top - my, b: q.bottom + my }); };
    if (caption.classList.contains('is-on')) for (const el of caption.children) add(el, 6, 4);
    const cfg = $('#cfg'), tl = $('#timeline');
    if (cfg && !cfg.hidden) add(cfg, 8, 8);
    if (tl && !tl.hidden) add(tl, 6, 6);
    if (drawer && drawer.classList.contains('is-open')) add(drawer, 6, 6);
    return out;
  }
  function update(camera, level, time) {
    if (DBG) window.__ovl = { camera, level, markers, selected, card, dock, cardMaxH };
    const dt = Math.min(0.1, Math.max(0, time - lastT));
    lastT = time;
    if (!markers.length || layer.classList.contains('is-hidden')) { tickLive(time); return; }
    const W = window.innerWidth, H = window.innerHeight;
    const r = stageRect();
    const open = card.classList.contains('is-open'), sheet = open && W <= 760;
    const ui = uiBoxes();
    if (sheet) ui.push(placeSheet(r));
    const list = open ? ordered : markers;
    // zuerst alle Punkte: jeder ist Hindernis für fremde Abzeichen (Box mit m = eigener Punkt, zählt für die Leitlinie nicht)
    const at = new Map(), boxes = [...ui], segs = [];
    for (const m of list) {
      const p = m.x.pos.clone().project(camera);
      const ax = (p.x + 1) / 2 * W, ay = (1 - p.y) / 2 * H;
      const vis = p.z < 1 && ax > r.x0 + 4 && ax < r.x1 - 4 && ay > r.y0 + 4 && ay < r.y1 - 4 && (!m.x.visible || m.x.visible(camera));
      if (!vis) { hide(m); continue; }
      at.set(m, [ax, ay]);
      m.dot.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
      m.dot.classList.remove('is-off');
      boxes.push({ l: ax - DOT, r: ax + DOT, t: ay - DOT, b: ay + DOT, m });
    }
    const free = (box, m) => !boxes.some((o) => o.m !== m && hit(box, o)) && !segs.some(([a, b]) => cuts(a, b, box));
    const lineFree = (pts) => !boxes.some((o) => !o.m && pts.some((q, i) => i && cuts(pts[i - 1], q, o)));
    const cx = (r.x0 + r.x1) / 2;
    const place = (m) => {
      const a = at.get(m);
      if (!a) return null;
      const [ax, ay] = a;
      if (!m.w) { m.w = m.el.offsetWidth; m.hgt = m.el.offsetHeight; }
      if (m.label) {
        const bx = ax + 10, by = ay - m.hgt / 2;
        const box = { l: bx - 4, r: bx + m.w + 4, t: by - 4, b: by + m.hgt + 4 };   // Rand wie beim Abzeichen (Karten-Leitlinie setzt dort an)
        if (box.r > r.x1 || !free(box, m)) { m.el.classList.add('is-off'); return null; }
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
        if (box.l < r.x0 || box.r > r.x1 || box.t < r.y0 || box.b > r.y1 || !free(box, m)) continue;
        // Leitlinie: vom Punkt 45° schräg, dann waagrecht an die Kante des Abzeichens
        const ex = sx > 0 ? bx : bx + m.w, ey = by + m.hgt / 2;
        const dy = ey - ay, kx = ax + Math.sign(ex - ax) * Math.min(Math.abs(dy), Math.abs(ex - ax) * 0.7);
        const pts = [[ax, ay], [kx, ey], [ex, ey]];
        if (!lineFree(pts)) continue;
        placed = { bx, by, box, side: [sx, sy], reach, pts };
        break;
      }
      if (!placed) { hide(m, true); return null; }
      m.side = placed.side;
      m.reach = placed.reach;
      boxes.push(placed.box);
      segs.push(...placed.pts.slice(1).map((q, i) => [placed.pts[i], q]));
      m.el.classList.remove('is-off');
      m.el.style.transform = `translate(${placed.bx.toFixed(1)}px, ${placed.by.toFixed(1)}px)`;
      m.path.setAttribute('d', placed.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(''));
      m.path.classList.remove('is-off');
      return placed.box;
    };
    let found = false;
    for (const m of list) {
      const box = place(m);
      if (open && !sheet && m.x.id === selected) { found = true; placeCard(box, r, boxes, ui, segs, dt); }
    }
    if (open && !sheet && !found) placeCard(null, r, boxes, ui, segs, dt);   // Abzeichen per Schalter ausgeblendet: Karte wartet
    tickLive(time);
  }

  // Karte am Abzeichen (Vorschau Lage:A): links daneben, sonst darüber, darunter, rechts – erste freie Seite in der Bühne,
  // frei von Bedienung (Kapitel-Titel, Zahnrad, Zeitleiste, Schublade). Ruhig (Wunsch User 26.10.2026): erscheint erst, wenn
  // das Abzeichen still steht (Folgen-Flug fertig), dockt einmal an und bleibt stehen – nur die Leitlinie folgt dem Abzeichen.
  // Neu andocken (weich gleitend) nur, wenn das Abzeichen unter die Karte wandert oder Bedienung ihren Platz belegt; wandert es
  // daneben weiter (Zeitraffer) oder hinter den Planeten, bleibt die Karte stehen. Ohne sichtbares Abzeichen dockt sie an einem freien Platz in einer
  // Ecke der Bühne. Passt sie nirgends ganz, wird sie niedriger (Inhalt scrollt) – das gewählte Abzeichen deckt sie nie.
  const SIDES = ['left', 'above', 'below', 'right'];
  const ORIGIN = { left: 'right center', right: 'left center', above: 'center bottom', below: 'center top' };
  const SETTLE = 0.3, WAIT_MAX = 2.4, WAIT_HIDDEN = 0.6, STILL_PX = 40;   // s, s, s, px/s
  const MIN_H = 160;   // px: niedrigste Karte neben dem gewählten Abzeichen, bevor sie über die Bedienung darf
  function placeCard(b, r, boxes, ui, segs, dt) {
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
    // Hindernisse: Bedienung + gewähltes Abzeichen; die übrigen Abzeichen weichen danach der Karte aus.
    // ponytail: fremde Punkte zählen hier nicht – sonst dockte die Karte bei jedem vorbeiziehenden Punkt neu an (Karte ruhig)
    const obst = b ? [...ui, b] : ui;
    const w = cardW;
    const cX = (x) => Math.min(r.x1 - M - w, Math.max(r.x0 + M, x)), cY = (y, h) => Math.min(yMax - h, Math.max(r.y0 + M, y));
    const clear = ([x, y], h, list) => !list.some((o) => hit({ l: x, r: x + w, t: y, b: y + h }, o));
    // freie Lücken (von, bis) in der Spalte der Karte ab x zwischen lo und hi, Hindernisse (Standard: Bedienung) ausgespart
    const gaps = (x, lo, hi, list = ui) => {
      const out = [];
      let y = lo;
      for (const o of list.filter((q) => q.l < x + w && q.r > x && q.t < hi && q.b > lo).sort((p, q) => p.t - q.t)) {
        if (o.t > y) out.push([y, o.t]);
        y = Math.max(y, o.b);
      }
      if (hi > y) out.push([y, hi]);
      return out;
    };
    const inStage = ([x, y], h) => x >= r.x0 + M - 0.5 && x + w <= r.x1 - M + 0.5 && y >= r.y0 + M - 0.5 && y + h <= yMax + 0.5;
    // Lage behalten; neu andocken nur, wenn Bedienung oder das gewählte Abzeichen den Platz belegt (Schublade öffnet,
    // Karte wächst beim Nachladen, Abzeichen wandert unter die Karte) – sonst bleibt sie stehen, auch wenn es weiterzieht
    const hNow = Math.min(cardH, maxH, (dock && dock.lim) || Infinity);
    const keep = dock && [cX(dock.goal[0]), cY(dock.goal[1], hNow)];
    if (!dock || !clear(keep, hNow, obst)) {
      const hh = Math.min(Math.max(cardH, card.scrollHeight), maxH);   // volle Höhe, auch wenn die Karte gerade verkleinert ist
      let side = 'left', pos = null, lim = 0;
      if (b) {
        const at = (s) => (s === 'left' ? [b.l - G - w, cY(by - hh / 2, hh)] : s === 'right' ? [b.r + G, cY(by - hh / 2, hh)]
          : s === 'above' ? [cX(b.l), b.t - G - hh] : [cX(b.l), b.b + G]);
        const into = (s) => { const [x, y] = at(s); return [cX(x), cY(y, hh)]; };
        const order = [dock && dock.side, ...SIDES].filter((s, i, a) => s && a.indexOf(s) === i);
        // 1. ganz frei neben dem Abzeichen · 2. in die Bühne geschoben, frei von Bedienung und Abzeichen
        side = order.find((s) => inStage(at(s), hh) && clear(at(s), hh, obst));
        if (side) pos = at(side);
        else if ((side = order.find((s) => clear(into(s), hh, obst)))) pos = into(side);
        else {
          // 3. niedriger in der größten Lücke frei von Bedienung und Abzeichen: Spalte des Abzeichens oder am Bühnenrand;
          //    über dem Abzeichen unten in der Lücke, sonst oben
          let best = null;
          const near = [b.l - G, b.r + G - w, b.l - G - w, b.r + G];
          for (const x of [...near, r.x0, r.x1].map(cX)) for (const g of gaps(x, r.y0 + M, yMax, obst)) if (!best || g[1] - g[0] > best.g[1] - best.g[0]) best = { x, g };
          const span = best ? best.g[1] - best.g[0] : 0;
          const fit = (h) => {
            const up = best.g[1] <= b.t;
            lim = Math.floor(Math.min(h, hh));
            side = up ? 'above' : best.g[0] >= b.b ? 'below' : best.x + w <= b.l ? 'left' : 'right';
            pos = [best.x, up ? best.g[1] - lim : best.g[0]];
            if (lim >= hh) lim = 0;
          };
          if (span >= MIN_H) fit(span);
          // 4. volle Höhe, frei vom Abzeichen (darf über die Bedienung) · 5. so niedrig wie nötig
          else if ((side = order.find((s) => clear(into(s), hh, [b])))) pos = into(side);
          else if (best) fit(Math.max(48, span));
          else { side = order[0]; pos = into(side); }
        }
      } else {   // Abzeichen nicht im Bild: freier Platz in einer Ecke der Bühne, sonst die größte Lücke (Karte niedriger)
        const hh0 = Math.min(cardH, maxH);
        const spots = [[r.x0 + M + 16, r.y0 + M + 16], [r.x0 + M + 16, yMax - hh0 - 16], [r.x1 - M - w - 16, r.y0 + M + 16]].map(([x, y]) => [cX(x), cY(y, hh0)]);
        pos = spots.find((p) => clear(p, hh0, obst));
        if (!pos) {
          let best = null;
          for (const x of [cX(r.x0 + M + 16), cX(r.x1 - M - w - 16)]) for (const g of gaps(x, r.y0 + M, yMax)) if (!best || g[1] - g[0] > best.g[1] - best.g[0]) best = { x, g };
          if (best) { lim = Math.floor(Math.min(best.g[1] - best.g[0], hh0)); pos = [best.x, best.g[0]]; } else pos = spots[0];
        }
      }
      if (!dock) dock = { pos, goal: pos, side, box: null, lim };
      else Object.assign(dock, { goal: pos, side, lim });
    } else dock.goal = keep;
    const lim = Math.min(maxH, dock.lim || Infinity);
    if (lim !== cardMaxH) { cardMaxH = lim; card.style.maxHeight = `${lim}px`; requestAnimationFrame(moreCard); }
    const hh = Math.min(cardH, lim);
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
    segs.push([[sx, sy], [ex, ey]]);
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
    liveEl.textContent = nbsp(lv.live());   // Zahl + Einheit nie getrennt (tests/textcheck.js)
  }

  // ---------- Flug, Kapitel-Titel, Auftakt ----------
  let capTimer = 0;
  // Titel und Zeile darunter einzeilig: Schrift nach der Breite der Bühne verkleinern, gemessen in der breitesten
  // Sperrung vor dem Einblenden; Zeile darunter nie unter 12 px, dann Umbruch nur an den Trennern ·
  function fitCaption() {
    const cs = getComputedStyle(caption);
    const avail = (caption.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    for (const [sel, min, share] of [['.cap-title', 0, 0.84], ['.cap-sub', 12, 0.98]]) {
      const el = caption.querySelector(sel);
      el.style.fontSize = '';
      el.classList.remove('is-wrap');
      if (el.scrollWidth <= avail * share) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize) * avail * share / el.scrollWidth;
      el.style.fontSize = `${Math.max(min, fs)}px`;
      el.classList.toggle('is-wrap', fs < min);
    }
  }

  function showCaption(st, opening = false) {
    caption.querySelector('.cap-n').textContent = opening ? 'Kosmos' : String(st.n).padStart(2, '0');
    caption.querySelector('.cap-title').textContent = opening ? 'Eine Reise durch das Universum' : st.title;
    const parts = opening
      ? ['Vom Urknall bis zur Erde']
      : [st.kicker, ...(st.size ? [`${st.size.l} ${fmtLength(st.size.v)}`] : []), ...(st.dist ? [`${fmtLength(st.dist)} entfernt`] : [])];
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

  // Rand-Angebot: am Zoom-Anschlag weiter gescrollt → Knopf „Hinaus-/Hineinfliegen“, erst sein Klick startet den Flug
  function setOffer(o) {
    // Zeitraffer sichtbar: Knopf 10 px darüber statt dahinter
    if (o && !pull.classList.contains('is-on')) {
      const tl = $('#timeline'), q = tl && !tl.hidden ? tl.getBoundingClientRect() : null;
      pull.style.bottom = q ? `${$('#stage-area').getBoundingClientRect().bottom - q.top + 10}px` : '';
    }
    pull.classList.toggle('is-on', !!o);
    pull.tabIndex = o ? 0 : -1;
    pull.setAttribute('aria-hidden', o ? 'false' : 'true');
    const key = o ? `${o.out}:${o.to}` : '';
    if (!o || pull.dataset.key === key) return;
    pull.dataset.key = key;
    pull.innerHTML = `${o.out ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v13M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'}<span>${o.out ? 'Hinausfliegen' : 'Hineinfliegen'}: ${esc(STATIONS[o.to].title)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function stageRect() {
    const s = $('#stage-area').getBoundingClientRect();
    return { x0: s.left, x1: s.right, y0: s.top, y1: s.bottom };
  }

  // Film vom Urknall: Hinweis-Zeile über der Bühne – außerhalb der Bedienung, damit sie im Auftakt (Bedienung ausgeblendet)
  // sichtbar bleibt; sitzt mittig über der Bühne, nie unter Leiste oder Infotafel. Kein „Überspringen“-Knopf mehr (User
  // 27.10.2026), Esc und die Film-Tasten in main.js überspringen weiter
  const filmHint = document.createElement('p');
  filmHint.className = 'film-hint';
  filmHint.setAttribute('aria-live', 'polite');
  body.append(filmHint);
  // Zeile erscheint erst, wenn der Stationstitel ausgeblendet ist (nie beide übereinander), und bleibt HINT_S Sekunden
  const HINT_S = 4.5;
  let hintSince = 0, hintDone = '';
  function setHint(want) {
    if (!want) hintDone = '';
    if (want && caption.classList.contains('is-on')) want = '';
    if (want && hintSince && performance.now() - hintSince > HINT_S * 1000) { hintDone = want; want = ''; }
    const text = want && want !== hintDone ? want : '';
    if (filmHint.dataset.t === text) return;
    filmHint.dataset.t = text;
    hintSince = text ? performance.now() : 0;
    if (text) {
      const r = stageRect();
      filmHint.textContent = text;
      filmHint.style.left = `${(r.x0 + r.x1) / 2}px`;
      filmHint.style.maxWidth = `${Math.max(240, Math.min(640, r.x1 - r.x0 - 32))}px`;
    }
    filmHint.classList.toggle('is-on', !!text);
  }

  buildSearch();
  buildRail();
  // Kurzmeldung in der Hinweiszeile unten in der Bühne (sichtbar auch im Flug und schmal), danach wieder der Hinweis
  const hintEl = document.querySelector('.hint'), hintText = hintEl.textContent;
  let noticeT = 0;
  return {
    notice(text) {
      clearTimeout(noticeT);
      hintEl.textContent = text;
      body.classList.add('is-notice');
      noticeT = setTimeout(() => { body.classList.remove('is-notice'); hintEl.textContent = hintText; }, 6000);
    },
    setStation, update, setOffer, stageRect, setFlight,
    // ohne Station: Titel sofort ausblenden (Auftakt-Film)
    caption: (st, opening) => { if (st) showCaption(st, opening); else { caption.classList.remove('is-on'); clearTimeout(capTimer); } },
    hideMarkers: (on) => { layer.classList.toggle('is-hidden', on); if (on) closeCard(); },
    setLoading: (on) => body.classList.toggle('is-loading', on),
    setRouteTarget: (id) => route.querySelectorAll('button').forEach((b) => b.classList.toggle('is-target', b.dataset.id === id)),
    intro: (on) => body.classList.toggle('is-intro', on),
    hint: (text) => setHint(text || ''),
    // offene Karte: main.js hält die Leerlauf-Fahrt an, damit das Bild beim Lesen ruht
    reading: () => card.classList.contains('is-open'),
    relayout: () => { markers.forEach((m) => { m.w = 0; }); dock = null; },
  };
}
