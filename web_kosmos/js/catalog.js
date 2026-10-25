// Echter Sternhimmel von der Erde aus: Yale Bright Star Catalogue (5.044 Sterne bis 6 mag) und die Linien der 88
// IAU-Sternbilder aus d3-celestial (BSD-3, Olaf Frohn) – web/data/stars.json, web/data/constellations.json. Richtungen
// aus Rektaszension/Deklination (J2000) in die Ekliptik-Szene der Stationen Erde und Sonnensystem; Farbe aus B−V
// (Ballesteros 2012 → Planck-Farbe), Helligkeit aus der V-Größenklasse. Nur dort richtig, wo der Himmel dem der Erde
// gleicht (innerhalb weniger Lichtjahre) – die fernen Stationen behalten ihren statistischen Himmel.

import * as THREE from 'three';
import { blackbody, bvToTemp, equToScene } from './astro.js';
import { starPoints, glintPoints } from './stars.js';
import { SKY_VERTEX } from './glsl.js';

let starsP = null, consP = null;
const fetchJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); });
export function loadStars() { return (starsP ||= fetchJson('data/stars.json')); }
export function loadConstellations() { return (consP ||= fetchJson('data/constellations.json')); }

// Die bekanntesten Sterne mit Entfernung (Hipparcos/Gaia, gerundet) – für Beschriftungen und Info-Karten
export const BRIGHT = {
  Sirius: { ly: 8.6, x: 'Hellster Stern des Nachthimmels (−1,46 mag), 8,6 Lj entfernt, mit einem Weißen Zwerg als Begleiter.' },
  Canopus: { ly: 310, x: 'Zweithellster Stern, ein gelbweißer Überriese rund 310 Lj entfernt – von Mitteleuropa aus nie über dem Horizont.' },
  Arcturus: { ly: 37, x: 'Hellster Stern des Nordhimmels, ein roter Riese 37 Lj entfernt; sein Licht brach auf, als heute Vierzigjährige geboren wurden.' },
  Vega: { ly: 25, x: '25 Lj entfernt, Eckpunkt des Sommerdreiecks; in 12.000 Jahren durch die Präzession unser Polarstern.' },
  Capella: { ly: 43, x: 'Zwei gelbe Riesensterne, die sich in 104 Tagen umkreisen, 43 Lj entfernt.' },
  Rigel: { ly: 860, x: 'Blauer Überriese, rund 860 Lj entfernt und etwa 120.000-mal so leuchtkräftig wie die Sonne.' },
  Procyon: { ly: 11.5, x: '11,5 Lj entfernt, mit einem Weißen Zwerg als Begleiter; Eckpunkt des Winterdreiecks.' },
  Betelgeuse: { ly: 550, x: 'Roter Überriese, Entfernung unsicher (≈ 500–650 Lj). 2019/20 verdunkelte ihn eine Staubwolke; irgendwann in den nächsten 100.000 Jahren explodiert er als Supernova.' },
  Achernar: { ly: 139, x: 'Dreht so schnell, dass er abgeplattet ist (Äquator ≈ 1,5 × Pol); 139 Lj entfernt.' },
  Hadar: { ly: 390, x: 'β Centauri, blauer Riese rund 390 Lj entfernt, zeigt mit α Centauri zum Kreuz des Südens.' },
  Altair: { ly: 16.7, x: '16,7 Lj entfernt, dreht in 9 Stunden einmal um sich selbst; Eckpunkt des Sommerdreiecks.' },
  Acrux: { ly: 320, x: 'Hellster Stern des Kreuzes des Südens, ein Mehrfachsystem rund 320 Lj entfernt.' },
  Aldebaran: { ly: 65, x: 'Rotes Auge des Stiers, ein Riese 65 Lj entfernt – er steht nur zufällig vor den Hyaden.' },
  Antares: { ly: 550, x: 'Roter Überriese im Skorpion, rund 550 Lj entfernt, etwa 700 Sonnenradien groß.' },
  Spica: { ly: 250, x: 'Enges Doppelsystem zweier heißer Sterne, 250 Lj entfernt; Hauptstern der Jungfrau.' },
  Pollux: { ly: 34, x: 'Oranger Riese 34 Lj entfernt mit einem bekannten Planeten (Pollux b, 2006).' },
  Fomalhaut: { ly: 25, x: '25 Lj entfernt, umgeben von einem Staubring, den Hubble und JWST abgebildet haben.' },
  Deneb: { ly: 2600, x: 'Einer der leuchtkräftigsten Sterne überhaupt, Entfernung unsicher (≈ 1.500–2.600 Lj); Schwanz des Schwans.' },
  Polaris: { ly: 430, x: 'Der Polarstern steht nahe der Verlängerung der Erdachse; ein Cepheiden-Veränderlicher rund 430 Lj entfernt.' },
  Regulus: { ly: 79, x: 'Herz des Löwen, 79 Lj entfernt, rotiert in 16 Stunden und ist deshalb stark abgeplattet.' },
};
// Bekannte Sternbilder mit einem Satz (für Beschriftungen bei eingeschalteten Linien)
export const CONST_INFO = {
  Ori: 'Der Jäger: Betelgeuse (rot) und Rigel (blau) rahmen die drei Gürtelsterne; unter dem Gürtel hängt der Orion-Nebel (Station 04).',
  UMa: 'Der Große Wagen ist nur sein hinterer Teil. Die Verlängerung der hinteren Kastensterne zeigt zum Polarstern.',
  UMi: 'Am Ende der Deichsel steht Polaris – fast genau über dem Nordpol der Erde.',
  Cas: 'Das Himmels-W gegenüber dem Großen Wagen, in der Milchstraße; immer sichtbar von Mitteleuropa.',
  Cyg: 'Das Kreuz des Nordens liegt im Band der Milchstraße; Deneb bildet mit Wega und Atair das Sommerdreieck.',
  Lyr: 'Kleines Sternbild mit Wega, dem fünfthellsten Stern, und dem Ringnebel M57.',
  Aql: 'Der Adler mit Atair, einem der nächsten hellen Sterne (16,7 Lj).',
  Tau: 'Der Stier mit Aldebaran, den Hyaden und den Plejaden; an seinem Horn steht der Krebsnebel (Station 05).',
  Gem: 'Die Zwillinge Castor und Pollux; von hier scheinen die Geminiden im Dezember zu kommen.',
  Leo: 'Der Löwe mit Regulus; sein Kopf ist die „Sichel“. Frühlingssternbild.',
  Vir: 'Die Jungfrau mit Spica; hinter ihr liegt der Virgo-Galaxienhaufen (Station 09).',
  Sco: 'Der Skorpion mit dem roten Antares; sein Schwanz zeigt ins Zentrum der Milchstraße.',
  Sgr: 'Die „Teekanne“: In Richtung des Schützen liegt das galaktische Zentrum mit Sagittarius A* (Station 07).',
  Cru: 'Das Kreuz des Südens, kleinstes Sternbild; daneben der dunkle Kohlensack, eine Staubwolke.',
  Cen: 'Der Zentaur mit α Centauri, dem nächsten Sternsystem (4,2 Lj), und ω Centauri, dem größten Kugelsternhaufen.',
  Per: 'Perseus mit dem Bedeckungsveränderlichen Algol; die Perseiden im August kommen aus dieser Richtung.',
  And: 'Andromeda: Mit bloßem Auge ist hier die Andromeda-Galaxie M31 zu sehen (Station 08), 2,5 Mio. Lj entfernt.',
  Peg: 'Das Herbstviereck des Pegasus; sein Eckstern Alpheratz gehört heute zur Andromeda.',
  Boo: 'Bärenhüter mit Arktur, dem hellsten Stern des Nordhimmels.',
  CMa: 'Der Große Hund mit Sirius, dem hellsten Stern des Nachthimmels.',
  Car: 'Kiel des Schiffs mit Canopus, dem zweithellsten Stern, und dem Carina-Nebel.',
  Aur: 'Fuhrmann mit Capella; im Winter hoch am Himmel.',
};

