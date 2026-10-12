<a name="top"></a>

# 🔬 Konzept & Architektur

[🏠 Übersicht](../readme-de.html) · [🇬🇧 English](../en/concept.html) · Kapitel 1, 2, 4

**Inhalt:** [1. 📋 Projektübersicht](#1--projektübersicht) · [2. 🔬 Architektur & Leitprinzipien](#2--architektur--leitprinzipien) · [4. 🕹️ Multimodale Technologien & Interaktionskonzepte](#4--multimodale-technologien--interaktionskonzepte)

---

## 1. 📋 Projektübersicht

### 🎯 Konzept: Eine integrierte, multimodale Teleoperationsplattform
Eine modulare Steuerungs- und Interaktionsplattform für den UFactory xArm Lite 6. Sie bündelt heterogene Eingabemethoden in einer Softwareumgebung mit konsequentem Fokus auf Usability: Das System berechnet die komplexen Roboterbewegungen im Hintergrund, sodass die Oberfläche die Absicht des Nutzers direkt in Roboteraktionen übersetzen kann.

### 💡 Motivation: Assistenz, Inklusion und Teilhabe (Industrie 5.0)
Klassische Teleoperation ist fehleranfällig und verlangt Feinmotorik und Fachwissen – Hürden, die viele Menschen ausschließen. Im Sinne der Industrie 5.0, die Mensch, Nachhaltigkeit und Resilienz in den Mittelpunkt der Produktion stellt, zielt das Projekt auf:

- **Abbau technischer Barrieren:** von der Low-Level-Gelenkkoordination zu intuitiven High-Level-Befehlen.
- **Inklusion:** produktive, gleichberechtigte Teilhabe am Arbeitsplatz – auch für Menschen mit unterschiedlichen physischen oder kognitiven Voraussetzungen.
- **Mensch-Maschine-Synergie:** der Roboter als assistierendes Werkzeug, das entlastet statt ersetzt.

### ⚙️ Funktionsprinzip: Shared Control & Human-in-the-Loop
Mensch und Maschine arbeiten kooperativ. Der Nutzer bleibt als Supervisor im Regelkreis (*Human-in-the-Loop*) und steuert auf drei sich ergänzenden Ebenen:

- **High-Level-Befehle:** Aktionen oder Ziele über natürliche Modalitäten wie Blick oder Sprache vorgeben.
- **Low-Level-Korrekturen:** verzögerungsfreier Wechsel auf manuelle Eingabegeräte (Gamepad / MoveIt Servo) für feine Justierungen.
- **Kontextsensitive Assistenz:** kollisionsfreie Bahnplanung im Hintergrund sichert den Operator während der Ausführung ab.

### 🏆 Zielsetzung: Ein valider, kosteneffizienter Proof-of-Concept
Ein voll funktionsfähiger, reproduzierbarer und erschwinglicher Proof-of-Concept für Forschung und praxisnahe Inklusionsprojekte – eine offene Evaluationsplattform, auf der neue assistive Robotiksysteme unter realitätsnahen Bedingungen entwickelt, getestet und empirisch validiert werden.

### 📊 Evaluationslogik: Von der Forschung in die industrielle Praxis
Über den Demonstrator hinaus erzeugt das System übertragbares Wissen zur Interaktionsqualität:

- **Evaluationslogik:** systematische Messung von Usability, kognitiver Belastung und Systemperformance.
- **Handlungsempfehlungen:** standardisierte Guidelines als Leitfaden für Unternehmen bei der Einführung moderner Robotersysteme.
- **Transformationsfrage:** *„Wie lassen sich Prozesse und Arbeitsplätze so gestalten, dass sie die menschzentrierten Anforderungen der Industrie 5.0 messbar erfüllen?“*
- **Dienstleistungspotenzial:** Frameworks und Guidelines können zu einem validierten Beratungsangebot für die Industrie im digitalen und demografischen Wandel werden.

## 2. 🔬 Architektur & Leitprinzipien

### 🗺️ Systemarchitektur & Datenfluss
<p align="center"><img src="../img/diagrams/system_architecture.svg" width="100%" alt="Systemarchitektur und Datenfluss"></p>

*Systemarchitektur und Datenfluss · Quelle: `tools/make_diagrams.py`*

### 2.1 Die Systemidee: Eine integrierte Entwicklungs-, Evaluierungs- und Validierungsplattform
Eine modulare Softwarearchitektur für multimodale Teleoperation und KI-gestützte Assistenzrobotik. Als Integrationsschicht (Middleware-Ebene) führt sie heterogene Teilsysteme in einer Laufzeitumgebung zusammen. Mit verteiltem Server/Client-Aufbau und einem **Digital Twin** zur Live-Visualisierung (WebGL in der UX | Control Interface (früher „Robot Control UI“), optional NVIDIA Isaac Sim) dient sie als Entwicklungs- und als reproduzierbare Testumgebung – ein geschlossener Kreislauf aus Entwicklung und empirischer Validierung:

- **Sensorik & Perzeption:** Tiefenkameras (YOLO-Objekterkennung, Marker-Tracking) sowie taktile oder physiologische Sensoren zur Zustandserfassung.
- **Multimodale Steuerung:** Blicksteuerung zur Zielauswahl, Sprachbefehle (OpenAI Whisper) und klassische Controller (Gamepads, 3D-Mäuse) parallel.
- **Kognitive Robotik:** Vision-Language-Action-Modelle (VLA), die abstrakte sprachliche und visuelle Befehle in Handlungssequenzen des Roboters übersetzen.
- **Integrierte Datenakquisition:** zeitsynchrone Aufzeichnung technischer Leistungsdaten und menschlicher Interaktionsdaten.

### 🧊 Digital Twin: erst virtuell, dann real
Der **Digital Twin** (digitaler Zwilling) ist das live mitlaufende 3D-Modell des xArm Lite 6 und seiner Arbeitszelle. Er ist das gemeinsame Bild für Mensch, Planer und KI: Jede Bewegung erscheint im Digital Twin vorab und während sie passiert.

- **Was er ist:** WebGL-Modell (three.js + URDF des xArm Lite 6) in der UX | Control Interface (Port 8081), läuft in jedem Browser, offline-fähig.
- **Live-Spiegel:** folgt `/joint_states` und der Linearachse in Echtzeit – im Modus (Robot | Digital Twin) dem simulierten, im Modus (Robot | Hardware) dem echten Arm.
- **Arbeitszelle im Digital Twin:** Tisch, Laborraum, Schutzzonen, Kamerastativ, erkannte Objekte als 3D-Boxen mit Greifkugeln (`/zed/bboxes_3d`), virtuelle Objekte und Szenen (Standard, Auto palletizing).
- **Planen im Digital Twin:** Ziel mit dem TCP-Gizmo ziehen → MoveIt plant → Ghost-Vorschau der Bahn (`/ui/moveto_preview_path`) → Mensch bestätigt → erst dann fährt der Arm.
- **Handeln im Digital Twin:** Objekt anklicken → *Grasp*; Tisch anklicken → *Place here*.
- **Testen im Digital Twin:** Modus (Robot | Digital Twin) + virtuelle Objekte + Physik-Sandbox → Neues gefahrlos ausprobieren, danach mit derselben UI am echten Arm.
- **Jeder Blickwinkel:** bis zu 4 virtuelle Kameras = eigene Ansichten des Digital Twin, nutzbar wie echte Kamerakacheln.
- **Immersiv:** derselbe Digital Twin in der Meta Quest 3 (WebXR) für die VR-Teleoperation.
- **High-Fidelity:** NVIDIA Isaac Sim läuft optional als passiver Schatten-Digital-Twin mit ([Isaac Sim](isaac_sim.html)).
- **Nutzen:** Transparenz (keine Black Box), Sicherheit (Vorschau vor Ausführung), niedrige Einstiegshürde für Laien, reproduzierbare Tests und Studien.

### 🎯 Maßgeschneiderte Szenarien: Ihr Anwendungsfall im Digital Twin
Über die mitgelieferten Szenarien hinaus passt sich die Plattform an individuelle Anwendungsfälle an – entwickelt in enger Abstimmung mit Ihnen:

- **Bedürfnisgerecht vorbereitet:** Nach Ihren Anforderungen entsteht die passende Szene im Digital Twin, gemeinsam mit Ihnen.
- **Testen & lernen:** Sie testen und lernen gefahrlos in der Simulation, bevor sich am echten Roboter etwas bewegt.
- **Evaluieren & optimieren:** Aus der Evaluierung entsteht die bedürfnisgerechte Optimierung – iterativ, bis die Szene passt.
- **Übertragung auf Hardware:** Erst danach geht es auf den echten Roboter – optimal auf die Anforderungen angepasst, begleitet von Monitoring, Evaluation, Analyse und laufender Optimierung.

### 🧑‍💻 Human-Centered Automation
Der Operator steht im Zentrum des Interaktionsdesigns: Der Automatisierungszustand bleibt nachvollziehbar und die nächste Systemaktion vorhersehbar – keine Black Box.

- **Kognitive Transparenz:** Systemzustände bleiben verständlich, auch bei paralleler Verarbeitung von Blickbewegungen und Sensor-Rückmeldungen.
- **Fundierte Intervention:** Der Operator kann in kritischen oder unvorhergesehenen Situationen sicher und gezielt eingreifen.
- **Kalibriertes Vertrauen:** verlässliche Basis für *Trust in Automation*, evaluiert in Nutzerstudien.

### 🤝 Shared Control & Kognitive Entlastung
Die Kontrollhoheit wechselt latenzarm zwischen manueller Führung, Blickinteraktion und KI-gestützten, teilautomatisierten Funktionen:

- **Kontrollübergabe:** zwischen manueller Eingabe (MoveIt Servo / Gamepad) und autonomen Aktionen (z. B. blickbasiertes Greifen).
- **Weniger Mental Workload:** bei komplexen oder langen Manipulationsaufgaben.
- **Autonome Fehlerkompensation:** Das System fängt fehleranfällige Low-Level-Korrekturen ab und schafft Kapazität für die Prozessüberwachung.
- **Empirische Validierung:** Die tatsächliche Entlastung wird im Projektverlauf mit standardisierten psychometrischen Verfahren gemessen.

### 📈 HCI, Usability & empirische Evaluierung
Die GUI folgt etablierten HCI-Prinzipien: Statt einzelne Freiheitsgrade zu koordinieren oder Terminal-Prozesse von Hand zu starten, erledigen Nutzer Aufgaben intentionsbasiert. Systematische Nutzerstudien bewerten die Schnittstellen:

- **Intentionsbasierte Steuerung:** abstrakte Absichten (Sprache, Blickziel, High-Level-Controller) werden zu präzisen Trajektorien.
- **Usability-Metriken:** subjektive Gebrauchstauglichkeit über die *System Usability Scale* (SUS).
- **Leistungsparameter:** *Task Completion Time*, Fehlerraten und Blickpfade.
- **Beanspruchungsanalyse:** kognitive Belastung über den *NASA-TLX* zur iterativen Optimierung.

### 🔓 Reproduzierbar & Open Source
Die offene Codebasis macht alle Algorithmen, Konfigurationen und Datenflüsse methodisch transparent:

- **Transparenz:** alle Algorithmen, URDF-Modelle und MoveIt-Konfigurationen sind einsehbar.
- **Replikation:** unabhängige Gruppen können Studien unter identischen Bedingungen wiederholen.
- **Verifizierbarkeit:** aufgezeichnete Sensordaten und Steuereingaben lassen sich nachvollziehen und validieren.
- **Benchmark:** verlässliche Vergleichsbasis für Studien in der Assistenz- und Inklusionsrobotik.

### 💶 Kosteneffiziente Hardware
Überwiegend erschwingliche, handelsübliche Komponenten (COTS) – ohne Abstriche bei Präzision und Zuverlässigkeit:

- **Breiter Zugang:** geringere Investitionshürden für multimodale Robotik.
- **Transfer:** in Inklusionsprojekte, Bildungseinrichtungen und kleinere Forschungslabore (z. B. über den xArm Lite 6 und Consumer-Controller).
- **Verlässlichkeitsprüfung:** wissenschaftlicher Vergleich günstiger Hardware mit teuren Industriesystemen.

### 🧩 Modular & Industrie-Standard
Vollständig in ROS 2 Humble integriert; standardisierte Kommunikationsprimitive halten die Plattform interoperabel mit industriellen Ökosystemen:

- **Natives ROS 2:** Nodes, Topics, Services und Actions – kompatibel mit MoveIt 2 und aktuellen Sensor-SDKs.
- **Gekapselte Teilsysteme:** Module wie VLA-Pipelines oder Treiber der Blicksteuerung lassen sich einzeln austauschen oder erweitern.
- **Portierbarkeit:** einfache Migration auf künftige ROS-2-LTS-Distributionen.

## 4. 🕹️ Multimodale Technologien & Interaktionskonzepte

### 4.1 Roboter-Steuerungsarten (Inputs)
- **Gamepad:** latenzarme, kontinuierliche Feinsteuerung mit einem Xbox One Elite Series 2 Controller, inklusive haptischem Feedback (Vibration bei Kollisionsgefahr) → [Modi & Gamepad](teleoperation.html).
- **VR (Meta Quest 3):** immersive kartesische 6-DoF-Steuerung mit den Quest-3-Controllern über WebXR und ADB-Tunneling → [VR-Teleoperation](vr_quest3.html).
- **Web-UI:** Maus oder Touch in der UX | Control Interface – am Roboter-PC, vom Laptop oder Tablet im Heimnetz oder am UX | Compact Interface (früher „Touch Panel“) → [UX | Control Interface](robot_control_ui.html).
- **Sprache & Blick:** Whisper-Sprachbefehle und Tobii-Blicksteuerung → [Sprache & Blick](voice_gaze.html).
- **VLA-M-Chat:** Anweisungen in Alltagssprache → [VLA-M](vla.html).

### 4.2 Sensorik & Assistenz (Perception)
- **Computer Vision:** 2D-Objekterkennung mit *YOLO* auf der Raspberry-Pi-IP-Kamera plus ArUco-Homographie (`zed_m:=false ip_cams:=true`, `yolo_3d_bbox_for_ip_cam.py`) – die leichtgewichtige Alternative ohne ZED. Standard ist die ZED Mini, die direkt in 3D erkennt.
- **Stereo Vision:** echte 3D-Tiefendaten aus einer *ZED Mini* (Stereolabs), **stationär** (Stativ) oder **am Endeffektor** montiert.

### 4.4 User Interfaces (UI/GUI)
Eine zentrale Oberfläche bündelt alle Systemzustände und entlastet den Operator:

- **Telemetrie & Status:** Echtzeit-Telemetrie des Roboterarms.
- **System-Feedback & Intent Recognition:** visuelles und akustisches Feedback für manuelle Eingaben und erkannte Sprachbefehle.
- **Präventive Kollisionswarnungen:** sobald eine softwareseitige Schutzmaßnahme greift (z. B. das Z-Limit).
- **Visuelles Monitoring & Objekterkennung:** Videostreams mit Live-Overlays erkannter Objekte (YOLO-Boxen) und ein synchroner 3D-**Digital Twin**.
- **OBS Studio:** bündelt alle Komponenten zu einer GUI für die Teleoperation.

**Gaze Control User Interface** ([Details](voice_gaze.html))

- **Sicherheitsgrenze:** Soft-Landing-Bremszone ab Z = 40,0 mm (quadratische Drosselung), Hard Stop für Abwärtsbewegungen bei Z = 33,0 mm.
- **Anordnung:** Blickrichtung = Fahrrichtung; alle Knöpfe bündig am Bildschirmrand, Bildmitte frei für die Szene.
- **Tempo-Stufen:** slow / normal / fast = 50 / 100 / 150 % des bisherigen Tempos, umschaltbar per Blick auf SPEED; DOWN nie schneller als normal.
- **Blickverlust-Stopp:** > 300 ms keine Blickdaten → Fahrt stoppt; Status-Karte zeigt Tracking, Z-Höhe, Tempo, Greifer.
- **Vakuumgreifer:** ein Umschalt-Knopf (GRIPPER) per `VacuumGripperCtrl`-Service.

![Gaze Control UI](../imgs/gaze_control_interface.png)

---

[🏠 Übersicht](../readme-de.html) · [⬆ Nach oben](#top) · [Weiter: Installation & Voraussetzungen ➡](installation.html)
