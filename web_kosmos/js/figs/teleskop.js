// Infografiken der Weltraumteleskope (01D Hubble, 01E JWST, 01F Euclid, 01G Roman). Werte: NASA Hubble by the Numbers
// und Missions to Hubble, NASA Webb Fact Sheet, STScI JWST Orbit, ESA Euclid, Euclid Consortium (Q2), NASA Roman Launch,
// Wikipedia (Euclid, Roman: Instrumente, Datenraten), NSSDCA (Erde, Mond); Winkelgrößen, Horizont, Erdschatten und
// Himmelsfläche als eigene Rechnung daraus.

const DEG = 180 / Math.PI;
const R_E = 6371, R_M = 1737.4, D_M = 384400, D_L2 = 1.5e6;     // km (NSSDCA; L2 rund 1,5 Mio. km)
const H_HST = 477, T_HST = 94.0;                                 // Bahnhöhe und Umlauf aus den CelesTrak-Bahnelementen
const disc = (r, d) => 2 * Math.asin(r / d) * DEG;
const horizon = (h) => Math.sqrt((R_E + h) ** 2 - R_E ** 2);
const dip = (h) => Math.acos(R_E / (R_E + h)) * DEG;

const MIRRORS = (on) => ({
  k: 'bars', alt: 'Durchmesser der Hauptspiegel: James Webb 6,5 m, Hubble und Roman je 2,4 m, Euclid 1,2 m',
  groups: [{ t: 'Hauptspiegel', u: 'm', items: [
    { l: 'James Webb', v: 6.5, t: '6,5', hl: on === 'jwst' },
    { l: 'Hubble', v: 2.4, t: '2,4', hl: on === 'hubble' },
    { l: 'Roman', v: 2.4, t: '2,4', hl: on === 'roman' },
    { l: 'Euclid', v: 1.2, t: '1,2', hl: on === 'euclid' },
  ] }],
  cap: 'Die Sammelfläche wächst mit dem Quadrat des Durchmessers: Webb sammelt gut fünfmal so viel Licht wie Hubble (eigene Rechnung, ohne Abschattung). Roman hat einen Spiegel wie Hubble, sieht aber ein viel größeres Feld auf einmal.',
  s: ['nasa-webb-facts', 'nasa-hubble-numbers', 'wiki-roman', 'esa-euclid'],
});

const SKY = (on) => ({
  k: 'bars', alt: 'Größe am Himmel: Vollmond von der Erde aus, Erde und Mond von L2 aus',
  groups: [{ t: 'Durchmesser am Himmel', u: 'Grad', items: [
    { l: 'Vollmond von der Erde', v: disc(R_M, D_M), t: '0,52' },
    { l: 'Erde von L2', v: disc(R_E, D_L2), t: '0,49', hl: on === 'earth' },
    { l: 'Mond von L2', v: disc(R_M, D_L2), t: '0,13', hl: on === 'moon' },
  ] }],
  cap: 'Eigene Rechnung aus den Radien und rund 1,5 Mio. km Abstand. Die Erde erscheint von L2 aus fast genau so groß wie der Vollmond von der Erde – meist als schmale Sichel neben der Sonne.',
  s: ['nasa-earth', 'nasa-moon'],
});

const DIST = (on) => ({
  k: 'bars', alt: 'Entfernung von der Erde: Mond, Lagrange-Punkt L2, größter Abstand von Webb',
  groups: [{ t: 'Entfernung von der Erde', u: 'Tsd. km', items: [
    { l: 'Mond (Mittel)', v: 384.4, t: '384' },
    { l: 'Lagrange-Punkt L2', v: 1500, t: '≈ 1.500', hl: on !== 'jwst' },
    ...(on === 'jwst' ? [{ l: 'Webb, höchstens', v: 1800, t: '1.800', hl: true }] : []),
  ] }],
  cap: 'L2 liegt rund viermal so weit weg wie der Mond, auf der Linie von der Sonne hinter der Erde. Dort ziehen Erde und Sonne zusammen so, dass ein Teleskop mit der Erde um die Sonne läuft – die Bahn darum ist aber instabil und braucht kleine Korrekturen.',
  s: on === 'jwst' ? ['nasa-moon', 'nasa-webb', 'stsci-jwst-orbit'] : ['nasa-moon', 'esa-euclid'],
});