// Sternhimmel aus dem Katalog; Namen der hellsten Sterne und ihre Richtungen für Beschriftungen
export async function createCatalogSky({ gain = 1, limit = 6.6, glint = true } = {}) {
  const cat = await loadStars();
  const n = cat.s.length;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), mag = new Float32Array(n);
  cat.s.forEach(([ra, dec, m, bv], i) => {
    pos.set(equToScene(ra, dec), i * 3);
    col.set(blackbody(bvToTemp(bv)), i * 3);
    mag[i] = m;
  });
  const group = new THREE.Group();
  const pts = starPoints(pos, col, mag, { gain, limit });
  group.add(pts);
  const mats = [pts.material];
  if (glint) {
    const g = glintPoints(pos, col, mag, { gain: gain * 0.9, limit: 1.7 });
    group.add(g);
    mats.push(g.material);
  }
  group.userData.setPixelRatio = (pr) => mats.forEach((m) => { m.uniforms.uPx.value = pr; });
  group.userData.named = Object.entries(cat.names).map(([i, name]) => {
    const [ra, dec, m, bv] = cat.s[+i];
    return { name, mag: m, bv, dir: new THREE.Vector3(...equToScene(ra, dec)) };
  });
  group.userData.count = n;
  return group;
}

const LINE_VERT = /* glsl */ `
${SKY_VERTEX}
void main() { gl_Position = skyPosition(normalize(position)); }
`;
const LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
void main() { gl_FragColor = vec4(uColor * uGain, 1.0); }
`;

// Linien der Sternbilder auf der Himmelskugel (additiv, zart) + Mitten und Namen (de) für Beschriftungen
export async function createConstellationLines({ color = 0x8fb0e0, gain = 0.28 } = {}) {
  const con = await loadConstellations();
  const pos = [];
  for (const segs of Object.values(con.lines)) {
    for (const seg of segs) {
      for (let i = 1; i < seg.length; i++) {
        const [ra0, de0] = seg[i - 1], [ra1, de1] = seg[i];
        // lange Segmente in Teilstücke, damit sie dem Großkreis folgen
        const steps = Math.max(1, Math.ceil(Math.hypot(((ra1 - ra0 + 540) % 360) - 180, de1 - de0) / 4));
        let prev = equToScene(ra0, de0);
        for (let k = 1; k <= steps; k++) {
          const f = k / steps;
          const ra = ra0 + (((ra1 - ra0 + 540) % 360) - 180) * f, de = de0 + (de1 - de0) * f;
          const cur = equToScene(ra, de);
          pos.push(...prev, ...cur);
          prev = cur;
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.ShaderMaterial({
    vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, uniforms: { uColor: { value: new THREE.Color(color) }, uGain: { value: gain } },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true,
  });
  const lines = new THREE.LineSegments(g, m);
  lines.frustumCulled = false;
  lines.renderOrder = -9;
  lines.userData.names = Object.entries(con.names).map(([id, c]) => ({ id, de: c.de.replace(/ /g, ' '), la: c.la, dir: new THREE.Vector3(...equToScene(c.ra, c.dec)) }));
  return lines;
}
