// Inhalt des Agenten-Büros: der AI Dev Workflow als Daten.
// Quellen: ~/ai_dev_workflow_global/rules/{RULES,ROLES}.md, docs/ai_dev_workflow.html,
// dev_ws AGENTS.md, .claude/README.md, .claude/ROLES.md, .claude/settings.json, .mcp.json, config/projects.yaml.
// Stand 2026-10-13. Zahlen wie auf der Workflow-Seite: 51 Skills (32 + 19), 16 Agenten (5 + 11), 6 Prüfstellen.

export const PHASES = [
  { id: 'auftrag', n: 1, name: 'Beauftragen', who: 'Du (Product Owner)', steps: [1] },
  { id: 'plan', n: 2, name: 'Planen', who: 'Claude Chat Organizer', steps: [2, 3, 4, 5] },
  { id: 'bau', n: 3, name: 'Bauen', who: 'Fachrolle', steps: [6] },
  { id: 'pruef', n: 4, name: 'Prüfen', who: 'Prüfer', steps: [7, 8] },
  { id: 'liefer', n: 5, name: 'Abliefern', who: 'Synchronizer', steps: [9, 10] },
];

// Zehn Schritte; zone = Ort im Büro, an dem der Schritt passiert
export const STEPS = [
  { n: 1, name: 'Anfrage', phase: 'auftrag', zone: 'po', text: 'Du sagst, was entstehen soll – Ziel statt Anleitung. Beim Chat-Start legt session_overview.py ein Lagebild bei.' },
  { n: 2, name: 'Aufwand zuerst prüfen', phase: 'plan', zone: 'lead', text: 'Was braucht diese Anfrage wirklich? Rolle bestimmen, Skills nur bei ihrem Thema, Subagenten nur bei Bedarf.' },
  { n: 3, name: 'Kontext laden', phase: 'plan', zone: 'lib', text: 'AGENTS.md und MEMORY.md liegen jedem Chat bei; passende Skills dazu. Große Dateien nie komplett: erst grep -n.' },
  { n: 4, name: 'Planen und nachfragen', phase: 'plan', zone: 'lead', text: 'Kurzer Plan (Dateien, Vorgehen). Echte Entscheidungen werden gefragt: ❓ F1 im Chat und als Dialog.' },
  { n: 5, name: 'Vorschau-Seite', phase: 'plan', zone: 'studio', text: 'Neue UI-Elemente: erst sehen, dann bauen. Varianten A/B/C mit echten Screenshots; „An Chat senden“ ist endgültig.' },
  { n: 6, name: 'Umsetzen', phase: 'bau', zone: 'dept', text: 'Ponytail-Leiter: nötig? schon im Repo? Stdlib? nativ? – dann das Minimum. Jeder Edit läuft durch die Hooks davor und danach.' },
  { n: 7, name: 'Prüfen mit Beleg', phase: 'pruef', zone: 'qa', text: '„Fertig“ nur mit Prüf-Ausgabe aus diesem Chat nach der letzten Änderung. Prüfstufe 0–3 legt die Tiefe fest.' },
  { n: 8, name: 'Doku mitschreiben', phase: 'pruef', zone: 'docsync', text: 'Neue Funktion, Name oder Port → docs/en + docs/de, README, Handbuch, Setup-Karte im selben Zug.' },
  { n: 9, name: 'Commit + Push', phase: 'liefer', zone: 'post', text: 'Nur fertige, geprüfte, eigene Stände; Conventional Commits mit Scope; nie --force, nur Fast-Forward.' },
  { n: 10, name: 'Antwort in fester Form', phase: 'liefer', zone: 'po', text: 'Ergebnis-Zeile → Warnungen → Details → Prüf-Tabelle → Status-Zeile + Chat-ID. Der Stop-Hook prüft den Schluss.' },
];

// Vier Wege eines Auftrags (1:1 wie PATHS in ai_dev_workflow.html)
export const ORDER_TYPES = {
  q: { name: 'Reine Frage', steps: [1, 2, 3, 10], level: null, skills: [], hint: 'kurze Antwort ohne Skills, Vorschau oder Tests' },
  small: { name: 'Kleine Änderung', steps: [1, 2, 3, 6, 7, 9, 10], level: 1, hint: 'bestehendes Element, 1 Bereich, ≤ 3 Dateien' },
  safe: { name: 'Sicherheits-Fix', steps: [1, 2, 3, 4, 6, 7, 8, 9, 10], level: 3, hint: 'Roboter/Sicherheit: safety-reviewer vor dem Commit + grasp_e2e.py in Domain 94' },
  ui: { name: 'Neue UI-Funktion', steps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], level: 2, hint: 'erst Vorschau, dann Code; volle Prüfung' },
};

export const PREFIXES = [
  { id: 'Agent', area: 'Workflow, AGENTS.md, Skills, Hooks, Settings, Memory' },
  { id: 'RCU', area: 'UX | Control Interface, Twin, VR' },
  { id: 'Nexus', area: 'UX | Nexus Launcher + UX | Compact Interface' },
  { id: 'Mon', area: 'UX | Monitoring, Evaluierung' },
  { id: 'VLA', area: 'vla_bridge, Motion Handler, Greifen, Sandbox' },
  { id: 'Vision', area: 'ZED, YOLO, Octomap, Blicksteuerung, Sprachbefehle' },
  { id: 'Infra', area: 'network.yaml, Ports, Build, tools/, System' },
  { id: 'Doku', area: 'docs, README, Handbuch, Setup-Karte, Poster' },
];

