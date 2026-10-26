// Echter Sternhimmel von der Erde aus: Yale Bright Star Catalogue (5.044 Sterne bis 6 mag) und die Linien der 88
// IAU-Sternbilder aus d3-celestial (BSD-3, Olaf Frohn) – web/data/stars.json, web/data/constellations.json. Richtungen
// aus Rektaszension/Deklination (J2000) in die Ekliptik-Szene der Stationen Erde und Sonnensystem; Farbe aus B−V
// (Ballesteros 2012 → Planck-Farbe), Helligkeit aus der V-Größenklasse. Nur dort richtig, wo der Himmel dem der Erde
// gleicht (innerhalb weniger Lichtjahre) – die fernen Stationen behalten ihren statistischen Himmel.

import * as THREE from 'three';
import { blackbody, bvToTemp, equToScene } from './astro.js';
import { starPoints, glintPoints } from './stars.js';
import { followStars } from './settings.js';
import { SKY_VERTEX } from './glsl.js';

let starsP = null, consP = null;
const fetchJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); });
export function loadStars() { return (starsP ||= fetchJson('data/stars.json')); }
export function loadConstellations() { return (consP ||= fetchJson('data/constellations.json')); }

// Die bekanntesten Sterne mit Entfernung (Hipparcos/Gaia, gerundet) – für Beschriftungen und Info-Karten
export const BRIGHT = {
  Sirius: { ly: 8.6, x: 'Hellster Stern des Nachthimmels (−1,46 mag), 8,6 Lj entfernt, mit einem Weißen Zwerg als Begleiter.' },
  Canopus: { ly: 310, x: 'Zweithellster Stern, ein gelbweißer Überriese rund 310 Lj entfernt – von Mitteleuropa aus nie über dem Horizont.' },
  Arcturus: { ly: 37, x: 'Hellster Stern des Nordhimmels, ein oranger Riese, 37 Lj entfernt.' },
  Vega: { ly: 25, x: '25 Lj entfernt, Eckpunkt des Sommerdreiecks; durch die Präzession der Erdachse in rund 12.000 Jahren Polarstern.' },
  Capella: { ly: 43, x: 'Zwei gelbe Riesensterne, die sich in 104 Tagen umkreisen, 43 Lj entfernt.' },
  Rigel: { ly: 860, x: 'Blauer Überriese, rund 860 Lj entfernt und etwa 120.000-mal so leuchtkräftig wie die Sonne.' },
  Procyon: { ly: 11.5, x: '11,5 Lj entfernt, mit einem Weißen Zwerg als Begleiter; Eckpunkt des Winterdreiecks.' },
  Betelgeuse: { ly: 550, x: 'Roter Überriese, Entfernung unsicher (≈ 500–650 Lj). 2019/20 wurde er durch eine ausgestoßene Staubwolke deutlich dunkler; nach Modellen explodiert er innerhalb der nächsten rund 100.000 Jahre als Supernova.' },
  Achernar: { ly: 139, x: 'Dreht so schnell, dass er abgeplattet ist (Äquator ≈ 1,5 × Pol); 139 Lj entfernt.' },
  Hadar: { ly: 390, x: 'β Centauri, blauer Riese rund 390 Lj entfernt, zeigt mit α Centauri zum Kreuz des Südens.' },
  Altair: { ly: 16.7, x: '16,7 Lj entfernt, dreht in 9 Stunden einmal um sich selbst; Eckpunkt des Sommerdreiecks.' },
  Acrux: { ly: 320, x: 'Hellster Stern des Kreuzes des Südens, ein Mehrfachsystem rund 320 Lj entfernt.' },
  Aldebaran: { ly: 65, x: 'Oranger Riese im Auge des Stiers, 65 Lj entfernt; er steht nur in derselben Blickrichtung wie die Hyaden, die gut doppelt so weit entfernt sind.' },
  Antares: { ly: 550, x: 'Roter Überriese im Skorpion, rund 550 Lj entfernt, etwa 700 Sonnenradien groß.' },
  Spica: { ly: 250, x: 'Enges Doppelsystem zweier heißer Sterne, 250 Lj entfernt; Hauptstern der Jungfrau.' },
  Pollux: { ly: 34, x: 'Oranger Riese 34 Lj entfernt mit einem bekannten Planeten (Pollux b, 2006).' },
  Fomalhaut: { ly: 25, x: '25 Lj entfernt, umgeben von einem Staubring, den Hubble und JWST abgebildet haben.' },
  Deneb: { ly: 2600, x: 'Einer der leuchtkräftigsten Sterne überhaupt, Entfernung unsicher (≈ 1.500–2.600 Lj); Schwanz des Schwans.' },
  Polaris: { ly: 430, x: 'Der Polarstern steht nahe der Verlängerung der Erdachse; ein Cepheiden-Veränderlicher rund 430 Lj entfernt.' },
  Regulus: { ly: 79, x: 'Hellster Stern des Löwen, 79 Lj entfernt, rotiert in 16 Stunden und ist deshalb stark abgeplattet.' },
};
// Bekannte Sternbilder mit einem Satz (für Beschriftungen bei eingeschalteten Linien)
export const CONST_INFO = {
  Ori: 'Der Jäger: Betelgeuse (rot) und Rigel (blau) rahmen die drei Gürtelsterne; unterhalb des Gürtels liegt der Orion-Nebel (Station 04).',
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
  Sco: 'Der Skorpion mit dem roten Antares; sein Schwanz zeigt in Richtung des Zentrums der Milchstraße.',
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
  followStars(group);   // Zahnrad › Global › Bild „Sterne und Milchstraße“
  return group;
}

