/* Echte Grundkarte unter den SVG-Karten von app.js: MapLibre + PMTiles (OSM, Protomaps) + Grenzen BKG VG250.
   Plattform: Ebenen Deutschland → Land → Kreis → Gemeinde (Pfadleiste + Zurück); Lagebild und Szenarien fest auf der Region.
   Daten in geo/ (Herkunft und Befehle: geo/QUELLEN.md); pmtiles.js kommt als <script> aus index.html (globales pmtiles). */
import * as ml from './vendor/maplibre-gl.mjs';

const root = document.documentElement;
const ATTR = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a> · © GeoBasis-DE / BKG (2026)';
const REGION_Z = 8.5;   // ab hier region.pmtiles (bis Zoom 14) nachladen und Firmen zeigen

/* Farben aus den Tokens von kreiswerts.css (hell/dunkel) */
const css = n => getComputedStyle(root).getPropertyValue(n).trim();
const hex = c => { const m = c.replace('#', ''); return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16)); };
const mix = (a, b, p) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v * p + B[i] * (1 - p)).toString(16).padStart(2, '0')).join(''); };
function colors() {
  const ink = css('--ink'), land = css('--m-land'), surf = css('--surface');
  return { ink, land: mix(ink, land, .03), settle: mix(ink, land, .09), forest: mix(css('--ok'), land, .16), water: css('--m-water'),
    minorCase: mix(ink, land, .18), minor: surf, roadCase: mix(ink, land, .26), road: mix(surf, css('--line'), .7), rail: mix(ink, land, .38),
    border: mix(ink, land, .45), ink2: css('--ink-2'), accent: css('--accent'), line2: css('--line-2') };
}

/* Daten: ganze PMTiles-Datei laden (python http.server kann keine Byte-Bereiche), einmal je Seite für alle Karten */
const protocol = new pmtiles.Protocol();
ml.addProtocol('pmtiles', protocol.tile);
const once = {};
const memo = (k, fn) => once[k] || (once[k] = fn());
const tiles = name => memo('t:' + name, async () => {
  const r = await fetch(`geo/${name}.pmtiles`);
  if (!r.ok) throw new Error(`geo/${name}.pmtiles: ${r.status}`);
  const p = new pmtiles.PMTiles(new pmtiles.FileSource(new File([await r.arrayBuffer()], name)));
  protocol.add(p);
  const h = await p.getHeader();
  return { type: 'vector', url: `pmtiles://${name}`, bounds: [h.minLon, h.minLat, h.maxLon, h.maxLat], attribution: ATTR };
});
const json = f => memo('j:' + f, () => fetch(`geo/grenzen/${f}.json`).then(r => { if (!r.ok) throw new Error(`geo/grenzen/${f}.json: ${r.status}`); return r.json(); }));
const EMPTY = { type: 'FeatureCollection', features: [] };