// Rollen: 8 Fachrollen + 3 feste Schritte. Rolle = Tätigkeit, Präfix = Bereich.
export const ROLES = {
  organizer: { name: 'Claude Chat Organizer', icon: '🗂️', fixed: true, zone: 'lead', does: 'Start und Plan dieses Chats: Lagebild, Übergaben, Aufwand, Plan, Präfix, Rückfragen, neuer Chat anbieten (nie selbst wechseln).', method: 'Scope + Akzeptanzkriterien vor dem Start, Plan mit Risiken, Arbeit sinnvoll schneiden' },
  designer: { name: 'Designer', icon: '🎨', zone: 'd_design', does: 'Web-UI, Layout, Themes, Gestaltung der Projektseiten, Animation – entscheidet am Ende über Aussehen.', skills: ['ui-change', 'preview', 'text-format'], extra: ['variation', 'motion-viz', 'soft-motion', 'ui-motion', 'ui-ux-pro-max'], agents: ['ui-verifier', 'web-ui-verifier'], check: 'ui_new_code_checker.py, Hell + Dunkel, Screenshot-Vergleich, i18n_check.py', method: 'Design-System/Tokens, WCAG 2.2 AA, Varianten vergleichen statt erste Idee' },
  dev: { name: 'Entwickler', icon: '⚙️', zone: 'd_dev', does: 'ROS-Pakete, Server, Twin/VR, tools/, Hooks; Bugs, rote Tests, Build-Fehler.', skills: ['build-pkg', 'test-isolated'], extra: ['root-cause', 'ros-debug', 'vla-motion', 'webxr-twin', 'ros-robust'], agents: ['ws-worker', 'test-runner', 'ws-explorer', 'safety-reviewer', 'robustness-reviewer', 'stack-diagnoser', 'web-test-runner', 'code-explorer'], check: 'Prüfstufe 0–3; pytest, grasp_e2e.py, check_ws.py, check_ports.py', method: 'Clean Code, Tests für Grenzfälle, Ursache statt Symptom, Selbst-Review des Diffs' },
  editor: { name: 'Redakteur', icon: '✍️', zone: 'd_docs', does: 'docs/, README, Handbuch, Setup-Karte, Texte der Projektseiten, Poster.', skills: ['docs', 'project-copy'], extra: ['story-design', 'screenshots', 'video-shots', 'pitch-video'], agents: ['docs-auditor', 'showcase-reviewer'], check: 'check_showcase.py, en + de gleich', method: 'Docs-as-Code, Diátaxis, eine Quelle je Fakt' },
  pm: { name: 'Projektmanager', icon: '🧭', zone: 'd_pm', does: 'PO-Vertretung: Backlog TODOS.md, Refinement, Definition of Ready, Sprint-Ziel vorschlagen, Stimmigkeit.', skills: ['scrum', 'answer-page'], extra: ['project-copy', 'team-briefing'], agents: ['ws-explorer', 'coherence-reviewer'], check: 'TODOS.md nur Offenes, jede Entscheidung per Dialog', method: 'Priorisierung Wert × Risiko × Aufwand, Akzeptanzkriterien, vertikal schneiden' },
  scrum: { name: 'Scrum Master', icon: '🏉', zone: 'd_scrum', does: 'Wie wir arbeiten: Sprint-Takt, Teambesprechung, Retro (Workflow-Check alle 3 Tage), Team-Briefing alle 7 Tage, Hindernisse.', skills: ['scrum', 'team-briefing'], extra: ['answer-page', 'dataviz'], agents: ['ws-explorer', 'coherence-reviewer', 'teamwork-optimizer'], check: 'Event endet mit Ergebnis, Retro max. 2 Maßnahmen', method: 'Scrum Guide 2020, Empirie, WIP-Limit, kein Scrum-Theater' },
  research: { name: 'Forscher', icon: '🔬', zone: 'd_research', does: 'Forschung bis zum Paper: Forschungsfragen, Studiendesign, Ethik, Analyse, Manuskript.', skills: ['research'], extra: ['test-isolated', 'dataviz', 'project-copy'], agents: ['paper-reviewer', 'ws-explorer'], check: 'Gate der Etappe erfüllt, Zitate belegt', method: 'Hypothesen vorab, validierte Instrumente (SUS, NASA-TLX), Effektstärken' },
  mkt: { name: 'Marketing', icon: '📣', zone: 'd_mkt', does: 'Außenwirkung: Positionierung, Botschaft, Claim – schlägt vor, der Designer entscheidet.', skills: ['project-copy', 'story-design', 'preview'], extra: ['variation', 'hyperframes-creative', 'pitch-video'], agents: ['showcase-reviewer'], check: 'check_showcase.py, Botschaft wortgleich mit brand.yaml', method: 'Message House, jede Aussage belegbar' },
  d3: { name: '3D-Designer', icon: '🧊', zone: 'd_3d', does: 'Druckteile für FDM-Drucker, Blender-Modelle, 3D-Animation, Renders.', skills: ['cad-print', 'motion-3d', 'blender'], extra: ['story-design', 'preview', 'motion-viz'], agents: ['print-reviewer'], check: 'check_print.py ohne ❌, README des Teils vollständig', method: 'Design for Additive Manufacturing, parametrisch, Licht- und Kameraführung' },
  tester: { name: 'Prüfer', icon: '🧪', fixed: true, zone: 'qa', does: 'Definition of Done: Prüfstufe 0–3, Beleg aus diesem Chat nach der letzten Änderung, Prüf-Agenten bei Bedarf.', method: 'Vier-Augen-Prinzip, Originalsymptom erneut prüfen' },
  sync: { name: 'Synchronizer', icon: '🔄', fixed: true, zone: 'post', does: 'Commit + Push nach jeder fertigen Aufgabe, nur eigene geprüfte Dateien, Merge statt Überschreiben.', method: 'Atomare Conventional Commits, nie --force' },
};
export const FACH = ['designer', 'dev', 'editor', 'pm', 'scrum', 'research', 'mkt', 'd3'];

