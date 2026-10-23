// Holzgewebe der Buche im Querschnitt (Einheit µm), gemeinsam für Ebene „Gewebe“ und „Zellen“:
// dieselben Zellen erscheinen in beiden Ebenen, nur näher. Maße nach Prommer et al. (2014), Holzanatomie Buche.

import { mulberry32, gauss, clamp, smoothstep } from './util.js';
import { powerCells, cellEdges, polygonArea, polygonPerimeter } from './voronoi.js';

export const BOUNDS = { x0: -600, y0: -420, x1: 600, y1: 420 };
const FIBER = 9;          // Faserabstand
const RAY_CELL_W = 7.5;   // Breite einer Strahlzelle (tangential)
const RING_Y = 70;        // Jahrringgrenze (radial, wächst nach +y)

export function ringY(x) {
  return RING_Y + 0.00008 * x * x + 4 * Math.sin(x / 70);
}

// 0 = Frühholz, 1 = spätes Spätholz direkt vor der Grenze
export function lateness(x, y) {
  const yb = ringY(x);
  if (y > yb) return 0;
  return Math.pow(smoothstep(yb - 260, yb, y), 1.6);
}

// Wanddicke, die eine Zelle zu jeder ihrer Wände beiträgt (Doppelwand = Summe beider Hälften)
function wallOf(site) {
  if (site.type === 1) return 1.3;
  if (site.type === 2) return 1.5;
  return 2.4 + 1.8 * site.late;
}

let cache = null;
export function woodTissue() {
  if (!cache) cache = build();
  return cache;
}

