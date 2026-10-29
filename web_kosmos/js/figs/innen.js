// Infografiken Ast Innere Planeten (02I Merkur, 02J Venus) – Aufbau wie figs/mars.js. Werte: NSSDCA Fact Sheets, Gazetteer,
// begutachtete Paper (Quellen je Bild); Winkelgrößen und Umrechnungen als eigene Rechnung. Sonne am Merkurhimmel und
// Temperaturvergleich zogen am 29.10.2026 von den Abzeichen des Sonnensystems hierher (dort fliegen sie jetzt hinein).

const DEG = 180 / Math.PI, AU = 149597870.7, R_SUN = 695700;   // km (IAU 2012, NSSDCA Sun Fact Sheet)
const disc = (r, d) => 2 * Math.asin(r / d) * DEG;              // Winkeldurchmesser in Grad
const SUN_SKY = { peri: disc(R_SUN, 46.0e6), aph: disc(R_SUN, 69.818e6), earth: disc(R_SUN, AU) };
const deg = (v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 2 })}°`;
const TAIL = 1400 * 2439.7 / 1e6;                               // Mio. km: 1.400 Merkurradien (Baumgardner et al. 2008)

// Temperaturen: Merkur Nacht/Tag am heißen Pol (Vasavada et al. 1999: ≈ 100 / 700 K), Venus am Boden (NSSDCA 737 K)
const TEMPS = (on) => ({
  k: 'range', min: -200, max: 500, step: 100, u: '°C', alt: 'Temperaturen: Merkur zwischen minus 173 und plus 427 Grad, Venus am Boden 464 Grad Celsius',
  span: [-173, 427], spanL: 'Merkur, Nacht bis Mittag',
  marks: [{ v: -173, t: '−173 °C', l: 'Merkur, Nacht' }, { v: 427, t: '427 °C', l: 'Merkur, Mittag', hl: on === 'mercury' }, { v: 464, t: '464 °C', l: 'Venus', hl: on === 'venus' }],
  cap: 'Venus ist überall heißer als Merkurs Mittag, obwohl sie fast doppelt so weit von der Sonne entfernt ist: Die dichte CO₂-Hülle hält die Wärme fest, Tag und Nacht. Merkur aus ≈ 100 und ≈ 700 K umgerechnet.',
  s: ['vasavada-1999', 'nssdc-venus'],
});

export default {
  'mercury.hotpole': {
    k: 'scale', h: 90, alt: 'Die Sonne am Himmel von Merkur im Perihel und Aphel und von der Erde, Winkelgröße maßstäblich',
    items: [
      { l: 'Merkur, Perihel', a: SUN_SKY.peri, t: deg(SUN_SKY.peri), hl: true },
      { l: 'Merkur, Aphel', a: SUN_SKY.aph, t: deg(SUN_SKY.aph) },
      { l: 'von der Erde', a: SUN_SKY.earth, t: deg(SUN_SKY.earth) },
    ],
    cap: 'Die Sonne am Himmel, Winkelgröße maßstäblich (eigene Rechnung aus Sonnenradius und Abstand). Merkurs Abstand schwankt zwischen 46,0 und 69,8 Mio. km – im Perihel erscheint die Sonne mehr als dreimal so breit wie von der Erde.',
    s: ['nssdc-mercury', 'nasa-sun'],
  },
  'mercury.caloris': {
    k: 'scale', h: 110, alt: 'Merkur und das Becken Caloris Planitia maßstäblich',
    items: [{ l: 'Merkur', a: 4879.4, c: 1500, cl: 'Caloris 1.500 km', t: '4.879 km Durchmesser', hl: true }],
    cap: 'Maßstäblich: Das Becken ist knapp ein Drittel so breit wie der ganze Planet.',
    s: ['usgs-gazetteer-mercury', 'nssdc-mercury'],
  },
  'mercury.tail': {
    k: 'bars', alt: 'Länge des Natriumschweifs von Merkur im Vergleich zum Abstand Erde–Mond',
    groups: [{ t: 'Länge', u: 'Mio. km', items: [{ l: 'Natriumschweif', v: TAIL, t: `≈ ${TAIL.toLocaleString('de-DE', { maximumFractionDigits: 1 })}`, hl: true }, { l: 'Erde–Mond', v: 0.3844, t: '0,38' }] }],
    cap: 'Rund 1.400 Merkurradien (eigene Rechnung: 1.400 × 2.439,7 km) – fast neunmal so weit wie der Mond von der Erde.',
    s: ['baumgardner-2008', 'nasa-moon'],
  },
  'mercury.field': {
    k: 'layers', from: 'Oberfläche', to: 'Mitte', alt: 'Aufbau von Merkur: Kruste und Mantel über einem großen Kern, maßstäblich',
    items: [
      { l: 'Kruste und Mantel', d: 420, t: '≈ 420 km' },
      { l: 'Kern, außen flüssig', d: 2020, t: '2.020 km Radius', hl: true },
    ],
    cap: 'Maßstäblich (eigene Rechnung aus 2.440 km Radius): Der Kern reicht bis 2.020 km vom Mittelpunkt, über vier Fünftel des Radius. In seinem flüssigen Teil entsteht das Magnetfeld.',
    s: ['hauck-2013', 'nssdc-mercury'],
  },
  'venus.clouds': {
    k: 'bars', alt: 'Eine Runde um Venus: Wolken in 4 Tagen, Boden in 243 Tagen',
    groups: [{ t: 'Eine Runde um den Planeten', u: 'Tage', items: [{ l: 'Wolken', v: 4, hl: true }, { l: 'Boden', v: 243 }] }],
    cap: 'Die Atmosphäre umrundet Venus rund 60-mal so schnell, wie der Boden sich dreht (eigene Rechnung aus 243 und 4 Tagen).',
    s: ['horinouchi-2020'],
  },
  'venus.maat': {
    k: 'peaks', alt: 'Höhe von Maat Mons, Mauna Kea und Mount Everest maßstäblich',
    items: [
      { l: 'Maat Mons', h: 8, t: '8 km', sub: 'über mittlerem Boden', wide: true, hl: true },
      { l: 'Mauna Kea', h: 10.211, t: '10,2 km', sub: 'ab Meeresgrund' },
      { l: 'Mount Everest', h: 8.848, t: '8,8 km', sub: 'über dem Meer' },
    ],
    cap: 'Höhen maßstäblich, Breiten schematisch. Über die umgebende Ebene ragt Maat Mons knapp 5 km auf.',
    s: ['pia00106', 'usgs-hawaii'],
  },
  'venus.sif': {
    k: 'timeline', alt: 'Zeitleiste: Magellan-Radarbilder 1990 bis 1992 und die Hinweise auf aktiven Vulkanismus 2023 und 2024',
    items: [
      { d: '1990-07-01', t: '1990', l: 'Magellan', l2: 'kartiert Venus' },
      { d: '1992-07-01', t: '1992', l: 'Radarbilder', l2: 'aus mehreren Umläufen' },
      { d: '2023-07-01', t: '2023', l: 'Schlot am Maat Mons', l2: 'verändert' },
      { d: '2024-07-01', t: '2024', l: 'neue Lava', l2: 'Sif Mons, Niobe', hl: true },
    ],
    cap: 'Die Hinweise auf heutigen Vulkanismus stecken in alten Daten: Forscher verglichen Radarbilder derselben Gegend aus verschiedenen Umläufen.',
    s: ['herrick-2023', 'sulcanese-2024'],
  },
  'venus.niobe': TEMPS('venus'),
};
