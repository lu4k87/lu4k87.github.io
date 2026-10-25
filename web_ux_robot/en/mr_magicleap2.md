<a name="top"></a>

# 🕶 MR Headset (Magic Leap 2)

[🏠 Overview](../readme-en.html) · [🇩🇪 Deutsch](../de/mr_magicleap2.html) · Chapter 3.5b

---

## 3.5b Feature: MR headset view of the real robot
*The Magic Leap 2 shows the real xArm Lite 6 through its glass with overlays on the arm and the table. View only – nothing moves from the headset; the only action with an effect is the E-STOP (bar below the line of sight and panel).*

> **Status (2026-10-25):** prepared, not yet tested with the Magic Leap 2. Desktop preview, node and alignment math are tested.

### Start

1. UX | Nexus Launcher → card **MR Headset (Magic Leap 2)** → `ros2 launch mr_magicleap2 mr_magicleap2.launch.py` (HTTPS 8443 + rosbridge WSS 9091 + `mr_headset_bridge`, without the VR teleop node). Ports 8443/9091 already in use (VR Quest 3 Teleop running) → the launch starts only the bridge and the headset uses the running server; nothing is stopped. Order: start VR Quest 3 Teleop first, then MR – the VR launch frees port 8443 for itself.
2. Magic Leap 2 browser (same network as the robot PC) → `https://<PC-IP>:8443/`, accept the certificate, once also `https://<PC-IP>:9091/`, reload. Shortcut: QR icon beside the address field of the Magic Leap browser.
3. Viewport toolbar → button **MR** (glasses icon, next to VR) or XR menu → **MR Headset (Magic Leap 2)**. Allow the immersive session.
4. **End MR** on the panel, **MR** again or the menu button on the controller (system) ends the session. Bumper or **Panel here** brings the panel in front of you.

Without an AR headset (desktop browser) the same button shows the MR layers as a **preview** in the 3D viewport.

### Align (first time, after moving the table)

Not aligned yet → the panel opens on **Align to the robot** (button **Align now**); after moving the table press **Re-align**. Hold the controller tip (or the index finger tip, hand tracking) on each point and press the trigger (or pinch):

| Point | Position in `link_base` |
|---|---|
| Nozzle tip | live TCP pose (`/ui/eef_position`, mm) – move the arm at the desktop between taps for more points |
| Table corner left (+Y) at the robot | `x = −0.082 m`, `y = +0.40 m` (twin table, `lab_room.js` `TABLE`) |
| Table corner right (−Y) at the robot | `x = −0.082 m`, `y = −0.40 m` |
| Far corners (optional) | `x = +1.118 m`, `y = ±0.40 m` |

- From 2 points (at least 15 cm apart) the panel shows the fit: `±mm` (green ≤ 10 mm, yellow ≤ 25 mm, red above → measure again), maximum error.
- **Use alignment** saves it in the browser (`localStorage rcu.mr.calib`) and via `/mr/calibration_set` in `~/.ros/mr_magicleap2/calibration.json`; the node sends it back latched on `/mr/calibration`.
- Fine steps: X/Y/Z ±5 mm, turn ±0.5°. Switch **Virtual arm** on to compare the twin arm with the real one.
- The real table must match the twin table (1.20 × 0.80 m, narrow edge flush with the robot foot); otherwise use nozzle points only.

### What the headset shows

| Layer | What you see | Why |
|---|---|---|
| Work surface | 10 cm grid on the table, axes +X/+Y at the base | alignment check at a glance |
| Reach on table | ring from the base zone (100 mm) to the reach at table height | where the arm can pick |
| TCP drop line | line from the nozzle to the table, crosshair, `Z … mm` (yellow close to the Z collision level) | where the nozzle would touch down |
| Status ring | ring around the base + label: Robot \| Hardware / Robot \| Digital Twin · state · speed (grey idle, green moving, yellow offline, red E-STOP) | state readable at the arm |
| Joint limits | arc per joint with needle, yellow within 15° of a limit (off by default) | how much room a joint has left |
| Distance hint | yellow shell + "Step back – the arm is moving (hint)" when your head is inside reach + 25 cm while the arm moves; only when aligned | keep out of the moving arm – a hint, **not** a protective function |

Also visible because they live in the same scene: path preview, ghost, virtual objects of the Mixed Reality mode (N49). The virtual table, grid and lab room are off. Safety bar below the line of sight (follows the head): red **E-STOP** field (aim + trigger), Robot | Hardware / Robot | Digital Twin, state, speed, control lock, alignment (`PC ALIGN?` = taken over from the robot PC, compare with **Virtual arm**).

**E-STOP feedback:** no rosbridge connection → `E-STOP NOT SENT`; no confirmation from the node within 1.5 s → `E-STOP NOT CONFIRMED` – then use the hardware E-stop.

### Desktop: who wears the headset

Layer **Headset user** in the 3D viewport: head + viewing direction from `/mr/operator` (only when aligned and not older than 3 s).

### ROS 2

| Name | Type | Content |
|---|---|---|
| `/mr/headset_pose` | `std_msgs/String` (JSON, 5 Hz, browser → node) | head + forward vector in `link_base`, aligned yes/no, ±mm |
| `/mr/operator` | `std_msgs/String` (JSON, 5 Hz) | active, stale, distance to the base axis, zone `inside`/`near`/`outside`/`unknown` |
| `/mr/calibration_set` | `std_msgs/String` (browser → node) | alignment x, y, z, yaw, ±mm |
| `/mr/calibration` | `std_msgs/String`, transient local | stored alignment |
| TF `link_base → mr_headset` | tf2 | head pose (only when aligned) |

Node parameters (`mr_headset_bridge`): `reach_m` 0.44, `margin_m` 0.25, `stale_s` 1.5, `publish_tf` true, `calib_file` (`~/.ros/mr_magicleap2/calibration.json`), `base_frame` `link_base`, `head_frame` `mr_headset`. Launch arguments: `https` (true), `reach_m`, `margin_m`. The zone is a hint (log, desktop), **not** a safety signal.

### Files

- `js/twin/mr_session.js` – session, panel, safety bar, alignment
- `js/twin/mr_layers.js` – layers (also desktop preview)
- `js/twin/mr_calib.js` – 4-DoF fit (test `test/test_mr_calib.py`)
- `src/mr_magicleap2/` – node `mr_headset_bridge`, launch `mr_magicleap2.launch.py`, tests `test/test_core.py`

---

[⬅ Previous: VR Teleoperation](vr_quest3.html) · [🏠 Overview](../readme-en.html) · [⬆ Top](#top) · [Next: UX | Control Interface & Motion Backend ➡](robot_control_ui.html)
