// HUD: Kennzahlen, Ausnahmen, Hover-Schild, Klick-Info (Bereich Info A–C), Chat-Konsole (Bereich Chat A–C).
// Info:A Reiter-Tafel unten · Info:B Karte am Objekt · Info:C Schublade + Verlauf (Empfehlung)
// Chat:A Sprechblase an der Figur · Chat:B Chat-Tafel an der Wand · Chat:C Funkgerät in der Schublade (Empfehlung)
import * as THREE from 'three';
import * as WF from './data/wf.js';
import { STATIONS } from './office.js';
import { STEP_STATION } from './sim.js';
import { TOOL } from './cast.js';
import { UNDER_OPS, opsChat, opsSend, noteOf } from './ops.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const code = s => `<code>${esc(s)}</code>`;
const CATS = ['Menschen', 'Werkzeuge', 'Rollen', 'Agenten', 'Skills', 'Memory', 'Repos', 'MCP', 'Hooks', 'Orchestrierung', 'Settings', 'Sync', 'Prüfung', 'Sicherheit'];
const ROUTE = { Claude: ['vscode', 'vscode://-Link → Text steht im Chat → Enter drückst du'], Codex: ['direct', 'IPC der Codex-Erweiterung → sofort zugestellt'], Gemini: ['direct', 'Antigravity SendUserCascadeMessage → sofort zugestellt'] };

