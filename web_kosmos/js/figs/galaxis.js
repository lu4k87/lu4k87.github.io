// Infografiken Ast Milchstraße und Kosmos (03 galaxy, 04 orion, 05 crab, 06 pulsar, 07 sgra, 08 local, 09 web, 10 cmb) –
// Aufbau wie figs/mars.js. Werte aus den Quellen in SOURCES (content.js); abgeleitete Größen (Leuchtkraft aus M_V,
// Kreuzungen der Spiralarme, Lichtzylinder, Schatten, Kosmologie) als eigene Rechnung hier im Code. Große Spannen
// (Magnetfeld, Abstände am Pulsar) zeigen Balken logarithmisch – das steht dann in Gruppentitel und Bildunterschrift.
import { C, G, AU, KPC, GLY, M_SUN, YEAR, COSMO, cosmo, cosmoAge, zAtLookback, schwarzschildRadius, shadowRadius, microArcsec, lightCylinder } from '../astro.js';

const RAD = Math.PI / 180, LJ_PER_KPC = KPC / 9.4607304725808e15;
const fmt = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

// ---------- 03 Milchstraße ----------
// Reid et al. 2019, Tabelle 2: R_kink [kpc], β_kink [°], Steigung ψ< [°] (Seite zur Sonne hin), Breite [kpc]
const REID = [
  { id: 'kpc3', l: '3-kpc-Arm', rk: 3.52, bk: 15, psi: -4.2, w: 0.18 },
  { id: 'norma', l: 'Norma', rk: 4.46, bk: 18, psi: -1.0, w: 0.14 },
  { id: 'scutum', l: 'Scutum-Centaurus', rk: 4.91, bk: 23, psi: 14.1, w: 0.23, cross: true },
  { id: 'sagittarius', l: 'Sagittarius', rk: 6.04, bk: 24, psi: 17.1, w: 0.27, cross: true },
  { id: 'localarm', l: 'Lokaler Arm', rk: 8.26, bk: 9, psi: 11.4, w: 0.31, cross: true },
  { id: 'perseus', l: 'Perseus', rk: 8.87, bk: 40, psi: 10.3, w: 0.35, cross: true },
  { id: 'outer', l: 'Äußerer Arm', rk: 12.24, bk: 18, psi: 3.0, w: 0.65, cross: true },
];
// log. Spirale ln(R/R_kink) = −(β − β_kink)·tan ψ, ausgewertet bei β = 0 (Richtung Zentrum → Sonne)
const crossR = (a) => a.rk * Math.exp(a.bk * RAD * Math.tan(a.psi * RAD));
const ARMS = (on) => ({
  k: 'bars', alt: 'Abstand der Spiralarme vom Zentrum auf der Linie Zentrum–Sonne im Vergleich zur Sonne',
  groups: [{ t: 'Abstand vom Zentrum', u: 'kpc', items: [
    ...REID.filter((a) => a.cross).map((a) => ({ l: a.l, v: crossR(a), t: fmt(crossR(a), 1), hl: a.id === on })),
    { l: 'Sonne', v: 8.15, t: '8,15' },
  ].sort((a, b) => a.v - b.v) }],
  cap: 'Wo die Arme die Linie vom Zentrum durch die Sonne kreuzen – eigene Rechnung aus dem Spiralmodell von Reid et al. 2019 (Tabelle 2; dort liegt die Sonne bei 8,15 kpc). Die Sonne steht am Innenrand des Lokalen Arms.',
  s: ['reid-2019'],
});

// Kugelsternhaufen (Harris 2010): absolute Helligkeit M_V und Entfernung von der Sonne [kpc]
const GLOB = [['ω Centauri', -10.26, 5.2, true], ['47 Tucanae', -9.42, 4.5], ['M13 (Herkules)', -8.55, 7.1], ['M4 (Skorpion)', -7.19, 2.2]];
const lum = (mv) => 10 ** (-0.4 * (mv - 4.83));   // in Sonnen-Leuchtkräften (Sonne M_V = 4,83)

// ---------- 06 Crab-Pulsar ----------
const P = 0.0338, R_NS = 13;                       // s (heute, content.js) · km (NICER, gerundet)
const R_LC = lightCylinder(P) / 1e3;               // km
const capD = (p) => 2 * R_NS * Math.sqrt(R_NS / (lightCylinder(p) / 1e3));   // Polkappe Ø im Dipol: r = R·√(R/R_LC)
const LG = (v, o = 0) => Math.log10(v) + o;        // Balkenlänge logarithmisch
const NEB_KM = 2.05 * KPC / 1e6;                   // halbe Länge des Krebsnebels (4,1 pc) in km
const WIND = (on) => ({
  k: 'bars', alt: 'Abstände vom Pulsar: Oberfläche, Lichtzylinder und Rand des Krebsnebels, logarithmisch',
  groups: [{ t: 'Abstand vom Pulsar', u: 'km, logarithmisch', items: [
    { l: 'Oberfläche', v: LG(R_NS), t: '13' },
    { l: 'Lichtzylinder', v: LG(R_LC), t: fmt(Math.round(R_LC / 100) * 100), hl: on === 'wind' },
    { l: 'Rand des Nebels', v: LG(NEB_KM), t: '6 · 10¹³', hl: on === 'jet' },
  ] }],
  cap: on === 'jet'
    ? 'Balken logarithmisch, jeder Schritt eine Zehnerpotenz. Der Polstrahl wird erst weit draußen im Nebel sichtbar – Milliarden-mal weiter vom Stern entfernt als der Lichtzylinder (eigene Rechnung aus 4,1 pc Nebellänge).'
    : 'Balken logarithmisch, jeder Schritt eine Zehnerpotenz. Der Wind beginnt am Lichtzylinder (R = c·P/2π, eigene Rechnung) und strömt bis zum Rand des Nebels, rund 6 · 10¹³ km – zwei Parsec.',
  s: ['atnf', 'buhler-2014'],
});