// 16 Subagenten: eigener Kontext, Briefing (Zweck · Umfang · gewollte Änderungen · Fokus), Rückgabe = Befund
export const AGENTS = [
  { id: 'ws-explorer', scope: 'dev_ws', model: 'Opus', edits: false, home: 'agents', does: 'Breite Suche im dev_ws, gibt nur Fundstellen (Datei:Zeile + 1 Satz) zurück.' },
  { id: 'test-runner', scope: 'dev_ws', model: 'Sonnet', effort: 'medium', edits: false, home: 'qa', does: 'Führt Tests isoliert aus (pytest, ui_new_code_checker, grasp_e2e, Hook-Tests), nur das Ergebnis zurück.' },
  { id: 'ui-verifier', scope: 'dev_ws', model: 'Sonnet', effort: 'medium', edits: false, home: 'qa', does: 'Prüft geänderte Web-UIs im Headless Chrome: Hell + Dunkel, Breiten, JS-Fehler, Screenshots.' },
  { id: 'ws-worker', scope: 'dev_ws', model: 'Sonnet', effort: 'medium', edits: true, home: 'agents', does: 'Genau umrissene, einfache Änderungen – nie Roboter-/Sicherheitscode; Haupt-Chat prüft git diff.' },
  { id: 'safety-reviewer', scope: 'dev_ws', model: 'Opus', effort: 'xhigh', edits: false, home: 'robot', does: 'Prüft Änderungen an Motion Handler, Sandbox, vla_bridge, Watchdog, E-Stop vor dem Commit gegen AGENTS.md §0.' },
  { id: 'robustness-reviewer', scope: 'dev_ws', model: 'Opus', edits: false, home: 'agents', does: 'Robustheits-Audit nach Skill ros-robust, Befunde P1–P3.' },
  { id: 'stack-diagnoser', scope: 'dev_ws', model: 'Opus', edits: false, home: 'robot', does: 'Diagnose des laufenden Stacks (Mode WAIT, out of reach) – beendet und startet nichts.' },
  { id: 'docs-auditor', scope: 'dev_ws', model: 'Opus', edits: false, home: 'docsync', does: 'Doku (en + de, READMEs, Handbuch, Setup-Karte) gegen den Code, nur Abweichungen zurück.' },
  { id: 'showcase-reviewer', scope: 'dev_ws', model: 'Opus', edits: false, home: 'agents', does: 'Außendarstellung gegen brand.yaml: Botschaft, Ton, Bilder, en/de gleich.' },
  { id: 'coherence-reviewer', scope: 'dev_ws', model: 'Opus', edits: false, home: 'agents', does: 'Stimmigkeit: gleiche Namen in UI, Code, Doku, TODOS – roter Faden.' },
  { id: 'teamwork-optimizer', scope: 'dev_ws', model: 'Opus', edits: false, home: 'meet', does: 'Belege für den Workflow-Check (Mini-Retro), max. 2 Maßnahmen, keine eigene Entscheidung.' },
  { id: 'code-explorer', scope: 'global', model: 'Opus', edits: false, home: 'agents', does: 'Breite Suche in Projekten neben dem dev_ws (__project_*), nur Fundstellen.' },
  { id: 'web-test-runner', scope: 'global', model: 'Sonnet', effort: 'medium', edits: false, home: 'qa', does: 'Tests eines Projekts neben dem dev_ws isoliert ausführen.' },
  { id: 'web-ui-verifier', scope: 'global', model: 'Sonnet', effort: 'medium', edits: false, home: 'qa', does: 'Web-Seiten eines Projekts neben dem dev_ws im Headless Chrome prüfen.' },
  { id: 'paper-reviewer', scope: 'global', model: 'Opus', edits: false, home: 'agents', does: 'Forschungsunterlagen wie ein strenger Gutachter (HRI/HCI), Befunde P1–P3.' },
  { id: 'print-reviewer', scope: 'global', model: 'Opus', edits: false, home: 'agents', does: '3D-Druckteile auf Druckbarkeit, Passungen, Festigkeit prüfen.' },
];