/* Stil: Grundkarte je Quelle (de bis Zoom 8, region ab REGION_Z) */
function base(s, c, minz) {
  const L = (id, o) => ({ id: `${s}-${id}`, source: s, ...(minz ? { minzoom: minz } : {}), ...o });
  const w = (a, b) => ['interpolate', ['exponential', 1.6], ['zoom'], 6, a, 15, b];
  const kind = (...k) => ['in', ['get', 'kind'], ['literal', k]];
  return [
    L('earth', { type: 'fill', 'source-layer': 'earth', paint: { 'fill-color': c.land } }),
    L('settle', { type: 'fill', 'source-layer': 'landuse', filter: kind('residential', 'industrial', 'commercial', 'retail', 'railway'), paint: { 'fill-color': c.settle } }),
    L('urban', { type: 'fill', 'source-layer': 'landcover', filter: kind('urban_area'), paint: { 'fill-color': c.settle } }),
    L('forest', { type: 'fill', 'source-layer': 'landuse', filter: kind('wood', 'forest', 'nature_reserve'), paint: { 'fill-color': c.forest } }),
    L('forest2', { type: 'fill', 'source-layer': 'landcover', filter: kind('forest'), paint: { 'fill-color': c.forest } }),
    L('water', { type: 'fill', 'source-layer': 'water', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': c.water } }),
    L('river', { type: 'line', 'source-layer': 'water', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': c.water, 'line-width': w(.6, 3) } }),
    L('minor-case', { type: 'line', 'source-layer': 'roads', minzoom: 11, filter: kind('minor_road'), layout: { 'line-cap': 'round' }, paint: { 'line-color': c.minorCase, 'line-width': w(.5, 7) } }),
    L('minor', { type: 'line', 'source-layer': 'roads', minzoom: 11, filter: kind('minor_road'), layout: { 'line-cap': 'round' }, paint: { 'line-color': c.minor, 'line-width': w(.3, 5) } }),
    L('rail', { type: 'line', 'source-layer': 'roads', minzoom: 9, filter: kind('rail'), paint: { 'line-color': c.rail, 'line-width': 1.2, 'line-dasharray': [4, 2] } }),
    L('road-case', { type: 'line', 'source-layer': 'roads', filter: kind('highway', 'major_road', 'medium_road'), layout: { 'line-cap': 'round' }, paint: { 'line-color': c.roadCase, 'line-width': w(1.2, 12) } }),
    L('road', { type: 'line', 'source-layer': 'roads', filter: kind('highway', 'major_road', 'medium_road'), layout: { 'line-cap': 'round' }, paint: { 'line-color': c.road, 'line-width': w(.6, 9) } }),
  ];
}
function labels(s, c, o) {
  return { id: `${s}-places`, type: 'symbol', source: s, 'source-layer': 'places', ...o,
    layout: { 'text-field': ['coalesce', ['get', 'name:de'], ['get', 'name']], 'text-font': ['Noto Sans Medium'], 'text-size': ['case', ['==', ['get', 'kind'], 'locality'], 13, 11] },
    paint: { 'text-color': c.ink2, 'text-halo-color': c.land, 'text-halo-width': 1.6 } };
}
// Flächen der Ebenen: Nachbarn der Auswahl abgeblendet; unter dem Zeiger getönt bzw. aufgehellt + Umriss (Hover vor dim)
const HOV = ['boolean', ['feature-state', 'hover'], false], DIM = ['boolean', ['feature-state', 'dim'], false];
const levelLayers = c => [
  ...['lan', 'krs', 'gem'].map(s => ({ id: `${s}-fill`, type: 'fill', source: s, paint: {
    'fill-color': ['case', DIM, c.land, c.accent],
    'fill-opacity': ['case', HOV, ['case', DIM, .3, .14], DIM, .62, 0] } })),
  { id: 'gem-line', type: 'line', source: 'gem', paint: { 'line-color': c.line2, 'line-width': 1 } },
  { id: 'krs-line', type: 'line', source: 'krs', paint: { 'line-color': c.line2, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, .4, 9, 1.4] } },
  { id: 'lan-line', type: 'line', source: 'lan', paint: { 'line-color': c.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 9, 2.4] } },
  ...['lan', 'krs', 'gem'].map(s => ({ id: `${s}-hover`, type: 'line', source: s, paint: { 'line-color': c.accent, 'line-width': 1.6, 'line-opacity': ['case', HOV, 1, 0] } })),
  { id: 'sel-line', type: 'line', source: 'lan', filter: ['==', ['get', 'AGS'], '-'], paint: { 'line-color': c.accent, 'line-width': 2.6 } },
];
// Namen der Länder und Kreise: ein Punkt je Fläche (mapshaper -points inner), sonst je Kachel doppelt; zuletzt im Stil = Vorrang vor Ortsnamen
const nameLayers = c => [
  { id: 'krs-name', type: 'symbol', source: 'krs-n', minzoom: 6, layout: { visibility: 'none', 'text-field': ['get', 'GEN'], 'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-max-width': 8 },
    paint: { 'text-color': c.ink2, 'text-halo-color': c.land, 'text-halo-width': 1.8 } },
  { id: 'lan-name', type: 'symbol', source: 'lan-n', maxzoom: 7.6, layout: { 'text-field': ['get', 'GEN'], 'text-font': ['Noto Sans Medium'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4.5, 12, 7, 15],
    'text-transform': 'uppercase', 'text-letter-spacing': .08, 'text-max-width': 9 }, paint: { 'text-color': c.ink, 'text-halo-color': c.land, 'text-halo-width': 2 } },
];

function bbox(fs) {
  const b = [180, 90, -180, -90], walk = a => typeof a[0] === 'number' ? (b[0] = Math.min(b[0], a[0]), b[1] = Math.min(b[1], a[1]), b[2] = Math.max(b[2], a[0]), b[3] = Math.max(b[3], a[1])) : a.forEach(walk);
  fs.forEach(f => walk(f.geometry.coordinates));
  return [[b[0], b[1]], [b[2], b[3]]];
}
const label = p => p.BEZ && !/Stadt|Gemeinde/.test(p.BEZ) ? `${p.BEZ} ${p.GEN}` : p.GEN;

/* o: { bounds:[[w,s],[e,n]], levels: { start:[AGS…], nav, hint, tile }, T, RM, onMove }
   Rückgabe: { project(lat,lon) → [x,y] px, far(), zoom(), fit(bounds, fly), restyle(), relabel() } */
export async function create(el, o) {
  const T = o.T, levels = !!o.levels;
  const [de, LAN, KRS, LAN_N, KRS_N] = await Promise.all([tiles('de'), ...['laender', 'kreise', 'laender-namen', 'kreise-namen'].map(f => levels && json(f))]);
  const GEM = {};
  const gem = async land => GEM[land] || (GEM[land] = await json(land));
  const st = { path: [{}], hover: null, region: null };
  const lvl = () => st.path.length - 1;

  function style() {
    const c = colors(), rg = st.region && st.region !== 'pending';
    const s = { version: 8, glyphs: 'geo/fonts/{fontstack}/{range}.pbf', sources: { de, ...(rg ? { region: st.region } : {}) },
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': c.land } }, ...base('de', c), ...(rg ? base('region', c, REGION_Z) : [])] };
    if (levels) {
      Object.assign(s.sources, { lan: { type: 'geojson', data: LAN, promoteId: 'AGS' }, krs: { type: 'geojson', data: KRS, promoteId: 'AGS' },
        gem: { type: 'geojson', data: GEM[st.path[1]?.ags] || EMPTY, promoteId: 'AGS' }, 'lan-n': { type: 'geojson', data: LAN_N }, 'krs-n': { type: 'geojson', data: KRS_N } });
      s.layers.push(...levelLayers(c));
    }
    // Ortsnamen zuletzt, damit abgeblendete Nachbarflächen sie nicht verdecken
    if (rg) s.layers.push(labels('region', c, { minzoom: 9, filter: ['in', ['get', 'kind'], ['literal', ['locality', 'neighbourhood']]] }));
    s.layers.push(labels('de', c, { maxzoom: 9, filter: ['all', ['==', ['get', 'kind'], 'locality'], ['<=', ['get', 'min_zoom'], ['+', ['zoom'], .5]]] }));
    if (levels) s.layers.push(...nameLayers(c));
    return s;
  }

  const map = new ml.Map({ container: el, style: style(), bounds: o.bounds, fitBoundsOptions: { padding: 12 }, attributionControl: false,
    interactive: levels, minZoom: 4.5, maxZoom: 15, dragRotate: false, pitchWithRotate: false, touchPitch: false,
    cooperativeGestures: levels && matchMedia('(pointer: coarse)').matches, fadeDuration: o.RM ? 0 : 300,   // Maus: Rad zoomt ohne Strg; Touch: zwei Finger, sonst hängt das Seiten-Scrollen
    locale: { 'CooperativeGesturesHandler.MobileHelpText': T('geoCoopTouch'), 'NavigationControl.ZoomIn': T('geoZoomIn'), 'NavigationControl.ZoomOut': T('geoZoomOut') } });
  map.addControl(new ml.AttributionControl({ compact: false }), 'bottom-right');
  map.addControl(new ml.ScaleControl({ unit: 'metric' }), 'bottom-left');
  if (levels) { map.touchZoomRotate.disableRotation(); map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right'); }

  // Region erst laden, wenn eine Karte so weit hineinzoomt (Lagebild + Szenarien: sofort, Plattform: ab Kreis)
  const wantRegion = () => {
    if (st.region || map.getZoom() < REGION_Z - 1) return;
    st.region = 'pending';
    tiles('region').then(src => { st.region = src; map.setStyle(style()); map.once('styledata', paintStates); }).catch(e => { st.region = null; console.warn(e); });
  };
  map.on('zoomend', wantRegion);
  const moved = () => o.onMove && o.onMove();
  map.on('move', moved); map.on('resize', moved);

  /* Ebenen (nur Plattform): path[0] Deutschland, [1] Land (AGS 2), [2] Kreis (AGS 5), [3] Gemeinde (AGS 8) */
  const SRC = ['lan', 'krs', 'gem'];
  const feats = s => (s === 'lan' ? LAN : s === 'krs' ? KRS : GEM[st.path[1]?.ags] || EMPTY).features;
  function paintStates() {
    if (!levels || !map.getSource('lan')) return;
    const i = lvl(), dimSrc = SRC[i - 1], selAgs = st.path[i]?.ags;
    SRC.forEach(s => map.removeFeatureState({ source: s }));
    if (dimSrc) feats(dimSrc).forEach(f => { if (f.properties.AGS !== selAgs) map.setFeatureState({ source: dimSrc, id: f.properties.AGS }, { dim: true }); });
    const show = (id, on, filter) => { map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); map.setFilter(id, filter); };
    show('krs-line', i >= 1, ['==', ['slice', ['get', 'AGS'], 0, 2], st.path[1]?.ags || '']);
    show('gem-line', i >= 2, ['==', ['slice', ['get', 'AGS'], 0, 5], st.path[2]?.ags || '']);
    show('krs-name', i === 1, ['==', ['slice', ['get', 'AGS'], 0, 2], st.path[1]?.ags || '']);   // Kreisnamen nur auf Ebene Land
    const c = colors();
    map.removeLayer('sel-line');
    map.addLayer({ id: 'sel-line', type: 'line', source: SRC[Math.max(0, i - 1)], filter: ['==', ['get', 'AGS'], i ? selAgs : '-'],
      paint: { 'line-color': c.accent, 'line-width': 2.6 } }, 'de-places');
  }
  const pad = () => { const w = el.clientWidth; return w < 520 ? { top: 96, bottom: 36, left: 12, right: 12 } : { top: 72, bottom: 40, left: 30, right: 56 }; };
  async function go(path, fly = true, view) {
    st.path = path;
    const i = lvl();
    if (i >= 1) { await gem(path[1].ags); map.getSource('gem').setData(GEM[path[1].ags]); }
    const target = i === 0 ? LAN.features : feats(SRC[i - 1]).filter(f => f.properties.AGS === path[i].ags);
    map.fitBounds(view || bbox(target), { padding: pad(), duration: fly && !o.RM ? 900 : 0, maxZoom: 13 });
    paintStates(); relabel();
  }
  function hit(e) {
    // Klick in die Auswahl → nächste Ebene; Klick daneben → Nachbar auf derselben Ebene
    const i = lvl(), inner = map.queryRenderedFeatures(e.point, { layers: [`${SRC[Math.min(i, 2)]}-fill`] }).find(f => i === 0 || f.properties.AGS.startsWith(st.path[i].ags));
    if (inner && i < 3) return { f: inner, path: [...st.path, { ags: inner.properties.AGS, name: label(inner.properties) }] };
    if (i === 0) return null;
    const sib = map.queryRenderedFeatures(e.point, { layers: [`${SRC[i - 1]}-fill`] }).find(f => f.properties.AGS !== st.path[i].ags && (i === 1 || f.properties.AGS.startsWith(st.path[i - 1].ags)));
    return sib ? { f: sib, path: [...st.path.slice(0, i), { ags: sib.properties.AGS, name: label(sib.properties) }] } : null;
  }
  const L = o.levels || {};
  const hintText = () => T('geoPick')[lvl()];
  const nameOf = k => k ? st.path[k].name : T('geoDE');
  function relabel() {
    if (!levels) return;
    const i = lvl(), esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    L.nav.setAttribute('aria-label', T('geoNav'));
    L.nav.innerHTML = (i ? `<button type="button" class="geo-back" data-up="${i - 1}" aria-label="${esc(T('geoBack', { x: nameOf(i - 1) }))}">‹ ${esc(nameOf(i - 1))}</button>` : '')
      + `<div class="geo-title"><small>${T('geoLvl')[i]}</small><ol class="geo-crumbs">${st.path.map((p, k) => `<li>${k < i ? `<button type="button" data-up="${k}">${esc(nameOf(k))}</button>` : `<b aria-current="location">${esc(nameOf(k))}</b>`}</li>`).join('')}</ol></div>`;
    L.hint.textContent = hintText();
  }
  if (levels) {
    map.on('mousemove', e => {
      const h = hit(e), id = h ? { source: h.f.source, id: h.f.properties.AGS } : null;
      if (st.hover && (!id || st.hover.id !== id.id)) map.setFeatureState(st.hover, { hover: false });
      if (id) map.setFeatureState(id, { hover: true });
      st.hover = id; map.getCanvas().style.cursor = h ? 'pointer' : '';
      L.hint.textContent = h ? T('geoClick', { x: h.path.at(-1).name }) : hintText();
    });
    map.on('mouseout', () => { if (st.hover) map.setFeatureState(st.hover, { hover: false }); st.hover = null; L.hint.textContent = hintText(); });
    map.on('click', e => { const h = hit(e); if (h) go(h.path); });
    L.nav.addEventListener('click', e => { const up = e.target.closest('[data-up]'); if (up) go(st.path.slice(0, +up.dataset.up + 1)); });
    L.tile.addEventListener('keydown', e => { if (e.key === 'Escape' && lvl()) { e.preventDefault(); go(st.path.slice(0, -1)); } });
  }

  await new Promise(r => map.once('load', r));
  if (levels) {
    const path = [{}];
    for (const ags of L.start || []) {
      if (ags.length > 2) await gem(ags.slice(0, 2));
      const src = ags.length === 2 ? LAN : ags.length === 5 ? KRS : GEM[ags.slice(0, 2)];
      path.push({ ags, name: label(src.features.find(f => f.properties.AGS === ags).properties) });
    }
    await go(path, false, o.bounds);   // Start: Ebene Kreis, Ausschnitt um die Firmen
  }
  wantRegion();
  map.once('idle', () => { el.dataset.ready = '1'; });
  return {
    map,
    project: (lat, lon) => { const p = map.project([lon, lat]); return [p.x, p.y]; },
    far: () => map.getZoom() < REGION_Z,
    zoom: () => map.getZoom(),
    fit: (b, fly) => map.fitBounds(b, { padding: 12, duration: fly && !o.RM ? 800 : 0 }),
    restyle: () => { map.setStyle(style()); map.once('styledata', paintStates); },
    relabel,
  };
}