// ---------- 05 Krebsnebel: Synchrotron je Band ----------
// gleiches Feld: Energie der Elektronen γ ∝ √ν, Lebensdauer ∝ 1/γ (eigene Rechnung)
const NU = { radio: 5e9, light: C / 550e-9, xray: 1.602176634e-16 / 6.62607015e-34 };
const gam = (nu) => Math.sqrt(nu / NU.radio);
const ELECTRONS = (on) => ({
  k: 'bars', alt: 'Energie und Lebensdauer der strahlenden Elektronen im Krebsnebel je Wellenlängenbereich',
  groups: [
    { t: 'Energie der Elektronen', u: 'Radio = 1', items: [
      { l: 'Radio (5 GHz)', v: 1, t: '1', hl: on === 'radio' },
      { l: 'Licht (550 nm)', v: gam(NU.light), t: fmt(Math.round(gam(NU.light) / 10) * 10) },
      { l: 'Röntgen (1 keV)', v: gam(NU.xray), t: `≈ ${fmt(Math.round(gam(NU.xray) / 1000) * 1000)}`, hl: on === 'xray' },
    ] },
    { t: 'Lebensdauer', u: 'Röntgen = 1', items: [
      { l: 'Radio (5 GHz)', v: gam(NU.xray), t: `≈ ${fmt(Math.round(gam(NU.xray) / 1000) * 1000)}`, hl: on === 'radio' },
      { l: 'Licht (550 nm)', v: gam(NU.xray) / gam(NU.light), t: fmt(gam(NU.xray) / gam(NU.light)) },
      { l: 'Röntgen (1 keV)', v: 1, t: '1', hl: on === 'xray' },
    ] },
  ],
  cap: on === 'xray'
    ? 'Im selben Magnetfeld strahlt ein Elektron umso kurzwelliger, je energiereicher es ist (Energie ∝ √Frequenz), und verliert seine Energie umso schneller. Röntgen-Elektronen leben rund 7.000-mal kürzer als Radio-Elektronen und kommen nicht bis zum Rand (eigene Rechnung).'
    : 'Im selben Magnetfeld strahlen Elektronen mit wenig Energie im Radiobereich (Energie ∝ √Frequenz) – sie verlieren ihre Energie rund 7.000-mal langsamer als Röntgen-Elektronen und füllen daher den ganzen Nebel (eigene Rechnung).',
  s: ['weisskopf-2000', 'buhler-2014'],
});

// ---------- 07 Sagittarius A* ----------
const M_BH = 4.30e6, RS = schwarzschildRadius(M_BH);          // Sonnenmassen (GRAVITY 2022) · m
const SHADOW = 2 * shadowRadius(M_BH);                          // Ø des Schattens [m]
const ISCO_MIN = 2 * Math.PI * Math.sqrt((3 * RS) ** 3 / (G * M_BH * M_SUN)) / 60;
const S2 = { a: 0.125058 * 8246.7, e: 0.884649 };              // AE (a [″] · R0 [pc], GRAVITY 2020), Exzentrizität
const DOP = (b) => Math.sqrt((1 + b) / (1 - b)) ** 4;          // Helligkeit ∝ δ⁴, Bewegung längs der Sichtlinie
const NEAR_AU = (1 / Math.cbrt(1e6 / (4 / 3 * Math.PI))) * 206264.806;   // 10⁶ Sterne à 1 M☉ in 1 pc, mittlerer Abstand

// ---------- 08 Lokale Gruppe ----------
const MOON_ARCMIN = 2 * Math.asin(1737.4 / 384400) / RAD * 60;   // Vollmond von der Erde (NASA Moon Fact Sheet)
const SKY_LG = (on) => ({
  k: 'scale', h: 96, alt: 'Andromeda und M33 am Himmel im Vergleich zum Vollmond, Winkelgröße maßstäblich',
  items: [
    { l: 'Andromeda', a: 189.1, b: 61.7, t: '3,2° × 1,0°', hl: on === 'm31' },
    { l: 'M33', a: 70.8, b: 41.7, t: '1,2° × 0,7°', hl: on === 'm33' },
    { l: 'Vollmond', a: MOON_ARCMIN, t: '0,5°' },
  ],
  cap: 'Größe am Himmel maßstäblich (Durchmesser bis zur Isophote 25 mag/″² im Katalog RC3). Andromeda ist sechsmal so breit wie der Vollmond – mit bloßem Auge sieht man nur ihren hellen Kern.',
  s: ['rc3-1991', 'nasa-moon'],
});
const D_M31 = 761 * LJ_PER_KPC / 1e6, BARY = D_M31 * 1.5 / 2.7;   // Mio. Lj · Abstand Milchstraße → Schwerpunkt

// ---------- 09 Kosmisches Netz ----------
const CL = [['virgo', 'Virgo', 54], ['fornax', 'Fornax', 60], ['centaurus', 'Centaurus', 160], ['hydra', 'Hydra', 180],
  ['perseus', 'Perseus', 250], ['coma', 'Coma', 320], ['hercules', 'Hercules', 500], ['shapley', 'Shapley', 650]];
const CLUSTERS = (on) => ({
  k: 'bars', alt: 'Entfernung der nächsten Galaxienhaufen und Superhaufen von der Milchstraße',
  groups: [{ t: 'Entfernung', u: 'Mio. Lj', items: CL.map(([id, l, v]) => ({ l, v, hl: id === on })) }],
  cap: 'Entfernungen gerundet aus der Rotverschiebung (d = cz/H₀). Virgo und Fornax sind unsere Nachbarn; der Shapley-Superhaufen liegt zwölfmal so weit entfernt wie Virgo.',
  s: ['tully-2014', 'abell-1989'],
});
const STRUCT = (on) => ({
  k: 'bars', alt: 'Größe von Lokaler Gruppe, Leerraum, Perseus-Pisces-Kette und Laniakea im Vergleich',
  groups: [{ t: 'Ausdehnung', u: 'Mio. Lj', items: [
    { l: 'Lokale Gruppe', v: 10, t: '≈ 10' },
    { l: 'Leerraum', v: 75, t: '50–100' },
    { l: 'Perseus-Pisces', v: 300, t: 'über 300', hl: on === 'perseus' },
    { l: 'Laniakea', v: 520, t: '≈ 520', hl: on === 'flow' },
  ] }],
  cap: on === 'flow'
    ? 'Laniakea umfasst alle Galaxien, deren Strömung zum Großen Attraktor zeigt: rund 100.000 Galaxien auf 520 Mio. Lj – über fünfzigmal so groß wie die Lokale Gruppe.'
    : 'Die Perseus-Pisces-Kette zieht sich über mehr als 300 Mio. Lj – dreißigmal so weit wie die ganze Lokale Gruppe und größer als die meisten Leerräume.',
  s: ['mcconnachie-2012', 'cautun-2014', 'abell-1989', 'tully-2014'],
});

