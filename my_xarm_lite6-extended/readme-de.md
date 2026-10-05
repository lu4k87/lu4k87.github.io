<a name="top"></a>

# Interakt Control Robot

<p align="center"><b>Der Mensch führt. Die KI assistiert.</b><br>Assistive Robotik-Plattform für den xArm Lite 6 auf Basis von ROS 2 Humble.</p>

<p align="center">
  <img src="https://img.shields.io/badge/ROS_2-Humble-34a853?style=for-the-badge&logo=ros" alt="ROS 2 Humble">
  &nbsp;&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Ubuntu-22.04-E95420?style=for-the-badge&logo=ubuntu" alt="Ubuntu 22.04">
  &nbsp;&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Python-3.10-3776AB?style=for-the-badge&logo=python" alt="Python 3.10">
  &nbsp;&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/MoveIt-2-00529B?style=for-the-badge" alt="MoveIt 2">
</p>

<p align="center">
  <a href="readme-en.html">🇬🇧 <b>Read in English</b></a> &nbsp;·&nbsp;
  <a href="project_docs.html">📚 <b>Projekt-Doku</b></a> &nbsp;·&nbsp;
  <a href="operate_manual.html">📘 <b>Handbuch</b></a> &nbsp;·&nbsp;
  <a href="operate_setup_guide.html">🛠️ <b>Setup-Guide</b></a> &nbsp;·&nbsp;
  <a href="poster/poster_a2.pdf">🖼️ <b>Poster (A2)</b></a> &nbsp;·&nbsp;
  🗺️ <b>TODOs</b>
</p>

> [!TIP]
> **📘 Handbuch:** [`docs/operate_manual.html`](operate_manual.html) – Architektur, Sicherheitskette, Ports, Server/Client-Steuerung, VLA-Chat.
> [Online gerendert ansehen](operate_manual.html) · lokal über den Button **Manual** in der Nexus Webapp (`http://localhost:8080/manuals/operate_manual.html`).
> **🛠️ Setup-Guide (DE/EN):** [`docs/operate_setup_guide.html`](operate_setup_guide.html) – Inbetriebnahme Schritt für Schritt, für einen vorinstallierten PC oder ab nacktem Ubuntu 22.04 (verlinkt in der Projekt-Doku, Footer-Knopf **Projekt-Doku** der Nexus Webapp).

Eine Forschungs- und Evaluationsplattform für die **multimodale Teleoperation** des UFactory xArm Lite 6. Blicksteuerung, Sprache, Gamepad, VR und Web-UIs – kombiniert mit assistiver Automatisierung – senken die Einstiegshürden der Robotersteuerung. Grundlage ist das *Shared-Control*-Prinzip (Industrie 5.0): Der Mensch bleibt im Regelkreis, das System plant kollisionsfreie Bewegungen im Hintergrund. Das System schlägt vor, der Mensch entscheidet (Human-in-the-Loop). Im Zentrum steht ein live mitlaufender **Digital Twin**: Jede Bewegung ist in 3D zu sehen, bevor der echte Arm fährt.

<p align="center">
  <img src="imgs/robotsystem.jpg" width="90%" alt="xArm Lite 6 Arbeitsplatz im Einsatz">
</p>

