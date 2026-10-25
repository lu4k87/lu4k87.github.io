<a name="top"></a>

# 🕶 MR-Brille (Magic Leap 2)

[🏠 Übersicht](../readme-de.html) · [🇬🇧 English](../en/mr_magicleap2.html) · Kapitel 3.5b

---

## 3.5b Funktion: MR-Ansicht des echten Roboters
*Die Magic Leap 2 zeigt den echten xArm Lite 6 durch das Glas, mit Einblendungen am Arm und auf dem Tisch. Nur Anzeige – aus der Brille bewegt sich nichts; einzige Aktion mit Wirkung ist der E-STOP (Leiste unter der Blickachse und Tafel).*

> **Stand (2026-10-25):** vorbereitet, noch nicht mit der Magic Leap 2 getestet. Desktop-Vorschau, Node und Ausrichtungs-Rechnung sind getestet.

### Starten

1. UX | Nexus Launcher → Karte **MR Headset (Magic Leap 2)** → `ros2 launch mr_magicleap2 mr_magicleap2.launch.py` (HTTPS 8443 + rosbridge WSS 9091 + `mr_headset_bridge`, ohne den VR-Teleop-Node). Sind 8443/9091 schon belegt (VR Quest 3 Teleop läuft), startet der Launch nur die Bridge und die Brille nutzt den laufenden Server; nichts wird beendet. Reihenfolge: erst VR Quest 3 Teleop, dann MR – der VR-Launch macht Port 8443 für sich frei.
2. Browser der Magic Leap 2 (gleiches Netz wie der Roboter-PC) → `https://<PC-IP>:8443/`, Zertifikat annehmen, einmal auch `https://<PC-IP>:9091/`, neu laden. Abkürzung: QR-Symbol neben dem Adressfeld des Magic-Leap-Browsers.
3. Viewport-Leiste → Knopf **MR** (Brillen-Symbol, neben VR) oder XR-Menü → **MR Headset (Magic Leap 2)**. Immersive Sitzung erlauben.
4. **End MR** auf der Tafel, erneut **MR** oder die Menü-Taste am Controller (System) beendet die Sitzung. Bumper oder **Panel here** holt die Tafel vor den Blick.

Ohne AR-Brille (Desktop-Browser) zeigt derselbe Knopf die MR-Ebenen als **Vorschau** im 3D-Viewport.

### Ausrichten (erstes Mal, nach Verschieben des Tischs)

Noch nicht ausgerichtet → die Tafel öffnet mit **Align to the robot** (Knopf **Align now**); nach Verschieben des Tischs **Re-align** drücken. Spitze des Controllers (oder Zeigefingerspitze, Hand-Tracking) an jeden Punkt halten, Trigger drücken (oder kneifen):

| Punkt | Lage in `link_base` |
|---|---|
| Spitze der Saugdüse | Live-TCP-Pose (`/ui/eef_position`, mm) – Arm zwischen den Punkten am Desktop verfahren = weitere Punkte |
| Tischecke links (+Y) am Roboter | `x = −0,082 m`, `y = +0,40 m` (Twin-Tisch, `lab_room.js` `TABLE`) |
| Tischecke rechts (−Y) am Roboter | `x = −0,082 m`, `y = −0,40 m` |
| Ferne Ecken (optional) | `x = +1,118 m`, `y = ±0,40 m` |

- Ab 2 Punkten (mindestens 15 cm auseinander) zeigt die Tafel die Güte: `±mm` (grün ≤ 10 mm, gelb ≤ 25 mm, darüber rot → neu messen) und den größten Fehler.
- **Use alignment** speichert im Browser (`localStorage rcu.mr.calib`) und über `/mr/calibration_set` in `~/.ros/mr_magicleap2/calibration.json`; der Node schickt sie latched auf `/mr/calibration` zurück.
- Feinschritte: X/Y/Z ±5 mm, Drehen ±0,5°. **Virtual arm** einschalten = Twin-Arm mit dem echten vergleichen.
- Der echte Tisch muss dem Twin-Tisch entsprechen (1,20 × 0,80 m, schmale Kante bündig mit dem Roboterfuß); sonst nur Saugdüsen-Punkte nehmen.

### Was die Brille zeigt

