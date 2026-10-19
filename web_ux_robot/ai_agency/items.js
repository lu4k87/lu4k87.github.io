// Inhalte der 3 Ebenen: Station → Einträge (echte Setup-Daten, Workflow aus wf.js), Detail je Eintrag mit Querverweisen.
import * as WF from './data/wf.js';
import { STATIONS, ICON } from './office.js';

// „Was ist das?“ + „Was kann ich hier tun?“ je Station (Ebene 2)
export const ABOUT = {
  tresen: ['Hier gibst du Aufträge und bekommst Antworten.', 'Aufträge ansehen, fertige Antworten lesen'],
  doors: ['Drei Türen für Claude, Codex und Gemini. Jeder neue Chat holt sich hier das Lagebild.', 'laufende Chats ansehen, Rückfragen beantworten'],
  roles: ['Jeder Chat startet als Organizer, wechselt in eine Fachrolle, prüft und liefert ab. Der Hut zeigt die Rolle.', 'Rollen und ihre Werkzeuge nachschlagen'],
  bench: ['Acht Fachrollen bauen hier. Jeder Werkzeug-Aufruf läuft durch die Hooks davor und danach.', 'sehen, wer gerade woran baut'],
  agents: ['Spezialisten mit eigenem Kontext. Ein Chat ruft sie mit Briefing, sie liefern einen Befund.', 'Agenten mit Modell und Zweck nachschlagen'],
  skills: ['Handbücher je Thema. Ein Chat lädt nur, was die Anfrage berührt – einmal je Chat.', 'Skills und ihre Rollen nachschlagen'],
  memory: ['Gedächtnis über Chats: eine Akte je Erkenntnis. Aus jeder Korrektur wird eine Regel.', 'Erkenntnisse lesen'],
  repos: ['Jeder fertige Stand liegt hier sicher – nur Fast-Forward, nie --force.', 'Repos öffnen'],
  mcp: ['Live-Leitungen nach draußen, nur wo kein Terminal-Befehl hinkommt.', 'Anschlüsse nachschlagen'],
  hooks: ['Prüfautomaten im Takt eines Chats: sie geben Kontext, warnen, fragen oder blocken.', 'Hook-Stellen nachschlagen'],
  claims: ['Wer arbeitet woran? Eine Zeile je Anfrage, damit sich Chats nicht in die Quere kommen.', 'Claims ansehen'],
  previews: ['Erst sehen, dann bauen: Vorschauseiten mit Varianten. Deine Wahl ist endgültig.', 'Vorschauseiten öffnen'],
  settings: ['Die Verkabelung: Berechtigungen, Hooks, Memory-Pfad, Modell je Rechner.', 'Einstellungen nachschlagen'],
  sync: ['Laptop, Labor und Home-PC starten mit demselben Stand. Git ist die einzige Quelle.', 'Ablauf des Abgleichs ansehen'],
  qa: ['Fertig nur mit Beleg. Vier Bahnen für die Prüfstufen 0 bis 3.', 'Prüfstufen nachschlagen'],
  robot: ['Sicherheitszone: Tests laufen im Robot | Digital Twin. Robot | Hardware gibst nur du frei.', 'Regeln der Sicherheit lesen'],
  post: ['Eigene, geprüfte Dateien werden committet und gepusht.', 'Regeln für Commit und Push lesen'],
  docs: ['Neue Funktion, Name oder Port? Die Doku en und de zieht im selben Zug mit.', 'Regeln der Doku lesen'],
};
export const PHASE_COLOR = { auftrag: '#FF9F7A', plan: '#A88BF0', bau: '#5FAEF0', pruef: '#3FC497', liefer: '#EE8AB0' };
export const phaseOfStep = n => n <= 1 ? 'auftrag' : n <= 5 ? 'plan' : n === 6 ? 'bau' : n <= 8 ? 'pruef' : 'liefer';

