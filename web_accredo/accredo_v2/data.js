/* ACCREDO · gemeinsame Daten der Hauptseite (index.html) und von ACCREDO_v2
   Klassisches Script (kein Modul): läuft auch per file:// ohne Server. Vor dem Seiten-Script laden.
   Alle Personen, Status, Termine und Aktenzeichen sind Beispieldaten. */
'use strict';

/* ═══ STUDIENGÄNGE & ABLAGEORTE ═══ */
/* Ablage: Moodle-Kurs (Abschnitt 0 = Allgemeines, dann je Studiengang ein Abschnitt in der Reihenfolge von PROGRAMS)
   und Laufwerk X (Abschluss › Studiengang › Phase › Datei, gleicher Dateiname wie in Moodle).
   Moodle-Kurs-ID ist noch nicht festgelegt (vorher Platzhalter 4711, der auf einen echten Kurs zeigen kann).
   Leer lassen → Links öffnen die Moodle-Kurssuche „ACCREDO“. Echte ID eintragen, sobald der Kurs steht. */
const STORAGE = {
  moodleBase: 'https://moodle.hochschule-rhein-waal.de',
  moodleCourseId: '',
  moodleCourseName: 'ACCREDO',
  xRoot: 'X:\\ACCREDO'
};

const PROGRAMS = [
  { id: 'icd',  level: 'bachelor', degree: 'B.A.',  name: 'Information and Communication Design', folder: 'BA_Information_and_Communication_Design' },
  { id: 'iba',  level: 'bachelor', degree: 'B.A.',  name: 'International Business Administration', folder: 'BA_International_Business_Administration' },
  { id: 'ee',   level: 'bachelor', degree: 'B.Sc.', name: 'Environment and Energy', folder: 'BSc_Environment_and_Energy' },
  { id: 'ise',  level: 'bachelor', degree: 'B.Sc.', name: 'Infotronic Systems Engineering', folder: 'BSc_Infotronic_Systems_Engineering' },
  { id: 'mi',   level: 'bachelor', degree: 'B.Sc.', name: 'Medieninformatik', folder: 'BSc_Medieninformatik' },
  { id: 'ml',   level: 'bachelor', degree: 'B.Sc.', name: 'Mobility and Logistics', folder: 'BSc_Mobility_and_Logistics' },
  { id: 'psy',  level: 'bachelor', degree: 'B.Sc.', name: 'Psychologie (Arbeits- und Organisationspsychologie)', folder: 'BSc_Psychologie_AO' },
  { id: 'egov', level: 'bachelor', degree: 'B.Sc.', name: 'Verwaltungsinformatik – E-Government', note: 'auch dual', folder: 'BSc_Verwaltungsinformatik_E-Government' },
  { id: 'di',   level: 'master',   degree: 'M.A.',  name: 'Design and Interaction', folder: 'MA_Design_and_Interaction' },
  { id: 'iecs', level: 'master',   degree: 'M.Sc.', name: 'Information Engineering and Computer Science', folder: 'MSc_Information_Engineering_and_Computer_Science' },
  { id: 'imp',  level: 'master',   degree: 'M.Sc.', name: 'International Management and Psychology', folder: 'MSc_International_Management_and_Psychology' },
  { id: 'ue',   level: 'master',   degree: 'M.Sc.', name: 'Usability Engineering', folder: 'MSc_Usability_Engineering' }
];

const PHASE_FOLDERS = {
  1: 'Phase_1_Initiierung',
  2: 'Phase_2_Curriculum_PO',
  3: 'Phase_3_Recht_Gremien',
  4: 'Phase_4_Selbstbericht',
  5: 'Phase_5_Begutachtung',
  6: 'Phase_6_Antrag_Entscheidung'
};

