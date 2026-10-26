// Bedienoberfläche über der 3D-Szene: Stationsbaum (links, Reiseordnung von unten, Abstecher eingerückt, Bildbreite
// je Station), Infotafel (rechts: Kennzahlen-Bento, Schalter der Station, Entdecken-Liste, Darstellung + Quellen),
// Abzeichen mit gewinkelten 45°-Leitlinien (Sechseck wie Biochar), Info-Karte, Messleiste (Bildbreite, Lichtlaufzeit,
// Entfernung, Blick zurück), Reiseroute, Kapitel-Titel beim Ankommen, Rand-Zug-Anzeige.

import { STATIONS, ROUTE, SOURCES, routeIndex } from './content.js';
import { fmtLength, fmtTime, C } from './astro.js';
import { settings, setSetting, mountSettings, onSettings } from './settings.js';
import { getLayer, setLayer, fmtVal } from './layers.js';
import { cardHtml, mountCard, unmountCard } from './cards.js';

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
  let lv = null, meta = null, markers = [], selected = null, liveEl = null, widgetEl = null, liveT = 0;
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
  });
  body.classList.toggle('panel-off', !settings.S.panel);
  $('#btn-panel').addEventListener('click', () => setSetting('panel', !settings.S.panel));

  // ---------- Stationsbaum ----------
  // Reiseordnung von unten (01) nach oben. Stamm = erste Station der Route und alle ihre Vorfahren; was abseits liegt
  // (Orion-Nebel, Krebsnebel → Crab-Pulsar, Sagittarius A* …), hängt eingerückt unter seiner Elternstation – wie Hinein/Hinaus.
  // Halte der Route stehen immer da; Abstecher außerhalb der Route (Asteroiden, später Monde) sind zugeklappt, ihre Eltern-
  // zeile zeigt „+n“ (Klick klappt auf). Der Ast der aktuellen Station ist immer offen.
  const railRows = new Map(), railKids = new Map(), railTrunk = [], railOpen = new Set();
  let railSvg = null, railLive = null, railCur = null;
  const fixed = (id) => ROUTE.includes(id) || railTrunk.includes(id);
  function buildRail() {
    for (let id = ROUTE[0]; id; id = STATIONS[id].parent) railTrunk.push(id);
    const ids = Object.keys(STATIONS), onTrunk = new Set(railTrunk);
    const depth = (id) => (onTrunk.has(id) || !STATIONS[id].parent ? 0 : depth(STATIONS[id].parent) + 1);
    ids.forEach((id) => railKids.set(id, ids.filter((k) => STATIONS[k].parent === id && !onTrunk.has(k)).sort((a, b) => num(a).localeCompare(num(b)))));
    const walk = (id) => [id, ...railKids.get(id).flatMap(walk)];
    const order = railTrunk.flatMap(walk);
    order.push(...ids.filter((id) => !order.includes(id)));
    rail.innerHTML = `<svg class="rail-tree" aria-hidden="true"></svg><ol class="rail-list">${order.map((id) => {
      const st = STATIONS[id], d = depth(id), more = railKids.get(id).filter((k) => !fixed(k)).length;
      return `<li class="rl-row${d ? ' is-branch' : ''}" style="--d:${d}" data-id="${id}"><button type="button" class="rl-btn" aria-label="${esc(st.title)} – Bildbreite ${esc(fmtLength(st.width))}">
        <span class="rl-dot"></span><span class="rl-txt"><b>${num(id)}</b> ${esc(st.title)}<small>${esc(fmtLength(st.width))}</small></span></button>${more
        ? `<button type="button" class="rl-more" data-n="${more}" aria-expanded="false"></button>` : ''}</li>`;
    }).join('')}</ol>`;
    railSvg = rail.querySelector('.rail-tree');
    rail.querySelectorAll('.rl-row').forEach((li) => {
      const id = li.dataset.id;
      railRows.set(id, li);
      li.firstElementChild.addEventListener('click', () => { h.onInput(); h.onGo(id); });
      li.querySelector('.rl-more')?.addEventListener('click', () => { if (!railOpen.delete(id)) railOpen.add(id); showRail(); });
    });
    showRail();
    document.fonts?.ready.then(layoutRail);
  }
  // Sichtbar: Halte der Route; Abstecher nur, wenn ihre Elternzeile sichtbar und offen ist (Pfad zur aktuellen Station oder „+n“)
  function showRail() {
    const path = new Set();
    for (let x = railCur; x; x = STATIONS[x].parent) path.add(x);
    const open = (id) => path.has(id) || railOpen.has(id);
    const vis = (id) => fixed(id) || (vis(STATIONS[id].parent) && open(STATIONS[id].parent));
    railRows.forEach((li, id) => {
      li.hidden = !vis(id);
      const b = li.querySelector('.rl-more');
      if (!b) return;
      const o = open(id), n = b.dataset.n, t = STATIONS[id].title;
      b.hidden = path.has(id);
      b.textContent = o ? '−' : `+${n}`;
      b.setAttribute('aria-expanded', String(o));
      b.setAttribute('aria-label', `${n} Abstecher von ${t} ${o ? 'zuklappen' : 'aufklappen'}`);
    });
    layoutRail();
  }
  // Linien aus den echten Punkt-Lagen (nach jedem Umbruch neu): Stamm senkrecht, Abzweig als Winkel zu den Kindern
  function layoutRail() {
    const R = rail.getBoundingClientRect();
    if (!R.height || !railRows.size) return;
    const pt = (id) => { const r = railRows.get(id).querySelector('.rl-dot').getBoundingClientRect(); return [r.left + r.width / 2 - R.left, r.top + r.height / 2 - R.top]; };
    const f = (v) => v.toFixed(1);
    const [x0, y0] = pt(railTrunk[0]), [, y1] = pt(railTrunk[railTrunk.length - 1]);
    let d = `M${f(x0)},${f(y0)}V${f(y1)}`;
    const shown = [...railRows.values()].filter((li) => !li.hidden).length;
    railKids.forEach((all, id) => {
      const ks = all.filter((k) => !railRows.get(k).hidden);
      if (!ks.length || railRows.get(id).hidden) return;
      const [px, py] = pt(id), [kx, ky] = pt(ks[0]), [, kyEnd] = pt(ks[ks.length - 1]);
      d += `M${f(px)},${f(py)}V${f((py + ky) / 2)}H${f(kx)}V${f(kyEnd)}`;
    });
    // Weg von der aktuellen Station zur Wurzel: gleiche Linienführung, als zweiter Pfad im Akzent darüber
    let hot = '';
    for (let x = railCur; x && STATIONS[x].parent; x = STATIONS[x].parent) {
      const p = STATIONS[x].parent, [px, py] = pt(p), [kx, ky] = pt(x);
      if (railTrunk.includes(x)) { hot += `M${f(px)},${f(py)}V${f(ky)}`; continue; }
      const [, k0] = pt(railKids.get(p).find((k) => !railRows.get(k).hidden));
      hot += `M${f(px)},${f(py)}V${f((py + k0) / 2)}H${f(kx)}V${f(ky)}`;
    }
    railSvg.innerHTML = `<path d="${d}"/>${hot ? `<path class="is-hot" d="${hot}"/>` : ''}`;
    rail.classList.toggle('is-tight', R.height / shown < 40);
  }

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
    railOpen.clear();
    const up = new Set();
    for (let x = STATIONS[id]?.parent; x; x = STATIONS[x].parent) up.add(x);
    railRows.forEach((li, k) => {
      const cur = k === id, btn = li.firstElementChild;
      li.classList.toggle('is-current', cur);
      li.classList.toggle('is-path', up.has(k));
      if (cur) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
      li.querySelector('small').textContent = fmtLength(STATIONS[k].width);
    });
    railLive = railRows.get(id)?.querySelector('small') || null;
    showRail();
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
    renderPanel();
    buildMarkers();
    closeCard();
  }

  // Schalter der Station: Segment (Standard), Schieberegler ('range'), Farbscheiben mit Erklärung ('swatch': options
  // [wert, name, CSS-Hintergrund], detail(wert) → HTML unter den Scheiben), Knopf ('action': button, run())
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
    return `
        <div class="cfg-row"><span class="cfg-label" id="ctl-${c.id}">${esc(c.label)}</span>
          <div class="seg" role="radiogroup" aria-labelledby="ctl-${c.id}">${c.options.map(([v, l]) => `<button type="button" role="radio" data-ctl="${c.id}" data-val="${v}" aria-checked="${String(c.value === v)}">${esc(l)}</button>`).join('')}</div></div>`;
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
      <p class="lead">${esc(st.lead)}</p>
      <div class="bento">${st.facts.map((f) => `
        <div class="fact"><p class="fact-v${f.v.length > 9 ? ' is-long' : ''}">${esc(f.v)}${f.u ? `<span class="fact-u">${esc(f.u)}</span>` : ''}</p><p class="fact-l">${esc(f.l)}</p></div>`).join('')}
      </div>
      ${lv.live ? '<p class="live" id="live" aria-live="off"></p>' : ''}
      ${lv.widget ? `<div class="widget" id="widget">${lv.widget()}</div>` : ''}
      ${ctrls.length ? `<div class="st-ctrls">${ctrls.map(ctrlHtml).join('')}</div>` : ''}
      <h2 class="sec-h">Entdecken</h2>
      <ul class="explore">${hs.map((x, i) => `
        <li><button type="button" data-hs="${x.id}" class="${x.kind === 'dive' ? 'is-dive' : ''}">${x.kind === 'dive' ? hex('<path d="M14 17l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>', 'hex--mini') : hexNum(i + 1, 'hex--mini')}<span>${esc(info(x).t)}</span>${x.kind === 'dive' ? '<span class="tag">hineinfliegen</span>' : ''}</button></li>`).join('')}
      </ul>
      <details class="note"><summary>Darstellung und Quellen</summary>
        <p>${esc(st.note)}</p>
        <ol class="sources">${st.sources.map((s) => `<li><a href="${SOURCES[s].url}" target="_blank" rel="noopener">${esc(SOURCES[s].t)}</a><span>${esc(SOURCES[s].by)}</span></li>`).join('')}</ol>
      </details>`;
    liveEl = panel.querySelector('#live');
    widgetEl = panel.querySelector('#widget');
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
    if (railLive) railLive.textContent = fmtLength(widthM);
  }

  // ---------- Flug, Kapitel-Titel, Auftakt ----------
  let capTimer = 0;
  function showCaption(st, opening = false) {
    caption.querySelector('.cap-n').textContent = opening ? 'Kosmos' : String(st.n).padStart(2, '0');
    caption.querySelector('.cap-title').textContent = opening ? 'Reise durch das All' : st.title;
    caption.querySelector('.cap-sub').textContent = opening
      ? 'Von der Erde bis an den Rand des beobachtbaren Universums'
      : `${st.kicker} · Bildbreite ${fmtLength(st.width)}${st.dist ? ` · ${fmtLength(st.dist)} entfernt` : ''}`;
    caption.classList.remove('is-on');
    void caption.offsetWidth;
    caption.classList.add('is-on');
    clearTimeout(capTimer);
    capTimer = setTimeout(() => {
      caption.classList.remove('is-on');
      if (opening) setTimeout(() => showCaption(st), 1400);
    }, opening ? 4200 : 3600);
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
  return {
    setStation, update, setScale, setPull, stageRect, setFlight,
    caption: (st, opening) => showCaption(st, opening),
    hideMarkers: (on) => { layer.classList.toggle('is-hidden', on); if (on) closeCard(); },
    setLoading: (on) => body.classList.toggle('is-loading', on),
    setRouteTarget: (id) => route.querySelectorAll('button').forEach((b) => b.classList.toggle('is-target', b.dataset.id === id)),
    intro: (on) => body.classList.toggle('is-intro', on),
    // offene Karte: main.js hält die Leerlauf-Fahrt an, damit das Bild beim Lesen ruht
    reading: () => card.classList.contains('is-open'),
    relayout: () => { layoutRail(); markers.forEach((m) => { m.w = 0; }); dock = null; },
  };
}
