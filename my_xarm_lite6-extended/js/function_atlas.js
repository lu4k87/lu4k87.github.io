/* Funktionsatlas in docs/project_docs.html (Abschnitt 05, #atlas-list): alle Funktionen als Karten, je Ablauf ein animierter
   Flow-Graph, Kreisläufe zusätzlich als Ring. Früher eigene Seite present_function_atlas.html (jetzt Weiterleitung, #<id> bleibt gültig).
   Flow-Engine = Kopie aus .claude/skills/flow-graph/flow_graph_template.html, erweitert um `via` (Rückweg über eigene Zeile).
   Neue Funktion: <article class="fn"> im Bereich in project_docs.html ergänzen (data-a Bereich, data-f Ablauf, data-s Stufen s/p/r).
   Neuer Ablauf: Eintrag in FLOWS (SPEC wie Skill flow-graph, Topics per grep belegt; loop = Ring-Stationen).
   Styles: css/function_atlas.css (alles unter .fa). */
/* ═════════ FlowGraph-Engine (aus .claude/skills/flow-graph/flow_graph_template.html, + via) ═════════
   create(figure, SPEC, { lang }) → { setLang, setRates, select, destroy }
   SPEC: lanes[] (Spalten), nodes[] (lane, row, label, sub, icon, hue, info),
         edges[] (from, to, kind topic|service|action|stream, label, hz, ports 'rl'…, route 'ortho', via Zeile des Rückwegs),
         scenarios[] (id, label, icon, hue, text, steps[{ edge 'a>b' | 'b>a' bei service/action, note, also[] }]) */
const FlowGraph = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
    if (parent) parent.append(e);
    return e;
  };
  const ease = k => (k < .5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
  const NRM = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };
  const TRANS = { l: 't', r: 'b', t: 'l', b: 'r' };  // Ports im schmalen Layout (Lanes untereinander) drehen
  const ortho = (p, sa, q, sb, mid) => {  // rechtwinklige Führung durch die Lücke zwischen Zeilen/Spalten, Ecken r ≤ 10
    const v = s => s === 't' || s === 'b';
    let pts = [p];
    if (v(sa) && v(sb)) { const m = mid ?? (p[1] + q[1]) / 2; pts.push([p[0], m], [q[0], m]); }
    else if (!v(sa) && !v(sb)) { const m = mid ?? (p[0] + q[0]) / 2; pts.push([m, p[1]], [m, q[1]]); }
    else pts.push(v(sa) ? [p[0], q[1]] : [q[0], p[1]]);
    pts.push(q);
    pts = pts.filter((a, i) => !i || Math.hypot(a[0] - pts[i - 1][0], a[1] - pts[i - 1][1]) > .5);
    let d = `M${pts[0]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const la = Math.hypot(b[0] - a[0], b[1] - a[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]), r = Math.min(10, la / 2, lc / 2);
      d += ` L${b[0] + (a[0] - b[0]) * r / la},${b[1] + (a[1] - b[1]) * r / la} Q${b} ${b[0] + (c[0] - b[0]) * r / lc},${b[1] + (c[1] - b[1]) * r / lc}`;
    }
    return `${d} L${pts.at(-1)}`;
  };
  const fit = (t, max) => { while (t.getComputedTextLength() > max && t.textContent.length > 4) t.textContent = `${t.textContent.slice(0, -2)}…`; };
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');

  function create(fig, spec, opt = {}) {
    const o = { lang: 'de', nodeW: 176, nodeH: 56, rowGap: 34, hopMs: 750, dwellMs: 420, loopMs: 1400, pxPerSec: 170, ...opt };
    const L = v => (Array.isArray(v) ? v[o.lang === 'en' ? 1 : 0] : v ?? '');
    const $ = s => fig.querySelector(s);
    const svg = $('.fg-svg'), status = $('.fg-status');
    const nodes = new Map(spec.nodes.map(n => [n.id, { ...n }]));
    const edges = new Map(spec.edges.map(e => [`${e.from}>${e.to}`, { kind: 'topic', ...e, key: `${e.from}>${e.to}` }]));
    const scns = spec.scenarios || [];
    const laneIx = new Map(spec.lanes.map((l, i) => [l.id, i]));
    const st = { scn: scns.length ? 0 : -1, step: -1, play: !reduceMQ.matches, speed: 1, pin: null, hover: null, visible: false, run: 0, live: false };
    const flights = new Set();
    let geo = null, raf = 0, liveT = 0;

    // Spec prüfen: Tippfehler fallen sofort in der Konsole auf statt als stumm fehlende Kante
    for (const e of edges.values()) if (!nodes.has(e.from) || !nodes.has(e.to)) console.warn('[flow-graph] Kante mit unbekanntem Knoten:', e.key);
    for (const n of nodes.values()) if (!laneIx.has(n.lane)) console.warn('[flow-graph] Knoten ohne Lane:', n.id);
    const hop = key => {  // 'a>b' oder Rückweg 'b>a' einer service/action-Kante
      if (edges.has(key)) return { e: edges.get(key), rev: false };
      const [a, b] = key.split('>'), e = edges.get(`${b}>${a}`);
      if (e && e.kind !== 'topic' && e.kind !== 'stream') return { e, rev: true };
      console.warn('[flow-graph] Schritt ohne Kante:', key); return null;
    };
    scns.forEach(s => s.steps.forEach(x => hop(x.edge)));

    // ── Layout: Lanes = Spalten (breit) bzw. Bänder untereinander (schmal), Koordinaten = echte Pixel ──
    function layout(W) {
      const nL = spec.lanes.length, rows = Math.max(...spec.nodes.map(n => n.row + 1), ...spec.edges.map(e => (e.via ?? -1) + 1));  // Atlas: via-Zeilen zählen mit
      const vert = W < Math.max(640, nL * 150);
      const g = { W, vert, pos: new Map() };
      if (!vert) {
        const laneW = W / nL, nw = Math.min(o.nodeW, laneW - 24), nh = o.nodeH, top = 34, rowH = nh + o.rowGap;
        Object.assign(g, { nw, nh, H: top + rows * rowH - o.rowGap + 46, laneW, top });
        for (const n of nodes.values()) g.pos.set(n.id, [laneW * (laneIx.get(n.lane) + .5), top + n.row * rowH + nh / 2]);
      } else {
        const colW = (W - 8) / rows, nw = Math.min(o.nodeW, colW - 10), nh = 44, bandH = nh + 66;
        Object.assign(g, { nw, nh, H: nL * bandH + 4, colW, bandH });
        for (const n of nodes.values()) g.pos.set(n.id, [4 + colW * (n.row + .5), laneIx.get(n.lane) * bandH + 30 + nh / 2]);
      }
      // Ports: Seite je Kante wählen, Enden je Seite nach Lage der Gegenseite sortiert verteilen → keine übereinanderliegenden Pfeile
      const ends = new Map();
      for (const e of edges.values()) {
        const [ax, ay] = g.pos.get(e.from), [bx, by] = g.pos.get(e.to);
        let sa, sb;
        if (e.ports) [sa, sb] = vert ? [...e.ports].map(c => TRANS[c]) : [...e.ports];
        else if (!vert) [sa, sb] = Math.abs(ax - bx) > 1 ? (bx > ax ? 'rl' : 'lr') : (by > ay ? 'bt' : 'tb');
        else [sa, sb] = Math.abs(ay - by) > 1 ? (by > ay ? 'bt' : 'tb') : (bx > ax ? 'rl' : 'lr');
        e.sides = [sa, sb];
        for (const [id, side, other] of [[e.from, sa, e.to], [e.to, sb, e.from]]) {
          const k = `${id}:${side}`; if (!ends.has(k)) ends.set(k, []);
          ends.get(k).push({ e, other, self: id === e.from && side === sa ? 0 : 1 });
        }
      }
      for (const [k, list] of ends) {
        const horiz = /[lr]$/.test(k), span = (horiz ? g.nh : g.nw) - 16;
        list.sort((p, q) => { const a = g.pos.get(p.other), b = g.pos.get(q.other); return horiz ? a[1] - b[1] : a[0] - b[0]; });
        const gap = Math.min(12, span / Math.max(1, list.length));
        list.forEach((x, i) => { (x.e.off ||= [0, 0])[x.self] = (i - (list.length - 1) / 2) * gap; });
      }
      const anchor = (id, side, off) => {
        const [x, y] = g.pos.get(id), hw = g.nw / 2, hh = g.nh / 2;
        return { l: [x - hw, y + off], r: [x + hw, y + off], t: [x + off, y - hh], b: [x + off, y + hh] }[side];
      };
      for (const e of edges.values()) {
        const [sa, sb] = e.sides, p = anchor(e.from, sa, e.off[0]), q = anchor(e.to, sb, e.off[1]);
        if (e.route === 'ortho') { e.d = ortho(p, sa, q, sb, e.via == null ? null : vert ? 4 + g.colW * (e.via + .5) : g.top + e.via * (g.nh + o.rowGap) + g.nh / 2); continue; }
        const same = sa === sb, dist = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const d = same ? Math.min(70, 28 + dist / 6) : Math.max(28, dist / 2.4);
        const c1 = [p[0] + NRM[sa][0] * d, p[1] + NRM[sa][1] * d], c2 = [q[0] + NRM[sb][0] * d, q[1] + NRM[sb][1] * d];
        e.d = `M${p} C${c1} ${c2} ${q}`;
      }
      return g;
    }

    // ── Zeichnen (einmal je Layout; Zustände nur per Klasse) ──
    const svgNode = new Map(), svgEdge = new Map();
    let gBadges, gChips, gPkts;
    function draw() {
      const W = Math.round(svg.parentElement.clientWidth - 20);
      if (W < 200 || (geo && geo.W === W)) return;
      geo = layout(W);
      svg.replaceChildren(); svgNode.clear(); svgEdge.clear();
      svg.setAttribute('viewBox', `0 0 ${geo.W} ${geo.H}`);
      const defs = el('defs', {}, svg);
      for (const [id, cls] of [['fg-arr', ''], ['fg-arr-on', 'on']]) {
        el('path', { d: 'M0 0L10 5L0 10z' }, el('marker', { id: `${fig.id}-${id}`, class: cls, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs));
      }
      const gl = el('g', {}, svg);
      spec.lanes.forEach((ln, i) => {
        if (!geo.vert) {
          if (i) el('line', { class: 'lane-line', x1: geo.laneW * i, x2: geo.laneW * i, y1: 4, y2: geo.H - 30 }, gl);
          el('text', { class: 'lane', x: geo.laneW * (i + .5), y: geo.H - 10, 'text-anchor': 'middle', 'data-lane': i }, gl);
        } else {
          if (i) el('line', { class: 'lane-line', x1: 0, x2: geo.W, y1: geo.bandH * i, y2: geo.bandH * i }, gl);
          el('text', { class: 'lane', x: 6, y: geo.bandH * i + 16, 'data-lane': i }, gl);
        }
      });
      const ge = el('g', {}, svg);
      for (const e of edges.values()) {
        const p = el('path', { class: `edge k-${e.kind}`, d: e.d }, ge);
        const hit = el('path', { class: 'edge-hit', d: e.d }, ge);
        hit.addEventListener('pointerenter', () => { st.hover = { edge: e.key }; paint(); });
        hit.addEventListener('pointerleave', () => { st.hover = null; paint(); });
        const len = p.getTotalLength(), n = Math.max(8, Math.ceil(len / 6)), lut = [];
        for (let i = 0; i <= n; i++) { const pt = p.getPointAtLength((i / n) * len); lut.push([pt.x, pt.y]); }
        svgEdge.set(e.key, { p, len, lut });
      }
      const gn = el('g', {}, svg);
      for (const n of nodes.values()) {
        const [x, y] = geo.pos.get(n.id), { nw, nh } = geo, small = nw < 120;
        const g = el('g', { class: 'node', transform: `translate(${x - nw / 2} ${y - nh / 2})`, style: `--c: var(--${n.hue || 'accent'})`, tabindex: 0, role: 'button' }, gn);
        el('rect', { width: nw, height: nh, rx: 2 }, g);
        if (!small) el('use', { href: `#${n.icon}`, x: 10, y: nh / 2 - 11, width: 22, height: 22 }, g);
        const tx = small ? nw / 2 : 40, anchor = small ? 'middle' : 'start';
        el('text', { class: 't', x: tx, y: geo.vert ? nh / 2 + 5 : nh / 2 - 3, 'text-anchor': anchor }, g);
        if (!geo.vert) el('text', { class: 's', x: tx, y: nh / 2 + 13, 'text-anchor': anchor }, g);
        g.addEventListener('pointerenter', () => { st.hover = { node: n.id }; paint(); });
        g.addEventListener('pointerleave', () => { st.hover = null; paint(); });
        g.addEventListener('focus', () => { st.hover = { node: n.id }; paint(); });
        g.addEventListener('blur', () => { st.hover = null; paint(); });
        g.addEventListener('click', () => { st.pin = st.pin === n.id ? null : n.id; paint(); });
        g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); g.dispatchEvent(new Event('click')); } });
        svgNode.set(n.id, g);
      }
      gBadges = el('g', {}, svg); gChips = el('g', {}, svg); gPkts = el('g', {}, svg);
      texts(); paint();
    }

    const at = (key, k, rev) => {  // Punkt auf Kante bei Anteil k (0…1), über vorab abgetastete Tabelle statt getPointAtLength je Frame
      const { lut } = svgEdge.get(key), f = Math.max(0, Math.min(1, rev ? 1 - k : k)) * (lut.length - 1), i = Math.min(lut.length - 2, Math.floor(f)), r = f - i;
      return [lut[i][0] + (lut[i + 1][0] - lut[i][0]) * r, lut[i][1] + (lut[i + 1][1] - lut[i][1]) * r];
    };
    const chip = (key, text, cls) => {  // Etikett an die erste Stelle der Kante, an der es keinen Knoten verdeckt
      const g = el('g', { class: `chip ${cls || ''}` }, gChips), r = el('rect', { height: 22, rx: 2 }, g), t = el('text', {}, g);
      t.textContent = text;
      const w = t.getComputedTextLength() + 16, { nw, nh } = geo;
      const free = (x0, y0) => [...geo.pos.values()].every(([cx, cy]) => x0 > cx + nw / 2 + 2 || x0 + w < cx - nw / 2 - 2 || y0 > cy + nh / 2 + 2 || y0 + 22 < cy - nh / 2 - 2);
      let best = null;
      for (const k of [.5, .4, .6, .3, .7, .2, .8]) {
        const [x, y] = at(key, k), x0 = Math.max(2, Math.min(geo.W - w - 2, x - w / 2));
        for (const y0 of [y - 11, y - 38, y + 16, y - 55, y + 33]) if (free(x0, y0)) { best = [x0, y0]; break; }
        if (best) break;
      }
      if (!best) { const [x, y] = at(key, .5); best = [Math.max(2, Math.min(geo.W - w - 2, x - w / 2)), y - 11]; }
      r.setAttribute('x', best[0]); r.setAttribute('y', best[1]); r.setAttribute('width', w);
      t.setAttribute('x', best[0] + 8); t.setAttribute('y', best[1] + 11);
    };
    const edgeText = e => `${L(e.label)}${e.hz === 0 ? ` · ⚠ 0 Hz` : e.hz != null ? ` · ${e.hz} Hz` : ''}`;

    // ── Zustand → Klassen, Badges, Chips, Detailtext (ein Ort für alle Zustandswechsel) ──
    function paint() {
      if (!geo) return;
      const s = scns[st.scn], focus = st.hover?.node || st.pin;
      const hl = new Set(), on = new Set(), nowE = new Set(), nowN = new Set();
      svg.style.setProperty('--pc', s && !st.live ? `var(--${s.hue || 'accent'})` : 'var(--accent)');
      if (s && !st.live) s.steps.forEach((x, i) => {
        const h = hop(x.edge); if (!h) return;
        on.add(h.e.key); hl.add(h.e.key); hl.add(h.e.from); hl.add(h.e.to);
        (x.also || []).forEach(k => { on.add(k); hl.add(k); hl.add(k.split('>')[1]); });
        if (i === st.step) { nowE.add(h.e.key); nowN.add(h.rev ? h.e.from : h.e.to); }
      });
      if (s && !st.live && st.step < 0 && s.steps[0]) { const h = hop(s.steps[0].edge); if (h) nowN.add(h.rev ? h.e.to : h.e.from); }
      let dim = !!(s && !st.live);
      if (focus) {  // Nachbarschaft des Knotens überschreibt Szenario-Hervorhebung
        hl.clear(); hl.add(focus); dim = true;
        for (const e of edges.values()) if (e.from === focus || e.to === focus) { hl.add(e.key); hl.add(e.from); hl.add(e.to); }
      } else if (st.hover?.edge) { const e = edges.get(st.hover.edge); hl.clear(); [e.key, e.from, e.to].forEach(x => hl.add(x)); dim = true; }
      svg.classList.toggle('dim', dim);
      for (const [id, g] of svgNode) {
        g.classList.toggle('hl', hl.has(id)); g.classList.toggle('on', hl.has(id) && dim);
        g.classList.toggle('now', nowN.has(id)); g.classList.toggle('pin', st.pin === id);
      }
      for (const [k, { p }] of svgEdge) {
        const lit = on.has(k) || (focus && hl.has(k)) || st.hover?.edge === k;
        p.classList.toggle('hl', hl.has(k)); p.classList.toggle('on', lit); p.classList.toggle('now', nowE.has(k));
        p.classList.toggle('stale', edges.get(k).hz === 0);
        const both = edges.get(k).kind === 'service' || edges.get(k).kind === 'action';
        const m = `url(#${fig.id}-${lit ? 'fg-arr-on' : 'fg-arr'})`;
        p.setAttribute('marker-end', m); if (both) p.setAttribute('marker-start', m); else p.removeAttribute('marker-start');
      }
      // Schritt-Nummern auf den Kanten (auch Standbild bei reduced motion); aktuelle Kante bekommt den Chip mit Topic
      gBadges.replaceChildren(); gChips.replaceChildren();
      const quiet = focus || st.hover?.edge;  // beim Erkunden nur das, worauf der Zeiger steht
      if (s && !st.live && !quiet) {  // eine Marke je Kante, mehrfach genutzte Kante zeigt alle Nummern („2,3,5“)
        const nums = new Map(), cur = st.step >= 0 && hop(s.steps[st.step].edge)?.e.key;
        s.steps.forEach((x, i) => { const h = hop(x.edge); if (h) nums.set(h.e.key, [...(nums.get(h.e.key) || []), i + 1]); });
        for (const [k, list] of nums) {
          if (k === cur) continue;
          const [bx, by] = at(k, .5), b = el('g', { class: 'badge hl' }, gBadges), t = el('text', { x: bx, y: by }, b);
          t.textContent = list.join(',');
          const w = Math.max(20, t.getComputedTextLength() + 10);
          b.prepend(el('rect', { x: bx - w / 2, y: by - 10, width: w, height: 20, rx: 2 }));
        }
      }
      if (s && !st.live && !quiet && st.step >= 0) { const h = hop(s.steps[st.step].edge); if (h) chip(h.e.key, `${st.step + 1} · ${L(s.steps[st.step].topic) || edgeText(h.e)}`, 'now'); }
      // Knoten-Fokus: Topics stehen im Detailfeld (Ein-/Ausgänge), nicht als Etiketten-Wolke im Bild
      if (st.hover?.edge) chip(st.hover.edge, edgeText(edges.get(st.hover.edge)));
      else if (st.live && !focus) for (const e of edges.values()) if (e.hz === 0) chip(e.key, edgeText(e));  // nur Abweichung beschriften
      detail(focus);
      $$('.fg-steps li').forEach((li, i) => li.classList.toggle('now', i === st.step));
      $$('.fg-scn button').forEach((b, i) => b.setAttribute('aria-pressed', String(st.live ? b.dataset.live === '1' : i === st.scn && !b.dataset.live)));
      const pb = $('[data-act="play"]');
      pb.querySelector('use').setAttribute('href', st.play ? '#i-pause' : '#i-fg-play');
      pb.setAttribute('aria-label', st.play ? L(['Pause', 'Pause']) : L(['Abspielen', 'Play']));
      for (const a of ['prev', 'next', 'play']) $(`[data-act="${a}"]`).disabled = st.live || !s;
    }
    const $$ = s => [...fig.querySelectorAll(s)];

    function detail(focus) {
      const h3 = $('.fg-detail h3'), p = $('.fg-detail p'), io = $('.fg-detail .io');
      if (focus) {
        const n = nodes.get(focus), ins = [], outs = [];
        for (const e of edges.values()) {
          if (e.to === focus) ins.push(`<code>${L(e.label)}</code> ← ${L(nodes.get(e.from).label)}`);
          if (e.from === focus) outs.push(`<code>${L(e.label)}</code> → ${L(nodes.get(e.to).label)}`);
        }
        h3.textContent = L(n.label); p.textContent = L(n.info) || L(n.sub);
        io.innerHTML = (ins.length ? `<div><b>${L(['Eingänge', 'Inputs'])}</b><br>${ins.join('<br>')}</div>` : '')
          + (outs.length ? `<div><b>${L(['Ausgänge', 'Outputs'])}</b><br>${outs.join('<br>')}</div>` : '');
        return;
      }
      io.innerHTML = '';
      if (st.live) { h3.textContent = L(['Alle Ströme', 'All streams']); p.textContent = L(['Jede Kante zeigt ihre Rate. Pakete laufen umso dichter, je höher die Frequenz.', 'Each edge shows its rate. Packets run denser the higher the frequency.']); return; }
      const s = scns[st.scn]; if (!s) return;
      h3.textContent = L(s.label); p.textContent = L(s.text);
    }

    function texts() {
      svg.querySelectorAll('[data-lane]').forEach(t => { t.textContent = L(spec.lanes[+t.dataset.lane].label); });
      for (const [id, g] of svgNode) {
        const n = nodes.get(id), t = g.querySelector('.t'), sub = g.querySelector('.s');
        const avail = geo.nw - (geo.vert || geo.nw < 120 ? 10 : 48);
        t.textContent = L(geo.vert || geo.nw < 120 ? n.short || n.label : n.label); fit(t, avail);
        if (sub) { sub.textContent = L(n.sub); fit(sub, avail); }
        const ins = [...edges.values()].filter(e => e.to === id).length, outs = [...edges.values()].filter(e => e.from === id).length;
        g.setAttribute('aria-label', `${L(n.label)}, ${L(n.sub)} – ${ins} ${L(['Eingänge', 'inputs'])}, ${outs} ${L(['Ausgänge', 'outputs'])}`);
      }
      $('.fg-scn').innerHTML = scns.map((s, i) => `<button type="button" data-i="${i}" style="--c: var(--${s.hue || 'accent'})"><svg><use href="#${s.icon}"/></svg>${L(s.label)}</button>`).join('')
        + (spec.edges.some(e => e.hz != null) ? `<button type="button" data-live="1"><svg><use href="#i-pulse"/></svg>${L(['Alle Ströme', 'All streams'])}</button>` : '');
      $$('.fg-scn button').forEach(b => b.addEventListener('click', () => b.dataset.live ? setLive() : select(+b.dataset.i)));
      const s = scns[st.scn];
      $('.fg-steps').innerHTML = !s || st.live ? '' : s.steps.map((x, i) => {
        const h = hop(x.edge), n = h ? nodes.get(h.rev ? h.e.from : h.e.to) : null;
        return `<li data-i="${i}"><span class="n">${i + 1}</span><span class="w"><b>${n ? L(n.label) : '?'}</b><code>${L(x.topic) || (h ? L(h.e.label) : '')}</code></span><span class="note">${L(x.note)}</span></li>`;
      }).join('');
      $$('.fg-steps li').forEach(li => li.addEventListener('click', () => { st.play = false; stepTo(+li.dataset.i); }));
      const lg = [['topic', [0, 0], ['Topic', 'Topic']], ['service', [6, 4], ['Service (Anfrage ⇄ Antwort)', 'Service (request ⇄ response)']],
        ['action', [14, 4, 2, 4], ['Action (Ziel, Feedback, Ergebnis)', 'Action (goal, feedback, result)']], ['stream', [0, 0], ['Datenstrom (Bild, Punktwolke)', 'Stream (image, point cloud)']]]
        .filter(([k]) => spec.edges.some(e => (e.kind || 'topic') === k));
      $('.fg-legend').innerHTML = lg.map(([k, dash, t]) => `<span><svg viewBox="0 0 34 10"><line x1="0" y1="5" x2="34" y2="5" stroke-dasharray="${dash.join(' ')}" style="${k === 'stream' ? 'stroke-width:3.4' : ''}"/></svg>${L(t)}</span>`).join('');
    }

    // ── Animation: eine rAF-Schleife für alle Pakete, läuft nur bei sichtbarer Figur ──
    const fly = (key, rev, ms, run, hue) => new Promise(res => {
      const [x, y] = at(key, 0, rev), g = el('g', { class: 'pkt', style: hue ? `--pc: var(--${hue})` : null, transform: `translate(${x} ${y})` }, gPkts);
      el('circle', { class: 'halo', r: 10 }, g); el('circle', { r: 5 }, g);
      flights.add({ key, rev, ms, t0: performance.now(), g, run, res }); kick();
    });
    const tick = now => {
      raf = 0;
      for (const f of flights) {
        if (f.run !== st.run) { f.g.remove(); flights.delete(f); f.res(false); continue; }
        const k = Math.max(0, Math.min(1, (now - f.t0) / f.ms)), [x, y] = at(f.key, f.live ? k : ease(k), f.rev);
        f.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        if (k >= 1) { f.g.remove(); flights.delete(f); f.res(true); }
      }
      if (st.live && st.visible && now - liveT > 50) { liveT = now; spawnLive(now); }
      if (flights.size || (st.live && st.visible)) kick();
    };
    const kick = () => { if (!raf && st.visible && !document.hidden) raf = requestAnimationFrame(tick); };
    const wait = (ms, run) => new Promise(r => setTimeout(() => r(run === st.run), ms / st.speed));

    async function loop() {
      const run = ++st.run, s = scns[st.scn];
      if (!st.play || st.live || !s || !st.visible) return;
      while (run === st.run) {
        for (let i = st.step + 1; i < s.steps.length; i++) {
          const h = hop(s.steps[i].edge); if (!h) continue;
          (s.steps[i].also || []).forEach(k => { if (svgEdge.has(k) && !reduceMQ.matches) fly(k, false, o.hopMs / st.speed, run); });
          if (!reduceMQ.matches && !await fly(h.e.key, h.rev, o.hopMs / st.speed, run)) return;
          if (reduceMQ.matches && !await wait(1200, run)) return;
          st.step = i; paint(); announce();
          if (!await wait(o.dwellMs, run)) return;
        }
        if (!await wait(o.loopMs, run)) return;
        st.step = -1; paint();
        if (!await wait(500, run)) return;
      }
    }
    // Live: Pakete je Kante mit Abstand nach Rate (log-skaliert, 0,4…3 Pakete/s), gleiche Geschwindigkeit überall
    const nextAt = new Map();
    function spawnLive(now) {
      if (reduceMQ.matches) return;
      for (const e of edges.values()) {
        if (!e.hz) continue;
        const per = 1000 / Math.max(.4, Math.min(3, Math.log2(e.hz + 1) * .6));
        if ((nextAt.get(e.key) || 0) > now) continue;
        nextAt.set(e.key, now + per);
        const f = { key: e.key, rev: false, ms: (svgEdge.get(e.key).len / o.pxPerSec) * 1000, t0: now, run: st.run, live: true, res() {} };
        const [x, y] = at(e.key, 0);
        f.g = el('g', { class: 'pkt', style: `--pc: var(--${nodes.get(e.from).hue || 'accent'})`, transform: `translate(${x} ${y})` }, gPkts);
        el('circle', { r: e.kind === 'stream' ? 4.5 : 3.5 }, f.g);
        flights.add(f);
      }
    }

    const announce = () => {
      const s = scns[st.scn], x = s?.steps[st.step]; if (!x) { status.textContent = ''; return; }
      const h = hop(x.edge), n = h && nodes.get(h.rev ? h.e.from : h.e.to);
      status.textContent = `${L(['Schritt', 'Step'])} ${st.step + 1}/${s.steps.length}: ${n ? L(n.label) : ''} – ${L(x.note)}`;
    };
    function stepTo(i) {
      const s = scns[st.scn]; if (!s) return;
      st.run++; st.step = Math.max(-1, Math.min(s.steps.length - 1, i)); paint(); announce();
      if (st.play) loop();
    }
    function select(i) { st.live = false; st.scn = i; st.step = -1; st.pin = null; texts(); paint(); status.textContent = ''; loop(); }
    function setLive() { st.live = true; st.run++; st.pin = null; status.textContent = ''; texts(); paint(); kick(); }

    // ── Bedienung: Knöpfe, Tastatur (←/→ Schritt, Leertaste Play, Esc Auswahl lösen) ──
    $('[data-act="play"]').addEventListener('click', () => { st.play = !st.play; if (st.play) { if (st.step >= scns[st.scn].steps.length - 1) st.step = -1; loop(); } else st.run++; paint(); });
    $('[data-act="prev"]').addEventListener('click', () => { st.play = false; stepTo(st.step - 1); });
    $('[data-act="next"]').addEventListener('click', () => { st.play = false; stepTo(st.step + 1); });
    $('[data-act="speed"]').addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      st.speed = +b.dataset.v; b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    });
    fig.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowRight') { st.play = false; stepTo(st.step + 1); ev.preventDefault(); }
      else if (ev.key === 'ArrowLeft') { st.play = false; stepTo(st.step - 1); ev.preventDefault(); }
      else if (ev.key === 'Escape') { st.pin = null; paint(); }
      else if ((ev.key === 'k' || ev.key === 'K')) $('[data-act="play"]').click();
    });
    if (reduceMQ.matches) $('[data-act="speed"]').hidden = true;

    // ── Sichtbarkeit + Größe: außerhalb des Viewports / im Hintergrund-Tab läuft nichts ──
    const io = new IntersectionObserver(([en]) => {
      st.visible = en.isIntersecting;
      if (st.visible) { st.live ? kick() : loop(); } else st.run++;
    }, { threshold: .2 });
    io.observe(svg);
    const onVis = () => { if (document.hidden) st.run++; else if (st.visible) { st.live ? kick() : loop(); } };
    document.addEventListener('visibilitychange', onVis);
    let rz = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rz);
      rz = requestAnimationFrame(() => {
        if (geo && geo.W === Math.round(svg.parentElement.clientWidth - 20)) return;
        st.run++; flights.forEach(f => { f.g.remove(); f.res(false); }); flights.clear();
        draw(); if (st.visible) { st.live ? kick() : loop(); }
      });
    });
    ro.observe(svg.parentElement);
    fig.classList.add('fg-ready');
    draw();
    document.fonts?.ready.then(() => { if (geo) { texts(); paint(); } });  // Textbreiten erst mit geladener Schrift kürzen

    return {
      setLang(l) { o.lang = l; if (geo) { texts(); paint(); announce(); } },
      setRates(rates) { for (const [k, hz] of Object.entries(rates)) if (edges.has(k)) edges.get(k).hz = hz; paint(); },
      select,
      destroy() { st.run++; io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); cancelAnimationFrame(raf); },
    };
  }
  return { create };
})();


