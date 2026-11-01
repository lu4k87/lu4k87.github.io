/* KreiswertS · Matching-Regel, gemeinsam für die Karte (app.js) und das simulierte Backend (api.js).
   Pflicht = gleiches Polymer, passende Form und Qualität · Wert = Qualität + Menge + Nähe (Luftlinie, ab dmax km null).
   Ein echtes Backend rechnet dieselbe Regel auf dem Server; diese Datei ist dann die Referenz für Tests. */
window.KW_MATCH = (() => {
  'use strict';
  const B = window.KW_DATA.region.box;
  const KX = 111.32 * Math.cos((B.lat0 + B.lat1) / 2 * Math.PI / 180), KY = 111.2;   // km je Grad
  const km = (a, b) => Math.hypot((a.lon - b.lon) * KX, (a.lat - b.lat) * KY);
  // o = Angebot { poly, form, q, t }, n = Bedarf { poly[], forms[], q[], t } · fo/fn = Firmen mit lat/lon
  // view 'offer': Menge = Anteil des Angebots, den der Bedarf aufnimmt · 'need': Anteil des Bedarfs, den das Angebot deckt
  function match(o, n, fo, fn, rules, view = 'offer') {
    if (fo === fn || !n.poly.includes(o.poly) || !n.forms.includes(o.form) || !n.q.includes(o.q)) return null;
    const d = km(fo, fn);
    const qfit = n.q[0] === o.q ? 1 : rules.q2;
    const cover = view === 'offer' ? Math.min(1, n.t / o.t) : Math.min(1, o.t / n.t);
    const near = Math.max(0, 1 - d / rules.dmax);
    const parts = { q: 100 * rules.wq * qfit, m: 100 * rules.wm * cover, d: 100 * rules.wd * near };
    return { o, n, d, qfit, cover, near, parts, score: Math.round(parts.q + parts.m + parts.d) };
  }
  return { KX, KY, km, match };
})();
