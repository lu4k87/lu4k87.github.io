// Bedienoberfläche über der 3D-Szene: Zoom-Schiene (vertikal, log-Skala, ziehbar), Infotafel, Hotspots mit
// Info-Karte, REM-Datenleiste, Pyrolyse-Zeitleiste im Bild. Bildsprache: Hexagon-Badge direkt neben dem Objekt, beim Klick
// eine Karte links davon.

import { LEVELS, SOURCES } from './content.js';
import { xrd, xrdCurve, raman, ramanCurve } from './nanolab.js';
import { properties, labProps, pyroState, fmt, T_MIN, T_MAX, T_ROOM, PHASES, fillDiameterNm, kelvinRh, filledShare, isotherm, poreClass, nanoStructure, tissueScale } from './science.js';
import { hexBadge, HEX, LEVEL_ICONS, HOTSPOT_ICONS } from './icons.js';

const $ = (sel) => document.querySelector(sel);
// Zahlenbereiche wie „2–50 nm“ nie nach dem Strich umbrechen (Wortverbinder U+2060)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/(\d)–(?=\d)/g, '$1–\u2060');

// Zoom-Schiene: Bildbreite in Metern, logarithmisch von 20 cm (oben) bis 0,5 nm (unten)
const SCALE_M = { piece: 4e-2, tissue: 1e-3, cells: 2e-4, wall: 2.5e-5, meso: 3e-7, micro: 1e-8, atoms: 2e-9 };
const LOG_TOP = Math.log10(0.2);
const LOG_BOT = Math.log10(5e-10);
const railFrac = (m) => Math.min(1, Math.max(0, (Math.log10(m) - LOG_TOP) / (LOG_BOT - LOG_TOP)));
const railMeters = (f) => Math.pow(10, LOG_TOP + (LOG_BOT - LOG_TOP) * f);

