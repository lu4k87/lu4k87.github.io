// Linsenreflex einer hellen Quelle (Sonne): Lichthof und anamorpher Streifen an der Quelle, Geister (Scheiben, Ringe)
// entlang der Achse Quelle–Bildmitte, wie in einer Kamera mit mehreren Linsen. Je Bild: Quelle projizieren, Sichtbarkeit
// aus Bildrand und Verdeckung (Kugeln, z. B. die Erde) bestimmen, Sprites in der Nähe der Nahebene der Kamera ablegen.
// Darstellung, keine Physik des Objekts – deshalb zurückhaltend und im Zahnrad mit „Farbsaum/Linse“ abschaltbar.

import * as THREE from 'three';

function canvasTex(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  draw(g, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const discTex = () => canvasTex((g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.55, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const ringTex = () => canvasTex((g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.78, 'rgba(255,255,255,0.02)'); r.addColorStop(0.9, 'rgba(255,255,255,0.55)');
  r.addColorStop(0.96, 'rgba(255,255,255,0.2)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const streakTex = () => canvasTex((g, s) => {
  const r = g.createLinearGradient(0, 0, s, 0);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.5, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, s * 0.47, s, s * 0.06);
  const v = g.createLinearGradient(0, s * 0.4, 0, s * 0.6);
  v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, s, s);
});
const haloTex = () => canvasTex((g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,0.7)'); r.addColorStop(0.2, 'rgba(255,255,255,0.25)'); r.addColorStop(0.5, 'rgba(255,255,255,0.06)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});

// Geister: k = Lage auf der Achse (1 = Quelle, 0 = Bildmitte, < 0 gegenüber), s = Größe (Anteil der Bildhöhe), Farbe, Stärke
const GHOSTS = [
  { k: 0.62, s: 0.05, c: [1.0, 0.7, 0.45], a: 0.10, t: 'disc' },
  { k: 0.42, s: 0.11, c: [0.55, 0.85, 1.0], a: 0.06, t: 'ring' },
  { k: 0.18, s: 0.03, c: [1.0, 0.85, 0.6], a: 0.16, t: 'disc' },
  { k: -0.15, s: 0.08, c: [0.9, 0.55, 1.0], a: 0.05, t: 'disc' },
  { k: -0.42, s: 0.16, c: [0.45, 0.9, 0.75], a: 0.045, t: 'ring' },
  { k: -0.7, s: 0.05, c: [1.0, 0.6, 0.5], a: 0.07, t: 'disc' },
];

export function createFlare({ strength = 1, tint = [1, 0.92, 0.8] } = {}) {
  const group = new THREE.Group();
  group.renderOrder = 60;
  const tex = { disc: discTex(), ring: ringTex() };
  const mk = (map, c, a) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, color: new THREE.Color(...c), opacity: a }));
    sp.renderOrder = 60;
    group.add(sp);
    return sp;
  };
  const halo = mk(haloTex(), tint, 0.45);
  const streak = mk(streakTex(), [tint[0] * 0.8, tint[1] * 0.9, 1.0], 0.5);
  const ghosts = GHOSTS.map((g) => mk(tex[g.t], g.c, g.a));
  const ndc = new THREE.Vector3(), tmp = new THREE.Vector3(), dir = new THREE.Vector3();
  const place = (sp, x, y, size, camera, vis) => {
    // Richtung durch den Bildpunkt (x, y) in NDC, Sprite in 3 Nahebenen-Abständen vor der Kamera
    tmp.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
    const d = camera.near * 3;
    sp.position.copy(camera.position).addScaledVector(tmp, d);
    const h = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    sp.scale.set(size * h * (sp === streak ? 7 : 1), size * h, 1);
    sp.material.opacity = sp.userData.a * vis;
    sp.visible = vis > 0.002;
  };
  halo.userData.a = 0.45; streak.userData.a = 0.5;
  ghosts.forEach((sp, i) => { sp.userData.a = GHOSTS[i].a; });
  const sphereHit = (o, from, to) => {
    // Strecke from→to gegen Kugel o {center, radius}: verdeckt, wenn der Schnitt vor der Quelle liegt
    dir.copy(to).sub(from);
    const L = dir.length();
    dir.divideScalar(L);
    tmp.copy(from).sub(o.center);
    const b = tmp.dot(dir), c = tmp.dot(tmp) - o.radius * o.radius;
    const h = b * b - c;
    if (h <= 0) return false;
    const t = -b - Math.sqrt(h);
    return t > 0 && t < L;
  };
  let smooth = 0;
  // light: Weltposition der Quelle; occluders: [{center, radius}]; on: Linse laut Einstellungen
  group.userData.update = (light, camera, occluders = [], on = true, dt = 0.016) => {
    ndc.copy(light).project(camera);
    let vis = on && ndc.z < 1 ? 1 : 0;
    if (vis) {
      const m = Math.max(Math.abs(ndc.x), Math.abs(ndc.y));
      vis *= 1 - THREE.MathUtils.smoothstep(m, 0.85, 1.25);
      for (const o of occluders) if (sphereHit(o, camera.position, light)) { vis = 0; break; }
    }
    smooth += (vis - smooth) * Math.min(1, dt * 8);
    const v = smooth * strength;
    if (v < 0.002) { group.visible = false; return; }
    group.visible = true;
    // Streifen und Hof an der Quelle, Geister entlang der Achse zur Mitte (Größe als Anteil der Bildhöhe)
    place(halo, ndc.x, ndc.y, 0.9, camera, v);
    place(streak, ndc.x, ndc.y, 0.12, camera, v * 0.8);
    ghosts.forEach((sp, i) => { const g = GHOSTS[i]; place(sp, ndc.x * g.k, ndc.y * g.k, g.s, camera, v * (1 - 0.5 * Math.abs(g.k))); });
  };
  return group;
}
