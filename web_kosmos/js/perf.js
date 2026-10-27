// Leistung auch auf schwachen Rechnern: Startstufe vor dem ersten Bild schätzen, Bildzeit laufend messen (Auto-Qualität,
// Auflösung als letzte Stellschraube), Bilder abseits des Haupt-Threads entpacken, Grafikspeicher ungenutzter Texturen
// freigeben. Kennt keine Stationen – main.js ruft die Bausteine auf.
import * as THREE from 'three';

// Auto-Qualität: first/win = erstes bzw. weiteres Messfenster (s, nur ruhige Bilder), slow = Bildzeit (ms) „zu langsam“,
// fast = „Luft“ für die Auflösung, hold = Pause nach einer Änderung (s; neue Renderziele kosten selbst Bilder),
// step/min = Auflösung je Schritt und Untergrenze, patience = Fenster mit Luft, bevor die Auflösung wieder steigt
export const AUTO = { first: 4, win: 2.5, slow: 40, fast: 20, hold: 4, step: 0.8, min: 0.5, patience: 3 };
const KEY = 'kosmos.autoq.v1';

function gpuName(renderer) {
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  } catch { return ''; }
}

// Startstufe: gemessene Stufe vom letzten Besuch auf derselben Grafikkarte (höchstens `days` alt, danach wird wieder
// gemessen), sonst Schätzung – Software-Rendering, wenig Speicher oder Kerne, kleine Texturgrenze → „Leicht“
// (4k-Erdkarten, beim Start nur eine Station), sonst „Mittel“
export function startQuality(renderer, days = 7) {
  const gpu = gpuName(renderer);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* privates Fenster: nur schätzen */ }
  if (saved && saved.gpu === gpu && [1, 2, 3].includes(saved.q) && Date.now() - saved.at < days * 864e5) {
    return { gpu, q: saved.q, dyn: Math.min(1, Math.max(AUTO.min, +saved.dyn || 1)), saved: true };
  }
  const soft = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu);
  const weak = soft || (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4
    || renderer.capabilities.maxTextureSize < 8192;
  return { gpu, q: weak ? 1 : 2, dyn: soft ? 0.7 : 1, saved: false };
}

// Auto-Qualität je Bild: step(dt, ruhig, Bildratengrenze). Gemessen werden nur ruhige Bilder (kein Flug, kein Film, kein
// Bau einer Station), das langsamste Zehntel zählt nicht (einzelne Hänger). Erste Wahl nach `first` s wie früher (1–3,
// von einer niedrigen Schätzung aus höchstens eine Stufe hinauf), danach nur noch hinab: erst die Stufe, dann die
// Auflösung; die Auflösung kehrt zurück, wenn wieder Luft ist (nach jedem Rückfall mit doppelter Geduld).
// apply(q, dyn) setzt um; gemerkt je Grafikkarte, damit der nächste Besuch gleich richtig startet.
export function createAuto(start, apply) {
  const a = { q: start.q, dyn: start.dyn, first: !start.saved, t: 0, ms: [], hold: 0, slow: 0, fast: 0, patience: AUTO.patience, raised: false };
  const set = (q, dyn) => {
    if (q === a.q && dyn === a.dyn) return;
    a.q = q; a.dyn = dyn; a.hold = AUTO.hold;
    try { localStorage.setItem(KEY, JSON.stringify({ gpu: start.gpu, q, dyn, at: Date.now() })); } catch { /* nicht merkbar */ }
    apply(q, dyn);
  };
  a.step = (dt, calm, cap) => {
    if (a.hold > 0) { a.hold -= dt; return; }
    if (!calm) return;
    a.ms.push(dt * 1000);
    a.t += dt;
    if (a.t < (a.first ? AUTO.first : AUTO.win)) return;
    const s = a.ms.sort((x, y) => x - y).slice(0, Math.max(1, Math.ceil(a.ms.length * 0.9)));
    const ms = s.reduce((x, y) => x + y, 0) / s.length;
    a.ms = []; a.t = 0;
    // gedrosselte Bildrate (Zahnrad „Bildrate“) ist kein „zu langsam“
    const slow = Math.max(AUTO.slow, cap ? 1250 / cap : 0), fast = Math.max(AUTO.fast, cap ? 1100 / cap : 0);
    if (a.first) {
      // wie früher: deutlich zu langsam → Leicht, sehr schnell auf feinem Schirm → Fein; von „Leicht“ mit Luft → Mittel
      a.first = false;
      const q = ms > Math.max(30, cap ? 1150 / cap : 0) ? 1 : ms < 13 && (window.devicePixelRatio || 1) > 1.2 ? 3 : a.q < 2 && ms < fast ? 2 : a.q;
      return set(q, a.dyn);
    }
    a.slow = ms > slow ? a.slow + 1 : 0;
    a.fast = ms < fast ? a.fast + 1 : 0;
    if (a.slow >= 2) {
      a.slow = 0;
      if (a.raised) a.patience *= 2;
      a.raised = false;
      if (a.q > 1) set(a.q - 1, a.dyn);
      else if (a.dyn > AUTO.min) set(1, Math.max(AUTO.min, Math.round(a.dyn * AUTO.step * 100) / 100));
    } else if (a.fast >= a.patience && a.dyn < 1) {
      a.fast = 0;
      a.raised = true;
      set(a.q, Math.min(1, Math.round(a.dyn / AUTO.step * 100) / 100));
    }
  };
  return a;
}

