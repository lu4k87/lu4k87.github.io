// Kurzname je Gruppe für die Reiter-Leiste im Ebenen-Fenster (Vorschau 27.10.2026 Reiter:A): ein Wort, höchstens 12 Zeichen,
// an allen Stationen gleiche Wörter (Zeit · Ton · Licht · Himmel · Oberfläche · Bahn · Monde · Feld · Kino). Der volle Name aus
// `group:` bleibt als Überschrift im Inhalt; Gruppen mit gleichem Kurznamen legt layers.js zu einem Reiter zusammen.
// Ohne Eintrag gilt der Name selbst (Test tests/tabs.test.js: jeder Name aus web/js passt in einen Reiter).

export const TABS = {
  'Linsenreflex & Optik': 'Optik', 'Rand und Korona': 'Korona', 'Farbe und Glut': 'Glut',
  'Magnet­bögen': 'Bögen', 'Bewegung der Bögen': 'Bögen',
  'Hintergrundstrahlung': 'Strahlung', 'Zeitschichten': 'Schichten',
  'Planeten und Kleinkörper': 'Planeten', 'Gezeitenströme (Modell)': 'Gezeiten', 'Strömung (Laniakea)': 'Strömung',
  'Netz der Galaxien': 'Netz', 'Netz der Materie': 'Netz', 'Sterne und Galaxien': 'Sterne',
  'Besonderheiten': 'Details', 'New Horizons': 'Sonde', 'Innerer Aufbau': 'Aufbau',
  'Magnetosphäre': 'Feld', 'Magnetfeld': 'Feld', 'Jupiter-Magnetosphäre': 'Feld',
  'Polarlichter': 'Polarlicht', 'Jupiter-Polarlicht': 'Polarlicht',
  'Erdumlaufbahn': 'Bahn', 'Jupiter und Monde': 'Monde', 'Ringe und Monde': 'Monde', 'Erde am Himmel': 'Himmel',
  'Licht des Gases': 'Gas', 'Gas um das Loch': 'Gas', 'Qualität der Wolke': 'Qualität', 'Staubgürtel und Stern': 'Staub',
};
export const tabOf = (group) => TABS[group] || group;
