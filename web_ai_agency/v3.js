// Agenten-Büro v3 (Bonbon): sechs Gesamtentwürfe A–F = Avatar-Stil · Farbführung · Oberfläche der 3 Ebenen.
// Richtungen aus dem Würfel (variation, Wurf 63758): A stapel+verlauf · B raum+aktion · C kommando+ausnahme ·
// D spalten+erklären · E nebeneinander+zustand · F eigene Empfehlung (Lotse + Schublade).
// Gelb bleibt „wartet auf dich“, Rot Fehler/Stopp → keine Phase und kein Möbel in Gelb oder Rot.
import { LOOKS } from './look.js';

export const VARIANTS = {
  A: { key: 'Büro:A', name: 'Ebenen-Stapel', shell: 'stack', face: 'glanz', finish: 'jelly', limbs: 'same', sparkle: true, pal: 'phase' },
  B: { key: 'Büro:B', name: 'Karte am Objekt', shell: 'card', face: 'knopf', finish: 'jelly', limbs: 'accent', boots: true, pal: 'lagune' },
  C: { key: 'Büro:C', name: 'Befehlspalette', shell: 'cmd', face: 'bogen', finish: 'clay', limbs: 'same', pal: 'wolke' },
  D: { key: 'Büro:D', name: 'Phasen-Spalten', shell: 'kanban', face: 'bogen', finish: 'clay', limbs: 'role', band: true, pal: 'streifen' },
  E: { key: 'Büro:E', name: 'Spalten nebeneinander', shell: 'miller', face: 'glanz', finish: 'clay', limbs: 'role', pal: 'zucker' },
  // K = Wahl des Users 2026-10-14: Optik + Karte von B, dazu alle Möglichkeiten der anderen Entwürfe als Ansicht/Schalter
  K: { key: 'Büro:K', name: 'Kombination', shell: 'card', combo: true, face: 'knopf', finish: 'jelly', limbs: 'accent', boots: true, pal: 'lagune' },
  F: { key: 'Büro:F', name: 'Lotse mit Schublade', shell: 'guide', face: 'glanz', finish: 'satin', limbs: 'accent', boots: true, sparkle: true, pal: 'klar' },
};

const PH = (auftrag, plan, bau, pruef, liefer) => ({ auftrag, plan, bau, pruef, liefer });
// pad = Bodenfläche je Phase, frame = Möbelgestelle je Phase (Platten bleiben weiß)
export const PALETTES = {
  phase: { name: 'Phasen-Pastell', bg: '#F7F5EF', floor: '#F4F1E8', wall: '#FFFFFF', walk: '#FFFFFF', pad: PH('#FFDCC8', '#E6DBFF', '#D3E9FF', '#CFF2E2', '#FFDCE8'), frame: PH('#FF9F7A', '#A88BF0', '#5FAEF0', '#3FC497', '#EE8AB0') },
  lagune: { name: 'Türkis-Lagune', bg: '#DDF3F1', floor: '#CFEEEB', wall: '#F3FFFE', walk: '#ECFBFA', pad: PH('#B7E9E3', '#B9E2EE', '#ADDFE8', '#B5EBDD', '#C3ECE5'), frame: PH('#FF8E7C', '#9D7FF0', '#25B4C6', '#21B393', '#E77FB0') },
  wolke: { name: 'Wolkenweiß', bg: '#FAF9F6', floor: '#FBFAF7', wall: '#FFFFFF', walk: '#FFFFFF', pad: PH('#F2F0EB', '#F2F0EB', '#F2F0EB', '#F2F0EB', '#F2F0EB'), frame: PH('#D6D1C7', '#D6D1C7', '#D6D1C7', '#D6D1C7', '#D6D1C7') },
  streifen: { name: 'Phasen-Streifen', bg: '#F6F4EE', floor: '#F1EEE6', wall: '#FFFFFF', walk: '#FFFFFF', pad: PH('#FFC7A8', '#D6C4FF', '#B9DCFF', '#B4EED4', '#FFC9DD'), frame: PH('#FF8A5E', '#9473F0', '#3D9BEA', '#24B784', '#E2709E') },
  zucker: { name: 'Zuckerwatte', bg: '#FFF5F9', floor: '#FCEFF5', wall: '#FFFFFF', walk: '#FFFFFF', pad: PH('#FFD5E5', '#E8D6FF', '#D4EEFF', '#D1F3E3', '#FFE3EF'), frame: PH('#F28DB8', '#B08CF0', '#74C3EC', '#5BC99B', '#F28DB8') },
  klar: { name: 'Bonbon klar', bg: '#F1F9F9', floor: '#EAF4F3', wall: '#FFFFFF', walk: '#FFFFFF', pad: PH('#FFCDB5', '#D9C8FF', '#BFDDFF', '#B8EDD4', '#FFC8DC'), frame: PH('#FF946B', '#A07EF2', '#4EA6F0', '#2FBF8E', '#EC80AA') },
  // Nachtbüro (Wunsch des Users 2026-10-14): Neon in Richtung Claude Ops (dunkles Navy, Himmelblau). Kein Gelb, kein Rot.
  nacht: { name: 'Neon-Nacht', bg: '#0A0F19', floor: '#0E1626', wall: '#131D31', walk: '#16213A', ink: '#E6F7FF', card: '#131D31', pad: PH('#0F2A3D', '#241C44', '#132A4A', '#0F3A2E', '#3A1830'), frame: PH('#38BDF8', '#A78BFA', '#60A5FA', '#34D399', '#F472B6') },
};

// Theme der Ansicht: „nacht“ (Standard, Wahl des Users 2026-10-14) oder „tag“ (Palette der Variante). Pro Browser gemerkt (buero.prefs.theme); ?theme= überschreibt zum Testen.
export const THEME = (() => {
  try {
    return new URLSearchParams(location.search).get('theme') || JSON.parse(localStorage.getItem('buero.prefs') || '{}').theme || 'nacht';
  } catch { return 'nacht'; }
})();

// Look Bonbon mit Farbführung der Variante: weiche Kontur, Phasenfarben am Boden und an den Gestellen
export function lookFor(V) {
  const night = THEME === 'nacht';
  const P = night ? PALETTES.nacht : PALETTES[V.pal] || PALETTES.klar, base = LOOKS.C;
  const ink = P.ink || '#1E1E1E', card = P.card || '#FFFFFF';
  return {
    ...base, name: `Bonbon · ${P.name}`, bg: P.bg, paper: P.bg, floor: P.floor, wall: P.wall, prop: card, prop2: P.frame.bau, pad: P.pad.bau,
    padOf: P.pad, frameOf: P.frame, walk: P.walk, walkW: 2.6, walkLine: ink, walkLineA: 0.22, walkDash: [0.5, 0.45],
    zoneLine: ink, zoneLW: 2, zoneA: 0.28, padR: 0.55, edgeMix: 0.36, rich: true,
    hemi: ['#FFFFFF', P.floor, 2.05], sun: ['#FFF6E8', 1.1],
    label: { bg: card, fg: ink, border: night ? 'rgba(56, 189, 248, .5)' : 'rgba(30, 30, 30, .32)' },
  };
}