// Bilder abseits des Haupt-Threads entpacken: ein 8k-JPEG als <img> wird erst beim Hochladen entpackt und hält das Bild
// bis ~0,3 s an (Messung 27.10.2026, texSubImage2D). ImageBitmap kommt entpackt und schon gespiegelt an; ohne
// createImageBitmap mit Optionen (ältere Browser) wie bisher über <img>. Zählt im DefaultLoadingManager (Ladebild).
// t.userData.loaded = Promise, erfüllt auch bei Fehler (Station baut dann ohne das Bild weiter, Fehler in der Konsole).
const mgr = THREE.DefaultLoadingManager;
const imgLoader = new THREE.ImageLoader(new THREE.LoadingManager());
let bitmaps = typeof createImageBitmap === 'function' && typeof fetch === 'function';
export function loadTexture(url, srgb, done) {
  const t = new THREE.Texture();
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  const viaImg = () => imgLoader.loadAsync(url);
  const viaBitmap = () => fetch(url)
    .then((r) => { if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { http: true }); return r.blob(); })
    .then((b) => createImageBitmap(b, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: srgb ? 'default' : 'none' }))
    .then((bmp) => { t.flipY = false; return bmp; });
  mgr.itemStart(url);
  t.userData.loaded = (bitmaps ? viaBitmap().catch((err) => { if (err.http) throw err; bitmaps = false; return viaImg(); }) : viaImg())
    .then((img) => { t.image = img; t.needsUpdate = true; done(); }, (err) => { console.error(`[kosmos] Bild ${url}:`, err); mgr.itemError(url); })
    .finally(() => mgr.itemEnd(url));
  return t;
}

// alle Texturen einer Szene (Material-Felder, Uniforms, Hintergrund)
export function sceneTextures(scene, out = new Set()) {
  const add = (v) => { if (v && v.isTexture) out.add(v); };
  add(scene.background);
  add(scene.environment);
  scene.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      for (const v of Object.values(m)) add(v);
      for (const u of Object.values(m.uniforms || {})) [].concat(u.value).forEach(add);
    }
  });
  return out;
}

// Grafikspeicher der Texturen `free` freigeben, die keine der übrigen Stationen (`kept`) zeigt. material.dispose() lässt
// Texturen liegen – die Erdkarten allein belegen bei „Mittel“ ≈ 390 MB. Das Bild bleibt im Objekt, three.js lädt es bei
// Bedarf neu hoch (Vorladen in warmUp). Renderziele und Texturen ohne Bild (auf der GPU gebacken) bleiben unberührt.
// Rückgabe: die freigegebenen Texturen
export function releaseTextures(free, kept) {
  const keep = new Set(), gone = new Set();
  for (const lv of kept) sceneTextures(lv.scene, keep);
  for (const t of free) {
    if (keep.has(t) || t.isRenderTargetTexture || t.isFramebufferTexture || t.isDepthTexture || t.isVideoTexture || !t.image) continue;
    t.dispose();
    gone.add(t);
  }
  return gone;
}
