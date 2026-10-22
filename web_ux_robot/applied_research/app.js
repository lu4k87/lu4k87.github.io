/* KreiswertS · Logik: Matching, Karte, Plattform, Szenarien, Projekt, Selbsttest, Sprache + Theme.
   Direktlinks: ?lang=de|en · ?theme=light|dark · ?firm=<id> · ?scn=s1|s2|s3 */
(() => {
  'use strict';
  const D = window.KW_DATA;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const Q = new URLSearchParams(location.search);
  const root = document.documentElement;

  /* ---------- Texte ---------- */
  const I18N = {
    de: {
      demo: 'Demo-Daten · fiktiv', railAria: 'Schritte der Seite', langAria: 'Sprache', themeDark: 'Dunkles Design', themeLight: 'Helles Design',
      steps: ['Überblick', 'Prinzip', 'Plattform', 'Szenarien', 'Projekt', 'Einordnung'], stepOf: 'Schritt {i} von {n}',
      eyebrow: 'Applied Research · Proof of Concept',
      lead: 'Was ein Betrieb übrig hat, braucht ein anderer als Rohstoff. KreiswertS vernetzt kunststoffproduzierende, verarbeitende und recycelnde Unternehmen in Kamp-Lintfort und Umgebung – mit Profilen, Sekundärmaterialien, Bedarfen und möglichen Austauschwegen auf einer Karte.',
      canTitle: 'Was kann ich hier tun?', can1: 'Den Kreislauf aus Produzieren, Verarbeiten und Recyceln verstehen',
      can2: 'Auf der Karte passende Partner für ein Material finden', can3: 'Drei Beispiele für plausiblen Austausch durchspielen',
      ctaNext: 'Weiter: Das Prinzip', ctaPlat: 'Direkt zur Plattform',
      mapTitle: 'Lagebild · Kamp-Lintfort und Umgebung', schematic: 'schematisch',
      mapStartAria: 'Schematische Karte: {n} fiktive Unternehmen und die rechnerisch besten Austauschwege je Kunststoff',
      potLabel: 'Austauschpotenzial, rechnerisch', perMonth: 't/Monat', potNote: 'jede Tonne Angebot und Bedarf nur einmal vergeben',
      kFirms: 'Unternehmen · {n} Rollen', kOffers: 'Angebote · {t} t/Monat', kNeeds: 'Bedarfe · {t} t/Monat', kPairs: 'passende Paare',
      prTitle: 'Was ein Betrieb übrig hat, braucht ein anderer',
      prLead: 'Kunststoff läuft in der Region durch drei Rollen. Heute endet der Weg oft im Container – KreiswertS macht die Rückwege sichtbar.',
      problem: 'Das Problem', pb1: 'Betriebe <b>entsorgen</b> wiederverwendbare Kunststoff-Nebenprodukte.',
      pb2: 'Nebenan wird <b>teure Neuware</b> eingekauft.', pb3: 'Wissen über Material, Partner und Wege ist <b>verstreut</b>.',
      fix: 'KreiswertS macht Angebote, Bedarfe und Wege in der Region sichtbar.',
      cyAria: 'Kreislauf: Produzieren liefert Granulat an Verarbeiten, Produktionsreste gehen ans Recyceln, Regranulat und Rezyklat kehren zurück.',
      cyCells: [['Produzieren', 'Granulat, Halbzeug'], ['Verarbeiten', 'Bauteile, Folien'], ['Recyceln', 'Mahlgut, Regranulat']],
      cyFlows: ['Granulat', 'Produktionsreste', 'Regranulat', 'Rezyklat'], cyLoop: 'Rückweg im Kreislauf', cyFwd: 'Neuware',
      vsToday: 'Heute: getrennte Inseln', vsNet: 'Mit KreiswertS: ein Netz',
      vsT: ['Reste gehen in die Entsorgung', 'Nebenan wird Neuware gekauft', 'Niemand sieht den anderen'],
      vsN: ['Angebote und Bedarfe auf einer Karte', 'Passende Partner in der Nähe', 'Wege werden sichtbar'],
      plTitle: 'Plattform-Prototyp',
      plLead: 'Profile, Materialbörse und Matching auf einer Karte. Unternehmen oder Material wählen – passende Partner erscheinen als Weg.',
      searchLabel: 'Suche', searchPh: 'Material, Polymer oder Unternehmen', role: 'Rolle', type: 'Typ',
      offers: 'Angebote', needs: 'Bedarfe', gapsOnly: 'nur Lücken', hits: '{f} Unternehmen · {e} Einträge',
      tabFirms: 'Firmen · {n}', tabBoard: 'Börse · {n}', tabMatch: 'Matching · {n}',
      mapHint: 'Symbol anklicken oder per Tab-Taste wählen', mapPlatAria: 'Karte der Unternehmen, Symbole sind wählbar',
      fict: 'fiktiv', offersH: 'Bietet an', needsH: 'Sucht',
      takers: '{n} Abnehmer', noTaker: 'kein Abnehmer in der Region', suppliers: '{n} Anbieter', noSupplier: 'kein Anbieter in der Region',
      bestFor: 'Beste Treffer für {x}', noMatch: 'Kein passender Partner in der Region – eine Lücke, die neue Partner schließen könnten.',
      pickFirm: 'Unternehmen auf der Karte oder in der Liste wählen.', pickItem: 'Angebot oder Bedarf wählen, um passende Partner zu sehen.',
      chkPoly: 'Polymer', chkForm: 'Form', chkQual: 'Qualität bevorzugt', chkQual2: 'Qualität akzeptiert', chkQty: 'Menge', chkQtyPart: 'Menge: {p} %',
      how: 'Wie wird gerechnet?',
      howText: 'Pflicht: gleiches Polymer, passende Form und Qualität. Wert = Qualität {wq} % + Menge {wm} % + Nähe {wd} % (Luftlinie, ab {dmax} km null). Preis, Termine und Prüfprotokoll klären die Partner selbst.',
      noHits: 'Keine Treffer – Suchbegriff oder Filter ändern.', sumLine: '{n} · {t} t/Monat',
      scTitle: 'Drei Beispielszenarien',
      scLead: 'Jedes Szenario zeigt einen plausiblen Austausch – mit Prüfpunkten statt Versprechen. Beim Scrollen folgt die Karte dem Schritt.',
      plausT: 'Plausibilitäts-Check', pMat: 'Material {p}, sortenrein', pQual: 'Qualität: {q} passt', pQty: 'Menge: ≈ {p} % des Bedarfs',
      pDist: 'Entfernung {d} km', pDist2: 'Wege {d1} + {d2} km', capStep: 'Schritt {i} von {n}', scnAria: 'Karte zum Szenario {s}',
      pjTitle: 'Projekt: Soll und Ist',
      pjLead: 'Messbare Ziele aus dem Auftrag neben dem Stand des Prototyps. ✓ = im Prototyp sichtbar, ◐ = braucht Arbeit außerhalb des Prototyps.',
      goalsTitle: 'Messbare Ziele', thGoal: 'Ziel', thSoll: 'Soll', thIst: 'Prototyp', thSt: 'Stand',
      istFirms: '{n} Profile (Demo)', istProto: 'Profile, Börse, Suche und Filter klickbar', istScn: '{n} Szenarien auf der Karte',
      istTests: '{p} von {n} Selbsttests bestanden', istGuide: 'Entwurf, {n} Schritte',
      st: { ok: '✓ sichtbar', teil: '◐ teilweise', offen: 'offen' }, stOut: { ok: '✓ da', teil: '◐ Entwurf', offen: 'offen' },
      succTitle: 'Erfolgskriterium', succCrit: 'Nachweis plausibler Austauschpotenziale', succShows: 'Zeigt der Prototyp', succNeeds: 'Braucht Validierung',
      phTitle: 'Vorgehen in sechs Phasen', outTitle: 'Ergebnisse',
      testTitle: 'Selbsttest · {n} Kernfunktionen',
      testLead: 'Prüft die Kernfunktionen direkt im Browser mit den Demo-Daten. Ersetzt keine Tests mit Nutzern.',
      testRun: 'Test erneut starten', testSave: 'Ergebnis sichern (JSON)', pass: 'bestanden', fail: 'nicht bestanden', testStamp: 'Letzter Lauf: {d}',
      tests: ['Unternehmensprofile', 'Materialübersicht', 'Suche', 'Filter', 'Matching', 'Karte & Szenarien'],
      tDetail: ['{n} Profile vollständig', '{o} Angebote + {n} Bedarfe gelistet', 'Polymer, Firmenname und Leersuche', 'Rolle, Typ und Lücken', '{n} Paare regelkonform, Vergabe ohne Überbuchung', '{f} Symbole, {s} Szenarien mit gültigen Wegen'],
      perTitle: 'Zielgruppen', perLead: 'Je Zielgruppe eine Beispiel-Persona – erfunden, damit Bedürfnisse greifbar werden.', persona: 'Beispiel-Persona · fiktiv',
      pGoal: 'Ziel', pHurdle: 'Hürde', pGain: 'Nutzen von KreiswertS',
      go: { offers: 'Angebote in der Plattform', needs: 'Bedarfe in der Plattform', scenarios: 'Zu den Szenarien', gaps: 'Lücken in der Plattform' },
      ctxTitle: 'Einordnung und Übertragung',
      ctxLead: 'Was es schon gibt, welche Lücke der Prototyp schließt, wo seine Grenzen liegen – und wie eine andere Region ihn übernimmt.',
      sotaTitle: 'State of the Art: Austausch-Plattformen',
      sotaLead: 'Recherche vom 22.10.2026 aus Anbieter- und Fachseiten – Angaben vor der Abgabe beim Anbieter prüfen.',
      thPlat: 'Plattform', thBy: 'Betreiber', thAccess: 'Zugang', thPlus: 'Stärke', thGap: 'Grenze für die KreiswertS-Frage',
      acc: { free: 'kostenlos', board: 'Online-Börse', closed: 'in Liquidation', licence: 'Lizenz', commercial: 'kommerziell', self: 'frei (HTML)' },
      selfBy: 'Applied Research', selfPlus: 'Region, Karte, begründetes Matching und Szenarien in einer Ansicht', selfGap: 'Demo-Daten, keine Transaktionen, Luftlinie',
      source: 'Quelle', sourceOf: 'Quelle zu {x}',
      gapTitle: 'Lücke, die KreiswertS schließt',
      gaps: ['<b>Regional:</b> Angebote, Bedarfe und Wege einer Region auf einer Karte – Nähe zählt mit.',
        '<b>Begründet:</b> Polymer, Form, Qualität, Menge und Entfernung als sichtbare Prüfpunkte statt reiner Inserate.',
        '<b>Ehrlich:</b> Plausibilität statt Versprechen – Preise, Prüfprotokolle und Umwelteffekte bleiben offen.'],
      limTitle: 'Grenzen des Prototyps', guideTitle: 'Replikation · Leitfaden in {n} Schritten',
      guideLead: 'Alle Daten einer Region stehen in einer Datei (daten.js) – Karte, Matching, Szenarien und Selbsttest passen sich an.',
      foot: 'Alle Unternehmen, Mengen und Wege sind fiktive Demo-Daten · Karte schematisch, Entfernungen als Luftlinie · Applied Research, Prototyp 2026',
    },
    en: {
      demo: 'Demo data · fictional', railAria: 'Steps of the page', langAria: 'Language', themeDark: 'Dark theme', themeLight: 'Light theme',
      steps: ['Overview', 'Principle', 'Platform', 'Scenarios', 'Project', 'Context'], stepOf: 'Step {i} of {n}',
      eyebrow: 'Applied Research · Proof of Concept',
      lead: 'What one company has left over, another needs as raw material. KreiswertS connects plastics producers, processors and recyclers in and around Kamp-Lintfort – with profiles, secondary materials, needs and possible exchange routes on one map.',
      canTitle: 'What can I do here?', can1: 'Understand the loop of producing, processing and recycling',
      can2: 'Find suitable partners for a material on the map', can3: 'Play through three examples of plausible exchange',
      ctaNext: 'Next: the principle', ctaPlat: 'Straight to the platform',
      mapTitle: 'Overview · Kamp-Lintfort and surroundings', schematic: 'schematic',
      mapStartAria: 'Schematic map: {n} fictional companies and the best exchange routes per plastic by calculation',
      potLabel: 'Exchange potential, calculated', perMonth: 't/month', potNote: 'each tonne of offer and need allocated only once',
      kFirms: 'companies · {n} roles', kOffers: 'offers · {t} t/month', kNeeds: 'needs · {t} t/month', kPairs: 'matching pairs',
      prTitle: 'What one company has left over, another needs',
      prLead: 'Plastics pass through three roles in the region. Today the route often ends in a skip – KreiswertS makes the way back visible.',
      problem: 'The problem', pb1: 'Companies <b>dispose of</b> reusable plastic by-products.',
      pb2: 'Next door, <b>expensive virgin material</b> is bought.', pb3: 'Knowledge of materials, partners and routes is <b>scattered</b>.',
      fix: 'KreiswertS makes offers, needs and routes in the region visible.',
      cyAria: 'Loop: producing supplies granulate to processing, production scrap goes to recycling, regranulate and recyclate return.',
      cyCells: [['Producing', 'Granulate, semi-finished'], ['Processing', 'Parts, films'], ['Recycling', 'Regrind, regranulate']],
      cyFlows: ['Granulate', 'Production scrap', 'Regranulate', 'Recyclate'], cyLoop: 'Way back in the loop', cyFwd: 'Virgin material',
      vsToday: 'Today: separate islands', vsNet: 'With KreiswertS: one network',
      vsT: ['Scrap goes to disposal', 'Virgin material is bought next door', 'Nobody sees the others'],
      vsN: ['Offers and needs on one map', 'Suitable partners nearby', 'Routes become visible'],
      plTitle: 'Platform prototype',
      plLead: 'Profiles, material exchange and matching on one map. Choose a company or material – suitable partners appear as a route.',
      searchLabel: 'Search', searchPh: 'Material, polymer or company', role: 'Role', type: 'Type',
      offers: 'Offers', needs: 'Needs', gapsOnly: 'gaps only', hits: '{f} companies · {e} entries',
      tabFirms: 'Companies · {n}', tabBoard: 'Exchange · {n}', tabMatch: 'Matching · {n}',
      mapHint: 'Click a symbol or select it with the Tab key', mapPlatAria: 'Map of companies, symbols are selectable',
      fict: 'fictional', offersH: 'Offers', needsH: 'Looking for',
      takers: '{n} takers', noTaker: 'no taker in the region', suppliers: '{n} suppliers', noSupplier: 'no supplier in the region',
      bestFor: 'Best matches for {x}', noMatch: 'No suitable partner in the region – a gap that new partners could close.',
      pickFirm: 'Choose a company on the map or in the list.', pickItem: 'Choose an offer or need to see suitable partners.',
      chkPoly: 'Polymer', chkForm: 'Form', chkQual: 'Quality preferred', chkQual2: 'Quality accepted', chkQty: 'Quantity', chkQtyPart: 'Quantity: {p} %',
      how: 'How is it calculated?',
      howText: 'Mandatory: same polymer, suitable form and quality. Score = quality {wq} % + quantity {wm} % + proximity {wd} % (as the crow flies, zero from {dmax} km). Price, dates and test reports are settled by the partners.',
      noHits: 'No results – change the search term or filters.', sumLine: '{n} · {t} t/month',
      scTitle: 'Three example scenarios',
      scLead: 'Each scenario shows a plausible exchange – with checkpoints instead of promises. While you scroll, the map follows the step.',
      plausT: 'Plausibility check', pMat: 'Material {p}, single-polymer', pQual: 'Quality: {q} fits', pQty: 'Quantity: ≈ {p} % of the need',
      pDist: 'Distance {d} km', pDist2: 'Routes {d1} + {d2} km', capStep: 'Step {i} of {n}', scnAria: 'Map of scenario {s}',
      pjTitle: 'Project: target and status',
      pjLead: 'Measurable goals from the brief next to the status of the prototype. ✓ = visible in the prototype, ◐ = needs work outside the prototype.',
      goalsTitle: 'Measurable goals', thGoal: 'Goal', thSoll: 'Target', thIst: 'Prototype', thSt: 'Status',
      istFirms: '{n} profiles (demo)', istProto: 'Profiles, exchange, search and filter clickable', istScn: '{n} scenarios on the map',
      istTests: '{p} of {n} self-tests passed', istGuide: 'Draft, {n} steps',
      st: { ok: '✓ visible', teil: '◐ partly', offen: 'open' }, stOut: { ok: '✓ done', teil: '◐ draft', offen: 'open' },
      succTitle: 'Success criterion', succCrit: 'Evidence of plausible exchange potential', succShows: 'Shown by the prototype', succNeeds: 'Needs validation',
      phTitle: 'Approach in six phases', outTitle: 'Deliverables',
      testTitle: 'Self-test · {n} core functions',
      testLead: 'Checks the core functions directly in the browser with the demo data. Does not replace tests with users.',
      testRun: 'Run test again', testSave: 'Save result (JSON)', pass: 'passed', fail: 'failed', testStamp: 'Last run: {d}',
      tests: ['Company profiles', 'Material overview', 'Search', 'Filter', 'Matching', 'Map & scenarios'],
      tDetail: ['{n} profiles complete', '{o} offers + {n} needs listed', 'Polymer, company name and empty search', 'Role, type and gaps', '{n} pairs follow the rules, allocation without overbooking', '{f} symbols, {s} scenarios with valid routes'],
      perTitle: 'Target groups', perLead: 'One example persona per target group – invented to make needs tangible.', persona: 'Example persona · fictional',
      pGoal: 'Goal', pHurdle: 'Hurdle', pGain: 'Benefit of KreiswertS',
      go: { offers: 'Offers in the platform', needs: 'Needs in the platform', scenarios: 'To the scenarios', gaps: 'Gaps in the platform' },
      ctxTitle: 'Context and transfer',
      ctxLead: 'What already exists, which gap the prototype closes, where its limits are – and how another region can adopt it.',
      sotaTitle: 'State of the art: exchange platforms',
      sotaLead: 'Research of 22 Oct 2026 from provider and trade sources – check details with the provider before submission.',
      thPlat: 'Platform', thBy: 'Operator', thAccess: 'Access', thPlus: 'Strength', thGap: 'Limit for the KreiswertS question',
      acc: { free: 'free', board: 'online exchange', closed: 'in liquidation', licence: 'licence', commercial: 'commercial', self: 'free (HTML)' },
      selfBy: 'Applied Research', selfPlus: 'Region, map, justified matching and scenarios in one view', selfGap: 'Demo data, no transactions, straight-line distance',
      source: 'Source', sourceOf: 'Source for {x}',
      gapTitle: 'Gap that KreiswertS closes',
      gaps: ['<b>Regional:</b> offers, needs and routes of one region on one map – proximity counts.',
        '<b>Justified:</b> polymer, form, quality, quantity and distance as visible checkpoints instead of plain listings.',
        '<b>Honest:</b> plausibility instead of promises – prices, test reports and environmental effects remain open.'],
      limTitle: 'Limits of the prototype', guideTitle: 'Replication · guide in {n} steps',
      guideLead: 'All data of a region sits in one file (daten.js) – map, matching, scenarios and self-test adapt.',
      foot: 'All companies, quantities and routes are fictional demo data · schematic map, straight-line distances · Applied Research, prototype 2026',
    },
  };
  let LANG = 'de';
  try { LANG = Q.get('lang') || localStorage.getItem('kw-lang') || ((navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en'); } catch (e) {}
  if (!I18N[LANG]) LANG = 'de';
  const T = (k, v = {}) => {
    let s = I18N[LANG][k] ?? I18N.de[k] ?? k;
    if (typeof s === 'string') for (const x in v) s = s.split('{' + x + '}').join(v[x]);
    return s;
  };
  const L = x => x == null ? '' : typeof x === 'string' ? x : (x[LANG] ?? x.de);
  const fmt = (n, d = 1) => n.toLocaleString(LANG === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: d });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Daten + Matching ---------- */
  const F = Object.fromEntries(D.firms.map(f => [f.id, f]));
  const OFFERS = D.firms.flatMap(f => f.o.map(o => ({ ...o, firm: f.id, kind: 'o' })));
  const NEEDS = D.firms.flatMap(f => f.n.map(n => ({ ...n, firm: f.id, kind: 'n' })));
  const ITEM = Object.fromEntries([...OFFERS, ...NEEDS].map(x => [x.id, x]));
  const B = D.region.box, R = D.rules;
  const KX = 111.32 * Math.cos((B.lat0 + B.lat1) / 2 * Math.PI / 180), KY = 111.2, U = 40;   // km je Grad · SVG-Einheiten je km
  const W = (B.lon1 - B.lon0) * KX * U, H = (B.lat1 - B.lat0) * KY * U;
  const proj = (lat, lon) => [(lon - B.lon0) * KX * U, (B.lat1 - lat) * KY * U];
  const km = (a, b) => Math.hypot((a.lon - b.lon) * KX, (a.lat - b.lat) * KY);

  // Pflicht = Polymer, Form, Qualität · Wert = Qualität + Menge (Anteil, der beim Gegenüber Platz findet) + Nähe
  function match(o, n, view = 'offer') {
    if (o.firm === n.firm || !n.poly.includes(o.poly) || !n.forms.includes(o.form) || !n.q.includes(o.q)) return null;
    const d = km(F[o.firm], F[n.firm]);
    const qfit = n.q[0] === o.q ? 1 : R.q2;
    const cover = view === 'offer' ? Math.min(1, n.t / o.t) : Math.min(1, o.t / n.t);
    const near = Math.max(0, 1 - d / R.dmax);
    return { o, n, d, qfit, cover, near, score: Math.round(100 * (R.wq * qfit + R.wm * cover + R.wd * near)) };
  }
  const byScore = (a, b) => b.score - a.score;
  const matchesFor = x => (x.kind === 'o' ? NEEDS.map(n => match(x, n, 'offer')) : OFFERS.map(o => match(o, x, 'need'))).filter(Boolean).sort(byScore);
  const MX = Object.fromEntries(Object.values(ITEM).map(x => [x.id, matchesFor(x)]));
  const ALL = OFFERS.flatMap(o => NEEDS.map(n => match(o, n)).filter(Boolean));
  // Rechnerisches Austauschpotenzial: Paare nach Wert, jede Tonne Angebot und Bedarf nur einmal vergeben
  function allocate(pairs = ALL) {
    const lo = Object.fromEntries(OFFERS.map(o => [o.id, o.t])), ln = Object.fromEntries(NEEDS.map(n => [n.id, n.t]));
    let sum = 0; const used = [];
    [...pairs].sort(byScore).forEach(m => {
      const q = Math.min(lo[m.o.id], ln[m.n.id]);
      if (q <= 0) return;
      lo[m.o.id] -= q; ln[m.n.id] -= q; sum += q; used.push({ ...m, q });
    });
    return { sum, used, lo, ln };
  }
  const ALLOC = allocate();
  const polys = x => x.kind === 'o' ? [x.poly] : x.poly;
  const forms = x => x.kind === 'o' ? [x.form] : x.forms;
  const quals = x => x.kind === 'o' ? [x.q] : x.q;

  /* ---------- Karten-Baukasten (SVG) ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const S = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const pt = ([lat, lon]) => proj(lat, lon);
  function smooth(points) {   // Catmull-Rom → kubische Bézier
    const p = points.map(pt); let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      d += `C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)},${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)},${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}`;
    }
    return d;
  }
  function shape(role, r) {
    if (role === 'P') return `M0,${-r * 1.25}L${r * 1.25},0L0,${r * 1.25}L${-r * 1.25},0Z`;
    if (role === 'R') return `M0,${-r * 1.25}L${r * 1.15},${r * .8}L${-r * 1.15},${r * .8}Z`;
    return `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
  }
  function arc(a, b, bend = .18) {
    const [x1, y1] = proj(a.lat, a.lon), [x2, y2] = proj(b.lat, b.lon);
    const cx = (x1 + x2) / 2 - (y2 - y1) * bend, cy = (y1 + y2) / 2 + (x2 - x1) * bend;
    return { d: `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`, x1, y1, x2, y2, cx, cy, len: Math.hypot(x2 - x1, y2 - y1) };
  }
  const qpt = (r, t) => [(1 - t) ** 2 * r.x1 + 2 * (1 - t) * t * r.cx + t * t * r.x2, (1 - t) ** 2 * r.y1 + 2 * (1 - t) * t * r.cy + t * t * r.y2];
  const pvar = p => `--pc:var(--p-${D.poly[p].key})`;

  // o: { view:[x,y,w,h], par, routes:[{from,to,poly,cls,bend,dots,dr,label,glow,anim}], sel, hl, dim, halo, r, short, interactive }
  // k = SVG-Einheiten je Bildschirm-Pixel: Schrift, Symbole, Striche bleiben bei jedem Zoom und jeder Fensterbreite gleich groß
  function drawMap(svg, o = {}) {
    svg.innerHTML = '';
    const view = o.view || [0, 0, W, H], sw = svg.clientWidth || 800, sh = svg.clientHeight || 600;
    const k = 1 / (o.par === 'xMidYMid slice' ? Math.max : Math.min)(sw / view[2], sh / view[3]), small = sw < 520;
    svg.setAttribute('viewBox', view.map(v => v.toFixed(1)).join(' '));
    svg.setAttribute('preserveAspectRatio', o.par || 'xMidYMid meet');
    svg.style.setProperty('--k', k.toFixed(3));
    const base = S('g', { class: 'm-base', 'aria-hidden': 'true' }, svg);
    S('rect', { class: 'm-land', x: -900, y: -900, width: W + 1800, height: H + 1800 }, base);
    D.region.towns.forEach(t => { const [x, y] = proj(t.lat, t.lon); S('circle', { class: 'm-town' + (t.main ? ' main' : ''), cx: x, cy: y, r: t.r * U }, base); });
    S('path', { class: 'm-rhine', d: smooth(D.region.water.pts) }, base);
    D.region.roads.forEach(r => S('path', { class: 'm-road', d: smooth(r.pts) }, base));
    const lab = S('g', { class: 'm-labels', 'aria-hidden': 'true' }, svg);
    D.region.towns.forEach(t => { const [x, y] = proj(t.lat, t.lon); S('text', { class: 'm-tlabel' + (t.main ? ' main' : ''), x: x + (t.lx || 0) * U, y: y + (t.ly || 0) * U, 'text-anchor': 'middle' }, lab).textContent = t.name; });
    D.region.roads.forEach(r => {
      const [x, y] = pt(r.pts[Math.floor(r.at * (r.pts.length - 1))]);
      const g = S('g', { transform: `translate(${x},${y}) scale(${k})` }, lab);
      S('rect', { class: 'm-shield', x: -17, y: -10, width: 34, height: 20, rx: 4 }, g);
      S('text', { class: 'm-rlabel', y: 4.5, 'text-anchor': 'middle' }, g).textContent = r.name;
    });
    { const w = D.region.water, [x, y] = pt(w.at); S('text', { class: 'm-water', x, y, transform: `rotate(${w.angle} ${x} ${y})` }, lab).textContent = L(w.name); }
    const gr = S('g', { class: 'm-routes', 'aria-hidden': 'true' }, svg), gn = S('g', { class: 'm-firms' }, svg), gt = S('g', { class: 'm-tags', 'aria-hidden': 'true' }, svg);
    (o.routes || []).forEach(rt => {
      const r = arc(F[rt.from], F[rt.to], rt.bend ?? .18), pc = pvar(rt.poly);
      if (rt.glow) S('path', { class: 'm-route-glow', d: r.d, style: pc }, gr);
      S('path', { class: 'm-route ' + (rt.cls || ''), d: r.d, style: pc }, gr);
      const n = rt.dots || 0, dr = (rt.dr || 5) * k;
      if (rt.anim && !RM) {
        const dur = Math.min(9, Math.max(2.5, r.len / 90));
        for (let i = 0; i < n; i++) {
          const c = S('circle', { class: 'm-dot', r: dr, style: pc }, gr);
          S('animateMotion', { dur: dur.toFixed(2) + 's', begin: (-i * dur / n).toFixed(2) + 's', repeatCount: 'indefinite', path: r.d }, c);
        }
      } else for (let i = 0; i < n; i++) { const [x, y] = qpt(r, (i + .5) / n); S('circle', { class: 'm-dot', cx: x, cy: y, r: dr, style: pc }, gr); }
      if (rt.label) {
        const [x, y] = qpt(r, rt.at ?? .5), g = S('g', { transform: `translate(${x},${y}) scale(${k})` }, gt);
        S('rect', { class: 'm-rtag-bg', x: -26, y: -12, width: 52, height: 24, rx: 5 }, g);
        S('text', { class: 'm-rtag', y: 4.5, 'text-anchor': 'middle' }, g).textContent = rt.label;
      }
    });
    D.firms.forEach(f => {
      const [x, y] = proj(f.lat, f.lon), r = (o.r || 10) * k, dim = (o.dim || []).includes(f.id);
      const cls = ['m-firm', 'r-' + f.role, o.sel === f.id ? 'sel' : '', dim ? 'dim' : '', (o.hl || []).includes(f.id) ? 'hl' : ''].join(' ');
      const a = { class: cls, transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`, 'data-id': f.id };
      if (o.interactive) Object.assign(a, { tabindex: 0, role: 'button', 'aria-label': `${f.name}, ${L(D.roles[f.role])}, ${f.town}`, 'aria-pressed': String(o.sel === f.id) });
      const g = S('g', a, gn);
      if (o.halo || o.interactive) S('circle', { class: 'm-halo', r: r * 2.6 }, g);
      S('path', { class: 'm-shape', d: shape(f.role, r) }, g);
      // schmale Karte: nur gewählte und hervorgehobene Firmen beschriften, Kurzname
      if (!dim && (!small || o.sel === f.id || (o.hl || []).includes(f.id))) {
        const side = f.lab || 't', gap = r * 1.7, fs = 14 * k;
        const at = { r: [gap, fs * .35, 'start'], l: [-gap, fs * .35, 'end'], t: [0, -gap, 'middle'], b: [0, gap + fs * .8, 'middle'] }[side];
        S('text', { class: 'm-flabel', x: at[0], y: at[1], 'text-anchor': at[2], 'aria-hidden': 'true' }, g).textContent = o.short || small ? f.name.split(' ')[0] : f.name;
      }
    });
  }
  const pchip = p => `<span class="pchip" style="${pvar(p)}" title="${esc(L(D.poly[p]))}"><i></i>${p}</span>`;
  const roleShape = (role, size = 14) => `<svg class="rshape" viewBox="-16 -16 32 32" width="${size}" height="${size}" aria-hidden="true"><path d="${shape(role, 11)}"/></svg>`;
  const roleLegend = () => Object.keys(D.roles).map(r => `<span>${roleShape(r)}${L(D.roles[r])}</span>`).join('');

  /* ---------- Kopf: Schritt-Leiste, Sprache, Theme ---------- */
  const SECTIONS = ['start', 'prinzip', 'plattform', 'szenarien', 'projekt', 'einordnung'];
  function renderRail() {
    $('#rail').innerHTML = SECTIONS.map((id, i) => `${i ? '<span class="fil" aria-hidden="true"><i></i></span>' : ''}<button type="button" class="st" data-go="${id}"><i>${i + 1}</i><span class="sl">${T('steps')[i]}</span></button>`).join('');
    trackRail();
  }
  function trackRail() {
    const line = innerHeight * .35, secs = SECTIONS.map(id => document.getElementById(id));
    let cur = 0;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) cur = i; });
    if (innerHeight + scrollY >= root.scrollHeight - 4) cur = secs.length - 1;
    const r = secs[cur].getBoundingClientRect(), frac = Math.min(1, Math.max(0, (line - r.top) / r.height));
    $$('#rail .st').forEach((b, i) => { b.classList.toggle('done', i < cur); if (i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    $$('#rail .fil').forEach((f, i) => f.style.setProperty('--f', i < cur ? 1 : i === cur ? frac.toFixed(3) : 0));
  }
  let railQueued = false;
  addEventListener('scroll', () => { if (!railQueued) { railQueued = true; requestAnimationFrame(() => { railQueued = false; trackRail(); }); } }, { passive: true });
  $('#rail').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) document.getElementById(b.dataset.go).scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); });
  new ResizeObserver(() => root.style.setProperty('--hdr', $('#top').offsetHeight + 'px')).observe($('#top'));

  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  try { const th = Q.get('theme') || localStorage.getItem('kw-theme'); if (th === 'light' || th === 'dark') root.dataset.theme = th; } catch (e) {}
  function renderTheme() {
    const dark = isDark();
    $('#themeIc').setAttribute('d', dark ? 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z' : 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z');
    $('#themeBtn').setAttribute('aria-label', T(dark ? 'themeLight' : 'themeDark'));
    $('#themeBtn').title = T(dark ? 'themeLight' : 'themeDark');
  }
  $('#themeBtn').addEventListener('click', () => { root.dataset.theme = isDark() ? 'light' : 'dark'; try { localStorage.setItem('kw-theme', root.dataset.theme); } catch (e) {} renderTheme(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderTheme);
  $$('[data-lang]').forEach(b => b.addEventListener('click', () => { LANG = b.dataset.lang; try { localStorage.setItem('kw-lang', LANG); } catch (e) {} renderAll(); }));

  function applyStatic() {
    root.lang = LANG;
    $$('[data-t]').forEach(e => { e.innerHTML = e.dataset.t === 'title' ? esc(L(D.project.title)) : T(e.dataset.t); });
    $$('[data-ta]').forEach(e => e.setAttribute('aria-label', T(e.dataset.ta)));
    $$('[data-tp]').forEach(e => e.setAttribute('placeholder', T(e.dataset.tp)));
    $$('[data-kicker]').forEach(e => { const i = +e.dataset.kicker; e.textContent = `${T('stepOf', { i: i + 1, n: SECTIONS.length })} · ${T('steps')[i]}`; });
    $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
  }

  /* ---------- 1 Überblick ---------- */
  function renderStart() {
    const sum = a => fmt(a.reduce((s, x) => s + x.t, 0), 0);
    $('#kFirms').textContent = D.firms.length;
    $('#kFirmsL').textContent = T('kFirms', { n: new Set(D.firms.map(f => f.role)).size });
    $('#kOffers').textContent = OFFERS.length; $('#kOffersL').textContent = T('kOffers', { t: sum(OFFERS) });
    $('#kNeeds').textContent = NEEDS.length; $('#kNeedsL').textContent = T('kNeeds', { t: sum(NEEDS) });
    $('#kPairs').textContent = ALL.length;
    $('#pot').textContent = fmt(ALLOC.sum, 0);
    $('#polyLegend').innerHTML = Object.keys(D.poly).map(pchip).join('');
    $('#legendStart').innerHTML = roleLegend() + `<span class="bdg">${T('schematic')}</span>`;
    const svg = $('#mapStart');
    svg.setAttribute('aria-label', T('mapStartAria', { n: D.firms.length }));
    drawMap(svg, { routes: ALLOC.used.map(m => ({ from: m.o.firm, to: m.n.firm, poly: m.o.poly, dots: 3, dr: 4 })), view: [60, 0, 960, 800], short: true, r: 9 });
  }

  /* ---------- 2 Prinzip: lebender Kreislauf ---------- */
  function renderCycle() {
    const svg = $('#cycle'); svg.innerHTML = '';
    svg.setAttribute('aria-label', T('cyAria'));
    const C = [{ x: 215, y: 160, role: 'P' }, { x: 560, y: 235, role: 'V' }, { x: 320, y: 440, role: 'R' }];
    const FL = [[0, 1, 'fwd', -.25], [1, 2, 'loop', -.25], [2, 1, 'loop', -.35], [2, 0, 'loop', -.25]];
    const names = T('cyFlows'), cells = T('cyCells');
    const gf = S('g', {}, svg), gp = S('g', {}, svg), gc = S('g', {}, svg), gt = S('g', {}, svg);
    FL.forEach(([a, b, kind, bend], i) => {
      const A = C[a], Bc = C[b], mx = (A.x + Bc.x) / 2, my = (A.y + Bc.y) / 2;
      const cx = mx - (Bc.y - A.y) * bend, cy = my + (Bc.x - A.x) * bend, d = `M${A.x},${A.y} Q${cx},${cy} ${Bc.x},${Bc.y}`;
      if (kind === 'loop') S('path', { class: 'cy-glow', d }, gf);
      S('path', { class: 'cy-flow ' + kind, d }, gf);
      const dur = 7 + i;
      for (let j = 0; j < 3; j++) {
        if (RM) { const u = (j + 1) / 4; S('circle', { class: 'cy-part ' + kind, r: 5, cx: (1 - u) ** 2 * A.x + 2 * (1 - u) * u * cx + u * u * Bc.x, cy: (1 - u) ** 2 * A.y + 2 * (1 - u) * u * cy + u * u * Bc.y }, gp); continue; }
        const c = S('circle', { class: 'cy-part ' + kind, r: 5 }, gp);
        S('animateMotion', { dur: dur + 's', begin: (-j * dur / 3).toFixed(2) + 's', repeatCount: 'indefinite', path: d }, c);
      }
      const tx = (mx + cx) / 2, ty = (my + cy) / 2, w = names[i].length * 9 + 24, g = S('g', { class: 'cy-tag', transform: `translate(${tx},${ty})` }, gt);
      S('rect', { x: -w / 2, y: -15, width: w, height: 30, rx: 6 }, g);
      S('text', { y: 5 }, g).textContent = names[i];
    });
    C.forEach((c, i) => {
      const g = S('g', { transform: `translate(${c.x},${c.y})` }, gc);
      S('circle', { class: 'cy-mem', r: 106, 'stroke-dasharray': '2 6' }, g);
      S('circle', { class: 'cy-mem', r: 92, 'stroke-width': 1.5 }, g);
      S('circle', { class: 'cy-core', r: 80 }, g);
      S('path', { class: 'cy-shape', d: shape(c.role, 8), transform: 'translate(0,-40)' }, g);
      S('text', { class: 'cy-t', y: 6 }, g).textContent = cells[i][0];
      S('text', { class: 'cy-s', y: 30 }, g).textContent = cells[i][1];
    });
  }
  function renderVs() {
    const P = [[70, 75], [190, 40], [190, 115], [330, 75], [450, 45], [450, 110]];
    [['#vsToday', false], ['#vsNet', true]].forEach(([id, net]) => {
      const s = $(id); s.innerHTML = '';
      if (net) [[0, 1], [1, 3], [2, 3], [3, 4], [3, 5], [0, 2], [4, 5]].forEach(([a, b]) => S('line', { class: 'vs-link', x1: P[a][0], y1: P[a][1], x2: P[b][0], y2: P[b][1] }, s));
      else P.forEach(([x, y], i) => { if (i % 2) S('line', { class: 'vs-loss', x1: x, y1: y + 22, x2: x, y2: y + 40 }, s); });
      P.forEach(([x, y]) => S('circle', { class: 'vs-node' + (net ? ' on' : ''), cx: x, cy: y, r: 22 }, s));
    });
    $('#vsTodayL').innerHTML = T('vsT').map(t => `<li>${t}</li>`).join('');
    $('#vsNetL').innerHTML = T('vsN').map(t => `<li>${t}</li>`).join('');
  }

  /* ---------- 3 Plattform ---------- */
  const ROLES = Object.keys(D.roles);
  const firstWithMatch = fid => { const f = F[fid], its = [...f.o, ...f.n].map(x => ITEM[x.id]); return (its.find(x => MX[x.id].length) || its[0]).id; };
  const st = { q: '', roles: new Set(ROLES), types: new Set(['o', 'n']), gaps: false, tab: 'match', firm: F[Q.get('firm')] ? Q.get('firm') : 'lintra', item: null };
  st.item = firstWithMatch(st.firm);
  const norm = s => String(s).toLocaleLowerCase('de');
  const itemText = x => norm([...polys(x), ...forms(x).flatMap(k => [D.forms[k].de, D.forms[k].en]), F[x.firm].name].join(' '));
  const firmText = f => norm([f.name, f.town, f.desc.de, f.desc.en, D.roles[f.role].de, D.roles[f.role].en].join(' '));
  const hitQ = s => !st.q.trim() || s.includes(norm(st.q.trim()));
  const entries = () => [...(st.types.has('o') ? OFFERS : []), ...(st.types.has('n') ? NEEDS : [])]
    .filter(x => st.roles.has(F[x.firm].role) && (!st.gaps || !MX[x.id].length) && (hitQ(itemText(x)) || hitQ(firmText(F[x.firm]))));
  const firmsList = () => { const ids = new Set(entries().map(x => x.firm)); return D.firms.filter(f => st.roles.has(f.role) && (ids.has(f.id) || (!st.gaps && st.q.trim() && hitQ(firmText(f))))); };

  function itemBtn(x, withFirm) {
    const m = MX[x.id], f = F[x.firm], off = x.kind === 'o';
    const badge = m.length ? `<span class="bdg ok">${T(off ? 'takers' : 'suppliers', { n: m.length })}</span>` : `<span class="bdg warn wrap">${T(off ? 'noTaker' : 'noSupplier')}</span>`;
    const who = withFirm ? `<span>${roleShape(f.role)} ${esc(f.name)}</span>` : '';
    return `<button type="button" class="item" data-item="${x.id}" aria-pressed="${st.item === x.id}"><span class="top">${polys(x).map(pchip).join('')}<span class="nm">${forms(x).map(k => esc(L(D.forms[k]))).join(' / ')}</span><span class="q">${fmt(x.t)} ${T('perMonth')}</span></span>`
      + `<span class="meta">${badge}${who}<span>${quals(x).map(q => esc(L(D.quality[q]))).join(' / ')}${x.note ? ' · ' + esc(L(x.note)) : ''}</span></span></button>`;
  }
  function matchRow(m, x) {
    const off = x.kind === 'o', other = F[off ? m.n.firm : m.o.firm], counter = off ? m.n : m.o;
    const checks = [['y', T('chkPoly')], ['y', T('chkForm')], ['y', T(m.qfit === 1 ? 'chkQual' : 'chkQual2')], m.cover >= .999 ? ['y', T('chkQty')] : ['o', T('chkQtyPart', { p: Math.round(m.cover * 100) })]];
    return `<button type="button" class="item" data-item="${counter.id}"><span class="score"><span class="who">${roleShape(other.role)} ${esc(other.name)} · ${fmt(m.d)} km</span><b>${m.score} %</b><span class="bar"><i style="width:${m.score}%"></i></span></span>`
      + `<span class="checks">${checks.map(([c, t]) => `<span class="${c}">${t}</span>`).join('')}</span></button>`;
  }
  function profileHTML(f) {
    const its = k => f[k].map(x => itemBtn(ITEM[x.id])).join('');
    return `<div class="prof"><span class="role">${roleShape(f.role, 16)} ${L(D.roles[f.role])} · ${esc(f.town)} <span class="bdg demo">${T('fict')}</span></span><h3>${esc(f.name)}</h3><p>${esc(L(f.desc))}</p></div>`
      + (f.o.length ? `<div class="lst"><div class="lt"><span>${T('offersH')}</span><span>${f.o.length}</span></div>${its('o')}</div>` : '')
      + (f.n.length ? `<div class="lst"><div class="lt"><span>${T('needsH')}</span><span>${f.n.length}</span></div>${its('n')}</div>` : '');
  }
  function matchHTML() {
    if (!st.firm) return `<p class="empty">${T('pickFirm')}</p>`;
    let h = profileHTML(F[st.firm]);
    const x = ITEM[st.item];
    if (!x || x.firm !== st.firm) return h + `<p class="empty">${T('pickItem')}</p>`;
    const m = MX[x.id];
    h += `<div class="lst"><div class="lt"><span>${T('bestFor', { x: `${polys(x).join('/')} · ${forms(x).map(k => esc(L(D.forms[k]))).join(' / ')}` })}</span></div>`
      + (m.length ? m.slice(0, 4).map(mm => matchRow(mm, x)).join('') : `<p class="empty">${T('noMatch')}</p>`) + '</div>';
    return h + `<details class="how"><summary>${T('how')}</summary><p>${T('howText', { wq: R.wq * 100, wm: R.wm * 100, wd: R.wd * 100, dmax: R.dmax })}</p></details>`;
  }
  function boardHTML(es) {
    if (!es.length) return `<p class="empty">${T('noHits')}</p>`;
    return ['o', 'n'].filter(k => st.types.has(k)).map(k => {
      const g = es.filter(x => x.kind === k);
      if (!g.length) return '';
      return `<div class="lst"><div class="lt"><span>${T(k === 'o' ? 'offers' : 'needs')}</span><span>${T('sumLine', { n: g.length, t: fmt(g.reduce((s, x) => s + x.t, 0)) })}</span></div>${g.map(x => itemBtn(x, true)).join('')}</div>`;
    }).join('');
  }
  function firmsHTML(fs) {
    if (!fs.length) return `<p class="empty">${T('noHits')}</p>`;
    return `<div class="lst">${fs.map(f => `<button type="button" class="item" data-firm="${f.id}" aria-pressed="${st.firm === f.id}"><span class="top">${roleShape(f.role, 16)}<span class="nm">${esc(f.name)}</span><span class="lab">${esc(f.town)}</span></span><span class="meta">${[...new Set([...f.o.map(o => o.poly), ...f.n.flatMap(n => n.poly)])].map(pchip).join('')}</span></button>`).join('')}</div>`;
  }
  function platRoutes() {
    const x = ITEM[st.item];
    if (!x || x.firm !== st.firm) return [];
    return MX[x.id].slice(0, 3).map((m, i) => ({ from: m.o.firm, to: m.n.firm, poly: m.o.poly, cls: i ? '' : 'strong', glow: true, dots: i ? 2 : 3, dr: i ? 4 : 5, anim: !i, label: m.score + ' %', bend: [.2, -.25, .4][i] }));
  }
  function renderControls() {
    $('#q').value = st.q;
    $('#roleChips').innerHTML = ROLES.map(r => `<button type="button" class="chip" data-role="${r}" aria-pressed="${st.roles.has(r)}">${roleShape(r)}${L(D.roles[r])}</button>`).join('');
    $$('[data-type]').forEach(b => b.setAttribute('aria-pressed', String(st.types.has(b.dataset.type))));
    $('#gapChip').setAttribute('aria-pressed', String(st.gaps));
  }
  function renderPlat() {
    const es = entries(), fs = firmsList(), shown = new Set(fs.map(f => f.id));
    $('#hits').textContent = T('hits', { f: fs.length, e: es.length });
    const x = ITEM[st.item], nm = x && x.firm === st.firm ? MX[x.id].length : 0;
    [['firms', 'tabFirms', fs.length], ['board', 'tabBoard', es.length], ['match', 'tabMatch', nm]].forEach(([k, key, n]) => {
      const b = $('#tab-' + k); b.textContent = T(key, { n }); b.setAttribute('aria-selected', String(st.tab === k)); b.tabIndex = st.tab === k ? 0 : -1;
    });
    $('#pbody').setAttribute('aria-labelledby', 'tab-' + st.tab);
    $('#pbody').innerHTML = st.tab === 'firms' ? firmsHTML(fs) : st.tab === 'board' ? boardHTML(es) : matchHTML();
    const routes = platRoutes(), partners = routes.map(r => r.from === st.firm ? r.to : r.from);
    const svg = $('#mapPlat');
    svg.setAttribute('aria-label', T('mapPlatAria'));
    drawMap(svg, { interactive: true, sel: st.firm, hl: partners, r: 10, routes, view: [40, 10, 980, 800],
      dim: D.firms.filter(f => !shown.has(f.id) && f.id !== st.firm && !partners.includes(f.id)).map(f => f.id) });
    $('#legendPlat').innerHTML = roleLegend();
  }
  // Fokus nach dem Neuzeichnen auf dasselbe Element zurücksetzen (Tastaturbedienung)
  function keepFocus(fn) {
    const a = document.activeElement, keys = ['item', 'firm', 'id', 'tab', 'role', 'type'];
    const k = a && keys.find(k => a.dataset && a.dataset[k] !== undefined), v = k && a.dataset[k], gap = a && a.id === 'gapChip';
    fn();
    const el = gap ? $('#gapChip') : k && $(`#plattform [data-${k}="${v}"]`);
    if (el) el.focus({ preventScroll: true });
  }
  const selectFirm = id => { st.firm = id; st.item = firstWithMatch(id); st.tab = 'match'; };
  function setPlat(patch) { Object.assign(st, patch); keepFocus(() => { renderControls(); renderPlat(); }); }
  $('#pbody').addEventListener('click', e => {
    const b = e.target.closest('[data-item],[data-firm]');
    if (!b) return;
    if (b.dataset.firm) { selectFirm(b.dataset.firm); setPlat({}); return; }
    const x = ITEM[b.dataset.item]; setPlat({ firm: x.firm, item: x.id, tab: 'match' });
  });
  const mapPick = e => { const g = e.target.closest('[data-id]'); if (g) { selectFirm(g.dataset.id); setPlat({}); } };
  $('#mapPlat').addEventListener('click', mapPick);
  $('#mapPlat').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mapPick(e); } });
  $('#ptabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setPlat({ tab: b.dataset.tab }); });
  $('#ptabs').addEventListener('keydown', e => {
    const order = ['firms', 'board', 'match'], i = order.indexOf(st.tab), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) { e.preventDefault(); st.tab = order[(i + d + 3) % 3]; renderPlat(); $('#tab-' + st.tab).focus(); }
  });
  $('#q').addEventListener('input', e => { st.q = e.target.value; if (st.tab === 'match' && st.q.trim()) st.tab = 'board'; renderPlat(); });
  $('#roleChips').addEventListener('click', e => { const b = e.target.closest('[data-role]'); if (!b) return; st.roles.has(b.dataset.role) ? st.roles.delete(b.dataset.role) : st.roles.add(b.dataset.role); setPlat({}); });
  $$('[data-type]').forEach(b => b.addEventListener('click', () => { st.types.has(b.dataset.type) ? st.types.delete(b.dataset.type) : st.types.add(b.dataset.type); setPlat({}); }));
  $('#gapChip').addEventListener('click', () => setPlat({ gaps: !st.gaps, tab: !st.gaps ? 'board' : st.tab }));

  /* ---------- 4 Szenarien (Scrollytelling) ---------- */
  let scn = D.scenarios.find(s => s.id === Q.get('scn')) || D.scenarios[0], scnStep = 0, stepObs = null;
  function scnVals(s) {
    const [l1, l2] = s.legs.map(([o, n]) => match(ITEM[o], ITEM[n]));
    const o1 = ITEM[s.legs[0][0]], n2 = ITEM[s.legs[1][1]];
    return { l1, l2, t1: fmt(o1.t), n2: fmt(n2.t), d1: fmt(l1.d), d2: fmt(l2.d), pct: Math.round(Math.min(o1.t, n2.t) / n2.t * 100), q: L(D.quality[o1.q]) };
  }
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
  function fitView(ids, el) {
    const pts = ids.map(id => proj(F[id].lat, F[id].lon)), pad = 2.4 * U;
    let x0 = Math.min(...pts.map(p => p[0])) - pad, x1 = Math.max(...pts.map(p => p[0])) + pad;
    let y0 = Math.min(...pts.map(p => p[1])) - pad, y1 = Math.max(...pts.map(p => p[1])) + pad;
    const ar = (el && el.clientWidth / Math.max(1, el.clientHeight)) || 1.4;   // losgelöstes SVG (Selbsttest): Standardformat
    let w = x1 - x0, h = y1 - y0;
    if (w / h < ar) { const nw = h * ar; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y0 -= (nh - h) / 2; h = nh; }
    const min = W * .4;
    if (w < min) { const f = min / w; x0 -= (w * f - w) / 2; y0 -= (h * f - h) / 2; w *= f; h *= f; }
    return [x0, y0, w, h];
  }
  function drawScn(svg = $('#mapScn'), s = scn, i = scnStep) {
    const [a, b, c] = s.path, loop = a === c;
    const leg = (from, to, on, bend) => ({ from, to, poly: s.poly, cls: on ? 'strong' : '', glow: on, dots: on ? 4 : 0, dr: 4, anim: on, bend });
    const routes = [];
    if (i >= 1) routes.push(leg(a, b, i !== 2, .3));
    if (i >= 2) routes.push(leg(b, c, true, loop ? .3 : .2));
    const hl = [...new Set(s.path.slice(0, i === 0 ? 1 : i === 1 ? 2 : 3))];
    drawMap(svg, { sel: a, hl, halo: true, r: 11, routes, par: 'xMidYMid slice', view: fitView(s.path, svg.parentNode), dim: D.firms.filter(f => !s.path.includes(f.id)).map(f => f.id) });
    svg.setAttribute('aria-label', T('scnAria', { s: L(s.title) }));
    const v = scnVals(s);
    $('#scnCap').innerHTML = `<span class="pchip" style="${pvar(s.poly)}"><i></i>${s.poly} · ${loop ? v.d1 : `${v.d1} + ${v.d2}`} km</span><span class="bdg">${T('capStep', { i: i + 1, n: s.steps.length })}</span>`;
    return routes.length;
  }
  function setStep(i) {
    if (i === scnStep) return;
    scnStep = i;
    $$('#steps .step').forEach((e, j) => { e.classList.toggle('done', j < i); if (j === i) e.setAttribute('aria-current', 'step'); else e.removeAttribute('aria-current'); });
    drawScn();
  }
  function renderScn() {
    $('#scnTabs').innerHTML = D.scenarios.map(s => `<button type="button" role="tab" data-scn="${s.id}" aria-selected="${s === scn}" style="${pvar(s.poly)}"><i></i>${esc(L(s.title))}</button>`).join('');
    const v = scnVals(scn);
    const plaus = [['y', T('pMat', { p: scn.poly })], ['y', T('pQual', { q: v.q })], ['y', T('pQty', { p: v.pct })],
      ['y', scn.path[0] === scn.path[2] ? T('pDist', { d: v.d1 }) : T('pDist2', { d1: v.d1, d2: v.d2 })], ...scn.open.map(o => ['o', L(o)])];
    $('#steps').innerHTML = `<p class="scn-sub" style="${pvar(scn.poly)}">${esc(L(scn.sub))}</p>`
      + scn.steps.map((st2, i) => { const [t, txt] = st2[LANG] || st2.de; return `<button type="button" class="step${i < scnStep ? ' done' : ''}" data-step="${i}" style="${pvar(scn.poly)}"${i === scnStep ? ' aria-current="step"' : ''}><span class="n">${i + 1}</span><span class="tx"><b>${esc(t)}</b>${esc(fill(txt, v))}</span></button>`; }).join('')
      + `<div class="plaus"><h3>${T('plausT')}</h3>${plaus.map(([c, t]) => `<span class="${c}">${esc(t)}</span>`).join('')}</div>`;
    drawScn();
    if (stepObs) stepObs.disconnect();
    stepObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setStep(+e.target.dataset.step); }), { rootMargin: '-45% 0px -45% 0px' });
    $$('#steps .step').forEach(e => stepObs.observe(e));
  }
  $('#scnTabs').addEventListener('click', e => { const b = e.target.closest('[data-scn]'); if (!b) return; scn = D.scenarios.find(s => s.id === b.dataset.scn); scnStep = 0; renderScn(); });
  $('#steps').addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) setStep(+b.dataset.step); });

  /* ---------- 5 Projekt ---------- */
  let TESTS = [];
  const passed = () => TESTS.filter(t => t.pass).length;
  function renderGoals() {
    const ist = { firms: T('istFirms', { n: D.firms.length }), proto: T('istProto'), scn: T('istScn', { n: D.scenarios.length }),
      tests: T('istTests', { p: passed(), n: T('tests').length }), guide: T('istGuide', { n: D.project.guide.length }) };
    $('#goals').innerHTML = D.project.goals.map(g => { const [a, b] = g[LANG] || g.de; return `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td>${esc(ist[g.ist])}</td><td><span class="bdg ${g.st === 'ok' ? 'ok' : 'warn'}">${T('st')[g.st]}</span></td></tr>`; }).join('');
  }
  function placeTimeline() {
    const tl = $('#tl'), now = tl.children[D.project.now];
    if (!now) return;
    const a = tl.getBoundingClientRect(), n = now.querySelector('.n').getBoundingClientRect();
    tl.style.setProperty('--fill', Math.max(0, (n.left + n.width / 2 - a.left - 18) / Math.max(1, a.width - 36) * 100).toFixed(1) + '%');
  }
  function renderProject() {
    renderGoals();
    const P = D.project;
    $('#succY').innerHTML = P.success.shows.map(x => `<li class="y">${esc(L(x))}</li>`).join('');
    $('#succO').innerHTML = P.success.needs.map(x => `<li class="o">${esc(L(x))}</li>`).join('');
    $('#tl').innerHTML = P.phases.map((p, i) => { const [a, b, c] = p[LANG] || p.de; return `<li class="ph ${i < P.now ? 'done' : i === P.now ? 'now' : ''}"${i === P.now ? ' aria-current="step"' : ''}><span class="n">${i + 1}</span><b>${esc(a)}</b><p>${esc(b)}</p><span class="bdg ${p.st === 'ok' ? 'ok' : 'warn'}">${esc(c)}</span></li>`; }).join('');
    placeTimeline();
    $('#outs').innerHTML = P.outputs.map(o => { const [a, b] = o[LANG] || o.de; return `<div><span><b>${esc(a)}</b><small>${esc(b)}</small></span><span class="bdg ${o.st === 'ok' ? 'ok' : 'warn'}">${T('stOut')[o.st]}</span></div>`; }).join('');
    $('#testTitle').textContent = T('testTitle', { n: T('tests').length });
    renderTests();
    $('#personas').innerHTML = D.personas.map(p => `<article class="persona"><span class="bdg demo">${T('persona')}</span><div class="who"><span class="av" aria-hidden="true">${p.name.replace(/^Dr\. /, '').split(' ').map(w => w[0]).join('')}</span><span><b>${esc(p.name)}</b><small>${esc(L(p.group))} · ${esc(L(p.meta))}</small></span></div>`
      + `<blockquote>${esc(L(p.quote))}</blockquote><dl><dt>${T('pGoal')}</dt><dd>${esc(L(p.goal))}</dd><dt>${T('pHurdle')}</dt><dd>${esc(L(p.hurdle))}</dd><dt>${T('pGain')}</dt><dd>${esc(L(p.gain))}</dd></dl>`
      + `<button type="button" class="btn" data-persona="${p.go}">${T('go')[p.go]}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></article>`).join('');
  }
  $('#personas').addEventListener('click', e => {
    const b = e.target.closest('[data-persona]'); if (!b) return;
    const go = b.dataset.persona, all = { q: '', roles: new Set(ROLES), gaps: false, tab: 'board' };
    if (go === 'scenarios') { $('#szenarien').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); return; }
    setPlat({ ...all, types: new Set(go === 'needs' ? ['n'] : go === 'offers' ? ['o'] : ['o', 'n']), gaps: go === 'gaps' });
    $('#plattform').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
  });

  /* ---------- Selbsttest: prüft die echten Funktionen der Seite ---------- */
  function withState(patch, fn) {
    const keep = { ...st, roles: new Set(st.roles), types: new Set(st.types) };
    Object.assign(st, { q: '', roles: new Set(ROLES), types: new Set(['o', 'n']), gaps: false }, patch);
    try { return fn(); } finally { Object.assign(st, keep); }
  }
  const inBox = f => f.lat > B.lat0 && f.lat < B.lat1 && f.lon > B.lon0 && f.lon < B.lon1;
  const CHECKS = [
    () => { const div = document.createElement('div');
      const ok = D.firms.length >= 10 && D.firms.every(f => { div.innerHTML = profileHTML(f); return f.name && D.roles[f.role] && f.town && inBox(f) && (f.o.length + f.n.length) > 0 && div.querySelector('h3').textContent === f.name && div.querySelectorAll('[data-item]').length === f.o.length + f.n.length; });
      return [ok, { n: D.firms.length }]; },
    () => withState({}, () => { const es = entries(), div = document.createElement('div'); div.innerHTML = boardHTML(es);
      const ok = es.length === OFFERS.length + NEEDS.length && es.every(x => x.t > 0 && polys(x).every(p => D.poly[p]) && forms(x).every(k => D.forms[k])) && div.querySelectorAll('[data-item]').length === es.length;
      return [ok, { o: OFFERS.length, n: NEEDS.length }]; }),
    () => { const p = Object.keys(D.poly)[0], f = D.firms[0];
      const okP = withState({ q: p }, () => { const es = entries(); return es.length > 0 && es.every(x => itemText(x).includes(norm(p)) || firmText(F[x.firm]).includes(norm(p))); });
      const okF = withState({ q: f.name }, () => firmsList().some(x => x.id === f.id));
      const okN = withState({ q: '#kein-treffer#' }, () => entries().length === 0 && firmsList().length === 0);
      return [okP && okF && okN, {}]; },
    () => { const okR = ROLES.every(r => withState({ roles: new Set([r]) }, () => { const fs = firmsList(); return fs.length === D.firms.filter(f => f.role === r).length && fs.every(f => f.role === r); }));
      const okT = withState({ types: new Set(['n']) }, () => entries().every(x => x.kind === 'n'));
      const okG = withState({ gaps: true }, () => { const es = entries(); return es.every(x => !MX[x.id].length) && es.length === Object.values(ITEM).filter(x => !MX[x.id].length).length; });
      return [okR && okT && okG, {}]; },
    () => { const rules = ALL.every(m => m.o.firm !== m.n.firm && m.n.poly.includes(m.o.poly) && m.n.forms.includes(m.o.form) && m.n.q.includes(m.o.q) && m.score >= 0 && m.score <= 100);
      const sorted = Object.values(MX).every(l => l.every((m, i) => !i || l[i - 1].score >= m.score));
      const a = allocate(), noOver = Object.values(a.lo).every(v => v >= -1e-9) && Object.values(a.ln).every(v => v >= -1e-9);
      return [rules && sorted && noOver && a.sum > 0, { n: ALL.length }]; },
    () => { const firmsOnMap = $('#mapPlat').querySelectorAll('.m-firm').length, svg = document.createElementNS(NS, 'svg');
      const okS = D.scenarios.every(s => s.legs.every(([o, n]) => ITEM[o] && ITEM[n] && match(ITEM[o], ITEM[n])) && s.path.every(id => F[id]) && drawScn(svg, s, s.steps.length - 1) === 2);
      drawScn();
      return [firmsOnMap === D.firms.length && okS, { f: firmsOnMap, s: D.scenarios.length }]; },
  ];
  function runTests() {
    TESTS = CHECKS.map((fn, i) => { let pass = false, v = {}, err = ''; try { [pass, v] = fn(); } catch (e) { err = String(e && e.message || e); } return { i, pass: !!pass, v, err, at: new Date() }; });
    renderTests(); renderGoals();
  }
  function renderTests() {
    const names = T('tests'), det = T('tDetail');
    $('#tests').innerHTML = TESTS.map(t => `<li class="${t.pass ? 'pass' : 'fail'}"><span>${names[t.i]}</span><em>${T(t.pass ? 'pass' : 'fail')}</em><small>${esc(t.err || fill(det[t.i], t.v))}</small></li>`).join('');
    $('#testStamp').textContent = TESTS.length ? T('testStamp', { d: TESTS[0].at.toLocaleString(LANG === 'de' ? 'de-DE' : 'en-GB') }) : '';
    $('#testSave').disabled = !TESTS.length;
  }
  $('#testRun').addEventListener('click', runTests);
  $('#testSave').addEventListener('click', () => {
    const names = I18N.de.tests, det = I18N.de.tDetail;
    const out = { tool: 'KreiswertS Selbsttest', run: TESTS[0].at.toISOString(), page: location.href.split('?')[0], demoData: true,
      data: { firms: D.firms.length, offers: OFFERS.length, needs: NEEDS.length, pairs: ALL.length, potential_t_per_month: ALLOC.sum },
      passed: passed(), total: TESTS.length,
      results: TESTS.map(t => ({ test: names[t.i], passed: t.pass, detail: t.err || fill(det[t.i], t.v) })) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = `kreiswerts-selbsttest-${out.run.slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  /* ---------- 6 Einordnung ---------- */
  function renderContext() {
    const acc = T('acc'), cls = { free: 'ok', closed: 'warn', self: 'ok' };
    $('#sota').innerHTML = D.platforms.map(p => `<tr><td><a href="${esc(p.src)}" target="_blank" rel="noopener noreferrer" title="${esc(T('sourceOf', { x: p.name }))}">${esc(p.name)}</a></td><td>${esc(L(p.by))}</td><td><span class="bdg ${cls[p.access] || ''}">${acc[p.access]}</span></td><td>${esc(L(p.plus))}</td><td>${esc(L(p.gap))}</td></tr>`).join('')
      + `<tr class="self"><td>KreiswertS</td><td>${T('selfBy')}</td><td><span class="bdg ok">${acc.self}</span></td><td>${T('selfPlus')}</td><td>${T('selfGap')}</td></tr>`;
    $('#gapList').innerHTML = T('gaps').map(g => `<li class="y"><span>${g}</span></li>`).join('');
    $('#limList').innerHTML = D.project.limits.map(l => `<li class="o"><span>${esc(L(l))}</span></li>`).join('');
    $('#guideTitle').textContent = T('guideTitle', { n: D.project.guide.length });
    $('#rsteps').innerHTML = D.project.guide.map(g => { const [a, b] = g[LANG] || g.de; return `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`; }).join('');
  }

  /* ---------- Start ---------- */
  function renderAll() {
    applyStatic(); renderRail(); renderTheme();
    renderStart(); renderCycle(); renderVs();
    renderControls(); renderPlat(); renderScn(); renderProject(); renderContext();
  }
  renderAll();
  runTests();
  let rz = 0;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { renderStart(); renderPlat(); drawScn(); placeTimeline(); trackRail(); }, 150); });
})();
