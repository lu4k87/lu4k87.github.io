// HUD v3: Kopfleiste (Marke, Brotkrumen, 3 Ebenen, „wartet auf dich“, Sicherheitszone) + Inhalt der 3 Ebenen in 6 Formen:
// A stack: Ebenen-Stapel links, einer offen, je Ebene „Zuletzt“ · B card: Karte am Objekt, nächste Handlung am größten ·
// C cmd: Befehlspalette, Normalfall ruhig · D kanban: Phasen-Spalten + erklärende Schublade · E miller: Haus | Bereich | Detail
// nebeneinander · F guide: Lotse Kubi + Schublade (eigene Empfehlung).
import * as THREE from 'three';
import * as WF from './data/wf.js';
import { STATIONS, ICON } from './office.js';
import { TOOL, CUBE, drawFace } from './cast.js';
import { ABOUT, PHASE_COLOR, phaseOfStep, homeOf, itemsOf, detailOf, searchAll } from './items.js';
import { UNDER_OPS, opsChat, opsSend, noteOf } from './ops.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PHASES = WF.PHASES;
const SUN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9L13 13M3 13l1.1-1.1M11.9 4.1L13 3"/></svg>';
const MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1z"/></svg>';
const STEP_STATION = { 1: 'tresen', 2: 'roles', 3: 'skills', 4: 'roles', 5: 'previews', 6: 'bench', 7: 'qa', 8: 'docs', 9: 'post', 10: 'tresen' };
const TOUR = [
  { l: 1, say: 'Hallo, ich bin Kubi! Das ist dein Büro von oben. Jede farbige Fläche ist ein Bereich – klick einen an, dann fliegen wir hin.' },
  { l: 2, s: 'tresen', say: 'Am Tresen gibst du Aufträge – probier es: Art und Werkzeug wählen, Titel tippen, „Geben“. Daraus wird ein Chat, der durch das Büro läuft und mit einer Antwort zurückkommt.' },
  { l: 2, s: 'roles', say: 'Am Hutständer wechseln Chats die Rolle: Organizer, Fachrolle, Prüfer, Synchronizer. Der Hut zeigt, was gerade dran ist.' },
  { l: 3, item: { type: 'role', id: 'designer', station: 'bench' }, say: 'Ganz nah: die Designer-Rolle. Unten stehen ihre Skills und Agenten – ein Klick fliegt direkt hin.' },
  { l: 2, s: 'agents', say: 'In der Agentur warten 16 Helfer. Violett heißt Opus für Urteil, Türkis heißt Sonnet für leichte Prüfarbeit.' },
  { l: 3, item: { type: 'agent', id: 'safety-reviewer', station: 'agents' }, say: 'Der safety-reviewer prüft alles, was den Roboter bewegen könnte – vor jedem Commit.' },
  { l: 2, s: 'robot', say: 'Die Roboter-Ecke ist die Sicherheitszone. Robot | Hardware gibst nur du frei, sonst niemand.' },
  { l: 1, say: 'Das war die Runde! Esc bringt dich eine Ebene zurück, ‹ › oder die Pfeiltasten blättern durch die Bereiche, die Leertaste hält das Büro an.' },
];

