/* ACCREDO · Leitfaden Reakkreditierung
   Alle Personen, Status, Termine und Aktenzeichen sind Beispieldaten. */
'use strict';

/* ---------- Ablage ----------
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

const MONTHS = ['Okt', 'Nov', 'Dez', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt'];
const YEARS  = [2026, 2026, 2026, 2027, 2027, 2027, 2027, 2027, 2027, 2027, 2027, 2027, 2027];

const ROLES = [
  { id: 'all',  label: 'Alle' },
  { id: 'sgl',  label: 'Studiengangsleitung' },
  { id: 'qm',   label: 'Qualitätsmanagement' },
  { id: 'stud', label: 'Studierende' },
  { id: 'recht',label: 'Prüfungsausschuss & Justitiariat' },
  { id: 'gremien', label: 'Fakultätsrat, Dekanat & Präsidium' },
  { id: 'extern',  label: 'Agentur & Akkreditierungsrat' }
];

const PEOPLE = {
  weber:    { name: 'Prof. Dr. Miriam Weber', role: 'Studiengangsleitung', group: 'sgl' },
  becker:   { name: 'Dr. Laurenz Becker', role: 'Qualitätsmanagement (Akkreditierung)', group: 'qm' },
  klein:    { name: 'Samira Klein', role: 'Fachschaftsrat · Studierendenvertretung', group: 'stud' },
  sommer:   { name: 'Prof. Dr. Klaus Sommer', role: 'Vorsitz Prüfungsausschuss', group: 'recht' },
  lindner:  { name: 'Prof. Dr. Jens Lindner', role: 'Modulkoordination', group: 'sgl' },
  hoffmann: { name: 'Barbara Hoffmann', role: 'Justitiariat', group: 'recht' },
  neumann:  { name: 'Prof. Dr. Anke Neumann', role: 'Dekanin · Vorsitz Fakultätsrat', group: 'gremien' },
  praesidium: { name: 'Präsidium', role: 'Hochschulleitung', group: 'gremien' },
  richter:  { name: 'Torsten Richter', role: 'Dezernat Finanzen & Personal', group: 'gremien' },
  voelkel:  { name: 'Dr. Susanne Völkel', role: 'Referentin der Agentur', group: 'extern' },
  brandt:   { name: 'Prof. Dr. Hendrik Brandt', role: 'Sprecher Gutachtergremium', group: 'extern' },
  ar:       { name: 'Akkreditierungsrat', role: 'Stiftung Akkreditierungsrat, Bonn', group: 'extern' }
};

const PHASES = [
  {
    n: 1, short: 'Initiierung', title: 'Initiierung und Bestandsaufnahme', start: 1, end: 2,
    milestone: 'Startfreigabe', bar: 'Startfreigabe',
    desc: 'Auswertung der Studierendenbefragungen, Verbleibsstudien und Workload-Erhebungen. Festlegung des Zeitplans und Einberufung der Curriculums-AG des Studiengangs, die die neue Prüfungsordnung vorbereitet.',
    raci: [['weber', 'A'], ['becker', 'R'], ['klein', 'C'], ['neumann', 'I']],
    steps: [
      ['Studienerfolgsanalyse', 'Auswertung von Abbruchquoten, Studiendauer und ECTS-Fortschritt je Fachsemester.', ['studak-14']],
      ['Qualitätsdialog', 'Gespräche mit Lehrenden, Studierenden, Praxisbeirat und Alumni zur Arbeitsmarktrelevanz.', ['esg-19']],
      ['Zeitplan', 'Fristenkalender für die Gremienläufe, Vorlage beim Präsidium.', []]
    ],
    docs: ['DOC-01', 'DOC-02'],
    gate: { title: 'Gate 1 · Übergabe an die Curriculums-AG', from: 'Studiengangsleitung', to: 'Curriculums-AG', text: 'Bedarfs- und Schwachstellenanalyse geht an die Arbeitsgruppe. Den Vorsitz der AG hat die Studiengangsleitung; die Übergabe ist deshalb ein Arbeitsauftrag, kein Wechsel der Verantwortung.' }
  },
  {
    n: 2, short: 'Curriculum & PO', title: 'Curriculum und Prüfungsordnung überarbeiten', start: 3, end: 5,
    milestone: 'PO-Entwurf v2.0', bar: 'PO-Entwurf',
    desc: 'Neuer Studienverlaufsplan, überarbeitetes Modulhandbuch und Neufassung der studiengangsspezifischen Prüfungsordnung (PO). Prüfungsformen werden auf kompetenzorientierte Lernziele abgestimmt. Studierende wirken an der Ausarbeitung mit.',
    raci: [['weber', 'R'], ['neumann', 'A'], ['sommer', 'C'], ['lindner', 'C'], ['klein', 'C'], ['becker', 'I']],
    steps: [
      ['Prüfungsordnung neu fassen', 'Fristen, Nachteilsausgleich, Anerkennung externer Leistungen, Wiederholung von Prüfungen.', ['hg-64']],
      ['Module und Leistungspunkte', 'Modulbeschreibungen mit Lernergebnissen, Prüfungsform und Workload (25–30 Stunden je Leistungspunkt).', ['studak-7-8']],
      ['Abstimmung mit dem Prüfungsausschuss', 'Klärung rechtlicher Fragen bei Antwort-Wahl- und E-Prüfungen.', []]
    ],
    docs: ['DOC-03', 'DOC-04', 'DOC-05'],
    gate: { title: 'Gate 2 · Übergabe zur Rechtsprüfung', from: 'Curriculums-AG', to: 'Justitiariat & Präsidium', text: 'Vollständiger PO-Entwurf mit Modulhandbuch geht zur rechtlichen Prüfung und danach in den Fakultätsrat.' }
  },
  {
    n: 3, short: 'Recht & Beschluss', title: 'Rechtsprüfung und Beschluss im Fakultätsrat', start: 6, end: 7,
    milestone: 'Beschluss Fakultätsrat', bar: 'Beschluss',
    desc: 'Das Justitiariat prüft den Entwurf für das Präsidium formal und inhaltlich. Der Fachschaftsrat nimmt Stellung, danach beschließt der Fakultätsrat die Prüfungsordnung. In Kraft tritt sie erst mit der Veröffentlichung.',
    raci: [['hoffmann', 'R'], ['praesidium', 'C'], ['neumann', 'A'], ['klein', 'C'], ['weber', 'I']],
    steps: [
      ['Rechtsprüfung', 'Widerspruchsfristen, Befugnisse des Prüfungsausschusses, Vereinbarkeit mit dem Hochschulgesetz. Das Präsidium prüft die Rechtmäßigkeit vor der Veröffentlichung.', ['hg-64', 'hg-2']],
      ['Stellungnahme der Studierenden', 'Anhörung des Fachschaftsrats zu Studierbarkeit und Prüfungsbelastung.', ['hg-64']],
      ['Sitzung des Fakultätsrats', 'Beratung und Beschluss der Prüfungsordnung.', ['hg-64']]
    ],
    docs: ['DOC-06', 'DOC-07', 'DOC-08'],
    gate: { title: 'Gate 3 · Übergabe an das Qualitätsmanagement', from: 'Dekanat', to: 'Qualitätsmanagement', text: 'Die beschlossene Prüfungsordnung geht in den Selbstbericht. Die Veröffentlichung im Amtlichen Mitteilungsblatt wird parallel vorbereitet.' }
  },
  {
    n: 4, short: 'Selbstbericht', title: 'Selbstbericht und Anlagen erstellen', start: 8, end: 9,
    milestone: 'Einreichung bei der Agentur', bar: 'Einreichung',
    desc: 'Selbstbericht nach den Kriterien der StudakVO NRW, unter Beteiligung der Studierendenvertretung. Dazu kommen die Nachweise zu Personal, Laboren, Internationalisierung und Studienerfolg.',
    raci: [['becker', 'R'], ['weber', 'A'], ['klein', 'C'], ['richter', 'C'], ['praesidium', 'I']],
    steps: [
      ['Selbstbericht', 'Qualifikationsziele, Studiengangskonzept, didaktische Konzepte, Geschlechtergerechtigkeit und Nachteilsausgleich.', ['studak-11-12', 'studak-15', 'studak-24']],
      ['Kapazitätsnachweis', 'Nachweis, dass das Lehrangebot personell abgesichert ist.', ['kapvo']],
      ['Freigabe durch das Präsidium', 'Vorlage beim Präsidium vor der Übermittlung an die Agentur.', []]
    ],
    docs: ['DOC-09', 'DOC-10'],
    gate: { title: 'Gate 4 · Einreichung bei der Agentur', from: 'Qualitätsmanagement', to: 'Akkreditierungsagentur', text: 'Gesamtpaket an die Agentur, die die Hochschule beauftragt hat. Die Agentur muss beim Akkreditierungsrat zugelassen sein.' }
  },
  {
    n: 5, short: 'Begutachtung', title: 'Begutachtung durch das Gutachtergremium', start: 10, end: 11,
    milestone: 'Akkreditierungsbericht (Entwurf)', bar: 'Berichtsentwurf',
    desc: 'Das Gutachtergremium besteht aus mindestens zwei Hochschullehrenden, einer Person aus der Berufspraxis und einer bzw. einem Studierenden. Die Agentur erstellt den Akkreditierungsbericht aus Prüfbericht (formale Kriterien) und Gutachten (fachlich-inhaltliche Kriterien).',
    note: 'Monat 10–11 entspricht Juli/August 2027 und fällt damit größtenteils in die vorlesungsfreie Zeit. Die Begehung sollte so terminiert werden, dass Studierende an den Gesprächen teilnehmen können. Bei einer Reakkreditierung kann auf die Begehung auch verzichtet werden.',
    raci: [['brandt', 'R'], ['voelkel', 'A'], ['weber', 'C'], ['klein', 'C'], ['becker', 'C']],
    steps: [
      ['Begehung', 'Zwei Tage mit getrennten Gesprächsrunden, Studierende ohne Lehrende.', ['studak-24', 'studak-25']],
      ['Labore und Räume', 'Arbeitsplätze, Softwarelizenzen und Barrierefreiheit.', []],
      ['Akkreditierungsbericht', 'Mündliche Rückmeldung, danach Berichtsentwurf der Agentur mit Empfehlungen.', ['studak-24']]
    ],
    docs: ['DOC-11', 'DOC-12'],
    gate: { title: 'Gate 5 · Berichtsentwurf an die Hochschule', from: 'Agentur', to: 'Hochschule (QM)', text: 'Die Agentur sendet den Entwurf des Akkreditierungsberichts zur Stellungnahme. Danach erstellt sie die finale Fassung.' }
  },
  {
    n: 6, short: 'Antrag & Entscheidung', title: 'Antrag beim Akkreditierungsrat und Entscheidung', start: 12, end: 13,
    milestone: 'Akkreditiert für 8 Jahre', bar: 'Entscheidung',
    desc: 'Stellungnahme zum Berichtsentwurf, Antrag in ELIAS, dem elektronischen Antragssystem des Akkreditierungsrats. Der Akkreditierungsrat entscheidet und vergibt sein Siegel. Die Prüfungsordnung wird im Amtlichen Mitteilungsblatt veröffentlicht.',
    raci: [['becker', 'R'], ['praesidium', 'A'], ['weber', 'C'], ['ar', 'I'], ['klein', 'I']],
    steps: [
      ['Stellungnahme', 'Umgang mit den Empfehlungen und Richtigstellung sachlicher Details.', []],
      ['Antrag in ELIAS', 'Selbstbericht und finaler Akkreditierungsbericht werden elektronisch eingereicht.', ['studak-23']],
      ['Entscheidung', 'Der Akkreditierungsrat entscheidet über die Akkreditierung; die Reakkreditierung gilt acht Jahre.', ['studak-22', 'studak-26']],
      ['Veröffentlichung', 'Bekanntmachung der neuen Prüfungsordnung im Amtlichen Mitteilungsblatt (Nr. 14/2027).', ['hg-2']]
    ],
    docs: ['DOC-13', 'DOC-14'],
    gate: { title: 'Abschluss · Reakkreditierung', from: 'Akkreditierungsrat', to: 'Hochschule', text: 'Der Studiengang ist bis 30.09.2035 akkreditiert. Alle Dokumente liegen im Moodle-Kurs und auf Laufwerk X.' }
  }
];

const LAWS = [
  { id: 'studak-7-8', code: 'StudakVO NRW §§ 7, 8', title: 'Modularisierung und Leistungspunkte', text: 'Module, Modulbeschreibungen, 25–30 Stunden Arbeitsaufwand je Leistungspunkt.', url: 'https://recht.nrw.de/gvnrw/2018-s98/', phases: [2] },
  { id: 'studak-11-12', code: 'StudakVO NRW §§ 11, 12', title: 'Qualifikationsziele und Studiengangskonzept', text: 'Abschlussniveau nach dem Hochschulqualifikationsrahmen (HQR), schlüssiges Konzept und Umsetzung.', url: 'https://recht.nrw.de/gvnrw/2018-s98/', phases: [4] },
  { id: 'studak-14', code: 'StudakVO NRW § 14', title: 'Studienerfolg', text: 'Kontinuierliches Monitoring des Studiengangs unter Beteiligung von Studierenden und Absolventen.', url: 'https://recht.nrw.de/gvnrw/2018-s98/', phases: [1] },
  { id: 'studak-15', code: 'StudakVO NRW § 15', title: 'Geschlechtergerechtigkeit und Nachteilsausgleich', text: 'Konzepte der Hochschule zur Chancengleichheit werden auf Studiengangsebene umgesetzt.', url: 'https://recht.nrw.de/gvnrw/2018-s98/', phases: [4] },
  { id: 'studak-22', code: 'StudakVO NRW § 22', title: 'Entscheidung des Akkreditierungsrats', text: 'Der Akkreditierungsrat entscheidet auf Antrag der Hochschule und vergibt sein Siegel.', url: 'https://recht.nrw.de/gvnrw/2018-s98/', phases: [6] },
  { id: 'studak-23', code: 'StudakVO NRW § 23', title: 'Antrag und Unterlagen', text: 'Selbstbericht und Akkreditierungsbericht; die Antragstellung erfolgt elektronisch über ELIAS.', url: 'https://akkreditierungsrat.de/elias-ar-datenanalyse/was-ist-elias/elias-antragstellung/', phases: [6] },
  { id: 'studak-24', code: 'StudakVO NRW § 24', title: 'Begutachtung und Akkreditierungsbericht', text: 'Selbstbericht unter Beteiligung der Studierendenvertretung, Begehung (bei Reakkreditierung verzichtbar), Prüfbericht und Gutachten.', url: 'https://recht.nrw.de/gvnrw/2018-s98/', phases: [4, 5] },
  { id: 'studak-25', code: 'StudakVO NRW § 25', title: 'Gutachtergremium', text: 'Mindestens zwei Hochschullehrende, eine Person aus der Berufspraxis, eine Studierende oder ein Studierender.', url: 'https://recht.nrw.de/gvnrw/2018-s98/', phases: [5] },
  { id: 'studak-26', code: 'StudakVO NRW § 26', title: 'Geltungszeitraum', text: 'Acht Jahre ab Beginn des Semesters, in dem die Entscheidung bekanntgegeben wird – auch bei Reakkreditierung.', url: 'https://recht.nrw.de/gvnrw/2018-s98/', phases: [6] },
  { id: 'hg-64', code: 'HG NRW § 64', title: 'Prüfungsordnungen', text: 'Der Fachbereichsrat (an der Hochschule: Fakultätsrat) erlässt die Prüfungsordnung nach Überprüfung durch das Präsidium; Studierende werden an der Ausarbeitung beteiligt.', url: 'https://recht.nrw.de/lrgv/gesetz/12122013-gesetz-ueber-die-hochschulen-des-landes-nordrhein-westfalen-hochschulgesetz-hg/', phases: [2, 3] },
  { id: 'hg-2', code: 'HG NRW § 2 Abs. 4', title: 'Ordnungen der Hochschule', text: 'Das Präsidium prüft Ordnungen vor ihrer Veröffentlichung auf Rechtmäßigkeit; wirksam werden sie mit der Bekanntmachung.', url: 'https://recht.nrw.de/lrgv/gesetz/12122013-gesetz-ueber-die-hochschulen-des-landes-nordrhein-westfalen-hochschulgesetz-hg/', phases: [3, 6] },
  { id: 'esg-19', code: 'ESG 1.9', title: 'Laufendes Monitoring', text: 'Europäische Standards: Studiengänge werden regelmäßig überprüft und weiterentwickelt.', phases: [1] },
  { id: 'kapvo', code: 'KapVO NRW', title: 'Kapazitätsverordnung', text: 'Grundlage für die Berechnung der Lehrkapazität und Deputate.', phases: [4] }
];

/* Einheitliche Status: Entwurf → In Prüfung → Freigegeben → Beschlossen → Eingereicht → Entschieden */
const STATUS = {
  'Entwurf':     { cls: 'st-draft',   text: 'in Bearbeitung oder zur Stellungnahme' },
  'In Prüfung':  { cls: 'st-review',  text: 'liegt der nächsten Stelle zur Prüfung vor' },
  'Freigegeben': { cls: 'st-ok',      text: 'inhaltlich abgenommen' },
  'Beschlossen': { cls: 'st-ok',      text: 'von einem Gremium beschlossen' },
  'Eingereicht': { cls: 'st-sent',    text: 'an eine externe Stelle übermittelt' },
  'Entschieden': { cls: 'st-decided', text: 'Entscheidung des Akkreditierungsrats liegt vor' }
};

