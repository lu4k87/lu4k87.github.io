// Alle Texte, Kennzahlen und Quellen der Reise. Stationen bilden einen Baum (parent = nächstgrößere Station), ROUTE ist
// die Reihenfolge der geführten Reise (nach Entfernung von der Erde). Jede Zahl hat eine Quelle in SOURCES
// (Kürzel in `s`) oder ist als „Modell“ bzw. „Richtwert“ gekennzeichnet; Belege und Herleitungen: docs/research.md.

import { LY, YEAR, KPC, AU, C } from './astro.js';

export const SOURCES = {
  'celestrak': { t: 'GP Element Sets (OMM): Gruppen active, stations, Trümmerwolken – Stand 25.10.2026', by: 'CelesTrak, T. S. Kelso', url: 'https://celestrak.org/NORAD/elements/' },
  'esa-debris': { t: 'Space debris by the numbers (Modellschätzung kleiner Teile)', by: 'ESA Space Debris Office', url: 'https://www.esa.int/Space_Safety/Space_Debris/Space_debris_by_the_numbers' },
  'noaa-aurora': { t: 'Tips on Viewing the Aurora (Kp-Index und Sichtbarkeit nach Breite)', by: 'NOAA Space Weather Prediction Center', url: 'https://www.swpc.noaa.gov/content/tips-viewing-aurora' },
  'nasa-aurora': { t: 'Auroras: Lights in the Sky (Höhen, Farben, Ursache)', by: 'NASA Science', url: 'https://science.nasa.gov/sun/auroras/' },
  'wdc-poles': { t: 'Geomagnetic North Pole 2025 (IGRF-14): 80,8° N, 72,8° W', by: 'WDC for Geomagnetism, Kyoto', url: 'https://wdc.kugi.kyoto-u.ac.jp/poles/polesexp.html' },
  'nasa-sun-facts': { t: 'Sun: Facts (Korona, Zyklus, Aufbau)', by: 'NASA Science', url: 'https://science.nasa.gov/sun/facts/' },
  'snodgrass-1990': { t: 'Rotation of Doppler features in the solar photosphere (differentielle Rotation)', by: 'Snodgrass & Ulrich 1990, ApJ 351, 309', url: 'https://doi.org/10.1086/168467' },
  'nordlund-2009': { t: 'Solar Surface Convection (Granulen ≈ 1.000 km, ≈ 10 min)', by: 'Nordlund, Stein & Asplund 2009, Living Rev. Solar Phys. 6, 2', url: 'https://doi.org/10.12942/lrsp-2009-2' },
  'nasa-solarmax': { t: 'NASA, NOAA: Sun Reaches Maximum Phase in 11-Year Solar Cycle', by: 'NASA, 15.10.2024', url: 'https://science.nasa.gov/science-research/heliophysics/nasa-noaa-sun-reaches-maximum-phase-in-11-year-solar-cycle/' },
  'swpc-flares': { t: 'Solar Flares (Radio Blackouts): Klassen A bis X', by: 'NOAA Space Weather Prediction Center', url: 'https://www.swpc.noaa.gov/phenomena/solar-flares-radio-blackouts' },
  'swpc-cme': { t: 'Coronal Mass Ejections (250 bis 3.000 km/s)', by: 'NOAA Space Weather Prediction Center', url: 'https://www.swpc.noaa.gov/phenomena/coronal-mass-ejections' },
  'nasa-moons': { t: 'Moons of Our Solar System (Anzahl je Planet)', by: 'NASA Science', url: 'https://science.nasa.gov/solar-system/moons/' },
  'nasa-earth': { t: 'Earth Fact Sheet', by: 'NASA NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html' },
  'nasa-moon': { t: 'Moon Fact Sheet', by: 'NASA NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html' },
  'nasa-sun': { t: 'Sun Fact Sheet', by: 'NASA NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html' },
  'nasa-planets': { t: 'Planetary Fact Sheet', by: 'NASA NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/' },
  'nasa-saturn': { t: 'Saturnian Rings Fact Sheet', by: 'NASA NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html' },
  'heic1613': { t: 'Hubble captures vivid auroras in Jupiter’s atmosphere (dauerhaft, größer als die Erde, hunderte Male energiereicher)', by: 'ESA/Hubble 2016, heic1613', url: 'https://esahubble.org/news/heic1613/' },
  'jpl-elements': { t: 'Approximate Positions of the Planets (Keplerian Elements)', by: 'E. M. Standish, JPL', url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html' },
  'iau-2012': { t: 'Resolution B2: Re-definition of the astronomical unit', by: 'IAU 2012', url: 'https://www.iau.org/static/resolutions/IAU2012_English.pdf' },
  'llr': { t: 'Lunar Laser Ranging: 3,8 cm/Jahr', by: 'Williams & Boggs 2016, Celest. Mech. Dyn. Astron. 126', url: 'https://doi.org/10.1007/s10569-016-9702-3' },
  'shepard-2021': { t: 'Asteroid 16 Psyche: Shape, Features, and Global Map (278 × 238 × 171 km, Dichte 4,0 g/cm³, Senken)', by: 'Shepard et al. 2021, Planet. Sci. J. 2 (4)', url: 'https://doi.org/10.3847/PSJ/abfdba' },
  'nasa-psyche': { t: '16 Psyche: Größe, Metallanteil, Start der Sonde 13.10.2023, Mission am Asteroiden ab August 2029', by: 'NASA Science', url: 'https://science.nasa.gov/solar-system/asteroids/16-psyche/' },
  'nasa-bennu': { t: '101955 Bennu: Probennahme am 20.10.2020', by: 'NASA Science', url: 'https://science.nasa.gov/solar-system/asteroids/101955-bennu/' },
  'nasa-osirisrex': { t: 'OSIRIS-REx: 121,6 g Probe von Bennu, Landung der Kapsel am 24.09.2023', by: 'NASA Science', url: 'https://science.nasa.gov/mission/osiris-rex/' },
  'barnouin-2019': { t: 'Shape of (101955) Bennu indicative of a rubble pile with internal stiffness', by: 'Barnouin et al. 2019, Nature Geoscience 12, 247', url: 'https://doi.org/10.1038/s41561-019-0330-x' },
  'lauretta-2019': { t: 'Episodes of particle ejection from the surface of the active asteroid (101955) Bennu', by: 'Lauretta et al. 2019, Science 366', url: 'https://doi.org/10.1126/science.aay3544' },
  'nasa-eros': { t: '433 Eros: S-Typ; NEAR Shoemaker in der Umlaufbahn ab 14.02.2000, Landung 12.02.2001', by: 'NASA Science', url: 'https://science.nasa.gov/solar-system/asteroids/433-eros/' },
  'nssdc-asteroids': { t: 'Asteroid Fact Sheet: Eros 33 × 13 × 13 km, 5,27 h; Bennu 0,49 km', by: 'NASA NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/asteroidfact.html' },
  'kirkwood': { t: 'Kirkwood-Lücken und Resonanzen', by: 'NASA JPL Solar System Dynamics', url: 'https://ssd.jpl.nasa.gov/diagrams/mb_hist.html' },
  'gravity-2019': { t: 'Geometric distance to the Galactic Centre', by: 'GRAVITY Collaboration 2019, A&A 625, L10', url: 'https://doi.org/10.1051/0004-6361/201935656' },
  'gravity-2022': { t: 'Mass distribution in the Galactic Centre (multiple stellar orbits)', by: 'GRAVITY Collaboration 2022, A&A 657, L12', url: 'https://doi.org/10.1051/0004-6361/202142465' },
  'gravity-2018': { t: 'Detection of gravitational redshift in the orbit of S2', by: 'GRAVITY Collaboration 2018, A&A 615, L15', url: 'https://doi.org/10.1051/0004-6361/201833718' },
  'gravity-2020': { t: 'Detection of the Schwarzschild precession in the orbit of S2', by: 'GRAVITY Collaboration 2020, A&A 636, L5', url: 'https://doi.org/10.1051/0004-6361/202037813' },
  'eilers-2019': { t: 'The circular velocity curve of the Milky Way', by: 'Eilers et al. 2019, ApJ 871, 120', url: 'https://doi.org/10.3847/1538-4357/aaf648' },
  'wegg-2015': { t: 'The structure of the Milky Way’s bar outside the bulge', by: 'Wegg, Gerhard & Portail 2015, MNRAS 450', url: 'https://doi.org/10.1093/mnras/stv745' },
  'bennett-2019': { t: 'Vertical waves in the solar neighbourhood (Höhe der Sonne)', by: 'Bennett & Bovy 2019, MNRAS 482, 1417', url: 'https://doi.org/10.1093/mnras/sty2813' },
  'maiz-2022': { t: 'Villafranca II: Gaia-Entfernung des Orion-Nebel-Haufens', by: 'Maíz Apellániz et al. 2022, A&A 657, A131', url: 'https://doi.org/10.1051/0004-6361/202142364' },
  'odell-2009': { t: 'The three-dimensional structure of the Orion Nebula', by: "O'Dell et al. 2009, AJ 137, 367", url: 'https://doi.org/10.1088/0004-6256/137/1/367' },
  'simon-2006': { t: 'Parameters of θ¹ Ori C', by: 'Simón-Díaz et al. 2006, A&A 448, 351', url: 'https://ui.adsabs.harvard.edu/abs/2006A%26A...448..351S' },
  'ricci-2008': { t: 'The HST/ACS atlas of protoplanetary disks in the Orion Nebula', by: 'Ricci, Robberto & Soderblom 2008, AJ 136, 2136', url: 'https://arxiv.org/abs/0808.3336' },
  'lin-2023': { t: 'Entfernung des Crab-Pulsars (VLBI)', by: 'Lin et al. 2023, ApJ 952, 161', url: 'https://doi.org/10.3847/1538-4357/acdc98' },
  'buhler-2014': { t: 'The surprising Crab pulsar and its nebula: a review', by: 'Bühler & Blandford 2014, Rep. Prog. Phys. 77', url: 'https://arxiv.org/abs/1309.7046' },
  'nicer-2019': { t: 'A NICER view of PSR J0030+0451 (Radius ≈ 12,7 km)', by: 'Riley et al. 2019, ApJL 887, L21', url: 'https://doi.org/10.3847/2041-8213/ab481c' },
  'li-2021': { t: 'Entfernung von M31 (Cepheiden, HST)', by: 'Li et al. 2021, ApJ 920, 84', url: 'https://doi.org/10.3847/1538-4357/ac1597' },
  'cautun-2014': { t: 'Evolution of the cosmic web (Anteile von Knoten, Fäden, Wänden, Leerräumen)', by: 'Cautun et al. 2014, MNRAS 441, 2923', url: 'https://doi.org/10.1093/mnras/stu768' },
  'reid-2019': { t: 'Trigonometric parallaxes of high-mass star forming regions', by: 'Reid et al. 2019, ApJ 885, 131', url: 'https://doi.org/10.3847/1538-4357/ab4a11' },
  'bland-2016': { t: 'The Galaxy in context', by: 'Bland-Hawthorn & Gerhard 2016, ARA&A 54', url: 'https://doi.org/10.1146/annurev-astro-081915-023441' },
  'menten-2007': { t: 'Distance to the Orion Nebula (VLBA, 414 pc)', by: 'Menten et al. 2007, A&A 474, 515', url: 'https://doi.org/10.1051/0004-6361:20078247' },
  'odell-2001': { t: 'The Orion Nebula and its associated population', by: "O'Dell 2001, ARA&A 39", url: 'https://doi.org/10.1146/annurev.astro.39.1.99' },
  'hester-2008': { t: 'The Crab Nebula: an astrophysical chimera', by: 'Hester 2008, ARA&A 46', url: 'https://doi.org/10.1146/annurev.astro.45.051806.110608' },
  'atnf': { t: 'ATNF Pulsar Catalogue (PSR B0531+21)', by: 'Manchester et al. 2005, AJ 129', url: 'https://www.atnf.csiro.au/research/pulsar/psrcat/' },
  'jodrell': { t: 'Jodrell Bank Crab Pulsar Monthly Ephemeris', by: 'Lyne et al., Univ. Manchester', url: 'https://www.jb.man.ac.uk/pulsar/crab.html' },
  'eht-2022': { t: 'First Sagittarius A* EHT Results I', by: 'EHT Collaboration 2022, ApJL 930, L12', url: 'https://doi.org/10.3847/2041-8213/ac6674' },
  'eht-2019': { t: 'First M87 EHT Results I', by: 'EHT Collaboration 2019, ApJL 875, L1', url: 'https://doi.org/10.3847/2041-8213/ab0ec7' },
  'mcconnachie-2012': { t: 'The observed properties of dwarf galaxies in and around the Local Group', by: 'McConnachie 2012, AJ 144, 4', url: 'https://doi.org/10.1088/0004-6256/144/1/4' },
  'vdmarel-2012': { t: 'The M31 velocity vector III: future evolution', by: 'van der Marel et al. 2012, ApJ 753, 9', url: 'https://doi.org/10.1088/0004-637X/753/1/9' },
  'sawala-2025': { t: 'No certainty of a Milky Way–Andromeda collision', by: 'Sawala et al. 2025, Nature Astronomy', url: 'https://doi.org/10.1038/s41550-025-02563-1' },
  'tully-2014': { t: 'The Laniakea supercluster of galaxies', by: 'Tully et al. 2014, Nature 513, 71', url: 'https://doi.org/10.1038/nature13674' },
  'weygaert': { t: 'Voronoi models of the cosmic web', by: 'van de Weygaert & Icke 1989, A&A 213', url: 'https://ui.adsabs.harvard.edu/abs/1989A%26A...213....1I' },
  'planck-2018': { t: 'Planck 2018 results VI: Cosmological parameters', by: 'Planck Collaboration 2020, A&A 641, A6', url: 'https://doi.org/10.1051/0004-6361/201833910' },
  'fixsen-2009': { t: 'The temperature of the cosmic microwave background', by: 'Fixsen 2009, ApJ 707, 916', url: 'https://doi.org/10.1088/0004-637X/707/2/916' },
  'riess-2022': { t: 'A comprehensive measurement of H0 (SH0ES)', by: 'Riess et al. 2022, ApJL 934, L7', url: 'https://doi.org/10.3847/2041-8213/ac5c5b' },
  'jades-2024': { t: 'A shining cosmic dawn: JADES-GS-z14-0', by: 'Carniani et al. 2024, Nature 633', url: 'https://doi.org/10.1038/s41586-024-07860-9' },
  'kim-2002': { t: 'Planck-Kurve in der Normfarbtafel (Näherung)', by: 'Kim et al. 2002, US-Patent 7024034', url: 'https://patents.google.com/patent/US7024034' },
  'sss-tex': { t: 'Planetentexturen (CC BY 4.0, auf NASA-Daten)', by: 'Solar System Scope / INOVE', url: 'https://www.solarsystemscope.com/textures/' },
  'wcag-flash': { t: 'WCAG 2.2 – 2.3.1 Drei Blitze oder darunter', by: 'W3C 2023', url: 'https://www.w3.org/TR/WCAG22/#three-flashes-or-below-threshold' },
  'd3-celestial': { t: 'Sternkatalog (Yale Bright Star Catalogue, 5.044 Sterne bis 6 mag) und Sternbildlinien (BSD-3)', by: 'Olaf Frohn, d3-celestial', url: 'https://github.com/ofrohn/d3-celestial' },
  'hipparcos': { t: 'Hipparcos, the New Reduction (Entfernungen heller Sterne)', by: 'van Leeuwen 2007, A&A 474, 653', url: 'https://doi.org/10.1051/0004-6361:20078357' },
  'ballesteros-2012': { t: 'New insights into black bodies (B−V → Temperatur)', by: 'Ballesteros 2012, EPL 97, 34008', url: 'https://doi.org/10.1209/0295-5075/97/34008' },
  'nasa-iss': { t: 'International Space Station Facts and Figures', by: 'NASA', url: 'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/' },
  'harris-2010': { t: 'A Catalog of Parameters for Globular Clusters in the Milky Way (2010 edition)', by: 'Harris 1996/2010, AJ 112, 1487', url: 'https://physics.mcmaster.ca/~harris/mwgc.dat' },
  'su-2010': { t: 'Giant Gamma-ray Bubbles from Fermi-LAT (Fermi-Blasen)', by: 'Su, Slatyer & Finkbeiner 2010, ApJ 724, 1044', url: 'https://doi.org/10.1088/0004-637X/724/2/1044' },
  'nugent-1998': { t: 'Proper motions of the Crab Nebula filaments (Konvergenz 1130 ± 16)', by: 'Nugent 1998, PASP 110, 831', url: 'https://doi.org/10.1086/316200' },
  'bally-2017': { t: 'The ALMA view of the OMC-1 explosion in Orion (BN/KL)', by: 'Bally et al. 2017, ApJ 837, 60', url: 'https://doi.org/10.3847/1538-4357/aa5c8b' },
  'weisskopf-2000': { t: 'Chandra: Discovery of spatial and spectral structure in the Crab (Torus und Jet)', by: 'Weisskopf et al. 2000, ApJL 536, L81', url: 'https://doi.org/10.1086/312733' },
  'gravity-2018b': { t: 'Detection of orbital motions near the last stable circular orbit (Flares von Sgr A*)', by: 'GRAVITY Collaboration 2018, A&A 618, L10', url: 'https://doi.org/10.1051/0004-6361/201834294' },
  'genzel-2010': { t: 'The Galactic Center massive black hole and nuclear star cluster', by: 'Genzel, Eisenhauer & Gillessen 2010, Rev. Mod. Phys. 82', url: 'https://doi.org/10.1103/RevModPhys.82.3121' },
  'abell-1989': { t: 'A catalog of rich clusters of galaxies (Abell, Corwin, Olowin)', by: 'Abell et al. 1989, ApJS 70, 1', url: 'https://doi.org/10.1086/191333' },
  'madau-2014': { t: 'Cosmic Star-Formation History (Höhepunkt bei z ≈ 2)', by: 'Madau & Dickinson 2014, ARA&A 52', url: 'https://doi.org/10.1146/annurev-astro-081811-125615' },
  'bromm-2013': { t: 'Formation of the first stars', by: 'Bromm 2013, Rep. Prog. Phys. 76', url: 'https://doi.org/10.1088/0034-4885/76/11/112901' },
  // Einfügemarken je Etappe (Plan docs/plan_ebenen.md §2): jeder Chat fügt nur direkt unter seiner Marke ein
  // [E1] Sonne
  'sdo-channels': { t: 'HMI & AIA Channels (Kanal, Ion, Schicht, log T)', by: 'NASA Solar Dynamics Observatory', url: 'https://sdo.gsfc.nasa.gov/data/channels.php' },
  'nasa-sdo': { t: 'Solar Dynamics Observatory (SDO): Mission', by: 'NASA Science', url: 'https://science.nasa.gov/mission/sdo/' },
  'nasa-psp': { t: 'Parker Solar Probe: Mission', by: 'NASA Science', url: 'https://science.nasa.gov/mission/parker-solar-probe/' },
  // [E2] Erde nah
  // [E2] Mond
  'nasa-moon-facts': { t: 'Moon Facts (Maria, Wassereis in Polkratern, gebundene Rotation)', by: 'NASA Science', url: 'https://science.nasa.gov/moon/facts/' },
  'nasa-moon-phases': { t: 'Moon Phases (27,3 und 29,5 Tage, Libration, Erdschein)', by: 'NASA Science', url: 'https://science.nasa.gov/moon/moon-phases/' },
  'svs-libration': { t: 'Moon Phase and Libration, 2026', by: 'NASA Scientific Visualization Studio, ID 5587', url: 'https://svs.gsfc.nasa.gov/5587' },
  'lola-cgi': { t: 'CGI Moon Kit: LOLA-Höhenkarte, 4 Pixel je Grad (gemeinfrei)', by: 'NASA SVS, ID 4720 (LRO/LOLA)', url: 'https://svs.gsfc.nasa.gov/4720' },
  'nssdc-apollo': { t: 'Apollo-Missionen: Start, Landung, Landegebiet', by: 'NASA NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo.html' },
  'nssdc-apollo-sites': { t: 'Apollo Landing Site Coordinates (LRO, Wagner et al. 2017)', by: 'NASA NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html' },
  'usgs-tycho': { t: 'Gazetteer of Planetary Nomenclature: Tycho', by: 'USGS / IAU', url: 'https://planetarynames.wr.usgs.gov/Feature/6163' },
  'nasa-le': { t: 'Mondfinsternisse 2021–2030', by: 'NASA GSFC, F. Espenak', url: 'https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html' },
  'mcewen-1991': { t: 'Photometric functions for photoclinometry and other applications (Lunar-Lambert)', by: 'McEwen 1991, Icarus 92, 298', url: 'https://doi.org/10.1016/0019-1035(91)90053-V' },
  // [E3] Jupiter-System
  // [E3] Io, Europa
  // [E3] Ganymed, Kallisto
  // [E4] Saturn + Mars
  // [E4] Mars
  // [E5] Neptun, Uranus, Pluto
  // [E5] Triton
  // [E5] Uranus
  // [E5] Pluto
};

// Abstände für Mess-Leiste und Rail: width = typische Bildbreite [m], dist = Entfernung von der Erde [m],
// lookback = Lichtlaufzeit bzw. Rückblickzeit [s] (kosmologisch ≠ Abstand/c, siehe research.md)
export const STATIONS = {
  earth: {
    n: 1, title: 'Erde & Mond', kicker: 'Erde–Mond-System', parent: 'solar', width: 4e7, dist: 0, lookback: 0,
    lead: 'Licht braucht 1,3 Sekunden vom Mond zu uns. Tag- und Nachtseite, Mondphase und Sonnenrichtung sind aus den Bahndaten für den aktuellen Zeitpunkt berechnet.',
    facts: [
      { v: '384.400', u: 'km', l: 'mittlerer Abstand Erde–Mond', s: 'nasa-moon' },
      { v: '1,28', u: 's', l: 'Licht vom Mond zur Erde', s: 'nasa-moon' },
      { v: '6.371', u: 'km', l: 'mittlerer Erdradius', s: 'nasa-earth' },
      { v: '3,8', u: 'cm/Jahr', l: 'so schnell entfernt sich der Mond', s: 'llr' },
    ],
    note: 'Abstände und Größen maßstäblich. Erde und Mond stehen wie jetzt; Beleuchtung aus der berechneten Sonnenrichtung. Sternhimmel aus dem Yale Bright Star Catalogue (5.044 Sterne bis 6 mag, Farbe aus B−V), Sternbilder nach IAU-Grenzen; Schattenkegel aus den Radien von Sonne, Erde und Mond gerechnet. Satelliten, Trümmer und ISS aus dem CelesTrak-Katalog (Stand Okt. 2026, Kepler + J2; als vergrößerte Symbole, je nach Zahnrad-Einstellung „Satelliten und Kleinkörper“ ausgedünnt); Polarlicht-Oval nach Kp (NOAA) um den geomagnetischen Pol, Vorhänge als Modell, nur auf der Nachtseite. Nachtleuchten der Hochatmosphäre (Airglow) überhöht, Linsenreflex ist ein Kamera-Effekt.',
    sources: ['nasa-earth', 'nasa-moon', 'llr', 'd3-celestial', 'hipparcos', 'ballesteros-2012', 'nasa-iss', 'celestrak', 'esa-debris', 'noaa-aurora', 'nasa-aurora', 'wdc-poles', 'sss-tex'],
    hotspots: {
      atmo: { t: 'Atmosphäre', x: 'Die Dichte der Luft sinkt alle 8,5 km auf gut ein Drittel (Skalenhöhe); im Bild ist die Atmosphäre daher nur ein schmaler Saum. Blaues Licht streut an Luftmolekülen stärker als rotes (Rayleigh-Streuung, ∝ 1/λ⁴); daher der blaue Saum am Tagrand und das Abendrot an der Grenze zur Nacht. Am Nachtrand leuchtet die Hochatmosphäre in 90–100 km Höhe schwach grün (Airglow, Sauerstoff 557,7 nm).', s: 'nasa-earth' },
      night: { t: 'Nachtseite', x: 'Stadtlichter nach Satellitenaufnahmen. Sie folgen Küsten, Flusstälern und Verkehrswegen, an denen ein Großteil der Bevölkerung lebt.', s: 'sss-tex' },
      moon: { t: 'Mond', x: 'Radius 1.737 km, Masse 1/81 der Erde, Fallbeschleunigung 1,62 m/s² (ein Sechstel des Erdwerts). Umlauf und Drehung dauern gleich lang (27,3 Tage, gebundene Rotation), daher zeigt er der Erde stets dieselbe Seite. Ohne Atmosphäre schwankt die Temperatur zwischen −173 °C nachts und 127 °C mittags. Laser-Entfernungsmessungen zu den Apollo-Reflektoren ergeben: Er entfernt sich um 3,8 cm pro Jahr. Hineinfliegen: der Mond aus der Nähe mit Relief, Landestellen und Erdaufgang.', s: 'nasa-moon' },
      geo: { t: 'Geostationäre Bahn', x: 'In 35.786 km Höhe dauert ein Umlauf genau einen Sterntag (23 h 56 min). Satelliten auf dieser Bahn stehen von der Erde aus gesehen still über einem Punkt des Äquators; genutzt für Rundfunk, Kommunikation und Wetterbeobachtung.', s: 'nasa-earth' },
      iss: { t: 'ISS', x: 'Die Raumstation kreist in rund 420 km Höhe, 51,6° gegen den Äquator geneigt, alle 93 Minuten einmal um die Erde (7,66 km/s). Bahn und Ort aus den CelesTrak-Bahnelementen; die Abplattung der Erde dreht die Bahnebene um gut 5° pro Tag rückwärts (Knotendrift, J2) – im Zeitraffer sichtbar. Maßstäblich liegt die Bahn knapp über der Oberfläche: 420 km sind 6,6 % des Erdradius.', s: 'nasa-iss' },
      aurora: { t: 'Polarlichter', x: 'Teilchen des Sonnenwinds, vom Erdmagnetfeld zu den Polen geleitet, regen in 100–300 km Höhe Sauerstoff (grün 557,7 nm, rot 630 nm) und Stickstoff (blau-violett) an. Das Leuchten bildet ein Oval um den geomagnetischen Pol (80,8° N, 72,8° W; IGRF-14, 2025) – nachts weiter äquatorwärts als mittags, bei ruhiger Sonne (Kp 0–2) am Polarkreis, im Sturm (Kp ≥ 7) bis Mitteleuropa. Regler „Kp“ im Zahnrad. Form der Vorhänge: Modell; nur auf der Nachtseite sichtbar.', s: 'nasa-aurora' },
      sats: { t: 'Satelliten und Trümmer', x: 'Rund 16.800 aktive Satelliten (Stand Okt. 2026), zwei Drittel davon Starlink in 540–570 km Höhe; Navigationssatelliten in 20.000–23.000 km, Wetter- und Fernsehsatelliten in der geostationären Bahn in 35.786 km. Punkte: 19.470 Objekte aus dem CelesTrak-Katalog einschließlich der vier großen Trümmerwolken (Fengyun-1C, Kosmos 2251, Iridium 33, Kosmos 1408), fortgeschrieben mit Kepler und J2 – Bahnebenen und Höhen stimmen, der Ort auf der Bahn driftet nach Wochen. Im Bild als vergrößerte Symbole; maßstäblich wären die Satelliten nicht zu sehen. Zahnrad „Satelliten und Kleinkörper“: je größer, desto weniger Objekte (4× → jedes achte), 1× zeigt alle als Lichtpunkte.', s: 'celestrak' },
      sun: { t: 'Richtung Sonne', x: 'Sonnenlicht ist 8 Minuten 19 Sekunden unterwegs: 1 Astronomische Einheit = 149.597.870,7 km (IAU 2012).', s: 'iau-2012' },
      umbra: { t: 'Schattenkegel', x: 'Der Kernschatten der Erde ist 1,38 Mio. km lang; der Mond (384.000 km) kann bei einer Mondfinsternis vollständig hineingeraten. Der Kernschatten des Mondes ist nur rund 375.000 km lang und reicht je nach Mondabstand knapp bis zur Erdoberfläche oder endet kurz davor (dann ringförmige Finsternis). Totale Sonnenfinsternisse sind deshalb nur in einem schmalen Streifen und für wenige Minuten zu sehen (eigene Rechnung aus den Radien von Sonne, Erde und Mond).', s: 'nasa-moon' },
    },
  },
  solar: {
    n: 2, title: 'Sonnensystem', kicker: 'Planetensystem', parent: 'galaxy', width: 2.2e12, dist: 0, lookback: 0,
    lead: 'Die acht Planeten und der Mond auf ihren Bahnen und an ihren heutigen Positionen, berechnet aus den Bahnelementen des JPL. Die Zeitleiste spielt die Umläufe ab; ein Klick auf ein Abzeichen fliegt den Körper an.',
    facts: [
      { v: '30,1', u: 'AE', l: 'Bahnradius Neptun (4,5 Mrd. km)', s: 'jpl-elements' },
      { v: '8 min 19 s', u: '', l: 'Licht von der Sonne zur Erde', s: 'iau-2012' },
      { v: '99,86', u: '%', l: 'der Masse liegen in der Sonne', s: 'nasa-sun' },
      { v: '109', u: '×', l: 'Sonnen- zu Erddurchmesser', s: 'nasa-sun' },
    ],
    note: 'Bahnen maßstäblich. Größen im Modus „Anschaulich“ vergrößert: Planeten ×800, Sonne ×25, Mondabstand verkürzt (sonst läge der Mond in der vergrößerten Erde). „Echt“ zeigt die wahren Größen – dann sind die Planeten kleiner als ein Pixel. Asteroiden, Trojaner und Kuipergürtel als vergrößerte Brocken, je nach Zahnrad-Einstellung „Satelliten und Kleinkörper“ ausgedünnt: ein Brocken steht für viele Körper. Sonne: Flecken laufen mit der differentiellen Rotation; Granulation, Protuberanzen, Flares, Massenauswürfe und Korona sind Modelle in Szenenzeit, die Korona um Größenordnungen verstärkt.',
    sources: ['jpl-elements', 'nasa-planets', 'nasa-moon', 'nasa-moons', 'nasa-sun', 'nasa-sun-facts', 'snodgrass-1990', 'nordlund-2009', 'nasa-solarmax', 'swpc-flares', 'swpc-cme', 'nasa-saturn', 'kirkwood', 'sss-tex'],
    hotspots: {
      sun: { t: 'Sonne', x: 'Radius 695.700 km (109 Erdradien), Masse 1,989·10³⁰ kg – 99,86 % des Sonnensystems. Im Kern verschmilzt Wasserstoff bei 15,7 Mio. K zu Helium; daraus kommt die Leuchtkraft von 3,83·10²⁶ W. Die sichtbare Oberfläche (Photosphäre) hat 5.772 K und ist in Granulen von ≈ 1.000 km gegliedert, Konvektionszellen, die jeweils rund 10 Minuten bestehen. Zum Rand hin wirkt die Scheibe dunkler, weil wir dort in höhere, kühlere Schichten blicken (Randverdunkelung). Sie rotiert differentiell: am Äquator in 24,5 Tagen, in 60° Breite in rund 30 Tagen; die Flecken wandern entsprechend mit. Laut NASA und NOAA hat der Sonnenzyklus 25 im Oktober 2024 seine Maximumsphase erreicht. Hineinfliegen: die Sonne aus der Nähe, in vier Kanälen wie beim Sonnenobservatorium SDO.', s: 'nasa-sun' },
      flare: { t: 'Protuberanzen, Flares, Massenauswürfe', x: 'Protuberanzen sind Plasmabögen entlang magnetischer Feldlinien, Zehntausende Kilometer hoch, oft wochenlang stabil. Flares sind plötzliche Strahlungsausbrüche von Minuten bis Stunden Dauer, eingeteilt nach der Röntgenleistung bei 0,1–0,8 nm in Klassen A, B, C, M, X (X ab 10⁻⁴ W/m²). Koronale Massenauswürfe setzen Milliarden Tonnen Plasma mit 250 bis 3.000 km/s frei. Trifft ein Auswurf die Erde, kann er einen geomagnetischen Sturm mit Polarlichtern bis in mittlere Breiten auslösen. Im Bild: zufällige Ereignisse im Zeitraffer, Form und Häufigkeit als Modell; „Jetzt auslösen“ im Zahnrad.', s: 'swpc-flares' },
      corona: { t: 'Korona', x: 'Die äußere Atmosphäre der Sonne ist 1–3 Mio. K heiß, aber so dünn, dass sie neben der Scheibe nur bei totalen Sonnenfinsternissen oder im Koronografen sichtbar wird. Ihre Strahlen (Streamer) folgen dem Magnetfeld; im Aktivitätsmaximum erscheint sie rundum strukturiert, im Minimum vor allem am Äquator. Die Helligkeit fällt etwa mit r⁻²·⁵ – hier um Größenordnungen verstärkt.', s: 'nasa-sun-facts' },
      earth: { t: 'Erde', x: 'Dritter Planet, 1 AE von der Sonne: Äquatorradius 6.378 km, Umlauf 365,25 Tage, Drehung 23 h 56 min (Sterntag). Hineinfliegen: Erde und Mond zum aktuellen Zeitpunkt, mit Polarlichtern und Satelliten.', s: 'jpl-elements' },
      moon: { t: 'Mond', x: 'Radius 1.737 km · 0,0123 Erdmassen · mittlerer Abstand 384.400 km (30 Erddurchmesser; im Modus „Anschaulich“ näher gezeichnet) · Umlauf und Drehung 27,3 Tage (gebundene Rotation) · −173 bis 127 °C · entfernt sich 3,8 cm pro Jahr. Richtung zur Erde aus der Almanach-Rechnung für den angezeigten Zeitpunkt.', s: 'nasa-moon' },
      mercury: { t: 'Merkur', x: 'Radius 2.440 km · 0,055 Erdmassen · 0,39 AE · Umlauf 88 Tage · Drehung 58,6 Tage · −173 bis 427 °C · keine Monde, nur eine sehr dünne Exosphäre. Größte Bahnexzentrizität der Planeten (0,21): Der Sonnenabstand schwankt zwischen 46 und 70 Mio. km.', s: 'nasa-planets' },
      venus: { t: 'Venus', x: 'Radius 6.052 km · 0,815 Erdmassen · 0,72 AE · Umlauf 225 Tage · rotiert rückläufig, eine Drehung dauert 243 Erdtage · Oberfläche 464 °C bei 92 bar, Atmosphäre fast nur CO₂ – Folge eines starken Treibhauseffekts; Wolken aus Schwefelsäure reflektieren gut drei Viertel des Sonnenlichts, daher der helle Saum.', s: 'nasa-planets' },
      mars: { t: 'Mars', x: 'Radius 3.396 km · 0,107 Erdmassen · 1,52 AE · Umlauf 687 Tage · Tag 24 h 37 min · im Mittel −65 °C · Druck 0,006 bar (95 % CO₂) · 2 Monde (Phobos, Deimos) · rot durch Eisenoxid im Staub, Polkappen aus Wasser- und CO₂-Eis.', s: 'nasa-planets' },
      jupiter: { t: 'Jupiter', x: 'Radius 71.492 km (11,2 Erdradien) · 318 Erdmassen – mehr als doppelt so viel wie alle anderen Planeten zusammen · 5,2 AE · Umlauf 11,9 Jahre · Drehung in 9 h 56 min; die schnelle Rotation ordnet die Wolken in Bänder · −110 °C an der Wolkendecke · über 95 bekannte Monde, 2026 mehr als 100. Seine Schwerkraft erzeugt über Bahnresonanzen die Kirkwood-Lücken im Asteroidengürtel.', s: 'nasa-planets' },
      saturn: { t: 'Saturn', x: 'Radius 60.268 km · 95 Erdmassen · 9,5 AE · Umlauf 29,4 Jahre · Drehung 10 h 39 min · −140 °C · Dichte 0,69 g/cm³, geringer als Wasser · Ringe von 74.700 bis 137.000 km (C- bis A-Ring), meist nur zehn Meter bis einen Kilometer dick, vor allem Wassereis; der Planet wirft seinen Schatten auf die Ringe, die Ringe ihren auf den Planeten · 274 bestätigte Monde (2025), weitere 2026 gemeldet.', s: 'nasa-saturn' },
      uranus: { t: 'Uranus', x: 'Radius 25.559 km · 14,5 Erdmassen · 19,2 AE · Umlauf 84 Jahre · Drehung 17 h 14 min, rückläufig · −195 °C · Achse um 98° geneigt: Jeder Pol ist etwa 42 Jahre lang beleuchtet, dann 42 Jahre unbeleuchtet · Methan absorbiert rotes Licht, daher die blaugrüne Farbe · 28 bekannte Monde.', s: 'nasa-planets' },
      neptune: { t: 'Neptun', x: 'Radius 24.764 km · 17,1 Erdmassen · 30,1 AE · Umlauf 165 Jahre · Drehung 16 h 7 min · −200 °C · 16 Monde; der größte, Triton, umläuft Neptun rückläufig · Sonnenlicht braucht gut 4 Stunden bis hierher.', s: 'nasa-planets' },
      belt: { t: 'Asteroidengürtel', x: 'Lücken bei 2,50 · 2,82 · 2,95 AE: Dort stünden die Umlaufzeiten in Resonanz mit Jupiter (3:1, 5:2, 7:3); seine wiederholten Störungen machen diese Bahnen instabil (Kirkwood-Lücken).', s: 'kirkwood' },
      asteroid: { t: 'Asteroiden aus der Nähe', x: 'Hineinfliegen: (16) Psyche, Bennu und Eros – Form und Drehung nach den Messdaten von Radar und Raumsonden, die Oberfläche als Modell.', s: 'shepard-2021' },
      kuiper: { t: 'Kuipergürtel', x: 'Jenseits von Neptun (30–50 AE) kreisen Kleinkörper aus Eis und Gestein, darunter Pluto und Arrokoth – Überreste aus der Entstehungszeit des Sonnensystems. Im Bild: statistische Verteilung.', s: 'nasa-planets' },
    },
  },
  asteroid: {
    n: '02A', title: 'Asteroiden', kicker: 'Kleinkörper', parent: 'solar', width: 4e5, dist: 0, lookback: 0,
    lead: 'Drei Asteroiden aus der Nähe, wie Radar und Raumsonden sie vermessen haben: der metallreiche Psyche, der Geröllhaufen Bennu und der längliche Eros. Im Zahnrad: Drehung, Sonnenstand und Schatten, bei Bennu die Steinchen, die er ins All wirft.',
    facts: [
      { v: '278 × 238 × 171', u: 'km', l: 'Psyche, Form aus Radarmessungen', s: 'shepard-2021' },
      { v: '30–60', u: '%', l: 'Metallanteil am Volumen von Psyche', s: 'nasa-psyche' },
      { v: '4,0', u: 'g/cm³', l: 'Dichte von Psyche', s: 'shepard-2021' },
      { v: '121,6', u: 'g', l: 'Gestein von Bennu, 2023 zur Erde gebracht', s: 'nasa-osirisrex' },
    ],
    note: 'Formen nach Messdaten: Psyche mit 278 × 238 × 171 km und den drei großen Senken des Radarmodells (Breite und Größe nach Shepard 2021, Länge frei gewählt), Bennu als Kreisel mit Wulst am Äquator, Eros länglich und gebogen mit 33 × 13 × 13 km. Kleinere Krater, Felsblöcke und Feinstruktur sind Modelle mit festem Startwert. Farben: Die Blau- und Bronzetöne von Psyche folgen der Künstlerdarstellung der NASA, die echten Farben zeigt erst die Sonde ab 2029; Bennu ist in Wahrheit sehr dunkel und im Bild aufgehellt. Drehung mit den gemessenen Perioden im Zeitraffer, Drehachse senkrecht im Bild. Blaues Fülllicht und Linsenreflex sind Kamera-Effekte; die Bahnen der Steinchen bei Bennu laufen verlangsamt.',
    sources: ['shepard-2021', 'nasa-psyche', 'nasa-bennu', 'nasa-osirisrex', 'barnouin-2019', 'lauretta-2019', 'nasa-eros', 'nssdc-asteroids'],
    hotspots: {
      'psyche-metal': { t: 'Metall und Gestein', x: 'Psyche besteht nach heutigem Stand zu 30–60 % seines Volumens aus Metall, gemischt mit Gestein. Ob er der freigelegte Kern eines frühen Planetenbausteins ist, soll die Sonde klären. Die Blau- und Bronzetöne im Bild folgen der Künstlerdarstellung der NASA.', s: 'nasa-psyche' },
      'psyche-basin': { t: 'Große Senken', x: 'Das Radarmodell zeigt große Vertiefungen: nahe dem Südpol (65° S) eine 50–75 km breite und rund 4 km tiefe Senke, wahrscheinlich ein Einschlagkrater; auf der Nordhalbkugel eine flache, 80–90 km breite Mulde; am Nordpol eine Senke von etwa 50 km. Zahnrad: „Senken markieren“. Kleinere Krater im Bild sind Modell.', s: 'shepard-2021' },
      'psyche-mission': { t: 'Raumsonde Psyche', x: 'Gestartet am 13. Oktober 2023. Ab August 2029 kreist die Sonde um den Asteroiden und vermisst Form, Schwerefeld, Magnetfeld und Zusammensetzung.', s: 'nasa-psyche' },
      'bennu-pile': { t: 'Geröllhaufen', x: 'Bennu ist kein fester Fels, sondern ein lose gebundener Haufen aus Geröll und Blöcken. Seine Kreiselform mit dem Wulst am Äquator passt dazu: Die schnelle Drehung, eine Umdrehung in gut 4 Stunden, formt den lockeren Körper.', s: 'barnouin-2019' },
      'bennu-sample': { t: 'Probe vom Asteroiden', x: 'Am 20. Oktober 2020 setzte OSIRIS-REx kurz auf Bennu auf und nahm Gestein und Staub auf. Am 24. September 2023 landete die Kapsel mit 121,6 g Material auf der Erde.', s: 'nasa-osirisrex' },
      'bennu-ejecta': { t: 'Steinchen-Auswürfe', x: 'Anfang 2019 beobachtete OSIRIS-REx, dass Bennu immer wieder kleine Steinchen ins All schleudert, meist Zentimeter groß. Manche fallen zurück, andere kreisen eine Weile um den Asteroiden oder entkommen. Im Bild verlangsamt; Zahnrad: Häufigkeit und „Jetzt auslösen“.', s: 'lauretta-2019' },
      'eros-shape': { t: 'Länglicher Asteroid', x: 'Eros misst rund 33 × 13 × 13 km und dreht sich in 5,27 Stunden einmal um sich selbst. Er gehört zu den S-Typen aus silikatischem Gestein.', s: 'nssdc-asteroids' },
      'eros-near': { t: 'Erste Landung', x: 'NEAR Shoemaker schwenkte am 14. Februar 2000 in eine Umlaufbahn um Eros ein und landete am 12. Februar 2001 als erste Raumsonde auf einem Asteroiden.', s: 'nasa-eros' },
    },
  },
  // [E1] Sonne
  sun: {
    n: '02B', title: 'Sonne', kicker: 'Stern', parent: 'solar', width: 1.6e9, dist: AU, lookback: AU / C,
    lead: 'Ein Stern mittlerer Größe aus der Nähe: Plasma, Magnetfelder und Licht, das 8 Minuten 19 Sekunden bis zur Erde braucht. Vier Kanäle wie beim Sonnenobservatorium SDO zeigen verschiedene Schichten – von der Oberfläche bis zur Millionen Grad heißen Korona. Zum Start ein künstlerischer Look „Glut“ mit Magnetbögen und Ausbrüchen.',
    facts: [
      { v: '695.700', u: 'km', l: 'Radius', s: 'nasa-sun' },
      { v: '5.772', u: 'K', l: 'Oberfläche', s: 'nasa-sun' },
      { v: '1–3', u: 'Mio. K', l: 'Korona', s: 'nasa-sun-facts' },
      { v: '8 min 19 s', u: '', l: 'Licht bis zur Erde', s: 'iau-2012' },
    ],
    note: 'Look „Glut“ künstlerisch verstärkt, kein Messbild: Glutkruste mit Magnetadern, Rand (Flammenkranz, Bogen-Arkaden, feiner Saum mit Spikulen) und Ausbrüche (Filament-Eruption, Flare mit Schockwelle, abreißende Protuberanz) sind in Höhe, Helligkeit und Tempo überzeichnet – ein Ausbruch alle 12 s statt alle paar Stunden; 304 Å zeigt die Chromosphäre als Plasmateppich. Modell, kein Foto: Lage der aktiven Regionen, Flecken, Schleifen und Löcher ist ausgedacht, nicht die Sonne von heute. Kanäle nach SDO/AIA (Weißlicht ≈ HMI-Kontinuum; 171 Å Fe IX, log T 5,8; 304 Å He II, log T 4,7; 193 Å Fe XII, log T 6,1), Farben angelehnt an die Falschfarben der NASA-Bilder. Granulen ≈ 25-fach, Flecken etwa doppelt so groß gezeichnet; Rotation, Schleifen, Protuberanzen und Flares im Zeitraffer, Flares ohne Blitzen (WCAG 2.3.1). Schichtschnitt in der Infotafel schematisch, nicht maßstäblich.',
    sources: ['nasa-sun', 'nasa-sun-facts', 'iau-2012', 'sdo-channels', 'nasa-sdo', 'snodgrass-1990', 'nordlund-2009', 'nasa-solarmax', 'swpc-flares', 'swpc-cme', 'nasa-psp', 'wcag-flash'],
    hotspots: {
      region: { t: 'Aktive Region', x: 'Über Fleckengruppen tritt gebündeltes Magnetfeld aus der Oberfläche. Darüber spannen sich Bögen aus heißem Plasma, die Koronaschleifen – im Kanal 171 Å golden, in 193 Å bronzefarben. Hier entstehen die meisten Flares. Wie viele aktive Regionen es gibt, folgt dem elfjährigen Zyklus; das Maximum von Zyklus 25 begann im Oktober 2024. Regler „Aktivität“.', s: 'nasa-solarmax' },
      spots: { t: 'Sonnenflecken', x: 'Dunkle Flecken im Weißlicht: Das starke Magnetfeld bremst dort die Konvektion, das Gas ist kühler als die 5.772 K der Umgebung und wirkt deshalb dunkel. Kern (Umbra) und Hof (Penumbra) mit radialen Fasern; Flecken erscheinen meist paarweise mit entgegengesetzter Polarität.', s: 'nasa-sun' },
      gran: { t: 'Granulation', x: 'Die Oberfläche brodelt: Jede Granule ist eine Konvektionszelle von rund 1.000 km, in der heißes Gas aufsteigt, abkühlt und an den dunklen Rändern wieder absinkt – nach etwa 10 Minuten ist sie verschwunden. Im Bild etwa 25-fach vergrößert und im Zeitraffer.', s: 'nordlund-2009' },
      prom: { t: 'Protuberanz', x: 'Ein Bogen aus kühlerem, dichtem Plasma, vom Magnetfeld über den Rand gehoben, Zehntausende Kilometer hoch und oft wochenlang stabil. Im Kanal 304 Å (Helium, Chromosphäre) leuchtet er rot vor dem dunklen All.', s: 'sdo-channels' },
      filament: { t: 'Filament', x: 'Dieselbe Struktur wie eine Protuberanz, nur von oben gesehen: Vor der hellen Scheibe schluckt das kühlere Plasma Licht und erscheint als dunkler Faden. Wird ein Filament instabil, kann es als Massenauswurf ins All gerissen werden.', s: 'nasa-sdo' },
      hole: { t: 'Koronales Loch', x: 'Gebiete mit offenem Magnetfeld: Das Plasma strömt ungehindert ab, die Korona ist dort dünn und kühler. Im Kanal 193 Å (Eisen, ≈ 1,3 Mio. K) erscheinen koronale Löcher deshalb dunkel; aus ihnen kommt schneller Sonnenwind.', s: 'sdo-channels' },
      flare: { t: 'Flare und Massenauswurf', x: 'Ein Flare ist ein plötzlicher Strahlungsausbruch, wenn sich verdrillte Magnetfelder neu verbinden; die Klassen A, B, C, M und X stehen jeweils für zehnfache Stärke. Oft folgt ein koronaler Massenauswurf: Milliarden Tonnen Plasma, 250 bis 3.000 km/s schnell. Knopf „Flare auslösen“ in der Infotafel.', s: 'swpc-flares' },
      pole: { t: 'Pol und Rotation', x: 'Die Sonne ist kein fester Körper: Am Äquator dreht sie sich in 24,5 Tagen einmal, in 60° Breite erst in rund 30 Tagen (differentielle Rotation). Regler „Zeitraffer“.', s: 'snodgrass-1990' },
      wind: { t: 'Sonnenwind', x: 'Aus der Korona strömt ständig Plasma ins All, der Sonnenwind. Parker Solar Probe fliegt durch die Korona, um zu messen, wie er beschleunigt wird.', s: 'nasa-psp' },
    },
  },
  // [E2] Erde nah
  // [E2] Mond
  moon: {
    n: '01C', title: 'Mond', kicker: 'Erdtrabant', parent: 'earth', width: 1.4e7, dist: 3.844e8, lookback: 1.28,
    lead: 'Der Mond aus der Nähe: Er steht still, Sonne, Erde und Sterne ziehen über seinen Himmel. Licht, Mondphase und das leichte Taumeln (Libration) sind für den angezeigten Zeitpunkt berechnet, das Relief stammt aus Laser-Höhenmessungen der Sonde LRO.',
    facts: [
      { v: '1.737,4', u: 'km', l: 'mittlerer Radius', s: 'nasa-moon' },
      { v: '1,62', u: 'm/s²', l: 'Fallbeschleunigung', s: 'nasa-moon' },
      { v: '27,3', u: 'Tage', l: 'Umlauf = Drehung', s: 'nasa-moon-phases' },
      { v: '29,5', u: 'Tage', l: 'von Neumond zu Neumond', s: 'nasa-moon-phases' },
    ],
    note: 'Mondfest gezeichnet: Der Mond ruht, Sonne, Erde und Sterne bewegen sich. Lage für den Zeitpunkt aus der Almanach-Näherung des Mondorts (≈ 0,3°) und der optischen Libration nach Meeus (Astronomical Algorithms, Kap. 53; die physische Libration ≤ 0,04° fehlt). Albedo-Karte Solar System Scope (2.048 Pixel, CC BY 4.0), Höhen der Laseraltimetrie LOLA (NASA, 4 Pixel je Grad ≈ 7,6 km, gemeinfrei) – Relief im Bild 2-fach überhöht (Regler im Zahnrad), Schlagschatten aus dem Höhenfeld. Reflexion als Lunar-Lambert-Modell (McEwen 1991) mit Oppositionseffekt. Erdschein und Kupferrot im Kernschatten stark aufgehellt (echt viele tausendmal schwächer als das Sonnenlicht). Sterne zur Orientierung sichtbar – auf Fotos der sonnenbeschienenen Oberfläche sind sie meist nicht zu sehen. Erde maßstäblich (1,9° am Himmel). Erdaufgang aus 113 km Bahnhöhe im Zeitraffer (echt ≈ 1,5 Minuten bei 2 Stunden Umlauf). Blick „Von der Erde“ aus verkürztem Abstand (14.000 km statt 384.400 km).',
    sources: ['nasa-moon', 'nasa-moon-facts', 'nasa-moon-phases', 'svs-libration', 'lola-cgi', 'nssdc-apollo', 'nssdc-apollo-sites', 'usgs-tycho', 'llr', 'nasa-le', 'mcewen-1991', 'sss-tex', 'd3-celestial'],
    hotspots: {
      phase: { t: 'Schattengrenze', x: 'Die Grenze zwischen Tag und Nacht (Terminator). Ohne Atmosphäre ist sie scharf; nahe der Grenze steht die Sonne tief, Kraterwände und Berge werfen lange Schatten, Gipfel leuchten schon im Dunkeln. Ein Mondtag von Sonnenaufgang zu Sonnenaufgang dauert 29,5 Erdtage – so lange wie der Wechsel der Mondphasen.', s: 'nasa-moon-phases' },
      earth: { t: 'Erde am Mondhimmel', x: 'Wegen der gebundenen Rotation steht die Erde von der Vorderseite aus fast still am Himmel; sie pendelt durch die Libration nur um einige Grad. Sie zeigt Phasen, gegenläufig zum Mond: Bei Neumond sieht man vom Mond aus eine volle Erde – ihr Licht ist der Erdschein auf der Nachtseite. Am Himmel misst sie 1,9°, knapp viermal so viel wie der Vollmond bei uns (eigene Rechnung aus 12.742 km und 384.400 km).', s: 'nasa-moon-phases' },
      apollo11: { t: 'Apollo 11', x: 'Erste bemannte Landung am 20. Juli 1969 im Meer der Ruhe (Mare Tranquillitatis). Der dort aufgestellte Laser-Reflektor wird bis heute angepeilt: Aus der Lichtlaufzeit folgt, dass sich der Mond um 3,8 cm pro Jahr von der Erde entfernt.', s: 'llr' },
      apollo12: { t: 'Apollo 12', x: 'Landung am 19. November 1969 im Ozean der Stürme (Oceanus Procellarum). Die Landestelle ist aus Aufnahmen der Sonde LRO auf wenige Meter genau bekannt.', s: 'nssdc-apollo' },
      apollo15: { t: 'Apollo 15', x: 'Landung am 30. Juli 1971 an der Hadley-Rille am Rand des Mare Imbrium, zwischen den Apenninen.', s: 'nssdc-apollo' },
      apollo17: { t: 'Apollo 17', x: 'Landung am 11. Dezember 1972 im Taurus-Littrow-Tal am Rand des Mare Serenitatis – die bislang letzte bemannte Mondlandung.', s: 'nssdc-apollo' },
      tycho: { t: 'Tycho', x: 'Ein junger Einschlagkrater von 85 km Durchmesser auf der südlichen Vorderseite. Seine hellen Strahlen aus ausgeworfenem Material ziehen sich über große Teile der Vorderseite und fallen bei Vollmond auf, wenn Schatten fehlen.', s: 'usgs-tycho' },
      copernicus: { t: 'Kopernikus', x: 'Strahlenkrater im Ozean der Stürme mit Terrassenwänden und Zentralbergen. Bei tiefer Sonne nahe der Schattengrenze ist sein Relief am deutlichsten; Höhen hier aus der Laseraltimetrie.', s: 'lola-cgi' },
      imbrium: { t: 'Mare Imbrium', x: 'Das Regenmeer, eines der großen Einschlagbecken der Vorderseite. Die dunklen „Meere“ (Maria) sind Becken, die vor 4,2 bis 1,2 Milliarden Jahren mit Lava gefüllt wurden; die hellen Hochländer sind älteres Gestein.', s: 'nasa-moon-facts' },
      tranquillitatis: { t: 'Mare Tranquillitatis', x: 'Das Meer der Ruhe, ein lavagefülltes Becken auf der östlichen Vorderseite. Hier landete Apollo 11.', s: 'nasa-moon-facts' },
      procellarum: { t: 'Oceanus Procellarum', x: 'Der Ozean der Stürme ist die größte dunkle Fläche der Vorderseite: Lavaebenen, die mehrere Becken überdecken.', s: 'nasa-moon-facts' },
      crisium: { t: 'Mare Crisium', x: 'Ein runder Lavasee nahe dem Ostrand. Durch die Libration rückt er mal näher an den Rand, mal weiter ins Bild – im Blick „Von der Erde“ mit Zeitraffer „1 Tag/s“ gut zu sehen.', s: 'svs-libration' },
      southpole: { t: 'Südpol', x: 'Die Drehachse des Mondes steht nur 1,5° schief zur Erdbahn; an den Polen bleibt die Sonne deshalb immer knapp am Horizont. Böden tiefer Krater liegen im Dauerschatten – dort fand die Sonde LRO hohe Anteile von Wassereis. Ziel künftiger Landungen.', s: 'nasa-moon-facts' },
      aitken: { t: 'Südpol-Aitken-Becken', x: 'Das größte und älteste bekannte Einschlagbecken des Mondes auf der südlichen Rückseite. In der Höhenkarte der Laseraltimetrie ist es eine weite, tiefe Senke; im Bild das Relief im Streiflicht.', s: 'lola-cgi' },
      farside: { t: 'Rückseite', x: 'Von der Erde aus nie zu sehen, aber nicht dunkel: Bei Neumond ist sie voll beleuchtet. Kaum Maria, dafür dicht an dicht Krater. Menschen sahen sie erst 1959, als eine sowjetische Sonde vorbeiflog.', s: 'nasa-moon-facts' },
    },
  },
  // [E3] Jupiter-System
  // [E3] Io, Europa
  // [E3] Ganymed, Kallisto
  // [E4] Saturn + Mars
  // [E4] Mars
  // [E5] Neptun, Uranus, Pluto
  // [E5] Triton
  // [E5] Uranus
  // [E5] Pluto
  galaxy: {
    n: 3, title: 'Milchstraße', kicker: 'Galaktisch', parent: 'local', width: 1.3e21, dist: 0, lookback: 0,
    lead: 'Eine Balkenspirale mit 100 bis 400 Milliarden Sternen. Die Sonne kreist 27.000 Lichtjahre vom Zentrum entfernt mit rund 229 km/s – ein Umlauf dauert etwa 220 Millionen Jahre.',
    facts: [
      { v: '27.000', u: 'Lj', l: 'Sonne – Zentrum (8,28 kpc)', s: 'gravity-2022' },
      { v: '229', u: 'km/s', l: 'Kreisbahngeschwindigkeit bei der Sonne', s: 'eilers-2019' },
      { v: '100–400', u: 'Mrd.', l: 'Sterne', s: 'bland-2016' },
      { v: '≈ 100.000', u: 'Lj', l: 'Durchmesser der Sternscheibe (Richtwert)', s: 'bland-2016' },
    ],
    note: 'Modell: Eine Aufnahme der Milchstraße von außen gibt es nicht. Arme nach Maser-Parallaxen (Reid et al. 2019), Balken nach Wegg et al. 2015, Scheibe nach Bland-Hawthorn & Gerhard 2016, Abstand zum Zentrum nach GRAVITY 2022. Stationen und die zehn bekanntesten Kugelsternhaufen an ihren galaktischen Koordinaten (Harris 2010), weitere 140 Haufen und der Sternhalo statistisch verteilt. Fermi-Blasen als Falschfarbe (Gammastrahlung, Su et al. 2010).',
    sources: ['gravity-2022', 'reid-2019', 'wegg-2015', 'bland-2016', 'eilers-2019', 'bennett-2019', 'harris-2010', 'su-2010'],
    hotspots: {
      sun: { t: 'Sonne', x: 'Im Orion-Arm, einem kleinen Arm zwischen Perseus- und Sagittarius-Arm. Hineinfliegen: das Sonnensystem.', s: 'reid-2019' },
      orion: { t: 'Orion-Nebel', x: 'Rund 1.270 Lj von uns, im selben Arm wie die Sonne. Hineinfliegen.', s: 'maiz-2022' },
      crab: { t: 'Krebsnebel', x: 'Rund 6.200 Lj entfernt, Richtung Perseus-Arm. Hineinfliegen.', s: 'lin-2023' },
      sgra: { t: 'Sagittarius A*', x: 'Das Schwarze Loch im Zentrum, 27.000 Lj entfernt. Hineinfliegen.', s: 'gravity-2022' },
      bar: { t: 'Zentraler Balken', x: 'Eine längliche Struktur aus überwiegend alten, rötlichen Sternen: Halblänge 5,0 kpc (gut 16.000 Lj), 28–33° gegen die Linie Sonne–Zentrum gedreht.', s: 'wegg-2015' },
      omega: { t: 'ω Centauri', x: 'Der größte Kugelsternhaufen der Milchstraße: rund 10 Millionen Sterne, 17.000 Lj entfernt, vermutlich der Kern einer von der Milchstraße aufgenommenen Zwerggalaxie. Rund 150 Kugelsternhaufen umkreisen die Galaxis im Halo; ihre Sterne sind 10–13 Milliarden Jahre alt.', s: 'harris-2010' },
      halo: { t: 'Sternhalo', x: 'Eine dünn besetzte, annähernd kugelförmige Verteilung alter Sterne und Kugelsternhaufen um die Scheibe, bis über 100.000 Lj hinaus – zum Teil Überreste aufgenommener Zwerggalaxien. Noch weiter reicht der Halo aus Dunkler Materie; er stellt den Großteil der Masse und erklärt die flache Rotationskurve.', s: 'bland-2016' },
      sunorbit: { t: 'Sonnenbahn', x: 'Die Sonne umkreist das Zentrum auf einer fast runden Bahn mit 229 km/s – ein Umlauf dauert rund 220 Millionen Jahre („galaktisches Jahr“). Seit ihrer Entstehung hat sie etwa 20 Umläufe zurückgelegt.', s: 'eilers-2019' },
      fermi: { t: 'Fermi-Blasen', x: 'Zwei ausgedehnte Gebiete mit Gammastrahlung, je rund 25.000 Lj hoch, über und unter dem Zentrum, entdeckt 2010 mit dem Weltraumteleskop Fermi. Als Ursache gelten eine frühere Aktivitätsphase von Sagittarius A* oder starke Sternentstehung im Zentrum vor einigen Millionen Jahren.', s: 'su-2010' },
      perseus: { t: 'Perseus-Arm', x: 'Einer der beiden großen Arme, außerhalb der Sonnenbahn; hier liegt der Krebsnebel.', s: 'reid-2019' },
      scutum: { t: 'Scutum-Centaurus-Arm', x: 'Großer Arm, beginnt am Ende des Balkens.', s: 'reid-2019' },
      sagittarius: { t: 'Sagittarius-Arm', x: 'Innerer Nachbararm der Sonne, zum Zentrum hin; reich an Nebeln wie Lagunen- und Trifid-Nebel.', s: 'reid-2019' },
      norma: { t: 'Norma-Arm', x: 'Innerer Arm am anderen Ende des Balkens, von uns aus hinter dem Zentrum.', s: 'reid-2019' },
      localarm: { t: 'Lokaler Arm (Orion-Sporn)', x: 'Der kleine Arm, in dem die Sonne steht – lange für einen Sporn gehalten, nach Reid et al. 2019 ein eigenständiges Armstück von über 20.000 Lj Länge.', s: 'reid-2019' },
    },
  },
  orion: {
    n: 4, title: 'Orion-Nebel', kicker: 'Sternentstehung', parent: 'galaxy', width: 3.2e17, dist: 1270 * LY, lookback: 1270 * YEAR,
    lead: 'Das nächstgelegene Gebiet, in dem massereiche Sterne entstehen. Die UV-Strahlung der jungen Trapez-Sterne ionisiert das Gas und regt es zum Leuchten an: innen grünlich durch Sauerstoff ([O III] 501 nm), außen rot durch Wasserstoff (Hα 656 nm).',
    facts: [
      { v: '≈ 1.270', u: 'Lj', l: 'Entfernung (390 ± 2 pc, Gaia)', s: 'maiz-2022' },
      { v: '≈ 24', u: 'Lj', l: 'Ausdehnung des sichtbaren Nebels', s: 'odell-2001' },
      { v: '39.000', u: 'K', l: 'θ¹ Orionis C (O7, 33 Sonnenmassen)', s: 'simon-2006' },
      { v: '< 2', u: 'Mio. Jahre', l: 'Alter der meisten Sterne', s: 'odell-2001' },
    ],
    note: 'Volumen-Modell nach O’Dell et al. 2009: leuchtende Schicht (≈ 0,1 pc) vor der Molekülwolke OMC-1, θ¹ Ori C ≈ 0,2 pc davor, Schichtung [O III] → [N II] → [S II] von innen nach außen. Farben nach den Emissionslinien, Helligkeit verstärkt; M43 und die BN/KL-Region an ihren Orten, Staubfinger und eingebettete Sterne statistisch. „Hubble-Palette“ und „Infrarot“ sind Falschfarben-Darstellungen nach dem Vorbild von Hubble (SHO) und 2MASS/JWST. Ältere VLBA-Entfernung: 414 pc (Menten 2007).',
    sources: ['maiz-2022', 'menten-2007', 'odell-2001', 'odell-2009', 'simon-2006', 'ricci-2008', 'bally-2017'],
    hotspots: {
      trapez: { t: 'Trapez-Haufen', x: 'Vier helle, junge Sterne im Zentrum. θ¹ Ori C allein liefert den Großteil des ionisierenden UV-Lichts.', s: 'odell-2001' },
      proplyds: { t: 'Proplyds', x: 'Protoplanetare Scheiben um junge Sterne, in denen Planeten entstehen können. Die UV-Strahlung der Trapez-Sterne trägt Gas von ihrer Oberfläche ab (Photoverdampfung). Der Hubble-Atlas von Ricci et al. 2008 verzeichnet 178 davon.', s: 'ricci-2008' },
      omc: { t: 'Molekülwolke OMC-1', x: 'Hinter dem Nebel liegt kaltes, dichtes Gas. Die Trapez-Sterne haben an ihrer Vorderseite eine Höhlung ionisiert, deren leuchtende Innenseite der Nebel ist. In der Seitenansicht ist die Schalenform zu erkennen.', s: 'odell-2009' },
      ionbar: { t: 'Orion-Balken', x: 'Ionisationsfront: Hier trifft das UV-Licht auf die Wolkenwand – eine helle Kante zwischen ionisiertem und molekularem Gas.', s: 'odell-2001' },
      bay: { t: 'Dunkle Bucht', x: 'Staub vor dem Nebel absorbiert dessen Licht und erscheint als dunkler Einschnitt.', s: 'odell-2001' },
      m43: { t: 'M43 (de Mairans Nebel)', x: 'Eine eigene kleine Blase nordöstlich des Trapezes, durch eine Staubbahn vom Hauptnebel getrennt, ionisiert vom Stern NU Orionis (B0.5, ≈ 25.000 K). Entfernung wie M42, Durchmesser etwa 2 Lj.', s: 'odell-2001' },
      bnkl: { t: 'BN/KL-Region', x: 'Hinter der Ionisationsfront, tief in OMC-1, entstehen gerade massereiche Sterne (Becklin-Neugebauer-Objekt, Kleinmann-Low-Nebel). Vor etwa 500 Jahren zerfiel dort ein System junger Sterne; die Sterne flogen auseinander und lösten einen explosionsartigen Gasausfluss aus, den ALMA abbildet (Bally et al. 2017). Nur im Infrarot sichtbar.', s: 'bally-2017' },
      sho: { t: 'Hubble-Palette', x: 'Falschfarben nach Hubble-Vorbild: Schwefel ([S II] 672 nm) → rot, Wasserstoff (Hα 656 nm) → grün, Sauerstoff ([O III] 501 nm) → blau. Sie trennt die Linien, die im sichtbaren Licht fast gleich rot aussehen, und zeigt die Schichtung der Ionisation.', s: 'odell-2009' },
    },
  },
  crab: {
    n: 5, title: 'Krebsnebel', kicker: 'Supernova-Überrest', parent: 'galaxy', width: 1.6e17, dist: 6200 * LY, lookback: 6200 * YEAR,
    lead: 'Überrest der Supernova, die chinesische Astronomen im Jahr 1054 beobachteten. Im Zentrum rotiert ein Neutronenstern rund 30-mal pro Sekunde; seine Rotationsenergie speist den bläulich leuchtenden Synchrotronnebel.',
    facts: [
      { v: '≈ 6.200', u: 'Lj', l: 'Entfernung (1,90 kpc)', s: 'lin-2023' },
      { v: '≈ 13 × 9', u: 'Lj', l: 'Ausdehnung (4,1 × 2,7 pc)', s: 'buhler-2014' },
      { v: '≈ 1.500', u: 'km/s', l: 'Expansion der Filamente', s: 'hester-2008' },
      { v: '1054', u: 'n. Chr.', l: 'Supernova am Taghimmel sichtbar', s: 'hester-2008' },
    ],
    note: 'Volumen-Modell nach Hester 2008: rote Wasserstoff-Filamente als Hülle, innen bläuliches Synchrotronlicht. Farben nach Emission, Helligkeit verstärkt. Röntgen- und Radio-Blick als Falschfarben nach Chandra- und VLA-Vorbild (Ausdehnung der Komponenten qualitativ). Expansion: gleichmäßig ab dem Konvergenzjahr 1130 (Nugent 1998) – die echte Hülle wurde in den ersten Jahrzehnten beschleunigt und wird sich einmal abbremsen.',
    sources: ['hester-2008', 'lin-2023', 'buhler-2014', 'atnf', 'nugent-1998', 'weisskopf-2000'],
    hotspots: {
      pulsar: { t: 'Crab-Pulsar', x: 'Der Neutronenstern im Zentrum. Hineinfliegen: 20 km Durchmesser, 30 Umdrehungen pro Sekunde.', s: 'atnf' },
      filaments: { t: 'Filamente', x: 'Ausgeworfene Sternmaterie: Wasserstoff, Helium, Sauerstoff, Schwefel. Sie leuchten in Emissionslinien, vor allem rot (Hα).', s: 'hester-2008' },
      sync: { t: 'Synchrotronnebel', x: 'Elektronen mit nahezu Lichtgeschwindigkeit bewegen sich auf Spiralbahnen im Magnetfeld und strahlen dabei bläulich-weißes Licht ab. Die Energie dafür liefert der Pulsar.', s: 'hester-2008' },
      wisps: { t: 'Torus und Jet', x: 'Nahe am Pulsar zeigt Hubble einen Ring (Torus) und einen Strahl entlang der Drehachse; die „Wisps“ wandern mit etwa halber Lichtgeschwindigkeit nach außen.', s: 'hester-2008' },
      expansion: { t: 'Expansion', x: 'Die Filamente bewegen sich mit rund 1.500 km/s nach außen. Rechnet man ihre Bewegung zurück, laufen sie nicht im Jahr 1054, sondern um 1130 zusammen. Die Hülle wurde demnach nach der Explosion weiter beschleunigt, durch den Druck des Pulsarwinds (Nugent 1998). Der Regler „Jahr“ lässt den Nebel wachsen.', s: 'nugent-1998' },
      xray: { t: 'Röntgen-Blick', x: 'Chandra zeigt nur den inneren Bereich: Torus und Jet um den Pulsar und einen kleineren Synchrotronnebel. Die Elektronen, die Röntgenlicht abstrahlen, verlieren ihre Energie in wenigen Jahren – sie kommen nicht bis zum Rand. Die Filamente sind im Röntgenlicht unsichtbar.', s: 'weisskopf-2000' },
      radio: { t: 'Radio-Blick', x: 'Im Radiobereich füllt das Synchrotronlicht den ganzen Nebel bis zu den Filamenten – die Elektronen, die hier strahlen, leben Jahrtausende. Falschfarben nach dem Vorbild der VLA-Karten.', s: 'buhler-2014' },
    },
  },
  pulsar: {
    n: 6, title: 'Crab-Pulsar', kicker: 'Neutronenstern', parent: 'crab', width: 3e5, dist: 6200 * LY, lookback: 6200 * YEAR,
    lead: 'Etwa 1,4 Sonnenmassen in einer Kugel von gut 20 km Durchmesser. Strahlkegel entlang der Magnetachse streichen wie ein Leuchtturm über die Erde – hier in Zeitlupe.',
    facts: [
      { v: '33,8', u: 'ms', l: 'Drehperiode heute (29,5 pro Sekunde, aus P und Ṗ)', s: 'atnf' },
      { v: '≈ 1.600', u: 'km', l: 'Radius des Lichtzylinders', s: 'atnf' },
      { v: '3,8 · 10⁸', u: 'T', l: 'Magnetfeld (Dipol-Schätzung)', s: 'atnf' },
      { v: '+36', u: 'ns/Tag', l: 'so viel länger wird die Periode täglich', s: 'atnf' },
    ],
    note: 'Zeitlupe: Echt blitzt der Pulsar 30-mal pro Sekunde – als Bild wäre das ein Anfallsrisiko (WCAG 2.3.1). Den echten Takt gibt der Ton wieder. Feldlinien: Dipol-Modell, offene Linien jenseits des Lichtzylinders zur Spirale aufgewickelt. Stromblatt des Winds ballistisch gerechnet (cot θ = tan α · cos(φ + Drehwinkel − r/R_LC), eigene Rechnung), Farben Cyan/Magenta = Feldrichtung schematisch, Spirallinie = Schnitt des Stromblatts mit der Äquatorebene. Leuchtring = Lichtzylinder (gedachte Grenze, keine Materie). Strahlkegel, Lichthof, Polstrahlen und Teilchen schematisch; Polstrahlen in Wirklichkeit erst Lichtjahre draußen sichtbar. Lichtkurve nach dem optischen Pulsprofil, Lage der Erde (+z) gesetzt.',
    sources: ['atnf', 'jodrell', 'buhler-2014', 'nicer-2019', 'wcag-flash'],
    hotspots: {
      star: { t: 'Neutronenstern', x: 'Radius ≈ 13 km (NICER-Messung an einem ähnlichen Neutronenstern). Bei 1,4 Sonnenmassen ergibt das ≈ 3 · 10¹⁷ kg/m³ – ein Teelöffel (5 cm³) davon hätte eine Masse von rund 1,5 Milliarden Tonnen (eigene Rechnung).', s: 'nicer-2019' },
      beam: { t: 'Strahlkegel', x: 'Entlang der Magnetachse wird Radio- bis Gammastrahlung gebündelt. Die Magnetachse ist gegen die Drehachse geneigt (Modelle: ≈ 45°, umstritten) – so streicht der Kegel über uns. Der zweite Kegel erzeugt den schwächeren Zwischenpuls bei 0,4 der Periode.', s: 'buhler-2014' },
      lc: { t: 'Lichtzylinder', x: 'Hier liefe ein mitrotierendes Feld mit Lichtgeschwindigkeit: R = c·P/2π ≈ 1.600 km. Eine gedachte Grenze, keine Materie – der Leuchtring markiert sie. Außerhalb öffnen sich die Feldlinien zum Pulsarwind.', s: 'atnf' },
      field: { t: 'Magnetfeld', x: 'Billionenfach stärker als das der Erde. Die geschlossenen Feldlinien drehen sich starr mit dem Stern. Die offenen reichen über den Lichtzylinder hinaus und wickeln sich zur Spirale auf, weil das Feld dort der Drehung nicht mehr nachkommt.', s: 'atnf' },
      wind: { t: 'Gestreifter Wind', x: 'Jenseits des Lichtzylinders strömen Elektronen und Positronen fast mit Lichtgeschwindigkeit nach außen. Weil die Magnetachse schief mitdreht, wechselt das Feld im Wind ständig die Richtung: Streifen, getrennt vom Stromblatt – von der Seite ein S, von oben eine Spirale. Die Farbe zeigt die Feldrichtung. Der Wind trägt den Großteil der Rotationsenergie fort (≈ 5·10³¹ W) und speist den Synchrotronnebel.', s: 'buhler-2014' },
      jet: { t: 'Polstrahl', x: 'Entlang der Drehachse strömt ein schmaler Teil des Winds hinaus. Im Krebsnebel zeigen Hubble und Chandra diesen Jet erst Lichtjahre vom Pulsar entfernt; hier ist er schematisch bis an den Stern herangeführt.', s: 'buhler-2014' },
      polecap: { t: 'Polkappe', x: 'Am Fußpunkt der offenen Feldlinien wird die Oberfläche von zurückfallenden Teilchen auf Millionen Grad geheizt – ein heißer Fleck von wenigen hundert Metern Durchmesser, der im Röntgenlicht pulsiert.', s: 'buhler-2014' },
      interpulse: { t: 'Zwischenpuls', x: 'Der zweite Strahlkegel gehört zum anderen Magnetpol. Er trifft uns bei 0,4 der Periode statt bei 0,5 – die Kegel sind nicht exakt gegenüber. Die Lichtkurve in der Infotafel zeigt beide Pulse mit der laufenden Phase.', s: 'buhler-2014' },
    },
  },
  sgra: {
    n: 7, title: 'Sagittarius A*', kicker: 'Schwarzes Loch', parent: 'galaxy', width: 6e11, dist: 8.277 * KPC, lookback: 8.277 * KPC / 299792458,
    lead: 'Im Zentrum der Milchstraße: 4,3 Millionen Sonnenmassen. Licht wird so stark abgelenkt, dass wir die Rückseite der Scheibe über und unter dem Schatten sehen.',
    facts: [
      { v: '4,30', u: 'Mio. M☉', l: 'Masse (aus Sternbahnen)', s: 'gravity-2022' },
      { v: '12,7', u: 'Mio. km', l: 'Schwarzschild-Radius (0,085 AE)', s: 'gravity-2022' },
      { v: '51,8 ± 2,3', u: 'µas', l: 'Ring-Durchmesser (EHT)', s: 'eht-2022' },
      { v: '16,05', u: 'Jahre', l: 'Umlauf des Sterns S2', s: 'gravity-2020' },
    ],
    note: 'Raytracing in der Schwarzschild-Metrik (Lichtablenkung, Schatten, Doppler-Aufhellung). Die Scheibe ist zur Anschauung dünn, hell und von der Seite gezeigt; Sgr A* hat eine schwache, heiße und dicke Strömung, deren Achse laut EHT eher auf uns zeigt. „EHT-Blick“ zeigt das Bild mit der Auflösung des Event Horizon Telescope; „S-Sterne“ zoomt auf die Bahn von S2 (Elemente GRAVITY 2020). Flare: Fleck auf 3,5 Rs nach GRAVITY 2018. Himmel: Zentralhaufen statistisch.',
    sources: ['gravity-2022', 'gravity-2020', 'gravity-2018', 'gravity-2018b', 'eht-2022', 'eht-2019', 'genzel-2010'],
    hotspots: {
      shadow: { t: 'Schatten', x: 'Aus dieser Richtung erreicht uns kein Licht: Jeder Lichtweg dorthin endet im Ereignishorizont. Weil das Loch Licht ablenkt, erscheint der Schatten 2,6-mal so groß wie der Horizont (√27/2 Rs).', s: 'eht-2022' },
      photon: { t: 'Photonenring', x: 'Licht, das das Loch ein- oder mehrmals umrundet hat, bevor es zu uns kam: ein scharfer, heller Ring am Rand des Schattens.', s: 'eht-2019' },
      doppler: { t: 'Helle Seite', x: 'Das Gas bewegt sich hier mit bis zu halber Lichtgeschwindigkeit auf uns zu. Dadurch wird sein Licht in Bewegungsrichtung gebündelt und ins Blaue verschoben (relativistisches Beaming).', s: 'eht-2019' },
      isco: { t: 'Innerste stabile Bahn', x: 'Bei 3 Schwarzschild-Radien endet die Scheibe: Weiter innen gibt es keine stabilen Kreisbahnen, das Gas fällt ins Schwarze Loch.', s: 'eht-2019' },
      s2: { t: 'Stern S2', x: 'Umrundet Sgr A* in 16,05 Jahren auf einer stark elliptischen Bahn (e = 0,88); im Perizentrum Mai 2018 nur 120 AE entfernt mit 7.650 km/s. Aus solchen Bahnen folgt die Masse (Nobelpreis 2020: Genzel, Ghez). Bahn aus den Elementen, Ort zum heutigen Datum.', s: 'gravity-2020' },
      peri: { t: 'Perizentrum 2018', x: 'Beim engsten Vorbeiflug im Mai 2018 maß GRAVITY die gravitative Rotverschiebung des Sternlichts, 2020 folgte die Periheldrehung der Bahn. Beide Werte stimmen im Rahmen der Messgenauigkeit mit der Allgemeinen Relativitätstheorie überein.', s: 'gravity-2018' },
      flare: { t: 'Flare (heißer Fleck)', x: '2018 verfolgte GRAVITY während dreier Strahlungsausbrüche einen Fleck, der das Loch in etwa 45 Minuten umkreiste – auf rund 3,5 Schwarzschild-Radien, knapp außerhalb der innersten stabilen Bahn, mit 30 % der Lichtgeschwindigkeit. Im Bild als heller Fleck in der Scheibe, Umlauf nach Kepler.', s: 'gravity-2018b' },
      cluster: { t: 'Zentralhaufen', x: 'Um das Schwarze Loch liegt der dichteste Sternhaufen der Milchstraße (Kernsternhaufen): Im Umkreis von einem Parsec stehen Sterne mit zusammen rund einer Million Sonnenmassen. Um die Sonne steht im selben Umkreis kein weiterer Stern; der nächste ist 4,2 Lj (1,3 pc) entfernt. Die innersten, die S-Sterne, umlaufen das Loch in Jahren bis Jahrzehnten.', s: 'genzel-2010' },
    },
  },
  local: {
    n: 8, title: 'Lokale Gruppe', kicker: 'Galaxiengruppe', parent: 'web', width: 5e22, dist: 0, lookback: 0,
    lead: 'Über 100 bekannte Galaxien; die größten sind Andromeda und die Milchstraße. Andromeda nähert sich uns mit rund 110 km/s.',
    facts: [
      { v: '2,5', u: 'Mio. Lj', l: 'Entfernung Andromeda (761 ± 11 kpc)', s: 'li-2021' },
      { v: '109', u: 'km/s', l: 'Annäherung von Andromeda', s: 'vdmarel-2012' },
      { v: '≈ 50 %', u: '', l: 'Chance einer Verschmelzung in 10 Mrd. Jahren', s: 'sawala-2025' },
      { v: '≈ 10', u: 'Mio. Lj', l: 'Durchmesser der Gruppe', s: 'mcconnachie-2012' },
    ],
    note: 'Galaxien an ihren gemessenen Richtungen und Entfernungen (McConnachie 2012), Größen maßstäblich, Formen als Modell; 25 Zwerggalaxien (Auswahl). Zukunft als Zweikörper-Modell (van der Marel 2012) ohne dynamische Reibung; M33 bleibt stehen. Hintergrund-Galaxien statistisch.',
    sources: ['li-2021', 'mcconnachie-2012', 'vdmarel-2012', 'sawala-2025'],
    hotspots: {
      mw: { t: 'Milchstraße', x: 'Unsere Galaxie. Hineinfliegen.', s: 'bland-2016' },
      m31: { t: 'Andromeda (M31)', x: 'Größte Galaxie der Gruppe. Van der Marel et al. 2012 rechneten mit einer Verschmelzung in rund 6 Mrd. Jahren; mit neueren Gaia- und Hubble-Daten liegt die Chance nur bei etwa 50 % innerhalb von 10 Mrd. Jahren (Sawala et al. 2025).', s: 'sawala-2025' },
      m33: { t: 'Dreiecksnebel (M33)', x: 'Drittgrößte Galaxie der Gruppe, 2,7 Mio. Lj entfernt, vermutlich Begleiter von Andromeda.', s: 'mcconnachie-2012' },
      lmc: { t: 'Magellansche Wolken', x: 'Zwei Begleiter der Milchstraße, 160.000 und 200.000 Lj entfernt – mit bloßem Auge am Südhimmel sichtbar.', s: 'mcconnachie-2012' },
      bound: { t: 'Grenze der Gruppe', x: 'Rund 1 Mpc (3,3 Mio. Lj) um den Schwerpunkt zwischen Milchstraße und Andromeda liegt die Nullgeschwindigkeitsfläche: Innerhalb überwiegt die Schwerkraft der Gruppe, außerhalb entfernen sich die Galaxien mit der kosmischen Expansion.', s: 'mcconnachie-2012' },
      future: { t: 'Zukunft', x: 'Zweikörper-Modell: Milchstraße und Andromeda als Punktmassen (1,2 und 1,5 Billionen Sonnenmassen) mit der gemessenen Annäherung von 109 km/s und rund 17 km/s seitlich. Das Modell endet beim ersten Vorbeiflug; danach verschmelzen beide über einige Milliarden Jahre – ob es überhaupt dazu kommt, ist nach Sawala et al. 2025 nur etwa 50:50.', s: 'vdmarel-2012' },
    },
  },
  web: {
    n: 9, title: 'Kosmisches Netz', kicker: 'Großräumige Struktur', parent: 'cmb', width: 1.2e25, dist: 0, lookback: 0,
    lead: 'Galaxien sind in Wänden und Fäden angeordnet, die große Leerräume umschließen; an den Knotenpunkten liegen Galaxienhaufen. Die Lokale Gruppe gehört zum Superhaufen Laniakea.',
    facts: [
      { v: '≈ 520', u: 'Mio. Lj', l: 'Durchmesser Laniakea', s: 'tully-2014' },
      { v: '10¹⁷', u: 'M☉', l: 'Masse von Laniakea', s: 'tully-2014' },
      { v: '≈ 54', u: 'Mio. Lj', l: 'Entfernung Virgo-Haufen', s: 'tully-2014' },
      { v: '77', u: '%', l: 'des Volumens sind Leerräume (15 % der Masse)', s: 'cautun-2014' },
    ],
    note: 'Statistisches Modell (Voronoi-Netz, van de Weygaert & Icke 1989) – nicht die echte Karte. Anteile von Knoten, Fäden, Wänden und Leerräumen nach Cautun et al. 2014. Neun echte Haufen und Superhaufen sowie die Perseus-Pisces-Kette an gemessenen Richtungen und Abständen (Abell 1989, NED; d = cz/H₀). Strömung schematisch aus Punktmassen – keine gemessene Geschwindigkeitskarte.',
    sources: ['tully-2014', 'weygaert', 'cautun-2014', 'abell-1989'],
    hotspots: {
      lg: { t: 'Lokale Gruppe', x: 'Unsere Galaxiengruppe, am Rand eines Fadens. Hineinfliegen.', s: 'tully-2014' },
      virgo: { t: 'Virgo-Haufen', x: 'Über 1.000 Galaxien, rund 54 Mio. Lj entfernt – der nächstgelegene große Galaxienhaufen.', s: 'tully-2014' },
      ga: { t: 'Großer Attraktor', x: 'In diese Richtung bewegen sich die Galaxien von Laniakea (nach Abzug der kosmischen Expansion). Die Region liegt hinter der Ebene der Milchstraße und ist daher schwer zu beobachten.', s: 'tully-2014' },
      void: { t: 'Leerraum', x: 'Leerräume sind fast galaxienleer, typisch 50–100 Mio. Lj groß. Sie füllen gut drei Viertel des Volumens, enthalten aber nur rund 15 % der Masse.', s: 'cautun-2014' },
      shapley: { t: 'Shapley-Superhaufen', x: 'Die massereichste Ansammlung von Galaxienhaufen im nahen Universum, rund 650 Mio. Lj entfernt (z ≈ 0,048) – über 20 reiche Haufen. Laniakea bewegt sich in diese Richtung; Shapley selbst liegt außerhalb von Laniakea.', s: 'tully-2014' },
      coma: { t: 'Coma-Haufen', x: 'Rund 320 Mio. Lj entfernt, über 1.000 Galaxien. Hier fand Fritz Zwicky 1933 einen ersten Hinweis auf Dunkle Materie: Die Galaxien bewegen sich zu schnell, als dass die sichtbare Masse den Haufen zusammenhalten könnte.', s: 'abell-1989' },
      perseus: { t: 'Perseus-Haufen', x: 'Rund 250 Mio. Lj entfernt, hellster Galaxienhaufen im Röntgenlicht; von ihm zieht sich die Perseus-Pisces-Kette, eine der längsten bekannten Strukturen, über 300 Mio. Lj.', s: 'abell-1989' },
      flow: { t: 'Strömung', x: 'Zieht man die Ausdehnung des Universums ab, bewegen sich die Galaxien unserer Umgebung zum Großen Attraktor und weiter zum Shapley-Superhaufen. Tully et al. 2014 definierten damit Laniakea: alle Galaxien, deren Bewegung in dieses Gebiet gerichtet ist – 100.000 Galaxien, 520 Mio. Lj. Hier schematisch aus Punktmassen.', s: 'tully-2014' },
      fornax: { t: 'Fornax-Haufen', x: 'Zweitnächster Galaxienhaufen, rund 60 Mio. Lj entfernt am Südhimmel, kleiner und kompakter als Virgo.', s: 'abell-1989' },
      centaurus: { t: 'Centaurus-Haufen', x: 'Rund 160 Mio. Lj entfernt, zwischen uns und dem Großen Attraktor.', s: 'abell-1989' },
      hydra: { t: 'Hydra-Haufen', x: 'Rund 180 Mio. Lj entfernt; mit Centaurus Teil des Hydra-Centaurus-Superhaufens.', s: 'abell-1989' },
      hercules: { t: 'Hercules-Haufen', x: 'Rund 500 Mio. Lj entfernt, ungewöhnlich reich an Spiralgalaxien; ein dynamisch junger Haufen, der noch nicht im Gleichgewicht ist.', s: 'abell-1989' },
    },
  },
  cmb: {
    n: 10, title: 'Beobachtbares Universum', kicker: 'Kosmologisch', parent: null, width: 1.1e27, dist: 45.3e9 * LY, lookback: 13.787e9 * YEAR,
    lead: 'Die Hintergrundstrahlung ist das älteste beobachtbare Licht: ausgesandt rund 370.000 Jahre nach dem Urknall, als das Universum durchsichtig wurde. Durch die Ausdehnung ist sie heute auf 2,7 K abgekühlt. Die Kugel zeigt, aus welcher Entfernung sie uns erreicht; wir stehen in ihrem Mittelpunkt.',
    facts: [
      { v: '13,787 ± 0,020', u: 'Mrd. J.', l: 'Alter des Universums', s: 'planck-2018' },
      { v: '≈ 46', u: 'Mrd. Lj', l: 'Radius heute (mitbewegt, aus Planck-Werten)', s: 'planck-2018' },
      { v: '2,7255', u: 'K', l: 'Temperatur der Hintergrundstrahlung', s: 'fixsen-2009' },
      { v: '≈ 1:100.000', u: '', l: 'Temperaturschwankungen', s: 'planck-2018' },
    ],
    note: 'Der Blick von außen ist nur eine Darstellung: Jeder Beobachter sieht seine eigene Kugel. Abstände, Alter und Temperaturen im flachen ΛCDM mit Planck-2018-Werten (H₀ = 67,66, Ωm = 0,311) numerisch gerechnet. Muster der Hintergrundstrahlung simuliert mit der gemessenen Fleckengröße (≈ 1°), Farben überhöht; Zeitschichten zu runden Epochen-Werten.',
    sources: ['planck-2018', 'fixsen-2009', 'riess-2022', 'jades-2024', 'madau-2014', 'bromm-2013'],
    hotspots: {
      we: { t: 'Wir', x: 'Mittelpunkt unseres beobachtbaren Universums. Hineinfliegen: das kosmische Netz.', s: 'planck-2018' },
      cmb: { t: 'Hintergrundstrahlung', x: 'Rotverschiebung z ≈ 1.090: Das Licht war beim Aussenden rund 3.000 K heiß. Die Flecken gehen auf Dichteschwankungen zurück, aus denen später Galaxien und Galaxienhaufen entstanden.', s: 'planck-2018' },
      dawn: { t: 'Erste Galaxien', x: 'Das James-Webb-Teleskop sieht Galaxien knapp 300 Mio. Jahre nach dem Urknall (JADES-GS-z14-0, z = 14,3).', s: 'jades-2024' },
      hubble: { t: 'Hubble-Spannung', x: 'Aus der Hintergrundstrahlung folgt H₀ = 67,7 ± 0,4 km/s/Mpc (Planck 2018), aus Cepheiden und Supernovae 73,0 ± 1,0 (SH0ES 2022). Der Unterschied ist bisher ungeklärt.', s: 'riess-2022' },
      probe: { t: 'Blick zurück', x: 'Die blaue Schale zeigt, aus welcher Entfernung uns Licht einer bestimmten Rückblickzeit erreicht – gerechnet im ΛCDM-Modell mit Planck-2018-Werten. Die Infotafel nennt Rotverschiebung, Alter des Universums damals, Temperatur der Hintergrundstrahlung und den heutigen (mitbewegten) Abstand.', s: 'planck-2018' },
      darkenergy: { t: 'Dunkle Energie überwiegt', x: 'Seit z ≈ 0,3 (vor rund 3,5 Mrd. Jahren) ist die Dichte der Dunklen Energie größer als die der Materie. Beschleunigt hat sich die Ausdehnung schon ab z ≈ 0,6, vor rund 6 Mrd. Jahren (eigene Rechnung, ΛCDM mit Planck-2018-Werten).', s: 'planck-2018' },
      noon: { t: 'Höhepunkt der Sternentstehung', x: 'Bei z ≈ 2, etwa 3,3 Mrd. Jahre nach dem Urknall, entstanden im Universum rund zehnmal so viele Sterne pro Jahr wie heute („kosmischer Mittag“).', s: 'madau-2014' },
      reion: { t: 'Reionisation abgeschlossen', x: 'Bis z ≈ 6 (≈ 1 Mrd. Jahre) hat das UV-Licht der ersten Galaxien den neutralen Wasserstoff zwischen den Galaxien wieder ionisiert – das Universum wurde für UV-Licht durchsichtig.', s: 'planck-2018' },
      firststars: { t: 'Erste Sterne', x: 'Bei z ≈ 20 (rund 180 Mio. Jahre) entstanden in kleinen Halos aus Dunkler Materie die ersten Sterne. Nach Modellen waren sie sehr massereich und kurzlebig und bestanden fast nur aus Wasserstoff und Helium. Direkt beobachtet ist bisher keiner.', s: 'bromm-2013' },
    },
  },
};

export const ROUTE = ['earth', 'moon', 'solar', 'sun', 'galaxy', 'orion', 'crab', 'pulsar', 'sgra', 'local', 'web', 'cmb'];
// Äste außerhalb der Route (Kind über parent) zählen für Weiter/Zurück wie ihre nächste Elternstation auf der Route
export function routeIndex(id) {
  for (let x = id; x; x = STATIONS[x] ? STATIONS[x].parent : null) { const i = ROUTE.indexOf(x); if (i >= 0) return i; }
  return 0;
}

// Weg im Baum: vom Start hinaus bis zum gemeinsamen Vorfahren, dann hinein zum Ziel (ohne den Start)
export function pathTo(from, to) {
  const up = (id) => { const a = []; for (let k = id; k; k = STATIONS[k].parent) a.push(k); return a; };
  const A = up(from), B = up(to);
  const lca = A.find((k) => B.includes(k));
  return [...A.slice(1, A.indexOf(lca) + 1), ...B.slice(0, B.indexOf(lca)).reverse()];
}

