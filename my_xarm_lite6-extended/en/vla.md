<a name="top"></a>

# 🤖 VLA-M: Vision-Language-Action Chat

[🏠 Overview](../readme-en.html) · [🇩🇪 Deutsch](../de/vla.html) · Chapter 4.3

---

## 4.3 VLA-M: Vision-Language-Action Chat (In Progress)
> AI-assisted task execution through *Vision-Language-Action* (VLA) models: the operator types (later: says) an instruction such as *"Pick up the red cup and put it into the blue box"*. An LLM agent turns the scene, the robot state and the instruction into a plan of robot skills, executes it after the operator confirmed it (human-in-the-loop) and re-plans when a step fails; a trained VLA model is planned as an additional skill.

**At a glance:**

| | |
|---|---|
| **Scope (skills)** | `pick` (gripper open → *Approach from above* with yaw search → grip → lift → grasp check) · `place` (on / into / beside an object, at an x/y spot on the table, `back` = back to where it came from) · `home` (home pose) · `gripper` (gripper / suction on or off, no motion) · `palletize` (auto palletizing, only in the scene *Logistics - auto palletizing*) |
| **Not covered** | jogging, servo / gamepad, VR teleoperation; for turning, pouring, pushing the agent answers with what it can do |
| **Entry points** | chat in the **VLA-M** section (`/vla/instruction`, with LLM) · one-click *Grasp* / *Place here* in the object menu or in VR (`/vla/skill`, **no LLM**, same plan check) · task window *Palletizing* (*Plan* / *Start*, `/vla/skill` `palletize`; "load the pallet" in the chat starts the same job) |
| **Flow** | plan → plan check on a simulated scene → self-correction (≤ 2 rounds) → plan in the UI → *Execute* → step by step (`skills.py`); errors (`unreachable` / `collision` / `slipped`) → recovery plan or a reason to give up |
| **Safety** | the model only picks skill + object, the code computes poses · every move goes through the motion handler · REAL without `allow_real_motion` plan only, every plan waits for *Execute*, no virtual objects · *Abort* stops after the current step, palletizing at once (`/ui/halt_motion`, E-STOP not latched) · `dry_run:=true` never moves |

