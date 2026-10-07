<a name="top"></a>

# 🧊 Digital Twin in NVIDIA Isaac Sim

[🏠 Overview](../readme-en.html) · [🇩🇪 Deutsch](../de/isaac_sim.html) · Chapter 3.7

---

## 3.7 Feature: Digital Twin & Simulation (NVIDIA Isaac Sim)
*The physical and virtual workspaces are seamlessly synchronized using NVIDIA Isaac Sim as a passive, high-fidelity digital twin.*

---

<br>

### ![Bash Script](https://img.shields.io/badge/Bash_Script-4EAA25?style=flat-square&logo=gnu-bash&logoColor=white) `start_isaac_sim.sh` &nbsp;&nbsp; <sub><i>`isaacsim/start_isaac_sim.sh` (local per PC, not in Git)</i></sub>

**Purpose & Task:** Integrates a locally built NVIDIA Isaac Sim environment (start script `isaacsim/start_isaac_sim.sh`). Instead of actively computing physics or conflicting with hardware controllers, Isaac Sim runs in **Shadow Mode**. It subscribes to the `/joint_states` topic and maps the physical (or fake) robot movements onto an extremely high-fidelity USD asset in real-time.

<details>
<summary><b>🔽 Show details</b></summary>

> [!NOTE]
> - **Workflow:** 1. The user launches `RUN DEV SETUP (FAKE)` or `(REAL)` via the UX | Nexus Launcher (formerly Nexus Webapp).
>   2. The user starts Isaac Sim in a terminal: `bash ~/dev_ws/isaacsim/start_isaac_sim.sh` (the former Nexus section `NVIDIA Isaac Sim` belonged to the removed full page).
>   3. The custom script spawns the local `isaac-sim.sh` binary with `--allow-root` and automatically opens the pre-configured Action Graph scene (`lite6_isaac_ros2.usd`).
> - **OmniGraph Architecture:** The scene uses a minimal footprint Action Graph consisting of an `On Playback Tick` node firing into a `ROS2 Subscribe Joint State` node (listening to `/joint_states`), which pipes directly into the `Articulation Controller` driving the robot asset.
> - **`COLCON_IGNORE` Integration:** Because Isaac Sim contains thousands of non-ROS python scripts within its `_build` cache, a `COLCON_IGNORE` file is placed inside the `isaacsim` directory to prevent `colcon build` from fatally crashing the ROS 2 workspace compilation.

</details>

---

[⬅ Previous: UX | Control Interface & Motion Backend](robot_control_ui.html) · [🏠 Overview](../readme-en.html) · [⬆ Top](#top) · [Next: VLA-M: Vision-Language-Action Chat ➡](vla.html)
