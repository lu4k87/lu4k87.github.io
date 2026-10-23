// Claude Ops (eigenes Repo, Port 18097) = einzige Quelle für echte Chats: lesen (/api/state, /api/chat), senden (/api/send), Chat starten.
// Büro unter Claude Ops (/agenten-buero/) = gleicher Origin → darf POST (server.py _from_page). Büro auf Port 8766 liest nur (CORS nur GET).
export const UNDER_OPS = location.pathname.startsWith('/agenten-buero/');
export const OPS = UNDER_OPS ? '' : 'http://localhost:18097';
const READONLY = { ok: false, via: '', note: 'Nur lesen: Senden geht im Büro unter Claude Ops (http://127.0.0.1:18097/agenten-buero/)' };
const VIA = { vscode: 'VS Code · Enter dort', direct: 'direkt zugestellt' };

async function post(path, body) {
  try {
    const r = await fetch(OPS + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && j.ok !== false, via: j.via || '', note: j.note || j.error || `HTTP ${r.status}` };
  } catch { return { ok: false, via: '', note: 'Claude Ops nicht erreichbar' }; }
}

// Verlauf eines echten Chats (Nachrichten, Werkzeug-Blöcke, offene Rückfrage), 5 s zwischengespeichert; Fehler → Ausnahme
const cache = new Map();
export async function opsChat(sid, n = 12) {
  const h = cache.get(sid); if (h && performance.now() - h.t < 5000) return h.m;
  const j = await (await fetch(`${OPS}/api/chat?sid=${encodeURIComponent(sid)}&n=${n}`, { signal: AbortSignal.timeout(3000) })).json();
  const m = (j.msgs || []).map(x => ({ role: x.role === 'tools' ? 'tools' : x.role === 'user' ? 'user' : 'ai', text: x.role === 'tools' ? (x.items || []).map(i => `${i[0]} ×${i[1]}`).join(' · ') : x.text }));
  if (j.ask) m.push({ role: 'ask', text: j.ask });
  cache.set(sid, { t: performance.now(), m }); return m;
}

// Text an einen echten Chat (sid + src aus /api/state): Claude → vscode-Link, Enter beim User; Codex + Gemini direkt
export const opsSend = (c, text) => { cache.delete(c.sid); return UNDER_OPS ? post('/api/send', { sid: c.sid, src: c.src, text }) : Promise.resolve(READONLY); };

// neuer Chat: Claude per vscode-Link (/api/open-chat), Gemini direkt (sid null), Codex → 501 mit Hinweis aus Claude Ops
export const opsStart = (src, text) => !UNDER_OPS ? Promise.resolve(READONLY)
  : src === 'claude' ? post('/api/open-chat', { sid: '', prompt: text }).then(r => r.ok ? { ...r, via: 'vscode', note: 'Neuer Claude-Chat steht in VS Code – Enter dort startet ihn' } : r)
  : post('/api/send', { sid: null, src, text });

// Rückmeldung für die Notiz unter dem Eingabefeld: Zustellweg + Text von Claude Ops
export const noteOf = r => `${r.ok ? '✓' : '⚠️'} ${r.via ? VIA[r.via] || r.via : ''}${r.via ? ' · ' : ''}${r.note}`;
