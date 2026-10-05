<a name="top"></a>

# 🗂️ Repository-Struktur

[🏠 Übersicht](../readme-de.html) · [🇬🇧 English](../en/repository_structure.html) · Kapitel 9

---

## 9. 🗂️ Repository-Struktur

```
dev_ws/
├── .claude/                                                               # Hilfsmittel nur für Claude Code (nicht für den Roboterbetrieb)
│   ├── agents/                                                            # Projekt-Agenten: ws-explorer, test-runner, ui-verifier, safety-reviewer, robustness-reviewer, showcase-reviewer, docs-auditor
│   ├── hooks/                                                             # Prüfungen vor einem Befehl und nach jedem Edit
│   ├── memory/                                                            # Gemeinsames Claude-Memory (im Git, verknüpft von tools/ws_sync.sh)
│   ├── mods/                                                              # Claude-Code-Mods: answer-cards (Antworten als Karten in VS Code), ros-safety-status (Statuszeile FAKE/REAL)
│   ├── skills/                                                            # Skills mit ihren Skripten, z.B. preview/ (capture.py Screenshots, build.py Spec → Seite), answer-page/ (Antwortformat)
│   └── README.md                                                          # Übersicht über Hooks, Skills, Agents, Mods
├── _imgs/                                                                 # System-Screenshots, Architekturgrafiken & Assets
│   ├── icons/                                                             # SVG-Icons der Karten der Nexus Webapp (z. B. icon_vla.svg, icon_touch_panel.svg)
│   ├── robotsystem.jpg                                                    # Gesamtsystem Hardware-Setup Übersicht
│   └── gaze_control_interface.png                                         # Tobii Gaze Eye-Tracking GUI Vorschau
├── certs/                                                                 # SSL/TLS-Zertifikate für WebXR HTTPS-Server
│   ├── cert.pem                                                           # HTTPS Öffentliches Zertifikat
│   └── key.pem                                                            # HTTPS Privater Schlüssel
├── config/                                                                # Zentrale Einstellungen (kein ROS-Paket)
│   └── network.yaml                                                       # Roboter-IP, IP-Kameras, Tobii – gelesen über dev_ws_network
├── docs/                                                                  # Dokumentationsseiten (Übersicht: README.md / readme-de.md)
│   ├── project_docs.html                                                  # Projekt-Doku: Einstieg zu Handbuch, Setup-Karte, Poster, Projektseiten (Nexus: /ws/docs/project_docs.html)
│   ├── project_manual.html                                                # Bedienhandbuch (deutsch, eigenständiges HTML; Nexus: /manuals/project_manual.html)
│   ├── project_setup_guide.html                                           # Setup-Guide DE/EN: Inbetriebnahme-Checkliste, PC vorinstalliert oder ab nacktem Ubuntu (/manuals/project_setup_guide.html)
│   ├── project_presentation.html                                          # Projektvorstellung: interaktive Seite zu Shared Control, KI/VLA, Vision, UI/UX, Evaluierung (Bilder: img/presentation/)
│   ├── project_showcase.html                                              # Showcase: Produktseite des Projekts
│   ├── project_functions.html                                             # Funktionsatlas: alle Funktionen und ihre Abläufe
│   ├── claude_workflow.html                                               # Wie das Projekt mit Claude Code entwickelt wird (Skills, Hooks, parallele Chats)
│   ├── en/ · de/                                                          # je 13 Seiten: Konzept, Installation, Starten, Teleoperation, …
│   ├── brand/                                                             # Brand-Kit brand.yaml: Name, Claim, Slogans, Farben, Schriften (geprüft von tools/check_showcase.py)
│   ├── css/ · js/ · fonts/ · templates/                                   # Gemeinsame Styles, Skripte (z. B. lite6_mesh.js), lokale Schriften und Vorlagen der Projektseiten
│   └── img/                                                               # Screenshots; diagrams/ (erzeugt), presentation/, project_docs/
├── isaacsim/                                                              # NVIDIA-Isaac-Sim-Checkout, lokal je PC, nicht in Git (COLCON_IGNORE) + Lite-6-Assets
│   ├── lite6_isaac_ros2.usd                                               # USD-Szene für xArm Lite 6 in Isaac Sim
│   ├── lite6_with_gripper.urdf                                            # Eigenständiges URDF-Modell mit Lite 6 Greifer
│   └── start_isaac_sim.sh                                                 # Isaac Sim ROS 2 Startskript
├── models/                                                                # YOLO-Gewichte yolov8l.pt / yolov8s.pt / my_yolo_model.pt (wählbar über yolo_model:=...)
├── poster/                                                                # A2-Projektposter (kein ROS-Paket)
│   ├── poster_a2.html                                                     # Poster als Webseite (420 × 594 mm, druckt 1:1 auf A2)
│   ├── poster_a2.pdf                                                      # Druckfertiger Export (headless Chrome)
│   ├── make_preview.py                                                    # Erzeugt das Key Visual poster_preview.svg / .png (braucht google-chrome)
│   ├── poster_preview.svg / .png                                          # Key Visual
│   └── img/                                                               # Screenshots (FAKE-Modus, 28.09.2026) & Laborfoto
├── ros2_nexus/                                                            # Zentraler Web-Launcher & Desktop-App-Integration
│   ├── ROS2_Nexus.desktop                                                 # Ubuntu Desktop-Verknüpfung (.desktop Eintrag)
│   ├── install_app.sh                                                     # Einrichtungs-Skript für .desktop-Verknüpfung & Icon
│   ├── kill_ros2.sh                                                       # Stufenweiser Stopp (SIGINT → SIGTERM → SIGKILL) von ros2 run/launch, rviz2 (nur eigene ROS_DOMAIN_ID) & Terminal-Wrappern, danach ROS 2 Daemon stoppen
│   ├── cyclonedds.xml                                                     # Hebt das CycloneDDS-Participant-Limit an (Unicast-Discovery)
│   ├── launcher_config.json                                               # Master Prozess- & Button-Konfiguration für Nexus
│   ├── ros2_nexus_web_start.sh                                            # Startet Backend + Nexus-Fenster, beendet beide gemeinsam
│   ├── ros2_nexus_web.py                                                  # Flask-Backend (Port 8080): Starts, Konfiguration, /api/launch_details
│   ├── nexus_runs.py                                                      # Sequenzstart mit Bereitschafts-Checks, Laufzustand, Log-Dateien (begrenzt: 50 MB/Datei, 2 GB)
│   ├── nexus_backups.py                                                   # Sicherungen der launcher_config.json vor jedem Speichern (letzte 20)
│   ├── nexus_settings.py                                                  # Globale Schalter (Terminals bei Execute), ~/.config/ros2_nexus/settings.json
│   ├── nexus_preflight.py                                                 # Vorabprüfung vor EXECUTE: Roboter/Kameras erreichbar, Ports frei, doppelte Stacks, GPU, Platte
│   ├── nexus_config.py                                                    # Räumt launcher_config.json beim Speichern auf (Argument-Zustände gelöschter Launches)
│   ├── nexus_windows.py                                                   # Holt Fenster auf dem X11-Desktop nach vorn; Robot Control UI bleibt oben
│   ├── test/                                                              # Unit-Tests (Logs, Config-Sicherungen), ohne ROS
│   ├── ros2_nexus_runs.js                                                 # Fortschrittszeile, Laufzustand auf den Karten, Log-Schublade, Deep-Links
│   ├── ros2_nexus_backups.{js,css}                                        # Knopf „Backups“ im Start-Popup: Config-Sicherungen auflisten und wiederherstellen
│   ├── ros2_nexus_web.html                                                # Startseite der Nexus Webapp (nur Start-Popup)
│   ├── ros2_nexus_popup_window.py                                         # Rahmenloses WebKitGTK-Fenster für das Start-Popup
│   ├── ros2_nexus_styles.css                                              # Nexus CSS-Stylesheets
│   ├── ros2_nexus_script.js                                               # Zentraler Prozessmanager & Log-Viewer
│   ├── js/                                                                # ES-Module des Frontends (Einstieg main.js): Parameter, Konsole, Sequenz-Popup
│   └── vendor/                                                            # Schriften, Font Awesome & roslib, lokal ausgeliefert (/vendor/…)
├── sounds/                                                                # Akustische Benachrichtigungs- & TTS-Audiodateien
│   ├── _voice_blue_cube.mp3 / _voice_green_cylinder.mp3 ...              # Vorgerenderte Sprachausgabe für Objekte
│   └── ui_mouse_click.mp3                                                 # UI-Klick-Soundeffekt
├── src/
│   ├── gaze_control_ui_tobii_glasses/                                     # 👁️ Python: PyQt5 Blick-Auswahl & Kalibrierungs-UI
│   │   ├── gaze_control_ui_tobii_glasses/gaze_ui_core.py                 # Gemeinsamer Kern: Knöpfe, Verweilen, Blick-Mapping, Servo
│   │   ├── gaze_control_ui_tobii_glasses/gaze_ui_node_tobii_glasses.py    # Gaze UI (`gaze_ui`)
│   │   └── gaze_control_ui_tobii_glasses/gaze_ui_node_tobii_glasses_zedm.py # Gaze UI mit ZED-M-Bild (`gaze_ui_zedm`)
│   ├── gaze_grasp_routine_tobii_glasses/                                  # 👁️ Python: Tobii Eye-Tracking Blick-zu-3D-Greif-Routine
│   │   └── gaze_grasp_routine_tobii_glasses/gaze_grasp_routine_tobii_glasses.py # Dwell-Time-Auswahl, Homographie-Lokalisierung, Greifen
│   ├── dev_ws_network/                                                    # Python: net_get() für config/network.yaml (Nodes, Web-UIs, Nexus)
│   ├── http_monitoring_dashboard_p8083/                                        # 📈 Python/JS: Monitoring Dashboard (Port 8083) – System, Nutzung & Evaluierung
│   │   ├── http_monitoring_dashboard_p8083/monitoring_server.py                     # Webserver + JSON-API + ROS-2-Monitor (Graph, Topic-Raten, Nutzung, Sessions)
│   │   ├── http_monitoring_dashboard_p8083/store.py                            # SQLite-Speicher (Minutenmittel, Motions, Sessions, Events) + 1-h-Ringpuffer
│   │   ├── http_monitoring_dashboard_p8083/collectors.py                  # System-Kennzahlen (psutil, nvidia-smi) und Port-Checks der Web-UIs
│   │   ├── http_monitoring_dashboard_p8083/ros_monitor.py                 # ROS-2-Seite: Graph, Topic-Raten, Robot-Nutzung, Sessions
│   │   ├── http_monitoring_dashboard_p8083/blackbox.py                    # Listet Blackbox-Vorfälle (~/.ros/blackbox, nur lesend)
│   │   ├── http_monitoring_dashboard_p8083/study.py                       # Usability-Studie: Tests, Aufgaben, Testpersonen, Durchläufe, Fragebögen
│   │   ├── index.html · js/ · css/                                        # Web-UI (Ansichten: Übersicht, System, Prozesse, UIs & Dienste, ROS-Graph, Topics, Robot-Nutzung, Greifen & Ablegen, Nutzer & Sessions, Evaluierung, Event Logs)
│   │   └── launch/monitoring_dashboard.launch.py                               # ros2 launch … port:=8083 open_browser:=true db:=…
│   ├── http_robot_control_ui_p8081/                                       # 🎮 HTML/JS: Eigenständiges Roboter-Steuerungs- & Jogging-Webpanel
│   │   ├── index.html                                                     # Roboter-Steuerungsoberfläche (Port 8081)
│   │   ├── vr_mirror.html                                                 # PC-Fenster, das die Sicht der Quest 3 spiegelt
│   │   ├── install_desktop_icon.sh                                        # Installiert Icon & .desktop-Eintrag der Robot Control UI
│   │   ├── style.css · css/                                               # Stylesheet; css/theme_light.gen.css erzeugt von tools/gen_theme_light.py
│   │   ├── launch/                                                        # http_robot_control_ui.launch.py: Webserver, rosbridge 9090, Watchdog
│   │   ├── js/                                                            # ES-Module (main.js, ros.js, jog.js, motion.js, sequence.js, sandbox.js, remote.js, hud_dock.js, config.js …)
│   │   │   └── twin/                                                      # digital_twin.js (three.js-Twin), lab_room.js, logistics_cell.js, vcam_render.js, reachability*.js, xr*.js (VR-Viewport, HUD, Spiegel)
│   │   ├── lib/                                                           # three.js r186, urdf-loader & Rapier-Physik (lokal, offline-fähig)
│   │   ├── http_robot_control_ui_p8081/server.py                          # Webserver Port 8081 (no-cache + automatisches ?v=)
│   │   ├── http_robot_control_ui_p8081/rosapi_health.py                   # Startet einen hängenden /rosapi desselben Launches neu (respawn)
│   │   ├── http_robot_control_ui_p8081/rosapi_safe.py                     # rosapi_node-Wrapper: Parameter-Whitelist ohne Absturz (N20)
│   │   └── roslib.min.js                                                  # ROS 2 Web-Bridge Client-Bibliothek
│   ├── web_video_server/                                                  # 📹 ROS 2 HTTP/MJPEG Streaming-Bridge (Port 8082)
│   │   ├── CMakeLists.txt
│   │   ├── package.xml
│   │   └── launch/web_video_server.launch.py                              # Startet web_video_server & window_x11_streamer
│   ├── robot_vision_cameras_bringup/                                      # 🌟 Vision-Pipeline, TF-Kalibrierung & Greif-Ausführung
│   │   ├── action/
│   │   │   └── GraspObject.action                                         # ROS 2 Action-Definition für autonomes Greifen
│   │   ├── config/
│   │   │   ├── grasping_params.yaml                                       # Hover-Höhe, Z-Offset, Orientierung, IK-Toleranzen, Geschwindigkeit
│   │   │   ├── perception_params.yaml                                     # YOLO-Modell, Konfidenzschwelle, EMA-Glättung, Klassen-Overrides
│   │   │   └── zed_override.yaml                                          # ZED-Kamera Overrides (HD720, NEURAL Modus, 10 m Reichweite)
│   │   ├── launch/
│   │   │   ├── robot_vision_cameras_bringup.launch.py                     # Zentraler All-in-One Vision- & Greif-Launcher (ZED-M / IP-Cam)
│   │   │   └── zed_cam_eef_rviz_octomap_yolo.launch.py                    # Hand-Eye Endeffektor-Kamera & OctoMap-Launcher
│   │   └── scripts/
│   │       ├── pointcloud_optimizer.py                                    # NaN-freie Wolke für OctoMap + ausgedünnte Web-Wolke für den Twin
│   │       ├── yolo_3d_bbox_for_zed_m.py                                  # YOLO 2D-Detektionen projiziert auf 3D-Punktwolken-Cluster
│   │       ├── yolo_3d_bbox_for_ip_cam.py                                 # IP-Webcam Homographie 3D-Objektlokalisierung
│   │       ├── yolo_moveit_collision.py                                   # Dynamischer MoveIt Kollisionsobjekt-Publisher
│   │       ├── yolo_planned_grasp_executor.py                             # 3-Phasen-Greifablauf (GraspObject Action Server)
│   │       ├── yolo_grasp_executor.py                                     # Fallback: direktes kartesisches Greifen über /ui/execute_move_to_pose
│   │       ├── grasp_action_bridge.py                                     # Bridge /ui/grasp_object_cmd (Topic) → GraspObject Action
│   │       └── virtual_object_detections.py                               # Virtuelle Szenenobjekte (Cube, Rectangle, Cylinder + 5 Greif-Objekte) als Detektionen
│   ├── remote_control_watchdog/                                           # 🔒 Python: Server-Seite der Client/Server-Steuerung
│   │   ├── launch/remote_control_watchdog.launch.py                       # Eingebunden von http_robot_control_ui.launch.py
│   │   └── remote_control_watchdog/remote_control_watchdog.py             # Control-Lock, Freigabe, Heartbeats, REAL/FAKE-Grenzen, Remote-Gamepad → /joy
│   ├── robot_blackbox_recorder/                                           # Python: letzte 60 s wichtiger Topics, als rosbag2 bei E-Stop / Servo-Halt / Kollision
│   ├── robot_motion_handler_movegroup/                                    # 🤖 Python: Zentraler MoveGroup kartesischer & Gelenkplaner
│   │   ├── launch/standalone_move_group.launch.py                         # MoveGroup, eingebunden von beiden MoveIt-Servo-Launches
│   │   └── robot_motion_handler_movegroup/
│   │       ├── robot_motion_handler_movegroup.py                          # UI-Bewegungsservices, kollisionsbewusstes MoveTo, MoveIt-Fortschritt
│   │       └── moveit_floor_collision.py                                  # Tischplatte als MoveIt-Kollisionsobjekt (schaltbar)
│   ├── ros2_whisper/                                                      # 🎙️ Whisper AI Sprache-zu-Text Inferenzknoten
│   ├── fake_linear_axis/                                                  # 🎚️ Python: Headless TF-Publisher & interaktiver Marker
│   │   └── fake_linear_axis/fake_linear_axis_node.py
│   ├── scene_objects/                                                     # 📍 Python: RViz2-Marker für Schutzzonen & Arbeitsbereichsgrenzen
│   │   ├── launch/scene_objects.launch.py
│   │   └── scene_objects/
│   │       ├── scene_objects.py                                           # Publiziert Tischgrenzen & Sperrzonen-Marker
│   │       ├── scene_safety_zone.py                                       # Publiziert unerreichbare Zone (3D) + Bahnabstand der Scans
│   │       ├── scene_zedm_stand.py                                        # Publiziert Kamerastativ & ZED-M-Mesh
│   │       ├── scene_table.py                                             # Publiziert den Tisch unter dem Roboter
│   │       └── scene_grasp_items.py                                       # Publiziert die Greif-Objekte (Flasche, Bälle, Schale, Korb)
│   ├── scene_objects_distance_to_tcp/                                     # 📏 Python: Dynamische Greifer-zu-Objekt Distanzlinie & 2D-HUD
│   │   ├── CMakeLists.txt
│   │   ├── package.xml
│   │   └── scripts/
│   │       └── scene_objects_distance_to_tcp.py
│   ├── servo_status/                                                      # 🖥️ Python: RViz2 2D-Text-Overlay HUDs
│   │   └── servo_status/
│   │       └── servo_status.py                                            # MoveIt Servo-Status & Warn-HUD Overlay
│   ├── window_x11_streamer/                                               # 📹 Python/mss: X11-Fenstererfassung (Default: RViz2) → /window_capture/image_raw
│   │   └── window_x11_streamer/window_capture_node.py
│   ├── tcp_laser_pointer/                                                 # 🔴 Python: Automatische Steuerung des TCP-Laserpointers
│   │   └── tcp_laser_pointer/laser_pointer_node.py
│   ├── teleop_pre_collision_checker/                                      # 🛡️ Python: Prädiktiver Kollisionswächter & Geschwindigkeitsskalierer
│   │   └── teleop_pre_collision_checker/teleop_pre_collision_checker.py
│   ├── tf_control_tuner/                                                  # 📐 Python: Interaktives TF-Transformations-Kalibrierungstool
│   │   └── tf_control_tuner/tf_control_tuner.py
│   ├── voice_command_listener/                                            # 🗣️ Python: Intent-Parser für Sprachbefehle & Aktionsauslöser
│   │   ├── launch/voice_listener.launch.py
│   │   └── voice_command_listener/voice_command_listener.py               # Zuordnung Sprachbefehl → Roboteraktion
│   ├── vla_bridge/                                                        # 🧠 Python: Backend des VLA-M-Chats = LLM-Agent (Ollama / Claude, LeRobot geplant)
│   │   ├── launch/vla_bridge.launch.py
│   │   ├── config/vla_bridge.yaml                                         # Sprachmodell, Szenen-Topic, Sicherheit, Greifhöhen, Zeitgrenzen
│   │   ├── scripts/install_ollama.sh                                      # Ollama + Modell ohne sudo (~/.local/ollama)
│   │   ├── vla_bridge/vla_bridge_node.py                                  # /vla/*-Topics, Bestätigen / Ausführen / Abbrechen / Not-Aus, Neuplanung
│   │   ├── vla_bridge/agent.py                                            # Prompt, JSON-Schema, Planprüfung + Selbstkorrektur, Recovery (ohne ROS, pytest)
│   │   ├── vla_bridge/llm.py                                              # Backends Ollama (lokal, startet ollama serve) und Anthropic
│   │   ├── vla_bridge/skills.py                                           # pick / place / home / gripper über Approach from above, Yaw-Suche, Greifprüfung
│   │   ├── vla_bridge/world_model.py                                      # Beziehungen (liegt auf / in / bedeckt, Reichweite, stapelbar) für die Planprüfung
│   │   ├── vla_bridge/examples.py                                         # Few-Shot-Musterdialoge für kleine lokale Modelle
│   │   ├── vla_bridge/placing.py                                          # Freiraum für den Greifer beim Ablegen neben hohen Objekten
│   │   ├── vla_bridge/palletizing.py                                      # Palettier-Planer für die Szene „Logistics - auto palletizing“ (reines Python)
│   │   ├── vla_bridge/pallet_job.py                                       # Auto-Palettieren: Plan aus der Szene, Ausführung Karton für Karton
│   │   ├── vla_bridge/session_log.py                                      # Agenten-Runden als JSON Lines (~/.ros/vla_logs, größenbegrenzt)
│   │   └── vla_bridge/scene.py                                            # Szene aus /zed/bboxes_3d (Label, Farbe, Greifkugel, Box)
│   ├── vr_quest3_teleop/                                                  # 🥽 Meta Quest 3 WebXR Teleoperations-Bridge
│   │   ├── https_vr_webxr_p8443/                                          # Sichere WebXR Browser-Oberfläche & 3D-Controller
│   │   │   └── https_vr_webxr_p8443.py                                    # HTTPS-Server (Port 8443) für die WebXR-Seite
│   │   ├── vr_quest3_teleop/rosapi_guard.py                               # Startet /rosapi nur, wenn noch keiner läuft
│   │   └── vr_quest3_teleop/vr_quest3_teleop_node.py                      # VR 6-DoF Controller-Pose zu MoveIt Servo Bridge
│   ├── xarm_ros2/                                                         # 🤖 Offizieller xArm ROS 2 Stack (ins Repo kopiert, erweitert)
│   │   └── xarm_moveit_servo/src/xarm_joystick_input.cpp                  # Gamepad-Eingabeknoten mit Kollisionsbremsen-Integration
│   ├── zed-ros2-interfaces/                                               # 📷 Benutzerdefinierte ROS 2 Interfaces für Stereolabs ZED Kameras
│   └── zed-ros2-wrapper/                                                  # 📷 Stereolabs ZED ROS 2 Kameratreiber
├── tools/                                                                 # Werkzeuge
│   ├── ui_new_code_checker.py                                             # Headless-Prüfung aller Web-UIs inkl. Monitoring Dashboard + HUD, isoliert (1920/1366/1280 px)
│   ├── grasp_e2e.py                                                       # FAKE-Test Ende zu Ende: Greifen/Ablegen über die UI, Not-Halt, IK-Vorabprüfung (eigene Domain, --quick ~5 min)
│   ├── vla_eval.py                                                        # Bewertungs-Set für den VLA-Agenten (vla_eval_cases.json, --check ohne LLM)
│   ├── pre-commit · install_hooks.sh                                      # Git-Vor-Commit-Prüfung der gestageten Dateien (flake8, JSON/YAML, Tokens, check_ws, check_ports, pytest-Suiten, check_showcase; --changed = alles Uncommittete)
│   ├── check_showcase.py                                                  # README, docs/, Projektseiten, Poster gegen docs/brand/brand.yaml (Namen, tote Links, en/de-Dateien)
│   ├── publish_pages.py                                                   # Stellt die Projektseiten für GitHub Pages zusammen (maskiert IPs, lokale Schriften)
│   ├── make_diagrams.py                                                   # Erzeugt die Architektur-Diagramme docs/img/diagrams/*.svg
│   ├── check_ports.py                                                     # Ports in config/network.yaml gültig/eindeutig, keine festen ws-Ports im JS
│   ├── demos_to_lerobot.py                                                # Aufgenommene Demos (demo_recorder) -> LeRobotDataset (LeRobot-venv); --check
│   ├── check_ui_tokens.py                                                 # Prüft ui_shared/ui_tokens.css gegen die UIs
│   ├── check_ws.py                                                        # Konsistenz: setup.py/Entry-Points, Launch-Verweise, Nexus-Befehle
│   ├── monitoring_sim.py                                                  # Testdaten-Simulator für das Monitoring Dashboard (nur isolierte Domain, z.B. 97)
│   ├── bench_nexus_webkit.py                                              # Misst CPU/FPS des Nexus-App-Fensters (WebKitGTK, unsichtbar)
│   ├── firewall_setup.sh                                                  # ufw-Regeln anzeigen / --apply / --undo
│   ├── ws_sync.sh                                                         # Abgleich Laptop / Labor-PC / Home-PC: Einrichten, git pull --rebase, geänderte Pakete bauen (--setup, --no-build)
│   ├── install_blender.sh                                                 # Installiert/aktualisiert Blender + Blender-MCP-Server ohne sudo (--check)
│   ├── reel_render.py                                                     # Rendert eine Video-Seite Bild für Bild (Headless Chrome → ffmpeg)
│   ├── make_docs_lite6.py                                                 # Erzeugt docs/js/lite6_mesh.js (Lite-6-Meshes für die Projektseiten)
│   ├── generate_reachability_grid.py                                      # Berechnet Erreichbarkeitsgitter + Manipulierbarkeit des Lite 6 vorab
│   └── install_zed.sh                                                     # ZED SDK & CUDA Installations-Hilfsskript
├── touch_panel/                                                           # Touch Panel für ein Zusatz-Touch-Display (Nexus Webapp /touch)
│   ├── touch_panel_server.py                                              # Flask-Blueprint: Seite /touch + /api/touch/* (state, stop, close, sequences)
│   ├── touch_panel_start.sh                                               # Kiosk-Start: findet das HDMI-Touch-Display, mappt den USB-Touch, Chrome-Kiosk
│   └── web/                                                               # Seite, CSS, JS-Module, Icon
├── ui_shared/                                                             # Gemeinsam für die Web-UIs
│   ├── ui_tokens.css                                                      # Farben, Achsenfarben, Schriften, Schriftgrößen (--ui-*, --fs-*)
│   ├── ui_theme.{js,css}                                                  # Themes aller Web-UIs (THEMES, html[data-ui-theme], Alt+T); themes/<id>.css, fonts/
│   └── net_info.{js,css}                                                  # Info-Karte „Setup“ (Systemübersicht, Netze, IPs, Ports, HTTPS, Touch-Display, VLA-M; DE/EN) für Monitoring Dashboard + Nexus
├── video/                                                                 # Präsentationsvideos (kein ROS-Paket)
│   ├── reel/                                                              # reel.html (deterministische Video-Seite) + drehbuch.md, gerendert von tools/reel_render.py
│   └── vorlagen/ · vorlagen_src/                                          # Overlay-Bilder (Badges, Bauchbinden); Quellen in vorlagen_src/ (templates.html, render.sh)
├── AGENTS.md                                                              # Namens- & UI-Richtlinien für KI-Agenten
├── TODOS.md                                                               # Offene Optimierungen & Entscheidungen
├── README.md                                                              # Overview (English) – Details in docs/en/
└── readme-de.md                                                           # Übersicht (Deutsch) – Details in docs/de/
```

---

[⬅ Zurück: Monitoring Dashboard](monitoring.html) · [🏠 Übersicht](../readme-de.html) · [⬆ Nach oben](#top) · [Weiter: Archiv & verworfene Konzepte ➡](archive.html)
