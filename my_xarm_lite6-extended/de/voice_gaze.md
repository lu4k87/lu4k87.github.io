<a name="top"></a>

# 🗣️ Sprach- & Blicksteuerung

[🏠 Übersicht](../readme-de.html) · [🇬🇧 English](../en/voice_gaze.html) · Kapitel 3.4

---

## 3.4 Funktion: Multimodale Interaktion (Sprache & Blicksteuerung)
*Diese experimentellen Module erlauben die "Hands-Free"-Steuerung des Systems.*

### Whisper AI Sprachsteuerungs-Pipeline
<p align="center"><img src="../img/diagrams/voice_pipeline.svg" width="100%" alt="Whisper-Sprachsteuerungs-Pipeline"></p>

*Whisper-Sprachsteuerungs-Pipeline · Quelle: `tools/make_diagrams.py`*

<img src="../img/rcu_speech.png" width="420" alt="Sprachsteuerung in der UX | Control Interface">

*UX | Control Interface (früher „Robot Control UI“), Bereich **Assistant (VLA) › Speech**: **Start Listening** (Mikrofon anklicken oder X am Gamepad → `/ui/voice_listen_trigger`), der erkannte Befehl (`/ui/voice_status`) und die Liste der letzten Sprachbefehle.*

### Tobii Eye-Tracking Pipeline
<p align="center"><img src="../img/diagrams/gaze_pipeline.svg" width="100%" alt="Tobii-Eye-Tracking-Pipeline"></p>

*Tobii-Eye-Tracking-Pipeline · Quelle: `tools/make_diagrams.py`*

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `bringup.launch.py` (`whisper_bringup`) &nbsp;&nbsp; <sub><i>`/src/ros2_whisper/whisper_bringup/launch/bringup.launch.py`</i></sub>

**Zweck & Aufgabe:** Lokale Speech-to-Text KI. Transkribiert den Mikrofon-Stream mit Whisper und publiziert die gesprochenen Wörter als Text.

