// Infografiken Ast Sonne, Sonnensystem, Asteroiden (02 Sonnensystem, 02B Sonne, 02A Asteroiden) – Aufbau wie
// figs/mars.js. Werte: NSSDCA Fact Sheets, NOAA SWPC, NASA/JPL, SDO-Kanäle, begutachtete Paper (Quellen je Bild);
// Winkelgrößen, Kirkwood-Lücken, Laufzeiten, Drehung nach Breite und Fluchtgeschwindigkeit als eigene Rechnung.

const DEG = 180 / Math.PI, AU = 149597870.7, R_SUN = 695700;   // km (IAU 2012, NSSDCA Sun Fact Sheet)
const fmt = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const disc = (r, d) => 2 * Math.asin(r / d) * DEG;   // Winkeldurchmesser in Grad
const SUN_SKY = { peri: disc(R_SUN, 46.0e6), aph: disc(R_SUN, 69.818e6), earth: disc(R_SUN, AU) };
// Kirkwood-Lücken: Umlaufzeit im Verhältnis zu Jupiter (a = 5,2029 AE, JPL) → Bahnradius nach Kepler III
const A_JUP = 5.2028870, gap = (n, m) => A_JUP * (m / n) ** (2 / 3);
// Drehung nach Breite (Snodgrass & Ulrich 1990, Doppler, gegen die Sterne): ω = A + B sin²φ + C sin⁴φ in °/Tag
const rot = (lat) => { const s = Math.sin(lat / DEG) ** 2; return 360 / (14.713 - 2.396 * s - 1.787 * s * s); };
// Sonnenflecken: NOAA nennt °F → Kelvin; Abstrahlung je Fläche nach Stefan-Boltzmann ∝ T⁴
const fK = (f) => (f - 32) * 5 / 9 + 273.15, SPOT = fK(7000), PHOT = fK(10000);
// Parker Solar Probe 24.12.2024: 3,8 Mio. Meilen über der Oberfläche → Sonnenradien vom Mittelpunkt
const PSP = (3.8e6 * 1.609344 + R_SUN) / R_SUN;
// Bennu: Masse 7,329·10¹⁰ kg (Scheeres 2019), Durchmesser 0,49 km (NSSDCA) → Fluchtgeschwindigkeit in cm/s
const V_ESC = Math.sqrt(2 * 6.674e-11 * 7.329e10 / 245) * 100;
const deg = (v) => `${fmt(v, 2)}°`;