const DOCS = {
  'DOC-01': { title: 'Bestandsaufnahme und Evaluationsbericht 2022–2026', file: 'DOC-01_Bestandsaufnahme_Evaluationsbericht_2022-2026.pdf', type: 'Evaluationsbericht', phase: 1, ver: 'v1.2', status: 'Freigegeben', size: '4,2 MB', author: 'Dr. Laurenz Becker (QM)', to: 'Studiengangsleitung, Curriculums-AG',
    chain: [['QM: Datenerhebung', 1], ['Fakultätsrat: zur Kenntnis', 1], ['Studiengangsleitung: Abnahme', 1]],
    content: `EVALUATIONSBERICHT 2022–2026
Studiengang: {SG}
Aktenzeichen: QM-2026-REAKK

1. STUDIERENDENBEFRAGUNGEN
- Gesamtzufriedenheit: 84 % positiv
- Praxisnahe Projekt- und Laboranteile werden besonders geschätzt.
- Kritik: Workload-Spitze im vorletzten Fachsemester durch zwei parallele Projektmodule.

2. KENNZAHLEN
- Durchschnittliche Studiendauer: 0,8 Fachsemester über der Regelstudienzeit
- Erfolgsquote (Regelstudienzeit + 2 Semester): 89,2 %
- Empfehlung: Prüfungen im vorletzten Semester in der neuen Prüfungsordnung (PO v2.0) entzerren.` },
  'DOC-02': { title: 'Projektplan und Meilensteine', file: 'DOC-02_Projektplan_Meilensteine_Reakkreditierung.pdf', type: 'Zeitplan', phase: 1, ver: 'v1.0', status: 'Freigegeben', size: '1,1 MB', author: 'Prof. Dr. Miriam Weber (Studiengangsleitung)', to: 'Dekanat, Präsidium',
    chain: [['Studiengangsleitung: erstellt', 1], ['Dekanat: bestätigt', 1], ['Präsidium: freigegeben', 1]],
    content: `PROJEKTPLAN REAKKREDITIERUNG
Laufzeit: 01.10.2026 bis 31.10.2027 (13 Monate)

MEILENSTEINE
M1 (Monat 2):  Bestandsaufnahme und Workshop abgeschlossen
M2 (Monat 5):  PO v2.0 und Modulhandbuch fertig
M3 (Monat 7):  Beschluss im Fakultätsrat
M4 (Monat 9):  Selbstbericht an die Agentur
M5 (Monat 11): Begehung durch das Gutachtergremium
M6 (Monat 13): Entscheidung des Akkreditierungsrats` },
  'DOC-03': { title: 'Entwurf Prüfungsordnung PO v2.0', file: 'DOC-03_Entwurf_Pruefungsordnung_PO_v2.0.pdf', type: 'Satzungsentwurf', phase: 2, ver: 'v2.0 Entwurf', status: 'In Prüfung', size: '850 KB', author: 'Curriculums-AG (Weber, Lindner)', to: 'Prüfungsausschuss, Justitiariat',
    chain: [['Curriculums-AG: Entwurf', 1], ['Prüfungsausschuss: Prüfung', 0], ['Justitiariat: Rechtsprüfung', 0]],
    content: `PRÜFUNGSORDNUNG (PO v2.0)
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
(1) Bei chronischer Erkrankung oder Behinderung gewährt der Prüfungsausschuss auf Antrag angepasste Prüfungsbedingungen, z. B. eine verlängerte Bearbeitungszeit.` },
  'DOC-04': { title: 'Modulhandbuch', file: 'DOC-04_Modulhandbuch_Curriculum_Gesamt.pdf', type: 'Modulhandbuch', phase: 2, ver: 'v2.1', status: 'Freigegeben', size: '6,8 MB', author: 'Modulverantwortliche, Curriculums-AG', to: 'Dekanat, Agentur',
    chain: [['Modulverantwortliche: erstellt', 1], ['Curriculums-AG: zusammengeführt', 1], ['QM: formale Prüfung', 1]],
    content: `MODULHANDBUCH 2027
{SG}

MODUL M-101: Einführung in das Fachgebiet
- Leistungspunkte: 6 | Workload: 180 h (Präsenz 60 h, Selbststudium 120 h)
- Qualifikationsziele:
  Die Studierenden können zentrale Begriffe, Methoden und Standards des Fachs benennen, analysieren und in einem ersten Praxisprojekt anwenden.
- Prüfungsform: Projektarbeit mit Prototyp und Präsentation` },
  'DOC-05': { title: 'Kompetenzmatrix und Qualifikationsziele', file: 'DOC-05_Kompetenzmatrix_Qualifikationsziele.pdf', type: 'Matrix', phase: 2, ver: 'v1.4', status: 'Freigegeben', size: '1,9 MB', author: 'Curriculums-AG, QM', to: 'Gutachtergremium',
    chain: [['Curriculums-AG: Zuordnung', 1], ['Fachschaft: Rückmeldung', 1], ['QM: Freigabe', 1]],
    content: `KOMPETENZMATRIX
Zuordnung der Qualifikationsziele zum Hochschulqualifikationsrahmen (HQR), {HQR}:

1. Wissen und Verstehen
   - Module M-101 bis M-106: fachliche Grundlagen
2. Einsatz, Anwendung und Erzeugung von Wissen
   - Labor- und Projektmodule im Studienverlauf
3. Kommunikation und Kooperation
   - Interdisziplinäres Studienprojekt
4. Wissenschaftliches Selbstverständnis
   - Abschlussarbeit und Kolloquium (letztes Fachsemester)` },
  'DOC-06': { title: 'Prüfvermerk des Justitiariats', file: 'DOC-06_Justitiariat_Pruefvermerk.pdf', type: 'Rechtsprüfung', phase: 3, ver: 'v1.0', status: 'Freigegeben', size: '620 KB', author: 'Barbara Hoffmann (Justitiariat)', to: 'Präsidium, Dekanat',
    chain: [['Justitiariat: Rechtsprüfung', 1], ['Prüfungsausschuss: Abstimmung', 1], ['Präsidium: zur Kenntnis', 1]],
    content: `PRÜFVERMERK DES JUSTITIARIATS
Az.: JUR-2027-PO-04
Gegenstand: Prüfungsordnung PO v2.0, {SG}

ERGEBNIS
1. Notenbildung und Wiederholung von Prüfungen (§ 14) entsprechen § 64 HG NRW und der Rahmenprüfungsordnung.
2. Die Regelung zum Nachteilsausgleich (§ 18) wahrt die Chancengleichheit.
3. Keine rechtlichen Bedenken. Der Entwurf kann dem Fakultätsrat zur Beschlussfassung vorgelegt werden.` },
  'DOC-07': { title: 'Stellungnahme des Fachschaftsrats', file: 'DOC-07_Stellungnahme_Fachschaftsrat.pdf', type: 'Stellungnahme', phase: 3, ver: 'v1.0', status: 'Beschlossen', size: '450 KB', author: 'Samira Klein (Fachschaftsrat)', to: 'Fakultätsrat',
    chain: [['Fachschaft: Vollversammlung', 1], ['Fachschaftsrat: Beschluss', 1], ['Fakultätsrat: übergeben', 1]],
    content: `STELLUNGNAHME DES FACHSCHAFTSRATS
zum Entwurf der PO v2.0

Der Fachschaftsrat begrüßt:
- die Entzerrung der Prüfungen im vorletzten Semester,
- Projektarbeiten als Prüfungsform in den Modulen M-101 und M-105,
- mehr Wahlfreiheit im Wahlpflichtbereich.

Votum: befürwortet (5 Ja-Stimmen, 0 Nein, 0 Enthaltungen).` },
  'DOC-08': { title: 'Beschluss des Fakultätsrats zur PO', file: 'DOC-08_Fakultätsratsbeschluss_PO_Auszug.pdf', type: 'Beschlussauszug', phase: 3, ver: 'final', status: 'Beschlossen', size: '1,4 MB', author: 'Prof. Dr. Anke Neumann (Dekanin)', to: 'QM, Präsidium',
    chain: [['Fakultätsrat: 1. Lesung', 1], ['Fakultätsrat: 2. Lesung und Beschluss', 1], ['Dekanin: Ausfertigung', 1]],
    content: `BESCHLUSSAUSZUG, 84. SITZUNG DES FACHBEREICHSRATS
Datum: 14. April 2027
TOP 4: Neufassung der Prüfungsordnung {SG} (PO v2.0)

BESCHLUSS
Der Fakultätsrat beschließt die Prüfungsordnung (PO v2.0) in der Fassung vom 10.04.2027.

Abstimmung: 11 Ja, 0 Nein, 0 Enthaltungen

Die Ordnung tritt nach Prüfung durch das Präsidium mit der Veröffentlichung im Amtlichen Mitteilungsblatt in Kraft.` },
  'DOC-09': { title: 'Selbstbericht', file: 'DOC-09_Selbstbericht_Hauptteil.pdf', type: 'Selbstbericht', phase: 4, ver: 'v1.0', status: 'Eingereicht', size: '14,2 MB', author: 'Dr. Laurenz Becker, Prof. Dr. Miriam Weber', to: 'Akkreditierungsagentur',
    chain: [['QM: Redaktion', 1], ['Fachschaftsrat: beteiligt', 1], ['Dekanat: gegengezeichnet', 1], ['Präsidium: Freigabe', 1]],
    content: `SELBSTBERICHT ZUR REAKKREDITIERUNG
Studiengang: {SG}
Beauftragte Agentur: [Name der zugelassenen Agentur]

INHALT
1. Profil und Qualifikationsziele
2. Studiengangskonzept und Prüfungsordnung (PO v2.0)
3. Studierbarkeit, Workload-Monitoring und Beratung
4. Personelle Ausstattung
5. Räume, Labore und IT
6. Qualitätssicherung und Weiterentwicklung` },
  'DOC-10': { title: 'Anlagen: Kapazitäts- und Ressourcennachweis', file: 'DOC-10_Anlagen_Kapazitaet_Ressourcen.pdf', type: 'Anlagenband', phase: 4, ver: 'v1.0', status: 'Freigegeben', size: '8,9 MB', author: 'Dezernat Finanzen & Personal', to: 'Akkreditierungsagentur',
    chain: [['Personaldezernat: Deputate berechnet', 1], ['Dekanat: bestätigt', 1], ['QM: gebündelt', 1]],
    content: `ANLAGEN: KAPAZITÄTS- UND RESSOURCENNACHWEIS

1. Lehrdeputate
   - 6 Professuren mit je 18 SWS Lehrverpflichtung
   - 4 wissenschaftliche Mitarbeitende mit je 4 SWS
   - Auslastung: 94,2 %

2. Labore
   - Robotics & Usability Lab (24 Arbeitsplätze)
   - XR & Interaction Studio (16 VR/AR-Plätze)
   - MakerSpace und Hardware-Labor (3D-Druck, Sensorik)` },
  'DOC-11': { title: 'Ablaufplan der Begehung', file: 'DOC-11_Ablaufplan_Begehung.pdf', type: 'Ablaufplan', phase: 5, ver: 'v1.0', status: 'Freigegeben', size: '380 KB', author: 'Dr. Susanne Völkel (Agentur)', to: 'Gutachtergremium, Hochschule',
    chain: [['Agentur: abgestimmt', 1], ['Hochschule: bestätigt', 1], ['Gutachtergremium: durchgeführt', 1]],
    content: `ABLAUFPLAN DER BEGEHUNG

Tag 1
09:00  Vorgespräch des Gutachtergremiums
10:00  Gespräch mit Hochschulleitung und Dekanat
11:30  Gespräch mit Studiengangsleitung und Curriculums-AG
14:00  Gespräch mit Studierenden (ohne Lehrende)
16:00  Besichtigung von Laboren und Lehrräumen

Tag 2
09:30  Gespräch mit Praxispartnern
11:30  Interne Beratung des Gremiums
13:00  Abschlussgespräch mit mündlicher Rückmeldung` },
  'DOC-12': { title: 'Akkreditierungsbericht (Entwurf)', file: 'DOC-12_Akkreditierungsbericht_Entwurf.pdf', type: 'Prüfbericht und Gutachten', phase: 5, ver: 'v1.0 Entwurf', status: 'Entwurf', size: '3,4 MB', author: 'Agentur mit Gutachtergremium (Sprecher: Prof. Dr. Brandt)', to: 'Hochschule zur Stellungnahme',
    chain: [['Gutachtergremium: Gutachten', 1], ['Agentur: Prüfbericht formale Kriterien', 1], ['Hochschule: Stellungnahme', 0]],
    content: `AKKREDITIERUNGSBERICHT (ENTWURF)
Studiengang {SG}

TEIL A – PRÜFBERICHT (formale Kriterien)
Alle formalen Kriterien sind erfüllt.

TEIL B – GUTACHTEN (fachlich-inhaltliche Kriterien)
Profil, Curriculum und Praxisbezug sind schlüssig aufeinander abgestimmt.

EMPFEHLUNGEN (keine Auflagen)
E1: Englischsprachige Fachliteratur in Modul M-104 erweitern.
E2: Studentische Forschungsergebnisse stärker auf Fachtagungen zeigen.

BESCHLUSSEMPFEHLUNG
Akkreditierung ohne Auflagen.` },
  'DOC-13': { title: 'Stellungnahme der Hochschule', file: 'DOC-13_Stellungnahme_Hochschule.pdf', type: 'Stellungnahme', phase: 6, ver: 'v1.0', status: 'Eingereicht', size: '1,2 MB', author: 'Studiengangsleitung, QM', to: 'Agentur, Akkreditierungsrat',
    chain: [['Studiengangsleitung: erstellt', 1], ['QM: Freigabe', 1], ['Präsidium: Antrag in ELIAS', 1]],
    content: `STELLUNGNAHME DER HOCHSCHULE ZUM AKKREDITIERUNGSBERICHT

1. Die Hochschule dankt dem Gutachtergremium für die Rückmeldung.
2. Zu E1: Im Modulhandbuch (M-104) sind drei zusätzliche internationale Standardwerke aufgenommen.
3. Zu E2: Ein Fonds für Reisekosten zu studentischen Konferenzbeiträgen wird eingerichtet.

Der Antrag auf Akkreditierung wird über ELIAS gestellt.` },
  'DOC-14': { title: 'Akkreditierungsentscheidung', file: 'DOC-14_Akkreditierungsentscheidung_Siegel.pdf', type: 'Bescheid', phase: 6, ver: 'final', status: 'Entschieden', size: '2,1 MB', author: 'Akkreditierungsrat', to: 'Hochschule',
    chain: [['Akkreditierungsrat: Entscheidung', 1], ['Geschäftsstelle: Bekanntgabe', 1], ['Hochschule: Eingang', 1]],
    content: `ENTSCHEIDUNG DES AKKREDITIERUNGSRATS
Aktenzeichen: AR-2027-PROG-8821

Der Akkreditierungsrat hat in seiner Sitzung vom 24. Oktober 2027 entschieden:
Der {SG_ART}
„{SG}“
wird gemäß § 22 StudakVO NRW akkreditiert.

Siegel: Siegel des Akkreditierungsrats
Geltungszeitraum: 01.10.2027 bis 30.09.2035 (8 Jahre, § 26)
Auflagen: keine` }
};