/* ═════════ Kreislauf-Ring (K1): Stationen auf einer Ellipse, Nachricht läuft um, Wiederhol-Pfeil innen ═════════
   ring(host, loop, { lang, hue }) → { destroy }; loop = { t, s, st: [[Titel, Untertitel], …], back: { from, to, t } } */
const Ring = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); if (parent) parent.append(e); return e; };
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const fit = (t, max) => { while (t.getComputedTextLength() > max && t.textContent.length > 4) t.textContent = `${t.textContent.slice(0, -2)}…`; };

  function create(host, loop, opt) {
    const L = v => (Array.isArray(v) ? v[opt.lang === 'en' ? 1 : 0] : v ?? '');
    const svg = el('svg', { class: 'ring', role: 'img' }, host);
    svg.style.setProperty('--c', `var(--${opt.hue || 'accent'})`);
    const n = loop.st.length, st = { visible: false, raf: 0, t0: 0, cur: -1 };
    let geo = null;

    function draw() {
      const W = Math.max(280, Math.min(420, Math.round(host.clientWidth || 380)));
      if (geo && geo.W === W) return;
      const rw = W < 340 ? 112 : 140, rh = 44, H = 360;
      const rx = Math.min(150, W / 2 - rw / 2 - 6), ry = 130, cx = W / 2, cy = H / 2;
      const off = n % 4 === 0 ? Math.PI / n : 0;  // 4 oder 8 Stationen: diagonal, damit die Mitte frei bleibt
      const ang = k => 2 * Math.PI * k / n + off;
      const pos = k => [cx + rx * Math.sin(ang(k)), cy - ry * Math.cos(ang(k))];
      geo = { W, H, cx, cy, rx, ry, pos, ang };
      svg.replaceChildren();
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const id = host.id || 'ring';
      const defs = el('defs', {}, svg);
      for (const [m, cls] of [['a', 'mk-a'], ['b', 'mk-b']]) el('path', { d: 'M0 0L10 5L0 10z' }, el('marker', { id: `${id}-m${m}`, class: cls, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs));
      // Bögen zwischen den Stationen: Start/Ende außerhalb der Rechtecke (Winkel schrittweise suchen)
      const inside = ([x, y], k) => { const [px, py] = pos(k); return Math.abs(x - px) < rw / 2 + 6 && Math.abs(y - py) < rh / 2 + 6; };
      const pt = a => [cx + rx * Math.sin(a), cy - ry * Math.cos(a)];
      for (let k = 0; k < n; k++) {
        let a0 = ang(k), a1 = ang(k + 1);
        while (inside(pt(a0), k) && a0 < a1) a0 += .01;
        while (inside(pt(a1), (k + 1) % n) && a1 > a0) a1 -= .01;
        if (a1 - a0 < .05) continue;
        const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
        el('path', { class: 'arc', d: `M${x0.toFixed(1)} ${y0.toFixed(1)}A${rx} ${ry} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`, 'marker-end': `url(#${id}-ma)` }, svg);
      }
      // Wiederhol-Pfeil innen (gestrichelt): liegt die Sehne nahe der Mitte, seitlich ausbiegen; Etikett mehrzeilig am Scheitel
      const lines = (t, x, y, maxW) => {
        const txt = el('text', { class: 'lbl', x, 'text-anchor': 'middle' }, svg), probe = el('tspan', {}, txt), out = [];
        let cur = '';
        for (const w of t.split(' ')) { probe.textContent = cur ? `${cur} ${w}` : w; if (probe.getComputedTextLength() > maxW && cur) { out.push(cur); cur = w; } else cur = probe.textContent; }
        out.push(cur); probe.remove();
        out.forEach((ln, i) => { el('tspan', { x, dy: i ? 13 : 0 }, txt).textContent = ln; });
        txt.setAttribute('y', (y - (out.length - 1) * 6.5 + 4).toFixed(1));
      };
      if (loop.back) {
        const [ax, ay] = pos(loop.back.from), [bx, by] = pos(loop.back.to);
        const toC = (x, y) => { const dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
        const [ux, uy] = toC(ax, ay), [vx, vy] = toC(bx, by), g = rh / 2 + 10;
        const p = [ax + ux * g, ay + uy * g], q = [bx + vx * g, by + vy * g], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        let c;
        const da = Math.abs(ang(loop.back.from) - ang(loop.back.to)) % (2 * Math.PI);
        if (Math.min(da, 2 * Math.PI - da) > 2.6) {  // gegenüberliegende Stationen: seitlich statt durch die Mitte
          const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1;
          c = [m[0] - dy / d * .6 * rx, m[1] + dx / d * .6 * rx];
        } else c = [m[0] + (cx - m[0]) * .55, m[1] + (cy - m[1]) * .55];
        el('path', { class: 'back', d: `M${p} Q${c} ${q}`, 'marker-end': `url(#${id}-mb)` }, svg);
        // Etikett in der Mitte, auf der Seite gegenüber dem Scheitel des Pfeils
        const ax2 = (p[0] + 2 * c[0] + q[0]) / 4 - cx, ay2 = (p[1] + 2 * c[1] + q[1]) / 4 - cy;
        if (Math.abs(ay2) >= Math.abs(ax2)) lines(L(loop.back.t), cx, cy - Math.sign(ay2 || 1) * 30, Math.min(150, 1.15 * rx));
        else lines(L(loop.back.t), cx - Math.sign(ax2) * .35 * rx, cy, .8 * rx);
      } else {  // ohne Wiederhol-Pfeil: Titel in der Mitte
        const ct = el('text', { class: 'ctr', x: cx, y: cy - 4, 'text-anchor': 'middle' }, svg); ct.textContent = L(loop.t); fit(ct, 2 * rx - rw * .55);
        const cs = el('text', { class: 'ctr-s', x: cx, y: cy + 13, 'text-anchor': 'middle' }, svg); cs.textContent = L(loop.s); fit(cs, 2 * rx - rw * .55);
      }
      geo.st = loop.st.map(([t, s, plan], k) => {
        const [x, y] = pos(k), g = el('g', { class: plan ? 'st plan' : 'st', transform: `translate(${(x - rw / 2).toFixed(1)} ${(y - rh / 2).toFixed(1)})` }, svg);
        el('rect', { width: rw, height: rh, rx: 2 }, g);
        const a = el('text', { class: 't', x: rw / 2, y: 18, 'text-anchor': 'middle' }, g); a.textContent = L(t); fit(a, rw - 10);
        const b = el('text', { class: 's', x: rw / 2, y: 34, 'text-anchor': 'middle' }, g); b.textContent = L(s); fit(b, rw - 10);
        return g;
      });
      geo.pk = el('g', { class: 'pkt' }, svg);
      el('circle', { class: 'pk-h', r: 10 }, geo.pk); el('circle', { class: 'pk', r: 5 }, geo.pk);
      geo.pk.style.display = reduceMQ.matches ? 'none' : '';
      svg.setAttribute('aria-label', `${L(['Kreislauf', 'Loop'])} ${L(loop.t)}: ${loop.st.map(s => L(s[0])).join(' → ')} → ${L(loop.st[0][0])}`
        + (loop.back ? `; ${L(loop.back.t)}` : ''));
      place(performance.now());
    }
    // Paket auf der Ellipse; Station leuchtet, solange das Paket auf ihr liegt (1,6 s je Station)
    const per = 1600;
    function place(now) {
      if (!geo) return;
      const f = ((now - st.t0) / (per * n)) % 1, a = f * 2 * Math.PI + geo.ang(0);
      geo.pk.setAttribute('transform', `translate(${(geo.cx + geo.rx * Math.sin(a)).toFixed(1)} ${(geo.cy - geo.ry * Math.cos(a)).toFixed(1)})`);
      const k = Math.round(f * n) % n;
      if (k !== st.cur) { st.cur = k; geo.st.forEach((g, i) => g.classList.toggle('now', i === k)); opt.onStation?.(k); }
    }
    const tick = now => { st.raf = 0; place(now); kick(); };
    const kick = () => { if (!st.raf && st.visible && !document.hidden && !reduceMQ.matches) st.raf = requestAnimationFrame(tick); };
    const io = new IntersectionObserver(([en]) => { st.visible = en.isIntersecting; kick(); }, { threshold: .2 });
    io.observe(svg);
    const onVis = () => kick();
    document.addEventListener('visibilitychange', onVis);
    const ro = new ResizeObserver(() => draw());
    ro.observe(host);
    st.t0 = performance.now();
    draw();
    return { destroy() { cancelAnimationFrame(st.raf); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); svg.remove(); } };
  }
  return { create };
})();

/* ═════════ Abläufe: je Ablauf Titel, Text, Farbe, optional Kreislauf (Ring) und SPEC für die Flow-Engine ═════════
   Topics/Services aus dem Code belegt (grep), nie erfunden; geplante Teile als „geplant“ gekennzeichnet. */
