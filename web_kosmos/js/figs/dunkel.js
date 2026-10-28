// Infografiken Station 05A Dunkle Materie – Aufbau wie figs/galaxis.js; Anteile aus Planck 2018 (Ω·h² mit h = 0,6766,
// eigene Rechnung), Massen der Milchstraße nach Bland-Hawthorn & Gerhard 2016.
export default {
  'darkmatter.budget': {
    k: 'bars', alt: 'Anteile von Dunkler Energie, Dunkler Materie und normaler Materie an der Energiedichte heute',
    groups: [
      { t: 'Anteil an der Energiedichte', u: '%', items: [{ l: 'Dunkle Energie', v: 68.9, t: '68,9' }, { l: 'Dunkle Materie', v: 26.2, t: '26,2', hl: true }, { l: 'normale Materie', v: 4.9, t: '4,9' }] },
      { t: 'Anteil an der Materie', u: '%', items: [{ l: 'Dunkle Materie', v: 84.2, t: '84', hl: true }, { l: 'normale Materie', v: 15.8, t: '16' }] },
    ],
    cap: 'Aus Ωc h² = 0,120 und Ωb h² = 0,0224 (Planck 2018) mit h = 0,677 – eigene Rechnung. Auf ein Teil normaler Materie kommen rund 5,4 Teile Dunkle Materie.',
    s: ['planck-2018'],
  },
  'darkmatter.halo': {
    k: 'bars', alt: 'Masse des Halos der Milchstraße im Vergleich zur Masse ihrer Sterne',
    groups: [{ t: 'Masse der Milchstraße', u: 'Mrd. M☉', items: [{ l: 'Halo (gesamt)', v: 1300, t: '1.300', hl: true }, { l: 'Sterne', v: 50, t: '50' }] }],
    cap: 'Die Sterne machen nur rund 4 % der Gesamtmasse aus; der Rest ist vor allem Dunkle Materie im Halo.',
    s: ['bland-2016'],
  },
  'darkmatter.cluster': {
    k: 'timeline', alt: 'Zeitleiste der Belege für Dunkle Materie von 1933 bis 2026',
    items: [
      { d: 1933, t: '1933', l: 'Zwicky', l2: 'Coma-Haufen zu schnell' },
      { d: 1980, t: '1980', l: 'Rubin, Ford, Thonnard', l2: 'flache Rotationskurven' },
      { d: 2006, t: '2006', l: 'Bullet-Cluster', l2: 'Masse ≠ Gas', hl: true },
      { d: 2018, t: '2018', l: 'Planck', l2: 'Ωc h² = 0,120' },
      { d: 2026, t: '2026', l: 'Webb-Karte', l2: 'COSMOS-Web' },
    ],
    cap: 'Fast hundert Jahre Hinweise aus der Schwerkraft – aber bis heute kein Teilchen im Labor.',
    s: ['zwicky-1933', 'rubin-1980', 'clowe-2006', 'planck-2018', 'scognamiglio-2026'],
  },
};
