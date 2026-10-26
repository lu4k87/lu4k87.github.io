// Infografiken Ast Jupiter (02C Jupiter & Monde, 02C1 Io, 02C2 Europa, 02C3 Ganymed, 02C4 Kallisto). Werte: NSSDCA
// (Jupiter, Galileische Monde, Planeten, Erde, Mond, Sonne), NASA/Hubble, ESA, USGS/IAU-Gazetteer, NOAA, begutachtete
// Paper (Lainey 2009, Davies 2010, McEwen 1998, Kivelson 2002, Schmidt 2011, de Kleer 2017, Fahnen-Nachweise); Winkel,
// Schatten, Tempo, Wassermengen, Lichtlaufzeit und synchrone Bahn als eigene Rechnung daraus.
import { JUPITER, GALILEAN } from '../jovian.js';

const DEG = 180 / Math.PI, C = 299792.458;          // km/s
const GM = 126.687e6;                                // km³/s², NSSDCA Jupiter Fact Sheet
const R_SUN = 695700, R_EARTH = 6371, MOON = { r: 1737.4, a: 384400 };
const D = { earth: 149.6e6, mars: 228.0e6, jupiter: 778.5e6, saturn: 1432.0e6 };   // km, Planetary Fact Sheet
const NAME = { io: 'Io', europa: 'Europa', ganymede: 'Ganymed', callisto: 'Kallisto' };
const IDS = Object.keys(NAME);
const n = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const deg = (v) => `${n(v, v < 1 ? 2 : 1)}°`;
const disc = (r, d) => 2 * Math.asin(r / d) * DEG;   // Winkeldurchmesser in Grad
const shell = (r1, r0) => (4 / 3) * Math.PI * (r1 ** 3 - r0 ** 3);   // Kugelschale in km³

// Jupiter am Himmel der Monde (vom Mondmittelpunkt), Erde vom Mond, Vollmond
const JUP_SKY = Object.fromEntries(IDS.map((id) => [id, disc(JUPITER.r, GALILEAN[id].a)]));
const EARTH_SKY = disc(R_EARTH, MOON.a), MOON_SKY = disc(MOON.r, MOON.a);
// Schatten auf Jupiters Wolken: Kern = 2R − Weg·Sonnenwinkel, Halbschatten = 2R + Weg·Sonnenwinkel (mittlerer Sonnenabstand)
const SUN_ANG = (2 * R_SUN) / D.jupiter;
const SHADOW = Object.fromEntries(IDS.map((id) => {
  const g = GALILEAN[id], w = (g.a - JUPITER.r) * SUN_ANG;
  return [id, { umbra: 2 * g.r - w, pen: 2 * g.r + w }];
}));
// Tempo bei Io: Bahn und mitrotierendes Magnetfeld (Drehung System III)
const V_IO = (2 * Math.PI * GALILEAN.io.a) / (1.769138 * 86400), V_FIELD = (2 * Math.PI * GALILEAN.io.a) / (JUPITER.rot * 3600);
// Bahn mit gleicher Umlaufzeit wie Jupiters Drehung (Kepler): rund 160.000 km vom Mittelpunkt
const SYNC = Math.cbrt((GM * (JUPITER.rot * 3600) ** 2) / (4 * Math.PI ** 2));
// Wärme aus dem Inneren: Io 9,33·10¹³ W (Lainey 2009), Erde 47 TW (Davies 2010) je Quadratmeter
const EARTH_FLUX = 47e12 / (4 * Math.PI * (R_EARTH * 1e3) ** 2);
// Ozeane als Kugelschale: Europa 20 km Eis + 100 km Wasser, Ganymed 150 km Eis + 100 km Wasser
const OCEAN = {
  europa: shell(GALILEAN.europa.r - 20, GALILEAN.europa.r - 120) / 1e9,
  ganymede: shell(GALILEAN.ganymede.r - 150, GALILEAN.ganymede.r - 250) / 1e9,
  earth: 1.338,   // Mrd. km³, USGS
};
const LOKI = 2 * Math.sqrt(21500 / Math.PI);   // km, Kreis gleicher Fläche wie der warme Boden
const light = (d) => d / C / 60, sunlight = (d) => (D.earth / d) ** 2 * 100;

