<a name="top"></a>

# 🧊 Digital Twin in NVIDIA Isaac Sim

[🏠 Übersicht](../readme-de.html) · [🇬🇧 English](../en/isaac_sim.html) · Kapitel 3.7

---

## 3.7 Funktion: Digital Twin & Simulation (NVIDIA Isaac Sim)
*Physischer und virtueller Arbeitsraum werden durch NVIDIA Isaac Sim als passiver, hochauflösender Digital Twin nahtlos synchronisiert.*

---

<br>

### ![Bash Script](https://img.shields.io/badge/Bash_Script-4EAA25?style=flat-square&logo=gnu-bash&logoColor=white) `start_isaac_sim.sh` &nbsp;&nbsp; <sub><i>`isaacsim/start_isaac_sim.sh` (lokal je PC, nicht im Git)</i></sub>

**Zweck & Aufgabe:** Integriert eine lokal kompilierte NVIDIA Isaac Sim Umgebung (Startskript `isaacsim/start_isaac_sim.sh`). Anstatt aktiv Physik zu berechnen oder mit Hardware-Controllern zu konkurrieren, läuft Isaac Sim im **Shadow Mode**. Es abonniert das `/joint_states` Topic und überträgt die physischen (oder simulierten) Roboterbewegungen in Echtzeit auf ein extrem detailliertes USD-Asset.

<details>
<summary><b>🔽 Details anzeigen</b></summary>

> [!NOTE]
> - **Ablauf:** 1. Der Nutzer startet `RUN DEV SETUP (Robot | Digital Twin)` oder `(Robot | Hardware)` über die UX | Nexus Launcher (früher „Nexus Webapp“).
>   2. Der Nutzer startet Isaac Sim im Terminal: `bash ~/dev_ws/isaacsim/start_isaac_sim.sh` (die frühere Nexus-Sektion `NVIDIA Isaac Sim` gehörte zur entfernten Vollseite).
>   3. Das eigene Skript startet die lokale `isaac-sim.sh` Datei mit `--allow-root` und öffnet automatisch die vorkonfigurierte Action Graph Szene (`lite6_isaac_ros2.usd`).
> - **OmniGraph Architektur:** Die Szene nutzt einen minimalistischen Action Graph, bestehend aus einem `On Playback Tick` Knoten, der in einen `ROS2 Subscribe Joint State` Knoten feuert (welcher `/joint_states` abonniert), der wiederum direkt in den `Articulation Controller` mündet, welcher das Roboter-Asset steuert.
> - **`COLCON_IGNORE` Integration:** Da Isaac Sim tausende nicht-ROS Python Skripte in seinem `_build` Cache enthält, wurde eine `COLCON_IGNORE`-Datei im `isaacsim` Ordner platziert, um zu verhindern, dass `colcon build` bei der ROS 2 Workspace-Kompilierung abstürzt.

</details>

---

[⬅ Zurück: UX | Control Interface & Motion-Backend](robot_control_ui.html) · [🏠 Übersicht](../readme-de.html) · [⬆ Nach oben](#top) · [Weiter: VLA-M: Vision-Language-Action-Chat ➡](vla.html)