// 51 Skills: 32 allgemein (~/ai_dev_workflow_global/skills) + 19 dev_ws (.claude/skills)
export const SKILLS = {
  global: [
    ['answer-page', 'Antwortformat jeder Antwort'], ['text-format', 'Typografie, Umbruch, Zeilenlänge'],
    ['variation', 'Varianten mit echter Breite (Würfel)'], ['preview', 'Vorschau-Webseiten mit Varianten'],
    ['ui-ux-pro-max', 'UI/UX-Wissensdatenbank'], ['root-cause', 'Erst Ursache, dann Fix'],
    ['story-design', 'Roter Faden, Beat-Tabelle'], ['motion-diagrams', 'Animierte Diagramm-Arten'],
    ['soft-motion', 'Fade, Glow, Puls – dezent'], ['hyperframes-creative', 'Stilwelten, Paletten, Beats'],
    ['hyperframes-animation', 'Motion-Regeln, Blueprints'], ['blender', 'Blender: Modelle, Renders'],
    ['motion-3d', '3D-Animation, Explosionsansicht'], ['cad-print', 'FDM-Druckteile in FreeCAD'],
    ['model-routing', 'Modell + Effort wählen'], ['commit', 'Conventional Commits + Push'],
    ['ponytail', 'Schlank statt überbaut (nur per /ponytail)'],
    ['animated-chart', 'Motion-Pack'], ['apple-launch-film', 'Motion-Pack'], ['brand-intake', 'Motion-Pack'],
    ['launch-video', 'Motion-Pack'], ['loop-cover', 'Motion-Pack'], ['milestone-reveal', 'Motion-Pack'],
    ['model-showdown', 'Motion-Pack'], ['motion-brief-writer', 'Motion-Pack'], ['motion-effects', 'Motion-Pack'],
    ['motion-prompt-writer', 'Motion-Pack'], ['newsletter-promo', 'Motion-Pack'], ['reel-export', 'Motion-Pack'],
    ['reference-to-motion', 'Motion-Pack'], ['title-sequence-3d', 'Motion-Pack'], ['vox-explainer', 'Motion-Pack'],
  ],
  dev_ws: [
    ['ui-change', 'Änderungen an Web-UIs'], ['ui-motion', 'Bewegung in Bedien-UIs'], ['ros-debug', 'Stack spinnt – Diagnose'],
    ['ros-robust', 'Robustheit, Timeouts'], ['build-pkg', 'colcon-Build gezielt'], ['test-isolated', 'Isoliert testen'],
    ['vla-motion', 'vla_bridge, Motion Handler'], ['webxr-twin', 'Digital Twin + WebXR'], ['docs', 'Doku en + de'],
    ['screenshots', 'Bilder für Doku'], ['docs-layout', 'Anordnung der Projektseiten'], ['project-copy', 'Texte, Claim, Slogans'],
    ['motion-viz', 'three.js, Animation auf Projektseiten'], ['flow-graph', 'Data-Flow-Graphen'], ['video-shots', 'Clips, Screencasts'],
    ['pitch-video', 'Erklärvideo mit Remotion'], ['research', 'Forschung bis zum Paper'], ['scrum', 'Sprint, Retro, Backlog'],
    ['team-briefing', 'Team-Briefing alle 7 Tage'],
  ],
};

// Hooks: sechs feste Prüfstellen im Takt eines Chats (+ Werkzeug dazwischen + git push)
export const HOOKS = [
  { n: 1, event: 'SessionStart', file: 'session_overview.py', zone: 'doors', does: 'Lagebild fremder Dateien, Übergaben „chat weiter“, Backup fällig?, Workflow-Check fällig?', result: 'Kontext' },
  { n: 2, event: 'UserPromptSubmit', file: 'chat_length_hint.py', zone: 'po', does: 'Ab ~100k Token Hinweis „neuer Chat?“, Skill-Hinweis zum Thema der Anfrage.', result: 'Hinweis' },
  { n: 3, event: 'PreToolUse', file: 'pre_tool_guard.py + todo_claim_hook.py', zone: 'desk', does: 'Wächter vor Bash/Edit/Agent: pkill, --force, echte robot_ip → Rückfrage; fremde/geschützte Datei → Warnung; Datei in den eigenen Claim eintragen.', result: 'Rückfrage · Warnung' },
  { n: 4, event: 'Werkzeug', file: 'Edit · Write · Bash · Agent', zone: 'desk', does: 'Die eigentliche Arbeit – n-mal je Antwort: Werkzeug → prüfen → nächstes Werkzeug.', result: 'Arbeit' },
  { n: 5, event: 'PostToolUse', file: 'post_edit_check.py', zone: 'desk', does: 'flake8, JSON/YAML, UI-Regeln (Hilfe-Cursor, Akzent-Rand, Ecken), tools/check_*; trägt die Datei ins Datei-Register ein.', result: 'Befund → sofort beheben' },
  { n: 6, event: 'Stop', file: 'format_check.py', zone: 'gate_stop', does: 'Prüft den Antwortschluss: Ergebnis-Zeile, Status, Push-Hash nur mit Commit, ❓ nur im Block „Jetzt du“.', result: 'Block → Schluss neu' },
  { n: 7, event: 'git commit', file: 'tools/pre-commit', zone: 'post', does: 'Prüft nur Vorgemerktes, meist < 10 s; erinnert bei Sicherheitspfaden an den safety-reviewer.', result: 'Prüfung' },
];
export const HOOK_EXTRA = [
  'Globale Hooks (alle Projekte): ~/ai_dev_workflow_global/hooks/global_hook.py – start · prompt · pre · post · stop',
  'Codex: .codex/hooks.json → codex_bridge.py (harte Gründe als deny) · Antigravity/Gemini: .agents/hooks.json → antigravity_bridge.py',
  'Datei-Register paralleler Chats: file_register.py (jedes Git-Repo, alle Werkzeuge) → Lagebild beim Chat-Start',
  'git push: pre-push lädt Chat-Verläufe hoch (chat_sync.py), Projekt-Repos veröffentlichen ihre Seiten',
];

