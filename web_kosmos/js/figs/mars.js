// Infografiken Ast Mars (02E Mars & Monde, 02E1 Phobos, 02E2 Deimos). Werte: NASA Mars/Phobos/Deimos Facts,
// NSSDCA Mars Fact Sheet (Radius, Drehung, GM, Bahnen der Monde), NPS Grand Canyon, USGS Mauna Kea; Winkel und
// synchrone Bahn als eigene Rechnung daraus.
import { MARS } from '../martian.js';

const DEG = 180 / Math.PI, AU = 149597870.7;
const GM = 42828.37;                     // km³/s², NSSDCA Mars Fact Sheet
const PH = { a: 9378, d: Math.cbrt(27 * 22 * 18) }, DE = { a: 23459 };   // km (Halbachse, mittlerer Durchmesser)
// Bahn mit gleicher Umlaufzeit wie die Marsdrehung (Kepler): rund 20.400 km vom Mittelpunkt
const SYNC = Math.cbrt(GM * (MARS.rot * 3600) ** 2 / (4 * Math.PI ** 2));
const disc = (r, d) => 2 * Math.asin(r / d) * DEG;   // Winkeldurchmesser in Grad
const SKY = { phobos: disc(MARS.r, PH.a), deimos: disc(MARS.r, DE.a), moon: disc(3474.8 / 2, 384400) };
const sunMars = disc(695700, 1.52366 * AU), phobosUp = (PH.d / (PH.a - MARS.r)) * DEG;
const deg = (v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: v < 1 ? 2 : 0 })}°`;

const ORBITS = (on) => ({
  k: 'orbit', l: 'Mars', r: MARS.r, alt: 'Bahnen von Phobos und Deimos um Mars von oben, maßstäblich',
  orbits: [
    { l: 'Phobos', a: PH.a, t: '9.378 km · 7 h 39 min', hl: on === 'phobos' },
    { l: 'Synchrone Bahn', a: SYNC, t: `${(Math.round(SYNC / 10) * 10).toLocaleString('de-DE')} km · 24 h 37 min`, dash: true },
    { l: 'Deimos', a: DE.a, t: '23.459 km · 30 h 18 min', hl: on === 'deimos' },
  ],
  cap: 'Bahnen maßstäblich von oben. Auf der gestrichelten Bahn liefe ein Mond so schnell um, wie Mars sich dreht (eigene Rechnung aus GM und Drehung). Phobos kreist weit innerhalb, schneller als der Planet, und sinkt um 1,8 m je hundert Jahre; Deimos kreist knapp außerhalb.',
  s: ['nssdc-mars', 'nasa-phobos'],
});
const CRATERS = (on) => ({
  k: 'scale', alt: 'Phobos und Deimos maßstäblich mit ihrem größten Krater',
  items: [
    { l: 'Phobos', a: 27, b: 22, c: 9, cl: 'Stickney 9 km', t: '27 × 22 × 18 km', hl: on === 'phobos' },
    { l: 'Deimos', a: 15, b: 12, c: 2.3, cl: '2,3 km', t: '15 × 12 × 11 km', hl: on === 'deimos' },
  ],
  cap: 'Beide Monde im selben Maßstab, je mit dem größten Krater. Stickney ist ein Drittel so breit wie Phobos lang ist; der größte Krater auf Deimos misst ein Fünftel davon.',
  s: ['nasa-phobos', 'nasa-deimos'],
});
const MARS_SKY = (on) => ({
  k: 'scale', h: 128, alt: 'Mars am Himmel von Phobos und Deimos im Vergleich zum Vollmond, Winkelgröße maßstäblich',
  items: [
    { l: 'Mars von Phobos', a: SKY.phobos, t: deg(SKY.phobos), hl: on === 'phobos' },
    { l: 'Mars von Deimos', a: SKY.deimos, t: deg(SKY.deimos), hl: on === 'deimos' },
    { l: 'Vollmond (Erde)', a: SKY.moon, t: deg(SKY.moon) },
  ],
  cap: 'Winkelgröße am Himmel maßstäblich (eigene Rechnung aus Marsradius und Bahnradius). Der Vollmond von der Erde ist daneben nur ein Punkt.',
  s: ['nssdc-mars', 'nasa-moon'],
});

export default {
  'mars.olympus': {
    k: 'peaks', alt: 'Höhe von Olympus Mons, Mauna Kea und Mount Everest maßstäblich',
    items: [
      { l: 'Olympus Mons', h: 40, t: 'über 40 km', sub: 'Fuß bis Gipfel', wide: true, hl: true },
      { l: 'Mauna Kea', h: 10.211, t: '10,2 km', sub: 'ab Meeresgrund' },
      { l: 'Mount Everest', h: 8.848, t: '8,8 km', sub: 'über dem Meer' },
    ],
    cap: 'Höhen maßstäblich, Breiten schematisch. Die Grundfläche von Olympus Mons ist so groß wie der US-Bundesstaat Arizona.',
    s: ['plescia-2004', 'usgs-hawaii'],
  },
  'mars.valles': {
    k: 'bars', alt: 'Valles Marineris und Grand Canyon: Länge, Breite und Tiefe im Vergleich',
    groups: [
      { t: 'Länge', u: 'km', items: [{ l: 'Valles Marineris', v: 3870, hl: true }, { l: 'Grand Canyon', v: 447 }] },
      { t: 'Größte Breite', u: 'km', items: [{ l: 'Valles Marineris', v: 600, hl: true }, { l: 'Grand Canyon', v: 28.8 }] },
      { t: 'Tiefe', u: 'km', items: [{ l: 'Valles Marineris', v: 9.3, t: '9,3 (größte)', hl: true }, { l: 'Grand Canyon', v: 1.6, t: '1,6 (mittel)' }] },
    ],
    cap: 'Grand Canyon: Länge entlang des Colorado, größte Breite von Rand zu Rand, mittlere Tiefe (National Park Service).',
    s: ['plescia-2004', 'nps-grca'],
  },
  'mars.caps': {
    k: 'polar', edge: 50, grid: [80, 70, 60], alt: 'Nordpol des Mars von oben: Reifkappe aus Kohlendioxid bis 55° Breite',
    zones: [
      { lat: 55, t: 'bis ≈ 55° Breite', l: 'CO₂-Reif, Winter', l2: 'taut im Frühling', hl: true },
      { lat: 84, t: 'ganzjährig', l: 'Restkappe', l2: '(Schema)' },
    ],
    cap: 'Pol von oben, Breitenkreise maßstäblich als Abstand vom Pol. Die Größe der ganzjährigen Kappe ist schematisch.',
    s: ['nasa-mars-caps'],
  },
  'mars.storms': {
    k: 'timeline', alt: 'Zeitleiste des globalen Staubsturms 2018 auf Mars',
    items: [
      { d: '2018-05-30', t: '30. Mai', l: 'MRO entdeckt', l2: 'den Sturm' },
      { d: '2018-06-10', t: '10. Juni', l: 'Opportunity', l2: 'meldet sich nicht mehr' },
      { d: '2018-06-12', t: '12. Juni', l: 'ein Viertel', l2: 'des Planeten bedeckt' },
      { d: '2018-06-19', t: '19. Juni', l: 'planetenumspannend', hl: true },
    ],
    cap: 'Der globale Staubsturm 2018 in drei Wochen: vom ersten Bild des Mars Reconnaissance Orbiter bis zum ganzen Planeten.',
    s: ['nasa-svs-dust2018'],
  },
  'mars.shadow': {
    k: 'scale', h: 96, alt: 'Winkelgröße von Sonne und Phobos vom Marsboden und Vollmond von der Erde, maßstäblich',
    items: [
      { l: 'Sonne vom Mars', a: sunMars, t: deg(sunMars) },
      { l: 'Phobos im Zenit', a: phobosUp, t: deg(phobosUp), hl: true },
      { l: 'Vollmond (Erde)', a: SKY.moon, t: deg(SKY.moon) },
    ],
    cap: 'Winkelgröße am Himmel maßstäblich (eigene Rechnung). Phobos erscheint kleiner als die Sonnenscheibe – sein Schatten auf Mars ist nur ein Halbschatten.',
    s: ['nssdc-mars', 'nasa-sun', 'nasa-phobos'],
  },
  'phobos.stickney': CRATERS('phobos'),
  'phobos.grooves': {
    k: 'grooves', foot: 'Schema, nicht maßstäblich', alt: 'Schema: Rillen auf Phobos ordnen sich um die vordere Spitze in Flugrichtung',
    cap: 'Schema nach den Bildern von Mars Express: Die Rillen bilden Familien um die vordere Spitze in Flugrichtung, nicht um den Krater Stickney.',
    s: ['murray-2006'],
  },
  'phobos.regolith': {
    k: 'range', min: -130, max: 20, step: 30, u: '°C', alt: 'Temperaturen auf Phobos zwischen −112 und −4 Grad Celsius',
    span: [-112, -4], spanL: 'Spanne auf Phobos',
    marks: [{ v: -112, t: '−112 °C', l: 'Nachtseite' }, { v: -4, t: '−4 °C', l: 'Tagseite' }],
    cap: 'Der feine Staub speichert kaum Wärme: Zwischen Tag- und Nachtseite liegen über 100 Grad.',
    s: ['nasa-phobos'],
  },
  'phobos.mars': MARS_SKY('phobos'),
  'phobos.orbit': ORBITS('phobos'),
  'deimos.regolith': {
    k: 'layers', from: 'Oberfläche', to: 'Mitte', alt: 'Staubmantel von Deimos bis 100 Meter im Verhältnis zum Radius, maßstäblich',
    items: [
      { l: 'Staub und Geröll', d: 0.1, t: 'bis 100 m', hl: true },
      { l: 'Gestein bis zur Mitte', d: 6.2, t: '≈ 6,2 km' },
    ],
    cap: 'Maßstäblich: Selbst 100 m Staub sind nur ein schmaler Saum auf dem mittleren Radius von gut 6 km (eigene Rechnung aus 15 × 12 × 11 km).',
    s: ['nasa-deimos'],
  },
  'deimos.craters': CRATERS('deimos'),
  'deimos.mars': MARS_SKY('deimos'),
  'deimos.orbit': ORBITS('deimos'),
};
