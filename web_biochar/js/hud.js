// Bedienoberfläche über der 3D-Szene: Zoom-Schiene (vertikal, log-Skala, ziehbar), Infotafel, Hotspots mit
// Info-Karte, REM-Datenleiste, Regler. Bildsprache: Hexagon-Badge direkt neben dem Objekt, beim Klick eine Karte links davon.

import { LEVELS, SOURCES } from './content.js';
import { properties, labProps, pyroState, fmt, T_MIN, T_MAX, T_ROOM, DRAPER, PHASES, fillDiameterNm, kelvinRh, filledShare, isotherm, poreClass } from './science.js';
import { hexBadge, HEX, LEVEL_ICONS, HOTSPOT_ICONS, FACT_ICONS } from './icons.js';

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
  // Info-Karte: erscheint beim Klick links neben dem gewählten Abzeichen und folgt ihm (eine Karte, je Auswahl neu gefüllt)
  const card = document.createElement('aside');
  card.className = 'hs-card';
  card.setAttribute('aria-live', 'polite');
  const meter = $('#edge-meter');
  const stage = $('#pyro-stage');   // Einblendung in der 3D-Ansicht (Temperatur, Phase, Gase), Texte aus science.js
  stage.innerHTML = `${hexBadge('thermo', 'hex--hs')}<span class="ps-T" id="ps-T"></span>` +
    `<span class="ps-text"><span class="ps-phase" id="ps-phase"></span><span class="ps-gas" id="ps-gas"></span></span>`;
  let markers = [];
  let current = -1;
  let level = null;
  let selected = null;
  let lastState = null;

  // ---------- Zoom-Schiene ----------
  rail.innerHTML = `
    <div class="rail-track"></div>
    <div class="rail-range"></div>
    <div class="rail-scan"></div>
    <div class="rail-hit"></div>
    ${LEVELS.map((l, i) => `
      <button type="button" class="rail-level" data-level="${i}" style="--y:${(railFrac(SCALE_M[l.id]) * 100).toFixed(2)}%;--f:${railFrac(SCALE_M[l.id]).toFixed(3)};--i:${i}"
        aria-label="Ebene ${i + 1}: ${esc(l.title)}, ${esc(l.scale)}">
        <span class="rail-mark">${hexBadge(LEVEL_ICONS[l.id], 'hex--rail')}<svg class="rail-ring" viewBox="0 0 40 40" aria-hidden="true"><path d="${HEX}"/></svg></span>
        <span class="rail-text"><span class="rail-scale">${esc(l.scale)}</span><span class="rail-name">${esc(l.name)}</span></span>
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

  // ---------- Infotafel ----------
  // Ebenen-Wechsel: Hex-Marke wie an der Schiene (zurück = gedreht), darunter das Ziel als „Maßstab · Name“
  for (const id of ['#btn-up', '#btn-down']) $(id).insertAdjacentHTML('afterbegin', hexBadge('dive', 'hex--nav'));
  const setNavTargets = (i) => [['#nav-up-to', LEVELS[i - 1]], ['#nav-down-to', LEVELS[i + 1]]]
    .forEach(([id, l]) => { $(id).textContent = l ? `${l.scale} · ${l.name}` : '–'; });
  $('#btn-up').addEventListener('click', () => handlers.onUp());
  $('#btn-down').addEventListener('click', () => handlers.onDown());
  $('#btn-panel').addEventListener('click', () => {
    const open = document.body.classList.toggle('panel-collapsed');
    $('#btn-panel').setAttribute('aria-expanded', String(!open));
  });

  function facts(list, levelId) {
    const icons = FACT_ICONS[levelId] || [];
    return `<div class="facts">${list.map((f, i) => `
      <div class="fact">${hexBadge(icons[i] || 'info', 'hex--fact')}
        <div class="fact-text"><span class="fact-value">${esc(f.value)}</span><span class="fact-label">${esc(f.label)}</span></div>
      </div>`).join('')}</div>`;
  }

  // Zeilen der Labortabelle: [Schlüssel, Name, Wert, Warnung] – gleiche Quelle für Aufbau und laufende Aktualisierung
  function labRows(t) {
    const p = labProps(t);
    const dash = '–';
    return [
      ['yield', 'Masseausbeute', `${fmt(p.yield)} %`, false],
      ['carbon', 'Kohlenstoffgehalt', `${fmt(p.carbon)} %`, false],
      ['hc', 'H/Corg (EBC < 0,7)', `${fmt(p.hc, 2)} ${p.hc < 0.7 ? '✓' : '⚠ über Grenzwert'}`, p.hc >= 0.7],
      ['oc', 'O/Corg (EBC < 0,4)', `${fmt(p.oc, 2)} ${p.oc < 0.4 ? '✓' : '⚠ über Grenzwert'}`, p.oc >= 0.4],
      ['bet', 'BET-Oberfläche', `≈ ${fmt(p.bet)} m²/g`, false],
      ['ph', 'pH-Wert', fmt(p.ph, 1), false],
      ['fperm', 'nach 100 Jahren im Boden (IPCC)', p.fperm === null ? dash : `${fmt(p.fperm * 100)} % des C`, false],
      ['co2', 'dauerhaft gebundenes CO₂', p.co2 === null ? dash : `${fmt(p.co2, 1)} t je t Biochar`, false],
      ['cls', 'Strukturtyp (Keiluweit 2010)', p.charClass, false],
    ];
  }

  function labTable(t) {
    const row = ([k, name, v, warn]) => `<tr${warn ? ' class="warn"' : ''} data-f="${k}"><th scope="row">${name}</th><td>${v}</td></tr>`;
    return `
      <table class="lab">${labRows(t).map(row).join('')}</table>
      <p class="note">Richtwerte für Holz, langsame Pyrolyse – reale Kohlen streuen je Rohstoff und Verfahren. Unter 350 °C Übergang vom Holz (Modell). CO₂ = C-Gehalt × IPCC-Faktor × 44/12.</p>`;
  }

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

  // Zeitraffer-Anzeige: Temperatur, Phase, Gase, Thermometer
  const BAR_MAX = 850;
  function pyroLive(T, playing) {
    const st = pyroState(T);
    return `
      <div class="pyro-live${playing ? ' is-playing' : ''}" id="pyro-live">
        <div class="pyro-head"><output id="pyro-T">${fmt(T)} °C</output><span id="pyro-phase">${esc(st.phase)}</span></div>
        <div class="pyro-bar" role="presentation"><i id="pyro-fill" style="width:${(Math.min(1, T / BAR_MAX) * 100).toFixed(1)}%"></i>
          <b style="left:${(DRAPER / BAR_MAX * 100).toFixed(1)}%" title="Draper-Punkt ≈ ${DRAPER} °C: Rotglut"></b></div>
        <p class="note" id="pyro-gas">Gase: ${esc(st.gas)}</p>
      </div>`;
  }

  // Phasenleiste unter dem Regler „Zieltemperatur“: je Phase ein Abschnitt in echter Breite (T_ROOM … T_MAX),
  // darunter die Grenze Holz | Pflanzenkohle bei T_MIN; hervorgehoben ist die Phase des Reglerwerts
  const PHASE_SPANS = PHASES.map((p, i) => Math.min(p.to, T_MAX) - (i ? PHASES[i - 1].to : T_ROOM));
  const phaseIndex = (T) => PHASES.findIndex((p) => T < p.to);
  const tempText = (T) => esc(`${fmt(T)} °C, ${pyroState(T).phase}`);
  function phaseScale(T) {
    const k = phaseIndex(T), on = (b) => (b ? ' class="is-on"' : '');
    return `
          <span class="phase-scale" aria-hidden="true">
            <span class="phase-bar" style="grid-template-columns:${PHASE_SPANS.map((w) => `${w}fr`).join(' ')}">${PHASE_SPANS.map((_, i) => `<i${on(i === k)}></i>`).join('')}</span>
            <span class="phase-zones" style="grid-template-columns:${T_MIN - T_ROOM}fr ${T_MAX - T_MIN}fr"><span${on(T < T_MIN)}>Holz</span><span${on(T >= T_MIN)}>Pflanzenkohle ab ${fmt(T_MIN)} °C</span></span>
          </span>`;
  }
  function markPhase(T) {
    const k = phaseIndex(T);
    panel.querySelectorAll('.phase-bar i').forEach((el, i) => el.classList.toggle('is-on', i === k));
    panel.querySelectorAll('.phase-zones span').forEach((el, i) => el.classList.toggle('is-on', i === +(T >= T_MIN)));
  }

  // Einblendung in der 3D-Ansicht: sichtbar, solange die Temperatur gleitet (Zeitraffer oder Reglerwechsel);
  // nach dem Ende STAGE_HOLD ms stehen lassen, dann ausblenden. Phasentext wechselt mit kurzer Überblendung.
  const STAGE_HOLD = 2200, SWAP_MS = 250;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stageOff = 0, stagePhase = '', stageSwap = 0, stageFresh = true;
  function setStage(done) {
    clearTimeout(stageOff);
    if (done) { stageOff = setTimeout(() => stage.classList.remove('is-on'), STAGE_HOLD); return; }
    if (!stage.classList.contains('is-on')) stageFresh = true;   // gerade erst eingeblendet: erster Text ohne Überblendung
    stage.classList.add('is-on');
  }
  function setStageText(st) {
    const fresh = stageFresh;
    stageFresh = false;
    if (st.phase === stagePhase) return;
    stagePhase = st.phase;
    const write = () => {
      $('#ps-phase').textContent = st.phase;
      $('#ps-gas').textContent = `Gase: ${st.gas}`;
      stage.classList.remove('is-swap');
    };
    clearTimeout(stageSwap);
    if (reducedMotion || fresh) { write(); return; }
    stage.classList.add('is-swap');
    stageSwap = setTimeout(write, SWAP_MS);
  }

  let hudTemp = 550, hudPlaying = false, lastLive = 0;
  function setLive(T, playing, done = false) {
    hudTemp = T;
    hudPlaying = playing;
    setStage(done);
    const now = performance.now();
    if (!done && now - lastLive < 40) return;    // ≈ 25 Hz reicht für Zahlen
    lastLive = now;
    const st = pyroState(T);
    $('#ps-T').textContent = `${fmt(T)} °C`;
    setStageText(st);
    const live = panel.querySelector('#pyro-live');
    if (!live) return;
    live.classList.toggle('is-playing', playing);
    panel.querySelector('#pyro-T').textContent = `${fmt(T)} °C`;
    panel.querySelector('#pyro-phase').textContent = st.phase;
    panel.querySelector('#pyro-gas').textContent = `Gase: ${st.gas}`;
    panel.querySelector('#pyro-fill').style.width = `${(Math.min(1, T / BAR_MAX) * 100).toFixed(1)}%`;
    for (const [k, , v, warn] of labRows(T)) {
      const tr = panel.querySelector(`tr[data-f="${k}"]`);
      if (!tr) continue;
      tr.firstElementChild.nextElementSibling.textContent = v;
      tr.classList.toggle('warn', warn);
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
    const btn = panel.querySelector('#btn-play');
    if (btn) {
      btn.textContent = playing ? '■ Anhalten' : '▶ Pyrolyse abspielen';
      btn.setAttribute('aria-pressed', String(playing));
    }
  }

  function render(state) {
    const l = LEVELS[current];
    const dyn = level && level.facts ? level.facts() : [];
    const hsList = level ? level.hotspots : [];
    const icons = HOTSPOT_ICONS[l.id] || {};
    const shown = state.pyro ? state.pyro.shown : state.temp, playing = !!(state.pyro && state.pyro.playing);
    const refs = l.refs.map((r) => `<a href="#quelle-${r}">[${r}]</a>`).join(' ');
    panel.innerHTML = `
      <p class="eyebrow">Ebene ${current + 1} von ${LEVELS.length} · Buche (Fagus sylvatica) · Größenordnung ${esc(l.scale)}</p>
      <h1>${esc(l.title)}</h1>
      <p class="lead">${esc(l.lead)}</p>
      <section>
        <h2 class="sub">Entdecken</h2>
        <ul class="explore">${hsList.map((h) => `
          <li><button type="button" data-hs="${h.id}" class="${h.kind === 'dive' ? 'is-dive' : ''}${selected && selected.id === h.id ? ' is-active' : ''}">
            ${hexBadge(icons[h.id], 'hex--mini')}${esc(l.hotspots[h.id].title)}${h.kind === 'dive' ? ' <span class="tag">tiefer</span>' : ''}
          </button></li>`).join('')}
        </ul>
      </section>
      ${facts([...l.facts, ...dyn], l.id)}
      <section class="controls">
        <h2 class="sub">Pyrolyse-Labor</h2>
        ${pyroLive(shown, playing)}
        <button type="button" class="btn-primary" id="btn-play" aria-pressed="${playing}">${playing ? '■ Anhalten' : '▶ Pyrolyse abspielen'}</button>
        <label class="slider">
          <span>Zieltemperatur <output id="out-temp">${fmt(state.temp)} °C</output></span>
          <input id="in-temp" type="range" min="${T_ROOM}" max="${T_MAX}" step="5" value="${state.temp}" aria-valuetext="${tempText(state.temp)}">
          ${phaseScale(state.temp)}
        </label>
        ${l.id === 'meso' ? rhBlock(state.rh, state.wet) : ''}
        <div id="lab">${labTable(shown)}</div>
        ${labChart(shown)}
      </section>
      <section class="sources">
        <h2 class="sub">Quellen dieser Ebene ${refs}</h2>
        <details>
          <summary>Alle Quellen</summary>
          <ol>${SOURCES.map((s) => `<li id="quelle-${s.id}"><a href="${s.url}" target="_blank" rel="noopener">${esc(s.text)}</a></li>`).join('')}</ol>
        </details>
      </section>`;

    panel.querySelectorAll('button[data-hs]').forEach((b) => b.addEventListener('click', () => handlers.onHotspot(b.dataset.hs)));
    const temp = panel.querySelector('#in-temp');
    temp.addEventListener('input', () => {
      const v = +temp.value;
      panel.querySelector('#out-temp').textContent = `${fmt(v)} °C`;
      temp.setAttribute('aria-valuetext', tempText(v));
      markPhase(v);
      handlers.onTemp(v);       // die Anzeige gleitet über setLive() mit der Szene
    });
    panel.querySelector('#btn-play').addEventListener('click', () => handlers.onPlay());
    temp.addEventListener('change', () => refreshFacts());
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
      if (v && v.textContent !== f.value) v.textContent = f.value;
      if (lab && lab.textContent !== f.label) lab.textContent = f.label;
    });
  }

  function refreshFacts() {
    if (!lastState || !level) return;
    const box = panel.querySelector('.facts');
    const l = LEVELS[current];
    if (box) box.outerHTML = facts([...l.facts, ...(level.facts ? level.facts() : [])], l.id);
  }

  // ---------- Hotspots: Punkt am Objekt, Abzeichen direkt daneben, Info-Karte links vom Abzeichen ----------
  // Messlinien (Ebene 5): Linie quer über die Pore in Bildebene, Länge = Ø aus dem Porenmodell, Beschriftung darüber
  const msSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  msSvg.setAttribute('class', 'ms-svg');
  msSvg.setAttribute('aria-hidden', 'true');
  let measures = [];
  let msRight = null;
  function buildMeasures() {
    for (const ms of measures) ms.lab.remove();
    msSvg.replaceChildren();
    measures = (level.measures || []).map((d) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.innerHTML = '<line class="ms-line"/><line class="ms-tick"/><line class="ms-tick"/>';
      msSvg.appendChild(g);
      const lab = document.createElement('div');
      lab.className = 'ms-lab';
      lab.innerHTML = `<b>Ø ${fmt(d.nm)} nm</b> · ${esc(d.name)} · Modell`;
      layer.appendChild(lab);
      return { d, g, lab, lines: g.querySelectorAll('line'), w: 0, hgt: 0 };
    });
    if (!msSvg.parentNode) layer.prepend(msSvg);
  }
  function updateMeasures(camera, width, height, rect, items) {
    if (!measures.length) return;
    msRight = msRight || camera.position.clone();
    msRight.setFromMatrixColumn(camera.matrixWorld, 0);
    const cardOpen = card.classList.contains('is-open') && !card.classList.contains('is-away');
    const cr = cardOpen ? card.getBoundingClientRect() : null;
    const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    const scr = (v) => [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height];
    for (const ms of measures) {
      const half = ms.d.nm / 20;   // Einheit 10 nm, halber Durchmesser
      const A = ms.d.pos.clone().addScaledVector(msRight, -half).project(camera);
      const B = ms.d.pos.clone().addScaledVector(msRight, half).project(camera);
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
      const [line, t1, t2] = ms.lines;
      const set = (el, x1, y1, x2, y2) => { el.setAttribute('x1', x1.toFixed(1)); el.setAttribute('y1', y1.toFixed(1)); el.setAttribute('x2', x2.toFixed(1)); el.setAttribute('y2', y2.toFixed(1)); };
      set(line, ax, ay, bx, by);
      set(t1, ax, ay - 7, ax, ay + 7);
      set(t2, bx, by - 7, bx, by + 7);
      ms.lab.style.transform = `translate(${Math.round(lx - ms.w / 2)}px, ${Math.round(ly - ms.hgt)}px)`;
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
      el.innerHTML = `${hexBadge(icons[h.id], 'hex--hs')}<span class="hsb-label">${esc(l.hotspots[h.id].title)}${h.kind === 'dive' ? '<span class="tag">tiefer</span>' : ''}</span>`;
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
    markers.forEach((m) => m.el.classList.remove('is-active'));
    panel.querySelectorAll('button[data-hs].is-active').forEach((b) => b.classList.remove('is-active'));
  }

  // Karte füllen: Titel mit Abzeichen, links neben dem Text die Lupe (Live-Ausschnitt der Szene, zeichnet main.js),
  // bei Tauchzielen der Knopf zum Hineinzoomen; jede Füllung blendet neu ein
  let lensCanvas = null;
  function fillCard() {
    if (!selected) { card.classList.remove('is-open'); lensCanvas = null; return; }
    const l = LEVELS[current], h = l.hotspots[selected.id], icons = HOTSPOT_ICONS[l.id] || {};
    card.innerHTML = `<div class="hs-card-in">
      <h2>${hexBadge(icons[selected.id], 'hex--mini')}<span>${esc(h.title)}</span>${selected.kind === 'dive' ? '<span class="tag">tiefer</span>' : ''}</h2>
      <div class="hs-body">
        <figure class="hs-lens" aria-hidden="true"><canvas></canvas></figure>
        <div class="hs-text"><p>${esc(h.text)}</p></div>
      </div>
      <div class="hs-card-foot">
        ${selected.kind === 'dive' ? '<button type="button" class="btn-primary" id="btn-dive">Hineinzoomen ↓</button>' : ''}
        <button type="button" class="hs-card-close">Schließen</button>
      </div></div>`;
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
  // neben dem Text (Textbreite wie ohne Lupe, die Karte wächst um die Spalte). Im schmalen Fenster (≤ 860 px) steht sie
  // ohne Platz links unter dem Abzeichen, mit der Lupe über dem Text
  const LENS_COL = 112 + 14;
  let cardW = 0, cardSide = '', cardBox = null;
  function placeCard(items, rect, width, height) {
    cardBox = null;
    if (!selected) return;
    const m = items.find((x) => x.h.id === selected.id);
    card.classList.toggle('is-away', !m);
    if (!m) return;
    const bx0 = Math.min(m.ax, m.x - m.w / 2) - 12, bx1 = Math.max(m.ax, m.x + m.w / 2) + 12;
    const roomL = bx0 - rect.x0 - LENS_COL, roomR = rect.x1 - bx1 - LENS_COL;
    const narrow = width <= 860;
    const side = narrow ? (roomL < 220 ? 'below' : 'left')
      : cardSide === 'right' && roomR >= 220 ? 'right' : roomL >= 220 ? 'left' : roomR >= 220 ? 'right' : 'vert';
    const stacked = narrow && side === 'below';
    card.classList.toggle('is-stacked', stacked);
    // Breite in 20-px-Stufen mit Hysterese: sonst folgt sie dem wandernden Abzeichen (Kamerafahrt im Leerlauf), der Blocksatz
    // bricht in jedem Bild anders um und die Karte flackert und zittert
    const room = side === 'left' ? roomL : side === 'right' ? roomR : rect.x1 - rect.x0 - LENS_COL;
    if (stacked) cardW = 0;
    else if (!cardW || side !== cardSide || room < cardW || room > cardW + 100) cardW = Math.min(340, Math.max(220, Math.floor((room - 30) / 20) * 20));
    cardSide = side;
    card.style.width = stacked ? '' : `${cardW + LENS_COL}px`;
    card.style.maxHeight = narrow ? '' : `${Math.floor(rect.y1 - rect.y0)}px`;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const by0 = m.y - m.hgt / 2 - 10, by1 = m.y + m.hgt / 2 + 10;
    const clampY = (y) => Math.min(Math.max(y, rect.y0), Math.max(rect.y0, rect.y1 - ch));
    let x, y;
    if (stacked) {   // ponytail: mobil darf die Karte noch über Leisten und Tafel ragen (Fensterhöhe), neue Anordnung folgt nach Vorschau
      x = Math.min(Math.max(8, m.x - cw / 2), width - cw - 8);
      y = Math.max(8, Math.min(by1, height - ch - 8));
    } else if (side === 'vert') {   // darunter, sonst darüber, sonst dort, wo mehr Platz ist – immer im freien Bereich
      x = Math.min(Math.max(m.x - cw / 2, rect.x0), Math.max(rect.x0, rect.x1 - cw));
      y = clampY(by1 + ch <= rect.y1 || (by0 - ch < rect.y0 && rect.y1 - by1 >= by0 - rect.y0) ? by1 : by0 - ch);
    } else {
      x = side === 'left' ? bx0 - cw : bx1;
      y = clampY(m.y - ch / 2);
    }
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;   // ganze Pixel: kein Flimmern der Schrift
    cardBox = [x - 8, y - 8, x + cw + 8, y + ch + 8];   // die anderen Abzeichen weichen im nächsten Bild aus
  }

  // freier Bereich zwischen Schiene, Tafel, Kopf- und Fußleiste
  function stageRect(width) {
    const r = (sel) => $(sel).getBoundingClientRect();
    const lad = r('.ladder'), pan = r('#panel'), top = r('.topbar'), bot = r('.bottombar');
    const narrow = width <= 860;
    const live = stage.classList.contains('is-on') ? stage.getBoundingClientRect().bottom : 0;   // Einblendung frei halten
    return {
      x0: narrow ? 8 : lad.right + 10,
      x1: pan.width > 0 && pan.left > width * 0.5 ? pan.left - 10 : width - 8,
      y0: Math.max(narrow ? lad.bottom : top.bottom, live) + 8,
      y1: Math.min(narrow && pan.width > 0 ? pan.top : Infinity, bot.top) - 8,   // mobil liegt die Knopfleiste über der Tafel
    };
  }

  return {
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
      if (!items.length) { card.classList.add('is-away'); updateMeasures(camera, width, height, rect, items); return; }
      // Abzeichen direkt neben den Punkt: links davon (rechts, wenn links kein Platz), dann sanft entzerren und im freien Bereich halten
      for (const m of items) {
        const leftFits = m.ax - GAP - m.w >= rect.x0;
        const right = !leftFits || (selected && m.h.id === selected.id);   // gewähltes Abzeichen rechts vom Punkt: links bleibt Platz für die Karte
        m.tx = right ? m.ax + GAP + m.w / 2 : m.ax - GAP - m.w / 2;
        m.ty = m.ay;
      }
      for (let it = 0; it < 6; it++) {
        for (const m of items) {
          m.tx = Math.min(Math.max(m.tx, rect.x0 + m.w / 2), rect.x1 - m.w / 2);
          m.ty = Math.min(Math.max(m.ty, rect.y0 + m.hgt / 2), rect.y1 - m.hgt / 2);
        }
        for (let a = 0; a < items.length; a++) {
          for (let b = a + 1; b < items.length; b++) {
            const A = items[a], B = items[b];
            const ox = (A.w + B.w) / 2 + 10 - Math.abs(A.tx - B.tx);
            const oy = (A.hgt + B.hgt) / 2 + 8 - Math.abs(A.ty - B.ty);
            if (ox <= 0 || oy <= 0) continue;
            // das gewählte Abzeichen bleibt an seinem Platz (Karte links davon), der Nachbar weicht ganz aus
            const sa = selected && A.h.id === selected.id, sb = selected && B.h.id === selected.id;
            const fa = sa ? 0 : sb ? 1 : 0.5, fb = sa ? 1 : sb ? 0 : 0.5;
            if (oy < ox) { const s = (A.ty < B.ty ? -1 : 1) * oy; A.ty += s * fa; B.ty -= s * fb; }
            else { const s = (A.tx < B.tx ? -1 : 1) * ox; A.tx += s * fa; B.tx -= s * fb; }
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
      // runde Balkenlänge 1/2/5 × 10^n, etwa ein Fünftel der Bildbreite
      const target = hfwMeters * 0.2;
      const pow = Math.pow(10, Math.floor(Math.log10(target)));
      const nice = [1, 2, 5, 10].map((k) => k * pow).reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
      $('#scalebar-bar').style.width = `${Math.round((nice / hfwMeters) * widthPx)}px`;
      $('#scalebar-label').textContent = formatLength(nice);
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
