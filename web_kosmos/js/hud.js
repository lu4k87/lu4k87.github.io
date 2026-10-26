// Bedienoberfläche über der 3D-Szene: Größenskala (links, logarithmisch, Einheiten-Klammern, Marke = aktuelle
// Bildbreite), Infotafel (rechts: Kennzahlen-Bento, Schalter der Station, Entdecken-Liste, Darstellung + Quellen),
// Abzeichen mit gewinkelten 45°-Leitlinien (Sechseck wie Biochar), Info-Karte, Messleiste (Bildbreite, Lichtlaufzeit,
// Entfernung, Blick zurück), Reiseroute, Kapitel-Titel beim Ankommen, Rand-Zug-Anzeige.

import { STATIONS, ROUTE, SOURCES, routeIndex } from './content.js';
import { fmtLength, fmtTime, C, LY } from './astro.js';
import { settings, setSetting, mountSettings, onSettings } from './settings.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const HEX = 'M20 2L35.59 11L35.59 29L20 38L4.41 29L4.41 11z';
const hex = (inner = '', cls = '') => `<svg class="hex ${cls}" viewBox="0 0 40 40" aria-hidden="true"><path class="hex-shape" d="${HEX}"/>${inner}</svg>`;
const hexNum = (n, cls) => hex(`<text x="20" y="24.5" text-anchor="middle">${String(n).padStart(2, '0')}</text>`, cls);

// Größenskala: 10⁶ m (unten) … 10²⁷·³ m (oben); Klammern nach der Einheit, in der die Messleiste gerade zählt
const LOG_BOT = 6, LOG_TOP = 27.3;
const railFrac = (m) => Math.min(1, Math.max(0, (Math.log10(m) - LOG_BOT) / (LOG_TOP - LOG_BOT)));
const ZONES = [
  { l: 'km', a: 6, b: 9 }, { l: 'AE', a: 9, b: Math.log10(0.05 * LY) },
  { l: 'Lichtjahre', a: Math.log10(0.05 * LY), b: Math.log10(1e6 * LY) },
  { l: 'Mio. Lj', a: Math.log10(1e6 * LY), b: Math.log10(1e9 * LY) }, { l: 'Mrd. Lj', a: Math.log10(1e9 * LY), b: LOG_TOP },
];

