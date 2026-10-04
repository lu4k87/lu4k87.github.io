<a name="top"></a>

# 🗂️ Repository Structure

[🏠 Overview](../README.html) · [🇩🇪 Deutsch](../de/repository_structure.html) · Chapter 9

---

## 9. 🗂️ Repository Structure

```
dev_ws/
├── .claude/                                                               # Claude Code helpers only (not needed to run the robot)
│   ├── hooks/                                                             # Checks before a command and after each edit
│   └── skills/                                                            # Skills with their scripts, e.g. preview/ (capture.py screenshots, build.py spec → page), answer-page/ (answer → summary page)
├── _imgs/                                                                 # System screenshots, architecture diagrams & assets
│   ├── icons/                                                             # SVG icons of the Nexus Webapp cards (e.g. icon_vla.svg, icon_touch_panel.svg)
│   ├── robotsystem.jpg                                                    # Full system hardware setup overview
│   ├── ros2_nexus_web.png                                                 # Nexus Webapp preview
│   ├── ros2_nexus_web_popup.png                                           # Nexus script terminal output pop-up preview
│   ├── robot_control_ui.png                                               # Robot Control UI (Port 8081) preview
│   └── gaze_control_interface.png                                         # Tobii Gaze Eye-Tracking GUI preview
├── certs/                                                                 # SSL/TLS certificates for WebXR HTTPS servers
│   ├── cert.pem                                                           # HTTPS public certificate
│   └── key.pem                                                            # HTTPS private key
├── config/                                                                # Central settings (not a ROS package)
│   └── network.yaml                                                       # Robot IP, IP cameras, Tobii - read via dev_ws_network
├── docs/                                                                  # Documentation pages (overview: README.md / readme-de.md)
│   ├── project_docs.html                                                  # Project docs: one entry page for manual, setup card, poster, project pages (Nexus: /ws/docs/project_docs.html)
│   ├── project_manual.html                                                # Operator manual (German, self-contained HTML; Nexus: /manuals/project_manual.html)
│   ├── project_setup_guide.html                                           # Setup guide DE/EN: commissioning checklist, pre-installed PC or bare Ubuntu (/manuals/project_setup_guide.html)
│   ├── project_presentation.html                                          # Project presentation: interactive page on shared control, AI/VLA, vision, UI/UX, evaluation (images: img/presentation/)
│   ├── en/ · de/                                                          # 13 pages each: concept, installation, running, teleoperation, …
│   └── img/                                                               # Screenshots for the documentation
├── isaacsim/                                                              # NVIDIA Isaac Sim checkout, local per PC, not in Git (COLCON_IGNORE) + Lite 6 assets
│   ├── lite6_isaac_ros2.usd                                               # USD scene for xArm Lite 6 in Isaac Sim
│   ├── lite6_with_gripper.urdf                                            # Standalone URDF model with Lite 6 gripper
│   └── start_isaac_sim.sh                                                 # Isaac Sim ROS 2 launch script
├── models/                                                                # YOLO weights yolov8l.pt / yolov8s.pt / my_yolo_model.pt (selectable via yolo_model:=...)
├── poster/                                                                # A2 project poster (not a ROS package)
│   ├── poster_a2.html                                                     # Poster as a web page (420 × 594 mm, prints 1:1 on A2)
│   ├── poster_a2.pdf                                                      # Print-ready export (headless Chrome)
│   ├── make_preview.py                                                    # Renders the key visual poster_preview.svg / .png (needs google-chrome)
│   ├── poster_preview.svg / .png                                          # Key visual
│   └── img/                                                               # Screenshots (FAKE mode, 2026-09-28) & lab photo
├── ros2_nexus/                                                            # Central web launcher & desktop app integration
│   ├── ROS2_Nexus.desktop                                                 # Ubuntu application shortcut (.desktop entry)
│   ├── install_app.sh                                                     # Setup script installing the .desktop shortcut & icon
│   ├── kill_ros2.sh                                                       # Staged stop (SIGINT → SIGTERM → SIGKILL) of ros2 run/launch, rviz2 (own ROS_DOMAIN_ID only) & terminal wrappers, then stops the ROS 2 daemon
│   ├── cyclonedds.xml                                                     # Raises the CycloneDDS participant limit (unicast discovery)
│   ├── launcher_config.json                                               # Master process & button configuration for Nexus
│   ├── ros2_nexus_web_start.sh                                            # Starts the backend + Nexus window, closes both together
│   ├── ros2_nexus_web.py                                                  # Flask backend (port 8080): launches, config, /api/launch_details
│   ├── nexus_runs.py                                                      # Sequence start with readiness checks, run state, log files (capped: 50 MB/file, 2 GB)
│   ├── nexus_backups.py                                                   # Backups of launcher_config.json before each save (last 20)
│   ├── nexus_settings.py                                                  # Global switches (Terminals on Execute), ~/.config/ros2_nexus/settings.json
│   ├── nexus_preflight.py                                                 # Preflight check before EXECUTE: robot/cameras reachable, ports free, duplicate stacks, GPU, disk
│   ├── test/                                                              # Unit tests (logs, config backups), no ROS needed
│   ├── ros2_nexus_runs.js                                                 # Progress row, run state on the cards, log drawer, deep links
│   ├── ros2_nexus_backups.{js,css}                                        # Button "Backups" in the start popup: list and restore config backups
│   ├── ros2_nexus_web.html                                                # Nexus Webapp start page (start popup only)
│   ├── ros2_nexus_popup_window.py                                         # Frameless WebKitGTK window for the start popup
│   ├── ros2_nexus_styles.css                                              # Nexus responsive stylesheet
│   ├── ros2_nexus_script.js                                               # Core frontend process manager & log viewer
│   ├── js/                                                                # ES modules of the frontend (entry main.js): parameters, console, sequence popup
│   └── vendor/                                                            # Fonts, Font Awesome & roslib, served locally (/vendor/…)
├── sounds/                                                                # Acoustic notification & TTS feedback audio files
│   ├── _voice_blue_cube.mp3 / _voice_green_cylinder.mp3 ...              # Pre-rendered voice feedback for objects
│   └── ui_mouse_click.mp3                                                 # UI click sound effect
├── src/
│   ├── gaze_control_ui_tobii_glasses/                                     # 👁️ Python: PyQt5 gaze selection & calibration UI
│   │   ├── gaze_control_ui_tobii_glasses/gaze_ui_core.py                 # Shared core: buttons, dwell, gaze mapping, servo
│   │   ├── gaze_control_ui_tobii_glasses/gaze_ui_node_tobii_glasses.py    # Gaze UI (`gaze_ui`)
│   │   └── gaze_control_ui_tobii_glasses/gaze_ui_node_tobii_glasses_zedm.py # Gaze UI with the ZED M image (`gaze_ui_zedm`)
│   ├── gaze_grasp_routine_tobii_glasses/                                  # 👁️ Python: Tobii eye-tracking gaze-to-3D grasp routine
│   │   └── gaze_grasp_routine_tobii_glasses/gaze_grasp_routine_tobii_glasses.py # Dwell-time selection, homography localization, grasp
│   ├── dev_ws_network/                                                    # Python: net_get() for config/network.yaml (nodes, web UIs, Nexus)
│   ├── http_monitoring_dashboard_p8083/                                        # 📈 Python/JS: Monitoring Dashboard (port 8083) – system, usage & evaluation
│   │   ├── http_monitoring_dashboard_p8083/monitoring_server.py                     # Web server + JSON API + ROS 2 monitor (graph, topic rates, usage, sessions)
│   │   ├── http_monitoring_dashboard_p8083/store.py                            # SQLite store (minute averages, motions, sessions, events) + 1-h ring buffer
│   │   ├── index.html · js/ · css/                                        # Web UI (views: overview, system, processes, ROS 2 graph, topics, usage, evaluation)
│   │   └── launch/monitoring_dashboard.launch.py                               # ros2 launch … port:=8083 open_browser:=true db:=…
│   ├── http_robot_control_ui_p8081/                                       # 🎮 HTML/JS: Standalone Robot Control & Jogging Web UI
│   │   ├── index.html                                                     # Robot control interface (Port 8081)
│   │   ├── vr_mirror.html                                                 # PC window mirroring the Quest 3 view
│   │   ├── install_desktop_icon.sh                                        # Installs the Robot Control UI icon & .desktop entry
│   │   ├── js/                                                            # ES modules (main.js, ros.js, jog.js, motion.js, sequence.js, sandbox.js, remote.js, hud_dock.js, config.js …)
│   │   │   └── twin/                                                      # digital_twin.js (three.js twin), xr*.js (VR viewport, HUD, mirror)
│   │   ├── lib/                                                           # three.js r186, urdf-loader & Rapier physics (vendored, offline-capable)
│   │   ├── http_robot_control_ui_p8081/server.py                          # Web server port 8081 (no-cache + automatic ?v=)
│   │   ├── http_robot_control_ui_p8081/rosapi_health.py                   # Restarts a hanging /rosapi of the same launch (respawn)
│   │   ├── http_robot_control_ui_p8081/rosapi_safe.py                     # rosapi_node wrapper: whitelisted params without crash (N20)
│   │   └── roslib.min.js                                                  # ROS 2 web bridge client library
│   ├── web_video_server/                                                  # 📹 ROS 2 HTTP/MJPEG streaming bridge (Port 8082)
│   │   ├── CMakeLists.txt
│   │   ├── package.xml
│   │   └── launch/web_video_server.launch.py                              # Launches web_video_server & window_x11_streamer
│   ├── robot_vision_cameras_bringup/                                      # 🌟 Vision pipeline, TF calibration & grasp execution
│   │   ├── action/
│   │   │   └── GraspObject.action                                         # ROS 2 action definition for autonomous grasping
│   │   ├── config/
│   │   │   ├── grasping_params.yaml                                       # Hover height, Z offset, orientation, IK tolerances, speed scaling
│   │   │   ├── perception_params.yaml                                     # YOLO model, confidence threshold, EMA smoothing, class overrides
│   │   │   └── zed_override.yaml                                          # ZED camera overrides (HD720, NEURAL depth, 10 m range)
│   │   ├── launch/
│   │   │   ├── robot_vision_cameras_bringup.launch.py                     # Primary all-in-one vision & grasping launcher (ZED-M / IP Cam)
│   │   │   └── zed_cam_eef_rviz_octomap_yolo.launch.py                    # Hand-eye end-effector camera & OctoMap launcher
│   │   └── scripts/
│   │       ├── pointcloud_optimizer.py                                    # NaN-free cloud for OctoMap + thinned web cloud for the twin
│   │       ├── yolo_3d_bbox_for_zed_m.py                                  # YOLO 2D detections projected to 3D pointcloud clusters
│   │       ├── yolo_3d_bbox_for_ip_cam.py                                 # IP webcam homography 3D object localization
│   │       ├── yolo_moveit_collision.py                                   # Dynamic MoveIt collision object publisher
│   │       ├── yolo_planned_grasp_executor.py                             # 3-phase grasp sequence (GraspObject action server)
│   │       ├── yolo_grasp_executor.py                                     # Fallback: direct Cartesian grasp via /ui/execute_move_to_pose
│   │       ├── grasp_action_bridge.py                                     # Bridge /ui/grasp_object_cmd (topic) → GraspObject action
│   │       └── virtual_object_detections.py                               # Virtual scene objects (Cube, Rectangle, Cylinder + 5 grasp items) as detections
│   ├── remote_control_watchdog/                                           # 🔒 Python: server side of the client/server control
│   │   ├── launch/remote_control_watchdog.launch.py                       # Included by http_robot_control_ui.launch.py
│   │   └── remote_control_watchdog/remote_control_watchdog.py             # Control lock, approval, heartbeats, REAL/FAKE limits, remote gamepad → /joy
│   ├── robot_blackbox_recorder/                                           # Python: last 60 s of key topics, saved as rosbag2 on E-Stop / servo halt / collision
│   ├── robot_motion_handler_movegroup/                                    # 🤖 Python: Central MoveGroup Cartesian & Joint planner
│   │   ├── launch/standalone_move_group.launch.py                         # MoveGroup included by both MoveIt Servo launches
│   │   └── robot_motion_handler_movegroup/
│   │       ├── robot_motion_handler_movegroup.py                          # UI motion services, collision-aware MoveTo, MoveIt progress
│   │       └── moveit_floor_collision.py                                  # Table surface as MoveIt collision object (toggleable)
│   ├── ros2_whisper/                                                      # 🎙️ Whisper AI voice-to-text inference node
│   ├── fake_linear_axis/                                                  # 🎚️ Python: Headless TF publisher & interactive marker
│   │   └── fake_linear_axis/fake_linear_axis_node.py
│   ├── scene_objects/                                                     # 📍 Python: RViz2 markers for safe zones & workspace bounds
│   │   ├── launch/scene_objects.launch.py
│   │   └── scene_objects/
│   │       ├── scene_objects.py                                           # Publishes table boundary & exclusion zone markers
│   │       ├── scene_safety_zone.py                                       # Publishes unreachable zone (3D) + scan path clearance
│   │       ├── scene_zedm_stand.py                                        # Publishes physical camera stand & ZED M mesh
│   │       ├── scene_table.py                                             # Publishes the table under the robot
│   │       └── scene_grasp_items.py                                       # Publishes the grasp objects (bottle, balls, bowl, basket)
│   ├── scene_objects_distance_to_tcp/                                     # 📏 Python: Dynamic gripper-to-object distance line & 2D HUD
│   │   ├── CMakeLists.txt
│   │   ├── package.xml
│   │   └── scripts/
│   │       └── scene_objects_distance_to_tcp.py
│   ├── servo_status/                                                      # 🖥️ Python: RViz2 2D text overlay HUDs
│   │   └── servo_status/
│   │       └── servo_status.py                                            # MoveIt Servo status & warning HUD overlay
│   ├── window_x11_streamer/                                               # 📹 Python/mss: X11 window capture (default: RViz2) → /window_capture/image_raw
│   │   └── window_x11_streamer/window_capture_node.py
│   ├── tcp_laser_pointer/                                                 # 🔴 Python: Automated end-effector laser diode controller
│   │   └── tcp_laser_pointer/laser_pointer_node.py
│   ├── teleop_pre_collision_checker/                                      # 🛡️ Python: Predictive collision guard & velocity scalar
│   │   └── teleop_pre_collision_checker/teleop_pre_collision_checker.py
│   ├── tf_control_tuner/                                                  # 📐 Python: Interactive TF transform calibration utility
│   │   └── tf_control_tuner/tf_control_tuner.py
│   ├── voice_command_listener/                                            # 🗣️ Python: Natural language intent parser & action trigger
│   │   ├── launch/voice_listener.launch.py
│   │   └── voice_command_listener/voice_command_listener.py               # Voice command → robot action mapping
│   ├── vla_bridge/                                                        # 🧠 Python: VLA-M chat backend = LLM task agent (Ollama / Claude, LeRobot planned)
│   │   ├── launch/vla_bridge.launch.py
│   │   ├── config/vla_bridge.yaml                                         # Language model, scene topic, safety, grasp heights, timeouts
│   │   ├── scripts/install_ollama.sh                                      # Ollama + model without sudo (~/.local/ollama)
│   │   ├── vla_bridge/vla_bridge_node.py                                  # /vla/* topics, confirm / execute / abort / E-STOP, re-planning
│   │   ├── vla_bridge/agent.py                                            # Prompt, JSON schema, plan check + self-correction, recovery (no ROS, pytest)
│   │   ├── vla_bridge/llm.py                                              # Ollama (local, starts ollama serve) and Anthropic backends
│   │   ├── vla_bridge/skills.py                                           # pick / place / home / gripper via approach from above, yaw search, grasp check
│   │   ├── vla_bridge/world_model.py                                      # Relations (on / in / covered, reach, stackable) for the plan check
│   │   ├── vla_bridge/examples.py                                         # Few-shot example dialogues for small local models
│   │   ├── vla_bridge/placing.py                                          # Clearance for the gripper when placing next to tall objects
│   │   ├── vla_bridge/session_log.py                                      # Agent rounds as JSON Lines (~/.ros/vla_logs, size-capped)
│   │   └── vla_bridge/scene.py                                            # Scene from /zed/bboxes_3d (label, colour, grasp sphere, box)
│   ├── vr_quest3_teleop/                                                  # 🥽 Meta Quest 3 WebXR Teleoperation bridge
│   │   ├── https_vr_webxr_p8443/                                          # Secure WebXR browser interface & 3D controllers
│   │   │   └── https_vr_webxr_p8443.py                                    # HTTPS server (port 8443) for the WebXR page
│   │   ├── vr_quest3_teleop/rosapi_guard.py                               # Starts /rosapi only if none is running yet
│   │   └── vr_quest3_teleop/vr_quest3_teleop_node.py                      # VR 6-DoF controller pose to MoveIt Servo bridge
│   ├── xarm_ros2/                                                         # 🤖 Official xArm ROS 2 stack (submodule/extended)
│   │   └── xarm_moveit_servo/src/xarm_joystick_input.cpp                  # Gamepad input node with collision brake integration
│   ├── zed-ros2-interfaces/                                               # 📷 Custom ROS 2 interfaces for Stereolabs ZED cameras
│   └── zed-ros2-wrapper/                                                  # 📷 Stereolabs ZED ROS 2 camera driver
├── tools/                                                                 # Workspace tools
│   ├── ui_new_code_checker.py                                             # Headless UI check of all web UIs incl. Monitoring Dashboard + HUD, isolated (1920/1366/1280 px)
│   ├── grasp_e2e.py                                                       # FAKE end-to-end test: grasp/place via the UI, E-STOP, IK pre-check (own domain, --quick ~4 min)
│   ├── vla_eval.py                                                        # Evaluation set for the VLA agent (vla_eval_cases.json, --check without LLM)
│   ├── pre-commit · install_hooks.sh                                      # Git pre-commit check of the staged files (flake8, JSON/YAML, tokens, check_ws, unit tests; ~5 s)
│   ├── make_diagrams.py                                                   # Generates the architecture diagrams docs/img/diagrams/*.svg
│   ├── check_ports.py                                                     # Ports in config/network.yaml valid/unique, no fixed ws ports in JS
│   ├── demos_to_lerobot.py                                                # Recorded demos (demo_recorder) -> LeRobotDataset (LeRobot venv); --check
│   ├── check_ui_tokens.py                                                 # Checks ui_shared/ui_tokens.css against the UIs
│   ├── check_ws.py                                                        # Consistency: setup.py/entry points, launch references, Nexus commands
│   ├── monitoring_sim.py                                                  # Test data simulator for the Monitoring Dashboard (isolated domain only, e.g. 97)
│   ├── bench_nexus_webkit.py                                              # Measures CPU/FPS of the Nexus app window (WebKitGTK, offscreen)
│   ├── firewall_setup.sh                                                  # Show ufw rules / --apply / --undo
│   └── install_zed.sh                                                     # ZED SDK & CUDA installation helper
├── touch_panel/                                                           # Touch Panel for an extra touch display (Nexus Webapp /touch)
│   ├── touch_panel_server.py                                              # Flask blueprint: /touch page + /api/touch/* (state, stop, close, sequences)
│   ├── touch_panel_start.sh                                               # Kiosk start: finds the HDMI touch display, maps the USB touch, Chrome kiosk
│   └── web/                                                               # Page, CSS, JS modules, icon
├── ui_shared/                                                             # Shared by the web UIs
│   ├── ui_tokens.css                                                      # Colours, axis colours, fonts, font-size scale (--ui-*, --fs-*)
│   └── net_info.{js,css}                                                  # Info card "Setup" (system overview, networks, IPs, ports, HTTPS, touch display, VLA-M; DE/EN) for Monitoring Dashboard + Nexus
├── AGENTS.md                                                              # Naming & UI guidelines for AI agents
├── TODOS.md                                                               # Open optimizations & decisions (German)
├── README.md                                                              # Overview (English) – details in docs/en/
└── readme-de.md                                                           # Übersicht (Deutsch) – Details in docs/de/
```

---

[⬅ Previous: Monitoring Dashboard](monitoring.html) · [🏠 Overview](../README.html) · [⬆ Top](#top) · [Next: Archive & Deprecated Concepts ➡](archive.html)