const SENSORS = (on) => ({
  k: 'bars', alt: 'Bildpunkte der Kameras: Euclid VIS 600 Millionen, Roman WFI 300,8 Millionen, Euclid NISP 65 Millionen',
  groups: [{ t: 'Bildpunkte', u: 'Mio.', items: [
    { l: 'Euclid VIS', v: 600, hl: on === 'vis' },
    { l: 'Roman WFI', v: 300.8, t: '300,8', hl: on === 'wfi' },
    { l: 'Euclid NISP', v: 65, hl: on === 'nisp' },
  ] }],
  cap: 'VIS misst sichtbares Licht mit CCDs, WFI und NISP messen im nahen Infrarot mit Detektoren aus Quecksilber-Cadmium-Tellurid. Mehr Bildpunkte heißen hier vor allem: mehr Himmel auf einmal.',
  s: ['wiki-euclid', 'wiki-roman'],
});

const DATA = (on) => ({
  k: 'bars', alt: 'Datenrate zur Erde: Roman 290 Mbit/s, Euclid 55 Mbit/s, Hubble 1 Mbit/s',
  groups: [{ t: 'Datenrate zur Erde', u: 'Mbit/s', items: [
    { l: 'Roman (Ka-Band)', v: 290, hl: on === 'roman' },
    { l: 'Euclid', v: 55, hl: on === 'euclid' },
    { l: 'Hubble', v: 1, hl: on === 'hubble' },
  ] }],
  cap: 'Wissenschaftsdaten je Sekunde. Euclid sendet täglich rund vier Stunden, zusammen 850 Gigabit; Hubble im Mittel 150 Gigabit in der Woche.',
  s: ['wiki-roman', 'wiki-euclid', 'nasa-hubble-numbers'],
});