// ---------- 10 Beobachtbares Universum (ΛCDM, Planck 2018, astro.js) ----------
const GYR = 1e9 * YEAR, AGE = cosmoAge() / GYR;
const ageAt = (z) => cosmo(z).age / GYR;
const ageT = (z) => { const a = ageAt(z); return a < 1 ? `${fmt(Math.round(a * 100) * 10)} Mio.` : `${fmt(a, 1)} Mrd.`; };
const EPOCH = [
  ['firststars', 20, 'Erste Sterne', 'z ≈ 20'], ['dawn', 14.3, 'JADES-GS-z14-0', 'z = 14,3'], ['reion', 6, 'Reionisation fertig', 'z ≈ 6'],
  ['noon', 2, 'Sternentstehung', 'am stärksten, z ≈ 2'], ['darkenergy', 0.3, 'Dunkle Energie', 'überwiegt, z ≈ 0,3'],
];
const EPOCHS = (on) => ({
  k: 'timeline', alt: 'Zeitleiste des Universums vom Urknall bis heute mit ersten Sternen, ersten Galaxien und Reionisation',
  items: [...EPOCH.map(([id, z, l, l2]) => ({ d: ageAt(z), t: ageT(z), l, l2, hl: id === on })), { d: AGE, t: `${fmt(AGE, 1)} Mrd.`, l: 'heute' }],
  cap: 'Alter des Universums bei der jeweiligen Rotverschiebung, gerechnet im ΛCDM-Modell mit Planck-2018-Werten (eigene Rechnung). Alles Genannte bis zur Reionisation drängt sich in die erste Milliarde Jahre.',
  s: ['planck-2018', 'bromm-2013', 'jades-2024'],
});
// Sternentstehungsrate je mitbewegtem Volumen, Anpassung von Madau & Dickinson 2014 (Gl. 15)
const sfr = (z) => 0.015 * (1 + z) ** 2.7 / (1 + ((1 + z) / 2.9) ** 5.6);
const lookT = (z) => (z ? `vor ${fmt(cosmo(z).lookback / GYR, 1)} Mrd. J.` : 'heute');
const OB = 0.02242 / (COSMO.H0 / 100) ** 2;                         // Ω_b aus Ω_b·h² (Planck 2018)
const PROBE = [1, 5, 10, 13.7].map((t) => ({ t, d: cosmo(zAtLookback(t * GYR)).dc / GLY }));