export function createHud(handlers) {
  const rail = $('#ladder');
  const panel = $('#panel-body');
  const layer = $('#hotspots');
  // Detektor-Spalte der Messleiste (nur Ebenen mit lv.detector): SE | BSE → main.js onDetector, Methode-Text wechselt mit
  const detCol = $('#sb-det');
  detCol.querySelectorAll('button[data-det]').forEach((b) => b.addEventListener('click', () => {
    detCol.querySelectorAll('button[data-det]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    handlers.onDetector(b.dataset.det);
  }));
  // Info-Karte: erscheint beim Klick links neben dem gewählten Abzeichen und folgt ihm (eine Karte, je Auswahl neu gefüllt)
  const card = document.createElement('aside');
  card.className = 'hs-card';
  card.setAttribute('aria-live', 'polite');
  const meter = $('#edge-meter');
  let markers = [];
  let current = -1;
  let level = null;
  let selected = null;
  let lastState = null;

  // ---------- Zoom-Schiene ----------
  const ZONES = [
    { label: 'MAKRO', y0: 2, y1: 18 },
    { label: 'REM', y0: 22, y1: 54 },
    { label: 'NANO', y0: 58, y1: 96 },
  ];
  rail.innerHTML = `
    <div class="rail-zones" aria-hidden="true">${ZONES.map((z) =>
      `<span class="rail-zone" style="top:${z.y0}%;height:${z.y1 - z.y0}%"><i>${z.label}</i></span>`).join('')}</div>
    <div class="rail-track"></div>
    <div class="rail-range"></div>
    <div class="rail-scan"></div>
    <div class="rail-hit"></div>
    ${LEVELS.map((l, i) => `
      <button type="button" class="rail-level" data-level="${i}" style="--y:${(railFrac(SCALE_M[l.id]) * 100).toFixed(2)}%;--f:${railFrac(SCALE_M[l.id]).toFixed(3)};--i:${i}"
        aria-label="Ebene ${i + 1}: ${esc(l.title)}, ${esc(l.scale)} (${esc(l.compare)})">
        <span class="rail-mark">${hexBadge(LEVEL_ICONS[l.id], 'hex--rail')}<svg class="rail-ring" viewBox="0 0 40 40" aria-hidden="true"><path d="${HEX}"/></svg></span>
        <span class="rail-text"><span class="rail-scale">${esc(l.scale)} <i class="rail-cmp">${esc(l.compare)}</i></span><span class="rail-name">${esc(l.name)}</span></span>
      </button>`).join('')}
    <div class="rail-knob" aria-hidden="true"><span class="rail-knob-dot"></span><span class="rail-knob-label">–</span></div>
    <label class="visually-hidden">Vergrößerung<input type="range" class="rail-input" min="0" max="1000" step="1" value="0"></label>`;
  const track = rail.querySelector('.rail-track');
  const range = rail.querySelector('.rail-range');
  const knob = rail.querySelector('.rail-knob');
  const knobLabel = rail.querySelector('.rail-knob-label');
  const railInput = rail.querySelector('.rail-input');
  const levelButtons = [...rail.querySelectorAll('.rail-level')];
  let dragging = false;
  let railLimits = null;    // Bildbreiten am Zoom-Anschlag der aktuellen Ebene

  rail.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-level]');
    if (b) handlers.onJump(+b.dataset.level);
  });
  const fracAt = (clientY) => {
    const r = track.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientY - r.top) / r.height));
  };
  const setKnob = (f) => {
    knob.style.setProperty('--y', `${(f * 100).toFixed(3)}%`);
    railInput.value = Math.round(f * 1000);
  };
  const pullHint = (m) => {
    // über den Anschlag hinaus gezogen → Nachbar-Marke leuchtet als Ziel
    levelButtons.forEach((b) => b.classList.remove('is-pull'));
    if (!railLimits) return;
    if (m > railLimits.max * 1.05 && current > 0) levelButtons[current - 1].classList.add('is-pull');
    if (m < railLimits.min * 0.95 && level && level.hotspots.some((h) => h.kind === 'dive')) levelButtons[current + 1].classList.add('is-pull');
  };
  const onDrag = (e, phase) => {
    const f = fracAt(e.clientY);
    const m = railMeters(f);
    setKnob(f);
    knobLabel.textContent = formatLength(m, true);
    pullHint(m);
    handlers.onRail(m, phase);
    if (phase === 'end') levelButtons.forEach((b) => b.classList.remove('is-pull'));
  };
  for (const el of [rail.querySelector('.rail-hit'), knob]) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      rail.classList.add('is-dragging');
      el.setPointerCapture(e.pointerId);
      onDrag(e, 'move');
    });
    el.addEventListener('pointermove', (e) => { if (dragging) onDrag(e, 'move'); });
    const stop = (e) => {
      if (!dragging) return;
      dragging = false;
      rail.classList.remove('is-dragging');
      onDrag(e, 'end');
    };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
  }
  railInput.addEventListener('input', () => handlers.onRail(railMeters(+railInput.value / 1000), 'move'));
  railInput.addEventListener('change', () => handlers.onRail(railMeters(+railInput.value / 1000), 'end'));

  // ---------- Infotafel & Kopf-Aktionen ----------
  // Ebenen-Wechsel: Hex-Marke wie an der Schiene (zurück = gedreht), darunter das Ziel als „Maßstab · Name (×Faktor)“
  for (const id of ['#btn-up', '#btn-down']) $(id).insertAdjacentHTML('afterbegin', hexBadge('dive', 'hex--nav'));
  const setNavTargets = (i) => {
    const up = LEVELS[i - 1], down = LEVELS[i + 1], cur = LEVELS[i];
    const fUp = up && cur ? Math.round(SCALE_M[up.id] / SCALE_M[cur.id]) : 0;
    const fDown = down && cur ? Math.round(SCALE_M[cur.id] / SCALE_M[down.id]) : 0;
    $('#nav-up-to').textContent = up ? `${up.scale} · ${up.name} (÷${fUp})` : '–';
    $('#nav-down-to').textContent = down ? `${down.scale} · ${down.name} (×${fDown} ↓)` : '–';
  };
  $('#btn-up').addEventListener('click', () => handlers.onUp());
  $('#btn-down').addEventListener('click', () => handlers.onDown());

  function factBarPct(f) {
    if (typeof f.bar === 'number') return f.bar;
    const s = String(f.value).replace(',', '.');
    const m = s.match(/(\d+(?:\.\d+)?)/);
    if (!m) return 52;
    const v = parseFloat(m[1]);
    if (s.includes('%')) return Math.min(100, Math.max(8, Math.round(v)));
    return Math.min(92, Math.max(18, Math.round((Math.log10(Math.max(0.1, v)) + 1) * 28)));
  }

  const fmtFactVal = (val) => String(val).split(' · ').map((s) => `<span>${esc(s)}</span>`).join(' · ');
  function facts(list) {
    return `<div class="facts">${list.map((f) => `
      <div class="fact">
        <div class="fact-text">
          <span class="fact-value">${fmtFactVal(f.value)}</span>
          <span class="fact-label">${esc(f.label)}</span>
          <span class="fact-bar" aria-hidden="true"><i style="width:${factBarPct(f)}%"></i></span>
        </div>
      </div>`).join('')}</div>`;
  }

  // Laborwerte: [Schlüssel, Name, Wert, Warnung, Balken-%] – gleiche Quelle für Aufbau und laufende Aktualisierung;
  // kurze Namen für die 3 × 3 Kacheln (Panel:B), Langform steht in der Erläuterung unter „Verlauf H/C“;
  // Zahl und Einheit hängen per geschütztem Leerzeichen zusammen, umbrechen darf die Kachel nur nach „≈“
  function labRows(t) {
    const p = labProps(t);
    const dash = '–';
    const cl = (v) => Math.min(100, Math.max(0, v));
    return [
      ['yield', 'Ausbeute', `${fmt(p.yield)}\u00a0%`, false, cl(p.yield)],
      ['carbon', 'Kohlenstoff', `${fmt(p.carbon)}\u00a0%`, false, cl(p.carbon)],
      ['hc', 'H/C < 0,7', `${fmt(p.hc, 2)} ${p.hc < 0.7 ? '✓' : '⚠'}`, p.hc >= 0.7, cl((p.hc / 1.55) * 100)],
      ['oc', 'O/C < 0,4', `${fmt(p.oc, 2)} ${p.oc < 0.4 ? '✓' : '⚠'}`, p.oc >= 0.4, cl((p.oc / 0.85) * 100)],
      ['bet', 'BET-Fläche', `≈ ${fmt(p.bet)}\u00a0m²/g`, false, cl(Math.max(2, (p.bet / 400) * 100))],
      ['ph', 'pH-Wert', fmt(p.ph, 1), false, cl(((p.ph - 4) / 7) * 100)],
      ['fperm', 'C nach 100 J.', p.fperm === null ? dash : `${fmt(p.fperm * 100)}\u00a0%`, false, p.fperm === null ? 0 : cl(p.fperm * 100)],
      ['co2', 'CO₂ gebunden', p.co2 === null ? dash : `${fmt(p.co2, 1)}\u00a0t/t`, false, p.co2 === null ? 0 : cl((p.co2 / 3.2) * 100)],
      ['cls', 'Strukturtyp', p.charClass, false, null],
    ];
  }

  function labTiles(t) {
    const cell = ([k, name, v, warn, bar]) => `<div class="lab-cell${warn ? ' warn' : ''}" data-f="${k}"><dt>${name}</dt><dd><span class="lab-val">${v}</span>${bar !== null ? `<span class="lab-bar" aria-hidden="true"><i style="width:${bar.toFixed(1)}%"></i></span>` : ''}</dd></div>`;
    return `<dl class="lab">${labRows(t).map(cell).join('')}</dl>`;
  }
  const LAB_NOTE = 'Werte bei der gezeigten Temperatur, Richtwerte für Holz, langsame Pyrolyse – reale Kohlen streuen je Rohstoff und Verfahren. Unter 350 °C Übergang vom Holz (Modell). H/C und O/C: molare Verhältnisse H/Corg und O/Corg mit EBC-Grenzwerten. C nach 100 Jahren: Anteil des Kohlenstoffs, der im Boden bleibt (IPCC). CO₂ gebunden: t CO₂ je t Biochar = C-Gehalt × IPCC-Faktor × 44/12. Strukturtyp nach Keiluweit 2010.';

  // Kurve H/Corg über der Temperatur mit EBC-Grenze 0,7 und Marke für die gezeigte Temperatur
  const CH = { w: 240, h: 96, x0: 30, x1: 232, y0: 8, y1: 76 };
  const chX = (t) => CH.x0 + ((Math.min(T_MAX, Math.max(T_MIN, t)) - T_MIN) / (T_MAX - T_MIN)) * (CH.x1 - CH.x0);
  const chY = (hc) => CH.y1 - (Math.min(1, hc) / 1) * (CH.y1 - CH.y0);
  function labChart(t) {
    let d = '';
    for (let T = T_MIN; T <= T_MAX; T += 25) d += `${d ? 'L' : 'M'}${chX(T).toFixed(1)} ${chY(properties(T).hc).toFixed(1)}`;
    const ebc = chY(0.7);
    return `
      <figure class="chart">
        <svg viewBox="0 0 ${CH.w} ${CH.h}" role="img" aria-label="H/Corg über der Pyrolysetemperatur, EBC-Grenze 0,7">
          <line class="ax" x1="${CH.x0}" y1="${CH.y1}" x2="${CH.x1}" y2="${CH.y1}"/>
          <line class="ax" x1="${CH.x0}" y1="${CH.y0}" x2="${CH.x0}" y2="${CH.y1}"/>
          <line class="ebc" x1="${CH.x0}" y1="${ebc}" x2="${CH.x1}" y2="${ebc}"/>
          <text class="lbl" x="${CH.x1}" y="${ebc - 3}" text-anchor="end">EBC-Grenze 0,7</text>
          <path class="curve" d="${d}"/>
          <line class="cur" id="chart-cur" x1="${chX(t)}" y1="${CH.y0}" x2="${chX(t)}" y2="${CH.y1}"/>
          <circle class="dot" id="chart-dot" r="3.4" cx="${chX(t)}" cy="${chY(labProps(t).hc)}"/>
          <text class="lbl" x="${CH.x0}" y="${CH.y1 + 12}" text-anchor="middle">350</text>
          <text class="lbl" x="${CH.x1}" y="${CH.y1 + 12}" text-anchor="end">800 °C</text>
          <text class="lbl" x="${CH.x0 - 4}" y="${chY(0.75) + 3}" text-anchor="end">0,75</text>
          <text class="lbl" x="${CH.x0 - 4}" y="${CH.y1}" text-anchor="end">0</text>
        </svg>
        <figcaption class="note">H/Corg über der Temperatur – unterhalb von 0,7 erfüllt die Kohle den EBC-Grenzwert.</figcaption>
      </figure>`;
  }

  // Luftfeuchte (Ebene 5): Porenklassen-Skala unter dem Regler (Füllen nach Kelvin), Anzeige „gefüllt bis Ø“, Mini-Isotherme
  // aufklappbar (User 2026-10-25, Tafel ohne Scrollen)
  // (Modell) mit Füll- und Entleerungsast; der Punkt folgt dem Regler, beim Zurückdrehen bleibt er auf dem Entleerungsast
  const RH_MAX = 0.99, WET_BAR_NM = 60;
  const IS = { w: 240, h: 92, x0: 14, x1: 232, y0: 8, y1: 74 };
  const isX = (rh) => IS.x0 + (rh / RH_MAX) * (IS.x1 - IS.x0);
  const isY = (f) => IS.y1 - f * (IS.y1 - IS.y0);
  const isPath = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${isX(x).toFixed(1)} ${isY(y).toFixed(1)}`).join('');
  const hyst = (rh, d) => d > fillDiameterNm(rh) + 0.5;
  const wetNote = (rh, d) => (hyst(rh, d) ? 'Beim Trocknen halten die Poren das Wasser länger: Hysterese (Modell).' : 'Kleinste Poren füllen sich zuerst (Kelvin-Gleichung).');
  function rhBlock(rh, d) {
    const m1 = kelvinRh(2) / RH_MAX, m2 = kelvinRh(50) / RH_MAX;
    const iso = isotherm();
    return `
        <div class="rh">
          <label class="slider">
            <span>Relative Luftfeuchte <output id="out-rh">${fmt(rh * 100)} %</output></span>
            <input id="in-rh" type="range" min="0" max="${RH_MAX}" step="0.01" value="${rh}">
          </label>
          <div class="rh-scale" aria-hidden="true"><i class="pc-micro" style="flex:${m1.toFixed(3)}"></i><i class="pc-meso" style="flex:${(m2 - m1).toFixed(3)}"></i><i class="pc-macro" style="flex:${(1 - m2).toFixed(3)}"></i></div>
          <p class="rh-legend"><span><i class="pc-micro"></i>Mikro &lt; 2 nm · bis ${fmt(kelvinRh(2) * 100)} %</span><span><i class="pc-meso"></i>Meso 2–50 nm · bis ${fmt(kelvinRh(50) * 100)} %</span><span><i class="pc-macro"></i>Makro</span></p>
          <div class="rh-fill">
            <span class="rh-fill-head">Poren gefüllt bis <output id="out-wet">Ø ${fmt(d)} nm</output></span>
            <span class="rh-bar"><i id="rh-bar" style="width:${Math.min(100, (d / WET_BAR_NM) * 100).toFixed(1)}%"></i></span>
            <p class="note" id="rh-note">${wetNote(rh, d)}</p>
          </div>
          <details class="lab-more">
          <summary>Isotherme · Erläuterung</summary>
          <figure class="chart">
            <svg viewBox="0 0 ${IS.w} ${IS.h}" role="img" aria-label="Isotherme (Modell): gefüllter Porenanteil über der relativen Luftfeuchte, Füll- und Entleerungsast">
              <line class="ax" x1="${IS.x0}" y1="${IS.y1}" x2="${IS.x1}" y2="${IS.y1}"/>
              <line class="ax" x1="${IS.x0}" y1="${IS.y0}" x2="${IS.x0}" y2="${IS.y1}"/>
              <path class="curve curve--des" d="${isPath(iso.des)}"/>
              <path class="curve" d="${isPath(iso.ads)}"/>
              <circle class="dot" id="iso-dot" r="3.4" cx="${isX(rh).toFixed(1)}" cy="${isY(filledShare(d)).toFixed(1)}"/>
              <text class="lbl" x="${IS.x0 + 4}" y="${IS.y0 + 6}">gefüllt</text>
              <text class="lbl" x="${IS.x0}" y="${IS.y1 + 12}" text-anchor="middle">0</text>
              <text class="lbl" x="${(IS.x0 + IS.x1) / 2}" y="${IS.y1 + 12}" text-anchor="middle">Isotherme · Modell</text>
              <text class="lbl" x="${IS.x1}" y="${IS.y1 + 12}" text-anchor="end">p/p₀</text>
            </svg>
            <figcaption class="note">Füllen (durchgezogen) und Entleeren (gestrichelt): Beim Trocknen geben die Poren das Wasser erst bei tieferer Feuchte wieder ab (Modell nach Cohan 1938).</figcaption>
          </figure>
          </details>
        </div>`;
  }
  function updateRh(rh, d) {
    panel.querySelector('#out-rh').textContent = `${fmt(rh * 100)} %`;
    panel.querySelector('#out-wet').textContent = `Ø ${fmt(d)} nm`;
    panel.querySelector('#rh-bar').style.width = `${Math.min(100, (d / WET_BAR_NM) * 100).toFixed(1)}%`;
    const note = panel.querySelector('#rh-note'), txt = wetNote(rh, d);
    if (note.textContent !== txt) note.textContent = txt;
    const dot = panel.querySelector('#iso-dot');
    dot.setAttribute('cx', isX(rh).toFixed(1));
    dot.setAttribute('cy', isY(filledShare(d)).toFixed(1));
  }
  // Abzeichen „Kapillarkondensation“: ein weicher Ring (900 ms), sobald eine andere Porenklasse füllt oder leer läuft
  function pulse(id) {
    const m = markers.find((x) => x.h.id === id);
    if (!m) return;
    m.el.classList.remove('is-pulse');
    void m.el.offsetWidth;
    m.el.classList.add('is-pulse');
  }

  // ---------- Pyrolyse-Zeitleiste unten in der 3D-Ansicht (Vorschau Pyro:A, User 2026-10-24) ----------
  // Spur = Temperaturachse T_ROOM … T_MAX, je Phase ein Kapitel in echter Breite, durchlaufener Anteil in Phasenfarbe;
  // Punkt = gezeigte Temperatur, Dreieck = Ziel (darüber ein unsichtbares Range-Feld: Ziehen, Klick, Tastatur,
  // Bildschirmleser), Strich = Grenze Holz | Pflanzenkohle. Klick auf ein Kapitel springt an den Phasenbeginn.
  const PHASE_SHORT = ['Aufheizen', 'Trocknung', 'Hemizellulose', 'Zellulose', 'Lignin', 'Aromatisierung'];
  const PHASE_COLORS = ['#6aa6ff', '#9cc7d8', '#ffcf5a', '#ffa040', '#ff7a2e', '#ff3d2e'];
  const PHASE_FROM = PHASES.map((p, i) => (i ? PHASES[i - 1].to : T_ROOM));
  const PHASE_SPANS = PHASES.map((p, i) => Math.min(p.to, T_MAX) - PHASE_FROM[i]);
  const phaseIndex = (T) => PHASES.findIndex((p) => T < p.to);
  const tempText = (T) => `${fmt(T)} °C, ${pyroState(T).phase}`;
  const pct = (T) => `${(((T - T_ROOM) / (T_MAX - T_ROOM)) * 100).toFixed(2)}%`;
  const cols = PHASE_SPANS.map((w) => `${w}fr`).join(' ');
  const GRIP = `<svg viewBox="0 0 10 16" aria-hidden="true">${[3, 8, 13].map((y) => `<circle cx="2.5" cy="${y}" r="1.4"/><circle cx="7.5" cy="${y}" r="1.4"/>`).join('')}</svg>`;
  const tl = $('#pyro-tl');
  tl.innerHTML = `
    <div class="tl-move">
      <button type="button" class="tl-grip" aria-label="Zeitleiste verschieben: Pfeiltasten, Pos1 = Standardplatz" title="Ziehen verschiebt die Leiste · Doppelklick: Standardplatz">${GRIP}</button>
      <button type="button" class="tl-reset" aria-label="Zeitleiste zurück an den Standardplatz" title="Zurück an den Standardplatz">⟲</button>
    </div>
    <button type="button" class="tl-play" id="btn-play" aria-pressed="false" aria-label="Pyrolyse abspielen">▶</button>
    <div class="tl-main">
      <p class="tl-head"><output id="tl-T"></output><b id="tl-phase"></b><span id="tl-gas"></span><span class="tl-goal-text">Ziel <output id="tl-goal-T"></output></span></p>
      <div class="tl-track" style="grid-template-columns:${cols}">
        ${PHASE_COLORS.map((c) => `<i style="--c:${c}"></i>`).join('')}
        <span class="tl-char" style="left:${pct(T_MIN)}"></span>
        <span class="tl-now"></span>
        <span class="tl-goal"></span>
        <input id="in-temp" type="range" min="${T_ROOM}" max="${T_MAX}" step="5" aria-label="Zieltemperatur">
      </div>
      <div class="tl-chapters" style="grid-template-columns:${cols}">${PHASES.map((p, i) =>
        `<button type="button" data-k="${i}" aria-label="${esc(`${p.name}: an den Beginn bei ${fmt(PHASE_FROM[i])} °C springen`)}">${PHASE_SHORT[i]}</button>`).join('')}</div>
    </div>`;
  const tlEl = (sel) => tl.querySelector(sel);
  const segs = [...tl.querySelectorAll('.tl-track i')], chapters = [...tl.querySelectorAll('.tl-chapters button')];
  const playBtn = tlEl('#btn-play'), goalIn = tlEl('#in-temp');
  function setGoal(T) {
    goalIn.value = T;
    goalIn.setAttribute('aria-valuetext', tempText(T));
    tlEl('.tl-goal').style.left = pct(T);
    tlEl('#tl-goal-T').textContent = `${fmt(T)} °C`;
  }
  goalIn.addEventListener('input', () => {
    setGoal(+goalIn.value);
    handlers.onTemp(+goalIn.value);       // die Anzeige gleitet über setLive() mit der Szene
  });
  goalIn.addEventListener('change', () => refreshFacts());
  playBtn.addEventListener('click', () => handlers.onPlay());
  tlEl('.tl-chapters').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]');
    if (b) handlers.onSeek(PHASE_FROM[+b.dataset.k]);
  });

  // Verschieben am Griff (Pointer Events, Pfeiltasten): Versatz zum Standardplatz in der Fußleiste, immer ganz in Bühne
  // oder Fußleiste; Lage bleibt im Browser gespeichert. Doppelklick, ⟲ oder Pos1 = Standardplatz
  const TL_KEY = 'biochar.timeline-dock';   // neuer Schlüssel: alte Versätze galten zum früheren Platz in der Bühne
  const grip = tlEl('.tl-grip');
  let tlOff = { x: 0, y: 0 }, tlDrag = null;
  try { tlOff = { ...tlOff, ...JSON.parse(localStorage.getItem(TL_KEY)) }; } catch { /* kein Speicher: Standardplatz */ }
  function moveTl(x, y, save = false) {
    const a = $('.stage-hud').getBoundingClientRect(), b = tl.parentElement.getBoundingClientRect();
    tl.style.setProperty('--stage-w', `${a.width}px`);   // nie breiter als die Bühne: passt nach oben gezogen hinein
    const r = tl.getBoundingClientRect(), l = r.left - tlOff.x, t = r.top - tlOff.y;   // Standardplatz ohne Versatz
    y = Math.min(Math.max(y, a.top - t), b.bottom - t - r.height);
    const h = t + y < b.top - 1 ? a : b;   // in der Bühne seitlich nur so weit wie sie (Schiene, Tafel bleiben frei)
    tlOff = { x: Math.round(Math.min(Math.max(x, h.left - l), h.right - l - r.width)), y: Math.round(y) };
    tl.style.translate = `${tlOff.x}px ${tlOff.y}px`;
    tl.classList.toggle('is-moved', !!(tlOff.x || tlOff.y));
    if (save) try { localStorage.setItem(TL_KEY, JSON.stringify(tlOff)); } catch { /* gilt bis zum Neuladen */ }
  }
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    tlDrag = { x: e.clientX - tlOff.x, y: e.clientY - tlOff.y };
    grip.setPointerCapture(e.pointerId);
    tl.classList.add('is-dragging');
  });
  grip.addEventListener('pointermove', (e) => { if (tlDrag) moveTl(e.clientX - tlDrag.x, e.clientY - tlDrag.y); });
  const tlDrop = () => {
    if (!tlDrag) return;
    tlDrag = null;
    tl.classList.remove('is-dragging');
    moveTl(tlOff.x, tlOff.y, true);
  };
  grip.addEventListener('pointerup', tlDrop);
  grip.addEventListener('pointercancel', tlDrop);
  grip.addEventListener('dblclick', () => moveTl(0, 0, true));
  grip.addEventListener('keydown', (e) => {
    const d = e.shiftKey ? 60 : 20;
    const step = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d], Home: [-tlOff.x, -tlOff.y] }[e.key];
    if (!step) return;
    e.preventDefault();
    e.stopPropagation();
    moveTl(tlOff.x + step[0], tlOff.y + step[1], true);
  });
  tlEl('.tl-reset').addEventListener('click', () => { moveTl(0, 0, true); grip.focus(); });
  new ResizeObserver(() => moveTl(tlOff.x, tlOff.y)).observe(tl.parentElement);   // Fenster, Infotafel auf/zu: in der Bühne halten

  // ---------- Messleiste: Lineal fester Länge ----------
  const ruler = $('#ruler');
  const rulerEnd = $('#ruler-end');
  let rulerW = 240;
  new ResizeObserver(() => { rulerW = ruler.clientWidth; }).observe(ruler);   // Länge kommt aus dem CSS (mobil kürzer)

  let lastLive = 0;
  function setLive(T, playing, done = false) {
    const now = performance.now();
    if (!done && now - lastLive < 40) return;    // ≈ 25 Hz reicht für Zahlen
    lastLive = now;
    const st = pyroState(T), ph = phaseIndex(T);
    tl.classList.toggle('is-playing', playing);
    tlEl('#tl-T').textContent = `${fmt(T)} °C`;
    tlEl('#tl-phase').textContent = st.phase;
    tlEl('#tl-gas').textContent = `Gase: ${st.gas}`;
    tlEl('.tl-now').style.left = pct(T);
    segs.forEach((el, i) => el.style.setProperty('--f', `${(Math.min(1, Math.max(0, (T - PHASE_FROM[i]) / PHASE_SPANS[i])) * 100).toFixed(1)}%`));
    chapters.forEach((b, i) => b.classList.toggle('is-on', i === ph));
    playBtn.textContent = playing ? '■' : '▶';
    playBtn.setAttribute('aria-label', playing ? 'Anhalten' : 'Pyrolyse abspielen');
    playBtn.setAttribute('aria-pressed', String(playing));
    for (const [k, , v, warn, bar] of labRows(T)) {
      const cell = panel.querySelector(`.lab-cell[data-f="${k}"]`);
      if (!cell) continue;
      cell.querySelector('.lab-val').textContent = v;
      const barEl = cell.querySelector('.lab-bar > i');
      if (barEl && bar !== null) barEl.style.width = `${bar.toFixed(1)}%`;
      cell.classList.toggle('warn', warn);
    }
    const dot = panel.querySelector('#chart-dot'), cur = panel.querySelector('#chart-cur');
    if (dot) {
      const x = chX(T);
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', chY(labProps(T).hc));
      cur.setAttribute('x1', x);
      cur.setAttribute('x2', x);
      dot.classList.toggle('is-off', T < T_MIN);
    }
    if (panel.querySelector('[data-spk]')) updateSpectra(T);
  }

  // Infotafel ohne Scrollen (Vorschau 2026-10-25, Panel:B): Einleitung zweizeilig + „Weiterlesen“, Entdecken als Chips
  // (Größen-Etikett nur in der Info-Karte), Kennzahlen ohne Icons, Labor als 3 × 3 Kacheln, Diagramm und Erläuterung
  // aufklappbar (F1); „Verlauf H/C“ bleibt über Ebenenwechsel offen, wenn einmal geöffnet
  let chartOpen = false;
  // Virtuelle Messung (Ebene 6): Röntgenbeugung (Cu Kα) und Raman (514 nm) aus der Modellstruktur (nanolab.js), Graphit-
  // Referenz 26,6° gestrichelt; zwei aufklappbare Diagramme im Pyrolyse-Labor, XRD offen (Vorschau 2026-10-25, Spektren:A)
  const SX = { w: 240, h: 96, x0: 8, x1: 232, y0: 10, y1: 78 };
  const sxX = (v, from, to) => SX.x0 + ((v - from) / (to - from)) * (SX.x1 - SX.x0);
  const sxY = (I) => SX.y1 - I * (SX.y1 - SX.y0);
  const sxPath = (pts, from, to) => pts.map(([x, I], i) => `${i ? 'L' : 'M'}${sxX(x, from, to).toFixed(1)} ${sxY(I).toFixed(1)}`).join('');
  function xrdSvg(T) {
    const x = xrd(T), g = sxX(x.graphite, 10, 60), p = sxX(x.p002, 10, 60);
    return `<svg viewBox="0 0 ${SX.w} ${SX.h}" role="img" aria-label="Röntgenbeugung: (002)-Peak bei 2θ ≈ ${fmt(x.p002, 1)}°, Graphit 26,6°">
      <line class="ax" x1="${SX.x0}" y1="${SX.y1}" x2="${SX.x1}" y2="${SX.y1}"/>
      <line class="ref" x1="${g.toFixed(1)}" y1="${SX.y0}" x2="${g.toFixed(1)}" y2="${SX.y1}"/>
      <text class="lbl" x="${(g + 3).toFixed(1)}" y="${SX.y0 + 8}">Graphit 26,6°</text>
      <path class="curve" d="${sxPath(xrdCurve(T), 10, 60)}"/>
      <line class="cur" x1="${p.toFixed(1)}" y1="${sxY(1)}" x2="${p.toFixed(1)}" y2="${SX.y1}"/>
      <text class="lbl" x="${(p - 3).toFixed(1)}" y="${SX.y0 + 8}" text-anchor="end">(002) ${fmt(x.p002, 1)}°</text>
      <text class="lbl" x="${sxX(x.p10, 10, 60).toFixed(1)}" y="${SX.y1 - 26}" text-anchor="middle">(10)</text>
      <text class="lbl" x="${SX.x0}" y="${SX.y1 + 12}">10°</text><text class="lbl" x="${SX.x1}" y="${SX.y1 + 12}" text-anchor="end">60° 2θ</text>
    </svg>`;
  }
  function ramanSvg(T) {
    const r = raman(T), hD = Math.min(1, r.ratio), hG = Math.min(1, 1 / r.ratio);
    return `<svg viewBox="0 0 ${SX.w} ${SX.h}" role="img" aria-label="Raman: D- und G-Bande, I_D/I_G ≈ ${fmt(r.ratio, 2)}">
      <line class="ax" x1="${SX.x0}" y1="${SX.y1}" x2="${SX.x1}" y2="${SX.y1}"/>
      <path class="curve" d="${sxPath(ramanCurve(T), 1000, 1800)}"/>
      <text class="lbl" x="${sxX(r.D, 1000, 1800).toFixed(1)}" y="${(sxY(hD) - 4).toFixed(1)}" text-anchor="middle">D 1350</text>
      <text class="lbl" x="${sxX(r.G, 1000, 1800).toFixed(1)}" y="${(sxY(hG) - 4).toFixed(1)}" text-anchor="middle">G ${fmt(r.G)}</text>
      <text class="lbl" x="${SX.x0}" y="${SX.y1 + 12}">1000</text><text class="lbl" x="${SX.x1}" y="${SX.y1 + 12}" text-anchor="end">1800 cm⁻¹</text>
    </svg>`;
  }
  const xrdLine = (T) => { const x = xrd(T); return `d₀₀₂ ${fmt(x.ns.d002, 2)} nm → 2θ ≈ ${fmt(x.p002, 1)}° · Lc ≈ ${fmt(x.Lc, 1)} nm (Scherrer) · Breite ≈ ${fmt(x.w002)}°`; };
  const ramanLine = (T) => { const r = raman(T); return `I_D/I_G ≈ ${fmt(r.ratio, 2)} aus La ≈ ${fmt(r.La, 1)} nm (${r.regime})`; };
  const SPK_NOTE = 'Virtuelle Messung aus der Modellstruktur: Lage nach Bragg und Breite nach Scherrer (Cu Kα) aus Schichtabstand und Stapelhöhe, I_D/I_G aus der Schichtgröße (Ferrari & Robertson 2000; Tuinstra & Koenig 1970); Bandbreiten und Untergrund Modell.';
  const spkFig = (kind, T) => `<figure class="chart" data-spk="${kind}">${kind === 'xrd' ? xrdSvg(T) : ramanSvg(T)}<figcaption class="note" data-spk-line>${kind === 'xrd' ? xrdLine(T) : ramanLine(T)}</figcaption></figure>`;
  const spectraBlock = (T) => `<div class="spk" id="spk">
      <details class="lab-more" open><summary>Röntgenbeugung (002) · Soll-Ist Graphit</summary>${spkFig('xrd', T)}</details>
      <details class="lab-more"><summary>Raman D/G · Schichtgröße</summary>${spkFig('raman', T)}<p class="note">${SPK_NOTE}</p></details>
    </div>`;
  function updateSpectra(T) {
    panel.querySelectorAll('[data-spk]').forEach((el) => {
      const kind = el.dataset.spk, svg = el.querySelector('svg');
      if (svg) svg.outerHTML = kind === 'xrd' ? xrdSvg(T) : ramanSvg(T);
      const line = el.querySelector('[data-spk-line]');
      if (line) line.textContent = kind === 'xrd' ? xrdLine(T) : ramanLine(T);
    });
  }

  function render(state) {
    const l = LEVELS[current];
    const dyn = level && level.facts ? level.facts() : [];
    const hsList = level ? level.hotspots : [];
    const icons = HOTSPOT_ICONS[l.id] || {};
    const shown = state.pyro ? state.pyro.shown : state.temp, playing = !!(state.pyro && state.pyro.playing);
    const refs = l.refs.map((r) => `<a href="#quelle-${r}">[${r}]</a>`).join(' ');
    panel.innerHTML = `
      <p class="eyebrow">Ebene ${current + 1} von ${LEVELS.length} · ${esc(l.zone)} · <span class="eyebrow-scale">${esc(l.scale)}</span> (${esc(l.compare)})</p>
      <h1>${esc(l.title)}</h1>
      <p class="lead" id="panel-lead">${esc(l.lead)}</p>
      <button type="button" class="lead-more" aria-expanded="false" aria-controls="panel-lead">Weiterlesen</button>
      <section>
        <h2 class="sub">Entdecken</h2>
        <ul class="explore">${hsList.map((h, idx) => `
          <li><button type="button" data-hs="${h.id}" class="${h.kind === 'dive' ? 'is-dive' : ''}${selected && selected.id === h.id ? ' is-active' : ''}">
            <span class="exp-num">0${idx + 1}</span>${hexBadge(icons[h.id], 'hex--mini')}<span class="exp-title">${esc(l.hotspots[h.id].title)}</span>
          </button></li>`).join('')}
        </ul>
      </section>
      ${facts([...l.facts, ...dyn])}
      <section class="controls">
        <h2 class="sub">Pyrolyse-Labor <span class="sub-note">· Richtwerte Holz (Modell)</span></h2>
        ${l.id === 'meso' ? rhBlock(state.rh, state.wet) : ''}
        <div id="lab">${labTiles(shown)}</div>
        ${l.id === 'micro' ? spectraBlock(shown) : ''}
        <details class="lab-more"${chartOpen ? ' open' : ''}>
          <summary>Verlauf H/C · Erläuterung</summary>
          ${labChart(shown)}
          <p class="note">${LAB_NOTE}</p>
        </details>
      </section>
      <section class="sources">
        <h2 class="sub">Quellen ${refs}</h2>
        <details>
          <summary>Alle Quellen</summary>
          <ol>${SOURCES.map((s) => `<li id="quelle-${s.id}"><a href="${s.url}" target="_blank" rel="noopener">${esc(s.text)}</a></li>`).join('')}</ol>
        </details>
      </section>`;

    const more = panel.querySelector('.lead-more');
    more.addEventListener('click', () => {
      const open = panel.querySelector('.lead').classList.toggle('is-open');
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? 'Weniger' : 'Weiterlesen';
    });
    panel.querySelector('.controls .lab-more:last-of-type').addEventListener('toggle', (e) => { chartOpen = e.target.open; });
    // [n] öffnet die Liste selbst und springt ohne Hash-Wechsel hin: #ebene=n bleibt, auch in Browsern ohne Auto-Aufklappen von <details>
    panel.querySelectorAll('.sources h2 a').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const li = panel.querySelector(a.getAttribute('href'));
      li.closest('details').open = true;
      panel.querySelectorAll('.sources li.is-target').forEach((x) => x.classList.remove('is-target'));
      li.classList.add('is-target');
      li.scrollIntoView({ block: 'nearest' });
    }));
    panel.querySelectorAll('button[data-hs]').forEach((b) => b.addEventListener('click', () => handlers.onHotspot(b.dataset.hs)));
    setGoal(state.temp);
    setLive(shown, playing, true);
    const rh = panel.querySelector('#in-rh');
    if (rh) {
      rh.addEventListener('input', () => {
        const before = poreClass(state.wet);
        const d = handlers.onRh(+rh.value);
        updateRh(+rh.value, d);
        if (poreClass(d) !== before) pulse('water');
      });
      rh.addEventListener('change', () => refreshFacts());
    }
  }

  // Kennzahlen mit lebenden Werten (Summenformel, Schichtgröße …) fortlaufend nachführen: nur Texte tauschen, kein Neuaufbau
  let factsAcc = 0;
  function tickFacts(dt) {
    factsAcc += dt;
    if (factsAcc < 0.2 || !level || !level.liveFacts || !lastState) return;
    factsAcc = 0;
    const els = panel.querySelectorAll('.facts .fact');
    const l = LEVELS[current];
    const list = [...l.facts, ...level.facts()];
    list.forEach((f, i) => {
      const v = els[i] && els[i].querySelector('.fact-value'), lab = els[i] && els[i].querySelector('.fact-label');
      const bar = els[i] && els[i].querySelector('.fact-bar > i');
      const vHtml = fmtFactVal(f.value), lHtml = esc(f.label);
      if (v && v.innerHTML !== vHtml) v.innerHTML = vHtml;
      if (lab && lab.innerHTML !== lHtml) lab.innerHTML = lHtml;
      if (bar) bar.style.width = `${factBarPct(f)}%`;
    });
  }

  function refreshFacts() {
    if (!lastState || !level) return;
    const box = panel.querySelector('.facts');
    const l = LEVELS[current];
    if (box) box.outerHTML = facts([...l.facts, ...(level.facts ? level.facts() : [])]);
  }

  // ---------- Hotspots & 3D-Mess-Overlays (Makro:A, Nano:A, Hud:A+B+C) ----------
  const msSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  msSvg.setAttribute('class', 'ms-svg');
  msSvg.setAttribute('aria-hidden', 'true');
  let measures = [];
  let sceneOvs = [];
  let reticleG = null, tourPath = null, leadsG = null;
  let msRight = null;

  // Ebenen-spezifische 3D-Messhilfen (Makro:A Ebenen 1–3, Nano:A Ebenen 4–7): echte 3D-Ankerpunkte der Szene
  // Ebenen können eigene Messhilfen mitbringen (level.overlays: {cls, pts, text, active?, ticks?, ring?, arrow?})
  function levelOverlays() { return [...builtinOverlays(), ...(level && level.overlays ? level.overlays : [])]; }
  function builtinOverlays() {
    if (!level || !level.hotspots || !level.hotspots.length) return [];
    const v3 = (x, y, z) => level.hotspots[0].pos.clone().set(x, y, z);
    const hs = (id) => level.hotspots.find((h) => h.id === id);
    const lid = LEVELS[current].id;
    if (lid === 'piece') {
      const cr = hs('cracks');
      return [
        {
          cls: 'ov-scale',
          pts: () => [v3(-2.0, -1.08, 1.35), v3(2.0, -1.08, 1.35)],
          ticks: 9,
          text: () => '<b>0 ··· 20 ··· 40 mm</b> · Maßstabs-Objektträger',
        },
        ...(cr ? [{
          cls: 'ov-crack',
          pts: () => [cr.pos.clone().add(v3(-0.35, -0.22, 0.04)), cr.pos.clone().add(v3(0.35, 0.22, 0.04))],
          active: () => !cr.hidden && (!cr.normal || cr.normal.lengthSq() > 0),
          text: () => '<b>Schwundriss-Kontur</b> · Tiefe ≈ 1,6 mm',
        }] : []),
      ];
    }
    if (lid === 'tissue') {
      const rg = hs('ring');
      return [{
        cls: 'ov-ring',
        pts: () => {
          const T = lastState && lastState.pyro ? lastState.pyro.shown : (lastState ? lastState.temp : 550);
          const k = tissueScale(T).xy, y = rg ? rg.pos.y : 28 * k, z = rg ? rg.pos.z : 2;
          return [v3(-210 * k, y, z), v3(210 * k, y, z)];
        },
        ticks: 2,
        text: () => '<b>Jahrringgrenze</b> · Frühholz ≈ 62 % ↔ Spätholz ≈ 40 % Poren',
      }];
    }
    if (lid === 'cells') {
      const pw = hs('pitwall') || level.hotspots[0];
      return [{
        cls: 'ov-capillary',
        pts: () => [pw.pos.clone().add(v3(-8, 0, 85)), pw.pos.clone().add(v3(-8, 0, -95))],
        ticks: 3,
        text: () => '<b>Kapillar-Leitfaden</b> · Wasser & Luft im Gefäß (Ø 15–24 µm)',
      }];
    }
    if (lid === 'wall') {
      const pt = hs('pits'), bc = hs('bacteria');
      return [
        ...(pt ? [{
          cls: 'ov-pit',
          pts: () => [pt.pos.clone().add(v3(-1.4, 0, 0)), pt.pos.clone().add(v3(1.4, 0, 0))],
          ring: true,
          text: () => '<b>Hoftüpfel-Kammer</b> · Hof Ø ≈ 3 µm · Porus 0,7 µm',
        }] : []),
        ...(bc ? [{
          cls: 'ov-biofilm',
          pts: () => [bc.pos.clone().add(v3(-2.3, 0, 0)), bc.pos.clone().add(v3(2.3, 0, 0))],
          ring: true,
          text: () => '<b>Biofilm-Saum</b> · Kolonie auf Porenwand',
        }] : []),
      ];
    }
    if (lid === 'meso') {
      const sl = hs('meso'), rc = hs('race');
      return [
        ...(sl ? [{
          cls: 'ov-meso',
          pts: () => [sl.pos.clone().add(v3(-1.1, 0, 0)), sl.pos.clone().add(v3(1.1, 0, 0))],
          active: () => !!level.measuresOn,
          ticks: 2,
          text: () => '<b>Schlitzpore</b> · Dicke ≈ 2–3 nm (IUPAC Meso)',
        }] : []),
        ...(rc && level.raceLine ? [{
          cls: 'ov-race',
          pts: () => level.raceLine,
          active: () => !rc.hidden && !!level.measuresOn,
          ticks: 2,
          text: () => '<b>Knudsen-Rennen</b> · 6-nm-Schlitz · Einlauf CH₄ › H₂O › N₂ › CO₂',
        }] : []),
      ];
    }
    if (lid === 'micro') {
      const st = hs('stack'), mp = hs('micropore');
      return [
        ...(st ? [{
          cls: 'ov-stack',
          pts: () => [st.pos.clone().add(v3(0, -0.58, 0)), st.pos.clone().add(v3(0, 0.58, 0))],
          active: () => !st.hidden,
          ticks: 2,
          text: () => {
            const T = lastState && lastState.pyro ? lastState.pyro.shown : (lastState ? lastState.temp : 550);
            return `<b>d₀₀₂ ≈ ${fmt(nanoStructure(T).d002, 2)} nm</b> · (002) bei 2θ ≈ ${fmt(xrd(T).p002, 1)}° (Graphit 0,335 nm → 26,6°)`;
          },
        }] : []),
        ...(mp ? [{
          cls: 'ov-micro',
          pts: () => [mp.pos.clone().add(v3(-0.55, 0, 0)), mp.pos.clone().add(v3(0.55, 0, 0))],
          active: () => !mp.hidden,
          ring: true,
          text: () => '<b>IUPAC Mikropore</b> · Weite &lt; 2 nm',
        }] : []),
      ];
    }
    if (lid === 'atoms') {
      const rg = hs('ring'), cx = hs('carboxyl'), swh = hs('sw');
      return [
        ...(swh ? [{
          cls: 'ov-sw',
          pts: () => [swh.pos.clone().add(v3(-1.7, 0, 0)), swh.pos.clone().add(v3(1.7, 0, 0))],
          active: () => !swh.hidden,
          ring: true,
          text: () => '<b>Stone-Wales-Defekt</b> · 5-7-7-5 · wölbt die Schicht',
        }] : []),
        ...(rg ? [{
          cls: 'ov-pi',
          pts: () => [rg.pos.clone().add(v3(-1.35, 0, 0)), rg.pos.clone().add(v3(1.35, 0, 0))],
          ring: true,
          text: () => '<b>π-Elektronenring</b> · C–C 0,142 nm (sp²)',
        }] : []),
        ...(cx ? [{
          cls: 'ov-ion',
          pts: () => [cx.pos.clone().add(v3(-1.1, -0.35, 0)), cx.pos.clone().add(v3(1.1, 0.35, 0))],
          active: () => !cx.hidden,
          ticks: 2,
          text: () => '<b>Ionen-Bindungsfeld</b> · –COO⁻ ··· K⁺',
        }] : []),
      ];
    }
    return [];
  }

  function buildMeasures() {
    for (const ms of measures) ms.lab.remove();
    for (const ov of sceneOvs) ov.lab.remove();
    msSvg.replaceChildren();
    reticleG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    reticleG.setAttribute('class', 'reticle');
    reticleG.innerHTML = '<circle class="ret-ring"/><path class="ret-corners"/>';
    tourPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tourPath.setAttribute('class', 'hs-tour');
    leadsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    leadsG.setAttribute('class', 'hs-leads');
    msSvg.append(reticleG, tourPath, leadsG);

    measures = (level.measures || []).map((d) => {
      const pCls = poreClass(d.nm) || 'meso';
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `ms-g ms-g--${pCls}`);
      g.innerHTML = '<ellipse class="ms-ell"/><line class="ms-line"/><line class="ms-tick"/><line class="ms-tick"/>';
      msSvg.appendChild(g);
      const lab = document.createElement('div');
      lab.className = `ms-lab ms-lab--${pCls}`;
      lab.innerHTML = `<b>Ø ${fmt(d.nm)} nm</b> · ${esc(d.name)} · <span class="ms-state">offen</span>`;
      layer.appendChild(lab);
      return { d, g, lab, ell: g.querySelector('ellipse'), lines: g.querySelectorAll('line'), stateEl: lab.querySelector('.ms-state'), w: 0, hgt: 0 };
    });

    sceneOvs = levelOverlays().map((d) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `ov-g ${d.cls}`);
      g.innerHTML = `${d.ring ? '<ellipse class="ov-ring-el"/>' : ''}<line class="ov-line"/><path class="ov-ticks"/>`;
      msSvg.appendChild(g);
      const lab = document.createElement('div');
      lab.className = `ms-lab ov-lab ${d.cls}`;
      lab.innerHTML = d.text();
      layer.appendChild(lab);
      return { d, g, lab, line: g.querySelector('.ov-line'), ticks: g.querySelector('.ov-ticks'), ringEl: g.querySelector('.ov-ring-el'), w: 0, hgt: 0, lastTxt: '' };
    });

    if (!msSvg.parentNode) layer.prepend(msSvg);
  }

  function updateMeasures(camera, width, height, rect, items) {
    // 1. REM-Apertur-Visier im freien Bühnenzentrum (Hud:B, nur Desktop)
    if (reticleG) {
      const rw = rect.x1 - rect.x0, rh = rect.y1 - rect.y0;
      const rad = Math.min(rw, rh) * 0.34;
      const showRet = width > 860 && rad >= 85;
      reticleG.classList.toggle('is-off', !showRet);
      if (showRet) {
        const cx = (rect.x0 + rect.x1) / 2, cy = (rect.y0 + rect.y1) / 2;
        const ring = reticleG.firstElementChild, corners = reticleG.lastElementChild;
        ring.setAttribute('cx', cx.toFixed(1));
        ring.setAttribute('cy', cy.toFixed(1));
        ring.setAttribute('r', rad.toFixed(1));
        const b = rad * 1.08, c = 16;
        corners.setAttribute('d', [
          `M${(cx - b).toFixed(1)} ${(cy - b + c).toFixed(1)}V${(cy - b).toFixed(1)}H${(cx - b + c).toFixed(1)}`,
          `M${(cx + b - c).toFixed(1)} ${(cy - b).toFixed(1)}H${(cx + b).toFixed(1)}V${(cy - b + c).toFixed(1)}`,
          `M${(cx - b).toFixed(1)} ${(cy + b - c).toFixed(1)}V${(cy + b).toFixed(1)}H${(cx - b + c).toFixed(1)}`,
          `M${(cx + b - c).toFixed(1)} ${(cy + b).toFixed(1)}H${(cx + b).toFixed(1)}V${(cy + b - c).toFixed(1)}`,
          `M${(cx - 5).toFixed(1)} ${cy.toFixed(1)}H${(cx + 5).toFixed(1)}M${cx.toFixed(1)} ${(cy - 5).toFixed(1)}V${(cy + 5).toFixed(1)}`,
        ].join(''));
      }
    }

    // 2. Nummerierter Entdeckungs-Pfad (Hud:C) & gewinkelte 45°-Leitlinien (Hud:A)
    if (tourPath && leadsG) {
      if (items.length >= 2) {
        tourPath.setAttribute('d', items.map((m, i) => `${i ? 'L' : 'M'}${m.ax.toFixed(1)} ${m.ay.toFixed(1)}`).join(''));
        tourPath.classList.remove('is-off');
      } else {
        tourPath.classList.add('is-off');
      }
      while (leadsG.children.length < items.length) {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        leadsG.appendChild(p);
      }
      Array.from(leadsG.children).forEach((p, i) => {
        const m = items[i];
        if (!m) { p.classList.add('is-off'); return; }
        p.setAttribute('class', `hs-lead${m.h.kind === 'dive' ? ' hs-lead--dive' : ''}`);
        const bx = m.x < m.ax ? m.x + m.w / 2 - 2 : m.x - m.w / 2 + 2;
        const by = m.y;
        const dx = bx - m.ax, dy = by - m.ay;
        const step = Math.min(Math.abs(dx) * 0.55, Math.abs(dy));
        const kx = m.ax + Math.sign(dx || 1) * step, ky = m.ay + Math.sign(dy || 1) * step;
        p.setAttribute('d', `M${m.ax.toFixed(1)} ${m.ay.toFixed(1)}L${kx.toFixed(1)} ${ky.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`);
      });
    }

    msRight = msRight || camera.position.clone();
    msRight.setFromMatrixColumn(camera.matrixWorld, 0);
    const cardOpen = card.classList.contains('is-open') && !card.classList.contains('is-away');
    const cr = cardOpen ? card.getBoundingClientRect() : null;
    const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    const scr = (v) => [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height];
    const placedBoxes = [];

    // 3. Poren-Messlinien auf Ebene 5 (mit IUPAC-Porenklasse und Füllstatus)
    for (const ms of measures) {
      const half = ms.d.nm / 20;   // Einheit 10 nm, halber Durchmesser
      const A = ms.d.pos.clone().addScaledVector(msRight, -half).project(camera);
      const B = ms.d.pos.clone().addScaledVector(msRight, half).project(camera);
      const filled = lastState && lastState.wet >= ms.d.nm;
      const stTxt = filled ? 'gefüllt 💧' : 'offen';
      if (ms.stateEl && ms.stateEl.textContent !== stTxt) {
        ms.stateEl.textContent = stTxt;
        ms.lab.classList.toggle('is-wet', !!filled);
        ms.g.classList.toggle('is-wet', !!filled);
        ms.w = 0;
      }
      if (!ms.w) { ms.w = ms.lab.offsetWidth; ms.hgt = ms.lab.offsetHeight; }
      const [ax, ay] = scr(A), [bx, by] = scr(B);
      const lx = (ax + bx) / 2, ly = Math.min(ay, by) - 10;
      const box = { l: lx - ms.w / 2, r: lx + ms.w / 2, t: ly - ms.hgt, b: Math.max(ay, by) + 8 };
      let on = level.measuresOn && A.z < 1 && B.z < 1 && camera.position.y > ms.d.pos.y &&
        box.l >= rect.x0 && box.r <= rect.x1 && box.t >= rect.y0 && box.b <= rect.y1 && bx - ax > 24;
      // nichts überdecken: Abzeichen und Info-Karte haben Vorrang
      if (on && items.some((m) => hit(box, { l: m.x - m.w / 2, r: m.x + m.w / 2, t: m.y - m.hgt / 2, b: m.y + m.hgt / 2 }))) on = false;
      if (on && cr && hit(box, { l: cr.left, r: cr.right, t: cr.top, b: cr.bottom })) on = false;
      ms.lab.classList.toggle('is-off', !on);
      ms.g.classList.toggle('is-off', !on);
      if (!on) continue;
      placedBoxes.push(box);
      const [line, t1, t2] = ms.lines;
      const set = (el, x1, y1, x2, y2) => { el.setAttribute('x1', x1.toFixed(1)); el.setAttribute('y1', y1.toFixed(1)); el.setAttribute('x2', x2.toFixed(1)); el.setAttribute('y2', y2.toFixed(1)); };
      set(line, ax, ay, bx, by);
      set(t1, ax, ay - 7, ax, ay + 7);
      set(t2, bx, by - 7, bx, by + 7);
      if (ms.ell) {
        const rx = Math.max(8, (bx - ax) / 2);
        ms.ell.setAttribute('cx', lx.toFixed(1));
        ms.ell.setAttribute('cy', ((ay + by) / 2).toFixed(1));
        ms.ell.setAttribute('rx', rx.toFixed(1));
        ms.ell.setAttribute('ry', (rx * 0.45).toFixed(1));
      }
      ms.lab.style.transform = `translate(${Math.round(lx - ms.w / 2)}px, ${Math.round(ly - ms.hgt)}px)`;
    }

    // 4. Ebenen-spezifische 3D-Mess-Overlays (Makro:A & Nano:A)
    for (const ov of sceneOvs) {
      if (ov.d.active && !ov.d.active()) {
        ov.lab.classList.add('is-off');
        ov.g.classList.add('is-off');
        continue;
      }
      const txt = ov.d.text();
      if (txt !== ov.lastTxt) { ov.lab.innerHTML = txt; ov.lastTxt = txt; ov.w = 0; }
      const [pA, pB] = ov.d.pts();
      const A = pA.clone().project(camera), B = pB.clone().project(camera);
      if (!ov.w) { ov.w = ov.lab.offsetWidth; ov.hgt = ov.lab.offsetHeight; }
      const [rawAx, rawAy] = scr(A), [rawBx, rawBy] = scr(B);
      const midX = (rawAx + rawBx) / 2, midY = (rawAy + rawBy) / 2;
      const inStage = midX >= rect.x0 && midX <= rect.x1 && midY >= rect.y0 && midY <= rect.y1;
      const ax = Math.min(Math.max(rawAx, rect.x0 + 8), rect.x1 - 8);
      const bx = Math.min(Math.max(rawBx, rect.x0 + 8), rect.x1 - 8);
      const ay = Math.min(Math.max(rawAy, rect.y0 + 18), rect.y1 - 8);
      const by = Math.min(Math.max(rawBy, rect.y0 + 18), rect.y1 - 8);
      const span = Math.hypot(bx - ax, by - ay);
      const lx = Math.min(Math.max((ax + bx) / 2, rect.x0 + ov.w / 2 + 4), rect.x1 - ov.w / 2 - 4);
      const ly = Math.min(Math.max(rect.y0 + ov.hgt + 4, Math.min(ay, by) - 10), rect.y1 - 6);
      const box = { l: lx - ov.w / 2, r: lx + ov.w / 2, t: ly - ov.hgt, b: ly + 4 };
      let on = width > 520 && A.z < 1 && B.z < 1 && inStage && span > 26 &&
        box.l >= rect.x0 && box.r <= rect.x1 && box.t >= rect.y0 && box.b <= rect.y1;
      if (on && items.some((m) => hit(box, { l: m.x - m.w / 2 - 6, r: m.x + m.w / 2 + 6, t: m.y - m.hgt / 2 - 6, b: m.y + m.hgt / 2 + 6 }))) on = false;
      if (on && cr && hit(box, { l: cr.left - 6, r: cr.right + 6, t: cr.top - 6, b: cr.bottom + 6 })) on = false;
      if (on && placedBoxes.some((b) => hit(box, b))) on = false;
      ov.lab.classList.toggle('is-off', !on);
      ov.g.classList.toggle('is-off', !on);
      if (!on) continue;
      placedBoxes.push(box);
      ov.line.setAttribute('x1', ax.toFixed(1));
      ov.line.setAttribute('y1', ay.toFixed(1));
      ov.line.setAttribute('x2', bx.toFixed(1));
      ov.line.setAttribute('y2', by.toFixed(1));
      if (ov.ringEl) {
        const r = Math.min(48, Math.max(12, span / 2));
        ov.ringEl.setAttribute('cx', ((ax + bx) / 2).toFixed(1));
        ov.ringEl.setAttribute('cy', ((ay + by) / 2).toFixed(1));
        ov.ringEl.setAttribute('rx', r.toFixed(1));
        ov.ringEl.setAttribute('ry', (r * 0.65).toFixed(1));
      }
      if (ov.ticks && (ov.d.ticks || ov.d.arrow)) {
        const nx = -(by - ay) / (span || 1), ny = (bx - ax) / (span || 1);
        const n = ov.d.ticks || 0;
        let dStr = '';
        for (let i = 0; i < n; i++) {
          const u = n === 1 ? 0.5 : i / (n - 1);
          const tx = ax + (bx - ax) * u, ty = ay + (by - ay) * u;
          const th = (i === 0 || i === n - 1 || i === Math.floor(n / 2)) ? 6 : 3.5;
          dStr += `M${(tx - nx * th).toFixed(1)} ${(ty - ny * th).toFixed(1)}L${(tx + nx * th).toFixed(1)} ${(ty + ny * th).toFixed(1)}`;
        }
        // Pfeilspitzen: 'in' = beide Enden zeigen zur Mitte (Schwindung), 'out' = nach außen, 'end' = nur am Endpunkt
        if (ov.d.arrow) {
          const ux = -ny, uy = nx, s = 8;
          const head = (x, y, px, py) => `M${(x - px * s - py * s * 0.55).toFixed(1)} ${(y - py * s + px * s * 0.55).toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}L${(x - px * s + py * s * 0.55).toFixed(1)} ${(y - py * s - px * s * 0.55).toFixed(1)}`;
          if (ov.d.arrow === 'in') dStr += head(ax, ay, ux, uy) + head(bx, by, -ux, -uy);
          else if (ov.d.arrow === 'out') dStr += head(ax, ay, -ux, -uy) + head(bx, by, ux, uy);
          else dStr += head(bx, by, ux, uy);
        }
        ov.ticks.setAttribute('d', dStr);
      }
      ov.lab.style.transform = `translate(${Math.round(lx - ov.w / 2)}px, ${Math.round(ly - ov.hgt)}px)`;
    }
  }

  function buildMarkers() {
    const l = LEVELS[current];
    const icons = HOTSPOT_ICONS[l.id] || {};
    for (const m of markers) { m.el.remove(); m.dot.remove(); }
    buildMeasures();
    if (!card.parentNode) layer.appendChild(card);
    markers = level.hotspots.map((h, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `hs-dot${h.kind === 'dive' ? ' hs-dot--dive' : ''}`;
      dot.setAttribute('aria-label', l.hotspots[h.id].title);
      dot.addEventListener('click', () => handlers.onHotspot(h.id, true));
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `hsb ${h.kind === 'dive' ? 'hsb--dive' : 'hsb--info'}`;
      el.innerHTML = `${hexBadge(icons[h.id], 'hex--hs')}<span class="hsb-label"><span class="hsb-num">0${i + 1}</span>${esc(l.hotspots[h.id].title)}${h.kind === 'dive' ? '<span class="tag">tiefer</span>' : ''}</span>`;
      el.setAttribute('aria-label', `${l.hotspots[h.id].title}${h.kind === 'dive' ? ' – hineinzoomen' : ''}`);
      el.addEventListener('click', () => handlers.onHotspot(h.id, true));
      el.addEventListener('animationend', (e) => { if (e.animationName.startsWith('hsb-pulse')) el.classList.remove('is-pulse'); });
      // Reihenfolge beim Erscheinen: Punkt → Abzeichen, gestaffelt je Hotspot
      dot.style.transitionDelay = `${i * 90}ms`;
      el.style.transitionDelay = `${i * 90 + 200}ms`;
      layer.append(dot, el);
      return { h, el, dot, x: NaN, y: NaN, w: 0, hgt: 0 };
    });
  }

  function closeCard() {
    selected = null;
    card.classList.remove('is-open');
    document.body.classList.remove('card-docked');
    markers.forEach((m) => m.el.classList.remove('is-active'));
    panel.querySelectorAll('button[data-hs].is-active').forEach((b) => b.classList.remove('is-active'));
  }

  // Karte füllen: Titel mit Abzeichen, links neben dem Text die Lupe (Live-Ausschnitt der Szene, zeichnet main.js),
  // bei Tauchzielen der Knopf zum Hineinzoomen; jede Füllung blendet neu ein
  let lensCanvas = null;
  function fillCard() {
    if (!selected) { card.classList.remove('is-open'); lensCanvas = null; return; }
    const l = LEVELS[current], h = l.hotspots[selected.id], icons = HOTSPOT_ICONS[l.id] || {};
    const tag = h.tag || (selected.kind === 'dive' ? 'tiefer' : '');   // Größen-Etikett steht seit Panel:B nur noch hier
    card.innerHTML = `<div class="hs-card-in">
      <div class="hs-card-head">
        <h2>${hexBadge(icons[selected.id], 'hex--mini')}<span>${esc(h.title)}${tag ? `<span class="tag">${esc(tag)}</span>` : ''}</span></h2>
        <button type="button" class="hs-card-close" aria-label="Schließen"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg></button>
      </div>
      <div class="hs-body">
        <figure class="hs-lens" aria-hidden="true"><canvas></canvas><svg class="hs-lens-svg" viewBox="0 0 112 112"><circle cx="56" cy="56" r="46" stroke-dasharray="3 4"/><path d="M56 4v9M56 99v9M4 56h9M99 56h9"/></svg></figure>
        <div class="hs-text"><p>${esc(h.text)}</p>${h.edx ? edxDetails(h.edx) : ''}</div>
      </div>
      ${selected.kind === 'dive' ? '<div class="hs-card-foot"><button type="button" class="btn-primary" id="btn-dive">Hineinzoomen ↓</button></div>' : ''}
      </div>`;
    const dive = card.querySelector('#btn-dive');
    if (dive) dive.addEventListener('click', () => handlers.onDive(selected.id));
    card.querySelector('.hs-card-close').addEventListener('click', closeCard);
    lensCanvas = card.querySelector('.hs-lens canvas');
    card.classList.remove('is-away');
    cardW = 0;
    card.classList.add('is-open');
  }

  // Karte neben dem gewählten Abzeichen (12 px Abstand zu Punkt und Abzeichen), ganz im freien Bereich (stageRect):
  // bevorzugt links, sonst rechts, sonst darunter oder darüber; die Seite bleibt, solange sie passt (kein Springen bei
  // der Kamerafahrt). Höher als der freie Bereich wird sie nicht (Text scrollt). Die Lupe steht als eigene Spalte links
  // neben dem Text (Textbreite wie ohne Lupe, die Karte wächst um die Spalte). Im schmalen Fenster (≤ 860 px) ist die
  // Bühne dafür zu flach: dort nimmt die Karte Platz und Größe der Tafel ein, die Tafel ist so lange unsichtbar
  // (Vorschau 2026-10-24, Ort:A); bei eingeklappter Tafel steht sie wie sonst neben dem Abzeichen
  const LENS_COL = 112 + 14;
  let cardW = 0, cardSide = '', cardBox = null;
  function placeCard(items, rect, width) {
    cardBox = null;
    const docked = !!selected && width <= 860 && !document.body.classList.contains('panel-collapsed') && !layer.classList.contains('is-hidden');
    document.body.classList.toggle('card-docked', docked);
    card.classList.toggle('is-docked', docked);
    if (!selected) return;
    const m = items.find((x) => x.h.id === selected.id);
    const tempHidden = !!(selected.hidden || (selected.normal && selected.normal.lengthSq() === 0));
    card.classList.toggle('is-away', !m && !docked && !tempHidden);   // im Platz der Tafel oder bei temperaturbedingt ausgeblendetem Punkt bleibt sie sichtbar
    if (docked) {
      const p = $('#panel').getBoundingClientRect();
      card.style.width = `${p.width}px`;
      card.style.maxHeight = `${p.height}px`;   // so hoch wie der Inhalt, höchstens wie die Tafel; unten bündig mit ihr
      card.style.transform = `translate(${Math.round(p.left)}px, ${Math.round(p.bottom - card.offsetHeight)}px)`;
      cardW = 0;
      return;   // liegt außerhalb der Bühne: kein Abzeichen muss ausweichen
    }
    if (!m && tempHidden) {
      const room = rect.x1 - rect.x0 - LENS_COL;
      cardW = Math.min(340, Math.max(220, Math.floor((room - 30) / 20) * 20));
      cardSide = 'right';
      card.style.width = `${Math.min(cardW + LENS_COL, Math.floor(rect.x1 - rect.x0))}px`;
      card.style.maxHeight = `${Math.floor(rect.y1 - rect.y0)}px`;
      const cw = card.offsetWidth, ch = card.offsetHeight;
      const x = Math.max(rect.x0, rect.x1 - cw), y = rect.y0;
      card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      cardBox = [x - 8, y - 8, x + cw + 8, y + ch + 8];
      return;
    }
    if (!m) return;
    const bx0 = Math.min(m.ax, m.x - m.w / 2) - 12, bx1 = Math.max(m.ax, m.x + m.w / 2) + 12;
    const roomL = bx0 - rect.x0 - LENS_COL, roomR = rect.x1 - bx1 - LENS_COL;
    const side = cardSide === 'right' && roomR >= 220 ? 'right' : roomL >= 220 ? 'left' : roomR >= 220 ? 'right' : 'vert';
    // Breite in 20-px-Stufen mit Hysterese: sonst folgt sie dem wandernden Abzeichen (Kamerafahrt im Leerlauf), der Blocksatz
    // bricht in jedem Bild anders um und die Karte flackert und zittert
    const room = side === 'left' ? roomL : side === 'right' ? roomR : rect.x1 - rect.x0 - LENS_COL;
    if (!cardW || side !== cardSide || room < cardW || room > cardW + 100) cardW = Math.min(340, Math.max(220, Math.floor((room - 30) / 20) * 20));
    cardSide = side;
    card.style.width = `${Math.min(cardW + LENS_COL, Math.floor(rect.x1 - rect.x0))}px`;
    card.style.maxHeight = `${Math.floor(rect.y1 - rect.y0)}px`;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const by0 = m.y - m.hgt / 2 - 10, by1 = m.y + m.hgt / 2 + 10;
    const clampY = (y) => Math.min(Math.max(y, rect.y0), Math.max(rect.y0, rect.y1 - ch));
    let x, y;
    if (side === 'vert') {   // darunter, sonst darüber, sonst dort, wo mehr Platz ist – immer im freien Bereich
      x = Math.min(Math.max(m.x - cw / 2, rect.x0), Math.max(rect.x0, rect.x1 - cw));
      y = clampY(by1 + ch <= rect.y1 || (by0 - ch < rect.y0 && rect.y1 - by1 >= by0 - rect.y0) ? by1 : by0 - ch);
    } else {
      x = side === 'left' ? bx0 - cw : bx1;
      y = clampY(m.y - ch / 2);
    }
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;   // ganze Pixel: kein Flimmern der Schrift
    cardBox = [x - 8, y - 8, x + cw + 8, y + ch + 8];   // die anderen Abzeichen weichen im nächsten Bild aus
  }

  // freier Bereich zwischen Schiene, Tafel, Kopfleiste und Hinweis bzw. Fußleiste; die Zeitleiste nimmt ihre Seite der Bühne weg
  // (unten: der Bereich endet über ihr, nach oben gezogen: er beginnt unter ihr)
  function stageRect(width) {
    const r = (sel) => $(sel).getBoundingClientRect();
    const lad = r('.ladder'), pan = r('#panel'), top = r('.topbar'), bot = r('.bottombar'), hint = r('.center-hint'), bar = tl.getBoundingClientRect();
    const narrow = width <= 860;
    const y0 = (narrow ? lad.bottom : top.bottom) + 8;
    const floor = hint.height && !selected ? Math.min(hint.top, bot.top) : bot.top;   // Hinweis unten in der Bühne bleibt frei; offene Karte blendet ihn aus (CSS)
    const y1 = Math.min(narrow && pan.width > 0 ? pan.top : Infinity, floor) - 8;   // mobil liegt die Knopfleiste über der Tafel
    const low = bar.top + bar.bottom > y0 + y1;
    return {
      x0: narrow ? 8 : lad.right + 10,
      x1: pan.width > 0 && pan.left > width * 0.5 ? pan.left - 10 : width - 8,
      y0: low ? y0 : Math.max(y0, bar.bottom + 8),
      y1: low ? Math.min(y1, bar.top - 8) : y1,
    };
  }

  return {
    setGoal(T) { setGoal(T); refreshFacts(); },   // Zeitraffer hebt ein Ziel auf Raumtemperatur an
    setLevel(index, lv, state) {
      current = index;
      level = lv;
      selected = null;
      lastState = state;
      levelButtons.forEach((b, i) => {
        b.classList.toggle('is-current', i === index);
        b.classList.remove('is-pull');
        if (i === index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      $('#btn-up').disabled = index === 0;
      $('#btn-down').disabled = !lv.hotspots.some((h) => h.kind === 'dive');
      setNavTargets(index);
      $('#sb-method').textContent = lv.method;
      detCol.hidden = !lv.detector;
      render(state);
      panel.classList.remove('is-entering');
      void panel.offsetWidth;
      panel.classList.add('is-entering');
      panel.scrollTop = 0;
      buildMarkers();
      fillCard();
    },
    setRailRange(hfwMin, hfwMax) {
      railLimits = { min: hfwMin, max: hfwMax };
      const y0 = railFrac(hfwMax), y1 = railFrac(hfwMin);
      range.style.setProperty('--y0', `${(y0 * 100).toFixed(2)}%`);
      range.style.setProperty('--y1', `${(y1 * 100).toFixed(2)}%`);
    },
    select(id, state) {
      lastState = state;
      const next = level.hotspots.find((h) => h.id === id) || null;
      if (!next || (selected && selected.id === next.id)) { closeCard(); return; }   // zweiter Klick schließt die Karte
      selected = next;
      fillCard();
      markers.forEach((m) => m.el.classList.toggle('is-active', m.h.id === id));
      panel.querySelectorAll('button[data-hs]').forEach((b) => b.classList.toggle('is-active', b.dataset.hs === id));
    },
    // Escape: offene Karte zuerst schließen (true), erst danach wechselt Escape die Ebene
    closeCard() {
      if (!selected) return false;
      closeCard();
      return true;
    },
    refreshFacts,
    tickFacts,
    setLive,
    hideMarkers(hidden) {
      layer.classList.toggle('is-hidden', hidden);
    },
    // Lupe der Info-Karte (Canvas + gewählter Punkt), solange die Karte sichtbar ist; main.js zeichnet hinein
    lens() {
      if (!selected || !lensCanvas || !card.classList.contains('is-open') || card.classList.contains('is-away') ||
        layer.classList.contains('is-hidden')) return null;
      return { canvas: lensCanvas, id: selected.id };
    },
    updateMarkers(camera, width, height) {
      const v = camera.position.clone();
      const rect = stageRect(width);
      const GAP = 14;   // Abstand Punkt → Abzeichen
      const items = [];
      for (const m of markers) {
        const p = m.h.pos.clone().project(camera);
        let visible = !m.h.hidden && p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;   // hidden: Ebene blendet je Zustand aus
        if (visible && m.h.normal) visible = m.h.normal.dot(v.clone().sub(m.h.pos)) > 0;
        m.el.classList.toggle('is-off', !visible);
        m.dot.classList.toggle('is-off', !visible);
        if (!visible) continue;
        m.ax = ((p.x + 1) / 2) * width;
        m.ay = ((1 - p.y) / 2) * height;
        if (!m.w) { m.w = m.el.offsetWidth; m.hgt = m.el.offsetHeight; }
        items.push(m);
      }
      if (!items.length) { placeCard(items, rect, width, height); updateMeasures(camera, width, height, rect, items); return; }
      // Abzeichen direkt neben den Punkt: links davon (rechts, wenn links kein Platz), dann sanft entzerren und im freien Bereich halten
      for (const m of items) {
        const leftFits = m.ax - GAP - m.w >= rect.x0, rightFits = m.ax + GAP + m.w <= rect.x1;
        // Seite bleibt, solange sie passt: sonst springt das Abzeichen in der Leerlauf-Fahrt am Rand hin und her
        // h.side = 'right': Ebene wünscht das Abzeichen rechts (zwei Punkte dicht beieinander, Ebene 6); 'left': links, damit
        // das Element rechts vom Punkt frei bleibt (Ebene 5: Rennspalt)
        m.right = (selected && m.h.id === selected.id) || (m.h.side === 'right' && rightFits) ||
          (m.h.side === 'left' && leftFits ? false : m.right ? rightFits || !leftFits : !leftFits);   // gewähltes Abzeichen rechts vom Punkt: links bleibt Platz für die Karte
        m.tx = m.right ? m.ax + GAP + m.w / 2 : m.ax - GAP - m.w / 2;
        m.ty = m.ay;
      }
      // flacher freier Bereich (mobil zwischen Ebenen-Leiste und Zeitleiste): nur seitlich entzerren, sonst rutschen
      // die Abzeichen auf die Leisten
      const flat = rect.y1 - rect.y0 < 2 * Math.max(...items.map((m) => m.hgt)) + 8;
      const clampAll = () => {
        for (const m of items) {
          m.tx = Math.min(Math.max(m.tx, rect.x0 + m.w / 2), rect.x1 - m.w / 2);
          m.ty = Math.min(Math.max(m.ty, rect.y0 + m.hgt / 2), rect.y1 - m.hgt / 2);
        }
      };
      for (let it = 0; it < 6; it++) {
        clampAll();
        for (let a = 0; a < items.length; a++) {
          for (let b = a + 1; b < items.length; b++) {
            const A = items[a], B = items[b];
            const ox = (A.w + B.w) / 2 + 10 - Math.abs(A.tx - B.tx);
            const oy = (A.hgt + B.hgt) / 2 + 8 - Math.abs(A.ty - B.ty);
            if (ox <= 0 || oy <= 0) continue;
            // das gewählte Abzeichen bleibt an seinem Platz (Karte links davon), der Nachbar weicht ganz aus
            const sa = selected && A.h.id === selected.id, sb = selected && B.h.id === selected.id;
            const fa = sa ? 0 : sb ? 1 : 0.5, fb = sa ? 1 : sb ? 0 : 0.5;
            // Reihenfolge nach der sichtbaren Lage (nicht nach dem Ziel): kreuzen sich zwei Punkte, tauschen die
            // Abzeichen nicht bei jedem Wackeln die Plätze
            const ay = Number.isNaN(A.y) ? A.ty : A.y, by = Number.isNaN(B.y) ? B.ty : B.y;
            const ax = Number.isNaN(A.x) ? A.tx : A.x, bx = Number.isNaN(B.x) ? B.tx : B.x;
            if (oy < ox && !flat) { const s = (ay < by ? -1 : 1) * oy; A.ty += s * fa; B.ty -= s * fb; }
            else { const s = (ax < bx ? -1 : 1) * ox; A.tx += s * fa; B.tx -= s * fb; }
          }
        }
        // offene Karte: die anderen Abzeichen weichen an die nächste Kartenseite aus, an der sie im freien Bereich Platz
        // haben (vor der hohen Karte am linken Rand also nach rechts), damit die Karte keins verdeckt
        if (cardBox && selected) {
          const [c0, c1, c2, c3] = cardBox;
          for (const m of items) {
            if (m.h.id === selected.id) continue;
            const hw = m.w / 2, hh = m.hgt / 2;
            if (m.tx + hw <= c0 || m.tx - hw >= c2 || m.ty + hh <= c1 || m.ty - hh >= c3) continue;
            const fits = ([x, y]) => x - hw >= rect.x0 && x + hw <= rect.x1 && y - hh >= rect.y0 && y + hh <= rect.y1;
            const cost = (p) => Math.abs(p[0] - m.tx) + Math.abs(p[1] - m.ty) + (fits(p) ? 0 : 1e6);
            const best = [[c0 - hw, m.ty], [c2 + hw, m.ty], [m.tx, c1 - hh], [m.tx, c3 + hh]].reduce((a, b) => (cost(b) < cost(a) ? b : a));
            [m.tx, m.ty] = best;
          }
        }
      }
      clampAll();   // zum Schluss ganz im freien Bereich: die Leisten haben Vorrang vor dem Entzerren
      for (const m of items) {
        if (Number.isNaN(m.x)) { m.x = m.tx; m.y = m.ty; }
        else { m.x += (m.tx - m.x) * 0.22; m.y += (m.ty - m.y) * 0.22; }
        m.el.style.transform = `translate(${(m.x - m.w / 2).toFixed(1)}px, ${(m.y - m.hgt / 2).toFixed(1)}px)`;
        m.dot.style.transform = `translate(${m.ax.toFixed(1)}px, ${m.ay.toFixed(1)}px)`;
      }
      placeCard(items, rect, width, height);
      updateMeasures(camera, width, height, rect, items);
    },
    updateScale(hfwMeters, widthPx, lv) {
      // Teilung 1/2/5 × 10^n mit Hauptstrichen ≥ 52 px Abstand; das Lineal bleibt gleich lang, nur Striche und Endwert wandern
      const pxPerM = widthPx / hfwMeters;
      const minStep = 52 / pxPerM;
      const pow = Math.pow(10, Math.floor(Math.log10(minStep)));
      const step = [1, 2, 5, 10].map((k) => k * pow).find((s) => s >= minStep);
      const stepPx = step * pxPerM;
      const n = Math.max(1, Math.floor(rulerW / stepPx));
      ruler.style.setProperty('--step', `${stepPx.toFixed(2)}px`);
      ruler.style.setProperty('--end', `${(n * stepPx).toFixed(1)}px`);
      rulerEnd.textContent = formatLength(n * step);
      const hfwText = formatLength(hfwMeters, true);
      $('#sb-hfw').textContent = hfwText;
      if (lv && lv.method !== $('#sb-method').textContent) $('#sb-method').textContent = lv.method;
      const mag = 0.127 / hfwMeters;   // Vergrößerung bezogen auf 127 mm Bildbreite (REM-Konvention)
      $('#sb-mag').textContent = mag < 1e5 ? `${fmt(mag, mag < 10 ? 1 : 0)} ×` : `${fmt(mag / 1e6, 1)} Mio. ×`;
      if (!dragging) {
        setKnob(railFrac(hfwMeters));
        knobLabel.textContent = hfwText;
      }
    },
    setEdgeMeter(dir, amount) {
      meter.classList.toggle('is-on', amount > 0.02);
      meter.dataset.dir = dir;
      meter.style.setProperty('--amount', amount.toFixed(3));
      meter.querySelector('span').textContent = dir === 'down' ? 'Weiter scrollen: eine Ebene tiefer' : 'Weiter scrollen: eine Ebene zurück';
    },
    setLoading(on) {
      document.body.classList.toggle('is-loading', on);
    },
  };
}

// EDX-Spektrum (Modell) zum Hotspot „Asche-Partikel“: Linienlagen aus content.js (Bearden 1967), Höhen Modell; Untergrund =
// Bremsstrahlung (Kramers-Form, bei kleinen Energien durch Absorption im Detektorfenster gedämpft), Linienbreite wie ein
// Silizium-Driftdetektor (≈ 70 eV bei C, ≈ 125 eV bei Ca; Modell), Achse 0–4,6 keV; aufklappbar (Vorschau 2026-10-25, EDX:C)
function edxDetails(peaks, w = 300, h = 90) {
  const E0 = 4.6, n = 320, top = 16, bot = 14;
  const bg = (E) => 0.1 * Math.exp(-E / 2.5) * (1 - Math.exp(-E / 0.4));
  const at = (E) => peaks.reduce((y, p) => y + p.i * Math.exp(-0.5 * ((E - p.keV) / (0.03 + 0.012 * Math.sqrt(p.keV))) ** 2), bg(E));
  const vals = Array.from({ length: n + 1 }, (_, i) => at((i / n) * E0));
  const max = Math.max(...vals);
  const X = (E) => ((E / E0) * w).toFixed(1), Y = (y) => h - bot - (y / max) * (h - top - bot);
  const pts = vals.map((y, i) => `${X((i / n) * E0)},${Y(y).toFixed(1)}`).join(' ');
  const labels = peaks.map((p) => `<text x="${X(p.keV)}" y="${(Y(p.i + bg(p.keV)) - 4).toFixed(1)}" text-anchor="middle">${esc(p.el)}</text>`).join('');
  const ticks = [0, 1, 2, 3, 4].map((k) => `<line class="tk" x1="${X(k)}" y1="${h - bot}" x2="${X(k)}" y2="${h - bot + 3}"/><text class="ax" x="${X(k)}" y="${h - 1}" text-anchor="middle">${k}</text>`).join('');
  const alt = peaks.map((p) => `${p.el} ${fmt(p.keV, 3)} keV`).join(', ');
  return `<details class="hs-edx"><summary>EDX-Spektrum des Partikels</summary><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="EDX-Spektrum, Linien: ${esc(alt)}"><line class="tk" x1="0" y1="${h - bot}" x2="${w}" y2="${h - bot}"/>${ticks}<polyline class="fill" points="0,${h - bot} ${pts} ${w},${h - bot}"/><polyline class="line" points="${pts}"/>${labels}</svg><span class="hs-edx-cap">keV · Linien nach Bearden 1967 · Höhen: Modell</span></details>`;
}

function formatLength(m, approx = false) {
  const units = [[1e-2, 'cm'], [1e-3, 'mm'], [1e-6, 'µm'], [1e-9, 'nm']];
  for (const [u, name] of units) {
    if (m >= u * 0.999) {
      const v = m / u;
      return `${approx ? '≈ ' : ''}${fmt(v, v < 10 && approx ? 1 : 0)} ${name}`;
    }
  }
  return `${approx ? '≈ ' : ''}${fmt(m / 1e-9, 1)} nm`;
}