// Linien leben leise (soft-motion): Enden laufen weich in die Sterne aus, jede Figur atmet langsam mit eigener Phase
// (Δ 0,2 · 9 s), alle 18 s gleitet ein kühler Lichtzug die Linienzüge entlang – heller Kopf, Bloom gibt den Schein.
// Ruhig/Aus (still): fester mittlerer Schein, kein Lichtzug. Ein-/Ausblenden über uFade (0,9 s).
const LINE_VERT = /* glsl */ `
${SKY_VERTEX}
attribute vec4 aLine;   // x: Weg ab Stern (°), y: Länge Stern–Stern (°), z: Weg des Linienzugs bis dorthin (°), w: Phase der Figur
varying vec4 vLine;
void main() { vLine = aLine; gl_Position = skyPosition(normalize(position)); }
`;
const LINE_FRAG = /* glsl */ `
uniform vec3 uColor, uHead;
uniform float uGain, uTime, uFade, uMove;
varying vec4 vLine;
void main() {
  float ends = mix(0.3, 1.0, smoothstep(0.25, 1.4, min(vLine.x, vLine.y - vLine.x)));
  float breath = 1.0 + 0.1 * uMove * sin(6.2832 * (uTime / 9.0 + vLine.w));
  float head = fract(uTime / 18.0 + vLine.w) * 96.0 - 6.0;     // 5 °/s ab kurz vor dem Linienzug, dann Pause
  float d = (vLine.z + vLine.x - head) / 3.0;
  float sweep = uMove * exp(-d * d);
  vec3 col = mix(uColor, uHead, 0.6 * sweep) * uGain * (breath + 1.6 * sweep);
  gl_FragColor = vec4(col * ends * uFade, 1.0);
}
`;
const FADE_S = 0.9;

// Linien der Sternbilder auf der Himmelskugel (additiv, zart) + Mitten und Namen (de) für Beschriftungen;
// userData.show(an) blendet weich ein/aus, userData.update(dt, t, still) treibt Atmen und Lichtzug
export async function createConstellationLines({ color = 0x8fb0e0, head = 0xcfefff, gain = 0.28 } = {}) {
  const con = await loadConstellations();
  const pos = [], line = [];
  const wrap = (a) => ((a + 540) % 360) - 180;
  let fig = 0;
  for (const segs of Object.values(con.lines)) {
    const ph = (fig++ * 0.618034) % 1;   // goldener Schnitt: Nachbarn atmen nie im Gleichtakt
    for (const seg of segs) {
      let walked = 0;
      for (let i = 1; i < seg.length; i++) {
        const [ra0, de0] = seg[i - 1], [ra1, de1] = seg[i];
        const dRa = wrap(ra1 - ra0) * Math.cos(((de0 + de1) / 2) * Math.PI / 180), len = Math.hypot(dRa, de1 - de0);
        // lange Segmente in Teilstücke, damit sie dem Großkreis folgen
        const steps = Math.max(1, Math.ceil(Math.hypot(wrap(ra1 - ra0), de1 - de0) / 4));
        let prev = equToScene(ra0, de0), fPrev = 0;
        for (let k = 1; k <= steps; k++) {
          const f = k / steps;
          const cur = equToScene(ra0 + wrap(ra1 - ra0) * f, de0 + (de1 - de0) * f);
          pos.push(...prev, ...cur);
          for (const g of [fPrev, f]) line.push(len * g, len, walked, ph);
          prev = cur;
          fPrev = f;
        }
        walked += len;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aLine', new THREE.Float32BufferAttribute(line, 4));
  const u = { uColor: { value: new THREE.Color(color) }, uHead: { value: new THREE.Color(head) }, uGain: { value: gain },
    uTime: { value: 0 }, uFade: { value: 0 }, uMove: { value: 1 } };
  const m = new THREE.ShaderMaterial({
    vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, uniforms: u,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true,
  });
  const lines = new THREE.LineSegments(g, m);
  lines.frustumCulled = false;
  lines.renderOrder = -9;
  let on = false;
  lines.userData.show = (v) => { on = v; if (v) lines.visible = true; };
  lines.userData.update = (dt, t, still) => {
    u.uFade.value = still ? +on : Math.min(1, Math.max(0, u.uFade.value + (on ? dt : -dt / 0.7) / FADE_S));   // raus ≈ 70 %
    if (!on && u.uFade.value === 0) lines.visible = false;
    u.uTime.value = t;
    u.uMove.value = still ? 0 : 1;
  };
  lines.userData.names = Object.entries(con.names).map(([id, c]) => ({ id, de: c.de.replace(/ /g, ' '), la: c.la, dir: new THREE.Vector3(...equToScene(c.ra, c.dec)) }));
  return lines;
}
