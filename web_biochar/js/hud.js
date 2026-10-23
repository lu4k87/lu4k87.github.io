// Bedienoberfläche über der 3D-Szene: Zoom-Schiene (vertikal, log-Skala, ziehbar), Infotafel, Hotspots mit
// Leitlinien, REM-Datenleiste, Regler. Bildsprache: Hexagon-Badge + Leitlinie zum Objekt (Infografik-Vorlage).

import { LEVELS, SOURCES } from './content.js';
import { properties, labProps, pyroState, fmt, T_MIN, T_MAX, T_ROOM, DRAPER } from './science.js';
import { hexBadge, LEVEL_ICONS, HOTSPOT_ICONS, FACT_ICONS } from './icons.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SVG_NS = 'http://www.w3.org/2000/svg';

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
  const leaders = $('#leaders');
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
    <div class="rail-hit"></div>
    ${LEVELS.map((l, i) => `
      <button type="button" class="rail-level" data-level="${i}" style="--y:${(railFrac(SCALE_M[l.id]) * 100).toFixed(2)}%"
        aria-label="Ebene ${i + 1}: ${esc(l.title)}, ${esc(l.scale)}">
        ${hexBadge(LEVEL_ICONS[l.id], 'hex--rail')}
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
    let detail = '';
    if (selected) {
      const h = l.hotspots[selected.id];
      detail = `
        <section class="detail" aria-live="polite">
          <h2>${hexBadge(icons[selected.id], 'hex--mini')}${esc(h.title)}</h2>
          <p>${esc(h.text)}</p>
          ${selected.kind === 'dive' ? '<button type="button" class="btn-primary" id="btn-dive">Hineinzoomen ↓</button>' : ''}
        </section>`;
    }
    panel.innerHTML = `
      <p class="eyebrow">Ebene ${current + 1} von ${LEVELS.length} · Größenordnung ${esc(l.scale)}</p>
      <h1>${esc(l.title)}</h1>
      <p class="lead">${esc(l.lead)}</p>
      ${detail}
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
          <input id="in-temp" type="range" min="${T_MIN}" max="${T_MAX}" step="10" value="${state.temp}">
        </label>
        ${l.id === 'meso' ? `
        <label class="slider">
          <span>Relative Luftfeuchte <output id="out-rh">${fmt(state.rh * 100)} %</output></span>
          <input id="in-rh" type="range" min="0" max="0.99" step="0.01" value="${state.rh}">
        </label>` : ''}
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
    const dive = panel.querySelector('#btn-dive');
    if (dive) dive.addEventListener('click', () => handlers.onDive(selected.id));
    const temp = panel.querySelector('#in-temp');
    temp.addEventListener('input', () => {
      panel.querySelector('#out-temp').textContent = `${fmt(+temp.value)} °C`;
      handlers.onTemp(+temp.value);       // die Anzeige gleitet über setLive() mit der Szene
    });
    panel.querySelector('#btn-play').addEventListener('click', () => handlers.onPlay());
    temp.addEventListener('change', () => refreshFacts());
    const rh = panel.querySelector('#in-rh');
    if (rh) {
      rh.addEventListener('input', () => {
        panel.querySelector('#out-rh').textContent = `${fmt(+rh.value * 100)} %`;
        handlers.onRh(+rh.value);
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

  // ---------- Hotspots: Punkt, Leitlinie, Abzeichen ----------
  function buildMarkers() {
    const l = LEVELS[current];
    const icons = HOTSPOT_ICONS[l.id] || {};
    for (const m of markers) { m.el.remove(); m.dot.remove(); m.path.remove(); }
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
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', `leader${h.kind === 'dive' ? ' leader--dive' : ''}`);
      path.setAttribute('pathLength', '1');
      // Reihenfolge beim Erscheinen: Punkt → Linie zeichnet sich → Abzeichen, gestaffelt je Hotspot
      dot.style.transitionDelay = `${i * 90}ms`;
      path.style.transitionDelay = `${i * 90 + 120}ms`;
      el.style.transitionDelay = `${i * 90 + 420}ms`;
      layer.append(dot, el);
      leaders.appendChild(path);
      return { h, el, dot, path, x: NaN, y: NaN, w: 0, hgt: 0 };
    });
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
      $('#sb-method').textContent = lv.method;
      render(state);
      panel.classList.remove('is-entering');
      void panel.offsetWidth;
      panel.classList.add('is-entering');
      panel.scrollTop = 0;
      buildMarkers();
    },
    setRailRange(hfwMin, hfwMax) {
      railLimits = { min: hfwMin, max: hfwMax };
      const y0 = railFrac(hfwMax), y1 = railFrac(hfwMin);
      range.style.setProperty('--y0', `${(y0 * 100).toFixed(2)}%`);
      range.style.setProperty('--y1', `${(y1 * 100).toFixed(2)}%`);
    },
    select(id, state) {
      selected = level.hotspots.find((h) => h.id === id) || null;
      lastState = state;
      render(state);
      markers.forEach((m) => m.el.classList.toggle('is-active', selected && m.h.id === id));
      const d = panel.querySelector('.detail');
      if (d) d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
    refreshFacts,
    tickFacts,
    setLive,
    hideMarkers(hidden) {
      layer.classList.toggle('is-hidden', hidden);
    },
    updateMarkers(camera, width, height) {
      leaders.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const v = camera.position.clone();
      const rect = stageRect(width);
      const reach = width <= 860 ? 64 : 112;
      const items = [];
      for (const m of markers) {
        const p = m.h.pos.clone().project(camera);
        let visible = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
        if (visible && m.h.normal) visible = m.h.normal.dot(v.clone().sub(m.h.pos)) > 0;
        m.el.classList.toggle('is-off', !visible);
        m.dot.classList.toggle('is-off', !visible);
        m.path.classList.toggle('is-off', !visible);
        if (!visible) continue;
        m.ax = ((p.x + 1) / 2) * width;
        m.ay = ((1 - p.y) / 2) * height;
        if (!m.w) { m.w = m.el.offsetWidth; m.hgt = m.el.offsetHeight; }
        items.push(m);
      }
      if (!items.length) return;
      // Abzeichen vom Schwerpunkt der Punkte weg nach außen setzen, dann sanft entzerren und im freien Bereich halten
      const cx = items.reduce((s, m) => s + m.ax, 0) / items.length;
      const cy = items.reduce((s, m) => s + m.ay, 0) / items.length;
      items.forEach((m, i) => {
        let dx = m.ax - cx, dy = m.ay - cy;
        const len = Math.hypot(dx, dy);
        if (len < 1) { dx = i % 2 ? -1 : 1; dy = -0.7; } else { dx /= len; dy /= len; }
        dy -= 0.25;
        const n = Math.hypot(dx, dy);
        m.tx = m.ax + (dx / n) * reach;
        m.ty = m.ay + (dy / n) * reach;
      });
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
            if (oy < ox) { const s = (A.ty < B.ty ? -1 : 1) * oy / 2; A.ty += s; B.ty -= s; }
            else { const s = (A.tx < B.tx ? -1 : 1) * ox / 2; A.tx += s; B.tx -= s; }
          }
        }
      }
      for (const m of items) {
        if (Number.isNaN(m.x)) { m.x = m.tx; m.y = m.ty; }
        else { m.x += (m.tx - m.x) * 0.22; m.y += (m.ty - m.y) * 0.22; }
        const left = m.x < m.ax;                       // Abzeichen links vom Punkt → Linie endet an seiner rechten Kante
        const edgeX = left ? m.x + m.w / 2 : m.x - m.w / 2;
        const kneeX = edgeX + (left ? 22 : -22);
        m.el.style.transform = `translate(${(m.x - m.w / 2).toFixed(1)}px, ${(m.y - m.hgt / 2).toFixed(1)}px)`;
        m.dot.style.transform = `translate(${m.ax.toFixed(1)}px, ${m.ay.toFixed(1)}px)`;
        m.path.setAttribute('d', `M${m.ax.toFixed(1)} ${m.ay.toFixed(1)}L${kneeX.toFixed(1)} ${m.y.toFixed(1)}L${edgeX.toFixed(1)} ${m.y.toFixed(1)}`);
      }
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