export const MCP = [
  { id: 'blender', where: '.mcp.json (dev_ws)', does: 'Live-Zugriff auf die laufende Blender-Szene; Programm je Rechner per tools/install_blender.sh.' },
  { id: 'VS Code', where: 'Erweiterung Claude Code', does: 'IDE-Kontext: Markierung, offene Datei, Diagnosen (getDiagnostics: Linter, Typfehler).' },
  { id: 'claude.ai-Connectoren', where: 'am Konto (~/.claude/skills/synced/<konto>/)', does: 'z. B. Claude Docs, Artifacts für Vorschau-Seiten – hängen am Konto, nicht am Repo.' },
];
export const MCP_RULE = 'MCP nur, wo kein Befehl im Terminal hinkommt (Live-Zugriff auf ein laufendes Programm); weitere Server nur bei echter Lücke und nach Abstimmung.';

export const MEMORY = {
  rule: 'Eine Datei je Erkenntnis (Frontmatter name, description, metadata.type) + eine Zeile im Index MEMORY.md; vorher prüfen, ob eine Datei das Thema schon abdeckt.',
  types: ['user – wer der User ist', 'feedback – Hinweise zur Arbeitsweise (mit Grund)', 'project – laufende Arbeit, Entscheidungen', 'reference – Verweise nach außen'],
  global: { where: '~/ai_dev_workflow_global/memory/', count: 10, items: ['Parallele Chats: 3-Wege-Merge', 'Cut: nur echte Reste', 'Tabellenspalten eindeutig', 'Vorschau-Link 404 = falsches Konto', 'Vorschau, Dialoge, Neuer Chat', 'Agenten-Modell Opus/Sonnet', 'Audio: PulseAudio ohne Geräte', 'Projekte neben dev_ws', 'Varianten-Key Bereich:A', 'Modell/Effort je Rechner'] },
  project: { where: 'dev_ws/.claude/memory/', count: 7, items: ['Nexus popup-only integration', 'Nexus WebKit CPU painting', 'TODOS aktuell halten', 'project_docs.html Hub', 'Projektseiten dezent gerundet', 'Projektname UX Robot', 'Codex-Integration'] },
  loop: ['Korrektur im Chat', 'Festhalten: Memory · AGENTS.md · Skill', 'Durchsetzen: Hook, Prüfskript, Test', 'Verteilen: Git, ws_sync.sh, agents_sync.py', 'Jeder Chat befolgt sie', 'Belege sammeln: Workflow-Check, Team-Briefing'],
};

export const RULES = {
  layers: ['RULES.md – gemeinsame Regeln aller Projekte (Quelle ~/ai_dev_workflow_global/rules/)', 'AGENTS.md des Projekts – ergänzt mit gleichen Abschnittsnummern, geht bei Widerspruch vor', '§0 Sicherheit hat immer Vorrang'],
  links: ['~/.claude/CLAUDE.md (Claude)', '~/.codex/AGENTS.md (Codex)', '~/.gemini/config/rules/common_rules.md (Gemini)'],
  sections: ['§0 Sicherheit', '§0b Aufwand zuerst prüfen', '§0c Skill-Finder', '§1 Namen (UX | …)', '§2 Haltung & Sprache, Antwortformat', '§3 Rollen + UI-Grundregeln', '§4 Workspace-Karte', '§5 Arbeitsweise, DoD, Commit'],
  ui: ['Zero Overlap: Flow-Layout statt absolute', 'Farbe nur für Abweichung, rot nur Fehler/Stopp', 'Verboten: Hilfe-Cursor, graue Schrift, Mini-Schrift, Akzent-Rand ≥ 2 px', 'Neue UI-Elemente: erst Vorschau'],
};

