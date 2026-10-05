<a name="top"></a>

# 🚀 Running the System

[🏠 Overview](../readme-en.html) · [🇩🇪 Deutsch](../de/running.html) · Chapter 1.1, 7

**Contents:** [1.1 ⚡ 5-Minute Quickstart (Pure Simulation)](#11--5-minute-quickstart-pure-simulation) · [7. 🚀 Execution: How to Run the System](#7--execution-how-to-run-the-system)

---

## 1.1 ⚡ 5-Minute Quickstart (Pure Simulation)

> [!TIP]
> **No physical robot or hardware required!** You can build, launch, and test the entire software stack (Digital Twin simulation, RViz2, Robot Control UI and Monitoring Dashboard) immediately on your local PC.

### 1. Build & Source Workspace
```bash
cd ~/dev_ws
colcon build --symlink-install
source install/setup.bash
```

### 2. Launch the Central Process Cockpit (Nexus Webapp)
```bash
./ros2_nexus/ros2_nexus_web_start.sh
```
*This starts the local process manager daemon (`http://localhost:8080`) and opens the Nexus Webapp as a frameless window that only shows the start popup (fallback: Chrome app window or default browser, see 7.2).*

### 3. Run Simulation & Explore the Web UIs
1. The **Nexus Webapp** opens directly with the **RUN DEV SETUP** popup; select **FAKE** in the FAKE | REAL switch of the popup header.
   * **EXECUTE** starts the simulated xArm Lite 6 `ros2_control` hardware interface, MoveIt 2 Servo + MoveGroup, RViz2, the virtual linear axis and the Robot Control UI incl. WebSocket ROS Bridge (`ws://localhost:9090`) and video server (8082). Vision, speech control, eye tracking and VR are further cards in the same popup and can be unticked.
2. Open the **Robot Control UI** (`http://localhost:8081`):
   * Test Cartesian XYZ jog controls, drive the joint sliders, or command the initial home pose. *(The gripper buttons drive the gripper directly — see 3.6.)*
3. Open the **Monitoring Dashboard** (`http://localhost:8083/`) – a card in RUN DEV SETUP (see [8](monitoring.html)).
   * Follow system load, the ROS 2 node graph with live rates (Hz, bandwidth), robot usage and sessions.


---
<br>

## 7. 🚀 Execution: How to Run the System

This section describes the step-by-step process to launch both the hardware and the software components. The **Nexus Webapp** serves as the central web-based GUI to launch all nodes, sensors, and algorithms with a single click.

### ⚡ Quickstart Decision Tree ("What should I launch?")

| Use-Case / Scenario | Required Hardware | Recommended Launch Sequence in Nexus | Reachable Web Tools |
| :--- | :--- | :--- | :--- |
| **Pure Simulation / GUI Test** | Only PC (No Robot HW) | 1. `RUN DEV SETUP (FAKE)` (untick vision, eye tracking, VR if not needed)<br>2. optional: card `Monitoring Dashboard` | Robot Control UI (8081), Monitoring Dashboard (8083) |
| **Gamepad Teleoperation** | xArm Lite 6 + Xbox Controller | 1. Power on Robot<br>2. `RUN DEV SETUP (REAL)` | RViz2, Robot Control UI (8081) |
| **3D Object Detection & Grasping** | xArm Lite 6 + ZED Mini | 1. `RUN DEV SETUP (REAL)` with the card `Robot Vision Cameras Bringup` ticked | RViz2, Robot Control UI (8081), Web-Video (8082) |
| **Eye-Tracking Teleoperation** | Tobii Glasses 3 + ArUco Setup | 1. `RUN DEV SETUP (REAL)` with the card `Eyetracker - Gaze Control` (Real World or UI Gaze)<br>or `EXTRAS EXECS` → `RUN DEV + Gaze UI (ZED M) - Exocentric` / `(Rpi Cam) - Egocentric` | Gaze Window, Live Feedback |
| **Meta Quest 3 VR Teleop** | Meta Quest 3 + PC on same Wi-Fi | 1. `RUN DEV SETUP (REAL)` with the card `VR Quest 3 Teleop` ticked | WebXR (`https://<IP>:8443`) |

*`RUN DEV SETUP` is the start popup and – since the full page `/old_index.html` was removed – the only view of the Nexus Webapp (see 7.3).*

---
<br>


### 7.1 Step 1: Hardware Preparation
1. **Turn on the Robot:** Power on the UFactory xArm Lite 6 and ensure the emergency stop is released.
2. **Connect the Controller:** Turn on the Xbox One Elite Series 2 Controller and ensure it is connected to the host PC via Bluetooth or USB.

---
<br>


### 7.2 Step 2: Launch the System (Nexus Webapp)
Normally in robotics, multiple terminals must be opened to execute a multitude of long `ros2 run` or `ros2 launch` commands in parallel to start the individual nodes. The **Nexus Webapp** was built precisely to solve this problem: Instead of memorizing complex CLI commands, all required nodes and launch files can be conveniently started with a single click directly from the browser. The bringup sections: **AUTOMATED SYSTEM BRINGUP** (`RUN DEV SETUP (FAKE)` / `(REAL)`, local single-PC development), **EXTRAS EXECS** (DEV + Gaze UI, Egocentric / Exocentric), **Start Multimodal Setup** (the actions of DEV SETUP FAKE / REAL as individual cards) and **Client / Server Control Bringup** (distributed execution across an operator PC and a robot PC). The background startup sequences have been highly optimized: Base nodes and MoveIt Servo boot with a 1-second interval, while the ROS Bridge and Web UI boot last. This structured startup order strictly prevents WebSocket crashes and startup race conditions.

**Quick Launch (recommended):**
```bash
./ros2_nexus/ros2_nexus_web_start.sh
```
The script checks Flask, sources ROS 2 Humble and the workspace, starts the Nexus Web Backend (Flask, port 8080) unless it is already running, and opens the Nexus Webapp: as a frameless WebKitGTK window (`ros2_nexus_popup_window.py`, centered, about 70 % × 95 % of the screen; needs `gir1.2-webkit2-4.0`), otherwise Chrome / Chromium in `--app` mode or the default browser. Keep the terminal open: closing the Nexus window also stops the backend and the terminal, and closing the terminal stops the backend. If the backend crashes, the terminal stays open with the traceback.

**Start Page = Start Popup:** `http://localhost:8080/` only shows the start popup (RUN DEV SETUP with the FAKE | REAL switch, see 7.7). In the frameless window you drag the window by the popup header, a double-click on the header maximizes it and the popup's X closes the app; in a normal browser tab, closing the popup (X, Cancel, Esc) brings it back. The environment sits in one line below the title (user @ host, IP, domain, RMW, DDS scope, LAN traffic); **Details** or the arrow on the right of the popup header opens the full network bar (network interface, traffic sparkline, the DDS *Localhost only* switch, scope with guide link); the state is stored in the browser (collapsed by default).

**Launch via Terminal (backend only):**
```bash
cd ~/dev_ws
python3 ros2_nexus/ros2_nexus_web.py
# → Opens at http://localhost:8080 (accessible in LAN, e.g., http://192.168.x.x:8080)
```
*Runtime view: every card shows its state (running / waiting / ready / exited with exit code), and a log drawer per card shows the last output lines (WARN / ERROR filter, open the file, *Follow in terminal*; logs in `~/.ros/nexus_logs`).*

**Kill All ROS 2 Processes:** The **Kill Daemon** button in the popup toolbar runs `kill_ros2.sh` after a confirmation. It only stops processes of the own user with the same `ROS_DOMAIN_ID` as the Nexus backend (default 66) – test stacks in other domains stay untouched. Only real `ros2 run` / `ros2 launch` / `rviz2` processes count (program at the start of the command line): shells of Claude Code or VS Code, which run in domain 66 via `~/.bashrc` and often only contain such a command as text, are never hit. The script stops in stages: first SIGINT (like Ctrl+C, so launch files shut down their nodes; a process that ignores SIGINT gets SIGTERM right away), then SIGTERM, leftovers via SIGKILL - each stage waits up to 5 s for `ros2 run`, `ros2 launch` and `rviz2`. Then it closes the terminal wrappers of the started commands and stops the ROS 2 daemon of that domain (stale graph information); the backend then starts a fresh daemon with the same environment as the terminals (`ros2 daemon stop` + `start`, log entry *ROS 2 daemon restarted*). Afterwards Nexus reloads itself. *Stop all & quit* skips the new daemon. **Every sequence start (EXECUTE)** also restarts the daemon of the domain before the first step, with the *Localhost only* setting of the start – `ros2 node list` / `ros2 topic list` in the terminals never show stale nodes of a previous start (log entry *ROS 2 daemon – restarted in n s*).

**Quitting Nexus cleanly:** closing the Nexus window (X in the popup, Alt+F4) while starts are still running opens **Quit ROS 2 Nexus?** with the list of running starts: *Stop all & quit* (like Kill Daemon, then the backend ends), *Keep running & quit* or *Cancel* (Esc); with nothing running the window closes at once (`POST /api/quit`). Additionally the backend stops its own background starts on SIGTERM / SIGHUP / Ctrl+C (INT → TERM → KILL) – closing the window or its terminal no longer leaves orphans that block ports and the ROS domain at the next start.

**Ubuntu App Integration (One-Click Installer):** Both the **Nexus Webapp** and the **Robot Control UI** can be registered as native Ubuntu applications with custom high-resolution icons. The Nexus entry runs `ros2_nexus_web_start.sh` in a terminal (frameless window, see above), the Robot Control UI entry opens its own Chrome `--app` profile. Simply run the automated installer script:
```bash
cd ~/dev_ws/ros2_nexus && bash install_app.sh
```
This automatically configures the paths, copies desktop shortcuts to `~/.local/share/applications/`, and updates the desktop database. Afterwards, you can launch the Nexus Webapp (menu entry **"ROS 2 Nexus"**) and **"Robot Control UI"** directly from the Ubuntu Activities application menu or pin them to the Ubuntu dock.

---
<br>


### 7.3 Step 3: Start Nodes via GUI
Everything is started from the start popup (7.2, 7.7): tick the cards of a sequence and press **EXECUTE**, or start a single card. The former full page `/old_index.html` with its tab bar and the single buttons of all sections was removed on 2026-09-28 – nodes outside the sequences (e.g. Isaac Sim, the old dashboard) are started in a terminal (commands in the respective chapters).

1. **Start in the backend:** EXECUTE hands the whole sequence to the backend, which waits for readiness after infrastructure steps (MoveIt/Servo, rosbridge, Cameras + YOLO: node `/virtual_object_detections` - up even without a connected/selected camera, ZED alone: `/zed/*`, VLA, Whisper / voice listener: node `/whisper/inference`, Monitoring Dashboard: HTTP answer on its port, Touch Panel: its kiosk window) instead of fixed pauses. Own rules per card go into `launcher_config.json` as `"__ready": {"<part of the command>": {"nodes": ["/my_node"], "timeout": 60}}` (also `node_re`, `http`, `proc`; `{}` switches the check off) - they win over the built-in ones and are read at every sequence start. **Required cards:** before EXECUTE starts, the popup checks what the active cards need (VLA-M: MoveIt Servo/MoveGroup and the Robot Control UI, in REAL also Cameras + YOLO; Voice Command Listener: Whisper; grasp executors: cameras; VR teleop: MoveIt Servo). A need counts as met by an active card or a start that is already running. If something is missing, a yellow row above the footer names it with the reason: *Add … & start* ticks the card(s) and starts, *Start anyway* starts without, *Back* returns. A progress line sits above the popup footer; the sequence keeps running when the window closes. Each active card starts in its own terminal; closing a terminal ends its launch cleanly (like Ctrl+C). If a Nexus launch still runs without a terminal (orphan), EXECUTE stops it and starts it again in a terminal instead of skipping it as "already running".
2. **Runtime state and logs per card:** running / waiting / ready / exited with exit code; log drawer with WARN / ERROR filter, *open file*, *Follow in terminal* (`~/.ros/nexus_logs`) and **Restart** (`POST /api/run/<id>/restart`: stops the command like Ctrl+C - SIGINT, then SIGTERM/SIGKILL - and starts it again with the same command, title and localhost setting; while it is still running the button asks first, second click confirms). **Error hint:** the backend counts ERROR/FATAL/Traceback lines in the log of every running start (every 15 s); the state chip then shows a red `N ERROR` badge (tooltip with the last line), the console gets a **LOG** entry and the Touch Panel a toast (at most every 5 min per start). A start that ends with an exit code other than 0 / Ctrl+C / kill shows a toast in the popup and in the Touch Panel. Logs are capped: a running log above 50 MB is cut to its last 20 MB (marker line at the top, **LOG** warning in the console; the Touch Panel shows it as a toast and in its log), the folder stays below 2 GB (oldest first, never logs of running starts). Change via `NEXUS_LOG_FILE_MAX_MB` / `NEXUS_LOG_DIR_MAX_MB` (`0` = off). ROS' own logs in `~/.ros/log` are not touched.
3. **Deep links:** `http://<host>:8080/#start-<term>` opens the start popup and marks the matching card (e.g. `#start-http_robot_control_ui`).
4. **Launch structure & parameters:** the *CMD* view of each card breaks the launch tree down into sub-launches, nodes and parameters; value parameters can be edited before the start (see 7.7).
5. **Stopping:** a single card stops gently (INT → TERM → KILL); **Kill Daemon** stops all ROS 2 processes (7.2).
6. **REAL / FAKE kept apart:** the linear axis exists only in the simulation. The backend never starts a REAL command (`lite6_moveit_servo_realmove`, MoveGroup with `robot_ip:=`) with `attach_to:=linear_axis_link`, and blocks a REAL start while a FAKE stack (`lite6_moveit_servo_fake`, FAKE MoveGroup, `fake_linear_axis`) is still running – and vice versa. The card shows the reason (stack + PID); stop the other stack first.
7. **Config backups:** before each save the previous state (`launcher_config.json` + this computer's selections from `launcher_state.json`) is copied to `~/.config/ros2_nexus/backups` (last 20) – only when the content changes, at most every 10 min, but always when the new state is much smaller or whole sections are missing (typical for an accidental overwrite by a test or an old tab). Test instances with `NEXUS_CONFIG` back up next to their copy. In the start popup the **Backups** button (toolbar next to *Setup - Info Card*) opens the list between header and cards: time, age, number of sections and size, newest first; *Restore* asks in the row (Esc = cancel), then reloads the page (only on the Nexus PC itself - elsewhere the button is disabled and says why). By command line: list `curl http://localhost:8080/api/config/backups`; restore (local only, saves the current state first): `curl -X POST -H 'Content-Type: application/json' -d '{"name": "launcher_config_<date>.json"}' http://localhost:8080/api/config/restore`, then reload the Nexus Webapp and Touch Panel – an open tab would otherwise write its old state back.
8. **Terminals switch:** the *Terminals* switch on the right of the *Components* row turns the terminal windows on Execute on or off (global, for all popups, sequences and the Touch Panel; stored in `~/.config/ros2_nexus/settings.json`, API `GET/POST /api/settings` `{"open_terminals": false}`). Off: cards in mode `ros` start without a gnome-terminal, with the same ROS environment (domain, RMW, Localhost only, `install/setup.bash`); output only in the log drawer (`~/.ros/nexus_logs`, *Follow in terminal* shows it live), stop with *Stop* / *Restart* / *Kill all ROS 2* instead of Ctrl+C. Interactive commands (mode `interactive`) always open their terminal; browser windows are not affected. The switch applies from the next start; *Restart* decides again.

---
<br>


### 7.4 Network & Port Architecture

<p align="center"><img src="../img/diagrams/network_ports.svg" width="100%" alt="Network and port architecture"></p>

*Network and port architecture · source: `tools/make_diagrams.py`*

**Ports in one place:** all ports live in `config/network.yaml` under `ports:` (`nexus`, `robot_control_ui`, `web_video`, `monitoring`, `vr_https`, `rosbridge`, `rosbridge_ssl`). The Nexus Webapp (`NEXUS_PORT` still wins), the launch files of the Robot Control UI (web server, rosbridge, video server), Monitoring Dashboard and VR teleop read them via `dev_ws_network.port()`; the Robot Control UI server and the Touch Panel put them into the page as `window.DEV_WS_PORTS`, so the browsers build their rosbridge URL and links from them (`/api/network` also returns `ports`). A missing entry falls back to the standard below. `tools/check_ports.py` (CI and pre-commit) checks that each port is valid and used only once and that no JavaScript builds a `ws(s)://` URL with a fixed port. After a change: restart the affected cards and check the firewall (`tools/firewall_setup.sh`); hint texts and this documentation keep naming the standard ports.


To run the complete system with both web interfaces (Nexus and Dashboard), multiple services operate on separate ports:

<details>
<summary><b>🔽 Show table</b> · 10 ports · 8080 · 8081 · 8082 · 8083 · 8443 · 8554 · 9090 · 9091 · xArm · DDS</summary>

| Port | Protocol | Service / Component | Description |
| :--- | :--- | :--- | :--- |
| **`8080`** | HTTP (Flask) | **Nexus Webapp** (backend) | *Central process manager & web console.* |
| **`8081`** | HTTP | **Robot Control UI** | *Standalone web app for remote robot control (jogging, telemetry, YOLO grasp).* |
| **`8082`** | HTTP / MJPEG | **Web Video Server** | *Video streaming of camera and RViz window feeds to the web.* |
| **`8083`** | HTTP | **Monitoring Dashboard** | *System, ROS 2 graph, robot usage, sessions & evaluation.* |
| **`8443`** | HTTPS | **WebXR VR Server** | *Meta Quest 3 3D browser interface.* |
| **`8554`** | RTSP | **Tobii Glasses 3 Stream** | *Video & JSON gaze data (Wi-Fi `192.168.75.xxx`, Ethernet `192.168.100.xxx`).* |
| **`9090`** | WS (WebSocket) | **ROSBridge Server** | *Telemetry & service bridge for Web UIs.* |
| **`9091`** | WSS (Secure WS)| **ROSBridge Secure** | *Encrypted WebSocket connection for WebXR.* |
| **`502 / 7000`** | TCP/IP | **xArm Lite 6 Controller** | *Modbus TCP & hardware control interface.* |
| **`23900+`** | UDP | **CycloneDDS Discovery** | *Discovery & data exchange in the local subnet. Derived from the domain: `7400 + 250 x ROS_DOMAIN_ID`, so `ROS_DOMAIN_ID=66` yields 23900 (discovery) and 23910+ (unicast).* |

</details>

**Network addresses (`config/network.yaml`):** one file for the robot IP (REAL), the IP cameras and the Tobii glasses – read by nodes, web UIs and the Nexus Webapp via the package `dev_ws_network` (`net_get('ip_cams.cam1')`). Environment variables such as `TOBII_IP` or `QUEST_IP` still take precedence; after a change restart the affected nodes and servers (no build needed). **Tobii:** the address depends on how the glasses are connected – `tobii.connection: auto` (default) picks `wlan_ip` (192.168.75.xxx, the glasses' own WLAN) or `lan_ip` (192.168.100.xxx, Ethernet), whichever network this PC is currently in; `wlan` / `lan` pin it. A `tobii_ip` saved in the Nexus gaze card still overrides it (TODOS N17).

**Why strict port separation?** Ports 8081 and 9090 serve fundamentally different purposes and protocols. Port 8081 (HTTP) acts as a standard web server to deliver the static UI files (HTML/CSS) to the browser. Port 9090 (WebSocket via `rosbridge`) is a highly specialized data broker that exclusively streams live ROS telemetry and lacks the capability to serve web pages. Port 8080 (Flask) provides Nexus Web Backend business logic independent of ROS.

#### 7.4.1 Nexus Web Backend Architecture

<p align="center"><img src="../img/diagrams/nexus_backend.svg" width="100%" alt="Nexus Webapp backend"></p>

*Nexus Webapp backend · source: `tools/make_diagrams.py`*

The Nexus Webapp (Port 8080) acts as the central command orchestrator. It is built on a Flask (Python) backend and operates completely independently of the ROS 2 network. Its primary function is to interpret button clicks from the web interface and spawn native OS subprocesses (such as `gnome-terminal -- ros2 launch ...`). Because it directly interacts with the host operating system to manage terminal instances and process IDs, it must run natively on the host machine.

#### 7.4.2 Dashboard & Control Web UI Architecture

**Native ROS 2 Server vs. Static Python Web Server:**
- **Native ROS 2 Server (`ros2 run web_video_server ...`):** This is a native C++ ROS 2 node. It must hook directly into the ROS network (subscribing to topics via `image_transport`) to receive raw camera images, compress them in real-time (e.g., as an MJPEG stream), and then serve them via HTTP. Because it directly processes ROS data in the backend, it must run natively as a ROS 2 node.
- **Static Python File Server (`server.py` for 8081):** In contrast, the Robot Control UI (`http_robot_control_ui_p8081`) is a pure frontend web application (HTML, CSS, JS). The Python backend serving these files does *not* speak ROS; it is a lightweight, standard "dumb" file server that merely hosts the directory so the browser can access it. All actual ROS communication happens exclusively *in the browser of the client* (using JavaScript and `roslibjs`) via the WebSocket on Port 9090. This separation ensures the backend remains simple, without requiring complex ROS dependencies for UI hosting.

---
<br>


### 7.5 Remote Control (Server-/Client Communication)

The robot PC is the **server**: it runs ROS 2, the arm and the Nexus Webapp; the card *Robot Control UI, WebSocket & Video Server* also starts rosbridge, the web server and `remote_control_watchdog`. **Clients** are browsers on a laptop, tablet or Quest 3 – nothing to install. Setup, firewall rules, the Remote Control panel and error patterns are covered step by step in the [manual](../operate_manual.html) (chapter *Server/Client-Steuerung*).

| Client | URL | Taking control |
|---|---|---|
| Robot PC itself | App window `127.0.0.2:8081` (opens on start) | Holds control after start; gamepad via `joy_node` |
| Laptop / tablet, mouse or touch | `http://<server-IP>:8081` | *Request control* (or the first motion attempt) → server approves |
| Laptop with gamepad | `https://<server-IP>:8443` – browsers only expose the Gamepad API over HTTPS; the *VR Quest 3 Teleop* card provides 8443/9091 | Take control → REAL: *Arm gamepad* → tick *Remote gamepad* |
| Quest 3 (VR) | `https://<server-IP>:8443` (USB: `https://localhost:8443`) | VR motion passes the same lock as UI buttons |
| Second PC with ROS | Nexus *client* sequence, UI card with `connect_to:=<server-IP>` | Own RViz / `joy_node` / voice nodes via DDS (see below) |

<img src="../img/rcu_remote.png" width="340" alt="Robot Control UI – area Remote Teleop, Remote Control">

*Client side in the Robot Control UI (area **Remote Teleop › Remote Control**): mode chip FAKE and location *This PC (server)*, control owner *Server (you)* with **Release control**, remote gamepad with max. speed, connected clients and the addresses for the home network (Control UI 8081, VR/HTTPS 8443, Touch UI 8080/touch).*

**Rules enforced by the watchdog (server side):**
- **One owner:** exactly one client has control; all others are viewers (motion locked, E-stop always works). The owner presses *Release*; other clients press *Request control*; only the server PC can *Take over* directly (with confirmation).
- **Approval on the server:** every client except the robot PC itself needs approval. Its request opens an **Allow / Deny** popup in the Robot Control UI on the robot PC; unanswered requests expire after 60 s. The Touch Panel (`/touch`) asks the same way.
- **Heartbeat:** closing the tab or losing Wi-Fi stops the remote gamepad at once (timeout FAKE 1.0 s, REAL 0.4 s); control is freed after 10 s.
- **REAL limits:** max speed 50 % (FAKE 100 %) and, with `real_require_arm`, an explicit *Arm gamepad* that expires after 60 s without input and on every mode change. The values live in the Nexus Webapp (card parameters *Remote Access* / *Remote Safety*) and apply after restarting the card.
- **Command path:** browser gamepad → `/remote/joy` → watchdog (owner, heartbeat, arm, speed limit) → `/joy` → `teleop_pre_collision_checker` → MoveIt Servo – the same way as the local gamepad.
- **Jog (twist gate):** Cartesian and joint jogging of the Robot Control UI, the Touch Panel, the VR node and gaze control (`gaze_*_tobii_glasses`, own client, kind `gaze`) go to `/remote/twist` / `/remote/joint_jog` (JSON with client id); the watchdog forwards to `/servo_server/delta_twist_cmds` / `delta_joint_cmds` only for the lock owner (or the verified server PC while it holds control), with a fresh heartbeat (≤ 1 s) and no latched E-stop. Floor guard as in the browser: downward motion is braked before the *Z Collision Level* (`/ui/ground_collision_level`, off with `/ui/moveit_collision_ground_enabled` = false), without a current TCP position (`/ui/eef_position`, ≤ 1 s) downward stays blocked. Remote clients jog at most at the mode's max speed; when the commands stop, a zero command follows. Without the watchdog there is no browser jog.
- **Server token:** whether a client is the server PC is no longer the self-reported `local` flag. On start the watchdog writes a secret to `~/.ros/remote_control/server_token_d<ROS_DOMAIN_ID>` (mode 0600); `server.py` (8081) hands it out in `/api/remote_info` only to callers from 127.x. The UI signs heartbeat and requests with it (HMAC-SHA256 over `id|action|target|ts`, at most 5 s old, `ts` increasing); the secret itself never goes over rosbridge. A tab that the watchdog does not accept as server logs a hint in the UI log (reload the page).
- **Reset E-stop:** browsers no longer call `/ui/reset_emergency_stop` themselves; they send `action: reset_estop` on `/remote/control_request`. The watchdog calls the service only for the lock owner and the server PC; the answer is in `control_state.results` (Touch Panel and VR headset therefore need control to reset).
- **Limit:** rosbridge knows no client identity; the watchdog treats the client id as the client's secret (see *Control lock on the server side*). Anyone who sniffs unencrypted traffic on port 9090 or reaches DDS in the LAN still sees full ids – protection against deliberate attackers is the firewall (below).

> [!CAUTION]
> **Home network only.** rosbridge (9090/9091) does not filter IP addresses – `tools/firewall_setup.sh --apply` lets in only the home network plus the robot/Tobii/IP-camera networks from `config/network.yaml` (show first without options, undo with `--undo`; after moving to another network run `--apply` again). No port forwarding in the router, and at the real arm someone always stays within reach of the hardware E-stop.
>
> **rosbridge whitelist** (`rosbridge:` in `config/network.yaml`): browsers may only publish the topics listed one by one (no `/ui/*`/`/remote/*` glob, so no node state topics such as `/ui/emergency_stop_active` or `/remote/control_state`), call the listed `/ui/…` services one by one and read/set three parameters via rosapi; no actions, no `/joy` (goes via `/remote/joy` → watchdog), no `/servo_server/delta_*_cmds` (jog goes via `/remote/twist` → twist gate), no `/ui/reset_emergency_stop` (goes via the watchdog). Subscribing stays open. Rejections appear in the rosbridge log as `No match found for …`; a new browser topic/service must be added there (restart rosbridge). Cost: one glob check per message, measured below 1 % of a CPU core at 600 msg/s. rosapi runs as `http_robot_control_ui_p8081/rosapi_node` (original plus a fix: a non-whitelisted parameter returns the default instead of crashing rosapi).
>
> **Control lock on the server side**: rosbridge does not know who is calling, and a client id can be copied. Only the network path is safe. So there are two whitelists. The full list (`rosbridge:`) applies only to `rosbridge_local` (port 9092, bound to `127.0.0.1`), which pages on the robot PC use (`http://127.0.0.1:8081`, Touch Panel on the robot PC). Pages opened over the network (laptop, tablet) use 9090 and the Quest uses 9091. Both get the smaller list `rosbridge.remote`. With it, remote clients can only jog, use the gamepad and do VR teleoperation through the watchdog, which checks the control lock. They can also stop (E-Stop, halt, `/vla/abort`). They cannot use MoveTo, the initial pose, VLA, the gripper buttons, the speed setting or collision/scene/TF changes (the Quest still switches the gripper through VR teleoperation, which checks the lock). **Client id as a secret:** the watchdog knows clients only by id, so `/remote/control_state` shows only short ids (first 8 characters) plus a SHA-256 of the full id (checked by the VR node and gaze control). On 9090/9091 the topics that carry the full id (`/remote/*` sent by clients, `/vr_teleop/controller_data`, `/ui/interaction_events`) cannot be subscribed (`topics_sub_glob`, built from `rosbridge.remote.topics_pub` minus `topics_sub_shared`). Because rosbridge checks the globs against the raw name and rclpy resolves relative names, `~` and `{ns}` only afterwards, all three bridges start through `rosbridge_guard.py` (`rosbridge_remote` for 9090/9091, `rosbridge_local` for 9092): they accept only absolute plain topic names (`/[A-Za-z0-9_/]+`). The watchdog ignores ids shorter than 32 characters and new ids whose short id is already taken (a signed server heartbeat displaces such a squatter); a client that drops out of the list after 15 s keeps its short id reserved for 10 min, only the same full id can take it back; the Monitoring Dashboard stores only short ids. **Origin check:** `rosbridge_local` (9092) accepts only pages from `127.x`/`localhost` on ports 8081, 8080 and 8443 (programs without an `Origin` header stay allowed), so a foreign web page in the browser on the robot PC cannot use the full list. Without `dev_ws_network` both launch files stop instead of starting rosbridge without a whitelist. The Robot Control UI and the Touch Panel block these buttons there with a message (`ROS_LOCAL` in `js/ros.js`), because rosbridge does not answer rejected service calls.

#### Second PC with ROS: preparation on both machines
The ROS 2 DDS traffic must be explicitly allowed to broadcast across the local network. If `ROS_LOCALHOST_ONLY=1` is set in your `~/.bashrc`, the host and the client will **never** discover each other.
Execute the following in **every** terminal before launching nodes:
```bash
export ROS_DOMAIN_ID=66
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
export ROS_LOCALHOST_ONLY=0
source ~/dev_ws/install/setup.bash
```


### 7.6 DDS Multicast Storm Prevention & Loopback Discovery (Critical)
> [!CAUTION]
> **Internet Disconnects & Network Overload:** By default, ROS 2 DDS implementations use "UDP Multicast", which broadcasts all data to the entire local network (LAN/WLAN). When the ZED camera and YOLO are started, this floods the network with gigabits of UDP packets. **This usually causes the router to crash or the PC's internet connection to disconnect immediately.**
>
> To prevent this and boost system performance (provided you are **not** using the remote control from 7.5!), the ROS 2 traffic **must** be strictly restricted to your own PC (Localhost):
> ```bash
> echo "export ROS_LOCALHOST_ONLY=1" >> ~/.bashrc
> source ~/.bashrc
> ```
>
> **Loopback Discovery Error:** Setting `ROS_LOCALHOST_ONLY=1` forces traffic onto the internal loopback interface (`lo`). **However, Ubuntu disables multicast on this interface by default after every reboot**. This causes CycloneDDS to crash with `Failed to find a free participant index` because nodes cannot discover each other internally.

To fix this permanently, set up a systemd service that automatically enables multicast on the `lo` interface on every boot:

```bash
# 1. Create the file cleanly
sudo bash -c 'cat > /etc/systemd/system/lo-multicast.service <<EOF
[Unit]
Description=Enable Multicast on Loopback interface for ROS 2
After=network.target

[Service]
Type=oneshot
ExecStart=/sbin/ip link set lo multicast on

[Install]
WantedBy=multi-user.target
EOF'

# 2. Reload systemd, enable the service, and start it immediately
sudo systemctl daemon-reload
sudo systemctl enable lo-multicast.service
sudo systemctl start lo-multicast.service
```

**Alternative without `sudo` (`ros2_nexus/cyclonedds.xml`):** Where you cannot enable multicast on `lo`, the participant limit itself can be lifted instead. Without multicast CycloneDDS falls back to unicast discovery, where `MaxAutoParticipantIndex` (default 9) caps a domain at roughly eight participants - the xArm servo launch alone brings twelve nodes, so everything started afterwards dies. `ros2_nexus/cyclonedds.xml` raises that cap, and the Nexus Webapp exports `CYCLONEDDS_URI` for it automatically (the generated scripts do source `~/.bashrc`, but that returns early in non-interactive shells, so the variable would never arrive). For plain terminals, add this to your `~/.bashrc` - ideally at the very top, next to the other ROS variables:

```bash
[ -f "$HOME/dev_ws/ros2_nexus/cyclonedds.xml" ] && \
    export CYCLONEDDS_URI="file://$HOME/dev_ws/ros2_nexus/cyclonedds.xml"
```

> Note that this only raises a limit - it does not restore multicast. The systemd service above remains the better fix; use the config where you have no root access.

---
<br>


### 7.7 Launcher Configuration (`launcher_config.json`)

The buttons, categories, and commands in the Nexus Webapp are fully customizable.

**Interactive Drag & Drop:** The Nexus interface features a highly responsive, persistent 3-column drag & drop system. Individual action buttons can be freely arranged within their sections. Entire category sections can be seamlessly distributed across three vertical columns. Layout changes are immediately saved in the backend.

**Hierarchical Launch Inspection:** Every action button in the Nexus Webapp features an interactive [CMD] indicator. Clicking the button opens a detailed modal that visually breaks down the exact hierarchical structure of the target launch file. This accurately mirrors deeply nested sub-launches and individual nodes (e.g., `ros2_control_node`, `spawner`, `robot_state_publisher`). A global 'Select All' checkbox enables quick toggling of all main components within the sequence. Dynamic launch arguments are displayed as interactive checkboxes right next to the corresponding launch files, allowing for intuitive, real-time parameterization before execution. **Furthermore, the action cards within these popups support persistent drag-and-drop sorting, allowing users to customize their execution order. By default, all actions are enabled (`active: true`). Any user checkbox selections and parameter chip adjustments (such as YOLO model selection or hardware toggles) are automatically and persistently saved per card in both `localStorage` and `launcher_config.json`, and restored every time the popup card is opened or the page is refreshed.** Launch arguments whose default is `true` are appended explicitly as `:=false` when unchecked (`rviz:=true`), otherwise the launch default would still apply. The **Speech Control** card shows a **Whisper CPU | GPU** slide switch instead of parameter chips: clicking the track toggles it, clicking either side label selects that side directly, and arrow keys, Space or Enter operate it from the keyboard. The start always appends `use_gpu:=true` or `use_gpu:=false` (the CPU-mode card starts on CPU, each card remembers its own choice). The ineffective `silero_vad_use_cuda` argument is no longer offered.

**Card hints (i):** Right next to the title of every card sits an **(i)** button. Hovering (or keyboard focus) shows a popup with short hints for that card – e.g. which URL to open, what REAL/FAKE means, how many parameters it has. Cards with ports also show the firewall rule for the home network; clicking **(i)** copies that `ufw` command. The texts live in `CARD_HINTS` in `ros2_nexus/js/card_hints.js`; cards without an entry get general hints from their command.

**Zoom:** − / + in the popup footer (or Ctrl + / Ctrl − / Ctrl 0) scale the whole app – header, list, details and footer – in 10 % steps from 70 to 150 % (saved in the browser); the window keeps its size, clicking the percentage resets to 100 %.

**Sequence Popups (RUN DEV / SERVER / CLIENT SETUP):**
- **FAKE | REAL switch** in the popup header switches between the FAKE and REAL sequence (DEV and SERVER).
- **List + details:** on the left a compact list of all cards, each category as its own block (checkbox = start with EXECUTE, title, node count or run state such as *Running*, *Waiting for …*, *Exited · code 1*; the launch file is in the tooltip), on the right the marked card with everything (parameters, launch structure, config files, command, log). Click or arrow keys ↑ ↓ / Home / End select; the selection is stored per popup in the browser. Click a category block to tick / untick it (and show its card); drag the block (from 3 px movement on) to reorder, or focus its grip ⋮⋮ and press ↑ ↓ (saved like before; the list is always sortable, the *Layout locked* switch is hidden in this view). The launch structure shows each entry as type badge + name with the description below; sub-launches collapse with their arrow. Search, filter *All / Active / Inactive*, *Select all* and deep links `#start-<term>` act on list and card together. Below 820 px popup width list and details stack and scroll together.
- **Check (preflight):** the *Check* button left of EXECUTE tests what the ticked cards need, without starting anything (~1 s, `POST /api/preflight`, `ros2_nexus/nexus_preflight.py`): robot reachable (REAL only, `robot_ip:=`), IP cameras / ZED on USB / Tobii, ports of the cards free (a port used by a running Nexus start counts as fine), no second `move_group` / motion handler in the same ROS domain (they cause IK and controller errors), *Localhost only* vs. server/client, GPU memory for ZED + YOLO / Ollama / Whisper, free disk space, and for the VLA-M card the language model (Ollama and the model from `llm_model:=` installed? If not: warning with `bash src/vla_bridge/scripts/install_ollama.sh` – the chat cannot plan, one-click *Grasp* / *Place here* still work). The result sits as a list above the footer, deviations first, each row with cause and fix and, where it helps, a button (*Stop stack* / *Stop process*, *Setup card*, *Kill Daemon*, *Details*). With more than one such row, ***Stop all leftovers (n)*** in the header stops all of them at once. *Stop stack* / *Stop process* ends the reported PIDs together with their `ros2 launch` and its nodes – otherwise `respawn=True` would restart the node at once (only your own processes in the same ROS domain; INT → TERM → KILL, a process that ignores SIGINT gets SIGTERM straight away, `POST /api/preflight/stop`) and then checks again. Each port row shows the origin as a badge with icon, plus the domain as a second badge: *Nexus* (environment variable `NEXUS_PID` of the starting backend, also for starts without a terminal), *Nexus · closed* (that backend no longer runs), *Claude chat*, *Terminal* or *Left over*. The stack check reports `move_group`, the motion handler, `ros2_control_node` and the servo container. Typical cause: a terminal window with several Nexus tabs was closed; Nexus then signals the process groups of the commands so no nodes are left behind (`HUP_GUARD_SH` in `nexus_runs.py`); checks the selection does not need are folded away, a changed selection marks the result as outdated. **In REAL, EXECUTE checks automatically:** an error stops the start (*Start anyway* / *Back*), warnings do not (a toast after the start names them). Tests: `ros2_nexus/test/test_nexus_preflight.py`.
- **Parameters per mode:** values that only act in the other mode are greyed out and never appended (FAKE: *REAL max speed / heartbeat / arm*, *REAL: execute plans / always confirm*; REAL: *FAKE max speed / heartbeat*); the tooltip says why. Cards with a recommendation show **Recommended for FAKE/REAL** at the top: *✓ … settings set* or *Apply … settings* with the differing values. The recommendation is set once when a FAKE/REAL sequence is opened for the first time (marker `__mode_presets` in `launcher_config.json`), afterwards own changes stay. Recommended: Servo stack *Gamepad + collision checker* and *Table plane* on; REAL additionally *arm before remote gamepad* on; VLA-M FAKE *Dry run* off, REAL additionally *execute plans* + *always confirm* on. The card **(i)** lists short FAKE/REAL hints (`MODE_PRESETS` / `MODE_HINTS` in `ros2_nexus/js/mode_presets.js`).
- **Eyetracker card:** mode `Real World` (`gaze_grasp_routine_tobii_glasses`) or `UI Gaze` (`gaze_control_ui_tobii_glasses gaze_ui`) - one card, exactly one mode.
- **VLA-M card:** own category *VLA-M (Vision-Language-Action)* in RUN DEV SETUP and SERVER SETUP, skipped until ticked. Parameters: *LLM* (`ollama` / `anthropic`), *Dry run*, *REAL: execute plans*, *REAL: always confirm* (model in the Config Files pane); REAL needs *execute plans* on (recommendation), otherwise *Execute* only shows the plan; the node starts `ollama serve` itself (install once: `bash src/vla_bridge/scripts/install_ollama.sh`); details in [VLA-M](vla.html).
- **Touch Panel card:** *Touch Panel (Touch-Display)* starts the kiosk on an extra touch display with EXECUTE when ticked (see [Touch Panel](robot_control_ui.html#touch-panel-nexus-webapp-touch)).
- **Value parameters:** launch arguments and node parameters with values (IPs, numbers, choices) appear as input rows with a source badge `CONFIG` (YAML), `ARG` (launch argument) or `PARAM` (node parameter). Only values that differ from the default are appended to the command, node parameters as `--ros-args -p`. The backend parses the launch arguments incl. included launches (`/api/launch_details`).
- **Config Files pane:** per card the YAML files the launch loads, with the important values and units, loaded / not loaded for the current arguments, overridden values struck through, status `Live` / `Copy` / `Build needed` / `Not built` (`install/` symlink vs. copy), all keys and a copy-path button.
- **Search & filter** over title, file, category or port, **Theme** (button *Dark / Light / Jarvis / Nord Blue ▾* in the footer left of the zoom or **Alt+T**: list with live preview, Enter apply, Esc cancel; also switches the page background around the popup; same list as Robot Control UI and Monitoring Dashboard, this browser only; its bottom row *Language DE | EN* switches the popup texts live, see [Robot Control UI](robot_control_ui.html)), and a **Localhost only** switch in the DDS bar (`ROS_LOCALHOST_ONLY=1` for this sequence).
- **Toolbar:** filter *All / Active / Inactive* with counters, drag & drop hint and the **Kill Daemon** button (see 7.2).
- **Help (footer):** the **ⓘ Setup info card** button (square icon button at the far right of the footer, right of the zoom; overview card for network & hardware setup: system overview clients → server → robot, IP assignment, web addresses, ports, touch display, HTTP/HTTPS for VR, VLA-M; **DE / EN** switch – the same card as in the Monitoring Dashboard, `ui_shared/net_info.js`; *Export as PDF* saves it in the Nexus app window directly as `~/Documents/Setup_<date>.pdf` (one A4 portrait page, light) and opens the file); footer button *Project docs* opens the project docs); directly left of it the square **Project docs** button (layer icon, tooltip on hover) opens the project docs `docs/project_docs.html` (`/ws/docs/project_docs.html`, new tab) – the single entry page to the operator manual, setup guide, setup card, poster and project pages.
- **Look:** the popup content renders at 80 % scale (browser popup `min(76vw, 1700px)` wide), custom 3D checkboxes (WebKitGTK drew the native tick huge and flat) and sequence cards with a stronger colored border, a subtle glow and depth.

<img src="../img/nexus_run_dev_setup.png" width="90%" alt="Nexus Webapp – RUN DEV SETUP (FAKE)">

*Start popup **RUN DEV SETUP** in FAKE: header with FAKE / REAL, DDS bar (user, IP, traffic, domain, RMW, *localhost only*, *Details*), search and filter *All / Active / Inactive*, *Backups*, *Kill Daemon*; left the components with node counts, right the selected card (*xArm Lite 6 – Base*) with launch file, parameters & args, launch structure and config files; footer with *Check*, **EXECUTE FAKE**, theme, zoom and the Setup info card.*

**Manual Configuration:** Cards, popups and commands are stored in `ros2_nexus/launcher_config.json` (in Git). Selections that change with every click (`__cmd_args`, `__popups_args`, `__popups_active`, `__cards_collapsed`) are saved per computer in `~/.config/ros2_nexus/launcher_state.json` (test instance: next to the `NEXUS_CONFIG` copy); `launcher_config.json` only keeps their old values as defaults for a computer without that file – no merge conflicts between laptop, lab PC and home PC. To manually add custom scripts or nodes, edit this JSON file. The WebApp loads the configuration dynamically – reloading the browser page is enough.

---
<br>


### 7.8 CycloneDDS UDP Buffer Overflows (Point Cloud Lag)
**Stuttering Pointclouds in RViz:** ROS 2 (especially CycloneDDS) transmits large payloads like Pointclouds (ZED Camera) by fragmenting them into many small UDP packets. The default Linux kernel network buffer size (~200 KB) is vastly insufficient for this. When the buffer overflows, the OS drops packets ("Receive Buffer Errors"), resulting in severe lag in RViz.

To resolve this issue and guarantee a smooth data stream, the system's UDP buffer sizes must be permanently increased to the maximum (2 GB):

```bash
# Temporary increase (takes effect immediately, resets on reboot):
sudo sysctl -w net.core.rmem_max=2147483647
sudo sysctl -w net.core.rmem_default=2147483647
sudo sysctl -w net.core.wmem_max=2147483647
sudo sysctl -w net.core.wmem_default=2147483647

# Permanent configuration (survives reboots):
echo -e "net.core.rmem_max=2147483647\nnet.core.rmem_default=2147483647\nnet.core.wmem_max=2147483647\nnet.core.wmem_default=2147483647" | sudo tee /etc/sysctl.d/60-cyclonedds.conf
sudo sysctl -p /etc/sysctl.d/60-cyclonedds.conf
```

<br>

### 7.9 🔧 Troubleshooting & Frequently Asked Questions (FAQ)

<details>
<summary><b>🔽 Show table</b> · 9 symptoms · likely root cause · diagnostic & solution</summary>

| Symptom / Error | Likely Root Cause | Recommended Diagnostic & Solution |
|---|---|---|
| **Robot does not respond (`Connection refused` / timeout)** | Subnet mismatch or physical controller box powered off. | Verify the xArm controller is switched on. Ensure your workstation network interface is configured with a static IPv4 address in the same subnet (e.g., `192.168.1.xxx`, netmask `255.255.255.0`). Verify connectivity using `ping 192.168.1.xxx`. |
| **Web UI displays "DISCONNECTED" (Red status indicator)** | `rosbridge_server` (Port 9090) is offline or blocked. | Check if the WebSocket bridge is active (`ros2 node list | grep rosbridge`; start it only via `ros2 launch http_robot_control_ui_p8081 http_robot_control_ui.launch.py`, never `rosbridge_server` directly: no whitelist). Inspect the browser developer console (F12) for WebSocket connection refusals. Ensure no local firewall blocks port 9090. |
| **Gamepad input does not move the robot arm** | Joy node assigned wrong joystick device or wrong mode. | Check whether the Xbox controller is recognized by Linux (`ls -l /dev/input/js*`). Test stick inputs using `jstest /dev/input/js0`. Verify MoveIt Servo is active (check `/servo_server/status`). |
| **Point cloud lags or freezes in RViz2** | Linux kernel UDP socket buffer overflow under high DDS throughput. | Execute the kernel buffer expansion commands detailed in [Section 7.8](#78-cyclonedds-udp-buffer-overflows-point-cloud-lag) (`sudo sysctl -w net.core.rmem_max=2147483647`). |
| **Robot motion stops abruptly / Servo refuses jogging** | Hard table barrier or Singularity collision guard engaged. | Check `/ui/collision_msg` for active boundary alerts. Inspect `/servo_server/status` codes (`0` = no warning, `1` = approaching singularity, `2` = halt: singularity, `3` = approaching collision, `4` = halt: collision, `5` = halt: joint bound). Drive the arm upwards using the LT trigger to clear the caution zone. |
| **Stereolabs ZED Mini camera fails to initialize** | Camera connected to USB 2.0 port or insufficient USB bandwidth. | Plug the ZED Mini strictly into a blue **USB 3.0 / 3.1** port directly on the PC motherboard (avoid unpowered USB extension hubs). Check detection via `lsusb` and `ZED_Diagnostic`. |
| **Voice command listener fails with missing IDL** | Custom ROS 2 IDL package not sourced in environment. | Execute `source install/setup.bash` in the terminal to expose the `whisper_idl/action/Inference` interface definition. |
| **A node started in a terminal is invisible to the web UIs (e.g. VLA-M stays `OFFLINE` while `vla_bridge` runs)** | Different DDS environment. The Nexus Webapp sets it per sequence with the **Localhost only** switch in the popup: on = `ROS_LOCALHOST_ONLY=1` + `CYCLONEDDS_URI=file://$HOME/dev_ws/ros2_nexus/cyclonedds.xml`, off = `ROS_LOCALHOST_ONLY=0` without URI. A plain terminal often differs. | Start the node from the Nexus Webapp or export the same variables first. Compare: `tr '\0' '\n' < /proc/$(pgrep -f rosbridge_websocket)/environ \| grep -E 'ROS_\|CYCLONE'`. |
| **Robot Control UI shows `Mode WAIT`, rosbridge RTT `–` and no robot in the twin although simulation and rosbridge run** | Orphaned duplicate `rosapi_node` processes from earlier sessions (same node name) or a second `move_group` – `/rosapi/nodes` calls hang. `rosapi_health` only restarts a hanging `/rosapi` of its own launch, not orphans – but it reports duplicates on `/diagnostics` (Touch Panel › System). | Kill the orphans by PID and restart rosbridge. Test: `ros2 service call /rosapi/nodes rosapi_msgs/srv/Nodes`. |

</details>

---

[⬅ Previous: Installation & Requirements](installation.html) · [🏠 Overview](../readme-en.html) · [⬆ Top](#top) · [Next: Operating Modes & Gamepad Teleoperation ➡](teleoperation.html)