**Current state (September 2026):**
- **UI:** section **VLA-M** in the Robot Control UI (port 8081, see [3.6](robot_control_ui.html#36-feature-gui---graphical-robot-control--visual-feedback)) and its large popup window: chat, a *Planned actions* list with **Execute** / **Abort** and step progress, microphone button (prepared), camera selection and **Confirm before execute**; **Model: Local | Claude | Gemini** switches the language model at runtime (`/vla/llm`, models from `llm_local_model` / `llm_cloud_model` / `llm_google_model`; Claude needs `python3 -m pip install --user anthropic` and a key from platform.claude.com in `ANTHROPIC_API_KEY` or `~/.config/vla_bridge/anthropic_api_key`, Gemini Robotics-ER a key from Google AI Studio in `GEMINI_API_KEY` or `~/.config/vla_bridge/gemini_api_key`; the key file also works when the node is started from the Nexus Webapp), the header chip shows local or cloud and the model; models that are not set up yet get a warning triangle (tooltip and click show cause + fix); chips for model, mode (FAKE / REAL) and scene (e.g. `8 objects · 8 virtual`); backend card with agent state (`ollama · ready`) and the held object. *Clear* also resets the conversation of the agent.
- **Backend:** ROS 2 package `vla_bridge` – an **LLM task agent**. A language model (local through Ollama, `qwen3.8:27b` on the RTX A5000, offline; optionally Claude through the Anthropic API) gets the instruction, the scene (objects in `link_base` mm), the held object, gripper and mode and answers with structured JSON: an **answer**, a **clarifying question** or a **plan** of skills (`pick`, `place` on / into / beside / at a spot / back, `home`, `gripper`).
  - The code **checks every plan** before anything moves (objects exist, gripper free / holding, reach, free spot beside a target, room for the gripper body next to tall objects) and hands errors back to the model, which corrects the plan.
  - **Execution** like *Approach from above* of the UI: `/ui/approach_from_above` (collision-free to a pre-position 70 mm above the grasp sphere, then straight down with the collision of the target released), grasp pose with the suction cup 2 mm above the sphere (`cup_gap_mm`; with the finger-gripper URDF the TCP goes lower by the tool length difference, `/ui/tcp_length_mm`); with round or slanted objects the gripper is turned until a collision-free grasp pose is found (yaw search). A step is done only when `/ui/moveit_motion_state` reports `succeeded`.
  - **Grasp check** after lifting (physics sandbox: `held` / `held_id` in `/ui/physics_sandbox_state` after the lift must be this object; real objects: the grasp sphere must come up). Tipped-over objects (grasp face tilted > `max_grip_tilt_deg`, 20°) are not picked; after gripping, the object is lifted clear of the tallest neighbour (`transit_clearance_mm`). If a step fails, the agent sees the error and the new scene and proposes a **recovery plan** (e.g. try again, put the object back) or explains why it gives up (`max_recoveries`: 2).
  - **Measured, not guessed:** `python3 tools/vla_eval.py` runs 57 fixed instructions (simple, relations, multi-step, clarify, answer, follow-up, state, recovery, multi-turn session) against the real model and reports the pass rate per category, LLM calls and time; every round of real sessions is logged to `~/.ros/vla_logs` (`session_log`) and can become a new case (`--from-log`). Example dialogues (`few_shot`), precomputed facts in the scene description (lies on / carries / free sides) and a plan check on a simulated scene make the local `qwen3.8:27b` plan more reliably; with `llm_escalate:=true` fix rounds and recovery plans go to Claude.
  - It remembers the conversation (*"and now onto the cylinder"*, answers to its questions) and understands German and English, e.g. *„Stapel den blauen Würfel auf den Zylinder und leg danach die Stahlkugel in den Korb“*, *"Put the rubber ball into the bowl"*, *„Nimm die Kugel“* → *„Welche Kugel – die silberne oder die orangene?“*, *„Was siehst du?“*.
  - `dry_run:=true`: plan and progress only, **the robot never moves**.
- **Virtual objects:** with the physics sandbox of the Robot Control UI (FAKE only) the agent really picks, carries, stacks and drops them into bowl and basket (tested end to end in FAKE).
- **Safety:** the model only chooses skills and object ids – poses come from the scene, every move goes through the motion handler (IK, collision checking, floor guard, E-STOP). In REAL mode (`ufactory_driver` running) plans only execute with `allow_real_motion:=true` (default: plan only), every plan and every recovery plan waits for *Execute* (`real_require_confirm:=true`) and virtual objects are never approached (`allow_virtual_in_real:=false`). The E-STOP aborts the task, *Abort* stops after the current step. *Execute* in the UI additionally passes `motionAllowed` (E-stop, connection, control lock).
- **Not yet:** a trained VLA model (demonstrations can be recorded, see roadmap step 4).

### 🧠 Agentic ROS: the agent loop
The VLA-M backend is an **agentic ROS** node: the language model does not steer the robot directly, it acts as a planner inside a closed loop of ROS services and checks.

```
instruction ─► plan (LLM: skills + object ids) ─► check (code: objects, gripper, reach, free spot)
   ▲  ▲                    ▲   errors back to the LLM (max. 2×)  │ ok
   │  │                    └──────────────────────────────────────┤
   │  └─ question back (clarify) / answer only                    ▼
   │                                          confirm (Execute) ─► execute via motion handler
   │                                                                │ (IK, collision check, floor guard, E-STOP)
   └── recovery plan ◄── LLM sees error + new scene ◄── grasp check ┘
```

- **What the model decides:** only *which* skills with *which* objects (pick, place on / into / beside, home, gripper) – all poses are computed from the scene, every move runs through the existing safety chain.
- **Tools = ROS interfaces:** scene from `/zed/bboxes_3d`, motion via `/ui/approach_from_above` and the motion handler, gripper via `/ui/gripper_cmd`, grasp check via the physics sandbox or the grasp sphere.
- **Memory & dialogue:** the conversation is kept (*"and now onto the cylinder"*), ambiguous instructions trigger a question back, *Clear* (`/vla/reset`) forgets it.
- **Offline first:** local model through Ollama on the GPU; Claude through the Anthropic API is optional.
  - **Local model:** `qwen3.8:27b` = Qwen 3.8 by Alibaba Cloud, 27 B parameters (Q4_K_M), open weights under the Apache 2.0 license (commercial use allowed), thinking mode off (`think: false`); ~18 GB download, ~16 GB GPU memory.

<img src="../img/vla_agent.png" width="85%" alt="VLA-M popup: German instruction, agent answer, four planned steps awaiting confirmation, scene objects and backend state">

*VLA-M popup in FAKE mode: the agent (`qwen3.8:27b`, dry run) has planned the instruction „Stapel den blauen Würfel auf den Zylinder und leg danach die Stahlkugel in den Korb“ into four steps and waits for **Execute**.*


```bash
bash src/vla_bridge/scripts/install_ollama.sh        # once per PC: Ollama (~/.local, no sudo) + qwen3.8:27b (~18 GB)
# if missing, the Nexus Webapp Check (preflight) and the Setup card warn (log: "Ollama not found")
ros2 launch vla_bridge vla_bridge.launch.py          # agent; starts `ollama serve` itself if needed
# more arguments: llm_backend (ollama | anthropic), llm_model, dry_run, allow_real_motion, real_require_confirm, config_file
# they override src/vla_bridge/config/vla_bridge.yaml (language model, scene topic, safety, grasp heights, timeouts)
```

*Nexus Webapp: **VLA-M Bridge** in RUN DEV SETUP and SERVER SETUP (own category *VLA-M (Vision-Language-Action)*, skipped until ticked; parameters *LLM*, *Dry run*, *REAL: execute plans*, *REAL: always confirm*; *Recommended for FAKE/REAL* sets them per sequence, REAL = execute plans + always confirm on) and the card **VLA-M (Vision-Language-Action)** with the bridge, *Virtual objects ON* (`/ui/set_virtual_detections`) and *VLA-M status (live)*. User guide: [manual](../operate_manual.html), chapter *Den Roboter per Chat anweisen*.*

**Topics** (`/vla/*` as `std_msgs/String` with JSON; details in the package README):

| Topic | Direction | Content |
|---|---|---|
| `/vla/instruction` | UI → `vla_bridge` | `{id, text, camera, confirm}` |
| `/vla/response` | `vla_bridge` → UI | `{id, text?, plan?, awaiting?, step?, total?, state?}` - `state` also `clarify` (question back) and `replan` (step failed, agent re-plans) |
| `/vla/status` | `vla_bridge` → UI (1 Hz) | `{state, model, llm, executes, pending, mode, sandbox, gripper, held, objects}` - UI shows `OFFLINE` after 3 s without status |
| `/vla/execute` | UI → `vla_bridge` | `{id}` - releases the waiting plan |
| `/vla/abort` | UI → `vla_bridge` | `{id}` - stops the running task |
| `/vla/reset` | UI → `vla_bridge` | `{}` - forget the conversation (*Clear*) |
| `/vla/skill` | UI (object menu) → `vla_bridge` | `{id, skill: pick\|place, object?, target?, relation?, side?, x_mm?, y_mm?, confirmed, source}` - one-click *Grasp* / *Place here* without the language model, same checks and skills, no re-planning; REAL only with `confirmed` |
| `/vla/skill` `{actions: [{skill: pick, object}, {skill: place, …}]}` | UI (object menu *Pick & Place to …*) → `vla_bridge` | pick + place as ONE task (at most 2 actions, `MAX_DIRECT_ACTIONS`): one validation of the whole sequence, progress 1/2 → 2/2, one Abort; REAL only with `confirmed` |
| `/ui/emergency_stop_active` | → `vla_bridge` | `std_msgs/Bool` (latched) - the E-STOP aborts every task |
| `/zed/bboxes_3d` | YOLO / `virtual_object_detections` → `vla_bridge` | `visualization_msgs/MarkerArray` - the scene (label, colour, grasp sphere, box) |
| `/ui/approach_from_above`, `/ui/execute_move_to_pose`, `/ui/execute_initial_pose`, `/ui/gripper_cmd` | `vla_bridge` → motion stack | the same services / topic the UI uses |
| `/ui/moveit_motion_state` | motion handler → `vla_bridge` | a move step is done at `succeeded` |
| `/ui/physics_sandbox_state` | Robot Control UI → `vla_bridge` | sandbox on/off and the held object (`held`, `held_id`) - grasp check |
| `/vla/skill` `{skill: palletize, mode: plan\|run, must?, limits?, dry_run?, confirmed?}` | UI (*Palletizing* window) → `vla_bridge` | auto palletizing: `plan` computes and reports the plan, `run` loads the pallet carton by carton (`pallet_job.py`); `must` = cartons taken along on purpose (*Take along*); `limits` = own limits `{max_load_kg, max_load_height_mm, min_support}` (`{}` = scene defaults) |
| `/vla/pallet/plan` | `vla_bridge` → UI (latched) | `{task_id, state: idle\|planned\|running\|done\|aborted\|error, step, total, dry_run, message, loaded, ik, plan}` - plan (`Plan.to_dict` with world poses, `must`, `pallet_pose`) and progress |
| `/ui/virtual_objects` | `virtual_object_detections` → `vla_bridge` | latched list with `meta` of pallet + cartons - input of the palletizing planner |
| `/ui/halt_motion` | `vla_bridge` → motion handler | `std_srvs/Trigger` - *Abort* while palletizing: stops the running motion at once **without** latching the E-STOP |

**Auto palletizing (N57, scene *Logistics - auto palletizing*):** the area bar button *Auto palletizing* switches the scene and opens the task window **Palletizing** of the Robot Control UI (`js/pallet.js`). **Plan** → `vla_bridge/palletizing.py` picks the cartons under the 80 kg limit (heavy and large at the bottom, nothing on fragile ones) and shows load bar (`80 / 80 kg`), layer buttons on top, side view of the stack (seen from the robot, selected layer bold, numbers of hidden cartons in their visible part) and top view per layer (*All* = top layer over the dimmed layer below with `L1·n`), robot order, *Stays on the conveyor* with the reason (*Take along* plans again with that carton) and see-through **ghost boxes** of the planned poses in the viewport (switchable) with a step number on each box and, centred above the pallet just over its max. load height, the live pallet load `PAL-01 load · 51 / 80 kg` (sum of the cartons already placed, `plan.pallet.max_top_z`). **Start** → per carton *pick* (like *Grasp*) → `place_at` on the exact pose incl. yaw (+90° for turned cartons, release 3 mm above, `pallet_release_clearance_mm`) → check: the carton must lie within 6 mm / 8° of its target (pose via physics sandbox → Virtual Objects → TF), else the run stops with the deviation. FAKE only with the physics sandbox (the cartons are Rapier bodies; without it `vla_bridge` refuses and the hint *Grasp / Place not possible* offers **Show setting** - opens *Viewport › Planning*, the *SIM physics* row pulses - and **Start SIM physics**; *Start* stays a separate click, the hint stays until a click, Esc or a click outside); REAL refuses virtual cartons (`allow_virtual_in_real`). **Dry run** checks the arm poses (IK) without motion. **Abort** stops at once via `/ui/halt_motion` (a held carton stays at the suction cup, E-STOP not latched). **Reset** puts pallet and cartons back on the conveyors. **Pallet & limits** (collapsible block at the top, summary `EUR1 · 80 kg · 900 mm`, badge *edited* for own values): pallet ID, class, size, scene scale and grid; **max load** (1-500 kg), **max load height** (100-2000 mm) and **min support per carton** (50-100 %) are adjustable - *Apply & plan* plans again with them, *Scene defaults* goes back; locked while palletizing runs. The values are saved per browser (`rcui_pallet_limits`), sent with every Plan / Start and sent again by themselves when `vla_bridge` (re)starts (note in the block); load bar and viewport label show the set max load. Start refuses a pallet that is not empty. In the chat "load the pallet" / "belade die Palette" plans the skill `palletize` - the same planner and run. Conveyors and fence of the cell are MoveIt obstacles while the scene is active (`virtual_object_detections.py`, objects `cell_*`). Test: `tools/grasp_e2e.py --pallet` (FAKE, domain 94).

**Pallet change + block *Cell & magazine*:** every full pallet leaves the cell: `pallet_job.py` reports state `changing` and `/vla/pallet/event` `{type: pallet_full}`, the starting Robot Control UI (`js/pallet_flow.js`) moves the pallet with its load out on the outfeed, the magazine releases one empty pallet (pneumatic pusher feeds it in), the cartons run in on the conveyors, then `/vla/skill` palletize `mode: changed`. With **Endless cycle** the next plan starts by itself, without it `vla_bridge` publishes the plan for the empty pallet (*Start* ready at once). Only scene objects move, never the robot; a dry run without endless cycle keeps the pallet. The fold-out block **Cell & magazine** in the *Palletizing* window (`js/pallet_cell.js`) shows the magazine stock (`4 / 5 empty pallets`, also on the info screen and as the stack in the twin) and holds *Endless cycle*, *Refill the magazine automatically when empty*, *Conveyor speed* (0.05-0.40 m/s), *Magazine capacity* (1-5), **Refill magazine** and **Simulate jam**. Empty magazine without auto refill: the change waits (stack light yellow, info screen `MAGAZINE EMPTY`, `mode: change_wait` extends the 90 s timeout) until *Refill magazine*, then *Start* again (no self-start after waiting); an E-STOP during the change also ends the endless cycle; *Reset* also refills.

<img src="../img/rcu_palletizing.png" width="85%" alt="Robot Control UI – Auto palletizing">

*Area bar › Scene **Auto palletizing**: window *Palletizing* (load PAL-01 80 / 80 kg, layer plan, order with six packages, cartons that stay on the conveyor with *Take along*) and the cell in the viewport with conveyor, pallet, numbered drop spots and the table-mounted info screen `3d_virtual_infoscreen`.*

**Target architecture:** the LLM agent stays the planner; a trained VLA model becomes one of its skills (for grasps and motions the geometric pick / place cannot do).
```
Robot Control UI (VLA-M) --/vla/*--> vla_bridge: LLM agent (plan, check, recovery)
                                        |  skills today: pick / place / home / gripper (motion handler)
                                        |  VLA skill: observation ZED image (+ wrist camera), /joint_states, gripper
                                        v  gRPC / WebSocket
                          policy server (LeRobot, own venv or Docker, GPU)
                                        |  action chunks: joint targets 6 + gripper, 10-30 Hz
                                        v
     vla_bridge -> safety chain (robot_limits, floor guard, teleop_pre_collision_checker)
                -> MoveIt Servo (/servo_server/delta_joint_cmds)
```

**Model choice** for the xArm Lite 6 with an RTX A5000 (24 GB VRAM). All candidates are available in [LeRobot](https://github.com/huggingface/lerobot), which provides one dataset format, interchangeable policies and a policy server:

| Model | Size | Role | Reason |
|---|---|---|---|
| **SmolVLA** | ~450 M | first choice | Fine-tunes on the A5000, fast inference. Weaker language understanding - a chat planner sits in front. |
| **π0.5** ([openpi](https://github.com/Physical-Intelligence/openpi)) | ~3 B | upgrade | Better generalisation to new objects and instructions. Inference fits 24 GB, LoRA fine-tuning is tight. |
| OpenVLA | 7 B | not recommended | 2024, slow. |
| GR00T N1.x | ~3 B | not recommended | Aimed at humanoid robots. |

> [!IMPORTANT]
> No VLA works reliably on the xArm Lite 6 with our cameras without fine-tuning. Plan for roughly **50-200 demonstrations per task**. The VR Quest 3 teleoperation ([3.5](vr_quest3.html#35-feature-vr-quest-3-teleoperation)) is the tool for recording them.

**Roadmap:**
1. ✅ UI section, topic contract, Nexus Webapp entry.
2. ✅ LLM agent in `vla_bridge` (Ollama / Claude): plan check with self-correction, clean grasping via *Approach from above* with yaw search, grasp check, recovery plans, clarifying questions, conversation; tested end to end with virtual objects and the physics sandbox. Replaces the former rule-based `mock` / `skills` policies (`dry_run:=true` instead of `mock`).
3. ✅ Voice input: microphone button in the VLA-M section → Whisper on the robot PC (dictation, no voice commands) → input box.
4. ✅ **Record demonstrations** (*Record demo* in the VLA-M section, node `demo_recorder` in `robot_blackbox_recorder`, starts with the Robot Control UI card, `demo_recorder:=false` switches it off): type the task into the input field, press *Record demo*, do the task with VR, gamepad or the UI, then *Save* or *Discard*. Per episode `~/.local/share/vla_demos/<dataset>/episode_NNNNNN/` holds `meta.json` (task, fps, mode, success), `data.npz` (`observation.state` = joint1..6 + gripper, `action` = next state, servo twist) and one MP4 per camera (`demo_cameras`, default ZED RGB plus `/twin/vcam/*/image/compressed`: in FAKE a virtual camera of the twin with chip *ROS* on is recorded like a camera, see [Robot Control UI](robot_control_ui.html); `meta.json` marks `image_source` `sim`/`real`/`mixed`). `tools/demos_to_lerobot.py` turns the folder into a LeRobotDataset inside the LeRobot venv (`--check` validates without LeRobot). Tested end to end in FAKE (`tools/grasp_e2e.py`; with a twin camera: 3 episodes + `--check`); the conversion itself needs the LeRobot venv and was not run here.
5. Fine-tune SmolVLA on one task (e.g. cup into box). The model runs in a **separate venv or Docker container**, never in the colcon Python, so torch / numpy do not conflict with ZED, YOLO and ROS Humble.
6. VLA as a skill of the agent: `vla_bridge` becomes the client of the policy server. Actions pass the existing safety chain; if the server stalls for more than ~200 ms the arm holds. REAL mode: reduced speed and control only with the control lock of `remote_control_watchdog` ([7.5](running.html#75-remote-control-server-client-communication)). Test in FAKE first.
7. π0.5 if SmolVLA does not generalise well enough.

---

[⬅ Previous: Digital Twin in NVIDIA Isaac Sim](isaac_sim.html) · [🏠 Overview](../readme-en.html) · [⬆ Top](#top) · [Next: Monitoring Dashboard ➡](monitoring.html)