export function createUI(ctx) {
  const { S, W, k, L, D, V, scene, camera, you, walkYou, live } = ctx;
  const UI = { sign: null, hoverId: null, hoverChat: null, openId: null, chat: null, hl: null, drawerTab: V.info === 'C' ? 'info' : 'chat', lifted: null, pollT: 0 };
  const root = document.documentElement;

  // ───────── Inhalte je Station (echte Daten aus setup.js, Workflow aus wf.js)
  function table(cols, rows, o = {}) {
    const id = 't' + Math.random().toString(36).slice(2, 7);
    const body = rows.map(r => '<tr>' + r.map((c, i) => `<td>${i === 0 && o.link && r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">${esc(c)}</a>` : (o.raw ? c : esc(c))}</td>`).join('') + '</tr>').join('');
    return `<table class="tbl" id="${id}"><thead><tr>${cols.map((c, i) => `<th data-sort="${i}">${esc(c)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  }
  const li = a => '<ul>' + a.map(x => `<li>${x}</li>`).join('') + '</ul>';
  function content(id) {
    const n = v => (v || []).length;
    switch (id) {
      case 'tresen': return `<p>Du = Product Owner: Ziel statt Anleitung, Rückfragen ❓ und Vorschauen beantwortest nur du, Robot | Hardware gibst nur du frei.</p>` + table(['Auftrag', 'Chat', 'Weg', 'Schritte'], S.orders.slice(0, 8).map(o => [`[${o.prefix}] ${o.title}`, o.chat ? o.chat.name : '', WF.ORDER_TYPES[o.type].name, [...o.stepsDone].sort((a, b) => a - b).join(' ') + (o.done ? ' · 🏁' : '')])) + `<p><b>Antwortformat:</b> Ergebnis-Zeile → ⚠️ → Details → Prüf-Tabelle → Status + Chat-ID (Stop-Hook prüft).</p>`;
      case 'doors': return table(['Chat', 'Werkzeug', 'Rolle', 'Schritt', 'Daten'], S.chats.filter(c => c.alive).map(c => [c.id, c.tool, c.role ? WF.ROLES[c.role].name : 'Start', String(c.step), c.live ? 'live' : 'Demo'])) + '<p><b>Drei Werkzeuge, ein Regelwerk:</b></p>' + li(WF.TOOLS.map(t => `<b>${esc(t.name)}</b> · ${esc(t.link)} · ${code(t.cfg)}`));
      case 'roles': case 'bench': return table(['Rolle', 'Tut', 'Leit-Skills', 'Agenten'], Object.values(WF.ROLES).map(r => [`${r.icon} ${r.name}`, r.does, (r.skills || []).join(', '), (r.agents || []).join(', ')]));
      case 'agents': return `<p>${n(D.agents)} Subagenten – Aufruf mit Briefing (Zweck · Umfang · Fokus), Rückgabe = Befund. Opus für Urteil, Sonnet für leichte Prüfarbeit.</p>` + table(['Agent', 'Modell', 'Zweck'], (D.agents || []).map(a => [a.id, a.model + (a.edits ? ' · ändert' : ' · liest') + ' · ' + a.scope, a.does]));
      case 'skills': return `<p>${n(D.skills)} Skills – geladen nur, wenn die Anfrage ihr Thema berührt, einmal je Chat.</p>` + table(['Skill', 'Thema'], (D.skills || []).map(s => [s.id + ' · ' + s.scope, s.does]));
      case 'memory': return `<p>${n(D.memory)} Einträge – eine Datei je Erkenntnis, Index MEMORY.md liegt jedem Chat bei.</p>` + table(['Eintrag', 'Kern'], (D.memory || []).map(m => [m.title + ' · ' + m.scope, m.hook]));
      case 'repos': return table(['Repo', 'Art', 'GitHub'], (D.repos || []).map(r => Object.assign([r.id, r.kind, r.repo || '–'], { link: r.repo })), { link: true });
      case 'mcp': return `<p>${esc(WF.MCP_RULE)}</p>` + table(['Server', 'Wo', 'Zweck'], (D.mcp || []).map(m => [m.id, m.where, m.does]));
      case 'hooks': return `<p>${n(D.hooks)} Hook-Stellen im Takt eines Chats – sie geben Kontext, warnen, fragen oder blocken.</p>` + table(['Ereignis', 'Werkzeuge', 'Skript'], (D.hooks || []).map(h => [h.event, h.matcher || '–', h.script]));
      case 'claims': return `<p>Jede Anfrage = eine Zeile „🔒 In Arbeit“ in TODOS.md (git-synchronisiert): Datei in fremder Zeile → erst abstimmen. <span class="badge ${live.ok ? 'live' : 'demo'}">${live.ok ? 'live · Claude Ops' : 'Demo-Daten'}</span></p>` + table(['Wer', 'Aufgabe', 'Dateien'], S.boardClaims().map(c => [c.who || c.text, c.task || '', c.files || (live.ok ? '' : 'Demo')])) + '<p><b>4 Konflikte:</b></p>' + li(WF.CONFLICTS.map(c => `<b>${esc(c.name)}</b> ${esc(c.when)}: ${esc(c.then)}`));
      case 'previews': { const by = {}; (D.previews || []).forEach(p => (by[p.topic] = by[p.topic] || []).push(p)); return `<p>${n(D.previews)} Vorschauseiten (Archiv <code>_studio/vorschauen</code>, Port 8085): Varianten A/B/C, „An Chat senden“ ist endgültig.</p>` + Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([t, ps]) => `<details><summary>${esc(t)} · ${ps.length}</summary><ul>${ps.slice(0, 40).map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a> · <span class="meta">${esc(p.date)}</span></li>`).join('')}</ul></details>`).join(''); }
      case 'settings': return table(['Datei', 'Zweck'], (D.settings || []).map(s => [s.file, s.does]));
      case 'sync': return `<p><b>Rechner:</b> ${(D.sync?.machines || []).map(esc).join(' · ')} – Git ist die einzige Quelle.</p>` + li((D.sync?.chain || []).map(esc));
      case 'qa': return table(['Stufe', 'Änderung', 'Prüfung'], WF.LEVELS.map(l => [`${l.n} · ${l.name}`, l.what, l.check])) + '<p><b>Vier Wege eines Auftrags:</b></p>' + li(Object.values(WF.ORDER_TYPES).map(t => `<b>${esc(t.name)}</b>: Schritte ${t.steps.join(' · ')} – ${esc(t.hint)}`));
      case 'robot': return `<p><b>Sicherheitszone:</b> ${esc(WF.SAFETY.who)}</p>` + table(['Frei', 'Mit Rückfrage', 'Nie ohne Freigabe'], [[li(WF.SAFETY.free.map(esc)), li(WF.SAFETY.ask.map(esc)), li(WF.SAFETY.never.map(esc))]], { raw: true });
      case 'post': return li([WF.STEPS[8].text, 'Conventional Commit mit Scope, nur eigene geprüfte Dateien', 'tools/pre-commit prüft Vorgemerktes, pre-push lädt Chat-Verläufe hoch'].map(esc));
      case 'docs': return li([WF.STEPS[7].text, 'docs/en + docs/de, README + readme-de, Handbuch, Setup-Karte', 'check_showcase.py prüft Namen und Links'].map(esc));
    }
    return '';
  }
  const catOf = id => STATIONS[id].cat;
  function catContent(cat) { return Object.keys(STATIONS).filter(id => catOf(id) === cat).map(id => `<h3>${esc(STATIONS[id].name)} <span class="meta">${esc(STATIONS[id].sub)}</span></h3>` + content(id)).join(''); }
  // Tabellen sortierbar (Klick auf Spaltenkopf)
  document.addEventListener('click', e => {
    const th = e.target.closest('th[data-sort]'); if (!th) return; const tb = th.closest('table').tBodies[0], i = +th.dataset.sort, rows = [...tb.rows];
    const asc = th.dataset.dir !== 'asc'; th.dataset.dir = asc ? 'asc' : 'desc';
    rows.sort((a, b) => (a.cells[i]?.textContent || '').localeCompare(b.cells[i]?.textContent || '', 'de', { numeric: true }) * (asc ? 1 : -1)).forEach(r => tb.append(r));
  });

  // ───────── Hover-Schild + Lupe + Hervorhebung im 3D-Raum
  function showSign(lines, x, y, z) {
    if (UI.sign) { scene.remove(UI.sign); UI.sign.material.map.dispose(); UI.sign = null; }
    if (!lines) return; UI.sign = k.label(lines, { h: 0.56, order: 12, depthTest: false }); UI.sign.position.set(x, y, z); scene.add(UI.sign);
  }
  UI.hover = hit => {
    const id = hit && hit.station, ch = hit && hit.chat;
    if (id !== UI.hoverId || ch !== UI.hoverChat) {
      UI.hoverId = id; UI.hoverChat = ch || null;
      if (ch) showSign([{ t: ch.name, size: 24, weight: 700 }, { t: `${ch.role ? WF.ROLES[ch.role].icon + ' ' + WF.ROLES[ch.role].name : 'Chat-Start'} · Klick: Chat`, size: 16, weight: 500 }], ch.a.x, 2.9, ch.a.z);
      else if (id) { const Z = W.st.get(id); showSign([{ t: Z.info.name, size: 26, weight: 700 }, { t: `${Z.info.sub} · Klick: Info`, size: 16, weight: 500 }], Z.g.position.x, Z.top, Z.g.position.z); }
      else showSign(null);
    }
    root.classList.toggle('lift', V.info === 'B' && !!id); root.classList.toggle('hand', !!ch || (V.info !== 'B' && !!id) || !!(hit && hit.board));
    UI.lifted = V.info === 'B' ? id : null;
  };
  UI.highlight = id => {
    if (!UI.hl) { UI.hl = k.add(scene, 'tor', L.signal.info, 0, 0.04, 0, 1, 1, 1, 0, { noShadow: true, emissive: L.signal.info }); UI.hl.rotation.x = Math.PI / 2; UI.hl.visible = false; }
    if (!id || !W.st.has(id)) { UI.hl.visible = false; return; }
    const Z = W.st.get(id), [, x, z, w, d] = Z.def, r = Math.max(w, d) * 0.62; UI.hl.position.set(x, 0.04, z); UI.hl.scale.set(r, r, 1.2); UI.hl.visible = true;
  };
  UI.frame = dt => {
    W.st.forEach(Z => { const ty = Z.id === UI.lifted ? 0.08 : 0; Z.g.position.y += (ty - Z.g.position.y) * Math.min(1, dt * 10); });
    if (V.info === 'B' && UI.openId && !$('#card').hidden) placeCard();
  };

  // ───────── Info-Varianten
  function openInfo(id) {
    UI.openId = id;
    if (V.info === 'A') { tabsSelect(catOf(id)); $('#tabs').hidden = false; }
    else if (V.info === 'B') { const Z = W.st.get(id); const c = $('#card'); const ex = S.ex.find(e => e.station === id);
      c.innerHTML = `<h3>${esc(Z.info.name)} <span class="meta">${esc(Z.info.sub)}</span></h3><div class="scroll" style="max-height:30vh">${content(id)}</div>` + (ex ? `<button class="btn primary next" data-ask="${ex.id}">❓ Antworten: ${esc(ex.question)}</button>` : `<button class="btn primary next" data-walk="${id}">Hinlaufen</button>`);
      c.hidden = false; placeCard(); }
    else { UI.drawerTab = 'info'; renderDrawer(); }
  }
  function placeCard() {
    const Z = W.st.get(UI.openId); if (!Z) return; const v = new THREE.Vector3(Z.g.position.x, Z.top - 0.2, Z.g.position.z).project(camera);
    const c = $('#card'), r = ctx.renderer.domElement.getBoundingClientRect(); const px = r.left + (v.x + 1) / 2 * r.width, py = r.top + (1 - v.y) / 2 * r.height;
    const top = ($('#top').getBoundingClientRect().bottom || 0) + 12; c.style.left = Math.max(c.offsetWidth / 2 + 8, Math.min(r.width - c.offsetWidth / 2 - 8, px)) + 'px'; c.style.top = Math.max(top + c.offsetHeight + 14, Math.min(r.height - 20, py)) + 'px'; c.style.opacity = v.z < 1 ? 1 : 0;
  }
  // Info:A – Reiter je Kategorie, Abweichungen oben angepinnt
  function tabsInit() { $('#tabs-row').innerHTML = CATS.map(c => `<button role="tab" data-cat="${c}" aria-selected="false">${c}</button>`).join(''); $('#tabs-row').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) tabsSelect(b.dataset.cat); }); }
  function tabsSelect(cat) { document.querySelectorAll('#tabs-row [data-cat]').forEach(b => b.setAttribute('aria-selected', b.dataset.cat === cat ? 'true' : 'false')); $('#tabs-body').innerHTML = catContent(cat); $('#tabs').hidden = false; }
  function tabsPinned() { const ex = S.ex; $('#tabs-pinned').innerHTML = ex.length ? ex.map(e => `<span data-ask="${e.id}" role="button" tabindex="0">${e.kind === 'approve' ? '🔒' : e.kind === 'preview' ? '🖼️' : '❓'} ${esc(e.title.replace(/^\S+\s/, ''))} · ${esc(e.chat.name)}</span>`).join('') : '<span class="none">✓ nichts wartet auf dich</span>'; }
  // Info:C – Schublade: Info · Weg dieses Auftrags · Chat (Chat:C)
  function drawerTabs() { const tabs = []; if (V.info === 'C') tabs.push(['info', 'Info + Weg des Auftrags']); if (V.chat === 'C') tabs.push(['chat', 'Chat']); return tabs; }
  function renderDrawer() {
    const d = $('#drawer'); if (d.hidden === false && !drawerTabs().length) return; d.hidden = false;
    $('#drawer-tabs').innerHTML = drawerTabs().map(([id, t]) => `<button role="tab" data-tab="${id}" aria-selected="${UI.drawerTab === id}">${t}</button>`).join('') + '<button class="btn" data-close="drawer" style="margin-left:auto">Schließen</button>';
    const b = $('#drawer-body');
    if (UI.drawerTab === 'info') { const Z = UI.openId ? W.st.get(UI.openId) : null; b.innerHTML = (Z ? `<h3>${esc(Z.info.name)} <span class="meta">${esc(Z.info.sub)}</span></h3><div class="scroll list-area">${content(Z.id)}</div>` : '<p>Klick auf eine Station zeigt hier ihre Liste mit echten Daten.</p>') + `<div class="wayblock">${wayHtml()}</div>`; }
    else b.innerHTML = chatHtml();
  }
  function nearestChat() { let c = null, cd = 1e9; S.chats.forEach(ch => { if (!ch.alive) return; const d = Math.hypot(ch.a.x - you.x, ch.a.z - you.z); if (d < cd) { cd = d; c = ch; } }); return c; }
  function wayHtml() {
    const c = UI.chat && UI.chat.alive ? UI.chat : nearestChat(); if (!c) return '<p>Kein Chat unterwegs.</p>';
    const used = WF.ORDER_TYPES[c.order.type].steps;
    return `<p class="eyebrow">Weg dieses Auftrags · ${esc(c.name)}</p><p class="meta">[${esc(c.order.prefix)}] ${esc(c.order.title)} · ${esc(WF.ORDER_TYPES[c.order.type].name)}${c.live ? '' : ' · Demo'}</p>` +
      '<ol class="way">' + WF.STEPS.map(st => `<li data-step="${st.n}" class="${used.includes(st.n) ? '' : 'skip'}${c.order.stepsDone.has(st.n) ? ' on' : ''}${c.step === st.n ? ' now' : ''}"><b>${st.n}</b><em>${esc(st.name)}</em></li>`).join('') + '</ol>';
  }

  // ───────── Chat-Varianten
  const toolOf = c => c.tool;
  async function history(c) {
    if (!c.live || !live.ok) return c.msgs;
    try { return await opsChat(c.sid); } catch { return c.msgs; }
  }
  async function send(c, text) {
    text = (text || '').trim(); if (!text) return 'leer';
    if (!c.live || !live.ok) return S.demoReply(c, text);
    return noteOf(await opsSend(c, text));
  }
  const routeLine = c => { const [via, how] = ROUTE[toolOf(c)], real = c.live && live.ok; return `<div class="route"><span class="via">${via}</span><span>${esc(real && !UNDER_OPS ? how + ' (nur unter Claude Ops /agenten-buero/)' : how)}</span><span class="badge ${real ? 'live' : 'demo'}">${real ? UNDER_OPS ? 'live' : 'live · nur lesen' : 'Demo'}</span></div>`; };
  const msgsHtml = m => `<ul class="msgs">${m.length ? m.map(x => `<li class="${x.role}">${esc(x.text)}</li>`).join('') : '<li class="ai">– noch keine Nachrichten –</li>'}</ul>`;
  function chatHtml() {
    const chats = S.chats.filter(c => c.alive); const c = UI.chat && UI.chat.alive ? UI.chat : chats[0]; UI.chat = c;
    const list = `<div class="chatlist">${chats.map(x => `<button data-chat="${esc(x.id)}" aria-selected="${x === c}">${TOOL[x.tool].emblem} ${esc(x.id)}${S.ex.some(e => e.chat === x) ? ' ❓' : ''}</button>`).join('')}</div>`;
    if (!c) return list + '<p>Kein Chat aktiv.</p>';
    const ex = S.ex.find(e => e.chat === c);
    history(c).then(m => { const el = $('#chat-msgs'); if (el && UI.chat === c) { el.outerHTML = msgsHtml(m).replace('<ul class="msgs">', '<ul class="msgs" id="chat-msgs">'); } });
    return list + `<p class="meta">${esc(c.name)} · ${c.role ? esc(WF.ROLES[c.role].name) : 'Start'} · Schritt ${c.step}</p>` + msgsHtml(c.msgs).replace('<ul class="msgs">', '<ul class="msgs" id="chat-msgs">') +
      (ex && !c.live ? `<p><b>❓ ${esc(ex.question)}</b></p><div class="quick">${ex.choices.map(ch => `<button data-quick="${esc(ch)}">${esc(ch)}</button>`).join('')}</div>` : '') +
      `<div class="send"><textarea id="chat-text" placeholder="Nachricht an ${esc(c.id)} …" maxlength="4000"></textarea><button class="btn primary" data-send="1">Senden</button></div><p class="meta" id="chat-note"></p>` + routeLine(c);
  }
  // Chat:A – Sprechblasen über der Figur + Antwortfeld unten
  const bubbles = [];
  async function openBubbles(c) {
    bubbles.forEach(b => b.parent && b.parent.remove(b)); bubbles.length = 0; UI.chat = c;
    const m = (await history(c)).slice(-3);
    m.forEach((x, i) => { const bg = x.role === 'user' ? L.label.fg : x.role === 'ask' ? L.signal.ask : L.label.bg, fg = x.role === 'user' ? L.label.bg : x.role === 'ask' ? '#1E1E1E' : L.label.fg; const b = k.label([{ t: (x.role === 'user' ? 'Du: ' : '') + x.text.slice(0, 44) + (x.text.length > 44 ? '…' : ''), size: 18, weight: 600, color: fg }], { h: 0.34, bg, border: L.label.border, order: 12, depthTest: false }); b.position.y = 2.95 + (m.length - 1 - i) * 0.4; c.P.root.add(b); bubbles.push(b); });
    const r = $('#reply'); r.hidden = false; $('#reply-who').textContent = c.name; $('#reply-note').innerHTML = routeLine(c); $('#reply-text').focus();
  }
  // Chat:B – Terminal je Werkzeug (Klick auf die Chat-Tafel an den Türen)
  function openTerm(tool) {
    const t = $('#term'); t.hidden = false; UI.termTool = tool || UI.termTool || 'Claude';
    $('#term-tabs').innerHTML = ['Claude', 'Codex', 'Gemini'].map(x => `<button role="tab" data-tool="${x}" aria-selected="${x === UI.termTool}">${TOOL[x].emblem} ${x}</button>`).join('') + '<button class="btn" data-close="term" style="margin-left:auto">Schließen</button>';
    const chats = S.chats.filter(c => c.alive && c.tool === UI.termTool); if (!UI.chat || UI.chat.tool !== UI.termTool || !UI.chat.alive) UI.chat = chats[0] || null;
    $('#term-body').innerHTML = chatHtml();
  }
  UI.openChat = c => { if (!c) return; UI.chat = c; if (V.chat === 'A') openBubbles(c); else if (V.chat === 'B') openTerm(c.tool); else { UI.drawerTab = 'chat'; renderDrawer(); } };
  UI.openInfo = openInfo;
  UI.click = hit => {
    if (!hit) return false;
    if (hit.chat) { UI.openChat(hit.chat); return true; }
    if (hit.board === 'claims') { openInfo('claims'); return true; }
    if (hit.board === 'chat') { if (V.chat === 'B') openTerm(UI.termTool); else UI.openChat(S.chats.find(c => c.alive)); return true; }
    if (hit.station) { openInfo(hit.station); return true; }
    return false;
  };
  UI.closeAll = () => { $('#dlg').close(); $('#card').hidden = true; $('#term').hidden = true; $('#drawer').hidden = true; $('#tabs').hidden = V.info !== 'A'; $('#reply').hidden = true; bubbles.forEach(b => b.parent && b.parent.remove(b)); bubbles.length = 0; UI.openId = null; UI.highlight(null); };

  // ───────── Ausnahmen (Rückfrage, Vorschau, Freigabe) als Dialog
  UI.ask = ex => {
    const d = $('#dlg'); $('#dlg-title').textContent = ex.kind === 'approve' ? 'Freigabe' : ex.kind === 'preview' ? 'Vorschau-Seite' : 'Rückfrage F1';
    $('#dlg-body').innerHTML = `<p class="meta">${esc(ex.chat.name)} · [${esc(ex.chat.order.prefix)}] ${esc(ex.chat.order.title)}</p><p class="q">${esc(ex.question)}</p>` + (ex.kind === 'approve' ? '<p>Freigaben gibt nur der User in diesem Chat – andere Chats, Subagenten, Hooks zählen nie.</p>' : ex.kind === 'preview' ? '<p>„An Chat senden“ ist endgültig – der Chat arbeitet direkt weiter.</p>' : '<p>Deine Auswahl ist die Antwort – der Chat arbeitet direkt weiter.</p>');
    const box = $('#dlg-choices'); box.innerHTML = '';
    ex.choices.forEach((c, i) => { const b = document.createElement('button'); b.textContent = (ex.kind === 'preview' ? 'Variante ' : '') + c + (i === 0 && ex.kind !== 'approve' ? ' (empfohlen)' : ''); b.onclick = () => { S.resolveEx(ex, c); d.close(); }; box.append(b); });
    d.showModal();
  };

  // ───────── Klicks im HUD
  document.addEventListener('click', async e => {
    const t = e.target;
    const ask = t.closest('[data-ask]'); if (ask) { const ex = S.ex.find(x => x.id === ask.dataset.ask); if (ex) UI.ask(ex); return; }
    const go = t.closest('[data-go]'); if (go) { const ex = S.ex.find(x => x.id === go.dataset.go); if (ex) walkYou(ex.chat.a.x, ex.chat.a.z + 1.2); return; }
    const wk = t.closest('[data-walk]'); if (wk) { const Z = W.st.get(wk.dataset.walk); if (Z) walkYou(Z.open.x, Z.open.z); return; }
    const cl = t.closest('[data-close]'); if (cl) { $('#' + cl.dataset.close).hidden = true; if (cl.dataset.close === 'drawer') UI.highlight(null); return; }
    const tab = t.closest('#drawer-tabs [data-tab]'); if (tab) { UI.drawerTab = tab.dataset.tab; renderDrawer(); return; }
    const tt = t.closest('#term-tabs [data-tool]'); if (tt) { UI.chat = null; openTerm(tt.dataset.tool); return; }
    const ch = t.closest('[data-chat]'); if (ch) { UI.chat = S.chats.find(c => c.id === ch.dataset.chat) || UI.chat; if (V.chat === 'B') openTerm(UI.termTool); else renderDrawer(); return; }
    const q = t.closest('[data-quick]'); if (q && UI.chat && !UI.chat.live) { const note = await send(UI.chat, q.dataset.quick); if (V.chat === 'B') openTerm(UI.termTool); else renderDrawer(); const n = $('#chat-note'); if (n) n.textContent = note; return; }
    if (t.closest('[data-send]') && UI.chat) { const ta = $('#chat-text'); const note = await send(UI.chat, ta.value); ta.value = ''; const n = $('#chat-note'); if (n) n.textContent = note; setTimeout(() => { if (V.chat === 'B') openTerm(UI.termTool); else renderDrawer(); const n2 = $('#chat-note'); if (n2) n2.textContent = note; }, 1000); return; }
    if (t.closest('#reply-send') && UI.chat) { const inp = $('#reply-text'); const note = await send(UI.chat, inp.value); inp.value = ''; $('#reply-note').textContent = note; setTimeout(() => openBubbles(UI.chat), 1000); return; }
  });
  $('#reply-text').addEventListener('keydown', e => { if (e.key === 'Enter') $('#reply-send').click(); });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey && e.target.id === 'chat-text') $('[data-send]')?.click(); });
  document.addEventListener('mouseover', e => { const li = e.target.closest('.way li[data-step]'); if (li) UI.highlight(STEP_STATION[+li.dataset.step]); });
  document.addEventListener('mouseout', e => { const li = e.target.closest('.way li[data-step]'); if (li && !e.relatedTarget?.closest('.way li')) UI.highlight(null); });
  $('#dlg-close').addEventListener('click', () => $('#dlg').close());

  // ───────── Takt: Kennzahlen, Ausnahmen, offene Tafeln
  UI.tick = () => {
    const kpi = { done: S.stats.done, commits: S.stats.commits, wait: S.ex.length, chats: S.chats.filter(c => c.alive).length };
    document.querySelectorAll('[data-kpi]').forEach(el => { el.textContent = kpi[el.dataset.kpi]; });
    const safe = $('#safe'); safe.classList.toggle('hw', !!S.hardware); $('#mode').textContent = S.hardware ? 'Robot | Hardware' : 'Robot | Digital Twin';
    const exList = S.ex.map(ex => ({ ex, d: Math.hypot(ex.chat.a.x - you.x, ex.chat.a.z - you.z) })).sort((a, b) => a.d - b.d);
    $('#ex').innerHTML = exList.length ? exList.map(({ ex, d }) => `<li class="ex ${ex.kind}"><span class="ico">${ex.kind === 'approve' ? '🔒' : ex.kind === 'preview' ? '🖼️' : '❓'}</span><span class="t"><b>${esc(ex.title.replace(/^\S+\s/, ''))}</b><small>${esc(ex.chat.name)} · ${Math.round(d)} m</small></span><button data-${d < 3.2 ? 'ask' : 'go'}="${ex.id}">${d < 3.2 ? 'Antworten' : 'Hin'}</button></li>`).join('') : `<li class="calm">Normalbetrieb · ${kpi.chats} Chats arbeiten, nichts wartet auf dich</li>`;
    if (V.info === 'A') tabsPinned();
    if (!$('#drawer').hidden && UI.drawerTab !== 'info' && (UI.pollT += 1) % 12 === 0) renderDrawer();
    if (!$('#term').hidden && (UI.pollT += 1) % 12 === 0) openTerm(UI.termTool);
  };
  UI.init = () => {
    $('#look-name').textContent = `${W.lay.name} · ${L.name}`;
    const ds = $('#data-src'); ds.textContent = live.ok ? `Live: Claude Ops (${live.n} Chats)` : 'Demo-Daten'; ds.className = 'badge ' + (live.ok ? 'live' : 'demo');
    if (V.info === 'A') { tabsInit(); tabsSelect('Rollen'); }
    if (V.info === 'C' || V.chat === 'C') renderDrawer();
  };
  return UI;
}