/* ---------- Hilfsfunktionen ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* Auswahl gilt bis zum Neuladen (Vorschau ohne Browser-Speicher) */
const memory = {};
const store = { get: k => memory[k] || null, set: (k, v) => { memory[k] = v; } };
const programById = id => PROGRAMS.find(p => p.id === id);
const programLabel = p => `${p.name} (${p.degree})`;
const sectionOf = p => PROGRAMS.indexOf(p) + 1;
const xFolder = p => `${STORAGE.xRoot}\\${p.level === 'master' ? 'Master' : 'Bachelor'}\\${p.folder}`;
const xDocPath = (p, d) => `${xFolder(p)}\\${PHASE_FOLDERS[d.phase]}\\${d.file}`;
const pathHtml = path => esc(path).replace(/[\\_]/g, '$&<wbr>');
const canOpenFiles = location.protocol === 'file:';
const fileHref = path => 'file:///' + encodeURI(path.replace(/\\/g, '/'));
const monthLabel = (a, b) => `Monat ${a}–${b} · ${MONTHS[a - 1]} ${YEARS[a - 1]} – ${MONTHS[b - 1]} ${YEARS[b - 1]}`;
function moodleUrl(p) {
  if (!STORAGE.moodleCourseId) return `${STORAGE.moodleBase}/course/search.php?search=${encodeURIComponent(STORAGE.moodleCourseName)}`;
  return `${STORAGE.moodleBase}/course/view.php?id=${STORAGE.moodleCourseId}` + (p ? `#section-${sectionOf(p)}` : '');
}
function fill(text, p) {
  return text
    .replaceAll('{SG_ART}', p.level === 'master' ? 'Masterstudiengang' : 'Bachelorstudiengang')
    .replaceAll('{SG}', programLabel(p))
    .replaceAll('{HQR}', p.level === 'master' ? 'Masterebene (Stufe 2)' : 'Bachelorebene (Stufe 1)');
}
let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 3800);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast('Pfad kopiert. Im Datei-Explorer in die Adresszeile einfügen.');
}
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M14 6l6 6-6 6"/></svg>';

