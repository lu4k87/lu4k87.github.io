// Gewichtetes Voronoi-Diagramm (Power-Diagramm) per Halbebenen-Schnitt.
// Gewicht w = r² lässt einzelne Zellen (Gefäße) größer werden als ihre Nachbarn (Fasern) – wie im Holz.

// Polygon (Array [x, y]) auf die Halbebene n·p <= c beschneiden (Sutherland–Hodgman)
export function clipPolygon(poly, nx, ny, c) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const da = a[0] * nx + a[1] * ny - c;
    const db = b[0] * nx + b[1] * ny - c;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export function polygonArea(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function polygonCentroid(poly) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const k = p[0] * q[1] - q[0] * p[1];
    a += k;
    cx += (p[0] + q[0]) * k;
    cy += (p[1] + q[1]) * k;
  }
  if (Math.abs(a) < 1e-9) return [poly[0][0], poly[0][1]];
  return [cx / (3 * a), cy / (3 * a)];
}

export function polygonPerimeter(poly) {
  let s = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    s += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return s;
}

// sites: [{x, y, w}] · bounds: {x0, y0, x1, y1} · reach: Suchradius um jede Zelle (µm)
export function powerCells(sites, bounds, reach) {
  const g = reach / 2;
  const gx0 = bounds.x0, gy0 = bounds.y0;
  const nx = Math.ceil((bounds.x1 - bounds.x0) / g) + 1;
  const ny = Math.ceil((bounds.y1 - bounds.y0) / g) + 1;
  const grid = new Map();
  sites.forEach((s, i) => {
    const k = Math.floor((s.x - gx0) / g) + Math.floor((s.y - gy0) / g) * nx;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  const maxW = sites.reduce((m, s) => Math.max(m, s.w), 0);
  const cells = new Array(sites.length);
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    let poly = [[bounds.x0, bounds.y0], [bounds.x1, bounds.y0], [bounds.x1, bounds.y1], [bounds.x0, bounds.y1]];
    const r = Math.ceil((reach + Math.sqrt(s.w) + Math.sqrt(maxW)) / g);
    const cx = Math.floor((s.x - gx0) / g), cy = Math.floor((s.y - gy0) / g);
    const cand = [];
    for (let yy = Math.max(0, cy - r); yy <= Math.min(ny - 1, cy + r); yy++) {
      for (let xx = Math.max(0, cx - r); xx <= Math.min(nx - 1, cx + r); xx++) {
        const list = grid.get(xx + yy * nx);
        if (list) for (const j of list) if (j !== i) cand.push(j);
      }
    }
    cand.sort((a, b) => ((sites[a].x - s.x) ** 2 + (sites[a].y - s.y) ** 2) - ((sites[b].x - s.x) ** 2 + (sites[b].y - s.y) ** 2));
    let maxR2 = Infinity;
    for (const j of cand) {
      const t = sites[j];
      const dx = t.x - s.x, dy = t.y - s.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1e-12) continue;
      const d = Math.sqrt(d2);
      // Abstand der Trennlinie vom eigenen Punkt; liegt sie außerhalb des Polygons, kann sie nichts abschneiden
      const off = (d2 + s.w - t.w) / (2 * d);
      if (off * off > maxR2 && off > 0) continue;
      const c = (t.x * t.x + t.y * t.y - s.x * s.x - s.y * s.y + s.w - t.w) / 2;
      poly = clipPolygon(poly, dx, dy, c);
      if (poly.length < 3) break;
      maxR2 = 0;
      for (const p of poly) maxR2 = Math.max(maxR2, (p[0] - s.x) ** 2 + (p[1] - s.y) ** 2);
    }
    cells[i] = poly.length >= 3 ? poly : null;
  }
  return cells;
}

// Gemeinsame Kanten und Ecken der Zellen, ohne Kanten auf dem Rahmen
export function cellEdges(cells, bounds) {
  const key = (p) => `${Math.round(p[0] * 500)},${Math.round(p[1] * 500)}`;
  const onBounds = (p) => Math.abs(p[0] - bounds.x0) < 1e-6 || Math.abs(p[0] - bounds.x1) < 1e-6 ||
    Math.abs(p[1] - bounds.y0) < 1e-6 || Math.abs(p[1] - bounds.y1) < 1e-6;
  const edges = new Map();
  const verts = new Map();
  cells.forEach((poly, i) => {
    if (!poly) return;
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], b = poly[(k + 1) % poly.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05) continue;
      if (onBounds(a) && onBounds(b)) continue;
      const ka = key(a), kb = key(b);
      const ek = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      const e = edges.get(ek);
      if (e) e.j = i;
      else edges.set(ek, { a, b, i, j: -1, ka, kb });
      for (const [kk, p] of [[ka, a], [kb, b]]) {
        const v = verts.get(kk);
        if (v) v.cells.add(i);
        else verts.set(kk, { p, cells: new Set([i]), edges: [] });
      }
    }
  });
  for (const e of edges.values()) {
    verts.get(e.ka).edges.push(e);
    verts.get(e.kb).edges.push(e);
  }
  return { edges: [...edges.values()], verts: [...verts.values()] };
}
