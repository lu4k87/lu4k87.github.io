<a name="top"></a>

# 🖥️ Robot Control UI & Motion Backend

[🏠 Overview](../readme-en.html) · [🇩🇪 Deutsch](../de/robot_control_ui.html) · Chapter 3.6

---

## 3.6 Feature: GUI - Graphical Robot Control & Visual Feedback
*Tools for the operator for manual positioning and visual monitoring in RViz and the Web.*

<img src="../img/robot_control_ui.png" width="90%" alt="Robot Control UI – area Move in FAKE mode">

*Area **Move** in FAKE mode (1920 × 1080): header with Record/Screenshot, theme, zoom and the safety group Mode · state · Speed · Control · E-STOP; area bar on the left (pinned open: Operate, World, Scene, Help, System); viewport with navigation gizmo, toolbar and the tabs OBJECTS, CAMERAS and POSE; right column Cartesian Jogging, gripper and joints; status bar at the bottom.*

<p align="center">
  <img src="../img/rcu_sequences.png" width="24%" alt="Area Teach: sequences">
  <img src="../img/rcu_objects.png" width="24%" alt="Area Vision: detected objects">
  <img src="../img/rcu_vla.png" width="24%" alt="Area Assistant (VLA): VLA-M chat with a planned task">
  <img src="../img/rcu_remote.png" width="24%" alt="Area Remote Teleop: remote control">
</p>

*Each task button of the area bar opens its window next to the bar – from left: **Teach** (sequences), **Vision** (detected objects), **Assistant (VLA)** (VLA-M chat with four planned steps), **Remote Teleop** (control lock, remote gamepad, clients). Screenshots of the single functions sit next to their description in the details of `http_robot_control_ui.launch.py` (*Show details*) and in the operating details below it.*

---

<br>

### ![Launch](https://img.shields.io/badge/Launch-Skript-FF9900?style=flat-square) `standalone_move_group.launch.py` &nbsp;&nbsp; <sub><i>`/src/robot_motion_handler_movegroup/launch/standalone_move_group.launch.py`</i></sub>

**Purpose & Task:** Serves as the "headless" backend for the Web UI. Starts MoveIt 2's `move_group` node without resource-intensive graphical interfaces like RViz. It provides all planning and execution services (Inverse Kinematics, Collision Avoidance, Action Servers) required by the Nexus Webapp or other remote controllers to perform motion planning and execute complex trajectories. Decoupling this from RViz prevents synchronization errors (e.g., MotionPlanning load failures) during startup.

<details>
<summary><b>🔽 Show details</b> · Run Command · Publishes · Services</summary>