/* ---------- Zustand ---------- */
const state = {
  phase: 1,
  role: 'all',
  program: programById(store.get('accredo_program')) ? store.get('accredo_program') : PROGRAMS[0].id
};
const current = () => programById(state.program);
const phaseRoles = ph => new Set(ph.raci.map(([k]) => PEOPLE[k].group));

/* ---------- Theme ---------- */
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', t === 'dark' ? '#12161C' : '#F6F4EE');
  store.set('accredo_theme', t);
}
$('#themeToggle').addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

/* ---------- Programmwahl ---------- */
function renderProgramSelect() {
  const group = (lvl, label) => `<optgroup label="${label}">` +
    PROGRAMS.filter(p => p.level === lvl).map(p => `<option value="${p.id}">${esc(programLabel(p))}</option>`).join('') + '</optgroup>';
  const sel = $('#programSelect');
  sel.innerHTML = group('bachelor', 'Bachelor') + group('master', 'Master');
  sel.value = state.program;
  sel.addEventListener('change', e => setProgram(e.target.value, true));
}
function setProgram(id, announce) {
  if (!programById(id)) return;
  state.program = id;
  store.set('accredo_program', id);
  $('#programSelect').value = id;
  renderProgramContext();
  if (announce) toast('Studiengang gewählt: ' + programLabel(current()));
}
function renderProgramContext() {
  const p = current();
  $('#heroProgram').textContent = programLabel(p);
  document.querySelectorAll('.js-program').forEach(el => { el.textContent = programLabel(p); });
  renderPrograms();
  renderStorage();
}