export function createHud(h) {
  const body = document.body;
  const rail = $('#rail'), panel = $('#panel-body'), layer = $('#hotspots'), svg = layer.querySelector('svg');
  const leads = svg.querySelector('.leads'), card = $('#hs-card'), caption = $('#caption'), route = $('#route');
  const pull = $('#pull'), btnOut = $('#btn-out'), btnNext = $('#btn-next'), btnPrev = $('#btn-prev');
  const mWidth = $('#m-width'), mLight = $('#m-light'), mDist = $('#m-dist'), mBack = $('#m-back');
  let lv = null, meta = null, markers = [], selected = null, liveEl = null, widgetEl = null, liveT = 0;

  mountSettings($('#cfg'), $('#btn-cfg'));
  onSettings((keys) => { if (keys.includes('panel')) { body.classList.toggle('panel-off', !settings.S.panel); h.onRelayout(); } });
  body.classList.toggle('panel-off', !settings.S.panel);
  $('#btn-panel').addEventListener('click', () => setSetting('panel', !settings.S.panel));

  // ---------- Größenskala ----------
  const railTicks = new Map();
  function buildRail() {
    const ids = Object.keys(STATIONS);
    rail.innerHTML = `
      <div class="rail-zones">${ZONES.map((z) => `<span class="rail-zone" style="--a:${railFrac(10 ** z.a)};--b:${railFrac(10 ** z.b)}"><i>${z.l}</i></span>`).join('')}</div>
      <div class="rail-line"></div>
      <div class="rail-now" id="rail-now"><span id="rail-now-v">–</span></div>
      ${ids.map((id) => {
        const st = STATIONS[id];
        const side = ROUTE.indexOf(id) >= 0 && ['orion', 'crab', 'pulsar', 'sgra'].includes(id) ? 'is-branch' : '';
        return `<button type="button" class="rail-st ${side}" data-id="${id}" style="--f:${railFrac(st.width)}" aria-label="${esc(st.title)} – Bildbreite ${esc(fmtLength(st.width))}">
          <span class="rail-tick"></span><span class="rail-name"><b>${String(st.n).padStart(2, '0')}</b> ${esc(st.title)}</span></button>`;
      }).join('')}`;
    rail.querySelectorAll('.rail-st').forEach((b) => {
      railTicks.set(b.dataset.id, b);
      b.addEventListener('click', () => { h.onInput(); h.onGo(b.dataset.id); });
    });
    layoutRail();
  }
  // Namen dürfen sich nicht überdecken: von unten nach oben mit Mindestabstand schieben (Marke bleibt am echten Ort)
  function layoutRail() {
    const H = rail.clientHeight || 1;
    const gap = 21;
    const items = [...railTicks.values()].map((b) => ({ b, y: (1 - +b.style.getPropertyValue('--f')) * H })).sort((a, b) => b.y - a.y);
    let last = Infinity;
    for (const it of items) {
      const y = Math.min(it.y, last - gap);
      it.b.style.setProperty('--dy', `${(y - it.y).toFixed(1)}px`);
      last = y;
    }
  }
  const railNow = () => $('#rail-now');

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
    railTicks.forEach((b, k) => b.classList.toggle('is-current', k === id));
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

  function renderPanel() {
    const st = meta;
    const info = (x) => st.hotspots[x.id] || x.info;
    const hs = lv.hotspots.filter((x) => info(x) && x.kind !== 'label' && (!x.listIf || x.listIf()));
    const ctrls = lv.controls || [];
    panel.innerHTML = `
      <p class="kicker"><span class="kick-n">${String(st.n).padStart(2, '0')}</span>${esc(st.kicker)}</p>
      <h1 class="st-title">${esc(st.title)}</h1>
      <p class="lead">${esc(st.lead)}</p>
      <div class="bento">${st.facts.map((f) => `
        <div class="fact"><p class="fact-v${f.v.length > 9 ? ' is-long' : ''}">${esc(f.v)}${f.u ? `<span class="fact-u">${esc(f.u)}</span>` : ''}</p><p class="fact-l">${esc(f.l)}</p></div>`).join('')}
      </div>
      ${lv.live ? '<p class="live" id="live" aria-live="off"></p>' : ''}
      ${lv.widget ? `<div class="widget" id="widget">${lv.widget()}</div>` : ''}
      ${ctrls.length ? `<div class="st-ctrls">${ctrls.map((c) => c.type === 'range' ? `
        <label class="cfg-row cfg-range"><span class="cfg-label">${esc(c.label)}</span>
          <input type="range" data-rng="${c.id}" min="${c.min}" max="${c.max}" step="${c.step ?? 1}" value="${c.value}" aria-label="${esc(c.label)}"><output data-rout="${c.id}">${esc(c.fmt ? c.fmt(c.value) : c.value)}</output></label>` : `
        <div class="cfg-row"><span class="cfg-label" id="ctl-${c.id}">${esc(c.label)}</span>
          <div class="seg" role="radiogroup" aria-labelledby="ctl-${c.id}">${c.options.map(([v, l]) => `<button type="button" role="radio" data-ctl="${c.id}" data-val="${v}" aria-checked="${String(c.value === v)}">${esc(l)}</button>`).join('')}</div></div>`).join('')}</div>` : ''}
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
  }

  // ---------- Abzeichen ----------
  function buildMarkers() {
    markers.forEach((m) => { m.el.remove(); m.dot.remove(); });
    leads.innerHTML = '';
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
  }

  function pick(id) {
    h.onInput();
    const x = lv.hotspots.find((k) => k.id === id);
    if (!x) return;
    if (x.kind === 'dive') { closeCard(); h.onDive(x); return; }
    if (x.focus) h.onFocus(x);
    selected = id;
    const t = meta.hotspots[id] || x.info;
    card.querySelector('.hs-card-title').innerHTML = `${hex('', 'hex--mini')}<span>${esc(t.t)}</span>`;
    card.querySelector('.hs-card-text').textContent = t.x;
    const src = SOURCES[t.s];
    card.querySelector('.hs-card-src').innerHTML = src ? `Quelle: <a href="${src.url}" target="_blank" rel="noopener">${esc(src.by)}</a>` : '';
    card.classList.add('is-open');
    markers.forEach((m) => m.el.classList.toggle('is-active', m.x.id === id));
    panel.querySelectorAll('[data-hs]').forEach((b) => b.classList.toggle('is-active', b.dataset.hs === id));
  }
  function closeCard() {
    selected = null;
    card.classList.remove('is-open');
    markers.forEach((m) => m.el.classList.remove('is-active'));
    panel.querySelectorAll('[data-hs].is-active').forEach((b) => b.classList.remove('is-active'));
  }

  // Lage je Bild: Punkt am Objekt, Abzeichen schräg daneben (45°-Knick), frei von Karte, Kapitel-Titel, Rändern und
  // anderen Abzeichen; einmal gefundene Lage (Seite + Reichweite) bleibt, solange sie frei ist – kein Springen
  const OFFS = [[1, -1], [-1, -1], [1, 1], [-1, 1]];
  function update(camera, level, time) {
    if (!markers.length || layer.classList.contains('is-hidden')) { tickLive(time); return; }
    const W = window.innerWidth, H = window.innerHeight;
    const r = stageRect();
    const cr = card.classList.contains('is-open') ? card.getBoundingClientRect() : null;
    const boxes = cr ? [{ l: cr.left - 8, r: cr.right + 8, t: cr.top - 8, b: cr.bottom + 8 }] : [];
    if (caption.classList.contains('is-on')) {
      for (const el of caption.children) {
        const b = el.getBoundingClientRect();
        if (b.width) boxes.push({ l: b.left - 6, r: b.right + 6, t: b.top - 4, b: b.bottom + 4 });
      }
    }
    const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    const cx = (r.x0 + r.x1) / 2;
    for (const m of markers) {
      const p = m.x.pos.clone().project(camera);
      const ax = (p.x + 1) / 2 * W, ay = (1 - p.y) / 2 * H;
      const vis = p.z < 1 && ax > r.x0 + 4 && ax < r.x1 - 4 && ay > r.y0 + 4 && ay < r.y1 - 4 && (!m.x.visible || m.x.visible(camera));
      if (!vis) { hide(m); continue; }
      if (!m.w) { m.w = m.el.offsetWidth; m.hgt = m.el.offsetHeight; }
      m.dot.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
      m.dot.classList.remove('is-off');
      if (m.label) {
        const bx = ax + 10, by = ay - m.hgt / 2;
        const box = { l: bx, r: bx + m.w, t: by, b: by + m.hgt };
        if (box.r > r.x1 || boxes.some((b) => hit(box, b))) { m.el.classList.add('is-off'); continue; }
        boxes.push(box);
        m.el.classList.remove('is-off');
        m.el.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px)`;
        continue;
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
      if (!placed) { hide(m, true); continue; }
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
    }
    tickLive(time);
  }
  function hide(m, keepDot = false) {
    m.el.classList.add('is-off');
    if (m.path) m.path.classList.add('is-off');
    if (!keepDot) m.dot.classList.add('is-off');
  }
  function tickLive(time) {
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
    const now = railNow();
    if (now) {
      now.style.setProperty('--f', railFrac(widthM));
      $('#rail-now-v').textContent = fmtLength(widthM);
    }
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
    if (on) pull.classList.remove('is-on');
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
    relayout: () => { layoutRail(); markers.forEach((m) => { m.w = 0; }); },
  };
}