export default {
  // ---------- 02 Sonnensystem ----------
  'solar.flare': {
    k: 'range', min: -8.5, max: -3.5, step: 10, u: 'W/m², logarithmisch',
    alt: 'Flare-Klassen A bis X auf einer logarithmischen Skala der Röntgenleistung von 10 hoch minus 8 bis 10 hoch minus 4 Watt je Quadratmeter',
    marks: [-8, -7, -6, -5, -4].map((e, i) => ({ v: e, t: 'ABCMX'[i], l: `10⁻${'⁸⁷⁶⁵⁴'[i]}` })),
    cap: 'Röntgenleistung bei 0,1–0,8 nm am Ort der Erde, logarithmisch: Jede Klasse ist zehnmal stärker als die vorige, die Zahl dahinter zählt innerhalb der Klasse (X9,0 = neunmal X1). Größter Flare im Zyklus 25 bis zum Maximum: X9,0 am 3. Oktober 2024.',
    s: ['swpc-flares', 'nasa-solarmax'],
  },
  'solar.corona': {
    k: 'bars', alt: 'Temperatur im Kern, in der Korona und an der Oberfläche der Sonne, linear',
    groups: [{ t: 'Temperatur', u: 'Mio. K', items: [
      { l: 'Kern', v: 15.71, t: '15,7' },
      { l: 'Korona', v: 3, t: '1–3', hl: true },
      { l: 'Oberfläche', v: 0.005772, t: '0,006' },
    ] }],
    cap: 'Von innen nach außen wird die Sonne erst kühler, dann wieder heißer: Über der 5.772 K warmen Oberfläche hat die Korona Millionen Grad. Wie sie so heiß wird, misst unter anderem Parker Solar Probe.',
    s: ['nasa-sun', 'nasa-sun-facts', 'nasa-psp'],
  },
  'solar.belt': {
    k: 'range', min: 2.3, max: 3.4, step: 0.5, u: 'AE', alt: 'Kirkwood-Lücken im Asteroidengürtel bei 2,50, 2,82, 2,96 und 3,28 AE',
    marks: [[3, 1], [5, 2], [7, 3], [2, 1]].map(([n, m]) => ({ v: gap(n, m), t: `${n}:${m}`, l: `${fmt(gap(n, m), 2)} AE` })),
    cap: 'Lage der Lücken aus dem dritten Keplerschen Gesetz (eigene Rechnung aus Jupiters Bahnradius 5,20 AE): Bei 3:1 umläuft ein Asteroid die Sonne dreimal, während Jupiter einmal herumkommt. Die Lücke bei 2:1 liegt am äußeren Rand des Hauptgürtels.',
    s: ['kirkwood', 'jpl-elements'],
  },
  'solar.kuiper': {
    k: 'range', min: 0, max: 60, step: 10, u: 'AE', alt: 'Kuipergürtel von 30 bis 50 AE mit den Bahnradien von Erde, Jupiter, Neptun und Pluto, maßstäblich',
    span: [30, 50], spanL: 'Kuipergürtel',
    marks: [
      { v: 1, t: '1 AE', l: 'Erde', ref: true }, { v: 5.2, t: '5,2 AE', l: 'Jupiter', ref: true },
      { v: 30.07, t: '30,1 AE', l: 'Neptun', ref: true }, { v: 39.5, t: '39,5 AE', l: 'Pluto' },
    ],
    cap: 'Mittlere Bahnradien maßstäblich. Der Hauptteil des Kuipergürtels reicht von Neptuns Bahn bis etwa 50 AE, dahinter setzt sich die Streuscheibe bis fast 1.000 AE fort. Pluto umläuft die Sonne zweimal, während Neptun dreimal herumkommt.',
    s: ['nasa-kuiper', 'jpl-elements', 'nssdc-pluto'],
  },
  'solar.mercury': {
    k: 'scale', h: 90, alt: 'Die Sonne am Himmel von Merkur im Perihel und Aphel und von der Erde, Winkelgröße maßstäblich',
    items: [
      { l: 'Merkur, Perihel', a: SUN_SKY.peri, t: deg(SUN_SKY.peri), hl: true },
      { l: 'Merkur, Aphel', a: SUN_SKY.aph, t: deg(SUN_SKY.aph) },
      { l: 'von der Erde', a: SUN_SKY.earth, t: deg(SUN_SKY.earth) },
    ],
    cap: 'Die Sonne am Himmel, Winkelgröße maßstäblich (eigene Rechnung aus Sonnenradius und Abstand). Merkurs Abstand schwankt zwischen 46,0 und 69,8 Mio. km – im Perihel erscheint die Sonne mehr als dreimal so breit wie von der Erde.',
    s: ['nssdc-mercury', 'nasa-sun'],
  },
  'solar.venus': {
    k: 'range', min: 0, max: 600, step: 100, u: '°C', alt: 'Oberflächentemperatur: Venus 464 Grad, Merkur auf der Tagseite 317 bis 452 Grad, Erde im Mittel 15 Grad Celsius',
    span: [317, 452], spanL: 'Merkur, Tagseite',
    marks: [{ v: 15, t: '15 °C', l: 'Erde, Mittel', ref: true }, { v: 464, t: '464 °C', l: 'Venus' }],
    cap: 'Venus ist überall heißer als Merkurs Tagseite, obwohl sie fast doppelt so weit von der Sonne entfernt ist: Die dichte CO₂-Hülle hält die Wärme fest. Merkur aus 590–725 K umgerechnet.',
    s: ['nasa-planets', 'nssdc-mercury'],
  },

  // ---------- 02B Sonne ----------
  'sun.region': {
    k: 'timeline', alt: 'Zeitleiste des Sonnenzyklus 25 vom Minimum im Dezember 2019 bis zur Maximumsphase im Oktober 2024',
    items: [
      { d: '2019-12-01', t: 'Dez. 2019', l: 'Minimum,', l2: 'Zyklus 25 beginnt' },
      { d: '2024-05-10', t: 'Mai 2024', l: 'stärkster Sturm', l2: 'des Zyklus bis dahin' },
      { d: '2024-10-03', t: '3. Okt.', l: 'größter Flare', l2: 'X9,0' },
      { d: '2024-10-15', t: '15. Okt.', l: 'Maximumsphase', l2: 'verkündet', hl: true },
    ],
    cap: 'Zyklus 25 vom Minimum bis zur Maximumsphase, verkündet von NASA und NOAA. Die Fachleute erwarteten, dass sie noch etwa ein Jahr anhält.',
    s: ['nasa-cycle25', 'nasa-solarmax'],
  },
  'sun.spots': {
    k: 'bars', alt: 'Temperatur und Abstrahlung eines Sonnenflecks im Vergleich zur Umgebung',
    groups: [
      { t: 'Temperatur', u: 'K', items: [{ l: 'Umgebung', v: PHOT, t: `≈ ${fmt(Math.round(PHOT / 100) * 100)}` }, { l: 'Sonnenfleck', v: SPOT, t: `≈ ${fmt(Math.round(SPOT / 100) * 100)}`, hl: true }] },
      { t: 'Abstrahlung je Fläche', u: '%', items: [{ l: 'Umgebung', v: 100, t: '100' }, { l: 'Sonnenfleck', v: 100 * (SPOT / PHOT) ** 4, t: `≈ ${fmt(100 * (SPOT / PHOT) ** 4)}`, hl: true }] },
    ],
    cap: 'NOAA nennt 7.000 °F im Fleck und 10.000 °F ringsum (in Kelvin umgerechnet). Die Abstrahlung wächst mit der vierten Potenz der Temperatur: Der Fleck strahlt je Fläche nur ein Viertel so viel ab und wirkt deshalb dunkel (eigene Rechnung).',
    s: ['swpc-sunspots'],
  },
  'sun.gran': {
    k: 'scale', h: 108, alt: 'Supergranule, Erde und Granule maßstäblich nebeneinander',
    items: [
      { l: 'Supergranule', a: 30000, t: '≈ 30.000 km' },
      { l: 'Erde', a: 12742, t: '12.742 km' },
      { l: 'Granule', a: 1000, t: '≈ 1.000 km', hl: true },
    ],
    cap: 'Maßstäblich nebeneinander. Eine Granule lebt rund 10 Minuten; Supergranulen sind ein größeres Strömungsmuster aus Hunderten Granulen und bestehen rund 1,8 Tage.',
    s: ['nordlund-2009', 'rieutord-2010', 'nasa-earth'],
  },
  'sun.prom': {
    k: 'bars', alt: 'Temperatur einer Protuberanz im Vergleich zur Korona und zur Oberfläche, linear',
    groups: [{ t: 'Temperatur', u: 'K', items: [
      { l: 'Korona ringsum', v: 3e6, t: '1–3 Mio.' },
      { l: 'Protuberanz', v: 2e4, t: '7.000–20.000', hl: true },
      { l: 'Oberfläche', v: 5772, t: '5.772' },
    ] }],
    cap: 'Linear aufgetragen: Neben der Millionen Grad heißen Korona ist das Plasma der Protuberanz kaum zu sehen – es ist rund hundertmal kühler und hängt, vom Magnetfeld getragen, mitten in ihr.',
    s: ['parenti-2014', 'nasa-sun-facts', 'nasa-sun'],
  },
  'sun.filament': {
    k: 'bars', alt: 'Typische Höhe und Breite eines Filaments im Vergleich zum Erddurchmesser',
    groups: [{ t: 'Ausdehnung', u: 'km', items: [
      { l: 'Höhe, typisch', v: 26000, t: '≈ 26.000', hl: true },
      { l: 'Erde, Ø', v: 12742, t: '12.742' },
      { l: 'Breite', v: 1e4, t: '1.000–10.000' },
    ] }],
    cap: 'Typische Höhe über der Oberfläche nach einer Statistik von fast 9.500 Protuberanzen am Sonnenrand. Von oben gesehen ist der Faden schmal, schwebt aber höher, als zwei Erden übereinander messen.',
    s: ['parenti-2014', 'nasa-earth'],
  },
  'sun.hole': {
    k: 'range', min: 3.5, max: 6.5, step: 10, u: '', alt: 'Kanäle des Sonnenobservatoriums SDO auf einer logarithmischen Temperaturskala, 193 Ångström hervorgehoben',
    span: [6, Math.log10(3e6)], spanL: 'Korona',
    marks: [   // log T der Kanäle aus sdo-channels; keine Teilstriche (step größer als die Skala)
      { v: Math.log10(5772), t: '5.772 K', l: 'Weißlicht', ref: true },
      { v: 4.7, t: '50.000 K', l: '304 Å', ref: true },
      { v: 6.1, t: '1,3 Mio. K', l: '193 Å' },
    ],
    cap: 'Jeder SDO-Kanal zeigt Gas einer bestimmten Temperatur (logarithmische Skala). Im Kanal 193 Å sind koronale Löcher dunkel: Dort fehlt das 1,3 Mio. K heiße Plasma, weil es über offene Feldlinien als schneller Sonnenwind abströmt.',
    s: ['sdo-channels', 'nasa-sun-facts', 'nasa-sun'],
  },
  'sun.flare': {
    k: 'bars', alt: 'Laufzeit zur Erde: Licht eines Flares und koronale Massenauswürfe mit 3.000 und 250 Kilometern je Sekunde',
    groups: [{ t: 'Weg zur Erde', u: 'Stunden', items: [
      { l: 'Licht', v: 499 / 3600, t: '8 min 19 s' },
      { l: '3.000 km/s', v: AU / 3000 / 3600, t: `≈ ${fmt(AU / 3000 / 3600)} h`, hl: true },
      { l: '250 km/s', v: AU / 250 / 3600, t: `≈ ${fmt(AU / 250 / 86400)} Tage` },
    ] }],
    cap: 'Eigene Rechnung über 1 AE bei gleichbleibendem Tempo: Das Licht des Flares ist nach gut 8 Minuten da, ein Massenauswurf mit 3.000 km/s nach einem halben Tag, mit 250 km/s erst nach einer Woche.',
    s: ['swpc-cme', 'iau-2012'],
  },
  'sun.pole': {
    k: 'bars', alt: 'Dauer einer Sonnendrehung nach Breite vom Äquator bis 75 Grad',
    groups: [{ t: 'Eine Drehung', u: 'Tage', items: [0, 15, 30, 45, 60, 75].map((b) => ({ l: b ? `${b}° Breite` : 'Äquator', v: rot(b), t: fmt(rot(b), 1), hl: !b })) }],
    cap: 'Eigene Rechnung mit der Drehrate nach Snodgrass & Ulrich (1990), gegen die Sterne gemessen: Bei 75° Breite dauert eine Drehung gut ein Drittel länger als am Äquator. Nach einem Monat ist der Äquator dem 60. Breitengrad fast eine Vierteldrehung voraus.',
    s: ['snodgrass-1990'],
  },
  'sun.wind': {
    k: 'range', min: 0, max: 220, step: 50, u: 'Sonnenradien', alt: 'Abstand vom Sonnenmittelpunkt in Sonnenradien: Parker Solar Probe, Alfvén-Fläche, Merkur und Erde, maßstäblich',
    marks: [
      { v: PSP, t: `${fmt(PSP, 1)} R☉`, l: 'Parker' }, { v: 18.8, t: '18,8 R☉', l: 'Alfvén' },
      { v: 0.387 * AU / R_SUN, t: `${fmt(0.387 * AU / R_SUN)} R☉`, l: 'Merkur', ref: true }, { v: AU / R_SUN, t: `${fmt(AU / R_SUN)} R☉`, l: 'Erde', ref: true },
    ],
    cap: 'Abstand vom Sonnenmittelpunkt maßstäblich (eigene Rechnung). Innerhalb der Alfvén-Fläche ist der Sonnenwind noch ans Magnetfeld gebunden; Parker Solar Probe überquerte sie am 28. April 2021 zum ersten Mal und kam am 24. Dezember 2024 bis auf 6,1 Mio. km an die Oberfläche heran.',
    s: ['kasper-2021', 'nasa-psp-2024', 'jpl-elements'],
  },

  // ---------- 02A Asteroiden ----------
  'asteroid.psyche-metal': {
    k: 'bars', alt: 'Dichte von Erde, Psyche, Bennu und Wasser im Vergleich',
    groups: [{ t: 'Dichte', u: 'g/cm³', items: [
      { l: 'Erde', v: 5.513, t: '5,51' },
      { l: 'Psyche', v: 4.0, t: '4,0', hl: true },
      { l: 'Bennu', v: 1.19, t: '1,19' },
      { l: 'Wasser', v: 1, t: '1,00' },
    ] }],
    cap: 'Psyche ist mehr als dreimal so dicht wie der Geröllhaufen Bennu, aber leichter als die Erde mit ihrem Eisenkern: Metall, Gestein und Hohlräume gemischt.',
    s: ['shepard-2021', 'scheeres-2019', 'nasa-earth'],
  },
  'asteroid.psyche-basin': {
    k: 'bars', alt: 'Breite der großen Senken auf Psyche im Vergleich zur Länge des Asteroiden',
    groups: [{ t: 'Breite', u: 'km', items: [
      { l: 'Psyche, Länge', v: 278, t: '278' },
      { l: 'Mulde Norden', v: 90, t: '80–90' },
      { l: 'Senke Südpol', v: 75, t: '50–75', hl: true },
      { l: 'Senke Nordpol', v: 50, t: '≈ 50' },
    ] }],
    cap: 'Nach dem Radarmodell: Die Senke nahe dem Südpol ist rund 4 km tief und wahrscheinlich ein Einschlagkrater; die Mulde auf der Nordhalbkugel ist flach.',
    s: ['shepard-2021'],
  },
  'asteroid.psyche-mission': {
    k: 'timeline', alt: 'Zeitleiste der Raumsonde Psyche vom Start 2023 bis zum Ende der Hauptmission um 2031',
    items: [
      { d: '2023-10-13', t: 'Okt. 2023', l: 'Start', l2: 'Kennedy Space Center' },
      { d: '2026-05-15', t: 'Mai 2026', l: 'Schwung am Mars', l2: '(Vorbeiflug)' },
      { d: '2029-08-01', t: 'Aug. 2029', l: 'Ankunft', l2: 'Beginn der Messungen', hl: true },
      { d: '2031-08-01', t: '≈ 2031', l: 'Ende der Hauptmission', l2: 'nach etwa zwei Jahren' },
    ],
    cap: 'Rund zwei Jahre soll die Sonde den Asteroiden umkreisen und Form, Schwerefeld, Magnetfeld und Zusammensetzung vermessen. Der Vorbeiflug am Mars im Mai 2026 lenkte sie ohne Treibstoff auf Kurs.',
    s: ['nasa-psyche', 'jpl-psyche-mars'],
  },
  'asteroid.bennu-pile': {
    k: 'layers', from: 'Volumen von Bennu', to: '100 %', alt: 'Bennu besteht zu 40 bis 50 Prozent aus Hohlräumen zwischen den Blöcken',
    items: [
      { l: 'Gestein und Geröll', d: 55, t: '50–60 %' },
      { l: 'Hohlräume dazwischen', d: 45, t: '40–50 %', hl: true },
    ],
    cap: 'Aus Masse und Volumen folgt eine Dichte von nur 1,19 g/cm³. Verglichen mit passenden Meteoriten ist fast die Hälfte von Bennu Hohlraum zwischen den Blöcken (Makroporosität).',
    s: ['scheeres-2019'],
  },
  'asteroid.bennu-sample': {
    k: 'bars', alt: 'Masse der Bennu-Probe im Vergleich zum Mindestziel der Mission und zur Ryugu-Probe von Hayabusa2',
    groups: [{ t: 'Probe', u: 'Gramm', items: [
      { l: 'Ryugu', v: 5.4, t: '5,4' },
      { l: 'Mindestziel', v: 60, t: '60' },
      { l: 'Bennu', v: 121.6, t: '121,6', hl: true },
    ] }],
    cap: 'Die größte Probe, die je von einem Asteroiden zur Erde kam: doppelt so viel wie das Mindestziel der Mission und gut zwanzigmal so viel, wie die japanische Sonde Hayabusa2 von Ryugu mitbrachte.',
    s: ['nasa-orex-mass', 'yada-2022'],
  },
  'asteroid.bennu-ejecta': {
    k: 'range', min: 0, max: 350, step: 50, u: 'cm/s', alt: 'Startgeschwindigkeit der Steinchen von Bennu, 5 bis über 300 Zentimeter je Sekunde, und Fluchtgeschwindigkeit 20 Zentimeter je Sekunde',
    span: [5, 300], spanL: 'Startgeschwindigkeit',
    marks: [{ v: V_ESC, t: `${fmt(V_ESC)} cm/s`, l: 'Fluchtgeschwindigkeit', ref: true }, { v: 300, t: 'über 3 m/s', l: 'schnellste' }],
    cap: 'Die Steinchen, unter 1 bis etwa 10 cm groß, starten mit 5 cm/s bis über 3 m/s. Bennu ist so leicht, dass rund 20 cm/s zum Entkommen reichen (eigene Rechnung aus Masse und Radius): Langsame fallen zurück oder kreisen, schnelle fliegen davon.',
    s: ['lauretta-2019', 'scheeres-2019', 'nssdc-asteroids'],
  },
  'asteroid.eros-shape': {
    k: 'scale', h: 60, alt: 'Eros, der Marsmond Phobos und Bennu maßstäblich nebeneinander',
    items: [
      { l: 'Eros', a: 33, b: 13, t: '33 × 13 × 13 km', hl: true },
      { l: 'Phobos', a: 27, b: 22, t: '27 × 22 × 18 km' },
      { l: 'Bennu', a: 0.49, t: '0,49 km' },
    ],
    cap: 'Maßstäblich nebeneinander: Eros ist etwas länger als der Marsmond Phobos, aber deutlich schlanker, und dreht sich in 5,27 Stunden einmal. Bennu wäre in diesem Maßstab nur ein Punkt.',
    s: ['nssdc-asteroids', 'nasa-phobos'],
  },
  'asteroid.eros-near': {
    k: 'timeline', alt: 'Zeitleiste der Raumsonde NEAR Shoemaker vom Start 1996 bis zur Landung auf Eros 2001',
    items: [
      { d: '1996-02-17', t: 'Feb. 1996', l: 'Start' },
      { d: '1997-06-27', t: 'Juni 1997', l: 'Vorbeiflug', l2: 'an Mathilde' },
      { d: '1998-12-20', t: 'Dez. 1998', l: 'Bremsmanöver', l2: 'bricht ab' },
      { d: '2000-02-14', t: 'Feb. 2000', l: 'Umlauf um Eros' },
      { d: '2001-02-12', t: 'Feb. 2001', l: 'Landung', l2: 'als erste Sonde', hl: true },
    ],
    cap: 'Ein abgebrochenes Bremsmanöver verzögerte die Ankunft bis zum 14. Februar 2000. Am 12. Februar 2001 setzte die Sonde im „Sattel“ von Eros auf – als erste auf einem Asteroiden.',
    s: ['nssdc-near', 'nasa-eros'],
  },
};
