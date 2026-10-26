// Drehachsen aller Planeten und Monde (Zahnrad Global → Himmel „Drehachsen“, URL `?axes=1`): je ein Stummel über Nord- und
// Südpol als Kind des Körpers, dreht und neigt sich mit ihm. Gilt, weil alle Stationen den Nordpol auf die lokale +y-Achse legen
// (SphereGeometry, ellipsoidGeometry, moonShape, tidalQuat). Nord in Eisblau, Süd gedämpft; der Körper verdeckt den Stummel
// hinter sich (Tiefentest). Eine Geometrie und ein Material für alle: der Schalter blendet nur das Material um – nichts zu
// registrieren oder beim Wechsel der Station aufzuräumen.
import * as THREE from 'three';
import { settings, onSettings } from './settings.js';

const OUT = 1.7;   // Stummel reicht vom Pol bis 1,7 Polradien
const N = new THREE.Color(0x33ccff), S = new THREE.Color(0xaab4c8);
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 0, OUT, 0, 0, -1, 0, 0, -OUT, 0], 3));
geo.setAttribute('color', new THREE.Float32BufferAttribute([...N.toArray(), ...N.toArray(), ...S.toArray(), ...S.toArray()], 3));
const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });

let forced = new URLSearchParams(location.search).get('axes');   // ?axes=1 für Screenshots, bis der Schalter bedient wird
const apply = () => { mat.visible = forced !== null ? forced !== '0' : settings.S.axes; };
apply();
onSettings((keys) => { if (keys.includes('axes')) { forced = null; apply(); } });

// Achse an einen Körper hängen; Polradius aus der Geometrie, Abplattung und Größe erbt sie über die Skalierung des Körpers
export function spinAxis(body) {
  const g = body.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const axis = new THREE.LineSegments(geo, mat);
  axis.scale.setScalar(g.boundingBox.max.y);
  axis.renderOrder = body.renderOrder;
  axis.raycast = () => {};   // Abzeichen und Klicks treffen weiter nur den Körper
  body.add(axis);
  return body;
}