const SKY = (id) => ({
  k: 'scale', h: 110, alt: `Jupiter am Himmel von ${NAME[id]} im Vergleich zur Erde vom Mond und zum Vollmond, Winkelgröße maßstäblich`,
  items: [
    { l: 'Jupiter', a: JUP_SKY[id], t: `von ${NAME[id]} ${deg(JUP_SKY[id])}`, hl: true },
    { l: 'Erde vom Mond', a: EARTH_SKY, t: deg(EARTH_SKY) },
    { l: 'Vollmond', a: MOON_SKY, t: deg(MOON_SKY) },
  ],
  cap: `Winkelgröße am Himmel maßstäblich (eigene Rechnung aus Radius und Abstand). Von ${NAME[id]} aus ist Jupiter rund ${Math.round(JUP_SKY[id] / MOON_SKY)}-mal so breit wie der Vollmond bei uns; selbst die Erde am Mondhimmel wirkt daneben klein.`,
  s: ['nssdc-jovsat', 'nasa-jupiter-fs', 'nasa-moon', 'nasa-earth'],
});
const PLUMES = (on) => ({
  k: 'peaks', alt: 'Höhe der Vulkanfahnen auf Io maßstäblich: die größten bis 500 km, Tvashtar 350 km, Pele rund 300 km, Prometheus 50 bis 100 km',
  items: [
    { l: 'größte Fahnen', h: 500, t: 'bis 500 km' },
    { l: 'Tvashtar', h: 350, t: '350 km', sub: 'New Horizons', hl: on === 'tvashtar' },
    { l: 'Pele', h: 300, t: '≈ 300 km', sub: 'Richtwert', hl: on === 'pele' },
    { l: 'Prometheus', h: 75, t: '50–100 km', hl: on === 'prometheus' },
  ],
  cap: `Höhen maßstäblich, Breiten schematisch. Tvashtar maß New Horizons 2007, Prometheus nach USGS, Pele als Richtwert. Die größten Fahnen steigen bis 500 km auf – gut ein Viertel des Io-Radius (eigene Rechnung).`,
  s: ['usgs-io', 'spencer-2007', 'nssdc-jovsat'],
});
const OCEANS = (on) => ({
  k: 'bars', alt: 'Flüssiges Wasser und Tiefe der Ozeane von Ganymed und Europa im Vergleich zu den Meeren der Erde',
  groups: [
    { t: 'Flüssiges Wasser', u: 'Mrd. km³', items: [
      { l: 'Ganymed', v: OCEAN.ganymede, t: `≈ ${n(OCEAN.ganymede, 1)}`, hl: on === 'ganymede' },
      { l: 'Europa', v: OCEAN.europa, t: `≈ ${n(OCEAN.europa, 1)}`, hl: on === 'europa' },
      { l: 'Erde (Meere)', v: OCEAN.earth, t: n(OCEAN.earth, 1) },
    ] },
    { t: 'Tiefe', u: 'km', items: [
      { l: 'Ganymed', v: 100, t: '≈ 100', hl: on === 'ganymede' },
      { l: 'Europa', v: 100, t: '60–150', hl: on === 'europa' },
      { l: 'Marianengraben', v: 10.935, t: '10,9' },
      { l: 'Erde (Mittel)', v: 3.682, t: '3,7' },
    ] },
  ],
  cap: `Wasser als Kugelschale gerechnet (eigene Rechnung): Europa mit 20 km Eis über 100 km Ozean (Mitte der NASA-Schätzungen), Ganymed mit 100 km Ozean unter 150 km Eis (Hubble). Europa hätte gut doppelt, Ganymed über fünfmal so viel Wasser wie alle Meere der Erde.`,
  s: ['nasa-europa-poster', 'hst-ganymede-2015', 'nssdc-jovsat', 'usgs-water', 'noaa-depth'],
});
const CHAOS = {
  k: 'range', min: 0, max: 40, step: 10, u: 'km', alt: 'Tiefe unter Europas Oberfläche: Wasserlinsen ab rund 3 km, Unterkante des Eispanzers bei 15 bis 25 km',
  span: [15, 25], spanL: 'Unterkante des Eispanzers',
  marks: [{ v: 3, t: 'ab ≈ 3 km', l: 'Wasserlinsen' }],
  cap: 'Tiefe unter der Oberfläche. Nach Schmidt und Kollegen bilden sich Chaos-Gebiete wie Conamara und Thera Macula über Linsen aus flüssigem Wasser, schon ab rund 3 km Tiefe – weit über dem Ozean unter dem 15 bis 25 km dicken Eispanzer (Schätzung).',
  s: ['schmidt-2011', 'nasa-europa-poster'],
};
const LINES = (on) => ({
  k: 'bars', alt: 'Länge langer Strukturen auf Ganymed und Europa im Vergleich zu Valles Marineris auf Mars',
  groups: [{ t: 'Länge', u: 'km', items: [
    { l: 'Valles Marineris', v: 3870 },
    { l: 'Uruk Sulcus', v: 2200, hl: on === 'uruk' },
    { l: 'Minos Linea', v: 2170, hl: on === 'minos' },
    { l: 'Agenor Linea', v: 1500, hl: on === 'agenor' },
    { l: 'Sidon Flexus', v: 1133, hl: on === 'sidon' },
  ] }],
  cap: `Uruk Sulcus liegt auf Ganymed, Minos, Agenor und Sidon auf Europa, Valles Marineris auf Mars zum Vergleich. Für Sidon Flexus nennt das Gazetteer die Ausdehnung des Bogenzugs. Europas ganzer Umfang misst ${n(2 * Math.PI * GALILEAN.europa.r)} km (eigene Rechnung).`,
  s: ['usgs-gazetteer', 'usgs-europa-names', 'usgs-sidon', 'nasa-mars-facts', 'nssdc-jovsat'],
});
const RAYS = (on) => ({
  k: 'scale', h: 80, alt: 'Drei junge Krater mit hellen Strahlen maßstäblich: Osiris auf Ganymed, Burr auf Kallisto, Pwyll auf Europa',
  items: [
    { l: 'Osiris', a: 107, t: '107 km · Ganymed', hl: on === 'osiris' },
    { l: 'Burr', a: 75, t: '75 km · Kallisto', hl: on === 'burr' },
    { l: 'Pwyll', a: 45, t: '45 km · Europa', hl: on === 'pwyll' },
  ],
  cap: 'Drei junge Krater mit hellem Auswurf, maßstäblich. Die Einschläge haben helleres Material aus der Tiefe über die dunklere Umgebung verteilt; weil es noch kaum nachgedunkelt ist, gelten diese Krater als jung.',
  s: ['usgs-gazetteer', 'usgs-europa-names'],
});
const EUROPA_CRATERS = (on) => ({
  k: 'scale', h: 100, alt: 'Europas größte benannte Einschlagstrukturen maßstäblich: Tyre, Callanish, Pwyll, Manannán',
  items: [
    { l: 'Tyre', a: 150, t: '≈ 150 km', hl: on === 'tyre' },
    { l: 'Callanish', a: 107, t: '≈ 107 km', hl: on === 'callanish' },
    { l: 'Pwyll', a: 45, t: '45 km' },
    { l: 'Manannán', a: 30, t: '≈ 30 km', hl: on === 'manannan' },
  ],
  cap: 'Europas größte benannte Einschlagstrukturen maßstäblich. Tyre und Callanish sind flache Ringbecken statt tiefer Krater. Große Krater sind selten, weil die Oberfläche ständig erneuert wird und geologisch jung ist.',
  s: ['usgs-europa-names'],
});
const BASINS = (on) => ({
  k: 'scale', h: 120, alt: 'Ringbecken Valhalla und Asgard maßstäblich auf der Scheibe von Kallisto',
  items: [
    { l: 'Valhalla', a: 2 * GALILEAN.callisto.r, c: 3000, cl: '3.000 km', t: 'auf Kallisto', hl: on === 'valhalla' },
    { l: 'Asgard', a: 2 * GALILEAN.callisto.r, c: 1400, cl: '1.400 km', t: 'auf Kallisto', hl: on === 'asgard' },
  ],
  cap: `Beide Ringbecken maßstäblich auf Kallistos Scheibe (Durchmesser ${n(2 * GALILEAN.callisto.r)} km): Valhalla reicht über fast zwei Drittel davon. Ringe aus Graten und Rinnen umgeben je einen hellen Mittelteil.`,
  s: ['usgs-gazetteer', 'nssdc-jovsat'],
});
const MISSIONS = (on) => ({
  k: 'timeline', alt: 'Zeitleiste der Raumsonden Juice und Europa Clipper vom Start bis zur Ankunft bei Jupiter',
  items: [
    { d: '2023-04-14', t: '14.04.2023', l: 'Juice startet', l2: 'ESA, Ariane 5', hl: on === 'juice' },
    { d: '2024-10-14', t: '14.10.2024', l: 'Europa Clipper', l2: 'startet (NASA)', hl: on === 'clipper' },
    { d: '2026-12-03', t: '03.12.2026', l: 'Clipper holt', l2: 'Schwung an der Erde' },
    { d: '2030-04-15', t: 'April 2030', l: 'Clipper am Jupiter', l2: '49 Vorbeiflüge an Europa', hl: on === 'clipper' },
    { d: '2031-07-15', t: 'Juli 2031', l: 'Juice am Jupiter', l2: 'zuletzt um Ganymed', hl: on === 'juice' },
  ],
  cap: 'Zwei Sonden unterwegs zum Jupiter: Europa Clipper startete später, kommt aber gut ein Jahr früher an. Juice soll zum Schluss Ganymed umkreisen – als erste Sonde einen Mond im äußeren Sonnensystem.',
  s: ['esa-juice', 'nasa-clipper'],
});

