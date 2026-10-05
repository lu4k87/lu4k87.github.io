<a name="top"></a>

# 🗄️ Archive & Deprecated Concepts

[🏠 Overview](../readme-en.html) · [🇩🇪 Deutsch](../de/archive.html) · Chapter 10

**Contents:** [10. 🗄️ Archive / Architectural Decisions & Deprecated Concepts](#10--archive--architectural-decisions--deprecated-concepts)

---

## 10. 🗄️ Archive / Architectural Decisions & Deprecated Concepts

This section documents legacy components and the architectural reasoning behind their deprecation. Understanding *why* certain concepts were replaced provides context for the current system design.

### 10.1 `motion_sequence` (Cartesian State Machine) [DEPRECATED]
Initially, the robot's grasping logic was handled by a node called `motion_sequence`, which manually interpolated Cartesian waypoints (Pre-Grasp, Grasp, Post-Grasp).
- **Why it was replaced:** This approach lacked dynamic collision awareness. The arm would blindly follow straight lines, potentially crashing into obstacles. It was replaced by `robot_motion_handler_movegroup` and MoveIt 2, which provide dynamic safety zones, obstacle avoidance via OctoMaps, and smooth spline interpolation.

### 10.2 2D Raspberry Pi Cameras vs. 3D Stereo Vision [DEPRECATED]
Early iterations relied on standard 2D webcams or Raspberry Pi cameras combined with 2D homography (ArUco markers) to estimate object positions on a flat table.
- **Status:** The 2D path is still available as a lightweight alternative (`zed_m:=false ip_cams:=true`, Pi streams in the Robot Control UI, `RUN DEV + Gaze UI (Rpi Cam) - Egocentric`); the ZED Mini is the default.
- **Why it was replaced:** 2D vision cannot perceive depth or object volumes. The system was upgraded to the ZED Mini 3D Stereo Camera. Dense point clouds combined with YOLOv8 3D bounding boxes allow for true spatial awareness, enabling the robot to grasp objects of varying heights and avoid complex obstacles that a 2D camera wouldn't see.

### 10.3 Manual Multi-Terminal Shell Scripts (`lite6.sh`) [DEPRECATED]
In the past, starting the system required launching multiple `.sh` scripts (`lite6.sh`, `start.sh`) in different terminal windows manually.
- **Why it was replaced:** This was error-prone, hard to debug, and unintuitive for new users. It was entirely replaced by the **Nexus Webapp**, a web-based orchestrator that securely manages process lifecycles, aggregates logs, and allows one-click bringup from any device.

### 10.4 ArUco Marker System [DEPRECATED]
> *[Deprecated]* Markers placed in the robot's workspace served as references for homography matrices to derive 3D world coordinates for objects on the workspace surface (Z = 90 mm). This is now mostly replaced by native 3D TF frames from the ZED camera, but remains in use for mapping the Tobii Eye-Tracker gaze coordinates to the 2D plane and on the 2D camera path (`zed_m:=false ip_cams:=true`, `yolo_3d_bbox_for_ip_cam.py`: ArUco 6D pose + homography, see 10.2).

---

[⬅ Previous: Repository Structure](repository_structure.html) · [🏠 Overview](../readme-en.html) · [⬆ Top](#top)
