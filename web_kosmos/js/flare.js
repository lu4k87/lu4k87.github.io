// Linsenreflex einer hellen Quelle (Sonne): Lichthof und anamorpher Streifen an der Quelle, Geister (Scheiben, Ringe)
// entlang der Achse Quelle–Bildmitte, wie in einer Kamera mit mehreren Linsen.
// Look: Master-Optik (Linse:B) mit spektralem Beugungsring (Chromatische Aberration: Rot/Grün/Blau-Dispersion),
// breitem weißem Innen-Glanzbogen und tiefrotem/magenta Sensor-Ghost auf der optischen Achse;
// umschaltbar auf klassischen Kinofilm-Halo (Linse:A); Zahnrad › Global › Effekte: „Linsenreflex“ schaltet ab,
// „Stärke Linsenreflex“ (`lensAmt`, 0–3×) regelt alle Teile gemeinsam.

import * as THREE from 'three';
import { settings } from './settings.js';

function canvasTex(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
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
// Master-Optik (Linse:B): Haarscharfer Beugungsring mit feinem Regenbogen-Splitting (Rot außen, Grün mittig, Blau/Cyan innen)
const rainbowRingTex = () => canvasTex((g, s) => {
  const cx = s / 2, cy = s / 2, maxR = s / 2;
  const r = g.createRadialGradient(cx, cy, maxR * 0.70, cx, cy, maxR * 0.98);
  r.addColorStop(0.00, 'rgba(255,255,255,0)');
  r.addColorStop(0.60, 'rgba(60,180,255,0.05)');
  r.addColorStop(0.76, 'rgba(40,210,255,0.75)');  // Cyan-Blau innen
  r.addColorStop(0.83, 'rgba(100,245,120,0.85)'); // Grün mittig
  r.addColorStop(0.89, 'rgba(255,210,40,0.90)');  // Gelb
  r.addColorStop(0.94, 'rgba(255,60,20,0.95)');   // Kräftiges Rot außen
  r.addColorStop(0.98, 'rgba(200,20,10,0.15)');
  r.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
}, 512);
// Breiter weißer Innen-Glanzbogen (weicher, sichelförmig intensiver Halbmond-Halo)
const innerArcTex = () => canvasTex((g, s) => {
  const cx = s / 2, cy = s / 2, maxR = s / 2;
  const r = g.createRadialGradient(cx, cy, maxR * 0.35, cx, cy, maxR * 0.85);
  r.addColorStop(0.00, 'rgba(255,255,255,0)');
  r.addColorStop(0.40, 'rgba(255,255,255,0.12)');
  r.addColorStop(0.68, 'rgba(255,255,255,0.85)');
  r.addColorStop(0.82, 'rgba(230,240,255,0.95)');
  r.addColorStop(0.92, 'rgba(200,225,255,0.25)');
  r.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
}, 512);
// Tiefroter / magentafarbener Sensor-Ghost (defokussierte Linsen-/Sensorreflexion)
const magentaGhostTex = () => canvasTex((g, s) => {
  const cx = s / 2, cy = s / 2, maxR = s / 2;
  const r = g.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.95);
  r.addColorStop(0.00, 'rgba(255,40,110,0.92)');
  r.addColorStop(0.35, 'rgba(220,20,90,0.70)');
  r.addColorStop(0.68, 'rgba(170,10,70,0.38)');
  r.addColorStop(0.88, 'rgba(120,5,50,0.12)');
  r.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
}, 256);

