// B6/S6: three.js liegt lokal unter docs/vendor/three/ (three@0.186.0, MIT) –
// kein CDN-Code im Ursprung des UX | Nexus Launcher (/ws/docs/…).
// Die Seite traegt ihre Import-Map als <script type="application/json" id="three-importmap">
// (explizite Pfade, damit publish_pages.py die Dateien findet); dieses klassische
// Skript macht daraus die echte Import-Map, direkt hinter sich, vor jedem Modul.
// Nur unter file:// laedt Chrome keine lokalen Module (CORS) → dort dieselbe
// Version vom CDN; eine file://-Seite hat keinen Ursprung, den CDN-Code missbrauchen koennte.
(() => {
  const CDN = 'https://cdn.jsdelivr.net/npm/three@0.186.0/';   // = Version der lokalen Kopie
  const map = JSON.parse(document.getElementById('three-importmap').textContent);
  if (location.protocol === 'file:') {
    for (const k of Object.keys(map.imports)) map.imports[k] = map.imports[k].replace(/^.*vendor\/three\//, CDN);
  }
  const s = document.createElement('script');
  s.type = 'importmap';
  s.textContent = JSON.stringify(map);
  document.currentScript.after(s);
})();
