/* KreiswertS · Konten: Anmeldung (Login:B), Firmenbereich (Kunde:B), Verwaltung (Admin:A) – Entscheidung 2026-11-01.
   Spricht nur mit KW_API (api.js, simuliertes Backend); Rechte prüft das Backend, die Oberfläche blendet nur aus.
   Adressen: #/anmelden · #/registrieren · #/firma/treffer|inserate|anfragen|profil|team · #/verwaltung/aufgaben|firmen|inserate|regeln|protokoll
   Direktlinks: ?lang=de|en · ?theme=light|dark */
(() => {
  'use strict';
  const D = window.KW_DATA, API = window.KW_API;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const Q = new URLSearchParams(location.search), root = document.documentElement, app = $('#app');

  /* ---------- Texte ---------- */
  const I18N = {
    de: {
      demo: 'Demo-Daten · fiktiv', langAria: 'Sprache', themeDark: 'Dunkles Design', themeLight: 'Helles Design', toMap: 'Zur Karte',
      title: 'KreiswertS · Konto', loading: 'Lädt …', logout: 'Abmelden', admin: 'Verwaltung',
      roles: { guest: 'Gast', member: 'Firmen-Mitglied', admin: 'Firmen-Admin', platform: 'Plattform-Team' },
      // Anmeldung
      hero: 'Kunststoff-Reste regional austauschen.', heroMap: 'Lage der Firmen in der Region (Demo)',
      stFirms: 'Firmen', stOffers: 't Angebote / Monat', stPairs: 'mögliche Austausche',
      pubTitle: 'Inserate ohne Anmeldung', pubLead: 'Gäste sehen Polymer, Menge gerundet und Gemeinde – keine Firmennamen.',
      pubMore: 'Karte ohne Anmeldung ansehen', about: '≈ {t} t / Monat', under: 'unter {t} t / Monat',
      signIn: 'Anmelden', passkey: 'Mit Passkey anmelden', orMail: 'oder per E-Mail', mail: 'Geschäftliche E-Mail',
      sendLink: 'Anmeldelink senden', linkNote: 'Der Link gilt 15 Minuten. Kein Passwort nötig.',
      noAccount: 'Noch kein Konto?', register: 'Firma registrieren',
      regHint: 'E-Mail eingeben und Link öffnen – danach legen Sie Ihr Firmenkonto an.',
      inbox: 'Demo-Postfach', inboxNote: 'Simulation: Statt einer echten E-Mail erscheint die Nachricht hier.',
      mailTo: 'An {to} · gilt bis {time} Uhr', mailKnown: 'Ihr Anmeldelink für KreiswertS', mailNew: 'Firmenkonto bei KreiswertS anlegen',
      openLink: 'Link in der E-Mail öffnen',
      demoTitle: 'Demo-Konten', demoLead: 'Anmeldung, E-Mail und Datenbank sind nur simuliert. Ein Klick meldet mit dem Konto der Rolle an.',
      guestGo: 'öffentliche Karte', reset: 'Demo zurücksetzen', resetDone: 'Demo-Daten zurückgesetzt',
      pkTitle: 'Passkey wählen (Demo)', pkLead: 'Im echten Betrieb fragt hier der Browser nach Fingerabdruck, Gesicht oder Geräte-PIN.', cancel: 'Abbrechen', close: 'Schließen',
      // Registrierung
      regTitle: 'Firmenkonto anlegen', regLead: 'E-Mail bestätigt: {email}', regName: 'Ihr Name', regFirm: 'Name der Firma',
      regRole: 'Rolle der Firma', regTown: 'Gemeinde', regSubmit: 'Konto anlegen',
      regAfter: 'Konto aktiv · Inserate sofort öffentlich. Das Plattform-Team prüft nachträglich und kann sperren.',
      // Firmenbereich
      nav: { treffer: 'Treffer', inserate: 'Meine Inserate', anfragen: 'Anfragen', karte: 'Karte', firma: 'Firma', profil: 'Firmenprofil', team: 'Team' },
      sideAria: 'Firmenbereich', nNew: '{n} neu', nOpen: '{n} offen',
      hits: 'Treffer', byScore: 'nach Wert sortiert', noHits: 'Noch keine Treffer. Legen Sie ein Inserat an – passende Angebote und Bedarfe erscheinen hier.',
      newB: 'neu', hitFor: { o: 'Treffer für Ihr Angebot', n: 'Treffer für Ihren Bedarf' },
      yours: { o: 'Ihr Angebot', n: 'Ihr Bedarf' }, theirs: { o: 'Angebot', n: 'Bedarf' },
      anon: '{role} aus {town}', kmAway: '{km} km entfernt', perMonth: '{t} t / Monat', free: '{t} t / Monat frei', wanted: '{t} t / Monat gesucht',
      score: 'Wert {s} von 100', scoreS: 'Wert {s}', how: 'so berechnet', pQ: 'Qualität ({p} %)', pM: 'Menge ({p} %)', pD: 'Nähe ({p} %)',
      send: 'Anfrage senden', dismiss: 'Passt nicht', reportBtn: 'Inserat melden',
      privacy: 'Die Firma sieht Ihre Anfrage mit Rolle und Gemeinde. Namen sehen beide erst nach angenommener Anfrage.',
      rqOpenMine: 'Anfrage gesendet · wartet auf Antwort', rqOpenTheirs: 'Diese Firma hat bei Ihnen angefragt – Antwort unter „Anfragen“',
      rqAccepted: 'Anfrage angenommen · Kontakt freigegeben', rqDeclined: 'Anfrage abgelehnt',
      sent: 'Anfrage gesendet', dismissed: 'Treffer ausgeblendet', reportAsk: 'Warum melden Sie dieses Inserat?', reportPh: 'z. B. Menge unrealistisch',
      reportSend: 'Meldung senden', reported: 'Danke – das Plattform-Team prüft die Meldung.',
      // Inserate
      newItem: 'Inserat anlegen', editItem: 'Inserat bearbeiten', noItems: 'Noch keine Inserate.',
      kind: { o: 'Angebot', n: 'Bedarf' }, kindLabel: 'Art', poly: 'Polymer', form: 'Form', quality: 'Qualität', tons: 'Menge (t / Monat)',
      until: 'Gültig bis', status: 'Status', note: 'Hinweis (optional)', save: 'Speichern', del: 'Löschen', edit: 'Bearbeiten',
      st: { active: 'aktiv', draft: 'Entwurf', paused: 'pausiert', hidden: 'ausgeblendet', expired: 'abgelaufen', blocked: 'gesperrt' },
      nHits: '{n} Treffer', endsIn: 'endet in {n} Tagen', endsToday: 'endet heute', multiHint: 'Bedarf: mehrere Werte möglich, der erste ist bevorzugt.',
      saved: 'Gespeichert', deleted: 'Gelöscht', delAsk: 'Inserat „{x}“ löschen?',
      // Anfragen
      inbound: 'Eingegangen', outbound: 'Gesendet', noReq: 'Keine Anfragen.', accept: 'Annehmen', decline: 'Ablehnen',
      rst: { open: 'offen', accepted: 'angenommen', declined: 'abgelehnt' }, reqFrom: 'von {x}', reqTo: 'an {x}',
      accepted: 'Angenommen – Kontakt freigegeben', declinedT: 'Abgelehnt',
      // Profil + Team
      profile: 'Firmenprofil', desc: 'Beschreibung', descPh: 'Was stellt die Firma her, welche Reste fallen an?', onlyAdmin: 'Nur Firmen-Admins können das Profil und das Team ändern.',
      reviewNote: 'Neue Firma: aktiv, das Plattform-Team prüft nachträglich.', team: 'Team', invite: 'Person einladen', inviteBtn: 'Einladung senden',
      invited: 'eingeladen', youB: 'Sie', remove: 'Entfernen', invitedT: 'Einladung gesendet (Demo: Anmeldelink über „Anmelden“ anfordern)', removed: 'Entfernt',
      // Verwaltung
      anav: { aufgaben: 'Aufgaben', firmen: 'Firmen', inserate: 'Inserate', regeln: 'Matching-Regeln', protokoll: 'Protokoll' }, anavAria: 'Verwaltung',
      kFirms: 'Firmen aktiv', kGoal: '/ Ziel ≥ {n}', kItems: 'Aktive Inserate', kReq: 'Anfragen diesen Monat', kTons: 'Austausch angebahnt',
      kItemsOf: 'von {n}', kReqOf: '{n} insgesamt', kTonsOf: 'von {t} t Angeboten',
      qTitle: 'Neue Firmen nachträglich prüfen', qWait: '{n} offen', qOldest: 'ältester Antrag seit {n} Tagen', qToday: 'Antrag von heute', qNone: 'Keine Firma wartet auf Prüfung.',
      imprintOk: 'Impressum geprüft', proofMissing: 'Nachweis offen', hrbMissing: 'HRB fehlt', applicant: 'Antrag von', active: 'aktiv seit Registrierung',
      ok: 'Geprüft', ask: 'Rückfrage', block: 'Sperren', unblock: 'Entsperren', asked: 'Rückfrage gestellt',
      rTitle: 'Gemeldete Inserate', rNone: 'Keine offenen Meldungen.', hide: 'Ausblenden', keep: 'Behalten', show: 'Einblenden',
      mTitle: 'Matching-Regeln', mSum: 'Qualität {wq} % · Menge {wm} % · Nähe {wd} % · bis {dmax} km', mOpen: 'Regeln bearbeiten',
      lTitle: 'Protokoll', lLast: 'letzte Änderung: {x}', lAll: 'Ganzes Protokoll',
      findFirm: 'Firma suchen', people: '{n} Personen', itemsN: '{n} Inserate', pending: 'nachträglich prüfen',
      wQ: 'Qualität (%)', wM: 'Menge (%)', wD: 'Nähe (%)', dmax: 'Nähe zählt bis (km)', wSum: 'Summe {s} % – muss 100 % sein',
      rulesLead: 'Pflicht bleibt: gleiches Polymer, passende Form und Qualität. Die Gewichte verteilen den Wert 0–100.',
      rulesNote: 'Wirkt sofort auf die Treffer im Firmenbereich. Die öffentliche Karte rechnet weiter mit der Regel aus daten.js.',
      when: 'Zeit', who: 'Wer', what: 'Was', firmCol: 'Firma',
      logK: {
        login: 'hat sich angemeldet', register: 'Neue Firma registriert: {firm}', join: 'Einladung angenommen: {firm}', invite: 'Person eingeladen: {email}',
        'member.remove': 'Person entfernt: {name}', 'firm.edit': 'Firmenprofil geändert', 'item.new': 'Inserat angelegt: {item}', 'item.edit': 'Inserat bearbeitet: {item}',
        'item.delete': 'Inserat gelöscht: {item}', 'item.hide': 'Inserat ausgeblendet: {item}', 'item.show': 'Inserat eingeblendet: {item}',
        'request.send': 'Anfrage gesendet: {item}', 'request.accept': 'Anfrage angenommen: {item}', 'request.decline': 'Anfrage abgelehnt: {item}',
        report: 'Inserat gemeldet: {item} – „{reason}“', 'report.keep': 'Meldung geprüft, Inserat bleibt: {item}', 'report.hide': 'Meldung geprüft, Inserat ausgeblendet: {item}',
        'firm.ok': 'Firma geprüft: {firm}', 'firm.ask': 'Rückfrage an: {firm}', 'firm.block': 'Firma gesperrt: {firm}', 'firm.unblock': 'Firma entsperrt: {firm}',
        rules: 'Matching-Regeln geändert: Qualität {wq} % · Menge {wm} % · Nähe {wd} % · bis {dmax} km',
      },
      err: {
        login: 'Bitte zuerst anmelden.', forbidden: 'Dafür fehlt die Berechtigung.', email: 'Bitte eine gültige E-Mail-Adresse eingeben.',
        expired: 'Der Link ist abgelaufen – bitte neu anfordern.', link: 'Der Link wurde schon benutzt oder ist ungültig.', ticket: 'Die Bestätigung ist abgelaufen – bitte neu anmelden.',
        name: 'Bitte einen Namen mit 2–80 Zeichen eingeben.', firm: 'Bitte den Firmennamen eingeben (2–80 Zeichen).', role: 'Bitte eine Rolle wählen.', town: 'Bitte eine Gemeinde wählen.',
        firmExists: 'Diese Firma ist schon registriert.', emailExists: 'Diese E-Mail-Adresse hat schon ein Konto.', self: 'Sie können sich nicht selbst entfernen.',
        t: 'Menge zwischen 0,1 und 10.000 t eingeben.', until: 'Das Datum muss in der Zukunft liegen.', poly: 'Bitte ein Polymer wählen.', form: 'Bitte eine Form wählen.',
        q: 'Bitte eine Qualität wählen.', kind: 'Bitte Angebot oder Bedarf wählen.', status: 'Ungültiger Status.', note: 'Hinweis: höchstens 120 Zeichen.', desc: 'Beschreibung: höchstens 400 Zeichen.',
        requestExists: 'Zu diesem Treffer läuft schon eine Anfrage.', answered: 'Diese Anfrage ist schon beantwortet.', notFound: 'Nicht gefunden – vielleicht schon geändert.',
        weights: 'Die Gewichte müssen zusammen 100 % ergeben.', dmax: 'Entfernung zwischen 1 und 200 km eingeben.', reason: 'Bitte einen Grund mit mindestens 3 Zeichen nennen.',
        blocked: 'Diese Firma ist gesperrt. Bitte das Plattform-Team kontaktieren.', passkey: 'Passkey nicht erkannt.', action: 'Unbekannte Aktion.', any: 'Das hat nicht geklappt – bitte noch einmal versuchen.',
      },
      foot: 'Anmeldung, E-Mail und Datenbank sind simuliert (Demo) · alle Firmen, Personen und Mengen sind fiktiv · Applied Research, Prototyp 2026',
    },
    en: {
      demo: 'Demo data · fictional', langAria: 'Language', themeDark: 'Dark theme', themeLight: 'Light theme', toMap: 'To the map',
      title: 'KreiswertS · Account', loading: 'Loading …', logout: 'Sign out', admin: 'Administration',
      roles: { guest: 'Guest', member: 'Company member', admin: 'Company admin', platform: 'Platform team' },
      hero: 'Exchange plastic residues regionally.', heroMap: 'Companies in the region (demo)',
      stFirms: 'companies', stOffers: 't offers / month', stPairs: 'possible exchanges',
      pubTitle: 'Listings without signing in', pubLead: 'Guests see polymer, rounded quantity and municipality – no company names.',
      pubMore: 'View the map without signing in', about: '≈ {t} t / month', under: 'below {t} t / month',
      signIn: 'Sign in', passkey: 'Sign in with passkey', orMail: 'or by email', mail: 'Business email',
      sendLink: 'Send sign-in link', linkNote: 'The link is valid for 15 minutes. No password needed.',
      noAccount: 'No account yet?', register: 'Register a company',
      regHint: 'Enter your email and open the link – then you create your company account.',
      inbox: 'Demo inbox', inboxNote: 'Simulation: instead of a real email the message appears here.',
      mailTo: 'To {to} · valid until {time}', mailKnown: 'Your KreiswertS sign-in link', mailNew: 'Create a company account on KreiswertS',
      openLink: 'Open the link in the email',
      demoTitle: 'Demo accounts', demoLead: 'Sign-in, email and database are simulated only. One click signs in with the account of that role.',
      guestGo: 'public map', reset: 'Reset demo', resetDone: 'Demo data reset',
      pkTitle: 'Choose a passkey (demo)', pkLead: 'In real use the browser asks for fingerprint, face or device PIN here.', cancel: 'Cancel', close: 'Close',
      regTitle: 'Create company account', regLead: 'Email confirmed: {email}', regName: 'Your name', regFirm: 'Company name',
      regRole: 'Company role', regTown: 'Municipality', regSubmit: 'Create account',
      regAfter: 'Account active · listings public right away. The platform team reviews afterwards and can block.',
      nav: { treffer: 'Matches', inserate: 'My listings', anfragen: 'Requests', karte: 'Map', firma: 'Company', profil: 'Company profile', team: 'Team' },
      sideAria: 'Company area', nNew: '{n} new', nOpen: '{n} open',
      hits: 'Matches', byScore: 'sorted by score', noHits: 'No matches yet. Create a listing – matching offers and needs appear here.',
      newB: 'new', hitFor: { o: 'Match for your offer', n: 'Match for your need' },
      yours: { o: 'Your offer', n: 'Your need' }, theirs: { o: 'Offer', n: 'Need' },
      anon: '{role} from {town}', kmAway: '{km} km away', perMonth: '{t} t / month', free: '{t} t / month available', wanted: '{t} t / month wanted',
      score: 'Score {s} of 100', scoreS: 'Score {s}', how: 'how it is calculated', pQ: 'Quality ({p} %)', pM: 'Quantity ({p} %)', pD: 'Proximity ({p} %)',
      send: 'Send request', dismiss: 'Not a fit', reportBtn: 'Report listing',
      privacy: 'The company sees your request with role and municipality. Both see names only after the request is accepted.',
      rqOpenMine: 'Request sent · awaiting reply', rqOpenTheirs: 'This company sent you a request – reply under “Requests”',
      rqAccepted: 'Request accepted · contact shared', rqDeclined: 'Request declined',
      sent: 'Request sent', dismissed: 'Match hidden', reportAsk: 'Why are you reporting this listing?', reportPh: 'e.g. quantity unrealistic',
      reportSend: 'Send report', reported: 'Thank you – the platform team will review the report.',
      newItem: 'Create listing', editItem: 'Edit listing', noItems: 'No listings yet.',
      kind: { o: 'Offer', n: 'Need' }, kindLabel: 'Type', poly: 'Polymer', form: 'Form', quality: 'Quality', tons: 'Quantity (t / month)',
      until: 'Valid until', status: 'Status', note: 'Note (optional)', save: 'Save', del: 'Delete', edit: 'Edit',
      st: { active: 'active', draft: 'draft', paused: 'paused', hidden: 'hidden', expired: 'expired', blocked: 'blocked' },
      nHits: '{n} matches', endsIn: 'ends in {n} days', endsToday: 'ends today', multiHint: 'Need: several values possible, the first one is preferred.',
      saved: 'Saved', deleted: 'Deleted', delAsk: 'Delete listing “{x}”?',
      inbound: 'Received', outbound: 'Sent', noReq: 'No requests.', accept: 'Accept', decline: 'Decline',
      rst: { open: 'open', accepted: 'accepted', declined: 'declined' }, reqFrom: 'from {x}', reqTo: 'to {x}',
      accepted: 'Accepted – contact shared', declinedT: 'Declined',
      profile: 'Company profile', desc: 'Description', descPh: 'What does the company make, which residues occur?', onlyAdmin: 'Only company admins can change the profile and the team.',
      reviewNote: 'New company: active, the platform team reviews afterwards.', team: 'Team', invite: 'Invite a person', inviteBtn: 'Send invitation',
      invited: 'invited', youB: 'you', remove: 'Remove', invitedT: 'Invitation sent (demo: request a sign-in link under “Sign in”)', removed: 'Removed',
      anav: { aufgaben: 'Tasks', firmen: 'Companies', inserate: 'Listings', regeln: 'Matching rules', protokoll: 'Log' }, anavAria: 'Administration',
      kFirms: 'Active companies', kGoal: '/ goal ≥ {n}', kItems: 'Active listings', kReq: 'Requests this month', kTons: 'Exchange initiated',
      kItemsOf: 'of {n}', kReqOf: '{n} in total', kTonsOf: 'of {t} t offered',
      qTitle: 'Review new companies afterwards', qWait: '{n} open', qOldest: 'oldest application {n} days ago', qToday: 'application from today', qNone: 'No company is waiting for review.',
      imprintOk: 'Imprint checked', proofMissing: 'Proof missing', hrbMissing: 'Register no. missing', applicant: 'Applied by', active: 'active since registration',
      ok: 'Reviewed', ask: 'Ask', block: 'Block', unblock: 'Unblock', asked: 'Question sent',
      rTitle: 'Reported listings', rNone: 'No open reports.', hide: 'Hide', keep: 'Keep', show: 'Show',
      mTitle: 'Matching rules', mSum: 'Quality {wq} % · quantity {wm} % · proximity {wd} % · up to {dmax} km', mOpen: 'Edit rules',
      lTitle: 'Log', lLast: 'last change: {x}', lAll: 'Full log',
      findFirm: 'Search company', people: '{n} people', itemsN: '{n} listings', pending: 'review afterwards',
      wQ: 'Quality (%)', wM: 'Quantity (%)', wD: 'Proximity (%)', dmax: 'Proximity counts up to (km)', wSum: 'Sum {s} % – must be 100 %',
      rulesLead: 'Still required: same polymer, matching form and quality. The weights split the score 0–100.',
      rulesNote: 'Applies at once to matches in the company area. The public map keeps using the rule from daten.js.',
      when: 'Time', who: 'Who', what: 'What', firmCol: 'Company',
      logK: {
        login: 'signed in', register: 'New company registered: {firm}', join: 'Invitation accepted: {firm}', invite: 'Person invited: {email}',
        'member.remove': 'Person removed: {name}', 'firm.edit': 'Company profile changed', 'item.new': 'Listing created: {item}', 'item.edit': 'Listing edited: {item}',
        'item.delete': 'Listing deleted: {item}', 'item.hide': 'Listing hidden: {item}', 'item.show': 'Listing shown: {item}',
        'request.send': 'Request sent: {item}', 'request.accept': 'Request accepted: {item}', 'request.decline': 'Request declined: {item}',
        report: 'Listing reported: {item} – “{reason}”', 'report.keep': 'Report checked, listing stays: {item}', 'report.hide': 'Report checked, listing hidden: {item}',
        'firm.ok': 'Company reviewed: {firm}', 'firm.ask': 'Question to: {firm}', 'firm.block': 'Company blocked: {firm}', 'firm.unblock': 'Company unblocked: {firm}',
        rules: 'Matching rules changed: quality {wq} % · quantity {wm} % · proximity {wd} % · up to {dmax} km',
      },
      err: {
        login: 'Please sign in first.', forbidden: 'You are not allowed to do this.', email: 'Please enter a valid email address.',
        expired: 'The link has expired – please request a new one.', link: 'The link has already been used or is invalid.', ticket: 'The confirmation has expired – please sign in again.',
        name: 'Please enter a name with 2–80 characters.', firm: 'Please enter the company name (2–80 characters).', role: 'Please choose a role.', town: 'Please choose a municipality.',
        firmExists: 'This company is already registered.', emailExists: 'This email address already has an account.', self: 'You cannot remove yourself.',
        t: 'Enter a quantity between 0.1 and 10,000 t.', until: 'The date must be in the future.', poly: 'Please choose a polymer.', form: 'Please choose a form.',
        q: 'Please choose a quality.', kind: 'Please choose offer or need.', status: 'Invalid status.', note: 'Note: at most 120 characters.', desc: 'Description: at most 400 characters.',
        requestExists: 'A request for this match is already running.', answered: 'This request has already been answered.', notFound: 'Not found – it may have changed.',
        weights: 'The weights must add up to 100 %.', dmax: 'Enter a distance between 1 and 200 km.', reason: 'Please give a reason with at least 3 characters.',
        blocked: 'This company is blocked. Please contact the platform team.', passkey: 'Passkey not recognised.', action: 'Unknown action.', any: 'That did not work – please try again.',
      },
      foot: 'Sign-in, email and database are simulated (demo) · all companies, people and quantities are fictional · Applied Research, prototype 2026',
    },
  };
  let LANG = 'de';
  try { LANG = Q.get('lang') || localStorage.getItem('kw-lang') || ((navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en'); } catch (e) {}
  if (!I18N[LANG]) LANG = 'de';
  const T = (k, v = {}) => {
    let s = k.split('.').reduce((o, p) => o?.[p], I18N[LANG]) ?? k.split('.').reduce((o, p) => o?.[p], I18N.de) ?? k;
    if (typeof s === 'string') for (const x in v) s = s.split('{' + x + '}').join(v[x]);
    return s;
  };
  const L = x => x == null ? '' : typeof x === 'string' ? x : (x[LANG] || x.de || '');
  const loc = () => LANG === 'de' ? 'de-DE' : 'en-GB';
  const fmt = (n, d = 1) => Number(n).toLocaleString(loc(), { maximumFractionDigits: d });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = ms => new Date(ms).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric' });
  const stamp = ms => new Date(ms).toLocaleString(loc(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const daysLeft = ms => Math.max(0, Math.ceil((ms - Date.now()) / 864e5));
  const isoDay = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  /* ---------- Material und Gegenüber als Text ---------- */
  const arr = v => Array.isArray(v) ? v : [v];
  const polyTxt = x => arr(x.poly).join(' / ');
  const formTxt = x => arr(x.kind === 'o' ? x.form : x.forms).map(f => L(D.forms[f])).join(', ');
  const qTxt = x => arr(x.q).map(q => L(D.quality[q])).join(' / ');
  const matTxt = x => `${polyTxt(x)} · ${formTxt(x)}`;
  const dot = x => `<i class="pdot" style="--c:var(--p-${D.poly[arr(x.poly)[0]]?.key || 'pp'})" aria-hidden="true"></i>`;
  const partyTxt = p => p.name || T('anon', { role: L(D.roles[p.role]), town: p.town });
  const itemLabel = a => a ? `${T('kind.' + a.kind)} ${a.poly} · ${L(D.forms[a.form]) || a.form}` : '–';
  const initials = s => String(s).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const logo = f => f && f.logo ? `<span class="flogo" style="--c:${esc(f.logo.c)}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${esc(f.logo.d)}"/></svg></span>`
    : `<span class="flogo blank" aria-hidden="true">${esc(initials(f ? f.name : '?'))}</span>`;
  const ICO = {
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    out: '<path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3"/>', plus: '<path d="M12 5v14M5 12h14"/>', map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', check: '<path d="m5 12 5 5 9-10"/>', chev: '<path d="m9 6 6 6-6 6"/>', reset: '<path d="M4 4v6h6"/><path d="M20 12A8 8 0 0 0 5.3 7.6L4 10"/><path d="M4 12a8 8 0 0 0 14.7 4.4"/>',
  };
  const ico = k => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;

  /* ---------- Rückmeldung ---------- */
  let toastT = 0;
  function toast(msg, bad) {
    const t = $('#toast');
    t.textContent = msg; t.classList.toggle('bad', !!bad); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 3500);
  }
  const errText = e => T('err.' + (e && e.code)) !== 'err.' + (e && e.code) ? T('err.' + e.code) : T('err.any');
  // Knopf während des Aufrufs sperren; Fehler als Text, bei 401 zurück zur Anmeldung
  async function run(btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); }
    catch (e) {
      if (e && e.status === 401) { S.me = null; go('anmelden'); }
      toast(errText(e), true);
      if (!(e instanceof API.ApiError)) console.warn(e);
      return undefined;
    } finally { if (btn && btn.isConnected) btn.disabled = false; }
  }

  /* ---------- Zustand, Kopf, Router ---------- */
  const S = { me: null, reg: null, mail: null, regMode: false, sel: null, firmQ: '' };
  const route = () => { const [a, b, c] = location.hash.replace(/^#\/?/, '').split('/'); return { area: a || 'anmelden', tab: b || '', arg: c ? decodeURIComponent(c) : '' }; };
  const go = (...p) => { const h = '#/' + p.filter(Boolean).join('/'); if (location.hash === h) render(true); else location.hash = h; };
  const home = me => !me ? 'anmelden' : me.person.role === 'platform' ? 'verwaltung/aufgaben' : 'firma/treffer';

  function renderHead() {
    const me = S.me, r = route();
    $('#who').innerHTML = me ? `<span class="avatar" aria-hidden="true">${esc(initials(me.person.name))}</span>
      <span class="wname"><b>${esc(me.firm ? me.firm.name : T('roles.platform'))}</b><span>${esc(me.person.name)} · ${esc(T('roles.' + me.person.role))}</span></span>
      <button type="button" class="btn" data-act="logout" aria-label="${esc(T('logout'))}">${ico('out')}<span class="lbl">${esc(T('logout'))}</span></button>` : '';
    $('#areaBdg').hidden = !(me && me.person.role === 'platform');
    $('#areaBdg').textContent = T('admin');
    const nav = $('#anav');
    nav.hidden = !(me && me.person.role === 'platform' && r.area === 'verwaltung');
    nav.setAttribute('aria-label', T('anavAria'));
    nav.innerHTML = nav.hidden ? '' : Object.keys(I18N.de.anav).map(k => `<a href="#/verwaltung/${k}"${r.tab === k ? ' aria-current="page"' : ''}>${esc(T('anav.' + k))}</a>`).join('');
  }
  function applyStatic() {
    root.lang = LANG; document.title = T('title');
    $$('[data-t]').forEach(e => { e.textContent = T(e.dataset.t); });
    $$('[data-ta]').forEach(e => e.setAttribute('aria-label', T(e.dataset.ta)));
    $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
  }

  let renderSeq = 0;
  async function render(moveFocus) {
    const seq = ++renderSeq;
    S.me = await API.me();
    const r = route();
    const allowed = { anmelden: !S.me, registrieren: !S.me && !!S.reg, firma: S.me && S.me.firm, verwaltung: S.me && S.me.person.role === 'platform' };
    if (!allowed[r.area]) { location.replace('#/' + home(S.me)); return; }   // löst hashchange → render aus
    renderHead();
    const html = await VIEWS[r.area](r).catch(e => { if (e && e.status === 401) { location.replace('#/anmelden'); return ''; } toast(errText(e), true); return ''; });
    if (seq !== renderSeq) return;   // inzwischen neu gerendert
    app.innerHTML = html;
    app.dataset.area = r.area;
    AFTER[r.area]?.(r);
    if (moveFocus) { const h = app.querySelector('h1, h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } scrollTo(0, 0); }
  }
  addEventListener('hashchange', () => render(true));

  /* ---------- Ansicht: Anmeldung (Login:B) ---------- */
  function miniMap(ov) {
    const B = D.region.box, w = 400, h = 300, x = lon => (lon - B.lon0) / (B.lon1 - B.lon0) * w, y = lat => (B.lat1 - lat) / (B.lat1 - B.lat0) * h;
    const river = D.region.water.pts.map(([la, lo], i) => `${i ? 'L' : 'M'}${x(lo).toFixed(1)} ${y(la).toFixed(1)}`).join('');
    return `<svg class="mini" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(T('heroMap'))}"><path class="river" d="${river}"/>
      ${ov.dots.map(d => `<circle class="r-${d.role}" cx="${x(d.lon).toFixed(1)}" cy="${y(d.lat).toFixed(1)}" r="6"/>`).join('')}</svg>`;
  }
  const pubRow = x => `<li>${dot(x)}<span><b>${esc(T('kind.' + x.kind))} · ${esc(x.poly.join(' / '))}</b><span>${esc(x.t.lt ? T('under', { t: x.t.lt }) : T('about', { t: fmt(x.t.about, 0) }))} · ${esc(x.town)}</span></span></li>`;
  const roleBtn = d => d.role === 'guest'
    ? `<a class="dacc" href="index.html"><b>${esc(T('roles.guest'))}</b><span>${esc(T('guestGo'))}</span>${ico('arrow')}</a>`
    : `<button type="button" class="dacc" data-act="demo" data-person="${esc(d.person)}"><b>${esc(T('roles.' + d.role))}</b><span>${esc(d.name)}${d.firm ? ' · ' + esc(d.firm) : ''}</span>${ico('arrow')}</button>`;
  function mailHTML() {
    const m = S.mail; if (!m) return '';
    return `<div class="inbox" role="status"><p class="ib-h">${ico('mail')}<b>${esc(T('inbox'))}</b></p>
      <p class="ib-n">${esc(T('inboxNote'))}</p>
      <div class="ib-mail"><b>${esc(T(m.known ? 'mailKnown' : 'mailNew'))}</b><span>${esc(T('mailTo', { to: m.to, time: new Date(m.exp).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' }) }))}</span>
      <button type="button" class="btn pri" data-act="openLink">${esc(T('openLink'))}</button></div></div>`;
  }
  const VIEWS = {
    async anmelden() {
      const [ov, pub, demo] = await Promise.all([API.overview(), API.listings(), API.demoAccounts()]);
      const show = pub.slice().sort((a, b) => (b.t.about || 0) - (a.t.about || 0)).slice(0, 5);
      return `<div class="login">
        <section class="region" aria-labelledby="heroH">
          <h1 id="heroH">${esc(T('hero'))}</h1>
          ${miniMap(ov)}
          <p class="mini-cap">${esc(D.region.towns.filter(t => t.r > 1.5).map(t => t.name).join(' · '))} (Demo)</p>
          <dl class="stats"><div><dt>${esc(T('stFirms'))}</dt><dd>${fmt(ov.firms, 0)}</dd></div><div><dt>${esc(T('stOffers'))}</dt><dd>${fmt(ov.offersT, 0)}</dd></div><div><dt>${esc(T('stPairs'))}</dt><dd>${fmt(ov.pairs, 0)}</dd></div></dl>
          <h2>${esc(T('pubTitle'))}</h2><p>${esc(T('pubLead'))}</p>
          <ul class="pub">${show.map(pubRow).join('')}</ul>
          <a class="more" href="index.html#plattform">${esc(T('pubMore'))}${ico('arrow')}</a>
        </section>
        <section class="signin" aria-labelledby="signH">
          <span class="bdg demo">${esc(T('demo'))}</span>
          <h2 id="signH">${esc(T(S.regMode ? 'register' : 'signIn'))}</h2>
          <button type="button" class="btn pri wide" data-act="passkey">${ico('key')}${esc(T('passkey'))}</button>
          <p class="or"><span>${esc(T('orMail'))}</span></p>
          <form class="stack" data-form="link" novalidate>
            <label for="mailIn">${esc(T('mail'))}</label>
            <input id="mailIn" class="inp" type="email" name="email" autocomplete="email" inputmode="email" spellcheck="false" required value="${esc(S.mailDraft || '')}">
            <button class="btn wide" type="submit">${ico('mail')}${esc(T('sendLink'))}</button>
          </form>
          <p>${esc(T(S.regMode ? 'regHint' : 'linkNote'))}</p>
          ${mailHTML()}
          <p>${esc(T('noAccount'))} <button type="button" class="link" data-act="regMode">${esc(T('register'))}</button></p>
          <div class="demo-acc"><h3>${esc(T('demoTitle'))}</h3><p>${esc(T('demoLead'))}</p>
            <div class="dlist">${demo.map(roleBtn).join('')}</div>
            <button type="button" class="link" data-act="reset">${ico('reset')}${esc(T('reset'))}</button></div>
        </section></div>`;
    },
    async registrieren() {
      const r = S.reg;
      return `<div class="narrow"><section class="tile">
        <span class="bdg demo">${esc(T('demo'))}</span>
        <h1>${esc(T('regTitle'))}</h1><p>${esc(T('regLead', { email: r.email }))}</p>
        <form class="stack" data-form="register" novalidate>
          <label for="rName">${esc(T('regName'))}</label><input id="rName" class="inp" name="name" autocomplete="name" required maxlength="80">
          <label for="rFirm">${esc(T('regFirm'))}</label><input id="rFirm" class="inp" name="firm" autocomplete="organization" required maxlength="80">
          <fieldset><legend>${esc(T('regRole'))}</legend><div class="opts">${Object.keys(D.roles).map((k, i) => `<label class="opt"><input type="radio" name="role" value="${k}"${i ? '' : ' checked'}>${esc(L(D.roles[k]))}</label>`).join('')}</div></fieldset>
          <label for="rTown">${esc(T('regTown'))}</label><select id="rTown" class="inp" name="town">${D.region.towns.map(t => `<option>${esc(t.name)}</option>`).join('')}</select>
          <p class="note">${esc(T('regAfter'))}</p>
          <button class="btn pri" type="submit">${esc(T('regSubmit'))}</button>
        </form></section></div>`;
    },

    /* ---------- Ansicht: Firmenbereich (Kunde:B) ---------- */
    async firma(r) {
      const tab = r.tab || 'treffer';
      const [ms, items, reqs] = await Promise.all([API.matches(), API.myItems(), API.requests()]);
      const side = [['treffer', T('nNew', { n: ms.filter(m => m.isNew).length }), ms.some(m => m.isNew)], ['inserate', items.length], ['anfragen', T('nOpen', { n: reqs.filter(q => q.incoming && q.status === 'open').length }), reqs.some(q => q.incoming && q.status === 'open')]];
      const nav = `<nav class="side" aria-label="${esc(T('sideAria'))}"><ul>
        ${side.map(([k, n, hot]) => `<li><a href="#/firma/${k}"${tab === k ? ' aria-current="page"' : ''}><span>${esc(T('nav.' + k))}</span><span class="cnt${hot ? ' hot' : ''}">${esc(n)}</span></a></li>`).join('')}
        <li><a href="index.html?firm=${encodeURIComponent(S.me.firm.id)}#plattform"><span>${esc(T('nav.karte'))}</span>${ico('map')}</a></li>
        <li class="grp">${esc(T('nav.firma'))}</li>
        ${['profil', 'team'].map(k => `<li><a href="#/firma/${k}"${tab === k ? ' aria-current="page"' : ''}><span>${esc(T('nav.' + k))}</span></a></li>`).join('')}
      </ul></nav>`;
      const body = await FIRMA[tab]?.({ r, ms, items, reqs }) ?? '';
      return `<div class="fa">${nav}<div class="fa-main">${body}</div></div>`;
    },

    /* ---------- Ansicht: Verwaltung (Admin:A) ---------- */
    async verwaltung(r) { return await (ADMIN[r.tab] || ADMIN.aufgaben)(r); },
  };

  /* ---------- Firmenbereich: Reiter ---------- */
  const hitCard = (m, sel) => `<li><a class="hit${sel ? ' sel' : ''}" href="#/firma/treffer/${encodeURIComponent(m.key)}"${sel ? ' aria-current="true"' : ''}>
    <span class="h1">${dot(m.other)}<b>${esc(matTxt(m.other))}</b>${m.isNew ? `<span class="bdg new">${esc(T('newB'))}</span>` : ''}</span>
    <span class="h2"><span>${esc(partyTxt(m.party))}</span><span class="mono">${esc(fmt(m.party.km))} km</span><span class="mono">${esc(T('scoreS', { s: m.score }))}</span></span>
    ${reqBadge(m.request)}</a></li>`;
  function reqBadge(q) {
    if (!q) return '';
    if (q.status === 'accepted') return `<span class="bdg ok">${esc(T('rqAccepted'))}</span>`;
    if (q.status === 'declined') return `<span class="bdg">${esc(T('rqDeclined'))}</span>`;
    return `<span class="bdg warn">${esc(T(q.mine ? 'rqOpenMine' : 'rqOpenTheirs'))}</span>`;
  }
  const side = (x, mine, party) => `<div class="box"><p class="eyb">${esc(T((mine ? 'yours.' : 'theirs.') + x.kind))}</p>
    <p class="mat">${dot(x)}<b>${esc(matTxt(x))}</b></p><p>${esc(qTxt(x))}</p>
    <p>${esc(T(x.kind === 'o' ? 'free' : 'wanted', { t: fmt(x.t) }))}${party ? ' · ' + esc(T('kmAway', { km: fmt(party.km) })) : ''}</p>
    ${x.note ? `<p class="note">${esc(L(x.note))}</p>` : ''}</div>`;
  function scoreBox(m, rules) {
    const rows = [['pQ', m.parts.q, rules.wq], ['pM', m.parts.m, rules.wm], ['pD', m.parts.d, rules.wd]];
    return `<div class="box wbox"><p class="sc-h"><b>${esc(T('score', { s: m.score }))}</b><span>· ${esc(T('how'))}</span></p>
      <dl>${rows.map(([k, v, w]) => `<div><dt>${esc(T(k, { p: fmt(w * 100, 0) }))}</dt><dd><span class="meter"><i style="width:${w ? Math.round(v / (w * 100) * 100) : 0}%"></i></span><span class="mono">${fmt(v, 0)}</span></dd></div>`).join('')}</dl></div>`;
  }
  const FIRMA = {
    async treffer({ r, ms }) {
      const rules = await API.rules();
      const cur = ms.find(m => m.key === r.arg) || ms[0];
      S.sel = cur ? cur.key : null;
      if (!ms.length) return `<section class="tile"><h1>${esc(T('hits'))}</h1><p>${esc(T('noHits'))}</p><a class="btn pri" href="#/firma/inserate">${ico('plus')}${esc(T('newItem'))}</a></section>`;
      const mine = cur.mine, q = cur.request;
      const canSend = S.me.can.includes('request') && !(q && q.status !== 'declined');
      return `<div class="hits">
        <section class="hl" aria-labelledby="hitsH"><div class="hl-h"><h1 id="hitsH">${esc(T('hits'))}</h1><span>${esc(T('byScore'))}</span></div>
          <ul class="hlist">${ms.map(m => hitCard(m, m === cur)).join('')}</ul></section>
        <section class="detail" id="detail" aria-labelledby="detH">
          <p class="eyb">${esc(T('hitFor.' + mine.kind))}</p>
          <h2 id="detH">${esc(matTxt(cur.other))} · ${esc(partyTxt(cur.party))}</h2>
          <div class="pair">${side(mine, true)}${side(cur.other, false, cur.party)}</div>
          ${scoreBox(cur, rules)}
          ${reqBadge(q)}
          <div class="row">
            ${canSend ? `<button type="button" class="btn pri" data-act="send" data-key="${esc(cur.key)}">${esc(T('send'))}</button>` : ''}
            ${q ? '' : `<button type="button" class="btn" data-act="dismiss" data-key="${esc(cur.key)}">${esc(T('dismiss'))}</button>`}
            <button type="button" class="btn" data-act="report" data-item="${esc(cur.other.id)}">${esc(T('reportBtn'))}</button>
          </div>
          <p class="note">${esc(T('privacy'))}</p>
        </section></div>`;
    },
    async inserate({ items }) {
      const row = x => {
        const left = daysLeft(x.until), st = x.hidden ? 'hidden' : x.until < Date.now() ? 'expired' : x.status;
        return `<li class="irow"><div class="i-main">${dot(x)}<span class="bdg">${esc(T('kind.' + x.kind))}</span><b>${esc(matTxt(x))}</b></div>
          <div class="i-meta"><span>${esc(qTxt(x))}</span><span class="mono">${esc(T('perMonth', { t: fmt(x.t) }))}</span>
            <span>${esc(T('nHits', { n: x.hits }))}</span>
            <span class="bdg${st === 'active' ? ' ok' : st === 'draft' || st === 'paused' ? '' : ' warn'}">${esc(T('st.' + st))}</span>
            ${st === 'active' && left <= 14 ? `<span class="bdg warn">${esc(left ? T('endsIn', { n: left }) : T('endsToday'))}</span>` : `<span>${esc(T('until'))} ${esc(day(x.until))}</span>`}</div>
          <div class="i-act"><button type="button" class="btn" data-act="editItem" data-id="${esc(x.id)}">${esc(T('edit'))}</button>
            <button type="button" class="btn" data-act="delItem" data-id="${esc(x.id)}" data-label="${esc(matTxt(x))}">${esc(T('del'))}</button></div></li>`;
      };
      return `<section class="tile"><div class="sec-h"><h1>${esc(T('nav.inserate'))}</h1><button type="button" class="btn pri" data-act="newItem">${ico('plus')}${esc(T('newItem'))}</button></div>
        ${items.length ? `<ul class="ilist">${items.map(row).join('')}</ul>` : `<p>${esc(T('noItems'))}</p>`}</section>`;
    },
    async anfragen({ reqs }) {
      const row = q => `<li class="irow"><div class="i-main">${dot(q.offer || q.need)}<b>${esc(q.offer ? matTxt(q.offer) : '–')}</b><span>→ ${esc(q.need ? matTxt(q.need) : '–')}</span></div>
        <div class="i-meta"><span>${esc(T(q.incoming ? 'reqFrom' : 'reqTo', { x: partyTxt(q.party) }))}</span>${q.party.km != null ? `<span class="mono">${esc(fmt(q.party.km))} km</span>` : ''}
          <span>${esc(stamp(q.created))}</span><span class="bdg${q.status === 'accepted' ? ' ok' : q.status === 'open' ? ' warn' : ''}">${esc(T('rst.' + q.status))}</span></div>
        ${q.incoming && q.status === 'open' ? `<div class="i-act"><button type="button" class="btn pri" data-act="answer" data-id="${esc(q.id)}" data-yes="1">${esc(T('accept'))}</button><button type="button" class="btn" data-act="answer" data-id="${esc(q.id)}">${esc(T('decline'))}</button></div>` : ''}</li>`;
      const grp = (title, list) => `<h2>${esc(title)}</h2>${list.length ? `<ul class="ilist">${list.map(row).join('')}</ul>` : `<p>${esc(T('noReq'))}</p>`}`;
      return `<section class="tile"><h1>${esc(T('nav.anfragen'))}</h1>${grp(T('inbound'), reqs.filter(q => q.incoming))}${grp(T('outbound'), reqs.filter(q => !q.incoming))}<p class="note">${esc(T('privacy'))}</p></section>`;
    },
    async profil() {
      const f = await API.myFirm();
      return `<section class="tile"><div class="sec-h">${logo(f)}<div><h1>${esc(f.name)}</h1><p>${esc(L(D.roles[f.role]))} · ${esc(f.town)}</p></div></div>
        ${f.review ? `<p class="bdg warn wrap">${esc(T('reviewNote'))}</p>` : ''}
        <form class="stack" data-form="profile" novalidate>
          <label for="pDesc">${esc(T('desc'))} (${LANG.toUpperCase()})</label>
          <textarea id="pDesc" class="inp" name="desc" rows="4" maxlength="400" placeholder="${esc(T('descPh'))}"${f.canEdit ? '' : ' readonly'}>${esc(L(f.desc))}</textarea>
          ${f.canEdit ? `<button class="btn pri" type="submit">${esc(T('save'))}</button>` : `<p class="note">${esc(T('onlyAdmin'))}</p>`}
        </form></section>`;
    },
    async team() {
      const [ps, f] = await Promise.all([API.team(), API.myFirm()]);
      return `<section class="tile"><h1>${esc(T('team'))} · ${esc(f.name)}</h1>
        <ul class="ilist">${ps.map(p => `<li class="irow"><div class="i-main"><span class="avatar sm" aria-hidden="true">${esc(initials(p.name))}</span><b>${esc(p.name)}</b>${p.me ? `<span class="bdg">${esc(T('youB'))}</span>` : ''}</div>
          <div class="i-meta"><span>${esc(p.email)}</span><span class="bdg">${esc(T('roles.' + p.role))}</span>${p.pending ? `<span class="bdg warn">${esc(T('invited'))}</span>` : ''}</div>
          ${f.canEdit && !p.me ? `<div class="i-act"><button type="button" class="btn" data-act="removeMember" data-id="${esc(p.id)}">${esc(T('remove'))}</button></div>` : ''}</li>`).join('')}</ul>
        ${f.canEdit ? `<form class="inv" data-form="invite" novalidate><h2>${esc(T('invite'))}</h2>
          <div class="irow2"><label class="fld"><span>${esc(T('mail'))}</span><input class="inp" type="email" name="email" autocomplete="off" required></label>
          <label class="fld"><span>${esc(T('regRole'))}</span><select class="inp" name="role"><option value="member">${esc(T('roles.member'))}</option><option value="admin">${esc(T('roles.admin'))}</option></select></label>
          <button class="btn pri" type="submit">${esc(T('inviteBtn'))}</button></div></form>` : `<p class="note">${esc(T('onlyAdmin'))}</p>`}</section>`;
    },
  };

  /* ---------- Verwaltung: Reiter ---------- */
  const kpi = (label, num, sub, frac, good) => `<div class="kpi"><p class="eyb">${esc(label)}</p><p><b class="num">${num}</b> <span>${esc(sub)}</span></p>
    <span class="meter${good ? ' good' : ''}" aria-hidden="true"><i style="width:${Math.round(Math.min(1, frac || 0) * 100)}%"></i></span></div>`;
  const firmActs = f => f.status === 'blocked'
    ? `<button type="button" class="btn" data-act="review" data-id="${esc(f.id)}" data-do="unblock">${esc(T('unblock'))}</button>`
    : `${f.review ? `<button type="button" class="btn${f.imprint && f.hrb ? ' pri' : ''}" data-act="review" data-id="${esc(f.id)}" data-do="ok">${esc(T('ok'))}</button>
       <button type="button" class="btn${!(f.imprint && f.hrb) && !f.asked ? ' pri' : ''}" data-act="review" data-id="${esc(f.id)}" data-do="ask"${f.asked ? ' disabled' : ''}>${esc(T(f.asked ? 'asked' : 'ask'))}</button>` : ''}
       <button type="button" class="btn" data-act="review" data-id="${esc(f.id)}" data-do="block">${esc(T('block'))}</button>`;
  const logLine = e => esc(fill(I18N[LANG].logK[e.kind] || I18N.de.logK[e.kind] || e.kind, Object.fromEntries(Object.entries(e.args || {}).map(([k, v]) => [k, k === 'item' ? itemLabel(v) : k === 'reason' ? L(v) : ['wq', 'wm', 'wd'].includes(k) ? fmt(v * 100, 0) : v]))));
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
  const logRow = e => `<tr><td class="mono">${esc(stamp(e.at))}</td><td>${esc(e.who)}</td><td>${logLine(e)}</td></tr>`;
  const ADMIN = {
    async aufgaben() {
      const o = await API.adminOverview(), k = o.kpi, oldest = o.queue[0];
      const qAge = oldest ? Math.floor((Date.now() - oldest.created) / 864e5) : 0;
      return `<h1 class="sr-only">${esc(T('anav.aufgaben'))}</h1>
        <div class="kpis">
          ${kpi(T('kFirms'), fmt(k.firms, 0), T('kGoal', { n: k.goalFirms }), k.firms / k.goalFirms, k.firms >= k.goalFirms)}
          ${kpi(T('kItems'), fmt(k.items, 0), T('kItemsOf', { n: k.itemsAll }), k.items / Math.max(1, k.itemsAll))}
          ${kpi(T('kReq'), fmt(k.requests, 0), T('kReqOf', { n: k.requestsAll }), k.requests / Math.max(1, k.requestsAll))}
          ${kpi(T('kTons'), fmt(k.tons) + ' t', T('kTonsOf', { t: fmt(k.offersT, 0) }), k.tons / Math.max(1, k.offersT))}
        </div>
        <details class="acc" open><summary><span class="s-t">${ico('chev')}<b>${esc(T('qTitle'))}</b>${o.queue.length ? `<span class="bdg warn">${esc(T('qWait', { n: o.queue.length }))}</span>` : ''}</span>
          <span class="s-r">${oldest ? esc(qAge ? T('qOldest', { n: qAge }) : T('qToday')) : ''}</span></summary>
          ${o.queue.length ? `<ul class="ilist">${o.queue.map(f => `<li class="irow q"><div class="i-main">${logo(f)}<span class="nm"><b>${esc(f.name)}</b><span>${esc(L(D.roles[f.role]))} · ${esc(f.town)}</span></span></div>
            <div class="i-meta col"><span>${esc(f.hrb || T('hrbMissing'))}</span>${f.imprint && f.hrb ? `<span>${esc(T('imprintOk'))}</span>` : `<span class="warn-t">${esc(T('proofMissing'))}</span>`}</div>
            <div class="i-meta col"><span>${esc(T('applicant'))}</span><span>${esc(f.contact)}</span></div>
            <div class="i-act">${f.status === 'blocked' ? `<span class="bdg warn">${esc(T('st.blocked'))}</span>` : ''}${firmActs(f)}</div></li>`).join('')}</ul>` : `<p class="pad">${esc(T('qNone'))}</p>`}
        </details>
        <details class="acc"${o.reports.length ? ' open' : ''}><summary><span class="s-t">${ico('chev')}<b>${esc(T('rTitle'))}</b>${o.reports.length ? `<span class="bdg warn">${o.reports.length}</span>` : ''}</span>
          <span class="s-r">${o.reports[0] ? `„${esc(L(o.reports[0].reason))}“ · ${esc(o.reports[0].firm)}` : ''}</span></summary>
          ${o.reports.length ? `<ul class="ilist">${o.reports.map(m => `<li class="irow"><div class="i-main">${m.item ? dot(m.item) : ''}<b>${esc(m.item ? matTxt(m.item) : '–')}</b><span>${esc(m.firm)}</span></div>
            <div class="i-meta"><span>„${esc(L(m.reason))}“</span>${m.item ? `<span class="mono">${esc(T('perMonth', { t: fmt(m.item.t) }))}</span>` : ''}<span>${esc(stamp(m.created))}</span></div>
            <div class="i-act"><button type="button" class="btn pri" data-act="resolve" data-id="${esc(m.id)}" data-do="hide">${esc(T('hide'))}</button><button type="button" class="btn" data-act="resolve" data-id="${esc(m.id)}" data-do="keep">${esc(T('keep'))}</button></div></li>`).join('')}</ul>` : `<p class="pad">${esc(T('rNone'))}</p>`}
        </details>
        <details class="acc"><summary><span class="s-t">${ico('chev')}<b>${esc(T('mTitle'))}</b></span><span class="s-r">${esc(rulesTxt(o.rules))}</span></summary>
          <p class="pad"><a class="btn" href="#/verwaltung/regeln">${esc(T('mOpen'))}</a></p></details>
        <details class="acc"><summary><span class="s-t">${ico('chev')}<b>${esc(T('lTitle'))}</b></span><span class="s-r">${o.last ? `${esc(T('lLast', { x: o.last.who }))} – ${logLine(o.last)} · ${esc(stamp(o.last.at))}` : ''}</span></summary>
          <p class="pad"><a class="btn" href="#/verwaltung/protokoll">${esc(T('lAll'))}</a></p></details>`;
    },
    async firmen() {
      const fs = await API.firms(), q = S.firmQ.trim().toLowerCase();
      const list = fs.sort((a, b) => (b.review - a.review) || (b.status === 'blocked') - (a.status === 'blocked') || a.name.localeCompare(b.name));
      return `<section class="tile"><div class="sec-h"><h1>${esc(T('anav.firmen'))}</h1>
        <label class="fld grow"><span class="sr-only">${esc(T('findFirm'))}</span><input class="inp" type="search" id="firmQ" placeholder="${esc(T('findFirm'))}" value="${esc(S.firmQ)}" autocomplete="off"></label></div>
        <ul class="ilist">${list.map(f => `<li class="irow" data-q="${esc((f.name + ' ' + f.town).toLowerCase())}"${q && !(f.name + ' ' + f.town).toLowerCase().includes(q) ? ' hidden' : ''}><div class="i-main">${logo(f)}<span class="nm"><b>${esc(f.name)}</b><span>${esc(L(D.roles[f.role]))} · ${esc(f.town)}</span></span></div>
          <div class="i-meta"><span>${esc(T('people', { n: f.people }))}</span><span>${esc(T('itemsN', { n: f.items }))}</span>
            ${f.status === 'blocked' ? `<span class="bdg warn">${esc(T('st.blocked'))}</span>` : f.review ? `<span class="bdg warn">${esc(T('pending'))}</span>` : `<span class="bdg ok">${esc(T('st.active'))}</span>`}</div>
          <div class="i-act">${firmActs(f)}</div></li>`).join('')}</ul></section>`;
    },
    async inserate() {
      const xs = await API.allItems();
      return `<section class="tile"><h1>${esc(T('anav.inserate'))}</h1><ul class="ilist">${xs.map(x => `<li class="irow"><div class="i-main">${dot(x)}<span class="bdg">${esc(T('kind.' + x.kind))}</span><b>${esc(matTxt(x))}</b></div>
        <div class="i-meta"><span>${esc(x.firm)}</span><span>${esc(qTxt(x))}</span><span class="mono">${esc(T('perMonth', { t: fmt(x.t) }))}</span>
          ${x.hidden ? `<span class="bdg warn">${esc(T('st.hidden'))}</span>` : x.live ? `<span class="bdg ok">${esc(T('st.active'))}</span>` : `<span class="bdg">${esc(T('st.' + (x.until < Date.now() ? 'expired' : x.status)))}</span>`}</div>
        <div class="i-act"><button type="button" class="btn" data-act="moderate" data-id="${esc(x.id)}"${x.hidden ? '' : ' data-hide="1"'}>${esc(T(x.hidden ? 'show' : 'hide'))}</button></div></li>`).join('')}</ul></section>`;
    },
    async regeln() {
      const r = await API.rules(), pc = v => Math.round(v * 100);
      return `<section class="tile narrow-t"><h1>${esc(T('mTitle'))}</h1><p>${esc(T('rulesLead'))}</p>
        <form class="stack" data-form="rules" novalidate>
          <div class="irow2">${[['wq', 'wQ'], ['wm', 'wM'], ['wd', 'wD']].map(([k, l]) => `<label class="fld"><span>${esc(T(l))}</span><input class="inp" type="number" name="${k}" min="0" max="100" step="1" value="${pc(r[k])}" inputmode="numeric"></label>`).join('')}</div>
          <p class="sum" id="wSum" aria-live="polite"></p>
          <label class="fld"><span>${esc(T('dmax'))}</span><input class="inp" type="number" name="dmax" min="1" max="200" step="1" value="${r.dmax}" inputmode="numeric"></label>
          <p class="note">${esc(T('rulesNote'))}</p>
          <button class="btn pri" type="submit">${esc(T('save'))}</button></form></section>`;
    },
    async protokoll() {
      const ls = await API.log();
      return `<section class="tile"><h1>${esc(T('lTitle'))}</h1><div class="tscroll"><table class="log"><thead><tr><th>${esc(T('when'))}</th><th>${esc(T('who'))}</th><th>${esc(T('what'))}</th></tr></thead>
        <tbody>${ls.map(logRow).join('')}</tbody></table></div></section>`;
    },
  };
  const rulesTxt = r => T('mSum', { wq: fmt(r.wq * 100, 0), wm: fmt(r.wm * 100, 0), wd: fmt(r.wd * 100, 0), dmax: fmt(r.dmax, 0) });

  /* ---------- Nach dem Rendern ---------- */
  const AFTER = {
    firma(r) {
      if ((r.tab || 'treffer') === 'treffer' && S.sel) {
        API.markSeen(S.sel);
        if (r.arg && matchMedia('(max-width: 899px)').matches) $('#detail')?.scrollIntoView({ block: 'start' });
      }
    },
    verwaltung(r) {
      if (r.tab === 'regeln') { const f = app.querySelector('[data-form="rules"]'), upd = () => { const s = ['wq', 'wm', 'wd'].reduce((a, k) => a + (+f[k].value || 0), 0); $('#wSum').textContent = T('wSum', { s }); $('#wSum').classList.toggle('warn-t', s !== 100); }; f.addEventListener('input', upd); upd(); }
      if (r.tab === 'firmen') { const i = $('#firmQ'); i.addEventListener('input', () => { S.firmQ = i.value; const q = i.value.trim().toLowerCase(); app.querySelectorAll('[data-q]').forEach(li => { li.hidden = !!q && !li.dataset.q.includes(q); }); }); }
    },
  };

  /* ---------- Dialoge ---------- */
  const dlg = $('#dlg');
  function openDlg(html, onSubmit) {
    dlg.innerHTML = html;
    dlg.querySelector('form')?.addEventListener('submit', async e => { e.preventDefault(); const ok = await onSubmit(e.target, e.submitter); if (ok) dlg.close(); });
    dlg.showModal();
  }
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });

  function itemForm(x) {
    x = x || { kind: 'o', poly: 'PP', form: Object.keys(D.forms)[0], q: 'natur', t: 1, status: 'active', until: Date.now() + 90 * 864e5 };
    const multi = x.kind === 'n', sel = (v, k) => arr(v).includes(k);
    const group = (name, keys, val, lab) => `<fieldset><legend>${esc(T(lab))}</legend><div class="opts">${keys.map(k => `<label class="opt"><input type="${multi ? 'checkbox' : 'radio'}" name="${name}" value="${esc(k)}"${sel(val, k) ? ' checked' : ''}>${esc(name === 'poly' ? k : L((name === 'form' ? D.forms : D.quality)[k]))}</label>`).join('')}</div></fieldset>`;
    return `<form method="dialog" class="stack" novalidate><h2>${esc(T(x.id ? 'editItem' : 'newItem'))}</h2>
      <input type="hidden" name="id" value="${esc(x.id || '')}">
      <fieldset><legend>${esc(T('kindLabel'))}</legend><div class="opts">${['o', 'n'].map(k => `<label class="opt"><input type="radio" name="kind" value="${k}"${x.kind === k ? ' checked' : ''} data-kind>${esc(T('kind.' + k))}</label>`).join('')}</div></fieldset>
      ${multi ? `<p class="note">${esc(T('multiHint'))}</p>` : ''}
      ${group('poly', Object.keys(D.poly), x.poly, 'poly')}${group('form', Object.keys(D.forms), multi ? x.forms : x.form, 'form')}${group('q', Object.keys(D.quality), x.q, 'quality')}
      <div class="irow2"><label class="fld"><span>${esc(T('tons'))}</span><input class="inp" type="number" name="t" min="0.1" max="10000" step="0.1" value="${esc(x.t)}" inputmode="decimal"></label>
        <label class="fld"><span>${esc(T('until'))}</span><input class="inp" type="date" name="until" value="${isoDay(x.until)}"></label>
        <label class="fld"><span>${esc(T('status'))}</span><select class="inp" name="status">${['active', 'draft', 'paused'].map(s => `<option value="${s}"${x.status === s ? ' selected' : ''}>${esc(T('st.' + s))}</option>`).join('')}</select></label></div>
      <label class="fld"><span>${esc(T('note'))}</span><input class="inp" name="note" maxlength="120" value="${esc(L(x.note))}"></label>
      <p class="err" role="alert" hidden></p>
      <div class="row end"><button type="button" class="btn" data-close>${esc(T('cancel'))}</button><button class="btn pri" type="submit" value="save">${esc(T('save'))}</button></div></form>`;
  }
  function editItem(x) {
    openDlg(itemForm(x), async (f, btn) => {
      const v = n => [...f.querySelectorAll(`[name="${n}"]:checked`)].map(i => i.value), kind = v('kind')[0], multi = kind === 'n';
      const data = { id: f.id.value || undefined, kind, poly: multi ? v('poly') : v('poly')[0], q: multi ? v('q') : v('q')[0], t: f.t.value, status: f.status.value, note: f.note.value.trim(),
        until: f.until.value ? new Date(f.until.value + 'T23:59:59').getTime() : NaN };
      if (multi) data.forms = v('form'); else data.form = v('form')[0];
      btn.disabled = true;
      try { await API.saveItem(data); toast(T('saved')); render(); return true; }
      catch (e) { const p = f.querySelector('.err'); p.textContent = errText(e); p.hidden = false; return false; }
      finally { btn.disabled = false; }
    });
    // Art wechseln: Formular mit Mehrfachauswahl (Bedarf) bzw. Einzelauswahl (Angebot) neu aufbauen, Werte behalten
    dlg.querySelectorAll('[data-kind]').forEach(r => r.addEventListener('change', () => {
      const f = dlg.querySelector('form'), v = n => [...f.querySelectorAll(`[name="${n}"]:checked`)].map(i => i.value), k = r.value;
      const keep = { id: f.id.value, kind: k, t: f.t.value, status: f.status.value, note: f.note.value, until: new Date(f.until.value || Date.now()).getTime() };
      Object.assign(keep, k === 'n' ? { poly: v('poly'), forms: v('form'), q: v('q') } : { poly: v('poly')[0], form: v('form')[0], q: v('q')[0] });
      dlg.close(); editItem(keep); dlg.querySelector(`[data-kind][value="${k}"]`).focus();
    }));
  }

  /* ---------- Aktionen ---------- */
  const ACT = {
    logout: b => run(b, async () => { await API.logout(); S.mail = null; go('anmelden'); }),
    demo: b => run(b, async () => { await API.loginPasskey(b.dataset.person); go(...home(await API.me()).split('/')); }),
    reset: b => run(b, async () => { await API.reset(); Object.assign(S, { mail: null, reg: null, regMode: false }); toast(T('resetDone')); render(); }),
    regMode: () => { S.regMode = true; render().then(() => $('#mailIn')?.focus()); },
    passkey: b => run(b, async () => {
      const ks = await API.passkeys();
      openDlg(`<form method="dialog" class="stack"><h2>${ico('key')}${esc(T('pkTitle'))}</h2><p>${esc(T('pkLead'))}</p>
        <div class="dlist">${ks.map(k => `<button type="submit" class="dacc" value="${esc(k.id)}"><b>${esc(k.name)}</b><span>${esc(k.email)} · ${esc(k.firm || T('roles.platform'))}</span>${ico('arrow')}</button>`).join('')}</div>
        <div class="row end"><button type="button" class="btn" data-close>${esc(T('cancel'))}</button></div></form>`,
      async (f, sub) => { const ok = await run(sub, () => API.loginPasskey(sub.value)); if (ok) { dlg.close(); go(...home(ok).split('/')); } return !!ok; });
    }),
    openLink: b => run(b, async () => {
      const res = await API.openLink(S.mail.token);
      S.mail = null;
      if (res.session) { go(...home(res.session).split('/')); return; }
      S.reg = res.register; go('registrieren');
    }),
    send: b => run(b, async () => { await API.sendRequest(b.dataset.key); toast(T('sent')); render(); }),
    dismiss: b => run(b, async () => { await API.dismiss(b.dataset.key); toast(T('dismissed')); go('firma', 'treffer'); }),
    report: b => openDlg(`<form method="dialog" class="stack"><h2>${esc(T('reportBtn'))}</h2><label for="repR">${esc(T('reportAsk'))}</label>
        <input id="repR" class="inp" name="reason" maxlength="200" placeholder="${esc(T('reportPh'))}" required><p class="err" role="alert" hidden></p>
        <div class="row end"><button type="button" class="btn" data-close>${esc(T('cancel'))}</button><button class="btn pri" type="submit">${esc(T('reportSend'))}</button></div></form>`,
      async (f, sub) => { sub.disabled = true; try { await API.report(b.dataset.item, f.reason.value); toast(T('reported')); return true; } catch (e) { const p = f.querySelector('.err'); p.textContent = errText(e); p.hidden = false; return false; } finally { sub.disabled = false; } }),
    newItem: () => editItem(null),
    editItem: b => run(b, async () => { const x = (await API.myItems()).find(y => y.id === b.dataset.id); if (x) editItem(x); }),
    delItem: b => { if (confirm(T('delAsk', { x: b.dataset.label }))) run(b, async () => { await API.deleteItem(b.dataset.id); toast(T('deleted')); render(); }); },
    answer: b => run(b, async () => { const yes = !!b.dataset.yes; await API.answer(b.dataset.id, yes); toast(T(yes ? 'accepted' : 'declinedT')); render(); }),
    removeMember: b => run(b, async () => { await API.removeMember(b.dataset.id); toast(T('removed')); render(); }),
    review: b => run(b, async () => { await API.reviewFirm(b.dataset.id, b.dataset.do); toast(T('saved')); render(); }),
    resolve: b => run(b, async () => { await API.resolveReport(b.dataset.id, b.dataset.do); toast(T('saved')); render(); }),
    moderate: b => run(b, async () => { await API.moderateItem(b.dataset.id, !!b.dataset.hide); toast(T('saved')); render(); }),
  };
  const FORMS = {
    link: (f, b) => run(b, async () => {
      S.mailDraft = f.email.value;
      const res = await API.requestLink(f.email.value);
      S.mail = res.demoMail; await render();
      app.querySelector('[data-act="openLink"]')?.focus();
    }),
    register: (f, b) => run(b, async () => {
      const me = await API.register(S.reg.ticket, { name: f.name.value, firm: f.firm.value, role: f.querySelector('[name="role"]:checked')?.value, town: f.town.value });
      S.reg = null; S.regMode = false; toast(T('regAfter')); go(...home(me).split('/'));
    }),
    profile: (f, b) => run(b, async () => { await API.updateFirm({ desc: f.desc.value, lang: LANG }); toast(T('saved')); }),
    invite: (f, b) => run(b, async () => { await API.invite(f.email.value, f.role.value); toast(T('invitedT')); render(); }),
    rules: (f, b) => run(b, async () => {
      const r = await API.saveRules({ wq: f.wq.value / 100, wm: f.wm.value / 100, wd: f.wd.value / 100, dmax: f.dmax.value });
      toast(T('saved') + ' · ' + rulesTxt(r));
    }),
  };
  document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && ACT[b.dataset.act]) { e.preventDefault(); ACT[b.dataset.act](b, e); } });
  app.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (f && FORMS[f.dataset.form]) { e.preventDefault(); FORMS[f.dataset.form](f, e.submitter || f.querySelector('[type="submit"]')); } });

  /* ---------- Sprache + Theme (wie die Karte) ---------- */
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
  $$('[data-lang]').forEach(b => b.addEventListener('click', () => { LANG = b.dataset.lang; try { localStorage.setItem('kw-lang', LANG); } catch (e) {} applyStatic(); renderTheme(); render(); }));

  applyStatic(); renderTheme(); render();
})();
