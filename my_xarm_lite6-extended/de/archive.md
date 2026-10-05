<a name="top"></a>

# 🗄️ Archiv & verworfene Konzepte

[🏠 Übersicht](../readme-de.html) · [🇬🇧 English](../en/archive.html) · Kapitel 10

**Inhalt:** [10. 🗄️ Archiv / Architektur-Entscheidungen & Veraltete Konzepte](#10--archiv--architektur-entscheidungen--veraltete-konzepte)

---

## 10. 🗄️ Archiv / Architektur-Entscheidungen & Veraltete Konzepte

Dieser Abschnitt dokumentiert Legacy-Komponenten und die architektonischen Gründe für deren Ablösung. Zu verstehen, *warum* bestimmte Konzepte ersetzt wurden, hilft beim Nachvollziehen des aktuellen Systemdesigns.

### 10.1 `motion_sequence` (Kartesische State-Machine) [VERALTET]
Ursprünglich wurde die Greiflogik des Roboters von einem Node namens `motion_sequence` gesteuert, der kartesische Wegpunkte (Pre-Grasp, Grasp, Post-Grasp) starr interpoliert hat.
- **Warum es abgelöst wurde:** Dieser Ansatz hatte keine dynamische Kollisionserkennung. Der Arm wäre Hindernissen blind auf geraden Linien gefolgt. Das System wurde durch `robot_motion_handler_movegroup` und MoveIt 2 ersetzt, welche dynamische Sicherheitszonen, Hindernisvermeidung via OctoMaps und weiche Spline-Interpolationen bieten.

### 10.2 2D Raspberry Pi Kameras vs. 3D Stereo Vision [VERALTET]
Frühe Iterationen setzten auf Standard-2D-Webcams oder Raspberry Pi Kameras in Kombination mit 2D-Homographie (ArUco Marker), um Objektpositionen auf einem flachen Tisch zu schätzen.
- **Status:** Der 2D-Weg ist weiterhin als leichtgewichtige Alternative verfügbar (`zed_m:=false ip_cams:=true`, Pi-Streams in der Robot Control UI, `RUN DEV + Gaze UI (Rpi Cam) - Egocentric`); Standard ist die ZED Mini.
- **Warum es abgelöst wurde:** 2D-Vision kann keine Tiefen oder Objektvolumen wahrnehmen. Das System wurde auf die ZED Mini 3D-Stereokamera aufgerüstet. Dichte Punktwolken kombiniert mit YOLOv8 3D-Boundingboxen ermöglichen echte räumliche Wahrnehmung, sodass der Roboter Objekte unterschiedlicher Höhe greifen und komplexen Hindernissen ausweichen kann, die eine 2D-Kamera nicht sehen würde.

### 10.3 Manuelle Multi-Terminal Shell-Skripte (`lite6.sh`) [VERALTET]
In der Vergangenheit erforderte der Start des Systems das manuelle Ausführen mehrerer `.sh` Skripte (`lite6.sh`, `start.sh`) in verschiedenen Terminalfenstern.
- **Warum es abgelöst wurde:** Dies war fehleranfällig, schwer zu debuggen und für neue Nutzer wenig intuitiv. Es wurde vollständig durch die **Nexus Webapp** abgelöst, einem webbasierten Orchestrator, der Prozesslebenszyklen sicher verwaltet, Logs aggregiert und einen One-Click-Start von jedem Gerät aus ermöglicht.

### 10.4 ArUco Marker System [VERALTET]
> *[Veraltet]* Im Arbeitsbereich des Roboters platzierte Marker dienten als Referenz für Homographie-Matrizen zur Ableitung von 3D-Weltkoordinaten für Objekte auf der Arbeitsfläche (Z = 90 mm). Dies wird heute größtenteils durch native 3D-TF-Frames der ZED-Kamera abgelöst, wird aber weiterhin genutzt, um die Blickkoordinaten des Tobii Eye-Trackers auf die 2D-Ebene zu mappen, und im 2D-Kameraweg (`zed_m:=false ip_cams:=true`, `yolo_3d_bbox_for_ip_cam.py`: ArUco-6D-Pose + Homographie, siehe 10.2).

---

[⬅ Zurück: Repository-Struktur](repository_structure.html) · [🏠 Übersicht](../readme-de.html) · [⬆ Nach oben](#top)
