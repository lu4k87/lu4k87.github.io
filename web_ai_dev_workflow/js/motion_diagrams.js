/* motion_diagrams.js – animierte Diagramm-Arten (Skill ~/ai_dev_workflow_global/skills/motion-diagrams, Regeln in SKILL.md).
   Kein Framework, keine Bibliothek, läuft per file:// und über die UX | Nexus Launcher.
   MotionDiagram.create(figure, SPEC, { lang, fx, autoplay }) → { seek(t), play(), pause(), step(i), setLang(l), setFx(list), duration, intro, destroy() }
   Eine Uhr: jedes Bild ist eine reine Funktion der Zeit t (seek in beliebiger Reihenfolge) → Video-Export per ?render + window.seek(s). */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const HOP = .75, DWELL = .45, END = 1.4, PULSE = .7, FADE = .35, PAD = 16;
  const FX = ['stagger', 'draw', 'packets', 'comet', 'pulse', 'dash', 'glow', 'spotlight', 'count'];
  const HUES = ['accent', 'teal', 'green', 'gold', 'violet', 'indigo', 'red'];
  const DEFAULT_FX = {
    process: ['stagger', 'draw', 'packets', 'pulse', 'spotlight'],
    flowchart: ['stagger', 'draw', 'packets', 'pulse', 'spotlight'],
    sequence: ['stagger', 'draw', 'packets', 'spotlight'],
    state: ['stagger', 'draw', 'comet', 'pulse', 'glow'],
    network: ['stagger', 'draw', 'packets', 'pulse'],
    cycle: ['stagger', 'draw', 'comet', 'glow'],
    timeline: ['stagger', 'draw', 'pulse'],
    sankey: ['stagger', 'draw', 'packets', 'count', 'spotlight'],
    tree: ['stagger', 'draw', 'packets', 'glow'],
    layers: ['stagger', 'packets', 'glow', 'spotlight'],
  };
  const UI = {
    de: { play: 'Abspielen', pause: 'Pause', prev: 'Schritt zurück', next: 'Schritt vor', build: 'Aufbau …', step: 'Schritt',
      sample: 'Beispielwerte', overview: 'Überblick – Schritte mit ◀ ▶', send: 'Verteilen', back: 'Rückmeldung', all: 'Alle Ströme' },
    en: { play: 'Play', pause: 'Pause', prev: 'Previous step', next: 'Next step', build: 'Building …', step: 'Step',
      sample: 'Sample values', overview: 'Overview – step with ◀ ▶', send: 'Broadcast', back: 'Feedback', all: 'All flows' },
  };
  const ICON = { play: 'M8 5v14l11-7z', pause: 'M7 5h4v14H7zM13 5h4v14h-4z', prev: 'M18 6v12l-9-6zM6 6h2v12H6z', next: 'M6 6v12l9-6zM16 6h2v12h-2z' };

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  const easeOut = u => 1 - Math.pow(1 - u, 3);
  const r1 = v => Math.round(v * 10) / 10;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* Zeilenumbruch nach geschätzter Zeichenbreite; zu lange Wörter werden mit „-“ getrennt, Rest mit „…“ gekürzt. */
  function wrap(text, maxW, fs, maxLines, mono) {
    const max = Math.max(4, Math.floor(maxW / (fs * (mono ? .62 : .56))));
    const lines = []; let cur = '', glue = false;
    for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) {
      word.split(/(?<=-)(?=.)/).forEach((w, i) => {
        while (w.length > max) { if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, max - 1) + '-'); w = w.slice(max - 1); }
        const next = cur ? cur + (i || glue ? '' : ' ') + w : w;
        if (next.length <= max) cur = next; else { lines.push(cur); cur = w; }
        glue = w.endsWith('-');
      });
      glue = false;
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      const keep = lines.slice(0, maxLines);
      keep[maxLines - 1] = keep[maxLines - 1].slice(0, max - 1).replace(/[\s-]+$/, '') + '…';
      return keep;
    }
    return lines;
  }

  const mk = (id, o) => Object.assign({ id, lines: [], subs: [], shape: 'rect', fs: 14 }, o);
  const textH = n => (n.num ? 15 : 0) + n.lines.length * n.fs * 1.22 + n.subs.length * 15 + (n.value != null ? 15 : 0);
  const rawLabel = (n) => n.raw || n.lines.join(' ');

  /* Randpunkt eines Rechtecks/Kreises in Richtung (tx, ty) */
  function border(n, tx, ty, gap = 2) {
    const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy) || 1;
    if (n.shape === 'circle' || n.shape === 'dot') return [n.x + dx / d * (n.w / 2 + gap), n.y + dy / d * (n.w / 2 + gap)];
    const k = Math.min((n.w / 2 + gap) / Math.abs(dx || 1e-9), (n.h / 2 + gap) / Math.abs(dy || 1e-9));
    return [n.x + dx * k, n.y + dy * k];
  }
  const viaRun = (r, tr, by) => ({
    label: tr(r.label), hue: r.hue, trail: r.trail !== false,
    steps: r.via.map((id, i) => ({ edges: i ? [r.via[i - 1] + '>' + id] : [], nodes: [id], note: tr(r.notes?.[i]) || (by[id] ? rawLabel(by[id]) : id) })),
  });

  /* ═════════ Layouts: SPEC + Breite W → Knoten, Kanten, Deko, Läufe ═════════ */
  const LAYOUT = {};

  LAYOUT.process = (s, W, tr) => {
    const n = s.steps.length, gap = 40, wH = (W - 2 * PAD - (n - 1) * gap) / n, vert = wH < 118;
    const w = vert ? Math.min(W - 2 * PAD, 460) : wH, fs = vert || wH < 150 ? 13 : 14;
    const nodes = s.steps.map((x, i) => mk(x.id || 's' + i, {
      hue: x.hue, w, fs, num: String(i + 1).padStart(2, '0'), raw: tr(x.label),
      lines: wrap(tr(x.label), w - 20, fs, 2), subs: x.sub ? wrap(tr(x.sub), w - 20, 11.5, 2, true) : [] }));
    const h = Math.max(vert ? 56 : 84, ...nodes.map(nd => textH(nd) + 22));
    nodes.forEach((nd, i) => { nd.h = h; nd.x = vert ? W / 2 : PAD + w / 2 + i * (w + gap); nd.y = vert ? PAD + h / 2 + i * (h + 30) : PAD + h / 2; });
    const edges = nodes.slice(1).map((b, i) => { const a = nodes[i];
      return { key: a.id + '>' + b.id, from: a.id, to: b.id,
        d: vert ? `M${a.x},${a.y + h / 2 + 2}V${b.y - h / 2 - 2}` : `M${a.x + w / 2 + 2},${a.y}H${b.x - w / 2 - 2}` }; });
    const by = Object.fromEntries(nodes.map(nd => [nd.id, nd]));
    return { nodes, edges, runs: [viaRun({ label: s.runLabel || s.title, via: nodes.map(nd => nd.id), notes: s.steps.map(x => x.note) }, tr, by)] };
  };

  LAYOUT.flowchart = (s, W, tr) => {
    const C = Math.max(...s.nodes.map(x => x.col)) + 1, colW = (W - 2 * PAD) / C, cmp = colW < 150;
    const fs = cmp ? 12.5 : 14, rowH = 116;
    const nodes = s.nodes.map(x => {
      const dia = x.kind === 'decision', w = Math.min(colW - (cmp ? 10 : 24), dia ? 200 : 220);
      const nd = mk(x.id, { hue: x.hue || (x.kind === 'stop' ? 'red' : undefined), w, fs, kind: x.kind, shape: dia ? 'diamond' : 'rect', raw: tr(x.label),
        lines: wrap(tr(x.label), dia ? w * .6 : w - 18, fs, dia || cmp ? 3 : 2), subs: x.sub && !dia ? wrap(tr(x.sub), w - 18, 11.5, 1, true) : [] });
      nd.h = dia ? Math.max(76, textH(nd) * 1.9 + 8) : Math.max(50, textH(nd) + 20);
      nd.x = PAD + colW * (x.col + .5); nd.y = PAD + rowH * x.row + rowH / 2 - 14;
      return nd;
    });
    const by = Object.fromEntries(nodes.map(nd => [nd.id, nd]));
    const side = (nd, dir) => nd.x + dir * nd.w / 2;
    const edges = s.edges.map(x => {
      const a = by[x.from], b = by[x.to];
      if (!a || !b) return null;
      let d, lp;
      if (b.y > a.y + 4) {
        if (Math.abs(a.x - b.x) < 2) { d = `M${a.x},${a.y + a.h / 2}V${b.y - b.h / 2 - 1}`; lp = { x: a.x + 8, y: a.y + a.h / 2 + 15, anchor: 'start' }; }
        else {
          const dir = Math.sign(b.x - a.x);
          if (a.shape === 'diamond') { d = `M${side(a, dir)},${a.y}H${b.x}V${b.y - b.h / 2 - 1}`; lp = { x: side(a, dir) + dir * 8, y: a.y - 8, anchor: dir > 0 ? 'start' : 'end' }; }
          else { const my = (a.y + a.h / 2 + b.y - b.h / 2) / 2; d = `M${a.x},${a.y + a.h / 2}V${my}H${b.x}V${b.y - b.h / 2 - 1}`; lp = { x: a.x + 8, y: a.y + a.h / 2 + 15, anchor: 'start' }; }
        }
      } else if (Math.abs(b.y - a.y) <= 4) {
        const dir = Math.sign(b.x - a.x);
        d = `M${side(a, dir)},${a.y}H${side(b, -dir) - dir}`; lp = { x: (side(a, dir) + side(b, -dir)) / 2, y: a.y - 8, anchor: 'middle' };
      } else {
        const xr = Math.max(a.x + a.w / 2, b.x + b.w / 2) + 22;
        d = `M${a.x + a.w / 2},${a.y}H${xr}V${b.y}H${b.x + b.w / 2 + 1}`; lp = { x: xr + 6, y: (a.y + b.y) / 2, anchor: 'start' };
      }
      return { key: x.from + '>' + x.to, from: x.from, to: x.to, d, hue: x.hue, dash: x.dash ? '6 4' : '', lab: x.label ? [tr(x.label)] : [], lpos: lp };
    });
    return { nodes, edges, runs: (s.paths || []).map(p => viaRun(p, tr, by)) };
  };

  LAYOUT.sequence = (s, W, tr) => {
    const n = s.actors.length, colW = (W - 2 * PAD) / n, cmp = colW < 150, fs = colW < 110 ? 11.5 : cmp ? 12 : 14, bw = Math.min(colW - (cmp ? 4 : 12), 190);
    const nodes = s.actors.map(x => mk(x.id, { hue: x.hue, w: bw, fs, raw: tr(x.label),
      lines: wrap(tr(colW < 110 && x.short ? x.short : x.label), bw - 10, fs, cmp ? 3 : 2), subs: x.sub && colW >= 110 ? wrap(tr(x.sub), bw - 10, 11.5, 1, true) : [] }));
    const bh = Math.max(48, ...nodes.map(nd => textH(nd) + 16));
    nodes.forEach((nd, i) => { nd.h = bh; nd.x = PAD + colW * (i + .5); nd.y = PAD + bh / 2; });
    const by = Object.fromEntries(nodes.map(nd => [nd.id, nd]));
    const rowH = cmp ? 60 : 52, y0 = PAD + bh + (cmp ? 52 : 44);
    const edges = s.messages.map((m, k) => {
      const a = by[m.from], b = by[m.to];
      if (!a || !b) return null;
      const y = y0 + k * rowH, dir = Math.sign(b.x - a.x) || 1, self = a === b;
      const span = self ? colW - 24 : Math.abs(b.x - a.x) - 16;
      const lab = wrap(tr(m.label), Math.max(64, span), 12, cmp ? 2 : 1, true);
      return { key: 'm' + k, from: m.from, to: m.to, appear: 'run', hue: m.hue, dash: m.kind === 'reply' ? '5 4' : '', lab,
        d: self ? `M${a.x + 4},${y - 8}h34v16h-32` : `M${a.x + dir * 4},${y}H${b.x - dir * 4}`,
        lpos: { x: self ? a.x + 46 : (a.x + b.x) / 2, y: y - 9 - (lab.length - 1) * 14, anchor: self ? 'start' : 'middle' } };
    });
    const H = y0 + (s.messages.length - 1) * rowH + 24;
    const deco = nodes.map(nd => ({ tag: 'line', cls: 'md-life', attrs: { x1: nd.x, x2: nd.x, y1: nd.y + bh / 2, y2: H } }));
    const steps = s.messages.map((m, k) => ({ edges: ['m' + k], nodes: [m.to], note: tr(m.note || m.label) }));
    return { nodes, edges, deco, runs: [{ label: tr(s.runLabel || s.title), trail: true, steps }] };
  };

  LAYOUT.state = (s, W, tr) => {
    let S = s.states, C = Math.max(...S.map(x => x.col)) + 1, R = Math.max(...S.map(x => x.row)) + 1, colW = (W - 2 * PAD) / C;
    const flip = colW < 120 && C > R;
    if (flip) { S = S.map(x => ({ ...x, col: x.row, row: x.col })); [C, R] = [R, C]; colW = (W - 2 * PAD) / C; }
    const cmp = colW < 150, tiny = colW < 130, fs = tiny ? 11.5 : cmp ? 12 : 14, rowH = flip ? 104 : 132;
    const nodes = S.map(x => {
      const w = Math.min(colW - (cmp ? 12 : 26), 200);
      const nd = mk(x.id, { hue: x.hue || (x.kind === 'error' ? 'red' : undefined), w, fs, kind: x.kind, raw: tr(x.label),
        lines: wrap(tr(x.label), w - 12, fs, tiny ? 3 : 2), subs: x.sub && !tiny ? wrap(tr(x.sub), w - 16, 11.5, cmp ? 1 : 2, true) : [] });
      nd.h = Math.max(52, textH(nd) + 20); nd.x = PAD + colW * (x.col + .5); nd.y = PAD + rowH * x.row + rowH / 2;
      return nd;
    });
    const by = Object.fromEntries(nodes.map(nd => [nd.id, nd]));
    const keys = new Set(s.transitions.map(x => x.from + '>' + x.to));
    const edges = s.transitions.map(x => {
      const a = by[x.from], b = by[x.to];
      if (!a || !b) return null;
      const bend = x.bend ?? (keys.has(x.to + '>' + x.from) ? 22 : 0);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const px = -(b.y - a.y) / len, py = (b.x - a.x) / len, cx = mx + px * bend * 2, cy = my + py * bend * 2;
      const [x0, y0] = border(a, bend ? cx : b.x, bend ? cy : b.y), [x1, y1] = border(b, bend ? cx : a.x, bend ? cy : a.y);
      const d = bend ? `M${r1(x0)},${r1(y0)}Q${r1(cx)},${r1(cy)} ${r1(x1)},${r1(y1)}` : `M${r1(x0)},${r1(y0)}L${r1(x1)},${r1(y1)}`;
      const ax = bend ? .25 * x0 + .5 * cx + .25 * x1 : (x0 + x1) / 2, ay = bend ? .25 * y0 + .5 * cy + .25 * y1 : (y0 + y1) / 2;
      const off = bend ? Math.sign(bend) * 12 : 0;
      return { key: x.from + '>' + x.to, from: x.from, to: x.to, d, hue: x.hue, dash: x.dash ? '6 4' : '',
        lab: x.label && !tiny ? wrap(tr(x.label), 150, 12, 2, true) : [], lpos: { x: ax + px * off, y: ay + py * off + 4, anchor: 'middle' } };
    });
    return { nodes, edges, runs: (s.runs || []).map(r => viaRun(r, tr, by)) };
  };

  LAYOUT.network = (s, W, tr, ui) => {
    const n = s.nodes.length, wide = W >= 620, r = wide ? 24 : 20, R0 = wide ? 52 : 42, fs = wide ? 13.5 : 12;
    const rx = wide ? Math.min(W / 2 - PAD - 92, 330) : W / 2 - PAD - 44, ry = wide ? 150 : rx * .95;
    const cx = W / 2, cy = PAD + ry + r + 44;
    const hub = mk('hub', { shape: 'circle', w: 2 * R0, h: 2 * R0, x: cx, y: cy, hue: s.center.hue, fs, raw: tr(s.center.label),
      lines: wrap(tr(s.center.label), 2 * R0 - 16, fs, 3), subs: s.center.sub ? wrap(tr(s.center.sub), 2 * R0 - 12, 11.5, 1, true) : [] });
    const nodes = [hub, ...s.nodes.map((x, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n, x0 = cx + rx * Math.cos(a), y0 = cy + ry * Math.sin(a), up = Math.sin(a) < -.2;
      const nd = mk(x.id, { shape: 'circle', w: 2 * r, h: 2 * r, x: x0, y: y0, hue: x.hue, fs, inner: x.short, raw: tr(x.label),
        lines: wrap(tr(x.label), wide ? 150 : 100, fs, 2), subs: x.sub ? wrap(tr(x.sub), wide ? 150 : 100, 11.5, 1, true) : [] });
      nd.text = { x: x0, y: up ? y0 - r - 8 : y0 + r + 8, anchor: 'middle', valign: up ? 'bottom' : 'top' };
      return nd;
    })];
    const by = Object.fromEntries(nodes.map(nd => [nd.id, nd]));
    const line = (a, b) => { const [x0, y0] = border(a, b.x, b.y), [x1, y1] = border(b, a.x, a.y); return `M${r1(x0)},${r1(y0)}L${r1(x1)},${r1(y1)}`; };
    const edges = s.nodes.map(x => ({ key: 'hub>' + x.id, from: 'hub', to: x.id, d: line(hub, by[x.id]), arrow: false }));
    (s.links || []).forEach(([p, q]) => {
      const a = by[p], b = by[q];
      if (!a || !b) return;
      const mx = (a.x + b.x) / 2 + (cx - (a.x + b.x) / 2) * .35, my = (a.y + b.y) / 2 + (cy - (a.y + b.y) / 2) * .35;
      const [x0, y0] = border(a, mx, my), [x1, y1] = border(b, mx, my);
      edges.push({ key: p + '>' + q, from: p, to: q, d: `M${r1(x0)},${r1(y0)}Q${r1(mx)},${r1(my)} ${r1(x1)},${r1(y1)}`, arrow: false, dash: '4 4' });
    });
    const runs = s.runs ? s.runs.map(rn => rn.via ? viaRun(rn, tr, by) : { label: tr(rn.label), hue: rn.hue, trail: rn.trail !== false, steps: rn.steps.map(st => ({ ...st, note: tr(st.note) })) }) : [
      { label: ui.send, trail: false, steps: [{ edges: s.nodes.map(x => 'hub>' + x.id), note: tr(s.center.label) + ' → ' + n + '×' }] },
      { label: ui.back, trail: false, steps: [{ edges: s.nodes.map(x => x.id + '>hub'), note: n + '× → ' + tr(s.center.label) }] }];
    return { nodes, edges, runs };
  };

  LAYOUT.cycle = (s, W, tr) => {
    const n = s.steps.length, wide = W >= 640, r = wide ? 26 : 22, R = wide ? 150 : Math.min(W / 2 - PAD - r - 4, 140);
    const cx = W / 2, cy = PAD + R + r + (wide ? 34 : 8), fs = wide ? 14 : 13;
    const nodes = s.steps.map((x, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n, c = Math.cos(a), sn = Math.sin(a);
      const ww = Math.abs(c) > .3 ? Math.min(230, W / 2 - R - r - 24 - PAD) : 220;
      const nd = mk(x.id || 'c' + i, { shape: 'circle', w: 2 * r, h: 2 * r, x: cx + R * c, y: cy + R * sn, hue: x.hue, fs, inner: String(i + 1), raw: tr(x.label),
        lines: wide ? wrap(tr(x.label), ww, fs, 2) : [], subs: wide && x.sub ? wrap(tr(x.sub), ww, 11.5, 2, true) : [] });
      if (wide) nd.text = { x: cx + (R + r + 12) * c, y: cy + (R + r + 12) * sn, anchor: c > .3 ? 'start' : c < -.3 ? 'end' : 'middle', valign: sn > .5 ? 'top' : sn < -.5 ? 'bottom' : 'middle' };
      nd.a = a;
      return nd;
    });
    const dl = (r + 6) / R, pt = a => `${r1(cx + R * Math.cos(a))},${r1(cy + R * Math.sin(a))}`;
    const edges = nodes.map((a, i) => { const b = nodes[(i + 1) % n], a1 = i === n - 1 ? b.a + 2 * Math.PI : b.a;
      return { key: a.id + '>' + b.id, from: a.id, to: b.id, d: `M${pt(a.a + dl)}A${R},${R} 0 0 1 ${pt(a1 - dl)}` }; });
    const deco = [];
    if (s.center) deco.push({ tag: 'text', x: cx, y: cy, anchor: 'middle', valign: 'middle',
      lines: [...wrap(tr(s.center.label), R * 1.1, 15, 2).map(t => ({ t, cls: 'md-ctr' })), ...(s.center.sub ? wrap(tr(s.center.sub), R * 1.2, 11.5, 2, true).map(t => ({ t, cls: 'md-sub' })) : [])] });
    if (!wide) {
      let y = cy + R + r + 24;
      s.steps.forEach((x, i) => {
        const ls = wrap(tr(x.label) + (x.sub ? ' – ' + tr(x.sub) : ''), W - 2 * PAD - 30, 13, 2);
        deco.push({ tag: 'text', x: PAD, y, anchor: 'start', valign: 'top', lines: ls.map((t, k) => ({ t: (k ? '' : (i + 1) + '  ') + t, cls: 'md-leg', dx: k ? 22 : 0 })) });
        y += ls.length * 17 + 8;
      });
    }
    const by = Object.fromEntries(nodes.map(nd => [nd.id, nd]));
    const via = [...nodes.map(nd => nd.id), nodes[0].id];
    const run = viaRun({ label: s.runLabel || s.title, via, notes: [...s.steps.map(x => x.note), s.steps[0].note], trail: false }, tr, by);
    return { nodes, edges, deco, runs: [run] };
  };

  LAYOUT.timeline = (s, W, tr) => {
    const n = s.events.length, slot = (W - 2 * PAD) / n, hor = slot >= 130, fs = 13.5;
    const nodes = s.events.map((x, i) => mk(x.id || 'e' + i, { shape: 'dot', w: 18, h: 18, kind: x.kind || 'done', hue: x.hue, fs, num: x.date ? tr(x.date) : '', raw: tr(x.label),
      lines: wrap(tr(x.label), hor ? Math.min(2 * slot - 16, 240) : W - 2 * PAD - 40, fs, 2),
      subs: x.sub ? wrap(tr(x.sub), hor ? Math.min(2 * slot - 16, 240) : W - 2 * PAD - 40, 11.5, 2, true) : [] }));
    if (hor) {
      const up = Math.max(...nodes.filter((_, i) => i % 2 === 0).map(textH));
      const ay = PAD + up + 26;
      nodes.forEach((nd, i) => { nd.x = PAD + slot * (i + .5); nd.y = ay;
        nd.text = i % 2 ? { x: nd.x, y: ay + 22, anchor: 'middle', valign: 'top' } : { x: nd.x, y: ay - 20, anchor: 'middle', valign: 'bottom' }; });
    } else {
      let y = PAD + 12;
      nodes.forEach(nd => { nd.x = PAD + 12; nd.y = y; nd.text = { x: PAD + 36, y: y - 10, anchor: 'start', valign: 'top' }; y += Math.max(54, textH(nd) + 20); });
    }
    const edges = nodes.slice(1).map((b, i) => { const a = nodes[i];
      return { key: a.id + '>' + b.id, from: a.id, to: b.id, arrow: false, d: hor ? `M${a.x + 11},${a.y}H${b.x - 11}` : `M${a.x},${a.y + 11}V${b.y - 11}` }; });
    nodes.forEach(nd => { if (nd.kind === 'now') nd.alive = true; });
    const by = Object.fromEntries(nodes.map(nd => [nd.id, nd]));
    return { nodes, edges, runs: [viaRun({ label: s.runLabel || s.title, via: nodes.map(nd => nd.id), notes: s.events.map(x => x.note) }, tr, by)] };
  };

  LAYOUT.sankey = (s, W, tr, ui) => {
    const wide = W >= 620, labW = wide ? 132 : 92, C = s.columns.length, avail = wide ? 300 : 260, gap = 14, bar = 12;
    const all = s.columns.flat(), val = {};
    all.forEach(x => {
      const out = s.flows.filter(f => f.from === x.id).reduce((a, f) => a + f.value, 0);
      const inn = s.flows.filter(f => f.to === x.id).reduce((a, f) => a + f.value, 0);
      val[x.id] = Math.max(out, inn);
    });
    const k = Math.min(...s.columns.map(col => (avail - gap * (col.length - 1)) / col.reduce((a, x) => a + val[x.id], 0)));
    const xs = s.columns.map((_, c) => PAD + labW + c * (W - 2 * PAD - 2 * labW - bar) / Math.max(1, C - 1));
    const fmt = v => v + (s.unit ? ' ' + tr(s.unit) : '');
    const nodes = [];
    s.columns.forEach((col, c) => {
      const made = col.map(x => mk(x.id, { shape: 'bar', w: bar, h: Math.max(2, val[x.id] * k), hue: x.hue, fs: wide ? 13 : 12, value: val[x.id], fmt, raw: tr(x.label),
        lines: wrap(tr(x.label), labW - 22, wide ? 13 : 12, wide ? 2 : 1) }));
      const slot = nd => Math.max(nd.h, textH(nd) + 4);
      const tot = made.reduce((a, nd) => a + slot(nd), 0) + gap * (col.length - 1);
      let y = PAD + 24 + Math.max(0, (avail - tot) / 2);
      made.forEach(nd => {
        const last = c === C - 1, first = c === 0, sl = slot(nd);
        nd.x = xs[c] + bar / 2; nd.y = y + sl / 2;
        nd.text = { x: first ? xs[c] - 8 : xs[c] + bar + 8, y: nd.y, anchor: first ? 'end' : 'start', valign: 'middle', halo: !first && !last };
        nodes.push(nd); y += sl + gap;
      });
    });
    const by = Object.fromEntries(nodes.map(nd => [nd.id, nd]));
    const outY = {}, inY = {};
    nodes.forEach(nd => { outY[nd.id] = inY[nd.id] = nd.y - nd.h / 2; });
    const edges = s.flows.map(f => {
      const a = by[f.from], b = by[f.to];
      if (!a || !b) return null;
      const w = f.value * k, s0 = outY[f.from], t0 = inY[f.to], x0 = a.x + bar / 2, x1 = b.x - bar / 2, xm = (x0 + x1) / 2;
      outY[f.from] += w; inY[f.to] += w;
      return { key: f.from + '>' + f.to, from: f.from, to: f.to, kind: 'ribbon', hue: f.hue || a.hue, width: w, stream: true,
        d: `M${r1(x0)},${r1(s0)}C${r1(xm)},${r1(s0)} ${r1(xm)},${r1(t0)} ${r1(x1)},${r1(t0)}V${r1(t0 + w)}C${r1(xm)},${r1(t0 + w)} ${r1(xm)},${r1(s0 + w)} ${r1(x0)},${r1(s0 + w)}Z`,
        center: `M${r1(x0)},${r1(s0 + w / 2)}C${r1(xm)},${r1(s0 + w / 2)} ${r1(xm)},${r1(t0 + w / 2)} ${r1(x1)},${r1(t0 + w / 2)}` };
    });
    const deco = s.sample ? [{ tag: 'text', x: W - PAD, y: PAD, anchor: 'end', valign: 'top', lines: [{ t: ui.sample, cls: 'md-sample' }] }] : [];
    const src = s.columns.slice(0, -1).flat().filter(x => s.flows.some(f => f.from === x.id));
    const steps = src.map(x => { const fl = s.flows.filter(f => f.from === x.id);
      return { edges: fl.map(f => f.from + '>' + f.to), nodes: fl.map(f => f.to), note: `${tr(x.label)}: ${fmt(fl.reduce((a, f) => a + f.value, 0))}`, hold: 2.2 }; });
    steps.push({ edges: s.flows.map(f => f.from + '>' + f.to), nodes: nodes.map(nd => nd.id), note: ui.all, hold: 3 });
    return { nodes, edges, deco, runs: [{ label: tr(s.runLabel || s.title), trail: false, steps }] };
  };

  LAYOUT.tree = (s, W, tr) => {
    const list = [], wide = W >= 640;
    (function walk(x, depth, parent, id) { list.push({ x, depth, parent, id }); (x.children || []).forEach((c, i) => walk(c, depth + 1, id, id + '-' + i)); })(s.root, 0, null, 't');
    const D = Math.max(...list.map(e => e.depth)) + 1, colW = (W - 2 * PAD) / D, fs = wide ? 13.5 : 13;
    const nodes = list.map(e => mk(e.id, { hue: e.x.hue, fs, lvl: e.depth, raw: tr(e.x.label), parent: e.parent }));
    const by = Object.fromEntries(nodes.map(nd => [nd.id, nd]));
    if (wide) {
      const w = Math.min(colW - 34, 210);
      nodes.forEach(nd => { const e = list.find(q => q.id === nd.id);
        nd.w = w; nd.lines = wrap(tr(e.x.label), w - 16, fs, 1); nd.subs = e.x.sub ? wrap(tr(e.x.sub), w - 16, 11.5, 1, true) : []; nd.h = textH(nd) + 16; });
      let y = PAD;
      const place = nd => { const kids = nodes.filter(c => c.parent === nd.id); nd.x = PAD + colW * nd.lvl + w / 2;
        if (!kids.length) { nd.y = y + nd.h / 2; y += nd.h + 10; } else { kids.forEach(place); nd.y = (kids[0].y + kids[kids.length - 1].y) / 2; } };
      place(nodes[0]);
    } else {
      let y = PAD;
      nodes.forEach(nd => { const e = list.find(q => q.id === nd.id), x0 = PAD + nd.lvl * 18; nd.w = W - PAD - x0;
        nd.lines = wrap(tr(e.x.label), nd.w - 16, fs, 1); nd.subs = e.x.sub ? wrap(tr(e.x.sub), nd.w - 16, 11.5, 1, true) : []; nd.h = textH(nd) + 14;
        nd.x = x0 + nd.w / 2; nd.y = y + nd.h / 2; y += nd.h + 8; nd.text = { x: x0 + 10, y: nd.y, anchor: 'start', valign: 'middle' }; });
    }
    const edges = nodes.filter(nd => nd.parent).map(nd => { const p = by[nd.parent];
      const d = wide ? (() => { const x0 = p.x + p.w / 2 + 2, x1 = nd.x - nd.w / 2 - 2, dx = (x1 - x0) / 2; return `M${r1(x0)},${r1(p.y)}C${r1(x0 + dx)},${r1(p.y)} ${r1(x1 - dx)},${r1(nd.y)} ${r1(x1)},${r1(nd.y)}`; })()
        : `M${r1(p.x - p.w / 2 + 9)},${r1(p.y + p.h / 2)}V${r1(nd.y)}H${r1(nd.x - nd.w / 2 - 2)}`;
      return { key: p.id + '>' + nd.id, from: p.id, to: nd.id, d, arrow: !wide }; });
    const runs = nodes.filter(nd => nd.parent === 't').map(c => {
      const steps = [{ edges: ['t>' + c.id], nodes: [c.id], note: c.raw }];
      (function down(id) { const kids = nodes.filter(k => k.parent === id); if (!kids.length) return;
        steps.push({ edges: kids.map(k => id + '>' + k.id), nodes: kids.map(k => k.id), note: kids.map(k => k.raw).join(' · ') });
        kids.forEach(k => down(k.id)); })(c.id);
      return { label: c.raw, trail: true, steps };
    });
    return { nodes, edges, runs };
  };

  LAYOUT.layers = (s, W, tr) => {
    const wide = W >= 640, railW = wide ? 84 : 58, bw = W - 2 * PAD, fs = 14, labW = wide ? 210 : bw - railW - 24;
    let y = PAD;
    const nodes = s.layers.map((x, i) => {
      const items = (x.items || []).map(tr).join(' · ');
      const nd = mk(x.id || 'L' + i, { shape: 'band', w: bw, hue: x.hue, fs, raw: tr(x.label), lines: wrap(tr(x.label), labW - 20, fs, 2),
        subs: wide ? (x.sub ? wrap(tr(x.sub), labW - 20, 11.5, 2, true) : []) : wrap(items || tr(x.sub || ''), labW - 4, 11.5, 3, true) });
      nd.items = wide ? wrap(items, bw - labW - railW - 24, 13, 2) : [];
      nd.h = Math.max(62, textH(nd) + 22, nd.items.length * 18 + 26); nd.x = PAD + bw / 2; nd.y = y + nd.h / 2; y += nd.h + 16;
      nd.text = { x: PAD + 16, y: nd.y, anchor: 'start', valign: 'middle' };
      return nd;
    });
    const xd = W - PAD - railW + (wide ? 24 : 16), xu = xd + (wide ? 34 : 24);
    const edges = [];
    nodes.slice(1).forEach((b, i) => { const a = nodes[i];
      edges.push({ key: 'd' + i, from: a.id, to: b.id, d: `M${xd},${a.y}V${b.y - 4}`, appear: 'intro' });
      edges.push({ key: 'u' + i, from: b.id, to: a.id, d: `M${xu},${b.y}V${a.y + 4}`, dash: '5 4' }); });
    const deco = [];
    nodes.forEach(nd => { if (nd.items.length) deco.push({ tag: 'text', x: PAD + labW, y: nd.y, anchor: 'start', valign: 'middle', top: true, lines: nd.items.map(t => ({ t, cls: 'md-items' })) });
      deco.push({ tag: 'circle', cls: 'md-rail', top: true, attrs: { cx: xd, cy: nd.y, r: 4 } }, { tag: 'circle', cls: 'md-rail', top: true, attrs: { cx: xu, cy: nd.y, r: 4 } }); });
    const down = nodes.slice(1).map((b, i) => ({ edges: ['d' + i], nodes: [b.id], note: rawLabel(b) }));
    const up = nodes.slice(0, -1).map((a, i) => ({ edges: ['u' + i], nodes: [a.id], note: rawLabel(a) })).reverse();
    return { nodes, edges, deco, runs: [
      { label: tr(s.down || ['Anfrage ↓', 'Request ↓']), trail: true, steps: [{ edges: [], nodes: [nodes[0].id], note: rawLabel(nodes[0]) }, ...down] },
      { label: tr(s.up || ['Antwort ↑', 'Response ↑']), trail: true, steps: [{ edges: [], nodes: [nodes[nodes.length - 1].id], note: rawLabel(nodes[nodes.length - 1]) }, ...up] }] };
  };

  /* ═════════ Engine ═════════ */
  const all = [];

  class Diagram {
    constructor(fig, spec, opts) {
      this.fig = fig; this.spec = spec; this.opts = opts;
      const dl = (document.documentElement.lang || 'de').slice(0, 2);
      this.lang = opts.lang || (dl === 'en' ? 'en' : 'de');
      this.fx = new Set(opts.fx || spec.fx || DEFAULT_FX[spec.type] || []);
      this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.still = this.reduce; this.sel = -1;
      this.t = 0; this.speed = 1; this.playing = false; this.visible = true; this.raf = 0; this.statusKey = '';
      this.warn = m => console.warn(`[motion-diagrams] ${tx(spec.title, 'de') || spec.type}: ${m}`);
      if (!LAYOUT[spec.type]) { this.warn(`unbekannter type "${spec.type}" (erlaubt: ${Object.keys(LAYOUT).join(', ')})`); return; }
      [...this.fx].forEach(f => FX.includes(f) || this.warn(`unbekannter Effekt "${f}"`));
      this.shell(); this.build();
      this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.loop(); });
      this.io.observe(fig);
      this.ro = new ResizeObserver(() => { if (Math.abs(this.width() - this.W) > 4) { this.build(); this.draw(this.t); } });
      this.ro.observe(this.stage);
      this.onVis = () => this.loop();
      document.addEventListener('visibilitychange', this.onVis);
      const auto = opts.autoplay !== false && !this.reduce && !new URLSearchParams(location.search).has('render');
      this.seek(auto ? 0 : this.intro);
      if (auto) this.play();
      fig.classList.add('md-ready');
    }

    tr = v => tx(v, this.lang);
    width() { return Math.max(280, this.stage.clientWidth - 16); }

    shell() {
      const f = this.fig, u = UI[this.lang];
      f.classList.add('md');
      [...f.children].forEach(c => { if (!c.matches('figcaption, .md-fallback')) c.remove(); });
      this.stage = document.createElement('div'); this.stage.className = 'md-stage';
      this.svg = el('svg', { class: 'md-svg', role: 'img' }, this.stage);
      this.foot = document.createElement('div'); this.foot.className = 'md-foot';
      const btn = (act, label) => `<button type="button" data-act="${act}" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[act]}"/></svg></button>`;
      this.foot.innerHTML = `<div class="md-ctl">${btn('prev', u.prev)}${this.reduce ? '' : btn('play', u.play)}${btn('next', u.next)}</div><p class="md-status" aria-live="polite"></p>`;
      this.alt = document.createElement('ol'); this.alt.className = 'md-alt';
      f.prepend(this.stage, this.foot, this.alt);
      this.foot.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.act === 'play') this.playing ? this.pause() : this.play(); else this.stepBy(b.dataset.act === 'next' ? 1 : -1); });
      this.stage.tabIndex = 0;
      this.stage.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); this.stepBy(e.key === 'ArrowRight' ? 1 : -1); }
        else if (e.key === 'k' || e.key === 'K') { this.playing ? this.pause() : this.play(); }
        else if (e.key === 'Escape') { this.sel = -1; this.pause(); this.seek(this.intro); }
      });
    }

    build() {
      const s = this.spec, ui = UI[this.lang], fx = this.fx, svg = this.svg;
      this.W = this.width();
      const L = LAYOUT[s.type](s, this.W, this.tr, ui);
      L.edges = L.edges.filter(Boolean);
      svg.textContent = '';
      svg.setAttribute('aria-label', this.tr(s.title) || s.type);
      svg.style.setProperty('--run', `var(--${s.hue || 'accent'})`);
      const root = el('g', {}, svg), gD = el('g', {}, root), gE = el('g', {}, root), gN = el('g', {}, root), gT = el('g', {}, root), gL = el('g', {}, root), gP = el('g', {}, root);
      const hueOk = h => { if (h && !HUES.includes(h)) this.warn(`unbekannte Farbe "${h}" (erlaubt: ${HUES.join(', ')})`); return h && HUES.includes(h); };
      const styleHue = (g, h) => { if (hueOk(h)) g.style.setProperty('--c', `var(--${h})`); };

      (L.deco || []).forEach(d => {
        if (d.tag === 'text') this.text(d.top ? gT : gD, d.x, d.y, d.anchor, d.valign, d.lines.map(l => ({ fs: l.cls === 'md-ctr' ? 15 : l.cls === 'md-leg' || l.cls === 'md-items' ? 13 : 11.5, lh: l.cls === 'md-ctr' ? 19 : 17, ...l })));
        else el(d.tag, { ...d.attrs, class: d.cls }, d.top ? gT : gD);
      });

      this.nodes = L.nodes; this.by = Object.fromEntries(L.nodes.map(n => [n.id, n]));
      L.nodes.forEach(n => {
        const g = el('g', { class: `md-node k-${n.kind || 'n'} sh-${n.shape}` }, gN); styleHue(g, n.hue); n.g = g;
        const shape = (cls, inset = 0) => n.shape === 'diamond'
          ? el('polygon', { class: cls, points: `${n.x},${n.y - n.h / 2} ${n.x + n.w / 2},${n.y} ${n.x},${n.y + n.h / 2} ${n.x - n.w / 2},${n.y}` }, g)
          : n.shape === 'circle' || n.shape === 'dot' ? el('circle', { class: cls, cx: n.x, cy: n.y, r: n.w / 2 - inset }, g)
            : el('rect', { class: cls, x: n.x - n.w / 2 + inset, y: n.y - n.h / 2 + inset, width: n.w - 2 * inset, height: n.h - 2 * inset, rx: n.shape === 'bar' ? 2 : n.shape === 'band' ? 8 : 6 }, g);
        if (fx.has('glow')) n.glow = shape('glow');
        n.ring = shape('ring'); n.ring.style.opacity = 0;
        shape('shape');
        if (n.kind === 'final') shape('shape-in', 4);
        if (n.inner) this.text(g, n.x, n.y, 'middle', 'middle', [{ t: n.inner, cls: 'md-inner', fs: 12, lh: 14 }]);
        const lines = [];
        if (n.num) lines.push({ t: n.num, cls: 'md-num', fs: 11, lh: 15 });
        n.lines.forEach(t => lines.push({ t, cls: 'md-lbl', fs: n.fs, lh: n.fs * 1.22 }));
        n.subs.forEach(t => lines.push({ t, cls: 'md-sub', fs: 11.5, lh: 15 }));
        if (n.value != null) lines.push({ t: n.fmt(n.value), cls: 'md-val', fs: 12, lh: 15 });
        const p = n.text || { x: n.x, y: n.y, anchor: 'middle', valign: 'middle' };
        if (lines.length) { const tEl = this.text(p.halo ? gT : g, p.x, p.y, p.anchor, p.valign, lines, p.halo); n.tEl = tEl; n.valEl = n.value != null ? tEl.lastChild : null;
          if (p.halo) n.extG = tEl; }
      });

      this.edges = L.edges; this.ek = new Map(L.edges.map(e => [e.key, e]));
      L.edges.forEach(e => {
        const g = el('g', { class: 'md-edge' + (e.kind === 'ribbon' ? ' rb' : '') }, gE); styleHue(g, e.hue); e.g = g;
        if (fx.has('glow') && e.kind !== 'ribbon') e.gl = el('path', { class: 'gl', d: e.d }, g);
        e.ln = el('path', { class: 'ln', d: e.d }, g);
        const path = e.center ? el('path', { class: 'cl', d: e.center }, g) : e.ln;
        e.path = path; e.len = path.getTotalLength();
        if (e.dash) e.ln.style.strokeDasharray = e.dash;
        if (e.arrow !== false && e.kind !== 'ribbon') {
          const p1 = e.ln.getPointAtLength(e.len), p0 = e.ln.getPointAtLength(Math.max(0, e.len - 4));
          e.ah = el('path', { class: 'ah', d: 'M0,0L-9,-4.6L-9,4.6Z', transform: `translate(${r1(p1.x)},${r1(p1.y)}) rotate(${r1(Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI)})` }, g);
        }
        if (e.lab?.length) {
          const lg = el('g', { class: 'md-elbl' }, gL); styleHue(lg, e.hue);
          const w = Math.max(...e.lab.map(t => t.length)) * 12 * .62 + 10, h = e.lab.length * 14 + 6;
          const x0 = e.lpos.anchor === 'start' ? e.lpos.x - 5 : e.lpos.anchor === 'end' ? e.lpos.x - w + 5 : e.lpos.x - w / 2;
          el('rect', { x: r1(x0), y: r1(e.lpos.y - 14), width: r1(w), height: h, rx: 3 }, lg);
          const t = el('text', { x: e.lpos.x, y: e.lpos.y, 'text-anchor': e.lpos.anchor }, lg);
          e.lab.forEach((l, i) => { const ts = el('tspan', { x: e.lpos.x, dy: i ? 14 : 0 }, t); ts.textContent = l; });
          e.lg = lg;
        }
        if (fx.has('packets') || fx.has('comet')) {
          e.pk = el('g', { class: 'md-pk' }, gP); styleHue(e.pk, e.hue); e.pk.style.display = 'none';
          e.dots = Array.from({ length: e.stream ? 7 : fx.has('comet') ? 8 : 1 }, () => el('circle', { r: 4 }, e.pk));
        }
      });

      /* Läufe normalisieren + prüfen */
      this.runs = (L.runs || []).filter(r => r.steps?.length);
      this.runs.forEach(r => r.steps.forEach(st => {
        st.dirs = st.edges.map(k => {
          if (this.ek.has(k)) return [this.ek.get(k), 1];
          const [a, b] = k.split('>'), rev = this.ek.get(b + '>' + a);
          if (rev) return [rev, -1];
          this.warn(`Kante "${k}" fehlt`); return null;
        }).filter(Boolean);
        st.nodes = (st.nodes || st.dirs.map(([e, d]) => d > 0 ? e.to : e.from)).filter(id => this.by[id] || this.warn(`Knoten "${id}" fehlt`));
        st.from = st.dirs.map(([e, d]) => d > 0 ? e.from : e.to);
      }));

      /* Zeitplan: Aufbau (gestaffelt, Linien zeichnen) + Läufe */
      const stg = fx.has('stagger'), draw = fx.has('draw'), lv = {}, n = L.nodes.length, gapT = Math.min(.12, 1.1 / Math.max(1, n));
      L.nodes.forEach((nd, i) => { nd.tIn = !stg ? 0 : nd.lvl != null ? nd.lvl * .32 + (lv[nd.lvl] = (lv[nd.lvl] ?? -1) + 1) * .04 : i * gapT; });
      let intro = Math.max(0, ...L.nodes.map(nd => nd.tIn + (stg ? .4 : 0)));
      if (fx.has('count') && L.nodes.some(nd => nd.value != null)) intro = Math.max(intro, ...L.nodes.map(nd => nd.tIn + .9));
      L.edges.forEach(e => { const a = this.by[e.from], b = this.by[e.to];
        e.t0 = Math.max(a?.tIn ?? 0, b?.tIn ?? 0) + (stg ? .2 : 0); e.t1 = e.t0 + (draw ? .55 : 0);
        if (e.appear !== 'run') intro = Math.max(intro, e.t1); });
      this.intro = intro + (stg || draw ? .25 : 0);
      let u = 0;
      this.steps = [];
      this.runs.forEach((r, ri) => { r.t0 = u;
        r.steps.forEach((st, si) => { st.t0 = u; st.hop = st.dirs.length && !st.dirs.every(([e]) => e.stream) ? HOP : 0;
          st.ta = u + st.hop; st.t1 = st.ta + (st.hold ?? DWELL); u = st.t1; this.steps.push({ r, ri, st, si }); });
        u += END; r.t1 = u; });
      this.runD = u;
      this.runs.forEach(r => r.steps.forEach((st, si) => st.dirs.forEach(([e]) => { if (e.appear === 'run' && e.runAt == null) { e.runAt = si; e.run = r; } })));

      const bb = root.getBBox(), over = Math.max(0, -bb.x, bb.x + bb.width - this.W), m = over > .5 ? 4 : 0;
      const x0 = Math.min(0, bb.x - m), x1 = Math.max(this.W, bb.x + bb.width + m);
      if (m) this.warn(`Inhalt ragt seitlich ${Math.ceil(over)} px über die Breite ${this.W} → wird verkleinert`);
      svg.setAttribute('viewBox', `${r1(x0)} ${r1(Math.min(0, bb.y - 8))} ${r1(x1 - x0)} ${r1(bb.y + bb.height + 8 - Math.min(0, bb.y - 8))}`);

      this.alt.innerHTML = '';
      this.runs.forEach(r => { const li = document.createElement('li'); li.textContent = `${r.label}: ${r.steps.map(st => st.note).filter(Boolean).join(' → ')}`; this.alt.appendChild(li); });
      this.statusKey = '';
    }

    text(parent, x, y, anchor, valign, lines, halo) {
      const H = lines.reduce((a, l) => a + l.lh, 0);
      let top = valign === 'top' ? y : valign === 'bottom' ? y - H : y - H / 2;
      const t = el('text', { x, 'text-anchor': anchor, class: halo ? 'md-halo' : null }, parent);
      lines.forEach(l => { const ts = el('tspan', { x: x + (l.dx || 0), y: r1(top + l.lh / 2 + l.fs * .35), class: l.cls }, t); ts.textContent = l.t; top += l.lh; });
      return t;
    }

    /* Zustand zur Zeit t berechnen und zeichnen (reine Funktion von t + Auswahl) */
    draw(t) {
      const fx = this.fx, motion = !this.still, overview = this.still && this.sel < 0;
      let phase = 'intro', u = 0, run = null, si = -1, st = null;
      if (this.still && this.sel >= 0) { const s = this.steps[this.sel]; phase = 'run'; run = s.r; si = s.si; st = s.st; u = st.ta + .01; }
      else if (!overview && t >= this.intro) {
        if (this.runD > 0) { phase = 'run'; u = (t - this.intro) % this.runD; run = this.runs.find(r => u >= r.t0 && u < r.t1) || this.runs[0];
          si = run.steps.findIndex(s => u >= s.t0 && u < s.t1); if (si < 0) si = run.steps.length; st = run.steps[si] || null; }
        else phase = 'done';
      }
      if (overview) phase = 'done';
      const inRun = phase === 'run', trail = run?.trail !== false;
      const onN = new Set(), onE = new Set(), lit = new Set();
      if (inRun) run.steps.forEach((s, k) => {
        const cur = k === si, past = k < si;
        if ((past && trail) || (cur && u >= s.t0)) { s.dirs.forEach(([e]) => onE.add(e)); s.from.forEach(id => lit.add(id)); }
        if ((past && trail) || (cur && u >= s.ta)) s.nodes.forEach(id => onN.add(id));
      });
      onN.forEach(id => lit.add(id));
      const runHue = inRun && run.hue && HUES.includes(run.hue) ? run.hue : this.spec.hue || 'accent';
      if (this.runHue !== runHue) { this.svg.style.setProperty('--run', `var(--${runHue})`); this.runHue = runHue; }
      const spot = fx.has('spotlight') && inRun, endFade = inRun && u > run.t1 - FADE ? clamp((run.t1 - u) / FADE) : 1;
      const stg = fx.has('stagger') && phase === 'intro';

      this.nodes.forEach(n => {
        const a = stg ? clamp((t - n.tIn) / .4) : 1, dim = spot && !lit.has(n.id), on = onN.has(n.id);
        const op = String(r1(a * (dim ? .3 : 1) * 100) / 100);
        n.g.style.opacity = op; if (n.extG) n.extG.style.opacity = op;
        n.g.setAttribute('transform', a < 1 ? `translate(0 ${r1((1 - easeOut(a)) * 8)})` : '');
        n.g.classList.toggle('on', on);
        n.g.classList.toggle('now', !!(inRun && st && si < run.steps.length && st.nodes.includes(n.id) && u >= st.ta));
        if (n.glow) n.glow.style.opacity = on ? .22 : 0;
        let pr = -1;
        if (fx.has('pulse') && motion && inRun && st && st.nodes.includes(n.id) && u >= st.ta && u - st.ta < PULSE) pr = (u - st.ta) / PULSE;
        else if (fx.has('pulse') && motion && n.alive && phase !== 'intro') pr = (t % 1.8) / 1.8;
        if (pr >= 0) { const sc = 1 + easeOut(pr) * Math.min(.6, 22 / Math.max(n.w, n.h) * 2);
          n.ring.style.opacity = r1((1 - pr) * .7 * 100) / 100; n.ring.setAttribute('transform', `translate(${n.x} ${n.y}) scale(${r1(sc * 100) / 100}) translate(${-n.x} ${-n.y})`); }
        else n.ring.style.opacity = 0;
        if (n.valEl) { const v = fx.has('count') && phase === 'intro' ? Math.round(n.value * easeOut(clamp((t - n.tIn) / .9))) : n.value;
          if (n.valShown !== v) { n.valEl.textContent = n.fmt(v); n.valShown = v; } }
      });

      this.edges.forEach(e => {
        const on = onE.has(e);
        let p = 1, fo = 1;
        if (e.appear === 'run') {
          if (overview) p = 1;
          else if (!inRun || e.run !== run) p = 0;
          else if (si < e.runAt) p = 0;
          else if (si === e.runAt) p = st.hop ? clamp((u - st.t0) / st.hop) : 1;
          if (inRun && e.run === run) fo = endFade;
        } else if (phase === 'intro') p = this.fx.has('draw') ? clamp((t - e.t0) / Math.max(.01, e.t1 - e.t0)) : Math.min(this.by[e.from]?.tIn <= t ? 1 : 0, this.by[e.to]?.tIn <= t ? 1 : 0);
        const dim = spot && !on;
        e.g.classList.toggle('on', on);
        e.g.style.opacity = r1(fo * (dim ? .3 : 1) * (e.kind === 'ribbon' || e.appear === 'run' ? Math.min(1, p * 1.5) : p > 0 ? 1 : 0) * 100) / 100;
        if (e.kind !== 'ribbon') {
          const drawing = p < 1 && this.fx.has('draw') && e.appear !== 'run' || (e.appear === 'run' && p < 1 && !overview);
          if (drawing) { e.ln.style.strokeDasharray = `${r1(e.len)} ${r1(e.len)}`; e.ln.style.strokeDashoffset = r1(e.len * (1 - p)); }
          else if (fx.has('dash') && on && motion) { e.ln.style.strokeDasharray = '7 6'; e.ln.style.strokeDashoffset = r1(-(t * 26) % 13); }
          else { e.ln.style.strokeDasharray = e.dash || ''; e.ln.style.strokeDashoffset = ''; }
          if (e.ah) e.ah.style.opacity = p >= .97 ? 1 : 0;
          if (e.gl) e.gl.style.opacity = on ? .22 : 0;
        }
        if (e.lg) e.lg.style.opacity = r1(fo * (dim ? .3 : 1) * (p > .5 ? 1 : 0) * 100) / 100;
        if (e.pk) {
          const d = inRun && motion && st ? st.dirs.find(([x]) => x === e) : null;
          let show = false;
          if (d && e.stream && u >= st.t0 && u < st.t1) {
            show = true; const m = e.dots.length, sp = 120;
            e.dots.forEach((c, i) => { const pos = ((u - st.t0) * sp + i * e.len / m) % e.len, pt = e.path.getPointAtLength(pos);
              c.setAttribute('cx', r1(pt.x)); c.setAttribute('cy', r1(pt.y)); c.setAttribute('r', r1(clamp(e.width / 5, 2.2, 4.5)));
              c.style.opacity = r1(clamp(Math.min(pos, e.len - pos) / 24) * 90) / 100; });
          } else if (d && st.hop && u >= st.t0 && u < st.ta) {
            show = true; const q = ease((u - st.t0) / st.hop);
            e.dots.forEach((c, k) => { const qk = q - k * .045;
              if (qk < 0) { c.style.opacity = 0; return; }
              const pt = e.path.getPointAtLength(e.len * (d[1] > 0 ? qk : 1 - qk));
              c.setAttribute('cx', r1(pt.x)); c.setAttribute('cy', r1(pt.y)); c.setAttribute('r', r1(k ? 4 * (1 - k / 9) : 4.6));
              c.style.opacity = k ? r1(.55 * (1 - k / 8) * 100) / 100 : 1; });
          }
          e.pk.style.display = show ? '' : 'none';
        }
      });

      const key = `${phase}:${this.runs.indexOf(run)}:${si}:${this.still}:${this.sel}`;
      if (key !== this.statusKey) { this.statusKey = key; this.status(phase, run, si); }
    }

    status(phase, run, si) {
      const ui = UI[this.lang], out = this.foot.querySelector('.md-status');
      let txt = '';
      if (this.still && this.sel < 0) txt = ui.overview;
      else if (phase === 'intro') txt = ui.build;
      else if (run) { const s = run.steps[Math.min(si, run.steps.length - 1)], gi = this.steps.findIndex(x => x.st === s);
        txt = `${run.label ? run.label + ' · ' : ''}${ui.step} ${gi + 1}/${this.steps.length} – ${s.note || ''}`; }
      if (out && out.textContent !== txt) out.textContent = txt;
      const pb = this.foot.querySelector('[data-act=play]');
      if (pb) { pb.setAttribute('aria-label', this.playing ? ui.pause : ui.play); pb.querySelector('path').setAttribute('d', this.playing ? ICON.pause : ICON.play); }
    }

    curStep() {
      if (this.still) return this.sel;
      if (this.t < this.intro || !this.runD) return -1;
      const u = (this.t - this.intro) % this.runD;
      let i = -1; this.steps.forEach((s, k) => { if (u >= s.st.t0) i = k; });
      return i;
    }

    stepBy(d) {
      if (!this.steps.length) return;
      const c = this.curStep(), n = this.steps.length;
      this.step(c < 0 ? (d > 0 ? 0 : n - 1) : (c + d + n) % n);
    }

    step(i) {
      this.pause();
      const s = this.steps[i]; if (!s) return;
      if (this.still) { this.sel = i; this.draw(this.t); }
      else this.seek(this.intro + s.st.ta + .02);
    }

    seek(t) { this.t = Math.max(0, t); this.draw(this.t); }
    play() { if (this.still) return; this.playing = true; this.statusKey = ''; this.loop(); this.draw(this.t); }
    pause() { this.playing = false; cancelAnimationFrame(this.raf); this.raf = 0; this.statusKey = ''; this.draw(this.t); }

    loop() {
      const go = this.playing && this.visible && !document.hidden;
      if (!go) { cancelAnimationFrame(this.raf); this.raf = 0; return; }
      if (this.raf) return;
      let last = performance.now();
      const tick = now => {
        this.t += Math.min(.1, (now - last) / 1000) * this.speed; last = now;
        if (this.runD && this.t > this.intro + this.runD) this.t = this.intro + (this.t - this.intro) % this.runD;
        this.draw(this.t);
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }

    destroy() {
      this.pause(); this.io?.disconnect(); this.ro?.disconnect();
      document.removeEventListener('visibilitychange', this.onVis);
      [this.stage, this.foot, this.alt].forEach(x => x?.remove());
      this.fig.classList.remove('md', 'md-ready');
      const i = all.indexOf(this); if (i >= 0) all.splice(i, 1);
    }
  }

  function tx(v, lang) { return Array.isArray(v) ? (lang === 'en' ? v[1] ?? v[0] : v[0]) : (v ?? ''); }

  function create(fig, spec, opts = {}) {
    const d = new Diagram(fig, spec, opts);
    if (!d.svg) return null;
    all.push(d);
    return {
      seek: t => d.seek(t), play: () => d.play(), pause: () => d.pause(), step: i => d.step(i),
      setLang: l => { d.lang = l; const ui = UI[l];
        d.foot.querySelectorAll('button').forEach(b => b.setAttribute('aria-label', ui[b.dataset.act]));
        d.build(); d.seek(d.t); },
      setFx: list => { d.fx = new Set(list); d.build(); d.seek(0); if (d.playing) d.play(); },
      get duration() { return d.intro + d.runD; }, get intro() { return d.intro; }, destroy: () => d.destroy(),
    };
  }

  root.MotionDiagram = { create, FX, DEFAULT_FX, TYPES: Object.keys(LAYOUT), all };
  if (!root.seek) root.seek = s => all.forEach(d => d.seek(s));
})(window);