const HOME = { chat: 'doors', order: 'tresen', agent: 'agents', skill: 'skills', memory: 'memory', repo: 'repos', mcp: 'mcp', hook: 'hooks', claim: 'claims', preview: 'previews', setting: 'settings', sync: 'sync', level: 'qa', safety: 'robot', step: 'post' };
export const homeOf = (type, id) => type === 'role' ? (WF.FACH.includes(id) ? 'bench' : 'roles') : type === 'step' && +id === 8 ? 'docs' : HOME[type] || 'tresen';
const roleName = r => `${WF.ROLES[r].icon} ${WF.ROLES[r].name}`;
const rolesWith = pred => Object.keys(WF.ROLES).filter(r => pred(WF.ROLES[r]));

// Einträge einer Station (Ebene 2) – {type, id, title, meta, hot}
export function itemsOf(id, D, S) {
  const n = a => a || [];
  switch (id) {
    case 'tresen': return S.orders.slice(0, 8).map(o => ({ type: 'order', id: o.id, title: `[${o.prefix}] ${o.title}`, meta: `${WF.ORDER_TYPES[o.type].name}${o.done ? ' · 🏁 fertig' : ''}` }));
    case 'doors': return S.chats.filter(c => c.alive).map(c => ({ type: 'chat', id: c.id, title: c.id, meta: `${c.tool} · ${c.role ? WF.ROLES[c.role].name : 'Start'}${c.live ? '' : ' · Demo'}`, hot: S.ex.some(e => e.chat === c) }));
    case 'roles': return Object.keys(WF.ROLES).map(r => ({ type: 'role', id: r, title: roleName(r), meta: WF.ROLES[r].fixed ? 'fester Schritt' : 'Fachrolle' }));
    case 'bench': return WF.FACH.map(r => { const c = S.chats.find(x => x.alive && x.role === r); return { type: 'role', id: r, title: roleName(r), meta: c ? `arbeitet: ${c.id}` : 'frei' }; });
    case 'agents': return n(D.agents).map(a => ({ type: 'agent', id: a.id, title: a.id, meta: `${a.model} · ${a.edits ? 'ändert' : 'liest'}` }));
    case 'skills': return n(D.skills).map(s => ({ type: 'skill', id: s.id, title: s.id, meta: s.scope === 'global' ? 'allgemein' : 'dev_ws' }));
    case 'memory': return n(D.memory).map(m => ({ type: 'memory', id: m.file, title: m.title, meta: m.scope === 'global' ? 'gemeinsam' : 'dev_ws' }));
    case 'repos': return n(D.repos).map(r => ({ type: 'repo', id: r.id, title: r.id, meta: r.kind }));
    case 'mcp': return n(D.mcp).map(m => ({ type: 'mcp', id: m.id, title: m.id, meta: m.where }));
    case 'hooks': return n(D.hooks).map((h, i) => ({ type: 'hook', id: String(i), title: h.event, meta: h.script }));
    case 'claims': return S.boardClaims().map((c, i) => ({ type: 'claim', id: String(i), title: c.who || c.text, meta: c.task || '' }));
    case 'previews': return n(D.previews).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30).map(p => ({ type: 'preview', id: p.folder, title: p.title, meta: `${p.topic} · ${p.date}` }));
    case 'settings': return n(D.settings).map((s, i) => ({ type: 'setting', id: String(i), title: s.file, meta: '' }));
    case 'sync': return n(D.sync && D.sync.chain).map((c, i) => ({ type: 'sync', id: String(i), title: c.split(':')[0], meta: `Schritt ${i + 1}` }));
    case 'qa': return WF.LEVELS.map(l => ({ type: 'level', id: String(l.n), title: `Stufe ${l.n} · ${l.name}`, meta: l.what }));
    case 'robot': return [['free', 'Frei'], ['ask', 'Mit Rückfrage'], ['never', 'Nie ohne deine Freigabe']].map(([k, t]) => ({ type: 'safety', id: k, title: t, meta: `${WF.SAFETY[k].length} Regeln` }));
    case 'post': return [9, 10].map(s => ({ type: 'step', id: String(s), title: `${s} · ${WF.STEPS[s - 1].name}`, meta: 'Abliefern' }));
    case 'docs': return [{ type: 'step', id: '8', title: `8 · ${WF.STEPS[7].name}`, meta: 'Prüfen' }];
  }
  return [];
}