export default {
  'jupiter.grs': {
    k: 'bars', alt: 'Lange Achse des Großen Roten Flecks von Ende des 19. Jahrhunderts bis 2014 im Vergleich zum Erddurchmesser',
    groups: [{ t: 'Größe im Vergleich', u: 'km', items: [
      { l: 'Ende 19. Jh.', v: 41038, t: '≈ 41.000' },
      { l: '1979 (Voyager)', v: 23335, t: '23.300' },
      { l: '1995 (Hubble)', v: 20953, t: '21.000' },
      { l: '2009', v: 17912, t: '17.900' },
      { l: '2014 (Hubble)', v: 16496, t: '16.500', hl: true },
      { l: 'Erde (Durchm.)', v: 2 * R_EARTH, t: n(2 * R_EARTH) },
    ] }],
    cap: 'Lange Achse des Flecks nach NASA/Hubble (2014), gerundet; der Wert vom Ende des 19. Jahrhunderts ist eine historische Schätzung. Heute passt die Erde nur noch gut einmal hinein, und der Fleck schrumpft weiter, um rund 0,19 Längengrade pro Jahr.',
    s: ['hst-grs-2014', 'nasa-earth', 'simon-2018'],
  },
  'jupiter.bands': {
    k: 'bars', alt: 'Dauer einer Drehung von Jupiter, Saturn, Neptun, Uranus, Erde und Mars',
    groups: [{ t: 'Ein Tag (Drehung)', u: 'Stunden', items: [
      { l: 'Jupiter', v: 9.9, hl: true }, { l: 'Saturn', v: 10.7 }, { l: 'Neptun', v: 16.1 },
      { l: 'Uranus', v: 17.2 }, { l: 'Erde', v: 23.9 }, { l: 'Mars', v: 24.6 },
    ] }],
    cap: 'Siderische Drehung nach dem Planetary Fact Sheet. Jupiter dreht sich am schnellsten von allen Planeten. Seine Wolken – drei Schichten, zusammen nur rund 71 km dick – umrunden ihn in Bändern, mit Winden bis 539 km/h am Äquator.',
    s: ['nasa-planets', 'nasa-jupiter-facts'],
  },
  'jupiter.shadow': {
    k: 'bars', alt: 'Durchmesser von Kern- und Halbschatten der vier Galileischen Monde auf Jupiters Wolken',
    groups: [
      { t: 'Kernschatten', u: 'km', items: IDS.map((id) => ({ l: NAME[id], v: SHADOW[id].umbra, t: n(Math.round(SHADOW[id].umbra / 10) * 10), hl: id === 'io' })) },
      { t: 'Halbschatten außen', u: 'km', items: IDS.map((id) => ({ l: NAME[id], v: SHADOW[id].pen, t: n(Math.round(SHADOW[id].pen / 10) * 10), hl: id === 'io' })) },
    ],
    cap: 'Durchmesser der Schatten auf Jupiters Wolken (eigene Rechnung aus Mondradius, Bahnradius und Größe der Sonnenscheibe bei mittlerem Sonnenabstand). Je weiter draußen ein Mond kreist, desto kleiner sein Kernschatten: Kallisto wirft trotz ihrer Größe den kleinsten.',
    s: ['nssdc-jovsat', 'nasa-jupiter-fs', 'nasa-sun', 'nasa-planets'],
  },
  'jupiter.res': {
    k: 'orbit', l: '', r: JUPITER.r, alt: 'Bahnen von Io, Europa und Ganymed um Jupiter von oben, maßstäblich, Umläufe im Takt 4 : 2 : 1',
    orbits: [
      { l: 'Io', a: GALILEAN.io.a, t: '1,77 Tage · 4 Umläufe', hl: true },
      { l: 'Europa', a: GALILEAN.europa.a, t: '3,55 Tage · 2 Umläufe', hl: true },
      { l: 'Ganymed', a: GALILEAN.ganymede.a, t: '7,15 Tage · 1 Umlauf', hl: true },
    ],
    cap: 'Bahnen maßstäblich von oben, in der Mitte Jupiter. Während Ganymed einmal kreist, schafft Europa zwei und Io vier Umläufe; die Lage der Punkte ist schematisch. Kallisto kreist weit draußen, außerhalb der Resonanz.',
    s: ['nssdc-jovsat', 'lieske-1998'],
  },
  'jupiter.sun': {
    k: 'bars', alt: 'Sonnenlicht und Lichtlaufzeit bei Erde, Mars, Jupiter und Saturn',
    groups: [
      { t: 'Sonnenlicht', u: '% der Erde', items: [['Erde', D.earth], ['Mars', D.mars], ['Jupiter', D.jupiter], ['Saturn', D.saturn]]
        .map(([l, d]) => ({ l, v: sunlight(d), t: n(sunlight(d), sunlight(d) < 10 ? 1 : 0), hl: l === 'Jupiter' })) },
      { t: 'Licht unterwegs', u: 'Minuten', items: [['Erde', D.earth], ['Mars', D.mars], ['Jupiter', D.jupiter], ['Saturn', D.saturn]]
        .map(([l, d]) => ({ l, v: light(d), t: n(light(d), 1), hl: l === 'Jupiter' })) },
    ],
    cap: 'Eigene Rechnung aus den mittleren Sonnenabständen: Die Helligkeit fällt mit dem Quadrat der Entfernung. Bei Jupiter kommt nur noch rund ein Siebenundzwanzigstel des Lichts an, das die Erde trifft, und es ist 43 Minuten unterwegs.',
    s: ['nasa-planets', 'nasa-jupiter-facts'],
  },

  'io.pele': PLUMES('pele'),
  'io.tvashtar': PLUMES('tvashtar'),
  'io.prometheus': PLUMES('prometheus'),
  'io.loki': {
    k: 'scale', h: 110, alt: 'Loki Patera, die Caldera von Prometheus und der Lavasee von Pele maßstäblich von oben',
    items: [
      { l: 'Loki Patera', a: LOKI, t: 'Boden 21.500 km²', hl: true },
      { l: 'Prometheus', a: 28, b: 14, t: '28 × 14 km' },
      { l: 'Pele-Lavasee', a: 10, t: 'mind. 10 km' },
    ],
    cap: 'Maßstäblich von oben, Loki als Kreis gleicher Fläche (eigene Rechnung aus 21.500 km² warmem Boden). Den See erneuern Wellen frischer Lava, die mit ein bis zwei Kilometern pro Tag über ihn wandern.',
    s: ['dekleer-2017', 'usgs-io'],
  },
  'io.sulfur': {
    k: 'range', min: 0, max: 2500, step: 500, u: '°C', alt: 'Temperatur der Lava auf Io bis rund 1.727 Grad Celsius im Vergleich zum Kīlauea mit 1.140 Grad',
    span: [1427, 1727], spanL: 'Pillan Patera',
    marks: [{ v: 1727, t: 'bis 1.727 °C', l: 'Io, vermutet' }, { v: 1140, t: '1.140 °C', l: 'Kīlauea (Erde)', ref: true }],
    cap: 'Gelb, Orange und Rot stammen vom Schwefel – die heißesten Ströme aber sind Silikatlava. Bei Pillan Patera maß Galileo über 1.427 °C (1.700 K), vielleicht bis 1.727 °C: heißer als jede heutige Eruption auf der Erde.',
    s: ['usgs-io', 'mcewen-1998'],
  },
  'io.tide': {
    k: 'bars', alt: 'Wärme aus dem Inneren von Io und Erde, gesamt und je Quadratmeter',
    groups: [
      { t: 'Wärme aus dem Inneren', u: 'Terawatt', items: [{ l: 'Io', v: 93.3, t: '≈ 93', hl: true }, { l: 'Erde', v: 47, t: '47' }] },
      { t: 'Je Quadratmeter', u: 'Watt', items: [{ l: 'Io', v: 2.24, t: '2,24', hl: true }, { l: 'Erde', v: EARTH_FLUX, t: n(EARTH_FLUX, 2) }] },
    ],
    cap: `Io ist kaum größer als unser Mond, gibt aber doppelt so viel Wärme ab wie die ganze Erde – je Quadratmeter rund ${Math.round(2.24 / EARTH_FLUX)}-mal so viel (eigene Rechnung aus der Erdoberfläche). Die Energie stammt aus den Gezeiten; ihr Betrag folgt aus über hundert Jahren Bahnbeobachtungen.`,
    s: ['lainey-2009', 'davies-2010', 'nasa-earth', 'nasa-moon'],
  },
  'io.jupiter': SKY('io'),
  'io.torus': {
    k: 'orbit', l: '', r: JUPITER.r, alt: 'Synchrone Bahn um Jupiter, Bahnen von Io und Europa von oben, maßstäblich',
    orbits: [
      { l: 'Synchrone Bahn', a: SYNC, t: `${n(Math.round(SYNC / 1e4) * 1e4)} km · 9 h 55 min`, dash: true },
      { l: 'Io', a: GALILEAN.io.a, t: '421.800 km · 1,77 Tage', hl: true },
      { l: 'Europa', a: GALILEAN.europa.a, t: '671.100 km · 3,55 Tage' },
    ],
    cap: 'Bahnen maßstäblich von oben, in der Mitte Jupiter. Auf der gestrichelten Bahn liefe ein Mond so schnell um, wie Jupiter sich dreht (eigene Rechnung aus GM und Drehung). Weiter draußen überholt das mitrotierende Magnetfeld alles: Gas, das Io verliert, wird ionisiert, mitgerissen und sammelt sich als Ring entlang der Io-Bahn.',
    s: ['nasa-jupiter-fs', 'nssdc-jovsat', 'bagenal-2020'],
  },
  'io.flux': {
    k: 'bars', alt: 'Tempo des mitrotierenden Magnetfelds und von Io auf seiner Bahn',
    groups: [{ t: 'Tempo bei Io', u: 'km/s', items: [
      { l: 'Feld (dreht mit)', v: V_FIELD, t: n(V_FIELD) },
      { l: 'Io auf der Bahn', v: V_IO, t: n(V_IO, 1) },
      { l: 'Unterschied', v: V_FIELD - V_IO, t: n(V_FIELD - V_IO), hl: true },
    ] }],
    cap: `Eigene Rechnung aus Bahnradius, Umlaufzeit und Jupiters Drehung (9 h 55 min). Das Magnetfeld überholt Io mit rund ${n(V_FIELD - V_IO)} km/s; Io wirkt darin wie ein bewegter Leiter, und entlang der Feldlinien fließt Strom bis in Jupiters Polarlicht.`,
    s: ['nssdc-jovsat', 'nasa-jupiter-fs', 'bagenal-2020'],
  },

  'europa.jupiter': SKY('europa'),
  'europa.ocean': OCEANS('europa'),
  'europa.plume': {
    k: 'timeline', alt: 'Zeitleiste der Hinweise auf Wasserdampf-Fahnen über Europa von 1997 bis 2016',
    items: [
      { d: 1997.96, t: '1997', l: 'Galileo', l2: 'Spur im Magnetfeld' },
      { d: 2012.96, t: '2012', l: 'Hubble', l2: 'Wasserdampf am Südpol', hl: true },
      { d: 2014.1, t: '2014', l: 'Hubble', l2: 'Fahnen vor Jupiter' },
      { d: 2016.3, t: '2016', l: 'Keck-Teleskop', l2: 'nur 1 von 17 Nächten' },
    ],
    cap: 'Hinweise auf Wasserdampf über Europa: Magnetfeld-Daten der Sonde Galileo, Hubble-Aufnahmen im UV und vor Jupiters Scheibe, ein einzelner Nachweis mit dem Keck-Teleskop. Ob Europa regelmäßig Wasser ins All bläst, ist offen.',
    s: ['jia-2018', 'roth-2014', 'sparks-2016', 'paganini-2019'],
  },
  'europa.clipper': MISSIONS('clipper'),
  'europa.conamara': CHAOS,
  'europa.thera': CHAOS,
  'europa.agenor': LINES('agenor'),
  'europa.sidon': LINES('sidon'),
  'europa.minos': LINES('minos'),
  'europa.pwyll': RAYS('pwyll'),
  'europa.tyre': EUROPA_CRATERS('tyre'),
  'europa.callanish': EUROPA_CRATERS('callanish'),
  'europa.manannan': EUROPA_CRATERS('manannan'),

  'ganymede.galileo': {
    k: 'bars', alt: 'Durchmesser von Galileo Regio im Vergleich zu Ganymed, Merkur und dem Erdmond',
    groups: [{ t: 'Durchmesser', u: 'km', items: [
      { l: 'Ganymed', v: 2 * GALILEAN.ganymede.r }, { l: 'Merkur', v: 4879 },
      { l: 'Galileo Regio', v: 4439, hl: true }, { l: 'Mond (Erde)', v: 2 * MOON.r },
    ] }],
    cap: 'Galileo Regio, die größte dunkle Region Ganymeds, ist breiter als unser Mond und fast so groß wie Merkur. Dunkle Gebiete sind älter und dichter verkratert, helle jünger und von Furchen durchzogen.',
    s: ['usgs-gazetteer', 'nssdc-jovsat', 'nasa-planets', 'nasa-moon', 'nasa-ganymede'],
  },
  'ganymede.uruk': LINES('uruk'),
  'ganymede.osiris': RAYS('osiris'),
  'ganymede.field': {
    k: 'bars', alt: 'Stärke des Magnetfelds an der Oberfläche: Erde 25.000 bis 65.000 Nanotesla, Ganymed am Äquator 719 Nanotesla',
    groups: [{ t: 'Magnetfeld an der Oberfläche', u: 'nT', items: [
      { l: 'Erde, höchstens', v: 65000, t: '65.000' },
      { l: 'Erde, mindestens', v: 25000, t: '25.000' },
      { l: 'Ganymed, Äquator', v: 719, t: '719', hl: true },
    ] }],
    cap: `Ganymeds eigenes Feld (Dipol am Äquator, aus Galileo-Messungen) ist rund ${Math.round(25000 / 719)}-mal schwächer als das der Erde an ihrer schwächsten Stelle. Es reicht aber, um in Jupiters Magnetfeld eine kleine eigene Magnetosphäre freizuhalten – das hat kein anderer bekannter Mond.`,
    s: ['kivelson-2002', 'ncei-geomag', 'nasa-ganymede'],
  },
  'ganymede.aurora': {
    k: 'range', min: 0, max: 8, step: 2, u: '°', alt: 'Schaukeln der Polarlicht-Ovale von Ganymed: gemessen 2 Grad, ohne Ozean erwartet 6 Grad',
    span: [0, 2], spanL: 'mit Ozean',
    marks: [{ v: 2, t: '2°', l: 'gemessen (Hubble)' }, { v: 6, t: '6°', l: 'ohne Ozean (Modell)', ref: true }],
    cap: 'Ändert Jupiters Feld seine Richtung, kippen Ganymeds Polarlicht-Ovale hin und her. Ein leitender Salzwasser-Ozean bremst das: Ohne Ozean wären 6° zu erwarten, Hubble maß nur 2° – der bisher beste Beleg für den Ozean.',
    s: ['hst-ganymede-2015'],
  },
  'ganymede.ocean': OCEANS('ganymede'),
  'ganymede.juice': MISSIONS('juice'),
  'ganymede.jupiter': SKY('ganymede'),

  'callisto.valhalla': BASINS('valhalla'),
  'callisto.asgard': BASINS('asgard'),
  'callisto.burr': RAYS('burr'),
  'callisto.craters': {
    k: 'bars', alt: 'Rückstrahlvermögen der vier Galileischen Monde und des Erdmonds',
    groups: [{ t: 'Rückstrahlvermögen', u: 'Albedo', items: [
      ...IDS.map((id) => [id, { io: 0.62, europa: 0.68, ganymede: 0.44, callisto: 0.19 }[id]])
        .sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ l: NAME[id], v, t: n(v, 2), hl: id === 'callisto' })),
      { l: 'Mond (Erde)', v: 0.12, t: '0,12' },
    ] }],
    cap: 'Kallisto ist der dunkelste der vier großen Monde: eine dicht verkraterte, staubige Oberfläche. Helle Flecken sind jüngere Krater, die frisches Eis freigelegt haben. Unser Mond ist noch dunkler.',
    s: ['nssdc-jovsat', 'nasa-moon', 'nasa-callisto'],
  },
  'callisto.ocean': {
    k: 'bars', alt: 'Mittlere Dichte der Galileischen Monde, des Erdmonds und von Wasser',
    groups: [{ t: 'Mittlere Dichte', u: 'g/cm³', items: [
      { l: 'Io', v: 3.53 }, { l: 'Mond (Erde)', v: 3.344 }, { l: 'Europa', v: 3.01 },
      { l: 'Ganymed', v: 1.94 }, { l: 'Kallisto', v: 1.83, hl: true }, { l: 'Wasser', v: 1 },
    ].map((b) => ({ ...b, t: n(b.v, 2) })) }],
    cap: 'Je weiter draußen ein Galileischer Mond kreist, desto geringer seine Dichte und desto mehr Eis steckt in ihm. Kallisto ist kaum dichter als Ganymed; ein salziger Ozean in ihrem Inneren ist möglich, Lage und Dicke sind unsicher.',
    s: ['nssdc-jovsat', 'nasa-moon', 'nasa-callisto'],
  },
  'callisto.jupiter': SKY('callisto'),
};
