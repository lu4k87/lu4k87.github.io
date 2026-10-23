// Linien-Icons in sechseckigen Abzeichen – Bildsprache der Infografik-Vorlage (Hex-Badge + Leitlinie).
// Glyphen im 24er-Raster, Strich 1,8; Hexagon im 40er-Raster mit Spitze oben.

const hexPath = (cx, cy, r, pointy) => 'M' + [0, 1, 2, 3, 4, 5].map((k) => {
  const a = (pointy ? -Math.PI / 2 : Math.PI / 6) + (k * Math.PI) / 3;
  return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
}).join('L') + 'z';

export const HEX = hexPath(20, 20, 18, true);
const F = 'fill="currentColor" stroke="none"';

const G = {
  cube: '<path d="M12 3l7 4v10l-7 4-7-4V7z"/><path d="M12 11l7-4M12 11L5 7M12 11v10"/>',
  honeycomb: `<path d="${hexPath(8, 8.5, 4)}${hexPath(16, 8.5, 4)}${hexPath(12, 15.5, 4)}"/>`,
  tubes: '<rect x="3" y="4.5" width="18" height="5.5" rx="2.75"/><rect x="3" y="14" width="18" height="5.5" rx="2.75"/>',
  pit: '<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="3.2" ry="1.3" transform="rotate(-35 12 12)"/>',
  foam: '<circle cx="8" cy="9" r="4"/><circle cx="16.5" cy="8" r="2.8"/><circle cx="14.5" cy="16.5" r="3.8"/><circle cx="6" cy="17.5" r="2.4"/>',
  layers: '<path d="M4 8c3-2 5-2 8 0s5 2 8 0M4 12.5c3-2 5-2 8 0s5 2 8 0M4 17c3-2 5-2 8 0s5 2 8 0"/>',
  molecule: '<circle cx="12" cy="12" r="2.6"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="12" cy="20" r="2"/><path d="M10.2 10.5 6.6 8.2M13.8 10.5l3.6-2.3M12 14.6V18"/>',
  dive: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  info: `<path d="M12 10.5v7"/><circle cx="12" cy="7" r="1.3" ${F}/>`,
  endgrain: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.2"/><circle cx="12" cy="12" r="1.6"/>',
  ring: '<path d="M4 20a16 16 0 0 1 16-16M8 20a12 12 0 0 1 12-12M12 20a8 8 0 0 1 8-8"/>',
  ray: '<path d="M4 20L12 4M8 20l4-16M12 20V4M16 20L12 4M20 20L12 4"/>',
  porosity: `<g ${F}><circle cx="7" cy="7" r="1.7"/><circle cx="12.5" cy="6" r="1.4"/><circle cx="17.5" cy="8" r="1.9"/><circle cx="6.5" cy="13" r="1.3"/><circle cx="12" cy="12.5" r="2"/><circle cx="17" cy="14" r="1.4"/><circle cx="8" cy="18" r="1.8"/><circle cx="14" cy="18.5" r="1.3"/></g>`,
  vessel: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12a7 2.5 0 0 0 14 0V6"/>',
  fiber: '<path d="M8 3v18M12 3v18M16 3v18"/>',
  microbe: '<rect x="3.5" y="9" width="11.5" height="6" rx="3"/><path d="M15 12h2.5M17.5 12l2.5-2.5M17.5 12l2.5 2.5"/>',
  hypha: '<path d="M3 18c4 0 5-6 9-6s5 6 9 6M12 12V4M9.5 6.5 12 4l2.5 2.5"/>',
  ash: '<path d="M12 3l6 9-6 9-6-9z"/><path d="M6 12h12"/>',
  crack: '<path d="M6 3l3 7-2 3 4 5-1 3"/>',
  water: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  gas: '<circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="12" r="2.2"/><circle cx="19.5" cy="12" r="2.2"/>',
  sheet: '<path d="M12 4l7 4v8l-7 4-7-4V8z"/>',
  stack: '<path d="M5 7h14M5 12h14M5 17h14"/>',
  micropore: '<circle cx="12" cy="12" r="7.5" stroke-dasharray="3 2.6"/><circle cx="12" cy="12" r="2"/>',
  carbon: '<path d="M17 8a6.5 6.5 0 1 0 0 8"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  ratio: '<path d="M6 18L18 6"/><circle cx="7.5" cy="7.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/>',
  bond: '<circle cx="5.5" cy="12" r="2.5"/><circle cx="18.5" cy="12" r="2.5"/><path d="M8 12h8"/>',
  ruler: '<path d="M3 16h18M6 16v-3M10 16v-5M14 16v-3M18 16v-5"/>',
  carboxyl: '<circle cx="7" cy="12" r="3.2"/><path d="M14 12h6M17 9v6"/>',
  phenol: '<circle cx="8.5" cy="13" r="3.5"/><path d="M12 13h3.5M15.5 8v10"/>',
  carbonyl: '<path d="M4 10h8M4 14h8"/><circle cx="17" cy="12" r="3"/>',
  edgeh: `<circle cx="9.5" cy="12" r="3.2"/><path d="M12.7 12h5"/><circle cx="19" cy="12" r="1.4" ${F}/>`,
  sheen: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6M6.5 6.5l3 3M14.5 14.5l3 3M6.5 17.5l3-3M14.5 9.5l3-3"/>',
  area: '<path d="M4 20V4h16"/><path d="M8 16l4-5 3 3 5-6"/>',
};

export const LEVEL_ICONS = { piece: 'cube', tissue: 'honeycomb', cells: 'tubes', wall: 'pit', meso: 'foam', micro: 'layers', atoms: 'molecule' };

export const HOTSPOT_ICONS = {
  piece: { endgrain: 'endgrain', cracks: 'crack', sheen: 'sheen' },
  tissue: { vessels: 'vessel', ring: 'ring', ray: 'ray', porosity: 'porosity' },
  cells: { pitwall: 'pit', vessel: 'vessel', fiber: 'fiber', ray: 'ray', habitat: 'microbe' },
  wall: { fracture: 'foam', pits: 'pit', bacteria: 'microbe', hypha: 'hypha', ash: 'ash', crack: 'crack' },
  meso: { wallpore: 'micropore', macro: 'foam', meso: 'micropore', water: 'water' },
  micro: { sheet: 'sheet', stack: 'stack', micropore: 'micropore', gas: 'gas' },
  atoms: { ring: 'sheet', carboxyl: 'carboxyl', phenol: 'phenol', carbonyl: 'carbonyl', edgeh: 'edgeh' },
};

// Kennzahlen je Ebene: erst die festen aus content.js, dann die berechneten der Szene
export const FACT_ICONS = {
  piece: ['carbon', 'clock', 'ratio'],
  tissue: ['porosity', 'ruler', 'ruler', 'porosity'],
  cells: ['ruler', 'microbe', 'hypha'],
  wall: ['pit', 'pit', 'ruler'],
  meso: ['foam', 'micropore', 'micropore', 'water'],
  micro: ['micropore', 'stack', 'layers', 'micropore'],
  atoms: ['bond', 'molecule', 'ratio'],
};

export function hexBadge(icon, cls = '') {
  return `<svg class="hex ${cls}" viewBox="0 0 40 40" aria-hidden="true"><path class="hex-shape" d="${HEX}"/>` +
    `<g class="hex-glyph" transform="translate(10 10) scale(0.8333)" fill="none" stroke="currentColor" stroke-width="1.8" ` +
    `stroke-linecap="round" stroke-linejoin="round">${G[icon] || G.info}</g></svg>`;
}