const FLOWS = (() => {
  // Gemeinsame Bausteine: Spalten, Knoten, Kanten (Rückweg R = eigene Zeile unter dem Hauptweg), Schritte
  const LANE = {
    in: ['Eingabe', 'Input'], br: ['Brücke', 'Bridge'], chk: ['Prüfung', 'Check'], mo: ['Bewegung', 'Motion'], hw: ['Hardware', 'Hardware'],
    cl: ['Client', 'Client'], wd: ['Watchdog', 'Watchdog'], ai: ['KI-Agent', 'AI agent'], ui: ['Browser', 'Browser'], mv: ['MoveIt', 'MoveIt'],
  };
  const lanes = (...l) => l.map(x => (typeof x === 'string' ? { id: x, label: LANE[x] } : { id: x[0], label: x[1] }));
  const NODE = {
    ui: { label: 'UX | Control Interface', short: 'UI', sub: 'Browser · :8081', icon: 'i-win', hue: 'accent', info: ['Weboberfläche mit Digital Twin, Jogging, Greifer, KI-Chat und E-STOP.', 'Web interface with Digital Twin, jogging, gripper, AI chat and E-STOP.'] },
    rb: { label: 'rosbridge', short: 'Bridge', sub: ':9090 · Whitelist', icon: 'i-link', hue: 'teal', info: ['WebSocket-Brücke: lässt nur Topics und Services der Whitelist in config/network.yaml durch.', 'WebSocket bridge: passes only topics and services on the whitelist in config/network.yaml.'] },
    wd: { label: 'Watchdog', short: 'Lock', sub: 'remote_control_watchdog', icon: 'i-lock', hue: 'gold', info: ['Control-Lock: prüft Besitz, Heartbeat, E-STOP und Tempo, bevor ein Befehl weitergeht.', 'Control lock: checks ownership, heartbeat, E-STOP and speed before a command passes.'] },
    pcc: { label: ['Vorprüfung', 'Pre-check'], short: ['Prüf.', 'Check'], sub: 'pre_collision_checker', icon: 'i-shield', hue: 'gold', info: ['Sagt die TCP-Höhe 0,25 s voraus: ab 110 mm gebremst, Stopp bei 91 mm, Pad vibriert.', 'Predicts the TCP height 0.25 s ahead: braked from 110 mm, stop at 91 mm, pad rumbles.'] },
    jts: { label: ['Joystick → Twist', 'Joystick → twist'], short: 'Twist', sub: 'joy_to_servo_node', icon: 'i-pad', hue: 'indigo', info: ['C++-Node: Achsen werden geglättete TCP-Geschwindigkeiten, 5 Tempostufen 0,1–0,5.', 'C++ node: axes become smoothed TCP velocities, 5 speed levels 0.1–0.5.'] },
    srv: { label: 'MoveIt Servo', short: 'Servo', sub: 'servo_server', icon: 'i-pulse', hue: 'indigo', info: ['Rechnet Twist in Gelenkbefehle, hält vor Singularität, Kollision und Gelenkgrenze.', 'Turns twists into joint commands, halts before singularity, collision and joint limit.'] },
    mh: { label: 'Motion Handler', short: 'Motion', sub: 'MoveIt MoveGroup', icon: 'i-gizmo', hue: 'indigo', info: ['robot_motion_handler_movegroup: IK, Planung, Freigabe, Bodensperre und E-STOP-Verriegelung.', 'robot_motion_handler_movegroup: IK, planning, approval, floor guard and E-STOP latch.'] },
    mg: { label: 'move_group', short: 'MoveIt', sub: 'MoveIt 2', icon: 'i-layers', hue: 'indigo', info: ['MoveIt plant kollisionsfreie Bahnen in der Planungsszene und führt sie aus.', 'MoveIt plans collision-free paths in the planning scene and executes them.'] },
    arm: { label: 'xArm Lite 6', short: 'Arm', sub: 'FAKE | REAL', icon: 'i-arm', hue: 'accent', info: ['FAKE: simulierte Controller; REAL: der Arm mit 6 Achsen.', 'FAKE: simulated controllers; REAL: the 6-axis arm.'] },
    vb: { label: ['KI-Agent', 'AI agent'], short: ['KI', 'AI'], sub: 'vla_bridge', icon: 'i-spark', hue: 'violet', info: ['Plant mit dem Sprachmodell, prüft im Code, führt Skills erst nach Freigabe aus.', 'Plans with the language model, checks in code, runs skills only after approval.'] },
    llm: { label: ['Sprachmodell', 'Language model'], short: 'LLM', sub: 'Ollama · Claude · Gemini', icon: 'i-chip', hue: 'violet', info: ['Lokal qwen3.8:27b über Ollama, umschaltbar auf Claude oder Gemini; antwortet mit JSON.', 'Local qwen3.8:27b via Ollama, switchable to Claude or Gemini; answers in JSON.'] },
    gj: { label: ['Greifer-Node', 'Gripper node'], short: ['Greif.', 'Grip'], sub: 'joy_to_servo_node', icon: 'i-grip', hue: 'indigo', info: ['Einziger Besitzer des Greiferzustands; schaltet Sauger oder Finger über den Treiber.', 'Sole owner of the gripper state; switches suction or fingers via the driver.'] },
  };
  const N = (id, lane, row, o = {}) => ({ id, lane, row, ...(NODE[o.of || id] || {}), ...o });
  const E = (from, to, label, o = {}) => ({ from, to, label, ...o });
  const R = (from, to, label, o = {}) => E(from, to, label, { ports: 'bb', route: 'ortho', via: 0.75, ...o });
  const S = (edge, note, o = {}) => ({ edge, note, ...o });
  const SC = (id, label, icon, hue, text, steps) => ({ id, label, icon, hue, text, steps });

  return {
    // ─────────── Steuerwege ───────────
    pad: {
      t: ['Gamepad: vom Stick bis zum Arm', 'Gamepad: from stick to arm'], hue: 'accent', icon: 'i-pad', s: 'spr',
      d: ['Lokal per USB oder aus der Ferne im Browser: Beide Gamepads landen als /joy in derselben Kette aus Kollisionsvorprüfung, joy_to_servo_node und MoveIt Servo. Das Remote-Pad passiert vorher den Watchdog, der nur den Besitzer des Control-Locks mit frischem Heartbeat durchlässt.', 'Local via USB or remote in the browser: both gamepads end up as /joy in the same chain of pre-collision check, joy_to_servo_node and MoveIt Servo. The remote pad first passes the watchdog, which lets through only the control lock owner with a fresh heartbeat.'],
      spec: {
        lanes: lanes('in', 'br', 'chk', 'mo', 'hw'),
        nodes: [N('padr', 'in', 0, { label: ['Remote-Gamepad', 'Remote gamepad'], short: 'Pad', sub: 'Browser · :8443', icon: 'i-pad', hue: 'accent', info: ['Gamepad-API im Browser; sendet /remote/joy mit Client-id alle 50 ms.', 'Gamepad API in the browser; sends /remote/joy with client id every 50 ms.'] }),
          N('padl', 'in', 1.5, { label: ['Gamepad lokal', 'Local gamepad'], short: 'USB', sub: 'joy_node', icon: 'i-pad', hue: 'accent', info: ['Xbox-Pad am Roboter-PC; joy_node publiziert /joy.', 'Xbox pad on the robot PC; joy_node publishes /joy.'] }),
          N('rb', 'br', 0), N('wd', 'chk', 0), N('pcc', 'chk', 1.5), N('jts', 'mo', 1.5), N('srv', 'mo', 0), N('arm', 'hw', 0)],
        edges: [E('padr', 'rb', '/remote/joy'), E('rb', 'wd', '/remote/joy'), E('wd', 'pcc', '/joy'), E('padl', 'pcc', '/joy'), E('pcc', 'jts', '/joy_check'),
          E('jts', 'srv', '/servo_server/delta_twist_cmds'), E('srv', 'arm', '/lite6_traj_controller/joint_trajectory'),
          E('srv', 'pcc', '/servo_server/status', { ports: 'bt', route: 'ortho' }), E('pcc', 'padl', ['Vibration (pygame)', 'Rumble (pygame)'])],
        scenarios: [
          SC('remote', ['Remote', 'Remote'], 'i-globe', 'accent', ['Ein Xbox-Pad am Laptop oder Tablet steuert über rosbridge und Watchdog. Ab dort läuft es wie das lokale Pad, im REAL-Modus mit höchstens 50 % Tempo und eigener Freigabe („Arm“).', 'An Xbox pad on a laptop or tablet controls via rosbridge and the watchdog. From there it runs like the local pad; in REAL mode at 50 % speed at most and with its own approval (“Arm”).'], [
            S('padr>rb', ['Die Gamepad-API im Browser liest Sticks und Tasten und sendet sie alle 50 ms mit Client-id.', 'The browser Gamepad API reads sticks and buttons and sends them with the client id every 50 ms.']),
            S('rb>wd', ['Der Watchdog lässt nur den Besitzer mit frischem Heartbeat durch und skaliert Sticks und Trigger in REAL auf höchstens 50 %.', 'The watchdog passes only the owner with a fresh heartbeat and scales sticks and triggers to 50 % at most in REAL.']),
            S('wd>pcc', ['Erlaubte Befehle gehen als /joy weiter; sonst sendet der Watchdog ein neutrales Pad ohne Ausschlag.', 'Permitted commands continue as /joy; otherwise the watchdog sends a neutral pad with no deflection.']),
            S('pcc>jts', ['Die Vorprüfung sagt die TCP-Höhe 0,25 s voraus, bremst abwärts ab 110 mm und stoppt bei 91 mm.', 'The pre-check predicts the TCP height 0.25 s ahead, slows downward motion from 110 mm and stops at 91 mm.']),
            S('jts>srv', ['joy_to_servo_node macht aus den Achsen eine geglättete TCP-Geschwindigkeit, skaliert mit der Tempostufe 0,1–0,5.', 'joy_to_servo_node turns the axes into a smoothed TCP velocity, scaled by the speed level 0.1–0.5.']),
            S('srv>arm', ['MoveIt Servo rechnet den Twist in Gelenkbefehle und hält vor Singularität, Kollision und Gelenkgrenze.', 'MoveIt Servo converts the twist into joint commands and halts before singularity, collision and joint limit.']),
            S('srv>pcc', ['Meldet Servo eine Warnung (Status 3, 4 oder 5), lässt die Vorprüfung das lokale Pad vibrieren.', 'When Servo reports a warning (status 3, 4 or 5), the pre-check makes the local pad rumble.'], { also: ['pcc>padl'] })]),
          SC('local', ['Lokal', 'Local'], 'i-pad', 'teal', ['Das USB-Pad am Roboter-PC geht ohne Watchdog direkt in die Vorprüfung. Vor Ort braucht es keine Freigabe; Vorprüfung und Servo-Grenzen gelten trotzdem.', 'The USB pad on the robot PC goes straight into the pre-check, without the watchdog. On site no approval is needed; pre-check and Servo limits still apply.'], [
            S('padl>pcc', ['joy_node liest Sticks, Trigger und Tasten des Xbox-Pads und publiziert sie als /joy.', 'joy_node reads sticks, triggers and buttons of the Xbox pad and publishes them as /joy.']),
            S('pcc>jts', ['Die Vorprüfung sagt die TCP-Höhe 0,25 s voraus, bremst abwärts ab 110 mm und stoppt bei 91 mm.', 'The pre-check predicts the TCP height 0.25 s ahead, slows downward motion from 110 mm and stops at 91 mm.']),
            S('jts>srv', ['joy_to_servo_node macht aus den Achsen eine geglättete TCP-Geschwindigkeit, skaliert mit der Tempostufe.', 'joy_to_servo_node turns the axes into a smoothed TCP velocity, scaled by the speed level.']),
            S('srv>arm', ['MoveIt Servo rechnet den Twist in Gelenkbefehle und hält vor Singularität, Kollision und Gelenkgrenze.', 'MoveIt Servo converts the twist into joint commands and halts before singularity, collision and joint limit.'])])],
      },
    },
    jog: {
      t: ['Jogging: halten, fahren, loslassen', 'Jogging: hold, move, release'], hue: 'accent', icon: 'i-gizmo', s: 'sr',
      d: ['Kartesisch oder je Gelenk: Der Befehlsstrom selbst ist der Totmann, die UI sendet nur, solange der Knopf gehalten wird. Bleibt der nächste Befehl länger als 1,0 s (FAKE) bzw. 0,4 s (REAL) aus, schickt der Watchdog einen Null-Befehl an MoveIt Servo.', 'Cartesian or per joint: the command stream itself is the dead man; the UI sends only while the button is held. If the next command is missing for more than 1.0 s (FAKE) or 0.4 s (REAL), the watchdog sends a zero command to MoveIt Servo.'],
      spec: {
        lanes: lanes('in', 'br', 'chk', 'mo', 'hw'),
        nodes: [N('ui', 'in', 0, { sub: 'Jogging · :8081' }), N('rb', 'br', 0), N('wd', 'chk', 0, { label: 'Twist-Gate', short: 'Gate' }), N('srv', 'mo', 0), N('arm', 'hw', 0)],
        edges: [E('ui', 'rb', '/remote/twist'), E('rb', 'wd', '/remote/twist'), E('wd', 'srv', '/servo_server/delta_twist_cmds'), E('srv', 'arm', '/lite6_traj_controller/joint_trajectory'),
          R('arm', 'srv', '/joint_states'), R('srv', 'ui', '/servo_server/status')],
        scenarios: [
          SC('cart', ['Kartesisch', 'Cartesian'], 'i-gizmo', 'accent', ['Eine Jogging-Taste halten bewegt den TCP im Basis- oder Werkzeug-Koordinatensystem (link_base, link_tcp). Loslassen sendet sofort null; bleibt der Strom aus, stoppt der Watchdog.', 'Holding a jogging button moves the TCP in the base or tool frame (link_base, link_tcp). Releasing sends zero at once; if the stream stops, the watchdog stops.'], [
            S('ui>rb', ['Solange der Knopf gedrückt ist, sendet die UI alle 20 ms einen Twist; Loslassen sendet null.', 'While the button is pressed, the UI sends a twist every 20 ms; releasing sends zero.']),
            S('rb>wd', ['Das Twist-Gate lässt nur den Besitzer des Control-Locks mit frischem Heartbeat und ohne verriegelten E-STOP durch.', 'The twist gate passes only the control lock owner with a fresh heartbeat and no latched E-STOP.']),
            S('wd>srv', ['Die Bodensperre begrenzt die Abwärtsfahrt so, dass der TCP in 0,25 s über dem Z-Level (10 mm) halten kann; entfernte Clients fahren höchstens mit max_speed.', 'The floor guard limits downward speed so the TCP can stop within 0.25 s above the Z level (10 mm); remote clients move at max_speed at most.']),
            S('srv>arm', ['MoveIt Servo rechnet den Twist in Gelenkbefehle und bremst vor Singularität, Kollision und Gelenkgrenze.', 'MoveIt Servo converts the twist into joint commands and slows down before singularity, collision and joint limit.']),
            S('arm>srv', ['Die gemessene Gelenkstellung geht zurück an Servo und ist Ausgangspunkt für den nächsten Takt.', 'The measured joint state returns to Servo and is the starting point for the next cycle.']),
            S('srv>ui', ['Der Servo-Status erscheint als Badge in der UI, z. B. Bremsen wegen Singularität oder Kollision.', 'The Servo status appears as a badge in the UI, e.g. slowing for singularity or collision.'])]),
          SC('joint', ['Gelenk', 'Joint'], 'i-arm', 'teal', ['Einen Gelenk-Regler ziehen: Die Geschwindigkeit folgt dem Mausweg, Loslassen stoppt das Gelenk. Das Twist-Gate prüft dieselben Bedingungen wie beim kartesischen Jogging.', 'Drag a joint slider: the velocity follows the mouse travel, releasing stops the joint. The twist gate checks the same conditions as for Cartesian jogging.'], [
            S('ui>rb', ['Die UI rechnet Mausweg × Tempo in eine Gelenkgeschwindigkeit und sendet sie alle 50 ms.', 'The UI turns mouse travel × speed into a joint velocity and sends it every 50 ms.'], { topic: '/remote/joint_jog' }),
            S('rb>wd', ['Gleiche Prüfung wie beim Twist; nahe dem Boden sperrt das Gate die Gelenkrichtung, die nach unten führt.', 'Same check as for the twist; near the floor the gate blocks the joint direction that leads downward.'], { topic: '/remote/joint_jog' }),
            S('wd>srv', ['Erlaubte Werte gehen als Gelenkgeschwindigkeit an MoveIt Servo.', 'Permitted values go to MoveIt Servo as joint velocity.'], { topic: '/servo_server/delta_joint_cmds' }),
            S('srv>arm', ['Servo fährt die gewählten Gelenke und hält an der Gelenkgrenze.', 'Servo moves the selected joints and halts at the joint limit.'])])],
      },
    },
    moveto: {
      t: ['MoveTo: Ziel ziehen, Ghost prüfen, fahren', 'MoveTo: drag the target, check the ghost, move'], hue: 'accent', icon: 'i-gizmo', s: 'spr',
      d: ['Erst virtuell, dann real: Der Motion Handler rechnet die IK nahe der aktuellen Stellung und lässt MoveIt nur planen. Mit Ghost-Vorschau läuft die Bahn zuerst im Digital Twin; der Arm fährt erst nach Execute, ohne Freigabe verfällt der Plan nach 15 s.', 'First virtual, then real: the motion handler solves the IK near the current pose and lets MoveIt only plan. With ghost preview the path runs in the Digital Twin first; the arm moves only after Execute, and without approval the plan expires after 15 s.'],
      note: ['Ghost-Vorschau ist zuschaltbar (Standard aus). Ohne sie fährt Go direkt, geprüft von IK, Boden-Box und MoveIt.', 'Ghost preview can be switched on (default off). Without it, Go moves directly, checked by IK, floor box and MoveIt.'],
      loop: { t: ['Plan → Prüfen → Freigabe', 'Plan → check → approve'], s: ['Motion Handler · MoveIt', 'Motion handler · MoveIt'],
        st: [[['Ziel setzen', 'Set target'], ['TCP-Gizmo · Go · Scan', 'TCP gizmo · Go · Scan']], [['Planen', 'Plan'], ['IK + plan_only', 'IK + plan_only']], [['Prüfen', 'Check'], ['Ghost · Boden-Box', 'Ghost · floor box']],
          [['Bestätigung', 'Confirm'], ['Execute · Verwerfen', 'Execute · discard']], [['Ausführen', 'Execute'], ['/execute_trajectory', '/execute_trajectory']], [['Melden', 'Report'], ['motion_state', 'motion_state']]],
        back: { from: 3, to: 0, t: ['Verwerfen oder 15 s ohne Freigabe → neu ziehen', 'Discard or 15 s without approval → drag again'] } },
      spec: {
        lanes: lanes(['in', ['Bediener · UI', 'Operator · UI']], 'br', ['chk', ['Planen', 'Plan']], 'mv', 'hw'),
        nodes: [N('ui', 'in', 0, { sub: 'TCP-Gizmo · Ghost · :8081' }), N('rb', 'br', 0), N('mh', 'chk', 0),
          N('fl', 'chk', 1.5, { label: ['Boden-Box', 'Floor box'], short: ['Boden', 'Floor'], sub: 'moveit_floor_collision', icon: 'i-shield', hue: 'gold', info: ['Boden-Box in der Planungsszene: Bahnen unter den Tisch sind blockiert (Level 10 mm).', 'Floor box in the planning scene: paths below the table are blocked (level 10 mm).'] }),
          N('mg', 'mv', 0), N('arm', 'hw', 0)],
        edges: [E('ui', 'rb', '/ui/plan_move_to_pose_confirm', { kind: 'service' }), E('rb', 'mh', '/ui/plan_move_to_pose_confirm', { kind: 'service' }), E('mh', 'mg', '/move_action', { kind: 'action' }),
          E('fl', 'mg', '/planning_scene'), R('mh', 'ui', '/ui/moveto_preview_path'), E('mg', 'arm', '/lite6_traj_controller/follow_joint_trajectory', { kind: 'action' })],
        scenarios: [SC('mt', 'MoveTo', 'i-gizmo', 'accent', ['TCP-Gizmo ziehen, Ghost-Bahn ansehen, bestätigen: Plan → Prüfen → Bestätigung → Ausführen. Boden-Box und Planungsszene halten die Bahn über dem Tisch und weg von Hindernissen.', 'Drag the TCP gizmo, watch the ghost path, confirm: plan → check → confirm → execute. Floor box and planning scene keep the path above the table and clear of obstacles.'], [
          S('ui>rb', ['Beim Loslassen des TCP-Gizmos schickt die UI die Zielpose als Service-Anfrage mit Bestätigung.', 'On releasing the TCP gizmo the UI sends the target pose as a service request with confirmation.']),
          S('rb>mh', ['Der Motion Handler sucht eine IK-Lösung nahe der aktuellen Stellung und pausiert Servo für die Fahrt.', 'The motion handler looks for an IK solution near the current pose and pauses Servo for the motion.']),
          S('mh>mg', ['MoveIt plant mit plan_only eine Bahn um alle Hindernisse der Planungsszene, die Boden-Box eingeschlossen.', 'MoveIt plans a path with plan_only around every obstacle in the planning scene, floor box included.'], { also: ['fl>mg'] }),
          S('mh>ui', ['Die geplante Bahn läuft als Ghost im Digital Twin; der Mensch prüft sie, bevor etwas fährt.', 'The planned path runs as a ghost in the Digital Twin; the human checks it before anything moves.']),
          S('ui>rb', ['Execute bestätigt genau diese Bahn, Verwerfen löscht sie; ohne Antwort verfällt sie nach 15 s.', 'Execute confirms exactly this path, Discard deletes it; without an answer it expires after 15 s.'], { topic: '/ui/confirm_moveto_preview', also: ['rb>mh'] }),
          S('mh>mg', ['Der Motion Handler führt die bestätigte Bahn unverändert aus, ohne neu zu planen.', 'The motion handler executes the confirmed path unchanged, without replanning.'], { topic: '/execute_trajectory' }),
          S('mg>arm', ['Der Trajektorien-Controller fährt die Bahn: in der Roboter-Simulation (FAKE) oder auf echter Roboter-Hardware (REAL).', 'The trajectory controller runs the path: in robot simulation (FAKE) or on real robot hardware (REAL).']),
          S('mh>ui', ['Der Motion Handler meldet succeeded, failed oder aborted; UI, Sequenzen und KI-Agent warten auf diese Meldung.', 'The motion handler reports succeeded, failed or aborted; UI, sequences and AI agent wait for this report.'], { topic: '/ui/moveit_motion_state' })])],
      },
    },
    servo: {
      t: ['Servo-Regelkreis', 'Servo control loop'], hue: 'indigo', icon: 'i-pulse', s: 'sr',
      d: ['Ein geschlossener Regelkreis im Takt von 0,034 s: Servo verrechnet jeden Twist mit der gemessenen Gelenkstellung und schickt eine Gelenk-Trajektorie an den Controller. Nähert sich der Arm einer Singularität, Kollision oder Gelenkgrenze, bremst Servo und hält an; ohne neuen Befehl stoppt er nach 0,2 s.', 'A closed loop with a 0.034 s cycle: Servo combines every twist with the measured joint state and sends a joint trajectory to the controller. As the arm nears a singularity, collision or joint limit, Servo slows down and halts; without a new command it stops after 0.2 s.'],
      loop: { t: ['Servo-Regelkreis', 'Servo control loop'], s: ['MoveIt Servo · 0,034 s', 'MoveIt Servo · 0.034 s'],
        st: [[['Twist', 'Twist'], ['Befehl −1 … 1', 'command −1 … 1']], [['Servo rechnet', 'Servo computes'], ['Singularität · Kollision', 'singularity · collision']], [['Gelenkbefehl', 'Joint command'], ['JointTrajectory', 'JointTrajectory']],
          [['Controller', 'Controller'], ['lite6_traj_controller', 'lite6_traj_controller']], [['Ist-Stellung', 'Actual state'], ['/joint_states', '/joint_states']]],
        back: { from: 4, to: 1, t: ['Ist-Stellung fließt in den nächsten Takt', 'Actual state feeds the next cycle'] },
        x: ['Takt 0,034 s; ohne neuen Befehl stoppt Servo nach 0,2 s.', 'Cycle 0.034 s; without a new command Servo stops after 0.2 s.'] },
      spec: {
        lanes: lanes(['in', ['Befehl · Anzeige', 'Command · display']], ['chk', ['Servo', 'Servo']], ['mo', ['Controller', 'Controller']], 'hw'),
        nodes: [N('cmd', 'in', 0, { label: ['Twist-Quelle', 'Twist source'], short: 'Twist', sub: 'Watchdog · joy_to_servo', icon: 'i-pad', hue: 'accent', info: ['Browser-Jogging über den Watchdog oder das Gamepad über joy_to_servo_node.', 'Browser jogging via the watchdog or the gamepad via joy_to_servo_node.'] }),
          N('ui', 'in', 1.5, { sub: ['Status-Badge', 'Status badge'] }), N('srv', 'chk', 0), N('pcc', 'chk', 1.5, { info: ['Lässt das Gamepad bei Status 3, 4 und 5 vibrieren.', 'Rumbles the gamepad on status 3, 4 and 5.'] }),
          N('ctl', 'mo', 0, { label: ['Trajektorien-Controller', 'Trajectory controller'], short: 'Ctrl', sub: 'lite6_traj_controller', icon: 'i-chip', hue: 'indigo', info: ['ros2_control: FAKE mit simulierten, REAL mit echten Controllern.', 'ros2_control: FAKE with simulated, REAL with real controllers.'] }), N('arm', 'hw', 0)],
        edges: [E('cmd', 'srv', '/servo_server/delta_twist_cmds'), E('srv', 'ctl', '/lite6_traj_controller/joint_trajectory'), E('ctl', 'arm', 'ros2_control'), R('arm', 'srv', '/joint_states'),
          E('srv', 'ui', '/servo_server/status', { ports: 'bt' }), E('srv', 'pcc', '/servo_server/status')],
        scenarios: [SC('loop', ['Regelkreis', 'Control loop'], 'i-pulse', 'indigo', ['Ein Takt des Servo-Regelkreises: Befehl, Gelenkbefehl, Ist-Stellung, Status. Servo prüft dabei mit 10 Hz auf Kollisionen gegen die Planungsszene.', 'One cycle of the servo loop: command, joint command, actual state, status. Servo checks for collisions at 10 Hz against the planning scene.'], [
          S('cmd>srv', ['Watchdog oder joy_to_servo_node liefern einen Twist, normiert auf −1 … 1 je Achse.', 'Watchdog or joy_to_servo_node deliver a twist normalised to −1 … 1 per axis.']),
          S('srv>ctl', ['Servo prüft Singularität, Kollision (10 Hz) und Gelenkgrenzen und publiziert den Gelenkbefehl.', 'Servo checks singularity, collision (10 Hz) and joint limits and publishes the joint command.']),
          S('ctl>arm', ['Der Trajektorien-Controller führt den Befehl über ros2_control aus, in der Roboter-Simulation oder auf echter Roboter-Hardware.', 'The trajectory controller executes the command via ros2_control, in robot simulation or on real robot hardware.']),
          S('arm>srv', ['Die gemessene Gelenkstellung geht zurück an Servo und ist Ausgangspunkt für den nächsten Takt.', 'The measured joint state returns to Servo and is the starting point for the next cycle.']),
          S('srv>ui', ['Servo meldet Status 0–6; die UI zeigt ihn als Badge, bei 3, 4 und 5 vibriert das Gamepad.', 'Servo reports status 0–6; the UI shows it as a badge, at 3, 4 and 5 the gamepad rumbles.'], { also: ['srv>pcc'] })])],
      },
    },
    gripper: {
      t: ['Greifer und Vakuum', 'Gripper and vacuum'], hue: 'indigo', icon: 'i-grip', s: 'sr',
      d: ['Ein Befehl, zwei Greifer: joy_to_servo_node ist einziger Besitzer des Greiferzustands und schaltet Sauger oder Finger über den xArm-Treiber. Die UI zeigt den neuen Zustand erst, wenn der Treiber Erfolg meldet; im FAKE-Modus wechselt nur der Zustand.', 'One command, two grippers: joy_to_servo_node is the sole owner of the gripper state and switches suction or fingers via the xArm driver. The UI shows the new state only once the driver reports success; in FAKE mode only the state changes.'],
      spec: {
        lanes: lanes('in', 'br', ['mo', ['Greifer-Node', 'Gripper node']], ['hw', ['Treiber', 'Driver']]),
        nodes: [N('ui', 'in', 0), N('pad', 'in', 1.5, { label: ['Gamepad A/B', 'Gamepad A/B'], short: 'Pad', sub: '/joy_check', icon: 'i-pad', hue: 'accent', info: ['A schaltet um, B schaltet aus.', 'A toggles, B switches off.'] }), N('rb', 'br', 0), N('gj', 'mo', 0),
          N('drv', 'hw', 0, { label: ['xArm-Treiber', 'xArm driver'], short: ['Treiber', 'Driver'], sub: 'ufactory_driver · REAL', icon: 'i-chip', hue: 'indigo', info: ['Schaltet Vakuum oder Finger-Greifer an echter Roboter-Hardware.', 'Switches the vacuum or finger gripper on real robot hardware.'] }),
          N('sim', 'hw', 1.5, { label: ['Roboter-Simulation', 'Robot simulation'], short: 'Sim', sub: 'simulate_gripper · FAKE', icon: 'i-cube', hue: 'teal', info: ['Im FAKE-Modus gibt es keinen Treiber-Service; nur der Zustand wechselt.', 'In FAKE mode there is no driver service; only the state changes.'] })],
        edges: [E('ui', 'rb', '/ui/gripper_cmd'), E('rb', 'gj', '/ui/gripper_cmd'), E('pad', 'gj', '/joy_check', { ports: 'rb' }), E('gj', 'drv', '/ufactory/set_vacuum_gripper', { kind: 'service' }),
          E('gj', 'sim', ['nur Zustand', 'state only'], { ports: 'bl' }), R('gj', 'ui', '/ui/gripper_state')],
        scenarios: [
          SC('ui', ['Knopf', 'Button'], 'i-win', 'indigo', ['Open, Close oder Off in der UX | Control Interface. Der Knopf zeigt den Zustand erst nach der Rückmeldung, nie vorab.', 'Open, Close or Off in the UX | Control Interface. The button shows the state only after the feedback, never in advance.'], [
            S('ui>rb', ['Der Knopf sendet open, close oder off; dasselbe Topic nutzen Sequenzen und KI-Agent.', 'The button sends open, close or off; sequences and the AI agent use the same topic.']),
            S('rb>gj', ['Der Greifer-Node nimmt den Befehl an und wählt je nach Greifertyp Sauger oder Finger.', 'The gripper node accepts the command and picks suction or fingers depending on the gripper type.']),
            S('gj>drv', ['In REAL ruft er den Service des xArm-Treibers auf; in FAKE gibt es keinen Treiber, nur der Zustand wechselt.', 'In REAL it calls the xArm driver service; in FAKE there is no driver and only the state changes.'], { also: ['gj>sim'] }),
            S('gj>ui', ['Erst nach Erfolg des Treibers publiziert der Node den neuen Zustand, latched für alle Clients.', 'Only after the driver succeeds does the node publish the new state, latched for all clients.'])]),
          SC('pad', ['Gamepad', 'Gamepad'], 'i-pad', 'accent', ['Am Gamepad schaltet Taste A zwischen offen und zu um, B schaltet den Greifer aus. Der Befehl kommt über /joy_check aus der Vorprüfung.', 'On the gamepad, button A toggles between open and closed, B switches the gripper off. The command arrives via /joy_check from the pre-check.'], [
            S('pad>gj', ['Der Greifer-Node liest die Tasten aus /joy_check: A schaltet um, B schaltet aus.', 'The gripper node reads the buttons from /joy_check: A toggles, B switches off.']),
            S('gj>drv', ['In REAL schaltet der Treiber-Service Vakuum oder Finger am Arm.', 'In REAL the driver service switches vacuum or fingers on the arm.'], { also: ['gj>sim'] }),
            S('gj>ui', ['Die UI zeigt den Zustand als Chip und Vakuum-Balken, auch wenn das Gamepad geschaltet hat.', 'The UI shows the state as a chip and vacuum bar, even when the gamepad switched it.'])])],
      },
    },
    seq: {
      t: ['Sequenzen: aufnehmen und abspielen', 'Sequences: record and play'], hue: 'accent', icon: 'i-layers', s: 'spr',
      d: ['Fünf Schritttypen laufen nacheinander: move, home, gripper, wait und approach; der UI-Server speichert die Sequenzen für alle Clients. Jeder Schritt startet erst, wenn der vorige succeeded meldet; failed, aborted, E-STOP oder Zeitüberschreitung beenden die Sequenz.', 'Five step types run one after another: move, home, gripper, wait and approach; the UI server stores the sequences for all clients. Each step starts only when the previous one reports succeeded; failed, aborted, E-STOP or a timeout end the sequence.'],
      spec: {
        lanes: lanes('in', ['br', ['Server · Brücke', 'Server · bridge']], 'mo', 'hw'),
        nodes: [N('ui', 'in', 0, { label: ['Sequenzen', 'Sequences'], short: 'Seq.', sub: 'UX | Control Interface', icon: 'i-layers' }),
          N('api', 'br', 1.5, { label: ['UI-Server', 'UI server'], short: 'Server', sub: ':8081 · sequences.json', icon: 'i-db', hue: 'teal', info: ['Speichert Sequenzen für alle Clients in ~/.config/robot_control_ui/sequences.json.', 'Stores sequences for all clients in ~/.config/robot_control_ui/sequences.json.'] }),
          N('rb', 'br', 0), N('mh', 'mo', 0), N('gj', 'mo', 1.5), N('arm', 'hw', 0)],
        edges: [E('ui', 'api', 'HTTP /api/sequences', { kind: 'service', ports: 'bl' }), E('ui', 'rb', '/ui/execute_move_to_pose_silent', { kind: 'service' }), E('rb', 'mh', '/ui/execute_move_to_pose_silent', { kind: 'service' }),
          E('rb', 'gj', '/ui/gripper_cmd', { ports: 'bl' }), E('mh', 'arm', ['MoveGroup → Controller', 'MoveGroup → controller']), R('mh', 'ui', '/ui/moveit_motion_state')],
        scenarios: [SC('play', ['Abspielen', 'Play'], 'i-fg-play', 'accent', ['Waypoints speichern, Play im Popup bestätigen, Schritt für Schritt fahren. Jede Fahrt läuft durch dieselbe Prüfung motionAllowed wie ein einzelner Knopf.', 'Save waypoints, confirm Play in the popup, move step by step. Every motion passes the same motionAllowed check as a single button.'], [
          S('ui>api', ['Gespeicherte Waypoints liegen auf dem Roboter-PC und sind für alle Clients gleich.', 'Saved waypoints live on the robot PC and are the same for all clients.']),
          S('ui>rb', ['Play startet erst nach Bestätigung im Popup; die einzelnen Fahrten laufen danach ohne weiteren Dialog.', 'Play starts only after confirming the popup; the individual motions then run without another dialog.']),
          S('rb>mh', ['Je Waypoint ein MoveTo; motionAllowed prüft vorher E-STOP, rosbridge-Verbindung, Control-Lock und laufende Fahrt.', 'One MoveTo per waypoint; motionAllowed first checks E-STOP, rosbridge connection, control lock and running motion.']),
          S('mh>arm', ['Der Motion Handler plant und fährt mit denselben Grenzen wie im Einzelbetrieb, in FAKE oder REAL.', 'The motion handler plans and moves with the same limits as in single use, in FAKE or REAL.']),
          S('mh>ui', ['Erst succeeded für genau diesen Lauf gibt den nächsten Schritt frei; failed oder aborted beenden die Sequenz.', 'Only succeeded for exactly this run releases the next step; failed or aborted end the sequence.']),
          S('rb>gj', ['Ein Greifer-Schritt wartet bis zu 4 s, bis der neue Greiferzustand zurückkommt.', 'A gripper step waits up to 4 s for the new gripper state to come back.'])])],
      },
    },
    linear: {
      t: ['Linearachse (nur FAKE)', 'Linear axis (FAKE only)'], hue: 'teal', icon: 'i-go', s: 's',
      d: ['Die simulierte Achse verschiebt den Roboter auf einer 1,2-m-Schiene um bis zu ±0,5 m. fake_linear_axis setzt die Position als TF world → linear_axis_link, damit MoveIt, Digital Twin und RViz den Arm an derselben Stelle sehen.', 'The simulated axis moves the robot along a 1.2 m rail by up to ±0.5 m. fake_linear_axis sets the position as TF world → linear_axis_link, so MoveIt, Digital Twin and RViz see the arm at the same place.'],
      note: ['Nur FAKE: Ein Treiber für eine echte Achse fehlt; die UX | Nexus Launcher verhindert REAL mit Achse.', 'FAKE only: there is no driver for a real axis; the UX | Nexus Launcher blocks REAL with the axis.'],
      spec: {
        lanes: lanes('in', 'br', ['mo', ['Achse', 'Axis']], ['hw', ['Szene', 'Scene']]),
        nodes: [N('ui', 'in', 0, { label: ['Achs-Regler', 'Axis slider'], short: ['Regler', 'Slider'], sub: 'UX | Control Interface' }),
          N('dev', 'in', 1.5, { label: 'Gamepad · Quest 3', short: 'Pad/VR', sub: ['Kreuz · Daumenstick', 'D-pad · thumbstick'], icon: 'i-pad', hue: 'accent', info: ['joy_to_servo_node und VR-Node senden direkt in 5-mm-Schritten.', 'joy_to_servo_node and the VR node send directly in 5 mm steps.'] }),
          N('rb', 'br', 0), N('fla', 'mo', 0, { label: ['Linearachse', 'Linear axis'], short: ['Achse', 'Axis'], sub: 'fake_linear_axis', icon: 'i-go', hue: 'teal', info: ['Setzt die Position als TF und zeichnet die Schiene, 20 Hz.', 'Sets the position as TF and draws the rail, 20 Hz.'] }),
          N('tf', 'hw', 0, { label: 'TF · MoveIt · Twin', short: 'TF', sub: 'world → linear_axis_link', icon: 'i-layers', hue: 'indigo', info: ['Alle Abnehmer sehen den Roboter an der neuen Stelle.', 'All consumers see the robot at its new place.'] })],
        edges: [E('ui', 'rb', '/linear_axis_cmd'), E('rb', 'fla', '/linear_axis_cmd'), E('dev', 'fla', '/linear_axis_cmd', { ports: 'rb' }), E('fla', 'tf', ['TF + Schienen-Marker', 'TF + rail markers'])],
        scenarios: [
          SC('ui', ['Regler', 'Slider'], 'i-win', 'teal', ['Den Achs-Regler in der UX | Control Interface ziehen und loslassen: Die Achse fährt auf das Ziel. Ohne Control-Lock ist der Regler gesperrt.', 'Drag and release the axis slider in the UX | Control Interface: the axis moves to the target. Without the control lock the slider is locked.'], [
            S('ui>rb', ['Erst beim Loslassen sendet die UI die Zielposition in Metern, begrenzt auf ±0,5 m.', 'Only on release does the UI send the target position in metres, limited to ±0.5 m.']),
            S('rb>fla', ['Das Ziel geht als Float64 an fake_linear_axis; ohne Control-Lock sendet die UI gar nicht erst.', 'The target goes to fake_linear_axis as Float64; without the control lock the UI does not send at all.']),
            S('fla>tf', ['Die Achse publiziert ihre Position mit 20 Hz als TF und zeichnet die Schiene als Marker.', 'The axis publishes its position at 20 Hz as TF and draws the rail as markers.'])]),
          SC('dev', ['Gamepad · VR', 'Gamepad · VR'], 'i-pad', 'accent', ['Am Gamepad schiebt das Steuerkreuz links/rechts die Achse, an der Quest 3 der Daumenstick. Beide senden direkt in 5-mm-Schritten.', 'On the gamepad the D-pad left/right pushes the axis, on the Quest 3 the thumbstick. Both send directly in 5 mm steps.'], [
            S('dev>fla', ['Jeder Schritt verschiebt das Ziel um 5 mm, höchstens bis ±0,5 m.', 'Each step shifts the target by 5 mm, up to ±0.5 m at most.']),
            S('fla>tf', ['Die Achse publiziert ihre Position mit 20 Hz als TF und zeichnet die Schiene als Marker.', 'The axis publishes its position at 20 Hz as TF and draws the rail as markers.'])])],
      },
    },
    vr: {
      t: ['VR Quest 3: die Hand führt den Arm', 'VR Quest 3: the hand guides the arm'], hue: 'accent', icon: 'i-vr', s: 'spr',
      d: ['Grip halten, Hand bewegen: vr_quest3_teleop macht aus dem Handweg einen Twist, der wie das Browser-Jogging durch das Twist-Gate des Watchdogs läuft. Im PLAN-Modus zieht der Laser stattdessen einen Ghost, erst EXECUTE fährt.', 'Hold the grip, move the hand: vr_quest3_teleop turns the hand travel into a twist that passes the watchdog twist gate like browser jogging. In PLAN mode the laser drags a ghost instead; only EXECUTE moves.'],
      spec: {
        lanes: lanes(['q', ['Quest 3', 'Quest 3']], ['br', ['Brücke (WSS)', 'Bridge (WSS)']], ['vr', ['VR-Node', 'VR node']], 'wd', 'mo'),
        nodes: [N('xr', 'q', 0, { label: 'Quest 3 · WebXR', short: 'Quest', sub: ':8443 · VR-Cockpit', icon: 'i-vr', hue: 'accent', info: ['Digital Twin in der Brille mit HUD: Modus, FAKE/REAL, Control, E-STOP, Bestätigungskarte.', 'Digital Twin in the headset with HUD: mode, FAKE/REAL, control, E-STOP, confirm card.'] }),
          N('rb', 'br', 0, { sub: ':9091 · Whitelist' }), N('vrn', 'vr', 0, { label: 'VR-Teleop', short: 'VR', sub: 'vr_quest3_teleop', icon: 'i-vr', hue: 'indigo', info: ['Hand-Delta × 3,2 wird Twist; eigener Watchdog: 0,3 s ohne Daten → Null-Twist.', 'Hand delta × 3.2 becomes a twist; own watchdog: 0.3 s without data → zero twist.'] }),
          N('wd', 'wd', 0, { label: 'Twist-Gate', short: 'Gate' }), N('srv', 'mo', 0)],
        edges: [E('xr', 'rb', '/vr_teleop/controller_data'), E('rb', 'vrn', '/vr_teleop/controller_data'), E('vrn', 'wd', '/remote/twist'), E('wd', 'srv', '/servo_server/delta_twist_cmds'), R('wd', 'vrn', '/remote/control_state')],
        scenarios: [SC('servo', ['SERVO-Modus', 'SERVO mode'], 'i-vr', 'accent', ['Solange der Grip gedrückt ist, folgt der Arm der Hand in Echtzeit: Je weiter die Hand vom Startpunkt weg ist, desto schneller fährt der TCP. Datenausfall, E-STOP oder eine laufende MoveIt-Fahrt halten ihn an.', 'While the grip is pressed, the arm follows the hand in real time: the farther the hand is from the origin, the faster the TCP moves. Data loss, E-STOP or a running MoveIt motion halt it.'], [
          S('xr>rb', ['Bei gedrücktem Grip sendet die Quest 3 die Hand-Pose als JSON über die verschlüsselte rosbridge (WSS).', 'With the grip pressed, the Quest 3 sends the hand pose as JSON over the encrypted rosbridge (WSS).']),
          S('rb>vrn', ['Das erste gültige Frame verankert den Startpunkt; danach zählt nur der Abstand der Hand zu diesem Punkt.', 'The first valid frame anchors the origin; after that only the hand offset from this point counts.']),
          S('vrn>wd', ['Der VR-Node rechnet Abstand × 3,2 in einen Twist; Abstände unter 8 mm (Totband) ignoriert er.', 'The VR node turns offset × 3.2 into a twist; it ignores offsets below 8 mm (dead band).']),
          S('wd>srv', ['Das Twist-Gate lässt nur den Besitzer der Steuerung durch und begrenzt Tempo und Abwärtsfahrt.', 'The twist gate passes only the owner of control and limits speed and downward motion.']),
          S('wd>vrn', ['Meldet der Control-Zustand Verlust der Steuerung oder E-STOP, hält der VR-Node selbst an.', 'If the control state reports lost control or E-STOP, the VR node halts by itself.']),
          S('vrn>wd', ['Kommen länger als 0,3 s keine Controller-Daten, sendet der VR-Node einen Null-Twist.', 'If no controller data arrive for more than 0.3 s, the VR node sends a zero twist.'])])],
      },
    },
    voice: {
      t: ['Sprachbefehl: hören, erkennen, bestätigen', 'Voice command: listen, detect, confirm'], hue: 'teal', icon: 'i-mic', s: 'spr',
      d: ['Whisper transkribiert ein Hörfenster von 5 s lokal auf dem Roboter-PC, voice_command_listener erkennt darin Befehle auf Deutsch und Englisch per Regex. Fahrten laufen durch dieselbe Bestätigung wie die Knöpfe, „E-STOP“ und „Stopp“ wirken sofort.', 'Whisper transcribes a 5 s listening window locally on the robot PC; voice_command_listener detects commands in German and English by regex. Motions pass the same confirmation as the buttons; “E-STOP” and “stop” act at once.'],
      note: ['Mit Auto-Move an fährt ein Befehl ohne Popup. E-STOP und Stop wirken immer sofort.', 'With auto-move on, a command moves without the popup. E-STOP and stop always act at once.'],
      loop: { t: ['Sprachbefehl', 'Voice command'], s: ['Whisper · voice_command_listener', 'Whisper · voice_command_listener'],
        st: [[['Hören', 'Listen'], ['Knopf · 5 s', 'button · 5 s']], [['Transkribieren', 'Transcribe'], ['Whisper', 'Whisper']], [['Erkennen', 'Detect'], ['Regex · 3 s Cooldown', 'regex · 3 s cooldown']],
          [['Bestätigen', 'Confirm'], ['Popup', 'popup']], [['Ausführen', 'Execute'], ['motionAllowed', 'motionAllowed']], [['Rückmeldung', 'Feedback'], ['/ui/voice_status', '/ui/voice_status']]],
        back: { from: 2, to: 0, t: ['kein Befehl erkannt → neu hören', 'no command detected → listen again'] } },
      spec: {
        lanes: lanes(['mic', ['Mikrofon', 'Microphone']], ['asr', ['Whisper', 'Whisper']], ['ros', ['Listener', 'Listener']], ['ui', ['UX | Control Interface', 'UX | Control Interface']], 'mo'),
        nodes: [N('mic', 'mic', 0, { label: 'audio_listener', short: 'Mic', sub: ['Mikrofon', 'Microphone'], icon: 'i-mic', hue: 'accent', info: ['Liest das Mikrofon und publiziert /audio_listener/audio.', 'Reads the microphone and publishes /audio_listener/audio.'] }),
          N('wh', 'asr', 0, { label: 'Whisper', short: 'ASR', sub: 'whisper_server', icon: 'i-spark', hue: 'violet', info: ['Transkribiert ein Hörfenster von 5 s (Diktat bis 8 s).', 'Transcribes a 5 s listening window (dictation up to 8 s).'] }),
          N('vcl', 'ros', 0, { label: 'voice_command_listener', short: 'Voice', sub: 'Regex DE/EN', icon: 'i-mic', hue: 'teal', info: ['Erkennt Befehle per Regex, 3 s Cooldown; E-STOP und Stop ohne Cooldown.', 'Detects commands by regex, 3 s cooldown; E-STOP and stop without cooldown.'] }),
          N('ui', 'ui', 0), N('mh', 'mo', 0)],
        edges: [E('mic', 'wh', '/audio_listener/audio'), E('vcl', 'wh', '/whisper/inference', { kind: 'action' }), E('ui', 'vcl', '/ui/voice_listen_trigger'), E('vcl', 'ui', '/ui/voice_feedback'),
          E('ui', 'mh', '/ui/execute_move_to_pose', { kind: 'service' }), R('vcl', 'mh', '/ui/emergency_stop_topic')],
        scenarios: [
          SC('cmd', ['Sprachbefehl', 'Voice command'], 'i-mic', 'teal', ['„Fahre zur Startposition“: hören, erkennen, bestätigen, fahren. Nach einem erkannten Befehl wartet der Listener 3 s, damit ein Satz nicht doppelt auslöst.', '“Go to the start position”: listen, detect, confirm, move. After a detected command the listener waits 3 s so one sentence does not fire twice.'], [
            S('ui>vcl', ['Start Listening in der UI öffnet ein Hörfenster von 5 s (Diktat bis 8 s).', 'Start Listening in the UI opens a 5 s listening window (dictation up to 8 s).']),
            S('mic>wh', ['audio_listener liest das Mikrofon und streamt das Audio an Whisper.', 'audio_listener reads the microphone and streams the audio to Whisper.']),
            S('vcl>wh', ['Der Listener startet die Transkription als Action und wartet auf den Text.', 'The listener starts the transcription as an action and waits for the text.']),
            S('wh>vcl', ['Whisper liefert den Text; Regex-Muster für Deutsch und Englisch ordnen ihn einem Befehl zu.', 'Whisper returns the text; regex patterns for German and English map it to a command.']),
            S('vcl>ui', ['Der erkannte Befehl geht an die UI; danach gilt 3 s Cooldown gegen Doppelauslösung.', 'The detected command goes to the UI; then a 3 s cooldown prevents double triggering.']),
            S('ui>mh', ['Die UI zeigt das Bestätigungs-Popup; erst „Bestätigen“ startet die Fahrt (Auto-Move aus).', 'The UI shows the confirm popup; only “Confirm” starts the motion (auto-move off).'])]),
          SC('stop', ['E-STOP per Stimme', 'Voice E-STOP'], 'i-stop', 'red', ['„E-STOP“ wirkt direkt aus dem Listener, auch ohne offene UI. Der Befehl umgeht Cooldown und Popup und geht als E-STOP-Topic an den Motion Handler.', '“E-STOP” acts directly from the listener, even without an open UI. The command skips cooldown and popup and goes to the motion handler as the E-STOP topic.'], [
            S('mic>wh', ['audio_listener liest das Mikrofon und streamt das Audio an Whisper.', 'audio_listener reads the microphone and streams the audio to Whisper.']),
            S('wh>vcl', ['Whisper liefert den Text, die Regex erkennt „E-STOP“; dafür gilt kein Cooldown.', 'Whisper returns the text, the regex detects “E-STOP”; no cooldown applies.']),
            S('vcl>mh', ['Der Listener publiziert den E-STOP selbst; der Motion Handler verriegelt wie beim roten Knopf.', 'The listener publishes the E-STOP itself; the motion handler latches as with the red button.'])])],
      },
    },
    gaze: {
      t: ['Blicksteuerung (Tobii)', 'Gaze control (Tobii)'], hue: 'green', icon: 'i-eye', s: 'spr',
      d: ['Die Tobii Glasses 3 liefern Szenenvideo und Blickpunkt; vier ArUco-Marker rechnen ihn in Pixel der Oberfläche um, 1 s Verweilen löst einen Knopf aus. Die Blick-UI steuert wie jeder Client über Control-Lock und Twist-Gate; ohne frischen Blick stoppt die Fahrt nach 0,3 s.', 'The Tobii Glasses 3 deliver scene video and gaze point; four ArUco markers map it to interface pixels, and 1 s of dwell triggers a button. The gaze UI steers like any client via control lock and twist gate; without a fresh gaze the motion stops after 0.3 s.'],
      note: ['Blick-Greifen endet über dem Objekt (Hover); Greifen per Blick ist noch nicht umgesetzt.', 'Gaze grasp ends above the object (hover); grasping by gaze is not implemented yet.'],
      spec: {
        lanes: lanes(['eye', ['Brille', 'Glasses']], ['gz', ['Gaze-Nodes', 'Gaze nodes']], 'wd', ['mo', ['Roboter', 'Robot']]),
        nodes: [N('g3', 'eye', 0, { label: 'Tobii Glasses 3', short: 'Tobii', sub: 'RTSP :8554', icon: 'i-eye', hue: 'green', info: ['Szenenvideo und Blickpunkt (gaze2d) als RTSP-Stream.', 'Scene video and gaze point (gaze2d) as an RTSP stream.'] }),
          N('gui', 'gz', 0, { label: ['Blick-UI', 'Gaze UI'], short: 'Gaze', sub: 'gaze_ui · ArUco', icon: 'i-eye', hue: 'teal', info: ['PyQt5-Oberfläche: Verweil-Knöpfe, Homographie aus 4 ArUco-Markern, Bremszone ab 40 mm.', 'PyQt5 interface: dwell buttons, homography from 4 ArUco markers, brake zone from 40 mm.'] }),
          N('gg', 'gz', 1.5, { label: ['Blick-Greifen', 'Gaze grasp'], short: ['Greif.', 'Grasp'], sub: 'gaze_grasp_routine', icon: 'i-grip', hue: 'teal', info: ['YOLO-Objekt 2 s fixieren: Der Arm fährt über das Objekt (Hover).', 'Fixate a YOLO object for 2 s: the arm moves above it (hover).'] }),
          N('wd', 'wd', 0), N('mo', 'mo', 0, { label: ['Servo · Motion Handler', 'Servo · motion handler'], short: 'Motion', sub: '/servo_server · /ui/*', icon: 'i-gizmo', hue: 'indigo' })],
        edges: [E('g3', 'gui', ['Video + Blickpunkt', 'Video + gaze point'], { kind: 'stream' }), E('g3', 'gg', ['Video (RTSP)', 'Video (RTSP)'], { kind: 'stream', ports: 'bl' }), E('gui', 'wd', '/remote/twist'),
          R('wd', 'gui', '/remote/control_state'), E('wd', 'mo', '/servo_server/delta_twist_cmds'), E('gg', 'mo', '/ui/execute_move_to_pose', { kind: 'service', ports: 'rb' })],
        scenarios: [
          SC('btn', ['Blick-Knöpfe', 'Gaze buttons'], 'i-eye', 'green', ['Einen Richtungsknopf 1 s ansehen: Der Arm fährt in diese Richtung, solange der Blick dort bleibt. Vorher fragt GAZE ON die Steuerung am Roboter-PC an.', 'Look at a direction button for 1 s: the arm moves that way as long as the gaze stays there. Before that, GAZE ON requests control on the robot PC.'], [
            S('g3>gui', ['Die Blick-UI rechnet den Blickpunkt über eine Homographie aus 4 ArUco-Markern in Pixel der Oberfläche.', 'The gaze UI maps the gaze point to interface pixels via a homography from 4 ArUco markers.']),
            S('gui>wd', ['GAZE ON stellt eine Anfrage an den Watchdog, wie jeder andere Client.', 'GAZE ON sends a request to the watchdog, like any other client.'], { topic: '/remote/control_request' }),
            S('wd>gui', ['Erst nach Allow am Roboter-PC wird die Blick-UI Besitzer der Steuerung.', 'Only after Allow on the robot PC does the gaze UI own control.']),
            S('gui>wd', ['Nach 1,0 s Fixieren sendet der Knopf einen Twist; nahe der Tischplatte bremst die Blick-UI ab 40 mm.', 'After 1.0 s of fixation the button sends a twist; near the table the gaze UI brakes from 40 mm.']),
            S('wd>mo', ['Das Twist-Gate prüft Besitz, Heartbeat und E-STOP wie bei jedem Client, dann fährt Servo.', 'The twist gate checks ownership, heartbeat and E-STOP as for any client, then Servo moves.'])]),
          SC('grasp', ['Blick-Greifen', 'Gaze grasp'], 'i-grip', 'teal', ['Ein von YOLO erkanntes Objekt 2 s ansehen: Der Arm fährt über das Objekt und bleibt dort (Hover). Das Greifen selbst per Blick ist noch nicht umgesetzt.', 'Look at an object detected by YOLO for 2 s: the arm moves above it and stays there (hover). Grasping itself by gaze is not implemented yet.'], [
            S('g3>gg', ['Die Routine erkennt im Szenenvideo YOLO-Objekte; 2 s Fixieren wählt eines aus.', 'The routine detects YOLO objects in the scene video; 2 s of fixation selects one.']),
            S('gg>mo', ['Der Arm fährt in die Scan-Pose, wartet 3 s und verortet das Objekt über die 12 ArUco-Marker auf dem Tisch.', 'The arm moves to the scan pose, waits 3 s and locates the object via the 12 ArUco markers on the table.']),
            S('gg>mo', ['Danach fährt der Arm per MoveTo direkt über das Objekt und hält dort (Hover).', 'Then the arm moves via MoveTo directly above the object and holds there (hover).'])])],
      },
    },
    touch: {
      t: ['UX | Compact Interface: Bedienen am Roboter', 'UX | Compact Interface: operate at the robot'], hue: 'accent', icon: 'i-touch', s: 'spr',
      d: ['Ein Chrome-Kiosk unter /touch der UX | Nexus Launcher bündelt Jogging, Zielposen, Greifer, Sequenzen und den Start der Launches. Der E-STOP ist immer sichtbar; bewegen darf das Panel erst, wenn der Roboter-PC die Steuerung per Allow freigibt.', 'A Chrome kiosk at /touch of the UX | Nexus Launcher combines jogging, target poses, gripper, sequences and starting the launches. The E-STOP is always visible; the panel may move the arm only after the robot PC grants control via Allow.'],
      spec: {
        lanes: lanes(['tp', ['UX | Compact Interface', 'UX | Compact Interface']], ['nx', ['UX | Nexus Launcher', 'UX | Nexus Launcher']], 'br', 'wd', ['mo', ['Roboter', 'Robot']]),
        nodes: [N('tp', 'tp', 0, { label: 'UX | Compact Interface', short: 'Touch', sub: '/touch · Kiosk', icon: 'i-touch', hue: 'accent', info: ['Chrome-Kiosk: Tabs Move, Programs, Robot, Launch, System; E-STOP immer sichtbar.', 'Chrome kiosk: tabs Move, Programs, Robot, Launch, System; E-STOP always visible.'] }),
          N('nx', 'nx', 1.5, { label: 'UX | Nexus Launcher', short: 'Nexus', sub: ':8080 · Blueprint', icon: 'i-layers', hue: 'accent', info: ['Startet und stoppt Karten; POST nur von Loopback und eigener Origin.', 'Starts and stops cards; POST only from loopback and the own origin.'] }),
          N('rb', 'br', 0), N('wd', 'wd', 0), N('mo', 'mo', 0, { label: ['Motion Handler · Servo', 'Motion handler · Servo'], short: 'Motion', sub: '/ui/* · /servo_server', icon: 'i-gizmo', hue: 'indigo' })],
        edges: [E('tp', 'rb', '/ui/emergency_stop_topic'), E('rb', 'wd', '/remote/twist'), E('wd', 'mo', '/servo_server/delta_twist_cmds'), R('rb', 'mo', '/ui/emergency_stop_topic'),
          E('tp', 'nx', 'HTTP /api/run', { kind: 'service' }), R('rb', 'tp', '/ui/emergency_stop_active')],
        scenarios: [SC('touch', ['UX | Compact Interface', 'UX | Compact Interface'], 'i-touch', 'accent', ['E-STOP, Steuerung anfragen, Jogging, Launches starten: alles direkt am Roboter, mit denselben Regeln wie ein entfernter Client.', 'E-STOP, request control, jogging, starting launches: all right at the robot, with the same rules as a remote client.'], [
          S('tp>rb', ['Der E-STOP ist auf jedem Tab sichtbar und löst bei der ersten Berührung aus.', 'The E-STOP is visible on every tab and fires on the first touch.'], { also: ['rb>mo'] }),
          S('tp>rb', ['Das Panel fragt die Steuerung an; es gilt nie als Server, der Roboter-PC muss per Allow freigeben.', 'The panel requests control; it never counts as the server, so the robot PC must grant it via Allow.'], { topic: '/remote/control_request' }),
          S('rb>wd', ['Jogging-Befehle tragen die Client-id, der Heartbeat kommt alle 250 ms.', 'Jogging commands carry the client id; the heartbeat comes every 250 ms.']),
          S('wd>mo', ['Das Twist-Gate prüft Besitz, Heartbeat, Tempo und Bodensperre, bevor Servo fährt.', 'The twist gate checks ownership, heartbeat, speed and floor guard before Servo moves.']),
          S('rb>tp', ['Der E-STOP-Zustand kommt zurück ans Panel; Quittieren verlangt 1 s Halten gegen Fehlberührung.', 'The E-STOP state returns to the panel; resetting requires a 1 s hold against accidental touches.']),
          S('tp>nx', ['Der Launch-Tab startet Karten der UX | Nexus Launcher; POST nimmt der Server nur von Loopback und eigener Origin an.', 'The Launch tab starts UX | Nexus Launcher cards; the server accepts POST only from loopback and its own origin.'])])],
      },
    },

    // ─────────── Sicherheit ───────────
    remote: {
      t: ['Remote Control: genau ein Besitzer', 'Remote control: exactly one owner'], hue: 'gold', icon: 'i-lock', s: 'spr',
      d: ['Laptop, Tablet, UX | Compact Interface oder Quest 3 fragen an, die UX | Control Interface auf dem Roboter-PC gibt per Allow frei. Genau ein Gerät steuert, ein WLAN-Aussetzer stoppt nur die Bewegung (der Besitz hält 10 s), und der E-STOP geht immer.', 'Laptop, tablet, UX | Compact Interface or Quest 3 request control; the UX | Control Interface on the robot PC grants it via Allow. Exactly one device controls, a Wi-Fi dropout only stops the motion (ownership holds for 10 s), and the E-STOP always works.'],
      spec: {
        lanes: lanes('cl', 'br', 'wd', ['pc', ['Roboter-PC', 'Robot PC']], 'mo'),
        nodes: [N('ui', 'cl', 0, { label: ['UX | Control Interface (Client)', 'UX | Control Interface (client)'], short: 'Client', sub: 'Laptop · Tablet' }), N('rb', 'br', 0), N('wd', 'wd', 0),
          N('srvui', 'pc', 1.5, { of: 'ui', label: ['UX | Control Interface (Server)', 'UX | Control Interface (server)'], short: 'Server', sub: ['Roboter-PC · Token', 'robot PC · token'], hue: 'gold', info: ['Zeigt Allow/Deny und signiert die Antwort mit dem Server-Token (HMAC-SHA256, nur über Loopback).', 'Shows Allow/Deny and signs the answer with the server token (HMAC-SHA256, loopback only).'] }),
          N('srv', 'mo', 0)],
        edges: [E('ui', 'rb', '/remote/control_request'), E('rb', 'wd', '/remote/control_request'), E('wd', 'srvui', '/remote/control_state'), E('srvui', 'wd', ['/remote/control_request (signiert)', '/remote/control_request (signed)']),
          R('wd', 'ui', '/remote/control_state'), E('wd', 'srv', '/servo_server/delta_twist_cmds')],
        scenarios: [SC('req', ['Steuerung anfragen', 'Request control'], 'i-lock', 'gold', ['Anfrage, Freigabe am Roboter-PC, dann Jogging nur vom Besitzer. Ihre Server-Rolle beweist die UI mit einem Token, das nie über rosbridge geht.', 'Request, approval on the robot PC, then jogging only from the owner. The UI proves its server role with a token that never travels over rosbridge.'], [
          S('ui>rb', ['Der Client fragt per Knopf „Request control“ an oder automatisch beim ersten Bedienversuch.', 'The client asks via the “Request control” button or automatically on the first attempt to operate.']),
          S('rb>wd', ['Der Watchdog legt eine offene Anfrage an; ohne Antwort verfällt sie nach 60 s.', 'The watchdog creates a pending request; without an answer it expires after 60 s.']),
          S('wd>srvui', ['Die UX | Control Interface am Roboter-PC zeigt ein Popup mit Allow und Deny.', 'The UX | Control Interface on the robot PC shows a popup with Allow and Deny.']),
          S('srvui>wd', ['Die Antwort ist mit HMAC-SHA256 signiert und höchstens 5 s alt; das Token gibt der UI-Server nur an 127.x heraus.', 'The answer is signed with HMAC-SHA256 and at most 5 s old; the UI server hands out the token only to 127.x.']),
          S('wd>ui', ['Der Zustand nennt genau einen Besitzer; alle anderen Clients sehen zu und können selbst anfragen.', 'The state names exactly one owner; all other clients watch and may request themselves.']),
          S('ui>rb', ['Jogging-Befehle tragen die Client-id; der Watchdog verwirft alles, was nicht vom Besitzer kommt.', 'Jogging commands carry the client id; the watchdog drops everything that does not come from the owner.'], { topic: '/remote/twist', also: ['rb>wd'] }),
          S('wd>srv', ['Das Twist-Gate begrenzt Tempo (REAL 50 %) und Abwärtsfahrt und sperrt bei E-STOP, dann fährt Servo.', 'The twist gate limits speed (REAL 50 %) and downward motion and blocks on E-STOP, then Servo moves.'])])],
      },
    },
    heartbeat: {
      t: ['Heartbeat: Totmann für Gamepad und Jogging', 'Heartbeat: dead man for gamepad and jogging'], hue: 'gold', icon: 'i-pulse', s: 'sr',
      d: ['Tab zu, Laptop zugeklappt oder WLAN weg: Ohne Heartbeat setzt der Watchdog Gamepad und Jogging auf null, im REAL-Modus schon nach 0,4 s, in FAKE nach 1,0 s. Ein verdeckter Tab meldet sich nur noch als anwesend und zählt nicht als Heartbeat für Bewegung.', 'Tab closed, laptop shut or Wi-Fi lost: without a heartbeat the watchdog sets gamepad and jogging to zero, after just 0.4 s in REAL mode and 1.0 s in FAKE. A hidden tab only reports presence and does not count as a heartbeat for motion.'],
      note: ['Stoppt Gamepad und Jogging. Eine geplante MoveIt-Fahrt läuft weiter; dafür gibt es den E-STOP.', 'Stops gamepad and jogging. A planned MoveIt motion continues; that is what the E-STOP is for.'],
      loop: { t: ['Heartbeat → Watchdog', 'Heartbeat → watchdog'], s: 'remote_control_watchdog',
        st: [[['Senden', 'Send'], ['Browser · 250 ms', 'browser · 250 ms']], [['Empfangen', 'Receive'], ['Watchdog merkt Zeit', 'watchdog stores time']], [['Prüfen', 'Check'], ['alle 50 ms', 'every 50 ms']],
          [['Stoppen', 'Stop'], ['/joy neutral · Null-Twist', '/joy neutral · zero twist']], [['Melden', 'Report'], ['/remote/control_state', '/remote/control_state']]],
        back: { from: 2, to: 0, t: ['frisch: kein Eingriff, nächster Takt', 'fresh: no action, next beat'] } },
      spec: {
        lanes: lanes('cl', 'br', 'wd', ['mo', ['Gamepad · Servo', 'Gamepad · Servo']]),
        nodes: [N('ui', 'cl', 0), N('rb', 'br', 0), N('wd', 'wd', 0),
          N('out', 'mo', 0, { label: ['Gamepad-Kette · Servo', 'Gamepad chain · Servo'], short: ['Stopp', 'Stop'], sub: '/joy · /servo_server', icon: 'i-pad', hue: 'indigo', info: ['Bekommt neutrales /joy bzw. einen Null-Twist, sobald der Heartbeat zu alt ist.', 'Receives a neutral /joy or a zero twist as soon as the heartbeat is too old.'] })],
        edges: [E('ui', 'rb', '/remote/heartbeat'), E('rb', 'wd', '/remote/heartbeat'), E('wd', 'out', ['/joy neutral · Null-Twist', '/joy neutral · zero twist']), R('wd', 'ui', '/remote/control_state')],
        scenarios: [SC('hb', ['Heartbeat', 'Heartbeat'], 'i-pulse', 'gold', ['Der Browser meldet sich laufend beim Watchdog; bleibt er stumm, stoppt der Watchdog selbst. Die Sicherheit liegt damit auf dem Roboter-PC, nicht im Browser.', 'The browser keeps reporting to the watchdog; if it goes silent, the watchdog stops on its own. Safety thus sits on the robot PC, not in the browser.'], [
          S('ui>rb', ['Die UI sendet alle 250 ms einen Heartbeat, mit aktivem Gamepad alle 100 ms.', 'The UI sends a heartbeat every 250 ms, every 100 ms with an active gamepad.']),
          S('rb>wd', ['Der Watchdog speichert je Client den Zeitpunkt und prüft alle 50 ms, wie alt er ist.', 'The watchdog stores the time per client and checks its age every 50 ms.']),
          S('wd>out', ['Ist der Heartbeat zu alt (FAKE 1,0 s, REAL 0,4 s), gehen neutrales /joy und ein Null-Twist raus.', 'If the heartbeat is too old (FAKE 1.0 s, REAL 0.4 s), a neutral /joy and a zero twist go out.']),
          S('wd>ui', ['Der Control-Zustand nennt den Grund „heartbeat timeout“, die UI zeigt ihn an.', 'The control state names the reason “heartbeat timeout” and the UI displays it.']),
          S('ui>rb', ['Kommt der Heartbeat innerhalb von 10 s zurück, behält der Client die Steuerung und kann wieder fahren.', 'If the heartbeat returns within 10 s, the client keeps control and can move again.'])])],
      },
    },
    estop: {
      t: ['E-STOP: stoppen und quittieren', 'E-STOP: stop and reset'], hue: 'red', icon: 'i-stop', s: 'sr',
      d: ['Der E-STOP wirkt immer, von jedem Gerät und auch ohne Steuerung: Der Motion Handler verriegelt, stoppt Servo und bricht laufende Fahrten und KI-Aufgaben ab. Quittieren darf nur der Besitzer der Steuerung oder der Roboter-PC, über den Watchdog.', 'The E-STOP always works, from every device and even without control: the motion handler latches, stops Servo and aborts running motions and AI tasks. Only the owner of control or the robot PC may reset it, via the watchdog.'],
      note: ['Der Software-E-STOP ergänzt den Hardware-E-STOP am Roboter, er ersetzt ihn nicht.', 'The software E-STOP complements the hardware E-STOP on the robot; it does not replace it.'],
      spec: {
        lanes: lanes(['in', ['Auslöser', 'Triggers']], 'br', ['mo', ['Motion Handler', 'Motion handler']], 'hw', ['ai', ['Abnehmer', 'Consumers']]),
        nodes: [N('trig', 'in', 0, { label: ['E-STOP-Quellen', 'E-STOP sources'], short: 'E-STOP', sub: ['Knopf · Touch · VR · Sprache', 'button · touch · VR · voice'], icon: 'i-stop', hue: 'red', info: ['Header-Knopf, Leertaste, UX | Compact Interface, VR-Geste und Sprache senden denselben Stopp.', 'Header button, space bar, UX | Compact Interface, VR gesture and voice send the same stop.'] }),
          N('rb', 'br', 0), N('mh', 'mo', 0), N('wd', 'mo', 1.5), N('arm', 'hw', 0), N('vb', 'ai', 1.5)],
        edges: [E('trig', 'rb', '/ui/emergency_stop_topic'), E('rb', 'mh', '/ui/emergency_stop_topic'), E('mh', 'arm', ['Halt · Halte-Trajektorie', 'Halt · hold trajectory']),
          E('mh', 'vb', '/ui/emergency_stop_active', { ports: 'bt' }), E('mh', 'wd', '/ui/emergency_stop_active'),
          E('trig', 'wd', ['/remote/control_request (reset_estop)', '/remote/control_request (reset_estop)'], { ports: 'bl' }), E('wd', 'mh', '/ui/reset_emergency_stop', { kind: 'service' })],
        scenarios: [
          SC('stop', 'E-STOP', 'i-stop', 'red', ['Ein Druck stoppt alles: verriegelt, Servo aus, laufende KI-Aufgabe abgebrochen. Der Zustand geht latched an alle Abnehmer, auch spät verbundene Clients sehen ihn.', 'One press stops everything: latched, Servo off, running AI task aborted. The state goes latched to all consumers; late-joining clients see it too.'], [
            S('trig>rb', ['Header-Knopf, Leertaste, UX | Compact Interface, VR-Geste und Sprache senden dasselbe Stopp-Topic.', 'Header button, space bar, UX | Compact Interface, VR gesture and voice send the same stop topic.']),
            S('rb>mh', ['Ein Topic statt Service: Der Stopp wartet nie hinter anderen Anfragen in einer Warteschlange.', 'A topic instead of a service: the stop never waits behind other requests in a queue.']),
            S('mh>arm', ['Der Motion Handler verriegelt, bricht die laufende Bahn ab und schaltet Servo aus; der Arm hält.', 'The motion handler latches, aborts the running path and switches Servo off; the arm holds.']),
            S('mh>vb', ['Der KI-Agent bricht die laufende Aufgabe ab, der Watchdog sperrt jedes weitere Jogging.', 'The AI agent aborts the running task; the watchdog blocks any further jogging.'], { also: ['mh>wd'] })]),
          SC('reset', ['Quittieren', 'Reset'], 'i-lock', 'gold', ['Nur der Besitzer der Steuerung oder der Roboter-PC quittiert, immer über den Watchdog. Den Reset-Service direkt aufrufen kann kein Browser, die rosbridge-Whitelist sperrt ihn.', 'Only the owner of control or the robot PC resets, always via the watchdog. No browser can call the reset service directly; the rosbridge whitelist blocks it.'], [
            S('trig>wd', ['Quittieren per Knopf in der UI oder am UX | Compact Interface durch 1 s Halten; gesendet wird reset_estop.', 'Reset via the button in the UI or by a 1 s hold on the UX | Compact Interface; reset_estop is sent.']),
            S('wd>mh', ['Der Watchdog lässt nur Besitzer oder verifizierten Server zu und ruft dann den Reset-Service auf.', 'The watchdog admits only the owner or the verified server and then calls the reset service.']),
            S('mh>wd', ['Der Motion Handler hebt die Verriegelung auf und startet Servo; das Ergebnis steht im Control-Zustand.', 'The motion handler releases the latch and restarts Servo; the result shows in the control state.'])])],
      },
    },

    // ─────────── Digital Twin ───────────
    feedback: {
      t: ['Rückmeldung: der Twin spiegelt den Arm', 'Feedback: the twin mirrors the arm'], hue: 'teal', icon: 'i-cube', s: 'sr',
      d: ['Der echte Zustand fließt zurück: ros2_control liest die sechs Gelenkwinkel mit 250 Hz und publiziert sie als /joint_states. Digital Twin, UX | Monitoring und Blackbox lesen dasselbe Topic, damit alle Ansichten denselben Arm zeigen.', 'The real state flows back: ros2_control reads the six joint angles at 250 Hz and publishes them as /joint_states. Digital Twin, UX | Monitoring and blackbox read the same topic, so every view shows the same arm.'],
      spec: {
        lanes: lanes('hw', ['drv', ['Treiber', 'Driver']], 'br', ['ui', ['Browser', 'Browser']]),
        nodes: [N('arm', 'hw', 0), N('drv', 'drv', 0, { label: ['Treiber · Controller', 'Driver · controller'], short: ['Treiber', 'Driver'], sub: 'xarm_ros2 · 250 Hz', icon: 'i-chip', hue: 'indigo', info: ['ros2_control mit 250 Hz; REAL über den Treiber, FAKE über simulierte Controller.', 'ros2_control at 250 Hz; REAL via the driver, FAKE via simulated controllers.'] }),
          N('rb', 'br', 0), N('tw', 'ui', 0, { label: 'Digital Twin', short: 'Twin', sub: 'three.js · URDF', icon: 'i-cube', hue: 'teal', info: ['Lite-6-URDF im Browser; setzt 6 Gelenke aus /joint_states.', 'Lite 6 URDF in the browser; sets 6 joints from /joint_states.'] }),
          N('mon', 'drv', 1.5, { label: 'UX | Monitoring', short: 'Mon.', sub: ':8083', icon: 'i-chart', hue: 'indigo', info: ['Zählt Gelenkwege und Fahrzeiten.', 'Counts joint paths and motion times.'] }),
          N('bb', 'br', 1.5, { label: ['Blackbox · Demo', 'Blackbox · demo'], short: 'BB', sub: 'robot_blackbox_recorder', icon: 'i-db', hue: 'teal', info: ['Ringpuffer der letzten 60 s und Demo-Aufnahme.', 'Ring buffer of the last 60 s and demo recording.'] })],
        edges: [E('arm', 'drv', ['Gelenkwinkel', 'Joint angles']), E('drv', 'rb', '/joint_states'), E('rb', 'tw', '/joint_states'), E('drv', 'mon', '/joint_states'), E('drv', 'bb', '/joint_states', { ports: 'bt' })],
        scenarios: [SC('fb', ['Rückmeldung', 'Feedback'], 'i-loop', 'teal', ['Gelenkwinkel aus dem Arm erreichen Twin, Dashboard und Blackbox. In FAKE kommen sie aus den simulierten Controllern, der Weg bleibt derselbe.', 'Joint angles from the arm reach twin, dashboard and blackbox. In FAKE they come from the simulated controllers; the path stays the same.'], [
          S('arm>drv', ['Der Treiber liest die Gelenkwinkel aus dem Arm, in FAKE liefern sie die simulierten Controller.', 'The driver reads the joint angles from the arm; in FAKE the simulated controllers deliver them.']),
          S('drv>rb', ['Ein einziges Topic für den ganzen Graphen; MoveIt, Servo und alle Oberflächen lesen dieselben Werte.', 'A single topic for the whole graph; MoveIt, Servo and all interfaces read the same values.']),
          S('rb>tw', ['Für den Browser gedrosselt auf 33 ms; der Twin setzt damit die 6 Gelenke des Lite-6-URDF.', 'Throttled to 33 ms for the browser; the twin uses it to set the 6 joints of the Lite 6 URDF.']),
          S('drv>mon', ['Nebenast: Das UX | Monitoring summiert Gelenkwege und Fahrzeiten.', 'Side branch: the UX | Monitoring sums up joint paths and motion times.']),
          S('drv>bb', ['Nebenast: Die Blackbox puffert die letzten 60 s, der Demo-Recorder zeichnet Vorführungen auf.', 'Side branch: the blackbox buffers the last 60 s, the demo recorder captures demonstrations.'])])],
      },
    },
    sandbox: {
      t: ['Physik-Sandbox und virtuelle Objekte', 'Physics sandbox and virtual objects'], hue: 'teal', icon: 'i-cube', s: 'sp',
      d: ['Die Physik-Engine Rapier rechnet Schwerkraft, Reibung und Vakuum-Greifen direkt im Browser. Liegende Objekte gehen als statisches TF an virtual_object_detections und erscheinen für MoveIt und den KI-Agenten wie echte YOLO-Detektionen.', 'The Rapier physics engine computes gravity, friction and vacuum grasping right in the browser. Settled objects go as static TF to virtual_object_detections and look like real YOLO detections to MoveIt and the AI agent.'],
      note: ['Sandbox nur im FAKE-Modus; virtuelle Detektionen sind standardmäßig aus und werden bewusst eingeschaltet.', 'Sandbox in FAKE mode only; virtual detections are off by default and switched on deliberately.'],
      spec: {
        lanes: lanes('ui', 'br', ['vis', ['Erkennung', 'Detection']], 'mv'),
        nodes: [N('sbx', 'ui', 0, { label: ['Physik-Sandbox', 'Physics sandbox'], short: ['Physik', 'Physics'], sub: 'Rapier 0.21 · Browser', icon: 'i-cube', hue: 'teal', info: ['Rapier-WASM im Browser: Schwerkraft, Reibung, Vakuum-Greifen; meldet das gehaltene Objekt.', 'Rapier WASM in the browser: gravity, friction, vacuum grasp; reports the held object.'] }),
          N('tun', 'ui', 1.5, { label: 'TF-Tuner', short: 'TF', sub: 'tf_tuner.js', icon: 'i-gizmo', hue: 'teal', info: ['Posen der Objekte als statisches TF; Save speichert auf dem PC.', 'Object poses as static TF; Save stores on the PC.'] }),
          N('rb', 'br', 0), N('vod', 'vis', 0, { label: ['Virtuelle Detektion', 'Virtual detection'], short: 'Virt.', sub: 'virtual_object_detections', icon: 'i-eye', hue: 'green', info: ['Macht aus TF-Frames Detektionen wie YOLO (IDs ab 901), 5 Hz, Standard aus.', 'Turns TF frames into YOLO-like detections (IDs from 901), 5 Hz, off by default.'] }),
          N('ycol', 'vis', 1.5, { label: ['Kollisionsobjekte', 'Collision objects'], short: 'Coll.', sub: 'yolo_moveit_collision', icon: 'i-cube', hue: 'green', info: ['Jede Box wird eine offene Kiste aus Wänden in MoveIt.', 'Each box becomes an open box of walls in MoveIt.'] }),
          N('mg', 'mv', 0)],
        edges: [E('sbx', 'tun', ['Pose zurück (z = Unterkante)', 'Pose back (z = bottom)']), E('tun', 'rb', '/tf_static', { ports: 'rb' }), E('rb', 'vod', '/tf_static'), E('vod', 'ycol', '/zed/bboxes_3d'),
          E('ycol', 'mg', '/collision_object', { ports: 'rb' }), E('sbx', 'rb', '/planning_scene'), R('rb', 'mg', '/planning_scene')],
        scenarios: [SC('sb', ['Sandbox', 'Sandbox'], 'i-cube', 'teal', ['Objekte fallen, kommen zur Ruhe, werden „erkannt“ und zum Hindernis für MoveIt. Auch das gehaltene Objekt kennt MoveIt, als Diff der Planungsszene.', 'Objects fall, come to rest, get “detected” and become obstacles for MoveIt. MoveIt also knows the held object, as a planning scene diff.'], [
          S('sbx>tun', ['Rapier lässt die Körper fallen; die Ruhepose geht mit z = Unterkante an den TF-Tuner.', 'Rapier lets the bodies fall; the resting pose goes to the TF tuner with z = bottom.']),
          S('tun>rb', ['Der TF-Tuner publiziert jede Pose als statisches TF, latched für spät verbundene Nodes.', 'The TF tuner publishes each pose as static TF, latched for late-joining nodes.']),
          S('rb>vod', ['virtual_object_detections liest die Frames mit 5 Hz, aber nur, wenn virtuelle Detektionen eingeschaltet sind.', 'virtual_object_detections reads the frames at 5 Hz, but only when virtual detections are switched on.']),
          S('vod>ycol', ['Er publiziert sie wie YOLO als 3D-Boxen, mit IDs ab 901 zur Unterscheidung von echten Objekten.', 'It publishes them like YOLO as 3D boxes, with IDs from 901 to tell them apart from real objects.']),
          S('ycol>mg', ['yolo_moveit_collision baut aus jeder Box eine oben offene Kiste aus Wänden, damit der Greifer hineinfahren darf.', 'yolo_moveit_collision builds an open-top box of walls from each box, so the gripper may reach in.']),
          S('sbx>rb', ['Die Sandbox meldet das gehaltene Objekt als Diff der Planungsszene, damit MoveIt es bei der Planung berücksichtigt.', 'The sandbox reports the held object as a planning scene diff, so MoveIt accounts for it when planning.'], { also: ['rb>mg'] })])],
      },
    },
    scene: {
      t: ['Szenen und Logistik-Zelle', 'Scenes and logistics cell'], hue: 'teal', icon: 'i-layers', s: 'sr',
      d: ['Drei Szenen: Standard, Logistik – automatisch palettieren (Europalette, Förderbänder, Zaun) und Intralogistik – AMR (nur FAKE). virtual_object_detections hält den Zustand latched für alle Clients und meldet Zaun und Bänder alle 5 s als Hindernis an MoveIt.', 'Three scenes: Standard, Logistics – auto palletizing (euro pallet, conveyor belts, fence) and Intralogistics – AMR (FAKE only). virtual_object_detections keeps the state latched for all clients and reports fence and belts to MoveIt as obstacles every 5 s.'],
      spec: {
        lanes: lanes('ui', 'br', ['vis', ['Szenen-Node', 'Scene node']], 'mv'),
        nodes: [N('scn', 'ui', 0, { label: ['Szenen-Wahl', 'Scene picker'], short: ['Szene', 'Scene'], sub: 'scenes.js', icon: 'i-layers', hue: 'teal', info: ['Wählt Standard oder Palettieren; Kollision je Teil (Bänder, Zaun) schaltbar.', 'Picks standard or palletizing; collision per part (belts, fence) switchable.'] }),
          N('api', 'ui', 1.5, { label: ['UI-Server', 'UI server'], short: 'Server', sub: ':8081 · tf_tuner.json', icon: 'i-db', hue: 'teal', info: ['Speichert die Tuner-Werte in ~/.config/robot_control_ui/tf_tuner.json.', 'Stores tuner values in ~/.config/robot_control_ui/tf_tuner.json.'] }),
          N('rb', 'br', 0), N('vod', 'vis', 0, { label: ['Szenen-Node', 'Scene node'], short: ['Szene', 'Scene'], sub: 'virtual_object_detections', icon: 'i-eye', hue: 'green', info: ['Hält Szene und Objektzustand, latched für alle Clients.', 'Owns scene and object state, latched for all clients.'] }), N('mg', 'mv', 0)],
        edges: [E('scn', 'rb', '/ui/set_virtual_objects'), E('rb', 'vod', '/ui/set_virtual_objects'), R('vod', 'rb', '/ui/virtual_scene'), E('vod', 'mg', '/planning_scene'), E('scn', 'api', 'HTTP /api/tf_tuner', { kind: 'service' })],
        scenarios: [SC('sc', ['Szene wechseln', 'Switch scene'], 'i-layers', 'teal', ['Szene wählen; alle Clients und MoveIt sehen dieselbe Zelle. Die Kollision lässt sich je Teil schalten, z. B. nur der Zaun.', 'Pick a scene; all clients and MoveIt see the same cell. Collision can be switched per part, e.g. the fence only.'], [
          S('scn>rb', ['In der Szenen-Wahl Standard oder Palettieren wählen; die Kollision je Teil ist schaltbar.', 'Pick standard or palletizing in the scene picker; collision per part is switchable.']),
          S('rb>vod', ['Der Szenen-Node tauscht die Objekte und ist die einzige Quelle für den Szenenzustand.', 'The scene node swaps the objects and is the only source of the scene state.']),
          S('vod>rb', ['Der Zustand geht latched zurück; auch ein später geöffneter Browser zeigt dieselbe Szene.', 'The state returns latched; even a browser opened later shows the same scene.']),
          S('vod>mg', ['Zaun und Bänder kommen als Kollisionsobjekte in die Planungsszene, erneuert alle 5 s.', 'Fence and belts enter the planning scene as collision objects, renewed every 5 s.']),
          S('scn>api', ['Save im TF-Tuner speichert feinjustierte Posen auf dem Roboter-PC, sie gelten nach einem Neustart weiter.', 'Save in the TF tuner stores fine-tuned poses on the robot PC; they persist after a restart.'])])],
      },
    },
    reach: {
      t: ['Reichweite und Abstand-Heatmap', 'Reach and proximity heatmap'], hue: 'teal', icon: 'i-globe', s: 'sr',
      d: ['Das Reachability-Volumen ist offline aus 2,5 Mio. Monte-Carlo-Proben vorberechnet und nach Manipulierbarkeit (Yoshikawa-Index) eingefärbt. Die Abstand-Heatmap färbt die Glieder live nach Abstand zur Z-Grenze, unter 15 mm rot.', 'The reachability volume is precomputed offline from 2.5 M Monte Carlo samples and tinted by manipulability (Yoshikawa index). The proximity heatmap tints the links live by distance to the Z limit, red below 15 mm.'],
      spec: {
        lanes: lanes(['off', ['Offline', 'Offline']], ['ui', ['Digital Twin', 'Digital Twin']], 'br', ['ros', ['ROS', 'ROS']]),
        nodes: [N('gen', 'off', 0, { label: ['Gitter-Generator', 'Grid generator'], short: 'Gen.', sub: 'generate_reachability_grid.py', icon: 'i-chip', hue: 'indigo', info: ['Monte-Carlo mit 2,5 Mio. Proben, schreibt reachability_data.js.', 'Monte Carlo with 2.5 M samples, writes reachability_data.js.'] }),
          N('rch', 'ui', 0, { label: ['Reachability-Volumen', 'Reachability volume'], short: 'Reach', sub: ['7888 Voxel · 1 Draw-Call', '7,888 voxels · 1 draw call'], icon: 'i-globe', hue: 'teal', info: ['Voxel nach Manipulierbarkeit eingefärbt, Standard aus.', 'Voxels tinted by manipulability, off by default.'] }),
          N('heat', 'ui', 1.5, { label: ['Abstand-Heatmap', 'Proximity heatmap'], short: 'Heat', sub: 'proximity_heat.js', icon: 'i-eye', hue: 'teal', info: ['Glieder färben sich nach Abstand zur Z-Grenze, rot unter 15 mm.', 'Links tint by distance to the Z limit, red below 15 mm.'] }),
          N('rb', 'br', 1.5), N('jts', 'ros', 1.5, { label: ['TCP-Pose', 'TCP pose'], short: 'TCP', sub: 'joy_to_servo_node · 10 Hz', icon: 'i-gizmo', hue: 'indigo', info: ['Publiziert /ui/eef_position aus TF link_base → link_tcp.', 'Publishes /ui/eef_position from TF link_base → link_tcp.'] })],
        edges: [E('gen', 'rch', ['reachability_data.js', 'reachability_data.js']), E('jts', 'rb', '/ui/eef_position'), E('rb', 'heat', '/ui/eef_position')],
        scenarios: [SC('r', ['Reichweite', 'Reach'], 'i-globe', 'teal', ['Das Volumen kommt einmal offline aus dem Generator, der Abstand live aus der TCP-Pose. Das Volumen ist standardmäßig aus und im Twin zuschaltbar.', 'The volume comes once offline from the generator, the distance live from the TCP pose. The volume is off by default and can be switched on in the twin.'], [
          S('gen>rch', ['Einmal offline: 2,5 Mio. Proben werden 7888 Voxel, gezeichnet in einem einzigen Draw-Call.', 'Once offline: 2.5 M samples become 7,888 voxels, drawn in a single draw call.']),
          S('jts>rb', ['joy_to_servo_node publiziert die TCP-Pose aus TF link_base → link_tcp mit 10 Hz.', 'joy_to_servo_node publishes the TCP pose from TF link_base → link_tcp at 10 Hz.']),
          S('rb>heat', ['Die Heatmap färbt jedes Glied nach seinem Abstand zur Z-Grenze, unter 15 mm rot.', 'The heatmap tints each link by its distance to the Z limit, red below 15 mm.'])])],
      },
    },

    // ─────────── Vision ───────────
    vision: {
      t: ['Kamera: aus Bild wird Hindernis', 'Camera: image becomes obstacle'], hue: 'green', icon: 'i-cam', s: 'pr',
      d: ['Die ZED Mini liefert Farbbild und Tiefe, YOLOv8 macht daraus mit etwa 2,5 Hz 3D-Boxen mit Greifkugeln. Jede Box wird ein Hindernis für MoveIt und ein mögliches Ziel für KI-Agent und Objektmenü.', 'The ZED Mini delivers colour image and depth; YOLOv8 turns them into 3D boxes with grasp spheres at about 2.5 Hz. Each box becomes an obstacle for MoveIt and a possible target for the AI agent and the object menu.'],
      note: ['Der OctoMap-Eingang in MoveIt ist standardmäßig aus (publish_moveit_cloud:=false).', 'The OctoMap input to MoveIt is off by default (publish_moveit_cloud:=false).'],
      spec: {
        lanes: lanes(['cam', ['Kamera', 'Camera']], ['perc', ['Wahrnehmung', 'Perception']], ['col', ['Kollision', 'Collision']], 'mv', ['use', ['Abnehmer', 'Consumers']]),
        nodes: [N('zed', 'cam', 0, { label: 'ZED Mini', short: 'ZED', sub: 'zed_wrapper', icon: 'i-cam', hue: 'green', info: ['Stereo-Kamera: Farbbild, Tiefe, Punktwolke (HD720).', 'Stereo camera: colour image, depth, point cloud (HD720).'] }),
          N('yolo', 'perc', 0, { label: 'YOLOv8', short: 'YOLO', sub: ['3D-Boxen · ~2,5 Hz', '3D boxes · ~2.5 Hz'], icon: 'i-eye', hue: 'green', info: ['YOLOv8l auf RGB + Tiefe, Konfidenz 0,35, liefert 3D-Boxen und Greifkugeln.', 'YOLOv8l on RGB + depth, confidence 0.35, delivers 3D boxes and grasp spheres.'] }),
          N('pco', 'perc', 1.5, { label: ['Punktwolke', 'Point cloud'], short: 'Cloud', sub: 'pointcloud_optimizer', icon: 'i-layers', hue: 'green', info: ['Bereitet die Wolke für die OctoMap auf.', 'Prepares the cloud for the OctoMap.'] }),
          N('ycol', 'col', 0, { label: ['Kollisionsobjekte', 'Collision objects'], short: 'Coll.', sub: 'yolo_moveit_collision', icon: 'i-cube', hue: 'green', info: ['Jede Box wird eine offene Kiste, damit der Greifer hinein darf.', 'Each box becomes an open box so the gripper may reach in.'] }),
          N('mg', 'mv', 0), N('use', 'use', 1.5, { label: ['UI · KI-Agent', 'UI · AI agent'], short: ['Nutzer', 'Users'], sub: 'grasp.js · vla_bridge', icon: 'i-spark', hue: 'violet', info: ['Objektliste und 3D-Overlay in der UI, Szene für den KI-Agenten.', 'Object list and 3D overlay in the UI, scene for the AI agent.'] })],
        edges: [E('zed', 'yolo', ['RGB + Tiefe', 'RGB + depth'], { kind: 'stream' }), E('zed', 'pco', '/zed/zed_node/point_cloud/cloud_registered', { kind: 'stream', ports: 'bl' }), E('yolo', 'ycol', '/zed/bboxes_3d'),
          E('ycol', 'mg', '/collision_object'), E('pco', 'mg', ['OctoMap (optional)', 'OctoMap (optional)'], { kind: 'stream', ports: 'rb' }), E('yolo', 'use', '/zed/bboxes_3d', { ports: 'bt' })],
        scenarios: [SC('cam', ['Kamera', 'Camera'], 'i-cam', 'green', ['Bild → 3D-Box → Kollisionsobjekt → Planung um das Hindernis. Die Punktwolke ist ein zweiter, optionaler Weg über die OctoMap.', 'Image → 3D box → collision object → planning around the obstacle. The point cloud is a second, optional path via the OctoMap.'], [
          S('zed>yolo', ['Die ZED Mini liefert Farbbild und Tiefenbild in HD720 an die Erkennung.', 'The ZED Mini delivers colour and depth images in HD720 to the detection.']),
          S('yolo>ycol', ['YOLOv8l erkennt Objekte ab Konfidenz 0,35 und publiziert 3D-Boxen mit Greifkugeln.', 'YOLOv8l detects objects from confidence 0.35 and publishes 3D boxes with grasp spheres.'], { also: ['yolo>use'] }),
          S('ycol>mg', ['yolo_moveit_collision baut aus jeder Box eine oben offene Kiste aus Wänden, damit der Greifer hineinfahren darf.', 'yolo_moveit_collision builds an open-top box of walls from each box, so the gripper may reach in.']),
          S('zed>pco', ['pointcloud_optimizer bereitet die registrierte Punktwolke für die OctoMap auf.', 'pointcloud_optimizer prepares the registered point cloud for the OctoMap.']),
          S('pco>mg', ['MoveIt baut daraus eine OctoMap mit 3 cm Auflösung, aber nur mit publish_moveit_cloud:=true.', 'MoveIt builds an OctoMap with 3 cm resolution from it, but only with publish_moveit_cloud:=true.'])])],
      },
    },
    streams: {
      t: ['Kamera-Streams und Tisch-Kamera', 'Camera streams and table camera'], hue: 'green', icon: 'i-cam', s: 'sr',
      d: ['web_video_server wandelt ROS-Bilder in MJPEG-Streams auf Port 8082; der Browser braucht dafür kein Plugin. Die Tisch-Kamera verortet Objekte über 12 ArUco-Marker auf dem Tisch, per Homographie ab 4 sichtbaren Markern.', 'web_video_server turns ROS images into MJPEG streams on port 8082; the browser needs no plugin for it. The table camera locates objects via 12 ArUco markers on the table, by homography once 4 markers are visible.'],
      note: ['IP-Kamera mit ArUco ist vorbereitet: nur mit ip_cams:=true aktiv, mit echter Kamera noch nicht getestet.', 'IP camera with ArUco is prepared: active only with ip_cams:=true, not yet tested with a real camera.'],
      spec: {
        lanes: lanes(['src', ['Quelle', 'Source']], ['node', ['ROS-Node', 'ROS node']], ['srv', ['Server', 'Server']], ['ui', ['Browser', 'Browser']]),
        nodes: [N('zed', 'src', 0, { label: 'ZED Mini', short: 'ZED', sub: 'zed_wrapper', icon: 'i-cam', hue: 'green', info: ['Liefert Bild-Topics, z. B. /zed/zed_node/rgb/image_rect_color.', 'Delivers image topics, e.g. /zed/zed_node/rgb/image_rect_color.'] }),
          N('pi', 'src', 1.5, { label: ['Tisch-Kamera', 'Table camera'], short: 'Pi', sub: ['IP-Kamera · HTTP', 'IP camera · HTTP'], icon: 'i-cam', hue: 'green', info: ['Raspberry-Pi-Kamera; Einzelbilder per HTTP.', 'Raspberry Pi camera; single frames via HTTP.'] }),
          N('ipy', 'node', 1.5, { label: 'ArUco + YOLO', short: 'ArUco', sub: 'yolo_3d_bbox_for_ip_cam', icon: 'i-eye', hue: 'green', info: ['≥ 4 bekannte Marker → Homographie; Fußpunkte der Objekte auf der Tischebene.', '≥ 4 known markers → homography; object foot points on the table plane.'] }),
          N('wvs', 'srv', 0, { label: 'web_video_server', short: 'Video', sub: ':8082 · MJPEG', icon: 'i-cam', hue: 'teal', info: ['Wandelt ROS-Bilder in MJPEG-Streams und Snapshots.', 'Turns ROS images into MJPEG streams and snapshots.'] }),
          N('ui', 'ui', 0, { sub: ['Streams · :8081', 'streams · :8081'] })],
        edges: [E('zed', 'wvs', '/zed/zed_node/rgb/image_rect_color'), E('wvs', 'ui', 'MJPEG :8082', { kind: 'stream' }), E('pi', 'ipy', ['Einzelbild per HTTP', 'Single frame via HTTP'], { kind: 'stream' }), E('ipy', 'wvs', '/ip_cam/table/annotated')],
        scenarios: [
          SC('zed', ['ZED-Stream', 'ZED stream'], 'i-cam', 'green', ['Das ROS-Bild der ZED Mini kommt als MJPEG in die UX | Control Interface. Ein zugeklapptes Stream-Fenster pausiert und spart Bandbreite.', 'The ROS image of the ZED Mini reaches the UX | Control Interface as MJPEG. A collapsed stream window pauses and saves bandwidth.'], [
            S('zed>wvs', ['Der Video-Server abonniert das entzerrte Farbbild der ZED Mini.', 'The video server subscribes to the rectified colour image of the ZED Mini.']),
            S('wvs>ui', ['Der Browser zeigt den MJPEG-Stream; ist das Fenster zugeklappt, pausiert er.', 'The browser shows the MJPEG stream; when the window is collapsed, it pauses.'])]),
          SC('aruco', ['Tisch-Kamera + ArUco', 'Table camera + ArUco'], 'i-eye', 'teal', ['Marker finden, Tischposition rechnen, Overlay streamen. Aus den Fußpunkten der Objekte auf der Tischebene ergibt sich ihre Position.', 'Find markers, compute the table position, stream the overlay. The foot points of the objects on the table plane give their positions.'], [
            S('pi>ipy', ['Der Node holt ein Einzelbild per HTTP und sucht die ArUco-Marker darin.', 'The node fetches a single frame via HTTP and finds the ArUco markers in it.']),
            S('ipy>wvs', ['Ab 4 bekannten Markern rechnet eine Homographie die Fußpunkte der YOLO-Objekte in Tischkoordinaten.', 'From 4 known markers a homography maps the foot points of the YOLO objects to table coordinates.']),
            S('wvs>ui', ['Das annotierte Bild erscheint als Live Stream 2 in der UX | Control Interface.', 'The annotated image appears as Live Stream 2 in the UX | Control Interface.'])])],
      },
    },

    // ─────────── KI / VLA-M ───────────
    vla: {
      t: ['KI-Chat: aus einem Satz ein geprüfter Plan', 'AI chat: from one sentence to a checked plan'], hue: 'violet', icon: 'i-spark', s: 'spr',
      d: ['Das Sprachmodell wählt nur Skills (pick, place, home, palletize, gripper) und Objekt-IDs aus der Szene, alle Zielposen rechnet der Code. Jeder Plan wartet auf Execute; im REAL-Modus fährt der Agent nur mit allow_real_motion, Standard ist nur planen.', 'The language model only picks skills (pick, place, home, palletize, gripper) and object IDs from the scene; the code computes every target pose. Every plan waits for Execute; in REAL mode the agent moves only with allow_real_motion, the default is plan only.'],
      note: ['dry_run:=true plant und zeigt, bewegt aber nie den Arm. Abort stoppt nach dem laufenden Schritt, der E-STOP sofort.', 'dry_run:=true plans and shows but never moves the arm. Abort stops after the current step, the E-STOP at once.'],
      loop: { t: ['Agentenschleife', 'Agent loop'], s: 'VLA-M · vla_bridge',
        st: [[['Anweisung', 'Instruction'], ['Chat · Diktat', 'chat · dictation']], [['Plan', 'Plan'], ['Sprachmodell', 'language model']], [['Prüfen', 'Check'], ['Code · ≤ 2 Runden', 'code · ≤ 2 rounds']],
          [['Freigabe', 'Approve'], ['Execute', 'Execute']], [['Ausführen', 'Execute'], ['Motion Handler', 'motion handler']], [['Rückmeldung', 'Feedback'], ['Weltmodell · Greifprüfung', 'world model · grasp check']]],
        back: { from: 2, to: 1, t: ['Plan ungültig → zurück ans Modell, ≤ 2×', 'Invalid plan → back to the model, ≤ 2×'] },
        x: ['Scheitert ein Schritt, plant der Agent mit der neuen Szene neu (höchstens 2×).', 'If a step fails, the agent replans with the new scene (at most 2×).'] },
      spec: {
        lanes: lanes(['in', ['Mensch', 'Human']], 'br', 'ai', 'mo', 'hw'),
        nodes: [N('ui', 'in', 0, { sub: ['KI-Chat · :8081', 'AI chat · :8081'] }), N('rb', 'br', 0), N('vb', 'ai', 0), N('llm', 'ai', 1.5), N('mh', 'mo', 0), N('gj', 'mo', 1.5), N('arm', 'hw', 0)],
        edges: [E('ui', 'rb', '/vla/instruction'), E('rb', 'vb', '/vla/instruction'), E('vb', 'llm', ['Prompt ⇄ Plan (JSON)', 'Prompt ⇄ plan (JSON)'], { kind: 'service' }),
          R('vb', 'rb', '/vla/response'), R('rb', 'ui', '/vla/response'), E('vb', 'mh', '/ui/approach_from_above', { kind: 'service' }), E('mh', 'arm', ['MoveGroup → Controller', 'MoveGroup → controller']),
          E('vb', 'gj', '/ui/gripper_cmd', { ports: 'rl' }), R('mh', 'vb', '/ui/moveit_motion_state')],
        scenarios: [SC('ki', ['KI-Auftrag', 'AI task'], 'i-spark', 'violet', ['Ein Satz wird zum Plan. Der Plan geht zurück zum Menschen und fährt erst nach Execute, Skill für Skill mit Greifprüfung.', 'One sentence becomes a plan. The plan returns to the human and only runs after Execute, skill by skill with a grasp check.'], [
          S('ui>rb', ['Die Anweisung im KI-Chat tippen oder per Whisper diktieren, auf Deutsch oder Englisch.', 'Type the instruction in the AI chat or dictate it via Whisper, in German or English.']),
          S('rb>vb', ['Der Agent bündelt Text, erkannte und virtuelle Objekte, gehaltenes Objekt, Greifer und FAKE/REAL.', 'The agent bundles text, detected and virtual objects, held object, gripper and FAKE/REAL.']),
          S('vb>llm', ['Das Modell antwortet mit JSON aus Skills und Objekt-IDs; Objekte oder deren Koordinaten erfinden darf es nicht.', 'The model answers in JSON with skills and object IDs; it may not invent objects or their coordinates.']),
          S('llm>vb', ['Der Code prüft jeden Schritt gegen die Szene; ein ungültiger Plan geht höchstens 2× zur Korrektur zurück.', 'The code checks every step against the scene; an invalid plan goes back for correction at most 2×.']),
          S('vb>rb', ['Der geprüfte Plan erscheint im Chat und wartet auf Execute.', 'The checked plan appears in the chat and waits for Execute.'], { also: ['rb>ui'] }),
          S('ui>rb', ['Der Mensch liest den Plan und gibt ihn frei; Abort stoppt später nach dem laufenden Schritt.', 'The human reads the plan and approves it; Abort later stops after the current step.'], { topic: '/vla/execute', also: ['rb>vb'] }),
          S('vb>mh', ['Skill für Skill: Anfahrt von oben über den Motion Handler, Greifen über den Greifer-Node.', 'Skill by skill: approach from above via the motion handler, gripping via the gripper node.'], { also: ['mh>arm', 'vb>gj'] }),
          S('mh>vb', ['Jede Fahrt meldet ihr Ergebnis; scheitert ein Schritt, plant der Agent mit der neuen Szene neu, höchstens 2×.', 'Each motion reports its result; if a step fails, the agent replans with the new scene, at most 2×.'])])],
      },
    },
    grasp: {
      t: ['Greifen per Klick (3 Phasen)', 'Grasp by click (3 phases)'], hue: 'violet', icon: 'i-grip', s: 'spr',
      d: ['Objekt im Twin oder in VR anklicken, Grasp wählen: Der Skill-Runner greift ohne Sprachmodell, mit derselben Prüfung wie ein KI-Plan. Drei Phasen folgen: 70 mm über dem Objekt anfahren, senkrecht absenken und ansaugen, anheben und prüfen, ob das Objekt mitkommt.', 'Click an object in the twin or in VR, choose Grasp: the skill runner grasps without a language model, with the same check as an AI plan. Three phases follow: approach 70 mm above the object, descend vertically and suck, lift and check that the object comes along.'],
      note: ['REAL: Der Klick fragt nach; virtuelle Objekte sind in REAL gesperrt. Ein Direktbefehl plant nach einem Fehler nicht neu.', 'REAL: the click asks for confirmation; virtual objects are blocked in REAL. A direct command does not replan after a failure.'],
      spec: {
        lanes: lanes('in', 'br', ['ai', ['Prüfung', 'Check']], 'mo', 'hw'),
        nodes: [N('menu', 'in', 0, { label: ['Objektmenü', 'Object menu'], short: ['Menü', 'Menu'], sub: ['Twin · VR', 'twin · VR'], icon: 'i-grip', hue: 'accent', info: ['Klick auf ein Objekt im Digital Twin oder in VR, dann Grasp.', 'Click an object in the Digital Twin or in VR, then Grasp.'] }),
          N('sb', 'in', 1.5, { label: ['Physik-Sandbox', 'Physics sandbox'], short: ['Physik', 'Physics'], sub: ['Browser · FAKE', 'browser · FAKE'], icon: 'i-cube', hue: 'teal', info: ['Meldet, welches Objekt der Sauger hält.', 'Reports which object the suction cup holds.'] }),
          N('rb', 'br', 0), N('vb', 'ai', 0, { label: ['Skill-Runner', 'Skill runner'], short: 'Skill' }), N('mh', 'mo', 0), N('gj', 'mo', 1.5), N('arm', 'hw', 0)],
        edges: [E('menu', 'rb', '/vla/skill'), E('rb', 'vb', '/vla/skill'), E('vb', 'mh', '/ui/approach_from_above', { kind: 'service' }), E('mh', 'arm', ['MoveGroup → Controller', 'MoveGroup → controller']),
          E('vb', 'gj', '/ui/gripper_cmd', { ports: 'rl' }), E('sb', 'vb', '/ui/physics_sandbox_state', { ports: 'rb' })],
        scenarios: [SC('g', ['Greifen', 'Grasp'], 'i-grip', 'violet', ['Anfahren, Absenken, Ansaugen, Anheben, prüfen. Jeder Schritt wartet auf die Rückmeldung des vorigen, ein Abbruch stoppt den ganzen Griff.', 'Approach, descend, suck, lift, check. Each step waits for the feedback of the previous one; one abort stops the whole grasp.'], [
          S('menu>rb', ['Klick auf Grasp im Objektmenü; in REAL fragt die UI vorher nach.', 'Click Grasp in the object menu; in REAL the UI asks for confirmation first.']),
          S('rb>vb', ['Die Prüfung verlangt: Objekt in der Szene, Greifer leer, Objekt weder gekippt noch gesperrt.', 'The check requires: object in the scene, gripper empty, object neither tilted nor locked.']),
          S('vb>mh', ['Anfahrt auf 70 mm über das Objekt; eine Yaw-Suche findet eine erreichbare Drehung des Werkzeugs.', 'Approach to 70 mm above the object; a yaw search finds a reachable tool rotation.']),
          S('mh>arm', ['Der Arm fährt gerade nach unten bis 2 mm über die Greifkugel.', 'The arm moves straight down to 2 mm above the grasp sphere.']),
          S('vb>gj', ['Sauger ein, dann 0,4 s warten, bis das Vakuum hält.', 'Suction on, then wait 0.4 s for the vacuum to hold.']),
          S('vb>mh', ['Anheben um mindestens 80 mm, damit das Objekt frei über der Szene hängt.', 'Lift by at least 80 mm so the object hangs clear of the scene.'], { topic: '/ui/execute_move_to_pose' }),
          S('sb>vb', ['Greifprüfung: Kommt das Objekt mit? In FAKE meldet die Sandbox, welches Objekt am Sauger hängt.', 'Grasp check: does the object come along? In FAKE the sandbox reports which object hangs on the suction cup.'])])],
      },
    },
    pallet: {
      t: ['Auto-Palettieren', 'Auto palletizing'], hue: 'violet', icon: 'i-layers', s: 'sp',
      d: ['PalletJob plant die Beladung einer Europalette: Gewichtsgrenze, schwer und groß nach unten, mindestens 80 % Auflage, nichts auf zerbrechliche Kartons. Danach greift und legt der Arm Karton für Karton ab und prüft jede Ablage auf 6 mm und 8°, bevor der nächste kommt.', 'PalletJob plans how to load a euro pallet: weight limit, heavy and large at the bottom, at least 80 % support, nothing on fragile cartons. Then the arm picks and places carton after carton and checks each placement to 6 mm and 8° before the next one.'],
      note: ['Nur FAKE mit Physik-Sandbox: REAL lehnt virtuelle Kartons ab. Ein Fehler legt den Karton zurück und hält an, ohne Neuplanung.', 'FAKE with physics sandbox only: REAL rejects virtual cartons. An error puts the carton back and stops, without replanning.'],
      loop: { t: ['Palettier-Zyklus', 'Palletizing cycle'], s: 'vla_bridge · PalletJob',
        st: [[['Plan', 'Plan'], ['Kartons · Lagen', 'cartons · layers']], [['Greifen', 'Pick'], ['pick', 'pick']], [['Ablegen', 'Place'], ['place_at', 'place_at']],
          [['Lage prüfen', 'Check pose'], ['≤ 6 mm · 8°', '≤ 6 mm · 8°']], [['Nächster Karton', 'Next carton'], ['bis Palette voll', 'until pallet full']], [['Palettenwechsel', 'Pallet change'], ['≤ 90 s · neuer Plan', '≤ 90 s · new plan']]],
        back: { from: 4, to: 1, t: ['nächster Karton, bis die Palette voll ist', 'next carton until the pallet is full'] } },
      spec: {
        lanes: lanes(['in', ['Bediener', 'Operator']], 'br', ['ai', ['Planer', 'Planner']], 'mo', 'hw'),
        nodes: [N('pan', 'in', 0, { label: ['Palettier-Fenster', 'Palletizing window'], short: ['Palette', 'Pallet'], sub: 'pallet.js · :8081', icon: 'i-layers', hue: 'accent', info: ['Plan, Start, Dry run, Abort, Palettenwechsel.', 'Plan, start, dry run, abort, pallet change.'] }),
          N('rb', 'br', 0), N('pj', 'ai', 0, { label: 'PalletJob', short: 'Job', sub: 'vla_bridge', icon: 'i-spark', hue: 'violet', info: ['Rechnet den Plan (Auflage ≥ 80 %, nie schwer auf leicht) und führt ihn Karton für Karton aus.', 'Computes the plan (support ≥ 80 %, never heavy on light) and runs it carton by carton.'] }),
          N('vo', 'ai', 1.5, { label: ['Virtuelle Kartons', 'Virtual cartons'], short: ['Kartons', 'Cartons'], sub: '/ui/virtual_objects', icon: 'i-cube', hue: 'teal', info: ['Palette und Kartons der Logistik-Zelle (Maßstab 1:6).', 'Pallet and cartons of the logistics cell (scale 1:6).'] }),
          N('mh', 'mo', 0), N('gj', 'mo', 1.5), N('arm', 'hw', 0, { sub: 'FAKE · Sandbox' })],
        edges: [E('pan', 'rb', '/vla/skill'), E('rb', 'pj', '/vla/skill'), E('vo', 'pj', '/ui/virtual_objects'), R('pj', 'rb', '/vla/pallet/plan'), R('rb', 'pan', '/vla/pallet/plan'),
          E('pj', 'mh', '/ui/approach_from_above', { kind: 'service' }), E('mh', 'arm', ['MoveGroup → Controller', 'MoveGroup → controller']), E('pj', 'gj', '/ui/gripper_cmd', { ports: 'rl' })],
        scenarios: [SC('p', ['Palettieren', 'Palletizing'], 'i-layers', 'violet', ['Plan, Start, Karton für Karton, Palettenwechsel. Vor dem Start zeigt die UI jeden Karton als Ghost-Box an seinem Zielplatz.', 'Plan, start, carton by carton, pallet change. Before the start the UI shows every carton as a ghost box at its target spot.'], [
          S('pan>rb', ['Plan anfordern: optional Pflicht-Kartons und eigene Grenzen für Last, Höhe und Auflage setzen.', 'Request a plan: optionally set required cartons and own limits for load, height and support.']),
          S('rb>pj', ['PalletJob wählt Kartons und Reihenfolge und rechnet die genauen Ablageposen Lage für Lage.', 'PalletJob picks cartons and order and computes the exact placement poses layer by layer.'], { also: ['vo>pj'] }),
          S('pj>rb', ['Plan und Fortschritt gehen latched an die UI, die Kartons erscheinen als Ghost-Boxen.', 'Plan and progress go latched to the UI; the cartons appear as ghost boxes.'], { also: ['rb>pan'] }),
          S('pan>rb', ['Start fährt den Plan; Dry run prüft nur die IK jeder Zielpose und bewegt nichts.', 'Start runs the plan; dry run only checks the IK of each target pose and moves nothing.'], { also: ['rb>pj'] }),
          S('pj>mh', ['Je Karton: pick mit Anfahrt von oben, dann place_at auf die geplante Zielpose.', 'Per carton: pick with approach from above, then place_at onto the planned target pose.'], { also: ['pj>gj'] }),
          S('mh>arm', ['Der Arm setzt ab und löst den Sauger 3 mm über der Zielhöhe.', 'The arm sets down and releases the suction 3 mm above the target height.']),
          S('pj>rb', ['Die Ist-Lage wird mit dem Plan verglichen; liegt sie innerhalb von 6 mm und 8°, folgt der nächste Karton.', 'The actual pose is compared with the plan; within 6 mm and 8°, the next carton follows.']),
          S('pj>rb', ['Palette voll: Ereignis an die UI, Palettenwechsel in höchstens 90 s, dann ein neuer Plan für die leere Palette.', 'Pallet full: event to the UI, pallet change within 90 s at most, then a new plan for the empty pallet.'], { topic: '/vla/pallet/event', also: ['rb>pan'] })])],
      },
    },

    // ─────────── UX | Monitoring, Evaluierung, Daten ───────────
    mon: {
      t: ['UX | Monitoring: der Datenweg', 'UX | Monitoring: the data path'], hue: 'indigo', icon: 'i-chart',
      d: ['Der rclpy-Node ros_monitor zählt Topics und Ereignisse, der SystemCollector misst CPU, RAM, GPU und Ports jede Sekunde; beide schreiben in SQLite (30 Tage). Die HTTP-API auf Port 8083 liefert daraus die 11 Ansichten, nur an lokale und private Netze.', 'The rclpy node ros_monitor counts topics and events, the SystemCollector measures CPU, RAM, GPU and ports every second; both write to SQLite (30 days). The HTTP API on port 8083 serves the 11 views from it, to local and private networks only.'],
      spec: {
        lanes: lanes(['src', ['Quellen', 'Sources']], ['srv', ['Sammler', 'Collectors']], ['st', ['Speicher', 'Storage']], ['api', ['HTTP-API', 'HTTP API']], ['ui', ['Browser', 'Browser']]),
        nodes: [N('ros', 'src', 0, { label: ['ROS-2-Graph', 'ROS 2 graph'], short: 'ROS', sub: ['Topics · Graph alle 3 s', 'topics · graph every 3 s'], icon: 'i-link', hue: 'teal', info: ['Bewegungen, E-STOP, Greifer, Klicks, Heartbeats, Detektionen, VLA-Status.', 'Motions, E-STOP, gripper, clicks, heartbeats, detections, VLA status.'] }),
          N('os', 'src', 1.5, { label: 'System', short: 'OS', sub: 'psutil · nvidia-smi', icon: 'i-chip', hue: 'indigo', info: ['CPU, RAM, GPU, Platte, Netz und Dienst-Ports.', 'CPU, RAM, GPU, disk, network and service ports.'] }),
          N('rm', 'srv', 0, { label: 'ros_monitor', short: 'Node', sub: 'rclpy', icon: 'i-pulse', hue: 'indigo', info: ['Abonniert Topics, liest den Graphen, zählt Nutzung je Minute.', 'Subscribes topics, reads the graph, counts usage per minute.'] }),
          N('col', 'srv', 1.5, { label: 'SystemCollector', short: 'Coll.', sub: ['Takt 1 s', '1 s cycle'], icon: 'i-chart', hue: 'indigo', info: ['Misst das System jede Sekunde.', 'Measures the system every second.'] }),
          N('db', 'st', 0, { label: 'SQLite', short: 'DB', sub: 'monitoring.db · 30 d', icon: 'i-db', hue: 'teal', info: ['Ring 1 h im RAM, Minutenmittel 30 Tage; Tabellen für Fahrten, Sessions, Klicks, Griffe, Events.', '1 h ring in RAM, minute means for 30 days; tables for motions, sessions, clicks, grasps, events.'] }),
          N('api', 'api', 0, { label: 'HTTP-API', short: 'API', sub: ':8083 · /api/*', icon: 'i-link', hue: 'accent', info: ['JSON-API und statische Oberfläche; POST nur von derselben Origin.', 'JSON API and static interface; POST only from the same origin.'] }),
          N('br', 'ui', 0, { label: ['11 Ansichten', '11 views'], short: 'Views', sub: 'UX | Monitoring', icon: 'i-chart', hue: 'indigo', info: ['Übersicht bis Evaluierung, Export als CSV oder JSON.', 'Overview to evaluation, export as CSV or JSON.'] })],
        edges: [E('ros', 'rm', ['Topics + Graph', 'Topics + graph']), E('os', 'col', ['CPU, RAM, GPU, Ports', 'CPU, RAM, GPU, ports']), E('rm', 'db', ['Zähler je Minute, Ereignisse', 'Counters per minute, events']),
          E('col', 'db', ['Minutenmittel', 'Minute means'], { ports: 'rb' }), E('db', 'api', ['SQL + Ring', 'SQL + ring']), E('api', 'br', 'GET /api/*', { kind: 'service' })],
        scenarios: [SC('m', ['Datenweg', 'Data path'], 'i-chart', 'indigo', ['Messen, speichern, ausliefern: vom ROS-Graphen bis in die Ansicht. Die letzte Stunde liegt sekundengenau im RAM, ältere Daten als Minutenmittel in SQLite.', 'Measure, store, serve: from the ROS graph to the view. The last hour sits in RAM to the second, older data as minute means in SQLite.'], [
          S('ros>rm', ['ros_monitor abonniert Bewegungen, E-STOP, Greifer, Klicks und Heartbeats und liest den ROS-Graphen alle 3 s.', 'ros_monitor subscribes to motions, E-STOP, gripper, clicks and heartbeats and reads the ROS graph every 3 s.']),
          S('os>col', ['Der SystemCollector misst jede Sekunde CPU, RAM, GPU, Platte, Netz und Dienst-Ports.', 'The SystemCollector measures CPU, RAM, GPU, disk, network and service ports every second.']),
          S('col>db', ['Die Messwerte liegen 1 h als Ring im RAM; Minutenmittel gehen für 30 Tage in SQLite.', 'Readings stay in a 1 h ring in RAM; minute means go into SQLite for 30 days.']),
          S('rm>db', ['Fahrten, Sessions, Klicks, Griffe und Ereignisse landen je in einer eigenen Tabelle.', 'Motions, sessions, clicks, grasps and events each land in their own table.']),
          S('db>api', ['Die API beantwortet Anfragen aus Datenbank und Ring; POST nur von derselben Origin.', 'The API answers requests from database and ring; POST only from the same origin.']),
          S('api>br', ['Die 11 Ansichten holen JSON per GET; die Daten lassen sich als CSV oder JSON exportieren.', 'The 11 views fetch JSON via GET; the data can be exported as CSV or JSON.'])])],
      },
    },
    clicks: {
      t: ['Klick-Statistik: Nutzung messen', 'Click statistics: measuring use'], hue: 'indigo', icon: 'i-touch',
      d: ['usage_stats.js in der UX | Control Interface zählt Klicks und Änderungen nur mit Label (≤ 48 Zeichen) und Bereich, nie Eingaben; Passwortfelder zählen gar nicht. Alle 3 s geht ein Batch von höchstens 200 Einträgen per ROS-Topic an das UX | Monitoring.', 'usage_stats.js in the UX | Control Interface counts clicks and changes with label (≤ 48 characters) and area only, never input values; password fields do not count at all. Every 3 s a batch of at most 200 entries goes to the UX | Monitoring via a ROS topic.'],
      loop: { t: ['Klick-Statistik', 'Click statistics'], s: 'usage_stats → SQLite',
        st: [[['Klick', 'Click'], ['Label + Bereich', 'label + area']], [['Puffern', 'Buffer'], ['≤ 200 Einträge', '≤ 200 entries']], [['Senden', 'Send'], ['alle 3 s', 'every 3 s']],
          [['Speichern', 'Store'], ['SQLite · 30 Tage', 'SQLite · 30 days']], [['Anzeigen', 'Show'], ['Nutzer & Sessions', 'users & sessions']]],
        back: { from: 2, to: 1, t: ['Puffer leer, nächster Batch in 3 s', 'buffer empty, next batch in 3 s'] },
        x: ['Passwortfelder zählen nie. Auswerten und die UI verbessern macht der Mensch, nicht der Code.', 'Password fields never count. Analysing and improving the UI is done by people, not by code.'] },
      spec: {
        lanes: lanes(['rcu', ['UX | Control Interface', 'UX | Control Interface']], 'br', ['mon', ['UX | Monitoring', 'UX | Monitoring']], ['view', ['Ansicht', 'View']]),
        nodes: [N('us', 'rcu', 0, { label: 'usage_stats.js', short: ['Klicks', 'Clicks'], sub: 'UX | Control Interface', icon: 'i-touch', hue: 'accent', info: ['Zählt Klicks und Änderungen: nur Label (≤ 48 Zeichen) und Bereich.', 'Counts clicks and changes: label (≤ 48 characters) and area only.'] }),
          N('rb', 'br', 0), N('rm', 'mon', 0, { label: 'ros_monitor', short: 'Node', sub: 'rclpy', icon: 'i-pulse', hue: 'indigo', info: ['Ordnet Klicks der Session zu, korrigiert Uhrzeit-Versatz über 30 s.', 'Assigns clicks to the session, corrects clock skew above 30 s.'] }),
          N('db', 'mon', 1.5, { label: 'SQLite', short: 'DB', sub: 'interactions · 30 d', icon: 'i-db', hue: 'teal', info: ['Eine Zeile je Klick, 30 Tage, löschbar per „Statistik leeren“.', 'One row per click, 30 days, erasable via “clear statistics”.'] }),
          N('v', 'view', 0, { label: ['Nutzer & Sessions', 'Users & sessions'], short: 'View', sub: ':8083', icon: 'i-chart', hue: 'indigo', info: ['Top-Elemente, Bereiche, Wochentag × Stunde.', 'Top elements, areas, weekday × hour.'] })],
        edges: [E('us', 'rb', '/ui/interaction_events'), E('rb', 'rm', '/ui/interaction_events'), E('rm', 'db', ['Zeile je Klick', 'Row per click']), E('db', 'v', 'GET /api/interactions', { kind: 'service', ports: 'rb' })],
        scenarios: [SC('c', ['Klick-Statistik', 'Click statistics'], 'i-touch', 'indigo', ['Klicks sammeln, bündeln, speichern, anzeigen. Die Ansicht zeigt Top-Elemente, Bereiche und die Nutzung nach Wochentag und Stunde.', 'Collect, batch, store and show clicks. The view shows top elements, areas and use by weekday and hour.'], [
          S('us>rb', ['Die UI puffert Klicks lokal und sendet alle 3 s einen Batch mit höchstens 200 Einträgen.', 'The UI buffers clicks locally and sends a batch of at most 200 entries every 3 s.']),
          S('rb>rm', ['rosbridge reicht das Topic an ros_monitor weiter, wie jedes andere Browser-Topic.', 'rosbridge passes the topic to ros_monitor like any other browser topic.']),
          S('rm>db', ['ros_monitor ordnet jeden Klick der Session zu, korrigiert Uhrzeit-Versatz über 30 s und speichert eine Zeile.', 'ros_monitor assigns each click to the session, corrects clock skew above 30 s and stores one row.']),
          S('db>v', ['Die Ansicht Nutzer & Sessions zeigt Top-Elemente, Bereiche und eine Heatmap Wochentag × Stunde.', 'The Users & sessions view shows top elements, areas and a weekday × hour heatmap.'])])],
      },
    },
    study: {
      t: ['Usability-Studie: vom Test zum Bericht', 'Usability study: from test to report'], hue: 'indigo', icon: 'i-flask',
      d: ['Die Testleitung plant und startet Durchläufe in der Evaluierung des UX | Monitoring, die Testperson bedient die UX | Control Interface. Jeder Durchlauf speichert 10 Kennzahlen und die Fragebögen SUS, NASA-TLX, UEQ-S und SEQ in SQLite; der Bericht folgt ISO 9241-11.', 'The test lead plans and starts runs in the evaluation of the UX | Monitoring; the participant operates the UX | Control Interface. Every run stores 10 metrics and the SUS, NASA-TLX, UEQ-S and SEQ questionnaires in SQLite; the report follows ISO 9241-11.'],
      loop: { t: ['Studienschleife', 'Study loop'], s: ['Evaluierung · study.py', 'Evaluation · study.py'],
        st: [[['Test', 'Test'], ['Aufgaben × Methoden', 'tasks × methods']], [['Aufgabe', 'Task'], ['Ziel · Zielzeit', 'goal · target time']], [['Person', 'Participant'], ['Code · Latin Square', 'code · Latin square']],
          [['Durchlauf', 'Run'], ['▶ … ■ · KPI', '▶ … ■ · KPI']], [['Fragebogen', 'Questionnaire'], ['SUS · TLX · UEQ-S · SEQ', 'SUS · TLX · UEQ-S · SEQ']], [['Auswertung', 'Analysis'], ['ISO 9241-11', 'ISO 9241-11']]],
        back: { from: 4, to: 2, t: ['nächste Person bzw. Methode', 'next participant or method'] },
        x: ['Ob die UI danach verbessert wird, entscheidet der Mensch; das ist kein Code-Regelkreis.', 'Whether the UI is improved afterwards is decided by people; that is not a code loop.'] },
      spec: {
        lanes: lanes(['lead', ['Testleitung', 'Test lead']], ['srv', ['Server · DB', 'Server · DB']], ['ros', ['ROS', 'ROS']], ['rcu', ['Testperson', 'Participant']]),
        nodes: [N('ev', 'lead', 0, { label: ['Evaluierung', 'Evaluation'], short: 'Eval', sub: 'UX | Monitoring', icon: 'i-flask', hue: 'indigo', info: ['5 Tabs: Usability-Tests, Testpersonen, Fragebögen, Auswertung, Marker-Abschnitte.', '5 tabs: usability tests, participants, questionnaires, analysis, marker segments.'] }),
          N('rep', 'lead', 1.5, { label: ['Bericht + Export', 'Report + export'], short: ['Bericht', 'Report'], sub: 'ISO 9241-11 · CSV/JSON', icon: 'i-chart', hue: 'indigo', info: ['6 Kapitel, druckbar als PDF; Export der Personen, Durchläufe und Antworten.', '6 chapters, printable as PDF; export of participants, runs and answers.'] }),
          N('st', 'srv', 0, { label: 'study.py', short: ['Studie', 'Study'], sub: 'SQLite', icon: 'i-db', hue: 'teal', info: ['Tabellen für Studien, Aufgaben, Personen, Durchläufe, Fragebögen und Antworten.', 'Tables for studies, tasks, participants, runs, questionnaires and answers.'] }),
          N('mon', 'ros', 0, { label: 'ros_monitor', short: 'Node', sub: '/dashboard/eval_run', icon: 'i-pulse', hue: 'indigo', info: ['Veröffentlicht den laufenden Durchlauf latched an alle Geräte.', 'Publishes the running run, latched, to all devices.'] }),
          N('rcu', 'rcu', 0, { of: 'ui', sub: ['Start-Popup · Login', 'start popup · login'] }),
          N('fill', 'rcu', 1.5, { label: ['Fragebogen', 'Questionnaire'], short: ['Bogen', 'Form'], sub: ['#fill · Tablet', '#fill · tablet'], icon: 'i-touch', hue: 'accent', info: ['Fragebogen im UX | Monitoring, auch als Tablet-Kiosk.', 'Questionnaire in the UX | Monitoring, also as a tablet kiosk.'] })],
        edges: [E('ev', 'st', 'POST /api/study/run_start', { kind: 'service' }), E('st', 'mon', ['Durchlauf läuft', 'Run active']), E('mon', 'rcu', '/dashboard/eval_run'),
          R('rcu', 'mon', ['/remote/heartbeat (Login-Code)', '/remote/heartbeat (login code)']), E('fill', 'st', 'POST /api/study/response_submit', { kind: 'service', ports: 'lb' }),
          E('rep', 'st', 'GET /api/study/report', { kind: 'service', ports: 'rb' })],
        scenarios: [SC('s', ['Studie', 'Study'], 'i-flask', 'indigo', ['Zuweisen, starten, anmelden, stoppen, befragen, auswerten. Ein Latin Square verteilt die Reihenfolge der Methoden, damit sich Lerneffekte ausgleichen.', 'Assign, start, log in, stop, survey, analyse. A Latin square spreads the order of methods so learning effects balance out.'], [
          S('ev>st', ['Testpersonen zuweisen; ein Latin Square legt die Reihenfolge der Methoden je Person fest.', 'Assign participants; a Latin square sets the order of methods per participant.'], { topic: 'POST /api/study/test_assign_all' }),
          S('ev>st', ['Die Testleitung startet den Durchlauf; der Marker ▶ setzt den Beginn der Messung.', 'The test lead starts the run; the ▶ marker sets the start of the measurement.']),
          S('st>mon', ['ros_monitor veröffentlicht den laufenden Durchlauf latched an alle Geräte.', 'ros_monitor publishes the running run, latched, to all devices.']),
          S('mon>rcu', ['Die UX | Control Interface zeigt auf jedem verbundenen Gerät ein Start-Popup.', 'The UX | Control Interface shows a start popup on every connected device.']),
          S('rcu>mon', ['Die Testperson meldet sich mit ihrem Code an; der Heartbeat ordnet ihr Gerät dem Durchlauf zu.', 'The participant logs in with their code; the heartbeat links their device to the run.']),
          S('ev>st', ['Beim Stopp sichert der Server 10 Kennzahlen des Durchlaufs als KPI-Snapshot.', 'On stop the server saves 10 metrics of the run as a KPI snapshot.'], { topic: 'POST /api/study/run_stop' }),
          S('fill>st', ['Die Testperson füllt SUS, NASA-TLX, UEQ-S und SEQ aus, auch am Tablet-Kiosk.', 'The participant fills in SUS, NASA-TLX, UEQ-S and SEQ, also on the tablet kiosk.']),
          S('rep>st', ['Der Bericht nach ISO 9241-11 hat 6 Kapitel und ist als PDF druckbar; Rohdaten gehen als CSV oder JSON raus.', 'The report per ISO 9241-11 has 6 chapters and prints as PDF; raw data export as CSV or JSON.'])])],
      },
    },
    blackbox: {
      t: ['Blackbox: die letzten 60 s sichern', 'Blackbox: save the last 60 s'], hue: 'teal', icon: 'i-db',
      d: ['Ein Ringpuffer im RAM hält die letzten 60 s von 14 Topics, darunter Gelenke, TF, Servo, Gamepad und UI-Befehle. Bei E-STOP, Servo-Halt, Kollision oder per Knopf läuft er 5 s nach und schreibt das Fenster als rosbag2 nach ~/.ros/blackbox.', 'A ring buffer in RAM keeps the last 60 s of 14 topics, including joints, TF, servo, gamepad and UI commands. On E-STOP, servo halt, collision or by button it runs on for 5 s and writes the window as a rosbag2 to ~/.ros/blackbox.'],
      loop: { t: ['Blackbox', 'Blackbox'], s: 'robot_blackbox_recorder',
        st: [[['Puffern', 'Buffer'], ['60 s im RAM', '60 s in RAM']], [['Auslösen', 'Trigger'], ['E-STOP · Kollision · Knopf', 'E-STOP · collision · button']], [['Nachlaufen', 'Run on'], ['5 s', '5 s']],
          [['Sichern', 'Save'], ['rosbag2 + Info', 'rosbag2 + info']], [['Aufräumen', 'Clean up'], ['neueste 30 bleiben', 'newest 30 kept']]],
        back: { from: 1, to: 0, t: ['kein Ereignis: der Puffer rollt weiter', 'no event: the buffer keeps rolling'] },
        x: ['Cooldown 30 s je Grund; abspielen mit RViz oder Foxglove.', 'Cooldown 30 s per reason; replay with RViz or Foxglove.'] },
      spec: {
        lanes: lanes(['ros', ['Topics', 'Topics']], ['bb', ['Blackbox', 'Blackbox']], ['disk', ['Platte', 'Disk']], ['dash', ['UX | Monitoring', 'UX | Monitoring']]),
        nodes: [N('tp', 'ros', 0, { label: ['14 Topics', '14 topics'], short: 'Topics', sub: '/joint_states · /tf · /ui/*', icon: 'i-link', hue: 'teal', info: ['Gelenke, TF, Servo, Gamepad, UI-Befehle, Control-Zustand, VLA-Status.', 'Joints, TF, servo, gamepad, UI commands, control state, VLA status.'] }),
          N('trg', 'ros', 1.5, { label: ['Auslöser', 'Triggers'], short: 'Trigger', sub: ['E-STOP · Kollision · Knopf', 'E-STOP · collision · button'], icon: 'i-warn', hue: 'gold', info: ['E-STOP-Flanke, Servo-Status 2/4, /ui/collision_msg, Service /blackbox/save.', 'E-STOP edge, servo status 2/4, /ui/collision_msg, service /blackbox/save.'] }),
          N('ring', 'bb', 0, { label: ['Ringpuffer', 'Ring buffer'], short: ['Puffer', 'Buffer'], sub: ['60 s + 5 s · RAM', '60 s + 5 s · RAM'], icon: 'i-loop', hue: 'teal', info: ['Hält serialisierte Nachrichten der letzten 60 s.', 'Holds serialised messages of the last 60 s.'] }),
          N('bag', 'disk', 0, { label: 'rosbag2', short: 'Bag', sub: '~/.ros/blackbox', icon: 'i-db', hue: 'teal', info: ['Ordner <Zeit>_<Grund> mit Bag und blackbox_info.json.', 'Folder <time>_<reason> with bag and blackbox_info.json.'] }),
          N('ui', 'dash', 0, { label: ['Robot-Nutzung', 'Robot usage'], short: 'View', sub: ':8083 · /api/blackbox', icon: 'i-chart', hue: 'indigo', info: ['Listet die Vorfälle, nur lesend.', 'Lists the incidents, read only.'] })],
        edges: [E('tp', 'ring', ['alle 14 Topics, rollierend', 'all 14 topics, rolling']), E('trg', 'ring', '/ui/emergency_stop_active', { ports: 'rb' }), E('ring', 'bag', ['Fenster −60 s … +5 s', 'window −60 s … +5 s']),
          E('bag', 'ui', 'GET /api/blackbox', { kind: 'service' })],
        scenarios: [SC('b', ['Vorfall', 'Incident'], 'i-warn', 'gold', ['Puffer läuft, Ereignis löst aus, Bag wird geschrieben. So zeigt jeder Vorfall auch die Minute davor, abspielbar in RViz oder Foxglove.', 'Buffer runs, an event triggers, the bag is written. Every incident thus also shows the minute before it, replayable in RViz or Foxglove.'], [
          S('tp>ring', ['Der Puffer zeichnet ständig mit und verwirft alles, was älter als 60 s ist.', 'The buffer records all the time and drops everything older than 60 s.']),
          S('trg>ring', ['Auslöser: E-STOP-Flanke, Servo-Status 2 oder 4, Kollisionsmeldung oder der Service /blackbox/save; je Grund 30 s Cooldown.', 'Triggers: E-STOP edge, servo status 2 or 4, collision message or the /blackbox/save service; 30 s cooldown per reason.']),
          S('ring>bag', ['Nach 5 s Nachlauf schreibt der Recorder Bag und blackbox_info.json; die neuesten 30 Vorfälle bleiben.', 'After 5 s of run-on the recorder writes the bag and blackbox_info.json; the newest 30 incidents are kept.']),
          S('bag>ui', ['Die Ansicht Robot-Nutzung im UX | Monitoring listet den Vorfall mit Zeit und Grund.', 'The Robot usage view in the UX | Monitoring lists the incident with time and reason.'])])],
      },
    },
    demo: {
      t: ['Demo → Training', 'Demo → training'], hue: 'violet', icon: 'i-db', s: 'sr', plan: ['Training und Policy als Skill', 'training and policy as a skill'],
      d: ['Der Demo-Recorder zeichnet Vorführungen per VR, Gamepad oder UI als Episoden auf: Zustand, Aktion und Bilder von bis zu 4 Twin-Kameras mit 15 fps, höchstens 300 s. demos_to_lerobot.py macht daraus einen LeRobot-Datensatz für späteres Training.', 'The demo recorder captures demonstrations via VR, gamepad or UI as episodes: state, action and images from up to 4 twin cameras at 15 fps, 300 s at most. demos_to_lerobot.py turns them into a LeRobot dataset for later training.'],
      note: ['Belegt sind Aufnahme und Konvertierung; Training und eine Policy als Skill des Agenten sind geplant.', 'Recording and conversion exist; training and a policy as an agent skill are planned.'],
      loop: { t: ['Demo → Training', 'Demo → training'], s: ['Training geplant', 'training planned'],
        st: [[['Vorführen', 'Demonstrate'], ['Record demo · Teleop', 'record demo · teleop']], [['Episode', 'Episode'], ['meta · npz · mp4', 'meta · npz · mp4']], [['Konvertieren', 'Convert'], ['demos_to_lerobot.py', 'demos_to_lerobot.py']],
          [['Datensatz', 'Dataset'], ['LeRobotDataset', 'LeRobotDataset']], [['Training', 'Training'], ['SmolVLA · geplant', 'SmolVLA · planned'], 1], [['Skill', 'Skill'], ['Policy · geplant', 'policy · planned'], 1]] },
      spec: {
        lanes: lanes(['ui', ['UX | Control Interface', 'UX | Control Interface']], ['rec', ['Recorder', 'Recorder']], ['disk', ['Platte', 'Disk']], ['tool', ['Konvertierung', 'Conversion']], ['plan', ['Training (geplant)', 'Training (planned)']]),
        nodes: [N('vla', 'ui', 0, { label: 'Record demo', short: 'Demo', sub: 'VLA-M-Section', icon: 'i-spark', hue: 'violet', info: ['Aufgabentext eingeben, Start, Vorführen per VR, Gamepad oder UI, Speichern.', 'Enter the task text, start, demonstrate via VR, gamepad or UI, save.'] }),
          N('vc', 'ui', 1.5, { label: ['Twin-Kameras', 'Twin cameras'], short: 'vCam', sub: ['vCams · 15 fps · FAKE', 'vCams · 15 fps · FAKE'], icon: 'i-cam', hue: 'teal', info: ['Bis zu 4 virtuelle Kameras rendern den Twin als Bildquelle.', 'Up to 4 virtual cameras render the twin as an image source.'] }),
          N('rec', 'rec', 0, { label: 'demo_recorder', short: 'Rec.', sub: ['15 fps · ≤ 300 s', '15 fps · ≤ 300 s'], icon: 'i-db', hue: 'teal', info: ['Zeichnet Zustand, Aktion und Bilder auf; bewegt nie den Roboter.', 'Records state, action and images; never moves the robot.'] }),
          N('ep', 'disk', 0, { label: ['Episoden', 'Episodes'], short: 'Ep.', sub: 'meta · npz · mp4', icon: 'i-db', hue: 'teal', info: ['~/.local/share/vla_demos/xarm_lite6/episode_NNNNNN/', '~/.local/share/vla_demos/xarm_lite6/episode_NNNNNN/'] }),
          N('cv', 'tool', 0, { label: 'demos_to_lerobot.py', short: 'Conv.', sub: 'LeRobotDataset', icon: 'i-layers', hue: 'accent', info: ['Liest die Episoden ein, überspringt misslungene, schreibt Parquet + Videos.', 'Reads the episodes, skips failed ones, writes Parquet + videos.'] }),
          N('tr', 'plan', 0, { label: ['Fein-Tuning (geplant)', 'Fine-tuning (planned)'], short: 'Train', sub: ['SmolVLA · geplant', 'SmolVLA · planned'], icon: 'i-spark', hue: 'violet', info: ['Geplant: Policy aus den Demos trainieren und als Skill des Agenten nutzen.', 'Planned: train a policy from the demos and use it as an agent skill.'] })],
        edges: [E('vla', 'rec', '/vla/demo/cmd'), R('rec', 'vla', '/vla/demo/status'), E('vc', 'rec', '/twin/vcam/<id>/image/compressed', { ports: 'rb' }), E('rec', 'ep', ['Episode speichern', 'Save episode']),
          E('ep', 'cv', ['Ordner einlesen', 'Read folders']), E('cv', 'tr', ['Datensatz → Training (geplant)', 'Dataset → training (planned)'])],
        scenarios: [SC('d', ['Aufnahme', 'Recording'], 'i-db', 'violet', ['Vorführen, speichern, konvertieren; Training folgt später. Der Recorder selbst bewegt den Roboter nie, er zeichnet nur auf.', 'Demonstrate, save, convert; training comes later. The recorder itself never moves the robot; it only records.'], [
          S('vla>rec', ['Aufgabentext eingeben, Start drücken und die Aufgabe per VR, Gamepad oder UI vorführen.', 'Enter the task text, press Start and demonstrate the task via VR, gamepad or UI.']),
          S('vc>rec', ['In FAKE liefern bis zu 4 virtuelle Twin-Kameras die Bilder mit 15 fps.', 'In FAKE up to 4 virtual twin cameras deliver the images at 15 fps.']),
          S('rec>ep', ['Stopp speichert die Episode als meta, npz und mp4 in einem eigenen Ordner.', 'Stop saves the episode as meta, npz and mp4 in its own folder.']),
          S('rec>vla', ['Der Recorder meldet seinen Status zurück an die VLA-M-Section.', 'The recorder reports its status back to the VLA-M section.']),
          S('ep>cv', ['demos_to_lerobot.py liest die Episoden ein, überspringt misslungene und schreibt Parquet und Videos.', 'demos_to_lerobot.py reads the episodes, skips failed ones and writes Parquet and videos.']),
          S('cv>tr', ['Das Training einer Policy (z. B. SmolVLA) ist geplant und noch nicht im Code.', 'Training a policy (e.g. SmolVLA) is planned and not yet in the code.'])])],
      },
    },

    // ─────────── Infrastruktur ───────────
    start: {
      t: ['Systemstart über die UX | Nexus Launcher', 'System start via the UX | Nexus Launcher'], hue: 'accent', icon: 'i-rocket', s: 'spr',
      d: ['Ein Klick statt vieler Terminals: Der Preflight prüft Roboter, Kameras, Gamepad, Ports, Doppelstacks, DDS, GPU, Ollama und Platte, ohne etwas zu starten. Dann startet EXECUTE die Karten in fester Reihenfolge und wartet je Karte, bis Node, Port oder Prozess bereit ist.', 'One click instead of many terminals: the preflight checks robot, cameras, gamepad, ports, duplicate stacks, DDS, GPU, Ollama and disk without starting anything. Then EXECUTE starts the cards in a fixed order and waits per card until node, port or process is ready.'],
      spec: {
        lanes: lanes(['ui', ['UX | Nexus Launcher', 'UX | Nexus Launcher']], ['be', ['Backend', 'Backend']], ['ros', ['ROS-2-Stack', 'ROS 2 stack']]),
        nodes: [N('pop', 'ui', 0, { label: ['Setup-Popup', 'Setup popup'], short: 'Popup', sub: 'UX | Nexus Launcher · :8080', icon: 'i-layers', hue: 'accent', info: ['Setup wählen (DEV, SERVER, CLIENT; FAKE oder REAL), Karten anhaken, Check, EXECUTE.', 'Pick a setup (DEV, SERVER, CLIENT; FAKE or REAL), tick cards, check, EXECUTE.'] }),
          N('pre', 'ui', 1.5, { label: 'Preflight', short: 'Check', sub: 'nexus_preflight.py', icon: 'i-shield', hue: 'gold', info: ['Roboter, Kameras, Gamepad, Ports, Doppelstack, DDS, GPU, Ollama, Platte; startet nichts.', 'Robot, cameras, gamepad, ports, duplicate stack, DDS, GPU, Ollama, disk; starts nothing.'] }),
          N('seq', 'be', 0, { label: 'SequenceRunner', short: 'Seq.', sub: 'nexus_runs.py', icon: 'i-rocket', hue: 'accent', info: ['Startet Karten nacheinander und wartet, bis Node, Port oder Prozess bereit ist.', 'Starts cards one by one and waits until node, port or process is ready.'] }),
          N('kill', 'be', 1.5, { label: 'Kill Daemon', short: 'Kill', sub: 'kill_ros2.sh', icon: 'i-stop', hue: 'gold', info: ['Beendet ROS-Prozesse der eigenen Domain, startet den ROS-Daemon neu.', 'Stops ROS processes of the own domain, restarts the ROS daemon.'] }),
          N('stack', 'ros', 0, { label: ['ROS-2-Launches', 'ROS 2 launches'], short: 'Stack', sub: 'MoveIt · rosbridge · UIs', icon: 'i-chip', hue: 'indigo', info: ['Die Karten der Sequenz, Logs in ~/.ros/nexus_logs.', 'The cards of the sequence, logs in ~/.ros/nexus_logs.'] })],
        edges: [E('pop', 'pre', 'POST /api/preflight', { kind: 'service' }), E('pop', 'seq', 'POST /api/run_sequence', { kind: 'service' }), E('seq', 'stack', ['Prozessstart je Karte', 'Process start per card']),
          R('stack', 'seq', ['Bereitschaft: Node, Port, Prozess', 'Readiness: node, port, process']), E('pop', 'kill', 'POST /api/kill_all_ros2', { kind: 'service' }),
          E('kill', 'stack', ['SIGINT → SIGTERM → SIGKILL', 'SIGINT → SIGTERM → SIGKILL'], { ports: 'rb' })],
        scenarios: [
          SC('run', ['Start', 'Start'], 'i-rocket', 'accent', ['Setup wählen, prüfen, EXECUTE: Karte für Karte starten. Jede Karte schreibt ihr Log nach ~/.ros/nexus_logs.', 'Pick a setup, check, EXECUTE: start card by card. Every card writes its log to ~/.ros/nexus_logs.'], [
            S('pop>pre', ['Der Preflight läuft in REAL automatisch vor dem Start, in FAKE per Knopf Check.', 'The preflight runs automatically before the start in REAL, by the Check button in FAKE.']),
            S('pre>pop', ['Fehler sperren EXECUTE, Warnungen zeigt das Popup nur an.', 'Errors block EXECUTE; the popup only shows warnings.']),
            S('pop>seq', ['EXECUTE übergibt die angehakten Karten an den SequenceRunner.', 'EXECUTE hands the ticked cards to the SequenceRunner.']),
            S('seq>stack', ['Der SequenceRunner startet die nächste Karte als eigenen Prozess, mit Log in ~/.ros/nexus_logs.', 'The SequenceRunner starts the next card as its own process, logging to ~/.ros/nexus_logs.']),
            S('stack>seq', ['Erst wenn Node, Port oder Prozess der Karte bereit ist, folgt die nächste Karte.', 'Only when the node, port or process of the card is ready does the next card follow.'])]),
          SC('kill', 'Kill Daemon', 'i-stop', 'gold', ['Alles stoppen, was in der eigenen ROS-Domain läuft; Stacks anderer Domains bleiben unberührt. Danach startet der ROS-Daemon neu.', 'Stop everything running in the own ROS domain; stacks of other domains stay untouched. Then the ROS daemon restarts.'], [
            S('pop>kill', ['Kill Daemon erfasst nur ROS-Prozesse der eigenen ROS_DOMAIN_ID.', 'Kill Daemon only targets ROS processes of the own ROS_DOMAIN_ID.']),
            S('kill>stack', ['Erst SIGINT für ein sauberes Ende, dann SIGTERM, zuletzt SIGKILL; danach startet der ROS-Daemon neu.', 'First SIGINT for a clean exit, then SIGTERM, finally SIGKILL; then the ROS daemon restarts.'])])],
      },
    },
  };
})();