<details>
<summary><b>🔽 Details anzeigen</b> · Run Command · Action Server</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> # GPU-Beschleunigung (CUDA - Standard):
> ros2 launch whisper_bringup bringup.launch.py use_gpu:=true
> 
> # CPU-Fallback:
> ros2 launch whisper_bringup bringup.launch.py use_gpu:=false
> ```
>
> - **Hörfenster statt Dauerbetrieb:** Die Inferenz läuft nur `listen_window_ms` (Standard 7000 ms) nach einem `listen`-Trigger auf `/ui/voice_listen_trigger` (die Aufnahme des Listeners dauert 5 s), bzw. `dictation_window_ms` (Standard 10000 ms) nach einem `dictate`-Trigger (Diktat aus der VLA-M-Section: Der Listener nimmt bis `dictation_max_s` = 8 s auf, führt keine Sprachbefehle aus und meldet `Listening...` / `Dictation: <Text>` / `-- No speech detected --` / `Error: …` auf `/ui/voice_dictation`). Vorher transkribierte Whisper alle 250 ms den kompletten Puffer, auch bei Stille (Dauer-GPU-Last, Log-Flut). `listen_window_ms: 0` schaltet zurück auf Dauerbetrieb.
> - **Modell & Dekodierung (`whisper_server/config/whisper.yaml`):** Multilinguales Modell `small` (EN/DE, deutlich sauberer als `base`, ca. 50-120 ms pro Durchlauf auf der RTX A5000; wird beim ersten Start nach `~/.cache/whisper.cpp` geladen), `language: "auto"`, Greedy-Dekodierung (`beam_size: 1`), `temperature: 0.0`, `no_context: true`. `initial_prompt` bleibt bewusst leer: Mit Befehls-Prompt halluzinierte Whisper bei Stille Text und rechnete langsamer (getestet). Die eingebundene whisper.cpp-Version hat keinen VAD - das alte Argument `silero_vad_use_cuda` ist wirkungslos.
> - **GPU / CPU:** `use_gpu:=true|false`. In der UX | Nexus Launcher (früher „Nexus Webapp“) hat die Speech-Control-Karte im Launch-Popup einen Umschalter **Whisper CPU | GPU**. Bei `use_gpu:=false` lädt die Launch-Datei zusätzlich das **CPU-Profil** `whisper_cpu.yaml`: `small` braucht auf der CPU ~11 s pro Durchlauf - länger als die 5-s-Aufnahme des Listeners -, daher nutzt das CPU-Profil `base`, 12 Threads und `audio_ctx: 320` (Encoder über 6,4 s statt 30 s): ~0,35-0,75 s pro Durchlauf, Befehle nach ~3 s erkannt (gemessen auf dem i9-12900K). Die Zeilen `ggml_cuda_init … found 1 CUDA devices` erscheinen auch im CPU-Modus (die Bibliothek ist mit CUDA gebaut); entscheidend sind `use gpu = 0` und die Log-Zeile `Decoding: … CPU`.
> - **Launch-Argumente (`bringup.launch.py`):** `use_gpu` (Standard `true`), `active` (Standard `true`, Whisper-Node startet aktiv), `device_index` (PyAudio-Gerät, `-1` = Standard), `model_name` und `language` (leer = Wert aus `whisper.yaml` bzw. dem CPU-Profil; wird nach dem CPU-Profil angewendet).
> - **Performance & Thread-Sicherheit:** Der zugrundeliegende C++ Action Server (`TranscriptManager`) wurde mit einem strikten `std::mutex`-Locking Mechanismus abgesichert, um parallele Data-Race-Abstürze bei hochfrequenter Token-Generierung vollständig zu eliminieren. Zudem verfügt die `Inference`-Node über eine gehärtete Puffer-Löschstrategie (`audio_ring_->clear()`), die alte Audio-Reste exakt in der Millisekunde aus dem Ring-Puffer physisch entfernt, in der der Nutzer den UI-Button drückt. Dies garantiert mathematisch, dass keine "Geisterkommandos" aus vorherigen Sprachaufnahmen versehentlich ausgeführt werden.
>
>
> ![Action Server](https://img.shields.io/badge/Action_Server-008080?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/whisper/inference`** | `whisper_idl/action/Inference` | *Action-Server für Echtzeit-Spracherkennung und Transkription.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `audio_listener.py` &nbsp;&nbsp; <sub><i>`/src/ros2_whisper/audio_listener/audio_listener/audio_listener.py`</i></sub>

**Zweck & Aufgabe:** Verarbeitet Mikrofoneingaben für das Sprachsteuerungssystem. Beinhaltet eine automatische, systembewusste Fallback-Logik, die explizit nach den System-Standard-Audiogeräten `pulse` oder `default` sucht und diese priorisiert, um eine zuverlässige Sprachaufzeichnung über verschiedene Hardware-Umgebungen hinweg zu garantieren.