// Detail eines Eintrags (Ebene 3): {icon, kick, title, chips, desc, fields, links:{title, items}, href}
export function detailOf(type, id, D, S) {
  const n = a => a || [];
  const link = (t, i, label) => ({ type: t, id: i, label });
  switch (type) {
    case 'agent': {
      const a = n(D.agents).find(x => x.id === id) || WF.AGENTS.find(x => x.id === id) || { id }, w = WF.AGENTS.find(x => x.id === id) || {};
      return { icon: '🤖', kick: 'Subagent', title: id, chips: [a.model, a.edits ? 'ändert Dateien' : 'nur lesen', a.scope].filter(Boolean), desc: w.does || a.does,
        fields: [['Modell', `${a.model || '–'}${w.effort ? ' · Effort ' + w.effort : ''}`], ['Rückgabe', 'Befund an den rufenden Chat']],
        links: { title: 'Gerufen von', items: rolesWith(r => n(r.agents).includes(id)).map(r => link('role', r, roleName(r))) },
        now: { title: 'Gerade im Einsatz für', items: n(S.subs).filter(x => x.A.id === id && !x.done && x.caller.alive).map(x => link('chat', x.caller.id, `${x.caller.id} · [${x.caller.order.prefix}]`)) } };
    }
    case 'skill': {
      const s = n(D.skills).find(x => x.id === id) || { id };
      return { icon: '📚', kick: 'Skill', title: id, chips: [s.scope === 'global' ? 'allgemein' : 'dev_ws'], desc: s.does,
        fields: [['Laden', 'nur wenn die Anfrage das Thema berührt, einmal je Chat']],
        links: { title: 'Leit- oder Zusatz-Skill von', items: rolesWith(r => n(r.skills).concat(n(r.extra)).includes(id)).map(r => link('role', r, roleName(r))) } };
    }
    case 'role': {
      const r = WF.ROLES[id];
      return { icon: r.icon, kick: r.fixed ? 'Fester Schritt' : 'Fachrolle', title: r.name, chips: [r.fixed ? 'jeder Chat' : 'je nach Auftrag'], desc: r.does,
        fields: [['Prüfung', r.check || '–'], ['Methode', r.method || '–']],
        links: { title: 'Werkzeuge der Rolle', items: n(r.skills).concat(n(r.extra)).map(s => link('skill', s, `📚 ${s}`)).concat(n(r.agents).map(a => link('agent', a, `🤖 ${a}`))) },
        now: { title: 'Gerade in dieser Rolle', items: S.chats.filter(c => c.alive && c.role === id).map(c => link('chat', c.id, `${c.id} · [${c.order.prefix}]`)) } };
    }
    case 'memory': { const m = n(D.memory).find(x => x.file === id) || {}; return { icon: '🗄️', kick: 'Memory', title: m.title || id, chips: [m.scope === 'global' ? 'gemeinsam' : 'dev_ws'], desc: m.hook, fields: [['Datei', m.file]] }; }
    case 'repo': { const r = n(D.repos).find(x => x.id === id) || {}; return { icon: '🔐', kick: 'Repo', title: id, chips: [r.kind].filter(Boolean), desc: r.kind, fields: [['Adresse', r.repo || '–']], href: r.repo }; }
    case 'mcp': { const m = n(D.mcp).find(x => x.id === id) || {}; return { icon: '🔌', kick: 'MCP-Anschluss', title: id, chips: [m.where].filter(Boolean), desc: m.does, fields: [['Regel', WF.MCP_RULE]] }; }
    case 'hook': { const h = n(D.hooks)[+id] || {}; return { icon: '🎛️', kick: 'Hook', title: h.event, chips: [h.matcher || 'alle'].filter(Boolean), desc: WF.HOOKS.find(x => x.event === h.event)?.does || 'Prüfstelle im Takt eines Chats', fields: [['Skript', h.script], ['Werkzeuge', h.matcher || 'alle']] }; }
    case 'claim': { const c = S.boardClaims()[+id] || {}; return { icon: '📌', kick: 'Claim', title: c.who || '–', chips: [S.liveClaims && S.liveClaims.length ? 'live' : 'Demo'], desc: c.task, fields: [['Dateien', c.files || '–']] }; }
    case 'preview': { const p = n(D.previews).find(x => x.folder === id) || {}; return { icon: '🖼️', kick: 'Vorschauseite', title: p.title || id, chips: [p.topic, p.date].filter(Boolean), desc: 'Varianten mit Bildern; deine Wahl auf der Seite ist endgültig.', fields: [['Ordner', p.folder]], href: p.url }; }
    case 'setting': { const s = n(D.settings)[+id] || {}; return { icon: '⚙️', kick: 'Einstellung', title: s.file, chips: [], desc: s.does, fields: [] }; }
    case 'sync': { const c = n(D.sync && D.sync.chain)[+id] || ''; return { icon: '🚉', kick: `Abgleich · Schritt ${+id + 1}`, title: c.split(':')[0], chips: n(D.sync && D.sync.machines), desc: c, fields: [['Regel', WF.SYNC.rule]] }; }
    case 'level': { const l = WF.LEVELS[+id]; return { icon: '🧪', kick: 'Prüfstufe', title: `Stufe ${l.n} · ${l.name}`, chips: [], desc: l.what, fields: [['Prüfung', l.check]] }; }
    case 'safety': return { icon: '🦾', kick: 'Sicherheit', title: { free: 'Frei', ask: 'Mit Rückfrage', never: 'Nie ohne deine Freigabe' }[id], chips: [], desc: WF.SAFETY.who, list: WF.SAFETY[id], fields: [] };
    case 'step': { const s = WF.STEPS[+id - 1]; return { icon: +id === 8 ? '📝' : '📮', kick: `Schritt ${s.n}`, title: s.name, chips: [WF.PHASES.find(p => p.id === s.phase).name], desc: s.text, fields: [] }; }
    case 'order': { const o = S.orders.find(x => x.id === id) || {}; const T = WF.ORDER_TYPES[o.type] || {}; return { icon: '🛎️', kick: 'Auftrag', title: `[${o.prefix}] ${o.title}`, chips: [T.name, o.done ? 'fertig' : 'läuft'].filter(Boolean), desc: T.hint, fields: [['Schritte', n(T.steps).join(' · ')], ['Chat', o.chat ? o.chat.id : '–']], links: o.chat && o.chat.alive ? { title: 'Bearbeitet von', items: [link('chat', o.chat.id, o.chat.id)] } : null }; }
  }
  return { icon: ICON[id] || '•', kick: type, title: id, chips: [], desc: '', fields: [] };
}

// Suche über alles (Befehlspalette, Variante C)
export function searchAll(q, D, S) {
  q = q.trim().toLowerCase(); if (!q) return [];
  const out = [];
  Object.keys(STATIONS).forEach(id => { const s = STATIONS[id]; if ((s.name + ' ' + s.sub).toLowerCase().includes(q)) out.push({ kind: 'station', id, title: `${ICON[id]} ${s.name}`, meta: 'Bereich' }); });
  Object.keys(STATIONS).forEach(id => itemsOf(id, D, S).forEach(it => { if ((it.title + ' ' + (it.meta || '')).toLowerCase().includes(q)) out.push({ kind: 'item', type: it.type, id: it.id, station: id, title: it.title, meta: `${STATIONS[id].name} · ${it.meta || ''}` }); }));
  const seen = new Set(); return out.filter(o => { const k = o.kind + o.type + o.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
}