const streakTex = () => canvasTex((g, s) => {
  const r = g.createLinearGradient(0, 0, s, 0);
  r.addColorStop(0, 'rgba(51,204,255,0)');
  r.addColorStop(0.2, 'rgba(51,204,255,0.15)');
  r.addColorStop(0.48, 'rgba(160,230,255,0.85)');
  r.addColorStop(0.5, 'rgba(255,255,255,1)');
  r.addColorStop(0.52, 'rgba(160,230,255,0.85)');
  r.addColorStop(0.8, 'rgba(51,204,255,0.15)');
  r.addColorStop(1, 'rgba(51,204,255,0)');
  g.fillStyle = r;
  g.fillRect(0, s * 0.46, s, s * 0.08);
  const v = g.createLinearGradient(0, s * 0.38, 0, s * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,1)');
  v.addColorStop(0.48, 'rgba(0,0,0,0)');
  v.addColorStop(0.52, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = v;
  g.fillRect(0, 0, s, s);
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

// own: Station hat eigene Schalter für Optik und Ghost (Sonne) – die globalen Zeilen im Zahnrad wirken dort nicht
export function createFlare({ strength = 1, tint = [1, 0.92, 0.8], own = false } = {}) {
  const group = new THREE.Group();
  group.renderOrder = 60;
  const tex = {
    disc: discTex(),
    ring: ringTex(),
    rainbow: rainbowRingTex(),
    innerArc: innerArcTex(),
    magenta: magentaGhostTex(),
  };
  const mk = (map, c, a) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, color: new THREE.Color(...c), opacity: a }));
    sp.renderOrder = 60;
    group.add(sp);
    return sp;
  };
  const halo = mk(haloTex(), tint, 0.45);
  const streak = mk(streakTex(), [0.35, 0.85, 1.0], 0.65);
  const ghosts = GHOSTS.map((g) => mk(tex[g.t], g.c, g.a));

  // Master-Optik Komponenten (Linse:B nach Nutzerreferenz)
  const rainbowRing = mk(tex.rainbow, [1, 1, 1], 0.88);
  const innerArc = mk(tex.innerArc, [1, 1, 1], 0.75);
  const magentaGhost = mk(tex.magenta, [1, 0.95, 1], 0.85);

  const ndc = new THREE.Vector3(), tmp = new THREE.Vector3(), dir = new THREE.Vector3();
  const place = (sp, x, y, size, camera, vis, aspect = 1) => {
    tmp.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
    const d = camera.near * 3;
    sp.position.copy(camera.position).addScaledVector(tmp, d);
    const h = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    sp.scale.set(size * h * aspect, size * h, 1);
    sp.material.opacity = sp.userData.a * vis;
    sp.visible = vis > 0.002;
  };
  halo.userData.a = 0.45; streak.userData.a = 0.65;
  ghosts.forEach((sp, i) => { sp.userData.a = GHOSTS[i].a; });
  rainbowRing.userData.a = 0.88;
  innerArc.userData.a = 0.75;
  magentaGhost.userData.a = 0.85;

  let opticMode = 'master'; // 'master' (Linse:B) oder 'classic' (Linse:A)
  let ghostOn = true;
  let ghostMotionOn = true;
  let flareIntensity = 1.0;

  group.userData.setOptic = (mode) => { opticMode = mode === 'classic' ? 'classic' : 'master'; };
  group.userData.setGhost = (on, motion = true) => { ghostOn = Boolean(on); ghostMotionOn = Boolean(motion); };
  group.userData.setIntensity = (val) => { flareIntensity = Math.max(0, val); };

  const sphereHit = (o, from, to) => {
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
  group.userData.update = (light, camera, occluders = [], on = true, dt = 0.016) => {
    ndc.copy(light).project(camera);
    let vis = on && ndc.z < 1 ? 1 : 0;
    if (vis) {
      const m = Math.max(Math.abs(ndc.x), Math.abs(ndc.y));
      vis *= 1 - THREE.MathUtils.smoothstep(m, 0.85, 1.25);
      for (const o of occluders) if (sphereHit(o, camera.position, light)) { vis = 0; break; }
    }
    smooth += (vis - smooth) * Math.min(1, dt * 8);
    const v = smooth * strength * flareIntensity * settings.S.lensAmt;
    if (v < 0.002) { group.visible = false; return; }
    group.visible = true;

    const useMaster = opticMode === 'master' && (own || settings.S.lensOptic !== 'classic');
    const showGhost = ghostOn && (own || settings.S.lensGhost !== false);
    const moveGhost = ghostMotionOn && (own || settings.S.ghostMotion !== false);

    if (useMaster) {
      // Linse:B – Master-Optik nach Nutzerreferenz; bei 1× dezent (User 26.10.2026: viel zu stark), 3× ≈ früherer Look
      place(rainbowRing, ndc.x, ndc.y, 1.15, camera, v * 0.35);
      place(innerArc, ndc.x, ndc.y, 0.95, camera, v * 0.22);
      place(halo, ndc.x, ndc.y, 0.65, camera, v * 0.4);

      if (showGhost) {
        // Magenta-Sensor-Ghost: Wandert auf der optischen Achse mit Parallaxe
        const gx = moveGhost ? ndc.x * -0.55 + 0.12 : ndc.x + 0.28;
        const gy = moveGhost ? ndc.y * -0.55 - 0.12 : ndc.y - 0.28;
        place(magentaGhost, gx, gy, 0.22, camera, v * 0.3);
      } else {
        magentaGhost.visible = false;
      }

      if (settings.S.anamorphic !== false) {
        place(streak, ndc.x, ndc.y, 0.10, camera, v * 0.45, 18);
      } else {
        streak.visible = false;
      }
      ghosts.forEach((sp) => { sp.visible = false; });
    } else {
      // Linse:A – Klassischer Kinofilm-Halo
      rainbowRing.visible = false;
      innerArc.visible = false;
      magentaGhost.visible = false;

      place(halo, ndc.x, ndc.y, 0.9, camera, v);
      if (settings.S.anamorphic !== false) {
        place(streak, ndc.x, ndc.y, 0.12, camera, v * 0.8, 18);
      } else {
        streak.visible = false;
      }
      // Geisterbilder auf der Achse Sonne–Bildmitte folgen dem Schalter „Geisterbild“ wie der Magenta-Ghost oben
      if (showGhost) ghosts.forEach((sp, i) => { const g = GHOSTS[i]; place(sp, ndc.x * g.k, ndc.y * g.k, g.s, camera, v * (1 - 0.5 * Math.abs(g.k))); });
      else ghosts.forEach((sp) => { sp.visible = false; });
    }
  };
  return group;
}

