<a name="top"></a>

# 🥽 VR-Teleoperation (Meta Quest 3)

[🏠 Übersicht](../readme-de.html) · [🇬🇧 English](../en/vr_quest3.html) · Kapitel 3.5

---

## 3.5 Funktion: VR Quest 3 Teleoperation
*Immersive 6DoF kartesische Teleoperation über Meta Quest 3 VR Controller und WebXR.*

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `vr_quest3_teleop_node.py` (`vr_quest3_teleop`) &nbsp;&nbsp; <sub><i>`/src/vr_quest3_teleop/vr_quest3_teleop/vr_quest3_teleop_node.py`</i></sub>

**Zweck & Aufgabe:** Bietet eine immersive kartesische 6DoF-Teleoperation mithilfe der Meta Quest 3 VR-Brille. Übersetzt die räumlichen Bewegungen des VR-Controllers über WebXR in weiche `TwistStamped` Geschwindigkeitsbefehle für MoveIt Servo.

<details>
<summary><b>🔽 Details anzeigen</b> · Run Command · Subscribes · Publishes · Services</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 launch vr_quest3_teleop vr_quest3_teleop.launch.py
> ```
>
> - Nutzt ein webbasiertes lokales UI, das per **HTTPS** auf Port `8443` bereitgestellt wird (aus `https_vr_webxr_p8443/` im Paket `vr_quest3_teleop`).
> - Das Launch-File **startet automatisch eine gesicherte ROSbridge-Instanz (WSS)** auf Port `9091` unter Verwendung von SSL-Zertifikaten (`~/dev_ws/certs/cert.pem`). Dies ist zwingend erforderlich, da WebXR (für 6DoF-Tracking) strikt einen Secure Context (HTTPS/WSS) vorschreibt.
> - Die WSS-Bridge läuft als eigener Node `rosbridge_websocket_ssl_9091` mit Service-Threads und 10 s Timeout (wie die Bridge auf 9090). Sie startet **keinen eigenen** `/rosapi`: Zwei `/rosapi`-Nodes (Robot Control UI + VR) ließen `/rosapi/nodes` hängen, und das blockierte die ganze Bridge (keine Gelenkwinkel im Twin, Buttons ohne Wirkung). `rosapi_guard` startet nur dann einen, wenn keiner läuft, und beendet ihn wieder, sobald ein zweiter auftaucht.
> - `vr_quest3_teleop_node` ruft bei jedem neuen Griff `start_servo` auf (Servo kann inzwischen durch eine MoveIt-Bahn, einen Scan oder den Not-Aus gestoppt worden sein) und ignoriert Grip, Trigger und Linearachse, solange `/ui/emergency_stop_active` verriegelt ist.
> - Über HTTPS zeigt das ROS-Offline-Fenster der UI einen Link **„Zertifikat für Port 9091 freigeben“** – jedes neu erzeugte Zertifikat muss die Quest für 8443 **und** 9091 einmal akzeptieren. Wechselt die IP des PCs (z. B. anderes Netz), ergänzt der Launch die neue IP im Zertifikat; bekannte IPs bleiben drin, also muss die Quest jede Adresse nur einmal freigeben. `localhost` ist immer enthalten (USB mit `adb reverse`).
> - Enthält eine integrierte WebGL-Rendering-Engine (`XRWebGLLayer`), um den nativen "Ladebildschirm" (die fliegenden Sterne) der Quest 3 zu beenden und die Controller-Datenströme freizuschalten.
> - **Grip Trigger (Mittelfinger):** Wirkt als "Kupplung". Solange er gedrückt ist, wird das exakte räumliche Delta des Controllers direkt auf den Endeffektor des Roboters übertragen (es wird automatisch der Controller getrackt, dessen Taste gedrückt wird).
> - **Index Trigger (Zeigefinger):** Schaltet den Greifer. Der Node bedient beide Endeffektoren gleichzeitig — den Vakuumgreifer über `/ufactory/set_vacuum_gripper` und den Lite 6 Greifer über `open`/`close_lite6_gripper` — damit derselbe Trigger unabhängig vom montierten Greifer funktioniert.
> - **Watchdog:** Bleiben die Controller-Daten bei gedrücktem Grip länger als 0,3 s aus (Tracking weg, Browser hängt, WLAN weg), sendet der Node sofort einen Null-Twist.
>
> 🥽 **VR-Viewport (Robot Control UI in der Brille):** Der Server auf `8443` liefert zusätzlich die komplette **Robot Control UI** über HTTPS aus (`https://<PC-IP>:8443/`). Die UI verbindet sich dort automatisch mit der WSS-rosbridge auf `9091`. Einstiege: der VR-Button 🥽 **Enter VR** in der Viewport-Leiste mit seinem Menü ⌄ (👓 **Passthrough AR**, vorbereitet · 🖥️ **VR mirror window**) und dieselben drei Buttons im Bereich **Remote Teleop › VR headset** (Gruppen *Headset* und *On this PC*).
>
> <img src="../img/rcu_vr.png" width="340" alt="Bereich Remote Teleop, Tab VR headset: Enter VR, Passthrough AR (vorbereitet), VR mirror window">
>
> *Bereich Remote Teleop › VR headset am Desktop: Enter VR und Passthrough AR bleiben ausgegraut, bis ein WebXR-Browser (Quest 3) die Seite öffnet; VR mirror window funktioniert am PC.*
>
> Die Brille zeigt denselben Digital Twin (`js/twin/xr.js`) mit Live-Roboter, Objekten, Kollisionsobjekten, Ghost und MoveIt-Plan. Im Quest-Browser startet die Seite vergrößert – bei 100 % Browser-Zoom sieht sie so aus wie sonst bei 150 % (CSS-Zoom, Erkennung über den User-Agent; `?uizoom=1` schaltet aus, `?uizoom=auto` wieder an).
> - **HUD (`js/twin/xr_hud.js`) – Cockpit wie am Desktop:** Oben die **Sicherheitsleiste** in der Reihenfolge des Desktop-Headers: `TELEOP LIVE | PLAN` · **Mode** FAKE/REAL (REAL gelb gefüllt, die ganze Leiste gelb gerahmt) · Roboterzustand (IDLE / MOVING / E-STOP / OFFLINE) · Tempo `−` `60 %` `+` (gehalten läuft es weiter) · **Control** (Klick = dieselbe Aktion wie der Header-Chip: übernehmen/anfragen, abbrechen, abgeben; fremde Steuerung am Server-PC nur nach **1 s Halten**) · **E-STOP**. Darunter zeigt die **NOW-Zeile**, was Grip, Trigger und B im aktuellen Modus tun; die gehaltene Taste leuchtet grün. Unter der Leiste erscheint nur bei Bedarf eine **Meldungszeile** (Ursache → Folge → Lösung): keine ROS-Verbindung, E-STOP mit *Reset*, Kollisionswarnung, Viewer ohne Steuerung (mit *Request control* / *Hold: take over*), Warnungen (6 s) und Fehler (bis *OK*). **Linke Spalte:** MOTION (Posen, Greifer) und SEQUENCES (Auswahl, letzte drei Schritte, *Waypoint*, Öffnen/Schließen/Warten/Home, Rückgängig, *PLAY*; beim Abspielen nur *Stop sequence*). **Rechte Spalte = Kontext:** oben nur, wenn etwas zu entscheiden ist, die Bestätigungskarte – MoveIt-Bahn (Ziel, Δ, IK · PLAN · EXECUTE, Countdown, *Discard* / *Execute*), *Play sequence?* (bricht nach 10 s selbst ab) oder das gewählte Objekt; darunter TELEMETRY (Reichweite, TCP, Boden, Gelenke mit Grenzwarnung), POSE und, falls eingeschaltet, das Kamerafenster. Solange eine Karte auf eine Entscheidung wartet, klappen TELEMETRY und POSE auf ihre Kopfzeile zu. Nichts verdeckt Roboter und Tisch in der Mitte. **POSE** ist eingebbar: Achse wählen (X Y Z in mm, R P Yw in °, der Button zeigt den Wert), mit − / + ändern (gehalten wiederholt, nach ~1 s in 10er-Schritten), *Move* fährt die Pose an wie *Go* am Desktop (dieselben Felder `#inp-*`). Farben wie am Desktop: neutral = normal, blau = Aktion/aktiv, grün = läuft, gelb = Warnung/REAL, rot = nur Stopp/Fehler; die Funktionsgruppe steht als dünne Linie am Kartenkopf. Eingeklappte Tabs sind wie am Desktop eingeklappt; ein Klick auf die Kopfzeile klappt beide um. Leiste und beide Spalten lassen sich verschieben: Trigger rechts auf einer Kopfzeile oder freien Stelle halten und ziehen – würde sie eine andere Fläche berühren, rückt sie beim Loslassen auf den nächsten freien Platz. Die Anordnung bleibt gespeichert, *Default layout* im Tab VIEW stellt sie wieder her. Das HUD bleibt stehen, solange man nur zu einer Spalte schaut, und zieht weich nach, wenn man sich weiter dreht; die Flächen bleiben waagerecht. **Y** (links) blendet die Karten aus – die Sicherheitsleiste bleibt immer; **A** (rechts) holt das HUD vor den Blick. Hält man das Handgelenk-Panel hoch, werden die HUD-Flächen dahinter blass (nie die Sicherheitsleiste).
> - **VR ⇄ Passthrough in der laufenden Session:** Kann die Brille `immersive-ar`, läuft jede Session als AR. Die VR-Ansicht deckt die Kamera dann mit einem blickdichten Hintergrund vollständig ab. Beim Umschalten werden Servo und Ghost-Drag zuerst gestoppt, weil das Rig springt (VR und Passthrough haben je einen eigenen Standort).
> - **Farbgruppen (`GROUP` in `js/twin/xr_ui.js`):** Zusammengehörige Funktionen behalten eine Farbe als dünne Linie am Tab im Handgelenk-Panel und am Kopf der HUD-Karte sowie an den Badges der Tastenhilfe: **Blau** Roboter (TELEOP LIVE, Posen, Tempo, Linearachse), **Violett** Planen (PLAN, Ghost, TCP-Gizmo, Abfolgen), **Amber** Greifen (Greifer, Objekte), **Türkis** Szene (Einblendungen, MoveIt-Kollision, Sound), **Pink** VR (Ansicht, Standort, HUD, Kamera). Flächen und Buttons bleiben neutral wie am Desktop.
> - **Handgelenk-Panel (linker Controller, standardmäßig aus):** Kopf mit *Robot Control*, FAKE/REAL und Roboterzustand; sechs Tabs `MOTION · PLAN · OBJECTS · SCENE · VIEW · HELP` (aktiv blau, Gruppenfarbe als dünne Linie), jeder Tab in beschriftete Sektionen gegliedert; der **E-STOP** sitzt in jedem Tab unten an derselben Stelle (verriegelt mit *Reset* daneben). Schalter zeigen ihren Zustand als Schiebeschalter, MoveIt-Kollision und unbekannte Nodes als ON / OFF / INACTIVE; ein ausgeschalteter Eintrag bleibt klickbar, gesperrt ist nur, was auch am Desktop gesperrt ist. Die Einträge spiegeln die echten Buttons (Zustand und Klick). Bedient wird es mit dem Laser des rechten Controllers und dem Trigger; **X** blendet das Panel ein und aus.
>   - `MOTION`: Steuermodus TELEOP LIVE/PLAN, Posen (Home, Align TCP, Scan-Position, OctoMap), Greifer (öffnen, schließen, aus), Zielpose (wie POSE im HUD).
>   - `PLAN`: MoveIt-Phase/Ziel/Schritte, Ausführen/Verwerfen (nur wenn am Desktop sichtbar), TCP-Gizmo, Pfad-Vorschau (Ghost), Auto-Move, Gizmo-Modus, Gizmo auf TCP zurücksetzen, letzte Meldungen.
>   - `OBJECTS`: gewähltes Objekt, Approach from above, Grasp / Place here, Kollision an/aus, Liste der erkannten Objekte.
>   - `SCENE`: Einblendungen (Szenen-Objekte, Safety-Zone, ZED-Stativ, Tisch, YOLO, virtuelle Objekte, Distanzlinie, Bodenraster, CAD-Kanten), MoveIt-Kollision (Objekte/Boden), Sound, Viewport-Panels, Warnungen testen.
>   - `VIEW`: `VIEW` (VR / Passthrough / Nozzle-Kamera), `ALIGN ROBOT` (X/Y/Z/Yaw-Stepper, Basis = Controller, Reset, Speichern) und unten fest `HUD & SESSION` (HUD-Karten, Kamerafenster, Tastenhilfe, Standard-Anordnung, Blick zentrieren, *Hold 1 s: exit VR*).
> - **Tastenhilfe (`js/twin/xr_controls.js`):** Schaut man auf einen Controller, erscheint daneben (außen, zum Kopf gedreht) eine Karte mit seiner aktuellen Belegung: Badges wie auf dem Controller (**X/Y/A/B** rund, **TRIGGER/GRIP/STICK** als Pille, Not-Aus rot) plus Aktion und kurzer Erklärung. Die Zeilen folgen dem Zustand (SERVO/PLAN, VR/Passthrough/Kamera Nozzle, Laser auf UI oder Greifkugel, Not-Aus verriegelt): Was gerade nicht geht, ist abgeblendet und nennt den Grund, Badge und Akzentleiste jeder Taste tragen die Farbe ihrer Funktionsgruppe (Legende im Tab `HELP`), gedrückte Tasten leuchten in dieser Farbe; der Kartenrahmen behält die Farbe des Controllers. Die Karte bleibt, solange man sie liest, blendet beim Wegschauen aus, verdeckt nie den Laserpunkt, und die linke entfällt, solange das Handgelenk-Panel offen ist. Der Tab `HELP` im Handgelenk-Panel zeigt beide Controller nebeneinander, beide Modi (Karte klicken = Modus wählen) und den An/Aus-Schalter (auch im Tab VIEW, pro Brille gespeichert).
> - **Kamera Nozzle (`js/twin/xr_nozzle_cam.js`):** Button im Tab VIEW. Die Sicht sitzt in der Kamera am Endeffektor (am Flansch `link_eef`, 7,5 cm hinter der Düsenachse, schräg in +X geneigt) und folgt dem Roboter, solange der Button aktiv ist: oben im Bild die Düse, darunter der Bereich unter dem Greifer. Die Neigung (Standard 30° zur Düsenachse) lässt sich in der Brille einstellen und wird gespeichert; **A** bzw. „Zentrieren“ richtet die Kamerasicht auf die aktuelle Blickrichtung aus. Gehen und Fliegen sind in dieser Ansicht aus; Servo und Ghost-Drag rechnen im Rig vom Beginn des Griffs, damit die mitfahrende Sicht den Roboter nicht weiterzieht. VR oder Passthrough wählen beendet die Ansicht.
> - **Modi (Taste B rechts):** `SERVO` – Grip steuert MoveIt Servo, Trigger schaltet den Greifer, rechter Stick X **bei gedrücktem Grip** bewegt die Linearachse. `PLAN` – der rechte Laser bedient das TCP-Gizmo wie die Maus am Desktop: auf Pfeil, Ebene oder Ring zielen (leuchtet auf), Trigger halten und ziehen; Loslassen löst denselben Ablauf aus wie am Desktop (Auto-Move, planen + *Execute*, Ghost). Zusätzlich zieht der Grip den Ghost frei (1:1 zur Hand, im Rotationsmodus auch die Orientierung). Ausführen und Verwerfen auf der Bestätigungskarte oben in der rechten HUD-Spalte oder im Tab PLAN. Jeder Wechsel wird angesagt („Servo“ / „Planning Path“) – in der Brille und in jeder offenen Desktop-UI (Topic `/ui/vr_ctrl_mode`).
> - **Objekt wählen:** Laser auf die rote Greifkugel und Trigger drücken. Das Objekt wird zum Target Object, die Kugel rastet mit derselben Animation wie am Desktop ein (Zielkreuz, Ringe), und oben in der rechten HUD-Spalte erscheint die **Objektkarte** (`js/twin/xr_objcard.js`), eine blaue Linie führt vom Objekt zu ihr; sie hat denselben Einträgen wie das Objektmenü im Viewport (`objectMenuSpec` in `js/grasp.js`): *Approach from above* (die Bahn wartet danach an derselben Stelle auf Bestätigung), *Grasp* bzw. *Put back* / *Place … here* (VLA-M Bridge), *Collision ON/OFF* und *Close*. Mit REAL fragt *Grasp*/*Place* wie am Desktop per zweitem Klick nach. Der Tab OBJECTS im Handgelenk-Panel bietet dieselben Aktionen.
> - **Not-Aus:** roter Button im Panel **oder** beide Grips und beide Trigger gleichzeitig. Das Ende der Session, eine verdeckte Session (Quest-Menü) oder Tracking-Verlust stoppen Servo sofort.
> - **Standort:** linker Stick = gehen (nur VR). Rechter Stick **ohne Grip** = um den Roboter fliegen (nur VR): X kreist um die Roboterbasis, der Blick dreht mit, Y hebt und senkt. Im Tab VIEW lassen sich Robot X/Y/Z/Yaw verschieben, „Basis = Controller“ setzt die Roboterbasis auf den rechten Controller, und alles wird pro Brille gespeichert (`localStorage`). Die Passthrough-Kalibrierung auf den echten Roboter ist vorbereitet, aber noch nicht am echten Roboter getestet.
> - Nicht in der Brille: Kamera- und RViz-Streams (MJPEG über HTTP werden auf einer HTTPS-Seite als Mixed Content blockiert).
> - **VR-Spiegel am PC (`vr_mirror.html`, `js/vr_mirror.js`):** Der VR-Mirror-Button (`fa-display`) in der Viewport-Werkzeugleiste der Robot Control UI öffnet ein Fenster, das zeigt, was die Quest 3 gerade sieht. Die Brille schickt nur Kopf-Pose, Controller, UI-Flächen und Twin-Zustand (`js/twin/xr_mirror_send.js`, Topics `/vr_teleop/mirror_pose`, `/vr_teleop/mirror_state`, `/vr_teleop/mirror_ui`); der PC rendert denselben Digital Twin aus dieser Position selbst. Erkennungen, Punktwolke und Pfad-Vorschau kommen direkt aus ROS. Das Fenster ist passiv: Es bewegt nichts und publiziert nur Heartbeat bzw. Nachsende-Bitte auf `/vr_teleop/mirror_request`; die Brille sendet nur, solange ein Spiegelfenster offen ist. Mausrad = Zoom, Doppelklick oder `0` = Zoom zurücksetzen, `F` = Vollbild.
>
> 🛠️ **System Setup & Nutzung:**
> 1. **Netzwerk & Firewall:** PC und Quest 3 müssen sich im selben WLAN/Netzwerk befinden. Wenn dein Ubuntu eine Firewall (UFW) nutzt, musst du zwingend die Ports für die Brille öffnen, da das Web-Interface und die WebSocket-Verbindung sonst blockiert werden:
>    ```bash
>    sudo ufw allow 8443/tcp
>    sudo ufw allow 9091/tcp
>    ```
>    *(Alternativ kann die Brille auch per USB-C verbunden werden; die ADB Port-Weiterleitung umgeht die Firewall automatisch).*
> 2. **Zertifikate generieren:** Stelle sicher, dass `cert.pem` und `key.pem` im Ordner `~/dev_ws/certs/` liegen, sonst scheitert der Start der gesicherten rosbridge.
> 3. **Node Starten:** Über den Button **"VR Quest 3 Teleop"** in der Nexus Web-App oder den obigen Launch-Befehl.
> 4. **SSL-Zertifikate in der Brille akzeptieren (Kritisch!):** Da selbstsignierte Zertifikate genutzt werden, blockiert der Meta Quest Browser die Verbindung standardmäßig. Du musst **zwei Adressen** nacheinander im Browser der Brille öffnen und freigeben:
>    - Gehe zu `https://<PC-IP>:9091` -> Klicke auf "Erweitert" -> "Weiter zur Webseite (unsicher)". (Du siehst danach eine leere Seite oder Fehlermeldung, das ist normal! Das Zertifikat ist nun für WebSockets akzeptiert).
>    - Gehe zu `https://<PC-IP>:8443/controller_reader.html` -> Klicke auf "Erweitert" -> "Weiter zur Webseite (unsicher)".
> 5. **VR Verbinden:** Warten bis auf der Webseite **"ROS Connected! ✅"** (Port 9091) erscheint, dann **"Enter VR"** klicken.
> 6. **Steuerung:** In der dunklen VR-Umgebung den Grip-Trigger gedrückt halten und die Hand bewegen — der Roboter folgt latenzfrei in Echtzeit.
>
> ⚠️ **Troubleshooting:**
> - **Nur fliegende Sterne in VR?** → Du befindest dich im falschen Raum oder hast die VR-Session zu früh gestartet. Lade die Seite neu (`https://<PC-IP>:8443/controller_reader.html`).
> - **Webseite meldet "ROS Connection Closed"?** → Du hast Schritt 4 vergessen. Du musst das Zertifikat für den WebSocket-Port `9091` manuell im Browser akzeptieren!
> - **"Input Sources: 0" / Keine Bewegung?** → Controller schlafen. Beliebige Taste drücken, um sie aufzuwecken.
> - **ADB Error im Terminal?** → Wenn du WLAN nutzt, kannst du den `adb reverse` Fehler im Terminal ignorieren. Er tritt nur auf, wenn kein USB-Kabel steckt.
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/vr_teleop/controller_data`** | `std_msgs/String` | *Empfängt 6-DoF-Controller-Posen, Buttons und Joystick-Zustände als JSON aus der WebXR-Oberfläche.* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/remote/twist`** | `std_msgs/String` (JSON) | *Kartesische Geschwindigkeit mit der Client-id der Brille (`client` in `controller_data`) → Twist-Gate des `remote_control_watchdog` → MoveIt Servo; Greifer und Linearachse nur, solange die Brille die Steuerung hat (`/remote/control_state`).* |
>> | **`/linear_axis_cmd`** | `std_msgs/Float64` | *Verfährt die Linearachse über die Daumensticks der VR-Controller.* |
>
>
> ![Services](https://img.shields.io/badge/Services-FF1493?style=flat-square)
>
>> | Topic / Interface | Msg Type | Beschreibung |
>> |---|---|---|
>> | **`/servo_server/start_servo`** | `std_srvs/srv/Trigger` (Client) | *Stellt sicher, dass MoveIt Servo vor der ersten Bewegung aktiv ist.* |
>> | **`/ufactory/set_vacuum_gripper`** | `xarm_msgs/srv/VacuumGripperCtrl` (Client) | *Schaltet den Vakuumgreifer über den Zeigefinger-Trigger.* |
>> | **`/ufactory/open_lite6_gripper`** | `xarm_msgs/srv/Call` (Client) | *Öffnet zusätzlich den Lite 6 Greifer, falls dieser montiert ist.* |
>> | **`/ufactory/close_lite6_gripper`** | `xarm_msgs/srv/Call` (Client) | *Schließt zusätzlich den Lite 6 Greifer, falls dieser montiert ist.* |

</details>

---

[⬅ Zurück: Sprach- & Blicksteuerung](voice_gaze.html) · [🏠 Übersicht](../readme-de.html) · [⬆ Nach oben](#top) · [Weiter: Robot Control UI & Motion-Backend ➡](robot_control_ui.html)