<details>
<summary><b>🔽 Details anzeigen</b> · Run Command · Publishes</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 launch whisper_bringup bringup.launch.py use_gpu:=true
> ```
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`~/audio`** | `std_msgs/Int16MultiArray` | *Publiziert den rohen Audiostream vom Mikrofon.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `voice_command_listener.py` &nbsp;&nbsp; <sub><i>`/src/voice_command_listener/voice_command_listener/voice_command_listener.py`</i></sub>

**Zweck & Aufgabe:** Analysiert den diskreten, einzeln getriggerten Rohtext über exakte Regex-Muster und extrahiert die vom Nutzer definierten Handlungs-Intents: Stopp („Stopp“, „Halt“, „Abbrechen“ – hält die Fahrt an, verwirft Offenes), Not-Aus („Not-Aus“, „Nothalt“), Startposition, absolute Zielpose, Scan-Position („Szene scannen“), Werkzeug ausrichten („TCP ausrichten“), Objekt anfahren (Objekt im Feld des manuellen Greifziels), Bestätigen / Verwerfen (Pfad im MoveIt-Popup, VLA-M-Plan; nur als kurzer Satz bis 3 Wörter und nur, wenn genau eins wartet; verneint – „Nicht ausführen“ – wird daraus Verwerfen; andere verneinte Befehle wie „Nicht die Szene scannen“ lösen nichts aus), Greifer öffnen / schließen („Sauger aus / an“; öffnen erst nach „Bestätigen“, außer der Greifer meldet *open*/*off*), Tempo-Stufe („Tempo drei“ → `Speed: 3`, „Ganz langsam“ → `Speed: 1`; erhöhen um höchstens eine Stufe), schneller, langsamer. Die Muster stehen in `COMMAND_PATTERNS` (`voice_command_listener.py`, laufen auf dem normalisierten Text: klein, ae/oe/ue/ss, ohne Satzzeichen), ausgeführt wird in der UX | Control Interface über `VOICE_COMMANDS_DATA` (`js/voice.js`); Stopp und Not-Aus gehen jedem anderen Befehl im Satz vor („Stopp, nicht zur Scan-Position“ = Stopp), gelten auch während des Cooldowns (`cooldown_sec`, 3 s) und löst der Node zusätzlich selbst aus (`/ui/emergency_stop_topic`, `/ui/halt_motion`) – sie wirken also auch ohne offene UX | Control Interface. Alle anderen Befehle führt nur ein sichtbarer Tab aus. Startposition, absolute Zielpose, Scan-Position und Werkzeug ausrichten laufen wie die Buttons über `requestMotion` (`js/motion.js`): Bei Auto-Move aus wartet die Fahrt im MoveIt-Popup, gefahren wird erst nach „Bestätigen“ (oder ▶), „Verwerfen“, „Stopp“, Not-Aus und ein Verbindungsabbruch verwerfen sie. Test: `src/voice_command_listener/test/test_commands.py`. Die Home-Fahrt braucht eine eindeutige Phrase („go home“, „home position“, „reset pose“, „initial pose“, „Fahre zur Startposition“); ein einzelnes „home“ oder „reset“ löst nichts aus. Enthält eine hohe Toleranz für ähnlich klingende Whisper-Erkennungen (z.B. "pause" oder "power" als "pose"). Implementiert eine robuste **3-Stufen-Deduplikations-Zustandsmaschine**, die eine exakt einmalige Befehlsausführung garantiert. Whisper-Geräuschmarkierungen wie `[BLANK_AUDIO]`, `(sighs)` oder `*music*` werden vor der Auswertung entfernt. Der Node spielt **keinen eigenen Sound**: Die Ansage „robot moves to ...“ kommt von `robot_motion_handler_movegroup`, und zwar erst, wenn die Fahrt wirklich startet (vorher lief sie doppelt - und fälschlich, wenn die Fahrt abgelehnt wurde).

<details>
<summary><b>🔽 Details anzeigen</b> · Run Command · Subscribes · Publishes · Services · Action Client</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> # Whisper + Listener zusammen (Karte "Speech Control" in der UX | Nexus Launcher):
> ros2 launch voice_command_listener voice_listener.launch.py use_gpu:=true
>
> # Nur der Listener (Whisper läuft bereits):
> ros2 run voice_command_listener voice_command_listener
> ```
>
>
> ![Action Client](https://img.shields.io/badge/Action_Client-00BCD4?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/whisper/inference`** | `whisper_idl/action/Inference` | *Action-Client mit intelligenter Early-Cancellation und 3-Stufen-Deduplikation.* |
>> | *-* | *-* | *⚡ **Early Cancellation:** Wird schon im Zwischen-Feedback ein gültiger Befehl erkannt, löst der Listener ihn sofort aus und bricht das Goal vorzeitig ab (`cancel_goal_async()`).* |
>> | *-* | *-* | *🛡️ **3-Stufen-Deduplikation:** **(1)** Feedback-Text, **(2)** Rest-Audio, **(3)** globaler Cooldown (Parameter `cooldown_sec`, Standard 3 s).* |
>> | *-* | *-* | *🔒 **Singleton-Lock:** `/tmp/voice_command_listener.lock` verhindert doppelte Instanzen.* |
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/ui/voice_listen_trigger`** | `std_msgs/String` | *Startet eine Aufnahme aus der Web-UI oder per Gamepad (X): `listen` = Sprachbefehl, `dictate` = Diktat für VLA-M (länger, führt keine Befehle aus).* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/ui/voice_feedback`** | `std_msgs/String` | *Erkannter Sprachbefehl (z. B. `Home`, `Stop`); die UX \| Control Interface führt ihn aus.* |
>> | **`/ui/voice_status`** | `std_msgs/String` | *Status für die UI: `Listening...`, `Transcription: <Text>`, `-- No speech detected --`, `Error: …`.* |
>> | **`/ui/voice_dictation`** | `std_msgs/String` | *Diktat-Text und -Status für das Eingabefeld der VLA-M-Section (Trigger `dictate`).* |
>> | **`/ui/emergency_stop_topic`** | `std_msgs/Empty` | *Sprachbefehl `E-Stop` löst den E-STOP direkt aus.* |
>
>
> ![Services](https://img.shields.io/badge/Services-FF1493?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/voice_cmd/last`** | `std_srvs/srv/Trigger` (Server) | *Stellt den zuletzt erkannten Sprachbefehl zur Verfügung.* |
>> | **`/ui/halt_motion`** | `std_srvs/srv/Trigger` (Client) | *Sprachbefehl `Stop` hält die laufende Bewegung an.* |
>
> Der `whisper_server` nutzt das multilinguale Modell `small` mit `language: "auto"` für englische und deutsche Befehle (siehe `whisper.yaml`; kein `initial_prompt`, der führt bei Stille zu Halluzinationen).

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) ![Python UI](https://img.shields.io/badge/Python_UI-8A2BE2?style=flat-square&logo=qt&logoColor=white) `gaze_ui_node_tobii_glasses.py` / `gaze_ui_node_tobii_glasses_zedm.py` (`gaze_control_ui_tobii_glasses`) &nbsp;&nbsp; <sub><i>`/src/gaze_control_ui_tobii_glasses/gaze_control_ui_tobii_glasses`</i></sub>

**Zweck & Aufgabe:** Eine übergeordnete Master-Control-UI (PyQt5). Setzt Eye-Tracking-Blickpunkte (über RTSP Gaze-Daten) in Button-Klicks um (z.B. bei 1 Sek. Fixationsdauer) und sendet Bewegungs- und Greiferbefehle über die Sicherheitskette: eigener Client von `remote_control_watchdog` (Art `gaze`). **GAZE ON** fragt die Steuerung an (Freigabe in der UX | Control Interface am Roboter-PC), **GAZE OFF** gibt sie ab; ohne Steuerung kein Fahren, kein HOME, kein Greifer. Es existieren zwei Varianten des Skripts für unterschiedliche Kamera-Setups:

<details>
<summary><b>🔽 Details anzeigen</b> · Run Command · Subscribes · Publishes · Services</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> # Legacy (Raspberry Pi Camera):
> ros2 run gaze_control_ui_tobii_glasses gaze_ui
> 
> # ZED Mini Camera:
> ros2 run gaze_control_ui_tobii_glasses gaze_ui_zedm
> ```
>
> - **`gaze_ui_node_tobii_glasses.py` (Raspberry Pi):** Die klassische Variante. Nutzt einen vollflächigen Chromium Web-Browser (`QWebEngineView`) im Hintergrund, um den HTTP-Livestream (MJPEG) der Raspberry Pi Kamera anzuzeigen.
> - **`gaze_ui_node_tobii_glasses_zedm.py` (ZED M):** Die moderne Variante für das 3D Vision Setup. Verzichtet auf den speicherintensiven Web-Browser für den Hauptstream. Stattdessen abonniert der Node direkt das ROS-Topic der ZED-Kamera (`/zed/zed_node/rgb/image_rect_color`), konvertiert die ROS Image-Messages (`bgra8`) thread-sicher in native `QImage`/`QPixmap` Objekte und rendert diese als ressourcenschonendes Hintergrund-Label (`bg_label`). Die Picture-in-Picture (PiP) Ansicht nutzt weiterhin einen kleinen Web-Browser für den Pi-Stream und blendet über eine JavaScript-Injection störende RPi-Cam-Control-UI-Elemente aus (DOM Manipulation).
> 
> **Gemeinsamer Kern `gaze_ui_core.py`** (beide Skripte liefern nur noch den Kamera-Hintergrund; `gaze_ui_zedm --legacy-cam` = Hintergrund aus IP-Kamera cam1; Bild-im-Bild cam2 rechts oben unter HOME/UP):
> - **RTSP & Datenverarbeitung:** Verbindet sich per RTSP (Real-Time Streaming Protocol) mit der Brille (`rtsp://192.168.75.xxx:8554/live/all`; `self.g3_ip` = `net_get('tobii.ip')` aus `config/network.yaml`: `tobii.connection: auto` nimmt die WLAN-IP `192.168.75.xxx` oder per Ethernet `192.168.100.xxx`, je nachdem, welches Netz am PC anliegt), um parallel zwei Datenströme zu empfangen. Der Video-Stream liefert das Kamerabild für die Marker-Erkennung, während der Daten-Stream (JSON) in Echtzeit die rohen `gaze2d`-Blickkoordinaten überträgt.
> - **Homographie-Mapping:** Erkennt 4 ArUco-Marker in den Bildschirmecken über die Szenenkamera der Brille. Nutzt `cv2.findHomography`, um den 3D-Blickvektor (`gaze2d`) aus dem RTSP-Stream passgenau auf den 2D-Bildschirm in echte Pixelkoordinaten zu projizieren.
> - **Subpixel-Genauigkeit:** Wendet `cv2.cornerSubPix` bei der Marker-Erkennung an, um Kamerazittern drastisch zu reduzieren und die Berechnung der Homographie-Matrix zu stabilisieren.
> - **Soft-Landing Bremszone (Z-Achse):** Implementiert eine dedizierte Sicherheitslogik für Abwärtsbewegungen. Ab `Z = 40.0 mm` greift eine quadratische Bremskurve, und bei `Z = 33.0 mm` wird ein harter Not-Stopp ("Hard Stop") ausgelöst, um Tischkollisionen sicher zu verhindern.
> - **Anordnung „Blickrichtung = Fahrrichtung“:** alle Knöpfe bündig am Bildschirmrand (220 × 120 px bei 1920 × 1080, skaliert mit dem Fenster). FORWARD/BACK oben/unten Mitte, LEFT/RIGHT links/rechts Mitte, UP rechts oben, DOWN rechts unten, ROTATE Rz+/Rz− links oben, HOME oben rechts, GRIPPER unten rechts, GAZE + SPEED + Status-Karte links unten. Bildmitte bleibt frei für die Szene.
> - **Treffer & Verweilen:** 40 px Toleranzrand um jeden Knopf (bei Überlappung zählt der nächstgelegene), Blickpunkt bis 40 px neben dem Fenster wird an den Rand geklemmt, weiter außerhalb = kein Knopf (Stopp); Alpha-Glättung 0,20. Verweilzeit 1,0 s mit gelbem Rahmen + Füllbalken, Auslösen mit Klick-Ton (`ui_mouse_click.mp3`, Pygame). Fahrt = grüner Knopf, Blick weg = Stopp.
> - **Blickverlust-Stopp:** kommen > 300 ms keine `gaze2d`-Daten (Lidschlag, Tracker-Aussetzer) oder ist die Marker-Homographie älter als 1 s, wird der Cursor ausgeblendet und eine laufende Fahrt gestoppt. Ohne Brille (nie Blickdaten erhalten) steuert die Maus (Test-Modus).
> - **Tempo-Stufen (SPEED):** 1 / 2 / 3 = 0,05 / 0,10 / 0,15 Servo-Skalierung, Rotation = 5 × Translation (Stufe 2 = 0,5 rad/s); Start mit Stufe 2; DOWN fährt höchstens mit Stufe 2.
> - **Status-Karte:** Steuerung (`yours`, `waiting for approval in UX | Control Interface`, `request denied`, `held by …`, `watchdog offline`), Tracking (Marker 4/4, Blick verloren, Maus-Modus), Z-Höhe aus `/ui/eef_position`, Tempo, Greifer. DOWN zeigt ab 40 mm die Höhe als Badge, ab 33 mm `STOP`, ohne Z-Pose jünger als 0,5 s `NO Z` (beides nicht auslösbar).
> - **Knöpfe:** GAZE (Blicksteuerung AN/AUS, Start AUS; bei AUS sind alle anderen Knöpfe gestrichelt und gesperrt), SPEED, HOME ⌂ (Initialpose), GRIPPER (ein Umschalt-Knopf, Vakuum AN/AUS); nach Schalt-Knöpfen 1 s Sperre.
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/ui/eef_position`** | `std_msgs/Float32MultiArray` | *Empfängt die aktuelle Endeffektor-Position für die Z-Achsen-Bremslogik.* |
>> | **`/remote/control_state`** | `std_msgs/String` (JSON) | *Control-Lock von `remote_control_watchdog`: Besitzer, offene Anfragen, Antworten.* |
>> | **`/zed/zed_node/rgb/image_rect_color`** | `sensor_msgs/Image` | *(Nur ZED M Variante) Empfängt den Kamera-Feed.* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/remote/twist`** | `std_msgs/String` (JSON) | *Kartesischer Jog an das Twist-Gate des Watchdogs (Control-Lock, Heartbeat, E-Stop, Bodensperre, `max_speed`); bleiben Befehle aus → Null-Twist.* |
>> | **`/remote/heartbeat`** | `std_msgs/String` (JSON) | *Heartbeat alle 250 ms, Art `gaze`.* |
>> | **`/remote/control_request`** | `std_msgs/String` (JSON) | *`request` bei GAZE ON, `release`/`cancel` bei GAZE OFF und beim Schließen.* |
>
>
> ![Services](https://img.shields.io/badge/Services-FF1493?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/ufactory/set_vacuum_gripper`** | `xarm_msgs/srv/VacuumGripperCtrl` (Client) | *Schaltet den Lite 6 Vakuumgreifer per Blickbefehl (nur mit Steuerung).* |
>> | **`/ui/execute_initial_pose`** | `std_srvs/srv/Trigger` (Client) | *Fährt den Roboter in die Home-Pose (nur mit Steuerung).* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `gaze_grasp_routine_tobii_glasses.py` (`gaze_grasp_routine_tobii_glasses`) &nbsp;&nbsp; <sub><i>`/src/gaze_grasp_routine_tobii_glasses/gaze_grasp_routine_tobii_glasses/gaze_grasp_routine_tobii_glasses.py`</i></sub>

**Zweck & Aufgabe:** Ermöglicht "telepathische", freihändige Objektauswahl und Greifvorgänge via Tobii Glasses 3.

<details>
<summary><b>🔽 Details anzeigen</b> · Run Command · Subscribes · Publishes · Services · Parameters</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> # Teil von RUN DEV SETUP (FAKE und REAL) in der UX | Nexus Launcher:
> # Karte "Eyetracker - Gaze Control", Modus Real World (Modus UI Gaze startet stattdessen gaze_ui)
> ros2 run gaze_grasp_routine_tobii_glasses gaze_grasp_routine_tobii_glasses --ros-args -p tobii_ip:=192.168.100.xxx -p dwell_threshold:=2.0
> ```
>
> - **Dwell-Time Auswahl:** Verbindet sich mit dem Tobii RTSP-Stream. Ein Hintergrundprozess führt YOLOv8 auf dem Live-Stream aus. Fixiert der Nutzer mit dem Gaze-Punkt ein erkanntes Objekt für **2,0 Sekunden** (Dwell-Time, Parameter `dwell_threshold`), loggt sich das System auf dieses Ziel ein und startet den Greifablauf.
> - **Präzise Lokalisierung per Homographie:** Nach der Auswahl fährt der Arm in eine zentrale "Show Scene"-Pose. Die Endeffektor-Kamera sucht nach 12 bekannten ArUco-Markern auf dem Tisch, um eine hochpräzise `cv2.findHomography`-Matrix zu berechnen. Anschließend findet sie das ausgewählte Objekt erneut per YOLO und rechnet dessen Pixel-Koordinaten perfekt in den 3D-Referenzrahmen des Roboters um (`cv2.perspectiveTransform`). Der Arm schwebt danach exakt über dem Objekt.
> - **Robustes ArUco-Tracking:** Erkennt die Marker zweimal – im normalen und im horizontal gespiegelten Bild –, sodass auch eine versehentlich gespiegelt gedruckte Kalibriertafel funktioniert. Die Erkennung läuft bewusst auf dem rohen Graubild (CLAHE verstärkte das Rauschen in den Markern).
> - **Sicherheits-Verzögerung:** Wartet nach der Berechnung der Zielkoordinaten 3 Sekunden, bevor der Arm fährt (Timer im Hover-Zustand). So kann der Bediener den berechneten Greifpunkt in der EEF-Kamera prüfen.
> - **Visuelles Feedback:** Zwei Live-OpenCV-Fenster: der Tobii-Stream (YOLO-Boxen, Gaze-Punkt, Ladebalken der Fixation) und die „EEF Debug View“ mit der Endeffektor-Kamera.
>
> > [!CAUTION]
> > **Kritisches Hardware-Setup: ArUco Marker Grid**
> > Damit die Homographie-Transformation funktioniert und gefährliche Kollisionen vermieden werden, müssen exakt 12 ArUco-Marker (Größe: 3x3 cm, Dictionary: DICT_4X4_50) dauerhaft flach auf dem Tisch (Z=0) befestigt werden. Die Mitte jedes Markers muss exakt an diesen Koordinaten im Base-Frame des Roboters liegen:
> > - **ID 0:** X=150mm, Y=150mm  |  **ID 1:** X=150mm, Y=0mm
> > - **ID 2:** X=150mm, Y=-150mm |  **ID 3:** X=150mm, Y=-250mm
> > - **ID 4:** X=250mm, Y=200mm  |  **ID 5:** X=400mm, Y=200mm
> > - **ID 6:** X=425mm, Y=100mm  |  **ID 7:** X=425mm, Y=0mm
> > - **ID 8:** X=425mm, Y=-100mm |  **ID 9:** X=425mm, Y=-200mm
> > - **ID 10:** X=350mm, Y=-200mm|  **ID 11:** X=250mm, Y=-200mm
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/ui/sound_enabled`** | `std_msgs/Bool` | *Schaltet die akustische Rückmeldung gemeinsam mit dem Sound-Toggle der Web-UI stumm.* |
>> | **`/remote/control_state`** | `std_msgs/String` (latched) | *Control-Lock des Watchdogs (wer die Steuerung hat).* |
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/remote/heartbeat`** · **`/remote/control_request`** | `std_msgs/String` | *Watchdog-Client `Gaze Grasp (Tobii)`: Heartbeat und Steuerungsanfrage.* |
>
>
> ![Services](https://img.shields.io/badge/Services-FF1493?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/ui/execute_move_to_pose`** | `xarm_msgs/srv/MoveCartesian` (Client) | *Fährt Scan-Posen an und schwebt über den erkannten Zielen. Jede Fahrt nur mit Steuerung: eigener Watchdog-Client `Gaze Grasp (Tobii)`; ein Dwell ohne Steuerung schickt eine Anfrage (Freigabe in der UX \| Control Interface), das Fenster zeigt `NO CONTROL: …`. Eine laufende Fahrt bricht bei Verlust der Steuerung nicht ab (E-Stop stoppt sie).* |
>
> ![Parameters](https://img.shields.io/badge/Parameters-yellow?style=flat-square)
>
>> | Parameter | Standardwert | Beschreibung |
>> |---|---|---|
>> | `tobii_ip` | `net_get('tobii.ip')` | *IP der Tobii Glasses 3 aus `config/network.yaml` (`tobii.connection: auto`): `192.168.100.xxx` per Ethernet (LAN), `192.168.75.xxx` per WLAN; Rückfall `192.168.100.xxx`.* |
>> | `dwell_threshold` | `2.0` | *Fixationsdauer [s] auf einem Objekt bis zur Auswahl.* |
>
> *Die Blickpunktdaten kommen nicht über ein ROS-Topic, sondern direkt aus dem RTSP-Stream der Tobii Glasses 3 (`rtsp://<tobii-ip>:8554/live/all`, JSON-Feld `gaze2d`). Die Objekterkennung läuft node-intern über YOLOv8 auf demselben Stream.*

</details>

---

[⬅ Zurück: 3D-Vision & autonomes Greifen](vision_grasping.html) · [🏠 Übersicht](../readme-de.html) · [⬆ Nach oben](#top) · [Weiter: VR-Teleoperation (Meta Quest 3) ➡](vr_quest3.html)