> [!IMPORTANT]
> Dies ist ein **Erweiterungs-Workspace** auf Basis des offiziellen [xarm_ros2-Repositorys (Branch `humble`)](https://github.com/xArm-Developer/xarm_ros2/tree/humble) von UFactory. Dessen Struktur und Systemabhängigkeiten sind die zwingende Grundlage.

## ✨ Highlights

| | Funktion | Details |
|---|---|---|
| 🎮 | **Teleoperation** – Gamepad über MoveIt Servo mit vorausschauendem Kollisionsschutz; Fernsteuerung vom Laptop im Heimnetz (Control-Lock, Freigabe am Roboter-PC) | [Modi & Gamepad](de/teleoperation.html) · [Fernsteuerung](de/running.html#75-remote-control-server-client-kommunikation) |
| 🥽 | **VR (Meta Quest 3)** – 6-DoF-Teleoperation per WebXR, Robot Control UI in der Brille, VR-Spiegel am PC | [VR-Teleoperation](de/vr_quest3.html) |
| 👁️ | **3D-Vision & Greifen** – ZED Mini + YOLOv8-3D-Boxen, MoveIt-Kollisionsobjekte, OctoMap, kollisionsfreier 3-Phasen-Griff, virtuelle Objekte für Tests ohne Kamera | [Vision & Greifen](de/vision_grasping.html) |
| 🗣️ | **Sprache & Blick** – Whisper-Sprachbefehle (DE/EN), Tobii-Pro-Glasses-3-Blick-UI und Greifen per Verweildauer | [Sprache & Blick](de/voice_gaze.html) |
| 🧊 | **Digital Twin** – live mitlaufendes 3D-Modell von Arm und Arbeitszelle im Browser (three.js + URDF, `/joint_states`); im Digital Twin planen mit TCP-Gizmo und Ghost-Vorschau, dann bestätigen; erkannte und virtuelle Objekte, Schutzzonen, Szenen; Neues gefahrlos im FAKE-Modus mit Physik-Sandbox testen; derselbe Digital Twin in VR und in bis zu 4 virtuellen Kameras; Isaac Sim als optionaler Schatten-Digital-Twin | [Konzept: Digital Twin](de/concept.html#-digital-twin-erst-virtuell-dann-real) · [Robot Control UI](de/robot_control_ui.html) |
| 🖥️ | **Robot Control UI** (Port 8081) – WebGL-Digital-Twin, Jogging, MoveIt-Planung mit Ghost-Vorschau und TCP-Gizmo, Physik-Sandbox (Roboter-Simulation), Bewegungsabfolgen, andockbares HUD, Bereichsleiste je Arbeitsschritt (Move, Teach, Vision, Assistant (VLA), Remote Teleop) mit Schritt-für-Schritt-Guides und Settings, Kamerakacheln und virtuelle Kameras (eigene Blickwinkel auf den Digital Twin) im Viewport, Befehlspalette (Strg+K), Diagnostics (Log) als Schublade; alle vier Web-UIs auf Deutsch oder Englisch (Wechsel live unten in der Theme-Liste, Alt+T) | [Robot Control UI](de/robot_control_ui.html) |
| 🚀 | **Nexus Webapp** (Port 8080) – Ein-Klick-Launcher mit Setups für Roboter-Simulation und echte Roboter-Hardware, Launch-Baum- und Config-Einsicht, Vorabprüfung vor EXECUTE, Bereitschafts-Checks je Schritt, Log je Start, Neustart eines Laufs, Config-Sicherungen, Setup-Info-Karte (Netzwerk, IPs, Ports, PDF-Export), Touch Panel für ein Zusatz-Touch-Display | [System starten](de/running.html) |
| 🤖 | **VLA-M-Chat – Agentic ROS** *(in Arbeit)* – Anweisung in Alltagssprache → LLM-Agent (lokal Ollama oder Claude) plant Pick & Place mit der Szene → Ausführung, Greifprüfung, Neuplanung; Diktat per Mikrofon, Ein-Klick *Grasp* / *Place here* im Objektmenü, Auto-Palettieren (Skill `palletize`), *Record demo* fürs Training; geplant LeRobot (SmolVLA / π0.5) | [VLA-M](de/vla.html) |
| 📊 | **Monitoring Dashboard** (Port 8083) – Systemlast, ROS-2-Graph mit Live-Raten, Roboter-Nutzung, Sessions und Auswertung von Nutzerstudien; **Isaac Sim** als Schatten-Digital-Twin | [Monitoring](de/monitoring.html) · [Isaac Sim](de/isaac_sim.html) |

<p align="center">
  <img src="img/robot_control_ui.png" width="49%" alt="Robot Control UI">
  <img src="img/nexus_run_dev_setup.png" width="49%" alt="Nexus Webapp – RUN DEV SETUP">
</p>

<p align="center">
  <img src="img/vla_agent.png" width="32%" alt="VLA-M-Chat mit geplanter Pick-and-Place-Aufgabe">
  <img src="img/touch_panel.png" width="32%" alt="Touch Panel – Ansicht Move">
  <img src="img/monitoring_dashboard.png" width="32%" alt="Monitoring Dashboard – Übersicht">
</p>

*Oben: **Robot Control UI** (Bereich Move: Header mit E-STOP, Bereichs-Leiste, Digital-Twin-Viewport, kartesisches Jogging) und **Nexus Webapp** (Start-Popup RUN DEV SETUP, FAKE). Unten: **VLA-M** mit einem Plan aus vier Schritten, der auf *Execute* wartet, **Touch Panel** (Ansicht Move) und **Monitoring Dashboard** (Übersicht). Alles im FAKE-Modus – weitere Screenshots direkt bei jeder Funktion in `docs/de/`.*

## 🚀 Schnellstart (Simulation, ohne Hardware)

```bash
cd ~/dev_ws
colcon build --symlink-install
source install/setup.bash
./ros2_nexus/ros2_nexus_web_start.sh     # Nexus Webapp auf http://localhost:8080
```

Im Popup **RUN DEV SETUP** den Modus **FAKE** wählen und **EXECUTE** drücken: simulierter Arm, MoveIt Servo + MoveGroup, RViz2 und die Robot Control UI (`http://localhost:8081`) starten gemeinsam. Schritt für Schritt: [1.1 Schnellstart](de/running.html#11--5-minuten-quickstart-reine-simulation).

| UI / Dienst | Port | UI / Dienst | Port |
|---|---|---|---|
| Nexus Webapp (+ `/touch`, `/manuals/…`) | `8080` | Monitoring Dashboard | `8083` |
| Robot Control UI | `8081` | rosbridge WS / WSS | `9090` / `9091` |
| Web Video Server | `8082` | VR WebXR (Robot Control UI über HTTPS) | `8443` |

Alle Ports: [7.4 Netzwerk & Ports](de/running.html#74-netzwerk---port-architektur).

## 📚 Dokumentation

| Seite | Kapitel | Inhalt |
|---|---|---|
| [🔬 Konzept & Architektur](de/concept.html) | 1, 2, 4 | Motivation, Shared Control, Leitprinzipien, Interaktionskonzepte |
| [📦 Installation](de/installation.html) | 6 | Voraussetzungen, Hardware-Stückliste, Tobii- und ZED-Setup, Build |
| [🚀 System starten & betreiben](de/running.html) | 1.1, 7 | Schnellstart, Nexus Webapp, Ports, Fernsteuerung, DDS-Tuning, FAQ |
| [🎮 Modi & Gamepad](de/teleoperation.html) | 3.1, 3.2, 5 | FAKE vs. REAL, Kollisionsschutz, Gamepad-Pipeline im Detail |
| [👁️ Vision & Greifen](de/vision_grasping.html) | 3.3 | ZED / IP-Kamera, YOLO 3D, MoveIt-Kollision, Greif-Executoren |
| [🗣️ Sprache & Blick](de/voice_gaze.html) | 3.4 | Whisper-Pipeline, Sprach-Intents, Tobii-Blick-UI und Greifroutine |
| [🥽 VR Quest 3](de/vr_quest3.html) | 3.5 | WebXR-Teleoperation, VR-HUD, Einrichtung und Fehlersuche |
| [🖥️ Robot Control UI & Motion](de/robot_control_ui.html) | 3.6 | Web-UI-Funktionen, Touch Panel, Motion Handler, RViz-Overlays und -Marker |
| [🧊 Isaac Sim](de/isaac_sim.html) | 3.7 | Digital Twin im Shadow Mode |
| [🤖 VLA-M-Chat](de/vla.html) | 4.3 | LLM-Agent (Agentic ROS): Plan → Prüfung → Ausführung → Neuplanung, Sicherheit, Roadmap |
| [📊 Monitoring](de/monitoring.html) | 8 | Monitoring Dashboard: System, Nutzung und Evaluierung |
| [🗂️ Repository-Struktur](de/repository_structure.html) | 9 | Kommentierter Verzeichnisbaum |
| [🗄️ Archiv](de/archive.html) | 10 | Verworfene Konzepte und warum |

## 🗂️ Repository auf einen Blick

| Pfad | Inhalt |
|---|---|
| `src/` | Eigene ROS-2-Pakete (UIs, Vision, Motion, Teleoperation, Blick, Sprache, VLA, Blackbox- und Demo-Recorder) plus eingebundenes `xarm_ros2`, `zed-ros2-*`, `ros2_whisper`, `web_video_server` |
| `ros2_nexus/` | Nexus Webapp (Flask, kein ROS-Paket) und `launcher_config.json` |
| `touch_panel/` | Touch Panel für ein Zusatz-Touch-Display (von der Nexus Webapp unter `/touch` ausgeliefert) |
| `docs/` | Diese Dokumentation (DE / EN) mit ihren Screenshots |
| `docs/{project,present,operate,develop}_*.html` · `poster/` | Projektseiten mit Bereichs-Präfix (present_ · operate_ · develop_): Doku-Hub, Projektvorstellung, Steuerwege & Sicherheitskette, Funktionsatlas, Setup-Guide, Bedienhandbuch, Arbeitsweise (HTML) · A2-Projektposter (HTML/PDF) |
| `config/` · `tools/` · `ui_shared/` | Zentrale Netzwerk-Adressen (`network.yaml`) · Prüfungen und Hilfsskripte (`ui_new_code_checker.py`, `grasp_e2e.py`, `vla_eval.py`, `check_ws.py`, `check_ports.py`, `make_diagrams.py`, Git-Hook `pre-commit`, `firewall_setup.sh`) · gemeinsame UI-Tokens |
| `_imgs/` · `sounds/` · `isaacsim/` | Bilder und Icons · UI-Sounds und Sprachansagen · NVIDIA-Isaac-Sim-Checkout mit `start_isaac_sim.sh` (lokal je PC, nicht in Git) |
| `video/` · `references/` | Präsentationsvideos (Vorlagen, Quellen) · externe Quellen: Datenblätter, Handbücher, Paper (Index `references/README.md`) |

## 📈 Stand

- **Einsatzbereit:** Teleoperation per Gamepad, VR und Web, MoveIt-Planung mit Vorschau, 3D-Vision und Greifen (ZED Mini), Sprach- und Blicksteuerung, Nexus Webapp, Fernsteuerung im Heimnetz, Blackbox-Recorder (letzte 60 s als rosbag2 bei E-Stop/Kollision).
- **In Arbeit:** VLA-M-Chat (LLM-Agent, in der Roboter-Simulation mit der Physik-Sandbox getestet; Demos werden aufgenommen, Modelltraining geplant), Physik-Sandbox.
- **Offene Entscheidungen:** TODOS.md.

## ⚖️ Lizenz

Apache License 2.0 für die eigenen Pakete, die Nexus Webapp, das Touch Panel und die Werkzeuge. Fremdcode (`xarm_ros2`, `zed-ros2-*`, `ros2_whisper`, `web_video_server`, Bibliotheken unter `lib/` und `vendor/`) behält seine eigene Lizenz.
