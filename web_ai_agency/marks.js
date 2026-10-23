// Markierungen im Raum: Ring unter einer Figur oder an einem Platz, Umriss um einen Bereich.
// Über der gezeigten Figur schwebt ein Pfeil (auch sichtbar, wenn Theke oder Tisch die Füße verdecken); anchor() = seine Spitze.
// Drei Plätze: sel = was die Oberfläche gerade zeigt (Ebene 2 Bereich, Ebene 3 Figur/Platz), hov = Zeiger auf einem Eintrag der
// Oberfläche, ptr = Zeiger im 3D-Raum. Layer 1 → keine Kantenlinien; prefers-reduced-motion → kein Pulsieren.
import * as THREE from 'three';

const PI = Math.PI;
function roundRect(p, x, y, w, h, r) {
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h); p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r); p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
}
function frameGeo(w, d, r, t) {
  const s = new THREE.Shape(); roundRect(s, -w / 2, -d / 2, w, d, r);
  const h = new THREE.Path(); roundRect(h, -w / 2 + t, -d / 2 + t, w - 2 * t, d - 2 * t, Math.max(0.02, r - t)); s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, 6); g.rotateX(-PI / 2); return g;
}

export function createMarks(scene, W, reduced, color = '#3D5CF0') {
  const ringGeo = new THREE.RingGeometry(0.5, 0.62, 48).rotateX(-PI / 2), zoneGeo = new Map();
  const zoneOf = id => { if (!zoneGeo.has(id)) { const [, , , w, d] = W.st.get(id).def; zoneGeo.set(id, frameGeo(w + 0.4, d + 0.4, 0.7, 0.15)); } return zoneGeo.get(id); };
  function slot(base) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: base, depthWrite: false, toneMapped: false });
    const ring = new THREE.Mesh(ringGeo, mat), zone = new THREE.Mesh(ringGeo, mat), beacon = new THREE.Mesh(coneGeo, mat);
    [ring, zone, beacon].forEach(m => { m.visible = false; m.layers.set(1); m.renderOrder = 3; scene.add(m); });
    return { mat, ring, zone, beacon, base, want: null };
  }
  const coneGeo = new THREE.ConeGeometry(0.1, 0.2, 4).rotateX(PI);
  const S = { sel: slot(0.95), hov: slot(0.85), ptr: slot(0.6) };
  const tip = new THREE.Vector3(); let hasTip = false;
  // want: null · { station } · { actor } · { x, z, r }
  function set(name, want) { S[name].want = want || null; }
  // far = Kameraabstand zum Ziel: der Pfeil wächst mit, damit er auch im Haus (Abstand ≈ 30 m) zu sehen ist
  function update(t, far = 6) {
    hasTip = false; const big = Math.min(8, Math.max(1, far / 5));
    const pulse = reduced ? 1 : 0.78 + 0.22 * Math.sin(t * 3.2);
    for (const k in S) {
      const s = S[k], w = s.want; s.ring.visible = s.zone.visible = s.beacon.visible = false; if (!w) continue;
      s.mat.opacity = s.base * (k === 'sel' ? pulse : 1);
      if (w.station) {
        const Z = W.st.get(w.station); if (!Z) continue;
        s.zone.geometry = zoneOf(w.station); s.zone.position.set(Z.g.position.x, 0.035, Z.g.position.z); s.zone.rotation.y = Z.def[5]; s.zone.visible = true;
      } else {
        const x = w.actor ? w.actor.x : w.x, z = w.actor ? w.actor.z : w.z, r = (w.actor ? w.actor.r * 1.5 : w.r || 0.6) * (1 + (big - 1) * 0.25) * (k === 'sel' && !reduced ? 1 + 0.06 * Math.sin(t * 3.2) : 1);   // aus der Ferne größer
        s.ring.position.set(x, 0.03, z); s.ring.scale.setScalar(r / 0.56); s.ring.visible = true;
        if (w.actor && k !== 'ptr') {   // Pfeil über dem Kopf: Würfel 1,0 (Helfer 0,78) → Spitze knapp über Hut/Haar
          const h = 1.72 * w.actor.r / 0.4 + (reduced ? 0 : 0.05 * Math.sin(t * 3.2 + (k === 'hov' ? 1.5 : 0))), b = s.beacon;
          b.scale.setScalar(big); b.position.set(x, h + 0.1 * big, z); b.rotation.y = reduced ? 0.4 : t * 1.2; b.visible = true;
          if (k === 'sel') { tip.set(x, h, z); hasTip = true; }
        }
      }
    }
  }
  return { set, update, anchor: () => hasTip ? tip : null };
}
