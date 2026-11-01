/* KreiswertS · simuliertes Backend (Mock-API) für Anmeldung, Firmenbereich und Verwaltung.
   Jede Funktion ist async und liefert nur Kopien – wie über das Netz. Ein echtes Backend (Technik noch offen) ersetzt
   diese Datei 1:1: gleiche Namen, gleiche Antworten, Fehler als ApiError { status, code }.
   Zustand: localStorage 'kw-db-v1' (Datenbank) + 'kw-session' (Sitzung); Startzustand aus daten.js (accounts).
   Rechte laut Tabelle „Wer darf was“ (Vorschau 2026-11-01) – geprüft hier im Backend, nicht in der Oberfläche. */
window.KW_API = (() => {
  'use strict';
  const D = window.KW_DATA, A = D.accounts, M = window.KW_MATCH;
  const DB_KEY = 'kw-db-v1', SESSION_KEY = 'kw-session', DAY = 864e5, LINK_MS = 15 * 60e3, REG_MS = 30 * 60e3;

  class ApiError extends Error {
    constructor(status, code) { super(code); this.name = 'ApiError'; this.status = status; this.code = code; }
  }
  const fail = (status, code) => { throw new ApiError(status, code); };

  /* ---------- Speicher (localStorage, sonst nur im Speicher dieser Seite) ---------- */
  const mem = {};
  const load = k => { try { const v = localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) {} return mem[k] ?? null; };
  const save = (k, v) => { mem[k] = v; try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const copy = v => v === undefined ? v : JSON.parse(JSON.stringify(v));
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');

  /* ---------- Startzustand aus daten.js ---------- */
  function seed() {
    const now = Date.now(), ago = d => now - d * DAY;
    const firms = D.firms.map(f => {
      const c = A.checks[f.id] || {};
      return { id: f.id, name: f.name, role: f.role, town: f.town, lat: f.lat, lon: f.lon, desc: copy(f.desc), logo: copy(f.logo),
        status: 'active', review: !!c.review, asked: false, hrb: c.hrb ?? 'HRB (Demo)', imprint: c.imprint ?? true, created: ago(c.since ?? 200) };
    });
    const items = D.firms.flatMap(f => [...f.o.map(o => ({ ...copy(o), kind: 'o', firm: f.id })), ...f.n.map(n => ({ ...copy(n), kind: 'n', firm: f.id }))])
      .map(x => ({ ...x, status: 'active', hidden: false, until: now + (A.validDays[x.id] ?? 120) * DAY, created: ago(30) }));
    const itemOf = id => items.find(x => x.id === id);
    const requests = A.requests.filter(r => itemOf(r.o) && itemOf(r.n)).map(r => {
      const to = itemOf(r.o).firm === r.from ? itemOf(r.n).firm : itemOf(r.o).firm;
      return { id: r.id, o: r.o, n: r.n, from: r.from, to, status: r.status, created: ago(r.days), answered: r.status === 'open' ? null : ago(r.days - .5) };
    });
    const reports = A.reports.filter(m => itemOf(m.item)).map(m => ({ id: m.id, item: m.item, reason: copy(m.reason), status: 'open', created: ago(m.days) }));
    const log = [
      ...firms.filter(f => f.review).map(f => ({ at: f.created, who: f.name, firm: f.id, kind: 'register', args: { firm: f.name } })),
      ...requests.map(r => ({ at: r.created, who: firmName(firms, r.from), firm: r.from, kind: 'request.send', args: { item: label(itemOf(r.o)) } })),
      ...reports.map(m => ({ at: m.created, who: '–', firm: itemOf(m.item).firm, kind: 'report', args: { item: label(itemOf(m.item)), reason: m.reason } })),
    ].sort((a, b) => b.at - a.at);
    return { v: 1, seq: 100, rules: copy(D.rules), people: A.people.map(p => ({ ...p, pending: false })), firms, items, requests, reports, log,
      links: {}, tickets: {}, seen: {}, dismissed: {} };
  }
  const firmName = (firms, id) => (firms.find(f => f.id === id) || {}).name || '–';
  const label = x => x ? { poly: x.kind === 'o' ? x.poly : x.poly.join('/'), form: x.kind === 'o' ? x.form : x.forms[0], kind: x.kind } : null;

  let db = load(DB_KEY);
  if (!db || db.v !== 1) { db = seed(); save(DB_KEY, db); }
  const commit = () => save(DB_KEY, db);
  const firmById = id => db.firms.find(f => f.id === id);
  const itemById = id => db.items.find(x => x.id === id);
  const personById = id => db.people.find(p => p.id === id);
  const addLog = (kind, args, who, firm) => { db.log.unshift({ at: Date.now(), who: who ? who.name : '–', firm: firm ?? who?.firm ?? null, kind, args }); db.log.length = Math.min(db.log.length, 300); };

  /* ---------- Rechte: Wer darf was ---------- */
  const CAN = {
    guest: ['map', 'list:coarse'],
    member: ['map', 'list', 'own', 'request'],
    admin: ['map', 'list', 'own', 'request', 'firm'],
    platform: ['map', 'list', 'moderate', 'review', 'rules'],
  };
  function ctx() {
    const s = load(SESSION_KEY), p = s && personById(s.person);
    if (!p || p.pending || (p.firm && firmById(p.firm)?.status === 'blocked')) return { role: 'guest', can: CAN.guest };
    return { role: p.role, can: CAN[p.role], person: p, firm: p.firm ? firmById(p.firm) : null };
  }
  function need(perm) {
    const c = ctx();
    if (!c.can.includes(perm)) fail(c.role === 'guest' ? 401 : 403, c.role === 'guest' ? 'login' : 'forbidden');
    return c;
  }
  // Netz simulieren: kurze Wartezeit, danach Kopie der Antwort; Fehler bleiben ApiError
  const delay = () => new Promise(r => setTimeout(r, 60 + Math.random() * 120));
  const call = fn => async (...a) => { await delay(); const out = fn(...a); commit(); return copy(out); };

  /* ---------- Matching auf dem aktuellen Stand ---------- */
  const live = x => x.status === 'active' && !x.hidden && x.until > Date.now() && firmById(x.firm)?.status === 'active';
  const key = (o, n) => `${o.id}~${n.id}`;
  function pairs(firmId) {   // alle Treffer der eigenen Inserate, nach Wert
    const out = [];
    db.items.filter(x => x.firm === firmId && live(x)).forEach(mine => {
      db.items.filter(x => x.firm !== firmId && x.kind !== mine.kind && live(x)).forEach(other => {
        const [o, n] = mine.kind === 'o' ? [mine, other] : [other, mine];
        const m = M.match(o, n, firmById(o.firm), firmById(n.firm), db.rules, mine.kind === 'o' ? 'offer' : 'need');
        if (m) out.push({ m, mine, other });
      });
    });
    return out.sort((a, b) => b.m.score - a.m.score);
  }
  const reqFor = (o, n) => db.requests.filter(r => r.o === o && r.n === n).sort((a, b) => b.created - a.created)[0] || null;
  const linked = (a, b) => db.requests.some(r => r.status === 'accepted' && ((r.from === a && r.to === b) || (r.from === b && r.to === a)));
  // F3 (2026-11-01): Gegenüber nur mit Rolle, Gemeinde, Entfernung – Name erst nach angenommener Anfrage
  function party(firmId, viewer) {
    const f = firmById(firmId), me = viewer && firmById(viewer);
    const out = { role: f.role, town: f.town, km: me ? Math.round(M.km(f, me) * 10) / 10 : null };
    if (viewer === 'platform' || (viewer && linked(firmId, viewer))) Object.assign(out, { id: f.id, name: f.name, logo: f.logo });
    return out;
  }
  const itemOut = x => ({ id: x.id, kind: x.kind, poly: x.poly, form: x.form, forms: x.forms, q: x.q, t: x.t, note: x.note, until: x.until, status: x.status, hidden: x.hidden });

  /* ---------- Prüfungen der Eingaben ---------- */
  const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
  const text = (v, min, max, code) => { v = String(v ?? '').trim(); if (v.length < min || v.length > max) fail(422, code); return v; };
  const email = v => { v = String(v ?? '').trim().toLowerCase(); if (!EMAIL.test(v)) fail(422, 'email'); return v; };
  const oneOf = (v, list, code) => { if (!list.includes(v)) fail(422, code); return v; };
  const listOf = (v, list, code) => { if (!Array.isArray(v) || !v.length || v.some(x => !list.includes(x))) fail(422, code); return [...new Set(v)]; };

  function startSession(p) { save(SESSION_KEY, { person: p.id, at: Date.now() }); addLog('login', {}, p); return me(); }
  function me() {
    const c = ctx();
    if (!c.person) return null;
    const p = c.person;
    return { person: { id: p.id, name: p.name, email: p.email, role: p.role }, firm: c.firm ? { id: c.firm.id, name: c.firm.name, role: c.firm.role, town: c.firm.town, logo: c.firm.logo } : null, can: c.can };
  }

  const api = {
    ApiError,

    /* ---------- Anmeldung ---------- */
    me: call(me),
    // Demo: Schnellwahl je Rolle und die Passkeys „auf diesem Gerät“ (echt: WebAuthn-Auswahl des Browsers)
    demoAccounts: call(() => A.demo.map(d => {
      const p = d.person && personById(d.person);
      return { role: d.role, person: p ? p.id : null, name: p ? p.name : null, firm: p && p.firm ? firmById(p.firm)?.name : null };
    })),
    passkeys: call(() => db.people.filter(p => p.passkey && !p.pending).map(p => ({ id: p.id, name: p.name, email: p.email, firm: p.firm ? firmById(p.firm)?.name : null, role: p.role }))),
    loginPasskey: call(id => {
      const p = personById(id);
      if (!p || !p.passkey || p.pending) fail(401, 'passkey');
      if (p.firm && firmById(p.firm)?.status === 'blocked') fail(403, 'blocked');
      return startSession(p);
    }),
    // Anmeldelink (15 min, einmal gültig). Antwort gleich für bekannte und neue Adressen (keine Konto-Erkennung von außen);
    // demoMail gibt es nur in der Simulation – sie ersetzt das Postfach.
    requestLink: call(addr => {
      const e = email(addr), token = rid(), exp = Date.now() + LINK_MS;
      Object.keys(db.links).forEach(t => { if (db.links[t].exp < Date.now()) delete db.links[t]; });
      db.links[token] = { email: e, exp };
      return { sent: true, demoMail: { to: e, token, exp, known: db.people.some(p => p.email === e && !p.pending) } };
    }),
    openLink: call(token => {
      const l = db.links[token];
      if (!l) fail(410, 'link');
      delete db.links[token];
      if (l.exp < Date.now()) fail(410, 'expired');
      const p = db.people.find(x => x.email === l.email);
      if (p) {
        if (p.firm && firmById(p.firm)?.status === 'blocked') fail(403, 'blocked');
        if (p.pending) { p.pending = false; addLog('join', { firm: firmById(p.firm)?.name }, p); }
        return { session: startSession(p) };
      }
      const ticket = rid();
      db.tickets[ticket] = { email: l.email, exp: Date.now() + REG_MS };
      return { register: { email: l.email, ticket } };
    }),
    // Registrierung nach bestätigter E-Mail · F1 nein: Firma sofort aktiv, das Team prüft nachträglich
    register: call((ticket, data = {}) => {
      const t = db.tickets[ticket];
      if (!t || t.exp < Date.now()) fail(410, 'ticket');
      const name = text(data.name, 2, 80, 'name'), firm = text(data.firm, 2, 80, 'firm');
      const role = oneOf(data.role, Object.keys(D.roles), 'role');
      const town = D.region.towns.find(x => x.name === data.town) || fail(422, 'town');
      if (db.firms.some(f => f.name.toLowerCase() === firm.toLowerCase())) fail(409, 'firmExists');
      delete db.tickets[ticket];
      const n = ++db.seq, a = n * 2.399;   // neue Firmen leicht versetzt um den Ortsmittelpunkt
      const f = { id: 'f' + n, name: firm, role, town: town.name, lat: town.lat + Math.sin(a) * .006, lon: town.lon + Math.cos(a) * .009,
        desc: { de: '', en: '' }, logo: null, status: 'active', review: true, asked: false, hrb: '', imprint: false, created: Date.now() };
      const p = { id: 'u' + n, email: t.email, name, firm: f.id, role: 'admin', passkey: false, pending: false };
      db.firms.push(f); db.people.push(p);
      addLog('register', { firm: f.name }, p, f.id);
      return startSession(p);
    }),
    logout: call(() => { save(SESSION_KEY, null); return true; }),

    /* ---------- Öffentlich ---------- */
    rules: call(() => db.rules),
    overview: call(() => {
      const act = db.items.filter(live);
      let pairsN = 0;
      act.filter(x => x.kind === 'o').forEach(o => act.filter(x => x.kind === 'n').forEach(n => { if (M.match(o, n, firmById(o.firm), firmById(n.firm), db.rules)) pairsN++; }));
      return { firms: db.firms.filter(f => f.status === 'active').length, offersT: act.filter(x => x.kind === 'o').reduce((s, x) => s + x.t, 0), pairs: pairsN,
        towns: [...new Set(db.firms.map(f => f.town))], dots: db.firms.filter(f => f.status === 'active').map(f => ({ lat: f.lat, lon: f.lon, role: f.role })) };
    }),
    // Inserate anderer: Gäste „grob“ (Polymer, Menge gerundet, Gemeinde, keine Firmennamen), angemeldet mit Details
    listings: call(() => {
      const c = ctx(), coarse = !c.can.includes('list');
      return db.items.filter(live).filter(x => !c.firm || x.firm !== c.firm.id).map(x => {
        if (coarse) return { kind: x.kind, poly: x.kind === 'o' ? [x.poly] : x.poly, t: x.t < 5 ? { lt: 5 } : { about: Math.round(x.t / 5) * 5 }, town: firmById(x.firm).town };
        return { ...itemOut(x), party: party(x.firm, c.role === 'platform' ? 'platform' : c.firm.id) };
      });
    }),

    /* ---------- Firmenbereich ---------- */
    myFirm: call(() => {
      const c = need('own'), f = c.firm;
      return { id: f.id, name: f.name, role: f.role, town: f.town, desc: f.desc, logo: f.logo, review: f.review, created: f.created, canEdit: c.can.includes('firm') };
    }),
    updateFirm: call(patch => {
      const c = need('firm'), lang = patch.lang === 'en' ? 'en' : 'de';
      c.firm.desc = { ...c.firm.desc, [lang]: text(patch.desc, 0, 400, 'desc') };
      addLog('firm.edit', { firm: c.firm.name }, c.person);
      return true;
    }),
    team: call(() => {
      const c = need('own');
      return db.people.filter(p => p.firm === c.firm.id).map(p => ({ id: p.id, name: p.name, email: p.email, role: p.role, pending: p.pending, me: p.id === c.person.id }));
    }),
    invite: call((addr, role) => {
      const c = need('firm'), e = email(addr);
      oneOf(role, ['member', 'admin'], 'role');
      if (db.people.some(p => p.email === e)) fail(409, 'emailExists');
      const p = { id: 'u' + (++db.seq), email: e, name: e.split('@')[0], firm: c.firm.id, role, passkey: false, pending: true };
      db.people.push(p);
      addLog('invite', { email: e }, c.person);
      return { id: p.id };
    }),
    removeMember: call(id => {
      const c = need('firm'), p = personById(id);
      if (!p || p.firm !== c.firm.id) fail(404, 'notFound');
      if (p.id === c.person.id) fail(409, 'self');
      db.people = db.people.filter(x => x !== p);
      addLog('member.remove', { name: p.name }, c.person);
      return true;
    }),
    myItems: call(() => {
      const c = need('own'), ps = pairs(c.firm.id);
      return db.items.filter(x => x.firm === c.firm.id).map(x => ({ ...itemOut(x), hits: ps.filter(p => p.mine.id === x.id).length, live: live(x) }));
    }),
    saveItem: call(data => {
      const c = need('own'), old = data.id ? itemById(data.id) : null;
      if (data.id && (!old || old.firm !== c.firm.id)) fail(403, 'forbidden');
      const kind = oneOf(data.kind, ['o', 'n'], 'kind'), polys = Object.keys(D.poly), forms = Object.keys(D.forms), quals = Object.keys(D.quality);
      const t = Number(data.t); if (!(t > 0 && t <= 10000)) fail(422, 't');
      const until = Number(data.until); if (!(until > Date.now())) fail(422, 'until');
      const x = { id: old ? old.id : 'x' + (++db.seq), kind, firm: c.firm.id, t: Math.round(t * 10) / 10, until,
        status: oneOf(data.status || 'active', ['active', 'draft', 'paused'], 'status'), hidden: old ? old.hidden : false, created: old ? old.created : Date.now(),
        note: data.note ? { de: text(data.note, 0, 120, 'note'), en: text(data.note, 0, 120, 'note') } : undefined };
      if (kind === 'o') Object.assign(x, { poly: oneOf(data.poly, polys, 'poly'), form: oneOf(data.form, forms, 'form'), q: oneOf(data.q, quals, 'q') });
      else Object.assign(x, { poly: listOf(data.poly, polys, 'poly'), forms: listOf(data.forms, forms, 'form'), q: listOf(data.q, quals, 'q') });
      if (old) db.items[db.items.indexOf(old)] = x; else db.items.push(x);
      addLog(old ? 'item.edit' : 'item.new', { item: label(x) }, c.person);
      return { id: x.id };
    }),
    deleteItem: call(id => {
      const c = need('own'), x = itemById(id);
      if (!x || x.firm !== c.firm.id) fail(404, 'notFound');
      db.items = db.items.filter(y => y !== x);
      addLog('item.delete', { item: label(x) }, c.person);
      return true;
    }),
    matches: call(() => {
      const c = need('own'), seen = db.seen[c.firm.id] || [], gone = db.dismissed[c.firm.id] || [];
      return pairs(c.firm.id).filter(p => !gone.includes(key(p.m.o, p.m.n))).map(({ m, mine, other }) => {
        const r = reqFor(m.o.id, m.n.id);
        return { key: key(m.o, m.n), score: m.score, parts: m.parts, near: m.near, cover: m.cover, qfit: m.qfit,
          mine: itemOut(mine), other: itemOut(other), party: party(other.firm, c.firm.id), isNew: !seen.includes(key(m.o, m.n)),
          request: r ? { id: r.id, status: r.status, mine: r.from === c.firm.id } : null };
      });
    }),
    markSeen: call(k => { const c = need('own'), s = db.seen[c.firm.id] = db.seen[c.firm.id] || []; if (!s.includes(k)) s.push(k); return true; }),
    dismiss: call(k => { const c = need('own'), s = db.dismissed[c.firm.id] = db.dismissed[c.firm.id] || []; if (!s.includes(k)) s.push(k); return true; }),
    sendRequest: call(k => {
      const c = need('request'), p = pairs(c.firm.id).find(x => key(x.m.o, x.m.n) === k);
      if (!p) fail(404, 'notFound');
      const r0 = reqFor(p.m.o.id, p.m.n.id);
      if (r0 && r0.status !== 'declined') fail(409, 'requestExists');
      const r = { id: 'r' + (++db.seq), o: p.m.o.id, n: p.m.n.id, from: c.firm.id, to: p.other.firm, status: 'open', created: Date.now(), answered: null };
      db.requests.push(r);
      addLog('request.send', { item: label(p.m.o) }, c.person);
      return { id: r.id };
    }),
    requests: call(() => {
      const c = need('request'), me = c.firm.id;
      return db.requests.filter(r => r.from === me || r.to === me).sort((a, b) => b.created - a.created).map(r => {
        const o = itemById(r.o), n = itemById(r.n), other = r.from === me ? r.to : r.from;
        return { id: r.id, status: r.status, incoming: r.to === me, created: r.created, answered: r.answered,
          offer: o ? itemOut(o) : null, need: n ? itemOut(n) : null, party: party(other, me) };
      });
    }),
    answer: call((id, accept) => {
      const c = need('request'), r = db.requests.find(x => x.id === id);
      if (!r || r.to !== c.firm.id) fail(404, 'notFound');
      if (r.status !== 'open') fail(409, 'answered');
      Object.assign(r, { status: accept ? 'accepted' : 'declined', answered: Date.now() });
      addLog(accept ? 'request.accept' : 'request.decline', { item: label(itemById(r.o)) }, c.person);
      return true;
    }),
    report: call((itemId, reason) => {
      const c = need('list'), x = itemById(itemId);
      if (!x || !live(x)) fail(404, 'notFound');
      const r = text(reason, 3, 200, 'reason');
      db.reports.push({ id: 'm' + (++db.seq), item: x.id, reason: { de: r, en: r }, status: 'open', created: Date.now(), by: c.firm ? c.firm.id : null });
      addLog('report', { item: label(x), reason: { de: r, en: r } }, c.person);
      return true;
    }),

    /* ---------- Verwaltung (Plattform-Team) ---------- */
    adminOverview: call(() => {
      need('review');
      const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
      const acc = db.requests.filter(r => r.status === 'accepted').map(r => [itemById(r.o), itemById(r.n)]).filter(([o, n]) => o && n);
      return {
        kpi: { firms: db.firms.filter(f => f.status === 'active').length, goalFirms: A.goalFirms, items: db.items.filter(live).length, itemsAll: db.items.length,
          requests: db.requests.filter(r => r.created >= +month).length, requestsAll: db.requests.length, tons: acc.reduce((s, [o, n]) => s + Math.min(o.t, n.t), 0),
          offersT: db.items.filter(x => x.kind === 'o' && live(x)).reduce((s, x) => s + x.t, 0) },
        queue: db.firms.filter(f => f.review).sort((a, b) => a.created - b.created).map(f => ({ id: f.id, name: f.name, review: f.review, role: f.role, town: f.town, hrb: f.hrb, imprint: f.imprint, asked: f.asked, status: f.status, created: f.created, logo: f.logo,
          contact: (db.people.find(p => p.firm === f.id && p.role === 'admin') || {}).email || '' })),
        reports: db.reports.filter(m => m.status === 'open').map(m => { const x = itemById(m.item); return { id: m.id, reason: m.reason, created: m.created, item: x ? itemOut(x) : null, firm: x ? firmById(x.firm).name : '' }; }),
        rules: db.rules, last: db.log[0] || null,
      };
    }),
    firms: call(() => {
      need('review');
      return db.firms.map(f => ({ id: f.id, name: f.name, role: f.role, town: f.town, status: f.status, review: f.review, asked: f.asked, logo: f.logo,
        people: db.people.filter(p => p.firm === f.id).length, items: db.items.filter(x => x.firm === f.id).length }));
    }),
    // ok = geprüft · ask = Rückfrage · block = sperren (Inserate unsichtbar, Anmeldung gesperrt) · unblock
    reviewFirm: call((id, action) => {
      const c = need('review'), f = firmById(id) || fail(404, 'notFound');
      oneOf(action, ['ok', 'ask', 'block', 'unblock'], 'action');
      if (action === 'ok') Object.assign(f, { review: false, asked: false });
      if (action === 'ask') f.asked = true;
      if (action === 'block') f.status = 'blocked';
      if (action === 'unblock') f.status = 'active';
      addLog('firm.' + action, { firm: f.name }, c.person, f.id);
      return true;
    }),
    allItems: call(() => {
      need('moderate');
      return db.items.map(x => ({ ...itemOut(x), firm: firmById(x.firm)?.name || '–', live: live(x) })).sort((a, b) => a.firm.localeCompare(b.firm));
    }),
    moderateItem: call((id, hidden) => {
      const c = need('moderate'), x = itemById(id) || fail(404, 'notFound');
      x.hidden = !!hidden;
      addLog(hidden ? 'item.hide' : 'item.show', { item: label(x) }, c.person, x.firm);
      return true;
    }),
    resolveReport: call((id, action) => {
      const c = need('moderate'), m = db.reports.find(r => r.id === id) || fail(404, 'notFound');
      oneOf(action, ['keep', 'hide'], 'action');
      m.status = action === 'hide' ? 'hidden' : 'kept';
      const x = itemById(m.item);
      if (x && action === 'hide') x.hidden = true;
      addLog('report.' + action, { item: label(x) }, c.person, x ? x.firm : null);
      return true;
    }),
    saveRules: call(r => {
      const c = need('rules'), w = ['wq', 'wm', 'wd'].map(k => Number(r[k]));
      if (w.some(v => !(v >= 0 && v <= 1)) || Math.abs(w[0] + w[1] + w[2] - 1) > .001) fail(422, 'weights');
      const dmax = Number(r.dmax); if (!(dmax >= 1 && dmax <= 200)) fail(422, 'dmax');
      db.rules = { ...db.rules, wq: w[0], wm: w[1], wd: w[2], dmax };
      addLog('rules', { wq: w[0], wm: w[1], wd: w[2], dmax }, c.person);
      return db.rules;
    }),
    log: call(() => { need('review'); return db.log.slice(0, 100); }),

    /* ---------- Demo ---------- */
    reset: call(() => { db = seed(); save(SESSION_KEY, null); return true; }),
  };
  return api;
})();
