// Kurzname je Gruppe für die Reiter-Leiste im Reiter Station (Vorschau 27.10.2026 Reiter:A): ein Wort, höchstens 12 Zeichen,
// an allen Stationen gleiche Wörter (Zeit · Ton · Licht · Himmel · Oberfläche · Bahn · Monde · Feld · Kino). Der volle Name aus
// `group:` bleibt als Überschrift im Inhalt; Gruppen mit gleichem Kurznamen legt layers.js zu einem Reiter zusammen.
// Ohne Eintrag gilt der Name selbst (Test tests/tabs.test.js: jeder Name aus web/js passt in einen Reiter).

export const TABS = {
  'Linsenreflex & Optik': 'Optik', 'Rand und Korona': 'Korona', 'Farbe und Glut': 'Glut',
  'Magnet­bögen': 'Bögen', 'Bewegung der Bögen': 'Bögen',
  'Hintergrundstrahlung': 'Kugel', 'Hülle der Kugel': 'Kugel', 'Schnittkante': 'Kugel', 'Zeitschichten': 'Schichten',
  'Planeten und Kleinkörper': 'Planeten', 'Gezeitenströme (Modell)': 'Gezeiten', 'Strömung (Laniakea)': 'Strömung',
  'Netz der Galaxien': 'Netz', 'Netz der Materie': 'Netz', 'Sterne und Galaxien': 'Sterne',
  'Besonderheiten': 'Details', 'New Horizons': 'Sonde', 'Innerer Aufbau': 'Aufbau',
  'Magnetosphäre': 'Feld', 'Magnetfeld': 'Feld', 'Jupiter-Magnetosphäre': 'Feld',
  'Polarlichter': 'Polarlicht', 'Jupiter-Polarlicht': 'Polarlicht',
  'Erdumlaufbahn': 'Bahn', 'Jupiter und Monde': 'Monde', 'Ringe und Monde': 'Monde', 'Erde am Himmel': 'Himmel',
  'Licht des Gases': 'Gas', 'Gas um das Loch': 'Gas', 'Qualität der Wolke': 'Qualität', 'Staubgürtel und Stern': 'Staub',
};
export const tabOf = (group) => TABS[group] || group;
// Icon je Kurzname für die Kacheln im Reiter Station (User 28.10.2026, Linien-Icons in layers.js ICONS); Test: jeder Kurzname hat eins
const ICON_OF = {
  time: ['Zeit', 'Ereignisse'], sound: ['Ton'], film: ['Film', 'Kino'], tune: ['Ansicht', 'Details'], perf: ['Qualität'],
  sun: ['Sonne', 'Licht'], flame: ['Glut'], corona: ['Korona'], fx: ['Optik', 'Pulsar', 'Blitz'],
  globe: ['Erde', 'Mars', 'Neptun', 'Triton', 'Planet', 'Oberfläche', 'Ozean', 'Lufthülle', 'Atmosphäre', 'Kugel'],
  planet: ['Planeten', 'Ringe', 'System'], moon: ['Monde'], orbit: ['Bahn', 'Achsen', 'Drehung'],
  field: ['Feld', 'Bögen', 'Polarlicht'], burst: ['Ausbrüche', 'Fontänen', 'Vulkane', 'Strahlen', 'Keulen', 'Stoßfronten'],
  wave: ['Ausfluss', 'Strömung', 'Wind', 'Gezeiten', 'Bewegung'], layers: ['Aufbau', 'Schichten', 'Struktur', 'Kern', 'Allgemein'],
  cloud: ['Nebel', 'Gas', 'Gaswolke', 'Krebsnebel', 'Staub', 'Flügel', 'Umgebung'],
  sky: ['Himmel', 'Sternhimmel', 'Sterne', 'Stern', 'Funkeln', 'Hintergrund', 'Strahlung'],
  galaxy: ['Galaxien', 'Milchstraße', 'Fermi-Blasen'], net: ['Netz'], probe: ['Sonde', 'Station', 'Teleskop', 'Sonnenschild'],
};
export const TAB_ICONS = Object.fromEntries(Object.entries(ICON_OF).flatMap(([k, names]) => names.map((n) => [n, k])));
export const tabIcon = (title) => TAB_ICONS[title] || 'layers';
