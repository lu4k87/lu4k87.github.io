<a name="top"></a>

# 👁️ 3D Vision & Autonomous Grasping

[🏠 Overview](../readme-en.html) · [🇩🇪 Deutsch](../de/vision_grasping.html) · Chapter 3.3

---

## 3.3 Feature: Autonomous Grasping & 3D Object Detection (YOLO / ZED)
*This subsystem is responsible for locating objects in 3D space, generating virtual obstacles, and navigating the robot precisely to the target.*

<p align="center"><img src="../img/diagrams/vision_pipeline.svg" width="100%" alt="3D object detection and grasping pipeline"></p>

*3D object detection and grasping pipeline · source: `tools/make_diagrams.py`*

<p align="center">
  <img src="../img/rcu_objects.png" width="38%" alt="Area Vision: detected objects with virtual objects">
  <img src="../img/rcu_object_menu.png" width="52%" alt="Object menu of the cube in the viewport">
</p>

*Left: area **Vision › Detected Objects** in FAKE mode – source tiles *Camera (real)* (not running) and *Virtual* (8 objects), then each object with position in mm, distance, *Move to*, collision shield and menu. Right: object menu at the red grasp sphere of the cube – Quick setup (*Visible*, *Collision*, *Label*, *Lock*, *Ghost*), *Approach from above* (+2 mm), *Grasp* (approach · suction · lift), *Translate*, *Set approach gap*, *Settings*.*

---

<br>

### ![Launch](https://img.shields.io/badge/Launch-orange?style=flat-square) `robot_vision_cameras_bringup.launch.py` &nbsp;&nbsp; <sub><i>`/src/robot_vision_cameras_bringup/launch/robot_vision_cameras_bringup.launch.py`</i></sub>

**Purpose & Task:** The central orchestrator for the entire 3D vision, object detection, and autonomous grasping pipeline. Cameras are chosen with two switches (two checkboxes in the *Cameras* group of the Nexus Webapp): `zed_m` (default on) starts the ZED Mini hardware driver (`zed_wrapper`) alongside `pointcloud_optimizer.py` and `yolo_3d_bbox_for_zed_m.py`; `ip_cams` runs the two Raspberry Pi cameras as well (cam1 = nozzle, cam2 = table). **With ZED** both IP cameras only stream their live image (the Robot Control UI fetches it directly from the Pi). **Without ZED** the table camera does the work: `yolo_3d_bbox_for_ip_cam.py` locates objects via the ArUco markers at fixed table positions (homography + YOLO) and shows marker 6D poses and YOLO boxes as an overlay in *Live Stream 2*. The old `camera:=ip_cam` still works (= `zed_m:=false ip_cams:=true`). A line in the *YOLO Model* group shows which camera runs YOLO with the selected model (ZED M, table camera cam2, or a "not started" warning without a camera); the confidence threshold applies to both YOLO nodes. It simultaneously starts the MoveIt collision generator (`yolo_moveit_collision.py`), the trajectory grasp server (`yolo_planned_grasp_executor.py`), the UI bridge (`grasp_action_bridge.py`), the virtual object detection (`virtual_object_detections.py`, starts switched off), the RViz distance visualizer (`scene_objects_distance_to_tcp.py`), and the MoveIt Servo warnings status overlay (`servo_status.py`).

