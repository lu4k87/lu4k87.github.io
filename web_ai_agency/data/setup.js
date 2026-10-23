// erzeugt von tools/collect_setup.py – nicht von Hand bearbeiten
export default {
 "generated": "2026-10-19 13:36",
 "agents": [
  {
   "id": "coherence-reviewer",
   "scope": "dev_ws",
   "model": "Opus",
   "edits": false,
   "does": "Prüft für den Projektmanager, ob UX Robot als Ganzes stimmig ist – gleiche Namen für dasselbe in UI (de/en), Code, Doku, TODOS, Außendarste…"
  },
  {
   "id": "docs-auditor",
   "scope": "dev_ws",
   "model": "Opus",
   "edits": false,
   "does": "Prüft die Doku des dev_ws (docs/en + docs/de, README.md/readme-de.md, Bedienhandbuch docs/operate_manual.html, Setup-Karte ui_shared/net_in…"
  },
  {
   "id": "robustness-reviewer",
   "scope": "dev_ws",
   "model": "Opus",
   "edits": false,
   "does": "Prüft Code im dev_ws auf Robustheit (ROS-2-Nodes, Launch-Dateien, rosbridge/Web-UIs, Flask-Server, Netz/Hardware) nach Skill `ros-robust` u…"
  },
  {
   "id": "safety-reviewer",
   "scope": "dev_ws",
   "model": "Opus",
   "edits": false,
   "does": "Prüft Änderungen an sicherheitskritischem Code im dev_ws (Motion Handler, Sandbox, vla_bridge, Kollisionsvorprüfung, Control-Lock/Watchdog,…"
  },
  {
   "id": "showcase-reviewer",
   "scope": "dev_ws",
   "model": "Opus",
   "edits": false,
   "does": "Prüft die Außendarstellung des dev_ws (README, docs/{project,present,operate,develop}_*.html, Poster, Video-Texte, Screenshots) gegen das B…"
  },
  {
   "id": "stack-diagnoser",
   "scope": "dev_ws",
   "model": "Opus",
   "edits": false,
   "does": "Diagnostiziert den laufenden ROS-2-Stack des Users nach Skill `ros-debug` (Mode WAIT, „out of reach“/-4, doppelte Stacks, verwaiste Nodes,…"
  },
  {
   "id": "teamwork-optimizer",
   "scope": "dev_ws",
   "model": "Opus",
   "edits": false,
   "does": "Sammelt für den Scrum Master Belege für den Workflow-Check (Mini-Retro, alle 2-3 Tage) – fix-Commits nach feat, Hook-Blockaden, liegen gebl…"
  },
  {
   "id": "test-runner",
   "scope": "dev_ws",
   "model": "Sonnet",
   "edits": false,
   "does": "Führt Tests im dev_ws isoliert aus (pytest, ui_new_code_checker.py, grasp_e2e.py, vla_eval.py, Hook-Tests) und gibt nur das Ergebnis zurück…"
  },
  {
   "id": "ui-verifier",
   "scope": "dev_ws",
   "model": "Sonnet",
   "edits": false,
   "does": "Prüft geänderte Web-UIs im dev_ws (UX | Control Interface 8081, UX | Nexus Launcher 8080, UX | Monitoring 8083, UX | Compact Interface) iso…"
  },
  {
   "id": "ws-explorer",
   "scope": "dev_ws",
   "model": "Opus",
   "edits": false,
   "does": "Sucht im dev_ws breit nach Code, Aufrufern, Topics/Services, Konfiguration oder Doku-Stellen und gibt nur Fundstellen (Datei:Zeile + 1 Satz…"
  },
  {
   "id": "ws-worker",
   "scope": "dev_ws",
   "model": "Sonnet",
   "edits": true,
   "does": "Führt klar umrissene, einfache Änderungen im dev_ws aus (Text, Übersetzungen/i18n, Doku nachziehen, Umbenennen, Abstand/Farbe in bestehende…"
  },
  {
   "id": "code-explorer",
   "scope": "global",
   "model": "Opus",
   "edits": false,
   "does": "Sucht in einem Projekt neben dem dev_ws (__project_*) oder im globalen Werkzeug-Repo breit nach Code, Aufrufern, Konfiguration oder Doku-St…"
  },
  {
   "id": "paper-reviewer",
   "scope": "global",
   "model": "Opus",
   "edits": false,
   "does": "Prüft Forschungsunterlagen des dev_ws wie ein strenger Gutachter einer HRI/HCI-Venue – Forschungsfragen, Studienprotokoll, Analyse, Manuskr…"
  },
  {
   "id": "print-reviewer",
   "scope": "global",
   "model": "Opus",
   "edits": false,
   "does": "Prüft 3D-Druckteile des dev_ws (Ordner „3d Prints (CAD)/<teil>/“ mit FreeCAD-Skript, STL, STEP, README) wie ein erfahrener Konstrukteur auf…"
  },
  {
   "id": "security-reviewer",
   "scope": "global",
   "model": "Opus",
   "edits": false,
   "does": "Prüft Code, Konfiguration oder Architektur eines Projekts (dev_ws oder __project_*) wie ein Senior Application Security Engineer / Penteste…"
  },
  {
   "id": "web-test-runner",
   "scope": "global",
   "model": "Sonnet",
   "edits": false,
   "does": "Führt die Tests eines Projekts neben dem dev_ws isoliert aus (pytest, Linter, Start-Befehl laut AGENTS.md/README.md des Projekts) und gibt…"
  },
  {
   "id": "web-ui-verifier",
   "scope": "global",
   "model": "Sonnet",
   "edits": false,
   "does": "Prüft geänderte Web-Seiten eines Projekts neben dem dev_ws (Landingpages, Web-Apps, CMS) isoliert im Headless Chrome – Hell + Dunkel, schma…"
  }
 ],
 "skills": [
  {
   "id": "build-pkg",
   "scope": "dev_ws",
   "does": "Baut ein oder mehrere ROS 2 Pakete im dev_ws gezielt mit colcon und zeigt nur die relevante Ausgabe."
  },
  {
   "id": "docs",
   "scope": "dev_ws",
   "does": "Doku im dev_ws pflegen – docs/en + docs/de, README.md/readme-de.md, Bedienhandbuch docs/operate_manual.html,…"
  },
  {
   "id": "docs-layout",
   "scope": "dev_ws",
   "does": "Anordnung der Projektseiten docs/{project,present,operate,develop}_*.html nach dem Vorbild der Hauptseite pro…"
  },
  {
   "id": "flow-graph",
   "scope": "dev_ws",
   "does": "Interaktive, animierte Data-Flow-Graphen im dev_ws (ROS-2-Topics/Services/Actions, Architektur, Pipelines, Si…"
  },
  {
   "id": "intrinsic-ros",
   "scope": "dev_ws",
   "does": "Google Intrinsic (Intrinsic Core, intrinsic-moveit, Flowstate) für die ROS-2-Entwicklung im dev_ws – was es g…"
  },
  {
   "id": "motion-viz",
   "scope": "dev_ws",
   "does": "Motion Graphics für docs/{project,present,operate,develop}_*.html, Poster- und Vorschau-Seiten im dev_ws – th…"
  },
  {
   "id": "pitch-video",
   "scope": "dev_ws",
   "does": "Erklär- und Pitch-Videos im dev_ws (~70 s + 15-s-Cutdown, 16:9 + 9:16) mit Remotion (React/TS) – Storyboard,…"
  },
  {
   "id": "project-copy",
   "scope": "dev_ws",
   "does": "Texte der Projektseiten im dev_ws wie bei Produktsoftware – Claim, Slogans, Kernmerkmale, Wortwahl, Aufbau je…"
  },
  {
   "id": "research",
   "scope": "dev_ws",
   "does": "Forschung mit dem dev_ws bis zum Paper – Forschungsfragen, Beitrag, Related Work, Studiendesign (Usability-Te…"
  },
  {
   "id": "ros-debug",
   "scope": "dev_ws",
   "does": "Diagnose des laufenden ROS-2-Stacks ohne Eingriff – Mode WAIT, falsches „out of reach“/MoveIt -4, doppelte St…"
  },
  {
   "id": "ros-robust",
   "scope": "dev_ws",
   "does": "Robustheit im dev_ws (rclpy-Nodes, Launch, rosbridge/Web-UIs, Flask, DDS, Hardware-Ausfälle) – Prüfliste, Mus…"
  },
  {
   "id": "ros2-reference",
   "scope": "dev_ws",
   "does": "Fremdes ROS-2-Fachwissen zum Nachschlagen (Apache-2.0) – Executors, Callback-Gruppen, QoS/DDS, Launch, tf2/UR…"
  },
  {
   "id": "screenshots",
   "scope": "dev_ws",
   "does": "Screenshots für README, docs, Projektseiten, Handbuch, Poster im dev_ws – sauberer Zustand (Robot | Digital T…"
  },
  {
   "id": "scrum",
   "scope": "dev_ws",
   "does": "Scrum im dev_ws (User = Product Owner, Claude-Chats = Team) – Sprint-Ziel, Planning, Daily im Lagebild, Teamb…"
  },
  {
   "id": "team-briefing",
   "scope": "dev_ws",
   "does": "Team-Briefing des kompletten Expertenteams (alle Rollen, Senior ≥ 10 Jahre), alle 7 Tage – Prozess + Workflow…"
  },
  {
   "id": "test-isolated",
   "scope": "dev_ws",
   "does": "Isoliert testen im dev_ws, ohne laufende Stacks zu stören – Headless Chrome/CDP, Nexus-Test-Instanz, UX | Mon…"
  },
  {
   "id": "ui-change",
   "scope": "dev_ws",
   "does": "Vorgehen + Checkliste für Änderungen an Web-UIs (UX | Control Interface, UX | Nexus Launcher, UX | Monitoring…"
  },
  {
   "id": "ui-motion",
   "scope": "dev_ws",
   "does": "Bewegung in den Bedien-UIs (UX | Control Interface, UX | Nexus Launcher, UX | Monitoring, UX | Compact Interf…"
  },
  {
   "id": "video-shots",
   "scope": "dev_ws",
   "does": "Video-Shots im dev_ws – Werbe- und Präsentations-Clips (Twin, UX | Control Interface, UX | Nexus Launcher, UX…"
  },
  {
   "id": "vla-motion",
   "scope": "dev_ws",
   "does": "vla_bridge (LLM-Agent, Skills), Motion Handler (MoveGroup/Servo), Sandbox, Greifen/Platzieren/Palettieren im…"
  },
  {
   "id": "webxr-twin",
   "scope": "dev_ws",
   "does": "three.js Digital Twin + WebXR (Quest 3) der UX | Control Interface – Szene, Layer, Overlays, VR/AR, HUD, Cont…"
  },
  {
   "id": "animated-chart",
   "scope": "global",
   "does": "Make a looping animated chart for LinkedIn or a newsletter in code with Claude Code."
  },
  {
   "id": "answer-page",
   "scope": "global",
   "does": "Antwortformat für JEDE Antwort (RULES.md §2), gleich für Claude, Codex, Gemini – Ergebnis-Zeile, Abweichungen…"
  },
  {
   "id": "apple-launch-film",
   "scope": "global",
   "does": "Apple-Stil Mac-Launchfilm komplett in Code: dünne Menüleiste, Notch wächst zu Widgets, Verlaufs-Wallpapers, j…"
  },
  {
   "id": "blender",
   "scope": "global",
   "does": "Blender 5.2 im dev_ws – Modelle, Szenen, Materialien, Renders (Cycles/Eevee), Turntables, Import/Export (STL,…"
  },
  {
   "id": "brand-intake",
   "scope": "global",
   "does": "Setup-Schritt für alle Motion-Skills dieses Packs: kurzes Interview + 3–5 Referenzbilder → brand.md + MOTION.…"
  },
  {
   "id": "cad-print",
   "scope": "global",
   "does": "3D-Objekte für den FDM-Druck im dev_ws entwerfen – Halter, Gehäuse, Gelenke, Klemmen, Adapter, Mini-Twin – pa…"
  },
  {
   "id": "commit",
   "scope": "global",
   "does": "Erstellt Git-Commits im dev_ws im Stil des Repos (Conventional Commits mit Scope)."
  },
  {
   "id": "d3-viz",
   "scope": "global",
   "does": "D3.js für eigene interaktive Graphen: Netzwerke, Karten, Sankey, Treemaps, Zoom, Brush, Tooltips, Übergänge,…"
  },
  {
   "id": "deep-think",
   "scope": "global",
   "does": "Schaltet den Haupt-Chat für diesen Turn auf Fable (Effort high) – nur für die schwersten Teilaufgaben – Plan/…"
  },
  {
   "id": "diagram-design",
   "scope": "global",
   "does": "Statische Diagramme im Editorial-Look (cathrynlavery/diagram-design): 45 Typen wie Architektur, Flowchart, Se…"
  },
  {
   "id": "gsap",
   "scope": "global",
   "does": "Offizielle GSAP-Skills (GreenSock, MIT): Core-API, Timelines, ScrollTrigger, Plugins, Utils, React (useGSAP),…"
  },
  {
   "id": "hallmark",
   "scope": "global",
   "does": "Anti-KI-Einheitslook für Webseiten (Together AI): 21 Themes, 21 Makrostrukturen, Slop-Test mit 57 Gates, 8 Zu…"
  },
  {
   "id": "humanizer",
   "scope": "global",
   "does": "KI-Ton aus Texten entfernen (blader/humanizer, nach Wikipedia „Signs of AI writing“): 26 Muster wie „nicht X,…"
  },
  {
   "id": "hyperframes-animation",
   "scope": "global",
   "does": "Bewegungs-Bibliothek aus HyperFrames (HeyGen): 48 atomare Motion-Regeln, 22 Szenen-Blueprints, Szenen-Übergän…"
  },
  {
   "id": "hyperframes-creative",
   "scope": "global",
   "does": "Kreative Richtung aus HyperFrames (HeyGen): Design-Spec frame.md, 8 Stilwelten, 13 Frame-Presets, 9 Paletten,…"
  },
  {
   "id": "impeccable",
   "scope": "global",
   "does": "Design-Kritik und Feinschliff für Web-UIs (Impeccable, Apache-2.0, nur Textteil): audit, critique, polish, an…"
  },
  {
   "id": "launch-video",
   "scope": "global",
   "does": "30–45-s-Produkt-Launchvideo in Code: ein Satz über Szenen, Produktscreens mit Kamerafahrt, getippter Prompt,…"
  },
  {
   "id": "loop-cover",
   "scope": "global",
   "does": "Newsletter-/Blog-Cover → nahtloses Loop-GIF 896×640, 180 Frames bei 20 fps; nur ein Element bewegt sich, Naht…"
  },
  {
   "id": "mein-feedback",
   "scope": "global",
   "does": "Feedback-Runde zum eigenen Workflow alle 4 Tage (Chat-Start meldet „Mein Feedback fällig“) – 2–3 gezielte, ve…"
  },
  {
   "id": "milestone-reveal",
   "scope": "global",
   "does": "12-s-Loop-Clip in Code: tausende Punkte ziehen sich zur echten Zahl (Follower, Umsatz …) zusammen, Linie, Lab…"
  },
  {
   "id": "model-routing",
   "scope": "global",
   "does": "Modell (Fable/Opus/Sonnet) und Effort je Teilaufgabe selbst wählen und umschalten – Haupt-Chat, Projekt-Agent…"
  },
  {
   "id": "model-showdown",
   "scope": "global",
   "does": "Gleiches Motion-Brief an drei KI-Modelle, erste Versuche gleich gerendert, Vergleichsvideo 16:9 + 1080×1920."
  },
  {
   "id": "motion-3d",
   "scope": "global",
   "does": "3D-Motion-Design und Visualisierung auf Senior-Niveau im dev_ws – Produkt- und Montage-Animationen, Explosion…"
  },
  {
   "id": "motion-brief-writer",
   "scope": "global",
   "does": "Rohidee für eine animierte Grafik → präzises Build-Brief für Claude Code in eigener Marke; fragt Zahlen/Forma…"
  },
  {
   "id": "motion-diagrams",
   "scope": "global",
   "does": "Animierte Diagramm-Arten im dev_ws – Prozesskette, Entscheidungsbaum, Sequenz, Zustandsautomat, Netz/Stern, K…"
  },
  {
   "id": "motion-effects",
   "scope": "global",
   "does": "16 Premium-Motion-Effekte (UI, Daten, Typo, Systeme) als 8-s-Loop-HTML mit window.seek(s), frame-genau nach M…"
  },
  {
   "id": "motion-prompt-writer",
   "scope": "global",
   "does": "Schreibt einen vollständigen 8-teiligen Claude-Motion-Prompt (Bar, Format, One rule, Look, Motion, Never, Bef…"
  },
  {
   "id": "newsletter-promo",
   "scope": "global",
   "does": "Newsletter-Ausgabe → 12–20-s-Promo-Clip für LinkedIn/Instagram/X: Hook-Frage, drei Beweis-Frames, Name + Ziel."
  },
  {
   "id": "ponytail",
   "scope": "global",
   "does": "Lazy-senior-dev mode (lite/full/ultra) plus over-engineering modes review (diff), audit (repo/folder), debt (…"
  },
  {
   "id": "preview",
   "scope": "global",
   "does": "Vorschau-Webseiten im dev_ws (spec.json → capture.py → build.py → Artifact mit Kommentaren) für neue UI-Eleme…"
  },
  {
   "id": "projekt-interview",
   "scope": "global",
   "does": "Projekt-Interview alle 3 Tage (Chat-Start meldet „Projekt-Interview faellig“) – Organizer fragt nach Ziel, Zi…"
  },
  {
   "id": "reel-export",
   "scope": "global",
   "does": "Horizontales/quadratisches Motion-Video → 1080×1920 Reel/TikTok: Safe Zone, H.264, yuv420p, bt709, stumme Ton…"
  },
  {
   "id": "reference-to-motion",
   "scope": "global",
   "does": "Referenzen (Video für Bewegung, Website/Moodboard für Look) → szenenweiser Claude-Motion-Prompt mit Timings f…"
  },
  {
   "id": "reverse-engineer",
   "scope": "global",
   "does": "Reverse Engineering mit REA – fremde Binaries (.so, ELF, PE), Electron-/JS-Apps, Web-Bundles, .NET, APK ohne…"
  },
  {
   "id": "rive-lottie",
   "scope": "global",
   "does": "Interaktive UI-Animation mit Rive (Zustandsautomaten, Data Binding) und Lottie (lottie-web, dotLottie, After-…"
  },
  {
   "id": "root-cause",
   "scope": "global",
   "does": "Systematisch debuggen im dev_ws – erst Ursache, dann Fix; Bugs, rote Tests (pytest, grasp_e2e, ui_new_code_ch…"
  },
  {
   "id": "soft-motion",
   "scope": "global",
   "does": "Sanfte, dezente Bewegung (soft, smooth, dezent) im dev_ws – Übergänge, Fade, Glow, Puls/Atmen, Lichtstreif, H…"
  },
  {
   "id": "story-design",
   "scope": "global",
   "does": "Storytelling vor Motion und Design im dev_ws – Kernbotschaft, Spannungsbogen, Beat-Tabelle als Vorgabe für Pr…"
  },
  {
   "id": "text-format",
   "scope": "global",
   "does": "Typografie im dev_ws (Web-UIs, Projektseiten, Handbuch, Poster, Markdown) – Umbrüche, Zeilenlänge/-abstand, E…"
  },
  {
   "id": "threejs",
   "scope": "global",
   "does": "three.js und React Three Fiber nachschlagen (MIT): Grundlagen, Geometrie, Materialien, Texturen, Licht, Shade…"
  },
  {
   "id": "title-sequence-3d",
   "scope": "global",
   "does": "Filmischer 3D-Titelvorspann (8–15 s) in Code mit Three.js: Kamerafahrt durch beleuchtete Szene, dann Titel/Fr…"
  },
  {
   "id": "ui-ux-pro-max",
   "scope": "global",
   "does": "UI/UX-Wissensdatenbank (lokale Suche): Stile, Farbpaletten, Schriftpaare, UX-/Barrierefreiheits-Regeln, Icons…"
  },
  {
   "id": "variation",
   "scope": "global",
   "does": "Breitere Palette an Vorschlägen: Varianten, die sich wirklich unterscheiden – Würfel deal.py (Struktur, Fokus…"
  },
  {
   "id": "vox-explainer",
   "scope": "global",
   "does": "Kurzer Vox-Dokustil-Explainer (30–60 s) komplett in Code: Papierrisse, Halftone, Condensed-Typo, Bewegung auf…"
  }
 ],
 "memory": [
  {
   "scope": "global",
   "title": "Vor jeder Anfrage Fast-Forward-Pull",
   "file": "pre-prompt-pull.md",
   "hook": "Claude, Codex und Gemini ziehen globales Werkzeug + aktives Projekt vor der Bearbeitung; Fehler stoppt die Facharbeit"
  },
  {
   "scope": "global",
   "title": "Parallel chats: snapshot + 3-way merge",
   "file": "parallel-chats-merge.md",
   "hook": "same files as another chat: work in scratchpad, SendMessage/notify_when_idle, git merge-file dry run, never commit peer changes"
  },
  {
   "scope": "global",
   "title": "Cut: nur echte Reste",
   "file": "ui-redesign-previews-first.md",
   "hook": "bei „Cut“ keine geparkten Projekte anbieten, keine neuen TODOS-Punkte; UI-Umbauten erst Vorschau"
  },
  {
   "scope": "global",
   "title": "Tabellenspalten eindeutig",
   "file": "table-column-names.md",
   "hook": "Spaltenköpfe ausschreiben („Betroffene Dateien“, „Braucht vorab von dir“)"
  },
  {
   "scope": "global",
   "title": "Vorschau-Link 404 = falsches Konto",
   "file": "artifact-account-mismatch.md",
   "hook": "Browser lu4k87@web.de ≠ Sitzungskonto → „Seite nicht gefunden“; Konto wechseln oder lokale Datei"
  },
  {
   "scope": "global",
   "title": "Vorschau, Dialoge, Neuer Chat",
   "file": "previews-and-dialogs.md",
   "hook": "Herkunft der strengen Link-/Dialog-/Vorschau-Regeln; Regeln selbst in AGENTS.md + answer-page/preview"
  },
  {
   "scope": "global",
   "title": "Agenten-Modell Fable/Opus/Sonnet",
   "file": "agent-models-opus.md",
   "hook": "Organizer schaltet je Teilaufgabe selbst um, immer high (nur Claude); Opus Roboter/Urteil, Sonnet leichte prüfbare Agenten, Fable via deep-think; Haiku nie; Regeln Skill model-routing §2c"
  },
  {
   "scope": "global",
   "title": "Audio: PulseAudio ohne Geräte",
   "file": "audio-pulseaudio-inflight-fds.md",
   "hook": "ETOOMANYREFS durch verwaiste dconf-watch von VS Code; Fix pkill + restart pulseaudio"
  },
  {
   "scope": "global",
   "title": "Projekte neben dev_ws",
   "file": "project-folder-prefix.md",
   "hook": "jedes Nicht-Roboter-Projekt = eigenes Repo ~/__project_<Name>, Liste config/projects.yaml; Umzug + Teil B (globales Werkzeug, Memory je Projekt, projects.py new) fertig 2026-10-12, Teil 3 (Übersicht/QR, Web-Doku) offen"
  },
  {
   "scope": "global",
   "title": "Varianten-Key Bereich:A",
   "file": "preview-variant-keys-unique.md",
   "hook": "nie nacktes A/B/C bei mehreren Bereichen oder A/B/C in der UI → `Hero:A`, `Deck:B` (nicht KA/JB); Änderung vergrößert als Bildtafel"
  },
  {
   "scope": "global",
   "title": "Modell/Effort je Rechner",
   "file": "model-effort-per-machine.md",
   "hook": "nicht in der Vorlage user-settings.json; /model-Wahl bleibt, kein Backup-Müll beim Sync"
  },
  {
   "scope": "global",
   "title": "Chat-ID vor Übergabe frisch",
   "file": "chat-id-refresh-before-handoff.md",
   "hook": "ID ändert sich nach Neustart der Sitzung; vor Starttext/Schluss ListAgents, sonst kommt „Starttext übernommen“ nie an"
  },
  {
   "scope": "global",
   "title": "Vorschau: eigenes Bild je Teil",
   "file": "preview-own-image-per-part.md",
   "hook": "je Variante Einzeländerungen + Fragen mit eigenem Bild, Auswahl-Knopf immer, kein Bild doppelt; build.py erzwingt"
  },
  {
   "scope": "global",
   "title": "Antwortvorlage 1:1",
   "file": "answer-template-verbatim.md",
   "hook": "gleiche Vorlage für Claude/Codex/Gemini, nicht abwandeln; Block in RULES.md §2 = SKILL.md „Vorlage“, Test prüft Gleichheit"
  },
  {
   "scope": "global",
   "title": "Gemini-Claude-Parität",
   "file": "gemini-claude-parity.md",
   "hook": "Antigravity/Gemini Antworten müssen exakt wie bei Claude aussehen: Tabellen für Mehrfachprüfungen, Ablauf-Tabelle, passende Rolle"
  },
  {
   "scope": "global",
   "title": "Seite-öffnen-Link unten",
   "file": "page-link-at-bottom.md",
   "hook": "Webseite geändert + fertig → `🌐 Seite öffnen`-Zeile mit http-URL über der Status-Zeile, alle 3 Werkzeuge"
  },
  {
   "scope": "global",
   "title": "Schatzkammer aller Projekte",
   "file": "treasury-allprojects.md",
   "hook": "`__treasury__allprojects/<projekt>/` im globalen Repo: Vorschauen + Ideen im Git, `treasury.py save`, Link-Pfad `/__treasury__allprojects/…`"
  },
  {
   "scope": "global",
   "title": "Inspiration-Sammlung",
   "file": "treasury-inspiration.md",
   "hook": "Inspirationssammlung `__treasury__allprojects/_inspiration` – nur fremde Internet-Grafiken, die der User als Vorbild zeigt, nie Screenshots der Arbeit"
  },
  {
   "scope": "global",
   "title": "Übergabe: Rückmeldung automatisch",
   "file": "handoff-auto-feedback.md",
   "hook": "Ursprungs-Chat startet `chat_handoff.py wait <kennung>` im Hintergrund, Status bis zur Übernahme „läuft weiter“, nie 🏁"
  },
  {
   "scope": "global",
   "title": "apt-Quellen bereinigt",
   "file": "apt-sources-cleanup.md",
   "hook": "CUDA-Quelle doppelt + Gazebo-Key in trusted.gpg: ws_setup_check meldet es je Rechner; NVIDIA/ROS-Updates nur außerhalb einer Testserie"
  },
  {
   "scope": "global",
   "title": "Doppelte Aufgabe → Chat beenden",
   "file": "duplicate-task-end-chat.md",
   "hook": "anderer Chat hat die Aufgabe schon: Feedback wörtlich übergeben, nichts bauen, eigenen Chat sofort sauber mit 🏁 beenden (kein toter Chat im Lagebild)"
  },
  {
   "scope": "global",
   "title": "Varianten-Zahl vom User gilt",
   "file": "preview-variant-count-user-wins.md",
   "hook": "nennt der User eine Zahl (z. B. 5), Section-Feld \"variants\": n statt Standard 3; Bilder + F-Nummern sorgfältig"
  },
  {
   "scope": "dev_ws",
   "title": "Nexus popup-only integration",
   "file": "nexus-popup-only-integration.md",
   "hook": "new launches go into DEV/SERVER setup lists + category/icon; restart server for config panes; DDS env follows Localhost-only switch"
  },
  {
   "scope": "dev_ws",
   "title": "Nexus WebKit CPU painting",
   "file": "nexus-webkit-cpu-painting.md",
   "hook": "App-Fenster malt auf CPU: keine Blur-Schatten/Verläufe im Scrollbereich; messen per OffscreenWindow, nie sichtbare Testfenster"
  },
  {
   "scope": "dev_ws",
   "title": "TODOS aktuell halten",
   "file": "next-steps-remove-done.md",
   "hook": "Status-Tabellen Zu prüfen/Entscheidung/Noch offen nur Offenes; Fertiges nach „✅ Erledigt (letzte 20)“, nie als erledigt markieren; **TODOS im Chat zeigen: je Gruppe eigene Tabelle mit `####`-Überschrift + Leerzeilen davor/danach, Datei vorher lesen**"
  },
  {
   "scope": "dev_ws",
   "title": "project_docs.html Hub",
   "file": "project-docs-hub.md",
   "hook": "zentrale Doku-Einstiegsseite (schlicht, Abstract + 2–3 Überschriften, nie Textwand: Bullets/Sections/Gruppen); ab und zu per Dialog an Pflege erinnern"
  },
  {
   "scope": "dev_ws",
   "title": "Projektseiten dezent gerundet",
   "file": "project-docs-radius.md",
   "hook": "docs/{project,present,operate,develop}_*.html: Radius 4/6/8 px (--radius-sm/--radius/--radius-lg), Balken kantig, keine Pillen; Hook prüft ≤ 8 px"
  },
  {
   "scope": "dev_ws",
   "title": "Projektname UX Robot",
   "file": "project-name-ux-robot.md",
   "hook": "Projekt/Produkt heißt „UX Robot“ (2026-10-06), ersetzt „Assistive Arm Platform“ + „RobotUX“"
  },
  {
   "scope": "dev_ws",
   "title": "Zielbild + Stabilitätsphase",
   "file": "project-goals-stability-phase.md",
   "hook": "Interview 2026-10-14: Vorrang Stabilität + Sicherheit, Abnahme 50 Läufe + Checkliste (erst Twin, dann Hardware), Full Remote nicht jetzt"
  },
  {
   "scope": "dev_ws",
   "title": "Codex-Integration",
   "file": "codex-integration.md",
   "hook": "Codex wie Antigravity parallel zu Claude: .codex/hooks.json → codex_bridge.py, Trust per tools/codex_setup.py, Git-Regeln global ~/.codex/rules/global.rules"
  },
  {
   "scope": "dev_ws",
   "title": "Leap fährt nicht / poor tracking",
   "file": "leap-hardware-no-motion.md",
   "hook": "meist Umgebung: Konfidenz < 0,5 + Phantom-Hand → zuerst tools/leap_check.py (:8098); ZED-Hänger + 10-Hz-Gelenkwerte behoben"
  },
  {
   "scope": "dev_ws",
   "title": "CycloneDDS Participant-Limit",
   "file": "cyclonedds-participant-limit.md",
   "hook": "`Failed to find a free participant index` kommt vom fehlenden MULTICAST auf `lo`, nicht vom zuletzt gestarteten Paket"
  },
  {
   "scope": "dev_ws",
   "title": "Laptop-Build",
   "file": "laptop-build-setup.md",
   "hook": "Laptop ohne ZED/CUDA/Gazebo classic: ~/.colcon/defaults.yaml lässt Pakete aus, package.xml-Workaround per skip-worktree; GPU-Rechner nie verschlechtern"
  },
  {
   "scope": "dev_ws",
   "title": "Echte Läufe: Nexus-Logs",
   "file": "user-run-logs.md",
   "hook": "~/.ros/nexus_logs je Karte zeigt, was der User wirklich erlebt hat (abgelehnte P&P-Ziele, Leap-Entkupplung, Heartbeat-Halt); blackbox/.ros/log auch von Test-Stacks"
  }
 ],
 "hooks": [
  {
   "event": "PreToolUse",
   "matcher": "Bash|Edit|Write|MultiEdit|NotebookEdit|Agent|Task",
   "script": "pre_tool_guard.py"
  },
  {
   "event": "PreToolUse",
   "matcher": "Edit|Write|MultiEdit|NotebookEdit",
   "script": "todo_claim_hook.py"
  },
  {
   "event": "PostToolUse",
   "matcher": "Edit|Write|MultiEdit|Bash",
   "script": "post_edit_check.py"
  },
  {
   "event": "UserPromptSubmit",
   "matcher": "",
   "script": "chat_length_hint.py"
  },
  {
   "event": "UserPromptSubmit",
   "matcher": "",
   "script": "todo_claim_hook.py"
  },
  {
   "event": "SessionStart",
   "matcher": "",
   "script": "session_overview.py"
  },
  {
   "event": "Stop",
   "matcher": "",
   "script": "todo_claim_hook.py"
  },
  {
   "event": "pre-commit",
   "matcher": "git commit",
   "script": "tools/pre-commit"
  },
  {
   "event": "pre-push",
   "matcher": "git push",
   "script": "bin/pages_hook.sh · chat_sync.py"
  }
 ],
 "mcp": [
  {
   "id": "blender",
   "where": ".mcp.json (dev_ws)",
   "does": "blender-mcp"
  },
  {
   "id": "rea",
   "where": ".mcp.json (dev_ws)",
   "does": "rea"
  },
  {
   "id": "Claude Docs",
   "where": "claude.ai-Connector",
   "does": "Dokumente anlegen und bearbeiten"
  },
  {
   "id": "PayPal",
   "where": "claude.ai-Connector",
   "does": "nicht autorisiert – bleibt aus"
  }
 ],
 "repos": [
  {
   "id": "dev_ws",
   "kind": "Haupt-Repo UX Robot (privat)",
   "repo": "https://github.com/lu4k87/ux_robot"
  },
  {
   "id": "ai_dev_workflow_global",
   "kind": "globales Werkzeug: Regeln, Skills, Agenten, Hooks, Memory",
   "repo": "https://github.com/lu4k87/ai_dev_workflow_global"
  },
  {
   "id": "__project_claude_ops",
   "kind": "Live-Dashboard der Claude-Code-Chats und Agenten im HUD-Look.",
   "repo": "git@github.com:lu4k87/__project_claude_ops.git"
  },
  {
   "id": "__project_accredo",
   "kind": "Scrollytelling zum Reakkreditierungs- und PO-Novellierungsprozess einer Hochschule.",
   "repo": "git@github.com:lu4k87/__project_accredo.git"
  },
  {
   "id": "__project_immo_bohlien",
   "kind": "Neue Landingpage für ein Immobilienbüro – three.js-Hausmodell und fünf Entwürfe.",
   "repo": "git@github.com:lu4k87/__project_immo_bohlien.git"
  },
  {
   "id": "__project_hsrw_stele",
   "kind": "Web-CMS für digitale Stelen – Inhalte pflegen, Präsentationen planen, Stelen überwachen.",
   "repo": "git@github.com:lu4k87/__project_hsrw_stele.git"
  },
  {
   "id": "__project_psycho",
   "kind": "Web-App für Aufstellungen – Figuren per Handyfoto erkennen und als interaktive Skizze legen.",
   "repo": "git@github.com:lu4k87/__project_psycho.git"
  },
  {
   "id": "__project_trading_dashboard",
   "kind": "Dashboard für Swing-Trading – Live-Kurse, Scanner, News mit Sentiment und Papierhandel.",
   "repo": "git@github.com:lu4k87/__project_trading_dashboard.git"
  },
  {
   "id": "ai_dev_workflow_global",
   "kind": "ai_workflow",
   "repo": "git@github.com:lu4k87/ai_dev_workflow_global.git"
  },
  {
   "id": "__project_ai-agency",
   "kind": "Begehbares 3D-Agentenbüro zum AI Dev Workflow – jede Komponente des Setups anklickbar.",
   "repo": "git@github.com:lu4k87/__project_ai-agency.git"
  },
  {
   "id": "__project_applied_research",
   "kind": "Materialflussanalyse im Industriepark Kehrum (Kalkar) – interaktive Karte der Stoffströme.",
   "repo": "git@github.com:lu4k87/__project_applied_research.git"
  }
 ],
 "previews": [
  {
   "topic": "accredo",
   "folder": "2026-10-11-accredo-helles-redesign-mit-mehr-kontrast",
   "title": "Accredo Redesign",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/accredo/vorschauen/2026-10-11-accredo-helles-redesign-mit-mehr-kontrast/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/accredo/vorschauen/2026-10-11-accredo-helles-redesign-mit-mehr-kontrast/img/a_mid.jpg"
  },
  {
   "topic": "ai_agency",
   "folder": "2026-10-16-welt-um-das-büro-drei-umgebungen",
   "title": "Welt um das Büro",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/ai_agency/vorschauen/2026-10-16-welt-um-das-büro-drei-umgebungen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_agency/vorschauen/2026-10-16-welt-um-das-büro-drei-umgebungen/img/haus_0.jpg"
  },
  {
   "topic": "ai_agency",
   "folder": "2026-10-16-abschnitt-1-6-kamera-folgt-einer-figur",
   "title": "Büro-Kamera 1/6",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/ai_agency/vorschauen/2026-10-16-abschnitt-1-6-kamera-folgt-einer-figur/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_agency/vorschauen/2026-10-16-abschnitt-1-6-kamera-folgt-einer-figur/img/kam_0.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "20261012-startseite-workflow",
   "title": "artseite-workflow",
   "date": "20261012-s",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/20261012-startseite-workflow/index.html",
   "img": ""
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-18-claude-code-workflow-ai-ablaufdiagramm-aaa",
   "title": "AI Dev Workflow Architecture · Ablaufdiagramm im Harness-Look (AAA)",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-claude-code-workflow-ai-ablaufdiagramm-aaa/index.html",
   "img": ""
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-18-chat-antwort-template-redesign-optimierung-3-varianten",
   "title": "Chat-Template Redesign",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-chat-antwort-template-redesign-optimierung-3-varianten/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-chat-antwort-template-redesign-optimierung-3-varianten/img/chat_A.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-18-antwort-template-farbordnung-für-chat-und-antwort-seite",
   "title": "Antwort-Farben",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-antwort-template-farbordnung-für-chat-und-antwort-seite/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-antwort-template-farbordnung-für-chat-und-antwort-seite/img/chat_A.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-18-antwort-template-dashboard-redesign",
   "title": "Cockpit Dashboard Antwort-Template · Balanced Bento, Multi-Color HUD, Drag & Drop",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-antwort-template-dashboard-redesign/index.html",
   "img": ""
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-18-antwort-seite-zu-jeder-chat-antwort-3-entwürfe",
   "title": "Antwort-Seite",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-antwort-seite-zu-jeder-chat-antwort-3-entwürfe/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-antwort-seite-zu-jeder-chat-antwort-3-entwürfe/img/a1_plakat.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-18-antwort-seite-mit-hud-instrumenten-3-anordnungen",
   "title": "Antwort-Seite HUD",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-antwort-seite-mit-hud-instrumenten-3-anordnungen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-antwort-seite-mit-hud-instrumenten-3-anordnungen/img/a1.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-18-antwort-seite-hero-hologramm-optimieren-3-varianten",
   "title": "Hero der Antwort-Seite",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-antwort-seite-hero-hologramm-optimieren-3-varianten/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-antwort-seite-hero-hologramm-optimieren-3-varianten/img/a_info.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-18-antwort-seite-als-hud-3d-hologramm-animiert-einstellbar",
   "title": "Antwort-Seite HUD 3D",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-antwort-seite-als-hud-3d-hologramm-animiert-einstellbar/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-18-antwort-seite-als-hud-3d-hologramm-animiert-einstellbar/img/a_holo.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-16-vorschau-vorlage-neu-bereiche-3-varianten-mehrfachauswahl",
   "title": "Vorschau-Vorlage neu",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-16-vorschau-vorlage-neu-bereiche-3-varianten-mehrfachauswahl/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-16-vorschau-vorlage-neu-bereiche-3-varianten-mehrfachauswahl/img/map.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-16-startseite-ablauf-grafik",
   "title": "startseite-ablauf-grafik",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-16-startseite-ablauf-grafik/index.html",
   "img": ""
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-16-startseite-ab-03-arbeitsweise-drei-richtungen",
   "title": "Startseite 03",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-16-startseite-ab-03-arbeitsweise-drei-richtungen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-16-startseite-ab-03-arbeitsweise-drei-richtungen/img/a1_kopf.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-16-projektkarten-der-startseite-dezentes-redesign",
   "title": "Projektkarten-Redesign",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-16-projektkarten-der-startseite-dezentes-redesign/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-16-projektkarten-der-startseite-dezentes-redesign/img/lab_now.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-16-grafik-ablauf-einer-aufgabe-drei-neue-richtungen",
   "title": "Ablauf-Grafik",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-16-grafik-ablauf-einer-aufgabe-drei-neue-richtungen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-16-grafik-ablauf-einer-aufgabe-drei-neue-richtungen/img/a1_rail.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-14-theme-redesign-für-das-agenten-büro",
   "title": "Theme-Redesign",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-14-theme-redesign-für-das-agenten-büro/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-14-theme-redesign-für-das-agenten-büro/img/ebene2.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-14-agenten-büro-v3-bonbon-würfel-wesen-und-drei-zoom-ebenen",
   "title": "Agenten-Büro v3",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-14-agenten-büro-v3-bonbon-würfel-wesen-und-drei-zoom-ebenen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-14-agenten-büro-v3-bonbon-würfel-wesen-und-drei-zoom-ebenen/img/A_avatar.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-14-agenten-buero-feinschliff",
   "title": "Agenten-Büro Feinschliff",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-14-agenten-buero-feinschliff/index.html",
   "img": ""
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-13-vorschau-seite-varianten-seite-und-senden-leiste-neu",
   "title": "Vorschau-Seite",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-vorschau-seite-varianten-seite-und-senden-leiste-neu/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-vorschau-seite-varianten-seite-und-senden-leiste-neu/img/leiste_a.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-13-antwort-vorlage-mit-mcp-tabelle-und-mehr-tabellen",
   "title": "Antwort-Vorlage: Tabellen + MCP",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-antwort-vorlage-mit-mcp-tabelle-und-mehr-tabellen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-antwort-vorlage-mit-mcp-tabelle-und-mehr-tabellen/img/mcp_a.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-13-ai-dev-workflow-seite-als-hyperframes-szenenfolge-theme-unve",
   "title": "AI Dev Workflow als Frames",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-ai-dev-workflow-seite-als-hyperframes-szenenfolge-theme-unve/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-ai-dev-workflow-seite-als-hyperframes-szenenfolge-theme-unve/img/idee1.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-13-ai-dev-workflow-seite-als-hyperframes-szenenfolge",
   "title": "AI Dev Workflow als Frames",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-ai-dev-workflow-seite-als-hyperframes-szenenfolge/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-ai-dev-workflow-seite-als-hyperframes-szenenfolge/img/map.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-13-agenten-büro-v2-raum-figur-info-und-chat",
   "title": "Agenten-Büro v2",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-agenten-büro-v2-raum-figur-info-und-chat/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-agenten-büro-v2-raum-figur-info-und-chat/img/chat_0.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-13-agenten-büro-figuren-und-welt-überarbeitet-4-bereiche-je-3-v",
   "title": "Figuren + Welt",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-agenten-büro-figuren-und-welt-überarbeitet-4-bereiche-je-3-v/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-agenten-büro-figuren-und-welt-überarbeitet-4-bereiche-je-3-v/img/face_0.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-13-agenten-büro-der-ai-dev-workflow-als-3d-minispiel",
   "title": "Agenten-Büro",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-agenten-büro-der-ai-dev-workflow-als-3d-minispiel/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-agenten-büro-der-ai-dev-workflow-als-3d-minispiel/img/before.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-13-agenten-büro-4-neue-ideen-für-den-look-des-minispiels",
   "title": "Agenten-Büro: 4 neue Looks",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-agenten-büro-4-neue-ideen-für-den-look-des-minispiels/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-13-agenten-büro-4-neue-ideen-für-den-look-des-minispiels/img/A_1play.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-12-workflow-graphen-6-kapitel-je-3-formen",
   "title": "Workflow-Graphen",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-workflow-graphen-6-kapitel-je-3-formen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-workflow-graphen-6-kapitel-je-3-formen/img/g1a.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-12-startseite-lu4k87-github-io-redesign-mit-verständlicher-work",
   "title": "Startseite: Workflow-Grafik",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-startseite-lu4k87-github-io-redesign-mit-verständlicher-work/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-startseite-lu4k87-github-io-redesign-mit-verständlicher-work/img/b1.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-12-startseite-lu4k87-github-io-entwurf-bento-swimlanes",
   "title": "Startseite: Bento + Swimlanes",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-startseite-lu4k87-github-io-entwurf-bento-swimlanes/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-startseite-lu4k87-github-io-entwurf-bento-swimlanes/img/full_e.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-12-startseite-lu4k87-github-io-baukasten-mit-5-vorschlägen",
   "title": "Startseite: Baukasten",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-startseite-lu4k87-github-io-baukasten-mit-5-vorschlägen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-startseite-lu4k87-github-io-baukasten-mit-5-vorschlägen/img/ablauf_0.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-12-konflikte-abschnitt-für-die-ai-dev-workflow-seite",
   "title": "Konflikte",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-konflikte-abschnitt-für-die-ai-dev-workflow-seite/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-konflikte-abschnitt-für-die-ai-dev-workflow-seite/img/now.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-12-globales-werkzeug-3-schichten-ai_dev_workflow_global",
   "title": "Globales Werkzeug",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-globales-werkzeug-3-schichten-ai_dev_workflow_global/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-globales-werkzeug-3-schichten-ai_dev_workflow_global/img/hooks_a.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-12-eine-antwort-vorlage-für-claude-codex-und-gemini",
   "title": "Antwort-Vorlage",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-eine-antwort-vorlage-für-claude-codex-und-gemini/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-eine-antwort-vorlage-für-claude-codex-und-gemini/img/ask.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-12-agenten-hierarchie",
   "title": "Agenten-Hierarchie",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-12-agenten-hierarchie/index.html",
   "img": ""
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-11-workflow-seite-wird-zu-zwei-heros-g-funk-h-system",
   "title": "Claude Ops Hero FUNK + SYSTEM",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-workflow-seite-wird-zu-zwei-heros-g-funk-h-system/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-workflow-seite-wird-zu-zwei-heros-g-funk-h-system/img/funk_a.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-11-workflow-seite-im-jarvis-hud-design-redesign-text-layout",
   "title": "Workflow Jarvis Theme",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-workflow-seite-im-jarvis-hud-design-redesign-text-layout/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-workflow-seite-im-jarvis-hud-design-redesign-text-layout/img/chat_before.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-11-workflow-seite-im-jarvis-hud-design-neu",
   "title": "Workflow Jarvis Theme",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-workflow-seite-im-jarvis-hud-design-neu/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-workflow-seite-im-jarvis-hud-design-neu/img/full_before.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-11-workflow-seite-im-jarvis-hud-design",
   "title": "Workflow Jarvis Theme",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-workflow-seite-im-jarvis-hud-design/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-workflow-seite-im-jarvis-hud-design/img/full_before.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-11-workflow-seite-chats-in-den-mittelpunkt",
   "title": "Workflow Chat-Fokus",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-workflow-seite-chats-in-den-mittelpunkt/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-workflow-seite-chats-in-den-mittelpunkt/img/kpis.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-11-motion-diagramme-galerie",
   "title": "motion-diagramme-galerie",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-motion-diagramme-galerie/index.html",
   "img": ""
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-11-leitstand-varianten",
   "title": "Leitstand-Varianten",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-leitstand-varianten/index.html",
   "img": ""
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-11-demo-seiten-ansicht-workflow",
   "title": "Claude Ops Hero FUNK + SYSTEM",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-demo-seiten-ansicht-workflow/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-demo-seiten-ansicht-workflow/img/funk_a.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-11-ai-dev-workflow-redesign-als-landingpage",
   "title": "Workflow-Seite Redesign",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-ai-dev-workflow-redesign-als-landingpage/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-ai-dev-workflow-redesign-als-landingpage/img/full_a.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-11-agenten-system-architektur",
   "title": "Agenten-Architektur & Synchronisation · dev_ws",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-11-agenten-system-architektur/index.html",
   "img": ""
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-10-claude-ops-workflow-seite-aufbau-kommunikation",
   "title": "Workflow-Seite",
   "date": "2026-10-10",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-10-claude-ops-workflow-seite-aufbau-kommunikation/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-10-claude-ops-workflow-seite-aufbau-kommunikation/img/hdr_alt.jpg"
  },
  {
   "topic": "ai_workflow",
   "folder": "2026-10-07-claude-workflow-sachlich",
   "title": "Claude Workflow sachlich",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-07-claude-workflow-sachlich/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/ai_workflow/vorschauen/2026-10-07-claude-workflow-sachlich/img/now.jpg"
  },
  {
   "topic": "applied_research",
   "folder": "2026-10-19-materialfluss-karte-menüführung-und-farben",
   "title": "Materialfluss-Karte Optik",
   "date": "2026-10-19",
   "url": "http://localhost:8085/__treasury__allprojects/applied_research/vorschauen/2026-10-19-materialfluss-karte-menüführung-und-farben/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/applied_research/vorschauen/2026-10-19-materialfluss-karte-menüführung-und-farben/img/col_a.jpg"
  },
  {
   "topic": "applied_research",
   "folder": "2026-10-19-materialfluss-karte-kehrum",
   "title": "Materialfluss Kehrum",
   "date": "2026-10-19",
   "url": "http://localhost:8085/__treasury__allprojects/applied_research/vorschauen/2026-10-19-materialfluss-karte-kehrum/index.html",
   "img": ""
  },
  {
   "topic": "claude_ops",
   "folder": "jarvis-hud",
   "title": "HUD & Cockpit",
   "date": "jarvis-hud",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/jarvis-hud/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/jarvis-hud/img/full_overview.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "badges_test",
   "title": "",
   "date": "badges_tes",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/badges_test/index.html",
   "img": ""
  },
  {
   "topic": "claude_ops",
   "folder": "badges_final",
   "title": "l",
   "date": "badges_fin",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/badges_final/index.html",
   "img": ""
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-17-claude-ops-design-feinschliff-effekte-überarbeitete-code-sta",
   "title": "Claude Ops · Feinschliff, Stadt & Heros",
   "date": "2026-10-17",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-17-claude-ops-design-feinschliff-effekte-überarbeitete-code-sta/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-17-claude-ops-design-feinschliff-effekte-überarbeitete-code-sta/img/fein_a.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-15-claude-ops-feinere-edlere-elemente-und-interaktive-anzeige-o",
   "title": "Claude Ops Feinschliff",
   "date": "2026-10-15",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-15-claude-ops-feinere-edlere-elemente-und-interaktive-anzeige-o/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-15-claude-ops-feinere-edlere-elemente-und-interaktive-anzeige-o/img/crew_0.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-13-limit-hud-beim-zeigen-auf-die-drei-ringe",
   "title": "Limit-HUD",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-13-limit-hud-beim-zeigen-auf-die-drei-ringe/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-13-limit-hud-beim-zeigen-auf-die-drei-ringe/img/nachher.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-13-brain-kreisfläche-unter-dem-gehirn-mit-echten-infos",
   "title": "BRAIN-Sockel",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-13-brain-kreisfläche-unter-dem-gehirn-mit-echten-infos/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-13-brain-kreisfläche-unter-dem-gehirn-mit-echten-infos/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-13-brain-feinschliff",
   "title": "BRAIN Feinschliff · Bildbogen",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-13-brain-feinschliff/index.html",
   "img": ""
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-12-spektrum-hud-elemente-mehr-farben",
   "title": "Claude Ops – SPEKTRUM: neue HUD-Elemente, mehr Farben",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-12-spektrum-hud-elemente-mehr-farben/index.html",
   "img": ""
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-12-claude-ops-treibstoff-popover-neu",
   "title": "Treibstoff neu",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-12-claude-ops-treibstoff-popover-neu/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-12-claude-ops-treibstoff-popover-neu/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-12-claude-ops-template-katalog",
   "title": "Claude Ops – Template-Katalog",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-12-claude-ops-template-katalog/index.html",
   "img": ""
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-12-claude-ops-hero-chat-übersichtlicher-5-varianten",
   "title": "Hero-Chat 5 Varianten",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-12-claude-ops-hero-chat-übersichtlicher-5-varianten/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-12-claude-ops-hero-chat-übersichtlicher-5-varianten/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-12-claude-ops-drei-richtungen-für-die-monitoring-zentrale",
   "title": "Claude Ops · Leitbild",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-12-claude-ops-drei-richtungen-für-die-monitoring-zentrale/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-12-claude-ops-drei-richtungen-für-die-monitoring-zentrale/img/atlas.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-12-claude-ops-drei-neue-templates",
   "title": "Claude Ops – 3 neue Templates",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-12-claude-ops-drei-neue-templates/index.html",
   "img": ""
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-12-claude-ops-6-komplett-uis",
   "title": "Claude Ops – 6 komplette UI-Templates",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-12-claude-ops-6-komplett-uis/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-12-claude-ops-6-komplett-uis/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-viewport-hud-bei-schmalem-viewport",
   "title": "HUD schmal",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-viewport-hud-bei-schmalem-viewport/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-viewport-hud-bei-schmalem-viewport/img/hud_a.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-reaktor-quota-tracker-dezente-radar-visualisierung-statt-bun",
   "title": "Radar Limits",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-reaktor-quota-tracker-dezente-radar-visualisierung-statt-bun/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-reaktor-quota-tracker-dezente-radar-visualisierung-statt-bun/img/before.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-n91-echter-chat-wird-chat-arbeitsplatz-runde-2-hud-look",
   "title": "N91 Chat-Arbeitsplatz",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-n91-echter-chat-wird-chat-arbeitsplatz-runde-2-hud-look/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-n91-echter-chat-wird-chat-arbeitsplatz-runde-2-hud-look/img/before.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-n91-chat-redesign",
   "title": "N91 Chat-Redesign",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-n91-chat-redesign/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-n91-chat-redesign/img/a_dark.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-missionen-sections-neu-anordnen-2-und-3-spalten",
   "title": "Missionen-Layouts",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-missionen-sections-neu-anordnen-2-und-3-spalten/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-missionen-sections-neu-anordnen-2-und-3-spalten/img/comparison_sheet.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-jarvis-redesign-einzelvorschläge",
   "title": "Jarvis Redesign",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-jarvis-redesign-einzelvorschläge/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-jarvis-redesign-einzelvorschläge/img/crew_a.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-jarvis-hud-atlas",
   "title": "Jarvis HUD & Cockpit Telemetrie-Atlas",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-jarvis-hud-atlas/index.html",
   "img": ""
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-jarvis-brain-mehr-bedeutung-in-git-ringen-sockel-strahl-schi",
   "title": "Jarvis Brain: Varianten",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-jarvis-brain-mehr-bedeutung-in-git-ringen-sockel-strahl-schi/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-jarvis-brain-mehr-bedeutung-in-git-ringen-sockel-strahl-schi/img/git_a.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-jarvis-9-neue-ideen-in-3-bereichen",
   "title": "Jarvis: neue Ideen",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-jarvis-9-neue-ideen-in-3-bereichen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-jarvis-9-neue-ideen-in-3-bereichen/img/base.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-echter-chat-wird-zum-vollständigen-chat-arbeitsplatz",
   "title": "N91 Chat-Redesign",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-echter-chat-wird-zum-vollständigen-chat-arbeitsplatz/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-echter-chat-wird-zum-vollständigen-chat-arbeitsplatz/img/a_dark.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-dezenteres-jarvis-layout-hauptelemente-huds",
   "title": "Jarvis dezenter",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-dezenteres-jarvis-layout-hauptelemente-huds/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-dezenteres-jarvis-layout-hauptelemente-huds/img/hud_a.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-demo-seiten-ansicht-hud",
   "title": "HUD-Elemente",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-demo-seiten-ansicht-hud/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-demo-seiten-ansicht-hud/img/gesamt_neu.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-crew-card-logo",
   "title": "Vorschau: Logo über Prozent-Kreisbalken",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-crew-card-logo/index.html",
   "img": ""
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-cockpit-hud-elemente-neue-telemetrie-gauges-graphen-für-jarv",
   "title": "HUD & Cockpit",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-cockpit-hud-elemente-neue-telemetrie-gauges-graphen-für-jarv/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-cockpit-hud-elemente-neue-telemetrie-gauges-graphen-für-jarv/img/full_overview.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-cockpit-hud-elemente-neue-telemetrie-gauges-graphen-fuer-jarv",
   "title": "HUD & Cockpit",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-cockpit-hud-elemente-neue-telemetrie-gauges-graphen-fuer-jarv/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-cockpit-hud-elemente-neue-telemetrie-gauges-graphen-fuer-jarv/img/full_overview.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-claude-ops-treibstoff-popover-neu-gestalten",
   "title": "Treibstoff neu",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-treibstoff-popover-neu-gestalten/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-treibstoff-popover-neu-gestalten/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-claude-ops-spektrum-mit-tortendiagrammen-statt-balken",
   "title": "Spektrum als Torte",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-spektrum-mit-tortendiagrammen-statt-balken/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-spektrum-mit-tortendiagrammen-statt-balken/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-claude-ops-kopfleiste-neu-ordnen",
   "title": "Claude Ops: Kopfleiste",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-kopfleiste-neu-ordnen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-kopfleiste-neu-ordnen/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-claude-ops-hud-elemente-aus-der-inspiration",
   "title": "HUD-Elemente",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-hud-elemente-aus-der-inspiration/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-hud-elemente-aus-der-inspiration/img/gesamt_neu.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-claude-ops-code-stadt-interaktiver-effekte-farben-neue-huds",
   "title": "Code-Stadt interaktiv",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-code-stadt-interaktiver-effekte-farben-neue-huds/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-code-stadt-interaktiver-effekte-farben-neue-huds/img/var_a.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-claude-ops-chat-karte-logo-in-die-ecke-prozent-mit-abstand",
   "title": "Chat-Karte: Logo + Prozent",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-chat-karte-logo-in-die-ecke-prozent-mit-abstand/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-chat-karte-logo-in-die-ecke-prozent-mit-abstand/img/a.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-claude-ops-aus-02-kommunikation-an-echte-chats-schreiben",
   "title": "An Chats schreiben",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-aus-02-kommunikation-an-echte-chats-schreiben/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-aus-02-kommunikation-an-echte-chats-schreiben/img/map.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-claude-ops-ai-chats-hero-effekte-anhang-modell",
   "title": "AI CHATS Hero",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-ai-chats-hero-effekte-anhang-modell/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-claude-ops-ai-chats-hero-effekte-anhang-modell/img/before.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-brain-trichter-unter-dem-gehirn-neu",
   "title": "BRAIN-Trichter",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-brain-trichter-unter-dem-gehirn-neu/index.html",
   "img": ""
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-11-ai-chats-klarere-zusammenhänge-statt-leuchtpunkte",
   "title": "AI CHATS neu ordnen",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-ai-chats-klarere-zusammenhänge-statt-leuchtpunkte/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-11-ai-chats-klarere-zusammenhänge-statt-leuchtpunkte/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-10-missionen-taktische-sektions-abgrenzung-feinschliff",
   "title": "Missionen-Sektionen",
   "date": "2026-10-10",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-10-missionen-taktische-sektions-abgrenzung-feinschliff/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-10-missionen-taktische-sektions-abgrenzung-feinschliff/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-10-cockpit-hud-elemente-neue-telemetrie-gauges-graphen-für-jarv",
   "title": "HUD & Cockpit",
   "date": "2026-10-10",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-10-cockpit-hud-elemente-neue-telemetrie-gauges-graphen-für-jarv/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-10-cockpit-hud-elemente-neue-telemetrie-gauges-graphen-für-jarv/img/full_overview.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-10-cockpit-hud-elemente-neue-telemetrie-gauges-graphen-fuer-jarv",
   "title": "HUD & Cockpit",
   "date": "2026-10-10",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-10-cockpit-hud-elemente-neue-telemetrie-gauges-graphen-fuer-jarv/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-10-cockpit-hud-elemente-neue-telemetrie-gauges-graphen-fuer-jarv/img/full_overview.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-09-redesign-des-brain-mesh-pointclouds",
   "title": "Brain Mesh",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-09-redesign-des-brain-mesh-pointclouds/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-09-redesign-des-brain-mesh-pointclouds/img/detail_bio.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-09-neuron-karte-header-im-hud-stil-vorbild-anhang-2",
   "title": "BRAIN-Karte HUD",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-09-neuron-karte-header-im-hud-stil-vorbild-anhang-2/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-09-neuron-karte-header-im-hud-stil-vorbild-anhang-2/img/chat_after.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-09-git-plakette-knoten-drei-effekt-richtungen",
   "title": "Claude Ops: Satellit-Badges cooler",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-09-git-plakette-knoten-drei-effekt-richtungen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-09-git-plakette-knoten-drei-effekt-richtungen/img/before.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-09-claude-ops-git-knoten-als-www-punktwolke",
   "title": "Git im WWW",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-09-claude-ops-git-knoten-als-www-punktwolke/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-09-claude-ops-git-knoten-als-www-punktwolke/img/globus.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-09-chat-section-nachricht-an-einen-chat-senden",
   "title": "Claude Ops: an Chat senden",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-09-chat-section-nachricht-an-einen-chat-senden/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-09-chat-section-nachricht-an-einen-chat-senden/img/before.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-08-missionen-einklappbare-verschiebbare-sections",
   "title": "Missionen: Sections",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-08-missionen-einklappbare-verschiebbare-sections/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-08-missionen-einklappbare-verschiebbare-sections/img/dnd.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-08-claude-ops-missionen-neu-gestalten",
   "title": "Missionen Redesign",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-08-claude-ops-missionen-neu-gestalten/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-08-claude-ops-missionen-neu-gestalten/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-08-claude-ops-hero-effekte-missionen-section",
   "title": "Ops: Hero + Missionen",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-08-claude-ops-hero-effekte-missionen-section/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-08-claude-ops-hero-effekte-missionen-section/img/h_ja.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-08-claude-ops-gestensteuerung-per-webcam",
   "title": "Gesten E0",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-08-claude-ops-gestensteuerung-per-webcam/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-08-claude-ops-gestensteuerung-per-webcam/img/cur_0.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-strahl-in-der-kreisfläche",
   "title": "Strahl in der Kreisfläche",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-strahl-in-der-kreisfläche/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-strahl-in-der-kreisfläche/img/SA.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-rollen-am-reaktor",
   "title": "Rollen am Reaktor",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-rollen-am-reaktor/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-rollen-am-reaktor/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-reaktor-zoom",
   "title": "Reaktor-Zoom",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-reaktor-zoom/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-reaktor-zoom/img/flug_1.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-gehirn-tiefe-dezenter",
   "title": "Gehirn: Tiefe + dezenter",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-gehirn-tiefe-dezenter/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-gehirn-tiefe-dezenter/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-gehirn-punktwolke-realistischer-mehr-teile-gleich-schnell",
   "title": "Gehirn-Punktwolke",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-gehirn-punktwolke-realistischer-mehr-teile-gleich-schnell/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-gehirn-punktwolke-realistischer-mehr-teile-gleich-schnell/img/ka.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-gehirn-punktwolke-echte-windungen-in-der-form",
   "title": "Gehirn-Punktwolke",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-gehirn-punktwolke-echte-windungen-in-der-form/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-gehirn-punktwolke-echte-windungen-in-der-form/img/dbg.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-cpu-gpu-vram-ram-im-claude-ops",
   "title": "Rechner-Last",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-cpu-gpu-vram-ram-im-claude-ops/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-cpu-gpu-vram-ram-im-claude-ops/img/now.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-claude-ops-neue-animation-statt-des-umlaufenden-strahls",
   "title": "Strahl in der Kreisfläche",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-neue-animation-statt-des-umlaufenden-strahls/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-neue-animation-statt-des-umlaufenden-strahls/img/SA.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-claude-ops-look-der-eck-klammer-knöpfe",
   "title": "Eck-Klammer-Knöpfe",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-look-der-eck-klammer-knöpfe/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-look-der-eck-klammer-knöpfe/img/common.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-claude-ops-listen-scrollen-buttons-moderner",
   "title": "Claude Ops Scrollen + Buttons",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-listen-scrollen-buttons-moderner/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-listen-scrollen-buttons-moderner/img/map.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-claude-ops-immersiver-bewegter-hörbar",
   "title": "Claude Ops: Jarvis-Ausbau",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-immersiver-bewegter-hörbar/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-immersiver-bewegter-hörbar/img/all.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-claude-ops-header-als-status-leiste",
   "title": "Ops Header entlasten",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-header-als-status-leiste/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-header-als-status-leiste/img/ha.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-claude-ops-farben",
   "title": "Claude Ops Farben",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-farben/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-farben/img/fa.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-claude-ops-eck-klammer-knöpfe-umgestalten-dossier-rechts-grö",
   "title": "Knöpfe + Dossier",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-eck-klammer-knöpfe-umgestalten-dossier-rechts-grö/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-eck-klammer-knöpfe-umgestalten-dossier-rechts-grö/img/b_a.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-claude-ops-chips-rechts",
   "title": "Claude Ops Chips + rechts",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-chips-rechts/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-chips-rechts/img/full_a.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-claude-ops-ausbau",
   "title": "Claude Ops – Ausbau",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-ausbau/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-claude-ops-ausbau/img/map.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-brain-flug-durch-das-gehirn",
   "title": "Brain-Flug",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-brain-flug-durch-das-gehirn/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-brain-flug-durch-das-gehirn/img/f01.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-brain-3d",
   "title": "Brain 3D",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-brain-3d/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-brain-3d/img/a_zoom.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-07-aktuelle-rolle-in-den-status-badges-hervorheben",
   "title": "Rolle hervorheben",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-aktuelle-rolle-in-den-status-badges-hervorheben/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-07-aktuelle-rolle-in-den-status-badges-hervorheben/img/ka.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-06-missionen-in-der-szene",
   "title": "Missionen in der Szene",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-06-missionen-in-der-szene/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-06-missionen-in-der-szene/img/base.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-06-missionen-board-stoppuhr",
   "title": "Missionen-Board + Stoppuhr",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-06-missionen-board-stoppuhr/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-06-missionen-board-stoppuhr/img/st_fin.jpg"
  },
  {
   "topic": "claude_ops",
   "folder": "2026-10-06-jarvis-hud",
   "title": "Jarvis HUD",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-06-jarvis-hud/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/claude_ops/vorschauen/2026-10-06-jarvis-hud/img/before.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-19-szene-intralogistics-amr-halle-zielwahl-und-touren",
   "title": "AMR-Szene erweitern",
   "date": "2026-10-19",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-19-szene-intralogistics-amr-halle-zielwahl-und-touren/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-19-szene-intralogistics-amr-halle-zielwahl-und-touren/img/fix_map.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-19-shaker-halter-shaker-einklicken-und-wieder-freigeben",
   "title": "Shaker-Klick",
   "date": "2026-10-19",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-19-shaker-halter-shaker-einklicken-und-wieder-freigeben/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-19-shaker-halter-shaker-einklicken-und-wieder-freigeben/img/A_in.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-19-materialflussanalyse-kehrum",
   "title": "Materialfluss Kehrum",
   "date": "2026-10-19",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-19-materialflussanalyse-kehrum/index.html",
   "img": ""
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-18-zeiger-der-freien-gesten-im-3d-viewport-größer-und-klarer",
   "title": "Gesten-Zeiger im Viewport",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-zeiger-der-freien-gesten-im-3d-viewport-größer-und-klarer/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-zeiger-der-freien-gesten-im-3d-viewport-größer-und-klarer/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-18-ux-compact-interface-bedienung-am-handy-390-px",
   "title": "CUI Bedienung",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-ux-compact-interface-bedienung-am-handy-390-px/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-ux-compact-interface-bedienung-am-handy-390-px/img/c_tap.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-18-shaker-halter-optimieren-3-richtungen",
   "title": "Shaker-Halter optimieren",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-shaker-halter-optimieren-3-richtungen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-shaker-halter-optimieren-3-richtungen/img/0_open.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-18-shaker-halter-aussparungen-als-voronoi-gitter",
   "title": "Shaker-Halter Voronoi",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-shaker-halter-aussparungen-als-voronoi-gitter/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-shaker-halter-aussparungen-als-voronoi-gitter/img/0_boden.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-18-shaker-halter-am-flansch-des-xarm-lite-6",
   "title": "Shaker-Halter Flansch",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-shaker-halter-am-flansch-des-xarm-lite-6/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-shaker-halter-am-flansch-des-xarm-lite-6/img/drucklage.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-18-projekt-doku-aktueller-befund-und-drei-bessere-einstiege",
   "title": "Projekt-Doku-Audit",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-projekt-doku-aktueller-befund-und-drei-bessere-einstiege/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-projekt-doku-aktueller-befund-und-drei-bessere-einstiege/img/bento-change.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-18-neue-hud-elemente-im-ux-nexus-launcher",
   "title": "Neue HUD-Elemente",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-neue-hud-elemente-im-ux-nexus-launcher/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-18-neue-hud-elemente-im-ux-nexus-launcher/img/ka.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-17-ux-nexus-launcher-sinnvollere-anordnung-in-3-varianten",
   "title": "UX | Nexus Launcher Redesign",
   "date": "2026-10-17",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-17-ux-nexus-launcher-sinnvollere-anordnung-in-3-varianten/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-17-ux-nexus-launcher-sinnvollere-anordnung-in-3-varianten/img/q_order.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-17-ux-control-interface-3-bereiche-mit-je-3-varianten-optimiere",
   "title": "UX | Control Interface Optimierung",
   "date": "2026-10-17",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-17-ux-control-interface-3-bereiche-mit-je-3-varianten-optimiere/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-17-ux-control-interface-3-bereiche-mit-je-3-varianten-optimiere/img/fuss_0vor.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-17-projekt-doku-drei-bessere-einstiege",
   "title": "Projekt-Doku-Optimierung",
   "date": "2026-10-17",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-17-projekt-doku-drei-bessere-einstiege/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-17-projekt-doku-drei-bessere-einstiege/img/before.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-17-icon-sets-8-varianten",
   "title": "UX Robot · 7 Kreative Icon-Set-Varianten",
   "date": "2026-10-17",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-17-icon-sets-8-varianten/index.html",
   "img": ""
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-16-vla-m-großes-fenster-neu-gestalten",
   "title": "VLA-M großes Fenster",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-vla-m-großes-fenster-neu-gestalten/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-vla-m-großes-fenster-neu-gestalten/img/a1.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-16-viewport-leiste-nur-icons-gruppen-mit-abstand-neuer-hover-to",
   "title": "Viewport-Leiste nur Icons",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-viewport-leiste-nur-icons-gruppen-mit-abstand-neuer-hover-to/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-viewport-leiste-nur-icons-gruppen-mit-abstand-neuer-hover-to/img/a_bar.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-16-ux-control-interface-drei-bereiche-optimieren",
   "title": "RCU-Optimierung",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-ux-control-interface-drei-bereiche-optimieren/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-ux-control-interface-drei-bereiche-optimieren/img/cam_0vor.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-16-n64-gaze-control-ui-überarbeiten",
   "title": "Gaze Control",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-n64-gaze-control-ui-überarbeiten/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-n64-gaze-control-ui-überarbeiten/img/dw_A.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-16-n49-mixed-reality-virtuelle-objekte-am-echten-arm",
   "title": "N49 Mixed Reality",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-n49-mixed-reality-virtuelle-objekte-am-echten-arm/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-n49-mixed-reality-virtuelle-objekte-am-echten-arm/img/best_A.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-16-hyperframes-beispiel-webseite-robotik-it-hero-choreografie-s",
   "title": "HyperFrames Robotik-Webseite",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-hyperframes-beispiel-webseite-robotik-it-hero-choreografie-s/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-hyperframes-beispiel-webseite-robotik-it-hero-choreografie-s/img/a1_img.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-16-cocktail-szene-feinere-materialien-und-modelle-für-theke-hoc",
   "title": "Cocktail-Szene: feinere Materialien",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-cocktail-szene-feinere-materialien-und-modelle-für-theke-hoc/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-cocktail-szene-feinere-materialien-und-modelle-für-theke-hoc/img/bottle_A_d1.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-16-cocktail-mixer-eisspender-in-der-bar-szene-design-mechanik-u",
   "title": "Cocktail mixer: Eisspender",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-cocktail-mixer-eisspender-in-der-bar-szene-design-mechanik-u/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-cocktail-mixer-eisspender-in-der-bar-szene-design-mechanik-u/img/dispenser_A_d1.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-16-cocktail-mixer-eigener-mix-im-ring-look-der-bar-szene",
   "title": "Cocktail: eigener Mix + Look",
   "date": "2026-10-16",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-cocktail-mixer-eigener-mix-im-ring-look-der-bar-szene/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-16-cocktail-mixer-eigener-mix-im-ring-look-der-bar-szene/img/LookA_counter.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-15-ux-nexus-launcher-neuer-aufbau-der-mitte-kopf-und-fuß-bleibe",
   "title": "Nexus Aufbau",
   "date": "2026-10-15",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-15-ux-nexus-launcher-neuer-aufbau-der-mitte-kopf-und-fuß-bleibe/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-15-ux-nexus-launcher-neuer-aufbau-der-mitte-kopf-und-fuß-bleibe/img/a1.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-15-settings-input-devices-als-eigene-menügruppe",
   "title": "Settings: Input devices",
   "date": "2026-10-15",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-15-settings-input-devices-als-eigene-menügruppe/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-15-settings-input-devices-als-eigene-menügruppe/img/dev_gest.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-15-privaten-code-ehrlich-und-nicht-klickbar-kennzeichnen",
   "title": "Schloss-Badge",
   "date": "2026-10-15",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-15-privaten-code-ehrlich-und-nicht-klickbar-kennzeichnen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-15-privaten-code-ehrlich-und-nicht-klickbar-kennzeichnen/img/badge_a.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-15-pick-place-cursor-für-die-place-position",
   "title": "Place-Cursor",
   "date": "2026-10-15",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-15-pick-place-cursor-für-die-place-position/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-15-pick-place-cursor-für-die-place-position/img/A_bar.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-15-funktionsatlas-drehscheibe-aufwerten-liste-klarer-anordnen",
   "title": "Funktionsatlas",
   "date": "2026-10-15",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-15-funktionsatlas-drehscheibe-aufwerten-liste-klarer-anordnen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-15-funktionsatlas-drehscheibe-aufwerten-liste-klarer-anordnen/img/la_filter.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-14-startsequenz-als-eigenes-fenster-mit-animation",
   "title": "Startfenster Sequenz",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-startsequenz-als-eigenes-fenster-mit-animation/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-startsequenz-als-eigenes-fenster-mit-animation/img/a1_stage.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-14-objekt-verschieben-bestätigen-mit-ok-abbrechen",
   "title": "Objekt verschieben bestätigen",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-objekt-verschieben-bestätigen-mit-ok-abbrechen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-objekt-verschieben-bestätigen-mit-ok-abbrechen/img/before.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-14-neue-szene-bar-cocktail-mixer-flaschenring-über-dem-roboter",
   "title": "Cocktail Mixer",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-neue-szene-bar-cocktail-mixer-flaschenring-über-dem-roboter/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-neue-szene-bar-cocktail-mixer-flaschenring-über-dem-roboter/img/mix_a.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-14-n18-21-meldungszentrale-und-deep-links-zwischen-den-apps",
   "title": "N18.21 Meldungszentrale",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-n18-21-meldungszentrale-und-deep-links-zwischen-den-apps/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-n18-21-meldungszentrale-und-deep-links-zwischen-den-apps/img/a1.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-14-n18-18-diagnose-der-ux-nexus-launcher-in-die-ux-monitoring-b",
   "title": "N18.18 Monitoring bündeln",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-n18-18-diagnose-der-ux-nexus-launcher-in-die-ux-monitoring-b/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-n18-18-diagnose-der-ux-nexus-launcher-in-die-ux-monitoring-b/img/a1.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-14-n18-18-beobachten-in-ux-monitoring-bündeln",
   "title": "N18.18 Monitoring bündeln",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-n18-18-beobachten-in-ux-monitoring-bündeln/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-n18-18-beobachten-in-ux-monitoring-bündeln/img/before.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-14-leap-hand-am-tcp-fünf-darstellungen",
   "title": "Leap-Hand im Viewport",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-leap-hand-am-tcp-fünf-darstellungen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-leap-hand-am-tcp-fünf-darstellungen/img/cloud.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-14-cocktail-szene-flüssigkeit-live-simuliert-modelle-mit-mehr-d",
   "title": "Cocktail-Szene",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-cocktail-szene-flüssigkeit-live-simuliert-modelle-mit-mehr-d/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-cocktail-szene-flüssigkeit-live-simuliert-modelle-mit-mehr-d/img/a1_level.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-14-begriffe-der-ux-control-interface-vereinheitlichen",
   "title": "Begriffe RCU",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-begriffe-der-ux-control-interface-vereinheitlichen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-14-begriffe-der-ux-control-interface-vereinheitlichen/img/e1_a.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-13-ux-nexus-launcher-5-neue-logo-ideen",
   "title": "Nexus-Logo",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-13-ux-nexus-launcher-5-neue-logo-ideen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-13-ux-nexus-launcher-5-neue-logo-ideen/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-13-umschalter-vorführung-entwicklung-in-der-aufgaben-leiste",
   "title": "N18.20 Bedienerrollen",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-13-umschalter-vorführung-entwicklung-in-der-aufgaben-leiste/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-13-umschalter-vorführung-entwicklung-in-der-aufgaben-leiste/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-13-story-umbau-hub-präsentation-n74",
   "title": "Story-Umbau N74",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-13-story-umbau-hub-präsentation-n74/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-13-story-umbau-hub-präsentation-n74/img/c_cm.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-13-neues-logo-für-ux-nexus-launcher",
   "title": "Nexus-Logo · 10 Varianten",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-13-neues-logo-für-ux-nexus-launcher/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-13-neues-logo-für-ux-nexus-launcher/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-13-leap-greif-messung",
   "title": "Leap Greif-Messung",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-13-leap-greif-messung/index.html",
   "img": ""
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-13-handbuch-neuer-erster-bereich-erste-bewegung",
   "title": "Handbuch: Erste Bewegung",
   "date": "2026-10-13",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-13-handbuch-neuer-erster-bereich-erste-bewegung/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-13-handbuch-neuer-erster-bereich-erste-bewegung/img/map.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-12-ux-nexus-launcher-neue-anordnung-und-struktur",
   "title": "Nexus Neuaufbau",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-ux-nexus-launcher-neue-anordnung-und-struktur/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-ux-nexus-launcher-neue-anordnung-und-struktur/img/now_dark.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-12-ux-control-interface-ux-check-und-optimierungen",
   "title": "UX-Check Control Interface",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-ux-control-interface-ux-check-und-optimierungen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-ux-control-interface-ux-check-und-optimierungen/img/hud_a.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-12-startseite-umsetzung",
   "title": "startseite-umsetzung",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-startseite-umsetzung/index.html",
   "img": ""
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-12-startseite-lu4k87-github-io-übersicht-aller-projekte",
   "title": "Startseite Projekte",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-startseite-lu4k87-github-io-übersicht-aller-projekte/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-startseite-lu4k87-github-io-übersicht-aller-projekte/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-12-robot-hero-der-projekt-doku-feinschliff-an-der-3d-bühne",
   "title": "Robot-Hero Feinschliff",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-robot-hero-der-projekt-doku-feinschliff-an-der-3d-bühne/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-robot-hero-der-projekt-doku-feinschliff-an-der-3d-bühne/img/bub_new.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-12-n18-18-beobachten-in-ux-monitoring-bündeln",
   "title": "N18.18 Monitoring bündeln",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-n18-18-beobachten-in-ux-monitoring-bündeln/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-n18-18-beobachten-in-ux-monitoring-bündeln/img/before.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-12-leap-motion-2-hand-fenster-und-tcp-per-handbewegung",
   "title": "Leap-Hand im RCU",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-leap-motion-2-hand-fenster-und-tcp-per-handbewegung/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-leap-motion-2-hand-fenster-und-tcp-per-handbewegung/img/ghost.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-12-leap-kalibrierung",
   "title": "Leap Kalibrierung",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-leap-kalibrierung/index.html",
   "img": ""
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-12-gesten-kalibrieren-und-mit-befehlen-verknüpfen",
   "title": "Gesten-Setup",
   "date": "2026-10-12",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-gesten-kalibrieren-und-mit-befehlen-verknüpfen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-12-gesten-kalibrieren-und-mit-befehlen-verknüpfen/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-11-ux-nexus-launcher-visuelle-überarbeitung-in-drei-richtungen",
   "title": "Nexus visuell",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-ux-nexus-launcher-visuelle-überarbeitung-in-drei-richtungen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-ux-nexus-launcher-visuelle-überarbeitung-in-drei-richtungen/img/A_fuss_1.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-11-ux-nexus-launcher-3-radikal-neue-design-konzepte",
   "title": "Nexus neues Design",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-ux-nexus-launcher-3-radikal-neue-design-konzepte/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-ux-nexus-launcher-3-radikal-neue-design-konzepte/img/canvas_nodes.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-11-redesign-ux-nexus-launcher-ablauf-architektur-dezente-effekt",
   "title": "Nexus Ablauf & Design",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-redesign-ux-nexus-launcher-ablauf-architektur-dezente-effekt/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-redesign-ux-nexus-launcher-ablauf-architektur-dezente-effekt/img/before.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-11-redesign-der-projekt-doku-drei-richtungen-für-die-ganze-seit",
   "title": "Projekt-Doku Redesign",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-redesign-der-projekt-doku-drei-richtungen-für-die-ganze-seit/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-redesign-der-projekt-doku-drei-richtungen-für-die-ganze-seit/img/a_docs.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-11-i13-visueller-ablaufeditor",
   "title": "I13 · Ablaufeditor",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-i13-visueller-ablaufeditor/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-i13-visueller-ablaufeditor/img/before.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-11-hyperframes-landingpage-für-ux-robot-drei-designrichtungen-v",
   "title": "HyperFrames Landingpage",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-hyperframes-landingpage-für-ux-robot-drei-designrichtungen-v/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-hyperframes-landingpage-für-ux-robot-drei-designrichtungen-v/img/board_a.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-11-diagramme-animiert",
   "title": "Doku-Diagramme (make_diagrams.py) – Live-Vorschau",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-diagramme-animiert/index.html",
   "img": ""
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-11-diagramm-atlas",
   "title": "Diagramm-Atlas",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-diagramm-atlas/index.html",
   "img": ""
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-11-bestätigung-vor-home-beim-szenenwechsel-robot-hardware",
   "title": "Szenenwechsel-Dialog",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-bestätigung-vor-home-beim-szenenwechsel-robot-hardware/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-11-bestätigung-vor-home-beim-szenenwechsel-robot-hardware/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-10-szenen-speichern-und-laden",
   "title": "Szene speichern",
   "date": "2026-10-10",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-10-szenen-speichern-und-laden/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-10-szenen-speichern-und-laden/img/a.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-10-n89-sitzungen-im-detail-der-testperson",
   "title": "N89 Sitzungen",
   "date": "2026-10-10",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-10-n89-sitzungen-im-detail-der-testperson/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-10-n89-sitzungen-im-detail-der-testperson/img/a0_seed.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-10-gaze-control-ui-web-oder-pyqt",
   "title": "N64 · Gaze Control",
   "date": "2026-10-10",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-10-gaze-control-ui-web-oder-pyqt/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-10-gaze-control-ui-web-oder-pyqt/img/gaze_a.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-10-funktionsatlas-menü-reorganisation-flow-effektbühne",
   "title": "Funktionsatlas Menü & Flow",
   "date": "2026-10-10",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-10-funktionsatlas-menü-reorganisation-flow-effektbühne/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-10-funktionsatlas-menü-reorganisation-flow-effektbühne/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-werkzeug-ring-bewegung-wie-ein-werkzeugrad",
   "title": "Werkzeug-Ring Motion",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-werkzeug-ring-bewegung-wie-ein-werkzeugrad/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-werkzeug-ring-bewegung-wie-ein-werkzeugrad/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-weitere-hero-sections-für-die-main-section-zentrum",
   "title": "Hero-Sections Zentrum",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-weitere-hero-sections-für-die-main-section-zentrum/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-weitere-hero-sections-für-die-main-section-zentrum/img/chronos.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-rechte-header-seite-neu-ordnen",
   "title": "Header rechts",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-rechte-header-seite-neu-ordnen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-rechte-header-seite-neu-ordnen/img/a.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-neuer-layer-erreichbarkeits-fläche-auf-dem-tisch",
   "title": "Reach footprint",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-neuer-layer-erreichbarkeits-fläche-auf-dem-tisch/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-neuer-layer-erreichbarkeits-fläche-auf-dem-tisch/img/base.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-n73-diashow-section-in-den-projektseiten",
   "title": "Diashow Projektseiten",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-n73-diashow-section-in-den-projektseiten/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-n73-diashow-section-in-den-projektseiten/img/a_dark.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-layer-fenster-als-tabs-390-px-statt-1040-px-ohne-scrollbalke",
   "title": "Layer Tabs",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-layer-fenster-als-tabs-390-px-statt-1040-px-ohne-scrollbalke/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-layer-fenster-als-tabs-390-px-statt-1040-px-ohne-scrollbalke/img/compare_width.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-i57-gamepad-belegung-bereiche-per-taste-ein-aus",
   "title": "I57 Ein/Aus per Taste",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-i57-gamepad-belegung-bereiche-per-taste-ein-aus/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-i57-gamepad-belegung-bereiche-per-taste-ein-aus/img/ber_a.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-i54-wiederkehrende-klickfolgen-routinen-im-ux-monitoring",
   "title": "I54 Routinen",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-i54-wiederkehrende-klickfolgen-routinen-im-ux-monitoring/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-i54-wiederkehrende-klickfolgen-routinen-im-ux-monitoring/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-i18-erreichbarkeits-volumen-je-greif-richtung",
   "title": "Erreichbarkeit je Greif-Richtung",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-i18-erreichbarkeits-volumen-je-greif-richtung/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-i18-erreichbarkeits-volumen-je-greif-richtung/img/a_panel.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-hero-sections-kinetik-kamerafahrten-spatial-telemetrie",
   "title": "Hero-Kinetik & Effekte",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-hero-sections-kinetik-kamerafahrten-spatial-telemetrie/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-hero-sections-kinetik-kamerafahrten-spatial-telemetrie/img/cinematic.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-hero-centerpieces-mit-mehr-ebenen-tiefe-kamerafahrten-spatia",
   "title": "Hero-Sections Kinetik & Spatial HUD",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-hero-centerpieces-mit-mehr-ebenen-tiefe-kamerafahrten-spatia/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-hero-centerpieces-mit-mehr-ebenen-tiefe-kamerafahrten-spatia/img/chronos.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-forschungsseite-zum-paper-qr-auf-github-io",
   "title": "Forschungsseite",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-forschungsseite-zum-paper-qr-auf-github-io/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-forschungsseite-zum-paper-qr-auf-github-io/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-09-ansicht-umschalter-größer-stilvoll",
   "title": "Nav-Leiste Claude Ops",
   "date": "2026-10-09",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-ansicht-umschalter-größer-stilvoll/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-09-ansicht-umschalter-größer-stilvoll/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-08-section-extras-über-dem-footer",
   "title": "Nexus Extras",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-section-extras-über-dem-footer/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-section-extras-über-dem-footer/img/a_768.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-08-robot-hero-minispiel-frechere-dialoge-freudensprung-elegante",
   "title": "Minispiel: Dialoge & Heimkehr",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-robot-hero-minispiel-frechere-dialoge-freudensprung-elegante/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-robot-hero-minispiel-frechere-dialoge-freudensprung-elegante/img/dlg_a.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-08-layer-und-planning-fenster-als-tabs-kompakt-ohne-scrollbalke",
   "title": "Layer Tabs",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-layer-und-planning-fenster-als-tabs-kompakt-ohne-scrollbalke/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-layer-und-planning-fenster-als-tabs-kompakt-ohne-scrollbalke/img/now_layers.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-08-layer-fenster-als-tabs-390-px-statt-1040-px-ohne-scrollbalke",
   "title": "Layer Tabs",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-layer-fenster-als-tabs-390-px-statt-1040-px-ohne-scrollbalke/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-layer-fenster-als-tabs-390-px-statt-1040-px-ohne-scrollbalke/img/compare_width.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-08-home-align-scan-pose-im-cartesian-jogging",
   "title": "Posen im Cartesian Jogging",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-home-align-scan-pose-im-cartesian-jogging/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-home-align-scan-pose-im-cartesian-jogging/img/ka.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-08-faq-in-der-projekt-doku",
   "title": "FAQ Projekt-Doku",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-faq-in-der-projekt-doku/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-faq-in-der-projekt-doku/img/a_dark.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-08-bereichs-leiste-knopf-für-scene-layers-planning",
   "title": "Twin-Menü in der Leiste",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-bereichs-leiste-knopf-für-scene-layers-planning/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-bereichs-leiste-knopf-für-scene-layers-planning/img/badge.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-08-bereichs-leiste-klare-struktur-ohne-querverweise",
   "title": "Leiste aufräumen",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-bereichs-leiste-klare-struktur-ohne-querverweise/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-bereichs-leiste-klare-struktur-ohne-querverweise/img/ka_rail.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-08-beispiel-hinweis-glocke-im-header",
   "title": "Beispiel-Vorschau",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-beispiel-hinweis-glocke-im-header/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-beispiel-hinweis-glocke-im-header/img/map.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-08-Gesten-Aufnahmen-HAND",
   "title": "Gesten-Aufnahmen HAND",
   "date": "2026-10-08",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-08-Gesten-Aufnahmen-HAND/index.html",
   "img": ""
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-07-schritt-③-start-modus-prüfung-und-execute-sinnvoll-anordnen",
   "title": "Start-Schritt anordnen",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-07-schritt-③-start-modus-prüfung-und-execute-sinnvoll-anordnen/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-07-schritt-③-start-modus-prüfung-und-execute-sinnvoll-anordnen/img/now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-07-neues-design-der-tab-buttons",
   "title": "Tab-Buttons Claude Ops",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-07-neues-design-der-tab-buttons/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-07-neues-design-der-tab-buttons/img/crew_a.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-07-layers-leisten-panels",
   "title": "Layers + Leisten-Panels",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-07-layers-leisten-panels/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-07-layers-leisten-panels/img/m_fine.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-07-farben-in-der-messwert-spalte",
   "title": "Farben Messwerte",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-07-farben-in-der-messwert-spalte/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-07-farben-in-der-messwert-spalte/img/fa.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-07-beispiel-hinweis-glocke-im-header",
   "title": "Beispiel-Vorschau",
   "date": "2026-10-07",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-07-beispiel-hinweis-glocke-im-header/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-07-beispiel-hinweis-glocke-im-header/img/map.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-zwei-lokale-modelle",
   "title": "Zwei lokale Modelle",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-zwei-lokale-modelle/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-zwei-lokale-modelle/img/before.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-vla-im-monitoring",
   "title": "VLA im Monitoring",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-vla-im-monitoring/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-vla-im-monitoring/img/ov.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-teilhabe-diagramm-neu",
   "title": "Teilhabe-Diagramm neu",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-teilhabe-diagramm-neu/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-teilhabe-diagramm-neu/img/hero_now.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-segment-ring",
   "title": "Segment-Ring",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-segment-ring/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-segment-ring/img/map.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-rollen-abschnitt",
   "title": "Rollen-Abschnitt",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-rollen-abschnitt/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-rollen-abschnitt/img/note_before.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-roboter-global",
   "title": "Roboter global",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-roboter-global/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-roboter-global/img/before.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-roboter-austauschbar",
   "title": "Roboter austauschbar",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-roboter-austauschbar/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-roboter-austauschbar/img/q2_list.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-projekt-doku-features-nui",
   "title": "Projekt-Doku: Features + NUI",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-projekt-doku-features-nui/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-projekt-doku-features-nui/img/after.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-objekt-bibliothek",
   "title": "Objekt-Bibliothek",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-objekt-bibliothek/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-objekt-bibliothek/img/base.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-nexus-grundstruktur",
   "title": "Nexus Grundstruktur",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-nexus-grundstruktur/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-nexus-grundstruktur/img/base_1.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-nav-leiste-arbeitsweise",
   "title": "Nav-Leiste Arbeitsweise",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-nav-leiste-arbeitsweise/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-nav-leiste-arbeitsweise/img/before.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-n66-laborobjekte",
   "title": "N66 Laborobjekte",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-n66-laborobjekte/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-n66-laborobjekte/img/infeed.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-hero-minispiel",
   "title": "Hero-Minispiel",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-hero-minispiel/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-hero-minispiel/img/a_done.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-hero-dialoge",
   "title": "Hero-Dialoge",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-hero-dialoge/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-hero-dialoge/img/before.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-diagramme-mit-effekten",
   "title": "Diagramme mit Effekten",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-diagramme-mit-effekten/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-diagramme-mit-effekten/img/var_a.jpg"
  },
  {
   "topic": "dev_ws",
   "folder": "2026-10-06-brennweite-tiefenschärfe",
   "title": "Brennweite + Tiefenschärfe",
   "date": "2026-10-06",
   "url": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-brennweite-tiefenschärfe/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/dev_ws/vorschauen/2026-10-06-brennweite-tiefenschärfe/img/after.jpg"
  },
  {
   "topic": "immo_bohlien",
   "folder": "2026-10-14-feinschliff",
   "title": "Immobilien Gisela Bohlien – Kamp-Lintfort",
   "date": "2026-10-14",
   "url": "http://localhost:8085/__treasury__allprojects/immo_bohlien/vorschauen/2026-10-14-feinschliff/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/immo_bohlien/vorschauen/2026-10-14-feinschliff/img/halde-pattberg.jpg"
  },
  {
   "topic": "psycho",
   "folder": "2026-10-17-psycho-professioneller-und-kamerabild-auswertung",
   "title": "Psycho Redesign",
   "date": "2026-10-17",
   "url": "http://localhost:8085/__treasury__allprojects/psycho/vorschauen/2026-10-17-psycho-professioneller-und-kamerabild-auswertung/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/psycho/vorschauen/2026-10-17-psycho-professioneller-und-kamerabild-auswertung/img/foto_0.jpg"
  },
  {
   "topic": "psycho",
   "folder": "2026-10-11-systembrett-verwaltung-methoden-aus-der-therapie",
   "title": "Systembrett: Ausbau",
   "date": "2026-10-11",
   "url": "http://localhost:8085/__treasury__allprojects/psycho/vorschauen/2026-10-11-systembrett-verwaltung-methoden-aus-der-therapie/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/psycho/vorschauen/2026-10-11-systembrett-verwaltung-methoden-aus-der-therapie/img/d1.jpg"
  },
  {
   "topic": "trading_dashboard",
   "folder": "2026-10-19-trading-dashboard-v2-mehr-funktionen-größere-schrift",
   "title": "HUD-Prototyp v2",
   "date": "2026-10-19",
   "url": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-19-trading-dashboard-v2-mehr-funktionen-größere-schrift/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-19-trading-dashboard-v2-mehr-funktionen-größere-schrift/img/D_drag.jpg"
  },
  {
   "topic": "trading_dashboard",
   "folder": "2026-10-19-trading-dashboard-menü-leiste-und-6-unterseiten-mit-hud",
   "title": "Menü + Unterseiten",
   "date": "2026-10-19",
   "url": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-19-trading-dashboard-menü-leiste-und-6-unterseiten-mit-hud/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-19-trading-dashboard-menü-leiste-und-6-unterseiten-mit-hud/img/NA_closed.jpg"
  },
  {
   "topic": "trading_dashboard",
   "folder": "2026-10-19-trading-dashboard-hud-prototyp-mit-6-unterseiten-und-frei-an",
   "title": "HUD-Prototyp",
   "date": "2026-10-19",
   "url": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-19-trading-dashboard-hud-prototyp-mit-6-unterseiten-und-frei-an/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-19-trading-dashboard-hud-prototyp-mit-6-unterseiten-und-frei-an/img/D_drag.jpg"
  },
  {
   "topic": "trading_dashboard",
   "folder": "2026-10-19-trading-dashboard-breiter-kopf-und-3-umschaltbare-anordnunge",
   "title": "Breiter Kopf + 3 Anordnungen",
   "date": "2026-10-19",
   "url": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-19-trading-dashboard-breiter-kopf-und-3-umschaltbare-anordnunge/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-19-trading-dashboard-breiter-kopf-und-3-umschaltbare-anordnunge/img/hdr_new.jpg"
  },
  {
   "topic": "trading_dashboard",
   "folder": "2026-10-19-optimierungen-nach-dem-bugfix-kursziel-skala-handy-ansicht-m",
   "title": "Trading Optimierungen",
   "date": "2026-10-19",
   "url": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-19-optimierungen-nach-dem-bugfix-kursziel-skala-handy-ansicht-m/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-19-optimierungen-nach-dem-bugfix-kursziel-skala-handy-ansicht-m/img/mob_a.jpg"
  },
  {
   "topic": "trading_dashboard",
   "folder": "2026-10-18-trading-dashboard-tradingview-funktionen-neu-geordnet",
   "title": "Trading Dashboard",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-18-trading-dashboard-tradingview-funktionen-neu-geordnet/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-18-trading-dashboard-tradingview-funktionen-neu-geordnet/img/ana_A.jpg"
  },
  {
   "topic": "trading_dashboard",
   "folder": "2026-10-18-trading-dashboard-bugfix-anordnung-swing-daten-und-support-r",
   "title": "Swing-Zonen + Bugfix",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-18-trading-dashboard-bugfix-anordnung-swing-daten-und-support-r/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-18-trading-dashboard-bugfix-anordnung-swing-daten-und-support-r/img/bug_demo.jpg"
  },
  {
   "topic": "trading_dashboard",
   "folder": "2026-10-18-ansichten-im-kopf-neue-monitoring-ansicht-5-varianten",
   "title": "Monitoring-Ansicht",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-18-ansichten-im-kopf-neue-monitoring-ansicht-5-varianten/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-18-ansichten-im-kopf-neue-monitoring-ansicht-5-varianten/img/chg_A1.jpg"
  },
  {
   "topic": "trading_dashboard",
   "folder": "2026-10-18-5-monitoring-dashboards-im-terminal-look",
   "title": "5 Monitoring-Dashboards",
   "date": "2026-10-18",
   "url": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-18-5-monitoring-dashboards-im-terminal-look/index.html",
   "img": "http://localhost:8085/__treasury__allprojects/trading_dashboard/vorschauen/2026-10-18-5-monitoring-dashboards-im-terminal-look/img/chg_A1.jpg"
  }
 ],
 "settings": [
  {
   "file": "~/.claude/settings.json",
   "does": "User-Settings: Modell, Berechtigungen, Memory-Pfad"
  },
  {
   "file": ".claude/settings.json",
   "does": "Projekt: Hooks (SessionStart … Stop), Erlaubt-Liste"
  },
  {
   "file": ".claude/settings.local.json",
   "does": "nur dieser Rechner: autoMemoryDirectory"
  },
  {
   "file": ".mcp.json",
   "does": "MCP-Server des Projekts"
  },
  {
   "file": "~/.codex/AGENTS.md · ~/.gemini/config/rules/common_rules.md",
   "does": "gleiche Regeln für Codex und Gemini (Links)"
  }
 ],
 "sync": {
  "machines": [
   "Laptop",
   "Labor",
   "Home-PC"
  ],
  "chain": [
   "tools/ws_sync.sh: Pull, Build, Memory",
   "bin/sync.sh → agents_sync.py --home",
   "projects.py sync (nur Fast-Forward)",
   "chat_sync.py: Chat-Verläufe"
  ]
 }
};