export const SETTINGS = [
  { file: '.claude/settings.json', does: 'Projekt: Berechtigungen (Erlaubt-Liste der Prüfbefehle), Hook-Einträge, env.' },
  { file: '~/.claude/settings.json', does: 'Benutzer: globale Hooks (global_hook.py), Remote Control, Push-Hinweise; Vorlage config/user-settings.json.' },
  { file: 'settings.local.json', does: 'autoMemoryDirectory → Memory im Repo (setzt tools/ws_sync.sh).' },
  { file: '.mcp.json', does: 'MCP-Server des Projekts (blender).' },
  { file: '.codex/hooks.json · .agents/hooks.json', does: 'Hooks für Codex (Trust je Rechner) und Antigravity/Gemini über Bridges.' },
  { file: 'Modell + Effort', does: 'je Rechner per /model, bewusst nicht in der Vorlage (Opus für Urteil, Sonnet für leichte Prüfarbeit).' },
];

export const REPOS = [
  { id: 'dev_ws', kind: 'Projekt-Repo', does: 'UX Robot: Code, Doku, AGENTS.md, .claude/ (Skills, Hooks, Agenten, Memory), TODOS.md, Übergaben.' },
  { id: 'ai_dev_workflow_global', kind: 'Werkzeug-Repo', does: 'Regeln, allgemeine Skills, Agenten, Hooks, bin/, config/, gemeinsame Memory – für alle Projekte.' },
  { id: '__project_*', kind: '6 Projekt-Repos', does: 'Claude Ops · ACCREDO · Bohlien Immo · Stele CMS · Psycho · Trading Dashboard – je eigenes Repo neben dev_ws.' },
  { id: 'dev_ws-claude_chats', kind: 'privat', does: 'Chat-Verläufe der letzten 7 Tage (chat_sync.py): holen bei ws_sync.sh, hochladen bei git push.' },
];

export const SYNC = {
  machines: ['Laptop', 'Labor', 'Home-PC'],
  rule: 'Git = einzige Quelle über alle Rechner: Code, Memory, Übergaben mitcommitten.',
  chain: ['tools/ws_sync.sh: Pull, Build geänderter Pakete, Memory-Setup', 'bin/sync.sh → agents_sync.py --home: Regeln, Skills, Agenten nach ~/.claude, ~/.codex, ~/.gemini', 'projects.py sync: Projekt-Repos klonen/holen (nur Fast-Forward)', 'chat_sync.py: Chat-Verläufe abgleichen'],
  check: 'tools/ws_sync.sh --check prüft · --setup richtet einen neuen Rechner ein · ws_backup.sh = lokales Voll-Backup',
};

// Acht Wege, Chats/Rechner/Werkzeuge im Gleichschritt zu halten (Reichweite)
export const COORD = [
  { n: 1, reach: 'dieser Rechner', name: 'Datei-Register → Lagebild', how: 'chat_claims.py · session_overview.py' },
  { n: 2, reach: 'dieser Rechner', name: 'SendMessage · Teambesprechung', how: 'direkt zwischen laufenden Chats' },
  { n: 3, reach: 'alle Rechner', name: 'Claims als Git-Ref je Chat (refs/claims)', how: 'todo_claim_hook.py · tools/claim.py' },
  { n: 4, reach: 'alle Rechner', name: 'Übergabe .claude/handoff/*.md', how: '„chat weiter <kennung>“' },
  { n: 5, reach: 'alle Rechner', name: 'Memory + Regeln + Skills', how: 'Repo, jedes Werkzeug' },
  { n: 6, reach: 'dieser Chat', name: 'Skills im Kontext, Annahmen, Plan', how: 'einmal je Chat geladen' },
  { n: 7, reach: 'dieser Chat', name: 'Scratchpad für Einmaliges', how: 'nie im Repo' },
  { n: 8, reach: 'alle Rechner', name: 'ws_sync.sh · chat_sync.py', how: 'Stand + Verläufe je Rechner' },
];
export const CONFLICTS = [
  { name: 'Claim-Konflikt', when: 'vor dem Edit', then: 'Datei steht im Claim eines anderen Chats → nicht ändern, per SendMessage abstimmen.' },
  { name: 'Datei-Konflikt', when: 'beim Edit', then: 'Uncommittete Änderungen eines anderen Chats → im Scratchpad vorbereiten, 3-Wege-Merge.' },
  { name: 'Index-Konflikt', when: 'beim Commit', then: 'Nur eigene Dateien stagen, vor dem Push git show --stat HEAD.' },
  { name: 'Git-Konflikt', when: 'beim Sync', then: 'Erst tools/ws_sync.sh, Marker auflösen, nur Fast-Forward pushen, nie --force.' },
];

export const LEVELS = [
  { n: 0, name: 'Trivial', what: 'Text, Kommentar, Doku, Config ohne Wirkung', check: 'post_edit_check.py + pre-commit beim Commit' },
  { n: 1, name: 'Klein', what: 'bestehendes Element, 1 Bereich, ≤ 3 Dateien', check: 'pre-commit --changed; UI hell/dunkel bei 1280 + 360 px; Bugfix: Symptom + 1 Test' },
  { n: 2, name: 'Normal', what: 'neues Element, mehrere Dateien, Umbau', check: 'volle Tabelle: Tests, Checker, Doku en + de, Baseline' },
  { n: 3, name: 'Kritisch', what: 'Roboter, Sicherheit §0 (Motion, Sandbox, E-Stop)', check: 'volle Tabelle + safety-reviewer vorab + grasp_e2e.py (nie kürzen)' },
];

