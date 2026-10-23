# Fremdcode lokal (kein CDN zur Laufzeit)

`three/` = three.js 0.186.0 (MIT, Lizenz `three/LICENSE`), unverändert von `cdn.jsdelivr.net/npm/three@0.186.0/` geholt:
`build/three.module.js`, `build/three.core.js` und die genutzten `examples/jsm/`-Dateien samt Abhängigkeiten.
Grund (Security-Review dev-ws-ac, 2026-10-13): das Büro darf Transkripte aus Claude Ops lesen, Skripte vom CDN ohne Integritätsprüfung wären ein Risiko.
Update: Version in `index.html` (Importmap) und dieser Datei ändern, Dateien neu holen, `vorschau/verify.py` laufen lassen.

`fonts/` = die 13 Schriften der Looks A–G (SIL Open Font License, Google Fonts), nur Teilmenge latin als woff2 + `fonts.css`.
Grund wie oben (Security-Review dev-ws-ac): keine Anfrage an Google beim Öffnen des Büros.
Update: Familien-Liste als Google-Fonts-Link nehmen, CSS mit Chrome-User-Agent holen, je `/* latin */`-Block die woff2 laden (variable Schriften = eine Datei für alle Gewichte) und `fonts.css` mit relativen `url(...)` schreiben.