export default {
  // ---------- 01D Hubble ----------
  'hubble.mirror': MIRRORS('hubble'),
  'hubble.arrays': {
    k: 'bars', alt: 'Strom der Solarflügel von Hubble: über 5.200 W erzeugt, rund 2.100 W verbraucht',
    groups: [{ t: 'Leistung', u: 'W', items: [{ l: 'Solarflügel erzeugen', v: 5200, t: 'über 5.200' }, { l: 'Hubble braucht', v: 2100, t: '≈ 2.100', hl: true }] }],
    cap: 'Den Überschuss laden sechs Batterien mit über 500 Ah – sie tragen das Teleskop durch den Erdschatten. Die heutigen Flügel (seit 2002) sind ein Drittel kleiner als die vorigen und liefern 20 % mehr Strom.',
    s: ['nasa-hubble-numbers', 'esa-hubble-arrays', 'nasa-hubble-sm'],
  },
  'hubble.antennas': DATA('hubble'),
  'hubble.instruments': {
    k: 'bars', alt: 'Ergebnisse von Hubble: über 1,7 Millionen Beobachtungen und 23.000 Fachartikel',
    groups: [
      { t: 'Beobachtungen', u: 'Mio.', items: [{ l: 'seit 1990', v: 1.7, t: 'über 1,7', hl: true }] },
      { t: 'Fachartikel', u: 'Tsd.', items: [{ l: 'mit Hubble-Daten', v: 23, t: '23' }] },
    ],
    cap: 'Die Instrumente im Heck wurden bei den Wartungsmissionen getauscht und erneuert – darum arbeitet Hubble seit über 35 Jahren.',
    s: ['nasa-hubble-numbers', 'nasa-hubble'],
  },
  'hubble.service': {
    k: 'timeline', alt: 'Zeitleiste: Aussetzen 1990, fünf Wartungsmissionen 1993 bis 2009',
    items: [
      { d: '1990-04-25', t: 'Apr. 1990', l: 'Aussetzen', l2: 'Space Shuttle Discovery' },
      { d: '1993-12-02', t: 'Dez. 1993', l: 'SM1', l2: 'Korrektur des Spiegelfehlers' },
      { d: '1997-02-11', t: 'Feb. 1997', l: 'SM2', l2: 'zwei neue Instrumente' },
      { d: '1999-12-19', t: 'Dez. 1999', l: 'SM3A' },
      { d: '2002-03-01', t: 'März 2002', l: 'SM3B', l2: 'Solarflügel, Kamera ACS' },
      { d: '2009-05-11', t: 'Mai 2009', l: 'SM4', l2: 'letzte Wartung', hl: true },
    ],
    cap: 'Fünf Wartungsmissionen mit dem Space Shuttle, 32 Astronautinnen und Astronauten, 23 Tage Außeneinsätze mit zusammen 171 Stunden.',
    s: ['nasa-hubble-sm', 'nasa-hubble-numbers'],
  },
  'hubble.horizon': {
    k: 'bars', alt: 'Sichtweite bis zum Horizont und Neigung der Kimm aus Augenhöhe, Flugzeug und Hubble',
    groups: [
      { t: 'Blick bis zum Horizont', u: 'km', items: [
        { l: 'Augenhöhe 1,7 m', v: horizon(0.0017), t: '4,7' }, { l: 'Flugzeug 10 km', v: horizon(10) }, { l: 'Hubble ≈ 480 km', v: horizon(H_HST), hl: true },
      ] },
      { t: 'Horizont unter der Waagerechten', u: 'Grad', items: [
        { l: 'Augenhöhe 1,7 m', v: dip(0.0017), t: '0,04' }, { l: 'Flugzeug 10 km', v: dip(10) }, { l: 'Hubble ≈ 480 km', v: dip(H_HST), hl: true },
      ] },
    ],
    cap: 'Eigene Rechnung für eine Kugel mit 6.371 km Radius, ohne Lichtbrechung; Höhe aus den Bahnelementen.',
    s: ['nasa-earth', 'celestrak'],
  },
  'hubble.below': {
    k: 'polar', edge: 20, grid: [80, 60, 40], alt: 'Nordhalbkugel von oben: nördlich von 28,5° fliegt Hubble nie, nördlich von 51,6° die ISS nie',
    zones: [
      { lat: 28.5, t: 'nördl. 28,5°', l: 'Hubble nie', l2: 'auch Europa', hl: true },
      { lat: 51.6, t: 'nördl. 51,6°', l: 'ISS nie', l2: 'Norddeutschland' },
    ],
    cap: 'Nordhalbkugel von oben, Breitenkreise maßstäblich als Abstand vom Pol. Gefüllt: wohin das Teleskop nie hinwegzieht – seine Bahn reicht nur bis zur Breite ihrer Neigung.',
    s: ['celestrak'],
  },
  'hubble.sun': (() => {
    const n = (Math.asin(R_E / (R_E + H_HST)) / Math.PI) * T_HST, d = T_HST - n;
    return {
      k: 'layers', from: 'Sonnenaufgang', to: '94 min später', alt: `Ein Umlauf von Hubble maßstäblich: rund ${Math.round(d)} Minuten Sonne, ${Math.round(n)} Minuten Erdschatten`,
      items: [{ l: 'im Sonnenlicht', d, t: `${Math.round(d)} min` }, { l: 'im Erdschatten', d: n, t: `${Math.round(n)} min`, hl: true }],
      cap: 'Ein Umlauf maßstäblich bei Sonne in der Bahnebene, der längsten Nacht (eigene Rechnung aus Höhe und Umlaufzeit, Erdschatten als Zylinder). Rund 15 Sonnenaufgänge am Tag.',
      s: ['celestrak', 'nasa-earth'],
    };
  })(),

  // ---------- 01E James Webb ----------
  'jwst.mirror': MIRRORS('jwst'),
  'jwst.secondary': {
    k: 'timeline', alt: 'Zeitleiste: Start am 25.12.2021, Ankunft an L2 am 24.01.2022',
    items: [
      { d: '2021-12-25', t: '25.12.2021', l: 'Start', l2: 'Ariane 5 ECA' },
      { d: '2022-01-24', t: '24.01.2022', l: 'Ankunft an L2', hl: true },
    ],
    cap: 'Auf dem Weg nach L2 entfalteten sich Sonnenschild, Sekundärspiegel und die seitlichen Spiegelflügel – gefaltet passte Webb in die Spitze der Rakete.',
    s: ['nasa-webb', 'nasa-webb-facts'],
  },
  'jwst.isim': {
    k: 'bars', alt: 'Längste Wellenlänge der Instrumente: Webb 28,5 Mikrometer, Roman 2,3, Euclid 2,02',
    groups: [{ t: 'Längste Wellenlänge', u: 'µm', items: [
      { l: 'James Webb (MIRI)', v: 28.5, t: '28,5', hl: true }, { l: 'Roman', v: 2.3, t: '2,3' }, { l: 'Euclid (NISP)', v: 2.02, t: '2,02' },
    ] }],
    cap: 'Langwelliges Infrarot zeigt kühle Staubwolken und sehr ferne Galaxien, deren Licht durch die Ausdehnung des Alls gedehnt ist. Dafür muss das Teleskop selbst kalt sein: unter 50 K, MIRI unter 7 K.',
    s: ['nasa-webb-facts', 'wiki-roman', 'wiki-euclid'],
  },
  'jwst.shield': {
    k: 'bars', alt: 'Größte Abmessung: Sonnenschild von Webb 21,2 m, Hubble 13 m, Euclid 4,7 m',
    groups: [{ t: 'Größte Abmessung', u: 'm', items: [
      { l: 'Webb-Sonnenschild', v: 21.197, t: '21,2', hl: true }, { l: 'Hubble (Länge)', v: 13, t: '13' }, { l: 'Euclid (Höhe)', v: 4.7, t: '4,7' },
    ] }],
    cap: 'Der Schild misst 21,2 × 14,2 m und besteht aus fünf Lagen Kapton E; für den Start war er gefaltet.',
    s: ['nasa-webb-facts', 'nasa-hubble-numbers', 'esa-euclid'],
  },
  'jwst.layers': {
    k: 'bars', alt: 'Temperaturen am Sonnenschild: Lage zur Sonne bis 383 K, oberste Lage 36 K, MIRI unter 7 K',
    groups: [{ t: 'Temperatur', u: 'K', items: [
      { l: 'Lage 1 zur Sonne', v: 383 }, { l: 'Lage 5, kalte Seite', v: 36, hl: true }, { l: 'MIRI', v: 7, t: 'unter 7' },
    ] }],
    cap: 'Zwischen Lage 1 und Lage 5 fallen über 340 K ab (eigene Rechnung): Die Wärme entweicht zwischen den Lagen seitlich. 383 K sind 110 °C, 36 K sind −237 °C.',
    s: ['nasa-webb-facts'],
  },
  'jwst.earth': SKY('earth'),
  'jwst.moon': SKY('moon'),
  'jwst.halo': DIST('jwst'),

  // ---------- 01F Euclid ----------
  'euclid.telescope': MIRRORS('euclid'),
  'euclid.vis': SENSORS('vis'),
  'euclid.nisp': SENSORS('nisp'),
  'euclid.svm': {
    k: 'bars', alt: 'Masse von Euclid: Versorgungsmodul 850 kg, Nutzlastmodul 800 kg, Treibstoff 210 kg, Ausgleich 40 kg',
    groups: [{ t: 'Masse im Orbit', u: 'kg', items: [
      { l: 'Versorgungsmodul', v: 850, hl: true }, { l: 'Nutzlastmodul', v: 800 }, { l: 'Treibstoff', v: 210 }, { l: 'Ausgleichsmasse', v: 40 },
    ] }],
    cap: 'Zusammen rund 2 t. Das Kaltgas für die feinen Schwenks bestimmt, wie lange Euclid über die geplanten sechs Jahre hinaus arbeiten kann.',
    s: ['esa-euclid'],
  },
  'euclid.survey': {
    k: 'bars', alt: 'Himmelsfläche: ganzer Himmel 41.253 Quadratgrad, weite Durchmusterung 15.000, tiefe Felder 50',
    groups: [{ t: 'Fläche am Himmel', u: 'Quadratgrad', items: [
      { l: 'ganzer Himmel', v: 41253, t: '41.253' }, { l: 'weite Durchmusterung', v: 15000, t: '≈ 15.000', hl: true }, { l: 'drei tiefe Felder', v: 50 },
    ] }],
    cap: 'Ganzer Himmel als eigene Rechnung (4π im Bogenmaß). Die Milchstraße und die Ekliptik mit ihrem Staub bleiben ausgespart – darum reicht ein gutes Drittel.',
    s: ['wiki-euclid', 'esa-euclid'],
  },
  'euclid.data': {
    k: 'timeline', alt: 'Zeitleiste Euclid: Start Juli 2023, Durchmusterung ab Februar 2024, Daten Q1 März 2025 und Q2 Juni 2026',
    items: [
      { d: '2023-07-01', t: 'Juli 2023', l: 'Start', l2: 'Falcon 9' },
      { d: '2024-02-14', t: 'Feb. 2024', l: 'Durchmusterung', l2: 'beginnt' },
      { d: '2025-03-19', t: 'März 2025', l: 'Daten Q1', l2: 'drei tiefe Felder' },
      { d: '2026-06-24', t: 'Juni 2026', l: 'Daten Q2', l2: 'Bulge der Milchstraße', hl: true },
    ],
    cap: 'Schnelldaten (Q) zeigen ausgewählte Felder vorab; die großen Datenfreigaben der Durchmusterung folgen in mehreren Stufen.',
    s: ['esa-euclid', 'wiki-euclid', 'euclid-q2'],
  },
  'euclid.earth': SKY('earth'),
  'euclid.moon': SKY('moon'),
  'euclid.halo': DIST('euclid'),

  // ---------- 01G Roman ----------
  'roman.telescope': MIRRORS('roman'),
  'roman.wfi': SENSORS('wfi'),
  'roman.hga': DATA('roman'),
  'roman.trip': {
    k: 'timeline', alt: 'Zeitleiste Roman: Start 30.08.2026, Koronograph an 01.09., erstes Testbild 15.09., Instrument scharf 14.10.2026',
    items: [
      { d: '2026-08-30', t: '30.08.2026', l: 'Start', l2: 'Falcon Heavy' },
      { d: '2026-09-01', t: '01.09.2026', l: 'Deckel, Antenne', l2: 'Koronograph an' },
      { d: '2026-09-15', t: '15.09.2026', l: 'erstes Testbild', l2: 'Weitwinkel-Instrument' },
      { d: '2026-10-14', t: '14.10.2026', l: 'scharfgestellt', l2: '63 nm statt 90 nm', hl: true },
    ],
    cap: 'Inbetriebnahme auf dem Weg nach L2; die Ankunft in der Bahn um L2 wird nach rund 100 Tagen erwartet, also Anfang Dezember 2026.',
    s: ['nasa-roman-launch', 'wiki-roman'],
  },
  'roman.earth': SKY('earth'),
  'roman.moon': SKY('moon'),
};