/* ---------- Gantt ---------- */
function renderGantt() {
  let h = '<div class="gantt-grid"><div class="g-corner"></div>';
  MONTHS.forEach((m, i) => {
    h += `<div class="g-month${i === 3 ? ' is-year' : ''}"><b>${i + 1}</b>${m}${i === 0 || i === 3 ? ` ’${String(YEARS[i]).slice(2)}` : ''}</div>`;
  });
  PHASES.forEach(ph => {
    const left = ((ph.start - 1) / 13) * 100;
    const width = ((ph.end - ph.start + 1) / 13) * 100;
    const gateLeft = (ph.end / 13) * 100;
    h += `<div class="g-row" data-phase="${ph.n}">
      <button class="g-label" type="button" role="tab" data-phase="${ph.n}" aria-controls="phasePanel"><span class="num">0${ph.n}</span>${esc(ph.short)}</button>
      <div class="g-track">
        <button class="g-bar" type="button" tabindex="-1" data-phase="${ph.n}" style="left:calc(${left}% + 4px);width:calc(${width}% - 8px)" aria-label="Phase ${ph.n}: ${esc(ph.title)}, ${monthLabel(ph.start, ph.end)}" title="${esc(ph.milestone)}">${esc(ph.bar)}</button>
        ${ph.n < 6 ? `<span class="g-gate" style="left:${gateLeft}%" title="Gate ${ph.n}"></span>` : ''}
      </div>
    </div>`;
  });
  h += '</div>';
  const g = $('#gantt');
  g.innerHTML = h;
  g.addEventListener('click', e => {
    const b = e.target.closest('[data-phase]');
    if (b && b.tagName === 'BUTTON') selectPhase(+b.dataset.phase, true);
  });
  g.addEventListener('keydown', e => {
    if (!e.target.classList.contains('g-label')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = Math.min(6, Math.max(1, state.phase + (e.key === 'ArrowDown' ? 1 : -1)));
      selectPhase(n);
      g.querySelector(`.g-label[data-phase="${n}"]`).focus();
    }
  });
}
function updateGantt() {
  document.querySelectorAll('.g-row').forEach(r => {
    const n = +r.dataset.phase;
    const ph = PHASES[n - 1];
    const active = n === state.phase;
    r.classList.toggle('is-active', active);
    r.classList.toggle('is-dim', state.role !== 'all' && !phaseRoles(ph).has(state.role));
    const lab = r.querySelector('.g-label');
    lab.setAttribute('aria-selected', active);
    lab.tabIndex = active ? 0 : -1;
  });
  const hint = $('#roleHint');
  if (state.role === 'all') {
    hint.innerHTML = '<span class="gate-key"></span>Raute = Übergabepunkt (Gate). Phase anklicken für Details.';
  } else {
    const role = ROLES.find(r => r.id === state.role).label;
    const hits = PHASES.filter(ph => phaseRoles(ph).has(state.role)).map(ph => ph.n);
    hint.textContent = `${role}: beteiligt in Phase ${hits.join(', ')}.`;
  }
}

