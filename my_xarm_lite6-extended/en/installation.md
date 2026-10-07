<a name="top"></a>

# 📦 Installation & Requirements

[🏠 Overview](../readme-en.html) · [🇩🇪 Deutsch](../de/installation.html) · Chapter 6

**Contents:** [6. 📦 Dependencies & Requirements](#6--dependencies--requirements)

> [!TIP]
> **New workstation?** The [setup guide](../operate_setup_guide.html) (DE/EN, linked from the project docs – footer button **Project docs** in the UX | Nexus Launcher, formerly Nexus Webapp) walks through all steps as a checklist – hardware, Ubuntu, ROS 2, workspace, network, acceptance – optionally for a pre-installed PC.

---

## 6. 📦 Dependencies & Requirements

<br>

### System Requirements

<details>
<summary><b>🔽 Show table</b> · 11 components · OS · ROS 2 · MoveIt 2 · Python · ZED SDK · CUDA</summary>

| Component | Version / Details |
|-----------|-----------------|
| **OS** | *Ubuntu 22.04.5 LTS (Jammy)* |
| **ROS 2** | *Humble Hawksbill (LTS)* |
| **MoveIt 2** | *v2.5.9* |
| **Python** | *v3.10.12* |
| **OpenCV** | *v4.9.0* |
| **YOLO / Ultralytics** | *v8.4.61* |
| **ZED SDK** | *v4.1.2 (ZED M Firmware 1523)* |
| **CUDA** | *12.1 (toolkit only, see `tools/install_zed.sh`)* |
| **Pygame** | *v2.6.1* |
| **Build System** | *`colcon`* |
| **Compiler** | *GCC 11+ (C++17)* |

</details>

<br>

### ⚠️ Critical System Configurations (Troubleshooting)

> [!WARNING]
> **1. `.bashrc` Configuration (CUDA & UX | Nexus Launcher Compatibility)**
> When launching the ZED camera (which requires CUDA) via the UX | Nexus Launcher, the backend spawns terminals as a *non-interactive shell*. As a result, Ubuntu aborts the loading of your `~/.bashrc` very early. To prevent the ZED SDK from falling back to CPU rendering (which causes massive stuttering!), you **must** place all CUDA and ROS environment variables at the **very top** of your `~/.bashrc` (before the `case $- in *i*) ;; *) return;; esac` block!). Example of a correct `.bashrc` header:
> ```bash
> source /opt/ros/humble/setup.bash
> source ~/dev_ws/install/setup.bash
> export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
> export PATH=/usr/local/cuda/bin${PATH:+:${PATH}}
> export LD_LIBRARY_PATH=/usr/local/cuda/lib64${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}
> export ROS_LOCALHOST_ONLY=0 # Set to 0 for distributed network, 1 for local only
> ```
>
> **2. Display Server: X11 vs. Wayland (RViz2 Performance)**
> Ubuntu 22.04 defaults to the Wayland display server. In combination with NVIDIA GPUs and RViz2 (Ogre3D engine), this often leads to catastrophic framerates and heavily stuttering 3D point clouds. 
> Check your system in the terminal: `echo $XDG_SESSION_TYPE`
> If the output is `wayland`, log out of your Ubuntu session, click the gear icon in the bottom right corner, and select **Ubuntu on Xorg (X11)** before logging back in.
> **To make this permanent:** Edit `sudo nano /etc/gdm3/custom.conf` and uncomment `WaylandEnable=false` under the `[daemon]` section, then reboot.

<br>

### Base System (Core Prerequisite)

The absolute core prerequisite for this workspace is the official UFactory ROS 2 package. Because this repository acts as an extension, all dependencies of the main repository must be met:
- **Repository:** [UFactory xarm_ros2 (Humble)](https://github.com/xArm-Developer/xarm_ros2/tree/humble)
- All official UFactory installation steps and drivers (e.g., xArm-C++-API) must be fully functional in the background.

<br>

### Core ROS 2 Packages
<details>
<summary><b>🛠️ Show Core ROS 2 Packages</b></summary>

```bash
# Build Tools & Audio (Required for PyAudio & Whisper microphone)
sudo apt update && sudo apt install -y python3-pip python3-pyaudio portaudio19-dev

# Whisper "small" model download (multilingual EN/DE, required for voice commands;
# otherwise downloaded automatically on the first start)
mkdir -p ~/.cache/whisper.cpp && wget --show-progress -O ~/.cache/whisper.cpp/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin

# MoveIt 2 & Servo
sudo apt install ros-humble-moveit ros-humble-moveit-servo

# Joystick driver
sudo apt install ros-humble-joy ros-humble-teleop-twist-joy

# rosbridge (Web UIs) & CV
sudo apt install ros-humble-rosbridge-server ros-humble-rosbridge-suite ros-humble-cv-bridge

# TF2 & visualization
sudo apt install ros-humble-tf2-ros ros-humble-rviz2

# RViz 2D Overlay Plugins
sudo apt install ros-humble-rviz-2d-overlay-plugins ros-humble-rviz-2d-overlay-msgs

# Web UI & Gaze Control Dependencies
sudo apt install python3-pyqt5.qtwebengine python3-opencv python3-av
```
</details>

<br>

### Python Dependencies
<details>
<summary><b>🛠️ Show Python Dependencies</b></summary>

```bash
# Critical Core Dependencies
pip install "numpy<2" # CRITICAL: Must be < 2.0 (tested: 1.26.4) to avoid breaking ROS 2 cv_bridge and tf2
pip install "scipy>=1.8.0" # Math and rotations

# Hardware & Audio Interfaces
pip install pygame==2.6.1 # Haptic feedback (controller vibration)
pip install PyAudio==0.2.14 # Microphone stream for Whisper

# Web Backend & UI
pip install "Flask>=2.2.0" # UX | Nexus Launcher backend
pip install "PyQt5>=5.15.6" # Python UI (Gaze-Control & Pointcloud Tuner)
pip install mss==10.2.0 # Screen recording for Window Capture

# Vision & Perception
pip install "opencv-python>=4.9.0" # Computer Vision
pip install "ultralytics>=8.0.0" # YOLO 3D Object detection
```
</details>

<br>

### 6.1 🛠️ Hardware Bill of Materials (BOM) & Physical Wiring

#### Bill of Materials (BOM)

<details>
<summary><b>🔽 Show table</b> · 9 components · robot · gripper · sensors · input devices · PC · network</summary>

| Component | Model / Specification | Interface / Protocol | Primary Role |
|---|---|---|---|
| **Robot Manipulator** | UFactory xArm Lite 6 | Ethernet (Modbus TCP) | 6-DOF lightweight collaborative robotic arm |
| **End-Effector** | xArm Lite 6 Vacuum Gripper | Tool Digital I/O (TGPIO) | Vacuum suction gripper for object pick-and-place |
| **Laser Guidance** | 5V Red Line/Dot Laser Diode | TGPIO Pin 0 | Automatic optical targeting aid under 50 mm Z-height |
| **Stereo Depth Sensor** | Stereolabs ZED Mini | USB 3.0 (Type-C) | High-resolution stereoscopic depth & 3D point cloud capture |
| **Gaze control** | Tobii Pro Glasses 3 | RTSP (Wi-Fi / Ethernet) | 50/100 Hz binocular gaze tracking for intention detection |
| **Gamepad Controller** | Xbox One Elite Series 2 | USB / Bluetooth | Low-latency manual Cartesian jogging & velocity scaling |
| **VR Headset** | Meta Quest 3 | HTTPS / WebXR (Wi-Fi) | Immersive 6-DoF stereoscopic remote teleoperation |
| **Host Workstation** | Intel i9-12900K, RTX A5000 | Ubuntu 22.04 / CUDA | Real-time MoveIt Servo, YOLO inferencing, & ROS 2 Core |
| **Network Switch** | Unmanaged Gigabit Switch | RJ45 Ethernet | Low-latency local network backplane for controller & PC |

</details>

#### Physical Wiring & Network Topology
<p align="center"><img src="../img/diagrams/hardware_network.svg" width="100%" alt="Physical wiring and network topology"></p>

*Physical wiring and network topology · source: `tools/make_diagrams.py`*

**Firewall (robot PC):** rosbridge (9090/9091) has no access control of its own → `tools/firewall_setup.sh` lets in only the home network and the /24 networks from `config/network.yaml` (ufw). Without options it only shows the plan; `--apply` sets the rules (sudo), `--net <cidr> --apply` allows another network, `--status`, `--undo`.

<br>

### Tobii Pro Glasses 3 Setup & Calibration

**Network:** Depending on how the glasses are connected they have a different IP: **Ethernet (LAN) `192.168.100.xxx`**, **Wi-Fi `192.168.75.xxx`**. Both are set in `config/network.yaml` (`tobii.wlan_ip`, `tobii.lan_ip`); `tobii.connection` selects which one is used: `auto` (default) takes the address whose /24 network is present on an interface of this PC, otherwise Wi-Fi; `wlan`/`lan` force one. The Gaze UI (`gaze_ui`, `gaze_ui_zedm`), `gaze_grasp_routine_tobii_glasses` (parameter `tobii_ip`, default from the same lookup), the UX | Control Interface (formerly Robot Control UI) header, the UX | Compact Interface (formerly Touch Panel) and the UX | Nexus Launcher all read it via `net_get('tobii.ip')`.

To correctly calibrate the Tobii Pro Glasses 3 setup (using the glasses, the calibration card, and the 4 ArUco markers on the UI), two separate steps must be performed:

1. **Glasses Calibration (using the Calibration Card):** This step ensures that the cameras inside the glasses accurately map the wearer's pupils to 3D space.
   - **Put on Glasses:** Put on the glasses and connect them to the recording unit. Ensure the Tobii Pro Controller software is running.
   - **Position the Card:** Hold the small Tobii calibration card (with the distinctive pattern) in front of you at a natural distance (about 50 to 80 cm).
   - **Fixate Gaze:** Focus strictly on the **dot/hole in the center** of the card. Keep the card and your head as still as possible.
   - **Start Calibration:** Click "Calibrate" in the Tobii software and keep your gaze fixated until the software reports a success.
   - *Tip:* If the glasses shift or you take them off, you should repeat this step.

2. **Display Mapping (using 4 ArUco Markers):** Now that the glasses know where you are looking in space, the system needs to understand where your monitor is located.
   - **Show Markers:** Start the Gaze UI (`gaze_ui_node_tobii_glasses.py`). The 4 ArUco markers will be prominently displayed in the corners of the UI window.
   - **Look at Monitor:** Sit in front of the monitor. Ensure that the front camera (scene camera) of the glasses has **all 4 ArUco markers simultaneously** in its field of view.
   - **Tracking:** Once the scene camera sees all 4 markers, the system automatically computes a perspective transformation (homography). It then translates your 3D gaze vector from the glasses into exact 2D mouse coordinates on the screen. If you get too close to the screen and the scene camera loses sight of the markers, tracking will pause.

<br>

### ZED SDK & Camera Setup (ZED Mini)

The ZED Mini camera requires the official ZED SDK and a matching CUDA toolkit version. To ensure a clean installation on Ubuntu 22.04 with ROS 2 Humble without breaking existing NVIDIA drivers, follow this exact procedure:

1. **Install CUDA 12.1 Toolkit**: The ZED SDK build used here (4.1.2) is built for CUDA 12.1. Install only the toolkit, not the full driver package. The helper script `tools/install_zed.sh` performs steps 1, 2 and 5: CUDA 12.1 toolkit via `cuda-keyring`, ZED SDK 4.1.2 in silent mode, `rosdep install` and a build of the **whole** workspace (`colcon build --symlink-install --cmake-args=-DCMAKE_BUILD_TYPE=Release`); it clones `zed-ros2-wrapper`/`zed-ros2-interfaces` only if they are missing (they are already in the repo). It appends the PATH entries (`/usr/local/cuda-12.1/…`) to the **end** of `~/.bashrc` → move them to the top afterwards (see **⚠️ Critical System Configurations** above).
2. **Install ZED SDK**: ZED SDK **4.1.2** for Ubuntu 22.04 / CUDA 12.1 (`ZED_SDK_Ubuntu22_cuda12.1_v4.1.2.zstd.run`), installer in silent mode. Newer SDK versions do not match the embedded ROS 2 wrapper (4.1.0).
 * *Important:* The installer sets up Python API packages as root. Fix the PIP permissions afterwards so `rosdep` can access them:
 ```bash
 sudo chmod -R a+rX /usr/local/lib/python3.10/dist-packages/
 ```
3. **ROS Dependencies**: Install the required point cloud transport package:
 ```bash
 sudo apt install ros-humble-point-cloud-transport
 sudo apt install ros-humble-octomap-server
 ```
4. **ZED SDK Source Code [CRITICAL]**: The ROS 2 Wrapper source code must precisely match the installed SDK version to avoid compilation errors. This repository already includes the matching source code permanently embedded: `zed-ros2-wrapper` and `zed-ros2-interfaces` both declare version `4.1.0` in their `package.xml` and target ZED SDK `4.1.x`. You do **not** need to clone or check out any ZED repositories manually.
5. **Build the Wrapper**: 
 ```bash
 cd ~/dev_ws
 rm -rf build/zed_* install/zed_* # Clean old artifacts first!
 source /opt/ros/humble/setup.bash
 colcon build --packages-select zed_interfaces zed_components zed_wrapper robot_vision_cameras_bringup --symlink-install
 ```
6. **Execution Workflow & RViz Integration**:
 * First, launch the robot base (e.g., **Fake Arm** or **Real Arm**) via the UX | Nexus Launcher. This automatically opens **RViz** with the pre-configured layout (`servo.rviz`).
 * Next, launch **Robot Vision Cameras Bringup (cam, tf, yolo3d, pc_opt, grasp, status/warn)** (card in the DEV SETUP popup) (or in a terminal: `ros2 launch robot_vision_cameras_bringup robot_vision_cameras_bringup.launch.py`, add `ip_cams:=true` for the IP cameras). This executes the `robot_vision_cameras_bringup` package, which simultaneously initializes the ZED wrapper, broadcasts the static TF (aligning the camera to the robot's `link_base`), and publishes the dynamically generated 3D tripod visualization.
 * The live Point Cloud (`PointCloud2`) and the camera axes will instantly and automatically appear in the already running RViz instance without any manual configuration.

<br>

### Setup & Build
<details>
<summary><b>🛠️ Show Setup & Build</b></summary>

```bash
# Clone and initialize
git clone <repo-url> ~/dev_ws
cd ~/dev_ws

# Install dependencies
# This installs all base dependencies of the official xarm_ros2 repo 
# as well as the dependencies of our own multimodal packages:
rosdep install --from-paths src --ignore-src -r -y

# Build the workspace
colcon build --symlink-install

# Source the workspace
source install/setup.bash
```
</details>

<br>

### Several Computers (Laptop, Lab PC, Home PC)
GitHub is the only source; each computer has its own clone in `~/dev_ws` (Ubuntu 22.04 + ROS 2 Humble, own SSH key at GitHub).

| When | Command / step | What happens |
|---|---|---|
| Once after `git clone` | `tools/ws_sync.sh --setup` | Claude memory from `.claude/memory/` (sets `autoMemoryDirectory` in `.claude/settings.local.json`, old path `~/.claude/projects/<ws>/memory` becomes a symlink), missing values in `~/.claude/settings.json` from `.claude/user-settings.json` (model, effort, mods `answer-cards` + `ros-safety-status` via `CLAUDE_CODE_PLUGIN_DIRS`; differences are only reported), Git hooks (`tools/install_hooks.sh`, remove with `--remove`): pre-commit checks, pre-push publishes the project pages to `~/lu4k87.github.io` and pushes there, post-merge/post-rewrite pull that checkout along; clones `~/lu4k87.github.io` if missing, reports a missing/outdated Blender (→ `tools/install_blender.sh`) |
| Every start on a computer | `tools/ws_sync.sh` | setup as above, `git pull --rebase --autostash`, builds changed ROS packages (`colcon build --symlink-install --packages-select …`), lists uncommitted files and unpushed commits |
| Pull without building | `tools/ws_sync.sh --no-build` | as above, without `colcon build` |
| Before switching computers | commit + `git push` | otherwise the work stays on this computer |

- **Shared via Git:** `AGENTS.md`, `.claude/` (skills, agents, hooks, mods, memory, template `user-settings.json`), card definitions in `ros2_nexus/launcher_config.json`.
- **Per computer, not in Git:** `build/`, `install/`, `log/`, `~/.config/ros2_nexus/` (Nexus selections `launcher_state.json`, backups, settings), `.claude/settings.local.json`, Claude chat history (`claude --resume`), Ollama models, ZED SDK, `isaacsim/`.
- **Blender + MCP server:** `tools/install_blender.sh` installs/updates the pinned version without sudo (`--check` shows installed, pinned and newest version); details: skill `.claude/skills/blender`.
- **Claude Code:** a new chat warns when `origin` is ahead (hook `session_overview.py`) → run `tools/ws_sync.sh` first.
- **Away from the lab:** robot, cameras and Tobii (`config/network.yaml`) are unreachable → Robot | Digital Twin only; Robot | Hardware only on site with someone at the E-STOP.

---

[⬅ Previous: Concept & Architecture](concept.html) · [🏠 Overview](../readme-en.html) · [⬆ Top](#top) · [Next: Running the System ➡](running.html)
