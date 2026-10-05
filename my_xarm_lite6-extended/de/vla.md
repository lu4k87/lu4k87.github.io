<a name="top"></a>

# 🤖 VLA-M: Vision-Language-Action-Chat

[🏠 Übersicht](../readme-de.html) · [🇬🇧 English](../en/vla.html) · Kapitel 4.3

---

## 4.3 VLA-M: Vision-Language-Action-Chat (In Arbeit)
KI-gestützte Ausführung von Aufgaben durch *Vision-Language-Action*-Modelle (VLA): Der Bediener tippt (später: spricht) eine Anweisung wie *„Nimm den roten Becher und leg ihn in die blaue Kiste“*. Ein LLM-Agent macht aus Szene, Roboterzustand und Anweisung einen Plan aus Roboter-Skills, führt ihn aus, nachdem der Bediener bestätigt hat (Human-in-the-Loop), und plant neu, wenn ein Schritt fehlschlägt; ein trainiertes VLA-Modell ist als zusätzlicher Skill geplant.

**Auf einen Blick:**

| | |
|---|---|
| **Wirkungsbereich (Skills)** | `pick` (Greifer auf → *Approach from above* mit Yaw-Suche → greifen → anheben → Greifprüfung) · `place` (auf / in / neben ein Objekt, an einen x/y-Punkt auf dem Tisch, `back` = zurück an den Ursprungsort) · `home` (Ausgangspose) · `gripper` (Greifer / Sauger auf oder zu, ohne Bewegung) · `palletize` (Auto-Palettieren, nur in der Szene *Logistics - auto palletizing*) |
| **Nicht abgedeckt** | Jogging, Servo / Gamepad, VR-Teleoperation; Drehen, Gießen, Schieben beantwortet der Agent mit dem, was er kann |
| **Einstiegswege** | Chat in der Section **VLA-M** (`/vla/instruction`, mit LLM) · Ein-Klick *Grasp* / *Place here* im Objektmenü bzw. in VR (`/vla/skill`, **ohne LLM**, gleiche Planprüfung) · Aufgaben-Fenster *Palletizing* (*Plan* / *Start*, `/vla/skill` `palletize`; im Chat startet „belade die Palette“ denselben Ablauf) |
| **Ablauf** | Plan → Planprüfung auf einer simulierten Szene → Selbstkorrektur (≤ 2 Runden) → Plan in der UI → *Execute* → Schritt für Schritt (`skills.py`); Fehler (`unreachable` / `collision` / `slipped`) → Rettungsplan oder Begründung |
| **Sicherheit** | Modell wählt nur Skill + Objekt, Posen rechnet der Code · jede Fahrt über den Motion Handler · REAL ohne `allow_real_motion` nur Plan, jeder Plan wartet auf *Execute*, keine virtuellen Objekte · *Abort* stoppt nach dem laufenden Schritt, beim Palettieren sofort (`/ui/halt_motion`, Not-Aus nicht verriegelt) · `dry_run:=true` bewegt nie |