export default {
  // ---------- 03 Milchstraße ----------
  'galaxy.bar': {
    k: 'range', min: 0, max: 16, step: 4, u: 'kpc vom Zentrum', alt: 'Halblänge des Balkens im Vergleich zum Abstand der Sonne und zum Rand der Sternscheibe',
    span: [0, 5.0], spanL: 'Balken (Halblänge)',
    marks: [{ v: 5.0, t: '5,0 kpc', l: 'Balkenende' }, { v: 8.277, t: '8,28 kpc', l: 'Sonne' }, { v: 5e4 / LJ_PER_KPC, t: '≈ 15 kpc', l: 'Scheibenrand', ref: true }],
    cap: 'Abstand vom Zentrum. Der Balken reicht 5,0 kpc weit, gut halb so weit wie bis zur Sonne; er steht 28–33° schräg zur Linie Sonne–Zentrum. Scheibenrand als Richtwert (≈ 100.000 Lj Durchmesser).',
    s: ['wegg-2015', 'gravity-2022', 'bland-2016'],
  },
  'galaxy.omega': {
    k: 'bars', alt: 'Leuchtkraft und Entfernung von ω Centauri und drei weiteren hellen Kugelsternhaufen',
    groups: [
      { t: 'Leuchtkraft', u: 'Tsd. Sonnen', items: GLOB.map(([l, mv, , hl]) => ({ l, v: lum(mv) / 1e3, t: fmt(lum(mv) / 1e3), hl })) },
      { t: 'Entfernung', u: 'Tsd. Lj', items: GLOB.map(([l, , d, hl]) => ({ l, v: d * LJ_PER_KPC / 1e3, hl })) },
    ],
    cap: 'Leuchtkraft aus der absoluten Helligkeit im Katalog von Harris (eigene Rechnung, Sonne 4,83 mag): ω Centauri strahlt so hell wie rund eine Million Sonnen, doppelt so hell wie der nächstgrößte Haufen.',
    s: ['harris-2010'],
  },
  'galaxy.halo': {
    k: 'bars', alt: 'Masse der Sterne im Vergleich zur Gesamtmasse und Radien von Sternscheibe, Sternhalo und Dunkle-Materie-Halo',
    groups: [
      { t: 'Masse', u: 'Mrd. Sonnenmassen', items: [{ l: 'Sterne', v: 50, t: '≈ 50' }, { l: 'Gesamtmasse', v: 1300, t: '≈ 1.300', hl: true }] },
      { t: 'Radius', u: 'Tsd. Lj', items: [
        { l: 'Sternscheibe', v: 50, t: '≈ 50' }, { l: 'Sternhalo', v: 100, t: 'über 100' },
        { l: 'Dunkler Halo', v: 282 * LJ_PER_KPC / 1e3, t: `≈ ${fmt(Math.round(282 * LJ_PER_KPC / 1e4) * 10)}`, hl: true },
      ] },
    ],
    cap: 'Sterne in Scheibe und Bulge machen nur rund 4 % der Masse aus (eigene Rechnung); den Rest stellt vor allem die Dunkle Materie, deren Halo bis zum Virialradius von 282 kpc reicht.',
    s: ['bland-2016'],
  },
  'galaxy.sunorbit': {
    k: 'bars', alt: 'Bahngeschwindigkeit der Sonne um das Zentrum im Vergleich zu Erde und Mond',
    groups: [{ t: 'Bahngeschwindigkeit', u: 'km/s', items: [
      { l: 'Sonne um Zentrum', v: 229, t: '229', hl: true }, { l: 'Erde um Sonne', v: 29.78, t: '29,8' }, { l: 'Mond um Erde', v: 1.022, t: '1,0' },
    ] }],
    cap: `In einem Jahr legt die Sonne rund ${fmt(229e3 * YEAR / 1e12, 1)} Mrd. km zurück – knapp ${fmt(Math.round(229e3 * YEAR / AU / 10) * 10)}-mal den Abstand Erde–Sonne (eigene Rechnung). Für einen Umlauf braucht sie trotzdem rund 220 Mio. Jahre.`,
    s: ['eilers-2019', 'nasa-earth', 'nasa-moon'],
  },
  'galaxy.fermi': {
    k: 'bars', alt: 'Höhe einer Fermi-Blase im Vergleich zum Abstand Sonne–Zentrum und zum Durchmesser der Sternscheibe',
    groups: [{ t: 'Ausdehnung', u: 'Tsd. Lj', items: [
      { l: 'Scheibe (Ø)', v: 100, t: '≈ 100' }, { l: 'Sonne–Zentrum', v: 8.277 * LJ_PER_KPC / 1e3, t: '27' }, { l: 'Fermi-Blase', v: 25, t: '≈ 25', hl: true },
    ] }],
    cap: 'Jede der beiden Blasen ragt rund 25.000 Lj über bzw. unter die Scheibe – fast so weit, wie die Sonne vom Zentrum entfernt ist.',
    s: ['su-2010', 'gravity-2022', 'bland-2016'],
  },
  'galaxy.perseus': ARMS('perseus'),
  'galaxy.scutum': ARMS('scutum'),
  'galaxy.sagittarius': ARMS('sagittarius'),
  'galaxy.localarm': ARMS('localarm'),
  'galaxy.norma': {
    k: 'bars', alt: 'Breite der Spiralarme der Milchstraße nach Reid et al. 2019, Norma hervorgehoben',
    groups: [{ t: 'Breite des Arms', u: 'pc', items: REID.map((a) => ({ l: a.l, v: a.w * 1e3, hl: a.id === 'norma' })) }],
    cap: 'Breite der Arme im Spiralmodell von Reid et al. 2019 (Tabelle 2): Norma ist mit 140 pc (≈ 460 Lj) der schmalste; nach außen werden die Arme breiter. Die Linie Zentrum–Sonne kreuzt Norma im Modell nicht.',
    s: ['reid-2019'],
  },

  // ---------- 04 Orion-Nebel ----------
  'orion.trapez': {
    k: 'bars', alt: 'Temperatur und Masse von θ¹ Orionis C im Vergleich zu NU Orionis und zur Sonne',
    groups: [
      { t: 'Oberfläche', u: 'Tsd. K', items: [{ l: 'θ¹ Ori C', v: 39, t: '39', hl: true }, { l: 'NU Orionis', v: 25, t: '≈ 25' }, { l: 'Sonne', v: 5.772, t: '5,8' }] },
      { t: 'Masse', u: 'Sonnenmassen', items: [{ l: 'θ¹ Ori C', v: 33, t: '33', hl: true }, { l: 'Sonne', v: 1, t: '1' }] },
    ],
    cap: 'θ¹ Orionis C ist fast siebenmal so heiß wie die Sonne (eigene Rechnung) und liefert damit den Großteil des UV-Lichts, das den Nebel leuchten lässt. NU Orionis heizt den Nachbarnebel M43.',
    s: ['simon-2006', 'odell-2001', 'nasa-sun'],
  },
  'orion.proplyds': {
    k: 'bars', alt: 'Zahl der Scheiben im Hubble-Atlas des Orion-Nebels nach Art',
    groups: [{ t: 'Hubble-Atlas', u: 'Anzahl', items: [
      { l: 'Proplyds (hell)', v: 178, hl: true }, { l: 'Silhouetten', v: 28 }, { l: 'Dunkle Bänder', v: 8 }, { l: 'Nur Jet', v: 5 },
    ] }],
    cap: 'Ricci et al. 2008 zählen 178 von außen ionisierte Scheiben (Proplyds), 28 nur als dunkle Silhouette vor dem Nebel, 8 als dunkle Bänder in Reflexionsnebeln und 5 Quellen nur mit Jet.',
    s: ['ricci-2008'],
  },
  'orion.omc': {
    k: 'layers', from: 'θ¹ Ori C', to: 'Molekülwolke', alt: 'Schnitt vom Trapez-Stern bis in die Molekülwolke: Höhlung, leuchtende Schicht, Wolke',
    items: [
      { l: 'Höhlung', d: 0.1, t: '≈ 0,1 pc' },
      { l: 'Leuchtschicht', d: 0.1, t: '≈ 0,1 pc', hl: true },
      { l: 'Molekülwolke OMC-1', d: 0.6, t: 'kalt, dicht' },
    ],
    cap: 'Schnitt längs der Sichtlinie: θ¹ Ori C steht rund 0,2 pc vor der Ionisationsfront, die letzten 0,1 pc davor leuchten. Dicke der Molekülwolke schematisch.',
    s: ['odell-2009'],
  },
  'orion.ionbar': {
    k: 'range', min: 0, max: 15, step: 3, u: '', alt: 'Photonenenergie von sichtbarem Licht im Vergleich zu UV-Licht, das Wasserstoff ionisiert oder Moleküle zerlegt',
    span: [11.2, 13.6], spanL: 'zerlegt H₂',
    marks: [{ v: 1.89, t: '1,9 eV', l: 'Hα (rot)' }, { v: 13.6, t: '13,6 eV', l: 'ionisiert H' }],
    cap: 'Photonenenergie (E = hc/λ, eigene Rechnung): Ab 13,6 eV wird Wasserstoff ionisiert – davor leuchtet das Gas. Dahinter kommt nur UV-Licht von 11,2–13,6 eV an und zerlegt H₂-Moleküle. Die helle Kante dazwischen ist der Orion-Balken.',
    s: ['odell-2001'],
  },
  'orion.bay': {
    k: 'bars', alt: 'Anteil des Lichts, den Staub je nach Extinktion in Größenklassen durchlässt',
    groups: [{ t: 'Licht durch Staub', u: '%', items: [1, 2, 3, 5].map((m) => ({ l: `${m} Größenklasse${m > 1 ? 'n' : ''}`, v: 100 * 10 ** (-0.4 * m), t: fmt(100 * 10 ** (-0.4 * m), 1), hl: m === 3 })) }],
    cap: 'Staub schwächt Licht in Größenklassen: jede lässt nur 40 % durch (Faktor 10^−0,4, eigene Rechnung). Schon wenige Größenklassen reichen, damit die Bucht dunkel vor dem hellen Nebel steht.',
    s: ['odell-2001'],
  },
  'orion.m43': {
    k: 'scale', h: 110, alt: 'Orion-Nebel M42 und M43 maßstäblich nebeneinander',
    items: [{ l: 'Orion-Nebel M42', a: 24, t: '≈ 24 Lj' }, { l: 'M43', a: 2, t: '≈ 2 Lj', hl: true }],
    cap: 'Maßstäblich: M43 ist eine eigene kleine Blase, zwölfmal kleiner als der Hauptnebel, ionisiert von nur einem Stern.',
    s: ['odell-2001'],
  },
  'orion.bnkl': {
    k: 'bars', alt: 'Geschwindigkeiten nach dem Zerfall des jungen Sternsystems in der BN/KL-Region',
    groups: [{ t: 'Geschwindigkeit', u: 'km/s', items: [
      { l: 'Gasausläufer', v: 150, t: 'bis 150', hl: true }, { l: 'BN-Objekt', v: 29, t: '≈ 29' }, { l: 'Quelle I', v: 13, t: '≈ 13' },
    ] }],
    cap: 'Vor rund 500 Jahren flogen BN und Quelle I aus einem Punkt auseinander; über hundert Gasausläufer schießen seitdem nach allen Seiten (ALMA). Freigesetzt wurden rund 10⁴¹ J.',
    s: ['bally-2017'],
  },
  'orion.sho': {
    k: 'range', min: 480, max: 680, step: 50, u: 'nm', alt: 'Wellenlängen von Sauerstoff, Wasserstoff und Schwefel und ihre Farben in der Hubble-Palette',
    marks: [{ v: 500.7, t: '501 nm', l: '[O III] → blau' }, { v: 656.3, t: '656 nm', l: 'Hα → grün' }, { v: 672, t: '672 nm', l: '[S II] → rot' }],
    cap: 'Hα und [S II] liegen nur 16 nm auseinander und sehen fast gleich rot aus. Die Hubble-Palette färbt sie grün und rot, Sauerstoff blau – so wird die Schichtung sichtbar.',
    s: ['odell-2009'],
  },

  // ---------- 05 Krebsnebel ----------
  'crab.filaments': {
    k: 'bars', alt: 'Masse des Vorläufersterns, der Filamente und der noch fehlenden Masse im Krebsnebel',
    groups: [{ t: 'Masse', u: 'Sonnenmassen', items: [
      { l: 'Vorläuferstern', v: 9, t: '8–10' }, { l: 'Filamente', v: 4.6, t: '4,6 ± 1,8', hl: true }, { l: 'Fehlt noch', v: 4, t: '≈ 4' },
    ] }],
    cap: 'Für einen Vorläufer von 10 Sonnenmassen fehlen nach Abzug von Filamenten und Neutronenstern noch rund 4 Sonnenmassen – vermutlich in einer unsichtbaren Hülle.',
    s: ['nomoto-1982', 'fesen-1997'],
  },
  'crab.sync': {
    k: 'bars', alt: 'Leistung, die der Crab-Pulsar beim Abbremsen abgibt, im Vergleich zur Sonne',
    groups: [{ t: 'Leistung', u: 'Sonnen', items: [{ l: 'Pulsar', v: 4.5e31 / 3.828e26, t: '≈ 120.000', hl: true }, { l: 'Sonne', v: 1, t: '1' }] }],
    cap: 'Der Pulsar verliert beim Abbremsen 4,5 · 10³¹ W – so viel, wie rund 120.000 Sonnen abstrahlen (eigene Rechnung). Diese Leistung hält den Synchrotronnebel zum Leuchten.',
    s: ['atnf', 'nasa-sun'],
  },
  'crab.wisps': {
    k: 'bars', alt: 'Geschwindigkeit der Wisps im Vergleich zum Licht und zu den Filamenten',
    groups: [{ t: 'Geschwindigkeit', u: 'Tsd. km/s', items: [
      { l: 'Licht', v: C / 1e6, t: '300' }, { l: 'Wisps', v: 150, t: '≈ 150', hl: true }, { l: 'Filamente', v: 1.5, t: '1,5' },
    ] }],
    cap: 'Die Wisps wandern mit etwa halber Lichtgeschwindigkeit vom Pulsar nach außen – hundertmal schneller als die Filamente am Rand.',
    s: ['hester-2008'],
  },
  'crab.expansion': {
    k: 'timeline', alt: 'Zeitleiste des Krebsnebels von der Supernova 1054 bis heute',
    items: [
      { d: 1054, t: '1054', l: 'Supernova', l2: 'am Taghimmel' },
      { d: 1130, t: '1130 ± 16', l: 'Filamente laufen', l2: 'rückgerechnet zusammen', hl: true },
      { d: 2026, t: 'heute', l: 'Nebel 13 × 9 Lj', l2: '≈ 1.500 km/s' },
    ],
    cap: 'Rückgerechnet treffen sich die Filamente erst um 1130, 76 Jahre nach der Explosion: Der Druck des Pulsarwinds hat die Hülle seitdem beschleunigt.',
    s: ['hester-2008', 'nugent-1998', 'buhler-2014'],
  },
  'crab.xray': ELECTRONS('xray'),
  'crab.radio': ELECTRONS('radio'),

  // ---------- 06 Crab-Pulsar ----------
  'pulsar.star': {
    k: 'scale', h: 110, alt: 'Neutronenstern und Marsmond Phobos maßstäblich nebeneinander',
    items: [{ l: 'Neutronenstern', a: 25.4, t: 'Ø ≈ 25 km', hl: true }, { l: 'Phobos', a: 27, b: 22, t: '27 × 22 km' }],
    cap: 'Maßstäblich: So groß wie der Marsmond Phobos – aber mit rund 1,4 Sonnenmassen. Radius 12,7 km nach NICER (an einem ähnlichen Neutronenstern gemessen).',
    s: ['nicer-2019', 'nasa-phobos'],
  },
  'pulsar.beam': {
    k: 'range', min: 0, max: 90, step: 15, u: 'Grad zur Drehachse', alt: 'Neigung der Magnetachse und der Sichtlinie zur Drehachse des Crab-Pulsars',
    marks: [{ v: 45, t: '≈ 45°', l: 'Magnetachse' }, { v: 61.3, t: '≈ 61°', l: 'Blick zur Erde' }],
    cap: 'Die Magnetachse ist nach Modellen um rund 45° gegen die Drehachse geneigt (umstritten), unsere Sichtlinie um rund 61° (aus der Form des Torus). Der Kegel trifft uns, weil er breiter ist als der Unterschied.',
    s: ['buhler-2014', 'ng-2004'],
  },
  'pulsar.lc': {
    k: 'scale', h: 84, alt: 'Lichtzylinder des Crab-Pulsars maßstäblich neben Mond und Erde',
    items: [
      { l: 'Neutronenstern', a: 2 * R_NS, t: 'Ø 26 km' },
      { l: 'Lichtzylinder', a: 2 * R_LC, t: `Ø ${fmt(Math.round(2 * R_LC / 10) * 10)} km`, hl: true },
      { l: 'Mond', a: 3474.8, t: 'Ø 3.475 km' },
      { l: 'Erde', a: 12742, t: 'Ø 12.742 km' },
    ],
    cap: 'Maßstäblich: Der Lichtzylinder (R = c·P/2π, eigene Rechnung) ist knapp so groß wie der Mond – der Neutronenstern darin ist nur ein Punkt.',
    s: ['atnf', 'nasa-moon', 'nasa-earth'],
  },
  'pulsar.field': {
    k: 'bars', alt: 'Magnetfeld des Crab-Pulsars im Vergleich zum Erdfeld und zum stärksten Dauermagneten im Labor, logarithmisch',
    groups: [{ t: 'Magnetfeld', u: 'Tesla, logarithmisch', items: [
      { l: 'Erde', v: LG(3.1e-5, 6), t: '0,00003' }, { l: 'Labor-Rekord', v: LG(45.5, 6), t: '45,5' }, { l: 'Crab-Pulsar', v: LG(3.8e8, 6), t: '380 Mio.', hl: true },
    ] }],
    cap: `Balken logarithmisch, jeder Schritt eine Zehnerpotenz. Das Feld des Pulsars ist rund ${fmt(Math.round(3.8e8 / 3.1e-5 / 1e12))} Billionen-mal so stark wie das der Erde und zehn Millionen-mal stärker als jeder Magnet im Labor (eigene Rechnung).`,
    s: ['nasa-earth', 'hahn-2019', 'atnf'],
  },
  'pulsar.wind': WIND('wind'),
  'pulsar.jet': WIND('jet'),
  'pulsar.polecap': {
    k: 'bars', alt: 'Durchmesser der Polkappe des Crab-Pulsars im Vergleich zu einem Pulsar mit einer Sekunde Periode',
    groups: [{ t: 'Polkappe (Ø)', u: 'km', items: [
      { l: 'Crab-Pulsar', v: capD(P), t: fmt(capD(P), 1), hl: true }, { l: 'Pulsar mit 1 s', v: capD(1), t: fmt(capD(1), 1) },
    ] }],
    cap: 'Fußfläche der offenen Feldlinien im Dipol-Modell: r = R·√(R/R_LC) mit R = 13 km (eigene Rechnung). Je schneller ein Pulsar dreht, desto größer die Kappe; bei einer Sekunde Periode misst sie nur gut 400 m.',
    s: ['atnf', 'nicer-2019'],
  },
  'pulsar.interpulse': {
    k: 'range', min: 0, max: 1, step: 0.25, u: 'Perioden', alt: 'Lage von Hauptpuls und Zwischenpuls innerhalb einer Drehung des Pulsars',
    marks: [{ v: 0, t: '0', l: 'Hauptpuls' }, { v: 0.4, t: '0,4', l: 'Zwischenpuls' }, { v: 1, t: '1', l: 'nächster Hauptpuls' }],
    cap: `Pulsphase in Perioden: Der Zwischenpuls folgt 0,4 Perioden (${fmt(0.4 * P * 1e3, 1)} ms, eigene Rechnung) nach dem Hauptpuls – nicht nach einer halben Drehung, die Strahlkegel stehen nicht genau gegenüber.`,
    s: ['buhler-2014', 'atnf'],
  },

  // ---------- 07 Sagittarius A* ----------
  'sgra.shadow': {
    k: 'scale', h: 120, alt: 'Ereignishorizont und Schatten von Sagittarius A* maßstäblich neben der Merkurbahn',
    items: [
      { l: 'Horizont', a: 2 * RS / 1e9, t: `Ø ${fmt(2 * RS / 1e9)} Mio. km` },
      { l: 'Schatten', a: SHADOW / 1e9, t: `Ø ${fmt(SHADOW / 1e9)} Mio. km`, hl: true },
      { l: 'Merkurbahn', a: 2 * 57.909, t: 'Ø 116 Mio. km' },
    ],
    cap: 'Maßstäblich: Der Schatten (√27 Schwarzschild-Radien, eigene Rechnung aus der Masse) ist gut halb so groß wie die Bahn des Merkur um die Sonne.',
    s: ['gravity-2022', 'nasa-planets'],
  },
  'sgra.photon': {
    k: 'range', min: 35, max: 54, step: 5, u: 'Mikrobogensekunden', alt: 'Gemessener Ring von Sagittarius A* und M87* im Vergleich zum berechneten Schatten',
    marks: [
      { v: 42, t: '42 ± 3', l: 'M87*' },
      { v: 51.8, t: '51,8 ± 2,3', l: 'Ring Sgr A*' },
      { v: microArcsec(SHADOW, 8.277 * KPC), t: fmt(microArcsec(SHADOW, 8.277 * KPC)), l: 'Schatten (Rechnung)', ref: true },
    ],
    cap: 'Größe am Himmel: Der gemessene Ring passt zum Schatten, der aus Masse und Abstand folgt (eigene Rechnung). M87* ist 1.500-mal schwerer, aber 2.000-mal weiter entfernt und erscheint daher etwas kleiner.',
    s: ['eht-2022', 'eht-2019', 'gravity-2022'],
  },
  'sgra.doppler': {
    k: 'bars', alt: 'Helligkeit von Gas mit halber Lichtgeschwindigkeit auf uns zu und von uns weg',
    groups: [{ t: 'Helligkeit', u: 'ruhendes Gas = 1', items: [
      { l: 'Auf uns zu', v: DOP(0.5), t: fmt(DOP(0.5)), hl: true }, { l: 'Ruhendes Gas', v: 1, t: '1' }, { l: 'Von uns weg', v: DOP(-0.5), t: fmt(DOP(-0.5), 2) },
    ] }],
    cap: 'Gas mit halber Lichtgeschwindigkeit: auf uns zu erscheint es neunmal heller, von uns weg nur ein Neuntel so hell (Doppler-Faktor hoch vier, eigene Rechnung).',
    s: ['eht-2019'],
  },
  'sgra.isco': {
    k: 'scale', h: 110, alt: 'Ereignishorizont, Photonenbahn, Schatten und innerste stabile Bahn maßstäblich in Schwarzschild-Radien',
    items: [
      { l: 'Horizont', a: 2, t: '2 Rs' }, { l: 'Photonenbahn', a: 3, t: '3 Rs' },
      { l: 'Schatten', a: Math.sqrt(27), t: `${fmt(Math.sqrt(27), 1)} Rs` }, { l: 'Innerste Bahn', a: 6, t: '6 Rs', hl: true },
    ],
    cap: `Durchmesser in Schwarzschild-Radien (Rs = 12,7 Mio. km). Auf der innersten stabilen Bahn dauert ein Umlauf rund ${fmt(ISCO_MIN)} Minuten (eigene Rechnung, Kepler).`,
    s: ['eht-2019', 'gravity-2022'],
  },
  'sgra.s2': {
    k: 'bars', alt: 'Größter und kleinster Abstand des Sterns S2 von Sagittarius A* im Vergleich zum Abstand Neptun–Sonne',
    groups: [{ t: 'Abstand', u: 'AE', items: [
      { l: 'Apozentrum', v: S2.a * (1 + S2.e), t: `≈ ${fmt(Math.round(S2.a * (1 + S2.e) / 10) * 10)}` },
      { l: 'Perizentrum', v: S2.a * (1 - S2.e), t: `≈ ${fmt(Math.round(S2.a * (1 - S2.e) / 10) * 10)}`, hl: true },
      { l: 'Neptun–Sonne', v: 30.07, t: '30' },
    ] }],
    cap: `S2 läuft auf einer langgestreckten Ellipse: am fernsten Punkt ${fmt((1 + S2.e) / (1 - S2.e))}-mal so weit vom Loch wie am nächsten (eigene Rechnung aus Halbachse und Exzentrizität). Selbst das Perizentrum liegt viermal so weit wie Neptun von der Sonne.`,
    s: ['gravity-2020', 'nasa-planets'],
  },
  'sgra.peri': {
    k: 'range', min: 0, max: 1.5, step: 0.5, u: '', alt: 'Messungen am Stern S2 im Verhältnis zur Vorhersage der Relativitätstheorie',
    span: [0.91, 1.29], spanL: 'Präzession 2020',
    marks: [{ v: 0, t: '0', l: 'Newton', ref: true }, { v: 0.9, t: '0,90', l: 'Rotverschiebung 2018' }],
    cap: 'Messwert geteilt durch die Vorhersage der Allgemeinen Relativitätstheorie (1) – Newton ergäbe 0. Rotverschiebung 2018: 0,90 ± 0,09 ± 0,15; Periheldrehung 2020: 1,10 ± 0,19. Beide passen zur Relativitätstheorie.',
    s: ['gravity-2018', 'gravity-2020'],
  },
  'sgra.flare': {
    k: 'bars', alt: 'Geschwindigkeit des Flare-Flecks im Vergleich zu S2 im Perizentrum und zur Erde',
    groups: [{ t: 'Anteil der Lichtgeschw.', u: '%', items: [
      { l: 'Flare-Fleck', v: 30, t: '30', hl: true }, { l: 'S2 (Perizentrum)', v: 7650e3 / C * 100, t: fmt(7650e3 / C * 100, 1) },
      { l: 'Erde um Sonne', v: 29.78e3 / C * 100, t: fmt(29.78e3 / C * 100, 2) },
    ] }],
    cap: 'Der Fleck umrundete das Loch 2018 in rund 45 Minuten mit 30 % der Lichtgeschwindigkeit – zwölfmal so schnell wie S2 an seinem nächsten Punkt (eigene Rechnung).',
    s: ['gravity-2018b', 'gravity-2020', 'nasa-earth'],
  },
  'sgra.cluster': {
    k: 'bars', alt: 'Mittlerer Abstand zum nächsten Stern im Zentralhaufen im Vergleich zur Umgebung der Sonne',
    groups: [{ t: 'Abstand zum Nachbarn', u: 'Tsd. AE', items: [
      { l: 'Zentralhaufen', v: NEAR_AU / 1e3, t: `≈ ${fmt(NEAR_AU / 1e3, 1)}`, hl: true }, { l: 'Sonne', v: 1.30 * 206264.806 / 1e3, t: fmt(1.30 * 206.264806) },
    ] }],
    cap: `Eigene Rechnung: eine Million Sonnenmassen im Umkreis von 1 pc, Sterne zu je einer Sonnenmasse gleich verteilt – der Nachbar stünde rund ${fmt(Math.round(1.30 * 206264.806 / NEAR_AU / 10) * 10)}-mal näher als Proxima Centauri bei uns (1,30 pc).`,
    s: ['genzel-2010', 'hipparcos'],
  },

  // ---------- 08 Lokale Gruppe ----------
  'local.m31': SKY_LG('m31'),
  'local.m33': SKY_LG('m33'),
  'local.lmc': {
    k: 'bars', alt: 'Entfernung der Magellanschen Wolken im Vergleich zum Durchmesser der Milchstraße',
    groups: [{ t: 'Entfernung', u: 'Tsd. Lj', items: [
      { l: 'Große Wolke', v: 160, t: '160', hl: true }, { l: 'Kleine Wolke', v: 200, t: '200', hl: true }, { l: 'Milchstraße (Ø)', v: 100, t: '≈ 100' },
    ] }],
    cap: 'Beide Wolken stehen weiter von uns entfernt, als die Milchstraße breit ist – nah genug, dass die Milchstraße Gas aus ihnen herauszieht.',
    s: ['mcconnachie-2012', 'bland-2016'],
  },
  'local.bound': {
    k: 'range', min: 0, max: 4, step: 1, u: 'Mio. Lj', alt: 'Abstände von Milchstraße und Andromeda vom Schwerpunkt der Lokalen Gruppe und Grenze der Gruppe',
    span: [0, 3.3], spanL: 'gebunden',
    marks: [{ v: BARY, t: fmt(BARY, 1), l: 'Milchstraße' }, { v: 3.3, t: '3,3', l: 'Grenze', ref: true }],
    cap: `Abstand vom Schwerpunkt der Gruppe (eigene Rechnung aus 1,2 und 1,5 Billionen Sonnenmassen); Andromeda steht ${fmt(D_M31 - BARY, 1)} Mio. Lj auf der anderen Seite. Bis rund 3,3 Mio. Lj hält die Schwerkraft der Gruppe die Galaxien zusammen, weiter draußen gewinnt die kosmische Expansion.`,
    s: ['mcconnachie-2012', 'vdmarel-2012', 'li-2021'],
  },
  'local.future': {
    k: 'timeline', alt: 'Zeitleiste der möglichen Begegnung von Milchstraße und Andromeda',
    items: [
      { d: 0, t: 'heute', l: 'Abstand 2,5 Mio. Lj', l2: 'Annäherung 109 km/s' },
      { d: 3.87, t: '+ 3,9 Mrd.', l: 'erster Vorbeiflug', l2: 'Modell 2012' },
      { d: 5.86, t: '+ 5,9 Mrd.', l: 'Verschmelzung', l2: 'Modell 2012' },
      { d: 10, t: '+ 10 Mrd.', l: 'Chance nur ≈ 50 %', l2: 'neue Daten 2025', hl: true },
    ],
    cap: 'Van der Marel et al. 2012 sagten den ersten Vorbeiflug in 3,9 und die Verschmelzung in 5,9 Mrd. Jahren voraus. Mit Gaia- und Hubble-Daten liegt die Chance einer Verschmelzung in 10 Mrd. Jahren nur bei etwa 50 %.',
    s: ['vdmarel-2012', 'sawala-2025', 'li-2021'],
  },

  // ---------- 09 Kosmisches Netz ----------
  'web.virgo': CLUSTERS('virgo'),
  'web.fornax': CLUSTERS('fornax'),
  'web.centaurus': CLUSTERS('centaurus'),
  'web.hydra': CLUSTERS('hydra'),
  'web.coma': CLUSTERS('coma'),
  'web.hercules': CLUSTERS('hercules'),
  'web.shapley': CLUSTERS('shapley'),
  'web.perseus': STRUCT('perseus'),
  'web.flow': STRUCT('flow'),
  'web.void': {
    k: 'bars', alt: 'Anteil der Leerräume am Volumen und an der Masse des Universums',
    groups: [
      { t: 'Anteil am Volumen', u: '%', items: [{ l: 'Leerräume', v: 77, hl: true }, { l: 'übriges Netz', v: 23 }] },
      { t: 'Anteil an der Masse', u: '%', items: [{ l: 'Leerräume', v: 15, hl: true }, { l: 'übriges Netz', v: 85 }] },
    ],
    cap: 'Leerräume füllen gut drei Viertel des Raums, enthalten aber nur 15 % der Masse; der Rest sitzt in Wänden, Fäden und Knoten.',
    s: ['cautun-2014'],
  },
  'web.ga': {
    k: 'bars', alt: 'Geschwindigkeit der Sonne gegenüber der Hintergrundstrahlung im Vergleich zu anderen Bewegungen',
    groups: [{ t: 'Geschwindigkeit', u: 'km/s', items: [
      { l: 'Sonne, kosmisch', v: 369.8, t: '370', hl: true }, { l: 'Sonne um Zentrum', v: 229, t: '229' },
      { l: 'Andromeda', v: 109, t: '109' }, { l: 'Erde um Sonne', v: 29.78, t: '29,8' },
    ] }],
    cap: 'Gegenüber der Hintergrundstrahlung („kosmisch“) bewegt sich die Sonne mit 370 km/s – ein Teil davon ist der Zug der ganzen Umgebung zum Großen Attraktor. Andromeda kommt mit 109 km/s auf uns zu.',
    s: ['planck-2018-1', 'eilers-2019', 'vdmarel-2012', 'nasa-earth'],
  },

  // ---------- 10 Beobachtbares Universum ----------
  'cmb.cmb': {
    k: 'bars', alt: 'Temperatur der Hintergrundstrahlung beim Aussenden und heute',
    groups: [{ t: 'Temperatur', u: 'K', items: [
      { l: 'beim Aussenden', v: cosmo(1090).T, t: `≈ ${fmt(Math.round(cosmo(1090).T / 10) * 10)}`, hl: true }, { l: 'heute', v: 2.7255, t: '2,7255' },
    ] }],
    cap: 'Die Ausdehnung um den Faktor 1.091 hat das Licht von rund 3.000 K auf 2,7 K abgekühlt (T = T₀ · (1 + z), eigene Rechnung).',
    s: ['planck-2018', 'fixsen-2009'],
  },
  'cmb.firststars': EPOCHS('firststars'),
  'cmb.dawn': EPOCHS('dawn'),
  'cmb.reion': EPOCHS('reion'),
  'cmb.noon': {
    k: 'bars', alt: 'Sternentstehungsrate im Universum zu verschiedenen Zeiten im Vergleich zu heute',
    groups: [{ t: 'Sternentstehung', u: 'heute = 1', items: [0, 1, 2, 4, 6].map((z) => ({ l: lookT(z), v: sfr(z) / sfr(0), t: fmt(sfr(z) / sfr(0), 1), hl: z === 2 })) }],
    cap: `Neu entstehende Sterne je Volumen nach der Kurve von Madau & Dickinson 2014: am meisten um z ≈ 2, rund ${fmt(sfr(2) / sfr(0))}-mal so viel wie heute (eigene Rechnung aus der Formel).`,
    s: ['madau-2014', 'planck-2018'],
  },
  'cmb.darkenergy': {
    k: 'bars', alt: 'Anteile von Dunkler Energie, Dunkler Materie und normaler Materie an der Energiedichte heute',
    groups: [{ t: 'Energiedichte heute', u: '%', items: [
      { l: 'Dunkle Energie', v: COSMO.OL * 100, t: fmt(COSMO.OL * 100, 1), hl: true },
      { l: 'Dunkle Materie', v: (COSMO.Om - OB) * 100, t: fmt((COSMO.Om - OB) * 100, 1) },
      { l: 'Normale Materie', v: OB * 100, t: fmt(OB * 100, 1) },
    ] }],
    cap: `Die Materie verdünnt sich mit der Ausdehnung, die Dunkle Energie nicht: Seit z ≈ ${fmt(Math.cbrt(COSMO.OL / COSMO.Om) - 1, 1)} überwiegt sie (eigene Rechnung aus den Planck-2018-Werten).`,
    s: ['planck-2018'],
  },
  'cmb.hubble': {
    k: 'range', min: 64, max: 76, step: 2, u: 'km/s pro Mpc', alt: 'Hubble-Konstante aus der Hintergrundstrahlung und aus Cepheiden und Supernovae',
    marks: [{ v: 67.66, t: '67,7 ± 0,4', l: 'Planck 2018' }, { v: 73.04, t: '73,0 ± 1,0', l: 'SH0ES 2022' }],
    cap: `Zwei Messwege, zwei Werte: Der Unterschied ist rund ${fmt((73.04 - 67.66) / Math.hypot(1.04, 0.42))}-mal so groß wie die Messfehler zusammen (eigene Rechnung) – bisher ungeklärt.`,
    s: ['planck-2018', 'riess-2022'],
  },
  'cmb.probe': {
    k: 'bars', alt: 'Heutiger Abstand einer Lichtquelle je nach Laufzeit ihres Lichts',
    groups: [{ t: 'Abstand heute', u: 'Mrd. Lj', items: PROBE.map(({ t, d }) => ({ l: `${fmt(t, t % 1 ? 1 : 0)} Mrd. Jahre`, v: d, t: fmt(d, 1), hl: t === 10 })) }],
    cap: `Licht, das 10 Mrd. Jahre unterwegs war, kommt von einer Quelle, die heute ${fmt(PROBE[2].d)} Mrd. Lj entfernt ist: Der Raum hat sich unterwegs gedehnt (eigene Rechnung, ΛCDM mit Planck-2018-Werten).`,
    s: ['planck-2018'],
  },
};