/* ---------- Rollenfilter ---------- */
function renderChips() {
  const c = $('#roleChips');
  c.innerHTML = ROLES.map(r => `<button class="chip" type="button" data-role="${r.id}" aria-pressed="${r.id === state.role}">${esc(r.label)}</button>`).join('');
  c.addEventListener('click', e => {
    const b = e.target.closest('[data-role]');
    if (!b) return;
    state.role = b.dataset.role;
    c.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x.dataset.role === state.role));
    updateGantt();
    renderPhase();
  });
}

/* ---------- Phasendetail ---------- */
const lawById = id => LAWS.find(l => l.id === id);
function renderPhase() {
  const ph = PHASES[state.phase - 1];
  const raciRows = ph.raci.map(([k, l]) => {
    const p = PEOPLE[k];
    const dim = state.role !== 'all' && p.group !== state.role;
    return `<tr${dim ? ' style="opacity:.4"' : ''}><td class="who"><b>${esc(p.name)}</b><span>${esc(p.role)}</span></td><td class="letter"><span class="raci-l ${l}" title="${{ R: 'Durchführung', A: 'Verantwortung', C: 'Mitwirkung', I: 'Information' }[l]}">${l}</span></td></tr>`;
  }).join('');
  const steps = ph.steps.map(([t, d, refs], i) => `
    <li><span class="idx">${ph.n}.${i + 1}</span><div><b>${esc(t)}</b><p>${esc(d)}</p>
    ${refs.length ? `<div class="refs">${refs.map(r => `<a class="ref" href="#law-${r}" data-law="${r}">${esc(lawById(r).code)}</a>`).join('')}</div>` : ''}</div></li>`).join('');
  const docs = ph.docs.map(id => {
    const d = DOCS[id];
    return `<li><button class="doc-item" type="button" data-doc="${id}"><span class="id">${id}</span><span><span class="t">${esc(d.title)}</span><br><span class="s">${esc(d.ver)} · ${esc(d.size)}</span></span><span class="st ${STATUS[d.status].cls}">${d.status}</span></button></li>`;
  }).join('');
  $('#phasePanel').innerHTML = `
    <div class="phase-main">
      <div>
        <div class="phase-kicker"><span class="pnum">PHASE 0${ph.n}</span><span>${monthLabel(ph.start, ph.end)}</span></div>
        <h3>${esc(ph.title)}</h3>
        <p class="phase-desc">${esc(ph.desc)}</p>
        <span class="milestone">Meilenstein: ${esc(ph.milestone)}</span>
      </div>
      ${ph.note ? `<p class="callout"><b>Hinweis:</b> ${esc(ph.note)}</p>` : ''}
      <div><p class="block-h">Arbeitsschritte und Rechtsgrundlage</p><ol class="steps">${steps}</ol></div>
      <div><p class="block-h">Übergabedokumente</p><ul class="doc-list">${docs}</ul></div>
    </div>
    <aside class="phase-side">
      <div class="card"><p class="block-h">Zuständigkeiten (RACI)</p><table class="raci"><tbody>${raciRows}</tbody></table>
        <div class="raci-key"><span><b>R</b> führt durch</span><span><b>A</b> verantwortet</span><span><b>C</b> wirkt mit</span><span><b>I</b> wird informiert</span></div>
      </div>
      <div class="card handover"><p class="gate-title">${esc(ph.gate.title)}</p>
        <div class="flow"><span>${esc(ph.gate.from)}</span>${ARROW}<span>${esc(ph.gate.to)}</span></div>
        <p>${esc(ph.gate.text)}</p>
      </div>
    </aside>
    <nav class="phase-nav" aria-label="Phasen blättern">
      <button class="btn btn-ghost" type="button" data-step="-1" ${ph.n === 1 ? 'disabled' : ''}>← Phase ${ph.n - 1 || 1}</button>
      <button class="btn" type="button" data-step="1" ${ph.n === 6 ? 'disabled' : ''}>Phase ${Math.min(6, ph.n + 1)} →</button>
    </nav>`;
}
function selectPhase(n, scroll) {
  state.phase = n;
  updateGantt();
  renderPhase();
  if (scroll && window.innerWidth < 1020) $('#phasePanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('#phasePanel').addEventListener('click', e => {
  const s = e.target.closest('[data-step]');
  if (s) { selectPhase(state.phase + +s.dataset.step); $('#phasePanel').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const d = e.target.closest('[data-doc]');
  if (d) openDoc(d.dataset.doc);
  const l = e.target.closest('[data-law]');
  if (l) flashLaw(l.dataset.law);
});

/* ---------- Dokumententabelle ---------- */
function renderDocFilters() {
  $('#docPhase').insertAdjacentHTML('beforeend', PHASES.map(p => `<option value="${p.n}">Phase ${p.n} · ${esc(p.short)}</option>`).join(''));
  $('#docStatus').insertAdjacentHTML('beforeend', Object.keys(STATUS).map(s => `<option>${s}</option>`).join(''));
  $('#statusLegend').innerHTML = Object.entries(STATUS).map(([k, v]) => `<div><dt><span class="st ${v.cls}">${k}</span></dt><dd>${v.text}</dd></div>`).join('');
  ['#docSearch', '#docPhase', '#docStatus'].forEach(s => $(s).addEventListener('input', renderDocs));
  $('#docReset').addEventListener('click', () => { $('#docSearch').value = ''; $('#docPhase').value = ''; $('#docStatus').value = ''; renderDocs(); });
}
function renderDocs() {
  const q = $('#docSearch').value.trim().toLowerCase();
  const ph = $('#docPhase').value;
  const st = $('#docStatus').value;
  const rows = Object.entries(DOCS).filter(([id, d]) =>
    (!ph || d.phase === +ph) && (!st || d.status === st) &&
    (!q || [id, d.title, d.file, d.author, d.to, d.type].join(' ').toLowerCase().includes(q)));
  $('#docRows').innerHTML = rows.map(([id, d]) => `
    <tr>
      <td class="id">${id}</td>
      <td class="t"><b>${esc(d.title)}</b><span>${esc(d.type)} · ${esc(d.ver)} · ${esc(d.size)}</span></td>
      <td class="ph">Phase ${d.phase}</td>
      <td>${esc(d.author)}</td>
      <td>${esc(d.to)}</td>
      <td><span class="st ${STATUS[d.status].cls}">${d.status}</span></td>
      <td><button class="mini" type="button" data-doc="${id}">Details</button></td>
    </tr>`).join('');
  $('#docEmpty').hidden = rows.length > 0;
  document.querySelector('.doc-table').hidden = rows.length === 0;
}
$('#docRows').addEventListener('click', e => { const b = e.target.closest('[data-doc]'); if (b) openDoc(b.dataset.doc); });

/* ---------- Studiengänge & Ablage ---------- */
function progCard(p) {
  const on = p.id === state.program;
  return `<article class="prog${on ? ' is-selected' : ''}">
    <div><div class="prog-top"><span class="deg">${p.degree}</span>${p.note ? `<span class="tag">${esc(p.note)}</span>` : ''}</div>
    <h4 style="margin-top:8px">${esc(p.name)}</h4><p class="sec">Moodle: Abschnitt ${sectionOf(p)}</p></div>
    <code class="path">${pathHtml(xFolder(p))}</code>
    <div class="prog-actions">
      <button class="mini${on ? ' is-on' : ''}" type="button" data-select="${p.id}" aria-pressed="${on}">${on ? '✓ Ausgewählt' : 'Auswählen'}</button>
      <a class="mini" href="${esc(moodleUrl(p))}" target="_blank" rel="noopener">Moodle ↗</a>
      ${canOpenFiles ? `<a class="mini" href="${esc(fileHref(xFolder(p)))}">Ordner öffnen</a>` : ''}
      <button class="mini" type="button" data-copy="${esc(xFolder(p))}">Pfad kopieren</button>
    </div>
  </article>`;
}
function renderPrograms() {
  $('#progBachelor').innerHTML = PROGRAMS.filter(p => p.level === 'bachelor').map(progCard).join('');
  $('#progMaster').innerHTML = PROGRAMS.filter(p => p.level === 'master').map(progCard).join('');
}
$('#studiengaenge').addEventListener('click', e => {
  const s = e.target.closest('[data-select]');
  if (s) setProgram(s.dataset.select, true);
  const c = e.target.closest('[data-copy]');
  if (c) copy(c.dataset.copy);
});
function renderStorage() {
  const p = current();
  $('#moodleMain').href = moodleUrl(p);
  $('#moodleNote').textContent = STORAGE.moodleCourseId
    ? `Kurs-ID ${STORAGE.moodleCourseId}, gewählter Studiengang in Abschnitt ${sectionOf(p)}.`
    : 'Kurs-ID ist noch nicht festgelegt. Der Link öffnet bis dahin die Moodle-Kurssuche „ACCREDO“.';
  const lvl = p.level === 'master' ? 'Master' : 'Bachelor';
  const phases = Object.values(PHASE_FOLDERS);
  $('#xTree').textContent = [
    STORAGE.xRoot,
    `└─ ${lvl}`,
    `   └─ ${p.folder}`,
    ...phases.map((f, i) => `      ${i === phases.length - 1 ? '└─' : '├─'} ${f}`)
  ].join('\n');
}

/* ---------- Rechtsgrundlagen ---------- */
function renderLaws() {
  $('#laws').innerHTML = LAWS.map(l => `
    <article class="law" id="law-${l.id}">
      <span class="code">${esc(l.code)}</span>
      <h4>${esc(l.title)}</h4>
      <p>${esc(l.text)}</p>
      <span class="ph">Phase ${l.phases.join(', ')}</span>
      ${l.url ? `<a href="${l.url}" target="_blank" rel="noopener">Volltext ↗</a>` : ''}
    </article>`).join('');
}
function flashLaw(id) {
  const el = document.getElementById('law-' + id);
  if (!el) return;
  el.classList.add('is-flash');
  setTimeout(() => el.classList.remove('is-flash'), 1800);
}

/* ---------- Dokument-Dialog ---------- */
const modal = $('#docModal');
let lastFocus = null;
function openDoc(id) {
  const d = DOCS[id];
  const p = current();
  lastFocus = document.activeElement;
  $('#modalType').textContent = `${id} · ${d.type} · Phase ${d.phase}`;
  $('#modalTitle').textContent = d.title;
  $('#modalFile').textContent = d.file;
  $('#modalMeta').innerHTML = [
    ['Version', esc(d.ver)], ['Status', `<span class="st ${STATUS[d.status].cls}">${d.status}</span>`],
    ['Verfasst von', esc(d.author)], ['Empfänger', esc(d.to)]
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('#modalChain').innerHTML = d.chain.map(([t, done]) => `<li><span>${esc(t)}</span><span class="${done ? 'done' : 'open'}">${done ? 'erledigt' : 'offen'}</span></li>`).join('');
  const xp = xDocPath(p, d);
  $('#modalPaths').innerHTML = `
    <div class="path-row"><div><b>Moodle · Abschnitt ${sectionOf(p)}</b><code>${esc(programLabel(p))}</code></div>
      <div class="acts"><a class="mini" href="${esc(moodleUrl(p))}" target="_blank" rel="noopener">Öffnen ↗</a></div></div>
    <div class="path-row"><div><b>Laufwerk X</b><code>${pathHtml(xp)}</code></div>
      <div class="acts">${canOpenFiles ? `<a class="mini" href="${esc(fileHref(xp))}">Öffnen</a>` : ''}<button class="mini" type="button" data-copy="${esc(xp)}">Pfad kopieren</button></div></div>`;
  $('#modalExcerpt').textContent = fill(d.content, p);
  modal.showModal();
}
modal.addEventListener('click', e => {
  if (e.target === modal) modal.close();
  const c = e.target.closest('[data-copy]');
  if (c) { e.preventDefault(); copy(c.dataset.copy); }
});
modal.addEventListener('close', () => { if (lastFocus) lastFocus.focus(); });

/* ---------- Start ---------- */
renderProgramSelect();
renderChips();
renderGantt();
renderLaws();
renderDocFilters();
renderDocs();
renderProgramContext();
selectPhase(1);