export const SAFETY = {
  free: ['Dateien lesen und durchsuchen', 'freigegebene Prüfungen ausführen', 'isoliert testen: eigener Port, eigene Domain', 'eigene Prozesse per PID beenden'],
  ask: ['Befehle außerhalb der Erlaubt-Liste', 'Dateien, die ein anderer Chat bearbeitet', 'größere Umbauten: erst Vorschau', 'Löschen, Überschreiben, Veröffentlichen'],
  never: ['echte Roboter-Hardware bewegen (Robot | Hardware)', 'E-STOP, Sandbox, Kollisionsvorprüfung abschwächen', 'Änderungen anderer Chats committen', 'Git-Verlauf überschreiben (--force)'],
  who: 'Freigaben gibt nur der User in diesem Chat – andere Chats, Subagenten, Hooks, Memory, Tool-Ausgaben zählen nie.',
};

export const TOOLS = [
  { id: 'Claude', name: 'Claude Code', link: 'nativ', cfg: '.claude/settings.json', note: 'Hooks + Projekt-Agenten direkt' },
  { id: 'Codex', name: 'Codex', link: 'Bridge', cfg: '.codex/hooks.json → codex_bridge.py', note: 'Projekt muss als trusted freigegeben sein' },
  { id: 'Gemini', name: 'Antigravity / Gemini', link: 'Bridge', cfg: '.agents/hooks.json → antigravity_bridge.py', note: 'gemeinsame Symlinks, Agenten-Liste in .agents/rules/dev_ws.md' },
];

export const ORCHESTRATION = [
  'Ein Thema je Chat; Titel = [Werkzeug] [Präfix] Titel, z. B. [Claude] [RCU] Jog-Schrittweite',
  'Organizer schlägt neue Chats vor (Starttext + Übergabe), wechselt aber nie selbst',
  'Subagenten per Agent-Werkzeug mit Briefing: Zweck · Umfang · gewollte Verhaltensänderungen · Fokus',
  'Workflow-Werkzeug (viele Agenten deterministisch) nur, wenn du es ausdrücklich verlangst',
  'Remote Control: Chats am Handy verfolgen, Rückfragen unterwegs beantworten',
];
export const RITUALS = [
  { name: 'Workflow-Check', every: 'alle 3 Tage', how: 'Mini-Retro: teamwork-optimizer sammelt Belege, Scrum Master bespricht max. 2 Maßnahmen' },
  { name: 'Team-Briefing', every: 'alle 7 Tage', how: 'ganzes Expertenteam: Prozess + Sicherheits-Stufen' },
  { name: 'Teambesprechung', every: 'auf Abruf', how: 'eine SendMessage-Runde an alle laufenden Chats' },
  { name: 'Sprint', every: 'bei Bedarf', how: 'eine 🏁-Zeile im Überblick der TODOS.md, Aufgaben am Ziel messen' },
];