function build() {
  const rand = mulberry32(20261022);
  const BROAD_X = 175;

  const rays = [{ x: BROAD_X, cells: 9, phase: 1.3, broad: true }];
  for (let x = BOUNDS.x0 + 30 + rand() * 40; x < BOUNDS.x1; x += 70 + rand() * 60) {
    if (Math.abs(x - BROAD_X) > 70) rays.push({ x, cells: rand() < 0.25 ? 2 : 1, phase: rand() * 6.28 });
  }
  const rayX = (r, y) => r.x + (r.broad ? 5 : 7) * Math.sin(y / 85 + r.phase);
  const rayHalf = (r) => (r.cells * RAY_CELL_W) / 2;
  const inRay = (x, y, margin) => rays.some((r) => Math.abs(x - rayX(r, y)) < rayHalf(r) + margin);

  // Gefäße: Poisson-Scheibe, im Frühholz dichter und größer, teils radiale Gruppen
  const vessels = [];
  const free = (x, y, r) => x > BOUNDS.x0 + 20 && x < BOUNDS.x1 - 20 && y > BOUNDS.y0 + 20 && y < BOUNDS.y1 - 20 &&
    !inRay(x, y, r + 4) && !vessels.some((v) => Math.hypot(v.x - x, v.y - y) < v.r + r + 2.2);
  const spaced = (x, y, r) => !vessels.some((v) => Math.hypot(v.x - x, v.y - y) < v.r + r + 24);
  const diameter = (late) => (late > 0.5 ? clamp(gauss(rand, 15, 4.5), 8, 26) : clamp(gauss(rand, 24, 7), 12, 42));
  for (let tries = 0; tries < 9000 && vessels.length < 100; tries++) {
    const x = BOUNDS.x0 + rand() * (BOUNDS.x1 - BOUNDS.x0);
    const y = BOUNDS.y0 + rand() * (BOUNDS.y1 - BOUNDS.y0);
    const late = lateness(x, y);
    if (rand() > 1 - 0.55 * late) continue;
    const r = diameter(late) / 2;
    if (!free(x, y, r) || !spaced(x, y, r)) continue;
    vessels.push({ x, y, r, late });
    // radiale Mehrlinge: nächstes Gefäß direkt außen anliegend
    let last = vessels[vessels.length - 1];
    for (let k = 0; k < 2 && rand() < (k === 0 ? 0.4 : 0.3); k++) {
      const r2 = diameter(late) / 2 * 0.9;
      const y2 = last.y + last.r + r2 + 1.6;
      if (!free(last.x, y2, r2)) break;
      vessels.push({ x: last.x + (rand() - 0.5) * 3, y: y2, r: r2, late: lateness(last.x, y2) });
      last = vessels[vessels.length - 1];
    }
  }

  const sites = [];
  for (const v of vessels) sites.push({ x: v.x, y: v.y, w: (v.r + 0.8) ** 2, type: 1, late: v.late, r: v.r });

  // Fasern: Reihen folgen dem Jahrring, im Spätholz radial abgeflacht
  let row = 0;
  for (let y = BOUNDS.y0; y < BOUNDS.y1; row++) {
    const late = lateness(0, y);
    const dy = FIBER * 0.866 * (1 - 0.5 * late);
    for (let x = BOUNDS.x0 + (row % 2 ? FIBER / 2 : 0); x < BOUNDS.x1; x += FIBER) {
      const px = x + (rand() - 0.5) * FIBER * 0.32;
      const py = y + (ringY(px) - RING_Y) + (rand() - 0.5) * dy * 0.3;
      if (inRay(px, py, 1.2)) continue;
      if (vessels.some((v) => (px - v.x) ** 2 + (py - v.y) ** 2 < (v.r + FIBER * 0.5) ** 2)) continue;
      sites.push({ x: px, y: py, w: 0, type: 0, late: lateness(px, py) });
    }
    y += dy;
  }

  // Strahlzellen: radial gestreckte Zellen in Spalten
  for (const r of rays) {
    for (let c = 0; c < r.cells; c++) {
      const off = (c - (r.cells - 1) / 2) * RAY_CELL_W;
      for (let y = BOUNDS.y0 + rand() * 20; y < BOUNDS.y1; y += 17 + rand() * 11) {
        sites.push({ x: rayX(r, y) + off + (rand() - 0.5) * 0.8, y, w: 0, type: 2, late: lateness(rayX(r, y), y) });
      }
    }
  }

  const cells = powerCells(sites, BOUNDS, 30);
  const { edges, verts } = cellEdges(cells, BOUNDS);
  for (const e of edges) {
    const si = sites[e.i], sj = e.j >= 0 ? sites[e.j] : null;
    e.t = sj ? (wallOf(si) + wallOf(sj)) / 2 : wallOf(si);
    const types = [si.type, sj ? sj.type : si.type];
    e.kind = types.includes(1) ? 1 : types.includes(2) ? 2 : 0;
    e.late = Math.max(si.late, sj ? sj.late : 0);
    e.seed = rand();
  }

  // Porenanteil (Lumen / Fläche) eines Fensters – Lumen ≈ Zellfläche minus halbe Wand rundum
  function porosity(x0, y0, x1, y1) {
    let area = 0, lumen = 0;
    cells.forEach((poly, i) => {
      if (!poly) return;
      const s = sites[i];
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) return;
      const a = Math.abs(polygonArea(poly));
      area += a;
      lumen += Math.max(0, a - polygonPerimeter(poly) * wallOf(s) / 2);
    });
    return area > 0 ? lumen / area : 0;
  }

  // Einstiegsgefäß für die nächste Ebene: Frühholz-Gruppe nahe einer festen Stelle
  const target = { x: -110, y: 165 };
  let dive = vessels[0];
  let best = Infinity;
  for (const v of vessels) {
    const group = vessels.filter((o) => o !== v && Math.hypot(o.x - v.x, o.y - v.y) < v.r + o.r + 4).length;
    const score = Math.hypot(v.x - target.x, v.y - target.y) - (group ? 60 : 0) - v.r * 2;
    if (v.late < 0.2 && score < best) { best = score; dive = v; }
  }

  const broad = rays[0];
  return { sites, cells, edges, verts, vessels, rays, rayX, broad, dive, porosity };
}
