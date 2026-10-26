// Infografiken Ast Erde nah (01A ISS, 01B Tiangong, 1 Erde & Mond, 01C Mond). Werte: NASA ISS Facts, ESA Cupola,
// DLR-Moduldaten, NSSDCA-Faktenblätter (Erde, Mond, Sonne, Mars), Space.com/SpaceChina/Global Times (Tiangong),
// Falchi et al. 2016 (Lichtverschmutzung), Murphy 2013 (Laserreflektoren), NASA SVS/LOLA; Horizont, Erdschatten,
// Schattenlängen, Winkelgrößen und Erde am Mondhimmel als eigene Rechnung daraus.

const DEG = 180 / Math.PI, RAD = Math.PI / 180, AU = 149597870.7, C = 299792.458;
const R_E = 6371, R_M = 1737.4, R_S = 695700, D_M = 384400;   // km, NSSDCA (mittlere Radien, große Halbachse Mond)
const disc = (r, d) => 2 * Math.asin(r / d) * DEG;              // Winkeldurchmesser in Grad
const deg = (v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: v < 1 ? 2 : 1 })}°`;
const de0 = (v) => Math.round(v).toLocaleString('de-DE');
const mins = (s) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;

// Stationen: Höhe aus den Bahnelementen (content.js), Umlauf ISS 93 min, Tiangong 92,2 min
const ST = { iss: { l: 'ISS', h: 420, T: 93 }, tiangong: { l: 'Tiangong', h: 384, T: 92.2 } };
const horizon = (h) => Math.sqrt((R_E + h) ** 2 - R_E ** 2);      // km bis zum Horizont (Kugel, ohne Lichtbrechung)
const dip = (h) => Math.acos(R_E / (R_E + h)) * DEG;              // Horizont unter der Waagerechten
// Längste Nacht je Umlauf: Sonne in der Bahnebene, Erdschatten als Zylinder → Anteil asin(R/r)/π
const night = (s) => (Math.asin(R_E / (R_E + s.h)) / Math.PI) * s.T;

const HORIZON = (on) => ({
  k: 'bars', alt: 'Sichtweite bis zum Horizont und Neigung der Kimm aus Augenhöhe, Flughöhe, Tiangong und ISS',
  groups: [
    { t: 'Blick bis zum Horizont', u: 'km', items: [
      { l: 'Augenhöhe 1,7 m', v: horizon(0.0017), t: '4,7' },
      { l: 'Flugzeug 10 km', v: horizon(10) },
      { l: 'Tiangong 384 km', v: horizon(384), hl: on === 'tiangong' },
      { l: 'ISS 420 km', v: horizon(420), hl: on === 'iss' },
    ] },
    { t: 'Horizont unter der Waagerechten', u: 'Grad', items: [
      { l: 'Augenhöhe 1,7 m', v: dip(0.0017), t: '0,04' },
      { l: 'Flugzeug 10 km', v: dip(10) },
      { l: 'Tiangong 384 km', v: dip(384), hl: on === 'tiangong' },
      { l: 'ISS 420 km', v: dip(420), hl: on === 'iss' },
    ] },
  ],
  cap: `Eigene Rechnung für eine Kugel mit ${de0(R_E)} km Radius, ohne Lichtbrechung. Aus der Station reicht der Blick rund 500-mal so weit wie aus Augenhöhe, und die Kimm liegt fast 20° tiefer als die Waagerechte.`,
  s: ['nasa-earth', 'nasa-iss', 'celestrak'],
});

const SUNFIG = (id) => {
  const s = ST[id], n = night(s), d = s.T - n;
  return {
    k: 'layers', from: 'Sonnenaufgang', to: `${s.T.toLocaleString('de-DE')} min später`,
    alt: `Ein Umlauf der ${s.l} maßstäblich: rund ${Math.round(d)} Minuten Sonne, ${Math.round(n)} Minuten Erdschatten`,
    items: [
      { l: 'im Sonnenlicht', d, t: `${Math.round(d)} min` },
      { l: 'im Erdschatten', d: n, t: `${Math.round(n)} min`, hl: true },
    ],
    cap: id === 'iss'
      ? 'Ein Umlauf maßstäblich bei Sonne in der Bahnebene, der längsten Nacht (eigene Rechnung aus Höhe und Umlaufzeit, Erdschatten als Zylinder). Steht die Sonne seitlich zur Bahn, wird die Nacht kürzer; einige Tage im Jahr fällt sie ganz aus. 16 Sonnenaufgänge am Tag.'
      : 'Ein Umlauf maßstäblich bei Sonne in der Bahnebene, der längsten Nacht (eigene Rechnung aus Höhe und Umlaufzeit, Erdschatten als Zylinder). Steht die Sonne seitlich zur Bahn, wird die Nacht kürzer – ganz ausfallen kann sie bei 41,5° Bahnneigung nicht. Gut 15 Sonnenaufgänge am Tag.',
    s: id === 'iss' ? ['nasa-iss', 'celestrak', 'nasa-earth'] : ['celestrak', 'nasa-earth'],
  };
};

const ARRAYS = (on) => ({
  k: 'bars', alt: 'Spannweite der Solarflügel von ISS und Tiangong im Vergleich zum Airbus A380',
  groups: [{ t: 'Spannweite von Spitze zu Spitze', u: 'm', items: [
    { l: 'ISS-Solarflügel', v: 109, hl: on === 'iss' },
    { l: 'Airbus A380', v: 80 },
    { l: 'Tiangong', v: 55, t: 'über 55', hl: on === 'tiangong' },
  ] }],
  cap: on === 'iss'
    ? 'Acht Flügel, je 34 × 12 m, liefern zusammen 75 bis 90 kW. Von Spitze zu Spitze messen sie mehr als die Flügel des größten Passagierflugzeugs.'
    : 'Wentians zwei Flügel, je knapp 30 m lang und rund 110 m² groß, spannen über 55 m – gut halb so weit wie die Solarflügel der ISS.',
  s: ['nasa-iss', 'space-wentian-arrays'],
});

const MODULES = (on) => ({
  k: 'bars', alt: 'Länge und Startmasse der drei Module von Tiangong: Wentian, Mengtian, Tianhe',
  groups: [
    { t: 'Länge', u: 'm', items: [
      { l: 'Wentian', v: 17.9, hl: on === 'wentian' }, { l: 'Mengtian', v: 17.9, hl: on === 'mengtian' }, { l: 'Tianhe', v: 16.6 },
    ] },
    { t: 'Masse beim Start', u: 't', items: [
      { l: 'Wentian', v: 23, hl: on === 'wentian' }, { l: 'Mengtian', v: 22, t: '≈ 22', hl: on === 'mengtian' }, { l: 'Tianhe', v: 22, t: '≈ 22' },
    ] },
  ],
  cap: 'Die beiden Labore sind etwas länger als das Kernmodul Tianhe; quer an dessen Knoten bilden sie das T der Station. Wentian ist 4,2 m dick.',
  s: ['spacechina-wentian', 'space-mengtian', 'space-tiangong'],
});

// Bemannte Landungen (NSSDCA, Landedatum UT)
const LANDINGS = (on) => ({
  k: 'timeline', alt: 'Zeitleiste der sechs bemannten Mondlandungen von Juli 1969 bis Dezember 1972',
  items: [
    { d: '1969-07-20', t: 'Juli 1969', l: 'Apollo 11', l2: 'Meer der Ruhe', hl: on === 'apollo11' },
    { d: '1969-11-19', t: 'Nov. 1969', l: 'Apollo 12', l2: 'Ozean der Stürme', hl: on === 'apollo12' },
    { d: '1971-02-05', t: 'Feb. 1971', l: 'Apollo 14', l2: 'Fra Mauro' },
    { d: '1971-07-30', t: 'Juli 1971', l: 'Apollo 15', l2: 'Hadley-Rille' },
    { d: '1972-04-21', t: 'Apr. 1972', l: 'Apollo 16', l2: 'Descartes' },
    { d: '1972-12-11', t: 'Dez. 1972', l: 'Apollo 17', l2: 'Taurus-Littrow', hl: on === 'apollo17' },
  ],
  cap: on === 'apollo12'
    ? 'Die sechs bemannten Landungen in dreieinhalb Jahren. Apollo 12 folgte nur vier Monate auf Apollo 11.'
    : 'Die sechs bemannten Landungen in dreieinhalb Jahren. Apollo 17 im Dezember 1972 war die bislang letzte.',
  s: ['nssdc-apollo'],
});

// Erde am Himmel der Landestellen: mittlere Lage ohne Libration, Erde steht über 0° Breite, 0° Länge
const SITES = { apollo11: [0.67416, 23.47314], apollo12: [-3.0128, -23.4219], apollo15: [26.13239, 3.6333], apollo17: [20.1911, 30.7723] };
const earthUp = ([la, lo]) => 90 - Math.acos(Math.cos(la * RAD) * Math.cos(lo * RAD)) * DEG;
const EARTH_UP = (on) => ({
  k: 'bars', alt: 'Höhe der Erde über dem Horizont an vier Apollo-Landestellen',
  groups: [{ t: 'Erde über dem Horizont', u: 'Grad', items: Object.entries(SITES).map(([id, p]) => (
    { l: `Apollo ${id.slice(6)}`, v: earthUp(p), hl: on === id })) }],
  cap: on === 'apollo11'
    ? 'Vom Landeplatz von Apollo 11 im Meer der Ruhe steht die Erde 66° hoch im Westen – und bleibt dort, Tag und Nacht (eigene Rechnung aus den Landekoordinaten, mittlere Lage; die Libration lässt sie um einige Grad pendeln).'
    : 'Apollo 12 landete im Ozean der Stürme, westlich der Mitte: Dort steht die Erde 66° hoch im Osten und wandert nicht über den Himmel (eigene Rechnung aus den Landekoordinaten, mittlere Lage; die Libration lässt sie um einige Grad pendeln).',
  s: ['nssdc-apollo-sites'],
});

// Erdschatten und Mondschatten (Kegel aus den Radien bei 1 AE)
const umbra = (r) => (AU * r) / (R_S - r);
const L_E = umbra(R_E), L_M = umbra(R_M), W_E = 2 * R_E * (1 - D_M / L_E);

// Würfelecken der Laserreflektoren (Murphy 2013)
const REFL = [['Apollo 11', 100], ['Apollo 14', 100], ['Apollo 15', 300], ['Lunochod 1', 14], ['Lunochod 2', 14]];

const shadow = (e) => 1 / Math.tan(e * RAD);   // Schatten einer 1 km hohen Wand in km

export default {
  // ---------- 01A ISS ----------
  'iss.cupola': {
    k: 'bars', alt: 'Cupola: Durchmesser 2,96 m, Höhe 1,5 m, rundes Fenster 80 cm; Masse beim Start und im Orbit',
    groups: [
      { t: 'Kuppel und Fenster', u: 'm', items: [
        { l: 'Durchmesser', v: 2.955, t: '2,96' }, { l: 'Höhe', v: 1.5, t: '1,5' }, { l: 'rundes Fenster', v: 0.8, t: '0,8', hl: true },
      ] },
      { t: 'Masse', u: 'kg', items: [{ l: 'beim Start', v: 1805 }, { l: 'im Orbit', v: 1880 }] },
    ],
    cap: 'Durchmesser mit geschlossenen Fensterläden. Sechs Seitenfenster und das runde Fenster oben, das größte, das je im All flog; jedes Fenster hat zwei 25 mm dicke Druckscheiben.',
    s: ['esa-cupola'],
  },
  'iss.labs': {
    k: 'bars', alt: 'Länge der Labore Kibo, Destiny und Columbus; Volumen der Station unter Druck und Wohnraum',
    groups: [
      { t: 'Länge der Labore', u: 'm', items: [
        { l: 'Kibo (JAXA)', v: 11.2 }, { l: 'Destiny (NASA)', v: 8.53, t: '8,5' }, { l: 'Columbus (ESA)', v: 6.87, t: '6,9' },
      ] },
      { t: 'Volumen der Station', u: 'm³', items: [{ l: 'unter Druck', v: 1005 }, { l: 'Wohnraum', v: 388, hl: true }] },
    ],
    cap: 'Kibo ist das längste der drei Labore im vorderen Teil. Von 1.005 m³ unter Druck sind 388 m³ Wohnraum – mehr als in einem Haus mit sechs Schlafzimmern.',
    s: ['dlr-iss', 'nasa-iss'],
  },
  'iss.truss': {
    k: 'bars', alt: 'Längen im Vergleich: Solarflügel 109 m, Football-Feld 109,7 m, Gitterträger 94 m, Druckmodule 67 m',
    groups: [{ t: 'Länge', u: 'm', items: [
      { l: 'Flügelspannweite', v: 109 },
      { l: 'Football-Feld', v: 109.7, t: '109,7' },
      { l: 'Gitterträger', v: 94, hl: true },
      { l: 'Druckmodule', v: 67 },
    ] }],
    cap: 'Football-Feld mit Endzonen: 120 Yards (eigene Umrechnung) – NASA vergleicht die Station damit. Der Träger liegt quer zur Flugrichtung, die Druckmodule reihen sich entlang der Flugrichtung.',
    s: ['nasa-iss'],
  },
  'iss.arrays': ARRAYS('iss'),
  'iss.irosa': {
    k: 'bars', alt: 'Fläche eines alten Solarflügels und eines iROSA-Flügels, Zahl der Flügel',
    groups: [
      { t: 'Fläche je Flügel (Umriss)', u: 'm²', items: [
        { l: 'alter Flügel', v: 34 * 12, t: '≈ 408' }, { l: 'iROSA', v: 18.2 * 6, t: '≈ 109', hl: true },
      ] },
      { t: 'Flügel', u: 'Anzahl', items: [{ l: 'alte Flügel', v: 8 }, { l: 'iROSA montiert', v: 6, hl: true }] },
    ],
    cap: 'Fläche als Umriss aus den NASA-Maßen 34 × 12 m und 18,2 × 6 m (eigene Rechnung). Die sechs iROSA kamen 2021–2023 schräg vor alte Flügel; im August 2026 wurde ein Platz für ein weiteres vorbereitet.',
    s: ['nasa-irosa-2023', 'nasa-irosa-2026', 'nasa-iss'],
  },
  'iss.radiators': {
    k: 'layers', from: 'Abwärme der Geräte', to: 'ins All', alt: 'Schema: Wärmeweg von den Modulen über Wasser und Ammoniak zu den Radiatoren',
    items: [
      { l: 'in den Modulen', d: 1, t: 'Wasser' },
      { l: 'Leitungen außen', d: 1, t: 'Ammoniak' },
      { l: 'Radiatoren', d: 1, t: 'Infrarot', hl: true },
    ],
    cap: 'Schema, nicht maßstäblich: Innen nimmt ein Wasserkreislauf die Wärme auf, Wärmetauscher geben sie an Ammoniak in Leitungen außen ab, die Radiatoren strahlen sie ab – drei an jeder Seite des Trägers. Fast der ganze Strom der Solarflügel (75–90 kW) endet als Wärme.',
    s: ['nasa-eatcs', 'nasa-iss'],
  },
  'iss.russian': {
    k: 'timeline', alt: 'Zeitleiste: Sarja 1998, Swesda Juli 2000, erste Besatzung November 2000, Nauka 2021',
    items: [
      { d: '1998-11-20', t: 'Nov. 1998', l: 'Sarja', l2: 'erstes Modul der ISS' },
      { d: '2000-07-12', t: 'Juli 2000', l: 'Swesda', l2: 'Wohnmodul' },
      { d: '2000-11-02', t: 'Nov. 2000', l: 'Besatzung', l2: 'seitdem bewohnt', hl: true },
      { d: '2021-07-21', t: 'Juli 2021', l: 'Nauka', l2: 'Labor mit Arm ERA' },
    ],
    cap: 'Starts der großen russischen Module (DLR). Mit Sarja begann 1998 der Aufbau der Station; seit November 2000 ist sie ununterbrochen bewohnt.',
    s: ['dlr-iss', 'nasa-iss'],
  },
  'iss.horizon': HORIZON('iss'),
  'iss.sun': SUNFIG('iss'),

  // ---------- 01B Tiangong ----------
  'tiangong.core': {
    k: 'bars', alt: 'Masse von Tianhe im Vergleich zu Sarja und Swesda; ganze Stationen ISS und Tiangong',
    groups: [
      { t: 'Masse beim Start', u: 't', items: [
        { l: 'Tianhe', v: 22, t: '≈ 22', hl: true }, { l: 'Sarja (ISS)', v: 19.323, t: '19,3' }, { l: 'Swesda (ISS)', v: 19.05, t: '19,1' },
      ] },
      { t: 'Ganze Station', u: 't', items: [{ l: 'ISS', v: 420 }, { l: 'Tiangong', v: 90, t: '≈ 90', hl: true }] },
    ],
    cap: 'Tianhe ist etwas schwerer als die russischen Grundmodule der ISS. Die ganze Tiangong wiegt ein Fünftel der ISS.',
    s: ['space-tiangong', 'dlr-iss', 'nasa-iss'],
  },
  'tiangong.hub': {
    k: 'timeline', alt: 'Zeitleiste des Aufbaus von Tiangong: April 2021 bis November 2022',
    items: [
      { d: '2021-04-29', t: 'Apr. 2021', l: 'Tianhe', l2: 'Kernmodul mit Knoten' },
      { d: '2021-06-17', t: 'Juni 2021', l: 'Shenzhou 12', l2: 'erste Besatzung' },
      { d: '2022-07-24', t: 'Juli 2022', l: 'Wentian', l2: 'Labor am Knoten' },
      { d: '2022-10-31', t: 'Okt. 2022', l: 'Mengtian', l2: 'Labor am Knoten' },
      { d: '2022-11-05', t: 'Nov. 2022', l: 'T-Form', l2: 'komplett', hl: true },
    ],
    cap: 'Aufbau in anderthalb Jahren: erst das Kernmodul mit dem Andockknoten, dann die beiden Labore, die seitlich daran festmachen. Am Knoten legen auch Shenzhou und Tianzhou an.',
    s: ['space-tiangong', 'globaltimes-wentian', 'space-mengtian'],
  },
  'tiangong.wentian': MODULES('wentian'),
  'tiangong.mengtian': MODULES('mengtian'),
  'tiangong.arrays': ARRAYS('tiangong'),
  'tiangong.arm': {
    k: 'bars', alt: 'Länge der Roboterarme: Canadarm2 der ISS, großer und kleiner Arm von Tiangong',
    groups: [{ t: 'Länge', u: 'm', items: [
      { l: 'Canadarm2 (ISS)', v: 17.6 }, { l: 'großer Arm', v: 10, t: '≈ 10', hl: true }, { l: 'kleiner Arm', v: 5 },
    ] }],
    cap: 'Canadarm2 nach DLR. Der kleine Arm an Wentians Schleuse misst 5 m und ist halb so lang wie der große auf dem Kernmodul – der kommt damit auf rund 10 m (eigene Rechnung).',
    s: ['dlr-iss', 'globaltimes-wentian'],
  },
  'tiangong.horizon': HORIZON('tiangong'),
  'tiangong.below': {
    k: 'polar', edge: 30, grid: [80, 60, 40], alt: 'Nordhalbkugel von oben: nördlich von 41,5° fliegt Tiangong nie, nördlich von 51,6° die ISS nie',
    zones: [
      { lat: 41.5, t: 'nördl. 41,5°', l: 'Tiangong nie', l2: 'auch Deutschland', hl: true },
      { lat: 51.6, t: 'nördl. 51,6°', l: 'ISS nie', l2: 'Norddeutschland' },
    ],
    cap: 'Nordhalbkugel von oben, Breitenkreise maßstäblich als Abstand vom Pol. Gefüllt: wohin die Station nie hinwegzieht – ihre Bahn reicht nur bis zur Breite ihrer Neigung.',
    s: ['celestrak', 'nasa-iss'],
  },
  'tiangong.sun': SUNFIG('tiangong'),

  // ---------- 1 Erde & Mond ----------
  'earth.night': {
    k: 'bars', alt: 'Anteil der Menschen unter lichtverschmutztem Himmel und ohne sichtbare Milchstraße: Welt, Europa, Nordamerika',
    groups: [
      { t: 'Himmel lichtverschmutzt', u: '%', items: [
        { l: 'Welt', v: 80, t: 'über 80' }, { l: 'Europa', v: 99, t: 'über 99', hl: true }, { l: 'USA', v: 99, t: 'über 99' },
      ] },
      { t: 'Milchstraße unsichtbar', u: '%', items: [
        { l: 'Welt', v: 33.3, t: 'über 33' }, { l: 'Europa', v: 60, hl: true }, { l: 'Nordamerika', v: 80, t: 'fast 80' },
      ] },
    ],
    cap: 'Anteil der Menschen (Weltatlas der künstlichen Himmelshelligkeit). Das Licht der Städte auf der Nachtseite hellt den Himmel weit über die Städte hinaus auf.',
    s: ['falchi-2016'],
  },
  'earth.sun': {
    k: 'range', min: 146.5, max: 153, step: 1, u: 'Mio. km', alt: 'Abstand Erde–Sonne im Jahreslauf: 147,1 bis 152,1 Millionen km, Lichtlaufzeit 8 min 11 s bis 8 min 27 s',
    span: [147.095, 152.1], spanL: 'Abstand übers Jahr',
    marks: [
      { v: 147.095, t: mins(147.095e6 / C), l: 'Perihel · Januar' },
      { v: AU / 1e6, t: mins(AU / C), l: '1 AE', ref: true },
      { v: 152.1, t: mins(152.1e6 / C), l: 'Aphel · Juli' },
    ],
    cap: 'Die Erde läuft auf einer leichten Ellipse und ist der Sonne Anfang Januar am nächsten. Über den Marken: Lichtlaufzeit (eigene Rechnung aus den Abständen).',
    s: ['nasa-earth', 'iau-2012'],
  },
  'earth.umbra': {
    k: 'bars', alt: 'Länge der Kernschatten von Erde und Mond, Abstand Mond–Erdoberfläche; Breite des Erdschattens am Mondort',
    groups: [
      { t: 'Länge', u: 'tausend km', items: [
        { l: 'Erdschatten', v: L_E / 1e3, hl: true },
        { l: 'Mond–Erdboden', v: (D_M - R_E) / 1e3 },
        { l: 'Mondschatten', v: L_M / 1e3 },
      ] },
      { t: 'Breite am Mondort', u: 'km', items: [{ l: 'Erdschatten', v: W_E, hl: true }, { l: 'Mond', v: 2 * R_M }] },
    ],
    cap: `Eigene Rechnung aus den Radien von Sonne, Erde und Mond bei 1 AE. In Mondentfernung ist der Kernschatten der Erde noch ${(W_E / (2 * R_M)).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Monddurchmesser breit; der Schatten des Mondes endet im Mittel knapp vor dem Erdboden.`,
    s: ['nasa-sun', 'nasa-earth', 'nasa-moon'],
  },

  // ---------- 01C Mond ----------
  'moon.earth': {
    k: 'scale', h: 120, alt: 'Erde am Mondhimmel im Vergleich zu Sonne und Vollmond, Winkelgröße maßstäblich',
    items: [
      { l: 'Erde vom Mond', a: disc(R_E, D_M), t: deg(disc(R_E, D_M)), hl: true },
      { l: 'Sonne vom Mond', a: disc(R_S, AU), t: deg(disc(R_S, AU)) },
      { l: 'Vollmond (Erde)', a: disc(R_M, D_M), t: deg(disc(R_M, D_M)) },
    ],
    cap: 'Winkelgröße maßstäblich (eigene Rechnung aus Radien und Abständen). Die Erde erscheint vom Mond knapp viermal so groß wie bei uns der Vollmond.',
    s: ['nasa-earth', 'nasa-moon', 'nasa-sun'],
  },
  'moon.apollo11': {
    k: 'bars', alt: 'Zahl der Würfelecken in den fünf Laserreflektoren auf dem Mond',
    groups: [{ t: 'Würfelecken je Reflektor', u: 'Anzahl', items: REFL.map(([l, v]) => ({ l, v, hl: l === 'Apollo 11' })) }],
    cap: 'Die Apollo-Reflektoren bestehen aus Quarzglas-Würfelecken von 3,8 cm, die beiden Lunochod-Spiegel aus größeren mit 11 cm Kantenlänge. Aus der Laufzeit der Laserpulse folgt: Der Mond entfernt sich um 3,8 cm pro Jahr.',
    s: ['murphy-2013', 'llr'],
  },
  'moon.apollo12': LANDINGS('apollo12'),
  'moon.apollo15': {
    k: 'bars', alt: 'Breite der Landestellen von Apollo 15, 17, 12 und 11',
    groups: [{ t: 'Abstand vom Äquator', u: 'Grad', items: [
      { l: 'Apollo 15', v: SITES.apollo15[0], t: '26,1 N', hl: true },
      { l: 'Apollo 17', v: SITES.apollo17[0], t: '20,2 N' },
      { l: 'Apollo 12', v: -SITES.apollo12[0], t: '3,0 S' },
      { l: 'Apollo 11', v: SITES.apollo11[0], t: '0,7 N' },
    ] }],
    cap: 'Breite der Landestellen nach LRO-Koordinaten. Apollo 15 setzte am weitesten nördlich auf, 26° vom Äquator, zwischen den Bergen der Apenninen am Rand des Mare Imbrium.',
    s: ['nssdc-apollo-sites'],
  },
  'moon.apollo17': LANDINGS('apollo17'),
  'moon.tycho': {
    k: 'scale', alt: 'Krater Tycho maßstäblich auf der Mondscheibe',
    items: [{ l: 'Mond', a: 2 * R_M, c: 85, cl: 'Tycho 85 km', t: `Ø ${de0(2 * R_M)} km` }],
    cap: 'Größe maßstäblich, Lage schematisch: Tycho misst ein Vierzigstel des Monddurchmessers und ist von der Erde aus kaum ein Punkt – seine hellen Strahlen fallen bei Vollmond dennoch über große Teile der Vorderseite auf.',
    s: ['usgs-tycho', 'nasa-moon'],
  },
  'moon.copernicus': {
    k: 'bars', alt: 'Schattenlänge einer 1 km hohen Kraterwand bei Sonnenhöhe 5, 10, 20 und 45 Grad',
    groups: [{ t: 'Schatten einer 1 km hohen Wand', u: 'km', items: [5, 10, 20, 45].map((e) => (
      { l: `Sonne ${e}° hoch`, v: shadow(e), hl: e === 5 })) }],
    cap: 'Eigene Rechnung: Schattenlänge = Höhe ÷ tan(Sonnenhöhe). Nahe der Schattengrenze steht die Sonne tief, Wände und Zentralberge werfen elfmal längere Schatten als bei 45° – das Relief tritt hervor.',
    s: ['nasa-moon-phases'],
  },
  'moon.imbrium': {
    k: 'range', min: 1, max: 4.5, step: 0.5, u: 'Mrd. Jahre', alt: 'Alter der Lava in den Mondmeeren: 4,2 bis 1,2 Milliarden Jahre',
    span: [1.2, 4.2], spanL: 'Lava in den Maria',
    marks: [{ v: 4.2, t: '4,2', l: 'älteste Lava' }, { v: 1.2, t: '1,2', l: 'jüngste Lava' }],
    cap: 'Die dunklen Maria entstanden, als Lava die großen Einschlagbecken füllte – über drei Milliarden Jahre hinweg. Das Imbrium-Becken selbst ist älter als seine Lava, die hellen Hochländer sind noch älter.',
    s: ['nasa-moon-facts'],
  },
  'moon.tranquillitatis': EARTH_UP('apollo11'),
  'moon.procellarum': EARTH_UP('apollo12'),
  'moon.crisium': {
    k: 'bars', alt: 'Anteile der Mondoberfläche: 41 Prozent immer sichtbar, 18 Prozent durch Libration, 41 Prozent nie',
    groups: [{ t: 'Mondoberfläche von der Erde', u: '%', items: [
      { l: 'immer sichtbar', v: 41 }, { l: 'durch Libration', v: 18, hl: true }, { l: 'nie sichtbar', v: 41 },
    ] }],
    cap: 'Durch die Libration sieht man von der Erde im Lauf eines Umlaufs 59 % der Mondoberfläche statt der Hälfte; die Aufteilung folgt daraus (eigene Rechnung). Mare Crisium liegt nahe dem Ostrand und rückt mal näher an den Rand, mal weiter ins Bild.',
    s: ['svs-moon-wobble', 'svs-libration'],
  },
  'moon.southpole': {
    k: 'bars', alt: 'Höchster Sonnenstand am Pol: Mond 1,5 Grad, Erde 23,4 Grad, Mars 25,2 Grad',
    groups: [{ t: 'Höchster Sonnenstand am Pol', u: 'Grad', items: [
      { l: 'Mond', v: 1.5, hl: true }, { l: 'Erde', v: 23.44, t: '23,4' }, { l: 'Mars', v: 25.19, t: '25,2' },
    ] }],
    cap: 'Am Pol steht die Sonne nie höher, als die Drehachse gegen die Bahn um die Sonne geneigt ist (eigene Rechnung). Auf dem Mond sind das 1,5°: Schon niedrige Kraterwände werfen Dauerschatten, in denen Wassereis überdauert.',
    s: ['nasa-moon-facts', 'nasa-earth', 'nssdc-mars'],
  },
  'moon.aitken': {
    k: 'scale', alt: 'Südpol-Aitken-Becken maßstäblich zum Monddurchmesser',
    items: [{ l: 'Mond', a: 2 * R_M, c: 2600, cl: 'Südpol-Aitken 2.600 km', t: `Ø ${de0(2 * R_M)} km` }],
    cap: 'Größe maßstäblich, Lage schematisch: Das Becken liegt auf der südlichen Rückseite und ist drei Viertel so breit wie der ganze Mond – das größte Einschlagbecken des Mondes.',
    s: ['nasa-spa', 'nasa-moon'],
  },
  'moon.farside': {
    k: 'timeline', alt: 'Zeitleiste der Mondrückseite: erste Fotos 1959, erste Menschen 1968, erste Landung 2019',
    items: [
      { d: '1959-10-07', t: 'Okt. 1959', l: 'Luna 3', l2: 'erste Fotos' },
      { d: '1968-12-24', t: 'Dez. 1968', l: 'Apollo 8', l2: 'Menschen sehen sie' },
      { d: '2019-01-03', t: 'Jan. 2019', l: 'Chang’e 4', l2: 'erste Landung', hl: true },
    ],
    cap: 'Die Rückseite ist nicht dunkel, nur von der Erde abgewandt. Fotografiert 1959, mit eigenen Augen gesehen 1968, die erste Landung gelang 2019 im Krater Von Kármán.',
    s: ['nasa-moon-facts', 'nssdc-apollo8', 'li-2019'],
  },
};