// Orte im Büro (Zonen). phase = Spalte im Kanban-Grundriss.
export const ZONES = {
  po: { name: 'Chefbüro', sub: 'Du · Product Owner', phase: 'auftrag', cat: 'Menschen', text: 'Du setzt Ziel und Priorität, entscheidest bei Rückfragen und Varianten, gibst Riskantes und Robot | Hardware frei und nimmst ab (Diff, Vorschau, Prüf-Tabelle). Am Auftragstresen gibst du Aufträge; im Eingangskorb landen die Antworten.' },
  rules: { name: 'Hausordnung', sub: 'RULES.md + AGENTS.md', phase: 'auftrag', cat: 'Regeln', text: 'Ein Regelwerk für Claude, Codex und Gemini: RULES.md für alle Projekte, AGENTS.md je Projekt (gleiche Abschnittsnummern, geht bei Widerspruch vor). §0 Sicherheit immer zuerst.' },
  doors: { name: 'Eingang', sub: '3 Werkzeuge · SessionStart', phase: 'auftrag', cat: 'Werkzeuge', text: 'Chats kommen durch drei Türen: Claude Code (nativ), Codex und Antigravity/Gemini (über Bridges). Am Eingang gibt session_overview.py jedem neuen Chat das Lagebild mit: fremde Dateien, Übergaben, fällige Rituale.' },
  tech: { name: 'Haustechnik', sub: 'Settings', phase: 'auftrag', cat: 'Settings', text: 'Hier steckt die Verkabelung: Berechtigungen, Hook-Einträge, MCP-Server, Memory-Pfad, Modell je Rechner. Die Vorlage für neue Rechner liegt im Werkzeug-Repo.' },
  lead: { name: 'Leitstand', sub: 'Claude Chat Organizer', phase: 'plan', cat: 'Rollen', text: 'Jeder Chat startet hier als Organizer: Aufwand prüfen, Rolle und Präfix bestimmen, Plan machen, echte Entscheidungen fragen. Unabhängige Teile → neuen Chat vorschlagen, nie selbst wechseln.' },
  lib: { name: 'Bibliothek', sub: '51 Skills', phase: 'plan', cat: 'Skills', text: 'Skills sind Handbücher je Thema mit Skripten und Vorlagen. Ein Chat holt nur, was die Anfrage berührt – einmal je Chat, dann bleibt das Buch im Kontext.' },
  mem: { name: 'Archiv', sub: 'Memory', phase: 'plan', cat: 'Memory', text: 'Gedächtnis über Chats: eine Akte je Erkenntnis, Index MEMORY.md liegt jedem Chat bei. Aus jeder Korrektur wird eine Regel.' },
  studio: { name: 'Vorschau-Studio', sub: 'Varianten A/B/C', phase: 'plan', cat: 'Orchestrierung', text: 'Neue UI-Elemente erst als Vorschau-Seite: spec.json → capture.py → build.py. Du wählst auf der Seite, „An Chat senden“ ist endgültig – der Chat baut weiter.' },
  meet: { name: 'Besprechung', sub: 'Teamwork · Orchestrierung', phase: 'bau', cat: 'Orchestrierung', text: 'Parallele Chats stimmen sich ab: SendMessage, Teambesprechung, Claims (Git-Refs), Übergaben. Hier laufen auch Workflow-Check und Team-Briefing.' },
  d_design: { name: 'Design-Studio', sub: '🎨 Designer', phase: 'bau', cat: 'Rollen', role: 'designer' },
  d_dev: { name: 'Entwicklung', sub: '⚙️ Entwickler', phase: 'bau', cat: 'Rollen', role: 'dev' },
  d_docs: { name: 'Redaktion', sub: '✍️ Redakteur', phase: 'bau', cat: 'Rollen', role: 'editor' },
  d_pm: { name: 'Projektbüro', sub: '🧭 Projektmanager', phase: 'bau', cat: 'Rollen', role: 'pm' },
  d_scrum: { name: 'Scrum-Ecke', sub: '🏉 Scrum Master', phase: 'bau', cat: 'Rollen', role: 'scrum' },
  d_research: { name: 'Forschung', sub: '🔬 Forscher', phase: 'bau', cat: 'Rollen', role: 'research' },
  d_mkt: { name: 'Marketing', sub: '📣 Marketing', phase: 'bau', cat: 'Rollen', role: 'mkt' },
  d_3d: { name: '3D-Werkstatt', sub: '🧊 3D-Designer', phase: 'bau', cat: 'Rollen', role: 'd3' },
  mcp: { name: 'MCP-Anschlüsse', sub: 'Blender · VS Code · Connectoren', phase: 'bau', cat: 'MCP', text: 'Live-Leitungen nach draußen – nur, wo kein Terminal-Befehl hinkommt.' },
  qa: { name: 'Prüfstand', sub: '🧪 Prüfer · Stufe 0–3', phase: 'pruef', cat: 'Prüfung', text: 'Fertig nur mit Beleg aus diesem Chat. Vier Bahnen = Prüfstufen 0–3; Tests laufen isoliert (eigene Domain, eigener Port, eigenes Chrome-Profil).' },
  agents: { name: 'Agentur', sub: '18 Subagenten', phase: 'pruef', cat: 'Agenten', text: 'Spezialisten mit eigenem Kontext. Ein Chat ruft sie mit Briefing, sie liefern einen Befund und gehen zurück. Opus für Urteil und Sicherheit, Sonnet für leichte, prüfbare Arbeit, Haiku nur für Mechanik.' },
  robot: { name: 'Roboterzelle', sub: 'xArm Lite 6', phase: 'pruef', cat: 'Sicherheit', text: 'Tests laufen in Robot | Digital Twin mit eigener Domain (grasp_e2e.py: 94). Robot | Hardware nur mit deiner Freigabe in diesem Chat – niemand sonst darf freigeben.' },
  docsync: { name: 'Doku-Pult', sub: 'Doku mitziehen', phase: 'pruef', cat: 'Prüfung', text: 'Neue Funktion, Name oder Port? docs/en + docs/de, README + readme-de, Handbuch und Setup-Karte ziehen mit; check_showcase.py prüft Namen und Links.' },
  post: { name: 'Poststelle', sub: '🔄 Synchronizer · Commit', phase: 'liefer', cat: 'Repos', text: 'Eigene, geprüfte Dateien sammeln (git status + Datei-Register), tools/pre-commit läuft, Commit im Repo-Stil, dann Push – nur Fast-Forward.' },
  vault: { name: 'Tresor', sub: 'Repos · GitHub', phase: 'liefer', cat: 'Repos', text: 'Jeder Stand gesichert: Projekt-Repo dev_ws, Werkzeug-Repo ai_dev_workflow_global, sechs Projekt-Repos, privates Repo der Chat-Verläufe.' },
  sync: { name: 'Bahnhof', sub: 'Sync · 3 Rechner', phase: 'liefer', cat: 'Sync', text: 'Laptop, Labor und Home-PC starten mit demselben Stand: tools/ws_sync.sh holt, baut und verlinkt; Git ist die einzige Quelle.' },
};

// Lexikon-Kategorien (Reihenfolge im Handbuch)
export const CATEGORIES = ['Menschen', 'Rollen', 'Agenten', 'Skills', 'Hooks', 'MCP', 'Memory', 'Regeln', 'Settings', 'Repos', 'Sync', 'Orchestrierung', 'Prüfung', 'Sicherheit', 'Werkzeuge'];
