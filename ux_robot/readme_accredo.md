# ACCREDO · Reakkreditierungs- & PO-Novellierungsprozess

Interaktive Scrollytelling-Webseite zur schrittweisen Visualisierung eines Hochschul-Reakkreditierungs- und Prüfungsordnungsprozesses (SPO).

## Highlights & Features
- **Scrollytelling & Step-by-Step Motion (soft-motion):**
  - Beim Scrollen wird der Prozess Schritt für Schritt animiert und visualisiert.
  - Sticky Visualizer links mit synchron mitwachsender Progress-Rail (`--ease-out`, einmaliger Ring beim Phasenwechsel, keine Hektik).
  - Karten-Inhalte blenden beim ersten Erscheinen gestaffelt ein, Übergabe-Gates mit einmaligem Lichtstreif; `prefers-reduced-motion` zeigt sofort den Endzustand.
  - Klick auf Meilensteine scrollt sanft zur jeweiligen Phase.
- **Rollen & Zuständigkeiten (RACI):**
  - Live-Radar im Sticky-Panel zeigt für jeden Schritt die verantwortlichen Akteure (Responsible, Accountable, Consulted, Informed) mit Avataren und Positionen.
  - Rollen-Karten der Phasen nennen die RACI-Rolle im Klartext (Durchführung, Verantwortung, Beratung, Information).
  - Filterbare Perspektiven: Studiengangsleitung, Qualitätsmanagement, Prüfungsausschuss, Fakultätsrat, Gutachtergruppe.
- **Übergabedokumente (.pdf) & Handover-Gates:**
  - 14 realistische Artefakte (Evaluationsberichte, Satzungsentwurf SPO v2.0, Modulhandbuch, Rechtsgutachten, Fakultätsratsbeschluss, Akkreditierungsdossier, Peer-Gutachten, Akkreditierungsurkunde).
  - Jedes Dokument kann per Klick geöffnet werden: Zeigt Metadaten, Versionsstand, SHA-256 Hash, Freigabekette und formatierte Inhaltsauszüge.
- **Zentrale Deliverables-Matrix:**
  - Umschaltung zwischen Scrollytelling-Ablauf und tabellarischer Übergabe-Matrix mit Volltext-Suche.
- **Studiengänge (12):**
  - Bachelor: Information and Communication Design (B.A.), International Business Administration (B.A.), Environment and Energy (B.Sc.), Infotronic Systems Engineering (B.Sc.), Medieninformatik (B.Sc.), Mobility and Logistics (B.Sc.), Psychologie (Arbeits- und Organisationspsychologie) (B.Sc.), Verwaltungsinformatik – E-Government (B.Sc., auch dual).
  - Master: Design and Interaction (M.A.), Information Engineering and Computer Science (M.Sc.), International Management and Psychology (M.Sc.), Usability Engineering (M.Sc.).
  - Auswahl im Kopf der Seite (gemerkt im Browser): Dokument-Auszüge, Pfade und Links gelten für den gewählten Studiengang; Ansicht „Studiengänge“ zeigt alle 12 mit Ablageorten.
- **Ablageorte je Dokument:**
  - **Moodle-Kurs „ACCREDO“** (Hauptablage): Abschnitt 0 = dieser Leitfaden, Abschnitt 1–8 Bachelor, 9–12 Master, je Abschnitt alle PDFs des Studiengangs.
  - **Laufwerk X** (zusätzliche lokale Ablage, hierarchisch): `X:\ACCREDO\<Bachelor|Master>\<Studiengang>\Phase_<n>_…\<DOC-Nr>_….pdf`, gleicher Dateiname wie in Moodle.
  - Dokument-Fenster, Matrix und Navigator zeigen beide Orte: Moodle-Link + „Pfad kopieren“ für X (Ordner-Link nur, wenn die Seite selbst lokal geöffnet ist).
  - Anpassen an einer Stelle im Skript: `STORAGE` (Moodle-Adresse, Kurs-ID, X-Wurzel). Kurs-ID `4711` ist ein Platzhalter → echte ID eintragen; leer = Links öffnen die Moodle-Kurssuche „ACCREDO“.
- **Theme-Support:**
  - Light Mode (Default, Look „Ruhig“: gedämpfter Kontrast, Stahlblau als einziger Akzent, Status/RACI/Gates als getönte Flächen) & Dark Mode, Texte mit Kontrast ≥ 4,5:1 (meist ≥ 6:1).
  - Zero-Dependency: Funktioniert lokal vollständig offline ohne externe CDNs oder Internetzugang.

## Starten & Betrachten
Einfach die Datei direkt im Browser öffnen:
```bash
# Direkt im Standard-Browser:
xdg-open __project_accredo/index.html

# Oder per lokalem Webserver:
python3 -m http.server 8090 --directory __project_accredo/
# Dann aufrufen: http://localhost:8090
```