**Stand (September 2026):**
- **UI:** Section **VLA-M** in der Robot Control UI (Port 8081, siehe [3.6](robot_control_ui.html#36-funktion-gui---grafische-robotersteuerung--visuelles-feedback)) und ihr großes Popup-Fenster: Chat, Liste *Planned actions* mit **Execute** / **Abort** und Schrittfortschritt, Mikrofon-Knopf (vorbereitet), Kamerawahl und **Confirm before execute**; **Model: Local | Claude | Gemini** schaltet das Sprachmodell zur Laufzeit um (`/vla/llm`, Modelle aus `llm_local_model` / `llm_cloud_model` / `llm_google_model`; Claude braucht `python3 -m pip install --user anthropic` und einen Schlüssel von platform.claude.com in `ANTHROPIC_API_KEY` oder `~/.config/vla_bridge/anthropic_api_key`, Gemini Robotics-ER einen Schlüssel aus Google AI Studio in `GEMINI_API_KEY` oder `~/.config/vla_bridge/gemini_api_key`; die Schlüsseldatei greift auch beim Start aus der Nexus Webapp), der Chip im Kopf zeigt lokal oder Cloud und das Modell; noch nicht eingerichtete Modelle tragen ein Warndreieck (Tooltip und Klick zeigen Ursache + Lösung); Chips für Modell, Modus (FAKE / REAL) und Szene (z. B. `8 objects · 8 virtual`); Backend-Karte mit Agent-Zustand (`ollama · ready`) und gehaltenem Objekt. *Clear* setzt auch das Gespräch des Agenten zurück.
- **Backend:** ROS-2-Paket `vla_bridge` – ein **LLM-Agent**. Ein Sprachmodell (lokal über Ollama, `qwen2.5:14b` auf der RTX A5000, offline; optional Claude über die Anthropic API) bekommt Anweisung, Szene (Objekte in `link_base`-mm), gehaltenes Objekt, Greifer und Modus und antwortet mit strukturiertem JSON: einer **Antwort**, einer **Rückfrage** oder einem **Plan** aus Skills (`pick`, `place` auf / in / neben / an eine Stelle / zurück, `home`, `gripper`).
  - Der Code **prüft jeden Plan**, bevor sich etwas bewegt (Objekte vorhanden, Greifer frei / belegt, Reichweite, freier Platz neben einem Ziel, Platz für den Greiferkörper neben hohen Objekten), und gibt Fehler an das Modell zurück, das den Plan korrigiert.
  - **Ausführung** wie *Approach from above* der UI: `/ui/approach_from_above` (kollisionsfrei auf eine Vorposition 70 mm über der Greifkugel, dann gerade nach unten, Kollision des Ziels freigegeben), Greifpose mit dem Saugnapf 2 mm über der Kugel (`cup_gap_mm`; mit dem Finger-Greifer-URDF fährt der TCP um die Differenz der Werkzeuglänge tiefer, `/ui/tcp_length_mm`); bei runden oder schräg liegenden Objekten wird der Greifer gedreht, bis eine kollisionsfreie Greifpose gefunden ist (Yaw-Suche). Ein Schritt ist erst fertig, wenn `/ui/moveit_motion_state` `succeeded` meldet.
  - **Greifprüfung** nach dem Anheben (Physik-Sandbox: `held` / `held_id` in `/ui/physics_sandbox_state` nach dem Anheben muss genau dieses Objekt sein; echte Objekte: die Greifkugel muss mit hochkommen). Umgekippte Objekte (Greiffläche > `max_grip_tilt_deg`, 20°) greift der Agent nicht; nach dem Greifen hebt er das Objekt über den höchsten Nachbarn (`transit_clearance_mm`). Schlägt ein Schritt fehl, sieht der Agent Fehler und neue Szene und schlägt einen **Rettungsplan** vor (z. B. neu greifen, Objekt zurücklegen) oder erklärt, warum er aufgibt (`max_recoveries`: 2).
  - **Gemessen statt geschätzt:** `python3 tools/vla_eval.py` spielt 46 feste Anweisungen (einfach, Beziehungen, mehrere Schritte, Rückfrage, Antwort, Folgebefehl, Zustand, Neuplanung) gegen das echte Modell durch und meldet Trefferquote je Kategorie, LLM-Aufrufe und Dauer; jede Runde echter Sitzungen landet in `~/.ros/vla_logs` (`session_log`) und kann ein neuer Testfall werden (`--from-log`). Musterdialoge (`few_shot`), vorgerechnete Fakten in der Szenenbeschreibung (liegt auf / trägt / freie Seiten) und eine Planprüfung auf einer simulierten Szene lassen das lokale `qwen2.5:14b` zuverlässiger planen; mit `llm_escalate:=true` gehen Korrekturrunden und Rettungspläne an Claude.
  - Er merkt sich das Gespräch (*„und jetzt auf den Zylinder“*, Antworten auf seine Rückfragen) und versteht Deutsch und Englisch, z. B. *„Stapel den blauen Würfel auf den Zylinder und leg danach die Stahlkugel in den Korb“*, *"Put the rubber ball into the bowl"*, *„Nimm die Kugel“* → *„Welche Kugel – die silberne oder die orangene?“*, *„Was siehst du?“*.
  - `dry_run:=true`: nur Plan und Fortschritt, **der Roboter bewegt sich nie**.
- **Virtuelle Objekte:** Mit der Physik-Sandbox der Robot Control UI (nur FAKE) greift, trägt und stapelt der Agent sie wirklich und legt sie in Schale und Korb (durchgängig in FAKE getestet).
- **Sicherheit:** Das Modell wählt nur Skills und Objekt-IDs – Posen kommen aus der Szene, jede Fahrt läuft durch den Motion Handler (IK, Kollisionsprüfung, Bodenschutz, Not-Aus). Im REAL-Modus (`ufactory_driver` läuft) werden Pläne nur mit `allow_real_motion:=true` ausgeführt (Standard: nur Plan), jeder Plan und jeder Rettungsplan wartet auf *Execute* (`real_require_confirm:=true`), und virtuelle Objekte werden nie angefahren (`allow_virtual_in_real:=false`). Der Not-Aus bricht die Aufgabe ab, *Abort* stoppt nach dem laufenden Schritt. *Execute* in der UI läuft zusätzlich durch `motionAllowed` (Not-Aus, Verbindung, Control-Lock).
- **Noch nicht:** ein trainiertes VLA-Modell (Demonstrationen lassen sich aufnehmen, siehe Roadmap Schritt 4).

### 🧠 Agentic ROS: der Agenten-Regelkreis
Das VLA-M-Backend ist ein **Agentic-ROS**-Node: Das Sprachmodell steuert den Roboter nicht direkt, sondern plant innerhalb eines geschlossenen Regelkreises aus ROS-Services und Prüfungen.

```
Anweisung ─► Plan (LLM: Skills + Objekt-IDs) ─► Prüfung (Code: Objekte, Greifer, Reichweite, freier Platz)
   ▲  ▲                     ▲   Fehler zurück ans LLM (max. 2×)    │ ok
   │  │                     └───────────────────────────────────────┤
   │  └─ Rückfrage (clarify) / nur Antwort                          ▼
   │                                          Bestätigen (Execute) ─► Ausführen über Motion Handler
   │                                                                   │ (IK, Kollisionsprüfung, Bodensperre, Not-Aus)
   └── Rettungsplan ◄── LLM sieht Fehler + neue Szene ◄── Greifprüfung ┘
```

- **Was das Modell entscheidet:** nur *welche* Skills mit *welchen* Objekten (greifen, ablegen auf / in / neben, Home, Greifer) – alle Posen berechnet der Code aus der Szene, jede Bewegung läuft durch die bestehende Sicherheitskette.
- **Werkzeuge = ROS-Schnittstellen:** Szene aus `/zed/bboxes_3d`, Bewegung über `/ui/approach_from_above` und den Motion Handler, Greifer über `/ui/gripper_cmd`, Greifprüfung über die Physik-Sandbox oder die Greifkugel.
- **Gedächtnis & Dialog:** Der Gesprächsverlauf bleibt erhalten (*„und jetzt auf den Zylinder“*), mehrdeutige Anweisungen führen zu einer Rückfrage, *Clear* (`/vla/reset`) setzt ihn zurück.
- **Offline zuerst:** lokales Modell über Ollama auf der GPU; Claude über die Anthropic-API optional.

<img src="../img/vla_agent.png" width="85%" alt="VLA-M-Popup: deutsche Anweisung, Antwort des Agenten, vier geplante Schritte warten auf Bestätigung, Szenen-Objekte und Backend-Status">

*VLA-M-Popup im FAKE-Modus: Der Agent (`qwen2.5:14b`, Dry Run) hat „Stapel den blauen Würfel auf den Zylinder und leg danach die Stahlkugel in den Korb“ in vier Schritte geplant und wartet auf **Execute**.*


```bash
bash src/vla_bridge/scripts/install_ollama.sh        # einmalig je PC: Ollama (~/.local, ohne sudo) + qwen2.5:14b (~9 GB)
# fehlt es, warnen Check (Preflight) der Nexus Webapp und die Setup-Karte (Log: "Ollama not found")
ros2 launch vla_bridge vla_bridge.launch.py          # Agent; startet `ollama serve` bei Bedarf selbst
# weitere Argumente: llm_backend (ollama | anthropic), llm_model, dry_run, allow_real_motion, real_require_confirm, config_file
# sie überschreiben src/vla_bridge/config/vla_bridge.yaml (Sprachmodell, Szenen-Topic, Sicherheit, Greifhöhen, Zeitgrenzen)
```

*Nexus Webapp: **VLA-M Bridge** im RUN DEV SETUP und SERVER SETUP (eigene Kategorie *VLA-M (Vision-Language-Action)*, übersprungen bis angehakt; Parameter *LLM*, *Dry run*, *REAL: execute plans*, *REAL: always confirm*; *Recommended for FAKE/REAL* setzt sie je Sequenz, REAL = execute plans + always confirm an) sowie die Karte **VLA-M (Vision-Language-Action)** mit der Bridge, *Virtual objects ON* (`/ui/set_virtual_detections`) und *VLA-M status (live)*. Bedienung: [Handbuch](../operate_manual.html), Kapitel *Den Roboter per Chat anweisen*.*

**Topics** (`/vla/*` als `std_msgs/String` mit JSON; Details in der Paket-README):

| Topic | Richtung | Inhalt |
|---|---|---|
| `/vla/instruction` | UI → `vla_bridge` | `{id, text, camera, confirm}` |
| `/vla/response` | `vla_bridge` → UI | `{id, text?, plan?, awaiting?, step?, total?, state?}` - `state` auch `clarify` (Rückfrage) und `replan` (Schritt fehlgeschlagen, Agent plant neu) |
| `/vla/status` | `vla_bridge` → UI (1 Hz) | `{state, model, llm, executes, pending, mode, sandbox, gripper, held, objects}` - die UI zeigt `OFFLINE` nach 3 s ohne Status |
| `/vla/execute` | UI → `vla_bridge` | `{id}` - gibt den wartenden Plan frei |
| `/vla/abort` | UI → `vla_bridge` | `{id}` - stoppt die laufende Aufgabe |
| `/vla/reset` | UI → `vla_bridge` | `{}` - Gespräch vergessen (*Clear*) |
| `/vla/skill` | UI (Objektmenü) → `vla_bridge` | `{id, skill: pick\|place, object?, target?, relation?, side?, x_mm?, y_mm?, confirmed, source}` - *Grasp* / *Place here* mit einem Klick ohne Sprachmodell, gleiche Prüfungen und Skills, keine Neuplanung; REAL nur mit `confirmed` |
| `/vla/skill` `{actions: [{skill: pick, object}, {skill: place, …}]}` | UI (Objektmenü *Pick & Place to …*) → `vla_bridge` | Pick + Place als EINE Aufgabe (höchstens 2 Aktionen, `MAX_DIRECT_ACTIONS`): eine Prüfung des ganzen Ablaufs, Fortschritt 1/2 → 2/2, ein Abort; REAL nur mit `confirmed` |
| `/ui/emergency_stop_active` | → `vla_bridge` | `std_msgs/Bool` (latched) - der Not-Aus bricht jede Aufgabe ab |
| `/zed/bboxes_3d` | YOLO / `virtual_object_detections` → `vla_bridge` | `visualization_msgs/MarkerArray` - die Szene (Label, Farbe, Greifkugel, Box) |
| `/ui/approach_from_above`, `/ui/execute_move_to_pose`, `/ui/execute_initial_pose`, `/ui/gripper_cmd` | `vla_bridge` → Motion-Stack | dieselben Services / dasselbe Topic wie die UI |
| `/ui/moveit_motion_state` | Motion Handler → `vla_bridge` | ein Fahrschritt ist bei `succeeded` fertig |
| `/ui/physics_sandbox_state` | Robot Control UI → `vla_bridge` | Sandbox an/aus und gehaltenes Objekt (`held`, `held_id`) - Greifprüfung |
| `/vla/skill` `{skill: palletize, mode: plan\|run, must?, limits?, dry_run?, confirmed?}` | UI (Fenster *Palletizing*) → `vla_bridge` | Auto-Palettieren: `plan` rechnet und meldet den Plan, `run` belädt die Palette Karton für Karton (`pallet_job.py`); `must` = bewusst mitgenommene Kartons (*Take along*); `limits` = eigene Grenzen `{max_load_kg, max_load_height_mm, min_support}` (`{}` = Szenen-Standard) |
| `/vla/pallet/plan` | `vla_bridge` → UI (latched) | `{task_id, state: idle\|planned\|running\|done\|aborted\|error, step, total, dry_run, message, loaded, ik, plan}` - Plan (`Plan.to_dict` mit Weltposen, `must`, `pallet_pose`) und Fortschritt |
| `/ui/virtual_objects` | `virtual_object_detections` → `vla_bridge` | latched Liste mit `meta` von Palette + Kartons - Eingabe des Palettier-Planers |
| `/ui/halt_motion` | `vla_bridge` → Motion Handler | `std_srvs/Trigger` - *Abort* beim Palettieren: hält die laufende Fahrt sofort an, **ohne** den Not-Aus zu verriegeln |

**Auto-Palettieren (N57, Szene *Logistics - auto palletizing*):** Der Knopf *Auto palletizing* der Bereichs-Leiste schaltet die Szene und öffnet das Aufgaben-Fenster **Palletizing** der Robot Control UI (`js/pallet.js`). **Plan** → `vla_bridge/palletizing.py` wählt die Kartons unter der 80-kg-Grenze (schwer und groß unten, nichts auf fragile) und zeigt Gewichtsbalken (`80 / 80 kg`), oben die Lagen-Knöpfe, darunter Seitenansicht des Stapels (vom Roboter aus, gewählte Lage kräftig, Nummern verdeckter Kartons im sichtbaren Teil) und Draufsicht je Lage (*All* = oberste Lage über der gedimmten Lage darunter mit `L1·n`), Roboter-Reihenfolge, *Stays on the conveyor* mit Grund (*Take along* plant mit diesem Karton neu) und durchsichtige **Ghost-Boxen** der geplanten Posen im Viewport (abschaltbar) mit Schritt-Nummer je Box und, mittig über der Palette knapp über ihrer max. Ladehöhe, dem Live-Ladegewicht `PAL-01 load · 51 / 80 kg` (Summe der schon abgelegten Kartons, `plan.pallet.max_top_z`). **Start** → je Karton *pick* (wie *Grasp*) → `place_at` auf die exakte Pose inkl. yaw (+90° bei gedrehten Kartons, Loslassen 3 mm darüber, `pallet_release_clearance_mm`) → Prüfung: der Karton muss bis 6 mm / 8° genau liegen (Pose über Physik-Sandbox → Virtual Objects → TF), sonst hält der Ablauf mit der Abweichung an. FAKE nur mit Physik-Sandbox (die Kartons sind Rapier-Körper; ohne sie lehnt `vla_bridge` ab, und der Hinweis *Grasp / Place not possible* bietet **Show setting** - öffnet *Viewport › Planning*, die Zeile *SIM physics* pulst - und **Start SIM physics**; *Start* bleibt ein eigener Klick, der Hinweis bleibt bis Klick, Esc oder Klick daneben); REAL lehnt virtuelle Kartons ab (`allow_virtual_in_real`). **Dry run** prüft die Armposen (IK) ohne Bewegung. **Abort** hält sofort über `/ui/halt_motion` an (ein gehaltener Karton bleibt am Sauger, Not-Aus nicht verriegelt). **Reset** legt Palette und Kartons zurück auf die Bänder. **Pallet & limits** (aufklappbarer Block oben, Zusammenfassung `EUR1 · 80 kg · 900 mm`, Badge *edited* bei eigenen Werten): Paletten-ID, Klasse, Maße, Szenen-Maßstab und Raster; einstellbar sind **max. Last** (1-500 kg), **max. Ladehöhe** (100-2000 mm) und **min. Auflage je Karton** (50-100 %) - *Apply & plan* plant damit neu, *Scene defaults* geht zurück; gesperrt, solange palettiert wird. Die Werte gelten pro Browser (`rcui_pallet_limits`), gehen mit jedem Plan / Start mit und werden beim (Neu-)Start von `vla_bridge` von selbst erneut gesendet (Hinweis im Block); Gewichtsbalken und Viewport-Label zeigen die eingestellte max. Last. Start lehnt eine nicht leere Palette ab. Im Chat plant „belade die Palette“ / „load the pallet“ den Skill `palletize` - derselbe Planer und Ablauf. Bänder und Zaun der Anlage sind MoveIt-Hindernisse, solange die Szene aktiv ist (`virtual_object_detections.py`, Objekte `cell_*`). Test: `tools/grasp_e2e.py --pallet` (FAKE, Domain 94).

**Palettenwechsel + Block *Cell & magazine*:** Jede volle Palette verlässt die Zelle: `pallet_job.py` meldet Zustand `changing` und `/vla/pallet/event` `{type: pallet_full}`, die startende Robot Control UI (`js/pallet_flow.js`) fährt die Palette samt Ladung über den Auslauf hinaus, das Magazin gibt eine Leerpalette ab (der Pneumatik-Pusher taktet sie ein), die Kartons laufen auf den Bändern ein, danach `/vla/skill` palletize `mode: changed`. Mit **Endless cycle** startet der nächste Plan selbst, ohne meldet `vla_bridge` den Plan für die Leerpalette (*Start* sofort bereit). Bewegt werden nur Szenen-Objekte, nie der Roboter; ein Dry run ohne Endlos-Zyklus lässt die Palette stehen. Der Aufklappblock **Cell & magazine** im Fenster *Palletizing* (`js/pallet_cell.js`) zeigt den Magazin-Bestand (`4 / 5 empty pallets`, auch auf dem Infoscreen und als Stapel im Twin) und enthält *Endless cycle*, *Refill the magazine automatically when empty*, *Conveyor speed* (0,05–0,40 m/s), *Magazine capacity* (1–5), **Refill magazine** und **Simulate jam**. Magazin leer ohne Auto-Nachfüllen: der Wechsel wartet (Signalsäule gelb, Infoscreen `MAGAZINE EMPTY`, `mode: change_wait` verlängert die 90-s-Frist) bis *Refill magazine*, danach erneut *Start* (kein Selbststart nach dem Warten); ein E-STOP während des Wechsels beendet den Endlos-Zyklus ebenfalls; *Reset* füllt ebenfalls auf.

<img src="../img/rcu_palletizing.png" width="85%" alt="Robot Control UI – Auto palletizing">

*Bereichs-Leiste › Scene **Auto palletizing**: Fenster *Palletizing* (Beladung PAL-01 80 / 80 kg, Lagenplan, Reihenfolge mit sechs Paketen, Kartons, die mit *Take along* auf dem Band bleiben) und die Zelle im Viewport mit Förderband, Palette, nummerierten Ablageplätzen und dem Infoscreen `3d_virtual_infoscreen` an der Tischkante.*

**Zielarchitektur:** Der LLM-Agent bleibt der Planer; ein trainiertes VLA-Modell wird einer seiner Skills (für Griffe und Bewegungen, die das geometrische Pick / Place nicht kann).
```
Robot Control UI (VLA-M) --/vla/*--> vla_bridge: LLM-Agent (Plan, Prüfung, Recovery)
                                        |  Skills heute: pick / place / home / gripper (Motion Handler)
                                        |  VLA-Skill: Beobachtung ZED-Bild (+ Handgelenk-Kamera), /joint_states, Greifer
                                        v  gRPC / WebSocket
                          Policy-Server (LeRobot, eigene venv oder Docker, GPU)
                                        |  Aktions-Chunks: Gelenkziele 6 + Greifer, 10-30 Hz
                                        v
     vla_bridge -> Sicherheitskette (robot_limits, Floor Guard, teleop_pre_collision_checker)
                -> MoveIt Servo (/servo_server/delta_joint_cmds)
```

**Modellwahl** für den xArm Lite 6 mit einer RTX A5000 (24 GB VRAM). Alle Kandidaten gibt es in [LeRobot](https://github.com/huggingface/lerobot) - ein Datensatzformat, austauschbare Policies und ein Policy-Server:

| Modell | Größe | Rolle | Begründung |
|---|---|---|---|
| **SmolVLA** | ~450 M | erste Wahl | Lässt sich auf der A5000 nachtrainieren, schnelle Inferenz. Schwächer beim Sprachverständnis - davor sitzt ein Chat-Planer. |
| **π0.5** ([openpi](https://github.com/Physical-Intelligence/openpi)) | ~3 B | Ausbaustufe | Verallgemeinert besser auf neue Objekte und Anweisungen. Inferenz passt in 24 GB, LoRA-Nachtraining wird knapp. |
| OpenVLA | 7 B | nicht empfohlen | 2024, langsam. |
| GR00T N1.x | ~3 B | nicht empfohlen | Auf humanoide Roboter ausgerichtet. |

> [!IMPORTANT]
> Kein VLA arbeitet auf dem xArm Lite 6 mit unseren Kameras ohne Nachtraining zuverlässig. Einplanen: grob **50-200 Demonstrationen pro Aufgabe**. Das Werkzeug dafür ist die VR-Quest-3-Teleoperation ([3.5](vr_quest3.html#35-funktion-vr-quest-3-teleoperation)).

**Roadmap:**
1. ✅ UI-Section, Topic-Vertrag, Eintrag in der Nexus Webapp.
2. ✅ LLM-Agent in `vla_bridge` (Ollama / Claude): Planprüfung mit Selbstkorrektur, sauberes Greifen über *Approach from above* mit Yaw-Suche, Greifprüfung, Rettungspläne, Rückfragen, Gesprächsverlauf; durchgängig mit virtuellen Objekten und der Physik-Sandbox getestet. Ersetzt die früheren regelbasierten Policies `mock` / `skills` (`dry_run:=true` statt `mock`).
3. ✅ Spracheingabe: Mikrofon-Knopf der VLA-M-Section → Whisper auf dem Roboter-PC (Diktat, keine Sprachbefehle) → Eingabefeld.
4. ✅ **Demonstrationen aufnehmen** (*Record demo* in der VLA-M-Section, Node `demo_recorder` in `robot_blackbox_recorder`, startet mit der Karte Robot Control UI, `demo_recorder:=false` schaltet ab): Aufgabe ins Eingabefeld tippen, *Record demo* drücken, Aufgabe per VR, Gamepad oder UI ausführen, dann *Save* oder *Discard*. Je Episode liegen in `~/.local/share/vla_demos/<Datensatz>/episode_NNNNNN/` `meta.json` (Aufgabe, fps, Modus, Erfolg), `data.npz` (`observation.state` = joint1..6 + Greifer, `action` = nächster Zustand, Servo-Twist) und je Kamera ein MP4 (`demo_cameras`, Standard ZED-RGB und `/twin/vcam/*/image/compressed`: im FAKE wird eine virtuelle Kamera des Twins mit Chip *ROS* wie eine Kamera aufgenommen, siehe [Robot Control UI](robot_control_ui.html); `meta.json` kennzeichnet `image_source` `sim`/`real`/`mixed`). `tools/demos_to_lerobot.py` macht daraus im LeRobot-venv ein LeRobotDataset (`--check` prüft ohne LeRobot). Ende zu Ende im FAKE getestet (`tools/grasp_e2e.py`; mit Twin-Kamera: 3 Episoden + `--check`); die Umwandlung selbst braucht das LeRobot-venv und lief hier noch nicht.
5. SmolVLA auf eine Aufgabe nachtrainieren (z.B. Becher in die Kiste). Das Modell läuft in einer **eigenen venv oder einem Docker-Container**, nie im colcon-Python - so kommen torch / numpy nicht mit ZED, YOLO und ROS Humble in Konflikt.
6. VLA als Skill des Agenten: `vla_bridge` wird Client des Policy-Servers. Aktionen laufen durch die vorhandene Sicherheitskette; liefert der Server länger als ~200 ms nichts, bleibt der Arm stehen. REAL-Modus: reduzierte Geschwindigkeit und Steuerung nur mit dem Control-Lock des `remote_control_watchdog` ([7.5](running.html#75-remote-control-server-client-kommunikation)). Zuerst im FAKE-Modus testen.
7. π0.5, falls SmolVLA nicht gut genug verallgemeinert.

---

[⬅ Zurück: Digital Twin in NVIDIA Isaac Sim](isaac_sim.html) · [🏠 Übersicht](../readme-de.html) · [⬆ Nach oben](#top) · [Weiter: Monitoring Dashboard ➡](monitoring.html)
