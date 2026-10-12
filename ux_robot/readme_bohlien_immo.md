# Bohlien Immo – Landingpage

Eigenes Projekt im dev_ws, kein Teil des Roboters: Neugestaltung von [bohlien-immo.de](https://www.bohlien-immo.de/) (Immobilien Gisela Bohlien, Kamp-Lintfort) als moderne One-Page-Landingpage.

- **Hauptseite (seit 2026-10-12):** `index.html` = ehemals Version 4 „Modell“ (three.js-Architekturmodell, Scrollposition = Uhr); im Footer „Weitere Entwürfe“ → `versionen/`. Die frühere 3-Looks-Seite liegt als `versionen/0-drei-looks.html`.
- **Öffnen:** `index.html` direkt im Browser (kein Server, kein Build); Vorschau: `http://localhost:8085/_studio/vorschauen/bohlien-immo/2026-10-11-landingpage/index.html`.
- **Inhalte:** Texte, Leistungen, Referenzen, Kontakt und Impressum von der bestehenden Seite übernommen (Stand 2026-10-11); Preise der Referenzen bewusst weggelassen (veraltet).
- **Bilder:** `img/` = Originalbilder der alten Seite (Referenzen 349 × 244 px, Logo freigestellt, `logo-hell.png` für dunkel); für den Livebetrieb größere Fotos (≥ 1200 px) und ein Porträt einsetzen.
- **Titelbild Variante foto:** `img/hero-kloster-kamp.jpg` = „Kamp-Lintfort-Kloster Kamp Terrassengarten 01“ von Dat doris, Wikimedia Commons, CC BY-SA 4.0 (Nachweis steht im Hero).
- **Stockfotos** (`img/stock-*.jpg`, [Unsplash-Lizenz](https://unsplash.com/license), frei, kein Nachweis nötig; Quelle je Datei: Fotograf): beratung Vitaly Gariev · konzept K O · tuer Donald Merrill · schluessel Jakub Żerdzicki · wohnen-hell Clay Banks · wohnen-dunkel Christian Lambert · haus-hecke Chris Weiher · haus-nacht si nguyen · salon Roberto Nickson · leuchte Rob Csaszar.
- **Regionalfotos** (`img/regio-*.jpg`, Wikimedia Commons, CC BY-SA 4.0, Nachweis steht am Bild): Schloss Moers (Steffen Schmitz), Kopfweiden am Hoerstgener Kendel, Kamp-Lintfort (Hans-Theo Smitmans).
- **Bilder je Ansicht:** Ablauf-Schritte (Beratung, Konzept, Tür, Schlüssel) überall · Willkommen + Bewertungs-Band: `hell` helles Wohnen + Klinkerhaus · `dunkel` Wohnen im Abendlicht + Haus bei Nacht (+ Innenaufnahmen in den äußeren Bögen) · `foto` Regionalfotos Kamp-Lintfort + Moers.
- **Logo im Seitenbild:** Kopf-Logo 80 px, beim Scrollen 62 px (Kopf fest oben, mobil 56 px), Logo-Dächer als Strich-Zeichen vor jedem Abschnitts-Label und als Favicon, Logo-Schwung als Boden unter der Häuserzeile (`hell`, `dunkel`), Logo statt Monogramm und Name auf der Profilkarte; Pfade aus `img/logo.png` nachgezeichnet.
- **Varianten** (Umschalter im Footer, `?look=`): `hell` = Papier + Waldgrün mit Bild-Collage (Standard) · `dunkel` = Premium mit Messing-Akzent und Bogenfenster-Fotos · `foto` = Vollbild-Foto Kloster Kamp + Schnellanfrage.
- **Fünf Versionen** (2026-10-12, Ordner `versionen/`, Übersicht `versionen/index.html`; Vorschau: `http://localhost:8085/_studio/vorschauen/bohlien-immo/2026-10-12-fuenf-versionen/versionen/index.html`) – je eigener Aufbau, Schrift, Haupteffekt; Strukturen gewürfelt (Skill `variation`), Inhalte wie oben:
  - `1-atelier.html` Split-Screen: links Bildbühne mit three.js-Shader-Übergang (nur über http, `file://` → einfache Überblendung), rechts Kapitel; Waldgrün/Altrosa, Source Serif 4 + Jost.
  - `2-uebersicht.html` Bento: erste Ansicht beantwortet alle Fragen in Kacheln; leise Bewegung; Albert Sans, Logo-Grün.
  - `3-kartografie.html` eine Tafel mit Reitern: Kompass-Ringe (SVG), Foto-Linse, Nadel; Steintöne/Bordeaux, Bodoni Moda + Instrument Sans.
  - `index.html` (früher `4-modell.html`, jetzt Hauptseite) three.js-Architekturmodell als Bühne: Scrollposition = Uhr (Kamera, Tag → Nacht, Dach/Etagen, Markierung), Text als Leiste; Schibsted Grotesk. Stand 2026-10-12: Hero-Karte auch am Desktop, Referenzbilder größer, Regionalfoto (Schloss Moers) im Profil, Ladehinweis + Fallback-Foto (kein WebGL/Netz), mobil 1024er Schatten + Pixeldichte ≤ 1,25 (sinkt bei < 30 fps), reduzierte Bewegung folgt dem Scrollen ohne Dämpfung.
  - `5-expose.html` horizontale Bahn (Scrollen 1:1 seitwärts, mobil/reduzierte Bewegung senkrecht), Lamellen „Ihr Ziel → unser Weg“, Maßband; Gloock + Hanken Grotesk.
  - three.js 0.170.0 per jsDelivr; ohne Netz/WebGL bleibt ein Foto. `vorschau/*.jpg` = Bilder der Übersicht.
- **Schrift:** Cormorant Garamond (Überschriften, klassisch-elegant) + Jost (Text, geometrisch wie das Logo) von Google Fonts; Logo-Grün `#59B130`.
- **Aufbau:** Hero (Collage, Häuserzeile) → Städte-Band → Willkommen → Leistungen → Ablauf → Referenzen (Filter, Karussell) → Einsatzgebiet (Karte) → Profil → Bewertung → Kontakt → Footer mit Impressum.
- **Formular:** öffnet eine vorausgefüllte E-Mail an info@bohlien-immo.de (kein Backend).
- **Offen vor Veröffentlichung:** Datenschutzerklärung (DSGVO), Google Fonts lokal einbinden, Freigabe der Inhaberin.
- **Bewegung** (Prinzip HyperFrames: Scrollposition = Uhr, nur `opacity`/`transform`/`clip-path`; Stärken nach Skill `soft-motion`):
  - Hero-Intro einmal beim Laden (Bilder öffnen sich, Linie zeichnet), danach Parallaxe der Ebenen + Text tritt zurück; Bild-Slides im Hero (Überblenden alle 6 s).
  - Scroll-gebunden per CSS `animation-timeline` (Chrome, Edge, Safari 26): Lesefortschritt unter dem Kopf, Bilder öffnen sich beim Hereinscrollen, dunkle Abschnitte wachsen auf volle Breite, Städte-Band läuft mit; ohne Unterstützung bleibt das normale Einblenden.
  - „Ablauf“ als angepinnte Slides ab 881 × 640 px (Scrollen blättert die vier Schritte, Leiste links springt per Klick); schmaler: normale Liste.
  - Karte baut sich auf (Flüsse, Gebiet, Orte, Städte), Referenzen gleiten gestaffelt herein.
  - alles aus bei `prefers-reduced-motion`.