/* Dokumenttexte je DOC-Nummer; {SG} usw. füllt die Seite beim Anzeigen */
const DOC_TEXT = {
  'DOC-01': `EVALUATIONSBERICHT 2022–2026
Studiengang: {SG}
Aktenzeichen: QM-2026-REAKK

1. STUDIERENDENBEFRAGUNGEN
- Gesamtzufriedenheit: 84 % positiv
- Praxisnahe Projekt- und Laboranteile werden besonders geschätzt.
- Kritik: Workload-Spitze im vorletzten Fachsemester durch zwei parallele Projektmodule.

2. KENNZAHLEN
- Durchschnittliche Studiendauer: 0,8 Fachsemester über der Regelstudienzeit
- Erfolgsquote (Regelstudienzeit + 2 Semester): 89,2 %
- Empfehlung: Prüfungen im vorletzten Semester in der neuen Prüfungsordnung (PO v2.0) entzerren.`,
  'DOC-02': `PROJEKTPLAN REAKKREDITIERUNG
Laufzeit: 01.10.2026 bis 31.10.2027 (13 Monate)

MEILENSTEINE
M1 (Monat 2):  Bestandsaufnahme und Workshop abgeschlossen
M2 (Monat 5):  PO v2.0 und Modulhandbuch fertig
M3 (Monat 7):  Beschluss im Fakultätsrat
M4 (Monat 9):  Selbstbericht an die Agentur
M5 (Monat 11): Begehung durch das Gutachtergremium
M6 (Monat 13): Entscheidung des Akkreditierungsrats`,
  'DOC-03': `PRÜFUNGSORDNUNG (PO v2.0)
für den {SG_ART} {SG}
– ergänzt die Rahmenprüfungsordnung der Hochschule –

§ 4 Regelstudienzeit und Leistungspunkte
(1) Regelstudienzeit und Umfang in Leistungspunkten (ECTS) ergeben sich aus dem Studienverlaufsplan (Anlage 1).
(2) Ein Leistungspunkt entspricht einem Arbeitsaufwand von 25 bis 30 Stunden.

§ 12 Prüfungsformen
(1) Prüfungsleistungen werden erbracht durch
    a) Klausurarbeiten (60–120 Minuten),
    b) mündliche Prüfungen (20–30 Minuten),
    c) Projektarbeiten mit praktischem Anteil und Fachgespräch,
    d) elektronische Prüfungen in gesicherter Umgebung.

§ 18 Nachteilsausgleich
(1) Bei chronischer Erkrankung oder Behinderung gewährt der Prüfungsausschuss auf Antrag angepasste Prüfungsbedingungen, z. B. eine verlängerte Bearbeitungszeit.`,
  'DOC-04': `MODULHANDBUCH 2027
{SG}

MODUL M-101: Einführung in das Fachgebiet
- Leistungspunkte: 6 | Workload: 180 h (Präsenz 60 h, Selbststudium 120 h)
- Qualifikationsziele:
  Die Studierenden können zentrale Begriffe, Methoden und Standards des Fachs benennen, analysieren und in einem ersten Praxisprojekt anwenden.
- Prüfungsform: Projektarbeit mit Prototyp und Präsentation`,
  'DOC-05': `KOMPETENZMATRIX
Zuordnung der Qualifikationsziele zum Hochschulqualifikationsrahmen (HQR), {HQR}:

1. Wissen und Verstehen
   - Module M-101 bis M-106: fachliche Grundlagen
2. Einsatz, Anwendung und Erzeugung von Wissen
   - Labor- und Projektmodule im Studienverlauf
3. Kommunikation und Kooperation
   - Interdisziplinäres Studienprojekt
4. Wissenschaftliches Selbstverständnis
   - Abschlussarbeit und Kolloquium (letztes Fachsemester)`,
  'DOC-06': `PRÜFVERMERK DES JUSTITIARIATS
Az.: JUR-2027-PO-04
Gegenstand: Prüfungsordnung PO v2.0, {SG}

ERGEBNIS
1. Notenbildung und Wiederholung von Prüfungen (§ 14) entsprechen § 64 HG NRW und der Rahmenprüfungsordnung.
2. Die Regelung zum Nachteilsausgleich (§ 18) wahrt die Chancengleichheit.
3. Keine rechtlichen Bedenken. Der Entwurf kann dem Fakultätsrat zur Beschlussfassung vorgelegt werden.`,
  'DOC-07': `STELLUNGNAHME DES FACHSCHAFTSRATS
zum Entwurf der PO v2.0

Der Fachschaftsrat begrüßt:
- die Entzerrung der Prüfungen im vorletzten Semester,
- Projektarbeiten als Prüfungsform in den Modulen M-101 und M-105,
- mehr Wahlfreiheit im Wahlpflichtbereich.

Votum: befürwortet (5 Ja-Stimmen, 0 Nein, 0 Enthaltungen).`,
  'DOC-08': `BESCHLUSSAUSZUG, 84. SITZUNG DES FACHBEREICHSRATS
Datum: 14. April 2027
TOP 4: Neufassung der Prüfungsordnung {SG} (PO v2.0)

BESCHLUSS
Der Fakultätsrat beschließt die Prüfungsordnung (PO v2.0) in der Fassung vom 10.04.2027.

Abstimmung: 11 Ja, 0 Nein, 0 Enthaltungen

Die Ordnung tritt nach Prüfung durch das Präsidium mit der Veröffentlichung im Amtlichen Mitteilungsblatt in Kraft.`,
  'DOC-09': `SELBSTBERICHT ZUR REAKKREDITIERUNG
Studiengang: {SG}
Beauftragte Agentur: [Name der zugelassenen Agentur]

INHALT
1. Profil und Qualifikationsziele
2. Studiengangskonzept und Prüfungsordnung (PO v2.0)
3. Studierbarkeit, Workload-Monitoring und Beratung
4. Personelle Ausstattung
5. Räume, Labore und IT
6. Qualitätssicherung und Weiterentwicklung`,
  'DOC-10': `ANLAGEN: KAPAZITÄTS- UND RESSOURCENNACHWEIS

1. Lehrdeputate
   - 6 Professuren mit je 18 SWS Lehrverpflichtung
   - 4 wissenschaftliche Mitarbeitende mit je 4 SWS
   - Auslastung: 94,2 %

2. Labore
   - Robotics & Usability Lab (24 Arbeitsplätze)
   - XR & Interaction Studio (16 VR/AR-Plätze)
   - MakerSpace und Hardware-Labor (3D-Druck, Sensorik)`,
  'DOC-11': `ABLAUFPLAN DER BEGEHUNG

Tag 1
09:00  Vorgespräch des Gutachtergremiums
10:00  Gespräch mit Hochschulleitung und Dekanat
11:30  Gespräch mit Studiengangsleitung und Curriculums-AG
14:00  Gespräch mit Studierenden (ohne Lehrende)
16:00  Besichtigung von Laboren und Lehrräumen

Tag 2
09:30  Gespräch mit Praxispartnern
11:30  Interne Beratung des Gremiums
13:00  Abschlussgespräch mit mündlicher Rückmeldung`,
  'DOC-12': `AKKREDITIERUNGSBERICHT (ENTWURF)
Studiengang {SG}

TEIL A – PRÜFBERICHT (formale Kriterien)
Alle formalen Kriterien sind erfüllt.

TEIL B – GUTACHTEN (fachlich-inhaltliche Kriterien)
Profil, Curriculum und Praxisbezug sind schlüssig aufeinander abgestimmt.

EMPFEHLUNGEN (keine Auflagen)
E1: Englischsprachige Fachliteratur in Modul M-104 erweitern.
E2: Studentische Forschungsergebnisse stärker auf Fachtagungen zeigen.

BESCHLUSSEMPFEHLUNG
Akkreditierung ohne Auflagen.`,
  'DOC-13': `STELLUNGNAHME DER HOCHSCHULE ZUM AKKREDITIERUNGSBERICHT

1. Die Hochschule dankt dem Gutachtergremium für die Rückmeldung.
2. Zu E1: Im Modulhandbuch (M-104) sind drei zusätzliche internationale Standardwerke aufgenommen.
3. Zu E2: Ein Fonds für Reisekosten zu studentischen Konferenzbeiträgen wird eingerichtet.

Der Antrag auf Akkreditierung wird über ELIAS gestellt.`,
  'DOC-14': `ENTSCHEIDUNG DES AKKREDITIERUNGSRATS
Aktenzeichen: AR-2027-PROG-8821

Der Akkreditierungsrat hat in seiner Sitzung vom 24. Oktober 2027 entschieden:
Der {SG_ART}
„{SG}“
wird gemäß § 22 StudakVO NRW akkreditiert.

Siegel: Siegel des Akkreditierungsrats
Geltungszeitraum: 01.10.2027 bis 30.09.2035 (8 Jahre, § 26)
Auflagen: keine`
};