export function createShell(ctx) {
  const { S, W, D, V, levels, live, camera, renderer, walkYou, hilite = () => {}, sim = { paused: false, speed: 1 }, anchor = () => null, world = () => {} } = ctx;
  let shell = V.shell; const st = levels.state, memo = { station: null, item: null }, combo = !!V.combo;
  // Kombination (Variante K): Darstellung + Schalter je Betrachter (Browser-Speicher), URL-Parameter gehen vor (Aufnahmen)
  // pv 2 (2026-10-20): „band“ ist jetzt die Phasen-Zeile im Haus (Haus:B), Standard an – alter gespeicherter Wert gilt nicht mehr
  const prefs = { view: 'card', follow: true, band: true, lotse: false, speed: 1, cam: 'ruhig', welt: true, pv: 2 };
  if (combo) {
    try { const p = JSON.parse(localStorage.getItem('buero.prefs') || '{}'); if (p.pv !== 2) delete p.band; Object.assign(prefs, p, { pv: 2 }); } catch { /* privat/gesperrt: Standard */ }
    const Q = new URLSearchParams(location.search);
    if (['card', 'stack', 'miller', 'guide'].includes(Q.get('view'))) prefs.view = Q.get('view');
    ['follow', 'band', 'lotse', 'welt'].forEach(k => { if (Q.has(k)) prefs[k] = Q.get(k) === '1'; });
    shell = prefs.view; document.documentElement.dataset.shell = shell;
    if (![0.5, 1, 2, 4].includes(prefs.speed)) prefs.speed = 1; sim.speed = prefs.speed;
    if (Q.get('cam')) prefs.cam = Q.get('cam');
  }
  levels.setCam(prefs.cam);
  const savePrefs = () => { try { localStorage.setItem('buero.prefs', JSON.stringify(prefs)); } catch { /* egal */ } };
  let placed = false, side = null;   // Karte (B) einmal gesetzt, wenn „Karte folgt“ aus ist; side = Seite der Karte neben dem Ziel
  let tour = -1, lastWait = 0;
  let fold = { all: false, about: false }, mobOpen = false;   // Bereichskarte: eingeklappte Teile · Handy: Panel nur als Zeile, bis „Details ▴“
  const reducedUi = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrowNow = () => innerWidth <= 760;
  const el = document.createElement('div'); el.id = 'v3';
  el.innerHTML = `
  <svg id="lead" aria-hidden="true"><line id="lead-l"></line></svg>
  <header id="bar" class="c3">
    <div class="brand"><b>Agenten-Büro</b><span id="src" class="badge">Demo-Daten</span></div>
    <nav id="crumbs" aria-label="Wo du bist"></nav>
    <button id="ask" hidden></button>
    <ol id="steps" aria-label="Zoom-Ebenen"><li data-l="1"><button data-level="1">Haus</button></li><li data-l="2"><button data-level="2">Bereich</button></li><li data-l="3"><span>Detail</span></li></ol>
    <button id="play" class="tb" aria-pressed="false" aria-label="Simulation anhalten (Leertaste)" title="Pause (Leertaste)"><svg class="pi" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg><span class="tl">Pause</span></button>
    <button id="find" class="tb" hidden aria-label="Suchen (Taste /)" title="Suchen (Taste /)"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3.5 3.5"/></svg><span class="tl">Suchen</span><kbd>/</kbd></button>
    <button id="view-btn" class="tb" hidden aria-haspopup="true" aria-expanded="false" aria-controls="viewmenu" title="Ansicht: Darstellung, Kamera, Schalter"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M6 2.5v11M6 7h8"/></svg><span class="tl">Ansicht</span></button>
    <button id="theme" class="tb" aria-pressed="false"><span aria-hidden="true">☾</span><span class="tl">Nacht</span></button>
    <div id="safe" title="Betriebsart des Roboters – nur Anzeige, das Büro bewegt nie einen Roboter"><span id="mode">Robot | Digital Twin</span></div>
  </header>
  <div id="cmd" hidden><label class="cmd-box"><span class="cmd-ic" aria-hidden="true">⌕</span><input id="cmd-in" type="search" placeholder="Wohin? Bereich, Agent, Skill, Chat …" autocomplete="off" aria-label="Wohin"><kbd>/</kbd></label><ul id="cmd-res" role="listbox"></ul></div>
  <div id="viewmenu" class="c3" hidden role="dialog" aria-label="Ansicht"></div>
  <section id="panel" class="c3" aria-live="polite"></section>
  <div id="dock"><section id="ticker" class="c3" hidden aria-label="Offene Rückfrage" aria-live="polite"></section><section id="band" class="c3" hidden aria-label="Phasen-Band"></section></div>
  <div id="pin" hidden></div>
  <div id="tags"></div>
  <aside id="guide" class="c3" hidden><canvas id="guide-face" width="168" height="168" aria-hidden="true"></canvas><div class="g-body"><p class="g-name">Kubi · dein Lotse</p><p id="guide-text"></p><div class="g-act" id="guide-act"></div></div></aside>`;
  document.body.appendChild(el);
  const $ = s => el.querySelector(s), panel = $('#panel');

  const chatOf = id => S.chats.find(c => c.id === id);
  const exOf = c => S.ex.find(e => e.chat === c);
  const titleOf = it => it.type === 'chat' ? it.id : detailOf(it.type, it.id, D, S).title;
  const phaseOf = id => PHASES.find(p => p.id === STATIONS[id].phase);
  const byPhase = ph => Object.keys(STATIONS).filter(id => STATIONS[id].phase === ph);

  // ───────── Bausteine
  // Kennzahlen als Knöpfe: Klick fliegt zum passenden Bereich (wartet → erste Rückfrage)
  const kpis = () => {
    const n = S.chats.filter(c => c.alive).length, w = S.ex[0];
    const k = (v, t, at, hot) => `<li${hot ? ' class="hot"' : ''}><button ${at}><b>${v}</b><span>${t}</span></button></li>`;
    return `<ul class="kpis">${k(n, 'Chats aktiv', 'data-station="doors"')}${k(S.ex.length, 'warten auf dich', w ? `data-item="chat:${esc(w.chat.id)}" data-from="${w.chat.a.station || 'doors'}"` : 'data-station="doors"', S.ex.length)}${k(S.stats.done, 'erledigt', 'data-station="tresen"')}${k(S.stats.commits, 'Commits', 'data-station="post"')}</ul>`;
  };
  const exIc = e => e.kind === 'approve' ? '🔒' : e.kind === 'preview' ? '🖼️' : '❓';
  const exAt = e => `data-item="chat:${esc(e.chat.id)}" data-from="${e.chat.a.station || 'doors'}"`;
  // Kombination: offene Rückfragen stehen in Kopfleiste + Laufzeile unten (Kopf:C, Frage:B), nicht zusätzlich in den Panels
  const waitList = (calm = true) => S.ex.length
    ? combo ? '' : `<ul class="waits">${S.ex.map(e => `<li><button class="w" data-item="chat:${esc(e.chat.id)}"><span class="w-ic">${exIc(e)}</span><span class="w-t"><b>${esc(e.question)}</b><small>${esc(e.chat.id)} · ${esc(e.chat.tool)}</small></span><span class="go">Antworten ›</span></button></li>`).join('')}</ul>`
    : calm ? `<p class="calm">✓ Nichts wartet auf dich – ${S.chats.filter(c => c.alive).length} Chats arbeiten.</p>` : '';
  const stationChip = id => `<button class="chip st" data-station="${id}"><span class="ci" style="--ph:${PHASE_COLOR[STATIONS[id].phase]}">${ICON[id]}</span>${esc(STATIONS[id].name)}</button>`;
  const chatChip = c => `<button class="chip ch${exOf(c) ? ' hot' : ''}" data-item="chat:${esc(c.id)}"><span class="tdot" style="--tc:${CUBE[c.tool].body}"></span>${esc(c.id)}${exOf(c) ? ' ❓' : ''}</button>`;
  // Ablauf-Leiste (Haus): 5 Phasen untereinander, je Phase ihre Bereiche und die Chats, die gerade dort arbeiten
  const flow = named => `<section><h4 class="mh">So läuft ein Auftrag <span class="cnt">5 Phasen</span></h4><ol class="flow">${PHASES.map((p, i) => {
    const cs = S.chats.filter(c => c.alive && phaseOfStep(c.step || 1) === p.id), nx = PHASES[i + 1] || p;
    const st = byPhase(p.id).map(id => named ? stationChip(id) : `<button class="ic" data-station="${id}" title="${esc(STATIONS[id].name)}" aria-label="${esc(STATIONS[id].name)}">${ICON[id]}</button>`).join('');
    return `<li style="--ph:${PHASE_COLOR[p.id]};--ph2:${PHASE_COLOR[nx.id]}"><span class="fl-n">${p.n}</span><div class="fl-b"><p class="fl-h"><b>${esc(p.name)}</b><small>${esc(p.who)}</small></p><div class="${named ? 'chips' : 'fl-st'}">${st}</div>${cs.length ? `<div class="fl-ch">${cs.map(chatChip).join('')}</div>` : ''}</div></li>`;
  }).join('')}</ol></section>`;
  const dotL = (k, t) => `<span><span class="dot" style="--tc:${CUBE[k].body}"></span>${esc(t)}</span>`;
  const toolLegend = () => `<p class="legend">${['Claude', 'Codex', 'Gemini'].map(t => dotL(t, `${t} · ${S.chats.filter(c => c.alive && c.tool === t).length}`)).join('')}</p>`;
  // Farbschlüssel je Bereich: dieselben Farben wie die Figuren im Raum
  const LEGEND = { agents: [['Opus', 'Opus · Urteil'], ['Sonnet', 'Sonnet · leichte Prüfarbeit']], doors: [['Claude', 'Claude'], ['Codex', 'Codex'], ['Gemini', 'Gemini']] };
  const legend = id => LEGEND[id] ? `<p class="legend">${LEGEND[id].map(([k, t]) => dotL(k, t)).join('')}</p>` : '';
  const dotOf = i => { const k = i.type === 'chat' ? (chatOf(i.id) || {}).tool : i.type === 'agent' ? ((D.agents || []).find(a => a.id === i.id) || WF.AGENTS.find(a => a.id === i.id) || {}).model : ''; return CUBE[k] ? CUBE[k].body : ''; };
  // Phasen-Spur: wo im Ablauf liegt dieser Bereich? Die anderen Abschnitte führen zum ersten Bereich ihrer Phase
  const track = ph => `<ol class="track" aria-label="Phase im Ablauf">${PHASES.map(p => `<li class="${p.id === ph ? 'on' : ''}" style="--ph:${PHASE_COLOR[p.id]}">${p.id === ph ? `<span>${p.n} · ${esc(p.name)}</span>` : `<button data-station="${byPhase(p.id)[0]}" title="${p.n} · ${esc(p.name)}" aria-label="Phase ${p.n} · ${esc(p.name)}"></button>`}</li>`).join('')}</ol>`;
  const ctxLine = hs => STATIONS[hs] ? `<p class="ctx"><span class="pd" style="--ph:${PHASE_COLOR[STATIONS[hs].phase]}"></span>Phase ${phaseOf(hs).n} · ${esc(phaseOf(hs).name)} · liegt in ${stationChip(hs)}</p>` : '';
  const hereNow = id => { const cs = S.chats.filter(c => c.alive && c.a.station === id); return cs.length ? `<div class="links now"><h4>Gerade hier</h4><div class="chips">${cs.map(chatChip).join('')}</div></div>` : ''; };
  const head = (icon, kick, title, sub, ph, nav = '') => `<header class="head"><span class="hi"${ph ? ` style="--ph:${ph}"` : ''}>${icon}</span><div class="ht"><p class="kick">${esc(kick)}</p><h2>${esc(title)}</h2>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div>${nav}</header>`;
  const about = (id, big) => { const [a, d] = ABOUT[id] || ['', '']; return big ? `<div class="explain"><p><b>Was ist das?</b> ${esc(a)}</p><p><b>Was kann ich hier tun?</b> ${esc(d.charAt(0).toUpperCase() + d.slice(1))}.</p></div>` : `<p class="about">${esc(a)}</p>`; };
  // Bereiche in Phasen-Reihenfolge: Blättern ‹ › (auch Pfeiltasten) – der Zeiger auf ‹ › zeigt das Ziel im Raum
  const ORDER = PHASES.flatMap(p => byPhase(p.id));
  const stepNav = id => { const i = ORDER.indexOf(id), n = ORDER.length, a = ORDER[(i - 1 + n) % n], b = ORDER[(i + 1) % n];
    return `<nav class="stnav" aria-label="Bereiche nacheinander"><button class="nb" data-station="${a}" title="‹ ${esc(STATIONS[a].name)}" aria-label="Voriger Bereich: ${esc(STATIONS[a].name)}">‹</button><span class="nc">${i + 1}/${n}</span><button class="nb" data-station="${b}" title="${esc(STATIONS[b].name)} ›" aria-label="Nächster Bereich: ${esc(STATIONS[b].name)}">›</button></nav>`; };
  const LIST = { tresen: 'Aufträge', doors: 'Chats im Büro', roles: 'Rollen', bench: 'Fachrollen', agents: 'Subagenten', skills: 'Skills', memory: 'Erkenntnisse', repos: 'Repos', mcp: 'Anschlüsse', hooks: 'Hook-Stellen', claims: 'Claims', previews: 'Vorschauseiten, neueste zuerst', settings: 'Dateien', sync: 'Ablauf', qa: 'Prüfstufen', robot: 'Regeln', post: 'Schritte', docs: 'Schritt' };
  const rows = (id, limit = 60) => {
    const it = itemsOf(id, D, S), sel = st.item ? st.item.type + ':' + st.item.id : '';
    const total = id === 'previews' ? (D.previews || []).length : it.length;
    return `<h4 class="mh">${esc(LIST[id] || 'Einträge')} <span class="cnt">${it.length < total ? `${it.length} von ${total}` : total}</span></h4>` + (it.length ? `<ul class="rows">${it.slice(0, limit).map(i => `<li><button class="row${i.hot ? ' hot' : ''}${sel === i.type + ':' + i.id ? ' sel' : ''}" data-item="${i.type}:${esc(i.id)}" data-from="${id}"><span class="r-t">${dotOf(i) ? `<span class="dot" style="--tc:${dotOf(i)}"></span>` : ''}<span>${esc(i.title)}</span></span><span class="r-m">${esc(i.meta || '')}</span><span class="r-go" aria-hidden="true">›</span></button></li>`).join('')}</ul>${it.length > limit ? `<p class="more">+ ${it.length - limit} weitere – Suche mit /</p>` : ''}` : `<p class="calm">${id === 'claims' ? 'Gerade hält kein Chat einen Claim.' : 'Keine Einträge.'}</p>`);
  };
  const stepsHere = id => { const s = Object.entries(STEP_STATION).filter(([, v]) => v === id).map(([n]) => WF.STEPS[n - 1]); return s.length ? `<p class="steps-here">Im Ablauf: ${s.map(x => `<span class="sn">${x.n}</span> ${esc(x.name)}`).join(' · ')}</p>` : ''; };
  const stationBlock = (id, explain) => { const p = phaseOf(id); return head(ICON[id], `Bereich · ${STATIONS[id].cat}`, STATIONS[id].name, STATIONS[id].sub, PHASE_COLOR[p.id], stepNav(id)) + track(p.id) + about(id, explain) + legend(id) + stepsHere(id) + (combo ? action(id) : '') + hereNow(id) + rows(id); };
  const back = () => `<div class="acts"><button class="b" data-level="2">‹ Zurück zum Bereich</button></div>`;
  function detailBlock(item, opt = {}) {
    if (item.type === 'chat') return chatBlock(chatOf(item.id), opt, item.id);
    const d = detailOf(item.type, item.id, D, S), hs = item.station || homeOf(item.type, item.id), hp = STATIONS[hs] && PHASE_COLOR[STATIONS[hs].phase];
    return head(d.icon, d.kick, d.title, '', hp) + ctxLine(hs)
      + (d.chips.length ? `<div class="tags">${d.chips.map(c => `<span class="tag">${CUBE[c] ? `<span class="dot" style="--tc:${CUBE[c].body}"></span>` : ''}${esc(c)}</span>`).join('')}</div>` : '')
      + (d.desc ? `<p class="desc">${esc(d.desc)}</p>` : '')
      + (d.list ? `<ul class="plain">${d.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '')
      + (d.fields.length ? `<dl class="kv">${d.fields.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '')
      + [d.now, d.links].filter(g => g && g.items.length).map(g => `<div class="links${g === d.now ? ' now' : ''}"><h4>${esc(g.title)}</h4><div class="chips">${g.items.map(l => `<button class="chip lk" data-item="${l.type}:${esc(l.id)}">${esc(l.label)} <span aria-hidden="true">›</span></button>`).join('')}</div></div>`).join('')
      + (d.href ? `<div class="acts"><a class="b primary" href="${esc(d.href)}" target="_blank" rel="noopener">Öffnen ↗</a></div>` : '')
      + (opt.noBack ? '' : back());
  }
  // ───────── Chat (Ebene 3): Weg des Auftrags · Rückfrage · Verlauf (echt aus Claude Ops oder Demo) · Senden · Querverweise
  const hist = new Map(), notes = new Map(); let histBusy = false;
  const isLive = c => !!(c && c.live && live.ok && c.sid);
  function loadHist(c) {   // echter Verlauf, höchstens alle 5 s; Fehler → Demo-Verlauf + Hinweis
    const h = hist.get(c.id); if (histBusy || (h && performance.now() - h.t < 5000)) return;
    histBusy = true;
    opsChat(c.sid).then(m => hist.set(c.id, { t: performance.now(), m }), () => hist.set(c.id, { t: performance.now(), m: null })).finally(() => { histBusy = false; render(false); });
  }
  const sendNote = c => notes.get(c.id) || (isLive(c) ? (UNDER_OPS ? 'live · Senden über Claude Ops (Claude: Text steht in VS Code, Enter drückst du dort)' : 'live · nur lesen – Senden geht nur unter Claude Ops /agenten-buero/') : 'Demo-Chat: deine Nachricht erscheint im Verlauf, keine echte Zustellung');
  function weg(c) {
    const o = c.order, T = WF.ORDER_TYPES[o.type];
    return `<div class="weg"><h4 class="mh">Weg dieses Auftrags <span class="cnt">${esc(T.name)}</span></h4><ol class="wg">${WF.STEPS.map(x => {
      const skip = !T.steps.includes(x.n), now = x.n === c.step, done = !now && o.stepsDone.has(x.n);
      return `<li><button class="wgs${done ? ' done' : ''}${now ? ' now' : ''}${skip ? ' skip' : ''}" style="--ph:${PHASE_COLOR[x.phase]}" data-step="${x.n}" title="${x.n} · ${esc(x.name)}" aria-label="Schritt ${x.n}: ${esc(x.name)}${skip ? ' – entfällt' : done ? ' – erledigt' : now ? ' – jetzt' : ''}">${x.n}</button></li>`;
    }).join('')}</ol><p class="wnow"><b>Jetzt:</b> ${c.step ? `${c.step} · ${esc(WF.STEPS[c.step - 1].name)}` : 'Chat-Start'}${c.a.station ? ` <span class="at">bei</span> ${stationChip(c.a.station)}` : ''}</p></div>`;
  }
  function chatBlock(c, opt = {}, id = '') {
    if (!c) {   // Chat hat das Büro verlassen: Ergebnis des Auftrags statt leerer Karte
      const o = S.orders.find(x => x.chat && x.chat.id === id);
      return head('🏁', 'Chat · fertig', id || 'Chat', o ? `[${o.prefix}] ${o.title}` : '') + `<p class="calm">✓ Fertig und abgeliefert${o && o.hash ? ` · gepusht <code>${esc(o.hash)}</code>` : ''} – der Chat hat das Büro verlassen.</p>`
        + (o ? `<div class="links"><h4>Verknüpft</h4><div class="chips"><button class="chip lk" data-item="order:${esc(o.id)}">🛎️ Auftrag <span aria-hidden="true">›</span></button></div></div>` : '') + (opt.noBack ? '' : back());
    }
    const ex = exOf(c), R = c.role ? WF.ROLES[c.role] : null, o = c.order, real = isLive(c);
    if (real) loadHist(c);
    const h = real && hist.get(c.id), msgs = (h && h.m) || c.msgs;
    const who = m => m.role === 'user' ? 'Du' : m.role === 'tools' ? 'Werkzeuge' : m.role === 'ask' ? 'Rückfrage' : c.id;
    return head(`<span class="temb lg" style="--tc:${CUBE[c.tool].body}">${TOOL[c.tool].emblem}</span>`, `${c.tool} · Chat · ${real ? 'live' : 'Demo'}`, c.id, real && c.title ? c.title : `[${o.prefix}] ${o.title}`)
      + `<div class="tags"><span class="tag">${R ? esc(R.icon + ' ' + R.name) : '🚪 Chat-Start'}</span><span class="tag">[${esc(o.prefix)}]</span>${real ? '<span class="tag live">live</span>' : '<span class="tag">Demo</span>'}</div>`
      + weg(c)
      + (ex && !inTicker(ex) ? `<div class="askbox"><p class="q">❓ ${esc(ex.question)}</p><div class="acts">${ex.choices.map(ch => `<button class="b ask" data-choice="${ex.id}|${esc(ch)}">${esc(ch)}</button>`).join('')}</div><p class="note">Deine Auswahl ist die Antwort – der Chat arbeitet direkt weiter.</p></div>` : '')
      + `<h4 class="mh">Verlauf <span class="cnt">${real ? (h ? (h.m ? 'echt · Claude Ops' : 'Claude Ops nicht erreichbar · Demo') : 'lädt …') : 'Demo'}</span></h4><ul class="msgs">${msgs.slice(-6).map(m => `<li class="${m.role}"><small>${esc(who(m))}</small>${esc(m.text)}</li>`).join('')}</ul>`
      + `<div class="send"><input id="msg-in" type="text" placeholder="Nachricht an ${esc(c.id)} …" maxlength="2000" aria-label="Nachricht an ${esc(c.id)}"><button class="b primary" data-send="${esc(c.id)}">Senden</button></div>`
      + `<p class="note" id="send-note">${esc(sendNote(c))}</p>`
      + `<div class="links"><h4>Verknüpft</h4><div class="chips"><button class="chip lk" data-item="order:${esc(o.id)}">🛎️ Auftrag <span aria-hidden="true">›</span></button>${R ? `<button class="chip lk" data-item="role:${esc(c.role)}">${esc(R.icon + ' ' + R.name)} <span aria-hidden="true">›</span></button>` : ''}</div></div>`
      + (opt.noBack ? '' : back());
  }
  const LOGI = { order: '🛎️', hook: '🎛️', skill: '📚', agent: '🤖', mcp: '🔌', ask: '❓', err: '❌', ok: '✅', warn: '⚠️', sync: '🚉', info: '💬' };
  const logBlock = (pred, title = 'Zuletzt', n = 5) => { const e = S.log.filter(pred).slice(0, n); return e.length ? `<div class="log"><h4>${title}</h4><ul>${e.map(x => {
    const inner = `<span class="lw"><span aria-hidden="true">${LOGI[x.kind] || '•'}</span> ${esc(x.who)}</span>${esc(x.text)}`, c = x.cid && chatOf(x.cid);
    return `<li class="k-${x.kind}">${c && c.alive ? `<button class="lg" data-item="chat:${esc(x.cid)}">${inner}</button>` : `<div class="lg">${inner}</div>`}</li>`; }).join('')}</ul></div>` : ''; };
  const logHere = () => logBlock(e => S.chats.some(c => c.name === e.who && c.a.station === st.station), 'Zuletzt hier');
  const logItem = () => st.item && st.item.type !== 'chat' ? logBlock(e => (e.text + e.who).includes(st.item.id), 'Zuletzt dazu') : '';

  // ───────── Neuer Auftrag am Tresen (nur im Büro: eigener Demo-Chat, nie an einen echten Chat)
  const OT = [['q', '❔ Frage'], ['small', '✏️ Klein'], ['ui', '🎨 UI-Element'], ['safe', '🛡️ Sicherheit']];
  const OT_DEF = { q: ['Agent', null, [], 'z. B. Was prüft format_check.py?'], small: ['RCU', 'dev', [], 'z. B. Jog-Abstand 8 → 12 px'], ui: ['RCU', 'designer', ['ui-change', 'preview', 'variation'], 'z. B. Hinweis-Glocke im Header'], safe: ['VLA', 'dev', ['vla-motion'], 'z. B. Watchdog: bei Ausfall anhalten'] };
  const ord = { type: 'small', tool: 'Claude', prefix: 'RCU', last: null };
  function orderForm() {
    const T = WF.ORDER_TYPES[ord.type], seg = (k, list) => list.map(([v, t]) => `<button class="sg" data-ord="${k}:${v}" aria-pressed="${ord[k] === v}">${esc(t)}</button>`).join('');
    return `<section class="order" aria-label="Neuer Auftrag"><h4 class="mh">🛎️ Neuer Auftrag <span class="cnt">Demo</span></h4>`
      + `<div class="seg" role="group" aria-label="Art des Auftrags">${seg('type', OT)}</div>`
      + `<p class="ohint"><b>${esc(T.name)}:</b> ${esc(T.hint)} · Schritte ${T.steps.join(' · ')}</p>`
      + `<div class="seg" role="group" aria-label="Werkzeug">${seg('tool', ['Claude', 'Codex', 'Gemini'].map(t => [t, `${TOOL[t].emblem} ${t}`]))}</div>`
      + `<div class="send"><select id="ord-prefix" aria-label="Bereich">${WF.PREFIXES.map(p => `<option${p.id === ord.prefix ? ' selected' : ''}>${p.id}</option>`).join('')}</select><input id="ord-title" type="text" maxlength="80" placeholder="${esc(OT_DEF[ord.type][3])}" aria-label="Titel des Auftrags"><button class="b primary" data-order="1">Geben</button></div>`
      + (ord.last ? `<p class="note ok">✓ ${esc(ord.last.text)} <button class="lnk" data-item="chat:${esc(ord.last.id)}">Chat folgen ›</button></p>` : '<p class="note">Spielt nur im Büro – geht an keinen echten Chat.</p>') + `</section>`;
  }
  function giveOrder() {
    const inp = $('#ord-title'), [, role, skills, ph] = OT_DEF[ord.type], title = (inp && inp.value.trim()) || ph.replace(/^z\. B\. /, '');
    const o = S.newOrder({ type: ord.type, prefix: ord.prefix, title, role, skills, mine: true }, ord.tool);
    ord.last = { id: o.chat.id, text: `${o.chat.id} (${ord.tool}) übernimmt – kommt gleich durch die Tür.` };
    if (inp) inp.value = '';
    render(false);
  }
  // Hauptaktion eines Bereichs (Kombination): am Tresen Auftrag geben; Rückfragen beantwortest du in Kopfleiste + Laufzeile
  const action = id => id === 'tresen' ? orderForm() : '';
  const inTicker = e => combo && !narrowNow() && e === S.ex[0];   // steht schon in der Laufzeile unten → im Chat nicht doppelt

  // ───────── Bereichskarte (Karte:C): Phasen-Ring + Name, größter Knopf = zu dem fliegen, der gerade hier arbeitet; Liste + Erklärung eingeklappt
  const pt = (c, r, a) => [c + r * Math.sin(a * Math.PI / 180), c - r * Math.cos(a * Math.PI / 180)];
  const arc = (c, r0, r1, a0, a1) => { const [x0, y0] = pt(c, r1, a0), [x1, y1] = pt(c, r1, a1), [x2, y2] = pt(c, r0, a1), [x3, y3] = pt(c, r0, a0); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r1} ${r1} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}A${r0} ${r0} 0 0 0 ${x3.toFixed(1)} ${y3.toFixed(1)}Z`; };
  const ring = (ph, s = 52, w = 9) => { const c = s / 2, r1 = c - 2, r0 = r1 - w;
    return `<svg class="ring" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true">${PHASES.map((p, i) => `<path d="${arc(c, p.id === ph ? r0 - 4 : r0, r1, i * 72 + 3, (i + 1) * 72 - 3)}" fill="${PHASE_COLOR[p.id]}" opacity="${p.id === ph ? 1 : 0.45}"/>`).join('')}</svg>`; };
  // wer gerade in diesem Bereich arbeitet: in der Agentur die gerufenen Subagenten (Simulation), sonst die Chats vor Ort
  function nowHere(id) {
    if (id === 'agents') {
      const seen = new Set();
      return S.subs.filter(s => !s.done && !seen.has(s.A.id) && seen.add(s.A.id)).map(s => ({ item: `agent:${s.A.id}`, title: s.A.id, meta: `${s.A.model} · gerufen von ${s.caller.id || s.caller.name || 'Chat'}`, dot: (CUBE[s.A.model] || {}).body, demo: true }));
    }
    return S.chats.filter(c => c.alive && c.a.station === id).map(c => ({ item: `chat:${c.id}`, title: c.id, meta: `${c.tool} · ${c.role ? WF.ROLES[c.role].name : 'Chat-Start'}`, dot: CUBE[c.tool].body, hot: !!exOf(c), demo: !isLive(c) }));
  }
  function areaCard(id) {
    const p = phaseOf(id), n = itemsOf(id, D, S).length, now = nowHere(id), all = fold.all;
    const foldBtn = (k, label, open) => `<button class="fold" data-fold="${k}" aria-expanded="${open}"><b>${esc(label)}</b><span aria-hidden="true">${open ? '▴' : k === 'all' ? '▾' : '▸'}</span></button>`;
    return `<header class="head">${ring(p.id)}<div class="ht"><h2>${esc(STATIONS[id].name)}</h2><p class="sub">Phase ${p.n} · ${esc(p.name)} · ${n} ${esc(LIST[id].split(',')[0])}</p></div>${stepNav(id)}</header>`
      + action(id)
      + (now.length ? `<button class="b primary xl fly" data-item="${esc(now[0].item)}" data-from="${id}">▶ Zu ${esc(now[0].title)} fliegen</button>`
        + `<h4 class="mh">${id === 'agents' ? 'Gerade gerufen' : 'Gerade hier'}${now.every(x => x.demo) ? ' <span class="cnt">Demo</span>' : ''}</h4><ul class="rows">${now.slice(0, 4).map(x => `<li><button class="row${x.hot ? ' hot' : ''}" data-item="${esc(x.item)}" data-from="${id}"><span class="r-t">${x.dot ? `<span class="dot" style="--tc:${x.dot}"></span>` : ''}<span>${esc(x.title)}${x.hot ? ' ❓' : ''}</span></span><span class="r-m">${esc(x.meta)}</span><span class="r-go" aria-hidden="true">›</span></button></li>`).join('')}</ul>`
        : id === 'tresen' ? '' : `<p class="calm">${id === 'agents' ? 'Gerade ruft kein Chat einen Subagenten.' : 'Gerade arbeitet hier kein Chat.'}</p>`)
      + foldBtn('all', `Alle ${n} ${LIST[id].split(',')[0]}`, all) + (all ? `<div class="fold-b">${rows(id)}</div>` : '')
      + foldBtn('about', 'Was ist das?', fold.about) + (fold.about ? `<div class="fold-b">${track(p.id)}${about(id, true)}${legend(id)}${stepsHere(id)}</div>` : '');
  }

  // ───────── Laufzeile unten (Frage:B): erste offene Rückfrage mit Antwort-Knöpfen · Handy (Mobil:C): großer gelber Knopf
  function ticker() {
    const e = S.ex[0], n = S.ex.length;
    if (narrowNow()) return `<button class="mob-ask" ${exAt(e)} data-open="1"><span class="aq-ic" aria-hidden="true">${exIc(e)}</span><span class="aq-t"><b>${n} ${n === 1 ? 'Rückfrage' : 'Rückfragen'} beantworten</b><small>${esc(e.question)}</small></span><span class="go" aria-hidden="true">›</span></button>`;
    return `<span class="yb">${exIc(e)} ${n} ${n === 1 ? 'wartet' : 'warten'}</span><span class="aq-t"><b>${esc(e.question)}</b><small>${esc(e.chat.id)} · ${esc(e.chat.tool)}${isLive(e.chat) ? '' : ' · Demo'}</small></span>`
      + `<div class="tk-acts">${e.choices.map(ch => `<button class="b" data-choice="${e.id}|${esc(ch)}">${esc(ch)}</button>`).join('')}<button class="b primary" ${exAt(e)} data-write="1">Antwort schreiben ›</button></div>`;
  }
  // Phasen-Zeile im Haus (Haus:B): Soll links, 5 Phasen (Klick → erster Bereich der Phase), Phase mit Rückfrage markiert, Ist rechts
  function phaseBand() {
    const alive = S.chats.filter(c => c.alive).length, exIn = ph => S.ex.filter(e => phaseOfStep(e.chat.step || 1) === ph);
    return `<p class="pb-end"><small>Soll</small><b>Auftrag abliefern</b></p><ol class="pb">${PHASES.map(p => { const w = exIn(p.id);
      return `<li class="${w.length ? 'hot' : ''}" style="--ph:${PHASE_COLOR[p.id]}"><button class="pb-b" data-station="${byPhase(p.id)[0]}" title="${esc(p.name)}: ${esc(byPhase(p.id).map(id => STATIONS[id].name).join(' · '))}"><span class="pd"></span><b>${p.n} ${esc(p.name)}</b></button>${w.length ? `<button class="yb" ${exAt(w[0])} aria-label="${w.length} Rückfrage in Phase ${esc(p.name)} beantworten">❓ ${w.length} wartet</button>` : ''}</li>`; }).join('')}</ol>`
      + `<p class="pb-end ist"><small>Ist</small><b>${alive} aktiv · ${S.stats.done} erledigt</b></p>`;
  }
  // Handy: Panel als eine Zeile (Bereich bzw. Eintrag + „Details ▴“), aufgeklappt mit „Weniger ▾“ oben
  function peekRow() {
    const s = st.station, it = st.item, p = phaseOf(s);
    const [ic, title, sub] = st.level === 3 && it ? [it.type === 'chat' ? '💬' : detailOf(it.type, it.id, D, S).icon, titleOf(it), it.type === 'chat' ? `Chat · ${(chatOf(it.id) || {}).tool || 'fertig'}` : detailOf(it.type, it.id, D, S).kick]
      : [ICON[s], STATIONS[s].name, `${itemsOf(s, D, S).length} ${LIST[s].split(',')[0]} · Phase ${p.n} ${p.name}`];
    return `<div class="peek"><span class="hi" style="--ph:${PHASE_COLOR[p.id]}">${ic}</span><p class="pk-t"><b>${esc(title)}</b><small>${esc(sub)}</small></p><button class="b" data-peek="1" aria-expanded="false">Details ▴</button></div>`;
  }
  const homeBlock = () => head('🏢', 'Ebene 1 · Haus', 'Dein Büro', 'Klick einen Bereich an – die Kamera fliegt hin') + kpis() + waitList() + flow(true) + toolLegend() + logBlock(() => true, 'Zuletzt im Büro', 4);

  // ───────── Formen je Variante
  function stackHtml() {
    const l = st.level, s = st.station, it = st.item;
    const sec = (n, title, sum, body, on, can) => `<section class="lv${on ? ' open' : ''}${can ? '' : ' off'}"><button class="lv-h" ${can ? `data-level="${n}"` : 'disabled'} aria-expanded="${on}"><span class="lv-n">${n}</span><span class="lv-t">${esc(title)}</span><small>${esc(sum)}</small></button>${on ? `<div class="lv-b">${body}</div>` : ''}</section>`;
    const sm = s || memo.station;
    return sec(1, 'Haus', `${S.chats.filter(c => c.alive).length} Chats · ${S.ex.length} warten auf dich`, kpis() + waitList() + flow(true) + logBlock(() => true), l === 1, true)
      + sec(2, sm ? `Bereich · ${STATIONS[sm].name}` : 'Bereich', sm ? STATIONS[sm].sub : 'Klick einen Bereich an', s ? stationBlock(s) + logBlock(e => S.chats.some(c => c.name === e.who && c.a.station === s), 'Zuletzt hier') : '', l === 2, !!sm)
      + sec(3, it ? `Detail · ${titleOf(it)}` : 'Detail', it ? (it.type === 'chat' ? 'Chat' : detailOf(it.type, it.id, D, S).kick) : 'Klick einen Eintrag an', it ? detailBlock(it, { noBack: true }) + logBlock(e => (e.text + e.who).includes(it.id), 'Zuletzt dazu') : '', l === 3, !!it);
  }
  function millerHtml() {
    const l = st.level;
    const col = (n, title, body) => `<section class="col${l === n ? ' cur' : ''}"><h3><span class="lv-n">${n}</span>${esc(title)}</h3><div class="col-b">${body}</div></section>`;
    const home = kpis() + waitList() + PHASES.map(p => `<h4 class="ph"><span class="pd" style="--ph:${PHASE_COLOR[p.id]}"></span>${p.n} · ${esc(p.name)}</h4><ul class="rows">${byPhase(p.id).map(id => `<li><button class="row${st.station === id ? ' sel' : ''}" data-station="${id}"><span class="r-t">${ICON[id]} ${esc(STATIONS[id].name)}</span><span class="r-m">${esc(STATIONS[id].sub)}</span><span class="r-go" aria-hidden="true">›</span></button></li>`).join('')}</ul>`).join('');
    return `<div class="mil">${col(1, 'Haus', home)}${col(2, st.station ? STATIONS[st.station].name : 'Bereich', st.station ? about(st.station) + (combo ? action(st.station) : '') + rows(st.station) : '<p class="hint">← Bereich wählen</p>')}${col(3, st.item ? titleOf(st.item) : 'Detail', st.item ? detailBlock(st.item, { noBack: true }) : '<p class="hint">← Eintrag wählen</p>')}</div>`;
  }
  function kanbanHtml() {
    return `<div class="kan">${PHASES.map(p => {
      const cs = S.chats.filter(c => c.alive && phaseOfStep(c.step || 1) === p.id);
      return `<section class="kc" style="--ph:${PHASE_COLOR[p.id]}"><h3><span class="pd"></span>${p.n} · ${esc(p.name)}<small>${esc(p.who)}</small></h3><div class="chips">${byPhase(p.id).map(stationChip).join('')}</div><div class="cards">${cs.map(c => `<button class="kcard${exOf(c) ? ' hot' : ''}" data-item="chat:${esc(c.id)}"><span class="temb" style="--tc:${CUBE[c.tool].body}">${TOOL[c.tool].emblem}</span><span class="kt"><b>${esc(c.id)}</b><small>${esc(c.role ? WF.ROLES[c.role].name : 'Start')} · ${esc((WF.STEPS[(c.step || 1) - 1] || {}).name || '')}</small></span>${exOf(c) ? '<span class="kq">❓</span>' : ''}</button>`).join('') || '<p class="none">– gerade frei –</p>'}</div></section>`;
    }).join('')}</div>`;
  }
  const cmdHome = () => S.ex.length ? waitList(false) : `<p class="calm big">✓ Alles ruhig. Tippe oben, wohin du willst – oder klick einen Bereich an.</p>`;
  const cardHome = () => head('🏢', 'Ebene 1 · Haus', 'Dein Büro', 'Klick ein Schild oder eine Figur – die Karte erscheint dort') + kpis() + waitList()
    + `<button class="b primary" data-station="tresen">🛎️ Neuen Auftrag geben ›</button>` + (prefs.band ? '' : flow(false)) + toolLegend() + logBlock(() => true, 'Zuletzt im Büro', 4);

  // ───────── Lotse (Variante F)
  function guideFace(mood) {
    const c = $('#guide-face'), x = c.getContext('2d'); x.clearRect(0, 0, 168, 168);
    x.fillStyle = CUBE.Lotse.body; x.beginPath(); x.roundRect(6, 6, 156, 156, 40); x.fill(); x.lineWidth = 3; x.strokeStyle = 'rgba(30,30,30,.35)'; x.stroke();
    x.drawImage(drawFace('glanz', mood, false, '', true).image, 14, 14, 140, 140);
  }
  function guideRender() {
    const g = $('#guide'); g.hidden = false;
    let say;
    if (tour >= 0) say = TOUR[tour].say;
    else if (st.level === 1) say = TOUR[0].say;
    else if (st.level === 2) say = `${ABOUT[st.station][0]} Klick einen Eintrag für Details – Esc bringt dich zurück ins Haus.`;
    else say = `Das ist ${titleOf(st.item)}. Unter „Verknüpft“ fliegst du mit einem Klick weiter, Esc geht eine Ebene zurück.`;
    $('#guide-text').textContent = say;
    setHtml($('#guide-act'), tour >= 0
      ? `${tour > 0 ? `<button class="b" data-tour="${tour - 1}">‹ Zurück</button>` : ''}<button class="b primary" data-tour="${tour + 1 < TOUR.length ? tour + 1 : -1}">${tour + 1 < TOUR.length ? `Weiter ${tour + 1}/${TOUR.length - 1} ›` : 'Tour beenden'}</button><button class="b" data-tour="-1">Beenden</button>`
      : `<button class="b primary" data-tour="0">▶ Tour „Erster Arbeitstag“</button>${st.level > 1 ? '<button class="b" data-up="1">‹ Eine Ebene zurück</button>' : ''}`);
    guideFace(st.level === 3 ? 'ok' : 'idle');
  }
  function tourGo(i) {
    if (i < 0 || i >= TOUR.length) { tour = -1; render(); return; }
    tour = i; const t = TOUR[i];
    go(t.l, t.s ? { station: t.s } : t.item ? { item: { ...t.item } } : {}, { keepTour: true });
  }

  // ───────── Kopfleiste
  function bar() {
    const l = st.level, s = st.station, it = st.item, cr = [`<button data-level="1" class="${l === 1 ? 'cur' : ''}">🏢 Haus</button>`];
    if (s) cr.push(`<span class="sep" aria-hidden="true">›</span><button data-level="2" class="${l === 2 ? 'cur' : ''}">${ICON[s]} ${esc(STATIONS[s].name)}</button>`);
    if (it) cr.push(`<span class="sep" aria-hidden="true">›</span><span class="cur">${esc(titleOf(it))}</span>`);
    $('#crumbs').innerHTML = cr.join('');
    el.querySelectorAll('#steps li').forEach(li => { const n = +li.dataset.l; li.classList.toggle('on', n === l); li.classList.toggle('done', n < l); });
    // Kopf:C – erste offene Rückfrage als großer gelber Knopf (Frage · Chat · „Antworten ›“); ohne Rückfrage kein Knopf
    const w = $('#ask'), n = S.ex.length, e = S.ex[0]; w.hidden = !n;
    if (n) {
      setHtml(w, `<span class="aq-ic" aria-hidden="true">${exIc(e)}</span><span class="aq-t"><b>${esc(e.question)}</b><small>${esc(e.chat.id)} · ${esc(e.chat.tool)}${n > 1 ? ` · ${n} warten` : ''}</small></span><span class="go">Antworten ›</span>`);
      w.dataset.item = `chat:${e.chat.id}`; w.dataset.from = e.chat.a.station || 'doors'; w.title = e.question;
    }
    if (n > lastWait && !reducedUi) { w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump'); } lastWait = n;
    $('#mode').textContent = S.hardware ? 'Robot | Hardware' : 'Robot | Digital Twin'; $('#safe').classList.toggle('hw', !!S.hardware);
    const src = $('#src'); src.textContent = live.ok ? `Live · ${live.n} ${live.n === 1 ? 'Chat' : 'Chats'}` : 'Demo-Daten'; src.className = 'badge' + (live.ok ? ' live' : '');
  }

  // ───────── Rendern
  function body() {
    const l = st.level;
    // Handy (Mobil:C, Kombination): Bereich/Eintrag erst als eine Zeile, „Details ▴“ klappt das Panel auf
    if (combo && narrowNow() && l > 1) return mobOpen ? `<div class="peek-x"><button class="b" data-peek="0" aria-expanded="true">Weniger ▾</button></div>` + inner(l) : peekRow();
    return inner(l);
  }
  function inner(l) {
    if (shell === 'stack') return stackHtml();
    if (shell === 'miller') return millerHtml();
    if (shell === 'kanban') return l === 1 ? kanbanHtml() : l === 2 ? stationBlock(st.station, true) : `<div class="explain"><p><b>Detail:</b> alles zu diesem Eintrag. Verknüpfte Einträge fliegen mit einem Klick hin, Esc geht zurück.</p></div>` + detailBlock(st.item);
    if (shell === 'cmd') return l === 1 ? cmdHome() : l === 2 ? stationBlock(st.station) : detailBlock(st.item);
    if (combo) {   // Kombination: Erklärung (D) + „Zuletzt“ (A) in jeder Darstellung; Karte: Haus ohne Karte (Haus:B), Bereich als kompakte Karte (Karte:C)
      if (shell === 'card') return l === 1 ? '' : l === 2 ? areaCard(st.station) : detailBlock(st.item) + logItem();
      return l === 1 ? homeBlock() : l === 2 ? stationBlock(st.station, true) + logHere() : detailBlock(st.item) + logItem();
    }
    if (shell === 'card') return l === 1 ? cardHome() : l === 2 ? stationBlock(st.station) : detailBlock(st.item);
    return l === 1 ? homeBlock() : l === 2 ? stationBlock(st.station) : detailBlock(st.item);
  }
  // Inhalt nur tauschen, wenn er sich geändert hat: ein Neuaufbau mitten im Klick verschluckt den Klick, Hover und Fokus springen;
  // Eingabefelder behalten Text, Fokus und Auswahl
  function setHtml(node, html, keepInputs) {
    if (node.__h === html) return false; node.__h = html;
    const saved = keepInputs ? [...node.querySelectorAll('input[id], textarea[id]')].map(i => [i.id, i.value, document.activeElement === i, i.selectionStart, i.selectionEnd]) : [];
    node.innerHTML = html;
    saved.forEach(([id, v, f, a, b]) => { const i = node.querySelector('#' + id); if (!i) return; i.value = v; if (f) { i.focus(); try { i.setSelectionRange(a, b); } catch { /* kein Textfeld */ } } });
    return true;
  }
  function render(nav = true) {
    const keep = panel.scrollTop, inner = el.querySelector('.lv.open .lv-b, .col.cur .col-b'), keepIn = inner ? inner.scrollTop : 0;
    panel.dataset.level = st.level; document.documentElement.dataset.level = st.level;
    const html = body(), changed = setHtml(panel, html, true);
    panel.hidden = !html; panel.classList.toggle('peeked', combo && narrowNow() && st.level > 1 && !mobOpen);
    if (nav) { panel.scrollTop = 0; panel.classList.add('fade'); requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.remove('fade'))); hov(null); }
    else if (changed) { panel.scrollTop = keep; const n = el.querySelector('.lv.open .lv-b, .col.cur .col-b'); if (n) n.scrollTop = keepIn; }
    if (nav) { placed = false; side = null; }
    if (shell !== 'card' || st.level === 1) { panel.style.left = panel.style.top = ''; $('#pin').hidden = true; }
    const showGuide = combo ? prefs.lotse || tour >= 0 : shell === 'guide';
    $('#guide').hidden = !showGuide; if (showGuide) guideRender();
    if (shell === 'cmd') $('#cmd').hidden = false;
    if (shell === 'card') tags(); else setHtml($('#tags'), '');
    // Dock unten (Fluss, nie überlappend): Laufzeile mit Rückfrage über der Phasen-Zeile; Panels, Blase und Schilder halten Abstand (--dock)
    const tk = $('#ticker'), tkOn = combo && S.ex.length > 0; tk.hidden = !tkOn; tk.classList.toggle('mob', narrowNow()); if (tkOn) setHtml(tk, ticker());
    const bandOn = combo && prefs.band && st.level === 1 && shell !== 'miller' && !narrowNow(), band = $('#band');
    band.hidden = !bandOn; if (bandOn) setHtml(band, phaseBand());
    syncDock(); bar(); signs(); remeasure();   // Ebene, Blase, Band, Schilder können Lage und Größe geändert haben
  }
  const dock = $('#dock');
  function syncDock() { const h = dock.offsetHeight; el.style.setProperty('--dock', h ? h + 10 + 'px' : '0px'); }
  new ResizeObserver(() => { syncDock(); remeasure(); }).observe(dock);
  let wasNarrow = narrowNow();
  addEventListener('resize', () => { if (narrowNow() !== wasNarrow) { wasNarrow = narrowNow(); render(false); } });   // Handy ↔ breit: Laufzeile, Panel-Zeile, Band tauschen
  // Schilder über den Bereichen (Haus): als 3D-Schild, außer in der Kartenansicht am breiten Bildschirm (dort HTML-Schilder, klickbar)
  function signs() { const narrow = innerWidth <= 760; W.st.forEach(Z => { if (Z.sign1) Z.sign1.visible = st.level === 1 && (shell !== 'card' || narrow); }); }
  // Schild:C – Bereich mit offener Rückfrage groß und gelb („· n wartet · Antworten ›“, Klick springt zur Antwort), übrige Schilder klein
  function tags() {
    const t = $('#tags'); if (st.level !== 1) { setHtml(t, ''); return; }
    const hot = new Map(); S.ex.forEach(e => { const s = e.chat.a.station || 'doors'; hot.set(s, [...(hot.get(s) || []), e]); });
    setHtml(t, Object.keys(STATIONS).map(id => { const ci = `<span class="ci" style="--ph:${PHASE_COLOR[STATIONS[id].phase]}">${ICON[id]}</span>`, h = hot.get(id);
      return h ? `<button class="t3 hot" ${exAt(h[0])} data-a="${id}" aria-label="${esc(STATIONS[id].name)}: ${h.length} wartet – antworten">${ci}<b>${esc(STATIONS[id].name)}</b><span>· ${h.length} wartet</span><span class="go">Antworten ›</span></button>`
        : `<button class="t3" data-station="${id}" data-a="${id}">${ci}${esc(STATIONS[id].name)}</button>`; }).join(''));
  }
  // Szene in die freie Fläche schieben (Anteil der Bildbreite/-höhe)
  function pads() {
    const narrow = innerWidth <= 760, l = st.level, p = levels.pad;
    if (narrow) { p.x = 0; p.y = 0.2; signs(); return; }
    // x > 0 schiebt die Szene nach links (Platz rechts), y > 0 nach oben; Karte (B) steht rechts neben dem Ziel → Szene nach links
    const R = { guide: [0.15, 0], stack: [-0.15, 0], miller: [0, 0.18], kanban: l === 1 ? [0, 0.16] : [0.15, 0], cmd: l === 1 ? [0, 0] : [0.12, 0], card: l === 1 ? (combo ? [0, 0] : [-0.12, -0.05]) : [0.12, 0] }[shell];
    p.x = R[0]; p.y = R[1] + (combo && prefs.band && l === 1 && shell !== 'miller' ? 0.05 : 0);   // Phasen-Zeile unten ≈ 1/10 der Höhe
    signs();
  }
  // ───────── Ansicht-Menü (Kombination): Darstellung wählen, Schalter, Tour
  // Ansicht:A – kompakt: Segment-Knöpfe für Infos und Kamera, Kippschalter; Erklärung beim Zeigen (title + Hinweiszeile unten)
  const VIEWS = [['card', 'Karte', 'Karte am Objekt: Info steht neben dem, was du anklickst'], ['stack', 'Stapel', 'Stapel links: Haus, Bereich und Detail untereinander, einer offen'],
    ['miller', 'Spalten', 'Spalten unten: alle drei Ebenen nebeneinander'], ['guide', 'Schublade', 'Schublade rechts: feste Spalte, viel Platz für Listen']];
  const CAMS = [['ruhig', 'Ruhig', 'Ruhig mitgehen: Blickrichtung wie im Haus, dreht nie von selbst'], ['schulter', 'Schulter', 'Über die Schulter: hinter der Figur, Weg voraus im Blick'],
    ['regie', 'Regie', 'Regie: filmt Figur und Ziel von der Seite, zeigt wohin sie geht']];
  const SWITCHES = [['follow', 'Karte folgt', 'Karte folgt dem Objekt · aus: die Karte bleibt stehen, nur der Punkt folgt (nur Ansicht Karte)'], ['band', 'Phasen-Band', 'Phasen-Zeile unten im Haus: Soll, fünf Phasen, Ist'],
    ['lotse', 'Lotse Kubi', 'Lotse Kubi erklärt jede Ebene in einem Satz'], ['welt', 'Umgebung', 'Park rund ums Büro · aus: leere Fläche, spart Rechenzeit']];
  const VM_TIP = 'Zeig auf einen Knopf – hier steht, was er tut.';
  function viewMenu() {
    const m = $('#viewmenu'), a = document.activeElement, keep = m.contains(a) && a.name ? `input[name="${a.name}"]${a.type === 'radio' ? `[value="${a.value}"]` : ''}` : m.contains(a) && a.dataset.pref ? `input[data-pref="${a.dataset.pref}"]` : '';
    const seg = (name, list, cur, label) => `<div class="seg vm-seg" role="radiogroup" aria-label="${label}">${list.map(([k, t, s]) => `<label class="sg" title="${esc(s)}" data-tip="${esc(s)}"><input type="radio" name="${name}" value="${k}"${cur === k ? ' checked' : ''}><span>${t}</span></label>`).join('')}</div>`;
    m.innerHTML = `<p class="vm-h">Infos</p>${seg('view', VIEWS, prefs.view, 'Darstellung der Infos')}`
      + `<p class="vm-h">Kamera beim Folgen</p>${seg('cam', CAMS, prefs.cam, 'Kamera beim Folgen einer Figur')}`
      + `<p class="vm-h">Schalter</p><div class="tgs">${SWITCHES.map(([k, t, s]) => `<label class="tg" title="${esc(s)}" data-tip="${esc(s)}"><input type="checkbox" role="switch" data-pref="${k}"${prefs[k] ? ' checked' : ''}${k === 'follow' && prefs.view !== 'card' ? ' disabled' : ''}><i aria-hidden="true"></i><span>${t}</span></label>`).join('')}</div>`
      + `<p class="vm-h">Tempo der Simulation</p>${seg('speed', [[0.5, '½×', 'halbe Geschwindigkeit'], [1, '1×', 'normale Geschwindigkeit'], [2, '2×', 'doppelte Geschwindigkeit'], [4, '4×', 'vierfache Geschwindigkeit']], prefs.speed, 'Tempo')}`
      + `<p class="vm-tip" id="vm-tip">${VM_TIP}</p><div class="acts"><button class="b primary" data-tour="0">▶ Tour „Erster Arbeitstag“</button></div>`;
    if (keep) m.querySelector(keep)?.focus();   // Neuaufbau nach einer Wahl: Tastatur-Fokus bleibt auf dem Knopf
  }
  function setView(v) { prefs.view = v; shell = v; document.documentElement.dataset.shell = v; savePrefs(); viewMenu(); pads(); render(true); }
  function setPref(k, on) { prefs[k] = on; if (k === 'welt') world(on); savePrefs(); viewMenu(); pads(); render(false); }
  function openMenu(on) { const m = $('#viewmenu'), b = $('#view-btn'); m.hidden = !on; b.setAttribute('aria-expanded', String(on)); if (on) { viewMenu(); m.querySelector('input:checked, input')?.focus(); } }
  function openFind() { $('#cmd').hidden = false; cin.focus(); }
  // Umschalter Tag · Nacht (Wunsch des Users 2026-10-14): merkt die Wahl im Browser und lädt neu, weil die Szene beim Start gebaut wird
  const night = document.documentElement.dataset.theme === 'nacht', th = $('#theme');
  th.setAttribute('aria-pressed', String(night)); th.setAttribute('aria-label', night ? 'Tagbüro einschalten' : 'Nachtbüro einschalten');
  th.title = night ? 'Tagbüro' : 'Nachtbüro'; th.firstElementChild.outerHTML = night ? SUN : MOON; th.querySelector('.tl').textContent = night ? 'Tag' : 'Nacht';
  th.addEventListener('click', () => {
    // nur theme in den gespeicherten Stand schreiben: prefs hält ggf. Standard- oder URL-Werte (ohne Kombination nie geladen)
    try { const p = JSON.parse(localStorage.getItem('buero.prefs') || '{}'); p.theme = night ? 'tag' : 'nacht'; localStorage.setItem('buero.prefs', JSON.stringify(p)); } catch { /* privat/gesperrt: nur neu laden */ }
    const u = new URL(location.href); u.searchParams.delete('theme'); location.replace(u.href);
  });
  if (combo) {
    $('#find').hidden = $('#view-btn').hidden = false;
    $('#find').addEventListener('click', openFind);
    $('#view-btn').addEventListener('click', () => openMenu($('#viewmenu').hidden));
    $('#viewmenu').addEventListener('change', e => { const i = e.target; if (i.name === 'view') setView(i.value); else if (i.name === 'cam') { prefs.cam = i.value; levels.setCam(i.value); savePrefs(); } else if (i.name === 'speed') { prefs.speed = sim.speed = +i.value; savePrefs(); } else if (i.dataset.pref) setPref(i.dataset.pref, i.checked); });
    const vmTip = e => { const t = e.target.closest && e.target.closest('[data-tip]'), p = $('#vm-tip'); if (p) p.textContent = t ? t.dataset.tip : VM_TIP; };
    $('#viewmenu').addEventListener('pointerover', vmTip); $('#viewmenu').addEventListener('focusin', vmTip);
    document.addEventListener('pointerdown', e => { if (!$('#viewmenu').hidden && !e.target.closest('#viewmenu, #view-btn')) openMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#viewmenu').hidden) { e.stopPropagation(); openMenu(false); $('#view-btn').focus(); } });   // Esc schließt nur das Menü, nicht zusätzlich eine Ebene
  }

  // ───────── Navigation
  function go(level, p = {}, opt = {}) {
    if (!opt.keepTour) tour = -1;
    if (p.item && !p.item.station) p.item.station = homeOf(p.item.type, p.item.id);
    if (level >= 2 && !p.station) p.station = p.item ? p.item.station : st.station || memo.station;
    if (level >= 2 && !p.station) return;
    if (level === 3 && !p.item) return;
    if (level !== st.level || p.station !== st.station) fold = { all: false, about: false };
    mobOpen = !!opt.open;
    levels.go(level, p, opt);
    if (st.station) memo.station = st.station; if (st.item) memo.item = st.item;
    pads(); render(true);
  }
  function up() { if (st.level === 3) go(2, { station: st.station }); else if (st.level === 2) go(1); }
  function step(dir) { if (st.level !== 2) return; const n = ORDER.length; go(2, { station: ORDER[(ORDER.indexOf(st.station) + dir + n) % n] }); }
  function togglePause(on = !sim.paused) {
    sim.paused = on; const b = $('#play'); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Simulation fortsetzen (Leertaste)' : 'Simulation anhalten (Leertaste)');
    b.querySelector('.pi path').setAttribute('d', on ? 'M4 2.5l9 5.5-9 5.5z' : 'M4 2.5h3v11H4zM9 2.5h3v11H9z'); b.querySelector('.tl').textContent = on ? 'Weiter' : 'Pause';
  }
  $('#play').addEventListener('click', () => togglePause());

  el.addEventListener('click', e => {
    const t = e.target.closest('button, a'); if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.choice) { const i = d.choice.indexOf('|'), ex = S.ex.find(x => x.id === d.choice.slice(0, i)); if (ex) S.resolveEx(ex, d.choice.slice(i + 1)); render(false); return; }
    if (d.send) {
      const c = chatOf(d.send), inp = $('#msg-in'); if (!c || !inp || !inp.value.trim()) { if (inp) inp.focus(); return; }
      const text = inp.value.trim(); inp.value = '';
      if (isLive(c)) { notes.set(c.id, '… wird gesendet'); render(false); opsSend(c, text).then(r => { notes.set(c.id, noteOf(r)); hist.delete(c.id); render(false); }); }   // nur über Claude Ops (ops.js)
      else { notes.set(c.id, '✓ ' + S.demoReply(c, text)); render(false); setTimeout(() => render(false), 1000); }
      return;
    }
    if (d.fold) { fold[d.fold] = !fold[d.fold]; render(false); return; }
    if (d.peek) { mobOpen = d.peek === '1'; render(false); panel.querySelector('[data-peek]')?.focus(); return; }
    if (d.order) { giveOrder(); return; }
    if (d.ord) { const [k, v] = d.ord.split(':'); ord[k] = v; if (k === 'type') ord.prefix = OT_DEF[v][0]; render(false); return; }
    if (d.step) { go(2, { station: STEP_STATION[+d.step] }); return; }
    if (d.walk) { const Z = W.st.get(d.walk); walkYou(Z.open.x, Z.open.z); return; }
    if (d.tour != null) { tourGo(+d.tour); return; }
    if (d.up) { up(); return; }
    if (d.station) { clearCmd(); go(2, { station: d.station }); return; }
    if (d.item) {
      clearCmd(); const i = d.item.indexOf(':'), type = d.item.slice(0, i), id = d.item.slice(i + 1);
      go(3, { item: { type, id, station: d.from || (type === 'chat' ? (chatOf(id)?.a.station || 'doors') : homeOf(type, id)) } }, { open: !!(d.open || d.write) });   // Antworten: Handy-Panel gleich offen
      if (d.write) $('#msg-in')?.focus();   // „Antwort schreiben ›“: Cursor steht im Nachrichtenfeld des Chats
      return;
    }
    if (d.level) { const n = +d.level; if (n === 1) go(1); else if (n === 2 && (st.station || memo.station)) go(2, { station: st.station || memo.station }); }
  });

  el.addEventListener('change', e => { if (e.target.id === 'ord-prefix') ord.prefix = e.target.value; });
  el.addEventListener('keydown', e => { if (e.key !== 'Enter') return; if (e.target.id === 'msg-in') el.querySelector('[data-send]')?.click(); if (e.target.id === 'ord-title') giveOrder(); });
  // Zeiger oder Tastatur-Fokus auf einem Eintrag → Ziel im Raum hervorheben (Figur, Platz oder Bereich)
  let hovEl = null;
  const specOf = t => { const d = t.dataset; if (d.station) return { station: d.station }; if (d.step) return { station: STEP_STATION[+d.step] }; const i = d.item.indexOf(':'); return { item: { type: d.item.slice(0, i), id: d.item.slice(i + 1), station: d.from } }; };
  function hov(t) { t = t && t.closest ? t.closest('[data-station], [data-item], [data-step]') : null; if (t === hovEl) return; hovEl = t; hilite(t ? specOf(t) : null); }
  el.addEventListener('pointerover', e => hov(e.target));
  el.addEventListener('pointerout', e => { if (!e.relatedTarget || !el.contains(e.relatedTarget)) hov(null); });
  el.addEventListener('focusin', e => hov(e.target));
  el.addEventListener('focusout', e => { if (!e.relatedTarget || !el.contains(e.relatedTarget)) hov(null); });

  // ───────── Befehlspalette (Variante C)
  const cin = $('#cmd-in'), cres = $('#cmd-res');
  function clearCmd() { cin.value = ''; cres.innerHTML = ''; if (combo) $('#cmd').hidden = true; }
  function search(q) {
    cin.value = q; const r = searchAll(q, D, S);
    cres.innerHTML = r.map((o, i) => `<li><button class="${i ? '' : 'first'}" ${o.kind === 'station' ? `data-station="${o.id}"` : `data-item="${o.type}:${esc(o.id)}" data-from="${o.station}"`}><span class="r-t">${esc(o.title)}</span><span class="r-m">${esc(o.meta)}</span></button></li>`).join('') || (q.trim() ? '<li class="none">Nichts gefunden</li>' : '');
  }
  cin.addEventListener('input', () => search(cin.value));
  cin.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = cres.querySelector('button'); if (b) b.click(); cin.blur(); } if (e.key === 'Escape') { clearCmd(); cin.blur(); } });
  if (combo) cin.addEventListener('blur', () => setTimeout(() => { if (!cin.value.trim() && document.activeElement !== cin) $('#cmd').hidden = true; }, 200));

  // ───────── je Bild: Karte am Objekt (B) mitführen
  const v = new THREE.Vector3(), box = new THREE.Box3(), corner = new THREE.Vector3();
  // Bildschirm-Ausdehnung des Ziels (Station in Ebene 2, Figur/Platz in Ebene 3) in Pixeln: die Karte steht daneben, nie darüber
  function extent(r) {
    if (st.level === 2) { const Z = W.st.get(st.station); Z.box ||= new THREE.Box3().setFromObject(Z.g); box.copy(Z.box); }
    else { const t = levels.target(); box.min.set(t.x - 0.5, 0, t.z - 0.5); box.max.set(t.x + 0.5, 2.3, t.z + 0.5); }
    let a = Infinity, b = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      if (corner.z < 1) { const px = (corner.x + 1) / 2 * r.width; a = Math.min(a, px); b = Math.max(b, px); }
    }
    if (a === Infinity) { const t = levels.target(); corner.copy(t).project(camera); a = b = (corner.x + 1) / 2 * r.width; }
    return [a, b];
  }
  const lead = $('#lead'), tagBox = [];
  // Maße von Bild, Panel, Kopfleiste, Blase und Schildern: nur nach Neuaufbau (render), Größenänderung oder neuen Schriften messen,
  // nicht je Bild – Lesen nach dem Schreiben der Positionen erzwang sonst in jedem Frame ein Layout
  const M = { dirty: true, tags: [] }, remeasure = () => { M.dirty = true; };
  const ro = new ResizeObserver(remeasure);
  [renderer.domElement, panel, $('#bar'), $('#guide')].forEach(n => n && ro.observe(n));
  addEventListener('resize', remeasure);
  if (document.fonts) document.fonts.ready.then(remeasure);
  function measure() {
    M.dirty = false;
    M.r = renderer.domElement.getBoundingClientRect();
    M.w = panel.offsetWidth; M.h = panel.offsetHeight;
    M.barB = $('#bar').getBoundingClientRect().bottom;
    const g = $('#guide'); M.gr = g.hidden ? null : g.getBoundingClientRect();
    M.dockT = dock.offsetHeight ? dock.getBoundingClientRect().top - M.r.top : M.r.height;   // Oberkante von Laufzeile/Phasen-Zeile im Bild
    M.pr = panel.getBoundingClientRect();   // Lage aus CSS (Ebene 1); in Ebene 2/3 setzt frame() sie selbst und rechnet sie mit
    const op = panel.offsetParent, o = op ? op.getBoundingClientRect() : { left: 0, top: 0 };
    M.ox = o.left + (op ? op.clientLeft : 0); M.oy = o.top + (op ? op.clientTop : 0);
    M.tags = [...el.querySelectorAll('#tags .t3')].map(b => ({ b, Z: W.st.get(b.dataset.a), w: b.offsetWidth, h: b.offsetHeight }));
  }
  function frame() {
    if (shell !== 'card') { lead.style.display = 'none'; return; }
    if (M.dirty) measure();
    const r = M.r, narrow = innerWidth <= 760, pin = $('#pin');
    if (st.level > 1 && !narrow) {
      const t = levels.target(), tip = st.level === 3 && anchor();   // Ebene 3 mit Figur: Pfeil über dem Kopf statt Punkt
      if (tip) v.copy(tip).project(camera); else v.set(t.x, t.y + (st.level === 2 ? 1.7 : 1.05), t.z).project(camera);
      const px = (v.x + 1) / 2 * r.width, py = (1 - v.y) / 2 * r.height, w = M.w, h = M.h, top = M.barB + 12;
      pin.hidden = false; pin.style.left = px + 'px'; pin.style.top = py + 'px';
      // Karte neben der Ausdehnung des Ziels: rechts, wenn Platz ist, sonst links; Seite bleibt, solange sie passt (kein Hin und Her);
      // Schalter „Karte folgt“ aus → einmal setzen
      if (!combo || prefs.follow || !placed) {
        const [ex0, ex1] = extent(r), fitR = ex1 + 18 + w <= r.width - 12, fitL = ex0 - 18 - w >= 12;
        let want = fitR ? 'r' : fitL ? 'l' : (levels.pad.x >= 0 ? 'r' : 'l');   // passt nirgends (Werkbank): Seite, zu der die Szene Platz lässt
        if ((side === 'r' && fitR) || (side === 'l' && fitL)) want = side;
        side = want;
        const left = clamp(side === 'r' ? ex1 + 18 : ex0 - 18 - w, 12, r.width - 12 - w);
        let maxB = Math.min(r.height, M.dockT) - 12; const gr = M.gr;   // nie über Kubis Blase oder das Dock unten legen (Zero Overlap)
        if (gr && left < gr.right && left + w > gr.left) maxB = Math.min(maxB, gr.top - 12);
        const ptop = clamp(py - h * 0.35, top, Math.max(top, maxB - h));
        panel.style.left = left + 'px'; panel.style.top = ptop + 'px';
        M.pr = { left: M.ox + left, top: M.oy + ptop, right: M.ox + left + w, bottom: M.oy + ptop + h };
        if (!levels.flying()) placed = true;
      }
      // Leitlinie vom Punkt am Ziel zur nächsten Kante der Karte: zeigt, worauf sich die Karte bezieht
      const pr = M.pr, nx = clamp(px, pr.left, pr.right), ny = clamp(py, pr.top, pr.bottom), ln = $('#lead-l');
      const inside = nx === px && ny === py, far = Math.hypot(nx - px, ny - py) < 14;
      const off = inside || far || py < top; lead.style.display = off ? 'none' : ''; if (!off) { ln.setAttribute('x1', px); ln.setAttribute('y1', py); ln.setAttribute('x2', nx); ln.setAttribute('y2', ny); }
      pin.hidden = py < top || !!tip;   // Punkt nie unter der Kopfleiste; bei einer Figur zeigt der Pfeil im Raum
    } else { pin.hidden = true; lead.style.display = 'none'; }
    const barB = M.barB;
    // Schilder im Haus: im Bild halten, nie hinter der Kopfleiste oder dem Panel (dann rechts neben das Panel)
    if (st.level === 1 && !narrow) {
      const pr = M.pr, gr = M.gr;
      M.tags.forEach(({ b, Z, w: bw, h: bh }) => {
        v.set(Z.g.position.x, Z.id === 'bench' ? 2.4 : 3.0, Z.g.position.z).project(camera);
        let x = clamp((v.x + 1) / 2 * r.width, 12 + bw / 2, r.width - 12 - bw / 2); const y = clamp((1 - v.y) / 2 * r.height, barB + 12 + bh, M.dockT - 8);   // unter der Kopfleiste, über dem Dock
        if (x - bw / 2 < pr.right + 8 && x + bw / 2 > pr.left - 8 && y > pr.top && y - bh < pr.bottom) x = pr.right + 12 + bw / 2;
        let yy = y; if (gr && x + bw / 2 > gr.left - 8 && x - bw / 2 < gr.right + 8 && yy > gr.top - 8) yy = gr.top - 10;   // nie unter Kubis Blase
        tagBox.push({ b, x, y: yy, w: bw, h: bh });
      });
      // Schilder nie übereinander (Zero Overlap): von oben nach unten, ein überlappendes rückt unter das obere
      tagBox.sort((a, b) => a.y - b.y);
      tagBox.forEach((a, i) => { for (let k = 0; k < 4; k++) { const o = tagBox.slice(0, i).find(q => Math.abs(q.x - a.x) < (q.w + a.w) / 2 + 6 && Math.abs(q.y - a.y) < q.h + 4); if (!o) break; a.y = o.y + o.h + 4; } a.b.style.left = a.x + 'px'; a.b.style.top = a.y + 'px'; });
      tagBox.length = 0;
    }
  }
  // laufende Werte (Kennzahlen, Listen) auffrischen, ohne die Lage zu verlieren; nie beim Tippen
  // während eines Kamerafluges kein Neuaufbau des Panels (langer Frame = sichtbarer Ruck)
  let pressed = false, overPanel = false, lastTick = 0;
  el.addEventListener('pointerdown', () => { pressed = true; });
  ['pointerup', 'pointercancel'].forEach(t => addEventListener(t, () => { pressed = false; }));
  panel.addEventListener('pointerenter', () => { overPanel = true; }); panel.addEventListener('pointerleave', () => { overPanel = false; });
  function tick() {
    const a = document.activeElement, typing = el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    if (levels.flying() || pressed || typing || (overPanel && performance.now() - lastTick < 3500)) { bar(); return; }
    lastTick = performance.now(); render(false);
  }

  return { go, up, step, render, frame, tick, pads, search, state: st, tourGo, setPref, setView, openMenu, openFind, togglePause, prefs };
}