> [!NOTE]
> 💻 **Run Command:** *(Automatically launched by `RUN DEV SETUP (FAKE)` and `RUN DEV SETUP (REAL)`)*
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square) / ![Services](https://img.shields.io/badge/Services-FF1493?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/move_action`** | Action Server | *Provides trajectory planning and execution.* |
>> | **`/planning_scene`** | `moveit_msgs/PlanningScene` | *Maintains the collision environment and robot state.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `robot_motion_handler_movegroup.py` &nbsp;&nbsp; <sub><i>`/src/robot_motion_handler_movegroup/robot_motion_handler_movegroup/robot_motion_handler_movegroup.py`</i></sub>

**Purpose & Task:**

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Publishes · Services · Parameters</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run robot_motion_handler_movegroup robot_motion_handler_movegroup
> ```
>
> - **Central Command Hub:** Acts as the bridge between all user interfaces (UIs/Scripts) and the low-level robot hardware/MoveIt 2. Other scripts do not need to calculate complex kinematics; they simply call the services provided by this script.
> - **Service Provider:** Exposes essential ROS 2 services such as `/ui/execute_initial_pose`, `/ui/execute_move_to_pose`, `/ui/approach_from_above`, `/ui/execute_move_joint`, and `/ui/start_octomap_scan`.
> - **Resource Management:** Automatically pauses manual teleoperation (`MoveIt Servo` / Gamepad) before executing an automated trajectory, and reactivates it upon completion.
> - **Trajectory Planning & Scans:** Generates smooth spline movements and complex paths (e.g., wavy OctoMap scans) with gentle acceleration/deceleration, controlled globally via Action Speed Ratios (Slow/Normal/Fast).
> - **Collision-Aware MoveTo:** `/ui/execute_move_to_pose` first resolves a collision-free goal via `/compute_ik` (`avoid_collisions`), then lets `move_group` (`/move_action`, OMPL) plan and execute a path that avoids all collision objects (detected YOLO objects, ground). If no collision-free path exists, the arm does not move. There is deliberately no unchecked fallback when `move_group` is unavailable. Speed follows the Slow/Normal/Fast level (`moveto_velocity_scaling`, `moveto_acceleration_scaling`); an emergency stop also cancels the running `move_group` goal.
> - **No Fixed Keep-Out Zone Around the Axis:** MoveTo does not reject targets by a fixed zone; only the IK with collision checking (self-collision) and the planning decide; a truly impossible target fails with "IK calculation failed … out of reach or in collision".
> - **Path Preview (optional):** When enabled via `/ui/set_moveto_preview` (parameter `moveto_preview`, default off), MoveTo only plans (`plan_only`), publishes the path latched on `/ui/moveto_preview_path` (the Robot Control UI shows it as a ghost robot) and waits for `/ui/confirm_moveto_preview`. Confirmed, the arm executes exactly this path via `/execute_trajectory`; discarded, or without an answer after `moveto_preview_timeout` (15 s), it does not move. MoveIt Servo stays paused while waiting, and the emergency stop aborts here too. The same confirmation step also works without the ghost: `/ui/plan_move_to_pose_confirm` and `/ui/approach_from_above_confirm` (gizmo / *Approach from above* with Auto-Move off) plan right away and wait for `/ui/confirm_moveto_preview`, without publishing a ghost path (with *Approach from above* the confirmation covers the pre-position; the straight descent follows without a second one). A new MoveTo or approach while a path is waiting discards that path and plans the new target instead of answering "Already executing".
> - **IK Closest to the Current Pose & Full Joint Ranges:** The Lite 6 launches now default to `limited:=false`, i.e. the real hardware ranges (J1/J4/J6 ±360°). With `limited:=true` the URDF capped J1 at ±178.2°, so targets directly behind the robot (e.g. X = −300, Y = 0) had no IK solution. Since J1/J4/J6 are ambiguous as a result, MoveTo tries several IK seeds (one with J1 already turned towards the target), shifts J1/J4/J6 by ±2π onto the shortest way and picks the solution with the smallest joint motion - no needless full wrist turns.
> - **Inverse Kinematics (IK) & Unwrapping:** Converts target coordinates (X, Y, Z) into corresponding joint angles for all 6 axes (`/compute_ik`). An active *Joint Unwrapping Algorithm* intercepts >180° IK solution jumps, mathematically guaranteeing zero cable wind-up or sudden 360-degree wrist flips.
> - **Dynamic Safety Zone:** Subscribes to the live safety boundary and automatically halts the arm at the limit, while actively tilting the camera downwards to keep the object in view if it lies too close to the base.
> - **Emergency Stop:** Handles the emergency stop (`/ui/emergency_stop`). Immediately halts the hardware and forces all joints to zero-velocity. A path that was already computed is not sent any more after an E-STOP (e.g. the descent of *Approach from above* during the 0.5 s Servo pause); if the stop arrives while move_group is just starting a path, the handler also sends the hold trajectory to the controller again (a cancel is lost in that moment). Before 2026-09-28 the arm could drive the whole descent after an E-STOP and would have continued after the reset in REAL. Regression test: `tools/grasp_e2e.py` (E-STOP in the gap before the descent).
> - **Audio Feedback:** Plays status sounds (like Initial Pose or Absolute Pose) when specific poses are targeted.
>
> **Which scripts use this (Clients of the `/ui/...` Services)?**
> - **`gaze_grasp_routine_tobii_glasses.py`**: Calls the Move-To-Pose service for scanning modes and exact hovering over targets.
> - **`http_robot_control_ui_p8081/js/`** (mainly `motion.js`, `safety.js`): The browser frontend (roslibjs, ES modules) of the Robot Control UI commands Initial Pose, Scans, absolute XYZ movements, and Emergency Stops through this node.
> - **`yolo_grasp_executor.py`** & **`yolo_planned_grasp_executor.py`**: Utilize the Move-To-Pose service as a fallback when custom motion planning fails.
> - **`gaze_ui_node_tobii_glasses.py`** & **`..._zedm.py`**: Use it to trigger the Initial Pose reset.
> - **`xarm_joystick_input.cpp`**: The Gamepad script uses it to return to the Initial Pose on button press (Y-Button).
>
>
> ![Parameters](https://img.shields.io/badge/Parameters-yellow?style=flat-square)
>
>> | Parameter | Default | Description |
>> |---|---|---|
>> | `moveto_planning_time` | `5.0` | *Planning time per MoveTo [s].* |
>> | `moveto_planning_attempts` | `10` | *Planning attempts per MoveTo.* |
>> | `moveto_timeout` | `120.0` | *Maximum time for planning + execution [s].* |
>> | `moveto_velocity_scaling` / `moveto_acceleration_scaling` | `[0.15, 0.3, 0.6]` | *Scaling per speed level Slow / Normal / Fast.* |
>> | `moveto_preview` | `false` | *Path preview active at start.* |
>> | `moveto_preview_timeout` | `15.0` | *Seconds until an unconfirmed preview is discarded.* |
>> | `approach_pre_height` | `0.07` | *Height of the pre-position above the target [m] ("Approach from above").* |
>> | `approach_descent_scaling` | `0.15` | *Speed of the vertical descent.* |
>> | `approach_object_match_radius` | `0.03` | *Max. XY distance [m] between target and grasp sphere to identify the object.* |
>> | `moveit_controller_status_topic` | `/lite6_traj_controller/follow_joint_trajectory/_action/status` | *Status topic used to detect the start of execution.* |
>> | `auto_initial_pose` | `true` | *Move to the initial pose at startup – planned collision-free via MoveIt (waits up to 30 s for `/move_action`, with path preview it waits for confirmation); `false` keeps the arm still.* |
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/robot_control/current_speed`** | `std_msgs/Float32` | *Scales the velocity of the Joint movements synchronously with the UI.* |
>> | **`/ui/scan_speed`** | `std_msgs/Int32` | *Scales the velocity of scan trajectories (0: Slow, 1: Normal, 2: Fast).* |
>> | **`/ui/emergency_stop_topic`** | `std_msgs/Empty` | *Listens for immediate stop triggers (non-blocking emergency bypass).* |
>> | **`/joint_states`** | `sensor_msgs/JointState` | *Reads current joint angles.* |
>> | **`/ui/safety_zone_params`** | `std_msgs/Float32MultiArray` | *Receives live dynamic safety zone parameters `[x, y, radius]` to enforce boundaries.* |
>> | **`/zed/bboxes_3d`** | `visualization_msgs/MarkerArray` | *Red grasp spheres (`yolo_object_grasp_center_point`) and class labels - assign the target object for *Approach from above*.* |
>> | **`/display_planned_path`** | `moveit_msgs/DisplayTrajectory` | *Candidate MoveTo paths from `move_group` (waypoints, estimated duration, rejected candidates).* |
>> | **`/lite6_traj_controller/follow_joint_trajectory/_action/status`** | `action_msgs/GoalStatusArray` | *Detects the moment `move_group` actually starts executing a MoveTo path (parameter `moveit_controller_status_topic`).* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/servo_server/delta_twist_cmds`** | `geometry_msgs/TwistStamped` | *Sends zero-velocity commands to halt the servo node.* |
>> | **`/lite6_traj_controller/joint_trajectory`** | `trajectory_msgs/JointTrajectory` | *Direct joint trajectories for Initial Pose, MoveJoint and scan paths (not collision-checked by MoveIt), plus the emergency-stop hold. MoveTo runs through `move_group` instead.* |
>> | **`/ui/motion_status`** | `std_msgs/String` | *Publishes UI status messages for the logger.* |
>> | **`/ui/moveit_motion_state`** | `std_msgs/String` (JSON) | *Live MoveTo progress (IK → planning → execution, timings, candidate paths, result) for the MoveIt popup.* |
>> | **`/ui/moveto_preview_enabled`** | `std_msgs/Bool` (latched) | *Whether the path preview is active.* |
>> | **`/ui/moveto_preview_path`** | `std_msgs/String` (JSON, latched) | *Planned path (joint names, waypoints, times) or `{"clear": true}`.* |
>> | **`/ui/emergency_stop_active`** | `std_msgs/Bool` (latched) | *Emergency stop latched or not.* |
>> | **`/ui/motion_busy`** | `std_msgs/Bool` (latched) | *A motion of this node is running (MoveIt, scan, joint goal); `vr_quest3_teleop_node` starts no servo motion meanwhile, the Robot Control UI and the Touch Panel block other motions (header *BUSY*), `vla_bridge` starts no skill.* |
>> | **`/ui/ignore_collision_object`** | `std_msgs/String` | *Takes the target object out of the collision world for the descent of "Approach from above".* |
>
>
> ![Services](https://img.shields.io/badge/Services-FF1493?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/execute_initial_pose`** | `std_srvs/srv/Trigger` (Server) | *Returns the arm to the home pose. With path preview on it is planned through `move_group` and shown as a ghost first (confirm/discard like MoveTo).* |
>> | **`/ui/execute_move_to_pose`** | `xarm_msgs/srv/MoveCartesian` (Server) | *Moves to an absolute Cartesian pose on a collision-free path planned by `move_group`.* |
>> | **`/ui/execute_move_to_pose_silent`** | `xarm_msgs/srv/MoveCartesian` (Server) | *Same as above without the "robot moves to absolute pose" voice (used by the viewport TCP gizmo).* |
>> | **`/ui/approach_from_above`** | `xarm_msgs/srv/MoveCartesian` (Server) | *"Approach from above": collision-free to `approach_pre_height` above the target, then straight down. The descent is refused if the arm would change its configuration on the way (joint 1 must stay put, no joint may turn more than ~57°); a blocked descent names the obstacle. Object targets may lie below the Z Collision Level (inner floor of bowl/basket).* |
>> | **`/ui/plan_move_to_pose_confirm`** | `xarm_msgs/srv/MoveCartesian` (Server) | *MoveTo that plans right away and waits for `/ui/confirm_moveto_preview` (no ghost path) - TCP gizmo with Auto-Move off.* |
>> | **`/ui/approach_from_above_confirm`** | `xarm_msgs/srv/MoveCartesian` (Server) | *"Approach from above" that waits for `/ui/confirm_moveto_preview` twice (Auto-Move off): before moving to the pre-position and again before descending to the grasp point.* |
>> | **`/ui/execute_move_joint`** | `xarm_msgs/srv/MoveJoint` (Server) | *Executes joint angle motions – planned collision-free via MoveIt like Initial Pose, never as a direct controller trajectory.* |
>> | **`/ui/start_octomap_scan`** | `std_srvs/srv/Trigger` (Server) | *Executes a basic scan sweep (Alias: `/ui/execute_scan_trajectory`).* |
>> | **`/ui/set_moveto_preview`** | `std_srvs/srv/SetBool` (Server) | *Path preview on/off.* |
>> | **`/ui/confirm_moveto_preview`** | `std_srvs/srv/SetBool` (Server) | *`true` = execute the waiting path, `false` = discard it.* |
>> | **`/ui/emergency_stop`** | `std_srvs/srv/Trigger` (Server) | *Immediately halts the current trajectory (Alias: `/ui/stop_motion`).* |
>> | **`/ui/halt_motion`** | `std_srvs/srv/Trigger` (Server) | *Stops the running motion of this node (cancel + hold trajectory) **without** latching the E-STOP; the next motion starts without acknowledging. Used by `vla_bridge` for *Abort* while palletizing and by *Stop* next to *BUSY* in the Robot Control UI header.* |
>> | **`/ui/reset_emergency_stop`** | `std_srvs/srv/Trigger` (Server) | *Acknowledges the latched emergency stop.* |
>> | **`/compute_ik`** | `moveit_msgs/srv/GetPositionIK` (Client) | *Uses MoveIt IK to resolve Cartesian targets.* |
>> | **`/compute_fk`** / **`/compute_cartesian_path`** | `moveit_msgs/srv/GetPositionFK` / `GetCartesianPath` (Client) | *Forward kinematics and Cartesian path computation.* |
>> | **`/move_action`** | `moveit_msgs/action/MoveGroup` (Action Client) | *Plans and executes the collision-free MoveTo path.* |
>> | **`/execute_trajectory`** | `moveit_msgs/action/ExecuteTrajectory` (Action Client) | *Executes a confirmed path preview.* |
>> | **`/servo_server/stop_servo`** | `std_srvs/srv/Trigger` (Client) | *Pauses MoveIt Servo during trajectory execution.* |
>> | **`/servo_server/start_servo`** | `std_srvs/srv/Trigger` (Client) | *Resumes MoveIt Servo after trajectory execution.* |
>> | **`/ufactory/set_state`** | `xarm_msgs/srv/SetInt16` (Client) | *Sets hardware state on real controller.* |
>> | **`/xarm/set_state`** | `xarm_msgs/srv/SetInt16` (Client) | *Sets hardware state on xArm controller.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `moveit_floor_collision.py` &nbsp;&nbsp; <sub><i>`/src/robot_motion_handler_movegroup/robot_motion_handler_movegroup/moveit_floor_collision.py`</i></sub>

**Purpose & Task:** Adds the table surface as a flat collision box (2 × 2 m) to the MoveIt planning scene. Its height follows the adjustable **Z Collision Level** (TCP height in mm, default 10, set live via `/ui/set_ground_collision_level`): the box lies `servo_margin` below it, but at most at `floor_z` (1 mm below `link_base`) - higher would intersect `link_base` and abort every planning with `START_STATE_IN_COLLISION`. The box is sent as a `/planning_scene` diff, which both `move_group` and `servo_server` receive. It blocks MoveIt Servo while jogging (`HALT_FOR_COLLISION`), `/compute_ik` with `avoid_collisions` and all `move_group` planning (MoveTo, grasp sequence). It is republished every 2 s so a restarted `move_group`/`servo_server` gets it again. The Robot Control UI can switch it off and on via `/ui/set_moveit_collision_ground`. After a node restart it is always ON again.

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Publishes · Services · Parameters</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run robot_motion_handler_movegroup moveit_floor_collision
> ```
> *Started automatically by the `xarm_moveit_servo` launch files (`_robot_moveit_servo_fake/realmove.launch.py`).*
>
>
> ![Parameters](https://img.shields.io/badge/Parameters-yellow?style=flat-square)
>
>> | Parameter | Default | Description |
>> |---|---|---|
>> | `floor_z` | `-0.001` | *Top of the box relative to `frame_id` (m).* |
>> | `frame_id` | `link_base` | *Reference frame of the box.* |
>> | `size_xy` | `2.0` | *Edge length of the box (m).* |
>> | `thickness` | `0.02` | *Box thickness (m).* |
>> | `object_id` | `floor` | *Collision object ID in the planning scene.* |
>> | `publish_period` | `2.0` | *Republish period (s).* |
>> | `ground_level_mm` | `10.0` | *Z Collision Level at start (TCP height, mm).* |
>> | `ground_level_min_mm` / `ground_level_max_mm` | `0.0` / `200.0` | *Allowed range of the Z Collision Level (mm).* |
>> | `servo_margin` | `0.011` | *Distance of the box below the Z Collision Level (m), since Servo slows down ~1 cm before collision geometry.* |
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/set_ground_collision_level`** | `std_msgs/Float64` | *New Z Collision Level in mm (from the ground collision popup of the Robot Control UI).* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/planning_scene`** | `moveit_msgs/PlanningScene` | *Adds (or removes) the floor collision box as a scene diff.* |
>> | **`/ui/moveit_collision_ground_enabled`** | `std_msgs/Bool` (latched) | *Whether MoveIt currently considers the ground.* |
>> | **`/ui/ground_collision_level`** | `std_msgs/Float64` (latched) | *Valid Z Collision Level in mm.* |
>
>
> ![Services](https://img.shields.io/badge/Services-FF1493?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/set_moveit_collision_ground`** | `std_srvs/srv/SetBool` (Server) | *Enables/disables the ground as a MoveIt obstacle.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `servo_status.py` (`servo_status`) &nbsp;&nbsp; <sub><i>`/src/servo_status/servo_status/servo_status.py`</i></sub>

**Purpose & Task:** Displays a clean, elegant 2D HUD status overlay in the top-right corner of the RViz viewport monitoring live Singularity and Collision warnings (`On` / `Off`), as well as a prominent central warning pop-up banner (`/ui/rviz_overlay_warning_banner`) for immediate visual alerts during singularities or collisions.

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Publishes</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run servo_status servo_status
> ```
> *(Also automatically started via `robot_vision_cameras_bringup.launch.py`)*
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/servo_server/status`** | `std_msgs/Int8` | *Translates status integers (singularity, collision, joint bound) into warnings.* |
>> | **`/ui/collision_msg`** | `std_msgs/String` | *Receives table collision alerts from `teleop_pre_collision_checker`.* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/rviz_overlay_warning`** | `rviz_2d_overlay_msgs/OverlayText` | *Publishes formatted 2D HUD warnings status overlay (Singularity & Collision On/Off) in top-right corner of RViz2.* |
>> | **`/ui/rviz_overlay_warning_banner`** | `rviz_2d_overlay_msgs/OverlayText` | *Publishes large, centered warning banner popup in RViz2 with 2.0s auto-hide during collision/singularity events.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `scene_objects_distance_to_tcp.py` (`scene_objects_distance_to_tcp`) &nbsp;&nbsp; <sub><i>`/src/scene_objects_distance_to_tcp/scripts/scene_objects_distance_to_tcp.py`</i></sub>

**Purpose & Task:** Computes the live distance from the robot Tool Center Point (`link_tcp`) to the nearest detected YOLO object (`/zed/bboxes_3d`). Dynamically renders a thin, semi-transparent dashed 3D green marker line in RViz connecting `link_tcp` to the object grasp center, while simultaneously displaying a formatted 2D HUD text overlay in the top-left corner of the RViz viewport with millimeter precision (X, Y, Z, D) and color-coded coordinates, with the detected object label displayed in purple.

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Publishes · TF2</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run scene_objects_distance_to_tcp scene_objects_distance_to_tcp.py
> ```
> *(Automatically started via `robot_vision_cameras_bringup.launch.py`)*
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/zed/bboxes_3d`** | `visualization_msgs/MarkerArray` | *Receives 3D bounding boxes and centroids of detected objects from YOLO.* |
>
>
> ![TF2](https://img.shields.io/badge/TF2-yellow?style=flat-square)
>
>> | Frame / Transformation | Description |
>> |---|---|
>> | **`world` ➔ `link_tcp`** | *Resolves current TCP position at runtime for distance computation.* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/rviz/gripper_object_distance`** | `visualization_msgs/MarkerArray` | *Publishes the thin dashed green 3D marker line between TCP and nearest object.* |
>> | **`/rviz/gripper_object_distance_overlay`** | `rviz_2d_overlay_msgs/OverlayText` | *Publishes the 2D HUD overlay displaying object name and aligned millimeter coordinates.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `window_capture_node.py` (`window_x11_streamer`) &nbsp;&nbsp; <sub><i>`/src/window_x11_streamer/window_x11_streamer/window_capture_node.py`</i></sub>

**Purpose & Task:** Captures a native running X11 window (default: RViz2, selectable via the `window_name` parameter) in real-time via `xwininfo` and `mss`, converts screen buffers into standard BGR8 ROS Image messages, and publishes them at 15 FPS to `/window_capture/image_raw`. This allows the full 3D RViz scene to be streamed seamlessly into the Web UI via `web_video_server` (Port 8082) without requiring heavy client-side 3D WebGL rendering.

<details>
<summary><b>🔽 Show details</b> · Run Command · Publishes</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run window_x11_streamer window_capture_node
> ```
> *(Started automatically by `web_video_server.launch.py`, which `http_robot_control_ui.launch.py` includes)*
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/window_capture/image_raw`** | `sensor_msgs/Image` | *Publishes the live screen capture stream of the RViz2 window.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `scene_objects.py` &nbsp;&nbsp; <sub><i>`/src/scene_objects/scene_objects/scene_objects.py`</i></sub>

**Purpose & Task:** Publishes ROS `MarkerArray` messages into the 3D scene of RViz2 (e.g., workspace reach boundary circle with radius $r = 420\text{ mm}$ and thickness $3\text{ mm}$ at TCP $Z = 0$, and interactive hollow-body target boxes). Uses a `0` timestamp to prevent flickering caused by TF tree asynchronicity.

<details>
<summary><b>🔽 Show details</b> · Run Command · Publishes</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 launch scene_objects scene_objects.launch.py
> ```
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`visualization_marker_array`** | `visualization_msgs/MarkerArray` | *Renders virtual markers (workspace circle, interactive target boxes) in RViz.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `scene_safety_zone.py` &nbsp;&nbsp; <sub><i>`/src/scene_objects/scene_objects/scene_safety_zone.py`</i></sub>

**Purpose & Task:** Publishes into the RViz2 scene (namespace `safety_zone`) the **unreachable zone around the robot axis** as a red body of revolution with contour rings, and the **scan path clearance** (safety zone radius, default 138 mm) as a flat orange disc. The red shape was measured with MoveIt (`/compute_ik` with collision checking, gripper facing down): unreachable up to radius 100 mm at z = 0–60 mm, 80 mm at 80–240 mm, 60 mm at 260 mm, 30 mm at 280 mm, free from 300 mm - there the arm would have to pass through its base or lower arm. The Robot Control UI uses the same profile (`UNREACHABLE_PROFILE` in `js/robot_limits.js`). Subscribes to `/ui/safety_zone_params` to receive position and radius of the path clearance; the red zone is fixed.

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Publishes</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run scene_objects scene_safety_zone
> ```
> *(Automatically started via `scene_objects.launch.py`)*
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/safety_zone_params`** | `std_msgs/Float32MultiArray` | *Receives safety zone boundary data (x, y, radius).* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`visualization_marker_array`** | `visualization_msgs/MarkerArray` | *Namespace `safety_zone`: path clearance as a disc (`CYLINDER`) + ring, unreachable zone as a body of revolution (`TRIANGLE_LIST`) + contour rings (`LINE_LIST`).* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `scene_zedm_stand.py` &nbsp;&nbsp; <sub><i>`/src/scene_objects/scene_objects/scene_zedm_stand.py`</i></sub>

**Purpose & Task:** Mathematically generates the exact 3D model of the camera tripod (aluminum profile) alongside the 3D mesh (STL) of the Stereolabs ZED M camera and publishes them statically in RViz.

<details>
<summary><b>🔽 Show details</b> · Run Command · Publishes</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run scene_objects scene_zedm_stand
> ```
> *(Automatically started via `scene_objects.launch.py`)*
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/zed_visual_markers`** | `visualization_msgs/MarkerArray` | *Publishes the static 3D models of the camera stand and the ZED camera mesh.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `scene_table.py` &nbsp;&nbsp; <sub><i>`/src/scene_objects/scene_objects/scene_table.py`</i></sub>

**Purpose & Task:** Publishes the table under the robot (default 1.20 × 0.80 × 0.75 m, off-white top with rounded edges, dark grey legs). The long side points in +X like the robot; the robot stands at the short edge, flush with the rear of its base. The top sits 4 mm below z = 0 so grid, A4 template and safety-zone discs stay visible. Visualisation only – MoveIt collision for the table comes from `moveit_floor_collision`; the Robot Control UI twin builds the same table.

<details>
<summary><b>🔽 Show details</b> · Run Command · Publishes</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run scene_objects scene_table
> ```
> *Automatically started via `scene_objects.launch.py`; size and position via parameters (`length_x`, `width_y`, `height`, `top_z`, `edge_x`, …).*
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/visualization_marker_array`** | `visualization_msgs/MarkerArray` | *Table top and legs in `world`.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `scene_grasp_items.py` &nbsp;&nbsp; <sub><i>`/src/scene_objects/scene_objects/scene_grasp_items.py`</i></sub>

**Purpose & Task:** Publishes the grasp objects **bottle**, **steel ball** (30 mm), **rubber ball** (50 mm), **bowl** (110 mm, fits the large ball) and **basket** (180 mm, fits both balls). Each item follows its TF tuner frame (`target_bottle`, `target_ball_small`, `target_ball_large`, `target_bowl_small`, `target_basket_large`; frame z = bottom of the object) and falls back to a default pose while the frame is missing. Tilted objects are shown with full rotation. The TF tuner's **Size** slider (`/ui/scene_object_sizes`) scales each item. Dimensions match the digital twin and the physics sandbox of the Robot Control UI.

<details>
<summary><b>🔽 Show details</b> · Run Command · Publishes</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run scene_objects scene_grasp_items
> ```
> *Automatically started via `scene_objects.launch.py`.*
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/visualization_marker_array`** | `visualization_msgs/MarkerArray` | *Grasp objects in namespace `grasp_items` (`world`).* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `rosbridge_websocket_launch.xml` (`rosbridge_server`) &nbsp;&nbsp; <sub><i>[`/opt/ros/humble/share/rosbridge_server/launch/rosbridge_websocket_launch.xml`](https://github.com/RobotWebTools/rosbridge_suite)</i></sub>

**Purpose & Task:** Standard WebSocket bridge on Port 9090, allowing the web UIs (Robot Control UI, Touch Panel) to access the ROS network directly. The Robot Control UI launch starts it with `call_services_in_new_thread:=true` and `default_call_service_timeout:=10.0`: otherwise every service call runs in the bridge main thread, and a slow call (e.g. `/rosapi/nodes`) delayed MoveTo by 0.3-5 s before planning started (measured; with threads a constant ~0.3 s). `rosapi` runs with `respawn`; the node `rosapi_health` calls `/rosapi/nodes` every 5 s and, after three unanswered calls, kills the hanging `rosapi_node` of the same launch so it restarts (a hanging rosapi left the header without mode and response time); it also reports a duplicate `/rosapi` on `/diagnostics`.

<details>
<summary><b>🔽 Show details</b> · Run Command</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 launch rosbridge_server rosbridge_websocket_launch.xml
> ```

</details>

---

<br>

### ![Web App](https://img.shields.io/badge/Web_App-E34F26?style=flat-square&logo=html5&logoColor=white) `http_robot_control_ui.launch.py` (`http_robot_control_ui_p8081`) &nbsp;&nbsp; <sub><i>`/src/http_robot_control_ui_p8081/launch/http_robot_control_ui.launch.py`</i></sub>

**Purpose & Task:** A native-feeling, standalone Chrome Web App designed with a modern Glassmorphism aesthetic. It acts as a comprehensive multimodal dashboard directly replicating the RViz control panel features for remote operation. Operates on **Port 8081**.

<details>
<summary><b>🔽 Show details</b> · Features · Run Command · Subscribes · Publishes · Services</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> # Complete: rosbridge 9090 + web server 8081 + Chrome app window + web_video_server 8082 (incl. window_x11_streamer):
> ros2 launch http_robot_control_ui_p8081 http_robot_control_ui.launch.py
>
> # Web server only:
> python3 src/http_robot_control_ui_p8081/http_robot_control_ui_p8081/server.py 8081 src/http_robot_control_ui_p8081
> ```
> *Launch arguments: `start_video_server` (default `true`), `video_server_port` (default `8082`).*

> *UI windows (Nexus Webapp, group "UI Windows"): `open_robot_control_ui` (default `true`), `open_touch_ui` (Touch Panel, default `false`), `open_monitoring_ui` (Monitoring Dashboard, default `false`). Touch Panel and Monitoring Dashboard must be running (their window waits up to 30 s for the port, otherwise a log line). A window that is already open is not opened twice (also with `open_browser:=true` of the Monitoring Dashboard launch). Windows opened by the launch close when it stops (Ctrl+C, stop or *Stop all & quit* in the Nexus Webapp); a window that was open before stays open. With `connect_to` the windows show the pages of the server. After changes a browser reload of the Nexus Webapp is enough.*
>
> **Native Desktop Integration:** The *Robot Control UI* launches in a dedicated, isolated Chrome `--app` profile: maximized as a standalone application, detached from standard browser windows and with its own taskbar icon. When the Nexus Webapp starts it (Execute/sequence), it also keeps the window "always on top" so terminals of later steps cannot cover it. Close it with the **X** right of E-STOP (the ROS stack keeps running). The *ROS 2 Nexus Webapp* opens as a frameless WebKitGTK window that only shows the start popup (see 7.2); Chrome `--app` is only its fallback.
> - ✨ **Core Features:**
>   - 🧭 **Header, layout & persistence**
>     - **Standardized Status Bar:** Unified navbar with standardized port badges in `Name: PORT` format (`ROS 2 Bridge: 9090`, `Robot Control UI: 8081`, `Nexus Webapp: 8080`, `Monitoring Dashboard: 8083`, `Video Streams: 8082`, `VR Teleop: 9091`), device badges and live ROS environment parameters (`ROS_DOMAIN_ID: 66`, `RMW: rmw_cyclonedds_cpp`, `Localhost Only: On/Off`), and real-time hardware mode pills. All badges are fed by `/api/header_status` of the UI web server (`server.py`, the same on 8081 and 8443 - same origin, so it works in the Quest browser too): ports are checked on the PC (green = running, grey = not started yet - start it in the Nexus Webapp, red only if it was running in this session and then stopped; the *Services* button shows the warning sign only for such failures); **Quest 3** is online via USB (sysfs), Wi-Fi (ping to the IP read once via `adb`, cached in `~/.cache/robot_control_ui/quest_ip`, `QUEST_IP` overrides) or an active WebXR session and shows e.g. `VR · USB+WLAN`; **Xbox** via USB/Bluetooth, `/joy` or the Gamepad API; **Tobii** via its RTSP port 8554 (`TOBII_IP`, default `192.168.75.xxx`); Domain/RMW/Localhost come from the server's environment.
>     - **Advanced Telemetry:** Live status pills for network ports (UI, WS, Nexus), gamepad connection (USB) and automatic hardware mode detection: if a `ufactory_driver` node is running, the badge shows "Real Arm" with its `robot_ip` (via `/rosapi/get_param`, format `<node>:robot_ip`), otherwise "Fake Arm". Includes a dedicated **EEF Telemetry Live** display for precise Cartesian tracking of the end effector.
>     - **Interactive UI & Drag-and-Drop Layout:** The sections (camera streams, YOLO 3D, 3D viewport, Cartesian jogging, EEF telemetry, Whisper AI, VLA-M, log) can be moved between the three columns with SortableJS and resized at their corner. Includes the Whisper AI "Start Listening" button with an interactive info popover (`i` icon) listing all available voice commands line-by-line with a DE/EN/All language switcher and bilingual auto-detection indicator, as well as color-coded axis markers (X red, Y green, Z blue) on the coordinate fields.
>     - **Resizable & Collapsible Outer Columns:** A narrow divider sits between the left/right column and the middle (`js/columns.js`). Dragging changes the width of the outer column (min. 300 px, max. 42 % of the width, the middle keeps at least 480 px), a double-click restores the default layout, and the arrow button on the divider collapses the column completely and expands it again. The middle column with the 3D viewport always gets the freed space; widths and collapsed state are stored in the browser.
>     - **Responsive Section Layout:** Sections adapt to their own width via container queries (not to the window), since depending on column and column width they can be 300 px or 700 px wide. Cartesian jogging wraps into rows (joystick + Z, rotation/frame, gripper buttons side by side), EEF telemetry shrinks, the viewport icon bar wraps within itself, and speech control, grasp target input, ZED mode bar and TF tuner dropdown adapt. When the viewport gets narrower than 780 px, the POSE panel gets its own row; on screens below 800 px height the viewport keeps at least 560 px height (the page scrolls, header and E-stop stay on top).
>     - **Bidirectional Section Snapping & Responsive Auto-Fit:** When a section is resized smaller via the bottom-right or left-side resize grip and then pulled back towards the column boundary or viewport (to the right in the middle/left column, or to the left/right in the right column), it automatically snaps flush to the maximum column width (100% responsive, clearing rigid pixel widths). A double-click on the section header or resize grip immediately snaps/resets the section to full width.
>     - **Last UI State Is Kept:** Besides column layout, collapsed sections/HUD tabs, sound and overlays, `js/persist.js` also stores grid, lab room, CAD edges, TCP gizmo (on/off, mode), camera view, Auto-Move, base/TCP frame, Layers/Planning switches, all TF tuner values incl. the selected element (as a fallback - the values saved via *Save* on the PC take precedence), and section sizes changed by dragging (`localStorage`). Robot values (pose inputs, speed, linear axis) are intentionally not stored.
>     - **Layout – Presets, Profiles & Dark / Light Theme:** *Settings > Layout & profiles* (area bar footer › Settings; the former *Layout* popover of the bar is gone) offers ready-made arrangements – *Operate*, *Camera focus*, *Calibrate*, *Laptop (compact)* – plus *Load My view* / *Save as My view* (one own layout per browser, Alt+Shift+7 loads it, `js/presets.js`). *Camera focus* opens *Vision > Cameras*, *Operate* and *Laptop* close the task window. **Profiles** (the only profile list of the UI): enter a name and press *Save* (*Overwrite* if the name exists) to store the whole UI view as a profile on the robot PC - section arrangement, column widths, collapsed sections, Diagnostics drawer, status bar and in addition theme, pinned area bar, viewport panels (collapsed/docked), viewport switches (YOLO overlay, distance line, coordinates, labels, ruler), 3D view (grid, CAD edges, room, gizmo mode, camera) and resized sections; not saved: robot values, Virtual Objects/calibration, settings, TCP gizmo on/off (`js/ui_profile.js`). Stored via `/api/layouts` → `~/.config/robot_control_ui/layouts.json` (at most 20); every device that opens the UI (laptop, tablet, Quest) sees the list and can apply it, the bin deletes an entry after a second click. A preset only sets what can also be done by hand (section placement, outer column widths, collapsed sections). *Settings > Appearance* switches between the dark and the light theme (`js/theme.js`, `css/theme_light*.css`); the theme is applied before the first paint. All colours in `style.css` are role tokens in `:root` (`--line-*` borders, `--fill-*` surfaces, `--txt-*` text, `--txt-on-*` light text on strong accent surfaces, `--shadow-*` shadows and glows; name = role + colour + opacity in %, e.g. `--fill-amber-12`); `tools/gen_theme_light.py` derives the light values from the token names – after colour changes run it in the package folder. **Themes (Dark, Light, Jarvis, Nord Blue):** one list for all web UIs (`ui_shared/ui_theme.js`, theme CSS in `ui_shared/themes/<id>.css`, loaded only when chosen). Quick switch like in VS Code: **Alt+T** anywhere or the theme button in the header (*Dark ▾*) – ↑↓ previews live, Enter applies, Esc or a click outside cancels, 1–4 picks directly; also *Settings > Appearance > Theme* and the command palette (Ctrl+K, e.g. „jarvis“). *Jarvis* = dark HUD look (cyan glow, grid, Orbitron headings); *Nord Blue* = calm dark (slate grey, frost blue, matt, no glow); safety zone and status colours stay unchanged; the picker does not open while the robot moves; this browser only, saved in UI profiles. New theme = one entry in `THEMES` + one CSS file.
>       <br><img src="../img/rcu_light.png" width="640" alt="Light theme (theme menu in the header): same layout, area Move, FAKE mode.">
>       <br><sub><i>Light theme (theme menu in the header): same layout, area Move, FAKE mode.</i></sub>
>   - 🧊 **Viewport & digital twin**
>     - **3D Centerpiece (WebGL Digital Twin):** Central, offline-capable 3D digital twin (three.js & urdf-loader) with live `/joint_states` and linear axis mirroring, orbit camera, navigation gizmo at the top left (click an axis ball = align view, drag = orbit), reset, top view, grid, **lab room** (`fa-warehouse`, on by default: concrete floor, two walls behind the robot fading into the theme color, aluminium profile frame under the 1.20 × 0.80 m table with the robot at its narrow edge; the grid then only covers the table top; hidden in VR/passthrough; static, ~12 draw calls, no extra lights or shadows) and CAD edges. In the Layers panel (**Environment**, **Objects**, **Safety**), switches toggle the markers of each `scene_objects` node individually (`fa-cubes` objects, `fa-square` reference plane, `fa-shield-halved` safety zone - red the measured unreachable zone around the robot axis as a 3D body, orange flat the scan path clearance, and the semi-transparent white 420 mm radius [3 mm thick] workspace ground circle at TCP $Z=0$, `fa-video` ZED-M stand), plus the YOLO overlay (with clean centered 2-line class and coordinate labels; **XYZ Coords** toggles the coordinates, **Object Label** (`fa-tag`) the class names of all objects incl. virtual objects), distance line, the **Virtual Obj.** button (see below) and the MoveIt collision toggles.
>     - **Viewport toolbar (`js/toolbar.js`, `js/layer_bar.js`):** The 3D viewport has no section header while expanded. Top left sits the navigation gizmo (144 px; 112 px in a low viewport, 96 px in a very low one, size slider 60–125 %), directly below it three camera buttons of the same width: **Fit view** (Home), **Top view** and gizmo size. Right of it one toolbar ordered by task: **«** collapse (only gizmo and window buttons stay, a yellow dot on *Tools* shows that something deviates: safety zone hidden, collision off, sound off; kept per browser) · **TCP gizmo** as one segment **Off / Move / Rotate** (keys G / T / R), ⌖ back to the robot TCP (Esc, locked while off) and ▾ gizmo look (line length, thickness, opacity as proxies of *Settings › TCP Gizmo*, *Save look*) · **Move** (former MOTION section: Home, Align, Scan pose; `motion-lockable`, id `twin-motion-overlay` kept for the VR HUD) · **Layers** and **Planning** (panels, see below) · **XR** (VR directly when the browser reports it, ▾ Passthrough AR and VR mirror window) · **App** (sound, Settings, ⋮) · window buttons (`.centerpiece-collapse-stack`: collapse all HUD panels, collapse the viewport) at the far right. Colours: groups neutral, active = blue, yellow only as a dot for deviations. Too narrow: first the words of secondary buttons go (container ≤ 1440 px), then key hints and counters (≤ 1100 px), then the segment words (≤ 860 px); after that the main part wraps into a second row. Collapsed, the section shows a header `Digital Twin - Viewport | xArm Lite 6 (FAKE)` or `...(REAL)` (follows `ufactory_driver`) with the expand arrow – there it can also be dragged to another column.
>       <br><img src="../img/rcu_viewport.png" width="560" alt="Viewport: navigation gizmo top left, toolbar (gizmo Off/Move/Rotate, poses Home/Align/Scan/OctoMap, Layers, Planning, XR, sound, Settings), tabs OBJECTS (left), CAMERAS (right) and POSE (bottom).">
>       <br><sub><i>Viewport: navigation gizmo top left, toolbar (gizmo Off/Move/Rotate, poses Home/Align/Scan/OctoMap, Layers, Planning, XR, sound, Settings), tabs OBJECTS (left), CAMERAS (right) and POSE (bottom).</i></sub>
>     - **Collapsible Viewport HUD Panels:** The viewport carries the toolbar (see above) and two collapsible glass panels — **CAMERAS** and **POSE** (**SEQUENCES** is a normal section that can be dragged into any column and collapsed (default on the left); the former MOTION section is the **Move** group of the viewport toolbar; SYSTEM sits in the status bar, SPEED in the safety bar, TELEMETRY is the status row in Cartesian jogging). The POSE fields always stay visible. Each panel header collapses its content, one button in the viewport tab bar (`fa-window-minimize`) collapses or expands all of them; the state is stored per browser. A separate toggle (`fa-ruler-horizontal`) shows or hides the distance line from the TCP to the nearest object. The TCP gizmo target coordinates live in the MoveIt popup (see below).
>     - **Virtual Objects panel – virtual objects one by one (`js/virtual_objects_hud.js`):** Button **Virtual Objects** in the viewport toolbar between *Layers* and *Planning* (counter `6/8` = graspable objects of the scene in the scene); opens a panel below it like Layers/Planning (`#layer-fly-vobj`, `js/layer_bar.js`: only one panel open, Esc / click outside closes). The graspable objects show up as long as *Planning › Simulation › Object detection* is on (otherwise a hint); **All** (checkbox, on / off / mixed, counter `6/8`) and below it the eight objects in two columns (Cube, Rectangle, Cylinder, Bottle, Steel Ball, Rubber Ball, Bowl, Basket) with checkbox and colour dot; off = empty box, hollow dot, name struck through. Shows only the objects of the active scene (area bar › Scene); **All** and Alt+click act within it, bodies of the other scene stay hidden in the viewport. Click = take the object out of the scene or put it back, **Alt+click** = keep only this object. An object that is off disappears from `/zed/bboxes_3d` (no MoveIt obstacle, not in *Detected Objects*, not in the VLA agent's scene) and its body is hidden in the viewport; RViz keeps showing the scene marker. The state belongs to `virtual_object_detections` (`/ui/set_virtual_objects` → latched `/ui/virtual_objects`), so every browser sees the same. Height: two columns keep the panel flat; on a short viewport the panel scrolls. The confirmation *Turn off … collision?* gets its own row and wraps instead of widening the panel.
>       **Environment** (below, `js/environment.js`): objects that cannot be grasped, each with a checkbox (show in the viewport) and a shield (MoveIt obstacle) – Table (shield = *Floor collision*), Lab room (display only), ZED stand (always an obstacle, `zed_stand` from `moveit_floor_collision`; with a pan-tilt head under the camera (clamp, turntable, fork with axle bolt; the profile ends below the head). The ZED M pose is the calibration `zed_camera_link`, so it can only be dragged in the viewport while *Settings › Virtual Objects* is open with *Zed M Camera* selected: drag the camera = swivel around the profile + height, drag the profile/head = height only; on hover **handles** appear at the joint: blue ring around the profile = swivel only, double arrow on the profile = height only, value as badge at the pointer; **tilt** via the small **tilt dot** at the tripod thread: click → menu with one row per axis, each with its own circular-arrow icon – *Rotate* (swivel, 1°), *Height* (joint height above the table in mm, 5 mm, also typed into the number field + Enter; lowest 50 mm, below the pallet magazine bar the stand then stands on the floor), *Tilt* (1°, *0°* = level, range −30…90°) –, each with − / + (hold to repeat faster) and value (while the Virtual Objects page is closed the menu explains how to unlock it); the tripod thread stays in place, values go into the Virtual Objects page like the sliders (*unsaved* until *Save*)); in the scene *Logistics - auto palletizing* also Conveyors, Safety fence (both with shield; the fence is hidden on start, its collision stays on), Stack light & marking (stack light on a pole with table clamp at the far table edge x+, behind the pallet magazine) and Info screen (`3d_virtual_infoscreen` on a swivel arm with table clamp at the long table side, x = 0.58 m, turned towards the *Fit view* perspective, screen upright; both display only; **adjustable with the mouse**: drag the screen or arm = swivel around the column and slide up/down on it (0.17–0.43 m above the table top), drag the clamp ring = height only, steep top view = swivel only; while the pointer is over the screen the same **handles** appear: blue ring around the column = swivel only, double arrow = height only (value as badge at the pointer); **tilt** via the tilt dot at the clamp ring: the same menu (Rotate 1°, Height 5 mm, Tilt 1°), tilt −20…+45°, default 0°, the screen tilts about the back of its VESA plate; double-click on the screen = default position; position and tilt are kept per browser, `js/twin/joint_drag.js` + `joint_targets.js` + `tilt_dots.js`). Both buttons click the same switches as *Layers › Environment* and *Planning › MoveIt* (rows *Conveyors / Safety fence / Stack light & marking / Info screen* in *Layers › Palletizing* and *Conveyor collision / Fence collision*, only visible in that scene), so state and confirmation are shared; shield off = yellow with warning icon. Cell collision belongs to `virtual_object_detections`: `/ui/set_virtual_objects` `{"collision": {"conveyors"|"fence": bool}}` → latched `/ui/environment_collision`; every switch into the palletizing scene turns both back on.
>     - **Layers and Planning panels (`js/layer_bar.js`):** Replace the former layer bar with its five flyouts. **Layers** (key **L**) = display only, four columns with their own tint in the header, in the scene *Logistics - auto palletizing* five (panel wider) (teal Environment: ground grid, lab room, CAD edges, two-tone paint (elbow link3, wrist link5 and base dark grey like the real arm; off = whole arm white), table, ZED stand, virtual cameras, 5 cm ruler · sky Palletizing (palletizing scene only): conveyors, safety fence, stack light & marking, info screen · sky Objects: scene objects, grasp items · indigo Vision: *Detection display* (tag *GLOBAL* in its own line under the title: box + grasp point of all detected objects in every scene, display only) with the sub-rows object names and XYZ values (labels of the objects, remembered while the display is off), distance line · violet Safety: safety zone). Each column has a checkbox for all / none / mixed and a counter; the button shows `on/total`. **Planning** = changes how the robot moves: MoveIt (confirm path (ghost), object collision, floor collision) with a status chip (grey = not running + link to the Nexus Webapp, green = running) and Simulation (SIM physics, virtual objects, reset objects; FAKE only). Switching a collision **off** asks for confirmation inside the row (focus on *Keep on*); a collision that is off while MoveIt runs, or a hidden safety zone, turns the row yellow with the reason and puts a yellow dot on the button. Panels open under their button and stay inside the viewport; only one is open, Esc, a click next to it and every motion start close it. The switch ids are unchanged (`.layer-row[id]` is mirrored in the VR HUD). The HUD tabs dock via their header to the four inner edges; the layout survives a reload (`js/hud_dock.js`). If a side edge is too short for its tabs (e.g. 1280 × 800), every tab keeps at least its header and the edge scrolls with the mouse wheel (`fitSideDocks` in `digital_twin.js`).
>     - **Proximity heatmap (Layers › Safety, `js/twin/proximity_heat.js`):** Off by default (remembered per browser). When on, every robot link is tinted by its own distance to the Z collision level (lowest point of its meshes in the robot base frame): neutral from 50 mm, warm yellow → orange below 50 mm, red below 15 mm; the wrist (`link4`, `link5`) also by the singularity index from `safety.js` (REACH %, same thresholds). Base and J1 stay neutral. Display only; computed once per frame after new joint values and recoloured only when the level changes. Collision and singularity pulses take precedence.
>     - **Reachability volume (Layers › Safety, `js/twin/reachability.js`):** Off by default (remembered per browser). Visualizes the precomputed 3D reachability and manipulability workspace of the xArm Lite 6 (~440 mm reach, joint limits) as a performant Three.js `InstancedMesh` (35 mm voxel grid). Colored by the Yoshikawa manipulability index $\sqrt{\det(J J^T)}$: green = high dexterity / optimal control reserve, yellow/orange = transitional mobility, red = near kinematic singularities (such as boundary stretch or wrist alignment). Semi-transparent (`depthWrite: false`) with a fine table-anchoring base ring ($r = 440\text{ mm}$), ensuring arm links and scene objects stay fully visible inside the cloud.
>       <br><img src="../img/rcu_layers.png" width="560" alt="Layers (key L): four columns Environment, Objects, Vision, Safety – display only.">
>       <br><sub><i>Layers (key L): four columns Environment, Objects, Vision, Safety – display only.</i></sub>
>       <br><img src="../img/rcu_planning.png" width="300" alt="Planning: MoveIt (Confirm path, Object collision, Floor collision) and Simulation (SIM physics, Object detection, Reset objects).">
>       <br><sub><i>Planning: MoveIt (Confirm path, Object collision, Floor collision) and Simulation (SIM physics, Object detection, Reset objects).</i></sub>
>     - **Adaptive Viewport Icons:** The icon bar in the viewport (54 px, 45 px when narrower, 36 px) and the MOTION icons (57/60 px) grow when there is room. The level is measured, not guessed: if MOTION would be clipped, the next smaller level is used (also after collapsing/expanding a panel).
>     - **Distance Line as a Glowing Beam:** The distance line is an animated beam (a mesh instead of a 1 px WebGL line) with a bright core, a soft glow and light pulses running from the TCP to the target, a glow point at both ends and a spreading ring at the target. Close to the target it changes from cyan (from 15 cm) to green (at 3 cm) and the pulses get faster.
>     - **System Load (status bar, formerly SYSTEM tab):** The chip *CPU · GPU* in the status bar opens a popover that shows CPU and GPU load and RAM and VRAM usage of the PC in percent, each with a 60 s sparkline on a fixed 0–100 % scale (like the traffic graph in the Nexus Webapp header); from 90 % a row is highlighted. The values come every second from `/api/sys_load` of `server.py` (`/proc`, `/sys/class/hwmon` and `nvidia-smi`, measured only while the UI asks) - same origin, so it also works in the Quest browser (8443). Below: CPU and GPU temperature and uptime – the same card as in the Touch Panel.
>       <br><img src="../img/rcu_system_tab.png" width="300" alt="Popover of the status bar chip CPU · GPU: load and memory with 60 s sparklines, temperatures and uptime.">
>       <br><sub><i>Popover of the status bar chip CPU · GPU: load and memory with 60 s sparklines, temperatures and uptime.</i></sub>
>     - **Global Speed (safety bar):** The speed override `−` / `60%` / `+` in the header (5 levels, tooltip e.g. `3/5 (60%)`; the SPEED tab in the viewport is gone since N18.10) controls everything: MoveIt Servo/jogging and the gamepad via `/ui/robot_control/set_speed_index` (factors 0.1–0.5) and at the same time MoveTo, initial pose and scans via `/ui/scan_speed` (levels 1–2 = Slow, 3 = Normal, 4–5 = Fast).
>     - **Rotations in Degrees:** The POSE fields (Roll / Pitch / Yaw) and the joint values show angles in degrees. The services (`/ui/execute_move_to_pose` etc.) still receive radians; the UI converts.
>     - **Physics Sandbox (FAKE only):** *Planning › Simulation › SIM physics* turns the TF tuner objects (cube, rectangle, cylinder) and the grasp objects (bottle, steel ball, rubber ball, bowl, basket) into Rapier physics bodies (`lib/rapier/`, `js/sandbox.js`); the robot links push them as kinematic hulls. The vacuum gripper (buttons or gamepad A) picks an object only with a gap ≤ 5 mm, a tilt ≤ 20° and the suction cup fully on the surface – a ring and a mm readout at the cup show it. Object poses go back through the TF tuner (TF, RViz, virtual objects); MoveIt (`move_group` and Servo) receives `/planning_scene` diffs and the held object as `AttachedCollisionObject` on `link_eef`. With the VLA-M agent the arm can pick, carry, place and stack the virtual objects.
>       <br><img src="../img/rcu_physics.png" width="300" alt="Settings › PhysiX Sandbox while running: Rapier 0.21, bodies/colliders, world (gravity presets, time scale), solver.">
>       <br><sub><i>Settings › PhysiX Sandbox while running: Rapier 0.21, bodies/colliders, world (gravity presets, time scale), solver.</i></sub>
>   - 🦾 **Motion & planning**
>     - **Virtual Teleoperation & Ergonomic 1080p Fit:** Cartesian jogging uses **rings**: *Translate* = four X/Y segments around the 2D analog joystick plus a vertical **Z lever** (drag = Z speed proportional to the travel, springs back to the middle on release; *Z+* / *Z−* at its ends move like buttons, also in step mode), *Orient* = roll/pitch segments inside, **yaw** as the outer ring (arrow tips show the direction). Segments light up in their axis colour while held. **Keyboard:** segments and *Z+* / *Z−* are reachable with Tab (focus ring), holding Enter or Space = jog, release or focus loss = stop; key repeat does not restart, in step mode one step per press (`js/jog.js`). The *Translate* / *Orient* headers show the **live TCP pose** (X/Y/Z in mm, R/P/Yaw in ° in link_base, 0.1 resolution; near ±180° roll and yaw count on up to ±190° instead of flipping sign; on narrow columns in a second line). A compact control box on top holds frame (Base/TCP), step size (Hold, 1/5/10 mm or °) and a slim **Speed** bar with 5 levels (tap = level, −/+; level 5 amber) that mirrors Speed in the header - same value, the header stays the fixed place. Joint jogging works by dragging horizontally on the J1–J6 joint bars. Below the rings a status row shows **MoveIt** (Servo state: Off, Ready, Moving; yellow *Near singularity* / *Near collision*, red *Stopped: …*), **Reach** (bar + %, distance to the wrist singularity J5: yellow below 50 %, red below 20 %) and **Floor** (TCP height above the Z Collision Level in mm, yellow shortly above, red at or below); normal values stay neutral. The ids (`#moveit-badge`, `#hud-manip-*`, `#hud-floor-val`) are unchanged, the VR HUD reads them. The whole interface fits on standard 1080p monitors without vertical scrolling.
>       <br><img src="../img/rcu_jogging.png" width="360" alt="Right column (area Move): Cartesian Jogging with frame Base/TCP, step Hold/1/5/10, speed bars, Translate ring with joystick and Z lever, Orient ring with yaw; below MoveIt state, gripper and joints J1–J6.">
>       <br><sub><i>Right column (area Move): Cartesian Jogging with frame Base/TCP, step Hold/1/5/10, speed bars, Translate ring with joystick and Z lever, Orient ring with yaw; below MoveIt state, gripper and joints J1–J6.</i></sub>
>     - **Structured Joint Telemetry Grid:** Joints J1–J6 are arranged in an ergonomic 2-column grid with dedicated header labels (`#38bdf8`) and bold monospace angles, paired with a visually separated card for Linear Axis shift commands.
>     - **Path Preview (Ghost Robot):** The **Confirm Path (Ghost)** switch in the Planning panel (MoveIt) - or the ghost icon next to Δ in the MoveIt popup - toggles the preview (`/ui/set_moveto_preview`). On: every MoveTo (Go, gizmo, scan position, "Approach from above") is only planned, a translucent cyan clone drives the path in the twin in real time on a loop, and a line shows the TCP path. The MoveIt popup offers *Execute path* / *Discard* with a countdown to automatic discard.
>     - **Ghost Mode Plans Immediately:** With the preview on, releasing the gizmo or clicking a Move button (viewport toolbar) plans at once and shows the ghost path; the Execute button (Play) then moves the robot. The *Auto-Move* checkbox is hidden in ghost mode - the ghost itself is the confirmation step.
>     - **MOTION Buttons with Confirmation:** Without ghost mode and with *Auto-Move* off, Initial Pose, Align TCP and Scan Position in the Move group of the viewport toolbar and *Go* in the POSE panel (shows the target X/Y/Z; invalid input is reported right away) behave like the viewport gizmo: the click opens the confirm popup ("INITIAL POSE" / "ALIGN TCP" / "SCAN POSITION"), the robot only moves after *Execute* (X discards). With *Auto-Move* on they move immediately. In ghost mode all three show a ghost path first (Initial Pose then runs through MoveIt instead of the direct joint trajectory). The emergency stop and voice commands always act immediately.
>       <br><img src="../img/rcu_moveit_popup.png" width="460" alt="Scan position clicked with Auto-Move off: target X/Y/Z, steps IK · PLAN · CONFIRM · EXECUTE, Execute path (Enter) / Discard (Del).">
>       <br><sub><i>Scan position clicked with Auto-Move off: target X/Y/Z, steps IK · PLAN · CONFIRM · EXECUTE, Execute path (Enter) / Discard (Del).</i></sub>
>     - **MoveIt Popup (Progress, Gizmo Target, Confirmation & Target Object Badge):** The popup sits centered directly below the viewport toolbar, next to the navigation gizmo (in the flow, no overlap) on a translucent background (compact, max. 560 px wide). It integrates live TCP Gizmo target coordinates (`TARGET X/Y/Z`, distance Δ to real TCP) with the **Auto-Move** checkbox, and during a MoveTo displays the steps IK → PLAN → EXECUTE with live timers, progress bar, rejected candidate paths and the result or error. When an object is selected or approached, its name is prominently shown in the popup header (e.g. `📦 SPORTS BALL`). With Auto-Move off, releasing the gizmo (> 3 mm or > 2°) immediately runs IK and planning; once the path is accepted the popup shows *CONFIRM PATH* and *Execute path* only moves it (no ghost, auto-discard after 15 s; the countdown sits in its own line). Dragging the gizmo again discards the waiting path and plans the new target. With path preview active, the same button confirms the ghost path. It auto-hides after motion (5 s on success, 12 s on failure). Fed by `/ui/moveit_motion_state`; steps also appear as `[MoveIt]` lines in the log.
>       <br><img src="../img/rcu_moveit_exec.png" width="560" alt="During execution: state EXECUTING, times per step, waypoints and duration; the viewport frame turns green and the E-STOP fades in at the bottom.">
>       <br><sub><i>During execution: state EXECUTING, times per step, waypoints and duration; the viewport frame turns green and the E-STOP fades in at the bottom.</i></sub>
>     - **TCP Gizmo in its Familiar Look:** The gizmo keeps using the TransformControls from three.js r128 (`lib/three/addons/controls/TransformControls_r128.js`, as an ES module); the rest of the twin runs on r186. The local copy adds `setAppearance(length, thickness)` and `setOpacity()` for the Settings section.
>     - **Zone Around the Robot Axis = Warning Only:** If the gizmo target lies in the measured unreachable zone, coordinates and Δ turn red and the log warns - nothing is blocked anymore (neither Auto-Move nor *Execute path*), MoveIt decides. Up to 20 mm outside the zone there is an orange pre-warning; the REACH display drops to 0 % at the zone boundary. The former live message "SELF-COLLISION / INNER CYLINDER" is gone; singularities and collisions during operation are reported by MoveIt Servo.
>     - **No Announcement at the Target:** "robot moves to initial pose / scan position" is skipped if the arm already stands there (joints within 0.02 rad of the initial pose, TCP within 3 mm of 300/0/400 mm) and while the click only plans a preview.
>     - **SEQUENCES Section (Waypoints & Motion Sequences):** Records and replays motion sequences. Step types: *Waypoint* (current TCP pose, driven via MoveTo – IK and collision-free MoveIt planning like the gizmo), *Home* (initial pose), *Gripper* (open / closed / off, waits for `/ui/gripper_state`), *Wait* (seconds) and *Approach* (a detected object from above). A new waypoint goes behind the selected step; drag to reorder, double-click to rename. Playback starts only after confirmation; each move only counts as done when `/ui/moveit_motion_state` reports `succeeded` for exactly this run – failure, E-stop or a timeout end the sequence, *Stop* ends it after the current step. Motion buttons are locked while a sequence runs. Sequences are stored on the PC (`/api/sequences` → `~/.config/robot_control_ui/sequences.json`), so desktop, Quest 3 and Touch Panel share them (`js/sequence.js`). Step-by-step help: guide **Record & play a sequence** in *Guides* (area bar footer, 9 steps: create, start pose, waypoint, gripper, more step types, next waypoints, edit, manage, play); an empty step list links to it (*Step-by-step guide*). **Place:** page *Sequences* of the task window **Teach** (area bar, `js/task_window.js`).
>       <br><img src="../img/rcu_sequences.png" width="320" alt="Area Teach: sequence picker with PLAY, Add step (Waypoint, Home, Object, Open, Close, Grasp, Wait) and the step list.">
>       <br><sub><i>Area Teach: sequence picker with PLAY, Add step (Waypoint, Home, Object, Open, Close, Grasp, Wait) and the step list.</i></sub>
>   - 📦 **Objects, grasping & collision**
>     - **YOLO Grasp Integration:** Direct visualization of the 3D YOLO object list alongside an input field to trigger the grasp execution sequence remotely.
>       <br><img src="../img/rcu_objects.png" width="300" alt="Area Vision › Detected Objects: source tiles Camera (real) / Virtual, then every object with position, distance, Move to, collision shield and menu.">
>       <br><sub><i>Area Vision › Detected Objects: source tiles Camera (real) / Virtual, then every object with position, distance, Move to, collision shield and menu.</i></sub>
>     - **Virtual Objects:** The **Object detection** switch in the Planning panel (Simulation; tag *GLOBAL*: applies to all graspable objects of every scene, Standard and Auto palletizing) switches `virtual_object_detections` via `/ui/set_virtual_detections` (white = off, greyed out = node not running). Blue Cube, Red Rectangle, Green Cylinder and the grasp objects (bottle, steel ball, rubber ball, bowl, basket; IDs 904–908, bowl and basket with the grasp point on the inner bottom) from the TF tuner then appear like YOLO detections in the viewport, in the *Detected Objects* list and in VR (via `/ui/virtual_bboxes_3d`) - with grasp sphere, context menu and MoveIt collision walls. A pin toggle in the *Detected Objects* section (title and *Object detection* tile) decides whether a `DELETEALL` (e.g. from the IP camera YOLO) keeps the virtual objects (default) or clears everything like RViz.
>     - **Object Context Menu & Viewport Grasp Spheres:** Clicking the red grasp sphere directly in the 3D viewport or selecting an entry from the detected object list opens the unified context menu: *Approach from above* (collision-free trajectory to a pre-position 70 mm above the grasp point, followed by a straight descent until the suction cup is 2 mm above the grasp sphere (object top) – collision-free, and the physics sandbox grips right away (gap ≤ 5 mm), virtual objects too. The height follows the tool MoveIt loaded (`/ui/tcp_length_mm`, motion handler): with the finger-gripper URDF (`add_gripper`) the TCP goes lower by the length difference so the fingers reach around the object, limited by the object height (fingers at least 5 mm above the ground). The menu shows the offset (e.g. `+2 mm`). The goal pose may touch the target object only with the fingers, never with the suction cup. With Auto-Move off the arm stops at the pre-position: the first *Execute* in the MoveIt popup only moves there, the descent needs a second *Execute*. With Auto-Move on it runs through, in ghost mode both parts are shown as a ghost), *Grasp* / *Place … here* / *Put back* (see below); collision is a tile in the quick setup (see below, the VR object card keeps the entry *Disable / Enable collision for this object*, `/ui/set_object_collision`). Virtual objects (`… (virtual)`, IDs 901–908) get *Settings* as the last entry: it opens the Settings window on the **Virtual Objects** page with the matching element already selected (e.g. `Cylinder (virtual)` → *Green Cylinder*); objects detected by the camera have no Virtual Objects element and therefore no such entry. The header shows the grasp point coordinates in the axis colors (X red, Y green, Z blue, each with its `mm` unit).
>       <br><img src="../img/rcu_object_menu.png" width="400" alt="Object menu of the cube: Quick setup tiles (Visible, Collision, Label, Lock, Ghost), Approach from above, Grasp, Translate, Set approach gap, Settings.">
>       <br><sub><i>Object menu of the cube: Quick setup tiles (Visible, Collision, Label, Lock, Ghost), Approach from above, Grasp, Translate, Set approach gap, Settings.</i></sub>
>     - **Quick setup (object menu):** A row of five tiles under the header; each tile shows icon, name and state (`on`/`off`, solid or dashed frame), the menu stays open. *Visible* hides frame, collision walls, labels and the body of this object in this viewport – the grasp sphere stays so the menu remains reachable, MoveIt still avoids the object. *Collision* switches the MoveIt collision of the object (`/ui/set_object_collision`); on REAL each switch needs a second click (`confirm?`), off = orange tile `OFF` plus the line *MoveIt ignores this object – the robot may hit it*. *Label* hides name and coordinates of this object only. *Lock* blocks *Translate*, *Approach from above* and *Grasp* for this object (*Put back* stays possible). *Ghost* shows frame and body see-through (25 %). Visible, Label and Ghost are kept per browser (localStorage `rcu.objQuickSetup`, key = object name) and only affect this UI. **Lock** and the **Approach gap** apply to all clients and the VLA agent: the node `object_settings` (started with the Robot Control UI launch, server only) keeps them in `~/.ros/rcu_object_settings.json`, takes changes on `/ui/set_object_setting` (JSON `{name, lock}` or `{name, approach_gap_mm}`, `null` = default) and publishes the state latched on `/ui/object_settings`; without the node the Lock tile and the slider are greyed out with a tooltip. `vla_bridge` refuses *pick* of a locked object (code `locked`, the agent does not retry).
>     - **Set approach gap (object menu):** Second to last entry, directly above *Settings*; expands below it. **Approach gap** = distance suction cup → grasp sphere when approaching from above, per object, 2–20 mm in 0.5 mm steps (default 2 mm, button *Reset to 2 mm*). It is used by *Approach from above*, the sequence step *Approach* and *Grasp* (`vla_bridge` `grasp_pose`). The lower limit stays 2 mm – closer, the suction cup would touch the object in MoveIt (target in collision); above ~5 mm the suction may not hold. Locked objects keep their gap (slider greyed out). The entry *Set approach gap* always shows the current gap as value badge (`2 mm`).
>     - **Colours in the object menu:** the icon field shows the kind of action – blue = the robot moves (*Approach from above*, *Grasp*, *Put back*, *Place*), light blue = information (*Package information*), indigo = only the scene changes, no robot motion (*Translate*, hint X · Y · Z in axis colours), violet = settings (*Set approach gap*, *Settings*, same colour as the Settings section), orange = collision off. Values (mm, package ID) appear as badge.
>     - **One-click Grasp and Place here:** *Grasp* in the object menu (and the **Grasp** button next to the *Manual Grasp Target* field, which opens the same menu) runs the whole pick in one go: approach from above (gripper yaw search), suction on, grip check, lift 80 mm. While something is held the menu of another object offers *Place … on here* / *in here* (containers such as bowl and basket), the held object's own menu offers *Put back*, and a **click on the table** in the viewport opens *Place … here* at that spot. The steps are executed by `vla_bridge` via `/vla/skill` (JSON `{id, skill, object/target/x_mm/y_mm, confirmed, source}`) - the same skills and checks as the VLA-M agent (reach, free spot, room for the gripper body next to tall objects), without a language model and without re-planning. Progress and **Abort** appear in the VLA-M section, the result in the log, a refusal as a notice with the reason. With the **REAL** robot the menu item asks inline first (second click, amber frame); `vla_bridge` refuses unconfirmed commands (`real_require_confirm`) and needs `allow_real_motion`. Greyed out with a tooltip when the *VLA-M Bridge* card is not running or VLA-M is busy.
>     - **Pick & Place to … (object menu):** While nothing is held, the object menu (viewport click or object card; not the VR object card) offers *Pick & Place to …*. It switches the viewport to target selection: a bar above the viewport (`#pp-bar`, in the flow like *Looking through*) shows *Click the target on the table or on the pallet*, the steps *1 Approach · 2 Grasp · 3 Place* and **Cancel (Esc)**, the pointer becomes a crosshair. A click on the table takes X/Y in mm, a click on an object (pallet, bowl, carton) places on / into it. A popover then lists the three steps and **Start Pick & Place**; `vla_bridge` runs both as ONE task (`/vla/skill` `{id, actions: [{skill: pick, object}, {skill: place, x_mm, y_mm | target}], confirmed, source}`, at most 2 actions): same checks as *Grasp* / *Place here*, progress 1/2 → 2/2 and one **Abort** in the VLA-M section. REAL: *Start* asks inline first (second click); virtual objects stay locked. Test: `tools/grasp_e2e.py --quick`, case PP.
>     - **Translate a Virtual Object (object menu):** For virtual objects the menu offers *Translate* (above *Settings*): X/Y/Z arrows like the TCP gizmo in *Move* mode appear on the grasp sphere, dragging them moves the object - the robot does not move. The position goes into the Virtual Objects page element of the object (clamped to its slider limits) and from there to TF, `virtual_object_detections`, MoveIt collision, physics sandbox and the other clients; afterwards *Approach from above* / *Grasp* work at the new spot. While active the TCP gizmo takes no input; *Esc* or *Done translating* in the menu ends it. Disabled while the object is held. Keep the position after a reload: *Settings › Virtual Objects › Save*.
>     - **Package information (object menu, cartons only):** In the palletizing scene the menu of a carton (`Carton L1` … `S3`) has *Package information* (hint: package ID). A click unfolds the data inside the menu, a second click folds it: package ID (`PKG-L2`), size class, real size in the Euro module grid (e.g. 600 × 800 × 400 mm, the scene shows 1:6), weight, load on top (`max_stack_kg`, *none* for fragile cartons), handling (*fragile* with a warning icon) and the state in the current palletizing plan (*planned / placing now / placed · step n of N · layer L*, *stays on the conveyor - reason*, or *No plan yet*). Data: `CARTON_SPECS` in `js/twin/logistics_cell.js` (same as `CARTONS` in `virtual_object_detections.py`), plan from `/vla/pallet/plan` (`palletCartonStatus` in `js/pallet.js`).
>     - **Gripper Controls (Vacuum & Lite 6 Gripper):** The three buttons now actually drive the gripper. The command goes via `/ui/gripper_cmd` to `joy_to_servo_node`, which also handles gamepad buttons A/B and is therefore the single owner of the gripper state (`/ui/gripper_state`, latched) - gamepad toggle and UI stay in sync. Which gripper is attached comes from the launch argument (`add_vacuum_gripper:=true` → vacuum via `/ufactory/set_vacuum_gripper`, buttons *Release / Suction / Off*; `add_gripper:=true` → Lite 6 gripper via `open/close/stop_lite6_gripper`, buttons *Open / Close / Off*). Without either, the buttons are locked. In FAKE mode the gripper is simulated (`simulate_gripper:=true` in the FAKE launch; `/ui/gripper_simulated` shows a *SIM* badge), so buttons, gamepad A/B, sequences and the physics sandbox work without hardware. With a real gripper the new state is reported only after the driver confirms the command (`ret = 0`); if it refuses, the state stays unchanged and the log names cause and fix (e.g. clear the robot error, then switch again).
>     - **Vacuum gauge (Move › Gripper, `js/vacuum_gauge.js`):** Only with the vacuum gripper: bar 0 … −800 mbar with value (mono, unit), green *holding* from −400 mbar, yellow *no seal* while suction is on without vacuum. REAL: value from `/ui/gripper_vacuum` (`std_msgs/Float32`, mbar, negative = vacuum); the Lite 6 vacuum gripper has no pressure sensor (the driver only reports on / off), so without that topic the card says *No vacuum sensor*. FAKE: simulated from the gripper state and the physics sandbox (object held ≈ −620 mbar, suction on without object ≈ −60 mbar), hatched bar, *SIM* badge and *≈* before the value.
>     - **MoveIt Collision Toggles:** Two switches in the Planning panel (**MoveIt › Object collision**, **MoveIt › Floor collision**; switching off asks for confirmation) switch the MoveIt collision of the detected objects (`/ui/set_moveit_collision_objects`) and of the ground (`/ui/set_moveit_collision_ground`) on and off. Green = ON, red outline = OFF, grey = node not running. The objects stay visible in the viewport either way.
>     - **Ground Collision Off = Z Collision Level Off:** When the MoveIt ground collision is switched off in the Planning panel, the UI (jog, MoveTo, gizmo, warning banner) and `teleop_pre_collision_checker` (gamepad) no longer block downward motion either. If `moveit_floor_collision` is not running, the block stays active as a fallback.
>     - **Ground Collision Popup (`ground_popup.js`):** Appears only when the floor collision switch in the Planning panel is switched **on**, at the bottom centre of the viewport in its own grid row above the E-stop (no overlap with POSE & co.). The field is prefilled with the last confirmed Z Collision Level (TCP height, stored in the browser); +/- and typing only change the field. Only **OK** (or Enter) applies it: immediately to the UI floor guard and via `/ui/set_ground_collision_level` to `moveit_floor_collision`, which moves the MoveIt box and reports the valid (clamped) value back latched on `/ui/ground_collision_level`. Unchanged and without interaction the popup hides again after 10 s.
>   - 🛑 **Safety & control**
>     - **E-Stop in the Viewport + Space Bar:** The emergency stop sits at the bottom centre of the viewport, in its own grid row above the POSE panel. It is hidden by default and fades in as soon as the robot moves (joint states), fading out 1.5 s after it stops. Once pressed and latched it stays visible, the viewport gets a pulsing red frame (like a collision) and the orange *Reset* button appears next to it to acknowledge the stop. The **space bar** triggers the emergency stop at any time, also while the button is hidden (except in text fields). While latched, the motion buttons (Initial Pose, Align TCP, Scan Position, Go) are greyed out and disabled - clicking them plays neither the click sound nor a voice - and `motionAllowed()` blocks every motion, including voice commands and the gizmo.
>     - **Deadman Principle for Jogging:** Jog commands only run while something is actually held. Releasing anywhere on the page, losing focus, switching tabs, a context menu, closing the page or losing the connection stops every motion immediately (log entry `Deadman: jog stopped (...)`). MoveIt Servo additionally halts after 0.2 s without a command.
>     - **Collision Walls & Servo Stop Distance:** The collision walls of detected objects appear red transparent in the twin (only while object collision is enabled, otherwise just the frame). When the TCP gets closer than 2 cm to a wall - MoveIt Servo's stop distance - that object's walls glow amber and pulse.
>     - **Connection Loss:** Without rosbridge an overlay covers the entire control surface (the header stays free) and every motion function is locked - showing offline duration, reconnect attempts and a reload button.
>     - **MoveIt Servo Monitoring & Gripper Glow:** Dynamic UI indicators (Green/Orange/Red) with pulsing animations that mirror MoveIt collision/wait states in real-time, plus persistent glowing active state highlights for the gripper controls (`Open`, `Close`, `Off`).
>     - **Remote Control Section:** Client side of the server/client control ([7.5](running.html#75-remote-control-server-client-communication)): mode chip (FAKE / REAL / DETECTING; *WATCHDOG OFF* without watchdog), location (*This PC (server)* or *Remote · IP*), owner with one large centered button in its own row (*Take control* / *Request control* filled blue, *Release control* outlined blue, *Take over* amber, *Cancel request* neutral; second line names the consequence), *Arm gamepad* (REAL), *Remote gamepad* forwarding (browser Gamepad API → `/remote/joy`), a max speed slider (10–100 %, capped by the server limit), the list of open clients and the URLs for clients. On the robot PC every request from another client opens an **Allow / Deny** popup; without a running watchdog the UI locks nothing itself, but jog and E-stop reset need the watchdog. On the robot PC the UI signs heartbeat and requests with the server token from `/api/remote_info` (only for 127.x, [7.5](running.html#75-remote-control-server-client-communication)) (`js/remote.js`).
>       <br><img src="../img/rcu_remote.png" width="340" alt="Area Remote Teleop › Remote Control: mode and location, control lock (Release control), remote gamepad with max. speed, clients and the addresses for the home network.">
>       <br><sub><i>Area Remote Teleop › Remote Control: mode and location, control lock (Release control), remote gamepad with max. speed, clients and the addresses for the home network.</i></sub>
>   - 🎛️ **Settings, cameras & assistants**
>     - **Settings Popup (gear "Settings" in the viewport toolbar):** All settings live in one popup instead of their own sections. It grows out of the gear button and starts below the header, so E-STOP, mode and status stay visible and usable. Left: navigation - *All settings* (every group on one page, group titles can be dragged to reorder) or a single page, grouped by task: **Interface** - *Appearance* (theme, UI zoom, area bar auto-hide / pinned, reset viewport panel positions), *Sounds* (all sounds and volume, then one list per group with on/off checkbox, sound file and play button - the same checkboxes as the speaker popover) and *Layout & profiles* (presets, profiles, My view - the incl. *Load My view* / *Save as My view*); **3D viewport** - *TCP Gizmo*, *Frame Axes*, *Virtual cameras*; **Robot & scene** - *Virtual Objects*, *PhysiX Sandbox* (physics parameters, formerly the section "SIM: PhysiX Settings"). Every setting has one home here; the speaker and gizmo popovers are quick access with a link to their page. A chip in the page header shows where the values are stored (PC, this browser or both); where a part differs (e.g. sound files on the PC), the group says so. Single pages show no second group title; an orange dot at the navigation and at the gear button marks unsaved groups, *Save all* in the footer stores them. It opens docked by default: a sidebar directly right of the area bar on the left, without dimming (not modal); the dock button in the popup header switches between docked and a centered popup - viewport and controls stay visible, e.g. for calibrating with the Virtual Objects page. Docked, the navigation sits on top as one row of three group boxes (*Interface*, *3D viewport*, *Robot & scene*), one tile per page with icon above a short name (*Theme*, *Sounds*, *Layout*, *Gizmo*, *Axes*, *Cameras*, *Virtual Objects*, *PhysiX*; full page name as tooltip and `aria-label`), active tile filled violet, unsaved page = dot in the tile corner; below 420 px dock width the groups stack, the centered popup keeps the list on the left; *All settings* is then the *Show all* toggle in the page header (click again = back to the last page); the layout preset *Calibrate* opens it like this. Esc, *Done* or a click next to the popup closes it; page and dock mode are remembered per browser (`js/settings_modal.js`).
>       <br><img src="../img/rcu_settings.png" width="300" alt="Settings docked left of the viewport: groups Interface / 3D viewport / Robot & scene, here the Virtual Objects page (Zed M Camera) with Live TF and Saved.">
>       <br><sub><i>Settings docked left of the viewport: groups Interface / 3D viewport / Robot & scene, here the Virtual Objects page (Zed M Camera) with Live TF and Saved.</i></sub>
>     - **Settings Groups:** The popup holds three saved groups, each with its own **Save** badge and reset button: the *Virtual Objects* (Transform, formerly Virtual Objects; below), the *TCP Gizmo* appearance in the viewport - **line length** (50-250 %, arrow length in translate mode, ring radius in rotate mode), **line thickness** (1-10, 1 = the original thin line; thicker lines are drawn as tubes because WebGL lines are always 1 px) and **opacity** (gizmo and ghost TCP marker) - and *Frame Axes*: RViz-style RGB axis crosses (X red, Y green, Z blue) for any selected frame. Chips select robot frames (URDF links `link_base` … `link_tcp`, movable joints marked J1-J6 - a link frame is the frame of the joint before it) and scene frames (`world` plus the Virtual Objects page frames, placed exactly at their TF pose). Shared style: axis length (cm), thickness (mm, 0 = 1 px line), opacity, frame-name labels (stacked when origins coincide) and *On top* (visible through the robot model); *Visible* hides all without losing the selection. Changes show live in the viewport (desktop and Quest 3); **Save** stores them on the PC (`/api/settings` → `~/.config/robot_control_ui/settings.json`), so every start loads the same look.
>     - **Virtual Objects: Transform (Settings popup, formerly Virtual Objects) - Shared and Saved on the PC:** Every tuner change goes latched onto `/ui/tf_tuner_state`; all open clients (desktop, Quest 3, further tabs) adopt the newest state and broadcast identical transforms instead of fighting over the same frames with their own values. The TF stamps use the ROS server time (offset via `/rosapi/get_time`), so a client whose clock runs ahead (e.g. the Quest) no longer publishes poses that tf2 ignores. The **Save** badge in the Virtual Objects page group stores all values on the PC (`/api/tf_tuner` → `~/.config/robot_control_ui/tf_tuner.json`), so desktop and Quest 3 load the same state on every start; it shows *Save* (unsaved changes), *Saved* or *Retry* (error). On page load the saved state wins over the browser's `localStorage`, only a shared state that is already running is newer. While the virtual objects are on, the tuner publishes the frames of the three scene objects even with "Live TF" off. **Size** (only cube, rectangle, cylinder and the grasp objects; 25–300 %, 100 % = original dimensions, slider, number field and − / +) scales an object uniformly around its bottom: digital twin, physics sandbox (colliders and mass), RViz markers and `virtual_object_detections` (bounding box, grasp point, MoveIt walls) via `/ui/scene_object_sizes`. The value is part of the shared and saved tuner state; *Reset* sets it back to 100 %. **Stand** (only *Zed M Camera*, 0.02–1.0 m) = length of the vertical pole from its foot to the camera's tripod thread; the foot stands on the floor or, in the palletizing scene with equipment, on the pallet magazine bar below. Not a value of its own: the slider moves the camera in Z, Z / roll / pitch change the length in turn (`js/tf_tuner.js`).
>     - **Camera Livestreams with Stream Details:** Three sections: *Live Stream* and *Live Stream 2* (Raspberry Pi cameras 192.168.0.xxx / .123, single JPEG frames from `cam_pic.php` polled one after another) and *ZED M Live Stream* (MJPEG via `web_video_server`, mode selectable in a dropdown). While the table camera evaluation runs (`yolo_3d_bbox_for_ip_cam`, vision bringup with `zed_m:=false ip_cams:=true`), *Live Stream 2* automatically shows its image with overlay (ArUco markers with 6D axes and table position, YOLO boxes with table coordinates) via `web_video_server`; the layers button in the panel header switches between overlay and raw image, and if no overlay image arrives the panel falls back to the Pi image. Next to each heading a small detail line shows: for the Pi cameras `resolution · JPEG · measured fps · host` or `offline · host`, for the ZED stream `resolution · MJPEG · source format (BGRA8 / MONO8 / 32FC1) · Cam <grab_resolution> @ <grab_frame_rate> fps` (camera parameters of the ZED node via `/rosapi/get_param`, every 15 s). The resolution is always the one actually received; a tooltip shows all details including the topic. If a stream delivers no frame, **all three panels** retry with a growing delay (3, 6, 12, 24 s) and give up after five attempts instead of reconnecting forever: the overlay then reads **No camera** and offers a **Try again** button. The log only records an actual mode change and the one give-up line, no longer every single attempt. For the ZED panel the 15 s `rosapi` topic scan re-arms the stream by itself once the topic reappears, so a camera plugged in later is picked up without a reload. All texts in the Robot Control UI are English; only the voice command reference stays bilingual, since those entries are the phrases actually spoken.
>       <br><img src="../img/rcu_cameras.png" width="300" alt="Area Vision › Cameras: ZED M stream with mode, both Raspberry Pi streams (offline, retry counter) and the virtual cameras of the twin.">
>       <br><sub><i>Area Vision › Cameras: ZED M stream with mode, both Raspberry Pi streams (offline, retry counter) and the virtual cameras of the twin.</i></sub>
>     - **VLA-M Section (Vision-Language-Action Chat):** Chat with the VLA backend `vla_bridge` (see [4.3](vla.html#43-vla-m-vision-language-action-chat-in-progress)). Status chips show the state (`OFFLINE` / `IDLE` / `THINKING` / `RUNNING` / `ERROR`), the model and the rate in Hz; without `/vla/status` for 3 s the section shows `OFFLINE` and sends nothing - messages only land in the chat with a note. Below: chat history (suggestions while empty), a **Planned actions** list with **Execute** / **Abort** and step progress (numbered round markers, state pill `waiting for confirmation` / `step 3 / 5` / `plan only`, finished steps with a check mark and struck through, current step highlighted; Abort left, Execute right - while running and for *plan only* only Abort remains), the input field (Enter sends, Shift+Enter adds a line, grows up to 120 px), a microphone button for **dictation** (publishes `dictate` on `/ui/voice_listen_trigger`: the Voice Command Listener records up to 8 s from the PC microphone through Whisper, runs **no** voice commands and answers on `/ui/voice_dictation`; the text lands in the input field and is sent only with Enter; without the Whisper card a hint says what to start), **Confirm before execute** (on by default - without it the plan starts at once), the model switch **Model: Local | Claude | Gemini** (publishes `/vla/llm`: local Ollama model, Claude API or Gemini Robotics-ER; the active choice has a check mark, locked while a task is open, the tooltip names the model; the header chip shows `Local · qwen2.5:14b` or `Cloud · <model>` with a chip or cloud icon; a model that is not set up yet (no API key, package missing, model not downloaded) gets a warning triangle and cannot be chosen; its tooltip names cause and fix, a click (or tap) opens a small hint with the same text below the switch (✕ or a second click closes it) - `vla_bridge` checks this every 10 s, a key saved later counts without a restart) and the camera the agent should use. Below the options, **Record demo** records a demonstration for VLA training (`demo_recorder`, see [VLA roadmap step 4](vla.html)): the task is the text in the input field; while recording, the row shows `● REC` with time, steps and camera frames plus *Save* / *Discard*; greyed out with a tooltip when the recorder is not running. The agent may ask back (state `clarify`) or plan again after a failed step (`replan`); a plan not yet released disappears when a new instruction is sent, **Clear** also publishes `/vla/reset` (the agent forgets the conversation), and the state chip shows `ERROR` when the language model is missing. Module `js/vla.js`, topic names in `js/config.js` (`vla*`), styles `.vla-*` in `style.css` (rose tint, flex layout only - works in every column, narrow widths and the light theme). Included in all layout presets (right column below Speech Control, collapsed in *Laptop*). Chips for **mode** (FAKE / REAL) and **scene** (e.g. `3 objects · 3 virtual`, tooltip with the list and the sandbox state); the suggestions in the empty chat come from the detected objects. If execution is locked in REAL mode, the plan shows *plan only – not executed*; *Execute* also passes `motionAllowed` (E-stop, connection, control lock). **Large window:** the button with the expand icon in the section header opens VLA-M as a popup in the style of the Settings popup (`js/vla_modal.js`, markup `#vla-modal` at the end of `index.html`): conversation on the left (chat grows with the window, larger input field), cards on the right for **Planned actions** (Execute / Abort), **Scene** (object list with height and `virtual` tag - a click puts „Pick up the …“ into the input), **Backend** (agent, model, rate, robot mode, motion, gripper, held object) and **Options**. Chat, input, plan and options are moved into the popup (same ids, no copy) and back when it closes; meanwhile the section shows „Show here“. The popup starts below the header (E-STOP and mode stay visible), Esc / Done / click outside closes it, by default it opens docked as a non-modal sidebar right of the area bar, the dock button switches to a centered popup (saved per browser). As soon as the agent moves the robot, a centered popup docks itself so the viewport stays free. Only one window (Settings, VLA-M, task window) is open at a time (`js/app_window.js`).
>       <br><img src="../img/rcu_vla.png" width="300" alt="Area Assistant (VLA): chips IDLE · Local qwen2.5:14b · FAKE, chat, planned actions with Abort / Execute, model switch and Record demo.">
>       <br><sub><i>Area Assistant (VLA): chips IDLE · Local qwen2.5:14b · FAKE, chat, planned actions with Abort / Execute, model switch and Record demo.</i></sub>
>     - **Acoustic Feedback & System-Wide Mute:** Every button click plays a short UI sound (`sounds/ui_mouse_click.mp3`), and motion commands are accompanied by pre-rendered German voice announcements (e.g. `_voice_robot_moves_to_scan_pos.mp3`). Dedicated voice cues alert the operator when a target is out of reach: `_voice_object_out_of_reach.mp3` when approaching an object (red grasp sphere or entry of the detected object list), `_voice_pose_out_of_reach.mp3` for TCP gizmo and MoveTo pose targets (IK failure, collision/singularity during planning, invalid workspace bounds, rejected paths). MoveIt failures are taken from the structured `/ui/moveit_motion_state` (`phase: failed`), not from the wording of log lines; E-stop (`aborted`) and discarded plans stay silent. A further cue confirms execution when approaching a target (`_voice_robot_moves_to_selected_object.mp3`, strictly debounced to 1x per sequence). The speaker button in the viewport toolbar opens a small popover: *All sounds* (key M) mutes the whole system, and one checkbox per sound (grouped into *Sound effects* and *Voice announcements*, each group with a select-all box) switches single sounds on/off for this browser; *All sound settings* leads to Settings > Sounds (volume, sound file per sound). The icon shows the state (`fa-volume-high` all on, `fa-volume-low` some off, `fa-volume-xmark` all off). The *All sounds* state is stored per browser and published every 2 seconds on **`/ui/sound_enabled`** (`std_msgs/Bool`), which `robot_motion_handler_movegroup`, `yolo_planned_grasp_executor` and `gaze_grasp_routine_tobii_glasses` subscribe to (the periodic publish lets nodes started later pick up the state). Muting the Web UI therefore silences the robot-side voice output as well. If playback is blocked (e.g. by the browser autoplay policy), the failure is reported explicitly in the console log instead of failing silently. Toggling the MoveIt collision icons announces "collision detection enabled/disabled", and an error sound (`sounds/error_sound.mp3`) plays when the moving robot actually runs into a collision - singularities stay silent (live telemetry, not MoveIt planning; 2.5 s cooldown). Moves via the viewport TCP gizmo skip the "robot moves to absolute pose" announcement.
>     - **Color-Coded Log (Diagnostics drawer):** Live, scrollable log with syntax highlighting (axes, numbers, topics, units) where source tags (`[...]`) dynamically match the exact color tone of their message type (success, warning, error, action, info) for instant visual scanning. It only auto-scrolls while you are at the bottom and keeps the last 500 entries.
>       <br><img src="../img/rcu_diagnostics.png" width="100%" alt="Diagnostics drawer above the status bar: filters All/Info/Warn/Error, source and search, blackbox/pause/copy/clear; here the log of a MoveIt run.">
>       <br><sub><i>Diagnostics drawer above the status bar: filters All/Info/Warn/Error, source and search, blackbox/pause/copy/clear; here the log of a MoveIt run.</i></sub>
>   - 🧱 **Architecture & web server**
>     - **Architecture (ES Modules, three.js r186):** The former `app.js` is split into ES modules under `js/` (`ros`, `jog`, `safety`, `motion`, `gizmo`, `grasp`, `audio`, `layout`, `presets`, `theme`, `columns`, `panel_snap`, `persist`, `log`, `logui`, `status`, `header`, `toolbar`, `settings`, `tf_tuner`, `voice`, `streams`, `ground_popup`, `robot_limits`, `uievents`, `util`, `vr_mirror`, `sysload`, `vla`, `vla_modal`, `remote`, `sequence`, `guides`, `guides_data`, `sandbox`, `hud_dock`, `areas`, `layer_bar`, `cam_pip`, `console_drawer`, `palette`, `settings_modal`, `physics_settings`, `usage_stats`, `sound`, `gamepad`), the digital twin and the VR modules (`xr.js`, `xr_hud.js`, `xr_controls.js`, `xr_ui.js`, `xr_moveit.js`, `xr_nozzle_cam.js`, `xr_objcard.js`, `xr_feedback.js`, `xr_mirror_send.js`, `xr_mirror_worker.js`, `lab_room.js`) live in `js/twin/`. Instead of global `window.*` functions, elements carry `data-action` attributes dispatched by `js/main.js`. All topic and service names are centralised in `js/config.js`. three.js r186, urdf-loader 0.13 and the Rapier physics engine (`lib/rapier/`) are vendored under `lib/` (import map, offline-capable); the twin only renders on changes or running animations. The log is capped at 500 lines, polling intervals pause while the tab is hidden.
>     - **Web Server without Manual Cache Busting:** `server.py` replaces `python3 -m http.server`: JS/CSS/JSON/URDF are served with `Cache-Control: no-cache` plus an ETag (modification time in ns + size; unchanged → 304 via `If-None-Match`, so reloads no longer re-download e.g. the 2 MB three.js), HTML with `no-store`, and `index.html` automatically gets `?v=<mtime>` on every script and stylesheet URL. In addition it serves small JSON APIs: `/api/header_status` (header badges), `/api/sys_load` (SYSTEM tab), `/api/tf_tuner` (saved TF tuner values), `/api/settings` (saved values of the Settings popup; only known fields, clamped to their ranges), `/api/sequences` (SEQUENCES tab), `/api/vcams` (virtual cameras), `/api/remote_info` (LAN addresses for the Remote Control section), `/api/sounds` (sound list for *Settings › Interface*) and `/api/cam_snapshot` (single camera frames for the VR camera window). Every request is filtered by client IP (`--clients local|subnet|lan|<CIDR>`, from `remote_access` / `remote_clients`).
>     - **Central Sounds Directory (`sounds/`):** All acoustic notification and voice feedback files live in the workspace root directory `~/dev_ws/sounds/`. The web server (`server.py`) maps `/sounds/...` directly to this central folder without requiring duplicate files or symlinks inside the package.
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/joint_states`** | `sensor_msgs/JointState` | *Mirrors the physical joints synchronously in the browser UI.* |
>> | **`/ui/eef_position`** | `std_msgs/Float32MultiArray` | *TCP position and orientation for EEF telemetry, the Z collision level and the safety evaluation.* |
>> | **`/servo_server/status`** | `std_msgs/Int8` | *Controls the green/red alert pulses in the Web UI.* |
>> | **`/zed/bboxes_3d`** | `visualization_msgs/MarkerArray` | *Fills the object list and draws frames, grasp spheres and labels in the digital twin.* |
>> | **`/ui/voice_feedback`** | `std_msgs/String` | *Flashes voice-triggered actions directly in the Web Log.* |
>> | **`/ui/voice_status`** | `std_msgs/String` | *Displays real-time Whisper listening status and transcriptions.* |
>> | **`/ui/robot_control/current_speed`** | `std_msgs/Float32` | *Syncs UI speed sliders with the backend level.* |
>> | **`/ui/collision_msg`** | `std_msgs/String` | *Displays collision warnings in the Web Log.* |
>> | **`/ui/grasp_status`** | `std_msgs/String` | *Forwards grasp status strings to the web console.* |
>> | **`/ui/motion_status`** | `std_msgs/String` | *Status messages from `robot_motion_handler_movegroup` (prefix INFO/WARN/ERR/SUCCESS/ACTION) for the log.* |
>> | **`/joy`** | `sensor_msgs/Joy` | *Mirrors the physical gamepad state into the browser UI.* |
>> | **`/visualization_marker_array`** | `visualization_msgs/MarkerArray` | *Renders the `scene_objects` markers inside the Digital Twin.* |
>> | **`/zed_visual_markers`** | `visualization_msgs/MarkerArray` | *Renders the ZED-M camera stand and scene meshes in the Digital Twin.* |
>> | **`/dashboard/workspace_metadata`** | `std_msgs/String` (JSON) | *ROS_DOMAIN_ID, RMW and ROS_LOCALHOST_ONLY for the status bar.* |
>> | **`/ui/moveit_motion_state`** | `std_msgs/String` (JSON) | *Drives the MoveIt progress popup in the viewport.* |
>> | **`/ui/moveit_collision_objects_enabled`** | `std_msgs/Bool` | *State of the "collision objects" toggle icon.* |
>> | **`/ui/moveit_collision_ground_enabled`** | `std_msgs/Bool` | *State of the "collision ground" toggle icon.* |
>> | **`/zed/yolo_collision_markers`** | `visualization_msgs/MarkerArray` | *Collision walls of the detected objects (red transparent in the twin).* |
>> | **`/ui/disabled_collision_objects`** | `std_msgs/String` (JSON) | *Objects with collision switched off (context menu).* |
>> | **`/ui/moveto_preview_enabled`** / **`/ui/moveto_preview_path`** | `std_msgs/Bool` / `std_msgs/String` (JSON) | *State of the ghost icon and the path awaiting confirmation.* |
>> | **`/ui/gripper_state`** / **`/ui/gripper_type`** | `std_msgs/String` | *Gripper state and configured gripper.* |
>> | **`/ui/joy_button_presses`** | `std_msgs/String` | *Gripper feedback from the gamepad node in the log.* |
>> | **`/ui/emergency_stop_active`** | `std_msgs/Bool` | *Latched emergency stop (reset button next to the E-stop).* |
>> | **`/ui/ground_collision_level`** | `std_msgs/Float64` | *Current Z Collision Level (mm) for jog/MoveTo blocking and the ground popup.* |
>> | **`/ui/virtual_bboxes_3d`** | `visualization_msgs/MarkerArray` | *Virtual detections of `virtual_object_detections` for the object list, the twin and VR.* |
>> | **`/ui/virtual_detections_enabled`** | `std_msgs/Bool` (latched) | *State of the Virtual Obj. button.* |
>> | **`/ui/tf_tuner_state`** | `std_msgs/String` (JSON, latched) | *Shared TF tuner state of all clients (newest wins).* |
>> | **`/ui/scene_object_sizes`** | `std_msgs/String` (JSON) | *Virtual Objects: size factor per object frame, e.g. `{"target_blue_cube": 1.5}` - sent with the TF frames (on change, otherwise every second).* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/remote/twist`**, **`/remote/joint_jog`** | `std_msgs/String` (JSON) | *Cartesian / joint jog with the client id → twist gate of `remote_control_watchdog` → `/servo_server/delta_*_cmds` (lock owner only, floor guard).* |
>> | **`/servo_server/delta_joint_cmds`** | `control_msgs/JointJog` | *Commands precise joint jogs per click.* |
>> | **`/ui/robot_control/set_speed_index`** | `std_msgs/Int32` | *Saves the speed scale changed via web slider.* |
>> | **`/ui/scan_speed`** | `std_msgs/Int32` | *Level derived from the speed override for MoveTo/scans (0: Slow, 1: Normal, 2: Fast).* |
>> | **`/ui/emergency_stop_topic`** | `std_msgs/Empty` | *Publishes immediate non-blocking software emergency stop.* |
>> | **`/linear_axis_cmd`** | `std_msgs/Float64` | *Publishes the command to move the linear axis.* |
>> | **`/ui/grasp_object_cmd`** | `std_msgs/String` | *Triggers autonomy pipeline actions.* |
>> | **`/ui/voice_listen_trigger`** | `std_msgs/String` | *Signals voice listener node to begin speech recording.* |
>> | **`/ui/safety_zone_params`** | `std_msgs/Float32MultiArray` | *Publishes updated dynamic safety zone parameters `[x, y, radius]`.* |
>> | **`/tf_static`** | `tf2_msgs/TFMessage` | *Virtual Objects (Settings popup): publishes the configured transforms latched, only when a value changes (plus a refresh every 2 s for nodes started later), while "Live TF" is on; the scene object frames also while the virtual objects are on. Static frames never go stale, so a background tab no longer floods the MoveIt logs with "extrapolation into the past".* |
>> | **`/ui/tf_tuner_state`** | `std_msgs/String` (JSON, latched) | *Every tuner change, so all open clients broadcast identical values.* |
>> | **`/ui/sound_enabled`** | `std_msgs/Bool` | *Publishes the acoustic feedback mute state so other nodes stay in sync.* |
>> | **`/ui/gripper_cmd`** | `std_msgs/String` | *Gripper command (`open` / `close` / `off`).* |
>> | **`/ui/set_object_collision`** | `std_msgs/String` (JSON) | *Disables / re-enables one object's collision (context menu).* |
>> | **`/ui/set_ground_collision_level`** | `std_msgs/Float64` | *Z Collision Level (mm) from the ground collision popup.* |
>
>
> ![Services](https://img.shields.io/badge/Services-FF1493?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/execute_initial_pose`** | `std_srvs/srv/Trigger` (Client) | *Commands robot to return to home/initial position.* |
>> | **`/ui/execute_move_to_pose`** | `xarm_msgs/srv/MoveCartesian` (Client) | *Sends absolute XYZ Cartesian coordinates to motion handler.* |
>> | **`/ui/execute_move_to_pose_silent`** | `xarm_msgs/srv/MoveCartesian` (Client) | *Same MoveTo without voice announcement - used by the viewport TCP gizmo.* |
>> | **`/ui/set_moveit_collision_objects`** | `std_srvs/srv/SetBool` (Client) | *"Object collision" switch in the Planning panel (MoveIt).* |
>> | **`/ui/set_moveit_collision_ground`** | `std_srvs/srv/SetBool` (Client) | *"Floor collision" switch in the Planning panel (MoveIt).* |
>> | **`/ui/set_moveto_preview`** / **`/ui/confirm_moveto_preview`** | `std_srvs/srv/SetBool` (Client) | *Ghost icon and "Execute path / Discard" in the MoveIt popup.* |
>> | **`/remote/control_request`** `reset_estop` | `std_msgs/String` (JSON) | *Reset button next to the emergency stop: the watchdog calls `/ui/reset_emergency_stop` for the lock owner / server PC; answer in `control_state.results`.* |
>> | **`/ui/approach_from_above`** | `xarm_msgs/srv/MoveCartesian` (Client) | *"Approach from above" in the object context menu.* |
>> | **`/ui/plan_move_to_pose_confirm`** / **`/ui/approach_from_above_confirm`** | `xarm_msgs/srv/MoveCartesian` (Client) | *Gizmo release / "Approach from above" with Auto-Move off: plan first, move after *Execute*.* |
>> | **`/rosapi/nodes`** | `rosapi/Nodes` (Client) | *Detects the running hardware mode (Fake Arm vs. Real Arm) from the node list.* |
>> | **`/rosapi/get_param`** | `rosapi/GetParam` (Client) | *`robot_ip` of the driver ("Real Arm" badge) and `grab_resolution` / `grab_frame_rate` of the ZED node (stream details).* |
>> | **`/rosapi/topics_for_type`** | `rosapi/TopicsForType` (Client) | *Finds the ZED image topics that actually exist for the mode dropdown.* |
>> | **`/rosapi/get_time`** | `rosapi/GetTime` (Client) | *ROS server time as the offset for the TF stamps of the tuner.* |
>> | **`/ui/set_virtual_detections`** | `std_srvs/srv/SetBool` (Client) | *"Object detection" switch in the Planning panel (Simulation) and in Detected Objects.* |
>
> *The emergency stop is dispatched over the non-blocking topic `/ui/emergency_stop_topic`, not over the `/ui/emergency_stop` service. The services `/ui/execute_move_joint` and `/ui/emergency_stop` are provided by `robot_motion_handler_movegroup` and are used by the RViz control panel, not by this Web UI.*

</details>

---

<br>

> [!TIP]
> **Operating details of the Robot Control UI**
> - **Header = safety bar (N18.8):** on the right a fixed group that never wraps and also stays in the collapsed header: **Mode** (FAKE / REAL) · **robot state** · **speed override** (`−` / `60%` / `+`, 5 levels, also the voice commands *faster* / *slower* and the VR HUD) · **Control** · **E-STOP**. *Control* is the control lock of `remote_control_watchdog`: the chip shows who may move the robot (*free*, *you* / *this PC*, another client in yellow, own request in blue, *–* without watchdog); a click opens exactly the actions that apply right now – *Take control* (on the server PC) or *Request control* (clients, the server PC approves), *Release control*, *Cancel request*, *Take over* (server, with confirmation). Clients, gamepad and access stay in the *Remote Control* section. Below ~1500 px labels shrink to dot + short value (tooltip). **One motion at a time (`js/motion_busy.js`):** while the arm is busy the robot state reads **BUSY · source** (e.g. *Home*, *Gizmo target*, *Sequence "Pick" 3/7*, *VLA-M task*, *Palletizing 2/8*) – sources are `/ui/motion_busy` plus the running sequence, VLA-M task or palletizing run, including the gaps between their steps. Meanwhile every other motion command (toolbar *Home* / *Align* / *Scan pose*, *Go*, gizmo, jog, *Approach* / *Grasp* / *Place*, gripper, sequence *Play*, palletizing *Start*, voice, VR HUD) is blocked: buttons are disabled with the reason in the tooltip, a click elsewhere logs `⏳ … not started - the robot is busy: …` (warning, no out-of-reach sound; the backend answer *Already executing* is shown the same way). Only the running sequence sends its own steps. Jogging stops when a motion starts and needs a new press afterwards (hint below the rings). A path waiting for *Execute* does not count as busy – a new target replaces it. **Stop** next to *BUSY* ends the running sequence / VLA-M task / palletizing and halts the arm via `/ui/halt_motion` (no E-STOP, nothing to acknowledge). Left of it, as its own group, the **view switches** like in the Nexus Webapp footer: **theme pill** (sun = Light, moon = Dark) and **UI zoom** `−` / `100 %` / `+` (70–150 % in 10 % steps, applies immediately without reload, click on the value = *Auto*: 100 % on the desktop, 150 % in the Quest browser); both are stored in this browser only and are the same values as *Settings > Appearance*. Below 860 px the group is hidden so the E-STOP stays visible.
>   <br><img src="../img/rcu_header.png" width="100%" alt="Header: Record, Screenshot, theme, zoom – then the fixed safety group Mode FAKE ARM · IDLE · Speed 60 % · Control this PC · E-STOP.">
>   <br><sub><i>Header: Record, Screenshot, theme, zoom – then the fixed safety group Mode FAKE ARM · IDLE · Speed 60 % · Control this PC · E-STOP.</i></sub>
> - **Capture (header, left of the view switches):** **Record** starts / stops a video of the whole UI window, **Screenshot** saves a PNG of it. Chrome asks once per recording which tab to share (choose this tab; the screenshot outside a recording asks too, during a recording it takes the frame from the running video). The **gear** opens the recording settings (this browser only): format MP4 / H.264 or WebM / VP9 (a format the browser cannot record is greyed out), resolution 1280 × 720, 1920 × 1080 (default), 2560 × 1440 or window size (window aspect ratio kept), 30 / 60 fps, quality 4 / 8 (default) / 16 Mbit/s, and the save location; settings are locked while a recording runs. Screenshot in full window resolution. Everything is saved locally on this PC: by default in the browser downloads folder, after **Choose folder** in a folder of your choice (Chrome / Edge folder picker, remembered; the browser shows only the folder name; without write access it falls back to the download, **Downloads** switches back) - `rcu_<date>_<time>.mp4` / `.webm` / `.png`; the log names file, length, size and place. While recording, the group turns red with a **LIVE** badge, a stop symbol and the running time; *Stop sharing* in the Chrome bar also stops and saves. Only on secure addresses (this PC via 127.0.0.x / localhost, or https) - elsewhere the buttons are disabled with a tooltip. Below 1440 px icons only, below 860 px hidden unless recording (`js/screen_record.js`).
> - **Status bar (N18.8):** the technical status sits at the bottom, in the flow below the columns: ROS 2 Bridge (address, round trip), input devices, services, DDS, usability-test run, **system load** (chip *CPU · GPU*, yellow from 90 %, popover with CPU/GPU/RAM/VRAM sparklines, temperatures and uptime - formerly the SYSTEM tab) and the last warning/error (click opens the log). Popovers open upwards. The arrow on the right collapses the bar (ROS 2 Bridge, last message and the arrow stay), stored per browser. When the page scrolls (height < 800 px) the bar stays at the bottom edge.
>   <br><img src="../img/rcu_status_bar.png" width="100%" alt="Status bar: ROS 2 Bridge with round trip, input devices, participant, Services 6/6, DDS (domain · RMW · LH), CPU · GPU, Diagnostics.">
>   <br><sub><i>Status bar: ROS 2 Bridge with round trip, input devices, participant, Services 6/6, DDS (domain · RMW · LH), CPU · GPU, Diagnostics.</i></sub>
> - **Diagnostics drawer (N18.11, formerly *Console*):** the log is no longer a section in a column but a drawer directly above the status bar (in the flow - the columns get shorter, nothing is covered; with the status bar it stays at the bottom edge when the page scrolls). *Diagnostics* in the status bar opens/closes it; while it is closed a badge counts new warnings and errors (without browser audio notices and connection retries). Height via the grip on the top edge (drag, or arrow up/down / Page up/down on the grip), 120 px up to 60 % of the window. Level filter, source, search, pause, Blackbox, copy and clear sit in its head row; a click on the last message in the status bar opens it filtered. Open/closed and height are stored per browser and in the layouts (presets, *Save current layout*, layouts saved on the PC – `server.py` `/api/layouts` keeps `console` and `statusbar`); without your own choice it starts open from a window height of 900 px, closed below. *Operate* opens it, *Laptop (compact)* closes it and collapses the status bar. Module: `js/console_drawer.js`.
> - **Area bar (N18.9):** a narrow bar left of the viewport groups the UI by task instead of technology; each button opens or closes the place of its task, nothing is rearranged any more. Every group is its own small section (`.area-sect`: tile with its own background and an even 1 px border, heading on top); 12 px between the groups, 9 or 6 px when the window is too low, so the list does not scroll. **Reorder groups:** drag a group by its heading (hand cursor, dashed placeholder at the target; bar open or pinned) or press **Alt+Arrow up/down** while a button of the group has focus; the groups at the top and the footer groups (Help, System) are reordered separately, the pin stays at the bottom. The order is saved per browser (`area_rail_order`), *Settings > Appearance > Area bar order > Reset to default* restores it. Default order from top to bottom: **Scene:** **Standard** and **Auto palletizing** (also opens the task window **Palletizing**; a second click on the active scene opens / closes the window) - exactly one is active (filled, `aria-pressed`); switches the set of virtual objects (`/ui/set_virtual_objects` `{"scene": …}`, state latched on `/ui/virtual_scene`, so every browser sees the same scene) and turns the virtual objects on if they are off. *Auto palletizing* shows the Euro pallet, 8 cartons on two infeed conveyors and the palletizing cell in the viewport (`js/scenes.js`, `js/twin/logistics_cell.js`; details in *Vision & Grasping › virtual_object_detections*). **Operate:** **Move** (right column with *Cartesian Jogging*, joints, linear axis and gripper - the button collapses / expands the column), **Teach**, **Assistant (VLA)** and **Remote Teleop** (task windows, see below). **World:** **Vision** (task window, see below), **Viewport** (task window with the tools of the viewport toolbar, see below) and **Physics objects** (opens the Settings page *PhysiX Sandbox* docked right of the bar: gravity, solver, materials and gripper of the virtual objects, FAKE only; second click closes; *SIM physics* in the viewport stays as it is). Fixed footer - **Help:** **Guides** (column on the right, stays visible next to every task window; below the search *Command palette* (Ctrl K) and *Keyboard shortcuts* (?)); **System:** **Diagnostics** (Diagnostics drawer below the viewport, status bar expanded), **Settings** (same popup as the gear in the viewport toolbar, also *Layout & profiles* with presets, profiles and *My view*; amber dot = unsaved settings) and the pin. The bar reaches from the header down to the status bar; the Diagnostics drawer sits right of it below the work row (`.app-body` › `.app-main` in `index.html`), so an open drawer does not shorten the bar. If the buttons do not fit, the button list scrolls with a thin scrollbar and a soft fade at the edge that has more (`data-more`, `js/areas.js`); the footer always stays visible. When the page scrolls (window below 800 px high) bar, drawer and status bar stay in place (sticky). **Task windows** (`js/task_window.js`): built like the Settings popup - header with logo, title and close button, page buttons, then the page - and placed in the flow directly right of the bar (`#task-dock` in `.work-row`), so they push the viewport aside instead of covering it. Pages: *Teach* = Sequences · *Vision* = Detected Objects (list, *Keep virtual*, *Manual Grasp Target*), Cameras (ZED, Live Stream 1 + 2, virtual cameras), *Calibrate* (opens the Virtual Objects page in Settings) · *Assistant (VLA)* = VLA-M chat, Speech · *Palletizing* (no own button, opens with *Auto palletizing*) = Palletizing: *Pallet & limits* (properties, max load / height / support), plan, load bar, side view of the stack + top view per layer, order, *Stays on the conveyor* with *Take along*, ghost boxes, *Dry run*, **Plan / Start / Abort / Reset** (`js/pallet.js`, see *VLA-M › Auto palletizing*) · *Remote Teleop* = Remote Control, VR headset (*Enter VR*, *Passthrough AR*, *VR mirror window*; without a headset the buttons stay disabled and say why) · *Viewport* = Gizmo (Off / Move / Rotate, *Back to TCP*, *Auto-Move*, look sliders), Poses (*Home*, *Align TCP*, *Scan pose* - locked during motion and E-STOP like in the toolbar), Layers, Planning, Camera (*Fit view*, *Top view*, view gizmo size, collapse / reset viewport panels). The viewport toolbar stays unchanged: the *Viewport* and *VR headset* pages operate the same original buttons (`js/viewport_window.js`, `js/mirror.js` - a click goes to the original, its state comes back), so both places always show the same state; switching a collision check off asks for confirmation there too. The sections move into their page at start (same ids, no copy), keep their header with tools, are never collapsed there and are no longer part of the columns; the left column disappears when it holds no section. Only one window is open at a time, also together with Settings / VLA-M (`js/app_window.js`); Esc (outside input fields) or × closes it, open window and page are remembered per browser. Below 1100 px window width an open task window hides the Move column (*Move* brings it back and closes the window), below 860 px the window takes the full width and viewport + Move follow below. **Colour per task** (`data-task` → `--task` in `style.css`, both themes): every task has its own hue, no two alike: Move sky blue, Teach orange, Vision emerald, Assistant (VLA) fuchsia, Remote Teleop pink, Viewport indigo, Palletizing light blue, Physics objects teal, Diagnostics neutral (text colour), Guides lime, Settings purple - the same colour marks the icon, the open button (fill + border), the window (top border, header, active page) and the Move column / Diagnostics drawer / Guides column; no red or yellow (reserved for errors and warnings). The camera tiles in the viewport open *Vision > Cameras*; guides open the matching task via *Show me*. **Collapsing:** without the pin the bar shows icons only (48 px, the group tiles without headings) and opens as an overlay when the mouse or keyboard focus enters it, so the columns do not jump; about 1.5 s after the mouse leaves it collapses again. The pin keeps it open (88 px, the columns move aside). Shortcuts (fixed per task, also after reordering): **Alt+Shift+1…4** = Move, Teach, Assistant (VLA), Remote Teleop (toggle), **Alt+Shift+5** = Vision, **Alt+Shift+6** = Viewport, **Alt+Shift+7** = load My view (Alt+digit is taken by the browser tabs). Buttons at least 44 px high; spare height makes them taller (up to 64 px). Modules: `js/areas.js` (bar), `js/task_window.js` (windows, pages in `TASKS`), `js/viewport_window.js` (Viewport / VR headset pages), `js/mirror.js` (second place for toolbar tools).
>   <br><img src="../img/rcu_area_bar.png" width="64" align="right" alt="Area bar pinned open: Operate, World, Scene, Help, System.">
>   <br><sub><i>Area bar pinned open: Operate, World, Scene, Help, System.</i></sub>
> - **Guides (N18.19):** the entry **Guides** in the footer of the area bar (group *Help*, above *Diagnostics*) opens step-by-step help as its own column on the right. It pushes the sections aside instead of covering them, so every *Show me* target stays visible; below 1700 px window width the left column collapses while the guides are open and comes back when you close them. Not modal: the header with E-STOP, mode, speed and control lock stays free, task windows (*Teach*, *Vision*, *Assistant (VLA)*, *Remote Teleop*) and docked popups (*Settings*, *VLA-M*) sit on the left next to the area bar. 15 guides in five groups – **Operation:** System check, Switch to REAL safely, Recover after E-STOP, Take or hand over control · **Tasks:** Pick & Place, Task with the VLA agent, Record & play a sequence · **Setup:** Calibrate the camera (ZED pose with the Virtual Objects page), Change the tool, Set up test objects, Virtual cameras · **Input methods:** Start VR (Quest 3), Gaze control (Tobii), Voice commands · **Data:** Record a demo. Each step shows what to do, where it is in the UI (technical name in the tooltip), **Show me** (opens the matching task window on the right page - e.g. *Assistant (VLA) > Speech* - or the matching area if needed, opens the section and draws a ring with a hint around the real control for 8 s) and, where useful, a button that calls the existing function (e.g. *Take control*, *Set 20 %*, *Open Virtual Objects*, *Open Nexus Webapp*) – the guides have no motion logic of their own. Buttons that open a place (*Open Vision cameras*, *Open Virtual Objects*, *Open Diagnostics*, *Open Virtual cameras*, *New from current 3D view*) then mark it with the same ring (field `show` of the action in `guides_data.js`). You tick every step yourself (*Done – next*), checklists point by point; **required safety steps** (shield, amber) cannot be skipped and *Done* stays locked until all points are ticked. Search, *Continue* for a started guide and “done today” are remembered per browser; Esc closes, progress is kept. Module: `js/guides.js`, contents in `js/guides_data.js`.
>   <br><img src="../img/rcu_guides.png" width="280" alt="Guides column: search, Command palette, Keyboard shortcuts and the guides Operation / Tasks / Setup with steps and duration.">
>   <br><sub><i>Guides column: search, Command palette, Keyboard shortcuts and the guides Operation / Tasks / Setup with steps and duration.</i></sub>
> - **Camera tiles in the viewport (N18.12):** the viewport tab **CAMERAS** (top right, can be docked to any edge like the other tabs) shows one tile per *running* stream whose section is not open – table camera (cam2) first, then camera 1 and the ZED M. The tile copies the image of the section about 5× per second (no second stream from the camera PC / `web_video_server`). Click on the image = larger/smaller (remembered per browser), grid button or right-click = **camera layout** (area *Vision*, wide stream column, sections with all stream settings), window button = stream in its own window, gear (virtual cameras only) = settings of exactly this camera (*Settings > Virtual cameras*, docked, camera selected; on narrow tiles it replaces the grid button). Cameras that are not running appear only as a grey chip *3 cameras off* (yellow *offline* when a stream broke off; tooltip: start them via the Nexus Webapp card *Robot Vision Cameras*); a click opens the camera layout. The tiles adapt to the free space between the top and bottom edge (side by side, then in rows) and never cover POSE/TELEMETRY; if not even a 96 px tile fits (e.g. 1080 px screen with Diagnostics open), the chip only counts them (*2 live · 1 camera off*). The stream sections therefore start collapsed (default and all presets/areas except the camera layout / *Camera focus*; *Vision* keeps the ZED open). While the CAMERAS tab is collapsed or hidden, every stream whose section is collapsed or not shown pauses (no load on network, camera PC and `web_video_server`); expanding restarts it. Module: `js/cam_pip.js`.
> - **Virtual cameras:** own views of the digital twin, used like real cameras (at most 4, each costs one extra render pass). **Create:** turn the 3D view, then **+** next to the camera chip in the viewport tab CAMERAS or *Settings › Virtual cameras › New from current 3D view*; presets *Top view*, *Front view*, *Side view*, *Tool camera* (mounted on `link_eef` like the VR nozzle camera, 30° to the tool axis) and *Like ZED M camera* (on the Virtual Objects page object *Zed M Camera*, i.e. its calibrated pose – the table camera cam2 has no 3D pose, only a homography). **Looking through:** a bar above the viewport (*Looking through <name>*) – orbit, pan and zoom move the camera, a bright frame marks the image (rest dimmed); *Field of view* (10–120°, vertical), *Mounted on* (*World (fixed)*, *TCP (follows the arm)*, *Scene object: …*; changing it keeps the pose in the room), *Format* (16:9, 4:3, 1:1), *Exact values* (X/Y/Z in mm, yaw/pitch/roll in ° in the frame of the mount, pitch positive = looks down as in the Virtual Objects page); *Save* keeps it, *Cancel* / Esc discards, your own 3D view comes back either way. **Image:** only robot, scene objects and room (no gizmo, grid, frame axes, detections, safety zones or path preview), rendered from the same scene and renderer into an offscreen target, only while visible and after a scene change, at most 10 frames/s for a section and 5 for a tile only. Every virtual image carries the badge **VIRTUAL** (blue); without rosbridge it reads *VIRTUAL · no robot data* (neutral), because the twin then shows the last known pose. **Use:** one section per camera (`panel-vcam-<id>`, like *Live Stream*: crosshair, single frame as PNG with the label *VIRTUAL · name · time* burned in, full screen, collapse, drag into any column; collapsed by default and in all areas except the camera layout, where they sit below the streams) and a tile in the CAMERAS tab after the real cameras. **Manage:** *Settings › Virtual cameras* (3D viewport group): list with name, mount, field of view and format, toggles *Section* / *Tile*, buttons *Set perspective*, *Duplicate*, *Delete* (asks in the row); a click on a row opens the details (name, mount, field of view, format, X/Y/Z, yaw/pitch/roll – every change is saved at once). **Layers › Environment › Virtual cameras** shows the cameras as pyramids in the scene (tip = camera, base = image, triangle = image top; not in VR); a click on a pyramid selects the camera and opens the settings docked. Stored on the PC (`/api/vcams` → `~/.config/robot_control_ui/vcams.json`), so every browser sees the same cameras. **Send to ROS:** chip *ROS* per camera (*Settings › Virtual cameras*, FAKE only, off again after a reload) → JPEG 640 px at 15 frames/s as `sensor_msgs/CompressedImage` on `/twin/vcam/<id>/image/compressed` (the details show the topic), badge *VIRTUAL · ROS* while it sends; REAL switches it off, without rosbridge or a known mode it pauses (chip tooltip says why). Used by the `demo_recorder` for VLA training data (image source `sim`). The VR camera window does not offer them yet. Guide **Virtual cameras** (group *Setup*). Modules: `js/vcam.js`, `js/twin/vcam_render.js`.
> - **Command palette Ctrl+K (N18.16):** **Ctrl+K** (Mac: Cmd+K, also *⋮ > Command palette* in the viewport toolbar) opens a search list of all actions of the interface, top centre: layout presets, areas, safety bar, status bar, viewport, viewport tabs, every section and the settings. Look like the search of the manual: filter chips with counts (*All*, *Bars*, *Viewport*, *Sections*, *Settings*), every entry with the icon of its real button, matching words highlighted, the area as a pill on the right, keys and match count in the footer. Without a search term it is grouped by area with *Recently used* on top; with a term the best matches come first. ↑/↓ and Page up/down select, **Enter** runs, **Tab** / **Shift+Tab** switches the filter, **Esc**, the *Esc* button or a click outside closes. Running an entry clicks the real button, so motion commands go through the same checks as with the mouse (control lock, REAL confirmation, double-click lock). Buttons that are locked right now stay in the list with a lock and their reason and are not run. While the robot moves the palette does not open (no popup over the viewport). Existing keys are shown on the right (Space = E-STOP, G, M, Esc, ?); there are no new single-key shortcuts. Module: `js/palette.js`.
>   <br><img src="../img/rcu_command_palette.png" width="480" alt="Ctrl+K: 308 actions with filters Bars / Viewport / Sections / Settings.">
>   <br><sub><i>Ctrl+K: 308 actions with filters Bars / Viewport / Sections / Settings.</i></sub>
> - **Viewport at laptop width:** title on its own line, tools in one row (Ghost icon only, Move/Rotate as one toggle); the SYSTEM panel starts collapsed in a narrow viewport until you open it once yourself.
> - **Fit view:** the camera button in the view group (or the **Home** key) sets the standard perspective from the front left onto robot, conveyors, pallet and `3d_virtual_infoscreen` (`DEFAULT_CAM_POS` → `DEFAULT_TARGET` in `js/twin/digital_twin.js`, tuned for aspect ratio 1.5; narrower viewports move the camera back along the same direction); also done automatically on the first start.
> - **Detected Objects** separates real and virtual detections: two source tiles in the section head - **Camera (real)** (status from the node list: `yolo_3d_bbox_for_zed_m` = ZED M, `yolo_3d_bbox_for_ip_cam` = IP camera; *Live* with the rate of camera messages on `/zed/bboxes_3d` (marker IDs < 901, as received by the UI), *nothing detected* while ZED M + YOLO see nothing, *No data* when the IP camera node sends nothing for 5 s, dimmed with *Start in Nexus* when no camera node runs) and **Object detection** (tag *GLOBAL*, sub-line `n objects · Standard + Auto palletizing`; the same switch as *Planning › Simulation › Object detection*, plus the *Keep virtual* pin). Both sources may run at the same time; the list is grouped into *Camera* and *Virtual*, every row carries a badge **CAMERA** (camera icon) or **VIRTUAL** (shapes icon, dashed border). Each group has its own empty state with cause → fix (no rosbridge / camera not running / camera sends nothing / virtual objects off or node missing) and *Start in Nexus* or *Switch on object detection*. **REAL robot:** virtual objects (IDs from 901) stay MoveIt obstacles for every motion and for approaching real objects; *Grasp*, *Put back* and *Place here* on them are locked (list, context menu, VR object card; `vla_bridge` refuses them as well, `allow_virtual_in_real: false`), *Move to* / *Approach from above* asks for a second click.
> - **Streams:** *Try all again (n)* restarts every stream that gave up.
> - **Tests:** `?ros=off` loads the page without rosbridge (layout only), `?ros=ws://host:port` uses another rosbridge; `python3 tools/ui_new_code_checker.py` checks all web UIs isolated at 1920/1366/1280 px – Robot Control UI (incl. overlapping HUD tabs or HUD tabs sticking out of the viewport), Nexus Webapp, Touch Panel and all views of the Monitoring Dashboard in dark and light (`--pages mon,mon-light`, own database, domain 97).

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `blackbox_recorder` (`robot_blackbox_recorder`) &nbsp;&nbsp; <sub><i>`/src/robot_blackbox_recorder/`</i></sub>

**Purpose & Task:** Flight recorder for incidents. Keeps the last 60 s of important topics serialized in RAM; on a trigger it records a few more seconds and writes its own rosbag2 to `~/.ros/blackbox/<time>_<reason>/`. Only incidents reach the disk – and can be replayed in RViz or Foxglove instead of being re-enacted. Triggers: E-stop (`/ui/emergency_stop_active` → true), Servo halt (`/servo_server/status` 2 = singularity, 4 = collision), collision warning (`/ui/collision_msg`) and manually via `/blackbox/save` (`std_srvs/Trigger`) – button with the archive icon in the head row of *Diagnostics* (log drawer) of the Robot Control UI and *Save blackbox* in the Touch Panel's Log view (whitelisted in `config/network.yaml` → `rosbridge.services`); identical triggers within the cooldown count once. State on `/diagnostics`.

<details>
<summary><b>🔽 Show details</b> · Run Command</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 launch robot_blackbox_recorder blackbox.launch.py
> ```
> *Started together with `http_robot_control_ui.launch.py`; `blackbox:=false` switches it off.*

</details>

---

<br>

<a name="touch-panel-nexus-webapp-touch"></a>

### ![Web App](https://img.shields.io/badge/Web_App-E34F26?style=flat-square&logo=html5&logoColor=white) Touch Panel (`/touch`) &nbsp;&nbsp; <sub><i>`/touch_panel/`</i></sub>

**Purpose & Task:** Compact operating page for an additional touch display (USB touch + HDMI) at the robot PC. The Nexus Web Backend serves it as a Flask blueprint at `http://127.0.0.1:8080/touch` – same origin as the Nexus Webapp, so its start/stop actions pass the local-only access check. **Status bar (safety zone, the same in every view):** mode *FAKE* / *REAL* (REAL amber with frame) / *OFFLINE*, robot state (Ready / Moving / E-Stop latched / Collision near / servo warning), speed `− 60 % +` (middle = level picker, same value as in the Robot Control UI), control lock (status in words: *You have control* / *Server has control* / *Waiting for approval* / *No control lock* / *Offline*; *Request*, *Cancel*, *Release*; no button without the watchdog), chips only on deviation (*ROS* disconnected, *NEXUS* not reachable), clock (from 1100 px), menu ☰ and *STOP*. Below 560 px the bar wraps into two rows (mode · state · STOP, then speed · lock · menu). Menu on the left (top → bottom): **Move** (start view) – a green bar *Discard* / *Execute* while `/ui/moveit_motion_state` reports a path preview waiting for confirmation; card **Cartesian Jogging** with the same elements as in the Robot Control UI: control box (frame *Base* / *TCP*, speed `−` · 5 bars · `+` · value, mirror of the status bar), *Translate* = ring with X±/Y± segments (hold = move) and the joystick in the centre (drag = analog X/Y) plus the Z lever (*Z+* / *Z−* hold, drag the knob = analog Z, springs back), live pose X/Y/Z in mm above it; *Orient* = ring with roll/pitch inside and yaw outside, live R/P/Yaw in degrees; *Joints* = J1–J6; release = stop; right of it **Gripper** (Open/Close/Off or Release/Suction/Off), **Go to pose** (*Home*, *Align* – keep the position, tool straight down via `/ui/execute_move_to_pose_silent` –, *Scan* – X 300 · Y 0 · Z 400 mm via `/ui/execute_move_to_pose`) and the active or last used sequence with *Play* (tap the name → Programs); **Programs** (sequences, `/api/touch/sequences` → Robot Control UI); **Robot** (formerly *Safety*: tool position X/Y/Z/R/P/Y with servo status, joints with limits, *Safety checks* – object/table collision and path preview as switches, emergency-stop state with *Reset* –, *Who can move the robot* – control-lock owner and the input methods Touch Panel, gamepad `/ui/joy_button_presses`, voice *Speak* → `/ui/voice_listen_trigger`, VLA-M chat `/vla/status` with *Abort* → `/vla/abort`, VR Quest 3 `/vr_teleop/controller_data`, gaze; methods not running offer *Start*, which starts the matching card from `/api/config` via `/api/run` –, MoveIt motion); **Launch** (*Start*: category segments *Nodes & Launches* / *System* / *Info & Debugging* / *Topic Pubs* with card counts; sections with badge FAKE/REAL of `launcher_config.json` as two bringup tiles side by side – the tile of the current mode is framed, *Start REAL…* needs hold + confirmation; the other sections as a swipeable chip row with card count and *n running*, cards of the chosen section below; a card whose `ros2 launch/run` process is running shows *Running · time* and *Stop*, matched by package, file/executable and `key:=value` arguments of its command against `/api/touch/state`; *Running*: all `ros2 launch/run` processes, stop like Ctrl+C, *Recently started* from `/api/runs`); **System** (tabs *Load*, *Network* with ROS 2 environment, *Services* with ports, health list from `/diagnostics` and devices, *ROS graph*, *Log* with blackbox); at the bottom **Monitoring** (↗) brings an open Monitoring Dashboard window to the front – app window `--class=monitoring-dashboard` or a Chrome window whose active tab is the dashboard – otherwise opens it as its own app window (`POST /api/touch/open_monitoring`, never a new tab; error toast when port 8083 is not running). Touch targets 56 px; secondary text almost in text colour (no grey), card titles in normal case; Move fits at 1280×800, 1024×600 and 800×480 without scrolling (ring size follows the window height). While `/ui/motion_busy` reports a motion (or its own sequence runs, including the gaps between steps), further motion and gripper commands are refused with the toast *… robot busy – … is running*; *Play* is disabled. Motion requests use the same control lock and server approval as every other client ([7.5](running.html#75-remote-control-server-client-communication)). **Hold instead of dialog:** risky or irreversible actions run only after the button is held until its fill bar is full – 1 s for *Start* / *Stop* / *Kill* in Launch, *Reset E-Stop*, *Execute path*, turning off object/ground collision or path preview, opening the gripper while it holds something, deleting a sequence or step, *Close panel*; 2 s for *Stop all ROS 2 processes*. Releasing early does nothing (short hint). Motions (*Initial*, *Align TCP*, *Scan*, *Go to*, *Play*) are held in FAKE, as is *Start* of an input method; on the REAL robot they keep their confirmation dialog. Enter/Space held works like a finger; *STOP* acts immediately (`js/util.js` `setHold` / `addHoldRule`).

<p align="center">
  <img src="../img/touch_panel.png" width="49%" alt="Touch Panel – view Move with status bar and Cartesian Jogging">
  <img src="../img/touch_launch.png" width="49%" alt="Touch Panel – view Launch with bringup tiles and section cards">
</p>

*Touch Panel at 1280 × 800 (FAKE). Left: view **Move** – status bar (FAKE · Ready · speed · control lock with *Request* · clock · ☰ · STOP), Cartesian Jogging, Gripper, Go to pose and the last sequence with *Play*. Right: view **Launch** – category segments, bringup tiles RUN DEV (FAKE) / RUN DEV (REAL) with *Start REAL…*, section chips and the cards with *Start* (hold 1 s).*

<details>
<summary><b>🔽 Show details</b> · Start · Routes</summary>

> [!NOTE]
> 💻 **Start (kiosk on the touch display):**
> ```bash
> bash touch_panel/touch_panel_start.sh             # finds the HDMI touch display, maps the USB touch onto it, opens /touch as Chrome kiosk
> bash touch_panel/touch_panel_start.sh --install   # app menu entry + autostart at login
> ```
> *Nexus Webapp: card **Touch Panel (Touch-Display)** in RUN DEV SETUP, started with EXECUTE when ticked. Options: `--output HDMI-1`, `--list`, `--windowed`, `--stop`; close via menu (☰) on the panel. Without a touch display (desktop PC with a single monitor) it opens a narrow window (1024×800) at the top right instead of full screen.*
>
> **Touches land on the main monitor?** Then the USB touch is not mapped to the touch display. X11 spreads it across the whole desktop (both monitors). Auto-detection only picks monitors smaller than 13″. Some displays report a wrong size via EDID and are not found.
> ```bash
> bash touch_panel/touch_panel_start.sh --list          # monitors (xrandr) + touch devices (xinput)
> bash touch_panel/touch_panel_start.sh --output DP-5   # fix the output, saved in ~/.config/nexus_touch_panel/output
> xinput map-to-output "wch.cn USB2IIC_CTP_CONTROL" DP-5  # map by hand only (without starting the panel)
> ```
> *Lab PC setup (2026-09): touch display on `DP-5` (1920×1080 at +0+360, reports 518×324 mm ≈ 24″), main monitor `DP-6`, touch controller `wch.cn USB2IIC_CTP_CONTROL`. Under GNOME the panel start also stores the mapping by EDID (`gsettings org.gnome.desktop.peripherals.touchscreen`, path `…/touchscreens/1a86:e5e3/`), so mutter restores it by itself after the display is switched off and on, after USB replug and after reboot.*
>
>
> ![Services](https://img.shields.io/badge/Routes-FF1493?style=flat-square)
>
>> | Route | Method | Description |
>> |---|---|---|
>> | `/touch` | GET | *Page (`touch_panel/web/`); fonts, Font Awesome and roslib come from `ros2_nexus/vendor`.* |
>> | `/api/touch/state` | GET | *System load, temperatures, ports, devices (Quest via USB, gamepad, touchscreens) and running ros2 processes – measured only while someone polls.* |
>> | `/api/touch/stop` | POST | *Stops one of the listed ros2 processes including its child processes (SIGINT; SIGTERM if SIGINT is ignored; SIGKILL with `force`).* |
>> | `/api/touch/open_monitoring` | POST | *Monitoring button: raises an open Monitoring Dashboard window (WM class `monitoring-dashboard` or window title "Monitoring Dashboard", `ros2_nexus/nexus_windows.py`), otherwise starts Chrome with `--app=http://127.0.0.1:8083/` and its own profile; `503` when the dashboard is not running.* |
>> | `/api/touch/close` | POST | *Closes the kiosk window (Chrome with the panel profile).* |
>> | `/api/touch/sequences` | GET/POST | *Motion sequences – passed through to `/api/sequences` of the Robot Control UI (port 8081), so all clients share them.* |


> [!NOTE]
> **Home page:** status tiles, quick actions (≥ 64 px for gloves), system, services, recent messages, **Robot live** (six joint bars, TCP, gripper) and **Recently started** (last starts of the Nexus Webapp with state/exit code from `/api/runs`). **Robot bar:** stays in place while scrolling (from ~550 px display height), speed via −/+ or a tap on the value (level 1–5), the current gripper state is marked with ✓. **Robot › Move › Analog stick:** XY stick (up = X+, left = Y+) and Z lever; deflection = speed (quadratic, dead zone in the centre), release = stop – same dead-man logic, floor guard and control lock as the buttons (`js/jog.js`). **System › Services** also shows a **Health** list from `/diagnostics` (watchdog, collision check, rosapi, blackbox). Test without rosbridge: `/touch?rosbridge=ws://127.0.0.1:1`.

</details>

---

[⬅ Previous: VR Teleoperation (Meta Quest 3)](vr_quest3.html) · [🏠 Overview](../readme-en.html) · [⬆ Top](#top) · [Next: Digital Twin in NVIDIA Isaac Sim ➡](isaac_sim.html)