| Ebene | Was man sieht | Wozu |
|---|---|---|
| Work surface | 10-cm-Raster auf dem Tisch, Achsen +X/+Y an der Basis | Ausrichtung auf einen Blick prüfen |
| Reach on table | Ring von der Sockelzone (100 mm) bis zur Reichweite auf Tischhöhe | wo der Arm greifen kann |
| TCP drop line | Lot von der Düse auf den Tisch, Fadenkreuz, `Z … mm` (gelb nahe der Z Collision Level) | wo die Düse aufsetzen würde |
| Status ring | Ring um die Basis + Etikett: Robot \| Hardware / Robot \| Digital Twin · Zustand · Tempo (grau steht, grün fährt, gelb offline, rot E-STOP) | Zustand direkt am Arm lesbar |
| Joint limits | Bogen je Gelenk mit Zeiger, gelb innerhalb 15° vor der Grenze (Standard aus) | wie viel Spielraum ein Gelenk noch hat |
| Distance hint | gelbe Hülle + „Step back – the arm is moving (hint)“, wenn der Kopf innerhalb Reichweite + 25 cm ist, während der Arm fährt; nur ausgerichtet | aus dem fahrenden Arm heraushalten – Hinweis, **keine** Schutzfunktion |

Ebenfalls sichtbar, weil in derselben Szene: Pfad-Vorschau, Ghost, virtuelle Objekte des Mixed-Reality-Modus (N49). Virtueller Tisch, Raster und Laborraum sind aus. Sicherheitsleiste unter der Blickachse (folgt dem Kopf): rotes **E-STOP**-Feld (zielen + Trigger), Robot | Hardware / Robot | Digital Twin, Zustand, Tempo, Steuerungs-Lock, Ausrichtung (`PC ALIGN?` = vom Roboter-PC übernommen, mit **Virtual arm** vergleichen).

**Rückmeldung E-STOP:** keine rosbridge-Verbindung → `E-STOP NOT SENT`; keine Quittung des Nodes innerhalb 1,5 s → `E-STOP NOT CONFIRMED` – dann den Hardware-Not-Aus drücken.

### Desktop: wer die Brille trägt

Ebene **Headset user** im 3D-Viewport: Kopf + Blickrichtung aus `/mr/operator` (nur ausgerichtet und nicht älter als 3 s).

### ROS 2

| Name | Typ | Inhalt |
|---|---|---|
| `/mr/headset_pose` | `std_msgs/String` (JSON, 5 Hz, Browser → Node) | Kopf + Blickrichtung in `link_base`, ausgerichtet ja/nein, ±mm |
| `/mr/operator` | `std_msgs/String` (JSON, 5 Hz) | aktiv, veraltet, Abstand zur Basisachse, Zone `inside`/`near`/`outside`/`unknown` |
| `/mr/calibration_set` | `std_msgs/String` (Browser → Node) | Ausrichtung x, y, z, yaw, ±mm |
| `/mr/calibration` | `std_msgs/String`, transient local | gespeicherte Ausrichtung |
| TF `link_base → mr_headset` | tf2 | Kopf-Pose (nur ausgerichtet) |

Parameter des Nodes `mr_headset_bridge`: `reach_m` 0,44, `margin_m` 0,25, `stale_s` 1,5, `publish_tf` true, `calib_file` (`~/.ros/mr_magicleap2/calibration.json`), `base_frame` `link_base`, `head_frame` `mr_headset`. Launch-Argumente: `https` (true), `reach_m`, `margin_m`. Die Zone ist ein Hinweis (Log, Desktop), **kein** Sicherheitssignal.

### Dateien

- `js/twin/mr_session.js` – Sitzung, Tafel, Sicherheitsleiste, Ausrichtung
- `js/twin/mr_layers.js` – Ebenen (auch Desktop-Vorschau)
- `js/twin/mr_calib.js` – 4-DoF-Ausgleich (Test `test/test_mr_calib.py`)
- `src/mr_magicleap2/` – Node `mr_headset_bridge`, Launch `mr_magicleap2.launch.py`, Tests `test/test_core.py`

---

[⬅ Zurück: VR-Teleoperation](vr_quest3.html) · [🏠 Übersicht](../readme-de.html) · [⬆ Nach oben](#top) · [Weiter: UX | Control Interface & Motion-Backend ➡](robot_control_ui.html)