/* ═════════ Atlas in der Hauptseite: Filter, Auswahl, Ablauf-Panel; Theme + Sprache steuert project_docs.html ═════════ */
(() => {
  const root = document.documentElement;
  const box = document.getElementById('atlas-list');
  if (!box) return;
  const lang = () => (root.lang === 'en' ? 'en' : 'de');
  const L = v => (Array.isArray(v) ? v[lang() === 'en' ? 1 : 0] : v ?? '');
  const ico = id => `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const AREAS = {
    ctl: { de: 'Steuerwege', en: 'Control modes', icon: 'i-pad', hue: 'accent' },
    safe: { de: 'Sicherheit', en: 'Safety', icon: 'i-shield', hue: 'gold' },
    twin: { de: 'Digital Twin', en: 'Digital Twin', icon: 'i-cube', hue: 'blue' },
    vis: { de: 'Vision', en: 'Vision', icon: 'i-cam', hue: 'green' },
    ai: { de: 'KI / VLA-M', en: 'AI / VLA-M', icon: 'i-spark', hue: 'violet' },
    mon: { de: 'UX | Monitoring', en: 'UX | Monitoring', icon: 'i-chart', hue: 'pink' },
    eval: { de: 'Evaluierung', en: 'Evaluation', icon: 'i-flask', hue: 'orange' },
    data: { de: 'Daten', en: 'Data', icon: 'i-db', hue: 'indigo' },
    infra: { de: 'Infrastruktur', en: 'Infrastructure', icon: 'i-layers', hue: 'lime' },
  };
  const STAGES = [['s', 'teal', ['Simulieren', 'Simulate']], ['p', 'gold', ['Prüfen', 'Check']], ['r', 'indigo', ['REAL', 'REAL']]];
  const PLAN = { plan: ['geplant', 'planned'], prep: ['vorbereitet', 'prepared'], doc: ['nur Doku', 'docs only'] };
  const ST_OK = '<svg class="st-ok" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ST_TO = '<svg class="st-to" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const stage = s => `<span class="stage" role="img" aria-label="${STAGES.map(([k, , t]) => `${L(t)}: ${s.includes(k) ? L(['ja', 'yes']) : L(['entfällt', 'n/a'])}`).join(', ')}">`
    + STAGES.map(([k, hue, t], i) => (i ? ST_TO : '') + (s.includes(k)
      ? `<span class="st on" style="--c: var(--${hue})"><i>${ST_OK}</i>${L(t)}</span>` : `<span class="st off"><i></i>${L(t)}</span>`)).join('') + '</span>';

  const grid = box.querySelector('.fa-grid');
  const cardsBox = document.getElementById('cards'), panel = document.getElementById('panel'), fig = document.getElementById('fg-atlas');
  const cards = [...cardsBox.querySelectorAll('.fn')];
  const byId = new Map(cards.map(c => [c.id, c]));
  const FIG_HTML = `<div class="fg-bar"><div class="fg-scn" role="group" aria-label="Szenario wählen"></div><div class="fg-ctl">
    <button type="button" data-act="prev" aria-label="Schritt zurück"><svg><use href="#i-fg-prev"/></svg></button><button type="button" data-act="play" aria-label="Abspielen"><svg><use href="#i-fg-play"/></svg></button><button type="button" data-act="next" aria-label="Schritt vor"><svg><use href="#i-fg-next"/></svg></button>
    <span class="fg-speed" data-act="speed" role="group" aria-label="Tempo"><button type="button" data-v=".5" aria-pressed="false">0,5×</button><button type="button" data-v="1" aria-pressed="true">1×</button><button type="button" data-v="2" aria-pressed="false">2×</button></span></div></div>
    <div class="fg-stage"><svg class="fg-svg" role="group" aria-roledescription="Datenflussdiagramm"></svg></div>
    <div class="fg-foot"><div class="fg-detail"><h3></h3><p></p><div class="io"></div><div class="fg-status" aria-live="polite"></div></div><ol class="fg-steps"></ol></div>
    <div class="fg-legend" aria-hidden="true"></div><figcaption id="fg-atlas-cap"></figcaption><ol class="fg-fallback"></ol>`;
  const flowIds = Object.keys(FLOWS);
  const isLoop = c => !!FLOWS[c.dataset.f]?.loop;

  // Karten anreichern: Bereich, Kreislauf, geplant, Stufen-Badge, Link
  const decorate = () => {
    box.querySelectorAll('[data-stage-ex]').forEach(x => { x.innerHTML = stage(x.dataset.stageEx); });
    cards.forEach(decorateCard);
  };
  const decorateCard = c => {
    const a = AREAS[c.dataset.a], f = FLOWS[c.dataset.f];
    c.style.setProperty('--c', `var(--${a.hue})`);
    let meta = c.querySelector('.fn-meta');
    if (!meta) { meta = document.createElement('div'); meta.className = 'fn-meta'; c.append(meta); }
    const tags = [`<span class="tag area" style="--c: var(--${a.hue})">${ico(a.icon)}${a[lang()]}</span>`];
    if (f?.loop) tags.push(`<span class="tag">${ico('i-loop')}${esc(L(f.loop.t))}</span>`);
    if (c.dataset.plan) tags.push(`<span class="tag plan">${L(PLAN[c.dataset.plan])}</span>`);
    meta.innerHTML = tags.join('') + (c.dataset.s ? stage(c.dataset.s) : '');
    const h = c.querySelector('h3');
    if (!h.querySelector('.fn-link')) h.insertAdjacentHTML('beforeend', `<a class="fn-link" href="#${c.id}">#</a>`);
    const ln = h.querySelector('.fn-link'), name = h.querySelector('.fn-sel').textContent.trim();
    ln.setAttribute('aria-label', `${L(['Link zu', 'Link to'])} ${name}`); ln.title = L(['Link zu dieser Funktion', 'Link to this function']);
    const sel = h.querySelector('.fn-sel');
    sel.setAttribute('aria-pressed', String(c.classList.contains('sel')));
    sel.setAttribute('aria-controls', 'panel');
  };

  // Bereichs-Chips mit Anzahl; Zwischenüberschrift je Bereich in der Kartenliste
  const areaBox = document.getElementById('areas');
  let area = '', onlyLoops = false, q = '';
  const renderAreas = () => {
    areaBox.innerHTML = `<button type="button" class="chip" data-area="" aria-pressed="${!area}">${L(['Alle', 'All'])} <b>${cards.length}</b></button>`
      + Object.entries(AREAS).map(([k, a]) => `<button type="button" class="chip" data-area="${k}" style="--c: var(--${a.hue})" aria-pressed="${area === k}">${ico(a.icon)}${a[lang()]} <b>${cards.filter(c => c.dataset.a === k).length}</b></button>`).join('');
    cardsBox.querySelectorAll('.grp-h').forEach(h => { const a = AREAS[h.dataset.a]; h.innerHTML = `${ico(a.icon)}${a[lang()]}<b>${cards.filter(c => c.dataset.a === h.dataset.a).length}</b>`; });
  };
  areaBox.addEventListener('click', e => { const b = e.target.closest('[data-area]'); if (!b) return; area = b.dataset.area; renderAreas(); filter(); });
  const loopBtn = document.getElementById('only-loops');
  loopBtn.addEventListener('click', () => { onlyLoops = !onlyLoops; loopBtn.setAttribute('aria-pressed', String(onlyLoops)); filter(); });
  const qIn = document.getElementById('q');
  qIn.addEventListener('input', () => { q = qIn.value.trim().toLowerCase(); filter(); });

  // Suchtext je Karte: Titel + Text (beide Sprachen) + Topics und Knoten ihres Ablaufs
  const hay = new Map(cards.map(c => {
    const f = FLOWS[c.dataset.f], txt = [...c.querySelectorAll('[data-en]')].map(x => `${x.dataset.de ?? x.innerHTML} ${x.dataset.en}`).join(' ');
    const spec = f ? [L(f.t), ...f.spec.edges.map(e => [e.label].flat().join(' ')), ...f.spec.nodes.map(n => [n.label, n.sub].flat().join(' '))].join(' ') : '';
    return [c.id, `${txt} ${spec} ${c.id}`.replace(/<[^>]+>/g, ' ').toLowerCase()];
  }));
  const count = document.getElementById('count'), empty = document.getElementById('empty');
  function filter() {
    let n = 0;
    for (const c of cards) {
      const ok = (!area || c.dataset.a === area) && (!onlyLoops || isLoop(c)) && (!q || hay.get(c.id).includes(q));
      c.hidden = !ok; n += ok;
    }
    cardsBox.querySelectorAll('.grp-h').forEach(h => { h.hidden = !cards.some(c => !c.hidden && c.dataset.a === h.dataset.a); });
    empty.hidden = n > 0;
    count.textContent = `${n} / ${cards.length}`;
    count.setAttribute('aria-label', L([`${n} von ${cards.length} Funktionen`, `${n} of ${cards.length} functions`]));
  }
  const resetFilter = (a = '', loops = false) => {
    area = a; onlyLoops = loops; q = ''; qIn.value = ''; loopBtn.setAttribute('aria-pressed', String(loops));
    renderAreas(); filter();
  };

  // Ablauf anzeigen: Kopf, Ring (Kreislauf), Flow-Graph, Funktionen dieses Ablaufs
  let graph = null, ring = null, curCard = null;
  const narrow = matchMedia('(max-width: 1100px)');
  function showFlow(fid, card) {
    const f = FLOWS[fid];
    const kick = document.getElementById('pn-kick');
    if (!f) {  // Bedienhilfe ohne eigenen Datenweg: Karte selbst zeigen, kein Graph
      const a = AREAS[card.dataset.a], title = document.getElementById('pn-title');
      panel.style.setProperty('--c', `var(--${a.hue})`);
      kick.innerHTML = `${ico(a.icon)}<span>${a[lang()]}</span>`;
      title.textContent = card.querySelector('.fn-sel').textContent.trim(); title.removeAttribute('data-en'); delete title.dataset.de;
      document.getElementById('pn-text').innerHTML = card.querySelector('p').innerHTML;
      document.getElementById('pn-meta').innerHTML = `<p class="hint" style="flex-basis: 100%">${ico('i-link')}<span>${L(['Kein eigener Datenweg im ROS-Graphen: Die Funktion arbeitet im Browser bzw. als Konfiguration.', 'No path of its own in the ROS graph: the function works in the browser or as configuration.'])}</span></p>`;
      ring?.destroy(); ring = null;
      const lb = document.getElementById('loop'); lb.hidden = true; lb.innerHTML = '';
      graph?.destroy(); graph = null; fig.hidden = true;
      document.getElementById('pn-fns').hidden = true;
      return;
    }
    fig.hidden = false;
    panel.style.setProperty('--c', `var(--${f.hue || 'accent'})`);
    kick.innerHTML = `${ico(f.icon || 'i-link')}<span>${L(['Ablauf', 'Flow'])} ${flowIds.indexOf(fid) + 1} / ${flowIds.length}</span>${f.loop ? `<span>· ${L(['Kreislauf', 'Loop'])}</span>` : ''}`;
    const title = document.getElementById('pn-title');
    title.innerHTML = esc(L(f.t)); title.removeAttribute('data-en'); delete title.dataset.de;
    document.getElementById('pn-text').innerHTML = L(f.d);
    const meta = [];
    if (f.s) meta.push(stage(f.s));
    if (f.plan) meta.push(`<span class="tag plan">${L(PLAN.plan)}: ${esc(L(f.plan))}</span>`);
    document.getElementById('pn-meta').innerHTML = meta.join('') + (f.note ? `<p class="hint" style="flex-basis: 100%">${ico('i-warn')}<span>${L(f.note)}</span></p>` : '');
    // Ring
    const lb = document.getElementById('loop');
    ring?.destroy(); ring = null;
    lb.hidden = !f.loop;
    if (f.loop) {
      lb.innerHTML = `<div class="ring-host" id="ring-${fid}"></div><div class="loop-txt"><h3>${ico('i-loop')}${L(['Kreislauf', 'Loop'])} · ${esc(L(f.loop.t))}</h3>
        <ol>${f.loop.st.map(([t, s, plan]) => `<li><b>${esc(L(t))}</b> · ${esc(L(s))}${plan ? ` <span class="tag plan">${L(PLAN.plan)}</span>` : ''}</li>`).join('')}</ol>
        ${f.loop.back ? `<p class="loop-back">${ico('i-loop')}<span><b>${L(['Wiederholung', 'Repeat'])}:</b> ${esc(L(f.loop.back.t))}</span></p>` : ''}
        ${f.loop.x ? `<p>${esc(L(f.loop.x))}</p>` : ''}
        <p>${L(['Die belegten Topics stehen im Ablauf darunter.', 'The verified topics are in the flow below.'])}</p></div>`;
      const lis = lb.querySelectorAll('.loop-txt li');
      ring = Ring.create(lb.querySelector('.ring-host'), f.loop, { lang: lang(), hue: f.hue, onStation: k => lis.forEach((li, i) => li.classList.toggle('now', i === k)) });
    } else lb.innerHTML = '';
    // Flow-Graph neu aufbauen (Engine bindet Knöpfe beim Erzeugen)
    graph?.destroy();
    fig.classList.remove('fg-ready');
    fig.innerHTML = FIG_HTML;
    fig.querySelector('.fg-bar').dataset.title = L(['Datenfluss', 'Data flow']);
    fig.querySelector('figcaption').textContent = L(f.cap || f.t);
    fig.querySelector('.fg-fallback').innerHTML = f.spec.scenarios.map(s => `<li>${esc(L(s.label))}: ${s.steps.map(x => esc(L(x.note))).join(' → ')}</li>`).join('');
    graph = FlowGraph.create(fig, f.spec, { lang: lang() });
    // Funktionen dieses Ablaufs
    const same = cards.filter(c => c.dataset.f === fid);
    document.getElementById('pn-fns').hidden = same.length < 2;
    document.getElementById('pn-chips').innerHTML = same.map(c => `<button type="button" class="chip" data-go="${c.id}" aria-pressed="${c === card}">${esc(c.querySelector('.fn-sel').textContent.trim())}</button>`).join('');
  }
  function select(card, opts = {}) {
    if (!card) return;
    if (card.hidden) resetFilter();
    cards.forEach(c => { c.classList.toggle('sel', c === card); c.querySelector('.fn-sel')?.setAttribute('aria-pressed', String(c === card)); });
    curCard = card;
    placePanel();
    showFlow(card.dataset.f, card);
    if (opts.hash) history.replaceState(null, '', `#${card.id}`);
    if (opts.scroll) (narrow.matches ? panel : card).scrollIntoView({ block: narrow.matches ? 'start' : 'nearest' });
  }
  // Schmal: Ablauf direkt unter der gewählten Karte; breit: rechte Spalte
  function placePanel() {
    if (narrow.matches && curCard) curCard.after(panel);
    else if (!narrow.matches && panel.parentElement !== grid) grid.append(panel);
  }
  narrow.addEventListener('change', placePanel);

  cardsBox.addEventListener('click', e => {
    const sel = e.target.closest('.fn-sel'); if (sel) { select(sel.closest('.fn'), { hash: true }); return; }
    const ln = e.target.closest('.fn-link'); if (ln) { e.preventDefault(); select(ln.closest('.fn'), { hash: true }); }
  });
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    select(byId.get(b.dataset.go), { hash: true, scroll: true });
  });
  window.addEventListener('hashchange', () => { const c = byId.get(location.hash.slice(1)); if (c) select(c, { scroll: true }); });

  // Übersicht darüber: Bereichs-Kachel/Ringstück → Liste auf den Bereich gefiltert; Kreislauf-Chip → seinen Ablauf zeigen
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-fa-area]'), lp = e.target.closest('[data-fa-flow]');
    if (!a && !lp) return;
    e.preventDefault();
    if (a) { resetFilter(a.dataset.faArea); select(cards.find(c => !c.hidden)); box.scrollIntoView(); return; }
    resetFilter('', true);
    select(cards.find(c => c.dataset.f === lp.dataset.faFlow), { hash: true });
    box.scrollIntoView();
  });

  // Sprache schaltet project_docs.html (data-en); danach Karten, Chips und Ablauf neu
  const setPh = () => box.querySelectorAll('[data-en-ph]').forEach(el => {
    if (el.dataset.dePh === undefined) el.dataset.dePh = el.placeholder;
    el.placeholder = lang() === 'en' ? el.dataset.enPh : el.dataset.dePh;
  });
  new MutationObserver(() => { setPh(); decorate(); renderAreas(); filter(); if (curCard) showFlow(curCard.dataset.f, curCard); })
    .observe(root, { attributes: true, attributeFilter: ['lang'] });

  for (const c of cards) if (c.dataset.f && !FLOWS[c.dataset.f]) console.warn('[atlas] Karte mit unbekanntem Ablauf:', c.id, c.dataset.f);
  setPh(); decorate(); renderAreas(); filter();
  const hashCard = byId.get(location.hash.slice(1));
  select(hashCard || cardsBox.querySelector('.fn[data-default]') || cards[0], { scroll: !!hashCard });
})();