<details>
<summary><b>🔽 Show details</b> · Run Command · Parameters</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> # Default: ZED Mini 3D Depth Pipeline
> ros2 launch robot_vision_cameras_bringup robot_vision_cameras_bringup.launch.py
>
> # ZED + IP cameras (IP cameras stream only)
> ros2 launch robot_vision_cameras_bringup robot_vision_cameras_bringup.launch.py ip_cams:=true
>
> # Without ZED: table camera with ArUco + YOLO (overlay in Live Stream 2)
> ros2 launch robot_vision_cameras_bringup robot_vision_cameras_bringup.launch.py zed_m:=false ip_cams:=true
> ```
>
>
> ![Parameters](https://img.shields.io/badge/Parameters-yellow?style=flat-square)
>
>> | Launch Argument | Default | Description |
>> |---|---|---|
>> | `zed_m` | `true` | *Start the ZED Mini (driver, point cloud, YOLO 3D boxes).* |
>> | `ip_cams` | `false` | *Run the IP cameras as well. With ZED they only stream; without ZED the table camera (cam2) computes ArUco + YOLO.* |
>> | `camera` | `zed_m` | *Deprecated: `camera:=ip_cam` equals `zed_m:=false ip_cams:=true`.* |
>> | `camera_model` | `zedm` | *ZED camera model (Stereolabs ZED Mini, used when `zed_m:=true`).* |
>> | `tf_x` | `0.473` | *Calibrated camera X position relative to `link_base` [m] (Tripod setup).* |
>> | `tf_y` | `0.0` | *Calibrated camera Y position relative to `link_base` [m] (Tripod setup).* |
>> | `tf_z` | `0.368` | *Calibrated camera Z height relative to `link_base` [m] (Tripod setup).* |
>> | `tf_roll` | `0.0` | *Camera roll angle [rad] (0.0°, Tripod calibration).* |
>> | `tf_pitch` | `1.00356` | *Camera pitch angle [rad] (+57.5°, tilted downward toward workspace).* |
>> | `tf_yaw` | `3.14159` | *Camera yaw angle [rad] (180.0°, facing the robot).* |
>> | `yolo_model` | `yolov8l.pt` | *YOLO neural network weights file (default: high-accuracy YOLOv8 Large).* |
>> | `confidence_threshold` | `0.35` | *YOLO confidence threshold (default from `perception_params.yaml`).* |
>> | `ema_alpha` | `0.4` | *EMA smoothing of the 3D boxes (default from `perception_params.yaml`).* |
>> | `safe_z_hover_height` | `0.15` | *Hover height above the object [m] (default from `grasping_params.yaml`).* |
>> | `grasp_z_offset` | `0.02` | *Z offset on the object top when grasping [m] (default from `grasping_params.yaml`).* |
>> | `velocity_scaling` / `acceleration_scaling` | `0.2` / `0.1` | *MoveIt scaling of the grasp motion (defaults from `grasping_params.yaml`).* |
>
> *The YAML files stay the source of the defaults; the launch arguments only override them at start (e.g. from the Nexus Webapp).*

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `zed_camera.launch.py` (`zed_wrapper`) &nbsp;&nbsp; <sub><i>`/src/zed-ros2-wrapper/zed_wrapper/launch/zed_camera.launch.py`</i></sub>

**Purpose & Task:** The native hardware driver for the Stereolabs ZED Mini Camera (automatically included by `robot_vision_cameras_bringup.launch.py` when `zed_m:=true`).

<details>
<summary><b>🔽 Show details</b> · Run Command · Publishes · Parameters</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 launch zed_wrapper zed_camera.launch.py camera_model:=zedm
> ```
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/zed/zed_node/rgb/image_rect_color`** | `sensor_msgs/Image` | *Publishes the color-corrected 2D RGB camera image.* |
>> | **`/zed/zed_node/depth/depth_registered`** | `sensor_msgs/Image` | *Publishes the registered depth map.* |
>> | **`/zed/zed_node/point_cloud/cloud_registered`** | `sensor_msgs/PointCloud2` | *Publishes the dense 3D point cloud.* |
>
>
> ![Parameters](https://img.shields.io/badge/Parameters-yellow?style=flat-square) **(`config/zed_override.yaml` Parameter Overrides)**
>
>> | Parameter | Value | Description |
>> |---|---|---|
>> | `depth_mode` | `NEURAL` | *AI-powered neural depth estimation via TensorRT for maximum precision.* |
>> | `grab_resolution` | `HD720` | *Capture resolution 1280 × 720.* |
>> | `pub_resolution` | `NATIVE` | *Publishes at the capture resolution without downsampling (HD720: ~921,600 points/frame).* |
>> | `depth_confidence` | `100` | *100% confidence retention; prevents dropping valid depth pixels.* |
>> | `depth_texture_conf` | `100` | *Preserves textureless flat surfaces (tabletops, ground plane).* |
>> | `remove_saturated_areas` | `false` | *Prevents point cloud holes caused by specular floor/table reflections.* |
>> | `min_depth` / `max_depth` | `0.1` / `10.0` | *Broad 10-meter operational range ensuring full table and floor coverage.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `yolo_3d_bbox_for_zed_m.py` &nbsp;&nbsp; <sub><i>`/src/robot_vision_cameras_bringup/scripts/yolo_3d_bbox_for_zed_m.py`</i></sub>

**Purpose & Task:** Processes the RGB and Depth streams in parallel using GPU acceleration and the **YOLOv8 Large (`yolov8l.pt`)** model. Isolates objects, filters depth noise, and dynamically calculates millimeter-accurate 3D bounding boxes grounded to the table plane based on real 3D point cloud clusters.

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Publishes · Parameters</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run robot_vision_cameras_bringup yolo_3d_bbox_for_zed_m.py
> ```
>
>
> **Key Capabilities:**
> - **Dynamic Object Height Estimation:** Rather than relying on rigid, pre-defined box heights, the node computes the real physical height ($z_{\text{top}} - z_{\text{bottom}}$) directly from the segmented 3D points of each detected object.
> - **Dynamic Top Grasp Point (`top_z`):** Places a small red grasp sphere marker precisely at the center top of each object ($x_{\text{center}}, y_{\text{center}}, z_{\text{top}}$), automatically scaling with the object's height for safe, collision-free top-down vacuum grasps.
> - **Robust Surface Projection & Centering:** Filters out ground/table edge artifacts to center bounding boxes squarely on the physical volume of the item.
> - **EMA Tracking & Multi-Object Disambiguation:** Maintains stable, persistent global IDs using Exponential Moving Average smoothing with a 30 cm proximity threshold (a detection farther than 0.3 m from every known object gets a new ID), preventing ID swapping or box jitter. Objects of the same class are sequentially numbered (e.g., `apple_1`, `apple_2`).
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/zed/zed_node/rgb/image_rect_color`** | `sensor_msgs/Image` | *Receives the RGB image for YOLO object detection.* |
>> | **`/zed/zed_node/depth/depth_registered`** | `sensor_msgs/Image` | *Uses depth values for 3D coordinate projection.* |
>> | **`/zed/zed_node/rgb/camera_info`** | `sensor_msgs/CameraInfo` | *Reads camera intrinsics to calculate exact spatial coordinates.* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/zed/bboxes_3d`** | `visualization_msgs/MarkerArray` | *Sends finalized 3D bounding boxes, text labels, and dynamic grasp point markers (`top_z`) to RViz and downstream nodes.* |
>
>
> ![Parameters](https://img.shields.io/badge/Parameters-yellow?style=flat-square)
>
>> | Parameter | Default | Description |
>> |---|---|---|
>> | `model_path` | `yolov8l.pt` | *Neural network weights file. Set from the launch argument `yolo_model` or via the Nexus Webapp parameter chip.* |
>> | `confidence_threshold` | `0.35` | *Minimum YOLOv8 detection confidence; anything below is discarded.* |
>> | `ema_alpha` | `0.4` | *Smoothing factor (Exponential Moving Average) against box jittering between frames. Lower is smoother but slower to follow.* |
>> | `class_dimension_overrides` | `[]` | *Optional fixed metric dimensions (x,y,z) for known calibration targets. Empty by default, so every object is measured from the 3D point cloud.* |
>
> *The percentile cut-offs against depth noise ("flying pixels" at object edges) are applied inside the node and are not exposed as parameters. Defaults live in `config/perception_params.yaml`.*

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `yolo_3d_bbox_for_ip_cam.py` &nbsp;&nbsp; <sub><i>`/src/robot_vision_cameras_bringup/scripts/yolo_3d_bbox_for_ip_cam.py`</i></sub>

**Purpose & Task:** A lightweight alternative to `yolo_3d_bbox_for_zed_m.py` for setups without a ZED depth camera. Started by the bringup with `zed_m:=false ip_cams:=true`. Fetches one frame per cycle from the table camera (`ip_cams.cam2` in `config/network.yaml`, 8 Hz by default), detects ArUco markers on the table to dynamically compute a **Homography Matrix**, and runs **YOLOv8** to detect objects. The image with overlay (marker outline, 6D axes per marker via `solvePnP`, fixed table position, YOLO boxes with table coordinates, status line) is published on `/ip_cam/table/annotated`; *Live Stream 2* in the Robot Control UI shows it automatically while the node runs (button in the panel header: overlay ↔ raw image). The former webcam node `ip_cam_aruco_6pose_tf_coord` has been merged into it and removed. Projects the 2D YOLO bounding boxes into the 3D robot base frame (`link_base`) using the homography matrix. Generates and publishes the exact same 3D `MarkerArray` format to `/zed/bboxes_3d`, making it 100% plug-and-play with the existing UI and grasp executor without requiring actual depth hardware.

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Publishes</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run robot_vision_cameras_bringup yolo_3d_bbox_for_ip_cam.py
> ```
>
> Parameters: `model_path`, `camera_host` (empty = `ip_cams.cam2`), `rate_hz` (8), `confidence` (0.25), `marker_size` (0.03 m), `overlay_topic`, `overlay_width` (960 px), `show_window` (false, extra OpenCV window).
>
>
> **Key Capabilities:**
> - **ArUco Ground Plane Homography:** Continuously solves perspective distortion between 2D pixel coordinates and the real tabletop coordinate plane ($Z \approx 0$).
> - **Dynamic 3D Bounding Boxes & Red Grasp Point (`top_z`):** Generates full 3D bounding cubes and places the red grasp sphere marker (`yolo_object_grasp_center_point`) at the top center of each detected object.
> - **Seamless Downstream Integration:** Feeds directly into `yolo_moveit_collision.py` (generating MoveIt collision boxes) and `yolo_planned_grasp_executor.py` (executing autonomous pick-and-place trajectories).
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | *-* | *-* | *Fetches the HTTP JPEG stream directly (`http://192.168.0.xxx/...`).* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/zed/bboxes_3d`** | `visualization_msgs/MarkerArray` | *Publishes 3D bounding boxes, labels, and grasp point markers identical to the ZED camera output format.* |
>> | **`/ip_cam/table/annotated`** | `sensor_msgs/Image` | *Camera image with overlay (ArUco 6D pose, table coordinates, YOLO boxes), `bgr8`; only published while someone watches.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `pointcloud_optimizer.py` &nbsp;&nbsp; <sub><i>`/src/robot_vision_cameras_bringup/scripts/pointcloud_optimizer.py`</i></sub>

**Purpose & Task:** Runs in the background during the 3D Vision Bringup and prepares the ZED point cloud for two consumers. The ZED already publishes the cloud in ROS convention (`X=forward`, `Z=up`) in `zed_left_camera_frame`, so nothing is rotated here - TF resolves the rest. Parsing uses the structured numpy arrays of `sensor_msgs_py` (Humble), ~13 ms per HD720 cloud; without any consumer the node does no work at all.

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Publishes · Parameters</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run robot_vision_cameras_bringup pointcloud_optimizer.py
> ```
>
> - **MoveIt OctoMap (`cloud_optimized`):** NaN points removed, frame unchanged. **Off by default** (`publish_moveit_cloud: false`): once enabled, MoveIt treats the whole camera cloud - including the objects to be grasped - as obstacles. No cropping: MoveIt uses points beyond `ros.max_range` to clear the OctoMap along those rays.
> - **Web Digital Twin (`/zed/pointcloud_web`):** thinned to `web_max_points`, transformed to `world` via TF, at most `web_rate_hz`, and only while a client is subscribed. The Robot Control UI no longer shows the point cloud; without a subscriber this output stays idle.
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/zed/zed_node/point_cloud/cloud_registered`** | `sensor_msgs/PointCloud2` | *Raw ZED point cloud (sensor-data QoS).* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/zed/zed_node/point_cloud/cloud_optimized`** | `sensor_msgs/PointCloud2` | *Dense cloud without NaN points for the MoveIt OctoMap - only with `publish_moveit_cloud:=true`.* |
>> | **`/zed/pointcloud_web`** | `sensor_msgs/PointCloud2` | *Downsampled cloud in `world` (currently no consumer in the web UIs).* |
>
>
> ![Parameters](https://img.shields.io/badge/Parameters-yellow?style=flat-square)
>
>> | Parameter | Default | Description |
>> |---|---|---|
>> | `publish_moveit_cloud` | `false` | *Publish the cloud for the MoveIt OctoMap.* |
>> | `web_max_points` | `12000` | *Maximum number of points in the web cloud.* |
>> | `web_rate_hz` | `4.0` | *Maximum publish rate of the web cloud.* |
>> | `web_frame` | `world` | *Target frame of the web cloud.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `virtual_object_detections.py` &nbsp;&nbsp; <sub><i>`/src/robot_vision_cameras_bringup/scripts/virtual_object_detections.py`</i></sub>

**Purpose & Task:** Publishes the three scene objects **Blue Cube**, **Red Rectangle** and **Green Cylinder** plus the five grasp objects **Bottle**, **Steel Ball**, **Rubber Ball**, **Bowl** and **Basket** (IDs 904–908; bowl and basket with the grasp point on the inner bottom – their rim is too narrow for the suction cup) on `/zed/bboxes_3d` as if YOLO had detected them - bounding box, red grasp sphere and labels in exactly the same marker format (marker IDs from 901, names with the suffix ` (virtual)`). Everything attached to `/zed/bboxes_3d` treats them like real detections: `yolo_moveit_collision` (MoveIt collision object + red walls), the Robot Control UI (viewport, *Detected Objects* list, context menu, VR) and `robot_motion_handler_movegroup` ("Approach from above"). This way the grasp and collision workflow can be tested without a camera, e.g. in FAKE mode. The poses come from the TF tuner frames `target_blue_cube`, `target_red_rectangle`, `target_green_cylinder`, `target_bottle`, `target_ball_small`, `target_ball_large`, `target_bowl_small` and `target_basket_large` (the TF z is the bottom of the object); while the virtual objects are on, the TF tuner of the Robot Control UI publishes these frames even with "Live TF" off. Without a frame the default or last seen pose stays. Rotated objects get the axis-aligned hull, like a real YOLO box. The **Size** slider of the TF tuner (`/ui/scene_object_sizes`, factor per frame) scales dimensions and grasp point. Off by default so that virtual collision objects never end up in MoveIt unnoticed.

**Scene *Logistics - auto palletizing*** (area bar › **Scene**, `js/scenes.js`): every object belongs to the scene `standard` (the eight objects above) or `palletizing`. The palletizing scene holds a **Euro pallet** `PAL-01` (class `EUR1`, max load 80 kg, 1200 × 800 × 144 mm) and **8 cartons** in scale 1:6, footprints from the Euro module so that two L cartons fill one layer: L 800 × 600 × 400 mm (PKG-L1 25 kg, PKG-L2 22 kg), M 600 × 400 × 300 mm (PKG-M1 12 kg, PKG-M2 10 kg, PKG-M3 7 kg *fragile*), S 400 × 300 × 200 mm (PKG-S1 5 kg, PKG-S2 3 kg *fragile*, PKG-S3 4 kg) - 88 kg in total, so the planner has to leave cartons behind. IDs 909–917, frames `target_pallet`, `target_carton_l1` … `target_carton_s3`; the cartons stand on the two infeed conveyors (top 12 mm) left and right of the robot, the pallet at x 300 mm in front of it. Each object of this scene carries `meta` in `/ui/virtual_objects`: pallet `id`, `class`, `max_load_kg`, `scale`, `size_mm`; carton `id`, `class` (`carton_L/M/S`), `handling` (`standard` / `fragile` = nothing on top), `weight_kg`, `max_stack_kg` (load it carries), `size_mm` (real size). The viewport additionally shows a small palletizing cell (`js/twin/logistics_cell.js`; while the scene is active, `virtual_object_detections.py` adds the conveyors - roller bed 2 mm below the carton bottom + side rails - and the fence as MoveIt collision objects `cell_*` on `/planning_scene`, refreshed every 5 s, removed when the scene or the detections are switched off): roller conveyors coming through the safety fence, barcode scanner bridges, pallet spot with yellow corner marks, empty-pallet magazine, light curtains at the conveyor openings, stack light, control cabinet with HMI and yellow-black floor marking. The palletizing planner is `vla_bridge/palletizing.py`, the run `vla_bridge/pallet_job.py` (window *Palletizing*, see *VLA-M › Auto palletizing*). In the **physics sandbox** (FAKE) pallet (fixed), cartons (mass from the real weight / 6³) and the two conveyors are bodies; only objects that are *on* in `/ui/virtual_objects` take part, the other scene is switched off (no body, not grippable, not in MoveIt).

<details>
<summary><b>🔽 Show details</b> · Run Command · Publishes · TF2 · Services · Parameters</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run robot_vision_cameras_bringup virtual_object_detections.py
> ```
> *(Started by `robot_vision_cameras_bringup.launch.py`, switched off by default. The switch is **Object detection** (tag *GLOBAL*: all graspable objects of every scene, Standard and Auto palletizing) in the Planning panel (Simulation) and in *Detected Objects* of the Robot Control UI.)*
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/zed/bboxes_3d`** | `visualization_msgs/MarkerArray` | *The virtual detections in the YOLO marker format (namespaces `yolo_bboxes`, `yolo_object_grasp_center_point`, `yolo_labels_class`, `yolo_labels_coords`).* |
>> | **`/ui/virtual_bboxes_3d`** | `visualization_msgs/MarkerArray` | *The same markers exclusively for the Robot Control UI (desktop, VR, VR mirror), since the throttled `/zed/bboxes_3d` subscription (queue 1) would mostly drop them next to YOLO at camera rate.* |
>> | **`/ui/virtual_detections_enabled`** | `std_msgs/Bool` (latched) | *Current switch state of the **Object detection** switch (tag GLOBAL) in Detected Objects.* |
>> | **`/ui/virtual_objects`** | `std_msgs/String` (latched, JSON) | *State of the single objects for the **Virtual Objects** flyout in the viewport: list of `{frame, name, color, on, scene}`, objects of the palletizing scene also with `meta`.* |
>> | **`/ui/virtual_scene`** | `std_msgs/String` (latched) | *Active scene: `standard` or `palletizing` (area bar › Scene).* |
>
>
> ![TF2](https://img.shields.io/badge/TF2-yellow?style=flat-square)
>
>> | Frame / Transformation | Description |
>> |---|---|
>> | **`world` ➔ `target_blue_cube` / `target_red_rectangle` / `target_green_cylinder`** | *Pose of the three scene objects (TF tuner frames).* |
>
>
> ![Services](https://img.shields.io/badge/Services-FF1493?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/set_virtual_detections`** | `std_srvs/srv/SetBool` (Server) | *Switches the virtual detections on/off. Switching off deletes the markers; `yolo_moveit_collision` removes the collision objects after 2 s.* |
>> | **`/ui/set_virtual_objects`** | `std_msgs/String` (Subscriber, JSON) | *Switches single objects on/off, e.g. `{"target_bottle": false}` (only the changed frames). An object that is off is no longer published on `/zed/bboxes_3d` → no MoveIt obstacle, not in *Detected Objects*, not in the VLA agent's scene. Default: all objects of the scene `standard` on (not stored across a node restart). `{"scene": "palletizing"}` switches the scene: its objects on, all others off.* |
>> | **`/ui/set_library_objects`** | `std_msgs/String` (Subscriber, JSON) | *Object library (Robot Control UI › Library): `{"add": {"type": "cube_30"}}` inserts at the next free spot in reach around `link_base`, `{"add": {"type": …, "pose": {"x", "y", "z", "yaw"}}}` at a given spot (m, degrees), `{"remove": [id]}` deletes, `{"on": {"id": bool}}` switches on/off. Types = `config/object_library.yaml`; instances `Cube 30 #1` … with frame `lib_<type>_<n>` and marker id 1000 + id, published like the fixed objects (only in the scene where they were inserted). Saved with their last pose in `~/.ros/object_library.json` (parameter `library_state_file`).* |
>> | **`/ui/object_library`** | `std_msgs/String` (Publisher, latched JSON) | *Catalog + instances: `{categories, types, instances: [{id, type, name, frame, marker_id, scene, on, pose}], hint_count}`; re-sent after every change and at most every 2 s while poses change.* |
>
>
> ![Parameters](https://img.shields.io/badge/Parameters-yellow?style=flat-square)
>
>> | Parameter | Default | Description |
>> |---|---|---|
>> | `enabled` | `false` | *Switch state at start.* |
>> | `rate_hz` | `5.0` | *Publish rate of the detections [Hz].* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `yolo_moveit_collision.py` &nbsp;&nbsp; <sub><i>`/src/robot_vision_cameras_bringup/scripts/yolo_moveit_collision.py`</i></sub>

**Purpose & Task:** Seamlessly converts the detected 3D boxes into dynamic MoveIt `CollisionObject` messages. Instead of a solid block, it generates an **open-top cup shape** (5 ultra-thin 1mm walls). This allows the gripper to safely penetrate the bounding box from above for top-down grasps, while securely blocking lateral collisions. The side walls end `top_clearance` (parameter, default 0.01 m) below the object top, so they protect almost the full object height. This is less than MoveIt Servo's 2 cm stop distance: when jogging straight down over an object, Servo may stop a little earlier; "Approach from above" plans through MoveIt and is not affected. Since several sources publish on `/zed/bboxes_3d` (YOLO and `virtual_object_detections`) and each message only carries its own objects, cleanup runs per object over time instead of by what is missing from the last message: an object leaves MoveIt after 2 s without a report, its walls after 1 s. A 0.5 s timer does this even when a source falls silent completely (node stopped, virtual objects switched off). A collision object only goes to MoveIt when its position or size changed by more than `resend_tolerance` (default 0.001 m), otherwise every `refresh_period` (default 5 s, in case `move_group` was restarted). Before, it was re-sent every 0.4 s, and MoveIt saw the walls differently depending on timing (descent sometimes free, sometimes blocked). `wall_padding` (m per side, default 0) widens the walls sideways; `vla_bridge` uses the same value (`wall_padding_mm`). The side walls are `wall_thickness` thick (default 0.008 m, inwards - the outer size stays the detected box, at most a quarter of the box width); with 1 mm walls OMPL sometimes found paths straight through a wall that the final check then rejected.

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Publishes · Services</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run robot_vision_cameras_bringup yolo_moveit_collision.py
> ```
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/zed/bboxes_3d`** | `visualization_msgs/MarkerArray` | *Reads the 3D bounding boxes detected by YOLO.* |
>> | **`/ui/ignore_collision_object`** | `std_msgs/String` | *Receives names of objects to temporarily ignore.* |
>> | **`/ui/set_object_collision`** | `std_msgs/String` (JSON) | *`{"name": "cup_3", "enabled": false}` - permanently disables / re-enables one object's collision.* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/collision_object`** | `moveit_msgs/CollisionObject` | *Sends the cup-shaped `CollisionObjects` directly to MoveIt.* |
>> | **`/ui/moveit_collision_objects_enabled`** | `std_msgs/Bool` (latched) | *Whether MoveIt currently considers the detected objects.* |
>> | **`/ui/yolo_collision_toggle`**, **`/zed/yolo_collision_markers`** | `visualization_msgs/MarkerArray` | *The collision walls (floor + 4 sides, open top) as a red transparent `TRIANGLE_LIST` - only while object collision is enabled. Every message carries the walls of all current objects (YOLO and virtual), so throttled subscribers like the Robot Control UI never miss a source. The frame from `/zed/bboxes_3d` always stays visible.* |
>> | **`/ui/disabled_collision_objects`** | `std_msgs/String` (JSON, latched) | *Objects whose collision was switched off via the context menu.* |
>> | **`/ui/grasp_status`** | `std_msgs/String` | *Publishes collision timeout and tracking statuses.* |
>
>
> ![Services](https://img.shields.io/badge/Services-FF1493?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/set_moveit_collision_objects`** | `std_srvs/srv/SetBool` (Server) | *Enables/disables the objects as MoveIt obstacles (RViz markers stay visible). Defaults to ON after a restart.* |

</details>

---

<br>

### ![MoveIt 2](https://img.shields.io/badge/Integration-MoveIt_2-00529B?style=flat-square) `_robot_moveit_common.launch.py` (`octomap_server`) &nbsp;&nbsp; <sub><i>`/src/xarm_ros2/xarm_moveit_config/launch/_robot_moveit_common.launch.py`</i></sub>

**Purpose & Task:** Dynamic 3D environment mapping. Generates a real-time voxel-based collision map (OctoMap) directly from the ZED point cloud, enabling MoveIt to avoid arbitrary, unrecognized obstacles (e.g., human hands, tools) during trajectory planning and servoing.

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Publishes</summary>

> [!NOTE]
> 💻 **Run Command:** *(Natively injected into MoveIt move_group_node via sensor_manager_parameters)*
>
>  * ⚠️ **Input disabled by default:** `pointcloud_optimizer.py` only publishes `cloud_optimized` with `publish_moveit_cloud:=true`. Until then MoveIt plans without the camera cloud.
>  * 🛠️ **Activation:** In the base repository (`src/xarm_ros2/xarm_moveit_config/launch/_robot_moveit_common.launch.py`), the OctoMap is configured via the `sensor_manager_parameters` dictionary (setting parameters like `octomap_resolution: 0.03` and `ros.point_cloud_topic`) and injected directly into the `move_group_node`.
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/zed/zed_node/point_cloud/cloud_optimized`** | `sensor_msgs/PointCloud2` | *Reads the point cloud to generate a voxel-based map.* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/planning_scene`** | `moveit_msgs/PlanningScene` | *Integrates the generated OctoMap natively into the collision world.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `yolo_planned_grasp_executor.py` &nbsp;&nbsp; <sub><i>`/src/robot_vision_cameras_bringup/scripts/yolo_planned_grasp_executor.py`</i></sub>

**Purpose & Task:** The central control logic of the autonomous grasping pipeline. Reads the UI input field ("Grasp Object"), retrieves the YOLO coordinates, and coordinates a robust **3-Phase Collision-Free Grasping Sequence**:

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Publishes · Services · Action Server · Action Client · Parameters</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run robot_vision_cameras_bringup yolo_planned_grasp_executor.py
> ```
>
>   - **Phase 1 (Retract):** Safely moves the arm strictly upwards from its current position to clear the table.
>   - **Phase 2 (Hover):** Translates horizontally to a safe height (15cm) exactly above the target object. Forces a strict top-down orientation and uses tight IK tolerances (5mm positional, 0.001 rad tilt) to guarantee millimeter-accurate vertical alignment.
>   - **Phase 3 (Approach):** Temporarily removes the target object from the MoveIt global collision scene via `/ui/ignore_collision_object` to allow the TCP to physically reach into the object's bounding box without triggering emergency stops, then moves down.
>
>

<p align="center"><img src="../img/diagrams/grasp_states.svg" width="100%" alt="State diagram of the 3-phase grasp sequence"></p>

*State diagram of the 3-phase grasp sequence · source: `tools/make_diagrams.py`*

> ![Parameters](https://img.shields.io/badge/Parameters-yellow?style=flat-square)
>
>> | Parameter | Default | Description |
>> |---|---|---|
>> | `safe_z_hover_height` | `0.15` | *Z height [m] the gripper hovers at before descending onto the object.* |
>> | `grasp_z_offset` | `0.02` | *Extra Z offset [m] added on top of the object's measured top surface.* |
>> | `target_roll` | `3.14159` | *Target roll [rad] of the grasp orientation — 180°, i.e. straight down.* |
>> | `target_pitch` | `0.0` | *Target pitch [rad] of the grasp orientation.* |
>> | `target_yaw` | `0.0` | *Target yaw [rad] of the grasp orientation.* |
>> | `ik_tolerance_position` | `0.005` | *Positional IK tolerance [m] — radius of the sphere MoveIt may solve within.* |
>> | `ik_tolerance_orientation` | `0.001` | *Orientation IK tolerance [rad].* |
>> | `velocity_scaling` | `0.2` | *Velocity scaling for extremely smooth, slow and predictable motion during the grasp.* |
>> | `acceleration_scaling` | `0.1` | *Acceleration scaling for extremely smooth, slow and predictable motion during the grasp.* |
>
> *Defaults live in `config/grasping_params.yaml`.*
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/zed/bboxes_3d`** | `visualization_msgs/MarkerArray` | *Reads the object coordinates as a target for the grasp path.* |
>> | **`/ui/sound_enabled`** | `std_msgs/Bool` | *Mutes the spoken grasp announcements together with the Web UI sound toggle.* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/lite6_traj_controller/joint_trajectory`** | `trajectory_msgs/JointTrajectory` | *Publishes joint trajectories to execute the motion.* |
>> | **`/planning_scene`** | `moveit_msgs/PlanningScene` | *Disables temporary object collisions in the MoveIt scene.* |
>> | **`/ui/ignore_collision_object`** | `std_msgs/String` | *Temporarily turns off object collision states.* |
>> | **`/ui/grasp_status`** | `std_msgs/String` | *Sends progress messages to the Web UI.* |
>
>
> ![Action Server](https://img.shields.io/badge/Action_Server-008080?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/grasp_object`** | `robot_vision_cameras_bringup/action/GraspObject` | *Non-blocking action endpoint to initiate the grasp sequence.* |
>
>
> ![Action Client](https://img.shields.io/badge/Action_Client-00BCD4?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/move_action`** | `moveit_msgs/action/MoveGroup` | *Plans and executes the motion via MoveIt (OMPL).* |
>
>
> ![Services](https://img.shields.io/badge/Services-FF1493?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/compute_ik`** | `moveit_msgs/srv/GetPositionIK` (Client) | *Checks via MoveIt if the target pose is reachable.* |
>> | **`/ui/execute_move_to_pose`** | `xarm_msgs/srv/MoveCartesian` (Client) | *Uses MoveIt Servo / motion handler as fallback movement.* |
>> | **`/servo_server/stop_servo`** | `std_srvs/srv/Trigger` (Client) | *Temporarily stops the servo server during trajectory execution.* |
>> | **`/servo_server/start_servo`** | `std_srvs/srv/Trigger` (Client) | *Restarts the servo server after execution.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `grasp_action_bridge.py` &nbsp;&nbsp; <sub><i>`/src/robot_vision_cameras_bringup/scripts/grasp_action_bridge.py`</i></sub>

**Purpose & Task:** Acts as a translator node between the Web UI and the Action Server. Receives the simple target object string from the UI and converts it into a non-blocking ROS 2 Action Goal (`robot_vision_cameras_bringup/action/GraspObject`).

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Action Client</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run robot_vision_cameras_bringup grasp_action_bridge.py
> ```
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/grasp_object_cmd`** | `std_msgs/String` | *Receives the string command (e.g., "cup_1") from the UI.* |
>
>
> ![Action Client](https://img.shields.io/badge/Action_Client-00BCD4?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/grasp_object`** | `robot_vision_cameras_bringup/action/GraspObject` | *Calls the Grasp Action Server.* |

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `yolo_grasp_executor.py` &nbsp;&nbsp; <sub><i>`/src/robot_vision_cameras_bringup/scripts/yolo_grasp_executor.py`</i></sub>

**Purpose & Task:** Direct Cartesian grasping fallback executor. Listens for target object names on `/ui/grasp_object_cmd`, retrieves the latest 3D coordinates from `/zed/bboxes_3d`, and drives the arm directly to the calculated grasp pose by calling the `/ui/execute_move_to_pose` Cartesian service provided by `robot_motion_handler_movegroup`.

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Services</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run robot_vision_cameras_bringup yolo_grasp_executor.py
> ```
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/grasp_object_cmd`** | `std_msgs/String` | *Receives the target object identifier string from the UI.* |
>> | **`/zed/bboxes_3d`** | `visualization_msgs/MarkerArray` | *Reads live 3D bounding box coordinates.* |
>
>
> ![Services](https://img.shields.io/badge/Services-FF1493?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/ui/execute_move_to_pose`** | `xarm_msgs/srv/MoveCartesian` (Client) | *Dispatches Cartesian move commands to the central motion handler.* |

</details>

---

<br>

### ![Launch](https://img.shields.io/badge/Launch-Skript-FF9900?style=flat-square) `zed_cam_eef_rviz_octomap_yolo.launch.py` &nbsp;&nbsp; <sub><i>`/src/robot_vision_cameras_bringup/launch/zed_cam_eef_rviz_octomap_yolo.launch.py`</i></sub>

**Purpose & Task:** Dedicated bringup launch file for setups where the Stereolabs ZED Mini camera is mounted directly on the robot's end effector (EEF / `link_tcp`). Broadcasts static TF relative to `link_tcp`, runs pointcloud filtering, builds real-time 3D OctoMaps, and starts YOLOv8 detection tailored for eye-in-hand visual inspection.

<details>
<summary><b>🔽 Show details</b> · Run Command</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 launch robot_vision_cameras_bringup zed_cam_eef_rviz_octomap_yolo.launch.py
> ```

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) ![Python UI](https://img.shields.io/badge/Python_UI-8A2BE2?style=flat-square&logo=qt&logoColor=white) `tf_control_tuner.py` (`tf_control_tuner`) &nbsp;&nbsp; <sub><i>`/src/tf_control_tuner/tf_control_tuner/tf_control_tuner.py`</i></sub>

**Purpose & Task:** A dedicated ROS 2 package providing a live PyQt5 GUI tuner to interactively calibrate camera TF offsets (Pointcloud) and position 3D scene elements (Cube, Rectangle, Cylinder, grasp items Bottle/Steel Ball/Rubber Ball/Bowl/Basket, Pallet and Cartons of the palletizing scene) alongside an adjustable cylindrical **Safety Zone** (tunable radius and XY center) in RViz without restarting nodes. A **Size** slider (25–300 %, 100 % = original dimensions) scales the scene and grasp objects uniformly around their bottom.

<details>
<summary><b>🔽 Show details</b> · Run Command · Publishes · Defaults</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run tf_control_tuner tf_control_tuner
> ```
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/tf`** | `tf2_msgs/TFMessage` | *Broadcasts live spatial coordinate transforms for calibrated camera and scene frames.* |
>> | **`/ui/safety_zone_params`** | `std_msgs/Float32MultiArray` | *Publishes dynamic safety zone parameters `[x, y, radius]` to the motion handler.* |
>> | **`/ui/scene_object_sizes`** | `std_msgs/String` (JSON) | *Size factor per object frame, e.g. `{"target_blue_cube": 1.5}` (on change, otherwise every second).* |
>
>
> ![Defaults](https://img.shields.io/badge/Defaults-yellow?style=flat-square) **(Calibrated Camera & Scene Defaults)**
>
>> | Element | Frame ID | X [m] | Y [m] | Z [m] | Roll | Pitch | Yaw |
>> |---|---|---|---|---|---|---|---|
>> | **Zed M Camera** | `zed_camera_link` | `0.473` | `0.000` | `0.368` | `0.0°` | `57.5°` | `180.0°` |
>> | **Blue Cube** | `target_blue_cube` | `0.300` | `0.085` | `0.002` | `0.0°` | `0.0°` | `0.0°` |
>> | **Red Rectangle** | `target_red_rectangle` | `0.305` | `-0.080` | `0.002` | `0.0°` | `0.0°` | `45.0°` |
>> | **Green Cylinder** | `target_green_cylinder` | `0.350` | `0.025` | `0.002` | `0.0°` | `0.0°` | `0.0°` |
>> | **Safety Zone** | `target_safety_zone` | `0.000` | `0.000` | `0.000` | `0.0°` | `0.0°` | `0.0°` |
>
> *Safety Zone radius default: 200 mm (sent together with X/Y on `/ui/safety_zone_params`).*

</details>

---

<br>

### ![Node](https://img.shields.io/badge/Node-blue?style=flat-square) `fake_linear_axis_node.py` (`fake_linear_axis`) &nbsp;&nbsp; <sub><i>`/src/fake_linear_axis/fake_linear_axis/fake_linear_axis_node.py`</i></sub>

**Purpose & Task:** Headless ROS 2 node driving the virtual 7th degree of freedom (Linear Rail) in simulation. Subscribes to the translation command `/linear_axis_cmd` (from Web UI slider or Gamepad D-Pad), dynamically broadcasts the TF frame `world` -> `linear_axis_link`, and renders realistic 3D RViz visualization markers (main rail, guide rails, and carriage plate) on `/visualization_marker_array`.

<details>
<summary><b>🔽 Show details</b> · Run Command · Subscribes · Publishes · TF2</summary>

> [!NOTE]
> 💻 **Run Command:**
> ```bash
> ros2 run fake_linear_axis fake_linear_axis
> ```
> *(Automatically started in FAKE mode bringup)*
>
>
> ![Subscribes](https://img.shields.io/badge/Subscribes-orange?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/linear_axis_cmd`** | `std_msgs/Float64` | *Target linear rail displacement in meters.* |
>
>
> ![Publishes](https://img.shields.io/badge/Publishes-green?style=flat-square)
>
>> | Topic / Interface | Msg Type | Description |
>> |---|---|---|
>> | **`/visualization_marker_array`** | `visualization_msgs/MarkerArray` | *Publishes 3D RViz markers for physical linear rail and carriage elements.* |
>
>
> ![TF2](https://img.shields.io/badge/TF2-yellow?style=flat-square)
>
>> | Frame / Transformation | Description |
>> |---|---|
>> | **`world` ➔ `linear_axis_link`** | *Dynamically broadcasts robot base translation on the Y-axis.* |

</details>

---

[⬅ Previous: Operating Modes & Gamepad Teleoperation](teleoperation.html) · [🏠 Overview](../readme-en.html) · [⬆ Top](#top) · [Next: Voice & Gaze Control ➡](voice_gaze.html)
