// Geometrie-Kit: RoundedBox/Capsule mit Cache, Standard-Materialien (roughness 0,85, metalness 0; Obsidian metallisch),
// Sprite-Schilder, Canvas-Tafeln, weicher Blob-Schatten unter Figuren, Glow-Scheibe.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI;
// Geteilte Ressourcen (Caches, GEO): disposeTree() gibt sie nie frei; WeakSet statt userData, damit clone() die Marke nicht erbt
const SHARED = new WeakSet();
export const share = x => (SHARED.add(x), x);
// Entfernte Figur/Schild freigeben: eigene Geometrien, Materialien, Texturen – geteilte bleiben (Sprite-Geometrie gehört three.js)
export function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry && !o.isSprite && !SHARED.has(o.geometry)) o.geometry.dispose();
    [].concat(o.material || []).forEach(m => { if (SHARED.has(m)) return; if (m.map && !SHARED.has(m.map)) m.map.dispose(); m.dispose(); });
  });
}
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 24), cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  sph: new THREE.SphereGeometry(0.5, 24, 16), ico: new THREE.IcosahedronGeometry(0.5, 0), cone: new THREE.ConeGeometry(0.5, 1, 24),
  tor: new THREE.TorusGeometry(0.5, 0.08, 10, 32), plane: new THREE.PlaneGeometry(1, 1), half: new THREE.SphereGeometry(0.5, 24, 12, 0, PI * 2, 0, PI / 2),
  disc: new THREE.CircleGeometry(0.5, 32),
};
Object.values(GEO).forEach(share);

function radialTex(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(0.55, inner.replace(/[\d.]+\)$/, '.45)')); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t;
}

export function makeKit(L, renderer) {
  const cache = new Map(), rb = new Map();
  const rbox = (w, h, d) => {
    const key = w.toFixed(3) + '|' + h.toFixed(3) + '|' + d.toFixed(3); if (rb.has(key)) return rb.get(key);
    const r = Math.min(0.06, Math.min(w, h, d) * 0.45); const g = share(new RoundedBoxGeometry(w, h, d, 2, r)); rb.set(key, g); return g;
  };
  const m = (color, o = {}) => {
    const key = color + '|' + (o.emissive || '') + '|' + (o.opacity ?? 1) + '|' + (o.basic ? 'b' : '') + '|' + (o.metal ?? '') + '|' + (o.rough ?? '');
    if (cache.has(key)) return cache.get(key);
    let mat;
    if (o.basic) mat = new THREE.MeshBasicMaterial({ color });
    else mat = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? L.rough ?? 0.85, metalness: o.metal ?? L.metal ?? 0, emissive: o.emissive ? new THREE.Color(o.emissive) : 0x000000, emissiveIntensity: o.emissive ? (o.glow ?? (L.dark ? 2.6 : 1.8)) : 0 });
    if (o.opacity != null && o.opacity < 1) { mat.transparent = true; mat.opacity = o.opacity; mat.depthWrite = false; }
    mat.userData.src = color; cache.set(key, share(mat)); return mat;
  };
  const glowTex = share(radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
  const blobTex = share(radialTex('rgba(0,0,0,.95)', 'rgba(0,0,0,0)'));
  const aniso = renderer.capabilities.getMaxAnisotropy();
  function add(parent, geo, color, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, o = {}) {
    let mesh;
    if (geo === 'box') { mesh = new THREE.Mesh(rbox(sx, sy, sz), o.mat || m(color, o)); }
    else { mesh = new THREE.Mesh(GEO[geo] || geo, o.mat || m(color, o)); mesh.scale.set(sx, sy, sz); }
    mesh.position.set(x, y, z); mesh.rotation.y = ry;
    if (!o.noShadow) { mesh.castShadow = true; mesh.receiveShadow = true; }
    parent.add(mesh); return mesh;
  }
  // Text-Schild als Sprite (Layer 1 → nicht in der Kantenerkennung)
  function label(lines, o = {}) {
    const s = 2, pad = (o.pad ?? 14) * s, font = o.font || L.font;
    const c = document.createElement('canvas'), x = c.getContext('2d');
    const rows = lines.map(l => typeof l === 'string' ? { t: l } : l);
    let W = 0, H = pad * 2;
    rows.forEach(r => { r.px = (r.size || 26) * s; x.font = `${r.weight || 600} ${r.px}px ${r.mono ? L.mono : font}`; r.w = x.measureText(r.t).width; W = Math.max(W, r.w); H += r.px * 1.25; });
    c.width = Math.ceil(W + pad * 2); c.height = Math.ceil(H);
    const bg = o.bg ?? L.label.bg, br = o.border ?? L.label.border;
    if (bg !== 'none') {
      x.fillStyle = bg; const rad = (o.radius ?? 8) * s; x.beginPath(); x.roundRect(s, s, c.width - 2 * s, c.height - 2 * s, rad); x.fill();
      if (br) { x.lineWidth = (o.bw ?? 2) * s; x.strokeStyle = br; x.stroke(); }
    }
    let y = pad;
    rows.forEach(r => { x.font = `${r.weight || 600} ${r.px}px ${r.mono ? L.mono : font}`; x.fillStyle = r.color || o.fg || L.label.fg; x.textBaseline = 'top'; x.textAlign = o.align === 'left' ? 'left' : 'center'; x.fillText(r.t, o.align === 'left' ? pad : c.width / 2, y + r.px * 0.1); y += r.px * 1.25; });
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: o.depthTest ?? true });
    const sp = new THREE.Sprite(mat); const h = o.h || 0.5; sp.scale.set(h * c.width / c.height, h, 1); sp.layers.set(1);
    sp.userData.h = h; sp.userData.aspect = c.width / c.height; sp.renderOrder = o.order ?? 5;
    return sp;
  }
  // flache Tafel mit Canvas-Inhalt (Bildschirme, Wandtafeln); draw(ctx, W, H) – neu zeichnen per redraw()
  function panel(parent, w, h, draw, x, y, z, ry = 0, px = 256) {
    const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * h / w); draw(c.getContext('2d'), c.width, c.height);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
    const mesh = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    mesh.scale.set(w, h, 1); mesh.position.set(x, y, z); mesh.rotation.y = ry; parent.add(mesh); mesh.userData.canvas = c;
    mesh.userData.redraw = fn => { (fn || draw)(c.getContext('2d'), c.width, c.height); tex.needsUpdate = true; };
    return mesh;
  }
  // weicher Blob-Schatten unter Figuren (keine harte Schattenkante an den Füßen)
  function blob(parent, r = 0.45, y = 0.012) {
    const mat = new THREE.MeshBasicMaterial({ map: blobTex, color: L.dark ? '#000000' : '#1E2230', transparent: true, opacity: L.dark ? 0.5 : 0.32, depthWrite: false });
    const p = new THREE.Mesh(GEO.plane, mat); p.rotation.x = -PI / 2; p.position.y = y; p.scale.set(r * 2, r * 2, 1); p.renderOrder = 1; parent.add(p); return p;
  }
  // Glow-Scheibe am Boden (Lampen, Wege)
  function glow(parent, x, y, z, s, col, a) {
    const mat = new THREE.MeshBasicMaterial({ map: glowTex, color: col, transparent: true, opacity: a, depthWrite: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Mesh(GEO.plane, mat); p.rotation.x = -PI / 2; p.position.set(x, y, z); p.scale.set(s, s, 1); p.layers.set(1); parent.add(p); return p;
  }
  return { m, add, label, panel, blob, glow, rbox, glowTex, GEO, cache2: new Map(), V: {}, L };
}
